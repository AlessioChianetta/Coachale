import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
  Target,
  Save,
  DollarSign,
  Calendar,
  ClipboardList,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface LeadResult {
  id: string;
  searchId: string;
  businessName: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: number | null;
  reviewsCount: number | null;
  category: string | null;
  websiteData: any;
  scrapeStatus: string | null;
  source: string | null;
  leadStatus: string | null;
  leadNotes: string | null;
  leadContactedAt: string | null;
  leadNextAction: string | null;
  leadNextActionDate: string | null;
  leadValue: number | null;
  aiSalesSummary: string | null;
  aiCompatibilityScore: number | null;
  aiSalesSummaryGeneratedAt: string | null;
  createdAt: string;
}

const LEAD_STATUSES = [
  { value: "nuovo", label: "Nuovo", color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700" },
  { value: "contattato", label: "Contattato", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
  { value: "in_trattativa", label: "In trattativa", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" },
  { value: "proposta_inviata", label: "Proposta inviata", color: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800" },
  { value: "chiuso_vinto", label: "Chiuso vinto", color: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
  { value: "chiuso_perso", label: "Chiuso perso", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
  { value: "non_interessato", label: "Non interessato", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
];

function getLeadStatusInfo(status: string | null) {
  return LEAD_STATUSES.find(s => s.value === (status || "nuovo")) || LEAD_STATUSES[0];
}

export default function ConsultantLeadDetail() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/consultant/lead-scraper/lead/:leadId");
  const leadId = params?.leadId;

  const [crmLeadStatus, setCrmLeadStatus] = useState("");
  const [crmNotes, setCrmNotes] = useState("");
  const [crmNextAction, setCrmNextAction] = useState("");
  const [crmNextActionDate, setCrmNextActionDate] = useState("");
  const [crmValue, setCrmValue] = useState("");

  const { data: lead, isLoading } = useQuery<LeadResult>({
    queryKey: ["/api/lead-scraper/results", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/lead-scraper/results/${leadId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Lead not found");
      return res.json();
    },
    enabled: !!leadId,
  });

  useEffect(() => {
    if (lead) {
      setCrmLeadStatus(lead.leadStatus || "nuovo");
      setCrmNotes(lead.leadNotes || "");
      setCrmNextAction(lead.leadNextAction || "");
      setCrmNextActionDate(lead.leadNextActionDate ? lead.leadNextActionDate.split("T")[0] : "");
      setCrmValue(lead.leadValue ? String(lead.leadValue) : "");
    }
  }, [lead]);

  const updateCrmMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/lead-scraper/results/${leadId}/crm`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore aggiornamento CRM");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/results", leadId] });
      toast({ title: "CRM aggiornato", description: "Dati lead salvati con successo" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare il CRM", variant: "destructive" });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/lead-scraper/results/${leadId}/generate-summary`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore generazione analisi");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/results", leadId] });
      toast({ title: "Analisi AI generata" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const scrapeWebsiteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/lead-scraper/results/${leadId}/scrape-website`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore scraping");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/results", leadId] });
      toast({ title: "Sito analizzato" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      toast({ title: "Copiato!", description: text });
    } catch {
      toast({ title: "Copiato!", description: text });
    }
  };

  const handleSaveCrm = () => {
    updateCrmMutation.mutate({
      leadStatus: crmLeadStatus,
      leadNotes: crmNotes,
      leadNextAction: crmNextAction,
      leadNextActionDate: crmNextActionDate || null,
      leadValue: crmValue ? parseFloat(crmValue) : null,
    });
  };

  if (isLoading) {
    return (
      <PageLayout role="consultant">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
        </div>
      </PageLayout>
    );
  }

  if (!lead) {
    return (
      <PageLayout role="consultant">
        <div className="text-center py-20">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Lead non trovato</h2>
          <Button variant="outline" onClick={() => setLocation("/consultant/lead-scraper")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Torna al Lead Scraper
          </Button>
        </div>
      </PageLayout>
    );
  }

  const statusInfo = getLeadStatusInfo(lead.leadStatus);
  const score = lead.aiCompatibilityScore;
  const scoreColor = score !== null && score !== undefined
    ? score >= 70 ? "text-emerald-600 dark:text-emerald-400"
    : score >= 40 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400"
    : "";
  const scoreBgColor = score !== null && score !== undefined
    ? score >= 70 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
    : score >= 40 ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
    : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
    : "";

  const wd = lead.websiteData as any;
  const allEmails = wd ? [...new Set([...(lead.email ? [lead.email] : []), ...(wd.emails || [])])] : (lead.email ? [lead.email] : []);
  const allPhones = wd ? [...new Set([...(lead.phone ? [lead.phone] : []), ...(wd.phones || [])])] : (lead.phone ? [lead.phone] : []);

  return (
    <PageLayout role="consultant">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />Indietro
          </Button>
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-sm text-muted-foreground">Lead Scraper</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[300px]">{lead.businessName || "Lead"}</span>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30 shadow-sm">
              <Building2 className="h-7 w-7 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{lead.businessName || "Lead senza nome"}</h1>
              <div className="flex items-center gap-2 mt-1">
                {lead.category && <span className="text-sm text-muted-foreground">{lead.category}</span>}
                <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                {lead.source === "google_search" && (
                  <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">Web</Badge>
                )}
              </div>
            </div>
          </div>

          {score !== null && score !== undefined && (
            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${scoreBgColor}`}>
              <Target className={`h-5 w-5 ${scoreColor}`} />
              <div className="text-center">
                <p className={`text-3xl font-black ${scoreColor}`}>{score}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Score</p>
              </div>
              <div className="w-16 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-rose-500" />
                  Informazioni di contatto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ContactBlock icon={<MapPin className="h-4 w-4 text-rose-500" />} label="Indirizzo" value={lead.address} />
                  <ContactBlock icon={<Globe className="h-4 w-4 text-purple-500" />} label="Sito Web" value={lead.website} link />
                </div>

                {allEmails.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Email ({allEmails.length})</Label>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {allEmails.map((email: string, i: number) => (
                        <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm py-1 px-2.5" onClick={() => copyToClipboard(email)}>
                          <Mail className="h-3.5 w-3.5 mr-1.5 text-blue-500" />{email}
                          <Copy className="h-3 w-3 ml-2 text-gray-400" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {allPhones.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Telefoni ({allPhones.length})</Label>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {allPhones.map((phone: string, i: number) => (
                        <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-sm py-1 px-2.5" onClick={() => copyToClipboard(phone)}>
                          <Phone className="h-3.5 w-3.5 mr-1.5 text-green-500" />{phone}
                          <Copy className="h-3 w-3 ml-2 text-gray-400" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {lead.rating && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      <span className="font-bold text-amber-700 dark:text-amber-400">{lead.rating}</span>
                      {lead.reviewsCount && (
                        <span className="text-sm text-amber-600/70 dark:text-amber-400/70">({lead.reviewsCount} recensioni)</span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {lead.aiSalesSummary && (
              <Card className="rounded-2xl border-2 border-violet-200 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/50 via-white to-purple-50/50 dark:from-violet-950/20 dark:via-gray-900 dark:to-purple-950/20 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      Analisi AI Sales Agent
                      {score !== null && score !== undefined && (
                        <span className={`text-lg font-black ${scoreColor}`}>{score}/100</span>
                      )}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => generateSummaryMutation.mutate()}
                      disabled={generateSummaryMutation.isPending}
                      className="text-xs h-7 text-violet-600 hover:text-violet-700 hover:bg-violet-100"
                    >
                      {generateSummaryMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Rigenera
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                    {lead.aiSalesSummary.replace(/\*\*SCORE:\s*\d+\*\*\n?/, "")}
                  </div>
                  {lead.aiSalesSummaryGeneratedAt && (
                    <p className="text-[10px] text-violet-400 mt-3">
                      Generato il {new Date(lead.aiSalesSummaryGeneratedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {!lead.aiSalesSummary && (lead.scrapeStatus === "scraped" || lead.scrapeStatus === "scraped_cached") && (
              <Card className="rounded-2xl border border-violet-200 dark:border-violet-800/40 shadow-sm">
                <CardContent className="py-6 text-center">
                  <Sparkles className="h-8 w-8 mx-auto mb-3 text-violet-400" />
                  <p className="text-sm text-muted-foreground mb-3">Nessuna analisi AI disponibile per questo lead</p>
                  <Button
                    onClick={() => generateSummaryMutation.mutate()}
                    disabled={generateSummaryMutation.isPending}
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
                  >
                    {generateSummaryMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generazione in corso...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" />Genera analisi AI Sales Agent</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {wd && (
              <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Dati estratti dal sito web
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {wd.description && <ExpandableDescription text={wd.description} threshold={500} />}

                  {wd.socialLinks && Object.keys(wd.socialLinks).length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Social</Label>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {Object.entries(wd.socialLinks).map(([platform, url]) => (
                          <Badge key={platform} variant="outline" className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors" onClick={() => window.open(url as string, "_blank")}>
                            <ExternalLink className="h-3 w-3 mr-1 text-purple-500" />{platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {wd.services?.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Servizi ({wd.services.length})</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {wd.services.map((svc: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">{svc}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {lead.website && lead.scrapeStatus !== "scraped" && lead.scrapeStatus !== "scraped_cached" && (
              <Button
                variant="outline"
                className="w-full border-purple-200 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                onClick={() => scrapeWebsiteMutation.mutate()}
                disabled={scrapeWebsiteMutation.isPending}
              >
                {scrapeWebsiteMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analisi in corso...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Analizza sito web</>
                )}
              </Button>
            )}
          </div>

          <div className="space-y-5">
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-rose-500" />
                  Gestione CRM
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Stato lead</Label>
                  <Select value={crmLeadStatus} onValueChange={setCrmLeadStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Valore potenziale (EUR)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="es. 5000"
                      value={crmValue}
                      onChange={(e) => setCrmValue(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Prossima azione</Label>
                  <Input
                    placeholder="es. Inviare email, chiamare..."
                    value={crmNextAction}
                    onChange={(e) => setCrmNextAction(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Data prossima azione</Label>
                  <Input
                    type="date"
                    value={crmNextActionDate}
                    onChange={(e) => setCrmNextActionDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Note</Label>
                  <Textarea
                    placeholder="Appunti sulla trattativa, dettagli del contatto..."
                    value={crmNotes}
                    onChange={(e) => setCrmNotes(e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>

                {lead.leadContactedAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded-lg">
                    <Calendar className="h-3 w-3 text-blue-500" />
                    Primo contatto: {new Date(lead.leadContactedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                )}

                <Button
                  onClick={handleSaveCrm}
                  disabled={updateCrmMutation.isPending}
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white"
                >
                  {updateCrmMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvataggio...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Salva CRM</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

function ContactBlock({ icon, label, value, link }: { icon: React.ReactNode; label: string; value: string | null; link?: boolean }) {
  if (!value) {
    return (
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
        {icon}
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-sm text-muted-foreground italic">Non disponibile</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {link ? (
          <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">
            {value}
          </a>
        ) : (
          <p className="text-sm truncate font-medium text-gray-900 dark:text-white">{value}</p>
        )}
      </div>
    </div>
  );
}

function ExpandableDescription({ text, threshold = 500 }: { text: string; threshold?: number }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > threshold;
  const displayText = isLong && !expanded ? text.substring(0, threshold) + "..." : text;

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
      <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Descrizione</Label>
      <p className="text-sm mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-line">{displayText}</p>
      {isLong && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-6 px-2 text-xs text-primary hover:text-primary/80"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3 mr-1" />Comprimi</>
          ) : (
            <><ChevronDown className="h-3 w-3 mr-1" />Mostra tutto ({text.length} caratteri)</>
          )}
        </Button>
      )}
    </div>
  );
}
