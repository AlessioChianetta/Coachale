import { useState, useEffect, useCallback, useRef } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Bot,
  FileText,
  Sparkles,
  Globe,
  Search,
  BarChart3,
  Pencil,
  CheckCircle2,
  Play,
  Square,
} from "lucide-react";
import { MessageList } from "@/components/ai-assistant/MessageList";
import { InputArea } from "@/components/ai-assistant/InputArea";

const GENERATION_PHASES = [
  { icon: Search, label: "Ricerca informazioni sulla tua attività...", sub: "Google Maps, sito web, presenza online" },
  { icon: Globe, label: "Analisi della conversazione...", sub: "Pattern, lacune, contraddizioni" },
  { icon: Pencil, label: "Scrittura del piano strategico...", sub: "Diagnosi, pacchetti, roadmap, azioni" },
  { icon: BarChart3, label: "Revisione critica del report...", sub: "Coerenza, completezza, qualità" },
  { icon: CheckCircle2, label: "Finalizzazione...", sub: "Ultimi ritocchi e controllo qualità" },
];

function GeneratingReportProgress() {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const timings = [8000, 15000, 25000, 12000];
    let timeout: ReturnType<typeof setTimeout>;
    let current = 0;

    const advance = () => {
      current++;
      if (current < GENERATION_PHASES.length) {
        setPhaseIndex(current);
        timeout = setTimeout(advance, timings[current] || 10000);
      }
    };

    timeout = setTimeout(advance, timings[0]);
    return () => clearTimeout(timeout);
  }, []);

  const phase = GENERATION_PHASES[phaseIndex];
  const Icon = phase.icon;
  const progress = ((phaseIndex + 1) / GENERATION_PHASES.length) * 100;

  return (
    <div className="px-4 py-3 border-t border-border/60 bg-indigo-50/50 dark:bg-indigo-900/10 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500 absolute inset-0 opacity-30" />
          <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 relative" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
            {phase.label}
          </p>
          <p className="text-xs text-indigo-500/70">
            {phase.sub}
          </p>
        </div>
        <span className="text-xs font-medium text-indigo-600/60 flex-shrink-0">
          {phaseIndex + 1}/{GENERATION_PHASES.length}
        </span>
      </div>
      <div className="mt-2 h-1 bg-indigo-200/50 dark:bg-indigo-800/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

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
    mode: "onboarding" | "discovery" | "simulator" | "sales_coach";
    status: string;
    client_profile_json?: any;
  };
  onStatusChange: (newStatus: string) => void;
  onViewReport: () => void;
  publicToken?: string;
}

