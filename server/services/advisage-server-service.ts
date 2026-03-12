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
  stylesMode?: 'manual' | 'auto';
}

export interface ImageGenOptions {
  originalText?: string;
  mood?: string;
  stylePreference?: string;
  brandColor?: string;
  lightingStyle?: string;
  colorGrading?: string;
  cameraAngle?: string;
  backgroundStyle?: string;
  imageQuality?: string;
}

const PROMPT_MAPPINGS = {
  mood: {
    luxury: 'Atmosfera di lusso sofisticato, materiali premium, finiture eleganti, palette toni caldi dorati e neutri profondi',
    energetic: 'Atmosfera dinamica e vibrante, colori saturi e contrastati, composizione diagonale che comunica movimento ed energia',
    professional: 'Atmosfera corporate e autorevole, colori sobri e raffinati, composizione pulita e ordinata',
    minimalist: 'Atmosfera zen e essenziale, ampi spazi negativi, palette monocromatica, composizione centrata e simmetrica',
    playful: 'Atmosfera giocosa e fresca, colori pastello vivaci, composizione asimmetrica e dinamica',
  } as Record<string, string>,
  stylePreference: {
    realistic: 'Fotografia professionale da studio. Obiettivo 85mm f/1.8, profondità di campo selettiva. Illuminazione da set a tre punti. Texture fisiche autentiche, resa materiali fotorealistica.',
    '3d-render': 'Rendering 3D fotorealistico con materiali PBR (Physically Based Rendering), ombre ray-traced precise, ambiente HDRI, superfici con riflessi e rifrazione accurati.',
    illustration: 'Illustrazione flat design professionale con colori solidi e ben bilanciati, linee pulite e definite, forme geometriche semplificate, stile editoriale moderno.',
    cyberpunk: 'Estetica cyber/neon futuristica, luci al neon blu elettrico e magenta, riflessi bagnati su superfici, atmosfera notturna urbana, effetti lens flare.',
    lifestyle: 'Fotografia lifestyle naturale, luce ambiente morbida, ambientazione quotidiana autentica, colori caldi e naturali, composizione spontanea ma curata.',
  } as Record<string, string>,
  lightingStyle: {
    studio: 'Illuminazione da studio a tre punti: luce principale softbox a 45° per modellare il soggetto, fill light morbida per le ombre, rim light per separazione dal fondo.',
    natural: 'Luce naturale golden hour, raggi caldi e morbidi, ombre lunghe e delicate, atmosfera calda e accogliente.',
    dramatic: 'Chiaroscuro drammatico, contrasto estremo tra luci e ombre, ombre nette e profonde, atmosfera intensa e cinematografica.',
    neon: 'Illuminazione neon colorata con riflessi cromatici multipli, atmosfera da club/urbana notturna, colori vividi che si riflettono sulle superfici.',
    soft: 'Luce diffusa ultra-morbida, zero ombre dure, atmosfera eterea e sognante, come luce filtrata da tende bianche.',
  } as Record<string, string>,
  colorGrading: {
    neutral: 'Color grading cinematografico naturale — colori saturi ma credibili, mai artificiali o plastici.',
    warm: 'Color grading caldo, tonalità ambrate e dorate, highlights caldi, atmosfera accogliente e invitante.',
    cold: 'Color grading freddo, tonalità blu e ciano dominanti, atmosfera invernale o tecnologica, contrasto pulito.',
    cinematic: 'Color grading cinematografico orange & teal (arancione nelle pelli, teal nelle ombre), contrasto profondo, look da film hollywoodiano.',
    vintage: 'Color grading vintage film analogico, grana leggera, colori leggermente desaturati con toni seppia, neri rialzati.',
    vibrant: 'Colori ultra-saturi e vivaci, contrasto alto, look pop commerciale d\'impatto, ogni colore spinto al massimo della vivacità.',
  } as Record<string, string>,
  cameraAngle: {
    standard: 'Inquadratura a livello degli occhi, composizione classica con regola dei terzi.',
    closeup: 'Close-up ravvicinato, dettaglio del soggetto con bokeh estremo, intimo e d\'impatto.',
    wideshot: 'Inquadratura ampia che include ambiente e contesto, il soggetto nel suo spazio.',
    flatlay: 'Flat lay dall\'alto (90°), oggetti disposti con cura su superficie piatta, composizione geometrica ordinata.',
    lowangle: 'Inquadratura dal basso verso l\'alto, effetto eroico e imponente, il soggetto domina la scena.',
    aerial: 'Vista aerea/drone, prospettiva dall\'alto che rivela pattern e composizione.',
  } as Record<string, string>,
  backgroundStyle: {
    studio: 'Sfondo studio fotografico con fondale infinito (cyclorama), pulito e professionale.',
    outdoor: 'Ambientazione esterna naturale, location reale con elementi ambientali autentici.',
    gradient: 'Sfondo gradiente morbido professionale, transizione cromatica elegante, nessun elemento di distrazione.',
    blur: 'Sfondo fortemente sfocato (bokeh f/1.4), soggetto completamente isolato e protagonista assoluto.',
    contextual: 'Sfondo contestuale che racconta una storia (ufficio, casa, negozio, palestra) — coerente con il messaggio dell\'inserzione.',
  } as Record<string, string>,
};

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

  const manualEntries = conceptTypes.filter(id => id.startsWith('manual:'));
  const standardIds = conceptTypes.filter(id => !id.startsWith('manual:'));

  const selectedTypes = standardIds
    .map(id => CONCEPT_TYPE_PROMPTS[id])
    .filter(Boolean);

  const manualDescriptions = manualEntries.map(e => e.replace('manual:', '').trim()).filter(Boolean);

  if (selectedTypes.length === 0 && manualDescriptions.length === 0) {
    return buildConceptTypeInstructions(undefined);
  }

  let instructions = `═══════════════════════════════════════════════════
TIPOLOGIE CONCEPT RICHIESTE (genera ESATTAMENTE queste):
═══════════════════════════════════════════════════
L'utente ha selezionato queste tipologie specifiche. Genera UN concept per ciascuna tipologia richiesta:\n`;

  if (selectedTypes.length > 0) {
    instructions += selectedTypes.map(t => `
- "${t.label}": ${t.layoutInstructions}`).join('\n');
  }

  if (manualDescriptions.length > 0) {
    instructions += `\n\n═══ TIPOLOGIE PERSONALIZZATE ═══
L'utente ha descritto manualmente queste tipologie aggiuntive. Genera UN concept per ciascuna, interpretando la descrizione come direzione creativa:`;
    manualDescriptions.forEach(desc => {
      instructions += `\n- TIPOLOGIA CUSTOM: "${desc}" — Interpreta questa descrizione e crea un concept visivo unico e coerente con il testo dell'inserzione. Assegna un titolo descrittivo nel campo title e usa "Custom" come styleType.`;
    });
  }

  const totalRequested = selectedTypes.length + manualDescriptions.length;
  instructions += `\n\n⚠️ REGOLE TASSATIVE:
- Genera ESATTAMENTE ${totalRequested} concept nell'array "concepts", UNO per ogni tipologia richiesta sopra.
- NON aggiungere concept extra di tipologie non richieste.
- NON sostituire le tipologie richieste con altre a tua scelta.
- Il campo "styleType" di ogni concept DEVE corrispondere ESATTAMENTE alla tipologia richiesta (in italiano).
- Se sono richieste ${totalRequested} tipologie, l'array concepts DEVE contenere esattamente ${totalRequested} elementi.`;

  return instructions;
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
  recommendedSettings?: {
    mood?: string;
    stylePreference?: string;
    lightingStyle?: string;
    colorGrading?: string;
    cameraAngle?: string;
    backgroundStyle?: string;
    imageFormat?: string;
    reasoning?: string;
  };
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
  const hasSpecificTypes = settings.conceptTypes && settings.conceptTypes.length > 0;
  const manualCount = settings.conceptTypes?.filter(id => id.startsWith('manual:')).length || 0;
  const standardCount = settings.conceptTypes?.filter(id => !id.startsWith('manual:') && CONCEPT_TYPE_PROMPTS[id]).length || 0;
  const requestedConceptCount = hasSpecificTypes ? (standardCount + manualCount) : 3;

  const prompt = `Sei un direttore creativo senior esperto in Facebook/Meta Ads ad alta conversione.

⚠️ REGOLA FONDAMENTALE LINGUA: TUTTI i campi del JSON DEVONO essere in ITALIANO. Nessuna eccezione.

Analizza questo copy pubblicitario per ${platform.toUpperCase()}.
FACTORY SETTINGS: Mood: ${settings.mood}, Style: ${settings.stylePreference}. ${brandInfo}
STYLES MODE: ${settings.stylesMode === 'auto' ? 'AUTOMATICO — scegli TU le impostazioni visive ottimali in base al contenuto dell\'ads' : 'MANUALE — usa le impostazioni specificate sopra'}

TEXT: "${text}"

TASK: 
1. Crea ESATTAMENTE ${requestedConceptCount} concept visuali (immagini) ottimizzati per inserzioni pubblicitarie ad alta conversione.${hasSpecificTypes ? ` ⚠️ L'UTENTE HA SCELTO TIPOLOGIE SPECIFICHE — genera SOLO le tipologie indicate sotto, NESSUNA altra.` : ''}
2. Crea 3 caption social (Emozionale, Tecnico, Diretto) con hashtag strategici.
3. Fornisci un breve vantaggio competitivo.
4. Suggerisci le impostazioni visive ottimali per questo specifico ads (recommendedSettings).

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
⚠️ HOOK TEXT — REGOLE FONDAMENTALI PER LEAD GENERATION:
═══════════════════════════════════════════════════
Il "textContent" e "hook_text.testo" sono il TESTO HOOK che appare nell'immagine pubblicitaria.
Questo testo ha UN UNICO OBIETTIVO: far dire al target "Sì, ho esattamente questo problema/desiderio — voglio saperne di più" affinché clicchi sull'annuncio e lasci i propri dati.

