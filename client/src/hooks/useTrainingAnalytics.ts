import { useQuery } from '@tanstack/react-query';

export interface PhaseFlowData {
  totalConversations: number;
  phaseCompletionRates: Record<string, number>;
  averagePhaseTransitionTime: Record<string, number>;
}

export interface LadderAnalyticsData {
  totalActivations: number;
  averageDepth: number;
  activationsByPhase: Record<string, number>;
  depthDistribution: {
    depth_1: number;
    depth_2: number;
    depth_3: number;
    depth_4: number;
    depth_5_plus: number;
  };
}

export interface ObjectionData {
  objection: string;
  frequency: number;
  resolved: number;
  notResolved: number;
  resolutionRate: number;
}

export interface ObjectionHandlingData {
  totalObjections: number;
  objections: ObjectionData[];
}

export interface ContextualResponse {
  timestamp: string;
  conversationId: string;
  question: string;
  response: string;
  phase: string;
}

export interface AIReasoningData {
  totalReasoningEntries: number;
  reasoningByType: Record<string, number>;
  contextualResponses: ContextualResponse[];
}

export interface TrainingAnalyticsData {
  phaseFlow: PhaseFlowData;
  ladderAnalytics: LadderAnalyticsData;
  objectionHandling: ObjectionHandlingData;
  aiReasoning: AIReasoningData;
}

async function fetchTrainingAnalytics(agentId: string): Promise<TrainingAnalyticsData> {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`/api/training/analytics/${agentId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch training analytics');
  }
  
  const result = await response.json();
  return result.data;
}

export function useTrainingAnalytics(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ['training-analytics', agentId],
    queryFn: () => fetchTrainingAnalytics(agentId!),
    enabled: !!agentId,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
