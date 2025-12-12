import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Zap,
  Check,
  Circle,
  AlertCircle,
  ChevronRight,
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
  ArrowRight,
  Bot,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

type StepStatus = "pending" | "configured" | "verified" | "error" | "skipped";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: StepStatus;
  testedAt?: string;
  errorMessage?: string;
  required: boolean;
  configLink: string;
  testEndpoint?: string;
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
}

const statusConfig = {
  pending: { icon: Circle, color: "text-gray-400", bg: "bg-gray-100", label: "Non configurato" },
  configured: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-100", label: "In attesa test" },
  verified: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-100", label: "Verificato" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-100", label: "Errore" },
  skipped: { icon: Circle, color: "text-gray-400", bg: "bg-gray-100", label: "Saltato" },
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

function StepCard({
  step,
  isActive,
  onClick,
  onTest,
  isTesting,
}: {
  step: OnboardingStep;
  isActive: boolean;
  onClick: () => void;
  onTest?: () => void;
  isTesting: boolean;
}) {
  const config = statusConfig[step.status];
  const Icon = config.icon;

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 ${
        isActive
          ? "ring-2 ring-emerald-500 shadow-lg"
          : "hover:shadow-md hover:border-gray-300"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bg}`}>
            <div className={config.color}>{step.icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{step.title}</h3>
              {!step.required && (
                <Badge variant="outline" className="text-xs">Opzionale</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{step.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={step.status} />
              {step.status === "error" && step.errorMessage && (
                <span className="text-xs text-red-500 truncate">{step.errorMessage}</span>
              )}
            </div>
          </div>
          <Icon className={`h-5 w-5 ${config.color} flex-shrink-0`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConsultantSetupWizard() {
  const [activeStep, setActiveStep] = useState<string>("vertex_ai");
  const [testingStep, setTestingStep] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    onError: (error: any) => {
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

  const skipMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await fetch(`/api/consultant/onboarding/status/${stepId}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "skipped" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Skip failed");
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Passaggio Saltato",
        description: "Puoi configurarlo in seguito se necessario.",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const status = onboardingData?.data;

  const steps: OnboardingStep[] = [
    {
      id: "vertex_ai",
      title: "Vertex AI (Gemini)",
      description: "Configura le credenziali Google Cloud per utilizzare Gemini come motore AI principale",
      icon: <Sparkles className="h-5 w-5" />,
      status: status?.vertexAiStatus || "pending",
      testedAt: status?.vertexAiTestedAt,
      errorMessage: status?.vertexAiErrorMessage,
      required: true,
      configLink: "/consultant/api-keys-unified?tab=ai",
      testEndpoint: "/api/consultant/onboarding/test/vertex-ai",
    },
    {
      id: "smtp",
      title: "Email SMTP",
      description: "Configura il server SMTP per inviare email automatiche ai tuoi clienti e lead",
      icon: <Mail className="h-5 w-5" />,
      status: status?.smtpStatus || "pending",
      testedAt: status?.smtpTestedAt,
      errorMessage: status?.smtpErrorMessage,
      required: true,
      configLink: "/consultant/api-keys-unified?tab=email",
      testEndpoint: "/api/consultant/onboarding/test/smtp",
    },
    {
      id: "google_calendar",
      title: "Google Calendar",
      description: "Collega il tuo Google Calendar per sincronizzare appuntamenti e consulenze",
      icon: <Calendar className="h-5 w-5" />,
      status: status?.googleCalendarStatus || "pending",
      testedAt: status?.googleCalendarTestedAt,
      errorMessage: status?.googleCalendarErrorMessage,
      required: true,
      configLink: "/consultant/api-keys-unified?tab=calendar",
      testEndpoint: "/api/consultant/onboarding/test/google-calendar",
    },
    {
      id: "video_meeting",
      title: "Video Meeting (TURN)",
      description: "Configura Metered.ca per videochiamate WebRTC affidabili con i tuoi clienti",
      icon: <Video className="h-5 w-5" />,
      status: status?.videoMeetingStatus || "pending",
      testedAt: status?.videoMeetingTestedAt,
      errorMessage: status?.videoMeetingErrorMessage,
      required: false,
      configLink: "/consultant/api-keys-unified?tab=video",
      testEndpoint: "/api/consultant/onboarding/test/video-meeting",
    },
    {
      id: "whatsapp_ai",
      title: "WhatsApp AI",
      description: "Configura le credenziali AI separate per gli agenti WhatsApp automatici",
      icon: <MessageSquare className="h-5 w-5" />,
      status: status?.whatsappAiStatus || "pending",
      testedAt: status?.whatsappAiTestedAt,
      errorMessage: status?.whatsappAiErrorMessage,
      required: false,
      configLink: "/consultant/api-keys-unified?tab=whatsapp-ai",
      testEndpoint: "/api/consultant/onboarding/test/whatsapp-ai",
    },
    {
      id: "lead_import",
      title: "Import Lead Esterni",
      description: "Configura API esterne per importare lead automaticamente nel sistema",
      icon: <UserPlus className="h-5 w-5" />,
      status: status?.leadImportStatus || "pending",
      testedAt: status?.leadImportTestedAt,
      errorMessage: status?.leadImportErrorMessage,
      required: false,
      configLink: "/consultant/api-keys-unified?tab=lead-import",
      testEndpoint: "/api/consultant/onboarding/test/lead-import",
    },
    {
      id: "knowledge_base",
      title: "Knowledge Base",
      description: "Carica documenti per permettere all'AI di rispondere con informazioni specifiche",
      icon: <FileText className="h-5 w-5" />,
      status: status?.knowledgeBaseStatus || "pending",
      required: false,
      configLink: "/consultant/knowledge-documents",
      testEndpoint: "/api/consultant/onboarding/test/knowledge-base",
    },
  ];

  const completedSteps = steps.filter(s => s.status === "verified" || s.status === "skipped").length;
  const requiredSteps = steps.filter(s => s.required);
  const requiredCompleted = requiredSteps.filter(s => s.status === "verified").length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  const activeStepData = steps.find(s => s.id === activeStep);

  const stepNameMap: Record<string, string> = {
    vertex_ai: "Vertex AI",
    smtp: "Email SMTP",
    google_calendar: "Google Calendar",
    video_meeting: "Video Meeting",
    whatsapp_ai: "WhatsApp AI",
    lead_import: "Lead Import",
    knowledge_base: "Knowledge Base",
  };

  const handleTest = async (stepId: string, endpoint?: string) => {
    if (!endpoint) return;
    setTestingStep(stepId);
    testMutation.mutate({ endpoint, stepName: stepNameMap[stepId] || stepId });
  };

  const handleSkip = async (stepId: string) => {
    skipMutation.mutate(stepId);
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
                    Configura tutte le integrazioni per sbloccare le funzionalità complete
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-medium">{completedSteps}/{steps.length} completati</div>
                  <div className="text-xs text-muted-foreground">
                    {requiredCompleted}/{requiredSteps.length} obbligatori
                  </div>
                </div>
                <div className="w-32">
                  <Progress value={progressPercent} className="h-2" />
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
            <aside className="col-span-4 border-r bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
              <div className="p-4 border-b">
                <h2 className="font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Passi di Configurazione
                </h2>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {steps.map((step) => (
                    <StepCard
                      key={step.id}
                      step={step}
                      isActive={activeStep === step.id}
                      onClick={() => setActiveStep(step.id)}
                      onTest={() => handleTest(step.id)}
                      isTesting={testingStep === step.id}
                    />
                  ))}
                </div>
              </ScrollArea>
            </aside>

            <section className="col-span-5 overflow-auto bg-slate-50 dark:bg-slate-800/50">
              <div className="p-6">
                {activeStepData && (
                  <Card className="border-0 shadow-xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
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

                          {!activeStepData.required && activeStepData.status !== "verified" && activeStepData.status !== "skipped" && (
                            <Button 
                              variant="ghost" 
                              className="w-full text-muted-foreground"
                              onClick={() => handleSkip(activeStepData.id)}
                              disabled={skipMutation.isPending}
                            >
                              {skipMutation.isPending ? "Salvataggio..." : "Salta questo passaggio"}
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
                            <p className="text-xs mt-2 italic">Questo passaggio è opzionale. Puoi anche inserire i lead manualmente.</p>
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
                      <div>
                        <p className="text-sm font-medium">Ciao! Sono qui per aiutarti</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activeStep === "vertex_ai" && "Vertex AI è il cuore della piattaforma. Ti permette di usare Gemini per tutte le funzionalità AI."}
                          {activeStep === "smtp" && "L'email è fondamentale per comunicare con i tuoi clienti. Configura SMTP per email automatiche."}
                          {activeStep === "google_calendar" && "Collega il calendario per sincronizzare appuntamenti automaticamente."}
                          {activeStep === "video_meeting" && "I server TURN garantiscono videochiamate stabili anche con firewall restrittivi."}
                          {activeStep === "whatsapp_ai" && "Gli agenti WhatsApp usano credenziali AI separate per non consumare le tue."}
                          {activeStep === "lead_import" && "Importa lead automaticamente da CRM esterni o landing page."}
                          {activeStep === "knowledge_base" && "Carica documenti per far rispondere l'AI con informazioni specifiche sul tuo business."}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-3">Prossimi Passi</h3>
                  <div className="space-y-2">
                    {steps
                      .filter(s => s.status === "pending" && s.required)
                      .slice(0, 3)
                      .map(step => (
                        <button
                          key={step.id}
                          onClick={() => setActiveStep(step.id)}
                          className="w-full text-left p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-gray-100 rounded">
                              {step.icon}
                            </div>
                            <span className="text-sm">{step.title}</span>
                            <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                {requiredCompleted === requiredSteps.length && (
                  <Alert className="mt-6 bg-emerald-50 border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-emerald-800">
                      Tutti i passaggi obbligatori sono completati! La piattaforma è pronta all'uso.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