FORMULA HOOK VINCENTE (usa UNA di queste strutture):
1. PROBLEMA RICONOSCIBILE: Nomina un dolore specifico che il target VIVE OGNI GIORNO.
   Esempio: "Stanco di clienti che spariscono dopo il preventivo?" — NON: "Migliora le vendite"
2. DESIDERIO CONCRETO: Descrivi il RISULTATO che il target sogna, come se lo stesse già vivendo.
   Esempio: "Clienti che ti cercano. Ogni settimana." — NON: "Fai crescere il tuo business"
3. DOMANDA-SPECCHIO: Una domanda che il target legge e pensa "questo parla di me".
   Esempio: "Quanto tempo perdi a rincorrere lead che non convertono?" — NON: "Vuoi più clienti?"
4. CONTRASTO PRIMA/DOPO: Mostra la trasformazione in modo specifico.
   Esempio: "Da 2 clienti al mese a 2 a settimana" — NON: "Aumenta i tuoi guadagni"
5. STATISTICA/PROVOCAZIONE: Un dato o un'affermazione che interrompe il pattern mentale.
   Esempio: "Il 73% dei tuoi competitor lo fa già" — NON: "Non restare indietro"

REGOLE CRITICHE per hook:
- MASSIMO 8-12 parole. Se è più lungo, è troppo lungo. Il cervello lo deve elaborare in 1.5 secondi.
- SPECIFICO > generico. "Mal di schiena ogni mattina?" batte "Problemi di salute?"
- VIETATO: frasi vuote come "Scopri di più", "La soluzione per te", "Il futuro è qui", "Trasforma la tua vita"
- VIETATO: slogan motivazionali o frasi da poster. L'hook parla del PROBLEMA DEL CLIENTE, non del brand.
- USA il linguaggio REALE del target — come parlerebbero con un amico al bar, non in una presentazione.
- L'hook deve creare un MICRO-GAP di curiosità: "ho questo problema... come lo risolvono?"

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
  "hook_text": { "testo": "STESSO testo di textContent — l'hook che fa dire al target 'ho questo problema' (MAX 8-12 parole, specifico, zero fuffa)", "posizione": "dove va posizionato (es: fascia inferiore, alto centro)", "stile": "stile tipografico (es: bold bianco con ombra scura, font sans-serif grande)" },
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
    "textContent": "testo hook in italiano (MAX 8-12 parole) — deve far dire al target 'ho questo problema/desiderio, voglio saperne di più'. Usa le formule hook sopra: problema riconoscibile, desiderio concreto, domanda-specchio, contrasto prima/dopo, o statistica/provocazione",
    "reasoning": "spiegazione in italiano del perché questo visual converte"
  }],
  "socialCaptions": [{ "tone": "Emozionale o Tecnico o Diretto", "text": "caption completa in italiano", "hashtags": ["hashtag"] }],
  "competitiveEdge": "vantaggio competitivo in italiano",
  "recommendedSettings": {
    "mood": "professional | energetic | luxury | minimalist | playful — scegli il mood PIÙ ADATTO al contenuto dell'ads, al settore e al target",
    "stylePreference": "realistic | 3d-render | illustration | cyberpunk | lifestyle — scegli lo stile visivo migliore per questo tipo di prodotto/servizio",
    "lightingStyle": "studio | natural | dramatic | neon | soft — scegli l'illuminazione che meglio comunica l'emozione dell'ads",
    "colorGrading": "neutral | warm | cold | cinematic | vintage | vibrant — scegli il color grading che rafforza il messaggio",
    "cameraAngle": "standard | closeup | wideshot | flatlay | lowangle | aerial — scegli l'inquadratura più impattante per il visual",
    "backgroundStyle": "studio | outdoor | gradient | blur | contextual — scegli lo sfondo che valorizza il soggetto",
    "imageFormat": "1:1 | 4:5 | 9:16 | 16:9 | 4:3 | 2:3 | 3:2 | 5:4 | 21:9 — scegli il formato migliore per la piattaforma e il tipo di contenuto",
    "reasoning": "spiega in 1-2 frasi PERCHÉ hai scelto queste impostazioni per questo specifico ads"
  }
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

