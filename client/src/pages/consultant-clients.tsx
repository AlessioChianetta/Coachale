
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  UserPlus, 
  MoreHorizontal,
  MessageCircle,
  Plus,
  Activity,
  TrendingUp,
  Edit,
  Phone,
  Mail,
  User,
  Search,
  Filter,
  Download,
  Calendar,
  Target,
  Zap,
  Trash2,
  Key,
  CheckSquare,
  Loader2
} from "lucide-react";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import { useState } from "react";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";

export default function ConsultantClientsPage() {
  const isMobile = useIsMobile();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    username: '',
    geminiApiKeys: [] as string[]
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createClientMutation = useMutation({
    mutationFn: async (data: typeof newClientForm) => {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore nella creazione del cliente');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cliente creato",
        description: "Il nuovo cliente è stato creato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsNewClientDialogOpen(false);
      setNewClientForm({ firstName: '', lastName: '', email: '', password: '' });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleCreateClient = () => {
    if (!newClientForm.firstName || !newClientForm.lastName || !newClientForm.email || !newClientForm.password) {
      toast({
        title: "Campi obbligatori",
        description: "Compila tutti i campi per creare il cliente",
        variant: "destructive",
      });
      return;
    }
    if (newClientForm.password.length < 6) {
      toast({
        title: "Password troppo corta",
        description: "La password deve essere di almeno 6 caratteri",
        variant: "destructive",
      });
      return;
    }
    createClientMutation.mutate(newClientForm);
  };

  // Fetch clients
  const { data: clients = [], error: clientsError, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        console.error("Failed to fetch clients:", response.status, response.statusText);
        throw new Error(`Failed to fetch clients: ${response.status}`);
      }
      const data = await response.json();
      return data;
    },
  });

  // Fetch exercise assignments
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

  const handleEditClient = (client: any) => {
    setEditingClient(client);
    setEditForm({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      email: client.email || '',
      phoneNumber: client.phoneNumber || '',
      username: client.username || '',
      geminiApiKeys: client.geminiApiKeys || []
    });
  };

  const handleAddApiKey = () => {
    if (editForm.geminiApiKeys.length < 10) {
      setEditForm(prev => ({
        ...prev,
        geminiApiKeys: [...prev.geminiApiKeys, '']
      }));
    }
  };

  const handleRemoveApiKey = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      geminiApiKeys: prev.geminiApiKeys.filter((_, i) => i !== index)
    }));
  };

  const handleApiKeyChange = (index: number, value: string) => {
    setEditForm(prev => {
      const newKeys = [...prev.geminiApiKeys];
      newKeys[index] = value;
      return { ...prev, geminiApiKeys: newKeys };
    });
  };

  const handleSaveClient = async () => {
    if (!editingClient) return;

    // Filter out empty API keys
    const validApiKeys = editForm.geminiApiKeys.filter(key => key.trim() !== '');

    try {
      const updateData = {
        ...editForm,
        phone_number: editForm.phoneNumber,
        gemini_api_keys: validApiKeys
      };
      
      const response = await fetch(`/api/users/${editingClient.id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('Errore durante il salvataggio');
      }

      const updatedClient = await response.json();

      toast({
        title: "Successo",
        description: "Dati cliente aggiornati con successo",
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      await queryClient.refetchQueries({ queryKey: ["/api/clients"] });
      
      setEditingClient(null);
    } catch (error: any) {
      console.error('Errore salvataggio cliente:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio",
        variant: "destructive",
      });
    }
  };

  // Filter clients based on search term and status
  const filteredClients = clients.filter((client: any) => {
    const matchesSearch = 
      client.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.username?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const clientAssignments = assignments.filter((a: any) => a.clientId === client.id);
    const isActive = clientAssignments.some((a: any) => a.status === 'in_progress' || a.status === 'completed');
    
    const matchesStatus = 
      statusFilter === "all" ? true :
      statusFilter === "active" ? isActive :
      !isActive;
    
    return matchesSearch && matchesStatus;
  });

  if (clientsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Activity className="h-8 w-8 animate-spin text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Caricamento in corso</h3>
            <p className="text-slate-600">Stiamo recuperando i dati dei tuoi clienti...</p>
          </div>
        </div>
      </div>
    );
  }

  if (clientsError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
            <Users className="h-10 w-10 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Errore nel caricamento</h1>
            <p className="text-slate-600 mb-4">
              Impossibile caricare i dati dei clienti. Riprova più tardi.
            </p>
            <p className="text-sm text-slate-500">{clientsError.message}</p>
          </div>
          <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Activity className="w-4 h-4 mr-2" />
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  // Calculate stats
  const newClientsCount = clients.filter((c: any) => {
    if (!c.createdAt) return false;
    const createdDate = new Date(c.createdAt);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return createdDate >= lastMonth;
  }).length;

  const activeClientsCount = clients.filter((c: any) => {
    const clientAssignments = assignments.filter((a: any) => a.clientId === c.id);
    return clientAssignments.some((a: any) => a.status === 'in_progress' || a.status === 'completed');
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />

        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          {/* Navigation Tabs */}
          <NavigationTabs
            tabs={[
              { label: "Clienti", href: "/consultant/clients", icon: Users },
              { label: "Stato Cliente", href: "/consultant/client-state", icon: Target },
              { label: "Feedback", href: "/consultant/client-daily", icon: CheckSquare },
            ]}
          />

          {/* Premium Header */}
          <div className="mb-4 sm:mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Gestione Clienti</h1>
                      <p className="text-blue-100 text-xs sm:text-sm md:text-base lg:text-lg hidden sm:block">Dashboard completa per la gestione dei tuoi clienti</p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">{clients.length}</div>
                    <div className="text-sm text-blue-100">Clienti Totali</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">{activeClientsCount}</div>
                    <div className="text-sm text-blue-100">Attivi</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-blue-700">Clienti Totali</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-900">{clients.length}</p>
                    <p className="text-[10px] sm:text-xs text-blue-600 hidden sm:block">Tutti i clienti registrati</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-blue-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Users className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-emerald-700">Nuovi Clienti</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-emerald-900">{newClientsCount}</p>
                    <p className="text-[10px] sm:text-xs text-emerald-600 hidden sm:block">Ultimo mese</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-emerald-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <UserPlus className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-amber-700">Clienti Attivi</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-amber-900">{activeClientsCount}</p>
                    <p className="text-[10px] sm:text-xs text-amber-600 hidden sm:block">Con esercizi in corso</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-amber-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Zap className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-purple-700">Progresso Medio</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-900">
                      {assignments.length > 0 ? 
                        Math.round((assignments.filter((a: any) => a.status === 'completed').length / assignments.length) * 100) 
                        : 0}%
                    </p>
                    <p className="text-[10px] sm:text-xs text-purple-600 hidden sm:block">Esercizi completati</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-purple-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Target className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Clients Grid */}
          <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-800 mb-1">
                    Elenco Clienti
                  </CardTitle>
                  <p className="text-sm text-slate-600">Gestisci e monitora tutti i tuoi clienti registrati</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 sm:flex-none sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Cerca clienti..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-white/80 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="all">Tutti i clienti</option>
                      <option value="active">Solo attivi</option>
                      <option value="inactive">Solo inattivi</option>
                    </select>
                    <Button 
                      onClick={() => setIsNewClientDialogOpen(true)}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                      size="sm"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Nuovo Cliente
                    </Button>
                    <Button variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50">
                      <Download className="w-4 h-4 mr-2" />
                      Esporta
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-4">
              {filteredClients.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Users size={40} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">
                    {searchTerm ? "Nessun risultato" : "Nessun cliente registrato"}
                  </h3>
                  <p className="text-slate-600 mb-6 max-w-md mx-auto">
                    {searchTerm 
                      ? "Prova a modificare i termini di ricerca o rimuovi i filtri"
                      : "I clienti che si registrano con il tuo codice consulente appariranno qui"
                    }
                  </p>
                  {searchTerm && (
                    <Button variant="outline" onClick={() => setSearchTerm("")}>
                      Rimuovi filtri
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredClients.map((client: any) => {
                    const clientAssignments = assignments.filter((a: any) => a.clientId === client.id);
                    const completedCount = clientAssignments.filter((a: any) => a.status === 'completed').length;
                    const completionRate = clientAssignments.length > 0 ? 
                      Math.round((completedCount / clientAssignments.length) * 100) : 0;

                    return (
                      <Card 
                        key={client.id}
                        className="border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-white"
                      >
                        <CardContent className="p-3 lg:p-4">
                          <div className="grid grid-cols-12 gap-2 lg:gap-3 items-center">
                            {/* Cliente */}
                            <div className="col-span-12 lg:col-span-2 flex items-center gap-2">
                              <Avatar className="w-9 h-9 lg:w-10 lg:h-10 ring-2 ring-slate-100">
                                <AvatarImage src={client.avatar} />
                                <AvatarFallback className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-semibold text-xs">
                                  {client.firstName?.[0]}{client.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-800 text-sm truncate">
                                  {client.firstName} {client.lastName}
                                </p>
                                <p className="text-xs text-slate-500 truncate">@{client.username}</p>
                              </div>
                            </div>

                            {/* Contatti */}
                            <div className="col-span-6 lg:col-span-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs text-slate-600 truncate">
                                  <Mail className="w-3 h-3 flex-shrink-0 text-slate-400" />
                                  <span className="truncate">{client.email}</span>
                                </div>
                                {client.phoneNumber && (
                                  <div className="flex items-center gap-2 text-xs text-slate-600 truncate">
                                    <Phone className="w-3 h-3 flex-shrink-0 text-slate-400" />
                                    <span className="truncate">{client.phoneNumber}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Registrazione */}
                            <div className="col-span-6 lg:col-span-2">
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{client.createdAt ? new Date(client.createdAt).toLocaleDateString('it-IT') : 'N/A'}</span>
                              </div>
                            </div>

                            {/* Esercizi */}
                            <div className="col-span-4 lg:col-span-2 text-center">
                              <div className="text-sm font-semibold text-slate-800">
                                {clientAssignments.length}
                              </div>
                              <div className="text-xs text-slate-500">
                                assegnati
                              </div>
                            </div>

                            {/* Completati */}
                            <div className="col-span-4 lg:col-span-1 text-center">
                              <div className="text-sm font-semibold text-slate-800">
                                {completedCount}
                              </div>
                              <div className="text-xs text-slate-500">
                                completati
                              </div>
                            </div>

                            {/* Progresso */}
                            <div className="col-span-4 lg:col-span-1 text-center">
                              <div className="text-base lg:text-lg font-bold text-slate-800">
                                {completionRate}%
                              </div>
                            </div>

                            {/* Azioni */}
                            <div className="col-span-12 lg:col-span-1 flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Modifica cliente"
                                onClick={() => handleEditClient(client)}
                                className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Altre azioni"
                                className="h-8 w-8 p-0 hover:bg-slate-100 hover:text-slate-600"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Status Bar */}
                          <div className="mt-2 lg:mt-3 pt-2 lg:pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={client.isActive !== false}
                                onCheckedChange={async (checked) => {
                                  try {
                                    await fetch(`/api/users/${client.id}`, {
                                      method: 'PATCH',
                                      headers: {
                                        ...getAuthHeaders(),
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({ isActive: checked }),
                                    });
                                    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
                                    toast({
                                      title: checked ? "Cliente attivato" : "Cliente disattivato",
                                      description: `${client.firstName} ${client.lastName} è stato ${checked ? 'attivato' : 'disattivato'} con successo.`,
                                    });
                                  } catch (error) {
                                    console.error('Error updating client status:', error);
                                    toast({
                                      title: "Errore",
                                      description: "Impossibile aggiornare lo stato del cliente.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              />
                              <Badge 
                                variant={client.isActive !== false ? "default" : "secondary"}
                                className={`text-xs ${client.isActive !== false
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full mr-2 ${client.isActive !== false ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                {client.isActive !== false ? "Attivo" : "Disattivato"}
                              </Badge>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="flex-1 w-full sm:w-auto sm:max-w-xs lg:max-w-md">
                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${completionRate}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Client Dialog */}
      <Dialog open={isNewClientDialogOpen} onOpenChange={setIsNewClientDialogOpen}>
        <DialogContent className="max-w-md bg-white/95 backdrop-blur-sm border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <UserPlus className="h-5 w-5 text-emerald-600" />
              </div>
              Nuovo Cliente
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Crea un nuovo account cliente associato al tuo profilo consulente
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newFirstName" className="text-right text-sm font-medium">
                Nome *
              </Label>
              <Input
                id="newFirstName"
                value={newClientForm.firstName}
                onChange={(e) => setNewClientForm(prev => ({...prev, firstName: e.target.value}))}
                className="col-span-3 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                placeholder="Nome"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newLastName" className="text-right text-sm font-medium">
                Cognome *
              </Label>
              <Input
                id="newLastName"
                value={newClientForm.lastName}
                onChange={(e) => setNewClientForm(prev => ({...prev, lastName: e.target.value}))}
                className="col-span-3 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                placeholder="Cognome"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newEmail" className="text-right text-sm font-medium">
                Email *
              </Label>
              <Input
                id="newEmail"
                type="email"
                value={newClientForm.email}
                onChange={(e) => setNewClientForm(prev => ({...prev, email: e.target.value}))}
                className="col-span-3 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                placeholder="email@esempio.com"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newPassword" className="text-right text-sm font-medium">
                Password *
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newClientForm.password}
                onChange={(e) => setNewClientForm(prev => ({...prev, password: e.target.value}))}
                className="col-span-3 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                placeholder="Minimo 6 caratteri"
              />
            </div>
          </div>
          
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsNewClientDialogOpen(false)}
              className="border-slate-200 hover:bg-slate-50"
            >
              Annulla
            </Button>
            <Button 
              onClick={handleCreateClient}
              disabled={createClientMutation.isPending}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
            >
              {createClientMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creazione...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crea Cliente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Edit Client Dialog */}
      <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
        <DialogContent className="max-w-md bg-white/95 backdrop-blur-sm border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Edit className="h-5 w-5 text-blue-600" />
              </div>
              Modifica Cliente
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Aggiorna le informazioni di {editingClient?.firstName} {editingClient?.lastName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right text-sm font-medium">
                Nome
              </Label>
              <Input
                id="firstName"
                value={editForm.firstName}
                onChange={(e) => setEditForm(prev => ({...prev, firstName: e.target.value}))}
                className="col-span-3 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                placeholder="Nome"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right text-sm font-medium">
                Cognome
              </Label>
              <Input
                id="lastName"
                value={editForm.lastName}
                onChange={(e) => setEditForm(prev => ({...prev, lastName: e.target.value}))}
                className="col-span-3 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                placeholder="Cognome"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({...prev, email: e.target.value}))}
                className="col-span-3 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                placeholder="email@esempio.com"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phoneNumber" className="text-right text-sm font-medium">
                Telefono
              </Label>
              <Input
                id="phoneNumber"
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm(prev => ({...prev, phoneNumber: e.target.value}))}
                className="col-span-3 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                placeholder="+39 123 456 7890"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right text-sm font-medium">
                Username
              </Label>
              <Input
                id="username"
                value={editForm.username}
                onChange={(e) => setEditForm(prev => ({...prev, username: e.target.value}))}
                className="col-span-3 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                placeholder="username"
              />
            </div>
            
            <div className="space-y-4 col-span-full">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Keys Gemini (Rotazione Automatica)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddApiKey}
                  disabled={editForm.geminiApiKeys.length >= 10}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi Key
                </Button>
              </div>
              
              {editForm.geminiApiKeys.length === 0 ? (
                <div className="text-sm text-slate-500 italic py-2 text-center border-2 border-dashed border-slate-200 rounded-lg">
                  Nessuna API key configurata. Clicca "Aggiungi Key" per iniziare.
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {editForm.geminiApiKeys.map((apiKey, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-shrink-0 w-8 text-center">
                        <span className="text-xs font-medium text-slate-500">#{index + 1}</span>
                      </div>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(index, e.target.value)}
                        className="flex-1 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                        placeholder={`API Key ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveApiKey(index)}
                        className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-slate-500">
                Le API keys verranno ruotate automaticamente ad ogni messaggio del cliente ({editForm.geminiApiKeys.length}/10 keys)
              </p>
            </div>
          </div>
          
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setEditingClient(null)}
              className="border-slate-200 hover:bg-slate-50"
            >
              Annulla
            </Button>
            <Button 
              onClick={handleSaveClient}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConsultantAIAssistant />
    </div>
  );
}
