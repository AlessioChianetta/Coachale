import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { TrainingMapLayout } from "@/components/training/TrainingMapLayout";
import { PageLoader } from "@/components/page-loader";

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
    queryKey: ['/api/client/sales-agents/:agentId/script', agentId],
    queryFn: async () => {
      const response = await fetch(`/api/client/sales-agents/${agentId}/script`);
      if (!response.ok) {
        throw new Error('Failed to fetch script structure');
      }
      return response.json();
    },
    enabled: !!agentId,
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

  return (
    <TrainingMapLayout
      conversationDetail={conversationDetail}
      scriptStructure={scriptStructure}
      onBack={() => setLocation(`/client/sales-agents/${agentId}/analytics`)}
    />
  );
}
