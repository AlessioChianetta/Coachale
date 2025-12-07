import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Bot, BotOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  showHUD: boolean;
  isHost: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHUD: () => void;
  onEndCall: () => void;
}

export default function VideoControls({
  isMuted,
  isVideoOff,
  isScreenSharing,
  showHUD,
  isHost,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHUD,
  onEndCall,
}: VideoControlsProps) {
  return (
    <motion.footer
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex-shrink-0 py-3 sm:py-4 px-4 bg-gray-900/95 backdrop-blur-md border-t border-gray-800/50"
    >
      <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="lg"
            onClick={onToggleMute}
            className={`rounded-full w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 transition-all duration-200 ${
              isMuted
                ? 'bg-red-500/90 hover:bg-red-600 border-red-500/50 text-white shadow-lg shadow-red-500/20'
                : 'bg-gray-800/90 hover:bg-gray-700 border-gray-600/50 text-white hover:border-gray-500'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="lg"
            onClick={onToggleVideo}
            className={`rounded-full w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 transition-all duration-200 ${
              isVideoOff
                ? 'bg-red-500/90 hover:bg-red-600 border-red-500/50 text-white shadow-lg shadow-red-500/20'
                : 'bg-gray-800/90 hover:bg-gray-700 border-gray-600/50 text-white hover:border-gray-500'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="hidden sm:block">
          <Button
            variant="outline"
            size="lg"
            onClick={onToggleScreenShare}
            className={`rounded-full w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 transition-all duration-200 ${
              isScreenSharing
                ? 'bg-blue-500/90 hover:bg-blue-600 border-blue-500/50 text-white shadow-lg shadow-blue-500/20'
                : 'bg-gray-800/90 hover:bg-gray-700 border-gray-600/50 text-white hover:border-gray-500'
            }`}
          >
            <MonitorUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
        </motion.div>

        {isHost && (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="lg"
              onClick={onToggleHUD}
              className={`rounded-full w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 transition-all duration-200 ${
                showHUD
                  ? 'bg-purple-500/90 hover:bg-purple-600 border-purple-500/50 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-gray-800/90 hover:bg-gray-700 border-gray-600/50 text-white hover:border-gray-500'
              }`}
            >
              {showHUD ? <Bot className="w-5 h-5 sm:w-6 sm:h-6" /> : <BotOff className="w-5 h-5 sm:w-6 sm:h-6" />}
            </Button>
          </motion.div>
        )}

        <div className="w-px h-8 bg-gray-700/50 mx-1 hidden sm:block" />

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="destructive"
            size="lg"
            onClick={onEndCall}
            className="rounded-full w-12 h-11 sm:w-14 sm:h-12 md:w-16 md:h-14 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all duration-200"
          >
            <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
        </motion.div>
      </div>
    </motion.footer>
  );
}
