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
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent"
    >
      <div className="flex items-center justify-center gap-3">
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="lg"
            onClick={onToggleMute}
            className={`rounded-full w-14 h-14 ${
              isMuted
                ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white'
                : 'bg-gray-800/80 hover:bg-gray-700 border-gray-600 text-white'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="lg"
            onClick={onToggleVideo}
            className={`rounded-full w-14 h-14 ${
              isVideoOff
                ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white'
                : 'bg-gray-800/80 hover:bg-gray-700 border-gray-600 text-white'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="lg"
            onClick={onToggleScreenShare}
            className={`rounded-full w-14 h-14 ${
              isScreenSharing
                ? 'bg-blue-500 hover:bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800/80 hover:bg-gray-700 border-gray-600 text-white'
            }`}
          >
            <MonitorUp className="w-6 h-6" />
          </Button>
        </motion.div>

        {isHost && (
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="lg"
              onClick={onToggleHUD}
              className={`rounded-full w-14 h-14 ${
                showHUD
                  ? 'bg-purple-500 hover:bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-800/80 hover:bg-gray-700 border-gray-600 text-white'
              }`}
            >
              {showHUD ? <Bot className="w-6 h-6" /> : <BotOff className="w-6 h-6" />}
            </Button>
          </motion.div>
        )}

        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="destructive"
            size="lg"
            onClick={onEndCall}
            className="rounded-full w-16 h-14 bg-red-600 hover:bg-red-700"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
