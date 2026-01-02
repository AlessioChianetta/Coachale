import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  Clock, 
  ArrowRight,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface AgentInfo {
  agentName: string;
  consultantName: string;
  consultantSlug: string | null;
  dailyMessageLimit: number;
  businessName: string | null;
  businessDescription: string | null;
}

function getStorageKey(slug: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `public_ai_chat_${slug}_${today}`;
}

function getStoredMessages(slug: string): Message[] {
  try {
    const key = getStorageKey(slug);
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.messages || [];
    }
  } catch (e) {}
  return [];
}

function getStoredMessageCount(slug: string): number {
  try {
    const key = getStorageKey(slug);
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.messageCount || 0;
    }
  } catch (e) {}
  return 0;
}

function saveToStorage(slug: string, messages: Message[], messageCount: number) {
  try {
    const key = getStorageKey(slug);
    localStorage.setItem(key, JSON.stringify({ messages, messageCount }));
  } catch (e) {}
}

export default function PublicAIChat() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: agentInfo, isLoading: infoLoading, error: infoError } = useQuery<AgentInfo>({
    queryKey: ["/api/public/ai", slug, "info"],
    queryFn: async () => {
      const response = await fetch(`/api/public/ai/${slug}/info`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Agente non trovato");
        }
        throw new Error("Errore nel caricamento");
      }
      return response.json();
    },
    enabled: !!slug,
    retry: false,
  });

  useEffect(() => {
    if (slug) {
      const storedMessages = getStoredMessages(slug);
      const storedCount = getStoredMessageCount(slug);
      setMessages(storedMessages);
      setMessageCount(storedCount);
      
      if (agentInfo && storedCount >= agentInfo.dailyMessageLimit) {
        setLimitReached(true);
      }
    }
  }, [slug, agentInfo]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() || isLoading || limitReached) {
      return;
    }

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: messageInput.trim(),
      createdAt: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setMessageInput("");
    setIsLoading(true);

    try {
      const conversationHistory = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(`/api/public/ai/${slug}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: conversationHistory.slice(0, -1),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 429) {
          setLimitReached(true);
          toast({
            title: "Limite raggiunto",
            description: errorData.error,
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorData.error || "Errore nell'invio del messaggio");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: data.response,
        createdAt: new Date(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      const newCount = messageCount + 1;
      
      setMessages(finalMessages);
      setMessageCount(newCount);
      saveToStorage(slug!, finalMessages, newCount);

      if (agentInfo && data.remainingMessages <= 0) {
        setLimitReached(true);
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  if (infoLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Caricamento in corso...</p>
        </div>
      </div>
    );
  }

  if (infoError || !agentInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <h2 className="font-semibold">Errore</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {infoError instanceof Error ? infoError.message : "Agente non trovato"}
            </p>
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">
              Torna alla home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const remainingMessages = agentInfo.dailyMessageLimit - messageCount;

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="border-b bg-white/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 bg-primary/10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold text-lg">{agentInfo.agentName}</h1>
            {agentInfo.businessName && (
              <p className="text-sm text-muted-foreground">{agentInfo.businessName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Show "Cambia Agente" button for authenticated Bronze/Silver users */}
          {localStorage.getItem('bronzeUserTier') && agentInfo.consultantSlug && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/c/${agentInfo.consultantSlug}/select-agent`)}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Cambia Agente</span>
            </Button>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className={cn(
              remainingMessages <= 3 && "text-orange-600 font-medium",
              remainingMessages <= 0 && "text-destructive font-medium"
            )}>
              {remainingMessages}/{agentInfo.dailyMessageLimit} messaggi oggi
            </span>
          </div>
        </div>
      </header>

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                Ciao! Sono {agentInfo.agentName}
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {agentInfo.businessDescription || 
                  "Come posso aiutarti oggi? Scrivi un messaggio per iniziare la conversazione."}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {limitReached && (
        <Alert className="mx-4 mb-2 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-orange-800">
              Hai raggiunto il limite giornaliero di messaggi gratuiti.
            </span>
            {/* SECURITY FIX 2.3: Only show upgrade button if consultantSlug is valid and not empty */}
            {agentInfo.consultantSlug && agentInfo.consultantSlug.trim() !== '' && agentInfo.consultantSlug !== 'null' ? (
              <Button
                variant="link"
                className="text-orange-700 p-0 h-auto font-medium"
                onClick={() => navigate(`/c/${agentInfo.consultantSlug}/pricing`)}
              >
                Passa al piano Premium <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <span className="text-orange-700 text-sm font-medium">
                Torna domani per altri messaggi gratuiti
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <footer className="border-t bg-white/80 backdrop-blur-sm p-4 shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={limitReached ? "Limite raggiunto" : "Scrivi un messaggio..."}
              disabled={isLoading || limitReached}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!messageInput.trim() || isLoading || limitReached}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>

        <div className="text-center mt-3 text-xs text-muted-foreground">
          Powered by{" "}
          <span className="font-medium">{agentInfo.consultantName}</span>
        </div>
      </footer>
    </div>
  );
}
