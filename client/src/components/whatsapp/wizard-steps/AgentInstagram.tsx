import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Instagram,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Unlink,
  Link,
  Zap,
  BookOpen,
  FlaskConical,
  Plus,
  X,
  RefreshCw,
  HelpCircle,
  Smartphone,
  AlertTriangle,
  Users,
  CheckCircle,
} from "lucide-react";

interface AgentInstagramProps {
  agentId: string | null;
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

export default function AgentInstagram({ agentId, formData, onChange, errors }: AgentInstagramProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedInstagramConfigId, setSelectedInstagramConfigId] = useState<string | null>(null);
  const [isSavingInstagram, setIsSavingInstagram] = useState(false);
  const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
  const [isDisconnectingInstagram, setIsDisconnectingInstagram] = useState(false);
  const [instagramError, setInstagramError] = useState<{ code: string; message: string } | null>(null);

  const [newKeyword, setNewKeyword] = useState("");
  const [commentAutoReplyMessage, setCommentAutoReplyMessage] = useState("");
  const [storyAutoReplyMessage, setStoryAutoReplyMessage] = useState("");
  
  const [iceBreakers, setIceBreakers] = useState<Array<{ text: string; payload: string }>>([]);
  const [newIceBreaker, setNewIceBreaker] = useState("");

