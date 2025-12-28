import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2, Loader2, MessageSquare, FileText, Sparkles } from "lucide-react";
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

interface AIPreferences {
  writingStyle: "default" | "professional" | "friendly" | "direct" | "eccentric" | "efficient" | "nerd" | "cynical" | "custom";
  responseLength: "short" | "balanced" | "comprehensive";
  customInstructions: string | null;
}

const DEFAULT_PREFERENCES: AIPreferences = {
  writingStyle: "default",
  responseLength: "balanced",
  customInstructions: null,
};

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

export function AIPreferencesSheet() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [localPreferences, setLocalPreferences] = useState<AIPreferences>(DEFAULT_PREFERENCES);

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
    };
    savePreferencesMutation.mutate(preferencesToSave);
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-pink-600" />
                <Label className="text-base font-semibold">Istruzioni Personalizzate</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Scrivi istruzioni specifiche su come vuoi che l'AI risponda. Queste istruzioni verranno sempre applicate indipendentemente dallo stile scelto.
              </p>
              <Textarea
                value={localPreferences.customInstructions || ""}
                onChange={(e) => handleCustomInstructionsChange(e.target.value)}
                placeholder="Es: Rispondi in modo empatico, usa esempi pratici, evita termini tecnici, parlami come se fossi un amico..."
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
