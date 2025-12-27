import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, MessageSquare, Menu, X, Sparkles, Trash2, ChevronLeft, ChevronRight, Calendar, CheckCircle, BookOpen, Target, AlertCircle, Sun, Moon, Mic, DollarSign, TrendingUp, Zap, Bot } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModeSelector } from "@/components/ai-assistant/ModeSelector";
import { ConsultantTypePicker } from "@/components/ai-assistant/ConsultantTypePicker";
import { MessageList } from "@/components/ai-assistant/MessageList";
import { InputArea } from "@/components/ai-assistant/InputArea";
import { QuickActions } from "@/components/ai-assistant/QuickActions";
import { LiveModeScreen } from "@/components/ai-assistant/live-mode/LiveModeScreen";
import { AIPreferencesSheet } from "@/components/ai-assistant/AIPreferencesSheet";
import { AIMode, ConsultantType } from "@/components/ai-assistant/AIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import { cn } from "@/lib/utils";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode?: "assistenza" | "consulente" | "live_voice";
  consultantType?: "finanziario" | "vendita" | "business";
  agentId?: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "processing" | "completed" | "error";
  suggestedActions?: Array<{
    type: string;
    label: string;
    data?: any;
  }>;
}

interface AgentForAssistant {
  id: string;
  name: string;
  businessName?: string;
  agentType: string;
  aiPersonality?: string;
  fileSearchCategories?: Record<string, boolean>;
  consultantId: string;
}

