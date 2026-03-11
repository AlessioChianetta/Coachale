import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { BrandVoiceSection, type BrandVoiceData } from "@/components/brand-voice";
import { 
  Sparkles, 
  Save, 
  Loader2, 
  X, 
  Plus,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Shield,
  Languages,
  Download,
  ChevronDown,
  ChevronUp,
  Eye,
  Code,
  CheckCircle2,
  XCircle,
  Info,
  Palette,
} from "lucide-react";

interface EmailAISettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

interface AISettings {
  id: string;
  aiTone: string;
  confidenceThreshold: number;
  autoReplyMode: string;
  signature: string | null;
  customInstructions: string | null;
  aiLanguage: string | null;
  escalationKeywords: string[] | null;
  stopOnRisk: boolean | null;
  bookingLink: string | null;
  salesContext: Record<string, any> | null;
}

function buildClientSystemPrompt(opts: {
  tone: string;
  signature: string;
  customInstructions: string;
  bookingLink: string;
  brandVoice: BrandVoiceData;
}): string {
  const { tone, signature, customInstructions, bookingLink, brandVoice } = opts;

  const toneInstructions: Record<string, string> = {
    formal: `Usa un tono formale e professionale. Utilizza il "Lei" come forma di cortesia.\nEvita colloquialismi e mantieni un registro alto. Inizia con "Gentile" o "Egregio/a".`,
    friendly: `Usa un tono cordiale e amichevole ma sempre professionale.\nPuoi usare il "tu" se appropriato. Sii caloroso ma non troppo informale.`,
    professional: `Usa un tono professionale e diretto.\nMantieni un equilibrio tra formalità e accessibilità. Sii chiaro e conciso.`,
  };

  const signatureBlock = signature?.trim()
    ? `\n\nFirma da includere alla fine della risposta:\n${signature}`
    : "";

  const customBlock = customInstructions?.trim()
    ? `\n\nISTRUZIONI PERSONALIZZATE DEL CONSULENTE:\n${customInstructions}`
    : "";

  const bookingBlock = bookingLink?.trim()
    ? `\n\nLink di prenotazione da includere se il cliente chiede un appuntamento: ${bookingLink}`
    : "";

  const bvParts: string[] = [];
  if (brandVoice.businessName) bvParts.push(`Business: ${brandVoice.businessName}`);
  if (brandVoice.businessDescription) bvParts.push(`Descrizione: ${brandVoice.businessDescription}`);
  if (brandVoice.usp) bvParts.push(`USP: ${brandVoice.usp}`);
  if (brandVoice.whoWeHelp) bvParts.push(`Chi aiutiamo: ${brandVoice.whoWeHelp}`);
  if (brandVoice.whatWeDo) bvParts.push(`Cosa facciamo: ${brandVoice.whatWeDo}`);
  if (brandVoice.howWeDoIt) bvParts.push(`Come lo facciamo: ${brandVoice.howWeDoIt}`);
  if (brandVoice.vision) bvParts.push(`Vision: ${brandVoice.vision}`);
  if (brandVoice.mission) bvParts.push(`Mission: ${brandVoice.mission}`);
  if (brandVoice.guarantees) bvParts.push(`Garanzie: ${brandVoice.guarantees}`);
  if (Array.isArray(brandVoice.servicesOffered) && brandVoice.servicesOffered.length > 0) {
    bvParts.push(`Servizi: ${brandVoice.servicesOffered.map((s) => `${s.name}${s.price ? ` (${s.price})` : ""}`).join(", ")}`);
  }
  if (Array.isArray(brandVoice.caseStudies) && brandVoice.caseStudies.length > 0) {
    bvParts.push(`Casi studio: ${brandVoice.caseStudies.map((c) => `${c.client}: ${c.result}`).join("; ")}`);
  }
  if (brandVoice.personalTone) bvParts.push(`Tono personale: ${brandVoice.personalTone}`);
  if (brandVoice.contentPersonality) bvParts.push(`Personalità: ${brandVoice.contentPersonality}`);

  const brandVoiceBlock = bvParts.length > 0
    ? `\n\nBRAND VOICE (usa queste info per rispondere in modo informato):\n${bvParts.map(p => `- ${p}`).join("\n")}`
    : "";

  return `Sei un assistente AI specializzato nell'analisi e risposta alle email per un consulente italiano.

Analizza l'email e genera una risposta strutturata in JSON con questi campi ESATTI:

- response: string (testo della risposta email, professionale e pertinente)
- confidence: number (da 0 a 1, quanto sei sicuro della risposta)
- category: "info_request" | "complaint" | "billing" | "technical" | "booking" | "other"
- sentiment: "positive" | "neutral" | "negative" (tono percepito nell'email ricevuta)
- urgency: "low" | "medium" | "high" | "critical"
- createTicket: boolean (true se richiede intervento umano urgente)
- ticketReason: string | null (motivo per creare il ticket, se createTicket è true)
- ticketPriority: "low" | "medium" | "high" | "urgent" | null
- suggestedActions: string[] (lista di azioni consigliate)

CRITERI PER createTicket = true:
- Reclami gravi o clienti arrabbiati
- Richieste di rimborso o problemi di fatturazione complessi
- Situazioni che richiedono decisioni umane
- Informazioni mancanti critiche per rispondere
- Richieste di consulenza specifica non coperta dalla knowledge base

CRITERI PER confidence:
- 0.9-1.0: Risposta certa, informazioni complete dalla knowledge base
- 0.7-0.9: Risposta buona, alcune informazioni dalla KB
- 0.5-0.7: Risposta generica, poche informazioni specifiche
- 0.3-0.5: Risposta incerta, potrebbe richiedere revisione
- 0.0-0.3: Non sono sicuro, meglio creare un ticket

Rispondi SOLO con il JSON valido, senza markdown, commenti o altro testo.

ISTRUZIONI SUL TONO:
${toneInstructions[tone] || toneInstructions.professional}${customBlock}${brandVoiceBlock}${bookingBlock}${signatureBlock}

[+ Knowledge Base del consulente, contesto CRM del contatto, storico conversazione — iniettati automaticamente a runtime]`;
}

