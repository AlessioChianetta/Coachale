import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, User, MessageSquare, Sparkles, Building2, Tag, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import type { AITask } from "../autonomy/types";

const DAY_LABELS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const DAY_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  waiting_approval: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  },
  scheduled: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  },
  completed: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  failed: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  },
  in_progress: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  },
};

const STATUS_LABELS: Record<string, string> = {
  waiting_approval: "In attesa",
  scheduled: "Programmato",
  completed: "Completato",
  failed: "Fallito",
  in_progress: "In corso",
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateShort(d: Date): string {
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function WhatsAppCalendar() {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ai-autonomy/tasks?limit=100&status=all&include_hunter=true`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Errore nel caricamento");
        const data = await res.json();
        if (!cancelled) {
          const whatsappTasks = data.tasks.filter((t: AITask) => t.preferred_channel === "whatsapp");
          setTasks(whatsappTasks);
        }
      } catch {
        if (!cancelled) {
          toast({ title: "Errore", description: "Impossibile caricare i task WhatsApp", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTasks();
    return () => { cancelled = true; };
  }, [weekStart]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const tasksByDayAndHour = useMemo(() => {
    const map: Record<string, AITask[]> = {};
    tasks.forEach((task) => {
      if (!task.scheduled_at) return;
      const dt = new Date(task.scheduled_at);
      const dayIdx = weekDays.findIndex((wd) => isSameDay(wd, dt));
      if (dayIdx === -1) return;
      const hour = dt.getHours();
      if (hour < 8 || hour > 19) return;
      const key = `${dayIdx}-${hour}`;
      if (!map[key]) map[key] = [];
      map[key].push(task);
    });
    return map;
  }, [tasks, weekDays]);

  const hasAnyTask = useMemo(() => {
    return Object.keys(tasksByDayAndHour).length > 0;
  }, [tasksByDayAndHour]);

  const today = new Date();

  const goToday = () => setWeekStart(getMonday(new Date()));
  const goPrev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const goNext = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const getColors = (status: string) => STATUS_COLORS[status] || STATUS_COLORS.scheduled;

  return (
    <Card className="border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border bg-gradient-to-r from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
              <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Calendario WhatsApp</h3>
              <p className="text-xs text-muted-foreground">
                {formatDateShort(weekStart)} — {formatDateShort(weekEnd)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goPrev} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs px-3">
              Oggi
            </Button>
            <Button variant="outline" size="sm" onClick={goNext} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Caricamento...</span>
          </div>
        </div>
      ) : !hasAnyTask ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="p-3 rounded-full bg-muted/50">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">Nessun messaggio WhatsApp programmato</p>
          <p className="text-xs text-muted-foreground/70">per questa settimana</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
              <div className="p-2" />
              {weekDays.map((day, idx) => {
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={idx}
                    className={cn(
                      "p-2 text-center border-l border-border",
                      isToday && "bg-emerald-50/50 dark:bg-emerald-950/20"
                    )}
                  >
                    <p className={cn(
                      "text-xs font-medium",
                      isToday ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    )}>
                      {DAY_SHORT[idx]}
                    </p>
                    <p className={cn(
                      "text-sm font-semibold",
                      isToday ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                    )}>
                      {day.getDate()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{DAY_LABELS[idx]}</p>
                  </div>
                );
              })}
            </div>

            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50" style={{ minHeight: "48px" }}>
                <div className="p-1 flex items-start justify-end pr-2 border-r border-border/50">
                  <span className="text-[10px] font-medium text-muted-foreground mt-0.5">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                </div>
                {weekDays.map((day, dayIdx) => {
                  const key = `${dayIdx}-${hour}`;
                  const cellTasks = tasksByDayAndHour[key] || [];
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={dayIdx}
                      className={cn(
                        "border-l border-border/50 p-0.5 relative overflow-hidden",
                        isToday && "bg-emerald-50/20 dark:bg-emerald-950/10"
                      )}
                      style={{ maxHeight: cellTasks.length > 2 ? "96px" : undefined, overflowY: cellTasks.length > 2 ? "auto" : undefined }}
                    >
                      {cellTasks.map((task) => {
                        const isHunter = task.ai_role === 'hunter';
                        const colors = isHunter
                          ? { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-700 dark:text-teal-400", border: "border-teal-200 dark:border-teal-800", badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300" }
                          : getColors(task.status);
                        return (
                          <Popover key={task.id}>
                            <PopoverTrigger asChild>
                              <button
                                className={cn(
                                  "w-full text-left px-1.5 py-1 rounded border text-[10px] leading-none mb-0.5 transition-all hover:shadow-sm cursor-pointer flex items-center gap-1.5 min-h-0",
                                  colors.bg,
                                  colors.border
                                )}
                              >
                                {isHunter && <span className="text-[9px] shrink-0">🎯</span>}
                                <span className={cn("font-semibold truncate shrink-0 max-w-[50%]", colors.text)}>
                                  {task.contact_name || task.contact_phone || "—"}
                                </span>
                                {task.ai_role && (
                                  <span className={cn("text-[9px] capitalize shrink-0", isHunter ? "text-teal-500 font-medium" : "text-muted-foreground")}>
                                    {task.ai_role}
                                  </span>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0 max-h-[70vh] flex flex-col" align="start">
                              <div className="p-4 space-y-3 overflow-y-auto min-h-0">
                                {(() => {
                                  let ctx: any = {};
                                  try { ctx = typeof task.additional_context === 'string' ? JSON.parse(task.additional_context) : (task.additional_context || {}); } catch {}
                                  const waTemplateName = ctx.wa_template_name || null;
                                  const waTemplateSid = ctx.wa_template_sid || null;
                                  const waTemplateFilled = ctx.wa_template_filled || null;
                                  const waTemplateVars = ctx.wa_template_variables || null;

                                  const businessName = (ctx.business_name || '').trim() || null;
                                  const sector = (ctx.sector || '').trim() || null;
                                  const rawScore = ctx.lead_score;
                                  const leadScore = typeof rawScore === 'number' ? rawScore : (typeof rawScore === 'string' && rawScore.trim() !== '' && !isNaN(Number(rawScore)) ? Number(rawScore) : null);
                                  const hasLeadContext = Boolean(businessName || sector || leadScore !== null);

                                  const stripConsultantCtx = (text: string) => {
                                    const marker = '━━━ CONSULENTE ━━━';
                                    const idx = text.indexOf(marker);
                                    if (idx >= 0) {
                                      const part = text.substring(0, idx).trim();
                                      return part || '';
                                    }
                                    return text;
                                  };
                                  const leadInstruction = task.ai_instruction ? stripConsultantCtx(task.ai_instruction) : '';

                                  return (
                                    <>
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <MessageSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                                          <span className="font-semibold text-sm truncate">
                                            {task.contact_name || "Contatto"}
                                          </span>
                                        </div>
                                        <Badge className={cn("text-[10px] shrink-0", colors.badge)} variant="secondary">
                                          {STATUS_LABELS[task.status] || task.status}
                                        </Badge>
                                      </div>

                                      {hasLeadContext && (
                                        <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30 space-y-1.5">
                                          <p className="text-[10px] uppercase font-semibold text-indigo-700 dark:text-indigo-400">Contesto Lead</p>
                                          <div className="space-y-1">
                                            {businessName && (
                                              <div className="flex items-center gap-1.5">
                                                <Building2 className="h-3 w-3 text-indigo-500 shrink-0" />
                                                <span className="text-xs font-medium text-foreground">{businessName}</span>
                                              </div>
                                            )}
                                            {sector && (
                                              <div className="flex items-center gap-1.5">
                                                <Tag className="h-3 w-3 text-indigo-400 shrink-0" />
                                                <span className="text-xs text-foreground/80">{sector}</span>
                                              </div>
                                            )}
                                            {leadScore !== null && (
                                              <div className="flex items-center gap-1.5">
                                                <TrendingUp className="h-3 w-3 text-indigo-400 shrink-0" />
                                                <span className="text-xs text-foreground/80">Score:</span>
                                                <Badge className={cn("text-[10px] px-1.5 py-0",
                                                  leadScore >= 7 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                                                    : leadScore >= 4 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                                                    : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                                                )} variant="secondary">{leadScore}/10</Badge>
                                              </div>
                                            )}
                                          </div>
                                          {leadInstruction && (
                                            <details className="mt-1">
                                              <summary className="text-[10px] text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline flex items-center gap-1">
                                                Analisi completa
                                              </summary>
                                              <div className="mt-1.5 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto p-2 rounded bg-white/50 dark:bg-gray-900/50 border border-indigo-100 dark:border-indigo-900/30">
                                                {leadInstruction}
                                              </div>
                                            </details>
                                          )}
                                        </div>
                                      )}

                                      {waTemplateName && (
                                        <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 space-y-1.5">
                                          <div className="flex items-center gap-2">
                                            <p className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400">Template</p>
                                            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">{waTemplateName}</span>
                                          </div>
                                          {waTemplateSid && (
                                            <p className="text-[10px] text-muted-foreground font-mono">SID: {waTemplateSid}</p>
                                          )}
                                          {waTemplateVars && Object.keys(waTemplateVars).length > 0 && (
                                            <div className="space-y-0.5">
                                              <p className="text-[10px] text-muted-foreground font-medium">Variabili Twilio:</p>
                                              <div className="flex flex-wrap gap-1">
                                                {Object.entries(waTemplateVars).map(([pos, val]) => (
                                                  <span key={pos} className="font-mono bg-white dark:bg-gray-800 text-foreground/80 px-1.5 py-0.5 rounded text-[10px] border border-emerald-200 dark:border-emerald-800/50">
                                                    {`{{${pos}}}`} = {String(val)}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      <div>
                                        <p className="text-[10px] uppercase font-medium text-muted-foreground mb-1">
                                          {waTemplateFilled ? "Messaggio finale che leggerà il contatto" : "Contenuto messaggio"}
                                        </p>
                                        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto p-2 rounded-md bg-muted/30 border border-border/30">
                                          {waTemplateFilled || task.ai_instruction}
                                        </div>
                                      </div>

                                      {task.scheduling_reason && (
                                        <div className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
                                          <p className="text-[10px] uppercase font-medium text-muted-foreground mb-1">Motivo pianificazione</p>
                                          <p className="text-xs text-foreground/80">{task.scheduling_reason}</p>
                                        </div>
                                      )}

                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        {task.ai_role && (
                                          <div className="flex items-center gap-1.5">
                                            <Sparkles className="h-3 w-3 text-purple-500" />
                                            <span className="text-muted-foreground">Agente:</span>
                                            <span className="font-medium capitalize">{task.ai_role}</span>
                                          </div>
                                        )}
                                        {task.contact_phone && (
                                          <div className="flex items-center gap-1.5">
                                            <User className="h-3 w-3 text-blue-500" />
                                            <span className="text-muted-foreground truncate">{task.contact_phone}</span>
                                          </div>
                                        )}
                                        {task.scheduled_at && (
                                          <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3 text-amber-500" />
                                            <span className="text-muted-foreground">
                                              {new Date(task.scheduled_at).toLocaleString("it-IT", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </span>
                                          </div>
                                        )}
                                        {task.scheduled_by && (
                                          <div className="flex items-center gap-1.5">
                                            <User className="h-3 w-3 text-indigo-500" />
                                            <span className="text-muted-foreground">Da:</span>
                                            <span className="font-medium">{task.scheduled_by}</span>
                                          </div>
                                        )}
                                      </div>

                                      {task.ai_reasoning && (
                                        <div className="pt-2 border-t border-border/50">
                                          <p className="text-[10px] uppercase font-medium text-muted-foreground mb-1">Ragionamento AI</p>
                                          <p className="text-xs text-muted-foreground leading-relaxed">{task.ai_reasoning}</p>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
