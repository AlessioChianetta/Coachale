import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Bot,
  Clock,
  Settings2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Zap,
  Target,
  MessageSquare,
  Timer,
} from "lucide-react";

interface AISystemInfo {
  name: string;
  description: string;
  capabilities: Array<{ icon: string; label: string }>;
  defaultBehaviors: string[];
}

interface AIPreferences {
  maxFollowupsTotal: number;
  minHoursBetweenFollowups: number;
  firstFollowupDelayHours: number;
  templateNoResponseDelayHours: number;
  aggressivenessLevel: number;
  persistenceLevel: number;
  customInstructions: string;
}

const defaultPreferences: AIPreferences = {
  maxFollowupsTotal: 5,
  minHoursBetweenFollowups: 24,
  firstFollowupDelayHours: 24,
  templateNoResponseDelayHours: 48,
  aggressivenessLevel: 5,
  persistenceLevel: 5,
  customInstructions: "",
};

function getIconComponent(iconName: string) {
  const iconMap: Record<string, React.ReactNode> = {
    brain: <Brain className="h-4 w-4" />,
    bot: <Bot className="h-4 w-4" />,
    clock: <Clock className="h-4 w-4" />,
    sparkles: <Sparkles className="h-4 w-4" />,
    zap: <Zap className="h-4 w-4" />,
    target: <Target className="h-4 w-4" />,
    message: <MessageSquare className="h-4 w-4" />,
    timer: <Timer className="h-4 w-4" />,
  };
  return iconMap[iconName.toLowerCase()] || <Sparkles className="h-4 w-4" />;
}

function AISystemInfoCard({ data }: { data: AISystemInfo }) {
  return (
    <Card className="mb-6 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 dark:border-purple-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-lg">{data.name}</CardTitle>
            <CardDescription>{data.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Capacità
            </h4>
            <ul className="space-y-1">
              {data.capabilities.map((cap, idx) => (
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
              Comportamenti Default
            </h4>
            <ul className="space-y-1">
              {data.defaultBehaviors.map((behavior, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                  {behavior}
                </li>
              ))}
            </ul>
          </div>
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
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
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
  const [isStyleOpen, setIsStyleOpen] = useState(false);
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
        ...savedPreferences,
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
        description: "Le preferenze AI sono state aggiornate con successo.",
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

  const handleChange = <K extends keyof AIPreferences>(key: K, value: AIPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
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
              <Settings2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Preferenze AI</CardTitle>
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
            Personalizza il comportamento dell'AI per i follow-up automatici
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Parametri Base
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxFollowupsTotal">Max follow-up per lead</Label>
                <Input
                  id="maxFollowupsTotal"
                  type="number"
                  min={1}
                  max={20}
                  value={preferences.maxFollowupsTotal}
                  onChange={(e) => handleChange("maxFollowupsTotal", parseInt(e.target.value) || 5)}
                />
                <p className="text-xs text-muted-foreground">
                  Numero massimo di follow-up inviati per singolo lead
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minHoursBetweenFollowups">Attesa minima tra follow-up (ore)</Label>
                <Input
                  id="minHoursBetweenFollowups"
                  type="number"
                  min={1}
                  max={168}
                  value={preferences.minHoursBetweenFollowups}
                  onChange={(e) => handleChange("minHoursBetweenFollowups", parseInt(e.target.value) || 24)}
                />
                <p className="text-xs text-muted-foreground">
                  Ore minime da attendere tra un follow-up e il successivo
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Timing
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstFollowupDelayHours">Ritardo primo follow-up (ore)</Label>
                <Input
                  id="firstFollowupDelayHours"
                  type="number"
                  min={1}
                  max={168}
                  value={preferences.firstFollowupDelayHours}
                  onChange={(e) => handleChange("firstFollowupDelayHours", parseInt(e.target.value) || 24)}
                />
                <p className="text-xs text-muted-foreground">
                  Ore di attesa prima di inviare il primo follow-up
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateNoResponseDelayHours">Attesa dopo template senza risposta (ore)</Label>
                <Input
                  id="templateNoResponseDelayHours"
                  type="number"
                  min={1}
                  max={336}
                  value={preferences.templateNoResponseDelayHours}
                  onChange={(e) => handleChange("templateNoResponseDelayHours", parseInt(e.target.value) || 48)}
                />
                <p className="text-xs text-muted-foreground">
                  Ore di attesa se un template non riceve risposta
                </p>
              </div>
            </div>
          </div>

          <Collapsible open={isStyleOpen} onOpenChange={setIsStyleOpen}>
            <div className="border rounded-lg">
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-semibold">Stile</span>
                    <span className="text-xs text-muted-foreground">(opzionale)</span>
                  </div>
                  {isStyleOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Aggressività Follow-up</Label>
                      <span className="text-sm font-medium text-muted-foreground">
                        {preferences.aggressivenessLevel}/10
                      </span>
                    </div>
                    <Slider
                      value={[preferences.aggressivenessLevel]}
                      onValueChange={([value]) => handleChange("aggressivenessLevel", value)}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Livello basso: messaggi soft e meno frequenti. Livello alto: messaggi più diretti e insistenti.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Persistenza su Lead Freddi</Label>
                      <span className="text-sm font-medium text-muted-foreground">
                        {preferences.persistenceLevel}/10
                      </span>
                    </div>
                    <Slider
                      value={[preferences.persistenceLevel]}
                      onValueChange={([value]) => handleChange("persistenceLevel", value)}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Livello basso: abbandona presto i lead non responsivi. Livello alto: continua a seguire più a lungo.
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <div>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              Istruzioni Personalizzate
            </h3>
            <div className="space-y-2">
              <Label htmlFor="customInstructions">Istruzioni aggiuntive per l'AI</Label>
              <Textarea
                id="customInstructions"
                value={preferences.customInstructions}
                onChange={(e) => handleChange("customInstructions", e.target.value)}
                placeholder="Es: Usa sempre un tono professionale ma amichevole. Menziona sempre i benefici del nostro servizio. Non essere troppo insistente sui prezzi..."
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Aggiungi istruzioni specifiche per personalizzare il comportamento dell'AI
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
