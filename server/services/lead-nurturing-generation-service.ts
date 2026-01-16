import { db } from "../db";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import { getAIProvider, GEMINI_3_MODEL, GEMINI_3_THINKING_LEVEL } from "../ai/provider-factory";
import { Response } from "express";

export interface GenerationProgress {
  total: number;
  completed: number;
  current: number;
  category: string;
  status: "running" | "completed" | "error";
  error?: string;
}

export interface BrandVoiceData {
  consultantDisplayName?: string;
  businessName?: string;
  businessDescription?: string;
  consultantBio?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  usp?: string;
  whoWeHelp?: string;
  whoWeDontHelp?: string;
  whatWeDo?: string;
  howWeDoIt?: string;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string;
  softwareCreated?: { emoji: string; name: string; description: string }[];
  booksPublished?: { title: string; year: string }[];
  caseStudies?: { client: string; result: string }[];
  servicesOffered?: { name: string; price: string; description: string }[];
  guarantees?: string;
}

export interface GenerationConfig {
  consultantId: string;
  businessDescription: string;
  targetAudience: string;
  tone: string;
  companyName?: string;
  senderName?: string;
  brandVoiceData?: BrandVoiceData;
}

const TEMPLATE_CATEGORIES = [
  { name: "welcome", days: [1, 2, 3], description: "Benvenuto e introduzione" },
  { name: "education", days: Array.from({ length: 60 }, (_, i) => i + 4), description: "Contenuti educativi" },
  { name: "value", days: Array.from({ length: 60 }, (_, i) => i + 64), description: "Proposta di valore" },
  { name: "trust", days: Array.from({ length: 60 }, (_, i) => i + 124), description: "Costruzione fiducia" },
  { name: "engagement", days: Array.from({ length: 60 }, (_, i) => i + 184), description: "Coinvolgimento" },
  { name: "conversion", days: Array.from({ length: 60 }, (_, i) => i + 244), description: "Conversione" },
  { name: "retention", days: Array.from({ length: 62 }, (_, i) => i + 304), description: "Fidelizzazione" },
];

const WEEK_THEMES: { week: number; theme: string; focus: string; }[] = [
  { week: 1, theme: "Benvenuto e Presentazione", focus: "Chi sei, cosa fai, cosa aspettarsi dal percorso" },
  { week: 2, theme: "La Tua Storia", focus: "Perché fai questo lavoro, la tua missione personale" },
  { week: 3, theme: "Errore Comune #1", focus: "Il primo grande errore che le persone fanno nel tuo settore" },
  { week: 4, theme: "Come Funziona il Servizio", focus: "Spiegazione chiara del tuo metodo/approccio" },
  { week: 5, theme: "Caso Studio #1", focus: "Storia di successo di un cliente reale" },
  { week: 6, theme: "Mito da Sfatare", focus: "Una credenza sbagliata comune nel settore" },
  { week: 7, theme: "Tool/Risorsa Gratuita", focus: "Condividi qualcosa di utile e pratico" },
  { week: 8, theme: "Obiezione: Non Ho Tempo", focus: "Come superare la mancanza di tempo" },
  { week: 9, theme: "Obiezione: Costa Troppo", focus: "Il vero costo di non agire" },
  { week: 10, theme: "Behind The Scenes", focus: "Mostra come lavori, il tuo processo" },
  { week: 11, theme: "FAQ - Domande Frequenti", focus: "Rispondi alle domande più comuni" },
  { week: 12, theme: "Recap e Invito", focus: "Riassumi il valore e invita all'azione" },
  { week: 13, theme: "Caso Studio #2", focus: "Un'altra storia di successo" },
  { week: 14, theme: "I Tuoi Valori", focus: "Cosa ti guida nelle decisioni" },
  { week: 15, theme: "Errore Comune #2", focus: "Secondo errore frequente" },
  { week: 16, theme: "Testimonianza Cliente", focus: "Parole dirette di chi ti ha scelto" },
  { week: 17, theme: "Il Tuo Perché", focus: "Motivazione profonda dietro il tuo lavoro" },
  { week: 18, theme: "Risultati Misurabili", focus: "Numeri e dati concreti" },
  { week: 19, theme: "Caso Studio #3", focus: "Focus su un settore/nicchia specifica" },
  { week: 20, theme: "Obiezione: Non Sono Pronto", focus: "Perché il momento giusto è ora" },
  { week: 21, theme: "Garanzie e Sicurezza", focus: "Come proteggi il cliente" },
  { week: 22, theme: "Differenza vs Concorrenti", focus: "Cosa ti rende unico" },
  { week: 23, theme: "Storia di Fallimento", focus: "Un tuo errore e cosa hai imparato" },
  { week: 24, theme: "Invito Diretto", focus: "CTA forte per prenotare" },
  { week: 25, theme: "Domanda Interattiva", focus: "Chiedi feedback o opinione" },
  { week: 26, theme: "Caso Studio #4", focus: "Cliente con situazione difficile" },
  { week: 27, theme: "Contenuto Esclusivo", focus: "Qualcosa solo per chi è in lista" },
  { week: 28, theme: "Errore Comune #3", focus: "Terzo errore da evitare" },
  { week: 29, theme: "Sondaggio/Quiz", focus: "Coinvolgi con domande" },
  { week: 30, theme: "Trend del Settore", focus: "Novità e cambiamenti" },
  { week: 31, theme: "Obiezione: Ho Già Provato", focus: "Perché stavolta è diverso" },
  { week: 32, theme: "Caso Studio #5", focus: "Trasformazione rapida" },
  { week: 33, theme: "Riflessione Personale", focus: "Pensiero profondo da condividere" },
  { week: 34, theme: "Tool/Risorsa #2", focus: "Altra risorsa pratica" },
  { week: 35, theme: "Anticipazione", focus: "Cosa sta per arrivare" },
  { week: 36, theme: "Check-in", focus: "Come stai? Hai domande?" },
  { week: 37, theme: "Urgenza Soft", focus: "Perché agire ora" },
  { week: 38, theme: "Caso Studio #6", focus: "ROI e risultati economici" },
  { week: 39, theme: "Offerta Speciale", focus: "Proposta esclusiva" },
  { week: 40, theme: "Ultimi Posti", focus: "Scarsità genuina" },
  { week: 41, theme: "Obiezione Finale", focus: "L'ultimo dubbio da superare" },
  { week: 42, theme: "Decisione", focus: "Aiuta a decidere" },
  { week: 43, theme: "Bonus Esclusivo", focus: "Valore aggiunto per chi prenota" },
  { week: 44, theme: "Chiamata all'Azione", focus: "Invito finale diretto" },
  { week: 45, theme: "Aggiornamento", focus: "Novità dal tuo mondo" },
  { week: 46, theme: "Caso Studio #7", focus: "Cliente a lungo termine" },
  { week: 47, theme: "Gratitudine", focus: "Ringrazia per essere in lista" },
  { week: 48, theme: "Riflessione Annuale", focus: "Cosa hai imparato quest'anno" },
  { week: 49, theme: "Auguri/Celebrazione", focus: "Momento speciale" },
  { week: 50, theme: "Obiettivi Futuri", focus: "Cosa arriverà" },
  { week: 51, theme: "Invito Finale Anno", focus: "Chiudi l'anno insieme" },
  { week: 52, theme: "Nuovo Inizio", focus: "Prepararsi al nuovo anno" },
];

