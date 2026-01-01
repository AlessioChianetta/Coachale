import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Server, 
  Key, 
  Phone,
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Save,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  Clock,
  Building2,
  FileText,
  User,
  Edit,
  Bot,
  Users,
  Copy,
  Lightbulb,
  ChevronRight,
  Info,
  Mail,
  ClipboardCheck,
  Upload,
  Link,
  MessageCircle,
  Wand2,
  Check,
  Calendar,
  BookOpen,
  Database,
  ArrowRight,
  Settings,
  ShoppingCart,
  CreditCard,
  AlertTriangle,
  Receipt,
  Briefcase,
  Crown,
  Shield
} from "lucide-react";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import { isToday, isYesterday, isThisWeek, format } from "date-fns";
import { it } from "date-fns/locale";
import WhatsAppLayout from "@/components/whatsapp/WhatsAppLayout";
import { getAuthHeaders } from "@/lib/auth";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { AgentInstructionsPanel } from "@/components/whatsapp/AgentInstructionsPanel";
import { whatsappAgentIdeas } from "@/data/whatsapp-agent-ideas";
import { AgentDashboardHeader } from "@/components/whatsapp/AgentDashboardHeader";
import { AgentRoster } from "@/components/whatsapp/AgentRoster";
import { AgentProfilePanel } from "@/components/whatsapp/AgentProfilePanel";
import { AgentLeaderboard } from "@/components/whatsapp/AgentLeaderboard";
import { ActivityFeed } from "@/components/whatsapp/ActivityFeed";
import { LevelBadge } from "@/components/whatsapp/LevelBadge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WhatsAppConfig {
  id?: string;
  agentName: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioWhatsappNumber: string;
  autoResponseEnabled: boolean;
  agentType?: "reactive_lead" | "proactive_setter" | "informative_advisor" | "customer_success" | "intake_coordinator";
  integrationMode?: "whatsapp_ai" | "ai_only";
  isProactiveAgent?: boolean;
  workingHoursEnabled?: boolean;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  workingDays?: string[];
  afterHoursMessage?: string;
  businessName?: string;
  consultantDisplayName?: string;
  businessDescription?: string;
  consultantBio?: string;
  salesScript?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  usp?: string;
  whoWeHelp?: string;
  whoWeDontHelp?: string;
  whatWeDo?: string;
  howWeDoIt?: string;
  softwareCreated?: Array<{ name: string; description: string }>;
  booksPublished?: Array<{ title: string; year: string }>;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string;
  caseStudies?: Array<{ clientName: string; result: string }>;
  servicesOffered?: Array<{ name: string; description: string; price: string }>;
  guarantees?: string;
  aiPersonality?: "amico_fidato" | "coach_motivazionale" | "consulente_professionale" | "mentore_paziente" | "venditore_energico" | "consigliere_empatico" | "stratega_diretto" | "educatore_socratico" | "esperto_tecnico" | "compagno_entusiasta";
  whatsappConciseMode?: boolean;
  defaultObiettivi?: string;
  defaultDesideri?: string;
  defaultUncino?: string;
  defaultIdealState?: string;
  isDryRun?: boolean;
  agentInstructions?: string | null;
  agentInstructionsEnabled?: boolean;
  selectedTemplate?: "receptionist" | "marco_setter" | "custom";
}

const emptyConfig: WhatsAppConfig = {
  agentName: "",
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioWhatsappNumber: "",
  autoResponseEnabled: true,
  agentType: "reactive_lead" as "reactive_lead" | "proactive_setter",
  workingHoursEnabled: false,
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  afterHoursMessage: "Ciao! Ti risponderò durante i miei orari di lavoro.",
  businessName: "",
  consultantDisplayName: "",
  businessDescription: "",
  consultantBio: "",
  salesScript: "",
  vision: "",
  mission: "",
  values: [],
  usp: "",
  whoWeHelp: "",
  whoWeDontHelp: "",
  whatWeDo: "",
  howWeDoIt: "",
  softwareCreated: [],
  booksPublished: [],
  yearsExperience: undefined,
  clientsHelped: undefined,
  resultsGenerated: "",
  caseStudies: [],
  servicesOffered: [],
  guarantees: "",
  aiPersonality: "amico_fidato",
  whatsappConciseMode: false,
  defaultObiettivi: "",
  defaultDesideri: "",
  defaultUncino: "",
  defaultIdealState: "",
  isDryRun: true,
  agentInstructions: null,
  agentInstructionsEnabled: false,
  selectedTemplate: "receptionist",
};