function buildCommonSections(opts: ImageGenOptions, aspectRatio: string): string {
  const formatGuide: Record<string, string> = {
    '1:1': 'Quadrato 1:1 (Instagram Feed)',
    '2:3': 'Verticale 2:3',
    '3:2': 'Orizzontale 3:2',
    '3:4': 'Verticale 3:4 (Instagram Post)',
    '4:3': 'Orizzontale 4:3 (Landscape)',
    '4:5': 'Verticale 4:5 (Instagram Portrait)',
    '5:4': 'Orizzontale 5:4',
    '9:16': 'Verticale 9:16 (Stories/Reels)',
    '16:9': 'Orizzontale 16:9 (Facebook/LinkedIn)',
    '21:9': 'Ultra-wide 21:9 (Cinematic)',
  };

  let sections = '';

  if (opts.originalText) {
    sections += `\n\n═══ CONTESTO INSERZIONE (il testo pubblicitario da cui nasce questa immagine) ═══\n${opts.originalText}`;
  }

  const moodDesc = PROMPT_MAPPINGS.mood[opts.mood || 'professional'] || PROMPT_MAPPINGS.mood.professional;
  sections += `\n\n═══ ATMOSFERA / MOOD ═══\n${moodDesc}`;

  if (opts.brandColor) {
    sections += `\n\n═══ COLORE BRAND ═══\nIl colore brand ${opts.brandColor} deve essere presente come accento visivo dominante: usalo per dettagli grafici, riflessi colorati, elementi di sfondo, bordi e punti focali.`;
  }

  const styleDesc = PROMPT_MAPPINGS.stylePreference[opts.stylePreference || 'realistic'] || PROMPT_MAPPINGS.stylePreference.realistic;
  sections += `\n\n═══ STILE ARTISTICO ═══\n${styleDesc}`;

  const lightDesc = PROMPT_MAPPINGS.lightingStyle[opts.lightingStyle || 'studio'] || PROMPT_MAPPINGS.lightingStyle.studio;
  sections += `\n\n═══ ILLUMINAZIONE ═══\n${lightDesc}`;

  const colorDesc = PROMPT_MAPPINGS.colorGrading[opts.colorGrading || 'neutral'] || PROMPT_MAPPINGS.colorGrading.neutral;
  sections += `\n\n═══ COLOR GRADING ═══\n${colorDesc}`;

  const camDesc = PROMPT_MAPPINGS.cameraAngle[opts.cameraAngle || 'standard'] || PROMPT_MAPPINGS.cameraAngle.standard;
  sections += `\n\n═══ INQUADRATURA ═══\n${camDesc}`;

  const bgDesc = PROMPT_MAPPINGS.backgroundStyle[opts.backgroundStyle || 'studio'] || PROMPT_MAPPINGS.backgroundStyle.studio;
  sections += `\n\n═══ SFONDO ═══\n${bgDesc}`;

  const formatLabel = formatGuide[aspectRatio] || formatGuide['1:1'];
  sections += `\n\n═══ SPECIFICHE TECNICHE ═══\nFormato: ${formatLabel}`;
  sections += `\nResa dei materiali: superfici con texture fisiche autentiche — riflessi, ombre portate, micro-dettagli visibili.`;

  sections += `\n\n═══ RESA UMANA (se presenti persone) ═══
Pelle con texture naturale (pori, imperfezioni sottili), proporzioni anatomiche corrette, espressioni facciali naturali e non forzate, capelli con singole ciocche visibili, mani con 5 dita proporzionate.`;

  sections += `\n\n═══ EVITA ASSOLUTAMENTE ═══
Artefatti AI, anatomia distorta, dita extra o mancanti, pelle plastificata o cerosa, occhi innaturali, testo storto/illeggibile/con errori ortografici, watermark, loghi non richiesti, look generico da stock photo, sfondi ripetitivi o pattern AI tipici.`;

  sections += `\n\n═══ LIVELLO QUALITÀ ═══
Questa immagine deve competere con campagne pubblicitarie di brand come Nike, Apple, Audi. Qualità da rivista patinata, zero compromessi su dettagli e finiture.`;

  return sections;
}

