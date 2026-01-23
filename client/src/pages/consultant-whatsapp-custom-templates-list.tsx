
import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAuthHeaders } from "@/lib/auth";
import { useLocation } from "wouter";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  Plus,
  Edit,
  History,
  MoreVertical,
  Eye,
  Copy,
  RotateCcw,
  Trash,
  Loader2,
  FileText,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ExternalLink,
  PenSquare,
  Search,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ArrowUpDown,
  RefreshCw,
  Zap,
  Heart,
  Users,
  Headphones,
  ShoppingCart,
  Target,
  Wrench,
  UserPlus,
  TrendingUp,
  Bell,
  Cloud,
  Download,
  Layers,
  Star,
  Rocket,
  CalendarCheck,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Agent type configuration for default templates
const AGENT_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; gradient: string }> = {
  receptionist: { label: "📞 Receptionist", icon: "📞", color: "bg-blue-500", gradient: "from-blue-500 to-cyan-500" },
  proactive_setter: { label: "🎯 Setter", icon: "🎯", color: "bg-orange-500", gradient: "from-orange-500 to-red-500" },
  informative_advisor: { label: "📚 Consulente Educativo", icon: "📚", color: "bg-purple-500", gradient: "from-purple-500 to-indigo-500" },
  customer_success: { label: "❤️ Customer Success", icon: "❤️", color: "bg-pink-500", gradient: "from-pink-500 to-rose-500" },
  intake_coordinator: { label: "📋 Intake Coordinator", icon: "📋", color: "bg-green-500", gradient: "from-green-500 to-emerald-500" },
};

type FilterMode = "category" | "agent";

interface TemplateVersion {
  id: string;
  versionNumber: number;
  bodyText: string;
  twilioContentSid: string | null;
  twilioStatus: "draft" | "pending_approval" | "approved" | "rejected" | null;
  isActive: boolean;
  createdAt: Date;
}

interface CustomTemplate {
  id: string;
  consultantId: string;
  templateName: string;
  templateType: "opening" | "followup_gentle" | "followup_value" | "followup_final" | "stalled" | "customer_success" | "reactivation" | "customer_care" | "venditori" | "setter" | "assistenza" | "onboarding" | "upsell" | "reminder";
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  activeVersion: TemplateVersion | null;
}

type SortOption = "newest" | "oldest" | "name_asc" | "name_desc";
type ViewMode = "grid" | "list";

const ITEMS_PER_PAGE = 30;

const CATEGORY_CONFIG: Record<string, { label: string; color: string; gradient: string; icon: string; lucideIcon?: any }> = {
  all: {
    label: "Tutti",
    color: "bg-slate-500",
    gradient: "from-slate-500 to-slate-600",
    icon: "📋",
    lucideIcon: Sparkles,
  },
  opening: {
    label: "Apertura",
    color: "bg-blue-500",
    gradient: "from-blue-500 to-cyan-500",
    icon: "👋",
  },
  followup_gentle: {
    label: "Follow-up",
    color: "bg-purple-500",
    gradient: "from-purple-500 to-pink-500",
    icon: "💬",
  },
  followup_value: {
    label: "Follow-up Valore",
    color: "bg-amber-500",
    gradient: "from-amber-500 to-orange-500",
    icon: "💎",
  },
  followup_final: {
    label: "Follow-up Finale",
    color: "bg-red-500",
    gradient: "from-red-500 to-rose-500",
    icon: "⚡",
  },
  stalled: {
    label: "Bloccati",
    color: "bg-orange-500",
    gradient: "from-orange-500 to-amber-500",
    icon: "⏸️",
    lucideIcon: Clock,
  },
  customer_success: {
    label: "Post-vendita",
    color: "bg-green-500",
    gradient: "from-green-500 to-emerald-500",
    icon: "🎯",
    lucideIcon: Heart,
  },
  reactivation: {
    label: "Riattivazione",
    color: "bg-indigo-500",
    gradient: "from-indigo-500 to-violet-500",
    icon: "🔄",
    lucideIcon: RefreshCw,
  },
  customer_care: {
    label: "Assistenza Clienti",
    color: "bg-teal-500",
    gradient: "from-teal-500 to-cyan-500",
    icon: "🎧",
    lucideIcon: Headphones,
  },
  venditori: {
    label: "Venditori",
    color: "bg-emerald-500",
    gradient: "from-emerald-500 to-green-500",
    icon: "💼",
    lucideIcon: ShoppingCart,
  },
  setter: {
    label: "Setter",
    color: "bg-sky-500",
    gradient: "from-sky-500 to-blue-500",
    icon: "🎯",
    lucideIcon: Target,
  },
  assistenza: {
    label: "Supporto Tecnico",
    color: "bg-slate-600",
    gradient: "from-slate-600 to-gray-600",
    icon: "🔧",
    lucideIcon: Wrench,
  },
  onboarding: {
    label: "Onboarding",
    color: "bg-violet-500",
    gradient: "from-violet-500 to-purple-500",
    icon: "🚀",
    lucideIcon: UserPlus,
  },
  upsell: {
    label: "Upsell",
    color: "bg-rose-500",
    gradient: "from-rose-500 to-pink-500",
    icon: "📈",
    lucideIcon: TrendingUp,
  },
  reminder: {
    label: "Promemoria",
    color: "bg-yellow-500",
    gradient: "from-yellow-500 to-amber-500",
    icon: "🔔",
    lucideIcon: Bell,
  },
};

const getTypeLabel = (type: string) => {
  return CATEGORY_CONFIG[type]?.label || type;
};

const getTypeConfig = (type: string) => {
  return CATEGORY_CONFIG[type] || CATEGORY_CONFIG.opening;
};

const getTwilioStatusConfig = (status: string | null) => {
  const configs: Record<string, { label: string; color: string; icon: any }> = {
    draft: {
      label: "Bozza",
      color: "bg-gray-100 text-gray-700 border-gray-200",
      icon: Clock,
    },
    pending_approval: {
      label: "In Attesa",
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: AlertTriangle,
    },
    approved: {
      label: "Approvato",
      color: "bg-green-100 text-green-700 border-green-200",
      icon: CheckCircle2,
    },
    rejected: {
      label: "Rifiutato",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: XCircle,
    },
    not_synced: {
      label: "Non Sincronizzato",
      color: "bg-gray-100 text-gray-700 border-gray-200",
      icon: AlertCircle,
    },
  };
  return configs[status || "not_synced"] || configs.draft;
};

