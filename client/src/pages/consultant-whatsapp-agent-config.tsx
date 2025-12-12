import { useRoute, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Bot, Lightbulb } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import WhatsAppLayout from "@/components/whatsapp/WhatsAppLayout";
import WhatsAppAgentWizard from "@/components/whatsapp/WhatsAppAgentWizard";
import { getAuthHeaders } from "@/lib/auth";

export default function ConsultantWhatsAppAgentConfig() {
  const [, params] = useRoute("/consultant/whatsapp/agent/:agentId");
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const agentId = params?.agentId === "new" ? null : params?.agentId;
  const isNewAgent = !agentId;
  
  const searchParams = new URLSearchParams(searchString);
  const fromIdeaId = searchParams.get("fromIdea");

  const { data: ideaData, isLoading: isLoadingIdea } = useQuery({
    queryKey: [`/api/consultant/onboarding/ai-ideas/${fromIdeaId}`],
    queryFn: async () => {
      if (!fromIdeaId) return null;
      const response = await fetch(`/api/consultant/onboarding/ai-ideas/${fromIdeaId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    },
    enabled: !!fromIdeaId && isNewAgent,
  });

  const markIdeaImplementedMutation = useMutation({
    mutationFn: async (data: { ideaId: string; agentId: string }) => {
      await fetch(`/api/consultant/onboarding/ai-ideas/${data.ideaId}/implement`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ implementedAgentId: data.agentId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/onboarding/ai-ideas"] });
    },
  });

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
  
  const getInitialDataFromIdea = () => {
    if (!ideaData) return undefined;
    
    const agentTypeMap: Record<string, string> = {
      reactive_lead: "reactive_lead",
      proactive_setter: "proactive_setter",
      informative_advisor: "informative_advisor",
    };
    
    const personalityMap: Record<string, string> = {
      professionale: "consulente_professionale",
      amichevole: "amico_fidato",
      empatico: "consigliere_empatico",
      diretto: "stratega_diretto",
    };
    
    return {
      agentName: ideaData.name || "",
      businessDescription: ideaData.description || "",
      agentType: agentTypeMap[ideaData.suggestedAgentType] || "reactive_lead",
      aiPersonality: personalityMap[ideaData.personality] || "amico_fidato",
      whoWeHelp: ideaData.whoWeHelp || "",
      whoWeDontHelp: ideaData.whoWeDontHelp || "",
      whatWeDo: ideaData.whatWeDo || "",
      howWeDoIt: ideaData.howWeDoIt || "",
      usp: ideaData.usp || "",
      agentInstructions: ideaData.suggestedInstructions || null,
      agentInstructionsEnabled: !!ideaData.suggestedInstructions,
      integrationMode: "ai_only" as const,
      twilioAccountSid: "",
      twilioAuthToken: "",
      twilioWhatsappNumber: "",
    };
  };

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
    
    const result = await response.json();
    const savedAgentId = result.data?.id || result.id;

    if (fromIdeaId && savedAgentId) {
      markIdeaImplementedMutation.mutate({ ideaId: fromIdeaId, agentId: savedAgentId });
    }

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

  if (isLoading || (fromIdeaId && isLoadingIdea)) {
    return (
      <WhatsAppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </WhatsAppLayout>
    );
  }
  
  const initialDataForWizard = existingConfig || getInitialDataFromIdea();

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
        
        {fromIdeaId && ideaData && (
          <Alert className="bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800">
            <Lightbulb className="h-5 w-5 text-purple-600" />
            <AlertDescription>
              <strong>Creazione da Idea AI:</strong> "{ideaData.name}"<br />
              <span className="text-sm text-muted-foreground">
                I campi sono stati pre-compilati con i dati dell'idea. Puoi modificarli prima di salvare.
              </span>
            </AlertDescription>
          </Alert>
        )}

        <WhatsAppAgentWizard
          mode={isNewAgent ? "create" : "edit"}
          initialData={initialDataForWizard}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </WhatsAppLayout>
  );
}
