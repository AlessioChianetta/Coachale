import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import {
  Send, Loader2, Trash2, User, X, ChevronDown, Sparkles, Brain, Calendar, MessageSquare, ChevronRight,
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "consultant" | "agent";
  message: string;
  created_at: string;
}

interface AgentChatProps {
  roleId: string;
  roleName: string;
  avatar: string;
  accentColor: string;
  open: boolean;
  onClose: () => void;
  initialMessage?: string;
}

function AgentAvatar({ avatar, name, size = "md" }: { avatar: string; name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const isImage = avatar.startsWith("/") || avatar.startsWith("http") || avatar.startsWith("data:");
  if (isImage) {
    return <img src={avatar} alt={name} className={cn(sizeClass, "rounded-full object-cover")} />;
  }
  return <span className={size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl"}>{avatar}</span>;
}

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  marco: [
    "Come sto andando questa settimana?",
    "Quali sono le mie priorità oggi?",
    "Dammi un feedback diretto",
  ],
  alessia: [
    "Chi dovrei chiamare oggi?",
    "Riassumi le chiamate di questa settimana",
    "Quali clienti hanno bisogno di follow-up?",
  ],
  millie: [
    "Come vanno i numeri questo mese?",
    "Quali trend noti nei dati?",
    "Dammi un report sintetico",
  ],
  echo: [
    "Che contenuti dovrei pubblicare?",
    "Idee per il prossimo post",
    "Analisi della strategia contenuti",
  ],
  nova: [
    "Quali clienti sono a rischio?",
    "Panoramica successo clienti",
    "Chi ha fatto più progressi?",
  ],
  stella: [
    "Clienti da fidelizzare questa settimana",
    "Strategie anti-churn attive",
    "Report retention mensile",
  ],
  iris: [
    "Opportunità di upselling",
    "Analisi ricavi del mese",
    "Come ottimizzare i prezzi?",
  ],
  personalizza: [
    "Qual è il tuo stato attuale?",
    "Cosa hai fatto di recente?",
    "Quali sono i prossimi passi?",
  ],
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

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  if (diffDays < 7) return `${diffDays}g fa`;
  return date.toLocaleDateString("it-IT");
}

interface DailySummary {
  id: number;
  summary_date: string;
  summary_text: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export default function AgentChat({ roleId, roleName, avatar, accentColor, open, onClose, initialMessage }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialMessageProcessed = useRef(false);
  const [memoriaOpen, setMemoriaOpen] = useState(false);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

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
      const res = await fetch(`/api/ai-autonomy/agent-chat/${roleId}/messages?limit=50`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Failed to fetch chat messages:", err);
    } finally {
      setLoading(false);
    }
  }, [roleId, scrollToBottom]);

  useEffect(() => {
    if (open) {
      fetchMessages();
    }
  }, [open, fetchMessages]);

  useEffect(() => {
    if (open && initialMessage && !initialMessageProcessed.current && !loading) {
      initialMessageProcessed.current = true;
      setInput(initialMessage);
    }
  }, [open, initialMessage, loading]);

  useEffect(() => {
    if (!open) {
      initialMessageProcessed.current = false;
    }
  }, [open]);

  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || sending) return;

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: "consultant",
      message: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setInput("");
    setSending(true);
    scrollToBottom();

    try {
      const res = await fetch(`/api/ai-autonomy/agent-chat/${roleId}/send`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });

      if (res.ok) {
        const data = await res.json();
        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          sender: "agent",
          message: data.response.message,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, agentMsg]);
        scrollToBottom();
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          sender: "agent",
          message: `Errore: ${errData.error || 'Riprova tra poco'}`,
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        sender: "agent",
        message: "Errore di connessione. Riprova.",
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const clearChat = async () => {
    if (!confirm(`Vuoi cancellare tutta la chat con ${roleName}?`)) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/ai-autonomy/agent-chat/${roleId}/clear`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to clear chat:", err);
    } finally {
      setClearing(false);
    }
  };

  const fetchDailySummaries = useCallback(async () => {
    setLoadingSummaries(true);
    try {
      const res = await fetch(`/api/ai-autonomy/agent-chat/${roleId}/daily-summaries?limit=30`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDailySummaries(data.summaries || []);
      }
    } catch (err) {
      console.error("Failed to fetch daily summaries:", err);
    } finally {
      setLoadingSummaries(false);
    }
  }, [roleId]);

  const toggleMemoria = useCallback(() => {
    const newState = !memoriaOpen;
    setMemoriaOpen(newState);
    if (newState && dailySummaries.length === 0) {
      fetchDailySummaries();
    }
  }, [memoriaOpen, dailySummaries.length, fetchDailySummaries]);

  const toggleDay = useCallback((date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  const formatDateItalian = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const suggestions = ROLE_SUGGESTIONS[roleId] || ROLE_SUGGESTIONS.personalizza;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full h-full bg-background flex flex-col"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-muted/50 to-transparent">
          <AgentAvatar avatar={avatar} name={roleName} size="md" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{roleName}</h3>
            <p className="text-xs text-muted-foreground">Chat diretta</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", memoriaOpen && "bg-primary/10")}
              onClick={toggleMemoria}
              title="Memoria"
            >
              <Brain className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={clearChat}
              disabled={clearing || messages.length === 0}
              title="Cancella chat"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {memoriaOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="border-b overflow-hidden"
            >
              <div className="px-4 py-3 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4" style={{ color: accentColor }} />
                    <h4 className="text-sm font-semibold">Memoria</h4>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMemoriaOpen(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <ScrollArea className="max-h-[300px]">
                  {loadingSummaries ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : dailySummaries.length === 0 ? (
                    <div className="text-center py-6">
                      <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">Nessun riassunto giornaliero disponibile</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">I riassunti vengono generati automaticamente dopo 40+ messaggi</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pr-3">
                      {dailySummaries.map((ds) => (
                        <div key={ds.id} className="rounded-lg border bg-background/80">
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors rounded-lg"
                            onClick={() => toggleDay(ds.summary_date)}
                          >
                            <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", expandedDays.has(ds.summary_date) && "rotate-90")} />
                            <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="text-xs font-medium flex-1 capitalize">{formatDateItalian(ds.summary_date)}</span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                              <MessageSquare className="h-2.5 w-2.5" />
                              {ds.message_count}
                            </span>
                          </button>
                          <AnimatePresence>
                            {expandedDays.has(ds.summary_date) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3 pt-1">
                                  <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {ds.summary_text}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <AgentAvatar avatar={avatar} name={roleName} size="lg" />
              <div className="text-center">
                <p className="text-sm font-medium mb-1">Chatta con {roleName}</p>
                <p className="text-xs text-muted-foreground max-w-[250px]">
                  Chiedi aggiornamenti, dai feedback, o discuti le prossime azioni
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[280px]">
                {suggestions.map((s, i) => (
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
                className={cn(
                  "flex gap-2 max-w-[90%]",
                  msg.sender === "consultant" ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className="shrink-0 mt-1">
                  {msg.sender === "agent" ? (
                    <AgentAvatar avatar={avatar} name={roleName} size="sm" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm leading-relaxed",
                    msg.sender === "consultant"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  )}
                >
                  {msg.sender === "agent" ? (
                    <SafeMarkdown content={msg.message} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  )}
                  <p className={cn(
                    "text-[10px] mt-1",
                    msg.sender === "consultant" ? "text-primary-foreground/60" : "text-muted-foreground/60"
                  )}>
                    {getRelativeTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}

          {sending && (
            <motion.div
              className="flex gap-2 max-w-[90%]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="shrink-0 mt-1">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <AgentAvatar avatar={avatar} name={roleName} size="sm" />
                </motion.div>
              </div>
              <div className="bg-muted rounded-xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: accentColor }}
                        animate={{
                          y: [0, -6, 0],
                          opacity: [0.4, 1, 0.4],
                          scale: [0.85, 1.15, 0.85],
                        }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.15,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                  <motion.span
                    className="text-xs font-medium"
                    style={{ color: accentColor }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {roleName} sta scrivendo
                  </motion.span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="border-t p-3">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={`Scrivi a ${roleName}...`}
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
    </AnimatePresence>
  );
}
