
import { AdAnalysis, AppSettings, SocialPlatform, PromptVisual, PROMPT_MAPPINGS } from "../types";
import { apiRequest } from "@/lib/queryClient";

export const analyzeAdText = async (text: string, platform: SocialPlatform, settings: AppSettings, conceptTypes?: string[], stylesMode?: 'manual' | 'auto'): Promise<AdAnalysis> => {
  const result = await apiRequest("POST", "/api/content/advisage/analyze", {
    text,
    platform,
    mood: settings.mood,
    stylePreference: settings.stylePreference,
    brandColor: settings.brandColor,
    brandFont: settings.brandFont,
    conceptTypes: conceptTypes?.length ? conceptTypes : undefined,
    stylesMode: stylesMode || 'manual',
  });
  
  if (!result.success) {
    throw new Error(result.error || "Analisi fallita");
  }
  
  return result.data;
};

export const generateImageConcept = async (
  prompt: string, 
  aspectRatio: string, 
  settings: AppSettings,
  variant: 'text' | 'clean' = 'clean',
  hookText?: string,
  styleType?: string,
  promptVisual?: PromptVisual,
  visualDescription?: string,
  originalText?: string
): Promise<string> => {
  const result = await apiRequest("POST", "/api/content/advisage/generate-image-server", {
    prompt,
    aspectRatio,
    variant,
    hookText: variant === 'text' ? hookText : undefined,
    styleType,
    promptVisual,
    visualDescription,
    originalText,
    mood: settings.mood,
    stylePreference: settings.stylePreference,
    brandColor: settings.brandColor,
    lightingStyle: settings.lightingStyle,
    colorGrading: settings.colorGrading,
    cameraAngle: settings.cameraAngle,
    backgroundStyle: settings.backgroundStyle,
    imageQuality: settings.imageQuality,
  });
  
  if (!result.success) {
    throw new Error(result.error || "Generazione immagine fallita");
  }
  
  return result.data.imageUrl;
};

