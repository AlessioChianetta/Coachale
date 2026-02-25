import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Bot, Activity, Phone, Mail, MessageSquare, Send,
  Clock, Shield, Zap, Brain, CheckCircle, AlertTriangle,
  XCircle, Info, Loader2, Play,
  Save, BarChart3, ListTodo,
  ChevronLeft, ChevronRight,
  ArrowRight, Cog, ChevronDown, ChevronUp, BookOpen, ExternalLink,
  Eye, Sparkles, Timer, User, Lightbulb, Target, RefreshCw, AlertCircle,
  Plus, Trash2, FileText, Calendar, Flag, Database, Search, GripVertical
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AutonomySettings, SystemStatus, AutonomousLogsResponse, PersonalizzaConfig, KbDocument, RoleStatus } from "./types";
import { DAYS_OF_WEEK, TASK_CATEGORIES, AI_ROLE_PROFILES, AI_ROLE_ACCENT_COLORS, AI_ROLE_CAPABILITIES } from "./constants";
import { getAutonomyLabel, getAutonomyBadgeColor, getCategoryBadge } from "./utils";
import TelegramConfig from "./TelegramConfig";
import TelegramChats from "./TelegramChats";

import type { AgentContext, AgentFocusItem } from "@shared/schema";

const AI_ROLE_NAMES_MAP: Record<string, string> = {
  alessia: 'Alessia', millie: 'Millie', echo: 'Echo', nova: 'Nova',
  stella: 'Stella', iris: 'Iris', marco: 'Marco', hunter: 'Hunter', personalizza: 'Personalizza',
};

const AGENT_AUTO_CONTEXT: Record<string, { label: string; icon: string; items: string[] }[]> = {
  alessia: [
    { label: "Consultazioni", icon: "📋", items: ["Storico consultazioni (completate e programmate)", "Note e trascrizioni delle sessioni"] },
    { label: "Chiamate vocali", icon: "📞", items: ["Chiamate programmate e completate", "Durata, stato e istruzioni delle chiamate"] },
    { label: "Knowledge Base", icon: "📚", items: ["Documenti KB assegnati ad Alessia"] },
  ],
  millie: [
    { label: "Journey Email", icon: "📧", items: ["Progresso journey email per ogni cliente", "Ultime email inviate (oggetto, data, apertura)"] },
    { label: "Log Email", icon: "📨", items: ["Email automatiche degli ultimi 14 giorni"] },
    { label: "Knowledge Base", icon: "📚", items: ["Documenti KB assegnati a Millie"] },
  ],
  echo: [
    { label: "Pipeline Riassunti", icon: "📝", items: ["Consultazioni senza riassunto (ultimi 30gg)", "Riassunti recenti e stato invio"] },
    { label: "Statistiche Pipeline", icon: "📊", items: ["Consultazioni programmate vs completate", "Trascrizioni mancanti, email in bozza/inviate"] },
    { label: "Knowledge Base", icon: "📚", items: ["Documenti KB assegnati a Echo"] },
  ],
  nova: [
    { label: "Contenuti", icon: "📱", items: ["Post recenti (titolo, piattaforma, stato, date)", "Idee contenuto pendenti"] },
    { label: "Knowledge Base", icon: "📚", items: ["Documenti KB assegnati a Nova"] },
  ],
  stella: [
    { label: "WhatsApp", icon: "💬", items: ["Conversazioni attive (telefono, ultimo messaggio, non letti)", "Messaggi recenti degli ultimi 7 giorni"] },
    { label: "Knowledge Base", icon: "📚", items: ["Documenti KB assegnati a Stella"] },
  ],
  iris: [
    { label: "Email Hub", icon: "📥", items: ["Email in arrivo non lette (ultimi 7gg)", "Mittente, oggetto, anteprima"] },
    { label: "Ticket", icon: "🎫", items: ["Ticket aperti/pendenti con priorità e classificazione AI"] },
    { label: "Knowledge Base", icon: "📚", items: ["Documenti KB assegnati a Iris"] },
  ],
  marco: [
    { label: "Agenda", icon: "📅", items: ["Consultazioni prossimi 7 giorni (DB + Google Calendar)", "Stato, durata, note per ogni appuntamento"] },
    { label: "Workload", icon: "⚡", items: ["Task completati (7gg e 30gg)", "Task pendenti in coda"] },
    { label: "Monitoraggio Clienti", icon: "👥", items: ["Limite consultazioni mensili per cliente", "Consultazioni usate vs disponibili", "Gap di scheduling (3 mesi)"] },
    { label: "Task", icon: "✅", items: ["Task personali del consulente (titolo, priorità, scadenza)", "Task clienti da consultazioni (con statistiche per cliente)", "Task scaduti e completamento"] },
    { label: "Knowledge Base", icon: "📚", items: ["Documenti KB assegnati a Marco"] },
  ],
  personalizza: [
    { label: "Consultazioni", icon: "📋", items: ["Consultazioni recenti per contesto"] },
    { label: "Task recenti", icon: "✅", items: ["Task AI recenti generati"] },
    { label: "Knowledge Base", icon: "📚", items: ["Documenti KB assegnati"] },
  ],
};

