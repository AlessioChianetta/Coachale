import { db } from "../db";
import { appointmentBookings, consultantAvailabilitySettings, users, bookingExtractionState, consultantWhatsappConfig, whatsappTemplateVersions, whatsappTemplateVariables, whatsappVariableCatalog, pendingBookings } from "../../shared/schema";
import { eq, and, or, isNull, sql, desc } from "drizzle-orm";
import { createGoogleCalendarEvent, listEvents } from "../google-calendar-service";
import { GeminiClient, getModelWithThinking } from "../ai/provider-factory";
import { sendEmail } from "../services/email-scheduler";
import twilio from "twilio";

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

// ═══════════════════════════════════════════════════════════════════════════════
// ACCUMULATOR PATTERN: Progressive booking data extraction
// Prevents field loss when re-extracting from conversation
// ═══════════════════════════════════════════════════════════════════════════════

interface AccumulatedBookingData {
  date: string | null;
  time: string | null;
  phone: string | null;
  email: string | null;
  name: string | null;
  confidence: "high" | "medium" | "low" | null;
}

async function loadExtractionState(
  conversationId: string | null,
  publicConversationId: string | null
): Promise<AccumulatedBookingData | null> {
  try {
    if (!conversationId && !publicConversationId) return null;
    
    const now = new Date();
    
    const conditions = [];
    if (conversationId) {
      conditions.push(eq(bookingExtractionState.conversationId, conversationId));
    }
    if (publicConversationId) {
      conditions.push(eq(bookingExtractionState.publicConversationId, publicConversationId));
    }
    
    const [existing] = await db
      .select()
      .from(bookingExtractionState)
      .where(and(
        or(...conditions),
        isNull(bookingExtractionState.completedAt),
        sql`${bookingExtractionState.expiresAt} > ${now.toISOString()}`
      ))
      .limit(1);
    
    if (!existing) {
      console.log(`   📦 [ACCUMULATOR] No existing state found`);
      return null;
    }
    
    console.log(`   📦 [ACCUMULATOR] Loaded existing state: date=${existing.extractedDate}, time=${existing.extractedTime}, phone=${existing.extractedPhone ? '***' : null}, email=${existing.extractedEmail}`);
    
    return {
      date: existing.extractedDate,
      time: existing.extractedTime,
      phone: existing.extractedPhone,
      email: existing.extractedEmail,
      name: existing.extractedName,
      confidence: existing.confidence as "high" | "medium" | "low" | null,
    };
  } catch (error) {
    console.error(`❌ [ACCUMULATOR] Failed to load state:`, error);
    return null;
  }
}

