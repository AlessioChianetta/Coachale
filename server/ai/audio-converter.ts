import { Readable } from 'stream';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Audio Converter per Gemini Live API
 * 
 * Conversioni supportate:
 * - WebM Opus (browser) → PCM 16-bit 16kHz (Gemini input)
 * - PCM 16-bit 24kHz (Gemini output) → WAV con headers (browser playback)
 */

interface WAVHeader {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
}

/**
 * Converti audio WebM/Opus in PCM 16-bit 16kHz usando ffmpeg
 * 
 * @param webmBuffer - Buffer contenente audio WebM/Opus dal browser
 * @param targetSampleRate - Sample rate target (default: 16000 per Gemini)
 * @returns Buffer PCM raw signed 16-bit little-endian mono
 */
export async function convertWebMToPCM(
  webmBuffer: Buffer,
  targetSampleRate: number = 16000
): Promise<Buffer> {
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    // Crea file temporanei
    const tmpDir = os.tmpdir();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    inputPath = path.join(tmpDir, `audio-in-${timestamp}-${random}.webm`);
    outputPath = path.join(tmpDir, `audio-out-${timestamp}-${random}.pcm`);

    // Scrivi WebM input su file temporaneo
    await fs.writeFile(inputPath, webmBuffer);

    // Converti con ffmpeg
    // -f s16le: signed 16-bit little-endian PCM
    // -ar 16000: sample rate 16kHz
    // -ac 1: mono (1 canale)
    const command = `ffmpeg -i "${inputPath}" -f s16le -ar ${targetSampleRate} -ac 1 "${outputPath}" -y`;
    
    console.log(`🔄 Converting WebM to PCM: ${command}`);
    
    await execAsync(command, {
      timeout: 10000, // 10 secondi max
      maxBuffer: 10 * 1024 * 1024 // 10 MB max buffer
    });

    // Leggi PCM output
    const pcmBuffer = await fs.readFile(outputPath);
    
    console.log(`✅ Audio converted: ${webmBuffer.length} bytes (WebM) → ${pcmBuffer.length} bytes (PCM)`);
    
    return pcmBuffer;
  } catch (error) {
    console.error('❌ Error converting WebM to PCM:', error);
    throw new Error(`Audio conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Cleanup file temporanei
    try {
      if (inputPath) await fs.unlink(inputPath).catch(() => {});
      if (outputPath) await fs.unlink(outputPath).catch(() => {});
    } catch (cleanupError) {
      console.warn('⚠️ Error cleaning up temp files:', cleanupError);
    }
  }
}

/**
 * Aggiungi headers WAV a buffer PCM raw
 * Input: PCM 16-bit raw data
 * Output: WAV file completo con headers
 */
export function addWAVHeaders(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  
  // WAV header = 44 bytes
  const header = Buffer.alloc(44);
  
  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4); // File size - 8
  header.write('WAVE', 8);
  
  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  
  // Combina header + PCM data
  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Converti PCM 24kHz in WAV completo
 */
export async function convertPCMToWAV(
  pcmBuffer: Buffer,
  sampleRate: number = 24000
): Promise<Buffer> {
  return addWAVHeaders(pcmBuffer, sampleRate, 1, 16);
}

/**
 * Converti Base64 in Buffer
 */
export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Converti Buffer in Base64
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}
