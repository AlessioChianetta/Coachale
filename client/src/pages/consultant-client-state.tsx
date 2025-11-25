import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Target, 
  Users, 
  Sparkles, 
  TrendingUp, 
  Calendar,
  CheckCircle,
  Loader2,
  Search,
  Activity
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import ClientStateDashboard from "@/components/client-state-dashboard";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";

interface ClientStateStats {
  totalClientsWithState: number;
  averageMotivation: number;
  aiGenerated: number;
  updatedToday: number;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  hasState?: boolean;
}

export default function ConsultantClientStatePage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const user = getAuthUser();

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  const { data: stats, isLoading: statsLoading } = useQuery<ClientStateStats>({
    queryKey: ["/api/clients/state/statistics"],
    queryFn: async () => {
      const response = await fetch("/api/clients/state/statistics", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch statistics");
      const result = await response.json();
      return result.data || result;
    },
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const { data: clientStates = [] } = useQuery({
    queryKey: ["/api/clients/all-states"],
    queryFn: async () => {
      const statesPromises = clients.map(async (client) => {
        try {
          const response = await fetch(`/api/clients/${client.id}/state`, {
            headers: getAuthHeaders(),
          });
          if (response.ok) {
            const result = await response.json();
            return { clientId: client.id, hasState: true, state: result.data };
          }
        } catch {
          return { clientId: client.id, hasState: false };
        }
        return { clientId: client.id, hasState: false };
      });
      return Promise.all(statesPromises);
    },
    enabled: clients.length > 0,
  });

  const getClientHasState = (clientId: string): boolean => {
    const stateInfo = clientStates.find((s: any) => s.clientId === clientId);
    return stateInfo?.hasState || false;
  };

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const searchLower = searchTerm.toLowerCase();
      
      // Filtra SOLO per search term (mostra tutti i clienti, sia con che senza stato)
      return (
        client.firstName?.toLowerCase().includes(searchLower) ||
        client.lastName?.toLowerCase().includes(searchLower) ||
        client.email?.toLowerCase().includes(searchLower) ||
        client.username?.toLowerCase().includes(searchLower)
      );
    });
  }, [clients, searchTerm]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className={`flex-1 transition-all duration-300 ${isMobile ? 'ml-0' : sidebarOpen ? 'ml-64' : 'ml-0'}`}>
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-2xl mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <Target className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold">Gestione Stato Clienti</h1>
                  <p className="text-blue-100 text-lg mt-2">
                    Analizza e configura lo stato attuale e ideale dei tuoi clienti con AI
                  </p>
                </div>
              </div>
            </div>

            {/* Sezione 1 - Statistiche Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              
              {/* Card 1: Clienti con Stato */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-blue-100">
                      Clienti con Stato
                    </CardTitle>
                    <Users className="w-5 h-5 text-blue-100" />
                  </div>
                </CardHeader>
                <CardContent>
                  {statsLoading || clientsLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold">
                        {stats?.totalClientsWithState || 0}
                      </div>
                      <p className="text-xs text-blue-100 mt-1">
                        su {clients.length} clienti totali
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Card 2: Motivazione Media */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-green-100">
                      Motivazione Media
                    </CardTitle>
                    <TrendingUp className="w-5 h-5 text-green-100" />
                  </div>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold">
                        {stats?.averageMotivation?.toFixed(1) || '0.0'}/10
                      </div>
                      <p className="text-xs text-green-100 mt-1">
                        livello di motivazione
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Card 3: Generati con AI */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-purple-100">
                      Generati con AI
                    </CardTitle>
                    <Sparkles className="w-5 h-5 text-purple-100" />
                  </div>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold">
                        {stats?.aiGenerated || 0}
                      </div>
                      <p className="text-xs text-purple-100 mt-1">
                        analisi automatiche
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Card 4: Aggiornati Oggi */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-orange-100">
                      Aggiornati Oggi
                    </CardTitle>
                    <Calendar className="w-5 h-5 text-orange-100" />
                  </div>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold">
                        {stats?.updatedToday || 0}
                      </div>
                      <p className="text-xs text-orange-100 mt-1">
                        modifiche recenti
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sezione 2 - Selezione Cliente */}
            <Card className="border-0 shadow-lg mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Seleziona Cliente
                </CardTitle>
                <CardDescription>
                  Scegli un cliente per visualizzare o creare il suo stato
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Search Input */}
                <div className="space-y-2">
                  <Label htmlFor="search">Cerca Cliente</Label>
                  <Input
                    id="search"
                    type="text"
                    placeholder="Cerca per nome, cognome o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Client Select */}
                <div className="space-y-2">
                  <Label htmlFor="client-select">Cliente</Label>
                  {clientsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                      <span className="text-slate-600">Caricamento clienti...</span>
                    </div>
                  ) : (
                    <Select
                      value={selectedClientId}
                      onValueChange={setSelectedClientId}
                    >
                      <SelectTrigger id="client-select" className="w-full">
                        <SelectValue placeholder="Seleziona un cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredClients.length === 0 ? (
                          <div className="p-4 text-center text-slate-500">
                            Nessun cliente trovato
                          </div>
                        ) : (
                          filteredClients.map((client) => {
                          const hasState = getClientHasState(client.id);
                          return (
                            <SelectItem key={client.id} value={client.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>
                                  {client.firstName} {client.lastName} - {client.email}
                                </span>
                                {hasState ? (
                                  <Badge variant="default" className="ml-2 bg-green-600">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Stato configurato
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="ml-2">
                                    Nessuno stato
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {selectedClient && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <Activity className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">
                        Cliente selezionato: {selectedClient.firstName} {selectedClient.lastName}
                      </p>
                      <p className="text-sm text-blue-700">
                        Email: {selectedClient.email}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sezione 3 - Client State Dashboard */}
            {selectedClientId && (
              <div className="mb-8">
                <ClientStateDashboard
                  clientId={selectedClientId}
                  consultantId={user.id}
                  readonly={false}
                />
              </div>
            )}

            {/* Empty State when no client selected */}
            {!selectedClientId && (
              <Card className="border-0 shadow-lg">
                <CardContent className="py-16">
                  <div className="text-center space-y-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto">
                      <Target className="w-12 h-12 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800 mb-2">
                        Seleziona un Cliente
                      </h3>
                      <p className="text-slate-600 max-w-md mx-auto">
                        Scegli un cliente con stato configurato dalla lista per visualizzare e modificare il suo stato attuale e ideale.
                        Puoi anche generare l'analisi automaticamente con l'AI.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 justify-center">
                      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                        <Users className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-700">
                          {clients.length} Clienti
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                        <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-700">
                          {stats?.totalClientsWithState || 0} con Stato
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                        <Sparkles className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-700">
                          AI Assistant
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </main>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}
