import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, PhoneIncoming, PhoneOff, PhoneMissed, PhoneForwarded,
  PhoneOutgoing, Clock, User, ArrowLeft, Loader2, RefreshCw,
  MessageSquare, FileText, Calendar, Activity, CheckCircle,
  AlertCircle, Ban, Volume2, CalendarCheck, ExternalLink,
  Globe, Target, Zap, Timer, ChevronDown, ChevronRight,
  Search, Building2, Mail, Hash, BarChart3, History,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface ContactProfile {
  phone: string;
  name: string | null;
  type: "client" | "lead" | "known" | "unknown";
  userId: string | null;
  email: string | null;
  role: string | null;
}

interface CallRecord {
  id: string;
  caller_id: string;
  called_number: string;
  status: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  hangup_cause: string | null;
  ai_mode: string | null;
  call_direction: string | null;
  full_transcript: string | null;
  ai_conversation_id: string | null;
  client_id: string | null;
  freeswitch_uuid: string | null;
  outcome: string | null;
  recording_url: string | null;
  client_name: string | null;
}

interface ScheduledCall {
  id: string;
  target_phone: string;
  status: string;
  scheduled_at: string;
  ai_mode: string | null;
  call_instruction: string | null;
  instruction_type: string | null;
  attempts: number;
  max_attempts: number;
  duration_seconds: number | null;
  hangup_cause: string | null;
  voice_call_id: string | null;
  retry_reason: string | null;
  next_retry_at: string | null;
  custom_prompt: string | null;
  created_at: string;
  attempts_log?: any[];
}

interface HunterContext {
  businessName: string | null;
  sector: string | null;
  score: number | null;
  website: string | null;
  aiSalesSummary: string | null;
  leadStatus: string | null;
  leadId: string | null;
}

interface ProactiveLead {
  id: string;
  lead_name: string | null;
  phone_number: string | null;
  email: string | null;
  objectives: string | null;
  desires: string | null;
  hook: string | null;
  source: string | null;
  outreach_status: string | null;
  created_at: string;
}

interface NextRetry {
  id: string;
  status: string;
  next_retry_at: string | null;
  retry_reason: string | null;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
}

interface TimelineEvent {
  type: "call" | "scheduled" | "retry_event" | "call_event";
  id?: string;
  status?: string;
  timestamp?: string;
  direction?: string;
  duration_seconds?: number | null;
  outcome?: string | null;
  hangup_cause?: string | null;
  transcript_preview?: string | null;
  has_transcript?: boolean;
  has_recording?: boolean;
  ai_mode?: string | null;
  client_name?: string | null;
  scheduled_at?: string;
  instruction?: string | null;
  instruction_type?: string | null;
  attempts?: number;
  max_attempts?: number;
  retry_reason?: string | null;
  next_retry_at?: string | null;
  attempt?: number;
  event?: string;
  scheduled_call_id?: string;
  call_id?: string;
  eventType?: string;
  eventData?: any;
}

interface ContactStats {
  totalCalls: number;
  completed: number;
  failed: number;
  noAnswer: number;
  busy: number;
  shortCall: number;
  voicemail: number;
  totalDuration: number;
  avgDuration: number;
  firstContact: string | null;
  lastContact: string | null;
  totalScheduled: number;
  retryEvents: number;
}

interface ContactData {
  contact: ContactProfile;
  calls: CallRecord[];
  scheduledCalls: ScheduledCall[];
  timeline?: TimelineEvent[];
  stats?: ContactStats;
  hunterContext: HunterContext | null;
  proactiveLead: ProactiveLead | null;
  nextRetry: NextRetry | null;
}

const CALL_STATUS: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  ringing: { label: "In Arrivo", icon: PhoneIncoming, color: "bg-yellow-500" },
  answered: { label: "Connessa", icon: Phone, color: "bg-blue-500" },
  talking: { label: "In Corso", icon: Phone, color: "bg-green-500" },
  completed: { label: "Completata", icon: CheckCircle, color: "bg-green-600" },
  failed: { label: "Fallita", icon: PhoneMissed, color: "bg-red-500" },
  transferred: { label: "Trasferita", icon: PhoneForwarded, color: "bg-purple-500" },
  ended: { label: "Terminata", icon: PhoneOff, color: "bg-gray-500" },
  pending: { label: "In Attesa", icon: Clock, color: "bg-amber-500" },
  scheduled: { label: "Programmata", icon: Calendar, color: "bg-blue-400" },
  calling: { label: "In Chiamata", icon: PhoneOutgoing, color: "bg-cyan-500" },
  retry_scheduled: { label: "Retry Programmato", icon: Timer, color: "bg-orange-500" },
  no_answer: { label: "Nessuna Risposta", icon: PhoneMissed, color: "bg-red-400" },
  busy: { label: "Occupato", icon: PhoneOff, color: "bg-orange-400" },
  short_call: { label: "Breve", icon: AlertCircle, color: "bg-yellow-500" },
  voicemail: { label: "Segreteria", icon: Volume2, color: "bg-purple-500" },
  cancelled: { label: "Annullata", icon: Ban, color: "bg-gray-400" },
};

