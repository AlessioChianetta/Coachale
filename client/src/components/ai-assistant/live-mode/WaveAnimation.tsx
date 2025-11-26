import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface WaveAnimationProps {
  isActive: boolean;
  audioLevel: number;
  color: 'blue' | 'red';
}

export function WaveAnimation({ isActive, audioLevel, color }: WaveAnimationProps) {
  const [waveHeight, setWaveHeight] = useState(0);
  const [wavePoints, setWavePoints] = useState<string>('');

  useEffect(() => {
    if (!isActive) {
      setWaveHeight(0);
      return;
    }

    const interval = setInterval(() => {
      // Calcola altezza onda in base al volume (MAX 35% dello schermo)
      const normalizedLevel = (audioLevel / 255) * 35; // Max 35% invece di 100%
      const targetHeight = Math.max(5, Math.min(35, normalizedLevel));
      setWaveHeight(targetHeight);

      // Genera punti SVG per l'onda (curva sinusoidale fluida)
      const points: string[] = [];
      const width = 100;
      const numPoints = 50;
      const time = Date.now() / 1000;

      for (let i = 0; i <= numPoints; i++) {
        const x = (i / numPoints) * width;
        // Onde sinusoidali multiple per effetto fluido
        const wave1 = Math.sin(x * 0.5 + time * 2) * 3;
        const wave2 = Math.sin(x * 0.3 - time * 1.5) * 2;
        const wave3 = Math.sin(x * 0.7 + time * 3) * 1.5;
        const y = 100 - targetHeight + wave1 + wave2 + wave3;
        
        points.push(`${x},${y}`);
      }

      // Completa il path chiudendo ai bordi inferiori
      points.push(`100,100`);
      points.push(`0,100`);
      
      setWavePoints(points.join(' '));
    }, 50);

    return () => clearInterval(interval);
  }, [isActive, audioLevel]);

  if (!isActive) return null;

  const gradientId = `wave-gradient-${color}`;
  const gradientColors = color === 'blue' 
    ? { start: 'rgba(59, 130, 246, 0.15)', end: 'rgba(37, 99, 235, 0.35)' }
    : { start: 'rgba(239, 68, 68, 0.15)', end: 'rgba(220, 38, 38, 0.35)' };

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={gradientColors.start} />
            <stop offset="100%" stopColor={gradientColors.end} />
          </linearGradient>
        </defs>
        <motion.polygon
          points={wavePoints}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      </svg>
    </div>
  );
}
