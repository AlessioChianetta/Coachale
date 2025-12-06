import { motion } from 'framer-motion';
import { User, MicOff, VideoOff } from 'lucide-react';

export type SentimentType = 'positive' | 'neutral' | 'negative';

interface ParticipantVideoProps {
  participantName: string;
  sentiment: SentimentType;
  isHost?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

const sentimentColors: Record<SentimentType, string> = {
  positive: 'border-green-500 shadow-green-500/30',
  neutral: 'border-yellow-500 shadow-yellow-500/30',
  negative: 'border-red-500 shadow-red-500/30',
};

const sentimentBgGlow: Record<SentimentType, string> = {
  positive: 'from-green-500/10 to-transparent',
  neutral: 'from-yellow-500/10 to-transparent',
  negative: 'from-red-500/10 to-transparent',
};

export default function ParticipantVideo({
  participantName,
  sentiment,
  isHost = false,
  isMuted = false,
  isVideoOff = false,
}: ParticipantVideoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-4 ${sentimentColors[sentiment]} shadow-lg overflow-hidden`}
    >
      <div className={`absolute inset-0 bg-gradient-to-t ${sentimentBgGlow[sentiment]}`} />
      
      <div className="absolute inset-0 flex items-center justify-center">
        {isVideoOff ? (
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
            <User className="w-10 h-10 text-gray-400" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
            {participantName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium text-sm truncate max-w-[150px]">
              {participantName}
            </span>
            {isHost && (
              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                Host
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isMuted && (
              <div className="p-1 bg-red-500/80 rounded-full">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
            {isVideoOff && (
              <div className="p-1 bg-red-500/80 rounded-full">
                <VideoOff className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      <motion.div
        className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
          sentiment === 'positive' ? 'bg-green-500' :
          sentiment === 'neutral' ? 'bg-yellow-500' : 'bg-red-500'
        }`}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
  );
}
