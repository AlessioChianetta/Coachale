import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";

export function useFollowupSettings() {
  return useQuery({
    queryKey: ["followup-settings"],
    queryFn: async () => {
      const res = await fetch("/api/followup/settings", {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });
}

export function useUpdateFollowupSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hoursWithoutReply: number) => {
      const res = await fetch("/api/followup/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({ hoursWithoutReply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update settings");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-settings"] });
      queryClient.invalidateQueries({ queryKey: ["followup-rules"] });
    },
  });
}

export function useFollowupRules() {
  return useQuery({
    queryKey: ["followup-rules"],
    queryFn: async () => {
      const res = await fetch("/api/followup/rules", {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch rules");
      return res.json();
    },
  });
}

export function useCreateFollowupRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/followup/rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-rules"] });
    },
  });
}

export function useToggleFollowupRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetch(`/api/followup/rules/${ruleId}/toggle`, {
        method: "PATCH",
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to toggle rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-rules"] });
    },
  });
}

export function useDeleteFollowupRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetch(`/api/followup/rules/${ruleId}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-rules"] });
    },
  });
}

export function useSeedDefaultRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/followup/rules/seed-defaults", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to seed default rules");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-rules"] });
    },
  });
}

export function useConversationStates() {
  return useQuery({
    queryKey: ["followup-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/followup/conversations", {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });
}

export function useUpdateConversationState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, state }: { id: string; state: string }) => {
      const res = await fetch(`/api/followup/conversations/${id}/state`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({ currentState: state }),
      });
      if (!res.ok) throw new Error("Failed to update state");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-conversations"] });
    },
  });
}

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/custom-templates", {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });
}

export function useAgentAssignedTemplates() {
  return useQuery({
    queryKey: ["agent-assigned-templates"],
    queryFn: async () => {
      const res = await fetch("/api/followup/agent-templates", {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch agent templates");
      return res.json();
    },
  });
}

export function useFollowupAnalytics() {
  return useQuery({
    queryKey: ["followup-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/followup/analytics", {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });
}

export function useGenerateRuleWithAI() {
  return useMutation({
    mutationFn: async (description: string) => {
      const res = await fetch("/api/followup/rules/generate-with-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Errore durante la generazione");
      }
      return res.json();
    },
  });
}

export function useGenerateTemplateWithAI() {
  return useMutation({
    mutationFn: async (description: string) => {
      const res = await fetch("/api/whatsapp/custom-templates/generate-with-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore durante la generazione del template");
      }
      return res.json();
    },
  });
}

export function useCreateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      templateName: string;
      templateType: string;
      description?: string;
      bodyText: string;
      variables?: Array<{ variableKey: string; position: number }>;
    }) => {
      const res = await fetch("/api/whatsapp/custom-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore durante la creazione del template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });
}

export function useSendMessageNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/followup/messages/${messageId}/send-now`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Errore durante l'invio del messaggio");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-log"] });
      queryClient.invalidateQueries({ queryKey: ["followup-scheduled"] });
      queryClient.invalidateQueries({ queryKey: ["followup-dashboard-stats"] });
    },
  });
}

export function useSimulateAiFollowup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await fetch(`/api/followup/conversations/${conversationId}/simulate-ai-followup`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Errore durante la simulazione");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-log"] });
      queryClient.invalidateQueries({ queryKey: ["followup-scheduled"] });
      queryClient.invalidateQueries({ queryKey: ["followup-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["followup-conversations"] });
    },
  });
}

export function useFollowupAgents() {
  return useQuery({
    queryKey: ["followup-agents"],
    queryFn: async () => {
      const res = await fetch("/api/followup/agents", {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });
}

export interface ActivityLogFilters {
  filter?: string;
  agentId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useActivityLog(filters: ActivityLogFilters = {}) {
  const params = new URLSearchParams();
  if (filters.filter) params.set("filter", filters.filter);
  if (filters.agentId) params.set("agentId", filters.agentId);
  if (filters.search) params.set("search", filters.search);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  params.set("limit", "50");

  return useQuery({
    queryKey: ["activity-log", filters],
    queryFn: async () => {
      const res = await fetch(`/api/followup/activity-log?${params.toString()}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch activity log");
      return res.json();
    },
    refetchInterval: 30000,
  });
}

export interface WeeklyStats {
  dailyChart: Array<{
    date: string;
    day: string;
    sent: number;
    pending: number;
    failed: number;
  }>;
  responseRates: {
    ai: { sent: number; replied: number; rate: number };
    template: { sent: number; replied: number; rate: number };
  };
  topErrors: Array<{ message: string; count: number }>;
}

export function useWeeklyStats() {
  return useQuery<WeeklyStats>({
    queryKey: ["followup-weekly-stats"],
    queryFn: async () => {
      const res = await fetch("/api/followup/stats/weekly", {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch weekly stats");
      return res.json();
    },
  });
}

export interface PendingQueueItem {
  conversationId: string;
  leadName: string;
  phoneNumber: string;
  nextCheckAt: string | null;
  isOverdue: boolean;
  currentState: string;
  followupCount: number;
  consecutiveNoReply: number;
  isDormant: boolean;
  dormantUntil: string | null;
}

export interface AgentPendingQueue {
  agentId: string;
  agentName: string;
  agentType: string;
  pending: PendingQueueItem[];
}

export interface PendingQueueData {
  agents: AgentPendingQueue[];
  totalPending: number;
  totalDormant: number;
}

export function usePendingQueue() {
  return useQuery<PendingQueueData>({
    queryKey: ["followup-pending-queue"],
    queryFn: async () => {
      const res = await fetch("/api/followup/pending-queue", {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch pending queue");
      return res.json();
    },
    refetchInterval: 60000,
  });
}

export interface AiPreferences {
  id?: string;
  consultantId?: string;
  maxFollowupsTotal: number;
  minHoursBetweenFollowups: number;
  workingHoursStart: number;
  workingHoursEnd: number;
  workingDays: number[];
  toneStyle: "professionale" | "amichevole" | "diretto" | "formale";
  messageLength: "breve" | "medio" | "dettagliato";
  useEmojis: boolean;
  aggressivenessLevel: number;
  persistenceLevel: number;
  firstFollowupDelayHours: number;
  templateNoResponseDelayHours: number;
  coldLeadReactivationDays: number;
  customInstructions?: string;
  businessContext?: string;
  targetAudience?: string;
  neverContactWeekends: boolean;
  respectHolidays: boolean;
  stopOnFirstNo: boolean;
  requireLeadResponseForFreeform: boolean;
  allowAiToSuggestTemplates: boolean;
  allowAiToWriteFreeformMessages: boolean;
  logAiReasoning: boolean;
  isActive: boolean;
}

export function useAiPreferences() {
  return useQuery<{ preferences: AiPreferences }>({
    queryKey: ["ai-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/followup/ai-preferences", {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch AI preferences");
      return res.json();
    },
  });
}

export function useUpdateAiPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<AiPreferences>) => {
      const res = await fetch("/api/followup/ai-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update AI preferences");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-preferences"] });
    },
  });
}
