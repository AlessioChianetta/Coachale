import { getAIProvider, getModelWithThinking, getSuperAdminGeminiKeys, trackedGenerateContent } from "../ai/provider-factory";
import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

export interface AdvisageSettings {
  mood: 'professional' | 'energetic' | 'luxury' | 'minimalist' | 'playful';
  stylePreference: 'realistic' | '3d-render' | 'illustration' | 'cyberpunk' | 'lifestyle';
  brandColor?: string;
  brandFont?: string;
  conceptTypes?: string[];
}

const CONCEPT_TYPE_PROMPTS: Record<string, { label: string; layoutInstructions: string }> = {
  'call-out-benefici': {
    label: 'Call Out Benefici',
    layoutInstructions: `Layout "Call Out Benefici": Immagine del prodotto/servizio al centro o a destra. Intorno al prodotto, frecce bianche curve che puntano a box di testo con i benefici chiave (es: "Pochi minuti al giorno", "Migliora la tua autostima", "Esercizi guidati"). In alto, headline grande e bold. In basso a sinistra, un badge con social proof (es: "15.000+ persone hanno già...", stelle di rating). Sfondo elegante e scuro con illuminazione d'ambiente. Stile: infografica premium.`
  },
  'social-proof-avatar': {
    label: 'Social Proof Avatar',
    layoutInstructions: `Layout "Social Proof Avatar": In alto a sinistra, foto avatar rotonda di un cliente con nome e username sotto. Sotto l'avatar, un box bianco semi-trasparente con una testimonianza/recensione del cliente in testo grande e leggibile. Nella metà inferiore, foto del prodotto/servizio in uso. Layout tipo "tweet" o "post social" sovrapposto alla foto prodotto. Stile: autentico, social media native.`
  },
  'x-ragioni-acquistare': {
    label: 'X Ragioni per Acquistare',
    layoutInstructions: `Layout "X Ragioni per Acquistare": Headline grande in alto (es: "5 ragioni per scegliere [prodotto]"). Sotto, elenco numerato verticale con icone o numeri colorati a sinistra e testo beneficio a destra. Ogni riga ha un colore o icona diversa. In basso, CTA button. Sfondo con il prodotto sfocato dietro o a lato. Stile: infografica moderna e pulita.`
  },
  'offerta-headline-usp': {
    label: 'Offerta / Headline USP',
    layoutInstructions: `Layout "Offerta / Headline USP": Headline dominante in alto (grande, bold, colore d'impatto). Sotto, 3-4 benefici chiave in box colorati orizzontali allineati a sinistra, ciascuno con testo bold. Prodotto posizionato a destra occupando circa il 40% dell'immagine. In basso, badge con social proof (voto medio, stelline). Colori del brand prominenti. Stile: advertising diretto, alto impatto.`
  },
  'noi-vs-competitor': {
    label: 'Noi vs Competitor',
    layoutInstructions: `Layout "Noi vs Competitor": Immagine divisa a metà verticalmente. SINISTRA: sfondo rosa/rosso pallido, prodotto generico/scuro, sotto 3 box bianchi con testi negativi del competitor (es: "istruzioni poco chiare", "troppo costoso"). DESTRA: sfondo verde/menta, prodotto del brand premium e colorato, sotto 3 box verdi con testi positivi bold (es: "Facile da usare", "40% più economico"). Al centro grande "VS" in rosso. In basso, banner con offerta/CTA. Stile: comparativo, alto contrasto tra le due metà.`
  },
  'risultato-desiderabile': {
    label: 'Risultato Desiderabile',
    layoutInstructions: `Layout "Risultato Desiderabile": Foto a tutto campo del risultato finale che il cliente otterrà (persona felice, risultato raggiunto, trasformazione). Atmosfera aspirazionale e positiva. Overlay gradiente in basso con testo CTA. In alto, piccola headline. Stile: lifestyle aspirazionale, emozionale.`
  },
};

