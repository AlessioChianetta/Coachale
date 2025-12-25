import { db } from "../db";
import { libraryDocuments, youtubeVideos, libraryCategories, librarySubcategories } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { getAIProvider, getModelWithThinking, GEMINI_3_THINKING_LEVEL } from "../ai/provider-factory";
import { getAiLessonSettings } from "./youtube-service";
import { getThemeById, generateThemeInstructionsForAI, type CourseTheme } from "../../shared/course-themes";

interface GenerateLessonParams {
  consultantId: string;
  youtubeVideoId: string;
  categoryId: string;
  subcategoryId?: string;
  customInstructions?: string;
  level?: 'base' | 'intermedio' | 'avanzato';
  contentType?: 'text' | 'video' | 'both';
}

interface GeneratedLesson {
  title: string;
  subtitle: string;
  content: string;
  estimatedDuration: number;
  tags: string[];
}

export async function generateLessonFromVideo(params: GenerateLessonParams): Promise<{ success: boolean; lesson?: any; error?: string }> {
  try {
    console.log(`🎬 [AI-LESSON] Cercando video: ${params.youtubeVideoId}`);
    
    const [video] = await db
      .select()
      .from(youtubeVideos)
      .where(eq(youtubeVideos.id, params.youtubeVideoId));

    if (!video) {
      console.log(`❌ [AI-LESSON] Video non trovato: ${params.youtubeVideoId}`);
      return { success: false, error: 'Video not found' };
    }

    console.log(`📝 [AI-LESSON] Video: "${video.title}"`);

    if (!video.transcript) {
      console.log(`❌ [AI-LESSON] Nessuna trascrizione per: "${video.title}"`);
      return { success: false, error: 'Video transcript not available' };
    }

    console.log(`✅ [AI-LESSON] Trascrizione trovata: ${video.transcript.length} caratteri`);

    // Recupera il tema dalla categoria
    const [category] = await db
      .select()
      .from(libraryCategories)
      .where(eq(libraryCategories.id, params.categoryId));
    
    const themeId = (category as any)?.theme || 'classic';
    const theme = getThemeById(themeId);
    console.log(`🎨 [AI-LESSON] Tema corso: ${theme.name}`);

    const settings = await getAiLessonSettings(params.consultantId);
    const instructions = params.customInstructions || settings.writingInstructions || '';

    console.log(`🤖 [AI-LESSON] Inviando a Gemini per generazione lezione...`);
    const prompt = buildLessonPrompt(video, instructions, settings.preserveSpeakerStyle, theme);
    
    const providerResult = await getAIProvider(params.consultantId);
    if (!providerResult.client) {
      console.log(`❌ [AI-LESSON] Provider AI non disponibile`);
      return { success: false, error: 'AI provider not available' };
    }

    // Seleziona modello basato sul provider (Gemini 3 per Google AI Studio)
    const { model: selectedModel, useThinking } = getModelWithThinking(providerResult.metadata.name);
    console.log(`🤖 [AI-LESSON] Usando modello: ${selectedModel} (thinking: ${useThinking})`);

    const startTime = Date.now();
    const generateConfig: any = {
      model: selectedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 20000, // Permette lezioni molto dettagliate e lunghe
      }
    };
    
    // Aggiungi thinking config se supportato (Gemini 3)
    if (useThinking) {
      generateConfig.config = {
        ...generateConfig.config,
        thinkingConfig: {
          thinkingMode: "enabled",
          thinkingBudget: GEMINI_3_THINKING_LEVEL === "high" ? 16000 : 
                          GEMINI_3_THINKING_LEVEL === "medium" ? 8000 : 
                          GEMINI_3_THINKING_LEVEL === "low" ? 4000 : 2000,
        }
      };
    }
    
    console.log(`📝 [AI-LESSON] Config: maxOutputTokens=20000, thinking=${useThinking}`);
    const response = await providerResult.client.generateContent(generateConfig);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    const generatedText = response.response.text() || '';
    console.log(`✅ [AI-LESSON] Risposta Gemini ricevuta in ${elapsedTime}s (${generatedText.length} caratteri)`);
    
    const lessonData = parseLessonResponse(generatedText, video);
    const contentLength = lessonData.content?.length || 0;
    const wordCount = lessonData.content?.split(/\s+/).filter(Boolean).length || 0;
    console.log(`📊 [AI-LESSON] Contenuto generato: ${contentLength} caratteri, ~${wordCount} parole`);
    
    console.log(`💾 [AI-LESSON] Salvando lezione come bozza: "${lessonData.title}"`);
    const [lesson] = await db.insert(libraryDocuments).values({
      categoryId: params.categoryId,
      subcategoryId: params.subcategoryId || null,
      title: lessonData.title,
      subtitle: lessonData.subtitle,
      content: lessonData.content,
      contentType: params.contentType || settings.defaultContentType || 'both',
      videoUrl: video.videoUrl,
      level: params.level || settings.defaultLevel || 'base',
      estimatedDuration: lessonData.estimatedDuration,
      tags: lessonData.tags,
      isPublished: false,
      createdBy: params.consultantId,
      sourceType: 'youtube_ai',
      youtubeVideoId: video.id,
      aiGenerated: true,
      aiGenerationLog: {
        generatedAt: new Date().toISOString(),
        videoTitle: video.title,
        transcriptLength: video.transcript?.length || 0,
        instructions: instructions,
      },
    }).returning();

    console.log(`✅ [AI-LESSON] Lezione creata con successo: "${lessonData.title}"`);
    return { success: true, lesson };
  } catch (error: any) {
    console.error(`❌ [AI-LESSON] Errore:`, error.message || error);
    return { success: false, error: 'Failed to generate lesson' };
  }
}

