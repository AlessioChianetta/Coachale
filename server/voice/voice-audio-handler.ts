import * as fs from 'fs';
import * as path from 'path';
import { voiceConfig } from './config';

interface AudioChunk {
  data: Buffer;
  format: 'ulaw' | 'alaw' | 'pcm16';
  sampleRate: number;
  timestamp: number;
}

interface AudioConfig {
  tempDir: string;
  recordingsDir: string;
}

const ULAW_DECODE_TABLE = new Int16Array([
  -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
  -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
  -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
  -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
  -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
  -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
  -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
  -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
  -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
  -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
  -876, -844, -812, -780, -748, -716, -684, -652,
  -620, -588, -556, -524, -492, -460, -428, -396,
  -372, -356, -340, -324, -308, -292, -276, -260,
  -244, -228, -212, -196, -180, -164, -148, -132,
  -120, -112, -104, -96, -88, -80, -72, -64,
  -56, -48, -40, -32, -24, -16, -8, 0,
  32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
  23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
  15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
  11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
  7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
  5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
  3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004,
  2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
  1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436,
  1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
  876, 844, 812, 780, 748, 716, 684, 652,
  620, 588, 556, 524, 492, 460, 428, 396,
  372, 356, 340, 324, 308, 292, 276, 260,
  244, 228, 212, 196, 180, 164, 148, 132,
  120, 112, 104, 96, 88, 80, 72, 64,
  56, 48, 40, 32, 24, 16, 8, 0
]);

export class VoiceAudioHandler {
  private config: AudioConfig;
  private vadThreshold: number = 500;
  private vadSilenceDuration: number = 1500;
  private lastSpeechTime: number = 0;

  constructor(config?: Partial<AudioConfig>) {
    this.config = {
      tempDir: config?.tempDir || voiceConfig.audio.tempDir,
      recordingsDir: config?.recordingsDir || voiceConfig.audio.recordingsDir,
    };

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [this.config.tempDir, this.config.recordingsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  ulawToPCM16(input: Buffer): Buffer {
    const output = Buffer.alloc(input.length * 2);
    for (let i = 0; i < input.length; i++) {
      const sample = ULAW_DECODE_TABLE[input[i]];
      output.writeInt16LE(sample, i * 2);
    }
    return output;
  }

  pcm16ToUlaw(input: Buffer): Buffer {
    const output = Buffer.alloc(input.length / 2);
    for (let i = 0; i < input.length / 2; i++) {
      const sample = input.readInt16LE(i * 2);
      output[i] = this.linearToUlaw(sample);
    }
    return output;
  }

  private linearToUlaw(sample: number): number {
    const BIAS = 0x84;
    const CLIP = 32635;
    let sign = 0;

    if (sample < 0) {
      sign = 0x80;
      sample = -sample;
    }

    if (sample > CLIP) sample = CLIP;
    sample += BIAS;

    const exponent = Math.floor(Math.log2(sample)) - 7;
    const mantissa = (sample >> (exponent + 3)) & 0x0F;

    return ~(sign | (exponent << 4) | mantissa) & 0xFF;
  }

  resample(input: Buffer, fromRate: number, toRate: number): Buffer {
    if (fromRate === toRate) return input;

    const ratio = fromRate / toRate;
    const inputSamples = input.length / 2;
    const outputSamples = Math.floor(inputSamples / ratio);
    const output = Buffer.alloc(outputSamples * 2);

    for (let i = 0; i < outputSamples; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1);
      const frac = srcIndex - srcIndexFloor;

      const sample1 = input.readInt16LE(srcIndexFloor * 2);
      const sample2 = input.readInt16LE(srcIndexCeil * 2);
      const interpolated = Math.round(sample1 * (1 - frac) + sample2 * frac);

      output.writeInt16LE(interpolated, i * 2);
    }

    return output;
  }

  async processIncomingAudio(chunk: AudioChunk): Promise<Buffer> {
    let pcmData: Buffer;

    if (chunk.format === 'ulaw') {
      pcmData = this.ulawToPCM16(chunk.data);
    } else if (chunk.format === 'pcm16') {
      pcmData = chunk.data;
    } else {
      throw new Error(`Unsupported audio format: ${chunk.format}`);
    }

    if (chunk.sampleRate !== 16000) {
      pcmData = this.resample(pcmData, chunk.sampleRate, 16000);
    }

    return pcmData;
  }

  async processOutgoingAudio(geminiAudio: Buffer, targetFormat: 'ulaw' | 'pcm16' = 'ulaw'): Promise<string> {
    const tempFile = path.join(
      this.config.tempDir,
      `out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.raw`
    );

    let outputData: Buffer;

    if (targetFormat === 'ulaw') {
      const resampled = this.resample(geminiAudio, 24000, 8000);
      outputData = this.pcm16ToUlaw(resampled);
    } else {
      outputData = geminiAudio;
    }

    await fs.promises.writeFile(tempFile, outputData);
    return tempFile;
  }

  detectSpeechEnd(samples: Buffer): boolean {
    const now = Date.now();

    const rms = this.calculateRMS(samples);

    if (rms > this.vadThreshold) {
      this.lastSpeechTime = now;
      return false;
    }

    if (this.lastSpeechTime === 0) {
      this.lastSpeechTime = now;
      return false;
    }

    const silenceDuration = now - this.lastSpeechTime;
    return silenceDuration >= this.vadSilenceDuration;
  }

  private calculateRMS(samples: Buffer): number {
    let sum = 0;
    const numSamples = samples.length / 2;

    for (let i = 0; i < numSamples; i++) {
      const sample = samples.readInt16LE(i * 2);
      sum += sample * sample;
    }

    return Math.sqrt(sum / numSamples);
  }

  async cleanupTempFiles(): Promise<number> {
    const maxAge = 5 * 60 * 1000;
    const now = Date.now();
    let cleaned = 0;

    try {
      const files = await fs.promises.readdir(this.config.tempDir);

      for (const file of files) {
        const filePath = path.join(this.config.tempDir, file);
        const stat = await fs.promises.stat(filePath);

        if (now - stat.mtimeMs > maxAge) {
          await fs.promises.unlink(filePath);
          cleaned++;
        }
      }
    } catch (error) {
      console.error('[AudioHandler] Cleanup error:', error);
    }

    return cleaned;
  }

  async saveRecording(callId: string, audioData: Buffer): Promise<string> {
    const fileName = `${callId}_${Date.now()}.wav`;
    const filePath = path.join(this.config.recordingsDir, fileName);

    const wavHeader = this.createWavHeader(audioData.length, 8000, 1, 8);
    const wavData = Buffer.concat([wavHeader, audioData]);

    await fs.promises.writeFile(filePath, wavData);
    return filePath;
  }

  private createWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * channels * bitsPerSample / 8;
    const blockAlign = channels * bitsPerSample / 8;

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(7, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);

    return header;
  }

  getTempDir(): string {
    return this.config.tempDir;
  }

  getRecordingsDir(): string {
    return this.config.recordingsDir;
  }
}

export const audioHandler = new VoiceAudioHandler();
