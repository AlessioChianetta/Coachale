import { db } from "../db";
import { youtubeVideos, consultantAiLessonSettings } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';
import { getSubtitles } from 'youtube-caption-extractor';

interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelName: string;
  duration: number;
}

interface PlaylistVideo {
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
  position: number;
}

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&\n?#]+)/);
  return match ? match[1] : null;
}

export function isPlaylistUrl(url: string): boolean {
  return url.includes('list=');
}

export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch video metadata: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    return {
      videoId,
      title: data.title || '',
      description: '',
      thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      channelName: data.author_name || '',
      duration: 0,
    };
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    return null;
  }
}

export async function fetchTranscript(videoId: string, lang: string = 'it'): Promise<{ transcript: string; segments: TranscriptSegment[] } | null> {
  console.log(`🔍 [TRANSCRIPT] Cercando trascrizione per video: ${videoId}`);
  
  // METODO 1: youtube-caption-extractor (più affidabile per auto-generated)
  console.log(`🔍 [TRANSCRIPT] Metodo 1: youtube-caption-extractor`);
  const languagesToTry = [lang, 'en', 'it-IT', 'en-US'];
  
  for (const tryLang of languagesToTry) {
    try {
      console.log(`   📝 Tentativo lingua: ${tryLang}`);
      const subtitles = await getSubtitles({ videoID: videoId, lang: tryLang });
      
      if (subtitles && subtitles.length > 0) {
        const segments: TranscriptSegment[] = subtitles.map((item: any) => ({
          text: item.text || '',
          start: parseFloat(item.start) || 0,
          duration: parseFloat(item.dur) || 0,
        }));
        
        const fullTranscript = segments.map(s => s.text).join(' ').trim();
        
        if (fullTranscript.length > 0) {
          console.log(`✅ [TRANSCRIPT] Metodo 1 OK (${tryLang}): ${fullTranscript.length} caratteri, ${segments.length} segmenti`);
          return { transcript: fullTranscript, segments };
        }
      }
    } catch (error: any) {
      console.log(`   ⚠️ Lingua ${tryLang} fallita: ${error.message?.substring(0, 80)}`);
    }
  }
  
  // METODO 2: @danielxceron/youtube-transcript (fallback con InnerTube API)
  console.log(`🔍 [TRANSCRIPT] Metodo 2: InnerTube API fallback`);
  const langsForMethod2 = [lang, 'en', undefined];
  
  for (const tryLang of langsForMethod2) {
    try {
      const langLabel = tryLang || 'qualsiasi';
      console.log(`   📝 Tentativo lingua: ${langLabel}`);
      
      const config = tryLang ? { lang: tryLang } : undefined;
      const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, config);
      
      if (transcriptData && transcriptData.length > 0) {
        const segments: TranscriptSegment[] = transcriptData.map((item: any) => ({
          text: item.text || '',
          start: parseFloat(item.offset) / 1000 || 0,
          duration: parseFloat(item.duration) / 1000 || 0,
        }));
        
        const fullTranscript = segments.map(s => s.text).join(' ').trim();
        
        if (fullTranscript.length > 0) {
          console.log(`✅ [TRANSCRIPT] Metodo 2 OK (${langLabel}): ${fullTranscript.length} caratteri, ${segments.length} segmenti`);
          return { transcript: fullTranscript, segments };
        }
      }
    } catch (error: any) {
      const langLabel = tryLang || 'qualsiasi';
      console.log(`   ⚠️ Lingua ${langLabel} fallita: ${error.message?.substring(0, 80)}`);
    }
  }
  
  console.log(`❌ [TRANSCRIPT] Nessuna trascrizione disponibile per video: ${videoId}`);
  return null;
}

