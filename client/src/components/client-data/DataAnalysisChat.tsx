import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { ThinkingBubble } from "@/components/ai-assistant/ThinkingBubble";
import { AIPreferencesSheet } from "@/components/ai-assistant/AIPreferencesSheet";
import {
  Send,
  Sparkles,
  User,
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
} from "lucide-react";

interface QueryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  queryResult?: QueryResult;
  toolCalls?: string[];
  isThinking?: boolean;
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

const exampleQueries = [
  "Mostrami il totale delle vendite per mese",
  "Quali sono i 10 prodotti più venduti?",
  "Calcola la media degli ordini per cliente",
  "Confronta le vendite tra Q1 e Q2",
  "Trova gli outlier nei prezzi",
];

export function DataAnalysisChat({
  datasetId,
  datasetName,
  columnMapping,
  onResultSelect,
  onClose,
}: DataAnalysisChatProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<QueryMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const { data: preferences } = useQuery({
    queryKey: ["/api/client-data/ai-preferences"],
    queryFn: async () => {
      const response = await fetch("/api/client-data/ai-preferences", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.data || null;
    },
  });

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
    mutationFn: async ({ conversationId, question }: { conversationId: string; question: string }) => {
      return apiRequest("POST", `/api/client-data/conversations/${conversationId}/messages`, { question });
    },
    onSuccess: (data: any) => {
      const toolCalls = data.toolCalls?.map((tc: { toolName: string; params?: object }) => {
        const params = tc.params ? Object.keys(tc.params).join(", ") : "";
        return params ? `${tc.toolName} (${params})` : tc.toolName;
      }).filter(Boolean) || [];

      const responseText = data.data?.answer || data.data?.explanation || data.data?.summary || "Ecco i risultati della tua query.";
      const assistantMessage: QueryMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
        queryResult: data,
        toolCalls,
      };
      setMessages((prev) => [...prev.filter(m => !m.isThinking), assistantMessage]);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'analisi",
        variant: "destructive",
      });
      const errorMessage: QueryMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Mi dispiace, c'è stato un errore: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev.filter(m => !m.isThinking), errorMessage]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessageMutation.isPending) return;

    const userMessage: QueryMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    const thinkingMessage: QueryMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isThinking: true,
    };

    setMessages((prev) => [...prev, userMessage, thinkingMessage]);
    
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
        return;
      }
    }

    sendMessageMutation.mutate({ conversationId, question: input.trim() });
    setInput("");
  };

  const handleExampleClick = (query: string) => {
    setInput(query);
    inputRef.current?.focus();
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
        const loadedMessages: QueryMessage[] = result.data.messages.map((msg: any) => ({
          id: msg.id || Date.now().toString(),
          role: msg.role as "user" | "assistant",
          content: msg.content || "",
          timestamp: new Date(msg.createdAt || Date.now()),
          queryResult: msg.queryResult,
          toolCalls: msg.toolCalls?.map((tc: { toolName: string; params?: object }) => {
            const params = tc.params ? Object.keys(tc.params).join(", ") : "";
            return params ? `${tc.toolName} (${params})` : tc.toolName;
          }) || [],
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
  };

  const getColumns = () => {
    if (!columnMapping) return [];
    return Object.entries(columnMapping).map(([key, val]) => ({
      name: key,
      displayName: val.displayName,
      type: val.dataType,
    }));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="h-full flex flex-col bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
      <CardHeader className="flex-none border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Analisi AI
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {datasetName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AIPreferencesSheet />
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chat" | "history")} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 border-b bg-white/50 dark:bg-slate-900/50">
          <TabsList className="grid w-full max-w-[300px] grid-cols-2">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Cronologia
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0">
          <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <AnimatePresence mode="popLayout">
                {messages.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 py-8"
                  >
                    <div className="text-center">
                      <motion.div 
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-xl mb-4"
                      >
                        <Bot className="h-8 w-8 text-white" />
                      </motion.div>
                      <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-200">
                        Ciao! Sono il tuo assistente AI per l'analisi dati
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Puoi farmi domande in linguaggio naturale sui tuoi dati
                      </p>
                    </div>

                    {getColumns().length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm"
                      >
                        <p className="text-sm font-medium mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                          <Table className="h-4 w-4 text-purple-500" />
                          Colonne disponibili
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {getColumns().map((col) => (
                            <Badge 
                              key={col.name} 
                              variant="outline"
                              className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
                            >
                              {col.displayName}
                              <span className="ml-1 text-xs text-slate-400">({col.type})</span>
                            </Badge>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <p className="text-sm font-medium mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        Prova con queste domande
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {exampleQueries.map((query, idx) => (
                          <motion.button
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 + idx * 0.05 }}
                            onClick={() => handleExampleClick(query)}
                            className="px-4 py-2 rounded-full text-sm border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all shadow-sm hover:shadow-md"
                          >
                            {query}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02, duration: 0.3 }}
                      >
                        {message.isThinking ? (
                          <div className="flex gap-3 items-start">
                            <div className="flex-none w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-md">
                              <Bot className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <ThinkingBubble 
                                isThinking={true}
                                thinking="Sto analizzando i dati..."
                                className="mb-0"
                              />
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-2 text-sm text-slate-500 mt-2"
                              >
                                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                                <span className="bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent font-medium">
                                  Sto analizzando i dati...
                                </span>
                              </motion.div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`flex gap-3 ${
                              message.role === "user" ? "justify-end" : "justify-start"
                            }`}
                          >
                            {message.role === "assistant" && (
                              <div className="flex-none w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-md">
                                <Bot className="h-4 w-4 text-white" />
                              </div>
                            )}
                            <div className="flex flex-col max-w-[80%]">
                              {message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0 && (
                                <ThinkingBubble 
                                  thinking={message.toolCalls.map(tc => `• ${tc}`).join("\n")}
                                  className="mb-2"
                                />
                              )}
                              <div
                                className={`rounded-2xl p-4 shadow-sm ${
                                  message.role === "user"
                                    ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-br-md"
                                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-md"
                                }`}
                              >
                                <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
                                  message.role === "user" ? "text-white" : "text-slate-700 dark:text-slate-300"
                                }`}>
                                  {message.content}
                                </p>
                                {message.queryResult?.success && message.queryResult.data && (
                                  <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-600/50 space-y-2">
                                    {message.queryResult.data.summary && (
                                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {message.queryResult.data.summary}
                                      </p>
                                    )}
                                    {(message.queryResult.data.results?.some(r => r.success && r.data?.length > 0) ||
                                      (message.queryResult.data.rows && message.queryResult.data.rows.length > 0)) && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onResultSelect?.(message.queryResult!)}
                                        className="mt-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0 hover:from-purple-600 hover:to-cyan-600"
                                      >
                                        <BarChart3 className="h-4 w-4 mr-2" />
                                        Visualizza risultati
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className={`text-xs mt-1.5 ${
                                message.role === "user" ? "text-right" : "text-left"
                              } text-slate-400`}>
                                {formatTime(message.timestamp)}
                              </span>
                            </div>
                            {message.role === "user" && (
                              <div className="flex-none w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-800">
                                <User className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </ScrollArea>

            <form onSubmit={handleSubmit} className="p-4 border-t bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex-none">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Fai una domanda sui tuoi dati..."
                  disabled={sendMessageMutation.isPending}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-purple-500"
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || sendMessageMutation.isPending}
                  className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white shadow-lg"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-hidden m-0">
          <CardContent className="h-full p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-slate-700 dark:text-slate-300">Conversazioni precedenti</h4>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={startNewConversation}
                className="text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Nuova chat
              </Button>
            </div>
            <ScrollArea className="h-[calc(100%-60px)]">
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
              ) : conversations && conversations.length > 0 ? (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <motion.button
                      key={conv.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => handleHistorySelect(conv)}
                      className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-md ${
                        currentConversationId === conv.id
                          ? "bg-gradient-to-r from-purple-50 to-cyan-50 dark:from-purple-900/20 dark:to-cyan-900/20 border-purple-300 dark:border-purple-700"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {conv.title}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(conv.updatedAt).toLocaleDateString("it-IT")}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {conv.messageCount} messaggi
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">
                    Nessuna conversazione precedente
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                    Le tue analisi appariranno qui
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
