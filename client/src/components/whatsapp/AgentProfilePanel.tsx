import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { 
  Settings, 
  MessageSquare, 
  Trash2, 
  Bot,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Target,
  Zap,
  Brain,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Copy,
  CalendarCheck,
  Link,
  Unlink,
  Loader2,
  RefreshCw,
  Info,
  Mic,
  BookOpen,
  ShieldCheck,
  BadgeDollarSign,
  UserX,
  Sparkles,
  FileText,
  Share2,
  Instagram,
  X,
  Plus,
  FlaskConical,
  ChevronDown,
  HelpCircle,
  Smartphone,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AgentShareManager } from "./agent-share-manager";
import { AgentUsersSection } from "./AgentUsersSection";
import { LevelBadge } from "./LevelBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Agent {
  id: string;
  name: string;
  agentType: string;
  status: "active" | "paused" | "test";
  performanceScore: number;
  trend: "up" | "down" | "stable";
}

interface FileSearchCategories {
  courses?: boolean;
  lessons?: boolean;
  exercises?: boolean;
  knowledgeBase?: boolean;
  library?: boolean;
  university?: boolean;
}

interface AgentAnalytics {
  agent: {
    id: string;
    name: string;
    type: string;
    businessName?: string;
    businessDescription?: string;
    consultantDisplayName?: string;
    personality?: string;
    isActive?: boolean;
    phone?: string;
    isDryRun?: boolean;
    isProactive?: boolean;
    enableInAIAssistant?: boolean;
    fileSearchCategories?: FileSearchCategories;
    level?: "1" | "2" | null;
    levels?: string[] | null;
    publicSlug?: string;
    dailyMessageLimit?: number;
    features?: {
      bookingEnabled: boolean;
      objectionHandlingEnabled: boolean;
      disqualificationEnabled: boolean;
      upsellingEnabled: boolean;
      ttsEnabled: boolean;
      hasCalendar: boolean;
      hasKnowledgeBase: boolean;
      hasSalesScript: boolean;
    };
    workingHours?: {
      start: number;
      end: number;
      timezone?: string;
    } | null;
    whoWeHelp?: string;
    whatWeDo?: string;
    createdAt?: string;
  };
  metrics: {
    score: number;
    conversations7d: number;
    conversations30d: number;
    messages7d: number;
    avgResponseTime: number;
  };
  trend: Array<{
    date: string;
    conversations: number;
  }>;
  skills: Array<{
    name: string;
    level: number;
    description?: string;
  }>;
}

interface AgentProfilePanelProps {
  selectedAgent: Agent | null;
  onDeleteAgent?: (agentId: string) => void;
  onDuplicateAgent?: (agentId: string) => void;
}

interface ConsultantClient {
  id: string;
  name: string;
  email?: string;
}

function PerformanceGauge({ score, trend }: { score: number; trend: string }) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-slate-400";
  
  const scoreColor = score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600";
  const strokeColor = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="45"
            stroke="#e2e8f0"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="64"
            cy="64"
            r="45"
            stroke={strokeColor}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold", scoreColor)}>{score}</span>
          <span className="text-xs text-slate-500">Performance</span>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2">
        <TrendIcon className={cn("h-4 w-4", trendColor)} />
        <span className={cn("text-sm font-medium", trendColor)}>
          {trend === "up" ? "In crescita" : trend === "down" ? "In calo" : "Stabile"}
        </span>
      </div>
    </div>
  );
}

function SkillBar({ name, level, description }: { name: string; level: number; description: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="text-xs text-slate-500">{level}%</span>
      </div>
      <Progress value={level} className="h-2" />
      <p className="text-xs text-slate-400">{description}</p>
    </div>
  );
}

