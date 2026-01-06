import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { getAuthHeaders } from "@/lib/auth";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Check,
  Circle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Mail,
  Calendar,
  Video,
  UserPlus,
  MessageSquare,
  FileText,
  Settings,
  ExternalLink,
  Loader2,
  RefreshCw,
  Rocket,
  Bot,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Briefcase,
  Link as LinkIcon,
  Lightbulb,
  BookOpen,
  ClipboardList,
  MailCheck,
  Phone,
  Instagram,
  CreditCard,
} from "lucide-react";

type StepStatus = "pending" | "configured" | "verified" | "error" | "skipped";

interface OnboardingStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: StepStatus;
  testedAt?: string;
  errorMessage?: string;
  configLink: string;
  testEndpoint?: string;
  count?: number;
  countLabel?: string;
}

interface Phase {
  id: string;
  title: string;
  steps: OnboardingStep[];
}

interface OnboardingStatus {
  id: string;
  consultantId: string;
  vertexAiStatus: StepStatus;
  vertexAiTestedAt?: string;
  vertexAiErrorMessage?: string;
  smtpStatus: StepStatus;
  smtpTestedAt?: string;
  smtpErrorMessage?: string;
  googleCalendarStatus: StepStatus;
  googleCalendarTestedAt?: string;
  googleCalendarErrorMessage?: string;
  videoMeetingStatus: StepStatus;
  videoMeetingTestedAt?: string;
  videoMeetingErrorMessage?: string;
  leadImportStatus: StepStatus;
  leadImportTestedAt?: string;
  leadImportErrorMessage?: string;
  whatsappAiStatus: StepStatus;
  whatsappAiTestedAt?: string;
  whatsappAiErrorMessage?: string;
  knowledgeBaseStatus: StepStatus;
  knowledgeBaseDocumentsCount: number;
  clientAiStrategy: string;
  onboardingCompleted: boolean;
  hasVertexConfig?: boolean;
  hasSmtpConfig?: boolean;
  hasTurnConfig?: boolean;
  documentsCount?: number;
  hasInboundAgent: boolean;
  hasOutboundAgent: boolean;
  hasConsultativeAgent: boolean;
  hasTwilioConfiguredAgent: boolean;
  twilioAgentStatus?: StepStatus;
  twilioAgentTestedAt?: string;
  twilioAgentErrorMessage?: string;
  hasPublicAgentLink: boolean;
  publicLinksCount: number;
  hasGeneratedIdeas: boolean;
  generatedIdeasCount: number;
  hasCustomTemplate: boolean;
  customTemplatesCount: number;
  hasApprovedTemplate: boolean;
  approvedTemplatesCount: number;
  hasFirstCampaign: boolean;
  campaignsCount: number;
  hasCreatedCourse: boolean;
  coursesCount: number;
  hasCreatedExercise: boolean;
  exercisesCount: number;
  hasFirstSummaryEmail: boolean;
  summaryEmailsCount: number;
  instagramStatus: StepStatus;
  instagramTestedAt?: string;
  instagramErrorMessage?: string;
  hasInstagramConfigured: boolean;
  hasStripeAccount?: boolean;
  stripeAccountStatus?: string | null;
}

const statusConfig = {
  pending: { icon: Circle, color: "text-gray-400", bg: "bg-gray-100", badgeBg: "bg-gray-200", label: "Non configurato" },
  configured: { icon: Clock, color: "text-blue-500", bg: "bg-blue-100", badgeBg: "bg-blue-200", label: "In corso" },
  verified: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-100", badgeBg: "bg-green-200", label: "Verificato" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-100", badgeBg: "bg-red-200", label: "Errore" },
  skipped: { icon: Circle, color: "text-gray-400", bg: "bg-gray-100", badgeBg: "bg-gray-200", label: "Saltato" },
};

