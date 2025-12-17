import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Settings2,
  Sparkles,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  RefreshCw,
  Zap,
  Clock,
  Target,
} from "lucide-react";

interface AISystemInfo {
  name: string;
  description: string;
  capabilities: Array<{ icon: string; label: string }>;
  defaultBehaviors: string[];
}

interface AIPreferences {
  customInstructions: string;
}

const defaultPreferences: AIPreferences = {
  customInstructions: "",
};

function getIconComponent(iconName: string) {
  const iconMap: Record<string, React.ReactNode> = {
    brain: <Brain className="h-4 w-4" />,
    sparkles: <Sparkles className="h-4 w-4" />,
    zap: <Zap className="h-4 w-4" />,
    target: <Target className="h-4 w-4" />,
    message: <MessageSquare className="h-4 w-4" />,
    clock: <Clock className="h-4 w-4" />,
  };
  return iconMap[iconName.toLowerCase()] || <Sparkles className="h-4 w-4" />;
}

function AISystemInfoCard({ data }: { data: AISystemInfo }) {
  const capabilities = data?.capabilities || [];
  const defaultBehaviors = data?.defaultBehaviors || [];
  
  return (
    <Card className="mb-6 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 dark:border-purple-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-lg">{data?.name || "Sistema AI Follow-up"}</CardTitle>
            <CardDescription>{data?.description || "Sistema intelligente per la gestione automatica dei follow-up"}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Capacita
            </h4>
            <ul className="space-y-1">
              {capabilities.map((cap, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-purple-500">{getIconComponent(cap.icon)}</span>
                  {cap.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-indigo-500" />
              Comportamento Automatico
            </h4>
            <ul className="space-y-1">
              {defaultBehaviors.map((behavior, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                  {behavior}
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <RefreshCw className="h-4 w-4" />
            Logica Follow-up Intelligente
          </h4>
          <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-300">
            <li>1. Invio messaggio → Attesa risposta</li>
            <li>2. Se risponde → Reset contatore, continua conversazione</li>
            <li>3. Se ignora 3 volte → Dormienza 3 mesi</li>
            <li>4. Dopo 3 mesi → 1 ultimo tentativo</li>
            <li>5. Se ignora ancora → Esclusione permanente</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
      <AlertCircle className="h-5 w-5 text-red-500" />
      <div>
        <p className="font-medium text-red-700 dark:text-red-400">Errore nel caricamento</p>
        <p className="text-sm text-red-600 dark:text-red-500">{message}</p>
      </div>
    </div>
  );
}

export function AIPreferencesEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState<AIPreferences>(defaultPreferences);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: systemInfo, isLoading: isLoadingInfo, error: infoError } = useQuery<AISystemInfo>({
    queryKey: ["ai-system-info"],
    queryFn: async () => {
      const response = await fetch("/api/followup/ai-system-info", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Errore nel caricamento delle informazioni AI");
      }
      return response.json();
    },
  });

  const { data: savedPreferences, isLoading: isLoadingPrefs, error: prefsError } = useQuery<AIPreferences>({
    queryKey: ["ai-preferences"],
    queryFn: async () => {
      const response = await fetch("/api/followup/ai-preferences", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Errore nel caricamento delle preferenze AI");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (savedPreferences) {
      setPreferences({
        ...defaultPreferences,
        customInstructions: savedPreferences.customInstructions || "",
      });
      setHasChanges(false);
    }
  }, [savedPreferences]);

  const updateMutation = useMutation({
    mutationFn: async (data: AIPreferences) => {
      const response = await fetch("/api/followup/ai-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante il salvataggio");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Preferenze salvate",
        description: "Le istruzioni personalizzate sono state aggiornate.",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["ai-preferences"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChange = (value: string) => {
    setPreferences((prev) => ({ ...prev, customInstructions: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(preferences);
  };

  const isLoading = isLoadingInfo || isLoadingPrefs;
  const error = infoError || prefsError;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={(error as Error).message} />;
  }

  return (
    <div className="space-y-6">
      {systemInfo && <AISystemInfoCard data={systemInfo} />}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <CardTitle className="text-lg">Istruzioni Personalizzate</CardTitle>
            </div>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
              size="sm"
              className="gap-2"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salva
            </Button>
          </div>
          <CardDescription>
            Aggiungi istruzioni specifiche per personalizzare il comportamento dell'AI nei messaggi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="customInstructions">Istruzioni per l'AI</Label>
            <Textarea
              id="customInstructions"
              value={preferences.customInstructions}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Es: Usa sempre un tono professionale ma amichevole. Menziona sempre i benefici del nostro servizio. Non essere troppo insistente sui prezzi..."
              className="min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground">
              Queste istruzioni vengono usate dall'AI per generare messaggi personalizzati per i tuoi lead.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
