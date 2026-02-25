import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building2,
  ChevronRight,
  Filter,
  X,
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
      toast({ title: "Ricerca avviata", description: "La ricerca è in corso..." });
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
      if (selectedSearchId === deletedId) {
        setSelectedSearchId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      toast({ title: "Ricerca eliminata" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare la ricerca", variant: "destructive" });
    },
  });

  const handleExport = () => {
    if (!selectedSearchId) return;
    const token = localStorage.getItem("token");
    const url = `/api/lead-scraper/searches/${selectedSearchId}/export`;
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "");
    const headers = getAuthHeaders();
    fetch(url, { headers })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
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
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Loader2 className="h-3 w-3 animate-spin mr-1" />In corso</Badge>;
      case "enriching":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><RefreshCw className="h-3 w-3 animate-spin mr-1" />Arricchimento</Badge>;
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="h-3 w-3 mr-1" />Completata</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Fallita</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getScrapeStatusBadge = (status: string | null) => {
    switch (status) {
      case "scraped":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">OK</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">In attesa</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0">Fallito</Badge>;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lead Scraper</h1>
            <p className="text-muted-foreground">Trova business da Google Maps e analizza i loro siti web</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nuova Ricerca</CardTitle>
                <CardDescription>Cerca business su Google Maps</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="query">Cosa cerchi</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="query"
                      placeholder="es. ristoranti, dentisti..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Località</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="location"
                      placeholder="es. Milano, Roma..."
                      value={searchLocation}
                      onChange={(e) => setSearchLocation(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Risultati max</Label>
                    <span className="text-sm text-muted-foreground">{searchLimit}</span>
                  </div>
                  <Slider
                    value={[searchLimit]}
                    onValueChange={(v) => setSearchLimit(v[0])}
                    min={5}
                    max={100}
                    step={5}
                  />
                </div>
                <Button
                  className="w-full"
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

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Storico Ricerche</CardTitle>
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
                      Nessuna ricerca effettuata
                    </div>
                  ) : (
                    <div className="divide-y">
                      {searches.map((s) => (
                        <div
                          key={s.id}
                          className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedSearchId === s.id ? "bg-muted/80" : ""
                          }`}
                          onClick={() => setSelectedSearchId(s.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{s.query}</p>
                              <p className="text-xs text-muted-foreground truncate">{s.location || "—"}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(s.status)}
                                {s.resultsCount !== null && (
                                  <span className="text-xs text-muted-foreground">{s.resultsCount} risultati</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSearchMutation.mutate(s.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
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
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-1">Seleziona o avvia una ricerca</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Usa il pannello a sinistra per cercare business su Google Maps. I risultati appariranno qui con dati di contatto, rating e analisi dei siti web.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {selectedSearch && (
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{selectedSearch.query}</h3>
                              {selectedSearch.location && (
                                <Badge variant="outline" className="text-xs">
                                  <MapPin className="h-3 w-3 mr-1" />{selectedSearch.location}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(selectedSearch.status)}
                              <span className="text-xs text-muted-foreground">
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
                            className="relative"
                          >
                            <Filter className="h-4 w-4 mr-1" />
                            Filtri
                            {activeFiltersCount > 0 && (
                              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                                {activeFiltersCount}
                              </Badge>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={results.length === 0}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Esporta CSV
                          </Button>
                        </div>
                      </div>

                      {isSearchRunning && (
                        <div className="mt-3">
                          <Progress value={undefined} className="h-1.5" />
                          <p className="text-xs text-muted-foreground mt-1">
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
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium">Filtri</h4>
                        {activeFiltersCount > 0 && (
                          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
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

                <Card>
                  <CardContent className="p-0">
                    {resultsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : results.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        {isSearchRunning ? "Ricerca in corso, i risultati appariranno a breve..." : "Nessun risultato trovato"}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[200px]">Nome</TableHead>
                              <TableHead className="min-w-[150px]">Indirizzo</TableHead>
                              <TableHead>Telefono</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Sito</TableHead>
                              <TableHead className="text-center">Rating</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead className="text-center">Scraping</TableHead>
                              <TableHead className="text-right">Azioni</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.map((r) => (
                              <TableRow
                                key={r.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => openLeadDetail(r)}
                              >
                                <TableCell className="font-medium">
                                  <span className="line-clamp-1">{r.businessName || "—"}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground line-clamp-1">{r.address || "—"}</span>
                                </TableCell>
                                <TableCell>
                                  {r.phone ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
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
                                    <span className="text-xs text-muted-foreground">—</span>
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
                                            className="h-7 px-2 text-xs"
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
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {r.website ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const url = r.website!.startsWith("http") ? r.website! : `https://${r.website}`;
                                        window.open(url, "_blank");
                                      }}
                                    >
                                      <Globe className="h-3 w-3 mr-1" />
                                      <span className="truncate max-w-[80px]">{r.website}</span>
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {r.rating ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                      <span className="text-xs">{r.rating}</span>
                                      {r.reviewsCount && (
                                        <span className="text-[10px] text-muted-foreground">({r.reviewsCount})</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground line-clamp-1">{r.category || "—"}</span>
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
                                              className="h-7 w-7"
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
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {selectedLead.businessName || "Lead senza nome"}
                </DialogTitle>
                <DialogDescription>
                  {selectedLead.category || "Categoria non disponibile"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoBlock icon={<MapPin className="h-4 w-4 text-muted-foreground" />} label="Indirizzo" value={selectedLead.address} />
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
                    icon={<Globe className="h-4 w-4" />}
                    label="Sito Web"
                    value={selectedLead.website}
                    link
                  />
                </div>

                <div className="flex items-center gap-4">
                  {selectedLead.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      <span className="font-semibold">{selectedLead.rating}</span>
                      {selectedLead.reviewsCount && (
                        <span className="text-sm text-muted-foreground">({selectedLead.reviewsCount} recensioni)</span>
                      )}
                    </div>
                  )}
                  {getScrapeStatusBadge(selectedLead.scrapeStatus)}
                </div>

                {selectedLead.websiteData && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Dati estratti dal sito web</h4>
                      <div className="space-y-3">
                        {selectedLead.websiteData.description && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Descrizione</Label>
                            <p className="text-sm mt-1">{selectedLead.websiteData.description}</p>
                          </div>
                        )}

                        {selectedLead.websiteData.emails?.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Email trovate</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {selectedLead.websiteData.emails.map((email: string, i: number) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-secondary/80"
                                  onClick={() => copyToClipboard(email)}
                                >
                                  <Mail className="h-3 w-3 mr-1" />{email}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedLead.websiteData.phones?.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Telefoni trovati</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {selectedLead.websiteData.phones.map((phone: string, i: number) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-secondary/80"
                                  onClick={() => copyToClipboard(phone)}
                                >
                                  <Phone className="h-3 w-3 mr-1" />{phone}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedLead.websiteData.socialLinks && Object.keys(selectedLead.websiteData.socialLinks).length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Social</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {Object.entries(selectedLead.websiteData.socialLinks).map(([platform, url]) => (
                                <Badge
                                  key={platform}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-muted"
                                  onClick={() => window.open(url as string, "_blank")}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />{platform}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedLead.websiteData.services?.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Servizi</Label>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {selectedLead.websiteData.services.map((svc: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">{svc}</Badge>
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
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
        {icon}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">Non disponibile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 group">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
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
          <p className="text-sm truncate">{value}</p>
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
