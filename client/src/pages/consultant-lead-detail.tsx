import React, { useState, useEffect, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Plus,
  PhoneCall,
  FileText,
  Presentation,
  Handshake,
  Clock,
  MessageSquare,
  Pencil,
  Trash2,
  CalendarDays,
  BarChart3,
  Activity,
  XCircle,
  AlertCircle,
  Crosshair,
  MessageCircle,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

interface LeadActivity {
  id: string;
  leadId: string;
  consultantId: string;
  type: string;
  title: string | null;
  description: string | null;
  outcome: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
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

const ACTIVITY_TYPES = [
  { value: "nota", label: "Nota", icon: FileText, color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950/20" },
  { value: "chiamata", label: "Chiamata", icon: PhoneCall, color: "text-green-500", bgColor: "bg-green-50 dark:bg-green-950/20" },
  { value: "whatsapp_inviato", label: "WhatsApp", icon: MessageCircle, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/20" },
  { value: "email_inviata", label: "Email inviata", icon: Mail, color: "text-cyan-500", bgColor: "bg-cyan-50 dark:bg-cyan-950/20" },
  { value: "discovery", label: "Discovery", icon: Presentation, color: "text-violet-500", bgColor: "bg-violet-50 dark:bg-violet-950/20" },
  { value: "demo", label: "Demo", icon: BarChart3, color: "text-amber-500", bgColor: "bg-amber-50 dark:bg-amber-950/20" },
  { value: "appuntamento", label: "Appuntamento", icon: CalendarDays, color: "text-rose-500", bgColor: "bg-rose-50 dark:bg-rose-950/20" },
  { value: "proposta", label: "Proposta", icon: ClipboardList, color: "text-indigo-500", bgColor: "bg-indigo-50 dark:bg-indigo-950/20" },
  { value: "chiusura", label: "Chiusura", icon: Handshake, color: "text-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-950/20" },
];

const OUTCOMES = [
  { value: "positivo", label: "Positivo", color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800" },
  { value: "neutro", label: "Neutro", color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800" },
  { value: "negativo", label: "Negativo", color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800" },
  { value: "non_risponde", label: "Non risponde", color: "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-950/20 dark:text-slate-400 dark:border-slate-800" },
  { value: "da_richiamare", label: "Da richiamare", color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800" },
  { value: "prenotato", label: "Prenotato", color: "text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-800" },
];

function getLeadStatusInfo(status: string | null) {
  return LEAD_STATUSES.find(s => s.value === (status || "nuovo")) || LEAD_STATUSES[0];
}

function getActivityType(type: string) {
  return ACTIVITY_TYPES.find(t => t.value === type) || ACTIVITY_TYPES[0];
}

function getOutcomeInfo(outcome: string | null) {
  if (!outcome) return null;
  return OUTCOMES.find(o => o.value === outcome);
}

function formatDateIT(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ieri";
  if (days < 7) return `${days}g fa`;
  return new Date(dateStr).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
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
  const [showAllPhones, setShowAllPhones] = useState(false);

  const [activeActivityTab, setActiveActivityTab] = useState("timeline");
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<LeadActivity | null>(null);

  const [newType, setNewType] = useState("nota");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOutcome, setNewOutcome] = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newCompletedAt, setNewCompletedAt] = useState("");

  const [hunterDialog, setHunterDialog] = useState<{
    open: boolean;
    channels: { voice: boolean; whatsapp: boolean; email: boolean };
    voiceTargetPhone: string;
    loading: boolean;
  }>({ open: false, channels: { voice: false, whatsapp: false, email: false }, voiceTargetPhone: "", loading: false });

  const { data: lead, isLoading } = useQuery<LeadResult>({
    queryKey: ["/api/lead-scraper/results", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/lead-scraper/results/${leadId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Lead not found");
      return res.json();
    },
    enabled: !!leadId,
  });

  const activityFilterType = activeActivityTab === "timeline" ? "all"
    : activeActivityTab === "note" ? "nota"
    : activeActivityTab === "chiamate" ? "chiamata"
    : activeActivityTab === "outreach" ? undefined
    : activeActivityTab === "disco_demo" ? undefined
    : activeActivityTab === "opportunita" ? undefined
    : "all";

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<LeadActivity[]>({
    queryKey: ["/api/lead-scraper/leads", leadId, "activities", activeActivityTab],
    queryFn: async () => {
      let url = `/api/lead-scraper/leads/${leadId}/activities`;
      if (activityFilterType && activityFilterType !== "all") {
        url += `?type=${activityFilterType}`;
      }
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!leadId,
  });

  const filteredActivities = useMemo(() => {
    if (activeActivityTab === "outreach") {
      return activities.filter(a => a.type === "chiamata" || a.type === "whatsapp_inviato" || a.type === "email_inviata");
    }
    if (activeActivityTab === "disco_demo") {
      return activities.filter(a => a.type === "discovery" || a.type === "demo" || a.type === "appuntamento");
    }
    if (activeActivityTab === "opportunita") {
      return activities.filter(a => a.type === "proposta" || a.type === "chiusura");
    }
    return activities;
  }, [activities, activeActivityTab]);

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
      toast({ title: "CRM aggiornato" });
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
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/lead-scraper/leads/${leadId}/activities`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore creazione attivita");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/leads", leadId, "activities"] });
      resetActivityForm();
      setShowNewActivity(false);
      toast({ title: "Attivita registrata" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare l'attivita", variant: "destructive" });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/lead-scraper/activities/${id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore aggiornamento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/leads", leadId, "activities"] });
      setEditingActivity(null);
      resetActivityForm();
      toast({ title: "Attivita aggiornata" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare l'attivita", variant: "destructive" });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lead-scraper/activities/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/leads", leadId, "activities"] });
      toast({ title: "Attivita eliminata" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare l'attivita", variant: "destructive" });
    },
  });

  const resetActivityForm = () => {
    setNewType("nota");
    setNewTitle("");
    setNewDescription("");
    setNewOutcome("");
    setNewScheduledAt("");
    setNewCompletedAt("");
  };

  const openEditActivity = (activity: LeadActivity) => {
    setEditingActivity(activity);
    setNewType(activity.type);
    setNewTitle(activity.title || "");
    setNewDescription(activity.description || "");
    setNewOutcome(activity.outcome || "");
    setNewScheduledAt(activity.scheduledAt ? activity.scheduledAt.slice(0, 16) : "");
    setNewCompletedAt(activity.completedAt ? activity.completedAt.slice(0, 16) : "");
    setShowNewActivity(true);
  };

  const handleSaveActivity = () => {
    const data = {
      type: newType,
      title: newTitle || null,
      description: newDescription || null,
      outcome: newOutcome || null,
      scheduledAt: newScheduledAt || null,
      completedAt: newCompletedAt || null,
    };
    if (editingActivity) {
      updateActivityMutation.mutate({ id: editingActivity.id, data });
    } else {
      createActivityMutation.mutate(data);
    }
  };

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

  const openHunterDialog = () => {
    setHunterDialog({
      open: true,
      channels: {
        voice: !!lead?.phone,
        whatsapp: !!lead?.phone,
        email: !!lead?.email,
      },
      voiceTargetPhone: lead?.phone || "",
      loading: false,
    });
  };

  const handleHunterSubmit = async () => {
    const ch = hunterDialog.channels;
    const selectedChannels: string[] = [];
    if (ch.voice) selectedChannels.push("voice");
    if (ch.whatsapp) selectedChannels.push("whatsapp");
    if (ch.email) selectedChannels.push("email");
    if (selectedChannels.length === 0) {
      toast({ title: "Seleziona almeno un canale", variant: "destructive" });
      return;
    }
    setHunterDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/ai-autonomy/hunter-single-lead", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          channels: selectedChannels,
          voiceTargetPhone: ch.voice ? (hunterDialog.voiceTargetPhone || lead?.phone || "") : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const created = data.results?.filter((r: any) => r.status !== "error").length || 0;
        const channelNames = data.results
          ?.filter((r: any) => r.status !== "error")
          .map((r: any) => r.channel === "voice" ? "Chiamata" : r.channel === "whatsapp" ? "WhatsApp" : "Email")
          .join(", ");
        toast({ title: `${created} task creati`, description: `Canali: ${channelNames}. Vai alla Coda Outreach per approvare.` });
        queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/leads", leadId, "activities"] });
        setHunterDialog(prev => ({ ...prev, open: false }));
      } else {
        toast({ title: "Errore", description: data.error || "Errore nella creazione dei task", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Errore", description: e.message || "Errore di connessione", variant: "destructive" });
    } finally {
      setHunterDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const activityStats = useMemo(() => {
    const counts: Record<string, number> = {};
    ACTIVITY_TYPES.forEach(t => { counts[t.value] = 0; });
    activities.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
    return counts;
  }, [activities]);

  if (isLoading) {
    return (
      <PageLayout role="consultant">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
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
      <div className="space-y-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-1.5" />Indietro
          </Button>
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-sm text-muted-foreground">Lead Scraper</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[300px]">{lead.businessName || "Lead"}</span>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 shadow-sm">
              <Building2 className="h-7 w-7 text-violet-600 dark:text-violet-400" />
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

          <div className="flex items-center gap-3">
            <Button
              onClick={openHunterDialog}
              className="bg-violet-600 hover:bg-violet-700 text-white shadow-md"
              title="Avvia Hunter per contattare questo lead su più canali"
            >
              <Crosshair className="h-4 w-4 mr-2" />
              Avvia Hunter
            </Button>

            {score !== null && score !== undefined && (
              <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${scoreBgColor}`}>
                <Target className={`h-5 w-5 ${scoreColor}`} />
                <div className="text-center">
                  <p className={`text-3xl font-black ${scoreColor}`}>{score}</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Score</p>
                </div>
                <div className="w-16 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${score}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-4">
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-violet-500" />Contatti
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {lead.address && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{lead.address}</span>
                  </div>
                )}
                {lead.website && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <Globe className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{lead.website}</a>
                  </div>
                )}
                {allEmails.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Email</p>
                    {allEmails.map((email: string, i: number) => (
                      <div key={i} className="flex items-center gap-2.5 cursor-pointer group" onClick={() => copyToClipboard(email)}>
                        <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-600 transition-colors truncate">{email}</span>
                      </div>
                    ))}
                  </div>
                )}
                {allPhones.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Telefoni</p>
                    {(showAllPhones ? allPhones : allPhones.slice(0, 2)).map((phone: string, i: number) => (
                      <div key={i} className="flex items-center gap-2.5 cursor-pointer group" onClick={() => copyToClipboard(phone)}>
                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-emerald-600 transition-colors">{phone}</span>
                      </div>
                    ))}
                    {allPhones.length > 2 && (
                      <button
                        onClick={() => setShowAllPhones(!showAllPhones)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mt-0.5 transition-colors"
                      >
                        {showAllPhones ? "Mostra meno" : `Mostra altri ${allPhones.length - 2} numeri`}
                      </button>
                    )}
                  </div>
                )}
                {lead.rating && (
                  <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800 w-fit">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    <span className="font-bold text-sm text-amber-700 dark:text-amber-400">{lead.rating}</span>
                    {lead.reviewsCount && <span className="text-xs text-amber-600/70 dark:text-amber-400/70">({lead.reviewsCount})</span>}
                  </div>
                )}

                {wd?.socialLinks && Object.keys(wd.socialLinks).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Social</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(wd.socialLinks).map(([platform, url]) => (
                        <button
                          key={platform}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          onClick={() => window.open(url as string, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" />{platform}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {lead.website && lead.scrapeStatus !== "scraped" && lead.scrapeStatus !== "scraped_cached" && (
                  <Button variant="outline" size="sm" className="w-full text-xs mt-2" onClick={() => scrapeWebsiteMutation.mutate()} disabled={scrapeWebsiteMutation.isPending}>
                    {scrapeWebsiteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    Analizza sito web
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-violet-500" />Gestione CRM
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Stato</Label>
                  <Select value={crmLeadStatus} onValueChange={setCrmLeadStatus}>
                    <SelectTrigger className="h-9 border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-violet-500"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Valore (EUR)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input type="number" placeholder="5000" value={crmValue} onChange={(e) => setCrmValue(e.target.value)} className="pl-8 h-9 border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-violet-500" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Prossima azione</Label>
                  <Input placeholder="es. Chiamare..." value={crmNextAction} onChange={(e) => setCrmNextAction(e.target.value)} className="h-9 border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Data azione</Label>
                  <Input type="date" value={crmNextActionDate} onChange={(e) => setCrmNextActionDate(e.target.value)} className="h-9 border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Note generali</Label>
                  <Textarea placeholder="Appunti sulla trattativa..." value={crmNotes} onChange={(e) => setCrmNotes(e.target.value)} className="min-h-[80px] border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-violet-500" />
                </div>
                {lead.leadContactedAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded-lg">
                    <Calendar className="h-3 w-3 text-blue-500" />
                    Primo contatto: {new Date(lead.leadContactedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                )}
                <Button onClick={handleSaveCrm} disabled={updateCrmMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700 text-white h-9">
                  {updateCrmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salva CRM
                </Button>
              </CardContent>
            </Card>

            {lead.aiSalesSummary && (
              <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-500" />Analisi AI
                      {score !== null && score !== undefined && <span className={`text-base font-black ${scoreColor}`}>{score}/100</span>}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => generateSummaryMutation.mutate()} disabled={generateSummaryMutation.isPending} className="text-xs h-6 text-violet-600">
                      {generateSummaryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                    {lead.aiSalesSummary.replace(/\*\*SCORE:\s*\d+\*\*\n?/, "")}
                  </div>
                  {lead.aiSalesSummaryGeneratedAt && (
                    <p className="text-[10px] text-violet-400 mt-2">
                      {formatDateIT(lead.aiSalesSummaryGeneratedAt)}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {!lead.aiSalesSummary && (lead.scrapeStatus === "scraped" || lead.scrapeStatus === "scraped_cached") && (
              <Button onClick={() => generateSummaryMutation.mutate()} disabled={generateSummaryMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                {generateSummaryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Genera analisi AI
              </Button>
            )}
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {ACTIVITY_TYPES.slice(0, 5).map(at => (
                  <div key={at.value} className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium", at.bgColor)}>
                    <at.icon className={cn("h-3 w-3", at.color)} />
                    <span>{activityStats[at.value] || 0}</span>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                onClick={() => { resetActivityForm(); setEditingActivity(null); setShowNewActivity(true); }}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />Nuova attivita
              </Button>
            </div>

            <Tabs value={activeActivityTab} onValueChange={setActiveActivityTab}>
              <TabsList className="w-full flex justify-start gap-0.5 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl overflow-x-auto">
                {[
                  { value: "timeline", label: "Timeline", icon: Activity },
                  { value: "outreach", label: "Outreach", icon: Crosshair },
                  { value: "note", label: "Note", icon: FileText },
                  { value: "chiamate", label: "Chiamate", icon: PhoneCall },
                  { value: "disco_demo", label: "Disco & Demo", icon: Presentation },
                  { value: "opportunita", label: "Opportunita", icon: Handshake },
                ].map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm rounded-lg px-3 text-xs">
                    <tab.icon className="h-3.5 w-3.5" />{tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="mt-3">
                {activitiesLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : filteredActivities.length === 0 ? (
                  <Card className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <CardContent className="py-12 text-center">
                      <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        {activeActivityTab === "timeline" ? "Nessuna attivita registrata" : `Nessuna ${activeActivityTab === "note" ? "nota" : activeActivityTab === "chiamate" ? "chiamata" : activeActivityTab === "outreach" ? "attivita outreach" : "attivita"} registrata`}
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">Registra la prima attivita per questo lead</p>
                      <Button size="sm" variant="outline" onClick={() => { resetActivityForm(); setNewType(activeActivityTab === "note" ? "nota" : activeActivityTab === "chiamate" ? "chiamata" : "nota"); setEditingActivity(null); setShowNewActivity(true); }}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Aggiungi
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="relative">
                    <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                    <div className="space-y-0">
                      {filteredActivities.map((activity) => {
                        const at = getActivityType(activity.type);
                        const outcomeInfo = getOutcomeInfo(activity.outcome);
                        const IconComp = at.icon;
                        return (
                          <div key={activity.id} className="relative pl-12 pr-0 py-3 group">
                            <div className={cn("absolute left-3 top-4 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-background z-10", at.bgColor)}>
                              <IconComp className={cn("h-3 w-3", at.color)} />
                            </div>

                            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", at.bgColor, at.color, "border-current/20")}>{at.label}</Badge>
                                    {outcomeInfo && (
                                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", outcomeInfo.color)}>{outcomeInfo.label}</Badge>
                                    )}
                                    {activity.scheduledAt && !activity.completedAt && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400">
                                        <Clock className="h-2.5 w-2.5 mr-0.5" />Programmato
                                      </Badge>
                                    )}
                                    {activity.completedAt && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400">
                                        <CheckCircle className="h-2.5 w-2.5 mr-0.5" />Completato
                                      </Badge>
                                    )}
                                  </div>
                                  {activity.title && (
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1.5">{activity.title}</p>
                                  )}
                                  {activity.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap leading-relaxed">{activity.description}</p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                                    <span>{timeAgo(activity.createdAt)}</span>
                                    {activity.scheduledAt && (
                                      <span className="flex items-center gap-0.5">
                                        <CalendarDays className="h-2.5 w-2.5" />
                                        {formatDateIT(activity.scheduledAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditActivity(activity)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteActivityMutation.mutate(activity.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Tabs>

            {wd && (wd.description || wd.services?.length > 0) && (
              <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />Dati dal sito web
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {wd.description && <ExpandableDescription text={wd.description} threshold={300} />}
                  {wd.services?.length > 0 && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Servizi</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {wd.services.map((svc: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px] bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">{svc}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showNewActivity} onOpenChange={(open) => { if (!open) { setShowNewActivity(false); setEditingActivity(null); resetActivityForm(); } }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-violet-500" />
              {editingActivity ? "Modifica attivita" : "Nuova attivita"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Tipo attivita</Label>
              <div className="grid grid-cols-4 gap-2">
                {ACTIVITY_TYPES.map(at => (
                  <button
                    key={at.value}
                    type="button"
                    onClick={() => setNewType(at.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all",
                      newType === at.value
                        ? `${at.bgColor} border-violet-400 dark:border-violet-500 shadow-sm ring-1 ring-violet-300 dark:ring-violet-700`
                        : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300"
                    )}
                  >
                    <at.icon className={cn("h-3.5 w-3.5", newType === at.value ? at.color : "text-gray-400")} />
                    <span className="text-[10px] leading-tight text-center">{at.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Titolo</Label>
              <Input placeholder="es. Prima chiamata con il responsabile..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-9" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Descrizione</Label>
              <Textarea placeholder="Dettagli dell'attivita, cosa e' emerso..." value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="min-h-[100px]" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Esito</Label>
              <div className="grid grid-cols-3 gap-2">
                {OUTCOMES.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setNewOutcome(newOutcome === o.value ? "" : o.value)}
                    className={cn(
                      "px-2 py-1.5 rounded-lg border text-xs font-medium transition-all text-center",
                      newOutcome === o.value ? `${o.color} shadow-sm ring-1 ring-current/30` : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Programmato per</Label>
                <Input type="datetime-local" value={newScheduledAt} onChange={(e) => setNewScheduledAt(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Completato il</Label>
                <Input type="datetime-local" value={newCompletedAt} onChange={(e) => setNewCompletedAt(e.target.value)} className="h-9" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewActivity(false); setEditingActivity(null); resetActivityForm(); }}>Annulla</Button>
            <Button onClick={handleSaveActivity} disabled={createActivityMutation.isPending || updateActivityMutation.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
              {(createActivityMutation.isPending || updateActivityMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingActivity ? "Aggiorna" : "Registra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={hunterDialog.open} onOpenChange={(open) => setHunterDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-violet-500" />
              Avvia Hunter — {lead?.businessName || "Lead"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Seleziona canali di contatto</Label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setHunterDialog(prev => ({ ...prev, channels: { ...prev.channels, voice: !prev.channels.voice } }))}
                  disabled={!lead?.phone}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    hunterDialog.channels.voice
                      ? "border-green-500 bg-green-50 dark:bg-green-950/20 shadow-sm"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300",
                    !lead?.phone && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <PhoneCall className={cn("h-6 w-6", hunterDialog.channels.voice ? "text-green-600" : "text-gray-400")} />
                  <span className={cn("text-xs font-medium", hunterDialog.channels.voice ? "text-green-700 dark:text-green-400" : "text-gray-500")}>Chiamata</span>
                  {!lead?.phone && <span className="text-[10px] text-red-400">No telefono</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setHunterDialog(prev => ({ ...prev, channels: { ...prev.channels, whatsapp: !prev.channels.whatsapp } }))}
                  disabled={!lead?.phone}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    hunterDialog.channels.whatsapp
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-sm"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300",
                    !lead?.phone && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <MessageCircle className={cn("h-6 w-6", hunterDialog.channels.whatsapp ? "text-emerald-600" : "text-gray-400")} />
                  <span className={cn("text-xs font-medium", hunterDialog.channels.whatsapp ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500")}>WhatsApp</span>
                  {!lead?.phone && <span className="text-[10px] text-red-400">No telefono</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setHunterDialog(prev => ({ ...prev, channels: { ...prev.channels, email: !prev.channels.email } }))}
                  disabled={!lead?.email}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    hunterDialog.channels.email
                      ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/20 shadow-sm"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300",
                    !lead?.email && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <Mail className={cn("h-6 w-6", hunterDialog.channels.email ? "text-cyan-600" : "text-gray-400")} />
                  <span className={cn("text-xs font-medium", hunterDialog.channels.email ? "text-cyan-700 dark:text-cyan-400" : "text-gray-500")}>Email</span>
                  {!lead?.email && <span className="text-[10px] text-red-400">No email</span>}
                </button>
              </div>
            </div>

            {hunterDialog.channels.voice && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Numero per la chiamata</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={hunterDialog.voiceTargetPhone}
                    onChange={(e) => setHunterDialog(prev => ({ ...prev, voiceTargetPhone: e.target.value }))}
                    placeholder="Numero di telefono"
                    className="pl-9 h-10"
                  />
                </div>
              </div>
            )}

            <div className="bg-violet-50 dark:bg-violet-950/20 rounded-lg p-3 border border-violet-200 dark:border-violet-800">
              <p className="text-xs text-violet-700 dark:text-violet-300">
                I task verranno creati in stato "in attesa di approvazione". Potrai approvarli dalla Coda Outreach.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHunterDialog(prev => ({ ...prev, open: false }))} disabled={hunterDialog.loading}>
              Annulla
            </Button>
            <Button
              onClick={handleHunterSubmit}
              disabled={hunterDialog.loading || ![hunterDialog.channels.voice, hunterDialog.channels.whatsapp, hunterDialog.channels.email].some(Boolean)}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {hunterDialog.loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crosshair className="h-4 w-4 mr-2" />}
              Avvia Hunter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

function cleanScrapedText(raw: string): string {
  let t = raw;
  t = t.replace(/\[(?:\s*)\]\(https?:\/\/[^)]+\)/g, "");
  t = t.replace(/\\\\/g, "\n");
  t = t.replace(/\\n/g, "\n");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/^\s*#+\s*/gm, "");
  t = t.replace(/^[-*]\s+/gm, "- ");
  t = t.replace(/[ \t]+$/gm, "");
  t = t.replace(/[ \t]{3,}/g, "  ");
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t.trim();
  return t;
}

function renderFormattedText(text: string): React.ReactNode[] {
  const cleaned = cleanScrapedText(text);
  const lines = cleaned.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  const renderLineWithLinks = (line: string, baseKey: number): React.ReactNode[] => {
    const urlRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s<>)"]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    let k = 0;

    while ((m = urlRegex.exec(line)) !== null) {
      if (m.index > lastIdx) {
        parts.push(line.slice(lastIdx, m.index));
      }
      const href = m[2] || m[3];
      const label = m[1] || (() => {
        try {
          const u = new URL(href);
          return u.hostname.replace(/^www\./, "");
        } catch { return href; }
      })();
      parts.push(
        <a key={`${baseKey}-l${k++}`} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
          {label}
        </a>
      );
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < line.length) {
      parts.push(line.slice(lastIdx));
    }
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      elements.push(<br key={key++} />);
      continue;
    }

    const isBullet = /^[-\u2022]\s+/.test(line);
    if (isBullet) {
      const bulletLines: string[] = [line];
      while (i + 1 < lines.length && /^[-\u2022]\s+/.test(lines[i + 1])) {
        i++;
        bulletLines.push(lines[i]);
      }
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-0.5 ml-1 my-1">
          {bulletLines.map((bl, bi) => (
            <li key={bi} className="text-sm text-gray-600 dark:text-gray-400">
              {renderLineWithLinks(bl.replace(/^[-\u2022]\s+/, ""), key + bi)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const isHeadingLike = line.length < 60 && !line.includes(".") && /^[A-Z\u00C0-\u00DC]/.test(line) && i > 0 && (lines[i - 1]?.trim() === "" || i === 0);
    if (isHeadingLike) {
      elements.push(
        <p key={key++} className="font-semibold text-gray-800 dark:text-gray-200 mt-1.5 mb-0.5">
          {renderLineWithLinks(line, key)}
        </p>
      );
    } else {
      elements.push(
        <p key={key++} className="text-sm text-gray-600 dark:text-gray-400">
          {renderLineWithLinks(line, key)}
        </p>
      );
    }
  }
  return elements;
}

function ExpandableDescription({ text, threshold = 400 }: { text: string; threshold?: number }) {
  const [expanded, setExpanded] = useState(false);
  const cleaned = cleanScrapedText(text);
  const isLong = cleaned.length > threshold;
  const displayText = isLong && !expanded ? cleaned.substring(0, threshold) + "..." : cleaned;

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
      <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Descrizione</Label>
      <div className="mt-1.5 space-y-0.5 leading-relaxed">
        {renderFormattedText(displayText)}
      </div>
      {isLong && (
        <Button variant="ghost" size="sm" className="mt-1.5 h-5 px-2 text-[10px] text-primary hover:text-primary/80" onClick={() => setExpanded(!expanded)}>
          {expanded ? <><ChevronUp className="h-3 w-3 mr-0.5" />Comprimi</> : <><ChevronDown className="h-3 w-3 mr-0.5" />Mostra tutto</>}
        </Button>
      )}
    </div>
  );
}
