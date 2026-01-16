import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Plus, BookOpen, FileText, GraduationCap, AlertCircle, Settings, Maximize2, ArrowRight, History, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ModeSelector } from "./ModeSelector";
import { ConsultantTypePicker } from "./ConsultantTypePicker";
import { MessageList } from "./MessageList";
import { InputArea, AIModel, ThinkingLevel, AttachedFile } from "./InputArea";
import { QuickActions } from "./QuickActions";
import { ConsultantQuickActions } from "./ConsultantQuickActions";
import { AIMode, ConsultantType } from "./AIAssistant";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { PageContext } from "@/hooks/use-page-context";
import { ConsultantPageContext } from "@/hooks/use-consultant-page-context";
import { useDocumentFocus } from "@/hooks/use-document-focus";

interface CodeExecution {
  language: string;
  code: string;
  outcome?: string;
  output?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "processing" | "completed" | "error";
  timestamp?: Date;
  suggestedActions?: Array<{
    type: string;
    label: string;
    data?: any;
  }>;
  codeExecutions?: CodeExecution[];
}

interface OnboardingStepStatus {
  stepId: string;
  status: 'pending' | 'configured' | 'verified' | 'error' | 'skipped';
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mode: AIMode;
  setMode: (mode: AIMode) => void;
  consultantType: ConsultantType;
  setConsultantType: (type: ConsultantType) => void;
  pageContext?: PageContext | any; // Allow both PageContext and ConsultantPageContext
  hasPageContext?: boolean;
  openedFromContext?: boolean;
  isConsultantMode?: boolean; // NEW: Flag for consultant mode
  autoMessage?: string | null; // Auto-send message when opening from document focus
  onAutoMessageSent?: () => void; // Callback after auto message is sent
  embedded?: boolean;
  isOnboardingMode?: boolean; // Specialized mode for setup wizard assistance
  onboardingStatuses?: OnboardingStepStatus[]; // Dynamic onboarding step statuses for AI context
}

// Funzione placeholder per stimare i token (da implementare o sostituire con una libreria)
const estimateTokens = (text: string): number => {
  // Una stima molto approssimativa: conta le parole e moltiplica per un fattore
  // Un modello reale userebbe un tokenizer specifico (es. cl100k_base di OpenAI)
  const words = text.split(/\s+/).filter(word => word.length > 0);
  return Math.ceil(words.length * 1.3); // Fattore di conversione approssimativo
};

// Funzione per attendere se il rate limit viene raggiunto
const MAX_TOKENS_PER_MINUTE = 250000;
const TOKEN_RESET_INTERVAL = 60000; // 1 minuto in millisecondi

