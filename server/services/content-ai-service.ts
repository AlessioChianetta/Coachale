import { getAIProvider, getModelWithThinking, GEMINI_3_MODEL } from "../ai/provider-factory";
import { db } from "../db";
import { brandAssets } from "@shared/schema";
import { eq } from "drizzle-orm";

export type ContentType = "post" | "carosello" | "reel" | "video" | "story" | "articolo";
export type ContentObjective = "awareness" | "engagement" | "leads" | "sales" | "education";
export type Platform = "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "twitter";
export type ImageStyle = "realistic" | "illustration" | "minimal" | "bold" | "professional" | "playful";

export type AwarenessLevel = "unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware";

export interface GenerateIdeasParams {
  consultantId: string;
  niche: string;
  targetAudience: string;
  objective: ContentObjective | "authority";
  additionalContext?: string;
  count?: number;
  mediaType?: "video" | "photo";
  copyType?: "short" | "long";
  awarenessLevel?: AwarenessLevel;
}

export interface StructuredCopyShort {
  type: "copy_short";
  hook: string;
  body: string;
  cta: string;
  hashtags?: string[];
  imageDescription?: string;
  imageOverlayText?: string;
}

export interface StructuredCopyLong {
  type: "copy_long";
  hook: string;
  chiCosaCome: string;
  errore: string;
  soluzione: string;
  riprovaSociale: string;
  cta: string;
  hashtags?: string[];
  imageDescription?: string;
  imageOverlayText?: string;
}

export interface StructuredVideoScript {
  type: "video_script";
  hook: string;
  problema: string;
  soluzione: string;
  cta: string;
  fullScript: string;
  hashtags?: string[];
}

export interface StructuredImageCopy {
  type: "image_copy";
  imageText: string;
  subtitle: string;
  conceptDescription: string;
  hashtags?: string[];
}

export type StructuredContent = StructuredCopyShort | StructuredCopyLong | StructuredVideoScript | StructuredImageCopy;

export interface ContentIdea {
  title: string;
  description: string;
  aiScore: number;
  aiReasoning: string;
  suggestedHook: string;
  suggestedCta: string;
  videoScript?: string;
  imageDescription?: string;
  imageOverlayText?: string;
  copyContent?: string;
  mediaType?: "video" | "photo";
  copyType?: "short" | "long";
  structuredContent?: StructuredContent;
}

export interface GenerateIdeasResult {
  ideas: ContentIdea[];
  modelUsed: string;
  tokensUsed?: number;
}

export interface GeneratePostCopyParams {
  consultantId: string;
  idea: string;
  platform: Platform;
  brandVoice?: string;
  keywords?: string[];
  tone?: string;
  maxLength?: number;
}

export interface PostCopy {
  hook: string;
  target: string;
  problem: string;
  solution: string;
  proof: string;
  cta: string;
  fullCopy: string;
  hashtags?: string[];
  emojiLevel?: "none" | "minimal" | "moderate" | "heavy";
}

export interface GeneratePostCopyResult {
  copy: PostCopy;
  modelUsed: string;
  tokensUsed?: number;
}

export interface GenerateCampaignParams {
  consultantId: string;
  productOrService: string;
  targetAudience: string;
  objective: ContentObjective;
  budget?: string;
  duration?: string;
  uniqueSellingPoints?: string[];
  brandVoice?: string;
}

export interface CampaignHook {
  who: string;
  what: string;
  how: string;
  copy: string;
}

export interface CampaignTarget {
  demographics: {
    ageRange: string;
    gender: string;
    location: string;
    language: string;
  };
  interests: string[];
  behaviors: string[];
}

export interface CampaignProblem {
  mainProblem: string;
  consequences: string[];
  emotionalImpact: string;
}

export interface CampaignSolution {
  offer: string;
  benefits: string[];
  differentiators: string[];
}

export interface CampaignProof {
  testimonialStructure: string;
  numbers: string[];
  socialProof: string[];
}

export interface CampaignCTA {
  text: string;
  urgency: string;
  secondaryCta?: string;
}

export interface CampaignContent {
  hook: CampaignHook;
  target: CampaignTarget;
  problem: CampaignProblem;
  solution: CampaignSolution;
  proof: CampaignProof;
  cta: CampaignCTA;
  adCreative: {
    primaryText: string;
    headline: string;
    description: string;
  };
}

export interface GenerateCampaignResult {
  campaign: CampaignContent;
  modelUsed: string;
  tokensUsed?: number;
}

export interface GenerateImagePromptParams {
  consultantId: string;
  contentDescription: string;
  brandColors?: string[];
  style: ImageStyle;
  platform: Platform;
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
  mood?: string;
  includeText?: boolean;
  textToInclude?: string;
}

export interface ImagePromptResult {
  prompt: string;
  negativePrompt: string;
  styleNotes: string;
  technicalSpecs: {
    aspectRatio: string;
    resolution: string;
    format: string;
  };
  modelUsed: string;
}

const lastCallTimestamps: Map<string, number> = new Map();
const MIN_CALL_INTERVAL_MS = 1000;

