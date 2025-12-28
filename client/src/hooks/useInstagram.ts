import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";

export function useInstagramConfig() {
  return useQuery({
    queryKey: ["/api/instagram/config"],
    queryFn: async () => {
      const response = await fetch("/api/instagram/config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch Instagram config");
      return response.json();
    },
  });
}

export function useInstagramStats() {
  return useQuery({
    queryKey: ["/api/instagram/stats"],
    queryFn: async () => {
      const response = await fetch("/api/instagram/stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch Instagram stats");
      return response.json();
    },
  });
}

export function useInstagramConversations(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["/api/instagram/conversations"],
    queryFn: async () => {
      const response = await fetch("/api/instagram/conversations", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
    refetchInterval: options?.refetchInterval || 5000,
  });
}

export function useInstagramMessages(conversationId: string | null, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["/api/instagram/conversations", conversationId, "messages"],
    queryFn: async () => {
      if (!conversationId) return null;
      const response = await fetch(`/api/instagram/conversations/${conversationId}/messages`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: !!conversationId,
    refetchInterval: conversationId ? (options?.refetchInterval || 5000) : false,
  });
}

export function useSaveInstagramConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      const response = await fetch("/api/instagram/config", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error("Failed to save config");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/config"] });
    },
  });
}

export function useTestInstagramConnection() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/instagram/config/test-connection", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Connection test failed");
      }
      return response.json();
    },
  });
}