function buildPromptFromVisualJSON(promptVisual: PromptVisual, aspectRatio: string, variant: 'text' | 'clean' = 'clean', opts: ImageGenOptions = {}): string {
  let prompt = `Genera una fotografia pubblicitaria professionale seguendo queste specifiche.
Pensa come un fotografo commerciale in studio: composizione intenzionale, illuminazione da set professionale, materiali realistici con texture autentiche.`;

  prompt += buildCommonSections(opts, aspectRatio);

  prompt += `\n\n═══ LAYOUT ═══\nTipo: ${promptVisual.layout.tipo}`;

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
    prompt += `\nOrtografia ESATTAMENTE come specificato — controlla lettera per lettera. Kerning uniforme, anti-aliasing pulito, font leggibile anche in miniatura.`;
  } else if (variant === 'clean') {
    prompt += `\n\n═══ REGOLA TESTO ═══\nNON inserire NESSUN testo, tipografia, logo o watermark nell'immagine. Solo visual puro.`;
  }

  if (promptVisual.colori_brand) {
    prompt += `\n\n═══ COLORI BRAND (dal concept) ═══\n${promptVisual.colori_brand}`;
  }

  if (promptVisual.note_aggiuntive) {
    prompt += `\n\n═══ NOTE AGGIUNTIVE ═══\n${promptVisual.note_aggiuntive}`;
  }

  prompt += `\n\nStile fotografico: ${promptVisual.stile_fotografico}`;

  return prompt;
}