async function rateLimitCheck(consultantId: string): Promise<void> {
  const lastCall = lastCallTimestamps.get(consultantId) || 0;
  const now = Date.now();
  const timeSinceLastCall = now - lastCall;
  
  if (timeSinceLastCall < MIN_CALL_INTERVAL_MS) {
    const waitTime = MIN_CALL_INTERVAL_MS - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastCallTimestamps.set(consultantId, Date.now());
}

async function getBrandAssets(consultantId: string) {
  try {
    const [assets] = await db.select()
      .from(brandAssets)
      .where(eq(brandAssets.consultantId, consultantId))
      .limit(1);
    return assets || null;
  } catch (error) {
    console.error("[CONTENT-AI] Error fetching brand assets:", error);
    return null;
  }
}

function parseJsonResponse<T>(text: string, fallback: T): T {
  // Step 1: Basic cleanup
  let cleanedText = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  
  // Step 2: Try direct parse first
  try {
    return JSON.parse(cleanedText) as T;
  } catch (firstError) {
    console.log("[CONTENT-AI] Direct parse failed, trying cleanup strategies...");
  }
  
  // Step 3: Fix unescaped newlines inside string values
  try {
    const escapedText = cleanedText.replace(
      /"([^"\\]*(?:\\.[^"\\]*)*)"/g,
      (match) => {
        return match
          .replace(/\r\n/g, '\\n')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\n')
          .replace(/\t/g, '\\t');
      }
    );
    return JSON.parse(escapedText) as T;
  } catch {
    console.log("[CONTENT-AI] Escaped newlines parse failed, trying truncation repair...");
  }
  
  // Step 4: Handle truncated JSON (response cut off mid-stream)
  try {
    let repairedText = cleanedText;
    
    // Count open braces/brackets
    const openBraces = (repairedText.match(/{/g) || []).length;
    const closeBraces = (repairedText.match(/}/g) || []).length;
    const openBrackets = (repairedText.match(/\[/g) || []).length;
    const closeBrackets = (repairedText.match(/]/g) || []).length;
    
    // If truncated (more opens than closes), try to repair
    if (openBraces > closeBraces || openBrackets > closeBrackets) {
      console.log(`[CONTENT-AI] Detected truncation: braces ${openBraces}/${closeBraces}, brackets ${openBrackets}/${closeBrackets}`);
      
      // Find last complete object in ideas array
      const ideasMatch = repairedText.match(/"ideas"\s*:\s*\[/);
      if (ideasMatch) {
        // Find all complete idea objects
        const ideaObjects: string[] = [];
        let depth = 0;
        let currentStart = -1;
        let inString = false;
        let escapeNext = false;
        
        const startIdx = repairedText.indexOf('[', ideasMatch.index || 0);
        
        for (let i = startIdx + 1; i < repairedText.length; i++) {
          const char = repairedText[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (inString) continue;
          
          if (char === '{') {
            if (depth === 0) currentStart = i;
            depth++;
          } else if (char === '}') {
            depth--;
            if (depth === 0 && currentStart !== -1) {
              ideaObjects.push(repairedText.substring(currentStart, i + 1));
              currentStart = -1;
            }
          }
        }
        
        if (ideaObjects.length > 0) {
          console.log(`[CONTENT-AI] Extracted ${ideaObjects.length} complete idea objects from truncated response`);
          const reconstructed = `{"ideas": [${ideaObjects.join(',')}]}`;
          return JSON.parse(reconstructed) as T;
        }
      }
    }
  } catch (repairError) {
    console.log("[CONTENT-AI] Truncation repair failed:", repairError);
  }
  
  // Step 5: Final aggressive cleanup
  try {
    let aggressiveClean = cleanedText
      .replace(/(?<!\\)\n/g, '\\n')
      .replace(/(?<!\\)\r/g, '')
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
    
    return JSON.parse(aggressiveClean) as T;
  } catch {
    console.error("[CONTENT-AI] All parsing strategies failed, returning fallback");
    console.error("[CONTENT-AI] Raw text (first 800 chars):", text.substring(0, 800));
    return fallback;
  }
}

const AWARENESS_LEVEL_INSTRUCTIONS: Record<AwarenessLevel, { name: string; strategy: string; tone: string; focus: string }> = {
  unaware: {
    name: "Non Consapevole",
    strategy: "Il pubblico NON sa di avere un problema. Devi risvegliare la consapevolezza con contenuti che fanno riflettere, storie di trasformazione, e 'aha moments' che illuminano un problema nascosto.",
    tone: "Curioso, provocatorio, educativo, storytelling",
    focus: "Fai emergere il problema che non sanno di avere. Usa domande retoriche, statistiche sorprendenti, storie di chi era nella stessa situazione."
  },
  problem_aware: {
    name: "Consapevole del Problema",
    strategy: "Il pubblico SENTE un disagio ma non conosce soluzioni. Devi amplificare il dolore, validare i loro sentimenti, e introdurre l'idea che esiste una via d'uscita.",
    tone: "Empatico, comprensivo, agitante, speranzoso",
    focus: "Valida il problema, amplifica le conseguenze di non risolverlo, accenna che una soluzione esiste. Usa 'Anche tu ti senti così?' e 'Sai cosa significa quando...'."
  },
  solution_aware: {
    name: "Consapevole della Soluzione",
    strategy: "Il pubblico conosce le soluzioni ma NON la tua. Devi differenziarti dalla concorrenza, mostrare il tuo approccio unico, e posizionarti come la scelta migliore.",
    tone: "Autoritario, differenziante, educativo, comparativo",
    focus: "Evidenzia cosa rende il tuo metodo/prodotto DIVERSO. Usa case study, confronti (senza nominare competitor), e il tuo Unique Selling Point."
  },
  product_aware: {
    name: "Consapevole del Prodotto",
    strategy: "Il pubblico conosce il tuo prodotto ma NON è ancora convinto. Devi rimuovere obiezioni, costruire fiducia, e mostrare prove sociali concrete.",
    tone: "Rassicurante, testimonial-driven, FAQ-style, trust-building",
    focus: "Rispondi alle obiezioni comuni, mostra testimonianze e risultati, offri garanzie. Usa 'Ecco cosa dicono i clienti...' e 'La domanda più comune è...'."
  },
  most_aware: {
    name: "Più Consapevole (Pronto all'Acquisto)",
    strategy: "Il pubblico DESIDERA il tuo prodotto e aspetta l'offerta giusta. Devi creare urgenza, presentare offerte irresistibili, e facilitare l'azione immediata.",
    tone: "Urgente, diretto, offerta-focused, action-oriented",
    focus: "Crea scarsità e urgenza, presenta offerte speciali, bonus esclusivi, deadline. Usa 'Solo per oggi...', 'Ultimi posti...', 'Bonus esclusivo se agisci ora...'."
  }
};

export async function generateContentIdeas(params: GenerateIdeasParams): Promise<GenerateIdeasResult> {
  const { consultantId, niche, targetAudience, objective, additionalContext, count = 3, mediaType = "photo", copyType = "short", awarenessLevel = "problem_aware" } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const brandContext = assets ? `
Brand Voice: ${assets.brandVoice || 'professional'}
Tono: ${assets.toneOfVoice || 'friendly professional'}
Colori: ${JSON.stringify(assets.primaryColors || [])}
` : '';

  const awarenessInfo = AWARENESS_LEVEL_INSTRUCTIONS[awarenessLevel];

  const getStructuredContentInstructions = () => {
    const imageFields = mediaType === "photo" ? `,
  "imageDescription": "Descrizione visiva dettagliata dell'immagine: soggetto, sfondo, colori, mood, stile fotografico",
  "imageOverlayText": "Testo breve e d'impatto da sovrapporre all'immagine (max 10 parole)"` : "";
    
    if (mediaType === "video") {
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "video_script",
  "hook": "La prima frase che cattura attenzione (3-5 secondi)",
  "problema": "Il problema che stai risolvendo (10-15 secondi)", 
  "soluzione": "Come risolvi il problema (15-20 secondi)",
  "cta": "Call to action finale (5-10 secondi)",
  "fullScript": "Lo script completo parlato fluido da registrare",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}
Lo script DEVE essere scritto per essere DETTO A VOCE, frasi corte e incisive.`;
    } else if (copyType === "long") {
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "copy_long",
  "hook": "La prima frase che ferma lo scroll - provocatoria, curiosa, o scioccante",
  "chiCosaCome": "Aiuto [CHI] a [FARE COSA] attraverso [COME] - il tuo posizionamento",
  "errore": "L'errore comune che il tuo target sta commettendo senza saperlo",
  "soluzione": "La tua soluzione unica al problema - cosa offri e perché funziona",
  "riprovaSociale": "Testimonianze, risultati, numeri che provano il valore",
  "cta": "Call to action finale chiara e urgente",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]${imageFields}
}
Ogni blocco deve essere narrativo, emotivo, con emoji moderati. Separa i pensieri all'interno di ogni blocco con ㅤ.`;
    } else {
      return `
**structuredContent** (OBBLIGATORIO - oggetto JSON):
{
  "type": "copy_short",
  "hook": "La prima frase d'impatto che cattura attenzione",
  "body": "Il corpo del messaggio - conciso, dritto al punto",
  "cta": "Call to action finale",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]${imageFields}
}
Massimo 3-4 blocchi di testo totali. Dritto al punto.`;
    }
  };

  const structuredContentInstructions = getStructuredContentInstructions();

  const prompt = `Sei un esperto di content marketing italiano specializzato nella Piramide della Consapevolezza. Genera ${count} idee creative per contenuti COMPLETI.

CONTESTO:
- Nicchia/Settore: ${niche}
- Target Audience: ${targetAudience}
- Obiettivo: ${objective}
- Tipo Media: ${mediaType}
- Tipo Copy: ${copyType}
${additionalContext ? `- Contesto aggiuntivo: ${additionalContext}` : ''}
${brandContext}

🎯 LIVELLO DI CONSAPEVOLEZZA: ${awarenessInfo.name}
STRATEGIA DA SEGUIRE: ${awarenessInfo.strategy}
TONO DA USARE: ${awarenessInfo.tone}
FOCUS DEL CONTENUTO: ${awarenessInfo.focus}

È FONDAMENTALE che ogni idea sia perfettamente calibrata per questo livello di consapevolezza. Il copy, l'hook, e tutto il contenuto devono riflettere questa strategia.

Per ogni idea, fornisci TUTTI questi elementi:

1. title: Titolo accattivante (max 60 caratteri)
2. description: Descrizione breve del contenuto (2-3 frasi)
3. aiScore: Punteggio di efficacia stimata (1-100)
4. aiReasoning: Motivazione del punteggio
5. suggestedHook: Un hook che cattura l'attenzione
6. suggestedCta: Call to action suggerita
7. mediaType: "${mediaType}"
8. copyType: "${copyType}"
9. structuredContent: Contenuto strutturato COMPLETO (vedi formato sotto) - TUTTI i campi devono essere dentro questo oggetto

${structuredContentInstructions}

RISPONDI SOLO con un JSON valido nel formato:
{
  "ideas": [
    {
      "title": "...",
      "description": "...",
      "aiScore": 85,
      "aiReasoning": "...",
      "suggestedHook": "...",
      "suggestedCta": "...",
      "mediaType": "${mediaType}",
      "copyType": "${copyType}",
      "structuredContent": { /* oggetto JSON COMPLETO secondo il formato sopra */ }
    }
  ]
}`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "content-ideas");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8192,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<{ ideas: ContentIdea[] }>(responseText, { ideas: [] });
    
    if (!parsed.ideas || parsed.ideas.length === 0) {
      return {
        ideas: [{
          title: "Contenuto di valore per il tuo pubblico",
          description: `Un contenuto che parla al tuo target di ${targetAudience} nel settore ${niche}`,
          aiScore: 70,
          aiReasoning: "Idea generica di fallback",
          suggestedHook: "Scopri come...",
          suggestedCta: "Scopri di più nel link in bio",
          mediaType,
          copyType,
          copyContent: "Contenuto di esempio per il tuo pubblico.",
        }],
        modelUsed: model,
      };
    }
    
    const enrichedIdeas = parsed.ideas.slice(0, count).map(idea => ({
      ...idea,
      mediaType: idea.mediaType || mediaType,
      copyType: idea.copyType || copyType,
    }));
    
    return {
      ideas: enrichedIdeas,
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating ideas:", error);
    throw new Error(`Failed to generate content ideas: ${error.message}`);
  }
}

export async function generatePostCopy(params: GeneratePostCopyParams): Promise<GeneratePostCopyResult> {
  const { consultantId, idea, platform, brandVoice, keywords, tone, maxLength } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const effectiveBrandVoice = brandVoice || assets?.brandVoice || 'professional';
  const effectiveTone = tone || assets?.toneOfVoice || 'friendly professional';

  const platformGuidelines: Record<Platform, string> = {
    instagram: "Usa emoji moderati, hashtag (max 10), formato verticale. Max 2200 caratteri ma primo paragrafo cruciale.",
    facebook: "Testo più lungo accettato, meno hashtag, incoraggia commenti e condivisioni.",
    linkedin: "Tono professionale, focus su valore business, usa bullet points, no emoji eccessivi.",
    tiktok: "Ultra breve, diretto, trendy, usa riferimenti pop culture, hashtag trending.",
    youtube: "Descrizione SEO-friendly, timestamps, link, CTA per subscribe e like.",
    twitter: "Max 280 caratteri, conciso, usa thread se necessario, hashtag limitati.",
  };

  const prompt = `Sei un copywriter esperto di social media italiano. Crea il copy completo per un post usando il FRAMEWORK PERSUASIVO a 6 step.

IDEA DEL CONTENUTO:
${idea}

PIATTAFORMA: ${platform}
${platformGuidelines[platform]}

BRAND VOICE: ${effectiveBrandVoice}
TONO: ${effectiveTone}
${keywords?.length ? `KEYWORDS DA INCLUDERE: ${keywords.join(', ')}` : ''}
${maxLength ? `LUNGHEZZA MASSIMA: ${maxLength} caratteri` : ''}

FRAMEWORK PERSUASIVO (6 STEP):
1. HOOK - Prima riga che cattura attenzione (pattern interrupt, curiosità, provocazione, domanda, statistica scioccante)
2. TARGET - "Aiuto [CHI] a [FARE COSA] [COME]" - Identifica il pubblico e il beneficio chiaro
3. PROBLEM - Il problema/pain point che il tuo target sta vivendo (rendi reale e specifico)
4. SOLUTION - La tua soluzione/offerta - cosa offri e perché funziona
5. PROOF - Riprova sociale: testimonianze, risultati, numeri, casi studio (anche struttura suggerita se non hai dati reali)
6. CTA - Call to action finale (chiara, urgente, specifica)

Genera tutti i 6 elementi + il fullCopy che li unisce in un post fluido e naturale.

RISPONDI SOLO con un JSON valido:
{
  "hook": "...",
  "target": "Aiuto [chi] a [cosa] [come]",
  "problem": "...",
  "solution": "...",
  "proof": "...",
  "cta": "...",
  "fullCopy": "Testo completo che unisce tutti i 6 step in modo naturale",
  "hashtags": ["..."],
  "emojiLevel": "minimal"
}`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "post-copy");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<PostCopy>(responseText, {
      hook: "Scopri qualcosa di nuovo oggi!",
      target: "Aiuto professionisti a raggiungere i loro obiettivi attraverso strategie mirate",
      problem: "Molti si sentono bloccati senza una direzione chiara",
      solution: "Il mio metodo ti guida passo dopo passo verso il risultato",
      proof: "Oltre 100 clienti hanno già ottenuto risultati concreti",
      cta: "Scopri di più nel link in bio",
      fullCopy: `Scopri qualcosa di nuovo oggi!\n\n${idea}\n\nScopri di più nel link in bio`,
    });
    
    return {
      copy: parsed,
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating post copy:", error);
    throw new Error(`Failed to generate post copy: ${error.message}`);
  }
}

export type CopyOutputType = "copy_short" | "copy_long" | "video_script" | "image_copy";

export interface VideoScriptSegment {
  timing: string;
  visual: string;
  voiceover: string;
}

export interface ShortCopyVariation {
  outputType: "copy_short";
  hook: string;
  cta: string;
  hashtags?: string[];
}

export interface LongCopyVariation {
  outputType: "copy_long";
  hook: string;
  chiCosaCome: string;
  errore: string;
  soluzione: string;
  riprovaSociale: string;
  cta: string;
  hashtags?: string[];
}

export interface VideoScriptVariation {
  outputType: "video_script";
  segments: VideoScriptSegment[];
  hashtags?: string[];
}

export interface ImageCopyVariation {
  outputType: "image_copy";
  imageText: string;
  subtitle: string;
  conceptDescription: string;
  hashtags?: string[];
}

export type PostCopyVariation = ShortCopyVariation | LongCopyVariation | VideoScriptVariation | ImageCopyVariation;

export interface GeneratePostCopyVariationsParams extends GeneratePostCopyParams {
  outputType?: CopyOutputType;
}

export interface GeneratePostCopyVariationsResult {
  variations: PostCopyVariation[];
  outputType: CopyOutputType;
  modelUsed: string;
  tokensUsed?: number;
}

function getPromptForOutputType(
  outputType: CopyOutputType,
  idea: string,
  platform: Platform,
  platformGuidelines: Record<Platform, string>,
  effectiveBrandVoice: string,
  effectiveTone: string,
  keywords?: string[],
  maxLength?: number
): string {
  const baseContext = `Sei un copywriter esperto di social media italiano.

IDEA DEL CONTENUTO:
${idea}

PIATTAFORMA: ${platform}
${platformGuidelines[platform]}

BRAND VOICE: ${effectiveBrandVoice}
TONO: ${effectiveTone}
${keywords?.length ? `KEYWORDS DA INCLUDERE: ${keywords.join(', ')}` : ''}
${maxLength ? `LUNGHEZZA MASSIMA: ${maxLength} caratteri` : ''}`;

  switch (outputType) {
    case "copy_short":
      return `${baseContext}

Genera 3 VARIAZIONI di CAPTION BREVI per social media. Ogni variazione deve avere solo:
- hook: Una frase d'impatto breve e incisiva (domanda provocatoria o affermazione forte)
- cta: Chiamata all'azione chiara e diretta

Le variazioni devono essere significativamente diverse tra loro.

RISPONDI SOLO con un JSON valido:
{
  "variations": [
    { "hook": "...", "cta": "...", "hashtags": ["..."] },
    { "hook": "...", "cta": "...", "hashtags": ["..."] },
    { "hook": "...", "cta": "...", "hashtags": ["..."] }
  ]
}`;

    case "copy_long":
      return `${baseContext}

Genera 3 VARIAZIONI di INSERZIONI COMPLETE usando il FRAMEWORK PERSUASIVO a 6 STEP:

1. HOOK - Domanda provocatoria o frase d'impatto che cattura subito l'attenzione
2. CHI-COSA-COME - Presentazione personale con autorità: "Ciao, sono [Nome]. Se frequenti [contesto], ci siamo già visti a [evento]. Aiuto [chi] a [cosa] attraverso [metodo unico]"
3. ERRORE - L'errore SPECIFICO che fanno le persone: "L'errore più grande? Considerare X come Y..." (sii specifico e concreto)
4. SOLUZIONE - Il metodo unico con nome proprio: "Il mio metodo [Nome] non è [cosa comune], è [cosa unica che lo differenzia]"
5. RIPROVA SOCIALE - Storie concrete con nomi, eventi specifici, risultati misurabili (anche struttura suggerita)
6. CTA - Azione specifica con urgenza chiara

IMPORTANTE: Le 3 variazioni devono essere SIGNIFICATIVAMENTE diverse tra loro in tono e approccio.

RISPONDI SOLO con un JSON valido:
{
  "variations": [
    {
      "hook": "...",
      "chiCosaCome": "Ciao, sono [Nome]. Aiuto [chi] a [cosa] attraverso [metodo]...",
      "errore": "L'errore più grande? ...",
      "soluzione": "Il mio metodo [Nome] non è..., è...",
      "riprovaSociale": "Solo la settimana scorsa, [Nome] ha...",
      "cta": "...",
      "hashtags": ["..."]
    },
    { ... },
    { ... }
  ]
}`;

    case "video_script":
      return `${baseContext}

Genera 3 VARIAZIONI di SCRIPT VIDEO con timing precisi. Ogni variazione deve seguire questa struttura temporale:

- 00-05s: HOOK - Frase d'impatto che ferma lo scroll
- 05-20s: CHI-COSA-COME - Presentazione con autorità
- 20-35s: ERRORE - L'errore specifico che fa il target
- 35-50s: SOLUZIONE + RIPROVA SOCIALE - Metodo unico + storie concrete
- 50-60s: CTA - Azione urgente finale

Per ogni segmento temporale, fornisci:
- visual: Descrizione dell'inquadratura/cosa si vede
- voiceover: Testo da pronunciare/sottotitolare

RISPONDI SOLO con un JSON valido:
{
  "variations": [
    {
      "segments": [
        { "timing": "00-05s", "visual": "Close-up sul volto, sguardo diretto in camera", "voiceover": "[HOOK qui]" },
        { "timing": "05-20s", "visual": "Piano medio, ambiente professionale", "voiceover": "Ciao, sono [Nome]..." },
        { "timing": "20-35s", "visual": "B-roll o gesture che enfatizza il problema", "voiceover": "L'errore più grande?..." },
        { "timing": "35-50s", "visual": "Mostra risultati, testimonial, o dimostrazione", "voiceover": "Il mio metodo..." },
        { "timing": "50-60s", "visual": "Call to action visiva, testo su schermo", "voiceover": "[CTA urgente]" }
      ],
      "hashtags": ["..."]
    },
    { ... },
    { ... }
  ]
}`;

    case "image_copy":
      return `${baseContext}

Genera 3 VARIAZIONI di COPY PER IMMAGINE. Ogni variazione deve avere:
- imageText: Testo BREVE da mettere SULL'immagine (massimo 10 parole, deve essere leggibile e d'impatto)
- subtitle: Sottotitolo/caption da mettere SOTTO l'immagine (più lungo, può includere dettagli)
- conceptDescription: Descrizione del concept visivo dell'immagine (cosa dovrebbe mostrare l'immagine per accompagnare il testo)

Il testo sull'immagine deve essere d'impatto immediato, il sottotitolo può espandere il messaggio.

RISPONDI SOLO con un JSON valido:
{
  "variations": [
    {
      "imageText": "Massimo 10 parole d'impatto",
      "subtitle": "Sottotitolo più lungo che espande il messaggio...",
      "conceptDescription": "Immagine che mostra...",
      "hashtags": ["..."]
    },
    { ... },
    { ... }
  ]
}`;

    default:
      return getPromptForOutputType("copy_long", idea, platform, platformGuidelines, effectiveBrandVoice, effectiveTone, keywords, maxLength);
  }
}

function getDefaultVariationsForType(outputType: CopyOutputType): PostCopyVariation[] {
  switch (outputType) {
    case "copy_short":
      return [
        { outputType: "copy_short", hook: "Stai facendo questo errore?", cta: "Scopri di più nel link in bio", hashtags: [] },
        { outputType: "copy_short", hook: "Ecco cosa nessuno ti dice...", cta: "Commenta 'INFO' per saperne di più", hashtags: [] },
        { outputType: "copy_short", hook: "3 secondi per cambiare tutto.", cta: "Salva questo post!", hashtags: [] },
      ];
    case "copy_long":
      return [
        { 
          outputType: "copy_long",
          hook: "Stai perdendo clienti ogni giorno senza saperlo?",
          chiCosaCome: "Ciao, sono [Nome]. Aiuto professionisti a trasformare il loro business attraverso strategie di marketing personalizzate.",
          errore: "L'errore più grande? Pensare che basti 'essere sui social' per avere risultati.",
          soluzione: "Il mio Metodo 3P non è il solito corso, è un sistema pratico testato su oltre 100 aziende.",
          riprovaSociale: "Solo il mese scorso, Marco ha triplicato i suoi contatti in 30 giorni applicando questo metodo.",
          cta: "Commenta 'VOGLIO' per ricevere la guida gratuita!",
          hashtags: []
        },
        { 
          outputType: "copy_long",
          hook: "Perché il 90% dei business fallisce online?",
          chiCosaCome: "Ciao, sono [Nome]. Se frequenti eventi di settore, probabilmente ci siamo già visti. Aiuto imprenditori a scalare online.",
          errore: "L'errore più grande? Copiare quello che fanno gli altri senza una strategia.",
          soluzione: "Il mio Framework Unico parte dai tuoi punti di forza, non dalle mode del momento.",
          riprovaSociale: "Laura ha raddoppiato il fatturato in 6 mesi partendo da zero follower.",
          cta: "Prenota una call gratuita - link in bio!",
          hashtags: []
        },
        { 
          outputType: "copy_long",
          hook: "Sai qual è la differenza tra chi cresce e chi resta fermo?",
          chiCosaCome: "Ciao, sono [Nome]. Aiuto freelancer e consulenti a costruire un business sostenibile.",
          errore: "L'errore più grande? Lavorare 12 ore al giorno pensando che sia l'unico modo.",
          soluzione: "Il mio Sistema Libertà ti insegna a lavorare meno ma meglio, automatizzando ciò che ti ruba tempo.",
          riprovaSociale: "Giorgio ora lavora 5 ore al giorno e guadagna il doppio. Vero story.",
          cta: "Scrivi 'LIBERTÀ' nei commenti per il primo step gratuito!",
          hashtags: []
        },
      ];
    case "video_script":
      return [
        {
          outputType: "video_script",
          segments: [
            { timing: "00-05s", visual: "Close-up, sguardo in camera", voiceover: "Stai perdendo soldi ogni giorno?" },
            { timing: "05-20s", visual: "Piano medio, ambiente professionale", voiceover: "Ciao, sono [Nome]. Aiuto professionisti a crescere online." },
            { timing: "20-35s", visual: "B-roll con grafiche", voiceover: "L'errore più grande? Pensare di non aver bisogno di una strategia." },
            { timing: "35-50s", visual: "Mostra risultati", voiceover: "Il mio metodo ha aiutato 100+ persone a triplicare i risultati." },
            { timing: "50-60s", visual: "CTA su schermo", voiceover: "Link in bio per iniziare gratis!" },
          ],
          hashtags: []
        },
        {
          outputType: "video_script",
          segments: [
            { timing: "00-05s", visual: "Hook visivo forte", voiceover: "Fermati. Questo ti riguarda." },
            { timing: "05-20s", visual: "Presentazione personale", voiceover: "Sono [Nome] e quello che sto per dirti cambierà tutto." },
            { timing: "20-35s", visual: "Problema visualizzato", voiceover: "Stai facendo questo errore senza saperlo..." },
            { timing: "35-50s", visual: "Soluzione in azione", voiceover: "Ecco la soluzione che ha funzionato per tutti." },
            { timing: "50-60s", visual: "Azione finale", voiceover: "Commenta ORA per sapere come!" },
          ],
          hashtags: []
        },
        {
          outputType: "video_script",
          segments: [
            { timing: "00-05s", visual: "Inquadratura dinamica", voiceover: "3 secondi per cambiare la tua vita." },
            { timing: "05-20s", visual: "Chi sono io", voiceover: "Ciao, sono [Nome]. Aiuto [chi] a [cosa]." },
            { timing: "20-35s", visual: "Il problema comune", voiceover: "L'errore che tutti fanno? Questo." },
            { timing: "35-50s", visual: "La mia soluzione", voiceover: "Il mio metodo è diverso perché..." },
            { timing: "50-60s", visual: "CTA visiva", voiceover: "Segui per altri consigli come questo!" },
          ],
          hashtags: []
        },
      ];
    case "image_copy":
      return [
        {
          outputType: "image_copy",
          imageText: "Smetti di fare questo errore",
          subtitle: "Il 90% delle persone sbaglia questo passaggio fondamentale. Scopri come evitarlo e ottenere risultati 3x più velocemente.",
          conceptDescription: "Immagine con sfondo pulito, testo grande e leggibile, colori contrastanti che catturano l'attenzione",
          hashtags: []
        },
        {
          outputType: "image_copy",
          imageText: "La verità che nessuno ti dice",
          subtitle: "Dopo anni di esperienza ho capito una cosa: il successo non è questione di fortuna, è questione di strategia.",
          conceptDescription: "Ritratto professionale o scena di lavoro, atmosfera autentica e credibile",
          hashtags: []
        },
        {
          outputType: "image_copy",
          imageText: "Risultati in 30 giorni",
          subtitle: "Non prometto magie, ma un metodo testato su oltre 100 persone. Funziona. Punto.",
          conceptDescription: "Grafica con numeri/statistiche, visual che comunica crescita e successo",
          hashtags: []
        },
      ];
    default:
      return getDefaultVariationsForType("copy_long");
  }
}

function parseVariationsResponse(responseText: string, outputType: CopyOutputType): PostCopyVariation[] {
  const fallback = getDefaultVariationsForType(outputType);
  
  try {
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsed = JSON.parse(cleanedText);
    
    if (!parsed.variations || !Array.isArray(parsed.variations)) {
      return fallback;
    }
    
    return parsed.variations.slice(0, 3).map((v: any) => {
      switch (outputType) {
        case "copy_short":
          return {
            outputType: "copy_short",
            hook: v.hook || "",
            cta: v.cta || "",
            hashtags: v.hashtags || [],
          } as ShortCopyVariation;
        case "copy_long":
          return {
            outputType: "copy_long",
            hook: v.hook || "",
            chiCosaCome: v.chiCosaCome || v.target || "",
            errore: v.errore || v.problem || "",
            soluzione: v.soluzione || v.solution || "",
            riprovaSociale: v.riprovaSociale || v.proof || "",
            cta: v.cta || "",
            hashtags: v.hashtags || [],
          } as LongCopyVariation;
        case "video_script":
          return {
            outputType: "video_script",
            segments: (v.segments || []).map((s: any) => ({
              timing: s.timing || "",
              visual: s.visual || "",
              voiceover: s.voiceover || "",
            })),
            hashtags: v.hashtags || [],
          } as VideoScriptVariation;
        case "image_copy":
          return {
            outputType: "image_copy",
            imageText: v.imageText || "",
            subtitle: v.subtitle || "",
            conceptDescription: v.conceptDescription || "",
            hashtags: v.hashtags || [],
          } as ImageCopyVariation;
        default:
          return v;
      }
    });
  } catch (error) {
    console.error("[CONTENT-AI] Failed to parse variations response:", error);
    return fallback;
  }
}

export async function generatePostCopyVariations(params: GeneratePostCopyVariationsParams): Promise<GeneratePostCopyVariationsResult> {
  const { consultantId, idea, platform, brandVoice, keywords, tone, maxLength, outputType = "copy_long" } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const effectiveBrandVoice = brandVoice || assets?.brandVoice || 'professional';
  const effectiveTone = tone || assets?.toneOfVoice || 'friendly professional';

  const platformGuidelines: Record<Platform, string> = {
    instagram: "Usa emoji moderati, hashtag (max 10), formato verticale. Max 2200 caratteri ma primo paragrafo cruciale.",
    facebook: "Testo più lungo accettato, meno hashtag, incoraggia commenti e condivisioni.",
    linkedin: "Tono professionale, focus su valore business, usa bullet points, no emoji eccessivi.",
    tiktok: "Ultra breve, diretto, trendy, usa riferimenti pop culture, hashtag trending.",
    youtube: "Descrizione SEO-friendly, timestamps, link, CTA per subscribe e like.",
    twitter: "Max 280 caratteri, conciso, usa thread se necessario, hashtag limitati.",
  };

  const prompt = getPromptForOutputType(
    outputType,
    idea,
    platform,
    platformGuidelines,
    effectiveBrandVoice,
    effectiveTone,
    keywords,
    maxLength
  );

  try {
    const { client, metadata } = await getAIProvider(consultantId, "post-copy-variations");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 4096,
      },
    });
    
    const responseText = result.response.text();
    const variations = parseVariationsResponse(responseText, outputType);
    
    return {
      variations,
      outputType,
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating post copy variations:", error);
    throw new Error(`Failed to generate post copy variations: ${error.message}`);
  }
}

