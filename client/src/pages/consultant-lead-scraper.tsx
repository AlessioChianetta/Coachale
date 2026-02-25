import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { PageLayout } from "@/components/layout/PageLayout";
import { Message } from "@/components/ai-assistant/Message";
import { ThinkingBubble } from "@/components/ai-assistant/ThinkingBubble";
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
  ArrowUpDown,
  Crosshair,
  Activity,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  outreachTaskId: string | null;
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
  originRole: string | null;
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
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface KeywordSuggestion {
  keyword: string;
  engine: "maps" | "search";
  reason: string;
}

const LEAD_STATUSES = [
  { value: "nuovo", label: "Nuovo", color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700", borderColor: "border-l-gray-300" },
  { value: "contattato", label: "Contattato", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800", borderColor: "border-l-blue-400" },
  { value: "in_trattativa", label: "In trattativa", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800", borderColor: "border-l-amber-400" },
  { value: "proposta_inviata", label: "Proposta inviata", color: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800", borderColor: "border-l-violet-400" },
  { value: "chiuso_vinto", label: "Chiuso vinto", color: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800", borderColor: "border-l-emerald-500" },
  { value: "chiuso_perso", label: "Chiuso perso", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800", borderColor: "border-l-red-400" },
  { value: "non_interessato", label: "Non interessato", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", borderColor: "border-l-slate-300" },
];

function getLeadStatusInfo(status: string | null) {
  return LEAD_STATUSES.find(s => s.value === (status || "nuovo")) || LEAD_STATUSES[0];
}

function getScoreBar(score: number | null) {
  if (score === null || score === undefined) return null;
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 70 ? "text-emerald-700 dark:text-emerald-400" : score >= 40 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400";
  return (
    <div className="flex items-center gap-1.5 min-w-[60px]">
      <span className={`text-xs font-bold ${textColor}`}>{score}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
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

export default function ConsultantLeadScraper() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState("ricerca");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchLimit, setSearchLimit] = useState(20);
  const [searchEngine, setSearchEngine] = useState<"google_maps" | "google_search">("google_maps");
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterRatingMin, setFilterRatingMin] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterLeadStatus, setFilterLeadStatus] = useState("tutti");
  const [showFilters, setShowFilters] = useState(false);

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
  const [crmSearch, setCrmSearch] = useState("");
  const [crmSourceFilter, setCrmSourceFilter] = useState<"tutti" | "google_maps" | "google_search">("tutti");
  const [historySourceFilter, setHistorySourceFilter] = useState<"tutti" | "google_maps" | "google_search">("tutti");

  const [keywordSuggestions, setKeywordSuggestions] = useState<KeywordSuggestion[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [showKeywords, setShowKeywords] = useState(false);

  const [sortBy, setSortBy] = useState<"default" | "score" | "rating" | "name">("default");

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

  const allResultsParams = useMemo(() => {
    const p = new URLSearchParams();
    if (crmFilterStatus !== "tutti") p.set("lead_status", crmFilterStatus);
    if (crmSearch.trim()) p.set("search", crmSearch.trim());
    if (crmSourceFilter !== "tutti") p.set("source", crmSourceFilter);
    return p.toString();
  }, [crmFilterStatus, crmSearch, crmSourceFilter]);

  const { data: allResults = [] } = useQuery<SearchResult[]>({
    queryKey: ["/api/lead-scraper/all-results", allResultsParams],
    queryFn: async () => {
      const res = await fetch(`/api/lead-scraper/all-results${allResultsParams ? `?${allResultsParams}` : ""}`, { headers: getAuthHeaders() });
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

  const { data: hunterStatus } = useQuery<{ role: string; isEnabled: boolean; lastRun: string | null; tasksCreated: number; status: string } | null>({
    queryKey: ["/api/ai/autonomy/roles/status", "hunter"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/ai/autonomy/roles/status", { headers: getAuthHeaders() });
        if (!res.ok) return null;
        const data = await res.json();
        const roles = data.roles || [];
        return roles.find((r: any) => r.role === "hunter") || null;
      } catch {
        return null;
      }
    },
    refetchInterval: 30000,
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
      if (resultsUrl) queryClient.invalidateQueries({ queryKey: [resultsUrl] });
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

  const crmStats = useMemo(() => {
    const counts: Record<string, number> = {};
    LEAD_STATUSES.forEach(s => { counts[s.value] = 0; });
    allResults.forEach(r => {
      const status = r.leadStatus || "nuovo";
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [allResults]);

  const hunterSearches = useMemo(() => searches.filter(s => s.originRole === "hunter"), [searches]);
  const hunterLeadsCount = useMemo(() => allResults.filter(r => r.outreachTaskId).length, [allResults]);

  const filteredSearches = useMemo(() => {
    if (historySourceFilter === "tutti") return searches;
    return searches.filter((s) => {
      const meta = s.metadata as any;
      const engine = meta?.params?.searchEngine || "google_maps";
      return engine === historySourceFilter;
    });
  }, [searches, historySourceFilter]);

  const sortedResults = useMemo(() => {
    const sorted = [...results];
    if (sortBy === "score") sorted.sort((a, b) => (b.aiCompatibilityScore || 0) - (a.aiCompatibilityScore || 0));
    else if (sortBy === "rating") sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === "name") sorted.sort((a, b) => (a.businessName || "").localeCompare(b.businessName || ""));
    return sorted;
  }, [results, sortBy]);

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
      toast({ title: "Ricerca avviata" });
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
      if (!res.ok) throw new Error("Errore scraping");
      return res.json();
    },
    onSuccess: () => {
      if (resultsUrl) queryClient.invalidateQueries({ queryKey: [resultsUrl] });
      toast({ title: "Sito analizzato" });
    },
  });

  const deleteSearchMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const res = await fetch(`/api/lead-scraper/searches/${searchId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      if (selectedSearchId === deletedId) setSelectedSearchId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      toast({ title: "Ricerca eliminata" });
    },
  });

  const saveSalesContextMutation = useMutation({
    mutationFn: async (data: SalesContext) => {
      const res = await fetch("/api/lead-scraper/sales-context", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/sales-context"] });
      toast({ title: "Contesto salvato", description: "Il tuo profilo vendita e' stato aggiornato" });
    },
  });

  const generateBatchSummariesMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const res = await fetch(`/api/lead-scraper/searches/${searchId}/generate-summaries`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Analisi AI avviata", description: "I resoconti verranno generati in background" });
      setTimeout(() => {
        if (resultsUrl) queryClient.invalidateQueries({ queryKey: [resultsUrl] });
      }, 10000);
    },
  });

  const handleExport = () => {
    if (!selectedSearchId) return;
    fetch(`/api/lead-scraper/searches/${selectedSearchId}/export`, { headers: getAuthHeaders() })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.setAttribute("download", "");
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato!", description: text });
  };

  const handleSuggestKeywords = async () => {
    setKeywordsLoading(true);
    setShowKeywords(true);
    try {
      const res = await fetch("/api/lead-scraper/suggest-keywords", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Errore" }));
        toast({ title: "Errore", description: err.error, variant: "destructive" });
        return;
      }
      const data = await res.json();
      setKeywordSuggestions(data.suggestions || []);
    } catch {
      toast({ title: "Errore", description: "Impossibile generare suggerimenti", variant: "destructive" });
    } finally {
      setKeywordsLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: userMsg }]);
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
        "Rispondi in italiano, sii pratico e orientato alla vendita.",
      ].filter(Boolean).join("\n");

      const contents = [
        ...chatMessages.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] })),
        { role: "user", parts: [{ text: userMsg }] },
      ];

      const res = await fetch("/api/lead-scraper/chat", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ systemContext: systemCtx, contents }),
      });

      if (!res.ok) throw new Error("Errore chat");
      const data = await res.json();
      setChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.text || "Nessuna risposta" }]);
    } catch {
      setChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Errore nella comunicazione con l'AI. Riprova." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400"><Loader2 className="h-3 w-3 animate-spin mr-1" />In corso</Badge>;
      case "enriching":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400"><RefreshCw className="h-3 w-3 animate-spin mr-1" />Arricchimento</Badge>;
      case "completed":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle className="h-3 w-3 mr-1" />Completata</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3 mr-1" />Fallita</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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

  const navigateToLead = (leadId: string) => {
    setLocation(`/consultant/lead-scraper/lead/${leadId}`);
  };

  return (
    <PageLayout role="consultant">
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-violet-600 rounded-xl shadow-sm">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Lead Scraper</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Trova, analizza e gestisci i tuoi lead con AI Sales Agent</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Ricerche", value: stats.totalSearches, icon: Search, iconColor: "text-rose-500", numColor: "text-rose-600 dark:text-rose-400" },
            { label: "Lead Totali", value: stats.totalLeads, icon: Building2, iconColor: "text-violet-500", numColor: "text-violet-600 dark:text-violet-400" },
            { label: "Email", value: stats.emailCount, icon: Mail, iconColor: "text-blue-500", numColor: "text-blue-600 dark:text-blue-400" },
            { label: "Telefoni", value: stats.phoneCount, icon: Phone, iconColor: "text-emerald-500", numColor: "text-emerald-600 dark:text-emerald-400" },
          ].map((stat, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <stat.icon className={`h-3.5 w-3.5 ${stat.iconColor}`} />
                </div>
              </div>
              <p className={`text-2xl font-black tracking-tight leading-none mt-2 mb-0.5 ${stat.numColor}`}>{stat.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {hunterStatus && (
          <Card className="rounded-2xl border border-teal-200 dark:border-teal-800 shadow-sm bg-gradient-to-r from-teal-50 to-white dark:from-teal-950/20 dark:to-gray-900">
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-900/40">
                    <Crosshair className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 dark:text-white">Outreach Automatico</h3>
                      <Badge className={hunterStatus.isEnabled
                        ? "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800"
                        : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      }>
                        {hunterStatus.isEnabled ? (
                          <><Activity className="h-3 w-3 mr-1" />Attivo</>
                        ) : "Disattivato"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Hunter trova e qualifica lead automaticamente
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center px-3">
                    <p className="text-lg font-black text-teal-600 dark:text-teal-400">{hunterSearches.length}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Ricerche Auto</p>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="text-center px-3">
                    <p className="text-lg font-black text-teal-600 dark:text-teal-400">{hunterSearches.reduce((acc, s) => acc + (s.resultsCount || 0), 0)}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Lead Trovati</p>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="text-center px-3">
                    <p className="text-lg font-black text-teal-600 dark:text-teal-400">{hunterLeadsCount}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">In Outreach</p>
                  </div>
                  {hunterStatus.lastRun && (
                    <>
                      <Separator orientation="vertical" className="h-8" />
                      <div className="text-center px-3">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{timeAgo(hunterStatus.lastRun)}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Ultimo ciclo</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex justify-start gap-0 bg-transparent p-0 border-b border-gray-200 dark:border-gray-700 rounded-none h-auto">
            <TabsTrigger value="ricerca" className="flex items-center gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium transition-colors">
              <Search className="h-3.5 w-3.5" />Ricerca
            </TabsTrigger>
            <TabsTrigger value="crm" className="flex items-center gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium transition-colors">
              <ClipboardList className="h-3.5 w-3.5" />CRM Lead
            </TabsTrigger>
            <TabsTrigger value="agent" className="flex items-center gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium transition-colors">
              <Bot className="h-3.5 w-3.5" />Sales Agent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ricerca" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <Card className="border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm bg-white dark:bg-gray-900">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Search className="h-4 w-4 text-violet-500" />Nuova Ricerca
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Motore di ricerca</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSearchEngine("google_maps")}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${searchEngine === "google_maps" ? "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 shadow-sm" : "border-gray-200 dark:border-gray-700 text-gray-500"}`}
                        >
                          <Map className="h-3.5 w-3.5" />Maps
                        </button>
                        <button
                          type="button"
                          onClick={() => setSearchEngine("google_search")}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${searchEngine === "google_search" ? "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 shadow-sm" : "border-gray-200 dark:border-gray-700 text-gray-500"}`}
                        >
                          <Globe className="h-3.5 w-3.5" />Search
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="query" className="text-xs font-medium">Cosa cerchi</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="query" placeholder={searchEngine === "google_search" ? "es. agenzia marketing..." : "es. ristoranti, dentisti..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-xs font-medium">Localita</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="location" placeholder="es. Milano, Roma..." value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs font-medium">Risultati max</Label>
                        <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{searchLimit}</span>
                      </div>
                      <Slider value={[searchLimit]} onValueChange={(v) => setSearchLimit(v[0])} min={5} max={100} step={5} className="[&_[role=slider]]:bg-rose-500" />
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-violet-200 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 text-violet-700 dark:text-violet-400 text-xs"
                      onClick={handleSuggestKeywords}
                      disabled={keywordsLoading}
                    >
                      {keywordsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                      Suggerisci keyword AI
                    </Button>

                    {showKeywords && keywordSuggestions.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-violet-700 dark:text-violet-400">Keyword suggerite</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {keywordSuggestions.map((kw, i) => (
                            <TooltipProvider key={i}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-all hover:shadow-sm cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600"
                                    onClick={() => {
                                      setSearchQuery(kw.keyword);
                                      setSearchEngine(kw.engine === "maps" ? "google_maps" : "google_search");
                                    }}
                                  >
                                    {kw.engine === "maps" ? <Map className="h-3 w-3 text-rose-500" /> : <Globe className="h-3 w-3 text-blue-500" />}
                                    <span className="truncate max-w-[120px]">{kw.keyword}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px]">
                                  <p className="text-xs">{kw.reason}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>
                    )}

                    {showKeywords && !keywordsLoading && keywordSuggestions.length === 0 && !savedSalesContext && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg">
                        Configura prima il tuo Sales Agent nella tab dedicata per ottenere suggerimenti personalizzati.
                      </p>
                    )}

                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white border-0 shadow-sm"
                      onClick={() => startSearchMutation.mutate()}
                      disabled={!searchQuery || startSearchMutation.isPending}
                    >
                      {startSearchMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Avvio...</>
                      ) : (
                        <><Search className="h-4 w-4 mr-2" />Cerca</>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />Storico ({searches.length})
                    </CardTitle>
                    <div className="flex items-center gap-1 mt-2">
                      {(["tutti", "google_maps", "google_search"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setHistorySourceFilter(v)}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                            historySourceFilter === v
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
                              : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                          )}
                        >
                          {v === "tutti" && "Tutti"}
                          {v === "google_maps" && <><Map className="h-3 w-3 text-rose-500" />Maps</>}
                          {v === "google_search" && <><Globe className="h-3 w-3 text-blue-500" />Search</>}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[350px]">
                      {searchesLoading ? (
                        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      ) : filteredSearches.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm px-4">
                          <Search className="h-8 w-8 mx-auto mb-2 opacity-30" /><p>Nessuna ricerca</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {filteredSearches.map((s) => {
                            const searchMeta = s.metadata as any;
                            const resCount = s.resultsCount || 0;
                            return (
                              <div
                                key={s.id}
                                className={`px-4 py-3 cursor-pointer transition-all duration-200 ${selectedSearchId === s.id ? "bg-violet-50 dark:bg-violet-950/20 border-l-3 border-l-violet-500" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                                onClick={() => setSelectedSearchId(s.id)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      {searchMeta?.params?.searchEngine === "google_search" ? (
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/30 gap-0.5">
                                          <Globe className="h-2.5 w-2.5" />Search
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/30 gap-0.5">
                                          <Map className="h-2.5 w-2.5" />Maps
                                        </Badge>
                                      )}
                                      <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{s.query}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{s.location || "Nessuna localita"}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      {s.originRole === "hunter" && (
                                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 gap-0.5">
                                          <Crosshair className="h-2.5 w-2.5" />Hunter
                                        </Badge>
                                      )}
                                      {getStatusBadge(s.status)}
                                      <span className="text-[10px] text-muted-foreground">{resCount} risultati</span>
                                      <span className="text-[10px] text-muted-foreground">{timeAgo(s.createdAt)}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); deleteSearchMutation.mutate(s.id); }}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
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
                      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4 shadow-sm">
                        <Building2 className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Seleziona o avvia una ricerca</h3>
                      <p className="text-sm text-muted-foreground max-w-md">Usa il pannello a sinistra per cercare business.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {selectedSearch && (
                      <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <CardContent className="py-4 px-5">
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                                <Search className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-gray-900 dark:text-white">{selectedSearch.query}</h3>
                                  {selectedSearch.location && <Badge variant="outline" className="text-xs"><MapPin className="h-3 w-3 mr-1" />{selectedSearch.location}</Badge>}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  {getStatusBadge(selectedSearch.status)}
                                  <span className="text-xs text-muted-foreground font-medium">{results.length} risultati</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {selectedSearch.status === "completed" && (
                                <Button variant="outline" size="sm" onClick={() => generateBatchSummariesMutation.mutate(selectedSearchId!)} disabled={generateBatchSummariesMutation.isPending} className="border-amber-200 hover:border-amber-400 hover:bg-amber-50 text-amber-700">
                                  {generateBatchSummariesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                                  Analisi AI
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="relative">
                                <Filter className="h-4 w-4 mr-1" />Filtri
                                {activeFiltersCount > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-violet-600">{activeFiltersCount}</Badge>}
                              </Button>
                              <Button variant="outline" size="sm" onClick={handleExport} disabled={results.length === 0}>
                                <Download className="h-4 w-4 mr-1" />CSV
                              </Button>
                              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                                <SelectTrigger className="w-[130px] h-9 text-xs">
                                  <ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue placeholder="Ordina" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="default">Predefinito</SelectItem>
                                  <SelectItem value="score">Score AI</SelectItem>
                                  <SelectItem value="rating">Rating</SelectItem>
                                  <SelectItem value="name">Nome A-Z</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {isSearchRunning && (
                            <div className="mt-3">
                              <Progress value={undefined} className="h-1.5" />
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />{selectedSearch.status === "enriching" ? "Analisi siti web in corso..." : "Ricerca in corso..."}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {showFilters && (
                      <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <CardContent className="py-4 px-5">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold flex items-center gap-2"><Filter className="h-4 w-4 text-gray-500" />Filtri</h4>
                            {activeFiltersCount > 0 && (
                              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7 text-gray-500 hover:text-gray-700"><X className="h-3 w-3 mr-1" />Rimuovi</Button>
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
                              <SelectTrigger className="h-9"><SelectValue placeholder="Stato" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tutti">Tutti</SelectItem>
                                {LEAD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                      <CardContent className="p-0">
                        {resultsLoading ? (
                          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
                        ) : results.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            {isSearchRunning ? <><Loader2 className="h-6 w-6 animate-spin text-violet-400 mx-auto mb-2" /><p>Ricerca in corso...</p></> : "Nessun risultato"}
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                                  <TableHead className="min-w-[220px] font-semibold">Azienda</TableHead>
                                  <TableHead className="text-center font-semibold w-[50px]">Contatti</TableHead>
                                  <TableHead className="text-center font-semibold w-[80px]">Rating</TableHead>
                                  <TableHead className="text-center font-semibold w-[90px]">Score AI</TableHead>
                                  <TableHead className="text-center font-semibold w-[90px]">Stato</TableHead>
                                  <TableHead className="text-right font-semibold w-[60px]">Azioni</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedResults.map((r) => {
                                  const statusInfo = getLeadStatusInfo(r.leadStatus);
                                  return (
                                    <TableRow
                                      key={r.id}
                                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-3 ${statusInfo.borderColor}`}
                                      onClick={() => navigateToLead(r.id)}
                                    >
                                      <TableCell>
                                        <div>
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-medium text-gray-900 dark:text-white line-clamp-1">{r.businessName || "\u2014"}</span>
                                            {r.source === "google_search" && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 border-blue-300 text-blue-600">Web</Badge>}
                                          </div>
                                          {r.category && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{r.category}</p>}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                          <Mail className={`h-3.5 w-3.5 ${r.email ? "text-blue-500" : "text-gray-200 dark:text-gray-700"}`} title={r.email ? "Email disponibile" : "No email"} />
                                          <Phone className={`h-3.5 w-3.5 ${r.phone ? "text-emerald-500" : "text-gray-200 dark:text-gray-700"}`} title={r.phone ? "Telefono disponibile" : "No telefono"} />
                                          <Globe className={`h-3.5 w-3.5 ${r.website ? "text-violet-500" : "text-gray-200 dark:text-gray-700"}`} title={r.website ? "Sito web disponibile" : "No sito"} />
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {r.rating ? (
                                          <div className="flex items-center justify-center gap-1">
                                            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                            <span className="text-xs font-semibold">{r.rating}</span>
                                          </div>
                                        ) : <span className="text-xs text-muted-foreground">\u2014</span>}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {getScoreBar(r.aiCompatibilityScore)}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusInfo.color}`}>{statusInfo.label}</Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          {r.website && r.scrapeStatus !== "scraped" && r.scrapeStatus !== "scraped_cached" && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); scrapeWebsiteMutation.mutate(r.id); }}>
                                              <RefreshCw className={`h-3 w-3 ${scrapeWebsiteMutation.isPending ? "animate-spin" : ""}`} />
                                            </Button>
                                          )}
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); copyToClipboard([r.businessName, r.phone, r.email, r.website].filter(Boolean).join(" | ")); }}>
                                            <Copy className="h-3 w-3" />
                                          </Button>
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
            <div className="space-y-4">
              <div className="flex items-stretch overflow-x-auto">
                {LEAD_STATUSES.map((s, idx) => (
                  <button
                    key={s.value}
                    className={`relative flex-1 min-w-[100px] flex flex-col items-center justify-center py-3 px-2 text-center transition-all ${
                      crmFilterStatus === s.value
                        ? `${s.color} shadow-sm font-semibold`
                        : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    } ${idx === 0 ? "rounded-l-lg border border-gray-200 dark:border-gray-700" : idx === LEAD_STATUSES.length - 1 ? "rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-700" : "border border-l-0 border-gray-200 dark:border-gray-700"}`}
                    onClick={() => setCrmFilterStatus(crmFilterStatus === s.value ? "tutti" : s.value)}
                  >
                    <span className="text-lg font-black">{crmStats[s.value] || 0}</span>
                    <span className="text-[10px] font-medium leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>

              <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-violet-500" />CRM Lead
                      <span className="text-sm font-normal text-muted-foreground">({allResults.length})</span>
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                        {(["tutti", "google_maps", "google_search"] as const).map((v) => (
                          <button
                            key={v}
                            onClick={() => setCrmSourceFilter(v)}
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                              crmSourceFilter === v
                                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                          >
                            {v === "tutti" && "Tutti"}
                            {v === "google_maps" && <><Map className="h-3 w-3 text-rose-500" />Maps</>}
                            {v === "google_search" && <><Globe className="h-3 w-3 text-blue-500" />Search</>}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Cerca lead..."
                          value={crmSearch}
                          onChange={(e) => setCrmSearch(e.target.value)}
                          className="pl-9 w-[250px] h-9"
                        />
                        {crmSearch && (
                          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setCrmSearch("")}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {(crmFilterStatus !== "tutti" || crmSourceFilter !== "tutti") && (
                        <Button variant="ghost" size="sm" onClick={() => { setCrmFilterStatus("tutti"); setCrmSourceFilter("tutti"); }} className="text-xs h-8 text-gray-500 hover:text-gray-700">
                          <X className="h-3 w-3 mr-1" />Rimuovi filtri
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {allResults.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Nessun lead trovato</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                            <TableHead className="font-semibold">Nome</TableHead>
                            <TableHead className="text-center font-semibold w-[70px]">Fonte</TableHead>
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
                                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-3 ${statusInfo.borderColor}`}
                                onClick={() => navigateToLead(r.id)}
                              >
                                <TableCell>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-gray-900 dark:text-white">{r.businessName || "-"}</span>
                                      {r.outreachTaskId && (
                                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 gap-0.5">
                                          <Crosshair className="h-2.5 w-2.5" />Auto
                                        </Badge>
                                      )}
                                    </div>
                                    {r.category && <p className="text-sm text-gray-500 mt-0.5">{r.category}</p>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {r.source === "google_search" ? (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/30 gap-0.5">
                                      <Globe className="h-2.5 w-2.5" />Search
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/30 gap-0.5">
                                      <Map className="h-2.5 w-2.5" />Maps
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">{r.email || "-"}</TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">{r.phone || "-"}</TableCell>
                                <TableCell className="text-center">{getScoreBar(r.aiCompatibilityScore)}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusInfo.color}`}>{statusInfo.label}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {r.leadNextAction ? (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />{r.leadNextAction}
                                      {r.leadNextActionDate && <span className="text-[10px]">({new Date(r.leadNextActionDate).toLocaleDateString("it-IT")})</span>}
                                    </span>
                                  ) : "\u2014"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {r.leadValue ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">{r.leadValue.toLocaleString("it-IT")} EUR</span> : "\u2014"}
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
            </div>
          </TabsContent>

          <TabsContent value="agent" className="mt-4">
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-violet-500" />Configura il tuo Sales Agent
                </CardTitle>
                <CardDescription>
                  Inserisci il contesto del tuo business perche l'AI possa analizzare ogni azienda e dare uno score di compatibilita accurato.
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
                    {[
                      { key: "servicesOffered", label: "Servizi che offri", placeholder: "Descrivi i servizi che vendi...", tall: true },
                      { key: "targetAudience", label: "Target ideale", placeholder: "A chi vendi? PMI, startup, professionisti...", tall: false },
                      { key: "valueProposition", label: "Proposta di valore", placeholder: "Cosa ti rende unico?", tall: false },
                      { key: "pricingInfo", label: "Pricing / Pacchetti", placeholder: "Range prezzi, pacchetti...", tall: false },
                    ].map(field => (
                      <div key={field.key} className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</Label>
                        <Textarea
                          placeholder={field.placeholder}
                          value={(salesContext as any)[field.key]}
                          onChange={(e) => setSalesContext(p => ({ ...p, [field.key]: e.target.value }))}
                          className={`${field.tall ? "min-h-[100px]" : "min-h-[80px]"} border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-violet-500`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    {[
                      { key: "competitiveAdvantages", label: "Vantaggi competitivi", placeholder: "Cosa fai meglio della concorrenza?" },
                      { key: "idealClientProfile", label: "Profilo cliente ideale", placeholder: "Fatturato, dipendenti, settore..." },
                      { key: "salesApproach", label: "Approccio vendita", placeholder: "Come approcci il primo contatto?" },
                      { key: "caseStudies", label: "Casi di successo", placeholder: "Brevi case study..." },
                    ].map(field => (
                      <div key={field.key} className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</Label>
                        <Textarea
                          placeholder={field.placeholder}
                          value={(salesContext as any)[field.key]}
                          onChange={(e) => setSalesContext(p => ({ ...p, [field.key]: e.target.value }))}
                          className="min-h-[80px] border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contesto aggiuntivo</Label>
                  <Textarea placeholder="Qualsiasi altra informazione utile..." value={salesContext.additionalContext} onChange={(e) => setSalesContext(p => ({ ...p, additionalContext: e.target.value }))} className="min-h-[60px] border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="mt-6 flex justify-end">
                  <Button
                    className="bg-violet-600 hover:bg-violet-700 text-white border-0 shadow-sm"
                    onClick={() => saveSalesContextMutation.mutate(salesContext)}
                    disabled={saveSalesContextMutation.isPending}
                  >
                    {saveSalesContextMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvataggio...</> : <><Save className="h-4 w-4 mr-2" />Salva configurazione</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <button
        onClick={() => setShowChat(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center"
      >
        <Bot className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
      </button>

      <AnimatePresence>
        {showChat && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setShowChat(false)}
            />
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full sm:w-[420px] max-w-full z-50 flex flex-col bg-background shadow-2xl border-l"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-muted/50 to-transparent">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">Sales Agent</h3>
                  <p className="text-xs text-muted-foreground">Chat diretta</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setChatMessages([])}
                    disabled={chatMessages.length === 0 || chatLoading}
                    title="Cancella chat"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowChat(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium mb-1">Chatta con Sales Agent</p>
                      <p className="text-xs text-muted-foreground max-w-[250px]">
                        Chiedi strategie, email, analisi sui lead
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 w-full max-w-[280px]">
                      {[
                        "Qual e' il lead piu promettente?",
                        "Prepara una email di presentazione",
                        "Come approccio i lead a Milano?",
                      ].map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setChatInput(s);
                          }}
                          className="text-left text-xs px-3 py-2 rounded-lg border border-dashed hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Sparkles className="h-3 w-3 inline-block mr-1.5 opacity-50" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <Message
                      key={msg.id}
                      message={msg}
                      assistantName="Sales Agent"
                      assistantSubtitle="AI Lead Scraper"
                    />
                  ))
                )}

                {chatLoading && (
                  <ThinkingBubble isThinking={true} />
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3">
                <div className="relative bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200/70 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl transition-all duration-300 focus-within:border-primary/40 dark:focus-within:border-primary/40 focus-within:shadow-primary/10 focus-within:bg-white dark:focus-within:bg-slate-800">
                  <div className="px-4 pt-3 pb-2">
                    <Textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChat();
                        }
                      }}
                      placeholder={chatLoading ? "Sto elaborando..." : "Scrivi a Sales Agent..."}
                      disabled={chatLoading}
                      className="resize-none min-h-[44px] max-h-[120px] bg-transparent border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 p-0 shadow-none"
                      rows={1}
                    />
                  </div>

                  <div className="flex items-center justify-end px-3 pb-3 pt-1">
                    <Button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim() || chatLoading}
                      size="sm"
                      className="h-9 w-9 p-0 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 disabled:from-slate-200 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-600 transition-all"
                    >
                      {chatLoading ? (
                        <div className="flex gap-0.5">
                          <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      ) : (
                        <Send className="h-4 w-4 text-white" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}
