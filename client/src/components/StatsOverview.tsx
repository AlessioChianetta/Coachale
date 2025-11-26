import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  TrendingUp,
  Target,
  Clock,
  Mail,
  MessageCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

function StatCard({ icon, label, value, trend }: StatCardProps) {
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
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsOverview() {
  const { data: stats } = useQuery({
    queryKey: ["/api/stats/consultant"],
    queryFn: async () => {
      const response = await fetch("/api/stats/consultant", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ["/api/proactive-leads"],
    queryFn: async () => {
      const response = await fetch("/api/proactive-leads", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.leads || [];
    },
  });

  const { data: emailProgress = [] } = useQuery<any[]>({
    queryKey: ["/api/email-journey-progress"],
    queryFn: async () => {
      const response = await fetch("/api/email-journey-progress", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: whatsappStats } = useQuery({
    queryKey: ["/api/whatsapp/stats"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Calculate metrics
  const totalClients = clients.length;
  const totalLeads = leads.length;
  const avgCompletion = stats?.completionRate || 0;
  const activeEmailJourneys = emailProgress.filter(
    (p: any) => p.currentDay <= 31
  ).length;
  const whatsappConversations = whatsappStats?.totalConversations || 0;
  const avgResponseTime = whatsappStats?.avgResponseTime || "N/A";

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Panoramica Generale</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="w-6 h-6 text-primary" />}
          label="Clienti Attivi"
          value={totalClients}
          trend={{
            value: "+2.5% vs mese scorso",
            isPositive: true,
          }}
        />
        <StatCard
          icon={<Target className="w-6 h-6 text-blue-500" />}
          label="Lead in Pipeline"
          value={totalLeads}
          trend={{
            value: "+8 questa settimana",
            isPositive: true,
          }}
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6 text-green-500" />}
          label="Tasso Completamento Medio"
          value={`${avgCompletion}%`}
          trend={{
            value: "+5% vs media",
            isPositive: true,
          }}
        />
        <StatCard
          icon={<Mail className="w-6 h-6 text-purple-500" />}
          label="Email Journey Attivi"
          value={activeEmailJourneys}
        />
        <StatCard
          icon={<MessageCircle className="w-6 h-6 text-green-600" />}
          label="Conversazioni WhatsApp"
          value={whatsappConversations}
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-orange-500" />}
          label="Tempo Risposta Medio"
          value={avgResponseTime}
        />
      </div>
    </div>
  );
}
