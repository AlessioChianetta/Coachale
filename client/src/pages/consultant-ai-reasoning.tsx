import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Lightbulb,
  Target,
  Shield,
  Zap,
  Activity,
  ChevronLeft,
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  alessia: "bg-pink-100 text-pink-800 border-pink-200",
  millie: "bg-purple-100 text-purple-800 border-purple-200",
  echo: "bg-blue-100 text-blue-800 border-blue-200",
  nova: "bg-amber-100 text-amber-800 border-amber-200",
  stella: "bg-emerald-100 text-emerald-800 border-emerald-200",
  iris: "bg-cyan-100 text-cyan-800 border-cyan-200",
  marco: "bg-orange-100 text-orange-800 border-orange-200",
};

const MODE_LABELS: Record<string, string> = {
  structured: "Strutturato",
  deep_think: "Deep Think",
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getRoleColor(roleId: string) {
  return ROLE_COLORS[roleId] || "bg-gray-100 text-gray-800 border-gray-200";
}

function ReasoningSection({ icon: Icon, title, content, color }: { icon: any; title: string; content: string | null; color: string }) {
  if (!content) return null;
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

function ThinkingSteps({ steps }: { steps: any[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="rounded-lg border p-3 bg-violet-50/50 border-violet-200">
      <div className="flex items-center gap-2 mb-3 font-semibold text-sm text-violet-800">
        <Brain className="h-4 w-4" />
        Passaggi di Pensiero ({steps.length})
      </div>
      <div className="relative pl-6 space-y-3">
        <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-violet-300" />
        {steps.map((step: any, idx: number) => (
          <div key={idx} className="relative">
            <div className="absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-violet-500 border-2 border-white" />
            <div className="text-sm">
              {step.title && <span className="font-medium text-violet-800">{step.title}: </span>}
              <span className="text-violet-700">{step.content || step.text || JSON.stringify(step)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksDataSection({ tasksData }: { tasksData: any }) {
  if (!tasksData) return null;
  const created = tasksData.created || tasksData.tasks_created || [];
  const rejected = tasksData.rejected || tasksData.tasks_rejected || [];
  if (created.length === 0 && rejected.length === 0) return null;

  return (
    <div className="space-y-2">
      {created.length > 0 && (
        <div className="rounded-lg border p-3 bg-green-50/50 border-green-200">
          <div className="flex items-center gap-2 mb-2 font-semibold text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            Task Creati ({created.length})
          </div>
          <div className="space-y-1">
            {created.map((task: any, idx: number) => (
              <div key={idx} className="text-sm text-green-700 flex items-start gap-1.5">
                <span className="text-green-500 mt-0.5">•</span>
                <span>{task.title || task.name || JSON.stringify(task)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {rejected.length > 0 && (
        <div className="rounded-lg border p-3 bg-red-50/50 border-red-200">
          <div className="flex items-center gap-2 mb-2 font-semibold text-sm text-red-800">
            <XCircle className="h-4 w-4" />
            Task Rifiutati ({rejected.length})
          </div>
          <div className="space-y-1.5">
            {rejected.map((task: any, idx: number) => (
              <div key={idx} className="text-sm text-red-700">
                <div className="flex items-start gap-1.5">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>{task.title || task.name || task.task || JSON.stringify(task)}</span>
                </div>
                {task.reason && (
                  <div className="ml-4 text-xs text-red-500 italic mt-0.5">Motivo: {task.reason}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LogEntry({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);
  const roleColor = getRoleColor(log.role_id);
  const thinkingSteps = Array.isArray(log.thinking_steps) ? log.thinking_steps : [];

  return (
    <Card className="transition-all hover:shadow-md">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
        <Badge variant="outline" className={`${roleColor} text-xs font-semibold`}>
          {log.role_name || log.role_id}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
        <Badge variant="secondary" className="text-xs">
          {MODE_LABELS[log.reasoning_mode] || log.reasoning_mode}
        </Badge>
        <div className="ml-auto flex items-center gap-3 text-xs">
          {log.tasks_created > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {log.tasks_created}
            </span>
          )}
          {log.tasks_rejected > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="h-3.5 w-3.5" />
              {log.tasks_rejected}
            </span>
          )}
          {log.duration_ms && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(log.duration_ms)}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 pb-4 space-y-3">
          <ReasoningSection icon={Eye} title="Osservazione" content={log.observation} color="bg-blue-50/50 border-blue-200 text-blue-800" />
          <ReasoningSection icon={Lightbulb} title="Riflessione" content={log.reflection} color="bg-yellow-50/50 border-yellow-200 text-yellow-800" />
          <ReasoningSection icon={Target} title="Decisione" content={log.decision} color="bg-green-50/50 border-green-200 text-green-800" />
          <ReasoningSection icon={Shield} title="Auto-Revisione" content={log.self_review} color="bg-purple-50/50 border-purple-200 text-purple-800" />
          {log.overall_reasoning && (
            <ReasoningSection icon={Brain} title="Ragionamento Generale" content={log.overall_reasoning} color="bg-slate-50/50 border-slate-200 text-slate-800" />
          )}
          {log.reasoning_mode === "deep_think" && <ThinkingSteps steps={thinkingSteps} />}
          <TasksDataSection tasksData={log.tasks_data} />
          {log.total_tokens > 0 && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              <span>Token totali: {log.total_tokens?.toLocaleString("it-IT")}</span>
              {log.model_used && <span>Modello: {log.model_used}</span>}
              {log.provider_used && <span>Provider: {log.provider_used}</span>}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function ConsultantAIReasoning() {
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");

  const { data: logsData, isLoading: logsLoading } = useQuery<any>({
    queryKey: ["/api/ai-autonomy/reasoning-logs", `?page=${page}&limit=20${roleFilter !== "all" ? `&role=${roleFilter}` : ""}${modeFilter !== "all" ? `&mode=${modeFilter}` : ""}`],
  });

  const { data: statsData } = useQuery<any>({
    queryKey: ["/api/ai-autonomy/reasoning-stats"],
  });

  const logs = logsData?.logs || [];
  const pagination = logsData?.pagination || { page: 1, totalPages: 1, total: 0 };
  const stats = statsData?.stats || [];

  const totalRuns = stats.reduce((sum: number, s: any) => sum + parseInt(s.total_runs || "0"), 0);
  const totalCreated = stats.reduce((sum: number, s: any) => sum + parseInt(s.total_tasks_created || "0"), 0);
  const totalRejected = stats.reduce((sum: number, s: any) => sum + parseInt(s.total_tasks_rejected || "0"), 0);
  const avgDuration = stats.length > 0
    ? stats.reduce((sum: number, s: any) => sum + parseFloat(s.avg_duration_ms || "0"), 0) / stats.length
    : 0;

  const uniqueRoles = [...new Set(stats.map((s: any) => s.role_id))].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-violet-600" />
            Ragionamenti AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualizza il processo di ragionamento di ogni agente AI durante la generazione autonoma dei task.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tutti i ruoli" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i ruoli</SelectItem>
              {uniqueRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modeFilter} onValueChange={(v) => { setModeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tutte le modalità" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le modalità</SelectItem>
              <SelectItem value="structured">Strutturato</SelectItem>
              <SelectItem value="deep_think">Deep Think</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal">Esecuzioni Totali</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-violet-600" />
                <span className="text-2xl font-bold">{totalRuns}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal">Task Creati</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{totalCreated}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal">Task Rifiutati</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold">{totalRejected}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal">Durata Media</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">{formatDuration(avgDuration)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          {logsLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 animate-pulse" />
              Caricamento ragionamenti...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nessun ragionamento trovato
            </div>
          ) : (
            logs.map((log: any) => <LogEntry key={log.id} log={log} />)
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Precedente
            </Button>
            <span className="text-sm text-muted-foreground">
              Pagina {pagination.page} di {pagination.totalPages} ({pagination.total} totali)
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Successiva
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
