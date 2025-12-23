import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MicLevelIndicatorProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

type MicStatus = 'checking' | 'ok' | 'low' | 'error' | 'denied';

export function MicLevelIndicator({ className, showLabel = true, compact = false }: MicLevelIndicatorProps) {
  const [micLevel, setMicLevel] = useState(0);
  const [status, setStatus] = useState<MicStatus>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initMicrophone = async () => {
      try {
        setStatus('checking');
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true 
          } 
        });
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        
        source.connect(analyser);
        analyserRef.current = analyser;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateLevel = () => {
          if (!mounted || !analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const normalizedLevel = Math.min(100, Math.max(0, (average / 128) * 100));
          
          setMicLevel(normalizedLevel);
          
          if (normalizedLevel > 5) {
            setStatus('ok');
          } else {
            setStatus('low');
          }
          
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        
        updateLevel();
        
      } catch (error: any) {
        if (!mounted) return;
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setStatus('denied');
          setErrorMessage('Microfono non autorizzato');
        } else if (error.name === 'NotFoundError') {
          setStatus('error');
          setErrorMessage('Nessun microfono trovato');
        } else {
          setStatus('error');
          setErrorMessage('Errore microfono');
        }
      }
    };

    initMicrophone();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [cleanup]);

  const getStatusColor = () => {
    switch (status) {
      case 'ok': return 'text-green-500';
      case 'low': return 'text-yellow-500';
      case 'error':
      case 'denied': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'checking': return 'Controllo...';
      case 'ok': return 'Microfono OK';
      case 'low': return 'Parla per testare';
      case 'error': return errorMessage;
      case 'denied': return errorMessage;
      default: return '';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'error':
      case 'denied':
        return <MicOff className={cn("h-4 w-4", getStatusColor())} />;
      case 'low':
        return <AlertTriangle className={cn("h-4 w-4", getStatusColor())} />;
      default:
        return <Mic className={cn("h-4 w-4", getStatusColor())} />;
    }
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {getStatusIcon()}
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-75",
              status === 'ok' ? 'bg-green-500' : 
              status === 'low' ? 'bg-yellow-500' : 
              'bg-gray-400'
            )}
            style={{ width: `${micLevel}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700", className)}>
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-gray-700 shadow-sm">
        {getStatusIcon()}
      </div>
      
      <div className="flex-1">
        {showLabel && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Microfono
            </span>
            <span className={cn("text-xs font-medium", getStatusColor())}>
              {getStatusLabel()}
            </span>
          </div>
        )}
        
        <div className="flex gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 h-3 rounded-sm transition-all duration-75",
                i < (micLevel / 5) 
                  ? status === 'ok' 
                    ? 'bg-green-500' 
                    : status === 'low' 
                      ? 'bg-yellow-500' 
                      : 'bg-gray-400'
                  : 'bg-gray-300 dark:bg-gray-600'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
