import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Plus, BookOpen, FileText, GraduationCap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModeSelector } from "./ModeSelector";
import { ConsultantTypePicker } from "./ConsultantTypePicker";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { QuickActions } from "./QuickActions";
import { ConsultantQuickActions } from "./ConsultantQuickActions";
import { AIMode, ConsultantType } from "./AIAssistant";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { PageContext } from "@/hooks/use-page-context";
import { ConsultantPageContext } from "@/hooks/use-consultant-page-context";

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
  isConsultantMode = false
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
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

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
              }
            : {
                // Client endpoint payload
                message,
                conversationId: currentConversationId,
                mode,
                consultantType: mode === "consulente" ? consultantType : undefined,
                pageContext: pageContext,
                hasPageContext: hasPageContext,
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
              } else if (data.type === "complete") {
                finalConversationId = data.conversationId;
                finalMessageId = data.messageId;
                finalSuggestedActions = data.suggestedActions || [];

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 400, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 400, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 md:bottom-6 md:right-24 z-40 w-[calc(100vw-16px)] sm:w-[400px] md:w-[450px] h-[calc(100vh-80px)] sm:h-[600px] md:h-[720px] max-h-[calc(100vh-80px)]"
        >
          <Card className="w-full h-full flex flex-col shadow-2xl border-2 border-blue-100 dark:border-blue-900/30 bg-white dark:bg-gray-800 rounded-3xl overflow-hidden backdrop-blur-sm">
            {/* Header moderno con gradiente */}
            <CardHeader className="bg-gradient-to-r from-blue-50 via-cyan-50 to-blue-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 border-b-2 border-blue-100 dark:border-blue-900/30 p-3 sm:p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">AI Assistant</h2>
                    <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 truncate">Il tuo assistente personale</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNewConversation}
                    className="text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-700 h-11 w-11 rounded-xl transition-all hover:scale-105"
                    title="Nuova conversazione"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-700 h-11 w-11 rounded-xl transition-all hover:scale-105"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {!isConsultantMode && (
                <div className="space-y-2.5">
                  <ModeSelector mode={mode} setMode={setMode} />
                  {mode === "consulente" && (
                    <ConsultantTypePicker
                      consultantType={consultantType}
                      setConsultantType={setConsultantType}
                    />
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-gradient-to-b from-gray-50/30 to-white dark:from-gray-900 dark:to-gray-900">
              {messages.length === 0 ? (
                <ScrollArea ref={scrollAreaRef} className="flex-1">
                  <div className="flex flex-col items-center justify-center p-3 sm:p-4 md:p-6 text-center min-h-full">
                    {/*
                      MESSAGGIO CONTESTUALE DINAMICO
                      PERCHÉ: Invece di mostrare sempre "Come posso aiutarti oggi?",
                              mostriamo 3 varianti basate su dove si trova l'utente
                      RISOLVE: L'utente vede immediatamente che l'AI ha riconosciuto il contesto
                    */}

                    {/* CASO 1: LEZIONE (Libreria O Università) */}
                    {(pageContext?.pageType === "library_document" || pageContext?.pageType === "university_lesson") ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>
                        <Badge variant="outline" className="mb-3 text-xs bg-blue-50 dark:bg-blue-900/30 border-blue-200">
                          {pageContext.pageType === "library_document" ? "📚 Libreria" : "🎓 Università"}
                        </Badge>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2">
                          Stai studiando:
                        </h3>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 sm:p-3 mb-3 w-full max-w-xs border border-blue-100 dark:border-blue-800">
                          <p className="font-semibold text-blue-900 dark:text-blue-100 text-xs sm:text-sm mb-1 line-clamp-2">
                            "{pageContext.resourceTitle || "Questa lezione"}"
                          </p>
                          {pageContext.additionalContext?.categoryName && (
                            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-center gap-1">
                              📂 {pageContext.additionalContext.categoryName}
                              {pageContext.additionalContext.level && ` • ${pageContext.additionalContext.level}`}
                            </p>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 font-medium">
                          Come posso aiutarti?
                        </p>
                        <div className="text-[11px] sm:text-xs text-left mb-4 space-y-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 sm:p-3 w-full max-w-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Spiegare i concetti chiave</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Fare un riassunto</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Rispondere a domande specifiche</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Suggerirti esercizi correlati</span>
                          </div>
                        </div>
                      </>
                    ) : pageContext?.pageType === "exercise" ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/40 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                          </div>
                        </div>
                        <Badge variant="outline" className="mb-3 text-xs bg-purple-50 dark:bg-purple-900/30 border-purple-200">
                          📝 Esercizio
                        </Badge>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                          Stai lavorando su:
                        </h3>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 mb-3 max-w-xs border border-purple-100 dark:border-purple-800">
                          <p className="font-semibold text-purple-900 dark:text-purple-100 text-sm mb-1">
                            "{pageContext.resourceTitle || "Questo esercizio"}"
                          </p>
                          {pageContext.additionalContext?.status && (
                            <Badge className="mt-2 text-xs" variant={
                              pageContext.additionalContext.status === 'completed' ? 'default' : 'secondary'
                            }>
                              {pageContext.additionalContext.status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 font-medium">
                          Ti posso assistere con:
                        </p>
                        <div className="text-xs text-left mb-4 space-y-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 max-w-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Guidarti passo-passo</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Chiarire le domande</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Rivedere le tue risposte</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Suggerire risorse utili</span>
                          </div>
                        </div>
                      </>
                    ) : pageContext?.pageType === "exercises_list" ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/40 dark:to-indigo-800/40 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                          </div>
                        </div>
                        <Badge variant="outline" className="mb-3 text-xs bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200">
                          📋 Lista Esercizi
                        </Badge>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                          Panoramica Esercizi
                        </h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-medium">
                          Come posso aiutarti?
                        </p>
                        <div className="text-xs text-left mb-4 space-y-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 max-w-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Consigli su quale esercizio iniziare</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Strategie di studio</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Gestione delle scadenze</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Analisi dei tuoi progressi</span>
                          </div>
                        </div>
                      </>
                    ) : pageContext?.pageType === "course" ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-100 to-cyan-200 dark:from-cyan-900/40 dark:to-cyan-800/40 flex items-center justify-center">
                            <GraduationCap className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                          </div>
                        </div>
                        <Badge variant="outline" className="mb-3 text-xs bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200">
                          🎓 Università
                        </Badge>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                          Panoramica Università
                        </h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-medium">
                          Come posso aiutarti?
                        </p>
                        <div className="text-xs text-left mb-4 space-y-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 max-w-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Pianificare il percorso di studio</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Spiegare la struttura del corso</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Preparazione agli esami</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                            <span className="text-gray-700 dark:text-gray-300">Monitorare progressi e certificati</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center mb-3">
                          <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                          Come posso aiutarti oggi?
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 max-w-xs px-2">
                          {mode === "assistenza"
                            ? "Supporto per navigare nella piattaforma e rispondere alle tue domande."
                            : `Consulente ${
                                consultantType === "finanziario"
                                  ? "finanziario"
                                  : consultantType === "business"
                                  ? "di business"
                                  : "di vendita"
                              } personalizzato.`}
                        </p>

                        {/* Leggenda migliorata */}
                        <div className="mb-3 max-w-xs w-full bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/20 rounded-xl p-4 text-left border border-blue-100 dark:border-blue-800">
                          <div className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-2.5 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            Cosa posso fare:
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-medium text-blue-800 dark:text-blue-200">
                            <div className="flex items-center gap-1.5">📚 Lezioni</div>
                            <div className="flex items-center gap-1.5">✅ Esercizi</div>
                            <div className="flex items-center gap-1.5">🎯 Progressi</div>
                            <div className="flex items-center gap-1.5">📅 Task</div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                            <div className="text-[11px] text-blue-700 dark:text-blue-300 font-medium italic leading-relaxed">
                              💡 "Cosa devo fare oggi?"<br/>
                              💡 "Spiegami [argomento]"
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="w-full max-w-xs">
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
                  <div className="p-3 sm:p-4 md:p-5">
                    <MessageList
                      messages={messages}
                      isTyping={isTyping}
                      onActionClick={onClose}
                    />
                  </div>
                </ScrollArea>
              )}

              <div className="border-t-2 border-blue-100 dark:border-blue-900/30 p-3 sm:p-4 bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50 flex-shrink-0">
                {rateLimitInfo.isWaiting && (
                  <Alert className="mb-3 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <AlertDescription className="text-xs text-orange-800 dark:text-orange-200">
                      Stiamo attendendo il reset del limite di token. Riprova tra poco.
                    </AlertDescription>
                  </Alert>
                )}
                {retryInfo.isRetrying && (
                  <Alert className="mb-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                      {retryInfo.countdownSeconds > 0 
                        ? `⏳ Riprovo tra ${retryInfo.countdownSeconds}s... (tentativo ${retryInfo.retryAttempt}/${retryInfo.retryMaxAttempts - 1})`
                        : "⏳ Riconnessione..."}
                    </AlertDescription>
                  </Alert>
                )}
                <InputArea onSend={handleSendMessage} disabled={isTyping || rateLimitInfo.isWaiting} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}