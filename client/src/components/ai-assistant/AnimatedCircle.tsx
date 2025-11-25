import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

/**
 * AnimatedCircle - Cerchio animato per Live Mode
 * 
 * Stati:
 * - idle: Respirazione lenta (breathing animation)
 * - listening: Waveform rosso sincronizzato con microfono
 * - thinking: Loading dots rotazione
 * - speaking: Waveform blu/cyan sincronizzato con audio AI
 */

type LiveState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AnimatedCircleProps {
  state: LiveState;
  audioLevel?: number; // 0-100, volume dell'audio
  className?: string;
}

export function AnimatedCircle({ 
  state, 
  audioLevel = 0,
  className = ''
}: AnimatedCircleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Disegna waveform su canvas quando state è listening o speaking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Setup canvas size
    const size = 300;
    canvas.width = size;
    canvas.height = size;

    const centerX = size / 2;
    const centerY = size / 2;
    const baseRadius = size / 3;

    const drawWaveform = () => {
      ctx.clearRect(0, 0, size, size);

      // Colore basato sullo stato
      const isListening = state === 'listening';
      const color = isListening 
        ? `rgba(255, 68, 68, ${0.6 + audioLevel / 200})` // Rosso
        : `rgba(0, 217, 255, ${0.6 + audioLevel / 200})`; // Cyan

      // Disegna cerchio con waveform
      const points = 60;
      const angleStep = (Math.PI * 2) / points;

      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = i * angleStep;
        
        // Crea effetto waveform
        const waveOffset = Math.sin(angle * 3 + Date.now() / 200) * (audioLevel / 4);
        const radius = baseRadius + waveOffset;

        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Gradient fill
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, baseRadius
      );
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, `${color.replace(/[\d.]+\)/, '0)')}`);
      
      ctx.fillStyle = gradient;
      ctx.fill();

      // Glow effect
      ctx.shadowBlur = 20 + audioLevel / 3;
      ctx.shadowColor = isListening ? '#ff4444' : '#00d9ff';
      ctx.stroke();
    };

    let animationId: number;
    if (state === 'listening' || state === 'speaking') {
      const animate = () => {
        drawWaveform();
        animationId = requestAnimationFrame(animate);
      };
      animate();
    } else {
      ctx.clearRect(0, 0, size, size);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [state, audioLevel]);

  // Configurazione animazione basata sullo stato
  const getAnimationConfig = () => {
    switch (state) {
      case 'idle':
        return {
          scale: [1, 1.05, 1],
          opacity: [0.6, 0.8, 0.6],
          transition: {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }
        };
      
      case 'listening':
      case 'speaking':
        return {
          scale: 1 + (audioLevel / 300),
          transition: {
            duration: 0.1
          }
        };
      
      case 'thinking':
        return {
          rotate: 360,
          transition: {
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }
        };
      
      default:
        return {};
    }
  };

  // Render basato sullo stato
  if (state === 'listening' || state === 'speaking') {
    // Waveform canvas per audio
    return (
      <div className={`relative ${className}`}>
        <motion.div
          animate={getAnimationConfig()}
          className="relative"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{
              filter: `drop-shadow(0 0 ${20 + audioLevel / 2}px ${
                state === 'listening' ? '#ff4444' : '#00d9ff'
              })`
            }}
          />
        </motion.div>
      </div>
    );
  }

  if (state === 'thinking') {
    // Loading dots
    return (
      <div className={`relative ${className}`}>
        <motion.div
          animate={getAnimationConfig()}
          className="w-64 h-64 flex items-center justify-center"
        >
          <div className="flex space-x-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-4 h-4 bg-gray-400 rounded-full"
                animate={{
                  y: [-10, 10, -10],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Idle - breathing circle
  return (
    <div className={`relative ${className}`}>
      <motion.div
        animate={getAnimationConfig()}
        className="w-64 h-64 rounded-full bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm flex items-center justify-center"
        style={{
          boxShadow: '0 0 40px rgba(255, 255, 255, 0.3)'
        }}
      >
        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-white/30 to-white/10">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-white/50" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
