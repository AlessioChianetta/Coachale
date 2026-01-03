import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2, Loader2, MessageSquare, FileText, Sparkles, Bot, Lightbulb, Brain, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type AIModel = "gemini-3-flash-preview" | "gemini-3-pro-preview";
type ThinkingLevel = "none" | "low" | "medium" | "high";

interface AIPreferences {
  writingStyle: "default" | "professional" | "friendly" | "direct" | "eccentric" | "efficient" | "nerd" | "cynical" | "custom";
  responseLength: "short" | "balanced" | "comprehensive";
  customInstructions: string | null;
  defaultSystemInstructions?: string | null;
  consultantDefaultInstructions?: string | null;
  preferredModel?: AIModel;
  thinkingLevel?: ThinkingLevel;
}

const DEFAULT_PREFERENCES: AIPreferences = {
  writingStyle: "default",
  responseLength: "balanced",
  customInstructions: null,
  defaultSystemInstructions: null,
  consultantDefaultInstructions: null,
  preferredModel: "gemini-3-flash-preview",
  thinkingLevel: "none",
};

const MODEL_OPTIONS = [
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Veloce e versatile" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro", description: "Ragionamento avanzato" },
];

const THINKING_LEVEL_OPTIONS = [
  { value: "none", label: "Nessuno", description: "Risposta diretta" },
  { value: "low", label: "Basso", description: "Ragionamento breve" },
  { value: "medium", label: "Medio", description: "Ragionamento moderato" },
  { value: "high", label: "Alto", description: "Ragionamento approfondito" },
];

const WRITING_STYLE_OPTIONS = [
  { value: "default", label: "Predefinito", description: "Stile e tono predefiniti" },
  { value: "professional", label: "Professionale", description: "Cortese e preciso" },
  { value: "friendly", label: "Amichevole", description: "Espansivo e loquace" },
  { value: "direct", label: "Schietto", description: "Diretto e incoraggiante" },
  { value: "eccentric", label: "Eccentrico", description: "Vivace e fantasioso" },
  { value: "efficient", label: "Efficiente", description: "Essenziale e semplice" },
  { value: "nerd", label: "Nerd", description: "Curioso e appassionato" },
  { value: "cynical", label: "Cinico", description: "Critico e sarcastico" },
  { value: "custom", label: "Personalizzato", description: "Usa istruzioni personalizzate" },
];

const RESPONSE_LENGTH_OPTIONS = [
  { value: "short", label: "Breve", description: "1-2 paragrafi" },
  { value: "balanced", label: "Bilanciata", description: "Lunghezza moderata" },
  { value: "comprehensive", label: "Completa", description: "Dettagliata e completa" },
];

const INSTRUCTION_PRESET_OPTIONS = [
  { 
    value: "none", 
    label: "Nessun preset", 
    description: "Usa le tue istruzioni personalizzate",
    instructions: ""
  },
  { 
    value: "business_coach", 
    label: "Business Coach", 
    description: "Strategie e sviluppo aziendale",
    instructions: "Sei un business coach esperto. Aiuta l'utente a sviluppare strategie aziendali efficaci, ottimizzare i processi, migliorare la leadership e raggiungere obiettivi di crescita. Fornisci consigli pratici e azioni concrete, usa esempi reali dal mondo business."
  },
  { 
    value: "finance", 
    label: "Consulente Finanziario", 
    description: "Pianificazione e investimenti",
    instructions: "Sei un consulente finanziario professionale. Aiuta l'utente con pianificazione finanziaria, investimenti, gestione del budget e obiettivi di risparmio. Spiega concetti finanziari in modo chiaro, offri analisi equilibrate dei rischi e opportunità."
  },
  { 
    value: "platform_assistance", 
    label: "Assistenza Piattaforma", 
    description: "Supporto tecnico e guida",
    instructions: "Sei un assistente della piattaforma. Guida l'utente nell'utilizzo delle funzionalità, risolvi problemi tecnici, spiega come sfruttare al meglio tutti gli strumenti disponibili. Rispondi in modo chiaro e passo-passo."
  },
  { 
    value: "life_coach", 
    label: "Life Coach", 
    description: "Sviluppo personale e motivazione",
    instructions: "Sei un life coach empatico e motivante. Aiuta l'utente a definire e raggiungere obiettivi personali, superare ostacoli, migliorare le relazioni e trovare equilibrio. Ascolta attivamente, fai domande potenti e offri prospettive costruttive."
  },
  { 
    value: "marketing", 
    label: "Esperto Marketing", 
    description: "Strategie digitali e brand",
    instructions: "Sei un esperto di marketing digitale. Aiuta l'utente con strategie di marketing, branding, social media, content marketing, SEO e campagne pubblicitarie. Offri idee creative, analisi del target e metriche di successo."
  },
];

