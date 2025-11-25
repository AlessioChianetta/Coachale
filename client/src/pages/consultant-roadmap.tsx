
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Map,
  TrendingUp,
  Search,
  Filter,
  Target,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3,
  ChevronRight,
  Star,
  Activity
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import type { User } from "@shared/schema";

interface ClientRoadmapOverview {
  clientId: string;
  clientName: string;
  totalItems: number;
  completedItems: number;
  progressPercentage: number;
}

interface CombinedClientData {
  clientId: string;
  clientName: string;
  totalItems: number;
  completedItems: number;
  progressPercentage: number;
  clientDetails?: User;
}

export default function ConsultantRoadmap() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch roadmap overview for all clients
  const { data: overview = [], isLoading: overviewLoading, error: overviewError } = useQuery<ClientRoadmapOverview[]>({
    queryKey: ["/api/roadmap/consultant/overview"],
  });

  // Fetch clients for additional info (only active clients)
  const { data: clients = [], isLoading: clientsLoading, error: clientsError } = useQuery<User[]>({
    queryKey: ["/api/clients", "active"],
    queryFn: async () => {
      const response = await fetch("/api/clients?activeOnly=true", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const isLoading = overviewLoading || clientsLoading;
  const error = overviewError || clientsError;

  // Combine overview data with client details (filter for active clients only)
  const combinedData: CombinedClientData[] = overview
    .map((item: ClientRoadmapOverview) => {
      const client = clients.find((c: User) => c.id === item.clientId);
      return {
        ...item,
        clientDetails: client,
      };
    })
    .filter((item: CombinedClientData) => item.clientDetails?.isActive === true);

  // Filter based on search term
  const filteredData = combinedData.filter((item: CombinedClientData) =>
    item.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.clientDetails?.email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate overall stats
  const totalClients = combinedData.length;
  const averageProgress = combinedData.reduce((acc, curr) => acc + curr.progressPercentage, 0) / totalClients || 0;
  const clientsWithFullProgress = combinedData.filter((item) => item.progressPercentage === 100).length;
  const clientsNeedingAttention = combinedData.filter((item) => item.progressPercentage < 25).length;

  const getProgressStatus = (percentage: number) => {
    if (percentage === 100) return { 
      label: "Completato", 
      color: "bg-emerald-500", 
      textColor: "text-emerald-700",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200"
    };
    if (percentage >= 75) return { 
      label: "Avanzato", 
      color: "bg-blue-500", 
      textColor: "text-blue-700",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-200"
    };
    if (percentage >= 50) return { 
      label: "In Corso", 
      color: "bg-amber-500", 
      textColor: "text-amber-700",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200"
    };
    if (percentage >= 25) return { 
      label: "Iniziato", 
      color: "bg-orange-500", 
      textColor: "text-orange-700",
      badgeColor: "bg-orange-100 text-orange-800 border-orange-200"
    };
    return { 
      label: "Non Iniziato", 
      color: "bg-gray-400", 
      textColor: "text-gray-700",
      badgeColor: "bg-gray-100 text-gray-800 border-gray-200"
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
        <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
          <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
                <p className="text-gray-600 text-lg">Caricamento roadmap...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="consultant-roadmap">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 p-8 max-w-7xl mx-auto">
          <div className="space-y-8">
            {/* Modern Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold mb-2">Dashboard Clienti</h1>
                  <p className="text-blue-100 text-lg">
                    Monitora il progresso nel Metodo ORBITALE
                  </p>
                </div>
                <div className="hidden md:flex items-center space-x-4">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                    <Map className="h-8 w-8 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-blue-50 to-blue-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-blue-700">Clienti Totali</CardTitle>
                  <div className="bg-blue-500 p-2 rounded-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-900" data-testid="stat-total-clients">{totalClients}</div>
                  <p className="text-sm text-blue-600 mt-1">
                    Con roadmap attiva
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-emerald-50 to-emerald-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-emerald-700">Progresso Medio</CardTitle>
                  <div className="bg-emerald-500 p-2 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emerald-900" data-testid="stat-average-progress">{Math.round(averageProgress)}%</div>
                  <p className="text-sm text-emerald-600 mt-1">
                    Media complessiva
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-amber-50 to-amber-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-amber-700">Completate</CardTitle>
                  <div className="bg-amber-500 p-2 rounded-lg">
                    <Star className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-900" data-testid="stat-completed-roadmaps">{clientsWithFullProgress}</div>
                  <p className="text-sm text-amber-600 mt-1">
                    Roadmap al 100%
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-red-50 to-red-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-red-700">Attenzione Richiesta</CardTitle>
                  <div className="bg-red-500 p-2 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-900" data-testid="stat-need-attention">{clientsNeedingAttention}</div>
                  <p className="text-sm text-red-600 mt-1">
                    Progresso &lt; 25%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Modern Search Bar */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Cerca clienti per nome o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 text-lg border-0 bg-gray-50 focus:bg-white transition-colors"
                    data-testid="input-search-clients"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Error State */}
            {error && (
              <Card className="border-0 shadow-lg border-red-200 bg-red-50">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="bg-red-100 p-4 rounded-full mb-4">
                    <AlertCircle className="h-12 w-12 text-red-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-red-900 mb-2">Errore nel caricamento</h3>
                  <p className="text-red-700 text-center">
                    Si è verificato un errore nel caricamento dei dati. Riprova più tardi.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Enhanced Client List */}
            {!error && (
              <div className="space-y-4">
                {filteredData.length === 0 ? (
                  <Card className="border-0 shadow-lg">
                    <CardContent className="flex flex-col items-center justify-center py-16" data-testid="empty-state">
                      <div className="bg-gray-100 p-4 rounded-full mb-4">
                        <Map className="h-12 w-12 text-gray-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessun cliente trovato</h3>
                      <p className="text-gray-600 text-center">
                        {searchTerm ? "Prova a modificare i termini di ricerca." : "Non ci sono clienti con roadmap attiva al momento."}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {filteredData.map((item: CombinedClientData) => {
                      const status = getProgressStatus(item.progressPercentage);
                      return (
                        <Card key={item.clientId} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white overflow-hidden">
                          <CardContent className="p-0">
                            <div className="flex items-center">
                              {/* Progress Indicator Strip */}
                              <div className={`w-2 h-full ${status.color}`} />
                              
                              <div className="flex-1 p-6">
                                <div className="flex items-center justify-between">
                                  {/* Client Info */}
                                  <div className="flex items-center space-x-4">
                                    <Avatar className="h-16 w-16 ring-4 ring-white shadow-lg">
                                      <AvatarImage src={item.clientDetails?.avatar ?? undefined} />
                                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg font-semibold">
                                        {item.clientName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    
                                    <div className="space-y-1">
                                      <h3 className="text-xl font-semibold text-gray-900">{item.clientName}</h3>
                                      <p className="text-gray-500 text-sm">
                                        {item.clientDetails?.email}
                                      </p>
                                      <Badge variant="outline" className={`${status.badgeColor} border font-medium`}>
                                        {status.label}
                                      </Badge>
                                    </div>
                                  </div>

                                  {/* Progress Stats */}
                                  <div className="flex items-center space-x-8">
                                    <div className="text-center">
                                      <div className="text-3xl font-bold text-gray-900">{item.progressPercentage}%</div>
                                      <div className="text-sm text-gray-500">Completamento</div>
                                    </div>

                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-gray-700">{item.completedItems}<span className="text-gray-400">/{item.totalItems}</span></div>
                                      <div className="text-sm text-gray-500">Attività</div>
                                    </div>

                                    <Link href={`/consultant/client/${item.clientId}/roadmap`}>
                                      <Button
                                        size="lg"
                                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                                        data-testid={`button-view-client-${item.clientId}`}
                                        onClick={() => {
                                          console.log("Navigating to client roadmap:", {
                                            clientId: item.clientId,
                                            clientName: item.clientName,
                                            url: `/consultant/client/${item.clientId}/roadmap`
                                          });
                                        }}
                                      >
                                        Gestisci
                                        <ChevronRight className="ml-2 h-5 w-5" />
                                      </Button>
                                    </Link>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-6">
                                  <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                                    <span className="font-medium">Progresso nella roadmap</span>
                                    <span>{item.completedItems} di {item.totalItems} completati</span>
                                  </div>
                                  <div className="relative">
                                    <Progress 
                                      value={item.progressPercentage} 
                                      className="h-3 bg-gray-100" 
                                    />
                                    <div 
                                      className={`absolute top-0 left-0 h-3 rounded-full transition-all duration-500 ${status.color}`}
                                      style={{ width: `${item.progressPercentage}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}
