
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Loader2,
  Sparkles,
  ShieldCheck,
  SignalHigh,
  Volume2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { MicrophoneTest } from '@/components/consultation-lobby/MicrophoneTest';

interface InviteData {
  agent: {
    displayName: string;
    businessName: string;
  };
  prospectName?: string;
  prospectEmail?: string;
  prospectPhone?: string;
}

export default function ConsultationInviteLobby() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  // State
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const joinButtonRef = useRef<HTMLButtonElement>(null);

  const { data: inviteData, isLoading, error } = useQuery<InviteData>({
    queryKey: ['/public/invite', token],
    queryFn: async () => {
      const res = await fetch(`/api/public/invite/${token}`);
      if (!res.ok) throw new Error('Errore caricamento invito');
      return res.json();
    },
    retry: false
  });

  useEffect(() => {
    if (inviteData) {
      setProspectName(inviteData.prospectName || '');
      setProspectEmail(inviteData.prospectEmail || '');
      setProspectPhone(inviteData.prospectPhone || '');
    }
  }, [inviteData]);

  const handleJoin = async () => {
    if (!prospectName.trim()) {
      toast({ variant: 'destructive', title: 'Nome mancante', description: 'Inserisci il tuo nome.' });
      return;
    }
    setIsJoining(true);
    try {
      const response = await fetch(`/api/public/invite/${token}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectName,
          prospectEmail: prospectEmail || undefined,
          prospectPhone: prospectPhone || undefined,
        }),
      });

      if (!response.ok) throw new Error('Errore ingresso');
      const data = await response.json();

      sessionStorage.setItem('consultationInvite_sessionToken', data.sessionToken);
      sessionStorage.setItem('consultationInvite_conversationId', data.conversationId);
      window.location.href = `/live-consultation?mode=consultation_invite&inviteToken=${token}`;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile entrare.' });
      setIsJoining(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    toast({
      description: !isMuted ? "Microfono disattivato" : "Microfono attivo",
      duration: 1500,
    });
  };

  const handleTestSuccess = () => {
    setTimeout(() => {
      if (joinButtonRef.current) {
        joinButtonRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <Loader2 className="animate-spin w-8 h-8 text-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white">
        Invito non valido
      </div>
    );
  }

  const agentName = inviteData?.agent.displayName || "Consulente";
  const initials = prospectName 
    ? prospectName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
    : 'TU';

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
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
            </div>
            <div className="text-white">
              <p className="text-xs lg:text-sm font-semibold tracking-tight">Consultation Room</p>
              <p className="text-[10px] lg:text-xs text-white/60">Studio Privato</p>
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
                        onPermissionGranted={() => setMicPermissionGranted(true)}
                        onPermissionDenied={() => setMicPermissionGranted(false)}
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
                      {isMuted ? "Clicca per riattivare" : "Sei pronto per entrare nella stanza"}
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
          LATO DESTRO: FORM (50%) - Bianco Puro Elevato
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="w-full lg:w-1/2 bg-white relative overflow-y-auto shadow-2xl">
        
        {/* Contenuto centrato verticalmente */}
        <div className="min-h-full flex flex-col justify-center p-6 lg:p-12 xl:p-16 max-w-xl mx-auto py-12 lg:py-0">

          {/* Header */}
          <div className="mb-8 lg:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-4 lg:mb-6">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Sala d'attesa</span>
            </div>

            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-slate-900 mb-2 lg:mb-3 leading-tight">
              {agentName}
            </h1>
            <p className="text-base lg:text-lg text-slate-500">
              {inviteData?.agent.businessName || "Consulenza privata"}
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-8 lg:mb-10" />

          {/* Form Fields */}
          <div className="space-y-5 lg:space-y-6 mb-8 lg:mb-10">
            {/* Nome (required) */}
            <div className="space-y-2 lg:space-y-3">
              <Label className="text-slate-700 font-semibold text-sm lg:text-base">
                Il tuo nome completo *
              </Label>
              <Input 
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                placeholder="Mario Rossi"
                className="h-12 lg:h-14 text-base bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
            </div>

            {/* Email (optional) */}
            <div className="space-y-2 lg:space-y-3">
              <Label className="text-slate-500 text-xs lg:text-sm font-medium uppercase tracking-wide">
                Email (opzionale)
              </Label>
              <Input 
                type="email"
                value={prospectEmail}
                onChange={(e) => setProspectEmail(e.target.value)}
                placeholder="mario@email.com"
                className="h-11 lg:h-12 bg-slate-50 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10"
              />
            </div>

            {/* Telefono (optional) */}
            <div className="space-y-2 lg:space-y-3">
              <Label className="text-slate-500 text-xs lg:text-sm font-medium uppercase tracking-wide">
                Telefono (opzionale)
              </Label>
              <Input 
                type="tel"
                value={prospectPhone}
                onChange={(e) => setProspectPhone(e.target.value)}
                placeholder="+39 333..."
                className="h-11 lg:h-12 bg-slate-50 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10"
              />
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
                Connessione crittografata end-to-end. Solo tu e il consulente potrete partecipare.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            ref={joinButtonRef}
            onClick={handleJoin}
            disabled={!micPermissionGranted || isJoining}
            className="w-full h-14 lg:h-16 text-base lg:text-lg font-bold rounded-xl lg:rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 shadow-xl shadow-blue-900/20 hover:shadow-2xl hover:shadow-blue-900/30 transition-all duration-300 disabled:cursor-not-allowed"
          >
            {isJoining ? (
              <>
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                Connessione in corso...
              </>
            ) : !micPermissionGranted ? (
              "⚠ Completa il test audio"
            ) : (
              <>
                Partecipa alla consulenza
                <span className="ml-2">→</span>
              </>
            )}
          </Button>

          {/* Warning sotto bottone */}
          {!micPermissionGranted && (
            <p className="text-center text-xs lg:text-sm text-red-600 font-medium mt-3 lg:mt-4 animate-pulse">
              Il test del microfono è obbligatorio per procedere
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
