import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bot, 
  Phone, 
  Key, 
  Eye, 
  EyeOff, 
  MessageSquare, 
  Zap,
  User,
  Users,
  AlertCircle,
  Sparkles,
  GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentBasicSetupProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  mode: "create" | "edit";
}

const agentNameSuggestions = [
  { name: "Dot - Receptionist", icon: "👋" },
  { name: "Marco - Setter", icon: "🎯" },
  { name: "Sofia - Support", icon: "💬" },
];

export default function AgentBasicSetup({ formData, onChange, errors, mode }: AgentBasicSetupProps) {
  const [showAuthToken, setShowAuthToken] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          Configurazione Base
        </h2>
        <p className="text-muted-foreground">
          Imposta nome, tipo e credenziali per il tuo agente WhatsApp
        </p>
      </div>

      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Nome Agente
          </CardTitle>
          <CardDescription>Dai un nome identificativo al tuo agente</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label htmlFor="agentName" className="text-base">
              Nome Agente <span className="text-destructive">*</span>
            </Label>
            <Input
              id="agentName"
              value={formData.agentName}
              onChange={(e) => onChange("agentName", e.target.value)}
              placeholder="Es: Dot - Receptionist"
              className={cn(
                "mt-2 text-base",
                errors.agentName && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {errors.agentName && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.agentName}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <p className="text-sm text-muted-foreground w-full">Suggerimenti:</p>
            {agentNameSuggestions.map((suggestion) => (
              <button
                key={suggestion.name}
                type="button"
                onClick={() => onChange("agentName", suggestion.name)}
                className="px-3 py-1.5 text-sm rounded-full border border-primary/30 hover:bg-primary/10 transition-colors flex items-center gap-2"
              >
                <span>{suggestion.icon}</span>
                {suggestion.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-blue-500/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/5 to-blue-500/10">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            Tipo Agente
          </CardTitle>
          <CardDescription>Scegli come questo agente interagisce con i lead</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <RadioGroup
            value={formData.agentType}
            onValueChange={(value) => onChange("agentType", value)}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label
                htmlFor="reactive_lead"
                className={cn(
                  "relative cursor-pointer rounded-lg border-2 p-4 hover:border-primary/50 transition-all",
                  formData.agentType === "reactive_lead"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-muted"
                )}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="reactive_lead" id="reactive_lead" className="mt-1" />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-green-500" />
                      <p className="font-semibold">Receptionist (Inbound)</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Risponde a lead che scrivono spontaneamente. Accogliente e reattivo.
                    </p>
                  </div>
                </div>
              </label>

              <label
                htmlFor="proactive_setter"
                className={cn(
                  "relative cursor-pointer rounded-lg border-2 p-4 hover:border-primary/50 transition-all",
                  formData.agentType === "proactive_setter"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-muted"
                )}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="proactive_setter" id="proactive_setter" className="mt-1" />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-orange-500" />
                      <p className="font-semibold">Setter (Outbound)</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Contatta lead proattivamente per fissare appuntamenti. Diretto e persuasivo.
                    </p>
                  </div>
                </div>
              </label>

              <label
                htmlFor="informative_advisor"
                className={cn(
                  "relative cursor-pointer rounded-lg border-2 p-4 hover:border-primary/50 transition-all",
                  formData.agentType === "informative_advisor"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-muted"
                )}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="informative_advisor" id="informative_advisor" className="mt-1" />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-blue-500" />
                      <p className="font-semibold">Consulente Educativo (Informativo)</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Insegna e informa senza prendere appuntamenti. Educativo e paziente.
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="border-2 border-cyan-500/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-cyan-500/5 to-cyan-500/10">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-cyan-500" />
            Modalità di Integrazione
          </CardTitle>
          <CardDescription>Scegli se integrare WhatsApp o usare solo l'agente AI</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <RadioGroup
            value={formData.integrationMode || "whatsapp_ai"}
            onValueChange={(value) => onChange("integrationMode", value)}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label
                htmlFor="whatsapp_ai"
                className={cn(
                  "relative cursor-pointer rounded-lg border-2 p-4 hover:border-primary/50 transition-all",
                  (formData.integrationMode || "whatsapp_ai") === "whatsapp_ai"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-muted"
                )}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="whatsapp_ai" id="whatsapp_ai" className="mt-1" />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-green-500" />
                      <p className="font-semibold">WhatsApp + Agente AI</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Integrazione completa con WhatsApp tramite Twilio. L'agente risponderà su WhatsApp.
                    </p>
                    <div className="text-xs text-muted-foreground mt-2">
                      ✅ Richiede credenziali Twilio
                    </div>
                  </div>
                </div>
              </label>

              <label
                htmlFor="ai_only"
                className={cn(
                  "relative cursor-pointer rounded-lg border-2 p-4 hover:border-primary/50 transition-all",
                  formData.integrationMode === "ai_only"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-muted"
                )}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="ai_only" id="ai_only" className="mt-1" />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      <p className="font-semibold">Solo Agente AI</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Usa solo l'agente AI senza integrazione WhatsApp. Ideale per test o chat interne.
                    </p>
                    <div className="text-xs text-muted-foreground mt-2">
                      ⭕ Credenziali Twilio opzionali
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {(formData.integrationMode || "whatsapp_ai") === "whatsapp_ai" && (
        <Card className="border-2 border-purple-500/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-500/5 to-purple-500/10">
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-500" />
              Credenziali Twilio
            </CardTitle>
            <CardDescription>Inserisci le credenziali del tuo account Twilio</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
          <div>
            <Label htmlFor="twilioAccountSid">
              Account SID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="twilioAccountSid"
              value={formData.twilioAccountSid}
              onChange={(e) => onChange("twilioAccountSid", e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className={cn(
                "mt-2 font-mono text-sm",
                errors.twilioAccountSid && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {errors.twilioAccountSid && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.twilioAccountSid}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="twilioAuthToken">
              Auth Token <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-2">
              <Input
                id="twilioAuthToken"
                type={showAuthToken ? "text" : "password"}
                value={formData.twilioAuthToken}
                onChange={(e) => onChange("twilioAuthToken", e.target.value)}
                placeholder={mode === "edit" ? "••••••••••••••••" : "Inserisci Auth Token"}
                className={cn(
                  "font-mono text-sm pr-10",
                  errors.twilioAuthToken && "border-destructive focus-visible:ring-destructive"
                )}
              />
              <button
                type="button"
                onClick={() => setShowAuthToken(!showAuthToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.twilioAuthToken && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.twilioAuthToken}
              </p>
            )}
            {mode === "edit" && !formData.twilioAuthToken && (
              <p className="text-xs text-muted-foreground mt-1">
                Lascia vuoto per mantenere il token esistente
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="twilioWhatsappNumber">
              Numero WhatsApp <span className="text-destructive">*</span>
            </Label>
            <Input
              id="twilioWhatsappNumber"
              value={formData.twilioWhatsappNumber}
              onChange={(e) => onChange("twilioWhatsappNumber", e.target.value)}
              placeholder="whatsapp:+1234567890"
              className={cn(
                "mt-2 font-mono text-sm",
                errors.twilioWhatsappNumber && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {errors.twilioWhatsappNumber && (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.twilioWhatsappNumber}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Formato: whatsapp:+prefisso numero (es: whatsapp:+393501234567)
            </p>
          </div>
        </CardContent>
      </Card>
      )}

      <Card className="border-2 border-amber-500/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-amber-500/5 to-amber-500/10">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Opzioni Agente
          </CardTitle>
          <CardDescription>Configura il comportamento del tuo agente</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="autoResponseEnabled" className="text-base font-semibold cursor-pointer">
                Auto Response
              </Label>
              <p className="text-sm text-muted-foreground">
                Rispondi automaticamente ai messaggi in arrivo
              </p>
            </div>
            <Switch
              id="autoResponseEnabled"
              checked={formData.autoResponseEnabled}
              onCheckedChange={(checked) => onChange("autoResponseEnabled", checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="whatsappConciseMode" className="text-base font-semibold cursor-pointer">
                Modalità Concisa WhatsApp
              </Label>
              <p className="text-sm text-muted-foreground">
                Risposte brevi e dirette, ottimizzate per WhatsApp
              </p>
            </div>
            <Switch
              id="whatsappConciseMode"
              checked={formData.whatsappConciseMode}
              onCheckedChange={(checked) => onChange("whatsappConciseMode", checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="isDryRun" className="text-base font-semibold cursor-pointer">
                Dry Run Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Modalità test: l'agente non invierà messaggi reali
              </p>
            </div>
            <Switch
              id="isDryRun"
              checked={formData.isDryRun}
              onCheckedChange={(checked) => onChange("isDryRun", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {mode === "create" && (
        <Alert className="border-primary/50 bg-primary/5">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription>
            Assicurati di avere un account Twilio attivo e un numero WhatsApp configurato prima di procedere.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
