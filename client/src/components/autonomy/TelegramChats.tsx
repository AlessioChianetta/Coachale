import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import {
  Loader2, MessageCircle, Users, ArrowLeft, Send, User, Bot, X,
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
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] w-[900px] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
        <VisuallyHidden>
          <DialogTitle>Chat Telegram - {roleName}</DialogTitle>
        </VisuallyHidden>

        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">Chat Telegram — {roleName}</h3>
              <p className="text-xs text-muted-foreground">Conversazioni in modalità aperta</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Conversation list */}
          <div className={cn(
            "border-r flex flex-col bg-muted/10",
            selectedChat ? "w-[260px] hidden md:flex" : "flex-1"
          )}>
            <div className="p-3 border-b shrink-0">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                {conversations.length} conversazion{conversations.length === 1 ? "e" : "i"}
              </p>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nessuna conversazione</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Le conversazioni in modalità aperta appariranno qui</p>
                </div>
              ) : (
                <div>
                  {conversations.map((conv) => (
                    <button
                      key={conv.telegram_chat_id}
                      onClick={() => setSelectedChat(conv)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30",
                        selectedChat?.telegram_chat_id === conv.telegram_chat_id && "bg-blue-50 dark:bg-blue-950/30 border-l-3 border-l-blue-500"
                      )}
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          conv.chat_type === "private" ? "bg-blue-100 dark:bg-blue-900/40" : "bg-indigo-100 dark:bg-indigo-900/40"
                        )}>
                          {conv.chat_type === "private" ? (
                            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">
                            {getConversationLabel(conv)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {conv.chat_type === "private" ? "Privata" : "Gruppo"} · {getRelativeTime(conv.last_message_at)}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 font-normal">
                          {conv.message_count}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate pl-10">
                        {conv.last_message.substring(0, 80)}{conv.last_message.length > 80 ? "…" : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Messages panel */}
          <div className={cn(
            "flex flex-col flex-1 min-w-0",
            !selectedChat && "hidden md:flex"
          )}>
            {selectedChat ? (
              <>
                <div className="px-4 py-3 border-b flex items-center gap-3 bg-muted/20 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 md:hidden"
                    onClick={() => setSelectedChat(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                    selectedChat.chat_type === "private" ? "bg-blue-100 dark:bg-blue-900/40" : "bg-indigo-100 dark:bg-indigo-900/40"
                  )}>
                    {selectedChat.chat_type === "private" ? (
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{getConversationLabel(selectedChat)}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedChat.chat_type === "private" ? "Chat privata" : "Gruppo"} · {selectedChat.message_count} messaggi
                    </p>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {messagesLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-sm text-muted-foreground">Nessun messaggio</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex gap-3",
                              msg.sender_type === "user" ? "justify-end" : "justify-start"
                            )}
                          >
                            {msg.sender_type === "agent" && (
                              <div className="shrink-0 mt-1">
                                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                  <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                              </div>
                            )}
                            <div
                              className={cn(
                                "max-w-[70%] rounded-2xl px-4 py-3 text-sm",
                                msg.sender_type === "user"
                                  ? "bg-blue-600 text-white rounded-br-md"
                                  : "bg-muted border border-border/50 rounded-bl-md"
                              )}
                            >
                              {msg.sender_type === "user" && msg.sender_name && (
                                <p className="text-xs font-medium opacity-80 mb-1.5">
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
                                "text-[10px] mt-2",
                                msg.sender_type === "user" ? "text-white/60 text-right" : "text-muted-foreground"
                              )}>
                                {new Date(msg.created_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            {msg.sender_type === "user" && (
                              <div className="shrink-0 mt-1">
                                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                  <User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="px-4 py-2.5 border-t bg-muted/30 shrink-0">
                  <p className="text-xs text-muted-foreground text-center italic">
                    Visualizzazione in sola lettura
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">Seleziona una conversazione</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Scegli una chat dalla lista a sinistra</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
