import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart3,
  FileSearch,
  RefreshCw,
  Database,
  FileText,
  Zap,
  TrendingUp,
  Clock,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Quote,
  MessageSquare,
  Bot,
  Users,
  BookOpen,
  Timer,
  AlertTriangle,
  Activity,
  Sparkles,
  Dumbbell,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  User,
  GraduationCap,
  Brain,
  Folder
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface FileSearchSettings {
  id: string;
  consultantId: string;
  enabled: boolean;
  autoSyncLibrary: boolean;
  autoSyncKnowledgeBase: boolean;
  autoSyncExercises: boolean;
  autoSyncConsultations: boolean;
  autoSyncUniversity: boolean;
  scheduledSyncEnabled: boolean;
  scheduledSyncHour: number;
  lastScheduledSync: string | null;
  lastSyncAt: string | null;
  totalDocumentsSynced: number;
  totalUsageCount: number;
}

interface SyncedDocument {
  id: string;
  googleFileId: string;
  fileName: string;
  displayName: string;
  mimeType: string;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  sourceType: 'library' | 'knowledge_base' | 'manual' | 'exercise' | 'consultation' | 'university';
  sourceId: string | null;
  uploadedAt: string;
  storeDisplayName?: string;
  clientId?: string | null;
}

interface HierarchicalData {
  consultantStore: {
    storeId: string;
    storeName: string;
    documents: {
      library: SyncedDocument[];
      knowledgeBase: SyncedDocument[];
      exercises: SyncedDocument[];
      university: SyncedDocument[];
      other: SyncedDocument[];
    };
    totals: {
      library: number;
      knowledgeBase: number;
      exercises: number;
      university: number;
    };
  };
  clientStores: Array<{
    clientId: string;
    clientName: string;
    clientEmail: string;
    storeId: string;
    storeName: string;
    documents: {
      exerciseResponses: SyncedDocument[];
      consultationNotes: SyncedDocument[];
      knowledgeBase: SyncedDocument[];
    };
    totals: {
      exerciseResponses: number;
      consultationNotes: number;
      knowledgeBase: number;
      total: number;
    };
  }>;
}

interface AnalyticsData {
  summary: {
    totalCalls: number;
    fileSearchCalls: number;
    classicRagCalls: number;
    fileSearchPercentage: number;
    totalTokensSaved: number;
    totalCitations: number;
    avgResponseTimeMs: number;
    totalStores: number;
    totalDocuments: number;
  };
  dailyStats: Array<{
    date: string;
    fileSearchCalls: number;
    classicRagCalls: number;
    tokensSaved: number;
    citations: number;
  }>;
  providerStats: Record<string, number>;
  stores: Array<{
    id: string;
    displayName: string;
    documentCount: number;
    isActive: boolean;
    createdAt: string;
  }>;
  recentLogs: Array<{
    id: string;
    requestType: string;
    usedFileSearch: boolean;
    providerUsed: string;
    storeCount: number;
    citationsCount: number;
    tokensSaved: number;
    responseTimeMs: number;
    createdAt: string;
  }>;
  documents: SyncedDocument[];
  hierarchicalData?: HierarchicalData;
  geminiApiKeyConfigured: boolean;
}

interface AuditData {
  summary: {
    library: { total: number; indexed: number; missing: string[] };
    knowledgeBase: { total: number; indexed: number; missing: string[] };
    exercises: { total: number; indexed: number; missing: string[] };
  };
  recommendations: string[];
  healthScore: number;
}

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444'];

export default function ConsultantFileSearchAnalyticsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [consultantStoreOpen, setConsultantStoreOpen] = useState(true);
  const [clientStoresOpen, setClientStoresOpen] = useState(true);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [openClients, setOpenClients] = useState<Record<string, boolean>>({});
  
  const toggleCategory = (key: string) => {
    setOpenCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const toggleClient = (clientId: string) => {
    setOpenClients(prev => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const { data: settings, isLoading: settingsLoading } = useQuery<FileSearchSettings>({
    queryKey: ["/api/file-search/settings"],
    queryFn: async () => {
      const response = await fetch("/api/file-search/settings", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    },
  });

  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/file-search/analytics"],
    queryFn: async () => {
      const response = await fetch("/api/file-search/analytics?days=30", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery<AuditData>({
    queryKey: ["/api/file-search/audit"],
    queryFn: async () => {
      const response = await fetch("/api/file-search/audit", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch audit");
      return response.json();
    },
  });

  const syncMissingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/file-search/sync-missing", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Sync missing failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      toast({
        title: "Sincronizzazione completata",
        description: data.message || "Documenti mancanti sincronizzati.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<FileSearchSettings>) => {
      const response = await fetch("/api/file-search/settings", {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/settings"] });
      toast({
        title: "Impostazioni aggiornate",
        description: "Le impostazioni File Search sono state salvate.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento delle impostazioni",
        variant: "destructive",
      });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/file-search/sync-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Sync failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      toast({
        title: "Sincronizzazione completata",
        description: data.message || "Tutti i documenti sono stati sincronizzati.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const initializeStoreMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/file-search/initialize", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Initialize failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      toast({
        title: "Store creato",
        description: "Il tuo File Search Store e stato inizializzato.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof FileSearchSettings, value: boolean | number) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  const isLoading = settingsLoading || analyticsLoading || auditLoading;
  
  const totalMissing = (auditData?.summary.library.missing.length || 0) + 
                       (auditData?.summary.knowledgeBase.missing.length || 0) + 
                       (auditData?.summary.exercises.missing.length || 0);
  
  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };
  
  const getHealthScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const providerChartData = analytics?.providerStats
    ? Object.entries(analytics.providerStats).map(([name, value]) => ({
        name: name === 'google_ai_studio' ? 'Google AI Studio' : 
              name === 'vertex_ai' ? 'Vertex AI' : name,
        value,
      }))
    : [];

  return (
    <div className="flex h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocation("/consultant/ai-settings")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <FileSearch className="h-7 w-7 text-emerald-600" />
                    File Search Analytics
                  </h1>
                  <p className="text-gray-500">
                    Monitora l'utilizzo di File Search e gestisci le impostazioni
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => refetchAnalytics()}
                  disabled={analyticsLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
                  Aggiorna
                </Button>
              </div>
            </div>

            {!analytics?.geminiApiKeyConfigured && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-amber-100 p-2 rounded-lg">
                      <Zap className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-amber-800">GEMINI_API_KEY non configurata</h3>
                      <p className="text-amber-700 text-sm mt-1">
                        File Search richiede una GEMINI_API_KEY configurata come variabile d'ambiente.
                        Contatta l'amministratore per configurarla.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {analytics?.summary.totalStores === 0 && analytics?.geminiApiKeyConfigured && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Database className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-800">Nessun File Search Store</h3>
                      <p className="text-blue-700 text-sm mt-1">
                        Per utilizzare File Search, devi prima creare uno store e sincronizzare i tuoi documenti.
                      </p>
                      <Button
                        className="mt-3"
                        onClick={() => initializeStoreMutation.mutate()}
                        disabled={initializeStoreMutation.isPending}
                      >
                        {initializeStoreMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Database className="h-4 w-4 mr-2" />
                        )}
                        Inizializza File Search Store
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">Panoramica</TabsTrigger>
                <TabsTrigger value="contents">Contenuti</TabsTrigger>
                <TabsTrigger value="usage">Utilizzo</TabsTrigger>
                <TabsTrigger value="settings">Impostazioni</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Chiamate File Search</p>
                          <p className="text-2xl font-bold text-emerald-600">
                            {analytics?.summary.fileSearchCalls || 0}
                          </p>
                        </div>
                        <div className="bg-emerald-100 p-3 rounded-lg">
                          <FileSearch className="h-6 w-6 text-emerald-600" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {analytics?.summary.fileSearchPercentage || 0}% del totale
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Token Risparmiati</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {(analytics?.summary.totalTokensSaved || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <Zap className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Ultimi 30 giorni</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Citazioni Generate</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {analytics?.summary.totalCitations || 0}
                          </p>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-lg">
                          <Quote className="h-6 w-6 text-purple-600" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Riferimenti nei documenti</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Documenti Indicizzati</p>
                          <p className="text-2xl font-bold text-amber-600">
                            {analytics?.summary.totalDocuments || 0}
                          </p>
                        </div>
                        <div className="bg-amber-100 p-3 rounded-lg">
                          <FileText className="h-6 w-6 text-amber-600" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        In {analytics?.summary.totalStores || 0} store
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-emerald-600" />
                      Risparmio Token Stimato
                    </CardTitle>
                    <CardDescription>
                      Confronto tra approccio tradizionale e File Search RAG
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-sm text-red-600 font-medium">Context Tradizionale</p>
                        <p className="text-3xl font-bold text-red-700 mt-2">~212,000</p>
                        <p className="text-xs text-red-500 mt-1">tokens per sessione</p>
                      </div>
                      <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                        <p className="text-sm text-emerald-600 font-medium">Con File Search RAG</p>
                        <p className="text-3xl font-bold text-emerald-700 mt-2">~20,000</p>
                        <p className="text-xs text-emerald-500 mt-1">tokens per sessione</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg border-2 border-emerald-300">
                        <p className="text-sm text-emerald-700 font-medium">Risparmio Totale</p>
                        <p className="text-4xl font-bold text-emerald-700 mt-2">~91%</p>
                        <p className="text-xs text-emerald-600 mt-1">riduzione costi AI</p>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-700">
                        <strong>💡 Vantaggio:</strong> File Search usa embedding vettoriali per cercare solo i contenuti rilevanti, 
                        invece di caricare tutti i documenti nel context. Questo riduce drasticamente il consumo di token mantenendo 
                        l'accuratezza delle risposte.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-blue-600" />
                        Breakdown per Tipo di Contenuto
                      </CardTitle>
                      <CardDescription>
                        Token risparmiati per categoria di documento
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-3">
                          <div className="bg-purple-100 p-2 rounded-lg">
                            <BookOpen className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-purple-900">Library</p>
                            <p className="text-sm text-purple-600">{auditData?.summary.library.indexed || 0} documenti indicizzati</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-purple-700">~{((auditData?.summary.library.indexed || 0) * 8500).toLocaleString()}</p>
                          <p className="text-xs text-purple-500">token risparmiati</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-100 p-2 rounded-lg">
                            <FileText className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-amber-900">Knowledge Base</p>
                            <p className="text-sm text-amber-600">{auditData?.summary.knowledgeBase.indexed || 0} documenti indicizzati</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-amber-700">~{((auditData?.summary.knowledgeBase.indexed || 0) * 6000).toLocaleString()}</p>
                          <p className="text-xs text-amber-500">token risparmiati</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <Dumbbell className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-blue-900">Exercises</p>
                            <p className="text-sm text-blue-600">{auditData?.summary.exercises.indexed || 0} esercizi indicizzati</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-700">~{((auditData?.summary.exercises.indexed || 0) * 3500).toLocaleString()}</p>
                          <p className="text-xs text-blue-500">token risparmiati</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={auditData?.healthScore && auditData.healthScore < 80 ? "border-amber-300" : "border-emerald-300"}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-emerald-600" />
                        Audit Health
                      </CardTitle>
                      <CardDescription>
                        Stato di indicizzazione dei tuoi contenuti
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center p-4">
                        <p className={`text-5xl font-bold ${getHealthScoreColor(auditData?.healthScore || 0)}`}>
                          {auditData?.healthScore || 0}%
                        </p>
                        <p className="text-sm text-gray-500 mt-1">Health Score</p>
                        <Progress 
                          value={auditData?.healthScore || 0} 
                          className="mt-3 h-3"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Library</span>
                          <span className={auditData?.summary.library.missing.length ? "text-amber-600" : "text-emerald-600"}>
                            {auditData?.summary.library.indexed || 0}/{auditData?.summary.library.total || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Knowledge Base</span>
                          <span className={auditData?.summary.knowledgeBase.missing.length ? "text-amber-600" : "text-emerald-600"}>
                            {auditData?.summary.knowledgeBase.indexed || 0}/{auditData?.summary.knowledgeBase.total || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Exercises</span>
                          <span className={auditData?.summary.exercises.missing.length ? "text-amber-600" : "text-emerald-600"}>
                            {auditData?.summary.exercises.indexed || 0}/{auditData?.summary.exercises.total || 0}
                          </span>
                        </div>
                      </div>

                      {totalMissing > 0 && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-amber-800">
                                {totalMissing} documenti non indicizzati
                              </p>
                              <p className="text-xs text-amber-600 mt-1">
                                {auditData?.recommendations[0]}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {totalMissing > 0 && (
                        <Button
                          onClick={() => syncMissingMutation.mutate()}
                          disabled={syncMissingMutation.isPending}
                          className="w-full bg-amber-600 hover:bg-amber-700"
                        >
                          {syncMissingMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Sincronizza {totalMissing} Mancanti
                        </Button>
                      )}

                      {totalMissing === 0 && auditData?.healthScore === 100 && (
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-800">
                              Tutti i contenuti sono indicizzati!
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-emerald-600" />
                      Moduli che Utilizzano File Search
                    </CardTitle>
                    <CardDescription>
                      File Search è integrato in questi moduli per ricerca semantica intelligente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border shadow-sm">
                        <div className="bg-emerald-100 p-2 rounded-lg">
                          <MessageSquare className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">AI Assistant Cliente</h4>
                          <p className="text-sm text-gray-500">Chat AI per clienti con accesso ai documenti</p>
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border shadow-sm">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">AI Assistant Consulente</h4>
                          <p className="text-sm text-gray-500">Chat AI per consulenti con knowledge base</p>
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border shadow-sm">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <BookOpen className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Libreria Documenti</h4>
                          <p className="text-sm text-gray-500">Sincronizzazione automatica documenti</p>
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border shadow-sm">
                        <div className="bg-amber-100 p-2 rounded-lg">
                          <Database className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Knowledge Base</h4>
                          <p className="text-sm text-gray-500">Documenti consulente indicizzati</p>
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Come Funziona</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Quando un utente fa una domanda nell'AI Assistant, File Search cerca automaticamente 
                            nei documenti indicizzati per trovare le informazioni più rilevanti. Questo riduce i token 
                            utilizzati e migliora la qualità delle risposte con citazioni precise.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {analytics?.dailyStats && analytics.dailyStats.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Trend Utilizzo (ultimi 30 giorni)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analytics.dailyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                          />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(value) => new Date(value).toLocaleDateString('it-IT')}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="fileSearchCalls" 
                            stroke="#10b981" 
                            name="File Search"
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="classicRagCalls" 
                            stroke="#6366f1" 
                            name="RAG Classico"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {providerChartData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Provider Utilizzati
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={providerChartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {providerChartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        File Search Stores
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analytics?.stores && analytics.stores.length > 0 ? (
                        <div className="space-y-3">
                          {analytics.stores.map((store) => (
                            <div key={store.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium">{store.displayName}</p>
                                <p className="text-sm text-gray-500">
                                  {store.documentCount} documenti
                                </p>
                              </div>
                              <Badge variant={store.isActive ? "default" : "secondary"}>
                                {store.isActive ? "Attivo" : "Inattivo"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">
                          Nessuno store configurato
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="contents" className="space-y-6">
                {(() => {
                  const hData = analytics?.hierarchicalData;
                  const consultantTotal = (hData?.consultantStore.totals.library || 0) + 
                                          (hData?.consultantStore.totals.knowledgeBase || 0) + 
                                          (hData?.consultantStore.totals.exercises || 0) + 
                                          (hData?.consultantStore.totals.university || 0);
                  const clientsTotal = hData?.clientStores.reduce((sum, c) => sum + c.totals.total, 0) || 0;
                  
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex flex-col items-center text-center">
                              <FileText className="h-8 w-8 mb-2 opacity-90" />
                              <p className="text-3xl font-bold">{analytics?.documents?.length || 0}</p>
                              <p className="text-sm opacity-90">Totale Documenti</p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex flex-col items-center text-center">
                              <FolderOpen className="h-8 w-8 mb-2 opacity-90" />
                              <p className="text-3xl font-bold">{consultantTotal}</p>
                              <p className="text-sm opacity-90">Store Globale</p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex flex-col items-center text-center">
                              <Users className="h-8 w-8 mb-2 opacity-90" />
                              <p className="text-3xl font-bold">{clientsTotal}</p>
                              <p className="text-sm opacity-90">Store Privati</p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex flex-col items-center text-center">
                              <User className="h-8 w-8 mb-2 opacity-90" />
                              <p className="text-3xl font-bold">{hData?.clientStores.length || 0}</p>
                              <p className="text-sm opacity-90">Clienti con Documenti</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Folder className="h-5 w-5" />
                            Visualizzazione Gerarchica Contenuti
                          </CardTitle>
                          <CardDescription>
                            Esplora i documenti organizzati per Store Globale e Store Privati Clienti
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {hData ? (
                            <div className="space-y-3">
                              <Collapsible open={consultantStoreOpen} onOpenChange={setConsultantStoreOpen}>
                                <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
                                  {consultantStoreOpen ? <ChevronDown className="h-5 w-5 text-blue-600" /> : <ChevronRight className="h-5 w-5 text-blue-600" />}
                                  <FolderOpen className="h-5 w-5 text-blue-600" />
                                  <span className="font-semibold text-blue-900">Store Globale Consulente</span>
                                  <Badge className="ml-auto bg-blue-200 text-blue-800">{consultantTotal} documenti</Badge>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 ml-6 space-y-2">
                                  <Collapsible open={openCategories['library']} onOpenChange={() => toggleCategory('library')}>
                                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                      {openCategories['library'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                      <BookOpen className="h-4 w-4 text-blue-600" />
                                      <span className="text-gray-800">Libreria</span>
                                      <Badge variant="outline" className="ml-auto">{hData.consultantStore.totals.library}</Badge>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="ml-8 mt-1 space-y-1">
                                      {hData.consultantStore.documents.library.map(doc => (
                                        <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                          <FileText className="h-3 w-3 text-gray-400" />
                                          <span className="truncate flex-1">{doc.displayName}</span>
                                          <Badge className="text-xs bg-emerald-100 text-emerald-700">
                                            {doc.status === 'indexed' ? 'Indicizzato' : doc.status}
                                          </Badge>
                                        </div>
                                      ))}
                                      {hData.consultantStore.documents.library.length === 0 && (
                                        <p className="text-gray-400 text-sm p-2">Nessun documento</p>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>

                                  <Collapsible open={openCategories['kb']} onOpenChange={() => toggleCategory('kb')}>
                                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                      {openCategories['kb'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                      <Brain className="h-4 w-4 text-purple-600" />
                                      <span className="text-gray-800">Knowledge Base</span>
                                      <Badge variant="outline" className="ml-auto">{hData.consultantStore.totals.knowledgeBase}</Badge>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="ml-8 mt-1 space-y-1">
                                      {hData.consultantStore.documents.knowledgeBase.map(doc => (
                                        <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                          <FileText className="h-3 w-3 text-gray-400" />
                                          <span className="truncate flex-1">{doc.displayName}</span>
                                          <Badge className="text-xs bg-emerald-100 text-emerald-700">
                                            {doc.status === 'indexed' ? 'Indicizzato' : doc.status}
                                          </Badge>
                                        </div>
                                      ))}
                                      {hData.consultantStore.documents.knowledgeBase.length === 0 && (
                                        <p className="text-gray-400 text-sm p-2">Nessun documento</p>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>

                                  <Collapsible open={openCategories['exercises']} onOpenChange={() => toggleCategory('exercises')}>
                                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                      {openCategories['exercises'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                      <Dumbbell className="h-4 w-4 text-green-600" />
                                      <span className="text-gray-800">Esercizi Template</span>
                                      <Badge variant="outline" className="ml-auto">{hData.consultantStore.totals.exercises}</Badge>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="ml-8 mt-1 space-y-1">
                                      {hData.consultantStore.documents.exercises.map(doc => (
                                        <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                          <FileText className="h-3 w-3 text-gray-400" />
                                          <span className="truncate flex-1">{doc.displayName}</span>
                                          <Badge className="text-xs bg-emerald-100 text-emerald-700">
                                            {doc.status === 'indexed' ? 'Indicizzato' : doc.status}
                                          </Badge>
                                        </div>
                                      ))}
                                      {hData.consultantStore.documents.exercises.length === 0 && (
                                        <p className="text-gray-400 text-sm p-2">Nessun documento</p>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>

                                  <Collapsible open={openCategories['university']} onOpenChange={() => toggleCategory('university')}>
                                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                      {openCategories['university'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                      <GraduationCap className="h-4 w-4 text-amber-600" />
                                      <span className="text-gray-800">University</span>
                                      <Badge variant="outline" className="ml-auto">{hData.consultantStore.totals.university}</Badge>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="ml-8 mt-1 space-y-1">
                                      {hData.consultantStore.documents.university.map(doc => (
                                        <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                          <FileText className="h-3 w-3 text-gray-400" />
                                          <span className="truncate flex-1">{doc.displayName}</span>
                                          <Badge className="text-xs bg-emerald-100 text-emerald-700">
                                            {doc.status === 'indexed' ? 'Indicizzato' : doc.status}
                                          </Badge>
                                        </div>
                                      ))}
                                      {hData.consultantStore.documents.university.length === 0 && (
                                        <p className="text-gray-400 text-sm p-2">Nessun documento</p>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>
                                </CollapsibleContent>
                              </Collapsible>

                              <Collapsible open={clientStoresOpen} onOpenChange={setClientStoresOpen}>
                                <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors">
                                  {clientStoresOpen ? <ChevronDown className="h-5 w-5 text-purple-600" /> : <ChevronRight className="h-5 w-5 text-purple-600" />}
                                  <Users className="h-5 w-5 text-purple-600" />
                                  <span className="font-semibold text-purple-900">Store Privati Clienti</span>
                                  <Badge className="ml-auto bg-purple-200 text-purple-800">{hData.clientStores.length} clienti</Badge>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 ml-6 space-y-2">
                                  {hData.clientStores.length > 0 ? (
                                    hData.clientStores.map(client => (
                                      <Collapsible key={client.clientId} open={openClients[client.clientId]} onOpenChange={() => toggleClient(client.clientId)}>
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                          {openClients[client.clientId] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                          <User className="h-4 w-4 text-purple-600" />
                                          <span className="text-gray-800 font-medium">{client.clientName}</span>
                                          <span className="text-gray-400 text-sm">({client.clientEmail})</span>
                                          <Badge variant="outline" className="ml-auto">{client.totals.total} doc</Badge>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="ml-8 mt-1 p-3 bg-gray-50 rounded-lg space-y-2">
                                          <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2">
                                              <Dumbbell className="h-3 w-3 text-green-600" />
                                              Risposte Esercizi
                                            </span>
                                            <Badge variant="outline">{client.totals.exerciseResponses}</Badge>
                                          </div>
                                          <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2">
                                              <MessageSquare className="h-3 w-3 text-pink-600" />
                                              Note Consulenze
                                            </span>
                                            <Badge variant="outline">{client.totals.consultationNotes}</Badge>
                                          </div>
                                          <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2">
                                              <Brain className="h-3 w-3 text-purple-600" />
                                              Knowledge Docs
                                            </span>
                                            <Badge variant="outline">{client.totals.knowledgeBase}</Badge>
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    ))
                                  ) : (
                                    <p className="text-gray-400 text-sm p-2">Nessun documento privato per i clienti</p>
                                  )}
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                              <p className="text-gray-500 mb-2">Nessun documento sincronizzato</p>
                              <p className="text-sm text-gray-400 mb-4">
                                Vai nelle Impostazioni e clicca "Sincronizza Tutti i Documenti" per iniziare
                              </p>
                              <Button
                                variant="outline"
                                onClick={() => syncAllMutation.mutate()}
                                disabled={syncAllMutation.isPending}
                              >
                                {syncAllMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Sincronizza Ora
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="usage" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Log Chiamate Recenti</CardTitle>
                    <CardDescription>
                      Ultime 50 chiamate AI con dettagli File Search
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics?.recentLogs && analytics.recentLogs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3">Data</th>
                              <th className="text-left py-2 px-3">Tipo</th>
                              <th className="text-left py-2 px-3">Provider</th>
                              <th className="text-center py-2 px-3">File Search</th>
                              <th className="text-right py-2 px-3">Citazioni</th>
                              <th className="text-right py-2 px-3">Token Salvati</th>
                              <th className="text-right py-2 px-3">Tempo (ms)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.recentLogs.map((log) => (
                              <tr key={log.id} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-3">
                                  {log.createdAt ? new Date(log.createdAt).toLocaleString('it-IT') : '-'}
                                </td>
                                <td className="py-2 px-3">
                                  <Badge variant="outline">{log.requestType}</Badge>
                                </td>
                                <td className="py-2 px-3">
                                  <span className={log.providerUsed === 'google_ai_studio' ? 'text-emerald-600' : 'text-gray-600'}>
                                    {log.providerUsed === 'google_ai_studio' ? 'AI Studio' : log.providerUsed}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {log.usedFileSearch ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">{log.citationsCount || 0}</td>
                                <td className="py-2 px-3 text-right">{(log.tokensSaved || 0).toLocaleString()}</td>
                                <td className="py-2 px-3 text-right">{log.responseTimeMs || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        Nessun log disponibile
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Impostazioni File Search
                    </CardTitle>
                    <CardDescription>
                      Configura il comportamento di File Search per il tuo account
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">File Search Abilitato</Label>
                        <p className="text-sm text-gray-500">
                          Attiva la ricerca semantica nei tuoi documenti
                        </p>
                      </div>
                      <Switch
                        checked={settings?.enabled ?? true}
                        onCheckedChange={(checked) => handleToggle('enabled', checked)}
                        disabled={updateSettingsMutation.isPending}
                      />
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="font-medium mb-4 flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        Sincronizzazione Automatica Programmata
                      </h4>
                      
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <Label className="text-base font-medium text-blue-900">Sincronizzazione Giornaliera</Label>
                            <p className="text-sm text-blue-700">
                              I documenti verranno sincronizzati automaticamente ogni giorno all'ora selezionata
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Select
                              value={settings?.scheduledSyncHour?.toString() ?? "3"}
                              onValueChange={(value) => handleToggle('scheduledSyncHour', parseInt(value))}
                              disabled={updateSettingsMutation.isPending || !(settings?.scheduledSyncEnabled ?? false)}
                            >
                              <SelectTrigger className="w-[120px] bg-white">
                                <SelectValue placeholder="Ora" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    {i.toString().padStart(2, '0')}:00
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Switch
                              checked={settings?.scheduledSyncEnabled ?? false}
                              onCheckedChange={(checked) => handleToggle('scheduledSyncEnabled', checked)}
                              disabled={updateSettingsMutation.isPending}
                            />
                          </div>
                        </div>
                        {settings?.lastScheduledSync && (
                          <p className="text-xs text-blue-600 mt-2">
                            Ultima sincronizzazione programmata: {new Date(settings.lastScheduledSync).toLocaleString('it-IT')}
                          </p>
                        )}
                      </div>

                      <h5 className="font-medium mb-3 text-gray-700">Sorgenti da Sincronizzare</h5>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Libreria Documenti</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente i documenti della libreria</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncLibrary ?? true}
                            onCheckedChange={(checked) => handleToggle('autoSyncLibrary', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Knowledge Base</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente la knowledge base</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncKnowledgeBase ?? true}
                            onCheckedChange={(checked) => handleToggle('autoSyncKnowledgeBase', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Esercizi</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente gli esercizi</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncExercises ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncExercises', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Consultazioni</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente le consultazioni</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncConsultations ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncConsultations', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>University</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente le lezioni</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncUniversity ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncUniversity', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="font-medium mb-4">Sincronizzazione Manuale</h4>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => syncAllMutation.mutate()}
                          disabled={syncAllMutation.isPending}
                          className="flex-1"
                        >
                          {syncAllMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Sincronizza Tutti i Documenti
                        </Button>
                      </div>
                      {settings?.lastSyncAt && (
                        <p className="text-sm text-gray-500 mt-3 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Ultima sincronizzazione: {new Date(settings.lastSyncAt).toLocaleString('it-IT')}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Stato Configurazione</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span>GEMINI_API_KEY</span>
                        {analytics?.geminiApiKeyConfigured ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Configurata
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Non configurata
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span>File Search Stores</span>
                        <Badge variant={analytics?.summary.totalStores ? "default" : "secondary"}>
                          {analytics?.summary.totalStores || 0} store
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span>Documenti Indicizzati</span>
                        <Badge variant={analytics?.summary.totalDocuments ? "default" : "secondary"}>
                          {analytics?.summary.totalDocuments || 0} documenti
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
