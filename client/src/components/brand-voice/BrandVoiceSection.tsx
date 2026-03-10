import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Target,
  Award,
  Star,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  Download,
  Save,
  Loader2,
  Check,
  MessageSquare,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { MarketResearchSection } from "./MarketResearchSection";
import { type MarketResearchData, EMPTY_MARKET_RESEARCH } from "@shared/schema";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export interface BrandVoiceData {
  consultantDisplayName?: string;
  businessName?: string;
  businessDescription?: string;
  consultantBio?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  usp?: string;
  whoWeHelp?: string;
  whoWeDontHelp?: string;
  audienceSegments?: { name: string; description: string }[];
  whatWeDo?: string;
  howWeDoIt?: string;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string;
  softwareCreated?: { emoji: string; name: string; description: string }[];
  booksPublished?: { title: string; year: string }[];
  caseStudies?: { client: string; result: string }[];
  servicesOffered?: { name: string; price: string; description: string }[];
  guarantees?: string;
  personalTone?: string;
  contentPersonality?: string;
  audienceLanguage?: string;
  avoidPatterns?: string;
  writingExamples?: string[];
  signaturePhrases?: string[];
}

export interface BrandVoiceSectionProps {
  data: BrandVoiceData;
  onDataChange: (data: BrandVoiceData) => void;
  onSave: () => void;
  isSaving?: boolean;
  saveSuccess?: boolean;
  showImportButton?: boolean;
  onImportClick?: () => void;
  compact?: boolean;
  showSaveButton?: boolean;
}

