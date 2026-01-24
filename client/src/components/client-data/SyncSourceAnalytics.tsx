import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { it } from "date-fns/locale";
import {
  useAnalyticsOverview,
  useSourceAnalytics,
  useClientAnalytics,
  SourceOverviewItem,
  ClientAnalytics,
} from "@/hooks/useDatasetSync";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Users,
  Loader2,
  BarChart3,
  Zap,
  Timer,
  Database,
  Eye,
  RefreshCw,
} from "lucide-react";

function HealthBadge({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  if (status === 'healthy') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Sano
      </Badge>
    );
  }
  if (status === 'warning') {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Attenzione
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <XCircle className="h-3 w-3 mr-1" />
      Critico
    </Badge>
  );
}

function SyncModeBadge({ mode }: { mode: 'push' | 'pull' }) {
  if (mode === 'push') {
    return (
      <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">
        <ArrowDownToLine className="h-3 w-3 mr-1" />
        Push
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400">
      <ArrowUpFromLine className="h-3 w-3 mr-1" />
      Pull
    </Badge>
  );
}

function FreshnessBadge({ status, hours }: { status: 'fresh' | 'stale' | 'critical' | 'unknown'; hours: number | null }) {
  const formatHours = (h: number) => {
    if (h < 1) return `${Math.round(h * 60)}min`;
    if (h < 24) return `${Math.round(h)}h`;
    return `${Math.round(h / 24)}g`;
  };

  if (status === 'fresh') {
    return (
      <span className="text-emerald-600 text-sm flex items-center gap-1">
        <Zap className="h-3 w-3" />
        {hours !== null ? formatHours(hours) : 'Fresco'}
      </span>
    );
  }
  if (status === 'stale') {
    return (
      <span className="text-amber-600 text-sm flex items-center gap-1">
        <Timer className="h-3 w-3" />
        {hours !== null ? formatHours(hours) : 'Stale'}
      </span>
    );
  }
  if (status === 'critical') {
    return (
      <span className="text-red-600 text-sm flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        {hours !== null ? formatHours(hours) : 'Critico'}
      </span>
    );
  }
  return <span className="text-slate-400 text-sm">-</span>;
}

function MiniSparkline({ data }: { data: Array<{ date: string; syncCount: number; successCount: number; failCount: number }> }) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-slate-400">Nessun dato</div>;
  }

  const maxCount = Math.max(...data.map(d => d.syncCount), 1);
  const barWidth = Math.floor(80 / Math.max(data.length, 1));

  return (
    <div className="flex items-end gap-0.5 h-6">
      {data.slice(-7).map((d, i) => {
        const height = (d.syncCount / maxCount) * 100;
        const hasErrors = d.failCount > 0;
        return (
          <div
            key={i}
            className={`rounded-t ${hasErrors ? 'bg-red-400' : 'bg-emerald-400'}`}
            style={{ 
              width: `${barWidth}px`, 
              height: `${Math.max(height, 10)}%`,
              minHeight: '2px'
            }}
            title={`${format(new Date(d.date), 'dd/MM')}: ${d.syncCount} sync (${d.failCount} errori)`}
          />
        );
      })}
    </div>
  );
}

