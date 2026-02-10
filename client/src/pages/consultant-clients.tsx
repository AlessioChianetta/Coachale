
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
  Loader2,
  Briefcase,
  UserCog,
  UserMinus,
  BarChart3,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  CalendarPlus,
  CalendarDays,
  X,
  Plus as PlusIcon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import { useState, useMemo } from "react";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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
    password: '',
    isEmployee: false
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    username: '',
    geminiApiKeys: [] as string[],
    monthlyConsultationLimit: null as number | null
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<'name' | 'email' | 'date' | 'exercises' | 'progress'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Bulk selection state
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  
  // In-page tab state
  const [activeTab, setActiveTab] = useState<'clienti' | 'monitoraggio'>('clienti');
  
  // Scheduling wizard state
  const [schedulingClient, setSchedulingClient] = useState<any>(null);
  const [schedulingStep, setSchedulingStep] = useState<'overview' | 'proposal' | 'review'>('overview');
  const [proposedDates, setProposedDates] = useState<Array<{date: string, time: string, month: string}>>([]);
  const [schedulingMonths, setSchedulingMonths] = useState(3);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [isCreatingConsultations, setIsCreatingConsultations] = useState(false);
  const [schedulingIntervalDays, setSchedulingIntervalDays] = useState<number>(0);
  const [schedulingExtraMonths, setSchedulingExtraMonths] = useState<Record<number, number>>({});
  const [schedulingTimePreference, setSchedulingTimePreference] = useState<'auto' | 'morning' | 'afternoon'>('auto');
  const [detectedPattern, setDetectedPattern] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const licensesQuery = useQuery({
    queryKey: ["/api/consultant/licenses"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/licenses", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch licenses");
      return res.json();
    },
  });

  const licenseData = licensesQuery.data?.data || { employeeTotal: 5, employeeUsed: 0 };

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
      setNewClientForm({ firstName: '', lastName: '', email: '', password: '', isEmployee: false });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const addConsultantProfileMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/users/${clientId}/add-consultant-profile`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore nell\'aggiunta del profilo consulente');
      }
      return response.json();
    },
    onSuccess: (data, clientId) => {
      toast({
        title: "Profilo consulente aggiunto",
        description: "L'utente ora può accedere sia come cliente che come consulente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const removeConsultantProfileMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/users/${clientId}/remove-consultant-profile`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore nella rimozione del profilo consulente');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profilo consulente rimosso",
        description: "L'utente può ora accedere solo come cliente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
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

  // Fetch consultation monitoring data
  const { data: monitoringData = [], isLoading: monitoringLoading } = useQuery({
    queryKey: ["/api/clients/consultation-monitoring"],
    queryFn: async () => {
      const response = await fetch("/api/clients/consultation-monitoring", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch monitoring data");
      return response.json();
    },
    enabled: activeTab === 'monitoraggio',
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
      geminiApiKeys: client.geminiApiKeys || [],
      monthlyConsultationLimit: client.monthlyConsultationLimit ?? null
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
    
    // Use isActive field from user (the toggle switch), default to true if not set
    const clientIsActive = client.isActive !== false;
    
    const matchesStatus = 
      statusFilter === "all" ? true :
      statusFilter === "active" ? clientIsActive :
      !clientIsActive;
    
    return matchesSearch && matchesStatus;
  });

  // Sort and paginate clients
  const sortedAndPaginatedClients = useMemo(() => {
    // First, enrich clients with computed data
    const enrichedClients = filteredClients.map((client: any) => {
      const clientAssignments = assignments.filter((a: any) => a.clientId === client.id);
      const completedCount = clientAssignments.filter((a: any) => a.status === 'completed').length;
      const completionRate = clientAssignments.length > 0 ? 
        Math.round((completedCount / clientAssignments.length) * 100) : 0;
      return {
        ...client,
        _assignmentsCount: clientAssignments.length,
        _completedCount: completedCount,
        _completionRate: completionRate
      };
    });

    // Sort
    const sorted = [...enrichedClients].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'name':
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'email':
          comparison = (a.email || '').localeCompare(b.email || '');
          break;
        case 'date':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case 'exercises':
          comparison = a._assignmentsCount - b._assignmentsCount;
          break;
        case 'progress':
          comparison = a._completionRate - b._completionRate;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sorted.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredClients, assignments, sortColumn, sortDirection, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: "all" | "active" | "inactive") => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClients(new Set(sortedAndPaginatedClients.map((c: any) => c.id)));
    } else {
      setSelectedClients(new Set());
    }
  };

  const handleSelectClient = (clientId: string, checked: boolean) => {
    const newSelected = new Set(selectedClients);
    if (checked) {
      newSelected.add(clientId);
    } else {
      newSelected.delete(clientId);
    }
    setSelectedClients(newSelected);
  };

  const handleGenerateProposal = async () => {
    if (!schedulingClient) return;
    setIsGeneratingProposal(true);
    try {
      const response = await fetch('/api/consultations/schedule-proposal', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: schedulingClient.id,
          months: schedulingMonths,
          consultationsPerMonth: schedulingClient.monthlyConsultationLimit,
          intervalDays: schedulingIntervalDays || undefined,
          extraConsultations: Object.entries(schedulingExtraMonths)
            .filter(([_, count]) => count > 0)
            .map(([monthIndex, count]) => ({ monthIndex: parseInt(monthIndex), count })),
          timePreference: schedulingTimePreference
        })
      });
      if (!response.ok) throw new Error('Failed to generate proposal');
      const data = await response.json();
      setProposedDates(data.proposals);
      setDetectedPattern(data.detectedPattern || null);
      setSchedulingStep('proposal');
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile generare la proposta", variant: "destructive" });
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  const handleCreateConsultations = async () => {
    if (!schedulingClient || proposedDates.length === 0) return;
    setIsCreatingConsultations(true);
    try {
      const response = await fetch('/api/consultations/batch-create', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: schedulingClient.id,
          consultations: proposedDates
        })
      });
      if (!response.ok) throw new Error('Failed to create consultations');
      const data = await response.json();
      toast({ title: "Consulenze programmate!", description: data.message });
      if (data.calendarConnected && data.calendarErrors > 0) {
        toast({ 
          title: "Attenzione", 
          description: `${data.calendarErrors} evento/i non creato/i su Google Calendar. Le consulenze sono state comunque salvate.`, 
          variant: "destructive" 
        });
      }
      setSchedulingClient(null);
      setSchedulingStep('overview');
      setProposedDates([]);
      queryClient.invalidateQueries({ queryKey: ['/api/clients/consultation-monitoring'] });
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile creare le consulenze", variant: "destructive" });
    } finally {
      setIsCreatingConsultations(false);
    }
  };

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3 h-3 text-cyan-600" />
      : <ChevronDown className="w-3 h-3 text-cyan-600" />;
  };

  if (clientsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto">
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
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 p-4">
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
          <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
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
              { label: "Monitoraggio", href: "/consultant/clients/monitoring", icon: BarChart3 },
            ]}
          />

          {/* Premium Header */}
          <div className="mb-4 sm:mb-6 md:mb-8">
            <div className="bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400"></div>
              <div className="flex items-center justify-between">
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl sm:rounded-2xl">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Gestione Clienti</h1>
                      <p className="text-slate-400 text-xs sm:text-sm md:text-base lg:text-lg hidden sm:block">Dashboard completa per la gestione dei tuoi clienti</p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 text-center border border-slate-700/50">
                    <div className="text-3xl font-bold">{clients.length}</div>
                    <div className="text-sm text-slate-400">Clienti Totali</div>
                  </div>
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 text-center border border-slate-700/50">
                    <div className="text-3xl font-bold">{activeClientsCount}</div>
                    <div className="text-sm text-slate-400">Attivi</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-cyan-700">Clienti Totali</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">{clients.length}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">Tutti i clienti registrati</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Users className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-emerald-700">Nuovi Clienti</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">{newClientsCount}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">Ultimo mese</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <UserPlus className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-amber-700">Clienti Attivi</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">{activeClientsCount}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">Con esercizi in corso</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Zap className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-teal-700">Progresso Medio</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">
                      {assignments.length > 0 ? 
                        Math.round((assignments.filter((a: any) => a.status === 'completed').length / assignments.length) * 100) 
                        : 0}%
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">Esercizi completati</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Target className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* In-page Tab Switcher */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('clienti')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'clienti'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Elenco Clienti
            </button>
            <button
              onClick={() => setActiveTab('monitoraggio')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'monitoraggio'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Monitoraggio Consulenze
            </button>
          </div>

          {activeTab === 'monitoraggio' ? (
            /* Monitoring Content */
            (() => {
              const totalMonitored = monitoringData.length;
              const avgUsage = totalMonitored > 0
                ? Math.round(monitoringData.reduce((acc: number, c: any) => acc + (c.consultationsUsedThisMonth / c.monthlyConsultationLimit) * 100, 0) / totalMonitored)
                : 0;
              const atRiskCount = monitoringData.filter((c: any) => {
                const pct = c.remaining / c.monthlyConsultationLimit;
                return pct < 0.25;
              }).length;

              return (
                <div className="space-y-4">
                  {/* Summary Header */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Card className="border border-slate-200 shadow-sm bg-white/80">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                          <Users className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Clienti monitorati</p>
                          <p className="text-xl font-bold text-slate-800">{totalMonitored}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border border-slate-200 shadow-sm bg-white/80">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Utilizzo medio</p>
                          <p className="text-xl font-bold text-slate-800">{avgUsage}%</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border border-slate-200 shadow-sm bg-white/80">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Clienti a rischio</p>
                          <p className="text-xl font-bold text-slate-800">{atRiskCount}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Monitoring Table */}
                  <Card className="border border-slate-200 shadow-sm bg-white/80">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-bold text-slate-800">
                        Monitoraggio Pacchetti Consulenze
                      </CardTitle>
                      <p className="text-sm text-slate-500">Utilizzo mensile dei pacchetti consulenze limitate</p>
                    </CardHeader>
                    <CardContent className="p-0">
                      {monitoringLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                          <span className="ml-2 text-slate-500">Caricamento...</span>
                        </div>
                      ) : monitoringData.length === 0 ? (
                        <div className="text-center py-16 px-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <BarChart3 className="w-8 h-8 text-slate-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-800 mb-2">Nessun pacchetto limitato</h3>
                          <p className="text-sm text-slate-500">Nessun cliente ha un limite di consulenze mensile configurato</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">Telefono</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Pacchetto</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Utilizzate</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Programmate</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Prossima</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Rimanenti</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Stato</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Azioni</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {monitoringData.map((client: any) => {
                                const usagePct = client.monthlyConsultationLimit > 0
                                  ? (client.consultationsUsedThisMonth / client.monthlyConsultationLimit) * 100
                                  : 0;
                                const remainingPct = client.monthlyConsultationLimit > 0
                                  ? (client.remaining / client.monthlyConsultationLimit) * 100
                                  : 100;

                                const remainingColor = remainingPct > 50
                                  ? 'text-emerald-600'
                                  : remainingPct >= 25
                                    ? 'text-amber-600'
                                    : 'text-red-600';

                                const remainingBg = remainingPct > 50
                                  ? 'bg-emerald-50'
                                  : remainingPct >= 25
                                    ? 'bg-amber-50'
                                    : 'bg-red-50';

                                const statusLabel = client.remaining === 0
                                  ? 'Esaurito'
                                  : remainingPct < 25
                                    ? 'Quasi esaurito'
                                    : 'In linea';

                                const statusIcon = client.remaining === 0
                                  ? <AlertTriangle className="w-3 h-3" />
                                  : remainingPct < 25
                                    ? <Clock className="w-3 h-3" />
                                    : <CheckCircle className="w-3 h-3" />;

                                const statusBadgeClass = client.remaining === 0
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : remainingPct < 25
                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                    : 'bg-emerald-100 text-emerald-700 border-emerald-200';

                                const progressBarColor = remainingPct > 50
                                  ? 'from-cyan-500 to-teal-500'
                                  : remainingPct >= 25
                                    ? 'from-amber-400 to-amber-500'
                                    : 'from-red-400 to-red-500';

                                return (
                                  <tr key={client.id} className="hover:bg-cyan-50/50 transition-colors">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2.5">
                                        <Avatar className="w-8 h-8 flex-shrink-0">
                                          <AvatarFallback className={`${client.role === 'consultant' ? 'bg-gradient-to-br from-violet-400 to-purple-500' : 'bg-gradient-to-br from-cyan-400 to-teal-500'} text-white font-medium text-xs`}>
                                            {client.firstName?.[0]}{client.lastName?.[0]}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                          <span className="font-medium text-sm text-slate-800">
                                            {client.firstName} {client.lastName}
                                          </span>
                                          {client.role === 'consultant' && (
                                            <span className="text-[10px] text-violet-600 font-medium">Consulente</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                      <span className="text-xs text-slate-500">{client.phoneNumber || '—'}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="text-sm font-semibold text-slate-700">{client.monthlyConsultationLimit}/mese</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex flex-col items-center gap-1">
                                        <span className="text-sm font-semibold text-slate-700">{client.consultationsUsedThisMonth}</span>
                                        <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                          <div
                                            className={`bg-gradient-to-r ${progressBarColor} h-1.5 rounded-full transition-all`}
                                            style={{ width: `${Math.min(usagePct, 100)}%` }}
                                          />
                                        </div>
                                        {client.consultations && client.consultations.filter((c: any) => c.status === 'completed').length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {client.consultations.filter((c: any) => c.status === 'completed').map((c: any, i: number) => (
                                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                                                {new Date(c.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {(() => {
                                        const scheduled = client.consultations?.filter((c: any) => c.status === 'scheduled') || [];
                                        return (
                                          <div className="flex flex-col items-center gap-1">
                                            <span className="text-sm font-semibold text-blue-600">{scheduled.length}</span>
                                            {scheduled.length > 0 && (
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {scheduled.map((c: any, i: number) => (
                                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                                    {new Date(c.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {(() => {
                                        const scheduled = client.consultations?.filter((c: any) => c.status === 'scheduled') || [];
                                        const now = new Date();
                                        const upcoming = scheduled
                                          .map((c: any) => new Date(c.date))
                                          .filter((d: Date) => d >= now)
                                          .sort((a: Date, b: Date) => a.getTime() - b.getTime());
                                        const next = upcoming[0];
                                        return next ? (
                                          <span className="text-xs font-medium text-blue-600">
                                            {next.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-slate-400">—</span>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-sm font-bold ${remainingColor} ${remainingBg}`}>
                                        {client.remaining}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <Badge className={`text-xs px-2 py-0.5 ${statusBadgeClass} border`}>
                                        <span className="flex items-center gap-1">
                                          {statusIcon}
                                          {statusLabel}
                                        </span>
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSchedulingClient(client);
                                          setSchedulingStep('overview');
                                          setProposedDates([]);
                                          setSchedulingMonths(3);
                                          setSchedulingIntervalDays(0);
                                          setSchedulingExtraMonths({});
                                          setSchedulingTimePreference('auto');
                                          setDetectedPattern(null);
                                        }}
                                        className="text-xs h-7 px-2 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                                      >
                                        <CalendarPlus className="w-3 h-3 mr-1" />
                                        Programma
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  {/* Scheduling Wizard Dialog */}
                  <Dialog open={!!schedulingClient} onOpenChange={() => { setSchedulingClient(null); setSchedulingStep('overview'); setProposedDates([]); setSchedulingIntervalDays(0); setSchedulingExtraMonths({}); setSchedulingTimePreference('auto'); setDetectedPattern(null); }}>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <CalendarPlus className="w-5 h-5 text-cyan-600" />
                          Programma Consulenze
                        </DialogTitle>
                      </DialogHeader>
                      
                      {schedulingStep === 'overview' && (
                        <div className="space-y-4">
                          <div className="bg-slate-50 rounded-xl p-4">
                            <h3 className="font-semibold text-slate-800">{schedulingClient?.firstName} {schedulingClient?.lastName}</h3>
                            <div className="grid grid-cols-3 gap-3 mt-3">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-slate-800">{schedulingClient?.monthlyConsultationLimit}</p>
                                <p className="text-xs text-slate-500">Pacchetto/mese</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-emerald-600">{schedulingClient?.consultationsUsedThisMonth}</p>
                                <p className="text-xs text-slate-500">Fatte questo mese</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-cyan-600">{schedulingClient?.consultations?.filter((c:any) => c.status === 'scheduled').length || 0}</p>
                                <p className="text-xs text-slate-500">Programmate</p>
                              </div>
                            </div>
                          </div>

                          {schedulingClient?.consultations?.filter((c: any) => c.status === 'scheduled').length > 0 && (
                            <div className="bg-blue-50 rounded-xl p-3">
                              <p className="text-xs font-medium text-blue-700 mb-2">Consulenze già programmate:</p>
                              <div className="flex flex-wrap gap-1">
                                {schedulingClient.consultations.filter((c: any) => c.status === 'scheduled').map((c: any, i: number) => (
                                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                    {new Date(c.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <label className="text-sm font-medium text-slate-700">Per quanti mesi vuoi programmare?</label>
                            <select 
                              value={schedulingMonths}
                              onChange={(e) => setSchedulingMonths(parseInt(e.target.value))}
                              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                            >
                              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'mese' : 'mesi'}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-slate-700">Frequenza consulenze</label>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {[
                                { value: 0, label: 'Da pacchetto' },
                                { value: 10, label: 'Ogni 10 giorni' },
                                { value: 15, label: 'Ogni 15 giorni' },
                                { value: 20, label: 'Ogni 20 giorni' },
                                { value: 25, label: 'Ogni 25 giorni' },
                                { value: 30, label: 'Ogni 30 giorni' },
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => setSchedulingIntervalDays(opt.value)}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                                    schedulingIntervalDays === opt.value
                                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-300 hover:text-cyan-700'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-slate-700">Preferenza orario</label>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {[
                                { value: 'auto' as const, label: 'Automatico', desc: 'Basato sullo storico' },
                                { value: 'morning' as const, label: 'Mattina', desc: '9:00 - 12:00' },
                                { value: 'afternoon' as const, label: 'Pomeriggio', desc: '14:00 - 17:00' },
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => setSchedulingTimePreference(opt.value)}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                                    schedulingTimePreference === opt.value
                                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-300 hover:text-cyan-700'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-slate-700">Consulenze extra per mese</label>
                            <div className="mt-2 space-y-1.5">
                              {Array.from({ length: schedulingMonths }, (_, i) => {
                                const d = new Date();
                                d.setMonth(d.getMonth() + i);
                                const monthLabel = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
                                const extraCount = schedulingExtraMonths[i] || 0;
                                return (
                                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                                    <span className="text-sm text-slate-700 capitalize">{monthLabel}</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setSchedulingExtraMonths(prev => ({ ...prev, [i]: Math.max(0, extraCount - 1) }))}
                                        disabled={extraCount <= 0}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-xs font-bold"
                                      >
                                        −
                                      </button>
                                      <span className="text-sm font-semibold text-slate-800 w-4 text-center">{extraCount}</span>
                                      <button
                                        onClick={() => setSchedulingExtraMonths(prev => ({ ...prev, [i]: Math.min(5, extraCount + 1) }))}
                                        disabled={extraCount >= 5}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-xs font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          <Button 
                            onClick={handleGenerateProposal}
                            disabled={isGeneratingProposal}
                            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                          >
                            {isGeneratingProposal ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generazione...</> : 'Genera Proposta'}
                          </Button>
                        </div>
                      )}

                      {schedulingStep === 'proposal' && (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-600">Modifica le date proposte, poi procedi alla conferma.</p>
                          {detectedPattern && detectedPattern.totalPastConsultations > 0 && (
                            <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                              <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <div className="text-xs text-amber-800">
                                <span className="font-semibold">Pattern rilevato:</span>{' '}
                                {detectedPattern.totalPastConsultations} consulenze passate
                                {detectedPattern.dayName && <>, di solito il <strong>{detectedPattern.dayName}</strong></>}
                                {detectedPattern.time && <> alle <strong>{detectedPattern.time}</strong></>}
                                {detectedPattern.calendarChecked && <> · <span className="text-emerald-700">Calendario verificato</span></>}
                              </div>
                            </div>
                          )}
                          <div className="max-h-[400px] overflow-y-auto space-y-3">
                            {(() => {
                              const grouped = proposedDates.reduce((acc: Record<string, Array<{date: string, time: string, month: string, idx: number}>>, d, idx) => {
                                if (!acc[d.month]) acc[d.month] = [];
                                acc[d.month].push({ ...d, idx });
                                return acc;
                              }, {});
                              return Object.entries(grouped).map(([month, dates]) => (
                                <div key={month} className="bg-slate-50 rounded-xl p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-slate-700 capitalize">{month}</h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const newDate = dates[dates.length - 1];
                                        const nextDay = new Date(newDate.date);
                                        nextDay.setDate(nextDay.getDate() + 7);
                                        while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
                                          nextDay.setDate(nextDay.getDate() + 1);
                                        }
                                        setProposedDates(prev => [...prev, {
                                          date: nextDay.toISOString().split('T')[0],
                                          time: '10:00',
                                          month
                                        }]);
                                      }}
                                      className="h-6 text-xs text-cyan-600 hover:text-cyan-700"
                                    >
                                      <PlusIcon className="w-3 h-3 mr-1" />
                                      Aggiungi
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    {dates.map((d) => (
                                      <div key={d.idx} className="flex items-center gap-2">
                                        <input
                                          type="date"
                                          value={d.date}
                                          onChange={(e) => {
                                            setProposedDates(prev => prev.map((p, i) => i === d.idx ? { ...p, date: e.target.value } : p));
                                          }}
                                          className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded-lg"
                                        />
                                        <input
                                          type="time"
                                          value={d.time}
                                          onChange={(e) => {
                                            setProposedDates(prev => prev.map((p, i) => i === d.idx ? { ...p, time: e.target.value } : p));
                                          }}
                                          className="w-24 px-2 py-1 text-sm border border-slate-200 rounded-lg"
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setProposedDates(prev => prev.filter((_, i) => i !== d.idx));
                                          }}
                                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                        >
                                          <X className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setSchedulingStep('overview')}
                              className="flex-1"
                            >
                              Indietro
                            </Button>
                            <Button
                              onClick={() => setSchedulingStep('review')}
                              disabled={proposedDates.length === 0}
                              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
                            >
                              Rivedi ({proposedDates.length} consulenze)
                            </Button>
                          </div>
                        </div>
                      )}

                      {schedulingStep === 'review' && (
                        <div className="space-y-4">
                          <div className="bg-slate-50 rounded-xl p-4">
                            <h4 className="font-semibold text-slate-800 mb-2">Riepilogo</h4>
                            <p className="text-sm text-slate-600">
                              Stai per creare <strong>{proposedDates.length} consulenze</strong> per {schedulingClient?.firstName} {schedulingClient?.lastName}
                            </p>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto space-y-1">
                            {proposedDates.map((d, i) => (
                              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-slate-100">
                                <CalendarDays className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                                <span className="text-sm text-slate-700">
                                  {new Date(d.date).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                </span>
                                <span className="text-sm font-medium text-slate-800">{d.time}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setSchedulingStep('proposal')}
                              className="flex-1"
                            >
                              Modifica
                            </Button>
                            <Button
                              onClick={handleCreateConsultations}
                              disabled={isCreatingConsultations}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {isCreatingConsultations ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creazione...</>
                              ) : (
                                <>Conferma e Crea</>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })()
          ) : (
          /* Existing Client List Content */
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
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-9 bg-white/80 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => handleStatusFilterChange(e.target.value as any)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      <option value="all">Tutti i clienti</option>
                      <option value="active">Solo attivi</option>
                      <option value="inactive">Solo inattivi</option>
                    </select>
                    <Button 
                      onClick={() => setIsNewClientDialogOpen(true)}
                      className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
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
            
            <CardContent className="p-0">
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
                    <Button variant="outline" onClick={() => handleSearchChange("")}>
                      Rimuovi filtri
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Compact Enterprise Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="w-10 px-3 py-3">
                            <Checkbox 
                              checked={selectedClients.size === sortedAndPaginatedClients.length && sortedAndPaginatedClients.length > 0}
                              ref={(ref) => {
                                if (ref) {
                                  const isPartial = selectedClients.size > 0 && selectedClients.size < sortedAndPaginatedClients.length;
                                  (ref as any).indeterminate = isPartial;
                                }
                              }}
                              onCheckedChange={(checked) => handleSelectAll(!!checked)}
                              className="border-slate-300"
                            />
                          </th>
                          <th className="w-10 px-2 py-3"></th>
                          <th 
                            className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center gap-1">
                              Cliente
                              <SortIcon column="name" />
                            </div>
                          </th>
                          <th 
                            className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors hidden md:table-cell"
                            onClick={() => handleSort('email')}
                          >
                            <div className="flex items-center gap-1">
                              Email
                              <SortIcon column="email" />
                            </div>
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">
                            Telefono
                          </th>
                          <th 
                            className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors hidden lg:table-cell"
                            onClick={() => handleSort('date')}
                          >
                            <div className="flex items-center gap-1">
                              Data
                              <SortIcon column="date" />
                            </div>
                          </th>
                          <th 
                            className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => handleSort('exercises')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              Esercizi
                              <SortIcon column="exercises" />
                            </div>
                          </th>
                          <th 
                            className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => handleSort('progress')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              Progresso
                              <SortIcon column="progress" />
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">
                            Limite/mese
                          </th>
                          <th className="w-24 px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Azioni
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedAndPaginatedClients.map((client: any) => (
                          <tr 
                            key={client.id}
                            className="hover:bg-cyan-50/50 transition-colors group"
                          >
                            <td className="px-3 py-2.5">
                              <Checkbox 
                                checked={selectedClients.has(client.id)}
                                onCheckedChange={(checked) => handleSelectClient(client.id, !!checked)}
                                className="border-slate-300"
                              />
                            </td>
                            <td className="px-2 py-2.5">
                              <div className={`w-2 h-2 rounded-full ${client.isActive !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} 
                                   title={client.isActive !== false ? 'Attivo' : 'Inattivo'} />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-7 h-7 flex-shrink-0">
                                  <AvatarImage src={client.avatar} />
                                  <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-teal-500 text-white font-medium text-[10px]">
                                    {client.firstName?.[0]}{client.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm text-slate-800 truncate">
                                      {client.firstName} {client.lastName}
                                    </span>
                                    {client.role === 'consultant' && (
                                      <Badge className="text-[9px] px-1 py-0 bg-violet-100 text-violet-700 border-violet-200 flex-shrink-0">
                                        <UserCog className="w-2 h-2 mr-0.5" />
                                        C
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 hidden md:table-cell">
                              <span className="text-xs text-slate-600 truncate max-w-[180px] block">{client.email}</span>
                            </td>
                            <td className="px-3 py-2.5 hidden lg:table-cell">
                              <span className="text-xs text-slate-500">{client.phoneNumber || '—'}</span>
                            </td>
                            <td className="px-3 py-2.5 hidden lg:table-cell">
                              <span className="text-xs text-slate-500">
                                {client.createdAt ? new Date(client.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="text-xs font-medium text-slate-700">
                                {client._completedCount}/{client._assignmentsCount}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                  <div 
                                    className="bg-gradient-to-r from-cyan-500 to-teal-500 h-1.5 rounded-full transition-all" 
                                    style={{ width: `${client._completionRate}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-slate-700 w-8 text-right">{client._completionRate}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                              <span className={`text-xs font-medium ${client.monthlyConsultationLimit ? 'text-amber-600' : 'text-slate-400'}`}>
                                {client.monthlyConsultationLimit ? `${client.monthlyConsultationLimit}/mese` : 'Illimitato'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                        description: `${client.firstName} ${client.lastName} è stato ${checked ? 'attivato' : 'disattivato'}.`,
                                      });
                                    } catch (error) {
                                      console.error('Error updating client status:', error);
                                      toast({
                                        title: "Errore",
                                        description: "Impossibile aggiornare lo stato.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  className="scale-75"
                                />
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  title="Modifica"
                                  onClick={() => handleEditClient(client)}
                                  className="h-7 w-7 p-0 hover:bg-cyan-100 hover:text-cyan-600"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-7 w-7 p-0 hover:bg-slate-100"
                                    >
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-52">
                                    {client.role === 'consultant' ? (
                                      <DropdownMenuItem 
                                        onClick={() => removeConsultantProfileMutation.mutate(client.id)}
                                        disabled={removeConsultantProfileMutation.isPending}
                                        className="text-orange-600 focus:text-orange-700"
                                      >
                                        <UserMinus className="w-4 h-4 mr-2" />
                                        Rimuovi consulente
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem 
                                        onClick={() => addConsultantProfileMutation.mutate(client.id)}
                                        disabled={addConsultantProfileMutation.isPending}
                                        className="text-violet-600 focus:text-violet-700"
                                      >
                                        <UserCog className="w-4 h-4 mr-2" />
                                        Abilita consulente
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span>Mostra</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-1 text-sm border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <span>per pagina</span>
                      <span className="text-slate-400 mx-2">|</span>
                      <span className="font-medium">
                        {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredClients.length)} di {filteredClients.length}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      
                      <div className="flex items-center gap-1 mx-2">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`h-8 w-8 p-0 ${currentPage === pageNum ? 'bg-cyan-600 hover:bg-cyan-700' : ''}`}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      {/* New Client Dialog */}
      <Dialog open={isNewClientDialogOpen} onOpenChange={setIsNewClientDialogOpen}>
        <DialogContent className="max-w-md bg-white/95 backdrop-blur-sm border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className={`p-2 rounded-lg ${newClientForm.isEmployee ? 'bg-violet-100' : 'bg-emerald-100'}`}>
                {newClientForm.isEmployee ? (
                  <Briefcase className="h-5 w-5 text-violet-600" />
                ) : (
                  <UserPlus className="h-5 w-5 text-emerald-600" />
                )}
              </div>
              {newClientForm.isEmployee ? 'Nuovo Dipendente' : 'Nuovo Cliente'}
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              {newClientForm.isEmployee 
                ? 'Aggiungi un collaboratore o dipendente al tuo team' 
                : 'Crea un nuovo account cliente associato al tuo profilo consulente'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className={cn(
              "rounded-xl p-3 border text-sm",
              (licenseData.employeeUsed >= licenseData.employeeTotal)
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            )}>
              {licenseData.employeeUsed >= licenseData.employeeTotal ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Hai raggiunto il limite di <strong>{licenseData.employeeTotal}</strong> licenze. Acquista un pacchetto aggiuntivo dalla sezione licenze.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>Licenze disponibili: <strong>{licenseData.employeeTotal - licenseData.employeeUsed}</strong> su {licenseData.employeeTotal} totali</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newFirstName" className="text-right text-sm font-medium">
                Nome *
              </Label>
              <Input
                id="newFirstName"
                value={newClientForm.firstName}
                onChange={(e) => setNewClientForm(prev => ({...prev, firstName: e.target.value}))}
                className="col-span-3 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
                placeholder="Minimo 6 caratteri"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-sm font-medium">
                Tipo
              </Label>
              <div className="col-span-3 flex gap-4">
                <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${!newClientForm.isEmployee ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input
                    type="radio"
                    name="userType"
                    checked={!newClientForm.isEmployee}
                    onChange={() => setNewClientForm(prev => ({...prev, isEmployee: false}))}
                    className="sr-only"
                  />
                  <Users className="h-4 w-4 text-emerald-600" />
                  <div>
                    <span className="text-sm font-medium">Cliente</span>
                    <span className="text-xs text-muted-foreground block mt-0.5">Accede come utente</span>
                  </div>
                </label>
                <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${newClientForm.isEmployee ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input
                    type="radio"
                    name="userType"
                    checked={newClientForm.isEmployee}
                    onChange={() => setNewClientForm(prev => ({...prev, isEmployee: true}))}
                    className="sr-only"
                  />
                  <Briefcase className="h-4 w-4 text-violet-600" />
                  <div>
                    <span className="text-sm font-medium">Dipendente</span>
                    <span className="text-xs text-muted-foreground block mt-0.5">Membro del team</span>
                  </div>
                </label>
              </div>
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
              disabled={createClientMutation.isPending || (licenseData.employeeUsed >= licenseData.employeeTotal)}
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
                  {newClientForm.isEmployee ? "Crea Dipendente" : "Crea Cliente"}
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
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Edit className="h-5 w-5 text-cyan-600" />
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
                className="col-span-3 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
                placeholder="username"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="monthlyLimit" className="text-right text-sm font-medium">
                <div className="flex flex-col">
                  <span>Limite/mese</span>
                  <span className="text-xs text-slate-400 font-normal">consulenze</span>
                </div>
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="monthlyLimit"
                  type="number"
                  min="0"
                  value={editForm.monthlyConsultationLimit ?? ''}
                  onChange={(e) => setEditForm(prev => ({
                    ...prev, 
                    monthlyConsultationLimit: e.target.value === '' ? null : parseInt(e.target.value)
                  }))}
                  className="w-24 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
                  placeholder="0"
                />
                <span className="text-xs text-slate-500">
                  {editForm.monthlyConsultationLimit === null ? 'Illimitato' : `Max ${editForm.monthlyConsultationLimit}/mese`}
                </span>
              </div>
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
                        className="flex-1 border-slate-200 focus:border-cyan-400 focus:ring-cyan-400"
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
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
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
