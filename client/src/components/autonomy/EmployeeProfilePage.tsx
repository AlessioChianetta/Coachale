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
  Activity, Bot, Sparkles
} from "lucide-react";
import { AI_ROLE_PROFILES, AI_ROLE_ACCENT_COLORS, AI_ROLE_CAPABILITIES, AI_ROLE_EXAMPLES, CAPABILITY_CATEGORY_META, type CapabilityCategory } from "./constants";
import { getRelativeTime, getActivityIcon, getTaskStatusBadge } from "./utils";

const ROLE_COLORS: Record<string, string> = {
  alessia: 'pink',
  millie: 'purple',
  echo: 'orange',
  nova: 'emerald',
  stella: 'teal',
  marco: 'gray',
  robert: 'amber',
  hunter: 'indigo',
  architetto: 'violet',
  personalizza: 'gray',
};

const ROLE_GRADIENT: Record<string, string> = {
  pink: "from-pink-500 to-rose-400",
  purple: "from-purple-500 to-violet-400",
  orange: "from-orange-500 to-amber-400",
  emerald: "from-emerald-500 to-green-400",
  teal: "from-teal-500 to-cyan-400",
  indigo: "from-indigo-500 to-blue-400",
  violet: "from-violet-500 to-purple-400",
  amber: "from-amber-500 to-yellow-400",
  gray: "from-gray-500 to-slate-400",
};

const ROLE_BG: Record<string, string> = {
  pink: "bg-pink-50 dark:bg-pink-950/20",
  purple: "bg-purple-50 dark:bg-purple-950/20",
  orange: "bg-orange-50 dark:bg-orange-950/20",
  emerald: "bg-emerald-50 dark:bg-emerald-950/20",
  teal: "bg-teal-50 dark:bg-teal-950/20",
  indigo: "bg-indigo-50 dark:bg-indigo-950/20",
  violet: "bg-violet-50 dark:bg-violet-950/20",
  amber: "bg-amber-50 dark:bg-amber-950/20",
  gray: "bg-gray-50 dark:bg-gray-950/20",
};

const ROLE_TEXT: Record<string, string> = {
  pink: "text-pink-600 dark:text-pink-400",
  purple: "text-purple-600 dark:text-purple-400",
  orange: "text-orange-600 dark:text-orange-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  teal: "text-teal-600 dark:text-teal-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  violet: "text-violet-600 dark:text-violet-400",
  amber: "text-amber-600 dark:text-amber-400",
  gray: "text-gray-600 dark:text-gray-400",
};

export default function EmployeeProfilePage({ roleId: propRoleId }: { roleId?: string }) {
  const params = useParams<{ roleId: string }>();
  const roleId = propRoleId || params.roleId || '';
  const [, setLocation] = useLocation();
  const profile = AI_ROLE_PROFILES[roleId];
  const agentName = roleId ? roleId.charAt(0).toUpperCase() + roleId.slice(1) : '';
  const caps = AI_ROLE_CAPABILITIES[roleId];
  const examples = AI_ROLE_EXAMPLES[roleId] || [];
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
    <div className="min-h-screen bg-background">
      <div className={cn(
        "sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm",
        "px-4 h-14 flex items-center gap-3"
      )}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-sm font-medium shrink-0"
          onClick={() => setLocation("/consultant/ai-autonomy")}
        >
          <ArrowLeft className="h-4 w-4" />
          Indietro
        </Button>
        <div className="w-px h-5 bg-border/60 shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          {profile.avatar ? (
            <img src={profile.avatar} alt={roleId} className="w-6 h-6 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs shrink-0">
              {roleId === 'personalizza' ? '⚙️' : '🤖'}
            </div>
          )}
          <span className="text-sm font-semibold truncate">{agentName}</span>
          <span className="text-xs text-muted-foreground truncate hidden sm:block">{profile.role}</span>
        </div>
        {isRoleActive ? (
          <Badge className="ml-auto shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] px-2 py-0.5">● Attivo</Badge>
        ) : (
          <Badge variant="secondary" className="ml-auto shrink-0 text-[10px] px-2 py-0.5">○ Inattivo</Badge>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
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
                <h1 className="text-2xl font-bold">{agentName}</h1>
                <Badge className={cn("text-xs rounded-lg", colors.badge)}>
                  {profile.role}
                </Badge>
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
                  {(["comunicazione", "analisi", "organizzazione"] as CapabilityCategory[]).map((cat) => {
                    const meta = CAPABILITY_CATEGORY_META[cat];
                    const canItems = caps.canDo.filter(i => i.category === cat);
                    const cantItems = caps.cantDo.filter(i => i.category === cat);
                    if (canItems.length === 0 && cantItems.length === 0) return null;
                    return (
                      <div key={cat}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <span>{meta.icon}</span>
                          {meta.label}
                        </p>
                        <div className="grid md:grid-cols-2 gap-1">
                          {canItems.map((item, i) => (
                            <div key={`can-${i}`} className="flex items-start gap-2 text-sm py-1">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{item.icon}</span>
                              <span>{item.text}</span>
                            </div>
                          ))}
                          {cantItems.map((item, i) => (
                            <div key={`cant-${i}`} className="flex items-start gap-2 text-sm py-1 text-muted-foreground">
                              <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                              <span>{item.icon}</span>
                              <span>{item.text}</span>
                            </div>
                          ))}
                        </div>
                        <Separator className="mt-3" />
                      </div>
                    );
                  })}
                  <div>
                    <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                      <Zap className="h-4 w-4" /> Workflow
                    </h4>
                    <p className="text-sm text-muted-foreground">{caps.workflow}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {examples.length > 0 && (
              <Card className="border rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Esempi Reali
                    <span className="text-xs font-normal text-muted-foreground">— scenari concreti che questo agente gestisce per te</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {examples.map((ex, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border/50 bg-muted/20 p-4 flex flex-col gap-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0",
                            bgClass
                          )}>
                            {ex.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-snug">{ex.title}</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{ex.scenario}</p>
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-medium px-2.5 py-1 w-fit flex items-center gap-1.5 rounded-lg">
                          <CheckCircle className="h-3 w-3 shrink-0" />
                          {ex.outcome}
                        </Badge>
                      </div>
                    ))}
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
    </div>
  );
}