function buildConceptTypeInstructions(conceptTypes?: string[]): string {
  if (!conceptTypes || conceptTypes.length === 0) {
    return `═══════════════════════════════════════════════════
TIPOLOGIE CONCEPT (scegli 3 tra queste):
═══════════════════════════════════════════════════
Scegli 3 tipologie diverse per i concept visuali:
${Object.entries(CONCEPT_TYPE_PROMPTS).map(([_, v]) => `- "${v.label}"`).join('\n')}
Specifica nel campo styleType la tipologia scelta (in italiano).`;
  }

  const selectedTypes = conceptTypes
    .map(id => CONCEPT_TYPE_PROMPTS[id])
    .filter(Boolean);

  if (selectedTypes.length === 0) {
    return buildConceptTypeInstructions(undefined);
  }

  return `═══════════════════════════════════════════════════
TIPOLOGIE CONCEPT RICHIESTE (genera ESATTAMENTE queste):
═══════════════════════════════════════════════════
L'utente ha selezionato queste tipologie specifiche. Genera UN concept per ciascuna tipologia richiesta:
${selectedTypes.map(t => `
- "${t.label}": ${t.layoutInstructions}`).join('\n')}

Specifica nel campo styleType ESATTAMENTE il nome della tipologia (in italiano).
Se le tipologie selezionate sono meno di 3, completa con altre tipologie a tua scelta fino a 3 concept totali.`;
}

export interface VisualConcept {
  id: string;
  title: string;
  description: string;
  styleType: string;
  recommendedFormat: '1:1' | '4:5' | '9:16' | '16:9' | '3:4';
  promptClean: string;
  promptWithText: string;
  textContent: string;
  reasoning: string;
}

export interface AdvisageAnalysis {
  id: string;
  tone: string;
  objective: string;
  emotion: string;
  cta: string;
  context: {
    sector: string;
    product: string;
    target: string;
  };
  concepts: VisualConcept[];
  socialCaptions: Array<{
    tone: string;
    text: string;
    hashtags: string[];
  }>;
  competitiveEdge: string;
  originalText: string;
  socialNetwork: string;
  status: string;
}

