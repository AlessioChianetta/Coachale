import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, User, MessageSquare, Sparkles } from "lucide-react";
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
        const res = await fetch(`/api/ai-autonomy/tasks?limit=100&status=all`, {
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
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 min-h-[60px]">
                <div className="p-1.5 flex items-start justify-end pr-2 border-r border-border/50">
                  <span className="text-[10px] font-medium text-muted-foreground">
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
                        "border-l border-border/50 p-0.5 relative",
                        isToday && "bg-emerald-50/20 dark:bg-emerald-950/10"
                      )}
                    >
                      {cellTasks.map((task) => {
                        const colors = getColors(task.status);
                        return (
                          <Popover key={task.id}>
                            <PopoverTrigger asChild>
                              <button
                                className={cn(
                                  "w-full text-left p-1.5 rounded-md border text-[11px] leading-tight mb-0.5 transition-all hover:shadow-md cursor-pointer",
                                  colors.bg,
                                  colors.border
                                )}
                              >
                                {task.contact_name && (
                                  <p className={cn("font-semibold truncate", colors.text)}>
                                    {task.contact_name}
                                  </p>
                                )}
                                <p className="text-muted-foreground truncate">
                                  {task.ai_instruction?.slice(0, 40)}
                                  {(task.ai_instruction?.length || 0) > 40 && "…"}
                                </p>
                                {task.ai_role && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Sparkles className="h-2.5 w-2.5 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground capitalize">{task.ai_role}</span>
                                  </div>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0" align="start">
                              <div className="p-4 space-y-3">
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

                                <p className="text-sm text-foreground leading-relaxed">
                                  {task.ai_instruction}
                                </p>

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
