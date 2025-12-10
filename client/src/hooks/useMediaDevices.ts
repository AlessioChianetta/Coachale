import { useState, useEffect, useCallback } from 'react';

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface UseMediaDevicesResult {
  videoDevices: MediaDeviceOption[];
  audioInputDevices: MediaDeviceOption[];
  audioOutputDevices: MediaDeviceOption[];
  selectedVideoDevice: string;
  selectedAudioInput: string;
  selectedAudioOutput: string;
  setSelectedVideoDevice: (deviceId: string) => void;
  setSelectedAudioInput: (deviceId: string) => void;
  setSelectedAudioOutput: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useMediaDevices(): UseMediaDevicesResult {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceOption[]>([]);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceOption[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceOption[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoInputs = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Videocamera ${i + 1}`,
          kind: d.kind as MediaDeviceKind,
        }));
      
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microfono ${i + 1}`,
          kind: d.kind as MediaDeviceKind,
        }));
      
      const audioOutputs = devices
        .filter(d => d.kind === 'audiooutput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Altoparlante ${i + 1}`,
          kind: d.kind as MediaDeviceKind,
        }));
      
      setVideoDevices(videoInputs);
      setAudioInputDevices(audioInputs);
      setAudioOutputDevices(audioOutputs);
      
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
      if (!selectedAudioInput && audioInputs.length > 0) {
        setSelectedAudioInput(audioInputs[0].deviceId);
      }
      if (!selectedAudioOutput && audioOutputs.length > 0) {
        setSelectedAudioOutput(audioOutputs[0].deviceId);
      }
      
      console.log(`📹 [MediaDevices] Found ${videoInputs.length} cameras, ${audioInputs.length} mics, ${audioOutputs.length} speakers`);
    } catch (err: any) {
      console.error('[MediaDevices] Error enumerating devices:', err);
      setError(err.message || 'Impossibile accedere ai dispositivi');
    } finally {
      setIsLoading(false);
    }
  }, [selectedVideoDevice, selectedAudioInput, selectedAudioOutput]);

  useEffect(() => {
    refreshDevices();
    
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  return {
    videoDevices,
    audioInputDevices,
    audioOutputDevices,
    selectedVideoDevice,
    selectedAudioInput,
    selectedAudioOutput,
    setSelectedVideoDevice,
    setSelectedAudioInput,
    setSelectedAudioOutput,
    refreshDevices,
    isLoading,
    error,
  };
}
