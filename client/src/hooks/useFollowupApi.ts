import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";

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