function AgentContextEditor({ roleId, roleName, kbDocuments }: { roleId: string; roleName: string; kbDocuments: KbDocument[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAutoContext, setShowAutoContext] = useState(false);
  const [ctx, setCtx] = useState<AgentContext>({
    focusPriorities: [],
    customContext: "",
    injectionMode: "system_prompt",
    kbInjectionMode: "system_prompt",
    linkedKbDocumentIds: [],
    reportStyle: "bilanciato",
  });
  const [contacts, setContacts] = useState({ phone: "", email: "", whatsapp: "" });
  const [loaded, setLoaded] = useState(false);
  const [whatsappAgents, setWhatsappAgents] = useState<Array<{ id: string; agentName: string; agentType: string; isActive?: boolean; hasTwilio?: boolean }>>([]);

  const [marcoOpen, setMarcoOpen] = useState(false);
  const [marcoLoaded, setMarcoLoaded] = useState(false);
  const [marcoLoading, setMarcoLoading] = useState(false);
  const [marcoSaving, setMarcoSaving] = useState(false);
  const [marcoCtx, setMarcoCtx] = useState<{ objectives: Array<{ id: string; name: string; deadline: string | null; priority: 'alta' | 'media' | 'bassa' }>; roadmap: string; reportFocus: string }>({
    objectives: [],
    roadmap: "",
    reportFocus: "",
  });

  const loadMarcoContext = async () => {
    if (marcoLoaded) return;
    setMarcoLoading(true);
    try {
      const res = await fetch(`/api/ai-autonomy/marco-context`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMarcoCtx({
          objectives: data.objectives || [],
          roadmap: data.roadmap || "",
          reportFocus: data.reportFocus || "",
        });
      }
    } catch {}
    setMarcoLoading(false);
    setMarcoLoaded(true);
  };

  const saveMarcoContext = async () => {
    setMarcoSaving(true);
    try {
      const currentRes = await fetch(`/api/ai-autonomy/marco-context`, { headers: getAuthHeaders() });
      const currentData = currentRes.ok ? await currentRes.json() : {};

      const merged = {
        ...currentData,
        objectives: marcoCtx.objectives,
        roadmap: marcoCtx.roadmap,
        reportFocus: marcoCtx.reportFocus,
      };

      const res = await fetch(`/api/ai-autonomy/marco-context`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (res.ok) toast({ title: "Salvato", description: "Strategia Marco aggiornata" });
      else toast({ title: "Errore", description: "Salvataggio fallito", variant: "destructive" });
    } catch {
      toast({ title: "Errore", description: "Salvataggio fallito", variant: "destructive" });
    }
    setMarcoSaving(false);
  };

  const toggleMarcoSection = () => {
    const next = !marcoOpen;
    setMarcoOpen(next);
    if (next) loadMarcoContext();
  };

  const addObjective = () => {
    setMarcoCtx(prev => ({
      ...prev,
      objectives: [...prev.objectives, { id: crypto.randomUUID(), name: "", deadline: null, priority: "media" }],
    }));
  };

  const removeObjective = (id: string) => {
    setMarcoCtx(prev => ({
      ...prev,
      objectives: prev.objectives.filter(o => o.id !== id),
    }));
  };

  const loadContext = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const [ctxRes, agentsRes] = await Promise.all([
        fetch(`/api/ai-autonomy/agent-context/${roleId}`, { headers: getAuthHeaders() }),
        fetch(`/api/whatsapp/agent-chat/agents`, { headers: getAuthHeaders() }),
      ]);
      if (ctxRes.ok) {
        const data = await ctxRes.json();
        setCtx(data.context || { focusPriorities: [], customContext: "", injectionMode: "system_prompt", linkedKbDocumentIds: [], reportStyle: "bilanciato" });
        setContacts({ phone: data.consultantPhone || "", email: data.consultantEmail || "", whatsapp: data.consultantWhatsapp || "" });
      }
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setWhatsappAgents(Array.isArray(agentsData) ? agentsData : (agentsData.data || agentsData.agents || []));
      }
    } catch {}
    setLoading(false);
    setLoaded(true);
  };

  const saveContext = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-autonomy/agent-context/${roleId}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ context: ctx, consultantPhone: contacts.phone, consultantEmail: contacts.email, consultantWhatsapp: contacts.whatsapp }),
      });
      if (res.ok) toast({ title: "Salvato", description: `Contesto di ${roleName} aggiornato` });
      else toast({ title: "Errore", description: "Salvataggio fallito", variant: "destructive" });
    } catch {
      toast({ title: "Errore", description: "Salvataggio fallito", variant: "destructive" });
    }
    setSaving(false);
  };

  const addFocus = () => {
    setCtx(prev => ({
      ...prev,
      focusPriorities: [...prev.focusPriorities, { id: crypto.randomUUID(), text: "", order: prev.focusPriorities.length + 1 }],
    }));
  };

  const removeFocus = (id: string) => {
    setCtx(prev => ({
      ...prev,
      focusPriorities: prev.focusPriorities.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i + 1 })),
    }));
  };

  const moveFocus = (idx: number, dir: -1 | 1) => {
    setCtx(prev => {
      const items = [...prev.focusPriorities];
      const target = idx + dir;
      if (target < 0 || target >= items.length) return prev;
      [items[idx], items[target]] = [items[target], items[idx]];
      return { ...prev, focusPriorities: items.map((f, i) => ({ ...f, order: i + 1 })) };
    });
  };

  useEffect(() => {
    loadContext();
  }, []);

  const hasFocusItems = ctx.focusPriorities.length > 0;
  const hasKbDocs = ctx.linkedKbDocumentIds.length > 0;
  const hasCustomCtx = !!ctx.customContext.trim();
  const summaryParts: string[] = [];
  if (hasFocusItems) summaryParts.push(`${ctx.focusPriorities.length} priorità`);
  if (hasKbDocs) summaryParts.push(`${ctx.linkedKbDocumentIds.length} doc KB`);
  if (hasCustomCtx) summaryParts.push("contesto custom");
  if (hasKbDocs) {
    const kbMode = ctx.kbInjectionMode || 'system_prompt';
    summaryParts.push(kbMode === 'file_search' ? 'KB:FS' : 'KB:SP');
  }
  const summaryText = summaryParts.length > 0 ? summaryParts.join(" · ") : "Nessun contesto configurato";

  const autoContextItems = AGENT_AUTO_CONTEXT[roleId] || [];

  return (
    <div className="space-y-6" onClick={(e) => e.stopPropagation()}>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {autoContextItems.length > 0 && (
                <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-emerald-50/30 to-white dark:from-emerald-950/10 dark:to-gray-900/50 p-5 space-y-3">
                  <button
                    onClick={() => setShowAutoContext(!showAutoContext)}
                    className="w-full flex items-center justify-between"
                  >
                    <Label className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer">
                      <Eye className="h-4 w-4 text-emerald-500" />
                      Dati che {roleName} legge automaticamente
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{autoContextItems.length} fonti</span>
                      {showAutoContext ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </button>
                  {showAutoContext && (
                    <div className="space-y-3">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Questi dati vengono letti dal database ad ogni ciclo di analisi. Non devi inserirli manualmente.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {autoContextItems.map((group) => (
                          <div key={group.label} className="bg-white/70 dark:bg-gray-900/50 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900/30">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-sm">{group.icon}</span>
                              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{group.label}</span>
                            </div>
                            <ul className="space-y-0.5">
                              {group.items.map((item, i) => (
                                <li key={i} className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 flex items-start gap-1">
                                  <span className="text-emerald-400 mt-[1px] shrink-0">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Flag className="h-4 w-4 text-indigo-500" />
                    Priorità di focus (in ordine)
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={addFocus} className="h-8 text-xs rounded-xl">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground">
                    Su cosa deve concentrarsi {roleName}? L'ordine determina la priorità.
                  </p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium shrink-0">System Prompt</span>
                </div>
                {ctx.focusPriorities.length === 0 ? (
                  <div className="py-8 flex flex-col items-center gap-3 border border-dashed border-border/60 rounded-xl">
                    <Target className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">
                      Nessuna priorità definita — {roleName} seguirà il comportamento predefinito
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={addFocus} className="h-8 text-xs rounded-xl">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Aggiungi priorità
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ctx.focusPriorities.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2 group">
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button onClick={() => moveFocus(idx, -1)} disabled={idx === 0} className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button onClick={() => moveFocus(idx, 1)} disabled={idx === ctx.focusPriorities.length - 1} className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                        <Badge variant="outline" className="text-xs px-1.5 py-0 rounded-lg shrink-0 tabular-nums w-5 justify-center">{idx + 1}</Badge>
                        <Input
                          value={item.text}
                          onChange={(e) => {
                            const updated = [...ctx.focusPriorities];
                            updated[idx] = { ...updated[idx], text: e.target.value };
                            setCtx(prev => ({ ...prev, focusPriorities: updated }));
                          }}
                          placeholder={idx === 0 ? "Es: Aumentare MRR, acquisire 10 nuovi clienti..." : "Es: Ridurre churn, migliorare onboarding..."}
                          className="h-8 text-xs rounded-xl flex-1"
                        />
                        <button onClick={() => removeFocus(item.id)} className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Contesto personalizzato
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">System Prompt</span>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full font-medium tabular-nums",
                      Math.ceil(ctx.customContext.length / 4) > 3000
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        : Math.ceil(ctx.customContext.length / 4) > 2400
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    )}>
                      ~{Math.ceil(ctx.customContext.length / 4).toLocaleString()}/3.000 token
                    </span>
                  </div>
                </div>
                <Textarea
                  value={ctx.customContext}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    const estimatedTokens = Math.ceil(newVal.length / 4);
                    if (estimatedTokens <= 3000) {
                      setCtx(prev => ({ ...prev, customContext: newVal }));
                    }
                  }}
                  placeholder={`Roadmap, note strategiche, istruzioni specifiche per ${roleName}...`}
                  rows={5}
                  className={cn(
                    "rounded-xl text-xs resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    Math.ceil(ctx.customContext.length / 4) > 2400 && "border-amber-300 dark:border-amber-700"
                  )}
                />
                {Math.ceil(ctx.customContext.length / 4) > 2400 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {Math.ceil(ctx.customContext.length / 4) > 3000
                      ? "Limite di 3.000 token raggiunto. Riduci il testo."
                      : "Ti stai avvicinando al limite di 3.000 token."}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-2">
                  <Label className="text-sm font-semibold">Stile report</Label>
                  <Select value={ctx.reportStyle || "bilanciato"} onValueChange={(v) => setCtx(prev => ({ ...prev, reportStyle: v as any }))}>
                    <SelectTrigger className="h-8 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sintetico">Sintetico</SelectItem>
                      <SelectItem value="bilanciato">Bilanciato</SelectItem>
                      <SelectItem value="dettagliato">Dettagliato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              {(() => {
                const connectedAgents = whatsappAgents.filter(a => a.hasTwilio && a.isActive !== false);
                return (
                  <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      Agente WhatsApp predefinito
                    </Label>
                    {connectedAgents.length > 0 ? (
                      <>
                        <Select
                          value={(ctx as any).defaultWhatsappAgentId || "_auto"}
                          onValueChange={(v) => setCtx(prev => ({ ...prev, defaultWhatsappAgentId: v === "_auto" ? undefined : v } as any))}
                        >
                          <SelectTrigger className="h-8 text-xs rounded-xl">
                            <SelectValue placeholder="Automatico" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_auto">Automatico (primo disponibile)</SelectItem>
                            {connectedAgents.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.agentName || a.agentType || a.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          L'agente WhatsApp che {roleName} userà per inviare messaggi.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        {whatsappAgents.length > 0
                          ? "Nessun agente ha Twilio collegato."
                          : "Nessun agente WhatsApp configurato."}
                      </p>
                    )}
                  </div>
                );
              })()}
              </div>

              {kbDocuments.length > 0 && (() => {
                const linkedDocs = kbDocuments.filter(d => ctx.linkedKbDocumentIds.includes(d.id));
                const totalKbTokens = linkedDocs.reduce((sum, d) => sum + Math.ceil((d.file_size || 0) / 4), 0);
                const forcedFileSearch = totalKbTokens > 5000;
                const effectiveKbMode = forcedFileSearch ? 'file_search' : (ctx.kbInjectionMode || 'system_prompt');

                return (
                  <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-blue-500" />
                      Documenti Knowledge Base
                    </Label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-border/40 rounded-xl p-2.5">
                      {kbDocuments.map((doc) => {
                        const isLinked = ctx.linkedKbDocumentIds.includes(doc.id);
                        return (
                          <label key={doc.id} className={cn("flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-colors text-xs", isLinked ? "bg-indigo-50/50 dark:bg-indigo-950/20" : "hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10")}>
                            <Checkbox
                              checked={isLinked}
                              onCheckedChange={(checked) => {
                                setCtx(prev => ({
                                  ...prev,
                                  linkedKbDocumentIds: checked
                                    ? [...prev.linkedKbDocumentIds, doc.id]
                                    : prev.linkedKbDocumentIds.filter(id => id !== doc.id),
                                }));
                              }}
                            />
                            <span className="truncate">{doc.title}</span>
                            <span className="rounded-full px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-medium ml-auto shrink-0">{doc.file_type.toUpperCase()}</span>
                          </label>
                        );
                      })}
                    </div>

                    {ctx.linkedKbDocumentIds.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{ctx.linkedKbDocumentIds.length} documento/i collegato/i</p>
                          <span className="text-[9px] text-muted-foreground tabular-nums">~{totalKbTokens.toLocaleString()} token stimati</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-medium text-muted-foreground shrink-0">Iniezione KB:</Label>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => !forcedFileSearch && setCtx(prev => ({ ...prev, kbInjectionMode: 'system_prompt' }))}
                              disabled={forcedFileSearch}
                              className={cn(
                                "text-xs px-2.5 py-1 rounded-xl border transition-all",
                                effectiveKbMode === 'system_prompt'
                                  ? "border-violet-400 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300 font-semibold"
                                  : "border-gray-200 dark:border-gray-700 text-muted-foreground",
                                forcedFileSearch && "opacity-40 cursor-not-allowed"
                              )}
                            >
                              <Brain className="h-3 w-3 inline mr-0.5" />
                              System Prompt
                            </button>
                            <button
                              onClick={() => setCtx(prev => ({ ...prev, kbInjectionMode: 'file_search' }))}
                              className={cn(
                                "text-xs px-2.5 py-1 rounded-xl border transition-all",
                                effectiveKbMode === 'file_search'
                                  ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-semibold"
                                  : "border-gray-200 dark:border-gray-700 text-muted-foreground"
                              )}
                            >
                              <FileText className="h-3 w-3 inline mr-0.5" />
                              File Search
                            </button>
                          </div>
                        </div>

                        {forcedFileSearch && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            Documenti superiori a 5.000 token — File Search forzato automaticamente
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {roleId === 'marco' && (
                <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
                  <button
                    onClick={toggleMarcoSection}
                    className="w-full flex items-center justify-between"
                  >
                    <Label className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer">
                      <Target className="h-4 w-4 text-orange-500" />
                      🎯 Strategia & Obiettivi
                    </Label>
                    <div className="flex items-center gap-1.5">
                      {marcoLoaded && marcoCtx.objectives.length > 0 && (
                        <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">{marcoCtx.objectives.length} obiettivi</span>
                      )}
                      {marcoOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </button>

                  {marcoOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {marcoLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold flex items-center gap-1.5">
                                <Flag className="h-4 w-4 text-orange-500" />
                                Obiettivi Strategici
                              </Label>
                              <Button type="button" variant="outline" size="sm" onClick={addObjective} className="h-8 text-xs rounded-xl">
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Aggiungi obiettivo
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Definisci gli obiettivi strategici che Marco deve monitorare e su cui basare le analisi.
                            </p>
                            {marcoCtx.objectives.length === 0 ? (
                              <div className="py-6 flex flex-col items-center gap-3 border border-dashed border-border/60 rounded-xl">
                                <Flag className="h-7 w-7 text-muted-foreground/30" />
                                <p className="text-xs text-muted-foreground">
                                  Nessun obiettivo definito — Marco seguirà il comportamento predefinito
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {marcoCtx.objectives.map((obj, idx) => (
                                  <div key={obj.id} className="flex items-center gap-2 group">
                                    <Badge variant="outline" className="text-xs px-1.5 py-0 rounded-lg shrink-0 tabular-nums w-5 justify-center">{idx + 1}</Badge>
                                    <Input
                                      value={obj.name}
                                      onChange={(e) => {
                                        const updated = [...marcoCtx.objectives];
                                        updated[idx] = { ...updated[idx], name: e.target.value };
                                        setMarcoCtx(prev => ({ ...prev, objectives: updated }));
                                      }}
                                      placeholder="Es: Aumentare MRR del 20%"
                                      className="h-8 text-xs rounded-xl flex-1"
                                    />
                                    <Input
                                      type="date"
                                      value={obj.deadline || ""}
                                      onChange={(e) => {
                                        const updated = [...marcoCtx.objectives];
                                        updated[idx] = { ...updated[idx], deadline: e.target.value || null };
                                        setMarcoCtx(prev => ({ ...prev, objectives: updated }));
                                      }}
                                      className="h-8 text-xs rounded-xl w-32 shrink-0"
                                    />
                                    <Select
                                      value={obj.priority}
                                      onValueChange={(v) => {
                                        const updated = [...marcoCtx.objectives];
                                        updated[idx] = { ...updated[idx], priority: v as 'alta' | 'media' | 'bassa' };
                                        setMarcoCtx(prev => ({ ...prev, objectives: updated }));
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs rounded-xl w-24 shrink-0">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="alta">Alta</SelectItem>
                                        <SelectItem value="media">Media</SelectItem>
                                        <SelectItem value="bassa">Bassa</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <button onClick={() => removeObjective(obj.id)} className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <FileText className="h-4 w-4 text-blue-500" />
                              Roadmap / Note Strategiche
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Scrivi la roadmap, le milestone e le note strategiche che Marco deve considerare nelle analisi.
                            </p>
                            <Textarea
                              value={marcoCtx.roadmap}
                              onChange={(e) => setMarcoCtx(prev => ({ ...prev, roadmap: e.target.value }))}
                              placeholder="Es: Q1 2026 — lancio nuovo prodotto. Q2 — espansione mercato tedesco..."
                              rows={4}
                              className="rounded-xl text-xs resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-semibold flex items-center gap-1.5">
                              <Target className="h-4 w-4 text-indigo-500" />
                              Focus Report
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Su cosa Marco deve focalizzare i report e le analisi periodiche.
                            </p>
                            <Input
                              value={marcoCtx.reportFocus}
                              onChange={(e) => setMarcoCtx(prev => ({ ...prev, reportFocus: e.target.value }))}
                              placeholder="Es: Conversioni lead, retention clienti, performance team vendite"
                              className="h-8 text-xs rounded-xl"
                            />
                          </div>

                          <div className="flex justify-end">
                            <Button onClick={saveMarcoContext} disabled={marcoSaving} size="sm" variant="outline" className="h-8 text-xs rounded-xl border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/20">
                              {marcoSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                              Salva Strategia Marco
                            </Button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  I tuoi contatti
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input value={contacts.phone} onChange={(e) => setContacts(p => ({ ...p, phone: e.target.value }))} placeholder="Telefono" className="h-8 text-xs rounded-xl" />
                  <Input value={contacts.whatsapp} onChange={(e) => setContacts(p => ({ ...p, whatsapp: e.target.value }))} placeholder="WhatsApp" className="h-8 text-xs rounded-xl" />
                  <Input value={contacts.email} onChange={(e) => setContacts(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="h-8 text-xs rounded-xl" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveContext} disabled={saving} className="h-10 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salva Contesto
                </Button>
              </div>
            </>
          )}
    </div>
  );
}

const ROLE_GRADIENT_MAP: Record<string, string> = {
  pink: "from-pink-400 to-rose-500",
  purple: "from-purple-400 to-pink-500",
  orange: "from-orange-400 to-amber-500",
  emerald: "from-emerald-400 to-green-500",
  teal: "from-teal-400 to-cyan-500",
  indigo: "from-indigo-400 to-blue-500",
  gray: "from-gray-400 to-gray-500",
};

interface SettingsTabProps {
  settings: AutonomySettings;
  setSettings: React.Dispatch<React.SetStateAction<AutonomySettings>>;
  systemStatus: SystemStatus | undefined;
  loadingSettings: boolean;
  onSave: () => void;
  isSaving: boolean;
  expandedRole: string | null;
  setExpandedRole: (role: string | null) => void;
  togglingRole: string | null;
  onToggleRole: (roleId: string, enabled: boolean) => void;
  isTriggering: boolean;
  triggerResult: { success: boolean; tasks_generated: number; error?: string } | null;
  onTriggerAnalysis: () => void;
  autonomousLogs: AutonomousLogsResponse | undefined;
  autonomousLogsPage: number;
  setAutonomousLogsPage: (page: number) => void;
  autonomousLogTypeFilter: string;
  setAutonomousLogTypeFilter: (filter: string) => void;
  autonomousLogSeverityFilter: string;
  setAutonomousLogSeverityFilter: (filter: string) => void;
  autonomousLogRoleFilter: string;
  setAutonomousLogRoleFilter: (filter: string) => void;
  personalizzaConfig: PersonalizzaConfig;
  setPersonalizzaConfig: React.Dispatch<React.SetStateAction<PersonalizzaConfig>>;
  personalizzaLoading: boolean;
  personalizzaSaving: boolean;
  onSavePersonalizza: () => void;
  kbDocuments: KbDocument[];
  chatOpenRoleId: string | null;
  setChatOpenRoleId: (roleId: string | null) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadCount: number;
  activityContent: React.ReactNode;
  dashboardContent: React.ReactNode;
  dataCatalogContent: React.ReactNode;
}

function AgentMemoryContent({ roleId }: { roleId: string }) {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const fetchSummaries = () => {
    setLoading(true);
    fetch(`/api/ai-autonomy/agent-chat/${roleId}/daily-summaries?limit=60`, {
      headers: getAuthHeaders(),
    })
      .then(res => res.json())
      .then(data => {
        setSummaries(data.summaries || []);
        if (data.summaries?.length > 0) {
          setExpandedDays(new Set([data.summaries[0].summary_date]));
        }
      })
      .catch(err => console.error('Error fetching summaries:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setSummaries([]);
    setExpandedDays(new Set());
    setGenerateResult(null);
    fetchSummaries();
  }, [roleId]);

  const generateSummaries = async () => {
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch(`/api/ai-autonomy/agent-chat/${roleId}/generate-summaries`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setGenerateResult(data.message || `${data.generated} riassunti generati`);
        if (data.generated > 0) {
          fetchSummaries();
        }
      } else {
        setGenerateResult(data.error || 'Errore nella generazione');
      }
    } catch (err) {
      setGenerateResult('Errore di connessione');
    } finally {
      setGenerating(false);
    }
  };

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const now = new Date();
    const today = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    const dateKey = dateStr.substring(0, 10);
    
    if (dateKey === today) return 'Oggi';
    if (dateKey === yesterday) return 'Ieri';
    return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
  };

  const getDateStyle = (dateStr: string) => {
    const now = new Date();
    const today = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    const dateKey = dateStr.substring(0, 10);
    
    if (dateKey === today) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200';
    if (dateKey === yesterday) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <span className="ml-2 text-sm text-muted-foreground">Caricamento memoria...</span>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="text-center py-12">
        <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Nessun riassunto disponibile</p>
        <p className="text-xs text-muted-foreground/70 mt-1 mb-4">I riassunti vengono generati automaticamente ogni sera alle 23:55</p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30"
          onClick={generateSummaries}
          disabled={generating}
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? 'Generazione in corso...' : 'Genera riassunti'}
        </Button>
        {generateResult && (
          <p className="text-xs text-muted-foreground mt-2">{generateResult}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{summaries.length} riassunti disponibili</p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30"
          onClick={generateSummaries}
          disabled={generating}
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {generating ? 'Generazione...' : 'Genera'}
        </Button>
      </div>
      {generateResult && (
        <p className="text-xs text-center text-purple-600 dark:text-purple-400">{generateResult}</p>
      )}
      {summaries.map((s: any) => {
        const dateKey = s.summary_date?.substring(0, 10);
        const isOpen = expandedDays.has(dateKey);
        return (
          <div key={s.id} className="rounded-xl border border-border overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
              onClick={() => toggleDay(dateKey)}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium capitalize">{formatDate(dateKey)}</span>
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", getDateStyle(dateKey))}>
                  {s.message_count} msg
                </Badge>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {isOpen && (
              <div className="px-3 pb-3 border-t">
                <p className="text-sm text-foreground/80 leading-relaxed pt-2 whitespace-pre-wrap">{s.summary_text}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SettingsTab({
  settings,
  setSettings,
  systemStatus,
  loadingSettings,
  onSave,
  isSaving,
  expandedRole,
  setExpandedRole,
  togglingRole,
  onToggleRole,
  isTriggering,
  triggerResult,
  onTriggerAnalysis,
  autonomousLogs,
  autonomousLogsPage,
  setAutonomousLogsPage,
  autonomousLogTypeFilter,
  setAutonomousLogTypeFilter,
  autonomousLogSeverityFilter,
  setAutonomousLogSeverityFilter,
  autonomousLogRoleFilter,
  setAutonomousLogRoleFilter,
  personalizzaConfig,
  setPersonalizzaConfig,
  personalizzaLoading,
  personalizzaSaving,
  onSavePersonalizza,
  kbDocuments,
  chatOpenRoleId,
  setChatOpenRoleId,
  activeTab,
  onTabChange,
  unreadCount,
  activityContent,
  dashboardContent,
  dataCatalogContent,
}: SettingsTabProps) {
  const [, navigate] = useLocation();
  const [showArchDetails, setShowArchDetails] = useState(true);
  const [showPromptForRole, setShowPromptForRole] = useState<string | null>(null);
  const [triggeringRoleId, setTriggeringRoleId] = useState<string | null>(null);
  const [triggerRoleResult, setTriggerRoleResult] = useState<Record<string, { success: boolean; tasks: number; error?: string }>>({});
  const [openTemplateCategories, setOpenTemplateCategories] = useState<Set<string>>(new Set());
  const [memoryOpenRoleId, setMemoryOpenRoleId] = useState<string | null>(null);
  const [telegramChatsRoleId, setTelegramChatsRoleId] = useState<string | null>(null);
  const autonomyInfo = getAutonomyLabel(settings.autonomy_level);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: savedSalesContext } = useQuery<{ servicesOffered?: string; targetAudience?: string } | null>({
    queryKey: ["/api/lead-scraper/sales-context"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/lead-scraper/sales-context", { headers: getAuthHeaders() });
        if (!res.ok) return null;
        return res.json();
      } catch { return null; }
    },
  });

  const { data: whatsappTemplates = [], isLoading: templatesLoading } = useQuery<{
    id: string;
    friendlyName: string;
    bodyText: string;
    approvalStatus: string;
    useCase?: string;
  }[]>({
    queryKey: ["/api/weekly-checkin/templates"],
    enabled: settings.channels_enabled.whatsapp,
  });

  const { data: proactiveWaConfigs = [] } = useQuery<{ id: string; name: string; phoneNumber: string }[]>({
    queryKey: ["/api/whatsapp/config/proactive-for-outreach"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/config/proactive", { headers: getAuthHeaders() });
      const data = await res.json();
      return (data.configs || []).map((c: any) => ({
        id: c.id,
        name: c.agentName || "Dipendente WA",
        phoneNumber: c.twilioWhatsappNumber || "",
      }));
    },
  });

  const voiceTemplateOptions = [
    { id: "lead-qualification", name: "Qualifica Lead", description: "Per primo contatto con lead freddi" },
    { id: "appointment-setter", name: "Fissa Appuntamento", description: "Per proporre un incontro" },
    { id: "sales-orbitale", name: "Sales Orbitale", description: "Per lead ad alto potenziale" },
  ];

  const outreachDefaults = {
    enabled: false,
    max_searches_per_day: 5,
    max_calls_per_day: 10,
    max_whatsapp_per_day: 15,
    max_emails_per_day: 20,
    score_threshold: 60,
    channel_priority: ["voice", "whatsapp", "email"],
    cooldown_hours: 48,
    whatsapp_config_id: "",
    voice_template_id: "",
  };
  const outreachConfig = { ...outreachDefaults, ...(settings.outreach_config || {}) };

  const updateOutreachConfig = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      outreach_config: { ...outreachConfig, [key]: value },
    }));
  };

  const moveChannelPriority = (index: number, direction: "up" | "down") => {
    const arr = [...outreachConfig.channel_priority];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= arr.length) return;
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    updateOutreachConfig("channel_priority", arr);
  };

  const channelLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    voice: { label: "Chiamate (Alessia)", icon: <Phone className="h-4 w-4" />, color: "text-green-600" },
    whatsapp: { label: "WhatsApp (Stella)", icon: <MessageSquare className="h-4 w-4" />, color: "text-emerald-600" },
    email: { label: "Email (Millie)", icon: <Mail className="h-4 w-4" />, color: "text-blue-600" },
  };

  const TEMPLATE_CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    "Setter": { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", icon: "bg-blue-500" },
    "Follow-up": { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800", icon: "bg-orange-500" },
    "Check-in": { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800", icon: "bg-purple-500" },
    "Notifica": { bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800", icon: "bg-cyan-500" },
    "Generale": { bg: "bg-gray-50 dark:bg-gray-900/20", text: "text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-800", icon: "bg-gray-500" },
  };

  const categorizeTemplate = (template: { friendlyName: string; useCase?: string }): string => {
    const name = (template.friendlyName || "").toLowerCase();
    const useCase = (template.useCase || "").toLowerCase();
    if (name.includes("setter") || useCase.includes("setter")) return "Setter";
    if (name.includes("follow-up") || name.includes("followup") || useCase.includes("follow")) return "Follow-up";
    if (name.includes("check") || useCase.includes("check")) return "Check-in";
    if (name.includes("notifica") || name.includes("promemoria") || useCase.includes("notifica")) return "Notifica";
    return "Generale";
  };

  const templatesByCategory = React.useMemo(() => {
    const grouped: Record<string, typeof whatsappTemplates> = {};
    whatsappTemplates.forEach((template) => {
      const category = categorizeTemplate(template);
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(template);
    });
    return grouped;
  }, [whatsappTemplates]);

  const handleAutonomyTemplateToggle = (templateId: string, isChecked: boolean) => {
    const currentIds = settings.whatsapp_template_ids || [];
    const newIds = isChecked
      ? [...currentIds, templateId]
      : currentIds.filter((id) => id !== templateId);
    setSettings(prev => ({ ...prev, whatsapp_template_ids: newIds }));
  };

  const { data: systemPrompts } = useQuery<Record<string, { name: string; displayName: string; description: string; systemPromptTemplate: string }>>({
    queryKey: ["/api/ai-autonomy/roles/system-prompts"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/roles/system-prompts", { headers: getAuthHeaders() });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: roleStatuses } = useQuery<Record<string, RoleStatus>>({
    queryKey: ["/api/ai-autonomy/roles/status"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/roles/status", { headers: getAuthHeaders() });
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: blocks = [] } = useQuery<Array<{
    id: string;
    consultant_id: string;
    contact_id: string;
    contact_name: string | null;
    contact_display_name: string;
    task_category: string | null;
    ai_role: string | null;
    reason: string | null;
    blocked_at: string;
    source_task_id: string | null;
  }>>({
    queryKey: ["/api/ai-autonomy/blocks"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/blocks", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleTriggerRole = async (roleId: string, roleName: string) => {
    setTriggeringRoleId(roleId);
    setTriggerRoleResult(prev => ({ ...prev, [roleId]: undefined as any }));
    try {
      const res = await fetch(`/api/ai-autonomy/trigger-role/${roleId}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setTriggerRoleResult(prev => ({
        ...prev,
        [roleId]: { success: data.success, tasks: data.tasks_generated || 0, error: data.error },
      }));
      toast({
        title: data.success ? `${roleName} avviato` : `Errore`,
        description: data.success
          ? `${data.tasks_generated} task generati da ${roleName}`
          : (data.error || 'Errore durante l\'avvio'),
        variant: data.success ? 'default' : 'destructive',
      });
    } catch (err: any) {
      setTriggerRoleResult(prev => ({
        ...prev,
        [roleId]: { success: false, tasks: 0, error: err.message },
      }));
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
    setTriggeringRoleId(null);
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!window.confirm("Rimuovere questo blocco? L'AI potrà nuovamente proporre questo tipo di task.")) return;
    const res = await fetch(`/api/ai-autonomy/blocks/${blockId}`, { method: "DELETE", headers: getAuthHeaders() });
    if (res.ok) {
      toast({ title: "Blocco rimosso", description: "L'AI potrà nuovamente proporre questo tipo di task" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/blocks"] });
    } else {
      toast({ title: "Errore", description: "Impossibile rimuovere il blocco", variant: "destructive" });
    }
  };

  const toggleWorkingDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort(),
    }));
  };

  const toggleCategory = (cat: string) => {
    setSettings(prev => ({
      ...prev,
      allowed_task_categories: prev.allowed_task_categories.includes(cat)
        ? prev.allowed_task_categories.filter(c => c !== cat)
        : [...prev.allowed_task_categories, cat],
    }));
  };

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* 4 Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Livello Autonomia</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{settings.autonomy_level}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{autonomyInfo.label}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30">
              <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Modalità</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {settings.default_mode === "manual" ? "Manuale" : settings.default_mode === "hybrid" ? "Ibrido" : "Automatico"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{settings.is_active ? "Sistema attivo" : "Sistema spento"}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-green-50 dark:bg-green-900/30">
              <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Canali Attivi</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {[settings.channels_enabled.voice, settings.channels_enabled.email, settings.channels_enabled.whatsapp].filter(Boolean).length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">canali abilitati</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30">
              <Bot className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Dipendenti</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{systemStatus?.roles?.filter(r => r.enabled).length || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">dipendenti attivi</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="mt-6">
        <TabsList className="flex flex-wrap w-full h-auto bg-gray-100 dark:bg-gray-800/50 rounded-xl p-1.5 gap-1">
          <TabsTrigger value="panoramica" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Panoramica</span>
          </TabsTrigger>
          <TabsTrigger value="autonomia" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Autonomia & Modalità</span>
          </TabsTrigger>
          <TabsTrigger value="orari" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Orari & Limiti</span>
          </TabsTrigger>
          <TabsTrigger value="canali" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Canali & Categorie</span>
          </TabsTrigger>
          <TabsTrigger value="dipendenti" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Dipendenti AI</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Feed</span>
            {unreadCount > 0 && (
              <Badge className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] rounded-full">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Task</span>
          </TabsTrigger>
          <TabsTrigger value="data-catalog" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Dati</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 - Panoramica */}
        <TabsContent value="panoramica" className="mt-5 space-y-5">
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowArchDetails(!showArchDetails)}>
              <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
                <Bot className="h-5 w-5" />
                <span>Cosa può fare il tuo Dipendente AI</span>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {showArchDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Architettura, modalità operative e guardrail di sicurezza
            </p>

            {showArchDetails && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <div className="flex items-start gap-4">
                    <Brain className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        Come funziona
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs rounded-lg">Il Cervello</Badge>
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Un <span className="font-medium text-foreground">motore decisionale</span> basato su Gemini analizza il contesto di ogni cliente
                        (storico, dati, scadenze) e crea <span className="font-medium text-foreground">piani di esecuzione multi-step</span>.
                        Ragiona come un consulente esperto per decidere cosa fare, quando e come.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="outline" className="text-xs gap-1 rounded-lg"><Eye className="h-3 w-3" /> Analisi contesto</Badge>
                        <Badge variant="outline" className="text-xs gap-1 rounded-lg"><ListTodo className="h-3 w-3" /> Piani multi-step</Badge>
                        <Badge variant="outline" className="text-xs gap-1 rounded-lg"><Sparkles className="h-3 w-3" /> Reasoning AI</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Cog className="h-4 w-4" />
                    Le 3 Modalità
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={cn(
                      "rounded-xl border border-border p-4 space-y-2",
                      settings.default_mode === "manual" && "ring-2 ring-primary border-primary/30"
                    )}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-semibold">Manuale</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Tu crei i task, l'AI li esegue quando programmati. Controllo totale su ogni azione.
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Ideale per: chi vuole controllo totale
                      </p>
                    </div>
                    <div className={cn(
                      "rounded-xl border border-border p-4 space-y-2 relative",
                      settings.default_mode === "hybrid" && "ring-2 ring-primary border-primary/30"
                    )}>
                      <Badge className="absolute -top-2.5 right-3 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-lg">Consigliata</Badge>
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Ibrida</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        L'AI propone nuove azioni ma chiede approvazione per quelle importanti.
                      </p>
                      <p className="text-xs text-primary">
                        Ideale per: consulenti e team piccoli
                      </p>
                    </div>
                    <div className={cn(
                      "rounded-xl border border-border p-4 space-y-2",
                      settings.default_mode === "automatic" && "ring-2 ring-primary border-primary/30"
                    )}>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-semibold">Automatica</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        L'AI opera in piena autonomia entro i limiti configurati.
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        Ideale per: aziende strutturate
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Il Ciclo di Lavoro
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { step: 1, icon: Timer, title: "CRON Scheduler", desc: "Verifica task ogni minuto" },
                      { step: 2, icon: Brain, title: "Decision Engine", desc: "Analizza contesto e priorità" },
                      { step: 3, icon: ListTodo, title: "Piano Esecuzione", desc: "Crea piano multi-step" },
                      { step: 4, icon: Play, title: "Task Executor", desc: "Esegue azioni su tutti i canali" },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-2">
                        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-primary/10 text-primary text-sm font-bold shrink-0">
                          {item.step}
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold truncate">{item.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { icon: Phone, label: "Chiamate" },
                      { icon: Mail, label: "Email" },
                      { icon: MessageSquare, label: "WhatsApp" },
                      { icon: BarChart3, label: "Analisi" },
                      { icon: Target, label: "Ricerca" },
                    ].map((ch) => (
                      <Badge key={ch.label} variant="outline" className="text-xs gap-1 py-0.5 rounded-lg">
                        <ch.icon className="h-3 w-3" />
                        {ch.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="rounded-xl border border-amber-200 dark:border-amber-800 p-4 bg-amber-50 dark:bg-amber-950/20">
                  <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Guardrail di Sicurezza
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      { icon: Clock, text: "Opera solo nell'orario di lavoro configurato" },
                      { icon: Shield, text: "Limiti giornalieri per ogni canale" },
                      { icon: Zap, text: "Solo canali e categorie abilitate" },
                      { icon: AlertCircle, text: "Livello autonomia richiesto per ogni azione" },
                      { icon: Activity, text: "Ogni azione registrata nel feed attività" },
                      { icon: CheckCircle, text: "Nessuna azione duplicata o ridondante" },
                    ].map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground py-1.5">
                        <rule.icon className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>{rule.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {systemStatus && (
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-4">
                <Activity className="h-4 w-4" />
                Stato Sistema in Tempo Reale
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <div className={cn("h-2 w-2 rounded-full", systemStatus.is_active ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stato</p>
                    </div>
                    <p className={cn("text-sm font-semibold", systemStatus.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {systemStatus.is_active ? "Attivo" : "Disattivo"}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <div className={cn("h-2 w-2 rounded-full", systemStatus.is_in_working_hours ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Orario</p>
                    </div>
                    <p className={cn("text-sm font-semibold", systemStatus.is_in_working_hours ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                      {systemStatus.is_in_working_hours ? "In orario" : "Fuori orario"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{systemStatus.current_time_rome} (Roma)</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Clienti Eleggibili</p>
                    <p className="text-sm font-semibold">{systemStatus.eligible_clients} <span className="text-muted-foreground font-normal">/ {systemStatus.total_clients}</span></p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">senza task pendenti</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Task Pendenti</p>
                    <p className="text-sm font-semibold">{systemStatus.pending_tasks}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">in coda o in esecuzione</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Limiti Giornalieri Utilizzati Oggi</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-border">
                      <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-xs font-medium">{systemStatus.today_counts.calls}/{systemStatus.limits.max_calls}</p>
                        <p className="text-xs text-muted-foreground">Chiamate</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-border">
                      <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs font-medium">{systemStatus.today_counts.emails}/{systemStatus.limits.max_emails}</p>
                        <p className="text-xs text-muted-foreground">Email</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-border">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-xs font-medium">{systemStatus.today_counts.whatsapp}/{systemStatus.limits.max_whatsapp}</p>
                        <p className="text-xs text-muted-foreground">WhatsApp</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-border">
                      <BarChart3 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs font-medium">{systemStatus.today_counts.analyses}/{systemStatus.limits.max_analyses}</p>
                        <p className="text-xs text-muted-foreground">Analisi</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Controllo Autonomo</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={onTriggerAnalysis}
                      disabled={isTriggering || !systemStatus.is_active || systemStatus.autonomy_level < 2}
                    >
                      {isTriggering ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      {isTriggering ? "Analisi in corso..." : "Avvia Analisi Ora"}
                    </Button>
                  </div>
                  {triggerResult && (
                    <div className={cn(
                      "p-2.5 rounded-xl border text-xs",
                      triggerResult.success
                        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300"
                        : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300"
                    )}>
                      {triggerResult.success
                        ? `Analisi completata: ${triggerResult.tasks_generated} task generati.`
                        : `Errore: ${triggerResult.error || "Analisi fallita"}`}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl border border-border">
                      <p className="text-xs text-muted-foreground">Ultimo controllo</p>
                      <p className="text-xs font-medium">
                        {systemStatus.last_autonomous_check
                          ? new Date(systemStatus.last_autonomous_check).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : "Mai eseguito"}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl border border-border">
                      <p className="text-xs text-muted-foreground">Prossimo controllo (stima)</p>
                      <p className="text-xs font-medium">
                        {systemStatus.next_check_estimate
                          ? new Date(systemStatus.next_check_estimate).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : "Al prossimo ciclo"}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl border border-border">
                      <p className="text-xs text-muted-foreground">Frequenza controllo</p>
                      <p className="text-xs font-medium">Ogni {systemStatus.check_interval_minutes} minuti</p>
                    </div>
                  </div>
                  {systemStatus.last_check_data && (
                    <div className="p-2.5 rounded-xl border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Risultato ultimo controllo</p>
                      <p className="text-xs">
                        {systemStatus.last_check_data.eligible_clients !== undefined
                          ? `${systemStatus.last_check_data.eligible_clients} clienti analizzati, ${systemStatus.last_check_data.tasks_suggested || 0} task suggeriti`
                          : "Dati non disponibili"}
                      </p>
                    </div>
                  )}
                  {systemStatus.last_error && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-red-700 dark:text-red-400">Ultimo errore rilevato</p>
                          <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{systemStatus.last_error.title}</p>
                          <p className="text-xs text-red-500/70 dark:text-red-400/70 mt-0.5">{systemStatus.last_error.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(systemStatus.last_error.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {autonomousLogs && (
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
                <Brain className="h-4 w-4" />
                Log Ragionamenti AI
                <Badge variant="secondary" className="text-xs rounded-lg">{autonomousLogs.total}</Badge>
              </div>
              <div className="space-y-5 mt-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={autonomousLogTypeFilter} onValueChange={(val) => { setAutonomousLogTypeFilter(val); setAutonomousLogsPage(1); }}>
                    <SelectTrigger className="h-7 text-xs w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i tipi</SelectItem>
                      <SelectItem value="autonomous_analysis">Analisi</SelectItem>
                      <SelectItem value="autonomous_task_created">Task creati</SelectItem>
                      <SelectItem value="autonomous_error">Errori</SelectItem>
                      <SelectItem value="system_prompt_log">System Prompt</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={autonomousLogSeverityFilter} onValueChange={(val) => { setAutonomousLogSeverityFilter(val); setAutonomousLogsPage(1); }}>
                    <SelectTrigger className="h-7 text-xs w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="success">Successo</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Errore</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={autonomousLogRoleFilter} onValueChange={(val) => { setAutonomousLogRoleFilter(val); setAutonomousLogsPage(1); }}>
                    <SelectTrigger className="h-7 text-xs w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i ruoli</SelectItem>
                      <SelectItem value="alessia">Alessia</SelectItem>
                      <SelectItem value="millie">Millie</SelectItem>
                      <SelectItem value="echo">Echo</SelectItem>
                      <SelectItem value="nova">Nova</SelectItem>
                      <SelectItem value="stella">Stella</SelectItem>
                      <SelectItem value="iris">Iris</SelectItem>
                      <SelectItem value="marco">Marco</SelectItem>
                      <SelectItem value="hunter">Hunter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {autonomousLogs.logs.length === 0 ? (
                  <div className="flex items-center gap-4 text-muted-foreground py-4">
                    <Brain className="h-5 w-5" />
                    <div>
                      <p className="text-sm font-medium">Nessun log trovato</p>
                      <p className="text-xs">
                        {autonomousLogTypeFilter !== "all" || autonomousLogSeverityFilter !== "all"
                          ? "Prova a cambiare i filtri per vedere altri risultati."
                          : "Quando l'AI analizzerà i tuoi clienti, qui vedrai ogni decisione, ragionamento e risultato."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {autonomousLogs.logs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "p-3 rounded-xl border text-xs space-y-2",
                          log.severity === "error" ? "bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-800/30" :
                          log.event_type === "autonomous_task_created" ? "bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/30" :
                          "border-border"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className="text-base shrink-0">{log.icon || "🧠"}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium truncate">{log.title}</p>
                                {log.ai_role && (
                                  <Badge variant="outline" className={cn("text-xs px-1 py-0 shrink-0 rounded-lg",
                                    log.ai_role === "alessia" ? "border-pink-300 text-pink-600 dark:border-pink-700 dark:text-pink-400" :
                                    log.ai_role === "millie" ? "border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400" :
                                    log.ai_role === "echo" ? "border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400" :
                                    log.ai_role === "nova" ? "border-pink-300 text-pink-600 dark:border-pink-700 dark:text-pink-400" :
                                    log.ai_role === "stella" ? "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400" :
                                    log.ai_role === "iris" ? "border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400" :
                                    log.ai_role === "marco" ? "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400" :
                                    log.ai_role === "hunter" ? "border-teal-300 text-teal-600 dark:border-teal-700 dark:text-teal-400" :
                                    "border-muted-foreground/30 text-muted-foreground"
                                  )}>
                                    {log.ai_role.charAt(0).toUpperCase() + log.ai_role.slice(1)}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground mt-0.5">{log.description}</p>
                              {log.event_data?.overall_reasoning && log.event_data.overall_reasoning !== log.description && (
                                <div className="mt-2 p-2 rounded-xl border border-primary/20 bg-primary/5">
                                  <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                                    <Brain className="h-3 w-3" />
                                    Ragionamento AI:
                                  </p>
                                  <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                                    {log.event_data.overall_reasoning}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {new Date(log.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {log.event_data && (
                          <div className="space-y-1 pl-8">
                            {log.event_data.total_clients !== undefined && (
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Clienti totali: <strong>{log.event_data.total_clients}</strong></span>
                                <span>Eleggibili: <strong>{log.event_data.eligible_clients}</strong></span>
                                <span>Con task pendenti: <strong>{log.event_data.clients_with_pending_tasks}</strong></span>
                                <span>Completati recenti: <strong>{log.event_data.clients_with_recent_completion}</strong></span>
                              </div>
                            )}
                            {log.event_data.tasks_suggested > 0 && (
                              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                {log.event_data.tasks_suggested} task suggeriti dall'AI
                              </p>
                            )}
                            {log.event_data.suggestions && Array.isArray(log.event_data.suggestions) && log.event_data.suggestions.length > 0 && (
                              <div className="space-y-1 mt-1">
                                {log.event_data.suggestions.map((s: any, i: number) => (
                                  <div key={i} className="p-2 rounded-xl border border-border">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs px-1 py-0 rounded-lg">{s.category}</Badge>
                                      <span className="font-medium">{s.client_name}</span>
                                      {s.channel && s.channel !== "none" && (
                                        <Badge variant="secondary" className="text-xs px-1 py-0 rounded-lg">{s.channel}</Badge>
                                      )}
                                    </div>
                                    <p className="text-muted-foreground mt-0.5">{s.instruction}</p>
                                    {s.reasoning && (
                                      <p className="text-muted-foreground/70 mt-0.5 italic">Motivazione: {s.reasoning}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {log.event_data.task_category && (
                              <div className="flex items-center gap-2 text-xs">
                                <Badge variant="outline" className="text-xs px-1 py-0 rounded-lg">{log.event_data.task_category}</Badge>
                                {log.contact_name && <span>Cliente: <strong>{log.contact_name}</strong></span>}
                                {log.event_data.preferred_channel && log.event_data.preferred_channel !== "none" && (
                                  <Badge variant="secondary" className="text-xs px-1 py-0 rounded-lg">{log.event_data.preferred_channel}</Badge>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}

                {autonomousLogs.total > 10 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      Pagina {autonomousLogsPage} di {Math.ceil(autonomousLogs.total / 10)}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={autonomousLogsPage <= 1}
                        onClick={() => setAutonomousLogsPage(autonomousLogsPage - 1)}
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={autonomousLogsPage >= Math.ceil(autonomousLogs.total / 10)}
                        onClick={() => setAutonomousLogsPage(autonomousLogsPage + 1)}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2 - Autonomia & Modalita' */}
        <TabsContent value="autonomia" className="mt-5 space-y-5">
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
              <Zap className="h-5 w-5" />
              Stato e Livello di Autonomia
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Definisci quanto il tuo dipendente AI può operare in modo indipendente
            </p>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Abilita Dipendente AI</Label>
                  <p className="text-xs text-muted-foreground">
                    Attiva o disattiva il dipendente AI
                  </p>
                </div>
                <Switch
                  checked={settings.is_active}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_active: checked }))}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-4">
                  <div className={cn(
                    "flex items-center justify-center h-24 w-24 rounded-full border-4 text-4xl font-bold",
                    settings.autonomy_level === 0 ? "border-muted-foreground/30 text-muted-foreground" :
                    settings.autonomy_level <= 3 ? "border-emerald-500/40 text-emerald-500" :
                    settings.autonomy_level <= 6 ? "border-amber-500/40 text-amber-500" :
                    settings.autonomy_level <= 9 ? "border-orange-500/40 text-orange-500" : "border-red-500/40 text-red-500"
                  )}>
                    {settings.autonomy_level}
                  </div>
                  <p className={cn("text-lg font-semibold mt-2", autonomyInfo.color)}>
                    {autonomyInfo.label}
                  </p>
                  <p className="text-xs text-muted-foreground">su 10</p>
                </div>

                <div className="rounded-xl border border-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Livello di Autonomia</Label>
                    <Badge className={cn("rounded-lg", getAutonomyBadgeColor(settings.autonomy_level))}>
                      {settings.autonomy_level}/10
                    </Badge>
                  </div>

                  <Slider
                    value={[settings.autonomy_level]}
                    onValueChange={(val) => setSettings(prev => ({ ...prev, autonomy_level: val[0] }))}
                    max={10}
                    min={0}
                    step={1}
                    className="w-full"
                  />

                  <div className="flex justify-between gap-1">
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 text-muted-foreground rounded-lg">0 Off</Badge>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800 rounded-lg">1-3</Badge>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800 rounded-lg">4-6</Badge>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 text-orange-600 border-orange-200 dark:text-orange-400 dark:border-orange-800 rounded-lg">7-9</Badge>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 text-red-600 border-red-200 dark:text-red-400 dark:border-red-800 rounded-lg">10</Badge>
                  </div>
                </div>

                <div className={cn(
                  "p-4 rounded-xl border",
                  autonomyInfo.color === "text-muted-foreground" ? "bg-muted/50 border-muted" :
                  settings.autonomy_level <= 3 ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" :
                  settings.autonomy_level <= 6 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40" :
                  settings.autonomy_level <= 9 ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40" :
                  "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40"
                )}>
                  <p className={cn("text-sm flex items-start gap-2", autonomyInfo.color)}>
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    {autonomyInfo.description}
                  </p>
                </div>

                {settings.autonomy_level > 0 && (
                  <div className="space-y-4 mt-4">
                    <div className="rounded-xl border border-border p-4 space-y-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Cosa fa l'AI a livello {settings.autonomy_level}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Cosa PUO' fare</p>
                          <ul className="space-y-1.5">
                            {settings.autonomy_level >= 1 && (
                              <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                Eseguire task che crei tu manualmente
                              </li>
                            )}
                            {settings.autonomy_level >= 2 && (
                              <>
                                <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  Analizzare i tuoi clienti e proporre task proattivamente
                                </li>
                                <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  Cercare nei documenti privati (consulenze, esercizi, knowledge base)
                                </li>
                              </>
                            )}
                            {settings.autonomy_level >= 3 && (
                              <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                Generare report, analisi e ricerche in automatico
                              </li>
                            )}
                            {settings.autonomy_level >= 4 && (
                              <>
                                <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  Eseguire task autonomi senza la tua approvazione
                                </li>
                                <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  Inviare email e messaggi WhatsApp ai clienti
                                </li>
                              </>
                            )}
                            {settings.autonomy_level >= 7 && (
                              <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                Effettuare chiamate vocali autonomamente
                              </li>
                            )}
                            {settings.autonomy_level >= 10 && (
                              <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                Gestire tutto senza alcuna supervisione
                              </li>
                            )}
                          </ul>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Cosa NON PUO' fare</p>
                          <ul className="space-y-1.5">
                            {settings.autonomy_level < 2 && (
                              <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                Analizzare clienti e proporre task proattivamente
                              </li>
                            )}
                            {settings.autonomy_level < 4 && (
                              <>
                                <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                  Eseguire task senza la tua approvazione
                                </li>
                                <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                  Inviare email o WhatsApp senza approvazione
                                </li>
                                <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                  Effettuare chiamate vocali autonomamente
                                </li>
                              </>
                            )}
                            {settings.autonomy_level >= 4 && settings.autonomy_level < 7 && (
                              <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                Effettuare chiamate vocali senza approvazione
                              </li>
                            )}
                            {settings.autonomy_level < 10 && (
                              <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                Operare fuori dall'orario di lavoro configurato
                              </li>
                            )}
                            <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                              Superare i limiti giornalieri (chiamate, email, ecc.)
                            </li>
                            <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                              Operare su categorie di task non abilitate
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center py-2">
                      <Button
                        variant="outline"
                        onClick={() => window.open('/ai-autonomy-flowchart.html', '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Vedi Diagramma di Flusso Completo
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border p-4 space-y-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Cog className="h-4 w-4" />
                        Come funziona il sistema
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-start gap-4 p-3 rounded-xl border border-border">
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">1</div>
                          <div>
                            <p className="text-xs font-medium">Analisi Clienti (ogni {settings.autonomy_level >= 2 ? "30 minuti" : "—"})</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {settings.autonomy_level >= 2
                                ? "L'AI analizza i tuoi clienti attivi, esclude chi ha già task pendenti o completati nelle ultime 24h, e identifica chi ha bisogno di attenzione (es: nessuna consulenza da oltre 2 settimane)."
                                : "Disattivato a questo livello. Serve almeno livello 2."}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4 p-3 rounded-xl border border-border">
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">2</div>
                          <div>
                            <p className="text-xs font-medium">Creazione Task (max 3 per ciclo)</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {settings.autonomy_level >= 2
                                ? `L'AI usa Gemini per valutare ogni cliente e suggerire azioni concrete. Considera: ultima consulenza, task completati di recente, categorie abilitate (${settings.allowed_task_categories.join(", ")}), e le tue istruzioni personalizzate.`
                                : "Disattivato a questo livello. Serve almeno livello 2."}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4 p-3 rounded-xl border border-border">
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">3</div>
                          <div>
                            <p className="text-xs font-medium">Esecuzione Task (controllo ogni minuto)</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {settings.autonomy_level >= 4
                                ? "I task creati vengono eseguiti automaticamente. L'AI genera un piano multi-step (recupero dati, ricerca documenti, analisi, report, comunicazione) e lo esegue passo dopo passo."
                                : settings.autonomy_level >= 2
                                  ? "I task vengono messi in attesa di approvazione. Devi approvarli manualmente prima che vengano eseguiti."
                                  : "Solo i task che crei manualmente vengono eseguiti."}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4 p-3 rounded-xl border border-border">
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">4</div>
                          <div>
                            <p className="text-xs font-medium">Notifiche e Log</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Ogni azione viene registrata nel Feed Attività. Puoi vedere ogni step: quali dati ha recuperato, quali documenti ha consultato, quale analisi ha fatto, e il risultato finale.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Modalità Predefinita</Label>
                  <Select
                    value={settings.default_mode}
                    onValueChange={(val) => setSettings(prev => ({ ...prev, default_mode: val }))}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manuale</SelectItem>
                      <SelectItem value="hybrid">Ibrido</SelectItem>
                      <SelectItem value="automatic">Automatico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Brain className="h-4 w-4" />
                    Modalità ragionamento predefinita
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Come gli agenti AI strutturano il loro processo di analisi e decisione
                  </p>
                  <Select
                    value={settings.reasoning_mode || "structured"}
                    onValueChange={(val) => setSettings(prev => ({ ...prev, reasoning_mode: val }))}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="structured">
                        <div className="flex flex-col">
                          <span>Strutturato</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="deep_think">
                        <div className="flex flex-col">
                          <span>Deep Think</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {(settings.reasoning_mode || "structured") === "structured"
                      ? "Analisi con sezioni obbligatorie: osservazione, riflessione, decisione, auto-revisione"
                      : "Loop agentico multi-step con analisi approfondita iterativa"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
              <Brain className="h-5 w-5" />
              Istruzioni Personalizzate
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Fornisci istruzioni specifiche per guidare il comportamento dell'AI
            </p>
            <Textarea
              value={settings.custom_instructions}
              onChange={(e) => setSettings(prev => ({ ...prev, custom_instructions: e.target.value }))}
              placeholder="Es: Non chiamare mai i clienti prima delle 10. Prioritizza i lead caldi."
              rows={4}
            />
          </div>
        </TabsContent>

        {/* Tab 3 - Orari & Limiti */}
        <TabsContent value="orari" className="mt-5 space-y-5">
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
              <Clock className="h-5 w-5" />
              Orari di Lavoro
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Imposta quando il dipendente AI può operare
            </p>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ora Inizio</Label>
                  <Input
                    type="time"
                    value={settings.working_hours_start}
                    onChange={(e) => setSettings(prev => ({ ...prev, working_hours_start: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ora Fine</Label>
                  <Input
                    type="time"
                    value={settings.working_hours_end}
                    onChange={(e) => setSettings(prev => ({ ...prev, working_hours_end: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Giorni Lavorativi</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      variant={settings.working_days.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      className="rounded-xl"
                      onClick={() => toggleWorkingDay(day.value)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
              <Shield className="h-5 w-5" />
              Limiti Giornalieri
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Imposta i limiti massimi di azioni giornaliere
            </p>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="h-4 w-4" /> Chiamate
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.max_daily_calls}
                    onChange={(e) => setSettings(prev => ({ ...prev, max_daily_calls: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Mail className="h-4 w-4" /> Email
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.max_daily_emails}
                    onChange={(e) => setSettings(prev => ({ ...prev, max_daily_emails: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" /> WhatsApp
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.max_daily_whatsapp}
                    onChange={(e) => setSettings(prev => ({ ...prev, max_daily_whatsapp: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" /> Analisi
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.max_daily_analyses}
                    onChange={(e) => setSettings(prev => ({ ...prev, max_daily_analyses: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Frequenza Analisi Autonoma (minuti)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ogni quanti minuti l'AI deve analizzare i tuoi clienti e proporre nuovi task. Il cron controlla ogni 30 minuti, ma rispetta questo intervallo tra un'analisi e l'altra.
                </p>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min={30}
                    max={1440}
                    className="w-32"
                    value={settings.proactive_check_interval_minutes}
                    onChange={(e) => setSettings(prev => ({ ...prev, proactive_check_interval_minutes: Math.max(30, parseInt(e.target.value) || 60) }))}
                  />
                  <span className="text-xs text-muted-foreground">
                    {settings.proactive_check_interval_minutes < 60
                      ? `ogni ${settings.proactive_check_interval_minutes} minuti`
                      : settings.proactive_check_interval_minutes === 60
                        ? "ogni ora"
                        : `ogni ${Math.floor(settings.proactive_check_interval_minutes / 60)}h ${settings.proactive_check_interval_minutes % 60 > 0 ? `${settings.proactive_check_interval_minutes % 60}m` : ""}`
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4 - Canali & Categorie */}
        <TabsContent value="canali" className="mt-5 space-y-5">
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
              <Zap className="h-5 w-5" />
              Canali Abilitati
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Scegli su quali canali il dipendente AI può operare
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-green-50 dark:bg-green-900/30">
                      <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Voice (Chiamate)</span>
                  </div>
                  <Switch
                    checked={settings.channels_enabled.voice}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      channels_enabled: { ...prev.channels_enabled, voice: checked },
                    }))}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {settings.channels_enabled.voice 
                    ? "Usato da: Alessia (chiamate), Marco (coaching vocale), Personalizza (se configurato)" 
                    : "Se disabilitato: Alessia, Marco e Personalizza non potranno effettuare chiamate vocali."}
                </p>
              </div>

              <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30">
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Email</span>
                  </div>
                  <Switch
                    checked={settings.channels_enabled.email}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      channels_enabled: { ...prev.channels_enabled, email: checked },
                    }))}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {settings.channels_enabled.email 
                    ? "Usato da: Millie (email personalizzate), Echo (invio riepiloghi), Iris (risposte email), Marco (comunicazioni)" 
                    : "Se disabilitato: Millie, Echo, Iris e Marco non potranno inviare email."}
                </p>
              </div>

              <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                      <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">WhatsApp</span>
                  </div>
                  <Switch
                    checked={settings.channels_enabled.whatsapp}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      channels_enabled: { ...prev.channels_enabled, whatsapp: checked },
                    }))}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {settings.channels_enabled.whatsapp 
                    ? "Usato da: Stella (messaggi WhatsApp), Marco (comunicazioni WhatsApp), Personalizza (se configurato)" 
                    : "Se disabilitato: Stella, Marco e Personalizza non potranno inviare messaggi WhatsApp."}
                </p>
              </div>
            </div>
          </div>

          {settings.channels_enabled.whatsapp && (
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                  <MessageSquare className="h-5 w-5 text-emerald-600" />
                  Template WhatsApp per Dipendenti AI
                </div>
                {(settings.whatsapp_template_ids || []).length > 0 && (
                  <Badge className="bg-emerald-500 text-white text-xs px-3 py-1">
                    {(settings.whatsapp_template_ids || []).length} selezionati
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Seleziona i template che i dipendenti AI useranno per inviare messaggi WhatsApp. Senza template, i messaggi verranno inviati come testo libero (funziona solo con conversazioni attive nelle ultime 24h).
              </p>

              {templatesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : whatsappTemplates.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Nessun template WhatsApp approvato trovato</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Configura i template nella sezione WhatsApp Templates
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {Object.entries(templatesByCategory).map(([categoryName, categoryTemplates]) => {
                    const isOpen = openTemplateCategories.has(categoryName);
                    const colors = TEMPLATE_CATEGORY_COLORS[categoryName] || TEMPLATE_CATEGORY_COLORS["Generale"];
                    const selectedInCategory = categoryTemplates.filter(t =>
                      (settings.whatsapp_template_ids || []).includes(t.id)
                    ).length;

                    return (
                      <Collapsible
                        key={categoryName}
                        open={isOpen}
                        onOpenChange={(open) => {
                          setOpenTemplateCategories(prev => {
                            const newSet = new Set(prev);
                            if (open) {
                              newSet.add(categoryName);
                            } else {
                              newSet.delete(categoryName);
                            }
                            return newSet;
                          });
                        }}
                      >
                        <CollapsibleTrigger asChild>
                          <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${colors.bg} ${colors.border} border hover:opacity-90`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${colors.icon}`}></div>
                              <span className={`font-semibold ${colors.text}`}>{categoryName}</span>
                              <Badge variant="outline" className={`text-xs ${colors.bg} ${colors.text} ${colors.border}`}>
                                {categoryTemplates.length} template
                              </Badge>
                              {selectedInCategory > 0 && (
                                <Badge className="bg-emerald-500 text-white text-xs">
                                  {selectedInCategory} selezionati
                                </Badge>
                              )}
                            </div>
                            <ChevronDown className={`h-4 w-4 ${colors.text} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="space-y-2 pl-2">
                            {categoryTemplates.map((template) => {
                              const isSelected = (settings.whatsapp_template_ids || []).includes(template.id);
                              return (
                                <label
                                  key={template.id}
                                  className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                                    isSelected
                                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 shadow-md"
                                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-200 hover:bg-gray-50"
                                  }`}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleAutonomyTemplateToggle(template.id, checked as boolean)}
                                    className="mt-1"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-gray-900 dark:text-white">
                                        {template.friendlyName}
                                      </span>
                                      <Badge className="text-xs bg-green-100 text-green-700 border-green-300">
                                        Approvato
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                                      {template.bodyText || "Template senza corpo visibile"}
                                    </p>
                                    <p className="text-xs text-gray-400 font-mono mt-2">
                                      {template.id}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}

              {(settings.whatsapp_template_ids || []).length === 0 && whatsappTemplates.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Nessun template selezionato. I dipendenti AI invieranno messaggi come testo libero, che funziona solo se la conversazione è attiva nelle ultime 24 ore.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 to-cyan-500" />
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                <Search className="h-5 w-5 text-teal-600" />
                Outreach Automatico (Hunter)
              </div>
              <Switch
                checked={outreachConfig.enabled}
                onCheckedChange={(checked) => updateOutreachConfig("enabled", checked)}
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Hunter trova lead automaticamente e li assegna ad Alessia, Stella e Millie per il primo contatto
            </p>

            {(() => {
              const hasSalesCtx = !!(savedSalesContext?.servicesOffered);
              const hasWaConfig = proactiveWaConfigs.length > 0;
              const selectedWa = !!outreachConfig.whatsapp_config_id;
              const hasTemplates = (settings.whatsapp_template_ids || []).length > 0;
              const readinessItems = [
                { ok: hasSalesCtx, label: "Sales Context compilato", desc: "Serve per capire cosa vendere ai lead", action: () => navigate("/consultant/lead-scraper"), actionLabel: "Compila Sales Context" },
                { ok: hasWaConfig, label: "Dipendente WhatsApp proattivo configurato", desc: "Serve un agente WA proattivo con Twilio configurato", action: () => navigate("/consultant/whatsapp"), actionLabel: "Configura WhatsApp" },
                { ok: selectedWa || !hasWaConfig, label: "Dipendente WA selezionato per outreach", desc: "Seleziona quale dipendente WA usare qui sotto", action: undefined, actionLabel: "" },
                { ok: hasTemplates, label: "Template WhatsApp selezionati", desc: "Seleziona almeno un template approvato nella sezione sopra", action: undefined, actionLabel: "" },
              ];
              const okCount = readinessItems.filter(c => c.ok).length;
              const allOk = okCount === readinessItems.length;
              return (
                <div className={cn("rounded-xl border p-4 mb-4", allOk ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10")}>
                  <div className="flex items-center gap-2 mb-2">
                    {allOk ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                    <span className="text-sm font-semibold">{allOk ? "Tutto configurato — Hunter è pronto" : `Configurazione: ${okCount}/${readinessItems.length} completata`}</span>
                  </div>
                  <div className="space-y-1.5">
                    {readinessItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {item.ok ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                          <div>
                            <span className={cn("text-xs", item.ok ? "text-muted-foreground" : "text-foreground font-medium")}>{item.label}</span>
                            {!item.ok && <p className="text-[10px] text-muted-foreground">{item.desc}</p>}
                          </div>
                        </div>
                        {!item.ok && item.action && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-teal-600 hover:text-teal-700" onClick={item.action}>
                            {item.actionLabel} <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {outreachConfig.enabled && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium flex items-center justify-between mb-2">
                        <span>Max ricerche Hunter / giorno</span>
                        <Badge variant="outline" className="text-xs">{outreachConfig.max_searches_per_day}</Badge>
                      </Label>
                      <Slider
                        value={[outreachConfig.max_searches_per_day]}
                        min={1}
                        max={20}
                        step={1}
                        onValueChange={([v]) => updateOutreachConfig("max_searches_per_day", v)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium flex items-center justify-between mb-2">
                        <span>Max chiamate Alessia / giorno</span>
                        <Badge variant="outline" className="text-xs">{outreachConfig.max_calls_per_day}</Badge>
                      </Label>
                      <Slider
                        value={[outreachConfig.max_calls_per_day]}
                        min={1}
                        max={50}
                        step={1}
                        onValueChange={([v]) => updateOutreachConfig("max_calls_per_day", v)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium flex items-center justify-between mb-2">
                        <span>Max WhatsApp Stella / giorno</span>
                        <Badge variant="outline" className="text-xs">{outreachConfig.max_whatsapp_per_day}</Badge>
                      </Label>
                      <Slider
                        value={[outreachConfig.max_whatsapp_per_day]}
                        min={1}
                        max={50}
                        step={1}
                        onValueChange={([v]) => updateOutreachConfig("max_whatsapp_per_day", v)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium flex items-center justify-between mb-2">
                        <span>Max email Millie / giorno</span>
                        <Badge variant="outline" className="text-xs">{outreachConfig.max_emails_per_day}</Badge>
                      </Label>
                      <Slider
                        value={[outreachConfig.max_emails_per_day]}
                        min={1}
                        max={100}
                        step={1}
                        onValueChange={([v]) => updateOutreachConfig("max_emails_per_day", v)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium flex items-center justify-between mb-2">
                        <span>Soglia score AI minimo</span>
                        <Badge variant="outline" className="text-xs">{outreachConfig.score_threshold}/100</Badge>
                      </Label>
                      <Slider
                        value={[outreachConfig.score_threshold]}
                        min={30}
                        max={90}
                        step={5}
                        onValueChange={([v]) => updateOutreachConfig("score_threshold", v)}
                      />
                      <p className="text-xs text-gray-400 mt-1">Solo lead con score AI &ge; {outreachConfig.score_threshold} verranno contattati</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium flex items-center justify-between mb-2">
                        <span>Cooldown tra contatti (ore)</span>
                        <Badge variant="outline" className="text-xs">{outreachConfig.cooldown_hours}h</Badge>
                      </Label>
                      <Slider
                        value={[outreachConfig.cooldown_hours]}
                        min={12}
                        max={168}
                        step={12}
                        onValueChange={([v]) => updateOutreachConfig("cooldown_hours", v)}
                      />
                      <p className="text-xs text-gray-400 mt-1">Tempo minimo prima di ricontattare lo stesso lead</p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-2 block">Dipendente WhatsApp per outreach</Label>
                      <Select
                        value={outreachConfig.whatsapp_config_id || "none"}
                        onValueChange={(v) => updateOutreachConfig("whatsapp_config_id", v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleziona dipendente WA" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessuno (disabilita WA outreach)</SelectItem>
                          {proactiveWaConfigs.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {proactiveWaConfigs.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">Nessun dipendente WA proattivo trovato</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-2 block">Template voce per outreach</Label>
                      <Select
                        value={outreachConfig.voice_template_id || "none"}
                        onValueChange={(v) => updateOutreachConfig("voice_template_id", v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleziona template voce" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Automatico (Hunter sceglie)</SelectItem>
                          {voiceTemplateOptions.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name} — {t.description}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Priorità canali di contatto</Label>
                  <p className="text-xs text-gray-400 mb-3">Trascina per riordinare. Hunter proverà i canali in questo ordine per ogni lead.</p>
                  <div className="space-y-2">
                    {outreachConfig.channel_priority.map((ch, idx) => {
                      const info = channelLabels[ch];
                      if (!info) return null;
                      return (
                        <div key={ch} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                          <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}.</span>
                          <span className={info.color}>{info.icon}</span>
                          <span className="flex-1 text-sm font-medium">{info.label}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={idx === 0}
                              onClick={() => moveChannelPriority(idx, "up")}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={idx === outreachConfig.channel_priority.length - 1}
                              onClick={() => moveChannelPriority(idx, "down")}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
              <ListTodo className="h-5 w-5" />
              Categorie Task Abilitate
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Scegli quali categorie di task il dipendente AI può gestire
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TASK_CATEGORIES.map((cat) => (
                <div key={cat.value} className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 overflow-hidden hover:shadow-md transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      id={`cat-${cat.value}`}
                      checked={settings.allowed_task_categories.includes(cat.value)}
                      onCheckedChange={() => toggleCategory(cat.value)}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor={`cat-${cat.value}`} className="text-sm font-medium cursor-pointer">
                        {cat.label}
                      </Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{cat.description}</p>
                      {!settings.allowed_task_categories.includes(cat.value) && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                          I task di questa categoria verranno scartati automaticamente dalla generazione autonoma
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 5 - Dipendenti AI */}
        <TabsContent value="dipendenti" className="mt-5 space-y-5">
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
              <Bot className="h-5 w-5" />
              Crea il tuo Dipendente AI
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Ogni dipendente AI ha competenze specifiche. Attivalo, espandi per vedere cosa sa fare, e personalizzalo con le tue istruzioni.
            </p>
            <div className="space-y-5">
              {systemStatus?.roles && systemStatus.roles.length > 0 ? (
                <div className="space-y-4">
                  {systemStatus.roles.map((role) => {
                    const profile = AI_ROLE_PROFILES[role.id];
                    const colors = AI_ROLE_ACCENT_COLORS[role.accentColor] || AI_ROLE_ACCENT_COLORS.purple;
                    const caps = AI_ROLE_CAPABILITIES[role.id];
                    const isExpanded = expandedRole === role.id;
                    const gradientClass = ROLE_GRADIENT_MAP[role.accentColor] || "from-purple-400 to-pink-500";
                    const channelLabel: Record<string, string> = {
                      voice: "Voce",
                      email: "Email",
                      whatsapp: "WhatsApp",
                      none: "Interno",
                    };
                    return (
                      <motion.div
                        key={role.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "relative rounded-2xl border overflow-hidden bg-white dark:bg-gray-900 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300",
                          role.enabled ? "border-gray-200 dark:border-gray-700/60" : "border-gray-200/60 dark:border-gray-800",
                          !role.enabled && "opacity-50 grayscale"
                        )}
                      >
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientClass}`} />
                        <div className="flex items-start gap-4 sm:gap-5 p-4 sm:p-5 cursor-pointer" onClick={() => setExpandedRole(isExpanded ? null : role.id)}>
                          <div className={cn("w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-2 shrink-0 mt-0.5", colors.ring)}>
                            {profile?.avatar ? (
                              <img src={profile.avatar} alt={role.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center text-xl">
                                {role.id === 'personalizza' ? '⚙️' : '🤖'}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-base">{role.name}</span>
                              <Badge className={cn("text-xs rounded-full px-2.5", colors.badge)}>
                                {profile?.role || role.shortDescription}
                              </Badge>
                            </div>
                            {profile?.quote && (
                              <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">"{profile.quote}"</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {roleStatuses?.[role.id] && (
                                <>
                                  <Badge variant="outline" className={cn("text-[10px] rounded-full px-2 py-0.5",
                                    roleStatuses[role.id].status === 'attivo' ? "text-emerald-600 border-emerald-300 bg-emerald-50/50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/20" :
                                    roleStatuses[role.id].status === 'fuori_orario' ? "text-amber-600 border-amber-300 bg-amber-50/50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/20" :
                                    roleStatuses[role.id].status === 'disabilitato' || roleStatuses[role.id].status === 'off' ? "text-red-600 border-red-300 bg-red-50/50 dark:text-red-400 dark:border-red-700 dark:bg-red-950/20" :
                                    "text-muted-foreground border-muted"
                                  )}>
                                    {roleStatuses[role.id].status === 'attivo' ? '● Attivo' :
                                     roleStatuses[role.id].status === 'fuori_orario' ? '◐ Fuori orario' :
                                     roleStatuses[role.id].status === 'off' ? '○ Off' :
                                     roleStatuses[role.id].status === 'solo_manuale' ? '◑ Solo manuale' :
                                     roleStatuses[role.id].status === 'sistema_spento' ? '○ Sistema spento' :
                                     '○ Disabilitato'}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0.5">
                                    Lv. {roleStatuses[role.id].effectiveLevel}{roleStatuses[role.id].hasCustomLevel ? '' : ' (globale)'}
                                  </Badge>
                                </>
                              )}
                              {role.preferredChannels.map(ch => (
                                <Badge key={ch} variant="outline" className="text-[10px] rounded-full px-2 py-0.5">
                                  {channelLabel[ch] || ch}
                                </Badge>
                              ))}
                              {role.total_tasks_30d > 0 && (
                                <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0.5">{role.total_tasks_30d} task (30gg)</Badge>
                              )}
                              {roleStatuses?.[role.id]?.lastExecution && (
                                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                  Ultimo: {new Date(roleStatuses[role.id].lastExecution!.at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/consultant/ai-autonomy/employee/${role.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Switch
                              checked={role.enabled}
                              disabled={togglingRole === role.id}
                              onCheckedChange={(checked) => {
                                onToggleRole(role.id, checked);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {isExpanded && caps && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-gray-100 dark:border-gray-800 bg-muted/20"
                          >
                            <div className="px-4 sm:px-5 pb-5 pt-4">
                              <Tabs defaultValue="profilo" className="w-full">
                                <TabsList className="bg-muted/40 rounded-full p-0.5 h-auto mb-5">
                                  <TabsTrigger value="profilo" className="text-xs h-8 rounded-full px-4 data-[state=active]:shadow-sm">
                                    <User className="h-3.5 w-3.5 mr-1.5" />
                                    Profilo
                                  </TabsTrigger>
                                  <TabsTrigger value="autonomia" className="text-xs h-8 rounded-full px-4 data-[state=active]:shadow-sm">
                                    <Shield className="h-3.5 w-3.5 mr-1.5" />
                                    Autonomia
                                  </TabsTrigger>
                                  <TabsTrigger value="integrazioni" className="text-xs h-8 rounded-full px-4 data-[state=active]:shadow-sm">
                                    <Cog className="h-3.5 w-3.5 mr-1.5" />
                                    Integrazioni
                                  </TabsTrigger>
                                </TabsList>

                                <TabsContent value="profilo" className="mt-0 space-y-6">
                                  <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5">
                                    <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                      Flusso di lavoro
                                    </p>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{caps.workflow}</p>
                                  </div>

                                  <div className="space-y-5">
                                    <div>
                                      <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4" />
                                        Cosa sa fare
                                        <Badge variant="outline" className="text-xs rounded-full px-2 py-0 text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">{caps.canDo.length} capacità</Badge>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {caps.canDo.map((item, idx) => (
                                          <div key={idx} className="flex items-center gap-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-3.5 py-2.5">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 text-sm">
                                              {item.icon}
                                            </div>
                                            <span className="text-sm">{item.text}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-sm font-semibold text-red-500 dark:text-red-400 mb-3 flex items-center gap-2">
                                        <XCircle className="h-4 w-4" />
                                        Cosa NON sa fare
                                        <Badge variant="outline" className="text-xs rounded-full px-2 py-0 text-red-500 border-red-300 dark:text-red-400 dark:border-red-700">{caps.cantDo.length} limitazioni</Badge>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {caps.cantDo.map((item, idx) => (
                                          <div key={idx} className="flex items-center gap-3 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 px-3.5 py-2.5">
                                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0 text-sm">
                                              {item.icon}
                                            </div>
                                            <span className="text-sm text-muted-foreground">{item.text}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {systemPrompts?.[role.id] && (
                                    <div className="pt-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs rounded-xl gap-1.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowPromptForRole(showPromptForRole === role.id ? null : role.id);
                                        }}
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        {showPromptForRole === role.id ? "Nascondi System Prompt" : "Vedi System Prompt"}
                                        {showPromptForRole === role.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                      </Button>
                                      {showPromptForRole === role.id && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: "auto" }}
                                          transition={{ duration: 0.2 }}
                                          className="mt-3"
                                        >
                                          <div className="rounded-2xl border border-border/40 bg-muted/30 dark:bg-gray-900/50 p-4">
                                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                                              <Brain className="h-3.5 w-3.5" />
                                              System Prompt completo di {systemPrompts[role.id].name}
                                            </p>
                                            <p className="text-xs text-muted-foreground mb-3 italic">
                                              Questo è il prompt che guida il comportamento di {systemPrompts[role.id].name}. Le sezioni con "--" vengono riempite dinamicamente ad ogni ciclo con dati reali.
                                            </p>
                                            <pre className="text-xs whitespace-pre-wrap font-mono bg-background dark:bg-gray-950 rounded-xl p-3 border border-border/40 max-h-[400px] overflow-y-auto leading-relaxed">
                                              {systemPrompts[role.id].systemPromptTemplate}
                                            </pre>
                                          </div>
                                        </motion.div>
                                      )}
                                    </div>
                                  )}

                                  {role.id === "hunter" && (() => {
                                    const hasSalesContext = !!(savedSalesContext?.servicesOffered);
                                    const hasWaConfig = proactiveWaConfigs.length > 0 && !!outreachConfig.whatsapp_config_id;
                                    const hasOutreachEnabled = !!outreachConfig.enabled;
                                    const checks = [
                                      { ok: hasSalesContext, label: "Sales Context compilato", fix: "Vai su Lead Scraper → Sales Agent", action: () => navigate("/consultant/lead-scraper") },
                                      { ok: hasOutreachEnabled, label: "Outreach attivato", fix: "Attivalo nella tab Canali", action: () => onTabChange("canali") },
                                      { ok: hasWaConfig, label: "Dipendente WhatsApp configurato", fix: "Seleziona in tab Canali → Outreach", action: () => onTabChange("canali") },
                                    ];
                                    const allOk = checks.every(c => c.ok);
                                    return (
                                      <div className="rounded-xl border p-4 space-y-3 mt-2" onClick={(e) => e.stopPropagation()}>
                                        <p className="text-sm font-semibold flex items-center gap-2">
                                          {allOk ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                                          {allOk ? "Hunter è pronto per lavorare" : "Configurazione richiesta"}
                                        </p>
                                        <div className="space-y-1.5">
                                          {checks.map((c, i) => (
                                            <div key={i} className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 text-xs">
                                                {c.ok
                                                  ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                  : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                                                <span className={c.ok ? "text-muted-foreground" : "text-foreground font-medium"}>{c.label}</span>
                                              </div>
                                              {!c.ok && (
                                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30" onClick={c.action}>
                                                  {c.fix} <ArrowRight className="h-3 w-3 ml-1" />
                                                </Button>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs rounded-xl gap-1.5 border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/30 text-teal-700 dark:text-teal-400"
                                            onClick={() => onTabChange("canali")}
                                          >
                                            <Cog className="h-3.5 w-3.5" />
                                            Configura Outreach
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs rounded-xl gap-1.5 border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 text-violet-700 dark:text-violet-400"
                                            onClick={() => navigate("/consultant/lead-scraper")}
                                          >
                                            <Search className="h-3.5 w-3.5" />
                                            Vai a Lead Scraper
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  <div className="flex items-center gap-3 pt-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      size="sm"
                                      className="h-9 text-xs rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTriggerRole(role.id, role.name);
                                      }}
                                      disabled={triggeringRoleId === role.id}
                                    >
                                      {triggeringRoleId === role.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Play className="h-3.5 w-3.5" />
                                      )}
                                      {triggeringRoleId === role.id ? 'Avvio in corso...' : `Avvia ora`}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-9 text-xs rounded-xl gap-2 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-300"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setChatOpenRoleId(role.id);
                                      }}
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                      Chatta
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-9 text-xs rounded-xl gap-2 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-300"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTelegramChatsRoleId(role.id);
                                      }}
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                      Telegram
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-9 text-xs rounded-xl gap-2 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:text-purple-700 dark:hover:text-purple-300"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMemoryOpenRoleId(memoryOpenRoleId === role.id ? null : role.id);
                                      }}
                                    >
                                      <Brain className="h-3.5 w-3.5" />
                                      Memoria
                                    </Button>
                                    {triggerRoleResult[role.id] && (
                                      <span className={cn("text-xs", triggerRoleResult[role.id].success ? "text-emerald-600" : "text-red-500")}>
                                        {triggerRoleResult[role.id].success
                                          ? `${triggerRoleResult[role.id].tasks} task generati`
                                          : (triggerRoleResult[role.id].error || 'Errore')}
                                      </span>
                                    )}
                                  </div>
                                </TabsContent>

                                <TabsContent value="autonomia" className="mt-0 space-y-6" onClick={(e) => e.stopPropagation()}>
                                  <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                      <div className="flex items-center gap-1.5">
                                        <ListTodo className="h-3.5 w-3.5" />
                                        <span className="text-sm font-medium text-foreground">Max {role.id === 'personalizza' ? '3' : role.id === 'nova' ? '1' : '2'} task per ciclo</span>
                                      </div>
                                      {role.total_tasks_30d > 0 && (
                                        <>
                                          <span className="text-muted-foreground/40">•</span>
                                          <span>{role.total_tasks_30d} task creati negli ultimi 30 giorni</span>
                                        </>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-sm font-medium">Frequenza:</span>
                                      <Select
                                        value={settings.role_frequencies[role.id] || "30"}
                                        onValueChange={(value) => {
                                          setSettings(prev => ({
                                            ...prev,
                                            role_frequencies: {
                                              ...prev.role_frequencies,
                                              [role.id]: value,
                                            },
                                          }));
                                        }}
                                      >
                                        <SelectTrigger className="h-8 w-[180px] text-xs rounded-xl border-border">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="15">Ogni 15 minuti</SelectItem>
                                          <SelectItem value="30">Ogni 30 minuti</SelectItem>
                                          <SelectItem value="60">Ogni ora</SelectItem>
                                          <SelectItem value="120">Ogni 2 ore</SelectItem>
                                          <SelectItem value="240">Ogni 4 ore</SelectItem>
                                          <SelectItem value="480">Ogni 8 ore</SelectItem>
                                          <SelectItem value="1440">Una volta al giorno</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-semibold flex items-center gap-2">
                                        <Shield className="h-4 w-4" />
                                        Livello di Autonomia
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                          <Checkbox
                                            checked={settings.role_autonomy_modes[role.id] === undefined || settings.role_autonomy_modes[role.id] === null}
                                            onCheckedChange={(checked) => {
                                              setSettings(prev => {
                                                const newModes = { ...prev.role_autonomy_modes };
                                                if (checked) {
                                                  delete newModes[role.id];
                                                } else {
                                                  newModes[role.id] = prev.autonomy_level;
                                                }
                                                return { ...prev, role_autonomy_modes: newModes };
                                              });
                                            }}
                                          />
                                          <span className="text-xs text-muted-foreground">Segui globale ({settings.autonomy_level})</span>
                                        </label>
                                      </div>
                                    </div>
                                    {(settings.role_autonomy_modes[role.id] !== undefined && settings.role_autonomy_modes[role.id] !== null) ? (
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">Livello personalizzato</span>
                                          <Badge className={cn("rounded-full text-xs px-2.5", getAutonomyBadgeColor(settings.role_autonomy_modes[role.id]))}>
                                            {settings.role_autonomy_modes[role.id]}/10
                                          </Badge>
                                        </div>
                                        <Slider
                                          value={[settings.role_autonomy_modes[role.id]]}
                                          onValueChange={(val) => {
                                            setSettings(prev => ({
                                              ...prev,
                                              role_autonomy_modes: {
                                                ...prev.role_autonomy_modes,
                                                [role.id]: val[0],
                                              },
                                            }));
                                          }}
                                          max={10}
                                          min={0}
                                          step={1}
                                          className="w-full"
                                        />
                                        <div className="flex justify-between">
                                          <span className="text-xs text-muted-foreground">0 Off</span>
                                          <span className="text-xs text-emerald-600 dark:text-emerald-400">1-3</span>
                                          <span className="text-xs text-amber-600 dark:text-amber-400">4-6</span>
                                          <span className="text-xs text-orange-600 dark:text-orange-400">7-9</span>
                                          <span className="text-xs text-red-600 dark:text-red-400">10</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {settings.role_autonomy_modes[role.id] === 0 ? `${role.name} è spento, non farà nulla`
                                            : settings.role_autonomy_modes[role.id] <= 1 ? `${role.name} eseguirà solo task manuali creati da te`
                                            : settings.role_autonomy_modes[role.id] <= 3 ? `${role.name} proporrà task ma chiederà approvazione`
                                            : settings.role_autonomy_modes[role.id] <= 6 ? `${role.name} eseguirà task automaticamente (no chiamate vocali)`
                                            : settings.role_autonomy_modes[role.id] <= 9 ? `${role.name} è quasi autonomo, anche chiamate vocali`
                                            : `${role.name} ha autonomia completa, fa tutto da solo`
                                          }
                                        </p>
                                        <div className="flex justify-end pt-1">
                                          <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-8 text-xs px-3 hover:bg-primary/10 hover:text-primary rounded-xl"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onSave();
                                            }}
                                            disabled={isSaving}
                                          >
                                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                            Salva
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">
                                        Segue il livello globale ({settings.autonomy_level}): {settings.autonomy_level >= 4 ? 'esegue da solo' : settings.autonomy_level >= 2 ? 'propone e chiede approvazione' : 'solo task manuali'}
                                      </p>
                                    )}
                                  </div>

                                  <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
                                    <p className="text-sm font-semibold flex items-center gap-2">
                                      <Brain className="h-4 w-4" />
                                      Modalità di ragionamento
                                    </p>
                                    <Select
                                      value={settings.role_reasoning_modes?.[role.id] || settings.reasoning_mode || "structured"}
                                      onValueChange={(val) => {
                                        setSettings(prev => ({
                                          ...prev,
                                          role_reasoning_modes: {
                                            ...prev.role_reasoning_modes,
                                            [role.id]: val,
                                          },
                                        }));
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs rounded-xl">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="structured">Strutturato</SelectItem>
                                        <SelectItem value="deep_think">Deep Think</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                      {(settings.role_reasoning_modes?.[role.id] || settings.reasoning_mode || "structured") === "structured"
                                        ? "Analisi con sezioni obbligatorie: osservazione, riflessione, decisione, auto-revisione"
                                        : "Loop agentico multi-step con analisi approfondita iterativa"}
                                    </p>
                                    <div className="flex items-center justify-between pt-1">
                                      {settings.role_reasoning_modes?.[role.id] && settings.role_reasoning_modes[role.id] !== (settings.reasoning_mode || "structured") && (
                                        <button
                                          className="text-xs text-muted-foreground hover:text-foreground underline"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSettings(prev => {
                                              const newModes = { ...prev.role_reasoning_modes };
                                              delete newModes[role.id];
                                              return { ...prev, role_reasoning_modes: newModes };
                                            });
                                          }}
                                        >
                                          Ripristina predefinito globale
                                        </button>
                                      )}
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-8 text-xs px-3 hover:bg-primary/10 hover:text-primary ml-auto rounded-xl"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSave();
                                        }}
                                        disabled={isSaving}
                                      >
                                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                        Salva
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-border/40 bg-white dark:bg-gray-900/50 p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-semibold flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Orario specifico
                                      </p>
                                      <Switch
                                        checked={!!settings.role_working_hours[role.id]}
                                        onCheckedChange={(checked) => {
                                          setSettings(prev => {
                                            const newRoleHours = { ...prev.role_working_hours };
                                            if (checked) {
                                              newRoleHours[role.id] = {
                                                start: prev.working_hours_start,
                                                end: prev.working_hours_end,
                                                days: [...prev.working_days],
                                              };
                                            } else {
                                              delete newRoleHours[role.id];
                                            }
                                            return { ...prev, role_working_hours: newRoleHours };
                                          });
                                        }}
                                      />
                                    </div>
                                    {settings.role_working_hours[role.id] ? (
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                          <Input
                                            type="time"
                                            value={settings.role_working_hours[role.id].start}
                                            onChange={(e) => {
                                              setSettings(prev => ({
                                                ...prev,
                                                role_working_hours: {
                                                  ...prev.role_working_hours,
                                                  [role.id]: { ...prev.role_working_hours[role.id], start: e.target.value },
                                                },
                                              }));
                                            }}
                                            className="h-8 text-xs rounded-xl w-28"
                                          />
                                          <span className="text-xs text-muted-foreground">-</span>
                                          <Input
                                            type="time"
                                            value={settings.role_working_hours[role.id].end}
                                            onChange={(e) => {
                                              setSettings(prev => ({
                                                ...prev,
                                                role_working_hours: {
                                                  ...prev.role_working_hours,
                                                  [role.id]: { ...prev.role_working_hours[role.id], end: e.target.value },
                                                },
                                              }));
                                            }}
                                            className="h-8 text-xs rounded-xl w-28"
                                          />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {DAYS_OF_WEEK.map((day) => (
                                            <button
                                              key={day.value}
                                              type="button"
                                              className={cn(
                                                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                                                settings.role_working_hours[role.id]?.days?.includes(day.value)
                                                  ? "bg-primary text-primary-foreground border-primary"
                                                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80 dark:bg-gray-800 dark:border-gray-700"
                                              )}
                                              onClick={() => {
                                                setSettings(prev => {
                                                  const currentDays = prev.role_working_hours[role.id]?.days || [];
                                                  const newDays = currentDays.includes(day.value)
                                                    ? currentDays.filter(d => d !== day.value)
                                                    : [...currentDays, day.value].sort();
                                                  return {
                                                    ...prev,
                                                    role_working_hours: {
                                                      ...prev.role_working_hours,
                                                      [role.id]: { ...prev.role_working_hours[role.id], days: newDays },
                                                    },
                                                  };
                                                });
                                              }}
                                            >
                                              {day.label.substring(0, 3)}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex justify-end pt-1">
                                          <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-8 text-xs px-3 hover:bg-primary/10 hover:text-primary rounded-xl"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onSave();
                                            }}
                                            disabled={isSaving}
                                          >
                                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                            Salva
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">
                                        Usa orario globale ({settings.working_hours_start} - {settings.working_hours_end})
                                      </p>
                                    )}
                                  </div>
                                </TabsContent>

                                <TabsContent value="integrazioni" className="mt-0 space-y-6">
                                  <AgentContextEditor roleId={role.id} roleName={role.name} kbDocuments={kbDocuments} />
                                  <TelegramConfig roleId={role.id} roleName={role.name} />
                                </TabsContent>
                              </Tabs>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Caricamento ruoli...
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
              <Cog className="h-5 w-5" />
              Configura Agente Personalizzato
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Personalizza completamente il comportamento del tuo agente AI custom. Queste impostazioni guidano come Personalizza analizza i clienti e crea task.
            </p>
            <div className="space-y-5">
              {personalizzaLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Nome personalizzato</Label>
                      <Input
                        value={personalizzaConfig.custom_name}
                        onChange={(e) => setPersonalizzaConfig(prev => ({ ...prev, custom_name: e.target.value }))}
                        placeholder="Es: Sofia, Luca, Assistente VIP..."
                        className="rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground">Come vuoi che si presenti questo agente</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Tono di voce</Label>
                      <Select
                        value={personalizzaConfig.tone_of_voice}
                        onValueChange={(v) => setPersonalizzaConfig(prev => ({ ...prev, tone_of_voice: v }))}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professionale">Professionale</SelectItem>
                          <SelectItem value="amichevole">Amichevole</SelectItem>
                          <SelectItem value="formale">Formale</SelectItem>
                          <SelectItem value="empatico">Empatico</SelectItem>
                          <SelectItem value="diretto">Diretto e conciso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Istruzioni dettagliate</Label>
                    <Textarea
                      value={personalizzaConfig.detailed_instructions}
                      onChange={(e) => setPersonalizzaConfig(prev => ({ ...prev, detailed_instructions: e.target.value }))}
                      placeholder="Descrivi in dettaglio cosa deve fare questo agente. Es: Contatta i clienti che non si fanno sentire da più di 2 settimane. Concentrati sui clienti con portafoglio sopra i 50.000€. Non disturbare mai il lunedì mattina..."
                      rows={5}
                      className="rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">Queste istruzioni hanno la massima priorità nel comportamento dell'agente</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Canali preferiti</Label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { id: "voice", label: "Voce", icon: <Phone className="h-3.5 w-3.5" /> },
                        { id: "email", label: "Email", icon: <Mail className="h-3.5 w-3.5" /> },
                        { id: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="h-3.5 w-3.5" /> },
                      ].map(ch => (
                        <label key={ch.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={personalizzaConfig.preferred_channels.includes(ch.id)}
                            onCheckedChange={(checked) => {
                              setPersonalizzaConfig(prev => ({
                                ...prev,
                                preferred_channels: checked
                                  ? [...prev.preferred_channels, ch.id]
                                  : prev.preferred_channels.filter(c => c !== ch.id)
                              }));
                            }}
                          />
                          <span className="flex items-center gap-1 text-sm">{ch.icon} {ch.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Categorie di task</Label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { id: "outreach", label: "Primo contatto" },
                        { id: "reminder", label: "Promemoria" },
                        { id: "followup", label: "Follow-up" },
                        { id: "analysis", label: "Analisi" },
                        { id: "report", label: "Report" },
                        { id: "check_in", label: "Check-in" },
                      ].map(cat => (
                        <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={personalizzaConfig.task_categories.includes(cat.id)}
                            onCheckedChange={(checked) => {
                              setPersonalizzaConfig(prev => ({
                                ...prev,
                                task_categories: checked
                                  ? [...prev.task_categories, cat.id]
                                  : prev.task_categories.filter(c => c !== cat.id)
                              }));
                            }}
                          />
                          <span className="text-sm">{cat.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Segmento clienti</Label>
                      <Select
                        value={personalizzaConfig.client_segments}
                        onValueChange={(v) => setPersonalizzaConfig(prev => ({ ...prev, client_segments: v }))}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti i clienti</SelectItem>
                          <SelectItem value="active">Solo attivi</SelectItem>
                          <SelectItem value="inactive">Solo inattivi</SelectItem>
                          <SelectItem value="high_value">Alto valore</SelectItem>
                          <SelectItem value="new">Nuovi clienti</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Frequenza analisi</Label>
                      <Select
                        value={personalizzaConfig.analysis_frequency}
                        onValueChange={(v) => setPersonalizzaConfig(prev => ({ ...prev, analysis_frequency: v }))}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="every_cycle">Ogni ciclo</SelectItem>
                          <SelectItem value="daily">Giornaliera</SelectItem>
                          <SelectItem value="twice_daily">Due volte al giorno</SelectItem>
                          <SelectItem value="weekly">Settimanale</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Max task per ciclo</Label>
                      <Select
                        value={String(personalizzaConfig.max_tasks_per_run)}
                        onValueChange={(v) => setPersonalizzaConfig(prev => ({ ...prev, max_tasks_per_run: parseInt(v) }))}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Regole di priorità</Label>
                    <Textarea
                      value={personalizzaConfig.priority_rules}
                      onChange={(e) => setPersonalizzaConfig(prev => ({ ...prev, priority_rules: e.target.value }))}
                      placeholder="Es: I clienti premium hanno sempre la priorità. Ignora i clienti che hanno già un appuntamento questa settimana."
                      rows={3}
                      className="rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">Regole aggiuntive per determinare l'ordine di priorità dei clienti</p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button onClick={onSavePersonalizza} disabled={personalizzaSaving} className="rounded-xl">
                      {personalizzaSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salva Configurazione Personalizza
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-1">
              <Shield className="h-5 w-5" />
              Blocchi Permanenti
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Task che l'AI non proporrà mai. Rimuovi un blocco per consentire nuovamente quel tipo di task.
            </p>
            {blocks.length === 0 ? (
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-xl px-4 py-3 border border-border">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Nessun blocco attivo. Puoi bloccare un task dalla Dashboard quando lo cancelli.</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {blocks.map((block) => (
                  <div key={block.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">
                        {block.contact_display_name || block.contact_name || "Tutti i clienti"}
                      </span>
                      {block.task_category ? getCategoryBadge(block.task_category) : (
                        <Badge variant="outline" className="text-xs rounded-lg">Tutte le categorie</Badge>
                      )}
                      <Badge variant="outline" className="text-xs rounded-lg">
                        {block.ai_role
                          ? (AI_ROLE_PROFILES[block.ai_role]?.role || block.ai_role.charAt(0).toUpperCase() + block.ai_role.slice(1))
                          : "Tutti i ruoli"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(block.blocked_at).toLocaleDateString("it-IT")}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                      onClick={() => handleDeleteBlock(block.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-5 space-y-5">
          {activityContent}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-5 space-y-5">
          {dashboardContent}
        </TabsContent>

        <TabsContent value="data-catalog" className="mt-5 space-y-5">
          {dataCatalogContent}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-4 border-t border-border mt-6">
        <Button onClick={onSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salva Impostazioni
        </Button>
      </div>

      {telegramChatsRoleId && (
        <TelegramChats
          roleId={telegramChatsRoleId}
          roleName={AI_ROLE_NAMES_MAP[telegramChatsRoleId] || telegramChatsRoleId}
          open={!!telegramChatsRoleId}
          onClose={() => setTelegramChatsRoleId(null)}
        />
      )}

      <Sheet open={!!memoryOpenRoleId} onOpenChange={(open) => !open && setMemoryOpenRoleId(null)}>
        <SheetContent side="left" className="w-[400px] sm:w-[500px] p-0">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <div>
                  <h3 className="font-semibold text-sm">Memoria di {memoryOpenRoleId && AI_ROLE_NAMES_MAP[memoryOpenRoleId]}</h3>
                  <p className="text-xs text-muted-foreground">Riassunti giornalieri delle conversazioni</p>
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              {memoryOpenRoleId && <AgentMemoryContent roleId={memoryOpenRoleId} />}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

export default SettingsTab;
