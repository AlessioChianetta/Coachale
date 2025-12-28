import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { 
  Plus, 
  MessageSquare, 
  Menu, 
  X, 
  Send, 
  LogOut, 
  Loader2,
  Bot,
  Settings2,
  Trash2,
  Sparkles,
  HelpCircle,
  MessageCircle,
  Lightbulb,
  Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
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

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessageAt?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
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
}

interface ManagerPreferences {
  writingStyle: 'conversational' | 'professional' | 'concise' | 'detailed' | 'custom';
  responseLength: 'brief' | 'standard' | 'comprehensive';
  customInstructions?: string;
}

const DEFAULT_PREFERENCES: ManagerPreferences = {
  writingStyle: 'professional',
  responseLength: 'standard',
  customInstructions: '',
};

const WRITING_STYLES = [
  { value: 'conversational', label: 'Conversazionale', description: 'Tono amichevole e informale' },
  { value: 'professional', label: 'Professionale', description: 'Tono formale e business-oriented' },
  { value: 'concise', label: 'Conciso', description: 'Risposte brevi e dirette' },
  { value: 'detailed', label: 'Dettagliato', description: 'Spiegazioni approfondite' },
  { value: 'custom', label: 'Personalizzato', description: 'Usa le tue istruzioni' },
];

const RESPONSE_LENGTHS = [
  { value: 'brief', label: 'Breve', description: '1-2 paragrafi' },
  { value: 'standard', label: 'Standard', description: '3-4 paragrafi' },
  { value: 'comprehensive', label: 'Completo', description: 'Risposta esaustiva' },
];

function getManagerToken(): string | null {
  return localStorage.getItem("manager_token");
}

