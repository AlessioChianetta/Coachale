import { GoogleGenAI } from "@google/genai";

const DUPLICATE_ACTION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minuti

export interface LastCompletedAction {
  type: 'MODIFY' | 'CANCEL' | 'ADD_ATTENDEES';
  completedAt: string;
  triggerMessageId: string;
  details?: {
    oldDate?: string;
    oldTime?: string;
    newDate?: string;
    newTime?: string;
    attendeesAdded?: string[];
  };
}

export interface ActionDetails {
  newDate?: string;
  newTime?: string;
  attendees?: string[];
}

function arraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

export function isActionAlreadyCompleted(
  lastCompletedAction: LastCompletedAction | null | undefined,
  intent: string,
  newDetails?: ActionDetails
): boolean {
  if (!lastCompletedAction) return false;
  
  if (lastCompletedAction.type !== intent) return false;
  
  const completedAt = new Date(lastCompletedAction.completedAt).getTime();
  const now = Date.now();
  const timeSinceCompletion = now - completedAt;
  
  if (timeSinceCompletion >= DUPLICATE_ACTION_COOLDOWN_MS) {
    return false;
  }
  
  if (intent === 'MODIFY' && newDetails) {
    const sameDateTime = 
      lastCompletedAction.details?.newDate === newDetails.newDate &&
      lastCompletedAction.details?.newTime === newDetails.newTime;
    
    if (!sameDateTime) {
      console.log(`   ✅ [DEDUPE] MODIFY with different date/time - allowing action`);
      console.log(`      Previous: ${lastCompletedAction.details?.newDate} ${lastCompletedAction.details?.newTime}`);
      console.log(`      New: ${newDetails.newDate} ${newDetails.newTime}`);
      return false;
    }
  }
  
  if (intent === 'ADD_ATTENDEES' && newDetails?.attendees) {
    const sameAttendees = arraysEqual(
      lastCompletedAction.details?.attendeesAdded,
      newDetails.attendees
    );
    
    if (!sameAttendees) {
      console.log(`   ✅ [DEDUPE] ADD_ATTENDEES with different attendees - allowing action`);
      console.log(`      Previous: ${lastCompletedAction.details?.attendeesAdded?.join(', ')}`);
      console.log(`      New: ${newDetails.attendees.join(', ')}`);
      return false;
    }
  }
  
  console.log(`   ⏭️ [DUPLICATE] Action ${intent} already completed ${Math.round(timeSinceCompletion / 1000)}s ago with same details - skipping`);
  return true;
}