export function AIPreferencesSheet() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [localPreferences, setLocalPreferences] = useState<AIPreferences>(DEFAULT_PREFERENCES);
  const [selectedPreset, setSelectedPreset] = useState<string>("none");

  const { data: userProfile } = useQuery<{ role: string }>({
    queryKey: ["/api/user/profile"],
    queryFn: async () => {
      const response = await fetch("/api/user/profile", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { role: "client" };
      return response.json();
    },
  });

  const isConsultant = userProfile?.role === "consultant";

  const { data: preferences, isLoading } = useQuery<AIPreferences>({
    queryKey: ["/api/ai-assistant/preferences"],
    queryFn: async () => {
      const response = await fetch("/api/ai-assistant/preferences", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return DEFAULT_PREFERENCES;
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  const savePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: AIPreferences) => {
      const response = await fetch("/api/ai-assistant/preferences", {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newPreferences),
      });
      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/preferences"] });
      toast({
        title: "Preferenze salvate",
        description: "Le tue preferenze AI sono state aggiornate con successo.",
      });
      setIsOpen(false);
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Non è stato possibile salvare le preferenze. Riprova.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const preferencesToSave = {
      ...localPreferences,
      customInstructions: localPreferences.customInstructions || null,
      defaultSystemInstructions: isConsultant ? (localPreferences.defaultSystemInstructions || null) : undefined,
      preferredModel: localPreferences.preferredModel || "gemini-3-flash-preview",
      thinkingLevel: localPreferences.thinkingLevel || "none",
    };
    savePreferencesMutation.mutate(preferencesToSave);
  };

  const handleDefaultSystemInstructionsChange = (value: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      defaultSystemInstructions: value,
    }));
  };

  const handleWritingStyleChange = (value: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      writingStyle: value as AIPreferences["writingStyle"],
    }));
  };

  const handleResponseLengthChange = (value: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      responseLength: value as AIPreferences["responseLength"],
    }));
  };

  const handleCustomInstructionsChange = (value: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      customInstructions: value,
    }));
  };

  const handleModelChange = (value: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      preferredModel: value as AIModel,
    }));
  };

  const handleThinkingLevelChange = (value: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      thinkingLevel: value as ThinkingLevel,
    }));
  };

  const handlePresetChange = (presetValue: string) => {
    setSelectedPreset(presetValue);
    const preset = INSTRUCTION_PRESET_OPTIONS.find(p => p.value === presetValue);
    if (preset) {
      setLocalPreferences((prev) => ({
        ...prev,
        customInstructions: preset.instructions || "",
      }));
    }
  };

  const handleCustomInstructionsManualChange = (value: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      customInstructions: value,
    }));
    const currentPreset = INSTRUCTION_PRESET_OPTIONS.find(p => p.value === selectedPreset);
    if (currentPreset && value !== currentPreset.instructions) {
      setSelectedPreset("none");
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Preferenze AI"
        >
          <Settings2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg">Preferenze AI</SheetTitle>
              <SheetDescription className="text-sm">
                Personalizza come l'AI risponde alle tue domande
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-green-600" />
                <Label className="text-base font-semibold">Modello AI</Label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MODEL_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => handleModelChange(option.value)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all text-center ${
                      localPreferences.preferredModel === option.value
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-indigo-600" />
                <Label className="text-base font-semibold">Livello Ragionamento</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Quanto l'AI deve mostrare il suo processo di pensiero
              </p>
              <div className="grid grid-cols-4 gap-2">
                {THINKING_LEVEL_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => handleThinkingLevelChange(option.value)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all text-center ${
                      localPreferences.thinkingLevel === option.value
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-600" />
                <Label className="text-base font-semibold">Stile di Scrittura</Label>
              </div>
              <RadioGroup
                value={localPreferences.writingStyle}
                onValueChange={handleWritingStyleChange}
                className="space-y-3"
              >
                {WRITING_STYLE_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      localPreferences.writingStyle === option.value
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => handleWritingStyleChange(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={`style-${option.value}`} className="mt-0.5" />
                    <div className="flex-1">
                      <Label
                        htmlFor={`style-${option.value}`}
                        className="font-medium cursor-pointer"
                      >
                        {option.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <Label className="text-base font-semibold">Lunghezza Risposte</Label>
              </div>
              <RadioGroup
                value={localPreferences.responseLength}
                onValueChange={handleResponseLengthChange}
                className="space-y-3"
              >
                {RESPONSE_LENGTH_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      localPreferences.responseLength === option.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => handleResponseLengthChange(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={`length-${option.value}`} className="mt-0.5" />
                    <div className="flex-1">
                      <Label
                        htmlFor={`length-${option.value}`}
                        className="font-medium cursor-pointer"
                      >
                        {option.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {isConsultant && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-teal-600" />
                    <Label className="text-base font-semibold">Istruzioni Base del Sistema</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Definisci le istruzioni base che l'AI userà per tutti i tuoi clienti. Queste istruzioni sostituiscono il prompt predefinito del sistema.
                  </p>
                  <Textarea
                    value={localPreferences.defaultSystemInstructions || ""}
                    onChange={(e) => handleDefaultSystemInstructionsChange(e.target.value)}
                    placeholder="Es: Sei un assistente virtuale per consulenti finanziari. Aiuti i clienti a raggiungere i loro obiettivi finanziari in modo chiaro e professionale..."
                    className="min-h-[120px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {(localPreferences.defaultSystemInstructions || "").length}/1000 caratteri
                  </p>
                </div>
                <Separator />
              </>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <Label className="text-base font-semibold">Template Istruzioni</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Scegli un ruolo predefinito per configurare rapidamente le istruzioni dell'AI.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {INSTRUCTION_PRESET_OPTIONS.map((preset) => (
                  <div
                    key={preset.value}
                    onClick={() => handlePresetChange(preset.value)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedPreset === preset.value
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <p className="font-medium text-sm">{preset.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-pink-600" />
                <Label className="text-base font-semibold">Istruzioni Personalizzate</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {isConsultant 
                  ? "Istruzioni aggiuntive per te stesso. Queste si sommano alle istruzioni base del sistema."
                  : "Scrivi istruzioni specifiche su come vuoi che l'AI risponda. Queste istruzioni verranno sempre applicate indipendentemente dallo stile scelto."
                }
              </p>
              {!isConsultant && preferences?.consultantDefaultInstructions && (
                <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-700">
                  <p className="text-xs text-teal-700 dark:text-teal-300 font-medium mb-1">Istruzioni base dal tuo consulente:</p>
                  <p className="text-xs text-teal-600 dark:text-teal-400 italic">{preferences.consultantDefaultInstructions}</p>
                </div>
              )}
              <Textarea
                value={localPreferences.customInstructions || ""}
                onChange={(e) => handleCustomInstructionsManualChange(e.target.value)}
                placeholder={
                  !isConsultant && preferences?.consultantDefaultInstructions
                    ? "Aggiungi istruzioni aggiuntive a quelle del tuo consulente..."
                    : "Es: Rispondi in modo empatico, usa esempi pratici, evita termini tecnici, parlami come se fossi un amico..."
                }
                className="min-h-[120px] resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {(localPreferences.customInstructions || "").length}/500 caratteri
              </p>
            </div>
          </div>
        )}

        <SheetFooter className="mt-8 gap-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={savePreferencesMutation.isPending}
          >
            Annulla
          </Button>
          <Button
            onClick={handleSave}
            disabled={savePreferencesMutation.isPending || isLoading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
          >
            {savePreferencesMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : (
              "Salva Preferenze"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
