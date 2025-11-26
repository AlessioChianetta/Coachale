// @ts-check

/**
 * AudioWorklet Processor for capturing raw PCM audio
 * Captures mono audio at 16kHz and sends it to the main thread
 */

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    /** @type {number} */
    this.bufferSize = 0;
    
    /** @type {number} - ~40ms at 16kHz - balanced for barge-in + performance */
    this.bufferThreshold = 640;
    
    /** @type {Float32Array[]} */
    this.audioBuffer = [];
    
    console.log('🎙️ PCMProcessor initialized');
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
   * Send buffered audio data to main thread
   * @private
   */
  sendAudioData() {
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

    // Send to main thread
    this.port.postMessage({
      type: 'audio',
      data: concatenated,
      timestamp: globalThis.currentTime || Date.now(),
    });

    // Reset buffer
    this.audioBuffer = [];
    this.bufferSize = 0;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
