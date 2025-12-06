import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  User,
  Camera,
  Volume2,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface MediaDevice {
  deviceId: string;
  label: string;
}

export default function MeetGreenRoom() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');

  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMicWorking, setIsMicWorking] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [meetingInfo, setMeetingInfo] = useState<{
    prospectName: string;
    scheduledAt: string | null;
    status: string;
    seller: { displayName: string; description: string | null } | null;
  } | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      setIsValidatingToken(true);
      try {
        const res = await fetch(`/api/meet/${token}`);
        if (!res.ok) {
          setIsTokenValid(false);
          return;
        }
        const data = await res.json();
        setMeetingInfo(data);
        setIsTokenValid(true);
      } catch (error) {
        console.error('[MeetGreenRoom] Token validation error:', error);
        setIsTokenValid(false);
      } finally {
        setIsValidatingToken(false);
      }
    };
    if (token) {
      validateToken();
    }
  }, [token]);

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}` }));
      const audios = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 5)}` }));
      
      setVideoDevices(videos);
      setAudioDevices(audios);

      if (videos.length > 0 && !selectedVideoDevice) {
        setSelectedVideoDevice(videos[0].deviceId);
      }
      if (audios.length > 0 && !selectedAudioDevice) {
        setSelectedAudioDevice(audios[0].deviceId);
      }
    } catch (error) {
      console.error('[MeetGreenRoom] Error enumerating devices:', error);
    }
  }, [selectedVideoDevice, selectedAudioDevice]);

  const startVideo = useCallback(async (deviceId?: string) => {
    try {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setVideoStream(stream);
      setVideoError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      await enumerateDevices();
    } catch (error: any) {
      console.error('[MeetGreenRoom] Video error:', error);
      setVideoError(error.name === 'NotAllowedError' 
        ? 'Permesso negato. Abilita la webcam nelle impostazioni del browser.'
        : 'Webcam non disponibile');
    }
  }, [videoStream, enumerateDevices]);

  const startAudio = useCallback(async (deviceId?: string) => {
    try {
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      const constraints: MediaStreamConstraints = {
        audio: deviceId 
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setAudioStream(stream);
      setAudioError(null);

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let consecutiveHighSamples = 0;

      const updateLevel = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        const normalizedLevel = Math.min(average / 128, 1);
        
        setAudioLevel(normalizedLevel);
        
        if (normalizedLevel > 0.05) {
          consecutiveHighSamples++;
          if (consecutiveHighSamples > 10) {
            setIsMicWorking(true);
          }
        } else {
          consecutiveHighSamples = Math.max(0, consecutiveHighSamples - 1);
        }

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
      await enumerateDevices();
    } catch (error: any) {
      console.error('[MeetGreenRoom] Audio error:', error);
      setAudioError(error.name === 'NotAllowedError'
        ? 'Permesso negato. Abilita il microfono nelle impostazioni del browser.'
        : 'Microfono non disponibile');
    }
  }, [audioStream, enumerateDevices]);

  useEffect(() => {
    if (isTokenValid) {
      startVideo();
      startAudio();
    }

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isTokenValid]);

  useEffect(() => {
    if (selectedVideoDevice && isTokenValid) {
      startVideo(selectedVideoDevice);
    }
  }, [selectedVideoDevice]);

  useEffect(() => {
    if (selectedAudioDevice && isTokenValid) {
      startAudio(selectedAudioDevice);
    }
  }, [selectedAudioDevice]);

  const handleJoinCall = () => {
    if (!guestName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome richiesto',
        description: 'Inserisci il tuo nome per entrare nella call',
      });
      return;
    }

    setIsJoining(true);
    
    console.log('[MeetGreenRoom] Joining call with:', {
      token,
      guestName: guestName.trim(),
      videoDevice: selectedVideoDevice,
      audioDevice: selectedAudioDevice,
    });

    toast({
      title: 'Entrando nella call...',
      description: `Benvenuto ${guestName.trim()}!`,
    });
  };

  if (isValidatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto" />
          <p className="text-white/70">Verifica link in corso...</p>
        </div>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Link non valido</h1>
          <p className="text-white/60">
            Il link che hai utilizzato non è valido o è scaduto. 
            Contatta l'organizzatore per ricevere un nuovo invito.
          </p>
        </div>
      </div>
    );
  }

  const initials = guestName 
    ? guestName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/80 to-slate-900 flex flex-col lg:flex-row overflow-hidden">
      
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="w-full lg:w-3/5 min-h-[50vh] lg:min-h-screen relative flex items-center justify-center p-4 lg:p-8">
        
        <div className="absolute top-4 left-4 lg:top-8 lg:left-8 flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div className="text-white">
            <p className="text-sm font-semibold">Video Meeting</p>
            <p className="text-xs text-white/60">Green Room</p>
          </div>
        </div>

        <div className="w-full max-w-2xl">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-800 border-2 border-white/10 shadow-2xl">
            {videoError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-white/60 p-4">
                <VideoOff className="w-16 h-16 mb-4 text-white/40" />
                <p className="text-center text-sm">{videoError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4 border-white/20 text-white hover:bg-white/10"
                  onClick={() => startVideo()}
                >
                  Riprova
                </Button>
              </div>
            ) : !videoStream ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800">
                <Loader2 className="w-12 h-12 animate-spin text-purple-400 mb-4" />
                <p className="text-white/60 text-sm">Avvio webcam...</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            )}

            {guestName && videoStream && (
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <span className="text-white text-sm font-medium">{guestName}</span>
              </div>
            )}

            {!guestName && videoStream && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold opacity-80">
                  <User className="w-12 h-12" />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-3 h-3 rounded-full ${isMicWorking ? 'bg-green-500' : audioError ? 'bg-red-500' : 'bg-yellow-500'} animate-pulse`} />
              <span className="text-white text-sm font-medium">
                {audioError ? 'Microfono non disponibile' : isMicWorking ? 'Microfono funzionante' : 'In attesa di audio...'}
              </span>
            </div>
            
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                animate={{ width: `${audioLevel * 100}%` }}
                transition={{ duration: 0.05 }}
              />
            </div>

            {audioError && (
              <p className="text-red-400 text-xs mt-2">{audioError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-2/5 bg-white/5 backdrop-blur-xl lg:bg-white relative overflow-y-auto border-t lg:border-t-0 lg:border-l border-white/10 lg:border-slate-200">
        <div className="min-h-full flex flex-col justify-center p-6 lg:p-10 xl:p-12 max-w-lg mx-auto py-8 lg:py-0">
          
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/20 lg:bg-purple-100 border border-purple-500/30 lg:border-purple-200 mb-4">
              <Sparkles className="w-4 h-4 text-purple-400 lg:text-purple-600" />
              <span className="text-xs font-bold text-purple-300 lg:text-purple-700 uppercase tracking-wider">Preparazione Call</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white lg:text-slate-900 mb-2">
              Pronto ad entrare?
            </h1>
            <p className="text-white/60 lg:text-slate-500">
              Configura audio e video prima di entrare nella call
            </p>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/20 lg:via-slate-200 to-transparent mb-8" />

          <div className="space-y-5 mb-8">
            <div className="space-y-2">
              <Label className="text-white/80 lg:text-slate-700 font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                Il tuo nome *
              </Label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Come vuoi essere chiamato?"
                className="h-12 text-base bg-white/10 lg:bg-slate-50 border-white/20 lg:border-slate-200 text-white lg:text-slate-900 placeholder:text-white/40 lg:placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80 lg:text-slate-700 font-semibold flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Camera
              </Label>
              <Select value={selectedVideoDevice} onValueChange={setSelectedVideoDevice}>
                <SelectTrigger className="h-12 bg-white/10 lg:bg-slate-50 border-white/20 lg:border-slate-200 text-white lg:text-slate-900">
                  <SelectValue placeholder="Seleziona camera" />
                </SelectTrigger>
                <SelectContent>
                  {videoDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80 lg:text-slate-700 font-semibold flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Microfono
              </Label>
              <Select value={selectedAudioDevice} onValueChange={setSelectedAudioDevice}>
                <SelectTrigger className="h-12 bg-white/10 lg:bg-slate-50 border-white/20 lg:border-slate-200 text-white lg:text-slate-900">
                  <SelectValue placeholder="Seleziona microfono" />
                </SelectTrigger>
                <SelectContent>
                  {audioDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Alert className="mb-8 border-purple-500/30 lg:border-purple-200 bg-purple-500/10 lg:bg-purple-50">
            <Bot className="w-4 h-4 text-purple-400 lg:text-purple-600" />
            <AlertDescription className="text-white/70 lg:text-purple-700 text-sm">
              Questa chiamata è assistita da AI per migliorare la qualità. 
              Entrando accetti questa condizione.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleJoinCall}
            disabled={!guestName.trim() || isJoining}
            size="lg"
            className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-400 disabled:to-slate-400 disabled:opacity-50 shadow-xl shadow-purple-900/30"
          >
            {isJoining ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                Entra nella Call
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>

          <div className="mt-6 flex items-center justify-center gap-2 text-white/40 lg:text-slate-400 text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>Connessione sicura e crittografata</span>
          </div>
        </div>
      </div>
    </div>
  );
}
