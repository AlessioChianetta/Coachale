import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stepper, Step } from "@/components/ui/stepper";
import { useToast } from "@/hooks/use-toast";
import { validateStep } from "@/lib/validation/whatsapp-config-schema";
import { ArrowLeft, ArrowRight, Save, Loader2, CheckCircle2, Info, Sparkles, Clock, Target, Heart, Shield, Briefcase, Users, Zap } from "lucide-react";
import AgentBasicSetup from "./wizard-steps/AgentBasicSetup";
import AgentAvailability from "./wizard-steps/AgentAvailability";
import AgentBrandVoice from "./wizard-steps/AgentBrandVoice";
import AgentInstructions from "./wizard-steps/AgentInstructions";
import { INFORMATIVE_ADVISOR_TEMPLATE } from "./AgentInstructionsPanel";
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

const steps: Step[] = [
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
    id: "instructions",
    label: "Istruzioni AI",
    description: "Template e personalità",
  },
];

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
  objectionHandlingEnabled: true,
  disqualificationEnabled: true,
  upsellingEnabled: false,
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
      
      // REGOLA SPECIALE: Se agentType diventa "informative_advisor", configura template educativo
      if (field === "agentType" && value === "informative_advisor") {
        newData.bookingEnabled = false;
        newData.selectedTemplate = "informative_advisor";
        newData.agentInstructions = INFORMATIVE_ADVISOR_TEMPLATE;
        newData.agentInstructionsEnabled = true;
      }
      
      // REGOLA SPECIALE: Se agentType torna a reactive_lead, configura template receptionist
      if (field === "agentType" && value === "reactive_lead") {
        // Durante CREAZIONE: imposta bookingEnabled=true
        // Durante EDIT: rispetta il valore esistente
        if (mode === "create") {
          newData.bookingEnabled = true;
        }
        newData.selectedTemplate = "receptionist";
      }
      
      // REGOLA SPECIALE: Se agentType diventa proactive_setter, configura template marco_setter
      if (field === "agentType" && value === "proactive_setter") {
        // Durante CREAZIONE: imposta bookingEnabled=true
        // Durante EDIT: rispetta il valore esistente
        if (mode === "create") {
          newData.bookingEnabled = true;
        }
        newData.selectedTemplate = "marco_setter";
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

  const handleNext = () => {
    const { isValid, errors } = validateStep(currentStep, formData, mode === "create");

    if (!isValid) {
      setValidationErrors(errors);
      toast({
        title: "⚠️ Campi obbligatori mancanti",
        description: `Completa i campi richiesti prima di continuare`,
        variant: "destructive",
      });
      return;
    }

    setValidationErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
    }
  };

  const handleSave = async () => {
    // Valida tutti gli step prima di mostrare il dialog
    for (let i = 0; i <= 3; i++) {
      const { isValid, errors } = validateStep(i, formData, mode === "create");
      if (!isValid) {
        setValidationErrors(errors);
        setCurrentStep(i);
        toast({
          title: "⚠️ Errori di validazione",
          description: `Correggi gli errori nello step ${i + 1}`,
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
    console.log("📋 [WIZARD] Feature Blocks:", {
      bookingEnabled: formData.bookingEnabled,
      objectionHandlingEnabled: formData.objectionHandlingEnabled,
      disqualificationEnabled: formData.disqualificationEnabled,
      upsellingEnabled: formData.upsellingEnabled,
    });
    console.log("🎙️ [WIZARD] TTS Configuration:", {
      ttsEnabled: formData.ttsEnabled,
      audioResponseMode: formData.audioResponseMode,
    });
    console.log("📋 [WIZARD] Agent Type:", formData.agentType);

    try {
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
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background rounded-lg p-6 shadow-lg">
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
          <Card className="shadow-xl">
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
                <AgentInstructions
                  formData={formData}
                  onChange={handleFieldChange}
                  errors={validationErrors}
                  mode={mode}
                  agentId={initialData?.id || null}
                  onInstructionsSaved={handleInstructionsSaved}
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

          {currentStep < steps.length - 1 ? (
            <Button onClick={handleNext} className="gap-2">
              Avanti
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving || (mode === "edit" && !instructionsSaved)}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {mode === "edit" && !instructionsSaved ? "Salva prima le istruzioni" : "Salva Agente"}
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
              <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg">
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
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-primary/10 rounded-lg">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
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
              <Card className="border-2 border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-background dark:from-blue-950/20 dark:to-background">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    Disponibilità e Funzionalità
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Orari di Lavoro</p>
                        {formData.workingHoursEnabled ? (
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {formData.workingHoursStart} - {formData.workingHoursEnd}
                          </p>
                        ) : (
                          <Badge variant="outline" className="text-sm">24/7 Sempre disponibile</Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giorni Lavorativi</p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formData.workingDays?.length || 0} giorni/settimana</p>
                      </div>
                    </div>
                    {formData.afterHoursMessage && (
                      <div className="space-y-1 p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">📱 Messaggio Fuori Orario</p>
                        <p className="text-sm text-amber-900 dark:text-amber-200 italic">"{formData.afterHoursMessage}"</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">⚡ Funzionalità Abilitate</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.bookingEnabled && (
                          <Badge variant="default" className="text-sm px-3 py-1">📅 Prenotazione</Badge>
                        )}
                        {formData.objectionHandlingEnabled && (
                          <Badge variant="default" className="text-sm px-3 py-1">💬 Obiezioni</Badge>
                        )}
                        {formData.disqualificationEnabled && (
                          <Badge variant="default" className="text-sm px-3 py-1">🚫 Disqualifica</Badge>
                        )}
                        {formData.upsellingEnabled && (
                          <Badge variant="default" className="text-sm px-3 py-1">💰 Upselling</Badge>
                        )}
                        {!formData.bookingEnabled && !formData.objectionHandlingEnabled && 
                         !formData.disqualificationEnabled && !formData.upsellingEnabled && (
                          <Badge variant="secondary" className="text-sm">Nessuna funzionalità abilitata</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3 - Brand Voice */}
              <Card className="border-2 border-purple-200/50 bg-gradient-to-br from-purple-50/50 to-background dark:from-purple-950/20 dark:to-background">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Heart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    Brand Voice e Identità
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🏢 Nome Business</p>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{formData.businessName || "Non specificato"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">👤 Consultant</p>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{formData.consultantDisplayName || "Non specificato"}</p>
                      </div>
                    </div>
                    
                    {formData.businessDescription && (
                      <div className="space-y-1 p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-200/50 dark:border-purple-800/30">
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wide">📝 Descrizione</p>
                        <p className="text-sm text-purple-900 dark:text-purple-200">{formData.businessDescription}</p>
                      </div>
                    )}

                    {(formData.vision || formData.mission || formData.usp) && (
                      <div className="grid grid-cols-1 gap-3">
                        {formData.vision && (
                          <div className="space-y-1 p-3 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-lg border border-indigo-200/50 dark:border-indigo-800/30">
                            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">🎯 Vision</p>
                            <p className="text-sm text-indigo-900 dark:text-indigo-200 italic">{formData.vision}</p>
                          </div>
                        )}
                        {formData.mission && (
                          <div className="space-y-1 p-3 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg border border-purple-200/50 dark:border-purple-800/30">
                            <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wide">🚀 Mission</p>
                            <p className="text-sm text-purple-900 dark:text-purple-200 italic">{formData.mission}</p>
                          </div>
                        )}
                        {formData.usp && (
                          <div className="space-y-1 p-3 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">⭐ USP - Unique Selling Proposition</p>
                            <p className="text-sm text-amber-900 dark:text-amber-200 font-medium">{formData.usp}</p>
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
                      <div className="space-y-1 text-center p-3 bg-gradient-to-br from-emerald-50/50 to-green-50/50 dark:from-emerald-950/20 dark:to-green-950/20 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formData.yearsExperience || 0}</p>
                        <p className="text-xs font-semibold text-muted-foreground">Anni Esperienza</p>
                      </div>
                      <div className="space-y-1 text-center p-3 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formData.clientsHelped || 0}</p>
                        <p className="text-xs font-semibold text-muted-foreground">Clienti Aiutati</p>
                      </div>
                      <div className="space-y-1 text-center p-3 bg-gradient-to-br from-pink-50/50 to-rose-50/50 dark:from-pink-950/20 dark:to-rose-950/20 rounded-lg">
                        <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
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
                      <div className="space-y-1 p-3 bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200/50 dark:border-green-800/30">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Garanzie Offerte
                        </p>
                        <p className="text-sm text-green-900 dark:text-green-200">{formData.guarantees}</p>
                      </div>
                    )}

                    {(formData.whoWeHelp || formData.whoWeDontHelp || formData.whatWeDo || formData.howWeDoIt) && (
                      <div className="grid grid-cols-2 gap-3">
                        {formData.whoWeHelp && (
                          <div className="space-y-1 p-3 bg-teal-50/50 dark:bg-teal-950/20 rounded-lg border border-teal-200/50 dark:border-teal-800/30">
                            <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide">✅ Chi Aiutiamo</p>
                            <p className="text-sm text-teal-900 dark:text-teal-200">{formData.whoWeHelp}</p>
                          </div>
                        )}
                        {formData.whoWeDontHelp && (
                          <div className="space-y-1 p-3 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-200/50 dark:border-red-800/30">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">⛔ Chi NON Aiutiamo</p>
                            <p className="text-sm text-red-900 dark:text-red-200">{formData.whoWeDontHelp}</p>
                          </div>
                        )}
                        {formData.whatWeDo && (
                          <div className="space-y-1 p-3 bg-cyan-50/50 dark:bg-cyan-950/20 rounded-lg border border-cyan-200/50 dark:border-cyan-800/30">
                            <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wide">🎯 Cosa Facciamo</p>
                            <p className="text-sm text-cyan-900 dark:text-cyan-200">{formData.whatWeDo}</p>
                          </div>
                        )}
                        {formData.howWeDoIt && (
                          <div className="space-y-1 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200/50 dark:border-indigo-800/30">
                            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">⚙️ Come Lo Facciamo</p>
                            <p className="text-sm text-indigo-900 dark:text-indigo-200">{formData.howWeDoIt}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {formData.resultsGenerated && (
                      <div className="space-y-1 p-3 bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-lg border border-orange-200/50 dark:border-orange-800/30">
                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide flex items-center gap-1">
                          <Target className="h-3 w-3" /> Risultati Generati
                        </p>
                        <p className="text-sm text-orange-900 dark:text-orange-200 font-medium">{formData.resultsGenerated}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Step 4 - Istruzioni AI */}
              <Card className="border-2 border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20 dark:to-background">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <Briefcase className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
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
                      <div className="p-4 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-lg border border-emerald-200/50 dark:border-emerald-800/30">
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
                            <div className="space-y-1 p-3 bg-sky-50/50 dark:bg-sky-950/20 rounded-lg border border-sky-200/50 dark:border-sky-800/30">
                              <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wide">🎯 Obiettivi</p>
                              <p className="text-sm text-sky-900 dark:text-sky-200">{formData.defaultObiettivi}</p>
                            </div>
                          )}
                          {formData.defaultDesideri && (
                            <div className="space-y-1 p-3 bg-pink-50/50 dark:bg-pink-950/20 rounded-lg border border-pink-200/50 dark:border-pink-800/30">
                              <p className="text-xs font-semibold text-pink-700 dark:text-pink-400 uppercase tracking-wide">💭 Desideri</p>
                              <p className="text-sm text-pink-900 dark:text-pink-200">{formData.defaultDesideri}</p>
                            </div>
                          )}
                          {formData.defaultUncino && (
                            <div className="space-y-1 p-3 bg-violet-50/50 dark:bg-violet-950/20 rounded-lg border border-violet-200/50 dark:border-violet-800/30">
                              <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide">🪝 Uncino</p>
                              <p className="text-sm text-violet-900 dark:text-violet-200">{formData.defaultUncino}</p>
                            </div>
                          )}
                          {formData.defaultIdealState && (
                            <div className="space-y-1 p-3 bg-lime-50/50 dark:bg-lime-950/20 rounded-lg border border-lime-200/50 dark:border-lime-800/30">
                              <p className="text-xs font-semibold text-lime-700 dark:text-lime-400 uppercase tracking-wide">✨ Stato Ideale</p>
                              <p className="text-sm text-lime-900 dark:text-lime-200">{formData.defaultIdealState}</p>
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
              className="gap-2 bg-gradient-to-r from-primary to-primary/80"
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
