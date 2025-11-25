import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Save,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  Upload,
  FileText,
  Menu,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

interface SalesAgent {
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
  nonTargetClient: string | null;
  whatWeDo: string | null;
  howWeDoIt: string | null;
  yearsExperience: number;
  clientsHelped: number;
  resultsGenerated: string | null;
  softwareCreated: Array<{emoji: string; name: string; description: string}>;
  booksPublished: Array<{title: string; year: string}>;
  caseStudies: Array<{client: string; result: string}>;
  servicesOffered: Array<{name: string; description: string; price: string}>;
  guarantees: string | null;
  enableDiscovery: boolean;
  enableDemo: boolean;
  enablePayment: boolean;
  isActive: boolean;
  shareToken: string;
  createdAt: string;
}

interface MagicButtonState {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  progress: number;
  currentStep: string;
  extractedData: any | null;
}

export default function ClientSalesAgentConfig() {
  const { agentId } = useParams<{ agentId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isNew = agentId === 'new';

  const [magicButton, setMagicButton] = useState<MagicButtonState>({
    isLoading: false,
    isSuccess: false,
    isError: false,
    progress: 0,
    currentStep: '',
    extractedData: null,
  });

  const [formData, setFormData] = useState<Partial<SalesAgent>>({
    agentName: '',
    displayName: '',
    businessName: '',
    businessDescription: '',
    consultantBio: '',
    vision: '',
    mission: '',
    values: [],
    usp: '',
    targetClient: '',
    nonTargetClient: '',
    whatWeDo: '',
    howWeDoIt: '',
    yearsExperience: 0,
    clientsHelped: 0,
    resultsGenerated: '',
    softwareCreated: [],
    booksPublished: [],
    caseStudies: [],
    servicesOffered: [],
    guarantees: '',
    enableDiscovery: true,
    enableDemo: true,
    enablePayment: false,
    isActive: true,
  });

  const { data: agent, isLoading } = useQuery<SalesAgent>({
    queryKey: ['/api/client/sales-agent/config', agentId],
    queryFn: async () => {
      if (isNew) return null as any;
      const response = await fetch(`/api/client/sales-agent/config/${agentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch agent');
      return response.json();
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (agent) {
      setFormData(agent);
    }
  }, [agent]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SalesAgent>) => {
      const url = isNew
        ? '/api/client/sales-agent/config'
        : `/api/client/sales-agent/config/${agentId}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to save agent');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/sales-agent/config'] });
      toast({
        title: '✅ Agente salvato!',
        description: isNew ? 'L\'agente è stato creato con successo' : 'Le modifiche sono state salvate',
      });
      if (isNew) {
        setLocation(`/client/sales-agents/${data.id}`);
      }
    },
    onError: () => {
      toast({
        title: '❌ Errore',
        description: 'Impossibile salvare l\'agente',
        variant: 'destructive',
      });
    },
  });

  const handleMagicButton = async () => {
    setMagicButton({
      isLoading: true,
      isSuccess: false,
      isError: false,
      progress: 0,
      currentStep: 'Inizializzazione...',
      extractedData: null,
    });

    const steps = [
      { progress: 20, step: '📋 Analizzando consulenze...' },
      { progress: 40, step: '🎯 Raccogliendo esercizi...' },
      { progress: 60, step: '💰 Estraendo dati finanziari...' },
      { progress: 80, step: '📚 Scansionando documenti...' },
      { progress: 90, step: '🤖 Elaborazione AI...' },
    ];

    for (const { progress, step } of steps) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setMagicButton(prev => ({ ...prev, progress, currentStep: step }));
    }

    try {
      const response = await fetch(`/api/client/sales-agent/config/${agentId}/generate-context`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Failed to generate context');

      const result = await response.json();

      setMagicButton({
        isLoading: false,
        isSuccess: true,
        isError: false,
        progress: 100,
        currentStep: 'Completato!',
        extractedData: result.context,
      });

      toast({
        title: '✨ Magic Button completato!',
        description: 'I dati sono stati estratti con successo. Clicca "Applica" per usarli.',
      });
    } catch (error) {
      setMagicButton({
        isLoading: false,
        isSuccess: false,
        isError: true,
        progress: 0,
        currentStep: '',
        extractedData: null,
      });

      toast({
        title: '❌ Errore',
        description: 'Impossibile estrarre i dati. Riprova.',
        variant: 'destructive',
      });
    }
  };

  const handleApplyMagicData = () => {
    if (!magicButton.extractedData) return;

    setFormData(prev => ({
      ...prev,
      ...magicButton.extractedData,
    }));

    setMagicButton(prev => ({ ...prev, isSuccess: false, extractedData: null }));

    toast({
      title: '✅ Dati applicati!',
      description: 'I suggerimenti sono stati applicati al form. Rivedi e salva.',
    });
  };

  const handleSave = () => {
    if (!formData.agentName || !formData.businessName || !formData.displayName) {
      toast({
        title: '⚠️ Campi obbligatori',
        description: 'Compila almeno Nome Agente, Nome Business e Nome Display',
        variant: 'destructive',
      });
      return;
    }

    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 overflow-y-auto bg-transparent">
          {/* Header with menu button */}
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 md:px-8 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/client/sales-agents')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Sales Agents
              </Button>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                {isNew ? 'Nuovo Agente' : agent?.agentName || 'Configura Agente'}
              </h1>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-5xl mx-auto p-4 sm:p-8">

        {/* Magic Button Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
            <Alert className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30 dark:border-purple-500/50">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <AlertDescription>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">
                      ✨ Magic Button - Auto-compilazione AI
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {isNew 
                        ? 'Estrai automaticamente i dati dal tuo profilo consulente per iniziare velocemente'
                        : 'Estrai automaticamente i dati del tuo business dalle consulenze, esercizi e documenti'}
                    </p>

                    {magicButton.isLoading && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {magicButton.currentStep}
                          </span>
                        </div>
                        <Progress value={magicButton.progress} className="h-2" />
                      </div>
                    )}

                    {magicButton.isSuccess && (
                      <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Dati estratti! Clicca "Applica" per usarli
                        </span>
                      </div>
                    )}

                    {magicButton.isError && (
                      <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">Errore durante l'estrazione</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {magicButton.isSuccess ? (
                      <Button
                        onClick={handleApplyMagicData}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Applica
                      </Button>
                    ) : (
                      <Button
                        onClick={handleMagicButton}
                        disabled={magicButton.isLoading}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      >
                        {magicButton.isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Estrazione...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Avvia Magic Button
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
        </motion.div>

        {/* SEZIONE 1: Info Business */}
        <Card className="bg-white dark:bg-gray-800 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-sm font-bold">
                1
              </span>
              Info Business
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="agentName">Nome Agente *</Label>
                <Input
                  id="agentName"
                  placeholder="es: AI Venditore Pro"
                  value={formData.agentName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, agentName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="businessName">Nome Business *</Label>
                <Input
                  id="businessName"
                  placeholder="es: Momentum Coaching"
                  value={formData.businessName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="displayName">Nome Display *</Label>
                <Input
                  id="displayName"
                  placeholder="es: Marco Rossi"
                  value={formData.displayName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="businessDescription">Descrizione Business</Label>
              <Textarea
                id="businessDescription"
                placeholder="Cosa fa il tuo business in 2-3 frasi..."
                rows={3}
                value={formData.businessDescription || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, businessDescription: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="consultantBio">Bio Consulente</Label>
              <Textarea
                id="consultantBio"
                placeholder="La tua presentazione professionale..."
                rows={4}
                value={formData.consultantBio || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, consultantBio: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* SEZIONE 2: Authority & Posizionamento */}
        <Card className="bg-white dark:bg-gray-800 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 text-sm font-bold">
                2
              </span>
              Authority & Posizionamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vision">Vision</Label>
              <Textarea
                id="vision"
                placeholder="Dove vuole arrivare il business nel futuro..."
                rows={2}
                value={formData.vision || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, vision: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="mission">Mission</Label>
              <Textarea
                id="mission"
                placeholder="Perché esiste il business, quale problema risolve..."
                rows={2}
                value={formData.mission || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, mission: e.target.value }))}
              />
            </div>

            <div>
              <Label>Valori (chips)</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.values?.map((value, idx) => (
                  <Badge key={idx} variant="secondary" className="px-3 py-1">
                    {value}
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        values: prev.values?.filter((_, i) => i !== idx) || []
                      }))}
                      className="ml-2 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="es: Integrità"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      e.preventDefault();
                      setFormData(prev => ({
                        ...prev,
                        values: [...(prev.values || []), e.currentTarget.value.trim()]
                      }));
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <Button variant="outline" size="sm" onClick={(e) => {
                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                  if (input.value.trim()) {
                    setFormData(prev => ({
                      ...prev,
                      values: [...(prev.values || []), input.value.trim()]
                    }));
                    input.value = '';
                  }
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="usp">USP - Unique Selling Proposition</Label>
              <Textarea
                id="usp"
                placeholder="Cosa ti rende unico rispetto ai competitor..."
                rows={2}
                value={formData.usp || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, usp: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="targetClient">Chi Aiutiamo</Label>
                <Textarea
                  id="targetClient"
                  placeholder="Il cliente ideale..."
                  rows={3}
                  value={formData.targetClient || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetClient: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="nonTargetClient">Chi NON Aiutiamo</Label>
                <Textarea
                  id="nonTargetClient"
                  placeholder="Chi non è il target..."
                  rows={3}
                  value={formData.nonTargetClient || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, nonTargetClient: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="whatWeDo">Cosa Facciamo</Label>
                <Textarea
                  id="whatWeDo"
                  placeholder="Servizi principali offerti..."
                  rows={3}
                  value={formData.whatWeDo || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatWeDo: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="howWeDoIt">Come Lo Facciamo</Label>
                <Textarea
                  id="howWeDoIt"
                  placeholder="Il metodo/processo utilizzato..."
                  rows={3}
                  value={formData.howWeDoIt || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, howWeDoIt: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SEZIONE 3: Credenziali & Risultati */}
        <Card className="bg-white dark:bg-gray-800 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 text-sm font-bold">
                3
              </span>
              Credenziali & Risultati
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="yearsExperience">Anni Esperienza</Label>
                <Input
                  id="yearsExperience"
                  type="number"
                  min="0"
                  value={formData.yearsExperience || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, yearsExperience: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="clientsHelped">Clienti Aiutati</Label>
                <Input
                  id="clientsHelped"
                  type="number"
                  min="0"
                  value={formData.clientsHelped || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientsHelped: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="resultsGenerated">Risultati Generati</Label>
                <Input
                  id="resultsGenerated"
                  placeholder="es: €10M+ fatturato"
                  value={formData.resultsGenerated || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, resultsGenerated: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            <div>
              <Label>Software Creati</Label>
              <div className="space-y-2 mb-3">
                {formData.softwareCreated?.map((sw, idx) => (
                  <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <Input
                      placeholder="Emoji"
                      className="w-16"
                      value={sw.emoji}
                      onChange={(e) => {
                        const updated = [...(formData.softwareCreated || [])];
                        updated[idx] = { ...updated[idx], emoji: e.target.value };
                        setFormData(prev => ({ ...prev, softwareCreated: updated }));
                      }}
                    />
                    <Input
                      placeholder="Nome software"
                      value={sw.name}
                      onChange={(e) => {
                        const updated = [...(formData.softwareCreated || [])];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setFormData(prev => ({ ...prev, softwareCreated: updated }));
                      }}
                    />
                    <Input
                      placeholder="Descrizione"
                      className="flex-1"
                      value={sw.description}
                      onChange={(e) => {
                        const updated = [...(formData.softwareCreated || [])];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setFormData(prev => ({ ...prev, softwareCreated: updated }));
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        softwareCreated: prev.softwareCreated?.filter((_, i) => i !== idx) || []
                      }))}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  softwareCreated: [...(prev.softwareCreated || []), { emoji: '💻', name: '', description: '' }]
                }))}
              >
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Software
              </Button>
            </div>

            <div>
              <Label>Libri Pubblicati</Label>
              <div className="space-y-2 mb-3">
                {formData.booksPublished?.map((book, idx) => (
                  <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <Input
                      placeholder="Titolo libro"
                      className="flex-1"
                      value={book.title}
                      onChange={(e) => {
                        const updated = [...(formData.booksPublished || [])];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setFormData(prev => ({ ...prev, booksPublished: updated }));
                      }}
                    />
                    <Input
                      placeholder="Anno"
                      className="w-24"
                      value={book.year}
                      onChange={(e) => {
                        const updated = [...(formData.booksPublished || [])];
                        updated[idx] = { ...updated[idx], year: e.target.value };
                        setFormData(prev => ({ ...prev, booksPublished: updated }));
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        booksPublished: prev.booksPublished?.filter((_, i) => i !== idx) || []
                      }))}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  booksPublished: [...(prev.booksPublished || []), { title: '', year: '' }]
                }))}
              >
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Libro
              </Button>
            </div>

            <div>
              <Label>Case Studies</Label>
              <div className="space-y-2 mb-3">
                {formData.caseStudies?.map((cs, idx) => (
                  <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <Input
                      placeholder="Nome cliente"
                      value={cs.client}
                      onChange={(e) => {
                        const updated = [...(formData.caseStudies || [])];
                        updated[idx] = { ...updated[idx], client: e.target.value };
                        setFormData(prev => ({ ...prev, caseStudies: updated }));
                      }}
                    />
                    <Input
                      placeholder="Risultato ottenuto"
                      className="flex-1"
                      value={cs.result}
                      onChange={(e) => {
                        const updated = [...(formData.caseStudies || [])];
                        updated[idx] = { ...updated[idx], result: e.target.value };
                        setFormData(prev => ({ ...prev, caseStudies: updated }));
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        caseStudies: prev.caseStudies?.filter((_, i) => i !== idx) || []
                      }))}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  caseStudies: [...(prev.caseStudies || []), { client: '', result: '' }]
                }))}
              >
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Case Study
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* SEZIONE 4: Servizi & Garanzie */}
        <Card className="bg-white dark:bg-gray-800 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 text-sm font-bold">
                4
              </span>
              Servizi & Garanzie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Servizi Offerti</Label>
              <div className="space-y-3 mb-3">
                {formData.servicesOffered?.map((service, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome servizio"
                        value={service.name}
                        onChange={(e) => {
                          const updated = [...(formData.servicesOffered || [])];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          setFormData(prev => ({ ...prev, servicesOffered: updated }));
                        }}
                      />
                      <Input
                        placeholder="Prezzo (es: €5.000)"
                        className="w-32"
                        value={service.price}
                        onChange={(e) => {
                          const updated = [...(formData.servicesOffered || [])];
                          updated[idx] = { ...updated[idx], price: e.target.value };
                          setFormData(prev => ({ ...prev, servicesOffered: updated }));
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          servicesOffered: prev.servicesOffered?.filter((_, i) => i !== idx) || []
                        }))}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Descrizione servizio"
                      rows={2}
                      value={service.description}
                      onChange={(e) => {
                        const updated = [...(formData.servicesOffered || [])];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setFormData(prev => ({ ...prev, servicesOffered: updated }));
                      }}
                    />
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  servicesOffered: [...(prev.servicesOffered || []), { name: '', description: '', price: '' }]
                }))}
              >
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Servizio
              </Button>
            </div>

            <div>
              <Label htmlFor="guarantees">Garanzie</Label>
              <Textarea
                id="guarantees"
                placeholder="Le garanzie che offri ai tuoi clienti..."
                rows={4}
                value={formData.guarantees || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, guarantees: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* SEZIONE 5: Modalità Venditore */}
        <Card className="bg-white dark:bg-gray-800 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400 text-sm font-bold">
                5
              </span>
              Modalità Venditore
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Checkbox
                  id="enableDiscovery"
                  checked={formData.enableDiscovery || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableDiscovery: checked as boolean }))}
                />
                <div className="flex-1">
                  <Label htmlFor="enableDiscovery" className="text-base font-semibold cursor-pointer">
                    Discovery Call
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Abilita la fase di scoperta per raccogliere informazioni sul prospect (business, situazione, pain points, budget, urgency)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Checkbox
                  id="enableDemo"
                  checked={formData.enableDemo || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableDemo: checked as boolean }))}
                />
                <div className="flex-1">
                  <Label htmlFor="enableDemo" className="text-base font-semibold cursor-pointer">
                    Demo & Presentazione
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Presenta i tuoi servizi, case studies, value stack e gestisci obiezioni comuni
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Checkbox
                  id="enablePayment"
                  checked={formData.enablePayment || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enablePayment: checked as boolean }))}
                />
                <div className="flex-1">
                  <Label htmlFor="enablePayment" className="text-base font-semibold cursor-pointer">
                    Payment & Chiusura
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Gestisci il processo di pagamento e finalizza la vendita (Coming Soon)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SEZIONE 6: Knowledge Base */}
        <Card className="bg-white dark:bg-gray-800 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-400 text-sm font-bold">
                6
              </span>
              Knowledge Base
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Upload di file e gestione knowledge base - Coming Soon
              </p>
              <Button variant="outline" disabled>
                <Upload className="h-4 w-4 mr-2" />
                Carica File
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setLocation('/client/sales-agents')}
          >
            <X className="h-4 w-4 mr-2" />
            Annulla
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              Salva Bozza
            </Button>
            <Button
              size="lg"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salva e Genera Link
                </>
              )}
            </Button>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
