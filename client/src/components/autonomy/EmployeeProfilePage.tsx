import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ListTodo, TrendingUp, Clock, FileText,
  CheckCircle, XCircle, Loader2, User, Zap, ShieldAlert,
  Activity, Bot
} from "lucide-react";
import { AI_ROLE_PROFILES, AI_ROLE_ACCENT_COLORS, AI_ROLE_CAPABILITIES } from "./constants";
import { getRelativeTime, getActivityIcon, getTaskStatusBadge } from "./utils";

const ROLE_COLORS: Record<string, string> = {
  alessia: 'pink',
  millie: 'purple',
  echo: 'orange',
  nova: 'emerald',
  stella: 'teal',
  marco: 'gray',
  personalizza: 'gray',
};

const ROLE_GRADIENT: Record<string, string> = {
  pink: "from-pink-500 to-rose-400",
  purple: "from-purple-500 to-violet-400",
  orange: "from-orange-500 to-amber-400",
  emerald: "from-emerald-500 to-green-400",
  teal: "from-teal-500 to-cyan-400",
  indigo: "from-indigo-500 to-blue-400",
  gray: "from-gray-500 to-slate-400",
};

const ROLE_BG: Record<string, string> = {
  pink: "bg-pink-50 dark:bg-pink-950/20",
  purple: "bg-purple-50 dark:bg-purple-950/20",
  orange: "bg-orange-50 dark:bg-orange-950/20",
  emerald: "bg-emerald-50 dark:bg-emerald-950/20",
  teal: "bg-teal-50 dark:bg-teal-950/20",
  indigo: "bg-indigo-50 dark:bg-indigo-950/20",
  gray: "bg-gray-50 dark:bg-gray-950/20",
};

const ROLE_TEXT: Record<string, string> = {
  pink: "text-pink-600 dark:text-pink-400",
  purple: "text-purple-600 dark:text-purple-400",
  orange: "text-orange-600 dark:text-orange-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  teal: "text-teal-600 dark:text-teal-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  gray: "text-gray-600 dark:text-gray-400",
};

