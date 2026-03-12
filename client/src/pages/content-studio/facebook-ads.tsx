import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Facebook,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MousePointer,
  Users,
  Eye,
  Target,
  RefreshCw,
  Loader2,
  Link2,
  Unlink,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  PauseCircle,
  Archive,
  XCircle,
  ShieldOff,
  BarChart3,
  ArrowUpDown,
  ExternalLink,
  Plug,
  PlugZap,
  ChevronRight,
  ChevronDown,
  X,
  Download,
  Search,
  LayoutGrid,
  Table2,
  Columns3,
  ImageIcon,
  Settings2,
  Repeat,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MetaAdsConfig {
  id: string;
  adAccountId: string;
  adAccountName: string;
  businessId: string;
  businessName: string;
  isConnected: boolean;
  connectedAt: string;
  syncEnabled: boolean;
  lastSyncedAt: string;
  syncError: string | null;
  tokenExpiresAt: string | null;
  tokenDaysLeft: number | null;
}

interface MetaAd {
  id: string;
  metaAdId: string;
  adName: string;
  campaignName: string;
  adsetName: string;
  adStatus: string;
  campaignStatus: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  conversions: number;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  cpl: number | null;
  frequency: number | null;
  roas: number | null;
  linkClicks: number | null;
  cpcLink: number | null;
  ctrLink: number | null;
  resultType: string | null;
  creativeThumbnailUrl: string | null;
  creativeBody: string | null;
  creativeTitle: string | null;
  lastSyncedAt: string;
}

interface AdsSummary {
  totalAds: number;
  activeAds: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalLeads: number;
  totalReach: number;
  totalLinkClicks: number;
  avgCpc: number;
  avgCtr: number;
  avgCpl: number;
  avgRoas: number;
}

interface UnlinkedPost {
  id: string;
  title: string;
  hook: string;
  platform: string;
  status: string;
  imageUrl: string | null;
  createdAt: string;
}

interface DailySnapshot {
  snapshotDate: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  roas: number | null;
  linkClicks: number | null;
  cpcLink: number | null;
  ctrLink: number | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("it-IT").format(value || 0);

const formatPercent = (value: number) =>
  `${(value || 0).toFixed(2)}%`;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVE: { label: "Attiva", color: "bg-green-500/10 text-green-600 border-green-300", icon: <CheckCircle className="h-3 w-3" /> },
  PAUSED: { label: "In Pausa", color: "bg-amber-500/10 text-amber-600 border-amber-300", icon: <PauseCircle className="h-3 w-3" /> },
  ARCHIVED: { label: "Archiviata", color: "bg-gray-500/10 text-gray-500 border-gray-300", icon: <Archive className="h-3 w-3" /> },
  CAMPAIGN_PAUSED: { label: "Campagna in Pausa", color: "bg-orange-500/10 text-orange-600 border-orange-300", icon: <PauseCircle className="h-3 w-3" /> },
  ADSET_PAUSED: { label: "Adset in Pausa", color: "bg-yellow-500/10 text-yellow-700 border-yellow-300", icon: <PauseCircle className="h-3 w-3" /> },
  DELETED: { label: "Eliminata", color: "bg-red-800/10 text-red-800 border-red-400", icon: <XCircle className="h-3 w-3" /> },
  DISAPPROVED: { label: "Non Approvata", color: "bg-red-500/10 text-red-600 border-red-300", icon: <ShieldOff className="h-3 w-3" /> },
  PENDING_REVIEW: { label: "In Revisione", color: "bg-blue-500/10 text-blue-600 border-blue-300", icon: <AlertCircle className="h-3 w-3" /> },
  WITH_ISSUES: { label: "Con Problemi", color: "bg-red-500/10 text-red-600 border-red-300", icon: <AlertTriangle className="h-3 w-3" /> },
};

function getStatusBadge(status: string) {
  const s = status?.toUpperCase();
  const cfg = STATUS_CONFIG[s];
  if (cfg) return <Badge className={`${cfg.color} gap-1`}>{cfg.icon}{cfg.label}</Badge>;
  return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" />{status || "N/D"}</Badge>;
}

