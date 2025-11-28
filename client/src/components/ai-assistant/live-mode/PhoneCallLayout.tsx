
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mic, MicOff, User, Clock, ChevronUp, ChevronDown, Grid3x3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiveTranscript } from '../LiveTranscript';

interface PhoneCallLayoutProps {
  conversationDuration: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
  liveState: 'idle' | 'loading' | 'listening' | 'thinking' | 'speaking';
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  currentTranscript: { role: 'user' | 'assistant'; text: string; timestamp: number } | null;
  userTranscript: { role: 'user' | 'assistant'; text: string; timestamp: number } | null;
  micLevel: number;
  audioLevel: number;
  isTestMode?: boolean;
  sessionClosing?: boolean;
}

export function PhoneCallLayout({
  conversationDuration,
  isMuted,
  onToggleMute,
  onEndCall,
  liveState,
  connectionStatus,
  currentTranscript,
  userTranscript,
  micLevel,
  audioLevel,
  isTestMode,
  sessionClosing,
}: PhoneCallLayoutProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determina il colore dell'animazione vocale
  const voiceColor = liveState === 'listening' ? '#10b981' : '#3b82f6'; // verde per user, blu per AI
  const currentLevel = liveState === 'listening' ? micLevel : audioLevel;

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-black flex flex-col">
      {/* Header - Stato Chiamata */}
      <div className="pt-8 pb-6 px-6 text-center">
        {/* Badge Test Mode */}
        {isTestMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 inline-block px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-400/50"
          >
            <span className="text-yellow-200 text-xs font-medium">🧪 MODALITÀ TEST</span>
          </motion.div>
        )}

        {/* Stato Connessione */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-2"
        >
          <div className="flex items-center justify-center gap-2">
            <motion.div
              animate={{
                scale: connectionStatus === 'connected' ? [1, 1.2, 1] : 1,
                opacity: connectionStatus === 'connected' ? [1, 0.7, 1] : 0.5,
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
            />
            <span className="text-gray-400 text-sm">
              {connectionStatus === 'connected' ? 'Connesso' :
               connectionStatus === 'connecting' ? 'Connessione...' :
               'Disconnesso'}
            </span>
          </div>
        </motion.div>

        {/* Nome Contatto / Titolo */}
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-semibold text-white mb-1"
        >
          Assistente AI
        </motion.h1>

        {/* Sottotitolo Stato */}
        <motion.p
          key={liveState}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-400 text-sm"
        >
          {sessionClosing ? '🔒 Chiusura in corso...' :
           liveState === 'loading' ? 'Inizializzazione...' :
           liveState === 'listening' ? (isMuted ? '🔇 Microfono silenziato' : '🎤 In ascolto...') :
           liveState === 'thinking' ? '💭 Sta pensando...' :
           liveState === 'speaking' ? '🔊 Sta parlando...' :
           'Pronto'}
        </motion.p>

        {/* Timer Chiamata */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-5xl font-light text-white tabular-nums"
        >
          {formatDuration(conversationDuration)}
        </motion.div>
      </div>

      {/* Avatar / Visualizzazione Vocale - Centro Schermo */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="relative">
          {/* Avatar di sfondo */}
          <motion.div
            animate={{
              scale: liveState === 'speaking' || liveState === 'listening' ? [1, 1.05, 1] : 1,
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl"
          >
            <User className="w-20 h-20 text-white" />
          </motion.div>

          {/* Onde vocali animate */}
          <AnimatePresence>
            {(liveState === 'speaking' || liveState === 'listening') && (
              <>
                {[1, 2, 3].map((ring) => (
                  <motion.div
                    key={ring}
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{
                      scale: [1, 1.5 + ring * 0.3, 1],
                      opacity: [0.6, 0, 0.6],
                    }}
                    exit={{ scale: 1, opacity: 0 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: ring * 0.3,
                      ease: 'easeOut',
                    }}
                    className="absolute inset-0 rounded-full border-2"
                    style={{
                      borderColor: voiceColor,
                      opacity: Math.min(currentLevel / 255, 0.6),
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Trascrizione Espandibile */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gray-800/50 backdrop-blur-md border-t border-gray-700 overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto p-4 space-y-2">
              {userTranscript && (
                <LiveTranscript
                  text={userTranscript.text}
                  role={userTranscript.role}
                  animated={true}
                />
              )}
              {currentTranscript && (
                <LiveTranscript
                  text={currentTranscript.text}
                  role={currentTranscript.role}
                  animated={true}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulsante Espandi Trascrizione */}
      <div className="px-6 py-2">
        <Button
          variant="ghost"
          onClick={() => setShowTranscript(!showTranscript)}
          className="w-full text-gray-400 hover:text-white hover:bg-gray-800/50"
        >
          {showTranscript ? (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              Nascondi trascrizione
            </>
          ) : (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              Mostra trascrizione
            </>
          )}
        </Button>
      </div>

      {/* Controlli Chiamata - Bottom */}
      <div className="pb-10 px-6">
        <div className="flex items-center justify-center gap-8">
          {/* Mute Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onToggleMute}
            disabled={sessionClosing}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-red-500 shadow-lg shadow-red-500/50'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isMuted ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-white" />
            )}
          </motion.button>

          {/* End Call Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onEndCall}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center shadow-2xl shadow-red-500/50 transition-all"
          >
            <Phone className="w-9 h-9 text-white transform rotate-135" />
          </motion.button>

          {/* Keypad Button (estetico) */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowKeypad(!showKeypad)}
            disabled={sessionClosing}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              showKeypad
                ? 'bg-blue-600 shadow-lg shadow-blue-600/50'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Grid3x3 className="w-7 h-7 text-white" />
          </motion.button>
        </div>

        {/* Label sotto i pulsanti */}
        <div className="flex items-center justify-center gap-8 mt-3">
          <span className="w-16 text-center text-xs text-gray-400">
            {isMuted ? 'Riattiva' : 'Muto'}
          </span>
          <span className="w-20 text-center text-xs text-gray-400">Chiudi</span>
          <span className="w-16 text-center text-xs text-gray-400">Tastiera</span>
        </div>
      </div>

      {/* Tastierino Numerico Estetico */}
      <AnimatePresence>
        {showKeypad && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-800/95 backdrop-blur-md border-t border-gray-700 p-6 pb-8"
          >
            <div className="max-w-xs mx-auto grid grid-cols-3 gap-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                <button
                  key={key}
                  className="w-full aspect-square rounded-full bg-gray-700 hover:bg-gray-600 text-white text-2xl font-light transition-colors flex items-center justify-center"
                  onClick={() => {
                    // Estetico - non fa nulla ma dà feedback visivo
                    console.log('Pressed:', key);
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