function StatusBadge({ status }: { status: StepStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  const isPulsing = status === "configured";
  
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Badge 
        variant="outline" 
        className={`${config.bg} ${config.color} border-0 ${isPulsing ? 'animate-pulse' : ''}`}
      >
        <motion.span
          animate={isPulsing ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Icon className="h-3 w-3 mr-1" />
        </motion.span>
        {config.label}
      </Badge>
    </motion.div>
  );
}

function StepNumberBadge({ number, status }: { number: number; status: StepStatus }) {
  const bgColor = status === "verified" ? "bg-gradient-to-br from-green-400 to-emerald-600" : status === "configured" ? "bg-gradient-to-br from-blue-400 to-indigo-600" : "bg-gradient-to-br from-gray-300 to-gray-400";
  const textColor = status === "pending" ? "text-gray-600" : "text-white";
  
  return (
    <motion.div 
      className={`w-6 h-6 rounded-full ${bgColor} ${textColor} flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-md`}
      initial={{ scale: 0.8 }}
      animate={{ 
        scale: status === "verified" ? [1, 1.2, 1] : 1,
        rotate: status === "verified" ? [0, 10, -10, 0] : 0
      }}
      transition={{ 
        duration: status === "verified" ? 0.5 : 0.2,
        ease: "easeOut"
      }}
    >
      <AnimatePresence mode="wait">
        {status === "verified" ? (
          <motion.div
            key="check"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <Check className="h-3 w-3" />
          </motion.div>
        ) : (
          <motion.span
            key="number"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {number}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StepCard({
  step,
  isActive,
  onClick,
}: {
  step: OnboardingStep;
  isActive: boolean;
  onClick: () => void;
}) {
  const config = statusConfig[step.status];

  return (
    <motion.div
      className={`cursor-pointer p-3 rounded-lg border ${
        isActive
          ? "border-emerald-500 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 shadow-md"
          : "border-transparent hover:bg-gray-50 dark:hover:bg-slate-800"
      }`}
      onClick={onClick}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ 
        scale: 1.02, 
        x: 4,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <StepNumberBadge number={step.stepNumber} status={step.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{step.title}</h3>
            {step.count !== undefined && step.count > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <Badge variant="secondary" className="text-xs bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
                  {step.count} {step.countLabel}
                </Badge>
              </motion.div>
            )}
          </div>
        </div>
        <motion.div 
          className={`p-1.5 rounded-lg ${config.bg} shadow-sm`}
          whileHover={{ rotate: 5, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <div className={config.color}>{step.icon}</div>
        </motion.div>
      </div>
    </motion.div>
  );
}

const phaseGradients = {
  infrastructure: "from-blue-500 via-cyan-500 to-teal-500",
  whatsapp_agents: "from-green-500 via-emerald-500 to-teal-500",
  content: "from-purple-500 via-violet-500 to-indigo-500",
  advanced: "from-orange-500 via-amber-500 to-yellow-500",
};

const phaseBgGradients = {
  infrastructure: "from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30",
  whatsapp_agents: "from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30",
  content: "from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30",
  advanced: "from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30",
};

function PhaseSection({
  phase,
  activeStep,
  onStepClick,
  defaultOpen = false,
}: {
  phase: Phase;
  activeStep: string;
  onStepClick: (stepId: string) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const completedCount = phase.steps.filter(s => s.status === "verified").length;
  const totalCount = phase.steps.length;
  const phaseProgress = Math.round((completedCount / totalCount) * 100);
  const isComplete = phaseProgress === 100;
  
  const gradient = phaseGradients[phase.id as keyof typeof phaseGradients] || phaseGradients.infrastructure;
  const bgGradient = phaseBgGradients[phase.id as keyof typeof phaseBgGradients] || phaseBgGradients.infrastructure;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-3">
      <CollapsibleTrigger className="w-full">
        <motion.div 
          className={`flex items-center justify-between p-3 rounded-xl bg-gradient-to-r ${bgGradient} border border-gray-200 dark:border-gray-700 shadow-sm`}
          whileHover={{ scale: 1.01, y: -1 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: isOpen ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="h-4 w-4" />
            </motion.div>
            <span className="font-semibold text-sm">{phase.title}</span>
            {isComplete && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-lg"
              >
                🎉
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <motion.span 
              className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-sm"
              key={completedCount}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500 }}
            >
              {completedCount}/{totalCount}
            </motion.span>
            <div className="w-20 h-2 bg-gray-200/80 dark:bg-gray-700/80 rounded-full overflow-hidden shadow-inner">
              <motion.div 
                className={`h-full bg-gradient-to-r ${gradient} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${phaseProgress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        </motion.div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <motion.div 
          className="mt-2 space-y-1 pl-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {phase.steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <StepCard
                step={step}
                isActive={activeStep === step.id}
                onClick={() => onStepClick(step.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const triggerConfetti = () => {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 }
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
      spread: 90,
      startVelocity: 30,
    });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
};

const triggerMiniConfetti = () => {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.6 },
    colors: ['#10b981', '#14b8a6', '#06b6d4', '#3b82f6'],
    ticks: 100,
    gravity: 1.2,
    scalar: 0.8,
  });
};

const CREDENTIAL_NOTES_STEPS = ["vertex_ai", "smtp", "google_calendar", "twilio_config"];

function CredentialNotesCard({ stepId }: { stepId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [accountReference, setAccountReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ accountReference: string | null; notes: string | null }>({
    queryKey: ["/api/consultant/credential-notes", stepId],
    queryFn: async () => {
      const res = await fetch(`/api/consultant/credential-notes/${stepId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch credential notes");
      return res.json();
    },
    enabled: CREDENTIAL_NOTES_STEPS.includes(stepId),
  });

  useEffect(() => {
    if (data) {
      setAccountReference(data.accountReference || "");
      setNotes(data.notes || "");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { accountReference: string; notes: string }) => {
      const res = await fetch(`/api/consultant/credential-notes/${stepId}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Note salvate",
        description: "Le note sono state salvate correttamente",
      });
      setIsSaving(false);
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile salvare le note",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  const handleChange = useCallback((field: "accountReference" | "notes", value: string) => {
    if (field === "accountReference") {
      setAccountReference(value);
    } else {
      setNotes(value);
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setIsSaving(true);
    debounceRef.current = setTimeout(() => {
      const payload = {
        accountReference: field === "accountReference" ? value : accountReference,
        notes: field === "notes" ? value : notes,
      };
      saveMutation.mutate(payload);
    }, 1000);
  }, [accountReference, notes, saveMutation]);

  if (!CREDENTIAL_NOTES_STEPS.includes(stepId)) return null;

  return (
    <div className="mt-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2">
              <span className="text-lg">📝</span>
              <span className="font-medium text-sm">Note e Riferimento Account</span>
              {(accountReference || notes) && (
                <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900/30">
                  Compilato
                </Badge>
              )}
            </div>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-amber-600" />
            </motion.div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 space-y-4"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`account-ref-${stepId}`} className="text-sm font-medium">
                    Riferimento Account
                  </Label>
                  <Input
                    id={`account-ref-${stepId}`}
                    placeholder="Es: Account principale Google Cloud - console.cloud.google.com"
                    value={accountReference}
                    onChange={(e) => handleChange("accountReference", e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    A quale account/progetto sono riferite queste credenziali?
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`notes-${stepId}`} className="text-sm font-medium">
                    Note Aggiuntive
                  </Label>
                  <Textarea
                    id={`notes-${stepId}`}
                    placeholder="Aggiungi note, promemoria o dettagli importanti..."
                    value={notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    className="text-sm min-h-[80px]"
                  />
                </div>
                <div className="flex items-center justify-end">
                  {isSaving && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Salvataggio...
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function ConsultantSetupWizard() {
  const [activeStep, setActiveStep] = useState<string>("vertex_ai");
  const [testingStep, setTestingStep] = useState<string | null>(null);
  const [isOnboardingMode, setIsOnboardingMode] = useState<boolean>(false);
  const previousCompletedRef = useRef<number>(0);
  const { toast } = useToast();

  const { data: onboardingData, isLoading, refetch } = useQuery<{ success: boolean; data: OnboardingStatus }>({
    queryKey: ["/api/consultant/onboarding/status"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/onboarding/status", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch onboarding status");
      return res.json();
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({ endpoint, stepName }: { endpoint: string; stepName: string }) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Test failed");
      return { ...data, stepName };
    },
    onSuccess: (data) => {
      triggerMiniConfetti();
      toast({
        title: `${data.stepName} Verificato`,
        description: data.message,
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Configurazione Incompleta",
        description: error.message,
        variant: "destructive",
      });
      refetch();
    },
    onSettled: () => {
      setTestingStep(null);
    },
  });

  const status = onboardingData?.data;

  const getStripeStatus = (stripeStatus: string | null | undefined, hasAccount: boolean | undefined): StepStatus => {
    if (!hasAccount) return "pending";
    if (stripeStatus === "active") return "verified";
    if (stripeStatus === "restricted" || stripeStatus === "pending") return "configured";
    return "pending";
  };

  const phases: Phase[] = [
    {
      id: "infrastructure",
      title: "FASE 1: Infrastruttura Base",
      steps: [
        {
          id: "vertex_ai",
          stepNumber: 1,
          title: "Vertex AI (Gemini)",
          description: "Configura le credenziali Google Cloud per utilizzare Gemini come motore AI principale",
          icon: <Sparkles className="h-4 w-4" />,
          status: status?.vertexAiStatus || "pending",
          testedAt: status?.vertexAiTestedAt,
          errorMessage: status?.vertexAiErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=ai",
          testEndpoint: "/api/consultant/onboarding/test/vertex-ai",
        },
        {
          id: "smtp",
          stepNumber: 2,
          title: "Email SMTP",
          description: "Configura il server SMTP per inviare email automatiche ai tuoi clienti e lead",
          icon: <Mail className="h-4 w-4" />,
          status: status?.smtpStatus || "pending",
          testedAt: status?.smtpTestedAt,
          errorMessage: status?.smtpErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=email",
          testEndpoint: "/api/consultant/onboarding/test/smtp",
        },
        {
          id: "google_calendar",
          stepNumber: 3,
          title: "Google Calendar",
          description: "Collega Google Calendar ai tuoi agenti per sincronizzare appuntamenti e consulenze",
          icon: <Calendar className="h-4 w-4" />,
          status: status?.googleCalendarStatus || "pending",
          testedAt: status?.googleCalendarTestedAt,
          errorMessage: status?.googleCalendarErrorMessage,
          configLink: "/consultant/whatsapp",
          testEndpoint: "/api/consultant/onboarding/test/google-calendar",
        },
        {
          id: "twilio_config",
          stepNumber: 4,
          title: "Configurazione Twilio + WhatsApp",
          description: "Collega il tuo numero italiano a WhatsApp Business tramite Twilio",
          icon: <Phone className="h-4 w-4" />,
          status: status?.hasTwilioConfiguredAgent ? "verified" : (status?.whatsappAiStatus || "pending"),
          testedAt: status?.twilioAgentTestedAt || status?.whatsappAiTestedAt,
          errorMessage: status?.twilioAgentErrorMessage || status?.whatsappAiErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=twilio",
          testEndpoint: "/api/consultant/onboarding/test/twilio-agent",
        },
        {
          id: "instagram_dm",
          stepNumber: 5,
          title: "Instagram Direct Messaging",
          description: "Collega il tuo account Instagram Business per gestire i DM con AI",
          icon: <Instagram className="h-4 w-4" />,
          status: status?.hasInstagramConfigured ? "verified" : (status?.instagramStatus || "pending"),
          testedAt: status?.instagramTestedAt,
          errorMessage: status?.instagramErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=instagram",
          testEndpoint: "/api/consultant/onboarding/test/instagram",
        },
        {
          id: "approved_template",
          stepNumber: 6,
          title: "Template WhatsApp Approvato",
          description: "Crea e fatti approvare almeno un template da Twilio per inviare messaggi proattivi",
          icon: <MessageSquare className="h-4 w-4" />,
          status: status?.hasApprovedTemplate ? "verified" : (status?.hasCustomTemplate ? "configured" : "pending"),
          configLink: "/consultant/whatsapp-templates",
          count: status?.approvedTemplatesCount,
          countLabel: "approvati",
        },
        {
          id: "first_campaign",
          stepNumber: 7,
          title: "Crea la tua Prima Campagna",
          description: "Configura la tua prima campagna marketing per contattare i lead automaticamente",
          icon: <Rocket className="h-4 w-4" />,
          status: status?.hasFirstCampaign ? "verified" : "pending",
          configLink: "/consultant/campaigns",
          count: status?.campaignsCount,
          countLabel: "campagne",
        },
        {
          id: "stripe_connect",
          stepNumber: 8,
          title: "Stripe Connect",
          description: "Collega il tuo account Stripe per ricevere pagamenti dagli abbonamenti dei clienti",
          icon: <CreditCard className="h-4 w-4" />,
          status: getStripeStatus(status?.stripeAccountStatus, status?.hasStripeAccount),
          configLink: "/consultant/whatsapp?tab=licenses",
        },
      ],
    },
    {
      id: "whatsapp_agents",
      title: "FASE 2: WhatsApp & Agenti",
      steps: [
        {
          id: "inbound_agent",
          stepNumber: 9,
          title: "Agente Inbound",
          description: "Crea un agente per gestire le richieste in entrata dei clienti",
          icon: <ArrowDownToLine className="h-4 w-4" />,
          status: status?.hasInboundAgent ? "verified" : "pending",
          configLink: "/consultant/whatsapp",
        },
        {
          id: "outbound_agent",
          stepNumber: 10,
          title: "Agente Outbound",
          description: "Crea un agente per le campagne di contatto proattivo",
          icon: <ArrowUpFromLine className="h-4 w-4" />,
          status: status?.hasOutboundAgent ? "verified" : "pending",
          configLink: "/consultant/whatsapp",
        },
        {
          id: "consultative_agent",
          stepNumber: 11,
          title: "Agente Consulenziale",
          description: "Crea un agente specializzato per consulenze e supporto avanzato",
          icon: <Briefcase className="h-4 w-4" />,
          status: status?.hasConsultativeAgent ? "verified" : "pending",
          configLink: "/consultant/whatsapp",
        },
        {
          id: "public_agent_link",
          stepNumber: 12,
          title: "Link Pubblico Agente",
          description: "Genera un link pubblico per permettere ai clienti di contattare i tuoi agenti",
          icon: <LinkIcon className="h-4 w-4" />,
          status: status?.hasPublicAgentLink ? "verified" : "pending",
          configLink: "/consultant/whatsapp-agents-chat",
          count: status?.publicLinksCount,
          countLabel: "link",
        },
        {
          id: "ai_ideas",
          stepNumber: 13,
          title: "Idee AI Generate",
          description: "Genera idee creative per gli agenti usando l'intelligenza artificiale",
          icon: <Lightbulb className="h-4 w-4" />,
          status: status?.hasGeneratedIdeas ? "verified" : "pending",
          configLink: "/consultant/whatsapp?tab=ideas",
          count: status?.generatedIdeasCount,
          countLabel: "idee",
        },
        {
          id: "whatsapp_template",
          stepNumber: 14,
          title: "Altri Template WhatsApp",
          description: "Crea altri template WhatsApp per diversi tipi di messaggi automatici",
          icon: <MessageSquare className="h-4 w-4" />,
          status: status?.hasCustomTemplate ? "verified" : "pending",
          configLink: "/consultant/whatsapp-templates",
          count: status?.customTemplatesCount,
          countLabel: "template",
        },
      ],
    },
    {
      id: "content",
      title: "FASE 3: Contenuti",
      steps: [
        {
          id: "first_course",
          stepNumber: 15,
          title: "Primo Corso",
          description: "Crea il tuo primo corso formativo per i clienti",
          icon: <BookOpen className="h-4 w-4" />,
          status: status?.hasCreatedCourse ? "verified" : "pending",
          configLink: "/consultant/university",
          count: status?.coursesCount,
          countLabel: "corsi",
        },
        {
          id: "first_exercise",
          stepNumber: 16,
          title: "Primo Esercizio",
          description: "Crea il tuo primo esercizio pratico per i clienti",
          icon: <ClipboardList className="h-4 w-4" />,
          status: status?.hasCreatedExercise ? "verified" : "pending",
          configLink: "/consultant/exercises",
          count: status?.exercisesCount,
          countLabel: "esercizi",
        },
        {
          id: "knowledge_base",
          stepNumber: 17,
          title: "Base di Conoscenza",
          description: "Carica documenti per permettere all'AI di rispondere con informazioni specifiche",
          icon: <FileText className="h-4 w-4" />,
          status: status?.knowledgeBaseStatus || "pending",
          configLink: "/consultant/knowledge-documents",
          testEndpoint: "/api/consultant/onboarding/test/knowledge-base",
          count: status?.knowledgeBaseDocumentsCount,
          countLabel: "documenti",
        },
      ],
    },
    {
      id: "advanced",
      title: "FASE 4: Avanzato",
      steps: [
        {
          id: "first_summary_email",
          stepNumber: 18,
          title: "Prima Email Riassuntiva",
          description: "Invia la tua prima email riassuntiva dopo una consulenza",
          icon: <MailCheck className="h-4 w-4" />,
          status: status?.hasFirstSummaryEmail ? "verified" : "pending",
          configLink: "/consultant/appointments",
          count: status?.summaryEmailsCount,
          countLabel: "email",
        },
        {
          id: "video_meeting",
          stepNumber: 19,
          title: "Video Meeting (TURN)",
          description: "Configura Metered.ca per videochiamate WebRTC affidabili con i tuoi clienti",
          icon: <Video className="h-4 w-4" />,
          status: status?.videoMeetingStatus || "pending",
          testedAt: status?.videoMeetingTestedAt,
          errorMessage: status?.videoMeetingErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=video-meeting",
          testEndpoint: "/api/consultant/onboarding/test/video-meeting",
        },
        {
          id: "lead_import",
          stepNumber: 20,
          title: "Import Lead",
          description: "Configura API esterne per importare lead automaticamente nel sistema",
          icon: <UserPlus className="h-4 w-4" />,
          status: status?.leadImportStatus || "pending",
          testedAt: status?.leadImportTestedAt,
          errorMessage: status?.leadImportErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=lead-import",
          testEndpoint: "/api/consultant/onboarding/test/lead-import",
        },
      ],
    },
  ];

  const allSteps = phases.flatMap(p => p.steps);
  const completedSteps = allSteps.filter(s => s.status === "verified").length;
  const totalSteps = allSteps.length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const activeStepData = allSteps.find(s => s.id === activeStep);

  useEffect(() => {
    if (completedSteps > previousCompletedRef.current && previousCompletedRef.current > 0) {
      triggerMiniConfetti();
    }
    if (completedSteps === totalSteps && previousCompletedRef.current < totalSteps) {
      setTimeout(() => triggerConfetti(), 300);
    }
    previousCompletedRef.current = completedSteps;
  }, [completedSteps, totalSteps]);

  const stepNameMap: Record<string, string> = {
    vertex_ai: "Vertex AI",
    smtp: "Email SMTP",
    google_calendar: "Google Calendar",
    twilio_config: "Configurazione Twilio + WhatsApp",
    approved_template: "Template WhatsApp Approvato",
    first_campaign: "Prima Campagna",
    inbound_agent: "Agente Inbound",
    outbound_agent: "Agente Outbound",
    consultative_agent: "Agente Consulenziale",
    public_agent_link: "Link Pubblico Agente",
    ai_ideas: "Idee AI Generate",
    whatsapp_template: "Altri Template WhatsApp",
    first_course: "Primo Corso",
    first_exercise: "Primo Esercizio",
    knowledge_base: "Knowledge Base",
    first_summary_email: "Prima Email Riassuntiva",
    video_meeting: "Video Meeting",
    lead_import: "Lead Import",
  };

  const handleTest = async (stepId: string, endpoint?: string) => {
    if (!endpoint) return;
    setTestingStep(stepId);
    testMutation.mutate({ endpoint, stepName: stepNameMap[stepId] || stepId });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <Sidebar role="consultant" />
      
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <motion.header 
            className="relative overflow-hidden border-b px-6 py-5"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 dark:from-emerald-500/20 dark:via-teal-500/20 dark:to-cyan-500/20" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-200/30 via-transparent to-transparent dark:from-purple-500/10" />
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="relative p-3 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 rounded-2xl shadow-lg shadow-emerald-500/30"
                  animate={{ 
                    y: [0, -4, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Rocket className="h-7 w-7 text-white" />
                  <motion.div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-gradient-to-b from-orange-400 to-red-500 rounded-full blur-sm"
                    animate={{
                      opacity: [0.5, 1, 0.5],
                      scale: [0.8, 1.2, 0.8],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                    }}
                  />
                </motion.div>
                <div>
                  <motion.h1 
                    className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    Setup Iniziale Piattaforma
                  </motion.h1>
                  <motion.p 
                    className="text-sm text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    Completa tutti i 17 step per sbloccare le funzionalità complete ✨
                  </motion.p>
                </div>
              </div>
              <motion.div 
                className="flex items-center gap-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="text-right">
                  <motion.div 
                    className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent"
                    key={progressPercent}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {progressPercent}%
                  </motion.div>
                  <div className="text-xs text-muted-foreground">
                    <motion.span
                      key={completedSteps}
                      initial={{ color: '#10b981' }}
                      animate={{ color: 'inherit' }}
                      transition={{ duration: 0.5 }}
                    >
                      {completedSteps}/{totalSteps}
                    </motion.span> step completati
                  </div>
                </div>
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <motion.circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="url(#progressGradient)"
                      strokeWidth="4"
                      fill="none"
                      strokeLinecap="round"
                      initial={{ strokeDasharray: "0 176" }}
                      animate={{ strokeDasharray: `${(progressPercent / 100) * 176} 176` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span 
                      className="text-xs font-semibold"
                      key={completedSteps}
                      initial={{ scale: 1.3 }}
                      animate={{ scale: 1 }}
                    >
                      {completedSteps}
                    </motion.span>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.header>

          <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
            <aside className="col-span-4 border-r bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
              <div className="p-4 border-b">
                <h2 className="font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Fasi di Configurazione
                </h2>
              </div>
              <ScrollArea className="flex-1 p-4">
                {phases.map((phase, index) => (
                  <PhaseSection
                    key={phase.id}
                    phase={phase}
                    activeStep={activeStep}
                    onStepClick={setActiveStep}
                    defaultOpen={index === 0}
                  />
                ))}
              </ScrollArea>
            </aside>

            <section className="col-span-8 overflow-auto bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-800/50 dark:via-slate-900 dark:to-slate-800/50">
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {activeStepData && (
                    <motion.div
                      key={activeStepData.id}
                      initial={{ opacity: 0, y: 20, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.98 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full" />
                        <CardHeader className="pb-4 relative">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <StepNumberBadge number={activeStepData.stepNumber} status={activeStepData.status} />
                              <motion.div 
                                className={`p-3 rounded-xl ${statusConfig[activeStepData.status].bg} shadow-md`}
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                transition={{ type: "spring", stiffness: 400 }}
                              >
                                <div className={statusConfig[activeStepData.status].color}>
                                  {activeStepData.icon}
                                </div>
                              </motion.div>
                              <div>
                                <CardTitle className="text-xl">{activeStepData.title}</CardTitle>
                                <CardDescription>{activeStepData.description}</CardDescription>
                              </div>
                            </div>
                            <StatusBadge status={activeStepData.status} />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <AnimatePresence>
                            {activeStepData.status === "error" && activeStepData.errorMessage && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                <Alert variant="destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>{activeStepData.errorMessage}</AlertDescription>
                                </Alert>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence>
                            {activeStepData.status === "verified" && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                              >
                                <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800">
                                  <motion.div
                                    animate={{ rotate: [0, 10, -10, 0] }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                  >
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  </motion.div>
                                  <AlertDescription className="text-green-800 dark:text-green-200">
                                    <span className="flex items-center gap-2">
                                      Configurazione verificata e funzionante! 
                                      <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.3, type: "spring" }}
                                      >
                                        🎉
                                      </motion.span>
                                    </span>
                                    {activeStepData.testedAt && (
                                      <span className="block text-xs mt-1">
                                        Ultimo test: {new Date(activeStepData.testedAt).toLocaleString('it-IT')}
                                      </span>
                                    )}
                                    {activeStepData.count !== undefined && activeStepData.count > 0 && (
                                      <span className="block text-xs mt-1">
                                        Hai {activeStepData.count} {activeStepData.countLabel}
                                      </span>
                                    )}
                                  </AlertDescription>
                                </Alert>
                              </motion.div>
                            )}
                          </AnimatePresence>

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Azioni Disponibili</h4>
                        
                        <div className="flex flex-col gap-2">
                          <Link href={activeStepData.configLink}>
                            <Button className="w-full justify-between" variant="outline">
                              <span className="flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                {activeStepData.status === "pending" ? "Configura" : "Modifica Configurazione"}
                              </span>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>

                          {activeStepData.testEndpoint && (
                            <Button
                              onClick={() => handleTest(activeStepData.id, activeStepData.testEndpoint)}
                              disabled={testingStep === activeStepData.id}
                              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                            >
                              {testingStep === activeStepData.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Test in corso...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  {activeStepData.status === "pending" ? "Verifica Configurazione" : "Testa Connessione"}
                                </>
                              )}
                            </Button>
                          )}

                          <Button 
                            variant="outline"
                            className="w-full border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/30"
                            onClick={() => {
                              const stepMessages: Record<string, string> = {
                                vertex_ai: "Aiutami a configurare Vertex AI per la mia piattaforma. Come ottengo le credenziali Google Cloud?",
                                smtp: "Come configuro il server SMTP per inviare email automatiche ai clienti?",
                                google_calendar: "Aiutami a collegare Google Calendar per sincronizzare gli appuntamenti.",
                                whatsapp_ai: "Spiegami come configurare credenziali AI separate per gli agenti WhatsApp.",
                                inbound_agent: "Come creo un agente Inbound efficace per gestire le richieste dei clienti?",
                                outbound_agent: "Come configuro un agente Outbound per le campagne proattive?",
                                consultative_agent: "Come funziona l'agente Consulenziale e come posso configurarlo?",
                                public_agent_link: "Come genero e condivido un link pubblico per i miei agenti WhatsApp?",
                                ai_ideas: "Come posso usare l'AI per generare idee creative per i miei agenti?",
                                whatsapp_template: "Come creo template WhatsApp personalizzati per i messaggi automatici?",
                                first_course: "Aiutami a creare il mio primo corso formativo per i clienti.",
                                first_exercise: "Come creo un esercizio pratico efficace per i miei clienti?",
                                knowledge_base: "Come carico documenti nella Knowledge Base per migliorare le risposte dell'AI?",
                                first_summary_email: "Come invio email riassuntive dopo le consulenze?",
                                video_meeting: "Come configuro le credenziali TURN di Metered.ca per le videochiamate?",
                                lead_import: "Come posso importare lead automaticamente da API esterne?",
                                twilio_config: "Come configuro Twilio per WhatsApp Business?",
                              };
                              const message = stepMessages[activeStep] || "Aiutami con la configurazione della piattaforma.";
                              window.dispatchEvent(new CustomEvent('ai:open-and-ask', { 
                                detail: { 
                                  document: { id: activeStep, title: activeStepData?.title || 'Setup Wizard' },
                                  autoMessage: message 
                                } 
                              }));
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chiedimi qualcosa
                          </Button>
                        </div>
                      </div>

                      {activeStep === "vertex_ai" && (
                        <>
                          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-blue-600" />
                              Come ottenere le credenziali Vertex AI
                            </h4>
                            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                              <li>Vai su <a href="https://console.cloud.google.com" target="_blank" rel="noopener" className="text-blue-600 underline">Google Cloud Console</a></li>
                              <li>Crea un nuovo progetto o seleziona uno esistente</li>
                              <li>Abilita l'API Vertex AI nel progetto</li>
                              <li>Crea un Service Account con ruolo "Vertex AI User"</li>
                              <li>Scarica il file JSON delle credenziali</li>
                              <li>Copia il contenuto JSON nella configurazione</li>
                            </ol>
                          </div>
                          <CredentialNotesCard stepId="vertex_ai" />
                        </>
                      )}

                      {activeStep === "smtp" && (
                        <>
                          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Mail className="h-4 w-4 text-blue-600" />
                              Configurazione SMTP Comune
                            </h4>
                            <div className="text-sm text-muted-foreground space-y-2">
                              <p><strong>Gmail:</strong> smtp.gmail.com, porta 587, usa App Password</p>
                              <p><strong>Outlook:</strong> smtp.office365.com, porta 587</p>
                              <p><strong>Custom:</strong> Usa i dati del tuo provider email</p>
                            </div>
                          </div>
                          <CredentialNotesCard stepId="smtp" />
                        </>
                      )}

                      {activeStep === "google_calendar" && (
                        <>
                          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              Collegamento Google Calendar agli Agenti
                            </h4>
                            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                              <li>Vai alla sezione Dipendenti/Agenti WhatsApp</li>
                              <li>Seleziona un agente dalla lista</li>
                              <li>Nel pannello laterale, trova la sezione "Google Calendar"</li>
                              <li>Clicca "Collega Google Calendar"</li>
                              <li>Accedi con l'account Google dell'agente e autorizza</li>
                            </ol>
                            <p className="text-xs text-muted-foreground mt-3 italic">
                              Ogni agente può avere il proprio Google Calendar per gestire appuntamenti separati.
                            </p>
                          </div>
                          <CredentialNotesCard stepId="google_calendar" />
                        </>
                      )}

                      {activeStep === "twilio_config" && (
                        <>
                          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Phone className="h-4 w-4 text-blue-600" />
                              Configurazione Twilio + WhatsApp
                            </h4>
                            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                              <li>Registrati su <a href="https://www.twilio.com/console" target="_blank" rel="noopener" className="text-blue-600 underline">Twilio Console</a></li>
                              <li>Acquista un numero italiano con capacità WhatsApp</li>
                              <li>Vai su Messaging → WhatsApp Senders e configura il numero</li>
                              <li>Copia Account SID e Auth Token dalla Dashboard</li>
                              <li>Incolla le credenziali nella configurazione</li>
                            </ol>
                            <p className="text-xs text-muted-foreground mt-3 italic">
                              Twilio permette di inviare e ricevere messaggi WhatsApp dal tuo numero italiano.
                            </p>
                          </div>
                          <CredentialNotesCard stepId="twilio_config" />
                        </>
                      )}

                      {activeStep === "whatsapp_ai" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            Credenziali AI per WhatsApp
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>Gli agenti WhatsApp possono usare credenziali AI separate per:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Non consumare il tuo budget AI principale</li>
                              <li>Avere limiti di utilizzo dedicati</li>
                              <li>Monitorare i costi separatamente</li>
                            </ul>
                            <p className="mt-2">Configura come per Vertex AI principale, ma con un progetto dedicato.</p>
                          </div>
                        </div>
                      )}

                      {activeStep === "inbound_agent" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <ArrowDownToLine className="h-4 w-4 text-blue-600" />
                            Agente Inbound
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>L'agente Inbound gestisce i messaggi in arrivo dai clienti:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Risponde automaticamente alle domande frequenti</li>
                              <li>Qualifica i lead in entrata</li>
                              <li>Prenota appuntamenti quando richiesto</li>
                              <li>Escalada al consulente per casi complessi</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "outbound_agent" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <ArrowUpFromLine className="h-4 w-4 text-blue-600" />
                            Agente Outbound
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>L'agente Outbound è ideale per campagne proattive:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Invia messaggi promozionali ai lead</li>
                              <li>Segue i clienti inattivi</li>
                              <li>Ricorda appuntamenti e scadenze</li>
                              <li>Propone offerte personalizzate</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "consultative_agent" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-blue-600" />
                            Agente Consulenziale
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>L'agente Consulenziale offre supporto avanzato:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Fornisce consulenze preliminari automatiche</li>
                              <li>Analizza le esigenze del cliente</li>
                              <li>Propone soluzioni basate sul knowledge base</li>
                              <li>Prepara il terreno per la consulenza umana</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "public_agent_link" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-blue-600" />
                            Link Pubblico Agente
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>I link pubblici permettono ai clienti di contattarti facilmente:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Condividi il link sul tuo sito web</li>
                              <li>Usalo nei social media e nelle email</li>
                              <li>I clienti possono chattare senza login</li>
                              <li>Traccia le conversioni da ogni link</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "ai_ideas" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-blue-600" />
                            Idee AI Generate
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>L'AI può generare idee creative per i tuoi agenti:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Script di conversazione ottimizzati</li>
                              <li>Risposte a obiezioni comuni</li>
                              <li>Messaggi di follow-up efficaci</li>
                              <li>Template per campagne stagionali</li>
                            </ul>
                            <p className="mt-2">Vai alla sezione Idee per generare contenuti personalizzati.</p>
                          </div>
                        </div>
                      )}

                      {activeStep === "whatsapp_template" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            Template WhatsApp
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>I template WhatsApp personalizzano i tuoi messaggi automatici:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>I template personalizzano i messaggi automatici</li>
                              <li>Puoi creare template per diversi scenari (apertura, follow-up, etc.)</li>
                              <li>I template supportano variabili dinamiche come {"{nome_lead}"}</li>
                            </ul>
                            <p className="mt-2">Vai alla sezione Template per creare i tuoi messaggi personalizzati.</p>
                          </div>
                        </div>
                      )}

                      {activeStep === "first_course" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-600" />
                            Crea il Tuo Primo Corso
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>I corsi formativi aiutano i tuoi clienti a crescere:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Organizza contenuti in moduli e lezioni</li>
                              <li>Carica video, PDF e materiali didattici</li>
                              <li>Monitora i progressi dei clienti</li>
                              <li>Assegna certificati al completamento</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "first_exercise" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-blue-600" />
                            Crea il Tuo Primo Esercizio
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>Gli esercizi pratici consolidano l'apprendimento:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Crea quiz e test di verifica</li>
                              <li>Assegna compiti pratici</li>
                              <li>Valuta le risposte con l'AI</li>
                              <li>Fornisci feedback personalizzato</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "knowledge_base" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            Base di Conoscenza AI
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>Carica documenti per permettere all'AI di rispondere con informazioni specifiche:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>PDF, Word, Excel e file di testo</li>
                              <li>Manuali e guide dei tuoi prodotti</li>
                              <li>FAQ e risposte standard</li>
                              <li>Politiche aziendali e procedure</li>
                            </ul>
                            <p className="text-xs mt-2 italic">L'AI userà questi documenti per dare risposte più accurate e personalizzate.</p>
                          </div>
                        </div>
                      )}

                      {activeStep === "first_summary_email" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <MailCheck className="h-4 w-4 text-blue-600" />
                            Email Riassuntiva Post-Consulenza
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>Le email riassuntive migliorano la retention:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Riepiloga i punti discussi nella consulenza</li>
                              <li>Elenca le azioni da intraprendere</li>
                              <li>Include link a risorse utili</li>
                              <li>Pianifica i prossimi passi</li>
                            </ul>
                            <p className="mt-2">Vai agli appuntamenti completati per inviare la prima email riassuntiva.</p>
                          </div>
                        </div>
                      )}

                      {activeStep === "video_meeting" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Video className="h-4 w-4 text-blue-600" />
                            Server TURN con Metered.ca
                          </h4>
                          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                            <li>Registrati su <a href="https://www.metered.ca" target="_blank" rel="noopener" className="text-blue-600 underline">Metered.ca</a></li>
                            <li>Crea una nuova applicazione TURN</li>
                            <li>Copia Username e Password</li>
                            <li>Incollali nella configurazione</li>
                          </ol>
                          <p className="text-xs text-muted-foreground mt-3 italic">
                            I server TURN permettono videochiamate stabili anche quando i partecipanti sono dietro firewall restrittivi.
                          </p>
                        </div>
                      )}

                      {activeStep === "lead_import" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-blue-600" />
                            Import Lead Automatico
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>Collega API esterne per importare lead automaticamente:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>CRM esterni (HubSpot, Salesforce, ecc.)</li>
                              <li>Landing page e form</li>
                              <li>Webhook personalizzati</li>
                            </ul>
                          </div>
                        </div>
                      )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </div>
      </main>
      <ConsultantAIAssistant isOnboardingMode={isOnboardingMode} />
      
      {/* Onboarding Assistant Button */}
      <div className="fixed bottom-28 right-6 z-[55]">
        <Button
          size="sm"
          variant={isOnboardingMode ? "default" : "outline"}
          onClick={() => setIsOnboardingMode(!isOnboardingMode)}
          className="shadow-lg gap-2"
        >
          <Bot className="h-4 w-4" />
          {isOnboardingMode ? "Modalità Onboarding Attiva" : "Assistente Onboarding"}
        </Button>
      </div>
    </div>
  );
}