function buildLessonPrompt(video: any, instructions: string, preserveSpeakerStyle: boolean, theme: CourseTheme): string {
  const styleInstruction = preserveSpeakerStyle 
    ? `IMPORTANTE: Mantieni ESATTAMENTE il tono, lo stile e le espressioni usate dal relatore nel video. Usa le sue parole e il suo modo di spiegare. Non parafrasare troppo, preserva la sua voce autentica.`
    : `Riscrivi il contenuto con un tono professionale e chiaro.`;

  const themeInstructions = generateThemeInstructionsForAI(theme);

  return `Sei un esperto nella creazione di contenuti formativi DETTAGLIATI e APPROFONDITI. Devi creare una lezione formativa COMPLETA e ESTESA basata sulla trascrizione di un video YouTube.

TITOLO VIDEO: ${video.title || 'Video senza titolo'}
CANALE: ${video.channelName || 'Canale sconosciuto'}

TRASCRIZIONE:
${video.transcript}

---

${styleInstruction}

${instructions ? `ISTRUZIONI DELL'UTENTE (PRIORITÀ MASSIMA - SEGUI ESATTAMENTE):\n${instructions}\n\n` : ''}

REQUISITI DI LUNGHEZZA E PROFONDITÀ:
- La lezione deve essere MOLTO DETTAGLIATA e APPROFONDITA
- Ogni sezione deve avere ALMENO 3-5 paragrafi di contenuto
- NON riassumere eccessivamente: espandi e approfondisci ogni concetto
- Se le istruzioni richiedono esempi, punti chiave, azioni, riflessioni, riepilogo: includili TUTTI in modo completo
- La lezione finale deve essere ALMENO 2000-3000 parole

${themeInstructions}

Genera una lezione formativa strutturata. Rispondi SOLO con il seguente formato JSON (senza markdown, senza backticks):

{
  "title": "Titolo della lezione (massimo 80 caratteri)",
  "subtitle": "Sottotitolo descrittivo (massimo 150 caratteri)",
  "content": "Contenuto HTML completo della lezione usando ESATTAMENTE le classi Tailwind CSS specificate sopra. NON usare markdown. Genera HTML valido con i tag e le classi fornite. Struttura la lezione con sezioni, box punti chiave, esempi e riepilogo.",
  "estimatedDuration": numero_minuti_lettura,
  "tags": ["tag1", "tag2", "tag3"]
}

Assicurati che:
1. Il contenuto sia HTML valido con le classi Tailwind specificate
2. Usa tutti gli elementi del tema: titoli, box punti chiave, esempi, note, azioni, riepilogo
3. Lo stile testuale rifletta quello del relatore originale
4. La struttura visiva sia quella del tema ${theme.name}
5. I tags siano pertinenti all'argomento`;
}

