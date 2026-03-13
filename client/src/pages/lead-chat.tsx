import { useState, useEffect, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { getAuthHeaders, getAuthUser, removeToken, removeAuthUser } from "@/lib/auth";
import { DeliveryChat } from "@/components/delivery-agent/DeliveryChat";
import { DeliveryReport } from "@/components/delivery-agent/DeliveryReport";
import { DeliveryCatalogo } from "@/components/delivery-agent/DeliveryCatalogo";
import { cn } from "@/lib/utils";
import {
  Search,
  Loader2,
  FileText,
  Bot,
  CheckCircle2,
  Circle,
  MessageSquare,
  LogOut,
  Layers,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FunnelBuilderTab = lazy(() => import("@/components/funnel-builder/FunnelBuilderTab"));

const PHASE_STEPS = [
  { key: "discovery", label: "Discovery", icon: Search },
  { key: "elaborating", label: "Elaborazione", icon: Loader2 },
  { key: "completed", label: "Report", icon: FileText },
  { key: "assistant", label: "Assistente", icon: Bot },
];

function PhaseIndicator({ status }: { status: string }) {
  const currentIndex = PHASE_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center justify-center gap-0.5 sm:gap-1 py-1 sm:py-3 px-2 sm:px-4">
      {PHASE_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIndex;
        const isActive = idx === currentIndex;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-1 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all",
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
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              ) : isActive ? (
                <Icon
                  className={cn(
                    "w-3 h-3 sm:w-3.5 sm:h-3.5",
                    step.key === "elaborating" && "animate-spin"
                  )}
                />
              ) : (
                <Circle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {idx < PHASE_STEPS.length - 1 && (
              <div
                className={cn(
                  "w-3 sm:w-6 h-px mx-0.5 sm:mx-1",
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

interface SessionInfo {
  publicToken: string;
  sessionId: string;
  status: string;
  mode: string;
}

export default function LeadChat() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"chat" | "report" | "funnel" | "catalogo">("chat");
  const [status, setStatus] = useState("discovery");
  const [sessionFunnelId, setSessionFunnelId] = useState<string | null>(null);

  const user = getAuthUser();
  const isConsultant = user?.role === "consultant" || user?.role === "super_admin";

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await fetch("/api/lead/my-session", {
          headers: getAuthHeaders(),
        });
        if (res.status === 401) {
          setLocation("/login");
          return;
        }
        if (res.status === 404) {
          setError("Nessuna sessione trovata. Compila il form per iniziare.");
          return;
        }
        if (!res.ok) {
          setError("Errore nel caricamento della sessione.");
          return;
        }
        const data = await res.json();
        if (data.success && data.data) {
          setSession(data.data);
          setStatus(data.data.status || "discovery");
        }
      } catch (err) {
        console.error("[LeadChat] Load error:", err);
        setError("Errore di connessione.");
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [setLocation]);

  useEffect(() => {
    if (!session?.sessionId) return;
    const fetchFunnelId = async () => {
      try {
        if (isConsultant) {
          const res = await fetch(`/api/funnels/by-session/${session.sessionId}`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.id) setSessionFunnelId(data.id);
          }
        } else if (session.publicToken) {
          const res = await fetch(`/api/public/lead-magnet/${session.publicToken}/funnel`);
          if (res.ok) {
            const data = await res.json();
            if (data.data?.id) setSessionFunnelId(data.data.id);
          }
        }
      } catch {}
    };
    fetchFunnelId();
    const interval = setInterval(fetchFunnelId, 10000);
    return () => clearInterval(interval);
  }, [session?.sessionId, session?.publicToken, isConsultant]);

  const handleLogout = () => {
    removeToken();
    removeAuthUser();
    setLocation("/login");
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
  };

  const handleViewReport = () => {
    setViewMode("report");
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => setLocation("/onboarding-gratuito")}>
            Vai all'Onboarding Gratuito
          </Button>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const showExtraTabs = status === "completed" || status === "assistant";

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-bold text-[9px] sm:text-sm shrink-0"
                 style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}>
              SO
            </div>
            <div className="min-w-0">
              <h1 className="text-[11px] sm:text-sm font-semibold truncate">La tua Analisi Gratuita</h1>
              {user && (
                <p className="text-[9px] sm:text-xs text-muted-foreground truncate hidden sm:block">
                  {user.firstName} {user.lastName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="hidden sm:block">
              <PhaseIndicator status={status} />
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1 sm:gap-1.5 text-[10px] sm:text-xs h-6 sm:h-8 px-1.5 sm:px-3 shrink-0">
              <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Esci</span>
            </Button>
          </div>
        </div>

        <div className="sm:hidden">
          <PhaseIndicator status={status} />
        </div>

        <div className="flex border-t">
          <button
            onClick={() => setViewMode("chat")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2.5 text-[11px] sm:text-sm font-medium transition-colors border-b-2",
              viewMode === "chat"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Chat
          </button>
          <button
            onClick={() => setViewMode("report")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2.5 text-[11px] sm:text-sm font-medium transition-colors border-b-2",
              viewMode === "report"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Report
          </button>
          {showExtraTabs && (
            <>
              <button
                onClick={() => setViewMode("funnel")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2.5 text-[11px] sm:text-sm font-medium transition-colors border-b-2",
                  viewMode === "funnel"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <GitBranch className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Funnel
              </button>
              <button
                onClick={() => setViewMode("catalogo")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2.5 text-[11px] sm:text-sm font-medium transition-colors border-b-2",
                  viewMode === "catalogo"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Catalogo</span>
                <span className="xs:hidden">Cat.</span>
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden min-h-0">
        {viewMode === "chat" ? (
          <DeliveryChat
            session={{
              id: session.sessionId,
              mode: session.mode as any,
              status: status as any,
              client_profile_json: null,
              created_at: "",
              updated_at: "",
            }}
            onStatusChange={handleStatusChange}
            onViewReport={handleViewReport}
            publicToken={session.publicToken}
          />
        ) : viewMode === "funnel" ? (
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Caricamento Funnel Builder...</p>
              </div>
            </div>
          }>
            <FunnelBuilderTab initialFunnelId={sessionFunnelId} />
          </Suspense>
        ) : viewMode === "catalogo" ? (
          <DeliveryCatalogo
            sessionId={session.sessionId}
            onBackToChat={() => setViewMode("chat")}
            publicToken={session.publicToken}
          />
        ) : (
          <DeliveryReport
            sessionId={session.sessionId}
            onBackToChat={() => setViewMode("chat")}
            publicToken={session.publicToken}
          />
        )}
      </main>
    </div>
  );
}
