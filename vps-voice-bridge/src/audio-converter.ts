import { logger } from './logger.js';

const log = logger.child('AUDIO');

const MULAW_BIAS = 33;
const MULAW_MAX = 32635;

const mulawDecodeTable = new Int16Array(256);
const mulawEncodeTable = new Uint8Array(65536);

function initMulawTables(): void {
  for (let i = 0; i < 256; i++) {
    let mulaw = ~i;
    const sign = mulaw & 0x80;
    const exponent = (mulaw >> 4) & 0x07;
    const mantissa = mulaw & 0x0f;
    let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
    sample -= MULAW_BIAS;
    if (sign) sample = -sample;
    mulawDecodeTable[i] = sample;
  }

  for (let i = -32768; i < 32768; i++) {
    const sign = i < 0 ? 0x80 : 0;
    let sample = Math.abs(i);
    if (sample > MULAW_MAX) sample = MULAW_MAX;
    sample += MULAW_BIAS;

    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}

    const mantissa = (sample >> (exponent + 3)) & 0x0f;
    const mulaw = ~(sign | (exponent << 4) | mantissa);
    mulawEncodeTable[(i + 32768) & 0xffff] = mulaw & 0xff;
  }

  log.debug('μ-law lookup tables initialized');
}

initMulawTables();

export function mulawToPcm(mulawData: Buffer): Buffer {
  const pcmData = Buffer.alloc(mulawData.length * 2);
  for (let i = 0; i < mulawData.length; i++) {
    const sample = mulawDecodeTable[mulawData[i]];
    pcmData.writeInt16LE(sample, i * 2);
  }
  return pcmData;
}

export function pcmToMulaw(pcmData: Buffer): Buffer {
  const mulawData = Buffer.alloc(pcmData.length / 2);
  for (let i = 0; i < mulawData.length; i++) {
    const sample = pcmData.readInt16LE(i * 2);
    mulawData[i] = mulawEncodeTable[(sample + 32768) & 0xffff];
  }
  return mulawData;
}

export function resample(input: Buffer, inputRate: number, outputRate: number): Buffer {
  if (inputRate === outputRate) {
    return input;
  }

  const inputSamples = input.length / 2;
  const ratio = outputRate / inputRate;
  const outputSamples = Math.floor(inputSamples * ratio);
  const output = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const srcPos = i / ratio;
    const srcIndex = Math.floor(srcPos);
    const frac = srcPos - srcIndex;

    const s0 = srcIndex > 0 ? input.readInt16LE((srcIndex - 1) * 2) : input.readInt16LE(0);
    const s1 = input.readInt16LE(Math.min(srcIndex, inputSamples - 1) * 2);
    const s2 = input.readInt16LE(Math.min(srcIndex + 1, inputSamples - 1) * 2);
    const s3 = input.readInt16LE(Math.min(srcIndex + 2, inputSamples - 1) * 2);

    const c0 = s1;
    const c1 = 0.5 * (s2 - s0);
    const c2 = s0 - 2.5 * s1 + 2 * s2 - 0.5 * s3;
    const c3 = 0.5 * (s3 - s0) + 1.5 * (s1 - s2);

    let sample = c0 + frac * (c1 + frac * (c2 + frac * c3));
    sample = Math.max(-32768, Math.min(32767, Math.round(sample)));

    output.writeInt16LE(sample, i * 2);
  }

  return output;
}

export function convertForGemini(
  fsAudio: Buffer,
  codec: 'PCMU' | 'L16',
  inputRate: number = 8000
): Buffer {
  let pcm: Buffer;

  if (codec === 'PCMU') {
    pcm = mulawToPcm(fsAudio);
  } else {
    pcm = fsAudio;
  }

  if (inputRate !== 16000) {
    pcm = resample(pcm, inputRate, 16000);
  }

  return pcm;
}

export function convertFromGemini(
  geminiAudio: Buffer,
  codec: 'PCMU' | 'L16',
  outputRate: number = 8000
): Buffer {
  let pcm = geminiAudio;

  if (24000 !== outputRate) {
    pcm = resample(pcm, 24000, outputRate);
  }

  if (codec === 'PCMU') {
    return pcmToMulaw(pcm);
  }

  return pcm;
}

export function pcmToBase64(pcmData: Buffer): string {
  return pcmData.toString('base64');
}

export function base64ToPcm(base64Data: string): Buffer {
  return Buffer.from(base64Data, 'base64');
}

export function calculateRMS(pcmData: Buffer): number {
  let sumSquares = 0;
  const samples = pcmData.length / 2;

  for (let i = 0; i < samples; i++) {
    const sample = pcmData.readInt16LE(i * 2) / 32768;
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / samples);
}

export function isSilence(pcmData: Buffer, threshold: number = 0.01): boolean {
  return calculateRMS(pcmData) < threshold;
}

log.info('Audio converter initialized', {
  mulawTableSize: mulawDecodeTable.length + mulawEncodeTable.length,
});
