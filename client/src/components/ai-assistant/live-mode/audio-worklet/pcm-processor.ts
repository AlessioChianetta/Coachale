/**
 * AudioWorklet Processor for capturing raw PCM audio
 * Captures mono audio at native sample rate and sends to main thread for resampling
 * 
 * BUFFER SIZE: 1920 samples = 40ms at 48kHz native rate
 * After resampling 48kHz → 16kHz (3:1), becomes 640 samples = 40ms at 16kHz
 * 
 * NOISE GATE: 0 (DISABLED) - All audio passes through, Gemini handles everything
 */

class PCMProcessor extends AudioWorkletProcessor {
  private bufferSize = 0;
  // INCREASED: 1920 samples = 40ms at 48kHz (native rate)
  // After resampling to 16kHz, this becomes 640 samples = 40ms
  private bufferThreshold = 1920;
  private audioBuffer: Float32Array[] = [];
  
  /** 
   * Noise Gate DISABLED (set to 0)
   * All audio passes through to Gemini
   */
  private readonly NOISE_THRESHOLD = 0;

  constructor() {
    super();
    console.log('🎙️ PCMProcessor initialized (buffer: 1920 samples = 40ms @48kHz, noise gate: DISABLED)');
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    
    // Check if we have valid input
    if (!input || input.length === 0) {
      return true;
    }

    // Get the first channel (mono)
    const inputChannel = input[0];
    
    if (!inputChannel || inputChannel.length === 0) {
      return true;
    }

    // Store the audio data
    this.audioBuffer.push(new Float32Array(inputChannel));
    this.bufferSize += inputChannel.length;

    // Send buffer when we reach threshold (~100ms)
    if (this.bufferSize >= this.bufferThreshold) {
      this.sendAudioData();
    }

    return true;
  }

  /**
   * Calculate RMS (Root Mean Square) volume of audio data
   */
  private calculateRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  /**
   * Send buffered audio data to main thread with Noise Gate filtering
   */
  private sendAudioData() {
    if (this.audioBuffer.length === 0) {
      return;
    }

    // Concatenate all buffered chunks
    const totalLength = this.bufferSize;
    const concatenated = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.audioBuffer) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    // 🎚️ NOISE GATE LOGIC
    // Calculate volume (RMS) to determine if this is real speech or just noise
    const rms = this.calculateRMS(concatenated);
    
    // If volume is below threshold, send silence instead
    let dataToSend: Float32Array;
    if (rms < this.NOISE_THRESHOLD) {
      // Background noise detected - send zeros (digital silence)
      dataToSend = new Float32Array(totalLength).fill(0);
      // console.log('🔇 Noise Gate: Filtering background noise (RMS:', rms.toFixed(4), ')');
    } else {
      // Real speech detected - send actual audio
      dataToSend = concatenated;
      // console.log('🎤 Noise Gate: Passing speech (RMS:', rms.toFixed(4), ')');
    }

    // Send to main thread
    this.port.postMessage({
      type: 'audio',
      data: dataToSend,
      timestamp: (globalThis as any).currentTime || Date.now(),
      rms: rms, // Include RMS for debugging/visualization
      isFiltered: rms < this.NOISE_THRESHOLD
    });

    // Reset buffer
    this.audioBuffer = [];
    this.bufferSize = 0;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
