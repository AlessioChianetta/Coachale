import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot,
  Plus,
  Key,
  Trash2,
  Save,
  Sparkles,
  FileSearch,
  RefreshCw,
  Database,
  FileText,
  BookOpen,
  GraduationCap,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface FileSearchInfo {
  hasStore: boolean;
  storeId?: string;
  storeName?: string;
  documentCount?: number;
}

interface SyncResult {
  success: boolean;
  total?: number;
  synced?: number;
  failed?: number;
  skipped?: number;
  message?: string;
}

export default function ConsultantAISettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [geminiApiKeys, setGeminiApiKeys] = useState<string[]>([]);
  const [syncingCategory, setSyncingCategory] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch consultant's own data
  const { data: consultant, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch consultant data");
      }
      const data = await response.json();
      setGeminiApiKeys(data.geminiApiKeys || []);
      return data;
    },
  });

  // Fetch File Search store info
  const { data: fileSearchInfo, isLoading: fileSearchLoading, refetch: refetchFileSearch } = useQuery<FileSearchInfo>({
    queryKey: ["/api/file-search/info"],
    queryFn: async () => {
      const response = await fetch("/api/file-search/info", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return { hasStore: false };
      }
      return response.json();
    },
  });

  // Sync mutations
  const syncMutation = useMutation({
    mutationFn: async (category: string) => {
      setSyncingCategory(category);
      const response = await fetch(`/api/file-search/sync-${category}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Sync ${category} failed`);
      }
      return response.json() as Promise<SyncResult>;
    },
    onSuccess: (data, category) => {
      refetchFileSearch();
      toast({
        title: "Sincronizzazione completata",
        description: data.message || `${category}: ${data.synced || 0} documenti sincronizzati`,
      });
    },
    onError: (error: any, category) => {
      toast({
        title: "Errore sincronizzazione",
        description: error.message || `Errore durante la sincronizzazione di ${category}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setSyncingCategory(null);
    },
  });

  const handleSyncCategory = (category: string) => {
    syncMutation.mutate(category);
  };

  const handleAddApiKey = () => {
    if (geminiApiKeys.length < 10) {
      setGeminiApiKeys(prev => [...prev, '']);
    }
  };

  const handleRemoveApiKey = (index: number) => {
    setGeminiApiKeys(prev => prev.filter((_, i) => i !== index));
  };

  const handleApiKeyChange = (index: number, value: string) => {
    setGeminiApiKeys(prev => {
      const newKeys = [...prev];
      newKeys[index] = value;
      return newKeys;
    });
  };

  const handleSave = async () => {
    if (!consultant) return;

    // Filter out empty API keys
    const validApiKeys = geminiApiKeys.filter(key => key.trim() !== '');

    try {
      const updateData = {
        gemini_api_keys: validApiKeys
      };
      
      const response = await fetch(`/api/users/${consultant.id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('Errore durante il salvataggio');
      }

      toast({
        title: "Successo",
        description: "API keys aggiornate con successo",
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (error: any) {
      console.error('Errore salvataggio API keys:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Bot className="h-8 w-8 animate-pulse text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Caricamento in corso</h3>
            <p className="text-slate-600">Stiamo recuperando le tue impostazioni...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          {/* Premium Header */}
          <div className="mb-4 sm:mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Impostazioni AI Assistant</h1>
                      <p className="text-blue-100 text-xs sm:text-sm md:text-base lg:text-lg hidden sm:block">Gestisci le tue API key Gemini per l'AI Assistant</p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">{geminiApiKeys.length}</div>
                    <div className="text-sm text-blue-100">API Keys</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* API Keys Management Card */}
          <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm max-w-4xl mx-auto">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl">
                  <Key className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-800">
                    API Keys Gemini
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Configura fino a 10 API keys per la rotazione automatica
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Bot className="h-4 w-4 text-purple-600" />
                    Le tue API Keys ({geminiApiKeys.length}/10)
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddApiKey}
                    disabled={geminiApiKeys.length >= 10}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Aggiungi Key
                  </Button>
                </div>
                
                {geminiApiKeys.length === 0 ? (
                  <div className="text-sm text-slate-500 italic py-8 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                    <Bot className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium text-slate-600 mb-1">Nessuna API key configurata</p>
                    <p className="text-xs">Clicca "Aggiungi Key" per iniziare a configurare l'AI Assistant</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {geminiApiKeys.map((apiKey, index) => (
                      <div key={index} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg hover:bg-slate-100 transition-colors">
                        <div className="flex-shrink-0 w-8 text-center">
                          <span className="text-xs font-medium text-slate-500">#{index + 1}</span>
                        </div>
                        <Input
                          type="password"
                          value={apiKey}
                          onChange={(e) => handleApiKeyChange(index, e.target.value)}
                          className="flex-1 border-slate-200 focus:border-purple-400 focus:ring-purple-400"
                          placeholder={`API Key ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveApiKey(index)}
                          className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-800 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Le API keys verranno ruotate automaticamente ad ogni interazione con l'AI Assistant 
                      per distribuire il carico e rispettare i limiti di rate. 
                      Puoi aggiungere fino a 10 keys per massimizzare la capacità.
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  onClick={handleSave}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salva Modifiche
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm max-w-4xl mx-auto mt-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                Come ottenere le API Keys Gemini
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Accedi a Google AI Studio</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Vai su <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">aistudio.google.com/app/apikey</a>
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Crea una nuova API Key</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Clicca su "Create API Key" e seleziona il progetto Google Cloud
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Copia e incolla qui</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Copia la chiave API generata e incollala nei campi sopra
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File Search Card - NEW */}
          <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm max-w-4xl mx-auto mt-6">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl">
                    <FileSearch className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800">
                      File Search (RAG Semantico)
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      Indicizza i tuoi documenti per una ricerca AI semantica avanzata
                    </CardDescription>
                  </div>
                </div>
                {fileSearchInfo?.hasStore && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <Database className="h-3 w-3 mr-1" />
                    {fileSearchInfo.documentCount || 0} documenti
                  </Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
              {/* Status */}
              <div className={`flex items-center gap-3 p-4 rounded-lg ${fileSearchInfo?.hasStore ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                {fileSearchInfo?.hasStore ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-emerald-800">File Search Attivo</p>
                      <p className="text-xs text-emerald-600">L'AI usa la ricerca semantica per trovare informazioni rilevanti nei tuoi documenti</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-800">File Search Non Configurato</p>
                      <p className="text-xs text-amber-600">Sincronizza i tuoi documenti per attivare la ricerca semantica e ridurre i costi</p>
                    </div>
                  </>
                )}
              </div>

              {/* Sync Categories */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2 text-slate-700">
                  <RefreshCw className="h-4 w-4 text-emerald-600" />
                  Sincronizza Contenuti
                </Label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Library */}
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3 px-4 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => handleSyncCategory('library')}
                    disabled={syncingCategory !== null}
                  >
                    {syncingCategory === 'library' ? (
                      <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                    ) : (
                      <BookOpen className="h-4 w-4 mr-3 text-blue-600" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">Libreria</p>
                      <p className="text-xs text-slate-500">Documenti della libreria</p>
                    </div>
                  </Button>

                  {/* Knowledge Base */}
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3 px-4 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => handleSyncCategory('knowledge')}
                    disabled={syncingCategory !== null}
                  >
                    {syncingCategory === 'knowledge' ? (
                      <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-3 text-purple-600" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">Knowledge Base</p>
                      <p className="text-xs text-slate-500">Documenti AI training</p>
                    </div>
                  </Button>

                  {/* Exercises */}
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3 px-4 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => handleSyncCategory('exercises')}
                    disabled={syncingCategory !== null}
                  >
                    {syncingCategory === 'exercises' ? (
                      <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-3 text-orange-600" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">Esercizi</p>
                      <p className="text-xs text-slate-500">Tutti gli esercizi creati</p>
                    </div>
                  </Button>

                  {/* University */}
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3 px-4 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => handleSyncCategory('university')}
                    disabled={syncingCategory !== null}
                  >
                    {syncingCategory === 'university' ? (
                      <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                    ) : (
                      <GraduationCap className="h-4 w-4 mr-3 text-indigo-600" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">University</p>
                      <p className="text-xs text-slate-500">Lezioni e moduli</p>
                    </div>
                  </Button>

                  {/* Consultations */}
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3 px-4 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => handleSyncCategory('consultations')}
                    disabled={syncingCategory !== null}
                  >
                    {syncingCategory === 'consultations' ? (
                      <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4 mr-3 text-teal-600" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">Consulenze</p>
                      <p className="text-xs text-slate-500">Storico consulenze</p>
                    </div>
                  </Button>

                  {/* Sync All */}
                  <Button
                    className="justify-start h-auto py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                    onClick={() => handleSyncCategory('all')}
                    disabled={syncingCategory !== null}
                  >
                    {syncingCategory === 'all' ? (
                      <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-3" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">Sincronizza TUTTO</p>
                      <p className="text-xs text-emerald-100">Indicizza tutti i contenuti</p>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-xs text-emerald-800 flex items-start gap-2">
                  <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Vantaggi File Search:</strong> Riduce il consumo di token del 90%+, 
                    evita errori "Resource Exhausted", fornisce citazioni automatiche delle fonti, 
                    e permette una ricerca semantica intelligente sui tuoi documenti.
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}
