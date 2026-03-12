import React, { useState, useMemo } from "react";
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
  ChevronLeft,
  ChevronDown,
  EyeOff,
  FileJson,
  X,
  Download,
  Search,
  LayoutGrid,
  Table2,
  Columns3,
  ImageIcon,
  Settings2,
  Repeat,
  FolderOpen,
  Layers,
  Megaphone,
  Home,
  MessageCircle,
  Bot,
  BotOff,
} from "lucide-react";
import AgentChat from "@/components/autonomy/AgentChat";
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
  videoViews: number | null;
  creativeThumbnailUrl: string | null;
  creativeBody: string | null;
  creativeTitle: string | null;
  lastSyncedAt: string;
  dateStart: string | null;
  dateStop: string | null;
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
  body: string | null;
  cta: string | null;
  folderId: string | null;
}

interface UnlinkedFolder {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  folderType: string | null;
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
  DELETED: { label: "Eliminata", color: "bg-red-800/10 text-red-800 border-red-400", icon: <XCircle className="h-3 w-3" /> }, // kept for display only; Meta API does not return DELETED ads
  DISAPPROVED: { label: "Non Approvata", color: "bg-red-500/10 text-red-600 border-red-300", icon: <ShieldOff className="h-3 w-3" /> },
  PENDING_REVIEW: { label: "In Revisione", color: "bg-blue-500/10 text-blue-600 border-blue-300", icon: <AlertCircle className="h-3 w-3" /> },
  WITH_ISSUES: { label: "Con Problemi", color: "bg-red-500/10 text-red-600 border-red-300", icon: <AlertTriangle className="h-3 w-3" /> },
};

function MiniKpi({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-md px-2 py-1.5 ${highlight ? "bg-red-100 dark:bg-red-900/20" : "bg-muted/40"}`}>
      <p className={`text-[10px] font-medium ${highlight ? "text-red-600" : "text-muted-foreground"}`}>{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-red-700" : ""}`}>{value}</p>
    </div>
  );
}

