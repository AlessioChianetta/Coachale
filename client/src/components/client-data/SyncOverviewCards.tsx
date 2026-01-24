import { useSyncStats, useDatasetSyncHistory, SyncHistoryRecord } from "@/hooks/useDatasetSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: "green" | "yellow" | "red" | "blue";
}

function StatCard({ icon, label, value, trend, color = "blue" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp
                  className={`w-4 h-4 mr-1 ${
                    trend.isPositive ? "text-green-500" : "text-red-500 rotate-180"
                  }`}
                />
                <span
                  className={trend.isPositive ? "text-green-500" : "text-red-500"}
                >
                  {trend.value}
                </span>
              </div>
            )}
          </div>
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              color === "green"
                ? "bg-green-100"
                : color === "yellow"
                  ? "bg-yellow-100"
                  : color === "red"
                    ? "bg-red-100"
                    : "bg-blue-100"
            }`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivityItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 border-b last:border-b-0">
      <div className="flex items-center gap-3 flex-1">
        <Skeleton className="h-5 w-5 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-600" />;
    case "pending":
    case "processing":
      return <Clock className="h-5 w-5 text-yellow-600" />;
    default:
      return <Activity className="h-5 w-5 text-gray-600" />;
  }
}

function getSuccessRateColor(
  rate: number
): "green" | "yellow" | "red" {
  if (rate > 95) return "green";
  if (rate > 80) return "yellow";
  return "red";
}

interface SyncOverviewCardsProps {
  onViewHistory?: () => void;
}

export function SyncOverviewCards({ onViewHistory }: SyncOverviewCardsProps) {
  const { data: statsData, isLoading: isStatsLoading } = useSyncStats();
  const { data: historyData, isLoading: isHistoryLoading } = useDatasetSyncHistory({
    limit: 5,
  });

  const stats = statsData?.data;
  const history = historyData?.data || [];

  // Calculate success rate
  const successRate = stats
    ? Math.round(stats.successRate * 100) / 100
    : 0;
  const successRateColor = getSuccessRateColor(successRate);

  // Format row count display
  const formatRowCount = (record: SyncHistoryRecord): string => {
    if (record.status === "failed") {
      return record.error_message ? `Errore: ${record.error_message.substring(0, 30)}...` : "Errore";
    }
    if (record.rows_imported) {
      return `${record.rows_imported} righe`;
    }
    return "-";
  };

  // Get source name from sync history (using a map of source IDs to names would be better, but we'll use what we have)
  const getSourceName = (record: SyncHistoryRecord): string => {
    // The sync record doesn't directly have source name, we'll need to use source_id
    return `Sorgente ${record.source_id}`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards Row */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Panoramica Sincronizzazione</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isStatsLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                icon={
                  <TrendingUp
                    className={`w-6 h-6 ${
                      successRateColor === "green"
                        ? "text-green-600"
                        : successRateColor === "yellow"
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  />
                }
                label="Tasso di Successo"
                value={`${successRate}%`}
                color={successRateColor}
              />
              <StatCard
                icon={<Activity className="w-6 h-6 text-blue-600" />}
                label="Sorgenti Attive"
                value={stats?.activeSources || 0}
              />
              <StatCard
                icon={<Clock className="w-6 h-6 text-purple-600" />}
                label="Sync Ultimi 7 Giorni"
                value={stats?.syncsLast24h || 0}
              />
              <StatCard
                icon={<AlertCircle className="w-6 h-6 text-red-600" />}
                label="Errori 24h"
                value={stats?.errorsLast24h || 0}
                color={stats?.errorsLast24h && stats.errorsLast24h > 0 ? "red" : "blue"}
              />
            </>
          )}
        </div>
      </div>

      {/* Recent Activity Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Attività Recente</h3>
        <Card>
          <CardContent className="p-0">
            {isHistoryLoading ? (
              <div className="divide-y">
                <RecentActivityItemSkeleton />
                <RecentActivityItemSkeleton />
                <RecentActivityItemSkeleton />
                <RecentActivityItemSkeleton />
                <RecentActivityItemSkeleton />
              </div>
            ) : history.length > 0 ? (
              <div className="divide-y">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <StatusIcon status={record.status} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {getSourceName(record)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(record.started_at), {
                            addSuffix: true,
                            locale: it,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap ml-4">
                      <p className="text-sm text-muted-foreground">
                        {formatRowCount(record)}
                      </p>
                      {record.status === "completed" && (
                        <p className="text-xs text-muted-foreground">
                          {record.duration_ms && `${(record.duration_ms / 1000).toFixed(1)}s`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nessuna attività di sincronizzazione</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View History Link */}
        {history.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              onClick={onViewHistory}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              Vedi cronologia completa
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
