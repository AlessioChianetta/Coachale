import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Send, Check, X, Trash2, MessageCircle, Users, Link2, Unlink, ChevronUp, ChevronDown, Copy, Shield, Globe } from "lucide-react";
import { motion } from "framer-motion";

interface TelegramConfigProps {
  roleId: string;
  roleName: string;
}

interface TelegramChat {
  chat_id: number | string;
  title?: string;
  type: string;
  username?: string;
  linked_at?: string;
}

interface TelegramConfigData {
  bot_token?: string;
  enabled?: boolean;
  group_support?: boolean;
  open_mode?: boolean;
  bot_username?: string;
  bot_name?: string;
  connected?: boolean;
  linked_chats?: TelegramChat[];
}

export default function TelegramConfig({ roleId, roleName }: TelegramConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [botToken, setBotToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [groupSupport, setGroupSupport] = useState(false);
  const [openMode, setOpenMode] = useState(false);
  const [connected, setConnected] = useState(false);
  const [botUsername, setBotUsername] = useState("");
  const [botName, setBotName] = useState("");
  const [linkedChats, setLinkedChats] = useState<TelegramChat[]>([]);
  const [maskedToken, setMaskedToken] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [copied, setCopied] = useState(false);

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadConfig = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-config/${roleId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const cfg = data.config;
        if (cfg) {
          if (cfg.bot_token_masked) {
            setMaskedToken(cfg.bot_token_masked);
          }
          setEnabled(cfg.enabled ?? false);
          setGroupSupport(cfg.group_support ?? false);
          setOpenMode(cfg.open_mode ?? false);
          setConnected(true);
          setBotUsername(cfg.bot_username || "");
          setBotName(cfg.bot_name || "");
          setActivationCode(cfg.activation_code || "");
        }
        setLinkedChats(data.linkedChats || []);
      }
    } catch {}
    setLoading(false);
    setLoaded(true);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) loadConfig();
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-config/${roleId}/test`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: botToken }),
      });
      if (res.ok) {
        const data = await res.json();
        setBotUsername(data.username || data.bot_username || "");
        setBotName(data.name || data.bot_name || "");
        setTestResult({ success: true, message: `Connessione riuscita! @${data.username || data.bot_username || "bot"}` });
      } else {
        const err = await res.json().catch(() => ({}));
        setTestResult({ success: false, message: err.error || "Errore di connessione" });
      }
    } catch {
      setTestResult({ success: false, message: "Errore di connessione" });
    }
    setTesting(false);
  };

  const saveConfig = async (overrides?: { enabled?: boolean; group_support?: boolean; open_mode?: boolean }) => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-config/${roleId}`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_token: botToken,
          enabled: overrides?.enabled ?? enabled,
          group_support: overrides?.group_support ?? groupSupport,
          open_mode: overrides?.open_mode ?? openMode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaveResult({ success: true, message: "Configurazione salvata" });
        setConnected(true);
        setMaskedToken(botToken);
        setActivationCode(data.config?.activation_code || "");
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveResult({ success: false, message: err.error || "Errore nel salvataggio" });
      }
    } catch {
      setSaveResult({ success: false, message: "Errore nel salvataggio" });
    }
    setSaving(false);
  };

  const saveToggle = async (field: string, value: boolean) => {
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-config/${roleId}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setSaveResult({ success: true, message: "Salvato" });
        setTimeout(() => setSaveResult(null), 2000);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveResult({ success: false, message: err.error || "Errore nel salvataggio" });
      }
    } catch {
      setSaveResult({ success: false, message: "Errore nel salvataggio" });
    }
  };

  const deleteConfig = async () => {
    if (!confirm(`Vuoi rimuovere la configurazione Telegram per ${roleName}?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-config/${roleId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setBotToken("");
        setMaskedToken("");
        setEnabled(false);
        setGroupSupport(false);
        setOpenMode(false);
        setConnected(false);
        setBotUsername("");
        setBotName("");
        setLinkedChats([]);
        setTestResult(null);
        setSaveResult(null);
      }
    } catch {}
    setDeleting(false);
  };

  const getChatTypeLabel = (type: string) => {
    switch (type) {
      case "private": return "Privata";
      case "group": return "Gruppo";
      case "supergroup": return "Supergruppo";
      case "channel": return "Canale";
      default: return type;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8" onClick={(e) => e.stopPropagation()}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" onClick={(e) => e.stopPropagation()}>

      {/* Connection Status Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            connected ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-gray-100 dark:bg-gray-800"
          )}>
            <Send className={cn("h-5 w-5", connected ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400")} />
          </div>
          <div>
            <p className="text-sm font-semibold">Telegram Bot</p>
            <p className="text-xs text-muted-foreground">
              {connected ? `@${botUsername} · Connesso` : "Non configurato"}
            </p>
          </div>
        </div>
        {connected ? (
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 rounded-full">
            <Check className="h-3 w-3 mr-1" />
            Connesso
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 text-muted-foreground rounded-full">
            Non connesso
          </Badge>
        )}
      </div>

      {/* Setup Guide (when not connected) */}
      {!connected && (
        <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-blue-50/30 to-white dark:from-blue-950/10 dark:to-gray-900/50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-500" />
            <p className="text-sm font-semibold">Come configurare il bot Telegram</p>
          </div>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside leading-relaxed">
            <li>Apri Telegram e cerca <code className="font-mono bg-blue-100/50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md text-foreground">@BotFather</code></li>
            <li>Scrivi <code className="font-mono bg-blue-100/50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md text-foreground">/newbot</code> e segui le istruzioni per creare il bot</li>
            <li>BotFather ti darà un <strong className="text-foreground">token</strong> — copialo</li>
            <li>Incollalo qui sotto nel campo "Token Bot" e clicca "Salva Configurazione"</li>
            <li>Apparirà un <strong className="text-foreground">codice di attivazione</strong> — copialo</li>
            <li>Apri il tuo bot su Telegram e invia <code className="font-mono bg-blue-100/50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md text-foreground">/attiva CODICE</code></li>
            <li>Fatto! Da quel momento puoi chattare con il dipendente AI via Telegram</li>
          </ol>
        </div>
      )}

      {/* Token Configuration */}
      <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <MessageCircle className="h-4 w-4 text-blue-500" />
          Token Bot
        </Label>
        <div className="space-y-2">
          <Input
            type="text"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            className="h-9 text-xs rounded-xl font-mono"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={testing || !botToken.trim()}
              className="rounded-xl h-9 text-xs"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />}
              Test Connessione
            </Button>
            <Button
              size="sm"
              onClick={() => saveConfig()}
              disabled={saving || !botToken.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs shadow-sm"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Salva Configurazione
            </Button>
          </div>
        </div>

        {testResult && (
          <div className={cn(
            "text-xs px-3 py-2 rounded-xl flex items-center gap-2",
            testResult.success
              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30"
              : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/30"
          )}>
            {testResult.success ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
            {testResult.message}
          </div>
        )}

        {saveResult && (
          <div className={cn(
            "text-xs px-3 py-2 rounded-xl flex items-center gap-2",
            saveResult.success
              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30"
              : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/30"
          )}>
            {saveResult.success ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
            {saveResult.message}
          </div>
        )}
      </div>

      {/* Operational Settings */}
      <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-500" />
          <p className="text-sm font-semibold">Impostazioni Operative</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={`telegram-enabled-${roleId}`} className="text-xs font-medium cursor-pointer">
                Bot Attivo
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Abilita o disabilita le risposte del bot</p>
            </div>
            <Switch
              id={`telegram-enabled-${roleId}`}
              checked={enabled}
              onCheckedChange={(val) => {
                setEnabled(val);
                if (connected) saveToggle('enabled', val);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={`telegram-groups-${roleId}`} className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Supporto Gruppi
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Rispondi a @menzioni nei gruppi</p>
            </div>
            <Switch
              id={`telegram-groups-${roleId}`}
              checked={groupSupport}
              onCheckedChange={(val) => {
                setGroupSupport(val);
                if (connected) saveToggle('group_support', val);
              }}
            />
          </div>

          {groupSupport && (
            <div className="text-xs text-muted-foreground px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl space-y-1.5">
              <p className="font-medium text-amber-700 dark:text-amber-400">Requisiti per i gruppi:</p>
              <p>1. Disattiva la <strong>Group Privacy</strong> su @BotFather: scrivi /setprivacy → seleziona il bot → Disable</p>
              <p>2. Dopo la modifica, <strong>rimuovi il bot dal gruppo e riaggiunggilo</strong></p>
              <p>3. In alternativa, rendi il bot <strong>admin del gruppo</strong></p>
              <p className="italic">Se hai già attivato il bot in chat privata, i gruppi saranno collegati automaticamente.</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={`telegram-openmode-${roleId}`} className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Modalità Aperta
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Chiunque può chattare con il bot</p>
            </div>
            <Switch
              id={`telegram-openmode-${roleId}`}
              checked={openMode}
              onCheckedChange={(val) => {
                setOpenMode(val);
                if (connected) saveToggle('open_mode', val);
              }}
            />
          </div>

          {openMode && (
            <div className="text-xs text-muted-foreground px-3 py-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-xl">
              Il bot risponderà a chiunque. I nuovi utenti faranno un breve onboarding prima di ricevere risposte AI.
            </div>
          )}
        </div>
      </div>

      {/* Activation Code */}
      {!openMode && connected && activationCode && (
        <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-amber-500" />
            Codice di Attivazione
          </Label>
          <div className="flex items-center justify-center gap-3 bg-muted/30 dark:bg-gray-800/50 rounded-xl px-4 py-4 border border-border/30">
            <code className="text-lg font-mono font-bold tracking-[0.3em] text-foreground">{activationCode}</code>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-9 text-xs shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(`/attiva ${activationCode}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5 mr-1.5" /> Copiato</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copia</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Invia <code className="font-mono bg-blue-100/50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md">/attiva {activationCode}</code> al bot su Telegram per collegare la tua chat. Il codice si rigenera dopo l'uso.
          </p>
        </div>
      )}

      {/* Linked Chats */}
      <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Link2 className="h-4 w-4 text-indigo-500" />
          Chat Collegate
        </Label>
        {linkedChats.length === 0 ? (
          <div className="py-6 flex flex-col items-center gap-2">
            <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              Nessuna chat collegata. Usa il codice di attivazione per collegare la tua chat.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedChats.map((chat, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted/50 transition-colors border border-border/20">
                {chat.type === "private" ? (
                  <MessageCircle className="h-4 w-4 text-blue-500 shrink-0" />
                ) : (
                  <Users className="h-4 w-4 text-indigo-500 shrink-0" />
                )}
                <span className="text-xs font-medium truncate flex-1">
                  {chat.username ? `@${chat.username}` : chat.title || `Chat ${chat.chat_id}`}
                </span>
                <Badge variant="outline" className="text-xs px-2 py-0.5 shrink-0 rounded-full">
                  {getChatTypeLabel(chat.type)}
                </Badge>
                {chat.linked_at && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(chat.linked_at)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Configuration */}
      {(maskedToken || connected) && (
        <div className="rounded-2xl border border-red-200/40 dark:border-red-900/20 bg-red-50/30 dark:bg-red-950/10 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-red-700 dark:text-red-400">Rimuovi Configurazione</p>
            <p className="text-xs text-red-600/60 dark:text-red-400/50 mt-0.5">Questa azione disconnetterà il bot Telegram</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteConfig}
            disabled={deleting}
            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-100/50 dark:hover:bg-red-950/30 rounded-xl"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
            Rimuovi
          </Button>
        </div>
      )}
    </div>
  );
}
