import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, X, Compass, GitBranch, Loader2, Check, RefreshCw, ChevronDown, FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Node, Edge } from "@xyflow/react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  funnel?: { name: string; nodes: Node[]; edges: Edge[] } | null;
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

function isHtmlContent(text: string): boolean {
  const htmlTagsPattern = /<(p|div|h1|h2|h3|h4|h5|h6|ul|ol|li|strong|em|br|hr)[^>]*>/gi;
  const matches = text.match(htmlTagsPattern);
  return matches !== null && matches.length > 3;
}

function sanitizeAndFormatHtml(html: string): string {
  let cleaned = html.replace(/<!--StartFragment-->|<!--EndFragment-->/g, '');
  cleaned = cleaned.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-6">$1</h1>');
  cleaned = cleaned.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3 mt-5">$1</h2>');
  cleaned = cleaned.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-4">$1</h3>');
  cleaned = cleaned.replace(/<p[^>]*>/gi, '<p class="text-gray-800 dark:text-gray-200 mb-3 leading-relaxed">');
  cleaned = cleaned.replace(/<strong[^>]*>/gi, '<strong class="font-bold text-gray-900 dark:text-white">');
  cleaned = cleaned.replace(/<em[^>]*>/gi, '<em class="italic text-gray-700 dark:text-gray-300">');
  cleaned = cleaned.replace(/<ul[^>]*>/gi, '<ul class="list-disc list-inside mb-3 space-y-1 ml-4">');
  cleaned = cleaned.replace(/<ol[^>]*>/gi, '<ol class="list-decimal list-inside mb-3 space-y-1 ml-4">');
  cleaned = cleaned.replace(/<li[^>]*>/gi, '<li class="text-gray-800 dark:text-gray-200">');
  cleaned = cleaned.replace(/<a\s+href="([^"]+)"[^>]*>/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">');
  return cleaned;
}

function preprocessContent(content: string): string {
  let processed = content
    .replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '')
    .replace(/\[\/ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '')
    .replace(/\{"actions":\s*\[[\s\S]*?\]\}/gi, '')
    .replace(/\[\/ACTIONS\]/gi, '')
    .replace(/\[FUNNEL_START\][\s\S]*?\[FUNNEL_END\]/gi, '');

  processed = processed.replace(
    /^(💡|⚠️|ℹ️|✅|📊)\s*(.+)$/gm,
    (_, emoji, text) => `> ${emoji} ${text}`
  );

  return processed.trim();
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractText(props.children);
  }
  return '';
}

