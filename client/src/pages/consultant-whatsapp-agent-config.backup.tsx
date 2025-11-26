import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Server, 
  Key, 
  Phone,
  CheckCircle, 
  AlertCircle,
  Loader2,
  Save,
  ArrowLeft,
  Clock,
  Building2,
  FileText,
  User,
  Bot,
  Users,
  Sparkles,
  Shield,
  Zap
} from "lucide-react";
import WhatsAppLayout from "@/components/whatsapp/WhatsAppLayout";
import AgentInstructionsPanel from "@/components/whatsapp/AgentInstructionsPanel";
import { getAuthHeaders } from "@/lib/auth";

interface WhatsAppConfig {
  id?: string;
  agentName: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioWhatsappNumber: string;
  autoResponseEnabled: boolean;
  agentType?: "reactive_lead" | "proactive_setter";
  workingHoursEnabled?: boolean;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  workingDays?: string[];
  afterHoursMessage?: string;
  businessName?: string;
  consultantDisplayName?: string;
  businessDescription?: string;
  consultantBio?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  usp?: string;
  whoWeHelp?: string;
  whoWeDontHelp?: string;
  whatWeDo?: string;
  howWeDoIt?: string;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string;
  softwareCreated?: any[];
  booksPublished?: any[];
  caseStudies?: any[];
  servicesOffered?: any[];
  guarantees?: string;
  aiPersonality?: string;
  whatsappConciseMode?: boolean;
  defaultObiettivi?: string;
  defaultDesideri?: string;
  defaultUncino?: string;
  defaultIdealState?: string;
  isDryRun?: boolean;
  agentInstructions?: string | null;
  agentInstructionsEnabled?: boolean;
  selectedTemplate?: "receptionist" | "marco_setter" | "custom";
  bookingEnabled?: boolean;
  objectionHandlingEnabled?: boolean;
  disqualificationEnabled?: boolean;
  upsellingEnabled?: boolean;
}

const emptyConfig: WhatsAppConfig = {
  agentName: "",
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioWhatsappNumber: "",
  autoResponseEnabled: true,
  agentType: "reactive_lead",
  workingHoursEnabled: false,
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  afterHoursMessage: "Ciao! Ti risponderò durante i miei orari di lavoro.",
  businessName: "",
  consultantDisplayName: "",
  businessDescription: "",
  consultantBio: "",
  vision: "",
  mission: "",
  values: [],
  usp: "",
  whoWeHelp: "",
  whoWeDontHelp: "",
  whatWeDo: "",
  howWeDoIt: "",
  yearsExperience: 0,
  clientsHelped: 0,
  resultsGenerated: "",
  softwareCreated: [],
  booksPublished: [],
  caseStudies: [],
  servicesOffered: [],
  guarantees: "",
  aiPersonality: "amico_fidato",
  whatsappConciseMode: true,
  isDryRun: true,
  agentInstructions: null,
  agentInstructionsEnabled: false,
  selectedTemplate: "receptionist",
  bookingEnabled: true,
  objectionHandlingEnabled: true,
  disqualificationEnabled: true,
  upsellingEnabled: false,
};

