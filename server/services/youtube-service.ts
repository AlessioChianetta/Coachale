import { db } from "../db";
import { youtubeVideos, consultantAiLessonSettings, aiUsageStats } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

// Helper per tracciare uso API
export async function trackAiUsage(params: {
  consultantId: string;
  operationType: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  modelUsed?: string;
  videoId?: string;
  lessonId?: string;
}) {
  try {
    const inputTkns = params.inputTokens ?? 0;
    const outputTkns = params.outputTokens ?? 0;
    await db.insert(aiUsageStats).values({
      consultantId: params.consultantId,
      operationType: params.operationType,
      inputTokens: inputTkns,
      outputTokens: outputTkns,
      totalTokens: params.totalTokens ?? (inputTkns + outputTkns),
      modelUsed: params.modelUsed,
      videoId: params.videoId,
      lessonId: params.lessonId,
    });
  } catch (err) {
    console.log(`⚠️ [AI-STATS] Errore salvataggio stats:`, err);
  }
}
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';
import { getSubtitles } from 'youtube-caption-extractor';
import { exec, execFile } from 'child_process';
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

async function downloadAudioWithYtDlp(videoId: string, maxRetries: number = 3): Promise<string | null> {
  const tempDir = '/tmp/yt-audio';
  
  console.log(`      📁 Directory temporanea: ${tempDir}`);
  console.log(`      🔄 Max tentativi: ${maxRetries}`);
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log(`      📁 Directory creata: ${tempDir}`);
      }
      
      // Pulisci file vecchi per questo video
      try {
        const oldFiles = fs.readdirSync(tempDir).filter(f => f.startsWith(videoId));
        if (oldFiles.length > 0) {
          oldFiles.forEach(f => fs.unlinkSync(path.join(tempDir, f)));
          console.log(`      🧹 Puliti ${oldFiles.length} file vecchi`);
        }
      } catch {}
      
      if (retry > 0) {
        const waitTime = 2000 * retry;
        console.log(`      🔄 RETRY ${retry}/${maxRetries - 1} - Attesa ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      console.log(`      🎵 Esecuzione: python -m yt_dlp (tentativo ${retry + 1}/${maxRetries})`);
      console.log(`      📹 URL: https://www.youtube.com/watch?v=${videoId}`);
      
      // Usa python -m yt_dlp per la versione aggiornata
      // --js-runtimes node richiesto per YouTube dal Nov 2024
      const cmd = `python -m yt_dlp --js-runtimes node -x --audio-format mp3 --audio-quality 5 -o "${path.join(tempDir, videoId)}.%(ext)s" "https://www.youtube.com/watch?v=${videoId}" 2>&1`;
      
      const { stdout, stderr } = await execAsync(cmd, { timeout: 180000 }); // 3 minuti timeout
      const output = stdout + stderr;
      
      // Log output parziale per debug
      if (output.length > 0) {
        const outputLines = output.split('\n').filter(l => l.trim()).slice(-5);
        console.log(`      📋 Output yt-dlp (ultime righe):`);
        outputLines.forEach(line => console.log(`         ${line.substring(0, 100)}`));
      }
      
      if (output.includes('429') || output.includes('Too Many Requests')) {
        console.log(`      ⚠️ RATE LIMIT (429) - YouTube ha bloccato la richiesta`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      // Cerca il file mp3 scaricato
      const audioFiles = fs.readdirSync(tempDir).filter(f => f.startsWith(videoId) && f.endsWith('.mp3'));
      
      if (audioFiles.length > 0) {
        const audioPath = path.join(tempDir, audioFiles[0]);
        const stats = fs.statSync(audioPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`      ✅ FILE AUDIO SCARICATO: ${audioFiles[0]}`);
        console.log(`      📊 Dimensione: ${sizeMB} MB (${Math.round(stats.size / 1024)} KB)`);
        return audioPath;
      }
      
      console.log(`      ⚠️ Nessun file .mp3 trovato in ${tempDir}`);
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.log(`      ❌ ERRORE download (tentativo ${retry + 1}): ${errorMsg.substring(0, 150)}`);
      
      if (error.stderr) {
        console.log(`      📋 Stderr: ${error.stderr.substring(0, 200)}`);
      }
    }
  }
  
  console.log(`      ❌ DOWNLOAD FALLITO dopo ${maxRetries} tentativi`);
  return null;
}

async function transcribeAudioWithGemini(audioPath: string): Promise<TranscriptResult | null> {
  console.log(`      🔑 Recupero chiavi API Gemini...`);
  
  // Ottieni API keys da SuperAdmin con rotazione
  const superAdminKeys = await getSuperAdminGeminiKeys();
  if (!superAdminKeys || superAdminKeys.keys.length === 0) {
    console.log(`      ❌ ERRORE: Nessuna chiave Gemini disponibile (SuperAdmin)`);
    return null;
  }
  
  console.log(`      ✅ Trovate ${superAdminKeys.keys.length} chiavi Gemini disponibili`);
  
  // Leggi il file audio come base64
  console.log(`      📂 Lettura file audio: ${path.basename(audioPath)}`);
  const audioBuffer = fs.readFileSync(audioPath);
  const audioBase64 = audioBuffer.toString('base64');
  const fileSizeMB = audioBuffer.length / (1024 * 1024);
  
  console.log(`      📊 File size: ${fileSizeMB.toFixed(2)} MB`);
  console.log(`      📤 Preparazione invio a Gemini AI...`);
  console.log(`      🎯 Modello: ${GEMINI_LEGACY_MODEL}`);
  
  // Prova ogni chiave con rotazione random
  const keysToTry = [...superAdminKeys.keys];
  const startIndex = Math.floor(Math.random() * keysToTry.length);
  
  for (let attempt = 0; attempt < keysToTry.length; attempt++) {
    const keyIndex = (startIndex + attempt) % keysToTry.length;
    const apiKey = keysToTry[keyIndex];
    
    try {
      console.log(`      🔑 Tentativo ${attempt + 1}/${keysToTry.length} con chiave #${keyIndex + 1}`);
      
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
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🤖 [STEP 2] METODO GEMINI (Download Audio + Trascrizione AI)`);
  console.log(`${'─'.repeat(60)}`);
  
  let audioPath: string | null = null;
  
  try {
    console.log(`\n   [STEP 2.1] Avvio download audio...`);
    const downloadStartTime = Date.now();
    audioPath = await downloadAudioWithYtDlp(videoId);
    const downloadTime = ((Date.now() - downloadStartTime) / 1000).toFixed(2);
    
    if (!audioPath) {
      console.log(`   ❌ [STEP 2.1] Download audio FALLITO dopo ${downloadTime}s`);
      return null;
    }
    console.log(`   ✅ [STEP 2.1] Download audio completato in ${downloadTime}s`);
    
    console.log(`\n   [STEP 2.2] Avvio trascrizione con Gemini AI...`);
    const transcribeStartTime = Date.now();
    const result = await transcribeAudioWithGemini(audioPath);
    const transcribeTime = ((Date.now() - transcribeStartTime) / 1000).toFixed(2);
    
    if (result) {
      console.log(`   ✅ [STEP 2.2] Trascrizione Gemini completata in ${transcribeTime}s`);
      console.log(`   📊 Caratteri trascritti: ${result.transcript.length}`);
      console.log(`   📊 Segmenti: ${result.segments.length}`);
    } else {
      console.log(`   ❌ [STEP 2.2] Trascrizione Gemini FALLITA dopo ${transcribeTime}s`);
    }
    
    return result;
  } catch (error: any) {
    console.log(`   ❌ [STEP 2] Metodo Gemini ERRORE: ${error.message?.substring(0, 100)}`);
    return null;
  } finally {
    if (audioPath) {
      try {
        fs.unlinkSync(audioPath);
        console.log(`   🧹 [CLEANUP] File audio eliminato: ${path.basename(audioPath)}`);
      } catch (cleanupErr) {
        console.log(`   ⚠️ [CLEANUP] Impossibile eliminare audio`);
      }
    }
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
        
        // --js-runtimes node richiesto per YouTube dal Nov 2024
        const cmd = `yt-dlp --js-runtimes node --write-auto-subs --skip-download --sub-lang "${tryLang}" --sub-format "vtt" --extractor-args "youtube:player_skip=webpage,configs" --socket-timeout 10 -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}" 2>&1`;
        
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
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📝 [STEP 3] METODO SOTTOTITOLI (yt-dlp + Librerie JS)`);
  console.log(`${'─'.repeat(60)}`);
  
  // Prima prova yt-dlp
  console.log(`\n   [STEP 3.1] Tentativo yt-dlp sottotitoli...`);
  const ytdlpStartTime = Date.now();
  const ytdlpResult = await fetchSubtitlesWithYtDlp(videoId, lang);
  const ytdlpTime = ((Date.now() - ytdlpStartTime) / 1000).toFixed(2);
  
  if (ytdlpResult) {
    console.log(`   ✅ [STEP 3.1] yt-dlp sottotitoli OK in ${ytdlpTime}s`);
    console.log(`   📊 Caratteri: ${ytdlpResult.transcript.length}`);
    return ytdlpResult;
  }
  console.log(`   ❌ [STEP 3.1] yt-dlp sottotitoli FALLITO dopo ${ytdlpTime}s`);
  
  // Poi prova librerie JS
  console.log(`\n   [STEP 3.2] Tentativo librerie JavaScript...`);
  const jsStartTime = Date.now();
  const jsResult = await fetchSubtitlesWithJsLibraries(videoId, lang);
  const jsTime = ((Date.now() - jsStartTime) / 1000).toFixed(2);
  
  if (jsResult) {
    console.log(`   ✅ [STEP 3.2] Librerie JS OK in ${jsTime}s`);
    console.log(`   📊 Caratteri: ${jsResult.transcript.length}`);
    return jsResult;
  }
  console.log(`   ❌ [STEP 3.2] Librerie JS FALLITE dopo ${jsTime}s`);
  
  return null;
}

// ==================== FUNZIONE PRINCIPALE ====================

export type TranscriptMode = 'auto' | 'gemini' | 'subtitles' | 'manual';

export async function fetchTranscript(
  videoId: string, 
  lang: string = 'it',
  mode: TranscriptMode = 'auto'
): Promise<{ transcript: string; segments: TranscriptSegment[] } | null> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📹 [STEP 1] INIZIO PROCESSO TRASCRIZIONE`);
  console.log(`${'='.repeat(70)}`);
  console.log(`   📋 Video ID: ${videoId}`);
  console.log(`   🌐 Lingua richiesta: ${lang}`);
  console.log(`   ⚙️  Modalità: ${mode}`);
  console.log(`   🕐 Timestamp: ${new Date().toISOString()}`);
  
  // Modalità manuale: non fare nessuna estrazione automatica
  if (mode === 'manual') {
    console.log(`✍️ [TRANSCRIPT] Modalità manuale: l'utente inserirà la trascrizione`);
    return null;
  }
  
  const processStartTime = Date.now();
  
  if (mode === 'gemini' || mode === 'auto') {
    // METODO 1: Gemini (download audio + trascrizione AI) - Qualità premium
    const geminiResult = await fetchTranscriptWithGemini(videoId);
    if (geminiResult) {
      const totalTime = ((Date.now() - processStartTime) / 1000).toFixed(2);
      console.log(`\n${'='.repeat(70)}`);
      console.log(`✅ [STEP 4] TRASCRIZIONE COMPLETATA CON SUCCESSO`);
      console.log(`${'='.repeat(70)}`);
      console.log(`   🏆 Metodo utilizzato: GEMINI AI`);
      console.log(`   📊 Caratteri totali: ${geminiResult.transcript.length}`);
      console.log(`   📊 Segmenti: ${geminiResult.segments.length}`);
      console.log(`   ⏱️  Tempo totale: ${totalTime}s`);
      console.log(`   📝 Anteprima: "${geminiResult.transcript.substring(0, 150)}..."`);
      console.log(`${'='.repeat(70)}\n`);
      return { transcript: geminiResult.transcript, segments: geminiResult.segments };
    }
    
    // Se modalità è "gemini" e fallisce, non fare fallback
    if (mode === 'gemini') {
      const totalTime = ((Date.now() - processStartTime) / 1000).toFixed(2);
      console.log(`\n${'='.repeat(70)}`);
      console.log(`❌ [STEP 4] TRASCRIZIONE FALLITA`);
      console.log(`${'='.repeat(70)}`);
      console.log(`   ⚠️ Modalità Gemini richiesta ma non disponibile`);
      console.log(`   ⏱️  Tempo totale: ${totalTime}s`);
      console.log(`${'='.repeat(70)}\n`);
      return null;
    }
    
    console.log(`\n   ⚠️ Gemini fallito, passaggio a fallback sottotitoli...`);
  }
  
  if (mode === 'subtitles' || mode === 'auto') {
    // METODO 2: Sottotitoli (yt-dlp + librerie JS) - Fallback
    const subtitlesResult = await fetchTranscriptWithSubtitles(videoId, lang);
    if (subtitlesResult) {
      const totalTime = ((Date.now() - processStartTime) / 1000).toFixed(2);
      console.log(`\n${'='.repeat(70)}`);
      console.log(`✅ [STEP 4] TRASCRIZIONE COMPLETATA CON SUCCESSO`);
      console.log(`${'='.repeat(70)}`);
      console.log(`   🏆 Metodo utilizzato: SOTTOTITOLI`);
      console.log(`   📊 Caratteri totali: ${subtitlesResult.transcript.length}`);
      console.log(`   📊 Segmenti: ${subtitlesResult.segments.length}`);
      console.log(`   ⏱️  Tempo totale: ${totalTime}s`);
      console.log(`   📝 Anteprima: "${subtitlesResult.transcript.substring(0, 150)}..."`);
      console.log(`${'='.repeat(70)}\n`);
      return { transcript: subtitlesResult.transcript, segments: subtitlesResult.segments };
    }
  }
  
  const totalTime = ((Date.now() - processStartTime) / 1000).toFixed(2);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`❌ [STEP 4] TRASCRIZIONE NON DISPONIBILE`);
  console.log(`${'='.repeat(70)}`);
  console.log(`   ⚠️ Tutti i metodi hanno fallito per video: ${videoId}`);
  console.log(`   ⏱️  Tempo totale: ${totalTime}s`);
  console.log(`   💡 Suggerimento: Inserire manualmente la trascrizione`);
  console.log(`${'='.repeat(70)}\n`);
  return null;
}

