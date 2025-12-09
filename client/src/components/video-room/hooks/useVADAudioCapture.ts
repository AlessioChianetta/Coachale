import { useState, useRef, useCallback, useEffect } from 'react';
import { StreamingResampler, float32ToBase64PCM16 } from '@/components/ai-assistant/live-mode/audio-worklet/audio-converter';

let vadModule: any = null;
const ONNX_CDN_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js';
const VAD_CDN_URL = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/bundle.min.js';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function loadVADFromCDN(): Promise<any> {
  if (vadModule) return vadModule;
  
  if ((window as any).vad) {
    vadModule = (window as any).vad;
    return vadModule;
  }
  
  console.log('📦 [VAD] Loading ONNX Runtime from CDN...');
  await loadScript(ONNX_CDN_URL);
  
  console.log('📦 [VAD] Loading VAD bundle from CDN...');
  await loadScript(VAD_CDN_URL);
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('🔍 [VAD] window.ort available:', !!(window as any).ort);
  vadModule = (window as any).vad;
  if (vadModule) {
    console.log('✅ [VAD] Library loaded from CDN successfully');
    return vadModule;
  } else {
    throw new Error('VAD library not found after loading scripts');
  }
}

type MicVADType = any;

interface VADAudioCaptureState {
  isCapturing: boolean;
  error: string | null;
  hostAudioLevel: number;
  speakingProspects: Set<string>;
  hostIsSpeaking: boolean;
}

