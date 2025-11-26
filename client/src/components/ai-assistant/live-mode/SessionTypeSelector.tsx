import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Target, Pencil, Settings, Mic2, Lock, Calendar, Clock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getToken } from '@/lib/auth';
import { getSystemPrompt } from '@shared/ai-system-prompts';
import { useLocation } from 'wouter';

export type SessionType = 'normal' | 'consultation' | 'custom';

interface SessionTypeSelectorProps {
  onSelectType: (type: SessionType, useFullPrompt: boolean, voiceName: string) => void;
  onBack?: () => void;
}

const VOICES = [
  { value: 'achernar', label: 'Achernar', description: '🇮🇹 Femminile Professionale' },
  { value: 'puck', label: 'Puck', description: '🇬🇧 Maschile Giovane' },
  { value: 'charon', label: 'Charon', description: '🇬🇧 Maschile Maturo' },
  { value: 'kore', label: 'Kore', description: '🇬🇧 Femminile Giovane' },
  { value: 'fenrir', label: 'Fenrir', description: '🇬🇧 Maschile Profondo' },
  { value: 'aoede', label: 'Aoede', description: '🇬🇧 Femminile Melodiosa' },
];

export function SessionTypeSelector({ onSelectType, onBack }: SessionTypeSelectorProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [showConsultationDialog, setShowConsultationDialog] = useState(false);
  const [consultationInfo, setConsultationInfo] = useState<any>(null);
  const [upcomingConsultations, setUpcomingConsultations] = useState<any[]>([]);
  const [loadingConsultations, setLoadingConsultations] = useState(true);
  const [showSystemPromptDialog, setShowSystemPromptDialog] = useState(false);
  const [selectedPromptType, setSelectedPromptType] = useState<'assistenza' | 'consulente' | 'custom'>('assistenza');
  const [selectedConsultantType, setSelectedConsultantType] = useState<'finanziario' | 'vendita' | 'business'>('finanziario');
  const [useFullPrompt, setUseFullPrompt] = useState(() => {
    const saved = localStorage.getItem('liveMode_useFullPrompt');
    return saved !== 'false'; // Default: true (Full Prompt attivo di default)
  });
  const [voiceName, setVoiceName] = useState(() => {
    const saved = localStorage.getItem('liveMode_voice');
    return saved || 'achernar';
  });

  useEffect(() => {
    const fetchUpcomingConsultations = async () => {
      try {
        const token = getToken();
        const response = await fetch('/api/consultations/ai/upcoming', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUpcomingConsultations(data);
        }
      } catch (error) {
        console.error('Error fetching upcoming consultations:', error);
      } finally {
        setLoadingConsultations(false);
      }
    };

    fetchUpcomingConsultations();
  }, []);

  const handleSessionClick = async (type: SessionType) => {
    // Se è una consulenza, controlla l'accesso prima
    if (type === 'consultation') {
      setCheckingAccess(true);
      try {
        const token = getToken();
        const response = await fetch('/api/consultations/ai/check-access', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const data = await response.json();
        
        if (data.canAccess) {
          // Accesso consentito - reindirizza alla lobby
          navigate(`/consultation-lobby?type=consultation`);
        } else {
          // Accesso negato - mostra dialog con countdown
          setConsultationInfo(data);
          setShowConsultationDialog(true);
        }
      } catch (error) {
        toast({
          title: '❌ Errore',
          description: 'Impossibile verificare l\'accesso alla consulenza',
          variant: 'destructive',
        });
      } finally {
        setCheckingAccess(false);
      }
    } else if (type === 'normal') {
      // Per sessione normale, reindirizza alla lobby
      navigate(`/consultation-lobby?type=normal`);
    } else {
      // Per altre sessioni (custom), mantieni il comportamento originale
      onSelectType(type, useFullPrompt, voiceName);
    }
  };
  const sessionTypes = [
    {
      type: 'normal' as SessionType,
      title: 'Sessione Normale',
      description: 'Chat libera senza struttura',
      badge: 'mode: assistenza',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      icon: MessageSquare,
      color: 'from-blue-500 to-cyan-500',
      features: [
        'Conversazione libera',
        'Risposte immediate',
        'Nessuna struttura predefinita',
      ],
    },
    {
      type: 'consultation' as SessionType,
      title: 'Sessione Consulenza',
      description: 'Consulenza settimanale programmata 1.5h',
      badge: 'mode: assistenza*',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: Target,
      color: 'from-purple-500 to-pink-500',
      features: [
        'Programmata ogni martedì ore 15:00',
        'Durata massima: 1 ora e mezza',
        'Trascrizione completa salvata',
      ],
    },
    {
      type: 'custom' as SessionType,
      title: 'Custom Live',
      description: 'Usa il tuo prompt personalizzato',
      badge: 'in arrivo',
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      icon: Pencil,
      color: 'from-orange-500 to-red-500',
      features: [
        'Editor prompt completo',
        'Salva e riutilizza prompt',
        'Massima personalizzazione',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col items-center justify-center p-4 sm:p-8">
      {onBack && (
        <Button
          variant="ghost"
          onClick={onBack}
          className="absolute top-6 left-6 text-white/70 hover:text-white hover:bg-white/10"
        >
          ← Indietro
        </Button>
      )}

      {/* Settings in alto a destra */}
      <div className="absolute top-6 right-6 flex flex-col gap-3 text-white/70 text-sm">
        {/* Voice selector */}
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded-lg backdrop-blur-sm border border-white/10">
          <Mic2 className="h-4 w-4" />
          <span className="font-medium">Voce</span>
          <Select
            value={voiceName}
            onValueChange={(value) => {
              setVoiceName(value);
              localStorage.setItem('liveMode_voice', value);
              const voice = VOICES.find(v => v.value === value);
              toast({
                title: `🎤 ${voice?.label}`,
                description: voice?.description,
              });
            }}
          >
            <SelectTrigger className="w-[160px] bg-white/10 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((voice) => (
                <SelectItem key={voice.value} value={voice.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{voice.label}</span>
                    <span className="text-xs text-muted-foreground">{voice.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Full Prompt toggle */}
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded-lg backdrop-blur-sm border border-white/10">
          <Settings className="h-4 w-4" />
          <span className="font-medium">Full Prompt</span>
          <Switch
            checked={useFullPrompt}
            onCheckedChange={(checked) => {
              setUseFullPrompt(checked);
              localStorage.setItem('liveMode_useFullPrompt', String(checked));
              toast({
                title: checked ? '📚 Full System Prompt' : '⚡ Minimal System Prompt',
                description: checked 
                  ? 'Prompt completo ~251K tokens (include tutti i dati utente)' 
                  : 'Prompt minimal 219 tokens + dati chunked 69K tokens',
              });
            }}
          />
        </div>
      </div>

      <div className="max-w-6xl w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            🎙️ Modalità Live
          </h1>
          <p className="text-xl text-white/70">
            Scegli il tipo di sessione vocale che preferisci
          </p>
        </motion.div>

        {/* Sezione prossime consulenze */}
        {!loadingConsultations && upcomingConsultations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-500/30">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="h-6 w-6 text-purple-300" />
                  <h2 className="text-2xl font-bold text-white">
                    📅 Prossime Consulenze AI
                  </h2>
                </div>
                
                <div className="space-y-3">
                  {upcomingConsultations.map((consultation) => (
                    <div
                      key={consultation.id}
                      className="bg-white/10 rounded-lg p-4 flex items-center gap-4 hover:bg-white/15 transition-colors"
                    >
                      <Clock className="h-5 w-5 text-purple-300 flex-shrink-0" />
                      <div className="flex-grow">
                        <p className="text-white font-semibold">
                          {new Date(consultation.scheduledFor).toLocaleString('it-IT', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <p className="text-white/60 text-sm">
                          Durata: {consultation.maxDurationMinutes} minuti
                        </p>
                      </div>
                      {consultation.isTestMode && (
                        <span className="text-xs bg-green-500/20 border border-green-500/30 rounded px-2 py-1 text-green-200">
                          🧪 Test
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!loadingConsultations && upcomingConsultations.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="bg-white/5 border-white/10 transition-all duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gray-700/30 flex items-center justify-center mx-auto mb-4 border border-gray-600/30">
                  <Calendar className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">
                  Nessuna consulenza programmata
                </h3>
                <p className="text-gray-500 text-sm">
                  Le consulenze settimanali verranno mostrate qui quando saranno disponibili
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sessionTypes.map((session, index) => {
            const Icon = session.icon;
            return (
              <motion.div
                key={session.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`bg-white/5 border-white/10 transition-all duration-300 h-full ${
                    session.type === 'custom' 
                      ? 'opacity-60 cursor-not-allowed' 
                      : 'hover:bg-white/10 hover:border-white/20 cursor-pointer group'
                  }`}
                  onClick={() => session.type !== 'custom' && handleSessionClick(session.type)}
                >
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${session.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">
                      {session.title}
                    </h3>

                    <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border mb-3 ${session.badgeColor}`}>
                      🏷️ {session.badge}
                    </div>

                    <p className="text-white/60 mb-4 flex-grow">
                      {session.description}
                    </p>

                    {session.type === 'consultation' && upcomingConsultations.length > 0 && (
                      <div className="mb-4 bg-purple-500/20 border border-purple-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-purple-200 text-sm mb-1">
                          <Clock className="h-4 w-4" />
                          <span className="font-semibold">Prossima disponibile:</span>
                        </div>
                        <p className="text-white text-sm">
                          {new Date(upcomingConsultations[0].scheduledFor).toLocaleString('it-IT', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      {session.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/50 mt-1.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="icon"
                        className="flex-shrink-0 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPromptType(session.type === 'consultation' || session.type === 'normal' ? 'assistenza' : 'custom');
                          setShowSystemPromptDialog(true);
                        }}
                        title="Vedi System Prompt"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button
                        className={`flex-1 bg-gradient-to-br ${session.color} hover:opacity-90 text-white border-0`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSessionClick(session.type);
                        }}
                        disabled={session.type === 'custom' || (checkingAccess && session.type === 'consultation')}
                      >
                        {session.type === 'custom' 
                          ? 'In arrivo' 
                          : checkingAccess && session.type === 'consultation' 
                            ? 'Verifica accesso...' 
                            : 'Avvia Sessione'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8 text-white/50 text-sm"
        >
          💡 Tutte le sessioni includono i tuoi dati personalizzati (finanza, esercizi, documenti)
        </motion.div>
      </div>

      {/* Dialog info consulenza con countdown */}
      <Dialog open={showConsultationDialog} onOpenChange={setShowConsultationDialog}>
        <DialogContent className="bg-gradient-to-br from-purple-900/95 to-pink-900/95 border-purple-500/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Calendar className="h-6 w-6 text-purple-300" />
              Consulenza Settimanale AI
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {consultationInfo?.canAccess 
                ? '✅ Puoi accedere alla consulenza ora'
                : consultationInfo?.reason === 'no_scheduled_consultation' 
                  ? 'Nessuna consulenza disponibile al momento'
                  : 'La tua prossima consulenza AI è programmata'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Prossime consulenze disponibili */}
            {upcomingConsultations.length > 0 && (
              <div className="bg-white/10 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-purple-200 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Prossime Consulenze Programmate
                </h3>
                {upcomingConsultations.slice(0, 3).map((consultation) => (
                  <div
                    key={consultation.id}
                    className="bg-white/5 rounded-lg p-3 flex items-start gap-3"
                  >
                    <Clock className="h-5 w-5 text-purple-300 flex-shrink-0 mt-0.5" />
                    <div className="flex-grow">
                      <p className="text-white font-semibold text-sm">
                        {new Date(consultation.scheduledFor).toLocaleString('it-IT', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p className="text-white/60 text-xs mt-1">
                        Durata: {consultation.maxDurationMinutes} minuti
                      </p>
                      {consultation.isTestMode && (
                        <span className="inline-block mt-1 text-xs bg-green-500/20 border border-green-500/30 rounded px-2 py-0.5 text-green-200">
                          🧪 Test Mode
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info countdown per consulenza non ancora accessibile */}
            {!consultationInfo?.canAccess && consultationInfo?.nextScheduled && consultationInfo?.timeUntil && (
              <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4 text-center">
                <p className="text-sm text-white/70 mb-2">⏰ Prossima consulenza tra</p>
                <p className="text-3xl font-bold text-purple-200">
                  {consultationInfo.timeUntil}
                </p>
                <p className="text-xs text-white/50 mt-2">
                  {new Date(consultationInfo.nextScheduled).toLocaleString('it-IT', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}

            {/* Messaggio informativo */}
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-white/90 text-sm">
                {consultationInfo?.message || 'Le consulenze AI sono sessioni programmate della durata di 90 minuti.'}
              </p>
            </div>

            {/* Badge modalità test */}
            {consultationInfo?.reason === 'test_mode' && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 text-center">
                <p className="text-sm text-green-200">
                  🧪 Modalità test attiva - Accesso sempre disponibile
                </p>
              </div>
            )}

            {/* Nessuna consulenza programmata */}
            {upcomingConsultations.length === 0 && consultationInfo?.reason === 'no_scheduled_consultation' && (
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <Calendar className="h-12 w-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-sm">
                  Non ci sono consulenze programmate al momento.
                  <br />
                  Contatta il tuo consulente per pianificarne una.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => setShowConsultationDialog(false)}
            >
              Chiudi
            </Button>
            {consultationInfo?.canAccess && (
              <Button
                className="flex-1 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20"
                onClick={() => {
                  setShowConsultationDialog(false);
                  onSelectType('consultation', useFullPrompt, voiceName);
                }}
              >
                🎙️ Entra nella Consulenza
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog System Prompt */}
      <Dialog open={showSystemPromptDialog} onOpenChange={setShowSystemPromptDialog}>
        <DialogContent className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 text-white max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Info className="h-6 w-6 text-blue-400" />
              System Prompt - {selectedPromptType === 'assistenza' ? 'Assistenza' : selectedPromptType === 'consulente' ? 'Consulente' : 'Custom'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Questo è il prompt di sistema che guida il comportamento dell'AI durante la conversazione vocale
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[500px] pr-4">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono leading-relaxed">
                {getSystemPrompt(selectedPromptType, selectedConsultantType)}
              </pre>
            </div>
          </ScrollArea>

          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => setShowSystemPromptDialog(false)}
            >
              Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