// ==================== PLAYLIST & VIDEO MANAGEMENT ====================

export async function fetchPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 [PLAYLIST] Caricamento playlist: ${playlistId}`);
  console.log(`${'='.repeat(70)}`);
  
  // Sanitizza playlistId per sicurezza (solo caratteri alfanumerici, trattini e underscore)
  const sanitizedPlaylistId = playlistId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitizedPlaylistId !== playlistId) {
    console.log(`   ⚠️ PlaylistId sanitizzato: "${playlistId}" -> "${sanitizedPlaylistId}"`);
  }
  
  try {
    const playlistUrl = `https://www.youtube.com/playlist?list=${sanitizedPlaylistId}`;
    
    // Usa yt-dlp per estrarre TUTTI i video della playlist (senza limite di 100)
    // Usa execFile con array di argomenti per prevenire shell injection
    const videos = await new Promise<PlaylistVideo[]>((resolve, reject) => {
      const args = [
        '--js-runtimes', 'node',  // Richiesto per YouTube dal Nov 2024
        '--flat-playlist',
        '-J',
        '--socket-timeout', '30',
        playlistUrl
      ];
      
      console.log(`   🔧 Esecuzione yt-dlp per playlist completa...`);
      const startTime = Date.now();
      
      execFile('yt-dlp', args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        
        if (error) {
          console.log(`   ❌ yt-dlp fallito dopo ${elapsed}s: ${error.message}`);
          // Fallback al metodo HTML se yt-dlp fallisce
          resolve([]);
          return;
        }
        
        try {
          const data = JSON.parse(stdout);
          const entries = data.entries || [];
          
          console.log(`   ✅ yt-dlp completato in ${elapsed}s`);
          console.log(`   📊 Video trovati: ${entries.length}`);
          
          // Filtra video privati e non disponibili
          const filteredEntries = entries.filter((entry: any) => {
            if (!entry || !entry.id) return false;
            
            // Escludi video privati (titolo "[Private video]" o "[Deleted video]")
            const title = entry.title || '';
            if (title === '[Private video]' || title === '[Deleted video]' || title === 'Private video') {
              console.log(`   ⏭️ Saltato video privato/eliminato: ${entry.id}`);
              return false;
            }
            
            // Escludi video non disponibili
            if (entry.availability && entry.availability !== 'public' && entry.availability !== 'unlisted') {
              console.log(`   ⏭️ Saltato video non disponibile (${entry.availability}): ${entry.id}`);
              return false;
            }
            
            return true;
          });
          
          const skippedCount = entries.length - filteredEntries.length;
          if (skippedCount > 0) {
            console.log(`   📊 Video saltati (privati/eliminati): ${skippedCount}`);
          }
          
          const playlistVideos: PlaylistVideo[] = filteredEntries
            .map((entry: any, index: number) => ({
              videoId: entry.id,
              videoUrl: `https://www.youtube.com/watch?v=${entry.id}`,
              title: entry.title || 'Titolo non disponibile',
              thumbnailUrl: entry.thumbnail || `https://img.youtube.com/vi/${entry.id}/hqdefault.jpg`,
              duration: entry.duration || 0,
              position: index + 1,
            }));
          
          resolve(playlistVideos);
        } catch (parseError) {
          console.log(`   ❌ Errore parsing JSON yt-dlp: ${parseError}`);
          resolve([]);
        }
      });
    });
    
    // Se yt-dlp ha funzionato, ritorna i video
    if (videos.length > 0) {
      console.log(`   🎉 Playlist caricata con successo: ${videos.length} video`);
      console.log(`${'='.repeat(70)}\n`);
      return videos;
    }
    
    // FALLBACK: metodo HTML scraping (limitato a ~100 video)
    console.log(`   ⚠️ Fallback a HTML scraping (limite ~100 video)...`);
    
    const response = await fetch(playlistUrl);
    const html = await response.text();
    
    const fallbackVideos: PlaylistVideo[] = [];
    
    const initialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (!initialDataMatch) {
      console.error('   ❌ Could not find playlist data in HTML');
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
            
            fallbackVideos.push({
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
      
      console.log(`   📊 HTML fallback: ${fallbackVideos.length} video`);
    } catch (parseError) {
      console.error('   ❌ Error parsing playlist data:', parseError);
    }
    
    console.log(`${'='.repeat(70)}\n`);
    return fallbackVideos;
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return [];
  }
}

