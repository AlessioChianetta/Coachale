/**
 * Audio conversion utilities for PCM audio processing
 * Converts Float32Array → Int16Array (PCM16) → base64 string
 */

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