const EMAIL_TYPES = [
  { type: "formazione", icon: "📚", description: "Insegna qualcosa di utile", ctaBias: "calendario" },
  { type: "valore", icon: "💎", description: "Condividi insight esclusivo", ctaBias: "whatsapp" },
  { type: "appuntamento", icon: "📅", description: "Invita a prenotare consulenza", ctaBias: "calendario" },
  { type: "storia", icon: "📖", description: "Racconta esperienza personale", ctaBias: "risposta" },
  { type: "case_study", icon: "🏆", description: "Mostra risultati cliente", ctaBias: "calendario" },
  { type: "obiezione", icon: "❓", description: "Affronta dubbio comune", ctaBias: "whatsapp" },
  { type: "risorsa", icon: "🎁", description: "Offri tool/checklist gratuita", ctaBias: "risposta" },
  { type: "domanda", icon: "💬", description: "Chiedi feedback/opinione", ctaBias: "risposta" },
];

const CTA_TYPES = [
  { type: "calendario", template: "Prenota la tua consulenza gratuita: {{linkCalendario}}", weight: 40 },
  { type: "whatsapp", template: "Scrivimi su WhatsApp: {{whatsapp}}", weight: 30 },
  { type: "risposta", template: "Rispondi a questa email, leggo personalmente ogni messaggio", weight: 20 },
  { type: "risorsa", template: "Scarica la risorsa gratuita qui: {{linkCalendario}}", weight: 10 },
];

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 1000;

function getCategoryForDay(day: number): string {
  for (const cat of TEMPLATE_CATEGORIES) {
    if (cat.days.includes(day)) {
      return cat.name;
    }
  }
  return "general";
}

function getCategoryDescription(day: number): string {
  for (const cat of TEMPLATE_CATEGORIES) {
    if (cat.days.includes(day)) {
      return cat.description;
    }
  }
  return "Contenuto generale";
}

function getWeekNumber(day: number): number {
  return Math.ceil(day / 7);
}

function getWeekTheme(day: number): { theme: string; focus: string } {
  const week = getWeekNumber(day);
  const weekTheme = WEEK_THEMES.find(w => w.week === week) || WEEK_THEMES[WEEK_THEMES.length - 1];
  return { theme: weekTheme.theme, focus: weekTheme.focus };
}

function getEmailType(day: number): typeof EMAIL_TYPES[0] {
  const dayOfWeek = ((day - 1) % 7);
  const weeklyPattern = [0, 1, 3, 0, 4, 6, 2];
  const weekNum = getWeekNumber(day);
  const variation = weekNum % 4;
  
  let index = weeklyPattern[dayOfWeek];
  if (variation === 1 && dayOfWeek === 4) index = 5;
  if (variation === 2 && dayOfWeek === 5) index = 7;
  if (variation === 3 && dayOfWeek === 1) index = 3;
  
  return EMAIL_TYPES[index];
}

function getCTAForDay(day: number, emailType: typeof EMAIL_TYPES[0]): typeof CTA_TYPES[0] {
  const biasedCTA = CTA_TYPES.find(c => c.type === emailType.ctaBias);
  const variation = day % 5;
  if (variation === 0) {
    const alternatives = CTA_TYPES.filter(c => c.type !== emailType.ctaBias);
    return alternatives[day % alternatives.length];
  }
  return biasedCTA || CTA_TYPES[0];
}

async function fetchNurturingKnowledgeItems(consultantId: string): Promise<string> {
  try {
    const items = await db
      .select()
      .from(schema.nurturingKnowledgeItems)
      .where(eq(schema.nurturingKnowledgeItems.consultantId, consultantId))
      .orderBy(asc(schema.nurturingKnowledgeItems.order));

    if (items.length === 0) {
      return "";
    }

    let kbContext = "\n\nKNOWLEDGE BASE DOCUMENTI (usa queste informazioni per arricchire le email):\n";
    
    for (const item of items) {
      kbContext += `\n### ${item.title} (${item.type})\n`;
      const contentPreview = item.content.length > 3000 
        ? item.content.substring(0, 3000) + "...[contenuto troncato]"
        : item.content;
      kbContext += contentPreview + "\n";
    }

    return kbContext;
  } catch (error) {
    console.error("[NURTURING GENERATION] Error fetching KB items:", error);
    return "";
  }
}

