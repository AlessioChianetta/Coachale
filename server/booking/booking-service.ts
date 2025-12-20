import { db } from "../db";
import { appointmentBookings, consultantAvailabilitySettings, users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { createGoogleCalendarEvent } from "../google-calendar-service";
import { GeminiClient, getModelWithThinking } from "../ai/provider-factory";
import { sendEmail } from "../services/email-scheduler";

export interface BookingExtractionResult {
  isConfirming: boolean;
  date: string | null;
  time: string | null;
  phone: string | null;
  email: string | null;
  name: string | null;
  confidence: "high" | "medium" | "low";
  hasAllData: boolean;
}

export interface BookingModificationResult {
  intent: "MODIFY" | "CANCEL" | "ADD_ATTENDEES" | "NONE";
  newDate: string | null;
  newTime: string | null;
  attendees: string[];
  confirmedTimes: number;
  confidence: "high" | "medium" | "low";
}

export interface BookingCreationResult {
  success: boolean;
  bookingId: string | null;
  googleEventId: string | null;
  googleMeetLink: string | null;
  errorMessage: string | null;
}

export interface ExistingBooking {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  clientEmail: string | null;
  clientPhone: string | null;
  googleEventId: string | null;
}

export interface ConversationMessage {
  sender: "client" | "ai" | "consultant";
  messageText: string;
}

export interface BookingData {
  date: string;
  time: string;
  phone: string;
  email: string;
  name?: string;
  clientName?: string;
}

function buildNewBookingExtractionPrompt(conversationContext: string): string {
  return `
Analizza questa conversazione recente di un lead che sta prenotando un appuntamento:

CONVERSAZIONE RECENTE:
${conversationContext}

TASK: Estrai TUTTI i dati forniti dal lead durante la conversazione (anche se in messaggi separati).

RISPONDI SOLO con un oggetto JSON nel seguente formato:
{
  "isConfirming": true/false,
  "date": "YYYY-MM-DD" (null se non confermato),
  "time": "HH:MM" (null se non confermato),
  "phone": "numero di telefono" (null se non fornito),
  "email": "email@example.com" (null se non fornita),
  "name": "nome del lead" (null se non fornito),
  "confidence": "high/medium/low",
  "hasAllData": true/false (true solo se hai data, ora, telefono ED email)
}

ESEMPI DI CONVERSAZIONI (LEGGI ATTENTAMENTE):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 1 - FLUSSO COMPLETO step-by-step (CASO TIPICO):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI: Ti va meglio mattina o pomeriggio?
LEAD: Pomeriggio
AI: Perfetto! Ti propongo: Mercoledì 6 novembre alle 15:00, Giovedì 7 novembre alle 16:30. Quale preferisci?
LEAD: Mercoledì alle 15
AI: Perfetto! Mercoledì 6 novembre alle 15:00. Per confermare, mi confermi il tuo numero di telefono?
LEAD: 3331234567
AI: Grazie! E mi lasci anche la tua email? Te la aggiungo all'invito del calendario.
LEAD: mario@test.it

→ {"isConfirming": true, "date": "2025-11-06", "time": "15:00", "phone": "3331234567", "email": "mario@test.it", "name": null, "confidence": "high", "hasAllData": true}

⚠️ NOTA: Questo è il flusso STANDARD - telefono PRIMA, poi email

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 2 - Dati parziali (MANCA EMAIL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI: Quale orario preferisci?
LEAD: Martedì alle 15:30
AI: Perfetto! Mi confermi il tuo telefono?
LEAD: 3331234567

→ {"isConfirming": true, "date": "2025-11-05", "time": "15:30", "phone": "3331234567", "email": null, "name": null, "confidence": "medium", "hasAllData": false}

⚠️ NOTA: hasAllData = FALSE perché manca l'email

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 3 - Dati parziali (MANCA TELEFONO E EMAIL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI: Ti propongo: Lunedì 4 novembre alle 10:00, Martedì 5 alle 14:00
LEAD: Lunedì alle 10 va bene

→ {"isConfirming": true, "date": "2025-11-04", "time": "10:00", "phone": null, "email": null, "name": null, "confidence": "low", "hasAllData": false}

⚠️ NOTA: hasAllData = FALSE perché mancano telefono ED email

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 4 - Tutto in un messaggio:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: Ok martedì alle 15:30, il mio numero è 3331234567 e la mail mario@test.it

→ {"isConfirming": true, "date": "2025-11-05", "time": "15:30", "phone": "3331234567", "email": "mario@test.it", "name": null, "confidence": "high", "hasAllData": true}

⚠️ NOTA: Anche se tutto in un messaggio, estrai correttamente tutti i campi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 REGOLE CRITICHE DI ESTRAZIONE:
1. Cerca i dati in TUTTA la conversazione (ultimi messaggi), NON solo l'ultimo messaggio
2. Il telefono viene quasi SEMPRE fornito PRIMA dell'email nel flusso normale
3. hasAllData = true SOLO se hai TUTTI E 4 i campi: date, time, phone, email
4. Se anche 1 solo campo è null → hasAllData = FALSE
5. Non importa se i dati sono sparsi su messaggi diversi - estraili tutti
6. Estrai il nome se menzionato dal lead (es: "Mi chiamo Mario", "Sono Marco Rossi")

🗓️ DATA CORRENTE: ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}

⚠️ ATTENZIONE ALLE DATE:
- Se vedi date come "maggio 2024", "28 maggio 2024" o altre date del 2024, sono nel PASSATO
- Devi estrarre solo date FUTURE a partire da oggi (${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })})
- Se il lead ha confermato una data passata (es: maggio 2024), impostala comunque ma il sistema la rifiuterà automaticamente

REGOLE VALIDAZIONE hasAllData:
- hasAllData = false se manca anche 1 solo campo
- hasAllData = false se date è null
- hasAllData = false se time è null  
- hasAllData = false se phone è null
- hasAllData = false se email è null
- hasAllData = true SOLO se tutti e 4 sono presenti e non-null
`;
}

function buildModificationExtractionPrompt(
  conversationContext: string,
  existingBooking: ExistingBooking
): string {
  return `
Analizza questa conversazione recente di un lead che ha GIÀ un appuntamento confermato:

APPUNTAMENTO ESISTENTE:
- Data: ${existingBooking.appointmentDate}
- Ora: ${existingBooking.appointmentTime}
- Email: ${existingBooking.clientEmail}
- Telefono: ${existingBooking.clientPhone}

CONVERSAZIONE RECENTE:
${conversationContext}

TASK: Identifica se il lead vuole MODIFICARE, CANCELLARE, AGGIUNGERE INVITATI o solo CONVERSARE sull'appuntamento esistente.

RISPONDI SOLO con un oggetto JSON nel seguente formato:
{
  "intent": "MODIFY" | "CANCEL" | "ADD_ATTENDEES" | "NONE",
  "newDate": "YYYY-MM-DD" (solo se intent=MODIFY, altrimenti null),
  "newTime": "HH:MM" (solo se intent=MODIFY, altrimenti null),
  "attendees": ["email1@example.com", "email2@example.com"] (solo se intent=ADD_ATTENDEES, altrimenti []),
  "confirmedTimes": numero (1 per MODIFY se confermato, 2 per CANCEL se confermato 2 volte, 0 se non confermato o ADD_ATTENDEES),
  "confidence": "high/medium/low"
}

ESEMPI:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 1 - MODIFICA (proposta, NON ancora confermata):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: possiamo modificarlo a martedì alle 16:00?
AI: Perfetto! Vuoi spostare l'appuntamento a martedì 5 novembre alle 16:00? Confermi che va bene?

→ {"intent": "MODIFY", "newDate": "2025-11-05", "newTime": "16:00", "attendees": [], "confirmedTimes": 0, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 2 - MODIFICA (CONFERMATA dal lead):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: possiamo spostarlo alle 18?
AI: Certo! Vuoi spostarlo alle 18:00? Confermi?
LEAD: sì va bene

→ {"intent": "MODIFY", "newDate": "${existingBooking.appointmentDate}", "newTime": "18:00", "attendees": [], "confirmedTimes": 1, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 2b - MODIFICA DIRETTA/IMPERATIVA (NON è ancora confermata):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando il lead usa una forma IMPERATIVA o una richiesta DIRETTA, è solo una RICHIESTA.
L'AI deve SEMPRE chiedere conferma esplicita prima che il sistema esegua la modifica.

LEAD: mettilo alle 10:00
→ {"intent": "MODIFY", "newDate": "${existingBooking.appointmentDate}", "newTime": "10:00", "attendees": [], "confirmedTimes": 0, "confidence": "high"}

LEAD: me lo puoi mettere alle 10?
→ {"intent": "MODIFY", "newDate": "${existingBooking.appointmentDate}", "newTime": "10:00", "attendees": [], "confirmedTimes": 0, "confidence": "high"}

LEAD: spostalo a domani alle 14
→ {"intent": "MODIFY", "newDate": "[data domani]", "newTime": "14:00", "attendees": [], "confirmedTimes": 0, "confidence": "high"}

⚠️ NOTA: Le forme imperative ("mettilo", "spostalo", "cambialo") e le richieste dirette 
("me lo metti", "puoi metterlo") sono RICHIESTE, non conferme. confirmedTimes=0.
Solo risposte esplicite come "sì", "confermo", "va bene" dopo che l'AI ha chiesto conferma 
contano come conferma (confirmedTimes=1).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 3 - CANCELLAZIONE (prima conferma):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: devo disdire l'appuntamento
AI: [messaggio persuasivo] Quindi, mi confermi che vuoi davvero cancellare?
LEAD: sì voglio cancellare

→ {"intent": "CANCEL", "newDate": null, "newTime": null, "attendees": [], "confirmedTimes": 1, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 4 - CANCELLAZIONE (CONFERMATA 2 volte):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: voglio cancellare
AI: [persuasione] Confermi che vuoi cancellare?
LEAD: sì
AI: Ok, capisco. Solo per essere sicuri: confermi che vuoi procedere con la cancellazione?
LEAD: sì confermo

→ {"intent": "CANCEL", "newDate": null, "newTime": null, "attendees": [], "confirmedTimes": 2, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 5 - AGGIUNTA INVITATI (1 email):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: Mi aggiungi mario.rossi@example.com agli invitati?
AI: Certo! Aggiungo subito mario.rossi@example.com agli invitati.

→ {"intent": "ADD_ATTENDEES", "newDate": null, "newTime": null, "attendees": ["mario.rossi@example.com"], "confirmedTimes": 0, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 6 - AGGIUNTA INVITATI (multipli):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: Aggiungi anche il mio socio chianettalessio1@gmail.com e mia moglie laura@test.it
AI: Perfetto! Aggiungo chianettalessio1@gmail.com e laura@test.it agli invitati.

→ {"intent": "ADD_ATTENDEES", "newDate": null, "newTime": null, "attendees": ["chianettalessio1@gmail.com", "laura@test.it"], "confirmedTimes": 0, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 7 - AGGIUNTA INVITATI (con contesto):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: invita anche giovanni.verdi@company.com è il mio collega
AI: Ottimo! Aggiungo giovanni.verdi@company.com all'appuntamento.

→ {"intent": "ADD_ATTENDEES", "newDate": null, "newTime": null, "attendees": ["giovanni.verdi@company.com"], "confirmedTimes": 0, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 8 - NESSUNA AZIONE (solo conversazione):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: grazie per l'appuntamento, a presto!

→ {"intent": "NONE", "newDate": null, "newTime": null, "attendees": [], "confirmedTimes": 0, "confidence": "high"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗓️ DATA CORRENTE: ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}

⚠️ REGOLE:
1. intent="MODIFY" solo se il lead vuole cambiare data/ora
2. intent="CANCEL" solo se vuole cancellare/disdire
3. intent="ADD_ATTENDEES" solo se vuole aggiungere invitati/partecipanti all'appuntamento
4. intent="NONE" per qualsiasi altra conversazione
5. Se cambia solo l'ora, newDate = data esistente
6. Estrai le nuove date/ore dal contesto della conversazione
7. Per ADD_ATTENDEES: estrai TUTTE le email valide menzionate e mettile nell'array "attendees"
8. IMPORTANTE: estrai solo email valide in formato corretto (es: utente@dominio.com, nome.cognome@azienda.it)
9. Ignora testo che sembra email ma non ha @, o che non ha un dominio valido
10. Riconosci frasi come: "aggiungi", "invita anche", "metti anche", "mi aggiungi", "inserisci" seguiti da email
11. Per MODIFY e CANCEL: attendees deve essere sempre [] (array vuoto)
12. Per ADD_ATTENDEES: attendees contiene array di email da aggiungere
13. confirmedTimes = numero di volte che il lead ha ESPLICITAMENTE confermato (conta "sì", "confermo", "va bene", ecc.)
14. Per MODIFY: confirmedTimes = 1 SOLO quando il lead conferma esplicitamente DOPO che l'AI ha chiesto conferma
15. Per CANCEL: confirmedTimes = 1 o 2 in base a quante volte ha confermato esplicitamente
16. Per ADD_ATTENDEES: confirmedTimes = 0 (nessuna conferma necessaria)
17. Se non ha ancora confermato esplicitamente: confirmedTimes = 0
18. IMPORTANTE: Le richieste dirette ("mettilo alle 10", "spostalo alle 14") NON contano come conferma - confirmedTimes=0 finché il lead non conferma esplicitamente
`;
}

function buildConversationContext(messages: ConversationMessage[]): string {
  return messages
    .map(m => `${m.sender === 'client' ? 'LEAD' : 'AI'}: ${m.messageText}`)
    .join('\n');
}

function parseJsonResponse<T>(responseText: string): T | null {
  try {
    let cleanText = responseText.trim();
    
    const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      cleanText = jsonMatch[1].trim();
    }
    
    const objectMatch = cleanText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      cleanText = objectMatch[0];
    }
    
    return JSON.parse(cleanText) as T;
  } catch (error) {
    console.error('❌ [BOOKING SERVICE] Failed to parse JSON response:', error);
    console.error('   Response text:', responseText.substring(0, 500));
    return null;
  }
}

