import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Bot, 
  MessageSquare, 
  Clock, 
  TrendingUp, 
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface AgentStats {
  activeAgents: number;
  conversations24h: number;
  avgResponseTime: string;
  successRate: number;
}

interface KPITileProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  accentColor: string;
}

function KPITile({ title, value, subtitle, icon, trend, accentColor }: KPITileProps) {
  return (
    <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
              {subtitle && (
                <span className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</span>
              )}
            </div>
            {trend && (
              <div className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${trend.isPositive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  <TrendingUp 
                    className={`h-3 w-3 ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400 rotate-180'}`} 
                  />
                  <span className={`text-xs font-semibold ${trend.isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {trend.isPositive ? '+' : ''}{trend.value}%
                  </span>
                </div>
                <span className="text-xs text-gray-400">vs ieri</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${accentColor} dark:opacity-80`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KPITileSkeleton() {
  return (
    <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-8 w-16 bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-3 w-20 bg-gray-200 dark:bg-gray-700" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
        </div>
      </CardContent>
    </Card>
  );
}

interface MissionControlMetricProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  glowColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function MissionControlMetric({ title, value, subtitle, icon, glowColor, trend }: MissionControlMetricProps) {
  return (
    <div className="relative group">
      <div className={cn("absolute inset-0 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500", glowColor)} />
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-lg", glowColor.replace('opacity-0 group-hover:opacity-100', '').replace('blur-lg', ''), "bg-opacity-20")}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-blue-200/60 uppercase tracking-wider">{title}</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-white">{value}</span>
              {subtitle && (
                <span className="text-xs text-blue-300/50">{subtitle}</span>
              )}
            </div>
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold",
              trend.isPositive 
                ? "bg-green-500/15 text-green-400 border border-green-500/20" 
                : "bg-red-500/15 text-red-400 border border-red-500/20"
            )}>
              <TrendingUp className={cn("h-3 w-3", !trend.isPositive && "rotate-180")} />
              {trend.isPositive ? '+' : ''}{trend.value}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MissionControlSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16 bg-white/10" />
          <Skeleton className="h-6 w-12 bg-white/10" />
        </div>
      </div>
    </div>
  );
}

interface AgentDashboardHeaderProps {
  variant?: "default" | "mission-control";
}

export function AgentDashboardHeader({ variant = "default" }: AgentDashboardHeaderProps) {
  const { data, isLoading, isError } = useQuery<AgentStats>({
    queryKey: ["/api/whatsapp/agents/stats"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/agents/stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch agent stats");
      }
      return response.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const stats = data || {
    activeAgents: 0,
    conversations24h: 0,
    avgResponseTime: "0s",
    successRate: 0,
  };

  if (variant === "mission-control") {
    if (isError) {
      return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3 text-red-300">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Errore nel caricamento delle statistiche</span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-blue-300/50 uppercase tracking-widest">Metriche in tempo reale</p>
          <Link href="/consultant/whatsapp-conversations">
            <Button variant="ghost" size="sm" className="gap-2 text-blue-300/70 hover:text-white hover:bg-white/10 rounded-lg h-8 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Conversazioni
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading ? (
            <>
              <MissionControlSkeleton />
              <MissionControlSkeleton />
              <MissionControlSkeleton />
              <MissionControlSkeleton />
            </>
          ) : (
            <>
              <MissionControlMetric
                title="Dipendenti"
                value={stats.activeAgents}
                subtitle="attivi"
                icon={<Bot className="h-5 w-5 text-blue-400" />}
                glowColor="bg-blue-500/20"
              />
              <MissionControlMetric
                title="Conversazioni"
                value={stats.conversations24h}
                subtitle="24h"
                icon={<MessageSquare className="h-5 w-5 text-green-400" />}
                glowColor="bg-green-500/20"
                trend={{ value: 12, isPositive: true }}
              />
              <MissionControlMetric
                title="Risposta"
                value={stats.avgResponseTime}
                icon={<Clock className="h-5 w-5 text-amber-400" />}
                glowColor="bg-amber-500/20"
              />
              <MissionControlMetric
                title="Successo"
                value={`${stats.successRate}%`}
                icon={<TrendingUp className="h-5 w-5 text-purple-400" />}
                glowColor="bg-purple-500/20"
                trend={{ value: 5, isPositive: true }}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Errore nel caricamento delle statistiche</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Link href="/consultant/whatsapp-conversations">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
            <MessageSquare className="h-4 w-4" />
            Tutte le Conversazioni
            <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <KPITileSkeleton />
            <KPITileSkeleton />
            <KPITileSkeleton />
            <KPITileSkeleton />
          </>
        ) : (
          <>
            <KPITile
              title="Agenti Attivi"
              value={stats.activeAgents}
              subtitle="operativi"
              icon={<Bot className="h-6 w-6 text-blue-600" />}
              accentColor="bg-blue-50"
            />
            <KPITile
              title="Conversazioni 24h"
              value={stats.conversations24h}
              subtitle="messaggi"
              icon={<MessageSquare className="h-6 w-6 text-green-600" />}
              trend={{ value: 12, isPositive: true }}
              accentColor="bg-green-50"
            />
            <KPITile
              title="Tempo Medio Risposta"
              value={stats.avgResponseTime}
              icon={<Clock className="h-6 w-6 text-amber-600" />}
              accentColor="bg-amber-50"
            />
            <KPITile
              title="Tasso Successo"
              value={`${stats.successRate}%`}
              icon={<TrendingUp className="h-6 w-6 text-purple-600" />}
              trend={{ value: 5, isPositive: true }}
              accentColor="bg-purple-50"
            />
          </>
        )}
      </div>
    </div>
  );
}