export async function saveVideoWithTranscript(
  consultantId: string,
  videoUrl: string,
  playlistId?: string,
  playlistTitle?: string,
  transcriptMode: TranscriptMode = 'auto'
): Promise<{ success: boolean; video?: any; error?: string; reused?: boolean }> {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      console.log(`❌ [SAVE-VIDEO] URL non valido: ${videoUrl}`);
      return { success: false, error: 'Invalid YouTube URL' };
    }
    
    // Controllo duplicati: verifica se il video esiste già per questo consultant
    const [existingVideo] = await db.select()
      .from(youtubeVideos)
      .where(and(
        eq(youtubeVideos.consultantId, consultantId),
        eq(youtubeVideos.videoId, videoId)
      ))
      .limit(1);
    
    if (existingVideo) {
      // Verifica che la trascrizione sia valida (non vuota e con contenuto minimo)
      const hasValidTranscript = existingVideo.transcriptStatus === 'completed' && 
                                  existingVideo.transcript && 
                                  existingVideo.transcript.trim().length >= 50;
      
      if (hasValidTranscript) {
        console.log(`♻️ [SAVE-VIDEO] Video già esistente: "${existingVideo.title}" - Riutilizzo trascrizione (${existingVideo.transcript?.length} chars)`);
        return { 
          success: true, 
          video: existingVideo, 
          reused: true 
        };
      } else {
        console.log(`⚠️ [SAVE-VIDEO] Video esistente ma trascrizione vuota: "${existingVideo.title}" - Ritento estrazione`);
        
        // Ritenta l'estrazione della trascrizione per il video esistente
        const transcriptResult = await fetchTranscript(videoId, 'it', transcriptMode);
        
        if (transcriptResult && transcriptResult.transcript.trim().length >= 50) {
          await db.update(youtubeVideos)
            .set({
              transcript: transcriptResult.transcript,
              transcriptStatus: 'completed',
              transcriptLanguage: 'it',
              updatedAt: new Date(),
            })
            .where(eq(youtubeVideos.id, existingVideo.id));
          
          existingVideo.transcript = transcriptResult.transcript;
          existingVideo.transcriptStatus = 'completed';
          console.log(`✅ [SAVE-VIDEO] "${existingVideo.title}" - Trascrizione recuperata (${transcriptResult.transcript.length} caratteri)`);
          // Non è reused perché abbiamo appena estratto una nuova trascrizione
          return { success: true, video: existingVideo, reused: false };
        } else {
          // Mantieni status pending per inserimento manuale
          await db.update(youtubeVideos)
            .set({
              transcriptStatus: 'pending',
              updatedAt: new Date(),
            })
            .where(eq(youtubeVideos.id, existingVideo.id));
          
          existingVideo.transcriptStatus = 'pending';
          console.log(`✍️ [SAVE-VIDEO] "${existingVideo.title}" - In attesa trascrizione manuale`);
          // Non è reused - trascrizione mancante
          return { success: true, video: existingVideo, reused: false };
        }
      }
    }
    
    console.log(`📥 [SAVE-VIDEO] Caricando metadati per video: ${videoId} (modalità trascrizione: ${transcriptMode})`);
    const metadata = await fetchVideoMetadata(videoId);
    if (!metadata) {
      console.log(`❌ [SAVE-VIDEO] Impossibile ottenere metadati per: ${videoId}`);
      return { success: false, error: 'Could not fetch video metadata' };
    }
    
    console.log(`📝 [SAVE-VIDEO] Video: "${metadata.title}" - Salvando in database...`);
    
    const insertResult = await db.insert(youtubeVideos).values({
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
    }).onConflictDoNothing({
      target: [youtubeVideos.consultantId, youtubeVideos.videoId],
    }).returning();
    
    let video = insertResult[0];
    if (!video) {
      console.log(`🔄 [SAVE-VIDEO] Race condition rilevata - recupero video esistente`);
      const [existingFromRace] = await db.select()
        .from(youtubeVideos)
        .where(and(
          eq(youtubeVideos.consultantId, consultantId),
          eq(youtubeVideos.videoId, videoId)
        ))
        .limit(1);
      if (existingFromRace) {
        return { success: true, video: existingFromRace, reused: true };
      }
      return { success: false, error: 'Failed to insert or find video' };
    }
    
    console.log(`🔍 [SAVE-VIDEO] Cercando trascrizione (${transcriptMode}) per: "${metadata.title}"...`);
    const transcriptResult = await fetchTranscript(videoId, 'it', transcriptMode);
    
    if (transcriptResult && transcriptResult.transcript.trim().length >= 50) {
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
      // Se modalità manuale, status "pending" invece di "failed"
      const status = transcriptMode === 'manual' ? 'pending' : 'pending'; // Sempre pending per inserimento manuale
      await db.update(youtubeVideos)
        .set({
          transcriptStatus: status,
          updatedAt: new Date(),
        })
        .where(eq(youtubeVideos.id, video.id));
      
      video.transcriptStatus = status;
      console.log(`✍️ [SAVE-VIDEO] "${metadata.title}" - In attesa trascrizione manuale`);
    }
    
    return { success: true, video };
  } catch (error: any) {
    console.error(`❌ [SAVE-VIDEO] Errore:`, error.message || error);
    return { success: false, error: 'Failed to save video' };
  }
}

