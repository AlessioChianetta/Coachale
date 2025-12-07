// @ts-check

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
  constructor() {
    super();
    
    /** @type {number} */
    this.bufferSize = 0;
    
    /** 
     * @type {number} 
     * INCREASED: 1920 samples = 40ms at 48kHz (native rate)
     * After resampling 3:1 → 640 samples = 40ms at 16kHz (what Gemini expects)
     */
    this.bufferThreshold = 1920;
    
    /** @type {Float32Array[]} */
    this.audioBuffer = [];
    
    /** 
     * @type {number} - Noise Gate DISABLED
     * All audio passes through to Gemini
     */
    this.NOISE_THRESHOLD = 0;
    
    console.log('🎙️ PCMProcessor initialized (buffer: 1920 samples = 40ms @48kHz, noise gate: DISABLED)');
  }

  /**
   * Process audio input
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   * @param {Record<string, Float32Array>} parameters
   * @returns {boolean}
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (!input || input.length === 0) {
      return true;
    }

    const inputChannel = input[0];
    
    if (!inputChannel || inputChannel.length === 0) {
      return true;
    }

    this.audioBuffer.push(new Float32Array(inputChannel));
    this.bufferSize += inputChannel.length;

    if (this.bufferSize >= this.bufferThreshold) {
      this.sendAudioData();
    }

    return true;
  }

  /**
   * Calculate RMS (Root Mean Square) volume of audio data
   * @param {Float32Array} data
   * @returns {number}
   * @private
   */
  calculateRMS(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  /**
   * Send buffered audio data to main thread with Noise Gate filtering
   * @private
   */
  sendAudioData() {
    if (this.audioBuffer.length === 0) {
      return;
    }

    const totalLength = this.bufferSize;
    const concatenated = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.audioBuffer) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    // 🎚️ NOISE GATE: Calculate RMS and filter low-level noise
    const rms = this.calculateRMS(concatenated);
    
    let dataToSend;
    if (rms < this.NOISE_THRESHOLD) {
      // Background noise - send digital silence
      dataToSend = new Float32Array(totalLength).fill(0);
    } else {
      // Real audio - pass through
      dataToSend = concatenated;
    }

    this.port.postMessage({
      type: 'audio',
      data: dataToSend,
      timestamp: globalThis.currentTime || Date.now(),
      rms: rms,
      isFiltered: rms < this.NOISE_THRESHOLD
    });

    this.audioBuffer = [];
    this.bufferSize = 0;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