function getManagerAuthHeaders(): Record<string, string> {
  const token = getManagerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getManagerPreferences(): ManagerPreferences {
  try {
    const stored = localStorage.getItem("manager_ai_preferences");
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {}
  return DEFAULT_PREFERENCES;
}

function setManagerPreferences(prefs: ManagerPreferences) {
  localStorage.setItem("manager_ai_preferences", JSON.stringify(prefs));
}

function groupConversationsByDate(conversations: Conversation[]): Record<string, Conversation[]> {
  const groups: Record<string, Conversation[]> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  conversations.forEach((conv) => {
    const convDate = new Date(conv.lastMessageAt || conv.updatedAt || conv.createdAt);
    convDate.setHours(0, 0, 0, 0);

    let group: string;
    if (convDate.getTime() === today.getTime()) {
      group = "Oggi";
    } else if (convDate.getTime() === yesterday.getTime()) {
      group = "Ieri";
    } else if (convDate >= lastWeek) {
      group = "Questa settimana";
    } else {
      group = "Precedenti";
    }

    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(conv);
  });

  return groups;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-cyan-500 rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface WelcomeScreenProps {
  agentName?: string;
  userName?: string;
  onSuggestionClick: (prompt: string) => void;
  disabled?: boolean;
}

function ManagerWelcomeScreen({ agentName, userName, onSuggestionClick, disabled }: WelcomeScreenProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buongiorno";
    if (hour < 18) return "Buon pomeriggio";
    return "Buonasera";
  };

  const suggestions = [
    {
      icon: HelpCircle,
      label: "Aiuto generale",
      prompt: "Come puoi aiutarmi?",
      gradient: "from-cyan-500 to-teal-500",
    },
    {
      icon: MessageCircle,
      label: "Inizia conversazione",
      prompt: "Vorrei discutere di un argomento importante",
      gradient: "from-teal-500 to-emerald-500",
    },
    {
      icon: Lightbulb,
      label: "Suggerimenti",
      prompt: "Dammi dei suggerimenti utili per migliorare",
      gradient: "from-emerald-500 to-green-500",
    },
    {
      icon: Target,
      label: "Obiettivi",
      prompt: "Aiutami a definire i miei obiettivi",
      gradient: "from-green-500 to-cyan-500",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center max-w-2xl w-full"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="relative mb-6"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
              {agentName ? (
                <Bot className="w-10 h-10 text-white" />
              ) : (
                <Sparkles className="w-10 h-10 text-white" />
              )}
            </motion.div>
          </div>
          <motion.div
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </motion.div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-slate-100 mb-2 text-center"
        >
          {getGreeting()}{userName ? `, ${userName}` : ""}!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-base md:text-lg text-slate-500 dark:text-slate-400 mb-8 text-center"
        >
          {agentName ? (
            <>Sono <span className="font-medium text-cyan-600 dark:text-cyan-400">{agentName}</span>, come posso aiutarti oggi?</>
          ) : (
            "Come posso aiutarti oggi?"
          )}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl"
        >
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={suggestion.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
              onClick={() => !disabled && onSuggestionClick(suggestion.prompt)}
              disabled={disabled}
              className={cn(
                "group relative flex items-center gap-3 p-4 rounded-xl",
                "bg-white dark:bg-slate-800/50",
                "border border-slate-200 dark:border-slate-700/50",
                "hover:border-cyan-300 dark:hover:border-cyan-600/50",
                "hover:shadow-md hover:shadow-cyan-500/5",
                "transition-all duration-200",
                "text-left",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-lg",
                "bg-gradient-to-br",
                suggestion.gradient,
                "flex items-center justify-center",
                "group-hover:scale-105 transition-transform duration-200"
              )}>
                <suggestion.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block truncate">
                  {suggestion.label}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">
                  {suggestion.prompt}
                </span>
              </div>
            </motion.button>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-8 text-xs text-slate-400 dark:text-slate-500 text-center"
        >
          Scrivi un messaggio o scegli uno dei suggerimenti sopra
        </motion.p>
      </motion.div>
    </div>
  );
}

interface PreferencesSheetProps {
  preferences: ManagerPreferences;
  onSave: (prefs: ManagerPreferences) => void;
}

function ManagerPreferencesSheet({ preferences, onSave }: PreferencesSheetProps) {
  const [localPrefs, setLocalPrefs] = useState(preferences);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleSave = () => {
    onSave(localPrefs);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-slate-800">
          <Settings2 className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-cyan-500" />
            Preferenze AI
          </SheetTitle>
          <SheetDescription>
            Personalizza come l'assistente risponde ai tuoi messaggi
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-medium">Stile di Scrittura</Label>
            <div className="grid gap-2">
              {WRITING_STYLES.map((style) => (
                <button
                  key={style.value}
                  onClick={() => setLocalPrefs({ ...localPrefs, writingStyle: style.value as any })}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                    localPrefs.writingStyle === style.value
                      ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 mt-0.5 shrink-0",
                    localPrefs.writingStyle === style.value
                      ? "border-cyan-500 bg-cyan-500"
                      : "border-slate-300"
                  )}>
                    {localPrefs.writingStyle === style.value && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{style.label}</p>
                    <p className="text-xs text-slate-500">{style.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Lunghezza Risposte</Label>
            <div className="grid grid-cols-3 gap-2">
              {RESPONSE_LENGTHS.map((length) => (
                <button
                  key={length.value}
                  onClick={() => setLocalPrefs({ ...localPrefs, responseLength: length.value as any })}
                  className={cn(
                    "p-3 rounded-lg border transition-all text-center",
                    localPrefs.responseLength === length.value
                      ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  )}
                >
                  <p className="font-medium text-sm">{length.label}</p>
                  <p className="text-xs text-slate-500 mt-1">{length.description}</p>
                </button>
              ))}
            </div>
          </div>

          {localPrefs.writingStyle === 'custom' && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Istruzioni Personalizzate</Label>
              <Textarea
                value={localPrefs.customInstructions || ''}
                onChange={(e) => setLocalPrefs({ ...localPrefs, customInstructions: e.target.value })}
                placeholder="Es: Rispondi sempre in modo formale, usa elenchi puntati quando possibile..."
                className="min-h-[100px]"
              />
            </div>
          )}

          <Button onClick={handleSave} className="w-full bg-cyan-500 hover:bg-cyan-600">
            Salva Preferenze
          </Button>
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

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isNewConversation, setIsNewConversation] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ManagerPreferences>(getManagerPreferences());

  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (agentInfo && agentInfo.requiresLogin) {
      const token = getManagerToken();
      if (!token) {
        setLocation(`/agent/${slug}/login`);
      }
    }
  }, [agentInfo, slug, setLocation]);

  const { data: managerInfo } = useQuery<ManagerInfo>({
    queryKey: ["manager-info", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/agent/${slug}/manager/me`, {
        headers: getManagerAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("manager_token");
          setLocation(`/agent/${slug}/login`);
        }
        throw new Error("Failed to fetch manager info");
      }
      return response.json();
    },
    enabled: !!slug && !!getManagerToken() && agentInfo?.requiresLogin === true,
  });

  const isAuthenticated = !!getManagerToken() && agentInfo?.requiresLogin === true;

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["manager-conversations", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/agent/${slug}/conversations`, {
        headers: getManagerAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("manager_token");
          setLocation(`/agent/${slug}/login`);
        }
        throw new Error("Failed to fetch conversations");
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { refetch: fetchMessages } = useQuery({
    queryKey: ["manager-conversation-messages", slug, selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      const response = await fetch(
        `/api/public/agent/${slug}/conversations/${selectedConversationId}`,
        { headers: getManagerAuthHeaders() }
      );
      if (!response.ok) throw new Error("Failed to fetch messages");
      const data = await response.json();
      setMessages(data.messages || []);
      return data.messages;
    },
    enabled: !!slug && !!selectedConversationId && !isNewConversation,
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(
        `/api/public/agent/${slug}/conversations/${conversationId}`,
        {
          method: "DELETE",
          headers: getManagerAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to delete conversation");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Conversazione eliminata" });
      if (selectedConversationId === deletingConversationId) {
        setSelectedConversationId(null);
        setMessages([]);
      }
      setDeletingConversationId(null);
      queryClient.invalidateQueries({ queryKey: ["manager-conversations", slug] });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare la conversazione", variant: "destructive" });
      setDeletingConversationId(null);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      let convId = selectedConversationId;

      if (!convId) {
        const createRes = await fetch(`/api/public/agent/${slug}/conversations`, {
          method: "POST",
          headers: {
            ...getManagerAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: message.slice(0, 50) }),
        });
        if (!createRes.ok) throw new Error("Failed to create conversation");
        const newConv = await createRes.json();
        convId = newConv.id;
        setSelectedConversationId(convId);
      }

      const response = await fetch(
        `/api/public/agent/${slug}/conversations/${convId}/messages`,
        {
          method: "POST",
          headers: {
            ...getManagerAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            content: message,
            preferences: {
              writingStyle: preferences.writingStyle,
              responseLength: preferences.responseLength,
              customInstructions: preferences.writingStyle === 'custom' ? preferences.customInstructions : undefined,
            },
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let messageId = "";
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

              if (data.type === "delta") {
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
              } else if (data.type === "complete") {
                messageId = data.messageId;
              } else if (data.type === "error") {
                throw new Error(data.error || "AI error");
              }
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }
      }

      return { conversationId: convId, messageId, content: fullContent };
    },
    onMutate: async (message) => {
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: message,
      };
      const assistantPlaceholder: Message = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
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
            ? { ...msg, id: data.messageId || `assistant-${Date.now()}`, content: data.content }
            : msg
        )
      );
      setIsTyping(false);
      tempAssistantIdRef.current = null;
      setIsNewConversation(false);
      queryClient.invalidateQueries({ queryKey: ["manager-conversations", slug] });
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
        description: "Non è stato possibile inviare il messaggio.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (message?: string) => {
    const trimmed = (message || inputValue).trim();
    if (!trimmed || isTyping) return;
    setInputValue("");
    sendMessageMutation.mutate(trimmed);
  };

  const handleNewConversation = () => {
    setSelectedConversationId(null);
    setMessages([]);
    setIsNewConversation(false);
    if (isMobile) setSidebarOpen(false);
  };

  const handleSelectConversation = (convId: string) => {
    setIsNewConversation(false);
    setSelectedConversationId(convId);
    if (isMobile) setSidebarOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("manager_token");
    setLocation(`/agent/${slug}/login`);
  };

  const handleSavePreferences = (newPrefs: ManagerPreferences) => {
    setPreferences(newPrefs);
    setManagerPreferences(newPrefs);
    toast({ title: "Preferenze salvate" });
  };

  useEffect(() => {
    if (selectedConversationId && !isNewConversation) {
      fetchMessages();
    }
  }, [selectedConversationId, isNewConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const groupedConversations = groupConversationsByDate(conversations);
  const groupOrder = ["Oggi", "Ieri", "Questa settimana", "Precedenti"];

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
    <div className="h-screen flex flex-col bg-white dark:bg-slate-900">
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          {isMobile && isAuthenticated && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-slate-700"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-md">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-lg">{agentInfo?.agentName || "Assistente"}</span>
              {agentInfo?.businessName && (
                <p className="text-xs text-slate-400">{agentInfo.businessName}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {managerInfo && (
            <span className="text-sm text-slate-300 hidden md:block mr-2">
              {managerInfo.name}
            </span>
          )}
          <ManagerPreferencesSheet preferences={preferences} onSave={handleSavePreferences} />
          {agentInfo?.requiresLogin && (
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={handleLogout}
              title="Esci"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence>
          {isAuthenticated && (sidebarOpen || !isMobile) && (
            <motion.aside
              initial={isMobile ? { x: -300 } : false}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn(
                "w-[300px] bg-slate-900 flex flex-col shrink-0 border-r border-slate-800",
                isMobile && "absolute inset-y-0 left-0 z-40 top-[64px]"
              )}
            >
              <div className="p-4">
                <Button
                  onClick={handleNewConversation}
                  className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-md"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuova Conversazione
                </Button>
              </div>

              <ScrollArea className="flex-1 px-2">
                <div className="pb-4 space-y-4">
                  {conversationsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <MessageSquare className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                      <p className="text-slate-500 text-sm">Nessuna conversazione</p>
                      <p className="text-slate-600 text-xs mt-1">Inizia una nuova chat!</p>
                    </div>
                  ) : (
                    groupOrder.map((group) => {
                      const groupConvs = groupedConversations[group];
                      if (!groupConvs || groupConvs.length === 0) return null;
                      return (
                        <div key={group}>
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
                            {group}
                          </div>
                          <div className="space-y-1">
                            {groupConvs.map((conv) => (
                              <div
                                key={conv.id}
                                className={cn(
                                  "group relative rounded-lg transition-all",
                                  selectedConversationId === conv.id
                                    ? "bg-slate-800"
                                    : "hover:bg-slate-800/50"
                                )}
                              >
                                <button
                                  onClick={() => handleSelectConversation(conv.id)}
                                  className="w-full text-left px-3 py-2.5"
                                >
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className={cn(
                                      "h-4 w-4 shrink-0",
                                      selectedConversationId === conv.id ? "text-cyan-400" : "text-slate-500"
                                    )} />
                                    <span className={cn(
                                      "text-sm truncate flex-1",
                                      selectedConversationId === conv.id ? "text-white" : "text-slate-300"
                                    )}>
                                      {conv.title || "Nuova conversazione"}
                                    </span>
                                  </div>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingConversationId(conv.id);
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-700 rounded transition-all"
                                >
                                  <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-400" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </motion.aside>
          )}
        </AnimatePresence>

        {isMobile && sidebarOpen && isAuthenticated && (
          <div
            className="fixed inset-0 bg-black/50 z-30 top-[64px]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
          {messages.length === 0 && !selectedConversationId ? (
            <ManagerWelcomeScreen
              agentName={agentInfo?.agentName}
              userName={managerInfo?.name}
              onSuggestionClick={handleSendMessage}
              disabled={isTyping}
            />
          ) : (
            <>
              <ScrollArea className="flex-1">
                <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div className={cn(
                        "flex gap-3 max-w-[85%]",
                        msg.role === "user" && "flex-row-reverse"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center",
                          msg.role === "user"
                            ? "bg-slate-700"
                            : "bg-gradient-to-br from-cyan-500 to-teal-500"
                        )}>
                          {msg.role === "user" ? (
                            <span className="text-sm font-medium text-white">
                              {managerInfo?.name?.charAt(0).toUpperCase() || "U"}
                            </span>
                          ) : (
                            <Bot className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div className={cn(
                          "rounded-2xl px-4 py-3",
                          msg.role === "user"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                            : "bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 text-slate-800 dark:text-slate-100"
                        )}>
                          {msg.role === "assistant" ? (
                            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                              <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && messages[messages.length - 1]?.content === "" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 rounded-2xl">
                          <TypingIndicator />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2 shadow-sm">
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Scrivi un messaggio..."
                      className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                      disabled={isTyping}
                    />
                    <Button
                      size="icon"
                      onClick={() => handleSendMessage()}
                      disabled={!inputValue.trim() || isTyping}
                      className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white rounded-xl h-10 w-10 shadow-md"
                    >
                      {isTyping ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <AlertDialog open={!!deletingConversationId} onOpenChange={() => setDeletingConversationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa conversazione?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. La conversazione e tutti i messaggi saranno eliminati permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingConversationId && deleteConversationMutation.mutate(deletingConversationId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
