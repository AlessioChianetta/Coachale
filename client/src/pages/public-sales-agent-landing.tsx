import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { motion } from 'framer-motion';
import {
  Bot,
  CheckCircle,
  Star,
  Users,
  TrendingUp,
  Award,
  MessageSquare,
  Sparkles,
  Mail,
  Phone,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface PublicAgentData {
  id: string;
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
  yearsExperience: number;
  clientsHelped: number;
  resultsGenerated: string | null;
  softwareCreated: Array<{emoji: string; name: string; description: string}>;
  caseStudies: Array<{client: string; result: string}>;
  servicesOffered: Array<{name: string; description: string; price: string}>;
  guarantees: string | null;
  enableDiscovery: boolean;
  enableDemo: boolean;
  isActive: boolean;
}

export default function PublicSalesAgentLanding() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { toast } = useToast();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const { data: agent, isLoading, error } = useQuery<PublicAgentData>({
    queryKey: ['/public/sales-agent', shareToken],
    queryFn: async () => {
      const response = await fetch(`/api/public/sales-agent/${shareToken}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Agent not found');
        throw new Error('Failed to fetch agent');
      }
      return response.json();
    },
  });

  const handleStartConsultation = () => {
    setShowNameDialog(true);
  };

  const handleStartWithName = async () => {
    if (!prospectName.trim()) return;
    
    setIsCreatingSession(true);

    try {
      // POST /api/public/sales-agent/:shareToken/session
      const response = await fetch(`/api/public/sales-agent/${shareToken}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prospectName: prospectName.trim(),
          prospectEmail: prospectEmail.trim() || undefined,
          prospectPhone: prospectPhone.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(errorData.error || 'Impossibile creare la sessione');
      }

      const { sessionToken, conversationId } = await response.json();

      // Salva sessionToken e conversationId in sessionStorage
      sessionStorage.setItem('salesAgent_sessionToken', sessionToken);
      sessionStorage.setItem('salesAgent_conversationId', conversationId);
      sessionStorage.setItem('salesAgent_shareToken', shareToken || '');

      // Redirect a Live Mode
      window.location.href = `/live-consultation?mode=sales_agent&shareToken=${shareToken}`;
    } catch (error) {
      console.error('Errore creazione sessione:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: error instanceof Error ? error.message : 'Impossibile avviare la conversazione. Riprova.',
      });
      setIsCreatingSession(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-16 w-16 text-blue-500 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-lg">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <Card className="bg-white/10 border-white/20 max-w-md">
          <CardContent className="p-12 text-center">
            <Bot className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Agente Non Trovato</h2>
            <p className="text-white/70">
              L'agente di vendita richiesto non esiste o non è più attivo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!agent.isActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <Card className="bg-white/10 border-white/20 max-w-md">
          <CardContent className="p-12 text-center">
            <Bot className="h-16 w-16 text-orange-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Agente Non Disponibile</h2>
            <p className="text-white/70">
              Questo agente di vendita è temporaneamente non disponibile.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 shadow-xl mb-6">
              <Bot className="h-12 w-12 text-white" />
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4">
              {agent.businessName}
            </h1>
            
            <p className="text-xl sm:text-2xl text-white/80 mb-2">
              con {agent.displayName}
            </p>

            {agent.businessDescription && (
              <p className="text-lg text-white/70 max-w-3xl mx-auto mb-8">
                {agent.businessDescription}
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {agent.yearsExperience > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                  <Award className="h-5 w-5 text-blue-400" />
                  <span className="text-white font-medium">{agent.yearsExperience}+ anni di esperienza</span>
                </div>
              )}
              {agent.clientsHelped > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                  <Users className="h-5 w-5 text-green-400" />
                  <span className="text-white font-medium">{agent.clientsHelped}+ clienti aiutati</span>
                </div>
              )}
              {agent.resultsGenerated && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                  <span className="text-white font-medium">{agent.resultsGenerated}</span>
                </div>
              )}
            </div>

            <Button
              size="lg"
              onClick={handleStartConsultation}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-6 text-xl shadow-2xl hover:shadow-blue-500/50 transition-all duration-300"
            >
              <MessageSquare className="h-6 w-6 mr-3" />
              Inizia Consulenza Gratuita
            </Button>
          </motion.div>

          {/* What We Do */}
          {agent.whatWeDo && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-4xl mx-auto mb-12"
            >
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardContent className="p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-blue-400" />
                    Cosa Facciamo
                  </h2>
                  <p className="text-white/80 text-lg whitespace-pre-wrap">{agent.whatWeDo}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Values */}
          {agent.values && agent.values.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-4xl mx-auto mb-12"
            >
              <h3 className="text-xl font-bold text-white mb-4 text-center">I Nostri Valori</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {agent.values.map((value, idx) => (
                  <div
                    key={idx}
                    className="px-6 py-3 bg-white/10 rounded-full border border-white/20 backdrop-blur-sm"
                  >
                    <span className="text-white font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Credibility Section */}
      <div className="bg-gray-900/50 border-y border-white/10 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Perché Sceglierci
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Software Created */}
            {agent.softwareCreated && agent.softwareCreated.length > 0 && agent.softwareCreated.map((sw, idx) => (
              <Card key={idx} className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all">
                <CardContent className="p-6">
                  <div className="text-4xl mb-3">{sw.emoji}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{sw.name}</h3>
                  <p className="text-white/70 text-sm">{sw.description}</p>
                </CardContent>
              </Card>
            ))}

            {/* Case Studies */}
            {agent.caseStudies && agent.caseStudies.length > 0 && agent.caseStudies.map((cs, idx) => (
              <Card key={idx} className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="h-5 w-5 text-yellow-400" />
                    <h3 className="text-lg font-bold text-white">{cs.client}</h3>
                  </div>
                  <p className="text-green-400 font-semibold">{cs.result}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* USP */}
          {agent.usp && (
            <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/30 backdrop-blur-sm mt-12">
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold text-white mb-4">
                  Cosa Ci Rende Unici
                </h3>
                <p className="text-white/90 text-lg max-w-3xl mx-auto whitespace-pre-wrap">
                  {agent.usp}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Services Section */}
      {agent.servicesOffered && agent.servicesOffered.length > 0 && (
        <div className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-8">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              I Nostri Servizi
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agent.servicesOffered.map((service, idx) => (
                <Card key={idx} className="bg-white/5 border-white/10 backdrop-blur-sm">
                  <CardContent className="p-8">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-2xl font-bold text-white">{service.name}</h3>
                      {service.price && (
                        <span className="text-2xl font-bold text-blue-400">{service.price}</span>
                      )}
                    </div>
                    <p className="text-white/70 mb-6">{service.description}</p>
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Disponibile</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Guarantees */}
      {agent.guarantees && (
        <div className="bg-gray-900/50 border-y border-white/10 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-8">
            <Card className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-green-500/30 backdrop-blur-sm">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                  Le Nostre Garanzie
                </h3>
                <p className="text-white/90 text-lg whitespace-pre-wrap">{agent.guarantees}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Final CTA */}
      <div className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Pronto a Iniziare?
          </h2>
          <p className="text-xl text-white/70 mb-8">
            Parla gratuitamente con il nostro assistente AI e scopri come possiamo aiutarti
          </p>
          <Button
            size="lg"
            onClick={handleStartConsultation}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-6 text-xl shadow-2xl hover:shadow-blue-500/50 transition-all duration-300"
          >
            <MessageSquare className="h-6 w-6 mr-3" />
            Inizia Consulenza Gratuita
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 text-center">
          <p className="text-white/50 text-sm">
            Powered by {agent.businessName} • {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* Name Collection Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="bg-gradient-to-br from-gray-900 to-gray-800 border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Inizia la Tua Consulenza</DialogTitle>
            <DialogDescription className="text-white/70">
              Compila i tuoi dati per iniziare la conversazione
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="prospectName" className="text-white flex items-center gap-2">
                <span className="text-red-400">*</span>
                Il Tuo Nome
              </Label>
              <Input
                id="prospectName"
                placeholder="es: Marco Rossi"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 mt-1"
                disabled={isCreatingSession}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && prospectName.trim() && !isCreatingSession) {
                    handleStartWithName();
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="prospectEmail" className="text-white flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email (opzionale)
              </Label>
              <Input
                id="prospectEmail"
                type="email"
                placeholder="es: marco@example.com"
                value={prospectEmail}
                onChange={(e) => setProspectEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 mt-1"
                disabled={isCreatingSession}
              />
            </div>
            <div>
              <Label htmlFor="prospectPhone" className="text-white flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefono (opzionale)
              </Label>
              <Input
                id="prospectPhone"
                type="tel"
                placeholder="es: +39 123 456 7890"
                value={prospectPhone}
                onChange={(e) => setProspectPhone(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 mt-1"
                disabled={isCreatingSession}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowNameDialog(false)}
              disabled={isCreatingSession}
              className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Annulla
            </Button>
            <Button
              onClick={handleStartWithName}
              disabled={!prospectName.trim() || isCreatingSession}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isCreatingSession ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Connessione...
                </>
              ) : (
                <>
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Inizia Conversazione
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
