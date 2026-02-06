import * as fs from 'fs';
import { logger } from './logger.js';

const log = logger.child('BG-MIXER');

const sessionCursors = new Map<string, number>();

let bgPcmBuffer: Buffer | null = null;
let bgLoaded = false;

const BG_FILE_PATH = '/opt/sounds/background.wav';
const EXPECTED_SAMPLE_RATE = 16000;
const EXPECTED_CHANNELS = 1;
const EXPECTED_BIT_DEPTH = 16;

function parseWavHeader(buffer: Buffer): {
  dataOffset: number;
  dataSize: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
} {
  const riff = buffer.toString('ascii', 0, 4);
  if (riff !== 'RIFF') throw new Error('Not a valid WAV file: missing RIFF header');

  const wave = buffer.toString('ascii', 8, 12);
  if (wave !== 'WAVE') throw new Error('Not a valid WAV file: missing WAVE format');

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitDepth = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (offset + 8 + chunkSize > buffer.length) {
      log.warn(`WAV chunk '${chunkId}' extends beyond file (offset=${offset}, size=${chunkSize}, fileLen=${buffer.length})`);
      break;
    }

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      const audioFormat = buffer.readUInt16LE(offset + 8);
      if (audioFormat !== 1) {
        throw new Error(`Unsupported audio format: ${audioFormat} (only PCM/1 supported)`);
      }
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitDepth = buffer.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = Math.min(chunkSize, buffer.length - dataOffset);
      break;
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++;
  }

  if (dataOffset === 0) throw new Error('No data chunk found in WAV file');

  return { dataOffset, dataSize, sampleRate, channels, bitDepth };
}

export function loadBackgroundAudio(filePath?: string): boolean {
  const targetPath = filePath || BG_FILE_PATH;

  try {
    if (!fs.existsSync(targetPath)) {
      log.warn(`Background audio file not found: ${targetPath}`);
      return false;
    }

    const fileBuffer = fs.readFileSync(targetPath);
    const header = parseWavHeader(fileBuffer);

    const durationSec = header.dataSize / (header.sampleRate * header.channels * (header.bitDepth / 8));

    log.info(`WAV file parsed`, {
      sampleRate: header.sampleRate,
      channels: header.channels,
      bitDepth: header.bitDepth,
      dataSize: header.dataSize,
      durationSec: durationSec.toFixed(1),
    });

    if (header.sampleRate !== EXPECTED_SAMPLE_RATE) {
      log.error(`Wrong sample rate: ${header.sampleRate}Hz (expected ${EXPECTED_SAMPLE_RATE}Hz)`);
      log.error(`Convert with: ffmpeg -i input.wav -ar 16000 -ac 1 -sample_fmt s16 -acodec pcm_s16le /opt/sounds/background.wav`);
      return false;
    }
    if (header.channels !== EXPECTED_CHANNELS) {
      log.error(`Wrong channel count: ${header.channels} (expected mono)`);
      log.error(`Convert with: ffmpeg -i input.wav -ar 16000 -ac 1 -sample_fmt s16 -acodec pcm_s16le /opt/sounds/background.wav`);
      return false;
    }
    if (header.bitDepth !== EXPECTED_BIT_DEPTH) {
      log.error(`Wrong bit depth: ${header.bitDepth} (expected 16-bit)`);
      log.error(`Convert with: ffmpeg -i input.wav -ar 16000 -ac 1 -sample_fmt s16 -acodec pcm_s16le /opt/sounds/background.wav`);
      return false;
    }

    bgPcmBuffer = fileBuffer.slice(header.dataOffset, header.dataOffset + header.dataSize);
    bgLoaded = true;

    log.info(`✅ Background audio loaded: ${(bgPcmBuffer.length / 1024).toFixed(1)}KB, ${durationSec.toFixed(1)}s loop`);

    return true;
  } catch (error: any) {
    log.error(`Failed to load background audio: ${error.message}`);
    return false;
  }
}

export function isBackgroundLoaded(): boolean {
  return bgLoaded && bgPcmBuffer !== null;
}

export function initSession(sessionId: string): void {
  sessionCursors.set(sessionId, 0);
  log.debug(`Background session initialized`, { sessionId: sessionId.slice(0, 8) });
}

export function destroySession(sessionId: string): void {
  sessionCursors.delete(sessionId);
  log.debug(`Background session destroyed`, { sessionId: sessionId.slice(0, 8) });
}

export function mixWithBackground(audio: Buffer, sessionId: string, volume: number = 0.08): Buffer {
  if (!bgPcmBuffer || !bgLoaded) return audio;

  let cursor = sessionCursors.get(sessionId) || 0;
  const mixed = Buffer.alloc(audio.length);
  const bgLen = bgPcmBuffer.length;

  for (let i = 0; i < audio.length - 1; i += 2) {
    const aiSample = audio.readInt16LE(i);
    const bgSample = bgPcmBuffer.readInt16LE(cursor % bgLen);

    const mixedSample = Math.max(-32768, Math.min(32767,
      aiSample + Math.round(bgSample * volume)
    ));

    mixed.writeInt16LE(mixedSample, i);
    cursor = (cursor + 2) % bgLen;
  }

  sessionCursors.set(sessionId, cursor);
  return mixed;
}

export function generateBackgroundChunk(sessionId: string, bytes: number = 640, volume: number = 0.08): Buffer | null {
  if (!bgPcmBuffer || !bgLoaded) return null;

  let cursor = sessionCursors.get(sessionId) || 0;
  const chunk = Buffer.alloc(bytes);
  const bgLen = bgPcmBuffer.length;

  for (let i = 0; i < bytes - 1; i += 2) {
    const bgSample = bgPcmBuffer.readInt16LE(cursor % bgLen);
    const scaled = Math.max(-32768, Math.min(32767, Math.round(bgSample * volume)));

    chunk.writeInt16LE(scaled, i);
    cursor = (cursor + 2) % bgLen;
  }

  sessionCursors.set(sessionId, cursor);
  return chunk;
}
