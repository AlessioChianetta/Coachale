import { db } from "../db";
import { voiceCalls, appointmentBookings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { executeConsultationTool } from "../ai/consultation-tool-executor";
import { createBookingRecord, createGoogleCalendarBooking, processFullBooking } from "../booking/booking-service";
import { getAIProvider, GeminiClient } from "../ai/provider-factory";
import { tokenTracker } from "../ai/token-tracker";

export interface ConversationMessage {
  role: 'user' | 'assistant';
  transcript: string;
  timestamp: string;
}

export interface AvailableSlot {
  date: string;
  dayOfWeek: string;
  time: string;
  dateFormatted: string;
  duration: number;
}

export interface VoiceBookingSupervisorState {
  stage: 'nessun_intento' | 'raccolta_dati' | 'dati_completi' | 'confermato' | 'completato' | 'errore';
  bookingInProgress: boolean;
  emailConfirmed: boolean;
  emailSource: 'pre_populated' | 'speech_extracted' | 'user_corrected';
  extractedData: {
    date: string | null;
    time: string | null;
    confirmed: boolean;
    phone: string | null;
    email: string | null;
    name: string | null;
    duration: number;
    notes: string | null;
  };
  lastProposedSlot: {
    date: string;
    time: string;
    proposedAtTurn: number;
  } | null;
  metadata: {
    turnsInCurrentState: number;
    totalTurns: number;
    lastAnalyzedMessageIndex: number;
    bookingAttempts: number;
    createdBookingId: string | null;
    createdBookingType: 'consultation' | 'appointment' | null;
    googleMeetLink: string | null;
    errorMessage: string | null;
  };
}

export interface SupervisorResult {
  action: 'none' | 'booking_created' | 'booking_failed' | 'notify_ai';
  bookingId?: string;
  bookingType?: 'consultation' | 'appointment';
  googleMeetLink?: string;
  errorMessage?: string;
  notifyMessage?: string;
}

export interface LLMAnalysisResult {
  newStage: 'nessun_intento' | 'raccolta_dati' | 'dati_completi' | 'confermato';
  date: string | null;
  time: string | null;
  confirmed: boolean;
  phone: string | null;
  email: string | null;
  name: string | null;
  correction: boolean;
  emailConfirmed: boolean;
  aiProposedSlot: { date: string; time: string } | null;
  reasoning: string;
}

export class VoiceBookingSupervisor {
  private state: VoiceBookingSupervisorState;
  private consultantId: string;
  private clientId: string | null;
  private voiceCallId: string;
  private outboundTargetPhone: string | null;
  private availableSlots: AvailableSlot[];
  private slotsLoaded: boolean = false;
  private static readonly MODEL = "gemini-3.1-flash-lite-preview";
  private static readonly TIMEOUT_MS = 12000;
  private static readonly MAX_RECENT_MESSAGES = 12;

  constructor(params: {
    consultantId: string;
    clientId: string | null;
    voiceCallId: string;
    outboundTargetPhone: string | null;
    availableSlots: AvailableSlot[];
    prePopulatedData?: {
      phone: string | null;
      email: string | null;
      name: string | null;
    };
  }) {
    this.consultantId = params.consultantId;
    this.clientId = params.clientId;
    this.voiceCallId = params.voiceCallId;
    this.outboundTargetPhone = params.outboundTargetPhone;
    this.availableSlots = params.availableSlots;
    this.slotsLoaded = params.availableSlots.length > 0;

    const prePopulatedEmail = params.prePopulatedData?.email || null;
    this.state = {
      stage: 'nessun_intento',
      bookingInProgress: false,
      emailConfirmed: false,
      emailSource: prePopulatedEmail ? 'pre_populated' : 'speech_extracted',
      extractedData: {
        date: null,
        time: null,
        confirmed: false,
        phone: params.prePopulatedData?.phone || params.outboundTargetPhone || null,
        email: prePopulatedEmail,
        name: params.prePopulatedData?.name || null,
        duration: 60,
        notes: null,
      },
      lastProposedSlot: null,
      metadata: {
        turnsInCurrentState: 0,
        totalTurns: 0,
        lastAnalyzedMessageIndex: -1,
        bookingAttempts: 0,
        createdBookingId: null,
        createdBookingType: null,
        googleMeetLink: null,
        errorMessage: null,
      },
    };
  }

  async analyzeTranscript(messages: ConversationMessage[], aiClient: GeminiClient): Promise<SupervisorResult> {
    if (this.state.bookingInProgress) {
      console.log(`🔒 [VOICE-BOOKING-SUPERVISOR] Mutex skip - booking in progress for call ${this.voiceCallId}`);
      return { action: 'none' };
    }

    if (this.state.stage === 'completato') {
      return { action: 'none' };
    }

    if (messages.length - 1 <= this.state.metadata.lastAnalyzedMessageIndex) {
      return { action: 'none' };
    }

    const recentMessages = messages.slice(-VoiceBookingSupervisor.MAX_RECENT_MESSAGES);

    this.state.metadata.totalTurns++;
    this.state.metadata.turnsInCurrentState++;

    const dataBefore = {
      stage: this.state.stage,
      extractedData: { ...this.state.extractedData },
      lastProposedSlot: this.state.lastProposedSlot ? { ...this.state.lastProposedSlot } : null,
    };

    const prompt = this.buildAnalysisPrompt(recentMessages);

    let analysisResult: LLMAnalysisResult;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM analysis timeout')), VoiceBookingSupervisor.TIMEOUT_MS)
      );

      const llmPromise = aiClient.generateContent({
        model: VoiceBookingSupervisor.MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 1500, thinkingConfig: { thinkingBudget: 1024 } },
      });

      const response = await Promise.race([llmPromise, timeoutPromise]);

      const usageMeta = response.usageMetadata || (response as any).response?.usageMetadata;
      if (usageMeta) {
        tokenTracker.track({
          consultantId: this.consultantId,
          clientId: this.clientId,
          model: VoiceBookingSupervisor.MODEL,
          feature: 'voice-call',
          requestType: 'generate',
          inputTokens: usageMeta.promptTokenCount || 0,
          outputTokens: usageMeta.candidatesTokenCount || 0,
          cachedTokens: usageMeta.cachedContentTokenCount || 0,
          totalTokens: usageMeta.totalTokenCount || 0,
        }).catch(e => console.error('[TokenTracker] track error:', e));
      }

      let text = '';
      try {
        text = response.response.text();
      } catch {
        const candidates = (response as any).response?.candidates;
        if (candidates?.[0]?.content?.parts?.[0]?.text) {
          text = candidates[0].content.parts[0].text;
        }
      }

      if (!text) {
        console.warn(`⚠️ [VOICE-BOOKING-SUPERVISOR] Empty LLM response for call ${this.voiceCallId}`);
        return { action: 'none' };
      }

      let jsonStr = text.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      analysisResult = JSON.parse(jsonStr);
    } catch (error: any) {
      console.error(`❌ [VOICE-BOOKING-SUPERVISOR] LLM analysis failed for call ${this.voiceCallId}: ${error.message}`);
      return { action: 'none' };
    }

    if (analysisResult.correction) {
      if (analysisResult.date !== null) this.state.extractedData.date = null;
      if (analysisResult.time !== null) this.state.extractedData.time = null;
      if (analysisResult.phone !== null) this.state.extractedData.phone = null;
      if (analysisResult.email !== null) {
        this.state.extractedData.email = null;
        this.state.emailConfirmed = false;
      }
      if (analysisResult.name !== null) this.state.extractedData.name = null;
      this.state.extractedData.confirmed = false;
      this.state.stage = 'raccolta_dati';
      this.state.metadata.turnsInCurrentState = 0;
    }

    if (analysisResult.aiProposedSlot) {
      this.state.lastProposedSlot = {
        date: analysisResult.aiProposedSlot.date,
        time: analysisResult.aiProposedSlot.time,
        proposedAtTurn: this.state.metadata.totalTurns,
      };
    }

    if (analysisResult.date !== null) this.state.extractedData.date = analysisResult.date;
    if (analysisResult.time !== null) this.state.extractedData.time = analysisResult.time;
    if (analysisResult.phone !== null) this.state.extractedData.phone = analysisResult.phone;
    if (analysisResult.email !== null) {
      if (this.state.emailSource === 'pre_populated' && analysisResult.email !== this.state.extractedData.email && !analysisResult.correction) {
        console.log(`📧 [VOICE-BOOKING-SUPERVISOR] Ignoring speech-extracted email "${analysisResult.email}", keeping pre-populated "${this.state.extractedData.email}" (no explicit correction detected) for call ${this.voiceCallId}`);
      } else {
        this.state.extractedData.email = analysisResult.email;
        if (analysisResult.correction) {
          this.state.emailSource = 'user_corrected';
          this.state.emailConfirmed = false;
          console.log(`📧 [VOICE-BOOKING-SUPERVISOR] Email corrected by user to "${analysisResult.email}" for call ${this.voiceCallId}`);
        } else if (this.state.emailSource !== 'pre_populated') {
          this.state.emailSource = 'speech_extracted';
        }
      }
    }
    if (analysisResult.emailConfirmed) {
      this.state.emailConfirmed = true;
      console.log(`📧 [VOICE-BOOKING-SUPERVISOR] Email CONFIRMED by caller (source: ${this.state.emailSource}, email: ${this.state.extractedData.email}) for call ${this.voiceCallId}`);
    }
    if (analysisResult.name !== null) this.state.extractedData.name = analysisResult.name;

    if (analysisResult.confirmed && this.state.lastProposedSlot) {
      this.state.extractedData.confirmed = true;
    } else if (analysisResult.confirmed && !this.state.lastProposedSlot) {
      console.warn(`⚠️ [VOICE-BOOKING-SUPERVISOR] Confirmation rejected - no lastProposedSlot for call ${this.voiceCallId}`);
      analysisResult.confirmed = false;
      analysisResult.newStage = this.state.extractedData.date && this.state.extractedData.time ? 'dati_completi' : 'raccolta_dati';
    }

    if (!analysisResult.correction) {
      if (analysisResult.newStage !== this.state.stage) {
        this.state.metadata.turnsInCurrentState = 0;
      }
      this.state.stage = analysisResult.newStage;
    }

    this.state.metadata.lastAnalyzedMessageIndex = messages.length - 1;

    this.logAudit({
      stageBefore: dataBefore.stage,
      stageAfter: this.state.stage,
      dataBefore: dataBefore.extractedData,
      dataAfter: this.state.extractedData,
      lastProposedSlotBefore: dataBefore.lastProposedSlot,
      lastProposedSlotAfter: this.state.lastProposedSlot,
      reasoning: analysisResult.reasoning,
      correction: analysisResult.correction,
      turn: this.state.metadata.totalTurns,
    });

    if (this.state.stage === 'confermato') {
      if (!this.clientId && !this.state.emailConfirmed) {
        const currentEmail = this.state.extractedData.email;
        const msg = currentEmail
          ? (this.state.emailSource === 'pre_populated'
            ? `Chiedi: "L'email per l'invito è ${currentEmail}, è corretta?"`
            : `Ripeti l'email "${currentEmail}" lentamente e chiedi conferma.`)
          : `Chiedi l'email al chiamante per l'invito calendario.`;
        console.log(`📧 [VOICE-BOOKING-SUPERVISOR] BLOCKING booking - email not confirmed yet (email: ${currentEmail || 'MISSING'}, source: ${this.state.emailSource}) for call ${this.voiceCallId}`);
        this.state.stage = 'dati_completi';
        return {
          action: 'notify_ai',
          notifyMessage: `[SYSTEM] Prima di procedere con la prenotazione, devi confermare l'email con il chiamante. ${msg}`
        };
      }
      this.state.bookingInProgress = true;
      return await this.executeBooking();
    }

    return { action: 'none' };
  }

  private buildAnalysisPrompt(messages: ConversationMessage[]): string {
    const isClient = this.clientId !== null;
    const { stage, extractedData, lastProposedSlot } = this.state;

    const formattedMessages = messages
      .map(m => `${m.role === 'user' ? 'UTENTE' : 'ASSISTENTE'}: ${m.transcript}`)
      .join('\n');

    const requiredFieldsText = isClient
      ? "Per un cliente registrato servono: data + ora + conferma esplicita"
      : "Per un non-cliente servono: data + ora + telefono + email + conferma esplicita";

    const lastProposedSlotText = lastProposedSlot
      ? `data=${lastProposedSlot.date}, ora=${lastProposedSlot.time} (proposto al turno ${lastProposedSlot.proposedAtTurn})`
      : "nessuno";

    const now = new Date();
    const dayNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
    const todayFormatted = now.toISOString().slice(0, 10);
    const todayDayName = dayNames[now.getDay()];

    return `Sei un analizzatore di trascrizioni vocali per un sistema di prenotazione appuntamenti.

DATA ODIERNA: ${todayFormatted} (${todayDayName})
Usa questa data per risolvere riferimenti relativi come "domani", "dopodomani", "lunedì prossimo", "la settimana prossima", ecc.
- "domani" = il giorno dopo ${todayFormatted}
- "dopodomani" = due giorni dopo ${todayFormatted}
- "lunedì prossimo" = il prossimo lunedì dopo oggi

STATO ATTUALE:
- Fase: ${stage}
- Dati raccolti: date=${extractedData.date}, time=${extractedData.time}, phone=${extractedData.phone}, email=${extractedData.email}, name=${extractedData.name}, confirmed=${extractedData.confirmed}
- Email confermata: ${this.state.emailConfirmed ? 'SÌ' : 'NO'}
- Fonte email: ${this.state.emailSource}
- Ultimo slot proposto dall'AI: ${lastProposedSlotText}
- Tipo chiamante: ${isClient ? "Cliente registrato (servono solo data+ora+conferma)" : "Non-cliente (servono data+ora+telefono+email+conferma)"}
- Campi richiesti: ${requiredFieldsText}

TRASCRIZIONE RECENTE:
${formattedMessages}

ISTRUZIONI:
Analizza la conversazione e rispondi SOLO con JSON valido nel seguente formato:
{
  "newStage": "nessun_intento|raccolta_dati|dati_completi|confermato",
  "date": "YYYY-MM-DD" o null,
  "time": "HH:MM" o null,
  "confirmed": true/false,
  "phone": "+39..." o null,
  "email": "x@y.com" o null,
  "name": "nome" o null,
  "correction": true/false,
  "emailConfirmed": true/false,
  "aiProposedSlot": {"date":"YYYY-MM-DD","time":"HH:MM"} o null,
  "reasoning": "breve spiegazione in italiano"
}

REGOLE CRITICHE:

⚠️ DISTINZIONE FONDAMENTALE - PROMEMORIA vs PRENOTAZIONE:
Un altro sistema (Task Supervisor) gestisce promemoria, reminder, richiami e task.
Tu ti occupi ESCLUSIVAMENTE di prenotazioni a CALENDARIO (appuntamenti, consulenze, visite).
IGNORA COMPLETAMENTE queste richieste (sono compito del Task Supervisor):
- "Ricordami di...", "Chiamami tra X minuti", "Richiamami per...", "Ogni giorno alle..."
- Promemoria per fare qualcosa (spesa, palestra, medicine, ecc.)
- Richieste di richiamo/callback senza contesto di appuntamento
- Task ricorrenti, reminder giornalieri/settimanali
ATTIVATI SOLO per queste richieste:
- "Vorrei prendere un appuntamento", "Posso prenotare una consulenza?"
- "Quando è disponibile il dottore/consulente?"
- "Ho bisogno di fissare un incontro"
- Richieste esplicite di slot a calendario con un professionista
Se l'utente chiede un promemoria o un richiamo, mantieni newStage="nessun_intento".

1. "confirmed" = true SOLO SE:
   a) L'ASSISTENTE ha proposto esplicitamente uno slot specifico (data+ora)
   b) L'UTENTE ha risposto affermativamente SUBITO DOPO
   c) NON ci sono parole come "anzi", "aspetta", "no", "cambiamo" dopo il sì
   d) Lo slot confermato corrisponde all'ultimo proposto

2. "newStage" = "confermato" SOLO SE confirmed=true E tutti i dati richiesti sono presenti

3. "correction" = true SE l'utente corregge un dato precedente ("anzi no", "cambiamo", "non quel giorno")

4. Accumula dati: se un campo era già noto e non è stato corretto, mantienilo (restituisci null per i campi invariati)

5. "aiProposedSlot" = riempi SOLO se l'ASSISTENTE ha proposto uno slot specifico nel suo ultimo messaggio (es: "mercoledì 12 alle 15:00, va bene?")

6. Per "nessun_intento": nessuna menzione di appuntamenti, prenotazioni, disponibilità. ANCHE per promemoria/reminder/richiami.
7. Per "raccolta_dati": conversazione in corso su booking A CALENDARIO ma mancano dati
8. Per "dati_completi": tutti i dati presenti ma manca conferma esplicita
9. Per "confermato": confirmed=true E tutti i dati richiesti sono presenti

📧 REGOLA EMAIL:
10. "emailConfirmed" = true SOLO SE il chiamante ha esplicitamente confermato l'email (ha detto "sì" quando l'AI ha proposto l'email a sistema, oppure ha dettato un'email e ha confermato dopo che l'AI l'ha ripetuta)
11. Se l'email era già nota a sistema e il chiamante NON l'ha corretta, NON restituire un'email diversa estratta dal parlato. Restituisci null per il campo email (mantieni quella a sistema).
12. Restituisci email nel campo "email" SOLO se il chiamante ha esplicitamente dettato un'email NUOVA o ha corretto quella proposta (in quel caso imposta anche "correction": true).`;
  }

  private async executeBooking(): Promise<SupervisorResult> {
    const { date, time, phone, email, name } = this.state.extractedData;

    try {
      if (this.clientId) {
        const proposeResult = await executeConsultationTool(
          "proposeBooking",
          { date, time },
          this.clientId,
          this.consultantId
        );

        if (!proposeResult.success || !proposeResult.result?.confirmationToken) {
          throw new Error(proposeResult.error || "proposeBooking failed - no confirmation token");
        }

        const confirmationToken = proposeResult.result.confirmationToken;

        const confirmResult = await executeConsultationTool(
          "confirmBooking",
          { confirmationToken },
          this.clientId,
          this.consultantId
        );

        if (!confirmResult.success) {
          throw new Error(confirmResult.error || "confirmBooking failed");
        }

        const consultationId = confirmResult.result?.consultationId || confirmResult.result?.id;
        const meetLink = confirmResult.result?.meetLink || confirmResult.result?.googleMeetLink || null;

        await db.update(voiceCalls).set({
          metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
            bookingCreated: true,
            bookingId: consultationId,
            bookingType: 'consultation',
            googleMeetLink: meetLink,
          })}::jsonb`,
        }).where(eq(voiceCalls.id, this.voiceCallId));

        this.state.stage = 'completato';
        this.state.bookingInProgress = false;
        this.state.metadata.createdBookingId = consultationId;
        this.state.metadata.createdBookingType = 'consultation';
        this.state.metadata.googleMeetLink = meetLink;

        return {
          action: 'booking_created',
          bookingId: consultationId,
          bookingType: 'consultation',
          googleMeetLink: meetLink,
          notifyMessage: `[BOOKING_CONFIRMED] Appuntamento creato per ${date} alle ${time}. Link Meet: ${meetLink || 'N/A'}. Comunica la conferma al chiamante con entusiasmo.`,
        };
      } else {
        const booking = await createBookingRecord(
          this.consultantId,
          null,
          {
            date: date!,
            time: time!,
            phone: phone || '',
            email: email || '',
            name: name || undefined,
          },
          'voice_call' as any
        );

        if (!booking) {
          throw new Error("createBookingRecord returned null");
        }

        await db.execute(
          sql`UPDATE appointment_bookings SET voice_call_id = ${this.voiceCallId} WHERE id = ${booking.id}`
        );

        let meetLink: string | null = null;
        let googleEventId: string | null = null;

        if (email) {
          const calendarResult = await createGoogleCalendarBooking(
            this.consultantId,
            booking,
            email
          );
          meetLink = calendarResult.googleMeetLink;
          googleEventId = calendarResult.googleEventId;
        }

        await db.update(voiceCalls).set({
          metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
            bookingCreated: true,
            bookingId: booking.id,
            bookingType: 'appointment',
            googleMeetLink: meetLink,
          })}::jsonb`,
        }).where(eq(voiceCalls.id, this.voiceCallId));

        this.state.stage = 'completato';
        this.state.bookingInProgress = false;
        this.state.metadata.createdBookingId = booking.id;
        this.state.metadata.createdBookingType = 'appointment';
        this.state.metadata.googleMeetLink = meetLink;

        return {
          action: 'booking_created',
          bookingId: booking.id,
          bookingType: 'appointment',
          googleMeetLink: meetLink || undefined,
          notifyMessage: `[BOOKING_CONFIRMED] Appuntamento creato per ${date} alle ${time}. ${meetLink ? `Link Meet: ${meetLink}.` : ''} Comunica la conferma al chiamante con entusiasmo.`,
        };
      }
    } catch (error: any) {
      console.error(`❌ [VOICE-BOOKING-SUPERVISOR] Booking execution failed for call ${this.voiceCallId}: ${error.message}`);

      this.state.bookingInProgress = false;
      this.state.metadata.bookingAttempts++;
      this.state.stage = 'errore';
      this.state.metadata.errorMessage = error.message;

      return {
        action: 'booking_failed',
        errorMessage: error.message,
      };
    }
  }

  getBookingPromptSection(): string {
    const slotsFormatted = this.getAvailableSlotsForPrompt();
    const isClient = this.clientId !== null;

    const { phone, email, name } = this.state.extractedData;
    const hasPrePopulatedPhone = !!phone;
    const hasPrePopulatedEmail = !!email;
    const hasPrePopulatedName = !!name;
    const hasAllContactData = hasPrePopulatedPhone && hasPrePopulatedEmail;
    
    let collectDataStep: string;
    let confirmStep: string;
    let waitStep: string;
    
    if (isClient) {
      collectDataStep = "";
      confirmStep = "3";
      waitStep = "4";
    } else if (hasAllContactData) {
      collectDataStep = `\n3. Conferma i dati: dì "Il numero che abbiamo è ${phone} e l'email è ${email}, sono corretti per l'invito calendario?" — aspetta conferma sì/no`;
      confirmStep = "4";
      waitStep = "5";
    } else if (hasPrePopulatedPhone && hasPrePopulatedEmail) {
      collectDataStep = `\n3. Conferma il numero (${phone}) e l'email (${email}): "Abbiamo ${phone} e ${email}, vanno bene?" — aspetta conferma sì/no`;
      confirmStep = "4";
      waitStep = "5";
    } else if (hasPrePopulatedPhone) {
      collectDataStep = `\n3. Conferma il numero (${phone}) e chiedi l'email per l'invito calendario. Dopo che te la dice, ripetila lentamente per conferma`;
      confirmStep = "4";
      waitStep = "5";
    } else {
      collectDataStep = "\n3. Chiedi telefono e email per l'invito calendario. Dopo che ti dicono l'email, ripetila lentamente per conferma";
      confirmStep = "4";
      waitStep = "5";
    }

    const now = new Date();
    const dayNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
    const todayFormatted = now.toISOString().slice(0, 10);
    const todayDayName = dayNames[now.getDay()];

    let prePopulatedNote = '';
    if (!isClient && (hasPrePopulatedPhone || hasPrePopulatedEmail || hasPrePopulatedName)) {
      prePopulatedNote = `\n\n📋 DATI GIÀ NOTI:`;
      if (hasPrePopulatedName) prePopulatedNote += `\n• Nome: ${name}`;
      if (hasPrePopulatedPhone) prePopulatedNote += `\n• Telefono: ${phone}`;
      if (hasPrePopulatedEmail) prePopulatedNote += `\n• Email: ${email}`;
      prePopulatedNote += `\n→ Proponi questi dati e chiedi conferma. Se il chiamante vuole usare dati diversi, accetta la correzione.`;
    }

    return `## GESTIONE APPUNTAMENTI

Data odierna: ${todayFormatted} (${todayDayName})

Se il chiamante desidera prenotare un appuntamento, segui queste istruzioni:

SLOT DISPONIBILI:
${slotsFormatted}

PROCEDURA:
1. Proponi gli slot disponibili in modo naturale
2. Raccogli data e ora preferite${collectDataStep}
${confirmStep}. Ripeti i dati per conferma: "Allora [giorno] [data] alle [ora], confermi?"
${waitStep}. Attendi conferma esplicita ("sì", "confermo", "va bene")${prePopulatedNote}

⚠️ REGOLA FONDAMENTALE:
NON affermare MAI che l'appuntamento è "confermato", "creato", "prenotato" o "fissato".
NON dire "ho confermato", "è prenotato", "ti mando l'invito".
Puoi dire "sto verificando la disponibilità..." o "un momento, controllo...".
Dirai la conferma SOLO quando riceverai un messaggio di sistema [BOOKING_CONFIRMED].

📧 VERIFICA EMAIL (REGOLA OBBLIGATORIA):
${hasPrePopulatedEmail
  ? `L'email a sistema è: ${email}
- Dì al chiamante: "L'email per l'invito calendario che abbiamo è ${email}, è corretta?"
- NON chiedere MAI di dettare l'email se è già nota a sistema.
- Aspetta SOLO conferma sì/no.
- Se dicono che è sbagliata, chiedi la nuova email e ripetila lentamente per conferma.`
  : `- Chiedi l'email al chiamante per l'invito calendario.
- Dopo che te l'ha detta, RIPETILA LENTAMENTE per conferma (es: "Ho capito mario@gmail.com, è corretto?").
- Se non sei sicura di aver capito bene, chiedi di ripeterla più piano.
- NON procedere finché il chiamante non conferma esplicitamente l'email.
🚫 REGOLA ANTI-ALLUCINAZIONE (FONDAMENTALE):
- NON dire MAI frasi come "vuoi usare l'email che ho in memoria?", "ho già la tua email", "uso quella che ho in sistema" se non hai NESSUNA email pre-caricata.
- Se il chiamante dice "dovresti averla già" o "te l'ho già data": rispondi con naturalezza "Per sicurezza preferisco che me la confermi direttamente, così sono certa che l'invito ti arrivi correttamente!"
- MAI ammettere limiti tecnici o dati mancanti — mantieni sempre un tono naturale e professionale.`}
- MAI procedere con la prenotazione se l'email non è stata confermata dal chiamante.`;
  }

  updateSlots(slots: AvailableSlot[]): string | null {
    this.availableSlots = slots;
    this.slotsLoaded = true;
    if (slots.length === 0) return null;
    const formatted = this.getAvailableSlotsForPrompt();
    return `[SYSTEM_UPDATE] Aggiornamento disponibilità appuntamenti. SLOT DISPONIBILI:\n${formatted}\n\nSe il chiamante chiede un appuntamento, proponi questi slot in modo naturale.`;
  }

  getAvailableSlotsForPrompt(): string {
    const slotsToShow = this.availableSlots;

    if (slotsToShow.length === 0) {
      return "Nessuno slot disponibile al momento.";
    }

    const grouped: Record<string, string[]> = {};

    for (const slot of slotsToShow) {
      const key = `${slot.dayOfWeek} ${slot.dateFormatted}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(slot.time);
    }

    return Object.entries(grouped)
      .map(([day, times]) => `- ${day}: ${times.join(', ')}`)
      .join('\n');
  }

  private logAudit(params: {
    stageBefore: string;
    stageAfter: string;
    dataBefore: VoiceBookingSupervisorState['extractedData'];
    dataAfter: VoiceBookingSupervisorState['extractedData'];
    lastProposedSlotBefore: VoiceBookingSupervisorState['lastProposedSlot'];
    lastProposedSlotAfter: VoiceBookingSupervisorState['lastProposedSlot'];
    reasoning: string;
    correction: boolean;
    turn: number;
  }): void {
    const stageChanged = params.stageBefore !== params.stageAfter;
    const stageIndicator = stageChanged ? '🔄' : '➡️';

    const deltas: string[] = [];
    if (params.dataBefore.date !== params.dataAfter.date) deltas.push(`date: ${params.dataBefore.date} → ${params.dataAfter.date}`);
    if (params.dataBefore.time !== params.dataAfter.time) deltas.push(`time: ${params.dataBefore.time} → ${params.dataAfter.time}`);
    if (params.dataBefore.phone !== params.dataAfter.phone) deltas.push(`phone: ***`);
    if (params.dataBefore.email !== params.dataAfter.email) deltas.push(`email: ${params.dataBefore.email} → ${params.dataAfter.email}`);
    if (params.dataBefore.name !== params.dataAfter.name) deltas.push(`name: ${params.dataBefore.name} → ${params.dataAfter.name}`);
    if (params.dataBefore.confirmed !== params.dataAfter.confirmed) deltas.push(`confirmed: ${params.dataBefore.confirmed} → ${params.dataAfter.confirmed}`);

    const proposedSlotChanged = JSON.stringify(params.lastProposedSlotBefore) !== JSON.stringify(params.lastProposedSlotAfter);
    if (proposedSlotChanged && params.lastProposedSlotAfter) {
      deltas.push(`lastProposedSlot: ${params.lastProposedSlotAfter.date} ${params.lastProposedSlotAfter.time}`);
    }

    console.log(`\n📋 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 [VOICE-BOOKING-SUPERVISOR] AUDIT LOG - Call ${this.voiceCallId.slice(0, 8)}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Turn: ${params.turn} | ${stageIndicator} Stage: ${params.stageBefore} → ${params.stageAfter}`);
    console.log(`   Correction: ${params.correction}`);
    if (deltas.length > 0) {
      console.log(`   Deltas: ${deltas.join(' | ')}`);
    } else {
      console.log(`   Deltas: (nessuna modifica)`);
    }
    console.log(`   Reasoning: ${params.reasoning}`);
    console.log(`   Data: date=${params.dataAfter.date}, time=${params.dataAfter.time}, confirmed=${params.dataAfter.confirmed}`);
    if (!this.clientId) {
      console.log(`   Lead data: phone=${params.dataAfter.phone ? '***' : null}, email=${params.dataAfter.email}, name=${params.dataAfter.name}`);
    }
    if (params.lastProposedSlotAfter) {
      console.log(`   LastProposedSlot: ${params.lastProposedSlotAfter.date} ${params.lastProposedSlotAfter.time} (turn ${params.lastProposedSlotAfter.proposedAtTurn})`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  getState(): VoiceBookingSupervisorState {
    return this.state;
  }

  reset(): void {
    this.state = {
      stage: 'nessun_intento',
      bookingInProgress: false,
      emailConfirmed: false,
      emailSource: 'speech_extracted',
      extractedData: {
        date: null,
        time: null,
        confirmed: false,
        phone: this.outboundTargetPhone || null,
        email: null,
        name: null,
        duration: 60,
        notes: null,
      },
      lastProposedSlot: null,
      metadata: {
        turnsInCurrentState: 0,
        totalTurns: 0,
        lastAnalyzedMessageIndex: -1,
        bookingAttempts: 0,
        createdBookingId: null,
        createdBookingType: null,
        googleMeetLink: null,
        errorMessage: null,
      },
    };
  }
}