async function saveExtractionState(
  conversationId: string | null,
  publicConversationId: string | null,
  consultantId: string,
  data: AccumulatedBookingData
): Promise<void> {
  try {
    if (!conversationId && !publicConversationId) return;
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    const conditions = [];
    if (conversationId) {
      conditions.push(eq(bookingExtractionState.conversationId, conversationId));
    }
    if (publicConversationId) {
      conditions.push(eq(bookingExtractionState.publicConversationId, publicConversationId));
    }
    
    const [existing] = await db
      .select({ id: bookingExtractionState.id })
      .from(bookingExtractionState)
      .where(or(...conditions))
      .limit(1);
    
    if (existing) {
      await db
        .update(bookingExtractionState)
        .set({
          extractedDate: data.date,
          extractedTime: data.time,
          extractedPhone: data.phone,
          extractedEmail: data.email,
          extractedName: data.name,
          confidence: data.confidence,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(bookingExtractionState.id, existing.id));
      console.log(`   💾 [ACCUMULATOR] Updated state: date=${data.date}, time=${data.time}`);
    } else {
      await db.insert(bookingExtractionState).values({
        conversationId,
        publicConversationId,
        consultantId,
        extractedDate: data.date,
        extractedTime: data.time,
        extractedPhone: data.phone,
        extractedEmail: data.email,
        extractedName: data.name,
        confidence: data.confidence,
        expiresAt,
      });
      console.log(`   💾 [ACCUMULATOR] Created new state: date=${data.date}, time=${data.time}`);
    }
  } catch (error) {
    console.error(`❌ [ACCUMULATOR] Failed to save state:`, error);
  }
}

function mergeExtractionData(
  existing: AccumulatedBookingData | null,
  newData: BookingExtractionResult
): BookingExtractionResult {
  if (!existing) return newData;
  
  const merged: BookingExtractionResult = {
    isConfirming: newData.isConfirming,
    date: newData.date || existing.date,
    time: newData.time || existing.time,
    phone: newData.phone || existing.phone,
    email: newData.email || existing.email,
    name: newData.name || existing.name,
    confidence: newData.confidence,
    hasAllData: false, // Will be recalculated
  };
  
  // Recalculate hasAllData with merged values
  merged.hasAllData = !!(merged.date && merged.time && merged.phone && merged.email);
  
  // Log what was preserved from previous extraction
  const preserved: string[] = [];
  if (!newData.date && existing.date) preserved.push(`date=${existing.date}`);
  if (!newData.time && existing.time) preserved.push(`time=${existing.time}`);
  if (!newData.phone && existing.phone) preserved.push('phone');
  if (!newData.email && existing.email) preserved.push('email');
  if (!newData.name && existing.name) preserved.push('name');
  
  if (preserved.length > 0) {
    console.log(`   🔄 [ACCUMULATOR] Preserved from previous: ${preserved.join(', ')}`);
  }
  
  console.log(`   📊 [ACCUMULATOR] Merged result: date=${merged.date}, time=${merged.time}, hasAllData=${merged.hasAllData}`);
  
  return merged;
}

export async function markExtractionStateCompleted(
  conversationId: string | null,
  publicConversationId: string | null
): Promise<void> {
  try {
    if (!conversationId && !publicConversationId) return;
    
    const conditions = [];
    if (conversationId) {
      conditions.push(eq(bookingExtractionState.conversationId, conversationId));
    }
    if (publicConversationId) {
      conditions.push(eq(bookingExtractionState.publicConversationId, publicConversationId));
    }
    
    await db
      .update(bookingExtractionState)
      .set({ completedAt: new Date() })
      .where(or(...conditions));
    
    console.log(`   ✅ [ACCUMULATOR] Marked state as completed`);
  } catch (error) {
    console.error(`❌ [ACCUMULATOR] Failed to mark completed:`, error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════

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
  "hasAllData": true/false (true solo se hai data, ora, telefono ED email),
  "reasoning": {
    "isConfirming": "Perché il lead sta/non sta confermando un appuntamento - cita il messaggio esatto",
    "date": "Perché hai estratto/non estratto la data - cita il messaggio esatto",
    "time": "Perché hai estratto/non estratto l'orario - cita il messaggio esatto",
    "phone": "Perché hai estratto/non estratto il telefono - cita il messaggio esatto",
    "email": "Perché hai estratto/non estratto l'email - cita il messaggio esatto"
  }
}

═══════════════════════════════════════════════════════════════════════════════
🔑 REGOLA FONDAMENTALE: ESTRAZIONE DUAL-SOURCE (LEAD + AI)
═══════════════════════════════════════════════════════════════════════════════

DEVI estrarre i dati da DUE FONTI:
1. MESSAGGI DEL LEAD → per dati espliciti
2. RISPOSTE DELL'AI → per dati confermati/normalizzati quando il lead è abbreviato

Quando il lead risponde in modo breve o informale, l'AI conversazionale SEMPRE 
conferma il dato completo nella sua risposta. USA QUELLA CONFERMA per estrarre.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 DATE - Estrazione da entrambe le fonti
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD dice "domani" o "lunedì" → Guarda risposta AI che conferma data esatta

AI: Ti va domani?
LEAD: sì domani
AI: Perfetto! Domani 26 dicembre
→ Estrai date="2025-12-26" dalla risposta AI

AI: Preferisci lunedì o martedì?
LEAD: lunedì
AI: Ok! Lunedì 30 dicembre alle 15:00
→ Estrai date="2025-12-30" dalla risposta AI

LEAD: il 25
AI: Perfetto! Il 25 dicembre
→ Estrai date="2025-12-25" dalla risposta AI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕐 TIME - Estrazione da entrambe le fonti (CRITICO!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD dice solo un numero o selezione breve → Guarda risposta AI che conferma orario

AI: • 14:00 • 15:00 • 16:00. Quale preferisci?
LEAD: 15
AI: Perfetto! Giovedì 25 dicembre alle 15:00
→ Estrai time="15:00" dalla risposta AI (NON "15" dal lead!)

AI: Ti propongo: 1) 14:00  2) 15:00  3) 16:30
LEAD: la seconda
AI: Ok! Confermo alle 15:00
→ Estrai time="15:00" dalla risposta AI

AI: Ti propongo: Giovedì alle 14:00, Venerdì alle 15:00
LEAD: il primo
AI: Perfetto! Giovedì 25 alle 14:00
→ Estrai date+time dalla risposta AI

AI: Ti va alle 15:00?
LEAD: ok
AI: Perfetto! Confermato per le 15:00
→ Estrai time="15:00" dalla conferma AI

AI: • 14:00 • 15:00
LEAD: quello delle 3
AI: Perfetto! Alle 15:00
→ Estrai time="15:00" (lead intende 15:00 = "le 3 del pomeriggio")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 PHONE - Estrazione e normalizzazione
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estrai il telefono in formato pulito (solo numeri), anche se il lead lo scrive con spazi/punti

LEAD: 333 123 4567 → phone="3331234567"
LEAD: +39 333.123.4567 → phone="3331234567" (rimuovi prefisso e punti)
LEAD: il mio cell è 333-123-4567 → phone="3331234567"

Se l'AI conferma il numero, usa la versione normalizzata:
LEAD: il mio è 333 12 34 567
AI: Confermo 3331234567
→ Estrai phone="3331234567" dalla conferma AI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 CONFERMA DI DATI PROPOSTI (CRITICO per lead proattivi!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando l'AI PROPONE un dato dal contesto e il lead CONFERMA, estrai dalla proposta AI:

📞 TELEFONO - Conferma di proposta:
AI: "Il numero +39 333 1234567 va bene o preferisci un altro?"
LEAD: "sì" / "ok" / "va bene" / "quello" / "esatto"
→ Estrai phone="3331234567" dalla proposta AI (IGNORA il messaggio breve del lead)

AI: "Il numero +39 333 1234567 va bene?"
LEAD: "no, usa questo: 340 999 8888"
→ Estrai phone="3409998888" dal messaggio del lead (ignora proposta)

📧 EMAIL - Conferma di proposta:
AI: "L'email mario@example.com va bene o un'altra?"
LEAD: "sì perfetto" / "va bene quella" / "ok"
→ Estrai email="mario@example.com" dalla proposta AI (IGNORA il messaggio breve)

AI: "L'email mario@example.com va bene?"
LEAD: "no usa mario.rossi@gmail.com"
→ Estrai email="mario.rossi@gmail.com" dal messaggio del lead

⚠️ PATTERN DI RICONOSCIMENTO CONFERMA:
Parole che indicano conferma: "sì", "si", "ok", "va bene", "quello", "quella", 
"esatto", "perfetto", "giusto", "confermo", "questo", "corretto", "certo"

SE trovi queste parole DOPO una proposta AI con dato specifico (telefono o email):
→ Estrai il dato dalla proposta AI, NON cercare un nuovo dato nel messaggio lead
→ Questo è FONDAMENTALE per i lead proattivi dove i dati sono già noti

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 EMAIL - Estrazione e correzione
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estrai email anche da formati informali o scritti a parole

LEAD: mario@test.it → email="mario@test.it"
LEAD: la mia mail è mario@test.it → email="mario@test.it"
LEAD: MARIO@TEST.IT → email="mario@test.it" (lowercase)
LEAD: mario chiocciola gmail punto com → email="mario@gmail.com"
LEAD: mario at test dot it → email="mario@test.it"

Se l'AI conferma/corregge, usa quella versione:
LEAD: mario chiocciola test punto it
AI: Ok, registrato mario@test.it
→ Estrai email="mario@test.it" dalla conferma AI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 NAME - Estrazione
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: mi chiamo Mario → name="Mario"
LEAD: sono Marco Rossi → name="Marco Rossi"
LEAD: Mario → (se l'AI aveva chiesto il nome) name="Mario"

Se l'AI usa il nome in risposta:
LEAD: mi chiamo Luca
AI: Piacere Luca!
→ Estrai name="Luca"

═══════════════════════════════════════════════════════════════════════════════

ESEMPI COMPLETI DI CONVERSAZIONI:

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 2 - SELEZIONE ABBREVIATA (CASO CRITICO):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI: Ho questi slot: • 14:00 • 15:00
LEAD: 15
AI: Perfetto! Giovedì 25 dicembre alle 15:00. Mi dai il tuo telefono?
LEAD: 3890566422
AI: E la tua email?
LEAD: test@gmail.com

→ {"isConfirming": true, "date": "2025-12-25", "time": "15:00", "phone": "3890566422", "email": "test@gmail.com", "name": null, "confidence": "high", "hasAllData": true}

⚠️ NOTA: Il lead ha detto solo "15" ma l'AI ha confermato "alle 15:00" → estrai time="15:00"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 3 - CONFERMA IMPLICITA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI: Ti propongo domani alle 15:00, va bene?
LEAD: ok
AI: Perfetto! Domani 26 dicembre alle 15:00

→ {"isConfirming": true, "date": "2025-12-26", "time": "15:00", "phone": null, "email": null, "name": null, "confidence": "medium", "hasAllData": false}

⚠️ NOTA: "ok" conferma la proposta AI → estrai data e ora dalla risposta AI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 4 - SELEZIONE ORDINALE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI: Ti propongo: 1) Giovedì alle 14:00  2) Venerdì alle 15:00
LEAD: la seconda
AI: Perfetto! Venerdì 27 dicembre alle 15:00

→ {"isConfirming": true, "date": "2025-12-27", "time": "15:00", "phone": null, "email": null, "name": null, "confidence": "medium", "hasAllData": false}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 5 - Dati parziali (MANCA EMAIL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI: Quale orario preferisci?
LEAD: Martedì alle 15:30
AI: Perfetto! Mi confermi il tuo telefono?
LEAD: 3331234567

→ {"isConfirming": true, "date": "2025-11-05", "time": "15:30", "phone": "3331234567", "email": null, "name": null, "confidence": "medium", "hasAllData": false}

⚠️ NOTA: hasAllData = FALSE perché manca l'email

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esempio 6 - Tutto in un messaggio:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: Ok martedì alle 15:30, il mio numero è 3331234567 e la mail mario@test.it

→ {"isConfirming": true, "date": "2025-11-05", "time": "15:30", "phone": "3331234567", "email": "mario@test.it", "name": null, "confidence": "high", "hasAllData": true}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 REGOLE CRITICHE DI ESTRAZIONE:
1. Cerca i dati in TUTTA la conversazione, NON solo l'ultimo messaggio
2. SEMPRE guarda le risposte AI per dati confermati quando il lead è abbreviato
3. hasAllData = true SOLO se hai TUTTI E 4 i campi: date, time, phone, email
4. Se anche 1 solo campo è null → hasAllData = FALSE
5. Non importa se i dati sono sparsi su messaggi diversi - estraili tutti
6. Estrai il nome se menzionato dal lead (es: "Mi chiamo Mario", "Sono Marco Rossi")
7. Per TIME: se lead dice solo "15" o "la prima", DEVI guardare la risposta AI che conferma l'orario completo

🗓️ DATA CORRENTE: ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}

⚠️ ATTENZIONE ALLE DATE:
- Se vedi date passate (es: maggio 2024), sono nel PASSATO
- Estrai solo date FUTURE a partire da oggi
- Se il lead ha confermato una data passata, impostala comunque ma il sistema la rifiuterà

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
Esempio 4b - CANCELLAZIONE (SOLO 1 conferma - AI sta ancora chiedendo):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAD: voglio cancellare
AI: [persuasione] Confermi che vuoi cancellare?
LEAD: sì
AI: Ok, capisco. Solo per essere sicuri: confermi che vuoi procedere con la cancellazione?

→ {"intent": "CANCEL", "newDate": null, "newTime": null, "attendees": [], "confirmedTimes": 1, "confidence": "high"}

⚠️ ATTENZIONE: L'ultimo messaggio è dell'AI che CHIEDE la seconda conferma!
Il lead NON ha ancora risposto, quindi confirmedTimes = 1 (solo la prima conferma è stata data).
La seconda conferma arriverà SOLO quando il lead risponderà "sì" a questa domanda.

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
Esempio 9 - RESET CONVERSAZIONE (ricominciamo):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando il lead dice "ricominciamo", "iniziamo da capo", "proviamo di nuovo" o simili,
tutti i messaggi PRECEDENTI a questo punto NON sono più rilevanti per l'intent detection.
Considera solo i messaggi DOPO il reset.

LEAD: Ok alle 10:00
AI: Perfetto! Confermo per le 10:00?
LEAD: Ricominciamo
AI: Certo! Ricominciamo da capo. Cosa ti ha spinto a scriverci?
LEAD: Volevo capire cosa fate

→ {"intent": "NONE", "newDate": null, "newTime": null, "attendees": [], "confirmedTimes": 0, "confidence": "high"}

⚠️ NOTA: Anche se ci sono date/orari nei messaggi PRIMA del "ricominciamo", 
NON sono rilevanti. Il lead ha resettato la conversazione.

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
19. RESET: Se il lead dice "ricominciamo", "iniziamo da capo", "proviamo di nuovo", i messaggi PRECEDENTI sono irrilevanti - intent="NONE"
20. 🚨 REGOLA CRITICA: Se l'ULTIMO messaggio della conversazione è dell'AI che CHIEDE conferma (es: "confermi?", "sei sicuro?", "procediamo?"), allora quella conferma NON è stata ancora data! Devi contare SOLO le risposte effettive del LEAD, non le domande dell'AI.
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
    
    // Sanitize only the specific invalid escape sequence that AI sometimes generates
    // \' is not valid in JSON (should be just ' or for quotes use \")
    // Note: We only fix \' to avoid corrupting valid escapes like \n, \t, etc.
    cleanText = cleanText.replace(/\\'/g, "'");
    
    return JSON.parse(cleanText) as T;
  } catch (error) {
    console.error('❌ [BOOKING SERVICE] Failed to parse JSON response:', error);
    console.error('   Response text:', responseText.substring(0, 500));
    return null;
  }
}