function buildBrandVoiceContext(brandVoice?: BrandVoiceData): string {
  if (!brandVoice || Object.keys(brandVoice).length === 0) {
    return "";
  }
  
  let context = "\n\nBRAND VOICE & IDENTITÀ DEL CONSULENTE:\n";
  
  if (brandVoice.consultantDisplayName) {
    context += `- Nome Consulente: ${brandVoice.consultantDisplayName}\n`;
  }
  if (brandVoice.businessName) {
    context += `- Nome Business: ${brandVoice.businessName}\n`;
  }
  if (brandVoice.businessDescription) {
    context += `- Descrizione Business: ${brandVoice.businessDescription}\n`;
  }
  if (brandVoice.consultantBio) {
    context += `- Bio Consulente: ${brandVoice.consultantBio}\n`;
  }
  if (brandVoice.vision) {
    context += `- Vision: ${brandVoice.vision}\n`;
  }
  if (brandVoice.mission) {
    context += `- Mission: ${brandVoice.mission}\n`;
  }
  if (brandVoice.values && brandVoice.values.length > 0) {
    context += `- Valori: ${brandVoice.values.join(", ")}\n`;
  }
  if (brandVoice.usp) {
    context += `- Unique Selling Proposition: ${brandVoice.usp}\n`;
  }
  if (brandVoice.whoWeHelp) {
    context += `- Chi Aiutiamo: ${brandVoice.whoWeHelp}\n`;
  }
  if (brandVoice.whoWeDontHelp) {
    context += `- Chi NON Aiutiamo: ${brandVoice.whoWeDontHelp}\n`;
  }
  if (brandVoice.whatWeDo) {
    context += `- Cosa Facciamo: ${brandVoice.whatWeDo}\n`;
  }
  if (brandVoice.howWeDoIt) {
    context += `- Come Lo Facciamo: ${brandVoice.howWeDoIt}\n`;
  }
  if (brandVoice.yearsExperience) {
    context += `- Anni di Esperienza: ${brandVoice.yearsExperience}\n`;
  }
  if (brandVoice.clientsHelped) {
    context += `- Clienti Aiutati: ${brandVoice.clientsHelped}\n`;
  }
  if (brandVoice.resultsGenerated) {
    context += `- Risultati Generati: ${brandVoice.resultsGenerated}\n`;
  }
  if (brandVoice.softwareCreated && brandVoice.softwareCreated.length > 0) {
    context += `- Software Creati: ${brandVoice.softwareCreated.map(s => `${s.emoji} ${s.name} (${s.description})`).join("; ")}\n`;
  }
  if (brandVoice.booksPublished && brandVoice.booksPublished.length > 0) {
    context += `- Libri Pubblicati: ${brandVoice.booksPublished.map(b => `"${b.title}" (${b.year})`).join("; ")}\n`;
  }
  if (brandVoice.caseStudies && brandVoice.caseStudies.length > 0) {
    context += `- Case Studies: ${brandVoice.caseStudies.map(c => `${c.client}: ${c.result}`).join("; ")}\n`;
  }
  if (brandVoice.servicesOffered && brandVoice.servicesOffered.length > 0) {
    context += `- Servizi Offerti:\n${brandVoice.servicesOffered.map(s => `  • ${s.name} (${s.price}): ${s.description}`).join("\n")}\n`;
  }
  if (brandVoice.guarantees) {
    context += `- Garanzie: ${brandVoice.guarantees}\n`;
  }
  
  return context;
}

interface PreviousEmail {
  subject: string;
  body: string;
  dayNumber: number;
}

// Fetch last N templates from database to avoid repetition
async function fetchPreviousEmails(consultantId: string, beforeDay: number, limit: number = 180): Promise<PreviousEmail[]> {
  try {
    const templates = await db
      .select({
        subject: schema.leadNurturingTemplates.subject,
        body: schema.leadNurturingTemplates.body,
        dayNumber: schema.leadNurturingTemplates.dayNumber,
      })
      .from(schema.leadNurturingTemplates)
      .where(
        and(
          eq(schema.leadNurturingTemplates.consultantId, consultantId),
          sql`${schema.leadNurturingTemplates.dayNumber} < ${beforeDay}`
        )
      )
      .orderBy(desc(schema.leadNurturingTemplates.dayNumber))
      .limit(limit);
    
    return templates;
  } catch (error) {
    console.error("[NURTURING GENERATION] Error fetching previous emails:", error);
    return [];
  }
}

