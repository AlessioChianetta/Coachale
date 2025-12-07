import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioLevelMonitorResult {
  audioLevel: number;
  isSpeaking: boolean;
  startMonitoring: (stream: MediaStream) => void;
  stopMonitoring: () => void;
}

const SPEAKING_THRESHOLD = 0.05;
const SPEAKING_DEBOUNCE_MS = 150;

export function useAudioLevelMonitor(): AudioLevelMonitorResult {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMonitoringRef = useRef(false);

  const stopMonitoring = useCallback(() => {
    isMonitoringRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setAudioLevel(0);
    setIsSpeaking(false);
  }, []);

  const startMonitoring = useCallback((stream: MediaStream) => {
    if (isMonitoringRef.current) {
      stopMonitoring();
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('[AudioLevelMonitor] No audio tracks in stream');
      return;
    }

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      isMonitoringRef.current = true;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!isMonitoringRef.current || !analyserRef.current) {
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = Math.min(average / 128, 1);
        
        setAudioLevel(normalizedLevel);
        
        if (normalizedLevel > SPEAKING_THRESHOLD) {
          setIsSpeaking(true);
          
          if (speakingTimeoutRef.current) {
            clearTimeout(speakingTimeoutRef.current);
          }
          
          speakingTimeoutRef.current = setTimeout(() => {
            if (isMonitoringRef.current) {
              setIsSpeaking(false);
            }
          }, SPEAKING_DEBOUNCE_MS);
        }
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          updateLevel();
        });
      } else {
        updateLevel();
      }

      console.log('[AudioLevelMonitor] Started monitoring audio level');
    } catch (error) {
      console.error('[AudioLevelMonitor] Failed to start monitoring:', error);
    }
  }, [stopMonitoring]);

  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    audioLevel,
    isSpeaking,
    startMonitoring,
    stopMonitoring,
  };
}
