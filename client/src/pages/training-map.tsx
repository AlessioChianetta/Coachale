import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { TrainingMapLayout } from "@/components/training/TrainingMapLayout";
import { PageLoader } from "@/components/page-loader";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function TrainingMapPage() {
  const { agentId, conversationId } = useParams<{ agentId: string; conversationId: string }>();
  const [, setLocation] = useLocation();

  const { data: conversationDetail, isLoading } = useQuery({
    queryKey: ['/api/client/sales-agents/:agentId/training/conversation/:conversationId', agentId, conversationId],
    queryFn: async () => {
      const response = await fetch(`/api/client/sales-agents/${agentId}/training/conversation/${conversationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversation details');
      }
      return response.json();
    },
    enabled: !!agentId && !!conversationId,
  });

  const { data: scriptStructure, isLoading: isLoadingScript } = useQuery({
    queryKey: ['/api/client/sales-agents/:agentId/script', agentId, conversationDetail?.usedScriptId],
    queryFn: async () => {
      if (conversationDetail?.usedScriptId) {
        const response = await fetch(`/api/sales-scripts/${conversationDetail.usedScriptId}`);
        if (response.ok) {
          const script = await response.json();
          return script.structure || script;
        }
      }
      const response = await fetch(`/api/client/sales-agents/${agentId}/script`);
      if (!response.ok) throw new Error('Failed to fetch script structure');
      return response.json();
    },
    enabled: !!agentId && !!conversationDetail,
  });

  if (isLoading || isLoadingScript) {
    return <PageLoader />;
  }

  if (!conversationDetail || !scriptStructure) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Training data not found</h1>
          <p className="text-muted-foreground">Could not load conversation details</p>
        </div>
      </div>
    );
  }

  const scriptChanged = conversationDetail?.usedScriptId && 
    scriptStructure?.id && 
    scriptStructure.id !== conversationDetail.usedScriptId;

  return (
    <div className="flex flex-col h-screen">
      {scriptChanged && (
        <Alert className="m-4 mb-0 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Script cambiato</AlertTitle>
          <AlertDescription>
            Lo script attuale è diverso da quello usato in questa conversazione. 
            Stai visualizzando lo script corrente perché quello originale non è più disponibile.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex-1 overflow-hidden">
        <TrainingMapLayout
          conversationDetail={conversationDetail}
          scriptStructure={scriptStructure}
          onBack={() => setLocation(`/client/sales-agents/${agentId}/analytics`)}
        />
      </div>
    </div>
  );
}
