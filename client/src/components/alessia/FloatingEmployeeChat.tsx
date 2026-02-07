import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import {
  Bot, X, Send, Loader2, Target, TrendingUp, BarChart3, ListTodo,
  Trash2,
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

export function FloatingEmployeeChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activityPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(false), 3000);
    return () => clearTimeout(timer);
  }, []);

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
        const unread = acts.some((a: ActivityItem) => !a.is_read);
        setHasUnread(unread);
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
  }, [fetchActivities]);

  useEffect(() => {
    if (isOpen) {
      fetchChatHistory();
      fetchActivities();
    }
  }, [isOpen, fetchChatHistory, fetchActivities]);

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
    <>
      <AnimatePresence>
        {showTooltip && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.8 }}
            className="fixed bottom-6 right-52 z-50 bg-gradient-to-r from-cyan-600 to-teal-600 text-white px-4 py-3 rounded-2xl shadow-2xl max-w-xs"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                transition={{ duration: 0.6, repeat: 4 }}
              >
                👋
              </motion.div>
              <div>
                <p className="font-semibold text-sm">Ciao! Sono Alessia, il tuo dipendente AI</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <div className="relative">
          {!isOpen && hasUnread && (
            <motion.div
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <Button
            onClick={() => setIsOpen(!isOpen)}
            size="lg"
            className={cn(
              "h-12 px-4 rounded-xl shadow-2xl transition-all duration-300 relative overflow-hidden group flex items-center gap-2",
              "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
            )}
          >
            {isOpen ? (
              <X className="h-5 w-5 text-white" />
            ) : (
              <>
                <Bot className="h-5 w-5 text-white" />
                <span className="text-white font-medium">Alessia</span>
                {hasUnread && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                )}
              </>
            )}
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-6 z-50 w-[400px] h-[550px] rounded-2xl shadow-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600 to-teal-600">
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-7 w-7 hover:bg-white/20 text-white/70 hover:text-white"
                  title="Chiudi"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {historyLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
                </div>
              ) : showWelcomeScreen ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-base text-slate-800 dark:text-white">Ciao! Sono Alessia</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Il tuo dipendente AI. Come posso aiutarti?</p>
                  </div>

                  {activities.length > 0 && (
                    <div className="w-full space-y-1.5 mt-2">
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
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 w-full mt-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s.prompt)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm",
                          `bg-gradient-to-r ${s.gradient}`
                        )}
                      >
                        <s.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
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
                          <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-md bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shrink-0 mt-0.5">
                            <Bot className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md bg-slate-100 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 space-y-1">
                            <SafeMarkdown content={msg.content} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {loading && (
                    <div className="flex gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shrink-0">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-slate-100 dark:bg-slate-800">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Scrivi un messaggio..."
                  rows={1}
                  className="flex-1 resize-none bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-white placeholder:text-slate-400 max-h-20"
                  style={{ minHeight: "36px" }}
                />
                <Button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  size="icon"
                  className="h-9 w-9 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 shrink-0"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