export interface ExtractionAccumulatorOptions {
  conversationId?: string | null;
  publicConversationId?: string | null;
  consultantId?: string;
}

export async function extractBookingDataFromConversation(
  messages: ConversationMessage[],
  existingBooking: ExistingBooking | null,
  aiClient: GeminiClient,
  timezone: string = "Europe/Rome",
  providerName?: string,
  accumulatorOptions?: ExtractionAccumulatorOptions
): Promise<BookingExtractionResult | BookingModificationResult | null> {
  const conversationContext = buildConversationContext(messages);
  
  const prompt = existingBooking
    ? buildModificationExtractionPrompt(conversationContext, existingBooking)
    : buildNewBookingExtractionPrompt(conversationContext);

  console.log(`\n🔍 [BOOKING SERVICE] Extracting data from ${messages.length} messages`);
  console.log(`   Mode: ${existingBooking ? 'MODIFICATION' : 'NEW BOOKING'}`);
  console.log(`   Timezone: ${timezone}`);
  console.log(`   📜 [FULL CONVERSATION] Messaggi passati all'AI per estrazione:`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(conversationContext);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // ACCUMULATOR: Load existing state for new bookings (not modifications)
  // ═══════════════════════════════════════════════════════════════════════════════
  let existingState: AccumulatedBookingData | null = null;
  if (!existingBooking && accumulatorOptions) {
    console.log(`   📦 [ACCUMULATOR] Loading existing extraction state...`);
    existingState = await loadExtractionState(
      accumulatorOptions.conversationId || null,
      accumulatorOptions.publicConversationId || null
    );
  }

  // Use gemini-2.5-flash-lite for booking extraction - fast and efficient
  const model = 'gemini-2.5-flash-lite';
  const useThinking = false;
  console.log(`   🧠 [AI] Using model: ${model}, thinking: disabled`);

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
    console.log(`   AI Response preview: ${responseText.substring(0, 300)}`);

    if (existingBooking) {
      const result = parseJsonResponse<BookingModificationResult>(responseText);
      if (result) {
        console.log(`   Parsed modification result: intent=${result.intent}, confirmedTimes=${result.confirmedTimes}`);
        return result;
      }
    } else {
      const rawResult = parseJsonResponse<BookingExtractionResult & { reasoning?: { isConfirming?: string; date?: string; time?: string; phone?: string; email?: string } }>(responseText);
      if (rawResult) {
        console.log(`   Parsed extraction result (raw): hasAllData=${rawResult.hasAllData}, date=${rawResult.date}, time=${rawResult.time}`);
        
        // Log del ragionamento AI per ogni campo
        if (rawResult.reasoning) {
          console.log(`\n🧠 [AI REASONING] Spiegazione decisioni AI:`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`   🎯 CONFIRMING: ${rawResult.reasoning.isConfirming || 'Nessuna spiegazione'}`);
          console.log(`   📅 DATE:  ${rawResult.reasoning.date || 'Nessuna spiegazione'}`);
          console.log(`   🕐 TIME:  ${rawResult.reasoning.time || 'Nessuna spiegazione'}`);
          console.log(`   📞 PHONE: ${rawResult.reasoning.phone || 'Nessuna spiegazione'}`);
          console.log(`   📧 EMAIL: ${rawResult.reasoning.email || 'Nessuna spiegazione'}`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        }
        
        // ═══════════════════════════════════════════════════════════════════════════════
        // ACCUMULATOR: Merge with existing state and save
        // ═══════════════════════════════════════════════════════════════════════════════
        const mergedResult = mergeExtractionData(existingState, rawResult);
        
        // Save merged state if we have accumulator options
        if (accumulatorOptions?.consultantId) {
          await saveExtractionState(
            accumulatorOptions.conversationId || null,
            accumulatorOptions.publicConversationId || null,
            accumulatorOptions.consultantId,
            {
              date: mergedResult.date,
              time: mergedResult.time,
              phone: mergedResult.phone,
              email: mergedResult.email,
              name: mergedResult.name,
              confidence: mergedResult.confidence,
            }
          );
        }
        
        return mergedResult;
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
  source: 'whatsapp' | 'public_link' | 'instagram' = 'whatsapp'
): Promise<ValidationResult> {
  console.log(`\n🔍 [BOOKING SERVICE] Validating booking data for consultant ${consultantId} (source: ${source})`);

  // Tutti i canali (WhatsApp, Instagram, public_link) richiedono gli stessi dati
  if (!extracted.hasAllData) {
    return { valid: false, reason: "Dati incompleti. Mancano informazioni obbligatorie." };
  }

  if (!extracted.date || !extracted.time) {
    return { valid: false, reason: "Data e/o ora non specificati." };
  }

  // Phone is required for all sources (WhatsApp, Instagram, public_link)
  if (!extracted.phone) {
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
  source: 'whatsapp' | 'public_link' | 'instagram',
  publicConversationId?: string | null,
  instagramData?: { instagramUserId?: string | null; instagramConversationId?: string | null; agentConfigId?: string | null }
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
    
    // Build values object based on source
    const bookingValues: any = {
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
    };
    
    // Add Instagram-specific fields
    if (source === 'instagram' && instagramData) {
      bookingValues.instagramUserId = instagramData.instagramUserId || null;
      bookingValues.instagramConversationId = instagramData.instagramConversationId || null;
      bookingValues.agentConfigId = instagramData.agentConfigId || null;
      console.log(`   Instagram User ID: ${instagramData.instagramUserId || 'N/A'}`);
      console.log(`   Instagram Conversation ID: ${instagramData.instagramConversationId || 'N/A'}`);
    }
    
    const [booking] = await db
      .insert(appointmentBookings)
      .values(bookingValues)
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
  clientEmail: string,
  agentConfigId?: string  // NEW: Optional agent ID to use agent's calendar
): Promise<GoogleCalendarResult> {
  console.log(`\n📅 [BOOKING SERVICE] Creating Google Calendar event`);
  console.log(`   Consultant: ${consultantId}`);
  if (agentConfigId) {
    console.log(`   Agent Config ID: ${agentConfigId}`);
  }
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

    // NEW: Pass agentConfigId to use agent's calendar if available
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
      },
      agentConfigId
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
  source: 'whatsapp' | 'public_link',
  agentConfigId?: string  // NEW: Optional agent ID to use agent's calendar
): Promise<BookingCreationResult> {
  console.log(`\n🚀 [BOOKING SERVICE] Processing full booking`);
  console.log(`   Source: ${source}`);
  if (agentConfigId) {
    console.log(`   Agent Config ID: ${agentConfigId}`);
  }

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

  // NEW: Pass agentConfigId to use agent's calendar if available
  const calendarResult = await createGoogleCalendarBooking(consultantId, booking, data.email, agentConfigId);

  // Send booking notification to configured WhatsApp number (if enabled)
  if (agentConfigId) {
    const formattedDate = formatAppointmentDate(data.date, data.time);
    await sendBookingNotification(agentConfigId, {
      clientName: data.name || data.clientName || data.email,
      date: formattedDate,
      time: data.time,
      meetLink: calendarResult.googleMeetLink,
    });
  }

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

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKING NOTIFICATION - Send WhatsApp message when appointment is booked
// ═══════════════════════════════════════════════════════════════════════════════

export interface BookingNotificationData {
  clientName: string;
  date: string;
  time: string;
  meetLink: string | null;
}

export async function sendBookingNotification(
  agentConfigId: string,
  bookingData: BookingNotificationData
): Promise<{ success: boolean; error?: string }> {
  console.log(`\n📱 [BOOKING NOTIFICATION] Sending booking notification`);
  console.log(`   Agent Config ID: ${agentConfigId}`);
  
  try {
    // 1. Fetch agent config with notification settings and Twilio credentials
    const [agentConfig] = await db
      .select({
        notificationEnabled: consultantWhatsappConfig.bookingNotificationEnabled,
        notificationPhone: consultantWhatsappConfig.bookingNotificationPhone,
        notificationTemplateId: consultantWhatsappConfig.bookingNotificationTemplateId,
        twilioWhatsappNumber: consultantWhatsappConfig.twilioWhatsappNumber,
        twilioAccountSid: consultantWhatsappConfig.twilioAccountSid,
        twilioAuthToken: consultantWhatsappConfig.twilioAuthToken,
        consultantId: consultantWhatsappConfig.consultantId,
      })
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, agentConfigId))
      .limit(1);
    
    if (!agentConfig) {
      console.log(`   ⚠️ Agent config not found`);
      return { success: false, error: "Agent config not found" };
    }
    
    if (!agentConfig.notificationEnabled) {
      console.log(`   ⏭️ Notifications disabled for this agent`);
      return { success: true }; // Not an error, just disabled
    }
    
    if (!agentConfig.notificationPhone) {
      console.log(`   ⚠️ No notification phone configured`);
      return { success: false, error: "No notification phone configured" };
    }
    
    if (!agentConfig.notificationTemplateId) {
      console.log(`   ⚠️ No notification template configured`);
      return { success: false, error: "No notification template configured" };
    }
    
    // 2. Fetch active template version with twilioContentSid
    const [templateVersion] = await db
      .select({
        twilioContentSid: whatsappTemplateVersions.twilioContentSid,
        bodyText: whatsappTemplateVersions.bodyText,
        id: whatsappTemplateVersions.id,
      })
      .from(whatsappTemplateVersions)
      .where(and(
        eq(whatsappTemplateVersions.templateId, agentConfig.notificationTemplateId),
        eq(whatsappTemplateVersions.isActive, true),
        eq(whatsappTemplateVersions.twilioStatus, 'approved')
      ))
      .orderBy(desc(whatsappTemplateVersions.versionNumber))
      .limit(1);
    
    if (!templateVersion) {
      console.log(`   ⚠️ No approved active template version found`);
      return { success: false, error: "No approved template found" };
    }
    
    if (!templateVersion.twilioContentSid) {
      console.log(`   ⚠️ Template not synced to Twilio (missing ContentSid)`);
      return { success: false, error: "Template not synced to Twilio" };
    }
    
    // 3. Fetch template variables with their catalog mappings
    const templateVariables = await db
      .select({
        position: whatsappTemplateVariables.position,
        variableKey: whatsappVariableCatalog.variableKey,
      })
      .from(whatsappTemplateVariables)
      .innerJoin(whatsappVariableCatalog, eq(whatsappTemplateVariables.variableCatalogId, whatsappVariableCatalog.id))
      .where(eq(whatsappTemplateVariables.templateVersionId, templateVersion.id))
      .orderBy(whatsappTemplateVariables.position);
    
    // 4. Build content variables based on catalog keys
    const contentVariables: Record<string, string> = {};
    
    for (const variable of templateVariables) {
      let value = "";
      
      switch (variable.variableKey) {
        case "booking_client_name":
          value = bookingData.clientName || "Cliente";
          break;
        case "booking_date":
          value = bookingData.date || "";
          break;
        case "booking_time":
          value = bookingData.time || "";
          break;
        case "booking_meet_link":
          value = bookingData.meetLink || "Link non disponibile";
          break;
        default:
          value = `{${variable.variableKey}}`;
      }
      
      contentVariables[String(variable.position)] = value;
    }
    
    console.log(`   📝 Content variables:`, contentVariables);
    
    // 5. Validate Twilio credentials from agent config
    if (!agentConfig.twilioAccountSid || !agentConfig.twilioAuthToken) {
      console.log(`   ⚠️ Twilio not configured for agent`);
      return { success: false, error: "Twilio not configured" };
    }
    
    if (!agentConfig.twilioWhatsappNumber) {
      console.log(`   ⚠️ No WhatsApp number configured for agent`);
      return { success: false, error: "No WhatsApp number for agent" };
    }
    
    // 6. Send WhatsApp message via Twilio
    const client = twilio(agentConfig.twilioAccountSid, agentConfig.twilioAuthToken);
    
    const toNumber = agentConfig.notificationPhone.startsWith("whatsapp:") 
      ? agentConfig.notificationPhone 
      : `whatsapp:${agentConfig.notificationPhone}`;
    
    const fromNumber = agentConfig.twilioWhatsappNumber.startsWith("whatsapp:")
      ? agentConfig.twilioWhatsappNumber
      : `whatsapp:${agentConfig.twilioWhatsappNumber}`;
    
    console.log(`   📤 Sending to: ${toNumber}`);
    console.log(`   📤 From: ${fromNumber}`);
    console.log(`   📤 ContentSid: ${templateVersion.twilioContentSid}`);
    
    const message = await client.messages.create({
      contentSid: templateVersion.twilioContentSid,
      contentVariables: JSON.stringify(contentVariables),
      from: fromNumber,
      to: toNumber,
    });
    
    console.log(`   ✅ Booking notification sent! SID: ${message.sid}`);
    return { success: true };
    
  } catch (error: any) {
    console.error(`   ❌ Failed to send booking notification: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC BOOKING PAGE FUNCTIONS
// Functions shared between AI booking and public Calendly-style booking page
// ═══════════════════════════════════════════════════════════════════════════════

type TimeSlot = { start: string; end: string };
type DayAvailability = { enabled: boolean; slots: TimeSlot[] };

export interface PublicAvailableSlot {
  date: string;
  dayOfWeek: string;
  time: string;
  dateFormatted: string;
  duration: number;
}

export interface PublicBookingParams {
  consultantId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  scheduledAt: Date;
  duration: number;
  notes?: string;
}

export interface PublicBookingResult {
  success: boolean;
  bookingId?: string;
  googleMeetLink?: string;
  error?: string;
}

export async function getConsultantBySlug(slug: string) {
  const [settings] = await db
    .select({
      consultantId: consultantAvailabilitySettings.consultantId,
      bookingSlug: consultantAvailabilitySettings.bookingSlug,
      bookingPageEnabled: consultantAvailabilitySettings.bookingPageEnabled,
      bookingPageTitle: consultantAvailabilitySettings.bookingPageTitle,
      bookingPageDescription: consultantAvailabilitySettings.bookingPageDescription,
      appointmentDuration: consultantAvailabilitySettings.appointmentDuration,
      appointmentAvailability: consultantAvailabilitySettings.appointmentAvailability,
      bufferBefore: consultantAvailabilitySettings.bufferBefore,
      bufferAfter: consultantAvailabilitySettings.bufferAfter,
      minHoursNotice: consultantAvailabilitySettings.minHoursNotice,
      maxDaysAhead: consultantAvailabilitySettings.maxDaysAhead,
      timezone: consultantAvailabilitySettings.timezone,
      googleRefreshToken: consultantAvailabilitySettings.googleRefreshToken,
    })
    .from(consultantAvailabilitySettings)
    .where(eq(consultantAvailabilitySettings.bookingSlug, slug))
    .limit(1);

  if (!settings) return null;

  const [consultant] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, avatar: users.avatar })
    .from(users)
    .where(eq(users.id, settings.consultantId))
    .limit(1);

  return {
    ...settings,
    consultantName: consultant ? `${consultant.firstName} ${consultant.lastName}` : 'Consulente',
    consultantAvatar: consultant?.avatar,
  };
}

export async function getPublicAvailableSlots(
  consultantId: string,
  startDate?: Date,
  endDate?: Date,
  limit = 500
): Promise<PublicAvailableSlot[]> {
  const [settings] = await db
    .select()
    .from(consultantAvailabilitySettings)
    .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
    .limit(1);

  if (!settings) {
    console.log(`[PUBLIC BOOKING] No settings found for consultant ${consultantId}`);
    return [];
  }

  const now = new Date();
  const appointmentDuration = settings.appointmentDuration || 60;
  const bufferBefore = settings.bufferBefore || 15;
  const bufferAfter = settings.bufferAfter || 15;
  const minHoursNotice = settings.minHoursNotice || 24;
  const maxDaysAhead = settings.maxDaysAhead || 30;
  
  const availabilityConfig: Record<string, DayAvailability> = {};
  
  if (settings.appointmentAvailability && typeof settings.appointmentAvailability === 'object') {
    const rawConfig = settings.appointmentAvailability as Record<string, any>;
    for (const [dayId, config] of Object.entries(rawConfig)) {
      if (config && typeof config === 'object' && 'enabled' in config) {
        if ('slots' in config && Array.isArray(config.slots)) {
          // New format with slots array
          availabilityConfig[dayId] = config as DayAvailability;
        } else if ('start' in config && 'end' in config) {
          // Legacy format with single start/end
          availabilityConfig[dayId] = {
            enabled: config.enabled,
            slots: [{ start: config.start, end: config.end }]
          };
        } else if (config.enabled) {
          // Only enabled flag without slots - use default slots
          availabilityConfig[dayId] = {
            enabled: true,
            slots: [
              { start: "09:00", end: "13:00" },
              { start: "15:00", end: "18:00" }
            ]
          };
        } else {
          // Disabled day
          availabilityConfig[dayId] = {
            enabled: false,
            slots: [{ start: "09:00", end: "18:00" }]
          };
        }
      }
    }
  }
  
  if (Object.keys(availabilityConfig).length === 0) {
    for (let d = 1; d <= 5; d++) {
      availabilityConfig[d.toString()] = { 
        enabled: true, 
        slots: [
          { start: "09:00", end: "13:00" },
          { start: "15:00", end: "18:00" }
        ]
      };
    }
    availabilityConfig["0"] = { enabled: false, slots: [{ start: "09:00", end: "18:00" }] };
    availabilityConfig["6"] = { enabled: false, slots: [{ start: "09:00", end: "18:00" }] };
  }

  const minStartTime = new Date(now.getTime() + minHoursNotice * 60 * 60 * 1000);
  const effectiveStartDate = startDate && startDate > minStartTime ? startDate : minStartTime;
  const maxEndDate = new Date(now.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000);
  const effectiveEndDate = endDate && endDate < maxEndDate ? endDate : maxEndDate;

  const existingBookings = await db
    .select({
      appointmentDate: appointmentBookings.appointmentDate,
      appointmentTime: appointmentBookings.appointmentTime,
    })
    .from(appointmentBookings)
    .where(
      and(
        eq(appointmentBookings.consultantId, consultantId),
        or(
          eq(appointmentBookings.status, "confirmed"),
          eq(appointmentBookings.status, "pending")
        )
      )
    );

  const busyRanges: Array<{ start: Date; end: Date }> = existingBookings.map(b => {
    const [hour, min] = b.appointmentTime.split(':').map(Number);
    const start = new Date(b.appointmentDate);
    start.setHours(hour, min, 0, 0);
    const end = new Date(start.getTime() + appointmentDuration * 60 * 1000);
    return { start, end };
  });

  // Integrate Google Calendar events as busy times
  try {
    const calendarEvents = await listEvents(consultantId, effectiveStartDate, effectiveEndDate);
    console.log(`[PUBLIC BOOKING] Loaded ${calendarEvents.length} events from Google Calendar for busy times`);
    
    for (const event of calendarEvents) {
      busyRanges.push({
        start: event.start,
        end: event.end
      });
    }
  } catch (error) {
    console.log(`[PUBLIC BOOKING] Could not load Google Calendar events:`, error);
    // Continue without calendar events - still show slots based on DB bookings
  }

  const isSlotBusy = (slotStart: Date, slotEnd: Date): boolean => {
    for (const busy of busyRanges) {
      if (slotStart < busy.end && slotEnd > busy.start) {
        return true;
      }
    }
    return false;
  };

  const dayNames = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const availableSlots: PublicAvailableSlot[] = [];

  const current = new Date(effectiveStartDate);
  current.setHours(0, 0, 0, 0);

  while (current <= effectiveEndDate && availableSlots.length < limit) {
    const dayOfWeek = current.getDay();
    const dayName = dayNames[dayOfWeek];
    const dayConfig = availabilityConfig[dayOfWeek.toString()];

    if (dayConfig?.enabled) {
      for (const timeSlot of dayConfig.slots) {
        const [startHour, startMin] = (timeSlot.start || "09:00").split(':').map(Number);
        const [endHour, endMin] = (timeSlot.end || "18:00").split(':').map(Number);
        
        let slotStartHour = startHour;
        let slotStartMin = startMin;

        while (slotStartHour < endHour || (slotStartHour === endHour && slotStartMin < endMin)) {
          const slotStart = new Date(current);
          slotStart.setHours(slotStartHour, slotStartMin, 0, 0);
          
          const slotEnd = new Date(slotStart.getTime() + appointmentDuration * 60 * 1000);
          
          const slotEndHour = slotEnd.getHours();
          const slotEndMin = slotEnd.getMinutes();
          if (slotEndHour > endHour || (slotEndHour === endHour && slotEndMin > endMin)) {
            break;
          }
          
          if (slotStart > minStartTime) {
            const bufferedStart = new Date(slotStart.getTime() - bufferBefore * 60 * 1000);
            const bufferedEnd = new Date(slotEnd.getTime() + bufferAfter * 60 * 1000);
            
            if (!isSlotBusy(bufferedStart, bufferedEnd)) {
              availableSlots.push({
                date: slotStart.toISOString().slice(0, 10),
                dayOfWeek: dayName,
                time: `${slotStartHour.toString().padStart(2, '0')}:${slotStartMin.toString().padStart(2, '0')}`,
                dateFormatted: slotStart.toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                }),
                duration: appointmentDuration
              });

              if (availableSlots.length >= limit) break;
            }
          }
          
          const slotIncrement = appointmentDuration <= 30 ? 30 : 60;
          slotStartMin += slotIncrement;
          if (slotStartMin >= 60) {
            slotStartHour += Math.floor(slotStartMin / 60);
            slotStartMin = slotStartMin % 60;
          }
        }
        
        if (availableSlots.length >= limit) break;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return availableSlots;
}

export async function createPublicBooking(params: PublicBookingParams): Promise<PublicBookingResult> {
  const { consultantId, clientName, clientEmail, clientPhone, scheduledAt, duration, notes } = params;

  try {
    // Check if email matches an existing client of this consultant
    let matchedClientId: string | null = null;
    if (clientEmail) {
      const [existingClient] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(
          and(
            eq(users.email, clientEmail.toLowerCase().trim()),
            eq(users.consultantId, consultantId),
            eq(users.role, 'client')
          )
        )
        .limit(1);
      
      if (existingClient) {
        matchedClientId = existingClient.id;
        console.log(`[PUBLIC BOOKING] Matched existing client: ${existingClient.firstName} ${existingClient.lastName} (${matchedClientId})`);
      } else {
        console.log(`[PUBLIC BOOKING] No existing client found for email ${clientEmail} - booking as prospect`);
      }
    }

    const [booking] = await db
      .insert(appointmentBookings)
      .values({
        consultantId,
        clientId: matchedClientId, // Link to existing client if found
        clientName,
        clientEmail,
        clientPhone: clientPhone || null,
        appointmentDate: scheduledAt.toISOString().slice(0, 10),
        appointmentTime: `${scheduledAt.getHours().toString().padStart(2, '0')}:${scheduledAt.getMinutes().toString().padStart(2, '0')}`,
        status: 'confirmed',
        notes: matchedClientId 
          ? notes || `Prenotazione dalla pagina pubblica (cliente esistente)`
          : notes || `Prenotazione dalla pagina pubblica (prospect)`,
        source: 'public_page',
      })
      .returning({ id: appointmentBookings.id });

    let googleMeetLink: string | undefined;

    const [settings] = await db
      .select({ googleRefreshToken: consultantAvailabilitySettings.googleRefreshToken })
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
      .limit(1);

    if (settings?.googleRefreshToken) {
      try {
        // Get timezone from settings
        const [availSettings] = await db
          .select({ timezone: consultantAvailabilitySettings.timezone })
          .from(consultantAvailabilitySettings)
          .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
          .limit(1);
        
        const timezone = availSettings?.timezone || 'Europe/Rome';
        const startDate = scheduledAt.toISOString().slice(0, 10); // YYYY-MM-DD
        const startTime = `${scheduledAt.getHours().toString().padStart(2, '0')}:${scheduledAt.getMinutes().toString().padStart(2, '0')}`; // HH:MM
        
        const calendarResult = await createGoogleCalendarEvent(consultantId, {
          summary: `Consulenza con ${clientName}`,
          description: `Email: ${clientEmail}${clientPhone ? `\nTelefono: ${clientPhone}` : ''}${notes ? `\n\nNote: ${notes}` : ''}`,
          startDate,
          startTime,
          duration,
          timezone,
          attendees: [clientEmail],
        });

        if (calendarResult?.eventId) {
          googleMeetLink = calendarResult.meetLink;
          await db
            .update(appointmentBookings)
            .set({
              googleEventId: calendarResult.eventId,
              googleMeetLink: calendarResult.meetLink,
            })
            .where(eq(appointmentBookings.id, booking.id));
        }
      } catch (calendarError) {
        console.log(`[PUBLIC BOOKING] Calendar event creation failed but booking saved: ${calendarError}`);
      }
    }

    return {
      success: true,
      bookingId: booking.id,
      googleMeetLink,
    };
  } catch (error: any) {
    console.error(`[PUBLIC BOOKING] Failed to create booking: ${error.message}`);
    return {
      success: false,
      error: error.message || 'Errore durante la prenotazione',
    };
  }
}

export async function generateBookingSlug(firstName: string, lastName: string, consultantId: string): Promise<string> {
  const baseSlug = `${firstName}-${lastName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const [existing] = await db
      .select({ id: consultantAvailabilitySettings.id })
      .from(consultantAvailabilitySettings)
      .where(
        and(
          eq(consultantAvailabilitySettings.bookingSlug, slug),
          sql`${consultantAvailabilitySettings.consultantId} != ${consultantId}`
        )
      )
      .limit(1);

    if (!existing) {
      break;
    }
    
    counter++;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
}

/**
 * Get pending booking state for a conversation.
 * Used by AI service to determine if there's an active booking flow.
 */
export async function getPendingBookingState(
  conversationId: string | null,
  publicConversationId: string | null
): Promise<{ token: string; startAt: Date; consultantId: string; clientId: string } | null> {
  if (!conversationId && !publicConversationId) return null;

  const now = new Date();
  const conditions = [];
  
  if (conversationId) {
    conditions.push(eq(pendingBookings.conversationId, conversationId));
  }
  if (publicConversationId) {
    conditions.push(eq(pendingBookings.publicConversationId, publicConversationId));
  }

  const [row] = await db
    .select({
      token: pendingBookings.token,
      startAt: pendingBookings.startAt,
      consultantId: pendingBookings.consultantId,
      clientId: pendingBookings.clientId
    })
    .from(pendingBookings)
    .where(
      and(
        or(...conditions),
        eq(pendingBookings.status, "awaiting_confirm"),
        sql`${pendingBookings.expiresAt} > ${now.toISOString()}`
      )
    )
    .orderBy(desc(pendingBookings.createdAt))
    .limit(1);

  return row ? {
    token: row.token,
    startAt: row.startAt,
    consultantId: row.consultantId,
    clientId: row.clientId
  } : null;
}
