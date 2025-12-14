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
  Play,
  Megaphone,
  Zap,
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
}

interface ProactiveLead {
  id: string;
  consultantId: string;
  agentConfigId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  leadInfo: LeadInfo;
  idealState: string | null;
  contactSchedule: string;
  contactFrequency: number;
  lastContactedAt: string | null;
  lastMessageSent: string | null;
  status: "pending" | "contacted" | "responded" | "converted" | "inactive";
  metadata?: {
    tags?: string[];
    notes?: string;
    conversationId?: string;
  };
  createdAt: string;
  updatedAt: string;
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
  agentConfigId: string;
  leadInfo: LeadInfo;
  idealState: string;
  contactSchedule: string;
  contactFrequency: number;
}

const emptyFormData: FormData = {
  campaignId: "",
  firstName: "",
  lastName: "",
  phoneNumber: "+39",
  agentConfigId: "",
  leadInfo: {
    obiettivi: "",
    desideri: "",
    uncino: "",
    fonte: "",
  },
  idealState: "",
  contactSchedule: "",
  contactFrequency: 7,
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

  // Fetch all leads
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
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

  // Manual trigger proactive outreach mutation
  const runProactiveOutreachMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/proactive-leads/run", {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to trigger proactive outreach");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Processo avviato",
        description: "Il processo di outreach proattivo è stato avviato. Controlla i log per i dettagli.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
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

    setFormData({
      campaignId: (lead as any).campaignId || "",
      firstName: lead.firstName,
      lastName: lead.lastName,
      phoneNumber: lead.phoneNumber,
      agentConfigId: lead.agentConfigId,
      leadInfo: lead.leadInfo || {
        obiettivi: "",
        desideri: "",
        uncino: "",
        fonte: "",
      },
      idealState: lead.idealState || "",
      contactSchedule: contactScheduleFormatted,
      contactFrequency: lead.contactFrequency,
    });
    setSelectedLead(lead);
    setFormErrors({});
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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = "Il nome è obbligatorio";
    }

    if (!formData.lastName.trim()) {
      errors.lastName = "Il cognome è obbligatorio";
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
    } else {
      const contactDate = new Date(formData.contactSchedule);
      const now = new Date();
      if (contactDate <= now) {
        errors.contactSchedule = "La data deve essere futura";
      }
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
    
    // CRITICAL: Check if future AFTER conversion to UTC
    const now = new Date();
    const timeDiff = scheduledDate.getTime() - now.getTime();
    
    // If too close to now or in the past, add safety margin
    if (timeDiff < 60000) { // Less than 1 minute
      scheduledDate.setTime(now.getTime() + 60000); // Add 1 minute
      console.warn("⚠️ contactSchedule was too close to now - adjusted to +1 minute");
      
      toast({
        title: "⏰ Data aggiustata",
        description: "La data era troppo vicina al presente, è stata aggiustata di 1 minuto.",
        variant: "default",
      });
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
      contactFrequency: formData.contactFrequency,
    };
    
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
  const expectedFields = {
    nome: 'firstName',
    cognome: 'lastName',
    telefono: 'phoneNumber',
    data_contatto: 'contactSchedule',
    frequenza: 'contactFrequency',
    stato_ideale: 'idealState',
    obiettivi: 'leadInfo.obiettivi',
    desideri: 'leadInfo.desideri',
    uncino: 'leadInfo.uncino',
    fonte: 'leadInfo.fonte',
  };

  const fieldLabels: Record<string, string> = {
    firstName: 'Nome',
    lastName: 'Cognome',
    phoneNumber: 'Telefono',
    contactSchedule: 'Data Contatto',
    contactFrequency: 'Frequenza',
    idealState: 'Stato Ideale',
    'leadInfo.obiettivi': 'Obiettivi',
    'leadInfo.desideri': 'Desideri',
    'leadInfo.uncino': 'Uncino',
    'leadInfo.fonte': 'Fonte',
  };

  const requiredFields = ['firstName', 'lastName', 'phoneNumber'];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setRawCsvData(results.data);

        // Auto-detect field mappings
        const autoMapping: Record<string, string> = {};
        headers.forEach(header => {
          const normalized = header.toLowerCase().trim();
          
          // Exact match
          if (expectedFields[normalized]) {
            autoMapping[header] = expectedFields[normalized];
          }
          // Fuzzy match for common variations
          else if (normalized.includes('nome') && !normalized.includes('cognome')) {
            autoMapping[header] = 'firstName';
          }
          else if (normalized.includes('cognome')) {
            autoMapping[header] = 'lastName';
          }
          else if (normalized.includes('telefono') || normalized.includes('phone')) {
            autoMapping[header] = 'phoneNumber';
          }
          else if (normalized.includes('data') || normalized.includes('contatto') || normalized.includes('schedule')) {
            autoMapping[header] = 'contactSchedule';
          }
          else if (normalized.includes('frequen')) {
            autoMapping[header] = 'contactFrequency';
          }
          else if (normalized.includes('stato') || normalized.includes('ideale')) {
            autoMapping[header] = 'idealState';
          }
          else if (normalized.includes('obiettiv')) {
            autoMapping[header] = 'leadInfo.obiettivi';
          }
          else if (normalized.includes('desider')) {
            autoMapping[header] = 'leadInfo.desideri';
          }
          else if (normalized.includes('uncino') || normalized.includes('hook')) {
            autoMapping[header] = 'leadInfo.uncino';
          }
          else if (normalized.includes('fonte') || normalized.includes('source')) {
            autoMapping[header] = 'leadInfo.fonte';
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

        if (!hasAllRequired || Object.values(autoMapping).some(v => !v)) {
          // Show mapping dialog for manual correction
          setShowMappingDialog(true);
        } else {
          // Auto-mapping successful, process data
          processCSVData(results.data, autoMapping);
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
      const newRow: any = {};
      Object.entries(mapping).forEach(([csvHeader, fieldPath]) => {
        if (fieldPath && row[csvHeader]) {
          if (fieldPath.startsWith('leadInfo.')) {
            const field = fieldPath.split('.')[1];
            if (!newRow.leadInfo) newRow.leadInfo = {};
            newRow.leadInfo[field] = row[csvHeader];
          } else {
            newRow[fieldPath] = row[csvHeader];
          }
        }
      });
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

    const defaultAgentId = agents[0].id;
    const now = new Date();
    const defaultContactSchedule = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const leadsToImport = csvData.map((row: any) => {
      const leadData: any = {
        firstName: row.nome || row.Nome || row.firstName || row.FirstName || "",
        lastName: row.cognome || row.Cognome || row.lastName || row.LastName || "",
        phoneNumber: row.telefono || row.Telefono || row.phone || row.Phone || row.phoneNumber || "",
        agentConfigId: defaultAgentId,
        contactSchedule: row.data_contatto || row.contactSchedule || defaultContactSchedule,
        contactFrequency: parseInt(row.frequenza || row.frequency || "7"),
        idealState: row.stato_ideale || row.idealState || "",
        leadInfo: {
          obiettivi: row.obiettivi || row.objectives || undefined,
          desideri: row.desideri || row.desires || undefined,
          uncino: row.uncino || row.hook || undefined,
          fonte: row.fonte || row.source || undefined,
        },
      };

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
        data_contatto: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        frequenza: "7",
        stato_ideale: "la libertà finanziaria",
        obiettivi: "creare un patrimonio solido",
        desideri: "generare rendita passiva",
        uncino: "ho visto che sei interessato",
        fonte: "LinkedIn",
      },
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
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
              ]}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <Users className="h-8 w-8 text-blue-600" />
                  Gestione Lead Proattivi
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Gestisci e monitora i tuoi lead proattivi con follow-up automatici via WhatsApp
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => runProactiveOutreachMutation.mutate()}
                  className="bg-purple-600 hover:bg-purple-700 flex-1 sm:flex-none"
                  variant="outline"
                  disabled={runProactiveOutreachMutation.isPending}
                >
                  {runProactiveOutreachMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Esegui Ora
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
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Lead ({filteredLeads.length})</CardTitle>
                  <div className="flex items-center gap-2">
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
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefono</TableHead>
                          <TableHead>Obiettivo</TableHead>
                          <TableHead>Prossimo Contatto</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedLeads.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium">
                              {lead.firstName} {lead.lastName}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span className="font-mono text-sm">{lead.phoneNumber}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {lead.leadInfo?.obiettivi || lead.idealState || "N/A"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">{formatContactSchedule(lead.contactSchedule)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[lead.status]}>
                                {statusLabels[lead.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(lead)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(lead)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
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
            <DialogHeader className="space-y-3 pb-4 border-b">
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
              {/* Campaign Selection Section */}
              <div className="space-y-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 pb-2">
                  <Megaphone className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Campagna Marketing (Opzionale)
                  </h3>
                </div>
                <div className="space-y-2 pl-7">
                  <Label htmlFor="campaignId" className="text-sm font-medium">
                    Seleziona Campagna
                  </Label>
                  <Select
                    value={formData.campaignId || undefined}
                    onValueChange={handleCampaignChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nessuna campagna (usa default agente)" />
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
                  {formData.campaignId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCampaignChange("")}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Rimuovi campagna
                    </Button>
                  )}
                  {formData.campaignId && (
                    <div className="bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 rounded-lg p-3 flex items-start gap-3 mt-2">
                      <span className="text-blue-600 text-xl">ℹ️</span>
                      <div className="flex-1 text-sm">
                        <p className="font-semibold text-blue-900 dark:text-blue-200">Campagna Selezionata</p>
                        <p className="text-blue-800 dark:text-blue-300 mt-1">
                          I campi sottostanti sono stati auto-popolati con i dati della campagna.
                          Puoi modificarli manualmente se necessario.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Basic Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2">
                  <UserPlus className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Informazioni Personali
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="firstName" className="text-sm font-medium flex items-center gap-1">
                        Nome <span className="text-red-500">*</span>
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-xs hover:bg-purple-200">
                              {"{{1}}"} Tutti i template
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs font-semibold mb-1">Variabile universale:</p>
                            <p className="text-xs">
                              Il nome del lead è la prima variabile <strong>{"{{1}}"}</strong> in TUTTI i template Twilio
                              (Opening, Gentle Follow-up, Value Follow-up, Final Follow-up).
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
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
                    <Label htmlFor="lastName" className="text-sm font-medium flex items-center gap-1">
                      Cognome <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Rossi"
                      className={formErrors.lastName ? "border-red-500" : ""}
                    />
                    {formErrors.lastName && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pl-7">
                  <Label htmlFor="phoneNumber" className="text-sm font-medium flex items-center gap-1">
                    <Phone className="h-4 w-4" />
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
              </div>

              {/* WhatsApp Agent Section */}
              <div className="space-y-4 pt-2 border-t">
                <div className="flex items-center gap-2 pb-2">
                  <Bot className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Configurazione Agente
                  </h3>
                </div>
                <div className="space-y-2 pl-7">
                  <Label htmlFor="agentConfigId" className="text-sm font-medium flex items-center gap-1">
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
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-3">
                      <span className="text-orange-600 text-xl">⚠️</span>
                      <div className="flex-1 text-sm">
                        <p className="font-semibold text-orange-800">Modalità Test Attiva</p>
                        <p className="text-orange-700 mt-1">
                          L'agente è in <strong>modalità test (dry run)</strong>. 
                          I messaggi verranno simulati ma <strong>NON inviati</strong> al contatto.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Lead Details Section */}
              <div className="space-y-4 pt-2 border-t">
                <div className="flex items-center gap-2 pb-2">
                  <Target className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Dettagli Lead
                  </h3>
                  <span className="text-xs text-gray-500 ml-2">(Opzionale - usa i default dell'agente se vuoto)</span>
                </div>
                <div className="space-y-4 pl-7">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="obiettivi" className="text-sm font-medium">
                        Obiettivi
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 text-xs">
                              Non usato
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">
                              Questo campo non è attualmente mappato ad alcuna variabile nei template Twilio.
                              Verrà salvato nel database ma non sostituirà variabili nei messaggi.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
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

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="desideri" className="text-sm font-medium">
                        Desideri
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 text-xs">
                              Non usato
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">
                              Questo campo non è attualmente mappato ad alcuna variabile nei template Twilio.
                              Verrà salvato nel database ma non sostituirà variabili nei messaggi.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
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

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="uncino" className="text-sm font-medium">
                        Uncino (Hook)
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs hover:bg-orange-200">
                              {"{{4}}"} Opening
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs font-semibold mb-1">Mappato a variabile Twilio:</p>
                            <ul className="list-disc list-inside text-xs space-y-1">
                              <li><strong>{"{{4}}"}</strong> nel template <strong>Opening Message</strong></li>
                            </ul>
                            <p className="text-xs mt-2 text-gray-600">
                              Esempio: "Ti scrivo perché [uncino]"
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
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

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="idealState" className="text-sm font-medium">
                        Stato Ideale
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex gap-1 flex-wrap">
                              <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs hover:bg-orange-200">
                                {"{{5}}"} Opening
                              </Badge>
                              <Badge className="bg-green-100 text-green-700 border-green-300 text-xs hover:bg-green-200">
                                {"{{3}}"} Gentle/Value
                              </Badge>
                              <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs hover:bg-blue-200">
                                {"{{2}}"} Final
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs font-semibold mb-1">Mappato a variabili Twilio:</p>
                            <ul className="list-disc list-inside text-xs space-y-1">
                              <li><strong>{"{{5}}"}</strong> nel template <strong>Opening Message</strong></li>
                              <li><strong>{"{{3}}"}</strong> nei template <strong>Gentle</strong> e <strong>Value Follow-up</strong></li>
                              <li><strong>{"{{2}}"}</strong> nel template <strong>Final Follow-up</strong></li>
                            </ul>
                            <p className="text-xs mt-2 text-gray-600">
                              Questo è il campo più usato: presente in TUTTI i template follow-up.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea
                      id="idealState"
                      value={formData.idealState}
                      onChange={(e) => setFormData({ ...formData, idealState: e.target.value })}
                      placeholder="Es: Libertà finanziaria in 5 anni"
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Scheduling Section */}
              <div className="space-y-4 pt-2 border-t">
                <div className="flex items-center gap-2 pb-2">
                  <Calendar className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Programmazione Contatto
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-7">
                  <div className="space-y-3">
                    <Label htmlFor="contactSchedule" className="text-sm font-medium flex items-center gap-1">
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
                          targetTime.setMinutes(targetTime.getMinutes() + 15);
                          const formatted = format(targetTime, "yyyy-MM-dd'T'HH:mm");
                          setFormData({ ...formData, contactSchedule: formatted });
                        }}
                      >
                        Tra 15 min
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
                          const targetTime = new Date();
                          targetTime.setHours(targetTime.getHours() + 2);
                          const formatted = format(targetTime, "yyyy-MM-dd'T'HH:mm");
                          setFormData({ ...formData, contactSchedule: formatted });
                        }}
                      >
                        Tra 2 ore
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
                      min={getMinDateTime()}
                      className={formErrors.contactSchedule ? "border-red-500" : ""}
                    />
                    {formErrors.contactSchedule && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.contactSchedule}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="contactFrequency" className="text-sm font-medium">
                      Frequenza Follow-up
                    </Label>
                    <Select
                      value={formData.contactFrequency.toString()}
                      onValueChange={(value) =>
                        setFormData({ ...formData, contactFrequency: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Ogni giorno</SelectItem>
                        <SelectItem value="3">Ogni 3 giorni</SelectItem>
                        <SelectItem value="7">Ogni 7 giorni</SelectItem>
                        <SelectItem value="14">Ogni 14 giorni</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Il sistema invierà automaticamente follow-up con questa frequenza
                    </p>
                  </div>
                </div>
              </div>
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
                    <li><strong>Campi opzionali:</strong> Data Contatto, Stato Ideale, Obiettivi, Desideri, Uncino</li>
                    <li><strong>Formato telefono:</strong> +39 seguito dal numero (es: +393331234567)</li>
                    <li><strong>Formato data:</strong> YYYY-MM-DD o data ISO (es: 2025-11-15 oppure 2025-11-15T10:00:00)</li>
                    <li><strong>Intestazioni accettate:</strong> nome/Nome/firstName, cognome/Cognome/lastName, telefono/Telefono/phone</li>
                    <li>💡 <strong>Non preoccuparti dell'ordine o nomi esatti delle colonne - ti aiuterò a mapparle!</strong></li>
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
                    <h4 className="font-semibold text-gray-900">
                      Anteprima ({csvData.length} lead)
                    </h4>
                    <Button
                      onClick={() => {
                        setCsvData([]);
                        const input = document.getElementById('csv-upload') as HTMLInputElement;
                        if (input) input.value = '';
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      Cancella
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Nome</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Cognome</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Telefono</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Stato Ideale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.slice(0, 10).map((row: any, index) => (
                            <tr key={index} className="border-t hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-600">{index + 1}</td>
                              <td className="px-3 py-2">{row.nome || row.Nome || row.firstName || '-'}</td>
                              <td className="px-3 py-2">{row.cognome || row.Cognome || row.lastName || '-'}</td>
                              <td className="px-3 py-2 font-mono text-xs">
                                {row.telefono || row.Telefono || row.phone || '-'}
                              </td>
                              <td className="px-3 py-2 text-xs">{row.stato_ideale || row.idealState || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvData.length > 10 && (
                      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600 border-t">
                        Mostrando 10 di {csvData.length} lead...
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
    </div>
  );
}