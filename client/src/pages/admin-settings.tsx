import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Key,
  CheckCircle,
  XCircle,
  History,
  Save,
  Eye,
  EyeOff,
  Shield,
  User,
  Calendar,
  Activity,
  BookOpen,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Navbar from "@/components/navbar";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface GoogleOAuthConfig {
  configured: boolean;
  clientId: string | null;
  hasSecret: boolean;
}

interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: any;
  createdAt: string;
  adminName?: string;
}

export default function AdminSettings() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const redirectUri = `${window.location.origin}/api/calendar-settings/oauth/callback`;

  const copyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopiedUri(true);
      toast({
        title: "Copiato!",
        description: "URI di reindirizzamento copiato negli appunti.",
      });
      setTimeout(() => setCopiedUri(false), 2000);
    } catch (err) {
      toast({
        title: "Errore",
        description: "Impossibile copiare negli appunti.",
        variant: "destructive",
      });
    }
  };

  const { data: oauthData, isLoading: oauthLoading } = useQuery({
    queryKey: ["/api/admin/settings/google-oauth"],
    queryFn: async () => {
      const response = await fetch("/api/admin/settings/google-oauth", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch Google OAuth settings");
      return response.json();
    },
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["/api/admin/audit-log"],
    queryFn: async () => {
      const response = await fetch("/api/admin/audit-log?limit=20", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch audit log");
      return response.json();
    },
  });

  const oauthConfig: GoogleOAuthConfig = oauthData || {
    configured: false,
    clientId: null,
    hasSecret: false,
  };

  const auditLog: AuditLogEntry[] = auditData?.logs || [];

  const saveOAuthMutation = useMutation({
    mutationFn: async (data: { clientId: string; clientSecret: string }) => {
      const response = await fetch("/api/admin/settings/google-oauth", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/google-oauth"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
      setClientSecret("");
      toast({
        title: "Configurazione salvata",
        description: "Le credenziali Google OAuth sono state aggiornate con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare la configurazione.",
        variant: "destructive",
      });
    },
  });

  const handleSaveOAuth = () => {
    if (!clientId || !clientSecret) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci sia il Client ID che il Client Secret.",
        variant: "destructive",
      });
      return;
    }
    saveOAuthMutation.mutate({ clientId, clientSecret });
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      update_google_oauth: "Aggiornamento Google OAuth",
      create_setting: "Nuova impostazione",
      update_setting: "Modifica impostazione",
      activate_user: "Attivazione utente",
      deactivate_user: "Disattivazione utente",
      create_user: "Creazione utente",
    };
    return labels[action] || action;
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("create")) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (action.includes("update")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    if (action.includes("deactivate")) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (action.includes("activate")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 rounded-2xl md:rounded-3xl p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 md:p-3 bg-white/20 backdrop-blur-sm rounded-xl md:rounded-2xl">
                  <Settings className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">Impostazioni Sistema</h1>
                  <p className="text-orange-100 text-sm md:text-base hidden sm:block">
                    Configura le impostazioni globali della piattaforma
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-500" />
                  Google OAuth Credentials
                </CardTitle>
                <CardDescription>
                  Configura le credenziali per l'integrazione con Google Drive e Calendar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className={`p-2 rounded-lg ${oauthConfig.configured ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {oauthConfig.configured ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {oauthConfig.configured ? "Configurazione Attiva" : "Non Configurato"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {oauthConfig.configured
                        ? `Client ID: ${oauthConfig.clientId?.substring(0, 30)}...`
                        : "Inserisci le credenziali per abilitare l'integrazione Google"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Google OAuth Client ID</Label>
                    <Input
                      id="clientId"
                      placeholder="123456789-abcdef.apps.googleusercontent.com"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Google OAuth Client Secret</Label>
                    <div className="relative">
                      <Input
                        id="clientSecret"
                        type={showClientSecret ? "text" : "password"}
                        placeholder="GOCSPX-..."
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                      >
                        {showClientSecret ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveOAuth}
                    disabled={saveOAuthMutation.isPending}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveOAuthMutation.isPending ? "Salvataggio..." : "Salva Credenziali"}
                  </Button>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Nota:</strong> Le credenziali vengono utilizzate per l'autenticazione OAuth di tutti i consultant. 
                    Assicurati di configurare correttamente i redirect URI nella Google Cloud Console.
                  </p>
                </div>

                <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Guida: Come ottenere le credenziali OAuth
                      </span>
                      {guideOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    <div className="space-y-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          1
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Accedi alla Google Cloud Console
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Vai su Google Cloud Console e accedi con il tuo account Google.
                          </p>
                          <a
                            href="https://console.cloud.google.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Apri Google Cloud Console
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          2
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Crea o seleziona un progetto
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Clicca sul selettore progetti in alto a sinistra. Puoi creare un nuovo progetto 
                            (es. "Piattaforma Consulenti") oppure selezionarne uno esistente.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          3
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Abilita le API necessarie
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Vai su <strong>"API e servizi" → "Libreria"</strong> e abilita:
                          </p>
                          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                            <li>Google Drive API</li>
                            <li>Google Calendar API</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          4
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Configura la schermata di consenso OAuth
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Vai su <strong>"API e servizi" → "Schermata di consenso OAuth"</strong>:
                          </p>
                          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                            <li>Scegli <strong>"Esterno"</strong> come tipo utente</li>
                            <li>Compila i campi obbligatori (nome app, email supporto, email sviluppatore)</li>
                            <li>Aggiungi gli scope: <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">.../auth/drive.file</code> e <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">.../auth/calendar</code></li>
                            <li>Nella sezione "Utenti test", aggiungi le email degli utenti che potranno usare l'app</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          5
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Crea le credenziali OAuth
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Vai su <strong>"API e servizi" → "Credenziali"</strong> e clicca <strong>"+ CREA CREDENZIALI" → "ID client OAuth"</strong>:
                          </p>
                          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                            <li>Tipo di applicazione: <strong>Applicazione web</strong></li>
                            <li>Nome: es. "Piattaforma Consulenti OAuth"</li>
                            <li>URI di reindirizzamento autorizzati: aggiungi l'URI seguente</li>
                          </ul>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                          URI di reindirizzamento da aggiungere:
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border border-blue-200 dark:border-blue-700 break-all">
                            {redirectUri}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={copyRedirectUri}
                            className="shrink-0"
                          >
                            {copiedUri ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                          6
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Copia le credenziali
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Dopo aver creato le credenziali, Google ti mostrerà il <strong>Client ID</strong> e il <strong>Client Secret</strong>. 
                            Copia questi valori e incollali nei campi qui sopra, poi clicca "Salva Credenziali".
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-800 dark:text-green-200">
                          <strong>Fatto!</strong> Una volta salvate le credenziali, tutti i consultant potranno 
                          collegare il proprio Google Drive e Calendar cliccando semplicemente "Connetti" 
                          nelle rispettive impostazioni.
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-500" />
                  Audit Log
                </CardTitle>
                <CardDescription>
                  Registro delle modifiche recenti al sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-500">Caricamento log...</p>
                  </div>
                ) : auditLog.length === 0 ? (
                  <div className="p-8 text-center">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nessuna attività</h3>
                    <p className="text-gray-500">Il registro delle attività è vuoto.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {auditLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="p-2 rounded-lg bg-white dark:bg-gray-700 shadow-sm shrink-0">
                          <Shield className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getActionBadgeColor(entry.action)}>
                              {getActionLabel(entry.action)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Target: {entry.targetType} ({entry.targetId?.substring(0, 8)}...)
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(entry.createdAt), "d MMM yyyy, HH:mm", { locale: it })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
