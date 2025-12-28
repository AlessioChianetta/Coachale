import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Loader2, 
  MessageSquare, 
  FileText, 
  Sparkles, 
  Users, 
  Search,
  ChevronRight,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface AIPreferences {
  writingStyle: "default" | "professional" | "friendly" | "direct" | "eccentric" | "efficient" | "nerd" | "cynical" | "custom";
  responseLength: "short" | "balanced" | "comprehensive";
  customInstructions: string | null;
}

interface ClientWithPreferences {
  id: string;
  displayName: string;
  email: string;
  preferences: AIPreferences;
  hasCustomPreferences: boolean;
}

const DEFAULT_PREFERENCES: AIPreferences = {
  writingStyle: "professional",
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

export function ClientAIPreferencesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithPreferences | null>(null);
  const [localPreferences, setLocalPreferences] = useState<AIPreferences>(DEFAULT_PREFERENCES);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: clients, isLoading: isLoadingClients } = useQuery<ClientWithPreferences[]>({
    queryKey: ["/api/ai-assistant/consultant/clients-with-preferences"],
    queryFn: async () => {
      const response = await fetch("/api/ai-assistant/consultant/clients-with-preferences", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch clients");
      }
      return response.json();
    },
    enabled: isOpen,
  });

  const savePreferencesMutation = useMutation({
    mutationFn: async ({ clientId, preferences }: { clientId: string; preferences: AIPreferences }) => {
      const response = await fetch(`/api/ai-assistant/consultant/client/${clientId}/preferences`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });
      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/consultant/clients-with-preferences"] });
      toast({
        title: "Preferenze salvate",
        description: `Le preferenze AI di ${selectedClient?.displayName} sono state aggiornate.`,
      });
      setSelectedClient(null);
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Non è stato possibile salvare le preferenze. Riprova.",
        variant: "destructive",
      });
    },
  });

  const enhanceInstructionsMutation = useMutation({
    mutationFn: async (instructions: string) => {
      const response = await fetch("/api/ai-assistant/enhance-instructions", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instructions, mode: "enhance" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to enhance instructions");
      }
      return response.json();
    },
    onSuccess: (result) => {
      if (result.data?.enhanced) {
        setLocalPreferences((prev) => ({
          ...prev,
          customInstructions: result.data.enhanced,
        }));
        toast({
          title: "Istruzioni migliorate",
          description: `Da ${result.data.originalLength} a ${result.data.enhancedLength} caratteri`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Non è stato possibile migliorare le istruzioni.",
        variant: "destructive",
      });
    },
  });

  const handleEnhanceInstructions = () => {
    const instructions = localPreferences.customInstructions;
    if (!instructions || instructions.length < 20) {
      toast({
        title: "Testo insufficiente",
        description: "Scrivi almeno 20 caratteri prima di usare l'AI.",
        variant: "destructive",
      });
      return;
    }
    enhanceInstructionsMutation.mutate(instructions);
  };

  const handleSelectClient = (client: ClientWithPreferences) => {
    setSelectedClient(client);
    setLocalPreferences(client.preferences);
  };

  const handleSave = () => {
    if (!selectedClient) return;
    savePreferencesMutation.mutate({
      clientId: selectedClient.id,
      preferences: {
        ...localPreferences,
        customInstructions: localPreferences.customInstructions || null,
      },
    });
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

  const filteredClients = clients?.filter((client) =>
    client.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getStyleLabel = (style: string) => {
    return WRITING_STYLE_OPTIONS.find(o => o.value === style)?.label || style;
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setSelectedClient(null);
        setSearchQuery("");
      }
    }}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Gestisci Preferenze Clienti
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg">Preferenze AI Clienti</SheetTitle>
              <SheetDescription className="text-sm">
                Visualizza e modifica le preferenze AI dei tuoi clienti
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isLoadingClients ? (
          <div className="flex items-center justify-center py-12 flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : !selectedClient ? (
          <div className="flex-1 flex flex-col mt-4 overflow-hidden">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4">
                {filteredClients.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {clients?.length === 0 ? "Nessun cliente trovato" : "Nessun risultato per la ricerca"}
                  </div>
                ) : (
                  filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 cursor-pointer transition-all"
                      onClick={() => handleSelectClient(client)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{client.displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">{client.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {getStyleLabel(client.preferences.writingStyle)}
                          </Badge>
                          {client.preferences.customInstructions && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Sparkles className="h-3 w-3" />
                              Istruzioni custom
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex flex-col mt-4 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit mb-4"
              onClick={() => setSelectedClient(null)}
            >
              <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
              Torna alla lista
            </Button>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-3 mb-4">
              <div className="font-medium">{selectedClient.displayName}</div>
              <div className="text-xs text-muted-foreground">{selectedClient.email}</div>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-6 pr-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-600" />
                    <Label className="text-base font-semibold">Stile di Scrittura</Label>
                  </div>
                  <RadioGroup
                    value={localPreferences.writingStyle}
                    onValueChange={handleWritingStyleChange}
                    className="space-y-2"
                  >
                    {WRITING_STYLE_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className={`flex items-start space-x-3 p-2 rounded-lg border transition-all cursor-pointer ${
                          localPreferences.writingStyle === option.value
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                        }`}
                        onClick={() => handleWritingStyleChange(option.value)}
                      >
                        <RadioGroupItem value={option.value} id={`client-style-${option.value}`} className="mt-0.5" />
                        <div className="flex-1">
                          <Label htmlFor={`client-style-${option.value}`} className="font-medium cursor-pointer text-sm">
                            {option.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
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
                    className="space-y-2"
                  >
                    {RESPONSE_LENGTH_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className={`flex items-start space-x-3 p-2 rounded-lg border transition-all cursor-pointer ${
                          localPreferences.responseLength === option.value
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                        }`}
                        onClick={() => handleResponseLengthChange(option.value)}
                      >
                        <RadioGroupItem value={option.value} id={`client-length-${option.value}`} className="mt-0.5" />
                        <div className="flex-1">
                          <Label htmlFor={`client-length-${option.value}`} className="font-medium cursor-pointer text-sm">
                            {option.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-pink-600" />
                      <Label className="text-base font-semibold">Istruzioni Personalizzate</Label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEnhanceInstructions}
                      disabled={enhanceInstructionsMutation.isPending || !localPreferences.customInstructions || localPreferences.customInstructions.length < 20}
                      className="gap-1.5 text-xs h-7 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-purple-200"
                    >
                      {enhanceInstructionsMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Elaboro...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3 w-3" />
                          Migliora con AI
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scrivi istruzioni specifiche per questo cliente. Verranno applicate ogni volta che usa l'AI Assistant.
                  </p>
                  <Textarea
                    value={localPreferences.customInstructions || ""}
                    onChange={(e) => handleCustomInstructionsChange(e.target.value)}
                    placeholder="Es: Rispondi in modo empatico, usa esempi pratici relativi al suo settore..."
                    className="min-h-[120px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {(localPreferences.customInstructions || "").length}/2000 caratteri
                  </p>
                </div>
              </div>
            </ScrollArea>

            <SheetFooter className="mt-4 gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setSelectedClient(null)}
                disabled={savePreferencesMutation.isPending}
              >
                Annulla
              </Button>
              <Button
                onClick={handleSave}
                disabled={savePreferencesMutation.isPending}
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
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
