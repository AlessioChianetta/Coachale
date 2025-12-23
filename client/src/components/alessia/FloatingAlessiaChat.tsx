import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Maximize2, Minimize2, Phone, Loader2, GripHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAlessiaSession } from '@/contexts/AlessiaSessionContext';

const LiveModeScreen = lazy(() => 
  import('@/components/ai-assistant/live-mode/LiveModeScreen').then(module => ({ default: module.LiveModeScreen }))
);

type WidgetSize = 'small' | 'medium' | 'large';

const SIZES: Record<WidgetSize, { width: number; height: number; headerHeight: number }> = {
  small: { width: 300, height: 360, headerHeight: 44 },
  medium: { width: 360, height: 440, headerHeight: 48 },
  large: { width: 420, height: 520, headerHeight: 52 },
};

export function FloatingAlessiaChat() {
  const { session, endSession, minimizeSession, maximizeSession, updatePosition } = useAlessiaSession();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState<WidgetSize>('small');
  const containerRef = useRef<HTMLDivElement>(null);

  const currentSize = SIZES[size];

  const cycleSize = useCallback(() => {
    setSize(prev => {
      if (prev === 'small') return 'medium';
      if (prev === 'medium') return 'large';
      return 'small';
    });
  }, []);

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
      const newX = Math.max(0, Math.min(window.innerWidth - currentSize.width, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - currentSize.height, e.clientY - dragOffset.y));
      updatePosition(newX, newY);
    }
  }, [isDragging, dragOffset, updatePosition, currentSize]);

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
      const newX = Math.max(0, Math.min(window.innerWidth - currentSize.width, touch.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - currentSize.height, touch.clientY - dragOffset.y));
      updatePosition(newX, newY);
    }
  }, [isDragging, dragOffset, updatePosition, currentSize]);

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
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 shadow-2xl shadow-purple-500/50 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ring-2 ring-white/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 blur-xl opacity-40 group-hover:opacity-60 transition-opacity -z-10" />
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ 
          scale: 1, 
          opacity: 1, 
          y: 0,
          width: currentSize.width,
          height: currentSize.height,
        }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          position: 'fixed',
          left: session.position.x,
          top: session.position.y,
          zIndex: 9999,
          width: currentSize.width,
          height: currentSize.height,
        }}
        className={cn(
          "rounded-2xl overflow-hidden",
          "bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900",
          "shadow-[0_20px_60px_-15px_rgba(139,92,246,0.4)]",
          "ring-1 ring-purple-500/30",
          isDragging && "cursor-grabbing select-none"
        )}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Glow effect behind card */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-fuchsia-500/20 blur-sm -z-10" />
        
        {/* Header */}
        <div 
          className="drag-handle flex items-center justify-between px-3 bg-gradient-to-r from-violet-600/90 via-purple-600/90 to-fuchsia-600/90 backdrop-blur-xl cursor-grab active:cursor-grabbing border-b border-white/10"
          style={{ height: currentSize.headerHeight }}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-3.5 h-3.5 text-white/50" />
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-75" />
              </div>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-white font-semibold text-xs tracking-wide">Alessia</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleSize}
              className="h-6 w-6 hover:bg-white/20 text-white/70 hover:text-white"
              title={size === 'large' ? 'Rimpicciolisci' : 'Ingrandisci'}
            >
              {size === 'large' ? (
                <Minimize2 className="w-3 h-3" />
              ) : (
                <Maximize2 className="w-3 h-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={minimizeSession}
              className="h-6 w-6 hover:bg-white/20 text-white/70 hover:text-white"
              title="Minimizza"
            >
              <Minus className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={endSession}
              className="h-6 w-6 hover:bg-red-500/50 text-white/70 hover:text-white"
              title="Chiudi"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div 
          className="overflow-hidden relative bg-gradient-to-b from-slate-900 to-zinc-950"
          style={{ height: `calc(100% - ${currentSize.headerHeight}px)` }}
        >
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-[size:20px_20px]" />
          
          <Suspense fallback={
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="relative">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                  <div className="absolute inset-0 w-8 h-8 mx-auto rounded-full bg-purple-400/20 blur-xl" />
                </div>
                <p className="text-white/50 text-xs mt-3">Connessione...</p>
              </div>
            </div>
          }>
            <LiveModeScreen
              mode="assistenza"
              useFullPrompt={false}
              voiceName={session.voiceName}
              layoutMode="phone_call"
              isEmbedded={true}
              widgetSize={size}
              onClose={endSession}
            />
          </Suspense>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