export async function generateCampaignContent(params: GenerateCampaignParams): Promise<GenerateCampaignResult> {
  const { consultantId, productOrService, targetAudience, objective, budget, duration, uniqueSellingPoints, brandVoice } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const effectiveBrandVoice = brandVoice || assets?.brandVoice || 'professional';

  const prompt = `Sei un esperto di marketing e advertising italiano. Crea una strategia di campagna completa seguendo la struttura a 6 step.

PRODOTTO/SERVIZIO: ${productOrService}
TARGET AUDIENCE: ${targetAudience}
OBIETTIVO: ${objective}
${budget ? `BUDGET: ${budget}` : ''}
${duration ? `DURATA: ${duration}` : ''}
${uniqueSellingPoints?.length ? `USP: ${uniqueSellingPoints.join(', ')}` : ''}
BRAND VOICE: ${effectiveBrandVoice}

Genera una strategia completa con:

1. HOOK - Chi è il target, cosa offriamo, come lo comunichiamo
2. TARGET - Demografia, interessi e comportamenti
3. PROBLEM - Problema principale e conseguenze
4. SOLUTION - Offerta e benefici
5. PROOF - Struttura testimonial e numeri
6. CTA - Testo e urgenza

Più creativi per ads:
- primaryText: Testo principale dell'ad
- headline: Titolo dell'ad
- description: Descrizione breve

RISPONDI SOLO con un JSON valido:
{
  "hook": {
    "who": "...",
    "what": "...",
    "how": "...",
    "copy": "..."
  },
  "target": {
    "demographics": {
      "ageRange": "25-45",
      "gender": "all",
      "location": "Italia",
      "language": "Italiano"
    },
    "interests": ["..."],
    "behaviors": ["..."]
  },
  "problem": {
    "mainProblem": "...",
    "consequences": ["..."],
    "emotionalImpact": "..."
  },
  "solution": {
    "offer": "...",
    "benefits": ["..."],
    "differentiators": ["..."]
  },
  "proof": {
    "testimonialStructure": "...",
    "numbers": ["..."],
    "socialProof": ["..."]
  },
  "cta": {
    "text": "...",
    "urgency": "...",
    "secondaryCta": "..."
  },
  "adCreative": {
    "primaryText": "...",
    "headline": "...",
    "description": "..."
  }
}`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "campaign-content");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<CampaignContent>(responseText, getDefaultCampaign(productOrService, targetAudience));
    
    return {
      campaign: parsed,
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating campaign:", error);
    throw new Error(`Failed to generate campaign content: ${error.message}`);
  }
}

