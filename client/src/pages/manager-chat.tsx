import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Menu, 
  X, 
  LogOut, 
  Loader2,
  Bot,
  Settings2,
  Sparkles,
  MessageSquare,
  FileText,
  Brain,
  Cpu,
  UserCircle,
  RefreshCw,
  Calendar,
  Hash,
  Tag,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageList } from "@/components/ai-assistant/MessageList";
import { InputArea, AIModel, ThinkingLevel } from "@/components/ai-assistant/InputArea";
import { WelcomeScreen } from "@/components/ai-assistant/WelcomeScreen";
import { ConversationSidebar } from "@/components/ai-assistant/ConversationSidebar";
import { UpgradeBanner } from "@/components/ai-assistant/UpgradeBanner";
import { ProfileSettingsSheet } from "@/components/ai-assistant/ProfileSettingsSheet";
import { UpgradeSuccessDialog } from "@/components/manager/UpgradeSuccessDialog";
import { OnboardingWizard } from "@/components/manager/OnboardingWizard";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  isThinking?: boolean;
  modelName?: string;
  thinkingLevel?: string;
}

interface AgentInfo {
  id: string;
  agentName: string;
  description: string | null;
  requiresLogin: boolean;
  businessName: string | null;
  consultantName: string | null;
  // Extended agent info
  whoWeHelp: string | null;
  whatWeDo: string | null;
  howWeDoIt: string | null;
  usp: string | null;
  mission: string | null;
  vision: string | null;
}

interface ManagerInfo {
  id: string;
  name: string;
  email: string;
  isBronze?: boolean;
  dailyMessagesUsed?: number;
  dailyMessageLimit?: number;
  remaining?: number;
  consultantSlug?: string | null;
  tier?: "bronze" | "silver" | "gold";
  level?: "2" | "3";
  hasCompletedOnboarding?: boolean;
}

interface ManagerPreferences {
  writingStyle: "default" | "professional" | "friendly" | "direct" | "eccentric" | "efficient" | "nerd" | "cynical" | "custom";
  responseLength: "short" | "balanced" | "comprehensive";
  customInstructions: string | null;
  aiModel?: "gemini-3-flash-preview" | "gemini-3-pro-preview";
  thinkingLevel?: "none" | "low" | "medium" | "high";
}

const DEFAULT_PREFERENCES: ManagerPreferences = {
  writingStyle: "eccentric",
  responseLength: "balanced",
  customInstructions: null,
  aiModel: "gemini-3-flash-preview",
  thinkingLevel: "none",
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

const AI_MODEL_OPTIONS = [
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Veloce e bilanciato (default)" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro", description: "Ragionamento avanzato" },
];

const THINKING_LEVEL_OPTIONS = [
  { value: "none", label: "Nessuno", description: "Risposte dirette" },
  { value: "low", label: "Basso", description: "Ragionamento leggero" },
  { value: "medium", label: "Medio", description: "Ragionamento moderato" },
  { value: "high", label: "Alto", description: "Ragionamento approfondito" },
];

const INSTRUCTION_PRESETS = [
  { value: "none", label: "Nessun preset", prompt: "" },
  { value: "business_coach", label: "Business Coach", prompt: "Agisci come un business coach esperto. Fornisci consigli pratici per la crescita aziendale, analisi strategiche e supporto decisionale. Usa un tono motivante ma professionale." },
  { value: "finance", label: "Consulente Finanziario", prompt: "Agisci come un consulente finanziario esperto. Aiuta con pianificazione finanziaria, investimenti, budget e strategie fiscali. Sii preciso e pratico." },
  { value: "platform", label: "Assistenza Piattaforma", prompt: "Aiuta l'utente a utilizzare la piattaforma. Spiega funzionalità, risolvi problemi tecnici e guida passo-passo. Sii chiaro e paziente." },
  { value: "life_coach", label: "Life Coach", prompt: "Agisci come un life coach. Aiuta con obiettivi personali, motivazione, produttività e equilibrio vita-lavoro. Sii empatico e incoraggiante." },
  { value: "marketing", label: "Esperto Marketing", prompt: "Agisci come esperto di marketing digitale. Consiglia su strategie social, content marketing, SEO e campagne pubblicitarie. Sii creativo e orientato ai risultati." },
  { value: "sales_coach", label: "Sales Coach", prompt: "Agisci come un sales coach esperto. Aiuta con tecniche di vendita, negoziazione, gestione obiezioni e closing. Sii persuasivo ma autentico, orientato ai risultati." },
];

function getManagerToken(): string | null {
  // Check manager_token first, then bronzeAuthToken, then fallback to unified login token (for Bronze/Silver users)
  return localStorage.getItem("manager_token") || localStorage.getItem("bronzeAuthToken") || localStorage.getItem("token");
}

