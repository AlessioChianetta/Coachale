import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
  Loader2,
  Clock,
  Calendar,
  User,
  MessageSquare,
  ChevronLeft,
  FileText,
  Play,
  Mic2,
  ArrowLeft,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { it } from "date-fns/locale";

const ITALY_TZ = "Europe/Rome";
const toItalianTime = (date: Date | string): Date => {
  return toZonedTime(new Date(date), ITALY_TZ);
};

interface Conversation {
  phone: string;
  client_name: string;
  client_id: string | null;
  total_calls: number;
  calls_with_transcript: number;
  last_call_at: string;
  first_call_at: string;
  total_duration: number;
  outcomes: string[] | null;
}

interface CallDetail {
  id: string;
  caller_id: string;
  called_number: string;
  client_id: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  full_transcript: string | null;
  transcript_chunks: any[] | null;
  outcome: string | null;
  ai_mode: string | null;
  metadata: any;
  recording_url: string | null;
  prompt_used: string | null;
  client_name: string;
  source?: string;
}

interface ConversationDetail {
  phone: string;
  client_name: string;
  calls: CallDetail[];
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function ContactListItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const lastCallDate = toItalianTime(conversation.last_call_at);
  const isToday = new Date().toDateString() === lastCallDate.toDateString();

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${
        isSelected ? "bg-violet-50 dark:bg-violet-950/20 border-l-2 border-l-violet-500" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          {conversation.client_id ? (
            <User className="h-5 w-5 text-violet-600" />
          ) : (
            <Phone className="h-5 w-5 text-slate-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">
              {conversation.client_name}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {isToday
                ? format(lastCallDate, "HH:mm")
                : format(lastCallDate, "dd/MM/yy")}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground truncate">
              {conversation.phone}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              <Phone className="h-2.5 w-2.5 mr-0.5" />
              {conversation.total_calls}
            </Badge>
            {conversation.calls_with_transcript > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-emerald-600 border-emerald-200">
                <FileText className="h-2.5 w-2.5 mr-0.5" />
                {conversation.calls_with_transcript}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function TranscriptBubble({
  chunk,
  isAI,
}: {
  chunk: { speaker: string; timestamp?: string; text: string };
  isAI: boolean;
}) {
  return (
    <div className={`flex ${isAI ? "justify-start" : "justify-end"} mb-2`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isAI
            ? "bg-white dark:bg-slate-800 border border-border/60 rounded-tl-sm"
            : "bg-violet-500 text-white rounded-tr-sm"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${isAI ? "text-violet-600" : "text-violet-100"}`}>
            {chunk.speaker}
          </span>
          {chunk.timestamp && (
            <span className={`text-[10px] ${isAI ? "text-muted-foreground" : "text-violet-200"}`}>
              {chunk.timestamp}
            </span>
          )}
        </div>
        <p className={`text-sm leading-relaxed ${isAI ? "text-foreground" : "text-white"}`}>
          {chunk.text}
        </p>
      </div>
    </div>
  );
}

function CallDivider({ call }: { call: CallDetail }) {
  const callDate = toItalianTime(call.started_at);
  const direction = call.called_number ? "outbound" : "inbound";

  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/80 rounded-full border border-border/60">
        {direction === "inbound" ? (
          <PhoneIncoming className="h-3 w-3 text-emerald-500" />
        ) : (
          <PhoneOutgoing className="h-3 w-3 text-blue-500" />
        )}
        <span className="text-[11px] font-medium text-muted-foreground">
          {format(callDate, "d MMM yyyy, HH:mm", { locale: it })}
        </span>
        {call.duration_seconds && (
          <span className="text-[11px] text-muted-foreground">
            · {formatDuration(call.duration_seconds)}
          </span>
        )}
        {call.outcome && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {call.outcome}
          </Badge>
        )}
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function PlainTranscriptView({ text, call }: { text: string; call: CallDetail }) {
  const callDate = toItalianTime(call.started_at);

  return (
    <div className="mb-4">
      <CallDivider call={call} />
      <div className="mx-4 p-4 bg-muted/30 rounded-xl border border-border/40">
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {text}
        </p>
      </div>
    </div>
  );
}

function EmptyConversationState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
          <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <div>
          <p className="font-medium text-muted-foreground">Seleziona una conversazione</p>
          <p className="text-sm text-muted-foreground/70">
            Scegli un contatto dalla lista per visualizzare le trascrizioni
          </p>
        </div>
      </div>
    </div>
  );
}

function ConversationView({ phone }: { phone: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<ConversationDetail>({
    queryKey: ["/api/voice/conversations", phone],
    queryFn: async () => {
      const res = await fetch(`/api/voice/conversations/${encodeURIComponent(phone)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: !!phone,
  });

  useEffect(() => {
    if (scrollRef.current && data?.calls?.length) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!data?.calls?.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Phone className="h-8 w-8 text-muted-foreground/50 mx-auto" />
          <p className="text-sm text-muted-foreground">Nessuna chiamata trovata</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4"
      style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.03) 1px, transparent 0)", backgroundSize: "24px 24px" }}
    >
      {data.calls.map((call) => {
        const chunks = call.transcript_chunks;
        const hasChunks = Array.isArray(chunks) && chunks.length > 0;
        const hasPlainText = call.full_transcript && call.full_transcript.trim().length > 0;

        if (!hasChunks && !hasPlainText) {
          return (
            <div key={call.id}>
              <CallDivider call={call} />
              <div className="flex justify-center mb-4">
                <span className="text-xs text-muted-foreground italic bg-muted/50 px-3 py-1 rounded-full">
                  Nessuna trascrizione disponibile
                </span>
              </div>
            </div>
          );
        }

        if (hasChunks) {
          return (
            <div key={call.id}>
              <CallDivider call={call} />
              {chunks!.map((chunk: any, idx: number) => {
                const speakerLower = (chunk.speaker || "").toLowerCase();
                const isAI = speakerLower.includes("ai") || speakerLower.includes("assistant") || speakerLower.includes("alessia") || speakerLower.includes("bot");
                return <TranscriptBubble key={idx} chunk={chunk} isAI={isAI} />;
              })}
            </div>
          );
        }

        return (
          <PlainTranscriptView key={call.id} text={call.full_transcript!} call={call} />
        );
      })}
    </div>
  );
}

export default function ConversazioniTab() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [deletePhone, setDeletePhone] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: conversationsData, isLoading } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["/api/voice/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/voice/conversations", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await fetch(`/api/voice/conversations/${encodeURIComponent(phone)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return res.json();
    },
    onSuccess: (_data, phone) => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice/conversations"] });
      if (selectedPhone === phone) {
        setSelectedPhone(null);
        setMobileShowChat(false);
      }
      toast({ title: "Conversazione eliminata", description: `Tutte le chiamate con ${phone} sono state rimosse.` });
    },
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile eliminare la conversazione.", variant: "destructive" });
    },
  });

  const filteredConversations = useMemo(() => {
    if (!conversationsData?.conversations) return [];
    if (!searchQuery.trim()) return conversationsData.conversations;
    const q = searchQuery.toLowerCase();
    return conversationsData.conversations.filter(
      (c) =>
        c.phone.toLowerCase().includes(q) ||
        c.client_name.toLowerCase().includes(q)
    );
  }, [conversationsData, searchQuery]);

  const selectedConversation = useMemo(() => {
    return filteredConversations.find((c) => c.phone === selectedPhone);
  }, [filteredConversations, selectedPhone]);

  const handleSelectPhone = (phone: string) => {
    setSelectedPhone(phone);
    setMobileShowChat(true);
  };

  const handleBackToList = () => {
    setMobileShowChat(false);
  };

  return (
    <Card className="rounded-xl border shadow-sm overflow-hidden">
      <div className="flex h-[calc(100vh-280px)] min-h-[500px]">
        <div
          className={`w-full md:w-[340px] lg:w-[380px] border-r border-border flex flex-col bg-background ${
            mobileShowChat ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome o numero..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-lg bg-background"
              />
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs text-muted-foreground">
                {filteredConversations.length} conversazion{filteredConversations.length === 1 ? "e" : "i"}
              </span>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Phone className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "Nessun risultato" : "Nessuna conversazione"}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <ContactListItem
                  key={conv.phone}
                  conversation={conv}
                  isSelected={selectedPhone === conv.phone}
                  onClick={() => handleSelectPhone(conv.phone)}
                />
              ))
            )}
          </ScrollArea>
        </div>

        <div
          className={`flex-1 flex flex-col bg-background ${
            !mobileShowChat ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedPhone && selectedConversation ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  onClick={handleBackToList}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  {selectedConversation.client_id ? (
                    <User className="h-5 w-5 text-violet-600" />
                  ) : (
                    <Phone className="h-5 w-5 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {selectedConversation.client_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.phone} · {selectedConversation.total_calls} chiamat{selectedConversation.total_calls === 1 ? "a" : "e"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDuration(selectedConversation.total_duration)}
                  </Badge>
                  <Link href={`/consultant/voice-calls/contact/${encodeURIComponent(selectedConversation.phone)}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Scheda Contatto">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeletePhone(selectedPhone)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ConversationView phone={selectedPhone} />
            </>
          ) : (
            <EmptyConversationState />
          )}
        </div>
      </div>

      <AlertDialog open={!!deletePhone} onOpenChange={(open) => !open && setDeletePhone(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa conversazione?</AlertDialogTitle>
            <AlertDialogDescription>
              Tutte le chiamate e i messaggi con il numero <strong>{deletePhone}</strong> verranno eliminati definitivamente. Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deletePhone) {
                  deleteConversation.mutate(deletePhone);
                  setDeletePhone(null);
                }
              }}
            >
              {deleteConversation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}