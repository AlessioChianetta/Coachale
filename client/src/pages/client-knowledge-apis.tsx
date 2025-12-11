import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Plug,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Clock,
  Zap,
  Eye,
  EyeOff,
  ExternalLink,
  XCircle,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

type ApiCategory = "custom" | "crm" | "erp" | "ecommerce" | "analytics" | "marketing" | "social" | "other";
type AuthType = "none" | "api_key" | "bearer" | "basic";
type SyncStatus = "success" | "error" | "never";
type RequestMethod = "GET" | "POST";

interface KnowledgeApi {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  category: ApiCategory;
  baseUrl: string;
  endpoint: string | null;
  authType: AuthType;
  apiKey: string | null;
  authConfig: Record<string, any> | null;
  customHeaders: Record<string, string> | null;
  requestMethod: RequestMethod;
  requestParams: Record<string, any> | null;
  cacheDurationMinutes: number;
  autoRefresh: boolean;
  autoRefreshIntervalMinutes: number | null;
  priority: number;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: SyncStatus | null;
  lastSyncError: string | null;
  nextRefreshAt: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  success: boolean;
  status?: number;
  statusText?: string;
  responseTime?: number;
  dataPreview?: string;
  error?: string;
}

const CATEGORY_LABELS: Record<ApiCategory, string> = {
  custom: "Personalizzata",
  crm: "CRM",
  erp: "ERP",
  ecommerce: "E-Commerce",
  analytics: "Analytics",
  marketing: "Marketing",
  social: "Social",
  other: "Altro",
};

const CATEGORY_COLORS: Record<ApiCategory, string> = {
  custom: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  crm: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  erp: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  ecommerce: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  analytics: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  marketing: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
  social: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  other: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300",
};

const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  none: "Nessuna",
  api_key: "API Key",
  bearer: "Bearer Token",
  basic: "Basic Auth",
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "Mai";
  const date = new Date(dateString);
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNextRefreshText(api: KnowledgeApi): string {
  if (!api.autoRefresh || !api.autoRefreshIntervalMinutes) return "-";
  if (!api.lastSyncAt) return "Primo sync richiesto";
  
  const lastSync = new Date(api.lastSyncAt);
  const nextRefresh = new Date(lastSync.getTime() + api.autoRefreshIntervalMinutes * 60 * 1000);
  const now = new Date();
  
  if (nextRefresh <= now) return "In attesa...";
  
  const diffMs = nextRefresh.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffHours > 0) return `Tra ${diffHours}h ${diffMins % 60}m`;
  return `Tra ${diffMins}m`;
}

const defaultFormData = {
  name: "",
  description: "",
  category: "custom" as ApiCategory,
  baseUrl: "",
  endpoint: "",
  authType: "none" as AuthType,
  apiKey: "",
  customHeaders: "{}",
  requestMethod: "GET" as RequestMethod,
  cacheDurationMinutes: 60,
  autoRefresh: false,
  autoRefreshIntervalMinutes: 60,
  priority: 5,
  isActive: true,
};

