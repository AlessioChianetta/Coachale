import { useState, useEffect } from 'react';
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
import { Separator } from '@/components/ui/separator';
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

  // Stato locale per simulare il mute/unmute DOPO aver passato il test
  const [isMuted, setIsMuted] = useState(false);

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

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-[#202124] text-white"><Loader2 className="animate-spin w-8 h-8" /></div>;
  if (error) return <div className="h-screen flex items-center justify-center bg-[#202124] text-white">Invito non valido</div>;

  const agentName = inviteData?.agent.displayName || "Consulente";
  const initials = prospectName 
    ? prospectName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
    : 'TU';

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full overflow-hidden bg-[#202124] font-sans">

      {/* --- LATO SINISTRO: ANTEPRIMA AUDIO --- */}
      <div className="flex-1 relative flex flex-col p-4 lg:p-6 bg-[#202124]">

        {/* Header Branding */}
        <div className="absolute top-6 left-8 z-10 hidden lg:flex items-center gap-2 text-white/90">
             <div className="bg-blue-600/20 p-1.5 rounded-lg">
               <Sparkles className="w-4 h-4 text-blue-400" />
             </div>
             <span className="font-semibold tracking-tight text-sm">Consultation Room</span>
        </div>

        {/* Container Centrale */}
        <div className="flex-1 flex items-center justify-center w-full h-full relative">

          {/* IL BOX ANTEPRIMA */}
          <div className="relative w-full max-w-3xl aspect-video bg-[#282a2d] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5 flex flex-col items-center justify-center">

            {/* Background pattern sottile */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-700 via-[#282a2d] to-[#282a2d]" />

            {/* Badge Stato Audio (in alto a destra) */}
            <div className="absolute top-6 right-6 z-20">
               <div className={`backdrop-blur-md px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
                 micPermissionGranted 
                   ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                   : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700'
               }`}>
                 {micPermissionGranted ? (
                   <><SignalHigh className="w-3 h-3" /> Audio Pronto</>
                 ) : (
                   <><Volume2 className="w-3 h-3" /> Configurazione Audio</>
                 )}
               </div>
            </div>

            {/* CONTENUTO CENTRALE */}
            <div className="z-10 w-full flex flex-col items-center justify-center p-6 transition-all duration-500">

              {!micPermissionGranted ? (
                /* --- FASE 1: TEST NECESSARIO --- */
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-md flex flex-col items-center"
                >
                  <div className="text-center mb-8 space-y-2">
                    <h2 className="text-2xl text-white font-medium">Controlliamo il tuo audio</h2>
                    <p className="text-zinc-400 text-sm">Per garantirti la migliore esperienza, verifica il microfono.</p>
                  </div>

                  {/* Il componente MicrophoneTest viene incapsulato in un design pulito */}
                  <div className="relative group w-full">
                    {/* Glow effect dietro la card */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                    <div className="relative bg-white dark:bg-zinc-900 rounded-xl p-1 shadow-2xl overflow-hidden">
                       <MicrophoneTest
                         onPermissionGranted={() => setMicPermissionGranted(true)}
                         onPermissionDenied={() => setMicPermissionGranted(false)}
                       />
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* --- FASE 2: PRONTO & AVATAR --- */
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-8"
                >
                  {/* Avatar con visualizzatore onda sonora simulata */}
                  <div className="relative">
                    {/* Cerchi pulsanti se non mutato */}
                    {!isMuted && (
                      <>
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.5s' }} />
                      </>
                    )}

                    <Avatar className="w-32 h-32 border-4 border-[#282a2d] shadow-2xl relative z-10">
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-3xl font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    {/* Icona stato muto sull'avatar */}
                    {isMuted && (
                      <div className="absolute inset-0 z-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-[1px]">
                        <MicOff className="w-10 h-10 text-white/80" />
                      </div>
                    )}
                  </div>

                  <div className="text-center space-y-1">
                     <h3 className="text-xl text-white font-medium">
                       {isMuted ? "Microfono disattivato" : "Il microfono funziona"}
                     </h3>
                     <p className="text-zinc-500 text-sm">Sei pronto per entrare nella stanza.</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* BARRA CONTROLLI (Visibile SOLO se permesso accordato) */}
            {micPermissionGranted && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-20">
                <button
                  onClick={toggleMute}
                  className={`p-4 rounded-full transition-all duration-200 shadow-lg hover:scale-105 ${
                    isMuted 
                      ? 'bg-red-500 hover:bg-red-600 text-white border-2 border-transparent' 
                      : 'bg-[#3c4043] hover:bg-[#4a4f54] text-white border border-white/10'
                  }`}
                  title={isMuted ? "Attiva microfono" : "Disattiva microfono"}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
              </div>
            )}

          </div>

          <p className="absolute bottom-6 text-zinc-600 text-xs hidden lg:block">
            Anteprima sicura • Solo audio
          </p>
        </div>
      </div>

      {/* --- LATO DESTRO: FORM DI ACCESSO --- */}
      <div className="lg:w-[420px] bg-white w-full flex flex-col shadow-2xl z-30 h-auto lg:h-full overflow-y-auto">

        {/* Intestazione */}
        <div className="p-8 pt-12 pb-2">
          <p className="text-xs font-bold text-blue-600 tracking-wider uppercase mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/> Sala d'attesa
          </p>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">{agentName}</h1>
          <p className="text-slate-500 text-sm">
            {inviteData?.agent.businessName || "Consulenza privata"}
          </p>
        </div>

        <div className="px-8">
           <Separator className="my-6" />
        </div>

        {/* Campi Form */}
        <div className="px-8 space-y-5 flex-1">
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Il tuo Nome completo</Label>
            <Input 
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              placeholder="Mario Rossi"
              className="h-12 bg-slate-50 border-slate-200 focus:ring-blue-500 text-base"
            />
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-slate-600 text-xs uppercase font-semibold">Email (opzionale)</Label>
              <Input 
                value={prospectEmail}
                onChange={(e) => setProspectEmail(e.target.value)}
                placeholder="mario@email.com"
                className="h-10 bg-slate-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-600 text-xs uppercase font-semibold">Telefono (opzionale)</Label>
              <Input 
                 value={prospectPhone}
                 onChange={(e) => setProspectPhone(e.target.value)}
                 placeholder="+39 333..."
                 className="h-10 bg-slate-50"
              />
            </div>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg flex gap-3 items-start mt-4">
             <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
             <p className="text-xs text-blue-800/80 leading-relaxed">
               Sessione crittografata end-to-end. Nessuno oltre al consulente potrà ascoltare.
             </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-8 mt-auto bg-white">
           <Button
             onClick={handleJoin}
             disabled={!micPermissionGranted || isJoining}
             className="w-full h-14 text-lg rounded-full font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed shadow-xl shadow-blue-900/10 transition-all"
           >
             {isJoining ? (
               <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Connessione...</>
             ) : !micPermissionGranted ? (
               "Completa test audio a sinistra"
             ) : (
               "Partecipa ora"
             )}
           </Button>

           {!micPermissionGranted && (
             <p className="text-xs text-center text-red-500 font-medium mt-3 animate-pulse">
               ⚠ Il test microfono è obbligatorio
             </p>
           )}
        </div>
      </div>
    </div>
  );
}