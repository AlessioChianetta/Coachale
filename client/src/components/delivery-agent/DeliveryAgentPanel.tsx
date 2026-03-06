import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  MessageSquare,
  Rocket,
  Users,
  Search,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Bot,
  Clock,
  FileText,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DeliveryChat } from "./DeliveryChat";
import { DeliveryReport } from "./DeliveryReport";

interface DeliverySession {
  id: string;
  mode: "onboarding" | "discovery";
  status: "discovery" | "elaborating" | "completed" | "assistant";
  client_profile_json: any;
  created_at: string;
  updated_at: string;
  last_message?: string;
  message_count?: number;
}

const PHASE_STEPS = [
  { key: "discovery", label: "Discovery", icon: Search },
  { key: "elaborating", label: "Elaborazione", icon: Loader2 },
  { key: "completed", label: "Report", icon: FileText },
  { key: "assistant", label: "Assistente", icon: Bot },
];

function PhaseIndicator({ status }: { status: string }) {
  const currentIndex = PHASE_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center justify-center gap-1 py-3 px-4">
      {PHASE_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIndex;
        const isActive = idx === currentIndex;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                isCompleted &&
                  "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
                isActive &&
                  "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-700",
                !isCompleted &&
                  !isActive &&
                  "text-muted-foreground/50"
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : isActive ? (
                <Icon
                  className={cn(
                    "w-3.5 h-3.5",
                    step.key === "elaborating" && "animate-spin"
                  )}
                />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {idx < PHASE_STEPS.length - 1 && (
              <div
                className={cn(
                  "w-6 h-px mx-1",
                  idx < currentIndex
                    ? "bg-emerald-400"
                    : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  onClick,
  onDelete,
}: {
  session: DeliverySession;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const statusColors: Record<string, string> = {
    discovery: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    elaborating: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    assistant: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  };

  const statusLabels: Record<string, string> = {
    discovery: "Discovery",
    elaborating: "Elaborazione",
    completed: "Report",
    assistant: "Assistente",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-xl transition-all group relative",
        isActive
          ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700"
          : "hover:bg-muted/60 border border-transparent"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                session.mode === "onboarding"
                  ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                  : "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
              )}
            >
              {session.mode === "onboarding" ? "Onboarding" : "Discovery"}
            </Badge>
            <Badge
              variant="secondary"
              className={cn("text-[10px] px-1.5 py-0", statusColors[session.status])}
            >
              {statusLabels[session.status] || session.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {session.last_message || "Nuova sessione"}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {new Date(session.created_at).toLocaleDateString("it-IT", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
    </button>
  );
}

export function DeliveryAgentPanel() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<DeliverySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<DeliverySession | null>(null);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  const [viewMode, setViewMode] = useState<"chat" | "report">("chat");

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/consultant/delivery-agent/sessions", {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.data || data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await fetch(
          `/api/consultant/delivery-agent/sessions/${sessionId}`,
          { headers: getAuthHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          const sessionData = data.data || data;
          setActiveSession(sessionData.session || sessionData);
          setActiveSessionId(sessionId);
          setViewMode("chat");
          if (isMobile) setShowSidebar(false);
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        toast({
          title: "Errore",
          description: "Impossibile caricare la sessione",
          variant: "destructive",
        });
      }
    },
    [isMobile, toast]
  );

  const createSession = useCallback(
    async (mode: "onboarding" | "discovery") => {
      try {
        const res = await fetch("/api/consultant/delivery-agent/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ mode }),
        });
        if (res.ok) {
          const data = await res.json();
          const newSession = data.data || data.session;
          await fetchSessions();
          loadSession(newSession.id);
          setShowModeDialog(false);
          toast({
            title: "Sessione creata",
            description:
              mode === "onboarding"
                ? "Iniziamo l'onboarding per la tua attività"
                : "Iniziamo la discovery per il tuo cliente",
          });
        }
      } catch (err) {
        console.error("Failed to create session:", err);
        toast({
          title: "Errore",
          description: "Impossibile creare la sessione",
          variant: "destructive",
        });
      }
    },
    [fetchSessions, loadSession, toast]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!window.confirm("Eliminare questa sessione? L'operazione non può essere annullata."))
        return;
      try {
        const res = await fetch(
          `/api/consultant/delivery-agent/sessions/${sessionId}`,
          { method: "DELETE", headers: getAuthHeaders() }
        );
        if (res.ok) {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          if (activeSessionId === sessionId) {
            setActiveSessionId(null);
            setActiveSession(null);
          }
          toast({ title: "Sessione eliminata" });
        }
      } catch {
        toast({
          title: "Errore",
          description: "Impossibile eliminare la sessione",
          variant: "destructive",
        });
      }
    },
    [activeSessionId, toast]
  );

  const handleSessionStatusUpdate = useCallback(
    (newStatus: string) => {
      if (activeSession) {
        setActiveSession({ ...activeSession, status: newStatus as any });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id ? { ...s, status: newStatus as any } : s
          )
        );
      }
    },
    [activeSession]
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/60">
        <Button
          onClick={() => setShowModeDialog(true)}
          className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Nuova Sessione
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 px-3">
              <Bot className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nessuna sessione</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Crea una nuova sessione per iniziare
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={activeSessionId === session.id}
                onClick={() => loadSession(session.id)}
                onDelete={() => deleteSession(session.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex h-full bg-card overflow-hidden">
      {!isMobile && (
        <div
          className={cn(
            "border-r border-border/60 bg-card/50 transition-all duration-200 flex-shrink-0",
            showSidebar ? "w-72" : "w-0 overflow-hidden"
          )}
        >
          {showSidebar && sidebarContent}
        </div>
      )}

      {isMobile && (
        <AnimatePresence>
          {showSidebar && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black z-40"
                onClick={() => setShowSidebar(false)}
              />
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", damping: 25 }}
                className="fixed left-0 top-0 bottom-0 w-72 bg-card z-50 shadow-xl border-r border-border/60"
              >
                <div className="flex items-center justify-between p-3 border-b border-border/60">
                  <span className="text-sm font-semibold">Sessioni</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSidebar(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {sidebarContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="h-8 w-8 p-0"
            >
              {showSidebar ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </Button>
            {activeSession && (
              <PhaseIndicator status={activeSession.status} />
            )}
          </div>
          {activeSession &&
            (activeSession.status === "completed" ||
              activeSession.status === "assistant") && (
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === "chat" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("chat")}
                  className="h-7 text-xs gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat
                </Button>
                <Button
                  variant={viewMode === "report" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("report")}
                  className="h-7 text-xs gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Report
                </Button>
              </div>
            )}
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {!activeSession ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Rocket className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Delivery AI Agent
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Il tuo assistente AI per l'onboarding e la discovery dei
                  clienti. Analizza la situazione, genera un report
                  personalizzato e resta come assistente permanente.
                </p>
                <Button
                  onClick={() => setShowModeDialog(true)}
                  className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
                >
                  <Plus className="w-4 h-4" />
                  Inizia una Sessione
                </Button>
              </div>
            </div>
          ) : viewMode === "report" ? (
            <DeliveryReport
              sessionId={activeSession.id}
              onBackToChat={() => setViewMode("chat")}
            />
          ) : (
            <DeliveryChat
              session={activeSession}
              onStatusChange={handleSessionStatusUpdate}
              onViewReport={() => setViewMode("report")}
            />
          )}
        </div>
      </div>

      <Dialog open={showModeDialog} onOpenChange={setShowModeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova Sessione</DialogTitle>
            <DialogDescription>
              Scegli la modalità per la nuova sessione di delivery
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <button
              onClick={() => createSession("onboarding")}
              className="flex items-start gap-4 p-4 rounded-xl border border-border hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Onboarding</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Per te stesso. Analizza la tua attività, genera un piano di
                  configurazione personalizzato della piattaforma.
                </p>
              </div>
            </button>
            <button
              onClick={() => createSession("discovery")}
              className="flex items-start gap-4 p-4 rounded-xl border border-border hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Discovery</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Per un cliente terzo. Analizza la situazione del cliente e
                  genera un report con moduli consigliati e roadmap.
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