const CONTACT_TYPE_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  client: { label: "Cliente", variant: "default" },
  lead: { label: "Lead", variant: "secondary" },
  known: { label: "Conosciuto", variant: "outline" },
  unknown: { label: "Sconosciuto", variant: "outline" },
};

const TIMELINE_CONFIG: Record<string, { icon: typeof Phone; color: string; bgColor: string }> = {
  completed: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-950/40" },
  no_answer: { icon: PhoneMissed, color: "text-red-500", bgColor: "bg-red-100 dark:bg-red-950/40" },
  busy: { icon: PhoneOff, color: "text-orange-500", bgColor: "bg-orange-100 dark:bg-orange-950/40" },
  voicemail: { icon: Volume2, color: "text-purple-500", bgColor: "bg-purple-100 dark:bg-purple-950/40" },
  short_call: { icon: AlertCircle, color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-950/40" },
  failed: { icon: PhoneMissed, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-950/40" },
  retry_scheduled: { icon: Timer, color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-950/40" },
  scheduled: { icon: Calendar, color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-gray-800/40" },
  pending: { icon: Clock, color: "text-amber-500", bgColor: "bg-amber-100 dark:bg-amber-950/40" },
  calling: { icon: PhoneOutgoing, color: "text-cyan-500", bgColor: "bg-cyan-100 dark:bg-cyan-950/40" },
  ended: { icon: PhoneOff, color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-gray-800/40" },
};

function formatDuration(seconds: number | null) {
  if (!seconds) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getInitials(name: string | null, phone: string): string {
  if (name && name.trim()) {
    return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  }
  return phone.slice(-2);
}

function getTimelineEventConfig(event: TimelineEvent) {
  const status = event.status || "ended";
  return TIMELINE_CONFIG[status] || TIMELINE_CONFIG.ended;
}

function getTimelineEventDescription(event: TimelineEvent): string {
  if (event.type === "call") {
    const dir = event.direction === "inbound" ? "in entrata" : "in uscita";
    const statusLabel = CALL_STATUS[event.status || ""]?.label || event.status || "";
    return `Chiamata ${dir} · ${statusLabel}`;
  }
  if (event.type === "scheduled") {
    const statusLabel = CALL_STATUS[event.status || ""]?.label || event.status || "";
    return `Chiamata programmata · ${statusLabel}`;
  }
  if (event.type === "retry_event") {
    const statusLabel = CALL_STATUS[event.status || ""]?.label || event.status || "";
    return `Tentativo ${event.attempt || "?"} · ${statusLabel}`;
  }
  if (event.type === "call_event") {
    return `Evento: ${event.eventType || "sconosciuto"}`;
  }
  return "Evento";
}

export default function ConsultantVoiceCallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [expandedTimelineEvents, setExpandedTimelineEvents] = useState<Set<string>>(new Set());

  const isContactMode = location.includes('/contact/');

  const decodedId = decodeURIComponent(id || "");
  const isPhoneNumber = /^\+?\d[\d\s\-()]{2,}$/.test(decodedId);
  const phoneFromUrl = isPhoneNumber ? decodedId : null;

  const { data: resolvedPhone, isLoading: resolvingPhone } = useQuery({
    queryKey: ["/api/voice/contact-by-call", id],
    queryFn: async () => {
      const res = await fetch(`/api/voice/contact-by-call/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore risoluzione numero");
      const data = await res.json();
      return data.phone as string;
    },
    enabled: !isPhoneNumber && !!id,
  });

  const phone = phoneFromUrl || resolvedPhone;

  const { data: contactData, isLoading: loadingContact, refetch } = useQuery<ContactData>({
    queryKey: ["/api/voice/contact", phone],
    queryFn: async () => {
      const res = await fetch(`/api/voice/contact/${encodeURIComponent(phone!)}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento contatto");
      return res.json();
    },
    enabled: !!phone,
  });

  const blockMutation = useMutation({
    mutationFn: async (callerId: string) => {
      const res = await fetch(`/api/voice/block/${encodeURIComponent(callerId)}`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Blocked from contact profile", hours: 24 }),
      });
      if (!res.ok) throw new Error("Errore nel blocco");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Numero Bloccato", description: "Il numero e stato bloccato per 24 ore" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const toggleCallExpanded = (callId: string) => {
    setExpandedCalls(prev => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  };

  const toggleTimelineExpanded = (eventKey: string) => {
    setExpandedTimelineEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventKey)) next.delete(eventKey);
      else next.add(eventKey);
      return next;
    });
  };

  const isLoading = resolvingPhone || loadingContact;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!contactData && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Contatto non trovato</h2>
          <Link href="/consultant/voice-calls">
            <Button className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna alle Chiamate
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!contactData) return null;

  const { contact, calls, scheduledCalls, timeline, stats, hunterContext, proactiveLead, nextRetry } = contactData;
  const typeBadge = CONTACT_TYPE_BADGES[contact.type] || CONTACT_TYPE_BADGES.unknown;
  const displayName = contact.name || contact.phone;

  const focusedCall = !isContactMode ? calls.find(c => c.id === decodedId) || calls[0] : null;

  if (!isContactMode && focusedCall) {
    const st = CALL_STATUS[focusedCall.status] || CALL_STATUS.ended;
    const StIcon = st.icon;
    const isInbound = focusedCall.call_direction === "inbound" || (!focusedCall.call_direction && focusedCall.caller_id === contact.phone);

    const getStatusStyle = (status: string) => {
      switch (status) {
        case 'completed': case 'transferred': return { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' };
        case 'failed': case 'no_answer': return { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' };
        case 'busy': case 'short_call': return { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' };
        case 'voicemail': return { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' };
        case 'ringing': case 'answered': case 'talking': return { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' };
        default: return { bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-200 dark:border-slate-800', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' };
      }
    };
    const statusStyle = getStatusStyle(focusedCall.status);

    const hiddenOutcomes = ['normal_end', 'ghost_cleanup', 'originator_cancel', 'system_error', 'NO_ANSWER', 'NORMAL_CLEARING', 'ORIGINATOR_CANCEL'];
    const showOutcome = focusedCall.outcome && !hiddenOutcomes.includes(focusedCall.outcome);

    const formatTranscript = (text: string) => {
      const lines = text.split('\n').filter(l => l.trim());
      return lines.map((line, i) => {
        const alessiaMatch = line.match(/^\[Alessia\]\s*(.*)/i);
        const utenteMatch = line.match(/^\[Utente\]\s*(.*)/i);
        if (alessiaMatch) {
          return (
            <div key={i} className="flex gap-3 mb-3">
              <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400">AI</span>
              </div>
              <div className="flex-1 bg-violet-50 dark:bg-violet-950/20 rounded-xl rounded-tl-sm px-3 py-2">
                <p className="text-sm text-foreground">{alessiaMatch[1]}</p>
              </div>
            </div>
          );
        }
        if (utenteMatch) {
          return (
            <div key={i} className="flex gap-3 mb-3 flex-row-reverse">
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl rounded-tr-sm px-3 py-2">
                <p className="text-sm text-foreground">{utenteMatch[1]}</p>
              </div>
            </div>
          );
        }
        return (
          <div key={i} className="text-center mb-2">
            <span className="text-xs text-muted-foreground italic">{line}</span>
          </div>
        );
      });
    };

    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} role="consultant" />
        <div className={`flex-1 flex flex-col ${isMobile ? "w-full" : "ml-0"}`}>
          <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="flex-1 p-4 lg:p-6 lg:px-8 overflow-auto">
            <div className="max-w-3xl mx-auto space-y-5">

              <div className="flex items-center gap-3">
                <Link href="/consultant/voice-calls">
                  <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
                </Link>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    contact.name ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {getInitials(contact.name, contact.phone)}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold truncate">{contact.name || contact.phone}</h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {contact.name && <span className="font-mono text-xs">{contact.phone}</span>}
                      <span className="flex items-center gap-1">
                        {isInbound ? <PhoneIncoming className="h-3 w-3" /> : <PhoneOutgoing className="h-3 w-3" />}
                        {isInbound ? "In entrata" : "In uscita"}
                      </span>
                    </div>
                  </div>
                </div>
                <Link href={`/consultant/voice-calls/contact/${encodeURIComponent(contact.phone.replace(/\s+/g, ''))}`} className="shrink-0">
                  <Button variant="outline" size="sm">
                    <User className="h-4 w-4 mr-1.5" />
                    Profilo
                  </Button>
                </Link>
              </div>

              <div className={`rounded-2xl border ${statusStyle.border} ${statusStyle.bg} p-4`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusStyle.dot}`}>
                      <StIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${statusStyle.text}`}>{st.label}</span>
                        {showOutcome && <Badge variant="secondary" className="text-xs">{focusedCall.outcome}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {focusedCall.started_at && format(new Date(focusedCall.started_at), "EEEE d MMMM yyyy · HH:mm", { locale: it })}
                      </p>
                    </div>
                  </div>
                  {focusedCall.duration_seconds != null && focusedCall.duration_seconds > 0 && (
                    <div className="flex items-center gap-1.5 bg-white/60 dark:bg-black/20 rounded-lg px-3 py-1.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{formatDuration(focusedCall.duration_seconds)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-card p-3">
                  <span className="text-muted-foreground text-xs flex items-center gap-1"><PhoneIncoming className="h-3 w-3" />Chiamante</span>
                  <span className="font-mono text-sm font-medium block mt-1">{focusedCall.caller_id}</span>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <span className="text-muted-foreground text-xs flex items-center gap-1"><PhoneOutgoing className="h-3 w-3" />Chiamato</span>
                  <span className="font-mono text-sm font-medium block mt-1">{focusedCall.called_number}</span>
                </div>
                {focusedCall.ai_mode && (
                  <div className="rounded-xl border bg-card p-3">
                    <span className="text-muted-foreground text-xs flex items-center gap-1"><Zap className="h-3 w-3" />Modalità AI</span>
                    <span className="text-sm font-medium block mt-1 capitalize">{focusedCall.ai_mode}</span>
                  </div>
                )}
                {focusedCall.client_name && (
                  <div className="rounded-xl border bg-card p-3">
                    <span className="text-muted-foreground text-xs flex items-center gap-1"><User className="h-3 w-3" />Cliente</span>
                    <span className="text-sm font-medium block mt-1">{focusedCall.client_name}</span>
                  </div>
                )}
              </div>

              {focusedCall.full_transcript && (
                <div className="rounded-2xl border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Trascrizione</span>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <div className="p-4">
                      {formatTranscript(focusedCall.full_transcript)}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {focusedCall.recording_url && (
                <div className="rounded-2xl border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Registrazione</span>
                  </div>
                  <div className="p-4">
                    <audio controls className="w-full">
                      <source src={`/api/voice/recording/${focusedCall.id}?token=${localStorage.getItem('token') || ''}`} type="audio/wav" />
                    </audio>
                  </div>
                </div>
              )}

              <div className="text-center pb-4">
                <Link href={`/consultant/voice-calls/contact/${encodeURIComponent(contact.phone.replace(/\s+/g, ''))}`}>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    Vedi tutte le chiamate di {displayName || contact.phone} →
                  </Button>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const safeStats = stats || {
    totalCalls: calls.length,
    completed: calls.filter(c => c.status === "completed").length,
    failed: calls.filter(c => c.status === "failed").length,
    noAnswer: calls.filter(c => c.status === "no_answer").length,
    busy: calls.filter(c => c.status === "busy").length,
    shortCall: calls.filter(c => c.status === "short_call").length,
    voicemail: calls.filter(c => c.status === "voicemail").length,
    totalDuration: calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0),
    avgDuration: calls.length > 0 ? Math.round(calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length) : 0,
    firstContact: calls.length > 0 ? calls[calls.length - 1]?.started_at : null,
    lastContact: calls.length > 0 ? calls[0]?.started_at : null,
    totalScheduled: scheduledCalls.length,
    retryEvents: 0,
  };

  const safeTimeline = timeline || [];

  const recentTimelineEvents = safeTimeline.slice(0, 3);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} role="consultant" />
      <div className={`flex-1 flex flex-col ${isMobile ? "w-full" : "ml-0"}`}>
        <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-4 lg:p-6 lg:px-8 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <Link href="/consultant/voice-calls">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </Link>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {getInitials(contact.name, contact.phone)}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                      {displayName}
                      <Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>
                      {hunterContext?.leadStatus && (
                        <Badge variant="secondary" className="capitalize">{hunterContext.leadStatus}</Badge>
                      )}
                    </h1>
                    <p className="text-muted-foreground font-mono text-sm">{contact.phone}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {safeStats.totalCalls} chiamate · {safeStats.completed} completate
                      {safeStats.noAnswer > 0 && ` · ${safeStats.noAnswer} non risponde`}
                      {safeStats.voicemail > 0 && ` · ${safeStats.voicemail} segreteria`}
                      {safeStats.busy > 0 && ` · ${safeStats.busy} occupato`}
                      {safeStats.shortCall > 0 && ` · ${safeStats.shortCall} brevi`}
                      {safeStats.totalDuration > 0 && ` · Durata tot: ${formatDuration(safeStats.totalDuration)}`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => refetch()} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Aggiorna
                </Button>
                <Button
                  onClick={() => blockMutation.mutate(contact.phone)}
                  variant="destructive"
                  size="sm"
                  disabled={blockMutation.isPending}
                >
                  {blockMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Ban className="h-4 w-4 mr-2" />
                  )}
                  Blocca
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

              <div className="space-y-4">
                <Tabs defaultValue="timeline" className="w-full">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="timeline" className="flex items-center gap-1.5">
                      <History className="h-4 w-4" />
                      Timeline
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      Storico ({calls.length})
                    </TabsTrigger>
                    <TabsTrigger value="scheduled" className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      Programmate ({scheduledCalls.length})
                    </TabsTrigger>
                    <TabsTrigger value="technical" className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      Tecnico
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="timeline" className="mt-4">
                    {safeTimeline.length === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nessun evento nella timeline per questo contatto</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
                        <div className="space-y-1">
                          {(() => {
                            let lastDateLabel = "";
                            return safeTimeline.map((event, idx) => {
                              const eventKey = `${event.type}-${event.id || event.scheduled_call_id || idx}-${event.attempt || 0}`;
                              const cfg = getTimelineEventConfig(event);
                              const EventIcon = cfg.icon;
                              const description = getTimelineEventDescription(event);
                              const isExpanded = expandedTimelineEvents.has(eventKey);
                              const isCallWithDetails = event.type === "call" && (event.has_transcript || event.has_recording);

                              let dateSeparator: string | null = null;
                              if (event.timestamp) {
                                const d = new Date(event.timestamp);
                                const dateLabel = format(d, "EEEE d MMMM yyyy", { locale: it });
                                if (dateLabel !== lastDateLabel) {
                                  lastDateLabel = dateLabel;
                                  dateSeparator = dateLabel;
                                }
                              }

                              return (
                                <div key={eventKey}>
                                  {dateSeparator && (
                                    <div className="relative pl-12 py-2 mt-2 first:mt-0">
                                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted flex items-center justify-center z-10">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{dateSeparator}</p>
                                    </div>
                                  )}
                                  <div className="relative pl-12">
                                    <div className={`absolute left-3 top-3 w-5 h-5 rounded-full flex items-center justify-center ${cfg.bgColor} z-10`}>
                                      <EventIcon className={`h-3 w-3 ${cfg.color}`} />
                                    </div>

                                    <div
                                      className={`rounded-lg border p-3 overflow-hidden ${isCallWithDetails ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
                                      onClick={() => isCallWithDetails && toggleTimelineExpanded(eventKey)}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-medium">{description}</span>
                                            {event.outcome && <Badge variant="secondary" className="text-xs">{event.outcome}</Badge>}
                                            {event.duration_seconds != null && event.duration_seconds > 0 && (
                                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                                <Clock className="h-3 w-3" />
                                                {formatDuration(event.duration_seconds)}
                                              </span>
                                            )}
                                          </div>

                                          {event.type === "call" && event.transcript_preview && (
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">{event.transcript_preview}</p>
                                          )}

                                          {event.type === "retry_event" && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Tentativo {event.attempt}/{event.max_attempts || "?"}
                                              {event.hangup_cause && ` · ${event.hangup_cause}`}
                                              {event.event && ` · ${event.event}`}
                                            </p>
                                          )}

                                          {event.type === "scheduled" && (
                                            <div className="text-xs text-muted-foreground mt-1 overflow-hidden">
                                              {event.instruction && <p className="line-clamp-2 break-words">{event.instruction}</p>}
                                              {event.instruction_type && <span className="capitalize">Tipo: {event.instruction_type}</span>}
                                              {event.attempts != null && event.max_attempts != null && (
                                                <span className="ml-2">· Tentativi: {event.attempts}/{event.max_attempts}</span>
                                              )}
                                              {event.retry_reason && <p className="text-orange-600 mt-0.5 break-words">{event.retry_reason}</p>}
                                            </div>
                                          )}

                                          {event.type === "call_event" && event.eventData && (
                                            <p className="text-xs text-muted-foreground mt-1 break-words">
                                              {typeof event.eventData === "string" ? event.eventData : JSON.stringify(event.eventData).substring(0, 100)}
                                            </p>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          {event.timestamp && (
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                              {format(new Date(event.timestamp), "HH:mm", { locale: it })}
                                            </span>
                                          )}
                                          {isCallWithDetails && (
                                            isExpanded
                                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                          )}
                                          {event.type === "call" && event.id && (
                                            <Link href={`/consultant/voice-calls/${event.id}`}>
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                                                <ExternalLink className="h-3 w-3" />
                                              </Button>
                                            </Link>
                                          )}
                                        </div>
                                      </div>

                                      {isExpanded && event.type === "call" && event.id && (
                                        <div className="mt-3 pt-3 border-t space-y-3">
                                          {event.has_transcript && (
                                            <div>
                                              <div className="text-sm font-medium mb-1 flex items-center gap-1.5">
                                                <MessageSquare className="h-3.5 w-3.5" />Trascrizione
                                              </div>
                                              <TimelineCallTranscript callId={event.id} />
                                            </div>
                                          )}
                                          {event.has_recording && (
                                            <div>
                                              <div className="text-sm font-medium mb-1 flex items-center gap-1.5">
                                                <Volume2 className="h-3.5 w-3.5" />Registrazione
                                              </div>
                                              <TimelineCallRecording callId={event.id} />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="mt-4">
                    {calls.length === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nessuna chiamata registrata per questo numero</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {calls.map((call) => {
                          const st = CALL_STATUS[call.status] || CALL_STATUS.ended;
                          const StIcon = st.icon;
                          const isExpanded = expandedCalls.has(call.id);
                          const isInbound = call.call_direction === "inbound" || (!call.call_direction && call.caller_id === contact.phone);

                          return (
                            <Collapsible key={call.id} open={isExpanded} onOpenChange={() => toggleCallExpanded(call.id)}>
                              <Card className="overflow-hidden">
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${st.color}`}>
                                      <StIcon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">
                                          {isInbound ? "Chiamata in entrata" : "Chiamata in uscita"}
                                        </span>
                                        <Badge variant="outline" className="text-xs">{st.label}</Badge>
                                        {call.outcome && (
                                          <Badge variant="secondary" className="text-xs">{call.outcome}</Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                        {call.started_at && (
                                          <span>{format(new Date(call.started_at), "dd/MM/yyyy HH:mm", { locale: it })}</span>
                                        )}
                                        {call.duration_seconds != null && call.duration_seconds > 0 && (
                                          <span className="flex items-center gap-0.5">
                                            <Clock className="h-3 w-3" />
                                            {formatDuration(call.duration_seconds)}
                                          </span>
                                        )}
                                        {call.ai_mode && (
                                          <span className="capitalize">AI: {call.ai_mode}</span>
                                        )}
                                      </div>
                                    </div>
                                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <Separator />
                                  <div className="p-4 space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Chiamante:</span>
                                        <span className="ml-2 font-mono">{call.caller_id}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Chiamato:</span>
                                        <span className="ml-2 font-mono">{call.called_number}</span>
                                      </div>
                                      {call.hangup_cause && (
                                        <div>
                                          <span className="text-muted-foreground">Causa riattacco:</span>
                                          <span className="ml-2">{call.hangup_cause}</span>
                                        </div>
                                      )}
                                    </div>

                                    {call.full_transcript && (
                                      <div>
                                        <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
                                          <MessageSquare className="h-4 w-4" />
                                          Trascrizione
                                        </div>
                                        <ScrollArea className="h-[250px]">
                                          <div className="whitespace-pre-wrap font-mono text-xs bg-muted/50 p-3 rounded-lg">
                                            {call.full_transcript}
                                          </div>
                                        </ScrollArea>
                                      </div>
                                    )}

                                    {call.recording_url && (
                                      <div>
                                        <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
                                          <Volume2 className="h-4 w-4" />
                                          Registrazione
                                        </div>
                                        <audio controls className="w-full">
                                          <source src={`/api/voice/recording/${call.id}?token=${localStorage.getItem('token') || ''}`} type="audio/wav" />
                                        </audio>
                                      </div>
                                    )}

                                    <div className="flex gap-2 justify-end">
                                      <Link href={`/consultant/voice-calls/${call.id}`}>
                                        <Button variant="outline" size="sm">
                                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                          Dettaglio Completo
                                        </Button>
                                      </Link>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </Card>
                            </Collapsible>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="scheduled" className="mt-4">
                    {scheduledCalls.length === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nessuna chiamata programmata per questo numero</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {scheduledCalls.map((sc) => {
                          const st = CALL_STATUS[sc.status] || CALL_STATUS.pending;
                          const StIcon = st.icon;
                          const attemptsLog = sc.attempts_log || [];
                          return (
                            <Card key={sc.id}>
                              <div className="flex items-center gap-3 p-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${st.color}`}>
                                  <StIcon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">{st.label}</Badge>
                                    {sc.instruction_type && (
                                      <Badge variant="secondary" className="text-xs capitalize">{sc.instruction_type}</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                    <span>{format(new Date(sc.scheduled_at), "dd/MM/yyyy HH:mm", { locale: it })}</span>
                                    <span>Tentativi: {sc.attempts}/{sc.max_attempts}</span>
                                    {sc.duration_seconds != null && sc.duration_seconds > 0 && (
                                      <span>{formatDuration(sc.duration_seconds)}</span>
                                    )}
                                  </div>
                                  {sc.call_instruction && (
                                    <p className="text-xs text-muted-foreground mt-1 truncate">{sc.call_instruction}</p>
                                  )}
                                  {sc.retry_reason && (
                                    <p className="text-xs text-orange-600 mt-1">{sc.retry_reason}</p>
                                  )}

                                  {attemptsLog.length > 0 && (
                                    <div className="mt-2 pt-2 border-t">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Log tentativi:</p>
                                      <div className="flex flex-wrap items-center gap-1">
                                        {attemptsLog.map((entry: any, i: number) => {
                                          const entryCfg = TIMELINE_CONFIG[entry.status] || TIMELINE_CONFIG.ended;
                                          const EntryIcon = entryCfg.icon;
                                          const entryLabel = CALL_STATUS[entry.status]?.label || entry.status;
                                          return (
                                            <span key={i} className="inline-flex items-center gap-1">
                                              {i > 0 && <span className="text-muted-foreground mx-0.5">→</span>}
                                              <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded ${entryCfg.bgColor}`}>
                                                <EntryIcon className={`h-3 w-3 ${entryCfg.color}`} />
                                                <span>Tent. {entry.attempt}: {entryLabel}</span>
                                                {entry.timestamp && (
                                                  <span className="text-muted-foreground">
                                                    ({format(new Date(entry.timestamp), "HH:mm", { locale: it })})
                                                  </span>
                                                )}
                                              </span>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <Link href={`/consultant/voice-calls/${sc.id}`}>
                                  <Button variant="ghost" size="sm">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="technical" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Dettagli Tecnici</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <span className="text-muted-foreground">Telefono:</span>
                            <span className="ml-2 font-mono">{contact.phone}</span>
                          </div>
                          {contact.userId && (
                            <div>
                              <span className="text-muted-foreground">User ID:</span>
                              <span className="ml-2 font-mono text-xs">{contact.userId}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Chiamate totali:</span>
                            <span className="ml-2 font-medium">{calls.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Programmate totali:</span>
                            <span className="ml-2 font-medium">{scheduledCalls.length}</span>
                          </div>
                        </div>
                        {calls.length > 0 && (
                          <>
                            <Separator />
                            <div className="text-muted-foreground text-xs">Ultima chiamata</div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <span className="text-muted-foreground">Call ID:</span>
                                <span className="ml-2 font-mono text-xs break-all">{calls[0].id}</span>
                              </div>
                              {calls[0].freeswitch_uuid && (
                                <div>
                                  <span className="text-muted-foreground">FS UUID:</span>
                                  <span className="ml-2 font-mono text-xs break-all">{calls[0].freeswitch_uuid}</span>
                                </div>
                              )}
                              {calls[0].ai_conversation_id && (
                                <div className="sm:col-span-2">
                                  <span className="text-muted-foreground">AI Conv ID:</span>
                                  <span className="ml-2 font-mono text-xs break-all">{calls[0].ai_conversation_id}</span>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="space-y-4">

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Profilo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono">{contact.phone}</span>
                    </div>
                    {contact.name && (
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{contact.name}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.userId && (
                      <Link href={`/consultant/clients/${contact.userId}`}>
                        <Button variant="outline" size="sm" className="w-full mt-2">
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Vai al Profilo Cliente
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>

                {hunterContext && (
                  <Card className="border-blue-200 dark:border-blue-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Search className="h-4 w-4 text-blue-600" />
                        Dati Hunter
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {hunterContext.score !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Score</span>
                          <Badge variant={hunterContext.score >= 70 ? "default" : hunterContext.score >= 40 ? "secondary" : "outline"}>
                            {hunterContext.score}/100
                          </Badge>
                        </div>
                      )}
                      {hunterContext.businessName && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{hunterContext.businessName}</span>
                        </div>
                      )}
                      {hunterContext.sector && (
                        <div className="flex items-center gap-2">
                          <Target className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{hunterContext.sector}</span>
                        </div>
                      )}
                      {hunterContext.website && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <a href={hunterContext.website.startsWith("http") ? hunterContext.website : `https://${hunterContext.website}`}
                             target="_blank" rel="noopener noreferrer"
                             className="text-blue-600 hover:underline truncate">
                            {hunterContext.website}
                          </a>
                        </div>
                      )}
                      {hunterContext.leadStatus && (
                        <div className="flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <Badge variant="outline" className="capitalize">{hunterContext.leadStatus}</Badge>
                        </div>
                      )}
                      {hunterContext.aiSalesSummary && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs">
                          {hunterContext.aiSalesSummary}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {proactiveLead && (
                  <Card className="border-violet-200 dark:border-violet-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4 text-violet-600" />
                        Lead Proattivo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {proactiveLead.lead_name && (
                        <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{proactiveLead.lead_name}</span></div>
                      )}
                      {proactiveLead.source && (
                        <div><span className="text-muted-foreground">Fonte:</span> <span>{proactiveLead.source}</span></div>
                      )}
                      {proactiveLead.outreach_status && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Stato:</span>
                          <Badge variant="outline" className="capitalize">{proactiveLead.outreach_status}</Badge>
                        </div>
                      )}
                      {proactiveLead.objectives && (
                        <div className="mt-1">
                          <span className="text-muted-foreground text-xs">Obiettivi:</span>
                          <p className="text-xs mt-0.5">{proactiveLead.objectives}</p>
                        </div>
                      )}
                      {proactiveLead.desires && (
                        <div className="mt-1">
                          <span className="text-muted-foreground text-xs">Desideri:</span>
                          <p className="text-xs mt-0.5">{proactiveLead.desires}</p>
                        </div>
                      )}
                      {proactiveLead.hook && (
                        <div className="mt-1">
                          <span className="text-muted-foreground text-xs">Uncino:</span>
                          <p className="text-xs mt-0.5">{proactiveLead.hook}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {nextRetry && (
                  <Card className="border-orange-200 dark:border-orange-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Timer className="h-4 w-4 text-orange-600" />
                        Prossimo Retry
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Stato</span>
                        <Badge variant="outline" className="capitalize">
                          {CALL_STATUS[nextRetry.status]?.label || nextRetry.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tentativi</span>
                        <span className="font-medium">{nextRetry.attempts}/{nextRetry.max_attempts}</span>
                      </div>
                      {nextRetry.next_retry_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Prossimo</span>
                          <span className="font-medium text-orange-600">
                            {formatDistanceToNow(new Date(nextRetry.next_retry_at), { addSuffix: true, locale: it })}
                          </span>
                        </div>
                      )}
                      {nextRetry.retry_reason && (
                        <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded text-xs">
                          {nextRetry.retry_reason}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Riepilogo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chiamate</span>
                      <span className="font-medium">{safeStats.totalCalls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" /> Completate
                      </span>
                      <span className="font-medium">{safeStats.completed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <PhoneMissed className="h-3 w-3 text-red-500" /> Non risponde
                      </span>
                      <span className="font-medium">{safeStats.noAnswer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <PhoneOff className="h-3 w-3 text-orange-500" /> Occupato
                      </span>
                      <span className="font-medium">{safeStats.busy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-yellow-600" /> Brevi
                      </span>
                      <span className="font-medium">{safeStats.shortCall}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Volume2 className="h-3 w-3 text-purple-500" /> Segreteria
                      </span>
                      <span className="font-medium">{safeStats.voicemail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <PhoneMissed className="h-3 w-3 text-red-600" /> Fallite
                      </span>
                      <span className="font-medium">{safeStats.failed}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tempo totale</span>
                      <span className="font-medium">{formatDuration(safeStats.totalDuration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Durata media</span>
                      <span className="font-medium">{formatDuration(safeStats.avgDuration)}</span>
                    </div>
                    {safeStats.lastContact && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ultimo contatto</span>
                        <span className="text-xs">
                          {formatDistanceToNow(new Date(safeStats.lastContact), { addSuffix: true, locale: it })}
                        </span>
                      </div>
                    )}
                    {safeStats.firstContact && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Primo contatto</span>
                        <span className="text-xs">
                          {format(new Date(safeStats.firstContact), "dd/MM/yyyy", { locale: it })}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {recentTimelineEvents.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Attività Recente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {recentTimelineEvents.map((event, idx) => {
                        const cfg = getTimelineEventConfig(event);
                        const EventIcon = cfg.icon;
                        const desc = getTimelineEventDescription(event);
                        return (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bgColor}`}>
                              <EventIcon className={`h-3 w-3 ${cfg.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{desc}</p>
                              {event.timestamp && (
                                <p className="text-muted-foreground">
                                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true, locale: it })}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function TimelineCallTranscript({ callId }: { callId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/voice/call-transcript", callId],
    queryFn: async () => {
      const res = await fetch(`/api/voice/calls/${callId}`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.call?.full_transcript || null;
    },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline mr-1" />Caricamento...</div>;
  if (!data) return <div className="text-xs text-muted-foreground">Trascrizione non disponibile</div>;

  return (
    <ScrollArea className="h-[200px]">
      <div className="whitespace-pre-wrap font-mono text-xs bg-muted/50 p-2 rounded">{data}</div>
    </ScrollArea>
  );
}

function TimelineCallRecording({ callId }: { callId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/voice/call-recording", callId],
    queryFn: async () => {
      const res = await fetch(`/api/voice/calls/${callId}`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.call?.recording_url ? true : false;
    },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline mr-1" />Caricamento...</div>;
  if (!data) return <div className="text-xs text-muted-foreground">Registrazione non disponibile</div>;

  const token = localStorage.getItem('token') || '';
  return <audio controls className="w-full h-8"><source src={`/api/voice/recording/${callId}?token=${token}`} type="audio/wav" /></audio>;
}
