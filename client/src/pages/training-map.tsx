import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { TrainingMapLayout } from "@/components/training/TrainingMapLayout";
import { PageLoader } from "@/components/page-loader";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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
        try {
          const response = await fetch(`/api/sales-scripts/${conversationDetail.usedScriptId}`);
          if (response.ok) {
            const script = await response.json();
            return script.structure || script;
          }
        } catch (e) {
          console.warn('[TRAINING MAP] Could not fetch script by ID, using snapshot');
        }
      }
      try {
        const response = await fetch(`/api/client/sales-agents/${agentId}/script`);
        if (!response.ok) return null;
        return response.json();
      } catch (e) {
        console.warn('[TRAINING MAP] Could not fetch global script');
        return null;
      }
    },
    enabled: !!agentId && !!conversationDetail,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (!conversationDetail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Training data not found</h1>
          <p className="text-muted-foreground">Could not load conversation details</p>
        </div>
      </div>
    );
  }

  // Prefer scriptSnapshot from conversation, fallback to fetched script
  const effectiveScript = conversationDetail?.scriptSnapshot || scriptStructure;

  if (!effectiveScript) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <h1 className="text-xl font-bold mb-2">Script non disponibile</h1>
          <p className="text-muted-foreground">Non è stato possibile caricare lo script di vendita per questa conversazione.</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setLocation(`/client/sales-agents/${agentId}/analytics`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna indietro
          </Button>
        </div>
      </div>
    );
  }

  const scriptChanged = conversationDetail?.usedScriptId && 
    effectiveScript?.id && 
    effectiveScript.id !== conversationDetail.usedScriptId;

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
          scriptStructure={effectiveScript}
          onBack={() => setLocation(`/client/sales-agents/${agentId}/analytics`)}
        />
      </div>
    </div>
  );
}
