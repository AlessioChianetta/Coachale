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
  Search, Building2, Mail, Hash,
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

interface ContactData {
  contact: ContactProfile;
  calls: CallRecord[];
  scheduledCalls: ScheduledCall[];
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
  busy: { label: "Occupato", icon: PhoneOff, color: "bg-red-300" },
  cancelled: { label: "Annullata", icon: Ban, color: "bg-gray-400" },
};

const CONTACT_TYPE_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  client: { label: "Cliente", variant: "default" },
  lead: { label: "Lead", variant: "secondary" },
  known: { label: "Conosciuto", variant: "outline" },
  unknown: { label: "Sconosciuto", variant: "outline" },
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

export default function ConsultantVoiceCallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

  const decodedId = decodeURIComponent(id || "");
  const isPhoneNumber = /^\+?\d[\d\s\-()]{5,}$/.test(decodedId);
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

  const isLoading = resolvingPhone || loadingContact;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!contactData) {
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

  const { contact, calls, scheduledCalls, hunterContext, proactiveLead, nextRetry } = contactData;
  const typeBadge = CONTACT_TYPE_BADGES[contact.type] || CONTACT_TYPE_BADGES.unknown;
  const displayName = contact.name || contact.phone;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} role="consultant" />
      <div className={`flex-1 flex flex-col ${isMobile ? "w-full" : "ml-0"}`}>
        <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-4 lg:p-6 lg:px-8 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Header */}
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
                    </h1>
                    <p className="text-muted-foreground font-mono text-sm">{contact.phone}</p>
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

            {/* Main Layout: sidebar right + main area */}
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

              {/* Main Area */}
              <div className="space-y-4">
                <Tabs defaultValue="history" className="w-full">
                  <TabsList className="w-full justify-start">
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

                  {/* Storico Chiamate */}
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
                                          <source src={call.recording_url} type="audio/wav" />
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

                  {/* Chiamate Programmate */}
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

                  {/* Dettagli Tecnici */}
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

              {/* Sidebar Right */}
              <div className="space-y-4">

                {/* Card Profilo */}
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

                {/* Card Hunter */}
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

                {/* Card Proactive Lead */}
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

                {/* Card Prossimo Retry */}
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

                {/* Statistiche rapide */}
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
                      <span className="font-medium">{calls.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completate</span>
                      <span className="font-medium">{calls.filter(c => c.status === "completed").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fallite</span>
                      <span className="font-medium">{calls.filter(c => c.status === "failed").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tempo totale</span>
                      <span className="font-medium">
                        {formatDuration(calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0))}
                      </span>
                    </div>
                    {calls.length > 0 && calls[0].started_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ultima</span>
                        <span className="text-xs">
                          {formatDistanceToNow(new Date(calls[0].started_at), { addSuffix: true, locale: it })}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
