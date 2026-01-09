import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Webhook, TestTube, Save, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

interface TicketSettings {
  webhookUrl: string | null;
  webhookSecret?: string | null;
  webhookEnabled: boolean;
  autoCreateTicketOnNoAnswer: boolean;
  autoCreateTicketOnHighUrgency: boolean;
  autoCreateTicketOnNegativeSentiment: boolean;
}

export function TicketSettingsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [settings, setSettings] = useState<TicketSettings>({
    webhookUrl: null,
    webhookSecret: null,
    webhookEnabled: false,
    autoCreateTicketOnNoAnswer: true,
    autoCreateTicketOnHighUrgency: true,
    autoCreateTicketOnNegativeSentiment: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/email-hub/ticket-settings", { credentials: "include" });
      const data = await res.json();
      if (data.success && data.data) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error("Error fetching ticket settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/email-hub/ticket-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Impostazioni salvate",
          description: "Le impostazioni ticket e webhook sono state aggiornate.",
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare le impostazioni",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWebhook() {
    if (!settings.webhookUrl) {
      toast({
        title: "URL mancante",
        description: "Inserisci un webhook URL prima di testare.",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/email-hub/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Test riuscito",
          description: `Webhook inviato con successo (HTTP ${data.statusCode})`,
        });
      } else {
        toast({
          title: "Test fallito",
          description: data.message || data.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nel test webhook",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Configurazione Webhook
          </CardTitle>
          <CardDescription>
            Configura un webhook per ricevere notifiche quando vengono creati nuovi ticket.
            Il sistema invia una richiesta POST con firma HMAC-SHA256.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Webhook Attivo</Label>
              <p className="text-sm text-muted-foreground">
                Attiva l'invio automatico di notifiche webhook
              </p>
            </div>
            <Switch
              checked={settings.webhookEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, webhookEnabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              type="url"
              placeholder="https://your-crm.com/webhook/email-tickets"
              value={settings.webhookUrl || ""}
              onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              URL dove verranno inviate le notifiche POST
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Secret (HMAC)</Label>
            <div className="relative">
              <Input
                id="webhookSecret"
                type={showSecret ? "text" : "password"}
                placeholder="Inserisci una chiave segreta per la firma"
                value={settings.webhookSecret || ""}
                onChange={(e) => setSettings({ ...settings, webhookSecret: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Chiave per verificare l'autenticità delle richieste (header X-Webhook-Signature)
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleTestWebhook} variant="outline" disabled={testing || !settings.webhookUrl}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
              Test Webhook
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creazione Automatica Ticket</CardTitle>
          <CardDescription>
            Scegli quando il sistema deve creare automaticamente ticket per le email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-orange-500" />
                Nessuna risposta dalla Knowledge Base
              </Label>
              <p className="text-sm text-muted-foreground">
                Crea ticket quando l'AI non trova informazioni nei documenti
              </p>
            </div>
            <Switch
              checked={settings.autoCreateTicketOnNoAnswer}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, autoCreateTicketOnNoAnswer: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-red-500" />
                Alta Urgenza
              </Label>
              <p className="text-sm text-muted-foreground">
                Crea ticket per email classificate come urgenti
              </p>
            </div>
            <Switch
              checked={settings.autoCreateTicketOnHighUrgency}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, autoCreateTicketOnHighUrgency: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                Sentiment Negativo
              </Label>
              <p className="text-sm text-muted-foreground">
                Crea ticket per email con tono negativo o lamentele
              </p>
            </div>
            <Switch
              checked={settings.autoCreateTicketOnNegativeSentiment}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, autoCreateTicketOnNegativeSentiment: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salva Impostazioni
        </Button>
      </div>
    </div>
  );
}
