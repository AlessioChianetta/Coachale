import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { motion } from 'framer-motion';
import {
  Bot,
  CheckCircle,
  Users,
  TrendingUp,
  Award,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MicrophoneTest } from '@/components/consultation-lobby/MicrophoneTest';

interface InviteData {
  inviteToken: string;
  consultantName: string;
  prospectName: string | null;
  prospectEmail: string | null;
  prospectPhone: string | null;
  status: string;
  agent: {
    agentName: string;
    displayName: string;
    businessName: string;
    businessDescription: string | null;
    consultantBio: string | null;
    vision: string | null;
    mission: string | null;
    values: string[];
    usp: string | null;
    targetClient: string | null;
    whatWeDo: string | null;
    howWeDoIt: string | null;
    yearsExperience: number;
    clientsHelped: number;
    resultsGenerated: string | null;
    servicesOffered: Array<{name: string; description: string; price: string}>;
    guarantees: string | null;
  };
}

export default function ConsultationInviteLobby() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);

  const { data: inviteData, isLoading, error } = useQuery<InviteData>({
    queryKey: ['/public/invite', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/invite/${token}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Invito non trovato');
        if (response.status === 403) throw new Error('Invito revocato');
        if (response.status === 410) throw new Error('Invito scaduto');
        throw new Error('Errore durante il caricamento dell\'invito');
      }
      return response.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (inviteData) {
      setProspectName(inviteData.prospectName || '');
      setProspectEmail(inviteData.prospectEmail || '');
      setProspectPhone(inviteData.prospectPhone || '');
    }
  }, [inviteData]);

  const handleJoinConsultation = async () => {
    const finalName = prospectName.trim();
    const finalEmail = prospectEmail.trim();
    const finalPhone = prospectPhone.trim();

    if (!finalName) {
      toast({
        variant: 'destructive',
        title: 'Nome richiesto',
        description: 'Inserisci il tuo nome per continuare',
      });
      return;
    }

    setIsJoining(true);

    try {
      const response = await fetch(`/api/public/invite/${token}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prospectName: finalName,
          prospectEmail: finalEmail || undefined,
          prospectPhone: finalPhone || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Errore sconosciuto' }));
        throw new Error(errorData.message || 'Impossibile entrare nella consultazione');
      }

      const { sessionToken, conversationId } = await response.json();

      sessionStorage.setItem('consultationInvite_sessionToken', sessionToken);
      sessionStorage.setItem('consultationInvite_conversationId', conversationId);
      sessionStorage.setItem('consultationInvite_token', token || '');

      window.location.href = `/live-consultation?mode=consultation_invite&inviteToken=${token}`;
    } catch (error) {
      console.error('[InviteLobby] Join error:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: error instanceof Error ? error.message : 'Impossibile entrare nella consultazione. Riprova.',
      });
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
            <p className="text-lg text-muted-foreground">Caricamento invito...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold">Invito non valido</h2>
            <p className="text-muted-foreground">
              {error instanceof Error ? error.message : 'Questo link di invito non è più valido.'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const displayName = inviteData.agent.displayName || inviteData.consultantName;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mb-4"
            >
              <Bot className="w-10 h-10 text-white" />
            </motion.div>
            
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
              {displayName} ti sta aspettando
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {inviteData.agent.businessDescription || `Entra nella sala d'attesa per la tua consultazione con ${displayName}`}
            </p>
          </div>

          {inviteData.agent.consultantBio && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Chi sono
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{inviteData.agent.consultantBio}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {inviteData.agent.yearsExperience > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{inviteData.agent.yearsExperience}+</p>
                      <p className="text-sm text-muted-foreground">Anni esperienza</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {inviteData.agent.clientsHelped > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-purple-500" />
                    <div>
                      <p className="text-2xl font-bold">{inviteData.agent.clientsHelped}+</p>
                      <p className="text-sm text-muted-foreground">Clienti serviti</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {inviteData.agent.resultsGenerated && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-sm font-semibold">{inviteData.agent.resultsGenerated}</p>
                      <p className="text-sm text-muted-foreground">Risultati</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>I tuoi dati</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Il tuo nome"
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  disabled={isJoining}
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email (opzionale)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@esempio.it"
                  value={prospectEmail}
                  onChange={(e) => setProspectEmail(e.target.value)}
                  disabled={isJoining}
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Telefono (opzionale)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+39 123 456 7890"
                  value={prospectPhone}
                  onChange={(e) => setProspectPhone(e.target.value)}
                  disabled={isJoining}
                />
              </div>
            </CardContent>
          </Card>

          <MicrophoneTest
            onPermissionGranted={() => setMicPermissionGranted(true)}
            onPermissionDenied={() => setMicPermissionGranted(false)}
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              onClick={handleJoinConsultation}
              disabled={isJoining || !micPermissionGranted}
              size="lg"
              className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Connessione in corso...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Entra nella consultazione
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            
            {!micPermissionGranted && !isJoining && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500 rounded-lg"
              >
                <p className="text-sm text-amber-700 dark:text-amber-300 text-center font-semibold flex items-center justify-center gap-2">
                  <span className="text-2xl">🎤</span>
                  Per continuare, completa il test del microfono sopra
                </p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