export function BrandVoiceSection({
  data,
  onDataChange,
  onSave,
  isSaving = false,
  saveSuccess = false,
  showImportButton = true,
  onImportClick,
  compact = false,
  showSaveButton = true
}: BrandVoiceSectionProps) {
  const { toast } = useToast();
  const [businessInfoOpen, setBusinessInfoOpen] = useState(!compact);
  const [authorityOpen, setAuthorityOpen] = useState(!compact);
  const [credentialsOpen, setCredentialsOpen] = useState(!compact);
  const [servicesOpen, setServicesOpen] = useState(!compact);
  const [voiceStyleOpen, setVoiceStyleOpen] = useState(!compact);
  const [marketResearchOpen, setMarketResearchOpen] = useState(false);
  const [valueInput, setValueInput] = useState("");
  const [phraseInput, setPhraseInput] = useState("");

  const [mrData, setMrData] = useState<MarketResearchData>({ ...EMPTY_MARKET_RESEARCH });
  const [mrLoaded, setMrLoaded] = useState(false);
  const [mrSaving, setMrSaving] = useState(false);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState<string | null>(null);
  const [showResearchDialog, setShowResearchDialog] = useState(false);
  const [showPhaseConfirmDialog, setShowPhaseConfirmDialog] = useState(false);
  const [pendingPhaseGen, setPendingPhaseGen] = useState<{ phase: string; mode: 'add' | 'overwrite' | null }>({ phase: '', mode: null });
  const [researchProgress, setResearchProgress] = useState<{
    status: string;
    currentStep: number;
    totalSteps: number;
    stepLabel: string;
    stepDetails: string;
    steps: Array<{ label: string; status: string; details: string }>;
    error?: string;
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mrLoaded) return;
    const fetchMR = async () => {
      try {
        const res = await fetch("/api/content/market-research", { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success && json.data && Object.keys(json.data).length > 0) {
          setMrData({ ...EMPTY_MARKET_RESEARCH, ...json.data });
        }
      } catch {}
      setMrLoaded(true);
    };
    fetchMR();
  }, [mrLoaded]);

  const saveMrData = useCallback(async (newData: MarketResearchData) => {
    setMrSaving(true);
    try {
      await fetch("/api/content/market-research", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ data: newData }),
      });
    } catch {}
    setMrSaving(false);
  }, []);

  const handleMrDataChange = useCallback((newData: MarketResearchData) => {
    setMrData(newData);
  }, []);

  useEffect(() => {
    if (!mrLoaded) return;
    const timer = setTimeout(() => { saveMrData(mrData); }, 2000);
    return () => clearTimeout(timer);
  }, [mrData, mrLoaded, saveMrData]);

  const mrTopic = data.businessDescription || "";
  const mrTargetAudience = data.whoWeHelp || "";

  const handleGenerateFullResearch = useCallback(async () => {
    if (!mrTopic.trim()) {
      toast({ title: "Inserisci la Descrizione Business in Informazioni Business per avviare la ricerca", variant: "destructive" });
      return;
    }
    setIsGeneratingResearch(true);
    setShowResearchDialog(true);
    setResearchProgress(null);

    try {
      const response = await fetch("/api/content/ai/generate-market-research", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ niche: mrTopic, targetAudience: mrTargetAudience }),
      });
      const resData = await response.json();
      if (resData.success && resData.jobId) {
        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/content/ai/market-research-status/${resData.jobId}`, { headers: getAuthHeaders() });
            const statusData = await statusRes.json();
            if (!statusData.success) return;
            setResearchProgress({
              status: statusData.status,
              currentStep: statusData.currentStep,
              totalSteps: statusData.totalSteps,
              stepLabel: statusData.stepLabel,
              stepDetails: statusData.stepDetails,
              steps: statusData.steps,
              error: statusData.error,
              tokenUsage: statusData.tokenUsage,
            });
            if (statusData.status === 'completed' && statusData.result) {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              const newData = statusData.result.data;
              setMrData(newData);
              saveMrData(newData);
              setIsGeneratingResearch(false);
              setGeneratingPhase(null);
              toast({ title: "Deep Research completata!", description: "Tutte le 7 fasi compilate con dati reali dal mercato." });
            } else if (statusData.status === 'error') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setIsGeneratingResearch(false);
              setGeneratingPhase(null);
            }
          } catch {}
        }, 2000);
      } else {
        throw new Error(resData.error || "Errore nell'avvio della ricerca");
      }
    } catch (error: any) {
      toast({ title: "Errore nella ricerca", description: error.message, variant: "destructive" });
      setIsGeneratingResearch(false);
      setGeneratingPhase(null);
      setShowResearchDialog(false);
    }
  }, [mrTopic, mrTargetAudience, toast, saveMrData]);

  const handleGeneratePhase = useCallback(async (phase: string, mergeMode: 'add' | 'overwrite') => {
    if (!mrTopic.trim()) {
      toast({ title: "Inserisci la Descrizione Business per avviare la ricerca", variant: "destructive" });
      return;
    }
    setGeneratingPhase(phase);
    setIsGeneratingResearch(true);
    setShowResearchDialog(true);
    setResearchProgress(null);

    try {
      const response = await fetch("/api/content/ai/generate-market-research", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ niche: mrTopic, targetAudience: mrTargetAudience, phase }),
      });
      const resData = await response.json();
      if (resData.success && resData.jobId) {
        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/content/ai/market-research-status/${resData.jobId}`, { headers: getAuthHeaders() });
            const statusData = await statusRes.json();
            if (!statusData.success) return;
            setResearchProgress({
              status: statusData.status,
              currentStep: statusData.currentStep,
              totalSteps: statusData.totalSteps,
              stepLabel: statusData.stepLabel,
              stepDetails: statusData.stepDetails,
              steps: statusData.steps,
              error: statusData.error,
              tokenUsage: statusData.tokenUsage,
            });
            if (statusData.status === 'completed' && statusData.result) {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              const newPhaseData = statusData.result.data;
              if (mergeMode === 'add') {
                setMrData(prev => {
                  const merged = { ...prev };
                  if (newPhaseData.currentState) merged.currentState = [...(prev.currentState || []).filter((s: string) => s.trim()), ...newPhaseData.currentState];
                  if (newPhaseData.idealState) merged.idealState = [...(prev.idealState || []).filter((s: string) => s.trim()), ...newPhaseData.idealState];
                  if (newPhaseData.avatar) merged.avatar = { ...prev.avatar, ...newPhaseData.avatar };
                  if (newPhaseData.emotionalDrivers) merged.emotionalDrivers = [...new Set([...(prev.emotionalDrivers || []), ...newPhaseData.emotionalDrivers])];
                  if (newPhaseData.existingSolutionProblems) merged.existingSolutionProblems = [...(prev.existingSolutionProblems || []).filter((s: string) => s.trim()), ...newPhaseData.existingSolutionProblems];
                  if (newPhaseData.internalObjections) merged.internalObjections = [...(prev.internalObjections || []).filter((s: string) => s.trim()), ...newPhaseData.internalObjections];
                  if (newPhaseData.externalObjections) merged.externalObjections = [...(prev.externalObjections || []).filter((s: string) => s.trim()), ...newPhaseData.externalObjections];
                  if (newPhaseData.coreLies) merged.coreLies = [...(prev.coreLies || []), ...newPhaseData.coreLies];
                  if (newPhaseData.uniqueMechanism) merged.uniqueMechanism = newPhaseData.uniqueMechanism;
                  if (newPhaseData.uvp) merged.uvp = newPhaseData.uvp;
                  saveMrData(merged);
                  return merged;
                });
              } else {
                setMrData(prev => {
                  const updated = { ...prev, ...newPhaseData };
                  saveMrData(updated);
                  return updated;
                });
              }
              setIsGeneratingResearch(false);
              setGeneratingPhase(null);
              toast({ title: "Fase generata!", description: "Dati aggiornati." });
            } else if (statusData.status === 'error') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setIsGeneratingResearch(false);
              setGeneratingPhase(null);
            }
          } catch {}
        }, 2000);
      } else {
        throw new Error(resData.error || "Errore nell'avvio della ricerca");
      }
    } catch (error: any) {
      toast({ title: "Errore nella ricerca", description: error.message, variant: "destructive" });
      setIsGeneratingResearch(false);
      setGeneratingPhase(null);
      setShowResearchDialog(false);
    }
  }, [mrTopic, mrTargetAudience, toast, saveMrData]);

  const handlePhaseButtonClick = useCallback((phase: string) => {
    if (!mrTopic.trim()) {
      toast({ title: "Inserisci la Descrizione Business per avviare la ricerca", variant: "destructive" });
      return;
    }
    const d = mrData;
    let hasData = false;
    switch (phase) {
      case 'trasformazione': hasData = (d.currentState?.some(s => s.trim()) || d.idealState?.some(s => s.trim())) || false; break;
      case 'avatar': hasData = !!(d.avatar?.nightThought || d.avatar?.biggestFear || d.avatar?.dailyFrustration); break;
      case 'leve': hasData = (d.emotionalDrivers?.length > 0) || false; break;
      case 'obiezioni': hasData = (d.internalObjections?.some(s => s.trim()) || d.externalObjections?.some(s => s.trim()) || d.existingSolutionProblems?.some(s => s.trim())) || false; break;
      case 'errore': hasData = (d.coreLies?.length > 0) || false; break;
      case 'meccanismo': hasData = !!(d.uniqueMechanism?.name || d.uniqueMechanism?.description); break;
      case 'posizionamento': hasData = !!d.uvp; break;
    }
    if (hasData) {
      setPendingPhaseGen({ phase, mode: null });
      setShowPhaseConfirmDialog(true);
    } else {
      handleGeneratePhase(phase, 'overwrite');
    }
  }, [mrTopic, mrData, toast, handleGeneratePhase]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const updateField = <K extends keyof BrandVoiceData>(field: K, value: BrandVoiceData[K]) => {
    onDataChange({ ...data, [field]: value });
  };

  const handleAddValue = () => {
    if (valueInput.trim()) {
      const currentValues = data.values || [];
      updateField("values", [...currentValues, valueInput.trim()]);
      setValueInput("");
    }
  };

  const handleRemoveValue = (index: number) => {
    const currentValues = data.values || [];
    updateField("values", currentValues.filter((_, i) => i !== index));
  };

  const handleAddSoftware = () => {
    const current = data.softwareCreated || [];
    updateField("softwareCreated", [...current, { emoji: "", name: "", description: "" }]);
  };

  const handleUpdateSoftware = (index: number, field: "emoji" | "name" | "description", value: string) => {
    const current = [...(data.softwareCreated || [])];
    current[index] = { ...current[index], [field]: value };
    updateField("softwareCreated", current);
  };

  const handleRemoveSoftware = (index: number) => {
    const current = data.softwareCreated || [];
    updateField("softwareCreated", current.filter((_, i) => i !== index));
  };

  const handleAddBook = () => {
    const current = data.booksPublished || [];
    updateField("booksPublished", [...current, { title: "", year: "" }]);
  };

  const handleUpdateBook = (index: number, field: "title" | "year", value: string) => {
    const current = [...(data.booksPublished || [])];
    current[index] = { ...current[index], [field]: value };
    updateField("booksPublished", current);
  };

  const handleRemoveBook = (index: number) => {
    const current = data.booksPublished || [];
    updateField("booksPublished", current.filter((_, i) => i !== index));
  };

  const handleAddCaseStudy = () => {
    const current = data.caseStudies || [];
    updateField("caseStudies", [...current, { client: "", result: "" }]);
  };

  const handleUpdateCaseStudy = (index: number, field: "client" | "result", value: string) => {
    const current = [...(data.caseStudies || [])];
    current[index] = { ...current[index], [field]: value };
    updateField("caseStudies", current);
  };

  const handleRemoveCaseStudy = (index: number) => {
    const current = data.caseStudies || [];
    updateField("caseStudies", current.filter((_, i) => i !== index));
  };

  const handleAddSegment = () => {
    const current = data.audienceSegments || [];
    updateField("audienceSegments", [...current, { name: "", description: "" }]);
  };

  const handleUpdateSegment = (index: number, field: "name" | "description", value: string) => {
    const current = [...(data.audienceSegments || [])];
    current[index] = { ...current[index], [field]: value };
    updateField("audienceSegments", current);
  };

  const handleRemoveSegment = (index: number) => {
    const current = data.audienceSegments || [];
    updateField("audienceSegments", current.filter((_, i) => i !== index));
  };

  const handleAddService = () => {
    const current = data.servicesOffered || [];
    updateField("servicesOffered", [...current, { name: "", price: "", description: "" }]);
  };

  const handleUpdateService = (index: number, field: "name" | "price" | "description", value: string) => {
    const current = [...(data.servicesOffered || [])];
    current[index] = { ...current[index], [field]: value };
    updateField("servicesOffered", current);
  };

  const handleRemoveService = (index: number) => {
    const current = data.servicesOffered || [];
    updateField("servicesOffered", current.filter((_, i) => i !== index));
  };

  const handleAddPhrase = () => {
    if (phraseInput.trim()) {
      const current = data.signaturePhrases || [];
      updateField("signaturePhrases", [...current, phraseInput.trim()]);
      setPhraseInput("");
    }
  };

  const handleRemovePhrase = (index: number) => {
    const current = data.signaturePhrases || [];
    updateField("signaturePhrases", current.filter((_, i) => i !== index));
  };

  const handleAddWritingExample = () => {
    const current = data.writingExamples || [];
    if (current.length < 3) {
      updateField("writingExamples", [...current, ""]);
    }
  };

  const handleUpdateWritingExample = (index: number, value: string) => {
    const current = [...(data.writingExamples || [])];
    current[index] = value;
    updateField("writingExamples", current);
  };

  const handleRemoveWritingExample = (index: number) => {
    const current = data.writingExamples || [];
    updateField("writingExamples", current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Brand Voice & Credibilità
          </h2>
          <p className="text-muted-foreground text-sm">
            Definisci l'identità del tuo brand per email personalizzate (tutti i campi sono opzionali)
          </p>
        </div>
        {showImportButton && onImportClick && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onImportClick}
          >
            <Download className="h-4 w-4 mr-2" />
            Importa da Agente
          </Button>
        )}
      </div>

      <Collapsible open={businessInfoOpen} onOpenChange={setBusinessInfoOpen}>
        <Card className="border-2 border-primary/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 cursor-pointer hover:from-primary/10 hover:to-primary/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle>Informazioni Business</CardTitle>
                </div>
                {businessInfoOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Nome, descrizione e bio del consulente</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bv-consultantDisplayName">Nome Display Consulente</Label>
                  <Input
                    id="bv-consultantDisplayName"
                    value={data.consultantDisplayName || ""}
                    onChange={(e) => updateField("consultantDisplayName", e.target.value)}
                    placeholder="Es: Marco Rossi"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bv-businessName">Nome Business</Label>
                  <Input
                    id="bv-businessName"
                    value={data.businessName || ""}
                    onChange={(e) => updateField("businessName", e.target.value)}
                    placeholder="Es: Momentum Coaching"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="bv-businessDescription">Descrizione Business</Label>
                <Textarea
                  id="bv-businessDescription"
                  value={data.businessDescription || ""}
                  onChange={(e) => updateField("businessDescription", e.target.value)}
                  placeholder="Breve descrizione di cosa fa il tuo business..."
                  rows={3}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="bv-consultantBio">Bio Consulente</Label>
                <Textarea
                  id="bv-consultantBio"
                  value={data.consultantBio || ""}
                  onChange={(e) => updateField("consultantBio", e.target.value)}
                  placeholder="Bio personale del consulente..."
                  rows={3}
                  className="mt-2"
                />
              </div>
              {showSaveButton && (
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  className={`w-full transition-all duration-300 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Salvato!' : 'Salva Brand Voice'}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={authorityOpen} onOpenChange={setAuthorityOpen}>
        <Card className="border-2 border-blue-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-blue-500/5 to-blue-500/10 cursor-pointer hover:from-blue-500/10 hover:to-blue-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  <CardTitle>Authority & Posizionamento</CardTitle>
                </div>
                {authorityOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Vision, mission, valori e USP</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="bv-vision">Vision</Label>
                <Textarea
                  id="bv-vision"
                  value={data.vision || ""}
                  onChange={(e) => updateField("vision", e.target.value)}
                  placeholder="La tua vision per il futuro..."
                  rows={2}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="bv-mission">Mission</Label>
                <Textarea
                  id="bv-mission"
                  value={data.mission || ""}
                  onChange={(e) => updateField("mission", e.target.value)}
                  placeholder="La tua mission..."
                  rows={2}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Valori</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={valueInput}
                      onChange={(e) => setValueInput(e.target.value)}
                      placeholder="Aggiungi un valore..."
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddValue())}
                    />
                    <Button type="button" onClick={handleAddValue} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(data.values || []).map((value: string, index: number) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {value}
                        <button
                          type="button"
                          onClick={() => handleRemoveValue(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="bv-usp">Unique Selling Proposition (USP)</Label>
                <Textarea
                  id="bv-usp"
                  value={data.usp || ""}
                  onChange={(e) => updateField("usp", e.target.value)}
                  placeholder="Cosa ti rende unico rispetto ai competitor..."
                  rows={2}
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bv-whoWeHelp">Chi Aiutiamo</Label>
                  <Textarea
                    id="bv-whoWeHelp"
                    value={data.whoWeHelp || ""}
                    onChange={(e) => updateField("whoWeHelp", e.target.value)}
                    placeholder="Il tuo cliente ideale..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bv-whoWeDontHelp">Chi NON Aiutiamo</Label>
                  <Textarea
                    id="bv-whoWeDontHelp"
                    value={data.whoWeDontHelp || ""}
                    onChange={(e) => updateField("whoWeDontHelp", e.target.value)}
                    placeholder="Clienti non target..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Segmenti di Pubblico</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddSegment}>
                    <Plus className="w-3 h-3 mr-1" /> Aggiungi Segmento
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Definisci i segmenti specifici del tuo pubblico target. Verranno usati sia nella generazione idee che nella ricerca di mercato.
                </p>
                {(data.audienceSegments || []).map((segment, index: number) => (
                  <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card mb-2">
                    <Input
                      value={segment.name}
                      onChange={(e) => handleUpdateSegment(index, "name", e.target.value)}
                      placeholder="Nome segmento (es. SaaS B2B)"
                      className="w-1/3"
                    />
                    <Input
                      value={segment.description}
                      onChange={(e) => handleUpdateSegment(index, "description", e.target.value)}
                      placeholder="Descrizione (es. Software house 5-30 dipendenti con alto volume lead)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSegment(index)}
                      className="shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bv-whatWeDo">Cosa Facciamo</Label>
                  <Textarea
                    id="bv-whatWeDo"
                    value={data.whatWeDo || ""}
                    onChange={(e) => updateField("whatWeDo", e.target.value)}
                    placeholder="I servizi che offri..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bv-howWeDoIt">Come Lo Facciamo</Label>
                  <Textarea
                    id="bv-howWeDoIt"
                    value={data.howWeDoIt || ""}
                    onChange={(e) => updateField("howWeDoIt", e.target.value)}
                    placeholder="Il tuo metodo/processo..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>
              {showSaveButton && (
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  className={`w-full transition-all duration-300 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Salvato!' : 'Salva Brand Voice'}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <Card className="border-2 border-green-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-green-500/5 to-green-500/10 cursor-pointer hover:from-green-500/10 hover:to-green-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-500" />
                  <CardTitle>Credenziali & Risultati</CardTitle>
                </div>
                {credentialsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Esperienza, software, libri e case studies</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bv-yearsExperience">Anni di Esperienza</Label>
                  <Input
                    id="bv-yearsExperience"
                    type="number"
                    min="0"
                    value={data.yearsExperience || ""}
                    onChange={(e) => updateField("yearsExperience", parseInt(e.target.value) || 0)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bv-clientsHelped">Clienti Aiutati</Label>
                  <Input
                    id="bv-clientsHelped"
                    type="number"
                    min="0"
                    value={data.clientsHelped || ""}
                    onChange={(e) => updateField("clientsHelped", parseInt(e.target.value) || 0)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bv-resultsGenerated">Risultati Generati</Label>
                  <Input
                    id="bv-resultsGenerated"
                    value={data.resultsGenerated || ""}
                    onChange={(e) => updateField("resultsGenerated", e.target.value)}
                    placeholder="Es: €10M+ fatturato"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Software Creati</Label>
                  <Button type="button" onClick={handleAddSoftware} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(data.softwareCreated || []).map((software, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={software.emoji}
                        onChange={(e) => handleUpdateSoftware(index, "emoji", e.target.value)}
                        placeholder="📱"
                        className="w-16 text-center"
                      />
                      <Input
                        value={software.name}
                        onChange={(e) => handleUpdateSoftware(index, "name", e.target.value)}
                        placeholder="Nome software"
                        className="flex-1"
                      />
                      <Input
                        value={software.description}
                        onChange={(e) => handleUpdateSoftware(index, "description", e.target.value)}
                        placeholder="Breve descrizione"
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSoftware(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Libri Pubblicati</Label>
                  <Button type="button" onClick={handleAddBook} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(data.booksPublished || []).map((book, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={book.title}
                        onChange={(e) => handleUpdateBook(index, "title", e.target.value)}
                        placeholder="Titolo libro"
                        className="flex-1"
                      />
                      <Input
                        value={book.year}
                        onChange={(e) => handleUpdateBook(index, "year", e.target.value)}
                        placeholder="Anno"
                        className="w-24"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveBook(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Case Studies</Label>
                  <Button type="button" onClick={handleAddCaseStudy} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(data.caseStudies || []).map((caseStudy, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={caseStudy.client}
                        onChange={(e) => handleUpdateCaseStudy(index, "client", e.target.value)}
                        placeholder="Nome cliente"
                        className="flex-1"
                      />
                      <Input
                        value={caseStudy.result}
                        onChange={(e) => handleUpdateCaseStudy(index, "result", e.target.value)}
                        placeholder="Risultato ottenuto"
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCaseStudy(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {showSaveButton && (
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  className={`w-full transition-all duration-300 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Salvato!' : 'Salva Brand Voice'}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={servicesOpen} onOpenChange={setServicesOpen}>
        <Card className="border-2 border-purple-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-purple-500/5 to-purple-500/10 cursor-pointer hover:from-purple-500/10 hover:to-purple-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-purple-500" />
                  <CardTitle>Servizi & Garanzie</CardTitle>
                </div>
                {servicesOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Offerta servizi e garanzie</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Servizi Offerti</Label>
                  <Button type="button" onClick={handleAddService} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(data.servicesOffered || []).map((service, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={service.name}
                        onChange={(e) => handleUpdateService(index, "name", e.target.value)}
                        placeholder="Nome servizio"
                        className="flex-1"
                      />
                      <Input
                        value={service.price}
                        onChange={(e) => handleUpdateService(index, "price", e.target.value)}
                        placeholder="Prezzo"
                        className="w-32"
                      />
                      <Input
                        value={service.description}
                        onChange={(e) => handleUpdateService(index, "description", e.target.value)}
                        placeholder="Descrizione"
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveService(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="bv-guarantees">Garanzie</Label>
                <Textarea
                  id="bv-guarantees"
                  value={data.guarantees || ""}
                  onChange={(e) => updateField("guarantees", e.target.value)}
                  placeholder="Le garanzie che offri ai tuoi clienti..."
                  rows={3}
                  className="mt-2"
                />
              </div>

              {showSaveButton && (
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  className={`w-full transition-all duration-300 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Salvato!' : 'Salva Brand Voice'}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={voiceStyleOpen} onOpenChange={setVoiceStyleOpen}>
        <Card className="border-2 border-indigo-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-indigo-500/5 to-indigo-500/10 cursor-pointer hover:from-indigo-500/10 hover:to-indigo-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-indigo-500" />
                  <CardTitle>Voce & Stile Personale</CardTitle>
                </div>
                {voiceStyleOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Come comunichi e come vuoi che l'AI scriva per te</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-6">
              <div>
                <Label htmlFor="bv-personalTone">Tono Personale</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">Descrivi come comunichi — il tuo stile naturale di scrittura</p>
                <Textarea
                  id="bv-personalTone"
                  value={data.personalTone || ""}
                  onChange={(e) => updateField("personalTone", e.target.value)}
                  placeholder="Es: Diretto e provocatorio, uso spesso l'ironia. Parlo come un coach da spogliatoio, non come un professore. Le mie frasi sono corte e vanno dritte al punto."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="bv-contentPersonality">Personalità del Contenuto</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">Che emozione vuoi trasmettere a chi legge?</p>
                <Textarea
                  id="bv-contentPersonality"
                  value={data.contentPersonality || ""}
                  onChange={(e) => updateField("contentPersonality", e.target.value)}
                  placeholder="Es: Voglio che chi legge si senta capito e un po' provocato, mai giudicato. Come parlare con un amico sincero che ti dice le cose in faccia."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="bv-audienceLanguage">Linguaggio del Target</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">Come parla il tuo pubblico? Che livello di formalità, slang o termini tecnici usano?</p>
                <Textarea
                  id="bv-audienceLanguage"
                  value={data.audienceLanguage || ""}
                  onChange={(e) => updateField("audienceLanguage", e.target.value)}
                  placeholder="Es: Il mio target sono personal trainer, parlano informale, usano termini tecnici come 'periodizzazione', 'volume', 'deload'. Sono pratici, vogliono soluzioni concrete."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="bv-avoidPatterns">Cosa NON Fare Mai</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">Anti-pattern espliciti — cose che l'AI non deve MAI fare nei tuoi contenuti</p>
                <Textarea
                  id="bv-avoidPatterns"
                  value={data.avoidPatterns || ""}
                  onChange={(e) => updateField("avoidPatterns", e.target.value)}
                  placeholder="Es: Mai iniziare con 'In un mondo dove...', mai usare elenchi puntati generici, evitare il tono motivazionale americano, non usare 'game changer' o 'mindset shift'"
                  rows={3}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label>Esempi di Scrittura Reale</Label>
                    <p className="text-xs text-muted-foreground mt-1">Incolla 1-3 post o testi che hai scritto tu. L'AI analizzerà il tuo stile per replicarlo.</p>
                  </div>
                  {(data.writingExamples || []).length < 3 && (
                    <Button type="button" onClick={handleAddWritingExample} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Aggiungi
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {(data.writingExamples || []).map((example, index: number) => (
                    <div key={index} className="relative">
                      <Textarea
                        value={example}
                        onChange={(e) => handleUpdateWritingExample(index, e.target.value)}
                        placeholder={`Esempio ${index + 1}: incolla qui un tuo post, caption o testo reale...`}
                        rows={4}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => handleRemoveWritingExample(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Frasi Firma</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">Espressioni, modi di dire o catchphrase che usi sempre</p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={phraseInput}
                      onChange={(e) => setPhraseInput(e.target.value)}
                      placeholder="Es: Il punto è questo:, Sveglia!, Non è magia, è metodo"
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPhrase())}
                    />
                    <Button type="button" onClick={handleAddPhrase} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(data.signaturePhrases || []).map((phrase: string, index: number) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {phrase}
                        <button
                          type="button"
                          onClick={() => handleRemovePhrase(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {showSaveButton && (
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  className={`w-full transition-all duration-300 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Salvato!' : 'Salva Brand Voice'}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={marketResearchOpen} onOpenChange={setMarketResearchOpen}>
        <Card className="border-2 border-amber-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-amber-500/5 to-orange-500/10 cursor-pointer hover:from-amber-500/10 hover:to-orange-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-amber-500" />
                  <CardTitle>Ricerca di Mercato</CardTitle>
                  {mrSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                {marketResearchOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Analisi profonda del tuo mercato con AI — 7 fasi di ricerca</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6">
              <MarketResearchSection
                data={mrData}
                onDataChange={handleMrDataChange}
                isGenerating={isGeneratingResearch}
                generatingPhase={generatingPhase}
                onGenerateFullResearch={handleGenerateFullResearch}
                onGeneratePhase={handlePhaseButtonClick}
                topic={mrTopic}
                targetAudience={mrTargetAudience}
                compact={compact}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={showPhaseConfirmDialog} onOpenChange={setShowPhaseConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dati già presenti</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Questa sezione contiene già dei dati. Come vuoi procedere?</p>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => { setShowPhaseConfirmDialog(false); handleGeneratePhase(pendingPhaseGen.phase, 'add'); }} className="w-full">
              Aggiungi ai dati esistenti
            </Button>
            <Button variant="outline" onClick={() => { setShowPhaseConfirmDialog(false); handleGeneratePhase(pendingPhaseGen.phase, 'overwrite'); }} className="w-full">
              Sovrascrivi tutto
            </Button>
            <Button variant="ghost" onClick={() => setShowPhaseConfirmDialog(false)} className="w-full text-muted-foreground">
              Annulla
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showResearchDialog} onOpenChange={(open) => { if (!open && researchProgress?.status !== 'running') { setShowResearchDialog(false); setResearchProgress(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-purple-500" />
              Deep Research con AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {researchProgress ? (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Step {researchProgress.currentStep} di {researchProgress.totalSteps}</span>
                  <div className="flex items-center gap-3">
                    {researchProgress.tokenUsage && researchProgress.tokenUsage.totalTokens > 0 && researchProgress.status === 'running' && (
                      <span className="text-xs text-muted-foreground">{researchProgress.tokenUsage.totalTokens.toLocaleString()} token</span>
                    )}
                    <span className={researchProgress.status === 'completed' ? 'text-green-600 font-medium' : researchProgress.status === 'error' ? 'text-red-600 font-medium' : 'text-purple-600 font-medium'}>
                      {researchProgress.status === 'completed' ? 'Completato' : researchProgress.status === 'error' ? 'Errore' : researchProgress.stepLabel}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${researchProgress.status === 'completed' ? 'bg-green-500' : researchProgress.status === 'error' ? 'bg-red-500' : 'bg-purple-500'}`}
                    style={{ width: `${researchProgress.status === 'completed' ? 100 : ((researchProgress.currentStep - 0.5) / researchProgress.totalSteps) * 100}%` }}
                  />
                </div>
                <div className="space-y-2">
                  {researchProgress.steps.map((step, idx) => (
                    <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${step.status === 'running' ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' : step.status === 'completed' ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : step.status === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-60'}`}>
                      <div className="mt-0.5">
                        {step.status === 'running' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                        ) : step.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : step.status === 'error' ? (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{step.label}</div>
                        {step.details && <div className="text-xs text-muted-foreground mt-0.5">{step.details}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {researchProgress.status === 'error' && researchProgress.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300">{researchProgress.error}</p>
                  </div>
                )}
                {researchProgress.status === 'completed' && (
                  <div className="space-y-3">
                    {researchProgress.tokenUsage && researchProgress.tokenUsage.totalTokens > 0 && (
                      <div className="flex items-center gap-4 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-muted-foreground">
                        <span>Token usati: <strong>{researchProgress.tokenUsage.totalTokens.toLocaleString()}</strong></span>
                        <span>Input: {researchProgress.tokenUsage.inputTokens.toLocaleString()}</span>
                        <span>Output: {researchProgress.tokenUsage.outputTokens.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => { setShowResearchDialog(false); setResearchProgress(null); }} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Vedi Risultati
                      </Button>
                    </div>
                  </div>
                )}
                {researchProgress.status === 'error' && (
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => { setShowResearchDialog(false); setResearchProgress(null); }}>
                      Chiudi
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <p className="text-sm text-muted-foreground">Avvio Deep Research...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BrandVoiceSection;
