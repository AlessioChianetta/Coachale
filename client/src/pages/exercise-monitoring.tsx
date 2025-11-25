
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  BarChart3,
  Filter,
  Search,
  Download,
  Calendar,
  Target,
  Eye,
  MessageSquare,
  Star
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";

interface ProgressStats {
  clientId: string;
  clientName: string;
  avatar?: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  avgScore: number;
  avgCompletionTime: number;
  lastActivity: string;
  completionRate: number;
}

export default function ExerciseMonitoring() {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("completion_rate");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch assignments data
  const { data: assignments = [] } = useQuery({
    queryKey: ["/api/exercise-assignments/consultant"],
    queryFn: async () => {
      const response = await fetch("/api/exercise-assignments/consultant", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch assignments");
      return response.json();
    },
  });

  // Fetch clients data
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Calculate progress statistics
  const progressStats: ProgressStats[] = clients.map((client: any) => {
    const clientAssignments = assignments.filter((a: any) => a.clientId === client.id);
    const totalAssigned = clientAssignments.length;
    const completed = clientAssignments.filter((a: any) => a.status === 'completed').length;
    const inProgress = clientAssignments.filter((a: any) => a.status === 'in_progress').length;
    const pending = clientAssignments.filter((a: any) => a.status === 'pending').length;
    const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;
    
    // Mock data for demo - in real app this would come from analytics
    const avgScore = 78 + Math.random() * 20; // 78-98
    const avgCompletionTime = 25 + Math.random() * 30; // 25-55 minutes
    const lastActivity = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();

    return {
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      avatar: client.avatar,
      totalAssigned,
      completed,
      inProgress,
      pending,
      avgScore: Math.round(avgScore),
      avgCompletionTime: Math.round(avgCompletionTime),
      lastActivity,
      completionRate,
    };
  });

  // Filter and sort data
  const filteredStats = progressStats
    .filter(stat => {
      const matchesSearch = stat.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && stat.inProgress > 0) ||
        (statusFilter === "completed" && stat.completed > 0) ||
        (statusFilter === "pending" && stat.pending > 0);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "completion_rate": return b.completionRate - a.completionRate;
        case "name": return a.clientName.localeCompare(b.clientName);
        case "last_activity": return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        case "avg_score": return b.avgScore - a.avgScore;
        default: return 0;
      }
    });

  // Overall statistics
  const overallStats = {
    totalClients: clients.length,
    totalAssignments: assignments.length,
    completedAssignments: assignments.filter((a: any) => a.status === 'completed').length,
    avgCompletionRate: progressStats.length > 0 ? 
      Math.round(progressStats.reduce((sum, stat) => sum + stat.completionRate, 0) / progressStats.length) : 0,
  };

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "pending": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
                Monitoraggio Progressi
              </h1>
              <p className="text-muted-foreground">
                Monitora il progresso dei tuoi clienti e analizza le performance degli esercizi
              </p>
            </div>

            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <Users className="text-primary" size={24} />
                    <div>
                      <p className="text-2xl font-bold">{overallStats.totalClients}</p>
                      <p className="text-sm text-muted-foreground">Clienti Totali</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <Target className="text-blue-600" size={24} />
                    <div>
                      <p className="text-2xl font-bold">{overallStats.totalAssignments}</p>
                      <p className="text-sm text-muted-foreground">Esercizi Assegnati</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="text-green-600" size={24} />
                    <div>
                      <p className="text-2xl font-bold">{overallStats.completedAssignments}</p>
                      <p className="text-sm text-muted-foreground">Completati</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="text-purple-600" size={24} />
                    <div>
                      <p className="text-2xl font-bold">{overallStats.avgCompletionRate}%</p>
                      <p className="text-sm text-muted-foreground">Tasso Medio</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Panoramica</TabsTrigger>
                <TabsTrigger value="detailed">Dettagli Cliente</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                {/* Filters */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="flex items-center space-x-2">
                        <Search size={16} className="text-muted-foreground" />
                        <Input
                          placeholder="Cerca cliente..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-64"
                        />
                      </div>

                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filtra per stato" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti gli stati</SelectItem>
                          <SelectItem value="active">In corso</SelectItem>
                          <SelectItem value="completed">Completati</SelectItem>
                          <SelectItem value="pending">In attesa</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Ordina per" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="completion_rate">Tasso completamento</SelectItem>
                          <SelectItem value="name">Nome cliente</SelectItem>
                          <SelectItem value="last_activity">Ultima attività</SelectItem>
                          <SelectItem value="avg_score">Punteggio medio</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button variant="outline" size="sm">
                        <Download size={16} className="mr-2" />
                        Esporta Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Progress Overview Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredStats.map((stat) => (
                    <Card key={stat.clientId} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Avatar>
                              <AvatarImage src={stat.avatar} />
                              <AvatarFallback>
                                {stat.clientName.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold">{stat.clientName}</h3>
                              <p className="text-sm text-muted-foreground">
                                {stat.totalAssigned} esercizi assegnati
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Eye size={16} />
                          </Button>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progresso completamento</span>
                            <span className={`font-medium ${getCompletionRateColor(stat.completionRate)}`}>
                              {stat.completionRate}%
                            </span>
                          </div>
                          <Progress value={stat.completionRate} className="h-2" />
                        </div>

                        {/* Status Badges */}
                        <div className="flex space-x-2">
                          {stat.completed > 0 && (
                            <Badge variant="default" className="text-xs">
                              {stat.completed} completati
                            </Badge>
                          )}
                          {stat.inProgress > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {stat.inProgress} in corso
                            </Badge>
                          )}
                          {stat.pending > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {stat.pending} in attesa
                            </Badge>
                          )}
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Punteggio medio</p>
                            <div className="flex items-center space-x-1">
                              <Star size={14} className="text-yellow-500" />
                              <span className="font-medium">{stat.avgScore}%</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tempo medio</p>
                            <div className="flex items-center space-x-1">
                              <Clock size={14} className="text-blue-500" />
                              <span className="font-medium">{stat.avgCompletionTime}min</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Ultima attività: {new Date(stat.lastActivity).toLocaleDateString('it-IT')}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredStats.length === 0 && (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <AlertCircle className="mx-auto mb-4 text-muted-foreground" size={48} />
                      <h3 className="text-lg font-semibold mb-2">Nessun risultato</h3>
                      <p className="text-muted-foreground">
                        Non sono stati trovati clienti che corrispondono ai filtri selezionati.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="detailed" className="space-y-6 mt-6">
                <Card>
                  <CardContent className="p-12 text-center">
                    <BarChart3 className="mx-auto mb-4 text-muted-foreground" size={48} />
                    <h3 className="text-lg font-semibold mb-2">Vista Dettagliata</h3>
                    <p className="text-muted-foreground">
                      Funzionalità in sviluppo - Analisi dettagliate per singolo cliente
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6 mt-6">
                <Card>
                  <CardContent className="p-12 text-center">
                    <TrendingUp className="mx-auto mb-4 text-muted-foreground" size={48} />
                    <h3 className="text-lg font-semibold mb-2">Analytics Avanzate</h3>
                    <p className="text-muted-foreground">
                      Funzionalità in sviluppo - Grafici e trend analysis
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
