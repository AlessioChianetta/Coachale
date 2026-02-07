import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import {
  Bot, Send, Loader2, Target, TrendingUp, BarChart3, ListTodo,
  Trash2, User,
} from "lucide-react";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  severity: "info" | "success" | "warning" | "error";
  icon: string;
  created_at: string;
  is_read: boolean;
}

const suggestions = [
  { icon: Target, label: "Panoramica clienti", prompt: "Dammi una panoramica dei miei clienti e delle loro situazioni", gradient: "from-cyan-500 to-teal-500" },
  { icon: TrendingUp, label: "Follow-up consigliati", prompt: "Quali clienti dovrei ricontattare questa settimana?", gradient: "from-teal-500 to-emerald-500" },
  { icon: BarChart3, label: "Analisi portafoglio", prompt: "Analizza il portafoglio complessivo dei miei clienti", gradient: "from-slate-500 to-cyan-500" },
  { icon: ListTodo, label: "I tuoi task", prompt: "Quali task hai in sospeso o programmati per oggi?", gradient: "from-cyan-600 to-teal-600" },
];

function getActivityEmoji(icon: string) {
  switch (icon) {
    case "check": return "✅";
    case "phone": return "📞";
    case "mail": return "📧";
    case "chart": return "📊";
    case "brain": return "🧠";
    case "alert": return "⚠️";
    default: return "📋";
  }
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function SafeMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeSanitize]}
      components={{
        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        code: ({ children }) => (
          <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-xs">{children}</code>
        ),
        ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function AllessiaSidePanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activityPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-autonomy/activity?page=1&limit=5", {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const acts = data.activities || [];
        setActivities(acts);
      }
    } catch (err) {
      console.error("Error fetching activities:", err);
    }
  }, []);

  const fetchChatHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/ai-autonomy/chat/history?limit=50", {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Error fetching chat history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    fetchActivities();
    fetchChatHistory();
  }, [fetchActivities, fetchChatHistory]);

  useEffect(() => {
    activityPollRef.current = setInterval(fetchActivities, 30000);
    return () => {
      if (activityPollRef.current) clearInterval(activityPollRef.current);
    };
  }, [fetchActivities]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/ai-autonomy/chat", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const clearChat = async () => {
    try {
      const res = await fetch("/api/ai-autonomy/chat/history", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setMessages([]);
      }
    } catch (err) {
      console.error("Error clearing chat:", err);
    }
  };

  const markActivityRead = async (id: string) => {
    try {
      await fetch(`/api/ai-autonomy/activity/${id}/read`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      setActivities(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch (err) {
      console.error("Error marking activity read:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showWelcomeScreen = messages.length === 0 && !historyLoading;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold text-sm">Alessia - Dipendente AI</span>
              <span className="w-2 h-2 bg-green-400 rounded-full" />
            </div>
            <p className="text-white/70 text-xs">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              className="h-7 w-7 hover:bg-white/20 text-white/70 hover:text-white"
              title="Cancella chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-3">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
            </div>
          ) : showWelcomeScreen ? (
            <div className="flex flex-col items-center flex-1 px-1 py-6 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center w-full"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="relative mb-5"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                    <motion.div
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    >
                      <Bot className="w-10 h-10 text-white" />
                    </motion.div>
                  </div>
                  <motion.div
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  </motion.div>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-1.5 text-center"
                >
                  {getGreeting()}!
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="text-sm text-slate-500 dark:text-slate-400 mb-5 text-center"
                >
                  Sono <span className="font-medium text-cyan-600 dark:text-cyan-400">Alessia</span>, come posso aiutarti oggi?
                </motion.p>

                {activities.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.5 }}
                    className="w-full space-y-1.5 mb-5"
                  >
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">Attività recenti</p>
                    {activities.slice(0, 3).map(act => (
                      <div
                        key={act.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors",
                          act.is_read
                            ? "bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"
                            : "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300"
                        )}
                        onClick={() => !act.is_read && markActivityRead(act.id)}
                      >
                        <span>{getActivityEmoji(act.icon)}</span>
                        <span className="flex-1 truncate">{act.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{getRelativeTime(act.created_at)}</span>
                      </div>
                    ))}
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="grid grid-cols-2 gap-2.5 w-full"
                >
                  {suggestions.map((s, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
                      onClick={() => sendMessage(s.prompt)}
                      className={cn(
                        "flex flex-col items-start gap-2 p-3 rounded-xl text-left",
                        "bg-white dark:bg-slate-800/50",
                        "border border-slate-200 dark:border-slate-700/50",
                        "hover:border-cyan-300 dark:hover:border-cyan-600 hover:shadow-md",
                        "transition-all duration-200 group"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center",
                        "group-hover:scale-105 transition-transform duration-200",
                        s.gradient
                      )}>
                        <s.icon className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{s.label}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2 leading-tight">{s.prompt}</p>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                  className="text-[11px] text-slate-400 dark:text-slate-500 mt-5 text-center"
                >
                  Scrivi un messaggio o scegli uno dei suggerimenti sopra
                </motion.p>
              </motion.div>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.length > 0 && (
                <div className="space-y-1 mb-2">
                  {activities.filter(a => !a.is_read).slice(0, 3).map(act => (
                    <div
                      key={act.id}
                      className="flex items-center justify-center"
                      onClick={() => markActivityRead(act.id)}
                    >
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <span>{getActivityEmoji(act.icon)}</span>
                        <span className="truncate max-w-[250px]">{act.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] flex items-end gap-2">
                        <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-sm border border-slate-200/50 dark:border-slate-600/30">
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        </div>
                        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600 flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-slate-800">
                          <User className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-sm mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 shadow-sm">
                        <SafeMarkdown content={msg.content} />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-sm">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="px-3 py-3 shrink-0">
        <div className="relative bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 focus-within:border-slate-300 dark:focus-within:border-slate-600 focus-within:bg-white dark:focus-within:bg-slate-800">
          <div className="px-3 pt-2.5 pb-1.5">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi un messaggio ad Alessia..."
              disabled={loading}
              className="resize-none min-h-[40px] max-h-[100px] bg-transparent border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed text-base placeholder:text-slate-400 dark:placeholder:text-slate-500 p-0 shadow-none"
              rows={1}
            />
          </div>
          <div className="flex items-center justify-end px-2.5 pb-2.5 pt-0.5">
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-8 w-8 rounded-lg bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-40 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 text-white dark:text-slate-900 animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white dark:text-slate-900" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const FloatingEmployeeChat = AllessiaSidePanel;