export async function shouldAnalyzeForBooking(
  message: string,
  hasExistingBooking: boolean,
  aiClient: GoogleGenAI
): Promise<boolean> {
  const trimmedMessage = message.trim().toLowerCase();
  
  if (trimmedMessage.length < 3) {
    console.log(`   ⏭️ [PRE-CHECK] Skip - message too short (${trimmedMessage.length} chars)`);
    return false;
  }
  
  const explicitBookingKeywords = /\b(modifica|modificare|cancella|cancellare|disdici|disdire|sposta|spostare|elimina|eliminare|annulla|annullare)\s*(l['']?appuntamento|la\s+data|l['']?orario|alle|al|per|a\s+domani|a\s+lunedì|a\s+martedì|a\s+mercoledì|a\s+giovedì|a\s+venerdì|a\s+sabato)/i;
  if (explicitBookingKeywords.test(message)) {
    console.log(`   ✅ [PRE-CHECK] Explicit booking action keyword detected`);
    return true;
  }
  
  const modifyTimePattern = /\b(modifica|sposta|cambia)\s*(alle?\s*\d{1,2}[:\.]?\d{0,2}|\d{1,2}[:\.]?\d{0,2})/i;
  if (modifyTimePattern.test(message)) {
    console.log(`   ✅ [PRE-CHECK] Modify time pattern detected`);
    return true;
  }
  
  const explicitConfirmation = /^(confermo|sì,?\s*confermo|ok,?\s*confermo|sì\s+va\s+bene|confermato|conferma)$/i;
  if (explicitConfirmation.test(trimmedMessage)) {
    console.log(`   ✅ [PRE-CHECK] Explicit confirmation word detected`);
    return true;
  }
  
  const addAttendeesPattern = /\b(aggiungi|invita|inserisci|metti)\s+(anche\s+)?([\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/i;
  if (addAttendeesPattern.test(message)) {
    console.log(`   ✅ [PRE-CHECK] Add attendees pattern detected`);
    return true;
  }
  
  const dateTimePattern = /\b(\d{1,2}[\/\-\.]\d{1,2}|\d{1,2}[:\.]?\d{2}|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|domani|dopodomani)\b/i;
  const hasDateTime = dateTimePattern.test(message);
  
  const emailPattern = /@[\w.-]+\.[a-zA-Z]{2,}/;
  const hasEmail = emailPattern.test(message);
  
  const phonePattern = /\+?\d[\d\s\-\.]{8,}/;
  const hasPhone = phonePattern.test(message);
  
  if (hasDateTime || hasEmail || hasPhone) {
    console.log(`   ✅ [PRE-CHECK] Booking data pattern detected (date/time: ${hasDateTime}, email: ${hasEmail}, phone: ${hasPhone})`);
    return true;
  }
  
  const nonBookingPhrases = [
    /^(dimmi|raccontami|spiegami|parlami)\s+(di\s+più|altro|meglio)/i,
    /^(cosa|che\s+cosa|quali?)\s+(puoi|sai|fai|sono|offri)/i,
    /^(come|perché|quando|dove|chi)\s+(funziona|lavori|operi)/i,
    /^(grazie|ok|capito|interessante|bello|fantastico|perfetto)\s*$/i,
    /^(ciao|salve|buongiorno|buonasera|arrivederci|a\s+presto)\s*$/i,
    /^(sì|si|no|forse|magari|vedremo)\s*$/i,
    /^(ho\s+capito|chiaro|va\s+bene)\s*$/i,
  ];
  
  for (const pattern of nonBookingPhrases) {
    if (pattern.test(trimmedMessage)) {
      console.log(`   ⏭️ [PRE-CHECK] Non-booking phrase detected - skipping analysis`);
      return false;
    }
  }
  
  if (!hasExistingBooking && trimmedMessage.length < 15) {
    console.log(`   ⏭️ [PRE-CHECK] Short message without booking context - skipping`);
    return false;
  }
  
  if (hasExistingBooking && trimmedMessage.length > 10 && trimmedMessage.length < 100) {
    try {
      console.log(`   🤖 [PRE-CHECK] Using AI to determine booking intent...`);
      
      const prompt = `Analizza questo messaggio e rispondi SOLO con "SÌ" o "NO".

Il messaggio riguarda MODIFICARE, CANCELLARE, CONFERMARE un appuntamento, o AGGIUNGERE INVITATI?

Messaggio: "${message}"

IMPORTANTE:
- Se parla di cambiare data/ora → SÌ
- Se parla di cancellare/disdire → SÌ
- Se dice "confermo" in risposta a una proposta → SÌ
- Se vuole aggiungere email/invitati → SÌ
- Se chiede informazioni generiche → NO
- Se saluta o ringrazia → NO
- Se chiede "dimmi di più" o simili → NO

Rispondi SOLO: SÌ oppure NO`;

      const response = await aiClient.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: prompt,
      });
      
      const answer = response.text?.trim().toUpperCase() || '';
      const shouldAnalyze = answer.includes('SÌ') || answer.includes('SI') || answer === 'YES';
      
      console.log(`   🤖 [PRE-CHECK] AI response: "${answer}" → shouldAnalyze: ${shouldAnalyze}`);
      return shouldAnalyze;
      
    } catch (error: any) {
      console.error(`   ⚠️ [PRE-CHECK] AI check failed: ${error.message} - defaulting to analyze`);
      return true;
    }
  }
  
  console.log(`   ⏭️ [PRE-CHECK] No booking indicators - skipping analysis`);
  return false;
}
