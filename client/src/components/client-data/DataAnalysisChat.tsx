import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { MessageList } from "@/components/ai-assistant/MessageList";
import { InputArea, AIModel, ThinkingLevel } from "@/components/ai-assistant/InputArea";
import { AIPreferencesSheet } from "@/components/ai-assistant/AIPreferencesSheet";
import { FullAuditDialog } from "./FullAuditDialog";
import {
  Sparkles,
  Bot,
  Loader2,
  BarChart3,
  Table,
  History,
  Lightbulb,
  X,
  MessageSquare,
  Clock,
  Database,
  Plus,
  ArrowRight,
  Settings,
  ShieldAlert,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  isThinking?: boolean;
  modelName?: string;
  thinkingLevel?: string;
  suggestedActions?: Array<{
    type: string;
    label: string;
    data?: any;
  }>;
  queryResult?: QueryResult;
}

interface QueryResult {
  success: boolean;
  data?: {
    question?: string;
    answer?: string;
    plan?: {
      steps: any[];
      complexity: string;
    };
    results?: Array<{
      tool: string;
      success: boolean;
      data: any;
      error?: string;
      executionTimeMs: number;
    }>;
    rows?: any[];
    aggregations?: Record<string, any>;
    chartData?: any[];
    summary?: string;
    totalExecutionTimeMs?: number;
    wasBlocked?: boolean;
    blockedResponse?: string;
    validationErrors?: string[];
    inventedNumbers?: string[];
  };
  explanation?: string;
  sqlGenerated?: string;
  error?: string;
}