const COLUMN_PRESETS: Record<string, { label: string; columns: string[] }> = {
  performance: {
    label: "Performance",
    columns: ["adName", "adStatus", "leads", "spend", "cpl", "roas"],
  },
  delivery: {
    label: "Delivery",
    columns: ["adName", "adStatus", "reach", "impressions", "frequency", "spend"],
  },
  engagement: {
    label: "Engagement",
    columns: ["adName", "clicks", "ctr", "linkClicks", "ctrLink", "cpcLink"],
  },
  complete: {
    label: "Completo",
    columns: ["adName", "adStatus", "spend", "impressions", "clicks", "linkClicks", "reach", "frequency", "ctr", "ctrLink", "cpc", "cpcLink", "cpm", "cpl", "roas", "leads", "dailyBudget"],
  },
};

const COLUMN_LABELS: Record<string, string> = {
  adName: "Nome Inserzione",
  campaignName: "Campagna",
  adsetName: "Adset",
  adStatus: "Stato",
  spend: "Spesa",
  dailyBudget: "Budget/g",
  impressions: "Impressions",
  clicks: "Clic (tutti)",
  linkClicks: "Clic Link",
  reach: "Copertura",
  frequency: "Frequenza",
  cpc: "CPC (tutti)",
  cpcLink: "CPC Link",
  cpm: "CPM",
  ctr: "CTR (tutti)",
  ctrLink: "CTR Link",
  cpl: "CPL",
  roas: "ROAS",
  leads: "Lead",
  conversions: "Conversioni",
  resultType: "Tipo Risultato",
};

function formatColumnValue(col: string, ad: MetaAd): string {
  const v = (ad as any)[col];
  if (v === null || v === undefined) return "—";
  switch (col) {
    case "adName": case "campaignName": case "adsetName": case "resultType": case "adStatus":
      return String(v);
    case "spend": case "cpc": case "cpcLink": case "cpm": case "cpl": case "dailyBudget":
      return formatCurrency(v);
    case "ctr": case "ctrLink":
      return formatPercent(v);
    case "roas":
      return `${Number(v).toFixed(2)}x`;
    case "frequency":
      return Number(v).toFixed(2);
    default:
      return formatNumber(v);
  }
}

