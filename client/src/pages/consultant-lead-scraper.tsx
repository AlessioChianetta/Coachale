import { useState, useEffect, useMemo } from "react";
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

export default function ConsultantLeadScraper() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchLimit, setSearchLimit] = useState(20);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<SearchResult | null>(null);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterRatingMin, setFilterRatingMin] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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

  const startSearchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/lead-scraper/search", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, location: searchLocation, limit: searchLimit }),
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
      toast({ title: "Ricerca avviata", description: "La ricerca su Google Maps e' in corso..." });
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

  const activeFiltersCount = [filterHasEmail, filterHasPhone, !!filterRatingMin, !!filterCategory, !!filterSearch].filter(Boolean).length;

  const clearFilters = () => {
    setFilterHasEmail(false);
    setFilterHasPhone(false);
    setFilterRatingMin("");
    setFilterCategory("");
    setFilterSearch("");
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
              Trova business su Google Maps e analizza i loro siti web per estrarre contatti
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

        <div className="bg-gradient-to-r from-rose-50 via-pink-50 to-fuchsia-50 dark:from-rose-950/20 dark:via-pink-950/20 dark:to-fuchsia-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl overflow-hidden">
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
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Cerca su Google Maps</h4>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Inserisci cosa cerchi (es. "dentisti", "ristoranti") e dove (es. "Milano"). Il sistema usa SerpAPI per trovare tutti i business nella zona.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800/80 rounded-xl p-4 border border-purple-100 dark:border-purple-800/30 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-md">2</div>
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Scraping automatico</h4>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Per ogni risultato con sito web, Firecrawl analizza automaticamente il sito estraendo email, telefoni, social link e servizi offerti.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800/80 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">3</div>
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Esporta e contatta</h4>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Filtra i risultati per email, telefono, rating e categoria. Esporta tutto in CSV per le tue campagne di outreach e acquisizione clienti.
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
                <CardDescription>Cerca business su Google Maps</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="query" className="text-xs font-medium">Cosa cerchi</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="query"
                      placeholder="es. ristoranti, dentisti..."
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
                    <><Search className="h-4 w-4 mr-2" />Cerca su Maps</>
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
                    Usa il pannello a sinistra per cercare business su Google Maps. I risultati appariranno qui con dati di contatto, rating e analisi dei siti web.
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
                            Esporta CSV
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
                              : "Ricerca su Google Maps in corso..."}
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
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="hasEmail"
                            checked={filterHasEmail}
                            onCheckedChange={(c) => setFilterHasEmail(!!c)}
                          />
                          <Label htmlFor="hasEmail" className="text-sm">Ha email</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="hasPhone"
                            checked={filterHasPhone}
                            onCheckedChange={(c) => setFilterHasPhone(!!c)}
                          />
                          <Label htmlFor="hasPhone" className="text-sm">Ha telefono</Label>
                        </div>
                        <Input
                          placeholder="Rating min (es. 4)"
                          value={filterRatingMin}
                          onChange={(e) => setFilterRatingMin(e.target.value)}
                          className="h-9"
                        />
                        <Input
                          placeholder="Categoria"
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value)}
                          className="h-9"
                        />
                        <Input
                          placeholder="Cerca nome..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className="h-9"
                        />
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
                              <TableHead className="min-w-[150px] font-semibold text-gray-700 dark:text-gray-300">Indirizzo</TableHead>
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Telefono</TableHead>
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Email</TableHead>
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Sito</TableHead>
                              <TableHead className="text-center font-semibold text-gray-700 dark:text-gray-300">Rating</TableHead>
                              <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Categoria</TableHead>
                              <TableHead className="text-center font-semibold text-gray-700 dark:text-gray-300">Scraping</TableHead>
                              <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Azioni</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.map((r) => (
                              <TableRow
                                key={r.id}
                                className="cursor-pointer hover:bg-rose-50/50 dark:hover:bg-rose-950/10 transition-colors duration-150 border-b border-gray-100 dark:border-gray-800"
                                onClick={() => openLeadDetail(r)}
                              >
                                <TableCell className="font-medium text-gray-900 dark:text-white">
                                  <span className="line-clamp-1">{r.businessName || "\u2014"}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground line-clamp-1">{r.address || "\u2014"}</span>
                                </TableCell>
                                <TableCell>
                                  {r.phone ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs hover:bg-green-50 dark:hover:bg-green-950/20"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              copyToClipboard(r.phone!);
                                            }}
                                          >
                                            <Phone className="h-3 w-3 mr-1 text-green-500" />
                                            <span className="truncate max-w-[100px]">{r.phone}</span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Copia telefono</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {r.email ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              copyToClipboard(r.email!);
                                            }}
                                          >
                                            <Mail className="h-3 w-3 mr-1 text-blue-500" />
                                            <span className="truncate max-w-[120px]">{r.email}</span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Copia email</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {r.website ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs hover:bg-purple-50 dark:hover:bg-purple-950/20"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const url = r.website!.startsWith("http") ? r.website! : `https://${r.website}`;
                                        window.open(url, "_blank");
                                      }}
                                    >
                                      <Globe className="h-3 w-3 mr-1 text-purple-500" />
                                      <span className="truncate max-w-[80px]">{r.website}</span>
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {r.rating ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                      <span className="text-xs font-semibold">{r.rating}</span>
                                      {r.reviewsCount && (
                                        <span className="text-[10px] text-muted-foreground">({r.reviewsCount})</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground line-clamp-1">{r.category || "\u2014"}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  {getScrapeStatusBadge(r.scrapeStatus)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {r.website && r.scrapeStatus !== "scraped" && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                scrapeWebsiteMutation.mutate(r.id);
                                              }}
                                              disabled={scrapeWebsiteMutation.isPending}
                                            >
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
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const data = [
                                                r.businessName,
                                                r.phone,
                                                r.email,
                                                r.website,
                                                r.address,
                                              ]
                                                .filter(Boolean)
                                                .join(" | ");
                                              copyToClipboard(data);
                                            }}
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Copia dati</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
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
      </div>

      <Dialog open={showLeadDetail} onOpenChange={setShowLeadDetail}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30">
                    <Building2 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <span className="text-lg">{selectedLead.businessName || "Lead senza nome"}</span>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      {selectedLead.category || "Categoria non disponibile"}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoBlock icon={<MapPin className="h-4 w-4 text-rose-500" />} label="Indirizzo" value={selectedLead.address} />
                  <InfoBlock
                    icon={<Phone className="h-4 w-4 text-green-500" />}
                    label="Telefono"
                    value={selectedLead.phone}
                    copyable
                    onCopy={() => selectedLead.phone && copyToClipboard(selectedLead.phone)}
                  />
                  <InfoBlock
                    icon={<Mail className="h-4 w-4 text-blue-500" />}
                    label="Email"
                    value={selectedLead.email}
                    copyable
                    onCopy={() => selectedLead.email && copyToClipboard(selectedLead.email)}
                  />
                  <InfoBlock
                    icon={<Globe className="h-4 w-4 text-purple-500" />}
                    label="Sito Web"
                    value={selectedLead.website}
                    link
                  />
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

                {selectedLead.websiteData && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Dati estratti dal sito web
                      </h4>
                      <div className="space-y-3">
                        {selectedLead.websiteData.description && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Descrizione</Label>
                            <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">{selectedLead.websiteData.description}</p>
                          </div>
                        )}

                        {selectedLead.websiteData.emails?.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Email trovate</Label>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {selectedLead.websiteData.emails.map((email: string, i: number) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                  onClick={() => copyToClipboard(email)}
                                >
                                  <Mail className="h-3 w-3 mr-1 text-blue-500" />{email}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedLead.websiteData.phones?.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Telefoni trovati</Label>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {selectedLead.websiteData.phones.map((phone: string, i: number) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                  onClick={() => copyToClipboard(phone)}
                                >
                                  <Phone className="h-3 w-3 mr-1 text-green-500" />{phone}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedLead.websiteData.socialLinks && Object.keys(selectedLead.websiteData.socialLinks).length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Social</Label>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {Object.entries(selectedLead.websiteData.socialLinks).map(([platform, url]) => (
                                <Badge
                                  key={platform}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors"
                                  onClick={() => window.open(url as string, "_blank")}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1 text-purple-500" />{platform}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedLead.websiteData.services?.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Servizi</Label>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {selectedLead.websiteData.services.map((svc: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">{svc}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {selectedLead.website && selectedLead.scrapeStatus !== "scraped" && (
                  <>
                    <Separator />
                    <Button
                      variant="outline"
                      className="w-full border-purple-200 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors"
                      onClick={() => {
                        scrapeWebsiteMutation.mutate(selectedLead.id);
                      }}
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
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