const INFO_BOX_CONFIG: Record<string, { bg: string; border: string; textColor: string; label: string }> = {
  '💡': { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-400', textColor: 'text-amber-900 dark:text-amber-100', label: 'Suggerimento' },
  '⚠️': { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-400', textColor: 'text-red-900 dark:text-red-100', label: 'Attenzione' },
  'ℹ️': { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-400', textColor: 'text-blue-900 dark:text-blue-100', label: 'Informazione' },
  '✅': { bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-400', textColor: 'text-green-900 dark:text-green-100', label: 'Completato' },
  '📊': { bg: 'bg-slate-50 dark:bg-slate-900/40', border: 'border-slate-400', textColor: 'text-slate-700 dark:text-slate-300', label: 'Nota Analitica' },
};

const InfoBoxRenderer: Components['blockquote'] = ({ children }) => {
  const textContent = extractText(children).trim();
  const matchedEmoji = Object.keys(INFO_BOX_CONFIG).find(emoji => textContent.startsWith(emoji));
  if (matchedEmoji) {
    const config = INFO_BOX_CONFIG[matchedEmoji];
    const bodyText = textContent.slice(matchedEmoji.length).trim();
    return (
      <div className={`my-3 p-3.5 ${config.bg} border-l-4 ${config.border} rounded-r-lg`}>
        <div className="flex items-start gap-2.5">
          <span className="text-lg flex-shrink-0">{matchedEmoji}</span>
          <div>
            <div className={`font-semibold text-xs uppercase tracking-wide mb-0.5 opacity-60 ${config.textColor}`}>{config.label}</div>
            <div className={`text-sm leading-relaxed ${config.textColor}`}>{bodyText}</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <blockquote className="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-3 text-gray-600 dark:text-gray-400">{children}</blockquote>
  );
};

const LinkRenderer: Components['a'] = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 font-medium">{children}</a>
);

const CodeRenderer: Components['code'] = ({ className, children }) => {
  const isBlock = !!className;
  if (isBlock) return <code className="text-slate-100 font-mono text-sm">{children}</code>;
  const text = String(children);
  const isNavPath = text.includes('→') || text.includes('>');
  if (isNavPath) {
    const segments = text.split(/\s*[→>]\s*/);
    return (
      <code className="inline-flex items-center gap-0.5 px-2 py-1 mx-0.5 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border border-violet-200/80 dark:border-violet-700/50 rounded-lg text-xs font-semibold text-violet-700 dark:text-violet-300 shadow-sm">
        {segments.map((seg, i) => (
          <span key={i} className="inline-flex items-center gap-0.5">
            {i > 0 && <span className="text-violet-400 dark:text-violet-500 mx-0.5">›</span>}
            <span className="px-1 py-0.5 bg-white/60 dark:bg-white/5 rounded">{seg.trim()}</span>
          </span>
        ))}
      </code>
    );
  }
  return (
    <code className="px-2 py-0.5 mx-0.5 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 border border-indigo-200/80 dark:border-indigo-700/50 rounded-md text-[13px] font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-100/50 dark:ring-indigo-800/30">{children}</code>
  );
};

const PreRenderer: Components['pre'] = ({ children }) => (
  <pre className="my-3 p-4 bg-slate-900 dark:bg-slate-950 rounded-lg overflow-x-auto text-sm leading-relaxed">{children}</pre>
);

const MARKDOWN_COMPONENTS: Components = {
  blockquote: InfoBoxRenderer,
  a: LinkRenderer,
  code: CodeRenderer,
  pre: PreRenderer,
};

function FunnelPreviewCard({ funnel, onApply, onRegenerate }: {
  funnel: { name: string; nodes: Node[]; edges: Edge[] };
  onApply: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="my-3 p-4 rounded-xl border border-cyan-200 dark:border-cyan-800/50 bg-gradient-to-br from-cyan-50/80 to-teal-50/60 dark:from-cyan-950/30 dark:to-teal-950/20 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
          <GitBranch className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900 dark:text-white">{funnel.name}</p>
          <p className="text-xs text-muted-foreground">{funnel.nodes.length} nodi · {funnel.edges.length} connessioni</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={onApply} className="flex-1 h-8 text-xs bg-gradient-to-r from-cyan-500 to-teal-600 text-white hover:from-cyan-600 hover:to-teal-700 gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Applica al Canvas
        </Button>
        <Button size="sm" variant="outline" onClick={onRegenerate} className="h-8 text-xs gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Rigenera
        </Button>
      </div>
    </div>
  );
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

export function FunnelChat({ open, onClose, onApplyFunnel, currentFunnelContext }: FunnelChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

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
  };

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

  const sendMessage = async () => {
    const text = input.trim();
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
    setInput("");
    setSending(true);

    const assistantId = `assistant_${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", funnel: null },
    ]);

    try {
      const res = await fetch("/api/ai-autonomy/agent-chat/architetto/send", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: fullMessage }),
      });

      if (!res.ok) {
        throw new Error("Errore nella risposta");
      }

      const data = await res.json();
      const aiMessage = data.response?.message || "Mi dispiace, non sono riuscito a generare una risposta.";
      const funnel = extractFunnelFromContent(aiMessage);

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, content: aiMessage, funnel } : m
        )
      );
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: "Errore nella comunicazione con l'AI. Riprova." }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
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

        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] flex items-end gap-2">
                  <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-br-md px-4 py-3 shadow-sm border border-slate-200/50 dark:border-slate-600/30">
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                  </div>
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                </div>
              </div>
            );
          }

          const content = msg.content || "";
          const isCurrentlySending = sending && msg.id === messages[messages.length - 1]?.id && msg.role === "assistant";

          return (
            <div key={msg.id} className="flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-sm">
                  <Compass className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-xs leading-tight">Leonardo</p>
                  <p className="text-[10px] text-cyan-600 dark:text-cyan-400 leading-tight">Architetto dei Funnel</p>
                </div>
              </div>

              <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                {content ? (
                  <div className="ai-content">
                    {isHtmlContent(content) ? (
                      <div dangerouslySetInnerHTML={{ __html: sanitizeAndFormatHtml(content) }} />
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSanitize]}
                        components={MARKDOWN_COMPONENTS}
                      >
                        {preprocessContent(content)}
                      </ReactMarkdown>
                    )}
                  </div>
                ) : isCurrentlySending ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-muted-foreground">Leonardo sta progettando...</span>
                  </div>
                ) : null}

                {msg.funnel && (
                  <FunnelPreviewCard
                    funnel={msg.funnel}
                    onApply={() => onApplyFunnel(msg.funnel!.name, msg.funnel!.nodes, msg.funnel!.edges)}
                    onRegenerate={() => {
                      setInput("Rigeneralo con delle modifiche");
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 px-3 pb-3 pt-2">
        <div className="relative bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-md hover:shadow-lg transition-all duration-300 focus-within:border-cyan-400/40 dark:focus-within:border-cyan-500/40 focus-within:shadow-cyan-500/10 focus-within:bg-white dark:focus-within:bg-slate-800">
          <div className="px-3 pt-2.5 pb-1.5">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sending ? "Leonardo sta elaborando..." : "Descrivi il tuo funnel ideale..."}
              disabled={sending}
              className="resize-none min-h-[44px] max-h-[100px] bg-transparent border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 p-0 shadow-none"
              rows={1}
            />
          </div>
          <div className="flex items-center justify-end px-2.5 pb-2.5 pt-0.5">
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              size="sm"
              className="h-8 w-8 p-0 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 disabled:from-slate-200 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-600 transition-all"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 text-white" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
