import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, 
  Send, 
  Calendar, 
  XCircle, 
  AlertTriangle 
} from "lucide-react";

interface DashboardStats {
  awaitingFollowup: number;
  sentToday: number;
  scheduledNext24h: number;
  blockedLeads: number;
  errors: number;
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  bgColor 
}: { 
  icon: any; 
  label: string; 
  value: number; 
  color: string;
  bgColor: string;
}) {
  return (
    <Card className={`${bgColor} border-none`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color} bg-white/80`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs font-medium opacity-80">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="border-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AutomationDashboard() {
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["automation-dashboard-stats"],
    queryFn: async () => {
      const response = await fetch("/api/followup/dashboard-stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      return response.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-center text-red-600">
          Errore nel caricamento delle statistiche
        </CardContent>
      </Card>
    );
  }

  const stats = data || {
    awaitingFollowup: 0,
    sentToday: 0,
    scheduledNext24h: 0,
    blockedLeads: 0,
    errors: 0,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <StatCard
        icon={Clock}
        label="In Attesa Follow-up"
        value={stats.awaitingFollowup}
        color="text-blue-600"
        bgColor="bg-blue-100 dark:bg-blue-950"
      />
      <StatCard
        icon={Send}
        label="Inviati Oggi"
        value={stats.sentToday}
        color="text-green-600"
        bgColor="bg-green-100 dark:bg-green-950"
      />
      <StatCard
        icon={Calendar}
        label="Programmati 24h"
        value={stats.scheduledNext24h}
        color="text-yellow-600"
        bgColor="bg-yellow-100 dark:bg-yellow-950"
      />
      <StatCard
        icon={XCircle}
        label="Bloccati"
        value={stats.blockedLeads}
        color="text-red-600"
        bgColor="bg-red-100 dark:bg-red-950"
      />
      <StatCard
        icon={AlertTriangle}
        label="Errori"
        value={stats.errors}
        color="text-orange-600"
        bgColor="bg-orange-100 dark:bg-orange-950"
      />
    </div>
  );
}
