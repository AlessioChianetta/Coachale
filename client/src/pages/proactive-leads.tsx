import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  Phone,
  Calendar,
  Target,
  Bot,
  UserPlus,
  Upload,
  Download,
  FileSpreadsheet,
  Megaphone,
  Zap,
  User,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  FileText,
  Play,
  History,
  Send,
  RefreshCw,
  Mail,
} from "lucide-react";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import Papa from "papaparse";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import it from "date-fns/locale/it";
import { useCampaigns } from "@/hooks/useCampaigns";

interface LeadInfo {
  obiettivi?: string;
  desideri?: string;
  uncino?: string;
  fonte?: string;
  note?: string;
  // Facebook Lead Ads question fields
  question1?: string;
  question2?: string;
  question3?: string;
  question4?: string;
  // Extended fields from Hubdigital.io webhook
  email?: string;
  companyName?: string;
  website?: string;
  customFields?: Array<{ id: string; value: any }> | Record<string, any>;
  dateAdded?: string;
  dateOfBirth?: string;
  // Address
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  // GHL reference IDs
  ghlContactId?: string;
  ghlLocationId?: string;
  assignedTo?: string;
  // Tags and DND
  tags?: string[];
  dnd?: boolean;
  dndSettings?: {
    SMS?: { status: string; message?: string; code?: string };
    Email?: { status: string; message?: string; code?: string };
    WhatsApp?: { status: string; message?: string; code?: string };
    Call?: { status: string; message?: string; code?: string };
    FB?: { status: string; message?: string; code?: string };
    GMB?: { status: string; message?: string; code?: string };
  };
}