function getDefaultCampaign(product: string, audience: string): CampaignContent {
  return {
    hook: {
      who: audience,
      what: product,
      how: "Comunicazione diretta e chiara",
      copy: `Scopri ${product} - la soluzione per ${audience}`,
    },
    target: {
      demographics: {
        ageRange: "25-55",
        gender: "all",
        location: "Italia",
        language: "Italiano",
      },
      interests: ["Business", "Innovazione", "Crescita personale"],
      behaviors: ["Acquisti online", "Ricerca attiva di soluzioni"],
    },
    problem: {
      mainProblem: "Difficoltà a raggiungere i propri obiettivi",
      consequences: ["Perdita di tempo", "Frustrazione", "Risultati insufficienti"],
      emotionalImpact: "Senso di stallo e insoddisfazione",
    },
    solution: {
      offer: product,
      benefits: ["Risparmio di tempo", "Risultati migliori", "Supporto dedicato"],
      differentiators: ["Approccio personalizzato", "Esperienza comprovata"],
    },
    proof: {
      testimonialStructure: "Situazione iniziale → Soluzione → Risultato ottenuto",
      numbers: ["100+ clienti soddisfatti", "95% tasso di successo"],
      socialProof: ["Recensioni verificate", "Case study documentati"],
    },
    cta: {
      text: "Inizia ora",
      urgency: "Posti limitati - Prenota la tua consulenza gratuita",
      secondaryCta: "Scopri di più",
    },
    adCreative: {
      primaryText: `${audience}, è il momento di cambiare. ${product} ti aspetta.`,
      headline: `Trasforma il tuo ${product}`,
      description: "Scopri come centinaia di persone hanno già raggiunto i loro obiettivi.",
    },
  };
}

