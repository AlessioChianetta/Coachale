import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Activity, Brain, Clock, CheckCircle, Loader2, Eye, ChevronLeft, ChevronRight,
  Zap, BarChart3, Sparkles, Lightbulb, Bot, Calendar, Play, Database, FileText, Search,
  Users, ChevronDown, Trash2, Phone, Mail, MessageSquare, BookOpen, ListChecks,
  TrendingUp, AlertTriangle, Download, Maximize2, ClipboardList, Target
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { ActivityResponse, ActivityItem } from "./types";
import { getActivityIcon, getSeverityBadge, getRelativeTime } from "./utils";
import { AI_ROLE_PROFILES, AI_ROLE_ACCENT_COLORS } from "./constants";

function RoleSpecificDataRenderer({ data, roleId }: { data: any; roleId: string }) {
  if (!data || typeof data !== 'object') return null;

  const sections: Array<{ key: string; label: string; icon: React.ReactNode; render: () => React.ReactNode }> = [];

  if (data.workload) {
    const w = data.workload;
    sections.push({
      key: 'workload',
      label: 'Carico di lavoro',
      icon: <BarChart3 className="h-3 w-3" />,
      render: () => (
        <div className="flex flex-wrap gap-3 text-[10px]">
          <span>Completati (7gg): <strong>{w.completed_7d || 0}</strong></span>
          <span>Completati (30gg): <strong>{w.completed_30d || 0}</strong></span>
          <span>In attesa: <strong>{w.pending_tasks || 0}</strong></span>
        </div>
      ),
    });
  }

  if (data.clientCount !== undefined) {
    sections.push({
      key: 'clientCount',
      label: 'Clienti attivi',
      icon: <Users className="h-3 w-3" />,
      render: () => <span className="text-[10px]"><strong>{data.clientCount}</strong> clienti attivi</span>,
    });
  }

  if (Array.isArray(data.upcomingConsultations) && data.upcomingConsultations.length > 0) {
    sections.push({
      key: 'consultations',
      label: `Consulenze in arrivo (${data.upcomingConsultations.length})`,
      icon: <Calendar className="h-3 w-3" />,
      render: () => (
        <div className="space-y-1">
          {data.upcomingConsultations.slice(0, 8).map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">{c.client_name || c.notes || 'N/A'}</span>
              <span>·</span>
              <span>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
              {c.source === 'google_calendar' && <Badge variant="outline" className="text-[8px] px-1 py-0">GCal</Badge>}
            </div>
          ))}
          {data.upcomingConsultations.length > 8 && <span className="text-[10px] text-muted-foreground">...e altre {data.upcomingConsultations.length - 8}</span>}
        </div>
      ),
    });
  }

  if (Array.isArray(data.consultationMonitoring) && data.consultationMonitoring.length > 0) {
    sections.push({
      key: 'monitoring',
      label: `Monitoraggio consulenze (${data.consultationMonitoring.length})`,
      icon: <Target className="h-3 w-3" />,
      render: () => (
        <div className="space-y-1">
          {data.consultationMonitoring.slice(0, 6).map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">{c.client_name}</span>
              <span>·</span>
              <span>{c.consultations_used || 0}/{c.monthly_consultation_limit || '∞'} consulenze</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  if (Array.isArray(data.schedulingGaps) && data.schedulingGaps.length > 0) {
    const gaps = data.schedulingGaps.filter((g: any) => g.monthly_consultation_limit && g.scheduled_count < g.monthly_consultation_limit);
    if (gaps.length > 0) {
      sections.push({
        key: 'gaps',
        label: `Consulenze mancanti (${gaps.length})`,
        icon: <AlertTriangle className="h-3 w-3 text-amber-500" />,
        render: () => (
          <div className="space-y-1">
            {gaps.slice(0, 6).map((g: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-medium">{g.client_name}</span>
                <span>·</span>
                <span>{g.month_name}: {g.scheduled_count}/{g.monthly_consultation_limit}</span>
              </div>
            ))}
          </div>
        ),
      });
    }
  }

  if (Array.isArray(data.consultantPersonalTasks) && data.consultantPersonalTasks.length > 0) {
    const pending = data.consultantPersonalTasks.filter((t: any) => !t.completed);
    sections.push({
      key: 'personalTasks',
      label: `Task personali (${pending.length} attivi)`,
      icon: <ClipboardList className="h-3 w-3" />,
      render: () => (
        <div className="space-y-1">
          {pending.slice(0, 5).map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                t.priority === 'urgent' ? 'bg-red-500' : t.priority === 'high' ? 'bg-amber-500' : 'bg-gray-400'
              )} />
              <span className="font-medium truncate max-w-[200px]">{t.title}</span>
              {t.due_date && <span>· scad. {new Date(t.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>}
            </div>
          ))}
        </div>
      ),
    });
  }

  if (Array.isArray(data.clientTasks) && data.clientTasks.length > 0) {
    const pendingClient = data.clientTasks.filter((t: any) => !t.completed);
    sections.push({
      key: 'clientTasks',
      label: `Esercizi clienti (${pendingClient.length} attivi)`,
      icon: <ListChecks className="h-3 w-3" />,
      render: () => (
        <div className="space-y-1">
          {pendingClient.slice(0, 5).map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">{t.client_name}</span>
              <span>·</span>
              <span className="truncate max-w-[180px]">{t.title}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  if (Array.isArray(data.clientTaskStats) && data.clientTaskStats.length > 0) {
    sections.push({
      key: 'taskStats',
      label: `Statistiche esercizi (${data.clientTaskStats.length} clienti)`,
      icon: <TrendingUp className="h-3 w-3" />,
      render: () => (
        <div className="space-y-1">
          {data.clientTaskStats.slice(0, 5).map((s: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">{s.client_name}</span>
              <span>·</span>
              <span>{s.completed_tasks}/{s.total_tasks} completati</span>
              {parseInt(s.overdue_tasks) > 0 && <Badge variant="outline" className="text-[8px] px-1 py-0 text-red-600 border-red-200">⚠ {s.overdue_tasks} scaduti</Badge>}
            </div>
          ))}
        </div>
      ),
    });
  }

  if (data.marcoContext && typeof data.marcoContext === 'object' && Object.keys(data.marcoContext).length > 0) {
    sections.push({
      key: 'marcoContext',
      label: 'Contesto strategico (Roadmap)',
      icon: <Sparkles className="h-3 w-3" />,
      render: () => {
        const mc = data.marcoContext;
        return (
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            {mc.businessGoals && <div><strong>Obiettivi:</strong> {mc.businessGoals}</div>}
            {mc.currentChallenges && <div><strong>Sfide:</strong> {mc.currentChallenges}</div>}
            {mc.strategicNotes && <div><strong>Note strategiche:</strong> {mc.strategicNotes}</div>}
            {!mc.businessGoals && !mc.currentChallenges && !mc.strategicNotes && <span>Configurato</span>}
          </div>
        );
      },
    });
  }

  if (Array.isArray(data.consultations) && data.consultations.length > 0) {
    sections.push({
      key: 'consultationsGeneric',
      label: `Consulenze (${data.consultations.length})`,
      icon: <Calendar className="h-3 w-3" />,
      render: () => (
        <div className="space-y-1">
          {data.consultations.slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">{c.client_name || 'N/A'}</span>
              <span>·</span>
              <span>{c.status === 'completed' ? '✓' : '◎'} {c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : ''}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  if (Array.isArray(data.voiceCalls) && data.voiceCalls.length > 0) {
    sections.push({
      key: 'voiceCalls',
      label: `Chiamate vocali (${data.voiceCalls.length})`,
      icon: <Phone className="h-3 w-3" />,
      render: () => (
        <div className="space-y-1">
          {data.voiceCalls.slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{c.target_phone}</span>
              <span>·</span>
              <Badge variant="outline" className="text-[8px] px-1 py-0">{c.status}</Badge>
            </div>
          ))}
        </div>
      ),
    });
  }

  if (Array.isArray(data.journeyProgress) && data.journeyProgress.length > 0) {
    sections.push({
      key: 'journeyProgress',
      label: `Percorsi email (${data.journeyProgress.length})`,
      icon: <Mail className="h-3 w-3" />,
      render: () => (
        <div className="space-y-1">
          {data.journeyProgress.slice(0, 5).map((j: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">{j.client_name}</span>
              <span>·</span>
              <span>Giorno {j.current_day}</span>
              {j.last_email_subject && <span>· "{j.last_email_subject.substring(0, 30)}"</span>}
            </div>
          ))}
        </div>
      ),
    });
  }

  if (Array.isArray(data.emailLogs) && data.emailLogs.length > 0) {
    sections.push({
      key: 'emailLogs',
      label: `Email inviate (${data.emailLogs.length})`,
      icon: <Mail className="h-3 w-3" />,
      render: () => <span className="text-[10px] text-muted-foreground">{data.emailLogs.length} email nelle ultime 2 settimane</span>,
    });
  }

  if (Array.isArray(data.unsummarizedConsultations) && data.unsummarizedConsultations.length > 0) {
    sections.push({
      key: 'unsummarized',
      label: `Consulenze senza riassunto (${data.unsummarizedConsultations.length})`,
      icon: <FileText className="h-3 w-3 text-amber-500" />,
      render: () => (
        <div className="space-y-1">
          {data.unsummarizedConsultations.slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">{c.client_name}</span>
              <span>·</span>
              <span>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : ''}</span>
              {c.transcript ? <Badge variant="outline" className="text-[8px] px-1 py-0 text-green-600">Ha trascrizione</Badge> : <Badge variant="outline" className="text-[8px] px-1 py-0 text-amber-600">Senza trascrizione</Badge>}
            </div>
          ))}
        </div>
      ),
    });
  }

  if (data.pipelineStats) {
    const ps = data.pipelineStats;
    sections.push({
      key: 'pipeline',
      label: 'Pipeline riassunti',
      icon: <BarChart3 className="h-3 w-3" />,
      render: () => (
        <div className="flex flex-wrap gap-3 text-[10px]">
          <span>Programmate: <strong>{ps.scheduled_count || 0}</strong></span>
          <span>Pronte per email: <strong>{ps.ready_for_email || 0}</strong></span>
          <span>Inviate: <strong>{ps.email_sent || 0}</strong></span>
          <span>Senza trascrizione: <strong>{ps.missing_transcript || 0}</strong></span>
        </div>
      ),
    });
  }

  if (Array.isArray(data.recentPosts) && data.recentPosts.length > 0) {
    sections.push({
      key: 'recentPosts',
      label: `Post recenti (${data.recentPosts.length})`,
      icon: <Sparkles className="h-3 w-3" />,
      render: () => (
        <div className="space-y-1">
          {data.recentPosts.slice(0, 5).map((p: any, i: number) => (
            <div key={i} className="text-[10px] text-muted-foreground truncate max-w-[300px]">
              {p.topic || p.idea_text || 'Post'}
            </div>
          ))}
        </div>
      ),
    });
  }

  if (Array.isArray(data.pendingIdeas) && data.pendingIdeas.length > 0) {
    sections.push({
      key: 'pendingIdeas',
      label: `Idee contenuto in attesa (${data.pendingIdeas.length})`,
      icon: <Lightbulb className="h-3 w-3 text-amber-500" />,
      render: () => <span className="text-[10px] text-muted-foreground">{data.pendingIdeas.length} idee da sviluppare</span>,
    });
  }

  if (Array.isArray(data.conversations) && data.conversations.length > 0) {
    sections.push({
      key: 'conversations',
      label: `Conversazioni WhatsApp (${data.conversations.length})`,
      icon: <MessageSquare className="h-3 w-3 text-green-500" />,
      render: () => {
        const unread = data.conversations.filter((c: any) => c.unread_by_consultant);
        return (
          <div className="text-[10px] text-muted-foreground">
            <span>{data.conversations.length} attive</span>
            {unread.length > 0 && <span> · <strong className="text-amber-600">{unread.length} non lette</strong></span>}
          </div>
        );
      },
    });
  }

  if (Array.isArray(data.unansweredEmails) && data.unansweredEmails.length > 0) {
    sections.push({
      key: 'unansweredEmails',
      label: `Email senza risposta (${data.unansweredEmails.length})`,
      icon: <Mail className="h-3 w-3 text-red-500" />,
      render: () => (
        <div className="space-y-1">
          {data.unansweredEmails.slice(0, 5).map((e: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">{e.from_name || e.from_email}</span>
              <span>·</span>
              <span className="truncate max-w-[200px]">{e.subject}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  if (Array.isArray(data.openTickets) && data.openTickets.length > 0) {
    sections.push({
      key: 'tickets',
      label: `Ticket aperti (${data.openTickets.length})`,
      icon: <AlertTriangle className="h-3 w-3 text-amber-500" />,
      render: () => (
        <div className="space-y-1">
          {data.openTickets.slice(0, 5).map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Badge variant="outline" className="text-[8px] px-1 py-0">{t.priority || t.status}</Badge>
              <span>{t.reason || t.ai_classification || 'Ticket'}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  if (Array.isArray(data.kbDocumentTitles) && data.kbDocumentTitles.length > 0) {
    sections.push({
      key: 'kb',
      label: `Documenti Knowledge Base (${data.kbDocumentTitles.length})`,
      icon: <BookOpen className="h-3 w-3" />,
      render: () => (
        <div className="flex flex-wrap gap-1">
          {data.kbDocumentTitles.map((title: string, i: number) => (
            <Badge key={i} variant="outline" className="text-[8px]">{title}</Badge>
          ))}
        </div>
      ),
    });
  }

  if (Array.isArray(data.fileSearchStoreNames) && data.fileSearchStoreNames.length > 0) {
    sections.push({
      key: 'fileSearch',
      label: `File Search Stores (${data.fileSearchStoreNames.length})`,
      icon: <Search className="h-3 w-3" />,
      render: () => (
        <div className="flex flex-wrap gap-1">
          {data.fileSearchStoreNames.map((name: string, i: number) => (
            <Badge key={i} variant="outline" className="text-[8px]">{name}</Badge>
          ))}
        </div>
      ),
    });
  }

  if (sections.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground italic">Nessun dato specifico disponibile</div>
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <div key={section.key} className="rounded-lg border bg-background/50 p-2.5">
          <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1.5 text-foreground">
            {section.icon}
            {section.label}
          </p>
          {section.render()}
        </div>
      ))}
    </div>
  );
}

interface ActivityTabProps {
  activityData: ActivityResponse | undefined;
  loadingActivity: boolean;
  activityPage: number;
  setActivityPage: (page: number) => void;
  severityFilter: string;
  setSeverityFilter: (filter: string) => void;
  activitySubTab: "all" | "reasoning" | "simulation";
  setActivitySubTab: (tab: "all" | "reasoning" | "simulation") => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  unreadCount: number;
  reasoningPage: number;
  setReasoningPage: (page: number) => void;
  reasoningRole: string;
  setReasoningRole: (role: string) => void;
  simulationResult: any;
  setSimulationResult: (result: any) => void;
  simulationLoading: boolean;
  setSimulationLoading: (loading: boolean) => void;
  onClearOldFeed: () => void;
  clearingOldFeed: boolean;
  reasoningLogsData: any;
  loadingReasoningLogs: boolean;
  reasoningStatsData: any;
  reasoningModeFilter: string;
  setReasoningModeFilter: (mode: string) => void;
  reasoningData: ActivityResponse | undefined;
  loadingReasoning: boolean;
}

const REASONING_ROLE_COLORS: Record<string, string> = {
  alessia: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800",
  millie: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800",
  echo: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
  nova: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  stella: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
  iris: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-800",
  marco: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800",
  personalizza: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-950/30 dark:text-gray-300 dark:border-gray-800",
};

const REASONING_MODE_LABELS: Record<string, string> = {
  structured: "Strutturato",
  deep_think: "Deep Think",
};

function ReasoningSection({ icon: Icon, title, content, color }: { icon: any; title: string; content: string | null; color: string }) {
  if (!content) return null;
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

function ThinkingStepsTimeline({ steps }: { steps: any[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="rounded-xl border p-3 bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800">
      <div className="flex items-center gap-2 mb-3 font-semibold text-sm text-violet-800 dark:text-violet-300">
        <Brain className="h-4 w-4" />
        Passaggi di Pensiero ({steps.length})
      </div>
      <div className="relative pl-6 space-y-3">
        <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-violet-300 dark:bg-violet-700" />
        {steps.map((step: any, idx: number) => (
          <div key={idx} className="relative">
            <div className="absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-violet-500 border-2 border-white dark:border-background" />
            <div className="text-sm">
              {step.title && <span className="font-medium text-violet-800 dark:text-violet-300">{step.title}: </span>}
              <span className="text-violet-700 dark:text-violet-400">{step.content || step.text || JSON.stringify(step)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksCreatedRejected({ tasksData }: { tasksData: any }) {
  if (!tasksData) return null;
  const created = tasksData.created || tasksData.tasks_created || [];
  const rejected = tasksData.rejected || tasksData.tasks_rejected || [];
  if (created.length === 0 && rejected.length === 0) return null;

  return (
    <div className="space-y-2">
      {created.length > 0 && (
        <div className="rounded-xl border p-3 bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2 font-semibold text-sm text-green-800 dark:text-green-300">
            <CheckCircle className="h-4 w-4" />
            Task Creati ({created.length})
          </div>
          <div className="space-y-1">
            {created.map((task: any, idx: number) => (
              <div key={idx} className="text-sm text-green-700 dark:text-green-400 flex items-start gap-1.5">
                <span className="text-green-500 mt-0.5">•</span>
                <span>{task.title || task.name || JSON.stringify(task)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {rejected.length > 0 && (
        <div className="rounded-xl border p-3 bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2 font-semibold text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />
            Task Scartati per Duplicazione ({rejected.length})
          </div>
          <div className="space-y-1.5">
            {rejected.map((task: any, idx: number) => (
              <div key={idx} className="text-sm text-red-700 dark:text-red-400">
                <div className="flex items-start gap-1.5">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>{task.title || task.name || task.task || JSON.stringify(task)}</span>
                </div>
                {task.reason && (
                  <div className="ml-4 text-xs text-red-500 dark:text-red-400 italic mt-0.5">Motivo: {task.reason}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ROLE_COLOR_MAP: Record<string, string> = {
  alessia: 'pink', millie: 'purple', echo: 'orange', nova: 'pink',
  stella: 'emerald', iris: 'teal', marco: 'indigo', personalizza: 'gray'
};

const AI_SIM_ROLE_COLORS: Record<string, string> = {
  alessia: 'border-pink-300 bg-pink-50 dark:bg-pink-950/20',
  millie: 'border-purple-300 bg-purple-50 dark:bg-purple-950/20',
  echo: 'border-orange-300 bg-orange-50 dark:bg-orange-950/20',
  nova: 'border-rose-300 bg-rose-50 dark:bg-rose-950/20',
  stella: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20',
  iris: 'border-teal-300 bg-teal-50 dark:bg-teal-950/20',
  marco: 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950/20',
  personalizza: 'border-gray-300 bg-gray-50 dark:bg-gray-950/20',
};

function ActivityTab({
  activityData, loadingActivity, activityPage, setActivityPage,
  severityFilter, setSeverityFilter,
  activitySubTab, setActivitySubTab,
  onMarkRead, onMarkAllRead, unreadCount,
  reasoningPage, setReasoningPage,
  reasoningRole, setReasoningRole,
  simulationResult, setSimulationResult, simulationLoading, setSimulationLoading,
  onClearOldFeed, clearingOldFeed,
  reasoningLogsData, loadingReasoningLogs, reasoningStatsData,
  reasoningModeFilter, setReasoningModeFilter,
  reasoningData, loadingReasoning,
}: ActivityTabProps) {
  const { toast } = useToast();
  const [openCycleId, setOpenCycleId] = React.useState<string | null>(null);
  const [expandedReasoningCycles, setExpandedReasoningCycles] = React.useState<Set<string>>(new Set());
  const [promptModalData, setPromptModalData] = React.useState<{ title: string; prompt: string } | null>(null);
  const [loadingPrompt, setLoadingPrompt] = React.useState(false);

  const handleDownloadPrompt = (title: string, prompt: string) => {
    const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchFullPrompt = async (activityId: string, title: string, action: 'view' | 'download') => {
    setLoadingPrompt(true);
    try {
      const res = await fetch(`/api/ai-autonomy/activity/${activityId}/full-prompt`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const prompt = typeof data.prompt === 'string' ? data.prompt : (data.prompt ? JSON.stringify(data.prompt) : '');
      if (action === 'view') {
        setPromptModalData({ title: data.title || title, prompt });
      } else {
        handleDownloadPrompt(data.title || title, prompt);
      }
    } catch {
      toast({ title: "Errore", description: "Impossibile caricare il prompt completo", variant: "destructive" });
    } finally {
      setLoadingPrompt(false);
    }
  };

  const groupedByCycle = React.useMemo(() => {
    if (!activityData?.activities) return { cycles: [], standalone: [] };
    const cycleMap = new Map<string, ActivityItem[]>();
    const standalone: ActivityItem[] = [];
    for (const item of activityData.activities) {
      if (item.cycle_id) {
        if (!cycleMap.has(item.cycle_id)) cycleMap.set(item.cycle_id, []);
        cycleMap.get(item.cycle_id)!.push(item);
      } else {
        standalone.push(item);
      }
    }
    const cycles = Array.from(cycleMap.entries()).map(([cycleId, items]) => ({
      cycleId,
      items,
      firstTime: items[0]?.created_at,
      shortId: cycleId.slice(-5),
    }));
    return { cycles, standalone };
  }, [activityData?.activities]);

  const toggleReasoningCycle = (cycleId: string) => {
    setExpandedReasoningCycles(prev => {
      const next = new Set(prev);
      if (next.has(cycleId)) next.delete(cycleId);
      else next.add(cycleId);
      return next;
    });
  };

  const formatCycleDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ore ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const reasoningLogsByRunId = React.useMemo(() => {
    const map = new Map<string, any>();
    if (reasoningLogsData?.logs) {
      for (const log of reasoningLogsData.logs) {
        if (log.run_id) {
          const key = `${log.run_id}_${log.role_id}`;
          map.set(key, log);
        }
      }
    }
    return map;
  }, [reasoningLogsData]);

  const reasoningGroupedByCycle = React.useMemo(() => {
    if (!reasoningData?.activities) return { cycles: [], standalone: [] };
    const cycleMap = new Map<string, ActivityItem[]>();
    const standalone: ActivityItem[] = [];
    for (const item of reasoningData.activities) {
      if (item.cycle_id) {
        if (!cycleMap.has(item.cycle_id)) cycleMap.set(item.cycle_id, []);
        cycleMap.get(item.cycle_id)!.push(item);
      } else {
        standalone.push(item);
      }
    }
    const cycles = Array.from(cycleMap.entries()).map(([cycleId, items]) => {
      let totalEligible = 0;
      let totalTasks = 0;
      for (const item of items) {
        let ed: any = {};
        try { ed = typeof item.event_data === 'string' ? JSON.parse(item.event_data) : (item.event_data || {}); } catch { ed = {}; }
        totalEligible += (ed.eligible_clients || 0);
        const sug = Array.isArray(ed.suggestions) ? ed.suggestions : [];
        totalTasks += sug.length;
      }
      return {
        cycleId,
        items,
        firstTime: items[0]?.created_at,
        shortId: cycleId.slice(-5),
        totalRoles: items.length,
        totalEligible,
        totalTasks,
      };
    });
    return { cycles, standalone };
  }, [reasoningData?.activities]);

  const renderActivityCard = (item: ActivityItem) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={cn(
        "border border-border rounded-xl shadow-sm transition-colors",
        !item.is_read && "border-primary/30 bg-primary/5"
      )}>
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-4">
            <div className={cn(
              "mt-0.5 p-2 rounded-xl",
              item.severity === "error" ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" :
              item.severity === "warning" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" :
              item.severity === "success" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" :
              "bg-primary/10 text-primary"
            )}>
              {getActivityIcon(item.icon)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{item.title}</span>
                {getSeverityBadge(item.severity)}
                {!item.is_read && (
                  <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                    Nuovo
                  </Badge>
                )}
              </div>
              {item.event_type === 'system_prompt_log' ? (
                <>
                  {(() => {
                    let ed: any = {};
                    try { ed = typeof item.event_data === 'string' ? JSON.parse(item.event_data) : (item.event_data || {}); } catch { ed = {}; }
                    return (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Lunghezza: <strong>{(ed.prompt_length || 0).toLocaleString()}</strong> caratteri</span>
                          <span>Modello: <strong>{ed.model || 'N/A'}</strong></span>
                          <span>Provider: <strong>{ed.provider || 'N/A'}</strong></span>
                          <span>Clienti: <strong>{ed.clients_in_prompt || 0}/{ed.total_clients || 0}</strong></span>
                          {ed.file_search && <Badge variant="outline" className="text-[10px]">File Search</Badge>}
                          {ed.uses_full_client_list && <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">Lista completa</Badge>}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 rounded-xl"
                            disabled={loadingPrompt}
                            onClick={() => {
                              if (ed.has_full_prompt) {
                                fetchFullPrompt(item.id, item.title, 'view');
                              } else {
                                setPromptModalData({ title: item.title, prompt: item.description || '' });
                              }
                            }}
                          >
                            {loadingPrompt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Maximize2 className="h-3 w-3" />}
                            Vedi prompt completo
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 rounded-xl"
                            disabled={loadingPrompt}
                            onClick={() => {
                              if (ed.has_full_prompt) {
                                fetchFullPrompt(item.id, item.title, 'download');
                              } else {
                                handleDownloadPrompt(item.title, item.description || '');
                              }
                            }}
                          >
                            <Download className="h-3 w-3" />
                            Scarica .txt
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {getRelativeTime(item.created_at)}
                </span>
                {item.contact_name && (
                  <span className="flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    {item.contact_name}
                  </span>
                )}
              </div>
            </div>

            {!item.is_read && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => onMarkRead(item.id)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderFormattedText = (content: string) => {
    const parts = content.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const parseStructuredReasoning = (text: string): { observation?: string; reflection?: string; decision?: string; selfReview?: string } | null => {
    const hasStructured = /\*\*(Osservazione|Observation|Analisi Dati|Riflessione|Reflection|Decisione|Decision|Auto-revisione|Self.?Review|Priorit)/i.test(text);
    if (!hasStructured) return null;

    const result: Record<string, string> = {};

    const sectionPatterns = [
      { key: 'observation', patterns: [/\*\*(?:Osservazione|Observation|Analisi Dati)[:\s]*\*\*\s*/i] },
      { key: 'reflection', patterns: [/\*\*(?:Riflessione|Reflection|Priorità|Priorit)[:\s]*\*\*\s*/i] },
      { key: 'decision', patterns: [/\*\*(?:Decisione|Decision)[:\s]*\*\*\s*/i] },
      { key: 'selfReview', patterns: [/\*\*(?:Auto-revisione|Auto revisione|Self.?Review|Revisione)[:\s]*\*\*\s*/i] },
    ];

    const allPatterns = sectionPatterns.flatMap(s => s.patterns);
    const combinedPattern = new RegExp(allPatterns.map(p => p.source).join('|'), 'gi');
    const parts = text.split(combinedPattern).filter(Boolean);
    const headers = [...text.matchAll(combinedPattern)];

    if (headers.length === 0) return null;

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i][0].toLowerCase();
      const content = parts[i + 1]?.trim() || '';
      if (!content) continue;

      if (/osservazione|observation|analisi dati/i.test(header)) result.observation = content;
      else if (/riflessione|reflection|priorit/i.test(header)) result.reflection = content;
      else if (/decisione|decision/i.test(header)) result.decision = content;
      else if (/auto.?revisione|self.?review|revisione/i.test(header)) result.selfReview = content;
    }

    return Object.keys(result).length > 0 ? result : null;
  };

  const parseMarcoReasoning = (text: string): { quadroGenerale?: string; criticita?: string; opportunita?: string; cosaDevi?: string } | null => {
    const markers = ['📊', '⚠️', '💡', '🎯'];
    const found = markers.filter(m => text.includes(m));
    if (found.length < 2) return null;

    const result: Record<string, string> = {};
    const regex = /^(📊|⚠️|💡|🎯)\s*[^\n]*/gm;
    const matches = [...text.matchAll(regex)];
    if (matches.length < 2) return null;

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const emoji = match[1];
      const startIdx = match.index! + match[0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const content = text.slice(startIdx, endIdx).trim();
      if (!content) continue;

      if (emoji === '📊') result.quadroGenerale = content;
      else if (emoji === '⚠️') result.criticita = content;
      else if (emoji === '💡') result.opportunita = content;
      else if (emoji === '🎯') result.cosaDevi = content;
    }

    return Object.keys(result).length >= 2 ? result : null;
  };

  const getCategoryLabel = (cat?: string): string => {
    const labels: Record<string, string> = {
      followup: 'Follow-up',
      outreach: 'Primo contatto',
      reminder: 'Promemoria',
      monitoring: 'Monitoraggio',
      preparation: 'Preparazione',
      analysis: 'Analisi',
      report: 'Report',
    };
    return labels[cat || ''] || 'Task';
  };

  const getCategoryStyle = (cat?: string): string => {
    const styles: Record<string, string> = {
      followup: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400',
      outreach: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400',
      reminder: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400',
      monitoring: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400',
      preparation: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400',
      analysis: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400',
      report: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/30 dark:text-slate-400',
    };
    return styles[cat || ''] || 'bg-muted text-muted-foreground';
  };

  const getCategoryIcon = (cat?: string): string => {
    const icons: Record<string, string> = {
      followup: '🔄',
      outreach: '🟢',
      reminder: '⏰',
      monitoring: '📊',
      preparation: '📋',
      analysis: '🔍',
      report: '📄',
    };
    return icons[cat || ''] || '📌';
  };

  const getPriorityStyle = (priority?: number): string => {
    if (priority === 1) return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400';
    if (priority === 2) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400';
    return 'bg-muted text-muted-foreground';
  };

  const renderReasoningCard = (item: any) => {
    let eventData: any = {};
    try {
      eventData = typeof item.event_data === 'string' ? JSON.parse(item.event_data) : (item.event_data || {});
    } catch { eventData = {}; }
    const suggestions = Array.isArray(eventData.suggestions) ? eventData.suggestions : [];
    const roleId = item.ai_role || eventData.ai_role || '';
    const cycleId = item.cycle_id || '';
    const matchingReasoningLog = cycleId ? reasoningLogsByRunId.get(`${cycleId}_${roleId}`) : undefined;
    const roleProfile = AI_ROLE_PROFILES[roleId];
    const roleColorKey = ROLE_COLOR_MAP[roleId] || 'purple';
    const colors = AI_ROLE_ACCENT_COLORS[roleColorKey] || AI_ROLE_ACCENT_COLORS.purple;
    const displayName = roleProfile ? roleId.charAt(0).toUpperCase() + roleId.slice(1) : (item.title || 'AI');
    const timeStr = new Date(item.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className={cn(
          "border border-border rounded-xl shadow-sm transition-all overflow-hidden",
          !item.is_read && "ring-2 ring-primary/20"
        )}>
          <div className={cn("flex items-center gap-3 px-5 py-3 border-b", colors.badge)}>
            <div className="w-8 h-8 rounded-xl overflow-hidden ring-2 ring-white/50 shrink-0">
              {roleProfile?.avatar ? (
                <img src={roleProfile.avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center text-sm">🤖</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{displayName}</p>
              <p className="text-xs opacity-80">{roleProfile?.role || ''}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs opacity-70">{timeStr}</span>
              {!item.is_read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onMarkRead(item.id)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <CardContent className="py-4 px-5 space-y-4">
            {(() => {
              console.log('[ActivityTab DEBUG]', {
                itemId: item.id,
                roleId,
                cycleId: item.cycle_id,
                hasMatchingReasoningLog: !!matchingReasoningLog,
                matchingReasoningLogKeys: matchingReasoningLog ? Object.keys(matchingReasoningLog) : null,
                matchingReasoningLogObservation: matchingReasoningLog?.observation?.substring(0, 80),
                matchingReasoningLogReflection: matchingReasoningLog?.reflection?.substring(0, 80),
                matchingReasoningLogDecision: matchingReasoningLog?.decision?.substring(0, 80),
                matchingReasoningLogSelfReview: matchingReasoningLog?.self_review?.substring(0, 80),
                hasOverallReasoning: !!eventData.overall_reasoning,
                overallReasoningPreview: eventData.overall_reasoning ? (eventData.overall_reasoning as string).substring(0, 80) : null,
                eventDataKeys: Object.keys(eventData),
              });
              return null;
            })()}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted/40 rounded-xl p-2.5">
                <p className="text-lg font-bold">{eventData.total_clients || 0}</p>
                <p className="text-[10px] text-muted-foreground">Clienti analizzati</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-2.5">
                <p className="text-lg font-bold">{eventData.eligible_clients || 0}</p>
                <p className="text-[10px] text-muted-foreground">Idonei</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-2.5">
                <p className="text-lg font-bold">{suggestions.length}</p>
                <p className="text-[10px] text-muted-foreground">Task creati</p>
              </div>
            </div>

            {matchingReasoningLog && (
              <div className="space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-violet-600" />
                  Pensiero Intimo AI
                </p>
                <ReasoningSection icon={Eye} title="Osservazione" content={matchingReasoningLog.observation} color="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300" />
                <ReasoningSection icon={Lightbulb} title="Riflessione" content={matchingReasoningLog.reflection} color="bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300" />
                <ReasoningSection icon={Target} title="Decisione" content={matchingReasoningLog.decision} color="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300" />
                <ReasoningSection icon={Brain} title="Auto-Revisione" content={matchingReasoningLog.self_review} color="bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300" />
                {matchingReasoningLog.reasoning_mode === "deep_think" && (
                  <ThinkingStepsTimeline steps={Array.isArray(matchingReasoningLog.thinking_steps) ? matchingReasoningLog.thinking_steps : []} />
                )}
                <TasksCreatedRejected tasksData={matchingReasoningLog.tasks_data} />
                {(matchingReasoningLog.total_tokens > 0 || matchingReasoningLog.model_used) && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    {matchingReasoningLog.total_tokens > 0 && <span>Token: {matchingReasoningLog.total_tokens?.toLocaleString("it-IT")}</span>}
                    {matchingReasoningLog.model_used && <span>Modello: {matchingReasoningLog.model_used}</span>}
                    {matchingReasoningLog.reasoning_mode && (
                      <Badge variant="secondary" className="text-[10px]">
                        {REASONING_MODE_LABELS[matchingReasoningLog.reasoning_mode] || matchingReasoningLog.reasoning_mode}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}

            {eventData.overall_reasoning && (() => {
              const text = (eventData.overall_reasoning as string).trim();
              const paragraphs = text
                .split(/\n\s*\n/g)
                .map((p: string) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
                .filter((p: string) => p.length > 0);

              return (
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-bold mb-3 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Analisi Executive Coach
                  </p>
                  {paragraphs.length === 0 ? (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{text}</p>
                  ) : (
                    <div className="text-sm text-muted-foreground leading-relaxed space-y-2.5">
                      {paragraphs.map((para: string, i: number) => (
                        <p key={i}>{renderFormattedText(para)}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {!eventData.overall_reasoning && (
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-bold mb-2 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" />
                  Risultato analisi
                </p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5">
                  <ListChecks className="h-3.5 w-3.5" />
                  Azioni decise ({suggestions.length})
                </p>
                {suggestions.map((s: any, idx: number) => (
                  <div key={idx} className="rounded-xl border p-3 bg-card">
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <Badge className={cn("text-[10px] px-1.5 py-0", getCategoryStyle(s.category))}>
                        {getCategoryIcon(s.category)} {getCategoryLabel(s.category)}
                      </Badge>
                      {s.channel && s.channel !== 'none' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {s.channel === 'voice' ? '📞 Chiamata' : s.channel === 'email' ? '📧 Email' : s.channel === 'whatsapp' ? '💬 WhatsApp' : s.channel}
                        </Badge>
                      )}
                      {s.priority && (
                        <Badge className={cn("text-[10px] px-1.5 py-0", getPriorityStyle(s.priority))}>
                          P{s.priority}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="font-semibold text-sm">{s.client_name || 'Generale'}</span>
                    </div>
                    <p className="text-sm mb-2">{s.instruction}</p>
                    {s.reasoning && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded-xl p-2">
                        <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
                        <span><strong>Perché:</strong> {s.reasoning}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {eventData.clients_list && (
              <details className="text-xs group">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-1">
                  <Database className="h-3 w-3" />
                  Base dati utilizzata
                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-2 space-y-2">
                  {eventData.clients_list && (
                    <div className="rounded-xl border bg-muted/20 p-3">
                      <p className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Clienti analizzati ({eventData.clients_list.length}{eventData.total_clients ? ` di ${eventData.total_clients}` : ''})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {eventData.clients_list.map((c: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px]">
                            {c.name || c.first_name || `ID: ${c.id?.substring(0, 8)}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {eventData.excluded_clients && (
                    <div className="rounded-xl border bg-amber-50/50 dark:bg-amber-950/10 p-3">
                      <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                        <Search className="h-3 w-3" />
                        Clienti esclusi
                      </p>
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        <span>Con task pendenti: {eventData.excluded_clients.with_pending_tasks || 0}</span>
                        <span>Completati di recente: {eventData.excluded_clients.with_recent_completion || 0}</span>
                      </div>
                    </div>
                  )}

                  {eventData.role_specific_data && (
                    <div className="rounded-xl border bg-muted/20 p-3">
                      <p className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        Dati ruolo-specifici
                      </p>
                      <RoleSpecificDataRenderer data={eventData.role_specific_data} roleId={roleId} />
                    </div>
                  )}

                  {eventData.recent_tasks_summary && eventData.recent_tasks_summary.length > 0 && (
                    <div className="rounded-xl border bg-muted/20 p-3">
                      <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Task recenti ({eventData.recent_tasks_summary.length})
                      </p>
                      <div className="space-y-1">
                        {eventData.recent_tasks_summary.map((t: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="font-medium">{t.contact_name || 'N/A'}</span>
                            <span>·</span>
                            <span>{t.task_category || t.category}</span>
                            <span>·</span>
                            <span>{t.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}

            {suggestions.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/20 rounded-xl p-3">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Nessuna azione necessaria al momento. Tutti i clienti sono seguiti correttamente.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={activitySubTab === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActivitySubTab("all")}
          className="gap-1.5 rounded-xl"
        >
          <Activity className="h-3.5 w-3.5" />
          Tutti
        </Button>
        <Button
          variant={activitySubTab === "reasoning" ? "default" : "outline"}
          size="sm"
          onClick={() => { setActivitySubTab("reasoning"); setReasoningPage(1); }}
          className="gap-1.5 rounded-xl"
        >
          <Brain className="h-3.5 w-3.5" />
          Ragionamento AI
        </Button>
        <Button
          variant={activitySubTab === "simulation" ? "default" : "outline"}
          size="sm"
          onClick={() => setActivitySubTab("simulation")}
          className="gap-1.5 rounded-xl"
        >
          <Zap className="h-3.5 w-3.5" />
          Simulazione
        </Button>
      </div>

      {activitySubTab === "all" && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Select value={severityFilter} onValueChange={(val) => { setSeverityFilter(val); setActivityPage(1); }}>
                <SelectTrigger className="w-[160px] rounded-xl">
                  <SelectValue placeholder="Filtra per tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Successo</SelectItem>
                  <SelectItem value="warning">Avviso</SelectItem>
                  <SelectItem value="error">Errore</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMarkAllRead()}
                disabled={unreadCount === 0}
                className="rounded-xl"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Segna tutto come letto
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (window.confirm("Eliminare tutte le attività vecchie (senza ciclo)? Le nuove attività con raggruppamento ciclo verranno mantenute.")) {
                    onClearOldFeed();
                  }
                }}
                disabled={clearingOldFeed}
                className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200"
              >
                {clearingOldFeed ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Pulisci feed vecchio
              </Button>
            </div>
          </div>

          {loadingActivity ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !activityData?.activities?.length ? (
            <Card className="border border-border rounded-xl shadow-sm">
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Nessuna attività trovata</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {groupedByCycle.cycles.map((cycle) => {
                const isOpen = openCycleId === cycle.cycleId;
                const totalTasks = cycle.items.reduce((sum, item) => {
                  let ed: any = {};
                  try { ed = typeof item.event_data === 'string' ? JSON.parse(item.event_data) : (item.event_data || {}); } catch { ed = {}; }
                  const sug = Array.isArray(ed.suggestions) ? ed.suggestions : [];
                  return sum + sug.length;
                }, 0);

                return (
                  <div key={cycle.cycleId}>
                    <Card
                      className="border border-border rounded-xl shadow-sm cursor-pointer transition-colors hover:bg-muted/30 border-l-4 border-l-primary"
                      onClick={() => setOpenCycleId(isOpen ? null : cycle.cycleId)}
                    >
                      <CardContent className="py-3 px-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                              <BarChart3 className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">
                                Analisi #{cycle.shortId} — {formatCycleDate(cycle.firstTime)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {cycle.items.length} {cycle.items.length === 1 ? 'analisi ruolo' : 'analisi ruoli'} · {totalTasks} task creati
                              </p>
                            </div>
                          </div>
                          <ChevronDown className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            isOpen && "rotate-180"
                          )} />
                        </div>
                      </CardContent>
                    </Card>
                    {isOpen && (
                      <div className="pl-4 border-l-2 border-l-primary/20 ml-3 mt-2 space-y-3">
                        {cycle.items.map((item) => renderActivityCard(item))}
                      </div>
                    )}
                  </div>
                );
              })}

              {groupedByCycle.standalone.map((item) => renderActivityCard(item))}
            </div>
          )}

          {activityData && activityData.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActivityPage(Math.max(1, activityPage - 1))}
                disabled={activityPage <= 1}
                className="rounded-xl"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Precedente
              </Button>
              <span className="text-sm text-muted-foreground">
                Pagina {activityData.page} di {activityData.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActivityPage(Math.min(activityData.totalPages, activityPage + 1))}
                disabled={activityPage >= activityData.totalPages}
                className="rounded-xl"
              >
                Successiva
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {activitySubTab === "reasoning" && (
        <div className="space-y-4">
          {reasoningStatsData?.stats && (() => {
            const stats = reasoningStatsData.stats || [];
            const totalRuns = stats.reduce((sum: number, s: any) => sum + parseInt(s.total_runs || "0"), 0);
            const totalCreated = stats.reduce((sum: number, s: any) => sum + parseInt(s.total_tasks_created || "0"), 0);
            const totalRejected = stats.reduce((sum: number, s: any) => sum + parseInt(s.total_tasks_rejected || "0"), 0);
            const avgDuration = stats.length > 0
              ? stats.reduce((sum: number, s: any) => sum + parseFloat(s.avg_duration_ms || "0"), 0) / stats.length
              : 0;
            const formatDur = (ms: number) => {
              if (!ms) return "—";
              if (ms < 1000) return `${Math.round(ms)}ms`;
              return `${(ms / 1000).toFixed(1)}s`;
            };
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border border-border rounded-xl shadow-sm">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-violet-600" />
                      <div>
                        <p className="text-2xl font-bold">{totalRuns}</p>
                        <p className="text-[10px] text-muted-foreground">Esecuzioni Totali</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border rounded-xl shadow-sm">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-2xl font-bold">{totalCreated}</p>
                        <p className="text-[10px] text-muted-foreground">Task Creati</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border rounded-xl shadow-sm">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-2xl font-bold">{totalRejected}</p>
                        <p className="text-[10px] text-muted-foreground">Scartati (Duplicati)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border rounded-xl shadow-sm">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="text-2xl font-bold">{formatDur(avgDuration)}</p>
                        <p className="text-[10px] text-muted-foreground">Durata Media</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center gap-2">
            <Select value={reasoningRole} onValueChange={(v) => { setReasoningRole(v); setReasoningPage(1); }}>
              <SelectTrigger className="w-[170px] h-9 text-sm rounded-xl">
                <SelectValue placeholder="Ruolo AI" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i ruoli</SelectItem>
                <SelectItem value="alessia">Alessia</SelectItem>
                <SelectItem value="millie">Millie</SelectItem>
                <SelectItem value="echo">Echo</SelectItem>
                <SelectItem value="nova">Nova</SelectItem>
                <SelectItem value="stella">Stella</SelectItem>
                <SelectItem value="iris">Iris</SelectItem>
                <SelectItem value="marco">Marco</SelectItem>
                <SelectItem value="personalizza">Personalizza</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reasoningModeFilter} onValueChange={(v) => { setReasoningModeFilter(v); setReasoningPage(1); }}>
              <SelectTrigger className="w-[170px] h-9 text-sm rounded-xl">
                <SelectValue placeholder="Modalità" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le modalità</SelectItem>
                <SelectItem value="structured">Strutturato</SelectItem>
                <SelectItem value="deep_think">Deep Think</SelectItem>
              </SelectContent>
            </Select>
            {(reasoningRole !== 'all' || reasoningModeFilter !== 'all') && (
              <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setReasoningRole('all'); setReasoningModeFilter('all'); setReasoningPage(1); }}>
                Rimuovi filtri
              </Button>
            )}
          </div>

          {loadingReasoning ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (reasoningGroupedByCycle.cycles.length === 0 && reasoningGroupedByCycle.standalone.length === 0) ? (
            <Card className="border border-border rounded-xl shadow-sm">
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Nessun ragionamento registrato ancora.</p>
                <p className="text-xs text-muted-foreground mt-1">Quando i dipendenti AI analizzano i tuoi dati, qui vedrai il loro processo di pensiero completo.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reasoningGroupedByCycle.cycles.map((cycle) => {
                const isExpanded = expandedReasoningCycles.has(cycle.cycleId);
                return (
                  <div key={cycle.cycleId} className="space-y-3">
                    <Card
                      className="border border-border rounded-xl shadow-sm cursor-pointer transition-colors hover:bg-muted/30 border-l-4 border-l-primary"
                      onClick={() => toggleReasoningCycle(cycle.cycleId)}
                    >
                      <CardContent className="py-3 px-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                              <Brain className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">
                                Ciclo di Analisi #{cycle.shortId} — {formatCycleDate(cycle.firstTime)}
                              </p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs text-muted-foreground">{cycle.totalRoles} ruoli analizzati</span>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">{cycle.totalEligible} clienti idonei</span>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">{cycle.totalTasks} task creati</span>
                              </div>
                            </div>
                          </div>
                          <ChevronDown className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180"
                          )} />
                        </div>
                      </CardContent>
                    </Card>

                    {isExpanded && (
                      <div className="pl-4 border-l-2 border-l-primary/20 ml-3 space-y-3">
                        {cycle.items.map((item: any) => renderReasoningCard(item))}
                      </div>
                    )}
                  </div>
                );
              })}

              {reasoningGroupedByCycle.standalone.map((item: any) => renderReasoningCard(item))}

              {reasoningData && reasoningData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReasoningPage(Math.max(1, reasoningPage - 1))}
                    disabled={reasoningPage <= 1}
                    className="rounded-xl"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Precedente
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Pagina {reasoningData.page} di {reasoningData.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReasoningPage(Math.min(reasoningData.totalPages, reasoningPage + 1))}
                    disabled={reasoningPage >= reasoningData.totalPages}
                    className="rounded-xl"
                  >
                    Successiva
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activitySubTab === "simulation" && (
        <div className="space-y-4">
          <Card className="border border-border rounded-xl shadow-sm">
            <CardContent className="py-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                  <Zap className="h-8 w-8 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Modalità Simulazione</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Lancia una simulazione per vedere cosa farebbero i tuoi dipendenti AI con i dati reali, senza creare nessun task.
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    setSimulationLoading(true);
                    setSimulationResult(null);
                    try {
                      const res = await fetch("/api/ai-autonomy/simulate", {
                        method: "POST",
                        headers: { ...getAuthHeaders() },
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Errore simulazione");
                      setSimulationResult(data);
                    } catch (err: any) {
                      toast({ title: "Errore", description: err.message, variant: "destructive" });
                    } finally {
                      setSimulationLoading(false);
                    }
                  }}
                  disabled={simulationLoading}
                  size="lg"
                  className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
                >
                  {simulationLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Simulazione in corso...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Avvia Simulazione
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {simulationResult && (
            <div className="space-y-4">
              <Card className="border border-border rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Risultati Simulazione
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Simulato il {new Date(simulationResult.simulatedAt).toLocaleString('it-IT')} — Provider: {simulationResult.providerName} ({simulationResult.modelName})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-muted/40 rounded-xl p-3">
                      <p className="text-2xl font-bold">{simulationResult.totalRolesAnalyzed}</p>
                      <p className="text-xs text-muted-foreground">Ruoli analizzati</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-3">
                      <p className="text-2xl font-bold text-amber-600">{simulationResult.totalTasksWouldCreate}</p>
                      <p className="text-xs text-muted-foreground">Task che creerebbero</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-3">
                      <p className="text-2xl font-bold">{simulationResult.settings?.autonomyLevel || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">Livello autonomia</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {simulationResult.roles?.map((role: any) => {
                const roleColor = AI_SIM_ROLE_COLORS[role.roleId] || 'border-gray-300 bg-gray-50';

                return (
                  <Card key={role.roleId} className={cn("border-2 rounded-xl shadow-sm", roleColor)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          {role.roleName}
                        </span>
                        {role.skipped ? (
                          <Badge variant="outline" className="text-xs">Saltato</Badge>
                        ) : role.aiResponse?.tasksWouldCreate?.length > 0 ? (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 text-xs">
                            {role.aiResponse.tasksWouldCreate.length} task
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-emerald-600">Nessun task</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {role.skipped && (
                        <p className="text-sm text-muted-foreground">{role.skipReason}</p>
                      )}

                      {role.error && (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                          <p className="text-sm text-red-600">{role.error}</p>
                        </div>
                      )}

                      {!role.skipped && role.dataAnalyzed && (
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="bg-muted/40 rounded-xl p-2">
                            <p className="font-bold">{role.dataAnalyzed.totalClients}</p>
                            <p className="text-muted-foreground">Clienti tot.</p>
                          </div>
                          <div className="bg-muted/40 rounded-xl p-2">
                            <p className="font-bold">{role.dataAnalyzed.eligibleClients}</p>
                            <p className="text-muted-foreground">Idonei</p>
                          </div>
                          <div className="bg-muted/40 rounded-xl p-2">
                            <p className="font-bold">{role.dataAnalyzed.clientsWithPendingTasks}</p>
                            <p className="text-muted-foreground">Con task pendenti</p>
                          </div>
                          <div className="bg-muted/40 rounded-xl p-2">
                            <p className="font-bold">{role.dataAnalyzed.clientsWithRecentCompletion}</p>
                            <p className="text-muted-foreground">Completati recenti</p>
                          </div>
                        </div>
                      )}

                      {role.aiResponse?.overallReasoning && (
                        <div className="rounded-xl border bg-muted/20 p-3">
                          <p className="text-xs font-bold mb-1.5 flex items-center gap-1.5">
                            <Brain className="h-3.5 w-3.5" />
                            Analisi
                          </p>
                          {(() => {
                            const rawText = (role.aiResponse.overallReasoning as string).trim();
                            const renderFormatted = (content: string) => {
                              const fParts = content.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/g);
                              return fParts.map((fp, fi) => {
                                if (fp.startsWith('**') && fp.endsWith('**') && fp.length > 4) {
                                  return <strong key={fi} className="text-foreground font-semibold">{fp.slice(2, -2)}</strong>;
                                }
                                return <span key={fi}>{fp}</span>;
                              });
                            };
                            const cleaned = rawText.replace(/^(📊|⚠️?|💡|🎯)\s*([^\n]*)/gm, (_m, _emoji, title) => {
                              const t = title.trim();
                              return t ? `**${t}**` : '';
                            });
                            const paras = cleaned
                              .split(/\n\s*\n/g)
                              .map(p => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
                              .filter(p => p.length > 0);
                            if (paras.length === 0) {
                              return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{rawText}</p>;
                            }
                            return (
                              <div className="text-sm text-muted-foreground leading-relaxed space-y-2.5">
                                {paras.map((para, pi) => (
                                  <p key={pi}>{renderFormatted(para)}</p>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {role.aiResponse?.tasksWouldCreate && role.aiResponse.tasksWouldCreate.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            Task che avrebbe creato ({role.aiResponse.tasksWouldCreate.length})
                          </p>
                          {role.aiResponse.tasksWouldCreate.map((task: any, idx: number) => (
                            <div key={idx} className="rounded-xl border p-3 bg-card">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-sm">{task.contactName || 'N/A'}</span>
                                <div className="flex items-center gap-1.5">
                                  {task.channel && task.channel !== 'none' && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {task.channel === 'voice' ? '📞' : task.channel === 'email' ? '📧' : '💬'} {task.channel}
                                    </Badge>
                                  )}
                                  <Badge className={cn("text-[10px]",
                                    task.priority === 1 ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400" :
                                    task.priority === 2 ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400" :
                                    "bg-muted text-muted-foreground"
                                  )}>
                                    {task.priority === 1 ? 'Urgente' : task.priority === 2 ? 'Alta' : 'Normale'}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm mb-1.5">{task.instruction}</p>
                              {task.reasoning && (
                                <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded-xl p-2">
                                  <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span><strong>Perché:</strong> {task.reasoning}</span>
                                </div>
                              )}
                              <div className="mt-1.5 text-[10px] text-muted-foreground">
                                Stato previsto: <Badge variant="outline" className="text-[10px] px-1 py-0">{task.wouldBeStatus === 'waiting_approval' ? '⏳ In attesa approvazione' : '📅 Programmato'}</Badge>
                                {' · '}{task.category} · {task.urgency || 'normale'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!role.skipped && role.aiResponse && (!role.aiResponse.tasksWouldCreate || role.aiResponse.tasksWouldCreate.length === 0) && !role.error && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/20 rounded-xl p-3">
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>Nessuna azione necessaria. Tutto sotto controllo.</span>
                        </div>
                      )}

                      {!role.skipped && role.dataAnalyzed?.roleSpecificData && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            Dati analizzati
                          </summary>
                          <div className="mt-2 p-2 bg-muted/30 rounded-xl">
                            <RoleSpecificDataRenderer data={role.dataAnalyzed.roleSpecificData} roleId={role.roleId || ''} />
                          </div>
                        </details>
                      )}

                      {!role.skipped && role.promptSent && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Prompt inviato all'AI
                          </summary>
                          <pre className="mt-2 p-2 bg-muted/30 rounded-xl text-[10px] overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {role.promptSent}
                          </pre>
                        </details>
                      )}

                      {!role.skipped && role.aiResponse?.raw && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <Search className="h-3 w-3" />
                            Risposta AI grezza
                          </summary>
                          <pre className="mt-2 p-2 bg-muted/30 rounded-xl text-[10px] overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {role.aiResponse.raw}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!promptModalData} onOpenChange={(open) => { if (!open) setPromptModalData(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {promptModalData?.title || 'System Prompt'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 pb-2 border-b">
            <Badge variant="outline" className="text-xs">
              {(promptModalData?.prompt?.length || 0).toLocaleString()} caratteri
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 rounded-xl ml-auto"
              onClick={() => {
                if (promptModalData) {
                  navigator.clipboard.writeText(promptModalData.prompt);
                  toast({ title: "Copiato negli appunti" });
                }
              }}
            >
              Copia
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 rounded-xl"
              onClick={() => {
                if (promptModalData) handleDownloadPrompt(promptModalData.title, promptModalData.prompt);
              }}
            >
              <Download className="h-3 w-3" />
              Scarica
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed p-4 bg-muted/30 rounded-xl">
              {promptModalData?.prompt || ''}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ActivityTab;
