import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import {
  Loader2,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
} from "lucide-react";

interface PublerConfig {
  configured: boolean;
  isActive?: boolean;
  hasApiKey?: boolean;
  hasWorkspaceId?: boolean;
  lastSyncAt?: string;
  accountCount?: number;
}

interface PublerAccount {
  id: string;
  platform: string;
  accountName: string;
  accountUsername: string;
  profileImageUrl?: string;
  isActive: boolean;
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4 text-pink-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-600" />,
  linkedin: <Linkedin className="h-4 w-4 text-blue-700" />,
  twitter: <Twitter className="h-4 w-4 text-sky-500" />,
  youtube: <Youtube className="h-4 w-4 text-red-600" />,
};

export function PublerConfigCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: configStatus, isLoading: statusLoading } = useQuery<PublerConfig>({
    queryKey: ["/api/publer/config"],
    queryFn: async () => {
      const res = await fetch("/api/publer/config", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento config");
      return res.json();
    },
  });

  const { data: accountsData, isLoading: accountsLoading } = useQuery<{ accounts: PublerAccount[] }>({
    queryKey: ["/api/publer/accounts"],
    queryFn: async () => {
      const res = await fetch("/api/publer/accounts", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento account");
      return res.json();
    },
    enabled: !!configStatus?.configured,
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (data: { apiKey: string; workspaceId: string; isActive: boolean }) => {
      const res = await fetch("/api/publer/config", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore salvataggio");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configurazione Publer salvata" });
      queryClient.invalidateQueries({ queryKey: ["/api/publer/config"] });
      setApiKey("");
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/publer/test", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Connessione riuscita!", description: `${data.accountCount} account trovati` });
      } else {
        toast({ title: "Connessione fallita", description: data.message, variant: "destructive" });
      }
    },
  });

  const syncAccountsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/publer/accounts/sync", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore sincronizzazione");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Account sincronizzati", description: `${data.synced} account aggiornati` });
      queryClient.invalidateQueries({ queryKey: ["/api/publer/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publer/config"] });
    },
    onError: (error: Error) => {
      toast({ title: "Errore sincronizzazione", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!apiKey && !configStatus?.hasApiKey) {
      toast({ title: "Inserisci API Key", variant: "destructive" });
      return;
    }
    if (!workspaceId && !configStatus?.hasWorkspaceId) {
      toast({ title: "Inserisci Workspace ID", variant: "destructive" });
      return;
    }
    saveConfigMutation.mutate({
      apiKey: apiKey || "KEEP_EXISTING",
      workspaceId: workspaceId || "KEEP_EXISTING",
      isActive,
    });
  };

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const accounts = accountsData?.accounts || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <img src="https://publer.com/favicon.ico" alt="Publer" className="h-5 w-5" />
              Publer
            </CardTitle>
            <CardDescription>
              Collega Publer per pubblicare i tuoi contenuti sui social media
            </CardDescription>
          </div>
          {configStatus?.configured && (
            <Badge variant={configStatus.isActive ? "default" : "secondary"}>
              {configStatus.isActive ? "Attivo" : "Disattivato"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Per ottenere le credenziali API, vai su{" "}
            <a
              href="https://app.publer.com/settings/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline inline-flex items-center gap-1"
            >
              Publer Settings <ExternalLink className="h-3 w-3" />
            </a>
            . Richiede piano Business ($10/mese).
          </AlertDescription>
        </Alert>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="publer-api-key">API Key</Label>
            <div className="relative">
              <Input
                id="publer-api-key"
                type={showApiKey ? "text" : "password"}
                placeholder={configStatus?.hasApiKey ? "••••••••••••••••" : "Inserisci API Key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publer-workspace-id">Workspace ID</Label>
            <Input
              id="publer-workspace-id"
              placeholder={configStatus?.hasWorkspaceId ? "Già configurato" : "Inserisci Workspace ID"}
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="publer-active">Integrazione attiva</Label>
            <Switch
              id="publer-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveConfigMutation.isPending}>
            {saveConfigMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salva
          </Button>
          {configStatus?.configured && (
            <Button
              variant="outline"
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending}
            >
              {testConnectionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Testa Connessione
            </Button>
          )}
        </div>

        {configStatus?.configured && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Account Social Collegati</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => syncAccountsMutation.mutate()}
                disabled={syncAccountsMutation.isPending}
              >
                {syncAccountsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Sincronizza</span>
              </Button>
            </div>

            {accountsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : accounts.length > 0 ? (
              <div className="grid gap-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    {platformIcons[account.platform] || (
                      <div className="h-4 w-4 bg-gray-400 rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {account.accountName || account.accountUsername}
                      </p>
                      {account.accountUsername && account.accountName && (
                        <p className="text-xs text-muted-foreground">
                          @{account.accountUsername}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {account.platform}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessun account. Clicca "Sincronizza" per caricare gli account da Publer.
              </p>
            )}

            {configStatus.lastSyncAt && (
              <p className="text-xs text-muted-foreground mt-3">
                Ultima sincronizzazione:{" "}
                {new Date(configStatus.lastSyncAt).toLocaleString("it-IT")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