function buildLegacyImagePrompt(basePrompt: string, aspectRatio: string, variant: 'text' | 'clean' = 'clean', hookText?: string, styleType?: string, visualDescription?: string, opts: ImageGenOptions = {}): string {
  const textRule = variant === 'text' && hookText
    ? `- TESTO OVERLAY: Renderizza il seguente testo in modo prominente nell'immagine come overlay tipografico bold, ad alto contrasto. Il testo DEVE essere PERFETTAMENTE LEGGIBILE. Font sans-serif moderno e pulito. Testo: "${hookText}"
- STILE TESTO: Forte contrasto con lo sfondo — testo bianco con ombra scura, o testo scuro su barra gradiente chiara. Il testo deve catturare l'occhio per primo.
- Ortografia ESATTAMENTE come specificato — controlla lettera per lettera. Kerning uniforme, anti-aliasing pulito.`
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

  let prompt = `Genera una fotografia pubblicitaria professionale per inserzione Meta/Facebook.
Pensa come un fotografo commerciale in studio: composizione intenzionale, illuminazione da set professionale, materiali realistici con texture autentiche.`;

  prompt += buildCommonSections(opts, aspectRatio);

  prompt += `\n\n${textRule}`;
  prompt += layoutInstructions;
  prompt += `\n\nSCENA DA FOTOGRAFARE:\n${basePrompt}`;
  if (visualDescription) {
    prompt += `\n\nRIFERIMENTO VISIVO (segui questa descrizione scena fedelmente):\n${visualDescription}`;
  }

  return prompt;
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
  visualDescription?: string,
  opts: ImageGenOptions = {}
): Promise<{ imageUrl: string; error?: string }> {
  console.log(`[ADVISAGE-SERVER] Generating image for consultantId: ${consultantId}`);
  console.log(`[ADVISAGE-SERVER] Has promptVisual: ${!!promptVisual}, hasVisualDesc: ${!!visualDescription}, variant: ${variant}, aspectRatio: ${aspectRatio}`);
  console.log(`[ADVISAGE-SERVER] Options: mood=${opts.mood}, style=${opts.stylePreference}, light=${opts.lightingStyle}, color=${opts.colorGrading}, cam=${opts.cameraAngle}, bg=${opts.backgroundStyle}, quality=${opts.imageQuality}, hasOriginalText=${!!opts.originalText}`);
  
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
    
    const imageSize = opts.imageQuality === 'high' ? '4K' : '2K';
    
    let adOptimizedPrompt: string;
    if (promptVisual && promptVisual.layout && promptVisual.sezioni?.length > 0) {
      adOptimizedPrompt = buildPromptFromVisualJSON(promptVisual, aspectRatio, variant, opts);
      console.log(`[ADVISAGE-SERVER] Using structured promptVisual (${adOptimizedPrompt.length} chars)`);
    } else {
      adOptimizedPrompt = buildLegacyImagePrompt(prompt, aspectRatio, variant, hookText, styleType, visualDescription, opts);
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
          imageSize,
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
