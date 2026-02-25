import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import { Message } from "@/components/ai-assistant/Message";
import { ThinkingBubble } from "@/components/ai-assistant/ThinkingBubble";
import {
  Send, Loader2, Trash2, X, ChevronDown, Sparkles, Brain, Calendar, MessageSquare, ChevronRight,
  Paperclip, Mic, MicOff, FileText, Image as ImageIcon, Music,
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (selectedFile) {
      return sendWithMedia();
    }
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        alert('File troppo grande (max 50MB)');
        return;
      }
      setSelectedFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
        setSelectedFile(audioFile);
        setIsRecording(false);
        setRecordingDuration(0);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Recording error:', err);
      alert('Impossibile accedere al microfono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const sendWithMedia = async () => {
    if (!selectedFile && !input.trim()) return;
    if (sending) return;

    const messageText = input.trim();
    const file = selectedFile;
    
    let previewText = messageText;
    if (file) {
      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');
      const icon = isAudio ? '🎤' : isImage ? '🖼️' : '📎';
      const label = isAudio ? 'Vocale' : file.name;
      previewText = messageText ? `${messageText} [${icon} ${label}]` : `${icon} ${label}`;
    }

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: "consultant",
      message: previewText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setInput("");
    setSelectedFile(null);
    setSending(true);
    scrollToBottom();

    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (messageText) formData.append('message', messageText);

      const headers = getAuthHeaders();
      delete (headers as any)['Content-Type'];

      const res = await fetch(`/api/ai-autonomy/agent-chat/${roleId}/send-media`, {
        method: "POST",
        headers,
        body: formData,
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
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5"
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
              <div key={msg.id}>
                <Message
                  message={{
                    id: msg.id,
                    role: msg.sender === "consultant" ? "user" : "assistant",
                    content: msg.message,
                  }}
                  assistantName={roleName}
                  assistantSubtitle="Dipendente AI"
                />
                <p className={cn(
                  "text-[10px] mt-1",
                  msg.sender === "consultant" ? "text-right text-muted-foreground/60" : "ml-12 text-muted-foreground/60"
                )}>
                  {getRelativeTime(msg.created_at)}
                </p>
              </div>
            ))
          )}

          {sending && (
            <ThinkingBubble isThinking={true} />
          )}
        </div>

        <div className="p-3 space-y-2">
          {selectedFile && (
            <div className="flex flex-wrap gap-2 px-1">
              <div className="relative group flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {selectedFile.type.startsWith('image/') ? (
                  <ImageIcon className="w-5 h-5 text-blue-500" />
                ) : selectedFile.type.startsWith('audio/') ? (
                  <Music className="w-5 h-5 text-purple-500" />
                ) : (
                  <FileText className="w-5 h-5 text-slate-500" />
                )}
                <span className="text-sm text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(0)}KB
                </span>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-600 dark:text-red-400 font-medium">
                Registrazione in corso... {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
              </span>
              <button
                onClick={stopRecording}
                className="ml-auto text-red-600 dark:text-red-400 hover:text-red-700 font-medium"
              >
                Stop
              </button>
            </div>
          )}
          <div className="relative bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200/70 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl transition-all duration-300 focus-within:border-primary/40 dark:focus-within:border-primary/40 focus-within:shadow-primary/10 focus-within:bg-white dark:focus-within:bg-slate-800">
            <div className="px-4 pt-3 pb-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.m4a,.ogg"
              />
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
                placeholder={sending ? "Sto elaborando..." : `Scrivi a ${roleName}...`}
                disabled={sending || isRecording}
                className="resize-none min-h-[44px] max-h-[120px] bg-transparent border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 p-0 shadow-none"
                rows={1}
              />
            </div>

            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || isRecording}
                  title="Allega file"
                >
                  <Paperclip className="h-4 w-4 text-slate-500" />
                </Button>
                {!input.trim() && !selectedFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 rounded-lg",
                      isRecording
                        ? "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50"
                        : "hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={sending}
                    title={isRecording ? "Ferma registrazione" : "Registra vocale"}
                  >
                    {isRecording ? (
                      <MicOff className="h-4 w-4 text-red-500" />
                    ) : (
                      <Mic className="h-4 w-4 text-slate-500" />
                    )}
                  </Button>
                )}
              </div>

              <Button
                onClick={() => sendMessage()}
                disabled={(!input.trim() && !selectedFile) || sending}
                size="sm"
                className="h-9 w-9 p-0 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 disabled:from-slate-200 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-600 transition-all"
              >
                {sending ? (
                  <div className="flex gap-0.5">
                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                ) : (
                  <Send className="h-4 w-4 text-white" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