function renderCellValue(col: string, val: unknown, row: AggRow, activeTab: string): React.ReactNode {
  if (col === "name") {
    return (
      <div className="flex items-center gap-2 max-w-[320px]">
        {activeTab === "ads" && row.creativeThumbnailUrl && (
          <img src={row.creativeThumbnailUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
        )}
        <span className="truncate text-blue-700 dark:text-blue-400 hover:underline cursor-pointer font-medium">
          {row.name}
        </span>
      </div>
    );
  } else if (col === "pubblicazione") {
    return (
      <span className={`text-xs ${row.pubblicazione === "Attiva" ? "text-green-600" : "text-muted-foreground"}`}>
        {row.pubblicazione}
      </span>
    );
  } else if (col === "budget") {
    return (
      <span className="text-xs text-muted-foreground max-w-[180px] truncate block">
        {row.budget}
      </span>
    );
  } else if (col === "risultati" || col === "costoPer" || col === "resultType") {
    return <span className="text-xs">{String(val ?? "—")}</span>;
  } else if (col === "dateStart" || col === "dateStop") {
    return val ? <span className="text-xs">{String(val)}</span> : "—";
  } else if (col === "spend" || col === "cpc" || col === "cpcLink" || col === "cpm" || col === "cpl" || col === "lifetimeBudget") {
    return val != null ? formatCurrency(Number(val)) : "—";
  } else if (col === "ctr" || col === "ctrLink") {
    return val != null ? formatPercent(Number(val)) : "—";
  } else if (col === "frequency") {
    const freq = val != null ? Number(val) : null;
    return freq != null ? (
      <span className={freq > 4 ? "text-red-600 font-semibold" : ""}>
        {freq.toFixed(2)}
        {freq > 4 && <AlertTriangle className="inline h-3 w-3 ml-1 text-red-500" />}
      </span>
    ) : "—";
  } else if (col === "roas") {
    return val != null ? `${Number(val).toFixed(2)}x` : "—";
  } else if (typeof val === "number") {
    return formatNumber(val);
  }
  return val != null ? String(val) : "—";
}

function AdTableRow({ row, activeColumns, activeTab, ads, setSelectedAdId, setLinkDialogAd, onRowClick, isSelected, onSelectToggle, rowKey }: {
  row: AggRow;
  activeColumns: string[];
  activeTab: string;
  ads: MetaAd[];
  setSelectedAdId: (id: string) => void;
  setLinkDialogAd: (ad: MetaAd) => void;
  onRowClick?: () => void;
  isSelected?: boolean;
  onSelectToggle?: (key: string) => void;
  rowKey: string;
}) {
  return (
    <tr className={`border-b hover:bg-blue-50/40 dark:hover:bg-blue-950/10 transition-colors group ${
      onRowClick ? "cursor-pointer" : ""
    } ${
      row.frequency != null && row.frequency > 4 ? "bg-red-50/40 dark:bg-red-950/10" : ""
    } ${
      isSelected ? "bg-blue-50/60 dark:bg-blue-950/20" : ""
    }`} onClick={onRowClick}>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          className="h-3.5 w-3.5"
          checked={isSelected || false}
          onCheckedChange={() => onSelectToggle?.(rowKey)}
        />
      </td>
      {activeColumns.map(col => {
        const val = (row as Record<string, unknown>)[col];
        return (
          <td key={col} className="px-3 py-2 whitespace-nowrap text-[13px]">
            {renderCellValue(col, val, row, activeTab)}
          </td>
        );
      })}
      {activeTab === "ads" && (
        <td className="px-3 py-2 whitespace-nowrap">
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => row.metaAdId && setSelectedAdId(row.metaAdId)}>
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
              const ad = ads.find(a => a.metaAdId === row.metaAdId);
              if (ad) setLinkDialogAd(ad);
            }}>
              <Link2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

function getStatusBadge(status: string) {
  const s = status?.toUpperCase();
  const cfg = STATUS_CONFIG[s];
  if (cfg) return <Badge className={`${cfg.color} gap-1`}>{cfg.icon}{cfg.label}</Badge>;
  return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" />{status || "N/D"}</Badge>;
}

const COLUMN_PRESETS: Record<string, { label: string; columns: string[] }> = {
  performance: {
    label: "Prestazioni",
    columns: ["name", "pubblicazione", "risultati", "costoPer", "spend", "roas", "impressions", "reach"],
  },
  delivery: {
    label: "Distribuzione",
    columns: ["name", "pubblicazione", "spend", "impressions", "reach", "frequency", "cpm"],
  },
  engagement: {
    label: "Interazioni",
    columns: ["name", "pubblicazione", "clicks", "ctr", "linkClicks", "ctrLink", "cpcLink", "spend"],
  },
  video: {
    label: "Video",
    columns: ["name", "pubblicazione", "videoViews", "reach", "impressions", "spend", "cpm", "ctr"],
  },
  complete: {
    label: "Completo",
    columns: ["name", "pubblicazione", "risultati", "costoPer", "budget", "spend", "impressions", "clicks", "linkClicks", "reach", "frequency", "ctr", "ctrLink", "cpc", "cpcLink", "cpm", "cpl", "roas", "leads", "conversions", "videoViews", "resultType", "dateStart", "dateStop", "lifetimeBudget"],
  },
};

const COLUMN_LABELS: Record<string, string> = {
  name: "Nome",
  adName: "Nome Inserzione",
  campaignName: "Campagna",
  adsetName: "Gruppo",
  pubblicazione: "Pubblicazione",
  adStatus: "Stato",
  risultati: "Risultati",
  costoPer: "Costo per risultato",
  budget: "Budget",
  spend: "Importo speso",
  dailyBudget: "Budget/g",
  impressions: "Impressioni",
  clicks: "Clic (tutti)",
  linkClicks: "Clic sul link",
  reach: "Copertura",
  frequency: "Frequenza",
  cpc: "CPC (tutti)",
  cpcLink: "CPC link",
  cpm: "CPM",
  ctr: "CTR (tutti)",
  ctrLink: "CTR link",
  cpl: "CPL",
  roas: "ROAS",
  leads: "Lead",
  conversions: "Conversioni",
  resultType: "Tipo Risultato",
  videoViews: "Visualizzazioni Video",
  dateStart: "Data Inizio",
  dateStop: "Data Fine",
  lifetimeBudget: "Budget Totale",
};

interface AggRow {
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  linkClicks: number;
  frequency: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  ctrLink: number | null;
  cpcLink: number | null;
  cpl: number | null;
  roas: number | null;
  budget: string;
  risultati: string;
  costoPer: string;
  pubblicazione: string;
  videoViews: number;
  adsCount: number;
  dailyBudget: number | null;
  campaignName?: string;
  adsetName?: string;
  metaAdId?: string;
  creativeThumbnailUrl?: string | null;
  id?: string;
  resultType?: string | null;
  conversions?: number;
  lifetimeBudget?: number | null;
  dateStart?: string | null;
  dateStop?: string | null;
}

function aggregateAds(adsArr: MetaAd[]): Omit<AggRow, "name" | "status" | "budget" | "risultati" | "costoPer" | "pubblicazione" | "adsCount"> {
  const spend = adsArr.reduce((s, a) => s + (a.spend || 0), 0);
  const impressions = adsArr.reduce((s, a) => s + (a.impressions || 0), 0);
  const clicks = adsArr.reduce((s, a) => s + (a.clicks || 0), 0);
  const reach = adsArr.reduce((s, a) => s + (a.reach || 0), 0);
  const leads = adsArr.reduce((s, a) => s + (a.leads || 0), 0);
  const linkClicks = adsArr.reduce((s, a) => s + (a.linkClicks || 0), 0);
  const videoViews = adsArr.reduce((s, a) => s + (a.videoViews || 0), 0);
  return {
    spend, impressions, clicks, reach, leads, linkClicks, videoViews,
    frequency: impressions > 0 && reach > 0 ? impressions / reach : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    ctrLink: impressions > 0 && linkClicks > 0 ? (linkClicks / impressions) * 100 : null,
    cpcLink: linkClicks > 0 ? spend / linkClicks : null,
    cpl: leads > 0 ? spend / leads : null,
    roas: null,
    dailyBudget: null,
  };
}

function formatColumnValue(col: string, row: Record<string, unknown>): string {
  const v = row[col];
  if (v === null || v === undefined) return "—";
  switch (col) {
    case "name": case "adName": case "campaignName": case "adsetName": case "resultType": case "adStatus": case "pubblicazione": case "risultati": case "costoPer": case "budget":
      return String(v);
    case "spend": case "cpc": case "cpcLink": case "cpm": case "cpl": case "dailyBudget":
      return formatCurrency(Number(v));
    case "ctr": case "ctrLink":
      return formatPercent(Number(v));
    case "roas":
      return `${Number(v).toFixed(2)}x`;
    case "frequency":
      return Number(v).toFixed(2);
    default:
      return formatNumber(Number(v));
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
  const [dateRange, setDateRange] = useState<string>("lifetime");
  const [activeTab, setActiveTab] = useState<"campaigns" | "adsets" | "ads">("campaigns");
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const [collapsedCampaigns, setCollapsedCampaigns] = useState<Set<string>>(new Set());
  const [tablePreset, setTablePreset] = useState("performance");
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [linkPostTarget, setLinkPostTarget] = useState<UnlinkedPost | null>(null);
  const [linkPostSearch, setLinkPostSearch] = useState("");
  const [unlinkedPage, setUnlinkedPage] = useState(1);
  const [previewPost, setPreviewPost] = useState<UnlinkedPost | null>(null);
  const [customColumns, setCustomColumns] = useState<string[]>(["name", "pubblicazione", "spend", "impressions", "clicks", "ctr", "cpc", "leads"]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [simoneChatOpen, setSimoneChatOpen] = useState(false);
  const [showHiddenCampaigns, setShowHiddenCampaigns] = useState(false);

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
    queryKey: ["/api/meta-ads/ads", statusFilter, sortBy, dateRange],
    queryFn: async () => {
      const url = new URL("/api/meta-ads/ads", window.location.origin);
      if (statusFilter !== "all") url.searchParams.set("status", statusFilter);
      url.searchParams.set("sort", sortBy);
      if (dateRange !== "lifetime") url.searchParams.set("days", dateRange);
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch ads");
      return res.json();
    },
    enabled: isConnected,
  });

  const { data: hiddenData } = useQuery({
    queryKey: ["/api/meta-ads/hidden-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/meta-ads/hidden-campaigns", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isConnected,
  });
  const hiddenCampaigns: string[] = hiddenData?.hiddenCampaigns || [];

  const hiddenMutation = useMutation({
    mutationFn: async (campaigns: string[]) => {
      const res = await fetch("/api/meta-ads/hidden-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ hiddenCampaigns: campaigns }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/hidden-campaigns"] });
    },
  });

  const { data: aiExcludedData } = useQuery({
    queryKey: ["/api/meta-ads/ai-excluded-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/meta-ads/ai-excluded-campaigns", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isConnected,
  });
  const rawExcluded = aiExcludedData?.aiExcludedCampaigns;
  const aiExcludedCampaigns: string[] = Array.isArray(rawExcluded) ? rawExcluded : [];

  const aiExcludedMutation = useMutation({
    mutationFn: async (campaigns: string[]) => {
      const res = await fetch("/api/meta-ads/ai-excluded-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ aiExcludedCampaigns: campaigns }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meta-ads/ai-excluded-campaigns"] });
    },
  });

  const rawAllAds: MetaAd[] = adsData?.ads || [];
  const rawSummary: AdsSummary | null = adsData?.summary || null;

  const allAds = useMemo(() => {
    if (hiddenCampaigns.length === 0) return rawAllAds;
    const hiddenSet = new Set(hiddenCampaigns);
    return rawAllAds.filter(ad => !hiddenSet.has(ad.campaignName || ""));
  }, [rawAllAds, hiddenCampaigns]);

  const summary: AdsSummary | null = useMemo(() => {
    if (!rawSummary) return null;
    if (hiddenCampaigns.length === 0) return rawSummary;
    const totalSpend = allAds.reduce((s, a) => s + (a.spend || 0), 0);
    const totalClicks = allAds.reduce((s, a) => s + (a.clicks || 0), 0);
    const totalImpressions = allAds.reduce((s, a) => s + (a.impressions || 0), 0);
    const totalLeads = allAds.reduce((s, a) => s + (a.leads || 0), 0);
    return {
      ...rawSummary,
      totalSpend,
      totalClicks,
      totalImpressions,
      totalLeads,
      totalAds: allAds.length,
      activeAds: allAds.filter(a => a.adStatus === "ACTIVE").length,
      avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      avgCpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      avgRoas: 0,
    };
  }, [rawSummary, allAds, hiddenCampaigns]);

  const allCampaignNames = useMemo(() => {
    const names = new Set<string>();
    rawAllAds.forEach(ad => { if (ad.campaignName) names.add(ad.campaignName); });
    return Array.from(names).sort();
  }, [rawAllAds]);

  const ads = useMemo(() => {
    let filtered = allAds;
    if (selectedCampaign) {
      filtered = filtered.filter(ad => ad.campaignName === selectedCampaign);
    }
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(ad =>
      (ad.adName || "").toLowerCase().includes(q) ||
      (ad.campaignName || "").toLowerCase().includes(q) ||
      (ad.adsetName || "").toLowerCase().includes(q)
    );
  }, [allAds, searchQuery, selectedCampaign]);

  const campaignRows: AggRow[] = useMemo(() => {
    const map: Record<string, MetaAd[]> = {};
    for (const ad of ads) {
      const key = ad.campaignName || "Sconosciuta";
      if (!map[key]) map[key] = [];
      map[key].push(ad);
    }
    return Object.entries(map).map(([cName, cAds]) => {
      const agg = aggregateAds(cAds);
      const status = cAds[0]?.campaignStatus || "";
      const hasAdsetBudgets = cAds.some(a => a.dailyBudget);
      const budget = hasAdsetBudgets ? "Uso del budget del gruppo di inserzioni" : (cAds[0]?.dailyBudget ? formatCurrency(cAds[0].dailyBudget) + " Giornaliero" : "—");
      return {
        ...agg,
        name: cName,
        status,
        budget,
        risultati: agg.leads > 0 ? String(agg.leads) : "—",
        costoPer: agg.cpl ? formatCurrency(agg.cpl) : "—",
        pubblicazione: status === "ACTIVE" ? "Attiva" : "Non attiva",
        adsCount: cAds.length,
      };
    });
  }, [ads]);

  const adsetRows: AggRow[] = useMemo(() => {
    const map: Record<string, MetaAd[]> = {};
    for (const ad of ads) {
      const key = `${ad.campaignName}::${ad.adsetName || "Sconosciuto"}`;
      if (!map[key]) map[key] = [];
      map[key].push(ad);
    }
    return Object.entries(map).map(([key, asAds]) => {
      const agg = aggregateAds(asAds);
      const [campName, asName] = key.split("::");
      const budget = asAds[0]?.dailyBudget ? formatCurrency(asAds[0].dailyBudget) + " Giornaliero" : (asAds[0]?.lifetimeBudget ? formatCurrency(asAds[0].lifetimeBudget) + " Lifetime" : "—");
      return {
        ...agg,
        name: asName,
        campaignName: campName,
        status: asAds[0]?.adStatus || "",
        budget,
        risultati: agg.leads > 0 ? String(agg.leads) : "—",
        costoPer: agg.cpl ? formatCurrency(agg.cpl) : "—",
        pubblicazione: asAds.some(a => a.adStatus === "ACTIVE") ? "Attiva" : "Non attiva",
        adsCount: asAds.length,
      };
    });
  }, [ads]);

  const adRows: AggRow[] = useMemo(() => {
    return ads.map(ad => ({
      name: ad.adName || "Inserzione",
      status: ad.adStatus,
      spend: ad.spend,
      impressions: ad.impressions,
      clicks: ad.clicks,
      reach: ad.reach,
      leads: ad.leads,
      linkClicks: ad.linkClicks || 0,
      frequency: ad.frequency,
      cpc: ad.cpc,
      cpm: ad.cpm,
      ctr: ad.ctr,
      ctrLink: ad.ctrLink,
      cpcLink: ad.cpcLink,
      cpl: ad.cpl,
      roas: ad.roas,
      videoViews: ad.videoViews || 0,
      budget: ad.dailyBudget ? formatCurrency(ad.dailyBudget) + " Giornaliero" : "—",
      risultati: ad.leads > 0 ? String(ad.leads) : "—",
      costoPer: ad.cpl ? formatCurrency(ad.cpl) : "—",
      pubblicazione: ad.adStatus === "ACTIVE" ? "Attiva" : "Non attiva",
      adsCount: 1,
      dailyBudget: ad.dailyBudget,
      campaignName: ad.campaignName,
      adsetName: ad.adsetName,
      metaAdId: ad.metaAdId,
      creativeThumbnailUrl: ad.creativeThumbnailUrl,
      id: ad.id,
      resultType: ad.resultType,
      conversions: ad.conversions,
      lifetimeBudget: ad.lifetimeBudget,
      dateStart: ad.dateStart,
      dateStop: ad.dateStop,
    }));
  }, [ads]);

  const currentRows: AggRow[] = useMemo(() => {
    const rows = activeTab === "campaigns" ? campaignRows : activeTab === "adsets" ? adsetRows : adRows;
    if (!sortColumn) return rows;
    return [...rows].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortColumn];
      const vb = (b as Record<string, unknown>)[sortColumn];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string" && typeof vb === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
  }, [activeTab, campaignRows, adsetRows, adRows, sortColumn, sortDir]);

  const groupedByCampaign = useMemo(() => {
    if (activeTab !== "ads") return null;
    const groups: { campaignName: string; rows: AggRow[]; agg: ReturnType<typeof aggregateAds> }[] = [];
    const map = new Map<string, AggRow[]>();
    for (const row of currentRows) {
      const key = row.campaignName || "Senza Campagna";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    for (const [campaignName, rows] of map) {
      const fakeAds = rows.map(r => ({
        spend: r.spend, impressions: r.impressions, clicks: r.clicks,
        reach: r.reach, leads: r.leads, linkClicks: r.linkClicks,
        frequency: r.frequency, cpc: r.cpc, cpm: r.cpm, ctr: r.ctr,
        ctrLink: r.ctrLink, cpcLink: r.cpcLink, cpl: r.cpl, roas: r.roas,
        dailyBudget: r.dailyBudget, videoViews: r.videoViews,
      })) as MetaAd[];
      groups.push({ campaignName, rows, agg: aggregateAds(fakeAds) });
    }
    return groups;
  }, [activeTab, currentRows]);

  const toggleCampaignCollapse = (name: string) => {
    setCollapsedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const getRowKey = (row: AggRow, idx: number) => {
    if (activeTab === "ads") return row.metaAdId || `ad-${idx}`;
    if (activeTab === "adsets") return `${row.campaignName}::${row.name}`;
    return row.name;
  };

  const toggleRowSelect = (key: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allCurrentKeys = useMemo(() => currentRows.map((r, i) => getRowKey(r, i)), [currentRows, activeTab]);
  const allSelected = allCurrentKeys.length > 0 && allCurrentKeys.every(k => selectedRows.has(k));
  const someSelected = allCurrentKeys.some(k => selectedRows.has(k));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(allCurrentKeys));
    }
  };

  const handleColumnSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDir("desc");
    }
  };

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
  const unlinkedFolders: UnlinkedFolder[] = unlinkedData?.folders || [];

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
    const cols = activeColumns;
    const headers = cols.map(c => COLUMN_LABELS[c] || c);
    const rows = currentRows.map(row => cols.map(c => {
      const v = (row as Record<string, unknown>)[c];
      if (v === null || v === undefined) return "";
      if (c === "spend" || c === "cpc" || c === "cpcLink" || c === "cpm" || c === "cpl") return String(v);
      if (c === "ctr" || c === "ctrLink") return String(v);
      if (c === "frequency") return v != null ? Number(v).toFixed(2) : "";
      return String(v);
    }));
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meta-ads-${activeTab}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCampaignData = async (campaignName: string) => {
    try {
      const res = await fetch(`/api/meta-ads/campaign-export/${encodeURIComponent(campaignName)}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campagna-${campaignName.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download campaign data error:", e);
    }
  };

  const dailyData: DailySnapshot[] = useMemo(() => {
    if (!detailData?.dailyData) return [];
    return detailData.dailyData.map((d: DailySnapshot) => ({
      ...d,
      snapshotDate: new Date(d.snapshotDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
    }));
  }, [detailData]);


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
                onClick={() => setSimoneChatOpen(true)}
                className="gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
              >
                <MessageCircle className="h-4 w-4" />
                Chiedi a Simone
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHiddenCampaigns(true)}
                className="gap-1.5"
              >
                <EyeOff className="h-4 w-4" />
                Nascondi Campagne
                {hiddenCampaigns.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{hiddenCampaigns.length}</Badge>
                )}
              </Button>
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Periodo</span>
                <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
                  {[
                    { key: "1", label: "Oggi" },
                    { key: "7", label: "7gg" },
                    { key: "30", label: "30gg" },
                    { key: "90", label: "90gg" },
                    { key: "lifetime", label: "Lifetime" },
                  ].map(d => (
                    <button
                      key={d.key}
                      onClick={() => setDateRange(d.key)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        dateRange === d.key
                          ? "bg-white dark:bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="Spesa Totale" value={formatCurrency(summary.totalSpend)} icon={<DollarSign className="h-4 w-4" />} color="red" />
                <KpiCard label="CPC Medio" value={formatCurrency(summary.avgCpc)} icon={<MousePointer className="h-4 w-4" />} color="blue" />
                <KpiCard label="CTR Medio" value={formatPercent(summary.avgCtr)} icon={<TrendingUp className="h-4 w-4" />} color="green" />
                <KpiCard label="Lead Totali" value={formatNumber(summary.totalLeads)} icon={<Users className="h-4 w-4" />} color="purple" />
                <KpiCard label="ROAS Medio" value={summary.avgRoas ? `${summary.avgRoas.toFixed(2)}x` : "N/D"} icon={<Target className="h-4 w-4" />} color="amber" />
                <KpiCard label="CPL Medio" value={summary.avgCpl ? formatCurrency(summary.avgCpl) : "N/D"} icon={<DollarSign className="h-4 w-4" />} color="indigo" />
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cerca e filtra per: nome, ID o metrica..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-background"
            />
          </div>

          {selectedCampaign && (
            <div className="flex items-center gap-1.5 text-sm bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
              <Megaphone className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <button
                onClick={() => { setSelectedCampaign(null); setActiveTab("campaigns"); }}
                className="text-blue-600 hover:underline font-medium"
              >
                Tutte le Campagne
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold truncate">{selectedCampaign}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 ml-auto"
                onClick={() => { setSelectedCampaign(null); setActiveTab("campaigns"); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="border-b bg-muted/30">
              <div className="flex">
                {([
                  { key: "campaigns" as const, label: "Campagne", icon: <Megaphone className="h-3.5 w-3.5" /> },
                  { key: "adsets" as const, label: "Gruppi di inserzioni", icon: <Layers className="h-3.5 w-3.5" /> },
                  { key: "ads" as const, label: "Inserzioni", icon: <FolderOpen className="h-3.5 w-3.5" /> },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setSortColumn(null); setSelectedRows(new Set()); }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? "border-blue-600 text-blue-600 bg-white dark:bg-background"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toolbar row */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="ACTIVE">Attive</SelectItem>
                  <SelectItem value="PAUSED">In Pausa</SelectItem>
                  <SelectItem value="ARCHIVED">Archiviate</SelectItem>
                  <SelectItem value="CAMPAIGN_PAUSED">Campagna in Pausa</SelectItem>
                  <SelectItem value="ADSET_PAUSED">Adset in Pausa</SelectItem>
                  <SelectItem value="DISAPPROVED">Non Approvate</SelectItem>
                  <SelectItem value="PENDING_REVIEW">In Revisione</SelectItem>
                  <SelectItem value="WITH_ISSUES">Con Problemi</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex bg-muted/50 rounded-md p-0.5">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded transition-colors ${viewMode === "table" ? "bg-white dark:bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Table2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded transition-colors ${viewMode === "cards" ? "bg-white dark:bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Select value={tablePreset} onValueChange={setTablePreset}>
                  <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]">
                    <Columns3 className="h-3.5 w-3.5 mr-1" />
                    <span>Colonne: </span>
                    <SelectValue />
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
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                        <Settings2 className="h-3.5 w-3.5" />
                        ({customColumns.length})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3" align="end">
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
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={exportCSV}>
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
              </div>
            </div>

            {adsLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : ads.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nessuna inserzione trovata. Prova a sincronizzare.</p>
              </div>
            ) : viewMode === "cards" ? (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {currentRows.map((row, idx) => (
                  <div
                    key={row.name + idx}
                    className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                      activeTab === "campaigns" ? "cursor-pointer" : ""
                    } ${
                      row.frequency != null && row.frequency > 4 ? "border-red-300 bg-red-50/30 dark:bg-red-950/10" : ""
                    }`}
                    onClick={() => {
                      if (activeTab === "campaigns") {
                        setSelectedCampaign(row.name);
                        setActiveTab("ads");
                      }
                    }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {activeTab === "ads" && row.creativeThumbnailUrl && (
                        <img src={row.creativeThumbnailUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{row.name}</p>
                        {row.campaignName && activeTab !== "campaigns" && (
                          <p className="text-xs text-muted-foreground truncate">{row.campaignName}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(row.status)}
                          {row.frequency != null && row.frequency > 4 && (
                            <Badge className="bg-red-500/10 text-red-600 border-red-300 gap-1 text-[10px]">
                              <AlertTriangle className="h-2.5 w-2.5" />Ad Fatigue
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <MiniKpi label="Spesa" value={formatCurrency(row.spend)} />
                      <MiniKpi label="Impressioni" value={formatNumber(row.impressions)} />
                      <MiniKpi label="Clic" value={formatNumber(row.clicks)} />
                      <MiniKpi label="CTR" value={row.ctr != null ? formatPercent(row.ctr) : "—"} />
                      <MiniKpi label="CPC" value={row.cpc != null ? formatCurrency(row.cpc) : "—"} />
                      <MiniKpi label="Lead" value={formatNumber(row.leads)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                      <MiniKpi label="Copertura" value={formatNumber(row.reach)} />
                      <MiniKpi
                        label="Frequenza"
                        value={row.frequency != null ? row.frequency.toFixed(2) : "—"}
                        highlight={row.frequency != null && row.frequency > 4}
                      />
                      <MiniKpi label="ROAS" value={row.roas != null ? `${row.roas.toFixed(2)}x` : "—"} />
                      <MiniKpi label="CPL" value={row.cpl != null ? formatCurrency(row.cpl) : "—"} />
                      <MiniKpi label="CTR link" value={row.ctrLink != null ? formatPercent(row.ctrLink) : "—"} />
                      <MiniKpi label="CPC link" value={row.cpcLink != null ? formatCurrency(row.cpcLink) : "—"} />
                    </div>
                    {row.dailyBudget != null && row.dailyBudget > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Budget {formatCurrency(row.dailyBudget)}/g</span>
                          <span>{row.dailyBudget > 0 ? Math.min(100, Math.round((row.spend / row.dailyBudget) * 100)) : 0}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, row.dailyBudget > 0 ? (row.spend / row.dailyBudget) * 100 : 0)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {activeTab === "campaigns" && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={(e) => {
                          e.stopPropagation();
                          downloadCampaignData(row.name);
                        }}>
                          <FileJson className="h-3 w-3" />Scarica Dati
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={(e) => {
                          e.stopPropagation();
                          const newHidden = hiddenCampaigns.includes(row.name)
                            ? hiddenCampaigns.filter(c => c !== row.name)
                            : [...hiddenCampaigns, row.name];
                          hiddenMutation.mutate(newHidden);
                        }}>
                          <EyeOff className="h-3 w-3" />
                          {hiddenCampaigns.includes(row.name) ? "Mostra" : "Nascondi"}
                        </Button>
                        <Button
                          variant={aiExcludedCampaigns.includes(row.name) ? "destructive" : "outline"}
                          size="sm"
                          className={`h-7 text-xs gap-1 flex-1 ${!aiExcludedCampaigns.includes(row.name) ? "border-green-500 text-green-700 hover:bg-green-50" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newExcluded = aiExcludedCampaigns.includes(row.name)
                              ? aiExcludedCampaigns.filter(c => c !== row.name)
                              : [...aiExcludedCampaigns, row.name];
                            aiExcludedMutation.mutate(newExcluded);
                          }}
                          title={aiExcludedCampaigns.includes(row.name) ? "Clicca per riattivare l'analisi AI di Simone" : "Clicca per escludere dall'analisi AI di Simone"}
                        >
                          {aiExcludedCampaigns.includes(row.name) ? <BotOff className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                          {aiExcludedCampaigns.includes(row.name) ? "Esclusa da AI" : "Simone analizza"}
                        </Button>
                      </div>
                    )}
                    {activeTab === "ads" && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => row.metaAdId && setSelectedAdId(row.metaAdId)}>
                          <BarChart3 className="h-3 w-3" />Dettaglio
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => {
                          const ad = ads.find(a => a.metaAdId === row.metaAdId);
                          if (ad) setLinkDialogAd(ad);
                        }}>
                          <Link2 className="h-3 w-3" />Associa
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                {selectedRows.size > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b text-sm">
                    <span className="font-medium">{selectedRows.size} selezionat{selectedRows.size === 1 ? "o" : "i"}</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                      const selectedData = currentRows.filter((r, i) => selectedRows.has(getRowKey(r, i)));
                      const cols = activeColumns;
                      const header = cols.map(c => COLUMN_LABELS[c] || c).join(",");
                      const rows = selectedData.map(row => cols.map(col => {
                        const v = (row as Record<string, unknown>)[col];
                        return v != null ? `"${String(v).replace(/"/g, '""')}"` : "";
                      }).join(",")).join("\n");
                      const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `selezione-${activeTab}-${new Date().toISOString().split("T")[0]}.csv`;
                      a.click();
                    }}>
                      <Download className="h-3 w-3" />
                      Esporta selezione
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => setSelectedRows(new Set())}>
                      Deseleziona tutto
                    </Button>
                  </div>
                )}
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left w-8">
                        <Checkbox
                          className="h-3.5 w-3.5"
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      {activeColumns.map(col => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none group"
                          style={{ minWidth: col === "name" ? 200 : 80, resize: "horizontal", overflow: "hidden" }}
                          onClick={() => handleColumnSort(col)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {COLUMN_LABELS[col] || col}
                            <ArrowUpDown className={`h-3 w-3 transition-opacity ${sortColumn === col ? "opacity-100 text-foreground" : "opacity-0 group-hover:opacity-50"}`} />
                          </span>
                        </th>
                      ))}
                      {activeTab === "ads" && (
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground w-16"></th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    <TooltipProvider>
                    {activeTab === "ads" && groupedByCampaign ? (
                      groupedByCampaign.map(group => {
                        const isCollapsed = collapsedCampaigns.has(group.campaignName);
                        return (
                          <React.Fragment key={group.campaignName}>
                            <tr
                              className="border-b bg-blue-50/30 dark:bg-blue-950/10 cursor-pointer hover:bg-blue-100/40"
                              onClick={() => toggleCampaignCollapse(group.campaignName)}
                            >
                              <td className="px-3 py-2" colSpan={1}>
                                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </td>
                              <td className="px-3 py-2 font-semibold text-sm" colSpan={activeColumns.length + (activeTab === "ads" ? 1 : 0)}>
                                <div className="flex items-center gap-2">
                                  <Megaphone className="h-3.5 w-3.5 text-blue-500" />
                                  <span>{group.campaignName}</span>
                                  <Badge variant="secondary" className="text-[10px] h-5">{group.rows.length} inserzioni</Badge>
                                  <span className="ml-auto text-xs text-muted-foreground font-normal">
                                    Spesa: {formatCurrency(group.agg.spend)} · Impressioni: {formatNumber(group.agg.impressions)} · Clic: {formatNumber(group.agg.clicks)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {!isCollapsed && group.rows.map((row, idx) => {
                              const rk = row.metaAdId || `ad-${idx}`;
                              return (
                                <AdTableRow key={rk} row={row} activeColumns={activeColumns} activeTab={activeTab} ads={ads} setSelectedAdId={setSelectedAdId} setLinkDialogAd={setLinkDialogAd} rowKey={rk} isSelected={selectedRows.has(rk)} onSelectToggle={toggleRowSelect} />
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      currentRows.map((row, idx) => {
                        const rk = getRowKey(row, idx);
                        return (
                          <AdTableRow key={rk} row={row} activeColumns={activeColumns} activeTab={activeTab} ads={ads} setSelectedAdId={setSelectedAdId} setLinkDialogAd={setLinkDialogAd} onRowClick={activeTab === "campaigns" ? () => { setSelectedCampaign(row.name); setActiveTab("ads"); } : undefined} rowKey={rk} isSelected={selectedRows.has(rk)} onSelectToggle={toggleRowSelect} />
                        );
                      })
                    )}
                    </TooltipProvider>
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-medium text-[13px]">
                      <td className="px-3 py-2"></td>
                      {activeColumns.map((col, idx) => (
                        <td key={col} className="px-3 py-2 whitespace-nowrap">
                          {idx === 0 ? (
                            <span className="text-muted-foreground">
                              Risultati di {currentRows.length} {activeTab === "campaigns" ? "campagne" : activeTab === "adsets" ? "gruppi" : "inserzioni"}
                            </span>
                          ) : col === "spend" ? (
                            <span>{formatCurrency(summary?.totalSpend || 0)}</span>
                          ) : col === "impressions" ? (
                            <span>{formatNumber(summary?.totalImpressions || 0)}</span>
                          ) : col === "clicks" ? (
                            <span>{formatNumber(summary?.totalClicks || 0)}</span>
                          ) : col === "reach" ? (
                            <span>{formatNumber(summary?.totalReach || 0)}</span>
                          ) : col === "leads" || col === "risultati" ? (
                            <span>{formatNumber(summary?.totalLeads || 0)}</span>
                          ) : col === "linkClicks" ? (
                            <span>{formatNumber(summary?.totalLinkClicks || 0)}</span>
                          ) : col === "ctr" ? (
                            <span>{summary?.avgCtr != null ? formatPercent(summary.avgCtr) : "—"}</span>
                          ) : col === "cpc" ? (
                            <span>{summary?.avgCpc != null ? formatCurrency(summary.avgCpc) : "—"}</span>
                          ) : col === "cpl" ? (
                            <span>{summary?.avgCpl != null ? formatCurrency(summary.avgCpl) : "—"}</span>
                          ) : col === "roas" ? (
                            <span>{summary?.avgRoas != null ? `${summary.avgRoas.toFixed(2)}x` : "—"}</span>
                          ) : ""}
                        </td>
                      ))}
                      {activeTab === "ads" && <td className="px-3 py-2"></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {unlinkedPosts.length > 0 && (() => {
            const folderMap = new Map(unlinkedFolders.map(f => [f.id, f]));
            const grouped: { folder: UnlinkedFolder | null; posts: UnlinkedPost[] }[] = [];
            const byFolder = new Map<string, UnlinkedPost[]>();
            const noFolder: UnlinkedPost[] = [];
            unlinkedPosts.forEach(p => {
              if (p.folderId) {
                if (!byFolder.has(p.folderId)) byFolder.set(p.folderId, []);
                byFolder.get(p.folderId)!.push(p);
              } else {
                noFolder.push(p);
              }
            });
            byFolder.forEach((posts, fId) => {
              grouped.push({ folder: folderMap.get(fId) || { id: fId, name: "Cartella sconosciuta", color: null, icon: null, folderType: null }, posts });
            });
            if (noFolder.length > 0) grouped.push({ folder: null, posts: noFolder });

            const perPage = 10;
            const allPostsFlat = grouped.flatMap(g => g.posts);
            const totalPages = Math.ceil(allPostsFlat.length / perPage);
            const safePage = Math.min(unlinkedPage, totalPages || 1);
            const startIdx = (safePage - 1) * perPage;
            const pagePostIds = new Set(allPostsFlat.slice(startIdx, startIdx + perPage).map(p => p.id));

            return (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-amber-500" />
                    Post Ad senza Inserzione ({unlinkedPosts.length})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Post contrassegnati come Ad ma non ancora collegati a un'inserzione Meta</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {grouped.map(({ folder, posts: groupPosts }) => {
                    const visiblePosts = groupPosts.filter(p => pagePostIds.has(p.id));
                    if (visiblePosts.length === 0) return null;
                    return (
                      <div key={folder?.id ?? "__no_folder__"} className="space-y-1.5">
                        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                          folder
                            ? folder.folderType === "project"
                              ? "bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20"
                              : "bg-muted border border-border"
                            : "bg-muted/50 border border-border/50"
                        }`}>
                          {folder ? (
                            folder.folderType === "project" ? (
                              <FolderOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" style={{ color: folder.color || undefined }} />
                            ) : (
                              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" style={{ color: folder.color || undefined }} />
                            )
                          ) : (
                            <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-xs font-semibold truncate" style={{ color: folder?.color || undefined }}>
                            {folder ? folder.name : "Senza cartella"}
                          </span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">{groupPosts.length}</Badge>
                        </div>
                        <div className="space-y-1 pl-2">
                          {visiblePosts.map((post) => (
                            <div
                              key={post.id}
                              className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => setPreviewPost(post)}
                            >
                              {post.imageUrl ? (
                                <img
                                  src={post.imageUrl}
                                  alt=""
                                  className="w-10 h-10 rounded-lg object-cover border flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{post.title || post.hook || "Post senza titolo"}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{post.platform}</span>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{post.status}</Badge>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <span className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => { e.stopPropagation(); setPreviewPost(post); }}
                                  title="Anteprima"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLinkPostTarget(post);
                                    setLinkPostSearch("");
                                  }}
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  Associa
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        {startIdx + 1}-{Math.min(startIdx + perPage, allPostsFlat.length)} di {allPostsFlat.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={safePage <= 1}
                          onClick={() => setUnlinkedPage(safePage - 1)}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                          let pg: number;
                          if (totalPages <= 10) {
                            pg = i + 1;
                          } else if (safePage <= 5) {
                            pg = i + 1;
                          } else if (safePage >= totalPages - 4) {
                            pg = totalPages - 9 + i;
                          } else {
                            pg = safePage - 4 + i;
                          }
                          return (
                            <Button
                              key={pg}
                              variant={pg === safePage ? "default" : "outline"}
                              size="sm"
                              className="h-7 w-7 p-0 text-xs"
                              onClick={() => setUnlinkedPage(pg)}
                            >
                              {pg}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={safePage >= totalPages}
                          onClick={() => setUnlinkedPage(safePage + 1)}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
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

      <Dialog open={!!linkPostTarget} onOpenChange={(open) => { if (!open) { setLinkPostTarget(null); setLinkPostSearch(""); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Associa Inserzione a "{linkPostTarget?.title || linkPostTarget?.hook || "Post"}"
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cerca inserzione..."
              value={linkPostSearch}
              onChange={e => setLinkPostSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {allAds.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessuna inserzione disponibile.
            </p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {allAds
                .filter(a => {
                  if (!linkPostSearch.trim()) return true;
                  const q = linkPostSearch.toLowerCase();
                  return (a.adName || "").toLowerCase().includes(q) || (a.campaignName || "").toLowerCase().includes(q);
                })
                .map((ad) => (
                <button
                  key={ad.metaAdId}
                  onClick={() => {
                    if (linkPostTarget) {
                      linkMutation.mutate({ metaAdId: ad.metaAdId, postId: linkPostTarget.id });
                      setLinkPostTarget(null);
                    }
                  }}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
                  disabled={linkMutation.isPending}
                >
                  {ad.creativeThumbnailUrl && (
                    <img src={ad.creativeThumbnailUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ad.adName}</p>
                    <p className="text-xs text-muted-foreground">{ad.campaignName} &middot; {formatCurrency(ad.spend)}</p>
                  </div>
                  {linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 text-muted-foreground" />}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewPost} onOpenChange={(open) => { if (!open) setPreviewPost(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Anteprima Post Ad
            </DialogTitle>
          </DialogHeader>
          {previewPost && (
            <div className="space-y-4">
              {previewPost.imageUrl && (
                <div className="rounded-xl overflow-hidden border">
                  <img
                    src={previewPost.imageUrl}
                    alt={previewPost.title || "Post image"}
                    className="w-full max-h-[400px] object-contain bg-muted"
                  />
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <h3 className="font-bold text-lg">{previewPost.title || "Post senza titolo"}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{previewPost.platform}</Badge>
                    <Badge variant="secondary">{previewPost.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(previewPost.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                    </span>
                  </div>
                </div>
                {previewPost.hook && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Hook</p>
                    <p className="text-sm text-amber-900 dark:text-amber-200">{previewPost.hook}</p>
                  </div>
                )}
                {previewPost.body && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Corpo del post</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{previewPost.body}</p>
                  </div>
                )}
                {previewPost.cta && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/30">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Call to Action</p>
                    <p className="text-sm text-blue-900 dark:text-blue-200">{previewPost.cta}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setLinkPostTarget(previewPost);
                    setLinkPostSearch("");
                    setPreviewPost(null);
                  }}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Associa a Inserzione
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showHiddenCampaigns} onOpenChange={setShowHiddenCampaigns}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <EyeOff className="h-5 w-5" />
              Gestisci Campagne Nascoste
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Le campagne nascoste non verranno visualizzate e i loro dati saranno esclusi dai calcoli KPI.
          </p>
          {allCampaignNames.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessuna campagna trovata.</p>
          ) : (
            <div className="space-y-1 mt-2">
              {allCampaignNames.map(name => {
                const isHidden = hiddenCampaigns.includes(name);
                const campaignAds = rawAllAds.filter(a => a.campaignName === name);
                const totalSpend = campaignAds.reduce((s, a) => s + (a.spend || 0), 0);
                const activeCount = campaignAds.filter(a => a.adStatus === "ACTIVE").length;
                return (
                  <div
                    key={name}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isHidden ? "bg-muted/50 opacity-60" : "hover:bg-muted/30"
                    }`}
                  >
                    <Checkbox
                      checked={!isHidden}
                      onCheckedChange={() => {
                        const newHidden = isHidden
                          ? hiddenCampaigns.filter(c => c !== name)
                          : [...hiddenCampaigns, name];
                        hiddenMutation.mutate(newHidden);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isHidden ? "line-through" : ""}`}>{name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{campaignAds.length} inserzioni</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{activeCount} attive</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{formatCurrency(totalSpend)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => downloadCampaignData(name)}
                      title="Scarica tutti i dati"
                    >
                      <FileJson className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={aiExcludedCampaigns.includes(name) ? "destructive" : "ghost"}
                      size="sm"
                      className={`h-7 px-2 text-xs gap-1 ${!aiExcludedCampaigns.includes(name) ? "text-green-700 hover:bg-green-50" : ""}`}
                      onClick={() => {
                        const newExcluded = aiExcludedCampaigns.includes(name)
                          ? aiExcludedCampaigns.filter(c => c !== name)
                          : [...aiExcludedCampaigns, name];
                        aiExcludedMutation.mutate(newExcluded);
                      }}
                      title={aiExcludedCampaigns.includes(name) ? "Clicca per riattivare l'analisi AI" : "Clicca per escludere dall'analisi AI"}
                    >
                      {aiExcludedCampaigns.includes(name) ? <BotOff className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      {aiExcludedCampaigns.includes(name) ? "Esclusa" : "AI On"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {hiddenCampaigns.length > 0 && (
            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => hiddenMutation.mutate([])}
                className="gap-1.5 text-xs"
              >
                Mostra tutte ({hiddenCampaigns.length} nascoste)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );

  if (embedded) {
    return (
      <div className="p-4 sm:p-6">
        {content}
        {simoneChatOpen && (
          <div className="fixed top-0 right-0 h-full w-[380px] sm:w-[420px] z-50 border-l bg-background shadow-2xl">
            <AgentChat
              roleId="simone"
              roleName="Simone – Ads Strategist"
              avatar="📊"
              accentColor="orange"
              open={true}
              onClose={() => setSimoneChatOpen(false)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex min-h-0">
          <main className={`flex-1 overflow-y-auto transition-all duration-300`}>
            <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 ${simoneChatOpen ? "max-w-6xl" : "max-w-7xl"}`}>
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
          </main>
          {simoneChatOpen && (
            <div className="w-[380px] sm:w-[420px] shrink-0 border-l bg-background h-full">
              <AgentChat
                roleId="simone"
                roleName="Simone – Ads Strategist"
                avatar="📊"
                accentColor="orange"
                open={true}
                onClose={() => setSimoneChatOpen(false)}
              />
            </div>
          )}
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

