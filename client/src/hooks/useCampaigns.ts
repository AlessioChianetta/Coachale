import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  fetchCampaigns,
  fetchCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  fetchCampaignAnalytics,
  fetchCampaignWithLeads,
} from "@/lib/api/campaigns";
import type { InsertMarketingCampaign, UpdateMarketingCampaign } from "@db/schema";

export function useCampaigns(activeOnly?: boolean) {
  return useQuery({
    queryKey: ["campaigns", activeOnly],
    queryFn: () => fetchCampaigns(activeOnly),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: () => fetchCampaign(id),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<InsertMarketingCampaign, "consultantId">) => createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "✅ Campagna creata",
        description: "La campagna marketing è stata creata con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateCampaign(id: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: UpdateMarketingCampaign) => updateCampaign(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign", id] });
      toast({
        title: "✅ Campagna aggiornata",
        description: "La campagna è stata aggiornata con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "✅ Campagna eliminata",
        description: "La campagna è stata eliminata con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCampaignAnalytics(id: string) {
  return useQuery({
    queryKey: ["campaignAnalytics", id],
    queryFn: () => fetchCampaignAnalytics(id),
    enabled: !!id,
  });
}

export function useCampaignWithLeads(id: string) {
  return useQuery({
    queryKey: ["campaignWithLeads", id],
    queryFn: () => fetchCampaignWithLeads(id),
    enabled: !!id,
  });
}
