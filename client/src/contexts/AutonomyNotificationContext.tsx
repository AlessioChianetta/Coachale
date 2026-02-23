import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { getAuthUser, getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface AutonomyNotificationContextType {
  isAnalysisActive: boolean;
  activeRoleName: string;
  newResultsCount: number;
  clearNewResults: () => void;
}

const AutonomyNotificationContext = createContext<AutonomyNotificationContextType>({
  isAnalysisActive: false,
  activeRoleName: "",
  newResultsCount: 0,
  clearNewResults: () => {},
});

export function useAutonomyNotifications() {
  return useContext(AutonomyNotificationContext);
}

export function AutonomyNotificationProvider({ children }: { children: ReactNode }) {
  const [isAnalysisActive, setIsAnalysisActive] = useState(false);
  const [activeRoleName, setActiveRoleName] = useState("");
  const [newResultsCount, setNewResultsCount] = useState(() => {
    const saved = sessionStorage.getItem("autonomy_new_results");
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const clearNewResults = useCallback(() => {
    setNewResultsCount(0);
    sessionStorage.removeItem("autonomy_new_results");
  }, []);

  useEffect(() => {
    sessionStorage.setItem("autonomy_new_results", String(newResultsCount));
  }, [newResultsCount]);

  useEffect(() => {
    const user = getAuthUser();
    if (!user || user.role !== "consultant") return;

    const connect = () => {
      const token = getToken();
      if (!token) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(`/api/ai-autonomy/reasoning-stream?token=${encodeURIComponent(token)}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "cycle_start":
              setIsAnalysisActive(true);
              toast({
                title: "🧠 AI Autonomo",
                description: `${data.roleName || "AI"} sta analizzando...`,
              });
              break;

            case "role_start":
              if (data.roleName) {
                setActiveRoleName(data.roleName);
              }
              break;

            case "role_complete":
              if (data.tasksGenerated > 0) {
                setNewResultsCount((prev) => prev + data.tasksGenerated);
              }
              break;

            case "cycle_complete":
              setIsAnalysisActive(false);
              toast({
                title: "✅ Analisi completata",
                description: data.tasksGenerated > 0
                  ? `${data.tasksGenerated} nuovi task generati`
                  : "Nessun nuovo task",
              });
              break;

            case "step_complete":
              if (data.roleName) {
                setActiveRoleName(data.roleName);
              }
              break;
          }
        } catch (err) {
          console.error("[AutonomyNotification] Failed to parse SSE event:", err);
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [toast]);

  return (
    <AutonomyNotificationContext.Provider
      value={{ isAnalysisActive, activeRoleName, newResultsCount, clearNewResults }}
    >
      {children}
    </AutonomyNotificationContext.Provider>
  );
}
