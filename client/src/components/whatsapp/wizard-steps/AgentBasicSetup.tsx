import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  GraduationCap,
  HeartHandshake,
  ClipboardList,
  CheckCircle,
  ExternalLink,
  Loader2,
  Bell,
  CalendarCheck
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import { Link } from "wouter";

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

  const { data: twilioSettings, isLoading: isLoadingTwilio } = useQuery({
    queryKey: ["/api/consultant/twilio-settings"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/twilio-settings", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
  });

  // Fetch all Twilio templates
  const { data: allTemplatesData } = useQuery({
    queryKey: ["/api/whatsapp/templates"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return { templates: [] };
      }
      return response.json();
    },
  });

  // Fetch custom templates for booking notifications
  const { data: customTemplatesData } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return { data: [] };
      }
      return response.json();
    },
  });

  // Filter templates: approved status and assigned to current agent (via whatsappTemplates config)
  const approvedTemplates = React.useMemo(() => {
    const templates = allTemplatesData?.templates || [];
    // Get assigned template SIDs from formData.whatsappTemplates
    const assignedSids = new Set<string>();
    if (formData.whatsappTemplates) {
      Object.values(formData.whatsappTemplates).forEach((sid: any) => {
        if (sid) assignedSids.add(sid);
      });
    }
    // Filter for approved templates that are assigned to this agent
    return templates.filter((t: any) => {
      const isApproved = t.approvalStatus?.toLowerCase() === 'approved';
      const isAssigned = assignedSids.size === 0 || assignedSids.has(t.contentSid);
      return isApproved && (assignedSids.size === 0 || isAssigned);
    });
  }, [allTemplatesData, formData.whatsappTemplates]);

  // Booking notification templates: include custom templates + approved Twilio templates
  const bookingNotificationTemplates = React.useMemo(() => {
    const result: any[] = [];
    const addedIds = new Set<string>();
    
    // Debug: log raw data
    const customTemplates = customTemplatesData?.data || [];
    const twilioTemplates = allTemplatesData?.templates || [];
    
    console.log('[BOOKING DEBUG] customTemplates count:', customTemplates.length);
    console.log('[BOOKING DEBUG] twilioTemplates count:', twilioTemplates.length);
    
    // Add custom templates (especially booking_notification type)
    customTemplates.forEach((t: any, idx: number) => {
      console.log(`[BOOKING DEBUG] Custom template ${idx}:`, { id: t.id, name: t.templateName, isActive: t.isActive, twilioContentSid: t.twilioContentSid });
      if (t.isActive && t.id && !addedIds.has(t.id)) {
        addedIds.add(t.id);
        // Also track twilioContentSid to avoid duplicates from Twilio list
        if (t.twilioContentSid) {
          addedIds.add(t.twilioContentSid);
        }
        result.push({
          id: t.id,
          templateName: t.templateName,
          templateType: t.templateType,
          isCustom: true,
          twilioSid: t.twilioContentSid,
          approvalStatus: t.twilioApprovalStatus || 'draft',
        });
      }
    });
    
    // Add approved Twilio templates (only if not already added via custom templates)
    // Note: Twilio API returns "sid" field, not "contentSid"
    twilioTemplates.forEach((t: any, idx: number) => {
      const isApproved = t.approvalStatus?.toLowerCase() === 'approved';
      const templateSid = t.sid || t.contentSid; // Use sid (Twilio API) or contentSid (fallback)
      if (idx < 3) {
        console.log(`[BOOKING DEBUG] Twilio template ${idx}:`, { sid: templateSid, name: t.friendlyName, approvalStatus: t.approvalStatus, isApproved });
      }
      if (isApproved && templateSid && !addedIds.has(templateSid)) {
        addedIds.add(templateSid);
        result.push({
          id: templateSid,
          templateName: t.friendlyName || t.name,
          isCustom: false,
          twilioSid: templateSid,
          approvalStatus: 'approved',
        });
      }
    });
    
    console.log('[BOOKING TEMPLATES] Final result:', result.map(r => ({ id: r.id, name: r.templateName })));
    return result;
  }, [customTemplatesData, allTemplatesData]);

  // Check if selected template has booking variables
  const { data: templateVariables } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates/variables", formData.bookingNotificationTemplateId],
    queryFn: async () => {
      if (!formData.bookingNotificationTemplateId) return null;
      const response = await fetch(`/api/whatsapp/custom-templates/${formData.bookingNotificationTemplateId}/variables`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!formData.bookingNotificationTemplateId,
  });

  // Check if template has all required booking variables
  const requiredBookingVars = ['booking_client_name', 'booking_date', 'booking_time', 'booking_meet_link'];
  const templateHasBookingVars = React.useMemo(() => {
    if (!templateVariables?.data) return null; // unknown
    const varKeys = templateVariables.data.map((v: any) => v.variableKey);
    return requiredBookingVars.every(key => varKeys.includes(key));
  }, [templateVariables]);

  const missingBookingVars = React.useMemo(() => {
    if (!templateVariables?.data) return requiredBookingVars;
    const varKeys = templateVariables.data.map((v: any) => v.variableKey);
    return requiredBookingVars.filter(key => !varKeys.includes(key));
  }, [templateVariables]);

  // FIX: Backend returns { settings: { accountSid, hasAuthToken, whatsappNumber } }
  const hasTwilioConfigured = !!(twilioSettings?.settings?.accountSid && twilioSettings?.settings?.hasAuthToken);

  useEffect(() => {
    const isWhatsAppMode = (formData.integrationMode || "whatsapp_ai") === "whatsapp_ai";
    
    if (twilioSettings?.settings && hasTwilioConfigured && isWhatsAppMode) {
      // Sync the accountSid for display purposes
      if (twilioSettings.settings.accountSid && formData.twilioAccountSid !== twilioSettings.settings.accountSid) {
        onChange("twilioAccountSid", twilioSettings.settings.accountSid);
      }
      // Set flag to use central credentials - backend will copy Account SID and Auth Token
      if (!formData.useCentralCredentials) {
        onChange("useCentralCredentials", true);
      }
    } else if (!isWhatsAppMode && formData.useCentralCredentials) {
      // Reset flag when switching to AI-only mode
      onChange("useCentralCredentials", false);
    } else if (!hasTwilioConfigured && formData.useCentralCredentials) {
      // Reset flag when central credentials are not available
      onChange("useCentralCredentials", false);
    }
  }, [twilioSettings, hasTwilioConfigured, formData.integrationMode]);

  // Pre-populate booking notification phone from consultant WhatsApp number when enabled
  useEffect(() => {
    if (formData.bookingNotificationEnabled && !formData.bookingNotificationPhone) {
      // Use the consultant's WhatsApp number as default
      const consultantWhatsappNumber = twilioSettings?.settings?.whatsappNumber;
      if (consultantWhatsappNumber) {
        onChange("bookingNotificationPhone", consultantWhatsappNumber);
      }
    }
  }, [formData.bookingNotificationEnabled, twilioSettings]);

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
            <div className="space-y-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label
                  htmlFor="customer_success"
                  className={cn(
                    "relative cursor-pointer rounded-lg border-2 p-4 hover:border-primary/50 transition-all",
                    formData.agentType === "customer_success"
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="customer_success" id="customer_success" className="mt-1" />
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <HeartHandshake className="h-5 w-5 text-purple-500" />
                        <p className="font-semibold">Customer Success (Post-Vendita)</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Supporta clienti post-acquisto. Risolve problemi e fidelizza.
                      </p>
                      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        ❌ NO Booking
                      </div>
                    </div>
                  </div>
                </label>

                <label
                  htmlFor="intake_coordinator"
                  className={cn(
                    "relative cursor-pointer rounded-lg border-2 p-4 hover:border-primary/50 transition-all",
                    formData.agentType === "intake_coordinator"
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="intake_coordinator" id="intake_coordinator" className="mt-1" />
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-indigo-500" />
                        <p className="font-semibold">Intake Coordinator (Documenti)</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Raccoglie documenti prima degli appuntamenti. Organizzato e preciso.
                      </p>
                      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        ❌ NO Booking
                      </div>
                    </div>
                  </div>
                </label>
              </div>
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
            <CardDescription>Account e Auth Token dalle impostazioni centralizzate, numero WhatsApp specifico per agente</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {isLoadingTwilio ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Caricamento credenziali...</span>
              </div>
            ) : hasTwilioConfigured ? (
              <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <div className="space-y-2">
                    <p className="font-medium">Account Twilio configurato</p>
                    <div className="text-sm space-y-1">
                      <p><span className="font-medium">Account SID:</span> {twilioSettings?.settings?.accountSid?.substring(0, 10)}...</p>
                      <p><span className="font-medium">Auth Token:</span> ••••••••••••</p>
                    </div>
                    <Link href="/consultant/api-keys-unified?tab=twilio">
                      <Button variant="outline" size="sm" className="mt-2 gap-2">
                        <ExternalLink className="h-3 w-3" />
                        Modifica Account Twilio
                      </Button>
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <div className="space-y-2">
                    <p className="font-medium">Account Twilio non configurato</p>
                    <p className="text-sm">
                      Prima di poter utilizzare WhatsApp, devi configurare le credenziali Twilio nelle impostazioni centralizzate.
                    </p>
                    <Link href="/consultant/api-keys-unified?tab=twilio">
                      <Button variant="default" size="sm" className="mt-2 gap-2">
                        <ExternalLink className="h-3 w-3" />
                        Configura Account Twilio
                      </Button>
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="twilioWhatsappNumber">
                Numero WhatsApp per questo Agente <span className="text-destructive">*</span>
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

          <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="isProactiveAgent" className="text-base font-semibold cursor-pointer">
                Modalità Proattiva
              </Label>
              <p className="text-sm text-muted-foreground">
                L'agente può iniziare conversazioni (outreach) invece di solo rispondere
              </p>
            </div>
            <Switch
              id="isProactiveAgent"
              checked={formData.isProactiveAgent}
              onCheckedChange={(checked) => onChange("isProactiveAgent", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-orange-500/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-orange-500/5 to-orange-500/10">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-500" />
            Notifiche Appuntamenti
          </CardTitle>
          <CardDescription>
            Ricevi una notifica WhatsApp quando viene prenotato un appuntamento
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="bookingNotificationEnabled" className="text-base font-semibold cursor-pointer flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-orange-500" />
                Abilita Notifiche
              </Label>
              <p className="text-sm text-muted-foreground">
                Invia un messaggio WhatsApp quando viene confermato un nuovo appuntamento
              </p>
            </div>
            <Switch
              id="bookingNotificationEnabled"
              checked={formData.bookingNotificationEnabled}
              onCheckedChange={(checked) => onChange("bookingNotificationEnabled", checked)}
            />
          </div>

          {formData.bookingNotificationEnabled && (
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="bookingNotificationPhone" className="text-base">
                  Numero WhatsApp destinatario
                </Label>
                <Input
                  id="bookingNotificationPhone"
                  value={formData.bookingNotificationPhone || ""}
                  onChange={(e) => onChange("bookingNotificationPhone", e.target.value)}
                  placeholder="Es: +39 333 1234567"
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Inserisci il numero con prefisso internazionale (es: +39)
                </p>
              </div>

              <div>
                <Label htmlFor="bookingNotificationTemplateId" className="text-base">
                  Template Messaggio
                </Label>
                <Select
                  value={formData.bookingNotificationTemplateId || ""}
                  onValueChange={(value) => onChange("bookingNotificationTemplateId", value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Seleziona un template" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingNotificationTemplates.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        Nessun template disponibile. Importa il template Booking dalla pagina Template Custom.
                      </div>
                    ) : (
                      bookingNotificationTemplates.map((template: any) => {
                        const statusBadge = template.approvalStatus === 'approved' 
                          ? ' [Approvato]' 
                          : template.twilioSid 
                            ? ' [In attesa]' 
                            : ' [Bozza]';
                        return (
                          <SelectItem key={template.id} value={template.id}>
                            {template.templateName}{statusBadge}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Seleziona un template con le variabili booking. Deve essere approvato da Meta per inviare notifiche.
                </p>
              </div>

              {/* Alert if selected template is missing booking variables */}
              {formData.bookingNotificationTemplateId && templateHasBookingVars === false && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <span className="font-semibold">Variabili mancanti nel template:</span>{" "}
                    {missingBookingVars.map(v => v.replace('booking_', '').replace('_', ' ')).join(', ')}.
                    <Link href="/consultant/whatsapp-custom-templates" className="ml-2 text-amber-700 underline hover:text-amber-900">
                      Vai a configurare le variabili →
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
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