function PlaceholderPanel() {
  return (
    <Card className="bg-white border border-slate-200 h-full flex items-center justify-center">
      <CardContent className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Bot className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-700 mb-2">Seleziona un agente</h3>
        <p className="text-sm text-slate-500 max-w-xs">
          Clicca su un agente nella lista per visualizzare i dettagli e le statistiche
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Card className="bg-white border border-slate-200 h-full">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-32 w-32 mx-auto rounded-full" />
        <Skeleton className="h-48 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentProfilePanel({ selectedAgent, onDeleteAgent, onDuplicateAgent }: AgentProfilePanelProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [calendarStatus, setCalendarStatus] = useState<{
    connected: boolean;
    email?: string;
    connectedAt?: string;
  }>({ connected: false });
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [enableInAIAssistant, setEnableInAIAssistant] = useState(false);
  const [fileSearchCategories, setFileSearchCategories] = useState<FileSearchCategories>({
    courses: false,
    lessons: false,
    exercises: false,
    knowledgeBase: false,
    library: false,
    university: false,
  });
  const [isSavingAISettings, setIsSavingAISettings] = useState(false);

  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [showShareManager, setShowShareManager] = useState(false);

  // Query per ottenere lo slug dell'agente per accesso dipendente
  const { data: agentShares } = useQuery<{ shares: Array<{ id: string; slug: string; publicUrl: string; isActive: boolean; revokedAt?: string | null; agent?: { id: string } }> }>({
    queryKey: ["/api/whatsapp/agent-share", selectedAgent?.id],
    queryFn: async () => {
      const res = await fetch('/api/whatsapp/agent-share', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to fetch shares");
      return res.json();
    },
    enabled: !!selectedAgent?.id,
    staleTime: 60000,
  });

  // Trova share attivo per questo agente (per accesso dipendente)
  const activeShare = agentShares?.shares?.find(s => 
    s.agent?.id === selectedAgent?.id && s.isActive && !s.revokedAt
  );
  
  // Instagram integration state
  const [selectedInstagramConfigId, setSelectedInstagramConfigId] = useState<string | null>(null);
  const [isSavingInstagram, setIsSavingInstagram] = useState(false);
  const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
  const [isDisconnectingInstagram, setIsDisconnectingInstagram] = useState(false);
  const [instagramError, setInstagramError] = useState<{ code: string; message: string } | null>(null);

  // Instagram automation state
  const [newKeyword, setNewKeyword] = useState("");
  const [commentAutoReplyMessage, setCommentAutoReplyMessage] = useState("");
  const [storyAutoReplyMessage, setStoryAutoReplyMessage] = useState("");
  
  // Ice Breakers state
  const [iceBreakers, setIceBreakers] = useState<Array<{ text: string; payload: string }>>([]);
  const [newIceBreaker, setNewIceBreaker] = useState("");

  // Twitter/X integration state
  const [isConnectingTwitter, setIsConnectingTwitter] = useState(false);
  const [twitterError, setTwitterError] = useState<{ code: string; message: string } | null>(null);

  // Fetch Instagram configs
  const { data: instagramConfigs, isLoading: isLoadingInstagramConfigs } = useQuery<{
    configs: Array<{
      id: string;
      instagramPageId: string;
      agentName: string | null;
      isActive: boolean;
      autoResponseEnabled: boolean;
      storyReplyEnabled: boolean;
      commentToDmEnabled: boolean;
      commentTriggerKeywords: string[];
      commentAutoReplyMessage: string | null;
      storyAutoReplyMessage: string | null;
      iceBreakersEnabled: boolean;
      iceBreakers: any[];
      isDryRun: boolean;
      linkedAgent: { agentId: string; agentName: string } | null;
    }>;
  }>({
    queryKey: ["/api/whatsapp/instagram-configs"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/instagram-configs", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch Instagram configs");
      return res.json();
    },
    staleTime: 30000,
  });

  // Load agent's current Instagram config
  const { data: agentDetails } = useQuery<{ config: { instagramConfigId?: string } }>({
    queryKey: ["/api/whatsapp/config", selectedAgent?.id],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/config/${selectedAgent?.id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch agent details");
      return res.json();
    },
    enabled: !!selectedAgent?.id,
  });

  useEffect(() => {
    if (agentDetails?.config?.instagramConfigId) {
      setSelectedInstagramConfigId(agentDetails.config.instagramConfigId);
    } else {
      setSelectedInstagramConfigId(null);
    }
  }, [agentDetails?.config?.instagramConfigId, selectedAgent?.id]);

  // Sync Instagram textarea states when config changes
  useEffect(() => {
    if (selectedInstagramConfigId && instagramConfigs?.configs) {
      const currentConfig = instagramConfigs.configs.find(c => c.id === selectedInstagramConfigId);
      if (currentConfig) {
        setStoryAutoReplyMessage(currentConfig.storyAutoReplyMessage || '');
        setCommentAutoReplyMessage(currentConfig.commentAutoReplyMessage || '');
        setIceBreakers(currentConfig.iceBreakers || []);
      }
    } else {
      setStoryAutoReplyMessage('');
      setCommentAutoReplyMessage('');
      setIceBreakers([]);
    }
  }, [selectedInstagramConfigId, instagramConfigs?.configs]);

  // Handle Instagram OAuth errors from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorCode = urlParams.get('instagram_error');
    const successParam = urlParams.get('instagram_success');
    
    if (errorCode) {
      const errorMessages: Record<string, string> = {
        'no_instagram': 'Nessun account Instagram Business collegato alla tua pagina Facebook. Devi prima collegare il tuo account Instagram alla pagina Facebook.',
        'no_pages': 'Nessuna pagina Facebook trovata. Assicurati di essere admin di almeno una pagina Facebook.',
        'missing_params': 'Parametri mancanti durante l\'autorizzazione. Riprova.',
        'invalid_state': 'Sessione di autorizzazione non valida. Riprova.',
        'state_expired': 'Sessione di autorizzazione scaduta. Riprova.',
        'config_missing': 'Configurazione Instagram non trovata. Contatta il supporto.',
        'token_error': 'Errore durante lo scambio del token. Riprova.',
        'callback_failed': 'Errore durante il callback. Riprova.',
      };
      
      setInstagramError({
        code: errorCode,
        message: errorMessages[errorCode] || `Errore sconosciuto: ${errorCode}`
      });
      
      // Clean URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } else if (successParam) {
      const username = urlParams.get('username');
      toast({
        title: "Instagram Collegato!",
        description: username ? `Account @${username} collegato con successo` : "Account collegato con successo"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instagram-configs"] });
      
      // Clean URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [toast, queryClient]);

  const handleLinkInstagram = async (configId: string | null) => {
    if (!selectedAgent?.id) return;
    
    setIsSavingInstagram(true);
    try {
      const response = await fetch(`/api/whatsapp/config/${selectedAgent.id}/instagram`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagramConfigId: configId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Errore durante il collegamento');
      }
      
      setSelectedInstagramConfigId(configId);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instagram-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config", selectedAgent.id] });
      
      toast({
        title: configId ? "Instagram Collegato" : "Instagram Scollegato",
        description: data.message
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile collegare Instagram"
      });
    } finally {
      setIsSavingInstagram(false);
    }
  };

  const handleConnectInstagram = async () => {
    setIsConnectingInstagram(true);
    setInstagramError(null);
    try {
      const response = await fetch("/api/instagram/oauth/start", {
        method: "GET",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || "Impossibile iniziare il collegamento");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Errore durante la connessione a Instagram"
      });
      setIsConnectingInstagram(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    if (!confirm("Sei sicuro di voler disconnettere completamente Instagram? Dovrai rifare il login OAuth.")) {
      return;
    }
    setIsDisconnectingInstagram(true);
    try {
      const response = await fetch("/api/instagram/oauth/disconnect", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Instagram Disconnesso",
          description: "Account scollegato con successo. Puoi ricollegarlo quando vuoi."
        });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instagram-configs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/instagram/oauth/status"] });
        setSelectedInstagramConfigId(null);
      } else {
        throw new Error(data.error || "Impossibile disconnettere");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Errore durante la disconnessione"
      });
    } finally {
      setIsDisconnectingInstagram(false);
    }
  };

  // Mutation for updating Instagram settings
  const updateInstagramSettings = useMutation({
    mutationFn: async (data: { configId: string; settings: Record<string, any> }) => {
      const res = await fetch(`/api/instagram/config/${data.configId}/settings`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data.settings)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update settings');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instagram-configs"] });
      toast({
        title: "Impostazioni Salvate",
        description: "Le impostazioni Instagram sono state aggiornate"
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile salvare le impostazioni"
      });
    }
  });

  const handleInstagramSettingChange = (configId: string, key: string, value: any) => {
    updateInstagramSettings.mutate({
      configId,
      settings: { [key]: value }
    });
  };

  // Mutation for syncing Ice Breakers with Meta API
  const syncIceBreakers = useMutation({
    mutationFn: async (configId: string) => {
      const res = await fetch(`/api/instagram/config/${configId}/sync-ice-breakers`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to sync Ice Breakers');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Ice Breakers Sincronizzati",
        description: data.message || "Gli Ice Breakers sono stati sincronizzati con Instagram"
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore Sincronizzazione",
        description: error.message || "Impossibile sincronizzare gli Ice Breakers"
      });
    }
  });

  // Fetch Twitter configs
  const { data: twitterConfigs, isLoading: isLoadingTwitterConfigs } = useQuery<{
    configs: Array<{
      id: string;
      username: string | null;
      isActive: boolean;
      autoResponseEnabled: boolean;
      isDryRun: boolean;
    }>;
  }>({
    queryKey: ["/api/twitter/configs"],
    queryFn: async () => {
      const res = await fetch("/api/twitter/configs", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch Twitter configs");
      return res.json();
    },
    staleTime: 30000,
  });

  // Mutation for updating Twitter settings
  const updateTwitterSettings = useMutation({
    mutationFn: async (data: { configId: string; settings: Record<string, any> }) => {
      const res = await fetch(`/api/twitter/config/${data.configId}/settings`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data.settings)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update settings');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/twitter/configs"] });
      toast({
        title: "Impostazioni Salvate",
        description: "Le impostazioni Twitter/X sono state aggiornate"
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile salvare le impostazioni"
      });
    }
  });

  const handleTwitterSettingChange = (configId: string, key: string, value: any) => {
    updateTwitterSettings.mutate({
      configId,
      settings: { [key]: value }
    });
  };

  const handleConnectTwitter = async () => {
    setIsConnectingTwitter(true);
    setTwitterError(null);
    try {
      const response = await fetch("/api/twitter/oauth/url", {
        method: "GET",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || "Impossibile iniziare il collegamento");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Errore durante la connessione a Twitter/X"
      });
      setIsConnectingTwitter(false);
    }
  };

  const handleDisconnectTwitter = async (configId: string) => {
    if (!confirm("Sei sicuro di voler disconnettere Twitter/X? Dovrai rifare il login OAuth.")) {
      return;
    }
    try {
      const response = await fetch(`/api/twitter/config/${configId}/disconnect`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Twitter/X Disconnesso",
          description: "Account scollegato con successo. Puoi ricollegarlo quando vuoi."
        });
        queryClient.invalidateQueries({ queryKey: ["/api/twitter/configs"] });
      } else {
        throw new Error(data.error || "Impossibile disconnettere");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Errore durante la disconnessione"
      });
    }
  };

  // Query for webhook status - scoped to specific config
  const { data: webhookStatus, refetch: refetchWebhookStatus, isLoading: isLoadingWebhookStatus } = useQuery<{ 
    success: boolean; 
    isSubscribed: boolean; 
    subscriptions: any[];
    configId?: string;
  }>({
    queryKey: ["/api/instagram/config", selectedInstagramConfigId, "webhook-status"],
    queryFn: async () => {
      if (!selectedInstagramConfigId) {
        return { success: false, isSubscribed: false, subscriptions: [] };
      }
      const res = await fetch(`/api/instagram/config/${selectedInstagramConfigId}/webhook-status`, { headers: getAuthHeaders() });
      if (!res.ok) {
        return { success: false, isSubscribed: false, subscriptions: [] };
      }
      return res.json();
    },
    staleTime: 30000,
    enabled: !!selectedInstagramConfigId,
  });

  // Mutation for subscribing to webhook with comments field
  const subscribeWebhook = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/instagram/config/subscribe-webhook`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to subscribe webhook');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Webhook Aggiornato",
        description: data.message || "Webhook sottoscritto con successo"
      });
      refetchWebhookStatus();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore Webhook",
        description: error.message || "Impossibile aggiornare il webhook"
      });
    }
  });

  const handleAddKeyword = (configId: string, currentKeywords: string[]) => {
    const keyword = newKeyword.trim();
    if (keyword && !currentKeywords.includes(keyword)) {
      handleInstagramSettingChange(configId, 'commentTriggerKeywords', [...currentKeywords, keyword]);
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (configId: string, currentKeywords: string[], keywordToRemove: string) => {
    handleInstagramSettingChange(configId, 'commentTriggerKeywords', currentKeywords.filter(k => k !== keywordToRemove));
  };

  const { data: consultantClients } = useQuery<ConsultantClient[]>({
    queryKey: ["/api/ai-assistant/consultant/clients"],
    queryFn: async () => {
      const res = await fetch("/api/ai-assistant/consultant/clients", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: clientAssignments, isLoading: isLoadingAssignments } = useQuery<{ clientIds: string[] }>({
    queryKey: ["/api/ai-assistant/agent", selectedAgent?.id, "client-assignments"],
    queryFn: async () => {
      const res = await fetch(`/api/ai-assistant/agent/${selectedAgent?.id}/client-assignments`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
    enabled: !!selectedAgent?.id,
  });

  useEffect(() => {
    if (clientAssignments?.clientIds) {
      setSelectedClientIds(clientAssignments.clientIds);
    } else {
      setSelectedClientIds([]);
    }
  }, [clientAssignments?.clientIds, selectedAgent?.id]);

  const saveClientAssignments = useMutation({
    mutationFn: async (clientIds: string[]) => {
      const res = await fetch(`/api/ai-assistant/agent/${selectedAgent?.id}/client-assignments`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds })
      });
      if (!res.ok) throw new Error("Failed to save assignments");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/agent", selectedAgent?.id, "client-assignments"] });
      toast({
        title: "Assegnazioni Salvate",
        description: "Le assegnazioni clienti sono state aggiornate"
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile salvare le assegnazioni"
      });
    }
  });

  const handleClientToggle = (clientId: string, checked: boolean) => {
    const newSelectedIds = checked 
      ? [...selectedClientIds, clientId]
      : selectedClientIds.filter(id => id !== clientId);
    setSelectedClientIds(newSelectedIds);
    saveClientAssignments.mutate(newSelectedIds);
  };

  useEffect(() => {
    if (selectedAgent?.id) {
      fetchCalendarStatus();
    }
  }, [selectedAgent?.id]);

  const fetchCalendarStatus = async () => {
    if (!selectedAgent?.id) return;
    
    setIsLoadingCalendar(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent.id}/calendar/status`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setCalendarStatus(data);
      }
    } catch (error) {
      console.error('Error fetching calendar status:', error);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleConnectCalendar = async () => {
    if (!selectedAgent?.id) return;

    setIsConnecting(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent.id}/calendar/oauth/start`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore durante la connessione');
      }
      
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile avviare la connessione al calendario"
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!selectedAgent?.id) return;

    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent.id}/calendar/disconnect`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Errore durante la disconnessione');
      }
      
      setCalendarStatus({ connected: false });
      toast({
        title: "Calendario Scollegato",
        description: "Il calendario Google è stato scollegato da questo agente"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile scollegare il calendario"
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestCalendar = async () => {
    if (!selectedAgent?.id) return;

    setIsTesting(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent.id}/calendar/test`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Connessione Verificata",
          description: `Calendario funzionante - ${data.eventsCount} eventi nei prossimi 7 giorni`
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore Test",
        description: error.message || "Impossibile verificare la connessione"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const saveAIAssistantSettings = async (
    enabled: boolean,
    categories: FileSearchCategories
  ) => {
    if (!selectedAgent?.id) return;

    setIsSavingAISettings(true);
    try {
      const response = await fetch(`/api/ai-assistant/agent/${selectedAgent.id}/ai-assistant-settings`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enableInAIAssistant: enabled,
          fileSearchCategories: categories
        })
      });

      if (!response.ok) {
        throw new Error('Errore durante il salvataggio');
      }

      toast({
        title: "Impostazioni Salvate",
        description: "Le impostazioni AI Assistant sono state aggiornate"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile salvare le impostazioni"
      });
    } finally {
      setIsSavingAISettings(false);
    }
  };

  const handleEnableAIAssistantChange = async (checked: boolean) => {
    setEnableInAIAssistant(checked);
    await saveAIAssistantSettings(checked, fileSearchCategories);
  };

  const handleCategoryChange = async (category: keyof FileSearchCategories, checked: boolean) => {
    const newCategories = { ...fileSearchCategories, [category]: checked };
    setFileSearchCategories(newCategories);
    await saveAIAssistantSettings(enableInAIAssistant, newCategories);
  };

  const { data, isLoading, isError } = useQuery<AgentAnalytics>({
    queryKey: ["/api/whatsapp/agents", selectedAgent?.id, "analytics"],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent?.id}/analytics`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch agent analytics");
      }
      return response.json();
    },
    enabled: !!selectedAgent?.id,
    staleTime: 30000,
  });

  useEffect(() => {
    if (data?.agent) {
      setEnableInAIAssistant(data.agent.enableInAIAssistant ?? false);
      setFileSearchCategories({
        courses: data.agent.fileSearchCategories?.courses ?? false,
        lessons: data.agent.fileSearchCategories?.lessons ?? false,
        exercises: data.agent.fileSearchCategories?.exercises ?? false,
        knowledgeBase: data.agent.fileSearchCategories?.knowledgeBase ?? false,
        library: data.agent.fileSearchCategories?.library ?? false,
        university: data.agent.fileSearchCategories?.university ?? false,
      });
    }
  }, [data?.agent]);

  if (!selectedAgent) {
    return <PlaceholderPanel />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return (
      <Card className="bg-white border border-slate-200 h-full">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-sm text-red-600">Errore nel caricamento analytics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const defaultPerformance = {
    score: selectedAgent.performanceScore || 65,
    trend: selectedAgent.trend || "stable",
    conversationsTotal: 0,
    conversationsToday: 0,
    avgResponseTime: "15s",
    successRate: 85,
  };

  const defaultSkills = [
    { name: "Qualificazione Lead", level: 85, description: "Capacita di identificare lead qualificati" },
    { name: "Gestione Obiezioni", level: 72, description: "Risposta efficace alle obiezioni" },
    { name: "Conversione", level: 68, description: "Tasso di conversione in appuntamenti" },
    { name: "Engagement", level: 90, description: "Mantenimento della conversazione" },
  ];

  const rawMetrics = data?.performance || data?.metrics || {};
  const analytics = {
    agent: data?.agent || selectedAgent,
    performance: {
      score: rawMetrics.score || defaultPerformance.score,
      trend: rawMetrics.trend || defaultPerformance.trend,
      conversationsTotal: rawMetrics.conversations7d || rawMetrics.conversationsTotal || defaultPerformance.conversationsTotal,
      conversationsToday: rawMetrics.conversationsToday || defaultPerformance.conversationsToday,
      avgResponseTime: rawMetrics.avgResponseTime ? `${rawMetrics.avgResponseTime}s` : defaultPerformance.avgResponseTime,
      successRate: rawMetrics.successRate || defaultPerformance.successRate,
    },
    trendData: data?.trendData || data?.trend || [],
    skills: data?.skills || defaultSkills,
  };

  const agentTypeLabels: Record<string, string> = {
    reactive_lead: "Lead Reattivo",
    proactive_setter: "Setter Proattivo",
    informative_advisor: "Advisor Informativo",
    customer_success: "Customer Success",
    intake_coordinator: "Coordinatore Intake",
  };

  const agentTypeDescriptions: Record<string, string> = {
    reactive_lead: "Risponde ai messaggi in arrivo, qualifica i lead e li guida verso la prenotazione di una consulenza.",
    proactive_setter: "Contatta proattivamente i potenziali clienti per fissare appuntamenti e gestire le obiezioni.",
    informative_advisor: "Fornisce informazioni dettagliate sui servizi senza spingere alla vendita diretta.",
    customer_success: "Segue i clienti esistenti per garantire la loro soddisfazione e favorire il successo.",
    intake_coordinator: "Raccoglie documenti e informazioni necessarie prima delle consulenze.",
  };

  const personalityLabels: Record<string, string> = {
    amico_fidato: "Amico Fidato",
    coach_motivazionale: "Coach Motivazionale",
    consulente_professionale: "Consulente Professionale",
    mentore_paziente: "Mentore Paziente",
    venditore_energico: "Venditore Energico",
    consigliere_empatico: "Consigliere Empatico",
    stratega_diretto: "Stratega Diretto",
    educatore_socratico: "Educatore Socratico",
    esperto_tecnico: "Esperto Tecnico",
    compagno_entusiasta: "Compagno Entusiasta",
  };

  const agentData = data?.agent;
  const features = agentData?.features;
  
  // State for Gold access loading
  const [isLoadingGoldAccess, setIsLoadingGoldAccess] = useState(false);
  
  // Handle access as Gold employee
  const handleAccessAsGold = async () => {
    setIsLoadingGoldAccess(true);
    try {
      const res = await fetch('/api/consultant/gold-access', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Errore durante la generazione accesso');
      }
      
      const data = await res.json();
      
      // Save token in localStorage for Gold auth
      localStorage.setItem("bronzeAuthToken", data.token);
      
      // Open the select-agent page in new tab
      window.open(data.accessUrl, '_blank');
      
      toast({
        title: "Accesso Gold generato",
        description: "Stai accedendo come cliente Gold",
      });
    } catch (error: any) {
      console.error("[Gold Access] Error:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile generare l'accesso Gold",
        variant: "destructive",
      });
    } finally {
      setIsLoadingGoldAccess(false);
    }
  };

  const statusConfig = {
    active: { label: "Attivo", color: "bg-green-100 text-green-700" },
    paused: { label: "In Pausa", color: "bg-amber-100 text-amber-700" },
    test: { label: "Test", color: "bg-blue-100 text-blue-700" },
  };

  const status = statusConfig[selectedAgent.status as keyof typeof statusConfig] || statusConfig.active;

  return (
    <Card className="bg-white border border-slate-200 h-full flex flex-col">
      <ScrollArea className="flex-1">
        <CardContent className="p-4 space-y-4">
          {/* Header - Always visible */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
              {selectedAgent.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-slate-900 truncate">{selectedAgent.name}</h2>
                <Badge variant="outline" className={cn("text-xs", status.color)}>
                  {status.label}
                </Badge>
                {agentData?.level && <LevelBadge level={agentData.level} size="sm" />}
              </div>
              <p className="text-xs text-slate-500">
                {agentTypeLabels[selectedAgent.agentType] || selectedAgent.agentType}
              </p>
              {agentData?.businessName && (
                <p className="text-xs text-slate-400 truncate mt-0.5">{agentData.businessName}</p>
              )}
            </div>
          </div>

          {/* Features badges - compact row */}
          {features && (
            <div className="flex flex-wrap gap-1.5">
              {features.bookingEnabled && (
                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs px-1.5 py-0.5">
                  <CalendarCheck className="h-3 w-3 mr-0.5" />
                  Prenotazioni
                </Badge>
              )}
              {features.objectionHandlingEnabled && (
                <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5">
                  <ShieldCheck className="h-3 w-3 mr-0.5" />
                  Obiezioni
                </Badge>
              )}
              {features.hasCalendar && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-1.5 py-0.5">
                  <Calendar className="h-3 w-3 mr-0.5" />
                  Calendario
                </Badge>
              )}
              {features.ttsEnabled && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-1.5 py-0.5">
                  <Mic className="h-3 w-3 mr-0.5" />
                  Vocali
                </Badge>
              )}
              {agentData?.personality && (
                <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200 text-xs px-1.5 py-0.5">
                  <Sparkles className="h-3 w-3 mr-0.5" />
                  {personalityLabels[agentData.personality]?.split(' ')[0] || agentData.personality}
                </Badge>
              )}
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="performance" className="w-full">
            <TabsList className={cn("grid w-full h-9", agentData?.levels && agentData.levels.length > 0 ? "grid-cols-4" : "grid-cols-3")}>
              <TabsTrigger value="performance" className="text-xs gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Performance</span>
              </TabsTrigger>
              <TabsTrigger value="integrations" className="text-xs gap-1">
                <Link className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Integrazioni</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs gap-1">
                <Bot className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI & Sharing</span>
              </TabsTrigger>
              {agentData?.levels && agentData.levels.length > 0 && (
                <TabsTrigger value="utenti" className="text-xs gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Utenti</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-4 mt-4">
              {/* QUICK ACTIONS - Most Prominent at Top */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200/60">
                <h3 className="text-xs font-bold text-blue-900 mb-3 uppercase tracking-wide">
                  Cosa vuoi fare?
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto py-3 px-3 bg-white hover:bg-blue-50 border-blue-200 hover:border-blue-400 justify-start gap-3 group"
                    onClick={() => navigate(`/consultant/whatsapp/agent/${selectedAgent.id}`)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Settings className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-800">Modifica Agente</p>
                      <p className="text-[10px] text-slate-500">Cambia istruzioni e comportamento</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto py-3 px-3 bg-white hover:bg-indigo-50 border-blue-200 hover:border-indigo-400 justify-start gap-3 group"
                    onClick={() => navigate(`/consultant/whatsapp-agents-chat?agentId=${selectedAgent.id}`)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center flex-shrink-0 transition-colors">
                      <MessageSquare className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-800">Vedi Conversazioni</p>
                      <p className="text-[10px] text-slate-500">Leggi le chat con i clienti</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto py-3 px-3 bg-white hover:bg-emerald-50 border-blue-200 hover:border-emerald-400 justify-start gap-3 group"
                    onClick={() => setShowShareManager(true)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Share2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-800">Condividi Agente</p>
                      <p className="text-[10px] text-slate-500">Dai accesso ai tuoi clienti</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto py-3 px-3 bg-white hover:bg-cyan-50 border-blue-200 hover:border-cyan-400 justify-start gap-3 group"
                    onClick={handleAccessAsGold}
                    disabled={isLoadingGoldAccess}
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 group-hover:bg-cyan-200 flex items-center justify-center flex-shrink-0 transition-colors">
                      {isLoadingGoldAccess ? (
                        <Loader2 className="h-4 w-4 text-cyan-600 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4 text-cyan-600" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-800">Accedi come Gold</p>
                      <p className="text-[10px] text-slate-500">Accedi come cliente Gold</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto py-3 px-3 bg-white hover:bg-purple-50 border-blue-200 hover:border-purple-400 justify-start gap-3 group"
                    onClick={() => onDuplicateAgent?.(selectedAgent.id)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Copy className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-800">Duplica Agente</p>
                      <p className="text-[10px] text-slate-500">Crea una copia modificabile</p>
                    </div>
                  </Button>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDeleteAgent?.(selectedAgent.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Elimina agente
                  </Button>
                </div>
              </div>

              {/* AGENT IDENTITY: Chi è, Cosa fa, Chi aiuta */}
              <div className="space-y-3">
                {/* Business Info */}
                {(agentData?.businessName || agentData?.businessDescription) && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Bot className="h-3 w-3" />
                      Di cosa si occupa
                    </h4>
                    {agentData?.businessName && (
                      <p className="text-sm font-semibold text-slate-800">{agentData.businessName}</p>
                    )}
                    {agentData?.businessDescription && (
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{agentData.businessDescription}</p>
                    )}
                  </div>
                )}

                {/* What We Do */}
                {agentData?.whatWeDo && (
                  <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                    <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Target className="h-3 w-3" />
                      Cosa fa questo agente
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">{agentData.whatWeDo}</p>
                  </div>
                )}

                {/* Who We Help / Don't Help */}
                <div className="grid grid-cols-2 gap-2">
                  {agentData?.whoWeHelp && (
                    <div className="p-3 bg-green-50/50 rounded-lg border border-green-100">
                      <h4 className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <CheckCircle className="h-3 w-3" />
                        Chi aiuta
                      </h4>
                      <p className="text-xs text-slate-700 leading-relaxed line-clamp-4">{agentData.whoWeHelp}</p>
                    </div>
                  )}
                  {agentData?.whoWeDontHelp && (
                    <div className="p-3 bg-red-50/50 rounded-lg border border-red-100">
                      <h4 className="text-[10px] font-bold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <UserX className="h-3 w-3" />
                        Chi non aiuta
                      </h4>
                      <p className="text-xs text-slate-700 leading-relaxed line-clamp-4">{agentData.whoWeDontHelp}</p>
                    </div>
                  )}
                </div>

                {/* Agent Type & Personality Badge */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs bg-indigo-50 border-indigo-200 text-indigo-700">
                    <Bot className="h-3 w-3 mr-1" />
                    {agentTypeLabels[agentData?.agentType || "reactive_lead"] || "Lead Reattivo"}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {personalityLabels[agentData?.personality || "consulente_professionale"] || "Professionale"}
                  </Badge>
                </div>
              </div>

              {/* PERFORMANCE METRICS */}
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <PerformanceGauge 
                    score={analytics.performance.score} 
                    trend={analytics.performance.trend}
                  />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                      <MessageSquare className="h-3 w-3" />
                      <span className="text-[10px]">Conversazioni</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {analytics.performance.conversationsTotal}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                      <Clock className="h-3 w-3" />
                      <span className="text-[10px]">Risposta</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {analytics.performance.avgResponseTime}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                      <Target className="h-3 w-3" />
                      <span className="text-[10px]">Successo</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {analytics.performance.successRate}%
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                      <Calendar className="h-3 w-3" />
                      <span className="text-[10px]">Oggi</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {analytics.performance.conversationsToday}
                    </p>
                  </div>
                </div>
              </div>

              {/* TREND CHART - Compact */}
              {analytics.trendData && analytics.trendData.length > 0 && (
                <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                  <h3 className="text-[10px] font-semibold text-slate-600 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                    <TrendingUp className="h-3 w-3 text-blue-500" />
                    Trend Ultimi 7 Giorni
                  </h3>
                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 8 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 8 }} stroke="#94a3b8" width={25} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "10px",
                          }}
                        />
                        <Line type="monotone" dataKey="conversations" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 2 }} name="Conversazioni" />
                        <Line type="monotone" dataKey="successRate" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", r: 2 }} name="Successo %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent value="integrations" className="space-y-4 mt-4">
              {/* Working Hours */}
              {agentData?.workingHours && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium">Orari di Lavoro</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {String(agentData.workingHours.start).padStart(2, '0')}:00 - {String(agentData.workingHours.end).padStart(2, '0')}:00
                    {agentData.workingHours.timezone && (
                      <span className="text-xs text-slate-400 ml-1">({agentData.workingHours.timezone})</span>
                    )}
                  </p>
                </div>
              )}

              {/* Google Calendar */}
              <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
                <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-green-500" />
                  Google Calendar
                </h3>
                {isLoadingCalendar ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                ) : calendarStatus.connected ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded bg-green-100/50 border border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-green-700">Collegato</p>
                        <p className="text-xs text-green-600 truncate">{calendarStatus.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleTestCalendar} disabled={isTesting} className="flex-1 h-8 text-xs">
                        {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Test
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDisconnectCalendar} disabled={isDisconnecting} className="flex-1 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                        {isDisconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3 mr-1" />}
                        Scollega
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={handleConnectCalendar} disabled={isConnecting} className="w-full h-8 text-xs bg-green-600 hover:bg-green-700">
                    {isConnecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Link className="h-3 w-3 mr-1" />}
                    Collega Google Calendar
                  </Button>
                )}
              </div>

              {/* Instagram DM */}
              <div className="p-3 bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg border border-pink-100">
                <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-pink-500" />
                  Instagram DM
                </h3>
                {isLoadingInstagramConfigs ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                ) : instagramConfigs?.configs && instagramConfigs.configs.length > 0 ? (
                  <div className="space-y-2">
                    {selectedInstagramConfigId ? (
                      <>
                        <div className="flex items-center gap-2 p-2 rounded bg-pink-100/50 border border-pink-200">
                          <Instagram className="h-4 w-4 text-pink-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-pink-700">Collegato</p>
                            <p className="text-xs text-pink-600 truncate">
                              {instagramConfigs.configs.find(c => c.id === selectedInstagramConfigId)?.instagramPageId || "Account Instagram"}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleLinkInstagram(null)} disabled={isSavingInstagram} className="h-7 px-2 text-pink-600 hover:text-pink-700 hover:bg-pink-50 border-pink-300">
                            {isSavingInstagram ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                          </Button>
                        </div>
                        
                        {/* Automation Settings */}
                        {(() => {
                          const currentConfig = instagramConfigs.configs.find(c => c.id === selectedInstagramConfigId);
                          if (!currentConfig) return null;
                          
                          return (
                            <div className="mt-3 pt-3 border-t border-pink-200/50 space-y-3">
                              <div className="flex items-center gap-2 text-xs font-medium text-pink-700">
                                <Zap className="h-3.5 w-3.5" />
                                AUTOMAZIONI
                              </div>
                              
                              {/* Auto Response DM */}
                              <div className="flex items-center justify-between p-2 bg-white/60 rounded border border-pink-100">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-3.5 w-3.5 text-pink-500" />
                                  <span className="text-xs text-slate-700">Risposta Auto DM</span>
                                </div>
                                <Switch
                                  checked={currentConfig.autoResponseEnabled ?? false}
                                  onCheckedChange={(checked) => handleInstagramSettingChange(currentConfig.id, 'autoResponseEnabled', checked)}
                                  disabled={updateInstagramSettings.isPending}
                                  className="scale-75"
                                />
                              </div>
                              
                              {/* Story Reply */}
                              <div className="space-y-2 p-2 bg-white/60 rounded border border-pink-100">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="h-3.5 w-3.5 text-pink-500" />
                                    <span className="text-xs text-slate-700">Story Reply</span>
                                  </div>
                                  <Switch
                                    checked={currentConfig.storyReplyEnabled ?? false}
                                    onCheckedChange={(checked) => handleInstagramSettingChange(currentConfig.id, 'storyReplyEnabled', checked)}
                                    disabled={updateInstagramSettings.isPending}
                                    className="scale-75"
                                  />
                                </div>
                                
                                {currentConfig.storyReplyEnabled && (
                                  <div className="pl-5 space-y-1.5 border-l-2 border-pink-200 ml-1">
                                    <p className="text-xs text-slate-500">Messaggio risposta storia:</p>
                                    <Textarea
                                      value={storyAutoReplyMessage}
                                      onChange={(e) => setStoryAutoReplyMessage(e.target.value)}
                                      onBlur={() => {
                                        const originalValue = currentConfig.storyAutoReplyMessage || '';
                                        if (storyAutoReplyMessage !== originalValue) {
                                          handleInstagramSettingChange(currentConfig.id, 'storyAutoReplyMessage', storyAutoReplyMessage);
                                        }
                                      }}
                                      placeholder="Grazie per aver risposto alla mia storia! Come posso aiutarti?"
                                      className="text-xs min-h-[60px] resize-none"
                                    />
                                  </div>
                                )}
                              </div>
                              
                              {/* Comment to DM */}
                              <div className="space-y-2 p-2 bg-white/60 rounded border border-pink-100">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className="h-3.5 w-3.5 text-pink-500" />
                                    <span className="text-xs text-slate-700">Comment-to-DM</span>
                                  </div>
                                  <Switch
                                    checked={currentConfig.commentToDmEnabled ?? false}
                                    onCheckedChange={(checked) => handleInstagramSettingChange(currentConfig.id, 'commentToDmEnabled', checked)}
                                    disabled={updateInstagramSettings.isPending}
                                    className="scale-75"
                                  />
                                </div>
                                
                                {currentConfig.commentToDmEnabled && (
                                  <div className="pl-5 space-y-2 border-l-2 border-pink-200 ml-1">
                                    {/* Keywords */}
                                    <div className="space-y-1.5">
                                      <p className="text-xs text-slate-500">Parole chiave:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {(currentConfig.commentTriggerKeywords || []).map((keyword, idx) => (
                                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-xs">
                                            {keyword}
                                            <button
                                              onClick={() => handleRemoveKeyword(currentConfig.id, currentConfig.commentTriggerKeywords || [], keyword)}
                                              className="hover:text-pink-900"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                      <div className="flex gap-1">
                                        <Input
                                          value={newKeyword}
                                          onChange={(e) => setNewKeyword(e.target.value)}
                                          placeholder="Nuova parola..."
                                          className="h-7 text-xs flex-1"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleAddKeyword(currentConfig.id, currentConfig.commentTriggerKeywords || []);
                                            }
                                          }}
                                        />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleAddKeyword(currentConfig.id, currentConfig.commentTriggerKeywords || [])}
                                          className="h-7 px-2"
                                          disabled={!newKeyword.trim()}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    
                                    {/* Auto Reply Message */}
                                    <div className="space-y-1.5">
                                      <p className="text-xs text-slate-500">Messaggio auto:</p>
                                      <Textarea
                                        value={commentAutoReplyMessage}
                                        onChange={(e) => setCommentAutoReplyMessage(e.target.value)}
                                        onBlur={() => {
                                          const originalValue = currentConfig.commentAutoReplyMessage || '';
                                          if (commentAutoReplyMessage !== originalValue) {
                                            handleInstagramSettingChange(currentConfig.id, 'commentAutoReplyMessage', commentAutoReplyMessage);
                                          }
                                        }}
                                        placeholder="Messaggio da inviare..."
                                        className="text-xs min-h-[60px] resize-none"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Ice Breakers */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-white/60 rounded border border-pink-100">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-3.5 w-3.5 text-pink-500" />
                                    <span className="text-xs text-slate-700">Ice Breakers</span>
                                    <span className="text-[10px] text-slate-400">(max 4)</span>
                                  </div>
                                  <Switch
                                    checked={currentConfig.iceBreakersEnabled ?? false}
                                    onCheckedChange={(checked) => handleInstagramSettingChange(currentConfig.id, 'iceBreakersEnabled', checked)}
                                    disabled={updateInstagramSettings.isPending}
                                    className="scale-75"
                                  />
                                </div>
                                
                                {currentConfig.iceBreakersEnabled && (
                                  <div className="ml-4 space-y-2 p-2 bg-pink-50/50 rounded border border-pink-100">
                                    <p className="text-xs text-slate-500">Domande rapide cliccabili al primo contatto:</p>
                                    
                                    {/* Ice Breakers List */}
                                    {iceBreakers.length > 0 && (
                                      <div className="space-y-1">
                                        {iceBreakers.map((ib, index) => (
                                          <div key={index} className="flex items-center gap-1.5 group">
                                            <span className="text-xs bg-white px-2 py-1 rounded border border-pink-200 flex-1 truncate">
                                              {ib.text}
                                            </span>
                                            <button
                                              onClick={() => {
                                                const updated = iceBreakers.filter((_, i) => i !== index);
                                                setIceBreakers(updated);
                                                handleInstagramSettingChange(currentConfig.id, 'iceBreakers', updated);
                                              }}
                                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
                                            >
                                              <X className="h-3 w-3 text-red-500" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {/* Add new Ice Breaker */}
                                    {iceBreakers.length < 4 && (
                                      <div className="flex gap-1">
                                        <Input
                                          value={newIceBreaker}
                                          onChange={(e) => setNewIceBreaker(e.target.value)}
                                          placeholder="es. Quanto costa?"
                                          className="h-7 text-xs flex-1"
                                          maxLength={80}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newIceBreaker.trim()) {
                                              e.preventDefault();
                                              const updated = [...iceBreakers, { text: newIceBreaker.trim(), payload: `ice_breaker_${iceBreakers.length + 1}` }];
                                              setIceBreakers(updated);
                                              handleInstagramSettingChange(currentConfig.id, 'iceBreakers', updated);
                                              setNewIceBreaker('');
                                            }
                                          }}
                                        />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (newIceBreaker.trim()) {
                                              const updated = [...iceBreakers, { text: newIceBreaker.trim(), payload: `ice_breaker_${iceBreakers.length + 1}` }];
                                              setIceBreakers(updated);
                                              handleInstagramSettingChange(currentConfig.id, 'iceBreakers', updated);
                                              setNewIceBreaker('');
                                            }
                                          }}
                                          className="h-7 px-2"
                                          disabled={!newIceBreaker.trim()}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                    
                                    {iceBreakers.length >= 4 && (
                                      <p className="text-[10px] text-amber-600">Limite raggiunto (max 4 Ice Breakers)</p>
                                    )}
                                    
                                    {/* Sync with Meta Button */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => syncIceBreakers.mutate(currentConfig.id)}
                                      disabled={syncIceBreakers.isPending || iceBreakers.length === 0}
                                      className="w-full h-7 text-xs mt-2 border-pink-300 text-pink-600 hover:bg-pink-50"
                                    >
                                      {syncIceBreakers.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      ) : (
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                      )}
                                      Sincronizza con Instagram
                                    </Button>
                                    <p className="text-[10px] text-slate-500 text-center">
                                      Pubblica gli Ice Breakers su Instagram
                                    </p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Webhook Status - Show when comment_to_dm is enabled */}
                              {currentConfig.commentToDmEnabled && (
                                <div className={cn(
                                  "p-2 rounded border",
                                  isLoadingWebhookStatus 
                                    ? "bg-slate-50/60 border-slate-200"
                                    : webhookStatus?.isSubscribed 
                                      ? "bg-green-50/60 border-green-200" 
                                      : "bg-amber-50/60 border-amber-200"
                                )}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isLoadingWebhookStatus ? (
                                        <div className="flex items-center gap-1.5">
                                          <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                                          <span className="text-xs text-slate-500">Verifica webhook...</span>
                                        </div>
                                      ) : webhookStatus?.isSubscribed ? (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                          <span className="text-xs font-medium text-green-700">Webhook Attivo</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                                          <span className="text-xs font-medium text-amber-700">Webhook Non Attivo</span>
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => subscribeWebhook.mutate()}
                                      disabled={subscribeWebhook.isPending || isLoadingWebhookStatus}
                                      className={cn(
                                        "h-6 px-2 text-xs",
                                        webhookStatus?.isSubscribed 
                                          ? "text-green-600 hover:text-green-700 hover:bg-green-100"
                                          : "text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                                      )}
                                      title={webhookStatus?.isSubscribed ? "Ri-sincronizza webhook" : "Attiva webhook"}
                                    >
                                      {subscribeWebhook.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <RefreshCw className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-1">
                                    {webhookStatus?.isSubscribed 
                                      ? "I messaggi Instagram vengono ricevuti automaticamente"
                                      : "Clicca per attivare la ricezione dei messaggi"}
                                  </p>
                                </div>
                              )}
                              
                              {/* Dry Run */}
                              <div className="flex items-center justify-between p-2 bg-amber-50/60 rounded border border-amber-200">
                                <div className="flex items-center gap-2">
                                  <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
                                  <span className="text-xs text-slate-700">Dry Run (test)</span>
                                </div>
                                <Switch
                                  checked={currentConfig.isDryRun ?? true}
                                  onCheckedChange={(checked) => handleInstagramSettingChange(currentConfig.id, 'isDryRun', checked)}
                                  disabled={updateInstagramSettings.isPending}
                                  className="scale-75"
                                />
                              </div>
                              
                              {currentConfig.isDryRun && (
                                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                  ⚠️ Modalità test attiva: le risposte vengono solo logggate, non inviate
                                </p>
                              )}
                              
                              {/* Disconnect OAuth Button */}
                              <div className="pt-3 mt-3 border-t border-red-200">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleDisconnectInstagram}
                                  disabled={isDisconnectingInstagram}
                                  className="w-full h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                                >
                                  {isDisconnectingInstagram ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Unlink className="h-3 w-3 mr-1" />
                                  )}
                                  Disconnetti OAuth Completamente
                                </Button>
                                <p className="text-[10px] text-slate-500 mt-1 text-center">
                                  Rimuove la connessione. Dovrai rifare il login.
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-500">Seleziona un account:</p>
                        {instagramConfigs.configs.map((config) => {
                          const isLinkedToOther = config.linkedAgent && config.linkedAgent.agentId !== selectedAgent?.id;
                          return (
                            <button
                              key={config.id}
                              onClick={() => !isLinkedToOther && handleLinkInstagram(config.id)}
                              disabled={isSavingInstagram || isLinkedToOther}
                              className={cn(
                                "w-full flex items-center gap-2 p-2 rounded border transition-colors text-left",
                                isLinkedToOther ? "bg-slate-50 border-slate-200 cursor-not-allowed opacity-60" : "bg-white border-slate-200 hover:bg-pink-50 hover:border-pink-300"
                              )}
                            >
                              <Instagram className={cn("h-4 w-4", isLinkedToOther ? "text-slate-400" : "text-pink-500")} />
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-xs font-medium truncate", isLinkedToOther ? "text-slate-500" : "text-slate-700")}>{config.instagramPageId}</p>
                                {isLinkedToOther && <p className="text-xs text-slate-400">Collegato a: {config.linkedAgent?.agentName}</p>}
                              </div>
                              {!isLinkedToOther && <Link className="h-3 w-3 text-pink-500" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {instagramError && (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-red-700 mb-1">Connessione Fallita</p>
                            <p className="text-xs text-red-600">{instagramError.message}</p>
                            {instagramError.code === 'no_instagram' && (
                              <div className="mt-2 pt-2 border-t border-red-200">
                                <p className="text-xs font-medium text-red-700 mb-1">Come risolvere:</p>
                                <ol className="text-xs text-red-600 list-decimal list-inside space-y-0.5">
                                  <li>Apri Instagram sul telefono</li>
                                  <li>Vai su Profilo → Modifica Profilo</li>
                                  <li>Scorri fino a "Pagina" e collegala</li>
                                  <li>Riprova la connessione</li>
                                </ol>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setInstagramError(null)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                          >
                            <X className="h-3 w-3 text-red-500" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                      <Instagram className="h-4 w-4 text-slate-400" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-600">Nessun account collegato</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleConnectInstagram}
                      disabled={isConnectingInstagram}
                      className="w-full h-8 text-xs bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                    >
                      {isConnectingInstagram ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Instagram className="h-3 w-3 mr-1" />
                      )}
                      Connetti Instagram
                    </Button>
                  </div>
                )}
                
                {/* Guida sempre visibile */}
                <Collapsible className="mt-3">
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-2 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-600 transition-colors group">
                    <div className="flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-pink-500" />
                      <span>Guida Instagram DM</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-3 text-xs">
                    <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                      <p className="font-medium text-pink-700 mb-2 flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Requisiti Obbligatori
                      </p>
                      <ul className="space-y-1.5 text-slate-600">
                        <li className="flex items-start gap-1.5">
                          <span className="text-pink-500 font-bold">1.</span>
                          <span><strong>Account Business:</strong> Instagram deve essere "Business" o "Creator"</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-pink-500 font-bold">2.</span>
                          <span><strong>Pagina Facebook:</strong> Collegata all'account Instagram</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-pink-500 font-bold">3.</span>
                          <span><strong>Ruolo Admin:</strong> Essere ADMIN della Pagina Facebook</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="font-medium text-blue-700 mb-2 flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5" />
                        Controllo Veloce da Telefono
                      </p>
                      <ol className="space-y-1 text-slate-600 list-decimal list-inside">
                        <li>Apri Instagram → Profilo → Modifica Profilo</li>
                        <li>Scorri fino a "Pagina"</li>
                        <li>Vedi il nome della tua azienda? Sei pronto!</li>
                        <li>Vedi "Collega"? Clicca e collega la tua Pagina Facebook</li>
                      </ol>
                    </div>
                    
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="font-medium text-amber-700 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Se l'AI Non Risponde
                      </p>
                      <ul className="space-y-1.5 text-slate-600">
                        <li className="flex items-start gap-1.5">
                          <span className="text-amber-600">•</span>
                          <span><strong>Privacy:</strong> Impostazioni → Messaggi → "Consenti accesso ai messaggi" deve essere BLU</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-amber-600">•</span>
                          <span><strong>Finestra 24h:</strong> Il bot risponde solo dopo un messaggio dell'utente</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-amber-600">•</span>
                          <span><strong>Modalità Dev:</strong> Solo Admin/Tester funzionano finché l'app non è Live</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="font-medium text-purple-700 mb-2 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        Aggiungere Tester (Modalità Dev)
                      </p>
                      <p className="text-xs text-slate-600 mb-2">
                        In Modalità Sviluppo, solo gli utenti nella lista Tester possono usare il bot.
                      </p>
                      <ol className="space-y-1.5 text-slate-600 list-decimal list-inside">
                        <li>Vai su <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="text-purple-600 underline">developers.facebook.com</a></li>
                        <li>My Apps → Seleziona la tua App</li>
                        <li>Ruoli dell'app → Ruoli → Tester</li>
                        <li>Clicca "Aggiungi persone" e inserisci il nome</li>
                      </ol>
                      <div className="mt-2 p-2 bg-purple-100 rounded border border-purple-300">
                        <p className="text-xs font-medium text-purple-800 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          IMPORTANTE: Accettare l'invito!
                        </p>
                        <p className="text-xs text-purple-700 mt-1">
                          Il tester deve aprire <a href="https://developers.facebook.com/requests" target="_blank" rel="noopener" className="underline font-medium">developers.facebook.com/requests</a> e cliccare CONFERMA.
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="font-medium text-red-700 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        SE NON RISPONDE (Piano B)
                      </p>
                      <p className="text-xs text-slate-600 mb-2">
                        Se il tuo Instagram personale non è collegato bene al Facebook Admin, Meta potrebbe trattarti come uno sconosciuto. Devi aggiungerti come <strong>Tester Instagram</strong>.
                      </p>
                      <ol className="space-y-1.5 text-slate-600 list-decimal list-inside">
                        <li>Vai su <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="text-red-600 underline">Meta for Developers</a> → Ruoli → Ruoli</li>
                        <li>Scorri fino a "<strong>Tester Instagram</strong>" (NON "Tester"!)</li>
                        <li>Clicca "Aggiungi tester Instagram"</li>
                        <li>Scrivi il nome utente del profilo che userà per scrivere</li>
                      </ol>
                      <div className="mt-2 p-2 bg-red-100 rounded border border-red-300">
                        <p className="text-xs font-medium text-red-800 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          ACCETTARE L'INVITO DA INSTAGRAM!
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                          Apri l'app Instagram → Impostazioni → App e siti web → <strong>Inviti tester</strong> → ACCETTA
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Twitter/X DM */}
              <div className="p-3 bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg border border-blue-100">
                <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <X className="h-4 w-4 text-blue-500" />
                  Twitter/X DM
                </h3>
                {isLoadingTwitterConfigs ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                ) : twitterConfigs?.configs && twitterConfigs.configs.length > 0 ? (
                  <div className="space-y-2">
                    {twitterConfigs.configs.map((config) => (
                      <div key={config.id} className="space-y-2">
                        <div className="flex items-center gap-2 p-2 rounded bg-blue-100/50 border border-blue-200">
                          <X className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-blue-700">Collegato</p>
                            <p className="text-xs text-blue-600 truncate">
                              {config.username ? `@${config.username}` : "Account X"}
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDisconnectTwitter(config.id)} 
                            className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300"
                          >
                            <Unlink className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        {/* Automation Settings */}
                        <div className="mt-3 pt-3 border-t border-blue-200/50 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-medium text-blue-700">
                            <Zap className="h-3.5 w-3.5" />
                            AUTOMAZIONI
                          </div>
                          
                          {/* Auto Response DM */}
                          <div className="flex items-center justify-between p-2 bg-white/60 rounded border border-blue-100">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-xs text-slate-700">Risposta Auto DM</span>
                            </div>
                            <Switch
                              checked={config.autoResponseEnabled ?? false}
                              onCheckedChange={(checked) => handleTwitterSettingChange(config.id, 'autoResponseEnabled', checked)}
                              disabled={updateTwitterSettings.isPending}
                              className="scale-75"
                            />
                          </div>
                          
                          {/* Dry Run */}
                          <div className="flex items-center justify-between p-2 bg-amber-50/60 rounded border border-amber-200">
                            <div className="flex items-center gap-2">
                              <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
                              <span className="text-xs text-slate-700">Dry Run (test)</span>
                            </div>
                            <Switch
                              checked={config.isDryRun ?? true}
                              onCheckedChange={(checked) => handleTwitterSettingChange(config.id, 'isDryRun', checked)}
                              disabled={updateTwitterSettings.isPending}
                              className="scale-75"
                            />
                          </div>
                          
                          {config.isDryRun && (
                            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                              ⚠️ Modalità test attiva: le risposte vengono solo loggate, non inviate
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {twitterError && (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-red-700 mb-1">Connessione Fallita</p>
                            <p className="text-xs text-red-600">{twitterError.message}</p>
                          </div>
                          <button
                            onClick={() => setTwitterError(null)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                          >
                            <X className="h-3 w-3 text-red-500" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                      <X className="h-4 w-4 text-slate-400" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-600">Nessun account collegato</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleConnectTwitter}
                      disabled={isConnectingTwitter}
                      className="w-full h-8 text-xs bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    >
                      {isConnectingTwitter ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <X className="h-3 w-3 mr-1" />
                      )}
                      Collega X Account
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* AI & Sharing Tab */}
            <TabsContent value="ai" className="space-y-4 mt-4">
              {/* AI Assistant Integration - Card style */}
              <div 
                className={cn(
                  "relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer",
                  enableInAIAssistant 
                    ? "border-blue-400 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 shadow-md shadow-blue-100" 
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                )}
                onClick={() => !isSavingAISettings && handleEnableAIAssistantChange(!enableInAIAssistant)}
              >
                {enableInAIAssistant && (
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-400/20 to-transparent rounded-bl-full" />
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                      enableInAIAssistant ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-500"
                    )}>
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-800">AI Assistant</h3>
                        <Switch
                          id="ai-assistant-toggle"
                          checked={enableInAIAssistant}
                          onCheckedChange={handleEnableAIAssistantChange}
                          disabled={isSavingAISettings}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {enableInAIAssistant 
                          ? "L'agente è disponibile nella chat AI" 
                          : "Abilita per usare nella chat AI"}
                      </p>
                      {enableInAIAssistant && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs font-medium text-green-600">Attivo</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {isSavingAISettings && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  </div>
                )}
              </div>

              {/* Share with Clients - Improved */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                        <Share2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">Condividi</h3>
                        <p className="text-xs text-slate-500">Accesso clienti</p>
                      </div>
                    </div>
                    {selectedClientIds.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500 text-white">
                        <Users className="h-3 w-3" />
                        <span className="text-xs font-semibold">{selectedClientIds.length}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-3 bg-white">
                  {isLoadingAssignments ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : consultantClients && consultantClients.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {consultantClients.map((client) => {
                        const isSelected = selectedClientIds.includes(client.id);
                        return (
                          <label
                            key={client.id}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-200",
                              isSelected 
                                ? "bg-emerald-50 border border-emerald-200" 
                                : "bg-slate-50 border border-transparent hover:bg-slate-100"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors",
                              isSelected 
                                ? "bg-emerald-500 text-white" 
                                : "bg-slate-200 text-slate-600"
                            )}>
                              {(client.name || client.email || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-medium truncate transition-colors",
                                isSelected ? "text-emerald-700" : "text-slate-700"
                              )}>
                                {client.name || client.email || "Cliente"}
                              </p>
                            </div>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleClientToggle(client.id, checked as boolean)}
                              disabled={saveClientAssignments.isPending}
                              className={cn(
                                "transition-colors",
                                isSelected && "border-emerald-500 data-[state=checked]:bg-emerald-500"
                              )}
                            />
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500">Nessun cliente</p>
                      <p className="text-xs text-slate-400">Aggiungi clienti per condividere</p>
                    </div>
                  )}
                </div>
                
                {saveClientAssignments.isPending && (
                  <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-600">Salvataggio modifiche...</span>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Utenti Tab - Employee Agents Only */}
            {agentData?.levels && agentData.levels.length > 0 && (
              <TabsContent value="utenti" className="space-y-4 mt-4">
                <div className="rounded-xl border border-amber-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">Gestione Utenti</h3>
                        <p className="text-xs text-slate-500">Controlla l'accesso all'agente</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-white">
                    <AgentUsersSection agentId={selectedAgent.id} />
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>

        </CardContent>
      </ScrollArea>

      <Dialog open={showShareManager} onOpenChange={setShowShareManager}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Condividi Agente</DialogTitle>
          </DialogHeader>
          <AgentShareManager 
            agentId={selectedAgent.id} 
            agentName={selectedAgent.name} 
            onClose={() => setShowShareManager(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