  const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const { data: instagramConfigs, isLoading: isLoadingInstagramConfigs } = useQuery<{
    configs: Array<{
      id: string;
      instagramPageId: string;
      instagramUsername: string | null;
      agentName: string | null;
      isActive: boolean;
      isConnected: boolean;
      autoResponseEnabled: boolean;
      storyReplyEnabled: boolean;
      commentToDmEnabled: boolean;
      commentTriggerKeywords: string[];
      commentAutoReplyMessage: string | null;
      storyAutoReplyMessage: string | null;
      iceBreakersEnabled: boolean;
      iceBreakers: any[];
      isDryRun: boolean;
      connectedAt: string | null;
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

  const { data: agentDetails } = useQuery<{ config: { instagramConfigId?: string } }>({
    queryKey: ["/api/whatsapp/config", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/config/${agentId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch agent details");
      return res.json();
    },
    enabled: !!agentId,
  });

  useEffect(() => {
    if (agentDetails?.config?.instagramConfigId) {
      setSelectedInstagramConfigId(agentDetails.config.instagramConfigId);
    } else {
      setSelectedInstagramConfigId(null);
    }
  }, [agentDetails?.config?.instagramConfigId, agentId]);

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
      
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } else if (successParam) {
      const username = urlParams.get('username');
      toast({
        title: "Instagram Collegato!",
        description: username ? `Account @${username} collegato con successo` : "Account collegato con successo"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instagram-configs"] });
      
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [toast, queryClient]);

  const handleLinkInstagram = async (configId: string | null) => {
    if (!agentId) return;
    
    setIsSavingInstagram(true);
    try {
      const response = await fetch(`/api/whatsapp/config/${agentId}/instagram`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config", agentId] });
      
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
      if (selectedInstagramConfigId) {
        await handleLinkInstagram(null);
      }
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

  const handleDeleteInstagramConfig = async (configId: string) => {
    setDeletingConfigId(configId);
    try {
      const response = await fetch(`/api/instagram/oauth/config/${configId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Account Eliminato",
          description: data.message || "Account Instagram rimosso"
        });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instagram-configs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config", agentId] });
        if (selectedInstagramConfigId === configId) {
          setSelectedInstagramConfigId(null);
        }
        setShowDeleteConfirm(null);
      } else {
        throw new Error(data.error || "Impossibile eliminare");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Errore durante l'eliminazione"
      });
    } finally {
      setDeletingConfigId(null);
    }
  };

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

  if (!agentId) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500">
              <Instagram className="h-6 w-6 text-white" />
            </div>
            Integrazione Instagram
          </h2>
          <p className="text-muted-foreground">
            Collega un account Instagram a questo agente
          </p>
        </div>

        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Per collegare un account Instagram, devi prima salvare l'agente. Completa gli step precedenti e salva.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoadingInstagramConfigs) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  const currentConfig = selectedInstagramConfigId 
    ? instagramConfigs?.configs?.find(c => c.id === selectedInstagramConfigId) 
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500">
            <Instagram className="h-6 w-6 text-white" />
          </div>
          Integrazione Instagram
        </h2>
        <p className="text-muted-foreground">
          Collega un account Instagram Business per rispondere automaticamente ai DM
        </p>
      </div>

      <Card className="border-2 overflow-hidden" style={{
        borderImage: "linear-gradient(45deg, #833AB4, #E1306C, #F77737) 1",
      }}>
        <CardHeader className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Instagram className="h-5 w-5 text-pink-500" />
                Stato Connessione
              </CardTitle>
              <CardDescription>Stato della connessione con l'account Instagram</CardDescription>
            </div>
            {selectedInstagramConfigId && currentConfig ? (
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Collegato
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-gray-400">
                <XCircle className="h-3 w-3" />
                Non connesso
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {instagramError && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 mb-1">Connessione Fallita</p>
                  <p className="text-sm text-red-600">{instagramError.message}</p>
                  {instagramError.code === 'no_instagram' && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-sm font-medium text-red-700 mb-2">Come risolvere:</p>
                      <ol className="text-sm text-red-600 list-decimal list-inside space-y-1">
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
                  <X className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </div>
          )}

          {/* MULTI-ACCOUNT: Show current linked account if any */}
          {selectedInstagramConfigId && currentConfig ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200">
              <Instagram className="h-5 w-5 text-pink-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-pink-700">Account Collegato a questo Agente</p>
                <p className="text-sm text-pink-600 truncate font-medium">
                  @{currentConfig.instagramUsername || currentConfig.instagramPageId}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleLinkInstagram(null)} 
                disabled={isSavingInstagram} 
                className="text-pink-600 hover:text-pink-700 hover:bg-pink-50 border-pink-300 gap-2"
              >
                {isSavingInstagram ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                Scollega
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-sm text-slate-600">Nessun account Instagram collegato a questo agente</p>
              <p className="text-xs text-slate-500">Seleziona o aggiungi un account Instagram per questo agente</p>
            </div>
          )}

          {/* MULTI-ACCOUNT: Lista di tutti gli account disponibili */}
          {instagramConfigs?.configs && instagramConfigs.configs.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm text-slate-600 font-medium">Account Instagram disponibili:</Label>
              <div className="space-y-2">
                {instagramConfigs.configs.map((config) => {
                  const isLinkedToOther = config.linkedAgent && config.linkedAgent.agentId !== agentId;
                  const isCurrentlyLinked = config.id === selectedInstagramConfigId;
                  const displayName = config.instagramUsername ? `@${config.instagramUsername}` : config.instagramPageId;
                  
                  return (
                    <div
                      key={config.id}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border transition-colors",
                        isCurrentlyLinked 
                          ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-300"
                          : isLinkedToOther 
                            ? "bg-slate-50 border-slate-200 opacity-60" 
                            : "bg-white border-slate-200 hover:bg-pink-50/50"
                      )}
                    >
                      <Instagram className={cn(
                        "h-5 w-5 flex-shrink-0",
                        isCurrentlyLinked ? "text-green-600" : isLinkedToOther ? "text-slate-400" : "text-pink-500"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          isCurrentlyLinked ? "text-green-700" : isLinkedToOther ? "text-slate-500" : "text-slate-700"
                        )}>
                          {displayName}
                        </p>
                        {isLinkedToOther && (
                          <p className="text-xs text-slate-400">Collegato a: {config.linkedAgent?.agentName}</p>
                        )}
                        {isCurrentlyLinked && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Collegato a questo agente
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Link/Unlink button */}
                        {!isLinkedToOther && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLinkInstagram(isCurrentlyLinked ? null : config.id)}
                            disabled={isSavingInstagram}
                            className={cn(
                              "gap-1",
                              isCurrentlyLinked 
                                ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-300"
                                : "text-pink-600 hover:text-pink-700 hover:bg-pink-50 border-pink-300"
                            )}
                          >
                            {isSavingInstagram ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isCurrentlyLinked ? (
                              <Unlink className="h-3 w-3" />
                            ) : (
                              <Link className="h-3 w-3" />
                            )}
                            {isCurrentlyLinked ? "Scollega" : "Collega"}
                          </Button>
                        )}
                        
                        {/* Delete button with confirmation */}
                        {showDeleteConfirm === config.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteInstagramConfig(config.id)}
                              disabled={deletingConfigId === config.id}
                              className="gap-1 h-8 px-2"
                            >
                              {deletingConfigId === config.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Conferma"
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowDeleteConfirm(null)}
                              className="h-8 px-2"
                            >
                              Annulla
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(config.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            title="Elimina account"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MULTI-ACCOUNT: Always show "Add New Account" button */}
          <div className="pt-2 border-t border-slate-200">
            <Button
              onClick={handleConnectInstagram}
              disabled={isConnectingInstagram}
              variant="outline"
              className="w-full border-2 border-dashed border-pink-300 text-pink-600 hover:bg-pink-50 hover:border-pink-400 gap-2"
            >
              {isConnectingInstagram ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Aggiungi Nuovo Account Instagram
            </Button>
            <p className="text-xs text-slate-500 text-center mt-2">
              Puoi collegare più account Instagram (uno per agente)
            </p>
          </div>
        </CardContent>
      </Card>

      {selectedInstagramConfigId && currentConfig && (
        <Card className="border-2 border-pink-500/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-pink-500/5 to-purple-500/10">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-pink-500" />
              AUTOMAZIONI
            </CardTitle>
            <CardDescription>Configura il comportamento automatico dell'agente su Instagram</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-white/60 hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-3 flex-1">
                <MessageSquare className="h-4 w-4 text-pink-500" />
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold cursor-pointer">Risposta Auto DM</Label>
                  <p className="text-xs text-muted-foreground">Rispondi automaticamente ai messaggi diretti</p>
                </div>
              </div>
              <Switch
                checked={currentConfig.autoResponseEnabled ?? false}
                onCheckedChange={(checked) => handleInstagramSettingChange(currentConfig.id, 'autoResponseEnabled', checked)}
                disabled={updateInstagramSettings.isPending}
                className="scale-75"
              />
            </div>

            <div className="space-y-3 p-4 rounded-lg border bg-white/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-4 w-4 text-pink-500" />
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Story Reply</Label>
                    <p className="text-xs text-muted-foreground">Rispondi alle reazioni/risposte alle storie</p>
                  </div>
                </div>
                <Switch
                  checked={currentConfig.storyReplyEnabled ?? false}
                  onCheckedChange={(checked) => handleInstagramSettingChange(currentConfig.id, 'storyReplyEnabled', checked)}
                  disabled={updateInstagramSettings.isPending}
                  className="scale-75"
                />
              </div>
              
              {currentConfig.storyReplyEnabled && (
                <div className="pl-7 space-y-2 border-l-2 border-pink-200 ml-2">
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
                    className="text-sm min-h-[80px] resize-none"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 p-4 rounded-lg border bg-white/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-pink-500" />
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Comment-to-DM</Label>
                    <p className="text-xs text-muted-foreground">Invia DM quando qualcuno commenta con parole chiave</p>
                  </div>
                </div>
                <Switch
                  checked={currentConfig.commentToDmEnabled ?? false}
                  onCheckedChange={(checked) => handleInstagramSettingChange(currentConfig.id, 'commentToDmEnabled', checked)}
                  disabled={updateInstagramSettings.isPending}
                  className="scale-75"
                />
              </div>
              
              {currentConfig.commentToDmEnabled && (
                <div className="pl-7 space-y-4 border-l-2 border-pink-200 ml-2">
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Parole chiave trigger:</p>
                    <div className="flex flex-wrap gap-2">
                      {(currentConfig.commentTriggerKeywords || []).map((keyword, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm">
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
                    <div className="flex gap-2">
                      <Input
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        placeholder="Nuova parola chiave..."
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddKeyword(currentConfig.id, currentConfig.commentTriggerKeywords || []);
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => handleAddKeyword(currentConfig.id, currentConfig.commentTriggerKeywords || [])}
                        disabled={!newKeyword.trim()}
                        className="px-3"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Messaggio auto DM:</p>
                    <Textarea
                      value={commentAutoReplyMessage}
                      onChange={(e) => setCommentAutoReplyMessage(e.target.value)}
                      onBlur={() => {
                        const originalValue = currentConfig.commentAutoReplyMessage || '';
                        if (commentAutoReplyMessage !== originalValue) {
                          handleInstagramSettingChange(currentConfig.id, 'commentAutoReplyMessage', commentAutoReplyMessage);
                        }
                      }}
                      placeholder="Ciao! Ho visto il tuo commento, ti scrivo in DM per darti tutte le info!"
                      className="text-sm min-h-[80px] resize-none"
                    />
                  </div>
                  
                  <div className={cn(
                    "p-3 rounded-lg border mt-3",
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
                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                            <span className="text-sm text-slate-500">Verifica webhook...</span>
                          </div>
                        ) : webhookStatus?.isSubscribed ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-sm font-medium text-green-700">Webhook Attivo</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-sm font-medium text-amber-700">Webhook Non Attivo</span>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => subscribeWebhook.mutate()}
                        disabled={subscribeWebhook.isPending || isLoadingWebhookStatus}
                        className={cn(
                          "h-8 px-3 text-sm",
                          webhookStatus?.isSubscribed 
                            ? "text-green-600 hover:text-green-700 hover:bg-green-100"
                            : "text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                        )}
                        title={webhookStatus?.isSubscribed ? "Ri-sincronizza webhook" : "Attiva webhook"}
                      >
                        {subscribeWebhook.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {webhookStatus?.isSubscribed 
                        ? "I messaggi Instagram vengono ricevuti automaticamente"
                        : "Clicca per attivare la ricezione dei messaggi"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 p-4 rounded-lg border bg-white/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-pink-500" />
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Ice Breakers</Label>
                    <p className="text-xs text-muted-foreground">Domande rapide cliccabili (max 4)</p>
                  </div>
                </div>
                <Switch
                  checked={currentConfig.iceBreakersEnabled ?? false}
                  onCheckedChange={(checked) => handleInstagramSettingChange(currentConfig.id, 'iceBreakersEnabled', checked)}
                  disabled={updateInstagramSettings.isPending}
                  className="scale-75"
                />
              </div>
              
              {currentConfig.iceBreakersEnabled && (
                <div className="pl-7 space-y-3 border-l-2 border-pink-200 ml-2">
                  <p className="text-xs text-slate-500">Domande rapide mostrate al primo contatto:</p>
                  
                  {iceBreakers.length > 0 && (
                    <div className="space-y-2">
                      {iceBreakers.map((ib, index) => (
                        <div key={index} className="flex items-center gap-2 group">
                          <span className="text-sm bg-white px-3 py-2 rounded-lg border border-pink-200 flex-1 truncate">
                            {ib.text}
                          </span>
                          <button
                            onClick={() => {
                              const updated = iceBreakers.filter((_, i) => i !== index);
                              setIceBreakers(updated);
                              handleInstagramSettingChange(currentConfig.id, 'iceBreakers', updated);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded transition-opacity"
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {iceBreakers.length < 4 && (
                    <div className="flex gap-2">
                      <Input
                        value={newIceBreaker}
                        onChange={(e) => setNewIceBreaker(e.target.value)}
                        placeholder="es. Quanto costa?"
                        className="flex-1"
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
                        variant="outline"
                        onClick={() => {
                          if (newIceBreaker.trim()) {
                            const updated = [...iceBreakers, { text: newIceBreaker.trim(), payload: `ice_breaker_${iceBreakers.length + 1}` }];
                            setIceBreakers(updated);
                            handleInstagramSettingChange(currentConfig.id, 'iceBreakers', updated);
                            setNewIceBreaker('');
                          }
                        }}
                        disabled={!newIceBreaker.trim()}
                        className="px-3"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  {iceBreakers.length >= 4 && (
                    <p className="text-xs text-amber-600">Limite raggiunto (max 4 Ice Breakers)</p>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => syncIceBreakers.mutate(currentConfig.id)}
                    disabled={syncIceBreakers.isPending || iceBreakers.length === 0}
                    className="w-full border-pink-300 text-pink-600 hover:bg-pink-50 gap-2"
                  >
                    {syncIceBreakers.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sincronizza con Instagram
                  </Button>
                  <p className="text-xs text-slate-500 text-center">
                    Pubblica gli Ice Breakers su Instagram
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border bg-amber-50/60 border-amber-200">
              <div className="flex items-center gap-3">
                <FlaskConical className="h-4 w-4 text-amber-600" />
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Dry Run (Modalità Test)</Label>
                  <p className="text-xs text-muted-foreground">Le risposte vengono solo loggate, non inviate</p>
                </div>
              </div>
              <Switch
                checked={currentConfig.isDryRun ?? true}
                onCheckedChange={(checked) => handleInstagramSettingChange(currentConfig.id, 'isDryRun', checked)}
                disabled={updateInstagramSettings.isPending}
                className="scale-75"
              />
            </div>
            
            {currentConfig.isDryRun && (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  Modalità test attiva: le risposte vengono solo loggate, non inviate su Instagram
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-4 mt-4 border-t border-red-200">
              <Button
                variant="outline"
                onClick={handleDisconnectInstagram}
                disabled={isDisconnectingInstagram}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 gap-2"
              >
                {isDisconnectingInstagram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                Disconnetti OAuth Completamente
              </Button>
              <p className="text-xs text-slate-500 mt-2 text-center">
                Rimuove la connessione OAuth. Dovrai rifare il login con Facebook.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Collapsible>
        <Card className="border-2 border-slate-200">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-pink-500" />
                  <CardTitle className="text-base">Guida Instagram DM</CardTitle>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
                <p className="font-medium text-pink-700 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Requisiti Obbligatori
                </p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-pink-500 font-bold">1.</span>
                    <span><strong>Account Business:</strong> Instagram deve essere "Business" o "Creator"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-pink-500 font-bold">2.</span>
                    <span><strong>Pagina Facebook:</strong> Collegata all'account Instagram</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-pink-500 font-bold">3.</span>
                    <span><strong>Ruolo Admin:</strong> Essere ADMIN della Pagina Facebook</span>
                  </li>
                </ul>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-blue-700 mb-3 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Controllo Veloce da Telefono
                </p>
                <ol className="space-y-1.5 text-sm text-slate-600 list-decimal list-inside">
                  <li>Apri Instagram → Profilo → Modifica Profilo</li>
                  <li>Scorri fino a "Pagina"</li>
                  <li>Vedi il nome della tua azienda? Sei pronto!</li>
                  <li>Vedi "Collega"? Clicca e collega la tua Pagina Facebook</li>
                </ol>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-medium text-amber-700 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Se l'AI Non Risponde
                </p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600">•</span>
                    <span><strong>Privacy:</strong> Impostazioni → Messaggi → "Consenti accesso ai messaggi" deve essere BLU</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600">•</span>
                    <span><strong>Finestra 24h:</strong> Il bot risponde solo dopo un messaggio dell'utente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600">•</span>
                    <span><strong>Modalità Dev:</strong> Solo Admin/Tester funzionano finché l'app non è Live</span>
                  </li>
                </ul>
              </div>
              
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="font-medium text-purple-700 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Aggiungere Tester (Modalità Dev)
                </p>
                <p className="text-sm text-slate-600 mb-2">
                  In Modalità Sviluppo, solo gli utenti nella lista Tester possono usare il bot.
                </p>
                <ol className="space-y-1.5 text-sm text-slate-600 list-decimal list-inside">
                  <li>Vai su <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="text-purple-600 underline">developers.facebook.com</a></li>
                  <li>My Apps → Seleziona la tua App</li>
                  <li>Ruoli dell'app → Ruoli → Tester</li>
                  <li>Clicca "Aggiungi persone" e inserisci il nome</li>
                </ol>
                <div className="mt-3 p-3 bg-purple-100 rounded border border-purple-300">
                  <p className="text-sm font-medium text-purple-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    IMPORTANTE: Accettare l'invito!
                  </p>
                  <p className="text-sm text-purple-700 mt-1">
                    Il tester deve aprire <a href="https://developers.facebook.com/requests" target="_blank" rel="noopener" className="underline font-medium">developers.facebook.com/requests</a> e cliccare CONFERMA.
                  </p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