export function buildPromptPreview(
  concept: { description: string; textContent: string; styleType: string; promptVisual?: PromptVisual },
  settings: AppSettings,
  variant: 'text' | 'clean',
  aspectRatio: string,
  originalText?: string
): string {
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

  const pv = concept.promptVisual;
  const isStructured = pv && pv.layout && pv.sezioni?.length > 0;

  let prompt = isStructured
    ? `Genera una fotografia pubblicitaria professionale seguendo queste specifiche.
Pensa come un fotografo commerciale in studio: composizione intenzionale, illuminazione da set professionale, materiali realistici con texture autentiche.`
    : `Genera una fotografia pubblicitaria professionale per inserzione Meta/Facebook.
Pensa come un fotografo commerciale in studio: composizione intenzionale, illuminazione da set professionale, materiali realistici con texture autentiche.`;

  // --- Common sections (mirrors server buildCommonSections exactly) ---
  if (originalText) {
    prompt += `\n\n═══ CONTESTO INSERZIONE (il testo pubblicitario da cui nasce questa immagine) ═══\n${originalText}`;
  }

  const moodDesc = PROMPT_MAPPINGS.mood[settings.mood] || PROMPT_MAPPINGS.mood.professional;
  prompt += `\n\n═══ ATMOSFERA / MOOD ═══\n${moodDesc}`;

  if (settings.brandColor) {
    prompt += `\n\n═══ COLORE BRAND ═══\nIl colore brand ${settings.brandColor} deve essere presente come accento visivo dominante: usalo per dettagli grafici, riflessi colorati, elementi di sfondo, bordi e punti focali.`;
  }

  const styleDesc = PROMPT_MAPPINGS.stylePreference[settings.stylePreference] || PROMPT_MAPPINGS.stylePreference.realistic;
  prompt += `\n\n═══ STILE ARTISTICO ═══\n${styleDesc}`;

  const lightDesc = PROMPT_MAPPINGS.lightingStyle[settings.lightingStyle || 'studio'] || PROMPT_MAPPINGS.lightingStyle.studio;
  prompt += `\n\n═══ ILLUMINAZIONE ═══\n${lightDesc}`;

  const colorDesc = PROMPT_MAPPINGS.colorGrading[settings.colorGrading || 'neutral'] || PROMPT_MAPPINGS.colorGrading.neutral;
  prompt += `\n\n═══ COLOR GRADING ═══\n${colorDesc}`;

  const camDesc = PROMPT_MAPPINGS.cameraAngle[settings.cameraAngle || 'standard'] || PROMPT_MAPPINGS.cameraAngle.standard;
  prompt += `\n\n═══ INQUADRATURA ═══\n${camDesc}`;

  const bgDesc = PROMPT_MAPPINGS.backgroundStyle[settings.backgroundStyle || 'studio'] || PROMPT_MAPPINGS.backgroundStyle.studio;
  prompt += `\n\n═══ SFONDO ═══\n${bgDesc}`;

  const formatLabel = formatGuide[aspectRatio] || formatGuide['1:1'];
  prompt += `\n\n═══ SPECIFICHE TECNICHE ═══\nFormato: ${formatLabel}`;
  prompt += `\nResa dei materiali: superfici con texture fisiche autentiche — riflessi, ombre portate, micro-dettagli visibili.`;

  prompt += `\n\n═══ RESA UMANA (se presenti persone) ═══
Pelle con texture naturale (pori, imperfezioni sottili), proporzioni anatomiche corrette, espressioni facciali naturali e non forzate, capelli con singole ciocche visibili, mani con 5 dita proporzionate.`;

  prompt += `\n\n═══ EVITA ASSOLUTAMENTE ═══
Artefatti AI, anatomia distorta, dita extra o mancanti, pelle plastificata o cerosa, occhi innaturali, testo storto/illeggibile/con errori ortografici, watermark, loghi non richiesti, look generico da stock photo, sfondi ripetitivi o pattern AI tipici.`;

  prompt += `\n\n═══ LIVELLO QUALITÀ ═══
Questa immagine deve competere con campagne pubblicitarie di brand come Nike, Apple, Audi. Qualità da rivista patinata, zero compromessi su dettagli e finiture.`;
  // --- End common sections ---

  // --- Content-specific sections ---
  if (isStructured) {
    prompt += `\n\n═══ LAYOUT ═══\nTipo: ${pv!.layout.tipo}`;
    if (pv!.layout.divisione) {
      prompt += `\nDivisione: ${pv!.layout.divisione}`;
    }
    for (const sezione of pv!.sezioni) {
      prompt += `\n\n═══ SEZIONE: ${sezione.nome.toUpperCase()} ═══`;
      prompt += `\nSfondo: ${sezione.sfondo}`;
      prompt += `\nSoggetto: ${sezione.soggetto}`;
      if (sezione.illuminazione) prompt += `\nIlluminazione: ${sezione.illuminazione}`;
      if (sezione.box_testi && sezione.box_testi.length > 0) {
        prompt += `\nTesti nei box${sezione.stile_box ? ` (${sezione.stile_box})` : ''}:`;
        sezione.box_testi.forEach((t, i) => {
          prompt += `\n  ${i + 1}. "${t}"`;
        });
      }
    }
    if (pv!.elemento_centrale) {
      prompt += `\n\n═══ ELEMENTO CENTRALE ═══\n${pv!.elemento_centrale}`;
    }
    if (variant === 'text' && pv!.hook_text) {
      prompt += `\n\n═══ TESTO HOOK (da renderizzare LEGGIBILE nell'immagine) ═══`;
      prompt += `\nTesto: "${pv!.hook_text.testo}"`;
      prompt += `\nPosizione: ${pv!.hook_text.posizione}`;
      prompt += `\nStile: ${pv!.hook_text.stile}`;
      prompt += `\nIl testo DEVE essere perfettamente leggibile, con alto contrasto rispetto allo sfondo.`;
      prompt += `\nOrtografia ESATTAMENTE come specificato — controlla lettera per lettera. Kerning uniforme, anti-aliasing pulito, font leggibile anche in miniatura.`;
    } else if (variant === 'clean') {
      prompt += `\n\n═══ REGOLA TESTO ═══\nNON inserire NESSUN testo, tipografia, logo o watermark nell'immagine. Solo visual puro.`;
    }
    if (pv!.colori_brand) {
      prompt += `\n\n═══ COLORI BRAND (dal concept) ═══\n${pv!.colori_brand}`;
    }
    if (pv!.note_aggiuntive) {
      prompt += `\n\n═══ NOTE AGGIUNTIVE ═══\n${pv!.note_aggiuntive}`;
    }
    prompt += `\n\nStile fotografico: ${pv!.stile_fotografico}`;
  } else {
    const textRule = variant === 'text' && concept.textContent
      ? `- TESTO OVERLAY: Renderizza il seguente testo in modo prominente nell'immagine come overlay tipografico bold, ad alto contrasto. Il testo DEVE essere PERFETTAMENTE LEGGIBILE. Font sans-serif moderno e pulito. Testo: "${concept.textContent}"
- STILE TESTO: Forte contrasto con lo sfondo — testo bianco con ombra scura, o testo scuro su barra gradiente chiara. Il testo deve catturare l'occhio per primo.
- Ortografia ESATTAMENTE come specificato — controlla lettera per lettera. Kerning uniforme, anti-aliasing pulito.`
      : `- NESSUN TESTO: NON inserire testo, tipografia, loghi o watermark nell'immagine. Solo visual puro.`;

    prompt += `\n\n${textRule}`;

    prompt += `\n\nSCENA DA FOTOGRAFARE:\n${concept.description}`;

    if (concept.description) {
      prompt += `\n\nRIFERIMENTO VISIVO (segui questa descrizione scena fedelmente):\n${concept.description}`;
    }
  }

  return prompt;
}
