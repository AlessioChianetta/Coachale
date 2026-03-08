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
  FlaskConical,
  ArrowLeft,
  Layers,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DeliveryChat } from "./DeliveryChat";
import { DeliveryReport } from "./DeliveryReport";
import { DeliveryCatalogo } from "./DeliveryCatalogo";

interface DeliverySession {
  id: string;
  mode: "onboarding" | "discovery" | "simulator" | "sales_coach";
  status: "discovery" | "elaborating" | "completed" | "assistant";
  client_profile_json: any;
  created_at: string;
  updated_at: string;
  last_message?: string;
  message_count?: number;
}

const SALES_COACH_PACKAGES = [
  { key: "setter_ai", label: "SETTER AI", desc: "Acquisizione & Primo Contatto", emoji: "🎯" },
  { key: "dipendenti_ai", label: "DIPENDENTI AI", desc: "Team AI 24/7", emoji: "🤖" },
  { key: "hunter", label: "HUNTER", desc: "Lead Generation & Outreach", emoji: "🔍" },
  { key: "email_journey", label: "EMAIL JOURNEY", desc: "Comunicazione & Nurturing", emoji: "📧" },
  { key: "lavoro_quotidiano", label: "LAVORO QUOTIDIANO", desc: "Operatività & Consulenze", emoji: "📋" },
  { key: "formazione", label: "FORMAZIONE", desc: "Academy & Corsi", emoji: "🎓" },
  { key: "content_studio", label: "CONTENT STUDIO", desc: "Marketing & Contenuti", emoji: "✍️" },
  { key: "voce_ai", label: "VOCE AI", desc: "Centralino & Chiamate", emoji: "📞" },
  { key: "pagamenti_stripe", label: "PAGAMENTI & STRIPE", desc: "Monetizzazione & Licenze", emoji: "💳" },
  { key: "team_dipendenti", label: "TEAM & DIPENDENTI", desc: "Gestione Team Umano", emoji: "👥" },
] as const;

const SIMULATOR_NICHES = [
  { key: "consulente_finanziario", label: "Consulente Finanziario", emoji: "💰" },
  { key: "personal_trainer", label: "Personal Trainer", emoji: "🏋️" },
  { key: "agenzia_immobiliare", label: "Agenzia Immobiliare", emoji: "🏠" },
  { key: "studio_dentistico", label: "Studio Dentistico", emoji: "🦷" },
  { key: "avvocato", label: "Avvocato", emoji: "⚖️" },
  { key: "commercialista", label: "Commercialista", emoji: "📊" },
  { key: "parrucchiere_estetista", label: "Parrucchiere/Estetista", emoji: "💇" },
  { key: "ristorante_bar", label: "Ristorante/Bar", emoji: "🍽️" },
  { key: "ecommerce", label: "E-commerce", emoji: "🛒" },
  { key: "agenzia_marketing", label: "Agenzia Marketing", emoji: "📱" },
  { key: "fotografo_videomaker", label: "Fotografo/Videomaker", emoji: "📸" },
  { key: "coach_formatore", label: "Coach/Formatore", emoji: "🎯" },
  { key: "architetto_designer", label: "Architetto/Designer", emoji: "🏗️" },
  { key: "psicologo_terapeuta", label: "Psicologo/Terapeuta", emoji: "🧠" },
  { key: "fisioterapista", label: "Fisioterapista", emoji: "🩺" },
  { key: "agenzia_viaggi", label: "Agenzia Viaggi", emoji: "✈️" },
  { key: "wedding_planner", label: "Wedding Planner", emoji: "💍" },
  { key: "veterinario", label: "Veterinario", emoji: "🐾" },
  { key: "centro_yoga_pilates", label: "Centro Yoga/Pilates", emoji: "🧘" },
  { key: "consulente_it", label: "Consulente IT", emoji: "💻" },
] as const;

