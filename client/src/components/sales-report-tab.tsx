import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, addWeeks, subWeeks, addMonths, subMonths, getDay } from "date-fns";
import { it } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
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

function SalesChatPanel({ open, onClose, getAiRange }: { open: boolean; onClose: () => void; getAiRange: () => { startDate: string; endDate: string } }) {
  const { toast } = useToast();
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
    if (open) {
      fetchMessages();
    }
  }, [open, fetchMessages]);

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
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sales-chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <motion.div
            key="sales-chat-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-full md:w-[480px] z-50 bg-background shadow-xl flex flex-col"
          >
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
  const [chatOpen, setChatOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

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

  const aiMutation = useMutation({
    mutationFn: async () => {
      const range = getAiRange();
      const res = await fetch("/api/sales-reports/ai-analyze", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(range),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => setAiAnalysis(data.analysis),
    onError: () => {
      toast({ title: "Errore", description: "Impossibile analizzare le performance", variant: "destructive" });
    },
  });

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

        <TabsContent value="day" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => onDateChange(addDays(selectedDate, -1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">
                {format(selectedDate, "EEEE d MMMM yyyy", { locale: it })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => onDateChange(addDays(selectedDate, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !hasChanges} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salva
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-500" />
                  Chiamate & Discovery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Call effettuate</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.calls} onChange={e => updateField("calls", parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Disco Prenotate</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.discoBooked} onChange={e => updateField("discoBooked", parseInt(e.target.value) || 0)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-500" />
                  Discovery del Giorno
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Disco Programmate</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.discoScheduled} onChange={e => updateField("discoScheduled", parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Presentati</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.discoShowed} onChange={e => updateField("discoShowed", parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Demo Prenotate</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.demoBooked} onChange={e => updateField("demoBooked", parseInt(e.target.value) || 0)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-purple-500" />
                  Demo del Giorno
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Demo Programmate</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.demoScheduled} onChange={e => updateField("demoScheduled", parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Presentati</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.demoShowed} onChange={e => updateField("demoShowed", parseInt(e.target.value) || 0)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  Risultati
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Depositi (€)</Label>
                  <Input type="number" min={0} step="0.01" className="w-28 text-right" value={formData.depositsAmount} onChange={e => updateField("depositsAmount", e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Contratti Chiusi</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.contractsClosed} onChange={e => updateField("contractsClosed", parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Importo Contratti (€)</Label>
                  <Input type="number" min={0} step="0.01" className="w-28 text-right" value={formData.contractsAmount} onChange={e => updateField("contractsAmount", e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="Note sul giorno, motivi, riflessioni..." value={formData.notes} onChange={e => updateField("notes", e.target.value)} rows={3} />
            </CardContent>
          </Card>
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

      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-500" />
              Sales Coach AI
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending}>
                {aiMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
                Analizza Performance
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setChatOpen(true)}>
                <MessageCircle className="w-3.5 h-3.5" />
                Chatta con il Coach
              </Button>
            </div>
          </div>
        </CardHeader>
        {aiAnalysis && (
          <CardContent>
            <SafeMarkdown content={aiAnalysis} />
          </CardContent>
        )}
      </Card>

      <SalesChatPanel open={chatOpen} onClose={() => setChatOpen(false)} getAiRange={getAiRange} />
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