interface ProactiveLead {
  id: string;
  consultantId: string;
  agentConfigId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  leadInfo: LeadInfo;
  idealState: string | null;
  contactSchedule: string;
  contactFrequency?: number;
  lastContactedAt: string | null;
  lastMessageSent: string | null;
  status: "pending" | "contacted" | "responded" | "converted" | "inactive";
  welcomeEmailEnabled?: boolean;
  nurturingEnabled?: boolean;
  welcomeEmailSent?: boolean;
  welcomeEmailSentAt?: string;
  welcomeEmailError?: string;
  nurturingStartDate?: string;
  nurturingEmailsSent?: number;
  metadata?: {
    tags?: string[];
    notes?: string;
    conversationId?: string;
  };
  campaignSnapshot?: {
    name?: string;
    goal?: string;
    obiettivi?: string;
    desideri?: string;
    uncino?: string;
    statoIdeale?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ActivityLog {
  id: string;
  leadId: string;
  eventType: string;
  eventMessage: string;
  eventDetails: Record<string, any>;
  leadStatusAtEvent: string | null;
  createdAt: string;
}

interface WhatsAppAgent {
  id: string;
  agentName: string;
  twilioWhatsappNumber: string;
  isDryRun?: boolean;
}

interface FormData {
  campaignId?: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  agentConfigId: string;
  leadInfo: LeadInfo;
  idealState: string;
  contactSchedule: string;
  notes?: string;
  welcomeEmailEnabled: boolean;
  nurturingEnabled: boolean;
}

const emptyFormData: FormData = {
  campaignId: "",
  firstName: "",
  lastName: "",
  phoneNumber: "+39",
  email: "",
  agentConfigId: "",
  leadInfo: {
    obiettivi: "",
    desideri: "",
    uncino: "",
    fonte: "",
  },
  idealState: "",
  contactSchedule: "",
  notes: "",
  welcomeEmailEnabled: true,
  nurturingEnabled: false,
};

const statusConfig = {
  pending: {
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600",
    icon: Clock,
    label: "In Attesa",
  },
  contacted: {
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-600",
    icon: MessageCircle,
    label: "Contattato",
  },
  responded: {
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-600",
    icon: CheckCircle2,
    label: "Ha Risposto",
  },
  converted: {
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-600",
    icon: Sparkles,
    label: "Convertito",
  },
  inactive: {
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-600",
    icon: XCircle,
    label: "Inattivo",
  },
};

const statusColors = {
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  responded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  converted: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  inactive: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusLabels = {
  pending: "In Attesa",
  contacted: "Contattato",
  responded: "Ha Risposto",
  converted: "Convertito",
  inactive: "Inattivo",
};

export default function ProactiveLeadsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ProactiveLead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<ProactiveLead | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [advancedDetailsOpen, setAdvancedDetailsOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Bulk import state
  const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);
  const [bulkCampaignId, setBulkCampaignId] = useState<string>("");
  const [csvData, setCsvData] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importResult, setImportResult] = useState<{
    successful: number;
    failed: number;
    errors: Array<{ row: number; phone?: string; error: string }>;
  } | null>(null);

  const [activityLogsDialogOpen, setActivityLogsDialogOpen] = useState(false);
  const [selectedLeadForLogs, setSelectedLeadForLogs] = useState<ProactiveLead | null>(null);
  const [triggeringLeadId, setTriggeringLeadId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);

  // Fetch all leads
  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads, isFetching: isRefetchingLeads } = useQuery({
    queryKey: ["/api/proactive-leads"],
    queryFn: async () => {
      const response = await fetch("/api/proactive-leads", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch leads");
      return response.json();
    },
  });

  const leads: ProactiveLead[] = leadsData?.leads || [];

  // Fetch proactive WhatsApp agents for dropdown (only agents with isProactiveAgent=true AND Twilio configured)
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/whatsapp/config/proactive"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config/proactive", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { configs: [] };
        throw new Error("Failed to fetch proactive WhatsApp agents");
      }
      return response.json();
    },
  });

  const agents: WhatsAppAgent[] = agentsData?.configs || [];

  // Fetch active campaigns
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns(true);
  const activeCampaigns = campaignsData?.campaigns || [];

  // Fetch CRM import logs
  const { data: importLogs } = useQuery({
    queryKey: ["/api/external-api/import-logs"],
    queryFn: async () => {
      const response = await fetch("/api/external-api/import-logs?limit=10", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.logs || [];
    },
  });

  // Fetch activity logs for selected lead
  const { data: activityLogsData, isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["proactive-lead-activity-logs", selectedLeadForLogs?.id],
    queryFn: async () => {
      if (!selectedLeadForLogs?.id) return null;
      const response = await fetch(`/api/proactive-leads/${selectedLeadForLogs.id}/activity-logs`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch activity logs");
      return response.json();
    },
    enabled: !!selectedLeadForLogs?.id && activityLogsDialogOpen,
  });

  // Create lead mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/proactive-leads", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create lead");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
      setIsDialogOpen(false);
      setSelectedLead(null);
      setFormData(emptyFormData);
      setFormErrors({});
      toast({
        title: "✅ Lead creato",
        description: "Il lead proattivo è stato creato con successo.",
      });
    },
    onError: (error: any) => {
      console.error("Create lead error:", error);

      // Extract detailed error information
      let errorMessage = error.message || "Errore durante la creazione del lead";

      // If there are validation details, show them
      if (error.details) {
        const details = Array.isArray(error.details) 
          ? error.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ')
          : JSON.stringify(error.details);
        errorMessage = `${errorMessage} - ${details}`;
      }

      toast({
        title: "❌ Errore Creazione Lead",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update lead mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => {
      const response = await fetch(`/api/proactive-leads/${id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update lead");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
      setIsDialogOpen(false);
      setSelectedLead(null);
      setFormData(emptyFormData);
      setFormErrors({});
      toast({
        title: "✅ Lead aggiornato",
        description: "Il lead è stato aggiornato con successo.",
      });
    },
    onError: (error: any) => {
      console.error("Update lead error:", error);

      // Extract detailed error information
      let errorMessage = error.message || "Errore durante l'aggiornamento del lead";

      // If there are validation details, show them
      if (error.details) {
        const details = Array.isArray(error.details) 
          ? error.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ')
          : JSON.stringify(error.details);
        errorMessage = `${errorMessage} - ${details}`;
      }

      toast({
        title: "❌ Errore Aggiornamento Lead",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Delete lead mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/proactive-leads/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete lead");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
      setIsDeleteDialogOpen(false);
      setLeadToDelete(null);
      toast({
        title: "✅ Lead eliminato",
        description: "Il lead è stato eliminato con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch("/api/proactive-leads/bulk", {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete leads");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
      setIsBulkDeleteDialogOpen(false);
      setSelectedLeads(new Set());
      toast({
        title: "✅ Lead eliminati",
        description: `${data.deletedCount || selectedLeads.size} lead eliminati con successo.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (leads: any[]) => {
      const response = await fetch("/api/proactive-leads/bulk", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ leads }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import leads");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
      setImportResult({
        successful: data.summary.successful,
        failed: data.summary.failed,
        errors: data.errors || [],
      });
      setImportProgress(100);

      if (data.summary.successful > 0) {
        toast({
          title: "✅ Import completato",
          description: `${data.summary.successful} lead importati con successo. ${data.summary.failed > 0 ? `${data.summary.failed} errori.` : ''}`,
        });
      } else {
        toast({
          title: "⚠️ Import fallito",
          description: `Tutti i ${data.summary.failed} lead hanno generato errori.`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore import",
        description: error.message,
        variant: "destructive",
      });
      setImportProgress(0);
    },
  });

  // Manual CRM import trigger mutation
  const triggerCrmImportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/proactive-leads/run", {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to trigger CRM import");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/external-api/import-logs"] });
      
      if (data.results && data.results.length > 0) {
        const totalImported = data.results.reduce((acc: number, r: any) => acc + (r.imported || 0), 0);
        const totalUpdated = data.results.reduce((acc: number, r: any) => acc + (r.updated || 0), 0);
        const totalErrors = data.results.reduce((acc: number, r: any) => acc + (r.errored || 0), 0);
        
        toast({
          title: "✅ Import CRM completato",
          description: `${totalImported} nuovi lead importati, ${totalUpdated} aggiornati${totalErrors > 0 ? `, ${totalErrors} errori` : ''}.`,
        });
      } else {
        toast({
          title: "ℹ️ Nessun CRM configurato",
          description: data.message || "Configura almeno un CRM nella sezione API Esterne per importare lead.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore import CRM",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Trigger outreach now mutation
  const triggerNowMutation = useMutation({
    mutationFn: async ({ leadId, isDryRun }: { leadId: string; isDryRun: boolean }) => {
      const response = await fetch(`/api/proactive-leads/${leadId}/trigger-now`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ isDryRun }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to trigger outreach");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Successo", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
      setTriggeringLeadId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      setTriggeringLeadId(null);
    },
  });

  // Toggle nurturing mutation
  const toggleNurturingMutation = useMutation({
    mutationFn: async ({ leadId, enable }: { leadId: string; enable: boolean }) => {
      const endpoint = enable 
        ? `/api/proactive-leads/${leadId}/nurturing/start`
        : `/api/proactive-leads/${leadId}/nurturing/stop`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to toggle nurturing");
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
      toast({
        title: variables.enable ? "✅ Nurturing Attivato" : "⏹️ Nurturing Disattivato",
        description: variables.enable 
          ? "Il lead riceverà email nurturing per 365 giorni."
          : "Le email nurturing sono state disattivate per questo lead.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddNew = () => {
    setFormData(emptyFormData);
    setSelectedLead(null);
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleCampaignChange = (campaignId: string) => {
    if (!campaignId) {
      setFormData({ ...formData, campaignId: "" });
      return;
    }

    const selectedCampaign = activeCampaigns.find((c: any) => c.id === campaignId);
    if (!selectedCampaign) return;

    setFormData({
      ...formData,
      campaignId: campaignId,
      agentConfigId: selectedCampaign.preferredAgentConfigId || formData.agentConfigId,
      leadInfo: {
        obiettivi: selectedCampaign.defaultObiettivi || formData.leadInfo.obiettivi || "",
        desideri: selectedCampaign.implicitDesires || formData.leadInfo.desideri || "",
        uncino: selectedCampaign.hookText || formData.leadInfo.uncino || "",
        fonte: formData.leadInfo.fonte || "",
      },
      idealState: selectedCampaign.idealStateDescription || formData.idealState,
    });
  };

  const handleEdit = (lead: ProactiveLead) => {
    const contactScheduleFormatted = lead.contactSchedule
      ? format(new Date(lead.contactSchedule), "yyyy-MM-dd'T'HH:mm")
      : "";

    // Get campaign defaults if lead has a campaign assigned
    const leadCampaignId = (lead as any).campaignId || "";
    const leadCampaign = leadCampaignId ? activeCampaigns.find((c: any) => c.id === leadCampaignId) : null;

    // Apply campaign defaults if fields are empty
    const existingLeadInfo = lead.leadInfo || {};
    const appliedLeadInfo = {
      obiettivi: existingLeadInfo.obiettivi || (leadCampaign?.defaultObiettivi) || "",
      desideri: existingLeadInfo.desideri || (leadCampaign?.implicitDesires) || "",
      uncino: existingLeadInfo.uncino || (leadCampaign?.hookText) || "",
      fonte: existingLeadInfo.fonte || "",
      note: existingLeadInfo.note,
      // Facebook Lead Ads question fields
      question1: existingLeadInfo.question1,
      question2: existingLeadInfo.question2,
      question3: existingLeadInfo.question3,
      question4: existingLeadInfo.question4,
      // Preserve other fields from leadInfo (Hubdigital data)
      email: existingLeadInfo.email,
      companyName: existingLeadInfo.companyName,
      website: existingLeadInfo.website,
      customFields: existingLeadInfo.customFields,
      dateAdded: existingLeadInfo.dateAdded,
      dateOfBirth: existingLeadInfo.dateOfBirth,
      address: existingLeadInfo.address,
      city: existingLeadInfo.city,
      state: existingLeadInfo.state,
      postalCode: existingLeadInfo.postalCode,
      country: existingLeadInfo.country,
      ghlContactId: existingLeadInfo.ghlContactId,
      ghlLocationId: existingLeadInfo.ghlLocationId,
      assignedTo: existingLeadInfo.assignedTo,
      tags: existingLeadInfo.tags,
      dnd: existingLeadInfo.dnd,
      dndSettings: existingLeadInfo.dndSettings,
    };

    const appliedIdealState = lead.idealState || (leadCampaign?.idealStateDescription) || "";

    setFormData({
      campaignId: leadCampaignId,
      firstName: lead.firstName,
      lastName: lead.lastName,
      phoneNumber: lead.phoneNumber,
      email: lead.email || "",
      agentConfigId: lead.agentConfigId,
      leadInfo: appliedLeadInfo,
      idealState: appliedIdealState,
      contactSchedule: contactScheduleFormatted,
      notes: lead.metadata?.notes || "",
      welcomeEmailEnabled: lead.welcomeEmailEnabled ?? true,
      nurturingEnabled: lead.nurturingEnabled ?? false,
    });
    setSelectedLead(lead);
    setFormErrors({});
    setAdvancedDetailsOpen(false);
    setIsDialogOpen(true);
  };

  const handleDelete = (lead: ProactiveLead) => {
    setLeadToDelete(lead);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (leadToDelete?.id) {
      deleteMutation.mutate(leadToDelete.id);
    }
  };

  // Bulk selection helper functions
  const handleSelectAll = () => {
    const currentPageIds = paginatedLeads.map((lead) => lead.id);
    const allSelected = currentPageIds.every((id) => selectedLeads.has(id));
    
    if (allSelected) {
      // Deselect all on current page
      const newSelected = new Set(selectedLeads);
      currentPageIds.forEach((id) => newSelected.delete(id));
      setSelectedLeads(newSelected);
    } else {
      // Select all on current page
      const newSelected = new Set(selectedLeads);
      currentPageIds.forEach((id) => newSelected.add(id));
      setSelectedLeads(newSelected);
    }
  };

  const handleSelectLead = (id: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLeads(newSelected);
  };

  const handleBulkDelete = () => {
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    const ids = Array.from(selectedLeads);
    bulkDeleteMutation.mutate(ids);
  };

  const handleViewLogs = (lead: ProactiveLead) => {
    setSelectedLeadForLogs(lead);
    setActivityLogsDialogOpen(true);
  };

  const handleTriggerNow = (lead: ProactiveLead, isDryRun: boolean = false) => {
    setTriggeringLeadId(lead.id);
    triggerNowMutation.mutate({ leadId: lead.id, isDryRun });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = "Il nome è obbligatorio";
    }

    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = "Il numero di telefono è obbligatorio";
    } else if (!formData.phoneNumber.startsWith("+")) {
      errors.phoneNumber = "Il numero deve iniziare con +";
    }

    if (!formData.agentConfigId) {
      errors.agentConfigId = "Seleziona un agente WhatsApp";
    }

    if (!formData.contactSchedule) {
      errors.contactSchedule = "La data di contatto è obbligatoria";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      toast({
        title: "⚠️ Errori di validazione",
        description: "Correggi gli errori nel form prima di salvare.",
        variant: "destructive",
      });
      return;
    }

    // CRITICAL FIX: datetime-local returns local time without timezone
    // We need to convert it to UTC ISO string properly
    const localDateTimeString = formData.contactSchedule; // e.g., "2025-11-29T10:36"
    
    // Create Date object from local time (this interprets as local timezone)
    const scheduledDate = new Date(localDateTimeString);
    
    // Check if date is valid
    if (isNaN(scheduledDate.getTime())) {
      toast({
        title: "⚠️ Data non valida",
        description: "Inserisci una data e ora valide.",
        variant: "destructive",
      });
      return;
    }
    
    // Convert to UTC ISO string (this is what backend expects)
    const isoSchedule = scheduledDate.toISOString();
    
    // CRITICAL FIX: Build clean payload - OMIT empty fields completely
    // This allows backend to apply defaults from agent config
    const cleanLeadInfo: Record<string, string> = {};
    if (formData.leadInfo.obiettivi?.trim()) cleanLeadInfo.obiettivi = formData.leadInfo.obiettivi.trim();
    if (formData.leadInfo.desideri?.trim()) cleanLeadInfo.desideri = formData.leadInfo.desideri.trim();
    if (formData.leadInfo.uncino?.trim()) cleanLeadInfo.uncino = formData.leadInfo.uncino.trim();
    if (formData.leadInfo.fonte?.trim()) cleanLeadInfo.fonte = formData.leadInfo.fonte.trim();
    
    // Check if leadInfo has any values
    const hasLeadInfo = Object.keys(cleanLeadInfo).length > 0;
    
    // Build base payload with required fields only
    const dataToSend: any = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phoneNumber: formData.phoneNumber,
      agentConfigId: formData.agentConfigId,
      contactSchedule: isoSchedule,
    };
    
    // Add email and email options if present
    if (formData.email?.trim()) {
      dataToSend.email = formData.email.trim();
      dataToSend.welcomeEmailEnabled = formData.welcomeEmailEnabled;
      dataToSend.nurturingEnabled = formData.nurturingEnabled;
    }
    
    // Add notes to metadata if present
    if (formData.notes?.trim()) {
      dataToSend.metadata = { notes: formData.notes.trim() };
    }
    
    // Add campaignId if selected
    if (formData.campaignId) {
      dataToSend.campaignId = formData.campaignId;
    }
    
    // CRITICAL: Only add leadInfo if it has actual values
    // If empty, backend will apply defaults from agent config
    if (hasLeadInfo) {
      dataToSend.leadInfo = cleanLeadInfo;
    }
    
    // CRITICAL: Only add idealState if it has a value
    // If empty, backend will apply default from agent config
    if (formData.idealState?.trim()) {
      dataToSend.idealState = formData.idealState.trim();
    }
    
    // Debug log - show what we're sending vs what user sees
    console.log("📤 Sending lead data to API:");
    console.log("   - contactSchedule (ISO UTC):", isoSchedule);
    console.log("   - contactSchedule (Local):", scheduledDate.toLocaleString('it-IT'));
    console.log("   - hasLeadInfo:", hasLeadInfo);
    console.log("   - hasIdealState:", !!formData.idealState?.trim());
    console.log("   - Full payload:", JSON.stringify(dataToSend, null, 2));

    if (selectedLead) {
      updateMutation.mutate({ id: selectedLead.id, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  // Filter leads by status
  const filteredLeads = leads.filter((lead) => {
    if (statusFilter === "all") return true;
    return lead.status === statusFilter;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return format(now, "yyyy-MM-dd'T'HH:mm");
  };

  const formatContactSchedule = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy HH:mm", { locale: it });
    } catch {
      return "N/A";
    }
  };

  // CSV Import functions
  // CSV field mapping state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [rawCsvData, setRawCsvData] = useState<any[]>([]);

  // Expected field mappings (italiano -> campo interno)
  const expectedFields: Record<string, string> = {
    nome: 'firstName',
    cognome: 'lastName',
    telefono: 'phoneNumber',
    obiettivi: 'leadInfo.obiettivi',
    desideri: 'leadInfo.desideri',
    uncino: 'leadInfo.uncino',
    note: 'metadata.notes',
  };

  const fieldLabels: Record<string, string> = {
    firstName: 'Nome',
    lastName: 'Cognome',
    phoneNumber: 'Telefono',
    'leadInfo.obiettivi': 'Obiettivi',
    'leadInfo.desideri': 'Desideri',
    'leadInfo.uncino': 'Uncino',
    'metadata.notes': 'Note',
  };

  const requiredFields = ['firstName', 'lastName', 'phoneNumber'];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          const errorMessages = results.errors.slice(0, 3).map(e => e.message).join('; ');
          toast({
            title: "⚠️ Errori nel CSV",
            description: `Trovati ${results.errors.length} errori: ${errorMessages}`,
            variant: "destructive",
          });
        }

        const headers = results.meta.fields || [];
        const validData = (results.data as any[]).filter(row => {
          return Object.values(row).some(val => val && String(val).trim() !== '');
        });

        if (validData.length === 0) {
          toast({
            title: "❌ File vuoto",
            description: "Il file CSV non contiene dati validi.",
            variant: "destructive",
          });
          return;
        }

        setCsvHeaders(headers);
        setRawCsvData(validData);

        // Auto-detect field mappings
        const autoMapping: Record<string, string> = {};
        headers.forEach(header => {
          const normalized = header.toLowerCase().trim();
          
          // Exact match first
          if (expectedFields[normalized]) {
            autoMapping[header] = expectedFields[normalized];
          }
          // Fuzzy match for common variations
          else if (normalized.includes('nome') && !normalized.includes('cognome')) {
            autoMapping[header] = 'firstName';
          }
          else if (normalized.includes('cognome') || normalized === 'surname' || normalized === 'lastname') {
            autoMapping[header] = 'lastName';
          }
          else if (normalized.includes('telefono') || normalized.includes('phone') || normalized.includes('cell')) {
            autoMapping[header] = 'phoneNumber';
          }
          else if (normalized.includes('obiettiv') || normalized.includes('objective') || normalized.includes('goal')) {
            autoMapping[header] = 'leadInfo.obiettivi';
          }
          else if (normalized.includes('desider') || normalized.includes('desire') || normalized.includes('wish')) {
            autoMapping[header] = 'leadInfo.desideri';
          }
          else if (normalized.includes('uncino') || normalized.includes('hook')) {
            autoMapping[header] = 'leadInfo.uncino';
          }
          else if (normalized.includes('note') || normalized.includes('notes') || normalized.includes('commento') || normalized.includes('comment')) {
            autoMapping[header] = 'metadata.notes';
          }
          else {
            // Campo non riconosciuto - lascialo vuoto
            autoMapping[header] = '';
          }
        });

        setFieldMapping(autoMapping);

        // Check if we have all required fields
        const mappedFields = Object.values(autoMapping).filter(v => v);
        const hasAllRequired = requiredFields.every(field => 
          mappedFields.includes(field)
        );

        // Check if there are unmapped headers that contain data
        const unmappedHeaders = headers.filter(h => !autoMapping[h]);
        const hasUnmappedWithData = unmappedHeaders.some(h => 
          validData.some(row => row[h] && String(row[h]).trim() !== '')
        );

        if (!hasAllRequired || hasUnmappedWithData) {
          // Show mapping dialog for manual correction
          setShowMappingDialog(true);
          toast({
            title: "ℹ️ Mappatura necessaria",
            description: hasAllRequired 
              ? "Alcuni campi non sono stati riconosciuti automaticamente."
              : "Assicurati di mappare i campi obbligatori: Nome, Cognome, Telefono.",
            variant: "default",
          });
        } else {
          // Auto-mapping successful, process data
          processCSVData(validData, autoMapping);
          toast({
            title: "✅ CSV caricato",
            description: `${validData.length} lead pronti per l'import.`,
          });
        }

        setImportResult(null);
        setImportProgress(0);
      },
      error: (error) => {
        toast({
          title: "❌ Errore parsing CSV",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const processCSVData = (data: any[], mapping: Record<string, string>) => {
    const processedData = data.map(row => {
      const newRow: any = {
        leadInfo: {},
        metadata: {},
      };
      Object.entries(mapping).forEach(([csvHeader, fieldPath]) => {
        const value = row[csvHeader];
        if (fieldPath && value && String(value).trim() !== '') {
          if (fieldPath.startsWith('leadInfo.')) {
            const field = fieldPath.split('.')[1];
            newRow.leadInfo[field] = String(value).trim();
          } else if (fieldPath.startsWith('metadata.')) {
            const field = fieldPath.split('.')[1];
            newRow.metadata[field] = String(value).trim();
          } else {
            newRow[fieldPath] = String(value).trim();
          }
        }
      });
      
      // Clean up empty nested objects
      if (Object.keys(newRow.leadInfo).length === 0) delete newRow.leadInfo;
      if (Object.keys(newRow.metadata).length === 0) delete newRow.metadata;
      
      return newRow;
    });
    
    setCsvData(processedData);
    setShowMappingDialog(false);
  };

  const applyFieldMapping = () => {
    // Validate that all required fields are mapped
    const mappedFields = Object.values(fieldMapping).filter(v => v);
    const missingRequired = requiredFields.filter(field => 
      !mappedFields.includes(field)
    );

    if (missingRequired.length > 0) {
      toast({
        title: "⚠️ Campi obbligatori mancanti",
        description: `Devi mappare: ${missingRequired.map(f => fieldLabels[f]).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    processCSVData(rawCsvData, fieldMapping);
  };

  const handleBulkImport = () => {
    if (csvData.length === 0) {
      toast({
        title: "⚠️ Nessun dato",
        description: "Carica un file CSV prima di importare.",
        variant: "destructive",
      });
      return;
    }

    if (agents.length === 0) {
      toast({
        title: "⚠️ Nessun agente",
        description: "Configura almeno un agente WhatsApp prima di importare lead.",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields before import
    const validationErrors: Array<{ row: number; error: string }> = [];
    csvData.forEach((row, index) => {
      const errors: string[] = [];
      if (!row.firstName || row.firstName.trim() === '') errors.push('Nome mancante');
      if (!row.lastName || row.lastName.trim() === '') errors.push('Cognome mancante');
      if (!row.phoneNumber || row.phoneNumber.trim() === '') {
        errors.push('Telefono mancante');
      } else if (!row.phoneNumber.startsWith('+')) {
        errors.push('Telefono deve iniziare con +');
      }
      if (errors.length > 0) {
        validationErrors.push({ row: index + 1, error: errors.join(', ') });
      }
    });

    if (validationErrors.length > 0) {
      toast({
        title: "⚠️ Errori di validazione",
        description: `${validationErrors.length} lead con errori. Verifica i dati.`,
        variant: "destructive",
      });
      setImportResult({
        successful: 0,
        failed: validationErrors.length,
        errors: validationErrors,
      });
      return;
    }

    const defaultAgentId = agents[0].id;
    const now = new Date();
    const defaultContactSchedule = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const leadsToImport = csvData.map((row: any) => {
      const leadData: any = {
        firstName: row.firstName,
        lastName: row.lastName,
        phoneNumber: row.phoneNumber,
        agentConfigId: defaultAgentId,
        contactSchedule: defaultContactSchedule,
      };

      // Add leadInfo only if it has values
      if (row.leadInfo && Object.keys(row.leadInfo).length > 0) {
        leadData.leadInfo = row.leadInfo;
      }

      // Add metadata only if it has values
      if (row.metadata && Object.keys(row.metadata).length > 0) {
        leadData.metadata = row.metadata;
      }

      // Add campaignId if selected
      if (bulkCampaignId) {
        leadData.campaignId = bulkCampaignId;
      }

      return leadData;
    });

    setImportProgress(10);
    bulkImportMutation.mutate(leadsToImport);
  };

  const downloadTemplate = () => {
    const template = [
      {
        nome: "Mario",
        cognome: "Rossi",
        telefono: "+393331234567",
        obiettivi: "creare un patrimonio solido",
        desideri: "generare rendita passiva",
        uncino: "ho visto che sei interessato agli investimenti",
        note: "Lead interessante da LinkedIn",
      },
      {
        nome: "Laura",
        cognome: "Bianchi",
        telefono: "+393339876543",
        obiettivi: "raggiungere l'indipendenza finanziaria",
        desideri: "vivere di rendita",
        uncino: "hai partecipato al nostro webinar",
        note: "",
      },
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_lead.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetImportDialog = () => {
    setCsvData([]);
    setBulkCampaignId("");
    setImportProgress(0);
    setImportResult(null);
    setIsBulkImportDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            {/* Navigation Tabs */}
            <NavigationTabs
              tabs={[
                { label: "Lead Proattivi", href: "/consultant/proactive-leads", icon: UserPlus },
                { label: "Campagne", href: "/consultant/campaigns", icon: Megaphone },
                { label: "Automazioni", href: "/consultant/automations", icon: Zap },
                { label: "Conversazioni", href: "/consultant/whatsapp-conversations", icon: MessageCircle },
              ]}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 dark:from-blue-600/20 dark:to-purple-600/20">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg shadow-lg">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Gestione Lead Proattivi
                  </span>
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Gestisci e monitora i tuoi lead proattivi con follow-up automatici via WhatsApp
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => refetchLeads()}
                  variant="outline"
                  disabled={isRefetchingLeads}
                  className="flex-1 sm:flex-none"
                >
                  {isRefetchingLeads ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Aggiorna
                </Button>
                <Button
                  onClick={() => triggerCrmImportMutation.mutate()}
                  className="bg-purple-600 hover:bg-purple-700 flex-1 sm:flex-none"
                  variant="outline"
                  disabled={triggerCrmImportMutation.isPending}
                >
                  {triggerCrmImportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Importa Ora
                </Button>
                <Button
                  onClick={() => setIsBulkImportDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button
                  onClick={handleAddNew}
                  className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"
                  disabled={agents.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Lead
                </Button>
              </div>
            </div>

            {/* Info Alert */}
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900 dark:text-blue-200">
                <strong>Lead Proattivi:</strong> Crea e gestisci contatti per l'outreach automatizzato.
                L'agente WhatsApp selezionato invierà messaggi personalizzati basati sulle informazioni del lead
                alla data programmata.
              </AlertDescription>
            </Alert>

            {/* No Agents Warning */}
            {agents.length === 0 && (
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-900 dark:text-orange-200">
                  <strong>Nessun agente WhatsApp configurato.</strong> Devi prima configurare almeno un agente
                  WhatsApp nella pagina di configurazione per poter creare lead proattivi.
                </AlertDescription>
              </Alert>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Totale Lead</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{leads.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg shadow-md">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">In Attesa</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {leads.filter((l) => l.status === "pending").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                      <MessageCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Contattati</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {leads.filter((l) => l.status === "contacted").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Convertiti</p>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {leads.filter((l) => l.status === "converted").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CRM Import Logs Section */}
            {importLogs && importLogs.length > 0 && (
              <Collapsible>
                <Card className="border-0 shadow-md">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <FileText className="h-5 w-5 text-blue-600" />
                          Log Importazioni CRM
                          <Badge variant="secondary" className="ml-2">
                            {importLogs.length} recenti
                          </Badge>
                        </CardTitle>
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {importLogs.map((log: any, index: number) => (
                          <div
                            key={log.id || index}
                            className={`p-3 rounded-lg border ${
                              log.status === 'error' 
                                ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' 
                                : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {log.timestamp 
                                    ? format(new Date(log.timestamp), "dd MMM yyyy HH:mm", { locale: it })
                                    : 'N/A'}
                                </span>
                                <Badge 
                                  className={
                                    log.status === 'error' 
                                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  }
                                >
                                  {log.status === 'error' ? 'Errore' : 'Successo'}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm">
                              {log.imported !== undefined && (
                                <span className="text-green-600 dark:text-green-400">
                                  <strong>{log.imported}</strong> importati
                                </span>
                              )}
                              {log.updated !== undefined && (
                                <span className="text-blue-600 dark:text-blue-400">
                                  <strong>{log.updated}</strong> aggiornati
                                </span>
                              )}
                              {log.errored !== undefined && log.errored > 0 && (
                                <span className="text-red-600 dark:text-red-400">
                                  <strong>{log.errored}</strong> errori
                                </span>
                              )}
                            </div>
                            {log.error && (
                              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                {log.error}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Status Filter Tabs */}
            <Tabs value={statusFilter} onValueChange={handleStatusFilterChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
                <TabsTrigger value="all">Tutti ({leads.length})</TabsTrigger>
                <TabsTrigger value="pending">
                  In Attesa ({leads.filter((l) => l.status === "pending").length})
                </TabsTrigger>
                <TabsTrigger value="contacted">
                  Contattati ({leads.filter((l) => l.status === "contacted").length})
                </TabsTrigger>
                <TabsTrigger value="responded">
                  Risposto ({leads.filter((l) => l.status === "responded").length})
                </TabsTrigger>
                <TabsTrigger value="converted">
                  Convertiti ({leads.filter((l) => l.status === "converted").length})
                </TabsTrigger>
                <TabsTrigger value="inactive">
                  Inattivi ({leads.filter((l) => l.status === "inactive").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Leads Table */}
            {leadsLoading ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-12">
                  <UserPlus className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {statusFilter === "all" ? "Nessun lead trovato" : `Nessun lead ${statusLabels[statusFilter as keyof typeof statusLabels]?.toLowerCase()}`}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                    {statusFilter === "all"
                      ? "Inizia aggiungendo il tuo primo lead proattivo per automatizzare l'outreach."
                      : "Nessun lead corrisponde al filtro selezionato."}
                  </p>
                  {statusFilter === "all" && agents.length > 0 && (
                    <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Aggiungi Primo Lead
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-xl border-0">
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900 rounded-t-lg">
                  <CardTitle>Lead ({filteredLeads.length})</CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedLeads.size > 0 && (
                      <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina {selectedLeads.size} selezionati
                      </Button>
                    )}
                    <Label htmlFor="items-per-page" className="text-sm text-gray-600">
                      Elementi per pagina:
                    </Label>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(parseInt(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger id="items-per-page" className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox 
                              checked={paginatedLeads.length > 0 && paginatedLeads.every((lead) => selectedLeads.has(lead.id))}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefono</TableHead>
                          <TableHead>Obiettivo</TableHead>
                          <TableHead>Prossimo Contatto</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Nurturing</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedLeads.map((lead) => {
                          const config = statusConfig[lead.status] || statusConfig.pending;
                          const StatusIcon = config?.icon || Clock;
                          const hasResponded = lead.status === "responded" || lead.status === "converted";
                          
                          return (
                            <TableRow key={lead.id} className={`transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:shadow-sm ${hasResponded ? "bg-green-50/50 dark:bg-green-950/20" : ""}`}>
                              <TableCell className="w-12">
                                <Checkbox 
                                  checked={selectedLeads.has(lead.id)}
                                  onCheckedChange={() => handleSelectLead(lead.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${hasResponded ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                    <User className={`h-4 w-4 ${hasResponded ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span>{lead.firstName} {lead.lastName}</span>
                                      {hasResponded && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Risposta
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-gray-400" />
                                  <span className="font-mono text-sm">{lead.phoneNumber}</span>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {lead.leadInfo?.obiettivi || lead.campaignSnapshot?.obiettivi || lead.campaignSnapshot?.goal || lead.idealState || "N/A"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm">{formatContactSchedule(lead.contactSchedule)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`${config?.color || statusConfig.pending.color} border flex items-center gap-1.5 w-fit`}>
                                  <StatusIcon className="h-3.5 w-3.5" />
                                  {config?.label || "In Attesa"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {lead.email ? (
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={lead.nurturingEnabled || false}
                                      onCheckedChange={(checked) => {
                                        toggleNurturingMutation.mutate({ leadId: lead.id, enable: checked });
                                      }}
                                      disabled={toggleNurturingMutation.isPending}
                                    />
                                    {lead.nurturingEnabled ? (
                                      <Badge className="bg-green-500 text-white border-green-600">
                                        Giorno {lead.nurturingEmailsSent || 0}/365
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                        Inattivo
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Email mancante</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleViewLogs(lead)}
                                        >
                                          <History className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Vedi Log Attività</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  {lead.status === "pending" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleTriggerNow(lead, false)}
                                            disabled={triggeringLeadId === lead.id}
                                          >
                                            {triggeringLeadId === lead.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Send className="h-4 w-4 text-green-600" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Invia Ora</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(lead)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(lead)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-600">
                        Mostrando {startIndex + 1}-{Math.min(endIndex, filteredLeads.length)} di {filteredLeads.length} lead
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          Precedente
                        </Button>
                        <div className="flex items-center gap-1">
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
                                className="w-9"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Successivo
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-3 pb-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 -mx-6 -mt-6 px-6 pt-6 rounded-t-lg">
              <DialogTitle className="flex items-center gap-3 text-2xl">
                {selectedLead ? (
                  <>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Edit className="h-6 w-6 text-blue-600" />
                    </div>
                    Modifica Lead
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Plus className="h-6 w-6 text-green-600" />
                    </div>
                    Aggiungi Nuovo Lead
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-base">
                {selectedLead
                  ? "Modifica le informazioni del lead proattivo per ottimizzare il contatto."
                  : "Compila i campi sottostanti per creare un nuovo lead proattivo e automatizzare l'outreach."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Essential Fields Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Informazioni Essenziali
                  </h3>
                  <Badge variant="outline" className="ml-auto text-xs">Campi obbligatori</Badge>
                </div>
                
                {/* Nome e Cognome */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      Nome <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="Mario"
                      className={formErrors.firstName ? "border-red-500" : ""}
                    />
                    {formErrors.firstName && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.firstName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      Cognome
                    </Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Rossi (opzionale)"
                    />
                  </div>
                </div>

                {/* Telefono */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-sm font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    Numero di Telefono <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={(e) => {
                      let value = e.target.value;
                      value = value.replace(/\s/g, "");
                      if (value === "") {
                        value = "+39";
                      }
                      if (!value.startsWith("+")) {
                        value = "+" + value;
                      }
                      setFormData({ ...formData, phoneNumber: value });
                    }}
                    placeholder="+39 333 1234567"
                    className={formErrors.phoneNumber ? "border-red-500" : ""}
                  />
                  {formErrors.phoneNumber && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {formErrors.phoneNumber}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="mario.rossi@email.com"
                  />
                  <p className="text-xs text-gray-500">
                    Opzionale. Necessaria per inviare email di benvenuto e nurturing.
                  </p>
                </div>

                {/* Email Options - Solo se email è compilata */}
                {formData.email && formData.email.trim() !== "" && (
                  <div className="space-y-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-emerald-600" />
                      <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">Opzioni Email</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="welcomeEmailEnabled"
                          checked={formData.welcomeEmailEnabled}
                          onCheckedChange={(checked) => 
                            setFormData({ ...formData, welcomeEmailEnabled: checked === true })
                          }
                        />
                        <div className="flex-1">
                          <Label htmlFor="welcomeEmailEnabled" className="text-sm font-medium cursor-pointer">
                            Invia email di benvenuto
                          </Label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Invia una email di benvenuto insieme al primo messaggio WhatsApp
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="nurturingEnabled"
                          checked={formData.nurturingEnabled}
                          onCheckedChange={(checked) => 
                            setFormData({ ...formData, nurturingEnabled: checked === true })
                          }
                        />
                        <div className="flex-1">
                          <Label htmlFor="nurturingEnabled" className="text-sm font-medium cursor-pointer">
                            Attiva email nurturing (365 giorni)
                          </Label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Invia automaticamente una email di valore al giorno per un anno
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Agente WhatsApp */}
                <div className="space-y-2">
                  <Label htmlFor="agentConfigId" className="text-sm font-medium flex items-center gap-2">
                    <Bot className="h-4 w-4 text-gray-500" />
                    Agente WhatsApp <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.agentConfigId}
                    onValueChange={(value) => setFormData({ ...formData, agentConfigId: value })}
                  >
                    <SelectTrigger className={formErrors.agentConfigId ? "border-red-500" : ""}>
                      <SelectValue placeholder="Seleziona un agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentsLoading ? (
                        <div className="p-4 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </div>
                      ) : agents.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          Nessun agente configurato
                        </div>
                      ) : (
                        agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4" />
                              {agent.agentName} - {agent.twilioWhatsappNumber}
                              {(agent.isDryRun ?? true) && (
                                <Badge 
                                  variant="outline"
                                  className="bg-orange-100 text-orange-800 border-orange-300 text-xs ml-auto"
                                >
                                  🧪 Test
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {formErrors.agentConfigId && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {formErrors.agentConfigId}
                    </p>
                  )}
                  {formData.agentConfigId && agents.find(a => a.id === formData.agentConfigId)?.isDryRun !== false && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-3 mt-2">
                      <span className="text-orange-600 text-xl">⚠️</span>
                      <div className="flex-1 text-sm">
                        <p className="font-semibold text-orange-800">Modalità Test Attiva</p>
                        <p className="text-orange-700 mt-1">
                          I messaggi verranno simulati ma <strong>NON inviati</strong> al contatto.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Data contatto programmato */}
                <div className="space-y-3">
                  <Label htmlFor="contactSchedule" className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    Data e Ora Contatto <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const targetTime = new Date();
                        targetTime.setMinutes(targetTime.getMinutes() + 5);
                        const formatted = format(targetTime, "yyyy-MM-dd'T'HH:mm");
                        setFormData({ ...formData, contactSchedule: formatted });
                      }}
                    >
                      Tra 5 min
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const targetTime = new Date();
                        targetTime.setMinutes(targetTime.getMinutes() + 30);
                        const formatted = format(targetTime, "yyyy-MM-dd'T'HH:mm");
                        setFormData({ ...formData, contactSchedule: formatted });
                      }}
                    >
                      Tra 30 min
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const targetTime = new Date();
                        targetTime.setHours(targetTime.getHours() + 1);
                        const formatted = format(targetTime, "yyyy-MM-dd'T'HH:mm");
                        setFormData({ ...formData, contactSchedule: formatted });
                      }}
                    >
                      Tra 1 ora
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(9, 0, 0, 0);
                        const formatted = format(tomorrow, "yyyy-MM-dd'T'HH:mm");
                        setFormData({ ...formData, contactSchedule: formatted });
                      }}
                    >
                      Domani 9:00
                    </Button>
                  </div>
                  <Input
                    id="contactSchedule"
                    type="datetime-local"
                    value={formData.contactSchedule}
                    onChange={(e) => setFormData({ ...formData, contactSchedule: e.target.value })}
                    className={formErrors.contactSchedule ? "border-red-500" : ""}
                  />
                  {formErrors.contactSchedule && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {formErrors.contactSchedule}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    L'AI decide autonomamente i follow-up successivi in base alle risposte
                  </p>
                </div>
              </div>

              {/* Collapsible Advanced Details Section */}
              <Collapsible open={advancedDetailsOpen} onOpenChange={setAdvancedDetailsOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Dettagli Avanzati</span>
                      <Badge variant="outline" className="text-xs">Opzionale</Badge>
                    </div>
                    {advancedDetailsOpen ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  {/* Campagna Marketing */}
                  <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Label htmlFor="campaignId" className="text-sm font-medium flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-blue-600" />
                      Campagna Marketing
                    </Label>
                    <Select
                      value={formData.campaignId || undefined}
                      onValueChange={handleCampaignChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nessuna campagna" />
                      </SelectTrigger>
                      <SelectContent>
                        {campaignsLoading ? (
                          <div className="p-4 text-center">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          </div>
                        ) : activeCampaigns.length === 0 ? (
                          <div className="p-4 text-center text-sm text-gray-500">
                            Nessuna campagna attiva
                          </div>
                        ) : (
                          activeCampaigns.map((campaign: any) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.campaignName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {formData.campaignId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCampaignChange("")}
                        className="text-xs text-gray-500"
                      >
                        Rimuovi campagna
                      </Button>
                    )}
                  </div>

                  {/* Obiettivi */}
                  <div className="space-y-2">
                    <Label htmlFor="obiettivi" className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-gray-500" />
                      Obiettivi
                    </Label>
                    <Textarea
                      id="obiettivi"
                      value={formData.leadInfo.obiettivi || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          leadInfo: { ...formData.leadInfo, obiettivi: e.target.value },
                        })
                      }
                      placeholder="Es: Investire risparmi per pensione"
                      rows={2}
                      className="resize-none"
                    />
                  </div>

                  {/* Desideri */}
                  <div className="space-y-2">
                    <Label htmlFor="desideri" className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-gray-500" />
                      Desideri
                    </Label>
                    <Textarea
                      id="desideri"
                      value={formData.leadInfo.desideri || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          leadInfo: { ...formData.leadInfo, desideri: e.target.value },
                        })
                      }
                      placeholder="Es: Rendita passiva 2000€/mese"
                      rows={2}
                      className="resize-none"
                    />
                  </div>

                  {/* Uncino */}
                  <div className="space-y-2">
                    <Label htmlFor="uncino" className="text-sm font-medium flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-gray-500" />
                      Uncino (Hook)
                    </Label>
                    <Textarea
                      id="uncino"
                      value={formData.leadInfo.uncino || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          leadInfo: { ...formData.leadInfo, uncino: e.target.value },
                        })
                      }
                      placeholder="Es: Visto su LinkedIn gruppo investimenti"
                      rows={2}
                      className="resize-none"
                    />
                  </div>

                  {/* Stato Ideale */}
                  <div className="space-y-2">
                    <Label htmlFor="idealState" className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-gray-500" />
                      Stato Ideale
                    </Label>
                    <Textarea
                      id="idealState"
                      value={formData.idealState}
                      onChange={(e) => setFormData({ ...formData, idealState: e.target.value })}
                      placeholder="Es: Libertà finanziaria in 5 anni"
                      rows={2}
                      className="resize-none"
                    />
                  </div>

                  {/* Note */}
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      Note
                    </Label>
                    <Textarea
                      id="notes"
                      value={formData.notes || ""}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Note interne sul lead..."
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Hubdigital.io Imported Data - Read Only Section */}
              {selectedLead && (formData.leadInfo.email || formData.leadInfo.companyName || formData.leadInfo.address || formData.leadInfo.tags?.length || formData.leadInfo.note || formData.leadInfo.question1 || formData.leadInfo.question2 || formData.leadInfo.question3 || formData.leadInfo.question4) && (
                <Collapsible defaultOpen={true} className="border rounded-lg p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full flex justify-between items-center p-0 h-auto hover:bg-transparent">
                      <span className="text-base font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-300">
                        <Zap className="h-5 w-5 text-orange-600" />
                        Dati Importati da Hubdigital.io
                      </span>
                      <ChevronDown className="h-5 w-5 text-orange-500" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {/* Email */}
                      {formData.leadInfo.email && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-500 uppercase">Email</span>
                          <span className="text-gray-900 dark:text-gray-100">{formData.leadInfo.email}</span>
                        </div>
                      )}
                      {/* Azienda */}
                      {formData.leadInfo.companyName && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-500 uppercase">Azienda</span>
                          <span className="text-gray-900 dark:text-gray-100">{formData.leadInfo.companyName}</span>
                        </div>
                      )}
                      {/* Sito Web */}
                      {formData.leadInfo.website && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-500 uppercase">Sito Web</span>
                          <a href={formData.leadInfo.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{formData.leadInfo.website}</a>
                        </div>
                      )}
                      {/* Data di Nascita */}
                      {formData.leadInfo.dateOfBirth && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-500 uppercase">Data di Nascita</span>
                          <span className="text-gray-900 dark:text-gray-100">{formData.leadInfo.dateOfBirth}</span>
                        </div>
                      )}
                      {/* Fonte */}
                      {formData.leadInfo.fonte && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-500 uppercase">Fonte</span>
                          <Badge variant="outline" className="w-fit bg-purple-100 text-purple-800 border-purple-300">{formData.leadInfo.fonte}</Badge>
                        </div>
                      )}
                      {/* Data Aggiunta */}
                      {formData.leadInfo.dateAdded && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-500 uppercase">Data Aggiunta CRM</span>
                          <span className="text-gray-900 dark:text-gray-100">{formData.leadInfo.dateAdded}</span>
                        </div>
                      )}
                    </div>

                    {/* Indirizzo */}
                    {(formData.leadInfo.address || formData.leadInfo.city || formData.leadInfo.state || formData.leadInfo.postalCode || formData.leadInfo.country) && (
                      <div className="p-3 bg-white/60 dark:bg-gray-800/40 rounded-lg border border-orange-100 dark:border-orange-900">
                        <span className="text-xs font-medium text-gray-500 uppercase block mb-2">Indirizzo</span>
                        <div className="text-sm text-gray-900 dark:text-gray-100 space-y-0.5">
                          {formData.leadInfo.address && <p>{formData.leadInfo.address}</p>}
                          <p>
                            {[formData.leadInfo.postalCode, formData.leadInfo.city, formData.leadInfo.state, formData.leadInfo.country].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {formData.leadInfo.tags && formData.leadInfo.tags.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase block mb-2">Tags</span>
                        <div className="flex flex-wrap gap-2">
                          {formData.leadInfo.tags.map((tag, idx) => (
                            <Badge key={idx} className="bg-orange-100 text-orange-800 border-orange-300">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Note importate */}
                    {formData.leadInfo.note && (
                      <div className="p-3 bg-white/60 dark:bg-gray-800/40 rounded-lg border border-orange-100 dark:border-orange-900">
                        <span className="text-xs font-medium text-gray-500 uppercase block mb-2">Note Importate</span>
                        <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{formData.leadInfo.note}</p>
                      </div>
                    )}

                    {/* Facebook Lead Ads Questions */}
                    {(formData.leadInfo.question1 || formData.leadInfo.question2 || formData.leadInfo.question3 || formData.leadInfo.question4) && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase block mb-3">Risposte Modulo Lead</span>
                        <div className="space-y-3">
                          {formData.leadInfo.question1 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-gray-500">Domanda 1</span>
                              <span className="text-sm text-gray-900 dark:text-gray-100">{formData.leadInfo.question1}</span>
                            </div>
                          )}
                          {formData.leadInfo.question2 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-gray-500">Domanda 2</span>
                              <span className="text-sm text-gray-900 dark:text-gray-100">{formData.leadInfo.question2}</span>
                            </div>
                          )}
                          {formData.leadInfo.question3 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-gray-500">Domanda 3</span>
                              <span className="text-sm text-gray-900 dark:text-gray-100">{formData.leadInfo.question3}</span>
                            </div>
                          )}
                          {formData.leadInfo.question4 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-gray-500">Domanda 4</span>
                              <span className="text-sm text-gray-900 dark:text-gray-100">{formData.leadInfo.question4}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Custom Fields */}
                    {formData.leadInfo.customFields && (
                      Array.isArray(formData.leadInfo.customFields) ? formData.leadInfo.customFields.length > 0 : Object.keys(formData.leadInfo.customFields).length > 0
                    ) && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase block mb-2">Campi Personalizzati</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {Array.isArray(formData.leadInfo.customFields) 
                            ? formData.leadInfo.customFields.map((cf, idx) => (
                                <div key={idx} className="flex justify-between p-2 bg-white/60 dark:bg-gray-800/40 rounded border border-orange-100">
                                  <span className="text-gray-600 font-mono text-xs">{cf.id}</span>
                                  <span className="text-gray-900 dark:text-gray-100">{String(cf.value)}</span>
                                </div>
                              ))
                            : Object.entries(formData.leadInfo.customFields).map(([key, value], idx) => (
                                <div key={idx} className="flex justify-between p-2 bg-white/60 dark:bg-gray-800/40 rounded border border-orange-100">
                                  <span className="text-gray-600 font-mono text-xs">{key}</span>
                                  <span className="text-gray-900 dark:text-gray-100">{String(value)}</span>
                                </div>
                              ))
                          }
                        </div>
                      </div>
                    )}

                    {/* DND Status */}
                    {formData.leadInfo.dnd !== undefined && (
                      <div className="p-3 bg-white/60 dark:bg-gray-800/40 rounded-lg border border-orange-100 dark:border-orange-900">
                        <span className="text-xs font-medium text-gray-500 uppercase block mb-2">Stato DND (Do Not Disturb)</span>
                        <Badge variant={formData.leadInfo.dnd ? "destructive" : "secondary"} className="mb-2">
                          {formData.leadInfo.dnd ? "DND Attivo" : "DND Disattivo"}
                        </Badge>
                        {formData.leadInfo.dndSettings && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs">
                            {Object.entries(formData.leadInfo.dndSettings).map(([channel, setting]) => (
                              <div key={channel} className={`p-1.5 rounded text-center ${setting?.status === 'active' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                <span className="font-medium">{channel}</span>: {setting?.status || 'N/A'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* GHL IDs (for reference) */}
                    {(formData.leadInfo.ghlContactId || formData.leadInfo.ghlLocationId) && (
                      <div className="text-xs text-gray-500 pt-2 border-t border-orange-200/50">
                        {formData.leadInfo.ghlContactId && <span className="mr-4">GHL Contact: <code className="bg-gray-100 px-1 rounded">{formData.leadInfo.ghlContactId}</code></span>}
                        {formData.leadInfo.ghlLocationId && <span>GHL Location: <code className="bg-gray-100 px-1 rounded">{formData.leadInfo.ghlLocationId}</code></span>}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvataggio...
                  </>
                ) : selectedLead ? (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Aggiorna Lead
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Crea Lead
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare il lead{" "}
                <strong>
                  {leadToDelete?.firstName} {leadToDelete?.lastName}
                </strong>
                ? Questa azione non può essere annullata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminazione...
                  </>
                ) : (
                  "Elimina"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma Eliminazione Multipla</AlertDialogTitle>
              <AlertDialogDescription>
                Stai per eliminare {selectedLeads.size} lead. Questa azione è irreversibile.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkDelete}
                className="bg-red-600 hover:bg-red-700"
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminazione...
                  </>
                ) : (
                  `Elimina ${selectedLeads.size} Lead`
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Import CSV Dialog */}
        <Dialog open={isBulkImportDialogOpen} onOpenChange={setIsBulkImportDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                Import Lead da CSV
              </DialogTitle>
              <DialogDescription>
                Carica un file CSV con i tuoi lead. Scarica il template per vedere il formato richiesto.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Mini Guida */}
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm space-y-2">
                  <p className="font-semibold text-blue-900 dark:text-blue-200">📋 Guida Rapida Import CSV</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-300">
                    <li><strong>Campi obbligatori:</strong> Nome, Cognome, Telefono</li>
                    <li><strong>Campi opzionali:</strong> Obiettivi, Desideri, Uncino, Note</li>
                    <li><strong>Formato telefono:</strong> deve iniziare con + (es: +393331234567)</li>
                    <li><strong>Intestazioni accettate:</strong> nome, cognome, telefono, obiettivi, desideri, uncino, note</li>
                    <li>💡 <strong>Se le colonne non vengono riconosciute automaticamente, ti aiuterò a mapparle!</strong></li>
                  </ul>
                </AlertDescription>
              </Alert>
              {/* Campaign Selection */}
              <div className="space-y-2">
                <Label htmlFor="bulkCampaignId" className="text-sm font-medium flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Campagna Marketing (Opzionale)
                </Label>
                <Select value={bulkCampaignId || undefined} onValueChange={setBulkCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona una campagna per tutti i lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignsLoading ? (
                      <div className="p-4 text-center">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </div>
                    ) : activeCampaigns.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        Nessuna campagna attiva
                      </div>
                    ) : (
                      activeCampaigns.map((campaign: any) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          <div className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4" />
                            {campaign.campaignName} ({campaign.campaignType})
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {bulkCampaignId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkCampaignId("")}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Rimuovi campagna
                  </Button>
                )}
                {bulkCampaignId && csvData.length > 0 && (
                  <div className="bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 rounded-lg p-3 flex items-start gap-3">
                    <span className="text-blue-600 text-xl">ℹ️</span>
                    <div className="flex-1 text-sm">
                      <p className="font-semibold text-blue-900 dark:text-blue-200">
                        {csvData.length} lead saranno associati alla campagna selezionata
                      </p>
                      <p className="text-blue-800 dark:text-blue-300 mt-1">
                        I lead erediteranno automaticamente le impostazioni della campagna
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Download Template */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Template CSV</p>
                    <p className="text-sm text-blue-700">Scarica il template per vedere le colonne richieste</p>
                  </div>
                </div>
                <Button onClick={downloadTemplate} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Scarica Template
                </Button>
              </div>

              {/* Upload CSV */}
              <div className="space-y-2">
                <Label htmlFor="csv-upload">Carica File CSV</Label>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500">
                  Il file deve essere in formato CSV con le colonne: nome, cognome, telefono, etc.
                </p>
              </div>

              {/* CSV Preview */}
              {csvData.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      Anteprima ({csvData.length} lead totali)
                    </h4>
                    <Button
                      onClick={() => {
                        setCsvData([]);
                        setRawCsvData([]);
                        setCsvHeaders([]);
                        setFieldMapping({});
                        const input = document.getElementById('csv-upload') as HTMLInputElement;
                        if (input) input.value = '';
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Cancella
                    </Button>
                  </div>
                  
                  {/* Success indicator */}
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span><strong>{csvData.length}</strong> lead pronti per l'importazione</span>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">#</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Nome</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Cognome</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Telefono</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Obiettivi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.slice(0, 5).map((row: any, index) => {
                            const hasPhoneError = !row.phoneNumber?.startsWith('+');
                            return (
                              <tr key={index} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{index + 1}</td>
                                <td className="px-3 py-2 dark:text-white">{row.firstName || '-'}</td>
                                <td className="px-3 py-2 dark:text-white">{row.lastName || '-'}</td>
                                <td className={`px-3 py-2 font-mono text-xs ${hasPhoneError ? 'text-red-600' : 'dark:text-white'}`}>
                                  {row.phoneNumber || '-'}
                                  {hasPhoneError && <span className="ml-1 text-red-500">⚠️</span>}
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 max-w-[150px] truncate">
                                  {row.leadInfo?.obiettivi || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {csvData.length > 5 && (
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 border-t dark:border-gray-700 flex items-center gap-2">
                        <span>📊 Mostrando 5 di {csvData.length} lead</span>
                        <span className="text-gray-400">|</span>
                        <span>Altri {csvData.length - 5} lead verranno importati</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Import Progress */}
              {importProgress > 0 && importProgress < 100 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Import in corso...</span>
                    <span className="text-gray-600">{importProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Import Results */}
              {importResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-2xl font-bold text-green-700">{importResult.successful}</div>
                      <div className="text-sm text-green-600">Lead importati</div>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-2xl font-bold text-red-700">{importResult.failed}</div>
                      <div className="text-sm text-red-600">Errori</div>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="border border-red-200 rounded-lg p-3 bg-red-50 max-h-40 overflow-y-auto">
                      <h5 className="font-semibold text-red-900 mb-2">Dettagli Errori:</h5>
                      <div className="space-y-1">
                        {importResult.errors.map((error, index) => (
                          <div key={index} className="text-xs text-red-700">
                            <strong>Riga {error.row}:</strong> {error.phone ? `${error.phone} - ` : ''}{error.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 px-4 sm:px-6 lg:px-8">
              <Button variant="outline" onClick={resetImportDialog}>
                {importResult ? 'Chiudi' : 'Annulla'}
              </Button>
              {!importResult && csvData.length > 0 && (
                <Button
                  onClick={handleBulkImport}
                  disabled={bulkImportMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {bulkImportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importazione...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importa {csvData.length} Lead
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Field Mapping Dialog */}
        <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Mappa i Campi del CSV
              </DialogTitle>
              <DialogDescription>
                Alcuni campi del tuo CSV non sono stati riconosciuti automaticamente. 
                Indica a quale campo corrispondono.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm">
                  <p className="font-semibold text-orange-900 dark:text-orange-200 mb-2">
                    ⚠️ Campi Obbligatori
                  </p>
                  <p className="text-orange-800 dark:text-orange-300">
                    Assicurati di mappare almeno: <strong>Nome, Cognome, Telefono</strong>
                  </p>
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                      <TableHead className="w-1/3">Colonna nel CSV</TableHead>
                      <TableHead className="w-1/3">Esempio Dati</TableHead>
                      <TableHead className="w-1/3">Mappa a Campo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvHeaders.map((header, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {header}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {rawCsvData[0]?.[header] ? (
                            <span className="truncate block max-w-[200px]">
                              {String(rawCsvData[0][header]).substring(0, 30)}
                              {String(rawCsvData[0][header]).length > 30 ? '...' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={fieldMapping[header] || ''}
                            onValueChange={(value) => {
                              setFieldMapping(prev => ({
                                ...prev,
                                [header]: value
                              }));
                            }}
                          >
                            <SelectTrigger className={
                              !fieldMapping[header] 
                                ? "border-orange-300 dark:border-orange-700" 
                                : ""
                            }>
                              <SelectValue placeholder="Seleziona campo..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">
                                <span className="text-gray-400">Non mappare</span>
                              </SelectItem>
                              {Object.entries(fieldLabels).map(([field, label]) => {
                                const isRequired = requiredFields.includes(field);
                                const isAlreadyMapped = Object.values(fieldMapping).includes(field) && fieldMapping[header] !== field;
                                
                                return (
                                  <SelectItem 
                                    key={field} 
                                    value={field}
                                    disabled={isAlreadyMapped}
                                  >
                                    <div className="flex items-center gap-2">
                                      {label}
                                      {isRequired && <Badge variant="destructive" className="text-xs">Obbligatorio</Badge>}
                                      {isAlreadyMapped && <span className="text-xs text-gray-500">(già mappato)</span>}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Validation Summary */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Riepilogo Mappatura:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {requiredFields.map(field => {
                    const isMapped = Object.values(fieldMapping).includes(field);
                    return (
                      <div 
                        key={field}
                        className={`p-2 rounded-lg border ${
                          isMapped 
                            ? 'bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-700' 
                            : 'bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isMapped ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                          <span className="text-sm font-medium">
                            {fieldLabels[field]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowMappingDialog(false);
                  setCsvData([]);
                  setRawCsvData([]);
                  setCsvHeaders([]);
                  setFieldMapping({});
                }}
              >
                Annulla
              </Button>
              <Button
                onClick={applyFieldMapping}
                className="bg-green-600 hover:bg-green-700"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Applica Mappatura
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>

      {/* Activity Logs Dialog */}
      <Dialog open={activityLogsDialogOpen} onOpenChange={setActivityLogsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Log Attività - {selectedLeadForLogs?.firstName} {selectedLeadForLogs?.lastName}
            </DialogTitle>
            <DialogDescription>
              Timeline degli eventi per questo lead proattivo
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {isLoadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : activityLogsData?.logs?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nessuna attività registrata per questo lead
              </div>
            ) : (
              <div className="space-y-4">
                {activityLogsData?.logs?.map((log: ActivityLog) => {
                  const eventIcons: Record<string, { icon: any; color: string }> = {
                    created: { icon: Plus, color: "text-green-600 bg-green-100" },
                    processing: { icon: RefreshCw, color: "text-blue-600 bg-blue-100" },
                    sent: { icon: Send, color: "text-green-600 bg-green-100" },
                    failed: { icon: XCircle, color: "text-red-600 bg-red-100" },
                    skipped: { icon: Clock, color: "text-yellow-600 bg-yellow-100" },
                    manual_trigger: { icon: Zap, color: "text-purple-600 bg-purple-100" },
                    responded: { icon: MessageCircle, color: "text-green-600 bg-green-100" },
                    converted: { icon: Sparkles, color: "text-purple-600 bg-purple-100" },
                  };
                  const eventConfig = eventIcons[log.eventType] || { icon: Clock, color: "text-gray-600 bg-gray-100" };
                  const EventIcon = eventConfig.icon;
                  
                  return (
                    <div key={log.id} className="flex gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${eventConfig.color}`}>
                        <EventIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {log.eventType.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss", { locale: it })}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {log.eventMessage}
                        </p>
                        {log.eventDetails && Object.keys(log.eventDetails).length > 0 && (
                          <Collapsible className="mt-2">
                            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                              <ChevronDown className="h-3 w-3" />
                              Dettagli
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-x-auto">
                              <pre>{JSON.stringify(log.eventDetails, null, 2)}</pre>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}