export async function analyzeAdTextServerSide(
  consultantId: string,
  text: string,
  platform: string,
  settings: AdvisageSettings
): Promise<AdvisageAnalysis> {
  console.log(`[ADVISAGE-SERVER] Analyzing text for ${platform}, consultantId: ${consultantId}`);
  
  const { client, metadata, setFeature } = await getAIProvider(consultantId, consultantId);
  setFeature?.('advisage');
  const modelConfig = getModelWithThinking(metadata.name);
  
  const brandInfo = settings.brandColor 
    ? `BRAND COLOR: ${settings.brandColor}. BRAND FONT: ${settings.brandFont || 'Modern Sans'}.` 
    : '';
  
  const conceptTypeInstructions = buildConceptTypeInstructions(settings.conceptTypes);

  const prompt = `Sei un direttore creativo senior esperto in Facebook/Meta Ads ad alta conversione.

⚠️ REGOLA FONDAMENTALE LINGUA: TUTTI i campi testuali del JSON (title, description, reasoning, textContent, tone, objective, emotion, cta, competitiveEdge, styleType, socialCaptions.tone, socialCaptions.text) DEVONO essere scritti ESCLUSIVAMENTE in ITALIANO. NON in inglese. Solo i campi promptClean e promptWithText sono in inglese. Se scrivi anche UN SOLO campo testuale in inglese, la risposta è INVALIDA e verrà rifiutata.

Analizza questo copy pubblicitario per ${platform.toUpperCase()}.
FACTORY SETTINGS: Mood: ${settings.mood}, Style: ${settings.stylePreference}. ${brandInfo}

TEXT: "${text}"

TASK: 
1. Crea 3 concept visuali (immagini) ottimizzati per inserzioni pubblicitarie ad alta conversione.
2. Crea 3 caption social (Emozionale, Tecnico, Diretto) con hashtag strategici.
3. Fornisci un breve vantaggio competitivo.

═══════════════════════════════════════════════════
LINEE GUIDA INSERZIONI IMMAGINE (da rispettare SEMPRE):
═══════════════════════════════════════════════════
- Immagini ad ALTA RISOLUZIONE, nessuna sfocatura o sgranatura.
- Formati obbligatori: 1:1 (feed) e 9:16 (stories). Il recommendedFormat deve alternare tra questi.
- Usa i COLORI e il LOGO del marchio in modo coerente nell'immagine.
- Includi il logo del brand ma SENZA sovraccaricare l'immagine.
- L'immagine deve trasmettere il MESSAGGIO dell'inserzione a COLPO D'OCCHIO.
- Inserisci sempre una CALL TO ACTION visibile e facilmente identificabile.
- Scegli visual che evocano EMOZIONI POSITIVE o che mostrano RISULTATI DESIDERABILI.
- Rispetta le linee guida Facebook/Meta (no testo >20% dell'immagine, no contenuti vietati).

═══════════════════════════════════════════════════
STRUTTURA TESTI INSERZIONE (per socialCaptions — TUTTO IN ITALIANO):
═══════════════════════════════════════════════════
- Usa modelli di comunicazione: AIDA (Attenzione, Interesse, Desiderio, Azione) o Think-Feel-Do.
- Usa ELENCHI PUNTATI per evidenziare le USP del prodotto/servizio.
- Usa PARAGRAFI brevi per facilitare la lettura.
- Incorpora elementi di RIPROVA SOCIALE (testimonianze, numeri, risultati).
- Valuta se inserire SCARCITY o URGENCY (se pertinente al contesto).
- Chiudi SEMPRE con una CALL TO ACTION chiara e diretta.
- Il titolo deve essere < 125 caratteri e fare leva su una caratteristica del prodotto o un'offerta.
- La descrizione deve evidenziare i BENEFICI CHIAVE e contenere parole come: senza sforzo, spedizione gratuita, risultati garantiti, ecc.

${conceptTypeInstructions}

═══════════════════════════════════════════════════
REGOLE PER I PROMPT IMMAGINE (promptClean e promptWithText):
═══════════════════════════════════════════════════
- I prompt devono descrivere visual che FERMANO LO SCROLL: alto contrasto, colori vividi, composizione dinamica.
- Usa la REGOLA DEI TERZI per posizionare gli elementi chiave.
- Prevedi SPAZIO NEGATIVO (almeno 25% dell'immagine) per overlay di testo pubblicitario.
- Applica PSICOLOGIA DEI COLORI: rosso/arancio per urgenza, blu per fiducia, verde per crescita.
- GERARCHIA VISIVA: guida l'occhio dall'hook (alto) → soggetto (centro) → area CTA (basso).
- Illuminazione drammatica e direzionale, mai piatta. Profondità di campo ridotta per look premium.
- promptClean: visual puro SENZA testo/loghi/watermark — solo immagine.
- promptWithText: il prompt deve INCLUDERE istruzioni per renderizzare il testo dell'hook (textContent) in modo prominente e leggibile nell'immagine, con tipografia bold, alto contrasto e posizionamento strategico. Il testo deve occupare max 20% dell'immagine.
- Qualità fotorealistica, standard da fotografia pubblicitaria commerciale.
- QUESTI SONO GLI UNICI CAMPI IN INGLESE. Tutti gli altri campi DEVONO essere in italiano.

OUTPUT JSON VALIDO con questa struttura esatta (ricorda: TUTTO in italiano tranne promptClean e promptWithText):
{
  "tone": "stringa in italiano",
  "objective": "stringa in italiano", 
  "emotion": "stringa in italiano",
  "cta": "stringa in italiano, massimo 125 caratteri",
  "context": { "sector": "stringa in italiano", "product": "stringa in italiano", "target": "stringa in italiano" },
  "concepts": [{ "id": "string", "title": "titolo in ITALIANO", "description": "descrizione dettagliata del visual in ITALIANO", "styleType": "tipologia inserzione in ITALIANO (es: Call Out Benefici, Social Proof Avatar, Offerta / Headline USP, Noi vs Competitor, X Ragioni per Acquistare, Risultato Desiderabile)", "recommendedFormat": "1:1|9:16", "promptClean": "detailed image prompt IN ENGLISH for pure visual without text", "promptWithText": "detailed image prompt IN ENGLISH with instructions to render the hook text legibly in the image", "textContent": "testo hook in ITALIANO da mostrare nell'immagine", "reasoning": "spiegazione in ITALIANO del perché questo visual converte" }],
  "socialCaptions": [{ "tone": "Emozionale o Tecnico o Diretto", "text": "caption completa in ITALIANO", "hashtags": ["hashtag"] }],
  "competitiveEdge": "vantaggio competitivo in ITALIANO"
}`;
  
  console.log("[ADVISAGE-SERVER] Calling AI provider with model:", modelConfig.model);
  
  const response = await client.generateContent({
    model: modelConfig.model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    }
  });
  
  const responseText = (response.response?.text?.() || response.text?.() || "").trim();
  console.log("[ADVISAGE-SERVER] Response length:", responseText.length);
  
  if (!responseText) {
    throw new Error("La risposta AI è vuota. Riprova.");
  }
  
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (parseError) {
    console.error("[ADVISAGE-SERVER] JSON parse error. Response:", responseText.substring(0, 500));
    throw new Error("Errore nel parsing della risposta AI. Riprova.");
  }
  
  const postId = Math.random().toString(36).substr(2, 9);
  const result: AdvisageAnalysis = {
    ...parsed,
    id: postId,
    concepts: (parsed.concepts || []).map((c: any, idx: number) => ({ 
      ...c, 
      id: `${postId}_concept_${idx}` 
    })),
    originalText: text,
    socialNetwork: platform,
    status: 'completed'
  };
  
  console.log(`[ADVISAGE-SERVER] Analysis complete: ${result.concepts.length} concepts generated`);
  
  return result;
}

