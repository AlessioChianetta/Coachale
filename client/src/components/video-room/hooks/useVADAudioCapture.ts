import { useState, useRef, useCallback, useEffect } from 'react';
import { MicVAD, RealTimeVADOptions } from '@ricky0123/vad-web';
import { StreamingResampler, float32ToBase64PCM16 } from '@/components/ai-assistant/live-mode/audio-worklet/audio-converter';

interface VADAudioCaptureState {
  isCapturing: boolean;
  error: string | null;
  hostAudioLevel: number;
  prospectAudioLevel: number;
  hostIsSpeaking: boolean;
  prospectIsSpeaking: boolean;
}

interface UseVADAudioCaptureOptions {
  onAudioChunk: (audioBase64: string, speakerId: string, speakerName: string) => void;
  onSpeechStart: (speakerId: string, speakerName: string) => void;
  onSpeechEnd: (speakerId: string, speakerName: string) => void;
  hostParticipantId: string | null;
  hostName: string;
  enabled: boolean;
}

const TARGET_SAMPLE_RATE = 16000;
const PRE_ROLL_DURATION_MS = 500;
const PRE_ROLL_SAMPLES = Math.floor((PRE_ROLL_DURATION_MS / 1000) * TARGET_SAMPLE_RATE);

export function useVADAudioCapture({
  onAudioChunk,
  onSpeechStart,
  onSpeechEnd,
  hostParticipantId,
  hostName,
  enabled,
}: UseVADAudioCaptureOptions) {
  const [state, setState] = useState<VADAudioCaptureState>({
    isCapturing: false,
    error: null,
    hostAudioLevel: 0,
    prospectAudioLevel: 0,
    hostIsSpeaking: false,
    prospectIsSpeaking: false,
  });

  const hostVadRef = useRef<MicVAD | null>(null);
  const prospectVadRef = useRef<MicVAD | null>(null);
  const hostResamplerRef = useRef<StreamingResampler | null>(null);
  const prospectResamplerRef = useRef<StreamingResampler | null>(null);
  
  const hostPreRollBufferRef = useRef<Float32Array[]>([]);
  const prospectPreRollBufferRef = useRef<Float32Array[]>([]);
  
  const hostSpeechBufferRef = useRef<Float32Array[]>([]);
  const prospectSpeechBufferRef = useRef<Float32Array[]>([]);
  
  const hostIsSpeakingRef = useRef(false);
  const prospectIsSpeakingRef = useRef(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const hostAnalyserRef = useRef<AnalyserNode | null>(null);
  const prospectAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const calculateRMS = useCallback((data: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }, []);

  const addToPreRollBuffer = useCallback((
    buffer: React.MutableRefObject<Float32Array[]>,
    data: Float32Array,
    maxSamples: number
  ) => {
    buffer.current.push(new Float32Array(data));
    
    let totalSamples = buffer.current.reduce((acc, arr) => acc + arr.length, 0);
    while (totalSamples > maxSamples && buffer.current.length > 0) {
      const removed = buffer.current.shift();
      if (removed) {
        totalSamples -= removed.length;
      }
    }
  }, []);

  const flushSpeechBuffer = useCallback((
    speakerId: string,
    speakerName: string,
    speechBuffer: React.MutableRefObject<Float32Array[]>,
    preRollBuffer: React.MutableRefObject<Float32Array[]>,
    resampler: StreamingResampler | null,
    includingPreRoll: boolean = false
  ) => {
    const chunks = includingPreRoll 
      ? [...preRollBuffer.current, ...speechBuffer.current]
      : speechBuffer.current;
    
    if (chunks.length === 0) return;

    const totalLength = chunks.reduce((acc, arr) => acc + arr.length, 0);
    const concatenated = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    let processedData = concatenated;
    if (resampler) {
      processedData = resampler.process(concatenated);
    }

    const base64Audio = float32ToBase64PCM16(processedData);
    console.log(`📤 [VAD-STEP 2] Sending speech chunk - Speaker: ${speakerName}, Size: ${base64Audio.length} chars, Samples: ${processedData.length}`);
    onAudioChunk(base64Audio, speakerId, speakerName);

    speechBuffer.current = [];
  }, [onAudioChunk]);

  const handleHostSpeechStart = useCallback(() => {
    if (!hostParticipantId) return;
    
    hostIsSpeakingRef.current = true;
    setState(prev => ({ ...prev, hostIsSpeaking: true }));
    
    console.log(`🎤 [VAD] HOST speech started - ${hostName}`);
    onSpeechStart(hostParticipantId, hostName);
    
    if (hostPreRollBufferRef.current.length > 0) {
      hostSpeechBufferRef.current = [...hostPreRollBufferRef.current];
      console.log(`📦 [VAD] Pre-roll buffer added: ${hostPreRollBufferRef.current.length} chunks`);
    }
  }, [hostParticipantId, hostName, onSpeechStart]);

  const handleHostSpeechEnd = useCallback(() => {
    if (!hostParticipantId) return;
    
    hostIsSpeakingRef.current = false;
    setState(prev => ({ ...prev, hostIsSpeaking: false }));
    
    console.log(`🔇 [VAD] HOST speech ended - ${hostName}`);
    
    flushSpeechBuffer(
      hostParticipantId,
      hostName,
      hostSpeechBufferRef,
      hostPreRollBufferRef,
      hostResamplerRef.current,
      false
    );
    
    onSpeechEnd(hostParticipantId, hostName);
  }, [hostParticipantId, hostName, onSpeechEnd, flushSpeechBuffer]);

  const handleProspectSpeechStart = useCallback((prospectId: string, prospectName: string) => {
    prospectIsSpeakingRef.current = true;
    setState(prev => ({ ...prev, prospectIsSpeaking: true }));
    
    console.log(`🎧 [VAD] PROSPECT speech started - ${prospectName}`);
    onSpeechStart(prospectId, prospectName);
    
    if (prospectPreRollBufferRef.current.length > 0) {
      prospectSpeechBufferRef.current = [...prospectPreRollBufferRef.current];
      console.log(`📦 [VAD] Pre-roll buffer added: ${prospectPreRollBufferRef.current.length} chunks`);
    }
  }, [onSpeechStart]);

  const handleProspectSpeechEnd = useCallback((prospectId: string, prospectName: string) => {
    prospectIsSpeakingRef.current = false;
    setState(prev => ({ ...prev, prospectIsSpeaking: false }));
    
    console.log(`🔇 [VAD] PROSPECT speech ended - ${prospectName}`);
    
    flushSpeechBuffer(
      prospectId,
      prospectName,
      prospectSpeechBufferRef,
      prospectPreRollBufferRef,
      prospectResamplerRef.current,
      false
    );
    
    onSpeechEnd(prospectId, prospectName);
  }, [onSpeechEnd, flushSpeechBuffer]);

  const startCapture = useCallback(async (
    localStream: MediaStream | null,
    remoteStream: MediaStream | null,
    prospectParticipantId: string | null,
    prospectName: string
  ) => {
    if (!enabled || !localStream) {
      console.log('[VAD-AudioCapture] Not enabled or no local stream');
      return;
    }

    try {
      setState(prev => ({ ...prev, isCapturing: true, error: null }));
      console.log('[VAD-AudioCapture] Starting with Silero VAD neural network...');

      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      const sourceSampleRate = audioContext.sampleRate;
      hostResamplerRef.current = new StreamingResampler(sourceSampleRate, TARGET_SAMPLE_RATE);
      prospectResamplerRef.current = new StreamingResampler(sourceSampleRate, TARGET_SAMPLE_RATE);

      if (hostParticipantId) {
        const localAudioTrack = localStream.getAudioTracks()[0];
        if (localAudioTrack) {
          console.log('[VAD] Initializing HOST VAD with Silero neural network...');
          
          const hostVadOptions: Partial<RealTimeVADOptions> = {
            stream: localStream,
            positiveSpeechThreshold: 0.5,
            negativeSpeechThreshold: 0.35,
            redemptionFrames: 8,
            minSpeechFrames: 3,
            preSpeechPadFrames: 10,
            workletURL: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.13/dist/vad.worklet.bundle.min.js",
            modelURL: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.13/dist/silero_vad.onnx",
            ortConfig: (ort: any) => {
              ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/";
              ort.env.wasm.numThreads = 1;
            },
            onSpeechStart: () => {
              handleHostSpeechStart();
            },
            onSpeechEnd: (audio: Float32Array) => {
              if (hostIsSpeakingRef.current) {
                hostSpeechBufferRef.current.push(new Float32Array(audio));
              }
              handleHostSpeechEnd();
            },
            onFrameProcessed: (probs: { isSpeech: number; notSpeech: number }, frame: Float32Array) => {
              const rms = calculateRMS(frame);
              setState(prev => ({ ...prev, hostAudioLevel: rms }));
              
              addToPreRollBuffer(hostPreRollBufferRef, frame, PRE_ROLL_SAMPLES);
              
              if (hostIsSpeakingRef.current) {
                hostSpeechBufferRef.current.push(new Float32Array(frame));
                
                if (hostSpeechBufferRef.current.length % 25 === 0) {
                  flushSpeechBuffer(
                    hostParticipantId,
                    hostName,
                    hostSpeechBufferRef,
                    hostPreRollBufferRef,
                    hostResamplerRef.current,
                    false
                  );
                }
              }
            },
          };

          try {
            hostVadRef.current = await MicVAD.new(hostVadOptions);
            hostVadRef.current.start();
            console.log('✅ [VAD] HOST Silero VAD started successfully');
          } catch (vadError) {
            console.error('❌ [VAD] Failed to initialize HOST VAD:', vadError);
            throw vadError;
          }
        }
      }

      if (remoteStream && prospectParticipantId) {
        const remoteAudioTrack = remoteStream.getAudioTracks()[0];
        if (remoteAudioTrack) {
          console.log('[VAD] Setting up PROSPECT audio capture with RMS-based VAD fallback...');
          
          const remoteMediaStream = new MediaStream([remoteAudioTrack]);
          const remoteSource = audioContext.createMediaStreamSource(remoteMediaStream);
          
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          remoteSource.connect(analyser);
          prospectAnalyserRef.current = analyser;
          
          const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
          remoteSource.connect(scriptProcessor);
          scriptProcessor.connect(audioContext.destination);
          
          const SPEECH_THRESHOLD = 0.01;
          let silenceFrames = 0;
          const SILENCE_FRAMES_THRESHOLD = 12;
          
          scriptProcessor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            const rms = calculateRMS(inputData);
            setState(prev => ({ ...prev, prospectAudioLevel: rms }));
            
            addToPreRollBuffer(prospectPreRollBufferRef, inputData, PRE_ROLL_SAMPLES);
            
            const isSpeech = rms > SPEECH_THRESHOLD;
            
            if (isSpeech) {
              silenceFrames = 0;
              
              if (!prospectIsSpeakingRef.current) {
                handleProspectSpeechStart(prospectParticipantId, prospectName);
              }
              
              prospectSpeechBufferRef.current.push(new Float32Array(inputData));
              
              if (prospectSpeechBufferRef.current.length % 25 === 0) {
                flushSpeechBuffer(
                  prospectParticipantId,
                  prospectName,
                  prospectSpeechBufferRef,
                  prospectPreRollBufferRef,
                  prospectResamplerRef.current,
                  false
                );
              }
            } else {
              silenceFrames++;
              
              if (prospectIsSpeakingRef.current && silenceFrames >= SILENCE_FRAMES_THRESHOLD) {
                handleProspectSpeechEnd(prospectParticipantId, prospectName);
              }
            }
          };
          
          console.log('✅ [VAD] PROSPECT RMS-based VAD started');
        }
      }

      console.log('[VAD-AudioCapture] Capture started successfully');

    } catch (error: any) {
      console.error('[VAD-AudioCapture] Error:', error);
      setState(prev => ({ ...prev, error: error.message, isCapturing: false }));
    }
  }, [
    enabled,
    hostParticipantId,
    hostName,
    calculateRMS,
    addToPreRollBuffer,
    handleHostSpeechStart,
    handleHostSpeechEnd,
    handleProspectSpeechStart,
    handleProspectSpeechEnd,
    flushSpeechBuffer,
  ]);

  const stopCapture = useCallback(() => {
    console.log('[VAD-AudioCapture] Stopping...');
    
    if (hostVadRef.current) {
      hostVadRef.current.pause();
      hostVadRef.current.destroy();
      hostVadRef.current = null;
    }
    
    if (prospectVadRef.current) {
      prospectVadRef.current.pause();
      prospectVadRef.current.destroy();
      prospectVadRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    hostResamplerRef.current = null;
    prospectResamplerRef.current = null;
    hostPreRollBufferRef.current = [];
    prospectPreRollBufferRef.current = [];
    hostSpeechBufferRef.current = [];
    prospectSpeechBufferRef.current = [];
    hostIsSpeakingRef.current = false;
    prospectIsSpeakingRef.current = false;
    
    setState({
      isCapturing: false,
      error: null,
      hostAudioLevel: 0,
      prospectAudioLevel: 0,
      hostIsSpeaking: false,
      prospectIsSpeaking: false,
    });
    
    console.log('[VAD-AudioCapture] Stopped');
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