async function generateTemplateForDay(
  day: number,
  config: GenerationConfig,
  consultantId: string,
  knowledgeBaseContext: string = "",
  previousEmails: PreviousEmail[] = []
): Promise<{ subject: string; body: string; category: string }> {
  const category = getCategoryForDay(day);
  const categoryDesc = getCategoryDescription(day);
  
  const provider = await getAIProvider(consultantId, consultantId);
  
  const brandVoiceContext = buildBrandVoiceContext(config.brandVoiceData);
  
  const weekInfo = getWeekTheme(day);
  const emailType = getEmailType(day);
  const suggestedCTA = getCTAForDay(day, emailType);
  
  // Build previous emails context for anti-repetition
  let previousEmailsContext = "";
  if (previousEmails.length > 0) {
    previousEmailsContext = `

=== ⚠️ EMAIL PRECEDENTI - VIETATO RIPETERE! ===
Queste email sono GIÀ state inviate. L'email di oggi DEVE essere COMPLETAMENTE DIVERSA.

`;
    // Show ALL subjects from last 180 emails
    previousEmailsContext += `📋 SUBJECT GIÀ USATI (${previousEmails.length} email):\n`;
    for (const prev of previousEmails) {
      previousEmailsContext += `- Giorno ${prev.dayNumber}: "${prev.subject}"\n`;
    }
    
    // Show FULL content of last 5 emails for deeper context
    const recentEmails = previousEmails.slice(0, 5);
    previousEmailsContext += `\n📧 CONTENUTO COMPLETO ULTIME ${recentEmails.length} EMAIL:\n`;
    for (const prev of recentEmails) {
      const bodyText = prev.body.replace(/<[^>]*>/g, ''); // Strip HTML
      previousEmailsContext += `
--- GIORNO ${prev.dayNumber} ---
Subject: "${prev.subject}"
Contenuto:
${bodyText}
---
`;
    }
    
    previousEmailsContext += `
⛔ REGOLE ANTI-RIPETIZIONE PER GIORNO ${day}:
1. Subject COMPLETAMENTE DIVERSO - NON usare parole già presenti nei subject sopra
2. Apertura DIVERSA - Se le email iniziano con "Ciao {{nome}}", usa altro: "{{nome}}," o "Buongiorno," o inizia direttamente col contenuto
3. Argomento NUOVO - Parla di qualcosa NON ancora trattato
4. Struttura DIVERSA - Se le altre usano paragrafi, usa elenchi puntati. Se usano domande, usa affermazioni.
5. Tono VARIATO - Alterna tra formale/informale, diretto/riflessivo
`;
  }
  
  const prompt = `Sei un esperto di email marketing B2C. Genera UN'UNICA email di nurturing per il giorno ${day} di un percorso di 365 giorni.
${previousEmailsContext}

=== TEMA SETTIMANA ${getWeekNumber(day)} ===
Tema: ${weekInfo.theme}
Focus: ${weekInfo.focus}

=== TIPO EMAIL ===
${emailType.icon} ${emailType.type.toUpperCase()}
Obiettivo: ${emailType.description}

=== CTA SUGGERITA ===
${suggestedCTA.template}

=== CONTESTO BUSINESS ===
- Descrizione: ${config.businessDescription}
- Target: ${config.targetAudience}
- Tono: ${config.tone}
- Azienda: ${config.companyName || "{{nomeAzienda}}"}
- Mittente: ${config.senderName || "{{firmaEmail}}"}
${brandVoiceContext}
${knowledgeBaseContext}

=== FASE DEL PERCORSO ===
Categoria: ${category} - ${categoryDesc}

=== ISTRUZIONI SPECIFICHE ===
1. TEMA: L'email DEVE trattare il tema "${weekInfo.theme}" - ${weekInfo.focus}
2. TIPO: Scrivi come email di tipo "${emailType.type}" - ${emailType.description}
3. BRAND VOICE: USA ATTIVAMENTE i dati del brand voice:
   - Se ci sono case study, citane uno specifico con nomi e risultati
   - Se ci sono libri pubblicati, menzionali come prova di autorevolezza
   - Se ci sono software/tool creati, parlane come risorsa
   - Usa i numeri reali (anni esperienza, clienti aiutati, risultati)
4. VARIAZIONE: NON usare frasi generiche. Sii specifico e concreto.
5. CTA: Usa la CTA suggerita: ${suggestedCTA.template}
6. TONO: ${config.tone}

=== VARIABILI DISPONIBILI ===
{{nome}}, {{nomeCompleto}}, {{linkCalendario}}, {{nomeAzienda}}, {{whatsapp}}, {{firmaEmail}}, {{linkUnsubscribe}}, {{giorno}}

=== REGOLE FORMATO ===
1. Subject: max 60 caratteri, accattivante, deve riflettere il tema "${weekInfo.theme}"
2. Body: HTML semplice (p, strong, em, a, ul, li), max 500 parole
3. DEVE includere {{linkUnsubscribe}} nel footer per GDPR
4. NO immagini, NO allegati

=== FORMATO OUTPUT (JSON PURO) ===
IMPORTANTE: Rispondi SOLO con JSON valido. NON scrivere pensieri, ragionamenti o commenti. Solo JSON.
{
  "subject": "Subject max 60 char, deve riflettere il tema ${weekInfo.theme}",
  "body": "<p>HTML email completa...</p><p style='font-size:12px;color:#666;margin-top:30px;'><a href='{{linkUnsubscribe}}'>Disiscriviti</a></p>"
}
Rispondi SOLO con il JSON sopra, nient'altro.`;

  console.log(`[NURTURING GENERATION] Day ${day} - Calling AI with model: ${GEMINI_3_MODEL}`);
  console.log(`[NURTURING GENERATION] Day ${day} - Provider type: ${provider.metadata?.name || 'unknown'}`);
  console.log(`[NURTURING GENERATION] Day ${day} - Prompt length: ${prompt.length} chars`);
  
  let result: any;
  try {
    result = await provider.client.generateContent({
      model: GEMINI_3_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    });
  } catch (apiError: any) {
    console.error(`[NURTURING GENERATION] Day ${day} - API call failed:`, apiError.message);
    console.error(`[NURTURING GENERATION] Day ${day} - Full error:`, JSON.stringify(apiError, null, 2));
    throw apiError;
  }
  
  // Log the full response structure for debugging
  console.log(`[NURTURING GENERATION] Day ${day} - Response keys: ${Object.keys(result || {}).join(', ')}`);
  console.log(`[NURTURING GENERATION] Day ${day} - result.text type: ${typeof result?.text}`);
  console.log(`[NURTURING GENERATION] Day ${day} - result.candidates exists: ${!!result?.candidates}`);
  if (result?.candidates) {
    console.log(`[NURTURING GENERATION] Day ${day} - candidates length: ${result.candidates.length}`);
    if (result.candidates[0]) {
      console.log(`[NURTURING GENERATION] Day ${day} - candidate[0] keys: ${Object.keys(result.candidates[0]).join(', ')}`);
    }
  }
  
  // Extract text from response - handle multiple possible formats
  let text = "";
  if (typeof result?.text === 'string') {
    text = result.text.trim();
    console.log(`[NURTURING GENERATION] Day ${day} - Got text from result.text`);
  } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = result.candidates[0].content.parts[0].text.trim();
    console.log(`[NURTURING GENERATION] Day ${day} - Got text from candidates array`);
  } else if (result?.response?.text) {
    text = typeof result.response.text === 'function' ? result.response.text() : result.response.text;
    text = text?.trim() || "";
    console.log(`[NURTURING GENERATION] Day ${day} - Got text from result.response.text`);
  }
  
  console.log(`[NURTURING GENERATION] Day ${day} - Final text length: ${text.length}`);
  if (text.length > 0 && text.length < 200) {
    console.log(`[NURTURING GENERATION] Day ${day} - Text preview: ${text}`);
  } else if (text.length >= 200) {
    console.log(`[NURTURING GENERATION] Day ${day} - Text preview (first 200): ${text.substring(0, 200)}...`);
  } else {
    console.log(`[NURTURING GENERATION] Day ${day} - WARNING: Empty text response!`);
    console.log(`[NURTURING GENERATION] Day ${day} - Full result:`, JSON.stringify(result, null, 2).substring(0, 1000));
  }
  
  let parsed: { subject: string; body: string };
  try {
    // Remove markdown code blocks more aggressively
    let cleanText = text;
    
    // Remove ```json or ``` at start
    cleanText = cleanText.replace(/^```json\s*/i, '');
    cleanText = cleanText.replace(/^```\s*/i, '');
    
    // Remove ``` at end
    cleanText = cleanText.replace(/```\s*$/i, '');
    
    // Also handle inline code blocks
    cleanText = cleanText.replace(/```json\n?/gi, '');
    cleanText = cleanText.replace(/```\n?/gi, '');
    
    cleanText = cleanText.trim();
    
    console.log(`[NURTURING GENERATION] Day ${day} - Clean text preview: ${cleanText.substring(0, 100)}...`);
    
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[NURTURING GENERATION] Day ${day} - No JSON found after cleanup. Clean text: ${cleanText.substring(0, 300)}`);
      throw new Error("No JSON found in response");
    }
    parsed = JSON.parse(jsonMatch[0]);
    console.log(`[NURTURING GENERATION] Day ${day} - Successfully parsed JSON with subject: "${parsed.subject?.substring(0, 50)}..."`);
  } catch (e: any) {
    console.error(`[NURTURING GENERATION] Failed to parse response for day ${day}:`, e.message);
    console.error(`[NURTURING GENERATION] Raw text (first 500):`, text.substring(0, 500));
    parsed = {
      subject: `Giorno ${day}: Un messaggio per te, {{nome}}`,
      body: `<p>Ciao {{nome}},</p><p>Ecco il tuo aggiornamento del giorno ${day}.</p><p>{{firmaEmail}}</p><p style="font-size:12px;color:#666;margin-top:30px;">Non vuoi più ricevere queste email? <a href="{{linkUnsubscribe}}">Disiscriviti qui</a></p>`,
    };
  }
  
  return {
    subject: parsed.subject || `Giorno ${day}: {{nome}}, un messaggio per te`,
    body: parsed.body || "",
    category,
  };
}

