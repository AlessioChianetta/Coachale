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
  Cpu
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
  agentName: string;
  description: string | null;
  requiresLogin: boolean;
  businessName: string | null;
  consultantName: string | null;
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
}

interface ManagerPreferences {
  writingStyle: "default" | "professional" | "friendly" | "direct" | "eccentric" | "efficient" | "nerd" | "cynical" | "custom";
  responseLength: "short" | "balanced" | "comprehensive";
  customInstructions: string | null;
  aiModel?: "gemini-3-flash-preview" | "gemini-3-pro-preview";
  thinkingLevel?: "none" | "low" | "medium" | "high";
}

const DEFAULT_PREFERENCES: ManagerPreferences = {
  writingStyle: "default",
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
  // Check manager_token first, then fallback to unified login token (for Bronze/Silver users)
  return localStorage.getItem("manager_token") || localStorage.getItem("token");
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

  const tempAssistantIdRef = useRef<string | null>(null);

  const { data: agentInfo, isLoading: agentLoading } = useQuery<AgentInfo>({
    queryKey: ["public-agent", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/agent/${slug}`);
      if (!response.ok) throw new Error("Agent not found");
      return response.json();
    },
    enabled: !!slug,
  });

  // Check if user is Bronze/Silver from unified login
  const isBronzeSilver = isBronzeSilverUser();
  
  useEffect(() => {
    if (agentInfo && agentInfo.requiresLogin) {
      const token = getManagerToken();
      if (!token) {
        // Bronze/Silver users without token go to main login, managers go to agent login
        if (isBronzeSilver) {
          setLocation('/login');
        } else {
          setLocation(`/agent/${slug}/login`);
        }
      }
    }
  }, [agentInfo, slug, setLocation, isBronzeSilver]);

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
                // Extract Bronze usage info if present
                if (typeof data.dailyMessagesUsed === 'number' && typeof data.dailyMessageLimit === 'number') {
                  setBronzeUsage({
                    dailyMessagesUsed: data.dailyMessagesUsed,
                    dailyMessageLimit: data.dailyMessageLimit,
                    remaining: data.remaining ?? (data.dailyMessageLimit - data.dailyMessagesUsed),
                  });
                }
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 flex-shrink-0">
            <div className="flex items-center gap-3">
              {isMobile && isAuthenticated && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                  onClick={() => setChatSidebarOpen(!chatSidebarOpen)}
                >
                  {chatSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              )}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-md ring-2 ring-cyan-200/50 dark:ring-cyan-700/50">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {agentInfo?.agentName || "Assistente"}
                </span>
                {agentInfo?.businessName && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{agentInfo.businessName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {bronzeUsage && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30">
                  <MessageSquare className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {bronzeUsage.dailyMessagesUsed}/{bronzeUsage.dailyMessageLimit}
                  </span>
                  <span className="text-xs text-amber-600/70 dark:text-amber-400/70 hidden sm:inline">
                    messaggi oggi
                  </span>
                </div>
              )}
              {managerInfo && (
                <span className="text-sm text-slate-600 dark:text-slate-300 hidden md:block mr-2">
                  {managerInfo.name}
                </span>
              )}
              <ManagerAIPreferencesSheet slug={slug!} />
              {agentInfo?.requiresLogin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                  onClick={handleLogout}
                  title="Esci"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {messages.length === 0 ? (
              <WelcomeScreen
                variant="consultant"
                onSuggestionClick={handleSendMessage}
                disabled={isTyping}
                agentName={agentInfo?.agentName}
                userName={managerInfo?.name}
              />
            ) : (
              <MessageList messages={messages} isTyping={isTyping} />
            )}
          </div>

          <div className="pt-6 px-4 pb-4 bg-white dark:bg-slate-900 flex-shrink-0">
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
    </div>
  );
}
