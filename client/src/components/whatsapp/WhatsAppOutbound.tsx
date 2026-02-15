import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, User, Clock, Sparkles, Loader2, Zap } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
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
  contact_id: "",
  preferred_channel: "whatsapp" as const,
  tone: "professionale",
  urgency: "normale",
  scheduled_datetime: "",
};

export default function WhatsAppOutbound() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [clientSearch, setClientSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await fetch("/api/contacts", { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setContacts(Array.isArray(data) ? data : []);
        }
      } catch {}
      setLoadingContacts(false);
    };
    fetchContacts();
  }, []);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === form.contact_id),
    [contacts, form.contact_id]
  );

  const filteredContacts = useMemo(() => {
    if (!clientSearch.trim()) return contacts;
    const q = clientSearch.toLowerCase();
    return contacts.filter(
      (c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.phone_number?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [contacts, clientSearch]);

  const handleSubmit = async () => {
    if (!form.contact_id || !form.ai_instruction.trim()) {
      toast({ title: "Campi obbligatori", description: "Seleziona un cliente e scrivi un'istruzione", variant: "destructive" });
      return;
    }
    if (!selectedContact) return;

    setSubmitting(true);
    try {
      const body = {
        ai_instruction: form.ai_instruction,
        task_category: form.task_category,
        priority: form.priority,
        contact_name: `${selectedContact.first_name} ${selectedContact.last_name}`.trim(),
        contact_phone: selectedContact.phone_number || "",
        client_id: selectedContact.id,
        preferred_channel: "whatsapp",
        tone: form.tone,
        urgency: form.urgency,
        scheduled_datetime: form.scheduled_datetime || new Date().toISOString(),
        objective: "",
        additional_context: "",
        voice_template_suggestion: "",
        language: "it",
      };

      const res = await fetch("/api/ai-autonomy/tasks", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({ title: "✅ Task WhatsApp creato", description: `Messaggio per ${body.contact_name} programmato con successo` });
        setForm(initialForm);
        setClientSearch("");
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
    <div className="space-y-6 max-w-3xl mx-auto">
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

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Cliente *
            </Label>
            <Input
              placeholder="Cerca cliente per nome, telefono o email..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="border-emerald-200 dark:border-emerald-800/50 focus-visible:ring-emerald-500"
            />
            {(clientSearch.trim() || !form.contact_id) && (
              <div className="max-h-40 overflow-y-auto border rounded-lg border-border bg-card">
                {loadingContacts ? (
                  <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Caricamento clienti...
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    Nessun cliente trovato
                  </div>
                ) : (
                  filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, contact_id: c.id }));
                        setClientSearch(`${c.first_name} ${c.last_name}`);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors flex items-center justify-between text-sm",
                        form.contact_id === c.id && "bg-emerald-50 dark:bg-emerald-950/30 border-l-2 border-l-emerald-500"
                      )}
                    >
                      <span className="font-medium">{c.first_name} {c.last_name}</span>
                      <span className="text-xs text-muted-foreground">{c.phone_number || c.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedContact && form.contact_id && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-1.5">
                <User className="h-3 w-3" />
                <span className="font-medium">{selectedContact.first_name} {selectedContact.last_name}</span>
                {selectedContact.phone_number && <span>• {selectedContact.phone_number}</span>}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Istruzione per l'AI *
            </Label>
            <Textarea
              placeholder="Descrivi cosa vuoi che l'AI scriva al cliente..."
              value={form.ai_instruction}
              onChange={(e) => setForm((prev) => ({ ...prev, ai_instruction: e.target.value }))}
              rows={4}
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
            disabled={submitting || !form.contact_id || !form.ai_instruction.trim()}
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