export default function ConsultantWhatsAppCustomTemplatesList() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [currentPage, setCurrentPage] = useState(1);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [templateToExport, setTemplateToExport] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [syncAgentDialogOpen, setSyncAgentDialogOpen] = useState(false);
  const [syncSelectedAgentId, setSyncSelectedAgentId] = useState<string>("");
  const [twilioTemplatesDialogOpen, setTwilioTemplatesDialogOpen] = useState(false);
  const [twilioTemplatesData, setTwilioTemplatesData] = useState<any>(null);
  const [fetchTwilioAgentId, setFetchTwilioAgentId] = useState<string>("");
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  const [hasAutoFetchedTwilio, setHasAutoFetchedTwilio] = useState(false);
  const [twilioSectionOpen, setTwilioSectionOpen] = useState(true);
  const [approvedSectionOpen, setApprovedSectionOpen] = useState(true);
  const [pendingSectionOpen, setPendingSectionOpen] = useState(true);
  const [rejectedSectionOpen, setRejectedSectionOpen] = useState(true);
  const [staleSectionOpen, setStaleSectionOpen] = useState(true);
  const [localDraftsSectionOpen, setLocalDraftsSectionOpen] = useState(true);
  const [twilioOnlySectionOpen, setTwilioOnlySectionOpen] = useState(true);
  const [twilioRemoteSectionOpen, setTwilioRemoteSectionOpen] = useState(true);

  // NEW: Filter mode (category vs agent) and selected agent type
  const [filterMode, setFilterMode] = useState<FilterMode>("category");
  const [selectedAgentType, setSelectedAgentType] = useState<string>("receptionist");

  // Credential sync dialog state
  const [syncCredentialsDialogOpen, setSyncCredentialsDialogOpen] = useState(false);
  const [credentialSyncAgentId, setCredentialSyncAgentId] = useState<string>("");

  // Query for default templates availability
  const { data: defaultTemplatesData } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates/default-templates"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates/default-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Mutation to load default templates for an agent type
  const loadDefaultsMutation = useMutation({
    mutationFn: async (agentType: string) => {
      const response = await fetch(`/api/whatsapp/custom-templates/load-defaults/${agentType}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load defaults");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Template Caricati",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates/default-templates"] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to import the optimized opening message template
  const importOpeningMessageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates/import-opening-message", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import opening message");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🚀 Messaggio di Apertura Importato!",
        description: data.message || "Il template è pronto per essere esportato su Twilio.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to import the booking notification template
  const importBookingTemplateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates/import-booking-notification", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import booking notification template");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "📅 Template Notifica Booking Importato!",
        description: data.message || "Il template è pronto per le notifiche appuntamento.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to import the 10 weekly check-in templates
  const importCheckinTemplatesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates/import-checkin-templates", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import check-in templates");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "📋 Template Check-in Importati!",
        description: data.message || "10 template per check-in settimanale pronti per l'uso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: templatesData, isLoading, error } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch custom templates");
      }
      return response.json();
    },
  });

  const templates: CustomTemplate[] = templatesData?.data || [];

  const { data: agentsData, isFetched: agentsFetched } = useQuery({
    queryKey: ["/api/whatsapp/config"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config", {
        headers: getAuthHeaders()
      });
      if (!response.ok) return { configs: [] };
      return response.json();
    }
  });
  const agents = agentsData?.configs || [];

  const { data: agentsByAccountData, refetch: refetchAgentsByAccount } = useQuery({
    queryKey: ["/api/whatsapp/agents-by-account"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/agents-by-account", {
        headers: getAuthHeaders()
      });
      if (!response.ok) return null;
      return response.json();
    }
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, sortBy]);

  const stats = useMemo(() => {
    return {
      total: templates.length,
      opening: templates.filter((t) => t.templateType === "opening").length,
      followup_gentle: templates.filter((t) => t.templateType === "followup_gentle").length,
      followup_value: templates.filter((t) => t.templateType === "followup_value").length,
      followup_final: templates.filter((t) => t.templateType === "followup_final").length,
      stalled: templates.filter((t) => t.templateType === "stalled").length,
      customer_success: templates.filter((t) => t.templateType === "customer_success").length,
      reactivation: templates.filter((t) => t.templateType === "reactivation").length,
      customer_care: templates.filter((t) => t.templateType === "customer_care").length,
      venditori: templates.filter((t) => t.templateType === "venditori").length,
      setter: templates.filter((t) => t.templateType === "setter").length,
      assistenza: templates.filter((t) => t.templateType === "assistenza").length,
      onboarding: templates.filter((t) => t.templateType === "onboarding").length,
      upsell: templates.filter((t) => t.templateType === "upsell").length,
      reminder: templates.filter((t) => t.templateType === "reminder").length,
      approved: templates.filter((t) => t.activeVersion?.twilioStatus === "approved").length,
      pending: templates.filter((t) => t.activeVersion?.twilioStatus === "pending_approval").length,
      archived: templates.filter((t) => t.archivedAt).length,
    };
  }, [templates]);

  const filteredAndSortedTemplates = useMemo(() => {
    let result = [...templates];

    // Filter by category when in category mode
    if (filterMode === "category" && selectedCategory !== "all") {
      result = result.filter((t) => t.templateType === selectedCategory);
    }

    // Filter by agent type when in agent mode
    if (filterMode === "agent") {
      result = result.filter((t: any) => t.targetAgentType === selectedAgentType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((t) =>
        t.templateName.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name_asc":
          return a.templateName.localeCompare(b.templateName);
        case "name_desc":
          return b.templateName.localeCompare(a.templateName);
        default:
          return 0;
      }
    });

    return result;
  }, [templates, filterMode, selectedCategory, selectedAgentType, searchQuery, sortBy]);

  const groupedTemplates = useMemo(() => {
    // Normalize template name for matching: lowercase, remove spaces/underscores/dashes, strip explicit version suffixes
    const normalizeName = (name: string | null | undefined): string => {
      if (!name) return '';
      return name
        .toLowerCase()
        .replace(/[_\s-]+/g, '')       // Remove spaces, underscores, dashes
        .replace(/v\d+$/i, '');        // Remove only version suffix at end like v1, v2
    };

    // De-duplicate templates by twilioContentSid or normalized name
    const seenSids = new Set<string>();
    const seenNormalizedNames = new Set<string>();
    
    const deduplicatedTemplates = filteredAndSortedTemplates.filter(t => {
      const sid = t.activeVersion?.twilioContentSid;
      const normalizedName = normalizeName(t.templateName);
      
      // If has SID, check SID uniqueness
      if (sid) {
        if (seenSids.has(sid)) return false;
        seenSids.add(sid);
        seenNormalizedNames.add(normalizedName); // Also track name for cross-matching
        return true;
      }
      
      // For templates without SID, check normalized name wasn't already seen (from a SID-based template)
      if (normalizedName && seenNormalizedNames.has(normalizedName)) return false;
      seenNormalizedNames.add(normalizedName);
      return true;
    });

    // Find opening template for highlighting (but keep it in its category)
    const openingTemplate = deduplicatedTemplates.find(t => t.templateType === 'opening');
    
    // Separate by Twilio status - opening template stays in its appropriate category
    const localDraftsRaw = deduplicatedTemplates.filter(t => !t.activeVersion?.twilioContentSid);
    const onTwilio = deduplicatedTemplates.filter(t => !!t.activeVersion?.twilioContentSid);
    
    // Sort localDrafts to put opening template first
    const localDrafts = localDraftsRaw.sort((a, b) => {
      if (a.templateType === 'opening') return -1;
      if (b.templateType === 'opening') return 1;
      return 0;
    });
    
    const approved = onTwilio.filter(t => t.activeVersion?.twilioStatus === 'approved');
    const pending = onTwilio.filter(t => t.activeVersion?.twilioStatus === 'pending_approval');
    const rejected = onTwilio.filter(t => t.activeVersion?.twilioStatus === 'rejected');
    const stale = onTwilio.filter(t => t.activeVersion?.twilioStatus === 'draft' || t.activeVersion?.twilioStatus === 'not_synced');
    return { openingTemplate, localDrafts, onTwilio, approved, pending, rejected, stale };
  }, [filteredAndSortedTemplates]);

  useEffect(() => {
    if (!hasAutoSynced && agents.length > 0 && templates.length > 0) {
      // Check only for twilioAccountSid - twilioAuthToken is not returned by the API for security
      const agentWithTwilio = agents.find((a: any) => a.twilioAccountSid);
      if (agentWithTwilio) {
        syncTwilioMutation.mutate(agentWithTwilio.id);
        setHasAutoSynced(true);
      }
    }
  }, [agents, templates, hasAutoSynced]);

  useEffect(() => {
    console.log("[TWILIO AUTO-FETCH] Check:", {
      hasAutoFetchedTwilio,
      agentsFetched,
      agentsCount: agents.length,
      agents: agents.map((a: any) => ({ id: a.id, name: a.agentName, hasTwilioSid: !!a.twilioAccountSid }))
    });
    if (!hasAutoFetchedTwilio && agentsFetched && agents.length > 0) {
      // Check only for twilioAccountSid - twilioAuthToken is not returned by the API for security
      const agentWithTwilio = agents.find((a: any) => a.twilioAccountSid);
      console.log("[TWILIO AUTO-FETCH] Found agent with Twilio:", agentWithTwilio?.agentName || "NONE");
      if (agentWithTwilio) {
        console.log("[TWILIO AUTO-FETCH] Starting auto-fetch for agent:", agentWithTwilio.agentName);
        fetchTwilioTemplatesMutation.mutate(agentWithTwilio.id);
        setHasAutoFetchedTwilio(true);
      }
    }
  }, [agents, hasAutoFetchedTwilio, agentsFetched]);

  const totalPages = Math.ceil(filteredAndSortedTemplates.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredAndSortedTemplates.length);
  const paginatedTemplates = filteredAndSortedTemplates.slice(startIndex, endIndex);

  const archiveMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/whatsapp/custom-templates/${templateId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to archive template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
      toast({
        title: "✅ Template Archiviato",
        description: "Il template è stato archiviato con successo.",
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

  const restoreMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/whatsapp/custom-templates/${templateId}/restore`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to restore template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
      toast({
        title: "✅ Template Ripristinato",
        description: "Il template è stato ripristinato con successo.",
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

  const exportMutation = useMutation({
    mutationFn: async ({ templateId, agentConfigId }: { templateId: string; agentConfigId: string }) => {
      const response = await fetch(`/api/whatsapp/custom-templates/${templateId}/export-twilio`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ agentConfigId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to export template to Twilio");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
      toast({
        title: "✅ Template Esportato",
        description: data.message || "Il template è stato inviato a Twilio per l'approvazione Meta.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore Export",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncTwilioMutation = useMutation({
    mutationFn: async (agentConfigId: string) => {
      const response = await fetch("/api/whatsapp/custom-templates/sync-twilio-status", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ agentConfigId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to sync Twilio status");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/custom-templates"] });
      setSyncAgentDialogOpen(false);
      toast({
        title: "✅ Sincronizzazione Completata",
        description: data.message || `${data.updated} template aggiornati`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore Sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyCredentialsMutation = useMutation({
    mutationFn: async (agentConfigId: string) => {
      const response = await fetch("/api/whatsapp/custom-templates/verify-agent-credentials", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ agentConfigId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify credentials");
      }
      return response.json();
    },
  });

  const syncCredentialsMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const response = await fetch(`/api/whatsapp/sync-credentials/${agentId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync credentials");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Credenziali Sincronizzate",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/agents-by-account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      setSyncCredentialsDialogOpen(false);
      setCredentialSyncAgentId("");
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore Sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const fetchTwilioTemplatesMutation = useMutation({
    mutationFn: async (agentConfigId: string) => {
      const response = await fetch("/api/whatsapp/custom-templates/fetch-from-twilio", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ agentConfigId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch Twilio templates");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setTwilioTemplatesData(data);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFetchTwilioTemplates = () => {
    if (agents.length === 0) {
      toast({
        title: "❌ Errore",
        description: "Configura prima un agente WhatsApp nella sezione Agenti",
        variant: "destructive"
      });
      return;
    }
    if (agents.length === 1) {
      fetchTwilioTemplatesMutation.mutate(agents[0].id);
    } else {
      setFetchTwilioAgentId(agents[0].id);
      setTwilioTemplatesDialogOpen(true);
    }
  };

  const handleEdit = (templateId: string) => {
    navigate(`/consultant/whatsapp/custom-templates?id=${templateId}`);
  };

  const handleViewVersions = (templateId: string) => {
    toast({
      title: "🚧 In Sviluppo",
      description: "La pagina delle versioni sarà disponibile presto.",
    });
  };

  const handlePreview = (templateId: string) => {
    toast({
      title: "🚧 In Sviluppo",
      description: "L'anteprima sarà disponibile presto.",
    });
  };

  const handleDuplicate = (templateId: string) => {
    toast({
      title: "🚧 In Sviluppo",
      description: "La funzione di duplicazione sarà disponibile presto.",
    });
  };

  const handleArchive = (templateId: string) => {
    archiveMutation.mutate(templateId);
  };

  const handleRestore = (templateId: string) => {
    restoreMutation.mutate(templateId);
  };

  const handleExportToTwilio = async (templateId: string) => {
    if (agents.length === 0) {
      toast({
        title: "❌ Errore",
        description: "Configura prima un agente WhatsApp nella sezione Agenti",
        variant: "destructive"
      });
      return;
    }
    if (agents.length === 1) {
      try {
        const credentials = await verifyCredentialsMutation.mutateAsync(agents[0].id);
        if (!credentials.valid) {
          toast({
            title: "❌ Credenziali Mancanti",
            description: credentials.message || "Configura le credenziali Twilio per questo agente",
            variant: "destructive"
          });
          return;
        }
        exportMutation.mutate({ templateId, agentConfigId: agents[0].id });
      } catch (error: any) {
        toast({
          title: "❌ Errore",
          description: error.message || "Impossibile verificare le credenziali",
          variant: "destructive"
        });
      }
    } else {
      setTemplateToExport(templateId);
      setSelectedAgentId(agents[0].id);
      setExportDialogOpen(true);
    }
  };

  const handleSyncTwilioStatus = () => {
    if (agents.length === 0) {
      toast({
        title: "❌ Errore",
        description: "Configura prima un agente WhatsApp nella sezione Agenti",
        variant: "destructive"
      });
      return;
    }
    if (agents.length === 1) {
      syncTwilioMutation.mutate(agents[0].id);
    } else {
      setSyncSelectedAgentId(agents[0].id);
      setSyncAgentDialogOpen(true);
    }
  };

  const handleExportWithVerification = async () => {
    if (!selectedAgentId || !templateToExport) return;

    try {
      const credentials = await verifyCredentialsMutation.mutateAsync(selectedAgentId);
      if (!credentials.valid) {
        toast({
          title: "❌ Credenziali Mancanti",
          description: credentials.message || "Configura le credenziali Twilio per questo agente",
          variant: "destructive"
        });
        return;
      }
      exportMutation.mutate({ templateId: templateToExport, agentConfigId: selectedAgentId });
      setExportDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "❌ Errore",
        description: error.message || "Impossibile verificare le credenziali",
        variant: "destructive"
      });
    }
  };

  const showEmptyState = !isLoading && templates.length === 0;
  const showNoResults = !isLoading && templates.length > 0 && filteredAndSortedTemplates.length === 0;

  const categories = [
    "all",
    "opening",
    "followup_gentle",
    "stalled",
    "customer_success",
    "reactivation",
    "customer_care",
    "venditori",
    "setter",
    "assistenza",
    "onboarding",
    "upsell",
    "reminder"
  ];

  const getCategoryCount = (cat: string) => {
    if (cat === "all") return stats.total;
    return stats[cat as keyof typeof stats] || 0;
  };

  const renderTemplateCard = (template: CustomTemplate) => {
    const typeConfig = getTypeConfig(template.templateType);
    const statusConfig = getTwilioStatusConfig(template.activeVersion?.twilioStatus || null);
    const StatusIcon = statusConfig.icon;
    const isOpeningTemplate = template.templateType === 'opening';

    return (
      <Card
        key={template.id}
        className={`group relative overflow-hidden border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 animate-in fade-in-50 ${
          isOpeningTemplate 
            ? "border-amber-400 bg-gradient-to-br from-amber-50/80 via-yellow-50/50 to-orange-50/30 shadow-lg ring-2 ring-amber-200/50 col-span-full sm:col-span-2" 
            : ""
        } ${template.archivedAt ? "opacity-60 hover:opacity-100" : ""}`}
      >
        {/* Special badge for opening template */}
        {isOpeningTemplate && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-md text-xs font-semibold">
              <Star className="h-3 w-3 mr-1 fill-white" />
              PRIMO MESSAGGIO
            </Badge>
          </div>
        )}
        <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${isOpeningTemplate ? 'from-amber-400 via-yellow-400 to-orange-400' : typeConfig.gradient}`} />

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeConfig.gradient} flex items-center justify-center text-2xl flex-shrink-0 shadow-lg`}>
                {typeConfig.icon}
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base font-semibold group-hover:text-purple-600 transition-colors leading-tight">
                  {template.templateName}
                </CardTitle>
                <CardDescription className="line-clamp-2 text-xs mt-1">
                  {template.description || template.useCase || "Nessuna descrizione"}
                </CardDescription>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handlePreview(template.id)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Anteprima
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplica
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleExportToTwilio(template.id)}
                  disabled={!template.activeVersion || exportMutation.isPending || (!!template.activeVersion?.twilioContentSid && template.activeVersion?.twilioStatus !== 'draft' && template.activeVersion?.twilioStatus !== 'not_synced')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {template.activeVersion?.twilioContentSid && template.activeVersion?.twilioStatus !== 'draft' && template.activeVersion?.twilioStatus !== 'not_synced'
                    ? "Già su Twilio"
                    : template.activeVersion?.twilioContentSid && (template.activeVersion?.twilioStatus === 'draft' || template.activeVersion?.twilioStatus === 'not_synced')
                      ? "Ri-esporta a Twilio"
                      : exportMutation.isPending
                        ? "Esportazione..."
                        : "Esporta a Twilio"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {template.archivedAt ? (
                  <DropdownMenuItem onClick={() => handleRestore(template.id)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Ripristina
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleArchive(template.id)}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Archivia
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className={`${typeConfig.color} text-white border-0 shadow-sm`}>
              {getTypeLabel(template.templateType)}
            </Badge>
            {template.useCase && (
              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                {template.useCase}
              </Badge>
            )}
            {template.archivedAt && (
              <Badge variant="secondary" className="border">
                Archiviato
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {template.activeVersion ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Versione v{template.activeVersion.versionNumber}</span>
                <Badge variant="outline" className={`${statusConfig.color} border text-xs`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>

              {template.activeVersion.twilioContentSid ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Su Twilio</span>
                  </div>
                  <div className="mt-1.5 text-xs text-green-600 font-mono bg-green-100/50 px-2 py-1 rounded truncate">
                    SID: {template.activeVersion.twilioContentSid}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Non su Twilio</span>
                  </div>
                  <p className="text-xs text-amber-600 mt-1">
                    Esporta questo template per usarlo su WhatsApp Business
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-sm bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 rounded-lg border border-slate-200/60 font-mono text-slate-700 leading-relaxed min-h-[100px] max-h-[180px] overflow-y-auto break-words whitespace-pre-wrap">
                  {template.activeVersion.bodyText.split(/(\{[a-zA-Z0-9_]+\})/).map((part, idx) => {
                    if (part.match(/^\{[a-zA-Z0-9_]+\}$/)) {
                      return (
                        <span key={idx} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                          {part}
                        </span>
                      );
                    }
                    return <span key={idx}>{part}</span>;
                  })}
                </div>
                <div className="flex justify-end">
                  <span className="text-xs text-slate-400">
                    {template.activeVersion.bodyText.length} caratteri
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => handleEdit(template.id)}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewVersions(template.id)}
                  className="flex-1 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                >
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  Versioni
                </Button>
              </div>
            </div>
          ) : (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Nessuna versione attiva
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderTemplateRow = (template: CustomTemplate) => {
    const typeConfig = getTypeConfig(template.templateType);
    const statusConfig = getTwilioStatusConfig(template.activeVersion?.twilioStatus || null);
    const StatusIcon = statusConfig.icon;

    return (
      <TableRow key={template.id} className={`animate-in fade-in-50 ${template.archivedAt ? "opacity-60" : ""}`}>
        <TableCell>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${typeConfig.gradient} flex items-center justify-center text-lg flex-shrink-0`}>
              {typeConfig.icon}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{template.templateName}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {template.description || "Nessuna descrizione"}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`${typeConfig.color} text-white border-0 shadow-sm`}>
            {getTypeLabel(template.templateType)}
          </Badge>
        </TableCell>
        <TableCell>
          {template.activeVersion ? (
            <Badge variant="outline" className={`${statusConfig.color} border text-xs`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {new Date(template.createdAt).toLocaleDateString('it-IT')}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => handleEdit(template.id)}>
              <Edit className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handlePreview(template.id)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Anteprima
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplica
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleExportToTwilio(template.id)}
                  disabled={!template.activeVersion || exportMutation.isPending}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Esporta a Twilio
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {template.archivedAt ? (
                  <DropdownMenuItem onClick={() => handleRestore(template.id)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Ripristina
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="text-destructive" onClick={() => handleArchive(template.id)}>
                    <Trash className="h-4 w-4 mr-2" />
                    Archivia
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-white rounded-xl border shadow-sm">
        <p className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium">{startIndex + 1}</span>-<span className="font-medium">{endIndex}</span> di <span className="font-medium">{filteredAndSortedTemplates.length}</span> template
        </p>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="hidden sm:flex"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Precedente</span>
          </Button>

          <div className="flex items-center gap-1 mx-2">
            {pageNumbers.map(page => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 p-0 ${currentPage === page ? "bg-gradient-to-r from-blue-600 to-purple-600" : ""}`}
              >
                {page}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            <span className="hidden sm:inline mr-1">Successiva</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="hidden sm:flex"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6 max-w-7xl">
            <NavigationTabs
              tabs={[
                { label: "Template Twilio", href: "/consultant/whatsapp-templates", icon: FileText },
                { label: "Template Personalizzati", href: "/consultant/whatsapp/custom-templates/list", icon: PenSquare },
              ]}
              className="mb-6"
            />

            <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 p-6 text-white shadow-2xl">
              <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
              <div className="relative z-10">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <MessageSquare className="h-7 w-7" />
                    </div>
                    <div>
                      <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Template Custom WhatsApp</h1>
                      <p className="text-blue-100 text-sm mt-1">
                        Gestisci i tuoi template personalizzati per WhatsApp Business
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4 lg:mt-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => importOpeningMessageMutation.mutate()}
                            size="sm"
                            variant="outline"
                            disabled={importOpeningMessageMutation.isPending}
                            className="bg-amber-500/20 border-amber-300/50 text-white hover:bg-amber-500/30"
                          >
                            {importOpeningMessageMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Star className="h-4 w-4 fill-amber-300" />
                            )}
                            <span className="hidden xl:inline ml-2">Benvenuto</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Aggiungi Template di Benvenuto</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => importBookingTemplateMutation.mutate()}
                            size="sm"
                            variant="outline"
                            disabled={importBookingTemplateMutation.isPending}
                            className="bg-green-500/20 border-green-300/50 text-white hover:bg-green-500/30"
                          >
                            {importBookingTemplateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Bell className="h-4 w-4" />
                            )}
                            <span className="hidden xl:inline ml-2">Booking</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Aggiungi Template Notifica Booking</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => importCheckinTemplatesMutation.mutate()}
                            size="sm"
                            variant="outline"
                            disabled={importCheckinTemplatesMutation.isPending}
                            className="bg-purple-500/20 border-purple-300/50 text-white hover:bg-purple-500/30"
                          >
                            {importCheckinTemplatesMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CalendarCheck className="h-4 w-4" />
                            )}
                            <span className="hidden xl:inline ml-2">Check-in</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Aggiungi 10 Template Check-in Settimanale</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleSyncTwilioStatus}
                            size="sm"
                            variant="outline"
                            disabled={syncTwilioMutation.isPending}
                            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                          >
                            {syncTwilioMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="hidden xl:inline ml-2">Sync Twilio</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Sincronizza Stato Twilio</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              refetchAgentsByAccount();
                              setSyncCredentialsDialogOpen(true);
                            }}
                            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                          >
                            <RefreshCw className="h-4 w-4" />
                            <span className="hidden xl:inline ml-2">Credenziali</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Sync Credenziali</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      onClick={() => navigate("/consultant/whatsapp/custom-templates")}
                      size="sm"
                      className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Nuovo</span>
                    </Button>
                  </div>
                </div>

                {!showEmptyState && (
                  <div className="flex flex-wrap gap-3 mt-5">
                    <TooltipProvider>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 backdrop-blur-sm">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium">{stats.total}</span>
                        <span className="text-xs text-blue-100">Totali</span>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/30 backdrop-blur-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">{stats.approved}</span>
                        <span className="text-xs text-green-100">Approvati</span>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/30 backdrop-blur-sm">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">{stats.pending}</span>
                        <span className="text-xs text-yellow-100">In Attesa</span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm cursor-help">
                            <Users className="h-4 w-4" />
                            <span className="text-xs">Per Categoria</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="p-3 max-w-xs">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                            <p>👋 Apertura: {stats.opening}</p>
                            <p>💬 Follow-up: {stats.followup_gentle}</p>
                            <p>⏸️ Bloccati: {stats.stalled}</p>
                            <p>🎯 Post-vendita: {stats.customer_success}</p>
                            <p>🔄 Riattivazione: {stats.reactivation}</p>
                            <p>🎧 Assistenza Clienti: {stats.customer_care}</p>
                            <p>💼 Venditori: {stats.venditori}</p>
                            <p>🎯 Setter: {stats.setter}</p>
                            <p>🔧 Supporto Tecnico: {stats.assistenza}</p>
                            <p>🚀 Onboarding: {stats.onboarding}</p>
                            <p>📈 Upsell: {stats.upsell}</p>
                            <p>🔔 Promemoria: {stats.reminder}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            </div>

            {!showEmptyState && (
              <div className="sticky top-0 z-20 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 pb-4 pt-2 -mt-2 space-y-4 mb-6">
                <div className="flex flex-wrap items-center gap-4 p-3 bg-white rounded-xl border shadow-sm">
                  <span className="text-xs font-semibold text-slate-600">Legenda Stati Twilio:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-gray-300" />
                    <span className="text-xs text-slate-600">Bozza (non inviato)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <span className="text-xs text-slate-600">In Attesa approvazione Meta</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-xs text-slate-600">Approvato da Meta</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-600">Rifiutato da Meta</span>
                  </div>
                </div>

                {/* Toggle between Category and Agent view */}
                <div className="flex items-center gap-2 p-3 bg-white rounded-xl border shadow-sm">
                  <span className="text-xs font-semibold text-slate-600 mr-2">Visualizza:</span>
                  <div className="flex items-center border-2 rounded-lg p-0.5">
                    <Button
                      variant={filterMode === "category" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setFilterMode("category")}
                      className="h-8 gap-1.5"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Per Categoria
                    </Button>
                    <Button
                      variant={filterMode === "agent" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setFilterMode("agent")}
                      className="h-8 gap-1.5"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Per Agente
                    </Button>
                  </div>
                </div>

                {/* Category filter (shown when filterMode === "category") */}
                {filterMode === "category" && (
                  <div className="flex flex-wrap gap-2 p-3 bg-white/80 backdrop-blur-sm rounded-xl border shadow-sm">
                    {categories.map((cat) => {
                      const config = CATEGORY_CONFIG[cat];
                      const count = getCategoryCount(cat);
                      const isSelected = selectedCategory === cat;

                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`
                            flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs
                            transition-all duration-200 border
                            ${isSelected
                              ? `bg-gradient-to-r ${config.gradient} text-white border-transparent shadow-md`
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                            }
                          `}
                        >
                          <span className="text-sm">{config.icon}</span>
                          <span className="hidden sm:inline">{config.label}</span>
                          <Badge
                            variant="secondary"
                            className={`text-xs px-1.5 py-0 ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-100'}`}
                          >
                            {count}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Agent filter (shown when filterMode === "agent") */}
                {filterMode === "agent" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 p-3 bg-white/80 backdrop-blur-sm rounded-xl border shadow-sm">
                      {Object.entries(AGENT_TYPE_CONFIG).map(([agentType, config]) => {
                        const isSelected = selectedAgentType === agentType;
                        const agentData = defaultTemplatesData?.data?.find((a: any) => a.agentType === agentType);
                        const loadedCount = agentData?.loadedCount || 0;
                        const totalCount = agentData?.totalTemplates || 20;

                        return (
                          <button
                            key={agentType}
                            onClick={() => setSelectedAgentType(agentType)}
                            className={`
                              flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs
                              transition-all duration-200 border
                              ${isSelected
                                ? `bg-gradient-to-r ${config.gradient} text-white border-transparent shadow-md`
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                              }
                            `}
                          >
                            <span className="text-sm">{config.icon}</span>
                            <span className="hidden sm:inline">{config.label.replace(/^.+?\s/, '')}</span>
                            <Badge
                              variant="secondary"
                              className={`text-xs px-1.5 py-0 ${isSelected ? 'bg-white/25 text-white' : loadedCount > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}
                            >
                              {loadedCount}/{totalCount}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>

                    {/* Load defaults button for selected agent */}
                    {(() => {
                      const agentData = defaultTemplatesData?.data?.find((a: any) => a.agentType === selectedAgentType);
                      const allLoaded = agentData?.allLoaded;
                      const config = AGENT_TYPE_CONFIG[selectedAgentType];

                      return (
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{config?.icon}</span>
                            <div>
                              <p className="font-medium text-sm">{config?.label}</p>
                              <p className="text-xs text-slate-500">
                                {allLoaded
                                  ? "Tutti i template predefiniti sono stati caricati"
                                  : `${agentData?.loadedCount || 0} di ${agentData?.totalTemplates || 20} template caricati`
                                }
                              </p>
                            </div>
                          </div>
                          {!allLoaded && (
                            <Button
                              onClick={() => loadDefaultsMutation.mutate(selectedAgentType)}
                              disabled={loadDefaultsMutation.isPending}
                              size="sm"
                              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                            >
                              {loadDefaultsMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4 mr-2" />
                              )}
                              Carica Template Predefiniti
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 bg-white/80 backdrop-blur-sm p-3 rounded-xl border shadow-sm">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca template per nome..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-2 focus-visible:ring-purple-500/20 h-9"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                      <SelectTrigger className="w-[160px] border-2 h-9">
                        <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Più recenti</SelectItem>
                        <SelectItem value="oldest">Meno recenti</SelectItem>
                        <SelectItem value="name_asc">Nome A-Z</SelectItem>
                        <SelectItem value="name_desc">Nome Z-A</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center border-2 rounded-lg p-0.5">
                      <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className="h-7 w-7 p-0"
                      >
                        <Grid3X3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className="h-7 w-7 p-0"
                      >
                        <List className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-12 w-12 animate-spin text-purple-600 mb-4" />
                <p className="text-sm text-muted-foreground">Caricamento template...</p>
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="shadow-lg">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Errore nel caricamento dei template: {error.message}
                </AlertDescription>
              </Alert>
            )}

            {showEmptyState && (
              <div className="py-12 bg-white rounded-2xl shadow-sm border animate-in fade-in-50">
                <div className="text-center mb-10">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold mb-3">Nessun Template Trovato</h2>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    Importa i template predefiniti per il tuo tipo di agente o crea il tuo primo template personalizzato.
                  </p>
                </div>

                {/* Pulsante Bonus - Messaggio di Apertura Ottimizzato */}
                <div className="max-w-2xl mx-auto px-6 mb-8">
                  <div className="relative p-6 rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300 shadow-lg">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-md px-4 py-1">
                        <Star className="h-3 w-3 mr-1 fill-white" />
                        CONSIGLIATO
                      </Badge>
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-amber-900 mb-2 mt-2">
                        Messaggio di Apertura Ottimizzato
                      </h3>
                      <p className="text-sm text-amber-700 mb-4">
                        Il primo messaggio che ricevono i tuoi lead. Ottimizzato per massimizzare le risposte!
                      </p>
                      <Button
                        onClick={() => importOpeningMessageMutation.mutate()}
                        disabled={importOpeningMessageMutation.isPending}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
                      >
                        {importOpeningMessageMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importazione...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4 mr-2" />
                            Importa Messaggio di Apertura
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 5 Pulsanti per i Tipi di Agente */}
                <div className="max-w-4xl mx-auto px-6">
                  <h3 className="text-center text-sm font-semibold text-slate-600 mb-4">
                    Oppure importa i template per tipo di agente:
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => loadDefaultsMutation.mutate("receptionist")}
                      disabled={loadDefaultsMutation.isPending}
                      className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-300"
                    >
                      <span className="text-2xl">📞</span>
                      <span className="text-xs font-medium">Receptionist</span>
                      <span className="text-[10px] text-muted-foreground">Inbound</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => loadDefaultsMutation.mutate("proactive_setter")}
                      disabled={loadDefaultsMutation.isPending}
                      className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-300"
                    >
                      <span className="text-2xl">🎯</span>
                      <span className="text-xs font-medium">Setter</span>
                      <span className="text-[10px] text-muted-foreground">Outbound</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => loadDefaultsMutation.mutate("informative_advisor")}
                      disabled={loadDefaultsMutation.isPending}
                      className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-green-50 hover:border-green-300"
                    >
                      <span className="text-2xl">📚</span>
                      <span className="text-xs font-medium">Advisor</span>
                      <span className="text-[10px] text-muted-foreground">Educativo</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => loadDefaultsMutation.mutate("customer_success")}
                      disabled={loadDefaultsMutation.isPending}
                      className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-red-50 hover:border-red-300"
                    >
                      <span className="text-2xl">❤️</span>
                      <span className="text-xs font-medium">Customer Success</span>
                      <span className="text-[10px] text-muted-foreground">Post-vendita</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => loadDefaultsMutation.mutate("intake_coordinator")}
                      disabled={loadDefaultsMutation.isPending}
                      className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-indigo-50 hover:border-indigo-300"
                    >
                      <span className="text-2xl">📋</span>
                      <span className="text-xs font-medium">Intake</span>
                      <span className="text-[10px] text-muted-foreground">Coordinatore</span>
                    </Button>
                  </div>
                  {loadDefaultsMutation.isPending && (
                    <div className="text-center mt-4">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      <span className="text-sm text-muted-foreground">Caricamento template...</span>
                    </div>
                  )}
                </div>

                {/* Separatore e pulsante crea manuale */}
                <div className="max-w-md mx-auto px-6 mt-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400">oppure</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/consultant/whatsapp/custom-templates")}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crea Template Manualmente
                  </Button>
                </div>
              </div>
            )}

            {showNoResults && (
              <div className="text-center py-20 bg-white rounded-2xl shadow-sm border animate-in fade-in-50">
                <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Nessun Risultato</h2>
                <p className="text-muted-foreground mb-6">
                  Nessun template corrisponde ai criteri di ricerca. Prova a modificare i filtri.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={() => setSearchQuery("")}>
                    Cancella Ricerca
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedCategory("all")}>
                    Mostra Tutti
                  </Button>
                </div>
              </div>
            )}

            {!isLoading && filteredAndSortedTemplates.length > 0 && (
              <div className="space-y-6">
                {/* Template presenti su Twilio - Mostrati per primi */}
                {twilioTemplatesData?.twilioTemplates && twilioTemplatesData.twilioTemplates.length > 0 && (
                  <Collapsible open={twilioRemoteSectionOpen} onOpenChange={setTwilioRemoteSectionOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl cursor-pointer hover:from-purple-600 hover:to-indigo-700 transition-colors shadow-lg">
                        <div className="flex items-center gap-3 text-white">
                          <Cloud className="h-6 w-6" />
                          <h2 className="text-lg font-bold">Template presenti su Twilio</h2>
                          <Badge className="bg-white/20 text-white border-0">
                            {twilioTemplatesData.twilioTemplates.length} template
                          </Badge>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-white transition-transform duration-200 ${twilioRemoteSectionOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {twilioTemplatesData.twilioTemplates.map((template: any) => {
                          const isApproved = template.approvalStatus === 'approved';
                          const isPending = template.approvalStatus === 'pending' || template.approvalStatus === 'received';
                          const isRejected = template.approvalStatus === 'rejected';

                          return (
                            <Card
                              key={template.sid}
                              className={`border-2 transition-colors ${isApproved ? 'border-green-200 hover:border-green-300' :
                                isPending ? 'border-yellow-200 hover:border-yellow-300' :
                                  isRejected ? 'border-red-200 hover:border-red-300' :
                                    'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-base truncate">
                                      {template.friendlyName}
                                    </CardTitle>
                                    <div className="text-xs text-muted-foreground mt-1 font-mono">
                                      SID: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{template.sid}</code>
                                    </div>
                                  </div>
                                  <Badge className={`text-xs text-white flex-shrink-0 ${isApproved ? 'bg-green-500' :
                                    isPending ? 'bg-yellow-500' :
                                      isRejected ? 'bg-red-500' :
                                        'bg-gray-500'
                                    }`}>
                                    {isApproved ? (
                                      <><CheckCircle2 className="h-3 w-3 mr-1" />Approvato</>
                                    ) : isPending ? (
                                      <><Clock className="h-3 w-3 mr-1" />In Attesa</>
                                    ) : isRejected ? (
                                      <><XCircle className="h-3 w-3 mr-1" />Rifiutato</>
                                    ) : (
                                      template.approvalStatus
                                    )}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                {template.bodyPreview && (
                                  <div className="bg-gradient-to-br from-slate-50 to-purple-50/30 p-3 rounded-lg border border-slate-200/60 text-sm text-slate-700 whitespace-pre-wrap max-h-[100px] overflow-hidden mb-3">
                                    {template.bodyPreview}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {template.linkedToLocal && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                      <Zap className="h-3 w-3 mr-1" />
                                      Collegato
                                    </Badge>
                                  )}
                                  {!isApproved && template.linkedToLocal && template.localTemplateId && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleExportToTwilio(template.localTemplateId)}
                                      disabled={exportMutation.isPending}
                                      className="text-xs h-7 bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                                    >
                                      {exportMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                      )}
                                      Invia per Approvazione
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {groupedTemplates.onTwilio.length > 0 && (
                  <Collapsible open={twilioSectionOpen} onOpenChange={setTwilioSectionOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl cursor-pointer hover:from-green-600 hover:to-emerald-700 transition-colors shadow-lg">
                        <div className="flex items-center gap-3 text-white">
                          <Cloud className="h-6 w-6" />
                          <h2 className="text-lg font-bold">Template Locali su Twilio</h2>
                          <Badge className="bg-white/20 text-white border-0">
                            {groupedTemplates.onTwilio.length} inviati
                          </Badge>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-white transition-transform duration-200 ${twilioSectionOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-4">
                      {groupedTemplates.approved.length > 0 && (
                        <Collapsible open={approvedSectionOpen} onOpenChange={setApprovedSectionOpen}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors">
                              <div className="flex items-center gap-2 text-green-700">
                                <CheckCircle2 className="h-5 w-5" />
                                <h3 className="font-semibold">Approvati</h3>
                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                  {groupedTemplates.approved.length}
                                </Badge>
                              </div>
                              <ChevronDown className={`h-4 w-4 text-green-600 transition-transform duration-200 ${approvedSectionOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-3">
                            {viewMode === "grid" ? (
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {groupedTemplates.approved.map(renderTemplateCard)}
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Template</TableHead>
                                      <TableHead>Categoria</TableHead>
                                      <TableHead>Stato</TableHead>
                                      <TableHead>Creato</TableHead>
                                      <TableHead className="w-[100px]">Azioni</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {groupedTemplates.approved.map(renderTemplateRow)}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {groupedTemplates.pending.length > 0 && (
                        <Collapsible open={pendingSectionOpen} onOpenChange={setPendingSectionOpen}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors">
                              <div className="flex items-center gap-2 text-yellow-700">
                                <Clock className="h-5 w-5" />
                                <h3 className="font-semibold">In Attesa</h3>
                                <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                                  {groupedTemplates.pending.length}
                                </Badge>
                              </div>
                              <ChevronDown className={`h-4 w-4 text-yellow-600 transition-transform duration-200 ${pendingSectionOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-3">
                            {viewMode === "grid" ? (
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {groupedTemplates.pending.map(renderTemplateCard)}
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Template</TableHead>
                                      <TableHead>Categoria</TableHead>
                                      <TableHead>Stato</TableHead>
                                      <TableHead>Creato</TableHead>
                                      <TableHead className="w-[100px]">Azioni</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {groupedTemplates.pending.map(renderTemplateRow)}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {groupedTemplates.rejected.length > 0 && (
                        <Collapsible open={rejectedSectionOpen} onOpenChange={setRejectedSectionOpen}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
                              <div className="flex items-center gap-2 text-red-700">
                                <XCircle className="h-5 w-5" />
                                <h3 className="font-semibold">Rifiutati</h3>
                                <Badge className="bg-red-100 text-red-700 border-red-200">
                                  {groupedTemplates.rejected.length}
                                </Badge>
                              </div>
                              <ChevronDown className={`h-4 w-4 text-red-600 transition-transform duration-200 ${rejectedSectionOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-3">
                            {viewMode === "grid" ? (
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {groupedTemplates.rejected.map(renderTemplateCard)}
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Template</TableHead>
                                      <TableHead>Categoria</TableHead>
                                      <TableHead>Stato</TableHead>
                                      <TableHead>Creato</TableHead>
                                      <TableHead className="w-[100px]">Azioni</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {groupedTemplates.rejected.map(renderTemplateRow)}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {groupedTemplates.stale.length > 0 && (
                        <Collapsible open={staleSectionOpen} onOpenChange={setStaleSectionOpen}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
                              <div className="flex items-center gap-2 text-amber-700">
                                <RefreshCw className="h-5 w-5" />
                                <h3 className="font-semibold">Da Ri-esportare</h3>
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                  {groupedTemplates.stale.length}
                                </Badge>
                              </div>
                              <ChevronDown className={`h-4 w-4 text-amber-600 transition-transform duration-200 ${staleSectionOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-3">
                            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                              Questi template devono essere ri-esportati su Twilio. Clicca "Esporta a Twilio" per inviarli al nuovo account.
                            </div>
                            {viewMode === "grid" ? (
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {groupedTemplates.stale.map(renderTemplateCard)}
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Template</TableHead>
                                      <TableHead>Categoria</TableHead>
                                      <TableHead>Stato</TableHead>
                                      <TableHead>Creato</TableHead>
                                      <TableHead className="w-[100px]">Azioni</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {groupedTemplates.stale.map(renderTemplateRow)}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {groupedTemplates.localDrafts.length > 0 && (
                  <Collapsible open={localDraftsSectionOpen} onOpenChange={setLocalDraftsSectionOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-500 to-slate-600 rounded-xl cursor-pointer hover:from-slate-600 hover:to-slate-700 transition-colors shadow-lg">
                        <div className="flex items-center gap-3 text-white">
                          <FileText className="h-6 w-6" />
                          <h2 className="text-lg font-bold">Bozze Locali</h2>
                          <Badge className="bg-white/20 text-white border-0">
                            {groupedTemplates.localDrafts.length} template
                          </Badge>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-white transition-transform duration-200 ${localDraftsSectionOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4">
                      {viewMode === "grid" ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {groupedTemplates.localDrafts.map(renderTemplateCard)}
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Template</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Stato</TableHead>
                                <TableHead>Creato</TableHead>
                                <TableHead className="w-[100px]">Azioni</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {groupedTemplates.localDrafts.map(renderTemplateRow)}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {(() => {
                  const twilioOnlyTemplates = twilioTemplatesData?.twilioTemplates?.filter(
                    (t: any) => t.linkedToLocal === false
                  ) || [];

                  if (twilioOnlyTemplates.length === 0) return null;

                  return (
                    <Collapsible open={twilioOnlySectionOpen} onOpenChange={setTwilioOnlySectionOpen}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-xl cursor-pointer hover:from-indigo-600 hover:to-violet-700 transition-colors shadow-lg">
                          <div className="flex items-center gap-3 text-white">
                            <ExternalLink className="h-6 w-6" />
                            <h2 className="text-lg font-bold">Template Solo su Twilio</h2>
                            <Badge className="bg-white/20 text-white border-0">
                              {twilioOnlyTemplates.length} template
                            </Badge>
                          </div>
                          <ChevronDown className={`h-5 w-5 text-white transition-transform duration-200 ${twilioOnlySectionOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {twilioOnlyTemplates.map((template: any) => (
                            <Card key={template.sid} className="border-2 border-indigo-100 hover:border-indigo-300 transition-colors">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-base truncate">
                                      {template.friendlyName}
                                    </CardTitle>
                                    <div className="text-xs text-muted-foreground mt-1 font-mono">
                                      SID: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{template.sid}</code>
                                    </div>
                                  </div>
                                  <Badge className={`text-xs text-white flex-shrink-0 ${template.approvalStatus === 'approved' ? 'bg-green-500' :
                                    template.approvalStatus === 'pending' || template.approvalStatus === 'received' ? 'bg-yellow-500' :
                                      template.approvalStatus === 'rejected' ? 'bg-red-500' :
                                        'bg-gray-500'
                                    }`}>
                                    {template.approvalStatus === 'approved' ? (
                                      <><CheckCircle2 className="h-3 w-3 mr-1" />Approvato</>
                                    ) : template.approvalStatus === 'pending' || template.approvalStatus === 'received' ? (
                                      <><Clock className="h-3 w-3 mr-1" />In Attesa</>
                                    ) : template.approvalStatus === 'rejected' ? (
                                      <><XCircle className="h-3 w-3 mr-1" />Rifiutato</>
                                    ) : (
                                      template.approvalStatus
                                    )}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                {template.bodyPreview && (
                                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 p-3 rounded-lg border border-slate-200/60 text-sm text-slate-700 whitespace-pre-wrap max-h-[100px] overflow-hidden">
                                    {template.bodyPreview}
                                  </div>
                                )}
                                <div className="mt-3 flex items-center gap-2">
                                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Solo Twilio
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })()}

                {renderPagination()}
              </div>
            )}
          </div>
        </div>

        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Esporta Template a Twilio</DialogTitle>
              <DialogDescription>
                Seleziona l'agente WhatsApp e visualizza l'anteprima del template con i dati dell'agente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Agente WhatsApp</label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.agentName} ({agent.twilioWhatsappNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAgentId && templateToExport && (() => {
                const template = templates.find(t => t.id === templateToExport);
                const selectedAgent = agents.find((a: any) => a.id === selectedAgentId);

                if (!template?.activeVersion || !selectedAgent) return null;

                const resolveTemplate = (text: string) => {
                  let resolved = text;
                  const sampleData: Record<string, string> = {
                    nome_lead: "Mario",
                    cognome_lead: "Rossi",
                    nome_consulente: selectedAgent.consultantDisplayName || "Consulente",
                    nome_azienda: selectedAgent.businessName || "Business",
                    business_name: selectedAgent.businessName || "Business",
                    obiettivi: selectedAgent.defaultObiettivi || "Obiettivi predefiniti",
                    desideri: selectedAgent.defaultDesideri || "Desideri predefiniti",
                    uncino: selectedAgent.defaultUncino || "Uncino predefinito",
                    stato_ideale: selectedAgent.defaultIdealState || "Stato ideale predefinito",
                  };
                  Object.entries(sampleData).forEach(([key, value]) => {
                    resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                  });
                  return resolved;
                };

                const previewText = resolveTemplate(template.activeVersion.bodyText);

                return (
                  <div className="space-y-4">
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 text-sm font-semibold">Campo</th>
                            <th className="text-left p-3 text-sm font-semibold">Valore dall'Agente</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr>
                            <td className="p-3 text-sm font-medium">Nome Agente</td>
                            <td className="p-3 text-sm">{selectedAgent.agentName}</td>
                          </tr>
                          <tr>
                            <td className="p-3 text-sm font-medium">Numero WhatsApp</td>
                            <td className="p-3 text-sm font-mono">{selectedAgent.twilioWhatsappNumber}</td>
                          </tr>
                          <tr>
                            <td className="p-3 text-sm font-medium">Nome Consulente</td>
                            <td className="p-3 text-sm">{selectedAgent.consultantDisplayName || <span className="text-muted-foreground italic">Non configurato</span>}</td>
                          </tr>
                          <tr>
                            <td className="p-3 text-sm font-medium">Nome Business</td>
                            <td className="p-3 text-sm">{selectedAgent.businessName || <span className="text-muted-foreground italic">Non configurato</span>}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Anteprima Messaggio (con dati di esempio)
                      </label>
                      <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 rounded-lg border border-slate-200/60">
                        <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                          {previewText}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        💡 I valori mostrati sono esempi. Quando invii il messaggio, verranno sostituiti con i dati reali del lead.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleExportWithVerification}
                disabled={!selectedAgentId || verifyCredentialsMutation.isPending || exportMutation.isPending}
              >
                {verifyCredentialsMutation.isPending || exportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Esportazione...
                  </>
                ) : (
                  "Esporta a Twilio"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={syncAgentDialogOpen} onOpenChange={setSyncAgentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sincronizza Stato Template</DialogTitle>
              <DialogDescription>
                Seleziona l'agente WhatsApp per sincronizzare lo stato dei template da Twilio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Agente WhatsApp</label>
                <Select value={syncSelectedAgentId} onValueChange={setSyncSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.agentName} ({agent.twilioWhatsappNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Alert>
                <RefreshCw className="h-4 w-4" />
                <AlertDescription>
                  Questa operazione verificherà lo stato di approvazione Meta per tutti i template esportati su Twilio.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSyncAgentDialogOpen(false)}>
                Annulla
              </Button>
              <Button
                onClick={() => syncTwilioMutation.mutate(syncSelectedAgentId)}
                disabled={!syncSelectedAgentId || syncTwilioMutation.isPending}
              >
                {syncTwilioMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizzazione...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sincronizza
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={twilioTemplatesDialogOpen} onOpenChange={setTwilioTemplatesDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Template su Twilio
              </DialogTitle>
              <DialogDescription>
                Visualizza tutti i template presenti sul tuo account Twilio con stato di approvazione Meta
              </DialogDescription>
            </DialogHeader>

            {!twilioTemplatesData && agents.length > 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seleziona Agente WhatsApp</label>
                  <Select value={fetchTwilioAgentId} onValueChange={setFetchTwilioAgentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent: any) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.agentName} ({agent.twilioWhatsappNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => fetchTwilioTemplatesMutation.mutate(fetchTwilioAgentId)}
                  disabled={!fetchTwilioAgentId || fetchTwilioTemplatesMutation.isPending}
                  className="w-full"
                >
                  {fetchTwilioTemplatesMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recupero template...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Recupera Template da Twilio
                    </>
                  )}
                </Button>
              </div>
            )}

            {fetchTwilioTemplatesMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-10 w-10 animate-spin text-purple-600 mb-4" />
                <p className="text-sm text-muted-foreground">Recupero template da Twilio...</p>
              </div>
            )}

            {twilioTemplatesData && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 p-3 bg-slate-50 rounded-lg border">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border">
                    <span className="text-sm font-medium">{twilioTemplatesData.summary?.totalOnTwilio || 0}</span>
                    <span className="text-xs text-muted-foreground">Totali</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">{twilioTemplatesData.summary?.approvedOnTwilio || 0}</span>
                    <span className="text-xs text-green-600">Approvati</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-50 border border-yellow-200">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700">{twilioTemplatesData.summary?.pendingOnTwilio || 0}</span>
                    <span className="text-xs text-yellow-600">In Attesa</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">{twilioTemplatesData.summary?.linkedToLocal || 0}</span>
                    <span className="text-xs text-blue-600">Collegati</span>
                  </div>
                </div>

                {twilioTemplatesData.orphanedLocalTemplates?.length > 0 && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-red-800">
                      <strong>{twilioTemplatesData.orphanedLocalTemplates.length} template locali</strong> hanno SID che non esistono su Twilio.
                      Potrebbero essere stati cancellati o avere SID errati.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {twilioTemplatesData.twilioTemplates?.map((template: any) => (
                    <div
                      key={template.sid}
                      className={`border rounded-lg p-4 transition-colors ${template.linkedToLocal ? 'bg-blue-50/50 border-blue-200' : 'bg-white hover:bg-gray-50'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">{template.friendlyName}</span>
                            {template.linkedToLocal && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                                Collegato
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">
                            SID: <code className="bg-gray-200 px-1.5 py-0.5 rounded">{template.sid}</code>
                          </div>
                          {template.linkedToLocal && template.localTemplateName && (
                            <div className="text-xs text-blue-600 mt-1">
                              → Template locale: <strong>{template.localTemplateName}</strong>
                            </div>
                          )}
                        </div>
                        <Badge className={`text-xs text-white flex-shrink-0 ${template.approvalStatus === 'approved' ? 'bg-green-500' :
                          template.approvalStatus === 'pending' || template.approvalStatus === 'received' ? 'bg-yellow-500' :
                            template.approvalStatus === 'rejected' ? 'bg-red-500' :
                              'bg-gray-500'
                          }`}>
                          {template.approvalStatus === 'approved' ? 'Approvato' :
                            template.approvalStatus === 'pending' || template.approvalStatus === 'received' ? 'In Attesa' :
                              template.approvalStatus === 'rejected' ? 'Rifiutato' :
                                template.approvalStatus}
                        </Badge>
                      </div>
                      {template.bodyPreview && (
                        <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 whitespace-pre-wrap border mt-2">
                          {template.bodyPreview}
                        </div>
                      )}
                    </div>
                  ))}

                  {twilioTemplatesData.twilioTemplates?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nessun template trovato su Twilio per questo agente</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setTwilioTemplatesDialogOpen(false)}>
                Chiudi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={syncCredentialsDialogOpen} onOpenChange={setSyncCredentialsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Sincronizza Credenziali Twilio
              </DialogTitle>
              <DialogDescription>
                Aggiorna le credenziali Twilio di un agente con quelle centrali configurate nelle Impostazioni API.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {agentsByAccountData && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Account Centrale:</strong> {agentsByAccountData.centralAccountSidMasked || "Non configurato"}
                    </p>
                  </div>
                  
                  {agentsByAccountData.accountGroups?.map((group: any) => (
                    <div key={group.accountSid} className="border rounded-lg overflow-hidden">
                      <div className={`px-4 py-2 flex items-center justify-between ${group.isCentralAccount ? 'bg-green-50 border-b border-green-200' : 'bg-amber-50 border-b border-amber-200'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${group.isCentralAccount ? 'text-green-700' : 'text-amber-700'}`}>
                            {group.isCentralAccount ? '✅ Account Centrale' : '⚠️ Account Diverso'}
                          </span>
                          <code className="text-xs bg-white px-2 py-0.5 rounded border">{group.accountSidMasked}</code>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {group.agents.length} agenti
                        </Badge>
                      </div>
                      <div className="divide-y">
                        {group.agents.map((agent: any) => (
                          <div key={agent.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                            <div>
                              <p className="font-medium text-sm">{agent.agentName}</p>
                              <p className="text-xs text-muted-foreground">{agent.twilioWhatsappNumber}</p>
                            </div>
                            {!group.isCentralAccount && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCredentialSyncAgentId(agent.id);
                                }}
                                className={credentialSyncAgentId === agent.id ? 'ring-2 ring-blue-500' : ''}
                              >
                                {credentialSyncAgentId === agent.id ? 'Selezionato' : 'Seleziona'}
                              </Button>
                            )}
                            {group.isCentralAccount && (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                Già sincronizzato
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {agentsByAccountData.accountGroups?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nessun agente WhatsApp configurato</p>
                    </div>
                  )}
                </div>
              )}
              
              {credentialSyncAgentId && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    L'agente selezionato verrà aggiornato con le credenziali Twilio centrali. I template esistenti rimarranno invariati ma dovranno essere ri-esportati sul nuovo account.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setSyncCredentialsDialogOpen(false);
                setCredentialSyncAgentId("");
              }}>
                Annulla
              </Button>
              <Button
                onClick={() => syncCredentialsMutation.mutate(credentialSyncAgentId)}
                disabled={!credentialSyncAgentId || syncCredentialsMutation.isPending}
              >
                {syncCredentialsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizzazione...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sincronizza Credenziali
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConsultantAIAssistant />
      </div>
    </div>
  );
}
