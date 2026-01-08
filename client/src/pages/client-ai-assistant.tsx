import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, MessageSquare, Menu, X, Sparkles, Trash2, ChevronLeft, ChevronRight, Calendar, CheckCircle, BookOpen, Target, AlertCircle, Sun, Moon, Mic, DollarSign, TrendingUp, Zap, Bot, Filter } from "lucide-react";
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
import { InputArea, AIModel, ThinkingLevel, AttachedFile } from "@/components/ai-assistant/InputArea";
import { QuickActions } from "@/components/ai-assistant/QuickActions";
import { LiveModeScreen } from "@/components/ai-assistant/live-mode/LiveModeScreen";
import { AIPreferencesSheet } from "@/components/ai-assistant/AIPreferencesSheet";
import { WelcomeScreen } from "@/components/ai-assistant/WelcomeScreen";
import { ConversationSidebar } from "@/components/ai-assistant/ConversationSidebar";
import { ConversationMemoryPopover } from "@/components/ai-assistant/ConversationMemoryPopover";
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
  thinking?: string;
  isThinking?: boolean;
  modelName?: string;
  thinkingLevel?: string;
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
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<AIModel>("gemini-3-flash-preview");
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>("low");

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
    mutationFn: async ({ message, model, thinkingLevel: thinkLevel }: { message: string; model?: AIModel; thinkingLevel?: ThinkingLevel }) => {
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
          model: model || selectedModel,
          thinkingLevel: thinkLevel || thinkingLevel,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let fullThinking = "";
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
              } else if (data.type === 'thinking') {
                fullThinking += data.content;
                console.log(`🧠 [CLIENT THINKING] +${data.content.length} chars, total: ${fullThinking.length}`);
                
                if (tempAssistantIdRef.current) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantIdRef.current
                        ? { ...msg, thinking: fullThinking, isThinking: true }
                        : msg
                    )
                  );
                }
              } else if (data.type === 'delta') {
                console.log(`📝 [CLIENT DELTA] +${data.content.length} chars`);
                fullContent += data.content;

                if (tempAssistantIdRef.current) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantIdRef.current
                        ? { ...msg, content: fullContent, isThinking: false }
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

      console.log(`✅ [CLIENT STREAMING COMPLETE] thinking: ${fullThinking.length} chars, content: ${fullContent.length} chars`);
      return { 
        conversationId, 
        messageId, 
        message: fullContent, 
        thinking: fullThinking,
        status: 'completed' as const, 
        suggestedActions 
      };
    },
    onMutate: async (params) => {
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: params.message,
      };

      const modelLabel = selectedModel === "gemini-3-pro-preview" ? "Pro 3" : "Flash 3";
      const thinkingLabel = thinkingLevel === "none" ? "Nessuno" : thinkingLevel === "low" ? "Basso" : thinkingLevel === "medium" ? "Medio" : "Alto";
      const assistantPlaceholder: Message = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        status: "processing",
        isThinking: true,
        modelName: modelLabel,
        thinkingLevel: thinkingLabel,
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
                thinking: data.thinking || msg.thinking,
                isThinking: false,
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

  const handleSendMessage = (message: string, _files?: AttachedFile[], model?: AIModel, thinkLevel?: ThinkingLevel) => {
    sendMessageMutation.mutate({ message, model: model || selectedModel, thinkingLevel: thinkLevel || thinkingLevel });
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

  // Clear chat view and sync filter when selectedAgentId changes
  useEffect(() => {
    setSelectedConversationId(null);
    setMessages([]);
    setAgentFilter(selectedAgentId || "base");
  }, [selectedAgentId]);

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''} bg-gradient-to-br ${theme === 'dark' ? 'from-slate-900 via-slate-900 to-slate-900' : 'from-slate-50 via-cyan-50/30 to-teal-50/20'}`}>
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />

        <div className="flex-1 flex overflow-hidden">
          {(!isMobile || chatSidebarOpen) && (
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
                variant="client"
                isMobile={isMobile}
                sidebarMinimized={sidebarMinimized}
                onToggleMinimize={() => setSidebarMinimized(!sidebarMinimized)}
                availableAgents={availableAgents}
                agentFilter={agentFilter}
                onAgentFilterChange={setAgentFilter}
              />
            </div>
          )}

          <div className={`flex-1 flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
            {/* Chat Header with Agent Selector and Preferences */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-md ring-2 ring-cyan-200/50 dark:ring-cyan-700/50">
                  {selectedAgentId ? (
                    <Bot className="h-4 w-4 text-white" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-white" />
                  )}
                </div>
                {availableAgents.length > 0 ? (
                  <Select 
                    value={selectedAgentId || "base"} 
                    onValueChange={(value) => {
                      const newAgentId = value === "base" ? null : value;
                      setSelectedAgentId(newAgentId);
                      setAgentFilter(value);
                    }}
                  >
                    <SelectTrigger className="w-auto min-w-[180px] h-9 border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700/50 focus:ring-0 shadow-none">
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          <SelectValue />
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-cyan-500" />
                          <span>Assistente Base</span>
                        </div>
                      </SelectItem>
                      {availableAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-teal-500" />
                            <span>{agent.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Assistente AI
                    </h2>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ConversationMemoryPopover mode="client" />
                <AIPreferencesSheet />
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {messages.length === 0 ? (
                <WelcomeScreen 
                  variant="client" 
                  onSuggestionClick={handleQuickAction} 
                  disabled={isTyping} 
                  agentId={selectedAgentId}
                  agentName={selectedAgentId ? availableAgents.find(a => a.id === selectedAgentId)?.name : undefined} 
                />
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

              <div className="pt-6 px-4 pb-4 bg-white dark:bg-slate-900 flex-shrink-0">
                <div className="max-w-4xl mx-auto">
                  <InputArea
                    onSend={handleSendMessage}
                    disabled={isTyping || sendMessageMutation.isPending}
                    onLiveModeClick={() => setIsLiveModeActive(true)}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    thinkingLevel={thinkingLevel}
                    onThinkingLevelChange={setThinkingLevel}
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