export default function FacebookAdsPage({ embedded = false }: { embedded?: boolean }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const oauthError = params.get("meta_ads_error");
  const oauthConnected = params.get("meta_ads_connected");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("spend");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [linkDialogAd, setLinkDialogAd] = useState<MetaAd | null>(null);
  const [trendDays, setTrendDays] = useState(30);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [tablePreset, setTablePreset] = useState("performance");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [customColumns, setCustomColumns] = useState<string[]>(["adName", "adStatus", "spend", "impressions", "clicks", "ctr", "cpc", "leads"]);

  const activeColumns = useMemo(() => {
    if (tablePreset === "custom") return customColumns;
    return COLUMN_PRESETS[tablePreset]?.columns || COLUMN_PRESETS.performance.columns;
  }, [tablePreset, customColumns]);

  const toggleCustomColumn = (col: string) => {
    setCustomColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ["/api/meta-ads/config"],
    queryFn: async () => {
      const res = await fetch("/api/meta-ads/config", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
  });

  const config: MetaAdsConfig | null = configData?.config || null;
  const isConnected = config?.isConnected === true;

  const { data: adsData, isLoading: adsLoading } = useQuery({
    queryKey: ["/api/meta-ads/ads", statusFilter, sortBy],
    queryFn: async () => {
      const url = new URL("/api/meta-ads/ads", window.location.origin);
      if (statusFilter !== "all") url.searchParams.set("status", statusFilter);
      url.searchParams.set("sort", sortBy);
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch ads");
      return res.json();
    },
    enabled: isConnected,
  });

  const allAds: MetaAd[] = adsData?.ads || [];
  const summary: AdsSummary | null = adsData?.summary || null;

  const ads = useMemo(() => {
    if (!searchQuery.trim()) return allAds;
    const q = searchQuery.toLowerCase();
    return allAds.filter(ad =>
      (ad.adName || "").toLowerCase().includes(q) ||
      (ad.campaignName || "").toLowerCase().includes(q) ||
      (ad.adsetName || "").toLowerCase().includes(q)
    );
  }, [allAds, searchQuery]);

  const campaignGroups = useMemo(() => {
    const groups: Record<string, MetaAd[]> = {};
    for (const ad of ads) {
      const key = ad.campaignName || "Sconosciuta";
      if (!groups[key]) groups[key] = [];
      groups[key].push(ad);
    }
    return groups;
  }, [ads]);

  const { data: unlinkedData } = useQuery({
    queryKey: ["/api/meta-ads/unlinked-posts"],
    queryFn: async () => {
      const res = await fetch("/api/meta-ads/unlinked-posts", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isConnected,
  });
  const unlinkedPosts: UnlinkedPost[] = unlinkedData?.posts || [];

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["/api/meta-ads/ads", selectedAdId, trendDays],
    queryFn: async () => {
      const res = await fetch(`/api/meta-ads/ads/${selectedAdId}?days=${trendDays}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedAdId,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meta-ads/sync", { method: "POST", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Sincronizzazione completata", description: `${data.adsCount || 0} inserzioni aggiornate` });
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/ads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/config"] });
    },
    onError: () => toast({ title: "Errore", description: "Sincronizzazione fallita", variant: "destructive" }),
  });

  const linkMutation = useMutation({
    mutationFn: async ({ metaAdId, postId }: { metaAdId: string; postId: string }) => {
      const res = await fetch(`/api/meta-ads/ads/${metaAdId}/link-post`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) throw new Error("Link failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Post associato", description: "Il post e' stato collegato all'inserzione" });
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/ads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/unlinked-posts"] });
      setLinkDialogAd(null);
    },
    onError: () => toast({ title: "Errore", description: "Associazione fallita", variant: "destructive" }),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (metaAdId: string) => {
      const res = await fetch(`/api/meta-ads/ads/${metaAdId}/unlink-post`, { method: "POST", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Unlink failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Post scollegato" });
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/ads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/unlinked-posts"] });
    },
  });

  const { data: adAccountsData } = useQuery({
    queryKey: ["/api/meta-ads/oauth/ad-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/meta-ads/oauth/ad-accounts", { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isConnected,
  });

  const switchAccountMutation = useMutation({
    mutationFn: async ({ adAccountId, adAccountName }: { adAccountId: string; adAccountName: string }) => {
      const res = await fetch("/api/meta-ads/oauth/switch-account", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId, adAccountName }),
      });
      if (!res.ok) throw new Error("Switch failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Account cambiato", description: "Sincronizzazione in corso..." });
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/ads"] });
      syncMutation.mutate();
    },
    onError: () => toast({ title: "Errore", description: "Cambio account fallito", variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meta-ads/disconnect", { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Disconnect failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Account scollegato" });
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/ads"] });
    },
  });

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/meta-ads/oauth/start", { headers: getAuthHeaders() });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Errore", description: data.error || data.message || "OAuth non disponibile", variant: "destructive" });
        return;
      }
      const data = await res.json();
      window.location.href = data.authUrl;
    } catch {
      toast({ title: "Errore", description: "Impossibile avviare la connessione", variant: "destructive" });
    }
  };

  const [oauthHandled, setOauthHandled] = useState(false);
  
  if (oauthConnected === "true" && !oauthHandled) {
    setOauthHandled(true);
    setTimeout(() => {
      toast({ title: "Account Meta Ads collegato!", description: "Sincronizzazione in corso..." });
      syncMutation.mutate();
    }, 0);
  }

  const exportCSV = () => {
    const cols = tablePreset === "custom" ? customColumns : (COLUMN_PRESETS[tablePreset]?.columns || COLUMN_PRESETS.complete.columns);
    const headers = cols.map(c => COLUMN_LABELS[c] || c);
    const rows = ads.map(ad => cols.map(c => {
      if (c === "adStatus") {
        const cfg = STATUS_CONFIG[ad.adStatus?.toUpperCase()];
        return cfg?.label || ad.adStatus;
      }
      return formatColumnValue(c, ad).replace(/[€%]/g, "").trim();
    }));
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meta-ads-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dailyData: DailySnapshot[] = useMemo(() => {
    if (!detailData?.dailyData) return [];
    return detailData.dailyData.map((d: DailySnapshot) => ({
      ...d,
      snapshotDate: new Date(d.snapshotDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
    }));
  }, [detailData]);

  const toggleCampaign = (name: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const content = (
    <div className="space-y-6">
      {oauthError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Errore connessione Meta Ads</p>
            <p className="text-sm text-muted-foreground mt-1">{decodeURIComponent(oauthError)}</p>
          </div>
        </div>
      )}

      {configLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      ) : !isConnected ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30 mb-4">
              <Facebook className="h-12 w-12 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Collega il tuo Account Meta Ads</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Connetti il tuo Business Manager per visualizzare le performance delle tue inserzioni Facebook e Instagram direttamente qui.
            </p>
            <Button
              onClick={handleConnect}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-2"
            >
              <Plug className="h-5 w-5" />
              Collega Account Meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {config && config.tokenDaysLeft !== null && config.tokenDaysLeft <= 10 && (
            <div className={`rounded-lg p-4 flex items-start gap-3 ${
              config.tokenDaysLeft <= 0
                ? "bg-red-500/10 border border-red-500/30"
                : "bg-amber-500/10 border border-amber-500/30"
            }`}>
              <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                config.tokenDaysLeft <= 0 ? "text-red-600" : "text-amber-600"
              }`} />
              <div className="flex-1">
                <p className={`font-medium ${config.tokenDaysLeft <= 0 ? "text-red-600" : "text-amber-600"}`}>
                  {config.tokenDaysLeft <= 0
                    ? "Token Meta Ads scaduto"
                    : `Token Meta Ads scade tra ${config.tokenDaysLeft} giorni`
                  }
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {config.tokenDaysLeft <= 0
                    ? "La sincronizzazione e' stata interrotta. Ricollegati per ripristinare il servizio."
                    : "Clicca 'Rinnova ora' per tentare il rinnovo automatico del token."
                  }
                </p>
              </div>
              {config.tokenDaysLeft <= 0 ? (
                <Button size="sm" onClick={handleConnect} className="gap-1.5 bg-red-600 hover:bg-red-700 text-white flex-shrink-0">
                  <Plug className="h-4 w-4" />
                  Ricollegati
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
                >
                  {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Rinnova ora
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/30">
                <PlugZap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">{config?.businessName || config?.adAccountName || "Meta Ads"}</p>
                <p className="text-xs text-muted-foreground">
                  Account: {config?.adAccountId} - Ultima sync: {config?.lastSyncedAt ? new Date(config.lastSyncedAt).toLocaleString("it-IT") : "Mai"}
                </p>
              </div>
              {adAccountsData?.adAccounts && adAccountsData.adAccounts.length > 1 && (
                <Select
                  value={config?.adAccountId || ""}
                  onValueChange={(val) => {
                    const acc = adAccountsData.adAccounts.find((a: any) => a.id === val);
                    if (acc && acc.id !== config?.adAccountId) {
                      switchAccountMutation.mutate({ adAccountId: acc.id, adAccountName: acc.name });
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <Repeat className="h-3.5 w-3.5 mr-1" />
                    <SelectValue placeholder="Cambia account" />
                  </SelectTrigger>
                  <SelectContent>
                    {adAccountsData.adAccounts.map((acc: any) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name || acc.id} {acc.status === "inactive" ? "(inattivo)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {config?.syncError && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertCircle className="h-3 w-3" />Errore sync
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="gap-1.5"
              >
                {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sincronizza
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("Vuoi scollegare l'account Meta Ads? Tutte le associazioni post verranno rimosse.")) {
                    disconnectMutation.mutate();
                  }
                }}
                className="text-destructive hover:text-destructive gap-1.5"
              >
                <Unlink className="h-4 w-4" />
                Scollega
              </Button>
            </div>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="Spesa Totale" value={formatCurrency(summary.totalSpend)} icon={<DollarSign className="h-4 w-4" />} color="red" />
              <KpiCard label="CPC Medio" value={formatCurrency(summary.avgCpc)} icon={<MousePointer className="h-4 w-4" />} color="blue" />
              <KpiCard label="CTR Medio" value={formatPercent(summary.avgCtr)} icon={<TrendingUp className="h-4 w-4" />} color="green" />
              <KpiCard label="Lead Totali" value={formatNumber(summary.totalLeads)} icon={<Users className="h-4 w-4" />} color="purple" />
              <KpiCard label="ROAS Medio" value={summary.avgRoas ? `${summary.avgRoas.toFixed(2)}x` : "N/D"} icon={<Target className="h-4 w-4" />} color="amber" />
              <KpiCard label="CPL Medio" value={summary.avgCpl ? formatCurrency(summary.avgCpl) : "N/D"} icon={<DollarSign className="h-4 w-4" />} color="indigo" />
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-3 gap-1.5"
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="h-4 w-4" />
                Schede
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-3 gap-1.5"
                onClick={() => setViewMode("table")}
              >
                <Table2 className="h-4 w-4" />
                Tabella
              </Button>
            </div>

            {viewMode === "table" && (
              <>
                <Select value={tablePreset} onValueChange={setTablePreset}>
                  <SelectTrigger className="w-[160px]">
                    <Columns3 className="h-4 w-4 mr-1" />
                    <SelectValue placeholder="Preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COLUMN_PRESETS).map(([key, p]) => (
                      <SelectItem key={key} value={key}>{p.label}</SelectItem>
                    ))}
                    <SelectItem value="custom">Personalizzato</SelectItem>
                  </SelectContent>
                </Select>
                {tablePreset === "custom" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Settings2 className="h-4 w-4" />
                        Colonne ({customColumns.length})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3" align="start">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Seleziona colonne</p>
                      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                        {Object.entries(COLUMN_LABELS).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1">
                            <Checkbox
                              checked={customColumns.includes(key)}
                              onCheckedChange={() => toggleCustomColumn(key)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </>
            )}

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="ACTIVE">Attive</SelectItem>
                <SelectItem value="PAUSED">In Pausa</SelectItem>
                <SelectItem value="ARCHIVED">Archiviate</SelectItem>
                <SelectItem value="CAMPAIGN_PAUSED">Campagna in Pausa</SelectItem>
                <SelectItem value="ADSET_PAUSED">Adset in Pausa</SelectItem>
                <SelectItem value="DELETED">Eliminate</SelectItem>
                <SelectItem value="DISAPPROVED">Non Approvate</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spend">Spesa</SelectItem>
                <SelectItem value="cpc">CPC</SelectItem>
                <SelectItem value="ctr">CTR</SelectItem>
                <SelectItem value="roas">ROAS</SelectItem>
                <SelectItem value="frequency">Frequenza</SelectItem>
                <SelectItem value="leads">Lead</SelectItem>
                <SelectItem value="cpl">CPL</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca inserzione o campagna..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-4 w-4" />
              CSV
            </Button>

            <span className="text-sm text-muted-foreground">
              {ads.length} inserzioni
            </span>
          </div>

          {adsLoading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : ads.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nessuna inserzione trovata. Prova a sincronizzare.</p>
              </CardContent>
            </Card>
          ) : viewMode === "table" ? (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {activeColumns.map(col => (
                        <th key={col} className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                          {COLUMN_LABELS[col] || col}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(campaignGroups).map(([campaignName, campaignAds]) => {
                      const isExpanded = expandedCampaigns.has(campaignName);
                      const campSpend = campaignAds.reduce((s, a) => s + (a.spend || 0), 0);

                      return (
                        <TooltipProvider key={campaignName}>
                          <tr
                            className="border-b bg-muted/30 cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleCampaign(campaignName)}
                          >
                            <td className="px-3 py-2 font-semibold flex items-center gap-2" colSpan={activeColumns.length + 1}>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {campaignName} ({campaignAds.length} inserzioni) — {formatCurrency(campSpend)}
                            </td>
                          </tr>
                          {isExpanded && campaignAds.map(ad => (
                            <tr key={ad.id} className={`border-b hover:bg-muted/30 ${
                              (ad.frequency || 0) > 4 ? "bg-red-50/50 dark:bg-red-950/10" : ""
                            }`}>
                              {activeColumns.map(col => (
                                <td key={col} className="px-3 py-2 whitespace-nowrap">
                                  {col === "adStatus" ? (
                                    getStatusBadge(ad.adStatus)
                                  ) : col === "adName" ? (
                                    <div className="flex items-center gap-2 max-w-[250px]">
                                      {ad.creativeThumbnailUrl && (
                                        <img src={ad.creativeThumbnailUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                                      )}
                                      <span className="truncate font-medium">{ad.adName || "Inserzione"}</span>
                                      {(ad.frequency || 0) > 4 && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent>Ad Fatigue: Frequenza {ad.frequency?.toFixed(1)}</TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  ) : (
                                    formatColumnValue(col, ad)
                                  )}
                                </td>
                              ))}
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); setSelectedAdId(ad.metaAdId); }}>
                                    <BarChart3 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); setLinkDialogAd(ad); }}>
                                    <Link2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </TooltipProvider>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/50 font-semibold">
                      {activeColumns.map((col, idx) => (
                        <td key={col} className="px-3 py-2.5 whitespace-nowrap">
                          {idx === 0 ? `Totale (${ads.length})` :
                           col === "adStatus" ? "" :
                           col === "spend" ? formatCurrency(summary?.totalSpend || 0) :
                           col === "impressions" ? formatNumber(summary?.totalImpressions || 0) :
                           col === "clicks" ? formatNumber(summary?.totalClicks || 0) :
                           col === "linkClicks" ? formatNumber(summary?.totalLinkClicks || 0) :
                           col === "reach" ? formatNumber(summary?.totalReach || 0) :
                           col === "leads" ? formatNumber(summary?.totalLeads || 0) :
                           col === "cpc" ? formatCurrency(summary?.avgCpc || 0) :
                           col === "ctr" ? formatPercent(summary?.avgCtr || 0) :
                           col === "cpl" ? (summary?.avgCpl ? formatCurrency(summary.avgCpl) : "—") :
                           col === "roas" ? (summary?.avgRoas ? `${summary.avgRoas.toFixed(2)}x` : "—") :
                           ""}
                        </td>
                      ))}
                      <td className="px-3 py-2.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ) : (
            <div className="grid gap-3">
              {ads.map((ad) => (
                <Card key={ad.id} className={`hover:shadow-md transition-shadow ${
                  (ad.frequency || 0) > 4 ? "border-red-300 dark:border-red-800" : ""
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3 flex-1 min-w-0">
                        {ad.creativeThumbnailUrl && (
                          <img
                            src={ad.creativeThumbnailUrl}
                            alt={ad.adName || ""}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold truncate">{ad.adName || "Inserzione"}</h3>
                            {getStatusBadge(ad.adStatus)}
                            {(ad.frequency || 0) > 4 && (
                              <Badge className="bg-red-500/10 text-red-600 border-red-300 gap-1">
                                <AlertTriangle className="h-3 w-3" />Ad Fatigue
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mb-3">
                            {ad.campaignName && <span>Campagna: {ad.campaignName}</span>}
                            {ad.adsetName && <span className="ml-2">- Adset: {ad.adsetName}</span>}
                          </p>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                            <MetricCell label="Spesa" value={formatCurrency(ad.spend)} />
                            <MetricCell label="Impressions" value={formatNumber(ad.impressions)} />
                            <MetricCell label="Click" value={formatNumber(ad.clicks)} />
                            <MetricCell label="CTR" value={formatPercent(ad.ctr || 0)} />
                            <MetricCell label="CPC" value={formatCurrency(ad.cpc || 0)} />
                            <MetricCell label="Lead" value={formatNumber(ad.leads)} />
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center mt-2 pt-2 border-t border-dashed">
                            <MetricCell label="Copertura" value={formatNumber(ad.reach)} />
                            <MetricCell label="Frequenza" value={ad.frequency?.toFixed(2) || "—"} highlight={(ad.frequency || 0) > 4} />
                            <MetricCell label="ROAS" value={ad.roas ? `${ad.roas.toFixed(2)}x` : "—"} />
                            <MetricCell label="CPL" value={ad.cpl ? formatCurrency(ad.cpl) : "—"} />
                            <MetricCell label="Clic Link" value={formatNumber(ad.linkClicks || 0)} />
                            <MetricCell label="Budget/g" value={ad.dailyBudget ? formatCurrency(ad.dailyBudget) : "—"} />
                          </div>
                          {ad.dailyBudget && ad.dailyBudget > 0 && (
                            <div className="mt-2">
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                                <span>Utilizzo budget</span>
                                <span>{Math.min(100, ((ad.spend / ad.dailyBudget) * 100)).toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    (ad.spend / ad.dailyBudget) > 1 ? "bg-red-500" :
                                    (ad.spend / ad.dailyBudget) > 0.8 ? "bg-amber-500" : "bg-green-500"
                                  }`}
                                  style={{ width: `${Math.min(100, (ad.spend / ad.dailyBudget) * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSelectedAdId(ad.metaAdId)}>
                          <BarChart3 className="h-4 w-4" />
                          <span className="hidden sm:inline">Dettaglio</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setLinkDialogAd(ad)}>
                          <Link2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Associa</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {unlinkedPosts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Post senza Inserzione ({unlinkedPosts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {unlinkedPosts.slice(0, 10).map((post) => (
                  <div key={post.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{post.title || post.hook || "Post senza titolo"}</p>
                      <p className="text-xs text-muted-foreground">{post.platform} - {post.status}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 flex-shrink-0"
                      onClick={() => {
                        toast({ title: "Associa da inserzione", description: "Vai alla scheda di un'inserzione e clicca 'Associa' per collegare questo post" });
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Info
                    </Button>
                  </div>
                ))}
                {unlinkedPosts.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    e altri {unlinkedPosts.length - 10} post...
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={!!selectedAdId} onOpenChange={(open) => { if (!open) setSelectedAdId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Dettaglio Inserzione
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-4 py-6">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : detailData?.ad ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                {detailData.ad.creativeThumbnailUrl && (
                  <img
                    src={detailData.ad.creativeThumbnailUrl}
                    alt={detailData.ad.adName}
                    className="w-20 h-20 rounded-lg object-cover border"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-bold text-lg">{detailData.ad.adName}</h3>
                      <p className="text-sm text-muted-foreground">{detailData.ad.campaignName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(detailData.ad.adStatus)}
                      {(detailData.ad.frequency || 0) > 4 && (
                        <Badge className="bg-red-500/10 text-red-600 border-red-300 gap-1">
                          <AlertTriangle className="h-3 w-3" />Ad Fatigue
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniKpi label="Spesa" value={formatCurrency(detailData.ad.spend)} />
                <MiniKpi label="CPC" value={formatCurrency(detailData.ad.cpc || 0)} />
                <MiniKpi label="CTR" value={formatPercent(detailData.ad.ctr || 0)} />
                <MiniKpi label="ROAS" value={detailData.ad.roas ? `${detailData.ad.roas.toFixed(2)}x` : "N/D"} />
                <MiniKpi label="Impressions" value={formatNumber(detailData.ad.impressions)} />
                <MiniKpi label="Copertura" value={formatNumber(detailData.ad.reach)} />
                <MiniKpi label="Frequenza" value={detailData.ad.frequency?.toFixed(2) || "N/D"} highlight={(detailData.ad.frequency || 0) > 4} />
                <MiniKpi label="Lead" value={formatNumber(detailData.ad.leads)} />
                <MiniKpi label="CPL" value={detailData.ad.cpl ? formatCurrency(detailData.ad.cpl) : "N/D"} />
                <MiniKpi label="Clic Link" value={formatNumber(detailData.ad.linkClicks || 0)} />
                <MiniKpi label="CPC Link" value={detailData.ad.cpcLink ? formatCurrency(detailData.ad.cpcLink) : "N/D"} />
                <MiniKpi label="CTR Link" value={detailData.ad.ctrLink ? formatPercent(detailData.ad.ctrLink) : "N/D"} />
              </div>

              {detailData.linkedPost && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <Link2 className="h-4 w-4 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{detailData.linkedPost.title || detailData.linkedPost.hook}</p>
                    <p className="text-xs text-muted-foreground">{detailData.linkedPost.platform}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => unlinkMutation.mutate(detailData.ad.metaAdId)}>
                    <Unlink className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">Trend Storico</h4>
                  <Select value={String(trendDays)} onValueChange={(v) => setTrendDays(Number(v))}>
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 giorni</SelectItem>
                      <SelectItem value="14">14 giorni</SelectItem>
                      <SelectItem value="30">30 giorni</SelectItem>
                      <SelectItem value="90">90 giorni</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="snapshotDate" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#ef4444" name="Spesa" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#22c55e" name="CTR %" strokeWidth={2} dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="cpc" stroke="#3b82f6" name="CPC" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="roas" stroke="#f59e0b" name="ROAS" strokeWidth={2} dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="leads" stroke="#8b5cf6" name="Lead" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                    Nessun dato storico disponibile
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Inserzione non trovata</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkDialogAd} onOpenChange={(open) => { if (!open) { setLinkDialogAd(null); setLinkSearchQuery(""); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Associa Post a "{linkDialogAd?.adName}"
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cerca post..."
              value={linkSearchQuery}
              onChange={e => setLinkSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {unlinkedPosts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessun post disponibile da associare.
            </p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {unlinkedPosts
                .filter(p => {
                  if (!linkSearchQuery.trim()) return true;
                  const q = linkSearchQuery.toLowerCase();
                  return (p.title || "").toLowerCase().includes(q) || (p.hook || "").toLowerCase().includes(q);
                })
                .map((post) => (
                <button
                  key={post.id}
                  onClick={() => {
                    if (linkDialogAd) {
                      linkMutation.mutate({ metaAdId: linkDialogAd.metaAdId, postId: post.id });
                    }
                  }}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
                  disabled={linkMutation.isPending}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{post.title || post.hook || "Post senza titolo"}</p>
                    <p className="text-xs text-muted-foreground">{post.platform} - {post.status}</p>
                  </div>
                  {linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 text-muted-foreground" />}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  if (embedded) {
    return <div className="p-4 sm:p-6">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <Facebook className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Facebook Ads</h1>
                <p className="text-sm text-muted-foreground">Monitora le performance delle tue inserzioni Meta</p>
              </div>
            </div>
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    red: "from-red-100 to-red-50 dark:from-red-950/30 dark:to-red-950/10 text-red-600",
    blue: "from-blue-100 to-blue-50 dark:from-blue-950/30 dark:to-blue-950/10 text-blue-600",
    green: "from-green-100 to-green-50 dark:from-green-950/30 dark:to-green-950/10 text-green-600",
    purple: "from-purple-100 to-purple-50 dark:from-purple-950/30 dark:to-purple-950/10 text-purple-600",
    amber: "from-amber-100 to-amber-50 dark:from-amber-950/30 dark:to-amber-950/10 text-amber-600",
    indigo: "from-indigo-100 to-indigo-50 dark:from-indigo-950/30 dark:to-indigo-950/10 text-indigo-600",
  };
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className={`p-1.5 rounded-lg bg-gradient-to-br ${colorMap[color] || colorMap.blue}`}>{icon}</div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg sm:text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function MetricCell({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}

function MiniKpi({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-2.5 rounded-lg ${highlight ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800" : "bg-muted/50"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${highlight ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}