interface ProspectAudioState {
  id: string;
  name: string;
  isSpeaking: boolean;
  speechBuffer: Float32Array[];
  resampler: StreamingResampler;
  flushTimer: NodeJS.Timeout | null;
  silenceFrames: number;
  scriptProcessor: ScriptProcessorNode | null;
  audioLevel: number;
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
const MIN_SAMPLES_FOR_TRANSCRIPTION = 6400;
const SILENCE_TIMEOUT_MS = 1200;
const SPEECH_THRESHOLD = 0.01;
const SILENCE_FRAMES_THRESHOLD = 12;

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
    speakingProspects: new Set(),
    hostIsSpeaking: false,
  });

  const hostVadRef = useRef<MicVADType | null>(null);
  const hostIsSpeakingRef = useRef(false);
  const hostFlushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hostPendingAudioRef = useRef<Float32Array | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const prospectsRef = useRef<Map<string, ProspectAudioState>>(new Map());

  const calculateRMS = useCallback((data: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }, []);

  const sendAudioToServer = useCallback((
    audio: Float32Array,
    speakerId: string,
    speakerName: string,
    resampler: StreamingResampler | null = null
  ) => {
    if (audio.length < MIN_SAMPLES_FOR_TRANSCRIPTION) {
      console.log(`⏭️ [VAD] Audio too short (${audio.length} samples = ${Math.round(audio.length / 16)}ms), skipping`);
      return;
    }

    let processedData = audio;
    if (resampler) {
      processedData = resampler.process(audio);
    }

    const base64Audio = float32ToBase64PCM16(processedData);
    console.log(`📤 [VAD] Sending audio - Speaker: ${speakerName}, Samples: ${processedData.length}, Base64: ${base64Audio.length} chars`);
    onAudioChunk(base64Audio, speakerId, speakerName);
  }, [onAudioChunk]);

  const handleHostSpeechStart = useCallback(() => {
    if (!hostParticipantId) return;

    if (hostFlushTimerRef.current) {
      clearTimeout(hostFlushTimerRef.current);
      hostFlushTimerRef.current = null;
      console.log(`🔄 [VAD] HOST - Cancelled flush timer, speaker resumed`);
    }

    hostIsSpeakingRef.current = true;
    setState(prev => ({ ...prev, hostIsSpeaking: true }));

    console.log(`🎤 [VAD] HOST speech started - ${hostName}`);
    onSpeechStart(hostParticipantId, hostName);
  }, [hostParticipantId, hostName, onSpeechStart]);

  const handleHostSpeechEnd = useCallback((audio: Float32Array) => {
    if (!hostParticipantId) return;

    hostIsSpeakingRef.current = false;
    setState(prev => ({ ...prev, hostIsSpeaking: false }));

    hostPendingAudioRef.current = new Float32Array(audio);

    console.log(`🔇 [VAD] HOST speech ended - ${hostName} - scheduling flush after ${SILENCE_TIMEOUT_MS}ms silence`);

    if (hostFlushTimerRef.current) {
      clearTimeout(hostFlushTimerRef.current);
    }
    
    hostFlushTimerRef.current = setTimeout(() => {
      console.log(`⏰ [VAD] HOST - True silence detected, flushing audio`);
      if (hostPendingAudioRef.current && hostPendingAudioRef.current.length > 0) {
        sendAudioToServer(hostPendingAudioRef.current, hostParticipantId, hostName, null);
        hostPendingAudioRef.current = null;
      }
      onSpeechEnd(hostParticipantId, hostName);
    }, SILENCE_TIMEOUT_MS);
  }, [hostParticipantId, hostName, onSpeechEnd, sendAudioToServer]);

  const setupProspectCapture = useCallback((
    prospectId: string,
    prospectName: string,
    remoteStream: MediaStream,
    audioContext: AudioContext
  ) => {
    if (prospectsRef.current.has(prospectId)) {
      console.log(`[VAD] Prospect ${prospectName} already has audio capture setup`);
      return;
    }

    console.log(`[VAD] Setting up audio capture for PROSPECT: ${prospectName} (${prospectId})`);

    const remoteAudioTrack = remoteStream.getAudioTracks()[0];
    if (!remoteAudioTrack) {
      console.warn(`[VAD] No audio track for prospect ${prospectName}`);
      return;
    }

    const remoteMediaStream = new MediaStream([remoteAudioTrack]);
    const remoteSource = audioContext.createMediaStreamSource(remoteMediaStream);

    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    remoteSource.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    const prospectState: ProspectAudioState = {
      id: prospectId,
      name: prospectName,
      isSpeaking: false,
      speechBuffer: [],
      resampler: new StreamingResampler(audioContext.sampleRate, TARGET_SAMPLE_RATE),
      flushTimer: null,
      silenceFrames: 0,
      scriptProcessor,
      audioLevel: 0,
    };

    const flushProspectBuffer = () => {
      if (prospectState.speechBuffer.length === 0) return;

      const totalLength = prospectState.speechBuffer.reduce((acc, arr) => acc + arr.length, 0);
      const concatenated = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of prospectState.speechBuffer) {
        concatenated.set(chunk, offset);
        offset += chunk.length;
      }

      sendAudioToServer(concatenated, prospectId, prospectName, prospectState.resampler);
      prospectState.speechBuffer = [];
    };

    const handleProspectSpeechStart = () => {
      if (prospectState.flushTimer) {
        clearTimeout(prospectState.flushTimer);
        prospectState.flushTimer = null;
        console.log(`🔄 [VAD] PROSPECT ${prospectName} - Cancelled flush timer, speaker resumed`);
      }

      prospectState.isSpeaking = true;
      setState(prev => {
        const newSet = new Set(prev.speakingProspects);
        newSet.add(prospectId);
        return { ...prev, speakingProspects: newSet };
      });

      console.log(`🎧 [VAD] PROSPECT speech started - ${prospectName}`);
      onSpeechStart(prospectId, prospectName);
    };

    const handleProspectSpeechEnd = () => {
      prospectState.isSpeaking = false;
      setState(prev => {
        const newSet = new Set(prev.speakingProspects);
        newSet.delete(prospectId);
        return { ...prev, speakingProspects: newSet };
      });

      console.log(`🔇 [VAD] PROSPECT speech ended - ${prospectName} - scheduling flush after ${SILENCE_TIMEOUT_MS}ms`);

      if (prospectState.flushTimer) {
        clearTimeout(prospectState.flushTimer);
      }
      
      prospectState.flushTimer = setTimeout(() => {
        console.log(`⏰ [VAD] PROSPECT ${prospectName} - True silence detected, flushing buffer`);
        flushProspectBuffer();
        onSpeechEnd(prospectId, prospectName);
      }, SILENCE_TIMEOUT_MS);
    };

    scriptProcessor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const rms = calculateRMS(inputData);
      prospectState.audioLevel = rms;

      const isSpeech = rms > SPEECH_THRESHOLD;

      if (isSpeech) {
        prospectState.silenceFrames = 0;

        if (!prospectState.isSpeaking) {
          handleProspectSpeechStart();
        }

        prospectState.speechBuffer.push(new Float32Array(inputData));
      } else {
        prospectState.silenceFrames++;

        if (prospectState.isSpeaking && prospectState.silenceFrames >= SILENCE_FRAMES_THRESHOLD) {
          handleProspectSpeechEnd();
        }
      }
    };

    prospectsRef.current.set(prospectId, prospectState);
    console.log(`✅ [VAD] PROSPECT ${prospectName} audio capture ready (total: ${prospectsRef.current.size} prospects)`);
  }, [calculateRMS, onSpeechStart, onSpeechEnd, sendAudioToServer]);

  const removeProspectCapture = useCallback((prospectId: string) => {
    const prospectState = prospectsRef.current.get(prospectId);
    if (!prospectState) return;

    console.log(`[VAD] Removing audio capture for prospect ${prospectState.name}`);

    if (prospectState.flushTimer) {
      clearTimeout(prospectState.flushTimer);
    }

    if (prospectState.scriptProcessor) {
      prospectState.scriptProcessor.disconnect();
    }

    prospectsRef.current.delete(prospectId);
  }, []);

  const startCapture = useCallback(async (
    localStream: MediaStream | null,
    remoteStreams: Map<string, MediaStream>,
    prospects: Array<{ id: string; name: string }>
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

      if (hostParticipantId) {
        const localAudioTrack = localStream.getAudioTracks()[0];
        if (localAudioTrack) {
          console.log('[VAD] Initializing HOST VAD with Silero neural network...');

          const hostVadOptions = {
            getStream: async () => localStream,
            positiveSpeechThreshold: 0.2,
            negativeSpeechThreshold: 0.05,
            redemptionFrames: 45,
            minSpeechFrames: 5,
            preSpeechPadFrames: 20,
            onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
            baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/",

            onSpeechStart: () => {
              handleHostSpeechStart();
            },
            onSpeechEnd: (audio: Float32Array) => {
              handleHostSpeechEnd(audio);
            },
            onFrameProcessed: (probs: { isSpeech: number; notSpeech: number }, frame: Float32Array) => {
              const rms = calculateRMS(frame);
              setState(prev => ({ ...prev, hostAudioLevel: rms }));
            },
          };

          try {
            const vad = await loadVADFromCDN();
            hostVadRef.current = await vad.MicVAD.new(hostVadOptions);
            hostVadRef.current.start();
            console.log('✅ [VAD] HOST Silero VAD started successfully');
          } catch (vadError) {
            console.error('❌ [VAD] Failed to initialize HOST VAD:', vadError);
            throw vadError;
          }
        }
      }

      for (const prospect of prospects) {
        const remoteStream = remoteStreams.get(prospect.id);
        if (remoteStream) {
          setupProspectCapture(prospect.id, prospect.name, remoteStream, audioContext);
        }
      }

      console.log(`[VAD-AudioCapture] Capture started successfully (HOST + ${prospects.length} prospects)`);

    } catch (error: any) {
      console.error('[VAD-AudioCapture] Error:', error);
      setState(prev => ({ ...prev, error: error.message, isCapturing: false }));
    }
  }, [
    enabled,
    hostParticipantId,
    calculateRMS,
    handleHostSpeechStart,
    handleHostSpeechEnd,
    setupProspectCapture,
  ]);

  const updateProspects = useCallback((
    remoteStreams: Map<string, MediaStream>,
    prospects: Array<{ id: string; name: string }>
  ) => {
    if (!audioContextRef.current) return;

    const currentProspectIds = new Set(prospectsRef.current.keys());
    const newProspectIds = new Set(prospects.map(p => p.id));

    for (const prospectId of currentProspectIds) {
      if (!newProspectIds.has(prospectId)) {
        removeProspectCapture(prospectId);
      }
    }

    for (const prospect of prospects) {
      if (!currentProspectIds.has(prospect.id)) {
        const remoteStream = remoteStreams.get(prospect.id);
        if (remoteStream) {
          setupProspectCapture(prospect.id, prospect.name, remoteStream, audioContextRef.current);
        }
      }
    }
  }, [setupProspectCapture, removeProspectCapture]);

  const stopCapture = useCallback(() => {
    console.log('[VAD-AudioCapture] Stopping...');

    if (hostFlushTimerRef.current) {
      clearTimeout(hostFlushTimerRef.current);
      hostFlushTimerRef.current = null;
    }

    for (const [prospectId] of prospectsRef.current) {
      removeProspectCapture(prospectId);
    }
    prospectsRef.current.clear();

    if (hostVadRef.current) {
      hostVadRef.current.pause();
      hostVadRef.current.destroy();
      hostVadRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    hostIsSpeakingRef.current = false;
    hostPendingAudioRef.current = null;

    setState({
      isCapturing: false,
      error: null,
      hostAudioLevel: 0,
      speakingProspects: new Set(),
      hostIsSpeaking: false,
    });

    console.log('[VAD-AudioCapture] Stopped');
  }, [removeProspectCapture]);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    ...state,
    startCapture,
    stopCapture,
    updateProspects,
    prospectIsSpeaking: state.speakingProspects.size > 0,
  };
}
