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
  const trimmedMessage = message.trim();
  
  if (trimmedMessage.length < 2) {
    console.log(`   ⏭️ [PRE-CHECK] Skip - message too short (${trimmedMessage.length} chars)`);
    return false;
  }
  
  if (hasExistingBooking) {
    console.log(`   🤖 [AI INTUITION] Booking exists - using AI to determine if message is booking-related...`);
    
    try {
      const prompt = `Analizza questo messaggio e rispondi SOLO con "SÌ" o "NO".

Il messaggio è una CONFERMA, MODIFICA, CANCELLAZIONE di appuntamento, o AGGIUNTA INVITATI?

Messaggio: "${message}"

REGOLE IMPORTANTI:
- "si", "sì", "ok", "va bene", "perfetto", "certo", "confermo", "esatto" → SÌ
- "si va bene", "sì va bene", "ok va bene" → SÌ
- "cancellalo", "cancellarlo", "eliminalo", "disdici", "puoi cancellarlo?" → SÌ
- "modificalo", "spostalo", "cambialo", "puoi modificarlo?" → SÌ
- qualsiasi email (xxx@yyy.com) menzionata → SÌ
- richieste con orari o date → SÌ
- saluti semplici (ciao, grazie, arrivederci) SENZA altro contenuto → NO
- domande generiche (come funziona?, cosa fate?, dimmi di più) → NO
- insulti o spam → NO

Rispondi SOLO: SÌ oppure NO`;

      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      const answer = response.text?.trim().toUpperCase() || '';
      const shouldAnalyze = answer.includes('SÌ') || answer.includes('SI') || answer === 'YES';
      
      console.log(`   🤖 [AI INTUITION] Response: "${answer}" → shouldAnalyze: ${shouldAnalyze}`);
      return shouldAnalyze;
      
    } catch (error: any) {
      console.error(`   ⚠️ [AI INTUITION] Error: ${error.message} - defaulting to TRUE (analyze anyway)`);
      return true;
    }
  }
  
  const emailPattern = /@[\w.-]+\.[a-zA-Z]{2,}/;
  const hasEmail = emailPattern.test(message);
  
  const phonePattern = /\+?\d[\d\s\-\.]{8,}/;
  const hasPhone = phonePattern.test(message);
  
  const dateTimePattern = /\b(\d{1,2}[\/\-\.]\d{1,2}|\d{1,2}[:\.]?\d{2}|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|domani|dopodomani)\b/i;
  const hasDateTime = dateTimePattern.test(message);
  
  if (hasEmail || hasPhone || hasDateTime) {
    console.log(`   ✅ [PRE-CHECK] Booking data detected (email: ${hasEmail}, phone: ${hasPhone}, date/time: ${hasDateTime})`);
    return true;
  }
  
  const nonBookingPhrases = [
    /^(dimmi|raccontami|spiegami|parlami)\s+(di\s+più|altro|meglio)/i,
    /^(cosa|che\s+cosa|quali?)\s+(puoi|sai|fai|sono|offri)/i,
    /^(come|perché|quando|dove|chi)\s+(funziona|lavori|operi)/i,
    /^(ciao|salve|buongiorno|buonasera|arrivederci|a\s+presto)\s*$/i,
  ];
  
  const lowerMessage = trimmedMessage.toLowerCase();
  for (const pattern of nonBookingPhrases) {
    if (pattern.test(lowerMessage)) {
      console.log(`   ⏭️ [PRE-CHECK] Non-booking phrase detected - skipping`);
      return false;
    }
  }
  
  if (trimmedMessage.length < 10) {
    console.log(`   ⏭️ [PRE-CHECK] Short message without booking context - skipping`);
    return false;
  }
  
  console.log(`   ⏭️ [PRE-CHECK] No clear booking indicators - skipping`);
  return false;
}
