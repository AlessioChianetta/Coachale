import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  PhoneMissed,
  PhoneForwarded,
  Clock,
  User,
  ArrowLeft,
  Loader2,
  RefreshCw,
  MessageSquare,
  FileText,
  Calendar,
  DollarSign,
  Activity,
  CheckCircle,
  AlertCircle,
  Ban,
  Volume2,
  CalendarCheck,
  ExternalLink,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface VoiceCall {
  id: string;
  caller_id: string;
  called_number: string;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  consultant_id: string | null;
  freeswitch_uuid: string;
  freeswitch_channel: string | null;
  status: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  talk_time_seconds: number | null;
  ai_conversation_id: string | null;
  ai_mode: string | null;
  prompt_used: string | null;
  full_transcript: string | null;
  transcript_chunks: any[] | null;
  recording_url: string | null;
  outcome: string | null;
  transfer_target: string | null;
  telephony_minutes: number | null;
  ai_tokens_used: number | null;
  ai_cost_estimate: number | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface VoiceCallEvent {
  id: string;
  call_id: string;
  event_type: string;
  event_data: Record<string, any> | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  ringing: { label: "In Arrivo", icon: PhoneIncoming, color: "bg-yellow-500" },
  answered: { label: "Connessa", icon: Phone, color: "bg-blue-500" },
  talking: { label: "In Corso", icon: Phone, color: "bg-green-500" },
  completed: { label: "Completata", icon: CheckCircle, color: "bg-green-600" },
  failed: { label: "Fallita", icon: PhoneMissed, color: "bg-red-500" },
  transferred: { label: "Trasferita", icon: PhoneForwarded, color: "bg-purple-500" },
  ended: { label: "Terminata", icon: PhoneOff, color: "bg-gray-500" },
};

const EVENT_ICONS: Record<string, typeof Activity> = {
  call_start: PhoneIncoming,
  call_answer: Phone,
  call_end: PhoneOff,
  ai_response: MessageSquare,
  transfer_initiated: PhoneForwarded,
  error: AlertCircle,
};

export default function ConsultantVoiceCallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/voice/calls", id],
    queryFn: async () => {
      const res = await fetch(`/api/voice/calls/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento della chiamata");
      return res.json();
    },
    enabled: !!id,
  });

  const blockMutation = useMutation({
    mutationFn: async (callerId: string) => {
      const res = await fetch(`/api/voice/block/${encodeURIComponent(callerId)}`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Blocked from call detail", hours: 24 }),
      });
      if (!res.ok) throw new Error("Errore nel blocco");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Numero Bloccato", description: "Il numero è stato bloccato per 24 ore" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const call: VoiceCall | undefined = data?.call;
  const events: VoiceCallEvent[] = data?.events || [];

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Chiamata non trovata</h2>
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

  const statusConfig = STATUS_CONFIG[call.status] || STATUS_CONFIG.ended;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} role="consultant" />
      <div className={`flex-1 flex flex-col ${isMobile ? "w-full" : "ml-0"}`}>
        <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-6 lg:px-8 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <Link href="/consultant/voice-calls">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Phone className="h-6 w-6" />
                    Dettaglio Chiamata
                  </h1>
                  <p className="text-muted-foreground font-mono">{call.caller_id}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => refetch()} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Aggiorna
                </Button>
                <Button
                  onClick={() => blockMutation.mutate(call.caller_id)}
                  variant="destructive"
                  size="sm"
                  disabled={blockMutation.isPending}
                >
                  {blockMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Ban className="h-4 w-4 mr-2" />
                  )}
                  Blocca Numero
                </Button>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Informazioni Chiamata</CardTitle>
                    <Badge className={statusConfig.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-sm text-muted-foreground">Chiamante</div>
                      <div className="font-mono text-lg">{call.caller_id}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Numero Chiamato</div>
                      <div className="font-mono text-lg">{call.called_number}</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> {call.started_at ? "Inizio" : "Programmata"}
                      </div>
                      <div className="font-medium">
                        {call.started_at 
                          ? format(new Date(call.started_at), "dd/MM/yyyy HH:mm:ss", { locale: it })
                          : call.scheduled_at 
                            ? format(new Date(call.scheduled_at), "dd/MM/yyyy HH:mm:ss", { locale: it })
                            : "-"
                        }
                      </div>
                    </div>
                    {call.answered_at && (
                      <div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-4 w-4" /> Risposta
                        </div>
                        <div className="font-medium">
                          {format(new Date(call.answered_at), "HH:mm:ss", { locale: it })}
                        </div>
                      </div>
                    )}
                    {call.ended_at && (
                      <div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <PhoneOff className="h-4 w-4" /> Fine
                        </div>
                        <div className="font-medium">
                          {format(new Date(call.ended_at), "HH:mm:ss", { locale: it })}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-4 w-4" /> Durata Totale
                      </div>
                      <div className="text-2xl font-bold">{formatDuration(call.duration_seconds)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Volume2 className="h-4 w-4" /> Tempo Parlato
                      </div>
                      <div className="text-2xl font-bold">{formatDuration(call.talk_time_seconds)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Modalità AI</div>
                      <div className="font-medium capitalize">{call.ai_mode || "-"}</div>
                    </div>
                  </div>

                  {call.outcome && (
                    <>
                      <Separator />
                      <div>
                        <div className="text-sm text-muted-foreground">Esito</div>
                        <Badge variant="outline" className="text-lg px-3 py-1 mt-1">
                          {call.outcome}
                        </Badge>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {call.client_id ? (
                      <div className="space-y-2">
                        <div className="font-medium">{call.client_name || "Nome non disponibile"}</div>
                        {call.client_email && (
                          <div className="text-sm text-muted-foreground">{call.client_email}</div>
                        )}
                        {call.client_phone && (
                          <div className="text-sm font-mono">{call.client_phone}</div>
                        )}
                        <Link href={`/consultant/clients/${call.client_id}`}>
                          <Button variant="outline" size="sm" className="mt-2 w-full">
                            Vai al Profilo
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        Nessun cliente associato (numero non riconosciuto)
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Billing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Minuti Telefonia</span>
                      <span className="font-medium">{call.telephony_minutes?.toFixed(2) || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Token AI</span>
                      <span className="font-medium">{call.ai_tokens_used?.toLocaleString() || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Costo Stimato</span>
                      <span className="font-medium">
                        {call.ai_cost_estimate ? `€${call.ai_cost_estimate.toFixed(4)}` : "-"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Tabs defaultValue="transcript" className="w-full">
              <TabsList>
                <TabsTrigger value="transcript" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Trascrizione
                </TabsTrigger>
                <TabsTrigger value="events" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Eventi ({events.length})
                </TabsTrigger>
                <TabsTrigger value="technical" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Dettagli Tecnici
                </TabsTrigger>
              </TabsList>

              <TabsContent value="transcript">
                <Card>
                  <CardHeader>
                    <CardTitle>Trascrizione Chiamata</CardTitle>
                    <CardDescription>
                      Conversazione tra il cliente e l'assistente AI
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {call.full_transcript ? (
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="whitespace-pre-wrap font-mono text-sm">
                          {call.full_transcript}
                        </div>
                      </ScrollArea>
                    ) : call.transcript_chunks && call.transcript_chunks.length > 0 ? (
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                          {call.transcript_chunks.map((chunk: any, i: number) => (
                            <div key={i} className="space-y-1">
                              <div className="text-xs text-muted-foreground">
                                {chunk.speaker} - {chunk.timestamp}
                              </div>
                              <div className="bg-muted p-3 rounded-lg">{chunk.text}</div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nessuna trascrizione disponibile</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="events">
                <Card>
                  <CardHeader>
                    <CardTitle>Timeline Eventi</CardTitle>
                    <CardDescription>
                      Sequenza cronologica degli eventi della chiamata
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {events.length > 0 ? (
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                          {events.map((event) => {
                            const EventIcon = EVENT_ICONS[event.event_type] || Activity;
                            return (
                              <div key={event.id} className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                  <EventIcon className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium capitalize">
                                      {event.event_type.replace(/_/g, " ")}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(event.created_at), "HH:mm:ss", { locale: it })}
                                    </span>
                                  </div>
                                  {event.event_data && (
                                    <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                                      {JSON.stringify(event.event_data, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nessun evento registrato</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="technical">
                <Card>
                  <CardHeader>
                    <CardTitle>Dettagli Tecnici</CardTitle>
                    <CardDescription>
                      Informazioni tecniche e identificatori di sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-sm text-muted-foreground">Call ID</div>
                        <div className="font-mono text-sm break-all">{call.id}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">FreeSWITCH UUID</div>
                        <div className="font-mono text-sm break-all">{call.freeswitch_uuid}</div>
                      </div>
                      {call.freeswitch_channel && (
                        <div>
                          <div className="text-sm text-muted-foreground">Channel</div>
                          <div className="font-mono text-sm break-all">{call.freeswitch_channel}</div>
                        </div>
                      )}
                      {call.ai_conversation_id && (
                        <div>
                          <div className="text-sm text-muted-foreground">AI Conversation ID</div>
                          <div className="font-mono text-sm break-all">{call.ai_conversation_id}</div>
                        </div>
                      )}
                      {call.transfer_target && (
                        <div>
                          <div className="text-sm text-muted-foreground">Transfer Target</div>
                          <div className="font-mono text-sm">{call.transfer_target}</div>
                        </div>
                      )}
                      {call.recording_url && (
                        <div className="md:col-span-2">
                          <div className="text-sm text-muted-foreground mb-1">Recording URL</div>
                          <audio controls className="w-full">
                            <source src={call.recording_url} type="audio/wav" />
                            Il tuo browser non supporta l'audio.
                          </audio>
                        </div>
                      )}
                    </div>

                    {call.metadata && Object.keys(call.metadata).length > 0 && (
                      <>
                        <Separator className="my-4" />
                        {call.metadata.bookingCreated ? (
                          <div className="border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CalendarCheck className="h-5 w-5 text-green-600" />
                              <span className="font-semibold text-green-700 dark:text-green-400">Appuntamento Creato</span>
                              <Badge variant="default" className="bg-green-600 text-white text-[10px] ml-auto">
                                {call.metadata.bookingType === 'consultation' ? 'Consulenza' : 'Appuntamento'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">ID Prenotazione:</span>
                                <span className="ml-2 font-mono text-xs">{call.metadata.bookingId}</span>
                              </div>
                              {call.metadata.googleMeetLink && (
                                <div>
                                  <span className="text-muted-foreground">Google Meet:</span>
                                  <a
                                    href={call.metadata.googleMeetLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-blue-600 hover:underline inline-flex items-center gap-1"
                                  >
                                    Apri link <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm text-muted-foreground mb-2">Metadata</div>
                            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                              {JSON.stringify(call.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