export async function generateNurturingTemplates(
  config: GenerationConfig,
  res?: Response
): Promise<{ success: boolean; generated: number; errors: string[] }> {
  const { consultantId } = config;
  const errors: string[] = [];
  let generated = 0;
  
  console.log(`[NURTURING GENERATION] Starting generation for consultant ${consultantId}`);
  
  const sendProgress = (progress: GenerationProgress) => {
    if (res && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    }
  };
  
  try {
    await db.delete(schema.leadNurturingTemplates)
      .where(eq(schema.leadNurturingTemplates.consultantId, consultantId));
    
    console.log(`[NURTURING GENERATION] Cleared existing templates for consultant ${consultantId}`);
    
    const knowledgeBaseContext = await fetchNurturingKnowledgeItems(consultantId);
    console.log(`[NURTURING GENERATION] Loaded KB context: ${knowledgeBaseContext ? 'yes' : 'no'} (${knowledgeBaseContext.length} chars)`);
    
    const days = Array.from({ length: 365 }, (_, i) => i + 1);
    
    for (let i = 0; i < days.length; i += BATCH_SIZE) {
      const batch = days.slice(i, i + BATCH_SIZE);
      
      sendProgress({
        total: 365,
        completed: generated,
        current: batch[0],
        category: getCategoryForDay(batch[0]),
        status: "running",
      });
      
      const batchPromises = batch.map(async (day) => {
        try {
          const template = await generateTemplateForDay(day, config, consultantId, knowledgeBaseContext);
          
          await db.insert(schema.leadNurturingTemplates).values({
            consultantId,
            dayNumber: day,
            subject: template.subject,
            body: template.body,
            category: template.category,
            isActive: true,
          });
          
          return { day, success: true };
        } catch (error: any) {
          console.error(`[NURTURING GENERATION] Error generating day ${day}:`, error.message);
          errors.push(`Giorno ${day}: ${error.message}`);
          return { day, success: false };
        }
      });
      
      const results = await Promise.all(batchPromises);
      const successCount = results.filter(r => r.success).length;
      generated += successCount;
      
      console.log(`[NURTURING GENERATION] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${successCount}/${batch.length} templates generated`);
      
      if (i + BATCH_SIZE < days.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }
    
    sendProgress({
      total: 365,
      completed: generated,
      current: 365,
      category: "completed",
      status: "completed",
    });
    
    console.log(`[NURTURING GENERATION] Completed: ${generated}/365 templates generated`);
    
    return { success: true, generated, errors };
    
  } catch (error: any) {
    console.error(`[NURTURING GENERATION] Fatal error:`, error);
    
    sendProgress({
      total: 365,
      completed: generated,
      current: 0,
      category: "error",
      status: "error",
      error: error.message,
    });
    
    return { success: false, generated, errors: [...errors, error.message] };
  }
}

export async function regenerateTemplate(
  consultantId: string,
  dayNumber: number,
  config: GenerationConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // Carica anche il knowledge base context per la rigenerazione
    const knowledgeBaseContext = await fetchNurturingKnowledgeItems(consultantId);
    const template = await generateTemplateForDay(dayNumber, config, consultantId, knowledgeBaseContext);
    
    const existing = await db.select()
      .from(schema.leadNurturingTemplates)
      .where(
        and(
          eq(schema.leadNurturingTemplates.consultantId, consultantId),
          eq(schema.leadNurturingTemplates.dayNumber, dayNumber)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(schema.leadNurturingTemplates)
        .set({
          subject: template.subject,
          body: template.body,
          category: template.category,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.leadNurturingTemplates.consultantId, consultantId),
            eq(schema.leadNurturingTemplates.dayNumber, dayNumber)
          )
        );
    } else {
      await db.insert(schema.leadNurturingTemplates).values({
        consultantId,
        dayNumber,
        subject: template.subject,
        body: template.body,
        category: template.category,
        isActive: true,
      });
    }
    
    return { success: true };
  } catch (error: any) {
    console.error(`[NURTURING GENERATION] Error regenerating day ${dayNumber}:`, error);
    return { success: false, error: error.message };
  }
}

