/**
 * AudioWorklet Processor for capturing raw PCM audio
 * Captures mono audio at native sample rate and sends to main thread for resampling
 * 
 * BUFFER SIZE: 1920 samples = 40ms at 48kHz native rate
 * After resampling 48kHz → 16kHz (3:1), becomes 640 samples = 40ms at 16kHz
 * 
 * NOISE GATE: Professional gate with hysteresis, hold time, and gradual release
 * - Open threshold:  0.01 RMS (-40 dBFS) — standard WebRTC voice threshold
 * - Close threshold: 0.006 RMS — hysteresis prevents gate flutter
 * - Hold time: 4 buffers (~160ms) — preserves natural pauses between syllables
 * - Release: 3-buffer fade-out — eliminates audible clicks on gate close
 */

class PCMProcessor extends AudioWorkletProcessor {
  private bufferSize = 0;
  private bufferThreshold = 1920;
  private audioBuffer: Float32Array[] = [];
  
  private readonly GATE_OPEN_THRESHOLD = 0.01;
  private readonly GATE_CLOSE_THRESHOLD = 0.006;
  private readonly HOLD_BUFFERS = 4;
  private readonly RELEASE_BUFFERS = 3;

  private gateOpen = false;
  private holdCounter = 0;
  private releaseCounter = 0;
  private logCounter = 0;

  constructor() {
    super();
    console.log(
      '🎙️ PCMProcessor initialized\n' +
      '   ├─ Buffer: 1920 samples = 40ms @48kHz\n' +
      '   ├─ Gate OPEN threshold:  0.01 RMS (-40 dBFS)\n' +
      '   ├─ Gate CLOSE threshold: 0.006 RMS (hysteresis)\n' +
      '   ├─ Hold: 4 buffers (~160ms)\n' +
      '   └─ Release: 3-buffer fade-out'
    );
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const inputChannel = input[0];
    if (!inputChannel || inputChannel.length === 0) return true;

    this.audioBuffer.push(new Float32Array(inputChannel));
    this.bufferSize += inputChannel.length;

    if (this.bufferSize >= this.bufferThreshold) {
      this.sendAudioData();
    }

    return true;
  }

  private calculateRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private sendAudioData() {
    if (this.audioBuffer.length === 0) return;

    const totalLength = this.bufferSize;
    const concatenated = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.audioBuffer) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    const rms = this.calculateRMS(concatenated);
    let dataToSend: Float32Array;
    let gateState: string;

    if (rms >= this.GATE_OPEN_THRESHOLD) {
      this.gateOpen = true;
      this.holdCounter = this.HOLD_BUFFERS;
      this.releaseCounter = 0;
      dataToSend = concatenated;
      gateState = 'OPEN';
    } else if (this.gateOpen && rms >= this.GATE_CLOSE_THRESHOLD) {
      this.holdCounter = this.HOLD_BUFFERS;
      this.releaseCounter = 0;
      dataToSend = concatenated;
      gateState = 'OPEN-HYSTERESIS';
    } else if (this.holdCounter > 0) {
      this.holdCounter--;
      dataToSend = concatenated;
      gateState = `HOLD(${this.holdCounter})`;
    } else if (this.gateOpen) {
      this.releaseCounter++;
      const envelope = 1.0 - (this.releaseCounter / this.RELEASE_BUFFERS);
      if (envelope <= 0) {
        this.gateOpen = false;
        this.releaseCounter = 0;
        dataToSend = new Float32Array(totalLength);
        gateState = 'CLOSED';
      } else {
        dataToSend = new Float32Array(totalLength);
        for (let i = 0; i < totalLength; i++) {
          const progress = i / totalLength;
          const sampleEnvelope = envelope * (1.0 - progress) + (envelope - (1.0 / this.RELEASE_BUFFERS)) * progress;
          dataToSend[i] = concatenated[i] * Math.max(0, sampleEnvelope);
        }
        gateState = `RELEASE(${this.releaseCounter}/${this.RELEASE_BUFFERS})`;
      }
    } else {
      dataToSend = new Float32Array(totalLength);
      gateState = 'CLOSED';
    }

    this.logCounter++;
    if (this.logCounter % 50 === 0 || (gateState !== 'CLOSED' && gateState !== 'OPEN')) {
      const bar = '█'.repeat(Math.min(20, Math.round(rms * 200))) + '░'.repeat(Math.max(0, 20 - Math.round(rms * 200)));
      const icon = this.gateOpen ? '🟢' : '🔴';
      console.log(`${icon} GATE ${gateState.padEnd(18)} │ RMS ${rms.toFixed(4)} │ ${bar} │`);
    }

    this.port.postMessage({
      type: 'audio',
      data: dataToSend,
      timestamp: (globalThis as any).currentTime || Date.now(),
      rms: rms,
      isFiltered: !this.gateOpen && this.holdCounter === 0 && this.releaseCounter === 0,
      gateState: gateState
    });

    this.audioBuffer = [];
    this.bufferSize = 0;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
