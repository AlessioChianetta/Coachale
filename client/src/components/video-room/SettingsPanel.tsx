import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Video, Volume2, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useMediaDevices } from '@/hooks/useMediaDevices';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentVideoDeviceId?: string;
  currentAudioInputId?: string;
  currentAudioOutputId?: string;
  onVideoDeviceChange?: (deviceId: string) => void;
  onAudioInputChange?: (deviceId: string) => void;
  onAudioOutputChange?: (deviceId: string) => void;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  currentVideoDeviceId,
  currentAudioInputId,
  currentAudioOutputId,
  onVideoDeviceChange,
  onAudioInputChange,
  onAudioOutputChange,
}: SettingsPanelProps) {
  const {
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
  } = useMediaDevices();

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
        setPreviewStream(null);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const startPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
          audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
        });
        
        setPreviewStream(stream);
        
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioContextRef.current = new AudioContext();
          const source = audioContextRef.current.createMediaStreamSource(new MediaStream([audioTrack]));
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          source.connect(analyserRef.current);
          
          const updateLevel = () => {
            if (analyserRef.current) {
              const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
              analyserRef.current.getByteFrequencyData(dataArray);
              const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
              setAudioLevel(avg / 255);
            }
            animationFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      } catch (err) {
        console.error('[SettingsPanel] Error starting preview:', err);
      }
    };

    startPreview();

    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isOpen, selectedVideoDevice, selectedAudioInput]);

  const handleVideoChange = (deviceId: string) => {
    setSelectedVideoDevice(deviceId);
    onVideoDeviceChange?.(deviceId);
  };

  const handleAudioInputChange = (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    onAudioInputChange?.(deviceId);
  };

  const handleAudioOutputChange = (deviceId: string) => {
    setSelectedAudioOutput(deviceId);
    onAudioOutputChange?.(deviceId);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-blue-400" />
                  Impostazioni Audio/Video
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refreshDevices()}
                    className="text-gray-400 hover:text-white"
                    disabled={isLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-5">
                <div className="aspect-video bg-gray-950 rounded-lg overflow-hidden relative">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  {!previewStream && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-gray-500 text-sm">Caricamento anteprima...</div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 flex items-center gap-2">
                    <Video className="w-4 h-4 text-blue-400" />
                    Videocamera
                  </Label>
                  <Select value={selectedVideoDevice} onValueChange={handleVideoChange}>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue placeholder="Seleziona videocamera" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {videoDevices.map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId} className="text-white">
                          {device.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 flex items-center gap-2">
                    <Mic className="w-4 h-4 text-green-400" />
                    Microfono
                  </Label>
                  <Select value={selectedAudioInput} onValueChange={handleAudioInputChange}>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue placeholder="Seleziona microfono" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {audioInputDevices.map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId} className="text-white">
                          {device.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-green-500"
                      animate={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Livello microfono</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-purple-400" />
                    Altoparlante
                  </Label>
                  <Select value={selectedAudioOutput} onValueChange={handleAudioOutputChange}>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue placeholder="Seleziona altoparlante" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {audioOutputDevices.map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId} className="text-white">
                          {device.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={onClose}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Applica
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
