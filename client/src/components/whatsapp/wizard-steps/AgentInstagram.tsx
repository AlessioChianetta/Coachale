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
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Instagram,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageCircle,
  AtSign,
  Heart,
  Send,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Unlink,
  TestTube,
  Link2,
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
  const [showToken, setShowToken] = useState(false);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState({
    instagramPageId: "",
    facebookPageId: "",
    pageAccessToken: "",
    instagramUsername: "",
    isConnected: false,
    isDryRun: true,
    autoResponseEnabled: true,
    commentToDmEnabled: false,
    commentTriggerKeywords: "",
    commentAutoReplyMessage: "",
    storyReplyEnabled: false,
    storyAutoReplyMessage: "",
    aiPersonality: "",
    agentInstructions: "",
    agentInstructionsEnabled: false,
    businessName: "",
  });

  const { data: instagramConfig, isLoading, refetch } = useQuery({
    queryKey: [`/api/consultant/agents/${agentId}/instagram`],
    queryFn: async () => {
      if (!agentId) return null;
      const response = await fetch(`/api/consultant/agents/${agentId}/instagram`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.config;
    },
    enabled: !!agentId,
  });

  const { data: inheritedSettings } = useQuery({
    queryKey: [`/api/consultant/agents/${agentId}/instagram/inherit`],
    queryFn: async () => {
      if (!agentId) return null;
      const response = await fetch(`/api/consultant/agents/${agentId}/instagram/inherit`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!agentId && !instagramConfig,
  });

  useEffect(() => {
    if (instagramConfig) {
      setLocalConfig({
        instagramPageId: instagramConfig.instagramPageId || "",
        facebookPageId: instagramConfig.facebookPageId || "",
        pageAccessToken: instagramConfig.pageAccessToken === "***ENCRYPTED***" ? "" : "",
        instagramUsername: instagramConfig.instagramUsername || "",
        isConnected: instagramConfig.isConnected || false,
        isDryRun: instagramConfig.isDryRun ?? true,
        autoResponseEnabled: instagramConfig.autoResponseEnabled ?? true,
        commentToDmEnabled: instagramConfig.commentToDmEnabled || false,
        commentTriggerKeywords: Array.isArray(instagramConfig.commentTriggerKeywords)
          ? instagramConfig.commentTriggerKeywords.join(", ")
          : instagramConfig.commentTriggerKeywords || "",
        commentAutoReplyMessage: instagramConfig.commentAutoReplyMessage || "",
        storyReplyEnabled: instagramConfig.storyReplyEnabled || false,
        storyAutoReplyMessage: instagramConfig.storyAutoReplyMessage || "",
        aiPersonality: instagramConfig.aiPersonality || "",
        agentInstructions: instagramConfig.agentInstructions || "",
        agentInstructionsEnabled: instagramConfig.agentInstructionsEnabled || false,
        businessName: instagramConfig.businessName || "",
      });
    } else if (inheritedSettings) {
      setLocalConfig((prev) => ({
        ...prev,
        aiPersonality: inheritedSettings.aiPersonality || "",
        businessName: inheritedSettings.businessName || "",
      }));
    }
  }, [instagramConfig, inheritedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/consultant/agents/${agentId}/instagram`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save Instagram configuration");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Configurazione salvata",
        description: "Le impostazioni Instagram sono state aggiornate",
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: [`/api/consultant/agents/${agentId}/instagram`] });
    },
    onError: () => {
      toast({
        title: "❌ Errore",
        description: "Impossibile salvare la configurazione Instagram",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/consultant/agents/${agentId}/instagram/test`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to test connection");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "✅ Connessione riuscita!",
          description: `Account Instagram: @${data.username}`,
        });
        refetch();
      } else {
        toast({
          title: "❌ Connessione fallita",
          description: data.error || "Verifica le credenziali e riprova",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "❌ Errore",
        description: "Impossibile testare la connessione",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/consultant/agents/${agentId}/instagram`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to disconnect Instagram");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Instagram scollegato",
        description: "L'account Instagram è stato scollegato da questo agente",
      });
      setLocalConfig({
        instagramPageId: "",
        facebookPageId: "",
        pageAccessToken: "",
        instagramUsername: "",
        isConnected: false,
        isDryRun: true,
        autoResponseEnabled: true,
        commentToDmEnabled: false,
        commentTriggerKeywords: "",
        commentAutoReplyMessage: "",
        storyReplyEnabled: false,
        storyAutoReplyMessage: "",
        aiPersonality: "",
        agentInstructions: "",
        agentInstructionsEnabled: false,
        businessName: "",
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: [`/api/consultant/agents/${agentId}/instagram`] });
    },
    onError: () => {
      toast({
        title: "❌ Errore",
        description: "Impossibile scollegare l'account Instagram",
        variant: "destructive",
      });
    },
  });

  const handleLocalChange = (field: string, value: any) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const keywords = localConfig.commentTriggerKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    saveMutation.mutate({
      ...localConfig,
      commentTriggerKeywords: keywords,
      pageAccessToken: localConfig.pageAccessToken || undefined,
    });
  };

  if (!agentId) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Instagram className="h-6 w-6 text-pink-500" />
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

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
                <Link2 className="h-5 w-5 text-pink-500" />
                Stato Connessione
              </CardTitle>
              <CardDescription>Stato della connessione con l'account Instagram</CardDescription>
            </div>
            {localConfig.isConnected ? (
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connesso
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
          {localConfig.isConnected && localConfig.instagramUsername && (
            <Alert className="border-pink-500/50 bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-orange-950/20">
              <AtSign className="h-4 w-4 text-pink-500" />
              <AlertDescription className="flex items-center gap-2">
                <span className="font-semibold text-pink-600 dark:text-pink-400">
                  @{localConfig.instagramUsername}
                </span>
                <span className="text-muted-foreground">Account collegato</span>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="facebookPageId">
                Facebook Page ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="facebookPageId"
                value={localConfig.facebookPageId}
                onChange={(e) => handleLocalChange("facebookPageId", e.target.value)}
                placeholder="123456789012345"
                className="mt-2 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                ID della pagina Facebook collegata all'account Instagram Business
              </p>
            </div>

            <div>
              <Label htmlFor="instagramPageId">
                Instagram Page ID
              </Label>
              <Input
                id="instagramPageId"
                value={localConfig.instagramPageId}
                onChange={(e) => handleLocalChange("instagramPageId", e.target.value)}
                placeholder="17841400000000000"
                className="mt-2 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                (Opzionale) ID dell'account Instagram Business
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="pageAccessToken">
              Page Access Token <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-2">
              <Input
                id="pageAccessToken"
                type={showToken ? "text" : "password"}
                value={localConfig.pageAccessToken}
                onChange={(e) => handleLocalChange("pageAccessToken", e.target.value)}
                placeholder={instagramConfig?.pageAccessToken === "***ENCRYPTED***" ? "••••••••••••••••" : "EAAGm0PX4ZCps..."}
                className="font-mono text-sm pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Token di accesso della pagina Facebook con permessi messaging
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !localConfig.facebookPageId}
              className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Salva Credenziali
            </Button>

            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !instagramConfig?.pageAccessToken}
              className="gap-2"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              Testa Connessione
            </Button>

            {localConfig.isConnected && (
              <Button
                variant="destructive"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="gap-2"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                Scollega
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-pink-500/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-pink-500/5 to-orange-500/10">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-pink-500" />
            Opzioni Instagram
          </CardTitle>
          <CardDescription>Configura il comportamento dell'agente su Instagram</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="autoResponseEnabled" className="text-base font-semibold cursor-pointer">
                Risposte Automatiche DM
              </Label>
              <p className="text-sm text-muted-foreground">
                Rispondi automaticamente ai messaggi diretti
              </p>
            </div>
            <Switch
              id="autoResponseEnabled"
              checked={localConfig.autoResponseEnabled}
              onCheckedChange={(checked) => handleLocalChange("autoResponseEnabled", checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="isDryRun" className="text-base font-semibold cursor-pointer">
                Modalità Test (Dry Run)
              </Label>
              <p className="text-sm text-muted-foreground">
                L'agente non invierà messaggi reali su Instagram
              </p>
            </div>
            <Switch
              id="isDryRun"
              checked={localConfig.isDryRun}
              onCheckedChange={(checked) => handleLocalChange("isDryRun", checked)}
            />
          </div>

          <Separator />

          <div className={cn(
            "p-4 rounded-lg border transition-all",
            localConfig.commentToDmEnabled ? "bg-pink-50/50 dark:bg-pink-950/10 border-pink-500/30" : "bg-card"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="commentToDmEnabled" className="text-base font-semibold cursor-pointer flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-pink-500" />
                  Commenti → DM
                </Label>
                <p className="text-sm text-muted-foreground">
                  Rispondi ai commenti con un messaggio diretto
                </p>
              </div>
              <Switch
                id="commentToDmEnabled"
                checked={localConfig.commentToDmEnabled}
                onCheckedChange={(checked) => handleLocalChange("commentToDmEnabled", checked)}
              />
            </div>

            {localConfig.commentToDmEnabled && (
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="commentTriggerKeywords">Parole Chiave Trigger</Label>
                  <Input
                    id="commentTriggerKeywords"
                    value={localConfig.commentTriggerKeywords}
                    onChange={(e) => handleLocalChange("commentTriggerKeywords", e.target.value)}
                    placeholder="info, prezzo, dettagli, interessato"
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Separa le parole chiave con virgole. Lascia vuoto per rispondere a tutti i commenti.
                  </p>
                </div>

                <div>
                  <Label htmlFor="commentAutoReplyMessage">Messaggio Automatico Commenti</Label>
                  <Textarea
                    id="commentAutoReplyMessage"
                    value={localConfig.commentAutoReplyMessage}
                    onChange={(e) => handleLocalChange("commentAutoReplyMessage", e.target.value)}
                    placeholder="Ciao! Ho visto il tuo commento, ti scrivo in DM per darti tutte le info! 💬"
                    rows={2}
                    className="mt-2"
                  />
                </div>
              </div>
            )}
          </div>

          <div className={cn(
            "p-4 rounded-lg border transition-all",
            localConfig.storyReplyEnabled ? "bg-orange-50/50 dark:bg-orange-950/10 border-orange-500/30" : "bg-card"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="storyReplyEnabled" className="text-base font-semibold cursor-pointer flex items-center gap-2">
                  <Heart className="h-4 w-4 text-orange-500" />
                  Risposte alle Storie
                </Label>
                <p className="text-sm text-muted-foreground">
                  Rispondi automaticamente alle reazioni/risposte alle tue storie
                </p>
              </div>
              <Switch
                id="storyReplyEnabled"
                checked={localConfig.storyReplyEnabled}
                onCheckedChange={(checked) => handleLocalChange("storyReplyEnabled", checked)}
              />
            </div>

            {localConfig.storyReplyEnabled && (
              <div className="pt-2">
                <Label htmlFor="storyAutoReplyMessage">Messaggio Automatico Storie</Label>
                <Textarea
                  id="storyAutoReplyMessage"
                  value={localConfig.storyAutoReplyMessage}
                  onChange={(e) => handleLocalChange("storyAutoReplyMessage", e.target.value)}
                  placeholder="Grazie per la reazione alla mia storia! 🙏 Come posso aiutarti?"
                  rows={2}
                  className="mt-2"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Collapsible open={isOverrideOpen} onOpenChange={setIsOverrideOpen}>
        <Card className="border-2 border-purple-500/20 shadow-lg">
          <CollapsibleTrigger asChild>
            <CardHeader className="bg-gradient-to-r from-purple-500/5 to-purple-500/10 cursor-pointer hover:bg-purple-500/10 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    Override Impostazioni AI (Opzionale)
                  </CardTitle>
                  <CardDescription>
                    Personalizza le impostazioni AI solo per Instagram (ereditate da WhatsApp per default)
                  </CardDescription>
                </div>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  isOverrideOpen && "rotate-180"
                )} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-4">
              <Alert className="border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/10">
                <AlertCircle className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-800 dark:text-purple-200">
                  Se lasci questi campi vuoti, verranno usate le impostazioni dell'agente WhatsApp.
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="businessName">Nome Business (Override)</Label>
                <Input
                  id="businessName"
                  value={localConfig.businessName}
                  onChange={(e) => handleLocalChange("businessName", e.target.value)}
                  placeholder={inheritedSettings?.businessName || "Lascia vuoto per usare quello WhatsApp"}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="aiPersonality">Personalità AI (Override)</Label>
                <Input
                  id="aiPersonality"
                  value={localConfig.aiPersonality}
                  onChange={(e) => handleLocalChange("aiPersonality", e.target.value)}
                  placeholder={inheritedSettings?.aiPersonality || "amico_fidato"}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Es: amico_fidato, consulente_professionale, consigliere_empatico
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="agentInstructionsEnabled" className="text-base font-semibold cursor-pointer">
                    Usa Istruzioni AI Custom per Instagram
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Abilita istruzioni AI specifiche per Instagram
                  </p>
                </div>
                <Switch
                  id="agentInstructionsEnabled"
                  checked={localConfig.agentInstructionsEnabled}
                  onCheckedChange={(checked) => handleLocalChange("agentInstructionsEnabled", checked)}
                />
              </div>

              {localConfig.agentInstructionsEnabled && (
                <div>
                  <Label htmlFor="agentInstructions">Istruzioni AI Custom per Instagram</Label>
                  <Textarea
                    id="agentInstructions"
                    value={localConfig.agentInstructions}
                    onChange={(e) => handleLocalChange("agentInstructions", e.target.value)}
                    placeholder="Istruzioni specifiche per l'agente Instagram..."
                    rows={6}
                    className="mt-2 font-mono text-sm"
                  />
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                variant="outline"
                className="gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Salva Impostazioni Instagram
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
