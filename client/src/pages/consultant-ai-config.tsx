import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { ExplainerCard } from "@/components/ui/explainer-card";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  Eye,
  Send,
  BarChart3,
  FileText,
  Users,
  TrendingUp,
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle,
  Brain,
  Zap,
  Settings,
  Check,
  X,
  Edit,
  AlertTriangle,
  Clock,
  Calendar,
  Play,
  Pause,
  Square,
  RotateCw,
  BookOpen,
  Route,
  Target,
  ListTodo,
  HelpCircle,
  Info,
  Megaphone,
  ChevronsUpDown,
  History,
  Trash2,
  Save,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Inbox,
  ArrowRight
} from "lucide-react";
import { useLocation } from "wouter";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import it from "date-fns/locale/it";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AIEmailStats {
  totalGenerated: number;
  toneDistribution: {
    professionale: number;
    amichevole: number;
    motivazionale: number;
  };
  successRate: number;
  averageLength: number;
}

interface AIContextPreview {
  clientState: {
    name: string;
    level: string;
    activeGoals: number;
    completedExercises: number;
    streakDays: number;
  };
  recentTasks: Array<{
    title: string;
    status: string;
    dueDate: string;
  }>;
  goals: Array<{
    title: string;
    progress: number;
  }>;
}

interface SMTPSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  automationEnabled: boolean;
  emailFrequencyDays: number;
  // Backend returns these property names
  smtpHost?: string;
  smtpUser?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpPassword?: string;
  emailTone?: string;
  emailSignature?: string;
}

interface EmailDraft {
  id: string;
  clientId: string;
  clientName: string;
  subject: string;
  body: string;
  status: string;
  generatedAt: string;
  emailType?: string;
  metadata?: {
    consultationDate?: string;
    fathomShareLink?: string;
    [key: string]: any;
  };
  journeyDay?: number;
}

interface ClientAutomation {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  automationEnabled: boolean;
}

interface ClientAutomationStatus {
  id: string;
  name: string;
  email: string;
  automationEnabled: boolean;
  lastEmailSentAt: string | null;
  nextEmailDate: string | null;
  daysUntilNext: number | null;
  emailsSentCount: number;
}

interface SchedulerStatus {
  schedulerEnabled: boolean;
  schedulerPaused: boolean;
  lastSchedulerRun: string | null;
  nextSchedulerRun: string | null;
}

interface SchedulerLog {
  id: string;
  executedAt: string;
  clientsProcessed: number;
  emailsSent: number;
  draftsCreated: number;
  errors: number;
  status: 'success' | 'partial' | 'failed';
}

interface EmailJourneyTemplate {
  id: string;
  dayOfMonth: number;
  title: string;
  description: string;
  emailType: string;
  promptTemplate: string;
  tone: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Email Journey Tab Component
function EmailJourneyTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");

