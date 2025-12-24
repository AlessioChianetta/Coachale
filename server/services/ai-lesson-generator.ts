import { db } from "../db";
import { libraryDocuments, youtubeVideos, libraryCategories, librarySubcategories } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { getAIProvider } from "../ai/provider-factory";
import { getAiLessonSettings } from "./youtube-service";

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
    const [video] = await db
      .select()
      .from(youtubeVideos)
      .where(eq(youtubeVideos.id, params.youtubeVideoId));

    if (!video) {
      return { success: false, error: 'Video not found' };
    }

    if (!video.transcript) {
      return { success: false, error: 'Video transcript not available' };
    }

    const settings = await getAiLessonSettings(params.consultantId);
    const instructions = params.customInstructions || settings.writingInstructions || '';

    const prompt = buildLessonPrompt(video, instructions, settings.preserveSpeakerStyle);
    
    const providerResult = await getAIProvider(params.consultantId);
    if (!providerResult.client) {
      return { success: false, error: 'AI provider not available' };
    }

    const response = await providerResult.client.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const generatedText = response.response.text() || '';
    
    const lessonData = parseLessonResponse(generatedText, video);
    
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
      isPublished: true,
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

    return { success: true, lesson };
  } catch (error) {
    console.error('Error generating lesson:', error);
    return { success: false, error: 'Failed to generate lesson' };
  }
}

function buildLessonPrompt(video: any, instructions: string, preserveSpeakerStyle: boolean): string {
  const styleInstruction = preserveSpeakerStyle 
    ? `IMPORTANTE: Mantieni ESATTAMENTE il tono, lo stile e le espressioni usate dal relatore nel video. Usa le sue parole e il suo modo di spiegare. Non parafrasare troppo, preserva la sua voce autentica.`
    : `Riscrivi il contenuto con un tono professionale e chiaro.`;

  return `Sei un esperto nella creazione di contenuti formativi. Devi creare una lezione formativa basata sulla trascrizione di un video YouTube.

TITOLO VIDEO: ${video.title || 'Video senza titolo'}
CANALE: ${video.channelName || 'Canale sconosciuto'}

TRASCRIZIONE:
${video.transcript}

---

${styleInstruction}

${instructions ? `ISTRUZIONI AGGIUNTIVE DELL'UTENTE:\n${instructions}\n\n` : ''}

Genera una lezione formativa strutturata. Rispondi SOLO con il seguente formato JSON (senza markdown, senza backticks):

{
  "title": "Titolo della lezione (massimo 80 caratteri)",
  "subtitle": "Sottotitolo descrittivo (massimo 150 caratteri)",
  "content": "Contenuto completo della lezione in formato Markdown. Usa ## per i titoli delle sezioni, **grassetto** per i concetti chiave, elenchi puntati per i punti importanti. Il contenuto deve essere ben strutturato e formativo.",
  "estimatedDuration": numero_minuti_lettura,
  "tags": ["tag1", "tag2", "tag3"]
}

Assicurati che:
1. Il contenuto sia formativo e strutturato in sezioni chiare
2. I concetti chiave siano evidenziati
3. Lo stile rifletta quello del relatore originale
4. I tags siano pertinenti all'argomento`;
}

function parseLessonResponse(response: string, video: any): GeneratedLesson {
  try {
    const cleanJson = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
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
    
    return {
      title: video.title || 'Lezione da video',
      subtitle: `Contenuto basato sul video di ${video.channelName || 'YouTube'}`,
      content: response,
      estimatedDuration: Math.ceil((video.transcript?.length || 1000) / 1000),
      tags: [],
    };
  }
}

export async function generateMultipleLessons(
  consultantId: string,
  videoIds: string[],
  categoryId: string,
  subcategoryId?: string,
  customInstructions?: string,
  level?: 'base' | 'intermedio' | 'avanzato',
  contentType?: 'text' | 'video' | 'both',
  onProgress?: (current: number, total: number, status: string, videoTitle?: string) => void
): Promise<{ success: boolean; lessons: any[]; errors: string[] }> {
  const lessons: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < videoIds.length; i++) {
    const videoId = videoIds[i];
    
    const [video] = await db
      .select()
      .from(youtubeVideos)
      .where(eq(youtubeVideos.id, videoId));

    if (onProgress) {
      onProgress(i + 1, videoIds.length, 'generating', video?.title || 'Video');
    }

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
      lessons.push(result.lesson);
    } else {
      errors.push(`${video?.title || videoId}: ${result.error}`);
    }

    if (i < videoIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return {
    success: lessons.length > 0,
    lessons,
    errors,
  };
}
