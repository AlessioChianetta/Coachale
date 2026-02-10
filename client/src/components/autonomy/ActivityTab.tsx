import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, Brain, Clock, CheckCircle, Loader2, Eye, ChevronLeft, ChevronRight,
  Zap, BarChart3, Sparkles, Lightbulb, Bot, Calendar, Play, Database, FileText, Search
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { ActivityResponse, ActivityItem } from "./types";
import { getActivityIcon, getSeverityBadge, getRelativeTime } from "./utils";
import { AI_ROLE_PROFILES, AI_ROLE_ACCENT_COLORS } from "./constants";

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
  reasoningData: ActivityResponse | undefined;
  loadingReasoning: boolean;
  reasoningPage: number;
  setReasoningPage: (page: number) => void;
  reasoningPeriod: string;
  setReasoningPeriod: (period: string) => void;
  reasoningRole: string;
  setReasoningRole: (role: string) => void;
  simulationResult: any;
  setSimulationResult: (result: any) => void;
  simulationLoading: boolean;
  setSimulationLoading: (loading: boolean) => void;
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
  reasoningData, loadingReasoning, reasoningPage, setReasoningPage,
  reasoningPeriod, setReasoningPeriod, reasoningRole, setReasoningRole,
  simulationResult, setSimulationResult, simulationLoading, setSimulationLoading,
}: ActivityTabProps) {
  const { toast } = useToast();

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
              {activityData.activities.map((item) => (
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
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
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
              ))}
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
          <div className="flex flex-wrap items-center gap-2">
            <Select value={reasoningPeriod} onValueChange={(v) => { setReasoningPeriod(v); setReasoningPage(1); }}>
              <SelectTrigger className="w-[150px] h-9 text-sm rounded-xl">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i periodi</SelectItem>
                <SelectItem value="today">Oggi</SelectItem>
                <SelectItem value="week">Ultima settimana</SelectItem>
                <SelectItem value="month">Ultimo mese</SelectItem>
              </SelectContent>
            </Select>
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
            {(reasoningPeriod !== 'all' || reasoningRole !== 'all') && (
              <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setReasoningPeriod('all'); setReasoningRole('all'); setReasoningPage(1); }}>
                Rimuovi filtri
              </Button>
            )}
          </div>
          {loadingReasoning ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !reasoningData?.activities?.length ? (
            <Card className="border border-border rounded-xl shadow-sm">
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Nessuna analisi ancora.</p>
                <p className="text-xs text-muted-foreground mt-1">Quando i dipendenti AI analizzano i tuoi dati, qui vedrai il loro ragionamento completo.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {(() => {
                const grouped: Record<string, any[]> = {};
                for (const item of reasoningData.activities) {
                  const d = new Date(item.created_at);
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  let label: string;
                  if (d.toDateString() === today.toDateString()) {
                    label = 'Oggi';
                  } else if (d.toDateString() === yesterday.toDateString()) {
                    label = 'Ieri';
                  } else {
                    label = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    label = label.charAt(0).toUpperCase() + label.slice(1);
                  }
                  if (!grouped[label]) grouped[label] = [];
                  grouped[label].push(item);
                }

                return Object.entries(grouped).map(([dateLabel, items]) => {
                  const totalTasks = items.reduce((sum, item) => {
                    let ed: any = {};
                    try { ed = typeof item.event_data === 'string' ? JSON.parse(item.event_data) : (item.event_data || {}); } catch { ed = {}; }
                    const sug = Array.isArray(ed.suggestions) ? ed.suggestions : [];
                    return sum + sug.length;
                  }, 0);

                  return (
                    <div key={dateLabel} className="space-y-3">
                      <div className="flex items-center gap-3 pt-2">
                        <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold">{dateLabel}</span>
                        </div>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground shrink-0">{items.length} analisi &middot; {totalTasks} task</span>
                      </div>

                      {items.map((item: any) => {
                        let eventData: any = {};
                        try {
                          eventData = typeof item.event_data === 'string' ? JSON.parse(item.event_data) : (item.event_data || {});
                        } catch { eventData = {}; }
                        const suggestions = Array.isArray(eventData.suggestions) ? eventData.suggestions : [];
                        const roleId = item.ai_role || eventData.ai_role || '';
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

                                {eventData.overall_reasoning && (
                                  <div className="rounded-xl border bg-muted/20 p-4">
                                    <p className="text-xs font-bold mb-2 flex items-center gap-1.5">
                                      <Brain className="h-3.5 w-3.5" />
                                      Cosa ha pensato
                                    </p>
                                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                                      {eventData.overall_reasoning}
                                    </p>
                                  </div>
                                )}

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
                                      <Sparkles className="h-3.5 w-3.5" />
                                      Azioni decise ({suggestions.length})
                                    </p>
                                    {suggestions.map((s: any, idx: number) => (
                                      <div key={idx} className="rounded-xl border p-3 bg-card">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{s.client_name || 'N/A'}</span>
                                            {s.channel && s.channel !== 'none' && (
                                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                {s.channel === 'voice' ? '📞 Chiamata' : s.channel === 'email' ? '📧 Email' : '💬 WhatsApp'}
                                              </Badge>
                                            )}
                                          </div>
                                          {s.priority && (
                                            <Badge className={cn("text-[10px]",
                                              s.priority === 1 ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400" :
                                              s.priority === 2 ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400" :
                                              "bg-muted text-muted-foreground"
                                            )}>
                                              {s.priority === 1 ? 'Urgente' : s.priority === 2 ? 'Alta' : 'Normale'}
                                            </Badge>
                                          )}
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
                      })}
                    </div>
                  );
                });
              })()}

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
            </>
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
                            Cosa ha pensato
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                            {role.aiResponse.overallReasoning}
                          </p>
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
                            Dati analizzati (dettaglio tecnico)
                          </summary>
                          <pre className="mt-2 p-2 bg-muted/30 rounded-xl text-[10px] overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {JSON.stringify(role.dataAnalyzed.roleSpecificData, null, 2)}
                          </pre>
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
    </div>
  );
}

export default ActivityTab;