export default function ClientAIAssistant() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();

  const [mode, setMode] = useState<AIMode>("assistenza");
  const [consultantType, setConsultantType] = useState<ConsultantType>("finanziario");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(!isMobile);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [conversationFilter, setConversationFilter] = useState<"all" | "assistenza" | "finanziario" | "vendita" | "business" | "live_voice">("all");
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showTestQuestionsDialog, setShowTestQuestionsDialog] = useState(false);
  const [swipedConversationId, setSwipedConversationId] = useState<string | null>(null);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);

  const tempAssistantIdRef = useRef<string | null>(null);
  const [isNewConversation, setIsNewConversation] = useState<boolean>(false);

  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const [retryMaxAttempts, setRetryMaxAttempts] = useState<number>(0);
  const [retryDelaySeconds, setRetryDelaySeconds] = useState<number>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [safetyTimeoutActive, setSafetyTimeoutActive] = useState<boolean>(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isLiveModeActive, setIsLiveModeActive] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data: availableAgents = [] } = useQuery<AgentForAssistant[]>({
    queryKey: ["/api/ai-assistant/client/agents-for-assistant"],
    queryFn: async () => {
      const response = await fetch("/api/ai-assistant/client/agents-for-assistant", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/ai/conversations"],
    queryFn: async () => {
      const response = await fetch("/api/ai/conversations", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
  });

  const { refetch: fetchConversationMessages } = useQuery({
    queryKey: ["/api/ai/conversations", selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      setLoadingConversationId(selectedConversationId);
      try {
        const response = await fetch(`/api/ai/conversations/${selectedConversationId}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to fetch conversation messages");
        const data = await response.json();
        setMessages(data.messages || []);
        return data.messages;
      } finally {
        setLoadingConversationId(null);
      }
    },
    enabled: !!selectedConversationId && !isNewConversation,
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/ai/conversations/${conversationId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete conversation");
      return response.json();
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations"] });
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

  const deleteAllConversationsMutation = useMutation({
    mutationFn: async () => {
      const conversationIds = conversations.map(c => c.id);
      await Promise.all(
        conversationIds.map(id =>
          fetch(`/api/ai/conversations/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations"] });
      setSelectedConversationId(null);
      setMessages([]);
      setShowDeleteAllDialog(false);
      toast({
        title: "Conversazioni eliminate",
        description: "Tutte le conversazioni sono state eliminate con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Non è stato possibile eliminare tutte le conversazioni",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          mode,
          consultantType: mode === "consulente" ? consultantType : undefined,
          conversationId: selectedConversationId,
          agentId: selectedAgentId,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let conversationId = "";
      let messageId = "";
      let suggestedActions: any[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'start') {
                conversationId = data.conversationId;
                if (conversationId && !selectedConversationId) {
                  setSelectedConversationId(conversationId);
                }
                setIsRetrying(false);
              } else if (data.type === 'delta') {
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
                setIsRetrying(false);
                
                if (safetyTimeoutRef.current) {
                  clearTimeout(safetyTimeoutRef.current);
                }
                safetyTimeoutRef.current = setTimeout(() => {
                  setSafetyTimeoutActive(true);
                  setIsTyping(false);
                }, 90000);
              } else if (data.type === 'retry') {
                const { attempt, maxAttempts, delayMs } = data;
                const delaySeconds = Math.ceil(delayMs / 1000);
                
                setIsRetrying(true);
                setRetryAttempt(attempt);
                setRetryMaxAttempts(maxAttempts);
                setRetryDelaySeconds(delaySeconds);
                setCountdownSeconds(delaySeconds);
              } else if (data.type === 'heartbeat') {
                if (safetyTimeoutRef.current) {
                  clearTimeout(safetyTimeoutRef.current);
                }
                safetyTimeoutRef.current = setTimeout(() => {
                  setSafetyTimeoutActive(true);
                  setIsTyping(false);
                  toast({
                    title: "Timeout",
                    description: "La connessione con l'AI è scaduta. Riprova.",
                    variant: "destructive",
                  });
                }, 90000);
              } else if (data.type === 'complete') {
                messageId = data.messageId;
                suggestedActions = data.suggestedActions || [];
                
                if (safetyTimeoutRef.current) {
                  clearTimeout(safetyTimeoutRef.current);
                }
                setSafetyTimeoutActive(false);
                setIsRetrying(false);
              } else if (data.type === 'error') {
                if (safetyTimeoutRef.current) {
                  clearTimeout(safetyTimeoutRef.current);
                }
                setSafetyTimeoutActive(false);
                setIsRetrying(false);
                throw new Error(data.error || data.content || "Errore durante la comunicazione con l'AI");
              }
            } catch (parseError) {
              console.error("Error parsing SSE data:", parseError);
            }
          }
        }
      }

      return { 
        conversationId, 
        messageId, 
        message: fullContent, 
        status: 'completed' as const, 
        suggestedActions 
      };
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
        status: "processing",
      };

      tempAssistantIdRef.current = assistantPlaceholder.id;
      
      // Segna che stiamo creando una nuova conversazione se non c'è conversationId
      if (!selectedConversationId) {
        setIsNewConversation(true);
      }

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setIsTyping(true);
    },
    onSuccess: (data) => {
      if (data.conversationId && !selectedConversationId) {
        setSelectedConversationId(data.conversationId);
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantIdRef.current
            ? {
                ...msg,
                id: data.messageId || `assistant-${Date.now()}`,
                content: data.message,
                status: data.status,
                suggestedActions: data.suggestedActions,
              }
            : msg
        )
      );

      setIsTyping(false);
      tempAssistantIdRef.current = null;
      
      // Resetta il flag e invalida solo la lista delle conversazioni (non i messaggi)
      setIsNewConversation(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations"], exact: true });
    },
    onError: (error) => {
      setIsTyping(false);

      if (tempAssistantIdRef.current) {
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== tempAssistantIdRef.current && !msg.id.startsWith('temp-user-'))
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

  const handleSendMessage = (message: string) => {
    sendMessageMutation.mutate(message);
  };

  const handleNewConversation = () => {
    setSelectedConversationId(null);
    setMessages([]);
    if (isMobile) {
      setChatSidebarOpen(false);
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    // Resetta il flag quando l'utente seleziona manualmente una conversazione
    setIsNewConversation(false);
    setSelectedConversationId(conversationId);
    if (isMobile) {
      setChatSidebarOpen(false);
    }
  };

  const handleQuickAction = (action: string) => {
    handleSendMessage(action);
  };

  useEffect(() => {
    // Non ricaricare se è una nuova conversazione appena creata
    if (selectedConversationId && !isNewConversation) {
      fetchConversationMessages();
    }
  }, [selectedConversationId, isNewConversation]);

  // Chiudi la sidebar principale quando si entra nella pagina AI Assistant
  useEffect(() => {
    // Chiudi la sidebar mobile
    setSidebarOpen(false);
    
    // Su desktop, forza il collapse della sidebar usando un evento custom
    if (!isMobile) {
      window.dispatchEvent(new CustomEvent('ai-assistant-opened'));
    }
    
    // Assicura che la sidebar conversazioni sia chiusa su mobile
    if (isMobile) {
      setChatSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (isRetrying && countdownSeconds > 0) {
      const timer = setTimeout(() => {
        setCountdownSeconds((prev) => prev - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isRetrying, countdownSeconds]);

  useEffect(() => {
    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, []);

  // Clear chat view when selectedAgentId changes
  useEffect(() => {
    setSelectedConversationId(null);
    setMessages([]);
  }, [selectedAgentId]);

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''} bg-gradient-to-br ${theme === 'dark' ? 'from-gray-900 via-gray-900 to-gray-900' : 'from-slate-50 via-blue-50 to-purple-50'}`}>
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />

        <div className="flex-1 flex overflow-hidden">
          {(!isMobile || chatSidebarOpen) && (
            <div
              className={cn(
                "border-r bg-white dark:bg-gray-800 flex flex-col transition-all duration-300 space-y-3",
                isMobile ? "absolute inset-0 z-50 w-full" : sidebarMinimized ? "w-16" : "w-[280px]"
              )}
            >
              {isMobile && (
                <div className="flex items-center justify-between p-4 border-b">
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

              <div className="p-3 sm:p-4 space-y-3">
                <div className="flex gap-2">
                  {!sidebarMinimized ? (
                    <>
                      <Button
                        onClick={handleNewConversation}
                        variant="secondary"
                        className="flex-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 shadow-none hover:shadow-none"
                      >
                        <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        <span className="font-semibold">Nuova</span>
                      </Button>
                      {!isMobile && !sidebarMinimized && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSidebarMinimized(!sidebarMinimized)}
                          className="h-11 w-11 min-h-[44px] min-w-[44px]"
                          title="Minimizza sidebar"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      onClick={handleNewConversation}
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 min-h-[44px] min-w-[44px] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                      title="Nuova conversazione"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  )}
                </div>

                {!sidebarMinimized && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-medium text-muted-foreground">Filtra conversazioni</label>
                      <select
                        value={conversationFilter}
                        onChange={(e) => setConversationFilter(e.target.value as any)}
                        className="w-full h-11 min-h-[44px] px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-600 transition-all"
                      >
                        <option value="all">📋 Tutte le conversazioni</option>
                        <option value="assistenza">💬 Assistenza</option>
                        <option value="finanziario">💰 Consulente Finanziario</option>
                        <option value="vendita">📈 Consulente Vendita</option>
                        <option value="business">💼 Consulente Business</option>
                        <option value="live_voice">🎤 Conversazioni Vocali</option>
                      </select>
                    </div>

                    <Separator />
                  </>
                )}
              </div>

              {!sidebarMinimized && <ScrollArea className="flex-1 px-4">
                <div className="space-y-2 pb-4">
                  {conversationsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Caricamento...
                    </div>
                  ) : conversations.filter((conv) => {
                      // First filter by agent - if agent selected, only show that agent's conversations
                      if (selectedAgentId && conv.agentId !== selectedAgentId) return false;
                      // If no agent selected, show all (or those without agentId)
                      if (!selectedAgentId && conv.agentId) return false;
                      // Then apply the mode/type filter
                      if (conversationFilter === "all") return true;
                      if (conversationFilter === "assistenza") return conv.mode === "assistenza";
                      if (conversationFilter === "live_voice") return conv.mode === "live_voice";
                      return conv.mode === "consulente" && conv.consultantType === conversationFilter;
                    }).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nessuna conversazione</p>
                      <p className="text-xs mt-1">
                        {selectedAgentId
                          ? "Nessuna conversazione con questo agente"
                          : conversationFilter === "all" 
                          ? "Inizia una nuova conversazione"
                          : conversationFilter === "live_voice"
                          ? "Nessuna conversazione vocale"
                          : `Nessuna conversazione ${conversationFilter === "assistenza" ? "di assistenza" : `con consulente ${conversationFilter}`}`
                        }
                      </p>
                    </div>
                  ) : (
                    conversations
                      .filter((conv) => {
                        // First filter by agent - if agent selected, only show that agent's conversations
                        if (selectedAgentId && conv.agentId !== selectedAgentId) return false;
                        // If no agent selected, show all (or those without agentId)
                        if (!selectedAgentId && conv.agentId) return false;
                        // Then apply the mode/type filter
                        if (conversationFilter === "all") return true;
                        if (conversationFilter === "assistenza") return conv.mode === "assistenza";
                        if (conversationFilter === "live_voice") return conv.mode === "live_voice";
                        return conv.mode === "consulente" && conv.consultantType === conversationFilter;
                      })
                      .map((conversation) => (
                      <div key={conversation.id} className="relative overflow-hidden w-full px-2 py-1.5">
                        {/* Pulsante elimina sotto */}
                        <motion.div 
                          className="absolute right-2 top-1.5 bottom-1.5 flex items-center"
                          initial={{ opacity: 0 }}
                          animate={{ 
                            opacity: swipedConversationId === conversation.id ? 1 : 0 
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingConversationId(conversation.id);
                              setSwipedConversationId(null);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </motion.div>

                        {/* Conversazione swipeable */}
                        <motion.div
                          className="relative z-10 bg-white dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
                          drag="x"
                          dragConstraints={{ left: -64, right: 0 }}
                          dragElastic={0.2}
                          onDragEnd={(event: any, info: PanInfo) => {
                            if (info.offset.x < -50) {
                              setSwipedConversationId(conversation.id);
                            } else {
                              setSwipedConversationId(null);
                            }
                          }}
                          animate={{
                            x: swipedConversationId === conversation.id ? -64 : 0
                          }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        >
                          <Button
                            variant={selectedConversationId === conversation.id ? "secondary" : "ghost"}
                            className={cn(
                              "w-full justify-start text-left h-auto min-h-[48px] py-2.5 px-3 rounded-lg border-0 transition-colors duration-200",
                              selectedConversationId === conversation.id 
                                ? "bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/50" 
                                : "hover:bg-gray-50 dark:hover:bg-gray-700/60"
                            )}
                            onClick={() => {
                              handleSelectConversation(conversation.id);
                              setSwipedConversationId(null);
                            }}
                            disabled={loadingConversationId === conversation.id}
                          >
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Icon per tipo di conversazione */}
                                <div className={cn(
                                  "h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-semibold",
                                  conversation.mode === "assistenza" 
                                    ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300"
                                    : conversation.mode === "live_voice"
                                    ? "bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-300"
                                    : conversation.consultantType === "finanziario"
                                    ? "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300"
                                    : conversation.consultantType === "vendita"
                                    ? "bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300"
                                    : "bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300"
                                )}>
                                  {conversation.mode === "assistenza" 
                                    ? <BookOpen className="h-3.5 w-3.5" />
                                    : conversation.mode === "live_voice"
                                    ? <Mic className="h-3.5 w-3.5" />
                                    : conversation.consultantType === "finanziario"
                                    ? <DollarSign className="h-3.5 w-3.5" />
                                    : conversation.consultantType === "vendita"
                                    ? <TrendingUp className="h-3.5 w-3.5" />
                                    : <Zap className="h-3.5 w-3.5" />
                                  }
                                </div>
                                <p className={`font-semibold text-xs sm:text-sm whitespace-normal break-words min-w-0 flex-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} title={conversation.title}>
                                  {conversation.title.length > 35 ? conversation.title.slice(0, 32) + "..." : conversation.title}
                                </p>
                                {loadingConversationId === conversation.id && (
                                  <svg className="animate-spin h-3.5 w-3.5 text-blue-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {conversation.mode === "assistenza" ? (
                                  <span className="inline-flex items-center text-[10px] sm:text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 font-medium">
                                    Assistenza
                                  </span>
                                ) : conversation.mode === "live_voice" ? (
                                  <span className="inline-flex items-center text-[10px] sm:text-xs bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-100 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 font-medium">
                                    🎤 Vocale
                                  </span>
                                ) : conversation.consultantType === "finanziario" ? (
                                  <span className="inline-flex items-center text-[10px] sm:text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 font-medium">
                                    Finanziario
                                  </span>
                                ) : conversation.consultantType === "vendita" ? (
                                  <span className="inline-flex items-center text-[10px] sm:text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-100 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 font-medium">
                                    Vendita
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] sm:text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-100 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 font-medium">
                                    Business
                                  </span>
                                )}
                                <span className={`text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0 ml-auto ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                  {new Date(conversation.updatedAt).toLocaleDateString('it-IT', {
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </span>
                              </div>
                            </div>
                          </Button>
                        </motion.div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>}

              {sidebarMinimized && !isMobile && (
                <div className="flex-1 flex flex-col items-center justify-between py-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarMinimized(false)}
                    className="h-11 w-11 min-h-[44px] min-w-[44px]"
                    title="Espandi sidebar"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className={`flex-1 flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            {/* Chat Header with Agent info and Preferences */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {selectedAgentId 
                      ? availableAgents.find(a => a.id === selectedAgentId)?.name || "Assistente AI"
                      : "Assistente AI"
                    }
                  </h2>
                  {selectedAgentId && (
                    <p className="text-xs text-muted-foreground">
                      Conversazioni filtrate per questo agente
                    </p>
                  )}
                </div>
              </div>
              <AIPreferencesSheet />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {messages.length === 0 ? (
                <div className="flex-1 overflow-y-auto relative">
                  {/* Animated background blobs */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <motion.div
                      className="absolute top-20 right-20 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        x: [0, 30, 0],
                        y: [0, -20, 0]
                      }}
                      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute bottom-20 left-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"
                      animate={{ 
                        scale: [1, 1.3, 1],
                        x: [0, -30, 0],
                        y: [0, 30, 0]
                      }}
                      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    />
                    <motion.div
                      className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-400/15 rounded-full blur-3xl"
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 180, 360]
                      }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    />
                  </div>

                  <div className="min-h-full flex flex-col items-center justify-start p-3 sm:p-6 lg:p-8 relative z-10">
                      <div className="w-full max-w-5xl mx-auto space-y-3 sm:space-y-6 lg:space-y-8">
                        <div className="flex flex-col items-center text-center">
                          <motion.div 
                            className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 flex items-center justify-center mb-3 sm:mb-6 shadow-xl"
                            animate={{ 
                              scale: [1, 1.05, 1],
                              rotate: [0, 5, -5, 0],
                              boxShadow: [
                                "0 10px 30px rgba(168, 85, 247, 0.4)",
                                "0 15px 40px rgba(236, 72, 153, 0.5)",
                                "0 10px 30px rgba(168, 85, 247, 0.4)"
                              ]
                            }}
                            transition={{ 
                              duration: 3, 
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          >
                            <Sparkles className="h-7 w-7 sm:h-10 sm:w-10 text-white" />
                          </motion.div>
                          <h3 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
                            Come posso aiutarti oggi?
                          </h3>
                          <p className="text-xs sm:text-base text-gray-600 dark:text-gray-400 mb-3 sm:mb-6 max-w-md px-2">
                            {mode === "assistenza"
                              ? "Sono qui per supportarti nella tua formazione. Chiedimi informazioni su lezioni, esercizi, task e molto altro."
                              : `Sono il tuo consulente personale ${
                                  consultantType === "finanziario"
                                    ? "finanziario"
                                    : consultantType === "business"
                                    ? "di business"
                                    : "di vendita"
                                }. Chiedi pure qualsiasi cosa!`}
                          </p>
                        </div>

                  {/* Legenda Compatta - Posizione Fissa in Alto a Destra - Solo su schermi grandi */}
                  <div className="hidden lg:block fixed top-4 right-4 z-40 w-auto max-w-[300px] bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-blue-200 dark:border-blue-700 shadow-xl">
                    <div className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span>Cosa posso fare:</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTestQuestionsDialog(true)}
                        className="h-6 px-2 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300"
                      >
                        🧪 Esempi
                      </Button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📚</span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">Lezioni e spiegazioni</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">✅</span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">Esercizi e feedback</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎯</span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">Progressi e obiettivi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">📅</span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">Task e scadenze</span>
                      </div>
                    </div>
                  </div>

                  {/* Legenda Mobile - Sotto il titolo principale, visibile solo su schermi piccoli */}
                  <div className="lg:hidden w-full mb-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border-2 border-blue-200 dark:border-blue-700 shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                          <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Cosa posso fare:</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowTestQuestionsDialog(true)}
                          className="h-6 px-2 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300"
                        >
                          🧪 Esempi
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">📚</span>
                          <span className="text-gray-800 dark:text-gray-200 font-medium">Lezioni</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">✅</span>
                          <span className="text-gray-800 dark:text-gray-200 font-medium">Esercizi</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">🎯</span>
                          <span className="text-gray-800 dark:text-gray-200 font-medium">Progressi</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">📅</span>
                          <span className="text-gray-800 dark:text-gray-200 font-medium">Task</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Agent Selector - Only show if agents are available */}
                  {availableAgents.length > 0 && (
                    <div className="w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Seleziona Agente
                        </label>
                      </div>
                      <Select
                        value={selectedAgentId || "base"}
                        onValueChange={(value) => setSelectedAgentId(value === "base" ? null : value)}
                      >
                        <SelectTrigger className="w-full h-11 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <SelectValue placeholder="Assistente Base" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="base">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-purple-500" />
                              <span>Assistente Base</span>
                            </div>
                          </SelectItem>
                          {availableAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-blue-500" />
                                <span>{agent.name}</span>
                                {agent.businessName && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ({agent.businessName})
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Mode Selector */}
                  <div className="w-full">
                    <ModeSelector mode={mode} setMode={setMode} variant="page" />
                    {mode === "consulente" && (
                      <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <ConsultantTypePicker
                          consultantType={consultantType}
                          setConsultantType={setConsultantType}
                        />
                      </div>
                    )}
                  </div>

                  {/* Quick Actions - Componente dinamico */}
                  <div className="w-full">
                        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                          <CardContent className="p-4">
                            <div className="mb-3">
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                                Azioni Rapide
                              </h4>
                            </div>
                            
                            <QuickActions
                              mode={mode}
                              consultantType={consultantType}
                              onAction={handleQuickAction}
                              disabled={isTyping}
                            />
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-4xl mx-auto p-4">
                    {isRetrying && (
                      <Alert className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertDescription className="text-amber-800 dark:text-amber-200">
                          {countdownSeconds > 0 ? (
                            <span className="font-medium">
                              ⏳ Riprovo tra {countdownSeconds}s... (tentativo {retryAttempt}/{retryMaxAttempts})
                            </span>
                          ) : (
                            <span className="font-medium">
                              🔄 Riconnessione in corso...
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    <MessageList messages={messages} isTyping={isTyping} />
                  </div>
                </div>
              )}

              <div className="border-t pt-6 px-4 pb-4 bg-white dark:bg-gray-800 flex-shrink-0 shadow-lg">
                <div className="max-w-4xl mx-auto">
                  <InputArea
                    onSend={handleSendMessage}
                    disabled={isTyping || sendMessageMutation.isPending}
                    onLiveModeClick={() => setIsLiveModeActive(true)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Single Conversation Dialog */}
      <AlertDialog open={!!deletingConversationId} onOpenChange={() => setDeletingConversationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Conversazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questa conversazione? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
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

      {/* Delete All Conversations Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Tutte le Conversazioni</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare tutte le {conversations.length} conversazioni? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllConversationsMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Elimina Tutte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Questions Dialog - Libreria Completa */}
      <Dialog open={showTestQuestionsDialog} onOpenChange={setShowTestQuestionsDialog}>
        <DialogContent className="max-w-4xl max-h-[42vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              Libreria Domande AI Assistant
            </DialogTitle>
            <DialogDescription>
              145+ domande organizzate per categoria. Clicca per testare!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            {/* CATEGORIA 1: Conti Bancari - Software Orbitale */}
            <div className="border-l-4 border-green-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>💰</span>
                Conti Bancari (Software Orbitale)
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Quanto ho sul conto N26?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-green-50 dark:hover:bg-green-900/20">• Quanto ho sul conto N26?</button>
                <button onClick={() => { handleQuickAction("Quanto soldi ho su Revolut?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-green-50 dark:hover:bg-green-900/20">• Quanto soldi ho su Revolut?</button>
                <button onClick={() => { handleQuickAction("Qual è il saldo del mio conto Intesa SanPaolo?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-green-50 dark:hover:bg-green-900/20">• Saldo Intesa SanPaolo?</button>
                <button onClick={() => { handleQuickAction("Quanti soldi ho in totale sui miei conti?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-green-50 dark:hover:bg-green-900/20">• Liquidità totale?</button>
                <button onClick={() => { handleQuickAction("Quali conti bancari ho?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-green-50 dark:hover:bg-green-900/20">• Quali conti ho?</button>
                <button onClick={() => { handleQuickAction("Su quale banca ho più soldi?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-green-50 dark:hover:bg-green-900/20">• Banca con più soldi?</button>
              </div>
            </div>

            {/* CATEGORIA 2: Budget - Software Orbitale */}
            <div className="border-l-4 border-blue-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>💵</span>
                Budget (Software Orbitale)
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Quanto budget ho per alimentazione?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">• Budget alimentazione?</button>
                <button onClick={() => { handleQuickAction("Qual è il mio budget mensile per trasporti?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">• Budget trasporti?</button>
                <button onClick={() => { handleQuickAction("Quanto budget totale ho al mese?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">• Budget totale mensile?</button>
                <button onClick={() => { handleQuickAction("Quali categorie di budget ho impostato?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">• Categorie budget?</button>
                <button onClick={() => { handleQuickAction("Quanto budget ho per i needs (bisogni)?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">• Budget needs?</button>
                <button onClick={() => { handleQuickAction("Ho budget sforati?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">• Budget sforati?</button>
              </div>
            </div>

            {/* CATEGORIA 3: Entrate/Uscite - Software Orbitale */}
            <div className="border-l-4 border-purple-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>💳</span>
                Entrate/Uscite (Software Orbitale)
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Quanto guadagno al mese?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">• Entrate mensili?</button>
                <button onClick={() => { handleQuickAction("Quanto spendo al mese?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">• Uscite mensili?</button>
                <button onClick={() => { handleQuickAction("Quanto risparmio ogni mese?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">• Risparmio mensile?</button>
                <button onClick={() => { handleQuickAction("Qual è il mio tasso di risparmio?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">• Tasso risparmio?</button>
                <button onClick={() => { handleQuickAction("Spendo più di quanto guadagno?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">• Bilancio positivo/negativo?</button>
                <button onClick={() => { handleQuickAction("Qual è il mio patrimonio netto?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">• Patrimonio netto?</button>
              </div>
            </div>

            {/* CATEGORIA 4: Transazioni - Software Orbitale */}
            <div className="border-l-4 border-orange-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>📊</span>
                Transazioni (Software Orbitale)
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Quali sono le mie ultime transazioni?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20">• Transazioni recenti?</button>
                <button onClick={() => { handleQuickAction("Cosa ho speso ultimamente?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20">• Spese recenti?</button>
                <button onClick={() => { handleQuickAction("In quale categoria spendo di più?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20">• Categoria con più spese?</button>
                <button onClick={() => { handleQuickAction("Qual è la mia spesa più alta?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20">• Spesa più alta?</button>
              </div>
            </div>

            {/* CATEGORIA 5: Obiettivi - Software Orbitale */}
            <div className="border-l-4 border-red-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>🎯</span>
                Obiettivi Finanziari (Software Orbitale)
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Quali obiettivi finanziari ho?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20">• I miei obiettivi?</button>
                <button onClick={() => { handleQuickAction("A che punto sono con l'obiettivo risparmio?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20">• Progresso obiettivo?</button>
                <button onClick={() => { handleQuickAction("Quanto mi manca per raggiungere l'obiettivo?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20">• Quanto manca?</button>
                <button onClick={() => { handleQuickAction("Quando raggiungerò l'obiettivo di €20.000?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20">• Quando arrivo al target?</button>
              </div>
            </div>

            {/* CATEGORIA 6: Lezioni e Contenuti */}
            <div className="border-l-4 border-indigo-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>📚</span>
                Lezioni e Contenuti
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Quali documenti ho disponibili nella libreria?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20">• Documenti libreria?</button>
                <button onClick={() => { handleQuickAction("Mostrami tutte le lezioni del corso"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20">• Tutte le lezioni?</button>
                <button onClick={() => { handleQuickAction("Quali lezioni ho completato e quali no?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20">• Lezioni completate?</button>
                <button onClick={() => { handleQuickAction("Spiegami la lezione [nome]"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20">• Spiegami lezione...</button>
                <button onClick={() => { handleQuickAction("Fammi un riassunto della lezione [nome]"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20">• Riassunto lezione...</button>
                <button onClick={() => { handleQuickAction("Quali sono i punti chiave della lezione [nome]?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20">• Punti chiave...</button>
              </div>
            </div>

            {/* CATEGORIA 7: Esercizi */}
            <div className="border-l-4 border-yellow-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>📝</span>
                Esercizi
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Quali esercizi ho da completare?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/20">• Esercizi da completare?</button>
                <button onClick={() => { handleQuickAction("Mostrami tutti i miei esercizi"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/20">• Tutti gli esercizi?</button>
                <button onClick={() => { handleQuickAction("Quali esercizi sono in scadenza?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/20">• Esercizi in scadenza?</button>
                <button onClick={() => { handleQuickAction("Ho esercizi pendenti?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/20">• Esercizi pendenti?</button>
                <button onClick={() => { handleQuickAction("Analizza il mio esercizio [nome]"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/20">• Analizza esercizio...</button>
                <button onClick={() => { handleQuickAction("Come ho fatto nell'esercizio [nome]?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/20">• Risultato esercizio...</button>
              </div>
            </div>

            {/* CATEGORIA 8: Università */}
            <div className="border-l-4 border-teal-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>🎓</span>
                Università e Corsi
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("A che punto sono con l'università?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20">• Progressi università?</button>
                <button onClick={() => { handleQuickAction("Quante lezioni ho completato?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20">• Lezioni completate?</button>
                <button onClick={() => { handleQuickAction("Quali corsi universitari ho?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20">• I miei corsi?</button>
                <button onClick={() => { handleQuickAction("Qual è la prossima lezione da completare?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20">• Prossima lezione?</button>
              </div>
            </div>

            {/* CATEGORIA 9: Consulenze */}
            <div className="border-l-4 border-pink-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>💼</span>
                Consulenze
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Quando ho la prossima consulenza?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-pink-50 dark:hover:bg-pink-900/20">• Prossima consulenza?</button>
                <button onClick={() => { handleQuickAction("Ho consulenze in programma?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-pink-50 dark:hover:bg-pink-900/20">• Consulenze programmate?</button>
                <button onClick={() => { handleQuickAction("Quante consulenze ho fatto?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-pink-50 dark:hover:bg-pink-900/20">• Consulenze fatte?</button>
              </div>
            </div>

            {/* CATEGORIA 10: Briefing e Dashboard */}
            <div className="border-l-4 border-cyan-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>📅</span>
                Briefing e Dashboard
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Cosa devo fare oggi?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-cyan-50 dark:hover:bg-cyan-900/20">• Task di oggi?</button>
                <button onClick={() => { handleQuickAction("Mostrami un riepilogo della mia giornata"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-cyan-50 dark:hover:bg-cyan-900/20">• Riepilogo giornata?</button>
                <button onClick={() => { handleQuickAction("Come sto andando con i miei progressi?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-cyan-50 dark:hover:bg-cyan-900/20">• Come sto andando?</button>
                <button onClick={() => { handleQuickAction("A che punto sono con tutto?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-cyan-50 dark:hover:bg-cyan-900/20">• Panoramica completa?</button>
              </div>
            </div>

            {/* CATEGORIA 11: Ricerca e Aiuto */}
            <div className="border-l-4 border-gray-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>🔍</span>
                Ricerca e Aiuto
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Mi serve aiuto sul budget"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">• Aiuto budget</button>
                <button onClick={() => { handleQuickAction("Quale lezione devo studiare per imparare gli investimenti?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">• Lezione investimenti?</button>
                <button onClick={() => { handleQuickAction("Dove posso risparmiare?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">• Dove risparmiare?</button>
                <button onClick={() => { handleQuickAction("Come posso aumentare il risparmio?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">• Aumentare risparmio?</button>
              </div>
            </div>

            {/* CATEGORIA 12: Quiz e Verifica */}
            <div className="border-l-4 border-lime-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>✅</span>
                Quiz e Verifica
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Posso fare un quiz sulla lezione [nome]?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-lime-50 dark:hover:bg-lime-900/20">• Quiz su lezione...</button>
                <button onClick={() => { handleQuickAction("Fammi delle domande per verificare che ho capito"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-lime-50 dark:hover:bg-lime-900/20">• Verifica apprendimento</button>
                <button onClick={() => { handleQuickAction("Vuoi testarmi sulla lezione [nome]?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-lime-50 dark:hover:bg-lime-900/20">• Testa conoscenze...</button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isLiveModeActive && (
        <LiveModeScreen
          mode={mode}
          consultantType={consultantType}
          onClose={() => setIsLiveModeActive(false)}
          onConversationSaved={(conversationId) => {
            queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] });
            setSelectedConversationId(conversationId);
            setIsLiveModeActive(false);
            toast({
              title: '✅ Conversazione salvata',
              description: 'La tua conversazione vocale è stata salvata!',
            });
          }}
        />
      )}
    </div>
  );
}