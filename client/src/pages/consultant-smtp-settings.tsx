import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Server, 
  Key, 
  Send, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Save,
  TestTube,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
  Calendar
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Interface for SMTP configuration settings
 */
interface SMTPSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  emailTone: "professionale" | "amichevole" | "motivazionale";
  emailSignature: string;
}

/**
 * SMTP connection status type
 */
type ConnectionStatus = "not-configured" | "active" | "error" | "testing";

/**
 * Consultant SMTP Settings Page
 * 
 * Allows consultants to configure SMTP settings for automated email sending.
 * Features include connection testing, status monitoring, and configuration management.
 */
export default function ConsultantSMTPSettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("not-configured");
  const [showPassword, setShowPassword] = useState(false);
  const [journeyTemplatesOpen, setJourneyTemplatesOpen] = useState(false);
  const [businessContext, setBusinessContext] = useState("");
  const [generationSuccess, setGenerationSuccess] = useState<{ count: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<SMTPSettings>({
    host: "",
    port: 587,
    secure: true,
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
    emailTone: "professionale",
    emailSignature: "",
  });

  // Load existing SMTP settings
  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ["/api/consultant/smtp-settings"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/smtp-settings", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch SMTP settings");
      }
      const data = await response.json();
      return data;
    },
  });

  // Update form data when existing settings are loaded
  useEffect(() => {
    if (existingSettings) {
      setFormData({
        host: existingSettings.smtpHost || "",
        port: existingSettings.smtpPort || 587,
        secure: existingSettings.smtpSecure ?? true,
        username: existingSettings.smtpUser || "",
        password: existingSettings.smtpPassword || "",
        fromEmail: existingSettings.fromEmail || "",
        fromName: existingSettings.fromName || "",
        emailTone: existingSettings.emailTone || "professionale",
        emailSignature: existingSettings.emailSignature || "",
      });
      setConnectionStatus("active");
    }
  }, [existingSettings]);

  // Save SMTP settings mutation
  const saveMutation = useMutation({
    mutationFn: async (settings: SMTPSettings) => {
      console.log("📤 [SMTP MUTATION] Settings received:", settings);
      console.log("📤 [SMTP MUTATION] Settings type:", typeof settings);
      console.log("📤 [SMTP MUTATION] Settings keys:", Object.keys(settings));
      
      let bodyString;
      try {
        bodyString = JSON.stringify(settings);
        console.log("✅ [SMTP MUTATION] JSON.stringify successful:", bodyString);
      } catch (error) {
        console.error("❌ [SMTP MUTATION] JSON.stringify failed:", error);
        throw error;
      }
      
      const response = await fetch("/api/consultant/smtp-settings", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: bodyString,
      });
      
      console.log("📥 [SMTP MUTATION] Response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ [SMTP MUTATION] Error response:", errorData);
        throw new Error(errorData.message || "Failed to save SMTP settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/smtp-settings"] });
      toast({
        title: "Successo",
        description: "Configurazione SMTP salvata con successo",
      });
      setConnectionStatus("active");
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio della configurazione",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (settings: SMTPSettings) => {
      const response = await fetch("/api/consultant/smtp-settings/test", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Connection test failed");
      }
      return response.json();
    },
    onMutate: () => {
      setConnectionStatus("testing");
    },
    onSuccess: () => {
      setConnectionStatus("active");
      toast({
        title: "Connessione Riuscita",
        description: "La connessione SMTP è stata verificata con successo",
      });
    },
    onError: (error: any) => {
      setConnectionStatus("error");
      toast({
        title: "Errore di Connessione",
        description: error.message || "Impossibile connettersi al server SMTP",
        variant: "destructive",
      });
    },
  });

  // Journey Templates Query
  const { data: journeyTemplatesData, isLoading: isLoadingJourneyTemplates } = useQuery({
    queryKey: ["/api/consultant/journey-templates"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/journey-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch journey templates");
      }
      const result = await response.json();
      return result.data || result; // Extract data field if present
    },
  });

  // Update businessContext when journey templates data is loaded
  useEffect(() => {
    if (journeyTemplatesData?.businessContext) {
      setBusinessContext(journeyTemplatesData.businessContext);
    }
  }, [journeyTemplatesData]);

  // Generate Journey Templates Mutation
  const generateTemplatesMutation = useMutation({
    mutationFn: async (context: string) => {
      const response = await fetch("/api/consultant/journey-templates/generate", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessContext: context }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate templates");
      }
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/journey-templates"] });
      const data = result.data || result;
      const count = data.templatesGenerated || data.count || 10;
      setGenerationSuccess({ count });
      toast({
        title: "Template Generati",
        description: `${count} template email personalizzati sono stati creati con successo`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore Generazione",
        description: error.message || "Errore durante la generazione dei template",
        variant: "destructive",
      });
    },
  });

  // Update Journey Templates Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { useCustomTemplates?: boolean; businessContext?: string }) => {
      const response = await fetch("/api/consultant/journey-templates/settings", {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/journey-templates"] });
      toast({
        title: "Impostazioni Aggiornate",
        description: "Le impostazioni dei template sono state aggiornate",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento delle impostazioni",
        variant: "destructive",
      });
    },
  });

  // Reset Journey Templates Mutation
  const resetTemplatesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/consultant/journey-templates", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reset templates");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/journey-templates"] });
      setGenerationSuccess(null);
      setBusinessContext("");
      toast({
        title: "Template Ripristinati",
        description: "I template email sono stati ripristinati ai valori predefiniti",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il ripristino dei template",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof SMTPSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Ensure all fields are properly formatted for JSON
    const dataToSave = {
      host: formData.host || "",
      port: Number(formData.port) || 587,
      secure: Boolean(formData.secure),
      username: formData.username || "",
      password: formData.password || "",
      fromEmail: formData.fromEmail || "",
      fromName: formData.fromName || "",
      emailTone: formData.emailTone || "professionale",
      emailSignature: formData.emailSignature || "",
    };
    
    console.log("🔍 [SMTP SAVE] Form data before save:", formData);
    console.log("🔍 [SMTP SAVE] Data to save:", dataToSave);
    console.log("🔍 [SMTP SAVE] Data to save (stringified):", JSON.stringify(dataToSave, null, 2));
    
    saveMutation.mutate(dataToSave);
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate(formData);
  };

  // Connection status indicator component
  const ConnectionStatusIndicator = () => {
    const statusConfig = {
      "not-configured": {
        icon: AlertCircle,
        color: "text-gray-500",
        bgColor: "bg-gray-100",
        label: "Non Configurato",
      },
      active: {
        icon: CheckCircle,
        color: "text-green-600",
        bgColor: "bg-green-100",
        label: "Attivo",
      },
      error: {
        icon: XCircle,
        color: "text-red-600",
        bgColor: "bg-red-100",
        label: "Errore",
      },
      testing: {
        icon: Loader2,
        color: "text-blue-600",
        bgColor: "bg-blue-100",
        label: "Test in corso...",
      },
    };

    const config = statusConfig[connectionStatus];
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${config.bgColor}`}>
        <Icon className={`h-5 w-5 ${config.color} ${connectionStatus === "testing" ? "animate-spin" : ""}`} />
        <span className={`font-semibold ${config.color}`}>{config.label}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-600">Caricamento configurazione...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-6 overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                      <Server className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-4xl font-bold">Configurazione SMTP</h1>
                      <p className="text-blue-100 text-lg">Gestisci le impostazioni email automatizzate</p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:block">
                  <ConnectionStatusIndicator />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Status Indicator */}
          {isMobile && (
            <div className="mb-6">
              <ConnectionStatusIndicator />
            </div>
          )}

          {/* SMTP Configuration Form */}
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-6 w-6" />
                  Configurazione Server SMTP
                </CardTitle>
                <CardDescription>
                  Configura il server SMTP per l'invio automatico di email ai tuoi clienti
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Server Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">Host SMTP</Label>
                    <Input
                      id="host"
                      placeholder="smtp.gmail.com"
                      value={formData.host}
                      onChange={(e) => handleInputChange("host", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Porta</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder="587"
                      value={formData.port}
                      onChange={(e) => handleInputChange("port", parseInt(e.target.value))}
                    />
                  </div>
                </div>

                {/* Secure Connection Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                  <div className="space-y-0.5">
                    <Label htmlFor="secure">Connessione Sicura (SSL/TLS)</Label>
                    <p className="text-sm text-muted-foreground">
                      Abilita la crittografia SSL/TLS per la connessione
                    </p>
                  </div>
                  <Switch
                    id="secure"
                    checked={formData.secure}
                    onCheckedChange={(checked) => handleInputChange("secure", checked)}
                  />
                </div>

                {/* Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username/Email</Label>
                    <Input
                      id="username"
                      placeholder="username@example.com"
                      value={formData.username}
                      onChange={(e) => handleInputChange("username", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? "Nascondi" : "Mostra"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Email Settings */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Impostazioni Email
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fromEmail">Email Mittente</Label>
                      <Input
                        id="fromEmail"
                        type="email"
                        placeholder="noreply@example.com"
                        value={formData.fromEmail}
                        onChange={(e) => handleInputChange("fromEmail", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fromName">Nome Mittente</Label>
                      <Input
                        id="fromName"
                        placeholder="Il Tuo Nome"
                        value={formData.fromName}
                        onChange={(e) => handleInputChange("fromName", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emailTone">Tono Email</Label>
                    <Select
                      value={formData.emailTone}
                      onValueChange={(value: any) => handleInputChange("emailTone", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona il tono delle email" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professionale">Professionale</SelectItem>
                        <SelectItem value="amichevole">Amichevole</SelectItem>
                        <SelectItem value="motivazionale">Motivazionale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emailSignature">Firma Email</Label>
                    <Textarea
                      id="emailSignature"
                      placeholder="La tua firma personalizzata..."
                      rows={4}
                      value={formData.emailSignature}
                      onChange={(e) => handleInputChange("emailSignature", e.target.value)}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={handleTestConnection}
                    disabled={testConnectionMutation.isPending}
                    variant="outline"
                    className="flex-1"
                  >
                    {testConnectionMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Test in corso...
                      </>
                    ) : (
                      <>
                        <TestTube className="mr-2 h-4 w-4" />
                        Test Connessione
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    {saveMutation.isPending ? (
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
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="mt-6 border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-900">Informazioni Importanti</h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>Assicurati di utilizzare credenziali valide per il server SMTP</li>
                      <li>Per Gmail, potrebbe essere necessario creare una "Password per App"</li>
                      <li>Testa sempre la connessione prima di salvare la configurazione</li>
                      <li>Le credenziali vengono salvate in modo sicuro e crittografato</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Journey Email Templates Section */}
            <Collapsible
              open={journeyTemplatesOpen}
              onOpenChange={setJourneyTemplatesOpen}
              className="mt-6"
            >
              <Card className="border-violet-200 shadow-lg overflow-hidden">
                <CollapsibleTrigger asChild>
                  <CardHeader className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white cursor-pointer hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                          <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-white text-xl">Personalizza Journey Email</CardTitle>
                          <CardDescription className="text-violet-100">
                            Genera template email personalizzati con l'AI
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {journeyTemplatesData?.useCustomTemplates && (
                          <Badge className="bg-white/20 text-white border-0">
                            Template Personalizzati Attivi
                          </Badge>
                        )}
                        {journeyTemplatesOpen ? (
                          <ChevronUp className="h-6 w-6 text-white" />
                        ) : (
                          <ChevronDown className="h-6 w-6 text-white" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-6 space-y-6">
                    {/* Business Context Textarea */}
                    <div className="space-y-2">
                      <Label htmlFor="businessContext" className="text-violet-900 font-medium">
                        Descrivi la tua attività
                      </Label>
                      <Textarea
                        id="businessContext"
                        placeholder="Descrivi in dettaglio la tua attività, i servizi che offri, il tuo target di clienti e il tono di comunicazione che preferisci. Ad esempio: 'Sono un consulente finanziario specializzato in pianificazione patrimoniale per famiglie. Offro servizi di investimento, protezione del patrimonio e pianificazione successoria. Il mio target sono famiglie con patrimonio medio-alto che cercano una consulenza personalizzata e a lungo termine.'"
                        rows={5}
                        value={businessContext}
                        onChange={(e) => setBusinessContext(e.target.value)}
                        className="border-violet-200 focus:border-violet-400 focus:ring-violet-400"
                      />
                      <p className="text-sm text-muted-foreground">
                        Più dettagli fornisci, più i template saranno personalizzati per la tua attività
                      </p>
                    </div>

                    {/* Generate Button */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => generateTemplatesMutation.mutate(businessContext)}
                        disabled={generateTemplatesMutation.isPending || !businessContext.trim()}
                        className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                      >
                        {generateTemplatesMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generazione in corso... (~30 secondi)
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Genera Template Personalizzati
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Generation Success Message */}
                    {(generationSuccess || journeyTemplatesData?.lastGeneratedAt) && (
                      <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="font-medium">
                            {generationSuccess 
                              ? `${generationSuccess.count} template generati con successo!`
                              : "Template personalizzati disponibili"}
                          </span>
                        </div>
                        {journeyTemplatesData?.lastGeneratedAt && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Generati il: {new Date(journeyTemplatesData.lastGeneratedAt).toLocaleString("it-IT")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Use Custom Templates Switch */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-violet-50 border border-violet-200">
                      <div className="space-y-0.5">
                        <Label htmlFor="useCustomTemplates" className="text-violet-900 font-medium">
                          Usa Template Personalizzati
                        </Label>
                        <p className="text-sm text-violet-700">
                          Abilita l'uso dei template generati con l'AI per le email di journey
                        </p>
                      </div>
                      <Switch
                        id="useCustomTemplates"
                        checked={journeyTemplatesData?.useCustomTemplates ?? false}
                        onCheckedChange={(checked) => 
                          updateSettingsMutation.mutate({ useCustomTemplates: checked })
                        }
                        disabled={updateSettingsMutation.isPending || !journeyTemplatesData?.lastGeneratedAt}
                        className="data-[state=checked]:bg-violet-600"
                      />
                    </div>

                    {/* Reset Button */}
                    <div className="pt-4 border-t border-violet-100">
                      <Button
                        onClick={() => resetTemplatesMutation.mutate()}
                        disabled={resetTemplatesMutation.isPending}
                        variant="outline"
                        className="border-violet-300 text-violet-700 hover:bg-violet-50 hover:text-violet-800"
                      >
                        {resetTemplatesMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Ripristino in corso...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Ripristina Default
                          </>
                        )}
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        Ripristina i template email ai valori predefiniti del sistema
                      </p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </div>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}
