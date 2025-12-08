import { useState, useRef, useCallback, useEffect } from 'react';
import { StreamingResampler, float32ToBase64PCM16 } from '@/components/ai-assistant/live-mode/audio-worklet/audio-converter';

interface AudioCaptureState {
  isCapturing: boolean;
  error: string | null;
  hostAudioLevel: number;
  prospectAudioLevel: number;
}

interface UseAudioCaptureOptions {
  onAudioChunk: (audioBase64: string, speakerId: string, speakerName: string) => void;
  hostParticipantId: string | null;
  hostName: string;
  enabled: boolean;
}

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_THRESHOLD = 1920;

export function useAudioCapture({
  onAudioChunk,
  hostParticipantId,
  hostName,
  enabled,
}: UseAudioCaptureOptions) {
  const [state, setState] = useState<AudioCaptureState>({
    isCapturing: false,
    error: null,
    hostAudioLevel: 0,
    prospectAudioLevel: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const hostWorkletRef = useRef<AudioWorkletNode | null>(null);
  const prospectWorkletRef = useRef<AudioWorkletNode | null>(null);
  const hostResamplerRef = useRef<StreamingResampler | null>(null);
  const prospectResamplerRef = useRef<StreamingResampler | null>(null);
  const hostBufferRef = useRef<Float32Array[]>([]);
  const prospectBufferRef = useRef<Float32Array[]>([]);
  const hostBufferSizeRef = useRef(0);
  const prospectBufferSizeRef = useRef(0);

  const processAudioBuffer = useCallback((
    buffer: Float32Array[],
    bufferSize: { current: number },
    resampler: StreamingResampler | null,
    speakerId: string,
    speakerName: string
  ) => {
    if (buffer.length === 0 || bufferSize.current < BUFFER_THRESHOLD) return;

    const totalLength = bufferSize.current;
    const concatenated = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of buffer) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    let resampledData = concatenated;
    if (resampler) {
      resampledData = resampler.process(concatenated);
    }

    const base64Audio = float32ToBase64PCM16(resampledData);
    console.log(`📤 [STEP 2] Sending audio chunk to server - Speaker: ${speakerName}, Size: ${base64Audio.length} chars`);
    onAudioChunk(base64Audio, speakerId, speakerName);

    buffer.length = 0;
    bufferSize.current = 0;
  }, [onAudioChunk]);

  const startCapture = useCallback(async (
    localStream: MediaStream | null,
    remoteStream: MediaStream | null,
    prospectParticipantId: string | null,
    prospectName: string
  ) => {
    if (!enabled || !localStream) {
      console.log('[AudioCapture] Not enabled or no local stream');
      return;
    }

    try {
      setState(prev => ({ ...prev, isCapturing: true, error: null }));

      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      const sourceSampleRate = audioContext.sampleRate;
      hostResamplerRef.current = new StreamingResampler(sourceSampleRate, TARGET_SAMPLE_RATE);
      prospectResamplerRef.current = new StreamingResampler(sourceSampleRate, TARGET_SAMPLE_RATE);

      const localAudioTrack = localStream.getAudioTracks()[0];
      if (localAudioTrack && hostParticipantId) {
        const localMediaStream = new MediaStream([localAudioTrack]);
        const localSource = audioContext.createMediaStreamSource(localMediaStream);

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        localSource.connect(analyser);

        const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        localSource.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);

        let hostChunkCount = 0;
        scriptProcessor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          hostBufferRef.current.push(new Float32Array(inputData));
          hostBufferSizeRef.current += inputData.length;
          hostChunkCount++;

          if (hostChunkCount % 50 === 1) {
            console.log(`🎤 [STEP 1] HOST audio captured - Chunk #${hostChunkCount}, BufferSize: ${hostBufferSizeRef.current}`);
          }

          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          setState(prev => ({ ...prev, hostAudioLevel: rms }));

          if (hostBufferSizeRef.current >= BUFFER_THRESHOLD) {
            processAudioBuffer(
              hostBufferRef.current,
              hostBufferSizeRef,
              hostResamplerRef.current,
              hostParticipantId,
              hostName
            );
          }
        };

        console.log('[AudioCapture] Host audio capture started');
      }

      if (remoteStream && prospectParticipantId) {
        const remoteAudioTrack = remoteStream.getAudioTracks()[0];
        if (remoteAudioTrack) {
          const remoteMediaStream = new MediaStream([remoteAudioTrack]);
          const remoteSource = audioContext.createMediaStreamSource(remoteMediaStream);

          const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
          remoteSource.connect(scriptProcessor);
          scriptProcessor.connect(audioContext.destination);

          let prospectChunkCount = 0;
          scriptProcessor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            prospectBufferRef.current.push(new Float32Array(inputData));
            prospectBufferSizeRef.current += inputData.length;
            prospectChunkCount++;

            if (prospectChunkCount % 50 === 1) {
              console.log(`🎧 [STEP 1] PROSPECT audio captured - Chunk #${prospectChunkCount}, BufferSize: ${prospectBufferSizeRef.current}`);
            }

            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
              sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            setState(prev => ({ ...prev, prospectAudioLevel: rms }));

            if (prospectBufferSizeRef.current >= BUFFER_THRESHOLD) {
              processAudioBuffer(
                prospectBufferRef.current,
                prospectBufferSizeRef,
                prospectResamplerRef.current,
                prospectParticipantId,
                prospectName
              );
            }
          };

          console.log('[AudioCapture] Prospect audio capture started');
        }
      }

    } catch (error: any) {
      console.error('[AudioCapture] Error:', error);
      setState(prev => ({ ...prev, error: error.message, isCapturing: false }));
    }
  }, [enabled, hostParticipantId, hostName, processAudioBuffer]);

  const stopCapture = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    hostWorkletRef.current = null;
    prospectWorkletRef.current = null;
    hostResamplerRef.current = null;
    prospectResamplerRef.current = null;
    hostBufferRef.current = [];
    prospectBufferRef.current = [];
    hostBufferSizeRef.current = 0;
    prospectBufferSizeRef.current = 0;
    setState({
      isCapturing: false,
      error: null,
      hostAudioLevel: 0,
      prospectAudioLevel: 0,
    });
    console.log('[AudioCapture] Stopped');
  }, []);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    ...state,
    startCapture,
    stopCapture,
  };
}
