import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2, MessageCircle, Users, ArrowLeft, Send, User, Bot, RotateCcw,
  Shield, UserCheck, Clock, Brain, Briefcase, Target, Heart, FileText,
  ChevronRight, ChevronUp, RefreshCw, Eye, CircleDot,
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
  onboarding_status: string;
  user_name: string | null;
  user_job: string | null;
  user_goals: string | null;
  user_desires: string | null;
  onboarding_summary: string | null;
  onboarding_step: number | null;
  is_owner: boolean;
}

interface TelegramMessage {
  id: number | string;
  sender_type: "user" | "agent";
  sender_name: string | null;
  sender_username: string | null;
  message: string;
  created_at: string;
}

interface UserProfile {
  onboarding_status: string;
  onboarding_step: number | null;
  onboarding_summary: string | null;
  user_name: string | null;
  user_job: string | null;
  user_goals: string | null;
  user_desires: string | null;
  full_profile: Record<string, any> | null;
  onboarding_messages: Array<{ role: string; content: string }>;
  first_name: string | null;
  username: string | null;
  chat_type: string | null;
  group_context: string | null;
  group_members: string | null;
  group_objectives: string | null;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  total_messages: number;
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

function OnboardingStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    completed: { label: "Completato", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
    in_onboarding: { label: "In corso", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
    pending: { label: "In attesa", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700" },
  };
  const c = config[status] || config.pending;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", c.className)}>
      <CircleDot className="h-2.5 w-2.5" />
      {c.label}
    </span>
  );
}

function UserTypeBadge({ isOwner, chatType }: { isOwner: boolean; chatType: string }) {
  if (isOwner) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800">
        <Shield className="h-2.5 w-2.5" />
        Consulente
      </span>
    );
  }
  if (chatType === "group" || chatType === "supergroup") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
        <Users className="h-2.5 w-2.5" />
        Gruppo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border-purple-200 dark:border-purple-800">
      <User className="h-2.5 w-2.5" />
      Utente esterno
    </span>
  );
}

