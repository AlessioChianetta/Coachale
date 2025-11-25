import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Bot,
  MessageSquare,
  Target,
  Mic2,
  ArrowRight,
  Sparkles,
  Clock,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

  const handleMicPermissionGranted = () => {
    setMicPermissionGranted(true);
    toast({
      title: '✅ Microfono configurato',
      description: 'Puoi ora entrare nella sessione',
      duration: 3000,
    });
  };

  const handleMicPermissionDenied = () => {
    setMicPermissionGranted(false);
    toast({
      variant: 'destructive',
      title: '❌ Permesso microfono negato',
      description: 'Devi abilitare il microfono per continuare',
      duration: 5000,
    });
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
    
    // Save preferences to localStorage (already done in useEffect above)
    // Navigate to live consultation with sessionType parameter
    const params = new URLSearchParams({
      sessionType: sessionType,
      voice: voiceName,
      fullPrompt: String(useFullPrompt),
    });
    
    navigate(`/live-consultation?${params.toString()}`);
  };

  const sessionInfo = sessionType === 'consultation' ? {
    title: 'Sessione Consulenza',
    subtitle: 'Consulenza settimanale programmata',
    description: 'Questa è una sessione di consulenza AI strutturata della durata massima di 1.5 ore. La trascrizione completa verrà salvata automaticamente.',
    icon: Target,
    color: 'from-purple-500 to-pink-500',
    features: [
      { icon: Calendar, text: 'Programmata ogni martedì ore 15:00' },
      { icon: Clock, text: 'Durata massima: 1 ora e mezza' },
      { icon: Sparkles, text: 'Trascrizione completa salvata' },
    ],
  } : {
    title: 'Sessione Normale',
    subtitle: 'Chat libera senza struttura',
    description: 'Questa è una sessione di conversazione libera con l\'AI. Nessuna struttura predefinita, risposte immediate.',
    icon: MessageSquare,
    color: 'from-blue-500 to-cyan-500',
    features: [
      { icon: MessageSquare, text: 'Conversazione libera' },
      { icon: Sparkles, text: 'Risposte immediate' },
      { icon: CheckCircle2, text: 'Nessuna struttura predefinita' },
    ],
  };

  const Icon = sessionInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container max-w-5xl mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br ${sessionInfo.color} rounded-full mb-4 shadow-xl`}
            >
              <Icon className="w-10 h-10 text-white" />
            </motion.div>
            
            <h1 className={`text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${sessionInfo.color}`}>
              {sessionInfo.title}
            </h1>
            
            <p className="text-xl text-muted-foreground">
              {sessionInfo.subtitle}
            </p>

            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              {sessionInfo.description}
            </p>
          </div>

          {/* Features */}
          <div className="grid gap-4 md:grid-cols-3">
            {sessionInfo.features.map((feature, index) => {
              const FeatureIcon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <Card className="h-full">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <FeatureIcon className={`w-6 h-6 bg-gradient-to-br ${sessionInfo.color} bg-clip-text text-transparent flex-shrink-0 mt-0.5`} />
                        <p className="text-sm text-muted-foreground">{feature.text}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Configurazione AI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Voice Selector */}
                <div className="space-y-2">
                  <Label htmlFor="voice-select" className="flex items-center gap-2">
                    <Mic2 className="w-4 h-4" />
                    Voce AI
                  </Label>
                  <Select value={voiceName} onValueChange={setVoiceName}>
                    <SelectTrigger id="voice-select">
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
                  <p className="text-xs text-muted-foreground">
                    Scegli la voce che l'AI userà durante la conversazione
                  </p>
                </div>

                {/* Full Prompt Toggle */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="full-prompt" className="text-base font-medium">
                      Prompt Completo
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Usa il prompt completo per risposte più dettagliate e contestualizzate
                    </p>
                  </div>
                  <Switch
                    id="full-prompt"
                    checked={useFullPrompt}
                    onCheckedChange={setUseFullPrompt}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Microphone Test */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <MicrophoneTest
              onPermissionGranted={handleMicPermissionGranted}
              onPermissionDenied={handleMicPermissionDenied}
            />
          </motion.div>

          {/* Enter Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col items-center gap-4"
          >
            <Button
              size="lg"
              onClick={handleEnterSession}
              disabled={!micPermissionGranted || isEntering}
              className={`w-full md:w-auto px-12 py-6 text-lg font-semibold bg-gradient-to-r ${sessionInfo.color} hover:opacity-90 text-white shadow-xl disabled:opacity-50`}
            >
              {isEntering ? (
                <>
                  Caricamento...
                </>
              ) : (
                <>
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Entra nella Sessione
                </>
              )}
            </Button>
            
            {!micPermissionGranted && (
              <p className="text-sm text-muted-foreground text-center">
                ⚠️ Completa il test del microfono per continuare
              </p>
            )}

            <Button
              variant="ghost"
              onClick={() => navigate('/ai-assistant')}
              className="text-muted-foreground hover:text-foreground"
            >
              ← Torna indietro
            </Button>
          </motion.div>

          {/* Footer Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center mt-8"
          >
            <p className="text-sm text-muted-foreground">
              💡 La sessione include i tuoi dati personalizzati (finanza, esercizi, documenti)
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
