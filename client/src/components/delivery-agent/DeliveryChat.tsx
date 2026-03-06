import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Loader2,
  Bot,
  FileText,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "@/components/shared/ChatMarkdown";
import { ThinkingBubble } from "@/components/ai-assistant/ThinkingBubble";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DeliveryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  isThinking?: boolean;
  status?: "processing" | "completed" | "error";
  created_at?: string;
}

interface DeliveryChatProps {
  session: {
    id: string;
    mode: "onboarding" | "discovery";
    status: string;
    client_profile_json?: any;
  };
  onStatusChange: (newStatus: string) => void;
  onViewReport: () => void;
}

export function DeliveryChat({
  session,
  onStatusChange,
  onViewReport,
}: DeliveryChatProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<DeliveryMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/consultant/delivery-agent/sessions/${session.id}`,
          { headers: getAuthHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          const msgs = data.data?.messages || data.messages || [];
          if (msgs.length > 0) {
            setMessages(
              msgs.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                thinking: m.metadata_json?.thinking,
                status: "completed",
                created_at: m.created_at,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [session.id]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsgId = Date.now().toString();
    const assistantMsgId = (Date.now() + 1).toString();

    const userMsg: DeliveryMessage = {
      id: userMsgId,
      role: "user",
      content: trimmed,
      status: "completed",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/consultant/delivery-agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          sessionId: session.id,
          message: trimmed,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Errore nell'invio del messaggio");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Stream non disponibile");
      }

      let buffer = "";
      let accumulatedContent = "";
      let accumulatedThinking = "";
      let hasCreatedMessage = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "thinking" && data.content) {
              accumulatedThinking += data.content;
              if (!hasCreatedMessage) {
                hasCreatedMessage = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: assistantMsgId,
                    role: "assistant",
                    content: "",
                    thinking: accumulatedThinking,
                    isThinking: true,
                    status: "processing",
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, thinking: accumulatedThinking, isThinking: true }
                      : m
                  )
                );
              }
            } else if (data.type === "delta" && data.content) {
              accumulatedContent += data.content;
              if (!hasCreatedMessage) {
                hasCreatedMessage = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: assistantMsgId,
                    role: "assistant",
                    content: accumulatedContent,
                    thinking: accumulatedThinking || undefined,
                    isThinking: false,
                    status: "processing",
                  },
                ]);
                setIsTyping(false);
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: accumulatedContent,
                          isThinking: false,
                          status: "processing",
                        }
                      : m
                  )
                );
              }
            } else if (data.type === "phase_change") {
              onStatusChange(data.phase || data.newPhase || "elaborating");
            } else if (data.type === "complete") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: accumulatedContent,
                        thinking: accumulatedThinking || undefined,
                        isThinking: false,
                        status: "completed",
                      }
                    : m
                )
              );
              setIsTyping(false);
            } else if (data.type === "error") {
              const errorMsg = data.error || data.content || "Si è verificato un errore";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: errorMsg,
                        isThinking: false,
                        status: "error",
                      }
                    : m
                )
              );
              setIsTyping(false);
              toast({
                title: "Errore",
                description: errorMsg,
                variant: "destructive",
              });
            }
          } catch {
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error("Chat error:", err);
      setIsTyping(false);
      toast({
        title: "Errore di connessione",
        description: "Impossibile inviare il messaggio. Riprova.",
        variant: "destructive",
      });
    }
  }, [input, isTyping, session.id, onStatusChange, toast]);

  const handleGenerateReport = useCallback(async () => {
    setIsGeneratingReport(true);
    try {
      const res = await fetch(
        `/api/consultant/delivery-agent/generate-report/${session.id}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );
      if (res.ok) {
        onStatusChange("assistant");
        toast({
          title: "Report generato!",
          description: "Il report è pronto. Puoi visualizzarlo e scaricarlo.",
        });
        onViewReport();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore nella generazione");
      }
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Impossibile generare il report",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  }, [session.id, onStatusChange, onViewReport, toast]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loadingMessages) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {session.status === "assistant" && (
        <div className="px-4 py-2 bg-violet-50/50 dark:bg-violet-900/10 border-b border-violet-200/50 dark:border-violet-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-medium text-violet-700 dark:text-violet-400">
              Modalità Assistente
            </span>
            <span className="text-xs text-violet-500/70 dark:text-violet-400/60">
              — Chiedi qualsiasi cosa sulla configurazione e i moduli
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewReport}
            className="h-7 text-xs gap-1 text-violet-700 dark:text-violet-400"
          >
            <FileText className="w-3.5 h-3.5" />
            Vedi Report
          </Button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">
                {session.mode === "onboarding"
                  ? "Benvenuto nell'Onboarding!"
                  : "Iniziamo la Discovery"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {session.mode === "onboarding"
                  ? "Raccontami della tua attività. Ti guiderò nella configurazione ottimale della piattaforma."
                  : "Descrivi il cliente che vuoi analizzare. Esplorerò ogni aspetto per creare un piano su misura."}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[80%]">
                  <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-br-md px-4 py-3 shadow-sm border border-slate-200/50 dark:border-slate-600/30">
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col max-w-[90%]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    Delivery Agent
                  </span>
                  <span className="text-xs text-indigo-500">AI Consultant</span>
                </div>

                {(msg.thinking || msg.isThinking) && (
                  <ThinkingBubble
                    thinking={msg.thinking}
                    isThinking={msg.isThinking}
                    className="mb-2"
                  />
                )}

                {msg.content && (
                  <div className="pl-9">
                    <ChatMarkdown
                      content={msg.content}
                      className="text-sm leading-relaxed text-foreground prose prose-sm dark:prose-invert max-w-none"
                    />
                  </div>
                )}

                {msg.status === "error" && (
                  <div className="pl-9 mt-2">
                    <Badge variant="destructive" className="text-xs">
                      Errore
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 pl-9">
            <div className="flex gap-1">
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Delivery Agent sta scrivendo...
            </span>
          </div>
        )}
      </div>

      {session.status === "elaborating" && !isGeneratingReport && (
        <div className="px-4 py-3 border-t border-border/60 bg-amber-50/50 dark:bg-amber-900/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Discovery completata! Pronto per generare il report.
              </span>
            </div>
            <Button
              onClick={handleGenerateReport}
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
              size="sm"
            >
              <FileText className="w-4 h-4" />
              Genera Report
            </Button>
          </div>
        </div>
      )}

      {isGeneratingReport && (
        <div className="px-4 py-3 border-t border-border/60 bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <div>
              <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                Generazione report in corso...
              </p>
              <p className="text-xs text-indigo-500/70">
                Analisi del profilo, mappatura moduli, creazione roadmap
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-border/60">
        <div className="relative bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-sm focus-within:border-indigo-300 dark:focus-within:border-indigo-700 transition-all">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTyping
                ? "Attendi la risposta..."
                : session.status === "assistant"
                ? "Chiedi qualsiasi cosa sulla configurazione..."
                : "Rispondi alle domande del Delivery Agent..."
            }
            disabled={isTyping || isGeneratingReport}
            className="resize-none min-h-[48px] max-h-[120px] bg-transparent border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 p-3 pr-12 shadow-none"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isTyping || isGeneratingReport}
            size="sm"
            className="absolute right-2 bottom-2 h-8 w-8 p-0 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:from-slate-200 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-600 transition-all"
          >
            {isTyping ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[10px] text-muted-foreground/60">
            Shift+Invio per nuova riga
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {input.length}/4000
          </span>
        </div>
      </div>
    </div>
  );
}
