
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mic, MicOff, User, Clock, ChevronUp, ChevronDown, Grid3x3, X, Loader2 } from 'lucide-react';
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

  // Soglie per considerare "audio attivo"
  const USER_AUDIO_THRESHOLD = 10; // Soglia utente (0-255)
  const AI_AUDIO_THRESHOLD = 3;    // Soglia AI più bassa per catturare più audio
  
  // L'AI sta parlando se liveState è 'speaking' (indipendentemente dall'audioLevel perché
  // tra un chunk e l'altro l'audioLevel scende a 0 brevemente)
  const isUserSpeaking = liveState === 'listening' && micLevel > USER_AUDIO_THRESHOLD && !isMuted;
  const isAISpeaking = liveState === 'speaking'; // AI parla quando lo stato è 'speaking'
  const hasAudioActivity = audioLevel > AI_AUDIO_THRESHOLD; // Per intensità onde
  const isSomeoneActivelyTalking = isUserSpeaking || isAISpeaking;
  
  // Colori: Verde per utente, Blu per AI
  const voiceColor = isUserSpeaking ? '#10b981' : '#3b82f6';
  const currentLevel = isUserSpeaking ? micLevel : audioLevel;
  
  // Stato di caricamento
  const isLoading = connectionStatus === 'connecting' || liveState === 'loading';

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
          key={`${liveState}-${connectionStatus}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-400 text-sm"
        >
          {sessionClosing ? '🔒 Chiusura in corso...' :
           connectionStatus === 'connecting' ? '⏳ Connessione in corso...' :
           liveState === 'loading' ? '⏳ Preparazione chiamata...' :
           isUserSpeaking ? '🎙️ Stai parlando...' :
           isAISpeaking ? '🔊 AI sta parlando...' :
           liveState === 'listening' ? (isMuted ? '🔇 Microfono silenziato' : '🎤 In ascolto...') :
           liveState === 'thinking' ? '💭 Sta pensando...' :
           connectionStatus === 'connected' ? '✅ Pronto' :
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
              scale: isSomeoneActivelyTalking ? [1, 1.05, 1] : 1,
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className={`w-40 h-40 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
              isLoading 
                ? 'bg-gradient-to-br from-gray-600 to-gray-700' 
                : isUserSpeaking 
                ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                : 'bg-gradient-to-br from-blue-500 to-purple-600'
            }`}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-16 h-16 text-white" />
              </motion.div>
            ) : (
              <User className="w-20 h-20 text-white" />
            )}
          </motion.div>

          {/* Overlay di caricamento */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.3, 0.1, 0.3],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-yellow-500/20 border-2 border-yellow-400/50"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Onde vocali animate - visibili quando qualcuno parla */}
          <AnimatePresence>
            {isSomeoneActivelyTalking && (
              <>
                {[1, 2, 3, 4].map((ring) => (
                  <motion.div
                    key={`${ring}-${isUserSpeaking ? 'user' : 'ai'}`}
                    initial={{ scale: 1, opacity: 0 }}
                    animate={{
                      scale: [1, 1.4 + ring * 0.25],
                      opacity: [0.7, 0],
                    }}
                    exit={{ scale: 1, opacity: 0 }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: ring * 0.15,
                      ease: 'easeOut',
                    }}
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: `3px solid ${voiceColor}`,
                      boxShadow: `0 0 ${10 + ring * 5}px ${voiceColor}40`,
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pulsante Espandi Trascrizione - sopra la trascrizione */}
      <div className="px-6 py-2 shrink-0">
        <Button
          variant="ghost"
          onClick={() => setShowTranscript(!showTranscript)}
          className="w-full text-gray-400 hover:text-white hover:bg-gray-800/50 border border-gray-700/50"
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

      {/* Trascrizione Espandibile - Con altezza fissa e scroll interno */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-4 mb-4 bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-600/50 shadow-2xl overflow-hidden"
          >
            {/* Header della trascrizione */}
            <div className="px-4 py-3 border-b border-gray-700/50 bg-gray-900/50">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Trascrizione in tempo reale
              </h3>
            </div>
            
            {/* Contenuto scrollabile */}
            <div className="max-h-[35vh] min-h-[120px] overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
              {!userTranscript && !currentTranscript ? (
                <div className="text-center text-gray-500 py-4">
                  <p className="text-sm">In attesa di conversazione...</p>
                </div>
              ) : (
                <>
                  {userTranscript && (
                    <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-green-400">Tu</span>
                      </div>
                      <LiveTranscript
                        text={userTranscript.text}
                        role={userTranscript.role}
                        animated={true}
                      />
                    </div>
                  )}
                  {currentTranscript && (
                    <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-blue-400">AI</span>
                      </div>
                      <LiveTranscript
                        text={currentTranscript.text}
                        role={currentTranscript.role}
                        animated={true}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Tastierino Numerico Premium */}
      <AnimatePresence>
        {showKeypad && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed bottom-0 left-0 right-0 bg-gradient-to-b from-gray-800/95 to-gray-900/98 backdrop-blur-xl border-t border-blue-500/30 p-6 pb-8 shadow-2xl shadow-blue-500/20"
          >
            {/* Header con pulsante chiusura */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-semibold text-gray-300">Immetti numero</h3>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowKeypad(false)}
                className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="max-w-xs mx-auto grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.15, boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)' }}
                  whileTap={{ scale: 0.9 }}
                  className="w-full aspect-square rounded-full bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-2xl font-semibold transition-all shadow-lg shadow-blue-500/30 active:shadow-blue-500/50 flex items-center justify-center"
                  onClick={() => {
                    console.log('Pressed:', key);
                  }}
                >
                  {key}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