function buildAdImagePrompt(basePrompt: string, aspectRatio: string, variant: 'text' | 'clean' = 'clean', hookText?: string, styleType?: string): string {
  const formatGuide: Record<string, string> = {
    '1:1': 'Square format (Instagram Feed). Center the focal point. Leave 20% margins for text overlay.',
    '3:4': 'Portrait format (Instagram Post 4:5). Vertical composition, subject in upper 2/3, lower 1/3 free for caption overlay.',
    '4:3': 'Landscape format. Wide composition, subject off-center using rule of thirds.',
    '9:16': 'Vertical Story/Reel format. Full-height vertical composition. Key visual hook in top 40%. Leave bottom 25% clean for swipe-up CTA area.',
    '16:9': 'Widescreen format (Facebook/LinkedIn). Panoramic composition, subject positioned at left or right third.',
  };

  const formatInstruction = formatGuide[aspectRatio] || formatGuide['1:1'];

  const textRule = variant === 'text' && hookText
    ? `- TEXT OVERLAY: Render the following text prominently in the image as a bold, high-contrast typographic overlay. The text must be PERFECTLY LEGIBLE and positioned in the safe zone (15% margin from edges). Use a clean, modern sans-serif font. Text: "${hookText}"
- TEXT STYLING: The text must have strong contrast against the background — use white text with dark shadow, or dark text on a light gradient bar. Make the text the dominant visual element that catches the eye first.
- LAYOUT: Position the hook text in the upper third or center of the image. Leave the bottom area clean for CTA elements that will be added later.`
    : `- NO TEXT IN IMAGE: Do NOT render any text, typography, logos, or watermarks in the image. The image is purely visual — text will be overlaid separately.`;

  return `You are an elite advertising creative director generating a high-converting ad visual.

FORMAT: ${formatInstruction}

ADVERTISING VISUAL RULES (follow strictly):
- HIGH CONTRAST: Use bold color contrasts to stop the scroll. The image must pop against white/dark feed backgrounds.
- RULE OF THIRDS: Position the hero element at a power point intersection, never dead center.
- NEGATIVE SPACE: Reserve at least 25% of the image as clean space for text overlay — no busy patterns in text areas.
- COLOR PSYCHOLOGY: Use warm tones (red, orange) for urgency/action, cool tones (blue, teal) for trust/calm, green for growth/health.
- PATTERN INTERRUPT: Include one unexpected or eye-catching element that breaks the visual monotony of a social feed.
- VISUAL HIERARCHY: Guide the viewer's eye from the hook (top) → product/subject (center) → CTA area (bottom).
- LIGHTING: Use dramatic, directional lighting (not flat). Rim lighting, golden hour, or studio lighting for product shots.
- DEPTH OF FIELD: Shallow depth of field to isolate the subject and create a professional, premium look.
${textRule}
- PROFESSIONAL QUALITY: Photorealistic, 8K quality, commercial advertising photography standard.
${styleType ? getStyleTypeLayoutInstructions(styleType) : ''}
CONCEPT TO VISUALIZE:
${basePrompt}`;
}

function getStyleTypeLayoutInstructions(styleType: string): string {
  const normalized = styleType.toLowerCase().trim();
  for (const [key, value] of Object.entries(CONCEPT_TYPE_PROMPTS)) {
    if (normalized.includes(key.replace(/-/g, ' ')) || normalized.includes(value.label.toLowerCase())) {
      return `\nAD TYPE-SPECIFIC LAYOUT INSTRUCTIONS:\n${value.layoutInstructions}\nFollow the above layout instructions EXACTLY for this ad type.\n`;
    }
  }
  return '';
}

async function getGeminiApiKeyForImage(consultantId: string): Promise<string | null> {
  try {
    const [user] = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, consultantId))
      .limit(1);

    if (!user) return null;

    if (user.useSuperadminGemini !== false) {
      const superAdminKeys = await getSuperAdminGeminiKeys();
      if (superAdminKeys && superAdminKeys.keys.length > 0) {
        const index = Math.floor(Math.random() * superAdminKeys.keys.length);
        console.log(`🔑 [ADVISAGE-SERVER] Using SuperAdmin Gemini key (${index + 1}/${superAdminKeys.keys.length})`);
        return superAdminKeys.keys[index];
      }
    }

    const userApiKeys = (user.geminiApiKeys as string[]) || [];
    if (userApiKeys.length > 0) {
      const currentIndex = user.geminiApiKeyIndex || 0;
      const validIndex = currentIndex % userApiKeys.length;
      console.log(`🔑 [ADVISAGE-SERVER] Using consultant's Gemini key (${validIndex + 1}/${userApiKeys.length})`);
      return userApiKeys[validIndex];
    }

    console.error("[ADVISAGE-SERVER] No Gemini API keys available");
    return null;
  } catch (error) {
    console.error("[ADVISAGE-SERVER] Error fetching API key:", error);
    return null;
  }
}

