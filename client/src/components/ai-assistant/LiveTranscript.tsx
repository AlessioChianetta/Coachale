import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * LiveTranscript - Trascrizione real-time con typing effect
 * 
 * Mostra il testo che appare progressivamente, lettera per lettera
 * come i sottotitoli in tempo reale.
 */

interface LiveTranscriptProps {
  text: string;
  role?: 'user' | 'assistant';
  className?: string;
  animated?: boolean; // Se true, fa typing effect
}

export function LiveTranscript({ 
  text, 
  role = 'user',
  className = '',
  animated = true
}: LiveTranscriptProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!animated) {
      setDisplayedText(text);
      return;
    }

    // Reset quando il testo cambia completamente
    if (text.length < displayedText.length) {
      setDisplayedText('');
    }

    // Typing effect - aggiungi caratteri progressivamente
    if (text.length > displayedText.length) {
      setIsTyping(true);
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1));
      }, 55); // Velocità typing: 60ms per carattere (sincronizzata con voce)

      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [text, displayedText, animated]);

  if (!text && !displayedText) {
    return null;
  }

  const getRoleStyles = () => {
    if (role === 'user') {
      return {
        bg: 'bg-gradient-to-br from-red-500/20 via-red-400/15 to-transparent',
        border: 'border border-red-400/30',
        text: 'text-white',
        shadow: 'shadow-lg shadow-red-500/20',
        glow: 'before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-r before:from-red-500/10 before:to-transparent before:blur-xl before:-z-10'
      };
    }
    return {
      bg: 'bg-gradient-to-br from-blue-500/20 via-cyan-400/15 to-transparent',
      border: 'border border-cyan-400/30',
      text: 'text-cyan-50',
      shadow: 'shadow-lg shadow-blue-500/20',
      glow: 'before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-r before:from-blue-500/10 before:to-transparent before:blur-xl before:-z-10'
    };
  };

  const getRoleLabel = () => {
    if (role === 'user') {
      return '🎤 Tu';
    }
    return '🔊 Achernar';
  };

  const styles = getRoleStyles();

  return (
    <AnimatePresence mode="wait">
      {(displayedText || text) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`relative ${className}`}
        >
          <div className={`relative rounded-2xl px-4 sm:px-6 py-4 sm:py-5 backdrop-blur-md ${styles.bg} ${styles.border} ${styles.shadow} max-w-2xl w-full mx-auto overflow-hidden`}>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className={`text-sm font-semibold ${styles.text} tracking-wide`}>
                  {getRoleLabel()}
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent" />
              </div>
              <div className={`text-base sm:text-lg leading-relaxed ${styles.text} break-words whitespace-pre-wrap`}>
                {animated ? displayedText : text}
                {isTyping && (
                  <span
                    className="inline-block w-0.5 h-5 bg-current ml-1 rounded-full animate-pulse"
                  />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