// ==================== STREAMING VERSION ====================

export async function saveVideoWithTranscriptStream(
  consultantId: string,
  videoUrl: string,
  playlistId?: string,
  playlistTitle?: string,
  transcriptMode: TranscriptMode = 'auto',
  onProgress?: (status: string, message?: string) => void,
  playlistMetadata?: { title?: string; thumbnailUrl?: string; channelName?: string }
): Promise<{ success: boolean; video?: any; error?: string; reused?: boolean }> {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return { success: false, error: 'URL non valido' };
    }
    
    const [existingVideo] = await db.select()
      .from(youtubeVideos)
      .where(and(
        eq(youtubeVideos.consultantId, consultantId),
        eq(youtubeVideos.videoId, videoId)
      ))
      .limit(1);
    
    if (existingVideo) {
      const hasValidTranscript = existingVideo.transcriptStatus === 'completed' && 
                                  existingVideo.transcript && 
                                  existingVideo.transcript.trim().length >= 50;
      
      if (hasValidTranscript) {
        return { success: true, video: existingVideo, reused: true };
      } else {
        onProgress?.('transcribing', 'Ritento estrazione trascrizione...');
        const transcriptResult = await fetchTranscript(videoId, 'it', transcriptMode);
        
        if (transcriptResult && transcriptResult.transcript.trim().length >= 50) {
          await db.update(youtubeVideos)
            .set({
              transcript: transcriptResult.transcript,
              transcriptStatus: 'completed',
              transcriptLanguage: 'it',
              updatedAt: new Date(),
            })
            .where(eq(youtubeVideos.id, existingVideo.id));
          
          existingVideo.transcript = transcriptResult.transcript;
          existingVideo.transcriptStatus = 'completed';
          // Non è reused perché abbiamo appena estratto una nuova trascrizione
          return { success: true, video: existingVideo, reused: false };
        } else {
          await db.update(youtubeVideos)
            .set({ transcriptStatus: 'pending', updatedAt: new Date() })
            .where(eq(youtubeVideos.id, existingVideo.id));
          existingVideo.transcriptStatus = 'pending';
          // Non è reused - trascrizione mancante
          return { success: true, video: existingVideo, reused: false };
        }
      }
    }
    
    onProgress?.('downloading', 'Scaricando metadati video...');
    let metadata = await fetchVideoMetadata(videoId);
    
    // Fallback: se oEmbed fallisce (video non embeddabile), usa i metadati dalla playlist
    if (!metadata && playlistMetadata?.title) {
      // Controlla se è un video privato prima di usare i metadati playlist
      const isPrivateVideo = playlistMetadata.title === '[Private video]' || 
                             playlistMetadata.title === '[Deleted video]' ||
                             playlistMetadata.title === 'Private video';
      
      if (isPrivateVideo) {
        console.log(`⏭️ [SAVE-VIDEO-STREAM] Video privato/eliminato saltato: ${videoId}`);
        return { success: false, error: 'Video privato - saltato', skipped: true };
      }
      
      console.log(`⚠️ [SAVE-VIDEO-STREAM] oEmbed fallito, uso metadati playlist per: "${playlistMetadata.title}"`);
      metadata = {
        title: playlistMetadata.title,
        thumbnailUrl: playlistMetadata.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        channelName: playlistMetadata.channelName || 'Canale sconosciuto',
        description: '',
        duration: null,
      };
    }
    
    if (!metadata) {
      return { success: false, error: 'Impossibile ottenere metadati (video privato o con restrizioni)', skipped: true };
    }
    
    const insertResult = await db.insert(youtubeVideos).values({
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
    }).onConflictDoNothing({
      target: [youtubeVideos.consultantId, youtubeVideos.videoId],
    }).returning();
    
    let video = insertResult[0];
    if (!video) {
      console.log(`🔄 [SAVE-VIDEO-STREAM] Race condition rilevata - recupero video esistente`);
      const [existingFromRace] = await db.select()
        .from(youtubeVideos)
        .where(and(
          eq(youtubeVideos.consultantId, consultantId),
          eq(youtubeVideos.videoId, videoId)
        ))
        .limit(1);
      if (existingFromRace) {
        return { success: true, video: existingFromRace, reused: true };
      }
      return { success: false, error: 'Failed to insert or find video' };
    }
    
    onProgress?.('transcribing', 'Estraendo trascrizione con Gemini AI...');
    const transcriptResult = await fetchTranscript(videoId, 'it', transcriptMode);
    
    if (transcriptResult && transcriptResult.transcript.trim().length >= 50) {
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
    } else {
      await db.update(youtubeVideos)
        .set({ transcriptStatus: 'pending', updatedAt: new Date() })
        .where(eq(youtubeVideos.id, video.id));
      video.transcriptStatus = 'pending';
    }
    
    return { success: true, video };
  } catch (error: any) {
    console.error(`❌ [SAVE-VIDEO-STREAM] Errore:`, error.message || error);
    return { success: false, error: error.message || 'Errore durante il salvataggio' };
  }
}

