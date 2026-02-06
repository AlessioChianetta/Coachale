import { logger } from './logger.js';

const log = logger.child('AUDIO');

const MULAW_BIAS = 33;
const MULAW_MAX = 32635;

const mulawDecodeTable = new Int16Array(256);
const mulawEncodeTable = new Uint8Array(65536);

(function initMulawTables(): void {
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
})();

export function mulawToPcm(mulawData: Buffer): Buffer {
  const pcmData = Buffer.alloc(mulawData.length * 2);
  const out = new Int16Array(pcmData.buffer, pcmData.byteOffset, mulawData.length);
  for (let i = 0; i < mulawData.length; i++) {
    out[i] = mulawDecodeTable[mulawData[i]];
  }
  return pcmData;
}

export function pcmToMulaw(pcmData: Buffer): Buffer {
  const numSamples = pcmData.length / 2;
  const mulawData = Buffer.alloc(numSamples);
  const inp = new Int16Array(pcmData.buffer, pcmData.byteOffset, numSamples);
  for (let i = 0; i < numSamples; i++) {
    mulawData[i] = mulawEncodeTable[(inp[i] + 32768) & 0xffff];
  }
  return mulawData;
}

function upsample2x(input: Buffer): Buffer {
  const numSamples = input.length / 2;
  const output = Buffer.alloc(numSamples * 4);
  const inp = new Int16Array(input.buffer, input.byteOffset, numSamples);
  const out = new Int16Array(output.buffer, output.byteOffset, numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const s1 = inp[i];
    const s2 = i < numSamples - 1 ? inp[i + 1] : s1;
    out[i * 2] = s1;
    out[i * 2 + 1] = (s1 + s2) >> 1;
  }

  return output;
}

function downsample3x(input: Buffer): Buffer {
  const inputSamples = input.length / 2;
  const outputSamples = Math.floor(inputSamples / 3);
  const output = Buffer.alloc(outputSamples * 2);
  const inp = new Int16Array(input.buffer, input.byteOffset, inputSamples);
  const out = new Int16Array(output.buffer, output.byteOffset, outputSamples);

  for (let i = 0; i < outputSamples; i++) {
    const idx = i * 3;
    out[i] = ((inp[idx] + inp[idx + 1] + inp[idx + 2]) / 3) | 0;
  }

  return output;
}

function resampleGeneric(input: Buffer, inputRate: number, outputRate: number): Buffer {
  const inputSamples = input.length / 2;
  const ratio = outputRate / inputRate;
  const outputSamples = Math.floor(inputSamples * ratio);
  const output = Buffer.alloc(outputSamples * 2);
  const inp = new Int16Array(input.buffer, input.byteOffset, inputSamples);
  const out = new Int16Array(output.buffer, output.byteOffset, outputSamples);

  for (let i = 0; i < outputSamples; i++) {
    const srcPos = i / ratio;
    const srcIndex = Math.floor(srcPos);
    const frac = srcPos - srcIndex;

    const s0 = srcIndex > 0 ? inp[srcIndex - 1] : inp[0];
    const s1 = inp[Math.min(srcIndex, inputSamples - 1)];
    const s2 = inp[Math.min(srcIndex + 1, inputSamples - 1)];
    const s3 = inp[Math.min(srcIndex + 2, inputSamples - 1)];

    const c0 = s1;
    const c1 = 0.5 * (s2 - s0);
    const c2 = s0 - 2.5 * s1 + 2 * s2 - 0.5 * s3;
    const c3 = 0.5 * (s3 - s0) + 1.5 * (s1 - s2);

    let sample = c0 + frac * (c1 + frac * (c2 + frac * c3));
    out[i] = Math.max(-32768, Math.min(32767, Math.round(sample)));
  }

  return output;
}

export function resample(input: Buffer, inputRate: number, outputRate: number): Buffer {
  if (inputRate === outputRate) return input;
  if (inputRate === 8000 && outputRate === 16000) return upsample2x(input);
  if (inputRate === 24000 && outputRate === 8000) return downsample3x(input);
  return resampleGeneric(input, inputRate, outputRate);
}

export function convertForGemini(
  fsAudio: Buffer,
  codec: 'PCMU' | 'L16',
  inputRate: number = 8000
): Buffer {
  let pcm = codec === 'PCMU' ? mulawToPcm(fsAudio) : fsAudio;
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
  if (outputRate !== 24000) {
    pcm = resample(pcm, 24000, outputRate);
  }
  return codec === 'PCMU' ? pcmToMulaw(pcm) : pcm;
}

export function pcmToBase64(pcmData: Buffer): string {
  return pcmData.toString('base64');
}

export function base64ToPcm(base64Data: string): Buffer {
  return Buffer.from(base64Data, 'base64');
}

export function calculateRMS(pcmData: Buffer): number {
  const samples = pcmData.length / 2;
  const inp = new Int16Array(pcmData.buffer, pcmData.byteOffset, samples);
  let sumSquares = 0;
  for (let i = 0; i < samples; i++) {
    const s = inp[i] / 32768;
    sumSquares += s * s;
  }
  return Math.sqrt(sumSquares / samples);
}

export function isSilence(pcmData: Buffer, threshold: number = 0.01): boolean {
  return calculateRMS(pcmData) < threshold;
}

log.info('Audio converter initialized');
