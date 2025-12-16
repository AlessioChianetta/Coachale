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
