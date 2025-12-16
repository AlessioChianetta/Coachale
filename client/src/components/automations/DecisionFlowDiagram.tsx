import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowDown, 
  Shield, 
  Brain,
  ChevronRight
} from "lucide-react";

interface SystemRule {
  id: string;
  priority: number;
  label: string;
  description: string;
  decision: "STOP" | "ATTENDI" | "INVIA ORA";
  icon: string;
}

function getDecisionColor(decision: string) {
  switch (decision) {
    case "STOP":
      return "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800";
    case "ATTENDI":
      return "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800";
    case "INVIA ORA":
      return "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

function RuleStep({ 
  order, 
  rule, 
  isLast 
}: { 
  order: number; 
  rule: SystemRule; 
  isLast: boolean;
}) {
  return (
    <div className="relative">
      <div className={`flex items-start gap-3 p-3 rounded-lg border ${getDecisionColor(rule.decision)}`}>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center font-bold text-sm border shadow-sm">
          {order}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{rule.icon}</span>
            <span className="font-semibold text-sm">{rule.label}</span>
            <Badge variant="outline" className="text-xs">
              P{rule.priority}
            </Badge>
          </div>
          <p className="text-xs mt-1 opacity-80">{rule.description}</p>
        </div>
        <div className="flex-shrink-0">
          <Badge className={`text-xs ${
            rule.decision === "STOP" ? "bg-red-600" :
            rule.decision === "ATTENDI" ? "bg-yellow-600" :
            "bg-green-600"
          } text-white`}>
            {rule.decision}
          </Badge>
        </div>
      </div>
      {!isLast && (
        <div className="flex justify-center py-1">
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i}>
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
          {i < 6 && (
            <div className="flex justify-center py-1">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function DecisionFlowDiagram() {
  const { data, isLoading, error } = useQuery<{ rules: SystemRule[] }>({
    queryKey: ["system-rules"],
    queryFn: async () => {
      const response = await fetch("/api/followup/system-rules", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch system rules");
      return response.json();
    },
  });

  const rules = data?.rules?.sort((a, b) => b.priority - a.priority) || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg">Flusso Decisionale</CardTitle>
        </div>
        <CardDescription>
          Le regole vengono valutate dall'alto verso il basso. La prima che matcha determina l'azione.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Entry point */}
          <div className="flex items-center justify-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 mb-2">
            <span className="text-lg">📥</span>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Lead da valutare
            </span>
            <ChevronRight className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-blue-600 dark:text-blue-400">
              Valutazione ogni 5 minuti
            </span>
          </div>

          <div className="flex justify-center py-1">
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* System Rules Section */}
          <div className="border-l-4 border-blue-500 pl-3 space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                Fase 1: Regole di Sistema
              </span>
              <Badge variant="secondary" className="text-xs">Non modificabili</Badge>
            </div>

            {isLoading && <LoadingSkeleton />}
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                Errore nel caricamento delle regole
              </div>
            )}

            {!isLoading && !error && rules.map((rule, index) => (
              <RuleStep
                key={rule.id}
                order={index + 1}
                rule={rule}
                isLast={index === rules.length - 1}
              />
            ))}
          </div>

          <div className="flex justify-center py-1">
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* AI Decision */}
          <div className="border-l-4 border-purple-500 pl-3">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                Fase 2: Decisione AI
              </span>
            </div>
            
            <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🤖</span>
                <span className="font-semibold text-sm text-purple-700 dark:text-purple-300">
                  Nessuna regola matchata → AI analizza
                </span>
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Se nessuna regola di sistema si applica, l'AI analizza la conversazione e decide:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge className="bg-green-600 text-white text-xs">INVIA ORA</Badge>
                <Badge className="bg-blue-600 text-white text-xs">PROGRAMMA</Badge>
                <Badge className="bg-yellow-600 text-white text-xs">SALTA</Badge>
                <Badge className="bg-red-600 text-white text-xs">STOP</Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
