import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, addWeeks, subWeeks, addMonths, subMonths, getDay, isToday } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { Phone, CalendarDays, Users, DollarSign, TrendingUp, Bot, Loader2, ChevronLeft, ChevronRight, Save, BarChart3, FileText, Target, ChevronDown, Send, Trash2, User, Sparkles, MessageCircle, X } from "lucide-react";

interface SalesReport {
  id: string;
  userId: string;
  date: string;
  calls: number;
  discoBooked: number;
  discoScheduled: number;
  discoShowed: number;
  demoBooked: number;
  demoScheduled: number;
  demoShowed: number;
  depositsAmount: string;
  contractsClosed: number;
  contractsAmount: string;
  notes: string | null;
}

interface SalesGoal {
  id: string;
  metric: string;
  targetValue: string;
  periodType: string;
  periodValue: string;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface SalesReportTabProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const emptyReport = {
  calls: 0,
  discoBooked: 0,
  discoScheduled: 0,
  discoShowed: 0,
  demoBooked: 0,
  demoScheduled: 0,
  demoShowed: 0,
  depositsAmount: "0",
  contractsClosed: 0,
  contractsAmount: "0",
  notes: "",
};

function SafeMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeSanitize]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h3>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/30 pl-3 my-2 italic text-muted-foreground">{children}</blockquote>,
        code: ({ children }) => (
          <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
        ),
        hr: () => <hr className="my-3 border-border/50" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function sumReports(reports: SalesReport[]) {
  const totals = { calls: 0, discoBooked: 0, discoScheduled: 0, discoShowed: 0, demoBooked: 0, demoScheduled: 0, demoShowed: 0, depositsAmount: 0, contractsClosed: 0, contractsAmount: 0 };
  for (const r of reports) {
    totals.calls += r.calls;
    totals.discoBooked += r.discoBooked;
    totals.discoScheduled += r.discoScheduled;
    totals.discoShowed += r.discoShowed;
    totals.demoBooked += r.demoBooked;
    totals.demoScheduled += r.demoScheduled;
    totals.demoShowed += r.demoShowed;
    totals.depositsAmount += parseFloat(r.depositsAmount || "0");
    totals.contractsClosed += r.contractsClosed;
    totals.contractsAmount += parseFloat(r.contractsAmount || "0");
  }
  return totals;
}

const GOAL_METRICS = [
  { key: "calls", label: "Call Effettuate", icon: Phone, color: "text-blue-500" },
  { key: "discoBooked", label: "Discovery Prenotate", icon: CalendarDays, color: "text-green-500" },
  { key: "demoBooked", label: "Demo Prenotate", icon: Users, color: "text-purple-500" },
  { key: "contractsClosed", label: "Contratti Chiusi", icon: TrendingUp, color: "text-amber-500" },
  { key: "contractsAmount", label: "Importo Contratti (€)", icon: DollarSign, color: "text-emerald-500" },
];