export default function EmployeeProfilePage({ roleId: propRoleId }: { roleId?: string }) {
  const params = useParams<{ roleId: string }>();
  const roleId = propRoleId || params.roleId || '';
  const [, setLocation] = useLocation();
  const profile = AI_ROLE_PROFILES[roleId];
  const caps = AI_ROLE_CAPABILITIES[roleId];
  const accentColor = ROLE_COLORS[roleId] || 'gray';
  const colors = AI_ROLE_ACCENT_COLORS[accentColor] || AI_ROLE_ACCENT_COLORS.gray;

  const { data, isLoading } = useQuery({
    queryKey: ["employee-profile", roleId],
    queryFn: async () => {
      const res = await fetch(`/api/ai-autonomy/employee-profile/${roleId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!roleId,
  });

  const { data: rolesStatus } = useQuery({
    queryKey: ["roles-status"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/roles/status", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch roles status");
      return res.json();
    },
    enabled: !!roleId,
  });

  const isRoleActive = rolesStatus?.roles?.find((r: any) => r.id === roleId)?.isActive ?? false;

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Bot className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Profilo non trovato</p>
        <Button variant="ghost" className="mt-4" onClick={() => setLocation("/consultant/ai-autonomy")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla dashboard
        </Button>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentTasks = data?.recent_tasks || [];
  const activity = data?.activity || [];
  const docsCount = data?.documents_generated || 0;
  const gradient = ROLE_GRADIENT[accentColor] || ROLE_GRADIENT.gray;
  const bgClass = ROLE_BG[accentColor] || ROLE_BG.gray;
  const textClass = ROLE_TEXT[accentColor] || ROLE_TEXT.gray;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/consultant/ai-autonomy")}
        className="mb-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla dashboard
      </Button>

      <div className={cn("relative rounded-2xl border overflow-hidden", colors.border)}>
        <div className={cn("absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r", gradient)} />
        <div className="p-6 flex items-center gap-6">
          <div className={cn("w-20 h-20 rounded-full overflow-hidden ring-4 shrink-0", colors.ring)}>
            {profile.avatar ? (
              <img src={profile.avatar} alt={roleId} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-2xl">
                {roleId === 'personalizza' ? '⚙️' : '🤖'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{roleId.charAt(0).toUpperCase() + roleId.slice(1)}</h1>
              <Badge className={cn("text-xs rounded-lg", colors.badge)}>
                {profile.role}
              </Badge>
              {isRoleActive ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs">● Attivo</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">○ Inattivo</Badge>
              )}
            </div>
            {profile.quote && (
              <p className="text-sm text-muted-foreground mt-2 italic">"{profile.quote}"</p>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", bgClass)}>
                    <ListTodo className={cn("h-5 w-5", textClass)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total || 0}</p>
                    <p className="text-xs text-muted-foreground">Task Totali</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", bgClass)}>
                    <TrendingUp className={cn("h-5 w-5", textClass)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.success_rate || 0}%</p>
                    <p className="text-xs text-muted-foreground">Tasso Successo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", bgClass)}>
                    <Clock className={cn("h-5 w-5", textClass)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.avg_minutes || '—'}</p>
                    <p className="text-xs text-muted-foreground">Min. Medi</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", bgClass)}>
                    <FileText className={cn("h-5 w-5", textClass)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{docsCount}</p>
                    <p className="text-xs text-muted-foreground">Documenti</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {caps && (
            <Card className="border rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Capacità</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Cosa può fare
                    </h4>
                    <ul className="space-y-2">
                      {caps.canDo.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span>{item.icon}</span>
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" /> Limitazioni
                    </h4>
                    <ul className="space-y-2">
                      {caps.cantDo.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span>{item.icon}</span>
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <Zap className="h-4 w-4" /> Workflow
                  </h4>
                  <p className="text-sm text-muted-foreground">{caps.workflow}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {recentTasks.length > 0 && (
            <Card className="border rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Task Recenti</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-4 py-2 font-medium">Stato</th>
                          <th className="px-4 py-2 font-medium">Categoria</th>
                          <th className="px-4 py-2 font-medium">Cliente</th>
                          <th className="px-4 py-2 font-medium">Istruzione</th>
                          <th className="px-4 py-2 font-medium">Data</th>
                          <th className="px-4 py-2 font-medium">Modalità</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTasks.map((task: any) => (
                          <tr
                            key={task.id}
                            className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => setLocation(`/consultant/ai-autonomy?task=${task.id}`)}
                          >
                            <td className="px-4 py-2.5">{getTaskStatusBadge(task.status)}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className="text-xs capitalize">{task.task_category || '—'}</Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              {task.contact_name ? (
                                <span className="flex items-center gap-1 text-xs">
                                  <User className="h-3 w-3" /> {task.contact_name}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground text-xs">
                              {task.ai_instruction || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {getRelativeTime(task.created_at)}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className="text-[10px]">
                                {task.execution_mode === 'autonomous' ? 'Autonomo' : 'Assistito'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {activity.length > 0 && (
            <Card className="border rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Attività Recente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="relative pl-6 space-y-0">
                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                    {activity.map((item: any, i: number) => (
                      <div key={item.id || i} className="relative flex gap-3 py-3">
                        <div className={cn(
                          "absolute left-[-13px] top-4 w-6 h-6 rounded-full flex items-center justify-center border-2 border-background z-10",
                          item.severity === 'error' ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" :
                          item.severity === 'success' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" :
                          item.severity === 'warning' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" :
                          "bg-primary/10 text-primary"
                        )}>
                          {getActivityIcon(item.icon || 'brain')}
                        </div>
                        <div className="flex-1 min-w-0 ml-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{item.title}</span>
                            {item.contact_name && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {item.contact_name}
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                          )}
                          <span className="text-[10px] text-muted-foreground mt-1 block">
                            {getRelativeTime(item.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {recentTasks.length === 0 && activity.length === 0 && (
            <Card className="border rounded-xl">
              <CardContent className="py-12 text-center">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">Nessuna attività registrata per questo agente.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
