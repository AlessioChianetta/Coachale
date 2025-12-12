import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
  hasPublicAgentLink: boolean;
  publicLinksCount: number;
  hasGeneratedIdeas: boolean;
  generatedIdeasCount: number;
  hasCreatedCourse: boolean;
  coursesCount: number;
  hasCreatedExercise: boolean;
  exercisesCount: number;
  hasFirstSummaryEmail: boolean;
  summaryEmailsCount: number;
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
  return (
    <Badge variant="outline" className={`${config.bg} ${config.color} border-0`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function StepNumberBadge({ number, status }: { number: number; status: StepStatus }) {
  const bgColor = status === "verified" ? "bg-green-500" : status === "configured" ? "bg-blue-500" : "bg-gray-300";
  const textColor = status === "pending" ? "text-gray-600" : "text-white";
  
  return (
    <div className={`w-6 h-6 rounded-full ${bgColor} ${textColor} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
      {status === "verified" ? <Check className="h-3 w-3" /> : number}
    </div>
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
    <div
      className={`cursor-pointer transition-all duration-200 p-3 rounded-lg border ${
        isActive
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm"
          : "border-transparent hover:bg-gray-50 dark:hover:bg-slate-800"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <StepNumberBadge number={step.stepNumber} status={step.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{step.title}</h3>
            {step.count !== undefined && step.count > 0 && (
              <Badge variant="secondary" className="text-xs">
                {step.count} {step.countLabel}
              </Badge>
            )}
          </div>
        </div>
        <div className={`p-1.5 rounded ${config.bg}`}>
          <div className={config.color}>{step.icon}</div>
        </div>
      </div>
    </div>
  );
}

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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2">
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-semibold text-sm">{phase.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{completedCount}/{totalCount}</span>
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300" 
                style={{ width: `${phaseProgress}%` }}
              />
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-1 pl-2">
          {phase.steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              isActive={activeStep === step.id}
              onClick={() => onStepClick(step.id)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ConsultantSetupWizard() {
  const [activeStep, setActiveStep] = useState<string>("vertex_ai");
  const [testingStep, setTestingStep] = useState<string | null>(null);
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
      if (!res.ok) throw new Error(data.error || "Test failed");
      return { ...data, stepName };
    },
    onSuccess: (data) => {
      toast({
        title: `${data.stepName} Verificato`,
        description: data.message,
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Test Fallito",
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
          description: "Collega il tuo Google Calendar per sincronizzare appuntamenti e consulenze",
          icon: <Calendar className="h-4 w-4" />,
          status: status?.googleCalendarStatus || "pending",
          testedAt: status?.googleCalendarTestedAt,
          errorMessage: status?.googleCalendarErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=calendar",
          testEndpoint: "/api/consultant/onboarding/test/google-calendar",
        },
      ],
    },
    {
      id: "whatsapp_agents",
      title: "FASE 2: WhatsApp & Agenti",
      steps: [
        {
          id: "whatsapp_ai",
          stepNumber: 4,
          title: "WhatsApp AI Credentials",
          description: "Configura le credenziali AI separate per gli agenti WhatsApp automatici",
          icon: <MessageSquare className="h-4 w-4" />,
          status: status?.whatsappAiStatus || "pending",
          testedAt: status?.whatsappAiTestedAt,
          errorMessage: status?.whatsappAiErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=whatsapp",
          testEndpoint: "/api/consultant/onboarding/test/whatsapp-ai",
        },
        {
          id: "inbound_agent",
          stepNumber: 5,
          title: "Agente Inbound",
          description: "Crea un agente per gestire le richieste in entrata dei clienti",
          icon: <ArrowDownToLine className="h-4 w-4" />,
          status: status?.hasInboundAgent ? "verified" : "pending",
          configLink: "/consultant/whatsapp",
        },
        {
          id: "outbound_agent",
          stepNumber: 6,
          title: "Agente Outbound",
          description: "Crea un agente per le campagne di contatto proattivo",
          icon: <ArrowUpFromLine className="h-4 w-4" />,
          status: status?.hasOutboundAgent ? "verified" : "pending",
          configLink: "/consultant/whatsapp",
        },
        {
          id: "consultative_agent",
          stepNumber: 7,
          title: "Agente Consulenziale",
          description: "Crea un agente specializzato per consulenze e supporto avanzato",
          icon: <Briefcase className="h-4 w-4" />,
          status: status?.hasConsultativeAgent ? "verified" : "pending",
          configLink: "/consultant/whatsapp",
        },
        {
          id: "public_agent_link",
          stepNumber: 8,
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
          stepNumber: 9,
          title: "Idee AI Generate",
          description: "Genera idee creative per gli agenti usando l'intelligenza artificiale",
          icon: <Lightbulb className="h-4 w-4" />,
          status: status?.hasGeneratedIdeas ? "verified" : "pending",
          configLink: "/consultant/whatsapp?tab=ideas",
          count: status?.generatedIdeasCount,
          countLabel: "idee",
        },
      ],
    },
    {
      id: "content",
      title: "FASE 3: Contenuti",
      steps: [
        {
          id: "first_course",
          stepNumber: 10,
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
          stepNumber: 11,
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
          stepNumber: 12,
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
          stepNumber: 13,
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
          stepNumber: 14,
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
          stepNumber: 15,
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

  const stepNameMap: Record<string, string> = {
    vertex_ai: "Vertex AI",
    smtp: "Email SMTP",
    google_calendar: "Google Calendar",
    whatsapp_ai: "WhatsApp AI",
    inbound_agent: "Agente Inbound",
    outbound_agent: "Agente Outbound",
    consultative_agent: "Agente Consulenziale",
    public_agent_link: "Link Pubblico Agente",
    ai_ideas: "Idee AI Generate",
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
          <header className="bg-white dark:bg-slate-900 border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                  <Rocket className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Setup Iniziale Piattaforma
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Completa tutti i 15 step per sbloccare le funzionalità complete
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-600">{progressPercent}%</div>
                  <div className="text-xs text-muted-foreground">
                    {completedSteps}/{totalSteps} step completati
                  </div>
                </div>
                <div className="w-40">
                  <Progress value={progressPercent} className="h-3" />
                </div>
              </div>
            </div>
          </header>

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

            <section className="col-span-5 overflow-auto bg-slate-50 dark:bg-slate-800/50">
              <div className="p-6">
                {activeStepData && (
                  <Card className="border-0 shadow-xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <StepNumberBadge number={activeStepData.stepNumber} status={activeStepData.status} />
                          <div className={`p-3 rounded-xl ${statusConfig[activeStepData.status].bg}`}>
                            <div className={statusConfig[activeStepData.status].color}>
                              {activeStepData.icon}
                            </div>
                          </div>
                          <div>
                            <CardTitle className="text-xl">{activeStepData.title}</CardTitle>
                            <CardDescription>{activeStepData.description}</CardDescription>
                          </div>
                        </div>
                        <StatusBadge status={activeStepData.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {activeStepData.status === "error" && activeStepData.errorMessage && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{activeStepData.errorMessage}</AlertDescription>
                        </Alert>
                      )}

                      {activeStepData.status === "verified" && (
                        <Alert className="bg-green-50 border-green-200">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            Configurazione verificata e funzionante!
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
                      )}

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
                        </div>
                      </div>

                      {activeStep === "vertex_ai" && (
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
                      )}

                      {activeStep === "smtp" && (
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
                      )}

                      {activeStep === "google_calendar" && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            Collegamento Google Calendar
                          </h4>
                          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                            <li>Vai alla pagina di configurazione</li>
                            <li>Clicca "Connetti Google Calendar"</li>
                            <li>Accedi con il tuo account Google</li>
                            <li>Autorizza l'accesso al calendario</li>
                            <li>Seleziona il calendario principale da sincronizzare</li>
                          </ol>
                          <p className="text-xs text-muted-foreground mt-3 italic">
                            Gli appuntamenti creati nella piattaforma appariranno automaticamente nel tuo Google Calendar.
                          </p>
                        </div>
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
                )}
              </div>
            </section>

            <aside className="col-span-3 border-l bg-white dark:bg-slate-900 overflow-auto">
              <div className="p-4 border-b">
                <h2 className="font-semibold flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Assistente AI
                </h2>
              </div>
              <div className="p-4">
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Ciao! Sono qui per aiutarti</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activeStep === "vertex_ai" && "Vertex AI è il cuore della piattaforma. Ti permette di usare Gemini per tutte le funzionalità AI."}
                          {activeStep === "smtp" && "L'email è fondamentale per comunicare con i tuoi clienti. Configura SMTP per email automatiche."}
                          {activeStep === "google_calendar" && "Collega il calendario per sincronizzare appuntamenti automaticamente."}
                          {activeStep === "whatsapp_ai" && "Gli agenti WhatsApp usano credenziali AI separate per non consumare le tue."}
                          {activeStep === "inbound_agent" && "L'agente Inbound risponde automaticamente ai messaggi in arrivo dei clienti."}
                          {activeStep === "outbound_agent" && "L'agente Outbound è perfetto per campagne proattive e follow-up."}
                          {activeStep === "consultative_agent" && "L'agente Consulenziale offre supporto avanzato prima della consulenza umana."}
                          {activeStep === "public_agent_link" && "I link pubblici permettono ai clienti di contattarti facilmente ovunque."}
                          {activeStep === "ai_ideas" && "Genera idee creative per migliorare le conversazioni dei tuoi agenti."}
                          {activeStep === "first_course" && "I corsi formativi aiutano i clienti a crescere e aumentano la loro fidelizzazione."}
                          {activeStep === "first_exercise" && "Gli esercizi pratici consolidano l'apprendimento dei tuoi clienti."}
                          {activeStep === "knowledge_base" && "Carica documenti per far rispondere l'AI con informazioni specifiche sul tuo business."}
                          {activeStep === "first_summary_email" && "Le email riassuntive post-consulenza migliorano la retention dei clienti."}
                          {activeStep === "video_meeting" && "I server TURN garantiscono videochiamate stabili anche con firewall restrittivi."}
                          {activeStep === "lead_import" && "Importa lead automaticamente da CRM esterni o landing page."}
                        </p>
                        <Button 
                          size="sm"
                          className="mt-3 w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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
                              first_course: "Aiutami a creare il mio primo corso formativo per i clienti.",
                              first_exercise: "Come creo un esercizio pratico efficace per i miei clienti?",
                              knowledge_base: "Come carico documenti nella Knowledge Base per migliorare le risposte dell'AI?",
                              first_summary_email: "Come invio email riassuntive dopo le consulenze?",
                              video_meeting: "Come configuro le credenziali TURN di Metered.ca per le videochiamate?",
                              lead_import: "Come posso importare lead automaticamente da API esterne?",
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
                  </CardContent>
                </Card>

                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-3">Prossimi Step da Completare</h3>
                  <div className="space-y-2">
                    {allSteps
                      .filter(s => s.status === "pending")
                      .slice(0, 3)
                      .map(step => (
                        <button
                          key={step.id}
                          onClick={() => setActiveStep(step.id)}
                          className="w-full text-left p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <StepNumberBadge number={step.stepNumber} status={step.status} />
                            <span className="text-sm flex-1">{step.title}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                {completedSteps === totalSteps && (
                  <Alert className="mt-6 bg-emerald-50 border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-emerald-800">
                      🎉 Tutti i 15 step sono completati! La piattaforma è pronta all'uso.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
      <ConsultantAIAssistant />
    </div>
  );
}
