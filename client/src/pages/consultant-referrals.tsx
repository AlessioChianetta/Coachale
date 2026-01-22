import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Phone,
  Mail,
  Settings,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  MoreHorizontal,
  Eye,
  ChevronDown,
  Gift,
  TrendingUp,
  UserPlus,
  Search,
  Loader2,
  FileText,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { it } from "date-fns/locale";

type ReferralStatus = "pending" | "contacted" | "appointment_set" | "closed_won" | "closed_lost";

interface Referral {
  id: string;
  friendFirstName: string | null;
  friendLastName: string | null;
  friendEmail: string;
  friendPhone: string;
  status: ReferralStatus;
  notes: string | null;
  bonusAwarded: boolean;
  createdAt: string;
  referrer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ReferralStats {
  total: number;
  pending: number;
  contacted: number;
  appointmentSet: number;
  closedWon: number;
  closedLost: number;
  bonusAwarded: number;
  conversionRate: number;
}

const STATUS_CONFIG: Record<ReferralStatus, { label: string; color: string; bgColor: string; icon: React.ComponentType<any> }> = {
  pending: { label: "In Attesa", color: "text-amber-700", bgColor: "bg-amber-100", icon: Clock },
  contacted: { label: "Contattato", color: "text-blue-700", bgColor: "bg-blue-100", icon: Phone },
  appointment_set: { label: "Appuntamento", color: "text-purple-700", bgColor: "bg-purple-100", icon: Calendar },
  closed_won: { label: "Chiuso Vinto", color: "text-emerald-700", bgColor: "bg-emerald-100", icon: CheckCircle },
  closed_lost: { label: "Chiuso Perso", color: "text-red-700", bgColor: "bg-red-100", icon: XCircle },
};

interface ProactiveLead {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  status: string;
  source: string;
  createdAt: string;
  leadInfo?: {
    email?: string;
    obiettivi?: string;
    desideri?: string;
    uncino?: string;
    fonte?: string;
    role?: string;
    motivation?: string;
    biggestProblem?: string;
    goal12Months?: string;
    currentBlocker?: string;
    companyType?: string;
    sector?: string;
    employeeCount?: string;
    annualRevenue?: string;
    currentCompany?: string;
    currentPosition?: string;
    yearsExperience?: string;
    fieldOfStudy?: string;
    university?: string;
    notes?: string;
  };
}

export default function ConsultantReferralsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = getAuthUser();

