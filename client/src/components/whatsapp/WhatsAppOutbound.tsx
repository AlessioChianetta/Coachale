import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, MessageSquare, User, Clock, Sparkles, Loader2, Zap, Phone, BookUser, Hash, Bot, X } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface UnifiedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: "cliente" | "lead";
  role?: string;
}

interface WhatsAppAgent {
  id: string;
  agentName: string;
  isActive: boolean;
  twilioWhatsappNumber?: string;
  integrationMode?: string;
}

const QUICK_TEMPLATES = [
  { icon: "📅", label: "Prossima consulenza", text: "Ricordagli la prossima consulenza e chiedi se ha domande" },
  { icon: "🎯", label: "Follow-up obiettivi", text: "Fai un follow-up sul progresso degli obiettivi settimanali" },
  { icon: "💪", label: "Messaggio motivazionale", text: "Invia un messaggio motivazionale personalizzato" },
  { icon: "💬", label: "Feedback sessione", text: "Chiedi feedback sull'ultima sessione di coaching" },
  { icon: "🤝", label: "Prossimo incontro", text: "Proponi una data per il prossimo incontro" },
];

const URGENCY_OPTIONS = [
  { value: "oggi", label: "Oggi", color: "text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400" },
  { value: "settimana", label: "Questa settimana", color: "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400" },
  { value: "normale", label: "Normale", color: "text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400" },
];

const TONE_OPTIONS = [
  { value: "professionale", label: "Professionale" },
  { value: "amichevole", label: "Amichevole" },
  { value: "formale", label: "Formale" },
  { value: "empatico", label: "Empatico" },
];

const CATEGORY_OPTIONS = [
  { value: "followup", label: "Follow-up" },
  { value: "reminder", label: "Promemoria" },
  { value: "coaching", label: "Coaching" },
  { value: "marketing", label: "Marketing" },
  { value: "onboarding", label: "Onboarding" },
];

const PRIORITY_OPTIONS = [
  { value: 1, label: "Bassa", color: "bg-slate-200 dark:bg-slate-700" },
  { value: 2, label: "Media", color: "bg-blue-200 dark:bg-blue-700" },
  { value: 3, label: "Alta", color: "bg-amber-200 dark:bg-amber-700" },
  { value: 4, label: "Critica", color: "bg-red-200 dark:bg-red-700" },
];

const initialForm = {
  ai_instruction: "",
  task_category: "followup",
  priority: 2,
  preferred_channel: "whatsapp" as const,
  tone: "professionale",
  urgency: "normale",
  scheduled_datetime: "",
  agent_config_id: "",
};

