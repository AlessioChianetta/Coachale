import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAuthHeaders } from "@/lib/auth";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageCircle, ArrowLeft, Globe, Users, Eye, MessageSquare, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import it from "date-fns/locale/it";

interface ShareAgent {
  id: string;
  slug: string;
  agentName: string;
  isActive: boolean;
  isCustomSlug: boolean;
  totalAccessCount: number;
  totalMessagesCount: number;
  uniqueVisitorsCount: number;
  createdAt: string;
  agent: {
    id: string;
    agentName?: string;
    agentType?: string;
  };
}

interface ShareConversation {
  id: string;
  title: string | null;
  externalVisitorId: string | null;
  visitorMetadata: {
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
    firstAccessAt?: string;
  } | null;
  messageCount: number;
  realMessageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  messageType: string;
  audioUrl?: string;
  createdAt: string;
}

export default function ConsultantWhatsAppAgentsChat() {
  const isMobile = useIsMobile();
  const [selectedShare, setSelectedShare] = useState<ShareAgent | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ShareConversation | null>(null);
  const [mobileView, setMobileView] = useState<"agents" | "conversations" | "chat">("agents");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sharesData, isLoading: sharesLoading } = useQuery({
    queryKey: ["/api/whatsapp/agent-share"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/agent-share", {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch shares");
      return res.json();
    },
  });

  const activeShares: ShareAgent[] = useMemo(() => {
    if (!sharesData?.shares) return [];
    return sharesData.shares.filter((s: any) => !s.revokedAt);
  }, [sharesData]);

  const globalStats = useMemo(() => {
    return activeShares.reduce(
      (acc, s) => ({
        totalVisits: acc.totalVisits + (s.totalAccessCount || 0),
        totalMessages: acc.totalMessages + (s.totalMessagesCount || 0),
        totalLinks: acc.totalLinks + 1,
      }),
      { totalVisits: 0, totalMessages: 0, totalLinks: 0 }
    );
  }, [activeShares]);

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ["/api/whatsapp/agent-share", selectedShare?.id, "conversations"],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/agent-share/${selectedShare!.id}/conversations`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    enabled: !!selectedShare,
  });

  const conversations: ShareConversation[] = conversationsData?.conversations || [];

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/whatsapp/agent-share/conversations", selectedConversation?.id, "messages"],
    queryFn: async () => {
      const res = await fetch(
        `/api/whatsapp/agent-share/conversations/${selectedConversation!.id}/messages`,
        {
          headers: getAuthHeaders(),
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedConversation,
  });

  const messages: ChatMessage[] = messagesData?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectShare = (share: ShareAgent) => {
    setSelectedShare(share);
    setSelectedConversation(null);
    if (isMobile) setMobileView("conversations");
  };

  const handleSelectConversation = (conv: ShareConversation) => {
    setSelectedConversation(conv);
    if (isMobile) setMobileView("chat");
  };

  const handleBack = () => {
    if (mobileView === "chat") {
      setMobileView("conversations");
      setSelectedConversation(null);
    } else if (mobileView === "conversations") {
      setMobileView("agents");
      setSelectedShare(null);
    }
  };

  const isRecent = (dateStr: string | null) => {
    if (!dateStr) return false;
    return Date.now() - new Date(dateStr).getTime() < 60 * 60 * 1000;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: it });
    } catch {
      return "";
    }
  };

  const AgentsPanel = () => (
    <div className="flex flex-col h-full border-r bg-white">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Link Pubblici</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {globalStats.totalLinks} link &middot; {globalStats.totalVisits} visite &middot; {globalStats.totalMessages} messaggi
        </p>
      </div>
      <ScrollArea className="flex-1">
        {sharesLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : activeShares.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nessun link pubblico attivo
          </div>
        ) : (
          <div className="divide-y">
            {activeShares.map((share) => (
              <div
                key={share.id}
                onClick={() => handleSelectShare(share)}
                className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedShare?.id === share.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${share.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="font-medium text-sm truncate">{share.agent?.agentName || share.agentName}</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">{share.slug}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {share.totalAccessCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> {share.totalMessagesCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const ConversationsPanel = () => (
    <div className="flex flex-col h-full border-r bg-white">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          {isMobile && (
            <button onClick={handleBack} className="p-1 hover:bg-gray-100 rounded">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm truncate">
              {selectedShare?.agent?.agentName || selectedShare?.agentName || ""}
            </h2>
            <p className="text-xs text-muted-foreground">
              {conversations.length} conversazioni
            </p>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1">
        {conversationsLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nessuna conversazione per questo link
          </div>
        ) : (
          <div className="divide-y">
            {conversations.map((conv, idx) => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedConversation?.id === conv.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate">
                    {conv.title || `Visitatore #${conversations.length - idx}`}
                  </span>
                  {isRecent(conv.lastMessageAt) && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-500">
                      Attivo
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> {conv.realMessageCount || conv.messageCount}
                  </span>
                  {conv.lastMessageAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDate(conv.lastMessageAt)}
                    </span>
                  )}
                </div>
                {conv.visitorMetadata?.ipAddress && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    IP: {conv.visitorMetadata.ipAddress}
                    {conv.visitorMetadata.referrer && (() => {
                      try { return ` | ${new URL(conv.visitorMetadata!.referrer!).hostname}`; } catch { return ''; }
                    })()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const ChatPanel = () => (
    <div className="flex flex-col h-full bg-gray-50">
      {selectedConversation ? (
        <>
          <div className="p-4 border-b bg-white">
            <div className="flex items-center gap-2">
              {isMobile && (
                <button onClick={handleBack} className="p-1 hover:bg-gray-100 rounded">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm">
                  {selectedConversation.title || "Conversazione"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.realMessageCount || selectedConversation.messageCount} messaggi
                  {selectedConversation.lastMessageAt && ` · ${formatDate(selectedConversation.lastMessageAt)}`}
                </p>
              </div>
              {selectedConversation.externalVisitorId && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {selectedConversation.externalVisitorId.slice(0, 8)}
                </Badge>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1 p-4">
            {messagesLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground p-8">
                Nessun messaggio
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl mx-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        msg.role === "user"
                          ? "bg-blue-500 text-white rounded-br-md"
                          : "bg-white text-gray-900 border shadow-sm rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      {msg.audioUrl && (
                        <audio controls src={msg.audioUrl} className="mt-2 w-full max-w-[240px]" />
                      )}
                      <p
                        className={`text-[10px] mt-1 ${
                          msg.role === "user" ? "text-blue-100" : "text-gray-400"
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleString("it-IT", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Seleziona una conversazione</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      <Sidebar role="consultant" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-hidden">
          {isMobile ? (
            <div className="h-full">
              {mobileView === "agents" && <AgentsPanel />}
              {mobileView === "conversations" && <ConversationsPanel />}
              {mobileView === "chat" && <ChatPanel />}
            </div>
          ) : (
            <div className="h-full grid grid-cols-[240px_300px_1fr]">
              <AgentsPanel />
              {selectedShare ? <ConversationsPanel /> : (
                <div className="border-r flex items-center justify-center text-muted-foreground text-sm">
                  Seleziona un agente
                </div>
              )}
              <ChatPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