  const { data: allProgress, isLoading } = useQuery<any[]>({
    queryKey: ["/api/email-journey-progress"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filter progress based on actions status AND phase
  const filteredProgress = allProgress?.filter((progress) => {
    // Actions filter
    if (statusFilter !== "all") {
      const hasActions = progress.lastEmailActions?.length > 0;
      if (!hasActions && statusFilter !== "no-actions") return false;
      if (!hasActions) return statusFilter === "no-actions";

      const allCompleted = progress.actionsCompletedData?.completed;
      const someCompleted = progress.actionsCompletedData?.details?.some((d: any) => d.completed);

      if (statusFilter === "completed" && !allCompleted) return false;
      if (statusFilter === "pending" && (allCompleted || !someCompleted)) return false;
      if (statusFilter === "not-started" && someCompleted) return false;
      if (statusFilter === "no-actions") return false;
    }

    // Phase filter
    if (phaseFilter !== "all") {
      const currentDay = progress.currentDay || 1;
      if (phaseFilter === "early" && currentDay > 10) return false;
      if (phaseFilter === "mid" && (currentDay <= 10 || currentDay > 20)) return false;
      if (phaseFilter === "late" && currentDay <= 20) return false;
    }

    return true;
  });

  // Calculate statistics
  const stats = {
    total: allProgress?.length || 0,
    active: allProgress?.filter((p: any) => p.currentDay <= 31).length || 0,
    allActionsCompleted: allProgress?.filter((p: any) => p.actionsCompletedData?.completed).length || 0,
    needsAttention: allProgress?.filter((p: any) => 
      p.lastEmailActions?.length > 0 && 
      !p.actionsCompletedData?.completed
    ).length || 0,
  };

  // Helper function to get email type badge with tooltip
  const getEmailTypeBadge = (emailType: string) => {
    const typeInfo: Record<string, { label: string; color: string; description: string }> = {
      motivational: {
        label: "Motivazionale",
        color: "bg-purple-100 text-purple-800 border-purple-300",
        description: "Email che ispira e motiva il cliente a proseguire nel percorso"
      },
      reflection: {
        label: "Riflessione",
        color: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700",
        description: "Email che invita il cliente a riflettere sui progressi e obiettivi"
      },
      action: {
        label: "Azione",
        color: "bg-orange-100 text-orange-800 border-orange-300",
        description: "Email con compiti specifici da completare"
      }
    };

    const info = typeInfo[emailType] || typeInfo.action;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="cursor-help">
              <Badge variant="outline" className={info.color}>
                {info.label}
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{info.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Calculate journey phases distribution
  const journeyPhases = {
    early: allProgress?.filter((p: any) => p.currentDay <= 10).length || 0,
    mid: allProgress?.filter((p: any) => p.currentDay > 10 && p.currentDay <= 20).length || 0,
    late: allProgress?.filter((p: any) => p.currentDay > 20).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Explainer Cards Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <ExplainerCard
          title="Sistema dei Template"
          description="Il journey email utilizza 31 template diversi, uno per ogni giorno del mese. Abbiamo 28 template standard per tutti i mesi, più 3 template extra per i mesi più lunghi (con 29, 30 o 31 giorni)."
          icon={BookOpen}
          variant="info"
        />
        <ExplainerCard
          title="Journey Mensile"
          description="Ogni cliente segue un percorso di email automatiche che dura un mese intero. Il sistema invia email in base ai giorni reali del mese corrente, adattandosi automaticamente ai mesi di diverse lunghezze."
          icon={Route}
          variant="info"
        />
        <ExplainerCard
          title="Giorno Corrente"
          description="Il Giorno Corrente indica quanti giorni sono passati dall'inizio del mese. Ad esempio, se siamo al 15 del mese, il cliente è al giorno 15 del suo journey mensile e riceverà il template corrispondente."
          icon={Target}
          variant="success"
        />
        <ExplainerCard
          title="Azioni Suggerite"
          description="Ogni email contiene azioni specifiche suggerite dall'intelligenza artificiale. Queste azioni sono personalizzate per ogni cliente e vengono tracciate per monitorare i progressi. Il sistema mostra quante azioni sono state completate e quante sono ancora in sospeso."
          icon={ListTodo}
          variant="success"
        />
      </div>

      {/* Journey Overview - Visual Map */}
      {allProgress && allProgress.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-6 w-6" />
              Panoramica Journey Mensile
            </CardTitle>
            <CardDescription>
              Visualizzazione della distribuzione dei clienti nelle diverse fasi del mese
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-green-200 opacity-20 rounded-full -mr-8 -mt-8"></div>
                <div className="relative">
                  <div className="text-sm font-medium text-green-700 mb-2">Inizio Mese</div>
                  <div className="text-3xl font-bold text-green-900 mb-1">{journeyPhases.early}</div>
                  <div className="text-xs text-green-600">Giorni 1-10</div>
                  <div className="mt-4 text-xs text-green-700">
                    Email introduttive e motivazionali
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-cyan-50 to-teal-100 dark:from-cyan-900/30 dark:to-teal-900/30 border-2 border-cyan-300 dark:border-cyan-700 rounded-lg p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-200 dark:bg-cyan-700 opacity-20 rounded-full -mr-8 -mt-8"></div>
                <div className="relative">
                  <div className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-2">Metà Mese</div>
                  <div className="text-3xl font-bold text-cyan-900 dark:text-cyan-100 mb-1">{journeyPhases.mid}</div>
                  <div className="text-xs text-cyan-600 dark:text-cyan-400">Giorni 11-20</div>
                  <div className="mt-4 text-xs text-cyan-700 dark:text-cyan-300">
                    Email di riflessione e consolidamento
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300 rounded-lg p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-200 opacity-20 rounded-full -mr-8 -mt-8"></div>
                <div className="relative">
                  <div className="text-sm font-medium text-orange-700 mb-2">Fine Mese</div>
                  <div className="text-3xl font-bold text-orange-900 mb-1">{journeyPhases.late}</div>
                  <div className="text-xs text-orange-600">Giorni 21-31</div>
                  <div className="mt-4 text-xs text-orange-700">
                    Email di azione e preparazione
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1 text-sm">
                  <div className="font-medium">Come leggere questa panoramica</div>
                  <p className="text-muted-foreground">
                    Ogni cliente progredisce attraverso queste tre fasi durante il mese. La distribuzione ti mostra quanti clienti si trovano in ogni fase del loro journey personale. Il sistema invia automaticamente il template appropriato in base al giorno del mese.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Clienti Totali</CardTitle>
            <Mail className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Journey Attivi</CardTitle>
            <Calendar className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.active}</div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-teal-700 dark:text-teal-300">Azioni Completate</CardTitle>
            <CheckCircle className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.allActionsCompleted}</div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">Richiedono Attenzione</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{stats.needsAttention}</div>
          </CardContent>
        </Card>
      </div>

      {/* Email Hub Quick Access */}
      <Card className="border border-indigo-200 dark:border-indigo-700 shadow-sm bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <Inbox className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">Email Hub</h3>
              <p className="text-sm text-indigo-600 dark:text-indigo-400">
                Gestisci tutti i tuoi account email e risposte AI in un unico posto
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="border-indigo-300 hover:bg-indigo-100 dark:border-indigo-600 dark:hover:bg-indigo-900"
            onClick={() => window.location.href = '/consultant/email-hub'}
          >
            Apri Email Hub
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Improved Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-6 w-6" />
                Monitoraggio Clienti
              </CardTitle>
              <CardDescription>
                Stato attuale di ogni cliente nel percorso email mensile
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Fase del mese" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le fasi</SelectItem>
                  <SelectItem value="early">🌱 Inizio (1-10)</SelectItem>
                  <SelectItem value="mid">📈 Metà (11-20)</SelectItem>
                  <SelectItem value="late">🎯 Fine (21-31)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtra per status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i clienti</SelectItem>
                  <SelectItem value="completed">✅ Azioni completate</SelectItem>
                  <SelectItem value="pending">⏳ Azioni in corso</SelectItem>
                  <SelectItem value="not-started">❌ Azioni non iniziate</SelectItem>
                  <SelectItem value="no-actions">Nessuna azione</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      Mese Journey
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="cursor-help inline-flex">
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Il mese in cui è iniziato il journey email corrente</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      Template Corrente
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="cursor-help inline-flex">
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Il template utilizzato per generare la prossima email personalizzata</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      Progresso Mese
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="cursor-help inline-flex">
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Indica quanti giorni sono passati dall'inizio del journey mensile</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      Azioni
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="cursor-help inline-flex">
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Compiti suggeriti dall'AI che il cliente deve completare</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead>Prossima Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProgress && filteredProgress.length > 0 ? (
                  filteredProgress.map((progress: any) => {
                    const client = progress.client;
                    const actionsCount = progress.actionsSummary?.total || progress.lastEmailActions?.length || 0;
                    const completedCount = progress.actionsSummary?.completed || 
                      progress.actionsCompletedData?.details?.filter((d: any) => d.completed).length || 0;
                    const currentDay = progress.currentDay || 1;
                    const lastDayOfMonth = progress.lastDayOfMonth || 31;
                    const progressPercentage = (currentDay / lastDayOfMonth) * 100;

                    let actionBadge;
                    if (actionsCount === 0) {
                      actionBadge = <Badge variant="outline" className="text-xs">Nessuna azione</Badge>;
                    } else if (completedCount === actionsCount) {
                      actionBadge = <Badge className="bg-green-500 text-xs">✅ {completedCount}/{actionsCount}</Badge>;
                    } else if (completedCount > 0) {
                      actionBadge = <Badge className="bg-orange-500 text-xs">⏳ {completedCount}/{actionsCount}</Badge>;
                    } else {
                      actionBadge = <Badge variant="destructive" className="text-xs">❌ {completedCount}/{actionsCount}</Badge>;
                    }

                    // Format month start date
                    const monthStartDate = progress.monthStartDate ? new Date(progress.monthStartDate) : null;
                    const monthYear = monthStartDate ? format(monthStartDate, "MMMM yyyy", { locale: it }) : 'N/A';

                    return (
                      <TableRow key={progress.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            {client?.avatar ? (
                              <img src={client.avatar} alt={client.firstName} className="h-8 w-8 rounded-full" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium">{client?.firstName?.charAt(0)}</span>
                              </div>
                            )}
                            <div>
                              <div className="font-semibold">{client?.firstName} {client?.lastName}</div>
                              <div className="text-xs text-muted-foreground">{client?.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-semibold text-sm capitalize">
                              {monthYear}
                            </div>
                            {monthStartDate && (
                              <div className="text-xs text-muted-foreground">
                                Iniziato il {format(monthStartDate, "dd/MM/yyyy", { locale: it })}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">
                              {progress.currentTemplate?.title || 'In attesa'}
                            </div>
                            {progress.currentTemplate?.emailType && getEmailTypeBadge(progress.currentTemplate.emailType)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2 min-w-[150px]">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Giorno {currentDay}</span>
                              <span>di {lastDayOfMonth}</span>
                            </div>
                            <Progress value={progressPercentage} className="h-2" />
                            <div className="text-xs text-center font-medium">
                              {Math.round(progressPercentage)}%
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {actionBadge}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {progress.nextEmailDate ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {format(new Date(progress.nextEmailDate), "dd/MM/yyyy", { locale: it })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">In attesa</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-semibold text-muted-foreground">Nessun cliente trovato</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        I clienti appariranno qui quando inizieranno il journey email
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* What Will Happen Section */}
      {filteredProgress && filteredProgress.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-6 w-6" />
              Cosa Succederà Prossimamente
            </CardTitle>
            <CardDescription>
              Dettagli sulle prossime email programmate per ogni cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {filteredProgress.map((progress: any, index: number) => {
                const client = progress.client;
                const nextTemplate = progress.nextTemplate;
                const nextDay = progress.nextDay;

                return (
                  <AccordionItem key={progress.id} value={`item-${index}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">{client?.firstName?.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="font-semibold">{client?.firstName} {client?.lastName}</div>
                          <div className="text-xs text-muted-foreground">
                            Prossima email: {progress.nextEmailDate ? format(new Date(progress.nextEmailDate), "dd MMMM yyyy", { locale: it }) : 'Da programmare'}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-13 space-y-4 pt-4">
                        {nextTemplate && nextDay ? (
                          <>
                            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <Mail className="h-5 w-5 text-cyan-600 mt-0.5" />
                                <div className="space-y-2 flex-1">
                                  <div className="font-semibold text-cyan-900 dark:text-cyan-100">
                                    Prossima email prevista per il giorno {nextDay}
                                  </div>
                                  <div className="text-sm text-cyan-800 dark:text-cyan-200">
                                    <span className="font-medium">Template:</span> {nextTemplate.title}
                                  </div>
                                  {nextTemplate.description && (
                                    <div className="text-sm text-cyan-700 dark:text-cyan-300 mt-2">
                                      {nextTemplate.description}
                                    </div>
                                  )}
                                  <div className="flex gap-2 mt-3">
                                    {getEmailTypeBadge(nextTemplate.emailType)}
                                    <Badge variant="outline" className="text-xs">
                                      Giorno {nextTemplate.dayOfMonth}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {progress.actionsSummary && progress.actionsSummary.total > 0 && (
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                  <ListTodo className="h-5 w-5 text-orange-600 mt-0.5" />
                                  <div className="space-y-2 flex-1">
                                    <div className="font-semibold text-orange-900">
                                      Azioni in sospeso dalla email precedente
                                    </div>
                                    <div className="text-sm text-orange-800">
                                      {progress.actionsSummary.completed} completate su {progress.actionsSummary.total} totali
                                    </div>
                                    {progress.actionsSummary.pending > 0 && (
                                      <div className="text-sm text-orange-700 font-medium mt-2">
                                        ⚠️ {progress.actionsSummary.pending} azioni ancora da completare
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                                <div className="space-y-1 flex-1">
                                  <div className="font-semibold text-emerald-900">
                                    Come funziona
                                  </div>
                                  <ul className="text-sm text-emerald-800 space-y-1 list-disc list-inside">
                                    <li>L'email verrà generata automaticamente il {progress.nextEmailDate ? format(new Date(progress.nextEmailDate), "dd/MM", { locale: it }) : 'prossimo giorno previsto'}</li>
                                    <li>Il contenuto sarà personalizzato in base al progresso del cliente</li>
                                    <li>L'AI includerà nuove azioni specifiche da completare</li>
                                    <li>Il template si adatta al giorno del mese corrente</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                            <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">
                              {progress.currentDay >= progress.lastDayOfMonth 
                                ? "Journey mensile completato. Si resetterà all'inizio del prossimo mese."
                                : "Template non ancora disponibile. Verrà determinato automaticamente."
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Echo - Riepilogo Consulenza Tab Component
function EchoTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewDialog, setPreviewDialog] = useState(false);
  const [selectedEchoDraft, setSelectedEchoDraft] = useState<any>(null);
  const [generatingEmailId, setGeneratingEmailId] = useState<string | null>(null);

  // Fetch Echo statistics
  const { data: echoStats, isLoading: statsLoading } = useQuery<{
    totalEmails: number;
    totalTasks: number;
    pendingApprovals: number;
    missingEmails: number;
    successRate: number;
  }>({
    queryKey: ["/api/echo/stats"],
  });

  // Fetch draft emails awaiting approval
  const { data: draftEmails, isLoading: draftsLoading } = useQuery<any[]>({
    queryKey: ["/api/echo/draft-emails"],
  });

  // Fetch consultations without email
  const { data: pendingConsultations, isLoading: pendingLoading } = useQuery<any[]>({
    queryKey: ["/api/echo/pending-consultations"],
  });

  // Generate email for consultation
  const generateEmailMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await fetch("/api/echo/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ consultationId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore generazione email");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Successo", description: "Email generata con successo" });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/pending-consultations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      setGeneratingEmailId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      setGeneratingEmailId(null);
    },
  });

  // Approve and send email
  const approveAndSendMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await fetch("/api/echo/approve-and-send", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ consultationId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore invio email");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Successo", description: "Email inviata con successo" });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      setPreviewDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Save for AI only
  const saveForAiMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await fetch("/api/echo/save-for-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ consultationId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore salvataggio");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Successo", description: "Email salvata per contesto AI" });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      setPreviewDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Discard draft
  const discardMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await fetch("/api/echo/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ consultationId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore scarto bozza");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Bozza scartata", description: "La bozza è stata eliminata" });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/pending-consultations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      setPreviewDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const handlePreview = (draft: any) => {
    setSelectedEchoDraft(draft);
    setPreviewDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Echo Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Email Totali</CardTitle>
            <Mail className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : echoStats?.totalEmails || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Task Totali</CardTitle>
            <ListTodo className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : echoStats?.totalTasks || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">In Attesa Approvazione</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : echoStats?.pendingApprovals || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-teal-700 dark:text-teal-300">Tasso di Successo</CardTitle>
            <TrendingUp className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${echoStats?.successRate || 0}%`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Draft Emails Waiting for Approval */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Bozze Email in Attesa di Approvazione
          </CardTitle>
          <CardDescription>
            Email di riepilogo consulenza generate da Echo in attesa della tua approvazione
          </CardDescription>
        </CardHeader>
        <CardContent>
          {draftsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
            </div>
          ) : !draftEmails || draftEmails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold text-muted-foreground">Nessuna bozza in attesa</p>
              <p className="text-sm text-muted-foreground mt-2">
                Le email generate da Echo appariranno qui per l'approvazione
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Consulenza</TableHead>
                  <TableHead>Oggetto Email</TableHead>
                  <TableHead>Task Estratti</TableHead>
                  <TableHead>Generata il</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftEmails.map((draft) => (
                  <TableRow key={draft.id}>
                    <TableCell className="font-medium">
                      {draft.client?.firstName} {draft.client?.lastName}
                    </TableCell>
                    <TableCell>
                      {draft.scheduledAt ? (
                        <Badge variant="outline" className="bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300">
                          {format(new Date(draft.scheduledAt), "dd/MM/yyyy", { locale: it })}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {draft.summaryEmailDraft?.subject || "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                        {draft.draftTasks?.length || 0} task
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {draft.summaryEmailGeneratedAt
                        ? format(new Date(draft.summaryEmailGeneratedAt), "dd/MM/yyyy HH:mm", { locale: it })
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(draft)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Vedi
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => approveAndSendMutation.mutate(draft.id)}
                          disabled={approveAndSendMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approva e Invia
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => saveForAiMutation.mutate(draft.id)}
                          disabled={saveForAiMutation.isPending}
                          className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-900/20"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Solo AI
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => discardMutation.mutate(draft.id)}
                          disabled={discardMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Scarta
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Consultations Without Email */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-orange-500" />
            Consulenze Senza Email
          </CardTitle>
          <CardDescription>
            Consulenze completate che necessitano di generazione email riepilogo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
            </div>
          ) : !pendingConsultations || pendingConsultations.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-muted-foreground">Tutte le consulenze hanno un'email</p>
              <p className="text-sm text-muted-foreground mt-2">
                Non ci sono consulenze in attesa di generazione email
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Consulenza</TableHead>
                  <TableHead>Stato Trascrizione</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingConsultations.map((consultation) => (
                  <TableRow key={consultation.id}>
                    <TableCell className="font-medium">
                      {consultation.client?.firstName} {consultation.client?.lastName}
                    </TableCell>
                    <TableCell>
                      {consultation.scheduledAt ? (
                        <Badge variant="outline" className="bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300">
                          {format(new Date(consultation.scheduledAt), "dd/MM/yyyy HH:mm", { locale: it })}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {consultation.transcript ? (
                        <Badge className="bg-emerald-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Trascrizione disponibile
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Trascrizione mancante
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setGeneratingEmailId(consultation.id);
                          generateEmailMutation.mutate(consultation.id);
                        }}
                        disabled={!consultation.transcript || generatingEmailId === consultation.id}
                        className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
                      >
                        {generatingEmailId === consultation.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Generazione...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-1" />
                            Genera Email
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Anteprima Email Riepilogo Consulenza
            </DialogTitle>
            <DialogDescription>
              Cliente: {selectedEchoDraft?.client?.firstName} {selectedEchoDraft?.client?.lastName}
            </DialogDescription>
          </DialogHeader>

          {selectedEchoDraft && (
            <div className="space-y-6">
              {/* Email Preview */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold">Oggetto</Label>
                  <p className="mt-1 p-3 bg-slate-50 rounded-lg text-sm">
                    {selectedEchoDraft.summaryEmailDraft?.subject || "N/A"}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Contenuto Email</Label>
                  <div className="mt-1 p-6 bg-white border rounded-lg max-h-[300px] overflow-y-auto">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: selectedEchoDraft.summaryEmailDraft?.body || "Nessun contenuto",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Extracted Tasks */}
              {selectedEchoDraft.draftTasks && selectedEchoDraft.draftTasks.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <ListTodo className="h-4 w-4" />
                    Task Estratti ({selectedEchoDraft.draftTasks.length})
                  </Label>
                  <div className="mt-2 space-y-2">
                    {selectedEchoDraft.draftTasks.map((task: any, index: number) => (
                      <div
                        key={task.id || index}
                        className="p-3 bg-slate-50 border rounded-lg flex items-start gap-3"
                      >
                        <Badge variant="outline" className="shrink-0">
                          {index + 1}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {task.category || "generale"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {task.priority || "medium"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setPreviewDialog(false)}>
                  Chiudi
                </Button>
                <Button
                  variant="outline"
                  onClick={() => saveForAiMutation.mutate(selectedEchoDraft.id)}
                  disabled={saveForAiMutation.isPending}
                  className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-900/20"
                >
                  {saveForAiMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Solo AI
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => discardMutation.mutate(selectedEchoDraft.id)}
                  disabled={discardMutation.isPending}
                >
                  {discardMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Scarta
                </Button>
                <Button
                  onClick={() => approveAndSendMutation.mutate(selectedEchoDraft.id)}
                  disabled={approveAndSendMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {approveAndSendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Approva e Invia
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ConsultantAIConfigPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedTestDay, setSelectedTestDay] = useState<number>(1);
  const [manualEmail, setManualEmail] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState<string>("");
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDraftPreviewDialog, setShowDraftPreviewDialog] = useState(false);
  const [showEditDraftDialog, setShowEditDraftDialog] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<EmailDraft | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [emailFrequency, setEmailFrequency] = useState(7);
  const [emailSendTime, setEmailSendTime] = useState("10:00");
  const [selectedUpdatesClients, setSelectedUpdatesClients] = useState<string[]>([]);
  const [updatesSystemPrompt, setUpdatesSystemPrompt] = useState("");
  const [updatesDescription, setUpdatesDescription] = useState("");
  const [selectedPromptPreset, setSelectedPromptPreset] = useState("custom");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 10 System Prompt Preset Professionali
  const systemPromptPresets = [
    {
      id: "professional_warm",
      name: "Professionale & Caloroso",
      prompt: "Scrivi un'email professionale ma calorosa, che comunichi gli aggiornamenti con entusiasmo ma mantenendo serietà. Enfatizza i benefici pratici per il cliente e come questi miglioramenti lo aiuteranno nel suo percorso. Usa un tono rispettoso ma amichevole, mostrando che tieni al suo successo."
    },
    {
      id: "motivational_coach",
      name: "Coach Motivazionale",
      prompt: "Genera un'email da coach motivazionale: entusiasta, energica e ispirazionale. Presenta gli aggiornamenti come nuove opportunità di crescita. Usa frasi che spingono all'azione e che fanno sentire il cliente parte di qualcosa di speciale. Connetti ogni aggiornamento ai suoi obiettivi personali."
    },
    {
      id: "concise_executive",
      name: "Esecutivo Conciso",
      prompt: "Scrivi in stile business executive: diretto, conciso, orientato ai risultati. Vai dritto al punto, elenca gli aggiornamenti in modo chiaro con bullet points, evidenzia il valore aggiunto. Niente fronzoli, solo informazioni utili e actionable. Massimo 200 parole."
    },
    {
      id: "educational_mentor",
      name: "Mentore Educativo",
      prompt: "Comunica come un mentore che educa: spiega non solo COSA è cambiato, ma anche PERCHÉ è importante e COME usarlo. Usa esempi pratici, contestualizza gli aggiornamenti rispetto al percorso del cliente. Tono paziente, didattico ma non condiscendente."
    },
    {
      id: "friendly_advisor",
      name: "Consulente Amichevole",
      prompt: "Scrivi come un amico fidato che dà consigli: tono conversazionale, caldo, personale. Usa 'tu' invece di forme impersonali. Presenta gli aggiornamenti come se stessi raccontando una novità interessante a un amico. Mantieni professionalità ma con naturalezza e spontaneità."
    },
    {
      id: "innovative_tech",
      name: "Tech Innovativo",
      prompt: "Genera email in stile tech startup innovativa: entusiasta dell'innovazione, focus su come la tecnologia migliora la vita del cliente. Usa linguaggio moderno, parole come 'rivoluzionario', 'smart', 'ottimizzato'. Enfatizza efficienza e risultati concreti."
    },
    {
      id: "empathetic_supporter",
      name: "Supporto Empatico",
      prompt: "Scrivi con empatia profonda: riconosci le sfide del cliente, presenta gli aggiornamenti come soluzioni a problemi reali che potrebbero aver incontrato. Mostra comprensione emotiva, usa frasi come 'sappiamo che...', 'per aiutarti...'. Tono rassicurante e premuroso."
    },
    {
      id: "results_focused",
      name: "Focus sui Risultati",
      prompt: "Comunica orientato 100% ai risultati: ogni aggiornamento deve essere presentato con metriche, benefici misurabili, impatto concreto. Usa numeri, percentuali, dati. Rispondi alla domanda 'Cosa ci guadagno?'. Tono assertivo, basato su fatti."
    },
    {
      id: "storyteller",
      name: "Narratore Coinvolgente",
      prompt: "Racconta gli aggiornamenti come una storia: crea un arco narrativo con un inizio (la situazione precedente), sviluppo (cosa è cambiato) e conclusione (come questo migliora la loro esperienza). Usa metafore, crea connessioni emotive. Rendi memorabile il messaggio."
    },
    {
      id: "minimalist_zen",
      name: "Minimalista Zen",
      prompt: "Scrivi in stile minimalista zen: essenziale, calmo, senza stress. Frasi brevi e chiare. Presenta gli aggiornamenti come miglioramenti naturali, senza creare urgenza o pressione. Tono rilassato ma professionale. Meno è meglio. Chiarezza assoluta."
    },
    {
      id: "custom",
      name: "✏️ Personalizzato",
      prompt: ""
    }
  ];

  const { data: smtpSettings, isLoading: smtpLoading } = useQuery<SMTPSettings>({
    queryKey: ["/api/consultant/smtp-settings"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/smtp-settings", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch SMTP settings");
      const data = await response.json();
      setAutomationEnabled(data.automationEnabled || false);
      setEmailFrequency(data.emailFrequencyDays || 7);
      return data;
    },
  });

  const updateSmtpMutation = useMutation({
    mutationFn: async (data: Partial<SMTPSettings>) => {
      const res = await fetch("/api/consultant/smtp-settings", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/smtp-settings"] });
      toast({
        title: "Impostazioni Salvate",
        description: "Le impostazioni di automation sono state aggiornate",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvataggio delle impostazioni",
        variant: "destructive",
      });
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<AIEmailStats>({
    queryKey: ["/api/consultant/ai-email-stats"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/ai-email-stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch AI stats");
      return response.json();
    },
  });

  const { data: drafts = [], isLoading: draftsLoading } = useQuery<EmailDraft[]>({
    queryKey: ["/api/consultant/email-drafts", { status: "pending" }],
    queryFn: async () => {
      const response = await fetch("/api/consultant/email-drafts?status=pending", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch drafts");
      const result = await response.json();
      const allDrafts = result.data || result;
      // Escludi le email di riepilogo consulenza dal tab "Email Journey"
      return allDrafts.filter((draft: EmailDraft) => draft.emailType !== "consultation_summary");
    },
  });

  const { data: consultationDrafts = [], isLoading: consultationDraftsLoading } = useQuery<EmailDraft[]>({
    queryKey: ["/api/consultant/email-drafts", { emailType: "consultation_summary", status: "pending" }],
    queryFn: async () => {
      const response = await fetch("/api/consultant/email-drafts?emailType=consultation_summary&status=pending", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch consultation drafts");
      const result = await response.json();
      return result.data || result;
    },
  });

  const { data: clientAutomation = [], isLoading: clientAutomationLoading } = useQuery<ClientAutomation[]>({
    queryKey: ["/api/consultant/client-automation"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/client-automation", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch client automation");
      const result = await response.json();
      return result.data || result;
    },
  });

  const { data: journeyTemplates = [], isLoading: templatesLoading } = useQuery<EmailJourneyTemplate[]>({
    queryKey: ["/api/email-journey-templates"],
    queryFn: async () => {
      const response = await fetch("/api/email-journey-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch journey templates");
      return response.json();
    },
  });

  // Custom Journey Templates Query
  const [customBusinessContext, setCustomBusinessContext] = useState("");
  const [customGenerationSuccess, setCustomGenerationSuccess] = useState<{ count: number } | null>(null);
  
  const { data: customJourneyData, isLoading: customJourneyLoading } = useQuery<{
    templates: EmailJourneyTemplate[];
    isCustom: boolean;
    hasCustomTemplates: boolean;
    hasSmtpSettings: boolean;
    businessContext: string | null;
    useCustomTemplates: boolean;
    lastGeneratedAt: string | null;
  }>({
    queryKey: ["/api/consultant/journey-templates"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/journey-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { templates: [], isCustom: false, businessContext: null, useCustomTemplates: false, lastGeneratedAt: null };
        throw new Error("Failed to fetch custom journey templates");
      }
      const result = await response.json();
      return result.data || result;
    },
  });

  // Update businessContext state when data loads
  useState(() => {
    if (customJourneyData?.businessContext) {
      setCustomBusinessContext(customJourneyData.businessContext);
    }
  });

  // Generate Custom Templates Mutation
  const generateCustomTemplatesMutation = useMutation({
    mutationFn: async (context: string) => {
      const response = await fetch("/api/consultant/journey-templates/generate", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
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
      setCustomGenerationSuccess({ count: data.templatesGenerated || 10 });
      toast({ title: "Template Generati", description: `${data.templatesGenerated || 10} template personalizzati creati` });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Update Custom Templates Settings Mutation
  const updateCustomSettingsMutation = useMutation({
    mutationFn: async (settings: { useCustomTemplates?: boolean; businessContext?: string }) => {
      const response = await fetch("/api/consultant/journey-templates/settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
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
      toast({ title: "Impostazioni Aggiornate" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Reset Custom Templates Mutation
  const resetCustomTemplatesMutation = useMutation({
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
      setCustomBusinessContext("");
      setCustomGenerationSuccess(null);
      toast({ title: "Template Ripristinati", description: "Tornato ai template di default" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const { data: clientAutomationStatus, isLoading: clientStatusLoading } = useQuery<{
    success: boolean;
    automationEnabled: boolean;
    emailFrequency: number;
    clients: ClientAutomationStatus[];
  }>({
    queryKey: ["/api/consultant/client-automation-status"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/client-automation-status", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch client automation status");
      return response.json();
    },
    refetchInterval: false, // No automatic polling
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const { data: schedulerStatus, isLoading: schedulerStatusLoading } = useQuery<SchedulerStatus>({
    queryKey: ["/api/consultant/scheduler/status"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/scheduler/status", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch scheduler status");
      return response.json();
    },
    refetchInterval: false, // No automatic polling
  });

  const { data: schedulerLogs = [], isLoading: schedulerLogsLoading } = useQuery<SchedulerLog[]>({
    queryKey: ["/api/consultant/scheduler/logs"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/scheduler/logs?limit=10", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch scheduler logs");
      const result = await response.json();
      return result.data || result;
    },
  });

  const { data: contextPreview, isLoading: contextLoading } = useQuery<AIContextPreview>({
    queryKey: ["/api/consultant/ai-context-preview", selectedClient],
    queryFn: async () => {
      const response = await fetch(`/api/consultant/ai-context-preview/${selectedClient}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch context preview");
      return response.json();
    },
    enabled: !!selectedClient,
  });

  const approveDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const res = await fetch(`/api/consultant/email-drafts/${draftId}/approve`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to approve draft");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/email-drafts"] });
      toast({
        title: "Bozza Approvata",
        description: "L'email è stata approvata e verrà inviata",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'approvazione della bozza",
        variant: "destructive",
      });
    },
  });

  const rejectDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const res = await fetch(`/api/consultant/email-drafts/${draftId}/reject`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to reject draft");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/email-drafts"] });
      toast({
        title: "Bozza Rifiutata",
        description: "La bozza è stata eliminata",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel rifiuto della bozza",
        variant: "destructive",
      });
    },
  });

  const editDraftMutation = useMutation({
    mutationFn: async ({ draftId, subject, body }: { draftId: string; subject: string; body: string }) => {
      const res = await fetch(`/api/consultant/email-drafts/${draftId}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) throw new Error("Failed to edit draft");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/email-drafts"] });
      setShowEditDraftDialog(false);
      toast({
        title: "Bozza Modificata",
        description: "Le modifiche sono state salvate",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella modifica della bozza",
        variant: "destructive",
      });
    },
  });

  const sendConsultationDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      console.log('📧 [SEND MUTATION] Starting send request for draft:', draftId);
      const res = await fetch(`/api/consultant/email-drafts/${draftId}/approve`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      console.log('📧 [SEND MUTATION] Response status:', res.status);
      console.log('📧 [SEND MUTATION] Response ok:', res.ok);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ [SEND MUTATION] Error response:', errorText);
        throw new Error(`Failed to send consultation draft: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      console.log('✅ [SEND MUTATION] Success response:', data);
      return data;
    },
    onSuccess: () => {
      console.log('✅ [SEND MUTATION] onSuccess triggered');
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/email-drafts"] });
      toast({
        title: "Email Inviata",
        description: "L'email di riepilogo consulenza è stata inviata con successo",
      });
    },
    onError: (error: any) => {
      console.error('❌ [SEND MUTATION] onError triggered:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore nell'invio dell'email",
        variant: "destructive",
      });
    },
  });

  const deleteConsultationDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const res = await fetch(`/api/consultant/email-drafts/${draftId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete consultation draft");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/email-drafts"] });
      toast({
        title: "Bozza Eliminata",
        description: "La bozza è stata eliminata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione della bozza",
        variant: "destructive",
      });
    },
  });

  const saveForAiMutation = useMutation({
    mutationFn: async (draftId: string) => {
      console.log('💾 [SAVE FOR AI] Starting save request for draft:', draftId);
      const res = await fetch(`/api/consultant/email-drafts/${draftId}/save-for-ai`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      console.log('💾 [SAVE FOR AI] Response status:', res.status);
      console.log('💾 [SAVE FOR AI] Response ok:', res.ok);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ [SAVE FOR AI] Error response:', errorText);
        throw new Error(`Failed to save for AI: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      console.log('✅ [SAVE FOR AI] Success response:', data);
      return data;
    },
    onSuccess: () => {
      console.log('✅ [SAVE FOR AI] onSuccess triggered');
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/email-drafts"] });
      toast({
        title: "Riepilogo Salvato per AI",
        description: "Riepilogo salvato per AI (non inviato al cliente)",
      });
    },
    onError: (error: any) => {
      console.error('❌ [SAVE FOR AI] onError triggered:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvataggio per AI",
        variant: "destructive",
      });
    },
  });

  const toggleClientAutomationMutation = useMutation({
    mutationFn: async ({ clientId, enabled }: { clientId: string; enabled: boolean }) => {
      const res = await fetch(`/api/consultant/client-automation/${clientId}/toggle`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle automation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/client-automation"] });
      toast({
        title: "Automation Aggiornata",
        description: "Le impostazioni di automation del cliente sono state modificate",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'aggiornamento dell'automation",
        variant: "destructive",
      });
    },
  });

  const generateTestEmailMutation = useMutation({
    mutationFn: async ({ clientId, testEmail, testDay }: { clientId: string; testEmail?: string; testDay?: number }) => {
      const response = await fetch("/api/consultant/ai-email/test-generate", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId, testEmail, testDay }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate test email");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email Inviata",
        description: `Email di test inviata con successo a ${data.sentTo}`,
      });
      setManualEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'invio dell'email di test",
        variant: "destructive",
      });
    },
  });

  const startSchedulerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/consultant/scheduler/start", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to start scheduler");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/scheduler/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/scheduler/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/client-automation-status"] });
      toast({
        title: "Scheduler Avviato",
        description: "Lo scheduler è stato avviato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'avvio dello scheduler",
        variant: "destructive",
      });
    },
  });

  const pauseSchedulerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/consultant/scheduler/pause", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to pause scheduler");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/scheduler/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/scheduler/logs"] });
      toast({
        title: "Scheduler in Pausa",
        description: "Lo scheduler è stato messo in pausa",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella pausa dello scheduler",
        variant: "destructive",
      });
    },
  });

  const resumeSchedulerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/consultant/scheduler/resume", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to resume scheduler");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/scheduler/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/scheduler/logs"] });
      toast({
        title: "Scheduler Ripreso",
        description: "Lo scheduler è stato ripreso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel ripristino dello scheduler",
        variant: "destructive",
      });
    },
  });

  const stopSchedulerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/consultant/scheduler/stop", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to stop scheduler");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/scheduler/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/scheduler/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/client-automation-status"] });
      toast({
        title: "Scheduler Fermato",
        description: "Lo scheduler è stato fermato",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'arresto dello scheduler",
        variant: "destructive",
      });
    },
  });

  const executeNowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/consultant/scheduler/execute-now", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to execute scheduler now");
      return res.json();
    },
    onSuccess: () => {
      // Single refetch after 3 minutes (when execution is complete)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/consultant/scheduler/status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/consultant/scheduler/logs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/consultant/email-drafts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai-email-stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/consultant/client-automation-status"] });
      }, 180000); // 3 minutes

      toast({
        title: "Esecuzione Avviata",
        description: "L'esecuzione manuale dello scheduler è stata avviata. La pagina si aggiornerà tra 3 minuti.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'esecuzione immediata",
        variant: "destructive",
      });
    },
  });

  const generateSystemUpdatesMutation = useMutation({
    mutationFn: async ({ systemPrompt, updateContent, clientIds }: { systemPrompt: string; updateContent: string; clientIds: string[] }) => {
      const response = await fetch("/api/consultant/email-drafts/generate-system-updates", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ systemPrompt, updateContent, clientIds }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate system update drafts");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/email-drafts"] });
      const { successful, failed } = data.data.summary;
      toast({
        title: "Bozze Generate",
        description: `${successful} bozze create con successo${failed > 0 ? `, ${failed} errori` : ''}. Controlla la tab Bozze.`,
      });
      // Reset form
      setUpdatesSystemPrompt("");
      setUpdatesDescription("");
      setSelectedUpdatesClients([]);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la generazione delle bozze di aggiornamento",
        variant: "destructive",
      });
    },
  });

  const handleGenerateSystemUpdates = () => {
    if (!updatesSystemPrompt || !updatesDescription || selectedUpdatesClients.length === 0) {
      toast({
        title: "Attenzione",
        description: "Compila tutti i campi e seleziona almeno un cliente",
        variant: "destructive",
      });
      return;
    }

    generateSystemUpdatesMutation.mutate({
      systemPrompt: updatesSystemPrompt,
      updateContent: updatesDescription,
      clientIds: selectedUpdatesClients,
    });
  };

  const handleGenerateTest = () => {
    if (!selectedClient) {
      toast({
        title: "Attenzione",
        description: "Seleziona un cliente per generare l'email di test",
        variant: "destructive",
      });
      return;
    }

    // Chiama l'endpoint con clientId, testDay, e opzionalmente testEmail
    generateTestEmailMutation.mutate({
      clientId: selectedClient,
      testEmail: manualEmail || undefined,
      testDay: selectedTestDay,
    });
  };

  const handleSaveAutomationSettings = (enabled?: boolean) => {
    console.log('💾 [SAVE AUTOMATION] Starting save...');
    console.log('💾 [SAVE AUTOMATION] Current emailFrequency state:', emailFrequency);
    console.log('💾 [SAVE AUTOMATION] enabled param:', enabled);
    console.log('💾 [SAVE AUTOMATION] automationEnabled state:', automationEnabled);

    // Ensure emailFrequency is a valid number, default to 2 if invalid
    const validFrequency = emailFrequency && !isNaN(emailFrequency) ? emailFrequency : 2;
    console.log('💾 [SAVE AUTOMATION] Valid frequency to save:', validFrequency);

    const payload = {
      automationEnabled: enabled !== undefined ? enabled : automationEnabled,
      emailFrequencyDays: validFrequency,
    };
    console.log('💾 [SAVE AUTOMATION] Mutation payload:', payload);

    updateSmtpMutation.mutate(payload);
  };

  const handlePreviewDraft = (draft: EmailDraft) => {
    setSelectedDraft(draft);
    setShowDraftPreviewDialog(true);
  };

  const handleEditDraft = (draft: EmailDraft) => {
    setSelectedDraft(draft);
    setEditSubject(draft.subject);
    setEditBody(draft.body);
    setShowEditDraftDialog(true);
  };

  const handleSaveEditDraft = () => {
    if (selectedDraft) {
      editDraftMutation.mutate({
        draftId: selectedDraft.id,
        subject: editSubject,
        body: editBody,
      });
    }
  };

  const isSmtpConfigured = smtpSettings?.smtpHost && smtpSettings?.smtpUser;

  const promptTemplate = `Sei un consulente motivazionale esperto e empatico. Genera un'email personalizzata per il cliente {{clientName}}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TONO EMAIL RICHIESTO: {{emailTone}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Adatta il tono dell'email a: "{{emailTone}}"
- motivazionale: empatico, energico, incoraggiante
- formale: professionale, rispettoso, misurato
- amichevole: caloroso, informale ma rispettoso
- professionale: competente, diretto, orientato ai risultati

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 CONTESTO COMPLETO CLIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 INFORMAZIONI BASE:
Nome: {{clientName}}
Livello: {{clientLevel}}
Data iscrizione: {{enrolledDate}}

📍 STATO ATTUALE:
{{currentState}}

🎯 STATO IDEALE (dove vuole arrivare):
{{idealState}}

💭 BENEFICIO INTERNO (emotivo/psicologico):
{{internalBenefit}}

🏡 BENEFICIO ESTERNO (tangibile):
{{externalBenefit}}

⚠️ OSTACOLO PRINCIPALE:
{{mainObstacle}}

🔄 COSA HA GIÀ PROVATO IN PASSATO:
{{pastAttempts}}

⚡ COSA STA FACENDO ADESSO:
{{currentActions}}

🚀 VISIONE 3-5 ANNI (dove si vede):
{{futureVision}}

🔥 COSA LA MOTIVA A RAGGIUNGERE I RISULTATI:
{{motivationDrivers}}

📚 ESERCIZI COMPLETATI:
{{exercisesData}}

🎓 PERCORSO UNIVERSITARIO:
{{universityData}}

📖 BIBLIOTECA DOCUMENTI:
{{libraryData}}

🎯 OBIETTIVI ATTIVI:
{{activeGoals}}

✅ TASK DA COMPLETARE:
{{incompleteTasks}}

🗓️ PROSSIMA CONSULENZA: {{nextConsultation}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ISTRUZIONI PER LA GENERAZIONE EMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ HAI ACCESSO AL CONTESTO COMPLETO DEL CLIENTE ⭐

USA queste informazioni per personalizzare l'email in modo PROFONDO e SPECIFICO, non generico.
Non limitarti a stato attuale/ideale. Attingi da:
- I suoi esercizi (categoria, performance, feedback ricevuto)
- Il suo percorso universitario (lezioni, progressi, cosa sta studiando)
- I documenti della biblioteca (cosa ha letto, cosa dovrebbe leggere)
- I dati finanziari (se disponibili)
- La sua roadmap personale
- I suoi obiettivi specifici con valori numerici
- Le sue task concrete
- Cosa ha già provato (pastAttempts)
- Cosa sta facendo ora (currentActions)
- Dove vuole arrivare in 3-5 anni (futureVision)

1. **TONO**: Rispetta il tono "{{emailTone}}" richiesto dal consulente

2. **LUNGHEZZA**: 150-250 parole (email concisa ma impattante e personalizzata)

3. **STRUTTURA OBBLIGATORIA**:
   a) Saluto personale appropriato al tono
   b) Riferimento SPECIFICO a qualcosa dal suo contesto (es: "ho visto che hai completato l'esercizio X")
   c) Connessione tra il suo progresso/attività recente e il suo obiettivo finale
   d) Richiamo ai benefici interni ED esterni che vuole raggiungere
   e) Call-to-action concreta basata su task, esercizi o lezioni (max 3-4 elementi)
   f) Se c'è prossima consulenza entro 7 giorni, menzionala
   g) Chiusura appropriata al tono

4. **PERSONALIZZAZIONE PROFONDA**:
   - Menziona dati SPECIFICI dal contesto (es: "Sei al 45% del corso")
   - Riferisci esercizi o documenti SPECIFICI per nome
   - Usa numeri concreti (es: "Hai completato 7 su 12 esercizi")
   - Collega le attività recenti agli obiettivi a lungo termine

5. **EVITA RIPETIZIONI**:
   - Se ci sono email precedenti, NON ripetere gli stessi argomenti
   - Trova nuovi angoli e nuove prospettive dal contesto ricco
   - Varia gli elementi su cui focalizzi l'attenzione

6. **STILE**:
   - NO emoji esagerate (massimo 2-3 in tutta l'email)
   - NO frasi fatte o cliché motivazionali generici
   - SÌ riferimenti SPECIFICI e NUMERICI alla sua situazione reale
   - SÌ linguaggio diretto e concreto`;

  if (smtpLoading || statsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-cyan-600 mx-auto" />
          <p className="text-slate-600">Caricamento configurazione AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
          {/* Navigation Tabs */}
          <NavigationTabs
            tabs={[
              { label: "Configurazione", href: "/consultant/ai-config", icon: Sparkles },
              { label: "Log Email", href: "/consultant/email-logs", icon: History },
              { label: "Email Hub", href: "/consultant/email-hub", icon: Inbox },
            ]}
          />

          <div className="mb-6">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl"></div>
              <div className="relative z-10 flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl shadow-lg shadow-cyan-500/25">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Centro Controllo Email Automation</h1>
                  <p className="text-slate-400 text-sm mt-0.5">Gestisci l'intelligenza artificiale e l'automazione delle email</p>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="controllo" className="space-y-6">
            <TabsList className="grid w-full grid-cols-9 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-1.5 h-auto rounded-xl shadow-sm backdrop-blur-sm">
              <TabsTrigger 
                value="controllo" 
                className="flex items-center gap-2 py-3 px-3 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-700 data-[state=active]:to-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden lg:inline">Controllo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="drafts" 
                className="flex items-center gap-2 py-3 px-3 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden lg:inline">Bozze</span>
              </TabsTrigger>
              <TabsTrigger 
                value="echo" 
                className="flex items-center gap-2 py-3 px-3 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden lg:inline">Echo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="consultation-summary" 
                className="flex items-center gap-2 py-3 px-3 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <Mail className="h-4 w-4" />
                <span className="hidden lg:inline">Riepilogo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="statistics" 
                className="flex items-center gap-2 py-3 px-3 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden lg:inline">Statistiche</span>
              </TabsTrigger>
              <TabsTrigger 
                value="clients" 
                className="flex items-center gap-2 py-3 px-3 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600 data-[state=active]:to-slate-700 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <Users className="h-4 w-4" />
                <span className="hidden lg:inline">Clienti</span>
              </TabsTrigger>
              <TabsTrigger 
                value="journey" 
                className="flex items-center gap-2 py-3 px-3 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <Route className="h-4 w-4" />
                <span className="hidden lg:inline">Journey</span>
              </TabsTrigger>
              <TabsTrigger 
                value="updates" 
                className="flex items-center gap-2 py-3 px-3 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <Megaphone className="h-4 w-4" />
                <span className="hidden lg:inline">Updates</span>
              </TabsTrigger>
              <TabsTrigger 
                value="test" 
                className="flex items-center gap-2 py-3 px-3 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <Zap className="h-4 w-4" />
                <span className="hidden lg:inline">Test</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="controllo" className="space-y-6">
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg">
                      <Settings className="h-4 w-4 text-white" />
                    </div>
                    Impostazioni Automation
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Configura l'automazione generale delle email AI
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!isSmtpConfigured && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Configurazione SMTP mancante! Le email non possono essere inviate. Configura SMTP prima di attivare l'automation.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="space-y-1">
                      <Label htmlFor="automation-toggle" className="text-base font-semibold">
                        Automation Generale
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {automationEnabled 
                          ? "Solo i clienti selezionati ricevono email automatiche" 
                          : "Tutte le email vanno in bozza per approvazione manuale"}
                      </p>
                    </div>
                    <Switch
                      id="automation-toggle"
                      checked={automationEnabled}
                      onCheckedChange={(checked) => {
                        setAutomationEnabled(checked);
                        handleSaveAutomationSettings(checked);
                      }}
                      disabled={!isSmtpConfigured || updateSmtpMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-frequency">Frequenza Email (giorni)</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="email-frequency"
                        type="number"
                        min={1}
                        max={30}
                        value={emailFrequency || ''}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === '') {
                            setEmailFrequency(2);
                            return;
                          }
                          const val = parseInt(inputValue, 10);
                          if (!isNaN(val) && val >= 1 && val <= 30) {
                            setEmailFrequency(val);
                          }
                        }}
                        className="max-w-[200px]"
                      />
                      <span className="text-sm text-muted-foreground">
                        Invia email ogni {emailFrequency || 2} giorni
                      </span>
                      <Button
                        onClick={() => handleSaveAutomationSettings()}
                        disabled={updateSmtpMutation.isPending}
                        size="sm"
                      >
                        {updateSmtpMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvataggio...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Salva Frequenza
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-lg">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    Centro Controllo Scheduler
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Gestisci lo scheduler per l'invio automatico delle email
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {schedulerStatusLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                    </div>
                  ) : schedulerStatus ? (
                    <>
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="space-y-1">
                          <Label className="text-base font-semibold text-slate-700 dark:text-slate-300">Stato Scheduler</Label>
                          <div className="flex items-center gap-2 mt-2">
                            {schedulerStatus.schedulerEnabled && !schedulerStatus.schedulerPaused ? (
                              <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">Attivo</Badge>
                            ) : schedulerStatus.schedulerEnabled && schedulerStatus.schedulerPaused ? (
                              <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">In Pausa</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-slate-200 text-slate-600">Disattivato</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-cyan-600" />
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ultima esecuzione</Label>
                          </div>
                          <p className="text-base font-medium text-slate-900 dark:text-slate-100">
                            {schedulerStatus.lastSchedulerRun 
                              ? format(new Date(schedulerStatus.lastSchedulerRun), "dd/MM/yyyy HH:mm", { locale: it })
                              : "Mai eseguito"}
                          </p>
                        </div>

                        <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-teal-600" />
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Prossima esecuzione</Label>
                          </div>
                          <p className="text-base font-medium text-slate-900 dark:text-slate-100">
                            {schedulerStatus.nextSchedulerRun 
                              ? format(new Date(schedulerStatus.nextSchedulerRun), "dd/MM/yyyy HH:mm", { locale: it })
                              : "Non programmata"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {!schedulerStatus.schedulerEnabled && (
                          <Button
                            onClick={() => startSchedulerMutation.mutate()}
                            disabled={startSchedulerMutation.isPending}
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md"
                          >
                            {startSchedulerMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Avvio...
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" />
                                Avvia Scheduler
                              </>
                            )}
                          </Button>
                        )}

                        {schedulerStatus.schedulerEnabled && !schedulerStatus.schedulerPaused && (
                          <Button
                            onClick={() => pauseSchedulerMutation.mutate()}
                            disabled={pauseSchedulerMutation.isPending}
                            variant="outline"
                            className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          >
                            {pauseSchedulerMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Pausa...
                              </>
                            ) : (
                              <>
                                <Pause className="mr-2 h-4 w-4" />
                                Pausa
                              </>
                            )}
                          </Button>
                        )}

                        {schedulerStatus.schedulerEnabled && schedulerStatus.schedulerPaused && (
                          <Button
                            onClick={() => resumeSchedulerMutation.mutate()}
                            disabled={resumeSchedulerMutation.isPending}
                            className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-md"
                          >
                            {resumeSchedulerMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Ripristino...
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" />
                                Riprendi
                              </>
                            )}
                          </Button>
                        )}

                        {schedulerStatus.schedulerEnabled && (
                          <Button
                            onClick={() => stopSchedulerMutation.mutate()}
                            disabled={stopSchedulerMutation.isPending}
                            variant="destructive"
                          >
                            {stopSchedulerMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Arresto...
                              </>
                            ) : (
                              <>
                                <Square className="mr-2 h-4 w-4" />
                                Ferma
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          onClick={() => {
                            if (executeNowMutation.isPending) return;
                            if (confirm("Vuoi eseguire lo scheduler immediatamente?")) {
                              executeNowMutation.mutate();
                            }
                          }}
                          disabled={executeNowMutation.isPending}
                          variant="outline"
                          className="border-cyan-500 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                        >
                          {executeNowMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Esecuzione...
                            </>
                          ) : (
                            <>
                              <RotateCw className="mr-2 h-4 w-4" />
                              Esegui Ora
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="pt-4">
                        <Label className="text-base font-semibold mb-4 block text-slate-700 dark:text-slate-300">Ultimi 10 Log</Label>
                        {schedulerLogsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                          </div>
                        ) : schedulerLogs.length === 0 ? (
                          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <Clock className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                            <p className="text-sm text-slate-500">Nessuna esecuzione registrata</p>
                          </div>
                        ) : (
                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                                  <TableHead className="text-slate-700 dark:text-slate-300">Data/Ora</TableHead>
                                  <TableHead className="text-slate-700 dark:text-slate-300">Clienti Processati</TableHead>
                                  <TableHead className="text-slate-700 dark:text-slate-300">Email Inviate</TableHead>
                                  <TableHead className="text-slate-700 dark:text-slate-300">Draft Creati</TableHead>
                                  <TableHead className="text-slate-700 dark:text-slate-300">Errori</TableHead>
                                  <TableHead className="text-slate-700 dark:text-slate-300">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {schedulerLogs.map((log) => (
                                  <TableRow key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                                      {format(new Date(log.executedAt), "dd/MM/yyyy HH:mm", { locale: it })}
                                    </TableCell>
                                    <TableCell className="text-slate-600 dark:text-slate-400">{log.clientsProcessed}</TableCell>
                                    <TableCell className="text-slate-600 dark:text-slate-400">{log.emailsSent}</TableCell>
                                    <TableCell className="text-slate-600 dark:text-slate-400">{log.draftsCreated}</TableCell>
                                    <TableCell className="text-slate-600 dark:text-slate-400">{log.errors}</TableCell>
                                    <TableCell>
                                      {log.status === 'success' && (
                                        <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">Success</Badge>
                                      )}
                                      {log.status === 'partial' && (
                                        <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">Partial</Badge>
                                      )}
                                      {log.status === 'failed' && (
                                        <Badge variant="destructive">Failed</Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Impossibile caricare lo stato dello scheduler
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="drafts" className="space-y-6">
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg">
                      <FileText className="h-4 w-4 text-white" />
                    </div>
                    Bozze Email in Attesa
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Rivedi e approva le email generate dall'AI prima dell'invio
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {draftsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                    </div>
                  ) : drafts.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Mail className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">Nessuna bozza in attesa</p>
                      <p className="text-sm text-slate-500 mt-2">
                        Le email generate dall'AI appariranno qui per l'approvazione
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                          <TableHead className="text-slate-700 dark:text-slate-300 w-[140px]">Cliente</TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300">Subject</TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 w-[180px]">Template</TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 w-[110px]">Data</TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 text-right w-[130px]">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drafts.map((draft) => (
                          <TableRow key={draft.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                              {draft.clientName || <span className="text-slate-400 italic">Sconosciuto</span>}
                            </TableCell>
                            <TableCell className="max-w-md truncate text-slate-600 dark:text-slate-400">{draft.subject}</TableCell>
                            <TableCell>
                              {draft.emailType === 'system_update' ? (
                                <Badge className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs">
                                  Aggiornamento
                                </Badge>
                              ) : draft.journeyDay ? (
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="font-semibold text-xs">
                                    Giorno {draft.journeyDay}
                                  </Badge>
                                  {(draft as any).journeyTemplate?.title && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                      {(draft as any).journeyTemplate.title}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-slate-400">{format(new Date(draft.generatedAt), "dd/MM HH:mm")}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                                  onClick={() => handlePreviewDraft(draft)}
                                  title="Anteprima"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  onClick={() => handleEditDraft(draft)}
                                  title="Modifica"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                  onClick={() => approveDraftMutation.mutate(draft.id)}
                                  disabled={approveDraftMutation.isPending}
                                  title="Approva e invia"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => rejectDraftMutation.mutate(draft.id)}
                                  disabled={rejectDraftMutation.isPending}
                                  title="Rifiuta"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="echo" className="space-y-6">
              <EchoTab />
            </TabsContent>

            <TabsContent value="consultation-summary" className="space-y-6">
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg">
                      <FileText className="h-4 w-4 text-white" />
                    </div>
                    Bozze Email Riepilogo Consulenza
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Email di riepilogo generate dall'AI dopo le consulenze
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {consultationDraftsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                    </div>
                  ) : consultationDrafts.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Mail className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">Nessuna bozza di riepilogo consulenza</p>
                      <p className="text-sm text-slate-500 mt-2">
                        Le email di riepilogo consulenza generate dall'AI appariranno qui
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Data Consulenza</TableHead>
                          <TableHead>Link Fathom</TableHead>
                          <TableHead>Generata il</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consultationDrafts.map((draft) => (
                          <TableRow key={draft.id}>
                            <TableCell className="font-medium">{draft.clientName}</TableCell>
                            <TableCell className="max-w-md truncate">{draft.subject}</TableCell>
                            <TableCell>
                              {draft.metadata?.consultationDate ? (
                                <Badge variant="outline" className="bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300">
                                  {format(new Date(draft.metadata.consultationDate), "dd/MM/yyyy", { locale: it })}
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-500">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {draft.metadata?.fathomShareLink ? (
                                <a
                                  href={draft.metadata.fathomShareLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-600 hover:text-cyan-700 hover:underline text-sm flex items-center gap-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  Vedi Registrazione
                                </a>
                              ) : (
                                <span className="text-xs text-slate-500">Nessun link</span>
                              )}
                            </TableCell>
                            <TableCell>{format(new Date(draft.generatedAt), "dd/MM/yyyy HH:mm", { locale: it })}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePreviewDraft(draft)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Preview
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    console.log('💾 [SAVE FOR AI] Salvataggio riepilogo per AI');
                                    console.log('💾 [SAVE FOR AI] Draft ID:', draft.id);
                                    console.log('💾 [SAVE FOR AI] Cliente:', draft.clientName);
                                    console.log('💾 [SAVE FOR AI] Consultation ID:', draft.metadata?.consultationId);
                                    saveForAiMutation.mutate(draft.id);
                                  }}
                                  disabled={saveForAiMutation.isPending}
                                  className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white border-0"
                                >
                                  Salva per AI
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    console.log('📧 [CONSULTATION EMAIL] Invio email di riepilogo consulenza');
                                    console.log('📧 [CONSULTATION EMAIL] Draft ID:', draft.id);
                                    console.log('📧 [CONSULTATION EMAIL] Cliente:', draft.clientName);
                                    console.log('📧 [CONSULTATION EMAIL] Subject:', draft.subject);
                                    console.log('📧 [CONSULTATION EMAIL] Data consulenza:', draft.metadata?.consultationDate);
                                    console.log('📧 [CONSULTATION EMAIL] Link Fathom:', draft.metadata?.fathomShareLink);
                                    sendConsultationDraftMutation.mutate(draft.id);
                                  }}
                                  disabled={sendConsultationDraftMutation.isPending}
                                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Invia
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteConsultationDraftMutation.mutate(draft.id)}
                                  disabled={deleteConsultationDraftMutation.isPending}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Elimina
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="statistics" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl shadow-md shadow-cyan-500/20">
                        <Mail className="text-white h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Email Generate</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats?.totalGenerated || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-md shadow-emerald-500/20">
                        <TrendingUp className="text-white h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Success Rate</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats?.successRate || 0}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl shadow-md shadow-teal-500/20">
                        <FileText className="text-white h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Lunghezza Media</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats?.averageLength || 0}</p>
                        <p className="text-xs text-slate-400">parole</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-md shadow-amber-500/20">
                        <Brain className="text-white h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">AI Attivo</p>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="text-emerald-500 h-5 w-5" />
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Online</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                      <BarChart3 className="h-4 w-4 text-white" />
                    </div>
                    Distribuzione Toni Email
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Analisi dei toni utilizzati nelle email generate dall'AI
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Professionale</span>
                            <span className="text-sm text-slate-500">{stats.toneDistribution?.professionale || 0}</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                            <div 
                              className="bg-gradient-to-r from-cyan-500 to-teal-500 h-3 rounded-full transition-all" 
                              style={{ width: `${stats.totalGenerated > 0 ? ((stats.toneDistribution?.professionale || 0) / stats.totalGenerated) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Amichevole</span>
                            <span className="text-sm text-slate-500">{stats.toneDistribution?.amichevole || 0}</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                            <div 
                              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all" 
                              style={{ width: `${stats.totalGenerated > 0 ? ((stats.toneDistribution?.amichevole || 0) / stats.totalGenerated) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Motivazionale</span>
                            <span className="text-sm text-slate-500">{stats.toneDistribution?.motivazionale || 0}</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                            <div 
                              className="bg-gradient-to-r from-teal-500 to-emerald-500 h-3 rounded-full transition-all" 
                              style={{ width: `${stats.totalGenerated > 0 ? ((stats.toneDistribution?.motivazionale || 0) / stats.totalGenerated) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Personalizza Journey Email Section */}
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500"></div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-white">Personalizza Journey Email</CardTitle>
                        <CardDescription className="text-slate-400">
                          Adatta i template email al tuo business con l'AI
                        </CardDescription>
                      </div>
                    </div>
                    {customJourneyData?.useCustomTemplates && (
                      <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
                        Template Personalizzati Attivi
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customBusinessContext" className="text-slate-700 dark:text-slate-300 font-medium">
                      Descrivi la tua attività
                    </Label>
                    <Textarea
                      id="customBusinessContext"
                      placeholder="Es: Sono un consulente finanziario specializzato in pianificazione patrimoniale per famiglie. I miei clienti sono principalmente professionisti con redditi medio-alti che vogliono ottimizzare risparmi e investimenti..."
                      value={customBusinessContext || customJourneyData?.businessContext || ""}
                      onChange={(e) => setCustomBusinessContext(e.target.value)}
                      rows={4}
                      className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-cyan-400"
                    />
                    <p className="text-xs text-slate-500">
                      L'AI userà questa descrizione per personalizzare tutti i 31 template email
                    </p>
                  </div>

                  <Button
                    onClick={() => generateCustomTemplatesMutation.mutate(customBusinessContext || customJourneyData?.businessContext || "")}
                    disabled={generateCustomTemplatesMutation.isPending || !(customBusinessContext || customJourneyData?.businessContext)?.trim()}
                    className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
                  >
                    {generateCustomTemplatesMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generazione in corso (~30 secondi)...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Genera Template Personalizzati
                      </>
                    )}
                  </Button>

                  {(customGenerationSuccess || customJourneyData?.hasCustomTemplates) && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {customGenerationSuccess 
                            ? `${customGenerationSuccess.count} template generati con successo!`
                            : customJourneyData?.lastGeneratedAt 
                              ? `Generati il: ${new Date(customJourneyData.lastGeneratedAt).toLocaleString("it-IT")}`
                              : "Template personalizzati disponibili"
                          }
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="space-y-0.5">
                      <Label htmlFor="useCustomTemplates" className="text-slate-700 dark:text-slate-300 font-medium">
                        Usa Template Personalizzati
                      </Label>
                      <p className="text-xs text-slate-500">
                        Attiva per usare i template personalizzati invece dei default
                      </p>
                    </div>
                    <Switch
                      id="useCustomTemplates"
                      checked={customJourneyData?.useCustomTemplates ?? false}
                      onCheckedChange={(checked) => updateCustomSettingsMutation.mutate({ useCustomTemplates: checked })}
                      disabled={updateCustomSettingsMutation.isPending || !customJourneyData?.hasCustomTemplates}
                      className="data-[state=checked]:bg-cyan-500"
                    />
                  </div>

                  {customJourneyData?.hasCustomTemplates && !customJourneyData?.hasSmtpSettings && (
                    <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        <strong>Attenzione:</strong> Le impostazioni SMTP non sono configurate. 
                        I template personalizzati sono pronti ma le email non potranno essere inviate 
                        finché non configuri il server SMTP nella sezione "Email Automation".
                      </AlertDescription>
                    </Alert>
                  )}

                  {customJourneyData?.hasCustomTemplates && (
                    <Button
                      variant="outline"
                      onClick={() => resetCustomTemplatesMutation.mutate()}
                      disabled={resetCustomTemplatesMutation.isPending}
                      className="w-full border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {resetCustomTemplatesMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      Ripristina Template Default
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    Template Journey Email (31 Giorni)
                    {customJourneyData?.isCustom && (
                      <Badge className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white ml-2">Personalizzati</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    {customJourneyData?.isCustom 
                      ? "Template personalizzati per il tuo business - clicca su ogni giorno per vedere il prompt"
                      : "Prompt AI reali utilizzati per generare le email giorno per giorno nel journey mensile"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const displayTemplates = customJourneyData?.isCustom && customJourneyData.templates?.length > 0 
                      ? customJourneyData.templates 
                      : journeyTemplates;
                    const isLoading = templatesLoading || customJourneyLoading;
                    
                    if (isLoading) {
                      return (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                        </div>
                      );
                    }
                    
                    if (displayTemplates.length === 0) {
                      return (
                        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                          <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">Nessun template trovato</p>
                          <p className="text-sm text-slate-500 mt-2">
                            Esegui lo script di seeding per creare i template journey
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <>
                        <div className={`mb-4 p-4 border rounded-lg ${customJourneyData?.isCustom ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800'}`}>
                          <div className="flex items-start gap-3">
                            <Sparkles className={`h-5 w-5 mt-0.5 ${customJourneyData?.isCustom ? 'text-emerald-600' : 'text-cyan-600'}`} />
                            <div className={`text-sm ${customJourneyData?.isCustom ? 'text-emerald-700 dark:text-emerald-300' : 'text-cyan-700 dark:text-cyan-300'}`}>
                              <p className="font-semibold mb-1">
                                {customJourneyData?.isCustom ? 'Template Personalizzati Attivi' : 'Sistema Email Journey Attivo'}
                              </p>
                              <p>Il sistema utilizza <strong>{displayTemplates.length} template specifici</strong> {customJourneyData?.isCustom ? 'personalizzati per il tuo business' : '(28 standard + 3 extra per mesi lunghi)'}. Clicca su ogni giorno per vedere il prompt completo.</p>
                            </div>
                          </div>
                        </div>

                        <Accordion type="single" collapsible className="w-full">
                          {displayTemplates.sort((a, b) => a.dayOfMonth - b.dayOfMonth).map((template) => {
                          const isExtraDay = template.dayOfMonth > 28;
                          let badgeClass = '';

                          if (template.dayOfMonth === 29) {
                            badgeClass = 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700';
                          } else if (template.dayOfMonth === 30) {
                            badgeClass = 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700';
                          } else if (template.dayOfMonth === 31) {
                            badgeClass = 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';
                          }

                          return (
                            <AccordionItem key={template.id} value={template.id}>
                              <AccordionTrigger className="hover:bg-slate-50 px-4 rounded-lg">
                                <div className="flex items-center gap-3 w-full">
                                  <Badge variant="outline" className={`font-bold ${badgeClass}`}>
                                    Giorno {template.dayOfMonth}
                                  </Badge>
                                  {isExtraDay && (
                                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs border-0">Extra</Badge>
                                  )}
                                  <span className="font-semibold text-left flex-1">{template.title}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {template.emailType}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {template.tone}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-4 pt-4">
                                <div className="space-y-4">
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">Priorità: {template.priority}/10</Badge>
                                    <Badge variant={template.isActive ? "default" : "secondary"}>
                                      {template.isActive ? "✓ Attivo" : "Disattivo"}
                                    </Badge>
                                  </div>

                                  <div>
                                    <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Descrizione:</h4>
                                    <p className="text-sm">{template.description}</p>
                                  </div>

                                  <div>
                                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                      <Sparkles className="h-4 w-4 text-cyan-600" />
                                      Prompt AI Completo:
                                    </h4>
                                    <Textarea
                                      value={template.promptTemplate}
                                      readOnly
                                      rows={15}
                                      className="font-mono text-xs bg-slate-50 border-slate-300"
                                    />
                                  </div>

                                  {isExtraDay && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                      <div className="flex items-start gap-2">
                                        <Calendar className="h-4 w-4 text-amber-600 mt-0.5" />
                                        <div className="text-xs text-amber-800">
                                          <p className="font-semibold">Template Extra</p>
                                          <p>
                                            Questo template viene utilizzato solo per mesi con{' '}
                                            {template.dayOfMonth === 29 && '29+'}
                                            {template.dayOfMonth === 30 && '30+'}
                                            {template.dayOfMonth === 31 && '31'} giorni
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                        </Accordion>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="clients" className="space-y-6">
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    Gestione Automation Clienti
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Monitora lo stato delle email automatiche per ogni cliente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {clientStatusLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                    </div>
                  ) : !clientAutomationStatus?.clients || clientAutomationStatus.clients.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">Nessun cliente trovato</p>
                      <p className="text-sm text-slate-500 mt-2">
                        Aggiungi clienti per iniziare a usare l'automation
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clientAutomationStatus.clients.map((client) => {
                        const isActive = automationEnabled && client.automationEnabled;

                        return (
                          <div
                            key={client.id}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              isActive 
                                ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <p className="font-semibold text-lg">{client.name}</p>
                                    <p className="text-sm text-muted-foreground">{client.email}</p>
                                  </div>
                                  <Switch
                                    checked={client.automationEnabled}
                                    onCheckedChange={(checked) => {
                                      toggleClientAutomationMutation.mutate({
                                        clientId: client.id,
                                        enabled: checked,
                                      });
                                      queryClient.invalidateQueries({ queryKey: ["/api/consultant/client-automation-status"] });
                                    }}
                                    disabled={!automationEnabled || toggleClientAutomationMutation.isPending}
                                  />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-cyan-600" />
                                    <div>
                                      <p className="text-slate-500 dark:text-slate-400">Email inviate</p>
                                      <p className="font-semibold text-slate-700 dark:text-slate-300">{client.emailsSentCount}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle className="h-4 w-4 text-teal-600" />
                                    <div>
                                      <p className="text-slate-500 dark:text-slate-400">Ultima email</p>
                                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                                        {client.lastEmailSentAt 
                                          ? format(new Date(client.lastEmailSentAt), "dd/MM/yyyy", { locale: it })
                                          : "Mai"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4 text-emerald-600" />
                                    <div className="space-y-1">
                                      <p className="text-slate-500 dark:text-slate-400">Prossimo invio</p>
                                      {client.nextEmailDate ? (
                                        <>
                                          {client.daysUntilNext !== null && client.daysUntilNext <= 0 ? (
                                            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">Pronto per invio</Badge>
                                          ) : client.daysUntilNext !== null && client.daysUntilNext > 0 ? (
                                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                                              Tra {client.daysUntilNext} {client.daysUntilNext === 1 ? 'giorno' : 'giorni'}
                                            </Badge>
                                          ) : (
                                            <Badge variant="secondary">In attesa</Badge>
                                          )}
                                          <p className="text-xs text-slate-500">
                                            {format(new Date(client.nextEmailDate), "dd/MM/yyyy", { locale: it })}
                                          </p>
                                        </>
                                      ) : (
                                        <Badge variant="secondary">Mai inviato</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {!automationEnabled && (
                                  <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                                      Automation generale disattivata - tutte le email vanno in bozza
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="journey" className="space-y-6">
              <EmailJourneyTab />
            </TabsContent>

            <TabsContent value="test" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      Test Generazione Email Journey
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Simula l'invio di email per uno specifico giorno del journey (1-31)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="test-client">Seleziona Cliente</Label>
                      <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger id="test-client">
                          <SelectValue placeholder="Scegli un cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client: any) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.firstName} {client.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="test-day" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Giorno del Journey da Testare
                      </Label>
                      <Select 
                        value={selectedTestDay.toString()} 
                        onValueChange={(value) => setSelectedTestDay(parseInt(value))}
                      >
                        <SelectTrigger id="test-day">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                            const template = journeyTemplates.find(t => t.dayOfMonth === day);
                            const isExtra = day > 28;
                            return (
                              <SelectItem key={day} value={day.toString()}>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">Giorno {day}</span>
                                  {isExtra && <Badge className="bg-amber-500 text-xs">Extra</Badge>}
                                  {template && (
                                    <span className="text-xs text-muted-foreground">
                                      - {template.title}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {(() => {
                        const template = journeyTemplates.find(t => t.dayOfMonth === selectedTestDay);
                        if (template) {
                          return (
                            <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Sparkles className="h-4 w-4 text-cyan-600 mt-0.5" />
                                <div className="text-xs text-cyan-700 dark:text-cyan-300">
                                  <p className="font-semibold">Template: {template.title}</p>
                                  <p className="text-slate-500">{template.description}</p>
                                  <div className="flex gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs border-cyan-300 text-cyan-700">{template.emailType}</Badge>
                                    <Badge variant="outline" className="text-xs border-teal-300 text-teal-700">{template.tone}</Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="manual-email">Email destinatario test (opzionale)</Label>
                      <Input
                        id="manual-email"
                        type="email"
                        placeholder="test@esempio.com"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Se vuoi testare con un'email diversa da quella del cliente, inseriscila qui
                      </p>
                    </div>

                    <Button
                      onClick={handleGenerateTest}
                      disabled={!selectedClient || generateTestEmailMutation.isPending}
                      className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
                    >
                      {generateTestEmailMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generazione in corso...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Genera Email di Test
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {selectedClient && (
                  <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg">
                          <Eye className="h-4 w-4 text-white" />
                        </div>
                        Preview Contesto AI
                      </CardTitle>
                      <CardDescription className="text-slate-500 dark:text-slate-400">
                        Dati che verranno utilizzati dall'AI per generare l'email
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {contextLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                        </div>
                      ) : contextPreview ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-slate-50 rounded-lg">
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Stato Cliente
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Nome</p>
                                <p className="font-medium">{contextPreview.clientState.name}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Livello</p>
                                <Badge>{contextPreview.clientState.level}</Badge>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Obiettivi Attivi</p>
                                <p className="font-medium">{contextPreview.clientState.activeGoals}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Esercizi Completati</p>
                                <p className="font-medium">{contextPreview.clientState.completedExercises}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Streak</p>
                                <p className="font-medium">{contextPreview.clientState.streakDays} giorni</p>
                              </div>
                            </div>
                          </div>

                          {contextPreview.recentTasks.length > 0 && (
                            <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-100 dark:border-cyan-800">
                              <h4 className="font-semibold mb-3 text-slate-700 dark:text-slate-300">Task Recenti</h4>
                              <div className="space-y-2">
                                {contextPreview.recentTasks.map((task, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-700 dark:text-slate-300">{task.title}</span>
                                    <Badge variant="outline" className="border-cyan-300 text-cyan-700">{task.status}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {contextPreview.goals.length > 0 && (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                              <h4 className="font-semibold mb-3">Obiettivi</h4>
                              <div className="space-y-3">
                                {contextPreview.goals.map((goal, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                      <span>{goal.title}</span>
                                      <span className="text-muted-foreground">{goal.progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                      <div 
                                        className="bg-emerald-600 h-2 rounded-full transition-all" 
                                        style={{ width: `${goal.progress}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nessun dato disponibile per questo cliente
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="updates" className="space-y-6">
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-rose-500 to-pink-500 rounded-lg">
                      <Megaphone className="h-4 w-4 text-white" />
                    </div>
                    Email Aggiornamenti Sistema
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Invia comunicazioni personalizzate sui nuovi aggiornamenti del sistema a clienti selezionati
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert className="bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800">
                    <Info className="h-4 w-4 text-cyan-600" />
                    <AlertDescription className="text-cyan-800 dark:text-cyan-200">
                      <strong>Come funziona:</strong> Inserisci il prompt AI e il contenuto degli aggiornamenti. 
                      L'AI genererà email personalizzate per ogni cliente selezionato considerando il loro contesto specifico.
                      Le email andranno nella tab "Bozze" per la tua approvazione prima dell'invio.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="system-prompt" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        System Prompt AI
                      </Label>

                      {/* Preset Selector */}
                      <Select
                        value={selectedPromptPreset}
                        onValueChange={(value) => {
                          setSelectedPromptPreset(value);
                          const preset = systemPromptPresets.find(p => p.id === value);
                          if (preset) {
                            setUpdatesSystemPrompt(preset.prompt);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                          <SelectValue placeholder="Scegli un preset o personalizza" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[400px]">
                          {systemPromptPresets.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id}>
                              {preset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Textarea
                        id="system-prompt"
                        placeholder="Seleziona un preset sopra oppure scrivi il tuo system prompt personalizzato..."
                        rows={6}
                        className="resize-none"
                        value={updatesSystemPrompt}
                        onChange={(e) => {
                          setUpdatesSystemPrompt(e.target.value);
                          // Se l'utente modifica manualmente, passa a "Personalizzato"
                          if (selectedPromptPreset !== "custom") {
                            setSelectedPromptPreset("custom");
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        {selectedPromptPreset === "custom" 
                          ? "Scrivi il tuo system prompt personalizzato" 
                          : `Preset: ${systemPromptPresets.find(p => p.id === selectedPromptPreset)?.name || ''} - Puoi modificarlo come preferisci`
                        }
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="update-content" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Contenuto Aggiornamenti
                      </Label>
                      <Textarea
                        id="update-content"
                        placeholder="Es: Abbiamo rilasciato nuove funzionalità: &#10;- Nuovo sistema di tracciamento obiettivi&#10;- Dashboard migliorata&#10;- Integrazioni WhatsApp..."
                        rows={8}
                        className="resize-none"
                        value={updatesDescription}
                        onChange={(e) => setUpdatesDescription(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Elenca gli aggiornamenti che vuoi comunicare ai clienti
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4" />
                        Seleziona Clienti Destinatari
                      </Label>
                      <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto bg-slate-50">
                        {clientStatusLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
                          </div>
                        ) : !clientAutomationStatus?.clients || clientAutomationStatus.clients.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Nessun cliente disponibile
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 pb-3 border-b">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (selectedUpdatesClients.length === clientAutomationStatus.clients.length) {
                                    setSelectedUpdatesClients([]);
                                  } else {
                                    setSelectedUpdatesClients(clientAutomationStatus.clients.map((c: any) => c.id));
                                  }
                                }}
                              >
                                {selectedUpdatesClients.length === clientAutomationStatus.clients.length ? (
                                  <>
                                    <X className="h-3 w-3 mr-1" />
                                    Deseleziona Tutti
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Seleziona Tutti
                                  </>
                                )}
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                {selectedUpdatesClients.length} di {clientAutomationStatus.clients.length} selezionati
                              </span>
                            </div>
                            {clientAutomationStatus.clients.map((client: any) => (
                              <div
                                key={client.id}
                                className="flex items-start gap-3 p-3 rounded-lg hover:bg-white transition-colors cursor-pointer"
                                onClick={() => {
                                  setSelectedUpdatesClients(prev => 
                                    prev.includes(client.id) 
                                      ? prev.filter(id => id !== client.id)
                                      : [...prev, client.id]
                                  );
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedUpdatesClients.includes(client.id)}
                                  onChange={() => {}}
                                  className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-600 cursor-pointer accent-cyan-600"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{client.name}</p>
                                    {client.isActive && (
                                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">
                                        Attivo
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{client.email}</p>
                                  {client.emailsSentCount > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {client.emailsSentCount} email inviate
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Seleziona i clienti a cui inviare l'email di aggiornamento
                      </p>
                    </div>

                    <Button
                      onClick={handleGenerateSystemUpdates}
                      className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
                      size="lg"
                      disabled={!updatesSystemPrompt || !updatesDescription || selectedUpdatesClients.length === 0 || generateSystemUpdatesMutation.isPending}
                    >
                      {generateSystemUpdatesMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Generazione in corso...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-5 w-5" />
                          Genera {selectedUpdatesClients.length > 0 ? `${selectedUpdatesClients.length} ` : ''}Bozze Email Aggiornamenti
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Generata dall'AI
            </DialogTitle>
            <DialogDescription>
              Anteprima dell'email generata (non inviata)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div className="text-sm text-emerald-800">
                  <p className="font-semibold mb-1">Email generata con successo</p>
                  <p>Questa è solo un'anteprima. L'email non è stata inviata al cliente.</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border rounded-lg">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap">{generatedEmail}</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDraftPreviewDialog} onOpenChange={setShowDraftPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Anteprima Bozza
            </DialogTitle>
            <DialogDescription>
              Cliente: {selectedDraft?.clientName}
            </DialogDescription>
          </DialogHeader>

          {selectedDraft && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Subject</Label>
                <p className="mt-1 p-3 bg-slate-50 rounded-lg">{selectedDraft.subject}</p>
              </div>

              <div>
                <Label className="text-sm font-semibold">Body</Label>
                <div className="mt-1 p-6 bg-white border rounded-lg">
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selectedDraft.body }} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDraftDialog} onOpenChange={setShowEditDraftDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Modifica Bozza
            </DialogTitle>
            <DialogDescription>
              Cliente: {selectedDraft?.clientName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject</Label>
              <Input
                id="edit-subject"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-body">Body</Label>
              <Textarea
                id="edit-body"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDraftDialog(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleSaveEditDraft}
                disabled={editDraftMutation.isPending}
                className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
              >
                {editDraftMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Salva Modifiche
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConsultantAIAssistant />
    </div>
  );
}