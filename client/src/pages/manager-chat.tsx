import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  MessageSquare, 
  Menu, 
  X, 
  Send, 
  LogOut, 
  Loader2,
  Bot
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
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

function getManagerToken(): string | null {
  return localStorage.getItem("manager_token");
}

function getManagerAuthHeaders(): Record<string, string> {
  const token = getManagerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    const convDate = new Date(conv.updatedAt || conv.createdAt);
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
            className="w-2 h-2 bg-teal-500 rounded-full"
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

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!isAuthenticated) {
        const response = await fetch(`/api/public/agent/${slug}/anonymous/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            content: message,
            conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
          }),
        });

        if (!response.ok) throw new Error("Failed to send message");
        const data = await response.json();
        return { conversationId: null, messageId: `anon-${Date.now()}`, content: data.content };
      }

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
          body: JSON.stringify({ content: message }),
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

  const handleSendMessage = () => {
    const trimmed = inputValue.trim();
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {isMobile && isAuthenticated && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-slate-800"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">{agentInfo?.agentName || "Assistente"}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {managerInfo && (
            <span className="text-sm text-slate-300 hidden sm:block">
              Benvenuto, {managerInfo.name}
            </span>
          )}
          {!agentInfo?.requiresLogin && (
            <span className="text-sm text-slate-400 hidden sm:block">
              Modalità ospite
            </span>
          )}
          {agentInfo?.requiresLogin && (
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-800"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Esci</span>
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence>
          {isAuthenticated && (sidebarOpen || !isMobile) && (
            <motion.aside
              initial={isMobile ? { x: -280 } : false}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn(
                "w-[280px] bg-slate-900 flex flex-col shrink-0",
                isMobile && "absolute inset-y-0 left-0 z-40 top-[56px]"
              )}
            >
              <div className="p-3">
                <Button
                  onClick={handleNewConversation}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuova Chat
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-4">
                  {conversationsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      Nessuna conversazione
                    </div>
                  ) : (
                    groupOrder.map((group) => {
                      const groupConvs = groupedConversations[group];
                      if (!groupConvs || groupConvs.length === 0) return null;
                      return (
                        <div key={group}>
                          <div className="text-xs font-medium text-slate-500 px-2 mb-2">
                            {group}
                          </div>
                          <div className="space-y-1">
                            {groupConvs.map((conv) => (
                              <button
                                key={conv.id}
                                onClick={() => handleSelectConversation(conv.id)}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-lg transition-colors",
                                  "hover:bg-slate-800",
                                  selectedConversationId === conv.id
                                    ? "bg-slate-800 border-l-2 border-teal-500"
                                    : "border-l-2 border-transparent"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-slate-500 shrink-0" />
                                  <span className="text-sm text-white truncate">
                                    {conv.title || "Nuova conversazione"}
                                  </span>
                                </div>
                                {conv.messageCount !== undefined && (
                                  <div className="text-xs text-slate-500 mt-1 ml-6">
                                    {conv.messageCount} messaggi
                                  </div>
                                )}
                              </button>
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
            className="fixed inset-0 bg-black/50 z-30 top-[56px]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center mb-4">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">
                  Ciao! Come posso aiutarti?
                </h2>
                <p className="text-slate-500 max-w-md">
                  Scrivi un messaggio per iniziare una conversazione con l'assistente.
                </p>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3",
                        msg.role === "user"
                          ? "bg-slate-700 text-white"
                          : "bg-gradient-to-br from-cyan-500/10 to-teal-500/10 text-slate-800"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-slate max-w-none">
                          <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && messages[messages.length - 1]?.content === "" && (
                  <div className="flex justify-start">
                    <div className="bg-gradient-to-br from-cyan-500/10 to-teal-500/10 rounded-2xl">
                      <TypingIndicator />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2">
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
                  className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={isTyping}
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full h-9 w-9"
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
        </main>
      </div>
    </div>
  );
}