export async function generateImagePrompt(params: GenerateImagePromptParams): Promise<ImagePromptResult> {
  const { consultantId, contentDescription, brandColors, style, platform, aspectRatio, mood, includeText, textToInclude } = params;
  
  await rateLimitCheck(consultantId);
  
  const assets = await getBrandAssets(consultantId);
  const effectiveColors = brandColors || assets?.primaryColors || [];

  const platformSpecs: Record<Platform, { ratio: string; resolution: string }> = {
    instagram: { ratio: aspectRatio || "1:1", resolution: "1080x1080" },
    facebook: { ratio: "1.91:1", resolution: "1200x628" },
    linkedin: { ratio: "1.91:1", resolution: "1200x627" },
    tiktok: { ratio: "9:16", resolution: "1080x1920" },
    youtube: { ratio: "16:9", resolution: "1280x720" },
    twitter: { ratio: "16:9", resolution: "1200x675" },
  };

  const styleDescriptions: Record<ImageStyle, string> = {
    realistic: "fotorealistico, dettagli naturali, illuminazione cinematica",
    illustration: "illustrazione digitale, colori vivaci, stile moderno",
    minimal: "design minimalista, spazi bianchi, elementi essenziali",
    bold: "colori forti, contrasti elevati, impatto visivo forte",
    professional: "aspetto corporate, pulito, affidabile, elegante",
    playful: "giocoso, colorato, friendly, accessibile",
  };

  const specs = platformSpecs[platform] || platformSpecs.instagram;

  const prompt = `Sei un esperto di prompt engineering per generazione immagini AI. Crea un prompt ottimizzato.

DESCRIZIONE CONTENUTO: ${contentDescription}
STILE: ${style} - ${styleDescriptions[style]}
PIATTAFORMA: ${platform}
ASPECT RATIO: ${specs.ratio}
${effectiveColors.length ? `COLORI BRAND: ${effectiveColors.join(', ')}` : ''}
${mood ? `MOOD: ${mood}` : ''}
${includeText && textToInclude ? `TESTO DA INCLUDERE: "${textToInclude}"` : ''}

Genera:
1. prompt: Il prompt completo ottimizzato per DALL-E/Midjourney/Stable Diffusion
2. negativePrompt: Elementi da evitare
3. styleNotes: Note aggiuntive sullo stile

RISPONDI SOLO con un JSON valido:
{
  "prompt": "...",
  "negativePrompt": "...",
  "styleNotes": "..."
}`;

  try {
    const { client, metadata } = await getAIProvider(consultantId, "image-prompt");
    const { model } = getModelWithThinking(metadata?.name);
    
    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 1024,
      },
    });
    
    const responseText = result.response.text();
    const parsed = parseJsonResponse<{ prompt: string; negativePrompt: string; styleNotes: string }>(responseText, {
      prompt: `${styleDescriptions[style]} image of ${contentDescription}`,
      negativePrompt: "blurry, low quality, distorted, watermark, text unless specified",
      styleNotes: `Optimized for ${platform}`,
    });
    
    return {
      prompt: parsed.prompt,
      negativePrompt: parsed.negativePrompt,
      styleNotes: parsed.styleNotes,
      technicalSpecs: {
        aspectRatio: specs.ratio,
        resolution: specs.resolution,
        format: "PNG",
      },
      modelUsed: model,
    };
  } catch (error: any) {
    console.error("[CONTENT-AI] Error generating image prompt:", error);
    throw new Error(`Failed to generate image prompt: ${error.message}`);
  }
}