export async function fetchPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  try {
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    const response = await fetch(playlistUrl);
    const html = await response.text();
    
    const videos: PlaylistVideo[] = [];
    
    const initialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (!initialDataMatch) {
      console.error('Could not find playlist data');
      return [];
    }
    
    try {
      const data = JSON.parse(initialDataMatch[1]);
      const contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;
      
      if (contents) {
        for (let i = 0; i < contents.length; i++) {
          const item = contents[i]?.playlistVideoRenderer;
          if (item) {
            const videoId = item.videoId;
            const title = item.title?.runs?.[0]?.text || '';
            const thumbnail = item.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/default.jpg`;
            const lengthText = item.lengthText?.simpleText || '0:00';
            
            const timeParts = lengthText.split(':').map(Number);
            let duration = 0;
            if (timeParts.length === 3) {
              duration = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
            } else if (timeParts.length === 2) {
              duration = timeParts[0] * 60 + timeParts[1];
            }
            
            videos.push({
              videoId,
              videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
              title,
              thumbnailUrl: thumbnail,
              duration,
              position: i + 1,
            });
          }
        }
      }
    } catch (parseError) {
      console.error('Error parsing playlist data:', parseError);
    }
    
    return videos;
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return [];
  }
}

export async function saveVideoWithTranscript(
  consultantId: string,
  videoUrl: string,
  playlistId?: string,
  playlistTitle?: string
): Promise<{ success: boolean; video?: any; error?: string }> {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      console.log(`❌ [SAVE-VIDEO] URL non valido: ${videoUrl}`);
      return { success: false, error: 'Invalid YouTube URL' };
    }
    
    console.log(`📥 [SAVE-VIDEO] Caricando metadati per video: ${videoId}`);
    const metadata = await fetchVideoMetadata(videoId);
    if (!metadata) {
      console.log(`❌ [SAVE-VIDEO] Impossibile ottenere metadati per: ${videoId}`);
      return { success: false, error: 'Could not fetch video metadata' };
    }
    
    console.log(`📝 [SAVE-VIDEO] Video: "${metadata.title}" - Salvando in database...`);
    
    const [video] = await db.insert(youtubeVideos).values({
      consultantId,
      videoId,
      videoUrl,
      title: metadata.title,
      description: metadata.description,
      thumbnailUrl: metadata.thumbnailUrl,
      channelName: metadata.channelName,
      duration: metadata.duration,
      transcriptStatus: 'fetching',
      playlistId,
      playlistTitle,
    }).returning();
    
    console.log(`🔍 [SAVE-VIDEO] Cercando trascrizione per: "${metadata.title}"...`);
    const transcriptResult = await fetchTranscript(videoId);
    
    if (transcriptResult) {
      await db.update(youtubeVideos)
        .set({
          transcript: transcriptResult.transcript,
          transcriptStatus: 'completed',
          transcriptLanguage: 'it',
          updatedAt: new Date(),
        })
        .where(eq(youtubeVideos.id, video.id));
      
      video.transcript = transcriptResult.transcript;
      video.transcriptStatus = 'completed';
      console.log(`✅ [SAVE-VIDEO] "${metadata.title}" - Trascrizione salvata (${transcriptResult.transcript.length} caratteri)`);
    } else {
      await db.update(youtubeVideos)
        .set({
          transcriptStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(youtubeVideos.id, video.id));
      
      video.transcriptStatus = 'failed';
      console.log(`⚠️ [SAVE-VIDEO] "${metadata.title}" - Nessuna trascrizione disponibile`);
    }
    
    return { success: true, video };
  } catch (error: any) {
    console.error(`❌ [SAVE-VIDEO] Errore:`, error.message || error);
    return { success: false, error: 'Failed to save video' };
  }
}

export async function getAiLessonSettings(consultantId: string) {
  const [settings] = await db
    .select()
    .from(consultantAiLessonSettings)
    .where(eq(consultantAiLessonSettings.consultantId, consultantId));
  
  return settings || {
    writingInstructions: "Mantieni il tono e lo stile del relatore nel video. Usa le sue espressioni e il suo modo di spiegare i concetti. Struttura il testo in sezioni chiare e leggibili.",
    defaultContentType: 'both',
    defaultLevel: 'base',
    preserveSpeakerStyle: true,
    includeTimestamps: false,
  };
}

export async function saveAiLessonSettings(
  consultantId: string,
  settings: {
    writingInstructions?: string;
    defaultContentType?: string;
    defaultLevel?: string;
    preserveSpeakerStyle?: boolean;
    includeTimestamps?: boolean;
  }
) {
  const existing = await db
    .select()
    .from(consultantAiLessonSettings)
    .where(eq(consultantAiLessonSettings.consultantId, consultantId));
  
  if (existing.length > 0) {
    await db.update(consultantAiLessonSettings)
      .set({
        ...settings,
        updatedAt: new Date(),
      })
      .where(eq(consultantAiLessonSettings.consultantId, consultantId));
  } else {
    await db.insert(consultantAiLessonSettings).values({
      consultantId,
      ...settings,
    });
  }
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
