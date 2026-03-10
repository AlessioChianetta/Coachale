import { useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  ArrowRight,
  CalendarDays,
  MousePointer,
  Search,
  Building2,
  Award,
  Star,
  Plus,
  Download,
  Flame,
  Thermometer,
  ClipboardList
} from "lucide-react";
import { useLocation } from "wouter";
import { EmailLogsContent } from "@/pages/consultant-email-logs";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import it from "date-fns/locale/it";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BrandVoiceSection, BrandVoiceData } from "@/components/brand-voice";
import { type MarketResearchData } from "@shared/schema";

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
  sendWindowStart?: string;
  sendWindowEnd?: string;
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
    <div className="space-y-4">
      {/* Intro: Come funziona il Percorso Email */}
      <Card className="border border-indigo-200 dark:border-indigo-700 shadow-sm bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-900/20 dark:to-purple-900/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg shrink-0 mt-0.5">
              <Route className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 text-sm">Come funziona il Percorso Email Mensile</h3>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                Ogni cliente riceve un ciclo mensile di <strong>31 email personalizzate</strong>, una per ogni giorno del mese. L'AI genera il contenuto 
                in base al template del giorno, al progresso del cliente e al contesto della sua attività. Ogni email include <strong>azioni suggerite</strong> 
                che vengono tracciate automaticamente. Il percorso si ripete ogni mese con contenuti sempre nuovi.
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-indigo-600 dark:text-indigo-400">
                <span className="flex items-center gap-1"><Target className="h-3 w-3" /> 31 template unici per mese</span>
                <span className="flex items-center gap-1"><Brain className="h-3 w-3" /> Contenuti generati dall'AI</span>
                <span className="flex items-center gap-1"><ListTodo className="h-3 w-3" /> Azioni tracciate automaticamente</span>
              </div>
              <div className="flex flex-wrap gap-3 pt-1 text-xs text-indigo-600/80 dark:text-indigo-400/80 border-t border-indigo-200/50 dark:border-indigo-700/50 mt-1">
                <span className="flex items-center gap-1"><Megaphone className="h-3 w-3" /> Si integra con il sistema Annunci per campagne coordinate</span>
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Connesso a Lead 365 per il nurturing a lungo termine</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compact Explainer Pills */}
      <div className="grid gap-2 md:grid-cols-4">
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
          <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <div className="text-xs font-medium text-blue-900 dark:text-blue-100">Template</div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400">31 template, uno per giorno</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
          <Route className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <div className="text-xs font-medium text-blue-900 dark:text-blue-100">Ciclo Mensile</div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400">Si adatta alla durata del mese</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20">
          <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-medium text-emerald-900 dark:text-emerald-100">Giorno Corrente</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Posizione nel mese attuale</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20">
          <ListTodo className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-medium text-emerald-900 dark:text-emerald-100">Azioni AI</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Tracciate per ogni cliente</div>
          </div>
        </div>
      </div>

      {/* Inline Statistics + Journey Overview */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Statistics - compact inline */}
        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm">
          <CardContent className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Statistiche</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-2 rounded-md bg-cyan-50/50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-cyan-600" />
                  <span className="text-xs text-cyan-700 dark:text-cyan-300">Totali</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">Attivi</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{stats.active}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-teal-50/50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-teal-600" />
                  <span className="text-xs text-teal-700 dark:text-teal-300">Completate</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{stats.allActionsCompleted}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-amber-50/50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs text-amber-700 dark:text-amber-300">Attenzione</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{stats.needsAttention}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Journey Overview - compact phases */}
        {allProgress && allProgress.length > 0 && (
          <Card className="border border-slate-200 dark:border-slate-700 shadow-sm">
            <CardContent className="p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Distribuzione Fasi</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
                  <div className="text-lg font-bold text-green-900 dark:text-green-100">{journeyPhases.early}</div>
                  <div className="text-[10px] font-medium text-green-700 dark:text-green-300">Inizio (1-10)</div>
                  <div className="text-[10px] text-green-600 dark:text-green-400">Introduttive</div>
                </div>
                <div className="rounded-md p-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 text-center">
                  <div className="text-lg font-bold text-cyan-900 dark:text-cyan-100">{journeyPhases.mid}</div>
                  <div className="text-[10px] font-medium text-cyan-700 dark:text-cyan-300">Metà (11-20)</div>
                  <div className="text-[10px] text-cyan-600 dark:text-cyan-400">Riflessione</div>
                </div>
                <div className="rounded-md p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-center">
                  <div className="text-lg font-bold text-orange-900 dark:text-orange-100">{journeyPhases.late}</div>
                  <div className="text-[10px] font-medium text-orange-700 dark:text-orange-300">Fine (21-31)</div>
                  <div className="text-[10px] text-orange-600 dark:text-orange-400">Azione</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>


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
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
    const [pageView, setPageView] = useState<"config" | "logs">("config");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [mainTab, setMainTab] = useState<"dashboard" | "echo">("dashboard");
    const [dashboardSubTab, setDashboardSubTab] = useState<string>("bozze");
    const [echoSubTab, setEchoSubTab] = useState<string>("riepilogo");
    const [memoryClientId, setMemoryClientId] = useState<string>("");
    const [memoryText, setMemoryText] = useState("");
    const [memoryDate, setMemoryDate] = useState("");
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
  const [sendWindowStart, setSendWindowStart] = useState("13:00");
  const [sendWindowEnd, setSendWindowEnd] = useState("14:00");
  const [selectedUpdatesClients, setSelectedUpdatesClients] = useState<string[]>([]);
  const [updatesSystemPrompt, setUpdatesSystemPrompt] = useState("");
  const [updatesDescription, setUpdatesDescription] = useState("");
  const [journeyTemplatePage, setJourneyTemplatePage] = useState(1);
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
      setSendWindowStart(data.sendWindowStart || "13:00");
      setSendWindowEnd(data.sendWindowEnd || "14:00");
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
  
  // Nurturing 365 State
  const [businessDescription, setBusinessDescription] = useState("");
  const [referenceEmail, setReferenceEmail] = useState("");
  const [preferredTone, setPreferredTone] = useState<"professionale" | "amichevole" | "motivazionale">("professionale");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 365, percent: 0 });
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [templatePage, setTemplatePage] = useState(1);
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<{ subject: string; body: string; category: string; dayNumber: number } | null>(null);
  const [showPreviewConfirmDialog, setShowPreviewConfirmDialog] = useState(false);
  const [showBrandVoiceWarningDialog, setShowBrandVoiceWarningDialog] = useState(false);
  const [showWeekGenerationUI, setShowWeekGenerationUI] = useState(false);
  const [generatedWeekTemplates, setGeneratedWeekTemplates] = useState<{ dayNumber: number; subject: string; body: string; category: string }[]>([]);
  const [isGeneratingWeek, setIsGeneratingWeek] = useState(false);
  const [weekGenerationErrors, setWeekGenerationErrors] = useState<string[]>([]);
    const [nurturingSubTab, setNurturingSubTab] = useState<string>("dashboard");
  
  // Template selection and bulk action states
  const [selectedTemplateDays, setSelectedTemplateDays] = useState<number[]>([]);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);
  const [showRegenerateSelectedConfirm, setShowRegenerateSelectedConfirm] = useState(false);
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  const [isDeletingTemplates, setIsDeletingTemplates] = useState(false);
  const [isRegeneratingTemplates, setIsRegeneratingTemplates] = useState(false);
  
  // Brand Voice states per Nurturing
  const [brandVoiceData, setBrandVoiceData] = useState<{
    consultantDisplayName?: string;
    businessName?: string;
    businessDescription?: string;
    consultantBio?: string;
    vision?: string;
    mission?: string;
    values?: string[];
    usp?: string;
    whoWeHelp?: string;
    whoWeDontHelp?: string;
    audienceSegments?: { name: string; description: string }[];
    whatWeDo?: string;
    howWeDoIt?: string;
    yearsExperience?: number;
    clientsHelped?: number;
    resultsGenerated?: string;
    softwareCreated?: { emoji: string; name: string; description: string }[];
    booksPublished?: { title: string; year: string }[];
    caseStudies?: { client: string; result: string }[];
    servicesOffered?: { name: string; price: string; description: string }[];
    guarantees?: string;
    personalTone?: string;
    contentPersonality?: string;
    audienceLanguage?: string;
    avoidPatterns?: string;
    writingExamples?: string[];
    signaturePhrases?: string[];
  }>({});
  const [importedMarketResearchData, setImportedMarketResearchData] = useState<MarketResearchData | null>(null);
  // Collapsible states for Knowledge Base
  const [nurturingKBOpen, setNurturingKBOpen] = useState(false);
  
  // Nurturing KB states
  const [uploadingNurturingKB, setUploadingNurturingKB] = useState(false);
  const [nurturingKBImportOpen, setNurturingKBImportOpen] = useState(false);
  const [selectedKBDocsForNurturing, setSelectedKBDocsForNurturing] = useState<string[]>([]);
  
  // Topics Outline states (365 argomenti)
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [outlineProgress, setOutlineProgress] = useState(0);
  const outlinePollingRef = useRef<NodeJS.Timeout | null>(null);
  const [editingTopic, setEditingTopic] = useState<any>(null);
  const [localBusinessDesc, setLocalBusinessDesc] = useState("");
  const [localTargetAudience, setLocalTargetAudience] = useState("");
  const [localTone, setLocalTone] = useState<"professionale" | "amichevole" | "motivazionale">("professionale");
  const [localReferenceEmail, setLocalReferenceEmail] = useState("");
  const [topicsPage, setTopicsPage] = useState(1);
  const topicsPerPage = 30;
  
  // Import dialog
  const [showImportAgentDialog, setShowImportAgentDialog] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isImportingBrandVoice, setIsImportingBrandVoice] = useState(false);
  
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

  // Nurturing 365 Queries
  const { data: nurturingConfig, isLoading: nurturingConfigLoading } = useQuery({
    queryKey: ["/api/lead-nurturing/config"],
    queryFn: async () => {
      const res = await fetch("/api/lead-nurturing/config", { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: nurturingVariables } = useQuery({
    queryKey: ["/api/lead-nurturing/variables"],
    queryFn: async () => {
      const res = await fetch("/api/lead-nurturing/variables", { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: generationStatus, refetch: refetchGenerationStatus } = useQuery<{
    success: boolean;
    totalGenerated: number;
    nextDay: number;
    isComplete: boolean;
    lastGeneratedDay: number;
  }>({
    queryKey: ["/api/lead-nurturing/generation-status"],
    queryFn: async () => {
      const res = await fetch("/api/lead-nurturing/generation-status", { headers: getAuthHeaders() });
      if (!res.ok) return { success: false, totalGenerated: 0, nextDay: 1, isComplete: false, lastGeneratedDay: 0 };
      return res.json();
    },
    enabled: showWeekGenerationUI || showPreviewConfirmDialog || isGeneratingWeek,
    refetchInterval: isGeneratingWeek ? 2000 : false, // Poll every 2 seconds while generating
  });

  const { data: nurturingTemplatesData, isLoading: nurturingTemplatesLoading } = useQuery<{
    success: boolean;
    templates: any[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>({
    queryKey: ["/api/lead-nurturing/templates", templatePage, templateCategory, templateSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: templatePage.toString(),
        limit: "31",
      });
      if (templateCategory !== "all") params.set("category", templateCategory);
      if (templateSearch.trim()) params.set("search", templateSearch.trim());
      const res = await fetch(`/api/lead-nurturing/templates?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) return { success: false, templates: [], pagination: { page: 1, limit: 31, total: 0, pages: 0 } };
      return res.json();
    },
    enabled: !!nurturingConfig?.config?.templatesGenerated,
  });

  const { data: nurturingAnalytics } = useQuery({
    queryKey: ["/api/lead-nurturing/analytics"],
    queryFn: async () => {
      const res = await fetch("/api/lead-nurturing/analytics", { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: emailAccountsData } = useQuery({
    queryKey: ["/api/email-hub/accounts"],
    queryFn: async () => {
      const res = await fetch("/api/email-hub/accounts", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.accounts)) return data.accounts;
      return [];
    },
  });

  const { data: nurturingLeadsData, isLoading: nurturingLeadsLoading } = useQuery({
    queryKey: ["/api/lead-nurturing/leads"],
    queryFn: async () => {
      const res = await fetch("/api/lead-nurturing/leads", { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const [nurturingLogsPage, setNurturingLogsPage] = useState(1);
  const { data: nurturingLogsData, isLoading: nurturingLogsLoading } = useQuery({
    queryKey: ["/api/lead-nurturing/logs", nurturingLogsPage],
    queryFn: async () => {
      const res = await fetch(`/api/lead-nurturing/logs?page=${nurturingLogsPage}&limit=30`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: nurturingKBItems, isLoading: nurturingKBLoading } = useQuery<{ success: boolean; data: any[]; count: number }>({
    queryKey: ["/api/lead-nurturing/knowledge"],
    queryFn: async () => {
      const res = await fetch("/api/lead-nurturing/knowledge", { headers: getAuthHeaders() });
      if (!res.ok) return { success: false, data: [], count: 0 };
      return res.json();
    },
  });

  const { data: nurturingKBCandidates } = useQuery<{ success: boolean; data: any[]; count: number }>({
    queryKey: ["/api/lead-nurturing/knowledge/import-candidates"],
    queryFn: async () => {
      const res = await fetch("/api/lead-nurturing/knowledge/import-candidates", { headers: getAuthHeaders() });
      if (!res.ok) return { success: false, data: [], count: 0 };
      return res.json();
    },
    enabled: nurturingKBImportOpen,
  });

  // Topics Outline Query (365 argomenti)
  const { data: nurturingTopics, refetch: refetchTopics, isLoading: topicsLoading } = useQuery<{ success: boolean; topics: any[]; count: number }>({
    queryKey: ["/api/lead-nurturing/topics"],
    queryFn: async () => {
      const res = await fetch("/api/lead-nurturing/topics", { headers: getAuthHeaders() });
      if (!res.ok) return { success: false, topics: [], count: 0 };
      return res.json();
    },
    enabled: !!nurturingConfig?.config,
  });

  // Initialize local state from nurturing config
  useEffect(() => {
    if (nurturingConfig?.config) {
      if (nurturingConfig.config.businessDescription && !localBusinessDesc) {
        setLocalBusinessDesc(nurturingConfig.config.businessDescription);
      }
      if (nurturingConfig.config.targetAudience && !localTargetAudience) {
        setLocalTargetAudience(nurturingConfig.config.targetAudience);
      }
      if (nurturingConfig.config.preferredTone && localTone === "professionale") {
        setLocalTone(nurturingConfig.config.preferredTone);
      }
      if (nurturingConfig.config.referenceEmail && !localReferenceEmail) {
        setLocalReferenceEmail(nurturingConfig.config.referenceEmail);
      }
    }
  }, [nurturingConfig]);

  // Save Nurturing Config Mutation
  const saveNurturingConfigMutation = useMutation({
    mutationFn: async (data: { businessDescription: string; targetAudience: string; preferredTone: string; referenceEmail?: string }) => {
      const res = await fetch("/api/lead-nurturing/save-config", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore salvataggio configurazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/config"] });
      toast({ title: "Configurazione salvata!", description: "Le impostazioni sono state aggiornate con successo" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Update Topic Mutation
  const updateTopicMutation = useMutation({
    mutationFn: async (data: { id: string; title: string; description: string }) => {
      const res = await fetch(`/api/lead-nurturing/topics/${data.id}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title, description: data.description }),
      });
      if (!res.ok) throw new Error("Errore modifica argomento");
      return res.json();
    },
    onSuccess: () => {
      refetchTopics();
      setEditingTopic(null);
      toast({ title: "Argomento aggiornato!" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (outlinePollingRef.current) {
        clearInterval(outlinePollingRef.current);
        outlinePollingRef.current = null;
      }
    };
  }, []);

  // Generate Outline with Polling
  const handleGenerateOutline = async () => {
    // Clear any existing polling
    if (outlinePollingRef.current) {
      clearInterval(outlinePollingRef.current);
      outlinePollingRef.current = null;
    }
    
    setGeneratingOutline(true);
    setOutlineProgress(0);
    
    try {
      // Avvia la generazione in background
      const res = await fetch("/api/lead-nurturing/generate-outline", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore generazione outline");
      }
      
      // Inizia polling per il progresso
      outlinePollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/lead-nurturing/topics-generation-status", {
            headers: getAuthHeaders(),
          });
          
          if (!statusRes.ok) {
            if (outlinePollingRef.current) {
              clearInterval(outlinePollingRef.current);
              outlinePollingRef.current = null;
            }
            setGeneratingOutline(false);
            return;
          }
          
          const statusData = await statusRes.json();
          
          if (statusData.success) {
            // Aggiorna progresso (0-100%)
            const percent = (statusData.progress / statusData.total) * 100;
            setOutlineProgress(percent);
            
            if (statusData.status === "completed") {
              if (outlinePollingRef.current) {
                clearInterval(outlinePollingRef.current);
                outlinePollingRef.current = null;
              }
              setGeneratingOutline(false);
              setOutlineProgress(100);
              toast({ title: "Outline generato!", description: "365 argomenti creati con successo" });
              refetchTopics();
            } else if (statusData.status === "error") {
              if (outlinePollingRef.current) {
                clearInterval(outlinePollingRef.current);
                outlinePollingRef.current = null;
              }
              setGeneratingOutline(false);
              toast({ 
                title: "Errore generazione", 
                description: statusData.error || "Si è verificato un errore", 
                variant: "destructive" 
              });
            }
          }
        } catch (pollError) {
          console.error("Polling error:", pollError);
        }
      }, 2000); // Poll ogni 2 secondi
      
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      setGeneratingOutline(false);
      setOutlineProgress(0);
    }
  };

  const addNurturingKBMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/lead-nurturing/knowledge", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Errore upload");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/knowledge"] });
      toast({ title: "Documento aggiunto!", description: "Il documento è stato caricato con successo" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const deleteNurturingKBMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lead-nurturing/knowledge/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/knowledge"] });
      toast({ title: "Documento eliminato" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const importNurturingKBMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const res = await fetch("/api/lead-nurturing/knowledge/import", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      });
      if (!res.ok) throw new Error("Errore importazione");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/knowledge/import-candidates"] });
      setNurturingKBImportOpen(false);
      setSelectedKBDocsForNurturing([]);
      toast({ title: "Importazione completata!", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Nurturing 365 Mutations
  const generatePreviewMutation = useMutation({
    mutationFn: async (data: { businessDescription: string; referenceEmail: string; preferredTone: string }) => {
      setIsGeneratingPreview(true);
      const res = await fetch("/api/lead-nurturing/generate-preview", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore generazione preview");
      return res.json();
    },
    onSuccess: (data) => {
      setIsGeneratingPreview(false);
      if (data.success && data.template) {
        setPreviewTemplate(data.template);
        setShowWeekGenerationUI(false);
        setShowPreviewConfirmDialog(true);
      } else {
        toast({ title: "Errore", description: data.error || "Errore generazione", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      setIsGeneratingPreview(false);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const generateRemainingMutation = useMutation({
    mutationFn: async (data: { businessDescription: string; referenceEmail: string; preferredTone: string; previewTemplate: any }) => {
      setIsGenerating(true);
      setShowPreviewConfirmDialog(false);
      setGenerationProgress({ current: 1, total: 365, percent: 0.27 });
      const res = await fetch("/api/lead-nurturing/generate-remaining", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore generazione");
      return res;
    },
    onSuccess: async (res) => {
      const reader = res.body?.getReader();
      if (!reader) {
        setIsGenerating(false);
        toast({ title: "Errore", description: "Impossibile leggere lo stream di risposta", variant: "destructive" });
        return;
      }
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            if (data.progress) {
              setGenerationProgress({
                current: data.progress.current || 1,
                total: 365,
                percent: ((data.progress.current || 1) / 365) * 100
              });
            }
            if (data.completed) {
              setIsGenerating(false);
              setPreviewTemplate(null);
              queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/config"] });
              queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/templates"] });
              toast({ title: "Templates generati!", description: `${data.generated || 365} email create con successo` });
            }
          } catch {}
        }
      }
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const generateWeekMutation = useMutation({
    mutationFn: async (data: { businessDescription: string; referenceEmail: string; preferredTone: string; startDay: number; previewTemplate?: { subject: string; body: string } }) => {
      setIsGeneratingWeek(true);
      setWeekGenerationErrors([]); // Clear previous errors
      const res = await fetch("/api/lead-nurturing/generate-week", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          businessDescription: data.businessDescription,
          targetAudience: "Clienti interessati ai nostri servizi",
          tone: data.preferredTone,
          startDay: data.startDay,
          previewTemplate: data.previewTemplate, // Pass preview template if starting from day 1
        }),
      });
      if (!res.ok) throw new Error("Errore generazione settimana");
      return res.json();
    },
    onSuccess: (data) => {
      setIsGeneratingWeek(false);
      
      // Always update templates if we got any, regardless of errors
      if (data.templates && data.templates.length > 0) {
        setGeneratedWeekTemplates(prev => [...prev, ...(data.templates || [])]);
        refetchGenerationStatus();
        queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/config"] });
        queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/templates"] });
      }
      
      // Track errors for display
      if (data.errors && data.errors.length > 0) {
        setWeekGenerationErrors(data.errors);
        toast({
          title: "Generazione parziale",
          description: `${data.generated || 0} template generati, ma ${data.errors.length} giorni hanno avuto errori`,
          variant: "destructive",
        });
      } else if (data.success) {
        const endDay = Math.min((data.nextDay || 1) - 1, 365);
        toast({
          title: "Settimana generata!",
          description: `${data.generated || 7} template generati (giorni fino al ${endDay})`,
        });
        if (data.isComplete) {
          toast({
            title: "🎉 Generazione completata!",
            description: "Tutti i 365 template sono stati generati con successo!",
          });
        }
      } else {
        toast({ title: "Errore", description: data.error || "Errore nella generazione", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      setIsGeneratingWeek(false);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const generateNurturingTemplatesMutation = useMutation({
    mutationFn: async (data: { businessDescription: string; referenceEmail: string; preferredTone: string }) => {
      setIsGenerating(true);
      setGenerationProgress({ current: 0, total: 365, percent: 0 });
      const res = await fetch("/api/lead-nurturing/generate", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore generazione");
      return res;
    },
    onSuccess: async (res) => {
      const reader = res.body?.getReader();
      if (!reader) {
        setIsGenerating(false);
        toast({ title: "Errore", description: "Impossibile leggere lo stream di risposta", variant: "destructive" });
        return;
      }
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            if (data.progress) setGenerationProgress(data.progress);
            if (data.completed) {
              setIsGenerating(false);
              queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/config"] });
              queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/templates"] });
              toast({ title: "Templates generati!", description: `${data.completed.templatesGenerated} email create con successo` });
            }
          } catch {}
        }
      }
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const updateNurturingVariablesMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/lead-nurturing/variables", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore salvataggio");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/variables"] });
      toast({ title: "Variabili salvate!" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const updateNurturingConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/lead-nurturing/config", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore salvataggio");
      return res.json();
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/lead-nurturing/config"] });
      const previousConfig = queryClient.getQueryData(["/api/lead-nurturing/config"]);
      queryClient.setQueryData(["/api/lead-nurturing/config"], (old: any) => ({
        ...old,
        config: { ...old?.config, ...newData },
      }));
      return { previousConfig };
    },
    onError: (error: any, _newData, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(["/api/lead-nurturing/config"], context.previousConfig);
      }
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/config"] });
    },
    onSuccess: () => {
      toast({ title: "Configurazione salvata!" });
    },
  });

  // Bulk nurturing mutation - enable/disable nurturing for all leads
  const bulkNurturingMutation = useMutation({
    mutationFn: async ({ enable, excludeStatuses }: { enable: boolean; excludeStatuses?: string[] }) => {
      const res = await fetch("/api/proactive-leads/bulk-nurturing", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ enable, excludeStatuses }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore durante l'operazione");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Nurturing aggiornato!", 
        description: data.message 
      });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Manual send now mutation for testing
  const sendNowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/lead-nurturing/send-now", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore durante l'invio");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: data.success ? "Invio completato!" : "Attenzione",
        description: data.message,
        variant: data.sent > 0 ? "default" : "destructive"
      });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Validate emails mutation
  const validateEmailsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/lead-nurturing/validate-emails", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore durante la validazione");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Validazione completata!",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Delete templates mutation
  const deleteTemplatesMutation = useMutation({
    mutationFn: async (params: { days?: number[]; range?: { from: number; to: number }; all?: boolean }) => {
      setIsDeletingTemplates(true);
      const res = await fetch("/api/lead-nurturing/templates", {
        method: "DELETE",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore durante l'eliminazione");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setIsDeletingTemplates(false);
      setSelectedTemplateDays([]);
      setShowDeleteAllConfirm(false);
      setShowDeleteSelectedConfirm(false);
      setRangeFrom("");
      setRangeTo("");
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/generation-status"] });
      toast({ title: "Template eliminati", description: `${data.deletedCount || 0} template eliminati con successo` });
    },
    onError: (error: any) => {
      setIsDeletingTemplates(false);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Regenerate templates mutation
  const regenerateTemplatesMutation = useMutation({
    mutationFn: async (params: { days?: number[]; range?: { from: number; to: number } }) => {
      setIsRegeneratingTemplates(true);
      const res = await fetch("/api/lead-nurturing/templates/regenerate", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          businessDescription: brandVoiceData?.businessDescription || businessDescription || "Servizi di consulenza professionale",
          targetAudience: brandVoiceData?.whoWeHelp || "Clienti interessati ai nostri servizi",
          tone: preferredTone,
          companyName: brandVoiceData?.businessName || nurturingVariables?.variables?.companyName,
          senderName: brandVoiceData?.consultantDisplayName,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore durante la rigenerazione");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setIsRegeneratingTemplates(false);
      setSelectedTemplateDays([]);
      setShowRegenerateSelectedConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/config"] });
      toast({ title: "Template rigenerati", description: `${data.regeneratedCount || 0} template rigenerati con successo` });
    },
    onError: (error: any) => {
      setIsRegeneratingTemplates(false);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Load brand voice data from nurturing config
  useEffect(() => {
    if (nurturingConfig?.config?.brandVoiceData) {
      setBrandVoiceData(nurturingConfig.config.brandVoiceData);
    }
  }, [nurturingConfig]);

  // Brand Voice Mutation
  const updateBrandVoiceMutation = useMutation({
    mutationFn: async (data: typeof brandVoiceData) => {
      const res = await fetch("/api/lead-nurturing/brand-voice", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore salvataggio");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-nurturing/config"] });
      toast({ title: "Brand Voice salvato" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const handleImportFromAgent = async () => {
    if (!selectedAgentId) return;
    setIsImportingBrandVoice(true);
    try {
      const res = await fetch(`/api/whatsapp/agents/${selectedAgentId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento agente");
      const agent = await res.json();
      if (agent) {
        setBrandVoiceData({
          consultantDisplayName: agent.consultantDisplayName,
          businessName: agent.businessName,
          businessDescription: agent.businessDescription,
          consultantBio: agent.consultantBio,
          vision: agent.vision,
          mission: agent.mission,
          values: agent.values,
          usp: agent.usp,
          whoWeHelp: agent.whoWeHelp,
          whoWeDontHelp: agent.whoWeDontHelp,
          audienceSegments: agent.audienceSegments,
          whatWeDo: agent.whatWeDo,
          howWeDoIt: agent.howWeDoIt,
          yearsExperience: agent.yearsExperience,
          clientsHelped: agent.clientsHelped,
          resultsGenerated: agent.resultsGenerated,
          softwareCreated: agent.softwareCreated,
          booksPublished: agent.booksPublished,
          caseStudies: agent.caseStudies,
          servicesOffered: agent.servicesOffered,
          guarantees: agent.guarantees,
          personalTone: agent.personalTone,
          contentPersonality: agent.contentPersonality,
          audienceLanguage: agent.audienceLanguage,
          avoidPatterns: agent.avoidPatterns,
          writingExamples: agent.writingExamples,
          signaturePhrases: agent.signaturePhrases,
        });
        if (agent.marketResearchData) {
          setImportedMarketResearchData(agent.marketResearchData);
        }
        toast({ title: "Dati importati", description: "Brand Voice, Voce & Stile e Ricerca di Mercato importati dall'agente" });
        setShowImportAgentDialog(false);
      }
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsImportingBrandVoice(false);
    }
  };

  const loadAvailableAgents = async () => {
    try {
      const res = await fetch("/api/whatsapp/agent-chat/agents", { headers: getAuthHeaders() });
      if (res.ok) {
        const response = await res.json();
        setAvailableAgents(response.data || []);
      }
    } catch {}
  };

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
    mutationFn: async ({ clientId, enabled, saveAsDraft }: { clientId: string; enabled: boolean; saveAsDraft?: boolean }) => {
      const res = await fetch(`/api/consultant/client-automation/${clientId}/toggle`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled, saveAsDraft }),
      });
      if (!res.ok) throw new Error("Failed to toggle automation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/client-automation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/client-automation-status"] });
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

  const saveClientMemoryMutation = useMutation({
    mutationFn: async ({ clientId, memory, consultationDate }: { clientId: string; memory: string; consultationDate?: string }) => {
      const response = await fetch("/api/consultant/client-memory", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, memory, consultationDate }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Errore nel salvataggio");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Memoria salvata", description: "La nota è stata salvata nel contesto AI del cliente" });
      setMemoryText("");
      setMemoryDate("");
      setMemoryClientId("");
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
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
      sendWindowStart: sendWindowStart,
      sendWindowEnd: sendWindowEnd,
    };
    console.log('💾 [SAVE AUTOMATION] Mutation payload:', payload);
    console.log('💾 [SAVE AUTOMATION] Send window:', sendWindowStart, '-', sendWindowEnd);

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
          <div className="max-w-[1600px] mx-auto">
            {pageView === "logs" ? (
              <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPageView("config")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700"
                  >
                    <Sparkles className="h-4 w-4" />
                    Configurazione
                  </button>
                  <button
                    onClick={() => setPageView("logs")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/25"
                  >
                    <History className="h-4 w-4" />
                    Log Email
                  </button>
                </div>
              </div>
              <EmailLogsContent />
              </>
            ) : (
            <>
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 pb-4 text-white shadow-xl relative overflow-hidden border border-slate-700/50 mb-6">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 right-0 w-56 h-56 bg-violet-500/5 rounded-full blur-3xl"></div>

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl shadow-lg shadow-cyan-500/25">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl md:text-2xl font-bold tracking-tight">Centro Controllo Email Automation</h1>
                      <p className="text-slate-400 text-xs mt-0.5">Gestisci l'intelligenza artificiale e l'automazione delle email</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPageView("logs")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white border border-white/10"
                    >
                      <History className="h-3.5 w-3.5" />
                      Log Email
                    </button>
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white border border-white/10"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Impostazioni
                    </button>
                  </div>
                </div>

                <div className="flex gap-1.5 bg-white/5 border border-white/10 p-1 rounded-lg">
                  <button
                    onClick={() => setMainTab("dashboard")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all duration-200 ${
                      mainTab === "dashboard"
                        ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/25"
                        : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => setMainTab("echo")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all duration-200 ${
                      mainTab === "echo"
                        ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md shadow-violet-500/25"
                        : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Brain className="h-4 w-4" />
                    Echo
                  </button>
                </div>

                {mainTab === "dashboard" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-start gap-2.5 p-3 bg-white/5 rounded-lg border border-white/10 backdrop-blur-sm">
                        <Route className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-white">Email Journey</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Percorso automatico di 31 email personalizzate per ogni cliente.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-3 bg-white/5 rounded-lg border border-white/10 backdrop-blur-sm">
                        <Megaphone className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-white">Annunci</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Comunicazioni personalizzate dall'AI a gruppi di clienti.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-3 bg-white/5 rounded-lg border border-white/10 backdrop-blur-sm">
                        <CalendarDays className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-white">Lead 365</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Nurturing continuo su 365 giorni con argomenti e template.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { id: "bozze", label: "Bozze Email", icon: FileText },
                        { id: "metriche", label: "Metriche", icon: BarChart3 },
                        { id: "annunci", label: "Annunci", icon: Megaphone },
                        { id: "lead365", label: "Lead 365", icon: CalendarDays },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setDashboardSubTab(tab.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                            dashboardSubTab === tab.id
                              ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-sm shadow-cyan-500/25"
                              : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10"
                          }`}
                        >
                          <tab.icon className="h-3 w-3" />
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {mainTab === "echo" && (
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { id: "riepilogo", label: "Riepilogo Consulenze", icon: Mail },
                      { id: "memoria", label: "Inserisci Memoria", icon: Brain },
                      { id: "clienti", label: "Email Clienti", icon: Users },
                      { id: "percorso", label: "Percorso", icon: Route },
                      { id: "simulatore", label: "Simulatore", icon: Zap },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setEchoSubTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                          echoSubTab === tab.id
                            ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-sm shadow-violet-500/25"
                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10"
                        }`}
                      >
                        <tab.icon className="h-3 w-3" />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {mainTab === "dashboard" && (
              <div className="space-y-6">

                {dashboardSubTab === "bozze" && (
                <div className="space-y-6">
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
                </div>
                )}

                {dashboardSubTab === "metriche" && (
                <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg">
                        <Mail className="text-white h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Email Generate</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats?.totalGenerated || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                        <TrendingUp className="text-white h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Success Rate</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats?.successRate || 0}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg">
                        <FileText className="text-white h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Lunghezza Media</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats?.averageLength || 0} <span className="text-xs font-normal text-slate-400">parole</span></p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                        <Brain className="text-white h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">AI Attivo</p>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="text-emerald-500 h-4 w-4" />
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Online</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                    Distribuzione Toni Email
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="space-y-2">
                    {stats && (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-24 shrink-0">Professionale</span>
                          <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-cyan-500 to-teal-500 h-2 rounded-full transition-all" 
                              style={{ width: `${stats.totalGenerated > 0 ? ((stats.toneDistribution?.professionale || 0) / stats.totalGenerated) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-8 text-right">{stats.toneDistribution?.professionale || 0}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-24 shrink-0">Amichevole</span>
                          <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all" 
                              style={{ width: `${stats.totalGenerated > 0 ? ((stats.toneDistribution?.amichevole || 0) / stats.totalGenerated) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-8 text-right">{stats.toneDistribution?.amichevole || 0}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-24 shrink-0">Motivazionale</span>
                          <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full transition-all" 
                              style={{ width: `${stats.totalGenerated > 0 ? ((stats.toneDistribution?.motivazionale || 0) / stats.totalGenerated) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-8 text-right">{stats.toneDistribution?.motivazionale || 0}</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-cyan-400" />
                      <CardTitle className="text-white text-sm">Personalizza Journey Email</CardTitle>
                    </div>
                    {customJourneyData?.useCustomTemplates && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                        Personalizzati Attivi
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="customBusinessContext" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Descrivi la tua attività
                    </Label>
                    <Textarea
                      id="customBusinessContext"
                      placeholder="Es: Sono un consulente finanziario specializzato in pianificazione patrimoniale..."
                      value={customBusinessContext || customJourneyData?.businessContext || ""}
                      onChange={(e) => setCustomBusinessContext(e.target.value)}
                      rows={3}
                      className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-cyan-400 text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => generateCustomTemplatesMutation.mutate(customBusinessContext || customJourneyData?.businessContext || "")}
                      disabled={generateCustomTemplatesMutation.isPending || !(customBusinessContext || customJourneyData?.businessContext)?.trim()}
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 h-9 text-sm"
                      size="sm"
                    >
                      {generateCustomTemplatesMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Generazione...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Genera Template
                        </>
                      )}
                    </Button>
                    {customJourneyData?.hasCustomTemplates && (
                      <Button
                        variant="outline"
                        onClick={() => resetCustomTemplatesMutation.mutate()}
                        disabled={resetCustomTemplatesMutation.isPending}
                        size="sm"
                        className="h-9 text-sm"
                      >
                        {resetCustomTemplatesMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>

                  {(customGenerationSuccess || customJourneyData?.hasCustomTemplates) && (
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">
                          {customGenerationSuccess 
                            ? `${customGenerationSuccess.count} template generati!`
                            : customJourneyData?.lastGeneratedAt 
                              ? `Generati il: ${new Date(customJourneyData.lastGeneratedAt).toLocaleString("it-IT")}`
                              : "Template personalizzati disponibili"
                          }
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700">
                    <div>
                      <Label htmlFor="useCustomTemplates" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                        Usa Template Personalizzati
                      </Label>
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
                    <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 py-2">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                        SMTP non configurato. Configura nella sezione "Email Automation" per inviare.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    Template Journey Email (31 Giorni)
                    {customJourneyData?.isCustom && (
                      <Badge className="bg-cyan-500 text-white text-xs ml-1">Personalizzati</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                    {customJourneyData?.isCustom 
                      ? "Template personalizzati - clicca per vedere il prompt"
                      : "Prompt AI per generare le email giorno per giorno"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  {(() => {
                    const displayTemplates = customJourneyData?.isCustom && customJourneyData.templates?.length > 0 
                      ? customJourneyData.templates 
                      : journeyTemplates;
                    const isLoading = templatesLoading || customJourneyLoading;
                    
                    if (isLoading) {
                      return (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
                        </div>
                      );
                    }
                    
                    if (displayTemplates.length === 0) {
                      return (
                        <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nessun template trovato</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Esegui lo script di seeding per creare i template journey
                          </p>
                        </div>
                      );
                    }

                    const TEMPLATES_PER_PAGE = 10;
                    const sortedTemplates = [...displayTemplates].sort((a, b) => a.dayOfMonth - b.dayOfMonth);
                    const totalPages = Math.ceil(sortedTemplates.length / TEMPLATES_PER_PAGE);
                    const safePage = Math.min(journeyTemplatePage, totalPages || 1);
                    const currentPageTemplates = sortedTemplates.slice(
                      (safePage - 1) * TEMPLATES_PER_PAGE,
                      safePage * TEMPLATES_PER_PAGE
                    );
                    
                    return (
                      <>
                        <div className={`mb-3 p-2.5 border rounded-md text-xs ${customJourneyData?.isCustom ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300'}`}>
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" />
                            <span><strong>{displayTemplates.length} template</strong> {customJourneyData?.isCustom ? 'personalizzati' : '(28 standard + 3 extra)'}. Clicca per vedere il prompt.</span>
                          </div>
                        </div>

                        <Accordion type="single" collapsible className="w-full">
                          {currentPageTemplates.map((template) => {
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
                              <AccordionTrigger className="hover:bg-slate-50 px-3 py-2 rounded-lg text-sm">
                                <div className="flex items-center gap-2 w-full">
                                  <Badge variant="outline" className={`font-bold text-xs ${badgeClass}`}>
                                    G{template.dayOfMonth}
                                  </Badge>
                                  {isExtraDay && (
                                    <Badge className="bg-amber-500 text-white text-[10px] border-0 px-1 py-0">Extra</Badge>
                                  )}
                                  <span className="font-medium text-left flex-1 text-sm truncate">{template.title}</span>
                                  <Badge variant="outline" className="text-[10px] px-1.5">
                                    {template.emailType}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5">
                                    {template.tone}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pt-3">
                                <div className="space-y-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    <Badge variant="outline" className="text-xs">Priorità: {template.priority}/10</Badge>
                                    <Badge variant={template.isActive ? "default" : "secondary"} className="text-xs">
                                      {template.isActive ? "Attivo" : "Disattivo"}
                                    </Badge>
                                  </div>

                                  <div>
                                    <h4 className="font-medium text-xs mb-1 text-muted-foreground">Descrizione:</h4>
                                    <p className="text-xs">{template.description}</p>
                                  </div>

                                  <div>
                                    <h4 className="font-medium text-xs mb-1 flex items-center gap-1.5">
                                      <Sparkles className="h-3 w-3 text-cyan-600" />
                                      Prompt AI:
                                    </h4>
                                    <Textarea
                                      value={template.promptTemplate}
                                      readOnly
                                      rows={10}
                                      className="font-mono text-xs bg-slate-50 border-slate-300"
                                    />
                                  </div>

                                  {isExtraDay && (
                                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-md">
                                      <div className="flex items-center gap-1.5 text-xs text-amber-800">
                                        <Calendar className="h-3 w-3 text-amber-600" />
                                        <span>
                                          Solo per mesi con{' '}
                                          {template.dayOfMonth === 29 && '29+'}
                                          {template.dayOfMonth === 30 && '30+'}
                                          {template.dayOfMonth === 31 && '31'} giorni
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                        </Accordion>

                        {totalPages > 1 && (
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <span className="text-xs text-slate-500">
                              Pagina {safePage} di {totalPages} ({sortedTemplates.length} template)
                            </span>
                            <div className="flex gap-1">
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <Button
                                  key={page}
                                  variant={safePage === page ? "default" : "outline"}
                                  size="sm"
                                  className="h-7 w-7 p-0 text-xs"
                                  onClick={() => setJourneyTemplatePage(page)}
                                >
                                  {page}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
                </div>
                )}

                {dashboardSubTab === "annunci" && (
                <div className="space-y-6">
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
                </div>
                )}

                {dashboardSubTab === "lead365" && (
                <div className="space-y-6">
                {/* Sub-tab Navigation */}
              <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {[
                  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
                  { id: "configurazione", label: "Configurazione", icon: Settings },
                  { id: "argomenti", label: "Argomenti", icon: BookOpen },
                  { id: "templates", label: "Templates", icon: FileText },
                  { id: "variabili", label: "Variabili", icon: Settings },
                  { id: "invio", label: "Invio", icon: Send },
                  { id: "destinatari", label: "Destinatari", icon: Users },
                  { id: "log-email", label: "Log Email", icon: ClipboardList },
                  { id: "guida", label: "Guida", icon: HelpCircle },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setNurturingSubTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      nurturingSubTab === tab.id
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Dashboard Sub-tab */}
              {nurturingSubTab === "dashboard" && (
              <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                        <Send className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {nurturingAnalytics?.totalSent || 0}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Email Inviate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg">
                        <Eye className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {nurturingAnalytics?.openRate ? `${nurturingAnalytics.openRate.toFixed(1)}%` : '0%'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Open Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                        <MousePointer className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {nurturingAnalytics?.clickRate ? `${nurturingAnalytics.clickRate.toFixed(1)}%` : '0%'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Click Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {nurturingAnalytics?.activeLeads || 0}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Lead Attivi</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              </div>
              )}

              {/* Configurazione Sub-tab */}
              {nurturingSubTab === "configurazione" && (
              <div className="space-y-6">
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                      <Settings className="h-4 w-4 text-white" />
                    </div>
                    Configurazione Nurturing
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Imposta i parametri base per la generazione delle email di nurturing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="local-business-desc">Descrizione Business</Label>
                      <Textarea
                        id="local-business-desc"
                        placeholder="Descrivi il tuo business, cosa fai e quali problemi risolvi..."
                        rows={4}
                        value={localBusinessDesc}
                        onChange={(e) => setLocalBusinessDesc(e.target.value)}
                        className="resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="local-target-audience">Target Audience</Label>
                      <Textarea
                        id="local-target-audience"
                        placeholder="Chi sono i tuoi clienti ideali? Quali sono le loro caratteristiche?"
                        rows={4}
                        value={localTargetAudience}
                        onChange={(e) => setLocalTargetAudience(e.target.value)}
                        className="resize-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="local-reference-email">Email di Riferimento (opzionale)</Label>
                    <Textarea
                      id="local-reference-email"
                      placeholder="Incolla un esempio di email che rappresenta il tuo stile comunicativo..."
                      rows={3}
                      value={localReferenceEmail}
                      onChange={(e) => setLocalReferenceEmail(e.target.value)}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Questa email di esempio aiuterà l'AI a replicare il tuo stile di scrittura
                    </p>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="space-y-2 flex-1">
                      <Label htmlFor="local-tone">Tono Preferito</Label>
                      <Select value={localTone} onValueChange={(v: any) => setLocalTone(v)}>
                        <SelectTrigger id="local-tone" className="w-full md:w-64">
                          <SelectValue placeholder="Seleziona tono" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professionale">Professionale</SelectItem>
                          <SelectItem value="amichevole">Amichevole</SelectItem>
                          <SelectItem value="motivazionale">Motivazionale</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => saveNurturingConfigMutation.mutate({
                        businessDescription: localBusinessDesc,
                        targetAudience: localTargetAudience,
                        preferredTone: localTone,
                        referenceEmail: localReferenceEmail,
                      })}
                      disabled={saveNurturingConfigMutation.isPending}
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                    >
                      {saveNurturingConfigMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salva Configurazione
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Voice & Credibilità Section */}
              <BrandVoiceSection
                data={brandVoiceData}
                onDataChange={setBrandVoiceData}
                onSave={() => updateBrandVoiceMutation.mutate(brandVoiceData)}
                isSaving={updateBrandVoiceMutation.isPending}
                showImportButton={true}
                onImportClick={() => {
                  loadAvailableAgents();
                  setShowImportAgentDialog(true);
                }}
                compact={false}
                externalMarketResearchData={importedMarketResearchData}
              />

              {/* Knowledge Base per Nurturing */}
                <Collapsible open={nurturingKBOpen} onOpenChange={setNurturingKBOpen}>
                  <Card className="border-2 border-amber-500/20 shadow-lg">
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="bg-gradient-to-r from-amber-500/5 to-amber-500/10 cursor-pointer hover:from-amber-500/10 hover:to-amber-500/15 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-amber-500" />
                            <CardTitle>Knowledge Base per Nurturing</CardTitle>
                            {nurturingKBItems?.count && nurturingKBItems.count > 0 && (
                              <Badge variant="secondary" className="ml-2">{nurturingKBItems.count}</Badge>
                            )}
                          </div>
                          {nurturingKBOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                        <CardDescription className="text-left">Documenti che l'AI utilizzerà per generare email personalizzate</CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-6 space-y-6">
                        <NurturingKBDropzone 
                          onFilesDropped={async (files) => {
                            for (const file of files) {
                              setUploadingNurturingKB(true);
                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
                              
                              const ext = file.name.split('.').pop()?.toLowerCase();
                              const typeMap: Record<string, string> = { pdf: 'pdf', docx: 'docx', txt: 'txt' };
                              formData.append('type', typeMap[ext || ''] || 'txt');
                              
                              try {
                                await addNurturingKBMutation.mutateAsync(formData);
                              } catch (e) {
                                console.error("Upload failed:", e);
                              }
                            }
                            setUploadingNurturingKB(false);
                          }}
                          isUploading={uploadingNurturingKB}
                        />

                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNurturingKBImportOpen(true)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Importa da Knowledge Base
                          </Button>
                        </div>

                        {nurturingKBLoading ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : nurturingKBItems?.data && nurturingKBItems.data.length > 0 ? (
                          <div className="space-y-2">
                            {nurturingKBItems.data.map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
                                    <FileText className="h-4 w-4 text-amber-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{item.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.type.toUpperCase()} • {item.content?.length > 0 ? `${(item.content.length / 1000).toFixed(1)}k caratteri` : 'Vuoto'}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteNurturingKBMutation.mutate(item.id)}
                                  disabled={deleteNurturingKBMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground text-sm py-4">
                            Nessun documento caricato. L'AI userà solo le informazioni del Brand Voice.
                          </p>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

              {/* Import KB Dialog */}
              <Dialog open={nurturingKBImportOpen} onOpenChange={setNurturingKBImportOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Importa dalla Knowledge Base</DialogTitle>
                    <DialogDescription>
                      Seleziona i documenti da importare dalla tua Knowledge Base principale
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {nurturingKBCandidates?.data && nurturingKBCandidates.data.length > 0 ? (
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {nurturingKBCandidates.data.map((doc: any) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                            onClick={() => {
                              setSelectedKBDocsForNurturing(prev =>
                                prev.includes(doc.id)
                                  ? prev.filter(id => id !== doc.id)
                                  : [...prev, doc.id]
                              );
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedKBDocsForNurturing.includes(doc.id)}
                              onChange={() => {}}
                              className="h-4 w-4 rounded accent-amber-600"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{doc.fileName}</p>
                              <p className="text-xs text-muted-foreground">{doc.fileType}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        Nessun documento disponibile per l'importazione
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setNurturingKBImportOpen(false)}>
                        Annulla
                      </Button>
                      <Button
                        onClick={() => importNurturingKBMutation.mutate(selectedKBDocsForNurturing)}
                        disabled={selectedKBDocsForNurturing.length === 0 || importNurturingKBMutation.isPending}
                      >
                        {importNurturingKBMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Importa ({selectedKBDocsForNurturing.length})
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
              )}

              {/* Argomenti Sub-tab */}
              {nurturingSubTab === "argomenti" && (
              <div className="space-y-6">
              {/* Indice 365 Argomenti Section */}
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg">
                          <BookOpen className="h-4 w-4 text-white" />
                        </div>
                        Indice 365 Argomenti
                        {nurturingTopics?.count && nurturingTopics.count > 0 && (
                          <Badge variant="secondary" className="ml-2">{nurturingTopics.count} argomenti</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-slate-500 dark:text-slate-400 mt-1">
                        Genera gli argomenti per le 365 email annuali. Questi argomenti guideranno la generazione del contenuto.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleGenerateOutline}
                      disabled={generatingOutline}
                      className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
                    >
                      {generatingOutline ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generazione...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          {nurturingTopics?.count && nurturingTopics.count > 0 ? "Rigenera Indice" : "Genera Indice"}
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatingOutline && (
                    <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span>Generazione argomenti in corso...</span>
                        <span className="font-mono">{Math.round((outlineProgress / 100) * 365)} su 365 ({Math.round(outlineProgress)}%)</span>
                      </div>
                      <Progress value={outlineProgress} className="h-2" />
                      <p className="text-xs text-slate-500">
                        L'AI sta creando 365 argomenti unici per il tuo piano di email marketing annuale.
                      </p>
                    </div>
                  )}

                  {topicsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : nurturingTopics?.topics && nurturingTopics.topics.length > 0 ? (
                    <>
                      <Accordion type="multiple" className="space-y-2">
                        {nurturingTopics.topics
                          .slice((topicsPage - 1) * topicsPerPage, topicsPage * topicsPerPage)
                          .map((topic: any) => (
                            <AccordionItem
                              key={topic.id}
                              value={topic.id}
                              className="border rounded-lg px-4 bg-card"
                            >
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-3 text-left">
                                  <Badge variant="outline" className="min-w-[60px] justify-center">
                                    Giorno {topic.day}
                                  </Badge>
                                  <span className="font-medium">{topic.title}</span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-3 pt-2">
                                  <p className="text-sm text-muted-foreground">
                                    {topic.description || "Nessuna descrizione"}
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingTopic({ ...topic })}
                                  >
                                    <Edit className="h-3 w-3 mr-2" />
                                    Modifica
                                  </Button>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                      </Accordion>

                      {nurturingTopics.topics.length > topicsPerPage && (
                        <div className="flex items-center justify-between pt-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTopicsPage(p => Math.max(1, p - 1))}
                            disabled={topicsPage === 1}
                          >
                            Precedente
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Pagina {topicsPage} di {Math.ceil(nurturingTopics.topics.length / topicsPerPage)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTopicsPage(p => Math.min(Math.ceil(nurturingTopics.topics.length / topicsPerPage), p + 1))}
                            disabled={topicsPage === Math.ceil(nurturingTopics.topics.length / topicsPerPage)}
                          >
                            Successivo
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nessun argomento generato.</p>
                      <p className="text-sm mt-1">
                        Clicca "Genera Indice" per creare 365 argomenti per le tue email di nurturing.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Edit Topic Dialog */}
              <Dialog open={!!editingTopic} onOpenChange={(open) => !open && setEditingTopic(null)}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Modifica Argomento - Giorno {editingTopic?.day}</DialogTitle>
                    <DialogDescription>
                      Modifica il titolo e la descrizione dell'argomento per questo giorno.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-topic-title">Titolo</Label>
                      <Input
                        id="edit-topic-title"
                        value={editingTopic?.title || ""}
                        onChange={(e) => setEditingTopic((prev: any) => prev ? { ...prev, title: e.target.value } : null)}
                        placeholder="Titolo dell'argomento"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-topic-desc">Descrizione</Label>
                      <Textarea
                        id="edit-topic-desc"
                        value={editingTopic?.description || ""}
                        onChange={(e) => setEditingTopic((prev: any) => prev ? { ...prev, description: e.target.value } : null)}
                        placeholder="Descrizione dell'argomento..."
                        rows={4}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditingTopic(null)}>
                      Annulla
                    </Button>
                    <Button
                      onClick={() => {
                        if (editingTopic) {
                          updateTopicMutation.mutate({
                            id: editingTopic.id,
                            title: editingTopic.title,
                            description: editingTopic.description,
                          });
                        }
                      }}
                      disabled={updateTopicMutation.isPending}
                    >
                      {updateTopicMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salva Modifiche
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>
              )}

              {/* Templates Sub-tab */}
              {nurturingSubTab === "templates" && (
              <div className="space-y-6">
              {/* Genera Templates Card */}
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    Genera 365 Email Templates
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    L'AI genererà 365 email personalizzate per il tuo business, una per ogni giorno dell'anno
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {nurturingConfig?.config?.templatesGenerated ? (
                    <Alert className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                        <strong>{nurturingConfig.config.templatesCount || 0} templates già generati!</strong> 
                        {nurturingConfig.config.templatesCount < 365 && (
                          <span className="ml-2 text-amber-600">
                            (Mancano {365 - (nurturingConfig.config.templatesCount || 0)} - 
                            <button 
                              onClick={() => {
                                setShowPreviewConfirmDialog(true);
                                setShowWeekGenerationUI(true);
                                refetchGenerationStatus();
                              }}
                              className="underline hover:text-amber-700 ml-1"
                            >
                              continua generazione
                            </button>)
                          </span>
                        )}
                        {' '}Puoi visualizzarli e modificarli nella sezione Templates qui sotto.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {(!nurturingTopics?.count || nurturingTopics.count === 0) ? (
                        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800 dark:text-amber-200">
                            <strong>Prima devi generare l'Indice degli Argomenti.</strong>{' '}
                            Vai alla sezione "Indice 365 Argomenti" qui sopra e clicca su "Genera Indice" per creare gli argomenti delle email.
                          </AlertDescription>
                        </Alert>
                      ) : !nurturingConfig?.config?.businessDescription ? (
                        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800 dark:text-amber-200">
                            <strong>Configura prima il tuo business.</strong>{' '}
                            Compila la sezione "Configurazione Nurturing" qui sopra con la descrizione del tuo business, target audience e tono preferito, poi salva.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
                            <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300">Riepilogo Configurazione</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Business:</span>{' '}
                                <span className="text-slate-900 dark:text-slate-100">
                                  {nurturingConfig.config.businessDescription?.substring(0, 100)}
                                  {(nurturingConfig.config.businessDescription?.length || 0) > 100 && '...'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Tono:</span>{' '}
                                <Badge variant="outline" className="capitalize">
                                  {nurturingConfig.config.preferredTone || 'professionale'}
                                </Badge>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Argomenti:</span>{' '}
                                <Badge variant="secondary">{nurturingTopics?.count || 0} generati</Badge>
                              </div>
                              {nurturingConfig.config.referenceEmail && (
                                <div>
                                  <span className="text-muted-foreground">Email di riferimento:</span>{' '}
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Configurata</Badge>
                                </div>
                              )}
                            </div>
                          </div>

                          {isGenerating && (
                            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                              <div className="flex items-center justify-between text-sm">
                                <span>Generazione in corso...</span>
                                <span className="font-mono">{generationProgress.current}/{generationProgress.total}</span>
                              </div>
                              <Progress value={generationProgress.percent} className="h-2" />
                              <p className="text-xs text-slate-500">
                                Questo processo può richiedere alcuni minuti. Non chiudere questa pagina.
                              </p>
                            </div>
                          )}

                          <Button
                            onClick={() => {
                              const savedBrandVoice = nurturingConfig?.config?.brandVoiceData;
                              const hasBrandVoice = savedBrandVoice && Object.keys(savedBrandVoice).some(key => {
                                const val = (savedBrandVoice as any)[key];
                                return val !== undefined && val !== null && val !== "" && 
                                       !(Array.isArray(val) && val.length === 0);
                              });
                              
                              if (!hasBrandVoice) {
                                setShowBrandVoiceWarningDialog(true);
                              } else {
                                generatePreviewMutation.mutate({
                                  businessDescription: nurturingConfig.config.businessDescription || localBusinessDesc,
                                  referenceEmail: nurturingConfig.config.referenceEmail || localReferenceEmail,
                                  preferredTone: nurturingConfig.config.preferredTone || localTone,
                                });
                              }
                            }}
                            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                            size="lg"
                            disabled={isGenerating || isGeneratingPreview || generatePreviewMutation.isPending}
                          >
                            {isGeneratingPreview ? (
                              <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Generazione anteprima...
                              </>
                            ) : isGenerating ? (
                              <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Generazione in corso...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-5 w-5" />
                                Genera Template di Prova
                              </>
                            )}
                          </Button>
                          <p className="text-xs text-center text-muted-foreground">
                            Prima generiamo 1 email di esempio, poi decidi se continuare con tutte le 365
                          </p>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Templates Card */}
              {nurturingConfig?.config?.templatesGenerated && (
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg">
                        <FileText className="h-4 w-4 text-white" />
                      </div>
                      Templates Email ({nurturingTemplatesData?.pagination?.total || 0} totali)
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Visualizza e modifica i templates generati per ogni giorno dell'anno
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Bulk Actions Bar */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
                      {/* Selection buttons row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const allDays = nurturingTemplatesData?.templates?.map((t: any) => t.dayNumber) || [];
                            if (selectedTemplateDays.length === allDays.length) {
                              setSelectedTemplateDays([]);
                            } else {
                              setSelectedTemplateDays(allDays);
                            }
                          }}
                        >
                          {selectedTemplateDays.length === (nurturingTemplatesData?.templates?.length || 0) && selectedTemplateDays.length > 0
                            ? "Deseleziona tutti"
                            : "Seleziona tutti"}
                        </Button>
                        
                        {selectedTemplateDays.length > 0 && (
                          <Badge variant="secondary" className="py-1">
                            {selectedTemplateDays.length} selezionati
                          </Badge>
                        )}
                        
                        <div className="flex-1" />
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          disabled={selectedTemplateDays.length === 0 || isRegeneratingTemplates}
                          onClick={() => setShowRegenerateSelectedConfirm(true)}
                        >
                          {isRegeneratingTemplates ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          Rigenera selezionati
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                          disabled={selectedTemplateDays.length === 0 || isDeletingTemplates}
                          onClick={() => setShowDeleteSelectedConfirm(true)}
                        >
                          {isDeletingTemplates ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 mr-1" />
                          )}
                          Elimina selezionati
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setShowDeleteAllConfirm(true)}
                          disabled={isDeletingTemplates}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Cancella tutto
                        </Button>
                      </div>
                      
                      {/* Range delete row */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Elimina range:</span>
                        <span className="text-sm">da giorno</span>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          placeholder="1"
                          className="w-20 h-8"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                        />
                        <span className="text-sm">a giorno</span>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          placeholder="365"
                          className="w-20 h-8"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                          disabled={!rangeFrom || !rangeTo || parseInt(rangeFrom) > parseInt(rangeTo) || isDeletingTemplates}
                          onClick={() => {
                            const from = parseInt(rangeFrom);
                            const to = parseInt(rangeTo);
                            if (from && to && from <= to) {
                              deleteTemplatesMutation.mutate({ range: { from, to } });
                            }
                          }}
                        >
                          {isDeletingTemplates ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 mr-1" />
                          )}
                          Elimina range
                        </Button>
                      </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            placeholder="Cerca nei templates..."
                            value={templateSearch}
                            onChange={(e) => setTemplateSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <Select value={templateCategory} onValueChange={setTemplateCategory}>
                        <SelectTrigger className="w-full md:w-48">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutte le categorie</SelectItem>
                          <SelectItem value="valore">Valore</SelectItem>
                          <SelectItem value="engagement">Engagement</SelectItem>
                          <SelectItem value="conversione">Conversione</SelectItem>
                          <SelectItem value="relazione">Relazione</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Templates List */}
                    {nurturingTemplatesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                      </div>
                    ) : (
                      <Accordion type="single" collapsible className="space-y-2">
                        {nurturingTemplatesData?.templates?.map((template: any) => (
                          <AccordionItem 
                            key={template.dayNumber} 
                            value={`day-${template.dayNumber}`}
                            className="border rounded-lg px-4 bg-slate-50 dark:bg-slate-800/50"
                          >
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedTemplateDays.includes(template.dayNumber)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    if (e.target.checked) {
                                      setSelectedTemplateDays(prev => [...prev, template.dayNumber]);
                                    } else {
                                      setSelectedTemplateDays(prev => prev.filter(d => d !== template.dayNumber));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded border-gray-300 text-violet-600 accent-violet-600 cursor-pointer"
                                />
                                <Badge variant="outline" className="bg-white dark:bg-slate-700">
                                  Giorno {template.dayNumber}
                                </Badge>
                                <span className="text-sm font-medium truncate max-w-[300px]">
                                  {template.subject}
                                </span>
                                {template.category && (
                                  <Badge variant="secondary" className="text-xs">
                                    {template.category}
                                  </Badge>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-3 pt-2">
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
                                  <p className="text-sm font-medium mb-1">Oggetto:</p>
                                  <p className="text-sm text-slate-600 dark:text-slate-300">{template.subject}</p>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
                                  <p className="text-sm font-medium mb-1">Corpo:</p>
                                  <div 
                                    className="text-sm text-slate-600 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none max-h-96 overflow-y-auto"
                                    dangerouslySetInnerHTML={{ __html: template.body || '' }}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm">
                                    <Edit className="h-3 w-3 mr-1" />
                                    Modifica
                                  </Button>
                                  <Button variant="outline" size="sm">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Anteprima
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-amber-600 border-amber-300 hover:bg-amber-50"
                                    disabled={isRegeneratingTemplates}
                                    onClick={() => regenerateTemplatesMutation.mutate({ days: [template.dayNumber] })}
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Rigenera
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                    disabled={isDeletingTemplates}
                                    onClick={() => deleteTemplatesMutation.mutate({ days: [template.dayNumber] })}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Elimina
                                  </Button>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}

                    {/* Pagination */}
                    {nurturingTemplatesData?.pagination && nurturingTemplatesData.pagination.pages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTemplatePage(p => Math.max(1, p - 1))}
                          disabled={templatePage === 1}
                        >
                          Precedente
                        </Button>
                        <span className="text-sm text-slate-500">
                          Pagina {templatePage} di {nurturingTemplatesData.pagination.pages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTemplatePage(p => Math.min(nurturingTemplatesData.pagination.pages, p + 1))}
                          disabled={templatePage === nurturingTemplatesData.pagination.pages}
                        >
                          Successiva
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Delete All Confirmation Dialog */}
              <Dialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      Conferma eliminazione totale
                    </DialogTitle>
                    <DialogDescription>
                      Sei sicuro di voler cancellare tutti i 365 template? Questa azione non può essere annullata.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteAllConfirm(false)}
                      disabled={isDeletingTemplates}
                    >
                      Annulla
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={isDeletingTemplates}
                      onClick={() => deleteTemplatesMutation.mutate({ all: true })}
                    >
                      {isDeletingTemplates ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Eliminazione...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Elimina tutto
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Delete Selected Confirmation Dialog */}
              <Dialog open={showDeleteSelectedConfirm} onOpenChange={setShowDeleteSelectedConfirm}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      Conferma eliminazione
                    </DialogTitle>
                    <DialogDescription>
                      Sei sicuro di voler eliminare {selectedTemplateDays.length} template selezionati? Questa azione non può essere annullata.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteSelectedConfirm(false)}
                      disabled={isDeletingTemplates}
                    >
                      Annulla
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={isDeletingTemplates}
                      onClick={() => deleteTemplatesMutation.mutate({ days: selectedTemplateDays })}
                    >
                      {isDeletingTemplates ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Eliminazione...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Elimina {selectedTemplateDays.length} template
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Regenerate Selected Confirmation Dialog */}
              <Dialog open={showRegenerateSelectedConfirm} onOpenChange={setShowRegenerateSelectedConfirm}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                      <RefreshCw className="h-5 w-5" />
                      Conferma rigenerazione
                    </DialogTitle>
                    <DialogDescription>
                      Sei sicuro di voler rigenerare {selectedTemplateDays.length} template selezionati? I template esistenti verranno sovrascritti con nuovi contenuti generati dall'AI.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowRegenerateSelectedConfirm(false)}
                      disabled={isRegeneratingTemplates}
                    >
                      Annulla
                    </Button>
                    <Button
                      className="bg-amber-600 hover:bg-amber-700"
                      disabled={isRegeneratingTemplates}
                      onClick={() => regenerateTemplatesMutation.mutate({ days: selectedTemplateDays })}
                    >
                      {isRegeneratingTemplates ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Rigenerazione...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Rigenera {selectedTemplateDays.length} template
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              </div>
              )}

              {/* Variabili Sub-tab */}
              {nurturingSubTab === "variabili" && (
              <div className="space-y-6">
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg">
                      <Settings className="h-4 w-4 text-white" />
                    </div>
                    Variabili Email
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Configura le variabili che verranno inserite automaticamente nelle email
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="var-business-name">Nome Business</Label>
                      <Input
                        id="var-business-name"
                        placeholder="Es: Coaching Academy"
                        defaultValue={nurturingVariables?.variables?.businessName || ""}
                        onChange={(e) => {
                          const newVars = { ...nurturingVariables?.variables, businessName: e.target.value };
                          updateNurturingVariablesMutation.mutate(newVars);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="var-calendar-link">Link Calendario</Label>
                      <Input
                        id="var-calendar-link"
                        placeholder="https://calendly.com/tuo-link"
                        defaultValue={nurturingVariables?.variables?.calendarLink || ""}
                        onChange={(e) => {
                          const newVars = { ...nurturingVariables?.variables, calendarLink: e.target.value };
                          updateNurturingVariablesMutation.mutate(newVars);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="var-whatsapp">Numero WhatsApp</Label>
                      <Input
                        id="var-whatsapp"
                        placeholder="+39 123 456 7890"
                        defaultValue={nurturingVariables?.variables?.whatsappNumber || ""}
                        onChange={(e) => {
                          const newVars = { ...nurturingVariables?.variables, whatsappNumber: e.target.value };
                          updateNurturingVariablesMutation.mutate(newVars);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="var-signature">Firma Email</Label>
                      <Textarea
                        id="var-signature"
                        placeholder="La tua firma email..."
                        rows={2}
                        className="resize-none"
                        defaultValue={nurturingVariables?.variables?.emailSignature || ""}
                        onChange={(e) => {
                          const newVars = { ...nurturingVariables?.variables, emailSignature: e.target.value };
                          updateNurturingVariablesMutation.mutate(newVars);
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>
              )}

              {/* Invio Sub-tab */}
              {nurturingSubTab === "invio" && (
              <div className="space-y-4">
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100 text-lg">
                      <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                        <Send className="h-4 w-4 text-white" />
                      </div>
                      Impostazioni Invio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div>
                        <Label htmlFor="nurturing-enabled" className="font-semibold">Nurturing Automatico</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {nurturingConfig?.config?.isEnabled 
                            ? "Attivo — email inviate automaticamente" 
                            : "Disattivato"}
                        </p>
                      </div>
                      <Switch
                        id="nurturing-enabled"
                        checked={nurturingConfig?.config?.isEnabled || false}
                        onCheckedChange={(checked) => {
                          updateNurturingConfigMutation.mutate({ isEnabled: checked });
                        }}
                        disabled={updateNurturingConfigMutation.isPending}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Label className="font-semibold flex items-center gap-1.5 mb-2">
                          <Clock className="h-3.5 w-3.5" /> Orario Invio
                        </Label>
                        <div className="flex gap-2 items-center">
                          <Select
                            value={String(nurturingConfig?.config?.sendHour ?? 9)}
                            onValueChange={(val) => updateNurturingConfigMutation.mutate({ sendHour: parseInt(val) })}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 17 }, (_, i) => i + 6).map(h => (
                                <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-lg font-bold">:</span>
                          <Select
                            value={String(nurturingConfig?.config?.sendMinute ?? 0)}
                            onValueChange={(val) => updateNurturingConfigMutation.mutate({ sendMinute: parseInt(val) })}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 15, 30, 45].map(m => (
                                <SelectItem key={m} value={String(m)}>{String(m).padStart(2, '0')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground ml-1">(Europa/Roma)</span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Label className="font-semibold flex items-center gap-1.5 mb-2">
                          <Mail className="h-3.5 w-3.5" /> Email Inviante
                        </Label>
                        <Select
                          value={nurturingConfig?.config?.senderAccountId || "auto"}
                          onValueChange={(val) => updateNurturingConfigMutation.mutate({ senderAccountId: val === "auto" ? "" : val })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona account..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Automatico (primo account)</SelectItem>
                            {(Array.isArray(emailAccountsData) ? emailAccountsData : []).map((acc: any) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.emailAddress} {acc.displayName ? `(${acc.displayName})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <input
                        type="checkbox"
                        id="skip-weekends"
                        checked={nurturingConfig?.config?.skipWeekends || false}
                        onChange={(e) => updateNurturingConfigMutation.mutate({ skipWeekends: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 accent-emerald-600"
                      />
                      <div>
                        <Label htmlFor="skip-weekends" className="cursor-pointer font-medium">Salta i weekend</Label>
                        <p className="text-xs text-muted-foreground">Non inviare il sabato e la domenica</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700">
                      <div>
                        <Label className="font-semibold text-emerald-800 dark:text-emerald-200">Gestione Lead</Label>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Attiva/disattiva nurturing per tutti i lead con email</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => bulkNurturingMutation.mutate({ enable: true, excludeStatuses: ["inactive"] })}
                          disabled={bulkNurturingMutation.isPending}
                        >
                          {bulkNurturingMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5 mr-1" />}
                          Attiva Tutti
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => bulkNurturingMutation.mutate({ enable: false, excludeStatuses: [] })}
                          disabled={bulkNurturingMutation.isPending}
                        >
                          Disattiva Tutti
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                      <div>
                        <Label className="font-semibold text-blue-800 dark:text-blue-200">Test</Label>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Invia subito o valida le email</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => sendNowMutation.mutate()}
                          disabled={sendNowMutation.isPending}
                        >
                          {sendNowMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                          Invia Ora
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => validateEmailsMutation.mutate()}
                          disabled={validateEmailsMutation.isPending}
                        >
                          {validateEmailsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                          Valida Email
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              )}

              {/* Destinatari Sub-tab */}
              {nurturingSubTab === "destinatari" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{nurturingLeadsData?.summary?.total || 0}</p>
                        <p className="text-xs text-slate-500">Lead Attivi</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-red-200 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg">
                        <Flame className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-red-600 dark:text-red-400">{nurturingLeadsData?.summary?.hot || 0}</p>
                        <p className="text-xs text-red-500">Caldi</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-lg">
                        <Thermometer className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{nurturingLeadsData?.summary?.warm || 0}</p>
                        <p className="text-xs text-amber-500">Tiepidi</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                        <Thermometer className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{nurturingLeadsData?.summary?.cold || 0}</p>
                        <p className="text-xs text-blue-500">Freddi</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100 text-lg">
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      Destinatari Nurturing
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Lead attivi nel nurturing ordinati per engagement (i più caldi in alto)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {nurturingLeadsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                      </div>
                    ) : !nurturingLeadsData?.leads?.length ? (
                      <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">Nessun lead con nurturing attivo</p>
                        <p className="text-sm text-slate-500 mt-2">Attiva il nurturing nella tab Invio per iniziare</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Lead</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead className="text-center">Giorno</TableHead>
                              <TableHead className="text-center">Aperte</TableHead>
                              <TableHead className="text-center">Click</TableHead>
                              <TableHead>Ultima Apertura</TableHead>
                              <TableHead className="text-center">Temperatura</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {nurturingLeadsData.leads.map((lead: any) => (
                              <TableRow key={lead.id}>
                                <TableCell className="font-medium">{lead.firstName} {lead.lastName}</TableCell>
                                <TableCell className="text-sm text-slate-600 dark:text-slate-400 max-w-[200px] truncate">{lead.email}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="font-mono">{lead.currentDay}/365</Badge>
                                </TableCell>
                                <TableCell className="text-center font-medium">{lead.totalOpens}</TableCell>
                                <TableCell className="text-center font-medium">{lead.totalClicks}</TableCell>
                                <TableCell className="text-sm text-slate-500">
                                  {lead.lastOpenedAt ? new Date(lead.lastOpenedAt).toLocaleDateString('it-IT') : '—'}
                                </TableCell>
                                <TableCell className="text-center">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        {lead.warmthLevel === "hot" && (
                                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-700">
                                            <Flame className="h-3 w-3 mr-1" /> Caldo
                                          </Badge>
                                        )}
                                        {lead.warmthLevel === "warm" && (
                                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-700">
                                            <Thermometer className="h-3 w-3 mr-1" /> Tiepido
                                          </Badge>
                                        )}
                                        {lead.warmthLevel === "cold" && (
                                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-700">
                                            <Thermometer className="h-3 w-3 mr-1" /> Freddo
                                          </Badge>
                                        )}
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Punteggio: {lead.warmthScore} (aperture x1 + click x3)</p>
                                        <p className="text-xs text-muted-foreground">Caldo: 10+, Tiepido: 3-9, Freddo: 0-2</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              )}

              {/* Log Email Sub-tab */}
              {nurturingSubTab === "log-email" && (
              <div className="space-y-4">
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100 text-lg">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                        <ClipboardList className="h-4 w-4 text-white" />
                      </div>
                      Log Email Nurturing
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Storico degli invii con stato apertura e click
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {nurturingLogsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                      </div>
                    ) : !nurturingLogsData?.logs?.length ? (
                      <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Mail className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">Nessun log di invio</p>
                        <p className="text-sm text-slate-500 mt-2">I log appariranno qui dopo il primo invio</p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data Invio</TableHead>
                                <TableHead>Lead</TableHead>
                                <TableHead className="text-center">Giorno</TableHead>
                                <TableHead>Oggetto</TableHead>
                                <TableHead className="text-center">Stato</TableHead>
                                <TableHead className="text-center">Aperta</TableHead>
                                <TableHead className="text-center">Click</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {nurturingLogsData.logs.map((log: any) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-sm whitespace-nowrap">
                                    {log.sentAt ? new Date(log.sentAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {log.leadFirstName || ''} {log.leadLastName || ''}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="font-mono text-xs">{log.dayNumber}</Badge>
                                  </TableCell>
                                  <TableCell className="max-w-[250px] truncate text-sm">{log.subjectSent || '—'}</TableCell>
                                  <TableCell className="text-center">
                                    {log.status === 'sent' && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">Inviata</Badge>}
                                    {log.status === 'failed' && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">Fallita</Badge>
                                          </TooltipTrigger>
                                          <TooltipContent><p>{log.errorMessage || 'Errore sconosciuto'}</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    {log.status === 'skipped' && <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-slate-200">Saltata</Badge>}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {log.openedAt ? (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200">
                                              <Eye className="h-3 w-3" />
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent><p>{new Date(log.openedAt).toLocaleString('it-IT')}</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {log.clickedAt ? (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200">
                                              <MousePointer className="h-3 w-3" />
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent><p>{new Date(log.clickedAt).toLocaleString('it-IT')}</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {nurturingLogsData.pagination && nurturingLogsData.pagination.totalPages > 1 && (
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-sm text-slate-500">
                              Pagina {nurturingLogsData.pagination.page} di {nurturingLogsData.pagination.totalPages} ({nurturingLogsData.pagination.total} totali)
                            </p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm"
                                disabled={nurturingLogsPage <= 1}
                                onClick={() => setNurturingLogsPage(p => Math.max(1, p - 1))}
                              >
                                Precedente
                              </Button>
                              <Button variant="outline" size="sm"
                                disabled={nurturingLogsPage >= nurturingLogsData.pagination.totalPages}
                                onClick={() => setNurturingLogsPage(p => p + 1)}
                              >
                                Successiva
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
              )}

              {/* Guida Sub-tab */}
              {nurturingSubTab === "guida" && (
              <div className="space-y-6">
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg">
                        <BookOpen className="h-4 w-4 text-white" />
                      </div>
                      Guida Lead Nurturing 365
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Come configurare e utilizzare il sistema di nurturing automatico per i tuoi lead
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
                      <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">Cos'è Lead 365?</h3>
                      <p className="text-sm text-indigo-700 dark:text-indigo-300">
                        Lead 365 è un sistema di email nurturing automatico che invia un'email personalizzata al giorno ai tuoi lead per 365 giorni. 
                        Ogni email è generata dall'AI in base al tuo business, brand voice e argomenti configurati, mantenendo il lead coinvolto e guidandolo verso la conversione.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">Come iniziare - Step by Step</h3>
                      
                      <div className="space-y-3">
                        <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">1</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">Configura il tuo Business</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Vai nella tab <strong>Configurazione</strong> e compila la descrizione del business, il target audience, il tono preferito e il Brand Voice. Queste informazioni guidano l'AI nella generazione delle email.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">2</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">Genera l'Indice degli Argomenti</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Nella tab <strong>Argomenti</strong>, clicca "Genera Indice" per creare 365 argomenti unici. L'AI creerà un piano editoriale completo per un anno intero di email. Puoi modificare singoli argomenti se necessario.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">3</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">Genera i Template Email</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Nella tab <strong>Templates</strong>, genera i 365 template email. Il sistema genera prima un'anteprima del giorno 1, poi procedi con la generazione settimanale (7 template alla volta). Puoi interrompere e riprendere in qualsiasi momento.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">4</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">Configura le Variabili</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Nella tab <strong>Variabili</strong>, imposta il nome del business, il link al calendario, il numero WhatsApp e la firma email. Queste variabili vengono inserite automaticamente nelle email generate.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">5</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">Attiva l'Invio Automatico</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Nella tab <strong>Invio</strong>, attiva il nurturing automatico, configura le opzioni (salta weekend, ecc.) e attiva il nurturing per i tuoi lead. Puoi anche fare un invio di test prima di attivare il sistema.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">Come funziona il ciclo di 365 email</h3>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                          <div className="flex items-center gap-2 mb-2">
                            <CalendarDays className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-sm text-green-800 dark:text-green-200">Giorno 1-120</span>
                          </div>
                          <p className="text-xs text-green-700 dark:text-green-300">
                            Fase di introduzione e costruzione della fiducia. Email educative, motivazionali e di valore per stabilire la relazione con il lead.
                          </p>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                          <div className="flex items-center gap-2 mb-2">
                            <CalendarDays className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-sm text-blue-800 dark:text-blue-200">Giorno 121-240</span>
                          </div>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Fase di approfondimento e engagement. Email con contenuti avanzati, case study e inviti all'azione per aumentare il coinvolgimento.
                          </p>
                        </div>
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                          <div className="flex items-center gap-2 mb-2">
                            <CalendarDays className="h-4 w-4 text-purple-600" />
                            <span className="font-medium text-sm text-purple-800 dark:text-purple-200">Giorno 241-365</span>
                          </div>
                          <p className="text-xs text-purple-700 dark:text-purple-300">
                            Fase di conversione e fidelizzazione. Email mirate alla conversione, offerte esclusive e consolidamento della relazione a lungo termine.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">Integrazione con il Journey Mensile e gli Annunci</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Route className="h-4 w-4 text-cyan-600" />
                            <span className="font-medium text-sm text-cyan-800 dark:text-cyan-200">Journey Mensile (Clienti)</span>
                          </div>
                          <p className="text-xs text-cyan-700 dark:text-cyan-300">
                            Il Journey Mensile (tab Percorso) gestisce le email per i <strong>clienti attivi</strong> con un ciclo di 31 template al mese. 
                            Lead 365 invece si concentra sui <strong>lead</strong> (potenziali clienti) con un ciclo annuale di 365 email. 
                            I due sistemi lavorano in parallelo su audience diverse.
                          </p>
                        </div>
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Megaphone className="h-4 w-4 text-amber-600" />
                            <span className="font-medium text-sm text-amber-800 dark:text-amber-200">Sistema Annunci</span>
                          </div>
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Il tab Annunci (nella pagina principale) permette di inviare comunicazioni spot a tutti i clienti. 
                            Lead 365 si integra con gli annunci: puoi usare gli annunci per comunicazioni urgenti o promozioni, 
                            mentre Lead 365 mantiene il flusso costante di nurturing quotidiano per i lead.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-slate-500 mt-0.5" />
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Suggerimento</p>
                          <p>
                            Per ottenere i migliori risultati, assicurati di configurare il Brand Voice nella tab Configurazione prima di generare i template. 
                            Un Brand Voice ben definito permette all'AI di generare email coerenti con la tua identità di marca e il tuo stile comunicativo.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              )}

                </div>
                )}
              </div>
              )}

              {mainTab === "echo" && (
              <div className="space-y-6">
                {echoSubTab === "riepilogo" && (
                <div className="space-y-6">
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
                                  className="h-8 w-8 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                                  onClick={() => {
                                    console.log('💾 [SAVE FOR AI] Salvataggio riepilogo per AI');
                                    console.log('💾 [SAVE FOR AI] Draft ID:', draft.id);
                                    console.log('💾 [SAVE FOR AI] Cliente:', draft.clientName);
                                    console.log('💾 [SAVE FOR AI] Consultation ID:', draft.metadata?.consultationId);
                                    saveForAiMutation.mutate(draft.id);
                                  }}
                                  disabled={saveForAiMutation.isPending}
                                  title="Salva per AI"
                                >
                                  <Brain className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
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
                                  title="Invia email"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => deleteConsultationDraftMutation.mutate(draft.id)}
                                  disabled={deleteConsultationDraftMutation.isPending}
                                  title="Elimina"
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
                </div>
                )}

                {echoSubTab === "memoria" && (
                <div className="space-y-6">
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg">
                        <Brain className="h-4 w-4 text-white" />
                      </div>
                      Inserisci Memoria Cliente
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Aggiungi note e memorie come se avessi fatto una consulenza. Verranno salvate nel contesto AI del cliente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <Select value={memoryClientId} onValueChange={setMemoryClientId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona un cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clients?.map((client: any) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.firstName} {client.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Note / Memoria della consulenza</Label>
                      <Textarea
                        placeholder="Scrivi qui le note della consulenza, argomenti discussi, decisioni prese, prossimi passi..."
                        value={memoryText}
                        onChange={(e) => setMemoryText(e.target.value)}
                        rows={6}
                        className="bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Data e ora della consulenza</Label>
                      <Input
                        type="datetime-local"
                        value={memoryDate}
                        onChange={(e) => setMemoryDate(e.target.value)}
                        className="max-w-[280px]"
                      />
                      <p className="text-xs text-muted-foreground">Lascia vuoto per usare la data/ora corrente</p>
                    </div>

                    <Button
                      onClick={() => {
                        if (!memoryClientId || !memoryText.trim()) {
                          toast({ title: "Attenzione", description: "Seleziona un cliente e scrivi almeno una nota", variant: "destructive" });
                          return;
                        }
                        saveClientMemoryMutation.mutate({
                          clientId: memoryClientId,
                          memory: memoryText,
                          consultationDate: memoryDate || undefined,
                        });
                      }}
                      disabled={saveClientMemoryMutation.isPending || !memoryClientId || !memoryText.trim()}
                      className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
                    >
                      {saveClientMemoryMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvataggio...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Salva Memoria
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
                </div>
                )}

                {echoSubTab === "clienti" && (
                <div className="space-y-4">
                {/* Iscritti Attivi al Journey Section */}
              <Card className="border border-emerald-200 dark:border-emerald-700 shadow-sm">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-500 rounded-lg">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <CardTitle className="text-base flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                        Iscritti Attivi al Journey
                        {clientAutomationStatus?.clients && (
                          <Badge className="bg-emerald-500 text-white border-0 text-xs px-1.5 py-0">
                            {clientAutomationStatus.clients.filter(c => c.automationEnabled).length}
                          </Badge>
                        )}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  {clientStatusLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                    </div>
                  ) : (() => {
                    const activeClients = clientAutomationStatus?.clients?.filter(c => c.automationEnabled) || [];
                    
                    if (activeClients.length === 0) {
                      return (
                        <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <Users className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Nessun cliente iscritto</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            Attiva l'automation dalla sezione sottostante
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-8 text-xs">Cliente</TableHead>
                            <TableHead className="h-8 text-xs">Email</TableHead>
                            <TableHead className="h-8 text-xs text-center">Inviate</TableHead>
                            <TableHead className="h-8 text-xs w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeClients.map((client) => (
                            <TableRow key={client.id} className="group">
                              <TableCell className="py-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                    {client.name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                  <span className="font-medium text-sm truncate">{client.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2 text-sm text-muted-foreground truncate max-w-[200px]">{client.email}</TableCell>
                              <TableCell className="py-2 text-center">
                                <Badge variant="secondary" className="text-xs px-1.5 py-0">{client.emailsSentCount}</Badge>
                              </TableCell>
                              <TableCell className="py-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    toggleClientAutomationMutation.mutate({
                                      clientId: client.id,
                                      enabled: false,
                                    });
                                  }}
                                  disabled={toggleClientAutomationMutation.isPending}
                                  className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Gestione Automation Clienti Section */}
              <Card className="border border-slate-200 dark:border-slate-700 shadow-sm">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-600 rounded-lg">
                      <Settings className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base text-slate-900 dark:text-slate-100">Gestione Automation</CardTitle>
                      {clientAutomationStatus?.clients && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          {clientAutomationStatus.clients.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  {clientStatusLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
                    </div>
                  ) : !clientAutomationStatus?.clients || clientAutomationStatus.clients.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Users className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nessun cliente trovato</p>
                      <p className="text-xs text-slate-500 mt-1">Aggiungi clienti per usare l'automation</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {!automationEnabled && (
                        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 py-2 mb-2">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                          <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                            Automation generale disattivata - tutte le email vanno in bozza
                          </AlertDescription>
                        </Alert>
                      )}
                      {clientAutomationStatus.clients.map((client) => {
                        const isActive = automationEnabled && client.automationEnabled;

                        return (
                          <div
                            key={client.id}
                            className={`p-3 rounded-lg border transition-colors ${
                              isActive 
                                ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' 
                                : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{client.name}</p>
                                <span className="text-xs text-muted-foreground truncate hidden sm:inline">{client.email}</span>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3 text-cyan-600" />
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{client.emailsSentCount}</span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3 text-teal-600" />
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                      {client.lastEmailSentAt 
                                        ? format(new Date(client.lastEmailSentAt), "dd/MM", { locale: it })
                                        : "—"}
                                    </span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    {client.nextEmailDate ? (
                                      client.daysUntilNext !== null && client.daysUntilNext <= 0 ? (
                                        <Badge className="bg-emerald-500 text-white border-0 text-[10px] px-1.5 py-0 h-4">Pronto</Badge>
                                      ) : client.daysUntilNext !== null && client.daysUntilNext > 0 ? (
                                        <Badge className="bg-amber-500 text-white border-0 text-[10px] px-1.5 py-0 h-4">
                                          {client.daysUntilNext}g
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Attesa</Badge>
                                      )
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">—</Badge>
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 border-l pl-3 border-slate-200 dark:border-slate-600">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Switch
                                          checked={client.automationEnabled}
                                          onCheckedChange={(checked) => {
                                            toggleClientAutomationMutation.mutate({
                                              clientId: client.id,
                                              enabled: checked,
                                              saveAsDraft: checked ? client.saveAsDraft : false,
                                            });
                                          }}
                                          disabled={toggleClientAutomationMutation.isPending}
                                          className="scale-90"
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent><p>Riceve email</p></TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Switch
                                          checked={client.automationEnabled ? (client.saveAsDraft || false) : false}
                                          onCheckedChange={(checked) => {
                                            toggleClientAutomationMutation.mutate({
                                              clientId: client.id,
                                              enabled: client.automationEnabled,
                                              saveAsDraft: checked,
                                            });
                                          }}
                                          disabled={!client.automationEnabled || toggleClientAutomationMutation.isPending}
                                          className="data-[state=checked]:bg-amber-500 scale-90"
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent><p>{client.automationEnabled ? "Solo bozza" : "Attiva prima 'Riceve email'"}</p></TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
                </div>
                )}

                {echoSubTab === "percorso" && (
                <div className="space-y-6">
                <EmailJourneyTab />
                </div>
                )}

                {echoSubTab === "simulatore" && (
                <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-md shadow-amber-500/20">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                          Test Generazione Email Journey
                        </CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Simula l'invio di email per uno specifico giorno del journey (1-31)
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-1.5">
                      <Label htmlFor="test-client" className="text-sm">Seleziona Cliente</Label>
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

                    <div className="space-y-1.5">
                      <Label htmlFor="test-day" className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
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
                            <div className="p-2.5 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                                <div className="text-xs text-cyan-700 dark:text-cyan-300">
                                  <p className="font-semibold">{template.title}</p>
                                  <p className="text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{template.description}</p>
                                  <div className="flex gap-1.5 mt-1.5">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300">{template.emailType}</Badge>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300">{template.tone}</Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="manual-email" className="text-sm">Email destinatario test (opzionale)</Label>
                      <Input
                        id="manual-email"
                        type="email"
                        placeholder="test@esempio.com"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Inserisci un'email diversa da quella del cliente per il test
                      </p>
                    </div>

                    <Button
                      onClick={handleGenerateTest}
                      disabled={!selectedClient || generateTestEmailMutation.isPending}
                      className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 shadow-md shadow-cyan-500/20"
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

                <Card className={`border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm ${!selectedClient ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl shadow-md shadow-teal-500/20">
                        <Eye className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                          Preview Contesto AI
                        </CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Dati utilizzati dall'AI per generare l'email
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {!selectedClient ? (
                      <div className="text-center py-8 bg-slate-50/80 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full w-fit mx-auto mb-3">
                          <Users className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Seleziona un cliente</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">per visualizzare il contesto AI</p>
                      </div>
                    ) : contextLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
                      </div>
                    ) : contextPreview ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700">
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <Users className="h-3.5 w-3.5" />
                            Stato Cliente
                          </h4>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Nome</span>
                              <span className="text-xs font-medium text-slate-900 dark:text-slate-100">{contextPreview.clientState.name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Livello</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{contextPreview.clientState.level}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Obiettivi</span>
                              <span className="text-xs font-medium text-slate-900 dark:text-slate-100">{contextPreview.clientState.activeGoals}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Esercizi</span>
                              <span className="text-xs font-medium text-slate-900 dark:text-slate-100">{contextPreview.clientState.completedExercises}</span>
                            </div>
                            <div className="flex items-center justify-between col-span-2">
                              <span className="text-xs text-muted-foreground">Streak</span>
                              <span className="text-xs font-medium text-slate-900 dark:text-slate-100">{contextPreview.clientState.streakDays} giorni</span>
                            </div>
                          </div>
                        </div>

                        {contextPreview.recentTasks.length > 0 && (
                          <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-100 dark:border-cyan-800">
                            <h4 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Task Recenti</h4>
                            <div className="space-y-1.5">
                              {contextPreview.recentTasks.map((task, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-slate-700 dark:text-slate-300 truncate mr-2">{task.title}</span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 shrink-0">{task.status}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {contextPreview.goals.length > 0 && (
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                            <h4 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Obiettivi</h4>
                            <div className="space-y-2">
                              {contextPreview.goals.map((goal, idx) => (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-700 dark:text-slate-300 truncate mr-2">{goal.title}</span>
                                    <span className="text-muted-foreground shrink-0">{goal.progress}%</span>
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                    <div 
                                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 rounded-full transition-all" 
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
              </div>
                </div>
                )}
              </div>
              )}
            </div>
            </>
            )}
            </div>
          </div>
        </div>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg">
                  <Settings className="h-4 w-4 text-white" />
                </div>
                Impostazioni Email Automation
              </DialogTitle>
              <DialogDescription>
                Configura SMTP, automazione, frequenza e scheduler
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 pt-2">
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
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Finestra Oraria Invio (ora italiana)</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Le email verranno inviate SOLO in questa fascia oraria. Fuori da questa finestra, il sistema aspetterà.
                    </p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="send-window-start" className="text-sm whitespace-nowrap">Dalle:</Label>
                        <Input
                          id="send-window-start"
                          type="time"
                          value={sendWindowStart}
                          onChange={(e) => setSendWindowStart(e.target.value)}
                          className="w-[120px]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="send-window-end" className="text-sm whitespace-nowrap">Alle:</Label>
                        <Input
                          id="send-window-end"
                          type="time"
                          value={sendWindowEnd}
                          onChange={(e) => setSendWindowEnd(e.target.value)}
                          className="w-[120px]"
                        />
                      </div>
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
                            Salva Impostazioni
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Esempio: 13:00 - 14:00 significa che le email saranno inviate solo tra le 13:00 e le 14:00 ora italiana
                    </p>
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
            </div>
          </DialogContent>
        </Dialog>

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

      {/* Import Brand Voice from Agent Dialog */}
      <Dialog open={showImportAgentDialog} onOpenChange={setShowImportAgentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Importa Brand Voice da Agente
            </DialogTitle>
            <DialogDescription>
              Seleziona un agente WhatsApp per importare i dati del Brand Voice
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {availableAgents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Nessun agente WhatsApp configurato.</p>
                <p className="text-xs mt-2">Configura prima un agente nella sezione WhatsApp.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {availableAgents.map((agent: any) => (
                  <div
                    key={agent.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedAgentId === agent.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={selectedAgentId === agent.id}
                        onChange={() => setSelectedAgentId(agent.id)}
                        className="h-4 w-4 text-primary"
                      />
                      <div>
                        <p className="font-medium text-sm">{agent.agentName || agent.businessName || "Agente senza nome"}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.businessName || agent.agentType || "Nessuna descrizione"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowImportAgentDialog(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleImportFromAgent}
                disabled={!selectedAgentId || isImportingBrandVoice}
              >
                {isImportingBrandVoice ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importazione...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Importa
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewConfirmDialog} onOpenChange={(open) => {
        if (!open && !isGeneratingWeek) {
          setShowPreviewConfirmDialog(false);
          if (!showWeekGenerationUI) {
            setPreviewTemplate(null);
          }
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {!showWeekGenerationUI ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-emerald-500" />
                  Anteprima Template Giorno 1
                </DialogTitle>
                <DialogDescription>
                  Ecco come apparirà la prima email della sequenza. Ti piace lo stile?
                </DialogDescription>
              </DialogHeader>
              
              {previewTemplate && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                    <div className="mb-3">
                      <Label className="text-xs text-muted-foreground">Oggetto:</Label>
                      <p className="font-medium text-lg">{previewTemplate.subject}</p>
                    </div>
                    <Separator className="my-3" />
                    <div>
                      <Label className="text-xs text-muted-foreground">Corpo email:</Label>
                      <div 
                        className="mt-2 prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewTemplate.body }}
                      />
                    </div>
                  </div>
                  
                  <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                      <strong>Nuovo!</strong> Ora puoi generare i template 7 alla volta. Potrai chiudere la finestra e riprendere quando vuoi.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowPreviewConfirmDialog(false);
                    setPreviewTemplate(null);
                  }}
                >
                  Annulla e Riprova
                </Button>
                <Button
                  onClick={() => {
                    setShowWeekGenerationUI(true);
                    setGeneratedWeekTemplates([]);
                    refetchGenerationStatus();
                  }}
                  disabled={!previewTemplate}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Inizia Generazione Settimanale
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-500" />
                  Generazione Template Lead Nurturing 365
                </DialogTitle>
                <DialogDescription>
                  {generationStatus?.isComplete 
                    ? "Tutti i template sono stati generati con successo!" 
                    : "Genera i template 7 alla volta. Puoi chiudere questa finestra e riprendere in seguito."
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Progresso generazione</span>
                    <span className="text-muted-foreground">
                      {generationStatus?.totalGenerated || 0} / 365 template
                    </span>
                  </div>
                  <Progress 
                    value={((generationStatus?.totalGenerated || 0) / 365) * 100} 
                    className="h-3"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {generationStatus?.isComplete 
                        ? "Completato!" 
                        : `Prossimo giorno da generare: ${generationStatus?.nextDay || 1}`
                      }
                    </span>
                    <span>{Math.round(((generationStatus?.totalGenerated || 0) / 365) * 100)}%</span>
                  </div>
                </div>

                {/* Display errors from week generation */}
                {weekGenerationErrors.length > 0 && (
                  <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      <strong>Alcuni giorni hanno avuto errori:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {weekGenerationErrors.slice(0, 5).map((error, idx) => (
                          <li key={idx} className="text-sm">{error}</li>
                        ))}
                        {weekGenerationErrors.length > 5 && (
                          <li className="text-sm text-muted-foreground">
                            ...e altri {weekGenerationErrors.length - 5} errori
                          </li>
                        )}
                      </ul>
                      <p className="mt-2 text-sm">Clicca "Genera prossimi 7 template" per riprovare i giorni mancanti.</p>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Live generation indicator */}
                {isGeneratingWeek && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                      <div className="flex-1">
                        <p className="font-medium text-blue-800 dark:text-blue-200">
                          ⏳ Generando giorno {generationStatus?.nextDay || '...'}...
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-300">
                          {generationStatus?.totalGenerated || 0} template generati finora
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {generationStatus?.isComplete ? (
                  <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      <strong>🎉 Congratulazioni!</strong> Tutti i 365 template email sono stati generati. 
                      Ora puoi visualizzarli nella lista e personalizzarli se necessario.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex justify-center">
                    <Button
                      onClick={() => {
                        const startDay = generationStatus?.nextDay || 1;
                        const effectiveBusinessDescription = nurturingConfig?.config?.businessDescription || businessDescription || "Servizi di consulenza professionale";
                        generateWeekMutation.mutate({
                          businessDescription: effectiveBusinessDescription,
                          referenceEmail,
                          preferredTone,
                          startDay,
                          previewTemplate: startDay === 1 && previewTemplate ? {
                            subject: previewTemplate.subject,
                            body: previewTemplate.body,
                          } : undefined,
                        });
                      }}
                      disabled={isGeneratingWeek}
                      size="lg"
                      className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-lg px-8 py-6"
                    >
                      {isGeneratingWeek ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Generazione in corso...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="mr-2 h-5 w-5" />
                          Genera prossimi 7 template
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {generatedWeekTemplates.length > 0 && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Template generati in questa sessione ({generatedWeekTemplates.length})
                    </Label>
                    <Accordion type="single" collapsible className="w-full border rounded-lg">
                      {generatedWeekTemplates.slice().reverse().slice(0, 14).map((template) => (
                        <AccordionItem key={template.dayNumber} value={`day-${template.dayNumber}`}>
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center gap-3 text-left">
                              <Badge variant="secondary" className="shrink-0">
                                Giorno {template.dayNumber}
                              </Badge>
                              <Badge variant="outline" className="shrink-0 capitalize text-xs">
                                {template.category}
                              </Badge>
                              <span className="text-sm truncate max-w-[250px]">
                                {template.subject}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">Oggetto:</Label>
                                <p className="font-medium">{template.subject}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Corpo email:</Label>
                                <div 
                                  className="mt-2 prose prose-sm dark:prose-invert max-w-none bg-slate-50 dark:bg-slate-800 p-3 rounded border max-h-64 overflow-y-auto"
                                  dangerouslySetInnerHTML={{ __html: template.body }}
                                />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                    {generatedWeekTemplates.length > 14 && (
                      <p className="text-xs text-muted-foreground text-center">
                        + altri {generatedWeekTemplates.length - 14} template generati
                      </p>
                    )}
                  </div>
                )}

                {!generationStatus?.isComplete && generationStatus && generationStatus.totalGenerated > 0 && generatedWeekTemplates.length === 0 && (
                  <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200">
                    <History className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                      <strong>Ripresa generazione:</strong> Hai già generato {generationStatus.totalGenerated} template in precedenza.
                      Clicca "Genera prossimi 7 template" per continuare dal giorno {generationStatus.nextDay}.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowPreviewConfirmDialog(false);
                    setShowWeekGenerationUI(false);
                  }}
                  disabled={isGeneratingWeek}
                >
                  {generationStatus?.isComplete ? "Chiudi" : "Chiudi e Riprendi Dopo"}
                </Button>
                {generationStatus?.isComplete && (
                  <Button
                    onClick={() => {
                      setShowPreviewConfirmDialog(false);
                      setShowWeekGenerationUI(false);
                      setPreviewTemplate(null);
                      setGeneratedWeekTemplates([]);
                    }}
                    className="bg-gradient-to-r from-green-500 to-emerald-500"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Completa
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showBrandVoiceWarningDialog} onOpenChange={setShowBrandVoiceWarningDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Brand Voice non configurato
            </DialogTitle>
            <DialogDescription>
              Non hai ancora salvato le informazioni del Brand Voice. Le email generate saranno generiche e non personalizzate con la tua identità di brand.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Consiglio:</strong> Compila almeno i campi principali (Nome Business, Descrizione, Vision/Mission) nella sezione "Brand Voice & Credibilità" e clicca "Salva Brand Voice" prima di generare i template.
            </p>
          </div>
          
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowBrandVoiceWarningDialog(false)}
            >
              Torna a configurare
            </Button>
            <Button
              onClick={() => {
                setShowBrandVoiceWarningDialog(false);
                generatePreviewMutation.mutate({
                  businessDescription,
                  referenceEmail,
                  preferredTone,
                });
              }}
              variant="secondary"
            >
              Continua comunque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConsultantAIAssistant />
    </div>
  );
}

// NurturingKBDropzone Component - Drag & Drop upload for Nurturing Knowledge Base
interface NurturingKBDropzoneProps {
  onFilesDropped: (files: File[]) => void;
  isUploading?: boolean;
}

function NurturingKBDropzone({ onFilesDropped, isUploading }: NurturingKBDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFilesDropped,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxFiles: 10,
    multiple: true,
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`relative p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
        isDragActive
          ? "border-amber-500 bg-amber-500/10 scale-[1.02]"
          : isUploading
          ? "border-amber-300/30 bg-amber-50/20 cursor-not-allowed"
          : "border-amber-300/50 bg-gradient-to-br from-amber-50/30 to-orange-50/20 dark:from-amber-900/10 dark:to-orange-900/5 hover:border-amber-400 hover:bg-amber-50/50"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {isUploading ? (
          <>
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-lg">Caricamento in corso...</p>
              <p className="text-sm text-muted-foreground">Attendere prego</p>
            </div>
          </>
        ) : isDragActive ? (
          <>
            <FileText className="h-10 w-10 text-amber-500 animate-bounce" />
            <p className="font-semibold text-lg text-amber-600">Rilascia qui i file!</p>
          </>
        ) : (
          <>
            <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <FileText className="h-8 w-8 text-amber-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">Trascina i tuoi documenti qui</p>
              <p className="text-sm text-muted-foreground">oppure clicca per selezionare</p>
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30">PDF</Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30">DOCX</Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30">TXT</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Fino a 10 file alla volta</p>
          </>
        )}
      </div>
    </div>
  );
}