export function DeliveryChat({
  session,
  onStatusChange,
  onViewReport,
  publicToken,
}: DeliveryChatProps) {
  const isPublic = !!publicToken;
  const { toast } = useToast();
  const [messages, setMessages] = useState<DeliveryMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [simStatus, setSimStatus] = useState("");
  const [simTurn, setSimTurn] = useState(0);

  useEffect(() => {
    setMessages([]);
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const url = isPublic
          ? `/api/public/lead-magnet/${publicToken}/session`
          : `/api/consultant/delivery-agent/sessions/${session.id}`;
        const headers = isPublic ? {} : getAuthHeaders();
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json();
          const msgs = isPublic
            ? (data.data?.messages || [])
            : (data.data?.messages || data.messages || []);
          if (msgs.length > 0) {
            setMessages(
              msgs.map((m: any) => ({
                id: m.id || crypto.randomUUID(),
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
  }, [session.id, isPublic, publicToken]);

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
      const chatUrl = isPublic
        ? `/api/public/lead-magnet/${publicToken}/chat`
        : "/api/consultant/delivery-agent/chat";
      const chatHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(isPublic ? {} : getAuthHeaders()),
      };
      const chatBody = isPublic
        ? { message: trimmed }
        : { sessionId: session.id, message: trimmed };

      const response = await fetch(chatUrl, {
        method: "POST",
        headers: chatHeaders,
        body: JSON.stringify(chatBody),
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
  }, [isTyping, session.id, onStatusChange, toast, isPublic, publicToken]);

  const handleGenerateReport = useCallback(async () => {
    setIsGeneratingReport(true);
    try {
      const reportUrl = isPublic
        ? `/api/public/lead-magnet/${publicToken}/generate-report`
        : `/api/consultant/delivery-agent/generate-report/${session.id}`;
      const reportHeaders = isPublic ? {} : getAuthHeaders();
      const res = await fetch(reportUrl, {
        method: "POST",
        headers: reportHeaders,
      });
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
  }, [session.id, onStatusChange, onViewReport, toast, isPublic, publicToken]);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    lastMsgCountRef.current = messages.length;

    pollIntervalRef.current = setInterval(async () => {
      try {
        if (isPublic) return;
        const [msgsRes, statusRes] = await Promise.all([
          fetch(`/api/consultant/delivery-agent/sessions/${session.id}`, { headers: getAuthHeaders() }),
          fetch(`/api/consultant/delivery-agent/simulator/status/${session.id}`, { headers: getAuthHeaders() }),
        ]);

        if (msgsRes.ok) {
          const data = await msgsRes.json();
          const msgs = data.data?.messages || data.messages || [];
          if (msgs.length > lastMsgCountRef.current) {
            lastMsgCountRef.current = msgs.length;
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

          const sessionStatus = data.data?.session?.status || data.data?.status;
          if (sessionStatus && sessionStatus !== "discovery") {
            onStatusChange(sessionStatus);
          }
        }

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setSimTurn(statusData.turn || 0);
          setSimStatus(statusData.status || "");

          if (!statusData.running) {
            stopPolling();
            setIsSimRunning(false);
            setSimStatus("");
          }
        }
      } catch (err) {
        console.error("[Simulator] Polling error:", err);
      }
    }, 2000);
  }, [session.id, messages.length, onStatusChange, stopPolling]);

  const handleStartSimulation = useCallback(async () => {
    if (isSimRunning) return;
    setIsSimRunning(true);
    setSimStatus("Avvio simulazione...");
    setSimTurn(0);

    try {
      const response = await fetch("/api/consultant/delivery-agent/simulator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Errore nell'avvio della simulazione");
      }

      startPolling();
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Simulazione interrotta",
        variant: "destructive",
      });
      setIsSimRunning(false);
      setSimStatus("");
    }
  }, [isSimRunning, session.id, toast, startPolling]);

  const handleStopSimulation = useCallback(async () => {
    stopPolling();
    try {
      await fetch("/api/consultant/delivery-agent/simulator/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ sessionId: session.id }),
      });
    } catch {}
    setIsSimRunning(false);
    setSimStatus("");
  }, [session.id, stopPolling]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      stopPolling();
    };
  }, [stopPolling]);

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

      {session.mode === "simulator" && session.client_profile_json?.simulator && (
        <div className="px-4 py-2 border-b border-orange-200 dark:border-orange-800/40 bg-orange-50/70 dark:bg-orange-900/15 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-orange-600 dark:text-orange-400 font-semibold">SIMULAZIONE</span>
            <span className="text-orange-500/50">|</span>
            <span className="text-orange-700 dark:text-orange-300">{session.client_profile_json.simulator.niche_label}</span>
            <span className="text-orange-500/50">—</span>
            <span className="text-orange-600/80 dark:text-orange-400/80">Atteggiamento: {session.client_profile_json.simulator.attitude_label}</span>
          </div>
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
                : session.mode === "simulator"
                ? "Campo di Battaglia"
                : "Iniziamo la Discovery"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {session.mode === "onboarding"
                ? "Raccontami della tua attività. Ti guiderò nella configurazione ottimale della piattaforma."
                : session.mode === "simulator"
                ? "Un AI interpreterà il cliente e Luca condurrà la discovery completa. Guarda la conversazione svolgersi in automatico."
                : "Descrivi il cliente che vuoi analizzare. Esplorerò ogni aspetto per creare un piano su misura."}
            </p>
            {session.mode === "simulator" && !isSimRunning && (
              <Button
                onClick={handleStartSimulation}
                className="gap-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
              >
                <Play className="w-4 h-4" />
                Avvia Simulazione
              </Button>
            )}
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
        <GeneratingReportProgress />
      )}

      {isSimRunning && (
        <div className="px-4 py-3 border-t border-orange-200 dark:border-orange-800/40 bg-orange-50/60 dark:bg-orange-900/10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                {simStatus || `Simulazione in corso — Turno ${simTurn}`}
              </span>
            </div>
            <Button
              onClick={handleStopSimulation}
              variant="ghost"
              size="sm"
              className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Square className="w-3.5 h-3.5" />
              Ferma
            </Button>
          </div>
        </div>
      )}

      {(session.mode !== "simulator" || session.status === "assistant" || session.status === "completed") && (
        <div className="p-3 border-t border-border/60 flex-shrink-0">
          <InputArea
            onSend={(msg) => handleSend(msg)}
            disabled={isGeneratingReport}
            isProcessing={isTyping}
          />
        </div>
      )}

      {session.mode === "simulator" && !isSimRunning && messages.length > 0 && session.status !== "elaborating" && session.status !== "assistant" && session.status !== "completed" && (
        <div className="p-3 border-t border-border/60 flex-shrink-0">
          <Button
            onClick={handleStartSimulation}
            className="w-full gap-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
          >
            <Play className="w-4 h-4" />
            Riprendi Simulazione
          </Button>
        </div>
      )}
    </div>
  );
}
