import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { PageLayout } from "@/components/layout/PageLayout";
import { Message } from "@/components/ai-assistant/Message";
import { ThinkingBubble } from "@/components/ai-assistant/ThinkingBubble";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  MapPin,
  Download,
  RefreshCw,
  ExternalLink,
  Phone,
  Mail,
  Star,
  Globe,
  Copy,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Building2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  Info,
  Zap,
  TrendingUp,
  Users,
  FileText,
  Map as MapIcon,
  Sparkles,
  Target,
  MessageSquare,
  Send,
  Save,
  DollarSign,
  Calendar,
  ClipboardList,
  Bot,
  ArrowUpDown,
  Crosshair,
  Activity,
  Shield,
  AlertCircle,
  Cog,
  ArrowRight,
  Play,
  Clock,
  Check,
  PhoneCall,
  MessageCircle,
  MailIcon,
  Route,
  PenLine,
  AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  searchId: string;
  businessName: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: number | null;
  reviewsCount: number | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  hours: any;
  websiteData: any;
  scrapeStatus: string | null;
  source: string | null;
  leadStatus: string | null;
  leadNotes: string | null;
  leadContactedAt: string | null;
  leadNextAction: string | null;
  leadNextActionDate: string | null;
  leadValue: number | null;
  aiSalesSummary: string | null;
  aiCompatibilityScore: number | null;
  aiSalesSummaryGeneratedAt: string | null;
  outreachTaskId: string | null;
  contactedChannels: string[] | null;
  createdAt: string;
}

interface SearchRecord {
  id: string;
  consultantId: string;
  query: string;
  location: string;
  status: string;
  resultsCount: number | null;
  metadata: any;
  originRole: string | null;
  createdAt: string;
}

