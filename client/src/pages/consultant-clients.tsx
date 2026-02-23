
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
  Plus as PlusIcon,
  Building2,
  FolderTree,
  Palette,
  Trash2 as TrashIcon
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
  const [typeFilter, setTypeFilter] = useState<"all" | "clients" | "employees">("all");
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    isEmployee: false,
    departmentId: ''
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    username: '',
    geminiApiKeys: [] as string[],
    monthlyConsultationLimit: null as number | null,
    departmentId: '' as string,
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
  
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [departmentForm, setDepartmentForm] = useState({ name: '', color: '#6366f1', description: '' });
  const DEPARTMENT_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];
  
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

  const departmentsQuery = useQuery({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch departments");
      const data = await res.json();
      return data.data || [];
    },
  });
  const departments: any[] = departmentsQuery.data || [];

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; description: string }) => {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Errore nella creazione del reparto');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reparto creato", description: "Il nuovo reparto è stato creato con successo" });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsDepartmentDialogOpen(false);
      setDepartmentForm({ name: '', color: '#6366f1', description: '' });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; color: string; description: string } }) => {
      const res = await fetch(`/api/departments/${id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Errore nell\'aggiornamento del reparto');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reparto aggiornato", description: "Il reparto è stato aggiornato con successo" });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsDepartmentDialogOpen(false);
      setEditingDepartment(null);
      setDepartmentForm({ name: '', color: '#6366f1', description: '' });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/departments/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Errore nell\'eliminazione del reparto');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reparto eliminato", description: "Il reparto è stato eliminato" });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  const assignDepartmentMutation = useMutation({
    mutationFn: async ({ clientId, departmentId }: { clientId: string; departmentId: string | null }) => {
      const res = await fetch(`/api/clients/${clientId}/department`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId })
      });
      if (!res.ok) throw new Error('Errore nell\'assegnazione del reparto');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reparto assegnato", description: "Il dipendente è stato assegnato al reparto" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  const handleSaveDepartment = () => {
    if (!departmentForm.name.trim()) {
      toast({ title: "Nome obbligatorio", description: "Inserisci il nome del reparto", variant: "destructive" });
      return;
    }
    if (editingDepartment) {
      updateDepartmentMutation.mutate({ id: editingDepartment.id, data: departmentForm });
    } else {
      createDepartmentMutation.mutate(departmentForm);
    }
  };

  const handleEditDepartment = (dept: any) => {
    setEditingDepartment(dept);
    setDepartmentForm({ name: dept.name, color: dept.color, description: dept.description || '' });
    setIsDepartmentDialogOpen(true);
  };

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
      setNewClientForm({ firstName: '', lastName: '', email: '', password: '', isEmployee: false, departmentId: '' });
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
      monthlyConsultationLimit: client.monthlyConsultationLimit ?? null,
      departmentId: client.departmentId || '',
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
      const { departmentId: editDeptId, ...restEditForm } = editForm;
      const updateData = {
        ...restEditForm,
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

      if (editingClient.isEmployee && editDeptId !== (editingClient.departmentId || '')) {
        try {
          await fetch(`/api/clients/${editingClient.id}/department`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ departmentId: editDeptId || null })
          });
        } catch (deptErr) {
          console.error('Error updating department:', deptErr);
        }
      }

      toast({
        title: "Successo",
        description: "Dati cliente aggiornati con successo",
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
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
    
    const clientIsActive = client.isActive !== false;
    
    const matchesStatus = 
      statusFilter === "all" ? true :
      statusFilter === "active" ? clientIsActive :
      !clientIsActive;

    const matchesType =
      typeFilter === "all" ? true :
      typeFilter === "employees" ? !!client.isEmployee :
      !client.isEmployee;
    
    return matchesSearch && matchesStatus && matchesType;
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
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto">
            <Activity className="h-8 w-8 animate-spin text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Caricamento in corso</h3>
            <p className="text-muted-foreground">Stiamo recuperando i dati dei tuoi clienti...</p>
          </div>
        </div>
      </div>
    );
  }

  if (clientsError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto">
            <Users className="h-10 w-10 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Errore nel caricamento</h1>
            <p className="text-muted-foreground mb-4">
              Impossibile caricare i dati dei clienti. Riprova più tardi.
            </p>
            <p className="text-sm text-muted-foreground">{clientsError.message}</p>
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
    <div className={cn("min-h-screen flex flex-col bg-background", !isMobile && "h-screen")}>
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={cn("flex flex-1", isMobile ? "min-h-0" : "min-h-0 overflow-hidden")}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />

        <div className={cn("flex-1 p-4 sm:p-5 md:p-6", isMobile ? "overflow-y-auto" : "overflow-y-auto")}>
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
                      <p className="text-white/60 text-xs sm:text-sm md:text-base lg:text-lg hidden sm:block">Dashboard completa per la gestione dei tuoi clienti</p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 text-center border border-white/10">
                    <div className="text-3xl font-bold">{clients.length}</div>
                    <div className="text-sm text-white/60">Clienti Totali</div>
                  </div>
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 text-center border border-white/10">
                    <div className="text-3xl font-bold">{activeClientsCount}</div>
                    <div className="text-sm text-white/60">Attivi</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
            <Card className="border border-border shadow-sm bg-card">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-cyan-700">Clienti Totali</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">{clients.length}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Tutti i clienti registrati</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Users className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-emerald-700">Nuovi Clienti</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">{newClientsCount}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Ultimo mese</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <UserPlus className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-amber-700">Clienti Attivi</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">{activeClientsCount}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Con esercizi in corso</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Zap className="text-white" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-teal-700">Progresso Medio</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                      {assignments.length > 0 ? 
                        Math.round((assignments.filter((a: any) => a.status === 'completed').length / assignments.length) * 100) 
                        : 0}%
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Esercizi completati</p>
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
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                activeTab === 'clienti'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-card text-muted-foreground hover:bg-muted border border-border'
              }`}
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span className="sm:hidden">Clienti</span>
              <span className="hidden sm:inline">Elenco Clienti</span>
            </button>
            <button
              onClick={() => setActiveTab('monitoraggio')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                activeTab === 'monitoraggio'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-card text-muted-foreground hover:bg-muted border border-border'
              }`}
            >
              <BarChart3 className="w-4 h-4 flex-shrink-0" />
              <span className="sm:hidden">Monitoraggio</span>
              <span className="hidden sm:inline">Monitoraggio Consulenze</span>
            </button>
          </div>

          {activeTab === 'clienti' && departments.length > 0 && (
            <Card className="border-0 shadow-xl bg-card mb-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-foreground">Struttura Aziendale</CardTitle>
                      <p className="text-xs text-muted-foreground">Organizza i dipendenti per reparto</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingDepartment(null);
                      setDepartmentForm({ name: '', color: '#6366f1', description: '' });
                      setIsDepartmentDialogOpen(true);
                    }}
                    size="sm"
                    className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
                  >
                    <PlusIcon className="w-4 h-4 mr-1" />
                    Nuovo Reparto
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {departments.map((dept: any) => {
                    const deptEmployees = clients.filter((c: any) => c.isEmployee && c.departmentId === dept.id);
                    return (
                      <div
                        key={dept.id}
                        className="rounded-xl border border-border bg-card overflow-hidden"
                        style={{ borderLeftWidth: '4px', borderLeftColor: dept.color }}
                      >
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: dept.color }}
                              />
                              <span className="font-semibold text-sm text-foreground">{dept.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {dept.employee_count || deptEmployees.length} dipendenti
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDepartment(dept)}
                                className="h-6 w-6 p-0 hover:bg-muted"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Eliminare questo reparto?')) {
                                    deleteDepartmentMutation.mutate(dept.id);
                                  }
                                }}
                                className="h-6 w-6 p-0 hover:bg-red-50 text-red-400 hover:text-red-600"
                              >
                                <TrashIcon className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          {dept.description && (
                            <p className="text-[11px] text-muted-foreground mb-2">{dept.description}</p>
                          )}
                          {deptEmployees.length > 0 && (
                            <div className="space-y-1">
                              {deptEmployees.slice(0, 5).map((emp: any) => (
                                <div key={emp.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                                  {emp.firstName} {emp.lastName}
                                </div>
                              ))}
                              {deptEmployees.length > 5 && (
                                <span className="text-[10px] text-muted-foreground">+{deptEmployees.length - 5} altri</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const unassigned = clients.filter((c: any) => c.isEmployee && !c.departmentId);
                    if (unassigned.length === 0) return null;
                    return (
                      <div className="rounded-xl border border-dashed border-border bg-muted/40 overflow-hidden" style={{ borderLeftWidth: '4px', borderLeftColor: '#94a3b8' }}>
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full flex-shrink-0 bg-muted-foreground/60" />
                              <span className="font-semibold text-sm text-muted-foreground">Non assegnati</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {unassigned.length} dipendenti
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            {unassigned.slice(0, 5).map((emp: any) => (
                              <div key={emp.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                                {emp.firstName} {emp.lastName}
                              </div>
                            ))}
                            {unassigned.length > 5 && (
                              <span className="text-[10px] text-muted-foreground">+{unassigned.length - 5} altri</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'clienti' && departments.length === 0 && (
            <Card className="border border-dashed border-indigo-200 bg-indigo-50/30 mb-4">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-xl">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Organizza il tuo team con i Reparti</p>
                    <p className="text-xs text-muted-foreground">Crea reparti per raggruppare i dipendenti e gestire i documenti AI in modo mirato</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setEditingDepartment(null);
                    setDepartmentForm({ name: '', color: '#6366f1', description: '' });
                    setIsDepartmentDialogOpen(true);
                  }}
                  size="sm"
                  className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shrink-0"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Crea Primo Reparto
                </Button>
              </CardContent>
            </Card>
          )}

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
                    <Card className="border border-border shadow-sm bg-card">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                          <Users className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Clienti monitorati</p>
                          <p className="text-xl font-bold text-foreground">{totalMonitored}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border border-border shadow-sm bg-card">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Utilizzo medio</p>
                          <p className="text-xl font-bold text-foreground">{avgUsage}%</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border border-border shadow-sm bg-card">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Clienti a rischio</p>
                          <p className="text-xl font-bold text-foreground">{atRiskCount}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Monitoring Table */}
                  <Card className="border border-border shadow-sm bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-bold text-foreground">
                        Monitoraggio Pacchetti Consulenze
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">Utilizzo mensile dei pacchetti consulenze limitate</p>
                    </CardHeader>
                    <CardContent className="p-0">
                      {monitoringLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                          <span className="ml-2 text-muted-foreground">Caricamento...</span>
                        </div>
                      ) : monitoringData.length === 0 ? (
                        <div className="text-center py-16 px-4">
                          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <BarChart3 className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold text-foreground mb-2">Nessun pacchetto limitato</h3>
                          <p className="text-sm text-muted-foreground">Nessun cliente ha un limite di consulenze mensile configurato</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-muted/40 border-b border-border">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Telefono</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pacchetto</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Utilizzate</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Programmate</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prossima</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rimanenti</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stato</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Azioni</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
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
                                          <span className="font-medium text-sm text-foreground">
                                            {client.firstName} {client.lastName}
                                          </span>
                                          {client.role === 'consultant' && (
                                            <span className="text-[10px] text-violet-600 font-medium">Consulente</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                      <span className="text-xs text-muted-foreground">{client.phoneNumber || '—'}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="text-sm font-semibold text-foreground">{client.monthlyConsultationLimit}/mese</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex flex-col items-center gap-1">
                                        <span className="text-sm font-semibold text-foreground">{client.consultationsUsedThisMonth}</span>
                                        <div className="w-20 bg-muted rounded-full h-1.5">
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
                                          <span className="text-xs text-muted-foreground">—</span>
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
                          <div className="bg-muted/40 rounded-xl p-4">
                            <h3 className="font-semibold text-foreground">{schedulingClient?.firstName} {schedulingClient?.lastName}</h3>
                            <div className="grid grid-cols-3 gap-3 mt-3">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-foreground">{schedulingClient?.monthlyConsultationLimit}</p>
                                <p className="text-xs text-muted-foreground">Pacchetto/mese</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-emerald-600">{schedulingClient?.consultationsUsedThisMonth}</p>
                                <p className="text-xs text-muted-foreground">Fatte questo mese</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-cyan-600">{schedulingClient?.consultations?.filter((c:any) => c.status === 'scheduled').length || 0}</p>
                                <p className="text-xs text-muted-foreground">Programmate</p>
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
                            <label className="text-sm font-medium text-foreground">Per quanti mesi vuoi programmare?</label>
                            <select 
                              value={schedulingMonths}
                              onChange={(e) => setSchedulingMonths(parseInt(e.target.value))}
                              className="mt-1 w-full px-3 py-2 border border-border rounded-xl text-sm"
                            >
                              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'mese' : 'mesi'}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-foreground">Frequenza consulenze</label>
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
                                      : 'bg-card text-muted-foreground border-border hover:border-cyan-300 hover:text-cyan-700'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-foreground">Preferenza orario</label>
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
                                      : 'bg-card text-muted-foreground border-border hover:border-cyan-300 hover:text-cyan-700'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-foreground">Consulenze extra per mese</label>
                            <div className="mt-2 space-y-1.5">
                              {Array.from({ length: schedulingMonths }, (_, i) => {
                                const d = new Date();
                                d.setMonth(d.getMonth() + i);
                                const monthLabel = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
                                const extraCount = schedulingExtraMonths[i] || 0;
                                return (
                                  <div key={i} className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2">
                                    <span className="text-sm text-foreground capitalize">{monthLabel}</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setSchedulingExtraMonths(prev => ({ ...prev, [i]: Math.max(0, extraCount - 1) }))}
                                        disabled={extraCount <= 0}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 text-xs font-bold"
                                      >
                                        −
                                      </button>
                                      <span className="text-sm font-semibold text-foreground w-4 text-center">{extraCount}</span>
                                      <button
                                        onClick={() => setSchedulingExtraMonths(prev => ({ ...prev, [i]: Math.min(5, extraCount + 1) }))}
                                        disabled={extraCount >= 5}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 text-xs font-bold"
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
                          <p className="text-sm text-muted-foreground">Modifica le date proposte, poi procedi alla conferma.</p>
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
                                <div key={month} className="bg-muted/40 rounded-xl p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-foreground capitalize">{month}</h4>
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
                                          className="flex-1 px-2 py-1 text-sm border border-border rounded-lg"
                                        />
                                        <input
                                          type="time"
                                          value={d.time}
                                          onChange={(e) => {
                                            setProposedDates(prev => prev.map((p, i) => i === d.idx ? { ...p, time: e.target.value } : p));
                                          }}
                                          className="w-24 px-2 py-1 text-sm border border-border rounded-lg"
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
                          <div className="bg-muted/40 rounded-xl p-4">
                            <h4 className="font-semibold text-foreground mb-2">Riepilogo</h4>
                            <p className="text-sm text-muted-foreground">
                              Stai per creare <strong>{proposedDates.length} consulenze</strong> per {schedulingClient?.firstName} {schedulingClient?.lastName}
                            </p>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto space-y-1">
                            {proposedDates.map((d, i) => (
                              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-card rounded-lg border border-border/60">
                                <CalendarDays className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                                <span className="text-sm text-foreground">
                                  {new Date(d.date).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                </span>
                                <span className="text-sm font-medium text-foreground">{d.time}</span>
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
          <Card className="border-0 shadow-xl bg-card">
            <CardHeader className="pb-4 px-4 sm:px-6 pt-4 sm:pt-5">
              <div className="hidden sm:block mb-3">
                <CardTitle className="text-xl font-bold text-foreground mb-0.5">Elenco Clienti</CardTitle>
                <p className="text-sm text-muted-foreground">Gestisci e monitora tutti i tuoi clienti</p>
              </div>
              <div className="flex flex-col gap-2.5">
                {/* Row 1: Search + Nuovo (always together) */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Cerca clienti..."
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-9 bg-card border-border focus:border-cyan-400 focus:ring-cyan-400 h-10"
                    />
                  </div>
                  <Button
                    onClick={() => setIsNewClientDialogOpen(true)}
                    className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white flex-shrink-0 h-10 px-3"
                    size="sm"
                  >
                    <UserPlus className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Nuovo</span>
                  </Button>
                  <Button variant="outline" size="sm" className="border-border hover:bg-muted/40 hidden sm:flex h-10">
                    <Download className="w-4 h-4 mr-2" />
                    Esporta
                  </Button>
                </div>
                {/* Row 2: Type filter + Status filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
                    {([
                      { value: 'all', label: 'Tutti', count: clients.length },
                      { value: 'clients', label: 'Clienti', count: clients.filter((c: any) => !c.isEmployee).length },
                      { value: 'employees', label: 'Dip.', count: clients.filter((c: any) => c.isEmployee).length },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setTypeFilter(opt.value); setCurrentPage(1); }}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                          typeFilter === opt.value
                            ? opt.value === 'employees'
                              ? 'bg-violet-600 text-white shadow-sm'
                              : opt.value === 'clients'
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'bg-foreground text-background shadow-sm'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {opt.label} ({opt.count})
                      </button>
                    ))}
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilterChange(e.target.value as any)}
                    className="px-3 py-1.5 text-sm border border-border rounded-md bg-card hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option value="all">Tutti</option>
                    <option value="active">Attivi</option>
                    <option value="inactive">Inattivi</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              {filteredClients.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Users size={40} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {searchTerm ? "Nessun risultato" : "Nessun cliente registrato"}
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
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
                  {/* Mobile Card List — visible only on small screens */}
                  <div className="sm:hidden divide-y divide-border/40">
                    {sortedAndPaginatedClients.map((client: any) => (
                      <div
                        key={client.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${client.isActive !== false ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                        <Avatar className="w-9 h-9 flex-shrink-0">
                          <AvatarImage src={client.avatar} />
                          <AvatarFallback className={`${client.isEmployee ? 'bg-gradient-to-br from-violet-400 to-purple-500' : 'bg-gradient-to-br from-cyan-400 to-teal-500'} text-white font-medium text-[10px]`}>
                            {client.firstName?.[0]}{client.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {client.firstName} {client.lastName}
                            </span>
                            {client.isEmployee && (
                              <Badge className="text-[9px] px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200 flex-shrink-0">
                                Dip.
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{client._completedCount}/{client._assignmentsCount} esercizi</span>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <div className="flex-1 bg-muted rounded-full h-1.5 max-w-[48px]">
                                <div
                                  className="bg-gradient-to-r from-cyan-500 to-teal-500 h-1.5 rounded-full"
                                  style={{ width: `${client._completionRate}%` }}
                                />
                              </div>
                              <span className="font-medium text-foreground">{client._completionRate}%</span>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 text-muted-foreground">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => handleEditClient(client)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const checked = client.isActive === false;
                                try {
                                  await fetch(`/api/users/${client.id}`, {
                                    method: 'PATCH',
                                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ isActive: checked }),
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
                                } catch {}
                              }}
                            >
                              {client.isActive !== false ? 'Disattiva' : 'Attiva'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {client.role === 'consultant' ? (
                              <DropdownMenuItem
                                onClick={() => removeConsultantProfileMutation.mutate(client.id)}
                                className="text-orange-600 focus:text-orange-700"
                              >
                                <UserMinus className="w-4 h-4 mr-2" />
                                Rimuovi consulente
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => addConsultantProfileMutation.mutate(client.id)}
                                className="text-violet-600 focus:text-violet-700"
                              >
                                <UserCog className="w-4 h-4 mr-2" />
                                Abilita consulente
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table — hidden on mobile */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/40 border-b border-border">
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
                              className="border-border"
                            />
                          </th>
                          <th className="w-10 px-2 py-3"></th>
                          <th 
                            className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center gap-1">
                              Cliente
                              <SortIcon column="name" />
                            </div>
                          </th>
                          <th 
                            className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors hidden md:table-cell"
                            onClick={() => handleSort('email')}
                          >
                            <div className="flex items-center gap-1">
                              Email
                              <SortIcon column="email" />
                            </div>
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                            Telefono
                          </th>
                          <th 
                            className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors hidden lg:table-cell"
                            onClick={() => handleSort('date')}
                          >
                            <div className="flex items-center gap-1">
                              Data
                              <SortIcon column="date" />
                            </div>
                          </th>
                          <th 
                            className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => handleSort('exercises')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              Esercizi
                              <SortIcon column="exercises" />
                            </div>
                          </th>
                          <th 
                            className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => handleSort('progress')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              Progresso
                              <SortIcon column="progress" />
                            </div>
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                            Reparto
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                            Limite/mese
                          </th>
                          <th className="w-24 px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Azioni
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {sortedAndPaginatedClients.map((client: any) => (
                          <tr 
                            key={client.id}
                            className={`transition-colors group ${client.isEmployee ? 'hover:bg-violet-50/50 border-l-2 border-l-violet-300' : 'hover:bg-cyan-50/50 border-l-2 border-l-cyan-300'}`}
                          >
                            <td className="px-3 py-2.5">
                              <Checkbox 
                                checked={selectedClients.has(client.id)}
                                onCheckedChange={(checked) => handleSelectClient(client.id, !!checked)}
                                className="border-border"
                              />
                            </td>
                            <td className="px-2 py-2.5">
                              <div className={`w-2 h-2 rounded-full ${client.isActive !== false ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} 
                                   title={client.isActive !== false ? 'Attivo' : 'Inattivo'} />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-7 h-7 flex-shrink-0">
                                  <AvatarImage src={client.avatar} />
                                  <AvatarFallback className={`${client.isEmployee ? 'bg-gradient-to-br from-violet-400 to-purple-500' : 'bg-gradient-to-br from-cyan-400 to-teal-500'} text-white font-medium text-[10px]`}>
                                    {client.firstName?.[0]}{client.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm text-foreground truncate">
                                      {client.firstName} {client.lastName}
                                    </span>
                                    {client.isEmployee ? (
                                      <Badge className="text-[9px] px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200 flex-shrink-0">
                                        <UserCog className="w-2.5 h-2.5 mr-0.5" />
                                        Dipendente
                                      </Badge>
                                    ) : (
                                      <Badge className="text-[9px] px-1.5 py-0 bg-cyan-50 text-cyan-700 border-cyan-200 flex-shrink-0">
                                        Cliente
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 hidden md:table-cell">
                              <span className="text-xs text-muted-foreground truncate max-w-[180px] block">{client.email}</span>
                            </td>
                            <td className="px-3 py-2.5 hidden lg:table-cell">
                              <span className="text-xs text-muted-foreground">{client.phoneNumber || '—'}</span>
                            </td>
                            <td className="px-3 py-2.5 hidden lg:table-cell">
                              <span className="text-xs text-muted-foreground">
                                {client.createdAt ? new Date(client.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="text-xs font-medium text-foreground">
                                {client._completedCount}/{client._assignmentsCount}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 bg-muted rounded-full h-1.5">
                                  <div 
                                    className="bg-gradient-to-r from-cyan-500 to-teal-500 h-1.5 rounded-full transition-all" 
                                    style={{ width: `${client._completionRate}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-foreground w-8 text-right">{client._completionRate}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 hidden lg:table-cell">
                              {(() => {
                                if (!client.isEmployee) return <span className="text-xs text-muted-foreground">—</span>;
                                const dept = departments.find((d: any) => d.id === client.departmentId);
                                if (!dept) return <span className="text-[10px] text-muted-foreground italic">Non assegnato</span>;
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dept.color }} />
                                    <span className="text-xs font-medium text-foreground">{dept.name}</span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                              <span className={`text-xs font-medium ${client.monthlyConsultationLimit ? 'text-amber-600' : 'text-muted-foreground'}`}>
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
                                      className="h-7 w-7 p-0 hover:bg-muted"
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
                  <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-1 text-sm border border-border rounded bg-card focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <span className="hidden sm:inline">per pagina</span>
                      <span className="hidden sm:inline text-muted-foreground mx-1">|</span>
                      <span className="font-medium text-xs">
                        {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredClients.length)}<span className="hidden sm:inline"> di {filteredClients.length}</span>
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="hidden sm:inline-flex h-8 w-8 p-0"
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
                      
                      <span className="text-xs text-muted-foreground px-2 sm:hidden">
                        {currentPage}/{totalPages}
                      </span>

                      <div className="hidden sm:flex items-center gap-1 mx-2">
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
                        className="hidden sm:inline-flex h-8 w-8 p-0"
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
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-sm border-border">
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
            <DialogDescription className="text-muted-foreground">
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
                className="col-span-3 border-border focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-border focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-border focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-border focus:border-cyan-400 focus:ring-cyan-400"
                placeholder="Minimo 6 caratteri"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-sm font-medium">
                Tipo
              </Label>
              <div className="col-span-3 flex gap-4">
                <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${!newClientForm.isEmployee ? 'border-emerald-500 bg-emerald-50' : 'border-border hover:border-border'}`}>
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
                <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${newClientForm.isEmployee ? 'border-violet-500 bg-violet-50' : 'border-border hover:border-border'}`}>
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

            {newClientForm.isEmployee && departments.length > 0 && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-sm font-medium">
                  Reparto
                </Label>
                <select
                  value={newClientForm.departmentId}
                  onChange={(e) => setNewClientForm(prev => ({...prev, departmentId: e.target.value}))}
                  className="col-span-3 px-3 py-2 text-sm border border-border rounded-md bg-card hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Nessun reparto</option>
                  {departments.map((dept: any) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsNewClientDialogOpen(false)}
              className="border-border hover:bg-muted/40"
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
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-sm border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Edit className="h-5 w-5 text-cyan-600" />
              </div>
              Modifica Cliente
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
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
                className="col-span-3 border-border focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-border focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-border focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-border focus:border-cyan-400 focus:ring-cyan-400"
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
                className="col-span-3 border-border focus:border-cyan-400 focus:ring-cyan-400"
                placeholder="username"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="monthlyLimit" className="text-right text-sm font-medium">
                <div className="flex flex-col">
                  <span>Limite/mese</span>
                  <span className="text-xs text-muted-foreground font-normal">consulenze</span>
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
                  className="w-24 border-border focus:border-cyan-400 focus:ring-cyan-400"
                  placeholder="0"
                />
                <span className="text-xs text-muted-foreground">
                  {editForm.monthlyConsultationLimit === null ? 'Illimitato' : `Max ${editForm.monthlyConsultationLimit}/mese`}
                </span>
              </div>
            </div>
            
            {editingClient?.isEmployee && departments.length > 0 && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-sm font-medium">
                  <div className="flex flex-col items-end">
                    <span>Reparto</span>
                  </div>
                </Label>
                <div className="col-span-3">
                  <select
                    value={editForm.departmentId}
                    onChange={(e) => setEditForm(prev => ({...prev, departmentId: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option value="">Nessun reparto</option>
                    {departments.map((dept: any) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

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
                <div className="text-sm text-muted-foreground italic py-2 text-center border-2 border-dashed border-border rounded-lg">
                  Nessuna API key configurata. Clicca "Aggiungi Key" per iniziare.
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {editForm.geminiApiKeys.map((apiKey, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-shrink-0 w-8 text-center">
                        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                      </div>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(index, e.target.value)}
                        className="flex-1 border-border focus:border-cyan-400 focus:ring-cyan-400"
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
              
              <p className="text-xs text-muted-foreground">
                Le API keys verranno ruotate automaticamente ad ogni messaggio del cliente ({editForm.geminiApiKeys.length}/10 keys)
              </p>
            </div>
          </div>
          
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setEditingClient(null)}
              className="border-border hover:bg-muted/40"
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

      <Dialog open={isDepartmentDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDepartmentDialogOpen(false);
          setEditingDepartment(null);
          setDepartmentForm({ name: '', color: '#6366f1', description: '' });
        }
      }}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-sm border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Building2 className="h-5 w-5 text-indigo-600" />
              </div>
              {editingDepartment ? 'Modifica Reparto' : 'Nuovo Reparto'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingDepartment ? 'Modifica le informazioni del reparto' : 'Crea un nuovo reparto per organizzare i tuoi dipendenti'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-sm font-medium">Nome *</Label>
              <Input
                value={departmentForm.name}
                onChange={(e) => setDepartmentForm(prev => ({...prev, name: e.target.value}))}
                className="col-span-3 border-border focus:border-indigo-400 focus:ring-indigo-400"
                placeholder="Es. Vendite, Marketing, Supporto..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-sm font-medium">Colore</Label>
              <div className="col-span-3 flex flex-wrap gap-2">
                {DEPARTMENT_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setDepartmentForm(prev => ({...prev, color}))}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${departmentForm.color === color ? 'border-foreground scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right text-sm font-medium mt-2">Descrizione</Label>
              <textarea
                value={departmentForm.description}
                onChange={(e) => setDepartmentForm(prev => ({...prev, description: e.target.value}))}
                className="col-span-3 px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                rows={2}
                placeholder="Descrizione opzionale del reparto..."
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsDepartmentDialogOpen(false);
                setEditingDepartment(null);
                setDepartmentForm({ name: '', color: '#6366f1', description: '' });
              }}
              className="border-border hover:bg-muted/40"
            >
              Annulla
            </Button>
            <Button
              onClick={handleSaveDepartment}
              disabled={createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
              className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600"
            >
              {(createDepartmentMutation.isPending || updateDepartmentMutation.isPending) ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio...</>
              ) : (
                <>{editingDepartment ? 'Salva Modifiche' : 'Crea Reparto'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConsultantAIAssistant />
    </div>
  );
}
