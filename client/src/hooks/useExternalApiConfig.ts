import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  fetchExternalApiConfigs,
  fetchExternalApiConfig,
  createExternalApiConfig,
  updateExternalApiConfig,
  deleteExternalApiConfig,
  testConnection,
  manualImport,
  startPolling,
  stopPolling,
  fetchImportLogs,
  type ExternalApiConfig,
} from "@/lib/api/external-api-config";

export function useExternalApiConfigs() {
  return useQuery({
    queryKey: ["external-api-configs"],
    queryFn: () => fetchExternalApiConfigs(),
  });
}

export function useExternalApiConfig(configId: string) {
  return useQuery({
    queryKey: ["external-api-config", configId],
    queryFn: () => fetchExternalApiConfig(configId),
    enabled: !!configId,
  });
}

export function useCreateExternalApiConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<ExternalApiConfig, "id" | "consultantId" | "createdAt" | "updatedAt">) =>
      createExternalApiConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-api-configs"] });
      toast({
        title: "✅ Configurazione salvata!",
        description: "La configurazione API è stata creata con successo.",
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

export function useUpdateExternalApiConfig(configId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Partial<Omit<ExternalApiConfig, "id" | "consultantId" | "createdAt" | "updatedAt">>) =>
      updateExternalApiConfig(configId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-api-configs"] });
      queryClient.invalidateQueries({ queryKey: ["external-api-config", configId] });
      toast({
        title: "✅ Configurazione salvata!",
        description: "La configurazione è stata aggiornata con successo.",
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

export function useDeleteExternalApiConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (configId: string) => deleteExternalApiConfig(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-api-configs"] });
      toast({
        title: "✅ Configurazione eliminata",
        description: "La configurazione è stata eliminata con successo.",
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

export function useTestConnection() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (configId: string) => {
      return await testConnection(configId);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "✅ Connessione API riuscita!",
          description: `Trovati ${data.totalLeads || 0} lead disponibili per l'importazione.`,
          variant: "default",
        });
      } else {
        toast({
          title: "❌ Errore connessione",
          description: data.error || "Impossibile connettersi all'API",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore connessione",
        description: error.message || "Errore durante il test della connessione",
        variant: "destructive",
      });
    },
  });
}

export function useManualImport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (configId: string) => manualImport(configId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["external-api-configs"] });
      toast({
        title: "✅ Importazione completata!",
        description: `Importati ${data.total} lead (${data.imported} nuovi, ${data.updated} aggiornati, ${data.duplicates} duplicati)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore importazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useStartPolling() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (configId: string) => startPolling(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-api-configs"] });
      toast({
        title: "✅ Polling avviato",
        description: "Il polling automatico è stato attivato con successo.",
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

export function useStopPolling() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (configId: string) => stopPolling(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-api-configs"] });
      toast({
        title: "✅ Polling fermato",
        description: "Il polling automatico è stato disattivato.",
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

export function useImportLogs(configId: string, limit: number = 50) {
  return useQuery({
    queryKey: ["import-logs", configId, limit],
    queryFn: () => fetchImportLogs(configId, limit),
    enabled: !!configId,
  });
}
