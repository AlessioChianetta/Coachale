import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  UserCheck,
  HardDrive,
  Briefcase,
  GitBranch,
  Settings,
  Activity,
  TrendingUp,
  Calendar,
  FileText,
  ArrowRight,
  Shield,
  Plug,
  Zap,
  Loader2,
} from "lucide-react";
import Navbar from "@/components/navbar";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "wouter";

interface AdminStats {
  totalConsultants: number;
  totalClients: number;
  activeClients: number;
  driveConnections: number;
  totalConsultations: number;
  totalExercises: number;
}

export default function AdminDashboard() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: statsData, isLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch admin stats");
      return response.json();
    },
  });

  const { data: geminiConnectionsData } = useQuery({
    queryKey: ["/api/voice/gemini-connections"],
    queryFn: async () => {
      const response = await fetch("/api/voice/gemini-connections", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { count: 0, connections: [] };
      return response.json();
    },
    refetchInterval: 5000,
  });

  const killAllGeminiMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/voice/gemini-connections/kill-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to kill connections");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connessioni terminate",
        description: `Chiuse ${data.closed} connessioni Gemini`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/gemini-connections"] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile terminare le connessioni",
        variant: "destructive",
      });
    },
  });

  const stats: AdminStats = statsData?.stats || {
    totalConsultants: 0,
    totalClients: 0,
    activeClients: 0,
    driveConnections: 0,
    totalConsultations: 0,
    totalExercises: 0,
  };

  const statCards = [
    {
      title: "Consultant Totali",
      value: stats.totalConsultants,
      icon: Briefcase,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      iconColor: "text-blue-500",
    },
    {
      title: "Clienti Totali",
      value: stats.totalClients,
      icon: Users,
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      iconColor: "text-purple-500",
    },
    {
      title: "Clienti Attivi",
      value: stats.activeClients,
      icon: UserCheck,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      iconColor: "text-green-500",
    },
    {
      title: "Connessioni Drive",
      value: stats.driveConnections,
      icon: HardDrive,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      iconColor: "text-orange-500",
    },
  ];

  const quickLinks = [
    {
      title: "Gerarchia Sistema",
      description: "Visualizza la struttura Consultant → Clienti",
      href: "/admin/hierarchy",
      icon: GitBranch,
      color: "text-purple-500",
    },
    {
      title: "Gestione Utenti",
      description: "Aggiungi, modifica o disattiva utenti",
      href: "/admin/users",
      icon: Users,
      color: "text-green-500",
    },
    {
      title: "Impostazioni Sistema",
      description: "Configura Google OAuth e altre opzioni",
      href: "/admin/settings",
      icon: Settings,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-orange-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 rounded-2xl md:rounded-3xl p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 md:p-3 bg-white/20 backdrop-blur-sm rounded-xl md:rounded-2xl">
                      <Shield className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">Super Admin Dashboard</h1>
                      <p className="text-red-100 text-sm md:text-base lg:text-lg hidden sm:block">
                        Gestione centralizzata della piattaforma
                      </p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 text-center">
                    <div className="text-2xl md:text-3xl font-bold">{stats.totalConsultations}</div>
                    <div className="text-sm text-red-100">Consulenze</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 text-center">
                    <div className="text-2xl md:text-3xl font-bold">{stats.totalExercises}</div>
                    <div className="text-sm text-red-100">Esercizi</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className={`border-0 shadow-lg ${stat.bgColor}`}>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
                          {stat.title}
                        </p>
                        <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                          {isLoading ? "..." : stat.value}
                        </p>
                      </div>
                      <div className={`p-2 md:p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                        <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Gemini Connections Card */}
          <Card className="border-0 shadow-lg mb-6 md:mb-8 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    geminiConnectionsData?.count && geminiConnectionsData.count > 0 
                      ? "bg-orange-500" 
                      : "bg-gray-400"
                  }`}>
                    <Plug className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Connessioni Gemini Attive
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {geminiConnectionsData?.count || 0}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  size="default"
                  onClick={() => killAllGeminiMutation.mutate()}
                  disabled={killAllGeminiMutation.isPending}
                >
                  {killAllGeminiMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Kill All
                </Button>
              </div>
              {geminiConnectionsData?.connections && geminiConnectionsData.connections.length > 0 && (
                <div className="mt-4 space-y-2">
                  {geminiConnectionsData.connections.map((conn: any) => (
                    <div key={conn.connectionId} className="flex items-center justify-between p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg text-sm">
                      <span className="font-mono text-xs">{conn.connectionId}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{conn.mode}</Badge>
                        <Badge variant={conn.status === 'active' ? 'default' : 'secondary'}>
                          {conn.status}
                        </Badge>
                        <span className="text-gray-500">{conn.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
            <Card className="md:col-span-2 lg:col-span-2 border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Link Rapidi
                </CardTitle>
                <CardDescription>Accesso veloce alle sezioni principali</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {quickLinks.map((link, index) => {
                    const Icon = link.icon;
                    return (
                      <Link key={index} href={link.href}>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer group">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg bg-white dark:bg-gray-700 shadow-sm`}>
                              <Icon className={`w-5 h-5 ${link.color}`} />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">{link.title}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{link.description}</p>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Statistiche Rapide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Consulenze Totali</span>
                    </div>
                    <Badge variant="secondary">{stats.totalConsultations}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-purple-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Esercizi Assegnati</span>
                    </div>
                    <Badge variant="secondary">{stats.totalExercises}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <UserCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Tasso Attivazione</span>
                    </div>
                    <Badge variant="secondary">
                      {stats.totalClients > 0 
                        ? Math.round((stats.activeClients / stats.totalClients) * 100) 
                        : 0}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <HardDrive className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Drive Connessi</span>
                    </div>
                    <Badge variant="secondary">
                      {stats.totalConsultants > 0 
                        ? Math.round((stats.driveConnections / stats.totalConsultants) * 100) 
                        : 0}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
