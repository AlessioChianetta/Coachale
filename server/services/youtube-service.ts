import { db } from "../db";
import { youtubeVideos, consultantAiLessonSettings } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';
import { getSubtitles } from 'youtube-caption-extractor';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from "@google/genai";
import { getSuperAdminGeminiKeys, GEMINI_LEGACY_MODEL } from "../ai/provider-factory";

const execAsync = promisify(exec);

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

interface TranscriptResult {
  transcript: string;
  segments: TranscriptSegment[];
  method: 'gemini' | 'subtitles' | 'manual';
}

// ==================== UTILITY FUNCTIONS ====================

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

// ==================== METODO 1: GEMINI (Audio Transcription) ====================

async function downloadAudioWithYtDlp(videoId: string): Promise<string | null> {
  const tempDir = '/tmp/yt-audio';
  const outputPath = path.join(tempDir, `${videoId}.mp3`);
  
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Pulisci file vecchi per questo video
    try {
      const oldFiles = fs.readdirSync(tempDir).filter(f => f.startsWith(videoId));
      oldFiles.forEach(f => fs.unlinkSync(path.join(tempDir, f)));
    } catch {}
    
    console.log(`   🎵 Scaricando audio per video: ${videoId}`);
    
    // yt-dlp scarica l'audio in formato mp3 (meno bloccato dei sottotitoli)
    const cmd = `yt-dlp -x --audio-format mp3 --audio-quality 5 -o "${path.join(tempDir, videoId)}.%(ext)s" "https://www.youtube.com/watch?v=${videoId}" 2>&1`;
    
    const { stdout, stderr } = await execAsync(cmd, { timeout: 180000 }); // 3 minuti timeout
    const output = stdout + stderr;
    
    if (output.includes('429') || output.includes('Too Many Requests')) {
      console.log(`   ⚠️ Rate limit (429) per download audio`);
      return null;
    }
    
    // Cerca il file mp3 scaricato
    const audioFiles = fs.readdirSync(tempDir).filter(f => f.startsWith(videoId) && f.endsWith('.mp3'));
    
    if (audioFiles.length > 0) {
      const audioPath = path.join(tempDir, audioFiles[0]);
      const stats = fs.statSync(audioPath);
      console.log(`   ✅ Audio scaricato: ${audioFiles[0]} (${Math.round(stats.size / 1024)} KB)`);
      return audioPath;
    }
    
    console.log(`   ⚠️ Nessun file audio trovato dopo download`);
    return null;
  } catch (error: any) {
    console.log(`   ⚠️ Errore download audio: ${error.message?.substring(0, 80)}`);
    return null;
  }
}

async function transcribeAudioWithGemini(audioPath: string): Promise<TranscriptResult | null> {
  // Ottieni API keys da SuperAdmin con rotazione
  const superAdminKeys = await getSuperAdminGeminiKeys();
  if (!superAdminKeys || superAdminKeys.keys.length === 0) {
    console.log(`   ⚠️ Nessuna chiave Gemini disponibile`);
    return null;
  }
  
  // Leggi il file audio come base64
  const audioBuffer = fs.readFileSync(audioPath);
  const audioBase64 = audioBuffer.toString('base64');
  const fileSizeMB = audioBuffer.length / (1024 * 1024);
  
  console.log(`   🤖 Inviando audio a Gemini (${fileSizeMB.toFixed(2)} MB)...`);
  
  // Prova ogni chiave con rotazione random (come getGoogleAIStudioClientForFileSearch)
  const keysToTry = [...superAdminKeys.keys];
  const startIndex = Math.floor(Math.random() * keysToTry.length);
  
  for (let attempt = 0; attempt < keysToTry.length; attempt++) {
    const keyIndex = (startIndex + attempt) % keysToTry.length;
    const apiKey = keysToTry[keyIndex];
    
    try {
      console.log(`   🔑 Tentativo ${attempt + 1}/${keysToTry.length} (chiave ${keyIndex + 1})`);
      
      const ai = new GoogleGenAI({ apiKey });
      
      // Usa Gemini per trascrivere (modello legacy per audio con inlineData)
      const response = await ai.models.generateContent({
        model: GEMINI_LEGACY_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "audio/mpeg",
                  data: audioBase64
                }
              },
              {
                text: `Trascrivi questo audio in italiano. 
Requisiti:
- Trascrivi fedelmente tutto il parlato
- Mantieni il tono e le espressioni originali del relatore
- Includi punteggiatura corretta
- Non aggiungere interpretazioni o commenti
- Restituisci SOLO la trascrizione, senza intestazioni o note`
              }
            ]
          }
        ],
        config: {
          maxOutputTokens: 8192,
          temperature: 0.1
        }
      });
      
      const transcript = response.text?.trim() || '';
      
      if (transcript.length > 50) {
        console.log(`   ✅ Trascrizione Gemini completata: ${transcript.length} caratteri`);
        
        // Crea segmenti semplici (senza timing preciso)
        const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const segments: TranscriptSegment[] = sentences.map((text, index) => ({
          text: text.trim(),
          start: index * 10,
          duration: 10
        }));
        
        return { transcript, segments, method: 'gemini' };
      }
      
      console.log(`   ⚠️ Trascrizione Gemini troppo corta: ${transcript.length} caratteri`);
      return null;
      
    } catch (error: any) {
      const errMsg = error.message || '';
      // Se è un errore di quota/rate limit, prova la prossima chiave
      if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
        console.log(`   ⚠️ Chiave ${keyIndex + 1} rate limited, provo la prossima...`);
        continue;
      }
      // Altri errori: log e fallisce
      console.log(`   ⚠️ Errore trascrizione Gemini: ${errMsg.substring(0, 80)}`);
      return null;
    }
  }
  
  console.log(`   ⚠️ Tutte le chiavi Gemini esaurite`);
  return null;
}

