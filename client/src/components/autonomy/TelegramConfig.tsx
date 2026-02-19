import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Send, Check, X, Trash2, MessageCircle, Users, Link2, Unlink, ChevronUp, ChevronDown, Copy, Shield } from "lucide-react";
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

  const saveConfig = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/ai-autonomy/telegram-config/${roleId}`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: botToken, enabled, group_support: groupSupport }),
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

  return (
    <div className="border-t pt-3 mt-3" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={toggleOpen}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-2">
          <Send className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs font-semibold">Integrazione Telegram</span>
          {loaded && (
            connected ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                <Check className="h-2.5 w-2.5 mr-0.5" />
                Connesso
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Non connesso
              </Badge>
            )
          )}
        </div>
        {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2 }}
          className="mt-3 space-y-4"
        >
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                  Token Bot
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="h-8 text-xs rounded-lg flex-1 font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testConnection}
                    disabled={testing || !botToken.trim()}
                    className="h-8 text-[10px] rounded-lg shrink-0"
                  >
                    {testing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Link2 className="h-3 w-3 mr-1" />}
                    Test Connessione
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveConfig}
                    disabled={saving || !botToken.trim()}
                    className="h-8 text-[10px] rounded-lg shrink-0"
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                    Salva Configurazione
                  </Button>
                </div>

                {testResult && (
                  <div className={cn(
                    "text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5",
                    testResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30"
                      : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/30"
                  )}>
                    {testResult.success ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {testResult.message}
                  </div>
                )}

                {saveResult && (
                  <div className={cn(
                    "text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5",
                    saveResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30"
                      : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/30"
                  )}>
                    {saveResult.success ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {saveResult.message}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`telegram-enabled-${roleId}`}
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                  <Label htmlFor={`telegram-enabled-${roleId}`} className="text-xs cursor-pointer">
                    Bot Attivo
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`telegram-groups-${roleId}`}
                    checked={groupSupport}
                    onCheckedChange={setGroupSupport}
                  />
                  <Label htmlFor={`telegram-groups-${roleId}`} className="text-xs cursor-pointer flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Supporto Gruppi (rispondi a @menzioni)
                  </Label>
                </div>
              </div>

              {connected && activationCode && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-amber-500" />
                    Codice di Attivazione
                  </Label>
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
                    <code className="text-sm font-mono font-bold tracking-widest text-foreground flex-1">{activationCode}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px] shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(`/attiva ${activationCode}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? (
                        <><Check className="h-3 w-3 mr-1" /> Copiato</>
                      ) : (
                        <><Copy className="h-3 w-3 mr-1" /> Copia</>
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Invia <code className="font-mono bg-muted px-1 rounded">/attiva {activationCode}</code> al bot su Telegram per collegare la tua chat. Il codice si rigenera dopo l'uso.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-indigo-500" />
                  Chat Collegate
                </Label>
                {linkedChats.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground italic py-2 text-center border border-dashed rounded-lg">
                    Nessuna chat collegata. Usa il codice di attivazione per collegare la tua chat.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {linkedChats.map((chat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-2.5 py-1.5">
                        {chat.type === "private" ? (
                          <MessageCircle className="h-3 w-3 text-blue-500 shrink-0" />
                        ) : (
                          <Users className="h-3 w-3 text-indigo-500 shrink-0" />
                        )}
                        <span className="font-medium truncate">
                          {chat.username ? `@${chat.username}` : chat.title || `Chat ${chat.chat_id}`}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                          {getChatTypeLabel(chat.type)}
                        </Badge>
                        {chat.linked_at && (
                          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                            Collegato il {formatDate(chat.linked_at)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(maskedToken || connected) && (
                <div className="pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deleteConfig}
                    disabled={deleting}
                    className="h-7 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
                  >
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                    Rimuovi Configurazione
                  </Button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
