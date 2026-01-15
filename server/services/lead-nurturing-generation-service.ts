import { db } from "../db";
import { eq, and, asc } from "drizzle-orm";
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

async function generateTemplateForDay(
  day: number,
  config: GenerationConfig,
  consultantId: string,
  knowledgeBaseContext: string = ""
): Promise<{ subject: string; body: string; category: string }> {
  const category = getCategoryForDay(day);
  const categoryDesc = getCategoryDescription(day);
  
  const provider = await getAIProvider(consultantId, consultantId);
  
  const brandVoiceContext = buildBrandVoiceContext(config.brandVoiceData);
  
  const prompt = `Sei un esperto di email marketing B2C. Genera UN'UNICA email di nurturing per il giorno ${day} di un percorso di 365 giorni.

CONTESTO BUSINESS:
- Descrizione: ${config.businessDescription}
- Target: ${config.targetAudience}
- Tono: ${config.tone}
- Azienda: ${config.companyName || "{{nomeAzienda}}"}
- Mittente: ${config.senderName || "{{firmaEmail}}"}
${brandVoiceContext}${knowledgeBaseContext}
CATEGORIA EMAIL (Giorno ${day}): ${categoryDesc}
- Fase del percorso: ${category}
- Obiettivo fase: ${categoryDesc}

VARIABILI DISPONIBILI (usa esattamente questi placeholder):
- {{nome}} - Nome del destinatario
- {{nomeCompleto}} - Nome e cognome
- {{linkCalendario}} - Link per prenotare consulenza
- {{nomeAzienda}} - Nome dell'azienda
- {{whatsapp}} - Numero WhatsApp
- {{firmaEmail}} - Firma del consulente
- {{linkUnsubscribe}} - Link per disiscriversi (OBBLIGATORIO nel footer)
- {{giorno}} - Giorno corrente del percorso

REGOLE:
1. Subject: max 60 caratteri, accattivante, può usare {{nome}}
2. Body: HTML semplice (p, strong, em, a, ul, li), max 500 parole
3. DEVE includere {{linkUnsubscribe}} nel footer per GDPR
4. Tono: ${config.tone}
5. CTA chiara verso {{linkCalendario}} o {{whatsapp}}
6. NO immagini, NO allegati

RISPONDI IN QUESTO FORMATO ESATTO (JSON):
{
  "subject": "Subject dell'email qui",
  "body": "<p>Corpo HTML dell'email qui...</p><p style='font-size:12px;color:#666;margin-top:30px;'>Non vuoi più ricevere queste email? <a href='{{linkUnsubscribe}}'>Disiscriviti qui</a></p>"
}`;

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
        maxOutputTokens: 2048,
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
    // Remove markdown code blocks if present
    let cleanText = text;
    if (cleanText.includes('```json')) {
      cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    } else if (cleanText.includes('```')) {
      cleanText = cleanText.replace(/```\s*/g, '');
    }
    
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[NURTURING GENERATION] Day ${day} - No JSON found after cleanup. Clean text: ${cleanText.substring(0, 300)}`);
      throw new Error("No JSON found in response");
    }
    parsed = JSON.parse(jsonMatch[0]);
    console.log(`[NURTURING GENERATION] Day ${day} - Successfully parsed JSON with subject: "${parsed.subject?.substring(0, 50)}..."`);
  } catch (e) {
    console.error(`[NURTURING GENERATION] Failed to parse response for day ${day}:`, text.substring(0, 200));
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