function getManagerAuthHeaders(): Record<string, string> {
  const token = getManagerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isBronzeSilverUser(): boolean {
  const userStr = localStorage.getItem("user");
  if (!userStr) return false;
  try {
    const user = JSON.parse(userStr);
    return user.tier === "bronze" || user.tier === "silver";
  } catch {
    return false;
  }
}

interface ManagerAIPreferencesSheetProps {
  slug: string;
}

function ManagerAIPreferencesSheet({ slug }: ManagerAIPreferencesSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [localPreferences, setLocalPreferences] = useState<ManagerPreferences>(DEFAULT_PREFERENCES);
  const [selectedPreset, setSelectedPreset] = useState<string>("none");

  const { data: preferences, isLoading } = useQuery<ManagerPreferences>({
    queryKey: ["manager-preferences", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/agent/${slug}/manager/preferences`, {
        headers: getManagerAuthHeaders(),
      });
      if (!response.ok) {
        return DEFAULT_PREFERENCES;
      }
      return response.json();
    },
    enabled: !!slug && !!getManagerToken(),
  });

  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  const savePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: ManagerPreferences) => {
      const response = await fetch(`/api/public/agent/${slug}/manager/preferences`, {
        method: "PUT",
        headers: {
          ...getManagerAuthHeaders(),
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
      queryClient.invalidateQueries({ queryKey: ["manager-preferences", slug] });
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
    savePreferencesMutation.mutate({
      ...localPreferences,
      customInstructions: localPreferences.customInstructions || null,
    });
  };

  const handleWritingStyleChange = (value: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      writingStyle: value as ManagerPreferences["writingStyle"],
    }));
  };

  const handleResponseLengthChange = (value: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      responseLength: value as ManagerPreferences["responseLength"],
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
      aiModel: value as ManagerPreferences["aiModel"],
    }));
  };

  const handleThinkingLevelChange = (value: string) => {
    setLocalPreferences((prev) => ({
      ...prev,
      thinkingLevel: value as ManagerPreferences["thinkingLevel"],
    }));
  };

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    const preset = INSTRUCTION_PRESETS.find((p) => p.value === value);
    if (preset && preset.prompt) {
      setLocalPreferences((prev) => ({
        ...prev,
        customInstructions: preset.prompt,
      }));
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-slate-700 text-slate-300 hover:text-white"
          title="Preferenze AI"
        >
          <Settings2 className="h-4 w-4" />
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

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-cyan-600" />
                <Label className="text-base font-semibold">Modello AI</Label>
              </div>
              <RadioGroup
                value={localPreferences.aiModel || "gemini-2.5-flash-preview-05-20"}
                onValueChange={handleModelChange}
                className="space-y-3"
              >
                {AI_MODEL_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      localPreferences.aiModel === option.value
                        ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => handleModelChange(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={`model-${option.value}`} className="mt-0.5" />
                    <div className="flex-1">
                      <Label
                        htmlFor={`model-${option.value}`}
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
                <Brain className="h-4 w-4 text-teal-600" />
                <Label className="text-base font-semibold">Livello Ragionamento</Label>
              </div>
              <RadioGroup
                value={localPreferences.thinkingLevel || "none"}
                onValueChange={handleThinkingLevelChange}
                className="space-y-3"
              >
                {THINKING_LEVEL_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      localPreferences.thinkingLevel === option.value
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => handleThinkingLevelChange(option.value)}
                  >
                    <RadioGroupItem 
                      value={option.value} 
                      id={`thinking-${option.value}`} 
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={`thinking-${option.value}`}
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
                <Label className="text-base font-semibold">Preset Istruzioni</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Scegli un preset per popolare automaticamente le istruzioni personalizzate.
              </p>
              <div className="flex flex-wrap gap-2">
                {INSTRUCTION_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={selectedPreset === preset.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetChange(preset.value)}
                    className={selectedPreset === preset.value ? "bg-pink-600 hover:bg-pink-700" : ""}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-600" />
                <Label className="text-base font-semibold">Istruzioni Personalizzate</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Scrivi istruzioni specifiche su come vuoi che l'AI risponda. Queste istruzioni verranno sempre applicate indipendentemente dallo stile scelto.
              </p>
              <Textarea
                value={localPreferences.customInstructions || ""}
                onChange={(e) => handleCustomInstructionsChange(e.target.value)}
                placeholder="Es: Rispondi in modo empatico, usa esempi pratici, evita termini tecnici..."
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

interface ManagerMemorySheetProps {
  slug: string;
}

interface MemorySummary {
  id: string;
  date: string;
  summary: string;
  conversationCount: number;
  messageCount: number;
  topics?: string[];
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "Data sconosciuta";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Data sconosciuta";
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return "Oggi";
  if (date.toDateString() === yesterday.toDateString()) return "Ieri";
  
  return date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

function getDateBadgeStyle(dateStr: string): string {
  if (!dateStr) return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) 
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
  if (date.toDateString() === yesterday.toDateString()) 
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
  
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (date >= weekAgo) 
    return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800";
  
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
}

function groupSummariesByPeriod(summaries: MemorySummary[]): Record<string, MemorySummary[]> {
  const groups: Record<string, MemorySummary[]> = {
    oggi: [],
    ieri: [],
    "questo mese": [],
    precedenti: [],
  };

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();

  for (const summary of summaries) {
    if (!summary.date) {
      groups["precedenti"].push(summary);
      continue;
    }
    const date = new Date(summary.date);
    if (isNaN(date.getTime())) {
      groups["precedenti"].push(summary);
      continue;
    }
    if (date.toDateString() === today.toDateString()) {
      groups["oggi"].push(summary);
    } else if (date.toDateString() === yesterday.toDateString()) {
      groups["ieri"].push(summary);
    } else if (date.getMonth() === thisMonth && date.getFullYear() === thisYear) {
      groups["questo mese"].push(summary);
    } else {
      groups["precedenti"].push(summary);
    }
  }

  return groups;
}

function ManagerMemorySheet({ slug }: ManagerMemorySheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: memoryData, isLoading, isError, refetch, isFetching } = useQuery<{ summaries: MemorySummary[] }>({
    queryKey: ["manager-memory", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/agent/${slug}/manager/memory`, {
        headers: getManagerAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch memory summaries");
      }
      return response.json();
    },
    enabled: !!slug && !!getManagerToken() && isOpen,
  });

  const generateMemoryMutation = useMutation({
    mutationFn: async (force: boolean = false) => {
      const response = await fetch(`/api/public/agent/${slug}/manager/memory/generate`, {
        method: "POST",
        headers: {
          ...getManagerAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate memory");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Riassunti generati",
        description: data.message,
      });
      setIsGenerating(false);
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  const startGeneration = () => {
    setIsGenerating(true);
    generateMemoryMutation.mutate(false);
  };

  const deleteAndRegenerate = () => {
    setIsGenerating(true);
    generateMemoryMutation.mutate(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const summaries = memoryData?.summaries || [];
  const groupedSummaries = groupSummariesByPeriod(summaries);
  const totalConversations = summaries.reduce((sum, s) => sum + s.conversationCount, 0);
  const totalMessages = summaries.reduce((sum, s) => sum + s.messageCount, 0);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-9 sm:w-9 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-100/50 dark:hover:bg-purple-900/30"
          title="Memoria AI"
        >
          <Brain className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-[420px] p-0 flex flex-col">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-800 dark:text-slate-200">Memoria AI</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Riassunti delle tue conversazioni
                </p>
              </div>
            </div>
          </div>

          {summaries.length > 0 && (
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{summaries.length} giorni</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{totalConversations} conversazioni</span>
              </div>
              <div className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                <span>{totalMessages} messaggi</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Generazione in corso...
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={startGeneration}
                  disabled={isGenerating}
                >
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Genera
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  onClick={deleteAndRegenerate}
                  disabled={isGenerating || summaries.length === 0}
                >
                  <RefreshCw className="h-4 w-4" />
                  Rigenera
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : isError ? (
            <div className="p-6 text-center">
              <Brain className="h-12 w-12 text-red-300 dark:text-red-600 mx-auto mb-3" />
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                Errore nel caricamento della memoria
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Riprova
              </Button>
            </div>
          ) : summaries.length > 0 ? (
            <div className="p-4 space-y-6">
              {Object.entries(groupedSummaries).map(([period, periodSummaries]) => {
                if (periodSummaries.length === 0) return null;
                
                return (
                  <div key={period}>
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                      {period}
                    </h3>
                    <div className="space-y-2">
                      {periodSummaries.map((summary) => (
                        <Collapsible
                          key={summary.id}
                          open={expandedIds.has(summary.id)}
                          onOpenChange={() => toggleExpanded(summary.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-all border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                                  <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Badge className={cn("text-[10px] px-2 py-0.5 font-medium border", getDateBadgeStyle(summary.date))}>
                                    {formatDateLabel(summary.date)}
                                  </Badge>
                                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {summary.conversationCount} chat
                                  </span>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                  {summary.summary}
                                </p>
                              </div>
                              <div className="flex-shrink-0 pt-1">
                                {expandedIds.has(summary.id) ? (
                                  <ChevronUp className="h-4 w-4 text-slate-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-13 mt-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                              <p className="text-sm text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                                {summary.summary}
                              </p>
                              
                              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-3">
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  <span>{summary.conversationCount} conversazioni</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Hash className="h-3.5 w-3.5" />
                                  <span>{summary.messageCount} messaggi</span>
                                </div>
                              </div>
                              
                              {summary.topics && summary.topics.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-2">
                                    <Tag className="h-3.5 w-3.5" />
                                    <span>Argomenti</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {summary.topics.map((topic, i) => (
                                      <Badge 
                                        key={i} 
                                        variant="secondary" 
                                        className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                      >
                                        {topic}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Nessun riassunto
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
                Genera i riassunti delle tue conversazioni AI
              </p>
              <Button
                variant="default"
                className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                onClick={startGeneration}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Genera riassunti
              </Button>
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            L'AI usa questi riassunti per ricordare le conversazioni passate
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ManagerChat() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>("gemini-3-flash-preview");
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>("low");
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(!isMobile);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [isNewConversation, setIsNewConversation] = useState(false);
  const [bronzeUsage, setBronzeUsage] = useState<{
    dailyMessagesUsed: number;
    dailyMessageLimit: number;
    remaining: number;
  } | null>(null);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [profileSheetTab, setProfileSheetTab] = useState<"profile" | "subscription">("profile");
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeTier, setUpgradeTier] = useState<"silver" | "gold">("silver");
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);

  const tempAssistantIdRef = useRef<string | null>(null);
  const upgradePollingRef = useRef<NodeJS.Timeout | null>(null);

  const { data: agentInfo, isLoading: agentLoading } = useQuery<AgentInfo>({
    queryKey: ["public-agent", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/agent/${slug}`);
      if (!response.ok) throw new Error("Agent not found");
      return response.json();
    },
    enabled: !!slug,
  });

  // Check if user is Bronze/Silver from unified login or localStorage tier
  const isBronzeSilver = isBronzeSilverUser();
  const hasBronzeTier = typeof window !== 'undefined' && localStorage.getItem("bronzeUserTier") === "1";
  
  useEffect(() => {
    if (agentInfo && agentInfo.requiresLogin) {
      const token = getManagerToken();
      const bronzeToken = localStorage.getItem("bronzeAuthToken") || localStorage.getItem("manager_token");
      
      console.log("[MANAGER-CHAT] Auth check - token:", !!token, "bronzeToken:", !!bronzeToken, "hasBronzeTier:", hasBronzeTier);
      
      if (!token && !bronzeToken) {
        // No token at all - redirect to appropriate login
        // Check if user has Bronze tier info (just registered)
        if (hasBronzeTier) {
          console.log("[MANAGER-CHAT] Has Bronze tier but no token - might be timing issue, waiting...");
          // Small delay to allow localStorage sync
          setTimeout(() => {
            const retryToken = getManagerToken();
            if (!retryToken) {
              console.log("[MANAGER-CHAT] Still no token after delay, redirecting to login");
              setLocation(`/agent/${slug}/login`);
            }
          }, 500);
          return;
        }
        
        // Bronze/Silver users without token go to main login, managers go to agent login
        if (isBronzeSilver) {
          setLocation('/login');
        } else {
          setLocation(`/agent/${slug}/login`);
        }
      }
    }
  }, [agentInfo, slug, setLocation, isBronzeSilver, hasBronzeTier]);

  // Handle upgrade success/cancel from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upgradeStatus = params.get("upgrade");
    const sessionId = params.get("session_id");
    
    if (upgradeStatus === "success" && sessionId) {
      // Poll verify-upgrade-session to get new token
      const verifyUpgrade = async () => {
        try {
          const token = getManagerToken();
          if (!token) return;
          
          const response = await fetch("/api/verify-upgrade-session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ sessionId }),
          });
          
          if (!response.ok) {
            throw new Error("Verification failed");
          }
          
          const data = await response.json();
          
          if (data.success && data.upgraded && data.newToken) {
            // Update localStorage with new token
            localStorage.setItem("manager_token", data.newToken);
            
            // Update user info in localStorage
            const userStr = localStorage.getItem("manager_user");
            if (userStr) {
              try {
                const user = JSON.parse(userStr);
                user.tier = data.tierType;
                user.level = data.level;
                localStorage.setItem("manager_user", JSON.stringify(user));
              } catch {
                // Ignore parse errors
              }
            }
            
            // Dispatch custom event for UI refresh
            window.dispatchEvent(new CustomEvent("manager-tier-updated", {
              detail: { tier: data.tierType, level: data.level }
            }));
            
            // Set tier and show dialog
            setUpgradeTier(data.tierType as "silver" | "gold");
            setUpgradeDialogOpen(true);
            
            // Refresh queries
            queryClient.invalidateQueries({ queryKey: ["manager-info", slug] });
            queryClient.invalidateQueries({ queryKey: ["pricing-data", slug] });
            
            // Clean URL without reload
            window.history.replaceState({}, "", `/agent/${slug}`);
            
            // Clear polling if active
            if (upgradePollingRef.current) {
              clearInterval(upgradePollingRef.current);
              upgradePollingRef.current = null;
            }
          }
        } catch (error) {
          console.error("[Upgrade Verify] Error:", error);
          // Fallback to simple toast
          toast({
            title: "Upgrade completato!",
            description: "Il tuo abbonamento è stato attivato. Ricarica la pagina per vedere i nuovi vantaggi.",
          });
          window.history.replaceState({}, "", `/agent/${slug}`);
        }
      };
      
      verifyUpgrade();
    } else if (upgradeStatus === "success" && !sessionId) {
      // Legacy fallback without session_id
      queryClient.invalidateQueries({ queryKey: ["manager-info", slug] });
      queryClient.invalidateQueries({ queryKey: ["pricing-data", slug] });
      toast({
        title: "Upgrade completato!",
        description: "Il tuo abbonamento è stato attivato con successo. Goditi i nuovi vantaggi!",
      });
      window.history.replaceState({}, "", `/agent/${slug}`);
    } else if (upgradeStatus === "canceled") {
      toast({
        title: "Upgrade annullato",
        description: "Hai annullato il processo di upgrade. Puoi riprovare quando vuoi.",
        variant: "default",
      });
      // Clean URL without reload
      window.history.replaceState({}, "", `/agent/${slug}`);
    }
    
    // Cleanup polling on unmount
    return () => {
      if (upgradePollingRef.current) {
        clearInterval(upgradePollingRef.current);
        upgradePollingRef.current = null;
      }
    };
  }, [slug, queryClient, toast]);

  const { data: managerInfo } = useQuery<ManagerInfo>({
    queryKey: ["manager-info", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/agent/${slug}/manager/me`, {
        headers: getManagerAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("manager_token");
          // Bronze/Silver users go to main login on 401
          if (isBronzeSilverUser()) {
            setLocation('/login');
          } else {
            setLocation(`/agent/${slug}/login`);
          }
        }
        throw new Error("Failed to fetch manager info");
      }
      return response.json();
    },
    enabled: !!slug && !!getManagerToken() && (agentInfo?.requiresLogin === true || isBronzeSilver),
  });

  // Bronze/Silver users are authenticated if they have a token, regardless of requiresLogin flag
  const isAuthenticated = !!getManagerToken() && (agentInfo?.requiresLogin === true || isBronzeSilver);

  // Initialize Bronze usage from manager info
  useEffect(() => {
    if (managerInfo?.isBronze && typeof managerInfo.dailyMessagesUsed === 'number') {
      setBronzeUsage({
        dailyMessagesUsed: managerInfo.dailyMessagesUsed,
        dailyMessageLimit: managerInfo.dailyMessageLimit || 15,
        remaining: managerInfo.remaining || 0,
      });
    }
  }, [managerInfo]);

  // Show onboarding wizard for Bronze/Silver/Gold users who haven't completed onboarding
  useEffect(() => {
    if (managerInfo && managerInfo.hasCompletedOnboarding === false) {
      setShowOnboardingWizard(true);
    }
  }, [managerInfo]);

  const { data: conversationData, isLoading: conversationsLoading, refetch: refetchConversation } = useQuery<{
    conversations?: { id: string; title?: string; createdAt: string; lastMessageAt?: string }[];
    conversation: Conversation | null;
    messages: Message[];
  }>({
    queryKey: ["manager-conversation", slug],
    queryFn: async () => {
      const response = await fetch(`/public/whatsapp/shares/${slug}/conversation`, {
        headers: getManagerAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch conversation");
      const data = await response.json();
      return data;
    },
    enabled: isAuthenticated,
  });

  const conversations: Conversation[] = (conversationData?.conversations || []).map((c) => ({
    id: c.id,
    title: c.title || "Nuova conversazione",
    createdAt: c.createdAt,
    updatedAt: c.lastMessageAt || c.createdAt,
  }));

  const { refetch: fetchConversationMessages } = useQuery({
    queryKey: ["manager-conversation-messages", slug, selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      setLoadingConversationId(selectedConversationId);
      try {
        const response = await fetch(
          `/public/whatsapp/shares/${slug}/conversation?conversationId=${selectedConversationId}`,
          { headers: getManagerAuthHeaders() }
        );
        if (!response.ok) throw new Error("Failed to fetch messages");
        const data = await response.json();
        setMessages(data.messages || []);
        return data.messages;
      } finally {
        setLoadingConversationId(null);
      }
    },
    enabled: !!selectedConversationId && !isNewConversation && isAuthenticated,
  });

  const { data: preferences } = useQuery<ManagerPreferences>({
    queryKey: ["manager-preferences", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/agent/${slug}/manager/preferences`, {
        headers: getManagerAuthHeaders(),
      });
      if (!response.ok) return DEFAULT_PREFERENCES;
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: pricingData } = useQuery<{
    pricing: {
      level2MonthlyPrice: number;
      level3MonthlyPrice: number;
      level2Name: string;
      level3Name: string;
      level2Features?: string[];
      level3Features?: string[];
    };
  }>({
    queryKey: ["consultant-pricing", managerInfo?.consultantSlug],
    queryFn: async () => {
      const consultantSlug = managerInfo?.consultantSlug;
      if (!consultantSlug) throw new Error("No consultant slug");
      const response = await fetch(`/api/public/consultant/${consultantSlug}/pricing`);
      if (!response.ok) throw new Error("Failed to fetch pricing");
      return response.json();
    },
    enabled: !!managerInfo?.consultantSlug,
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(
        `/public/whatsapp/shares/${slug}/conversations/${conversationId}`,
        {
          method: "DELETE",
          headers: getManagerAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to delete conversation");
      return response.json();
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["manager-conversation", slug] });
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
        setMessages([]);
      }
      setDeletingConversationId(null);
      toast({
        title: "Conversazione eliminata",
        description: "La conversazione è stata eliminata con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Non è stato possibile eliminare la conversazione",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const hasNonDefaultPreferences = preferences && (
        preferences.writingStyle !== 'default' ||
        preferences.responseLength !== 'balanced' ||
        (preferences.customInstructions && preferences.customInstructions.trim().length > 0)
      );
      const currentPreferences = hasNonDefaultPreferences 
        ? {
            writingStyle: preferences.writingStyle,
            responseLength: preferences.responseLength,
            customInstructions: preferences.customInstructions,
            aiModel: selectedModel,
            thinkingLevel: thinkingLevel,
          }
        : {
            aiModel: selectedModel,
            thinkingLevel: thinkingLevel,
          };
      
      const response = await fetch(
        `/public/whatsapp/shares/${slug}/message`,
        {
          method: "POST",
          headers: {
            ...getManagerAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: message,
            preferences: currentPreferences,
            newConversation: isNewConversation,
            conversationId: selectedConversationId,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let fullThinking = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "thinking") {
                fullThinking += data.content || "";
                console.log(`🧠 [MANAGER THINKING] +${(data.content || "").length} chars, total: ${fullThinking.length}`);
                if (tempAssistantIdRef.current) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantIdRef.current
                        ? { ...msg, thinking: fullThinking, isThinking: true }
                        : msg
                    )
                  );
                }
              } else if (data.type === "delta" || data.type === "chunk") {
                console.log(`📝 [MANAGER DELTA] +${data.content.length} chars`);
                if (tempAssistantIdRef.current && fullThinking) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantIdRef.current
                        ? { ...msg, isThinking: false }
                        : msg
                    )
                  );
                }
                fullContent += data.content;
                if (tempAssistantIdRef.current) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantIdRef.current
                        ? { ...msg, content: fullContent }
                        : msg
                    )
                  );
                }
              } else if (data.type === "complete" || data.type === "done") {
                // Update selectedConversationId with the actual conversation ID from backend
                // This ensures subsequent messages go to the same conversation
                if (data.conversationId) {
                  console.log(`🔗 [MANAGER] Received conversationId from backend: ${data.conversationId}`);
                  setSelectedConversationId(data.conversationId);
                  setIsNewConversation(false);
                }
                // Extract Bronze usage info if present
                if (typeof data.dailyMessagesUsed === 'number' && typeof data.dailyMessageLimit === 'number') {
                  setBronzeUsage({
                    dailyMessagesUsed: data.dailyMessagesUsed,
                    dailyMessageLimit: data.dailyMessageLimit,
                    remaining: data.remaining ?? (data.dailyMessageLimit - data.dailyMessagesUsed),
                  });
                }
                // Handle limit reached case - message already shown via chunk event
                if (data.limitReached) {
                  console.log(`⚠️ [MANAGER] Bronze daily limit reached`);
                }
              } else if (data.type === "titleUpdate") {
                // Update conversation title generated by AI
                console.log(`📝 [MANAGER TITLE] ═══════════════════════════════════`);
                console.log(`📝 [MANAGER TITLE] Received title update from server!`);
                console.log(`📝 [MANAGER TITLE] New title: "${data.title}"`);
                console.log(`📝 [MANAGER TITLE] Conversation ID: ${data.conversationId || 'N/A'}`);
                console.log(`📝 [MANAGER TITLE] Invalidating conversation queries to refresh sidebar...`);
                console.log(`📝 [MANAGER TITLE] ═══════════════════════════════════`);
                // Invalidate conversations query to refresh sidebar with new title
                queryClient.invalidateQueries({ queryKey: ["manager-conversation", slug] });
              } else if (data.type === "error") {
                throw new Error(data.error || "AI error");
              }
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }
      }

      console.log(`✅ [MANAGER STREAMING COMPLETE] thinking: ${fullThinking.length} chars, content: ${fullContent.length} chars`);
      return { content: fullContent, thinking: fullThinking };
    },
    onMutate: async (message) => {
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: message,
      };
      const modelLabel = selectedModel === "gemini-3-pro-preview" ? "Pro 3" : "Flash 3";
      const thinkingLabel = thinkingLevel === "none" ? "Nessuno" : thinkingLevel === "low" ? "Basso" : thinkingLevel === "medium" ? "Medio" : "Alto";
      const assistantPlaceholder: Message = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        isThinking: true,
        modelName: modelLabel,
        thinkingLevel: thinkingLabel,
      };
      tempAssistantIdRef.current = assistantPlaceholder.id;
      if (!selectedConversationId) {
        setIsNewConversation(true);
      }
      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setIsTyping(true);
    },
    onSuccess: (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantIdRef.current
            ? { 
                ...msg, 
                id: `assistant-${Date.now()}`, 
                content: data.content,
                thinking: data.thinking || msg.thinking,
                isThinking: false,
              }
            : msg
        )
      );

      setIsTyping(false);
      tempAssistantIdRef.current = null;
      setIsNewConversation(false);
      queryClient.invalidateQueries({ queryKey: ["manager-conversation", slug] });
    },
    onError: () => {
      setIsTyping(false);
      if (tempAssistantIdRef.current) {
        setMessages((prev) =>
          prev.filter(
            (msg) => msg.id !== tempAssistantIdRef.current && !msg.id.startsWith("temp-user-")
          )
        );
      }
      tempAssistantIdRef.current = null;
      toast({
        title: "Errore",
        description: "Non è stato possibile inviare il messaggio. Riprova.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (message: string, _files?: unknown, model?: AIModel, thinking?: ThinkingLevel) => {
    if (model) setSelectedModel(model);
    if (thinking) setThinkingLevel(thinking);
    sendMessageMutation.mutate(message);
  };

  const handleNewConversation = () => {
    setSelectedConversationId(null);
    setMessages([]);
    setIsNewConversation(true);
    if (isMobile) {
      setChatSidebarOpen(false);
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setIsNewConversation(false);
    setSelectedConversationId(conversationId);
    if (isMobile) {
      setChatSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    // Clear ALL authentication-related localStorage items
    localStorage.removeItem("manager_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("sessionId");
    localStorage.removeItem("bronzeAuthToken");
    localStorage.removeItem("bronzeUserTier");
    localStorage.removeItem("bronzeUserName");
    localStorage.removeItem("bronzePublicSlug");
    localStorage.removeItem("agentSlug");
    
    // Always redirect to homepage after complete logout
    window.location.href = "/";
  };

  useEffect(() => {
    if (selectedConversationId && !isNewConversation) {
      fetchConversationMessages();
    }
  }, [selectedConversationId, isNewConversation]);

  useEffect(() => {
    if (isMobile) {
      setChatSidebarOpen(false);
    }
  }, [isMobile]);

  if (agentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center animate-pulse">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-teal-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="flex h-screen">
        {(!isMobile || chatSidebarOpen) && isAuthenticated && (
          <div className={cn(
            "h-full",
            isMobile && "absolute inset-0 z-50 w-full bg-slate-50 dark:bg-slate-900"
          )}>
            {isMobile && (
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-lg font-semibold">Conversazioni</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setChatSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            )}
            <ConversationSidebar
              conversations={conversations}
              conversationsLoading={conversationsLoading}
              selectedConversationId={selectedConversationId}
              loadingConversationId={loadingConversationId}
              onNewConversation={handleNewConversation}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={(id) => setDeletingConversationId(id)}
              variant="consultant"
              isMobile={isMobile}
              sidebarMinimized={sidebarMinimized}
              onToggleMinimize={() => setSidebarMinimized(!sidebarMinimized)}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
          {/* Header - Mobile Optimized */}
          <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {isMobile && isAuthenticated && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 flex-shrink-0"
                  onClick={() => setChatSidebarOpen(!chatSidebarOpen)}
                >
                  {chatSidebarOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              )}
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-md ring-2 ring-cyan-200/50 dark:ring-cyan-700/50 flex-shrink-0">
                <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate block max-w-[120px] sm:max-w-none">
                  {agentInfo?.agentName || "Assistente"}
                </span>
                {agentInfo?.businessName && (
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">{agentInfo.businessName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {bronzeUsage && (
                <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30">
                  <MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-[10px] sm:text-xs font-medium text-amber-700 dark:text-amber-300">
                    {bronzeUsage.dailyMessagesUsed}/{bronzeUsage.dailyMessageLimit}
                  </span>
                </div>
              )}
              {managerInfo && (
                <span className="text-sm text-slate-600 dark:text-slate-300 hidden md:block mr-2">
                  {managerInfo.name}
                </span>
              )}
              <ManagerAIPreferencesSheet slug={slug!} />
              {(managerInfo?.tier === "gold" || managerInfo?.level === "3") && (
                <ManagerMemorySheet slug={slug!} />
              )}
              {agentInfo?.requiresLogin && (
                <ProfileSettingsSheet
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                      title="Profilo"
                    >
                      <UserCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  }
                  managerInfo={managerInfo ? { name: managerInfo.name, email: managerInfo.email } : null}
                  bronzeUsage={bronzeUsage}
                  subscriptionLevel={managerInfo?.isBronze ? "bronze" : (managerInfo?.tier === "gold" || managerInfo?.level === "3" ? "gold" : "silver")}
                  onLogout={handleLogout}
                  slug={slug!}
                  open={profileSheetOpen}
                  onOpenChange={setProfileSheetOpen}
                  defaultTab={profileSheetTab}
                  pricing={pricingData?.pricing}
                />
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {messages.length === 0 ? (
              <WelcomeScreen
                variant="consultant"
                onSuggestionClick={handleSendMessage}
                disabled={isTyping}
                agentId={agentInfo?.id}
                agentName={agentInfo?.agentName}
                userName={managerInfo?.name}
                agentInfo={agentInfo ? {
                  whoWeHelp: agentInfo.whoWeHelp,
                  whatWeDo: agentInfo.whatWeDo,
                  howWeDoIt: agentInfo.howWeDoIt,
                  usp: agentInfo.usp,
                  mission: agentInfo.mission,
                } : undefined}
              />
            ) : (
              <MessageList messages={messages} isTyping={isTyping} />
            )}
          </div>

          {/* Upgrade Banner - quando messaggi Bronze esauriti */}
          {bronzeUsage && bronzeUsage.remaining <= 0 && (
            <UpgradeBanner
              onUpgradeClick={() => {
                setProfileSheetTab("subscription");
                setProfileSheetOpen(true);
              }}
              onViewPlansClick={() => {
                window.open("/pricing", "_blank");
              }}
            />
          )}

          {/* Input Area - Mobile Optimized with safe-area */}
          <div className="pt-3 sm:pt-6 px-2 sm:px-4 pb-2 sm:pb-4 pb-[max(8px,env(safe-area-inset-bottom))] sm:pb-[max(16px,env(safe-area-inset-bottom))] bg-white dark:bg-slate-900 flex-shrink-0">
            <div className="max-w-4xl mx-auto">
              <InputArea 
                onSend={handleSendMessage} 
                isProcessing={isTyping}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                thinkingLevel={thinkingLevel}
                onThinkingLevelChange={setThinkingLevel}
              />
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deletingConversationId} onOpenChange={(open) => !open && setDeletingConversationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare conversazione?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. La conversazione verrà eliminata permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingConversationId(null)}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingConversationId) {
                  deleteConversationMutation.mutate(deletingConversationId);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeSuccessDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        tier={upgradeTier}
        onStartNow={() => {
          setUpgradeDialogOpen(false);
        }}
        pricing={pricingData?.pricing ? {
          level2MonthlyPrice: pricingData.pricing.level2MonthlyPrice,
          level3MonthlyPrice: pricingData.pricing.level3MonthlyPrice,
          level2Name: pricingData.pricing.level2Name,
          level3Name: pricingData.pricing.level3Name,
          level2Features: pricingData.pricing.level2Features,
          level3Features: pricingData.pricing.level3Features,
        } : undefined}
      />

      {showOnboardingWizard && managerInfo && slug && (
        <OnboardingWizard
          slug={slug}
          clientEmail={managerInfo.email}
          agentName={agentInfo?.agentName}
          tier={managerInfo.isBronze ? "bronze" : (managerInfo.tier === "gold" ? "gold" : "silver")}
          onComplete={() => {
            setShowOnboardingWizard(false);
            queryClient.invalidateQueries({ queryKey: ["manager-info", slug] });
          }}
          onSkip={() => {
            setShowOnboardingWizard(false);
          }}
        />
      )}
    </div>
  );
}