function parseLessonResponse(response: string, video: any): GeneratedLesson {
  try {
    let cleanJson = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // Rimuovi caratteri di controllo non validi in JSON (eccetto \n, \r, \t)
    cleanJson = cleanJson.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    const parsed = JSON.parse(cleanJson);
    
    return {
      title: parsed.title || video.title || 'Lezione senza titolo',
      subtitle: parsed.subtitle || '',
      content: parsed.content || '',
      estimatedDuration: parsed.estimatedDuration || Math.ceil((video.transcript?.length || 1000) / 1000),
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    
    // Fallback: prova a estrarre i campi con regex
    try {
      const titleMatch = response.match(/"title"\s*:\s*"([^"]+)"/);
      const subtitleMatch = response.match(/"subtitle"\s*:\s*"([^"]+)"/);
      const durationMatch = response.match(/"estimatedDuration"\s*:\s*(\d+)/);
      const tagsMatch = response.match(/"tags"\s*:\s*\[(.*?)\]/);
      
      // Estrai il content (più complesso perché contiene HTML con virgolette)
      const contentStartIndex = response.indexOf('"content"');
      let contentValue = '';
      if (contentStartIndex > -1) {
        // Trova l'inizio del valore content
        const colonIndex = response.indexOf(':', contentStartIndex);
        const valueStart = response.indexOf('"', colonIndex) + 1;
        
        // Trova la fine del content (cerca "estimatedDuration" o "tags" dopo)
        let valueEnd = -1;
        const possibleEndings = ['"estimatedDuration"', '"tags"', '",\n  "estimated', '",\n  "tags'];
        for (const ending of possibleEndings) {
          const idx = response.indexOf(ending, valueStart);
          if (idx > -1 && (valueEnd === -1 || idx < valueEnd)) {
            valueEnd = idx;
          }
        }
        
        if (valueEnd > valueStart) {
          // Vai indietro per trovare l'ultima virgoletta prima della virgola
          let endQuote = valueEnd - 1;
          while (endQuote > valueStart && response[endQuote] !== '"') {
            endQuote--;
          }
          contentValue = response.substring(valueStart, endQuote);
        }
      }
      
      const extractedTitle = titleMatch?.[1] || video.title || 'Lezione senza titolo';
      const extractedSubtitle = subtitleMatch?.[1] || '';
      const extractedDuration = durationMatch ? parseInt(durationMatch[1]) : Math.ceil((video.transcript?.length || 1000) / 1000);
      
      let extractedTags: string[] = [];
      if (tagsMatch?.[1]) {
        extractedTags = tagsMatch[1].split(',')
          .map(t => t.trim().replace(/^"|"$/g, ''))
          .filter(t => t.length > 0);
      }
      
      console.log('📝 [AI-LESSON] Fallback parsing successful, extracted title:', extractedTitle);
      
      return {
        title: extractedTitle,
        subtitle: extractedSubtitle,
        content: contentValue || response,
        estimatedDuration: extractedDuration,
        tags: extractedTags,
      };
    } catch (fallbackError) {
      console.error('Error in fallback parsing:', fallbackError);
      
      return {
        title: video.title || 'Lezione da video',
        subtitle: `Contenuto basato sul video di ${video.channelName || 'YouTube'}`,
        content: response,
        estimatedDuration: Math.ceil((video.transcript?.length || 1000) / 1000),
        tags: [],
      };
    }
  }
}

const BATCH_SIZE = 5; // Numero di lezioni generate in parallelo

