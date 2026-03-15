import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stepper, Step } from "@/components/ui/stepper";
import { useToast } from "@/hooks/use-toast";
import { validateStep } from "@/lib/validation/whatsapp-config-schema";
import { ArrowLeft, ArrowRight, Save, Loader2, CheckCircle2, Info, Sparkles, Clock, Target, Heart, Shield, Briefcase, Users, Zap, Instagram } from "lucide-react";
import AgentBasicSetup from "./wizard-steps/AgentBasicSetup";
import AgentAvailability from "./wizard-steps/AgentAvailability";
import AgentBrandVoice from "./wizard-steps/AgentBrandVoice";
import AgentLevel from "./wizard-steps/AgentLevel";
import AgentInstructions from "./wizard-steps/AgentInstructions";
import AgentInstagram from "./wizard-steps/AgentInstagram";
import { INFORMATIVE_ADVISOR_TEMPLATE, RECEPTIONIST_TEMPLATE, MARCO_SETTER_TEMPLATE, CUSTOMER_SUCCESS_TEMPLATE, INTAKE_COORDINATOR_TEMPLATE } from "./AgentInstructionsPanel";
import { getAuthHeaders } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface WhatsAppAgentWizardProps {
  mode: "create" | "edit";
  initialData?: any;
  onSave: (data: any) => Promise<void>;
  onCancel?: () => void;
}

const baseSteps: Step[] = [
  {
    id: "basic",
    label: "Configurazione Base",
    description: "Nome e credenziali",
  },
  {
    id: "availability",
    label: "Disponibilità",
    description: "Orari e automazioni",
  },
  {
    id: "brand",
    label: "Brand Voice",
    description: "Info e credibilità",
  },
  {
    id: "level",
    label: "Dipendente AI",
    description: "Livello accesso",
  },
  {
    id: "instructions",
    label: "Istruzioni AI",
    description: "Template e personalità",
  },
];

const instagramStep: Step = {
  id: "instagram",
  label: "Instagram",
  description: "Collega account IG",
};

const emptyFormData = {
  agentName: "",
  integrationMode: "whatsapp_ai" as const,
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioWhatsappNumber: "",
  autoResponseEnabled: true,
  agentType: "reactive_lead" as const,
  whatsappConciseMode: true,
  isDryRun: true,
  isProactiveAgent: false,
  workingHoursEnabled: false,
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  afterHoursMessage: "Ciao! Ti risponderò durante i miei orari di lavoro.",
  bookingEnabled: true,
  ttsEnabled: true,
  audioResponseMode: "mirror" as const,
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
  defaultObiettivi: "",
  defaultDesideri: "",
  defaultUncino: "",
  defaultIdealState: "",
  agentInstructions: null,
  agentInstructionsEnabled: false,
  selectedTemplate: "receptionist" as const,
  useCentralCredentials: false,
  fileSearchCategories: {
    courses: false,
    lessons: false,
    exercises: false,
    knowledgeBase: false,
    library: false,
    university: false,
  },
  level: null as "1" | "2" | "3" | null,
  levels: [] as ("1" | "2")[],
  publicSlug: "",
  dailyMessageLimit: 15,
};

