import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, AlertCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SystemRule {
  id: string;
  priority: number;
  label: string;
  description: string;
  decision: "STOP" | "ATTENDI" | "INVIA ORA";
  icon: string;
}

interface SystemRulesResponse {
  success: boolean;
  rules: SystemRule[];
  description: string;
}

function getDecisionStyles(decision: string) {
  switch (decision) {
    case "STOP":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "ATTENDI":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "INVIA ORA":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  }
}

function SystemRuleCard({ rule }: { rule: SystemRule }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
      <div className="text-2xl flex-shrink-0">{rule.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{rule.label}</span>
          <Badge variant="outline" className="text-xs">
            P{rule.priority}
          </Badge>
          <Badge className={`text-xs ${getDecisionStyles(rule.decision)}`}>
            {rule.decision}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Regola di sistema non modificabile</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
      <AlertCircle className="h-5 w-5 text-red-500" />
      <div>
        <p className="font-medium text-red-700 dark:text-red-400">Errore nel caricamento</p>
        <p className="text-sm text-red-600 dark:text-red-500">{message}</p>
      </div>
    </div>
  );
}

export function SystemRulesViewer() {
  const { data, isLoading, error } = useQuery<SystemRulesResponse>({
    queryKey: ["system-rules"],
    queryFn: async () => {
      const response = await fetch("/api/followup/system-rules", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Errore nel caricamento delle regole di sistema");
      }
      return response.json();
    },
  });

  const sortedRules = data?.rules?.sort((a, b) => b.priority - a.priority) || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Regole di Sistema</CardTitle>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Sistema
            </Badge>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p>Queste regole vengono valutate automaticamente prima dell'AI in ordine di priorità.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Regole deterministiche applicate automaticamente. Non modificabili.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="p-3 mb-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Queste regole sono valutate prima delle tue regole personalizzate. Se una regola di sistema si applica, le tue regole non vengono eseguite.
            </p>
          </div>
        </div>

        {isLoading && <LoadingSkeleton />}
        
        {error && <ErrorState message={(error as Error).message} />}
        
        {!isLoading && !error && sortedRules.length > 0 && (
          <div className="space-y-3">
            {sortedRules.map((rule) => (
              <SystemRuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        )}

        {!isLoading && !error && sortedRules.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nessuna regola di sistema configurata.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
