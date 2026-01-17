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

export function AgentDashboardHeader() {
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
