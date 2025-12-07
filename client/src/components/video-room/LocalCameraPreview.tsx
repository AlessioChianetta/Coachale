import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { VideoOff, MicOff, User } from 'lucide-react';

interface LocalCameraPreviewProps {
  isVideoOff: boolean;
  isMuted: boolean;
  participantName: string;
}

export default function LocalCameraPreview({
  isVideoOff,
  isMuted,
  participantName,
}: LocalCameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasStream, setHasStream] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setHasStream(false);
      }
    };

    const startCamera = async () => {
      if (isVideoOff) {
        stopStream();
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera non supportata');
        return;
      }

      try {
        setCameraError(null);
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 240 },
          audio: false,
        });

        if (cancelled || isVideoOff) {
          newStream.getTracks().forEach(track => track.stop());
          return;
        }

        stopStream();
        streamRef.current = newStream;
        setHasStream(true);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Camera access error:', err);
          setCameraError('Camera non disponibile');
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [isVideoOff]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [hasStream]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      className="absolute bottom-28 right-4 z-20 w-40 md:w-48"
    >
      <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-2 border-blue-500 shadow-lg shadow-blue-500/20 overflow-hidden">
        {isVideoOff || cameraError || !hasStream ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
              {cameraError ? (
                <VideoOff className="w-6 h-6 text-gray-400" />
              ) : (
                <User className="w-6 h-6 text-gray-400" />
              )}
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium text-xs truncate max-w-[80px]">
              Tu ({participantName.split(' ')[0]})
            </span>
            <div className="flex items-center gap-1">
              {isMuted && (
                <div className="p-0.5 bg-red-500/80 rounded-full">
                  <MicOff className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              {isVideoOff && (
                <div className="p-0.5 bg-red-500/80 rounded-full">
                  <VideoOff className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-blue-500/80 rounded text-[10px] text-white font-medium">
          TU
        </div>
      </div>
    </motion.div>
  );
}