export default function ConsultantWhatsAppPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<WhatsAppConfig | null>(null);
  const [newApiKey, setNewApiKey] = useState("");

  // Stati per tab Idee
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [urlInputs, setUrlInputs] = useState<string[]>([""]);
  const [textInput, setTextInput] = useState("");
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [numberOfIdeas, setNumberOfIdeas] = useState(3);
  const [generatedIdeas, setGeneratedIdeas] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedKnowledgeDocIds, setSelectedKnowledgeDocIds] = useState<string[]>([]);
  const [businessNameInput, setBusinessNameInput] = useState("");
  const [consultantDisplayNameInput, setConsultantDisplayNameInput] = useState("");
  const [isImprovingText, setIsImprovingText] = useState(false);

  // Stato per dashboard enterprise agenti
  const [selectedAgent, setSelectedAgent] = useState<{
    id: string;
    name: string;
    agentType: string;
    status: "active" | "paused" | "test";
    performanceScore: number;
    trend: "up" | "down" | "stable";
    conversationsToday: number;
  } | null>(null);

  // Stati per gestione utenti (sezione Licenze)
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [bronzeCurrentPage, setBronzeCurrentPage] = useState(1);
  const [userManagementTab, setUserManagementTab] = useState<"bronze" | "silver" | "gold">("bronze");
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);

  // Query per caricare i documenti dalla knowledge base
  const knowledgeDocsQuery = useQuery({
    queryKey: ["/api/consultant/onboarding/knowledge-documents"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/onboarding/knowledge-documents", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch knowledge documents");
      return res.json();
    },
  });

  const knowledgeDocs = knowledgeDocsQuery.data?.data || [];

  // Query per caricare le idee salvate dal backend
  const savedIdeasQuery = useQuery({
    queryKey: ["/api/consultant/onboarding/ai-ideas"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/onboarding/ai-ideas", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch saved ideas");
      return res.json();
    },
  });

  const savedIdeas = savedIdeasQuery.data?.data || [];

  // Query per caricare le licenze del consulente
  const licensesQuery = useQuery({
    queryKey: ["/api/consultant/licenses"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/licenses", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch licenses");
      return res.json();
    },
  });

  const licenses = licensesQuery.data?.data || {
    level2Total: 20,
    level2Used: 0,
    level3Total: 10,
    level3Used: 0,
    employeeTotal: 0,
    employeeUsed: 0,
  };

  // Query per caricare lo storico acquisti licenze
  const purchasesQuery = useQuery({
    queryKey: ["/api/consultant/licenses/purchases"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/licenses/purchases", { headers: getAuthHeaders() });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Mutation per checkout acquisto licenze
  const buyLicensesMutation = useMutation({
    mutationFn: async (quantity: number) => {
      const response = await fetch("/api/consultant/licenses/checkout", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!response.ok) throw new Error("Checkout failed");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile avviare il checkout",
        variant: "destructive",
      });
    },
  });

  // Query per caricare le sottoscrizioni dei clienti
  const subscriptionsQuery = useQuery({
    queryKey: ["/api/consultant/subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/subscriptions", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      return res.json();
    },
  });

  const subscriptions = subscriptionsQuery.data?.data || [];

  // Queries per gestione utenti (Bronze/Silver/Gold)
  const bronzeUsersQuery = useQuery({
    queryKey: ["/api/consultant/pricing/users/bronze", userSearchQuery, bronzeCurrentPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: bronzeCurrentPage.toString(), limit: "10" });
      if (userSearchQuery) params.set("search", userSearchQuery);
      const res = await fetch(`/api/consultant/pricing/users/bronze?${params}`, { headers: getAuthHeaders() });
      return res.json();
    }
  });

  const silverUsersQuery = useQuery({
    queryKey: ["/api/consultant/pricing/users/silver"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/pricing/users/silver", { headers: getAuthHeaders() });
      return res.json();
    }
  });

  const goldUsersQuery = useQuery({
    queryKey: ["/api/consultant/pricing/users/gold"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/pricing/users/gold", { headers: getAuthHeaders() });
      return res.json();
    }
  });

  const userStatsQuery = useQuery({
    queryKey: ["/api/consultant/pricing/users/stats"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/pricing/users/stats", { headers: getAuthHeaders() });
      return res.json();
    }
  });

  // Mutation per eliminazione utente Bronze
  const deleteBronzeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/consultant/pricing/users/bronze/${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/pricing/users/bronze"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/pricing/users/stats"] });
      setUserToDelete(null);
      toast({ title: "Utente eliminato", description: "L'utente Bronze è stato eliminato con successo." });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Query per ottenere i dati del consulente (per pricing page)
  const consultantDataQuery = useQuery({
    queryKey: ["/api/consultant/profile"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/profile", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const consultantData = consultantDataQuery.data;

  // Group saved ideas by date
  const groupedSavedIdeas = useMemo(() => {
    const groups: { [key: string]: any[] } = {
      "Oggi": [],
      "Ieri": [],
      "Questa Settimana": [],
      "Precedenti": [],
    };

    savedIdeas.forEach((idea: any) => {
      const createdAt = new Date(idea.createdAt);
      if (isToday(createdAt)) {
        groups["Oggi"].push(idea);
      } else if (isYesterday(createdAt)) {
        groups["Ieri"].push(idea);
      } else if (isThisWeek(createdAt)) {
        groups["Questa Settimana"].push(idea);
      } else {
        groups["Precedenti"].push(idea);
      }
    });

    return groups;
  }, [savedIdeas]);

  // Mutation per salvare un'idea
  const saveIdeaMutation = useMutation({
    mutationFn: async (idea: any) => {
      const res = await fetch("/api/consultant/onboarding/ai-ideas", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: idea.name,
          description: idea.description,
          targetAudience: idea.target || idea.personality,
          agentType: "whatsapp",
          integrationTypes: idea.integrations || idea.integrationTypes || [],
          sourceType: "generated",
          suggestedAgentType: idea.suggestedAgentType,
          personality: idea.personality,
          whoWeHelp: idea.whoWeHelp,
          whoWeDontHelp: idea.whoWeDontHelp,
          whatWeDo: idea.whatWeDo,
          howWeDoIt: idea.howWeDoIt,
          usp: idea.usp,
          suggestedInstructions: idea.suggestedInstructions,
          useCases: idea.useCases,
          vision: idea.vision,
          mission: idea.mission,
          businessName: idea.businessName,
          consultantDisplayName: idea.consultantDisplayName,
        }),
      });
      if (!res.ok) throw new Error("Failed to save idea");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/onboarding/ai-ideas"] });
      toast({
        title: "💡 Idea salvata",
        description: "L'idea è stata salvata nel database.",
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

  // Mutation per salvare e creare agente subito (directly without wizard)
  const saveAndCreateAgentMutation = useMutation({
    mutationFn: async ({ idea, filesToUpload }: { idea: any; filesToUpload: File[] }) => {
      // First save the idea
      const saveRes = await fetch("/api/consultant/onboarding/ai-ideas", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: idea.name,
          description: idea.description,
          targetAudience: idea.target || idea.personality,
          agentType: "whatsapp",
          integrationTypes: idea.integrations || idea.integrationTypes || [],
          sourceType: "generated",
          suggestedAgentType: idea.suggestedAgentType,
          personality: idea.personality,
          whoWeHelp: idea.whoWeHelp,
          whoWeDontHelp: idea.whoWeDontHelp,
          whatWeDo: idea.whatWeDo,
          howWeDoIt: idea.howWeDoIt,
          usp: idea.usp,
          suggestedInstructions: idea.suggestedInstructions,
          useCases: idea.useCases,
          vision: idea.vision,
          mission: idea.mission,
          businessName: idea.businessName,
          consultantDisplayName: idea.consultantDisplayName,
        }),
      });
      if (!saveRes.ok) throw new Error("Failed to save idea");
      const savedIdea = await saveRes.json();
      const savedIdeaId = savedIdea.data?.id || savedIdea.id;

      // Then create the agent directly from the idea
      const createRes = await fetch("/api/whatsapp/config/from-idea", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ideaId: savedIdeaId }),
      });
      if (!createRes.ok) throw new Error("Failed to create agent from idea");
      const agentResult = await createRes.json();
      const agentData = agentResult.data || agentResult;
      const agentId = agentData?.id;

      // Upload files to the agent's Knowledge Base
      let uploadedDocsCount = 0;
      if (agentId && filesToUpload.length > 0) {
        for (const file of filesToUpload) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("title", file.name.replace(/\.[^/.]+$/, "")); // Remove extension for title

            // Determine file type
            let fileType = "txt";
            if (file.type === "application/pdf") {
              fileType = "pdf";
            } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.type === "application/msword") {
              fileType = "docx";
            } else if (file.type === "text/plain") {
              fileType = "txt";
            }
            formData.append("type", fileType);

            const uploadRes = await fetch(`/api/whatsapp/agent-config/${agentId}/knowledge`, {
              method: "POST",
              headers: getAuthHeaders(),
              body: formData,
            });

            if (uploadRes.ok) {
              uploadedDocsCount++;
            } else {
              console.warn(`Failed to upload file ${file.name} to agent KB`);
            }
          } catch (uploadError) {
            console.error(`Error uploading file ${file.name}:`, uploadError);
          }
        }
      }

      return { ...agentResult, uploadedDocsCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/onboarding/ai-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      const agentData = data.data || data;
      const agentName = agentData?.agentName || agentData?.name || "Nuovo agente";
      const agentId = agentData?.id;
      const docsCount = data.uploadedDocsCount || 0;

      // Clear uploaded files after successful agent creation
      setUploadedFiles([]);

      toast({
        title: "🤖 Agente creato!",
        description: docsCount > 0 
          ? `Agente "${agentName}" creato! ${docsCount} document${docsCount === 1 ? 'o' : 'i'} salvat${docsCount === 1 ? 'o' : 'i'} nella Knowledge Base.`
          : `L'agente "${agentName}" è stato creato con successo.`,
      });
      // Navigate to the agent edit page if we have an ID, otherwise to list
      if (agentId) {
        navigate(`/consultant/whatsapp/agent/${agentId}`);
      } else {
        navigate("/consultant/whatsapp");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation per eliminare un'idea
  const deleteIdeaMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const res = await fetch(`/api/consultant/onboarding/ai-ideas/${ideaId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete idea");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/onboarding/ai-ideas"] });
      toast({
        title: "🗑️ Idea rimossa",
        description: "L'idea è stata eliminata.",
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

  const searchParams = new URLSearchParams(useSearch());
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "system" ? "system" : "custom";

  // Load existing WhatsApp configs
  const { data: existingConfigs, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/config"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { configs: [] };
        throw new Error("Failed to fetch WhatsApp config");
      }
      const data = await response.json();
      return data;
    },
  });

  const configs = existingConfigs?.configs || [];

  // Query per caricare i dati delle statistiche agenti dal backend
  const { data: agentStatsData, isLoading: isLoadingStats } = useQuery<Array<{
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    score: number;
    conversations7d: number;
    rank: number;
  }>>({
    queryKey: ["/api/whatsapp/agents/leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/agents/leaderboard", { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) throw new Error("Failed to fetch agent stats");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.agents || []);
    },
    enabled: configs.length > 0,
    staleTime: 30000,
  });

  const agentStats = (agentStatsData || []).map((agent: any) => ({
    id: agent.id,
    name: agent.name,
    agentType: agent.type || agent.agentType || "reactive_lead",
    status: agent.isActive === false ? "paused" : "active",
    performanceScore: agent.score || 0,
    trend: "stable" as const,
    conversationsToday: agent.conversations7d || 0,
  }));

  // Delete WhatsApp config mutation
  const deleteMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/whatsapp/config/${configId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete configuration");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      setIsDeleteDialogOpen(false);
      setConfigToDelete(null);
      toast({
        title: "✅ Agente eliminato",
        description: "La configurazione dell'agente è stata eliminata con successo.",
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

  // Duplicate WhatsApp config mutation
  const duplicateMutation = useMutation({
    mutationFn: async (config: WhatsAppConfig) => {
      const duplicateData = {
        agentName: `${config.agentName} - Copia`,
        // Credenziali Twilio - copiate dall'agente originale
        twilioAccountSid: config.twilioAccountSid || "",
        twilioAuthToken: config.twilioAuthToken || "",
        twilioWhatsappNumber: config.twilioWhatsappNumber || "",
        integrationMode: config.integrationMode || "whatsapp_ai",
        autoResponseEnabled: config.autoResponseEnabled,
        agentType: config.agentType,
        // Working Hours
        workingHoursEnabled: config.workingHoursEnabled,
        workingHoursStart: config.workingHoursStart,
        workingHoursEnd: config.workingHoursEnd,
        workingDays: config.workingDays,
        afterHoursMessage: config.afterHoursMessage,
        // Business Profile
        businessName: config.businessName,
        consultantDisplayName: config.consultantDisplayName,
        businessDescription: config.businessDescription,
        consultantBio: config.consultantBio,
        salesScript: config.salesScript,
        // Authority & Positioning
        vision: config.vision,
        mission: config.mission,
        values: config.values,
        usp: config.usp,
        whoWeHelp: config.whoWeHelp,
        whoWeDontHelp: config.whoWeDontHelp,
        whatWeDo: config.whatWeDo,
        howWeDoIt: config.howWeDoIt,
        // Software & Books
        softwareCreated: config.softwareCreated,
        booksPublished: config.booksPublished,
        // Proof & Credibility
        yearsExperience: config.yearsExperience,
        clientsHelped: config.clientsHelped,
        resultsGenerated: config.resultsGenerated,
        caseStudies: config.caseStudies,
        // Services & Guarantees
        servicesOffered: config.servicesOffered,
        guarantees: config.guarantees,
        // AI Personality
        aiPersonality: config.aiPersonality,
        whatsappConciseMode: config.whatsappConciseMode,
        // Proactive Lead Defaults
        defaultObiettivi: config.defaultObiettivi,
        defaultDesideri: config.defaultDesideri,
        defaultUncino: config.defaultUncino,
        defaultIdealState: config.defaultIdealState,
        // Dry Run & Agent Settings
        isDryRun: config.isDryRun,
        isProactiveAgent: config.isProactiveAgent,
        // Agent Instructions
        agentInstructions: config.agentInstructions,
        agentInstructionsEnabled: config.agentInstructionsEnabled,
        selectedTemplate: config.selectedTemplate,
        // Feature Blocks
        bookingEnabled: config.bookingEnabled,
        objectionHandlingEnabled: config.objectionHandlingEnabled,
        disqualificationEnabled: config.disqualificationEnabled,
        upsellingEnabled: config.upsellingEnabled,
        // WhatsApp Templates
        whatsappTemplates: config.whatsappTemplates,
        templateBodies: config.templateBodies,
        // Business Header Configuration
        businessHeaderMode: config.businessHeaderMode,
        professionalRole: config.professionalRole,
        customBusinessHeader: config.customBusinessHeader,
        // TTS Configuration
        ttsEnabled: config.ttsEnabled,
        audioResponseMode: config.audioResponseMode,
        // Availability Settings
        availabilityTimezone: config.availabilityTimezone,
        availabilityAppointmentDuration: config.availabilityAppointmentDuration,
        availabilityBufferBefore: config.availabilityBufferBefore,
        availabilityBufferAfter: config.availabilityBufferAfter,
        availabilityMaxDaysAhead: config.availabilityMaxDaysAhead,
        availabilityMinHoursNotice: config.availabilityMinHoursNotice,
        availabilityWorkingHours: config.availabilityWorkingHours,
        // Account References & Notes
        twilioAccountReference: config.twilioAccountReference,
        twilioNotes: config.twilioNotes,
        // AI Assistant Integration
        enableInAIAssistant: config.enableInAIAssistant,
        fileSearchCategories: config.fileSearchCategories,
      };

      return duplicateData;
    },
    onSuccess: (duplicateData) => {
      // Navigate to new agent page with duplicated data (store temporarily in session)
      sessionStorage.setItem('duplicateAgentData', JSON.stringify(duplicateData));
      navigate("/consultant/whatsapp/agent/new");
      toast({
        title: "📋 Agente pronto per la duplicazione",
        description: "Completa le credenziali Twilio e salva per creare la copia.",
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
    navigate("/consultant/whatsapp/agent/new");
  };

  const handleEdit = (config: WhatsAppConfig) => {
    navigate(`/consultant/whatsapp/agent/${config.id}`);
  };

  const handleDelete = (config: WhatsAppConfig) => {
    setConfigToDelete(config);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (configToDelete?.id) {
      deleteMutation.mutate(configToDelete.id);
    }
  };

  const handleDuplicate = (config: WhatsAppConfig) => {
    duplicateMutation.mutate(config);
  };

  // Load API Keys
  const { data: apiKeysData, isLoading: keysLoading } = useQuery({
    queryKey: ["/api/whatsapp/api-keys"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/api-keys", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to load API keys");
      return response.json();
    },
  });

  const apiKeys = apiKeysData?.keys || [];
  const keysCount = apiKeysData?.count || 0;
  const maxKeys = apiKeysData?.maxKeys || 50;

  // Add API Key mutation
  const addKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const response = await fetch("/api/whatsapp/api-keys", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
      setNewApiKey("");
      toast({
        title: "✅ API Key aggiunta",
        description: "La chiave è stata aggiunta con successo.",
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

  // Delete API Key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/whatsapp/api-keys/${keyId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete key");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
      toast({
        title: "✅ API Key rimossa",
        description: "La chiave è stata rimossa con successo.",
      });
    },
  });

  // Toggle API Key mutation
  const toggleKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/whatsapp/api-keys/${keyId}/toggle`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to toggle key");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
    },
  });

  const handleAddKey = () => {
    if (!newApiKey.trim() || newApiKey.trim().length < 20) {
      toast({
        title: "⚠️ API Key non valida",
        description: "Inserisci una API key Gemini valida (minimo 20 caratteri).",
        variant: "destructive",
      });
      return;
    }
    addKeyMutation.mutate(newApiKey.trim());
  };

  return (
    <WhatsAppLayout 
      showHeader={false}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Modern Header Section */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <MessageSquare className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Dipendenti AI</h1>
                <p className="text-emerald-100 text-sm mt-1">
                  Configura e monitora i tuoi dipendenti AI per conversazioni automatizzate
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Button 
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                onClick={() => window.location.href = '/consultant/whatsapp-agents-chat'}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Chat Agenti
              </Button>
              <Button 
                onClick={handleAddNew}
                className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-md font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Agente
              </Button>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs defaultValue={initialTab} className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-1">
            <TabsList className="grid w-full grid-cols-4 gap-1 bg-transparent h-auto p-0">
              <TabsTrigger 
                value="custom" 
                className="py-3 px-4 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                <Bot className="h-4 w-4 mr-2" />
                Agenti Personalizzati
              </TabsTrigger>
              <TabsTrigger 
                value="system" 
                className="py-3 px-4 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                <Users className="h-4 w-4 mr-2" />
                Agenti di Sistema
              </TabsTrigger>
              <TabsTrigger 
                value="ideas" 
                className="py-3 px-4 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                Idee AI
              </TabsTrigger>
              <TabsTrigger 
                value="licenses" 
                className="py-3 px-4 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                <Key className="h-4 w-4 mr-2" />
                Licenze
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="custom" className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : configs.length === 0 ? (
              <Card className="border-dashed border-2 border-gray-300 dark:border-gray-700">
                <CardContent className="flex flex-col items-center justify-center p-12">
                  <Bot className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Nessun agente configurato
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                    Crea il tuo primo agente WhatsApp AI per iniziare a gestire conversazioni automatizzate.
                  </p>
                  <Button onClick={handleAddNew} className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Crea Primo Agente
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Enterprise Dashboard Header con KPI */}
                <AgentDashboardHeader />
                
                {/* Layout principale: Roster + Profile */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Sidebar Roster (4 colonne) */}
                  <div className="lg:col-span-4">
                    <AgentRoster 
                      onSelectAgent={(agent) => setSelectedAgent(agent)}
                      selectedAgentId={selectedAgent?.id}
                    />
                  </div>
                  
                  {/* Pannello Profilo Agente (8 colonne) */}
                  <div className="lg:col-span-8">
                    <AgentProfilePanel 
                      selectedAgent={selectedAgent}
                      onDeleteAgent={(agentId) => {
                        const config = configs.find((c: WhatsAppConfig) => c.id === agentId);
                        if (config) handleDelete(config);
                      }}
                      onDuplicateAgent={(agentId) => {
                        const config = configs.find((c: WhatsAppConfig) => c.id === agentId);
                        if (config) handleDuplicate(config);
                      }}
                    />
                  </div>
                </div>
                
                {/* Sezione Leaderboard + Activity Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AgentLeaderboard 
                    agents={agentStats}
                    isLoading={isLoadingStats}
                    onSelectAgent={(agent) => setSelectedAgent(agent)}
                  />
                  <ActivityFeed />
                </div>
              </div>
            )}

          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
              <Info className="h-5 w-5 text-blue-600" />
              <AlertDescription>
                <strong>Agenti AI di Sistema</strong><br />
                Questi agenti sono preconfigurati e gestiti automaticamente dal sistema. Non possono essere modificati o eliminati.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Card 1 - Millie (AI Email Writer) */}
              <Card className="relative overflow-hidden border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-purple-950/30 dark:via-pink-950/30 dark:to-gray-900 hover:shadow-2xl hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50 hover:-translate-y-2 hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                    Millie
                  </CardTitle>
                  <p className="text-base font-bold text-purple-700 dark:text-purple-400 mb-4">
                    AI Email Writer
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center shadow-lg">
                        <Mail className="h-16 w-16 text-purple-600 dark:text-purple-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-gray-500 text-white text-xs px-2 py-0.5">
                        Sistema - Non Modificabile
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-5 mb-5 border border-purple-100 dark:border-purple-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-purple-500"></div>
                      <p className="text-sm font-bold text-purple-800 dark:text-purple-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Email Giornaliere AI
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Personalizzate per Cliente
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Journey Automatico
                        </p>
                      </div>
                      <div className="text-xs text-center text-purple-700 dark:text-purple-400 font-medium italic mt-3 pt-3 border-t border-purple-200/50 dark:border-purple-700/30">
                        e centinaia di altre funzioni.
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={() => window.location.href = '/consultant/ai-config'}
                  >
                    Gestisci Email Journey
                  </Button>

                  {/* Chi sono section */}
                  <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-lg p-4">
                    <p className="text-center text-base font-bold text-purple-900 dark:text-purple-100 mb-2">
                      🙋‍♀️ Chi sono
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        Sono <span className="font-bold text-purple-600 dark:text-purple-400">Millie</span>, la tua assistente AI per le email giornaliere.
                      </p>
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs text-purple-700 dark:text-purple-300">
                          <span className="font-semibold">👥 A chi mi rivolgo:</span> Consulenti, coach e professionisti che vogliono mantenere un contatto costante con i loro clienti
                        </p>
                        <p className="text-xs text-purple-700 dark:text-purple-300">
                          <span className="font-semibold">🎯 Cosa faccio:</span> Creo e invio email personalizzate automaticamente ogni giorno, mantenendo viva la relazione con ogni cliente senza che tu debba pensarci
                        </p>
                        <p className="text-xs text-purple-700 dark:text-purple-300">
                          <span className="font-semibold">✨ Come lo faccio:</span> Usando l'intelligenza artificiale, analizzo il percorso di ogni cliente e genero contenuti su misura che arrivano al momento giusto, con il tono giusto
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2 - Echo (AI Consultation Summarizer) */}
              <Card className="relative overflow-hidden border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 via-amber-50 to-white dark:from-orange-950/30 dark:via-amber-950/30 dark:to-gray-900 hover:shadow-2xl hover:shadow-orange-200/50 dark:hover:shadow-orange-900/50 hover:-translate-y-2 hover:border-orange-400 dark:hover:border-orange-600 transition-all duration-300 rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
                    Echo
                  </CardTitle>
                  <p className="text-base font-bold text-orange-700 dark:text-orange-400 mb-4">
                    AI Consultation Summarizer
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center shadow-lg">
                        <ClipboardCheck className="h-16 w-16 text-orange-600 dark:text-orange-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-gray-500 text-white text-xs px-2 py-0.5">
                        Sistema - Non Modificabile
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-orange-50/80 to-amber-50/80 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-5 mb-5 border border-orange-100 dark:border-orange-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-orange-500"></div>
                      <p className="text-sm font-bold text-orange-800 dark:text-orange-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-orange-200/50 dark:border-orange-700/30 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Riepiloghi Consulenze AI
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-orange-200/50 dark:border-orange-700/30 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Email Personalizzate
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-orange-200/50 dark:border-orange-700/30 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Da Trascrizioni Fathom
                        </p>
                      </div>
                      <div className="text-xs text-center text-orange-700 dark:text-orange-400 font-medium italic mt-3 pt-3 border-t border-orange-200/50 dark:border-orange-700/30">
                        e centinaia di altre funzioni.
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={() => window.location.href = '/consultant/appointments'}
                  >
                    Gestisci Consulenze
                  </Button>

                  {/* Chi sono section */}
                  <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-900/10 dark:to-amber-900/10 rounded-lg p-4">
                    <p className="text-center text-base font-bold text-orange-900 dark:text-orange-100 mb-2">
                      🙋‍♂️ Chi sono
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        Sono <span className="font-bold text-orange-600 dark:text-orange-400">Echo</span>, il tuo assistente AI per le consulenze.
                      </p>
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs text-orange-700 dark:text-orange-300">
                          <span className="font-semibold">👥 A chi mi rivolgo:</span> Consulenti e professionisti che tengono sessioni one-to-one con i clienti e vogliono documentare ogni incontro
                        </p>
                        <p className="text-xs text-orange-700 dark:text-orange-300">
                          <span className="font-semibold">🎯 Cosa faccio:</span> Trasformo le tue consulenze in riepiloghi strutturati e personalizzati, evidenziando progressi, insight chiave e prossimi passi da seguire
                        </p>
                        <p className="text-xs text-orange-700 dark:text-orange-300">
                          <span className="font-semibold">✨ Come lo faccio:</span> Analizzo le trascrizioni delle tue chiamate Fathom con l'AI, estraggo i punti salienti e creo email professionali che invio automaticamente al cliente dopo ogni sessione
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3 - Spec (AI Researcher) */}
              <Card className="relative overflow-hidden border-2 border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 via-blue-50 to-white dark:from-cyan-950/30 dark:via-blue-950/30 dark:to-gray-900 hover:shadow-2xl hover:shadow-cyan-200/50 dark:hover:shadow-cyan-900/50 hover:-translate-y-2 hover:border-cyan-400 dark:hover:border-cyan-600 transition-all duration-300 rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-2">
                    Spec
                  </CardTitle>
                  <p className="text-base font-bold text-cyan-700 dark:text-cyan-400 mb-4">
                    AI Researcher
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center shadow-lg">
                        <Bot className="h-16 w-16 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-gray-500 text-white text-xs px-2 py-0.5">
                        Sistema - Non Modificabile
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-cyan-50/80 to-blue-50/80 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl p-5 mb-5 border border-cyan-100 dark:border-cyan-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-cyan-500"></div>
                      <p className="text-sm font-bold text-cyan-800 dark:text-cyan-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Supporto Clienti 24/7
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Risposte su Esercizi
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Guida ai Materiali
                        </p>
                      </div>
                      <div className="text-xs text-center text-cyan-700 dark:text-cyan-400 font-medium italic mt-3 pt-3 border-t border-cyan-200/50 dark:border-cyan-700/30">
                        e centinaia di altre funzioni.
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={() => window.location.href = '/client/ai-assistant'}
                  >
                    Area Clienti
                  </Button>

                  {/* Chi sono section */}
                  <div className="mt-4 pt-4 border-t border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50/50 to-blue-50/50 dark:from-cyan-900/10 dark:to-blue-900/10 rounded-lg p-4">
                    <p className="text-center text-base font-bold text-cyan-900 dark:text-cyan-100 mb-2">
                      🙋‍♂️ Chi sono
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm text-cyan-800 dark:text-cyan-200">
                        Sono <span className="font-bold text-cyan-600 dark:text-cyan-400">Spec</span>, il tuo assistente AI sempre disponibile.
                      </p>
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs text-cyan-700 dark:text-cyan-300">
                          <span className="font-semibold">👥 A chi mi rivolgo:</span> Clienti attivi in un percorso di formazione o coaching che hanno bisogno di supporto continuo tra una sessione e l'altra
                        </p>
                        <p className="text-xs text-cyan-700 dark:text-cyan-300">
                          <span className="font-semibold">🎯 Cosa faccio:</span> Fornisco risposte immediate su esercizi, dubbi e domande, guidando i clienti attraverso i materiali formativi senza che debbano aspettare la prossima consulenza
                        </p>
                        <p className="text-xs text-cyan-700 dark:text-cyan-300">
                          <span className="font-semibold">✨ Come lo faccio:</span> Sono attivo 24/7 via chat, ho accesso completo alla biblioteca di documenti e ai corsi dell'università, e uso l'AI per dare risposte precise e contestualizzate al percorso di ogni cliente
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ideas" className="space-y-6">
            <Alert className="bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800">
              <Wand2 className="h-5 w-5 text-purple-600" />
              <AlertDescription>
                <strong>Generatore di Idee AI</strong><br />
                Carica documenti, siti web o descrizioni testuali e lascia che l'AI generi idee personalizzate per i tuoi agenti WhatsApp.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pannello Sinistra - Input */}
              <div className="lg:col-span-2 space-y-6">
                {/* Upload Documenti */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-purple-600" />
                      Carica Documenti
                    </CardTitle>
                    <CardDescription>
                      Carica file PDF, DOC, TXT o immagini che descrivono il tuo business
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:border-purple-400 dark:hover:border-purple-600 transition-colors cursor-pointer">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                        className="hidden"
                        id="file-upload"
                        onChange={(e) => {
                          if (e.target.files) {
                            setUploadedFiles([...uploadedFiles, ...Array.from(e.target.files)]);
                          }
                        }}
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Clicca per caricare o trascina i file qui
                        </p>
                        <p className="text-xs text-gray-500">
                          PDF, DOC, TXT, PNG, JPG (max 10MB per file)
                        </p>
                      </label>
                    </div>

                    {uploadedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-purple-600" />
                              <span className="text-sm font-medium">{file.name}</span>
                              <span className="text-xs text-gray-500">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Importa da Base di Conoscenza */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-purple-600" />
                      Importa da Base di Conoscenza
                    </CardTitle>
                    <CardDescription>
                      Seleziona documenti già caricati nella tua knowledge base
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {knowledgeDocsQuery.isLoading ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-500">Caricamento documenti...</span>
                      </div>
                    ) : knowledgeDocs.length === 0 ? (
                      <div className="text-center p-4 text-gray-500">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">Nessun documento nella knowledge base</p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => navigate("/consultant/knowledge-documents")}
                          className="mt-2 text-purple-600"
                        >
                          Carica documenti
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {knowledgeDocs.map((doc: any) => (
                          <div key={doc.id} className="flex items-center space-x-3 p-2 hover:bg-purple-50 dark:hover:bg-purple-950/20 rounded-lg">
                            <Checkbox
                              id={`doc-${doc.id}`}
                              checked={selectedKnowledgeDocIds.includes(doc.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedKnowledgeDocIds([...selectedKnowledgeDocIds, doc.id]);
                                } else {
                                  setSelectedKnowledgeDocIds(selectedKnowledgeDocIds.filter(id => id !== doc.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`doc-${doc.id}`}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-purple-600" />
                                <span className="text-sm font-medium truncate">{doc.fileName}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {doc.fileType?.toUpperCase() || 'DOC'}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : ''}
                                </span>
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedKnowledgeDocIds.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-purple-600 font-medium">
                          {selectedKnowledgeDocIds.length} documento/i selezionato/i
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* URL Siti Web */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link className="h-5 w-5 text-purple-600" />
                      Siti Web o Pagine
                    </CardTitle>
                    <CardDescription>
                      Aggiungi URL di siti, landing page o risorse online
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {urlInputs.map((url, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="https://esempio.com"
                          value={url}
                          onChange={(e) => {
                            const newUrls = [...urlInputs];
                            newUrls[index] = e.target.value;
                            setUrlInputs(newUrls);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setUrlInputs(urlInputs.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setUrlInputs([...urlInputs, ""])}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Aggiungi URL
                    </Button>
                  </CardContent>
                </Card>

                {/* Testo Libero */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-purple-600" />
                      Descrizione Testuale
                    </CardTitle>
                    <CardDescription>
                      Descrivi il tuo business, servizi, clienti tipo, etc.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="business-name-input" className="text-sm font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-purple-600" />
                          Nome Business (opzionale)
                        </Label>
                        <Input
                          id="business-name-input"
                          placeholder="Es: Studio Rossi & Partners"
                          value={businessNameInput}
                          onChange={(e) => setBusinessNameInput(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="consultant-display-name-input" className="text-sm font-medium flex items-center gap-2">
                          <User className="h-4 w-4 text-purple-600" />
                          Nome Display Consulente (opzionale)
                        </Label>
                        <Input
                          id="consultant-display-name-input"
                          placeholder="Es: Marco Rossi"
                          value={consultantDisplayNameInput}
                          onChange={(e) => setConsultantDisplayNameInput(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Descrizione del Business</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!textInput.trim()) {
                              toast({
                                title: "⚠️ Testo mancante",
                                description: "Inserisci una descrizione da migliorare.",
                                variant: "destructive",
                              });
                              return;
                            }
                            setIsImprovingText(true);
                            try {
                              const res = await fetch("/api/consultant/onboarding/ai-ideas/improve-text", {
                                method: "POST",
                                headers: {
                                  ...getAuthHeaders(),
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ text: textInput }),
                              });
                              if (!res.ok) throw new Error("Errore nel miglioramento del testo");
                              const data = await res.json();
                              if (data.improvedText) {
                                setTextInput(data.improvedText);
                                toast({
                                  title: "✨ Testo migliorato!",
                                  description: "La descrizione è stata espansa e migliorata dall'AI.",
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: "❌ Errore",
                                description: error.message,
                                variant: "destructive",
                              });
                            } finally {
                              setIsImprovingText(false);
                            }
                          }}
                          disabled={isImprovingText || !textInput.trim()}
                        >
                          {isImprovingText ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4 mr-2" />
                          )}
                          Migliora con AI
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Es: Siamo un'agenzia immobiliare che gestisce vendite e affitti di immobili residenziali e commerciali. I nostri clienti principali sono privati e aziende che cercano soluzioni personalizzate..."
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        rows={8}
                        className="resize-none"
                      />
                      <p className="text-xs text-gray-500">
                        {textInput.length} caratteri
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pannello Destra - Configurazione */}
              <div className="space-y-6">
                {/* Tipo Agente */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-purple-600" />
                      Tipo Agente
                    </CardTitle>
                    <CardDescription>
                      Seleziona il tipo di agente da creare
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="agent-type-inbound"
                        checked={selectedIntegrations.includes("reactive_lead")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIntegrations([...selectedIntegrations.filter(i => !["reactive_lead", "proactive_setter", "informative_advisor"].includes(i)), "reactive_lead"]);
                          } else {
                            setSelectedIntegrations(selectedIntegrations.filter(i => i !== "reactive_lead"));
                          }
                        }}
                      />
                      <label
                        htmlFor="agent-type-inbound"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <Phone className="h-4 w-4 text-blue-600" />
                        📞 Inbound (Ricevi lead)
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="agent-type-outbound"
                        checked={selectedIntegrations.includes("proactive_setter")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIntegrations([...selectedIntegrations.filter(i => !["reactive_lead", "proactive_setter", "informative_advisor"].includes(i)), "proactive_setter"]);
                          } else {
                            setSelectedIntegrations(selectedIntegrations.filter(i => i !== "proactive_setter"));
                          }
                        }}
                      />
                      <label
                        htmlFor="agent-type-outbound"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        🎯 Outbound (Contatta lead)
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="agent-type-advisory"
                        checked={selectedIntegrations.includes("informative_advisor")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIntegrations([...selectedIntegrations, "informative_advisor"]);
                          } else {
                            setSelectedIntegrations(selectedIntegrations.filter(i => i !== "informative_advisor"));
                          }
                        }}
                      />
                      <label
                        htmlFor="agent-type-advisory"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <BookOpen className="h-4 w-4 text-purple-600" />
                        💬 Consulenziale (Supporto clienti)
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="agent-type-customer-success"
                        checked={selectedIntegrations.includes("customer_success")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIntegrations([...selectedIntegrations, "customer_success"]);
                          } else {
                            setSelectedIntegrations(selectedIntegrations.filter(i => i !== "customer_success"));
                          }
                        }}
                      />
                      <label
                        htmlFor="agent-type-customer-success"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <Users className="h-4 w-4 text-pink-600" />
                        💜 Customer Success (Post-Vendita)
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="agent-type-intake"
                        checked={selectedIntegrations.includes("intake_coordinator")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIntegrations([...selectedIntegrations, "intake_coordinator"]);
                          } else {
                            setSelectedIntegrations(selectedIntegrations.filter(i => i !== "intake_coordinator"));
                          }
                        }}
                      />
                      <label
                        htmlFor="agent-type-intake"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <ClipboardCheck className="h-4 w-4 text-amber-600" />
                        📋 Intake Coordinator (Documenti)
                      </label>
                    </div>

                    <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 mt-4">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-xs">
                        Seleziona almeno un tipo di agente per generare idee mirate
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                {/* Numero di Idee */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wand2 className="h-5 w-5 text-purple-600" />
                      Quante Idee?
                    </CardTitle>
                    <CardDescription>
                      Numero di proposte da generare
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={numberOfIdeas}
                          onChange={(e) => setNumberOfIdeas(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                          className="w-20"
                        />
                        <span className="text-sm text-gray-600">idee (1-10)</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Più idee generi, più tempo ci vorrà per l'elaborazione
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Genera Idee */}
                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-6"
                  disabled={isGenerating || (uploadedFiles.length === 0 && urlInputs.filter(u => u).length === 0 && !textInput && selectedKnowledgeDocIds.length === 0) || selectedIntegrations.length === 0}
                  onClick={async () => {
                    setIsGenerating(true);
                    try {
                      let uploadedFilesText: { fileName: string; text: string }[] = [];

                      if (uploadedFiles.length > 0) {
                        toast({
                          title: "📄 Elaborazione file...",
                          description: `Estrazione testo da ${uploadedFiles.length} file...`,
                        });

                        const formData = new FormData();
                        for (const file of uploadedFiles) {
                          formData.append("files", file);
                        }

                        const uploadRes = await fetch("/api/consultant/onboarding/ai-ideas/upload-files", {
                          method: "POST",
                          headers: getAuthHeaders(),
                          body: formData,
                        });

                        if (!uploadRes.ok) {
                          const uploadError = await uploadRes.json();
                          throw new Error(uploadError.error || "Errore durante l'upload dei file");
                        }

                        const uploadData = await uploadRes.json();
                        uploadedFilesText = uploadData.data || [];

                        const successCount = uploadedFilesText.filter(f => f.text).length;
                        if (successCount > 0) {
                          toast({
                            title: "✅ File elaborati",
                            description: `Estratto testo da ${successCount} file`,
                          });
                        }
                      }

                      const res = await fetch("/api/consultant/onboarding/ai-ideas/generate", {
                        method: "POST",
                        headers: {
                          ...getAuthHeaders(),
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          textDescription: textInput,
                          urls: urlInputs.filter(u => u),
                          knowledgeDocIds: selectedKnowledgeDocIds,
                          integrations: selectedIntegrations,
                          numberOfIdeas: numberOfIdeas,
                          uploadedFilesText: uploadedFilesText,
                          businessName: businessNameInput || undefined,
                          consultantDisplayName: consultantDisplayNameInput || undefined,
                        }),
                      });

                      if (!res.ok) {
                        const errorData = await res.json();
                        throw new Error(errorData.message || errorData.error || "Errore nella generazione delle idee");
                      }

                      const data = await res.json();
                      setGeneratedIdeas(data.data || data.ideas || []);
                      // Note: uploadedFiles are kept until agent is created (they'll be uploaded to KB)
                      toast({
                        title: "✨ Idee generate!",
                        description: `Sono state generate ${(data.data || data.ideas)?.length || 0} idee per i tuoi agenti.`,
                      });
                    } catch (error: any) {
                      toast({
                        title: "❌ Errore",
                        description: error.message || "Impossibile generare le idee. Riprova.",
                        variant: "destructive",
                      });
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {uploadedFiles.length > 0 ? "Elaborazione file..." : "Generazione in corso..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Genera Idee AI
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Idee Generate */}
            {generatedIdeas.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Idee Generate</h3>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700">
                    {generatedIdeas.length} proposte
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {generatedIdeas.map((idea, idx) => (
                    <Card key={idea.id || idx} className="border-2 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                              <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{idea.name}</CardTitle>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {idea.suggestedAgentType && (
                                  <Badge 
                                    className={`text-xs ${
                                      idea.suggestedAgentType === 'reactive_lead' 
                                        ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300' 
                                        : idea.suggestedAgentType === 'proactive_setter'
                                        ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300'
                                        : idea.suggestedAgentType === 'informative_advisor'
                                        ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300'
                                        : idea.suggestedAgentType === 'customer_success'
                                        ? 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900/30 dark:text-pink-300'
                                        : idea.suggestedAgentType === 'intake_coordinator'
                                        ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300'
                                        : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/30 dark:text-gray-300'
                                    }`}
                                  >
                                    {idea.suggestedAgentType === 'reactive_lead' 
                                      ? '📞 Inbound' 
                                      : idea.suggestedAgentType === 'proactive_setter'
                                      ? '🎯 Outbound'
                                      : idea.suggestedAgentType === 'informative_advisor'
                                      ? '💬 Consulenziale'
                                      : idea.suggestedAgentType === 'customer_success'
                                      ? '💜 Customer Success'
                                      : idea.suggestedAgentType === 'intake_coordinator'
                                      ? '📋 Intake'
                                      : idea.suggestedAgentType}
                                  </Badge>
                                )}
                                {idea.personality && (
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {idea.personality}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {idea.description}
                        </p>

                        {idea.whoWeHelp && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                              👥 Chi aiutiamo:
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {idea.whoWeHelp}
                            </p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            Integrazioni:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {(idea.integrations || idea.integrationTypes || []).map((int: string) => (
                              <Badge key={int} variant="secondary" className="text-xs">
                                {int === 'booking' ? (
                                  <><Calendar className="h-3 w-3 mr-1" /> Appuntamenti</>
                                ) : (
                                  <><BookOpen className="h-3 w-3 mr-1" /> Consulenza</>
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {idea.useCases && idea.useCases.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                              Casi d'uso:
                            </p>
                            <ul className="space-y-1">
                              {idea.useCases.slice(0, 3).map((useCase: string, idx: number) => (
                                <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                                  <ChevronRight className="h-3 w-3 mt-0.5 text-purple-500 flex-shrink-0" />
                                  <span>{useCase}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Button
                            className="w-full bg-purple-600 hover:bg-purple-700"
                            disabled={saveIdeaMutation.isPending}
                            onClick={() => saveIdeaMutation.mutate(idea)}
                          >
                            {saveIdeaMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Salva Idea
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
                            disabled={saveAndCreateAgentMutation.isPending}
                            onClick={() => saveAndCreateAgentMutation.mutate({ idea, filesToUpload: uploadedFiles })}
                          >
                            {saveAndCreateAgentMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <ArrowRight className="h-4 w-4 mr-2" />
                            )}
                            Crea Agente Subito
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Idee Salvate */}
            {savedIdeas.length > 0 && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    Idee Salvate ({savedIdeas.length})
                  </CardTitle>
                  <CardDescription>
                    Idee che hai salvato per usare in futuro
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(groupedSavedIdeas).map(([groupName, ideas]) => (
                    ideas.length > 0 && (
                      <div key={groupName} className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {groupName}
                          <Badge variant="outline" className="text-xs">
                            {ideas.length}
                          </Badge>
                        </h4>
                        <div className="space-y-2">
                          {ideas.map((idea: any) => (
                            <div key={idea.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Bot className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-sm truncate">{idea.name}</p>
                                    {idea.suggestedAgentType && (
                                      <Badge 
                                        className={`text-xs ${
                                          idea.suggestedAgentType === 'reactive_lead' 
                                            ? 'bg-blue-100 text-blue-700 border-blue-300' 
                                            : idea.suggestedAgentType === 'proactive_setter'
                                            ? 'bg-green-100 text-green-700 border-green-300'
                                            : idea.suggestedAgentType === 'informative_advisor'
                                            ? 'bg-purple-100 text-purple-700 border-purple-300'
                                            : idea.suggestedAgentType === 'customer_success'
                                            ? 'bg-pink-100 text-pink-700 border-pink-300'
                                            : idea.suggestedAgentType === 'intake_coordinator'
                                            ? 'bg-amber-100 text-amber-700 border-amber-300'
                                            : 'bg-gray-100 text-gray-700 border-gray-300'
                                        }`}
                                      >
                                        {idea.suggestedAgentType === 'reactive_lead' 
                                          ? 'Inbound' 
                                          : idea.suggestedAgentType === 'proactive_setter'
                                          ? 'Outbound'
                                          : idea.suggestedAgentType === 'informative_advisor'
                                          ? 'Consulenziale'
                                          : idea.suggestedAgentType === 'customer_success'
                                          ? 'Customer Success'
                                          : idea.suggestedAgentType === 'intake_coordinator'
                                          ? 'Intake'
                                          : idea.suggestedAgentType}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 truncate">{idea.description}</p>
                                  {idea.createdAt && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      {format(new Date(idea.createdAt), "d MMM yyyy, HH:mm", { locale: it })}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 flex-shrink-0 ml-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/consultant/whatsapp/agent/new?fromIdea=${idea.id}`)}
                                >
                                  Crea Agente
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={deleteIdeaMutation.isPending}
                                  onClick={() => deleteIdeaMutation.mutate(idea.id)}
                                >
                                  {deleteIdeaMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="licenses" className="space-y-6">
            <Alert className="bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-800">
              <Key className="h-5 w-5 text-violet-600" />
              <AlertDescription>
                <strong>Gestione Licenze</strong><br />
                Monitora le tue licenze Level 2 (Bronze) e Level 3 (Silver), visualizza le sottoscrizioni attive dei tuoi clienti e gestisci il tuo piano.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* License Dashboard Card */}
              <Card className="border-2 border-violet-200 dark:border-violet-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-violet-600" />
                    Dashboard Licenze
                  </CardTitle>
                  <CardDescription>
                    Visualizza l'utilizzo delle tue licenze
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {licensesQuery.isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                    </div>
                  ) : (
                    <>
                      {/* Level 2 (Bronze) Progress */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LevelBadge level="2" size="md" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Licenze Bronze
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {licenses.level2Used}/{licenses.level2Total}
                          </span>
                        </div>
                        <Progress 
                          value={(licenses.level2Used / licenses.level2Total) * 100} 
                          className={`h-3 ${
                            licenses.level2Used / licenses.level2Total >= 0.9 
                              ? "[&>div]:bg-red-500" 
                              : licenses.level2Used / licenses.level2Total >= 0.7 
                              ? "[&>div]:bg-amber-500" 
                              : "[&>div]:bg-amber-600"
                          }`}
                        />
                        {licenses.level2Used / licenses.level2Total >= 0.9 && (
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs font-medium">Stai per raggiungere il limite!</span>
                          </div>
                        )}
                      </div>

                      {/* Level 3 (Silver) Progress */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LevelBadge level="3" size="md" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Licenze Silver
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {licenses.level3Used}/{licenses.level3Total}
                          </span>
                        </div>
                        <Progress 
                          value={(licenses.level3Used / licenses.level3Total) * 100} 
                          className={`h-3 ${
                            licenses.level3Used / licenses.level3Total >= 0.9 
                              ? "[&>div]:bg-red-500" 
                              : licenses.level3Used / licenses.level3Total >= 0.7 
                              ? "[&>div]:bg-amber-500" 
                              : "[&>div]:bg-slate-500"
                          }`}
                        />
                        {licenses.level3Used / licenses.level3Total >= 0.9 && (
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs font-medium">Stai per raggiungere il limite!</span>
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                            <p className="text-2xl font-bold text-amber-600">{licenses.level2Total - licenses.level2Used}</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">Bronze disponibili</p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-slate-600">{licenses.level3Total - licenses.level3Used}</p>
                            <p className="text-xs text-slate-700 dark:text-slate-400">Silver disponibili</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Buy Employee Licenses Card */}
              <Card className="border-2 border-violet-200 dark:border-violet-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-violet-600" />
                    Licenze Dipendenti
                  </CardTitle>
                  <CardDescription>
                    Acquista licenze per il tuo team
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current Employee Licenses */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-violet-100 text-violet-700">Dipendenti</Badge>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Licenze Team
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {licenses.employeeUsed}/{licenses.employeeTotal}
                      </span>
                    </div>
                    <Progress 
                      value={licenses.employeeTotal > 0 ? (licenses.employeeUsed / licenses.employeeTotal) * 100 : 0} 
                      className={`h-3 ${
                        licenses.employeeTotal > 0 && licenses.employeeUsed / licenses.employeeTotal >= 0.9 
                          ? "[&>div]:bg-red-500" 
                          : "[&>div]:bg-violet-500"
                      }`}
                    />
                    {licenses.employeeTotal === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Non hai ancora acquistato licenze dipendenti
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <div className="bg-violet-50 dark:bg-violet-950/20 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-violet-700">Pacchetto 10 Licenze</span>
                        <span className="text-2xl font-bold text-violet-700">€200</span>
                      </div>
                      <p className="text-sm text-violet-600">
                        €20 per licenza dipendente/mese
                      </p>
                    </div>
                    
                    <Button 
                      className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                      disabled={buyLicensesMutation.isPending}
                      onClick={() => buyLicensesMutation.mutate(10)}
                    >
                      {buyLicensesMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Caricamento...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Acquista 10 Licenze
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gestione Utenti Registrati */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-violet-600" />
                      Utenti Registrati
                    </CardTitle>
                    <CardDescription>
                      Gestisci gli utenti registrati suddivisi per tier
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                      <Shield className="h-3 w-3 mr-1" />
                      Bronze ({userStatsQuery.data?.bronze || 0})
                    </Badge>
                    <Badge className="bg-slate-100 text-slate-700 border-slate-300">
                      <Shield className="h-3 w-3 mr-1" />
                      Argento ({userStatsQuery.data?.silver || 0})
                    </Badge>
                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
                      <Crown className="h-3 w-3 mr-1" />
                      Oro ({userStatsQuery.data?.gold || 0})
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={userManagementTab} onValueChange={(v) => setUserManagementTab(v as "bronze" | "silver" | "gold")}>
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="bronze" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
                      <Shield className="h-4 w-4 mr-2" />
                      Bronze (Gratuiti)
                    </TabsTrigger>
                    <TabsTrigger value="silver" className="data-[state=active]:bg-slate-200 data-[state=active]:text-slate-800">
                      <Shield className="h-4 w-4 mr-2" />
                      Argento (Abbonati)
                    </TabsTrigger>
                    <TabsTrigger value="gold" className="data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-800">
                      <Crown className="h-4 w-4 mr-2" />
                      Oro (Premium)
                    </TabsTrigger>
                  </TabsList>

                  {/* Bronze Users Tab */}
                  <TabsContent value="bronze" className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Cerca per email o nome..."
                        value={userSearchQuery}
                        onChange={(e) => {
                          setUserSearchQuery(e.target.value);
                          setBronzeCurrentPage(1);
                        }}
                        className="max-w-sm"
                      />
                    </div>
                    
                    {bronzeUsersQuery.isLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                      </div>
                    ) : !bronzeUsersQuery.data?.users?.length ? (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm font-medium text-gray-500">Nessun utente Bronze trovato</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Stato</TableHead>
                                <TableHead>Ultima attività</TableHead>
                                <TableHead className="text-right">Azioni</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bronzeUsersQuery.data.users.map((user: any) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.email}</TableCell>
                                  <TableCell>{user.firstName} {user.lastName}</TableCell>
                                  <TableCell>
                                    <Badge variant={user.isActive ? "default" : "outline"} className={user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                                      {user.isActive ? "Attivo" : "Inattivo"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-gray-500">
                                    {user.lastLoginAt ? format(new Date(user.lastLoginAt), "d MMM yyyy HH:mm", { locale: it }) : "Mai"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setUserToDelete({ id: user.id, email: user.email })}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                          {bronzeUsersQuery.data.users.map((user: any) => (
                            <div key={user.id} className="p-4 border rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{user.email}</span>
                                <Badge variant={user.isActive ? "default" : "outline"} className={user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                                  {user.isActive ? "Attivo" : "Inattivo"}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600">{user.firstName} {user.lastName}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                  {user.lastLoginAt ? format(new Date(user.lastLoginAt), "d MMM yyyy", { locale: it }) : "Mai"}
                                </span>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => setUserToDelete({ id: user.id, email: user.email })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Pagination */}
                        {bronzeUsersQuery.data.totalPages > 1 && (
                          <div className="flex items-center justify-between pt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBronzeCurrentPage(p => Math.max(1, p - 1))}
                              disabled={bronzeCurrentPage === 1}
                            >
                              Precedente
                            </Button>
                            <span className="text-sm text-gray-500">
                              Pagina {bronzeCurrentPage} di {bronzeUsersQuery.data.totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBronzeCurrentPage(p => Math.min(bronzeUsersQuery.data.totalPages, p + 1))}
                              disabled={bronzeCurrentPage >= bronzeUsersQuery.data.totalPages}
                            >
                              Successiva
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  {/* Silver Users Tab */}
                  <TabsContent value="silver" className="space-y-4">
                    {silverUsersQuery.isLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                      </div>
                    ) : !silverUsersQuery.data?.users?.length ? (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm font-medium text-gray-500">Nessun utente Argento trovato</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Stato</TableHead>
                                <TableHead>Data Inizio</TableHead>
                                <TableHead className="text-right">Azioni</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {silverUsersQuery.data.users.map((user: any) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.clientEmail}</TableCell>
                                  <TableCell>{user.clientName || "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant={user.status === "active" ? "default" : "outline"} className={user.status === "active" ? "bg-green-100 text-green-700" : user.status === "canceled" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}>
                                      {user.status === "active" ? "Attivo" : user.status === "canceled" ? "Annullato" : user.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-gray-500">
                                    {user.startDate ? format(new Date(user.startDate), "d MMM yyyy", { locale: it }) : "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                          {silverUsersQuery.data.users.map((user: any) => (
                            <div key={user.id} className="p-4 border rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{user.clientEmail}</span>
                                <Badge variant={user.status === "active" ? "default" : "outline"} className={user.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                  {user.status === "active" ? "Attivo" : "Annullato"}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600">{user.clientName || "—"}</p>
                              <span className="text-xs text-gray-500">
                                {user.startDate ? format(new Date(user.startDate), "d MMM yyyy", { locale: it }) : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* Gold Users Tab */}
                  <TabsContent value="gold" className="space-y-4">
                    {goldUsersQuery.isLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
                      </div>
                    ) : !goldUsersQuery.data?.users?.length ? (
                      <div className="text-center py-8">
                        <Crown className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm font-medium text-gray-500">Nessun utente Oro trovato</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Stato</TableHead>
                                <TableHead>Data Inizio</TableHead>
                                <TableHead className="text-right">Azioni</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {goldUsersQuery.data.users.map((user: any) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.clientEmail}</TableCell>
                                  <TableCell>{user.clientName || "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant={user.status === "active" ? "default" : "outline"} className={user.status === "active" ? "bg-green-100 text-green-700" : user.status === "canceled" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}>
                                      {user.status === "active" ? "Attivo" : user.status === "canceled" ? "Annullato" : user.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-gray-500">
                                    {user.startDate ? format(new Date(user.startDate), "d MMM yyyy", { locale: it }) : "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                          {goldUsersQuery.data.users.map((user: any) => (
                            <div key={user.id} className="p-4 border rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{user.clientEmail}</span>
                                <Badge variant={user.status === "active" ? "default" : "outline"} className={user.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                  {user.status === "active" ? "Attivo" : "Annullato"}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600">{user.clientName || "—"}</p>
                              <span className="text-xs text-gray-500">
                                {user.startDate ? format(new Date(user.startDate), "d MMM yyyy", { locale: it }) : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* AlertDialog per conferma eliminazione utente Bronze */}
            <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sei sicuro di voler eliminare l'utente <strong>{userToDelete?.email}</strong>?
                    Questa azione non può essere annullata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => userToDelete && deleteBronzeUserMutation.mutate(userToDelete.id)}
                    disabled={deleteBronzeUserMutation.isPending}
                  >
                    {deleteBronzeUserMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Eliminazione...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Active Subscriptions List */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-violet-600" />
                  Sottoscrizioni Attive
                </CardTitle>
                <CardDescription>
                  Clienti con sottoscrizioni Level 2 o Level 3 attive
                </CardDescription>
              </CardHeader>
              <CardContent>
                {subscriptionsQuery.isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Nessuna sottoscrizione attiva
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 max-w-md mx-auto">
                      Quando i tuoi clienti acquisteranno una licenza Level 2 o Level 3, 
                      appariranno qui con tutti i dettagli della loro sottoscrizione.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Livello</TableHead>
                          <TableHead>Stato</TableHead>
                          <TableHead>Data Inizio</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptions.map((sub: any) => (
                          <TableRow key={sub.id}>
                            <TableCell className="font-medium">
                              {sub.clientName || "—"}
                            </TableCell>
                            <TableCell className="text-gray-500">
                              {sub.clientEmail}
                            </TableCell>
                            <TableCell>
                              <LevelBadge level={sub.level} size="sm" />
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={sub.status === "active" ? "default" : "outline"}
                                className={
                                  sub.status === "active" 
                                    ? "bg-green-100 text-green-700 border-green-300" 
                                    : sub.status === "pending"
                                    ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                                    : sub.status === "canceled"
                                    ? "bg-red-100 text-red-700 border-red-300"
                                    : "bg-gray-100 text-gray-700 border-gray-300"
                                }
                              >
                                {sub.status === "active" ? "Attivo" 
                                  : sub.status === "pending" ? "In Attesa"
                                  : sub.status === "canceled" ? "Annullato"
                                  : sub.status === "expired" ? "Scaduto"
                                  : sub.status === "past_due" ? "Scaduto"
                                  : sub.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-500">
                              {sub.startDate 
                                ? format(new Date(sub.startDate), "d MMM yyyy", { locale: it })
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employee License Purchases History */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-violet-600" />
                  Storico Acquisti Licenze
                </CardTitle>
                <CardDescription>
                  I tuoi acquisti di licenze dipendenti
                </CardDescription>
              </CardHeader>
              <CardContent>
                {purchasesQuery.isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                  </div>
                ) : !purchasesQuery.data?.length ? (
                  <div className="text-center py-8">
                    <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Nessun acquisto effettuato
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Gli acquisti di licenze dipendenti appariranno qui
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Licenze</TableHead>
                          <TableHead>Importo</TableHead>
                          <TableHead>Stato</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchasesQuery.data.map((purchase: any) => (
                          <TableRow key={purchase.id}>
                            <TableCell>
                              {format(new Date(purchase.createdAt), "d MMM yyyy", { locale: it })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{purchase.quantity} licenze</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              €{(purchase.amountCents / 100).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                className={
                                  purchase.status === "completed" 
                                    ? "bg-green-100 text-green-700" 
                                    : purchase.status === "pending"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                                }
                              >
                                {purchase.status === "completed" ? "Completato" 
                                  : purchase.status === "pending" ? "In attesa"
                                  : "Fallito"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Invoices Section */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-violet-600" />
                  Storico Fatture
                </CardTitle>
                <CardDescription>
                  Riepilogo mensile delle tue entrate e commissioni
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Nessuna fattura disponibile
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                    Quando avrai transazioni attive, qui troverai il riepilogo mensile con le tue entrate, 
                    la quota piattaforma e i costi AI.
                  </p>
                  <Badge variant="outline" className="text-xs">
                    Funzionalità in arrivo con Stripe
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Page Link Section */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5 text-violet-600" />
                  Pagina Prezzi Pubblica
                </CardTitle>
                <CardDescription>
                  Condividi la tua pagina prezzi con i potenziali clienti
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {consultantData?.pricingPageSlug ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg">
                      <Input 
                        readOnly 
                        value={`${window.location.origin}/c/${consultantData.pricingPageSlug}/pricing`}
                        className="flex-1 bg-white dark:bg-gray-800"
                      />
                      <Button 
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/c/${consultantData.pricingPageSlug}/pricing`);
                          toast({
                            title: "✅ Link copiato!",
                            description: "Il link alla pagina prezzi è stato copiato negli appunti.",
                          });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copia
                      </Button>
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => window.open(`/c/${consultantData.pricingPageSlug}/pricing`, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visualizza Pagina
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => navigate("/consultant/settings")}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configura Prezzi
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Link className="h-10 w-10 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Pagina prezzi non configurata
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                      Configura la tua pagina prezzi pubblica per permettere ai clienti di acquistare sottoscrizioni.
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => navigate("/consultant/settings")}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configura Pagina Prezzi
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>


      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare l'agente <strong>"{configToDelete?.agentName}"</strong>?
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                "Elimina"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConsultantAIAssistant />
    </WhatsAppLayout>
  );
}