export async function generateImageServerSide(
  consultantId: string,
  prompt: string,
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '1:1',
  variant: 'text' | 'clean' = 'clean',
  hookText?: string,
  styleType?: string
): Promise<{ imageUrl: string; error?: string }> {
  console.log(`[ADVISAGE-SERVER] Generating image for consultantId: ${consultantId}`);
  console.log(`[ADVISAGE-SERVER] Prompt: ${prompt.substring(0, 100)}...`);
  console.log(`[ADVISAGE-SERVER] Aspect ratio: ${aspectRatio}, variant: ${variant}${hookText ? ', hookText: ' + hookText.substring(0, 50) + '...' : ''}`);
  
  try {
    const apiKey = await getGeminiApiKeyForImage(consultantId);
    if (!apiKey) {
      return { 
        imageUrl: "", 
        error: "Nessuna chiave API Gemini disponibile" 
      };
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
    console.log(`[ADVISAGE-SERVER] Using model: ${IMAGE_MODEL}`);
    
    const adOptimizedPrompt = buildAdImagePrompt(prompt, aspectRatio, variant, hookText, styleType);
    
    const response = await trackedGenerateContent(ai, {
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts: [{ text: adOptimizedPrompt }] }] as any,
      config: { imageConfig: { aspectRatio } } as any
    }, { consultantId, feature: 'advisage', isImageOutput: true });
    
    const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    
    if (!part?.inlineData) {
      console.error("[ADVISAGE-SERVER] No image data in response");
      throw new Error("Generazione immagine fallita - nessun dato immagine nella risposta");
    }
    
    const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    
    console.log(`[ADVISAGE-SERVER] Image generated successfully, size: ${part.inlineData.data.length} bytes`);
    
    return { imageUrl };
    
  } catch (error: any) {
    console.error("[ADVISAGE-SERVER] Image generation error:", error.message);
    
    if (error.message?.includes("503") || error.message?.includes("overloaded")) {
      return { 
        imageUrl: "", 
        error: "Servizio temporaneamente non disponibile. Riprova tra qualche secondo." 
      };
    }
    
    return { 
      imageUrl: "", 
      error: error.message || "Generazione immagine fallita" 
    };
  }
}

export async function analyzeAndGenerateImage(
  consultantId: string,
  text: string,
  platform: string,
  settings: AdvisageSettings = { mood: 'professional', stylePreference: 'realistic' }
): Promise<{
  analysis: AdvisageAnalysis | null;
  imageUrl: string;
  error?: string;
}> {
  console.log(`[ADVISAGE-SERVER] Full pipeline: analyze + generate for ${platform}`);
  
  try {
    const analysis = await analyzeAdTextServerSide(consultantId, text, platform, settings);
    
    if (!analysis.concepts?.length) {
      console.log("[ADVISAGE-SERVER] No concepts generated, skipping image generation");
      return { analysis, imageUrl: "", error: "Nessun concept visuale generato" };
    }
    
    const firstConcept = analysis.concepts[0];
    const promptToUse = firstConcept.promptClean || firstConcept.description;
    
    let aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '1:1';
    const format = firstConcept.recommendedFormat;
    if (format === '4:5' || format === '3:4') {
      aspectRatio = '3:4';
    } else if (format === '9:16') {
      aspectRatio = '9:16';
    } else if (format === '16:9') {
      aspectRatio = '16:9';
    }
    
    const { imageUrl, error: imageError } = await generateImageServerSide(
      consultantId,
      promptToUse,
      aspectRatio
    );
    
    if (imageError) {
      console.log(`[ADVISAGE-SERVER] Image generation failed: ${imageError}`);
      return { analysis, imageUrl: "", error: imageError };
    }
    
    console.log(`[ADVISAGE-SERVER] Full pipeline complete!`);
    return { analysis, imageUrl };
    
  } catch (error: any) {
    console.error("[ADVISAGE-SERVER] Pipeline error:", error.message);
    return { 
      analysis: null, 
      imageUrl: "", 
      error: error.message || "Errore nella pipeline AdVisage" 
    };
  }
}