export async function generateMultipleLessons(
  consultantId: string,
  videoIds: string[],
  categoryId: string,
  subcategoryId?: string,
  customInstructions?: string,
  level?: 'base' | 'intermedio' | 'avanzato',
  contentType?: 'text' | 'video' | 'both',
  onProgress?: (current: number, total: number, status: string, videoId?: string, videoTitle?: string, errorMessage?: string, logMessage?: string, batchInfo?: { batchNumber: number; totalBatches: number; batchVideoIds: string[] }) => void,
  onBatchComplete?: (batchNumber: number, completedLessonIds: string[]) => void
): Promise<{ success: boolean; lessons: any[]; errors: string[] }> {
  const lessons: any[] = [];
  const errors: string[] = [];

  // Divide videoIds in batch di 5
  const batches: string[][] = [];
  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    batches.push(videoIds.slice(i, i + BATCH_SIZE));
  }

  const totalBatches = batches.length;
  console.log(`🚀 [BATCH-LESSON] Avvio generazione: ${videoIds.length} video in ${totalBatches} batch da max ${BATCH_SIZE}`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchNumber = batchIndex + 1;
    
    console.log(`\n📦 [BATCH-LESSON] === Batch ${batchNumber}/${totalBatches} (${batch.length} video) ===`);

    // Notifica inizio batch
    if (onProgress) {
      batch.forEach((videoId, idx) => {
        const globalIndex = batchIndex * BATCH_SIZE + idx + 1;
        onProgress(globalIndex, videoIds.length, 'batch_start', videoId, undefined, undefined, 
          `🔄 Batch ${batchNumber}/${totalBatches} - Avvio generazione parallela...`,
          { batchNumber, totalBatches, batchVideoIds: batch });
      });
    }

    // Pre-carica info video per il batch
    const videoInfos = await Promise.all(
      batch.map(async (videoId) => {
        const [video] = await db
          .select()
          .from(youtubeVideos)
          .where(eq(youtubeVideos.id, videoId));
        return { videoId, video };
      })
    );

    // Genera lezioni in parallelo per questo batch
    const batchResults = await Promise.all(
      videoInfos.map(async ({ videoId, video }) => {
        const videoTitle = video?.title || 'Video';
        const hasTranscript = !!video?.transcript;
        const transcriptLength = video?.transcript?.length || 0;
        const globalIndex = videoIds.indexOf(videoId) + 1;

        console.log(`   📹 [${globalIndex}/${videoIds.length}] "${videoTitle}" - ${hasTranscript ? `${transcriptLength} chars` : 'no transcript'}`);

        if (onProgress) {
          onProgress(globalIndex, videoIds.length, 'generating', videoId, videoTitle, undefined,
            `🤖 Generazione AI in corso...`,
            { batchNumber, totalBatches, batchVideoIds: batch });
        }

        try {
          const result = await generateLessonFromVideo({
            consultantId,
            youtubeVideoId: videoId,
            categoryId,
            subcategoryId,
            customInstructions,
            level,
            contentType,
          });

          if (result.success && result.lesson) {
            console.log(`   ✅ [${globalIndex}/${videoIds.length}] Lezione creata: "${result.lesson.title}"`);
            if (onProgress) {
              onProgress(globalIndex, videoIds.length, 'completed', videoId, videoTitle, undefined,
                `✅ Lezione creata: "${result.lesson.title}"`,
                { batchNumber, totalBatches, batchVideoIds: batch });
            }
            return { success: true, lesson: result.lesson, videoId, videoTitle };
          } else {
            const errorMsg = result.error || 'Unknown error';
            console.log(`   ❌ [${globalIndex}/${videoIds.length}] Errore: ${errorMsg}`);
            if (onProgress) {
              onProgress(globalIndex, videoIds.length, 'error', videoId, videoTitle, errorMsg,
                `❌ ${errorMsg}`,
                { batchNumber, totalBatches, batchVideoIds: batch });
            }
            return { success: false, error: errorMsg, videoId, videoTitle };
          }
        } catch (err: any) {
          const errorMsg = err.message || 'Exception during generation';
          console.log(`   ❌ [${globalIndex}/${videoIds.length}] Exception: ${errorMsg}`);
          if (onProgress) {
            onProgress(globalIndex, videoIds.length, 'error', videoId, videoTitle, errorMsg,
              `❌ ${errorMsg}`,
              { batchNumber, totalBatches, batchVideoIds: batch });
          }
          return { success: false, error: errorMsg, videoId, videoTitle };
        }
      })
    );

    // Raccogli risultati del batch
    const batchLessonIds: string[] = [];
    for (const result of batchResults) {
      if (result.success && result.lesson) {
        lessons.push(result.lesson);
        batchLessonIds.push(result.lesson.id);
      } else if (result.error) {
        errors.push(`${result.videoTitle}: ${result.error}`);
      }
    }

    // Callback per salvare progresso dopo ogni batch
    if (onBatchComplete && batchLessonIds.length > 0) {
      onBatchComplete(batchNumber, batchLessonIds);
    }

    console.log(`   📊 Batch ${batchNumber} completato: ${batchLessonIds.length}/${batch.length} lezioni create`);

    // Pausa tra batch per non sovraccaricare API (solo se ci sono altri batch)
    if (batchIndex < batches.length - 1) {
      console.log(`   ⏳ Pausa 2s prima del prossimo batch...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n📊 [BATCH-LESSON] ===== COMPLETATO =====`);
  console.log(`   ✅ Lezioni create: ${lessons.length}/${videoIds.length}`);
  console.log(`   ❌ Errori: ${errors.length}`);

  return {
    success: lessons.length > 0,
    lessons,
    errors,
  };
}