export async function extractBookingDataFromConversation(
  messages: ConversationMessage[],
  existingBooking: ExistingBooking | null,
  aiClient: GeminiClient,
  timezone: string = "Europe/Rome",
  providerName?: string
): Promise<BookingExtractionResult | BookingModificationResult | null> {
  const conversationContext = buildConversationContext(messages);
  
  const prompt = existingBooking
    ? buildModificationExtractionPrompt(conversationContext, existingBooking)
    : buildNewBookingExtractionPrompt(conversationContext);

  console.log(`\n🔍 [BOOKING SERVICE] Extracting data from ${messages.length} messages`);
  console.log(`   Mode: ${existingBooking ? 'MODIFICATION' : 'NEW BOOKING'}`);
  console.log(`   Timezone: ${timezone}`);

  const { model, useThinking, thinkingLevel } = getModelWithThinking(providerName || 'Vertex AI');
  console.log(`   🧠 [AI] Using model: ${model}, thinking: ${useThinking ? `enabled (${thinkingLevel})` : 'disabled'}`);

  try {
    const response = await aiClient.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        ...(useThinking && { thinkingConfig: { thinkingLevel } }),
      },
    });

    let responseText = "";
    try {
      if (response && response.response && typeof response.response.text === 'function') {
        responseText = response.response.text() || "";
      } else if (response && typeof (response as any).text === 'function') {
        responseText = (response as any).text() || "";
      } else if (response && typeof (response as any).text === 'string') {
        responseText = (response as any).text || "";
      }
    } catch (textError: any) {
      console.warn(`⚠️ [BOOKING SERVICE] Could not extract text from AI response: ${textError.message}`);
      responseText = "";
    }
    
    if (!responseText) {
      console.log(`   ⚠️ No text in AI response - returning null`);
      return null;
    }
    console.log(`   AI Response length: ${responseText.length} chars`);

    if (existingBooking) {
      const result = parseJsonResponse<BookingModificationResult>(responseText);
      if (result) {
        console.log(`   Parsed modification result: intent=${result.intent}, confirmedTimes=${result.confirmedTimes}`);
        return result;
      }
    } else {
      const result = parseJsonResponse<BookingExtractionResult>(responseText);
      if (result) {
        console.log(`   Parsed extraction result: hasAllData=${result.hasAllData}, date=${result.date}, time=${result.time}`);
        return result;
      }
    }

    return null;
  } catch (error: any) {
    console.error(`❌ [BOOKING SERVICE] AI extraction failed: ${error.message}`);
    return null;
  }
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export async function validateBookingData(
  extracted: BookingExtractionResult,
  consultantId: string,
  timezone: string = "Europe/Rome",
  source: 'whatsapp' | 'public_link' = 'whatsapp'
): Promise<ValidationResult> {
  console.log(`\n🔍 [BOOKING SERVICE] Validating booking data for consultant ${consultantId} (source: ${source})`);

  // Per WhatsApp richiedi tutti i dati incluso phone
  // Per public_link richiedi solo date, time, email
  if (source === 'whatsapp' && !extracted.hasAllData) {
    return { valid: false, reason: "Dati incompleti. Mancano informazioni obbligatorie." };
  }

  if (!extracted.date || !extracted.time) {
    return { valid: false, reason: "Data e/o ora non specificati." };
  }

  // Phone is required for WhatsApp but optional for public links
  if (source === 'whatsapp' && !extracted.phone) {
    return { valid: false, reason: "Numero di telefono non fornito." };
  }

  if (!extracted.email) {
    return { valid: false, reason: "Email non fornita." };
  }

  const appointmentDate = new Date(extracted.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  appointmentDate.setHours(0, 0, 0, 0);

  if (appointmentDate < today) {
    const daysAgo = Math.abs(Math.floor((appointmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    return { 
      valid: false, 
      reason: `La data ${extracted.date.split('-').reverse().join('/')} è nel passato (${daysAgo} giorni fa). Scegli una data futura.` 
    };
  }

  console.log(`   ✅ All validations passed`);
  return { valid: true };
}

export async function createBookingRecord(
  consultantId: string,
  conversationId: string | null,
  data: BookingData,
  source: 'whatsapp' | 'public_link',
  publicConversationId?: string | null
): Promise<typeof appointmentBookings.$inferSelect | null> {
  console.log(`\n💾 [BOOKING SERVICE] Creating booking record`);
  console.log(`   Consultant: ${consultantId}`);
  console.log(`   Source: ${source}`);
  console.log(`   Date: ${data.date}, Time: ${data.time}`);
  if (publicConversationId) {
    console.log(`   PublicConversationId: ${publicConversationId}`);
  }

  try {
    const [settings] = await db
      .select()
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
      .limit(1);

    const duration = settings?.appointmentDuration || 60;
    const timezone = settings?.timezone || "Europe/Rome";

    const [startHour, startMinute] = data.time.split(':').map(Number);
    const totalMinutes = startHour * 60 + startMinute + duration;
    const endHourRaw = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    const endHour = endHourRaw % 24;
    const formattedEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

    console.log(`   Duration: ${duration} min`);
    console.log(`   End time: ${formattedEndTime}`);

    // Normalize phone: empty string becomes null
    const normalizedPhone = data.phone && data.phone.trim() !== '' ? data.phone.trim() : null;
    
    const [booking] = await db
      .insert(appointmentBookings)
      .values({
        consultantId,
        conversationId: source === 'whatsapp' ? conversationId : null,
        publicConversationId: source === 'public_link' ? (publicConversationId || conversationId) : null,
        source: source,
        clientPhone: normalizedPhone,
        clientEmail: data.email,
        clientName: data.name || data.clientName || null,
        appointmentDate: data.date,
        appointmentTime: data.time,
        appointmentEndTime: formattedEndTime,
        status: 'confirmed',
        confirmedAt: new Date(),
      })
      .returning();

    console.log(`   ✅ Booking created with ID: ${booking.id}`);
    return booking;
  } catch (error: any) {
    console.error(`❌ [BOOKING SERVICE] Failed to create booking record: ${error.message}`);
    return null;
  }
}

export interface GoogleCalendarResult {
  googleEventId: string | null;
  googleMeetLink: string | null;
}

export async function createGoogleCalendarBooking(
  consultantId: string,
  booking: typeof appointmentBookings.$inferSelect,
  clientEmail: string
): Promise<GoogleCalendarResult> {
  console.log(`\n📅 [BOOKING SERVICE] Creating Google Calendar event`);
  console.log(`   Consultant: ${consultantId}`);
  console.log(`   Booking ID: ${booking.id}`);
  console.log(`   Client email: ${clientEmail}`);

  try {
    const [settings] = await db
      .select()
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
      .limit(1);

    const duration = settings?.appointmentDuration || 60;
    const timezone = settings?.timezone || "Europe/Rome";

    const googleEvent = await createGoogleCalendarEvent(
      consultantId,
      {
        summary: `Consulenza - ${clientEmail}`,
        description: `Telefono: ${booking.clientPhone}\nEmail: ${clientEmail}\n\nBooking ID: ${booking.id}`,
        startDate: booking.appointmentDate!,
        startTime: booking.appointmentTime!,
        duration: duration,
        timezone: timezone,
        attendees: [clientEmail],
      }
    );

    await db
      .update(appointmentBookings)
      .set({ googleEventId: googleEvent.googleEventId })
      .where(eq(appointmentBookings.id, booking.id));

    console.log(`   ✅ Google Calendar event created: ${googleEvent.googleEventId}`);
    console.log(`   🎥 Meet link: ${googleEvent.googleMeetLink || 'N/A'}`);

    return {
      googleEventId: googleEvent.googleEventId,
      googleMeetLink: googleEvent.googleMeetLink || null,
    };
  } catch (error: any) {
    console.error(`❌ [BOOKING SERVICE] Failed to create Google Calendar event: ${error.message}`);
    return {
      googleEventId: null,
      googleMeetLink: null,
    };
  }
}

export async function processFullBooking(
  consultantId: string,
  conversationId: string | null,
  data: BookingData,
  source: 'whatsapp' | 'public_link'
): Promise<BookingCreationResult> {
  console.log(`\n🚀 [BOOKING SERVICE] Processing full booking`);
  console.log(`   Source: ${source}`);

  const booking = await createBookingRecord(consultantId, conversationId, data, source);
  if (!booking) {
    return {
      success: false,
      bookingId: null,
      googleEventId: null,
      googleMeetLink: null,
      errorMessage: "Impossibile creare la prenotazione nel database.",
    };
  }

  const calendarResult = await createGoogleCalendarBooking(consultantId, booking, data.email);

  return {
    success: true,
    bookingId: booking.id,
    googleEventId: calendarResult.googleEventId,
    googleMeetLink: calendarResult.googleMeetLink,
    errorMessage: calendarResult.googleEventId ? null : "Appuntamento creato ma impossibile sincronizzare con Google Calendar.",
  };
}

export function formatAppointmentDate(
  date: string,
  time: string,
  timezone: string = "Europe/Rome"
): string {
  const appointmentDateObj = new Date(`${date}T${time}:00`);
  const dateFormatter = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone
  });
  return dateFormatter.format(appointmentDateObj);
}

export function buildConfirmationMessage(
  booking: typeof appointmentBookings.$inferSelect,
  googleMeetLink: string | null,
  duration: number = 60
): string {
  const formattedDate = formatAppointmentDate(
    booking.appointmentDate!,
    booking.appointmentTime!
  );

  return `✅ APPUNTAMENTO CONFERMATO!

📅 Data: ${formattedDate}
🕐 Orario: ${booking.appointmentTime}
⏱️ Durata: ${duration} minuti
📱 Telefono: ${booking.clientPhone}
📧 Email: ${booking.clientEmail}

📬 Ti ho inviato l'invito al calendario all'indirizzo ${booking.clientEmail}. Controlla la tua inbox!
${googleMeetLink ? `\n🎥 Link Google Meet: ${googleMeetLink}\n\n👉 Clicca sul link nell'invito o usa questo link per collegarti alla call.` : ''}

Ci vediamo online! 🚀`;
}

export interface EmailConfirmationResult {
  success: boolean;
  errorMessage: string | null;
}

export async function sendBookingConfirmationEmail(
  consultantId: string,
  booking: typeof appointmentBookings.$inferSelect,
  googleMeetLink: string | null
): Promise<EmailConfirmationResult> {
  console.log(`\n📧 [BOOKING SERVICE] Sending confirmation email`);
  console.log(`   Consultant: ${consultantId}`);
  console.log(`   Booking ID: ${booking.id}`);
  console.log(`   Client email: ${booking.clientEmail}`);

  if (!booking.clientEmail) {
    console.log(`   ❌ No client email - skipping`);
    return { success: false, errorMessage: "Nessuna email cliente disponibile" };
  }

  try {
    const [consultant] = await db
      .select()
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    const consultantName = consultant?.firstName 
      ? `${consultant.firstName}${consultant.lastName ? ' ' + consultant.lastName : ''}`
      : consultant?.email || "Il tuo consulente";

    const [settings] = await db
      .select()
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
      .limit(1);

    const duration = settings?.appointmentDuration || 60;
    const formattedDate = formatAppointmentDate(
      booking.appointmentDate!,
      booking.appointmentTime!,
      settings?.timezone || "Europe/Rome"
    );

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; }
    .details { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-label { font-weight: bold; color: #667eea; width: 120px; }
    .meet-link { background: #667eea; color: white !important; padding: 15px 30px; border-radius: 8px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>✅ Appuntamento Confermato!</h1>
  </div>
  <div class="content">
    <p>Ciao ${booking.clientName || 'Cliente'},</p>
    <p>Il tuo appuntamento con <strong>${consultantName}</strong> è stato confermato. Ecco i dettagli:</p>
    
    <div class="details">
      <div class="detail-row">
        <span class="detail-label">📅 Data:</span>
        <span>${formattedDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">🕐 Orario:</span>
        <span>${booking.appointmentTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">⏱️ Durata:</span>
        <span>${duration} minuti</span>
      </div>
      ${booking.clientPhone ? `
      <div class="detail-row">
        <span class="detail-label">📱 Telefono:</span>
        <span>${booking.clientPhone}</span>
      </div>
      ` : ''}
    </div>
    
    ${googleMeetLink ? `
    <div style="text-align: center;">
      <p>Collegati alla videochiamata usando questo link:</p>
      <a href="${googleMeetLink}" class="meet-link">🎥 Partecipa alla Call</a>
    </div>
    ` : ''}
    
    <p>Ti abbiamo anche inviato un invito al calendario. Controlla la tua inbox!</p>
    <p>A presto,<br><strong>${consultantName}</strong></p>
  </div>
  <div class="footer">
    <p>Hai ricevuto questa email perché hai prenotato un appuntamento tramite il nostro assistente.</p>
  </div>
</body>
</html>
`;

    await sendEmail({
      to: booking.clientEmail,
      subject: `✅ Appuntamento confermato - ${formattedDate} alle ${booking.appointmentTime}`,
      html: emailHtml,
      consultantId: consultantId
    });

    console.log(`   ✅ Confirmation email sent to ${booking.clientEmail}`);
    return { success: true, errorMessage: null };

  } catch (error: any) {
    console.error(`   ❌ Failed to send confirmation email: ${error.message}`);
    return { success: false, errorMessage: error.message };
  }
}
