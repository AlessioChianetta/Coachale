import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, MessageSquare, User, Clock, Sparkles, Loader2, Phone, BookUser, Hash, Bot, X, FileText, Eye, AlertTriangle, Pencil } from "lucide-react";
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

interface TemplateAssignment {
  assignmentId: string;
  templateId: string;
  templateName: string;
  templateDescription: string | null;
  useCase: string;
  priority: number;
  body: string | null;
  isTwilioTemplate: boolean;
  isLegacy: boolean;
  activeVersion: {
    id: string | null;
    versionNumber: number | null;
    bodyText: string | null;
    twilioStatus: string | null;
  } | null;
}

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

  const [templates, setTemplates] = useState<TemplateAssignment[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [useManualInstruction, setUseManualInstruction] = useState(false);
  const [customContext, setCustomContext] = useState("");

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

  useEffect(() => {
    if (!form.agent_config_id) {
      setTemplates([]);
      setSelectedTemplateId("");
      setTemplateVariables({});
      setUseManualInstruction(false);
      return;
    }

    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      setSelectedTemplateId("");
      setTemplateVariables({});
      setUseManualInstruction(false);
      try {
        const res = await fetch(`/api/whatsapp/template-assignments/${form.agent_config_id}`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          const assignments: TemplateAssignment[] = data.assignments || [];
          setTemplates(assignments);
          if (assignments.length === 0) {
            setUseManualInstruction(true);
          }
        } else {
          setTemplates([]);
          setUseManualInstruction(true);
        }
      } catch {
        setTemplates([]);
        setUseManualInstruction(true);
      }
      setLoadingTemplates(false);
    };
    fetchTemplates();
  }, [form.agent_config_id]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.templateId === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const templateBody = useMemo(() => {
    if (!selectedTemplate) return "";
    return selectedTemplate.activeVersion?.bodyText || selectedTemplate.body || "";
  }, [selectedTemplate]);

  const extractedVariables = useMemo(() => {
    if (!templateBody) return [];
    const vars: string[] = [];
    const regex = /\{\{(\d+)\}\}/g;
    let match;
    while ((match = regex.exec(templateBody)) !== null) {
      if (!vars.includes(match[1])) vars.push(match[1]);
    }
    const namedRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    while ((match = namedRegex.exec(templateBody)) !== null) {
      if (!vars.includes(match[1])) vars.push(match[1]);
    }
    return vars;
  }, [templateBody]);

  useEffect(() => {
    if (extractedVariables.length === 0) {
      setTemplateVariables({});
      return;
    }
    const contactName = selectedContact?.name || manualName || "";
    const prefilled: Record<string, string> = {};
    for (const v of extractedVariables) {
      if (v === "1" || v === "nome_lead" || v === "nome") {
        prefilled[v] = contactName;
      } else if (v === "nome_consulente" || v === "mio_nome") {
        prefilled[v] = "";
      } else if (v === "nome_azienda" || v === "azienda") {
        prefilled[v] = "";
      } else {
        prefilled[v] = "";
      }
    }
    setTemplateVariables(prefilled);
  }, [extractedVariables, selectedContact, manualName]);

  const previewMessage = useMemo(() => {
    if (!templateBody) return "";
    let result = templateBody;
    for (const [key, val] of Object.entries(templateVariables)) {
      if (/^\d+$/.test(key)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val || `{{${key}}}`);
      } else {
        result = result.replace(new RegExp(`\\{${key}\\}`, "g"), val || `{${key}}`);
      }
    }
    return result;
  }, [templateBody, templateVariables]);

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
    if (contactMode === "rubrica") {
      if (!selectedContact) return false;
    } else {
      if (manualPhone.trim().length < 8) return false;
    }
    if (!useManualInstruction && !selectedTemplateId) return false;
    return true;
  }, [form.agent_config_id, contactMode, selectedContact, manualPhone, useManualInstruction, selectedTemplateId]);

  const handleSelectContact = (c: UnifiedContact) => {
    setSelectedContact(c);
    setContactSearch(c.name);
  };

  const handleClearContact = () => {
    setSelectedContact(null);
    setContactSearch("");
  };

  const normalizePhone = (raw: string): string => {
    let phone = raw.replace(/[\s\-().]/g, "");
    if (phone.startsWith("00")) {
      phone = "+" + phone.slice(2);
    }
    if (!phone.startsWith("+")) {
      if (phone.startsWith("3") && phone.length === 10) {
        phone = "+39" + phone;
      } else {
        phone = "+39" + phone;
      }
    }
    return phone;
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
      contactPhone = normalizePhone(selectedContact.phone);
      if (selectedContact.id.startsWith("client-")) {
        clientId = selectedContact.id.replace("client-", "");
      }
    } else {
      if (!manualPhone.trim() || manualPhone.trim().length < 8) {
        toast({ title: "Numero non valido", description: "Inserisci un numero di telefono valido", variant: "destructive" });
        return;
      }
      contactName = manualName.trim() || manualPhone.trim();
      contactPhone = normalizePhone(manualPhone.trim());
    }

    setSubmitting(true);
    try {
      const agentLabel = selectedAgent?.agentName || "agente";

      let additionalContext: any = null;
      let aiInstruction = "";

      if (selectedTemplate && !useManualInstruction) {
        aiInstruction = `Invia il template WhatsApp "${selectedTemplate.templateName}" a ${contactName}`;
        additionalContext = {
          use_wa_template: true,
          wa_template_name: selectedTemplate.templateName,
          wa_template_sid: selectedTemplate.templateId,
          wa_template_body: templateBody,
          wa_template_filled: previewMessage,
          wa_template_variables: templateVariables,
          ...(customContext.trim() ? { custom_context: customContext.trim() } : {}),
        };
      } else {
        aiInstruction = form.ai_instruction.trim() || `Invia un messaggio WhatsApp a ${contactName} seguendo le istruzioni di ${agentLabel}`;
        if (form.ai_instruction.trim()) {
          additionalContext = form.ai_instruction.trim();
        }
      }

      const body: Record<string, any> = {
        ai_instruction: aiInstruction,
        task_category: form.task_category,
        priority: form.priority,
        contact_name: contactName,
        contact_phone: contactPhone,
        preferred_channel: "whatsapp",
        tone: form.tone,
        urgency: form.urgency,
        scheduled_datetime: form.scheduled_datetime || new Date().toISOString(),
        additional_context: additionalContext ? (typeof additionalContext === "string" ? additionalContext : JSON.stringify(additionalContext)) : null,
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
        toast({ title: "Invio programmato", description: `Messaggio per ${contactName} programmato con successo` });
        setForm(initialForm);
        setContactSearch("");
        setSelectedContact(null);
        setManualName("");
        setManualPhone("");
        setSelectedTemplateId("");
        setTemplateVariables({});
        setUseManualInstruction(false);
        setCustomContext("");
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Errore", description: err.error || "Impossibile creare il task", variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const getVariableLabel = (key: string): string => {
    const labels: Record<string, string> = {
      "1": "Nome lead",
      "2": "Nome consulente",
      "3": "Nome azienda",
      "4": "Settore",
      "5": "Link",
      "nome_lead": "Nome lead",
      "nome": "Nome",
      "nome_consulente": "Nome consulente",
      "mio_nome": "Il tuo nome",
      "nome_azienda": "Nome azienda",
      "azienda": "Azienda",
      "uncino": "Uncino/Hook",
      "settore": "Settore",
      "booking_date": "Data appuntamento",
      "booking_time": "Ora appuntamento",
      "booking_meet_link": "Link meeting",
      "booking_client_name": "Nome cliente",
    };
    return labels[key] || `Variabile ${key}`;
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
            <p className="text-[11px] text-muted-foreground -mt-1">
              Scegli quale agente WhatsApp invierà il messaggio
            </p>
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
            <p className="text-[11px] text-muted-foreground -mt-1">
              A chi vuoi inviare il messaggio
            </p>
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
                    <span>• {normalizePhone(manualPhone.trim())}</span>
                    {!manualPhone.trim().startsWith("+") && (
                      <span className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 italic ml-auto">+39 aggiunto</span>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {form.agent_config_id && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Template messaggio
              </Label>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Seleziona un template approvato per il messaggio oppure scrivi istruzioni manuali
              </p>

              {loadingTemplates ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Caricamento template...
                </div>
              ) : templates.length === 0 ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2.5 border border-amber-200 dark:border-amber-800/50">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-xs">Nessun template assegnato</p>
                      <p className="text-[11px] mt-0.5 opacity-80">
                        Questo agente non ha template WhatsApp approvati. Puoi scrivere istruzioni manuali per l'AI.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {!useManualInstruction && (
                    <Select value={selectedTemplateId} onValueChange={(v) => { setSelectedTemplateId(v); setUseManualInstruction(false); }}>
                      <SelectTrigger className="border-emerald-200 dark:border-emerald-800/50">
                        <SelectValue placeholder="Scegli un template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.templateId} value={t.templateId}>
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-emerald-500" />
                              <div className="flex flex-col">
                                <span className="font-medium">{t.templateName}</span>
                                {t.body && (
                                  <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[300px]">
                                    {t.body.substring(0, 80)}{t.body.length > 80 ? "..." : ""}
                                  </span>
                                )}
                              </div>
                              {t.isTwilioTemplate && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 border-green-300 text-green-600 dark:border-green-700 dark:text-green-400 ml-auto">
                                  Twilio
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <button
                    onClick={() => { setUseManualInstruction(!useManualInstruction); if (!useManualInstruction) setSelectedTemplateId(""); }}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {useManualInstruction ? "← Usa un template" : "Scrivi istruzioni manuali invece"}
                  </button>
                </div>
              )}

              {selectedTemplate && !useManualInstruction && extractedVariables.length > 0 && (
                <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Compila le variabili del template
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {extractedVariables.map((v) => (
                      <div key={v} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {/^\d+$/.test(v) ? `{{${v}}}` : `{${v}}`} — {getVariableLabel(v)}
                        </Label>
                        <Input
                          placeholder={getVariableLabel(v)}
                          value={templateVariables[v] || ""}
                          onChange={(e) => setTemplateVariables((prev) => ({ ...prev, [v]: e.target.value }))}
                          className="border-emerald-200 dark:border-emerald-800/50 focus-visible:ring-emerald-500 h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTemplate && !useManualInstruction && previewMessage && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Eye className="h-3 w-3" />
                    Anteprima messaggio
                  </Label>
                  <div className="bg-[#e7ffdb] dark:bg-[#005c4b] rounded-lg rounded-tr-none p-3 max-w-sm ml-auto shadow-sm border border-green-200 dark:border-green-900/50">
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                      {previewMessage}
                    </p>
                    <div className="flex justify-end mt-1">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedTemplate && !useManualInstruction && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Contesto personalizzato
                  </Label>
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    Aggiungi note sul lead o istruzioni extra per l'AI (opzionale)
                  </p>
                  <Textarea
                    placeholder="Es: Il lead ha già mostrato interesse per il corso avanzato. Conosce già il nostro brand tramite Instagram. Chiamalo per nome, tono informale..."
                    value={customContext}
                    onChange={(e) => setCustomContext(e.target.value)}
                    rows={3}
                    className="border-emerald-200 dark:border-emerald-800/50 focus-visible:ring-emerald-500 resize-none"
                  />
                </div>
              )}

              {(useManualInstruction || templates.length === 0) && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Istruzioni per l'AI
                  </Label>
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    Descrivi cosa deve dire il messaggio. L'AI genererà il testo.
                  </p>
                  <Textarea
                    placeholder="Es: Il lead ha già parlato con noi 2 settimane fa ed era interessato al percorso premium. Budget circa 500€/mese. Tono amichevole, chiamalo per nome..."
                    value={form.ai_instruction}
                    onChange={(e) => setForm((prev) => ({ ...prev, ai_instruction: e.target.value }))}
                    rows={3}
                    className="border-emerald-200 dark:border-emerald-800/50 focus-visible:ring-emerald-500 resize-none"
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Data e ora di invio
            </Label>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Lascia vuoto per inviare il prima possibile
            </p>
            <Input
              type="datetime-local"
              value={form.scheduled_datetime}
              onChange={(e) => setForm((prev) => ({ ...prev, scheduled_datetime: e.target.value }))}
              className="border-emerald-200 dark:border-emerald-800/50"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Programmazione in corso...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Programma invio
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