export async function getTemplateCount(consultantId: string): Promise<number> {
  const result = await db.select()
    .from(schema.leadNurturingTemplates)
    .where(eq(schema.leadNurturingTemplates.consultantId, consultantId));
  return result.length;
}

export async function generatePreviewTemplate(
  config: GenerationConfig
): Promise<{ success: boolean; template?: { subject: string; body: string; category: string; dayNumber: number }; error?: string }> {
  try {
    const { consultantId } = config;
    console.log(`[NURTURING GENERATION] Generating preview template for consultant ${consultantId}`);
    
    const knowledgeBaseContext = await fetchNurturingKnowledgeItems(consultantId);
    const template = await generateTemplateForDay(1, config, consultantId, knowledgeBaseContext);
    
    return {
      success: true,
      template: {
        ...template,
        dayNumber: 1,
      },
    };
  } catch (error: any) {
    console.error("[NURTURING GENERATION] Error generating preview:", error);
    return { success: false, error: error.message };
  }
}

export async function generateRemainingTemplates(
  config: GenerationConfig,
  startFromDay: number = 2,
  res?: Response
): Promise<{ success: boolean; generated: number; errors: string[] }> {
  const { consultantId } = config;
  const errors: string[] = [];
  let generated = 0;
  
  console.log(`[NURTURING GENERATION] Starting generation from day ${startFromDay} for consultant ${consultantId}`);
  
  const sendProgress = (progress: GenerationProgress) => {
    if (res && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    }
  };
  
  try {
    const knowledgeBaseContext = await fetchNurturingKnowledgeItems(consultantId);
    
    const days = Array.from({ length: 365 - startFromDay + 1 }, (_, i) => i + startFromDay);
    const totalDays = days.length;
    
    for (let i = 0; i < days.length; i += BATCH_SIZE) {
      const batch = days.slice(i, i + BATCH_SIZE);
      
      sendProgress({
        total: totalDays,
        completed: generated,
        current: batch[0],
        category: getCategoryForDay(batch[0]),
        status: "running",
      });
      
      const batchPromises = batch.map(async (day) => {
        try {
          const template = await generateTemplateForDay(day, config, consultantId, knowledgeBaseContext);
          
          await db.insert(schema.leadNurturingTemplates).values({
            consultantId,
            dayNumber: day,
            subject: template.subject,
            body: template.body,
            category: template.category,
            isActive: true,
          });
          
          return { success: true, day };
        } catch (error: any) {
          console.error(`[NURTURING GENERATION] Error generating day ${day}:`, error.message);
          return { success: false, day, error: error.message };
        }
      });
      
      const results = await Promise.all(batchPromises);
      
      for (const result of results) {
        if (result.success) {
          generated++;
        } else {
          errors.push(`Day ${result.day}: ${result.error}`);
        }
      }
      
      if (i + BATCH_SIZE < days.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }
    
    await db.update(schema.leadNurturingConfig)
      .set({
        templatesGenerated: generated + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.leadNurturingConfig.consultantId, consultantId));
    
    console.log(`[NURTURING GENERATION] Completed: ${generated} templates generated`);
    
    sendProgress({
      total: totalDays,
      completed: generated,
      current: 365,
      category: "completed",
      status: "completed",
    });
    
    return { success: true, generated, errors };
  } catch (error: any) {
    console.error("[NURTURING GENERATION] Fatal error:", error);
    
    sendProgress({
      total: 365,
      completed: generated,
      current: 0,
      category: "error",
      status: "error",
      error: error.message,
    });
    
    return { success: false, generated, errors: [...errors, error.message] };
  }
}

// NEW: Get generation status - how many templates exist and next day to generate
// Fixed: Now properly detects gaps in day sequence instead of just using lastGeneratedDay + 1
export async function getGenerationStatus(consultantId: string): Promise<{
  totalGenerated: number;
  nextDay: number;
  isComplete: boolean;
  lastGeneratedDay: number;
  missingDays: number;
}> {
  const templates = await db.select({ dayNumber: schema.leadNurturingTemplates.dayNumber })
    .from(schema.leadNurturingTemplates)
    .where(eq(schema.leadNurturingTemplates.consultantId, consultantId))
    .orderBy(asc(schema.leadNurturingTemplates.dayNumber));
  
  const totalGenerated = templates.length;
  const lastGeneratedDay = templates.length > 0 ? Math.max(...templates.map(t => t.dayNumber)) : 0;
  
  // Create a set of existing day numbers for O(1) lookup
  const existingDays = new Set(templates.map(t => t.dayNumber));
  
  // Find the first missing day by scanning from 1 to 365
  let nextDay = 366; // Default: all complete
  let missingDays = 0;
  
  for (let day = 1; day <= 365; day++) {
    if (!existingDays.has(day)) {
      if (nextDay === 366) {
        nextDay = day; // First missing day
      }
      missingDays++;
    }
  }
  
  const isComplete = missingDays === 0;
  
  return { totalGenerated, nextDay, isComplete, lastGeneratedDay, missingDays };
}

export interface TemplateGeneratedCallback {
  (template: { dayNumber: number; subject: string; body: string; category: string }, progress: { current: number; total: number }): void;
}

// NEW: Generate a block of 7 days (one week) with optional streaming callback
export async function generateWeekBlock(
  config: GenerationConfig,
  startDay: number,
  onTemplateGenerated?: TemplateGeneratedCallback
): Promise<{ 
  success: boolean; 
  generated: number; 
  templates: { dayNumber: number; subject: string; body: string; category: string }[];
  nextDay: number;
  isComplete: boolean;
  errors: string[];
}> {
  const { consultantId } = config;
  const WEEK_SIZE = 7;
  const errors: string[] = [];
  const generatedTemplates: { dayNumber: number; subject: string; body: string; category: string }[] = [];
  
  // Calculate end day (don't go past 365)
  const endDay = Math.min(startDay + WEEK_SIZE - 1, 365);
  const days = Array.from({ length: endDay - startDay + 1 }, (_, i) => i + startDay);
  const totalDays = days.length;
  
  console.log(`[NURTURING GENERATION] Generating week block: days ${startDay}-${endDay} for consultant ${consultantId}`);
  
  try {
    const knowledgeBaseContext = await fetchNurturingKnowledgeItems(consultantId);
    
    // Generate templates sequentially to avoid rate limits
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      try {
        // Fetch last 180 emails to avoid repetition
        const previousEmails = await fetchPreviousEmails(consultantId, day, 180);
        console.log(`[NURTURING GENERATION] Day ${day} - Loaded ${previousEmails.length} previous emails for anti-repetition`);
        
        const template = await generateTemplateForDay(day, config, consultantId, knowledgeBaseContext, previousEmails);
        
        // Check if template already exists
        const existing = await db.select()
          .from(schema.leadNurturingTemplates)
          .where(
            and(
              eq(schema.leadNurturingTemplates.consultantId, consultantId),
              eq(schema.leadNurturingTemplates.dayNumber, day)
            )
          );
        
        if (existing.length > 0) {
          // Update existing
          await db.update(schema.leadNurturingTemplates)
            .set({
              subject: template.subject,
              body: template.body,
              category: template.category,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.leadNurturingTemplates.consultantId, consultantId),
                eq(schema.leadNurturingTemplates.dayNumber, day)
              )
            );
        } else {
          // Insert new
          await db.insert(schema.leadNurturingTemplates).values({
            consultantId,
            dayNumber: day,
            subject: template.subject,
            body: template.body,
            category: template.category,
            isActive: true,
          });
        }
        
        const templateData = {
          dayNumber: day,
          subject: template.subject,
          body: template.body,
          category: template.category,
        };
        
        generatedTemplates.push(templateData);
        
        console.log(`[NURTURING GENERATION] Day ${day} saved successfully`);
        
        // Call the callback to stream progress to client
        if (onTemplateGenerated) {
          onTemplateGenerated(templateData, { current: i + 1, total: totalDays });
        }
        
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`[NURTURING GENERATION] Error generating day ${day}:`, error.message);
        errors.push(`Day ${day}: ${error.message}`);
      }
    }
    
    // Update config with new count
    const status = await getGenerationStatus(consultantId);
    await db.update(schema.leadNurturingConfig)
      .set({
        templatesGenerated: true, // boolean flag
        templatesCount: status.totalGenerated, // actual count (integer)
        templatesGeneratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.leadNurturingConfig.consultantId, consultantId));
    
    console.log(`[NURTURING GENERATION] Week block complete: ${generatedTemplates.length} templates generated`);
    
    // Fixed: Return success: false if any day failed
    const hasErrors = errors.length > 0;
    
    return {
      success: !hasErrors,
      generated: generatedTemplates.length,
      templates: generatedTemplates,
      nextDay: status.nextDay,
      isComplete: status.isComplete,
      errors,
    };
  } catch (error: any) {
    console.error("[NURTURING GENERATION] Fatal error in week block:", error);
    return {
      success: false,
      generated: generatedTemplates.length,
      templates: generatedTemplates,
      nextDay: startDay + generatedTemplates.length,
      isComplete: false,
      errors: [...errors, error.message],
    };
  }
}