export default function ConsultantWhatsAppAgentConfig() {
  const [, params] = useRoute("/consultant/whatsapp/agent/:agentId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [formData, setFormData] = useState<WhatsAppConfig>(emptyConfig);
  const [isSaving, setIsSaving] = useState(false);

  const agentId = params?.agentId === "new" ? null : params?.agentId;
  const isNewAgent = !agentId;

  // Load existing config if editing
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: [`/api/whatsapp/config/${agentId}`],
    queryFn: async () => {
      if (!agentId) return null;
      const response = await fetch(`/api/whatsapp/config/${agentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to load config");
      const result = await response.json();
      // Unwrap data from { success, data } envelope
      return result.data || result;
    },
    enabled: !!agentId,
  });

  // Populate form when editing or duplicating
  useEffect(() => {
    if (existingConfig) {
      setFormData({
        ...existingConfig,
        twilioAuthToken: "", // Don't populate sensitive data
      });
    } else if (isNewAgent) {
      // Check for duplicate data in session storage
      const duplicateData = sessionStorage.getItem('duplicateAgentData');
      if (duplicateData) {
        try {
          const parsed = JSON.parse(duplicateData);
          setFormData(parsed);
          sessionStorage.removeItem('duplicateAgentData'); // Clear after use
        } catch (e) {
          console.error('Failed to parse duplicate data:', e);
        }
      }
    }
  }, [existingConfig, isNewAgent]);

  const handleSave = async () => {
    if (!formData.agentName.trim()) {
      toast({
        title: "Errore",
        description: "Il nome dell'agente è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const url = agentId
        ? `/api/whatsapp/config/${agentId}`
        : "/api/whatsapp/config";
      const method = agentId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      toast({
        title: "Successo",
        description: agentId
          ? "Agente aggiornato correttamente"
          : "Agente creato correttamente",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      navigate("/consultant/whatsapp");
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile salvare la configurazione",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <WhatsAppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </WhatsAppLayout>
    );
  }

  return (
    <WhatsAppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/consultant/whatsapp")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Bot className="h-8 w-8 text-green-600" />
                {isNewAgent ? "Nuovo Agente WhatsApp" : `Modifica: ${existingConfig?.agentName}`}
              </h1>
              <p className="text-muted-foreground mt-1">
                Configura le impostazioni complete per questo agente WhatsApp AI
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salva Configurazione
              </>
            )}
          </Button>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Nome Agente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-gray-500" />
                Nome Agente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="text"
                placeholder="Es: Dot - Receptionist, Spec - Assistant"
                value={formData.agentName}
                onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                className="text-base"
              />
              <p className="text-sm text-gray-500 mt-2">
                Un nome identificativo per questo agente (es: "Dot - Receptionist", "Spec - Assistant")
              </p>
            </CardContent>
          </Card>

          {/* Credenziali Twilio */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="h-5 w-5 text-purple-600" />
                Credenziali Twilio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountSid" className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-gray-500" />
                  Account SID
                </Label>
                <Input
                  id="accountSid"
                  type="text"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={formData.twilioAccountSid}
                  onChange={(e) => setFormData({ ...formData, twilioAccountSid: e.target.value })}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="authToken" className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-gray-500" />
                  Auth Token
                </Label>
                <Input
                  id="authToken"
                  type={showAuthToken ? "text" : "password"}
                  placeholder={agentId ? "Lascia vuoto per mantenere esistente" : "••••••••••••••••"}
                  value={formData.twilioAuthToken}
                  onChange={(e) => setFormData({ ...formData, twilioAuthToken: e.target.value })}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappNumber" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  Numero WhatsApp
                </Label>
                <Input
                  id="whatsappNumber"
                  type="text"
                  placeholder="+14155238886"
                  value={formData.twilioWhatsappNumber}
                  onChange={(e) => setFormData({ ...formData, twilioWhatsappNumber: e.target.value })}
                  className="font-mono"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="autoResponse" className="text-base font-semibold">
                    Risposta Automatica AI
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    L'AI risponderà automaticamente ai messaggi in arrivo
                  </p>
                </div>
                <Switch
                  id="autoResponse"
                  checked={formData.autoResponseEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, autoResponseEnabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="space-y-0.5">
                  <Label htmlFor="whatsappConciseMode" className="text-base font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    Modalità Conversazionale WhatsApp
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Stile breve e diretto, come in una chat WhatsApp
                  </p>
                </div>
                <Switch
                  id="whatsappConciseMode"
                  checked={formData.whatsappConciseMode || false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, whatsappConciseMode: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="space-y-0.5">
                  <Label htmlFor="isDryRun" className="text-base font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    Modalità Test (Dry Run)
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    I messaggi vengono simulati senza inviarli realmente
                  </p>
                </div>
                <Switch
                  id="isDryRun"
                  checked={formData.isDryRun ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isDryRun: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Tipo Agente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5 text-green-600" />
                Tipo Agente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Comportamento Agente</Label>
                <p className="text-sm text-gray-600">
                  Scegli come questo agente interagisce con i lead
                </p>

                <div className="space-y-3">
                  <div
                    onClick={() => setFormData({ ...formData, agentType: "reactive_lead" })}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.agentType === "reactive_lead"
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          formData.agentType === "reactive_lead"
                            ? "border-green-500"
                            : "border-gray-300"
                        }`}>
                          {formData.agentType === "reactive_lead" && (
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base">Receptionist (Aspetta Messaggi)</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          L'agente aspetta che i lead scrivano per primi. Ideale per lead organici che arrivano da contenuti, social, ecc.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, agentType: "proactive_setter" })}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.agentType === "proactive_setter"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          formData.agentType === "proactive_setter"
                            ? "border-blue-500"
                            : "border-gray-300"
                        }`}>
                          {formData.agentType === "proactive_setter" && (
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base">Setter Proattivo (Scrive Per Primo)</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          L'agente contatta i lead in modo proattivo. Gestisci i lead dalla sezione "Lead Proattivi" e l'agente li contatterà automaticamente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Info:</strong> Puoi creare più agenti con ruoli diversi. Ad esempio: "Dot - Receptionist" (reactive) per lead organici e "Marco - Setter" (proactive) per outbound.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credenziali & Esperienza */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Credenziali & Esperienza
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="yearsExperience">Anni Esperienza</Label>
                  <Input
                    id="yearsExperience"
                    type="number"
                    min="0"
                    value={formData.yearsExperience || 0}
                    onChange={(e) => setFormData({ ...formData, yearsExperience: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientsHelped">Clienti Aiutati</Label>
                  <Input
                    id="clientsHelped"
                    type="number"
                    min="0"
                    value={formData.clientsHelped || 0}
                    onChange={(e) => setFormData({ ...formData, clientsHelped: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resultsGenerated">Risultati Generati</Label>
                <Textarea
                  id="resultsGenerated"
                  placeholder="✅ Clienti passati da debiti a +100.000€&#10;✅ Rendite passive stabili superiori a 2.000€/mese"
                  value={formData.resultsGenerated || ""}
                  onChange={(e) => setFormData({ ...formData, resultsGenerated: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-gray-500">Uno per riga, usa ✅ per elenchi</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="softwareCreated">Software Creati</Label>
                <Textarea
                  id="softwareCreated"
                  placeholder="💻 Nome Software | Descrizione completa del software&#10;🎯 Altro Software | Altra descrizione"
                  value={
                    Array.isArray(formData.softwareCreated)
                      ? formData.softwareCreated.map((s: any) => `${s.emoji || ""} ${s.name} | ${s.description}`).join("\n")
                      : ""
                  }
                  onChange={(e) => {
                    const lines = e.target.value.split("\n").filter(Boolean);
                    const parsed = lines.map(line => {
                      const [namePart, ...descParts] = line.split("|");
                      const emoji = namePart.match(/^(\p{Emoji})/u)?.[1] || "";
                      const name = namePart.replace(/^\p{Emoji}\s*/u, "").trim();
                      return { emoji, name, description: descParts.join("|").trim() };
                    });
                    setFormData({ ...formData, softwareCreated: parsed });
                  }}
                  rows={4}
                />
                <p className="text-xs text-gray-500">Uno per riga: Emoji Nome | Descrizione</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="booksPublished">Libri Pubblicati</Label>
                <Textarea
                  id="booksPublished"
                  placeholder="Titolo del Libro | 2024"
                  value={
                    Array.isArray(formData.booksPublished)
                      ? formData.booksPublished.map((b: any) => `${b.title} | ${b.year}`).join("\n")
                      : ""
                  }
                  onChange={(e) => {
                    const lines = e.target.value.split("\n").filter(Boolean);
                    const parsed = lines.map(line => {
                      const [title, year] = line.split("|").map(s => s.trim());
                      return { title, year };
                    });
                    setFormData({ ...formData, booksPublished: parsed });
                  }}
                  rows={3}
                />
                <p className="text-xs text-gray-500">Uno per riga: Titolo | Anno</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="caseStudies">Case Studies</Label>
                <Textarea
                  id="caseStudies"
                  placeholder="Nome Cliente | Risultato ottenuto&#10;Azienda XYZ | Aumento fatturato del 150%"
                  value={
                    Array.isArray(formData.caseStudies)
                      ? formData.caseStudies.map((c: any) => `${c.client} | ${c.result}`).join("\n")
                      : ""
                  }
                  onChange={(e) => {
                    const lines = e.target.value.split("\n").filter(Boolean);
                    const parsed = lines.map(line => {
                      const [client, result] = line.split("|").map(s => s.trim());
                      return { client, result };
                    });
                    setFormData({ ...formData, caseStudies: parsed });
                  }}
                  rows={3}
                />
                <p className="text-xs text-gray-500">Uno per riga: Nome Cliente | Risultato</p>
              </div>
            </CardContent>
          </Card>

          {/* Servizi & Garanzie */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-yellow-600" />
                Servizi & Garanzie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="servicesOffered">Servizi Offerti</Label>
                <Textarea
                  id="servicesOffered"
                  placeholder="Nome Servizio | Descrizione completa | Prezzo (opzionale)"
                  value={
                    Array.isArray(formData.servicesOffered)
                      ? formData.servicesOffered.map((s: any) => `${s.name} | ${s.description}${s.price ? ` | ${s.price}` : ""}`).join("\n")
                      : ""
                  }
                  onChange={(e) => {
                    const lines = e.target.value.split("\n").filter(Boolean);
                    const parsed = lines.map(line => {
                      const parts = line.split("|").map(s => s.trim());
                      return { 
                        name: parts[0] || "", 
                        description: parts[1] || "",
                        price: parts[2] || ""
                      };
                    });
                    setFormData({ ...formData, servicesOffered: parsed });
                  }}
                  rows={5}
                />
                <p className="text-xs text-gray-500">Uno per riga: Nome | Descrizione | Prezzo</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guarantees">Garanzie</Label>
                <Textarea
                  id="guarantees"
                  placeholder="💥 Garanzia 30 Giorni...&#10;Descrivi le tue garanzie in dettaglio"
                  value={formData.guarantees || ""}
                  onChange={(e) => setFormData({ ...formData, guarantees: e.target.value })}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Orari di Lavoro */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-blue-600" />
                Orari di Lavoro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="workingHoursEnabled" className="text-base font-semibold">
                    Abilita Orari di Lavoro
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Limita le risposte automatiche agli orari configurati
                  </p>
                </div>
                <Switch
                  id="workingHoursEnabled"
                  checked={formData.workingHoursEnabled || false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, workingHoursEnabled: checked })
                  }
                />
              </div>

              {formData.workingHoursEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="workingHoursStart">Ora Inizio</Label>
                      <Input
                        id="workingHoursStart"
                        type="time"
                        value={formData.workingHoursStart || "09:00"}
                        onChange={(e) =>
                          setFormData({ ...formData, workingHoursStart: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workingHoursEnd">Ora Fine</Label>
                      <Input
                        id="workingHoursEnd"
                        type="time"
                        value={formData.workingHoursEnd || "18:00"}
                        onChange={(e) =>
                          setFormData({ ...formData, workingHoursEnd: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Giorni Lavorativi</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "monday", label: "Lunedì" },
                        { value: "tuesday", label: "Martedì" },
                        { value: "wednesday", label: "Mercoledì" },
                        { value: "thursday", label: "Giovedì" },
                        { value: "friday", label: "Venerdì" },
                        { value: "saturday", label: "Sabato" },
                        { value: "sunday", label: "Domenica" },
                      ].map((day) => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={day.value}
                            checked={formData.workingDays?.includes(day.value) || false}
                            onCheckedChange={(checked) => {
                              const currentDays = formData.workingDays || [];
                              const newDays = checked
                                ? [...currentDays, day.value]
                                : currentDays.filter((d) => d !== day.value);
                              setFormData({ ...formData, workingDays: newDays });
                            }}
                          />
                          <Label htmlFor={day.value} className="cursor-pointer font-normal">
                            {day.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="afterHoursMessage">Messaggio Fuori Orario</Label>
                    <Textarea
                      id="afterHoursMessage"
                      placeholder="Ciao! Ti risponderò durante i miei orari di lavoro."
                      value={formData.afterHoursMessage || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, afterHoursMessage: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Profilo Business */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-orange-600" />
                Profilo Business
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Nome Business</Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder="Es: Orbitale, Studio Rossi..."
                  value={formData.businessName || ""}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultantDisplayName">Nome Consulente (nei messaggi)</Label>
                <Input
                  id="consultantDisplayName"
                  type="text"
                  placeholder="Es: Marco, Dott. Rossi, Francesco..."
                  value={formData.consultantDisplayName || ""}
                  onChange={(e) => setFormData({ ...formData, consultantDisplayName: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  Il nome che apparirà nei messaggi WhatsApp ai lead (es: "Sono Marco dagli uffici di...")
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessDescription">Descrizione Servizi</Label>
                <Textarea
                  id="businessDescription"
                  placeholder="Consulenza finanziaria personalizzata..."
                  value={formData.businessDescription || ""}
                  onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultantBio">Bio Consulente</Label>
                <Textarea
                  id="consultantBio"
                  placeholder="Chi sei, cosa fai, la tua esperienza..."
                  value={formData.consultantBio || ""}
                  onChange={(e) => setFormData({ ...formData, consultantBio: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Chi Aiutiamo & Metodo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Chi Aiutiamo & Metodo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whoWeHelp">Chi Aiutiamo</Label>
                <Textarea
                  id="whoWeHelp"
                  placeholder="Il tuo cliente ideale..."
                  value={formData.whoWeHelp || ""}
                  onChange={(e) => setFormData({ ...formData, whoWeHelp: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whoWeDontHelp">Chi NON Aiutiamo</Label>
                <Textarea
                  id="whoWeDontHelp"
                  placeholder="Profili da disqualificare..."
                  value={formData.whoWeDontHelp || ""}
                  onChange={(e) => setFormData({ ...formData, whoWeDontHelp: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatWeDo">Cosa Facciamo</Label>
                <Textarea
                  id="whatWeDo"
                  placeholder="I tuoi servizi principali..."
                  value={formData.whatWeDo || ""}
                  onChange={(e) => setFormData({ ...formData, whatWeDo: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="howWeDoIt">Come Lo Facciamo</Label>
                <Textarea
                  id="howWeDoIt"
                  placeholder="Il tuo metodo/approccio unico..."
                  value={formData.howWeDoIt || ""}
                  onChange={(e) => setFormData({ ...formData, howWeDoIt: e.target.value })}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Valori Predefiniti Lead Proattivi */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-600" />
                Valori Predefiniti Lead Proattivi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defaultObiettivi">Obiettivi Predefiniti</Label>
                <Textarea
                  id="defaultObiettivi"
                  placeholder="es: creare un patrimonio tra 100.000 e 500.000€ in 2-4 anni"
                  value={formData.defaultObiettivi || ""}
                  onChange={(e) => setFormData({ ...formData, defaultObiettivi: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultDesideri">Desideri Predefiniti</Label>
                <Textarea
                  id="defaultDesideri"
                  placeholder="es: generare una rendita passiva di almeno 2.000€/mese"
                  value={formData.defaultDesideri || ""}
                  onChange={(e) => setFormData({ ...formData, defaultDesideri: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultUncino">Uncino Predefinito</Label>
                <Textarea
                  id="defaultUncino"
                  placeholder="es: ho visto che potresti essere interessato a costruire un patrimonio solido"
                  value={formData.defaultUncino || ""}
                  onChange={(e) => setFormData({ ...formData, defaultUncino: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultIdealState">Stato Ideale Predefinito</Label>
                <Textarea
                  id="defaultIdealState"
                  placeholder="es: la libertà finanziaria con un patrimonio che lavora al posto tuo"
                  value={formData.defaultIdealState || ""}
                  onChange={(e) => setFormData({ ...formData, defaultIdealState: e.target.value })}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Personalità AI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Personalità AI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aiPersonality">Stile Comunicazione</Label>
                <Select
                  value={formData.aiPersonality || "amico_fidato"}
                  onValueChange={(value: any) => setFormData({ ...formData, aiPersonality: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amico_fidato">Amico Fidato</SelectItem>
                    <SelectItem value="coach_motivazionale">Coach Motivazionale</SelectItem>
                    <SelectItem value="consulente_professionale">Consulente Professionale</SelectItem>
                    <SelectItem value="mentore_paziente">Mentore Paziente</SelectItem>
                    <SelectItem value="venditore_energico">Venditore Energico</SelectItem>
                    <SelectItem value="consigliere_empatico">Consigliere Empatico</SelectItem>
                    <SelectItem value="stratega_diretto">Stratega Diretto</SelectItem>
                    <SelectItem value="educatore_socratico">Educatore Socratico</SelectItem>
                    <SelectItem value="esperto_tecnico">Esperto Tecnico</SelectItem>
                    <SelectItem value="compagno_entusiasta">Compagno Entusiasta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Feature Blocks - Funzionalità Agente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-emerald-600" />
                Funzionalità Agente
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Controlla quali funzioni l'AI può utilizzare automaticamente. I blocchi vengono iniettati automaticamente nelle istruzioni e NON sono modificabili manualmente.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="space-y-0.5">
                  <Label htmlFor="bookingEnabled" className="text-base font-semibold flex items-center gap-2">
                    📅 Presa Appuntamento
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    L'AI può fissare appuntamenti con i lead qualificati
                  </p>
                </div>
                <Switch
                  id="bookingEnabled"
                  checked={formData.bookingEnabled ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, bookingEnabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="space-y-0.5">
                  <Label htmlFor="objectionHandlingEnabled" className="text-base font-semibold flex items-center gap-2">
                    🛡️ Gestione Obiezioni
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    L'AI gestisce attivamente le obiezioni dei lead
                  </p>
                </div>
                <Switch
                  id="objectionHandlingEnabled"
                  checked={formData.objectionHandlingEnabled ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, objectionHandlingEnabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="space-y-0.5">
                  <Label htmlFor="disqualificationEnabled" className="text-base font-semibold flex items-center gap-2">
                    ⛔ Disqualificazione Lead
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    L'AI disqualifica lead non idonei (basato su "Chi NON Aiutiamo")
                  </p>
                </div>
                <Switch
                  id="disqualificationEnabled"
                  checked={formData.disqualificationEnabled ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, disqualificationEnabled: checked })
                  }
                />
              </div>

              {/* NASCOSTO: upsellingEnabled - funzionalità non ancora implementata */}
              {/* <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="space-y-0.5">
                  <Label htmlFor="upsellingEnabled" className="text-base font-semibold flex items-center gap-2">
                    💰 Upselling
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    L'AI propone servizi aggiuntivi durante la conversazione
                  </p>
                </div>
                <Switch
                  id="upsellingEnabled"
                  checked={formData.upsellingEnabled ?? false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, upsellingEnabled: checked })
                  }
                />
              </div> */}

              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Importante:</strong> Quando una funzionalità è attiva, il blocco corrispondente viene automaticamente inserito nelle istruzioni dell'AI. Anche se disattivi l'interruttore e l'utente menziona quella funzionalità nelle istruzioni custom, l'AI NON potrà utilizzarla.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Autorità & Posizionamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-indigo-600" />
                Autorità & Posizionamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vision">Vision</Label>
                <Textarea
                  id="vision"
                  placeholder="La tua visione a lungo termine..."
                  value={formData.vision || ""}
                  onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mission">Mission</Label>
                <Textarea
                  id="mission"
                  placeholder="La tua missione..."
                  value={formData.mission || ""}
                  onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usp">USP (Unique Selling Proposition)</Label>
                <Textarea
                  id="usp"
                  placeholder="Cosa ti rende unico..."
                  value={formData.usp || ""}
                  onChange={(e) => setFormData({ ...formData, usp: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="values">Valori (separati da virgola)</Label>
                <Input
                  id="values"
                  type="text"
                  placeholder="Integrità, Trasparenza, Eccellenza..."
                  value={(formData.values || []).join(", ")}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    values: e.target.value.split(",").map(v => v.trim()).filter(Boolean)
                  })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Agent Instructions Panel - shown for both create and edit modes */}
          <AgentInstructionsPanel 
            agentId={isNewAgent ? null : agentId}
            mode={isNewAgent ? "create" : "edit"}
            initialData={isNewAgent ? {
              agentInstructions: formData.agentInstructions || null,
              agentInstructionsEnabled: formData.agentInstructionsEnabled || false,
              selectedTemplate: formData.selectedTemplate || "receptionist",
              agentName: formData.agentName || "",
            } : undefined}
            onChange={isNewAgent ? (data) => {
              setFormData({
                ...formData,
                agentInstructions: data.agentInstructions,
                agentInstructionsEnabled: data.agentInstructionsEnabled,
                selectedTemplate: data.selectedTemplate,
              });
            } : undefined}
            onSaveSuccess={() => {
              toast({
                title: "✅ Istruzioni salvate",
                description: "Le istruzioni dell'agente sono state aggiornate con successo",
              });
            }}
          />
        </div>

        {/* Save Button Footer */}
        <div className="flex justify-end gap-4 pt-6 border-t sticky bottom-0 bg-background pb-6">
          <Button variant="outline" onClick={() => navigate("/consultant/whatsapp")}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salva Configurazione
              </>
            )}
          </Button>
        </div>
      </div>
    </WhatsAppLayout>
  );
}