interface SalesContext {
  id?: string;
  servicesOffered: string;
  targetAudience: string;
  valueProposition: string;
  pricingInfo: string;
  competitiveAdvantages: string;
  idealClientProfile: string;
  salesApproach: string;
  caseStudies: string;
  additionalContext: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface KeywordSuggestion {
  keyword: string;
  engine: "maps" | "search";
  reason: string;
}

const LEAD_STATUSES = [
  { value: "nuovo", label: "Nuovo", color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700", borderColor: "border-l-gray-300" },
  { value: "contattato", label: "Contattato", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800", borderColor: "border-l-blue-400" },
  { value: "in_trattativa", label: "In trattativa", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800", borderColor: "border-l-amber-400" },
  { value: "proposta_inviata", label: "Proposta inviata", color: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800", borderColor: "border-l-violet-400" },
  { value: "chiuso_vinto", label: "Chiuso vinto", color: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800", borderColor: "border-l-emerald-500" },
  { value: "chiuso_perso", label: "Chiuso perso", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800", borderColor: "border-l-red-400" },
  { value: "non_interessato", label: "Non interessato", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", borderColor: "border-l-slate-300" },
  { value: "non_raggiungibile", label: "Non raggiungibile", color: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800", borderColor: "border-l-orange-400" },
];

function getLeadStatusInfo(status: string | null) {
  return LEAD_STATUSES.find(s => s.value === (status || "nuovo")) || LEAD_STATUSES[0];
}

function getScoreBar(score: number | null) {
  if (score === null || score === undefined) return null;
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 70 ? "text-emerald-700 dark:text-emerald-400" : score >= 40 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400";
  return (
    <div className="flex items-center gap-1.5 min-w-[60px]">
      <span className={`text-xs font-bold ${textColor}`}>{score}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ieri";
  if (days < 7) return `${days}g fa`;
  return new Date(dateStr).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export default function ConsultantLeadScraper() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState("ricerca");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchLimit, setSearchLimit] = useState(20);
  const [searchEngine, setSearchEngine] = useState<"google_maps" | "google_search">("google_maps");
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterRatingMin, setFilterRatingMin] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterLeadStatus, setFilterLeadStatus] = useState("tutti");
  const [showFilters, setShowFilters] = useState(false);

  const [salesContext, setSalesContext] = useState<SalesContext>({
    servicesOffered: "", targetAudience: "", valueProposition: "", pricingInfo: "",
    competitiveAdvantages: "", idealClientProfile: "", salesApproach: "", caseStudies: "", additionalContext: "",
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [crmFilterStatus, setCrmFilterStatus] = useState("tutti");
  const [crmSearch, setCrmSearch] = useState("");
  const [crmSourceFilter, setCrmSourceFilter] = useState<"tutti" | "google_maps" | "google_search">("tutti");
  const [crmChannelView, setCrmChannelView] = useState<"tutti" | "nuovi" | "con_telefono" | "con_email" | "wa" | "voice" | "email" | "multi">("tutti");
  const [historySourceFilter, setHistorySourceFilter] = useState<"tutti" | "google_maps" | "google_search">("tutti");
  const [historyPopoverOpen, setHistoryPopoverOpen] = useState(false);

  const [keywordSuggestions, setKeywordSuggestions] = useState<KeywordSuggestion[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [showKeywords, setShowKeywords] = useState(false);
  const [triggeringHunter, setTriggeringHunter] = useState(false);
  const [hunterTriggerResult, setHunterTriggerResult] = useState<{ success: boolean; tasks?: number; error?: string } | null>(null);

  const [analyzingCrm, setAnalyzingCrm] = useState(false);
  const [crmAnalysisResult, setCrmAnalysisResult] = useState<{ success: boolean; analyzed?: number; actionable?: number; tasks_created?: number; skipped?: number; error?: string; noPlan?: boolean } | null>(null);

  const [showPlanPanel, setShowPlanPanel] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [planChatMessages, setPlanChatMessages] = useState<ChatMessage[]>([]);
  const [planChatInput, setPlanChatInput] = useState("");
  const [planChatLoading, setPlanChatLoading] = useState(false);
  const [planExecuting, setPlanExecuting] = useState(false);
  const planChatEndRef = useRef<HTMLDivElement>(null);

  const [sortBy, setSortBy] = useState<"default" | "score" | "rating" | "name">("default");

  const [outreachChannelFilter, setOutreachChannelFilter] = useState<"tutti" | "voice" | "whatsapp" | "email">("tutti");
  const [outreachStatusFilter, setOutreachStatusFilter] = useState<"tutti" | "waiting_approval" | "scheduled" | "completed" | "failed">("tutti");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedContextIds, setExpandedContextIds] = useState<Set<string>>(new Set());
  const [batchApproving, setBatchApproving] = useState(false);

  const [hunterSingleLeadDialog, setHunterSingleLeadDialog] = useState<{
    open: boolean;
    lead: SearchResult | null;
    channels: { voice: boolean; whatsapp: boolean; email: boolean };
    voiceTargetPhone: string;
    loading: boolean;
  }>({ open: false, lead: null, channels: { voice: true, whatsapp: true, email: true }, voiceTargetPhone: '', loading: false });

  const { data: searches = [], isLoading: searchesLoading } = useQuery<SearchRecord[]>({
    queryKey: ["/api/lead-scraper/searches"],
    queryFn: async () => {
      const res = await fetch("/api/lead-scraper/searches", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch searches");
      return res.json();
    },
  });

  const buildResultsUrl = () => {
    if (!selectedSearchId) return null;
    const params = new URLSearchParams();
    if (filterHasEmail) params.set("has_email", "true");
    if (filterHasPhone) params.set("has_phone", "true");
    if (filterRatingMin) params.set("rating_min", filterRatingMin);
    if (filterCategory) params.set("category", filterCategory);
    if (filterSearch) params.set("search", filterSearch);
    if (filterLeadStatus !== "tutti") params.set("lead_status", filterLeadStatus);
    const qs = params.toString();
    return `/api/lead-scraper/searches/${selectedSearchId}/results${qs ? `?${qs}` : ""}`;
  };

  const resultsUrl = buildResultsUrl();

  const { data: results = [], isLoading: resultsLoading } = useQuery<SearchResult[]>({
    queryKey: [resultsUrl],
    queryFn: async () => {
      if (!resultsUrl) return [];
      const res = await fetch(resultsUrl, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
    enabled: !!resultsUrl,
  });

  const allResultsParams = useMemo(() => {
    const p = new URLSearchParams();
    if (crmFilterStatus !== "tutti") p.set("lead_status", crmFilterStatus);
    if (crmSearch.trim()) p.set("search", crmSearch.trim());
    if (crmSourceFilter !== "tutti") p.set("source", crmSourceFilter);
    return p.toString();
  }, [crmFilterStatus, crmSearch, crmSourceFilter]);

  const { data: allResults = [] } = useQuery<SearchResult[]>({
    queryKey: ["/api/lead-scraper/all-results", allResultsParams],
    queryFn: async () => {
      const res = await fetch(`/api/lead-scraper/all-results${allResultsParams ? `?${allResultsParams}` : ""}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch all results");
      return res.json();
    },
    enabled: activeTab === "crm",
  });

  const { data: savedSalesContext } = useQuery<SalesContext | null>({
    queryKey: ["/api/lead-scraper/sales-context"],
    queryFn: async () => {
      const res = await fetch("/api/lead-scraper/sales-context", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch sales context");
      return res.json();
    },
  });

  const { data: hunterStatus } = useQuery<{ role: string; isEnabled: boolean; lastRun: string | null; tasksCreated: number; status: string } | null>({
    queryKey: ["/api/ai-autonomy/roles/status", "hunter"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/ai-autonomy/roles/status", { headers: getAuthHeaders() });
        if (!res.ok) return null;
        const data = await res.json();
        const roles = data.roles || [];
        return roles.find((r: any) => r.role === "hunter") || null;
      } catch {
        return null;
      }
    },
    refetchInterval: 30000,
  });

  interface HunterPipelineData {
    stats: { foundToday: number; scoredToday: number; inOutreach: number; contacted: number; inNegotiation: number; notInterested: number; qualifiedWaiting: number };
    channels: Record<string, { used: number; limit: number; remaining: number; byStatus: Record<string, number>; tasks: { id: string; title: string; status: string; channel: string; aiRole: string; scheduledAt: string | null; createdAt: string | null; completedAt: string | null; resultSummary: string | null; leadName: string; leadScore: number | null; leadSector: string | null; leadId: string | null }[] }>;
    searches: { used: number; limit: number; remaining: number };
    recentActivity: { id: string; type: string; title: string; description: string; metadata: any; createdAt: string }[];
    kpis: { callResponseRate: number; waDeliveryRate: number; emailDeliveryRate: number; leadsConvertedThisWeek: number; avgTimeToFirstContact: number };
  }

  const { data: hunterPipeline, refetch: refetchPipeline } = useQuery<HunterPipelineData | null>({
    queryKey: ["/api/ai-autonomy/hunter-pipeline"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/ai-autonomy/hunter-pipeline", { headers: getAuthHeaders() });
        if (!res.ok) return null;
        return res.json();
      } catch { return null; }
    },
    enabled: activeTab === "hunter",
    refetchInterval: activeTab === "hunter" ? 15000 : false,
  });

  const [lastPipelineRefresh, setLastPipelineRefresh] = useState<Date>(new Date());
  useEffect(() => {
    if (hunterPipeline) setLastPipelineRefresh(new Date());
  }, [hunterPipeline]);

  const approveTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/ai-autonomy/tasks/${taskId}/approve`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task approvato", description: "Il task verrà eseguito a breve" });
      refetchPipeline();
    },
  });

  const rejectTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/ai-autonomy/tasks/${taskId}/reject`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to reject");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task rifiutato", description: "Il lead è stato rimesso in coda" });
      refetchPipeline();
    },
  });

  const [timelineOpen, setTimelineOpen] = useState(false);
  const [hunterConfigOpen, setHunterConfigOpen] = useState(false);

  const { data: autonomySettings, refetch: refetchAutonomy } = useQuery<any>({
    queryKey: ["/api/ai-autonomy/settings-for-hunter"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/ai-autonomy/settings", { headers: getAuthHeaders() });
        if (!res.ok) return null;
        return res.json();
      } catch { return null; }
    },
  });

  const { data: proactiveWaConfigs = [] } = useQuery<{ id: string; name: string; phoneNumber: string }[]>({
    queryKey: ["/api/whatsapp/config/proactive-for-outreach-ls"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/whatsapp/config/proactive", { headers: getAuthHeaders() });
        const data = await res.json();
        return (data.configs || []).map((c: any) => ({
          id: c.id,
          name: c.agentName || "Dipendente WA",
          phoneNumber: c.twilioWhatsappNumber || "",
        }));
      } catch { return []; }
    },
  });

  const { data: emailAccounts = [] } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ["/api/email-hub/accounts-for-outreach-ls"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/email-hub/accounts", { headers: getAuthHeaders() });
        if (!res.ok) return [];
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.data || data.accounts || []);
        return list.map((a: any) => ({
          id: a.id,
          name: a.display_name || a.displayName || a.email_address || a.emailAddress || a.email || "",
          email: a.email_address || a.emailAddress || a.email || "",
        }));
      } catch { return []; }
    },
  });

  const outreachDefaults = {
    enabled: false, require_approval: true, max_searches_per_day: 5, max_calls_per_day: 10, max_whatsapp_per_day: 15,
    max_emails_per_day: 20, score_threshold: 60, channel_priority: ["voice", "whatsapp", "email"],
    cooldown_hours: 48, whatsapp_config_id: "", voice_template_id: "", email_account_id: "",
    call_instruction_template: "", whatsapp_template_id: "", whatsapp_template_ids: [] as string[],
    cooldown_new_hours: 24, cooldown_contacted_days: 5, cooldown_negotiation_days: 7,
    max_attempts_per_lead: 3, first_contact_channel: "auto", high_score_channel: "voice",
    communication_style: "professionale", custom_instructions: "", email_signature: "", opening_hook: "",
    follow_up_sequence: [
      { day: 0, channel: "voice" },
      { day: 2, channel: "email" },
      { day: 5, channel: "whatsapp" },
      { day: 10, channel: "voice" },
    ] as { day: number; channel: string }[],
  };
  const [localOutreachOverride, setLocalOutreachOverride] = useState<Record<string, any> | null>(null);
  const outreachConfig = { ...outreachDefaults, ...(autonomySettings?.outreach_config || {}), ...(localOutreachOverride || {}) };

  useEffect(() => {
    if (autonomySettings?.outreach_config) {
      setLocalOutreachOverride(null);
    }
  }, [autonomySettings?.outreach_config]);

  const { data: fetchedVoiceTemplates = [] } = useQuery<{ id: string; name: string; description: string }[]>({
    queryKey: ["/api/voice/non-client-settings/outbound-templates"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/voice/non-client-settings", { headers: getAuthHeaders() });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.availableOutboundTemplates || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description || "",
        }));
      } catch { return []; }
    },
  });

  const voiceTemplateOptions = fetchedVoiceTemplates.length > 0 ? fetchedVoiceTemplates : [
    { id: "lead-qualification", name: "Qualifica Lead", description: "Per primo contatto con lead freddi" },
    { id: "appointment-setter", name: "Fissa Appuntamento", description: "Per proporre un incontro" },
    { id: "sales-orbitale", name: "Sales Orbitale", description: "Per lead ad alto potenziale" },
  ];

  const { data: hunterWaTemplates = [], isLoading: hunterTemplatesLoading } = useQuery<{
    id: string;
    friendlyName: string;
    bodyText: string;
    approvalStatus: string;
    useCase?: string;
  }[]>({
    queryKey: ["/api/weekly-checkin/templates"],
  });

  const [openHunterTemplateCategories, setOpenHunterTemplateCategories] = useState<Set<string>>(new Set());

  const HUNTER_TEMPLATE_CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    "Setter": { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", icon: "bg-blue-500" },
    "Follow-up": { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800", icon: "bg-orange-500" },
    "Check-in": { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800", icon: "bg-purple-500" },
    "Notifica": { bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800", icon: "bg-cyan-500" },
    "Generale": { bg: "bg-gray-50 dark:bg-gray-900/20", text: "text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-800", icon: "bg-gray-500" },
  };

  const categorizeHunterTemplate = (template: { friendlyName: string; useCase?: string }): string => {
    const name = (template.friendlyName || "").toLowerCase();
    const useCase = (template.useCase || "").toLowerCase();
    if (name.includes("setter") || useCase.includes("setter")) return "Setter";
    if (name.includes("follow-up") || name.includes("followup") || useCase.includes("follow")) return "Follow-up";
    if (name.includes("check") || useCase.includes("check")) return "Check-in";
    if (name.includes("notifica") || name.includes("promemoria") || useCase.includes("notifica")) return "Notifica";
    return "Generale";
  };

  const hunterTemplatesByCategory = useMemo(() => {
    const grouped: Record<string, typeof hunterWaTemplates> = {};
    hunterWaTemplates.forEach((template) => {
      const category = categorizeHunterTemplate(template);
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(template);
    });
    return grouped;
  }, [hunterWaTemplates]);

  const hunterSelectedTemplateIds: string[] = outreachConfig.whatsapp_template_ids || [];

  const handleHunterTemplateToggle = (templateId: string, isChecked: boolean) => {
    const currentIds = hunterSelectedTemplateIds;
    const newIds = isChecked
      ? [...currentIds, templateId]
      : currentIds.filter((id: string) => id !== templateId);
    updateOutreachConfig("whatsapp_template_ids", newIds);
  };

  const channelLabelsMap: Record<string, { label: string; color: string }> = {
    voice: { label: "Chiamate (Alessia)", color: "text-green-600" },
    whatsapp: { label: "WhatsApp (Stella)", color: "text-emerald-600" },
    email: { label: "Email (Millie)", color: "text-blue-600" },
  };

  const updateOutreachConfig = async (key: string, value: any) => {
    const newConfig = { ...outreachConfig, [key]: value };
    setLocalOutreachOverride(prev => ({ ...(prev || {}), [key]: value }));
    try {
      await fetch("/api/ai-autonomy/outreach-config", {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ outreach_config: newConfig }),
      });
      refetchAutonomy();
    } catch {}
  };

  const moveChannelPriority = (index: number, direction: "up" | "down") => {
    const arr = [...outreachConfig.channel_priority];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= arr.length) return;
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    updateOutreachConfig("channel_priority", arr);
  };

  const handleTriggerHunter = async () => {
    setTriggeringHunter(true);
    setHunterTriggerResult(null);
    try {
      const res = await fetch("/api/ai-autonomy/trigger-role/hunter", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      const data = await res.json();
      setHunterTriggerResult({ success: res.ok, tasks: data.tasks_generated || 0, error: data.error });
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      refetchPipeline();
    } catch (e: any) {
      setHunterTriggerResult({ success: false, error: e.message });
    } finally {
      setTriggeringHunter(false);
    }
  };

  const hunterMode: "autonomous" | "plan" | "approval" = outreachConfig.hunter_mode || (outreachConfig.require_approval !== false ? "approval" : "autonomous");

  const handleAnalyzeCrm = async () => {
    setAnalyzingCrm(true);
    setCrmAnalysisResult(null);
    try {
      const buildSkipDescription = (skipReasons: any, analyzed: number) => {
        if (!skipReasons) return "";
        const parts: string[] = [];
        if (skipReasons.withActiveTask > 0) parts.push(`${skipReasons.withActiveTask} con task attivo`);
        if (skipReasons.inOutreachActive > 0) parts.push(`${skipReasons.inOutreachActive} in outreach attivo`);
        if (skipReasons.tooRecent > 0) parts.push(`${skipReasons.tooRecent} troppo recenti`);
        if (skipReasons.recentlyContacted > 0) parts.push(`${skipReasons.recentlyContacted} contattati di recente`);
        if (skipReasons.recentNegotiation > 0) parts.push(`${skipReasons.recentNegotiation} in trattativa recente`);
        return parts.length > 0 ? `Esclusi: ${parts.join(", ")}` : "";
      };

      if (hunterMode === "plan") {
        const res = await fetch("/api/ai-autonomy/hunter-plan/generate", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ source: "crm" }),
        });
        const data = await res.json();
        if (res.ok && data.planId) {
          setCurrentPlan(data);
          setPlanChatMessages([]);
          setPlanChatInput("");
          setShowPlanPanel(true);
          setCrmAnalysisResult({ success: true, analyzed: data.totalActions, actionable: data.leads?.length || 0 });
          const skipDesc = buildSkipDescription(data.skipReasons, data.totalActions);
          toast({ title: "Piano Hunter generato", description: `${data.leads?.length || 0} lead azionabili trovati. Rivedi il piano e approva.${skipDesc ? ` ${skipDesc}.` : ""}` });
        } else if (res.ok && !data.planId) {
          const skipTotal = data.skipReasons ? Object.values(data.skipReasons as Record<string, number>).reduce((a: number, b: number) => a + b, 0) : 0;
          setCrmAnalysisResult({ success: true, analyzed: skipTotal, actionable: 0, tasks_created: 0, noPlan: true });
          const skipDesc = buildSkipDescription(data.skipReasons, skipTotal);
          toast({ title: "Analisi CRM completata", description: skipDesc ? `${skipTotal} lead analizzati, 0 azionabili. ${skipDesc}.` : "Nessun lead necessita di attenzione al momento." });
        } else {
          setCrmAnalysisResult({ success: false, error: data.error || "Errore generazione piano" });
          toast({ title: "Errore", description: data.error || "Errore durante la generazione del piano", variant: "destructive" });
        }
      } else {
        const res = await fetch("/api/ai-autonomy/hunter-analyze-crm", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "execute" }),
        });
        const data = await res.json();
        const resultsCount = data.results?.filter((r: any) => r.status !== 'error').length || 0;
        setCrmAnalysisResult({ success: res.ok, analyzed: data.analyzed, actionable: data.actionable, tasks_created: resultsCount, skipped: data.skipped, error: data.error });
        if (res.ok) {
          const skipDesc = buildSkipDescription(data.skipReasons, data.analyzed);
          if (resultsCount > 0) {
            const parts: string[] = [];
            if (data.voiceCount > 0) parts.push(`${data.voiceCount} chiamate`);
            if (data.waCount > 0) parts.push(`${data.waCount} WA`);
            if (data.emailCount > 0) parts.push(`${data.emailCount} email`);
            toast({ title: "Analisi CRM completata", description: `${data.analyzed} lead analizzati — ${resultsCount} task individuali creati: ${parts.join(', ')}.${data.skipped > 0 ? ` ${data.skipped} saltati.` : ''}${skipDesc ? ` ${skipDesc}.` : ""}` });
          } else if (data.actionable > 0) {
            toast({ title: "Analisi CRM completata", description: `${data.analyzed} lead analizzati — ${data.actionable} azionabili ma nessun task creato (limiti raggiunti o canali non configurati).${skipDesc ? ` ${skipDesc}.` : ""}` });
          } else {
            toast({ title: "Analisi CRM completata", description: `${data.analyzed} lead analizzati — 0 azionabili.${skipDesc ? ` ${skipDesc}.` : " Tutti i lead sono aggiornati."}` });
          }
        } else {
          toast({ title: "Errore analisi CRM", description: data.error || "Errore durante l'analisi", variant: "destructive" });
        }
        refetchPipeline();
        queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      }
    } catch (e: any) {
      setCrmAnalysisResult({ success: false, error: e.message });
      toast({ title: "Errore", description: e.message || "Errore di connessione", variant: "destructive" });
    } finally {
      setAnalyzingCrm(false);
    }
  };

  const openHunterSingleLead = (lead: SearchResult) => {
    setHunterSingleLeadDialog({
      open: true,
      lead,
      channels: {
        voice: !!lead.phone,
        whatsapp: !!lead.phone,
        email: !!lead.email,
      },
      voiceTargetPhone: lead.phone || '',
      loading: false,
    });
  };

  const handleHunterSingleLead = async () => {
    const d = hunterSingleLeadDialog;
    if (!d.lead) return;
    const selectedChannels: string[] = [];
    if (d.channels.voice) selectedChannels.push('voice');
    if (d.channels.whatsapp) selectedChannels.push('whatsapp');
    if (d.channels.email) selectedChannels.push('email');
    if (selectedChannels.length === 0) {
      toast({ title: "Seleziona almeno un canale", variant: "destructive" });
      return;
    }
    setHunterSingleLeadDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/ai-autonomy/hunter-single-lead", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: d.lead.id,
          channels: selectedChannels,
          voiceTargetPhone: d.channels.voice ? (d.voiceTargetPhone || d.lead.phone || '') : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const created = data.results?.filter((r: any) => r.status !== 'error').length || 0;
        const channelNames = data.results?.filter((r: any) => r.status !== 'error').map((r: any) => r.channel === 'voice' ? 'Chiamata' : r.channel === 'whatsapp' ? 'WhatsApp' : 'Email').join(', ');
        toast({ title: `${created} task creati per ${data.leadName}`, description: `Canali: ${channelNames}. Vai alla Coda Outreach per approvare.` });
        refetchPipeline();
        setHunterSingleLeadDialog(prev => ({ ...prev, open: false }));
      } else {
        toast({ title: "Errore", description: data.error || "Errore nella creazione dei task", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Errore", description: e.message || "Errore di connessione", variant: "destructive" });
    } finally {
      setHunterSingleLeadDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const handlePlanChat = async () => {
    if (!planChatInput.trim() || planChatLoading || !currentPlan?.planId) return;
    const userMsg = planChatInput.trim();
    setPlanChatInput("");
    setPlanChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: userMsg }]);
    setPlanChatLoading(true);
    try {
      const res = await fetch("/api/ai-autonomy/hunter-plan/chat", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: currentPlan.planId,
          message: userMsg,
          conversationHistory: planChatMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setPlanChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.reply || "Nessuna risposta" }]);
      if (data.updatedPlan) {
        setCurrentPlan((prev: any) => ({ ...prev, ...data.updatedPlan }));
      }
    } catch {
      setPlanChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Errore nella comunicazione. Riprova." }]);
    } finally {
      setPlanChatLoading(false);
    }
  };

  const handleExecutePlan = async () => {
    if (!currentPlan?.planId) return;
    setPlanExecuting(true);
    try {
      const res = await fetch("/api/ai-autonomy/hunter-plan/execute", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ planId: currentPlan.planId }),
      });
      const data = await res.json();
      if (res.ok) {
        const successCount = data.results?.filter((r: any) => r.status !== 'error').length || 0;
        const parts: string[] = [];
        if (data.voiceCount > 0) parts.push(`${data.voiceCount} chiamate`);
        if (data.waCount > 0) parts.push(`${data.waCount} WA`);
        if (data.emailCount > 0) parts.push(`${data.emailCount} email`);
        toast({ title: "Piano eseguito", description: `${successCount} task individuali creati${parts.length ? ': ' + parts.join(', ') : ''}` });
        setShowPlanPanel(false);
        setCurrentPlan(null);
        setPlanChatMessages([]);
        refetchPipeline();
        queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      } else {
        toast({ title: "Errore", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore", description: "Impossibile eseguire il piano", variant: "destructive" });
    } finally {
      setPlanExecuting(false);
    }
  };

  useEffect(() => {
    if (savedSalesContext) {
      setSalesContext({
        servicesOffered: savedSalesContext.servicesOffered || "",
        targetAudience: savedSalesContext.targetAudience || "",
        valueProposition: savedSalesContext.valueProposition || "",
        pricingInfo: savedSalesContext.pricingInfo || "",
        competitiveAdvantages: savedSalesContext.competitiveAdvantages || "",
        idealClientProfile: savedSalesContext.idealClientProfile || "",
        salesApproach: savedSalesContext.salesApproach || "",
        caseStudies: savedSalesContext.caseStudies || "",
        additionalContext: savedSalesContext.additionalContext || "",
      });
    }
  }, [savedSalesContext]);

  const selectedSearch = searches.find((s) => s.id === selectedSearchId);
  const isSearchRunning = selectedSearch?.status === "running" || selectedSearch?.status === "enriching";

  useEffect(() => {
    if (!selectedSearchId && searches.length > 0) {
      setSelectedSearchId(searches[0].id);
    }
  }, [searches, selectedSearchId]);

  useEffect(() => {
    if (!isSearchRunning) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      if (resultsUrl) queryClient.invalidateQueries({ queryKey: [resultsUrl] });
    }, 5000);
    return () => clearInterval(interval);
  }, [isSearchRunning, resultsUrl, queryClient]);

  const stats = useMemo(() => {
    const totalSearches = searches.length;
    const totalLeads = searches.reduce((acc, s) => acc + (s.resultsCount || 0), 0);
    const emailCount = results.filter(r => r.email).length;
    const phoneCount = results.filter(r => r.phone).length;
    return { totalSearches, totalLeads, emailCount, phoneCount };
  }, [searches, results]);

  const crmStats = useMemo(() => {
    const counts: Record<string, number> = {};
    LEAD_STATUSES.forEach(s => { counts[s.value] = 0; });
    allResults.forEach(r => {
      const status = r.leadStatus || "nuovo";
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [allResults]);

  const hunterSearches = useMemo(() => searches.filter(s => s.originRole === "hunter"), [searches]);
  const hunterLeadsCount = useMemo(() => allResults.filter(r => r.outreachTaskId).length, [allResults]);

  const filteredCrmResults = useMemo(() => {
    if (crmChannelView === "tutti") return allResults;
    return allResults.filter(r => {
      const ch = r.contactedChannels || [];
      switch (crmChannelView) {
        case "nuovi": return ch.length === 0;
        case "con_telefono": return !!r.phone;
        case "con_email": return !!r.email;
        case "wa": return ch.includes("whatsapp");
        case "voice": return ch.includes("voice");
        case "email": return ch.includes("email");
        case "multi": return ch.length >= 2;
        default: return true;
      }
    });
  }, [allResults, crmChannelView]);

  const filteredSearches = useMemo(() => {
    if (historySourceFilter === "tutti") return searches;
    return searches.filter((s) => {
      const meta = s.metadata as any;
      const engine = meta?.params?.searchEngine || "google_maps";
      return engine === historySourceFilter;
    });
  }, [searches, historySourceFilter]);

  const sortedResults = useMemo(() => {
    const sorted = [...results];
    if (sortBy === "score") sorted.sort((a, b) => (b.aiCompatibilityScore || 0) - (a.aiCompatibilityScore || 0));
    else if (sortBy === "rating") sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === "name") sorted.sort((a, b) => (a.businessName || "").localeCompare(b.businessName || ""));
    return sorted;
  }, [results, sortBy]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const startSearchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/lead-scraper/search", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, location: searchLocation, limit: searchLimit, searchEngine }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Errore" }));
        throw new Error(err.error || "Errore nella ricerca");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedSearchId(data.searchId);
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      toast({ title: "Ricerca avviata" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const scrapeWebsiteMutation = useMutation({
    mutationFn: async (resultId: string) => {
      const res = await fetch(`/api/lead-scraper/results/${resultId}/scrape-website`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore scraping");
      return res.json();
    },
    onSuccess: () => {
      if (resultsUrl) queryClient.invalidateQueries({ queryKey: [resultsUrl] });
      toast({ title: "Sito analizzato" });
    },
  });

  const deleteSearchMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const res = await fetch(`/api/lead-scraper/searches/${searchId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      if (selectedSearchId === deletedId) setSelectedSearchId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/searches"] });
      toast({ title: "Ricerca eliminata" });
    },
  });

  const saveSalesContextMutation = useMutation({
    mutationFn: async (data: SalesContext) => {
      const res = await fetch("/api/lead-scraper/sales-context", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scraper/sales-context"] });
      toast({ title: "Contesto salvato", description: "Il tuo profilo vendita e' stato aggiornato" });
    },
  });

  const generateBatchSummariesMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const res = await fetch(`/api/lead-scraper/searches/${searchId}/generate-summaries`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Analisi AI avviata", description: "I resoconti verranno generati in background" });
      setTimeout(() => {
        if (resultsUrl) queryClient.invalidateQueries({ queryKey: [resultsUrl] });
      }, 10000);
    },
  });

  const handleExport = () => {
    if (!selectedSearchId) return;
    fetch(`/api/lead-scraper/searches/${selectedSearchId}/export`, { headers: getAuthHeaders() })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.setAttribute("download", "");
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato!", description: text });
  };

  const handleSuggestKeywords = async () => {
    setKeywordsLoading(true);
    setShowKeywords(true);
    try {
      const res = await fetch("/api/lead-scraper/suggest-keywords", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Errore" }));
        toast({ title: "Errore", description: err.error, variant: "destructive" });
        return;
      }
      const data = await res.json();
      setKeywordSuggestions(data.suggestions || []);
    } catch {
      toast({ title: "Errore", description: "Impossibile generare suggerimenti", variant: "destructive" });
    } finally {
      setKeywordsLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const leadsContext = results.slice(0, 20).map(r => ({
        name: r.businessName,
        score: r.aiCompatibilityScore,
        status: r.leadStatus,
        email: r.email,
        phone: r.phone,
        category: r.category,
        summary: r.aiSalesSummary ? r.aiSalesSummary.substring(0, 300) : null,
      }));

      const systemCtx = [
        "Sei un AI Sales Agent esperto. Aiuti il consulente a gestire e contattare i lead trovati.",
        savedSalesContext?.servicesOffered ? `SERVIZI DEL CONSULENTE: ${savedSalesContext.servicesOffered}` : "",
        savedSalesContext?.targetAudience ? `TARGET: ${savedSalesContext.targetAudience}` : "",
        savedSalesContext?.valueProposition ? `PROPOSTA DI VALORE: ${savedSalesContext.valueProposition}` : "",
        `LEAD ATTUALI (${results.length} totali): ${JSON.stringify(leadsContext)}`,
        "Rispondi in italiano, sii pratico e orientato alla vendita.",
      ].filter(Boolean).join("\n");

      const contents = [
        ...chatMessages.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] })),
        { role: "user", parts: [{ text: userMsg }] },
      ];

      const res = await fetch("/api/lead-scraper/chat", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ systemContext: systemCtx, contents }),
      });

      if (!res.ok) throw new Error("Errore chat");
      const data = await res.json();
      setChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.text || "Nessuna risposta" }]);
    } catch {
      setChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Errore nella comunicazione con l'AI. Riprova." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400"><Loader2 className="h-3 w-3 animate-spin mr-1" />In corso</Badge>;
      case "enriching":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400"><RefreshCw className="h-3 w-3 animate-spin mr-1" />Arricchimento</Badge>;
      case "completed":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle className="h-3 w-3 mr-1" />Completata</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3 mr-1" />Fallita</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const activeFiltersCount = [filterHasEmail, filterHasPhone, !!filterRatingMin, !!filterCategory, !!filterSearch, filterLeadStatus !== "tutti"].filter(Boolean).length;

  const clearFilters = () => {
    setFilterHasEmail(false);
    setFilterHasPhone(false);
    setFilterRatingMin("");
    setFilterCategory("");
    setFilterSearch("");
    setFilterLeadStatus("tutti");
  };

  const navigateToLead = (leadId: string) => {
    setLocation(`/consultant/lead-scraper/lead/${leadId}`);
  };

  return (
    <PageLayout role="consultant">
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-violet-600 rounded-xl shadow-sm">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Lead Scraper</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Trova, analizza e gestisci i tuoi lead con AI Sales Agent</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Ricerche", value: stats.totalSearches, icon: Search, iconColor: "text-rose-500", numColor: "text-rose-600 dark:text-rose-400" },
            { label: "Lead Totali", value: stats.totalLeads, icon: Building2, iconColor: "text-violet-500", numColor: "text-violet-600 dark:text-violet-400" },
            { label: "Email", value: stats.emailCount, icon: Mail, iconColor: "text-blue-500", numColor: "text-blue-600 dark:text-blue-400" },
            { label: "Telefoni", value: stats.phoneCount, icon: Phone, iconColor: "text-emerald-500", numColor: "text-emerald-600 dark:text-emerald-400" },
          ].map((stat, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <stat.icon className={`h-3.5 w-3.5 ${stat.iconColor}`} />
                </div>
              </div>
              <p className={`text-2xl font-black tracking-tight leading-none mt-2 mb-0.5 ${stat.numColor}`}>{stat.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {hunterStatus && (
          <Card className="rounded-2xl border border-teal-200 dark:border-teal-800 shadow-sm bg-gradient-to-r from-teal-50 to-white dark:from-teal-950/20 dark:to-gray-900 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("hunter")}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-900/40">
                    <Crosshair className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 dark:text-white">Outreach Automatico</h3>
                      <Badge className={hunterStatus.isEnabled
                        ? "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800"
                        : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      }>
                        {hunterStatus.isEnabled ? (
                          <><Activity className="h-3 w-3 mr-1" />Attivo</>
                        ) : "Disattivato"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Hunter trova e qualifica lead automaticamente — <span className="text-teal-600 dark:text-teal-400 font-medium">clicca per configurare</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center px-3">
                    <p className="text-lg font-black text-teal-600 dark:text-teal-400">{hunterSearches.length}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Ricerche Auto</p>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="text-center px-3">
                    <p className="text-lg font-black text-teal-600 dark:text-teal-400">{hunterSearches.reduce((acc, s) => acc + (s.resultsCount || 0), 0)}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Lead Trovati</p>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="text-center px-3">
                    <p className="text-lg font-black text-teal-600 dark:text-teal-400">{hunterLeadsCount}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">In Outreach</p>
                  </div>
                  {hunterStatus.lastRun && (
                    <>
                      <Separator orientation="vertical" className="h-8" />
                      <div className="text-center px-3">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{timeAgo(hunterStatus.lastRun)}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Ultimo ciclo</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex justify-start gap-0 bg-transparent p-0 border-b border-gray-200 dark:border-gray-700 rounded-none h-auto">
            <TabsTrigger value="ricerca" className="flex items-center gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium transition-colors">
              <Search className="h-3.5 w-3.5" />Ricerca
            </TabsTrigger>
            <TabsTrigger value="crm" className="flex items-center gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium transition-colors">
              <ClipboardList className="h-3.5 w-3.5" />CRM Lead
            </TabsTrigger>
            <TabsTrigger value="agent" className="flex items-center gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium transition-colors">
              <Bot className="h-3.5 w-3.5" />Sales Agent
            </TabsTrigger>
            <TabsTrigger value="hunter" className="flex items-center gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium transition-colors">
              <Crosshair className="h-3.5 w-3.5" />Hunter
              {hunterStatus?.isEnabled && <span className="ml-1 w-2 h-2 rounded-full bg-teal-500 animate-pulse" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ricerca" className="mt-4 space-y-4">
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="py-3 px-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => setSearchEngine("google_maps")}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition-all",
                          searchEngine === "google_maps"
                            ? "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400"
                            : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                      >
                        <MapIcon className="h-3.5 w-3.5" />Maps
                      </button>
                      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                      <button
                        type="button"
                        onClick={() => setSearchEngine("google_search")}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition-all",
                          searchEngine === "google_search"
                            ? "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400"
                            : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                      >
                        <Globe className="h-3.5 w-3.5" />Search
                      </button>
                    </div>

                    <div className="relative flex-1 min-w-[150px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={searchEngine === "google_search" ? "es. agenzia marketing..." : "es. ristoranti, dentisti..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                        onKeyDown={(e) => { if (e.key === "Enter" && searchQuery) startSearchMutation.mutate(); }}
                      />
                    </div>

                    <div className="relative w-[180px] shrink-0">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="es. Milano, Roma..."
                        value={searchLocation}
                        onChange={(e) => setSearchLocation(e.target.value)}
                        className="pl-9 h-9"
                        onKeyDown={(e) => { if (e.key === "Enter" && searchQuery) startSearchMutation.mutate(); }}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Max</Label>
                      <Input
                        type="number"
                        value={searchLimit}
                        onChange={(e) => setSearchLimit(Math.max(5, Math.min(100, parseInt(e.target.value) || 5)))}
                        className="h-9 w-[60px] text-center text-sm font-semibold"
                        min={5}
                        max={100}
                        step={5}
                      />
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 border-violet-200 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 text-violet-700 dark:text-violet-400 shrink-0"
                      onClick={handleSuggestKeywords}
                      disabled={keywordsLoading}
                    >
                      {keywordsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    </Button>

                    <Popover open={historyPopoverOpen} onOpenChange={setHistoryPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Storico</span>
                          {searches.length > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-0.5">{searches.length}</Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[380px] p-0">
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">Storico ricerche</span>
                            <div className="flex items-center gap-1">
                              {(["tutti", "google_maps", "google_search"] as const).map((v) => (
                                <button
                                  key={v}
                                  onClick={() => setHistorySourceFilter(v)}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all",
                                    historySourceFilter === v
                                      ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
                                      : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                  )}
                                >
                                  {v === "tutti" && "Tutti"}
                                  {v === "google_maps" && <><MapIcon className="h-2.5 w-2.5 text-rose-500" />Maps</>}
                                  {v === "google_search" && <><Globe className="h-2.5 w-2.5 text-blue-500" />Search</>}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <ScrollArea className="h-[320px]">
                          {searchesLoading ? (
                            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                          ) : filteredSearches.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm px-4">
                              <Search className="h-6 w-6 mx-auto mb-2 opacity-30" /><p>Nessuna ricerca</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                              {filteredSearches.map((s) => {
                                const searchMeta = s.metadata as any;
                                const resCount = s.resultsCount || 0;
                                return (
                                  <div
                                    key={s.id}
                                    className={cn(
                                      "px-3 py-2.5 cursor-pointer transition-all duration-200",
                                      selectedSearchId === s.id
                                        ? "bg-violet-50 dark:bg-violet-950/20 border-l-3 border-l-violet-500"
                                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    )}
                                    onClick={() => { setSelectedSearchId(s.id); setHistoryPopoverOpen(false); }}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          {searchMeta?.params?.searchEngine === "google_search" ? (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/30 gap-0.5">
                                              <Globe className="h-2.5 w-2.5" />Search
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/30 gap-0.5">
                                              <MapIcon className="h-2.5 w-2.5" />Maps
                                            </Badge>
                                          )}
                                          <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{s.query}</p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                          {s.originRole === "hunter" && (
                                            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 gap-0.5">
                                              <Crosshair className="h-2.5 w-2.5" />Hunter
                                            </Badge>
                                          )}
                                          {getStatusBadge(s.status)}
                                          <span className="text-[10px] text-muted-foreground">{resCount} ris.</span>
                                          <span className="text-[10px] text-muted-foreground">{timeAgo(s.createdAt)}</span>
                                        </div>
                                      </div>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500 shrink-0" onClick={(e) => { e.stopPropagation(); deleteSearchMutation.mutate(s.id); }}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>

                    <Button
                      className="bg-violet-600 hover:bg-violet-700 text-white border-0 shadow-sm h-9 px-5 shrink-0"
                      onClick={() => startSearchMutation.mutate()}
                      disabled={!searchQuery || startSearchMutation.isPending}
                    >
                      {startSearchMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Avvio...</>
                      ) : (
                        <><Search className="h-4 w-4 mr-1.5" />Cerca</>
                      )}
                    </Button>
                  </div>

                  <AnimatePresence>
                    {showKeywords && keywordSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2 flex-wrap pt-1 pb-0.5">
                          <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400 shrink-0">AI:</span>
                          {keywordSuggestions.map((kw, i) => (
                            <TooltipProvider key={i}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all hover:shadow-sm cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600"
                                    onClick={() => {
                                      setSearchQuery(kw.keyword);
                                      setSearchEngine(kw.engine === "maps" ? "google_maps" : "google_search");
                                    }}
                                  >
                                    {kw.engine === "maps" ? <MapIcon className="h-2.5 w-2.5 text-rose-500" /> : <Globe className="h-2.5 w-2.5 text-blue-500" />}
                                    <span className="truncate max-w-[120px]">{kw.keyword}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[200px]">
                                  <p className="text-xs">{kw.reason}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </motion.div>
                    )}
                    {showKeywords && !keywordsLoading && keywordSuggestions.length === 0 && !savedSalesContext && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg"
                      >
                        Configura prima il tuo Sales Agent nella tab dedicata per ottenere suggerimenti personalizzati.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>

            {!selectedSearchId ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Avvia la tua prima ricerca</p>
                <p className="text-xs mt-1">Inserisci una keyword e una località per trovare nuovi lead</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedSearch && (
                  <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                            <Search className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900 dark:text-white">{selectedSearch.query}</h3>
                              {selectedSearch.location && <Badge variant="outline" className="text-xs"><MapPin className="h-3 w-3 mr-1" />{selectedSearch.location}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(selectedSearch.status)}
                              <span className="text-xs text-muted-foreground font-medium">{results.length} risultati</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedSearch.status === "completed" && (
                            <Button variant="outline" size="sm" onClick={() => generateBatchSummariesMutation.mutate(selectedSearchId!)} disabled={generateBatchSummariesMutation.isPending} className="border-amber-200 hover:border-amber-400 hover:bg-amber-50 text-amber-700">
                              {generateBatchSummariesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                              Analisi AI
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="relative">
                            <Filter className="h-4 w-4 mr-1" />Filtri
                            {activeFiltersCount > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-violet-600">{activeFiltersCount}</Badge>}
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleExport} disabled={results.length === 0}>
                            <Download className="h-4 w-4 mr-1" />CSV
                          </Button>
                          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                            <SelectTrigger className="w-[130px] h-9 text-xs">
                              <ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue placeholder="Ordina" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Predefinito</SelectItem>
                              <SelectItem value="score">Score AI</SelectItem>
                              <SelectItem value="rating">Rating</SelectItem>
                              <SelectItem value="name">Nome A-Z</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {isSearchRunning && (
                        <div className="mt-3">
                          <Progress value={undefined} className="h-1.5" />
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />{selectedSearch.status === "enriching" ? "Analisi siti web in corso..." : "Ricerca in corso..."}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {showFilters && (
                  <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2"><Filter className="h-4 w-4 text-gray-500" />Filtri</h4>
                        {activeFiltersCount > 0 && (
                          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7 text-gray-500 hover:text-gray-700"><X className="h-3 w-3 mr-1" />Rimuovi</Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="hasEmail" checked={filterHasEmail} onCheckedChange={(c) => setFilterHasEmail(!!c)} />
                          <Label htmlFor="hasEmail" className="text-sm">Ha email</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="hasPhone" checked={filterHasPhone} onCheckedChange={(c) => setFilterHasPhone(!!c)} />
                          <Label htmlFor="hasPhone" className="text-sm">Ha telefono</Label>
                        </div>
                        <Input placeholder="Rating min" value={filterRatingMin} onChange={(e) => setFilterRatingMin(e.target.value)} className="h-9" />
                        <Input placeholder="Categoria" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-9" />
                        <Input placeholder="Cerca nome..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} className="h-9" />
                        <Select value={filterLeadStatus} onValueChange={setFilterLeadStatus}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Stato" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tutti">Tutti</SelectItem>
                            {LEAD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    {resultsLoading ? (
                      <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
                    ) : results.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        {isSearchRunning ? <><Loader2 className="h-6 w-6 animate-spin text-violet-400 mx-auto mb-2" /><p>Ricerca in corso...</p></> : "Nessun risultato"}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                              <TableHead className="min-w-[220px] font-semibold">Azienda</TableHead>
                              <TableHead className="text-center font-semibold w-[50px]">Contatti</TableHead>
                              <TableHead className="text-center font-semibold w-[80px]">Rating</TableHead>
                              <TableHead className="text-center font-semibold w-[90px]">Score AI</TableHead>
                              <TableHead className="text-center font-semibold w-[90px]">Stato</TableHead>
                              <TableHead className="text-right font-semibold w-[60px]">Azioni</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedResults.map((r) => {
                              const statusInfo = getLeadStatusInfo(r.leadStatus);
                              return (
                                <TableRow
                                  key={r.id}
                                  className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-3 ${statusInfo.borderColor}`}
                                  onClick={() => navigateToLead(r.id)}
                                >
                                  <TableCell>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-gray-900 dark:text-white line-clamp-1">{r.businessName || "\u2014"}</span>
                                        {r.source === "google_search" && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 border-blue-300 text-blue-600">Web</Badge>}
                                      </div>
                                      {r.category && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{r.category}</p>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <Mail className={`h-3.5 w-3.5 ${r.email ? "text-blue-500" : "text-gray-200 dark:text-gray-700"}`} title={r.email ? "Email disponibile" : "No email"} />
                                      <Phone className={`h-3.5 w-3.5 ${r.phone ? "text-emerald-500" : "text-gray-200 dark:text-gray-700"}`} title={r.phone ? "Telefono disponibile" : "No telefono"} />
                                      <Globe className={`h-3.5 w-3.5 ${r.website ? "text-violet-500" : "text-gray-200 dark:text-gray-700"}`} title={r.website ? "Sito web disponibile" : "No sito"} />
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {r.rating ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                        <span className="text-xs font-semibold">{r.rating}</span>
                                      </div>
                                    ) : <span className="text-xs text-muted-foreground">{"\u2014"}</span>}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {getScoreBar(r.aiCompatibilityScore)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusInfo.color}`}>{statusInfo.label}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {r.website && r.scrapeStatus !== "scraped" && r.scrapeStatus !== "scraped_cached" && (
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); scrapeWebsiteMutation.mutate(r.id); }}>
                                          <RefreshCw className={`h-3 w-3 ${scrapeWebsiteMutation.isPending ? "animate-spin" : ""}`} />
                                        </Button>
                                      )}
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); copyToClipboard([r.businessName, r.phone, r.email, r.website].filter(Boolean).join(" | ")); }}>
                                        <Copy className="h-3 w-3" />
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
              </div>
            )}
          </TabsContent>

          <TabsContent value="crm" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-stretch overflow-x-auto">
                {LEAD_STATUSES.map((s, idx) => (
                  <button
                    key={s.value}
                    className={`relative flex-1 min-w-[100px] flex flex-col items-center justify-center py-3 px-2 text-center transition-all ${
                      crmFilterStatus === s.value
                        ? `${s.color} shadow-sm font-semibold`
                        : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    } ${idx === 0 ? "rounded-l-lg border border-gray-200 dark:border-gray-700" : idx === LEAD_STATUSES.length - 1 ? "rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-700" : "border border-l-0 border-gray-200 dark:border-gray-700"}`}
                    onClick={() => setCrmFilterStatus(crmFilterStatus === s.value ? "tutti" : s.value)}
                  >
                    <span className="text-lg font-black">{crmStats[s.value] || 0}</span>
                    <span className="text-[10px] font-medium leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {([
                  { key: "tutti", label: "Tutti", icon: null },
                  { key: "nuovi", label: "Nuovi", icon: null },
                  { key: "con_telefono", label: "Con Telefono", icon: PhoneCall },
                  { key: "con_email", label: "Con Email", icon: MailIcon },
                  { key: "wa", label: "Contattati WA", icon: MessageCircle },
                  { key: "voice", label: "Contattati Voce", icon: PhoneCall },
                  { key: "email", label: "Contattati Email", icon: MailIcon },
                  { key: "multi", label: "Multi-canale", icon: Crosshair },
                ] as const).map((v) => {
                  const VIcon = v.icon;
                  const isActive = crmChannelView === v.key;
                  return (
                    <button
                      key={v.key}
                      onClick={() => setCrmChannelView(isActive && v.key !== "tutti" ? "tutti" : v.key)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap",
                        isActive
                          ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700 shadow-sm"
                          : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700"
                      )}
                    >
                      {VIcon && <VIcon className={cn("h-3 w-3", isActive ? "text-violet-600 dark:text-violet-400" : "")} />}
                      {v.label}
                    </button>
                  );
                })}
              </div>

              <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-violet-500" />CRM Lead
                      <span className="text-sm font-normal text-muted-foreground">({filteredCrmResults.length}{crmChannelView !== "tutti" ? ` / ${allResults.length}` : ""})</span>
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                        {(["tutti", "google_maps", "google_search"] as const).map((v) => (
                          <button
                            key={v}
                            onClick={() => setCrmSourceFilter(v)}
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                              crmSourceFilter === v
                                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                          >
                            {v === "tutti" && "Tutti"}
                            {v === "google_maps" && <><MapIcon className="h-3 w-3 text-rose-500" />Maps</>}
                            {v === "google_search" && <><Globe className="h-3 w-3 text-blue-500" />Search</>}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Cerca lead..."
                          value={crmSearch}
                          onChange={(e) => setCrmSearch(e.target.value)}
                          className="pl-9 w-[250px] h-9"
                        />
                        {crmSearch && (
                          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setCrmSearch("")}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {(crmFilterStatus !== "tutti" || crmSourceFilter !== "tutti" || crmChannelView !== "tutti") && (
                        <Button variant="ghost" size="sm" onClick={() => { setCrmFilterStatus("tutti"); setCrmSourceFilter("tutti"); setCrmChannelView("tutti"); }} className="text-xs h-8 text-gray-500 hover:text-gray-700">
                          <X className="h-3 w-3 mr-1" />Rimuovi filtri
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredCrmResults.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Nessun lead trovato</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                            <TableHead className="font-semibold">Nome</TableHead>
                            <TableHead className="text-center font-semibold w-[70px]">Fonte</TableHead>
                            <TableHead className="text-center font-semibold w-[80px]">Canali</TableHead>
                            <TableHead className="font-semibold">Email</TableHead>
                            <TableHead className="font-semibold">Telefono</TableHead>
                            <TableHead className="text-center font-semibold">Score</TableHead>
                            <TableHead className="text-center font-semibold">Stato</TableHead>
                            <TableHead className="font-semibold">Prossima azione</TableHead>
                            <TableHead className="text-right font-semibold">Valore</TableHead>
                            <TableHead className="text-right font-semibold w-[60px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCrmResults.map((r) => {
                            const statusInfo = getLeadStatusInfo(r.leadStatus);
                            return (
                              <TableRow
                                key={r.id}
                                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-3 ${statusInfo.borderColor}`}
                                onClick={() => navigateToLead(r.id)}
                              >
                                <TableCell>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-gray-900 dark:text-white">{r.businessName || "-"}</span>
                                      {r.outreachTaskId && (
                                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 gap-0.5">
                                          <Crosshair className="h-2.5 w-2.5" />Auto
                                        </Badge>
                                      )}
                                    </div>
                                    {r.category && <p className="text-sm text-gray-500 mt-0.5">{r.category}</p>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {r.source === "google_search" ? (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/30 gap-0.5">
                                      <Globe className="h-2.5 w-2.5" />Search
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/30 gap-0.5">
                                      <MapIcon className="h-2.5 w-2.5" />Maps
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {(r.contactedChannels && r.contactedChannels.length > 0) ? (
                                    <div className="flex items-center justify-center gap-1">
                                      {r.contactedChannels.includes("voice") && <PhoneCall className="h-3 w-3 text-green-500" />}
                                      {r.contactedChannels.includes("whatsapp") && <MessageCircle className="h-3 w-3 text-emerald-500" />}
                                      {r.contactedChannels.includes("email") && <MailIcon className="h-3 w-3 text-blue-500" />}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">{r.email || "-"}</TableCell>
                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">{r.phone || "-"}</TableCell>
                                <TableCell className="text-center">{getScoreBar(r.aiCompatibilityScore)}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusInfo.color}`}>{statusInfo.label}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {r.leadNextAction ? (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />{r.leadNextAction}
                                      {r.leadNextActionDate && <span className="text-[10px]">({new Date(r.leadNextActionDate).toLocaleDateString("it-IT")})</span>}
                                    </span>
                                  ) : "\u2014"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {r.leadValue ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">{r.leadValue.toLocaleString("it-IT")} EUR</span> : "\u2014"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30"
                                    title="Avvia Hunter su questo lead"
                                    onClick={(e) => { e.stopPropagation(); openHunterSingleLead(r); }}
                                  >
                                    <Crosshair className="h-3.5 w-3.5" />
                                  </Button>
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
            </div>
          </TabsContent>

          <TabsContent value="agent" className="mt-4">
            <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-violet-500" />Configura il tuo Sales Agent
                </CardTitle>
                <CardDescription>
                  Inserisci il contesto del tuo business perche l'AI possa analizzare ogni azienda e dare uno score di compatibilita accurato.
                  {savedSalesContext ? (
                    <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Configurato</Badge>
                  ) : (
                    <Badge className="ml-2 bg-amber-100 text-amber-700 border-amber-200">Non configurato</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {[
                      { key: "servicesOffered", label: "Servizi che offri", placeholder: "Descrivi i servizi che vendi...", tall: true },
                      { key: "targetAudience", label: "Target ideale", placeholder: "A chi vendi? PMI, startup, professionisti...", tall: false },
                      { key: "valueProposition", label: "Proposta di valore", placeholder: "Cosa ti rende unico?", tall: false },
                      { key: "pricingInfo", label: "Pricing / Pacchetti", placeholder: "Range prezzi, pacchetti...", tall: false },
                    ].map(field => (
                      <div key={field.key} className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</Label>
                        <Textarea
                          placeholder={field.placeholder}
                          value={(salesContext as any)[field.key]}
                          onChange={(e) => setSalesContext(p => ({ ...p, [field.key]: e.target.value }))}
                          className={`${field.tall ? "min-h-[100px]" : "min-h-[80px]"} border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-violet-500`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    {[
                      { key: "competitiveAdvantages", label: "Vantaggi competitivi", placeholder: "Cosa fai meglio della concorrenza?" },
                      { key: "idealClientProfile", label: "Profilo cliente ideale", placeholder: "Fatturato, dipendenti, settore..." },
                      { key: "salesApproach", label: "Approccio vendita", placeholder: "Come approcci il primo contatto?" },
                      { key: "caseStudies", label: "Casi di successo", placeholder: "Brevi case study..." },
                    ].map(field => (
                      <div key={field.key} className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</Label>
                        <Textarea
                          placeholder={field.placeholder}
                          value={(salesContext as any)[field.key]}
                          onChange={(e) => setSalesContext(p => ({ ...p, [field.key]: e.target.value }))}
                          className="min-h-[80px] border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contesto aggiuntivo</Label>
                  <Textarea placeholder="Qualsiasi altra informazione utile..." value={salesContext.additionalContext} onChange={(e) => setSalesContext(p => ({ ...p, additionalContext: e.target.value }))} className="min-h-[60px] border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="mt-6 flex justify-end">
                  <Button
                    className="bg-violet-600 hover:bg-violet-700 text-white border-0 shadow-sm"
                    onClick={() => saveSalesContextMutation.mutate(salesContext)}
                    disabled={saveSalesContextMutation.isPending}
                  >
                    {saveSalesContextMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvataggio...</> : <><Save className="h-4 w-4 mr-2" />Salva configurazione</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hunter" className="mt-4 space-y-4">
            {/* SEZIONE 1 — Header operativo */}
            <Card className="rounded-2xl border border-teal-200 dark:border-teal-800 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-teal-400 to-cyan-500" />
              <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("w-3 h-3 rounded-full shrink-0", outreachConfig.enabled ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} />
                    <span className="text-base font-bold">Centro di Controllo Hunter</span>
                    <Switch
                      checked={outreachConfig.enabled}
                      onCheckedChange={(checked) => updateOutreachConfig("enabled", checked)}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 h-8"
                      onClick={handleTriggerHunter}
                      disabled={triggeringHunter || !outreachConfig.enabled}
                    >
                      {triggeringHunter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      {triggeringHunter ? "In corso..." : "Avvia Hunter"}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-8"
                      onClick={handleAnalyzeCrm}
                      disabled={analyzingCrm || !outreachConfig.enabled}
                    >
                      {analyzingCrm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
                      {analyzingCrm ? "Analisi..." : "Analizza CRM"}
                    </Button>
                    {hunterTriggerResult && (
                      <span className={cn("text-xs", hunterTriggerResult.success ? "text-emerald-600" : "text-red-500")}>
                        {hunterTriggerResult.success ? `${hunterTriggerResult.tasks} task` : (hunterTriggerResult.error || "Errore")}
                      </span>
                    )}
                    {crmAnalysisResult && (
                      <span className={cn("text-xs", crmAnalysisResult.success ? "text-indigo-600" : "text-red-500")}>
                        {crmAnalysisResult.success
                          ? (crmAnalysisResult.noPlan
                            ? "Nessun lead azionabile trovato nel CRM"
                            : crmAnalysisResult.tasks_created != null
                            ? `${crmAnalysisResult.analyzed} analizzati — ${crmAnalysisResult.actionable} azionabili — ${crmAnalysisResult.tasks_created} task`
                            : `${crmAnalysisResult.actionable} lead trovati`)
                          : (crmAnalysisResult.error || "Errore")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                  <div className="flex items-center gap-1 flex-1">
                    {([
                      { mode: "autonomous" as const, label: "Full Autonomo", icon: Zap, activeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-700" },
                      { mode: "plan" as const, label: "Piano Interattivo", icon: MessageSquare, activeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700" },
                      { mode: "approval" as const, label: "Solo Approvazione", icon: Shield, activeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700" },
                    ] as const).map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.mode}
                          onClick={() => updateOutreachConfig("hunter_mode", opt.mode)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                            hunterMode === opt.mode
                              ? opt.activeClass
                              : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-700"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-muted-foreground max-w-[200px] leading-tight">
                    {hunterMode === "autonomous" && "I task partono automaticamente senza intervento"}
                    {hunterMode === "plan" && "Hunter prepara un piano, tu lo rivedi e approvi"}
                    {hunterMode === "approval" && "I task attendono la tua approvazione uno per uno"}
                  </span>
                </div>

                {hunterPipeline && (
                  <div className="flex items-center gap-3 flex-wrap text-xs font-medium text-muted-foreground bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1"><Search className="h-3 w-3 text-teal-500" />{hunterPipeline.stats.foundToday} trovati</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" />{hunterPipeline.stats.scoredToday} qualificati</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1"><Send className="h-3 w-3 text-blue-500" />{hunterPipeline.stats.inOutreach} in outreach</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" />{hunterPipeline.stats.contacted} contattati</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" />{hunterPipeline.stats.qualifiedWaiting} in attesa</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-violet-500" />{hunterPipeline.stats.contacted > 0 && hunterPipeline.stats.foundToday > 0 ? Math.round((hunterPipeline.stats.contacted / hunterPipeline.stats.foundToday) * 100) : 0}% conversione</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3 text-indigo-500" />{(hunterPipeline.stats.foundToday + hunterPipeline.stats.scoredToday + hunterPipeline.stats.inOutreach + hunterPipeline.stats.contacted + hunterPipeline.stats.qualifiedWaiting) - (hunterPipeline.stats.notInterested ?? 0)} pipeline</span>
                    <span className="ml-auto text-[10px] text-gray-400">
                      Agg: {lastPipelineRefresh.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DIAGRAMMA DI FLUSSO — Pipeline Hunter */}
            <Card className="rounded-2xl border shadow-sm overflow-hidden">
              <CardContent className="py-4 px-3 sm:px-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Outreach</p>
                <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
                  {[
                    { step: 1, label: "Ricerca", sub: "Google Maps / Search", icon: Search, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/30", border: "border-teal-200 dark:border-teal-800", count: hunterPipeline?.stats.foundToday },
                    { step: 2, label: "Qualifica AI", sub: "Score compatibilità", icon: Target, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", count: hunterPipeline?.stats.scoredToday },
                    { step: 3, label: outreachConfig.require_approval ? "Approvazione" : "Auto", sub: outreachConfig.require_approval ? "Manuale" : "Full autonomo", icon: outreachConfig.require_approval ? Shield : Zap, color: outreachConfig.require_approval ? "text-violet-600" : "text-emerald-600", bg: outreachConfig.require_approval ? "bg-violet-50 dark:bg-violet-950/30" : "bg-emerald-50 dark:bg-emerald-950/30", border: outreachConfig.require_approval ? "border-violet-200 dark:border-violet-800" : "border-emerald-200 dark:border-emerald-800", count: hunterPipeline?.stats.qualifiedWaiting },
                    { step: 4, label: "Outreach", sub: "Call / WA / Email", icon: Send, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", count: (hunterPipeline?.stats.inOutreach ?? 0) + (hunterPipeline?.stats.contacted ?? 0) },
                  ].map((s, i, arr) => {
                    const SIcon = s.icon;
                    return (
                      <div key={s.step} className="flex items-center min-w-0">
                        <div className={cn("flex flex-col items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-xl border min-w-[80px] sm:min-w-[100px]", s.bg, s.border)}>
                          <div className={cn("h-7 w-7 rounded-full flex items-center justify-center", s.bg)}>
                            <SIcon className={cn("h-3.5 w-3.5", s.color)} />
                          </div>
                          <span className={cn("text-[11px] sm:text-xs font-bold text-center leading-tight", s.color)}>{s.label}</span>
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight">{s.sub}</span>
                          {s.count != null && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 mt-0.5">{s.count}</Badge>
                          )}
                        </div>
                        {i < arr.length - 1 && (
                          <div className="flex items-center px-0.5 sm:px-1 shrink-0">
                            <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {hunterPipeline?.kpis && (
                  <div className="mt-2.5 pt-2.5 border-t border-dotted border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><PhoneCall className="h-2.5 w-2.5 text-green-500" />{hunterPipeline.kpis.callResponseRate}% risposta</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-2.5 w-2.5 text-emerald-500" />{hunterPipeline.kpis.waDeliveryRate}% delivery WA</span>
                      <span className="flex items-center gap-1"><MailIcon className="h-2.5 w-2.5 text-blue-500" />{hunterPipeline.kpis.emailDeliveryRate}% delivery email</span>
                      <span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5 text-orange-500" />{hunterPipeline.kpis.leadsConvertedThisWeek} convertiti</span>
                      <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5 text-violet-500" />{hunterPipeline.kpis.avgTimeToFirstContact}h primo contatto</span>
                    </div>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4 flex-wrap text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />Non interessato: {hunterPipeline?.stats.notInterested ?? 0}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />In trattativa: {hunterPipeline?.stats.inNegotiation ?? 0}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />Ricerche oggi: {hunterPipeline?.searches?.used ?? 0}/{hunterPipeline?.searches?.limit ?? 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SEZIONE 2 — Coda Outreach Unificata */}
            {(() => {
              const allTasks: { id: string; title: string; status: string; channel: string; aiRole: string; scheduledAt: string | null; createdAt: string | null; completedAt: string | null; resultSummary: string | null; aiInstruction: string | null; waPreviewMessage?: string | null; leadName: string; leadScore: number | null; leadSector: string | null; leadId: string | null; voiceTemplateName?: string | null; callInstruction?: string | null; waTemplateName?: string | null }[] = [];
              if (hunterPipeline?.channels) {
                Object.entries(hunterPipeline.channels).forEach(([, chData]) => {
                  if (chData?.tasks) allTasks.push(...chData.tasks);
                });
              }

              const waitingCount = allTasks.filter(t => t.status === "waiting_approval").length;

              const filteredTasks = allTasks
                .filter(t => outreachChannelFilter === "tutti" || t.channel === outreachChannelFilter)
                .filter(t => {
                  if (outreachStatusFilter === "tutti") return true;
                  if (outreachStatusFilter === "waiting_approval") return t.status === "waiting_approval";
                  if (outreachStatusFilter === "scheduled") return t.status === "scheduled" || t.status === "approved";
                  if (outreachStatusFilter === "completed") return t.status === "completed";
                  if (outreachStatusFilter === "failed") return t.status === "failed";
                  return true;
                })
                .sort((a, b) => {
                  const order: Record<string, number> = { waiting_approval: 0, scheduled: 1, approved: 1, in_progress: 2, completed: 3, failed: 4 };
                  const oa = order[a.status] ?? 5;
                  const ob = order[b.status] ?? 5;
                  if (oa !== ob) return oa - ob;
                  const da = a.scheduledAt || a.completedAt || a.createdAt || "";
                  const db = b.scheduledAt || b.completedAt || b.createdAt || "";
                  return db.localeCompare(da);
                });

              const channelIcon = (ch: string) => {
                if (ch === "voice") return PhoneCall;
                if (ch === "whatsapp") return MessageCircle;
                return MailIcon;
              };
              const channelColor = (ch: string) => {
                if (ch === "voice") return "text-green-600";
                if (ch === "whatsapp") return "text-emerald-600";
                return "text-blue-600";
              };
              const channelBg = (ch: string) => {
                if (ch === "voice") return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800";
                if (ch === "whatsapp") return "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800";
                return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800";
              };
              const channelLabel = (ch: string) => {
                if (ch === "voice") return "Chiamata";
                if (ch === "whatsapp") return "WhatsApp";
                return "Email";
              };

              type LeadGroup = { leadName: string; leadScore: number | null; leadSector: string | null; leadId: string | null; tasks: typeof filteredTasks };
              const groupedByLead: LeadGroup[] = [];
              const leadMap = new Map<string, LeadGroup>();
              for (const t of filteredTasks) {
                const key = t.leadId || t.leadName;
                if (!leadMap.has(key)) {
                  const grp: LeadGroup = { leadName: t.leadName, leadScore: t.leadScore, leadSector: t.leadSector, leadId: t.leadId, tasks: [] };
                  leadMap.set(key, grp);
                  groupedByLead.push(grp);
                }
                leadMap.get(key)!.tasks.push(t);
              }
              const visibleGroups = groupedByLead.slice(0, 25);

              const handleBatchApprove = async () => {
                const toApprove = allTasks.filter(t => t.status === "waiting_approval");
                if (toApprove.length === 0) return;
                setBatchApproving(true);
                for (const task of toApprove) {
                  try {
                    await approveTaskMutation.mutateAsync(task.id);
                  } catch {}
                  await new Promise(r => setTimeout(r, 100));
                }
                setBatchApproving(false);
                refetchPipeline();
              };

              const statusMap: Record<string, { label: string; cls: string }> = {
                waiting_approval: { label: "In attesa", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
                scheduled: { label: "Schedulato", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
                in_progress: { label: "In corso", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
                approved: { label: "Approvato", cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400" },
                completed: { label: "Completato", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
                failed: { label: "Fallito", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
              };

              return (
                <Card className="rounded-2xl border shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b bg-gray-50/50 dark:bg-gray-800/30">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold">Coda Outreach</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{allTasks.length}</Badge>
                    </div>
                    {waitingCount > 0 && (
                      <Button
                        size="sm"
                        className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleBatchApprove}
                        disabled={batchApproving}
                      >
                        {batchApproving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                        Approva tutti ({waitingCount})
                      </Button>
                    )}
                  </div>

                  <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b">
                    <div className="flex items-center gap-1 mr-2">
                      {(["tutti", "voice", "whatsapp", "email"] as const).map(ch => (
                        <button
                          key={ch}
                          onClick={() => setOutreachChannelFilter(ch)}
                          className={cn(
                            "text-[11px] px-2 py-1 rounded-md font-medium transition-colors",
                            outreachChannelFilter === ch
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                              : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-700"
                          )}
                        >
                          {ch === "tutti" ? "Tutti" : ch === "voice" ? "📞 Chiamate" : ch === "whatsapp" ? "💬 WhatsApp" : "📧 Email"}
                        </button>
                      ))}
                    </div>
                    <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 self-center" />
                    <div className="flex items-center gap-1 ml-2">
                      {(["tutti", "waiting_approval", "scheduled", "completed", "failed"] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => setOutreachStatusFilter(st)}
                          className={cn(
                            "text-[11px] px-2 py-1 rounded-md font-medium transition-colors",
                            outreachStatusFilter === st
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                              : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-700"
                          )}
                        >
                          {st === "tutti" ? "Tutti" : st === "waiting_approval" ? "In attesa" : st === "scheduled" ? "Schedulati" : st === "completed" ? "Completati" : "Falliti"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <CardContent className="p-0">
                    {visibleGroups.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                        Nessun task in coda
                      </div>
                    ) : (
                      <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                        <AnimatePresence initial={false}>
                          {visibleGroups.map((group) => {
                            const isGroupExpanded = expandedTaskId === (group.leadId || group.leadName);
                            const groupWaitingCount = group.tasks.filter(t => t.status === "waiting_approval").length;
                            const groupChannels = [...new Set(group.tasks.map(t => t.channel))];
                            const worstStatus = group.tasks.reduce((worst, t) => {
                              const order: Record<string, number> = { waiting_approval: 0, scheduled: 1, approved: 1, in_progress: 2, completed: 3, failed: 4 };
                              return (order[t.status] ?? 5) < (order[worst] ?? 5) ? t.status : worst;
                            }, group.tasks[0].status);
                            const ws = statusMap[worstStatus] || { label: worstStatus, cls: "bg-gray-100 text-gray-600" };
                            const firstTask = group.tasks[0];

                            return (
                              <motion.div
                                key={group.leadId || group.leadName}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25 }}
                              >
                                <div
                                  className={cn(
                                    "px-3 py-2.5 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors",
                                    isGroupExpanded && "bg-gray-50/80 dark:bg-gray-800/50"
                                  )}
                                  onClick={() => setExpandedTaskId(isGroupExpanded ? null : (group.leadId || group.leadName))}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        {groupChannels.map(ch => {
                                          const ChI = channelIcon(ch);
                                          return <ChI key={ch} className={cn("h-3.5 w-3.5", channelColor(ch))} />;
                                        })}
                                      </div>
                                      <span className="text-sm font-medium truncate">{group.leadName}</span>
                                      {group.leadScore != null && (
                                        <Badge variant="outline" className="text-[9px] px-1 h-4 shrink-0">{group.leadScore}</Badge>
                                      )}
                                      {group.tasks.length > 1 && (
                                        <Badge variant="secondary" className="text-[9px] px-1 h-4 shrink-0">{group.tasks.length} canali</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {group.leadSector && (
                                        <span className="text-[10px] text-muted-foreground hidden sm:inline">{group.leadSector}</span>
                                      )}
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {firstTask.scheduledAt ? timeAgo(firstTask.scheduledAt) : firstTask.createdAt ? timeAgo(firstTask.createdAt) : ""}
                                      </span>
                                      <Badge className={cn("text-[9px] px-1.5 h-4", ws.cls)}>{ws.label}</Badge>
                                      {groupWaitingCount > 0 && (
                                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                          <Button
                                            size="sm"
                                            className="h-6 w-6 p-0 bg-emerald-500 hover:bg-emerald-600 text-white"
                                            onClick={async () => {
                                              for (const t of group.tasks.filter(tt => tt.status === "waiting_approval")) {
                                                try { await approveTaskMutation.mutateAsync(t.id); } catch {}
                                                await new Promise(r => setTimeout(r, 100));
                                              }
                                              refetchPipeline();
                                            }}
                                            disabled={approveTaskMutation.isPending}
                                            title="Approva tutti i canali"
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            className="h-6 w-6 p-0 bg-red-500 hover:bg-red-600 text-white"
                                            onClick={async () => {
                                              for (const t of group.tasks.filter(tt => tt.status === "waiting_approval")) {
                                                try { await rejectTaskMutation.mutateAsync(t.id); } catch {}
                                                await new Promise(r => setTimeout(r, 100));
                                              }
                                              refetchPipeline();
                                            }}
                                            disabled={rejectTaskMutation.isPending}
                                            title="Rifiuta tutti i canali"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {isGroupExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="border-t border-dashed border-gray-200 dark:border-gray-700"
                                  >
                                    {group.leadSector && (
                                      <div className="px-4 pt-2 pb-1 flex items-center gap-3 text-xs text-muted-foreground">
                                        {group.leadSector && <span>Settore: <strong>{group.leadSector}</strong></span>}
                                        {group.leadScore != null && <span>Score: {getScoreBar(group.leadScore)}</span>}
                                      </div>
                                    )}
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                      {group.tasks.map(task => {
                                        const ChIcon = channelIcon(task.channel);
                                        const chCol = channelColor(task.channel);
                                        const ts = statusMap[task.status] || { label: task.status, cls: "bg-gray-100 text-gray-600" };
                                        const isContextExpanded = expandedContextIds.has(task.id);
                                        const toggleContext = (e: React.MouseEvent) => {
                                          e.stopPropagation();
                                          setExpandedContextIds(prev => {
                                            const next = new Set(prev);
                                            if (next.has(task.id)) next.delete(task.id);
                                            else next.add(task.id);
                                            return next;
                                          });
                                        };
                                        return (
                                          <div key={task.id} className={cn("px-4 py-2.5", channelBg(task.channel).split(' ')[0], "bg-opacity-30")}>
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                              <div className="flex items-center gap-2">
                                                <ChIcon className={cn("h-3.5 w-3.5", chCol)} />
                                                <span className="text-xs font-semibold">{channelLabel(task.channel)}</span>
                                                <Badge className={cn("text-[9px] px-1.5 h-4", ts.cls)}>{ts.label}</Badge>
                                              </div>
                                              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                {task.scheduledAt && (
                                                  <span className="text-[10px] text-muted-foreground">
                                                    {new Date(task.scheduledAt).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                  </span>
                                                )}
                                                {task.status === "waiting_approval" && (
                                                  <div className="flex items-center gap-1">
                                                    <Button size="sm" className="h-5 w-5 p-0 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => approveTaskMutation.mutate(task.id)} disabled={approveTaskMutation.isPending}>
                                                      <Check className="h-2.5 w-2.5" />
                                                    </Button>
                                                    <Button size="sm" className="h-5 w-5 p-0 bg-red-500 hover:bg-red-600 text-white" onClick={() => rejectTaskMutation.mutate(task.id)} disabled={rejectTaskMutation.isPending}>
                                                      <X className="h-2.5 w-2.5" />
                                                    </Button>
                                                  </div>
                                                )}
                                              </div>
                                            </div>

                                            {task.channel === 'whatsapp' && (
                                              <div className="space-y-1.5">
                                                {task.waTemplateName && (
                                                  <div className="flex items-center gap-1.5">
                                                    <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 gap-0.5">
                                                      <FileText className="h-2.5 w-2.5" />Template: {task.waTemplateName}
                                                    </Badge>
                                                  </div>
                                                )}
                                                {task.waTemplateName && task.waPreviewMessage && (
                                                  <div>
                                                    <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 mb-0.5">Messaggio personalizzato (variabili sostituite):</p>
                                                    <div className={cn("rounded-md border p-2 text-xs whitespace-pre-wrap leading-relaxed max-h-[140px] overflow-y-auto", channelBg(task.channel))}>
                                                      {task.waPreviewMessage}
                                                    </div>
                                                  </div>
                                                )}
                                                {!task.waTemplateName && task.aiInstruction && (
                                                  <div>
                                                    <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 mb-0.5">Messaggio WA:</p>
                                                    <div className={cn("rounded-md border p-2 text-xs whitespace-pre-wrap leading-relaxed max-h-[140px] overflow-y-auto", channelBg(task.channel))}>
                                                      {task.aiInstruction}
                                                    </div>
                                                  </div>
                                                )}
                                                {task.waTemplateName && task.aiInstruction && (
                                                  <div>
                                                    <button
                                                      onClick={toggleContext}
                                                      className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                      <ChevronDown className={cn("h-3 w-3 transition-transform", isContextExpanded && "rotate-180")} />
                                                      {isContextExpanded ? "Nascondi contesto iniettato" : "Mostra contesto iniettato"}
                                                    </button>
                                                    {isContextExpanded && (
                                                      <div className="mt-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-[11px] whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto text-muted-foreground">
                                                        {task.aiInstruction}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {task.channel === 'voice' && (
                                              <div className="space-y-1.5">
                                                {task.voiceTemplateName && (
                                                  <div className="flex items-center gap-1.5">
                                                    <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-green-300 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 gap-0.5">
                                                      <PhoneCall className="h-2.5 w-2.5" />Template: {task.voiceTemplateName}
                                                    </Badge>
                                                  </div>
                                                )}
                                                {task.callInstruction && (
                                                  <div>
                                                    <p className="text-[10px] font-medium text-green-700 dark:text-green-400 mb-0.5">Istruzioni chiamata:</p>
                                                    <div className={cn("rounded-md border p-2 text-xs whitespace-pre-wrap leading-relaxed max-h-[100px] overflow-y-auto", channelBg(task.channel))}>
                                                      {task.callInstruction}
                                                    </div>
                                                  </div>
                                                )}
                                                {task.aiInstruction && (
                                                  <div>
                                                    <button
                                                      onClick={toggleContext}
                                                      className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                      <ChevronDown className={cn("h-3 w-3 transition-transform", isContextExpanded && "rotate-180")} />
                                                      {isContextExpanded ? "Nascondi contesto lead" : "Mostra contesto lead"}
                                                    </button>
                                                    {isContextExpanded && (
                                                      <div className="mt-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-[11px] whitespace-pre-wrap leading-relaxed max-h-[250px] overflow-y-auto text-muted-foreground">
                                                        {task.aiInstruction}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {task.channel === 'email' && task.aiInstruction && (
                                              <div className="space-y-1.5">
                                                <div>
                                                  <p className="text-[10px] font-medium text-blue-700 dark:text-blue-400 mb-0.5">Email:</p>
                                                  <div className={cn("rounded-md border p-2 text-xs whitespace-pre-wrap leading-relaxed max-h-[180px] overflow-y-auto", channelBg(task.channel))}>
                                                    {task.aiInstruction}
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {task.status === "completed" && task.resultSummary && (
                                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1.5">{task.resultSummary}</p>
                                            )}
                                            {task.status === "failed" && task.resultSummary && (
                                              <p className="text-[10px] text-red-600 dark:text-red-400 mt-1.5">{task.resultSummary}</p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                        {groupedByLead.length > 25 && (
                          <div className="px-4 py-2 text-center text-[10px] text-muted-foreground bg-gray-50/50 dark:bg-gray-800/20">
                            Mostrati 25 di {groupedByLead.length} lead
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* SEZIONE 3 — Timeline attività in tempo reale (collapsible) */}
            <Card className="rounded-2xl border shadow-sm overflow-hidden">
              <button
                onClick={() => setTimelineOpen(!timelineOpen)}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-600" />
                  Timeline Attività
                  {hunterPipeline?.recentActivity && hunterPipeline.recentActivity.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                      {hunterPipeline.recentActivity.length}
                    </Badge>
                  )}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", timelineOpen && "rotate-180")} />
              </button>
              {timelineOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardContent className="pt-0 pb-3 border-t">
                    {(!hunterPipeline?.recentActivity || hunterPipeline.recentActivity.length === 0) ? (
                      <div className="text-center py-4 text-xs text-muted-foreground">
                        Nessuna attività recente
                      </div>
                    ) : (
                      <div className="relative max-h-[200px] overflow-y-auto pr-2 mt-2">
                        <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                        <div className="space-y-0">
                          <AnimatePresence initial={false}>
                            {hunterPipeline.recentActivity.slice(0, 8).map((a) => {
                              const iconMap: Record<string, { icon: any; color: string }> = {
                                search: { icon: Search, color: "text-teal-500 bg-teal-50 dark:bg-teal-950/30" },
                                qualify: { icon: Target, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30" },
                                assign: { icon: Send, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30" },
                                call: { icon: PhoneCall, color: "text-green-500 bg-green-50 dark:bg-green-950/30" },
                                whatsapp: { icon: MessageCircle, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" },
                                email: { icon: MailIcon, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30" },
                                completed: { icon: CheckCircle, color: "text-green-500 bg-green-50 dark:bg-green-950/30" },
                                error: { icon: XCircle, color: "text-red-500 bg-red-50 dark:bg-red-950/30" },
                              };
                              const match = iconMap[a.type] || iconMap.search;
                              const AIcon = match.icon;
                              return (
                                <motion.div
                                  key={a.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="relative pl-8 py-1.5"
                                >
                                  <div className={cn("absolute left-[8px] top-2 w-[11px] h-[11px] rounded-full flex items-center justify-center z-10", match.color)}>
                                    <AIcon className="h-2 w-2" />
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-medium text-foreground truncate min-w-0">{a.title}</p>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{timeAgo(a.createdAt)}</span>
                                  </div>
                                  {a.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{a.description}</p>}
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </Card>

            {/* SEZIONE 4 — Configurazione (collapsible) */}
            <Card className="rounded-2xl border shadow-sm overflow-hidden">
              <button
                onClick={() => setHunterConfigOpen(!hunterConfigOpen)}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Cog className="h-4 w-4 text-gray-500" />
                  Configurazione avanzata
                </span>
                <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", hunterConfigOpen && "rotate-180")} />
              </button>
              {hunterConfigOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardContent className="pt-0 pb-5 space-y-6 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Max lead per analisi CRM</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.max_leads_per_batch || 15}</Badge>
                          </Label>
                          <Slider value={[outreachConfig.max_leads_per_batch || 15]} min={5} max={30} step={1} onValueChange={([v]) => updateOutreachConfig("max_leads_per_batch", v)} />
                          <p className="text-xs text-gray-400 mt-1">Quanti lead contattare per ogni analisi CRM</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Max ricerche Hunter / giorno</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.max_searches_per_day}</Badge>
                          </Label>
                          <Slider value={[outreachConfig.max_searches_per_day]} min={1} max={20} step={1} onValueChange={([v]) => updateOutreachConfig("max_searches_per_day", v)} />
                        </div>
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Max chiamate / giorno</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.max_calls_per_day}</Badge>
                          </Label>
                          <Slider value={[outreachConfig.max_calls_per_day]} min={1} max={50} step={1} onValueChange={([v]) => updateOutreachConfig("max_calls_per_day", v)} />
                        </div>
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Max WhatsApp / giorno</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.max_whatsapp_per_day}</Badge>
                          </Label>
                          <Slider value={[outreachConfig.max_whatsapp_per_day]} min={1} max={50} step={1} onValueChange={([v]) => updateOutreachConfig("max_whatsapp_per_day", v)} />
                        </div>
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Max email / giorno</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.max_emails_per_day}</Badge>
                          </Label>
                          <Slider value={[outreachConfig.max_emails_per_day]} min={1} max={100} step={1} onValueChange={([v]) => updateOutreachConfig("max_emails_per_day", v)} />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Soglia score AI minimo</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.score_threshold}/100</Badge>
                          </Label>
                          <Slider value={[outreachConfig.score_threshold]} min={30} max={90} step={5} onValueChange={([v]) => updateOutreachConfig("score_threshold", v)} />
                          <p className="text-xs text-gray-400 mt-1">Solo lead con score &ge; {outreachConfig.score_threshold} verranno contattati</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Cooldown tra contatti (ore)</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.cooldown_hours}h</Badge>
                          </Label>
                          <Slider value={[outreachConfig.cooldown_hours]} min={12} max={168} step={12} onValueChange={([v]) => updateOutreachConfig("cooldown_hours", v)} />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-sm font-semibold mb-1 flex items-center gap-2">
                        <Filter className="h-4 w-4 text-orange-500" />
                        Qualificazione Lead
                      </Label>
                      <p className="text-xs text-gray-400 mb-4">Configura i tempi di attesa e il numero massimo di tentativi per contattare i lead.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Ore minime prima di contattare un lead nuovo</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.cooldown_new_hours || 24}h</Badge>
                          </Label>
                          <Slider value={[outreachConfig.cooldown_new_hours || 24]} min={1} max={72} step={1} onValueChange={([v]) => updateOutreachConfig("cooldown_new_hours", v)} />
                        </div>
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Giorni prima di ricontattare un lead contattato</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.cooldown_contacted_days || 5}g</Badge>
                          </Label>
                          <Slider value={[outreachConfig.cooldown_contacted_days || 5]} min={1} max={30} step={1} onValueChange={([v]) => updateOutreachConfig("cooldown_contacted_days", v)} />
                        </div>
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Giorni prima di ricontattare un lead in trattativa</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.cooldown_negotiation_days || 7}g</Badge>
                          </Label>
                          <Slider value={[outreachConfig.cooldown_negotiation_days || 7]} min={1} max={30} step={1} onValueChange={([v]) => updateOutreachConfig("cooldown_negotiation_days", v)} />
                        </div>
                        <div>
                          <Label className="text-sm font-medium flex items-center justify-between mb-2">
                            <span>Max tentativi per lead</span>
                            <Badge variant="outline" className="text-xs">{outreachConfig.max_attempts_per_lead || 3}</Badge>
                          </Label>
                          <Slider value={[outreachConfig.max_attempts_per_lead || 3]} min={1} max={10} step={1} onValueChange={([v]) => updateOutreachConfig("max_attempts_per_lead", v)} />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-sm font-semibold mb-1 flex items-center gap-2">
                        <Route className="h-4 w-4 text-blue-500" />
                        Strategia Canale
                      </Label>
                      <p className="text-xs text-gray-400 mb-4">Definisci quale canale usare per il primo contatto e per i lead ad alto score.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Canale primo contatto</Label>
                          <Select value={outreachConfig.first_contact_channel || "auto"} onValueChange={(v) => updateOutreachConfig("first_contact_channel", v)}>
                            <SelectTrigger className="w-full h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Automatico (Hunter sceglie)</SelectItem>
                              <SelectItem value="voice">Chiamata</SelectItem>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-gray-400">Canale da usare per il primo contatto con lead nuovi</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Canale preferito per lead ad alto score (&gt;80)</Label>
                          <Select value={outreachConfig.high_score_channel || "voice"} onValueChange={(v) => updateOutreachConfig("high_score_channel", v)}>
                            <SelectTrigger className="w-full h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="voice">Chiamata</SelectItem>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-gray-400">Per lead con score AI &gt; 80, Hunter preferirà questo canale</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-sm font-semibold mb-1 flex items-center gap-2">
                        <PenLine className="h-4 w-4 text-purple-500" />
                        Stile Comunicazione
                      </Label>
                      <p className="text-xs text-gray-400 mb-4">Personalizza il tono, lo stile e la firma dei messaggi generati da Hunter.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Stile di comunicazione</Label>
                          <Select value={outreachConfig.communication_style || "professionale"} onValueChange={(v) => updateOutreachConfig("communication_style", v)}>
                            <SelectTrigger className="w-full h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="formale">Formale</SelectItem>
                              <SelectItem value="professionale">Professionale</SelectItem>
                              <SelectItem value="informale">Informale</SelectItem>
                              <SelectItem value="amichevole">Amichevole</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Opening hook</Label>
                          <Input
                            value={outreachConfig.opening_hook || ""}
                            onChange={(e) => updateOutreachConfig("opening_hook", e.target.value)}
                            placeholder="Es: Ho notato che la vostra azienda..."
                            className="h-9 text-xs"
                          />
                          <p className="text-[10px] text-gray-400">Frase di apertura personalizzata per i messaggi</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Istruzioni personalizzate</Label>
                          <Textarea
                            value={outreachConfig.custom_instructions || ""}
                            onChange={(e) => updateOutreachConfig("custom_instructions", e.target.value)}
                            placeholder="Es: Non usare 'sinergia', menziona il Sistema Orbitale, sii diretto..."
                            className="text-xs min-h-[80px] resize-y"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Firma email</Label>
                          <Textarea
                            value={outreachConfig.email_signature || ""}
                            onChange={(e) => updateOutreachConfig("email_signature", e.target.value)}
                            placeholder={"Nome Cognome\nTitolo | Azienda\nTel: +39...\nwww.sito.it"}
                            className="text-xs min-h-[80px] resize-y"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-sm font-semibold mb-1 flex items-center gap-2">
                        <Users className="h-4 w-4 text-violet-500" />
                        Dipendenti e Account per Outreach
                      </Label>
                      <p className="text-xs text-gray-400 mb-4">Hunter usa questi strumenti per contattare i lead tramite i canali configurati.</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                          <Label className="text-xs font-semibold flex items-center gap-1.5">
                            <PhoneCall className="h-3.5 w-3.5 text-green-600" />
                            Configurazione Chiamate
                          </Label>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground">Template outbound</Label>
                            <Select value={outreachConfig.voice_template_id || "none"} onValueChange={(v) => updateOutreachConfig("voice_template_id", v === "none" ? "" : v)}>
                              <SelectTrigger className="w-full h-9 text-xs">
                                <SelectValue placeholder="Seleziona template voce" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Predefinito (Hunter sceglie)</SelectItem>
                                {voiceTemplateOptions.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name} — {t.description}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground">Istruzione chiamata</Label>
                            <Textarea
                              value={outreachConfig.call_instruction_template || ""}
                              onChange={(e) => updateOutreachConfig("call_instruction_template", e.target.value)}
                              placeholder="Es: Presentarsi come partner tecnologico, scoprire se usano già AI..."
                              className="text-xs min-h-[60px] resize-y"
                              rows={3}
                            />
                          </div>
                        </div>
                        <div className="space-y-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                          <Label className="text-xs font-semibold flex items-center gap-1.5">
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                            Configurazione WhatsApp
                          </Label>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground">Dipendente WhatsApp</Label>
                            <Select value={outreachConfig.whatsapp_config_id || "none"} onValueChange={(v) => updateOutreachConfig("whatsapp_config_id", v === "none" ? "" : v)}>
                              <SelectTrigger className="w-full h-9 text-xs">
                                <SelectValue placeholder="Seleziona dipendente WA" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nessuno (disabilita WA outreach)</SelectItem>
                                {proactiveWaConfigs.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {proactiveWaConfigs.length === 0 && <p className="text-[10px] text-amber-600 mt-1">Nessun dipendente WA proattivo trovato</p>}
                          </div>

                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] text-muted-foreground">Template WhatsApp per Hunter</Label>
                              {hunterSelectedTemplateIds.length > 0 && (
                                <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0.5">
                                  {hunterSelectedTemplateIds.length} selezionati
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400">
                              Seleziona i template che Hunter userà per l'outreach WhatsApp. Senza template, i messaggi verranno generati dall'AI come testo libero.
                            </p>

                            {hunterTemplatesLoading ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                              </div>
                            ) : hunterWaTemplates.length === 0 ? (
                              <div className="text-center py-4 text-gray-500">
                                <MessageCircle className="h-6 w-6 mx-auto mb-1.5 text-gray-300" />
                                <p className="text-[10px]">Nessun template WhatsApp approvato trovato</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">
                                  Configura i template nella sezione WhatsApp Templates
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                                {Object.entries(hunterTemplatesByCategory).map(([categoryName, categoryTemplates]) => {
                                  const isOpen = openHunterTemplateCategories.has(categoryName);
                                  const colors = HUNTER_TEMPLATE_CATEGORY_COLORS[categoryName] || HUNTER_TEMPLATE_CATEGORY_COLORS["Generale"];
                                  const selectedInCategory = categoryTemplates.filter(t =>
                                    hunterSelectedTemplateIds.includes(t.id)
                                  ).length;

                                  return (
                                    <Collapsible
                                      key={categoryName}
                                      open={isOpen}
                                      onOpenChange={(open) => {
                                        setOpenHunterTemplateCategories(prev => {
                                          const newSet = new Set(prev);
                                          if (open) newSet.add(categoryName);
                                          else newSet.delete(categoryName);
                                          return newSet;
                                        });
                                      }}
                                    >
                                      <CollapsibleTrigger asChild>
                                        <div className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${colors.bg} ${colors.border} border hover:opacity-90`}>
                                          <div className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full ${colors.icon}`}></div>
                                            <span className={`text-xs font-semibold ${colors.text}`}>{categoryName}</span>
                                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${colors.bg} ${colors.text} ${colors.border}`}>
                                              {categoryTemplates.length} template
                                            </Badge>
                                            {selectedInCategory > 0 && (
                                              <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0">
                                                {selectedInCategory} sel.
                                              </Badge>
                                            )}
                                          </div>
                                          <ChevronDown className={`h-3.5 w-3.5 ${colors.text} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                        </div>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="mt-1.5">
                                        <div className="space-y-1.5 pl-1">
                                          {categoryTemplates.map((template) => {
                                            const isSelected = hunterSelectedTemplateIds.includes(template.id);
                                            return (
                                              <label
                                                key={template.id}
                                                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                                                  isSelected
                                                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm"
                                                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-200 hover:bg-gray-50"
                                                }`}
                                              >
                                                <Checkbox
                                                  checked={isSelected}
                                                  onCheckedChange={(checked) => handleHunterTemplateToggle(template.id, checked as boolean)}
                                                  className="mt-0.5"
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                                      {template.friendlyName}
                                                    </span>
                                                    <Badge className="text-[9px] bg-green-100 text-green-700 border-green-300 px-1.5 py-0">
                                                      Approvato
                                                    </Badge>
                                                  </div>
                                                  <p className="text-[10px] text-gray-600 dark:text-gray-300 mt-1 leading-relaxed line-clamp-2">
                                                    {template.bodyText || "Template senza corpo visibile"}
                                                  </p>
                                                </div>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  );
                                })}
                              </div>
                            )}

                            {hunterSelectedTemplateIds.length === 0 && hunterWaTemplates.length > 0 && (
                              <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                <p className="text-[9px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  Nessun template selezionato. I messaggi verranno generati dall'AI come testo libero (funziona solo con conversazioni attive nelle ultime 24h).
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                          <Label className="text-xs font-semibold flex items-center gap-1.5">
                            <MailIcon className="h-3.5 w-3.5 text-blue-600" />
                            Account email
                          </Label>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground">Account di invio</Label>
                            <Select value={outreachConfig.email_account_id || "none"} onValueChange={(v) => updateOutreachConfig("email_account_id", v === "none" ? "" : v)}>
                              <SelectTrigger className="w-full h-9 text-xs">
                                <SelectValue placeholder="Seleziona account email" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nessuno (disabilita email outreach)</SelectItem>
                                {emailAccounts.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.email})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {emailAccounts.length === 0 && <p className="text-[10px] text-amber-600 mt-1">Nessun account email configurato</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Priorità canali di contatto</Label>
                      <p className="text-xs text-gray-400 mb-3">Hunter proverà i canali in questo ordine per ogni lead.</p>
                      <div className="space-y-2">
                        {outreachConfig.channel_priority.map((ch: string, idx: number) => {
                          const info = channelLabelsMap[ch];
                          if (!info) return null;
                          return (
                            <div key={ch} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                              <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}.</span>
                              <span className={cn("text-sm font-medium", info.color)}>{info.label}</span>
                              <div className="flex gap-1 ml-auto">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={idx === 0} onClick={() => moveChannelPriority(idx, "up")}>
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={idx === outreachConfig.channel_priority.length - 1} onClick={() => moveChannelPriority(idx, "down")}>
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-sm font-semibold mb-1 flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-teal-500" />
                        Sequenza Follow-up
                      </Label>
                      <p className="text-xs text-gray-400 mb-4">Quando un lead non risponde, Hunter segue questa sequenza automaticamente. Dopo l'ultimo step, il lead viene marcato come non raggiungibile.</p>
                      <div className="space-y-2">
                        {(outreachConfig.follow_up_sequence || []).map((step: { day: number; channel: string }, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{idx + 1}.</span>
                            <Select
                              value={step.channel}
                              onValueChange={(v) => {
                                const seq = [...(outreachConfig.follow_up_sequence || [])];
                                seq[idx] = { ...seq[idx], channel: v };
                                updateOutreachConfig("follow_up_sequence", seq);
                              }}
                            >
                              <SelectTrigger className="w-[140px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="voice">Chiamata</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-xs text-muted-foreground shrink-0">dopo</span>
                            <Input
                              type="number"
                              min={0}
                              max={30}
                              value={step.day}
                              onChange={(e) => {
                                const seq = [...(outreachConfig.follow_up_sequence || [])];
                                seq[idx] = { ...seq[idx], day: Math.max(0, Math.min(30, parseInt(e.target.value) || 0)) };
                                updateOutreachConfig("follow_up_sequence", seq);
                              }}
                              className="w-[70px] h-8 text-xs text-center"
                            />
                            <span className="text-xs text-muted-foreground shrink-0">giorni</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 ml-auto text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              disabled={(outreachConfig.follow_up_sequence || []).length <= 1}
                              onClick={() => {
                                const seq = [...(outreachConfig.follow_up_sequence || [])];
                                seq.splice(idx, 1);
                                updateOutreachConfig("follow_up_sequence", seq);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      {(outreachConfig.follow_up_sequence || []).length < 6 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 text-xs h-8"
                          onClick={() => {
                            const seq = [...(outreachConfig.follow_up_sequence || [])];
                            const lastDay = seq.length > 0 ? seq[seq.length - 1].day + 3 : 0;
                            seq.push({ day: lastDay, channel: "email" });
                            updateOutreachConfig("follow_up_sequence", seq);
                          }}
                        >
                          + Aggiungi step
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AnimatePresence>
        {showPlanPanel && currentPlan && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setShowPlanPanel(false)}
            />
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full sm:w-[560px] max-w-full z-50 flex flex-col bg-background shadow-2xl border-l"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-indigo-50 dark:from-indigo-950/30 to-transparent">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Target className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">Piano Hunter</h3>
                  <p className="text-xs text-muted-foreground">{currentPlan.totalActions} azioni proposte</p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                  {currentPlan.channels?.voice > 0 && <span className="flex items-center gap-0.5"><PhoneCall className="h-2.5 w-2.5 text-green-600" />{currentPlan.channels.voice}</span>}
                  {currentPlan.channels?.whatsapp > 0 && <span className="flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5 text-emerald-600" />{currentPlan.channels.whatsapp}</span>}
                  {currentPlan.channels?.email > 0 && <span className="flex items-center gap-0.5"><MailIcon className="h-2.5 w-2.5 text-blue-600" />{currentPlan.channels.email}</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPlanPanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: "55%" }}>
                  {currentPlan.summary && (
                    <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                      <p className="font-semibold mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" />Strategia</p>
                      {currentPlan.summary}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {(currentPlan.leads || []).map((lead: any) => {
                      const chIcon = lead.action === "call" ? PhoneCall : lead.action === "whatsapp" ? MessageCircle : MailIcon;
                      const chColor = lead.action === "call" ? "text-green-600" : lead.action === "whatsapp" ? "text-emerald-600" : "text-blue-600";
                      const ChIcon = chIcon;
                      return (
                        <div
                          key={lead.leadId}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border transition-all",
                            lead.included !== false
                              ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                              : "bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 opacity-50"
                          )}
                        >
                          <button
                            className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                              lead.included !== false
                                ? "border-indigo-500 bg-indigo-500 text-white"
                                : "border-gray-300 dark:border-gray-600"
                            )}
                            onClick={() => {
                              const updated = (currentPlan.leads || []).map((l: any) =>
                                l.leadId === lead.leadId ? { ...l, included: l.included === false ? true : false } : l
                              );
                              const channels = {
                                voice: updated.filter((l: any) => l.included !== false && l.action === 'call').length,
                                whatsapp: updated.filter((l: any) => l.included !== false && l.action === 'whatsapp').length,
                                email: updated.filter((l: any) => l.included !== false && l.action === 'email').length,
                              };
                              setCurrentPlan((prev: any) => ({
                                ...prev,
                                leads: updated,
                                totalActions: channels.voice + channels.whatsapp + channels.email,
                                channels,
                              }));
                            }}
                          >
                            {lead.included !== false && <Check className="h-3 w-3" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-xs truncate">{lead.businessName}</span>
                              {lead.score && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">{lead.score}</Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">{lead.reason}</p>
                            {lead.talkingPoints && lead.talkingPoints.length > 0 && (
                              <p className="text-[9px] text-muted-foreground/70 truncate mt-0.5">
                                {lead.talkingPoints.join(" · ")}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Select
                              value={lead.action}
                              onValueChange={(val) => {
                                const updated = (currentPlan.leads || []).map((l: any) =>
                                  l.leadId === lead.leadId ? { ...l, action: val } : l
                                );
                                const channels = {
                                  voice: updated.filter((l: any) => l.included !== false && l.action === 'call').length,
                                  whatsapp: updated.filter((l: any) => l.included !== false && l.action === 'whatsapp').length,
                                  email: updated.filter((l: any) => l.included !== false && l.action === 'email').length,
                                };
                                setCurrentPlan((prev: any) => ({
                                  ...prev,
                                  leads: updated,
                                  totalActions: channels.voice + channels.whatsapp + channels.email,
                                  channels,
                                }));
                              }}
                            >
                              <SelectTrigger className="h-6 w-[90px] text-[10px] border-gray-200 dark:border-gray-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="call"><span className="flex items-center gap-1"><PhoneCall className="h-3 w-3 text-green-600" />Chiamata</span></SelectItem>
                                <SelectItem value="whatsapp"><span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-emerald-600" />WhatsApp</span></SelectItem>
                                <SelectItem value="email"><span className="flex items-center gap-1"><MailIcon className="h-3 w-3 text-blue-600" />Email</span></SelectItem>
                                <SelectItem value="skip"><span className="flex items-center gap-1"><X className="h-3 w-3 text-gray-400" />Salta</span></SelectItem>
                              </SelectContent>
                            </Select>
                            <ChIcon className={cn("h-3.5 w-3.5 shrink-0", chColor)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t flex-1 flex flex-col" style={{ maxHeight: "45%" }}>
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                    {planChatMessages.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground">Chatta con Hunter per modificare il piano</p>
                        <div className="flex flex-col gap-1.5 mt-3 max-w-[280px] mx-auto">
                          {[
                            "Togli i lead con score sotto 70",
                            "Usa solo email per tutti",
                            "Concentrati sul settore recruiting",
                          ].map((s, i) => (
                            <button
                              key={i}
                              onClick={() => setPlanChatInput(s)}
                              className="text-left text-[10px] px-2.5 py-1.5 rounded-md border border-dashed hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors text-muted-foreground"
                            >
                              <Sparkles className="h-2.5 w-2.5 inline-block mr-1 opacity-50" />{s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      planChatMessages.map((msg) => (
                        <Message
                          key={msg.id}
                          message={msg}
                          assistantName="Hunter"
                          assistantSubtitle="Piano Interattivo"
                        />
                      ))
                    )}
                    {planChatLoading && <ThinkingBubble isThinking={true} />}
                    <div ref={planChatEndRef} />
                  </div>

                  <div className="p-3 border-t">
                    <div className="flex gap-2">
                      <Textarea
                        value={planChatInput}
                        onChange={(e) => setPlanChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePlanChat(); }
                        }}
                        placeholder="Modifica il piano..."
                        disabled={planChatLoading}
                        className="resize-none min-h-[36px] max-h-[80px] text-xs flex-1"
                        rows={1}
                      />
                      <Button size="sm" className="h-9 w-9 p-0 shrink-0" onClick={handlePlanChat} disabled={!planChatInput.trim() || planChatLoading}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t flex items-center gap-2 bg-gray-50/50 dark:bg-gray-800/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => { setShowPlanPanel(false); setCurrentPlan(null); setPlanChatMessages([]); }}
                >
                  Annulla
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-4"
                  onClick={handleExecutePlan}
                  disabled={planExecuting || (currentPlan.totalActions || 0) === 0}
                >
                  {planExecuting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {planExecuting ? "Esecuzione..." : `Approva ed Esegui (${currentPlan.totalActions || 0})`}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <button
        onClick={() => setShowChat(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center"
      >
        <Bot className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
      </button>

      <AnimatePresence>
        {showChat && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setShowChat(false)}
            />
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full sm:w-[420px] max-w-full z-50 flex flex-col bg-background shadow-2xl border-l"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-muted/50 to-transparent">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">Sales Agent</h3>
                  <p className="text-xs text-muted-foreground">Chat diretta</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setChatMessages([])}
                    disabled={chatMessages.length === 0 || chatLoading}
                    title="Cancella chat"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowChat(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium mb-1">Chatta con Sales Agent</p>
                      <p className="text-xs text-muted-foreground max-w-[250px]">
                        Chiedi strategie, email, analisi sui lead
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 w-full max-w-[280px]">
                      {[
                        "Qual e' il lead piu promettente?",
                        "Prepara una email di presentazione",
                        "Come approccio i lead a Milano?",
                      ].map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setChatInput(s);
                          }}
                          className="text-left text-xs px-3 py-2 rounded-lg border border-dashed hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Sparkles className="h-3 w-3 inline-block mr-1.5 opacity-50" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <Message
                      key={msg.id}
                      message={msg}
                      assistantName="Sales Agent"
                      assistantSubtitle="AI Lead Scraper"
                    />
                  ))
                )}

                {chatLoading && (
                  <ThinkingBubble isThinking={true} />
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3">
                <div className="relative bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200/70 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl transition-all duration-300 focus-within:border-primary/40 dark:focus-within:border-primary/40 focus-within:shadow-primary/10 focus-within:bg-white dark:focus-within:bg-slate-800">
                  <div className="px-4 pt-3 pb-2">
                    <Textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChat();
                        }
                      }}
                      placeholder={chatLoading ? "Sto elaborando..." : "Scrivi a Sales Agent..."}
                      disabled={chatLoading}
                      className="resize-none min-h-[44px] max-h-[120px] bg-transparent border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 p-0 shadow-none"
                      rows={1}
                    />
                  </div>

                  <div className="flex items-center justify-end px-3 pb-3 pt-1">
                    <Button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim() || chatLoading}
                      size="sm"
                      className="h-9 w-9 p-0 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 disabled:from-slate-200 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-600 transition-all"
                    >
                      {chatLoading ? (
                        <div className="flex gap-0.5">
                          <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      ) : (
                        <Send className="h-4 w-4 text-white" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Dialog open={hunterSingleLeadDialog.open} onOpenChange={(open) => setHunterSingleLeadDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-teal-600" />
              Analizza con Hunter
            </DialogTitle>
          </DialogHeader>
          {hunterSingleLeadDialog.lead && (() => {
            const lead = hunterSingleLeadDialog.lead;
            const ch = hunterSingleLeadDialog.channels;
            const selectedCount = [ch.voice, ch.whatsapp, ch.email].filter(Boolean).length;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{lead.businessName}</p>
                    {lead.category && <p className="text-xs text-muted-foreground">{lead.category}</p>}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {lead.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{lead.phone}</span>}
                      {lead.email && <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" />{lead.email}</span>}
                    </div>
                  </div>
                  {lead.aiCompatibilityScore != null && (
                    <div className="text-center shrink-0">
                      <div className={cn("text-lg font-bold", lead.aiCompatibilityScore >= 80 ? "text-emerald-600" : lead.aiCompatibilityScore >= 60 ? "text-amber-600" : "text-gray-500")}>{lead.aiCompatibilityScore}</div>
                      <div className="text-[9px] text-muted-foreground">Score</div>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canali di outreach</p>
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <Checkbox
                      checked={ch.voice}
                      onCheckedChange={(v) => setHunterSingleLeadDialog(prev => ({ ...prev, channels: { ...prev.channels, voice: !!v } }))}
                    />
                    <PhoneCall className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Chiamata vocale</p>
                      <p className="text-[10px] text-muted-foreground">Alessia chiama con il template predefinito + contesto lead</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <Checkbox
                      checked={ch.whatsapp}
                      onCheckedChange={(v) => setHunterSingleLeadDialog(prev => ({ ...prev, channels: { ...prev.channels, whatsapp: !!v } }))}
                      disabled={!lead.phone}
                    />
                    <MessageCircle className={cn("h-4 w-4", lead.phone ? "text-emerald-600" : "text-gray-300")} />
                    <div className="flex-1">
                      <p className={cn("text-sm font-medium", !lead.phone && "text-muted-foreground")}>WhatsApp</p>
                      <p className="text-[10px] text-muted-foreground">{lead.phone ? "Template WA + contesto lead personalizzato" : "Nessun numero di telefono disponibile"}</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <Checkbox
                      checked={ch.email}
                      onCheckedChange={(v) => setHunterSingleLeadDialog(prev => ({ ...prev, channels: { ...prev.channels, email: !!v } }))}
                      disabled={!lead.email}
                    />
                    <MailIcon className={cn("h-4 w-4", lead.email ? "text-blue-600" : "text-gray-300")} />
                    <div className="flex-1">
                      <p className={cn("text-sm font-medium", !lead.email && "text-muted-foreground")}>Email</p>
                      <p className="text-[10px] text-muted-foreground">{lead.email ? "Email personalizzata generata dall'AI" : "Nessuna email disponibile"}</p>
                    </div>
                  </label>
                </div>

                {ch.voice && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Numero per la chiamata</Label>
                    <Input
                      value={hunterSingleLeadDialog.voiceTargetPhone}
                      onChange={(e) => setHunterSingleLeadDialog(prev => ({ ...prev, voiceTargetPhone: e.target.value }))}
                      placeholder="Es: +393519272875 o 1004"
                      className="h-8 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">Puoi inserire un numero diverso da quello del lead (es. interno SIP)</p>
                  </div>
                )}

                {!outreachConfig.enabled && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">Hunter non e abilitato. I task verranno comunque creati in attesa di approvazione.</p>
                  </div>
                )}

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    {selectedCount > 0
                      ? `Hunter creerà ${selectedCount} task in modalità Solo Approvazione. Potrai approvarli dalla Coda Outreach.`
                      : "Seleziona almeno un canale per procedere."
                    }
                  </p>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setHunterSingleLeadDialog(prev => ({ ...prev, open: false }))} disabled={hunterSingleLeadDialog.loading}>
              Annulla
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
              onClick={handleHunterSingleLead}
              disabled={hunterSingleLeadDialog.loading || ![hunterSingleLeadDialog.channels.voice, hunterSingleLeadDialog.channels.whatsapp, hunterSingleLeadDialog.channels.email].some(Boolean)}
            >
              {hunterSingleLeadDialog.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              {hunterSingleLeadDialog.loading ? "Creazione task..." : "Avvia Hunter su questo lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
