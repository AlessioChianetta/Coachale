import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { User, MicOff, VideoOff } from 'lucide-react';

export type SentimentType = 'positive' | 'neutral' | 'negative';

interface ParticipantVideoProps {
  participantName: string;
  sentiment: SentimentType;
  isHost?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isLocalUser?: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  variant?: 'main' | 'pip';
  isSpeaking?: boolean;
  audioLevel?: number;
}

export default function ParticipantVideo({
  participantName,
  sentiment,
  isHost = false,
  isMuted = false,
  isVideoOff = false,
  isLocalUser = false,
  localStream = null,
  remoteStream = null,
  variant = 'main',
  isSpeaking = false,
  audioLevel = 0,
}: ParticipantVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStream, setHasStream] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const setAndPlay = (stream: MediaStream, sourceName: string) => {
      if (videoEl.srcObject === stream) return;

      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      console.log(`🎬 [ParticipantVideo] Assegnando stream a ${participantName} (${sourceName})`);
      console.log(`   Audio: ${audioTracks.length}, Video: ${videoTracks.length}`);
      
      videoEl.srcObject = stream;
      
      videoEl.play().then(() => {
        console.log(`▶️ [ParticipantVideo] Play SUCCESS per ${participantName}`);
      }).catch(e => {
        console.warn(`⚠️ [ParticipantVideo] Autoplay blocked per ${participantName}:`, e);
      });
      setHasStream(true);
    };

    if (remoteStream) {
      setAndPlay(remoteStream, 'REMOTE');
    } else if (isLocalUser && localStream) {
      setAndPlay(localStream, 'LOCAL');
    } else {
      if (!isLocalUser) {
        console.log(`⏳ [ParticipantVideo] In attesa stream per ${participantName}...`);
        setHasStream(false);
      }
    }
  }, [remoteStream, localStream, isLocalUser, participantName]);

  const showVideo = (localStream || remoteStream) && hasStream && !isVideoOff;
  const initials = participantName.charAt(0).toUpperCase();

  // Speaking indicator ring animation
  const speakingRingClass = isSpeaking 
    ? 'ring-4 ring-green-500 ring-opacity-75' 
    : '';

  // PIP variant (small picture-in-picture in bottom right)
  if (variant === 'pip') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        className={`absolute bottom-24 right-4 z-30 w-32 h-24 sm:w-44 sm:h-32 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 ${speakingRingClass}`}
      >
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocalUser}
            className="w-full h-full object-cover"
            style={{ transform: isLocalUser ? 'scaleX(-1)' : 'none' }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-500 flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg">
              {initials}
            </div>
          </div>
        )}
        
        {/* Name label */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
          <span className="text-white text-xs truncate block">{participantName}</span>
        </div>

        {/* Mute indicator */}
        {isMuted && (
          <div className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full">
            <MicOff className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Speaking audio level bar */}
        {isSpeaking && audioLevel > 0 && (
          <div className="absolute bottom-8 left-2 right-2 h-1 bg-gray-800/50 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-green-500"
              animate={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}
      </motion.div>
    );
  }

  // Main variant (full screen participant)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative w-full h-full flex items-center justify-center"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-950" />
      
      {/* Video or Avatar */}
      <div className="relative z-10 flex items-center justify-center">
        {showVideo ? (
          <div className={`relative rounded-full overflow-hidden shadow-2xl ${speakingRingClass}`}
               style={{ width: 'min(50vw, 300px)', height: 'min(50vw, 300px)' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isLocalUser}
              className="w-full h-full object-cover"
              style={{ transform: isLocalUser ? 'scaleX(-1)' : 'none' }}
            />
          </div>
        ) : (
          <motion.div
            animate={isSpeaking ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.5, repeat: isSpeaking ? Infinity : 0 }}
            className={`rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-2xl ${speakingRingClass}`}
            style={{ width: 'min(40vw, 200px)', height: 'min(40vw, 200px)' }}
          >
            <span className="text-white font-medium" style={{ fontSize: 'min(15vw, 80px)' }}>
              {initials}
            </span>
          </motion.div>
        )}
      </div>

      {/* Speaking indicator ring animation */}
      {isSpeaking && (
        <motion.div
          className="absolute z-5 rounded-full border-4 border-green-500/50"
          style={{ width: 'min(55vw, 330px)', height: 'min(55vw, 330px)' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Name and status - bottom left */}
      <div className="absolute bottom-6 left-6 z-20">
        <div className="flex items-center gap-3">
          <span className="text-white text-lg sm:text-xl font-medium">
            {participantName}
          </span>
          {isHost && (
            <span className="px-2 py-0.5 bg-blue-500/80 text-white text-xs rounded-full">
              Host
            </span>
          )}
          {isLocalUser && (
            <span className="px-2 py-0.5 bg-purple-500/80 text-white text-xs rounded-full">
              Tu
            </span>
          )}
        </div>

        {/* Audio level indicator */}
        {isSpeaking && audioLevel > 0 && (
          <div className="mt-2 w-32 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-green-500"
              animate={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}
      </div>

      {/* Mute/Video off indicators - bottom right */}
      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
        {isMuted && (
          <div className="p-2 bg-red-500/80 rounded-full">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
        {isVideoOff && (
          <div className="p-2 bg-red-500/80 rounded-full">
            <VideoOff className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