function SalesGoalsSection({ monthReports, monthDate, dailyReports, selectedDate }: { monthReports: SalesReport[]; monthDate: Date; dailyReports?: SalesReport[]; selectedDate?: Date }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);
  const [goalType, setGoalType] = useState<"monthly" | "daily">("monthly");
  const periodValue = goalType === "monthly" ? format(monthDate, "yyyy-MM") : format(selectedDate || new Date(), "yyyy-MM-dd");
  const currentReports = goalType === "monthly" ? monthReports : (dailyReports || []);
  const totals = sumReports(currentReports);

  const { data: goals = [] } = useQuery<SalesGoal[]>({
    queryKey: ["/api/sales-goals", goalType, periodValue],
    queryFn: async () => {
      const res = await fetch(`/api/sales-goals?periodType=${goalType}&periodValue=${periodValue}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const goalMap = new Map(goals.map(g => [g.metric, parseFloat(g.targetValue)]));

  const saveGoal = async (metric: string, targetValue: number) => {
    try {
      const res = await fetch("/api/sales-goals", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ periodType: goalType, periodValue, metric, targetValue }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/sales-goals", goalType, periodValue] });
      toast({ title: "Obiettivo salvato" });
    } catch {
      toast({ title: "Errore", description: "Impossibile salvare l'obiettivo", variant: "destructive" });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-500" />
                Obiettivi {goalType === "monthly" ? "Mensili" : "Giornalieri"} — {goalType === "monthly" ? format(monthDate, "MMMM yyyy", { locale: it }) : format(selectedDate || new Date(), "d MMMM yyyy", { locale: it })}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-2">
              <Button variant={goalType === "daily" ? "default" : "outline"} size="sm" onClick={(e) => { e.stopPropagation(); setGoalType("daily"); }}>
                Giornalieri
              </Button>
              <Button variant={goalType === "monthly" ? "default" : "outline"} size="sm" onClick={(e) => { e.stopPropagation(); setGoalType("monthly"); }}>
                Mensili
              </Button>
            </div>
            {GOAL_METRICS.map(m => {
              const current = m.key === "contractsAmount" ? totals.contractsAmount : (totals as any)[m.key];
              const target = goalMap.get(m.key) || 0;
              const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
              const displayCurrent = m.key === "contractsAmount" ? `€${current.toFixed(0)}` : current;
              const displayTarget = m.key === "contractsAmount" ? `€${target.toFixed(0)}` : target;

              return (
                <div key={m.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <m.icon className={`w-4 h-4 ${m.color}`} />
                      <span className="text-sm font-medium">{m.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {displayCurrent} / {target > 0 ? displayTarget : "—"}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={m.key === "contractsAmount" ? "100" : "1"}
                        className="w-20 h-7 text-xs text-right"
                        placeholder="Target"
                        defaultValue={target > 0 ? target : ""}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            saveGoal(m.key, val);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    </div>
                  </div>
                  <Progress value={progress} className="h-2" />
                  {target > 0 && (
                    <p className="text-xs text-muted-foreground text-right">
                      {progress.toFixed(0)}% completato
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

const CHAT_SUGGESTIONS = [
  "Come stanno andando le mie vendite?",
  "Analizza il mio funnel di conversione",
  "Dammi un piano d'azione per questa settimana",
  "Quali sono i miei punti deboli?",
];

export function SalesChatPanel({ onClose, getAiRange }: { onClose: () => void; getAiRange: () => { startDate: string; endDate: string } }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sales-chat/messages?limit=50", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Failed to fetch sales chat messages:", err);
    } finally {
      setLoading(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || sending) return;

    const tempMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setInput("");
    setSending(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/sales-chat/send", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          id: data.message.id,
          role: "assistant",
          content: data.message.content,
          created_at: data.message.created_at || new Date().toISOString(),
        }]);
        scrollToBottom();
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: "assistant",
          content: `Errore: ${errData.error || 'Riprova tra poco'}`,
          created_at: new Date().toISOString(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: "Errore di connessione. Riprova.",
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    if (!confirm("Vuoi cancellare tutta la chat con il Sales Coach?")) return;
    try {
      const res = await fetch("/api/sales-chat/clear", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to clear chat:", err);
    }
  };

  const handleAnalyze = () => {
    const range = getAiRange();
    sendMessage(`Analizza le mie performance di vendita dal ${range.startDate} al ${range.endDate}. Dammi un feedback completo con punti di forza, aree di miglioramento, e obiettivi suggeriti.`);
  };

  return (
    <div className="w-full h-full flex flex-col border-l bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-violet-500/10 to-transparent">
          <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Sales Coach AI</h3>
            <p className="text-xs text-muted-foreground">Chat diretta</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleAnalyze} disabled={sending}>
              <BarChart3 className="w-3.5 h-3.5" />
              Analizza
            </Button>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearChat} title="Cancella chat">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Bot className="w-6 h-6 text-violet-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium mb-1">Sales Coach AI</p>
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  Il tuo coach di vendita personale. Chiedi analisi, consigli e strategie per migliorare le tue performance.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[320px]">
                {CHAT_SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-dashed hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Sparkles className="h-3 w-3 inline-block mr-1.5 opacity-50" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 max-w-[90%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
              >
                <div className="shrink-0 mt-1">
                  {msg.role === "assistant" ? (
                    <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                </div>
                <div
                  className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <SafeMarkdown content={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex gap-2 max-w-[90%]">
              <div className="shrink-0 mt-1">
                <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-violet-500" />
                </div>
              </div>
              <div className="bg-muted rounded-xl rounded-tl-sm px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Chiedi al tuo Sales Coach..."
              className="min-h-[40px] max-h-[120px] resize-none text-sm rounded-xl"
              disabled={sending}
            />
            <Button
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
    </div>
  );
}

export default function SalesReportTab({ selectedDate, onDateChange }: SalesReportTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState("day");
  const [formData, setFormData] = useState(emptyReport);
  const [hasChanges, setHasChanges] = useState(false);
  const [weekDate, setWeekDate] = useState(new Date());
  const [monthDate, setMonthDate] = useState(new Date());

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(weekDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(weekDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

  const { data: dayReport } = useQuery<SalesReport>({
    queryKey: ["/api/sales-reports", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/sales-reports/${dateStr}`, { headers: getAuthHeaders() });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: weekReports = [] } = useQuery<SalesReport[]>({
    queryKey: ["/api/sales-reports", "week", weekStart, weekEnd],
    queryFn: async () => {
      const res = await fetch(`/api/sales-reports?startDate=${weekStart}&endDate=${weekEnd}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: view === "week" || view === "month",
  });

  const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const currentMonthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const { data: currentMonthReports = [] } = useQuery<SalesReport[]>({
    queryKey: ["/api/sales-reports", "goals-month", currentMonthStart, currentMonthEnd],
    queryFn: async () => {
      const res = await fetch(`/api/sales-reports?startDate=${currentMonthStart}&endDate=${currentMonthEnd}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: monthReports = [] } = useQuery<SalesReport[]>({
    queryKey: ["/api/sales-reports", "month", monthStart, monthEnd],
    queryFn: async () => {
      const res = await fetch(`/api/sales-reports?startDate=${monthStart}&endDate=${monthEnd}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: view === "month",
  });

  useEffect(() => {
    if (dayReport) {
      setFormData({
        calls: dayReport.calls,
        discoBooked: dayReport.discoBooked,
        discoScheduled: dayReport.discoScheduled,
        discoShowed: dayReport.discoShowed,
        demoBooked: dayReport.demoBooked,
        demoScheduled: dayReport.demoScheduled,
        demoShowed: dayReport.demoShowed,
        depositsAmount: dayReport.depositsAmount || "0",
        contractsClosed: dayReport.contractsClosed,
        contractsAmount: dayReport.contractsAmount || "0",
        notes: dayReport.notes || "",
      });
      setHasChanges(false);
    } else {
      setFormData(emptyReport);
      setHasChanges(false);
    }
  }, [dayReport, dateStr]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sales-reports", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, ...formData }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-reports"] });
      setHasChanges(false);
      toast({ title: "Report salvato", description: `Report del ${format(selectedDate, "dd MMMM yyyy", { locale: it })} salvato` });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile salvare il report", variant: "destructive" });
    },
  });

  const updateField = useCallback((field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const getAiRange = useCallback(() => {
    if (view === "week") return { startDate: weekStart, endDate: weekEnd };
    if (view === "month") return { startDate: monthStart, endDate: monthEnd };
    const ws = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const we = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    return { startDate: ws, endDate: we };
  }, [view, weekStart, weekEnd, monthStart, monthEnd, selectedDate]);

  return (
    <div className="space-y-6">
      <Tabs value={view} onValueChange={setView}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="day" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            Giorno
          </TabsTrigger>
          <TabsTrigger value="week" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Settimana
          </TabsTrigger>
          <TabsTrigger value="month" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Mese
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-2">
            <Target className="w-4 h-4" />
            Obiettivi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="day" className="space-y-5 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onDateChange(addDays(selectedDate, -1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="text-base font-semibold capitalize hover:bg-muted/50 px-2 h-auto py-1">
                    {format(selectedDate, "EEEE d MMMM yyyy", { locale: it })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && onDateChange(date)}
                    locale={it}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onDateChange(addDays(selectedDate, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              {!isToday(selectedDate) && (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => onDateChange(new Date())}>
                  Oggi
                </Button>
              )}
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !hasChanges} size="sm" className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md">
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salva Report
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200/20 dark:bg-blue-400/5 rounded-full -mr-6 -mt-6" />
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                  <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">Prospecting</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-blue-700/70 dark:text-blue-300/70 mb-1 block">Call effettuate</label>
                  <Input type="number" min={0} className="h-9 bg-white/80 dark:bg-gray-900/50 border-blue-200 dark:border-blue-800 text-right font-medium" value={formData.calls} onChange={e => updateField("calls", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs text-blue-700/70 dark:text-blue-300/70 mb-1 block">Disco Prenotate</label>
                  <Input type="number" min={0} className="h-9 bg-white/80 dark:bg-gray-900/50 border-blue-200 dark:border-blue-800 text-right font-medium" value={formData.discoBooked} onChange={e => updateField("discoBooked", parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 p-4">
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-200/20 dark:bg-emerald-400/5 rounded-full -mr-6 -mt-6" />
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                  <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Discovery</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-emerald-700/70 dark:text-emerald-300/70 mb-1 block">Programmate</label>
                  <Input type="number" min={0} className="h-9 bg-white/80 dark:bg-gray-900/50 border-emerald-200 dark:border-emerald-800 text-right font-medium" value={formData.discoScheduled} onChange={e => updateField("discoScheduled", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs text-emerald-700/70 dark:text-emerald-300/70 mb-1 block">Presentati</label>
                  <Input type="number" min={0} className="h-9 bg-white/80 dark:bg-gray-900/50 border-emerald-200 dark:border-emerald-800 text-right font-medium" value={formData.discoShowed} onChange={e => updateField("discoShowed", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs text-emerald-700/70 dark:text-emerald-300/70 mb-1 block">Demo Prenotate</label>
                  <Input type="number" min={0} className="h-9 bg-white/80 dark:bg-gray-900/50 border-emerald-200 dark:border-emerald-800 text-right font-medium" value={formData.demoBooked} onChange={e => updateField("demoBooked", parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 p-4">
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-200/20 dark:bg-purple-400/5 rounded-full -mr-6 -mt-6" />
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                  <CalendarDays className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">Demo</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-purple-700/70 dark:text-purple-300/70 mb-1 block">Programmate</label>
                  <Input type="number" min={0} className="h-9 bg-white/80 dark:bg-gray-900/50 border-purple-200 dark:border-purple-800 text-right font-medium" value={formData.demoScheduled} onChange={e => updateField("demoScheduled", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs text-purple-700/70 dark:text-purple-300/70 mb-1 block">Presentati</label>
                  <Input type="number" min={0} className="h-9 bg-white/80 dark:bg-gray-900/50 border-purple-200 dark:border-purple-800 text-right font-medium" value={formData.demoShowed} onChange={e => updateField("demoShowed", parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-4">
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-200/20 dark:bg-amber-400/5 rounded-full -mr-6 -mt-6" />
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                  <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">Risultati</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-amber-700/70 dark:text-amber-300/70 mb-1 block">Depositi (€)</label>
                  <Input type="number" min={0} step="0.01" className="h-9 bg-white/80 dark:bg-gray-900/50 border-amber-200 dark:border-amber-800 text-right font-medium" value={formData.depositsAmount} onChange={e => updateField("depositsAmount", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-amber-700/70 dark:text-amber-300/70 mb-1 block">Contratti Chiusi</label>
                  <Input type="number" min={0} className="h-9 bg-white/80 dark:bg-gray-900/50 border-amber-200 dark:border-amber-800 text-right font-medium" value={formData.contractsClosed} onChange={e => updateField("contractsClosed", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs text-amber-700/70 dark:text-amber-300/70 mb-1 block">Importo Contratti (€)</label>
                  <Input type="number" min={0} step="0.01" className="h-9 bg-white/80 dark:bg-gray-900/50 border-amber-200 dark:border-amber-800 text-right font-medium" value={formData.contractsAmount} onChange={e => updateField("contractsAmount", e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">Note & Riflessioni</span>
            </div>
            <Textarea placeholder="Come è andata oggi? Appunti, riflessioni, strategie per domani..." value={formData.notes} onChange={e => updateField("notes", e.target.value)} rows={3} className="bg-white/80 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 resize-none" />
          </div>
        </TabsContent>

        <TabsContent value="week" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setWeekDate(subWeeks(weekDate, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">
                {format(startOfWeek(weekDate, { weekStartsOn: 1 }), "d MMM", { locale: it })} - {format(endOfWeek(weekDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: it })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => setWeekDate(addWeeks(weekDate, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <WeeklyTable reports={weekReports} weekStart={startOfWeek(weekDate, { weekStartsOn: 1 })} />
        </TabsContent>

        <TabsContent value="month" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setMonthDate(subMonths(monthDate, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold capitalize">
                {format(monthDate, "MMMM yyyy", { locale: it })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <MonthlyTable reports={monthReports} monthDate={monthDate} />
        </TabsContent>

        <TabsContent value="goals" className="space-y-4 mt-4">
          <SalesGoalsSection monthReports={currentMonthReports} monthDate={new Date()} dailyReports={dayReport ? [dayReport] : []} selectedDate={selectedDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WeeklyTable({ reports, weekStart }: { reports: SalesReport[]; weekStart: Date }) {
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const reportMap = new Map(reports.map(r => [r.date, r]));
  const totals = sumReports(reports);

  const metrics = [
    { key: "calls", label: "Call", icon: Phone },
    { key: "discoBooked", label: "Disco Prenotate", icon: CalendarDays },
    { key: "discoScheduled", label: "Disco Programmate", icon: CalendarDays },
    { key: "discoShowed", label: "Disco Presentati", icon: Users },
    { key: "demoBooked", label: "Demo Prenotate", icon: CalendarDays },
    { key: "demoScheduled", label: "Demo Programmate", icon: CalendarDays },
    { key: "demoShowed", label: "Demo Presentati", icon: Users },
    { key: "depositsAmount", label: "Depositi €", icon: DollarSign },
    { key: "contractsClosed", label: "Contratti", icon: TrendingUp },
    { key: "contractsAmount", label: "Importo €", icon: DollarSign },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium min-w-[150px]">Metrica</th>
                {days.map(d => (
                  <th key={d.toISOString()} className="text-center p-3 font-medium min-w-[70px]">
                    <div className="text-xs text-muted-foreground">{format(d, "EEE", { locale: it })}</div>
                    <div>{format(d, "d")}</div>
                  </th>
                ))}
                <th className="text-center p-3 font-semibold min-w-[80px] bg-primary/5">Totale</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => (
                <tr key={m.key} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium flex items-center gap-2">
                    <m.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {m.label}
                  </td>
                  {days.map(d => {
                    const r = reportMap.get(format(d, "yyyy-MM-dd"));
                    const val = r ? (r as any)[m.key] : 0;
                    const display = m.key.includes("Amount") ? (parseFloat(val || "0") > 0 ? `€${parseFloat(val).toFixed(0)}` : "-") : (val > 0 ? val : "-");
                    return (
                      <td key={d.toISOString()} className="text-center p-3">
                        <span className={val > 0 ? "font-medium" : "text-muted-foreground"}>{display}</span>
                      </td>
                    );
                  })}
                  <td className="text-center p-3 font-semibold bg-primary/5">
                    {m.key.includes("Amount") ? `€${(totals as any)[m.key].toFixed(0)}` : (totals as any)[m.key]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CardContent className="border-t">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Tassi di Conversione
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ConversionBadge label="Call → Disco" value={totals.calls > 0 ? (totals.discoBooked / totals.calls * 100) : 0} />
          <ConversionBadge label="Disco Show Rate" value={totals.discoScheduled > 0 ? (totals.discoShowed / totals.discoScheduled * 100) : 0} />
          <ConversionBadge label="Demo Show Rate" value={totals.demoScheduled > 0 ? (totals.demoShowed / totals.demoScheduled * 100) : 0} />
          <ConversionBadge label="Demo → Contratti" value={totals.demoShowed > 0 ? (totals.contractsClosed / totals.demoShowed * 100) : 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyTable({ reports, monthDate }: { reports: SalesReport[]; monthDate: Date }) {
  const monthS = startOfMonth(monthDate);
  const monthE = endOfMonth(monthDate);

  const weeks: { start: Date; end: Date; label: string }[] = [];
  let current = startOfWeek(monthS, { weekStartsOn: 1 });
  while (current <= monthE) {
    const wEnd = addDays(current, 6);
    weeks.push({
      start: current,
      end: wEnd,
      label: `${format(current, "d MMM", { locale: it })} - ${format(wEnd, "d MMM", { locale: it })}`,
    });
    current = addDays(wEnd, 1);
  }

  const totals = sumReports(reports);
  const metrics = [
    { key: "calls", label: "Call" },
    { key: "discoBooked", label: "Disco Prenotate" },
    { key: "discoScheduled", label: "Disco Programmate" },
    { key: "discoShowed", label: "Disco Presentati" },
    { key: "demoBooked", label: "Demo Prenotate" },
    { key: "demoScheduled", label: "Demo Programmate" },
    { key: "demoShowed", label: "Demo Presentati" },
    { key: "depositsAmount", label: "Depositi €" },
    { key: "contractsClosed", label: "Contratti" },
    { key: "contractsAmount", label: "Importo €" },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium min-w-[150px]">Metrica</th>
                {weeks.map((w, i) => (
                  <th key={i} className="text-center p-3 font-medium min-w-[100px]">
                    <div className="text-xs">{w.label}</div>
                  </th>
                ))}
                <th className="text-center p-3 font-semibold min-w-[80px] bg-primary/5">Totale</th>
                <th className="text-center p-3 font-semibold min-w-[80px] bg-primary/5">Media/g</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => {
                const weekValues = weeks.map(w => {
                  const wReports = reports.filter(r => {
                    const d = new Date(r.date);
                    return d >= w.start && d <= w.end;
                  });
                  return sumReports(wReports);
                });
                const daysWithData = reports.length || 1;
                const totalVal = (totals as any)[m.key];
                const avg = m.key.includes("Amount") ? (totalVal / daysWithData).toFixed(0) : (totalVal / daysWithData).toFixed(1);

                return (
                  <tr key={m.key} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{m.label}</td>
                    {weekValues.map((wv, i) => {
                      const val = (wv as any)[m.key];
                      const display = m.key.includes("Amount") ? (val > 0 ? `€${val.toFixed(0)}` : "-") : (val > 0 ? val : "-");
                      return <td key={i} className="text-center p-3">{display}</td>;
                    })}
                    <td className="text-center p-3 font-semibold bg-primary/5">
                      {m.key.includes("Amount") ? `€${totalVal.toFixed(0)}` : totalVal}
                    </td>
                    <td className="text-center p-3 text-muted-foreground bg-primary/5">
                      {m.key.includes("Amount") ? `€${avg}` : avg}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CardContent className="border-t">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Tassi di Conversione Mensili
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ConversionBadge label="Call → Disco" value={totals.calls > 0 ? (totals.discoBooked / totals.calls * 100) : 0} />
          <ConversionBadge label="Disco Show Rate" value={totals.discoScheduled > 0 ? (totals.discoShowed / totals.discoScheduled * 100) : 0} />
          <ConversionBadge label="Demo Show Rate" value={totals.demoScheduled > 0 ? (totals.demoShowed / totals.demoScheduled * 100) : 0} />
          <ConversionBadge label="Demo → Contratti" value={totals.demoShowed > 0 ? (totals.contractsClosed / totals.demoShowed * 100) : 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function ConversionBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 50 ? "text-green-600 bg-green-50 dark:bg-green-950/30" : value >= 25 ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30" : "text-red-600 bg-red-50 dark:bg-red-950/30";
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-lg font-bold">{value.toFixed(1)}%</div>
    </div>
  );
}
