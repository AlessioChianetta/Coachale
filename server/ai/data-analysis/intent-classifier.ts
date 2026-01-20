/**
 * Intent Classifier for Data Analysis
 * Classifies user intent BEFORE the query planner to determine if tool calling is required
 * 
 * Intent Types:
 * - ANALYTICAL: Requires data/numbers → Tool calling REQUIRED
 * - INFORMATIONAL: Descriptive/explanatory → Tool calling optional
 * - OPERATIONAL: Actions/commands → Depends on action
 * - CONVERSATIONAL: Simple courtesy messages → NO tool calling, simple response
 */

export type IntentType = "analytical" | "informational" | "operational" | "conversational";

export interface IntentClassification {
  type: IntentType;
  confidence: number;
  requiresToolCall: boolean;
  detectedPatterns: string[];
  explanation: string;
}

const ANALYTICAL_PATTERNS = [
  /\b(quanto|quanti|quante)\b/i,
  /\b(totale|somma|media|average|conteggio|count)\b/i,
  /\b(percentuale|%|percent)\b/i,
  /\b(fatturato|revenue|vendite|sales|incasso)\b/i,
  /\b(food[\s_]?cost|costo|margine|margin|profitto|profit)\b/i,
  /\b(trend|andamento|crescita|calo|diminuzione|aumento)\b/i,
  /\b(confronta|compare|vs|rispetto|differenza)\b/i,
  /\b(top|bottom|migliori|peggiori|primi|ultimi)\b/i,
  /\b(per\s+mese|per\s+giorno|per\s+anno|mensile|giornaliero|annuale)\b/i,
  /\b(mostrami|elenca|lista|dammi)\b.*\b(dati|numeri|cifre|valori)\b/i,
  /\b(calcola|calcolare|compute)\b/i,
  /\b(statistiche|analytics|analisi\s+dei\s+dati)\b/i,
  /\b(minimo|massimo|min|max)\b/i,
  /\b(distribuzione|breakdown|suddivisione)\b/i,
  /\d+\s*(€|euro|%|percent)/i,
  /\b(ticket\s*medio|scontrino\s*medio)\b/i,
  /\b(quantità|quantity|numero\s*di|count\s*of)\b/i,
];

