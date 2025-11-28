
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mic, MicOff, User, Clock, ChevronUp, ChevronDown, Grid3x3, X, Loader2, LogOut, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiveTranscript } from '../LiveTranscript';

interface PhoneCallLayoutProps {
  conversationDuration: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
  onDisconnectTemporarily?: () => void;
  onEndSession?: (reason: 'manual' | 'auto_90min') => void;
  liveState: 'idle' | 'loading' | 'listening' | 'thinking' | 'speaking';
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  currentTranscript: { role: 'user' | 'assistant'; text: string; timestamp: number } | null;
  userTranscript: { role: 'user' | 'assistant'; text: string; timestamp: number } | null;
  micLevel: number;
  audioLevel: number;
  isTestMode?: boolean;
  sessionClosing?: boolean;
  sessionType?: 'weekly_consultation';
}

export function PhoneCallLayout({
  conversationDuration,
  isMuted,
  onToggleMute,
  onEndCall,
  onDisconnectTemporarily,
  onEndSession,
  liveState,
  connectionStatus,
  currentTranscript,
  userTranscript,
  micLevel,
  audioLevel,
  isTestMode,
  sessionClosing,
  sessionType,
}: PhoneCallLayoutProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showEndCallMenu, setShowEndCallMenu] = useState(false);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Soglia per rilevare quando l'utente parla
  const USER_AUDIO_THRESHOLD = 10;
  
  // Stati semplificati: AI parla quando liveState è 'speaking'
  const isUserSpeaking = liveState === 'listening' && micLevel > USER_AUDIO_THRESHOLD && !isMuted;
  const isAISpeaking = liveState === 'speaking';
  const isSomeoneActivelyTalking = isUserSpeaking || isAISpeaking;
  
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
          
          {/* Glow di sfondo quando qualcuno parla */}
          <AnimatePresence>
            {isSomeoneActivelyTalking && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1.3, 1.5, 1.3],
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full blur-2xl"
                style={{
                  background: isUserSpeaking 
                    ? 'radial-gradient(circle, rgba(16, 185, 129, 0.6) 0%, rgba(16, 185, 129, 0) 70%)' 
                    : 'radial-gradient(circle, rgba(99, 102, 241, 0.6) 0%, rgba(139, 92, 246, 0) 70%)',
                  transform: 'scale(2)',
                }}
              />
            )}
          </AnimatePresence>

          {/* Onde concentriche animate */}
          <AnimatePresence>
            {isSomeoneActivelyTalking && (
              <>
                {[1, 2, 3, 4, 5].map((ring) => (
                  <motion.div
                    key={`wave-${ring}-${isUserSpeaking ? 'user' : 'ai'}`}
                    initial={{ scale: 1, opacity: 0 }}
                    animate={{
                      scale: [1, 1.8 + ring * 0.3],
                      opacity: [0.8, 0],
                    }}
                    exit={{ scale: 1, opacity: 0 }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      delay: ring * 0.2,
                      ease: 'easeOut',
                    }}
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: isUserSpeaking 
                        ? `2px solid rgba(16, 185, 129, ${0.8 - ring * 0.1})` 
                        : `2px solid rgba(139, 92, 246, ${0.8 - ring * 0.1})`,
                      boxShadow: isUserSpeaking
                        ? `0 0 ${15 + ring * 8}px rgba(16, 185, 129, 0.4)`
                        : `0 0 ${15 + ring * 8}px rgba(139, 92, 246, 0.4)`,
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Avatar principale */}
          <motion.div
            animate={{
              scale: isSomeoneActivelyTalking ? [1, 1.08, 1] : [1, 1.02, 1],
              boxShadow: isSomeoneActivelyTalking 
                ? isUserSpeaking
                  ? ['0 0 30px rgba(16, 185, 129, 0.5)', '0 0 60px rgba(16, 185, 129, 0.8)', '0 0 30px rgba(16, 185, 129, 0.5)']
                  : ['0 0 30px rgba(139, 92, 246, 0.5)', '0 0 60px rgba(139, 92, 246, 0.8)', '0 0 30px rgba(139, 92, 246, 0.5)']
                : '0 0 20px rgba(0, 0, 0, 0.3)',
            }}
            transition={{ 
              duration: isSomeoneActivelyTalking ? 0.8 : 3, 
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 ${
              isLoading 
                ? 'bg-gradient-to-br from-gray-600 to-gray-700' 
                : isUserSpeaking 
                ? 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600' 
                : isAISpeaking
                ? 'bg-gradient-to-br from-indigo-400 via-purple-500 to-violet-600'
                : 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600'
            }`}
          >
            {/* Effetto lucido interno */}
            <div className="absolute inset-2 rounded-full bg-gradient-to-b from-white/20 to-transparent" />
            
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-16 h-16 text-white drop-shadow-lg" />
              </motion.div>
            ) : (
              <motion.div
                animate={isSomeoneActivelyTalking ? { 
                  scale: [1, 1.1, 1],
                } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <User className="w-20 h-20 text-white drop-shadow-lg" />
              </motion.div>
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
                    scale: [1, 1.4, 1],
                    opacity: [0.4, 0.1, 0.4],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border-2 border-yellow-400/50"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Indicatore stato parlante sotto l'avatar */}
          <AnimatePresence>
            {isSomeoneActivelyTalking && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -bottom-8 left-1/2 transform -translate-x-1/2"
              >
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                  isUserSpeaking 
                    ? 'bg-emerald-500/20 border border-emerald-400/50' 
                    : 'bg-purple-500/20 border border-purple-400/50'
                }`}>
                  {/* Barre audio animate */}
                  {[1, 2, 3, 4, 5].map((bar) => (
                    <motion.div
                      key={bar}
                      animate={{
                        height: ['4px', `${8 + Math.random() * 12}px`, '4px'],
                      }}
                      transition={{
                        duration: 0.4,
                        repeat: Infinity,
                        delay: bar * 0.08,
                        ease: 'easeInOut',
                      }}
                      className={`w-1 rounded-full ${
                        isUserSpeaking ? 'bg-emerald-400' : 'bg-purple-400'
                      }`}
                      style={{ minHeight: '4px' }}
                    />
                  ))}
                </div>
              </motion.div>
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
            onClick={() => {
              if (onDisconnectTemporarily && onEndSession) {
                setShowEndCallMenu(true);
              } else {
                onEndCall();
              }
            }}
            disabled={sessionClosing}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center shadow-2xl shadow-red-500/50 transition-all disabled:opacity-50"
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

      {/* Menu Chiusura Chiamata - Bottom Sheet Premium */}
      <AnimatePresence>
        {showEndCallMenu && (
          <>
            {/* Overlay scuro */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEndCallMenu(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-b from-gray-800 to-gray-900 rounded-t-3xl border-t border-gray-700/50 shadow-2xl"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-gray-600" />
              </div>

              {/* Header */}
              <div className="px-6 pb-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-red-400 transform rotate-135" />
                  <h3 className="text-lg font-semibold text-white">Termina chiamata</h3>
                </div>
                <p className="text-sm text-gray-400">
                  {sessionType === 'weekly_consultation'
                    ? 'Come vuoi terminare la consulenza?'
                    : 'Come vuoi terminare la sessione?'}
                </p>
              </div>

              {/* Info Box per consulenze */}
              {sessionType === 'weekly_consultation' && (
                <div className="mx-6 mb-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 text-blue-300 mb-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Tempo rimanente: {Math.max(0, 90 - Math.floor(conversationDuration / 60))} min
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Puoi tornare entro questo tempo per riprendere la conversazione
                  </p>
                </div>
              )}

              {/* Opzioni */}
              <div className="px-6 pb-8 space-y-3">
                {/* Esci Temporaneamente */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowEndCallMenu(false);
                    onDisconnectTemporarily?.();
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 hover:border-orange-400/50 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <LogOut className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="text-base font-semibold text-orange-200">Esci Temporaneamente</h4>
                    <p className="text-xs text-gray-400">
                      {sessionType === 'weekly_consultation'
                        ? 'Puoi tornare entro 90 min per riprendere'
                        : 'Salva la conversazione ed esci'}
                    </p>
                  </div>
                </motion.button>

                {/* Chiudi Definitivamente */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowEndCallMenu(false);
                    onEndSession?.('manual');
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 hover:border-red-400/50 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                    <XCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="text-base font-semibold text-red-200">Chiudi Definitivamente</h4>
                    <p className="text-xs text-gray-400">
                      {sessionType === 'weekly_consultation'
                        ? 'Termina la consulenza definitivamente'
                        : 'Termina la sessione senza possibilità di ripresa'}
                    </p>
                  </div>
                </motion.button>

                {/* Annulla */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEndCallMenu(false)}
                  className="w-full p-4 rounded-2xl bg-gray-700/50 border border-gray-600/30 hover:bg-gray-700 transition-all"
                >
                  <span className="text-base font-medium text-gray-300">Annulla</span>
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