// ============================================================
// TOPICS OUTLINE GENERATION
// ============================================================

export async function generateTopicsOutline(
  consultantId: string,
  brandVoiceData: BrandVoiceData,
  res?: Response
): Promise<{ success: boolean; generated: number; errors: string[] }> {
  console.log(`[TOPICS GENERATION] Starting outline generation for consultant ${consultantId}`);
  
  const errors: string[] = [];
  let generated = 0;
  
  try {
    // Delete existing topics for this consultant
    await db.delete(schema.leadNurturingTopics)
      .where(eq(schema.leadNurturingTopics.consultantId, consultantId));
    
    console.log("[TOPICS GENERATION] Deleted existing topics");
    
    // Get AI provider
    const provider = await getAIProvider(consultantId, consultantId);
    
    // Build brand context
    let brandContext = "";
    if (brandVoiceData) {
      if (brandVoiceData.businessName) brandContext += `\nBusiness: ${brandVoiceData.businessName}`;
      if (brandVoiceData.businessDescription) brandContext += `\nDescrizione: ${brandVoiceData.businessDescription}`;
      if (brandVoiceData.whoWeHelp) brandContext += `\nTarget: ${brandVoiceData.whoWeHelp}`;
      if (brandVoiceData.whatWeDo) brandContext += `\nServizi: ${brandVoiceData.whatWeDo}`;
      if (brandVoiceData.caseStudies?.length) {
        brandContext += `\nCase Studies disponibili: ${brandVoiceData.caseStudies.map(c => c.client).join(", ")}`;
      }
    }
    
    // Generate topics in batches (50 at a time for better quality)
    const BATCH_SIZE = 50;
    const TOTAL_DAYS = 365;
    
    for (let batchStart = 1; batchStart <= TOTAL_DAYS; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, TOTAL_DAYS);
      const daysInBatch = batchEnd - batchStart + 1;
      
      console.log(`[TOPICS GENERATION] Generating batch: days ${batchStart}-${batchEnd}`);
      
      // Send SSE progress if response available
      if (res && !res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }
      if (res) {
        res.write(`data: ${JSON.stringify({ 
          type: 'progress', 
          current: batchStart, 
          total: TOTAL_DAYS,
          message: `Generando argomenti ${batchStart}-${batchEnd}...`
        })}\n\n`);
      }
      
      // Get previously generated topics for context (avoid repetition)
      const previousTopics = await db.select()
        .from(schema.leadNurturingTopics)
        .where(eq(schema.leadNurturingTopics.consultantId, consultantId))
        .orderBy(asc(schema.leadNurturingTopics.day));
      
      let previousContext = "";
      if (previousTopics.length > 0) {
        previousContext = `\n\n=== ARGOMENTI GIÀ GENERATI (NON RIPETERE) ===\n`;
        previousContext += previousTopics.map(t => `Giorno ${t.day}: ${t.title}`).join("\n");
      }
      
      const prompt = `Sei un esperto di email marketing. Genera gli ARGOMENTI (solo titoli e brevi descrizioni) per le email dal giorno ${batchStart} al giorno ${batchEnd} di un percorso di 365 giorni.

CONTESTO BUSINESS:${brandContext || "\nConsulente professionale italiano"}
${previousContext}

REGOLE:
1. Ogni email deve dare VALORE e FORMAZIONE
2. Tutte le email portano verso un appuntamento WhatsApp
3. Il giorno 1 è l'UNICA presentazione - mai più ripetere chi sei
4. Progressione logica come un libro: ogni giorno si costruisce sul precedente
5. Varietà: alterna storie, consigli pratici, errori comuni, case study, domande
6. MAI ripetere argomenti già generati
7. Argomenti specifici e concreti, non generici

FORMATO OUTPUT (JSON array):
[
  {"day": ${batchStart}, "title": "Titolo conciso dell'argomento", "description": "Una frase che descrive cosa tratta l'email"},
  ...
]

Genera ESATTAMENTE ${daysInBatch} argomenti per i giorni ${batchStart}-${batchEnd}. Rispondi SOLO con il JSON array.`;

      try {
        const result = await provider.client.generateContent({
          model: GEMINI_3_MODEL,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 8192,
          },
        });
        
        // Extract text
        let text = "";
        if (typeof result?.text === 'string') {
          text = result.text.trim();
        } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
          text = result.candidates[0].content.parts[0].text.trim();
        } else if (result?.response?.text) {
          text = typeof result.response.text === 'function' ? result.response.text() : result.response.text;
          text = text?.trim() || "";
        }
        
        // Clean markdown
        text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
        
        // Parse JSON array
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error(`[TOPICS GENERATION] No JSON array found for batch ${batchStart}-${batchEnd}`);
          errors.push(`Batch ${batchStart}-${batchEnd}: No JSON array found`);
          continue;
        }
        
        const topics = JSON.parse(jsonMatch[0]);
        
        // Insert topics into database
        for (const topic of topics) {
          if (topic.day && topic.title) {
            await db.insert(schema.leadNurturingTopics)
              .values({
                consultantId,
                day: topic.day,
                title: topic.title,
                description: topic.description || null,
              })
              .onConflictDoUpdate({
                target: [schema.leadNurturingTopics.consultantId, schema.leadNurturingTopics.day],
                set: {
                  title: topic.title,
                  description: topic.description || null,
                  updatedAt: new Date(),
                },
              });
            generated++;
          }
        }
        
        console.log(`[TOPICS GENERATION] Batch ${batchStart}-${batchEnd}: ${topics.length} topics saved`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (batchError: any) {
        console.error(`[TOPICS GENERATION] Error in batch ${batchStart}-${batchEnd}:`, batchError.message);
        errors.push(`Batch ${batchStart}-${batchEnd}: ${batchError.message}`);
      }
    }
    
    // Send completion
    if (res) {
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        generated,
        errors 
      })}\n\n`);
      res.end();
    }
    
    console.log(`[TOPICS GENERATION] Complete: ${generated} topics generated, ${errors.length} errors`);
    
    return { success: errors.length === 0, generated, errors };
    
  } catch (error: any) {
    console.error("[TOPICS GENERATION] Fatal error:", error);
    errors.push(error.message);
    
    if (res) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
    
    return { success: false, generated, errors };
  }
}