export default function WhatsAppAgentWizard({
  mode,
  initialData,
  onSave,
  onCancel,
}: WhatsAppAgentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(() => {
    const data = initialData || emptyFormData;
    return {
      ...data,
      integrationMode: data.integrationMode || "whatsapp_ai",
    };
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [instructionsSaved, setInstructionsSaved] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();
  const wizardTopRef = useRef<HTMLDivElement>(null);

  const scrollToTop = useCallback(() => {
    if (wizardTopRef.current) {
      wizardTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const steps = mode === "edit" ? [...baseSteps, instagramStep] : baseSteps;
  const lastMainStep = 4;

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        ...emptyFormData, 
        ...initialData,
        integrationMode: initialData.integrationMode || "whatsapp_ai"
      });
      // In edit mode, all'inizio non ci sono modifiche quindi le istruzioni sono "salvate"
      if (mode === "edit") {
        setInstructionsSaved(true);
      }
    }
  }, [initialData, mode]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => {
      const newData = { ...prev, [field]: value };
      
      if (field === "agentType") {
        newData.agentInstructionsEnabled = true;
        
        switch (value) {
          case "reactive_lead":
            if (mode === "create") newData.bookingEnabled = true;
            newData.selectedTemplate = "receptionist";
            newData.agentInstructions = RECEPTIONIST_TEMPLATE;
            break;
          case "proactive_setter":
            if (mode === "create") newData.bookingEnabled = true;
            newData.selectedTemplate = "marco_setter";
            newData.agentInstructions = MARCO_SETTER_TEMPLATE;
            break;
          case "informative_advisor":
            newData.bookingEnabled = false;
            newData.selectedTemplate = "informative_advisor";
            newData.agentInstructions = INFORMATIVE_ADVISOR_TEMPLATE;
            break;
          case "customer_success":
            newData.bookingEnabled = false;
            newData.selectedTemplate = "customer_success";
            newData.agentInstructions = CUSTOMER_SUCCESS_TEMPLATE;
            break;
          case "intake_coordinator":
            newData.bookingEnabled = false;
            newData.selectedTemplate = "intake_coordinator";
            newData.agentInstructions = INTAKE_COORDINATOR_TEMPLATE;
            break;
        }
      }
      
      return newData;
    });
    
    // Se modifico le istruzioni, resetto il flag di salvataggio (solo in edit mode)
    if (mode === "edit" && (field === "agentInstructions" || field === "agentInstructionsEnabled" || field === "selectedTemplate" || field === "businessHeaderMode" || field === "professionalRole" || field === "customBusinessHeader")) {
      setInstructionsSaved(false);
    }
    
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleInstructionsSaved = () => {
    setInstructionsSaved(true);
  };

  const fieldLabels: Record<string, string> = {
    agentName: "Nome Agente",
    twilioAccountSid: "Account SID Twilio",
    twilioAuthToken: "Auth Token Twilio",
    twilioWhatsappNumber: "Numero WhatsApp",
    workingHoursStart: "Orario Inizio",
    workingHoursEnd: "Orario Fine",
    workingDays: "Giorni Lavorativi",
    defaultObiettivi: "Obiettivi Default",
    defaultDesideri: "Desideri Default",
    defaultUncino: "Uncino Default",
    defaultIdealState: "Stato Ideale Default",
    publicSlug: "Slug URL Pubblico",
    dailyMessageLimit: "Limite Messaggi Giornalieri",
  };

  const handleNext = () => {
    const { isValid, errors } = validateStep(currentStep, formData, mode === "create");

    if (!isValid) {
      setValidationErrors(errors);
      const missingFields = Object.keys(errors).map(key => fieldLabels[key] || key).join(", ");
      toast({
        title: "⚠️ Campi obbligatori mancanti",
        description: `Compila: ${missingFields}`,
        variant: "destructive",
      });
      return;
    }

    setValidationErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    scrollToTop();
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    scrollToTop();
  };

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
      scrollToTop();
    }
  };

  const handleSave = async () => {
    // Valida tutti gli step prima di mostrare il dialog
    for (let i = 0; i <= 4; i++) {
      const { isValid, errors } = validateStep(i, formData, mode === "create");
      if (!isValid) {
        setValidationErrors(errors);
        setCurrentStep(i);
        const missingFields = Object.keys(errors).map(key => fieldLabels[key] || key).join(", ");
        toast({
          title: "⚠️ Errori di validazione",
          description: `Compila: ${missingFields}`,
          variant: "destructive",
        });
        return;
      }
    }

    setValidationErrors({});
    // Mostra dialog di conferma invece di salvare direttamente
    setShowConfirmDialog(true);
  };

  const confirmSave = async () => {
    setShowConfirmDialog(false);
    setIsSaving(true);

    // LOGGING DETTAGLIATO per debugging salvataggio feature blocks
    console.log("📋 [WIZARD] Salvataggio agente - Dati completi:", formData);
    
    // CRITICAL: Log per debug token Twilio
    console.log("🔑 [WIZARD] TWILIO CREDENTIALS DEBUG:", {
      useCentralCredentials: formData.useCentralCredentials,
      twilioAccountSidLength: formData.twilioAccountSid?.length || 0,
      twilioAuthTokenLength: formData.twilioAuthToken?.length || 0,
      twilioAuthTokenValue: formData.twilioAuthToken ? `"${formData.twilioAuthToken}"` : "EMPTY/NULL",
      twilioWhatsappNumber: formData.twilioWhatsappNumber,
    });
    
    if (!formData.useCentralCredentials && (!formData.twilioAuthToken || formData.twilioAuthToken.length === 0)) {
      console.warn("⚠️ [WIZARD] ATTENZIONE: useCentralCredentials è false E twilioAuthToken è vuoto! Il backend potrebbe non salvare il token.");
    }
    
    if (formData.useCentralCredentials) {
      console.log("✅ [WIZARD] useCentralCredentials=true - Il backend copierà le credenziali dalla tabella users");
    }
    
    console.log("📋 [WIZARD] Feature Blocks:", {
      bookingEnabled: formData.bookingEnabled,
    });
    console.log("🎙️ [WIZARD] TTS Configuration:", {
      ttsEnabled: formData.ttsEnabled,
      audioResponseMode: formData.audioResponseMode,
    });
    console.log("📋 [WIZARD] Agent Type:", formData.agentType);

    try {
      const agentId = initialData?.id;
      if (agentId && mode === "edit") {
        console.log("📋 [WIZARD] Auto-salvataggio istruzioni AI per agente:", agentId);
        const instructionsPayload = {
          agentInstructionsEnabled: formData.agentInstructionsEnabled ?? true,
          selectedTemplate: formData.selectedTemplate,
          agentInstructions: formData.agentInstructions,
          businessHeaderMode: formData.businessHeaderMode || "assistant",
          professionalRole: formData.professionalRole || "",
          customBusinessHeader: formData.customBusinessHeader || "",
        };
        const res = await fetch(`/api/whatsapp/config/${agentId}/instructions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(instructionsPayload),
        });
        if (!res.ok) {
          throw new Error(`Errore salvataggio istruzioni: ${res.status}`);
        }
        console.log("✅ [WIZARD] Istruzioni AI salvate con successo");
      }

      await onSave(formData);
      console.log("✅ [WIZARD] Salvataggio completato con successo");
      toast({
        title: "✅ Successo",
        description: mode === "create" ? "Agente creato con successo!" : "Agente aggiornato con successo!",
      });
    } catch (error) {
      console.error("❌ [WIZARD] Errore durante il salvataggio:", error);
      toast({
        title: "❌ Errore",
        description: "Impossibile salvare la configurazione",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      <div ref={wizardTopRef} className="bg-muted/30 rounded-lg p-6 border shadow-sm">
        <Stepper
          steps={steps}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border shadow-sm">
            <CardContent className="pt-6">
              {currentStep === 0 && (
                <AgentBasicSetup
                  formData={formData}
                  onChange={handleFieldChange}
                  errors={validationErrors}
                  mode={mode}
                />
              )}
              {currentStep === 1 && (
                <AgentAvailability
                  formData={formData}
                  onChange={handleFieldChange}
                  errors={validationErrors}
                />
              )}
              {currentStep === 2 && (
                <AgentBrandVoice
                  formData={formData}
                  onChange={handleFieldChange}
                  errors={validationErrors}
                  agentId={initialData?.id || null}
                />
              )}
              {currentStep === 3 && (
                <AgentLevel
                  formData={formData}
                  onChange={handleFieldChange}
                  errors={validationErrors}
                />
              )}
              {currentStep === 4 && (
                <AgentInstructions
                  formData={formData}
                  onChange={handleFieldChange}
                  errors={validationErrors}
                  mode={mode}
                  agentId={initialData?.id || null}
                  onInstructionsSaved={handleInstructionsSaved}
                />
              )}
              {currentStep === 5 && mode === "edit" && (
                <AgentInstagram
                  agentId={initialData?.id || null}
                  formData={formData}
                  onChange={handleFieldChange}
                  errors={validationErrors}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between pt-4">
        <div>
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Indietro
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Annulla
            </Button>
          )}

          {currentStep < lastMainStep ? (
            <Button onClick={handleNext} className="gap-2">
              Avanti
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : currentStep === lastMainStep ? (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salva Agente
                  </>
                )}
              </Button>
              {mode === "edit" && (
                <Button onClick={handleNext} variant="outline" className="gap-2">
                  <Instagram className="h-4 w-4" />
                  Instagram
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salva Agente
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Dialog di conferma con riepilogo */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh]">
          <DialogHeader className="space-y-3">
            <DialogTitle className="flex items-center gap-3 text-3xl">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              {mode === "create" ? "🎉 Conferma Creazione Agente" : "✨ Conferma Modifica Agente"}
            </DialogTitle>
            <DialogDescription className="text-base">
              Controlla attentamente tutte le impostazioni prima di salvare la configurazione dell'agente WhatsApp
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-4">
              {/* Step 1 - Configurazione Base */}
              <Card className="border shadow-sm">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <Zap className="h-5 w-5 text-primary" />
                    Configurazione Base
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome Agente</p>
                      <p className="text-lg font-bold text-primary">{formData.agentName || "Non specificato"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</p>
                      <Badge variant={formData.agentType === "proactive_lead" ? "default" : "secondary"} className="text-sm">
                        {formData.agentType === "proactive_lead" ? "🚀 Proattivo" : 
                         formData.agentType === "reactive_lead" ? "📱 Reattivo" : 
                         "📚 Educativo"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Numero WhatsApp</p>
                      <p className="text-sm font-mono font-medium">{formData.twilioWhatsappNumber || "Non specificato"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modalità</p>
                      <Badge variant={formData.isDryRun ? "outline" : "destructive"} className="text-sm">
                        {formData.isDryRun ? "🧪 Test (Dry Run)" : "🔴 Live"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risposte Auto</p>
                      <Badge variant={formData.autoResponseEnabled ? "default" : "secondary"} className="text-sm">
                        {formData.autoResponseEnabled ? "✓ Attive" : "✗ Disattivate"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modalità Concisa</p>
                      <Badge variant={formData.whatsappConciseMode ? "default" : "secondary"} className="text-sm">
                        {formData.whatsappConciseMode ? "✓ Attiva" : "✗ Disattivata"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 2 - Disponibilità */}
              <Card className="border shadow-sm">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-primary" />
                    Disponibilità e Funzionalità
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Orari di Lavoro</p>
                        {formData.workingHoursEnabled ? (
                          <p className="text-lg font-bold text-primary">
                            {formData.workingHoursStart} - {formData.workingHoursEnd}
                          </p>
                        ) : (
                          <Badge variant="outline" className="text-sm">24/7 Sempre disponibile</Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giorni Lavorativi</p>
                        <p className="text-lg font-bold text-primary">{formData.workingDays?.length || 0} giorni/settimana</p>
                      </div>
                    </div>
                    {formData.afterHoursMessage && (
                      <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📱 Messaggio Fuori Orario</p>
                        <p className="text-sm italic">"{formData.afterHoursMessage}"</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">⚡ Funzionalità Abilitate</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.bookingEnabled && (
                          <Badge variant="default" className="text-sm px-3 py-1">📅 Prenotazione</Badge>
                        )}
                        {formData.ttsEnabled && (
                          <Badge variant="default" className="text-sm px-3 py-1">🎙️ Audio TTS</Badge>
                        )}
                        {!formData.bookingEnabled && !formData.ttsEnabled && (
                          <Badge variant="secondary" className="text-sm">Nessuna funzionalità abilitata</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3 - Brand Voice */}
              <Card className="border shadow-sm">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <Heart className="h-5 w-5 text-primary" />
                    Brand Voice e Identità
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🏢 Nome Business</p>
                        <p className="text-lg font-bold text-primary">{formData.businessName || "Non specificato"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">👤 Consultant</p>
                        <p className="text-lg font-bold text-primary">{formData.consultantDisplayName || "Non specificato"}</p>
                      </div>
                    </div>
                    
                    {formData.businessDescription && (
                      <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📝 Descrizione</p>
                        <p className="text-sm">{formData.businessDescription}</p>
                      </div>
                    )}

                    {(formData.vision || formData.mission || formData.usp) && (
                      <div className="grid grid-cols-1 gap-3">
                        {formData.vision && (
                          <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🎯 Vision</p>
                            <p className="text-sm italic">{formData.vision}</p>
                          </div>
                        )}
                        {formData.mission && (
                          <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🚀 Mission</p>
                            <p className="text-sm italic">{formData.mission}</p>
                          </div>
                        )}
                        {formData.usp && (
                          <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">⭐ USP - Unique Selling Proposition</p>
                            <p className="text-sm font-medium">{formData.usp}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {formData.values && formData.values.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">💎 Valori</p>
                        <div className="flex flex-wrap gap-2">
                          {formData.values.map((value: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-sm px-3 py-1">{value}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1 text-center p-3 bg-muted/50 rounded-lg border">
                        <p className="text-2xl font-bold text-primary">{formData.yearsExperience || 0}</p>
                        <p className="text-xs font-semibold text-muted-foreground">Anni Esperienza</p>
                      </div>
                      <div className="space-y-1 text-center p-3 bg-muted/50 rounded-lg border">
                        <p className="text-2xl font-bold text-primary">{formData.clientsHelped || 0}</p>
                        <p className="text-xs font-semibold text-muted-foreground">Clienti Aiutati</p>
                      </div>
                      <div className="space-y-1 text-center p-3 bg-muted/50 rounded-lg border">
                        <p className="text-2xl font-bold text-primary">
                          {(formData.softwareCreated?.length || 0) + (formData.booksPublished?.length || 0) + (formData.caseStudies?.length || 0)}
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground">Progetti/Pubblicazioni</p>
                      </div>
                    </div>

                    {(formData.softwareCreated?.length > 0 || formData.booksPublished?.length > 0 || 
                      formData.caseStudies?.length > 0 || formData.servicesOffered?.length > 0) && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🏆 Credibilità & Risultati</p>
                        <div className="flex flex-wrap gap-2">
                          {formData.softwareCreated?.length > 0 && (
                            <Badge variant="outline" className="text-sm px-3 py-1">💻 {formData.softwareCreated.length} Software</Badge>
                          )}
                          {formData.booksPublished?.length > 0 && (
                            <Badge variant="outline" className="text-sm px-3 py-1">📚 {formData.booksPublished.length} Libri</Badge>
                          )}
                          {formData.caseStudies?.length > 0 && (
                            <Badge variant="outline" className="text-sm px-3 py-1">📊 {formData.caseStudies.length} Case Study</Badge>
                          )}
                          {formData.servicesOffered?.length > 0 && (
                            <Badge variant="outline" className="text-sm px-3 py-1">🎯 {formData.servicesOffered.length} Servizi</Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {formData.guarantees && (
                      <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Garanzie Offerte
                        </p>
                        <p className="text-sm">{formData.guarantees}</p>
                      </div>
                    )}

                    {(formData.whoWeHelp || formData.whoWeDontHelp || formData.whatWeDo || formData.howWeDoIt) && (
                      <div className="grid grid-cols-2 gap-3">
                        {formData.whoWeHelp && (
                          <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">✅ Chi Aiutiamo</p>
                            <p className="text-sm">{formData.whoWeHelp}</p>
                          </div>
                        )}
                        {formData.whoWeDontHelp && (
                          <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">⛔ Chi NON Aiutiamo</p>
                            <p className="text-sm">{formData.whoWeDontHelp}</p>
                          </div>
                        )}
                        {formData.whatWeDo && (
                          <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🎯 Cosa Facciamo</p>
                            <p className="text-sm">{formData.whatWeDo}</p>
                          </div>
                        )}
                        {formData.howWeDoIt && (
                          <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">⚙️ Come Lo Facciamo</p>
                            <p className="text-sm">{formData.howWeDoIt}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {formData.resultsGenerated && (
                      <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Target className="h-3 w-3" /> Risultati Generati
                        </p>
                        <p className="text-sm font-medium">{formData.resultsGenerated}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Step 4 - Istruzioni AI */}
              <Card className="border shadow-sm">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Istruzioni AI e Personalità
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📋 Template</p>
                        <Badge variant="default" className="text-sm px-4 py-2">
                          {formData.selectedTemplate === "receptionist" ? "🏢 Receptionist" :
                           formData.selectedTemplate === "salesperson" ? "💼 Venditore" :
                           formData.selectedTemplate === "informative_advisor" ? "📚 Advisor Educativo" :
                           "Custom"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🎭 Personalità</p>
                        <Badge variant="secondary" className="text-sm px-4 py-2">
                          {formData.aiPersonality === "amico_fidato" ? "👥 Amico Fidato" :
                           formData.aiPersonality === "coach_professionale" ? "🎯 Coach Professionale" :
                           formData.aiPersonality === "mentore_esperto" ? "🧑‍🏫 Mentore Esperto" :
                           formData.aiPersonality === "consulente_strategico" ? "💡 Consulente Strategico" :
                           "Non specificata"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🤖 Istruzioni Personalizzate</p>
                      <div className="p-4 bg-muted/50 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <Badge variant={formData.agentInstructionsEnabled ? "default" : "secondary"} className="text-sm px-3 py-1">
                            {formData.agentInstructionsEnabled ? "✓ Abilitate" : "✗ Disabilitate"}
                          </Badge>
                          {formData.agentInstructionsEnabled && formData.agentInstructions && (
                            <Badge variant="outline" className="text-sm">
                              {formData.agentInstructions.length.toLocaleString()} caratteri
                            </Badge>
                          )}
                        </div>
                        {formData.agentInstructionsEnabled && formData.agentInstructions && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Istruzioni custom configurate per guidare il comportamento dell'AI
                          </p>
                        )}
                      </div>
                    </div>

                    {(formData.defaultObiettivi || formData.defaultDesideri || formData.defaultUncino || formData.defaultIdealState) && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Users className="h-3 w-3" /> Framework di Conversazione
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {formData.defaultObiettivi && (
                            <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🎯 Obiettivi</p>
                              <p className="text-sm">{formData.defaultObiettivi}</p>
                            </div>
                          )}
                          {formData.defaultDesideri && (
                            <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">💭 Desideri</p>
                              <p className="text-sm">{formData.defaultDesideri}</p>
                            </div>
                          )}
                          {formData.defaultUncino && (
                            <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🪝 Uncino</p>
                              <p className="text-sm">{formData.defaultUncino}</p>
                            </div>
                          )}
                          {formData.defaultIdealState && (
                            <div className="space-y-1 p-3 bg-muted/50 rounded-lg border">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">✨ Stato Ideale</p>
                              <p className="text-sm">{formData.defaultIdealState}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSaving}
            >
              Annulla
            </Button>
            <Button
              onClick={confirmSave}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Conferma e Salva
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