function SourceDetailDialog({ 
  sourceId, 
  open, 
  onClose 
}: { 
  sourceId: number | null; 
  open: boolean; 
  onClose: () => void;
}) {
  const { data: analyticsData, isLoading } = useSourceAnalytics(sourceId);
  const analytics = analyticsData?.data;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-600" />
            {isLoading ? 'Caricamento...' : analytics?.source.name || 'Dettagli Sorgente'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 flex-wrap">
              <HealthBadge status={analytics.health.status} />
              <SyncModeBadge mode={analytics.source.syncMode} />
              {analytics.source.clientName && (
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {analytics.source.clientName}
                </Badge>
              )}
              <FreshnessBadge 
                status={analytics.health.freshnessStatus} 
                hours={analytics.health.freshnessHours} 
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Tasso Successo (7d)</p>
                  <p className={`text-2xl font-bold ${
                    analytics.health.successRate7d >= 90 ? 'text-emerald-600' :
                    analytics.health.successRate7d >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {analytics.health.successRate7d}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Sync (7d)</p>
                  <p className="text-2xl font-bold">{analytics.frequency.syncsLast7d}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Righe Importate (7d)</p>
                  <p className="text-2xl font-bold">{analytics.metrics.last7d.totalRows.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Durata Media</p>
                  <p className="text-2xl font-bold">
                    {analytics.metrics.last7d.avgDurationMs > 0 
                      ? `${(analytics.metrics.last7d.avgDurationMs / 1000).toFixed(1)}s`
                      : '-'
                    }
                  </p>
                </CardContent>
              </Card>
            </div>

            {analytics.frequency.avgHoursBetweenSyncs && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Frequenza Media Sincronizzazione</p>
                <p className="text-lg font-medium">
                  Ogni ~{analytics.frequency.avgHoursBetweenSyncs < 24 
                    ? `${Math.round(analytics.frequency.avgHoursBetweenSyncs)}h`
                    : `${Math.round(analytics.frequency.avgHoursBetweenSyncs / 24)} giorni`
                  }
                </p>
              </div>
            )}

            {analytics.dailyTrend.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">Trend Ultimi 14 Giorni</h4>
                <div className="flex items-end gap-1 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  {analytics.dailyTrend.map((d, i) => {
                    const maxCount = Math.max(...analytics.dailyTrend.map(x => x.syncCount), 1);
                    const height = (d.syncCount / maxCount) * 100;
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        <div className="w-full flex flex-col-reverse items-center" style={{ height: '50px' }}>
                          <div 
                            className={`w-full max-w-[12px] rounded-t ${d.failCount > 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                            style={{ height: `${Math.max(height, 5)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(d.date), 'dd', { locale: it })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {analytics.recentErrors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 text-red-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Errori Recenti
                </h4>
                <div className="space-y-2">
                  {analytics.recentErrors.map((err, i) => (
                    <div key={i} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-sm">
                      <p className="font-medium text-red-700 dark:text-red-400">
                        {err.error_code || 'Errore'}
                      </p>
                      <p className="text-red-600 dark:text-red-300 text-xs mt-1">
                        {err.error_message || 'Dettagli non disponibili'}
                      </p>
                      <p className="text-red-400 text-xs mt-1">
                        {formatDistanceToNow(new Date(err.started_at), { addSuffix: true, locale: it })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analytics.lastSync && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Ultima Sincronizzazione</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Stato:</span>{' '}
                    <span className={analytics.lastSync.status === 'completed' ? 'text-emerald-600' : 'text-red-600'}>
                      {analytics.lastSync.status === 'completed' ? 'Completato' : 'Fallito'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quando:</span>{' '}
                    {formatDistanceToNow(new Date(analytics.lastSync.startedAt), { addSuffix: true, locale: it })}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Righe:</span>{' '}
                    {analytics.lastSync.rowsImported?.toLocaleString() || '-'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Durata:</span>{' '}
                    {analytics.lastSync.durationMs ? `${(analytics.lastSync.durationMs / 1000).toFixed(1)}s` : '-'}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Nessun dato disponibile</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SourcesTable({ 
  sources, 
  onViewDetails 
}: { 
  sources: SourceOverviewItem[]; 
  onViewDetails: (id: number) => void;
}) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Nessuna sorgente</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sorgente</TableHead>
            <TableHead>Modalità</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Freshness</TableHead>
            <TableHead>Successo (7d)</TableHead>
            <TableHead>Sync (7d)</TableHead>
            <TableHead>Righe (7d)</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => (
            <TableRow key={source.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    source.healthStatus === 'healthy' ? 'bg-emerald-500' :
                    source.healthStatus === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium">{source.name}</p>
                    {source.clientName && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {source.clientName}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <SyncModeBadge mode={source.syncMode} />
              </TableCell>
              <TableCell>
                <HealthBadge status={source.healthStatus} />
              </TableCell>
              <TableCell>
                <FreshnessBadge status={source.freshnessStatus} hours={source.freshnessHours} />
              </TableCell>
              <TableCell>
                <span className={`font-mono ${
                  source.successRate >= 90 ? 'text-emerald-600' :
                  source.successRate >= 50 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {source.successRate}%
                </span>
              </TableCell>
              <TableCell className="font-mono">{source.metrics7d.syncs}</TableCell>
              <TableCell className="font-mono">{source.metrics7d.rows.toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetails(source.id)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Dettagli
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClientsTable({ clients }: { clients: ClientAnalytics[] }) {
  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Nessun cliente con sorgenti configurate</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Sorgenti</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Freshness</TableHead>
            <TableHead>Successo (7d)</TableHead>
            <TableHead>Sync (7d)</TableHead>
            <TableHead>Righe (7d)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-xs text-muted-foreground">{client.email}</p>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono">{client.activeSourceCount}/{client.sourceCount}</span>
              </TableCell>
              <TableCell>
                <HealthBadge status={client.healthStatus} />
              </TableCell>
              <TableCell>
                <FreshnessBadge status={client.freshnessStatus} hours={client.freshnessHours} />
              </TableCell>
              <TableCell>
                <span className={`font-mono ${
                  client.successRate >= 90 ? 'text-emerald-600' :
                  client.successRate >= 50 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {client.successRate}%
                </span>
              </TableCell>
              <TableCell className="font-mono">{client.syncs7d}</TableCell>
              <TableCell className="font-mono">{client.rows7d.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SyncSourceAnalytics() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'clients'>('overview');
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

  const { data: overviewData, isLoading: isOverviewLoading, refetch } = useAnalyticsOverview();
  const { data: clientsData, isLoading: isClientsLoading } = useClientAnalytics();

  const overview = overviewData?.data;
  const clients = clientsData?.data || [];

  const handleViewDetails = (id: number) => {
    setSelectedSourceId(id);
  };

  if (isOverviewLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-600" />
            Analisi Sorgenti
          </h3>
          <p className="text-sm text-muted-foreground">
            Monitora lo stato, la frequenza e le prestazioni delle tue sorgenti di dati
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Aggiorna
        </Button>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Sorgenti Totali</p>
              <p className="text-2xl font-bold">{overview.summary.totalSources}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {overview.summary.activeSources} attive
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Sane
              </p>
              <p className="text-2xl font-bold text-emerald-600">{overview.summary.healthStatus.healthy}</p>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Attenzione
              </p>
              <p className="text-2xl font-bold text-amber-600">{overview.summary.healthStatus.warning}</p>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                Critiche
              </p>
              <p className="text-2xl font-bold text-red-600">{overview.summary.healthStatus.critical}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Modalità</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  <ArrowDownToLine className="h-3 w-3 mr-1" />
                  {overview.summary.syncModes.push} Push
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <ArrowUpFromLine className="h-3 w-3 mr-1" />
                  {overview.summary.syncModes.pull} Pull
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="overview">Panoramica Sorgenti</TabsTrigger>
          <TabsTrigger value="sources">Per Sorgente</TabsTrigger>
          <TabsTrigger value="clients">Per Cliente</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {overview?.sources && (
            <SourcesTable sources={overview.sources} onViewDetails={handleViewDetails} />
          )}
        </TabsContent>

        <TabsContent value="sources" className="mt-4 space-y-6">
          {overview?.noClient && overview.noClient.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Sorgenti Personali (senza cliente)
              </h4>
              <SourcesTable sources={overview.noClient} onViewDetails={handleViewDetails} />
            </div>
          )}

          {overview?.byClient && Object.entries(overview.byClient).map(([clientId, sources]) => (
            <div key={clientId}>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                {sources[0]?.clientName || 'Cliente'}
              </h4>
              <SourcesTable sources={sources} onViewDetails={handleViewDetails} />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          {isClientsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <ClientsTable clients={clients} />
          )}
        </TabsContent>
      </Tabs>

      <SourceDetailDialog
        sourceId={selectedSourceId}
        open={selectedSourceId !== null}
        onClose={() => setSelectedSourceId(null)}
      />
    </div>
  );
}
