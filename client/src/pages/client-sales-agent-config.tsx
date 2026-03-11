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
  Download,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAuthHeaders, getAuthUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { BrandVoiceSection, type BrandVoiceData } from '@/components/brand-voice/BrandVoiceSection';

interface SalesAgent {
  id: string;
  agentName: string;
  displayName: string;
  businessName: string;
  businessDescription: string | null;
  consultantBio: string | null;
  voiceName: string | null;
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
  brandVoiceData: Record<string, any> | null;
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

const AVAILABLE_VOICES = [
  { value: 'achernar', label: 'Achernar', description: '🇮🇹 Femminile Professionale' },
  { value: 'Puck', label: 'Puck', description: 'Default Gemini - Voce neutra' },
  { value: 'Charon', label: 'Charon', description: 'Voce maschile profonda' },
  { value: 'Kore', label: 'Kore', description: 'Voce femminile naturale' },
  { value: 'Fenrir', label: 'Fenrir', description: 'Voce maschile energica' },
  { value: 'Aoede', label: 'Aoede', description: 'Voce femminile melodica' },
  { value: 'Leda', label: 'Leda', description: 'Voce femminile chiara' },
  { value: 'Orus', label: 'Orus', description: 'Voce maschile calma' },
  { value: 'Zephyr', label: 'Zephyr', description: 'Voce neutra leggera' },
];

export default function ClientSalesAgentConfig() {
  const { agentId } = useParams<{ agentId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isNew = agentId === 'new';
  const authUser = getAuthUser();
  const isConsultant = authUser?.role === 'consultant';
  const basePath = isConsultant ? '/consultant/sales-agents' : '/client/sales-agents';
  const sidebarRole = isConsultant ? 'consultant' : 'client';

  const [magicButton, setMagicButton] = useState<MagicButtonState>({
    isLoading: false,
    isSuccess: false,
    isError: false,
    progress: 0,
    currentStep: '',
    extractedData: null,
  });

  const [showImportAgentDialog, setShowImportAgentDialog] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isImportingBrandVoice, setIsImportingBrandVoice] = useState(false);

  const [formData, setFormData] = useState<Partial<SalesAgent>>({
    agentName: '',
    displayName: '',
    businessName: '',
    businessDescription: '',
    consultantBio: '',
    voiceName: 'Achernar',
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
        setLocation(`${basePath}/${data.id}`);
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

  const formDataToBrandVoice = (fd: Partial<SalesAgent>): BrandVoiceData => {
    const bv = (fd as any).brandVoiceData || {};
    const str = (a: any, b: any) => (a !== undefined && a !== null ? a : b) ?? '';
    const num = (a: any, b: any) => (a !== undefined && a !== null ? a : b) ?? 0;
    const arr = (a: any, b: any) => (Array.isArray(a) && a.length > 0 ? a : Array.isArray(b) ? b : []);
    return {
      consultantDisplayName: str(fd.displayName, bv.consultantDisplayName),
      businessName: str(fd.businessName, bv.businessName),
      businessDescription: str(fd.businessDescription, bv.businessDescription),
      consultantBio: str(fd.consultantBio, bv.consultantBio),
      vision: str(fd.vision, bv.vision),
      mission: str(fd.mission, bv.mission),
      values: arr(fd.values, bv.values),
      usp: str(fd.usp, bv.usp),
      whoWeHelp: str(fd.targetClient, bv.whoWeHelp),
      whoWeDontHelp: str(fd.nonTargetClient, bv.whoWeDontHelp),
      audienceSegments: arr(bv.audienceSegments, []),
      whatWeDo: str(fd.whatWeDo, bv.whatWeDo),
      howWeDoIt: str(fd.howWeDoIt, bv.howWeDoIt),
      yearsExperience: num(fd.yearsExperience, bv.yearsExperience),
      clientsHelped: num(fd.clientsHelped, bv.clientsHelped),
      resultsGenerated: str(fd.resultsGenerated, bv.resultsGenerated),
      softwareCreated: arr(fd.softwareCreated, bv.softwareCreated),
      booksPublished: arr(fd.booksPublished, bv.booksPublished),
      caseStudies: arr(fd.caseStudies, bv.caseStudies),
      servicesOffered: arr(fd.servicesOffered, bv.servicesOffered),
      guarantees: str(fd.guarantees, bv.guarantees),
      personalTone: str(bv.personalTone, ''),
      contentPersonality: str(bv.contentPersonality, ''),
      audienceLanguage: str(bv.audienceLanguage, ''),
      avoidPatterns: str(bv.avoidPatterns, ''),
      writingExamples: arr(bv.writingExamples, []),
      signaturePhrases: arr(bv.signaturePhrases, []),
    };
  };

  const handleBrandVoiceChange = (bvData: BrandVoiceData) => {
    setFormData(prev => ({
      ...prev,
      displayName: bvData.consultantDisplayName || prev.displayName || '',
      businessName: bvData.businessName || prev.businessName || '',
      businessDescription: bvData.businessDescription || '',
      consultantBio: bvData.consultantBio || '',
      vision: bvData.vision || '',
      mission: bvData.mission || '',
      values: bvData.values || [],
      usp: bvData.usp || '',
      targetClient: bvData.whoWeHelp || '',
      nonTargetClient: bvData.whoWeDontHelp || '',
      whatWeDo: bvData.whatWeDo || '',
      howWeDoIt: bvData.howWeDoIt || '',
      yearsExperience: bvData.yearsExperience || 0,
      clientsHelped: bvData.clientsHelped || 0,
      resultsGenerated: bvData.resultsGenerated || '',
      softwareCreated: bvData.softwareCreated || [],
      booksPublished: bvData.booksPublished || [],
      caseStudies: bvData.caseStudies || [],
      servicesOffered: bvData.servicesOffered || [],
      guarantees: bvData.guarantees || '',
      brandVoiceData: bvData as any,
    }));
  };

  const loadAvailableAgents = async () => {
    try {
      const res = await fetch("/api/whatsapp/agent-chat/agents", { headers: getAuthHeaders() });
      if (res.ok) {
        const response = await res.json();
        setAvailableAgents(response.data || []);
      }
    } catch {}
  };

  const handleImportFromAgent = async () => {
    if (!selectedAgentId) return;
    setIsImportingBrandVoice(true);
    try {
      const res = await fetch(`/api/whatsapp/agents/${selectedAgentId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento agente");
      const agent = await res.json();
      if (agent) {
        const normCaseStudies = (agent.caseStudies || []).map((cs: any) => ({
          client: cs.client || cs.clientName || '',
          result: cs.result || [cs.before, cs.after, cs.timeFrame].filter(Boolean).join(' → ') || '',
        }));
        const normServices = (agent.servicesOffered || []).map((s: any) => ({
          name: s.name || '',
          description: s.description || s.forWho || '',
          price: s.price || s.investment || '',
        }));
        const normSoftware = (agent.softwareCreated || []).map((sw: any) => ({
          emoji: sw.emoji || '💻',
          name: sw.name || '',
          description: sw.description || '',
        }));
        const imported: BrandVoiceData = {
          consultantDisplayName: agent.consultantDisplayName,
          businessName: agent.businessName,
          businessDescription: agent.businessDescription,
          consultantBio: agent.consultantBio,
          vision: agent.vision,
          mission: agent.mission,
          values: agent.values,
          usp: agent.usp,
          whoWeHelp: agent.whoWeHelp,
          whoWeDontHelp: agent.whoWeDontHelp,
          audienceSegments: agent.audienceSegments,
          whatWeDo: agent.whatWeDo,
          howWeDoIt: agent.howWeDoIt,
          yearsExperience: agent.yearsExperience,
          clientsHelped: agent.clientsHelped,
          resultsGenerated: agent.resultsGenerated,
          softwareCreated: normSoftware,
          booksPublished: agent.booksPublished,
          caseStudies: normCaseStudies,
          servicesOffered: normServices,
          guarantees: agent.guarantees,
          personalTone: agent.personalTone,
          contentPersonality: agent.contentPersonality,
          audienceLanguage: agent.audienceLanguage,
          avoidPatterns: agent.avoidPatterns,
          writingExamples: agent.writingExamples,
          signaturePhrases: agent.signaturePhrases,
        };
        handleBrandVoiceChange(imported);
        toast({ title: "Dati importati", description: "Brand Voice importato dall'agente WhatsApp" });
        setShowImportAgentDialog(false);
      }
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsImportingBrandVoice(false);
    }
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
        <Sidebar role={sidebarRole as "client" | "consultant"} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
                onClick={() => setLocation(basePath)}
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
              <div>
                <Label htmlFor="voiceName">Voce Agente</Label>
                <Select
                  value={formData.voiceName || 'achernar'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, voiceName: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona una voce" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_VOICES.map(voice => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500 mt-1">
                  La voce che userà l'agente durante le conversazioni
                </p>
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

        {/* SEZIONE 2-4: Brand Voice (Authority, Credenziali, Servizi) */}
        <BrandVoiceSection
          data={formDataToBrandVoice(formData)}
          onDataChange={handleBrandVoiceChange}
          onSave={handleSave}
          isSaving={saveMutation.isPending}
          showImportButton={true}
          onImportClick={() => {
            loadAvailableAgents();
            setShowImportAgentDialog(true);
          }}
          compact={false}
          showSaveButton={false}
        />

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
            onClick={() => setLocation(basePath)}
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

      <Dialog open={showImportAgentDialog} onOpenChange={setShowImportAgentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Importa Brand Voice da Agente
            </DialogTitle>
            <DialogDescription>
              Seleziona un agente WhatsApp per importare i dati del Brand Voice
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {availableAgents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Nessun agente WhatsApp configurato.</p>
                <p className="text-xs mt-2">Configura prima un agente nella sezione WhatsApp.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {availableAgents.map((agent: any) => (
                  <div
                    key={agent.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedAgentId === agent.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={selectedAgentId === agent.id}
                        onChange={() => setSelectedAgentId(agent.id)}
                        className="h-4 w-4 text-primary"
                      />
                      <div>
                        <p className="font-medium text-sm">{agent.agentName || agent.businessName || "Agente senza nome"}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.businessName || agent.agentType || "Nessuna descrizione"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowImportAgentDialog(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleImportFromAgent}
                disabled={!selectedAgentId || isImportingBrandVoice}
              >
                {isImportingBrandVoice ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importazione...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Importa
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
