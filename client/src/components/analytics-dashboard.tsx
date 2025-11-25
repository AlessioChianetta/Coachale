import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ExerciseCompletionTrend,
  ClientEngagementChart,
  PerformanceDistribution,
  CategoryCompletion,
  ClientScoreRadial,
  ChartStats,
} from "./analytics-charts";
import {
  Users,
  TrendingUp,
  Target,
  Clock,
  BarChart3,
  Filter,
  Download,
  Calendar,
  Star,
  Trophy,
  Medal,
  Award,
  AlertCircle,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";

interface AnalyticsDashboardProps {
  consultantId?: string;
}

export default function AnalyticsDashboard({ consultantId }: AnalyticsDashboardProps) {
  const { toast } = useToast();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: new Date(),
  });

  // Fetch overall consultant analytics
  const { data: overviewStats, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ["/api/analytics/consultant/overview", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("startDate", dateRange.startDate.toISOString());
      params.append("endDate", dateRange.endDate.toISOString());
      
      const response = await fetch(`/api/analytics/consultant/overview?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to fetch overview stats");
      }
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: "Errore Caricamento Dati",
        description: error.message || "Impossibile caricare le statistiche generali",
        variant: "destructive",
      });
    },
  });

  // Fetch completion trends
  const { data: completionTrends, isLoading: trendsLoading, error: trendsError } = useQuery({
    queryKey: ["/api/analytics/consultant/completion-trends", period, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("period", period);
      params.append("startDate", dateRange.startDate.toISOString());
      params.append("endDate", dateRange.endDate.toISOString());
      
      const response = await fetch(`/api/analytics/consultant/completion-trends?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to fetch completion trends");
      }
      const data = await response.json();
      return data.map((item: any) => ({
        ...item,
        date: new Date(item.date),
      }));
    },
    onError: (error: any) => {
      toast({
        title: "Errore Caricamento Trend",
        description: error.message || "Impossibile caricare i trend di completamento",
        variant: "destructive",
      });
    },
  });

  // Fetch engagement trends
  const { data: engagementTrends, isLoading: engagementLoading, error: engagementError } = useQuery({
    queryKey: ["/api/analytics/consultant/engagement-trends", period, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("period", period);
      params.append("startDate", dateRange.startDate.toISOString());
      params.append("endDate", dateRange.endDate.toISOString());
      
      const response = await fetch(`/api/analytics/consultant/engagement-trends?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to fetch engagement trends");
      }
      const data = await response.json();
      return data.map((item: any) => ({
        ...item,
        date: new Date(item.date),
      }));
    },
    onError: (error: any) => {
      toast({
        title: "Errore Caricamento Engagement",
        description: error.message || "Impossibile caricare i dati di engagement",
        variant: "destructive",
      });
    },
  });

  // Fetch client performance data
  const { data: clientPerformance, isLoading: performanceLoading, error: performanceError } = useQuery({
    queryKey: ["/api/analytics/clients/performance", selectedClient, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedClient && selectedClient !== "all") params.append("clientId", selectedClient);
      params.append("startDate", dateRange.startDate.toISOString());
      params.append("endDate", dateRange.endDate.toISOString());
      
      const response = await fetch(`/api/analytics/clients/performance?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to fetch client performance");
      }
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: "Errore Performance Clienti",
        description: error.message || "Impossibile caricare i dati delle performance",
        variant: "destructive",
      });
    },
  });

  // Fetch clients list for filter
  const { data: clients = [], isLoading: clientsLoading, error: clientsError } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to fetch clients");
      }
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: "Errore Caricamento Clienti",
        description: error.message || "Impossibile caricare la lista clienti",
        variant: "destructive",
      });
    },
  });

  // Generate mock category data (would come from real analytics in production)
  const categoryData = [
    { category: "Forza", completed: 25, total: 40, percentage: 62 },
    { category: "Cardio", completed: 18, total: 25, percentage: 72 },
    { category: "Flessibilità", completed: 12, total: 15, percentage: 80 },
    { category: "Nutrizione", completed: 8, total: 12, percentage: 67 },
    { category: "Benessere", completed: 15, total: 20, percentage: 75 },
  ];

  const handleDateRangeChange = (range: string) => {
    const now = new Date();
    let startDate: Date;
    
    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    setDateRange({ startDate, endDate: now });
  };

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Analisi dettagliata delle performance e engagement dei tuoi clienti</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Filter */}
          <Select defaultValue="30d" onValueChange={handleDateRangeChange}>
            <SelectTrigger className="w-36" data-testid="select-date-range">
              <Calendar size={16} className="mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Ultimi 7 giorni</SelectItem>
              <SelectItem value="30d">Ultimi 30 giorni</SelectItem>
              <SelectItem value="90d">Ultimi 90 giorni</SelectItem>
            </SelectContent>
          </Select>

          {/* Client Filter */}
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-48" data-testid="select-client">
              <Users size={16} className="mr-2" />
              <SelectValue placeholder="Tutti i clienti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i clienti</SelectItem>
              {clients.map((client: any) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.firstName} {client.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" data-testid="button-export">
            <Download size={16} className="mr-2" />
            Esporta
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="kpi-cards-grid">
        {overviewLoading || overviewError ? (
          // Loading skeleton for KPI cards
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} data-testid={`kpi-card-skeleton-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-5 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          // Actual KPI cards
          <>
            <ChartStats
              title="Clienti Totali"
              value={overviewStats?.totalClients || 0}
              change="+5% vs periodo precedente"
              changeType="positive"
              icon={<Users className="text-primary" size={20} />}
              subtitle={`${overviewStats?.activeClients || 0} attivi`}
              data-testid="kpi-total-clients"
            />
            
            <ChartStats
              title="Tasso Completamento"
              value={`${overviewStats?.completionRate || 0}%`}
              change={overviewStats?.completionRate > 75 ? "+8% ottimo!" : "Può migliorare"}
              changeType={overviewStats?.completionRate > 75 ? "positive" : "neutral"}
              icon={<Target className="text-success" size={20} />}
              subtitle={`${overviewStats?.completedExercises || 0}/${overviewStats?.totalExercises || 0} esercizi`}
              data-testid="kpi-completion-rate"
            />
            
            <ChartStats
              title="Engagement Medio"
              value={`${overviewStats?.avgClientEngagement || 0} min`}
              change="Stabile"
              changeType="neutral"
              icon={<Clock className="text-accent" size={20} />}
              subtitle="Tempo sessione medio"
              data-testid="kpi-engagement"
            />
            
            <ChartStats
              title="Retention Rate"
              value={`${overviewStats?.clientRetentionRate || 0}%`}
              change="+3% questo mese"
              changeType="positive"
              icon={<TrendingUp className="text-secondary" size={20} />}
              subtitle="Clienti che continuano"
              data-testid="kpi-retention"
            />
          </>
        )}
        
        {/* Error state for KPI cards */}
        {overviewError && !overviewLoading && (
          <Card className="col-span-full" data-testid="kpi-error-state">
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Errore nel caricamento delle statistiche
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  data-testid="button-retry-kpi"
                >
                  Riprova
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            Panoramica
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">
            Performance
          </TabsTrigger>
          <TabsTrigger value="engagement" data-testid="tab-engagement">
            Engagement
          </TabsTrigger>
          <TabsTrigger value="detailed" data-testid="tab-detailed">
            Dettagliato
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {completionTrends && (
              <ExerciseCompletionTrend
                data={completionTrends}
                period={period}
                onPeriodChange={setPeriod}
              />
            )}
            
            {engagementTrends && (
              <ClientEngagementChart data={engagementTrends} />
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryCompletion data={categoryData} />
            
            {clientPerformance && clientPerformance.data && (selectedClient === "all") && (
              <ClientScoreRadial data={clientPerformance.data.slice(0, 5)} />
            )}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          {clientPerformance && clientPerformance.data && (selectedClient === "all") && (
            <PerformanceDistribution data={clientPerformance.data} />
          )}
          
          <Card data-testid="card-performance-table">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy size={20} />
                <span>Classifica Performance Clienti</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Completamento</TableHead>
                      <TableHead>Punteggio Medio</TableHead>
                      <TableHead>Engagement</TableHead>
                      <TableHead>Streak</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientPerformance && clientPerformance.data && (selectedClient === "all") ? 
                      clientPerformance.data
                        .sort((a: any, b: any) => b.performance.completionRate - a.performance.completionRate)
                        .slice(0, 10)
                        .map((item: any, index: number) => (
                          <TableRow key={item.client.id} data-testid={`performance-row-${index}`}>
                            <TableCell>
                              <div className="flex items-center">
                                {index === 0 && <Trophy className="text-yellow-500 mr-1" size={16} />}
                                {index === 1 && <Medal className="text-gray-400 mr-1" size={16} />}
                                {index === 2 && <Award className="text-amber-600 mr-1" size={16} />}
                                <span className="font-medium">{index + 1}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={item.client.avatar} />
                                  <AvatarFallback>
                                    {item.client.firstName[0]}{item.client.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{item.client.firstName} {item.client.lastName}</p>
                                  <p className="text-xs text-muted-foreground">{item.client.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Progress value={item.performance.completionRate} className="w-16" />
                                <span className="text-sm font-medium">{item.performance.completionRate}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.performance.avgScore}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                <Star 
                                  size={14} 
                                  className={item.performance.engagementScore > 80 ? "text-yellow-500" : "text-muted-foreground"} 
                                />
                                <span className="text-sm">{item.performance.engagementScore}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={item.performance.streakDays > 7 ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {item.performance.streakDays} giorni
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            {selectedClient !== "all" ? "Dati performance per cliente selezionato" : "Nessun dato disponibile"}
                          </TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-6">
          {engagementTrends && (
            <ClientEngagementChart data={engagementTrends} />
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card data-testid="card-session-stats">
              <CardHeader>
                <CardTitle className="text-base">Statistiche Sessioni</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Sessioni Totali</span>
                    <span className="font-medium">
                      {engagementTrends?.reduce((sum, item) => sum + item.totalSessions, 0) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Durata Media</span>
                    <span className="font-medium">
                      {engagementTrends?.length ? 
                        Math.round(engagementTrends.reduce((sum, item) => sum + item.avgSessionDuration, 0) / engagementTrends.length) : 0} min
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Login Totali</span>
                    <span className="font-medium">
                      {engagementTrends?.reduce((sum, item) => sum + item.totalLogins, 0) || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-engagement-metrics">
              <CardHeader>
                <CardTitle className="text-base">Metriche Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Clienti Attivi</span>
                    <span className="font-medium">{overviewStats?.activeClients || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Retention Rate</span>
                    <span className="font-medium">{overviewStats?.clientRetentionRate || 0}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Engagement Score</span>
                    <span className="font-medium">{overviewStats?.avgClientEngagement || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-activity-trends">
              <CardHeader>
                <CardTitle className="text-base">Trend Attività</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Picco Attività</span>
                    <span className="font-medium">14:00 - 18:00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Giorno Migliore</span>
                    <span className="font-medium">Martedì</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Crescita Settimanale</span>
                    <span className="font-medium text-success">+12%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Detailed Tab */}
        <TabsContent value="detailed" className="space-y-6">
          <Card data-testid="card-detailed-analytics">
            <CardHeader>
              <CardTitle>Analisi Dettagliata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
                <p>Analisi dettagliata in sviluppo</p>
                <p className="text-sm">Qui appariranno report personalizzati e analytics avanzate</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}