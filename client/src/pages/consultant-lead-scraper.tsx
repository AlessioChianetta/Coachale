import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  MapPin,
  Download,
  RefreshCw,
  ExternalLink,
  Phone,
  Mail,
  Star,
  Globe,
  Copy,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Building2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  Info,
  Zap,
  TrendingUp,
  Users,
  FileText,
  Map,
  Sparkles,
  Target,
  MessageSquare,
  Send,
  Save,
  DollarSign,
  Calendar,
  ClipboardList,
  Bot,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
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
  latitude: number | null;
  longitude: number | null;
  hours: any;
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

interface SearchRecord {
  id: string;
  consultantId: string;
  query: string;
  location: string;
  status: string;
  resultsCount: number | null;
  metadata: any;
  createdAt: string;
}

interface SalesContext {
  id?: string;
  servicesOffered: string;
  targetAudience: string;
  valueProposition: string;
  pricingInfo: string;
  competitiveAdvantages: string;
  idealClientProfile: string;
  salesApproach: string;
  caseStudies: string;
  additionalContext: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
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

function getScoreBadge(score: number | null) {
  if (score === null || score === undefined) return null;
  const color = score >= 70 ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400"
    : score >= 40 ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400";
  return (
    <Badge variant="outline" className={`${color} text-xs font-bold px-1.5 py-0 h-5`}>
      <Target className="h-2.5 w-2.5 mr-0.5" />{score}
    </Badge>
  );
}

export default function ConsultantLeadScraper() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("ricerca");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchLimit, setSearchLimit] = useState(20);
  const [searchEngine, setSearchEngine] = useState<"google_maps" | "google_search">("google_maps");
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<SearchResult | null>(null);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterRatingMin, setFilterRatingMin] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterLeadStatus, setFilterLeadStatus] = useState("tutti");
  const [showFilters, setShowFilters] = useState(false);

  const [crmLeadStatus, setCrmLeadStatus] = useState("");
  const [crmNotes, setCrmNotes] = useState("");
  const [crmNextAction, setCrmNextAction] = useState("");
  const [crmNextActionDate, setCrmNextActionDate] = useState("");
  const [crmValue, setCrmValue] = useState("");

  const [salesContext, setSalesContext] = useState<SalesContext>({
    servicesOffered: "", targetAudience: "", valueProposition: "", pricingInfo: "",
    competitiveAdvantages: "", idealClientProfile: "", salesApproach: "", caseStudies: "", additionalContext: "",
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [crmFilterStatus, setCrmFilterStatus] = useState("tutti");

  const { data: searches = [], isLoading: searchesLoading } = useQuery<SearchRecord[]>({
    queryKey: ["/api/lead-scraper/searches"],
    queryFn: async () => {
      const res = await fetch("/api/lead-scraper/searches", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch searches");
      return res.json();
    },
  });

  const buildResultsUrl = () => {
    if (!selectedSearchId) return null;
    const params = new URLSearchParams();
    if (filterHasEmail) params.set("has_email", "true");
    if (filterHasPhone) params.set("has_phone", "true");
    if (filterRatingMin) params.set("rating_min", filterRatingMin);
    if (filterCategory) params.set("category", filterCategory);
    if (filterSearch) params.set("search", filterSearch);
    if (filterLeadStatus !== "tutti") params.set("lead_status", filterLeadStatus);
    const qs = params.toString();
    return `/api/lead-scraper/searches/${selectedSearchId}/results${qs ? `?${qs}` : ""}`;
  };

  const resultsUrl = buildResultsUrl();

  const { data: results = [], isLoading: resultsLoading } = useQuery<SearchResult[]>({
    queryKey: [resultsUrl],
    queryFn: async () => {
      if (!resultsUrl) return [];
      const res = await fetch(resultsUrl, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
    enabled: !!resultsUrl,
  });

  const { data: allResults = [] } = useQuery<SearchResult[]>({
    queryKey: ["/api/lead-scraper/all-results", crmFilterStatus],
    queryFn: async () => {
      const params = crmFilterStatus !== "tutti" ? `?lead_status=${crmFilterStatus}` : "";
      const res = await fetch(`/api/lead-scraper/all-results${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch all results");
      return res.json();
    },
    enabled: activeTab === "crm",
  });

  const { data: savedSalesContext } = useQuery<SalesContext | null>({
    queryKey: ["/api/lead-scraper/sales-context"],
    queryFn: async () => {
      const res = await fetch("/api/lead-scraper/sales-context", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch sales context");
      return res.json();
    },
  });

  useEffect(() => {
    if (savedSalesContext) {
      setSalesContext({
        servicesOffered: savedSalesContext.servicesOffered || "",
        targetAudience: savedSalesContext.targetAudience || "",
        valueProposition: savedSalesContext.valueProposition || "",
        pricingInfo: savedSalesContext.pricingInfo || "",
        competitiveAdvantages: savedSalesContext.competitiveAdvantages || "",
        idealClientProfile: savedSalesContext.idealClientProfile || "",
        salesApproach: savedSalesContext.salesApproach || "",
        caseStudies: savedSalesContext.caseStudies || "",
        additionalContext: savedSalesContext.additionalContext || "",
      });
    }
  }, [savedSalesContext]);

  const selectedSearch = searches.find((s) => s.id === selectedSearchId);
  const isSearchRunning = selectedSearch?.status === "running" || selectedSearch?.status === "enriching";

  useEffect(() => {
    if (!isSearchRunning) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      if (resultsUrl) {
        queryClient.invalidateQueries({ queryKey: [resultsUrl] });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isSearchRunning, resultsUrl, queryClient]);

  const stats = useMemo(() => {
    const totalSearches = searches.length;
    const totalLeads = searches.reduce((acc, s) => acc + (s.resultsCount || 0), 0);
    const emailCount = results.filter(r => r.email).length;
    const phoneCount = results.filter(r => r.phone).length;
    return { totalSearches, totalLeads, emailCount, phoneCount };
  }, [searches, results]);

  useEffect(() => {
    if (selectedLead) {
      setCrmLeadStatus(selectedLead.leadStatus || "nuovo");
      setCrmNotes(selectedLead.leadNotes || "");
      setCrmNextAction(selectedLead.leadNextAction || "");
      setCrmNextActionDate(selectedLead.leadNextActionDate ? selectedLead.leadNextActionDate.split("T")[0] : "");
      setCrmValue(selectedLead.leadValue ? String(selectedLead.leadValue) : "");
    }
  }, [selectedLead]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const startSearchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/lead-scraper/search", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, location: searchLocation, limit: searchLimit, searchEngine }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Errore" }));
        throw new Error(err.error || "Errore nella ricerca");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedSearchId(data.searchId);
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      toast({ title: "Ricerca avviata", description: searchEngine === "google_search" ? "La ricerca su Google Search e' in corso..." : "La ricerca su Google Maps e' in corso..." });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const scrapeWebsiteMutation = useMutation({
    mutationFn: async (resultId: string) => {
      const res = await fetch(`/api/lead-scraper/results/${resultId}/scrape-website`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Errore" }));
        throw new Error(err.error || "Errore nello scraping");
      }
      return res.json();
    },
    onSuccess: () => {
      if (resultsUrl) queryClient.invalidateQueries({ queryKey: [resultsUrl] });
      toast({ title: "Sito analizzato", description: "I dati del sito sono stati estratti" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const deleteSearchMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const res = await fetch(`/api/lead-scraper/searches/${searchId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      if (selectedSearchId === deletedId) setSelectedSearchId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      toast({ title: "Ricerca eliminata" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare la ricerca", variant: "destructive" });
    },
  });

  const updateCrmMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/lead-scraper/results/${id}/crm`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore aggiornamento CRM");
      return res.json();
    },
    onSuccess: (updated) => {
      if (resultsUrl) queryClient.invalidateQueries({ queryKey: [resultsUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/all-results"] });
      setSelectedLead(updated);
      toast({ title: "CRM aggiornato", description: "Stato lead aggiornato con successo" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare il CRM", variant: "destructive" });
    },
  });

  const saveSalesContextMutation = useMutation({
    mutationFn: async (data: SalesContext) => {
      const res = await fetch("/api/lead-scraper/sales-context", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore salvataggio contesto");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/sales-context"] });
      toast({ title: "Contesto salvato", description: "Il tuo profilo vendita e' stato aggiornato" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile salvare il contesto vendita", variant: "destructive" });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async (resultId: string) => {
      const res = await fetch(`/api/lead-scraper/results/${resultId}/generate-summary`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore generazione analisi");
      return res.json();
    },
    onSuccess: (updated) => {
      if (resultsUrl) queryClient.invalidateQueries({ queryKey: [resultsUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/all-results"] });
      setSelectedLead(updated);
      toast({ title: "Analisi AI generata", description: "Il resoconto vendita e' pronto" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const generateBatchSummariesMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const res = await fetch(`/api/lead-scraper/searches/${searchId}/generate-summaries`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore generazione batch");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Analisi AI avviata", description: "I resoconti vendita verranno generati in background" });
      setTimeout(() => {
        if (resultsUrl) queryClient.invalidateQueries({ queryKey: [resultsUrl] });
      }, 10000);
    },
  });

  const handleExport = () => {
    if (!selectedSearchId) return;
    const url = `/api/lead-scraper/searches/${selectedSearchId}/export`;
    fetch(url, { headers: getAuthHeaders() })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.setAttribute("download", "");
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato!", description: text });
  };

  const handleSaveCrm = () => {
    if (!selectedLead) return;
    updateCrmMutation.mutate({
      id: selectedLead.id,
      data: {
        leadStatus: crmLeadStatus,
        leadNotes: crmNotes,
        leadNextAction: crmNextAction,
        leadNextActionDate: crmNextActionDate || null,
        leadValue: crmValue ? parseFloat(crmValue) : null,
      },
    });
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);

    try {
      const leadsContext = results.slice(0, 20).map(r => ({
        name: r.businessName,
        score: r.aiCompatibilityScore,
        status: r.leadStatus,
        email: r.email,
        phone: r.phone,
        category: r.category,
        summary: r.aiSalesSummary ? r.aiSalesSummary.substring(0, 300) : null,
      }));

      const systemCtx = [
        "Sei un AI Sales Agent esperto. Aiuti il consulente a gestire e contattare i lead trovati.",
        savedSalesContext?.servicesOffered ? `SERVIZI DEL CONSULENTE: ${savedSalesContext.servicesOffered}` : "",
        savedSalesContext?.targetAudience ? `TARGET: ${savedSalesContext.targetAudience}` : "",
        savedSalesContext?.valueProposition ? `PROPOSTA DI VALORE: ${savedSalesContext.valueProposition}` : "",
        `LEAD ATTUALI (${results.length} totali): ${JSON.stringify(leadsContext)}`,
        "Rispondi in italiano, sii pratico e orientato alla vendita. Puoi preparare email, suggerire approcci, analizzare lead specifici.",
      ].filter(Boolean).join("\n");

      const contents = [
        ...chatMessages.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
        { role: "user", parts: [{ text: userMsg }] },
      ];

      const res = await fetch("/api/lead-scraper/chat", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ systemContext: systemCtx, contents }),
      });

      if (!res.ok) throw new Error("Errore chat");
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", text: data.text || "Nessuna risposta" }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", text: "Errore nella comunicazione con l'AI. Riprova." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"><Loader2 className="h-3 w-3 animate-spin mr-1" />In corso</Badge>;
      case "enriching":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"><RefreshCw className="h-3 w-3 animate-spin mr-1" />Arricchimento</Badge>;
      case "completed":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"><CheckCircle className="h-3 w-3 mr-1" />Completata</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"><XCircle className="h-3 w-3 mr-1" />Fallita</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getScrapeStatusBadge = (status: string | null) => {
    switch (status) {
      case "scraped":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-1.5 py-0"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />OK</Badge>;
      case "scraped_cached":
        return <Badge className="bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 text-[10px] px-1.5 py-0"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Cache</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-1.5 py-0">In attesa</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0">Fallito</Badge>;
      case "no_website":
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">No sito</Badge>;
      default:
        return null;
    }
  };

  const openLeadDetail = (lead: SearchResult) => {
    setSelectedLead(lead);
    setShowLeadDetail(true);
  };

  const activeFiltersCount = [filterHasEmail, filterHasPhone, !!filterRatingMin, !!filterCategory, !!filterSearch, filterLeadStatus !== "tutti"].filter(Boolean).length;

  const clearFilters = () => {
    setFilterHasEmail(false);
    setFilterHasPhone(false);
    setFilterRatingMin("");
    setFilterCategory("");
    setFilterSearch("");
    setFilterLeadStatus("tutti");
  };

  return (
    <PageLayout role="consultant">
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl shadow-lg">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Lead Scraper
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Trova, analizza e gestisci i tuoi lead con AI Sales Agent
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative overflow-hidden rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)", boxShadow: "0 6px 24px rgba(244,63,94,0.3)" }}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 -translate-y-6 translate-x-6" style={{ background: "rgba(255,255,255,0.8)" }} />
            <div className="flex items-start justify-between">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                <Search className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black tracking-tight leading-none mt-2 mb-0.5">{stats.totalSearches}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75">Ricerche</p>
          </div>

          <div className="relative overflow-hidden rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", boxShadow: "0 6px 24px rgba(139,92,246,0.3)" }}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 -translate-y-6 translate-x-6" style={{ background: "rgba(255,255,255,0.8)" }} />
            <div className="flex items-start justify-between">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                <Building2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black tracking-tight leading-none mt-2 mb-0.5">{stats.totalLeads}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75">Lead Totali</p>
          </div>

          <div className="relative overflow-hidden rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", boxShadow: "0 6px 24px rgba(59,130,246,0.3)" }}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 -translate-y-6 translate-x-6" style={{ background: "rgba(255,255,255,0.8)" }} />
            <div className="flex items-start justify-between">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                <Mail className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black tracking-tight leading-none mt-2 mb-0.5">{stats.emailCount}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75">Email</p>
          </div>

          <div className="relative overflow-hidden rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 6px 24px rgba(16,185,129,0.3)" }}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 -translate-y-6 translate-x-6" style={{ background: "rgba(255,255,255,0.8)" }} />
            <div className="flex items-start justify-between">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                <Phone className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black tracking-tight leading-none mt-2 mb-0.5">{stats.phoneCount}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75">Telefoni</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex justify-start gap-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl">
            <TabsTrigger value="ricerca" className="flex items-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm rounded-lg px-4">
              <Search className="h-3.5 w-3.5" />Ricerca
            </TabsTrigger>
            <TabsTrigger value="crm" className="flex items-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm rounded-lg px-4">
              <ClipboardList className="h-3.5 w-3.5" />CRM Lead
            </TabsTrigger>
            <TabsTrigger value="agent" className="flex items-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm rounded-lg px-4">
              <Bot className="h-3.5 w-3.5" />Sales Agent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ricerca" className="mt-4">
            <div className="bg-gradient-to-r from-rose-50 via-pink-50 to-fuchsia-50 dark:from-rose-950/20 dark:via-pink-950/20 dark:to-fuchsia-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl overflow-hidden mb-4">
              <button
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-rose-100/50 dark:hover:bg-rose-900/20 transition-colors"
                onClick={() => setShowGuide(!showGuide)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                    <Info className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">Come funziona il Lead Scraper?</span>
                </div>
                {showGuide ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
              </button>
              {showGuide && (
                <div className="px-5 pb-5 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800/80 rounded-xl p-4 border border-rose-100 dark:border-rose-800/30 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center font-bold text-sm shadow-md">1</div>
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Cerca su Google</h4>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        Scegli <strong>Google Maps</strong> per attivita locali o <strong>Google Search</strong> per qualsiasi sito web.
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800/80 rounded-xl p-4 border border-purple-100 dark:border-purple-800/30 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-md">2</div>
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-white">AI analizza tutto</h4>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        Firecrawl estrae dati dal sito, poi l'AI Sales Agent genera un resoconto vendita con score di compatibilita per ogni azienda.
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800/80 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">3</div>
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Gestisci nel CRM</h4>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        Gestisci ogni lead con stati CRM, note, prossime azioni e parla con l'AI per strategie di vendita.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <Card className="border-2 border-rose-200 dark:border-rose-800/40 bg-gradient-to-br from-rose-50/50 via-white to-pink-50/50 dark:from-rose-950/20 dark:via-gray-900 dark:to-pink-950/20 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Search className="h-4 w-4 text-rose-500" />
                      Nuova Ricerca
                    </CardTitle>
                    <CardDescription>Cerca su Google Maps o Google Search</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Motore di ricerca</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSearchEngine("google_maps")}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                            searchEngine === "google_maps"
                              ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-700 shadow-sm"
                              : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                        >
                          <Map className="h-3.5 w-3.5" />
                          Google Maps
                        </button>
                        <button
                          type="button"
                          onClick={() => setSearchEngine("google_search")}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                            searchEngine === "google_search"
                              ? "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-700 shadow-sm"
                              : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                        >
                          <Globe className="h-3.5 w-3.5" />
                          Google Search
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="query" className="text-xs font-medium">Cosa cerchi</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="query"
                          placeholder={searchEngine === "google_search" ? "es. agenzia google ads settore food..." : "es. ristoranti, dentisti..."}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 border-rose-200 dark:border-rose-800/40 focus:border-rose-400 focus:ring-rose-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-xs font-medium">Localita</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="location"
                          placeholder="es. Milano, Roma..."
                          value={searchLocation}
                          onChange={(e) => setSearchLocation(e.target.value)}
                          className="pl-9 border-rose-200 dark:border-rose-800/40 focus:border-rose-400 focus:ring-rose-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs font-medium">Risultati max</Label>
                        <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{searchLimit}</span>
                      </div>
                      <Slider
                        value={[searchLimit]}
                        onValueChange={(v) => setSearchLimit(v[0])}
                        min={5}
                        max={100}
                        step={5}
                        className="[&_[role=slider]]:bg-rose-500"
                      />
                    </div>
                    <Button
                      className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                      onClick={() => startSearchMutation.mutate()}
                      disabled={!searchQuery || startSearchMutation.isPending}
                    >
                      {startSearchMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Avvio...</>
                      ) : (
                        <><Search className="h-4 w-4 mr-2" />{searchEngine === "google_search" ? "Cerca su Google" : "Cerca su Maps"}</>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      Storico Ricerche
                    </CardTitle>
                    <CardDescription>{searches.length} ricerche</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      {searchesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : searches.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm px-4">
                          <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p>Nessuna ricerca effettuata</p>
                          <p className="text-xs mt-1">Usa il form sopra per iniziare</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {searches.map((s) => (
                            <div
                              key={s.id}
                              className={`px-4 py-3 cursor-pointer transition-all duration-200 ${
                                selectedSearchId === s.id
                                  ? "bg-rose-50 dark:bg-rose-950/30 border-l-3 border-l-rose-500"
                                  : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              }`}
                              onClick={() => setSelectedSearchId(s.id)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{s.query}</p>
                                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-3 w-3" />{s.location || "Nessuna localita"}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    {(s as any).metadata?.params?.searchEngine === "google_search" ? (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 border-violet-300 text-violet-700 dark:border-violet-600 dark:text-violet-400">
                                        <Globe className="h-2.5 w-2.5" />Web
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-400">
                                        <Map className="h-2.5 w-2.5" />Maps
                                      </Badge>
                                    )}
                                    {getStatusBadge(s.status)}
                                    {s.resultsCount !== null && (
                                      <span className="text-xs text-muted-foreground font-medium">{s.resultsCount} risultati</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-gray-400 hover:text-red-500 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSearchMutation.mutate(s.id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selectedSearchId === s.id ? "rotate-90" : ""}`} />
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1.5">
                                {new Date(s.createdAt).toLocaleDateString("it-IT", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-3 space-y-4">
                {!selectedSearchId ? (
                  <Card className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30 flex items-center justify-center mb-4 shadow-sm">
                        <Building2 className="h-8 w-8 text-rose-400 dark:text-rose-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Seleziona o avvia una ricerca</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Usa il pannello a sinistra per cercare business. I risultati appariranno qui con dati, analisi AI e gestione CRM.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {selectedSearch && (
                      <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <CardContent className="py-4 px-5">
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30">
                                <Search className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-gray-900 dark:text-white">{selectedSearch.query}</h3>
                                  {selectedSearch.location && (
                                    <Badge variant="outline" className="text-xs border-rose-200 dark:border-rose-800">
                                      <MapPin className="h-3 w-3 mr-1" />{selectedSearch.location}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  {getStatusBadge(selectedSearch.status)}
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {results.length} risultati
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedSearch.status === "completed" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => generateBatchSummariesMutation.mutate(selectedSearchId!)}
                                  disabled={generateBatchSummariesMutation.isPending}
                                  className="border-amber-200 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-amber-700 transition-colors"
                                >
                                  {generateBatchSummariesMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <Sparkles className="h-4 w-4 mr-1" />
                                  )}
                                  Analisi AI
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className="relative border-gray-200 dark:border-gray-700 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                              >
                                <Filter className="h-4 w-4 mr-1" />
                                Filtri
                                {activeFiltersCount > 0 && (
                                  <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-rose-500">
                                    {activeFiltersCount}
                                  </Badge>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                                disabled={results.length === 0}
                                className="border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-700 transition-colors"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                CSV
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowChat(!showChat)}
                                className="border-gray-200 dark:border-gray-700 hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20 hover:text-violet-700 transition-colors"
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Chat AI
                              </Button>
                            </div>
                          </div>

                          {isSearchRunning && (
                            <div className="mt-3">
                              <Progress value={undefined} className="h-1.5" />
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {selectedSearch.status === "enriching"
                                  ? "Analisi siti web in corso..."
                                  : "Ricerca in corso..."}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {showChat && (
                      <Card className="rounded-2xl border border-violet-200 dark:border-violet-800/40 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Bot className="h-4 w-4 text-violet-500" />
                            AI Sales Agent Chat
                          </CardTitle>
                          <CardDescription className="text-xs">Chiedi strategie di vendita, email, analisi sui lead</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[250px] mb-3 border rounded-lg p-3">
                            {chatMessages.length === 0 && (
                              <div className="text-center text-muted-foreground text-xs py-8">
                                <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p>Inizia una conversazione con il Sales Agent</p>
                                <p className="mt-1">Es: "Qual e' il lead piu promettente?" o "Prepara una email per..."</p>
                              </div>
                            )}
                            {chatMessages.map((msg, i) => (
                              <div key={i} className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                                <div className={`inline-block max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                                  msg.role === "user"
                                    ? "bg-violet-100 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                }`}>
                                  <p className="whitespace-pre-wrap">{msg.text}</p>
                                </div>
                              </div>
                            ))}
                            {chatLoading && (
                              <div className="text-left mb-3">
                                <div className="inline-block px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                                </div>
                              </div>
                            )}
                            <div ref={chatEndRef} />
                          </ScrollArea>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Scrivi un messaggio..."
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                              className="flex-1"
                            />
                            <Button
                              size="icon"
                              onClick={handleSendChat}
                              disabled={!chatInput.trim() || chatLoading}
                              className="bg-violet-500 hover:bg-violet-600 text-white"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {showFilters && (
                      <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <CardContent className="py-4 px-5">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <Filter className="h-4 w-4 text-rose-500" />
                              Filtri
                            </h4>
                            {activeFiltersCount > 0 && (
                              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                                <X className="h-3 w-3 mr-1" />Rimuovi filtri
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox id="hasEmail" checked={filterHasEmail} onCheckedChange={(c) => setFilterHasEmail(!!c)} />
                              <Label htmlFor="hasEmail" className="text-sm">Ha email</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox id="hasPhone" checked={filterHasPhone} onCheckedChange={(c) => setFilterHasPhone(!!c)} />
                              <Label htmlFor="hasPhone" className="text-sm">Ha telefono</Label>
                            </div>
                            <Input placeholder="Rating min" value={filterRatingMin} onChange={(e) => setFilterRatingMin(e.target.value)} className="h-9" />
                            <Input placeholder="Categoria" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-9" />
                            <Input placeholder="Cerca nome..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} className="h-9" />
                            <Select value={filterLeadStatus} onValueChange={setFilterLeadStatus}>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Stato lead" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tutti">Tutti gli stati</SelectItem>
                                {LEAD_STATUSES.map(s => (
                                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                      <CardContent className="p-0">
                        {resultsLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
                          </div>
                        ) : results.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            {isSearchRunning ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
                                <p>Ricerca in corso, i risultati appariranno a breve...</p>
                              </div>
                            ) : "Nessun risultato trovato"}
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                  <TableHead className="min-w-[200px] font-semibold text-gray-700 dark:text-gray-300">Nome</TableHead>
                                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Telefono</TableHead>
                                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Email</TableHead>
                                  <TableHead className="text-center font-semibold text-gray-700 dark:text-gray-300">Rating</TableHead>
                                  <TableHead className="text-center font-semibold text-gray-700 dark:text-gray-300">Score</TableHead>
                                  <TableHead className="text-center font-semibold text-gray-700 dark:text-gray-300">Stato</TableHead>
                                  <TableHead className="text-center font-semibold text-gray-700 dark:text-gray-300">Scraping</TableHead>
                                  <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Azioni</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {results.map((r) => {
                                  const statusInfo = getLeadStatusInfo(r.leadStatus);
                                  return (
                                    <TableRow
                                      key={r.id}
                                      className="cursor-pointer hover:bg-rose-50/50 dark:hover:bg-rose-950/10 transition-colors duration-150 border-b border-gray-100 dark:border-gray-800"
                                      onClick={() => openLeadDetail(r)}
                                    >
                                      <TableCell className="font-medium text-gray-900 dark:text-white">
                                        <div className="flex items-center gap-1.5">
                                          <span className="line-clamp-1">{r.businessName || "\u2014"}</span>
                                          {r.source === "google_search" && (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">Web</Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {r.phone ? (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-green-50 dark:hover:bg-green-950/20" onClick={(e) => { e.stopPropagation(); copyToClipboard(r.phone!); }}>
                                                  <Phone className="h-3 w-3 mr-1 text-green-500" />
                                                  <span className="truncate max-w-[100px]">{r.phone}</span>
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>Copia telefono</TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        ) : <span className="text-xs text-muted-foreground">{"\u2014"}</span>}
                                      </TableCell>
                                      <TableCell>
                                        {r.email ? (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/20" onClick={(e) => { e.stopPropagation(); copyToClipboard(r.email!); }}>
                                                  <Mail className="h-3 w-3 mr-1 text-blue-500" />
                                                  <span className="truncate max-w-[120px]">{r.email}</span>
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>Copia email</TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        ) : <span className="text-xs text-muted-foreground">{"\u2014"}</span>}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {r.rating ? (
                                          <div className="flex items-center justify-center gap-1">
                                            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                            <span className="text-xs font-semibold">{r.rating}</span>
                                          </div>
                                        ) : <span className="text-xs text-muted-foreground">{"\u2014"}</span>}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {getScoreBadge(r.aiCompatibilityScore)}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusInfo.color}`}>
                                          {statusInfo.label}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          {getScrapeStatusBadge(r.scrapeStatus)}
                                          {(r.scrapeStatus === "scraped" || r.scrapeStatus === "scraped_cached") && r.websiteData && (
                                            <div className="flex items-center gap-0.5 ml-1">
                                              {(r.websiteData as any)?.emails?.length > 0 && <Mail className="h-3 w-3 text-blue-400" />}
                                              {(r.websiteData as any)?.phones?.length > 0 && <Phone className="h-3 w-3 text-green-400" />}
                                              {(r.websiteData as any)?.socialLinks && Object.keys((r.websiteData as any).socialLinks).length > 0 && <ExternalLink className="h-3 w-3 text-purple-400" />}
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          {r.website && r.scrapeStatus !== "scraped" && r.scrapeStatus !== "scraped_cached" && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-purple-50 dark:hover:bg-purple-950/20" onClick={(e) => { e.stopPropagation(); scrapeWebsiteMutation.mutate(r.id); }} disabled={scrapeWebsiteMutation.isPending}>
                                                    <RefreshCw className={`h-3 w-3 ${scrapeWebsiteMutation.isPending ? "animate-spin" : ""}`} />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Analizza sito web</TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); copyToClipboard([r.businessName, r.phone, r.email, r.website].filter(Boolean).join(" | ")); }}>
                                                  <Copy className="h-3 w-3" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>Copia dati</TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="crm" className="mt-4">
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-rose-500" />
                      CRM Lead
                    </CardTitle>
                    <CardDescription>Gestisci tutti i tuoi lead da tutte le ricerche</CardDescription>
                  </div>
                  <Select value={crmFilterStatus} onValueChange={setCrmFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtra per stato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tutti">Tutti gli stati</SelectItem>
                      {LEAD_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {allResults.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nessun lead trovato</p>
                    <p className="text-xs mt-1">Avvia una ricerca nella tab "Ricerca" per iniziare</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                          <TableHead className="font-semibold">Nome</TableHead>
                          <TableHead className="font-semibold">Email</TableHead>
                          <TableHead className="font-semibold">Telefono</TableHead>
                          <TableHead className="text-center font-semibold">Score</TableHead>
                          <TableHead className="text-center font-semibold">Stato</TableHead>
                          <TableHead className="font-semibold">Prossima azione</TableHead>
                          <TableHead className="text-right font-semibold">Valore</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allResults.map((r) => {
                          const statusInfo = getLeadStatusInfo(r.leadStatus);
                          return (
                            <TableRow
                              key={r.id}
                              className="cursor-pointer hover:bg-rose-50/50 dark:hover:bg-rose-950/10 transition-colors"
                              onClick={() => openLeadDetail(r)}
                            >
                              <TableCell className="font-medium">{r.businessName || "\u2014"}</TableCell>
                              <TableCell className="text-sm">{r.email || "\u2014"}</TableCell>
                              <TableCell className="text-sm">{r.phone || "\u2014"}</TableCell>
                              <TableCell className="text-center">{getScoreBadge(r.aiCompatibilityScore)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {r.leadNextAction ? (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {r.leadNextAction}
                                    {r.leadNextActionDate && <span className="text-[10px]">({new Date(r.leadNextActionDate).toLocaleDateString("it-IT")})</span>}
                                  </span>
                                ) : "\u2014"}
                              </TableCell>
                              <TableCell className="text-right">
                                {r.leadValue ? (
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    {r.leadValue.toLocaleString("it-IT")} EUR
                                  </span>
                                ) : "\u2014"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agent" className="mt-4">
            <Card className="rounded-2xl border-2 border-violet-200 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/50 via-white to-purple-50/50 dark:from-violet-950/20 dark:via-gray-900 dark:to-purple-950/20 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-violet-500" />
                  Configura il tuo Sales Agent
                </CardTitle>
                <CardDescription>
                  Inserisci il contesto del tuo business perche l'AI possa analizzare ogni azienda in base a cio che vendi e dare uno score di compatibilita accurato.
                  {savedSalesContext ? (
                    <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Configurato</Badge>
                  ) : (
                    <Badge className="ml-2 bg-amber-100 text-amber-700 border-amber-200">Non configurato</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-500" />Servizi che offri
                      </Label>
                      <Textarea
                        placeholder="Descrivi i servizi che vendi: consulenza marketing, sviluppo web, gestione social, SEO, formazione..."
                        value={salesContext.servicesOffered}
                        onChange={(e) => setSalesContext(p => ({ ...p, servicesOffered: e.target.value }))}
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-rose-500" />Target ideale
                      </Label>
                      <Textarea
                        placeholder="A chi vendi? PMI, startup, professionisti, e-commerce, ristoranti..."
                        value={salesContext.targetAudience}
                        onChange={(e) => setSalesContext(p => ({ ...p, targetAudience: e.target.value }))}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-violet-500" />Proposta di valore
                      </Label>
                      <Textarea
                        placeholder="Cosa ti rende unico? Perche un'azienda dovrebbe scegliere te?"
                        value={salesContext.valueProposition}
                        onChange={(e) => setSalesContext(p => ({ ...p, valueProposition: e.target.value }))}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-500" />Pricing / Pacchetti
                      </Label>
                      <Textarea
                        placeholder="Range prezzi, pacchetti disponibili, modalita di pagamento..."
                        value={salesContext.pricingInfo}
                        onChange={(e) => setSalesContext(p => ({ ...p, pricingInfo: e.target.value }))}
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-blue-500" />Vantaggi competitivi
                      </Label>
                      <Textarea
                        placeholder="Cosa fai meglio della concorrenza? Esperienza, risultati, tecnologia..."
                        value={salesContext.competitiveAdvantages}
                        onChange={(e) => setSalesContext(p => ({ ...p, competitiveAdvantages: e.target.value }))}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-indigo-500" />Profilo cliente ideale
                      </Label>
                      <Textarea
                        placeholder="Fatturato, numero dipendenti, settore, maturita digitale..."
                        value={salesContext.idealClientProfile}
                        onChange={(e) => setSalesContext(p => ({ ...p, idealClientProfile: e.target.value }))}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-cyan-500" />Approccio vendita
                      </Label>
                      <Textarea
                        placeholder="Come approcci il primo contatto? Email, chiamata, LinkedIn, referral..."
                        value={salesContext.salesApproach}
                        onChange={(e) => setSalesContext(p => ({ ...p, salesApproach: e.target.value }))}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 text-amber-500" />Casi di successo
                      </Label>
                      <Textarea
                        placeholder="Brevi case study: 'Per l'azienda X abbiamo aumentato il fatturato del 30%'..."
                        value={salesContext.caseStudies}
                        onChange={(e) => setSalesContext(p => ({ ...p, caseStudies: e.target.value }))}
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-gray-500" />Contesto aggiuntivo
                  </Label>
                  <Textarea
                    placeholder="Qualsiasi altra informazione utile per l'AI: tono di voce, vincoli, preferenze..."
                    value={salesContext.additionalContext}
                    onChange={(e) => setSalesContext(p => ({ ...p, additionalContext: e.target.value }))}
                    className="min-h-[60px]"
                  />
                </div>
                <div className="mt-6 flex justify-end">
                  <Button
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white border-0 shadow-lg"
                    onClick={() => saveSalesContextMutation.mutate(salesContext)}
                    disabled={saveSalesContextMutation.isPending}
                  >
                    {saveSalesContextMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvataggio...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" />Salva configurazione</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showLeadDetail} onOpenChange={setShowLeadDetail}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogDescription className="sr-only">Dettaglio lead e gestione CRM</DialogDescription>
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30">
                    <Building2 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{selectedLead.businessName || "Lead senza nome"}</span>
                      {getScoreBadge(selectedLead.aiCompatibilityScore)}
                    </div>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      {selectedLead.category || "Categoria non disponibile"}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoBlock icon={<MapPin className="h-4 w-4 text-rose-500" />} label="Indirizzo" value={selectedLead.address} />
                  <InfoBlock icon={<Phone className="h-4 w-4 text-green-500" />} label="Telefono" value={selectedLead.phone} copyable onCopy={() => selectedLead.phone && copyToClipboard(selectedLead.phone)} />
                  <InfoBlock icon={<Mail className="h-4 w-4 text-blue-500" />} label="Email" value={selectedLead.email} copyable onCopy={() => selectedLead.email && copyToClipboard(selectedLead.email)} />
                  <InfoBlock icon={<Globe className="h-4 w-4 text-purple-500" />} label="Sito Web" value={selectedLead.website} link />
                </div>

                <div className="flex items-center gap-4">
                  {selectedLead.rating && (
                    <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded-lg">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      <span className="font-bold text-amber-700 dark:text-amber-400">{selectedLead.rating}</span>
                      {selectedLead.reviewsCount && (
                        <span className="text-sm text-amber-600/70 dark:text-amber-400/70">({selectedLead.reviewsCount} recensioni)</span>
                      )}
                    </div>
                  )}
                  {getScrapeStatusBadge(selectedLead.scrapeStatus)}
                </div>

                {selectedLead.aiSalesSummary && (
                  <>
                    <Separator />
                    <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border border-violet-200 dark:border-violet-800/40 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold flex items-center gap-2 text-violet-900 dark:text-violet-200">
                          <Sparkles className="h-4 w-4 text-violet-500" />
                          Analisi AI Sales Agent
                          {selectedLead.aiCompatibilityScore && (
                            <span className={`ml-2 text-lg font-black ${
                              selectedLead.aiCompatibilityScore >= 70 ? "text-emerald-600" :
                              selectedLead.aiCompatibilityScore >= 40 ? "text-amber-600" : "text-red-600"
                            }`}>
                              {selectedLead.aiCompatibilityScore}/100
                            </span>
                          )}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => generateSummaryMutation.mutate(selectedLead.id)}
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
                      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                        {selectedLead.aiSalesSummary.replace(/\*\*SCORE:\s*\d+\*\*\n?/, "")}
                      </div>
                      {selectedLead.aiSalesSummaryGeneratedAt && (
                        <p className="text-[10px] text-violet-400 mt-3">
                          Generato il {new Date(selectedLead.aiSalesSummaryGeneratedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {!selectedLead.aiSalesSummary && (selectedLead.scrapeStatus === "scraped" || selectedLead.scrapeStatus === "scraped_cached") && (
                  <>
                    <Separator />
                    <Button
                      variant="outline"
                      className="w-full border-violet-200 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                      onClick={() => generateSummaryMutation.mutate(selectedLead.id)}
                      disabled={generateSummaryMutation.isPending}
                    >
                      {generateSummaryMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generazione analisi AI...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" />Genera analisi AI Sales Agent</>
                      )}
                    </Button>
                  </>
                )}

                {selectedLead.websiteData && (() => {
                  const wd = selectedLead.websiteData as any;
                  const allEmails = [...new Set([
                    ...(selectedLead.email ? [selectedLead.email] : []),
                    ...(wd.emails || []),
                  ])];
                  const allPhones = [...new Set([
                    ...(selectedLead.phone ? [selectedLead.phone] : []),
                    ...(wd.phones || []),
                  ])];

                  return (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                          <Zap className="h-4 w-4 text-amber-500" />
                          Dati estratti dal sito web
                        </h4>
                        <div className="space-y-3">
                          {wd.description && <ExpandableDescription text={wd.description} threshold={400} />}

                          {allEmails.length > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Email ({allEmails.length})</Label>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                {allEmails.map((email: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors" onClick={() => copyToClipboard(email)}>
                                    <Mail className="h-3 w-3 mr-1 text-blue-500" />{email}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {allPhones.length > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Telefoni ({allPhones.length})</Label>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                {allPhones.map((phone: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors" onClick={() => copyToClipboard(phone)}>
                                    <Phone className="h-3 w-3 mr-1 text-green-500" />{phone}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

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
                        </div>
                      </div>
                    </>
                  );
                })()}

                {selectedLead.website && selectedLead.scrapeStatus !== "scraped" && selectedLead.scrapeStatus !== "scraped_cached" && (
                  <>
                    <Separator />
                    <Button
                      variant="outline"
                      className="w-full border-purple-200 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors"
                      onClick={() => scrapeWebsiteMutation.mutate(selectedLead.id)}
                      disabled={scrapeWebsiteMutation.isPending}
                    >
                      {scrapeWebsiteMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analisi in corso...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" />Analizza sito web</>
                      )}
                    </Button>
                  </>
                )}

                <Separator />
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <ClipboardList className="h-4 w-4 text-rose-500" />
                    Gestione CRM
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-xs font-medium">Note</Label>
                      <Textarea
                        placeholder="Appunti sulla trattativa, dettagli del contatto..."
                        value={crmNotes}
                        onChange={(e) => setCrmNotes(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={handleSaveCrm}
                      disabled={updateCrmMutation.isPending}
                      className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white"
                    >
                      {updateCrmMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvataggio...</>
                      ) : (
                        <><Save className="h-4 w-4 mr-2" />Salva CRM</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

function ExpandableDescription({ text, threshold = 400 }: { text: string; threshold?: number }) {
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

function InfoBlock({
  icon,
  label,
  value,
  copyable,
  onCopy,
  link,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  copyable?: boolean;
  onCopy?: () => void;
  link?: boolean;
}) {
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
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 group hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {link ? (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate block"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm truncate font-medium text-gray-900 dark:text-white">{value}</p>
        )}
      </div>
      {copyable && onCopy && (
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onCopy}>
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
