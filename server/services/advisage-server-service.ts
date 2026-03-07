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

export interface PromptVisual {
  layout: {
    tipo: string;
    divisione?: string;
  };
  sezioni: Array<{
    nome: string;
    sfondo: string;
    soggetto: string;
    illuminazione?: string;
    box_testi?: string[];
    stile_box?: string;
  }>;
  elemento_centrale?: string;
  hook_text?: {
    testo: string;
    posizione: string;
    stile: string;
  };
  stile_fotografico: string;
  colori_brand?: string;
  note_aggiuntive?: string;
}

export interface VisualConcept {
  id: string;
  title: string;
  description: string;
  styleType: string;
  recommendedFormat: '1:1' | '4:5' | '9:16' | '16:9' | '3:4';
  promptClean: string;
  promptWithText: string;
  promptVisual?: PromptVisual;
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

⚠️ REGOLA FONDAMENTALE LINGUA: TUTTI i campi del JSON DEVONO essere in ITALIANO. Nessuna eccezione.

Analizza questo copy pubblicitario per ${platform.toUpperCase()}.
FACTORY SETTINGS: Mood: ${settings.mood}, Style: ${settings.stylePreference}. ${brandInfo}

TEXT: "${text}"

TASK: 
1. Crea 3 concept visuali (immagini) ottimizzati per inserzioni pubblicitarie ad alta conversione.
2. Crea 3 caption social (Emozionale, Tecnico, Diretto) con hashtag strategici.
3. Fornisci un breve vantaggio competitivo.

═══════════════════════════════════════════════════
LINEE GUIDA INSERZIONI IMMAGINE:
═══════════════════════════════════════════════════
- Visual che FERMANO LO SCROLL: alto contrasto, colori vividi, composizione dinamica.
- Formati: 1:1 (feed) e 9:16 (stories). Alterna il recommendedFormat.
- Usa i COLORI del brand in modo coerente.
- L'immagine deve trasmettere il MESSAGGIO a COLPO D'OCCHIO.
- Inserisci sempre una CALL TO ACTION visiva chiara.
- Visual che evocano EMOZIONI POSITIVE o mostrano RISULTATI DESIDERABILI.
- Rispetta le linee guida Facebook/Meta (testo max 20% dell'immagine).

═══════════════════════════════════════════════════
STRUTTURA TESTI INSERZIONE (socialCaptions):
═══════════════════════════════════════════════════
- AIDA o Think-Feel-Do come modelli di comunicazione.
- Elenchi puntati per USP. Paragrafi brevi.
- Riprova sociale, scarcity/urgency se pertinente.
- CTA chiara e diretta. Titolo < 125 caratteri.

${conceptTypeInstructions}

═══════════════════════════════════════════════════
⚠️ REGOLA CRITICA DI COERENZA PROMPT/DESCRIZIONE:
═══════════════════════════════════════════════════
I campi "promptClean" e "promptWithText" DEVONO descrivere ESATTAMENTE LA STESSA scena visiva del campo "description".
Sono la sua TRADUZIONE FEDELE in inglese per il modello di generazione immagine.
NON INVENTARE una scena diversa. NON sostituire elementi. NON generalizzare.
Se la "description" dice "una persona a sinistra che prende un antidolorifico", il prompt DEVE dire la stessa cosa.
Se la "description" descrive un layout split-screen con due metà, il prompt DEVE descrivere lo stesso layout.
L'immagine generata dal prompt DEVE corrispondere alla descrizione italiana mostrata all'utente.

═══════════════════════════════════════════════════
⚠️ CAMPO CRITICO: promptVisual (JSON strutturato per generazione immagine)
═══════════════════════════════════════════════════
Per ogni concept, DEVI generare un campo "promptVisual" che è un JSON strutturato con la DESCRIZIONE ESATTA di ogni elemento dell'immagine da generare.
Questo JSON verrà usato DIRETTAMENTE per generare l'immagine, quindi deve essere ESTREMAMENTE SPECIFICO e DETTAGLIATO.

REGOLE IMPORTANTI per promptVisual — pensa come un FOTOGRAFO COMMERCIALE:
- Descrivi la scena come un brief fotografico per uno studio professionale, non come una lista di keyword
- La struttura deve CORRISPONDERE ESATTAMENTE alla "description" del concept — sono la stessa scena
- SOGGETTI: descrivi come un fotografo — "flacone in vetro ambrato con etichetta nera su piano in marmo bianco, illuminato da softbox laterale con riflessi morbidi sulla superficie curva"
- PERSONE: età, corporatura, abbigliamento specifico, espressione naturale, postura — come un casting brief
- SFONDI: colore preciso, gradiente se presente, texture della superficie (opaco, lucido, tessuto, legno, cemento)
- ILLUMINAZIONE: specifica il setup come un fotografo — "luce principale softbox a 45° da sinistra, fill light morbida frontale, rim light dal retro per separazione"
- MATERIALI E TEXTURE: nomina i materiali specifici — "vetro satinato", "alluminio spazzolato", "pelle opaca", "legno di noce"
- BOX DI TESTO: specifica testi esatti, stile (font, colore, sfondo del box, bordi)
- Profondità di campo: indica dove il fuoco è nitido e dove sfuma
- TUTTO IN ITALIANO
- NON usare keyword spam ("8K, masterpiece, trending") — scrivi frasi narrative descrittive

Struttura promptVisual:
{
  "layout": { "tipo": "split-screen verticale 50/50 | composizione centrale | full-bleed | griglia 2x3 | ecc.", "divisione": "descrizione della divisione visiva (opzionale)" },
  "sezioni": [
    { "nome": "sinistra | destra | centro | sfondo | primo_piano | ecc.", "sfondo": "colore e tono specifico", "soggetto": "descrizione PRECISA e DETTAGLIATA del soggetto — cosa appare, come appare, espressione, postura, oggetti", "illuminazione": "tipo di luce specifica", "box_testi": ["testo 1", "testo 2"], "stile_box": "descrizione stile dei box testi" }
  ],
  "elemento_centrale": "elemento visivo che sta al centro o collega le sezioni (es: VS, freccia, badge)",
  "hook_text": { "testo": "il testo hook da mostrare LEGGIBILE nell'immagine", "posizione": "dove va posizionato (es: fascia inferiore, alto centro)", "stile": "stile tipografico (es: bold bianco con ombra scura, font sans-serif grande)" },
  "stile_fotografico": "fotorealistico | illustrazione | infografica | lifestyle | ecc. + dettagli",
  "colori_brand": "colori predominanti da usare",
  "note_aggiuntive": "qualsiasi dettaglio extra per la resa visiva"
}

═══════════════════════════════════════════════════
OUTPUT JSON VALIDO — TUTTO IN ITALIANO:
═══════════════════════════════════════════════════
{
  "tone": "stringa in italiano",
  "objective": "stringa in italiano", 
  "emotion": "stringa in italiano",
  "cta": "stringa in italiano, massimo 125 caratteri",
  "context": { "sector": "in italiano", "product": "in italiano", "target": "in italiano" },
  "concepts": [{
    "id": "string",
    "title": "titolo in italiano",
    "description": "descrizione dettagliata del visual in italiano — questa descrizione DEVE corrispondere ESATTAMENTE alla scena descritta in promptClean/promptWithText e promptVisual",
    "styleType": "tipologia inserzione (es: Call Out Benefici, Social Proof Avatar, Offerta / Headline USP, Noi vs Competitor, X Ragioni per Acquistare, Risultato Desiderabile)",
    "recommendedFormat": "1:1|9:16",
    "promptClean": "prompt in inglese per generazione immagine SENZA testo — TRADUZIONE FEDELE della description",
    "promptWithText": "prompt in inglese per generazione immagine CON testo hook overlay — TRADUZIONE FEDELE della description + istruzioni testo",
    "promptVisual": { "layout": {}, "sezioni": [], "stile_fotografico": "", "hook_text": {} },
    "textContent": "testo hook in italiano da mostrare nell'immagine",
    "reasoning": "spiegazione in italiano del perché questo visual converte"
  }],
  "socialCaptions": [{ "tone": "Emozionale o Tecnico o Diretto", "text": "caption completa in italiano", "hashtags": ["hashtag"] }],
  "competitiveEdge": "vantaggio competitivo in italiano"
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

function buildPromptFromVisualJSON(promptVisual: PromptVisual, aspectRatio: string, variant: 'text' | 'clean' = 'clean'): string {
  const formatGuide: Record<string, string> = {
    '1:1': 'Quadrato 1:1 (Instagram Feed)',
    '3:4': 'Verticale 3:4 (Instagram Post)',
    '4:3': 'Orizzontale 4:3 (Landscape)',
    '9:16': 'Verticale 9:16 (Stories/Reels)',
    '16:9': 'Orizzontale 16:9 (Facebook/LinkedIn)',
  };

  const formatLabel = formatGuide[aspectRatio] || formatGuide['1:1'];

  let prompt = `Genera una fotografia pubblicitaria professionale seguendo queste specifiche.
Pensa come un fotografo commerciale in studio: composizione intenzionale, illuminazione da set professionale, materiali realistici con texture autentiche.

═══ LAYOUT ═══
Tipo: ${promptVisual.layout.tipo}`;

  if (promptVisual.layout.divisione) {
    prompt += `\nDivisione: ${promptVisual.layout.divisione}`;
  }

  for (const sezione of promptVisual.sezioni) {
    prompt += `\n\n═══ SEZIONE: ${sezione.nome.toUpperCase()} ═══`;
    prompt += `\nSfondo: ${sezione.sfondo}`;
    prompt += `\nSoggetto: ${sezione.soggetto}`;
    if (sezione.illuminazione) {
      prompt += `\nIlluminazione: ${sezione.illuminazione}`;
    }
    if (sezione.box_testi && sezione.box_testi.length > 0) {
      prompt += `\nTesti nei box${sezione.stile_box ? ` (${sezione.stile_box})` : ''}:`;
      sezione.box_testi.forEach((t, i) => {
        prompt += `\n  ${i + 1}. "${t}"`;
      });
    }
  }

  if (promptVisual.elemento_centrale) {
    prompt += `\n\n═══ ELEMENTO CENTRALE ═══\n${promptVisual.elemento_centrale}`;
  }

  if (variant === 'text' && promptVisual.hook_text) {
    prompt += `\n\n═══ TESTO HOOK (da renderizzare LEGGIBILE nell'immagine) ═══`;
    prompt += `\nTesto: "${promptVisual.hook_text.testo}"`;
    prompt += `\nPosizione: ${promptVisual.hook_text.posizione}`;
    prompt += `\nStile: ${promptVisual.hook_text.stile}`;
    prompt += `\nIl testo DEVE essere perfettamente leggibile, con alto contrasto rispetto allo sfondo.`;
  } else if (variant === 'clean') {
    prompt += `\n\n═══ REGOLA TESTO ═══\nNON inserire NESSUN testo, tipografia, logo o watermark nell'immagine. Solo visual puro.`;
  }

  if (promptVisual.colori_brand) {
    prompt += `\n\n═══ COLORI BRAND ═══\n${promptVisual.colori_brand}`;
  }

  if (promptVisual.note_aggiuntive) {
    prompt += `\n\n═══ NOTE AGGIUNTIVE ═══\n${promptVisual.note_aggiuntive}`;
  }

  prompt += `\n\n═══ SPECIFICHE FOTOGRAFICHE ═══
Formato: ${formatLabel}
Stile: ${promptVisual.stile_fotografico}
Scattata con obiettivo professionale da 85mm f/1.8, profondità di campo selettiva per guidare l'attenzione.
Illuminazione da studio a tre punti: luce principale softbox a 45°, fill light morbida, rim light per separare dal fondo.
Resa dei materiali: superfici con texture fisiche autentiche — riflessi, ombre portate, micro-dettagli visibili.
Color grading cinematografico naturale — colori saturi ma credibili, mai artificiali o plastici.`;

  return prompt;
}

function buildLegacyImagePrompt(basePrompt: string, aspectRatio: string, variant: 'text' | 'clean' = 'clean', hookText?: string, styleType?: string, visualDescription?: string): string {
  const formatGuide: Record<string, string> = {
    '1:1': 'Formato quadrato 1:1 (Instagram Feed).',
    '3:4': 'Formato verticale 3:4 (Instagram Post).',
    '4:3': 'Formato orizzontale 4:3.',
    '9:16': 'Formato verticale 9:16 (Stories/Reels).',
    '16:9': 'Formato orizzontale 16:9 (Facebook/LinkedIn).',
  };

  const formatInstruction = formatGuide[aspectRatio] || formatGuide['1:1'];

  const textRule = variant === 'text' && hookText
    ? `- TESTO OVERLAY: Renderizza il seguente testo in modo prominente nell'immagine come overlay tipografico bold, ad alto contrasto. Il testo DEVE essere PERFETTAMENTE LEGGIBILE. Font sans-serif moderno e pulito. Testo: "${hookText}"
- STILE TESTO: Forte contrasto con lo sfondo — testo bianco con ombra scura, o testo scuro su barra gradiente chiara. Il testo deve catturare l'occhio per primo.`
    : `- NESSUN TESTO: NON inserire testo, tipografia, loghi o watermark nell'immagine. Solo visual puro.`;

  let layoutInstructions = '';
  if (styleType) {
    const normalized = styleType.toLowerCase().trim();
    for (const [key, value] of Object.entries(CONCEPT_TYPE_PROMPTS)) {
      if (normalized.includes(key.replace(/-/g, ' ')) || normalized.includes(value.label.toLowerCase())) {
        layoutInstructions = `\n═══ ISTRUZIONI LAYOUT SPECIFICHE ═══\n${value.layoutInstructions}\nSegui queste istruzioni ESATTAMENTE.\n`;
        break;
      }
    }
  }

  return `Genera una fotografia pubblicitaria professionale per inserzione Meta/Facebook.
Pensa come un fotografo commerciale in studio: composizione intenzionale, illuminazione da set professionale, materiali realistici con texture autentiche.

FORMATO: ${formatInstruction}

COMPOSIZIONE:
Composizione equilibrata con regola dei terzi. Soggetto principale su un punto focale. Gerarchia visiva chiara: hook in alto, soggetto al centro, CTA in basso.

ILLUMINAZIONE DA STUDIO:
Setup a tre punti — luce principale softbox a 45° per modellare il soggetto, fill light morbida per le ombre, rim light per separazione dal fondo. Ombre morbide e definite, mai illuminazione piatta.

RESA MATERIALI:
Ogni superficie deve avere texture fisica autentica — riflessi coerenti, ombre portate realistiche, micro-dettagli visibili. Niente superfici plastiche o artificiali.

PROFONDITÀ DI CAMPO:
Obiettivo 85mm f/1.8 — sfondo morbido con bokeh naturale, soggetto principale a fuoco nitido.

COLOR GRADING:
Colori saturi ma credibili, color grading cinematografico naturale. Contrasto calibrato per impatto visivo senza sembrare artificiale.

${textRule}
${layoutInstructions}
SCENA DA FOTOGRAFARE:
${basePrompt}
${visualDescription ? `\nRIFERIMENTO VISIVO (segui questa descrizione scena fedelmente):\n${visualDescription}` : ''}`;
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
  aspectRatio: string = '1:1',
  variant: 'text' | 'clean' = 'clean',
  hookText?: string,
  styleType?: string,
  promptVisual?: PromptVisual,
  visualDescription?: string
): Promise<{ imageUrl: string; error?: string }> {
  console.log(`[ADVISAGE-SERVER] Generating image for consultantId: ${consultantId}`);
  console.log(`[ADVISAGE-SERVER] Has promptVisual: ${!!promptVisual}, hasVisualDesc: ${!!visualDescription}, variant: ${variant}, aspectRatio: ${aspectRatio}`);
  
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
    
    let adOptimizedPrompt: string;
    if (promptVisual && promptVisual.layout && promptVisual.sezioni?.length > 0) {
      adOptimizedPrompt = buildPromptFromVisualJSON(promptVisual, aspectRatio, variant);
      console.log(`[ADVISAGE-SERVER] Using structured promptVisual (${adOptimizedPrompt.length} chars)`);
    } else {
      adOptimizedPrompt = buildLegacyImagePrompt(prompt, aspectRatio, variant, hookText, styleType, visualDescription);
      console.log(`[ADVISAGE-SERVER] Using legacy prompt (${adOptimizedPrompt.length} chars)`);
    }
    
    console.log(`[ADVISAGE-SERVER] ═══ PROMPT COMPLETO INVIATO AL MODELLO ═══`);
    console.log(adOptimizedPrompt);
    console.log(`[ADVISAGE-SERVER] ═══ FINE PROMPT (${adOptimizedPrompt.length} chars) ═══`);
    
    const response = await trackedGenerateContent(ai, {
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts: [{ text: adOptimizedPrompt }] }] as any,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio,
          imageSize: '2K',
        },
        thinkingConfig: {
          thinkingLevel: 'High',
        },
      } as any
    }, { consultantId, feature: 'advisage', isImageOutput: true });
    
    const allParts = response.candidates?.[0]?.content?.parts || [];
    const imageParts = allParts.filter((p: any) => p.inlineData && !p.thought);
    const part = imageParts.length > 0 ? imageParts[imageParts.length - 1] : allParts.find((p: any) => p.inlineData);
    
    if (!part?.inlineData) {
      console.error("[ADVISAGE-SERVER] No image data in response. Parts count:", allParts.length);
      throw new Error("Generazione immagine fallita - nessun dato immagine nella risposta");
    }
    
    const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    
    console.log(`[ADVISAGE-SERVER] Image generated successfully, size: ${part.inlineData.data.length} bytes, total parts: ${allParts.length}, image parts: ${imageParts.length}`);
    
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
      aspectRatio,
      'clean',
      undefined,
      firstConcept.styleType,
      firstConcept.promptVisual,
      firstConcept.description
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
