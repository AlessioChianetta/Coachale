import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Compass, GitBranch, ChevronDown, FileText, Check, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import { InputArea } from "@/components/ai-assistant/InputArea";
import { Message } from "@/components/ai-assistant/Message";
import type { Node, Edge } from "@xyflow/react";
import archieAvatarSrc from "@assets/generated_images/archie_ai_builder_avatar.png";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isThinking?: boolean;
  funnel?: { name: string; nodes: Node[]; edges: Edge[] } | null;
  applied?: boolean;
  created_at?: string;
}

interface ContentTemplate {
  id: string;
  name: string;
  topic: string;
  targetAudience: string;
  objective: string;
  marketResearchData?: any;
}

interface FunnelChatProps {
  open: boolean;
  onClose: () => void;
  onApplyFunnel: (name: string, nodes: Node[], edges: Edge[]) => void;
  currentFunnelContext?: { id: string; name: string; nodes: Node[]; edges: Edge[] } | null;
}

function stripFunnelBlock(content: string): string {
  return content.replace(/\[FUNNEL_START\][\s\S]*?\[FUNNEL_END\]/gi, '').trim();
}

function extractFunnelFromContent(content: string): { name: string; nodes: Node[]; edges: Edge[] } | null {
  const match = content.match(/\[FUNNEL_START\]([\s\S]*?)\[FUNNEL_END\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    const validCategories = ["sorgenti", "cattura", "gestione", "comunicazione", "conversione", "delivery", "custom"];

    const getCategoryForType = (type: string): string => {
      const map: Record<string, string> = {
        facebook_ads: "sorgenti", google_ads: "sorgenti", instagram_ads: "sorgenti", tiktok_ads: "sorgenti", offline_referral: "sorgenti", organic: "sorgenti",
        landing_page: "cattura", form_modulo: "cattura", lead_magnet: "cattura", webhook: "cattura",
        import_excel: "gestione", crm_hunter: "gestione", setter_ai: "gestione",
        whatsapp: "comunicazione", email: "comunicazione", voice_call: "comunicazione", sms: "comunicazione", instagram_dm: "comunicazione",
        appuntamento: "conversione", prima_call: "conversione", seconda_call: "conversione", chiusura: "conversione", pagamento: "conversione",
        onboarding: "delivery", servizio: "delivery", followup: "delivery",
      };
      return map[type] || "custom";
    };

    const nodes = (parsed.nodes || []).map((n: any) => {
      const nodeType = n.type || "custom_step";
      const rawCategory = n.data?.category;
      const category = validCategories.includes(rawCategory) ? rawCategory : getCategoryForType(nodeType);
      return {
        id: n.id || `node_${Math.random().toString(36).substr(2, 9)}`,
        type: "funnelNode",
        position: n.position || { x: 0, y: 0 },
        data: {
          nodeType,
          type: nodeType,
          category,
          label: n.data?.label || "Step",
          subtitle: n.data?.subtitle || "",
          notes: "",
          conversionRate: null,
          linkedEntity: null,
          linkedEntities: [],
          linkedEntityName: n.data?.linkedEntityName || null,
        },
      };
    });

    const edges = (parsed.edges || []).map((e: any) => ({
      id: e.id || `edge_${Math.random().toString(36).substr(2, 9)}`,
      source: e.source,
      target: e.target,
      type: "funnelEdge",
      data: { label: e.label || e.data?.label || "" },
    }));

    return { name: parsed.name || "Funnel Generato", nodes, edges };
  } catch {
    return null;
  }
}

function FunnelPreviewCard({ funnel, onApply, onRegenerate, applied }: {
  funnel: { name: string; nodes: Node[]; edges: Edge[] };
  onApply: () => void;
  onRegenerate: () => void;
  applied?: boolean;
}) {
  return (
    <div className={cn(
      "mt-3 p-4 rounded-xl border shadow-sm",
      applied
        ? "border-green-200 dark:border-green-800/50 bg-gradient-to-br from-green-50/80 to-emerald-50/60 dark:from-green-950/30 dark:to-emerald-950/20"
        : "border-cyan-200 dark:border-cyan-800/50 bg-gradient-to-br from-cyan-50/80 to-teal-50/60 dark:from-cyan-950/30 dark:to-teal-950/20"
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center",
          applied ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-cyan-500 to-teal-600"
        )}>
          {applied ? <Check className="h-4 w-4 text-white" /> : <GitBranch className="h-4 w-4 text-white" />}
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900 dark:text-white">{funnel.name}</p>
          <p className="text-xs text-muted-foreground">{funnel.nodes.length} nodi · {funnel.edges.length} connessioni</p>
        </div>
        {applied && (
          <span className="ml-auto text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
            Attivo sul canvas
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        {applied ? (
          <div className="flex-1 h-8 flex items-center justify-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
            <Check className="h-3.5 w-3.5" />
            Funnel applicato al canvas
          </div>
        ) : (
          <Button size="sm" onClick={onApply} className="flex-1 h-8 text-xs bg-gradient-to-r from-cyan-500 to-teal-600 text-white hover:from-cyan-600 hover:to-teal-700 gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Applica al Canvas
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onRegenerate} className="h-8 text-xs gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Rigenera
        </Button>
      </div>
    </div>
  );
}

export function FunnelChat({ open, onClose, onApplyFunnel, currentFunnelContext }: FunnelChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [linkedTemplateLoaded, setLinkedTemplateLoaded] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (open) {
      loadMessages();
      loadTemplates();
      loadLinkedTemplate();
    }
  }, [open]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-autonomy/agent-chat/architetto/messages", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const loaded: ChatMessage[] = (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.sender === "consultant" ? "user" : "assistant",
          content: m.message || "",
          funnel: m.sender === "agent" ? extractFunnelFromContent(m.message || "") : null,
          created_at: m.created_at,
        }));
        setMessages(loaded);
      }
    } catch {}
    setLoading(false);
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/content/idea-templates", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.data || []);
      }
    } catch {}
    setLoadingTemplates(false);
  };

  const loadLinkedTemplate = async () => {
    try {
      const res = await fetch("/api/ai-autonomy/agent-context/architetto/template", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedTemplateId(data.linkedTemplateId || null);
      }
    } catch {}
    setLinkedTemplateLoaded(true);
  };

  useEffect(() => {
    if (linkedTemplateLoaded && templates.length > 0 && selectedTemplateId === null) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, linkedTemplateLoaded]);

  const saveLinkedTemplate = async (templateId: string | null) => {
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/ai-autonomy/agent-context/architetto/template", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (res.ok) {
        setSelectedTemplateId(templateId);
      }
    } catch {}
    setSavingTemplate(false);
  };

  const sendSystemNotification = useCallback(async (text: string, funnelName: string) => {
    const systemMsg: ChatMessage = {
      id: `system_${Date.now()}`,
      role: "system",
      content: funnelName,
    };
    const assistantId = `assistant_${Date.now() + 1}`;
    setMessages(prev => [
      ...prev,
      systemMsg,
      { id: assistantId, role: "assistant", content: "", isThinking: true, funnel: null },
    ]);
    setSending(true);
    try {
      const res = await fetch("/api/ai-autonomy/agent-chat/architetto/send", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const aiMessage = data.response?.message || "";
      const extractedFunnel = extractFunnelFromContent(aiMessage);
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: aiMessage, isThinking: false, funnel: extractedFunnel } : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    }
    setSending(false);
  }, []);

  const handleApplyFunnel = useCallback((msgId: string, funnel: { name: string; nodes: Node[]; edges: Edge[] }) => {
    onApplyFunnel(funnel.name, funnel.nodes, funnel.edges);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, applied: true } : m));
    const notifica = `[SISTEMA] Ho appena applicato il funnel "${funnel.name}" al canvas (${funnel.nodes.length} nodi, ${funnel.edges.length} connessioni). Da questo momento è attivo. Posso chiederti modifiche quando voglio.`;
    sendSystemNotification(notifica, funnel.name);
  }, [onApplyFunnel, sendSystemNotification]);

  const sendMessage = async (text: string) => {
    if (!text || sending) return;

    let fullMessage = text;
    if (currentFunnelContext) {
      const funnelCtx = JSON.stringify({
        name: currentFunnelContext.name,
        nodes: currentFunnelContext.nodes.map((n: any) => ({
          id: n.id,
          type: n.data?.nodeType || n.data?.type,
          label: n.data?.label,
          subtitle: n.data?.subtitle,
          category: n.data?.category,
        })),
        edges: currentFunnelContext.edges.map((e: any) => ({
          source: e.source,
          target: e.target,
        })),
      });
      fullMessage = `[CONTESTO FUNNEL ATTUALE]\n${funnelCtx}\n[FINE CONTESTO]\n\n${text}`;
    }

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    const assistantId = `assistant_${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", isThinking: true, funnel: null },
    ]);

    try {
      const res = await fetch("/api/ai-autonomy/agent-chat/architetto/send", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: fullMessage }),
      });

      if (!res.ok) throw new Error("Errore nella risposta");

      const data = await res.json();
      const aiMessage = data.response?.message || "Mi dispiace, non sono riuscito a generare una risposta.";
      const funnel = extractFunnelFromContent(aiMessage);

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, content: aiMessage, isThinking: false, funnel } : m
        )
      );
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: "Errore nella comunicazione con l'AI. Riprova.", isThinking: false }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  if (!open) return null;

  return (
    <div className="w-[380px] border-l border-border/60 bg-card flex flex-col h-full flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-sm">
            <Compass className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground leading-tight">Leonardo</p>
            <p className="text-xs text-cyan-600 dark:text-cyan-400 leading-tight">Architetto dei Funnel</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 py-2 border-b border-border/40 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-full h-auto py-1.5 px-2.5 justify-between text-left",
                selectedTemplate && "border-cyan-300 dark:border-cyan-700"
              )}
              disabled={savingTemplate}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="h-3.5 w-3.5 flex-shrink-0 text-cyan-500" />
                <div className="min-w-0 flex-1">
                  {selectedTemplate ? (
                    <>
                      <p className="text-xs font-medium truncate">{selectedTemplate.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {selectedTemplate.topic} · {selectedTemplate.targetAudience?.substring(0, 30)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Seleziona template Content Studio...</p>
                  )}
                </div>
              </div>
              <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[340px]">
            {selectedTemplateId && (
              <>
                <DropdownMenuItem
                  onClick={() => saveLinkedTemplate(null)}
                  className="text-xs text-muted-foreground"
                >
                  Nessun template (contesto generico)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {templates.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {loadingTemplates ? "Caricamento..." : "Nessun template salvato nel Content Studio"}
              </div>
            )}
            {templates.map(t => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => saveLinkedTemplate(t.id)}
                className={cn("text-xs flex flex-col items-start gap-0.5", t.id === selectedTemplateId && "bg-cyan-50 dark:bg-cyan-950/30")}
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {t.topic} · {t.targetAudience?.substring(0, 40)}
                  {t.marketResearchData ? " · Ricerca di mercato" : ""}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 flex items-center justify-center border border-cyan-500/20 mb-3">
              <Compass className="w-6 h-6 text-cyan-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Leonardo — Architetto dei Funnel</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[260px] mx-auto">
              Descrivi il tuo business e ti aiuterò a progettare il funnel perfetto
            </p>
            {selectedTemplate && (
              <p className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-2">
                Contesto attivo: {selectedTemplate.name}
              </p>
            )}
          </div>
        ) : null}

        <div className="space-y-4">
          {messages.map((msg) => {
            if (msg.role === "system") {
              return (
                <div key={msg.id} className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-green-200 dark:bg-green-800/40" />
                  <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                    <Check className="h-3 w-3" />
                    Funnel &ldquo;{msg.content}&rdquo; applicato al canvas
                  </span>
                  <div className="flex-1 h-px bg-green-200 dark:bg-green-800/40" />
                </div>
              );
            }
            let displayContent = msg.role === "assistant" ? stripFunnelBlock(msg.content) : msg.content;
            if (msg.role === "user") {
              displayContent = displayContent.replace(/\[CONTESTO FUNNEL ATTUALE\][\s\S]*?\[FINE CONTESTO\]\s*/g, "").trim();
            }
            return (
              <div key={msg.id}>
                <Message
                  message={{
                    id: msg.id,
                    role: msg.role as "user" | "assistant",
                    content: displayContent,
                    isThinking: msg.isThinking,
                  }}
                  assistantName="Leonardo"
                  assistantSubtitle="Architetto dei Funnel"
                  assistantAvatarSrc={archieAvatarSrc}
                  assistantAvatarFallbackIcon={<Compass className="h-4 w-4 text-white" />}
                />
                {msg.role === "assistant" && msg.funnel && (
                  <FunnelPreviewCard
                    funnel={msg.funnel}
                    applied={msg.applied}
                    onApply={() => handleApplyFunnel(msg.id, msg.funnel!)}
                    onRegenerate={() => sendMessage("Rigeneralo con delle modifiche")}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 px-3 pb-3 pt-1">
        <InputArea
          onSend={(text) => sendMessage(text)}
          isProcessing={sending}
          disabled={sending}
        />
      </div>
    </div>
  );
}