interface Conversation {
  id: string;
  datasetId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface DataAnalysisChatProps {
  datasetId: string;
  datasetName: string;
  columnMapping?: Record<string, { displayName: string; dataType: string }>;
  onResultSelect?: (result: QueryResult) => void;
  onClose?: () => void;
}

interface AIPreferences {
  preferredModel?: AIModel;
  thinkingLevel?: ThinkingLevel;
  writingStyle?: string;
}

const fallbackQueries = [
  "Mostrami il totale delle vendite per mese",
  "Quali sono i 10 prodotti più venduti?",
  "Calcola la media degli ordini per cliente",
  "Confronta le vendite tra Q1 e Q2",
  "Trova gli outlier nei prezzi",
];

interface SmartQuestionsResult {
  questions: string[];
  availableMetrics: string[];
  dimensions: Record<string, string[]>;
  generatedAt: string;
  analysisTime: number;
}

function formatToolCallsAsThinking(toolCalls?: Array<{ toolName: string; params?: object }>): string | undefined {
  if (!toolCalls || toolCalls.length === 0) return undefined;
  return toolCalls.map(tc => {
    const params = tc.params ? Object.keys(tc.params).join(", ") : "";
    return `🔧 ${tc.toolName}${params ? ` (${params})` : ""}`;
  }).join("\n");
}

export function DataAnalysisChat({
  datasetId,
  datasetName,
  columnMapping,
  onResultSelect,
  onClose,
}: DataAnalysisChatProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>("gemini-3-flash-preview");
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>("low");
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [blockedResponseData, setBlockedResponseData] = useState<{
    blockedResponse?: string;
    validationErrors?: string[];
    inventedNumbers?: string[];
  } | null>(null);

  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/client-data/conversations", datasetId],
    queryFn: async () => {
      const response = await fetch(`/api/client-data/conversations?datasetId=${datasetId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      const result = await response.json();
      return result.data || [];
    },
  });

  const { data: preferences } = useQuery<AIPreferences>({
    queryKey: ["/api/ai-assistant/preferences"],
    queryFn: async () => {
      const response = await fetch("/api/ai-assistant/preferences", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return {};
      return response.json();
    },
  });

  const { data: smartQuestionsData, isLoading: smartQuestionsLoading, refetch: refetchSmartQuestions } = useQuery<{ success: boolean; data: SmartQuestionsResult }>({
    queryKey: [`/api/client-data/datasets/${datasetId}/smart-questions`],
    queryFn: async () => {
      const response = await fetch(`/api/client-data/datasets/${datasetId}/smart-questions`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch smart questions");
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
    enabled: messages.length === 0,
  });

  const smartQuestions = smartQuestionsData?.data?.questions || fallbackQueries;

  useEffect(() => {
    if (preferences) {
      if (preferences.preferredModel) setSelectedModel(preferences.preferredModel);
      if (preferences.thinkingLevel) setThinkingLevel(preferences.thinkingLevel);
    }
  }, [preferences]);

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/client-data/conversations", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ datasetId, title: `Analisi ${datasetName}` }),
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentConversationId(data.data?.id || data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/client-data/conversations", datasetId] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content, model, thinkingLvl }: { 
      conversationId: string; 
      content: string;
      model: AIModel;
      thinkingLvl: ThinkingLevel;
    }) => {
      return apiRequest("POST", `/api/client-data/conversations/${conversationId}/messages`, { 
        content,
        model,
        thinkingLevel: thinkingLvl,
        writingStyle: preferences?.writingStyle || "default",
        responseLength: (preferences as any)?.responseLength || "balanced",
        customInstructions: (preferences as any)?.customInstructions || "",
      });
    },
    onSuccess: (data: any) => {
      const assistantMsg = data.data?.assistantMessage;
      const toolCalls = assistantMsg?.toolCalls;
      const thinking = formatToolCallsAsThinking(toolCalls);

      const responseText = assistantMsg?.content || data.data?.answer || data.data?.explanation || "Ecco i risultati della tua query.";
      
      const resultActions: Array<{type: string; label: string; data?: any}> = [];
      const queryResult = data;
      if (queryResult?.success && queryResult?.data) {
        if (queryResult.data.results?.some((r: any) => r.success && r.data?.length > 0) ||
            (queryResult.data.rows && queryResult.data.rows.length > 0)) {
          resultActions.push({
            type: "view_results",
            label: "📊 Visualizza risultati",
            data: queryResult,
          });
        }
        
        if (queryResult.data.wasBlocked && queryResult.data.blockedResponse) {
          resultActions.push({
            type: "view_blocked",
            label: "🛡️ Vedi risposta bloccata",
            data: {
              blockedResponse: queryResult.data.blockedResponse,
              validationErrors: queryResult.data.validationErrors,
              inventedNumbers: queryResult.data.inventedNumbers,
            },
          });
        }
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: responseText,
        thinking,
        modelName: selectedModel.includes("pro") ? "Pro 3" : "Flash 3",
        thinkingLevel: thinkingLevel,
        suggestedActions: resultActions.length > 0 ? resultActions : undefined,
        queryResult: data,
      };
      setMessages((prev) => [...prev.filter(m => !m.isThinking), assistantMessage]);
      setIsTyping(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'analisi",
        variant: "destructive",
      });
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Mi dispiace, c'è stato un errore: ${error.message}`,
      };
      setMessages((prev) => [...prev.filter(m => !m.isThinking), errorMessage]);
      setIsTyping(false);
    },
  });

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
    };

    const thinkingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isThinking: true,
      modelName: selectedModel.includes("pro") ? "Pro 3" : "Flash 3",
      thinkingLevel: thinkingLevel,
    };

    setMessages((prev) => [...prev, userMessage, thinkingMessage]);
    setIsTyping(true);
    
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        const result = await createConversationMutation.mutateAsync();
        conversationId = result.data?.id || result.id;
        setCurrentConversationId(conversationId);
      } catch {
        toast({
          title: "Errore",
          description: "Non è stato possibile creare la conversazione",
          variant: "destructive",
        });
        setIsTyping(false);
        return;
      }
    }

    sendMessageMutation.mutate({ 
      conversationId, 
      content: content.trim(),
      model: selectedModel,
      thinkingLvl: thinkingLevel,
    });
  };

  const handleExampleClick = (query: string) => {
    handleSendMessage(query);
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/client-data/conversations/${conversationId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to load conversation");
      }
      const result = await response.json();
      
      if (result.success && result.data?.messages) {
        const loadedMessages: Message[] = result.data.messages.map((msg: any) => ({
          id: msg.id || Date.now().toString(),
          role: msg.role as "user" | "assistant",
          content: msg.content || "",
          thinking: formatToolCallsAsThinking(msg.toolCalls),
          queryResult: msg.queryResult,
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Non è stato possibile caricare la conversazione",
        variant: "destructive",
      });
    }
  };

  const handleHistorySelect = async (conversation: Conversation) => {
    setCurrentConversationId(conversation.id);
    setActiveTab("chat");
    await loadConversation(conversation.id);
    toast({
      title: "Conversazione caricata",
      description: `Caricata: ${conversation.title}`,
    });
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setActiveTab("chat");
  };

  const getColumns = () => {
    if (!columnMapping) return [];
    return Object.entries(columnMapping).map(([key, val]) => ({
      name: key,
      displayName: val.displayName,
      type: val.dataType,
    }));
  };

  const handleActionClick = (actionType?: string, actionData?: any) => {
    if (actionType === "view_blocked" && actionData) {
      setBlockedResponseData(actionData);
      setShowBlockedDialog(true);
      return;
    }
    
    if (actionType === "view_results") {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.queryResult && onResultSelect) {
        onResultSelect(lastMessage.queryResult);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                Analisi AI
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {datasetName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <FullAuditDialog datasetId={datasetId} datasetName={datasetName} disabled={isTyping} />
            <AIPreferencesSheet />
            {onClose && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="px-4 pb-3">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "chat" | "history")}>
            <TabsList className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <TabsTrigger
                value="chat"
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400 data-[state=active]:shadow-sm px-4 py-1.5 text-sm font-medium rounded-md transition-all"
              >
                <MessageSquare className="h-4 w-4 mr-1.5" />
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400 data-[state=active]:shadow-sm px-4 py-1.5 text-sm font-medium rounded-md transition-all"
              >
                <History className="h-4 w-4 mr-1.5" />
                Cronologia
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-950">
        {activeTab === "chat" ? (
          <>
            {messages.length === 0 ? (
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
                        <Bot className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          Ciao! 👋
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Sono il tuo assistente AI per l'analisi dati
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-100 dark:border-violet-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                        Dataset attivo
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {datasetName}
                    </p>
                  </div>

                  {getColumns().length > 0 && (
                    <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Table className="h-4 w-4 text-violet-500" />
                        Colonne disponibili
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {getColumns().map((col) => (
                          <Badge 
                            key={col.name} 
                            variant="secondary"
                            className="bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800"
                          >
                            {col.displayName}
                            <span className="ml-1 text-xs text-violet-400">({col.type})</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
                        {smartQuestionsLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 text-violet-500 animate-spin" />
                            Analisi dati in corso...
                          </>
                        ) : smartQuestionsData?.data ? (
                          <>
                            <Zap className="h-4 w-4 text-amber-500" />
                            Domande intelligenti
                          </>
                        ) : (
                          <>
                            <Lightbulb className="h-4 w-4 text-amber-500" />
                            Prova con queste domande
                          </>
                        )}
                      </p>
                      {smartQuestionsData?.data && (
                        <span className="text-xs text-gray-400">
                          {smartQuestionsData.data.availableMetrics.length} metriche disponibili
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2">
                      {smartQuestionsLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                          ))}
                        </div>
                      ) : (
                        smartQuestions.map((query, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleExampleClick(query)}
                            disabled={isTyping}
                            className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group disabled:opacity-50"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-violet-700 dark:group-hover:text-violet-300">
                                {query}
                              </span>
                              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 overflow-hidden">
                <MessageList
                  messages={messages}
                  isTyping={isTyping}
                  onActionClick={handleActionClick}
                />
              </div>
            )}
          </>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Conversazioni precedenti</h4>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={startNewConversation}
                  className="text-violet-600 border-violet-200 hover:bg-violet-50 dark:border-violet-800 dark:hover:bg-violet-900/20"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuova chat
                </Button>
              </div>
              
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              ) : conversations && conversations.length > 0 ? (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleHistorySelect(conv)}
                      className={`w-full text-left p-3 rounded-xl border transition-all group ${
                        currentConversationId === conv.id
                          ? "bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700"
                          : "border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 flex items-center justify-center">
                          <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate group-hover:text-violet-700 dark:group-hover:text-violet-300">
                            {conv.title || `Conversazione ${new Date(conv.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(conv.updatedAt).toLocaleDateString('it-IT', {
                                day: 'numeric',
                                month: 'short',
                              })} {new Date(conv.updatedAt).toLocaleTimeString('it-IT', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {conv.messageCount || 0} msg
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                    <History className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Nessuna conversazione
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                    Le tue analisi precedenti appariranno qui.
                  </p>
                  <Button
                    onClick={() => setActiveTab("chat")}
                    className="mt-4 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    Inizia una nuova analisi
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {activeTab === "chat" && (
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <InputArea 
            onSend={handleSendMessage}
            disabled={false}
            isProcessing={isTyping}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            thinkingLevel={thinkingLevel}
            onThinkingLevelChange={setThinkingLevel}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
            L'AI potrebbe generare informazioni inaccurate
          </p>
        </div>
      )}

      <Dialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ShieldAlert className="h-5 w-5" />
              Risposta AI Bloccata
            </DialogTitle>
            <DialogDescription>
              Questa risposta è stata bloccata perché conteneva numeri non verificabili dal database.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {blockedResponseData?.validationErrors && blockedResponseData.validationErrors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-medium text-red-800 dark:text-red-300 mb-2">Errori di validazione:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-400">
                  {blockedResponseData.validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {blockedResponseData?.inventedNumbers && blockedResponseData.inventedNumbers.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2">Numeri inventati rilevati:</h4>
                <div className="flex flex-wrap gap-2">
                  {blockedResponseData.inventedNumbers.map((num, idx) => (
                    <Badge key={idx} variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
                      {num}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {blockedResponseData?.blockedResponse && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Risposta originale (bloccata):</h4>
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {blockedResponseData.blockedResponse}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setShowBlockedDialog(false)} variant="outline">
              Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