export default function ClientKnowledgeApis() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingApi, setEditingApi] = useState<KnowledgeApi | null>(null);
  const [deletingApiId, setDeletingApiId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingApiId, setTestingApiId] = useState<string | null>(null);
  const [syncingApiId, setSyncingApiId] = useState<string | null>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  const [formData, setFormData] = useState(defaultFormData);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: apisResponse, isLoading } = useQuery({
    queryKey: ["/api/client/knowledge/apis"],
    queryFn: async () => {
      const response = await fetch("/api/client/knowledge/apis", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch APIs");
      return response.json();
    },
  });

  const apis: KnowledgeApi[] = apisResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/client/knowledge/apis", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create API");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/apis"] });
      setShowConfigDialog(false);
      resetForm();
      toast({
        title: "API creata",
        description: "La configurazione API è stata creata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la creazione",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/client/knowledge/apis/${id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update API");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/apis"] });
      setShowConfigDialog(false);
      setEditingApi(null);
      resetForm();
      toast({
        title: "API aggiornata",
        description: "La configurazione è stata aggiornata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/client/knowledge/apis/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete API");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/apis"] });
      setDeletingApiId(null);
      toast({
        title: "API eliminata",
        description: "La configurazione è stata eliminata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'eliminazione",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingApiId(id);
      const response = await fetch(`/api/client/knowledge/apis/${id}/test`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const result = await response.json();
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/apis"] });
      setTestResult(result);
      setShowTestDialog(true);
      if (result.success) {
        toast({
          title: "✅ Connessione riuscita",
          description: `Risposta in ${result.responseTime}ms - Status: ${result.status}`,
        });
      } else {
        toast({
          title: "❌ Connessione fallita",
          description: result.error || "Test non riuscito",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore test",
        description: error.message || "Errore durante il test",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTestingApiId(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      setSyncingApiId(id);
      const response = await fetch(`/api/client/knowledge/apis/${id}/sync`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cacheKey: "default" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/apis"] });
      toast({
        title: "✅ Sync completato",
        description: `Dati sincronizzati (${Math.round(result.dataSize / 1024)} KB)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Sync fallito",
        description: error.message || "Errore durante la sincronizzazione",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setSyncingApiId(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/client/knowledge/apis/${id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to toggle status");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/apis"] });
      toast({
        title: variables.isActive ? "API attivata" : "API disattivata",
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

  const resetForm = () => {
    setFormData(defaultFormData);
    setShowApiKey(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setEditingApi(null);
    setShowConfigDialog(true);
  };

  const handleOpenEdit = (api: KnowledgeApi) => {
    setEditingApi(api);
    setFormData({
      name: api.name,
      description: api.description || "",
      category: api.category,
      baseUrl: api.baseUrl,
      endpoint: api.endpoint || "",
      authType: api.authType,
      apiKey: "",
      customHeaders: JSON.stringify(api.customHeaders || {}, null, 2),
      requestMethod: api.requestMethod,
      cacheDurationMinutes: api.cacheDurationMinutes,
      autoRefresh: api.autoRefresh,
      autoRefreshIntervalMinutes: api.autoRefreshIntervalMinutes || 60,
      priority: api.priority,
      isActive: api.isActive,
    });
    setShowConfigDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Nome richiesto", variant: "destructive" });
      return;
    }
    if (!formData.baseUrl.trim()) {
      toast({ title: "URL Base richiesto", variant: "destructive" });
      return;
    }

    let customHeaders = {};
    try {
      customHeaders = formData.customHeaders ? JSON.parse(formData.customHeaders) : {};
    } catch {
      toast({ title: "Headers JSON non valido", variant: "destructive" });
      return;
    }

    const payload: any = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      category: formData.category,
      baseUrl: formData.baseUrl.trim(),
      endpoint: formData.endpoint.trim() || null,
      authType: formData.authType,
      customHeaders,
      requestMethod: formData.requestMethod,
      cacheDurationMinutes: formData.cacheDurationMinutes,
      autoRefresh: formData.autoRefresh,
      autoRefreshIntervalMinutes: formData.autoRefresh ? formData.autoRefreshIntervalMinutes : null,
      priority: formData.priority,
      isActive: formData.isActive,
    };

    if (formData.apiKey.trim()) {
      payload.apiKey = formData.apiKey.trim();
    }

    if (editingApi) {
      updateMutation.mutate({ id: editingApi.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getSyncStatusBadge = (api: KnowledgeApi) => {
    if (!api.lastSyncStatus || api.lastSyncStatus === "never") {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-600">
          <Clock className="w-3 h-3 mr-1" />
          Mai sincronizzato
        </Badge>
      );
    }
    if (api.lastSyncStatus === "success") {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Successo
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
        <XCircle className="w-3 h-3 mr-1" />
        Errore
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="mb-4 sm:mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                      <Plug className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
                        Base di Conoscenza - API Esterne
                      </h1>
                      <p className="text-emerald-100 text-xs sm:text-sm md:text-base lg:text-lg hidden sm:block">
                        Collega API esterne per arricchire la knowledge base degli agenti AI
                      </p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">{apis.length}</div>
                    <div className="text-sm text-emerald-100">API Configurate</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">
                      {apis.filter((a) => a.isActive).length}
                    </div>
                    <div className="text-sm text-emerald-100">Attive</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 flex justify-end">
            <Button
              onClick={handleOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuova API
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : apis.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700">
              <CardContent className="py-12 text-center">
                <Plug className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Nessuna API configurata
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Aggiungi la tua prima API esterna per arricchire la knowledge base
                </p>
                <Button onClick={handleOpenCreate} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi API
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {apis.map((api) => (
                <Card
                  key={api.id}
                  className={`relative transition-all hover:shadow-lg ${
                    !api.isActive ? "opacity-60" : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{api.name}</CardTitle>
                        {api.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {api.description}
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={api.isActive}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: api.id, isActive: checked })
                        }
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={CATEGORY_COLORS[api.category]}>
                        {CATEGORY_LABELS[api.category]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {AUTH_TYPE_LABELS[api.authType]}
                      </Badge>
                      {getSyncStatusBadge(api)}
                    </div>

                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{api.baseUrl}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>Ultimo sync: {formatDate(api.lastSyncAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>Cache: {api.cacheDurationMinutes} min</span>
                      </div>
                      {api.usageCount > 0 && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Zap className="w-3 h-3" />
                          <span>Utilizzi: {api.usageCount}</span>
                        </div>
                      )}
                      {api.autoRefresh && (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                          <RefreshCw className="w-3 h-3" />
                          <span>{getNextRefreshText(api)}</span>
                        </div>
                      )}
                    </div>

                    {api.lastSyncError && (
                      <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        {api.lastSyncError}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testMutation.mutate(api.id)}
                        disabled={testingApiId === api.id}
                        className="flex-1"
                      >
                        {testingApiId === api.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3 mr-1" />
                        )}
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncMutation.mutate(api.id)}
                        disabled={syncingApiId === api.id || !api.isActive}
                        className="flex-1"
                      >
                        {syncingApiId === api.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Sync
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(api)}
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingApiId(api.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showConfigDialog} onOpenChange={(open) => {
        if (!open) {
          setShowConfigDialog(false);
          setEditingApi(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingApi ? "Modifica API" : "Nuova Configurazione API"}
            </DialogTitle>
            <DialogDescription>
              Configura i dettagli della connessione API esterna
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Es: Shopify Products API"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: ApiCategory) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrizione opzionale dell'API"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="baseUrl">URL Base *</Label>
                <Input
                  id="baseUrl"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.example.com"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="endpoint">Endpoint Default</Label>
                <Input
                  id="endpoint"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="/v1/data"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="method">Metodo</Label>
                <Select
                  value={formData.requestMethod}
                  onValueChange={(value: RequestMethod) =>
                    setFormData({ ...formData, requestMethod: value })
                  }
                >
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="authType">Tipo Autenticazione</Label>
                <Select
                  value={formData.authType}
                  onValueChange={(value: AuthType) =>
                    setFormData({ ...formData, authType: value })
                  }
                >
                  <SelectTrigger id="authType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUTH_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.authType !== "none" && (
                <div>
                  <Label htmlFor="apiKey">API Key / Token</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder={editingApi ? "Lascia vuoto per mantenere" : "Inserisci API key"}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-0 top-0 h-full px-3"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cache Duration: {formData.cacheDurationMinutes} minuti</Label>
                <Slider
                  value={[formData.cacheDurationMinutes]}
                  onValueChange={([value]) =>
                    setFormData({ ...formData, cacheDurationMinutes: value })
                  }
                  min={5}
                  max={1440}
                  step={5}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5 min</span>
                  <span>24 ore</span>
                </div>
              </div>
              <div>
                <Label>Priorità: {formData.priority}</Label>
                <Slider
                  value={[formData.priority]}
                  onValueChange={([value]) => setFormData({ ...formData, priority: value })}
                  min={1}
                  max={10}
                  step={1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Bassa</span>
                  <span>Alta</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <Label htmlFor="autoRefresh" className="text-sm font-medium">
                  Auto Refresh
                </Label>
                <p className="text-xs text-gray-500">
                  Sincronizza automaticamente i dati
                </p>
              </div>
              <Switch
                id="autoRefresh"
                checked={formData.autoRefresh}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, autoRefresh: checked })
                }
              />
            </div>

            {formData.autoRefresh && (
              <div>
                <Label>Intervallo Refresh: {formData.autoRefreshIntervalMinutes} minuti</Label>
                <Slider
                  value={[formData.autoRefreshIntervalMinutes]}
                  onValueChange={([value]) =>
                    setFormData({ ...formData, autoRefreshIntervalMinutes: value })
                  }
                  min={15}
                  max={1440}
                  step={15}
                  className="mt-2"
                />
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <Label htmlFor="isActive" className="text-sm font-medium">
                  Attiva
                </Label>
                <p className="text-xs text-gray-500">
                  Abilita questa API per l'uso
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfigDialog(false);
                setEditingApi(null);
                resetForm();
              }}
            >
              Annulla
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingApi ? "Salva Modifiche" : "Crea API"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {testResult?.success ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Test Connessione Riuscito
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-500" />
                  Test Connessione Fallito
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {testResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Status</div>
                  <div className="font-semibold">
                    {testResult.status} {testResult.statusText}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Tempo di Risposta</div>
                  <div className="font-semibold">{testResult.responseTime}ms</div>
                </div>
              </div>

              {testResult.dataPreview && (
                <div>
                  <div className="text-sm font-medium mb-2">Anteprima Dati</div>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-xs overflow-x-auto max-h-48">
                    {testResult.dataPreview}
                  </pre>
                </div>
              )}

              {testResult.error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm">
                  {testResult.error}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowTestDialog(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingApiId} onOpenChange={() => setDeletingApiId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questa configurazione API? Questa azione è
              irreversibile e cancellerà anche tutti i dati in cache associati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingApiId && deleteMutation.mutate(deletingApiId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AIAssistant />
    </div>
  );
}
