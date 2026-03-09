import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Users,
  MessageCircle,
  FileText,
  Clock,
  Mail,
  Phone,
  User,
  Eye,
  CheckCircle2,
  Loader2,
  Search,
  ArrowLeft,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LeadSession {
  id: string;
  consultant_id: string;
  mode: string;
  status: string;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  is_public: boolean;
  public_token: string | null;
  created_at: string;
  updated_at: string;
  last_message: string | null;
}

interface SessionDetail {
  session: LeadSession;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    created_at: string;
  }>;
  report: any | null;
}

function statusLabel(status: string) {
  switch (status) {
    case "discovery": return "In Corso";
    case "elaborating": return "Elaborazione";
    case "completed": return "Completato";
    default: return status;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "discovery": return "bg-blue-400/15 text-blue-400 border-blue-400/30";
    case "elaborating": return "bg-amber-400/15 text-amber-400 border-amber-400/30";
    case "completed": return "bg-emerald-400/15 text-emerald-400 border-emerald-400/30";
    default: return "bg-slate-400/15 text-slate-400 border-slate-400/30";
  }
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "Ora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}g fa`;
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function cleanMessageContent(text: string) {
  return text
    .replace(/\[DISCOVERY_COMPLETE\]/g, "")
    .replace(/```json[\s\S]*?```/g, "")
    .trim();
}

export default function ConsultantLeadMagnets() {
  const { toast } = useToast();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: sessions = [], isLoading, refetch } = useQuery<LeadSession[]>({
    queryKey: ["lead-magnet-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/delivery-agent/lead-magnet-sessions", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    refetchInterval: 30000,
  });

  const loadSessionDetail = useCallback(async (sessionId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/consultant/delivery-agent/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setSessionDetail(data.data);
        setSelectedSession(sessionId);
      }
    } catch (err) {
      console.error("Error loading session detail:", err);
      toast({ title: "Errore", description: "Impossibile caricare i dettagli della sessione.", variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.lead_name && s.lead_name.toLowerCase().includes(q)) ||
      (s.lead_email && s.lead_email.toLowerCase().includes(q)) ||
      (s.lead_phone && s.lead_phone.includes(q))
    );
  });

  const stats = {
    total: sessions.length,
    inDiscovery: sessions.filter((s) => s.status === "discovery").length,
    elaborating: sessions.filter((s) => s.status === "elaborating").length,
    completed: sessions.filter((s) => s.status === "completed").length,
  };

  const copyLink = () => {
    const url = `${window.location.origin}/onboarding-gratuito`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiato!", description: "Il link del lead magnet è stato copiato negli appunti." });
  };

  if (selectedSession && sessionDetail) {
    return (
      <PageLayout>
        <SessionDetailView
          detail={sessionDetail}
          onBack={() => { setSelectedSession(null); setSessionDetail(null); }}
          loading={detailLoading}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen">
        <div className="relative overflow-hidden rounded-2xl mb-8" style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.3), transparent 50%), radial-gradient(circle at 80% 50%, rgba(6, 182, 212, 0.3), transparent 50%)" }} />
          <div className="relative p-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-3xl font-black tracking-tight text-white">Lead Magnet</h1>
                </div>
                <p className="text-slate-300 text-base">Gestisci tutti i lead che hanno iniziato l'onboarding gratuito</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={copyLink}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copia Link
                </Button>
                <a href="/onboarding-gratuito" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Apri Pagina
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Totale Lead", value: stats.total, icon: Users, gradient: "from-blue-500 to-indigo-500" },
            { label: "In Corso", value: stats.inDiscovery, icon: MessageCircle, gradient: "from-cyan-500 to-blue-500" },
            { label: "Elaborazione", value: stats.elaborating, icon: Clock, gradient: "from-amber-500 to-orange-500" },
            { label: "Completati", value: stats.completed, icon: CheckCircle2, gradient: "from-emerald-500 to-green-500" },
          ].map((stat) => (
            <Card key={stat.label} className="border-white/10 bg-white/5 dark:bg-slate-900/50 backdrop-blur">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-white/10">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-lg font-bold">Sessioni Lead Magnet</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cerca per nome, email, telefono..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm rounded-lg border border-white/15 bg-white/5 text-foreground placeholder:text-muted-foreground outline-none w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Caricamento...</span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-16">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                <p className="text-muted-foreground text-lg font-medium mb-2">
                  {searchQuery ? "Nessun risultato trovato" : "Nessun lead ancora"}
                </p>
                <p className="text-muted-foreground/70 text-sm">
                  {searchQuery ? "Prova a cercare con un altro termine" : "Condividi il link del lead magnet per iniziare a ricevere lead"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSessionDetail(session.id)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-white/8 hover:border-white/15 bg-white/3 hover:bg-white/6 cursor-pointer transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {session.lead_name ? session.lead_name.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {session.lead_name || "Anonimo"}
                        </span>
                        <Badge variant="outline" className={`text-[10px] px-2 py-0 ${statusColor(session.status)}`}>
                          {statusLabel(session.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {session.lead_email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3" />
                            {session.lead_email}
                          </span>
                        )}
                        {session.lead_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {session.lead_phone}
                          </span>
                        )}
                      </div>
                      {session.last_message && (
                        <p className="text-xs text-muted-foreground/70 mt-1 truncate max-w-md">
                          {cleanMessageContent(session.last_message).substring(0, 100)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{timeAgo(session.created_at)}</span>
                      <Eye className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

function SessionDetailView({ detail, onBack, loading }: { detail: SessionDetail; onBack: () => void; loading: boolean }) {
  const { session, messages, report } = detail;
  const [activeTab, setActiveTab] = useState(report ? "report" : "chat");

  const reportData = report?.report_json ? (typeof report.report_json === "string" ? JSON.parse(report.report_json) : report.report_json) : null;

  return (
    <div className="min-h-screen">
      <div className="mb-6">
        <Button variant="ghost" onClick={onBack} className="mb-4 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna alla lista
        </Button>

        <Card className="border-white/10">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl shrink-0">
                {session.lead_name ? session.lead_name.charAt(0).toUpperCase() : "?"}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-foreground mb-1">{session.lead_name || "Lead Anonimo"}</h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {session.lead_email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-4 h-4" />
                      {session.lead_email}
                    </span>
                  )}
                  {session.lead_phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4" />
                      {session.lead_phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {new Date(session.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className={`text-xs px-3 py-1 ${statusColor(session.status)}`}>
                {statusLabel(session.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="chat" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            Chat ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-2" disabled={!reportData}>
            <FileText className="w-4 h-4" />
            Report {reportData ? "" : "(non generato)"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <Card className="border-white/10">
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-6 space-y-4">
                  {messages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nessun messaggio</p>
                  ) : (
                    messages.map((msg) => {
                      const cleaned = cleanMessageContent(msg.content);
                      if (!cleaned) return null;
                      return (
                        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === "user"
                              ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-br-sm"
                              : "bg-slate-100 dark:bg-slate-800 text-foreground rounded-bl-sm"
                          }`}>
                            {cleaned}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          {reportData ? (
            <ReportView report={reportData} leadName={session.lead_name || "Lead"} />
          ) : (
            <Card className="border-white/10">
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                <p className="text-muted-foreground">Il report non è ancora stato generato per questo lead.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportView({ report, leadName }: { report: any; leadName: string }) {
  const lettera = report.lettera_personale || "";
  const diagnosi = report.diagnosi || {};
  const pacchetti = report.pacchetti_consigliati || [];
  const roadmap = report.roadmap || [];
  const quickWins = report.quick_wins || [];

  return (
    <div className="space-y-6">
      {lettera && (
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
              Lettera Personale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {typeof lettera === "string" ? lettera : JSON.stringify(lettera)}
            </p>
          </CardContent>
        </Card>
      )}

      {diagnosi && (diagnosi.dove_sei_ora || diagnosi.gap_analysis) && (
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Diagnosi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {diagnosi.dove_sei_ora && (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <h4 className="text-sm font-semibold text-emerald-500 mb-2">Dove Sei Ora</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{diagnosi.dove_sei_ora}</p>
              </div>
            )}
            {diagnosi.gap_analysis && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <h4 className="text-sm font-semibold text-amber-500 mb-2">Gap Analysis</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{diagnosi.gap_analysis}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {pacchetti.length > 0 && (
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Soluzioni AI Consigliate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pacchetti.map((pkg: any, i: number) => (
              <div key={i} className="p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-sm text-foreground">{pkg.nome || pkg.titolo || `Pacchetto ${i + 1}`}</h4>
                  {pkg.priorita && (
                    <Badge variant="outline" className={`text-[10px] ${
                      pkg.priorita === "Fondamenta" ? "border-emerald-500/30 text-emerald-500" :
                      pkg.priorita === "Core" ? "border-blue-500/30 text-blue-500" :
                      "border-purple-500/30 text-purple-500"
                    }`}>
                      {pkg.priorita}
                    </Badge>
                  )}
                </div>
                {pkg.perche_per_te && <p className="text-xs text-muted-foreground leading-relaxed mb-2">{pkg.perche_per_te}</p>}
                {pkg.primo_passo && (
                  <div className="text-xs text-emerald-500 bg-emerald-500/8 rounded-lg px-3 py-2 border border-emerald-500/15">
                    Primo passo: {pkg.primo_passo}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {roadmap.length > 0 && (
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Roadmap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {roadmap.map((phase: any, i: number) => (
              <div key={i} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 p-4 rounded-xl border border-white/8 bg-white/3">
                  <div className="font-semibold text-sm mb-1">{phase.titolo || phase.fase || `Fase ${i + 1}`}</div>
                  {phase.periodo && <div className="text-xs text-emerald-500 mb-2">{phase.periodo}</div>}
                  {phase.azioni && Array.isArray(phase.azioni) && (
                    <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                      {phase.azioni.map((a: string, j: number) => <li key={j}>{a}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {quickWins.length > 0 && (
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Quick Wins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickWins.map((qw: any, i: number) => (
              <div key={i} className="p-4 rounded-xl border border-amber-500/15 bg-amber-500/3">
                <div className="font-semibold text-sm text-amber-500 mb-1">{qw.titolo || qw.azione || `Quick Win ${i + 1}`}</div>
                {qw.descrizione && <p className="text-xs text-muted-foreground leading-relaxed">{qw.descrizione}</p>}
                {qw.tempo && (
                  <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">{qw.tempo}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
