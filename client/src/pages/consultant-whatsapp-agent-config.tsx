import { useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Bot } from "lucide-react";
import WhatsAppLayout from "@/components/whatsapp/WhatsAppLayout";
import WhatsAppAgentWizard from "@/components/whatsapp/WhatsAppAgentWizard";
import { getAuthHeaders } from "@/lib/auth";

export default function ConsultantWhatsAppAgentConfig() {
  const [, params] = useRoute("/consultant/whatsapp/agent/:agentId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const agentId = params?.agentId === "new" ? null : params?.agentId;
  const isNewAgent = !agentId;

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: [`/api/whatsapp/config/${agentId}`],
    queryFn: async () => {
      if (!agentId) return null;
      const response = await fetch(`/api/whatsapp/config/${agentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to load config");
      const result = await response.json();
      return result.data || result;
    },
    enabled: !!agentId,
  });

  const handleSave = async (formData: any) => {
    const url = agentId
      ? `/api/whatsapp/config/${agentId}`
      : "/api/whatsapp/config";
    const method = agentId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      throw new Error("Failed to save configuration");
    }

    // INVALIDATE TUTTE le query correlate a whatsapp config (lista, singolo agente, istruzioni, variabili)
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/whatsapp/config");
      },
    });
    navigate("/consultant/whatsapp");
  };

  const handleCancel = () => {
    navigate("/consultant/whatsapp");
  };

  if (isLoading) {
    return (
      <WhatsAppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </WhatsAppLayout>
    );
  }

  return (
    <WhatsAppLayout>
      <div className="space-y-6 pb-12">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/consultant/whatsapp")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-8 w-8 text-green-600" />
              {isNewAgent ? "Nuovo Agente WhatsApp" : `Modifica: ${existingConfig?.agentName}`}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isNewAgent 
                ? "Crea un nuovo agente WhatsApp AI seguendo gli step guidati" 
                : "Modifica la configurazione del tuo agente WhatsApp AI"}
            </p>
          </div>
        </div>

        <WhatsAppAgentWizard
          mode={isNewAgent ? "create" : "edit"}
          initialData={existingConfig}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </WhatsAppLayout>
  );
}
