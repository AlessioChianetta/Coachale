import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Maximize2, Phone, Mic, MicOff, Loader2, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAlessiaSession } from '@/contexts/AlessiaSessionContext';

const LiveModeScreen = lazy(() => 
  import('@/components/ai-assistant/live-mode/LiveModeScreen').then(module => ({ default: module.LiveModeScreen }))
);

export function FloatingAlessiaChat() {
  const { session, endSession, minimizeSession, maximizeSession, updatePosition } = useAlessiaSession();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - session.position.x,
        y: e.clientY - session.position.y,
      });
    }
  }, [session.position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 500, e.clientY - dragOffset.y));
      updatePosition(newX, newY);
    }
  }, [isDragging, dragOffset, updatePosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragOffset({
        x: touch.clientX - session.position.x,
        y: touch.clientY - session.position.y,
      });
    }
  }, [session.position]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0];
      const newX = Math.max(0, Math.min(window.innerWidth - 400, touch.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 500, touch.clientY - dragOffset.y));
      updatePosition(newX, newY);
    }
  }, [isDragging, dragOffset, updatePosition]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
      return () => {
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleTouchMove, handleMouseUp]);

  if (!session.isActive) return null;

  if (session.isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="fixed z-[9999] bottom-6 right-6"
      >
        <button
          onClick={maximizeSession}
          className="relative group"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-600 to-pink-600 shadow-2xl shadow-purple-500/50 flex items-center justify-center transition-transform hover:scale-110 active:scale-95">
            <Phone className="w-7 h-7 text-white" />
          </div>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-600 to-pink-600 blur-xl opacity-50 group-hover:opacity-75 transition-opacity -z-10" />
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          position: 'fixed',
          left: session.position.x,
          top: session.position.y,
          zIndex: 9999,
        }}
        className={cn(
          "w-[400px] h-[500px] rounded-2xl overflow-hidden shadow-2xl",
          "bg-gradient-to-br from-gray-900 via-gray-800 to-black",
          "border border-white/10",
          isDragging && "cursor-grabbing select-none"
        )}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="drag-handle flex items-center justify-between px-4 py-3 bg-gradient-to-r from-fuchsia-600/80 via-purple-600/80 to-pink-600/80 backdrop-blur-sm cursor-grab active:cursor-grabbing border-b border-white/10">
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-white/70" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">Alessia</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={minimizeSession}
              className="h-7 w-7 hover:bg-white/20 text-white/80 hover:text-white"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={endSession}
              className="h-7 w-7 hover:bg-red-500/50 text-white/80 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="h-[calc(100%-52px)] overflow-hidden relative">
          <Suspense fallback={
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-3" />
                <p className="text-white/70 text-sm">Connessione ad Alessia...</p>
              </div>
            </div>
          }>
            <LiveModeScreen
              mode="assistenza"
              useFullPrompt={false}
              voiceName={session.voiceName}
              layoutMode="phone_call"
              isEmbedded={true}
              onClose={endSession}
            />
          </Suspense>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