const INFORMATIONAL_PATTERNS = [
  /\b(cos['\s]?è|what\s+is|spiegami|spiega|explain)\b/i,
  /\b(come\s+funziona|how\s+does|how\s+to)\b/i,
  /\b(definizione|definition|significa)\b/i,
  /\b(perché|why|motivo)\b/i,
  /\b(aiutami\s+a\s+capire|help\s+me\s+understand)\b/i,
  /\b(descrivi|describe)\b/i,
  /^ciao|^salve|^buongiorno|^hello|^hi\b/i,
  /\b(grazie|thanks|thank\s+you)\b/i,
  /cosa\s+(puoi|sai)\s+fare/i,
  /che\s+cosa\s+(puoi|sai)\s+fare/i,
  /quali\s+(sono\s+le\s+tue\s+)?funzionalit[àa]/i,
  /come\s+(ti\s+)?posso\s+usare/i,
  /what\s+can\s+you\s+do/i,
  /help\s*$/i,
  /aiuto\s*$/i,
];

const OPERATIONAL_PATTERNS = [
  /\b(carica|upload|importa|import)\b/i,
  /\b(elimina|delete|rimuovi|remove)\b/i,
  /\b(modifica|edit|cambia|change)\b/i,
  /\b(esporta|export|scarica|download)\b/i,
  /\b(aggiungi|add|inserisci|insert)\b/i,
];

const PURE_ACKNOWLEDGMENTS = [
  "grazie", "ok", "okay", "perfetto", "capito", "bene", "ottimo",
  "fantastico", "grande", "va bene", "d'accordo", "inteso", "chiaro",
  "thanks", "thank you", "got it", "understood", "si", "sì", "no",
  "esatto", "giusto", "bravo", "eccellente", "magnifico", "super"
];

const ANALYTICAL_BLOCKERS = [
  "quanto", "quanti", "quante", "fatturato", "revenue", "vendite", "venduto",
  "costo", "costi", "margine", "calcola", "mostrami", "analizza", "confronta",
  "dimmi", "dammi", "elenca", "lista", "totale", "media", "somma", "conteggio"
];

function normalizeInput(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[!?.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isConversationalMessage(question: string): boolean {
  const normalized = normalizeInput(question);
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) return false;
  if (words.length > 5) return false;
  
  const hasAnalyticalBlocker = ANALYTICAL_BLOCKERS.some(blocker => 
    normalized.includes(blocker)
  );
  if (hasAnalyticalBlocker) return false;
  
  const hasAnyAcknowledgment = PURE_ACKNOWLEDGMENTS.some(ack => 
    normalized.includes(ack)
  );
  
  return hasAnyAcknowledgment;
}

export const CONVERSATIONAL_FALLBACK_REPLY = "Prego! Sono qui per aiutarti con l'analisi dei tuoi dati. Cosa vuoi sapere?";

export function classifyIntent(userQuestion: string): IntentClassification {
  const question = userQuestion.trim();
  const detectedPatterns: string[] = [];
  
  // FIRST: Check for conversational messages (short courtesy phrases)
  // These should bypass ALL tool calls and return simple responses
  if (isConversationalMessage(question)) {
    console.log(`[INTENT-CLASSIFIER] CONVERSATIONAL detected: "${question}" → no tool calls`);
    return {
      type: "conversational",
      confidence: 0.99,
      requiresToolCall: false,
      detectedPatterns: ["conversational: courtesy message"],
      explanation: "Messaggio di cortesia - risposta semplice senza analisi dati",
    };
  }
  
  let analyticalScore = 0;
  let informationalScore = 0;
  let operationalScore = 0;
  
  for (const pattern of ANALYTICAL_PATTERNS) {
    if (pattern.test(question)) {
      analyticalScore += 10;
      detectedPatterns.push(`analytical: ${pattern.source.substring(0, 30)}...`);
    }
  }
  
  for (const pattern of INFORMATIONAL_PATTERNS) {
    if (pattern.test(question)) {
      informationalScore += 10;
      detectedPatterns.push(`informational: ${pattern.source.substring(0, 30)}...`);
    }
  }
  
  for (const pattern of OPERATIONAL_PATTERNS) {
    if (pattern.test(question)) {
      operationalScore += 10;
      detectedPatterns.push(`operational: ${pattern.source.substring(0, 30)}...`);
    }
  }
  
  const hasNumbers = /\d/.test(question);
  if (hasNumbers) {
    analyticalScore += 5;
    detectedPatterns.push("contains_numbers");
  }
  
  const hasCurrencySymbols = /[€$£¥]/.test(question);
  if (hasCurrencySymbols) {
    analyticalScore += 5;
    detectedPatterns.push("contains_currency");
  }
  
  const hasQuestionMark = question.includes("?");
  if (hasQuestionMark && analyticalScore > 0) {
    analyticalScore += 3;
  }
  
  const totalScore = analyticalScore + informationalScore + operationalScore;
  
  let type: IntentType;
  let confidence: number;
  let requiresToolCall: boolean;
  let explanation: string;
  
  if (analyticalScore > informationalScore && analyticalScore > operationalScore) {
    type = "analytical";
    confidence = totalScore > 0 ? Math.min(analyticalScore / totalScore, 0.95) : 0.5;
    requiresToolCall = true;
    explanation = "La domanda richiede dati numerici o analisi - tool call obbligatorio";
  } else if (operationalScore > informationalScore) {
    type = "operational";
    confidence = totalScore > 0 ? Math.min(operationalScore / totalScore, 0.95) : 0.5;
    requiresToolCall = false;
    explanation = "La domanda riguarda un'operazione - tool call dipende dall'azione";
  } else if (informationalScore > 0) {
    type = "informational";
    confidence = totalScore > 0 ? Math.min(informationalScore / totalScore, 0.95) : 0.5;
    requiresToolCall = false;
    explanation = "La domanda è descrittiva/esplicativa - tool call opzionale";
  } else {
    type = "analytical";
    confidence = 0.3;
    requiresToolCall = true;
    explanation = "Intent ambiguo, assumo analytical per sicurezza - tool call forzato";
  }
  
  console.log(`[INTENT-CLASSIFIER] Question: "${question.substring(0, 50)}..." → ${type} (confidence: ${confidence.toFixed(2)}, requiresToolCall: ${requiresToolCall})`);
  
  return {
    type,
    confidence,
    requiresToolCall,
    detectedPatterns,
    explanation,
  };
}

export function requiresNumericAnswer(userQuestion: string): boolean {
  const classification = classifyIntent(userQuestion);
  return classification.requiresToolCall;
}

export class ForceToolRetryError extends Error {
  constructor(message: string, public userQuestion: string, public classification: IntentClassification) {
    super(message);
    this.name = "ForceToolRetryError";
  }
}
