import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import {
  Loader2, MessageCircle, Users, ArrowLeft, Send, User, Bot,
} from "lucide-react";

interface TelegramChatsProps {
  roleId: string;
  roleName: string;
  open: boolean;
  onClose: () => void;
}

interface Conversation {
  telegram_chat_id: string;
  chat_type: string;
  chat_title: string | null;
  sender_name: string | null;
  sender_username: string | null;
  last_message: string;
  last_message_at: string;
  message_count: number;
}

interface TelegramMessage {
  id: number;
  sender_type: "user" | "agent";
  sender_name: string | null;
  sender_username: string | null;
  message: string;
  created_at: string;
}

function SafeMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeSanitize]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h3>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/30 pl-3 my-2 italic text-muted-foreground">{children}</blockquote>,
        code: ({ children }) => (
          <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
        ),
        hr: () => <hr className="my-3 border-border/50" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ora";
  if (diffMin < 60) return `${diffMin}m fa`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h fa`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}g fa`;
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export default function TelegramChats({ roleId, roleName, open, onClose }: TelegramChatsProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      loadConversations();
      setSelectedChat(null);
      setMessages([]);
    }
  }, [open, roleId]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.telegram_chat_id);
    }
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-conversations/${roleId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {}
    setLoading(false);
  };

  const loadMessages = async (chatId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-conversations/${roleId}/${chatId}/messages?limit=100`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {}
    setMessagesLoading(false);
  };

  const getConversationLabel = (conv: Conversation) => {
    if (conv.chat_title) return conv.chat_title;
    if (conv.sender_name) return conv.sender_name;
    if (conv.sender_username) return `@${conv.sender_username}`;
    return `Chat ${conv.telegram_chat_id}`;
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-[700px] sm:w-[800px] p-0 max-w-[90vw]">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="font-semibold text-sm">Chat Telegram - {roleName}</h3>
                <p className="text-xs text-muted-foreground">Conversazioni in modalità aperta</p>
              </div>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className={cn(
              "border-r flex flex-col",
              selectedChat ? "w-[280px] hidden sm:flex" : "flex-1"
            )}>
              <div className="p-2 border-b">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-2">
                  {conversations.length} conversazion{conversations.length === 1 ? "e" : "i"}
                </p>
              </div>
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <MessageCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Nessuna conversazione telegram</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {conversations.map((conv) => (
                      <button
                        key={conv.telegram_chat_id}
                        onClick={() => setSelectedChat(conv)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/30",
                          selectedChat?.telegram_chat_id === conv.telegram_chat_id && "bg-blue-50 dark:bg-blue-950/20 border-l-2 border-l-blue-500"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {conv.chat_type === "private" ? (
                            <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          ) : (
                            <Users className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          )}
                          <span className="text-xs font-medium truncate flex-1">
                            {getConversationLabel(conv)}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {getRelativeTime(conv.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-muted-foreground truncate flex-1">
                            {conv.last_message.substring(0, 60)}{conv.last_message.length > 60 ? "..." : ""}
                          </p>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                            {conv.message_count}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className={cn(
              "flex flex-col flex-1",
              !selectedChat && "hidden sm:flex"
            )}>
              {selectedChat ? (
                <>
                  <div className="p-3 border-b flex items-center gap-2 bg-muted/20">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 sm:hidden"
                      onClick={() => setSelectedChat(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    {selectedChat.chat_type === "private" ? (
                      <User className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Users className="h-4 w-4 text-indigo-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{getConversationLabel(selectedChat)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedChat.chat_type === "private" ? "Chat privata" : "Gruppo"} • {selectedChat.message_count} messaggi
                      </p>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 p-3">
                    {messagesLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs text-muted-foreground">Nessun messaggio</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex gap-2",
                              msg.sender_type === "user" ? "justify-end" : "justify-start"
                            )}
                          >
                            {msg.sender_type === "agent" && (
                              <div className="shrink-0 mt-1">
                                <Bot className="h-6 w-6 text-blue-500" />
                              </div>
                            )}
                            <div
                              className={cn(
                                "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs",
                                msg.sender_type === "user"
                                  ? "bg-primary text-primary-foreground rounded-tr-md"
                                  : "bg-muted/80 border border-border/50 rounded-tl-md"
                              )}
                            >
                              {msg.sender_type === "user" && msg.sender_name && (
                                <p className="text-[10px] font-medium opacity-75 mb-1">
                                  {msg.sender_name}{msg.sender_username ? ` @${msg.sender_username}` : ""}
                                </p>
                              )}
                              {msg.sender_type === "agent" ? (
                                <div className="prose-sm">
                                  <SafeMarkdown content={msg.message} />
                                </div>
                              ) : (
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                              )}
                              <p className={cn(
                                "text-[9px] mt-1.5",
                                msg.sender_type === "user" ? "text-primary-foreground/60 text-right" : "text-muted-foreground"
                              )}>
                                {new Date(msg.created_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            {msg.sender_type === "user" && (
                              <div className="shrink-0 mt-1">
                                <User className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  <div className="p-2 border-t bg-muted/20">
                    <p className="text-[10px] text-muted-foreground text-center italic">
                      Visualizzazione in sola lettura
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-xs text-muted-foreground">Seleziona una conversazione</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