// ==================== SETTINGS ====================

export async function getAiLessonSettings(consultantId: string) {
  const [settings] = await db
    .select()
    .from(consultantAiLessonSettings)
    .where(eq(consultantAiLessonSettings.consultantId, consultantId));
  
  const customPrompts = (settings?.customPrompts as any) || {};
  
  return {
    writingInstructions: settings?.writingInstructions || "Mantieni il tono e lo stile del relatore nel video. Usa le sue espressioni e il suo modo di spiegare i concetti. Struttura il testo in sezioni chiare e leggibili.",
    defaultContentType: settings?.defaultContentType || 'both',
    defaultLevel: settings?.defaultLevel || 'base',
    preserveSpeakerStyle: settings?.preserveSpeakerStyle ?? true,
    includeTimestamps: settings?.includeTimestamps ?? false,
    defaultStyle: customPrompts.defaultStyle || 'speaker-style',
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
    defaultStyle?: string;
  }
) {
  const existing = await db
    .select()
    .from(consultantAiLessonSettings)
    .where(eq(consultantAiLessonSettings.consultantId, consultantId));
  
  // Extract defaultStyle to save in customPrompts
  const { defaultStyle, ...restSettings } = settings;
  
  // Build customPrompts with defaultStyle
  const existingCustomPrompts = (existing[0]?.customPrompts as any) || {};
  const customPrompts = defaultStyle 
    ? { ...existingCustomPrompts, defaultStyle }
    : existingCustomPrompts;
  
  if (existing.length > 0) {
    await db.update(consultantAiLessonSettings)
      .set({
        ...restSettings,
        customPrompts,
        updatedAt: new Date(),
      })
      .where(eq(consultantAiLessonSettings.consultantId, consultantId));
  } else {
    await db.insert(consultantAiLessonSettings).values({
      consultantId,
      ...restSettings,
      customPrompts,
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
