
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Sparkles,
  ShieldCheck,
  SignalHigh,
  Volume2,
  Target,
  MessageSquare,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MicrophoneTest } from '@/components/consultation-lobby/MicrophoneTest';
import { useToast } from '@/hooks/use-toast';

const VOICES = [
  { value: 'achernar', label: 'Achernar', description: '🇮🇹 Femminile Professionale' },
  { value: 'puck', label: 'Puck', description: '🇬🇧 Maschile Giovane' },
  { value: 'charon', label: 'Charon', description: '🇬🇧 Maschile Maturo' },
  { value: 'kore', label: 'Kore', description: '🇬🇧 Femminile Giovane' },
  { value: 'fenrir', label: 'Fenrir', description: '🇬🇧 Maschile Profondo' },
  { value: 'aoede', label: 'Aoede', description: '🇬🇧 Femminile Melodiosa' },
];

export default function ConsultationLobby() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Get session type from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const sessionType = urlParams.get('type') as 'normal' | 'consultation' || 'normal';
  
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  
  // Load saved preferences
  const [voiceName, setVoiceName] = useState(() => {
    const saved = localStorage.getItem('liveMode_voice');
    return saved || 'achernar';
  });
  
  const [useFullPrompt, setUseFullPrompt] = useState(() => {
    const saved = localStorage.getItem('liveMode_useFullPrompt');
    return saved !== 'false';
  });

  // Save preferences when they change
  useEffect(() => {
    localStorage.setItem('liveMode_voice', voiceName);
  }, [voiceName]);

  useEffect(() => {
    localStorage.setItem('liveMode_useFullPrompt', String(useFullPrompt));
  }, [useFullPrompt]);

  const handleTestSuccess = () => {
    console.log('[ConsultationLobby] 🎉 Test success! Setting micPermissionGranted and scrolling...');
    setMicPermissionGranted(true);
    
    // Scroll al pulsante dopo un breve delay per permettere il re-render
    setTimeout(() => {
      if (enterButtonRef.current) {
        console.log('[ConsultationLobby] 📜 Scrolling to enter button...');
        enterButtonRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 600);
  };

  const handleMicPermissionDenied = () => {
    setMicPermissionGranted(false);
  };

  const handleEnterSession = () => {
    if (!micPermissionGranted) {
      toast({
        variant: 'destructive',
        title: '🎤 Test microfono richiesto',
        description: 'Completa il test del microfono prima di entrare',
        duration: 5000,
      });
      return;
    }

    setIsEntering(true);
    
    // Navigate to live consultation with sessionType parameter
    const params = new URLSearchParams({
      sessionType: sessionType,
      voice: voiceName,
      fullPrompt: String(useFullPrompt),
    });
    
    navigate(`/live-consultation?${params.toString()}`);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    toast({
      description: !isMuted ? "Microfono disattivato" : "Microfono attivo",
      duration: 1500,
    });
  };

  const sessionInfo = sessionType === 'consultation' ? {
    title: 'Sessione Consulenza',
    subtitle: 'Consulenza settimanale programmata',
    icon: Target,
    color: 'from-purple-500 to-pink-500',
  } : {
    title: 'Sessione Normale',
    subtitle: 'Chat libera con AI',
    icon: MessageSquare,
    color: 'from-blue-500 to-cyan-500',
  };

  const Icon = sessionInfo.icon;
  const initials = 'TU';

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full overflow-x-hidden">

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          LATO SINISTRO: VIDEO PREVIEW (50%) - Full Height Dark Gradient
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="w-full lg:w-1/2 min-h-[60vh] lg:min-h-screen relative bg-gradient-to-br from-slate-900 via-slate-800 to-black overflow-hidden">
        
        {/* Gradient Overlay dal basso verso l'alto */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none z-10" />

        {/* Pattern Background sottile */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* Contenuto Centrato Verticalmente */}
        <div className="relative z-20 h-full flex flex-col items-center justify-center p-8 lg:p-12">

          {/* Logo/Brand in alto */}
          <div className="absolute top-4 left-4 lg:top-8 lg:left-8 flex items-center gap-2 lg:gap-3">
            <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br ${sessionInfo.color} flex items-center justify-center shadow-lg`}>
              <Icon className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
            </div>
            <div className="text-white">
              <p className="text-xs lg:text-sm font-semibold tracking-tight">{sessionInfo.title}</p>
              <p className="text-[10px] lg:text-xs text-white/60">{sessionInfo.subtitle}</p>
            </div>
          </div>

          {/* Badge Status (in alto a destra) */}
          <div className="absolute top-4 right-4 lg:top-8 lg:right-8">
            <div className={`backdrop-blur-xl px-3 py-2 lg:px-5 lg:py-2.5 rounded-full text-xs lg:text-sm font-semibold flex items-center gap-1.5 lg:gap-2.5 transition-all border ${
              micPermissionGranted 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30 shadow-lg shadow-emerald-500/20' 
                : 'bg-white/10 text-white/80 border-white/20'
            }`}>
              {micPermissionGranted ? (
                <><SignalHigh className="w-4 h-4" /> Audio Pronto</>
              ) : (
                <><Volume2 className="w-4 h-4" /> Setup Audio</>
              )}
            </div>
          </div>

          {/* CONTENUTO CENTRALE */}
          <div className="w-full max-w-2xl px-4 lg:px-0">
            <AnimatePresence mode="wait">
              {!micPermissionGranted ? (
                /* ━━━ FASE 1: TEST MICROFONO ━━━ */
                <motion.div
                  key="test-phase"
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-6 lg:space-y-8"
                >
                  <div className="text-center space-y-3 lg:space-y-4">
                    <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-white tracking-tight">
                      Setup Audio
                    </h1>
                    <p className="text-base lg:text-lg text-white/70 max-w-md mx-auto leading-relaxed px-4">
                      Prima di entrare, verifichiamo che il tuo microfono funzioni correttamente.
                    </p>
                  </div>

                  {/* Microfono Test con Glow Effect */}
                  <div className="relative group">
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition duration-500 animate-pulse" />
                    <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl">
                      <MicrophoneTest
                        onPermissionDenied={handleMicPermissionDenied}
                        onTestSuccess={handleTestSuccess}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* ━━━ FASE 2: PREVIEW CON AVATAR ━━━ */
                <motion.div
                  key="preview-phase"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex flex-col items-center space-y-6 lg:space-y-10"
                >
                  {/* Avatar con Pulse Ring */}
                  <div className="relative">
                    {/* Animated Rings se non muted */}
                    {!isMuted && (
                      <>
                        <div className="absolute inset-0 -m-6 lg:-m-8">
                          <div className="w-full h-full border-2 lg:border-4 border-blue-500/30 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                        </div>
                        <div className="absolute inset-0 -m-3 lg:-m-4">
                          <div className="w-full h-full border-2 border-violet-500/20 rounded-full animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
                        </div>
                      </>
                    )}

                    <Avatar className="w-32 h-32 lg:w-40 lg:h-40 xl:w-48 xl:h-48 border-4 lg:border-8 border-white/10 shadow-2xl shadow-black/50 relative z-10">
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 via-violet-600 to-blue-700 text-white text-3xl lg:text-4xl xl:text-5xl font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    {/* Mute Overlay */}
                    {isMuted && (
                      <div className="absolute inset-0 z-20 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <MicOff className="w-14 h-14 lg:w-16 lg:h-16 text-white/90" />
                      </div>
                    )}
                  </div>

                  {/* Testo Status */}
                  <div className="text-center space-y-2 lg:space-y-3 px-4">
                    <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
                      {isMuted ? "Microfono disattivato" : "Tutto pronto!"}
                    </h2>
                    <p className="text-base lg:text-lg text-white/60">
                      {isMuted ? "Clicca per riattivare" : "Sei pronto per entrare nella sessione"}
                    </p>
                  </div>

                  {/* Controllo Mute */}
                  <button
                    onClick={toggleMute}
                    className={`group relative p-4 lg:p-6 rounded-full transition-all duration-300 shadow-2xl hover:scale-110 ${
                      isMuted 
                        ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' 
                        : 'bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/15'
                    }`}
                    title={isMuted ? "Attiva microfono" : "Disattiva microfono"}
                  >
                    {isMuted ? (
                      <MicOff className="w-7 h-7 text-white" />
                    ) : (
                      <Mic className="w-7 h-7 text-white" />
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Info */}
          <div className="absolute bottom-4 lg:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/40 text-xs lg:text-sm px-4 text-center">
            <ShieldCheck className="w-3 h-3 lg:w-4 lg:h-4" />
            <span className="hidden sm:inline">Anteprima sicura • Crittografia end-to-end</span>
            <span className="sm:hidden">Sicuro • Crittografato</span>
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          LATO DESTRO: FORM CONFIGURAZIONE (50%) - Bianco Puro Elevato
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="w-full lg:w-1/2 bg-white relative overflow-y-auto shadow-2xl">
        
        {/* Contenuto centrato verticalmente */}
        <div className="min-h-full flex flex-col justify-center p-6 lg:p-12 xl:p-16 max-w-xl mx-auto py-12 lg:py-0">

          {/* Header */}
          <div className="mb-8 lg:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-4 lg:mb-6">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Configurazione</span>
            </div>

            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-slate-900 mb-2 lg:mb-3 leading-tight">
              {sessionInfo.title}
            </h1>
            <p className="text-base lg:text-lg text-slate-500">
              {sessionInfo.subtitle}
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-8 lg:mb-10" />

          {/* Form Fields */}
          <div className="space-y-5 lg:space-y-6 mb-8 lg:mb-10">
            {/* Voice Selector */}
            <div className="space-y-2 lg:space-y-3">
              <Label className="text-slate-700 font-semibold text-sm lg:text-base flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Voce AI
              </Label>
              <Select value={voiceName} onValueChange={setVoiceName}>
                <SelectTrigger className="h-12 lg:h-14 text-base bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICES.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label} - {voice.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Scegli la voce che l'AI userà durante la conversazione
              </p>
            </div>

            {/* Full Prompt Toggle */}
            <div className="bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-100 rounded-xl lg:rounded-2xl p-4 lg:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <Label htmlFor="full-prompt" className="text-base font-semibold text-blue-900">
                    Prompt Completo
                  </Label>
                  <p className="text-xs lg:text-sm text-blue-700/80 mt-1">
                    Usa il prompt completo per risposte più dettagliate e contestualizzate
                  </p>
                </div>
                <Switch
                  id="full-prompt"
                  checked={useFullPrompt}
                  onCheckedChange={setUseFullPrompt}
                />
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-100 rounded-xl lg:rounded-2xl p-4 lg:p-5 flex gap-3 lg:gap-4 items-start mb-8 lg:mb-10">
            <ShieldCheck className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs lg:text-sm font-medium text-blue-900 mb-1">
                Sessione sicura e privata
              </p>
              <p className="text-xs text-blue-700/80 leading-relaxed">
                Connessione crittografata end-to-end. I tuoi dati personalizzati sono inclusi (finanza, esercizi, documenti).
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            ref={enterButtonRef}
            onClick={handleEnterSession}
            disabled={!micPermissionGranted || isEntering}
            className="w-full h-14 lg:h-16 text-base lg:text-lg font-bold rounded-xl lg:rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 shadow-xl shadow-blue-900/20 hover:shadow-2xl hover:shadow-blue-900/30 transition-all duration-300 disabled:cursor-not-allowed"
          >
            {isEntering ? (
              <>
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                Caricamento...
              </>
            ) : !micPermissionGranted ? (
              "⚠ Completa il test audio"
            ) : (
              <>
                Entra nella Sessione
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>

          {/* Warning sotto bottone */}
          {!micPermissionGranted && (
            <p className="text-center text-xs lg:text-sm text-red-600 font-medium mt-3 lg:mt-4 animate-pulse">
              Il test del microfono è obbligatorio per procedere
            </p>
          )}

          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/client/ai-assistant')}
            className="w-full mt-4 text-slate-600 hover:text-slate-900"
          >
            ← Torna indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