async function fetchTranscriptWithGemini(videoId: string): Promise<TranscriptResult | null> {
  console.log(`🔍 [TRANSCRIPT] Metodo Gemini: download audio + trascrizione AI`);
  
  try {
    // Step 1: Scarica audio
    const audioPath = await downloadAudioWithYtDlp(videoId);
    if (!audioPath) {
      return null;
    }
    
    // Step 2: Trascrivi con Gemini
    const result = await transcribeAudioWithGemini(audioPath);
    
    // Cleanup: elimina file audio
    try {
      fs.unlinkSync(audioPath);
      console.log(`   🧹 File audio eliminato`);
    } catch {}
    
    return result;
  } catch (error: any) {
    console.log(`   ⚠️ Metodo Gemini fallito: ${error.message?.substring(0, 80)}`);
    return null;
  }
}

// ==================== METODO 2: SOTTOTITOLI (yt-dlp + librerie JS) ====================

function parseVttToSegments(vttContent: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = vttContent.split('\n');
  
  let currentStart = 0;
  let currentDuration = 0;
  let currentText = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (timeMatch) {
      if (currentText) {
        segments.push({ text: currentText.trim(), start: currentStart, duration: currentDuration });
      }
      
      currentStart = parseVttTime(timeMatch[1]);
      const endTime = parseVttTime(timeMatch[2]);
      currentDuration = endTime - currentStart;
      currentText = '';
    } else if (line && !line.startsWith('WEBVTT') && !line.startsWith('Kind:') && !line.startsWith('Language:') && !line.match(/^\d+$/)) {
      const cleanText = line.replace(/<[^>]*>/g, '').trim();
      if (cleanText) {
        currentText += (currentText ? ' ' : '') + cleanText;
      }
    }
  }
  
  if (currentText) {
    segments.push({ text: currentText.trim(), start: currentStart, duration: currentDuration });
  }
  
  // Deduplica segmenti
  const uniqueSegments: TranscriptSegment[] = [];
  const seenTexts = new Set<string>();
  for (const seg of segments) {
    if (!seenTexts.has(seg.text)) {
      seenTexts.add(seg.text);
      uniqueSegments.push(seg);
    }
  }
  
  return uniqueSegments;
}

function parseVttTime(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

async function fetchSubtitlesWithYtDlp(videoId: string, lang: string = 'it'): Promise<TranscriptResult | null> {
  const tempDir = '/tmp/yt-transcripts';
  const outputPath = path.join(tempDir, videoId);
  
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Pulisci file vecchi
    try {
      const oldFiles = fs.readdirSync(tempDir).filter(f => f.startsWith(videoId));
      oldFiles.forEach(f => fs.unlinkSync(path.join(tempDir, f)));
    } catch {}
    
    const langsToTry = [lang, 'en', 'it.*', 'en.*'];
    
    for (const tryLang of langsToTry) {
      try {
        console.log(`   📝 yt-dlp tentativo lingua: ${tryLang}`);
        
        const cmd = `yt-dlp --write-auto-subs --skip-download --sub-lang "${tryLang}" --sub-format "vtt" --extractor-args "youtube:player_skip=webpage,configs" --socket-timeout 10 -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}" 2>&1`;
        
        const { stdout, stderr } = await execAsync(cmd, { timeout: 45000 });
        const output = stdout + stderr;
        
        if (output.includes('429') || output.includes('Too Many Requests')) {
          console.log(`   ⚠️ Rate limit (429) per sottotitoli`);
          continue;
        }
        
        const vttFiles = fs.readdirSync(tempDir).filter(f => f.startsWith(videoId) && f.endsWith('.vtt'));
        
        for (const vttFile of vttFiles) {
          const vttPath = path.join(tempDir, vttFile);
          const vttContent = fs.readFileSync(vttPath, 'utf-8');
          
          const segments = parseVttToSegments(vttContent);
          const fullTranscript = segments.map(s => s.text).join(' ').trim();
          
          try { fs.unlinkSync(vttPath); } catch {}
          
          if (fullTranscript.length > 50) {
            return { transcript: fullTranscript, segments, method: 'subtitles' };
          }
        }
      } catch (cmdError: any) {
        console.log(`   ⚠️ yt-dlp lingua ${tryLang} fallita`);
      }
    }
    
    return null;
  } catch (error: any) {
    console.log(`   ⚠️ yt-dlp sottotitoli fallito: ${error.message?.substring(0, 80)}`);
    return null;
  }
}