export default function WhatsAppOutbound() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<UnifiedContact[]>([]);
  const [agents, setAgents] = useState<WhatsAppAgent[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [contactSearch, setContactSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [contactMode, setContactMode] = useState<"rubrica" | "manuale">("rubrica");
  const [selectedContact, setSelectedContact] = useState<UnifiedContact | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      const headers = getAuthHeaders();

      const [clientsRes, leadsRes, agentsRes] = await Promise.allSettled([
        fetch("/api/clients?activeOnly=true", { headers }),
        fetch("/api/proactive-leads", { headers }),
        fetch("/api/whatsapp/config", { headers }),
      ]);

      const unified: UnifiedContact[] = [];

      if (clientsRes.status === "fulfilled" && clientsRes.value.ok) {
        try {
          const data = await clientsRes.value.json();
          const arr = Array.isArray(data) ? data : [];
          arr.forEach((c: any) => {
            const firstName = c.first_name || c.firstName || "";
            const lastName = c.last_name || c.lastName || "";
            if (firstName || lastName) {
              unified.push({
                id: `client-${c.id}`,
                name: `${firstName} ${lastName}`.trim(),
                phone: c.phone_number || c.phoneNumber || "",
                email: c.email || "",
                source: "cliente",
                role: c.role || "client",
              });
            }
          });
        } catch {}
      }

      if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
        try {
          const data = await leadsRes.value.json();
          const leads = data?.leads || [];
          leads.forEach((l: any) => {
            if (l.firstName || l.lastName || l.first_name || l.last_name) {
              const name = `${l.firstName || l.first_name || ""} ${l.lastName || l.last_name || ""}`.trim();
              const phone = l.phoneNumber || l.phone_number || "";
              if (!unified.some((u) => u.phone && u.phone === phone)) {
                unified.push({
                  id: `lead-${l.id}`,
                  name,
                  phone,
                  source: "lead",
                });
              }
            }
          });
        } catch {}
      }

      setContacts(unified);
      setLoadingContacts(false);

      if (agentsRes.status === "fulfilled" && agentsRes.value.ok) {
        try {
          const agentData = await agentsRes.value.json();
          const arr = agentData?.configs || (Array.isArray(agentData) ? agentData : []);
          setAgents(arr.filter((a: any) => a.isActive !== false && a.is_active !== false).map((a: any) => ({
            id: a.id,
            agentName: a.agentName || a.agent_name || "Agente",
            isActive: true,
            twilioWhatsappNumber: a.twilioWhatsappNumber || a.twilio_whatsapp_number || "",
            integrationMode: a.integrationMode || a.integration_mode || "",
          })));
        } catch {}
      }
      setLoadingAgents(false);
    };
    fetchAll();
  }, []);

  const filteredClients = useMemo(() => {
    const clientList = contacts.filter((c) => c.source === "cliente");
    if (!contactSearch.trim()) return clientList.slice(0, 15);
    const q = contactSearch.toLowerCase();
    return clientList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [contacts, contactSearch]);

  const filteredLeads = useMemo(() => {
    const leadList = contacts.filter((c) => c.source === "lead");
    if (!contactSearch.trim()) return leadList.slice(0, 15);
    const q = contactSearch.toLowerCase();
    return leadList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [contacts, contactSearch]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === form.agent_config_id),
    [agents, form.agent_config_id]
  );

  const canSubmit = useMemo(() => {
    if (!form.agent_config_id) return false;
    if (contactMode === "rubrica") return !!selectedContact;
    return manualPhone.trim().length >= 8;
  }, [form.agent_config_id, contactMode, selectedContact, manualPhone]);

  const handleSelectContact = (c: UnifiedContact) => {
    setSelectedContact(c);
    setContactSearch(c.name);
  };

  const handleClearContact = () => {
    setSelectedContact(null);
    setContactSearch("");
  };

  const handleSubmit = async () => {
    if (!form.agent_config_id) {
      toast({ title: "Seleziona agente", description: "Scegli quale dipendente WhatsApp invia il messaggio", variant: "destructive" });
      return;
    }

    let contactName = "";
    let contactPhone = "";
    let clientId: string | undefined;

    if (contactMode === "rubrica") {
      if (!selectedContact) {
        toast({ title: "Seleziona destinatario", description: "Scegli un contatto dalla rubrica", variant: "destructive" });
        return;
      }
      contactName = selectedContact.name;
      contactPhone = selectedContact.phone;
      if (selectedContact.id.startsWith("client-")) {
        clientId = selectedContact.id.replace("client-", "");
      }
    } else {
      if (!manualPhone.trim() || manualPhone.trim().length < 8) {
        toast({ title: "Numero non valido", description: "Inserisci un numero di telefono valido", variant: "destructive" });
        return;
      }
      contactName = manualName.trim() || manualPhone.trim();
      contactPhone = manualPhone.trim();
    }

    setSubmitting(true);
    try {
      const agentLabel = selectedAgent?.agentName || "agente";
      const defaultInstruction = `Invia un messaggio WhatsApp a ${contactName} seguendo il template e le istruzioni di ${agentLabel}`;

      const body: Record<string, any> = {
        ai_instruction: defaultInstruction,
        task_category: form.task_category,
        priority: form.priority,
        contact_name: contactName,
        contact_phone: contactPhone,
        preferred_channel: "whatsapp",
        tone: form.tone,
        urgency: form.urgency,
        scheduled_datetime: form.scheduled_datetime || new Date().toISOString(),
        additional_context: form.ai_instruction.trim() || null,
        agent_config_id: form.agent_config_id,
        language: "it",
      };
      if (clientId) body.client_id = clientId;

      const res = await fetch("/api/ai-autonomy/tasks", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({ title: "Task WhatsApp creato", description: `Messaggio per ${contactName} programmato con successo` });
        setForm(initialForm);
        setContactSearch("");
        setSelectedContact(null);
        setManualName("");
        setManualPhone("");
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Errore", description: err.error || "Impossibile creare il task", variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200 dark:border-emerald-800/50 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            Nuovo Messaggio WhatsApp
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] ml-auto">
              Outbound
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Dipendente WhatsApp *
            </Label>
            {loadingAgents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Caricamento agenti...
              </div>
            ) : agents.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2 rounded-lg bg-muted/50">
                Nessun agente WhatsApp configurato
              </div>
            ) : (
              <Select value={form.agent_config_id} onValueChange={(v) => setForm((prev) => ({ ...prev, agent_config_id: v }))}>
                <SelectTrigger className="border-emerald-200 dark:border-emerald-800/50">
                  <SelectValue placeholder="Scegli chi invia il messaggio..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-3.5 w-3.5 text-emerald-500" />
                        <span>{a.agentName}</span>
                        {a.twilioWhatsappNumber && (
                          <span className="text-[10px] text-muted-foreground ml-1">({a.twilioWhatsappNumber})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedAgent && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-1.5">
                <Bot className="h-3 w-3" />
                <span className="font-medium">{selectedAgent.agentName}</span>
                {selectedAgent.twilioWhatsappNumber && <span>• {selectedAgent.twilioWhatsappNumber}</span>}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Destinatario *
            </Label>
            <Tabs value={contactMode} onValueChange={(v) => { setContactMode(v as any); handleClearContact(); setManualName(""); setManualPhone(""); }}>
              <TabsList className="grid grid-cols-2 h-9 w-full">
                <TabsTrigger value="rubrica" className="text-xs gap-1.5">
                  <BookUser className="h-3.5 w-3.5" />
                  Rubrica
                </TabsTrigger>
                <TabsTrigger value="manuale" className="text-xs gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  Numero manuale
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rubrica" className="mt-2 space-y-2">
                <Input
                  placeholder="Cerca per nome, telefono o email..."
                  value={contactSearch}
                  onChange={(e) => { setContactSearch(e.target.value); if (selectedContact) setSelectedContact(null); }}
                  className="border-emerald-200 dark:border-emerald-800/50 focus-visible:ring-emerald-500"
                />
                {!selectedContact && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg border-border bg-card">
                    {loadingContacts ? (
                      <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Caricamento...
                      </div>
                    ) : filteredClients.length === 0 && filteredLeads.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {contactSearch.trim() ? "Nessun risultato" : "Nessun contatto disponibile"}
                      </div>
                    ) : (
                      <>
                        {filteredClients.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 bg-blue-50/80 dark:bg-blue-950/20 border-b border-border/30 sticky top-0 z-10">
                              <span className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400 tracking-wider">
                                Clienti ({filteredClients.length})
                              </span>
                            </div>
                            {filteredClients.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => handleSelectContact(c)}
                                className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors flex items-center justify-between text-sm border-b border-border/20 last:border-0"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <User className="h-3 w-3 text-blue-500 shrink-0" />
                                  <span className="font-medium truncate">{c.name}</span>
                                  {c.role === "consultant" && (
                                    <Badge variant="outline" className="text-[8px] px-1 py-0 border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400">
                                      Consulente
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0 ml-2">{c.phone || c.email}</span>
                              </button>
                            ))}
                          </>
                        )}
                        {filteredLeads.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 bg-orange-50/80 dark:bg-orange-950/20 border-b border-border/30 sticky top-0 z-10">
                              <span className="text-[10px] uppercase font-semibold text-orange-600 dark:text-orange-400 tracking-wider">
                                Lead Proattivi ({filteredLeads.length})
                              </span>
                            </div>
                            {filteredLeads.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => handleSelectContact(c)}
                                className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors flex items-center justify-between text-sm border-b border-border/20 last:border-0"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Phone className="h-3 w-3 text-orange-500 shrink-0" />
                                  <span className="font-medium truncate">{c.name}</span>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0 ml-2">{c.phone}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
                {selectedContact && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2">
                    {selectedContact.source === "cliente" ? (
                      <User className="h-3 w-3 shrink-0 text-blue-500" />
                    ) : (
                      <Phone className="h-3 w-3 shrink-0 text-orange-500" />
                    )}
                    <span className="font-medium">{selectedContact.name}</span>
                    {selectedContact.phone && <span>• {selectedContact.phone}</span>}
                    <Badge variant="outline" className={cn(
                      "text-[9px] px-1.5 py-0",
                      selectedContact.source === "cliente"
                        ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"
                        : "border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400"
                    )}>
                      {selectedContact.source === "cliente" ? "Cliente" : "Lead"}
                    </Badge>
                    <button onClick={handleClearContact} className="ml-auto p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manuale" className="mt-2 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome (opzionale)</Label>
                    <Input
                      placeholder="Es: Mario Rossi"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="border-emerald-200 dark:border-emerald-800/50 focus-visible:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Numero di telefono *</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="+39 333 1234567"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="pl-8 border-emerald-200 dark:border-emerald-800/50 focus-visible:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
                {manualPhone.trim().length >= 8 && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-1.5">
                    <Phone className="h-3 w-3" />
                    <span className="font-medium">{manualName || "Contatto"}</span>
                    <span>• {manualPhone}</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Istruzioni aggiuntive e contesto
            </Label>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Queste informazioni vengono aggiunte al system prompt dell'agente. Segui attentamente o tieni a memoria.
            </p>
            <Textarea
              placeholder="Es: Il lead ha già parlato con noi 2 settimane fa ed era interessato al percorso premium. Budget circa 500€/mese. Tono amichevole, chiamalo per nome..."
              value={form.ai_instruction}
              onChange={(e) => setForm((prev) => ({ ...prev, ai_instruction: e.target.value }))}
              rows={3}
              className="border-emerald-200 dark:border-emerald-800/50 focus-visible:ring-emerald-500 resize-none"
            />
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Suggerimenti rapidi
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => setForm((prev) => ({ ...prev, ai_instruction: tpl.text }))}
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-lg border border-border text-left text-sm transition-all",
                    "hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 group"
                  )}
                >
                  <span className="text-base shrink-0">{tpl.icon}</span>
                  <div>
                    <div className="font-medium text-xs group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{tpl.label}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">{tpl.text}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Urgenza</Label>
              <div className="flex gap-2">
                {URGENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm((prev) => ({ ...prev, urgency: opt.value }))}
                    className={cn(
                      "flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition-all text-center",
                      form.urgency === opt.value ? opt.color : "border-border text-muted-foreground hover:border-emerald-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Tono</Label>
              <Select value={form.tone} onValueChange={(v) => setForm((prev) => ({ ...prev, tone: v }))}>
                <SelectTrigger className="border-emerald-200 dark:border-emerald-800/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Categoria</Label>
              <Select value={form.task_category} onValueChange={(v) => setForm((prev) => ({ ...prev, task_category: v }))}>
                <SelectTrigger className="border-emerald-200 dark:border-emerald-800/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Data/Ora programmata
              </Label>
              <Input
                type="datetime-local"
                value={form.scheduled_datetime}
                onChange={(e) => setForm((prev) => ({ ...prev, scheduled_datetime: e.target.value }))}
                className="border-emerald-200 dark:border-emerald-800/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Priorità</Label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setForm((prev) => ({ ...prev, priority: opt.value }))}
                  className={cn(
                    "flex-1 py-2 px-2 rounded-lg border text-xs font-medium transition-all text-center",
                    form.priority === opt.value
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30"
                      : "border-border text-muted-foreground hover:border-emerald-300"
                  )}
                >
                  <div className={cn("h-1.5 w-1.5 rounded-full mx-auto mb-1", opt.color)} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creazione in corso...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Invia Task WhatsApp
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
