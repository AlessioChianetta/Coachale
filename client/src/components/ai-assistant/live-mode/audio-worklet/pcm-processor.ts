/**
 * AudioWorklet Processor for capturing raw PCM audio
 * Captures mono audio at 16kHz and sends it to the main thread
 */

class PCMProcessor extends AudioWorkletProcessor {
  private bufferSize = 0;
  private bufferThreshold = 640; // ~40ms at 16kHz - balanced for barge-in + performance
  private audioBuffer: Float32Array[] = [];

  constructor() {
    super();
    console.log('🎙️ PCMProcessor initialized');
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

    // Send to main thread
    this.port.postMessage({
      type: 'audio',
      data: concatenated,
      timestamp: (globalThis as any).currentTime || Date.now(),
    });

    // Reset buffer
    this.audioBuffer = [];
    this.bufferSize = 0;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
