import { useState, useEffect, useCallback, useRef } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Bot,
  FileText,
  Sparkles,
} from "lucide-react";
import { MessageList } from "@/components/ai-assistant/MessageList";
import { InputArea } from "@/components/ai-assistant/InputArea";

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
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

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
                status: "completed" as const,
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

  const handleSend = useCallback(async (message: string) => {
    const trimmed = message.trim();
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
  }, [isTyping, session.id, onStatusChange, toast]);

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
        <div className="px-4 py-2 bg-violet-50/50 dark:bg-violet-900/10 border-b border-violet-200/50 dark:border-violet-800/30 flex items-center justify-between flex-shrink-0">
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

      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
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
      ) : (
        <div className="flex-1 min-h-0">
          <MessageList
            messages={messages}
            isTyping={isTyping}
          />
        </div>
      )}

      {session.status === "elaborating" && !isGeneratingReport && (
        <div className="px-4 py-3 border-t border-border/60 bg-amber-50/50 dark:bg-amber-900/10 flex-shrink-0">
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
        <div className="px-4 py-3 border-t border-border/60 bg-indigo-50/50 dark:bg-indigo-900/10 flex-shrink-0">
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

      <div className="p-3 border-t border-border/60 flex-shrink-0">
        <InputArea
          onSend={(msg) => handleSend(msg)}
          disabled={isGeneratingReport}
          isProcessing={isTyping}
        />
      </div>
    </div>
  );
}
