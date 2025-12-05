/**
 * Audio conversion utilities for PCM audio processing
 * Converts Float32Array → Int16Array (PCM16) → base64 string
 * Includes streaming resampling for sample rate mismatch (e.g., 48kHz → 16kHz)
 */

/**
 * Streaming Audio Resampler - maintains state between chunks for accurate resampling
 * CRITICAL: This class preserves the fractional offset between chunks to avoid
 * drift and distortion on non-integer sample rate ratios (e.g., 44.1kHz → 16kHz)
 */
export class StreamingResampler {
  private readonly ratio: number;
  private fractionalOffset: number = 0;
  private lastSample: number = 0;

  constructor(
    private readonly sourceSampleRate: number,
    private readonly targetSampleRate: number
  ) {
    this.ratio = sourceSampleRate / targetSampleRate;
  }

  /**
   * Process a chunk of audio data with streaming resampling
   * Maintains fractional offset between calls for seamless audio
   */
  process(inputData: Float32Array): Float32Array {
    if (this.sourceSampleRate === this.targetSampleRate) {
      return inputData;
    }

    // Calculate output length accounting for fractional offset from previous chunk
    const totalInputSamples = inputData.length + this.fractionalOffset;
    const outputLength = Math.floor(totalInputSamples / this.ratio);
    const outputData = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      // Calculate source index including fractional offset from previous chunk
      const srcIndex = i * this.ratio + this.fractionalOffset;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
      const fraction = srcIndex - srcIndexFloor;

      // Handle edge case where we need the last sample from previous chunk
      let sample0: number;
      if (srcIndexFloor < 0) {
        sample0 = this.lastSample;
      } else if (srcIndexFloor >= inputData.length) {
        sample0 = inputData[inputData.length - 1];
      } else {
        sample0 = inputData[srcIndexFloor];
      }

      const sample1 = srcIndexCeil >= inputData.length 
        ? inputData[inputData.length - 1] 
        : inputData[srcIndexCeil];

      // Linear interpolation
      outputData[i] = sample0 * (1 - fraction) + sample1 * fraction;
    }

    // Update state for next chunk
    // Calculate how much of the input we actually consumed
    const samplesConsumed = outputLength * this.ratio;
    this.fractionalOffset = (this.fractionalOffset + inputData.length) - samplesConsumed;
    
    // Save last sample for interpolation at chunk boundary
    if (inputData.length > 0) {
      this.lastSample = inputData[inputData.length - 1];
    }

    return outputData;
  }

  /**
   * Reset the resampler state (call when starting a new audio stream)
   */
  reset(): void {
    this.fractionalOffset = 0;
    this.lastSample = 0;
  }
}

/**
 * Simple stateless resample for one-off conversions (not recommended for streaming)
 * @deprecated Use StreamingResampler for continuous audio processing
 */
export function resampleAudio(
  inputData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return inputData;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.ceil(inputData.length / ratio);
  const outputData = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    outputData[i] = inputData[srcIndexFloor] * (1 - fraction) + inputData[srcIndexCeil] * fraction;
  }

  return outputData;
}

/**
 * Convert Float32Array audio samples to PCM16 (Int16Array)
 * Audio samples are in range [-1.0, 1.0]
 * PCM16 values are in range [-32768, 32767]
 */
export function float32ToPCM16(float32Array: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32Array.length);
  
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp the value to [-1.0, 1.0]
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    
    // Convert to 16-bit PCM
    // If positive: multiply by 32767
    // If negative: multiply by 32768
    pcm16[i] = clamped < 0 
      ? clamped * 0x8000  // 32768
      : clamped * 0x7FFF; // 32767
  }
  
  return pcm16;
}

/**
 * Convert Int16Array to base64 string
 */
export function pcm16ToBase64(pcm16: Int16Array): string {
  // Convert Int16Array to Uint8Array (little-endian byte representation)
  const uint8Array = new Uint8Array(pcm16.buffer);
  
  // Convert to base64
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  
  return btoa(binary);
}

/**
 * Combined conversion: Float32Array → PCM16 → base64
 */
export function float32ToBase64PCM16(float32Array: Float32Array): string {
  const pcm16 = float32ToPCM16(float32Array);
  return pcm16ToBase64(pcm16);
}

/**
 * Get audio data size info (for debugging/logging)
 */
export function getAudioDataInfo(float32Array: Float32Array) {
  const pcm16 = float32ToPCM16(float32Array);
  const base64 = pcm16ToBase64(pcm16);
  
  return {
    sampleCount: float32Array.length,
    durationMs: (float32Array.length / 16000) * 1000, // Assuming 16kHz
    pcm16Bytes: pcm16.byteLength,
    base64Length: base64.length,
  };
}