  // Switch tra Referral e Optin
  const [viewMode, setViewMode] = useState<"referral" | "optin">("referral");
  const [linkCopied, setLinkCopied] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"all" | ReferralStatus>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  
  // Stato per dialog dettagli lead optin
  const [selectedOptinLead, setSelectedOptinLead] = useState<ProactiveLead | null>(null);
  const [optinDetailsModalOpen, setOptinDetailsModalOpen] = useState(false);

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; stats: ReferralStats }>({
    queryKey: ["/api/consultant/referral-stats"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/referral-stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const { data: referralsData, isLoading: referralsLoading } = useQuery<{ success: boolean; referrals: Referral[] }>({
    queryKey: ["/api/consultant/referrals"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/referrals", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch referrals");
      return response.json();
    },
  });

  const updateReferralMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status?: ReferralStatus; notes?: string }) => {
      const response = await fetch(`/api/consultant/referrals/${id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, notes }),
      });
      if (!response.ok) throw new Error("Failed to update referral");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Referral aggiornato",
        description: "Le modifiche sono state salvate con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/referral-stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Query per lead Optin
  const { data: optinLeadsData, isLoading: optinLoading } = useQuery<{ leads: ProactiveLead[] }>({
    queryKey: ["/api/proactive-leads", "optin"],
    queryFn: async () => {
      const response = await fetch("/api/proactive-leads?source=optin", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch optin leads");
      return response.json();
    },
    enabled: viewMode === "optin",
  });

  const optinLeads = optinLeadsData?.leads || [];

  // Helper per copiare il link optin
  const getOptinLink = () => {
    if (!user?.id) return "";
    return `${window.location.origin}/optin/${user.id}`;
  };

  const copyOptinLink = async () => {
    try {
      await navigator.clipboard.writeText(getOptinLink());
      setLinkCopied(true);
      toast({
        title: "Link copiato!",
        description: "Il link optin è stato copiato negli appunti",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Errore",
        description: "Impossibile copiare il link",
        variant: "destructive",
      });
    }
  };

  const stats = statsData?.stats || {
    total: 0,
    pending: 0,
    contacted: 0,
    appointmentSet: 0,
    closedWon: 0,
    closedLost: 0,
    bonusAwarded: 0,
    conversionRate: 0,
  };

  const referrals = referralsData?.referrals || [];

  const filteredReferrals = useMemo(() => {
    let result = referrals;

    if (activeTab !== "all") {
      result = result.filter((r) => r.status === activeTab);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.friendFirstName?.toLowerCase().includes(term) ||
          r.friendLastName?.toLowerCase().includes(term) ||
          r.friendEmail.toLowerCase().includes(term) ||
          r.referrer?.firstName?.toLowerCase().includes(term) ||
          r.referrer?.lastName?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [referrals, activeTab, searchTerm]);

  const handleStatusChange = (referralId: string, newStatus: ReferralStatus) => {
    updateReferralMutation.mutate({ id: referralId, status: newStatus });
  };

  const handleViewDetails = (referral: Referral) => {
    setSelectedReferral(referral);
    setEditNotes(referral.notes || "");
    setDetailsModalOpen(true);
  };

  const handleSaveNotes = () => {
    if (selectedReferral) {
      updateReferralMutation.mutate(
        { id: selectedReferral.id, notes: editNotes },
        {
          onSuccess: () => {
            setDetailsModalOpen(false);
          },
        }
      );
    }
  };

  const isLoading = statsLoading || referralsLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-fuchsia-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto">
            <Activity className="h-8 w-8 animate-spin text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Caricamento in corso</h3>
            <p className="text-slate-600">Stiamo recuperando i dati dei referral...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="mb-4 sm:mb-6 md:mb-8">
            <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl relative overflow-hidden ${
              viewMode === "referral" 
                ? "bg-slate-900" 
                : "bg-gradient-to-br from-teal-800 to-emerald-900"
            }`}>
              <div className={`absolute inset-x-0 top-0 h-1 ${
                viewMode === "referral"
                  ? "bg-gradient-to-r from-fuchsia-400 via-purple-400 to-pink-400"
                  : "bg-gradient-to-r from-teal-400 via-emerald-400 to-green-400"
              }`}></div>
              <div className="flex items-center justify-between">
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl ${
                      viewMode === "referral"
                        ? "bg-gradient-to-br from-fuchsia-500 to-purple-500"
                        : "bg-gradient-to-br from-teal-500 to-emerald-500"
                    }`}>
                      {viewMode === "referral" ? (
                        <Gift className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                      ) : (
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
                          {viewMode === "referral" ? "Gestione Referral" : "Lead Optin"}
                        </h1>
                        <div className="hidden sm:flex bg-white/10 rounded-full p-1">
                          <button
                            onClick={() => setViewMode("referral")}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                              viewMode === "referral"
                                ? "bg-white text-slate-900"
                                : "text-white/70 hover:text-white"
                            }`}
                          >
                            Referral
                          </button>
                          <button
                            onClick={() => setViewMode("optin")}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                              viewMode === "optin"
                                ? "bg-white text-slate-900"
                                : "text-white/70 hover:text-white"
                            }`}
                          >
                            Optin
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-400 text-xs sm:text-sm md:text-base lg:text-lg hidden sm:block">
                        {viewMode === "referral" 
                          ? "Gestisci tutti i referral dai tuoi clienti"
                          : "Lead che si sono iscritti direttamente dal tuo link optin"
                        }
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="hidden lg:flex items-center space-x-4">
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 lg:p-6 text-center border border-slate-700/50">
                      <div className="text-2xl lg:text-3xl font-bold">{stats.total}</div>
                      <div className="text-xs lg:text-sm text-slate-400">Totale Referral</div>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 lg:p-6 text-center border border-slate-700/50">
                      <div className="text-2xl lg:text-3xl font-bold text-emerald-400">{stats.conversionRate}%</div>
                      <div className="text-xs lg:text-sm text-slate-400">Conversione</div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/consultant/referrals/settings")}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Impostazioni</span>
                  </Button>
                </div>
              </div>
              
              {/* Link Optin Box */}
              {viewMode === "optin" && (
                <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                    <ExternalLink className="w-4 h-4 text-teal-300 flex-shrink-0" />
                    <span className="text-white/80 flex-shrink-0">Link Optin:</span>
                    <code className="bg-white/20 px-2 py-1 rounded text-xs truncate max-w-[300px]">
                      {getOptinLink()}
                    </code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyOptinLink}
                    className="text-white hover:bg-white/20"
                  >
                    {linkCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {linkCopied ? "Copiato!" : "Copia Link"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {viewMode === "referral" ? (
          <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-slate-700">Totale</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">{stats.total}</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Users className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-amber-700">In Attesa</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">{stats.pending}</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Clock className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-blue-700">Contattati</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">{stats.contacted}</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Phone className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-purple-700">Appuntamenti</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">{stats.appointmentSet}</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <Calendar className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-emerald-700">Chiusi Vinti</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">{stats.closedWon}</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <CheckCircle className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-800 mb-1">Elenco Referral</CardTitle>
                  <p className="text-sm text-slate-600">Gestisci e monitora tutti i referral ricevuti</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 sm:flex-none sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Cerca referral..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-white/80 border-slate-200 focus:border-fuchsia-400 focus:ring-fuchsia-400"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                  <TabsList className="bg-slate-100 p-1 h-auto flex-wrap">
                    <TabsTrigger value="all" className="data-[state=active]:bg-white text-xs sm:text-sm">
                      Tutti ({stats.total})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="data-[state=active]:bg-white text-xs sm:text-sm">
                      In Attesa ({stats.pending})
                    </TabsTrigger>
                    <TabsTrigger value="contacted" className="data-[state=active]:bg-white text-xs sm:text-sm">
                      Contattati ({stats.contacted})
                    </TabsTrigger>
                    <TabsTrigger value="appointment_set" className="data-[state=active]:bg-white text-xs sm:text-sm">
                      Appuntamento ({stats.appointmentSet})
                    </TabsTrigger>
                    <TabsTrigger value="closed_won" className="data-[state=active]:bg-white text-xs sm:text-sm">
                      Chiusi Vinti ({stats.closedWon})
                    </TabsTrigger>
                    <TabsTrigger value="closed_lost" className="data-[state=active]:bg-white text-xs sm:text-sm">
                      Chiusi Persi ({stats.closedLost})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {filteredReferrals.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Gift size={40} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">
                    {searchTerm ? "Nessun risultato" : "Nessun referral"}
                  </h3>
                  <p className="text-slate-600 mb-6 max-w-md mx-auto">
                    {searchTerm
                      ? "Prova a modificare i termini di ricerca"
                      : "I referral inviati dai tuoi clienti appariranno qui"}
                  </p>
                  {searchTerm && (
                    <Button variant="outline" onClick={() => setSearchTerm("")}>
                      Rimuovi filtri
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Amico Invitato</TableHead>
                        <TableHead className="min-w-[180px]">Cliente Referente</TableHead>
                        <TableHead className="min-w-[130px]">Stato</TableHead>
                        <TableHead className="min-w-[120px]">Data</TableHead>
                        <TableHead className="min-w-[150px] text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReferrals.map((referral) => {
                        const statusConfig = STATUS_CONFIG[referral.status];
                        const StatusIcon = statusConfig.icon;
                        return (
                          <TableRow key={referral.id} className="hover:bg-slate-50">
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-slate-800">
                                  {referral.friendFirstName} {referral.friendLastName}
                                </p>
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Mail className="w-3 h-3" />
                                  {referral.friendEmail}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {referral.referrer ? (
                                <div className="space-y-1">
                                  <p className="font-medium text-slate-700">
                                    {referral.referrer.firstName} {referral.referrer.lastName}
                                  </p>
                                  <p className="text-xs text-slate-500">{referral.referrer.email}</p>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-slate-600">
                                {referral.createdAt
                                  ? format(new Date(referral.createdAt), "d MMM yyyy", { locale: it })
                                  : "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="border-slate-200 hover:bg-slate-50"
                                >
                                  <a href={`tel:${referral.friendPhone}`}>
                                    <Phone className="w-4 h-4" />
                                  </a>
                                </Button>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50">
                                      <span className="hidden sm:inline mr-1">Stato</span>
                                      <ChevronDown className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {(Object.keys(STATUS_CONFIG) as ReferralStatus[]).map((status) => {
                                      const config = STATUS_CONFIG[status];
                                      const Icon = config.icon;
                                      return (
                                        <DropdownMenuItem
                                          key={status}
                                          onClick={() => handleStatusChange(referral.id, status)}
                                          className={referral.status === status ? "bg-slate-100" : ""}
                                        >
                                          <Icon className={`w-4 h-4 mr-2 ${config.color}`} />
                                          {config.label}
                                        </DropdownMenuItem>
                                      );
                                    })}
                                  </DropdownMenuContent>
                                </DropdownMenu>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetails(referral)}
                                  className="border-slate-200 hover:bg-slate-50"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          </>
          ) : (
            /* OPTIN VIEW */
            <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800 mb-1">Lead Optin</CardTitle>
                    <p className="text-sm text-slate-600">
                      Lead che si sono iscritti direttamente dal tuo link optin ({optinLeads.length} totali)
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 sm:flex-none sm:w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Cerca lead..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-white/80 border-slate-200 focus:border-teal-400 focus:ring-teal-400"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                {optinLoading ? (
                  <div className="text-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-500" />
                    <p className="mt-4 text-slate-600">Caricamento lead optin...</p>
                  </div>
                ) : optinLeads.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <div className="w-20 h-20 bg-teal-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <FileText size={40} className="text-teal-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800 mb-2">Nessun lead optin</h3>
                    <p className="text-slate-600 mb-6 max-w-md mx-auto">
                      Condividi il tuo link optin per ricevere contatti diretti
                    </p>
                    <Button 
                      onClick={copyOptinLink}
                      className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copia Link Optin
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Nome</TableHead>
                          <TableHead className="min-w-[180px]">Contatti</TableHead>
                          <TableHead className="min-w-[130px]">Stato</TableHead>
                          <TableHead className="min-w-[120px]">Data</TableHead>
                          <TableHead className="min-w-[100px] text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {optinLeads
                          .filter(lead => {
                            if (!searchTerm) return true;
                            const term = searchTerm.toLowerCase();
                            return (
                              lead.firstName?.toLowerCase().includes(term) ||
                              lead.lastName?.toLowerCase().includes(term) ||
                              lead.email?.toLowerCase().includes(term) ||
                              lead.phoneNumber?.includes(term)
                            );
                          })
                          .map((lead) => (
                          <TableRow key={lead.id} className="hover:bg-slate-50">
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-slate-800">
                                  {lead.firstName} {lead.lastName}
                                </p>
                                {lead.leadInfo?.obiettivi && (
                                  <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                    {lead.leadInfo.obiettivi}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {(lead.email || lead.leadInfo?.email) && (
                                  <div className="flex items-center gap-1 text-xs text-slate-500">
                                    <Mail className="w-3 h-3" />
                                    {lead.email || lead.leadInfo?.email}
                                  </div>
                                )}
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Phone className="w-3 h-3" />
                                  {lead.phoneNumber}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${
                                lead.status === 'converted' ? 'bg-emerald-100 text-emerald-700' :
                                lead.status === 'responded' ? 'bg-blue-100 text-blue-700' :
                                lead.status === 'contacted' ? 'bg-purple-100 text-purple-700' :
                                'bg-amber-100 text-amber-700'
                              } border-0`}>
                                {lead.status === 'converted' ? 'Convertito' :
                                 lead.status === 'responded' ? 'Ha risposto' :
                                 lead.status === 'contacted' ? 'Contattato' :
                                 'In attesa'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-slate-600">
                                {lead.createdAt
                                  ? format(new Date(lead.createdAt), "d MMM yyyy", { locale: it })
                                  : "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOptinLead(lead);
                                    setOptinDetailsModalOpen(true);
                                  }}
                                  className="border-slate-200 hover:bg-slate-50"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="border-slate-200 hover:bg-slate-50"
                                >
                                  <a href={`tel:${lead.phoneNumber}`}>
                                    <Phone className="w-4 h-4" />
                                  </a>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog Dettagli Lead Optin */}
      <Dialog open={optinDetailsModalOpen} onOpenChange={setOptinDetailsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-500" />
              Dettagli Lead Optin
            </DialogTitle>
            <DialogDescription>
              Informazioni complete del lead iscritto tramite link optin
            </DialogDescription>
          </DialogHeader>

          {selectedOptinLead && (
            <div className="space-y-6 py-4">
              {/* Info Base */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Nome Completo</Label>
                  <p className="font-medium text-slate-800">
                    {selectedOptinLead.firstName} {selectedOptinLead.lastName}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Stato</Label>
                  <Badge className={`${
                    selectedOptinLead.status === 'converted' ? 'bg-emerald-100 text-emerald-700' :
                    selectedOptinLead.status === 'responded' ? 'bg-blue-100 text-blue-700' :
                    selectedOptinLead.status === 'contacted' ? 'bg-purple-100 text-purple-700' :
                    'bg-amber-100 text-amber-700'
                  } border-0 mt-1`}>
                    {selectedOptinLead.status === 'converted' ? 'Convertito' :
                     selectedOptinLead.status === 'responded' ? 'Ha risposto' :
                     selectedOptinLead.status === 'contacted' ? 'Contattato' :
                     'In attesa'}
                  </Badge>
                </div>
              </div>

              {/* Contatti */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Email</Label>
                  <p className="font-medium text-slate-800">
                    {selectedOptinLead.email || selectedOptinLead.leadInfo?.email || "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Telefono</Label>
                  <a href={`tel:${selectedOptinLead.phoneNumber}`} className="font-medium text-teal-600 hover:underline">
                    {selectedOptinLead.phoneNumber}
                  </a>
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-500">Data Iscrizione</Label>
                <p className="font-medium text-slate-800">
                  {selectedOptinLead.createdAt
                    ? format(new Date(selectedOptinLead.createdAt), "d MMMM yyyy, HH:mm", { locale: it })
                    : "-"}
                </p>
              </div>

              {/* Sezione Qualificazione - mostra solo se ci sono dati */}
              {selectedOptinLead.leadInfo && Object.keys(selectedOptinLead.leadInfo).some(k => 
                selectedOptinLead.leadInfo?.[k as keyof typeof selectedOptinLead.leadInfo]
              ) && (
                <>
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-teal-500" />
                      Informazioni di Qualificazione
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedOptinLead.leadInfo.obiettivi && (
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-500">Obiettivi</Label>
                          <p className="text-slate-700 bg-slate-50 p-2 rounded-lg">{selectedOptinLead.leadInfo.obiettivi}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.motivation && (
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-500">Motivazione</Label>
                          <p className="text-slate-700 bg-slate-50 p-2 rounded-lg">{selectedOptinLead.leadInfo.motivation}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.biggestProblem && (
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-500">Problema Principale</Label>
                          <p className="text-slate-700 bg-slate-50 p-2 rounded-lg">{selectedOptinLead.leadInfo.biggestProblem}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.goal12Months && (
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-500">Obiettivo a 12 Mesi</Label>
                          <p className="text-slate-700 bg-slate-50 p-2 rounded-lg">{selectedOptinLead.leadInfo.goal12Months}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.currentBlocker && (
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-500">Blocchi Attuali</Label>
                          <p className="text-slate-700 bg-slate-50 p-2 rounded-lg">{selectedOptinLead.leadInfo.currentBlocker}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.role && (
                        <div>
                          <Label className="text-xs text-slate-500">Ruolo</Label>
                          <p className="text-slate-700">{selectedOptinLead.leadInfo.role}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.companyType && (
                        <div>
                          <Label className="text-xs text-slate-500">Tipo Azienda</Label>
                          <p className="text-slate-700">{selectedOptinLead.leadInfo.companyType}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.sector && (
                        <div>
                          <Label className="text-xs text-slate-500">Settore</Label>
                          <p className="text-slate-700">{selectedOptinLead.leadInfo.sector}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.employeeCount && (
                        <div>
                          <Label className="text-xs text-slate-500">Numero Dipendenti</Label>
                          <p className="text-slate-700">{selectedOptinLead.leadInfo.employeeCount}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.annualRevenue && (
                        <div>
                          <Label className="text-xs text-slate-500">Fatturato Annuo</Label>
                          <p className="text-slate-700">{selectedOptinLead.leadInfo.annualRevenue}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.currentCompany && (
                        <div>
                          <Label className="text-xs text-slate-500">Azienda Attuale</Label>
                          <p className="text-slate-700">{selectedOptinLead.leadInfo.currentCompany}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.currentPosition && (
                        <div>
                          <Label className="text-xs text-slate-500">Posizione Attuale</Label>
                          <p className="text-slate-700">{selectedOptinLead.leadInfo.currentPosition}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.yearsExperience && (
                        <div>
                          <Label className="text-xs text-slate-500">Anni di Esperienza</Label>
                          <p className="text-slate-700">{selectedOptinLead.leadInfo.yearsExperience}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.fieldOfStudy && (
                        <div>
                          <Label className="text-xs text-slate-500">Campo di Studio</Label>
                          <p className="text-slate-700">{selectedOptinLead.leadInfo.fieldOfStudy}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.university && (
                        <div>
                          <Label className="text-xs text-slate-500">Università</Label>
                          <p className="text-slate-700">{selectedOptinLead.leadInfo.university}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.desideri && (
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-500">Desideri</Label>
                          <p className="text-slate-700 bg-slate-50 p-2 rounded-lg">{selectedOptinLead.leadInfo.desideri}</p>
                        </div>
                      )}
                      
                      {selectedOptinLead.leadInfo.notes && (
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-500">Note</Label>
                          <p className="text-slate-700 bg-slate-50 p-2 rounded-lg">{selectedOptinLead.leadInfo.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOptinDetailsModalOpen(false)}>
              Chiudi
            </Button>
            <Button
              asChild
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
            >
              <a href={`tel:${selectedOptinLead?.phoneNumber}`}>
                <Phone className="w-4 h-4 mr-2" />
                Chiama
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-fuchsia-500" />
              Dettagli Referral
            </DialogTitle>
            <DialogDescription>
              Visualizza e modifica i dettagli del referral
            </DialogDescription>
          </DialogHeader>

          {selectedReferral && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Amico Invitato</Label>
                  <p className="font-medium text-slate-800">
                    {selectedReferral.friendFirstName} {selectedReferral.friendLastName}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Stato</Label>
                  <Badge className={`${STATUS_CONFIG[selectedReferral.status].bgColor} ${STATUS_CONFIG[selectedReferral.status].color} border-0 mt-1`}>
                    {STATUS_CONFIG[selectedReferral.status].label}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Email</Label>
                  <p className="font-medium text-slate-800">{selectedReferral.friendEmail}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Telefono</Label>
                  <a href={`tel:${selectedReferral.friendPhone}`} className="font-medium text-fuchsia-600 hover:underline">
                    {selectedReferral.friendPhone}
                  </a>
                </div>
              </div>

              {selectedReferral.referrer && (
                <div>
                  <Label className="text-xs text-slate-500">Referente</Label>
                  <p className="font-medium text-slate-800">
                    {selectedReferral.referrer.firstName} {selectedReferral.referrer.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{selectedReferral.referrer.email}</p>
                </div>
              )}

              <div>
                <Label className="text-xs text-slate-500">Data Creazione</Label>
                <p className="font-medium text-slate-800">
                  {selectedReferral.createdAt
                    ? format(new Date(selectedReferral.createdAt), "d MMMM yyyy, HH:mm", { locale: it })
                    : "-"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Aggiungi note sul referral..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsModalOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={updateReferralMutation.isPending}
              className="bg-gradient-to-r from-fuchsia-500 to-purple-500 hover:from-fuchsia-600 hover:to-purple-600"
            >
              {updateReferralMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salva Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