async function fetchSubtitlesWithJsLibraries(videoId: string, lang: string = 'it'): Promise<TranscriptResult | null> {
  // Metodo A: youtube-caption-extractor
  console.log(`   📝 Tentativo youtube-caption-extractor`);
  const languagesToTry = [lang, 'en', 'it-IT', 'en-US'];
  
  for (const tryLang of languagesToTry) {
    try {
      const subtitles = await getSubtitles({ videoID: videoId, lang: tryLang });
      
      if (subtitles && subtitles.length > 0) {
        const segments: TranscriptSegment[] = subtitles.map((item: any) => ({
          text: item.text || '',
          start: parseFloat(item.start) || 0,
          duration: parseFloat(item.dur) || 0,
        }));
        
        const fullTranscript = segments.map(s => s.text).join(' ').trim();
        
        if (fullTranscript.length > 0) {
          console.log(`   ✅ youtube-caption-extractor OK (${tryLang}): ${fullTranscript.length} caratteri`);
          return { transcript: fullTranscript, segments, method: 'subtitles' };
        }
      }
    } catch (error: any) {
      // Silent fail, try next
    }
  }
  
  // Metodo B: InnerTube API
  console.log(`   📝 Tentativo InnerTube API`);
  const langsForInnerTube = [lang, 'en', undefined];
  
  for (const tryLang of langsForInnerTube) {
    try {
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
          console.log(`   ✅ InnerTube API OK: ${fullTranscript.length} caratteri`);
          return { transcript: fullTranscript, segments, method: 'subtitles' };
        }
      }
    } catch (error: any) {
      // Silent fail
    }
  }
  
  return null;
}

async function fetchTranscriptWithSubtitles(videoId: string, lang: string = 'it'): Promise<TranscriptResult | null> {
  console.log(`🔍 [TRANSCRIPT] Metodo Sottotitoli: yt-dlp + librerie JS`);
  
  // Prima prova yt-dlp
  const ytdlpResult = await fetchSubtitlesWithYtDlp(videoId, lang);
  if (ytdlpResult) {
    console.log(`✅ [TRANSCRIPT] yt-dlp sottotitoli OK: ${ytdlpResult.transcript.length} caratteri`);
    return ytdlpResult;
  }
  
  // Poi prova librerie JS
  const jsResult = await fetchSubtitlesWithJsLibraries(videoId, lang);
  if (jsResult) {
    console.log(`✅ [TRANSCRIPT] Librerie JS OK: ${jsResult.transcript.length} caratteri`);
    return jsResult;
  }
  
  return null;
}

// ==================== FUNZIONE PRINCIPALE ====================

export async function fetchTranscript(videoId: string, lang: string = 'it'): Promise<{ transcript: string; segments: TranscriptSegment[] } | null> {
  console.log(`🔍 [TRANSCRIPT] Cercando trascrizione per video: ${videoId}`);
  
  // METODO 1: Gemini (download audio + trascrizione AI) - Qualità premium
  const geminiResult = await fetchTranscriptWithGemini(videoId);
  if (geminiResult) {
    console.log(`✅ [TRANSCRIPT] Metodo Gemini completato: ${geminiResult.transcript.length} caratteri`);
    return { transcript: geminiResult.transcript, segments: geminiResult.segments };
  }
  
  // METODO 2: Sottotitoli (yt-dlp + librerie JS) - Fallback
  const subtitlesResult = await fetchTranscriptWithSubtitles(videoId, lang);
  if (subtitlesResult) {
    console.log(`✅ [TRANSCRIPT] Metodo Sottotitoli completato: ${subtitlesResult.transcript.length} caratteri`);
    return { transcript: subtitlesResult.transcript, segments: subtitlesResult.segments };
  }
  
  console.log(`❌ [TRANSCRIPT] Nessuna trascrizione disponibile per video: ${videoId}`);
  return null;
}

// ==================== PLAYLIST & VIDEO MANAGEMENT ====================

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

// ==================== SETTINGS ====================

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