function ProfilePanel({ profile, roleName }: { profile: UserProfile; roleName: string }) {
  const [activeTab, setActiveTab] = useState("info");

  return (
    <div className="w-[280px] border-l flex flex-col bg-muted/5 hidden lg:flex">
      <div className="p-3 border-b shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
            profile.is_owner ? "bg-blue-100 dark:bg-blue-900/40" : "bg-purple-100 dark:bg-purple-900/40"
          )}>
            {profile.is_owner ? (
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {profile.user_name || profile.first_name || "Sconosciuto"}
            </p>
            {profile.username && (
              <p className="text-[11px] text-muted-foreground truncate">@{profile.username}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <UserTypeBadge isOwner={profile.is_owner} chatType={profile.chat_type || "private"} />
          <OnboardingStatusBadge status={profile.onboarding_status} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full rounded-none border-b bg-transparent h-9 shrink-0 p-0">
          <TabsTrigger value="info" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent h-9 text-xs">
            Profilo
          </TabsTrigger>
          <TabsTrigger value="memory" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent h-9 text-xs">
            Memoria
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent h-9 text-xs">
            Onboarding
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="info" className="mt-0 p-3 space-y-3">
            <div className="space-y-2">
              {profile.user_job && (
                <div className="flex items-start gap-2">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Lavoro</p>
                    <p className="text-xs leading-relaxed">{profile.user_job}</p>
                  </div>
                </div>
              )}
              {profile.user_goals && (
                <div className="flex items-start gap-2">
                  <Target className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Obiettivi</p>
                    <p className="text-xs leading-relaxed">{profile.user_goals}</p>
                  </div>
                </div>
              )}
              {profile.user_desires && (
                <div className="flex items-start gap-2">
                  <Heart className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Desideri</p>
                    <p className="text-xs leading-relaxed">{profile.user_desires}</p>
                  </div>
                </div>
              )}
              {profile.group_context && (
                <div className="flex items-start gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Contesto gruppo</p>
                    <p className="text-xs leading-relaxed">{profile.group_context}</p>
                  </div>
                </div>
              )}
              {profile.group_members && (
                <div className="flex items-start gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Membri</p>
                    <p className="text-xs leading-relaxed">{profile.group_members}</p>
                  </div>
                </div>
              )}
              {profile.group_objectives && (
                <div className="flex items-start gap-2">
                  <Target className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Obiettivi gruppo</p>
                    <p className="text-xs leading-relaxed">{profile.group_objectives}</p>
                  </div>
                </div>
              )}
              {!profile.user_job && !profile.user_goals && !profile.user_desires && !profile.group_context && (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">Nessun dato profilo disponibile</p>
                  {profile.onboarding_status !== "completed" && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Onboarding non completato</p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Messaggi totali</span>
                <span className="text-xs font-medium">{profile.total_messages}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Prima interazione</span>
                <span className="text-xs font-medium">{new Date(profile.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Ultimo aggiornamento</span>
                <span className="text-xs font-medium">{getRelativeTime(profile.updated_at)}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="memory" className="mt-0 p-3 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-purple-500" />
              <p className="text-xs font-semibold">Cosa ricorda {roleName}</p>
            </div>

            {profile.onboarding_summary ? (
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Riassunto onboarding</p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{profile.onboarding_summary}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-center">
                <p className="text-xs text-muted-foreground">Nessun riassunto onboarding</p>
              </div>
            )}

            {profile.full_profile && Object.keys(profile.full_profile).length > 0 && (
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Profilo strutturato (JSON)</p>
                <div className="space-y-1.5">
                  {Object.entries(profile.full_profile).map(([key, value]) => {
                    if (!value) return null;
                    const displayValue = typeof value === "string" ? value : JSON.stringify(value);
                    return (
                      <div key={key} className="text-xs">
                        <span className="font-medium text-muted-foreground">{key}: </span>
                        <span className="leading-relaxed">{displayValue}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!profile.onboarding_summary && (!profile.full_profile || Object.keys(profile.full_profile).length === 0) && (
              <div className="text-center py-4">
                <Brain className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nessuna memoria disponibile</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="onboarding" className="mt-0 p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-amber-500" />
              <p className="text-xs font-semibold">Conversazione onboarding</p>
            </div>
            {profile.onboarding_status === "in_onboarding" && (
              <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-[10px] text-amber-700 dark:text-amber-400">In corso — Step {(profile.onboarding_step || 0) + 1}</p>
              </div>
            )}
            {profile.onboarding_messages.length > 0 ? (
              <div className="space-y-2.5">
                {profile.onboarding_messages.map((msg, idx) => (
                  <div key={idx} className={cn(
                    "flex gap-2",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}>
                    <div className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-[11px]",
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-muted border border-border/50 rounded-bl-sm"
                    )}>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  {profile.onboarding_status === "pending" ? "Onboarding non ancora iniziato" : "Nessun messaggio"}
                </p>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

export default function TelegramChats({ roleId, roleName, open, onClose }: TelegramChatsProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastMsgCountRef = useRef<number>(0);
  const shouldScrollToBottom = useRef(true);

  useEffect(() => {
    if (open) {
      loadConversations();
      setSelectedChat(null);
      setMessages([]);
      setProfile(null);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, roleId]);

  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    if (selectedChat && open) {
      const chatId = selectedChat.telegram_chat_id;
      loadMessages(chatId);
      loadProfile(chatId);
      lastMsgCountRef.current = 0;

      pollRef.current = setInterval(() => {
        pollNewMessages(chatId);
        loadConversations(true);
      }, 5000);
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [selectedChat, open]);

  useEffect(() => {
    if (shouldScrollToBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    shouldScrollToBottom.current = true;
  }, [messages]);

  const loadConversations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-conversations/${roleId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {}
    if (!silent) setLoading(false);
  };

  const getMessageLimit = (chatId: string) => {
    const isOwner = conversations.find(c => c.telegram_chat_id === chatId)?.is_owner;
    return isOwner ? 500 : 200;
  };

  const loadMessages = async (chatId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-conversations/${roleId}/${chatId}/messages?limit=${getMessageLimit(chatId)}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const msgs = data.messages || [];
        setMessages(msgs);
        setHasMore(data.hasMore === true);
        lastMsgCountRef.current = msgs.length;
      }
    } catch {}
    setMessagesLoading(false);
  };

  const loadOlderMessages = async () => {
    if (!selectedChat || loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    shouldScrollToBottom.current = false;
    try {
      const oldestMsg = messages[0];
      const chatId = selectedChat.telegram_chat_id;
      const beforeDate = oldestMsg.created_at;
      const res = await fetch(`/api/ai-autonomy/telegram-conversations/${roleId}/${chatId}/messages?limit=${getMessageLimit(chatId)}&before=${encodeURIComponent(beforeDate)}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const olderMsgs = data.messages || [];
        if (olderMsgs.length > 0) {
          setMessages(prev => [...olderMsgs, ...prev]);
          setHasMore(data.hasMore === true);
          lastMsgCountRef.current += olderMsgs.length;
        } else {
          setHasMore(false);
        }
      }
    } catch {}
    setLoadingOlder(false);
  };

  const pollNewMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-conversations/${roleId}/${chatId}/messages?limit=${getMessageLimit(chatId)}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const msgs = data.messages || [];
        if (msgs.length !== lastMsgCountRef.current) {
          setMessages(msgs);
          lastMsgCountRef.current = msgs.length;
        }
      }
    } catch {}
  }, [roleId]);

  const loadProfile = async (chatId: string) => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-conversations/${roleId}/${chatId}/profile`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile || null);
      }
    } catch {}
    setProfileLoading(false);
  };

  const resetChat = async (chatId: string) => {
    setResetting(true);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-conversations/${roleId}/${chatId}/reset`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setSelectedChat(null);
        setMessages([]);
        setProfile(null);
        loadConversations();
      }
    } catch {}
    setResetting(false);
  };

  const getConversationLabel = (conv: Conversation) => {
    if (conv.chat_title) return conv.chat_title;
    if (conv.user_name) return conv.user_name;
    if (conv.sender_name) return conv.sender_name;
    if (conv.sender_username) return `@${conv.sender_username}`;
    return `Chat ${conv.telegram_chat_id}`;
  };

  const getAvatarConfig = (conv: Conversation) => {
    if (conv.is_owner) return { bg: "bg-blue-100 dark:bg-blue-900/40", icon: <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" /> };
    if (conv.chat_type === "group" || conv.chat_type === "supergroup") return { bg: "bg-indigo-100 dark:bg-indigo-900/40", icon: <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> };
    if (conv.onboarding_status === "completed") return { bg: "bg-emerald-100 dark:bg-emerald-900/40", icon: <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> };
    if (conv.onboarding_status === "in_onboarding") return { bg: "bg-amber-100 dark:bg-amber-900/40", icon: <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> };
    return { bg: "bg-gray-100 dark:bg-gray-800", icon: <User className="h-4 w-4 text-gray-500 dark:text-gray-400" /> };
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[98vw] w-[1200px] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <VisuallyHidden>
          <DialogTitle>Chat Telegram - {roleName}</DialogTitle>
        </VisuallyHidden>

        <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">Chat Telegram — {roleName}</h3>
              <p className="text-xs text-muted-foreground">
                {conversations.length} conversazion{conversations.length === 1 ? "e" : "i"} attiv{conversations.length === 1 ? "a" : "e"}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => loadConversations()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Aggiorna
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Conversation list */}
          <div className={cn(
            "border-r flex flex-col bg-muted/10",
            selectedChat ? "w-[280px] hidden md:flex" : "flex-1"
          )}>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nessuna conversazione</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Le conversazioni appariranno qui</p>
                </div>
              ) : (
                <div>
                  {conversations.map((conv) => {
                    const avatar = getAvatarConfig(conv);
                    const isSelected = selectedChat?.telegram_chat_id === conv.telegram_chat_id;
                    return (
                      <button
                        key={conv.telegram_chat_id}
                        onClick={() => setSelectedChat(conv)}
                        className={cn(
                          "w-full text-left px-3 py-3 hover:bg-muted/50 transition-all border-b border-border/20",
                          isSelected && "bg-blue-50/80 dark:bg-blue-950/40 border-l-[3px] border-l-blue-500"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5", avatar.bg)}>
                            {avatar.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-sm font-medium truncate flex-1">{getConversationLabel(conv)}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{getRelativeTime(conv.last_message_at)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <OnboardingStatusBadge status={conv.onboarding_status} />
                              {conv.is_owner && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[9px] font-medium border bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                  <Shield className="h-2 w-2" />
                                  Owner
                                </span>
                              )}
                              <span className="ml-auto text-[10px] text-muted-foreground/70 shrink-0">{conv.message_count} msg</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {conv.last_message ? `${conv.last_message.substring(0, 60)}${conv.last_message.length > 60 ? "..." : ""}` : "Nessun messaggio"}
                            </p>
                            {conv.user_job && (
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate flex items-center gap-1">
                                <Briefcase className="h-2.5 w-2.5 shrink-0" />
                                {conv.user_job}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
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
                <div className="px-4 py-2.5 border-b flex items-center gap-3 bg-muted/20 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 md:hidden"
                    onClick={() => { setSelectedChat(null); setProfile(null); }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                    getAvatarConfig(selectedChat).bg
                  )}>
                    {getAvatarConfig(selectedChat).icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{getConversationLabel(selectedChat)}</p>
                      {selectedChat.sender_username && (
                        <span className="text-xs text-muted-foreground">@{selectedChat.sender_username}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <OnboardingStatusBadge status={selectedChat.onboarding_status} />
                      <UserTypeBadge isOwner={selectedChat.is_owner} chatType={selectedChat.chat_type} />
                      <span className="text-[10px] text-muted-foreground">{selectedChat.message_count} messaggi</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 lg:hidden"
                      onClick={() => setShowProfile(!showProfile)}
                      title="Mostra profilo"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                          <RotateCcw className="h-3.5 w-3.5" />
                          Resetta
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Resettare questa conversazione?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tutti i messaggi verranno cancellati e l'utente ripartira dall'onboarding quando ti riscrivera su Telegram. Questa azione non e reversibile.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => resetChat(selectedChat.telegram_chat_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={resetting}
                          >
                            {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Resetta chat
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
                        <MessageCircle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Nessun messaggio</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {selectedChat.onboarding_status === "in_onboarding"
                            ? "L'onboarding e in corso..."
                            : selectedChat.onboarding_status === "pending"
                            ? "In attesa del primo messaggio"
                            : "La conversazione e vuota"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {hasMore && (
                          <div className="flex justify-center pb-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                              onClick={loadOlderMessages}
                              disabled={loadingOlder}
                            >
                              {loadingOlder ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ChevronUp className="h-3 w-3" />
                              )}
                              {loadingOlder ? "Caricamento..." : "Carica messaggi precedenti"}
                            </Button>
                          </div>
                        )}
                        {messages.map((msg, idx) => {
                          const isOnboardingMsg = typeof msg.id === 'string' && String(msg.id).startsWith('onb_');
                          const prevMsg = idx > 0 ? messages[idx - 1] : null;
                          const prevIsOnboarding = prevMsg && typeof prevMsg.id === 'string' && String(prevMsg.id).startsWith('onb_');
                          const showOnboardingDivider = idx === 0 && isOnboardingMsg;
                          const showPostOnboardingDivider = prevIsOnboarding && !isOnboardingMsg;

                          return (
                            <div key={msg.id}>
                              {showOnboardingDivider && (
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="flex-1 h-px bg-amber-300/50 dark:bg-amber-700/50" />
                                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                                    Conversazione onboarding
                                  </span>
                                  <div className="flex-1 h-px bg-amber-300/50 dark:bg-amber-700/50" />
                                </div>
                              )}
                              {showPostOnboardingDivider && (
                                <div className="flex items-center gap-2 my-4">
                                  <div className="flex-1 h-px bg-emerald-300/50 dark:bg-emerald-700/50" />
                                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                    Onboarding completato — conversazione libera
                                  </span>
                                  <div className="flex-1 h-px bg-emerald-300/50 dark:bg-emerald-700/50" />
                                </div>
                              )}
                              <div className={cn(
                                "flex gap-2.5",
                                msg.sender_type === "user" ? "justify-end" : "justify-start"
                              )}>
                                {msg.sender_type === "agent" && (
                                  <div className="shrink-0 mt-1">
                                    <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                      <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                  </div>
                                )}
                                <div
                                  className={cn(
                                    "max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm",
                                    msg.sender_type === "user"
                                      ? "bg-blue-600 text-white rounded-br-md"
                                      : "bg-muted border border-border/50 rounded-bl-md",
                                    isOnboardingMsg && "opacity-90"
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
                                    msg.sender_type === "user" ? "text-white/50 text-right" : "text-muted-foreground/60"
                                  )}>
                                    {new Date(msg.created_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                                {msg.sender_type === "user" && (
                                  <div className="shrink-0 mt-1">
                                    <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                      <User className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="px-4 py-2 border-t bg-muted/20 shrink-0 flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground italic">
                    Sola lettura — aggiornamento automatico ogni 5s
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-muted-foreground">Live</span>
                  </div>
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

          {/* Profile panel — visible on lg+ always, or on smaller screens when toggled */}
          {selectedChat && (
            <div className={cn(
              "border-l bg-muted/5",
              showProfile ? "fixed inset-0 z-50 bg-background lg:relative lg:inset-auto lg:z-auto w-full lg:w-auto" : "hidden lg:flex"
            )}>
              {showProfile && (
                <div className="lg:hidden flex items-center justify-between px-3 py-2 border-b">
                  <p className="text-sm font-medium">Dettagli utente</p>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowProfile(false)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {profileLoading ? (
                <div className="w-full lg:w-[280px] flex items-center justify-center flex-1 min-h-[200px]">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : profile ? (
                <ProfilePanel profile={profile} roleName={roleName} />
              ) : (
                <div className="w-full lg:w-[280px] flex flex-col items-center justify-center flex-1 p-6 text-center min-h-[200px]">
                  <User className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground">Nessun profilo disponibile</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">L'utente non ha ancora interagito</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
