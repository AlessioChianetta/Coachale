import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, MessageSquare, Menu, X, Sparkles, Trash2, ChevronLeft, ChevronRight, Calendar, CheckCircle, BookOpen, Target, Users, TrendingUp, BarChart, Settings, AlertCircle, Bot, Settings2, Filter, Brain } from "lucide-react";
import { MessageList } from "@/components/ai-assistant/MessageList";
import { InputArea, AIModel, ThinkingLevel, AttachedFile } from "@/components/ai-assistant/InputArea";
import { QuickActions } from "@/components/ai-assistant/QuickActions";
import { AIPreferencesSheet } from "@/components/ai-assistant/AIPreferencesSheet";
import { ClientAIPreferencesManager } from "@/components/ai-assistant/ClientAIPreferencesManager";
import { ConversationMemoryPopover } from "@/components/ai-assistant/ConversationMemoryPopover";
import { WelcomeScreen } from "@/components/ai-assistant/WelcomeScreen";
import { ConversationSidebar } from "@/components/ai-assistant/ConversationSidebar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
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
  enableInAIAssistant: boolean;
  fileSearchCategories?: Record<string, boolean>;
}

export default function ConsultantAIAssistant() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(!isMobile);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showTestQuestionsDialog, setShowTestQuestionsDialog] = useState(false);
  const [swipedConversationId, setSwipedConversationId] = useState<string | null>(null);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [conversationFilter, setConversationFilter] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<AIModel>("gemini-3-flash-preview");
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>("low");

  const tempAssistantIdRef = useRef<string | null>(null);
  const [isNewConversation, setIsNewConversation] = useState<boolean>(false);

  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const [retryMaxAttempts, setRetryMaxAttempts] = useState<number>(0);
  const [retryDelaySeconds, setRetryDelaySeconds] = useState<number>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [safetyTimeoutActive, setSafetyTimeoutActive] = useState<boolean>(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/consultant/ai/conversations"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/ai/conversations", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
  });

  const { refetch: fetchConversationMessages } = useQuery({
    queryKey: ["/api/consultant/ai/conversations", selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      setLoadingConversationId(selectedConversationId);
      try {
        const response = await fetch(`/api/consultant/ai/conversations/${selectedConversationId}`, {
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

  const { data: activeProvider } = useQuery({
    queryKey: ["/api/ai/active-provider"],
    queryFn: async () => {
      const response = await fetch("/api/ai/active-provider", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: availableAgents = [] } = useQuery<AgentForAssistant[]>({
    queryKey: ["/api/ai-assistant/consultant/agents-for-assistant"],
    queryFn: async () => {
      const response = await fetch("/api/ai-assistant/consultant/agents-for-assistant", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const filteredConversations = conversationFilter === "all"
    ? conversations
    : conversationFilter === "base"
      ? conversations.filter((c) => !c.agentId || c.agentId === null)
      : conversations.filter((c) => c.agentId === conversationFilter);

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/consultant/ai/conversations/${conversationId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete conversation");
      return response.json();
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/conversations"] });
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
      const conversationIds = filteredConversations.map(c => c.id);
      await Promise.all(
        conversationIds.map(id =>
          fetch(`/api/consultant/ai/conversations/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/conversations"] });
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
      const response = await fetch("/api/consultant/ai/chat", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
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
                console.log(`🧠 [THINKING CHUNK] +${data.content.length} chars, total: ${fullThinking.length} chars`);
                console.log(`   Preview: "${data.content.substring(0, 100)}..."`);
                
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
                console.log(`📝 [DELTA CHUNK] +${data.content.length} chars`);
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
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error("Error parsing SSE data:", parseError);
            }
          }
        }
      }

      console.log(`✅ [STREAMING COMPLETE] thinking: ${fullThinking.length} chars, content: ${fullContent.length} chars`);
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
      
      setIsNewConversation(false);
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/conversations"], exact: true });
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
    if (selectedConversationId && !isNewConversation) {
      fetchConversationMessages();
    }
  }, [selectedConversationId, isNewConversation]);

  useEffect(() => {
    setSelectedConversationId(null);
    setMessages([]);
    setConversationFilter(selectedAgentId || "base");
  }, [selectedAgentId]);

  useEffect(() => {
    setSidebarOpen(false);
    
    if (!isMobile) {
      window.dispatchEvent(new CustomEvent('ai-assistant-opened'));
    }
    
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-teal-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="flex h-screen">
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />

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
                conversations={filteredConversations}
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
                availableAgents={availableAgents}
                agentFilter={conversationFilter}
                onAgentFilterChange={setConversationFilter}
                onSettingsClick={() => setLocation('/consultant/ai-settings')}
              />
            </div>
          )}

          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
            {/* Agent Selection Header */}
            <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 px-4 py-3 flex-shrink-0">
              <div className="flex items-center justify-between max-w-4xl mx-auto">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Agente:</span>
                  </div>
                  <Select
                    value={selectedAgentId || "base"}
                    onValueChange={(value) => setSelectedAgentId(value === "base" ? null : value)}
                  >
                    <SelectTrigger className="w-[280px] h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder="Seleziona agente" />
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
                            {agent.businessName && (
                              <span className="text-xs text-muted-foreground">({agent.businessName})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAgentId && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                      L'AI userà il contesto dell'agente selezionato
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <ConversationMemoryPopover />
                  <AIPreferencesSheet />
                  <ClientAIPreferencesManager />
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {messages.length === 0 ? (
                <WelcomeScreen 
                  variant="consultant" 
                  onSuggestionClick={handleQuickAction} 
                  disabled={isTyping} 
                  agentId={selectedAgentId}
                  agentName={selectedAgentId ? availableAgents.find(a => a.id === selectedAgentId)?.name : undefined} 
                />
              ) : (
                <MessageList messages={messages} isTyping={isTyping} />
              )}
            </div>
            
            <div className="pt-6 px-4 pb-4 bg-white dark:bg-slate-900 flex-shrink-0">
              <div className="max-w-4xl mx-auto space-y-3">
                {isRetrying && (
                  <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <AlertDescription className="text-orange-800 dark:text-orange-200">
                      {countdownSeconds > 0 ? (
                        <span className="font-medium">
                          ⏳ Riprovo tra {countdownSeconds}s... (tentativo {retryAttempt}/{retryMaxAttempts - 1})
                        </span>
                      ) : (
                        <span className="font-medium">
                          🔄 Riconnessione in corso...
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
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

      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare tutte le conversazioni?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Tutte le conversazioni verranno eliminate permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteAllDialog(false)}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllConversationsMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Elimina Tutte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showTestQuestionsDialog} onOpenChange={setShowTestQuestionsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Domande di Esempio - Consulente AI
            </DialogTitle>
            <DialogDescription>
              Clicca su una domanda per provarla direttamente nell'AI Assistant
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="border-l-4 border-blue-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>👥</span>
                Gestione Clienti
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Mostrami i clienti con maggiore engagement"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">• Top clienti per engagement</button>
                <button onClick={() => { handleQuickAction("Quali clienti non hanno activity recente?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">• Clienti inattivi</button>
                <button onClick={() => { handleQuickAction("Dammi una lista dei nuovi clienti questo mese"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">• Nuovi clienti</button>
                <button onClick={() => { handleQuickAction("Chi sono i clienti con task in scadenza?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">• Task in scadenza</button>
              </div>
            </div>

            <div className="border-l-4 border-green-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>📊</span>
                Analisi e Report
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Genera un report dei progressi settimanali"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-green-50 dark:hover:bg-green-900/20">• Report settimanale</button>
                <button onClick={() => { handleQuickAction("Mostrami le statistiche del mese corrente"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-green-50 dark:hover:bg-green-900/20">• Statistiche mensili</button>
                <button onClick={() => { handleQuickAction("Quali sono i trend di crescita dei clienti?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-green-50 dark:hover:bg-green-900/20">• Trend crescita</button>
                <button onClick={() => { handleQuickAction("Analisi performance campagne marketing"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-green-50 dark:hover:bg-green-900/20">• Performance campagne</button>
              </div>
            </div>

            <div className="border-l-4 border-purple-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>📈</span>
                Campagne Marketing
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Quali campagne hanno il miglior ROI?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">• Migliore ROI</button>
                <button onClick={() => { handleQuickAction("Mostrami le campagne attive in questo momento"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">• Campagne attive</button>
                <button onClick={() => { handleQuickAction("Suggerisci miglioramenti per le campagne"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">• Suggerimenti</button>
                <button onClick={() => { handleQuickAction("Crea una nuova strategia di marketing"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">• Nuova strategia</button>
              </div>
            </div>

            <div className="border-l-4 border-orange-500 pl-4 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>📅</span>
                Appuntamenti e Task
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { handleQuickAction("Quali sono gli appuntamenti di oggi?"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20">• Appuntamenti oggi</button>
                <button onClick={() => { handleQuickAction("Mostrami i task prioritari"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20">• Task prioritari</button>
                <button onClick={() => { handleQuickAction("Organizza il mio calendario della settimana"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20">• Organizza calendario</button>
                <button onClick={() => { handleQuickAction("Prepara un briefing per il prossimo appuntamento"); setShowTestQuestionsDialog(false); }} className="text-left p-2 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20">• Briefing appuntamento</button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
