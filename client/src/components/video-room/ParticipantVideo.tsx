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
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const activeStream = remoteStream || (isLocalUser ? localStream : null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) {
      console.log(`⚠️ [ParticipantVideo] videoRef is null for ${participantName}`);
      return;
    }

    if (activeStream) {
      console.log(`🎬 [ParticipantVideo] Assigning stream to video element for ${participantName}`);
      console.log(`   - Stream ID: ${activeStream.id}`);
      console.log(`   - Video tracks: ${activeStream.getVideoTracks().length}`);
      console.log(`   - Audio tracks: ${activeStream.getAudioTracks().length}`);
      console.log(`   - Is local user: ${isLocalUser}`);
      
      videoEl.srcObject = activeStream;
      
      // CRITICAL: Remote audio must NOT be muted so it plays in speakers
      // Only local user should be muted to prevent echo
      if (isLocalUser) {
        videoEl.muted = true;
        console.log(`🔇 [ParticipantVideo] Muted LOCAL user ${participantName} to prevent echo`);
      } else {
        videoEl.muted = false;
        console.log(`🔊 [ParticipantVideo] UNMUTED REMOTE user ${participantName} for audio playback`);
      }

      const playVideo = async () => {
        try {
          await videoEl.play();
          console.log(`▶️ [ParticipantVideo] Play successful for ${participantName}`);
          setIsVideoPlaying(true);
        } catch (e: any) {
          console.warn(`⚠️ [ParticipantVideo] Autoplay blocked for ${participantName}:`, e.message);
          
          // If autoplay fails and this is a REMOTE user, try unmuting and playing
          if (!isLocalUser && !videoEl.muted) {
            console.log(`🔄 [ParticipantVideo] Retrying play for REMOTE user ${participantName}...`);
            try {
              await videoEl.play();
              console.log(`▶️ [ParticipantVideo] Retry successful for ${participantName}`);
              setIsVideoPlaying(true);
            } catch (e2) {
              console.error(`❌ [ParticipantVideo] Retry failed for ${participantName}:`, e2);
              setIsVideoPlaying(false);
            }
          } else {
            setIsVideoPlaying(false);
          }
        }
      };

      playVideo();

      // Log audio tracks state
      activeStream.getAudioTracks().forEach((track, idx) => {
        console.log(`🎤 [ParticipantVideo] Audio track ${idx} for ${participantName}:`);
        console.log(`   - ID: ${track.id}`);
        console.log(`   - Enabled: ${track.enabled}`);
        console.log(`   - Muted: ${track.muted}`);
        console.log(`   - ReadyState: ${track.readyState}`);
      });

      activeStream.getVideoTracks().forEach(track => {
        track.onended = () => {
          console.log(`🔴 [ParticipantVideo] Video track ended for ${participantName}`);
          setIsVideoPlaying(false);
        };
        track.onmute = () => {
          console.log(`🔇 [ParticipantVideo] Video track muted for ${participantName}`);
        };
        track.onunmute = () => {
          console.log(`🔊 [ParticipantVideo] Video track unmuted for ${participantName}`);
        };
      });
    } else {
      console.log(`📭 [ParticipantVideo] No stream available for ${participantName}`);
      videoEl.srcObject = null;
      setIsVideoPlaying(false);
    }

    return () => {
      if (activeStream) {
        activeStream.getVideoTracks().forEach(track => {
          track.onended = null;
          track.onmute = null;
          track.onunmute = null;
        });
      }
    };
  }, [activeStream, participantName, isLocalUser]);

  const hasActiveVideo = activeStream && 
    activeStream.getVideoTracks().length > 0 && 
    activeStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
  
  const showVideoElement = hasActiveVideo && isVideoPlaying && !isVideoOff;
  const initials = participantName.charAt(0).toUpperCase();

  const speakingRingClass = isSpeaking 
    ? 'ring-4 ring-green-500 ring-opacity-75' 
    : '';

  if (variant === 'pip') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        className={`absolute bottom-24 right-4 z-30 w-32 h-24 sm:w-44 sm:h-32 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 ${speakingRingClass}`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocalUser}
          className={`w-full h-full object-cover absolute inset-0 ${showVideoElement ? 'opacity-100' : 'opacity-0'}`}
          style={{ transform: isLocalUser ? 'scaleX(-1)' : 'none' }}
          onLoadedMetadata={() => {
            console.log(`📺 [ParticipantVideo-PIP] Video metadata loaded for ${participantName}, muted=${isLocalUser}`);
          }}
        />
        
        {!showVideoElement && (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-500 flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg">
              {initials}
            </div>
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
          <span className="text-white text-xs truncate block">{participantName}</span>
        </div>

        {isMuted && (
          <div className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full">
            <MicOff className="w-3 h-3 text-white" />
          </div>
        )}

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`relative w-full h-full overflow-hidden ${isSpeaking ? 'ring-4 ring-green-500/60 ring-inset' : ''}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocalUser}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${showVideoElement ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: isLocalUser ? 'scaleX(-1)' : 'none' }}
        onLoadedMetadata={() => {
          console.log(`📺 [ParticipantVideo] Video metadata loaded for ${participantName}, muted=${isLocalUser}`);
        }}
      />
      
      {!showVideoElement && (
        <motion.div
          animate={isSpeaking ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 1, repeat: isSpeaking ? Infinity : 0 }}
          className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-950 flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-4">
            <div className={`w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-2xl ${isSpeaking ? 'ring-4 ring-green-500/60' : ''}`}>
              <span className="text-white font-semibold text-5xl sm:text-6xl md:text-7xl">
                {initials}
              </span>
            </div>
            <span className="text-white/80 text-lg sm:text-xl font-medium">
              {participantName}
            </span>
          </div>
        </motion.div>
      )}

      {isSpeaking && showVideoElement && (
        <motion.div
          className="absolute inset-0 pointer-events-none border-4 border-green-500/50"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      <div className="absolute bottom-6 left-6 z-20">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg">
          <span className="text-white text-base sm:text-lg font-medium">
            {participantName}
          </span>
          {isHost && (
            <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
              Host
            </span>
          )}
          {isLocalUser && (
            <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">
              Tu
            </span>
          )}
        </div>

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

      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
        {isMuted && (
          <div className="p-2.5 bg-red-500/90 rounded-full shadow-lg">
            <MicOff className="w-5 h-5 text-white" />
          </div>
        )}
        {isVideoOff && (
          <div className="p-2.5 bg-red-500/90 rounded-full shadow-lg">
            <VideoOff className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
