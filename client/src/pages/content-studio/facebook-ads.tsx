import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Facebook,
  TrendingUp,
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
  CheckCircle,
  PauseCircle,
  BarChart3,
  ArrowUpDown,
  ExternalLink,
  Plug,
  PlugZap,
  ChevronRight,
  X,
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
  avgCpc: number;
  avgCtr: number;
  avgCpl: number;
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
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("it-IT").format(value || 0);

const formatPercent = (value: number) =>
  `${(value || 0).toFixed(2)}%`;

function getStatusBadge(status: string) {
  const s = status?.toUpperCase();
  if (s === "ACTIVE") return <Badge className="bg-green-500/10 text-green-600 border-green-300 gap-1"><CheckCircle className="h-3 w-3" />Attiva</Badge>;
  if (s === "PAUSED") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-300 gap-1"><PauseCircle className="h-3 w-3" />In Pausa</Badge>;
  return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" />{status || "N/D"}</Badge>;
}

export default function FacebookAdsPage({ embedded = false }: { embedded?: boolean }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const oauthError = params.get("meta_ads_error");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("spend");
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [linkDialogAd, setLinkDialogAd] = useState<MetaAd | null>(null);
  const [trendDays, setTrendDays] = useState(30);

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

  const ads: MetaAd[] = adsData?.ads || [];
  const summary: AdsSummary | null = adsData?.summary || null;

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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard label="Spesa Totale" value={formatCurrency(summary.totalSpend)} icon={<DollarSign className="h-4 w-4" />} color="red" />
              <KpiCard label="CPC Medio" value={formatCurrency(summary.avgCpc)} icon={<MousePointer className="h-4 w-4" />} color="blue" />
              <KpiCard label="CTR Medio" value={formatPercent(summary.avgCtr)} icon={<TrendingUp className="h-4 w-4" />} color="green" />
              <KpiCard label="Lead Totali" value={formatNumber(summary.totalLeads)} icon={<Users className="h-4 w-4" />} color="purple" />
              <KpiCard label="Inserzioni Attive" value={String(summary.activeAds)} icon={<Target className="h-4 w-4" />} color="amber" />
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="ACTIVE">Attive</SelectItem>
                <SelectItem value="PAUSED">In Pausa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spend">Spesa</SelectItem>
                <SelectItem value="cpc">CPC</SelectItem>
                <SelectItem value="ctr">CTR</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">
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
          ) : (
            <div className="grid gap-3">
              {ads.map((ad) => (
                <Card key={ad.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold truncate">{ad.adName || "Inserzione"}</h3>
                          {getStatusBadge(ad.adStatus)}
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-lg">{detailData.ad.adName}</h3>
                  <p className="text-sm text-muted-foreground">{detailData.ad.campaignName}</p>
                </div>
                {getStatusBadge(detailData.ad.adStatus)}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniKpi label="Spesa" value={formatCurrency(detailData.ad.spend)} />
                <MiniKpi label="CPC" value={formatCurrency(detailData.ad.cpc || 0)} />
                <MiniKpi label="CTR" value={formatPercent(detailData.ad.ctr || 0)} />
                <MiniKpi label="ROAS" value={detailData.ad.roas ? `${detailData.ad.roas.toFixed(2)}x` : "N/D"} />
                <MiniKpi label="Impressions" value={formatNumber(detailData.ad.impressions)} />
                <MiniKpi label="Click" value={formatNumber(detailData.ad.clicks)} />
                <MiniKpi label="Lead" value={formatNumber(detailData.ad.leads)} />
                <MiniKpi label="CPL" value={detailData.ad.cpl ? formatCurrency(detailData.ad.cpl) : "N/D"} />
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

      <Dialog open={!!linkDialogAd} onOpenChange={(open) => { if (!open) setLinkDialogAd(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Associa Post a "{linkDialogAd?.adName}"
            </DialogTitle>
          </DialogHeader>
          {unlinkedPosts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessun post disponibile da associare.
            </p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {unlinkedPosts.map((post) => (
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
  };
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className={`p-1.5 rounded-lg bg-gradient-to-br ${colorMap[color]}`}>{icon}</div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg sm:text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
