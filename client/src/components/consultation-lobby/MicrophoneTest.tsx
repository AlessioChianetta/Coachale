import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface MicrophoneTestProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

type MicStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'active';

export function MicrophoneTest({ onPermissionGranted, onPermissionDenied }: MicrophoneTestProps) {
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const requestMicrophoneAccess = async () => {
    setMicStatus('requesting');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      micStreamRef.current = stream;
      setMicStatus('granted');
      onPermissionGranted?.();
      
      setupAudioAnalyser(stream);
    } catch (error) {
      console.error('[MicrophoneTest] Permission denied:', error);
      setMicStatus('denied');
      setIsTesting(false);
      onPermissionDenied?.();
    }
  };

  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      startAudioLevelMonitoring();
    } catch (error) {
      console.error('[MicrophoneTest] Failed to setup audio analyser:', error);
    }
  };

  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1);
      
      setAudioLevel(normalizedLevel);
      setMicStatus(normalizedLevel > 0.05 ? 'active' : 'granted');
      
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  };

  const stopMicrophone = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setMicStatus('idle');
    setAudioLevel(0);
    setIsTesting(false);
  };

  const toggleTest = () => {
    if (isTesting) {
      stopMicrophone();
    } else {
      setIsTesting(true);
      requestMicrophoneAccess();
    }
  };

  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, []);

  const getStatusMessage = () => {
    switch (micStatus) {
      case 'idle':
        return 'Clicca per testare il microfono';
      case 'requesting':
        return 'Richiesta permessi in corso...';
      case 'granted':
        return 'Microfono connesso. Prova a parlare!';
      case 'active':
        return '✓ Microfono funzionante!';
      case 'denied':
        return 'Permesso negato. Abilita il microfono nelle impostazioni del browser.';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    switch (micStatus) {
      case 'active':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'denied':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'granted':
        return <Mic className="w-5 h-5 text-blue-500" />;
      default:
        return <MicOff className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <Card className={`p-6 md:p-8 space-y-6 border-2 ${
      micStatus === 'active' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
      micStatus === 'denied' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' :
      micStatus === 'idle' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' :
      'border-blue-400 bg-blue-50 dark:bg-blue-950/20'
    }`}>
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center mb-4">
          <motion.div
            className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center ${
              micStatus === 'active' ? 'bg-green-500' :
              micStatus === 'denied' ? 'bg-red-500' :
              micStatus === 'granted' ? 'bg-blue-500' :
              'bg-gray-400'
            }`}
            animate={{
              scale: micStatus === 'active' ? [1, 1.1, 1] : 1,
            }}
            transition={{
              duration: 1,
              repeat: micStatus === 'active' ? Infinity : 0,
            }}
          >
            {getStatusIcon()}
          </motion.div>
        </div>
        
        <h3 className="text-xl md:text-2xl font-bold">
          {micStatus === 'idle' ? '🎤 Test Microfono Obbligatorio' :
           micStatus === 'requesting' ? '⏳ Richiesta permessi...' :
           micStatus === 'granted' ? '🔊 Prova a parlare' :
           micStatus === 'active' ? '✅ Microfono Funzionante!' :
           '❌ Permesso Negato'}
        </h3>
        
        <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">
          {getStatusMessage()}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Button
          onClick={toggleTest}
          variant={isTesting ? 'destructive' : 'default'}
          size="lg"
          className="w-full md:w-auto px-8 h-12 text-base font-semibold"
        >
          {isTesting ? (
            <>
              <MicOff className="w-5 h-5 mr-2" />
              Ferma Test
            </>
          ) : (
            <>
              <Mic className="w-5 h-5 mr-2" />
              Inizia Test Microfono
            </>
          )}
        </Button>

        {micStatus === 'granted' || micStatus === 'active' ? (
          <div className="w-full">
            <p className="text-xs text-center mb-2 text-muted-foreground">Livello Audio</p>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${audioLevel * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {micStatus === 'active' && (
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-center">
            <div className="relative inline-block mb-3">
              <motion.div
                className="absolute inset-0 bg-green-500 rounded-full"
                animate={{
                  scale: [1, 1.8, 1],
                  opacity: [0.6, 0, 0.6],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div className="relative w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
                <Mic className="w-10 h-10 text-white" />
              </div>
            </div>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              Perfetto! Microfono configurato correttamente
            </p>
          </div>
        </motion.div>
      )}

      {micStatus === 'denied' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-100 dark:bg-red-950 border-2 border-red-300 dark:border-red-700 rounded-lg"
        >
          <p className="text-sm md:text-base text-red-700 dark:text-red-300 font-medium text-center">
            ⚠️ Per continuare, abilita il microfono nelle impostazioni del browser e ricarica la pagina.
          </p>
        </motion.div>
      )}
    </Card>
  );
}