export function EmailAISettings({
  open,
  onOpenChange,
  accountId,
  accountName,
}: EmailAISettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKeyword, setNewKeyword] = useState("");
  const [importing, setImporting] = useState(false);
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [brandVoiceData, setBrandVoiceData] = useState<BrandVoiceData>({});
  const [brandVoiceLoaded, setBrandVoiceLoaded] = useState(false);
  const [savingBrandVoice, setSavingBrandVoice] = useState(false);
  const [importingFromAgent, setImportingFromAgent] = useState(false);

  const { data: accountsData } = useQuery({
    queryKey: ["/api/email-hub/accounts"],
    queryFn: async () => {
      const res = await fetch("/api/email-hub/accounts", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento account");
      return res.json();
    },
    enabled: open,
  });

  const otherAccounts: Array<{ id: string; displayName: string; emailAddress: string }> =
    (accountsData?.data ?? accountsData ?? []).filter((a: any) => a.id !== accountId);

  const handleImportFrom = async (sourceId: string, sourceName: string) => {
    setImporting(true);
    try {
      const res = await fetch(`/api/email-hub/accounts/${sourceId}/ai-settings`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore nel caricamento");
      const json = await res.json();
      const src = json?.data ?? json;
      setFormData({
        aiTone: src.aiTone ?? "professional",
        confidenceThreshold: src.confidenceThreshold ?? 0.8,
        autoReplyMode: src.autoReplyMode ?? "review",
        signature: src.signature ?? "",
        customInstructions: src.customInstructions ?? "",
        aiLanguage: src.aiLanguage ?? "it",
        escalationKeywords: src.escalationKeywords ?? [],
        stopOnRisk: src.stopOnRisk ?? true,
        bookingLink: src.bookingLink ?? "",
      });
      toast({ title: "Impostazioni importate", description: `Configurazione copiata da "${sourceName}". Salva per confermare.` });
    } catch {
      toast({ title: "Errore", description: "Impossibile importare le impostazioni", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const [formData, setFormData] = useState<{
    aiTone: string;
    confidenceThreshold: number;
    autoReplyMode: string;
    signature: string;
    customInstructions: string;
    aiLanguage: string;
    escalationKeywords: string[];
    stopOnRisk: boolean;
    bookingLink: string;
  }>({
    aiTone: "professional",
    confidenceThreshold: 0.8,
    autoReplyMode: "review",
    signature: "",
    customInstructions: "",
    aiLanguage: "it",
    escalationKeywords: [],
    stopOnRisk: true,
    bookingLink: "",
  });

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["email-ai-settings", accountId],
    queryFn: async () => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/ai-settings`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Errore nel caricamento impostazioni");
      return response.json();
    },
    enabled: open && !!accountId,
  });

  const { data: brandVoiceResult } = useQuery({
    queryKey: ["/api/content/brand-voice"],
    queryFn: async () => {
      const res = await fetch("/api/content/brand-voice", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore brand voice");
      return res.json();
    },
    enabled: open,
  });

  const { data: agentsList } = useQuery({
    queryKey: ["/api/whatsapp/agents-by-account"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/agents-by-account", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento agenti");
      return res.json();
    },
    enabled: open,
  });

  const allAgents: Array<{ id: string; agentName: string }> = useMemo(() => {
    if (!agentsList) return [];
    if (Array.isArray(agentsList)) {
      return agentsList.flatMap((group: { agents?: Array<{ id: string; agentName: string }> }) =>
        (group.agents ?? []).map((a) => ({ id: a.id, agentName: a.agentName }))
      );
    }
    if (agentsList.data && Array.isArray(agentsList.data)) {
      return agentsList.data.flatMap((group: { agents?: Array<{ id: string; agentName: string }> }) =>
        (group.agents ?? []).map((a) => ({ id: a.id, agentName: a.agentName }))
      );
    }
    return [];
  }, [agentsList]);

  const handleImportFromAgent = async (agentId: string, agentName: string) => {
    setImportingFromAgent(true);
    try {
      const res = await fetch(`/api/whatsapp/agents/${agentId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento agente");
      const json = await res.json();
      const agent = json?.data ?? json;
      const imported: BrandVoiceData = {};
      if (agent.businessName) imported.businessName = agent.businessName;
      if (agent.businessDescription) imported.businessDescription = agent.businessDescription;
      if (agent.consultantBio) imported.consultantBio = agent.consultantBio;
      if (agent.consultantDisplayName) imported.consultantDisplayName = agent.consultantDisplayName;
      if (agent.vision) imported.vision = agent.vision;
      if (agent.mission) imported.mission = agent.mission;
      if (agent.usp) imported.usp = agent.usp;
      if (agent.whoWeHelp) imported.whoWeHelp = agent.whoWeHelp;
      if (agent.whatWeDo) imported.whatWeDo = agent.whatWeDo;
      if (agent.howWeDoIt) imported.howWeDoIt = agent.howWeDoIt;
      if (agent.guarantees) imported.guarantees = agent.guarantees;
      if (agent.personalTone) imported.personalTone = agent.personalTone;
      if (agent.contentPersonality) imported.contentPersonality = agent.contentPersonality;
      if (Array.isArray(agent.values)) imported.values = agent.values;
      if (Array.isArray(agent.servicesOffered)) {
        imported.servicesOffered = agent.servicesOffered.map((s: Record<string, string>) => ({
          name: s.name || "",
          price: s.investment || s.price || "",
          description: s.description || "",
        }));
      }
      if (Array.isArray(agent.caseStudies)) {
        imported.caseStudies = agent.caseStudies.map((c: Record<string, string>) => ({
          client: c.clientName || c.client || c.sector || "",
          result: c.after || c.result || "",
        }));
      }
      if (agent.yearsExperience) imported.yearsExperience = agent.yearsExperience;
      if (agent.clientsHelped) imported.clientsHelped = agent.clientsHelped;
      if (agent.resultsGenerated) imported.resultsGenerated = agent.resultsGenerated;
      if (agent.brandVoiceData && typeof agent.brandVoiceData === "object") {
        setBrandVoiceData({ ...imported, ...agent.brandVoiceData });
      } else {
        setBrandVoiceData(imported);
      }
      toast({ title: "Brand Voice importato", description: `Dati caricati dall'agente "${agentName}". Salva Brand Voice per confermare.` });
    } catch {
      toast({ title: "Errore", description: "Impossibile importare il Brand Voice dall'agente", variant: "destructive" });
    } finally {
      setImportingFromAgent(false);
    }
  };

  useEffect(() => {
    if (brandVoiceResult?.brandVoice && !brandVoiceLoaded) {
      setBrandVoiceData(brandVoiceResult.brandVoice);
      setBrandVoiceLoaded(true);
    }
  }, [brandVoiceResult, brandVoiceLoaded]);

  useEffect(() => {
    if (!open) setBrandVoiceLoaded(false);
  }, [open]);

  useEffect(() => {
    if (settingsData?.data) {
      const s = settingsData.data as AISettings;
      setFormData({
        aiTone: s.aiTone || "professional",
        confidenceThreshold: s.confidenceThreshold ?? 0.8,
        autoReplyMode: s.autoReplyMode || "review",
        signature: s.signature || "",
        customInstructions: s.customInstructions || "",
        aiLanguage: s.aiLanguage || "it",
        escalationKeywords: s.escalationKeywords || [],
        stopOnRisk: s.stopOnRisk ?? true,
        bookingLink: s.bookingLink || "",
      });
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/ai-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nel salvataggio");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Impostazioni salvate",
        description: "Le preferenze AI sono state aggiornate",
      });
      queryClient.invalidateQueries({ queryKey: ["email-ai-settings", accountId] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveBrandVoice = async () => {
    setSavingBrandVoice(true);
    try {
      const res = await fetch("/api/content/brand-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ brandVoice: brandVoiceData, enabled: true }),
      });
      if (!res.ok) throw new Error("Errore salvataggio");
      queryClient.invalidateQueries({ queryKey: ["/api/content/brand-voice"] });
      toast({ title: "Brand Voice salvato", description: "Millie userà queste informazioni nelle risposte email" });
    } catch {
      toast({ title: "Errore", description: "Impossibile salvare il Brand Voice", variant: "destructive" });
    } finally {
      setSavingBrandVoice(false);
    }
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !formData.escalationKeywords.includes(newKeyword.trim())) {
      setFormData(prev => ({
        ...prev,
        escalationKeywords: [...prev.escalationKeywords, newKeyword.trim()],
      }));
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      escalationKeywords: prev.escalationKeywords.filter(k => k !== keyword),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const systemPromptPreview = useMemo(() => buildClientSystemPrompt({
    tone: formData.aiTone,
    signature: formData.signature,
    customInstructions: formData.customInstructions,
    bookingLink: formData.bookingLink,
    brandVoice: brandVoiceData,
  }), [formData.aiTone, formData.signature, formData.customInstructions, formData.bookingLink, brandVoiceData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                Impostazioni AI - {accountName}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Configura come l'AI genera le risposte per questo account email
              </DialogDescription>
            </div>
            {otherAccounts.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 text-xs h-8"
                    disabled={importing}
                  >
                    {importing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Importa da
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {otherAccounts.map((acc) => (
                    <DropdownMenuItem
                      key={acc.id}
                      onClick={() => handleImportFrom(acc.id, acc.displayName || acc.emailAddress)}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate text-sm">{acc.displayName || acc.emailAddress}</span>
                        {acc.displayName && (
                          <span className="text-xs text-muted-foreground truncate">{acc.emailAddress}</span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <form onSubmit={handleSubmit} className="space-y-6">

              <Collapsible open={capabilitiesOpen} onOpenChange={setCapabilitiesOpen}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-violet-500/5 to-blue-500/5 hover:from-violet-500/10 hover:to-blue-500/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-violet-500" />
                      <span className="font-medium text-sm">Cosa fa e cosa NON fa Millie</span>
                    </div>
                    {capabilitiesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                      <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Cosa FA
                      </h4>
                      <ul className="text-xs text-muted-foreground space-y-1.5">
                        <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span> Risponde in italiano (o lingua configurata)</li>
                        <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span> Cerca nella Knowledge Base per risposte accurate</li>
                        <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span> Crea ticket per richieste urgenti o complesse</li>
                        <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span> Suggerisce link di prenotazione se configurato</li>
                        <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span> Analizza sentiment, urgenza e categoria</li>
                        <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span> Usa il Brand Voice per risposte personalizzate</li>
                        <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span> Consulta il CRM per contesto sul contatto</li>
                        <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span> Blocca l'invio se rileva parole di escalation</li>
                      </ul>
                    </div>
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                      <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" />
                        Cosa NON fa
                      </h4>
                      <ul className="text-xs text-muted-foreground space-y-1.5">
                        <li className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5 shrink-0">✗</span> Non invia senza approvazione (modalità revisione)</li>
                        <li className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5 shrink-0">✗</span> Non accede a sistemi esterni o siti web</li>
                        <li className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5 shrink-0">✗</span> Non gestisce pagamenti o fatturazione</li>
                        <li className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5 shrink-0">✗</span> Non risponde se la confidenza è troppo bassa</li>
                        <li className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5 shrink-0">✗</span> Non modifica o cancella dati del CRM</li>
                        <li className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5 shrink-0">✗</span> Non risponde a newsletter o email transazionali</li>
                        <li className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5 shrink-0">✗</span> Non inventa informazioni non presenti nella KB</li>
                        <li className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5 shrink-0">✗</span> Non risponde a email proprie (loop prevention)</li>
                      </ul>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Tono e Stile
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tono delle risposte</Label>
                    <Select
                      value={formData.aiTone}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, aiTone: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formale (Lei)</SelectItem>
                        <SelectItem value="professional">Professionale</SelectItem>
                        <SelectItem value="friendly">Amichevole (Tu)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Languages className="h-4 w-4" />
                      Lingua risposte
                    </Label>
                    <Select
                      value={formData.aiLanguage}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, aiLanguage: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">Italiano</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="auto">Automatico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Modalita risposta automatica</Label>
                  <Select
                    value={formData.autoReplyMode}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, autoReplyMode: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Disattivato - Nessuna bozza automatica</SelectItem>
                      <SelectItem value="review">Revisione - Genera bozza, attendi approvazione</SelectItem>
                      <SelectItem value="auto">Automatico - Invia se confidenza alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Soglia di confidenza: {Math.round(formData.confidenceThreshold * 100)}%</Label>
                    <span className="text-xs text-muted-foreground">
                      {formData.confidenceThreshold >= 0.9 ? "Molto alta" : 
                       formData.confidenceThreshold >= 0.7 ? "Alta" : 
                       formData.confidenceThreshold >= 0.5 ? "Media" : "Bassa"}
                    </span>
                  </div>
                  <Slider
                    value={[formData.confidenceThreshold]}
                    onValueChange={([val]) => setFormData(prev => ({ ...prev, confidenceThreshold: val }))}
                    min={0.3}
                    max={1}
                    step={0.05}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    L'AI inviera automaticamente solo se la confidenza supera questa soglia
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Sicurezza e Escalation
                </h3>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Blocca su rischio rilevato</Label>
                    <p className="text-xs text-muted-foreground">
                      Ferma l'invio automatico se l'AI rileva sentiment negativo o urgenza alta
                    </p>
                  </div>
                  <Switch
                    checked={formData.stopOnRisk}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, stopOnRisk: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Parole chiave per escalation
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="es. reclamo, avvocato, urgente..."
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddKeyword();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={handleAddKeyword}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.escalationKeywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="gap-1">
                        {keyword}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(keyword)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {formData.escalationKeywords.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Nessuna parola chiave configurata
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se l'email contiene queste parole, l'AI non rispondera automaticamente
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Prenotazioni
                </h3>

                <div className="space-y-2">
                  <Label>Link prenotazione appuntamento</Label>
                  <Input
                    placeholder="https://calendly.com/tuo-link"
                    value={formData.bookingLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, bookingLink: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    L'AI includera questo link quando suggerisce un appuntamento
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">Istruzioni personalizzate</h3>
                
                <div className="space-y-2">
                  <Label>Istruzioni aggiuntive per l'AI</Label>
                  <Textarea
                    placeholder="Es: Ricorda sempre di menzionare la nostra offerta speciale. Non promettere sconti oltre il 10%. Suggerisci sempre una chiamata per preventivi complessi..."
                    value={formData.customInstructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, customInstructions: e.target.value }))}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Queste istruzioni verranno incluse in ogni risposta generata dall'AI
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Firma email</Label>
                  <Textarea
                    placeholder="Cordiali saluti,&#10;Mario Rossi&#10;Consulente Senior&#10;Tel: +39 123 456 7890"
                    value={formData.signature}
                    onChange={(e) => setFormData(prev => ({ ...prev, signature: e.target.value }))}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <Palette className="h-4 w-4 text-violet-500" />
                      Brand Voice
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Millie usa queste informazioni per generare risposte coerenti con il tuo brand
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={handleSaveBrandVoice}
                    disabled={savingBrandVoice}
                  >
                    {savingBrandVoice ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Salva Brand Voice
                  </Button>
                </div>
                <BrandVoiceSection
                  data={brandVoiceData}
                  onDataChange={setBrandVoiceData}
                  onSave={handleSaveBrandVoice}
                  isSaving={savingBrandVoice}
                  compact={true}
                  showSaveButton={false}
                  showImportButton={false}
                />
              </div>

              <Separator />

              <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-slate-500/5 to-slate-500/10 hover:from-slate-500/10 hover:to-slate-500/15 transition-colors">
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-slate-500" />
                      <span className="font-medium text-sm">System Prompt attivo</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                      </Badge>
                    </div>
                    {promptOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 rounded-lg border bg-slate-950 p-4">
                    <ScrollArea className="max-h-[300px]">
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {systemPromptPreview}
                      </pre>
                    </ScrollArea>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Questo è il prompt base inviato a Gemini. A runtime vengono aggiunti: Knowledge Base, contesto CRM, storico conversazione e strategia adattiva.
                  </p>
                </CollapsibleContent>
              </Collapsible>

              <DialogFooter className="gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saveMutation.isPending}
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salva Impostazioni
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
