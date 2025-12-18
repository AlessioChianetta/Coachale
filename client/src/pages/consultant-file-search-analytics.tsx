import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Quote
} from "lucide-react";
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
  lastSyncAt: string | null;
  totalDocumentsSynced: number;
  totalUsageCount: number;
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
  geminiApiKeyConfigured: boolean;
}

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444'];

export default function ConsultantFileSearchAnalyticsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const handleToggle = (key: keyof FileSearchSettings, value: boolean) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  const isLoading = settingsLoading || analyticsLoading;

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
                      <h4 className="font-medium mb-4">Sincronizzazione Automatica</h4>
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