const SIMULATOR_ATTITUDES = [
  { key: "entusiasta", label: "Entusiasta", desc: "Dice sì a tutto, eccitato", color: "emerald" },
  { key: "scettico", label: "Scettico", desc: "Dubbioso, vuole prove", color: "amber" },
  { key: "pragmatico", label: "Pragmatico", desc: "Solo numeri e ROI", color: "blue" },
  { key: "confuso", label: "Confuso", desc: "Non sa cosa serve", color: "purple" },
  { key: "frettoloso", label: "Frettoloso", desc: "Vuole tutto subito", color: "orange" },
  { key: "resistente", label: "Resistente", desc: "Teme il cambiamento", color: "red" },
] as const;

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
                  : session.mode === "simulator"
                  ? "border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400"
                  : session.mode === "sales_coach"
                  ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                  : "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
              )}
            >
              {session.mode === "onboarding" ? "Onboarding" : session.mode === "simulator" ? "Simulatore" : session.mode === "sales_coach" ? "Sales Coach" : "Discovery"}
            </Badge>
            <Badge
              variant="secondary"
              className={cn("text-[10px] px-1.5 py-0", statusColors[session.status])}
            >
              {statusLabels[session.status] || session.status}
            </Badge>
          </div>
          {session.mode === "simulator" && session.client_profile_json?.simulator && (
            <p className="text-[10px] text-orange-600 dark:text-orange-400 mb-0.5">
              {session.client_profile_json.simulator.niche_label} — {session.client_profile_json.simulator.attitude_label}
            </p>
          )}
          {session.mode === "sales_coach" && session.client_profile_json?.sales_coach && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-0.5">
              {session.client_profile_json.sales_coach.package_labels?.join(', ') || 'Panoramica Completa'}
            </p>
          )}
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
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete();
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDelete(); } }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </span>
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
  const [simulatorStep, setSimulatorStep] = useState<"niche" | "attitude" | null>(null);
  const [selectedNiche, setSelectedNiche] = useState<typeof SIMULATOR_NICHES[number] | null>(null);
  const [salesCoachStep, setSalesCoachStep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  const [viewMode, setViewMode] = useState<"chat" | "report" | "catalogo">("chat");

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
    async (mode: "onboarding" | "discovery" | "simulator" | "sales_coach", simulatorConfig?: { niche: string; niche_label: string; attitude: string; attitude_label: string }, salesCoachConfig?: { packages: string[]; package_labels: string[] }) => {
      try {
        const body: any = { mode };
        if (mode === "simulator" && simulatorConfig) {
          body.simulatorConfig = simulatorConfig;
        }
        if (mode === "sales_coach" && salesCoachConfig) {
          body.salesCoachConfig = salesCoachConfig;
        }
        const res = await fetch("/api/consultant/delivery-agent/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          const newSession = data.data || data.session;
          await fetchSessions();
          loadSession(newSession.id);
          setShowModeDialog(false);
          setSimulatorStep(null);
          setSelectedNiche(null);
          setSalesCoachStep(false);
          toast({
            title: "Sessione creata",
            description:
              mode === "onboarding"
                ? "Iniziamo l'onboarding per la tua attività"
                : mode === "simulator"
                ? `Simulazione avviata: ${simulatorConfig?.niche_label}`
                : mode === "sales_coach"
                ? "Sales Coach avviato — Marco è pronto"
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
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-900/80 dark:to-slate-950">
      <div className="p-3 border-b border-border/40">
        <Button
          onClick={() => setShowModeDialog(true)}
          className="w-full gap-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-700 hover:via-violet-700 hover:to-purple-700 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all duration-300"
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
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 px-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Bot className="w-6 h-6 text-violet-400 dark:text-violet-500" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nessuna sessione</p>
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
            activeSession.mode !== "sales_coach" &&
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
                <Button
                  variant={viewMode === "catalogo" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("catalogo")}
                  className="h-7 text-xs gap-1"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Catalogo
                </Button>
              </div>
            )}
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {!activeSession ? (
            <div className="flex items-center justify-center h-full relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/40 dark:from-indigo-950/20 dark:via-slate-950 dark:to-violet-950/20" />
              <div className="absolute top-1/4 -left-20 w-64 h-64 bg-violet-200/20 dark:bg-violet-800/10 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-indigo-200/20 dark:bg-indigo-800/10 rounded-full blur-3xl" />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center max-w-lg px-6 relative z-10"
              >
                <div className="relative mx-auto mb-6 w-20 h-20">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl rotate-6 opacity-20" />
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/25">
                    <Rocket className="w-9 h-9 text-white drop-shadow-sm" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 via-violet-700 to-purple-700 dark:from-indigo-300 dark:via-violet-300 dark:to-purple-300 bg-clip-text text-transparent mb-3">
                  Delivery AI Agent
                </h2>
                <p className="text-sm text-muted-foreground mb-2 leading-relaxed max-w-sm mx-auto">
                  Il tuo assistente AI per l'onboarding e la discovery dei clienti.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 max-w-2xl mx-auto">
                  <div className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-indigo-200/60 dark:border-indigo-700/30 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
                      <Search className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-foreground block">Discovery</span>
                      <span className="text-[10px] text-muted-foreground/70 leading-tight block mt-0.5">9 fasi di analisi del cliente</span>
                    </div>
                  </div>
                  <div className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-violet-200/60 dark:border-violet-700/30 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md hover:shadow-violet-500/5 transition-all duration-200">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20 group-hover:scale-105 transition-transform duration-200">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-foreground block">Report</span>
                      <span className="text-[10px] text-muted-foreground/70 leading-tight block mt-0.5">Piano personalizzato completo</span>
                    </div>
                  </div>
                  <div className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-purple-200/60 dark:border-purple-700/30 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md hover:shadow-purple-500/5 transition-all duration-200">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform duration-200">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-foreground block">Assistente</span>
                      <span className="text-[10px] text-muted-foreground/70 leading-tight block mt-0.5">Supporto permanente post-report</span>
                    </div>
                  </div>
                  <div className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-amber-200/60 dark:border-amber-700/30 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-md hover:shadow-amber-500/5 transition-all duration-200">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform duration-200">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-foreground block">Sales Coach</span>
                      <span className="text-[10px] text-muted-foreground/70 leading-tight block mt-0.5">Marco ti insegna a vendere</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setShowModeDialog(true)}
                  size="lg"
                  className="gap-2.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-700 hover:via-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/35 transition-all duration-300 px-8"
                >
                  <Plus className="w-4 h-4" />
                  Inizia una Sessione
                </Button>
              </motion.div>
            </div>
          ) : viewMode === "report" ? (
            <DeliveryReport
              sessionId={activeSession.id}
              onBackToChat={() => setViewMode("chat")}
            />
          ) : viewMode === "catalogo" ? (
            <DeliveryCatalogo
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

      <Dialog open={showModeDialog} onOpenChange={(open) => {
        setShowModeDialog(open);
        if (!open) { setSimulatorStep(null); setSelectedNiche(null); setSalesCoachStep(false); }
      }}>
        <DialogContent className={cn(
          "transition-all duration-200",
          simulatorStep === "niche" || salesCoachStep ? "sm:max-w-2xl" : simulatorStep === "attitude" ? "sm:max-w-lg" : "sm:max-w-md"
        )}>
          <DialogHeader>
            <DialogTitle>
              {salesCoachStep ? "Scegli i Pacchetti" :
               simulatorStep === "niche" ? "Scegli la Nicchia del Cliente" :
               simulatorStep === "attitude" ? "Scegli l'Atteggiamento" :
               "Nuova Sessione"}
            </DialogTitle>
            <DialogDescription>
              {salesCoachStep ? "Su quali pacchetti vuoi che Marco ti faccia coaching?" :
               simulatorStep === "niche" ? "Che tipo di attività gestisce il cliente simulato?" :
               simulatorStep === "attitude" ? `${selectedNiche?.emoji} ${selectedNiche?.label} — come si comporta durante la conversazione?` :
               "Scegli la modalità per la nuova sessione di delivery"}
            </DialogDescription>
          </DialogHeader>

          {!simulatorStep && !salesCoachStep && (
            <div className="grid gap-3 py-4">
              <button
                onClick={() => createSession("onboarding")}
                className="group flex items-start gap-4 p-4 rounded-xl border border-border hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all duration-200 text-left hover:shadow-md hover:shadow-emerald-500/5"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20 group-hover:shadow-lg group-hover:shadow-emerald-500/30 transition-shadow duration-200">
                  <Rocket className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Onboarding</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Per te stesso. Analizza la tua attività e genera un piano personalizzato.
                  </p>
                </div>
              </button>
              <button
                onClick={() => createSession("discovery")}
                className="group flex items-start gap-4 p-4 rounded-xl border border-border hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200 text-left hover:shadow-md hover:shadow-blue-500/5"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20 group-hover:shadow-lg group-hover:shadow-blue-500/30 transition-shadow duration-200">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Discovery</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Per un cliente terzo. Analizza la situazione e genera un report.
                  </p>
                </div>
              </button>
              <button
                onClick={() => setSimulatorStep("niche")}
                className="group flex items-start gap-4 p-4 rounded-xl border border-border hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all duration-200 text-left hover:shadow-md hover:shadow-orange-500/5"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/20 group-hover:shadow-lg group-hover:shadow-orange-500/30 transition-shadow duration-200">
                  <FlaskConical className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Simulatore</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Testa Luca interpretando un cliente. Scegli nicchia e atteggiamento, poi chatta come se fossi quel cliente.
                  </p>
                </div>
              </button>
              <button
                onClick={() => setSalesCoachStep(true)}
                className="group flex items-start gap-4 p-4 rounded-xl border border-border hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all duration-200 text-left hover:shadow-md hover:shadow-amber-500/5"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20 group-hover:shadow-lg group-hover:shadow-amber-500/30 transition-shadow duration-200">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Sales Coach</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Marco ti insegna a vendere ogni pacchetto. Linguaggio, obiezioni, strategie e frasi killer.
                  </p>
                </div>
              </button>
            </div>
          )}

          {salesCoachStep && (
            <div className="py-3">
              <button
                onClick={() => setSalesCoachStep(false)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Torna indietro
              </button>
              <button
                onClick={() => {
                  createSession("sales_coach", undefined, {
                    packages: ["all"],
                    package_labels: ["Panoramica Completa"],
                  });
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-all text-left mb-3"
              >
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="text-sm font-bold text-foreground">Panoramica Completa</p>
                  <p className="text-xs text-muted-foreground">Tutti i 10 pacchetti — ordine di vendita, strategie, bundle</p>
                </div>
              </button>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[350px] overflow-y-auto pr-1">
                {SALES_COACH_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.key}
                    onClick={() => {
                      createSession("sales_coach", undefined, {
                        packages: [pkg.key],
                        package_labels: [pkg.label],
                      });
                    }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-all text-center"
                  >
                    <span className="text-2xl">{pkg.emoji}</span>
                    <span className="text-xs font-medium text-foreground leading-tight">{pkg.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{pkg.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {simulatorStep === "niche" && (
            <div className="py-3">
              <button
                onClick={() => setSimulatorStep(null)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Torna indietro
              </button>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-1">
                {SIMULATOR_NICHES.map((niche) => (
                  <button
                    key={niche.key}
                    onClick={() => {
                      setSelectedNiche(niche);
                      setSimulatorStep("attitude");
                    }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50/40 dark:hover:bg-orange-900/10 transition-all text-center"
                  >
                    <span className="text-2xl">{niche.emoji}</span>
                    <span className="text-xs font-medium text-foreground leading-tight">{niche.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {simulatorStep === "attitude" && selectedNiche && (
            <div className="py-3">
              <button
                onClick={() => setSimulatorStep("niche")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Cambia nicchia
              </button>
              <div className="grid gap-2">
                {SIMULATOR_ATTITUDES.map((att) => (
                  <button
                    key={att.key}
                    onClick={() => {
                      createSession("simulator", {
                        niche: selectedNiche.key,
                        niche_label: selectedNiche.label,
                        attitude: att.key,
                        attitude_label: att.label,
                      });
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-all text-left"
                  >
                    <div className={cn(
                      "w-2 h-8 rounded-full flex-shrink-0",
                      att.color === "emerald" ? "bg-emerald-500" :
                      att.color === "amber" ? "bg-amber-500" :
                      att.color === "blue" ? "bg-blue-500" :
                      att.color === "purple" ? "bg-purple-500" :
                      att.color === "orange" ? "bg-orange-500" :
                      "bg-red-500"
                    )} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{att.label}</p>
                      <p className="text-xs text-muted-foreground">{att.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