export function ChatPanel({
  isOpen,
  onClose,
  mode,
  setMode,
  consultantType,
  setConsultantType,
  pageContext,
  hasPageContext = false,
  openedFromContext = false,
  isConsultantMode = false,
  autoMessage = null,
  onAutoMessageSent,
  embedded = false,
  isOnboardingMode = false,
  onboardingStatuses
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
  const [isTyping, setIsTyping] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    tokensUsed: number;
    resetAt: number;
    isWaiting: boolean;
  }>({ tokensUsed: 0, resetAt: Date.now() + TOKEN_RESET_INTERVAL, isWaiting: false });
  const [retryInfo, setRetryInfo] = useState<{
    isRetrying: boolean;
    retryAttempt: number;
    retryMaxAttempts: number;
    retryDelaySeconds: number;
    countdownSeconds: number;
  }>({
    isRetrying: false,
    retryAttempt: 0,
    retryMaxAttempts: 0,
    retryDelaySeconds: 0,
    countdownSeconds: 0
  });
  const [safetyTimeoutActive, setSafetyTimeoutActive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
  const [conversations, setConversations] = useState<Array<{
    id: string;
    title: string | null;
    mode: string;
    lastMessageAt: string | null;
    createdAt: string;
  }>>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const userName = useMemo(() => {
    const user = getAuthUser();
    return user?.firstName || "Utente";
  }, []);

  // Document focus for "Ask about this document" feature
  const { focusedDocument, clearFocus } = useDocumentFocus();

  // Ref to track if autoMessage has been processed
  const autoMessageProcessedRef = useRef(false);

  // Load conversations for history tab
  const loadConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const endpoint = isConsultantMode ? "/api/consultant/ai/conversations" : "/api/ai/conversations";
      const response = await fetch(endpoint, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data || []);
      }
    } catch (error: any) {
      console.error("Error loading conversations:", error?.message || error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Load conversation messages when selecting from history
  const loadConversationMessages = async (conversationId: string) => {
    try {
      const endpoint = isConsultantMode
        ? `/api/consultant/ai/conversations/${conversationId}`
        : `/api/ai/conversations/${conversationId}`;
      console.log("Loading conversation:", conversationId, "endpoint:", endpoint);
      const response = await fetch(endpoint, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        console.log("Conversation data:", data);
        if (data.messages && data.messages.length > 0) {
          const mappedMessages = data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role as "user" | "assistant",
            content: msg.content,
            status: "completed" as const,
            timestamp: new Date(msg.createdAt),
          }));
          console.log("Mapped messages:", mappedMessages);
          setMessages(mappedMessages);
          setCurrentConversationId(conversationId);
          setActiveTab("chat");
        } else {
          console.log("No messages found, switching to chat anyway");
          setCurrentConversationId(conversationId);
          setActiveTab("chat");
        }
      } else {
        console.error("Response not OK:", response.status);
      }
    } catch (error: any) {
      console.error("Error loading conversation messages:", error?.message || String(error));
      toast({
        title: "Errore",
        description: "Impossibile caricare la conversazione",
        variant: "destructive",
      });
    }
  };

  // Load conversations when opening history tab
  useEffect(() => {
    if (isOpen && activeTab === "history") {
      loadConversations();
    }
  }, [isOpen, activeTab, isConsultantMode]);

  // Funzione per attendere se necessario
  const waitForRateLimit = async (estimatedTokens: number) => {
    let currentTokensUsed = rateLimitInfo.tokensUsed;
    let currentTime = Date.now();

    // Se il tempo di reset è passato, resetta i token usati
    if (currentTime >= rateLimitInfo.resetAt) {
      setRateLimitInfo(prev => ({
        ...prev,
        tokensUsed: 0,
        resetAt: currentTime + TOKEN_RESET_INTERVAL,
        isWaiting: false
      }));
      currentTokensUsed = 0;
    }

    // Verifica se l'aggiunta dei token stimati supera il limite
    if (currentTokensUsed + estimatedTokens > MAX_TOKENS_PER_MINUTE) {
      setRateLimitInfo(prev => ({ ...prev, isWaiting: true }));
      const timeToWait = rateLimitInfo.resetAt - currentTime;
      console.log(`Rate limit reached. Waiting for ${Math.ceil(timeToWait / 1000)} seconds.`);
      await new Promise(resolve => setTimeout(resolve, timeToWait));
      // Dopo l'attesa, resetta i contatori e riprova
      setRateLimitInfo(prev => ({
        tokensUsed: 0,
        resetAt: Date.now() + TOKEN_RESET_INTERVAL,
        isWaiting: false
      }));
      currentTokensUsed = 0; // Resetta per la nuova stima
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isTyping || rateLimitInfo.isWaiting) return;

    // Stima token per questo messaggio e la potenziale risposta
    const estimatedTokens = estimateTokens(message) + 1000; // +1000 per il contesto e la risposta
    console.log(`📊 Stima token per il messaggio:`, {
      messaggioUtente: estimateTokens(message),
      contestoERisposta: 1000,
      totaleStimato: estimatedTokens,
      tokenGiaUsati: rateLimitInfo.tokensUsed,
      tokenDopoInvio: rateLimitInfo.tokensUsed + estimatedTokens,
      limite: MAX_TOKENS_PER_MINUTE
    });

    // Attendi se necessario prima di procedere
    await waitForRateLimit(estimatedTokens);

    const userMessageId = Date.now().toString();
    const assistantMessageId = (Date.now() + 1).toString();

    // Add user message to UI immediately
    const userMessage: Message = {
      id: userMessageId,
      role: "user",
      content: message,
      status: "completed",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    // Aggiorna i token usati dopo aver superato il rate limit check
    setRateLimitInfo(prev => ({
      ...prev,
      tokensUsed: prev.tokensUsed + estimatedTokens
    }));

    // Rimuovi il placeholder "Preparo una risposta dettagliata" se esistente
    setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));

    try {
      // Use different endpoint based on mode
      const endpoint = isConsultantMode ? "/api/consultant/ai/chat" : "/api/ai/chat";

      // Log onboarding mode status
      console.log(`🚀 [ChatPanel] Sending message - isConsultantMode: ${isConsultantMode}, isOnboardingMode: ${isOnboardingMode}, hasOnboardingStatuses: ${!!onboardingStatuses}`);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify(
          isConsultantMode
            ? {
              // Consultant endpoint payload
              message,
              conversationId: currentConversationId,
              pageContext: pageContext,
              focusedDocument: focusedDocument ? {
                id: focusedDocument.id,
                title: focusedDocument.title,
                category: focusedDocument.category,
              } : undefined,
              isOnboardingMode: isOnboardingMode,
              onboardingStatuses: isOnboardingMode ? onboardingStatuses : undefined,
            }
            : {
              // Client endpoint payload
              message,
              conversationId: currentConversationId,
              mode,
              consultantType: mode === "consulente" ? consultantType : undefined,
              pageContext: pageContext,
              hasPageContext: hasPageContext,
              focusedDocument: focusedDocument ? {
                id: focusedDocument.id,
                title: focusedDocument.title,
                category: focusedDocument.category,
              } : undefined,
            }
        ),
      });

      if (!response.ok) {
        throw new Error("Errore nell'inviare il messaggio");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Stream non disponibile");
      }

      let buffer = "";
      let accumulatedContent = "";
      let accumulatedCodeExecutions: CodeExecution[] = [];
      let currentCodeExecution: Partial<CodeExecution> | null = null;
      let finalConversationId = currentConversationId;
      let finalMessageId = assistantMessageId;
      let finalSuggestedActions: any[] = [];

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

              if (data.type === "start") {
                finalConversationId = data.conversationId;
                setCurrentConversationId(data.conversationId);
                setRetryInfo(prev => ({ ...prev, isRetrying: false }));
              } else if (data.type === "delta" && data.content) {
                setRetryInfo(prev => ({ ...prev, isRetrying: false }));

                if (safetyTimeoutRef.current) {
                  clearTimeout(safetyTimeoutRef.current);
                }
                safetyTimeoutRef.current = setTimeout(() => {
                  setSafetyTimeoutActive(true);
                  setIsTyping(false);
                  toast({
                    title: "Timeout connessione",
                    description: "La connessione con l'AI è scaduta. Riprova inviando un nuovo messaggio.",
                    variant: "destructive",
                  });
                }, 90000);

                accumulatedContent += data.content;

                // Se è il primo chunk, aggiungi il messaggio dell'assistente
                if (accumulatedContent === data.content) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: assistantMessageId,
                      role: "assistant",
                      content: accumulatedContent,
                      status: "processing",
                      timestamp: new Date(),
                    },
                  ]);
                  setIsTyping(false); // Nascondi il TypingIndicator
                } else {
                  // Aggiorna il messaggio dell'assistente con il contenuto accumulato
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: accumulatedContent, status: "processing" }
                        : msg
                    )
                  );
                }
              } else if (data.type === "code_execution" && data.code) {
                // Gemini is executing Python code - start a new code execution block
                console.log(`🐍 [CODE EXEC] Received Python code (${data.code.length} chars)`);
                currentCodeExecution = {
                  language: data.language || 'PYTHON',
                  code: data.code,
                };
                // Update message to show code execution in progress
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { 
                          ...msg, 
                          content: accumulatedContent,
                          codeExecutions: [...accumulatedCodeExecutions, currentCodeExecution as CodeExecution],
                          status: "processing" 
                        }
                      : msg
                  )
                );
              } else if (data.type === "code_execution_result" && currentCodeExecution) {
                // Received result of code execution - complete the block
                console.log(`📊 [CODE EXEC] Received result: ${data.outcome} (${data.output?.length || 0} chars)`);
                currentCodeExecution.outcome = data.outcome;
                currentCodeExecution.output = data.output;
                accumulatedCodeExecutions.push(currentCodeExecution as CodeExecution);
                currentCodeExecution = null;
                // Update message with completed code execution
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { 
                          ...msg, 
                          content: accumulatedContent,
                          codeExecutions: [...accumulatedCodeExecutions],
                          status: "processing" 
                        }
                      : msg
                  )
                );
              } else if (data.type === "complete") {
                finalConversationId = data.conversationId;
                finalMessageId = data.messageId;
                finalSuggestedActions = data.suggestedActions || [];

                // Handle title update if present
                if (data.title) {
                  console.log(`📝 [TITLE] Received title from complete event: "${data.title}"`);
                  console.log(`📝 [TITLE] Invalidating conversations query to refresh sidebar...`);
                  queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
                }

                if (safetyTimeoutRef.current) {
                  clearTimeout(safetyTimeoutRef.current);
                }
                setSafetyTimeoutActive(false);
                setRetryInfo({
                  isRetrying: false,
                  retryAttempt: 0,
                  retryMaxAttempts: 0,
                  retryDelaySeconds: 0,
                  countdownSeconds: 0
                });

                const responseTokens = estimateTokens(accumulatedContent);
                console.log(`✅ Risposta AI completata - Stima token:`, {
                  rispostaAI: responseTokens,
                  tokenPrecedenti: rateLimitInfo.tokensUsed,
                  nuovoTotale: rateLimitInfo.tokensUsed + estimatedTokens + responseTokens,
                  limite: MAX_TOKENS_PER_MINUTE,
                  percentualeUsata: Math.round(((rateLimitInfo.tokensUsed + estimatedTokens + responseTokens) / MAX_TOKENS_PER_MINUTE) * 100) + '%'
                });
                setRateLimitInfo(prev => ({
                  ...prev,
                  tokensUsed: prev.tokensUsed + estimatedTokens + responseTokens
                }));

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                        ...msg,
                        id: finalMessageId,
                        content: accumulatedContent,
                        status: "completed",
                        suggestedActions: finalSuggestedActions,
                        codeExecutions: accumulatedCodeExecutions.length > 0 ? accumulatedCodeExecutions : undefined,
                        timestamp: new Date(),
                      }
                      : msg
                  )
                );
                break; // Esci dal loop interno una volta completato
              } else if (data.type === "error") {
                if (safetyTimeoutRef.current) {
                  clearTimeout(safetyTimeoutRef.current);
                }
                setSafetyTimeoutActive(false);
                setRetryInfo({
                  isRetrying: false,
                  retryAttempt: 0,
                  retryMaxAttempts: 0,
                  retryDelaySeconds: 0,
                  countdownSeconds: 0
                });

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                        ...msg,
                        content: data.content || "Si è verificato un errore",
                        status: "error",
                        timestamp: new Date(),
                      }
                      : msg
                  )
                );
                throw new Error(data.content || "Errore sconosciuto");
              } else if (data.type === "retry") {
                // Gestisce evento retry con countdown
                const { attempt, maxAttempts, delayMs, message } = data;
                const retryDelaySeconds = Math.ceil(delayMs / 1000);
                console.log(`🔄 Evento retry ricevuto:`, {
                  attempt,
                  maxAttempts,
                  delayMs,
                  retryDelaySeconds,
                  message
                });
                setRetryInfo({
                  isRetrying: true,
                  retryAttempt: attempt,
                  retryMaxAttempts: maxAttempts,
                  retryDelaySeconds,
                  countdownSeconds: retryDelaySeconds
                });
              } else if (data.type === "heartbeat") {
                console.log(`💓 Heartbeat ricevuto (keep-alive)`);
                if (safetyTimeoutRef.current) {
                  clearTimeout(safetyTimeoutRef.current);
                }
                safetyTimeoutRef.current = setTimeout(() => {
                  setSafetyTimeoutActive(true);
                  setIsTyping(false);
                  toast({
                    title: "Timeout connessione",
                    description: "La connessione con l'AI è scaduta. Riprova inviando un nuovo messaggio.",
                    variant: "destructive",
                  });
                }, 90000);
              }
            } catch (e) {
              console.error("Errore nel parsing SSE:", e);
            }
          }
        }
      }

      // Questo setIsTyping(false) dovrebbe essere qui, dopo che tutto il loop è completato
      // se l'ultimo messaggio è 'complete' o 'error', altrimenti rimane 'typing' se il loop finisce inaspettatamente
      if (messages.some(msg => msg.id === assistantMessageId && msg.status === "processing")) {
        setIsTyping(false);
      }

      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (error) {
      console.error("Error sending message:", error);
      // Se c'è stato un errore, non aggiornare i token usati.
      // Assicurati che il messaggio di errore sia visualizzato correttamente.
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
              ...msg,
              content: "Mi dispiace, si è verificato un errore. Riprova più tardi.",
              status: "error",
              timestamp: new Date(),
            }
            : msg
        )
      );
      setIsTyping(false);
    }
  };

  const handleQuickAction = (action: string) => {
    handleSendMessage(action);
  };

  const handleNewConversation = () => {
    setCurrentConversationId(undefined);
    setMessages([]);
    // Resetta anche le informazioni sul rate limiting
    setRateLimitInfo({ tokensUsed: 0, resetAt: Date.now() + TOKEN_RESET_INTERVAL, isWaiting: false });
    // Resetta retry info
    setRetryInfo({
      isRetrying: false,
      retryAttempt: 0,
      retryMaxAttempts: 0,
      retryDelaySeconds: 0,
      countdownSeconds: 0
    });
    // Resetta safety timeout
    setSafetyTimeoutActive(false);
  };

  /*
    RIMOSSO IL VECCHIO SISTEMA DI MESSAGGI AUTOMATICI
    PERCHÉ: Causava lampeggiamento - aggiungeva messaggi via useEffect dopo che il componente mostrava già il template
    RISOLVE: Ora il messaggio contestuale è direttamente nel template JSX (righe 344-487), quindi appare immediatamente senza flickering
  */

  // Reset messages when page context changes (user navigates to different page)
  useEffect(() => {
    setMessages([]);
    setCurrentConversationId(undefined);
    // Resetta anche le informazioni sul rate limiting quando il contesto della pagina cambia
    setRateLimitInfo({ tokensUsed: 0, resetAt: Date.now() + TOKEN_RESET_INTERVAL, isWaiting: false });
    // Resetta retry info quando cambia contesto
    setRetryInfo({
      isRetrying: false,
      retryAttempt: 0,
      retryMaxAttempts: 0,
      retryDelaySeconds: 0,
      countdownSeconds: 0
    });
    // Resetta safety timeout quando cambia contesto
    setSafetyTimeoutActive(false);
  }, [pageContext?.pageType, pageContext?.resourceId]);

  // Effetto per resettare il contatore dei token dopo un minuto
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = Date.now();
      if (currentTime >= rateLimitInfo.resetAt) {
        console.log(`🔄 Reset limite token:`, {
          tokenPrecedenti: rateLimitInfo.tokensUsed,
          nuoviToken: 0,
          prossimoReset: new Date(currentTime + TOKEN_RESET_INTERVAL).toLocaleTimeString()
        });
        setRateLimitInfo(prev => ({
          ...prev,
          tokensUsed: 0,
          resetAt: currentTime + TOKEN_RESET_INTERVAL,
          isWaiting: false // Assicurati che isWaiting sia false quando il tempo scade
        }));
      }
    }, 5000); // Controlla ogni 5 secondi

    return () => clearInterval(interval); // Pulisce l'intervallo quando il componente viene smontato
  }, [rateLimitInfo.resetAt]); // Dipendenza da resetAt per assicurare che l'intervallo sia corretto

  // Effetto per gestire il countdown del retry
  useEffect(() => {
    if (!retryInfo.isRetrying || retryInfo.countdownSeconds <= 0) return;

    const intervalId = setInterval(() => {
      setRetryInfo(prev => ({
        ...prev,
        countdownSeconds: Math.max(0, prev.countdownSeconds - 1)
      }));
    }, 1000); // Decrementa ogni secondo

    return () => clearInterval(intervalId);
  }, [retryInfo.isRetrying, retryInfo.countdownSeconds]);

  useEffect(() => {
    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, []);

  // Handle automatic message sending when opened from document focus
  useEffect(() => {
    if (isOpen && autoMessage && !autoMessageProcessedRef.current && !isTyping) {
      autoMessageProcessedRef.current = true;
      const sendAutoMessage = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        handleSendMessage(autoMessage);
        if (onAutoMessageSent) {
          onAutoMessageSent();
        }
      };
      sendAutoMessage();
    }
    if (!isOpen) {
      autoMessageProcessedRef.current = false;
    }
  }, [isOpen, autoMessage, isTyping]);

  if (embedded) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        {/* Header with Tabs */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-3 py-2">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "chat" | "history")} className="flex-1">
              <TabsList className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-full grid grid-cols-2">
                <TabsTrigger
                  value="chat"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400 data-[state=active]:shadow-sm px-2 py-1.5 text-xs font-medium rounded-md transition-all"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Chat
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400 data-[state=active]:shadow-sm px-2 py-1.5 text-xs font-medium rounded-md transition-all"
                >
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  Cronologia
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewConversation}
                className="h-8 w-8 text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                title="Nuova conversazione"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-gray-50 dark:bg-gray-950">
          {activeTab === "chat" ? (
            <>
              {messages.length === 0 ? (
                <ScrollArea ref={scrollAreaRef} className="flex-1">
                  <div className="p-4">
                    <div className="mb-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
                          <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Ciao, sono il tuo assistente
                          </h2>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Come posso aiutarti oggi?
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Azioni rapide
                      </p>
                      {isConsultantMode && pageContext ? (
                        <ConsultantQuickActions
                          pageContext={pageContext}
                          onActionClick={handleQuickAction}
                        />
                      ) : (
                        <QuickActions
                          mode={mode}
                          onActionClick={handleQuickAction}
                          userName={userName}
                          consultantType={consultantType}
                        />
                      )}
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 overflow-hidden min-h-0">
                  <MessageList messages={messages} isTyping={isTyping} />
                </div>
              )}
              <div className="flex-shrink-0 p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                <InputArea
                  onSend={handleSendMessage}
                  isProcessing={isTyping}
                  disabled={rateLimitInfo.isWaiting}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              {isLoadingConversations ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      <History className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>Nessuna conversazione recente</p>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => loadConversationMessages(conv.id)}
                        className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-violet-300 dark:hover:border-violet-700 cursor-pointer transition-all hover:shadow-sm group"
                      >
                        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 truncate">
                          {conv.title || "Nuova conversazione"}
                        </h3>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>{new Date(conv.lastMessageAt || conv.createdAt).toLocaleDateString()}</span>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 400 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 400 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-y-0 right-0 w-full sm:w-[380px] max-w-full z-50 flex flex-col bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800"
        >
          {/* Header with Tabs - Hostinger Style */}
          <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between px-4 py-3">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "chat" | "history")} className="flex-1">
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
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNewConversation}
                  className="h-8 w-8 text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                  title="Nuova conversazione"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                  title="Impostazioni"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-950">
            {activeTab === "chat" ? (
              <>
                {messages.length === 0 ? (
                  <ScrollArea ref={scrollAreaRef} className="flex-1">
                    <div className="p-6">
                      {/* Personalized Greeting - Hostinger Style */}
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
                            <Sparkles className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                              Ciao {userName} 👋
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Come posso aiutarti oggi?
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Context Banner (if page context exists) */}
                      {(pageContext?.pageType === "library_document" || pageContext?.pageType === "university_lesson") && (
                        <div className="mb-6 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-100 dark:border-violet-800">
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                            <span className="text-xs font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                              {pageContext.pageType === "library_document" ? "Libreria" : "Università"}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {pageContext.resourceTitle || "Questa lezione"}
                          </p>
                          {pageContext.additionalContext?.categoryName && (
                            <p className="text-xs text-violet-600 dark:text-violet-300 mt-1">
                              {pageContext.additionalContext.categoryName}
                            </p>
                          )}
                        </div>
                      )}

                      {pageContext?.pageType === "exercise" && (
                        <div className="mb-6 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-100 dark:border-violet-800">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                            <span className="text-xs font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                              Esercizio
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {pageContext.resourceTitle || "Questo esercizio"}
                          </p>
                        </div>
                      )}

                      {/* Focused Document Banner */}
                      {focusedDocument && (
                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                                Documento in focus
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearFocus}
                              className="h-6 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Rimuovi
                            </Button>
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {focusedDocument.title}
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                            L'AI risponderà focalizzandosi su questo documento
                          </p>
                        </div>
                      )}

                      {/* Mode Selector for Client Mode (compact) */}
                      {!isConsultantMode && (
                        <div className="mb-6 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                          <ModeSelector mode={mode} setMode={setMode} />
                          {mode === "consulente" && (
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                              <ConsultantTypePicker
                                consultantType={consultantType}
                                setConsultantType={setConsultantType}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quick Actions - Hostinger Style */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                          Azioni rapide
                        </p>
                        {isConsultantMode && pageContext ? (
                          <ConsultantQuickActions
                            pageContext={pageContext as ConsultantPageContext}
                            onAction={handleQuickAction}
                            disabled={isTyping || rateLimitInfo.isWaiting}
                          />
                        ) : (
                          <QuickActions
                            mode={mode}
                            consultantType={consultantType}
                            onAction={handleQuickAction}
                            disabled={isTyping || rateLimitInfo.isWaiting}
                            pageContext={pageContext as PageContext}
                          />
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <ScrollArea ref={scrollAreaRef} className="flex-1">
                    <div className="p-4">
                      <MessageList
                        messages={messages}
                        isTyping={isTyping}
                        onActionClick={onClose}
                      />
                    </div>
                  </ScrollArea>
                )}
              </>
            ) : (
              /* History Tab Content */
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {isLoadingConversations ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                        <History className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Nessuna conversazione
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                        Le tue conversazioni precedenti appariranno qui.
                      </p>
                      <Button
                        onClick={() => setActiveTab("chat")}
                        className="mt-4 bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        Inizia una nuova chat
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => loadConversationMessages(conv.id)}
                          className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 flex items-center justify-center">
                              <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate group-hover:text-violet-700 dark:group-hover:text-violet-300">
                                {conv.title || "Conversazione"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {conv.lastMessageAt
                                  ? new Date(conv.lastMessageAt).toLocaleDateString('it-IT', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                  : new Date(conv.createdAt).toLocaleDateString('it-IT', {
                                    day: 'numeric',
                                    month: 'short'
                                  })
                                }
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Input Area - Sticky at Bottom */}
          {activeTab === "chat" && (
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              {rateLimitInfo.isWaiting && (
                <Alert className="mb-3 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                  <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <AlertDescription className="text-xs text-orange-800 dark:text-orange-200">
                    Stiamo attendendo il reset del limite di token. Riprova tra poco.
                  </AlertDescription>
                </Alert>
              )}
              {retryInfo.isRetrying && (
                <Alert className="mb-3 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800">
                  <AlertCircle className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <AlertDescription className="text-xs text-violet-800 dark:text-violet-200">
                    {retryInfo.countdownSeconds > 0
                      ? `⏳ Riprovo tra ${retryInfo.countdownSeconds}s... (tentativo ${retryInfo.retryAttempt}/${retryInfo.retryMaxAttempts - 1})`
                      : "⏳ Riconnessione..."}
                  </AlertDescription>
                </Alert>
              )}
              <InputArea onSend={handleSendMessage} isProcessing={isTyping} disabled={rateLimitInfo.isWaiting} />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
                L'AI potrebbe generare informazioni inaccurate
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}