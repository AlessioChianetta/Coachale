import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  PhoneMissed,
  PhoneForwarded,
  PhoneOutgoing,
  Clock,
  Calendar,
  User,
  Search,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Building2,
  Target,
  Users,
  Wrench,
  Trophy,
  Briefcase,
  Sparkles,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Settings,
  Key,
  Copy,
  Check,
  Mic2,
  MessageSquare,
  Bot,
  FileText,
  RotateCcw,
  Save,
  Trash2,
  Play,
  Pause,
  Plus,
  ClipboardList,
  Bell,
  RepeatIcon,
  UserCheck,
  UserX,
  BookOpen,
  X,
  Package,
  Handshake,
  AlertTriangle,
  FileCheck,
  TrendingUp,
  Flag,
  List,
  Plug,
  Zap,
  CalendarDays,
  CalendarClock,
  CalendarRange,
  CalendarCheck,
  CalendarX,
  Circle,
  Timer,
  Pencil,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import { formatDistanceToNow, format, startOfWeek, addDays, isSameDay } from "date-fns";
import { it } from "date-fns/locale";

interface VoiceCall {
  id: string;
  caller_id: string;
  called_number: string;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  freeswitch_uuid: string;
  status: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  talk_time_seconds: number | null;
  ai_mode: string | null;
  outcome: string | null;
  telephony_minutes: number | null;
  ai_cost_estimate: number | null;
}

interface VoiceStats {
  total_calls: string;
  completed_calls: string;
  failed_calls: string;
  transferred_calls: string;
  avg_duration_seconds: string;
  total_minutes: string;
  total_cost_estimate: string;
  total_tokens_used: string;
}

interface HealthStatus {
  overall: string;
  components: {
    database: { status: string };
    esl: { status: string };
    freeswitch: { status: string };
    gemini: { status: string };
  };
}

interface TokenStatus {
  hasToken: boolean;
  tokenCount: number;
  lastGeneratedAt: string | null;
  revokedCount: number;
  message: string;
}

interface ScheduledVoiceCall {
  id: string;
  consultant_id: string;
  target_phone: string;
  scheduled_at: string | null;
  status: string;
  ai_mode: string;
  custom_prompt: string | null;
  voice_call_id: string | null;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
  call_instruction: string | null;
  instruction_type: 'task' | 'reminder' | null;
  retry_reason: string | null;
  next_retry_at: string | null;
  duration_seconds: number | null;
  hangup_cause: string | null;
}

interface AITask {
  id: string;
  consultant_id: string;
  contact_name: string | null;
  contact_phone: string;
  task_type: 'single_call' | 'follow_up' | 'ai_task';
  ai_instruction: string;
  scheduled_at: string;
  timezone: string;
  recurrence_type: 'once' | 'daily' | 'weekly' | 'custom';
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
  max_attempts: number;
  current_attempt: number;
  retry_delay_minutes: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'paused' | 'retry_pending' | 'cancelled';
  result_summary: string | null;
  voice_call_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface ClientWithPhone {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  lastContact: string | null;
}

interface TemplateField {
  name: string;
  label: string;
  type: 'text' | 'date' | 'time' | 'number' | 'select';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface TemplateItem {
  label: string;
  text: string;
  type: 'task' | 'reminder';
  fields?: TemplateField[];
  generateText?: (values: Record<string, string>) => string;
}

interface TemplateCategory {
  icon: React.ElementType;
  label: string;
  color: string;
  category: string;
  items: TemplateItem[];
}

const TEMPLATE_LIBRARY: TemplateCategory[] = [
  {
    icon: Calendar,
    category: "appuntamenti",
    label: "Appuntamenti",
    color: "text-blue-600",
    items: [
      { 
        label: "Conferma appuntamento", 
        text: "Conferma appuntamento",
        type: "task",
        fields: [
          { name: 'date', label: 'Data appuntamento', type: 'date', required: true },
          { name: 'time', label: 'Ora', type: 'time', required: true },
          { name: 'purpose', label: 'Motivo', type: 'text', placeholder: 'Es: consulenza fiscale' },
        ],
        generateText: (v) => `Chiedi conferma per l'appuntamento del ${v.date} alle ${v.time}${v.purpose ? ` per ${v.purpose}` : ''}. Se non può, proponi alternativa.`
      },
      { 
        label: "Richiesta nuovo appuntamento", 
        text: "Richiesta appuntamento",
        type: "task",
        fields: [
          { name: 'reason', label: 'Motivo incontro', type: 'text', placeholder: 'Es: revisione pratica', required: true },
          { name: 'preferredDay', label: 'Giorno preferito', type: 'select', options: ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'] },
        ],
        generateText: (v) => `Proponi di fissare un nuovo appuntamento per ${v.reason}${v.preferredDay ? `. Preferibilmente ${v.preferredDay}` : ''}. Chiedi disponibilità.`
      },
      { 
        label: "Promemoria domani", 
        text: "Promemoria appuntamento",
        type: "reminder",
        fields: [
          { name: 'time', label: 'Ora appuntamento', type: 'time', required: true },
          { name: 'location', label: 'Luogo', type: 'text', placeholder: 'Es: ufficio, online' },
        ],
        generateText: (v) => `Ricordagli l'appuntamento di domani alle ${v.time}${v.location ? ` (${v.location})` : ''}. Chiedi conferma.`
      },
      { 
        label: "Riprogrammazione", 
        text: "Riprogrammazione appuntamento",
        type: "reminder",
        fields: [
          { name: 'originalDate', label: 'Data originale', type: 'date', required: true },
          { name: 'reason', label: 'Motivo cambio', type: 'text', placeholder: 'Es: impegno imprevisto' },
        ],
        generateText: (v) => `Proponi di riprogrammare l'appuntamento previsto per il ${v.originalDate}${v.reason ? ` (${v.reason})` : ''}. Chiedi nuova disponibilità.`
      },
    ]
  },
  {
    icon: Target,
    category: "pagamenti",
    label: "Pagamenti",
    color: "text-green-600",
    items: [
      { 
        label: "Scadenza in arrivo", 
        text: "Promemoria scadenza",
        type: "reminder",
        fields: [
          { name: 'amount', label: 'Importo (€)', type: 'number', required: true },
          { name: 'dueDate', label: 'Scadenza', type: 'date', required: true },
          { name: 'description', label: 'Descrizione', type: 'text', placeholder: 'Es: rata mutuo' },
        ],
        generateText: (v) => `Ricordagli che ha una scadenza di €${v.amount} il ${v.dueDate}${v.description ? ` (${v.description})` : ''}. Chiedi se ha bisogno di assistenza.`
      },
      { 
        label: "Sollecito scaduto", 
        text: "Sollecito pagamento",
        type: "reminder",
        fields: [
          { name: 'amount', label: 'Importo (€)', type: 'number', required: true },
          { name: 'daysOverdue', label: 'Giorni di ritardo', type: 'number', required: true },
        ],
        generateText: (v) => `Sollecita gentilmente il pagamento di €${v.amount} scaduto da ${v.daysOverdue} giorni. Chiedi se ci sono difficoltà e proponi soluzioni.`
      },
      { 
        label: "Rate in scadenza", 
        text: "Promemoria rate",
        type: "reminder",
        fields: [
          { name: 'numRates', label: 'Numero rate', type: 'number', required: true },
          { name: 'totalAmount', label: 'Importo totale (€)', type: 'number', required: true },
        ],
        generateText: (v) => `Ricordagli che ha ${v.numRates} rate in scadenza questo mese per un totale di €${v.totalAmount}. Verifica che sia tutto in ordine.`
      },
      { 
        label: "Conferma pagamento", 
        text: "Conferma ricezione pagamento",
        type: "task",
        fields: [
          { name: 'amount', label: 'Importo (€)', type: 'number', required: true },
          { name: 'paymentDate', label: 'Data pagamento', type: 'date', required: true },
          { name: 'method', label: 'Metodo', type: 'select', options: ['Bonifico', 'Carta', 'Contanti', 'Altro'] },
        ],
        generateText: (v) => `Conferma la ricezione del pagamento di €${v.amount} del ${v.paymentDate}${v.method ? ` (${v.method})` : ''}. Ringrazia per la puntualità.`
      },
    ]
  },
  {
    icon: FileCheck,
    category: "documenti",
    label: "Documenti",
    color: "text-purple-600",
    items: [
      { 
        label: "Richiesta documenti", 
        text: "Richiesta documenti",
        type: "task",
        fields: [
          { name: 'documents', label: 'Documenti richiesti', type: 'text', placeholder: 'Es: carta identità, codice fiscale', required: true },
          { name: 'reason', label: 'Motivo', type: 'text', placeholder: 'Es: apertura pratica' },
        ],
        generateText: (v) => `Richiedi i seguenti documenti: ${v.documents}${v.reason ? ` per ${v.reason}` : ''}. Spiega come inviarli.`
      },
      { 
        label: "Firma contratto", 
        text: "Richiesta firma contratto",
        type: "task",
        fields: [
          { name: 'contractType', label: 'Tipo contratto', type: 'text', placeholder: 'Es: consulenza annuale', required: true },
          { name: 'sentDate', label: 'Data invio', type: 'date', required: true },
        ],
        generateText: (v) => `Chiedi se ha firmato il contratto di ${v.contractType} inviato il ${v.sentDate}. Offri assistenza per eventuali dubbi.`
      },
      { 
        label: "Conferma ricezione", 
        text: "Conferma ricezione documenti",
        type: "reminder",
        fields: [
          { name: 'documentType', label: 'Tipo documento', type: 'text', placeholder: 'Es: preventivo, fattura', required: true },
        ],
        generateText: (v) => `Conferma la corretta ricezione dei documenti (${v.documentType}). Chiedi se ha domande.`
      },
      { 
        label: "Invio preventivo", 
        text: "Notifica invio preventivo",
        type: "reminder",
        fields: [
          { name: 'subject', label: 'Oggetto preventivo', type: 'text', placeholder: 'Es: ristrutturazione ufficio', required: true },
          { name: 'amount', label: 'Importo (€)', type: 'number' },
        ],
        generateText: (v) => `Informalo dell'invio del preventivo per ${v.subject}${v.amount ? ` (€${v.amount})` : ''} via email. Chiedi di revisionarlo.`
      },
    ]
  },
  {
    icon: TrendingUp,
    category: "commerciale",
    label: "Commerciale",
    color: "text-orange-600",
    items: [
      { 
        label: "Proposta servizio", 
        text: "Proposta nuovo servizio",
        type: "task",
        fields: [
          { name: 'serviceName', label: 'Nome servizio', type: 'text', placeholder: 'Es: consulenza premium', required: true },
          { name: 'benefits', label: 'Benefici principali', type: 'text', placeholder: 'Es: risparmio tempo, assistenza dedicata' },
        ],
        generateText: (v) => `Proponi il servizio "${v.serviceName}"${v.benefits ? `. Benefici: ${v.benefits}` : ''}. Verifica interesse e fissa appuntamento.`
      },
      { 
        label: "Follow-up preventivo", 
        text: "Follow-up preventivo",
        type: "task",
        fields: [
          { name: 'sentDate', label: 'Data invio preventivo', type: 'date', required: true },
          { name: 'amount', label: 'Importo (€)', type: 'number' },
        ],
        generateText: (v) => `Chiedi se ha ricevuto il preventivo inviato il ${v.sentDate}${v.amount ? ` (€${v.amount})` : ''} e se ha domande. Offri chiarimenti.`
      },
      { 
        label: "Cross-sell", 
        text: "Proposta servizio complementare",
        type: "task",
        fields: [
          { name: 'currentService', label: 'Servizio attuale', type: 'text', placeholder: 'Es: contabilità base', required: true },
          { name: 'proposedService', label: 'Servizio proposto', type: 'text', placeholder: 'Es: consulenza fiscale', required: true },
        ],
        generateText: (v) => `Proponi "${v.proposedService}" come complemento a "${v.currentService}". Spiega i vantaggi dell'integrazione.`
      },
      { 
        label: "Rinnovo contratto", 
        text: "Promemoria rinnovo",
        type: "reminder",
        fields: [
          { name: 'expiryDate', label: 'Data scadenza', type: 'date', required: true },
          { name: 'conditions', label: 'Condizioni rinnovo', type: 'text', placeholder: 'Es: stesso prezzo, nuovi servizi inclusi' },
        ],
        generateText: (v) => `Ricordagli che il contratto scade il ${v.expiryDate}${v.conditions ? `. Condizioni rinnovo: ${v.conditions}` : ''}. Proponi di discutere il rinnovo.`
      },
    ]
  },
  {
    icon: Package,
    category: "ordini",
    label: "Ordini",
    color: "text-cyan-600",
    items: [
      { 
        label: "Stato spedizione", 
        text: "Aggiornamento spedizione",
        type: "reminder",
        fields: [
          { name: 'orderNumber', label: 'Numero ordine', type: 'text', placeholder: 'Es: ORD-12345', required: true },
          { name: 'expectedDate', label: 'Data prevista consegna', type: 'date', required: true },
        ],
        generateText: (v) => `Informalo sullo stato della spedizione ordine ${v.orderNumber}. Consegna prevista: ${v.expectedDate}. Chiedi se l'indirizzo è corretto.`
      },
      { 
        label: "Conferma consegna", 
        text: "Verifica consegna",
        type: "reminder",
        fields: [
          { name: 'product', label: 'Prodotto consegnato', type: 'text', placeholder: 'Es: materiale ufficio', required: true },
          { name: 'deliveryDate', label: 'Data consegna', type: 'date', required: true },
        ],
        generateText: (v) => `Verifica che abbia ricevuto correttamente "${v.product}" consegnato il ${v.deliveryDate}. Chiedi se è tutto conforme.`
      },
      { 
        label: "Richiesta feedback", 
        text: "Richiesta feedback",
        type: "task",
        fields: [
          { name: 'product', label: 'Prodotto/Servizio', type: 'text', placeholder: 'Es: software gestionale', required: true },
        ],
        generateText: (v) => `Chiedi un feedback su "${v.product}". Cosa funziona bene? Cosa si potrebbe migliorare? Ringrazia per l'opinione.`
      },
    ]
  },
  {
    icon: Handshake,
    category: "relazione",
    label: "Relazione",
    color: "text-pink-600",
    items: [
      { 
        label: "Check-in periodico", 
        text: "Check-in cliente",
        type: "task",
        fields: [
          { name: 'lastContact', label: 'Ultimo contatto', type: 'date' },
        ],
        generateText: (v) => `Fai un check-in per sapere come va${v.lastContact ? ` (ultimo contatto: ${v.lastContact})` : ''}. Chiedi se ha bisogno di supporto.`
      },
      { 
        label: "Riattivazione", 
        text: "Riattivazione cliente",
        type: "task",
        fields: [
          { name: 'monthsInactive', label: 'Mesi di inattività', type: 'number', required: true },
          { name: 'proposedService', label: 'Servizio da proporre', type: 'text', placeholder: 'Es: nuovo pacchetto base' },
        ],
        generateText: (v) => `Ricontatta dopo ${v.monthsInactive} mesi di inattività. Chiedi come va e${v.proposedService ? ` proponi "${v.proposedService}"` : ' se è interessato a riprendere la collaborazione'}.`
      },
      { 
        label: "Auguri", 
        text: "Auguri speciali",
        type: "reminder",
        fields: [
          { name: 'occasion', label: 'Occasione', type: 'select', options: ['Compleanno', 'Natale', 'Pasqua', 'Anno Nuovo', 'Altro'], required: true },
        ],
        generateText: (v) => `Fai gli auguri per ${v.occasion}. Sii cordiale e personale. Chiedi come sta.`
      },
      { 
        label: "Ringraziamento", 
        text: "Ringraziamento",
        type: "reminder",
        fields: [
          { name: 'reason', label: 'Motivo ringraziamento', type: 'text', placeholder: 'Es: rinnovo contratto, referenza', required: true },
        ],
        generateText: (v) => `Ringrazia per ${v.reason}. Esprimi gratitudine per la fiducia accordata e la collaborazione.`
      },
    ]
  },
  {
    icon: AlertTriangle,
    category: "urgenze",
    label: "Urgenze",
    color: "text-red-600",
    items: [
      { 
        label: "Scadenza fiscale", 
        text: "Avviso scadenza fiscale",
        type: "reminder",
        fields: [
          { name: 'deadlineType', label: 'Tipo scadenza', type: 'text', placeholder: 'Es: IVA trimestrale, F24', required: true },
          { name: 'date', label: 'Data scadenza', type: 'date', required: true },
        ],
        generateText: (v) => `URGENTE: Avvisa della scadenza fiscale "${v.deadlineType}" del ${v.date}. Chiedi se ha già provveduto o se serve assistenza.`
      },
      { 
        label: "Variazione importante", 
        text: "Comunicazione variazione",
        type: "reminder",
        fields: [
          { name: 'changeType', label: 'Tipo variazione', type: 'text', placeholder: 'Es: cambio normativa, nuovo listino', required: true },
        ],
        generateText: (v) => `IMPORTANTE: Comunica la variazione riguardante "${v.changeType}". Spiega cosa cambia e quali azioni sono necessarie.`
      },
      { 
        label: "Azione immediata", 
        text: "Richiesta azione urgente",
        type: "task",
        fields: [
          { name: 'action', label: 'Azione richiesta', type: 'text', placeholder: 'Es: firma documento, bonifico urgente', required: true },
          { name: 'deadline', label: 'Deadline', type: 'date', required: true },
        ],
        generateText: (v) => `URGENTE: Richiedi azione immediata - ${v.action}. Scadenza tassativa: ${v.deadline}. Verifica che possa procedere subito.`
      },
    ]
  },
];

interface NonClientSettings {
  voiceDirectives: string;
  // Inbound settings
  inboundPromptSource: 'agent' | 'manual' | 'default';
  inboundTemplateId: string;
  inboundAgentId: string | null;
  inboundManualPrompt: string;
  // Outbound settings
  outboundPromptSource: 'agent' | 'manual' | 'default';
  outboundTemplateId: string;
  outboundAgentId: string | null;
  outboundManualPrompt: string;
  // Template options (with prompt for preview)
  availableInboundTemplates: Array<{ id: string; name: string; description: string; prompt: string }>;
  availableOutboundTemplates: Array<{ id: string; name: string; description: string; prompt: string }>;
  // Legacy
  defaultVoiceDirectives: string;
  availableAgents: Array<{
    id: string;
    name: string;
    persona: string | null;
    prompt: string | null;
    status: string;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  ringing: { label: "In Arrivo", icon: PhoneIncoming, color: "bg-yellow-500" },
  answered: { label: "Connessa", icon: Phone, color: "bg-blue-500" },
  talking: { label: "In Corso", icon: Phone, color: "bg-green-500" },
  completed: { label: "Completata", icon: CheckCircle, color: "bg-green-600" },
  failed: { label: "Fallita", icon: PhoneMissed, color: "bg-red-500" },
  transferred: { label: "Trasferita", icon: PhoneForwarded, color: "bg-purple-500" },
  ended: { label: "Terminata", icon: PhoneOff, color: "bg-gray-500" },
};

const OUTBOUND_STATUS_CONFIG: Record<string, { label: string; color: string; icon?: string }> = {
  pending: { label: "In Attesa", color: "bg-yellow-500", icon: "⏳" },
  calling: { label: "Chiamando...", color: "bg-blue-500", icon: "📞" },
  ringing: { label: "Sta Squillando", color: "bg-blue-400", icon: "🔔" },
  talking: { label: "In Corso", color: "bg-green-500", icon: "🗣️" },
  completed: { label: "Completata", color: "bg-green-600", icon: "✅" },
  no_answer: { label: "Nessuna Risposta", color: "bg-orange-500", icon: "📵" },
  busy: { label: "Occupato", color: "bg-orange-400", icon: "🔴" },
  short_call: { label: "Staccata", color: "bg-orange-600", icon: "⚡" },
  retry_scheduled: { label: "Retry Programmato", color: "bg-purple-500", icon: "🔄" },
  failed: { label: "Fallita", color: "bg-red-500", icon: "❌" },
  cancelled: { label: "Cancellata", color: "bg-gray-500", icon: "🚫" },
};

const VOICES = [
  { value: 'Achernar', label: 'Achernar', description: '🇮🇹 Femminile Professionale' },
  { value: 'Puck', label: 'Puck', description: '🇬🇧 Maschile Giovane' },
  { value: 'Charon', label: 'Charon', description: '🇬🇧 Maschile Maturo' },
  { value: 'Kore', label: 'Kore', description: '🇬🇧 Femminile Giovane' },
  { value: 'Fenrir', label: 'Fenrir', description: '🇬🇧 Maschile Profondo' },
  { value: 'Aoede', label: 'Aoede', description: '🇬🇧 Femminile Melodiosa' },
];

interface PromptSection {
  icon: React.ReactNode;
  title: string;
  content: string;
  color: string;
}

function AgentPromptPreview({ prompt, agentName }: { prompt: string; agentName: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['instructions']));

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const parsePrompt = (text: string): { instructions: string; sections: PromptSection[] } => {
    const sectionPatterns = [
      { pattern: /━+\n🏢 BUSINESS & IDENTITÀ\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Building2 className="h-4 w-4" />, title: "Business & Identità", color: "text-blue-500" },
      { pattern: /━+\n🎯 POSIZIONAMENTO\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Target className="h-4 w-4" />, title: "Posizionamento", color: "text-purple-500" },
      { pattern: /━+\n👥 TARGET\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Users className="h-4 w-4" />, title: "Target", color: "text-green-500" },
      { pattern: /━+\n🔧 METODO\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Wrench className="h-4 w-4" />, title: "Metodo", color: "text-orange-500" },
      { pattern: /━+\n🏆 CREDENZIALI\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Trophy className="h-4 w-4" />, title: "Credenziali", color: "text-yellow-500" },
      { pattern: /━+\n💼 SERVIZI\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Briefcase className="h-4 w-4" />, title: "Servizi", color: "text-cyan-500" },
      { pattern: /━+\n🤖 PERSONALITÀ AI\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Sparkles className="h-4 w-4" />, title: "Personalità AI", color: "text-pink-500" },
    ];

    const sections: PromptSection[] = [];
    let instructions = text;

    for (const { pattern, icon, title, color } of sectionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]?.trim()) {
        sections.push({ icon, title, content: match[1].trim(), color });
        instructions = instructions.replace(match[0], '');
      }
    }

    instructions = instructions.replace(/━+/g, '').trim();

    return { instructions, sections };
  };

  const { instructions, sections } = parsePrompt(prompt);
  const hasInstructions = instructions.length > 0;
  const hasSections = sections.length > 0;

  return (
    <div className="mt-3 rounded-lg border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Anteprima: {agentName}</span>
          {hasSections && (
            <Badge variant="secondary" className="text-xs">
              {sections.length} sezioni Brand Voice
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {isExpanded && (
        <div className="border-t p-3 space-y-3 max-h-[400px] overflow-auto">
          {hasInstructions && (
            <div className="space-y-2">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection('instructions')}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-medium">Istruzioni Agente</span>
                </div>
                {expandedSections.has('instructions') ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                )}
              </div>
              {expandedSections.has('instructions') && (
                <div className="ml-6 p-3 bg-white dark:bg-slate-950 rounded-md border text-xs leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-auto">
                  {instructions}
                </div>
              )}
            </div>
          )}

          {sections.map((section, idx) => (
            <div key={idx} className="space-y-2">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection(section.title)}
              >
                <div className="flex items-center gap-2">
                  <span className={section.color}>{section.icon}</span>
                  <span className="text-sm font-medium">{section.title}</span>
                </div>
                {expandedSections.has(section.title) ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                )}
              </div>
              {expandedSections.has(section.title) && (
                <div className="ml-6 p-3 bg-white dark:bg-slate-950 rounded-md border text-xs leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </div>
              )}
            </div>
          ))}

          {!hasInstructions && !hasSections && (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Nessun contenuto configurato per questo agente
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BrandVoicePreview({ prompt, agentName }: { prompt: string; agentName: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const parsePrompt = (text: string): PromptSection[] => {
    const sectionPatterns = [
      { pattern: /━+\n🏢 BUSINESS & IDENTITÀ\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Building2 className="h-4 w-4" />, title: "Business & Identità", color: "text-blue-500" },
      { pattern: /━+\n🎯 POSIZIONAMENTO\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Target className="h-4 w-4" />, title: "Posizionamento", color: "text-purple-500" },
      { pattern: /━+\n👥 TARGET\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Users className="h-4 w-4" />, title: "Target", color: "text-green-500" },
      { pattern: /━+\n🔧 METODO\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Wrench className="h-4 w-4" />, title: "Metodo", color: "text-orange-500" },
      { pattern: /━+\n🏆 CREDENZIALI\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Trophy className="h-4 w-4" />, title: "Credenziali", color: "text-yellow-500" },
      { pattern: /━+\n💼 SERVIZI\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Briefcase className="h-4 w-4" />, title: "Servizi", color: "text-cyan-500" },
      { pattern: /━+\n🤖 PERSONALITÀ AI\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Sparkles className="h-4 w-4" />, title: "Personalità AI", color: "text-pink-500" },
    ];

    const sections: PromptSection[] = [];

    for (const { pattern, icon, title, color } of sectionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]?.trim()) {
        sections.push({ icon, title, content: match[1].trim(), color });
      }
    }

    return sections;
  };

  const sections = parsePrompt(prompt);
  const hasSections = sections.length > 0;

  return (
    <div className="mt-3 rounded-lg border bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium">Anteprima: {agentName}</span>
          {hasSections && (
            <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900/50">
              {sections.length} sezioni Brand Voice
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {isExpanded && (
        <div className="border-t p-3 space-y-3 max-h-[400px] overflow-auto">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-2">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection(section.title)}
              >
                <div className="flex items-center gap-2">
                  <span className={section.color}>{section.icon}</span>
                  <span className="text-sm font-medium">{section.title}</span>
                </div>
                {expandedSections.has(section.title) ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                )}
              </div>
              {expandedSections.has(section.title) && (
                <div className="ml-6 p-3 bg-white dark:bg-slate-950 rounded-md border text-xs leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </div>
              )}
            </div>
          ))}

          {!hasSections && (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Nessuna info Brand Voice configurata per questo agente
            </p>
          )}

          <div className="pt-2 border-t mt-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Solo queste sezioni verranno iniettate, non le istruzioni dell'agente
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConsultantVoiceCallsPage() {
  const isMobile = useIsMobile();
  const { currentRole } = useRoleSwitch();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<string>("day");
  const [serviceToken, setServiceToken] = useState<string | null>(null);
  const [wsAuthToken, setWsAuthToken] = useState<string>(() => crypto.randomUUID().replace(/-/g, ''));
  const [tokenCopied, setTokenCopied] = useState(false);
  const [vpsBridgeUrl, setVpsBridgeUrl] = useState<string>("");
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);

  const [voiceDirectives, setVoiceDirectives] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Inbound non-client settings
  const [inboundPromptSource, setInboundPromptSource] = useState<'agent' | 'manual' | 'template'>('template');
  const [inboundTemplateId, setInboundTemplateId] = useState('mini-discovery');
  const [inboundAgentId, setInboundAgentId] = useState<string | null>(null);
  const [inboundManualPrompt, setInboundManualPrompt] = useState('');

  // Outbound non-client settings
  const [outboundPromptSource, setOutboundPromptSource] = useState<'agent' | 'manual' | 'template'>('template');
  const [outboundTemplateId, setOutboundTemplateId] = useState('sales-orbitale');
  const [outboundAgentId, setOutboundAgentId] = useState<string | null>(null);
  const [outboundManualPrompt, setOutboundManualPrompt] = useState('');

  // Brand Voice settings (separato dalle istruzioni)
  const [inboundBrandVoiceEnabled, setInboundBrandVoiceEnabled] = useState(false);
  const [inboundBrandVoiceAgentId, setInboundBrandVoiceAgentId] = useState<string | null>(null);
  const [outboundBrandVoiceEnabled, setOutboundBrandVoiceEnabled] = useState(false);
  const [outboundBrandVoiceAgentId, setOutboundBrandVoiceAgentId] = useState<string | null>(null);

  const [outboundPhone, setOutboundPhone] = useState("");
  const [outboundAiMode, setOutboundAiMode] = useState("assistenza");
  const [outboundScheduledDate, setOutboundScheduledDate] = useState("");
  const [outboundScheduledTime, setOutboundScheduledTime] = useState("");
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [callInstruction, setCallInstruction] = useState("");
  const [instructionType, setInstructionType] = useState<'task' | 'reminder' | null>(null);
  const [clientTypeFilter, setClientTypeFilter] = useState<'all' | 'client' | 'non-client'>('all');
  const [selectedClient, setSelectedClient] = useState<ClientWithPhone | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientTab, setClientTab] = useState<'active' | 'inactive'>('active');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [scheduledStatusFilter, setScheduledStatusFilter] = useState<string>("pending");
  const [scheduledPage, setScheduledPage] = useState(1);
  const SCHEDULED_PER_PAGE = 10;
  const [scheduledTypeFilter, setScheduledTypeFilter] = useState<string>("all");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [templateFieldValues, setTemplateFieldValues] = useState<Record<string, string>>({});
  const [retryMaxAttempts, setRetryMaxAttempts] = useState<number>(3);
  const [retryIntervalMinutes, setRetryIntervalMinutes] = useState<number>(5);

  // AI Task Queue state
  const [aiTasksFilter, setAITasksFilter] = useState("all");
  const [aiTasksPage, setAITasksPage] = useState(1);
  const [aiTasksView, setAITasksView] = useState<'list' | 'calendar'>('calendar');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{day: Date, hour: number} | null>(null);
  const [dragEnd, setDragEnd] = useState<{day: Date, hour: number} | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [aiTaskExpandedCategory, setAITaskExpandedCategory] = useState<string | null>(null);
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [aiTaskSelectedTemplate, setAITaskSelectedTemplate] = useState<TemplateItem | null>(null);
  const [aiTaskTemplateValues, setAITaskTemplateValues] = useState<Record<string, string>>({});
  const [quickCreateExpandedCategory, setQuickCreateExpandedCategory] = useState<string | null>(null);
  const [quickCreateSelectedTemplate, setQuickCreateSelectedTemplate] = useState<TemplateItem | null>(null);
  const [quickCreateTemplateValues, setQuickCreateTemplateValues] = useState<Record<string, string>>({});
  const [selectedEvent, setSelectedEvent] = useState<{ type: 'task' | 'call'; data: any } | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    contact_phone: '',
    contact_name: '',
    task_type: 'single_call' as 'single_call' | 'follow_up' | 'ai_task',
    ai_instruction: '',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    scheduled_time: '10:00',
    recurrence_type: 'once' as 'once' | 'daily' | 'weekly',
    recurrence_days: [] as number[],
    recurrence_end_date: '',
    max_attempts: 3,
    retry_delay_minutes: 15,
    template_id: undefined as string | undefined,
    voice_template_id: undefined as string | undefined
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Voice settings query
  const { data: voiceSettings, refetch: refetchVoice } = useQuery({
    queryKey: ["/api/voice/settings"],
    queryFn: async () => {
      const res = await fetch("/api/voice/settings", { headers: getAuthHeaders() });
      if (!res.ok) return { voiceId: 'achernar', vpsBridgeUrl: '', voiceMaxRetryAttempts: 3, voiceRetryIntervalMinutes: 5 };
      return res.json();
    },
  });

  // Load vpsBridgeUrl and retry settings when settings load
  useEffect(() => {
    if (voiceSettings?.vpsBridgeUrl) {
      setVpsBridgeUrl(voiceSettings.vpsBridgeUrl);
    }
    if (voiceSettings?.voiceMaxRetryAttempts !== undefined) {
      setRetryMaxAttempts(voiceSettings.voiceMaxRetryAttempts);
    }
    if (voiceSettings?.voiceRetryIntervalMinutes !== undefined) {
      setRetryIntervalMinutes(voiceSettings.voiceRetryIntervalMinutes);
    }
  }, [voiceSettings?.vpsBridgeUrl, voiceSettings?.voiceMaxRetryAttempts, voiceSettings?.voiceRetryIntervalMinutes]);

  const updateVoiceMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const res = await fetch("/api/voice/settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'aggiornamento della voce");
      }
      return res.json();
    },
    onSuccess: (data) => {
      refetchVoice();
      const voice = VOICES.find(v => v.value === data.voiceId);
      toast({ 
        title: `🎤 Voce aggiornata`, 
        description: `${voice?.label} - ${voice?.description}` 
      });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/service-token", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella generazione del token");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setServiceToken(data.token);
      refetchTokenStatus();
      toast({ 
        title: "Token generato", 
        description: data.tokenNumber > 1 
          ? `Token #${data.tokenNumber} generato (${data.tokenNumber - 1} precedenti revocati)` 
          : "Il token di servizio è pronto per essere copiato" 
      });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const copyToken = async () => {
    if (serviceToken) {
      await navigator.clipboard.writeText(serviceToken);
      setTokenCopied(true);
      toast({ title: "Copiato!", description: "Token copiato negli appunti" });
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const saveVpsUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch("/api/voice/vps-url", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ vpsBridgeUrl: url }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio dell'URL VPS");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchVoice();
      toast({ title: "Salvato", description: "URL del VPS aggiornato" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/voice/service-token", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio del token");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchTokenStatus();
      toast({ title: "Token salvato", description: "Il token è stato sincronizzato con il database" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const saveRetrySettingsMutation = useMutation({
    mutationFn: async ({ maxAttempts, intervalMinutes }: { maxAttempts: number; intervalMinutes: number }) => {
      const res = await fetch("/api/voice/retry-settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ 
          voiceMaxRetryAttempts: maxAttempts, 
          voiceRetryIntervalMinutes: intervalMinutes 
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio delle impostazioni retry");
      }
      return res.json();
    },
    onSuccess: (data) => {
      refetchVoice();
      setRetryMaxAttempts(data.voiceMaxRetryAttempts);
      setRetryIntervalMinutes(data.voiceRetryIntervalMinutes);
      toast({ title: "Salvato", description: "Impostazioni retry aggiornate" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const { data: callsData, isLoading: loadingCalls, refetch: refetchCalls } = useQuery({
    queryKey: ["/api/voice/calls", page, statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/voice/calls?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento chiamate");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["/api/voice/stats", period],
    queryFn: async () => {
      const res = await fetch(`/api/voice/stats?period=${period}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento statistiche");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: healthData } = useQuery({
    queryKey: ["/api/voice/health"],
    queryFn: async () => {
      const res = await fetch("/api/voice/health", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento stato");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Gemini connections tracker
  const { data: geminiConnectionsData, refetch: refetchGeminiConnections } = useQuery<{
    success: boolean;
    connections: Array<{
      connectionId: string;
      mode: string;
      startedAt: string;
      status: string;
      retryCount: number;
      consultantId?: string;
      durationSeconds: number;
    }>;
    count: number;
  }>({
    queryKey: ["/api/voice/gemini-connections"],
    queryFn: async () => {
      const res = await fetch("/api/voice/gemini-connections", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento connessioni Gemini");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const killAllGeminiMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/gemini-connections/kill-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore nella chiusura connessioni");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connessioni terminate",
        description: `Chiuse ${data.closed} connessioni Gemini`,
      });
      refetchGeminiConnections();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: tokenStatusData, refetch: refetchTokenStatus } = useQuery<TokenStatus>({
    queryKey: ["/api/voice/service-token/status"],
    queryFn: async () => {
      const res = await fetch("/api/voice/service-token/status", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento stato token");
      return res.json();
    },
  });

  const { data: nonClientSettingsData, isLoading: loadingNonClientSettings } = useQuery<NonClientSettings>({
    queryKey: ["/api/voice/non-client-settings"],
    queryFn: async () => {
      const res = await fetch("/api/voice/non-client-settings", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento impostazioni");
      return res.json();
    },
  });

  const { data: scheduledCallsData, isLoading: loadingScheduledCalls, refetch: refetchScheduledCalls } = useQuery<{ calls: ScheduledVoiceCall[]; count: number; activeTimers: number }>({
    queryKey: ["/api/voice/outbound/scheduled"],
    queryFn: async () => {
      const res = await fetch("/api/voice/outbound/scheduled", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento chiamate programmate");
      return res.json();
    },
    refetchInterval: 10000,
  });

  // AI Tasks query
  const { data: aiTasksData, isLoading: loadingAITasks, refetch: refetchAITasks } = useQuery<{ tasks: AITask[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>({
    queryKey: ["/api/voice/ai-tasks", aiTasksFilter, aiTasksPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(aiTasksPage), limit: "20" });
      if (aiTasksFilter !== "all") params.set("status", aiTasksFilter);
      const res = await fetch(`/api/voice/ai-tasks?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        return { tasks: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
      }
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Calendar data query (fetches both AI tasks and scheduled calls for calendar view)
  const { data: calendarData } = useQuery({
    queryKey: ["calendar-data", calendarWeekStart.toISOString()],
    queryFn: async () => {
      const [tasksRes, callsRes] = await Promise.all([
        fetch(`/api/voice/ai-tasks?limit=100`, { headers: getAuthHeaders() }),
        fetch(`/api/voice/outbound/scheduled`, { headers: getAuthHeaders() })
      ]);
      
      const tasksData = await tasksRes.json();
      const callsData = await callsRes.json();
      
      return {
        aiTasks: (tasksData.tasks || []).filter((t: AITask) => {
          const taskDate = new Date(t.scheduled_at);
          return taskDate >= calendarWeekStart && taskDate < addDays(calendarWeekStart, 7);
        }),
        scheduledCalls: (callsData.calls || []).filter((c: any) => {
          if (!c.scheduled_at) return false;
          if (c.status !== 'pending') return false; // Solo chiamate pending
          const callDate = new Date(c.scheduled_at);
          return callDate >= calendarWeekStart && callDate < addDays(calendarWeekStart, 7);
        })
      };
    },
    enabled: aiTasksView === 'calendar'
  });

  const { data: clientsData, isLoading: loadingClients } = useQuery<{ active: ClientWithPhone[]; inactive: ClientWithPhone[] }>({
    queryKey: ["/api/voice/clients-with-phone"],
    queryFn: async () => {
      const res = await fetch("/api/voice/clients-with-phone", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento clienti");
      return res.json();
    },
  });

  const handleSelectClient = (client: ClientWithPhone) => {
    setSelectedClient(client);
    const phone = client.phoneNumber.startsWith('+') ? client.phoneNumber : `+39${client.phoneNumber}`;
    setOutboundPhone(phone);
  };

  const handleSelectTemplate = (item: TemplateItem) => {
    if (item.fields && item.fields.length > 0) {
      setSelectedTemplate(item);
      setTemplateFieldValues({});
      setTemplateDialogOpen(true);
    } else {
      setInstructionType(item.type);
      setCallInstruction(item.text);
    }
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate) return;
    
    const generatedText = selectedTemplate.generateText 
      ? selectedTemplate.generateText(templateFieldValues)
      : selectedTemplate.text;
    
    setInstructionType(selectedTemplate.type);
    setCallInstruction(generatedText);
    setTemplateDialogOpen(false);
    setSelectedTemplate(null);
    setTemplateFieldValues({});
  };

  const handleAITaskSelectTemplate = (item: TemplateItem) => {
    setAITaskSelectedTemplate(item);
    setAITaskTemplateValues({});
    
    // Solo se NON ha campi, genera subito il testo
    if (!item.fields?.length) {
      if (item.generateText) {
        setNewTaskData(prev => ({
          ...prev,
          ai_instruction: item.generateText!({}),
          task_type: item.type === 'task' ? 'single_call' : 'follow_up'
        }));
      } else if (item.text) {
        setNewTaskData(prev => ({
          ...prev,
          ai_instruction: item.text,
          task_type: item.type === 'task' ? 'single_call' : 'follow_up'
        }));
      }
      setAITaskSelectedTemplate(null); // Reset perché non serve UI
    }
    // Se ha campi, li mostrerà nella UI
  };

  const filteredClients = (clientTab === 'active' ? clientsData?.active : clientsData?.inactive)?.filter(c => 
    !clientSearch || 
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phoneNumber.includes(clientSearch)
  ) || [];

  const filteredScheduledCalls = useMemo(() => {
    if (!scheduledCallsData?.calls) return [];
    const filtered = scheduledCallsData.calls.filter(call => {
      if (scheduledStatusFilter !== 'all' && call.status !== scheduledStatusFilter) return false;
      if (scheduledTypeFilter !== 'all' && call.instruction_type !== scheduledTypeFilter) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [scheduledCallsData?.calls, scheduledStatusFilter, scheduledTypeFilter]);

  const paginatedScheduledCalls = useMemo(() => {
    const start = (scheduledPage - 1) * SCHEDULED_PER_PAGE;
    return filteredScheduledCalls.slice(start, start + SCHEDULED_PER_PAGE);
  }, [filteredScheduledCalls, scheduledPage]);

  const scheduledTotalPages = Math.ceil(filteredScheduledCalls.length / SCHEDULED_PER_PAGE);

  const triggerOutboundMutation = useMutation({
    mutationFn: async ({ targetPhone, aiMode, callInstruction, instructionType }: { targetPhone: string; aiMode: string; callInstruction?: string; instructionType?: 'task' | 'reminder' | null }) => {
      const res = await fetch("/api/voice/outbound/trigger", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhone, aiMode, callInstruction: callInstruction || null, instructionType: instructionType || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'avvio della chiamata");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOutboundPhone("");
      setCallInstruction("");
      setInstructionType(null);
      refetchScheduledCalls();
      toast({ title: "Chiamata avviata!", description: `Chiamando ${data.targetPhone}...` });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const scheduleOutboundMutation = useMutation({
    mutationFn: async ({ targetPhone, scheduledAt, aiMode, callInstruction, instructionType }: { targetPhone: string; scheduledAt: string; aiMode: string; callInstruction?: string; instructionType?: 'task' | 'reminder' | null }) => {
      const res = await fetch("/api/voice/outbound/schedule", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhone, scheduledAt, aiMode, callInstruction: callInstruction || null, instructionType: instructionType || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella programmazione");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOutboundPhone("");
      setOutboundScheduledDate("");
      setOutboundScheduledTime("");
      setCallInstruction("");
      setInstructionType(null);
      setIsScheduleMode(false);
      refetchScheduledCalls();
      toast({ 
        title: "Chiamata programmata!", 
        description: `Chiamerà ${data.targetPhone} il ${new Date(data.scheduledAt).toLocaleString('it-IT')}` 
      });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const cancelOutboundMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await fetch(`/api/voice/outbound/${callId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella cancellazione");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchScheduledCalls();
      toast({ title: "Chiamata cancellata" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  // AI Task mutations
  const createAITaskMutation = useMutation({
    mutationFn: async (data: typeof newTaskData) => {
      const scheduledAt = data.scheduled_date && data.scheduled_time 
        ? new Date(`${data.scheduled_date}T${data.scheduled_time}`).toISOString()
        : new Date().toISOString();
      
      const res = await fetch("/api/voice/ai-tasks", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: data.contact_name || null,
          contact_phone: data.contact_phone,
          task_type: data.task_type,
          ai_instruction: data.ai_instruction,
          scheduled_at: scheduledAt,
          recurrence_type: data.recurrence_type,
          max_attempts: data.max_attempts,
          retry_delay_minutes: data.retry_delay_minutes,
          voice_template_id: data.voice_template_id || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella creazione del task");
      }
      return res.json();
    },
    onSuccess: () => {
      setNewTaskData({
        contact_phone: '',
        contact_name: '',
        task_type: 'single_call',
        ai_instruction: '',
        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
        scheduled_time: '10:00',
        recurrence_type: 'once',
        recurrence_days: [],
        recurrence_end_date: '',
        max_attempts: 3,
        retry_delay_minutes: 15,
        template_id: undefined,
        voice_template_id: undefined
      });
      refetchAITasks();
      toast({ title: "Task creato!", description: "La chiamata AI è stata programmata" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const executeAITaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/voice/ai-tasks/${taskId}/execute`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'esecuzione del task");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchAITasks();
      toast({ title: "Task avviato!", description: "La chiamata è in corso" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const pauseAITaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/voice/ai-tasks/${taskId}/pause`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella pausa del task");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchAITasks();
      toast({ title: "Task in pausa" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const deleteAITaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/voice/ai-tasks/${taskId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella cancellazione del task");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchAITasks();
      toast({ title: "Task eliminato" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const getAITaskStatusBadge = (status: AITask['status']) => {
    const config: Record<AITask['status'], { label: string; className: string }> = {
      scheduled: { label: "Programmato", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
      in_progress: { label: "In corso", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      retry_pending: { label: "Retry", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
      completed: { label: "Completato", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
      failed: { label: "Fallito", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
      paused: { label: "In pausa", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
      cancelled: { label: "Annullato", className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
    };
    return config[status] || { label: status, className: "bg-gray-100 text-gray-700" };
  };

  const getAITaskTypeIcon = (type: AITask['task_type']) => {
    switch (type) {
      case 'single_call': return <Phone className="h-4 w-4" />;
      case 'follow_up': return <RepeatIcon className="h-4 w-4" />;
      case 'ai_task': return <Bot className="h-4 w-4" />;
      default: return <Phone className="h-4 w-4" />;
    }
  };

  const handleTriggerCall = () => {
    if (!outboundPhone.trim()) {
      toast({ title: "Errore", description: "Inserisci un numero di telefono", variant: "destructive" });
      return;
    }
    triggerOutboundMutation.mutate({ 
      targetPhone: outboundPhone.trim(), 
      aiMode: outboundAiMode,
      callInstruction: callInstruction.trim() || undefined,
      instructionType: instructionType,
      useDefaultTemplate: !!instructionType
    });
  };

  const handleScheduleCall = () => {
    if (!outboundPhone.trim() || !outboundScheduledDate || !outboundScheduledTime) {
      toast({ title: "Errore", description: "Inserisci numero, data e ora", variant: "destructive" });
      return;
    }
    const scheduledAt = new Date(`${outboundScheduledDate}T${outboundScheduledTime}`).toISOString();
    scheduleOutboundMutation.mutate({ 
      targetPhone: outboundPhone.trim(), 
      scheduledAt, 
      aiMode: outboundAiMode,
      callInstruction: callInstruction.trim() || undefined,
      instructionType: instructionType,
      useDefaultTemplate: !!instructionType
    });
  };

  useEffect(() => {
    if (nonClientSettingsData) {
      setVoiceDirectives(nonClientSettingsData.voiceDirectives);
      // Inbound
      setInboundPromptSource(nonClientSettingsData.inboundPromptSource || 'template');
      setInboundTemplateId(nonClientSettingsData.inboundTemplateId || 'mini-discovery');
      setInboundAgentId(nonClientSettingsData.inboundAgentId);
      setInboundManualPrompt(nonClientSettingsData.inboundManualPrompt || '');
      // Outbound
      setOutboundPromptSource(nonClientSettingsData.outboundPromptSource || 'template');
      setOutboundTemplateId(nonClientSettingsData.outboundTemplateId || 'sales-orbitale');
      setOutboundAgentId(nonClientSettingsData.outboundAgentId);
      setOutboundManualPrompt(nonClientSettingsData.outboundManualPrompt || '');
      // Brand Voice settings
      setInboundBrandVoiceEnabled(nonClientSettingsData.inboundBrandVoiceEnabled || false);
      setInboundBrandVoiceAgentId(nonClientSettingsData.inboundBrandVoiceAgentId || null);
      setOutboundBrandVoiceEnabled(nonClientSettingsData.outboundBrandVoiceEnabled || false);
      setOutboundBrandVoiceAgentId(nonClientSettingsData.outboundBrandVoiceAgentId || null);
      setHasChanges(false);
    }
  }, [nonClientSettingsData]);

  const saveNonClientSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/non-client-settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceDirectives,
          inboundPromptSource,
          inboundTemplateId,
          inboundAgentId,
          inboundManualPrompt,
          outboundPromptSource,
          outboundTemplateId,
          outboundAgentId,
          outboundManualPrompt,
          inboundBrandVoiceEnabled,
          inboundBrandVoiceAgentId,
          outboundBrandVoiceEnabled,
          outboundBrandVoiceAgentId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }
      return res.json();
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/voice/non-client-settings"] });
      toast({ title: "Salvato!", description: "Le impostazioni sono state salvate correttamente" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const handleResetDirectives = () => {
    if (nonClientSettingsData) {
      setVoiceDirectives(nonClientSettingsData.defaultVoiceDirectives);
      setHasChanges(true);
    }
  };

  const selectedInboundAgent = nonClientSettingsData?.availableAgents.find(a => a.id === inboundAgentId);
  const selectedOutboundAgent = nonClientSettingsData?.availableAgents.find(a => a.id === outboundAgentId);

  const calls: VoiceCall[] = callsData?.calls || [];
  const pagination = callsData?.pagination || { page: 1, totalPages: 1, total: 0 };
  const stats: VoiceStats | undefined = statsData?.stats;
  const activeCalls: number = statsData?.activeCalls || 0;
  const health: HealthStatus | undefined = healthData;
  const tokenStatus: TokenStatus | undefined = tokenStatusData;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredCalls = calls.filter((c) => {
    const matchesSearch = !search || 
      c.caller_id.includes(search) ||
      c.client_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesClientType = 
      clientTypeFilter === 'all' ||
      (clientTypeFilter === 'client' && c.client_id) ||
      (clientTypeFilter === 'non-client' && !c.client_id);
    
    return matchesSearch && matchesClientType;
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} role="consultant" />
      <div className={`flex-1 flex flex-col ${isMobile ? "w-full" : "ml-0"}`}>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="w-full space-y-4">
            {/* Header moderna */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white shadow-xl">
              <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
              <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              
              <div className="relative flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
                    <Phone className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">Chiamate Voice</h1>
                    <p className="text-white/70 text-sm mt-0.5">
                      Monitora e gestisci le chiamate AI in tempo reale
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Status indicator */}
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
                    <div className={`h-2.5 w-2.5 rounded-full ${health?.overall === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    <span className="text-sm font-medium">
                      {health?.overall === 'healthy' ? 'Sistema Online' : 'Verifica...'}
                    </span>
                  </div>
                  
                  {/* Active calls badge */}
                  {activeCalls > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/30 backdrop-blur-sm border border-emerald-400/30">
                      <Phone className="h-4 w-4 text-emerald-300" />
                      <span className="text-sm font-semibold">{activeCalls} attiv{activeCalls === 1 ? 'a' : 'e'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Tabs defaultValue="calls" className="space-y-6">
              <TabsList className="w-full h-auto p-1.5 bg-muted/50 backdrop-blur-sm border rounded-xl shadow-sm flex-wrap justify-start gap-1">
                <TabsTrigger 
                  value="calls" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-violet-700 transition-all duration-200"
                >
                  <Phone className="h-4 w-4" />
                  <span className="hidden sm:inline">Storico</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="outbound" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-700 transition-all duration-200"
                >
                  <PhoneOutgoing className="h-4 w-4" />
                  <span className="hidden sm:inline">Chiama Ora</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="ai-tasks" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-purple-700 transition-all duration-200"
                >
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">Calendario AI</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="non-client" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-orange-700 transition-all duration-200"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Template</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="vps" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-700 transition-all duration-200"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Configurazione</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calls" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Chiamate Attive</p>
                      <p className="text-3xl font-bold">{activeCalls}</p>
                    </div>
                    <div className={`p-3 rounded-full ${activeCalls > 0 ? "bg-green-100" : "bg-gray-100"}`}>
                      <Phone className={`h-6 w-6 ${activeCalls > 0 ? "text-green-600" : "text-gray-400"}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Totale Oggi</p>
                      <p className="text-3xl font-bold">{stats?.total_calls || 0}</p>
                    </div>
                    <div className="p-3 rounded-full bg-blue-100">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Durata Media</p>
                      <p className="text-3xl font-bold">
                        {formatDuration(Math.round(parseFloat(stats?.avg_duration_seconds || "0")))}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-purple-100">
                      <Clock className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Stato Sistema</p>
                      <p className="text-lg font-medium mt-1">
                        {health?.overall === "healthy" ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-5 w-5" /> Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <AlertCircle className="h-5 w-5" /> {health?.overall || "..."}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className={`p-3 rounded-full ${health?.overall === "healthy" ? "bg-green-100" : "bg-yellow-100"}`}>
                      <Settings className={`h-6 w-6 ${health?.overall === "healthy" ? "text-green-600" : "text-yellow-600"}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gemini Connections Tracker */}
              <Card className={geminiConnectionsData?.count && geminiConnectionsData.count > 0 ? "border-orange-300 bg-orange-50" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Connessioni Gemini</p>
                        {geminiConnectionsData?.count && geminiConnectionsData.count > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {geminiConnectionsData.count} attive
                          </Badge>
                        )}
                      </div>
                      <p className="text-3xl font-bold">{geminiConnectionsData?.count || 0}</p>
                      {geminiConnectionsData?.connections && geminiConnectionsData.connections.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground space-y-1">
                          {geminiConnectionsData.connections.slice(0, 3).map((conn) => (
                            <div key={conn.connectionId} className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                conn.status === 'active' ? 'bg-green-500' : 
                                conn.status === 'reconnecting' ? 'bg-yellow-500' : 'bg-gray-400'
                              }`} />
                              <span>{conn.mode}</span>
                              <span className="text-muted-foreground">
                                {Math.floor(conn.durationSeconds / 60)}m {conn.durationSeconds % 60}s
                              </span>
                              {conn.retryCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  retry: {conn.retryCount}
                                </Badge>
                              )}
                            </div>
                          ))}
                          {geminiConnectionsData.connections.length > 3 && (
                            <div className="text-muted-foreground">
                              +{geminiConnectionsData.connections.length - 3} altre
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className={`p-3 rounded-full ${
                        geminiConnectionsData?.count && geminiConnectionsData.count > 0 
                          ? "bg-orange-100" 
                          : "bg-gray-100"
                      }`}>
                        <Plug className={`h-6 w-6 ${
                          geminiConnectionsData?.count && geminiConnectionsData.count > 0 
                            ? "text-orange-600" 
                            : "text-gray-400"
                        }`} />
                      </div>
                      {geminiConnectionsData?.count && geminiConnectionsData.count > 0 && currentRole === 'super_admin' && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => killAllGeminiMutation.mutate()}
                          disabled={killAllGeminiMutation.isPending}
                        >
                          {killAllGeminiMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Zap className="h-3 w-3 mr-1" />
                          )}
                          Kill All
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle>Storico Chiamate</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca numero o cliente..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 w-[180px]"
                      />
                    </div>
                    <Select value={clientTypeFilter} onValueChange={(v) => setClientTypeFilter(v as 'all' | 'client' | 'non-client')}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <span className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Tutti
                          </span>
                        </SelectItem>
                        <SelectItem value="client">
                          <span className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-green-500" />
                            Clienti
                          </span>
                        </SelectItem>
                        <SelectItem value="non-client">
                          <span className="flex items-center gap-2">
                            <UserX className="h-4 w-4 text-orange-500" />
                            Non Clienti
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Stato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti gli stati</SelectItem>
                        {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                          <SelectItem key={value} value={value}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCalls ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredCalls.length === 0 ? (
                  <div className="text-center py-12">
                    <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">Nessuna chiamata trovata</h3>
                    <p className="text-muted-foreground">
                      Le chiamate appariranno qui quando arriveranno
                    </p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Chiamante</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Stato</TableHead>
                          <TableHead>Durata</TableHead>
                          <TableHead>Esito</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCalls.map((call) => {
                          const statusConfig = STATUS_CONFIG[call.status] || STATUS_CONFIG.ended;
                          const StatusIcon = statusConfig.icon;
                          return (
                            <TableRow key={call.id}>
                              <TableCell>
                                <div className="text-sm">
                                  {format(new Date(call.started_at), "dd/MM HH:mm", { locale: it })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(call.started_at), {
                                    addSuffix: true,
                                    locale: it,
                                  })}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono">{call.caller_id}</TableCell>
                              <TableCell>
                                {call.client_name ? (
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    {call.client_name}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={statusConfig.color}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDuration(call.duration_seconds)}</TableCell>
                              <TableCell>
                                {call.outcome ? (
                                  <Badge variant="outline">{call.outcome}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Link href={`/consultant/voice-calls/${call.id}`}>
                                  <Button variant="ghost" size="sm">
                                    Dettagli
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        {pagination.total} chiamate totali
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="flex items-center px-2 text-sm">
                          {page} / {pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= pagination.totalPages}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
              </TabsContent>

              <TabsContent value="outbound" className="space-y-6">
                {/* Template Dialog */}
                <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        {selectedTemplate?.type === 'task' ? (
                          <ClipboardList className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Bell className="h-5 w-5 text-orange-500" />
                        )}
                        {selectedTemplate?.label}
                      </DialogTitle>
                      <DialogDescription>
                        Compila i dettagli per personalizzare il messaggio
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {selectedTemplate?.fields?.map((field) => (
                        <div key={field.name} className="space-y-2">
                          <Label htmlFor={field.name}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {field.type === 'select' ? (
                            <Select 
                              value={templateFieldValues[field.name] || ''} 
                              onValueChange={(v) => setTemplateFieldValues(prev => ({...prev, [field.name]: v}))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder || `Seleziona ${field.label.toLowerCase()}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options?.map(opt => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={field.name}
                              type={field.type}
                              placeholder={field.placeholder}
                              value={templateFieldValues[field.name] || ''}
                              onChange={(e) => setTemplateFieldValues(prev => ({...prev, [field.name]: e.target.value}))}
                            />
                          )}
                        </div>
                      ))}
                      
                      {selectedTemplate?.generateText && Object.keys(templateFieldValues).length > 0 && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <Label className="text-xs text-muted-foreground">Anteprima messaggio:</Label>
                          <p className="mt-1 text-sm">{selectedTemplate.generateText(templateFieldValues)}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button 
                        onClick={handleApplyTemplate}
                        disabled={selectedTemplate?.fields?.some(f => f.required && !templateFieldValues[f.name])}
                      >
                        Applica Template
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* HEADER OPERATIVO */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                    <div>
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Phone className="h-6 w-6" />
                        Centro Chiamate AI
                      </h2>
                      <div className="flex items-center gap-3 mt-1 text-sm flex-wrap">
                        <Badge className={health?.overall === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}>
                          {health?.overall === 'healthy' ? '🟢 Sistema Online' : '🟡 Verifica Sistema'}
                        </Badge>
                        <span className="text-muted-foreground">Voice: {voiceSettings?.voiceId || 'Achernar'}</span>
                        <span className="text-muted-foreground">VPS: {voiceSettings?.vpsBridgeUrl ? 'Connesso' : 'Non configurato'}</span>
                      </div>
                    </div>
                    <div className="flex gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{stats?.total_calls || 0}</p>
                        <p className="text-xs text-muted-foreground">Chiamate oggi</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{stats?.completed_calls || 0}</p>
                        <p className="text-xs text-muted-foreground">Completate</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{scheduledCallsData?.count || 0}</p>
                        <p className="text-xs text-muted-foreground">Programmate</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      size="lg" 
                      className="flex-1 h-14 text-lg"
                      onClick={() => setIsScheduleMode(false)}
                      variant={!isScheduleMode ? "default" : "outline"}
                    >
                      <PhoneOutgoing className="h-5 w-5 mr-2" />
                      👉 Chiama Ora
                    </Button>
                    <Button 
                      size="lg" 
                      className="flex-1 h-14 text-lg"
                      onClick={() => setIsScheduleMode(true)}
                      variant={isScheduleMode ? "default" : "outline"}
                    >
                      <Calendar className="h-5 w-5 mr-2" />
                      👉 Programma Chiamata
                    </Button>
                  </div>
                </div>

                {/* LAYOUT A 3 COLONNE */}
                <div className="grid gap-4 lg:grid-cols-4">
                  {/* COLONNA SINISTRA (25%): Rubrica + Template */}
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Users className="h-4 w-4" />
                          Rubrica
                        </CardTitle>
                        <div className="flex gap-1 mt-2">
                          <Button
                            variant={clientTab === 'active' ? "default" : "outline"}
                            size="sm"
                            onClick={() => setClientTab('active')}
                            className="flex-1 h-7 text-xs"
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            Attivi ({clientsData?.active?.length || 0})
                          </Button>
                          <Button
                            variant={clientTab === 'inactive' ? "default" : "outline"}
                            size="sm"
                            onClick={() => setClientTab('inactive')}
                            className="flex-1 h-7 text-xs"
                          >
                            <UserX className="h-3 w-3 mr-1" />
                            Inattivi ({clientsData?.inactive?.length || 0})
                          </Button>
                        </div>
                        <div className="relative mt-2">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input
                            placeholder="Cerca..."
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            className="pl-7 h-7 text-xs"
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {loadingClients ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : filteredClients.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            <Users className="h-6 w-6 mx-auto mb-2 opacity-50" />
                            <p className="font-medium">👥 Nessun cliente ancora</p>
                            <Link href="/consultant/clients">
                              <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs">
                                Vai a Clienti →
                              </Button>
                            </Link>
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-[200px] overflow-auto">
                            {filteredClients.slice(0, 10).map((client) => (
                              <div
                                key={client.id}
                                onClick={() => client.phoneNumber ? handleSelectClient(client) : null}
                                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                                  !client.phoneNumber 
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : selectedClient?.id === client.id 
                                      ? 'bg-primary/10 border border-primary cursor-pointer' 
                                      : 'hover:bg-muted/50 cursor-pointer'
                                }`}
                              >
                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium flex-shrink-0">
                                  {client.firstName[0]}{client.lastName[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-xs truncate flex items-center gap-1">
                                    {client.firstName} {client.lastName}
                                    {!client.phoneNumber && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {client.phoneNumber || 'No telefono'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                  </div>

                  {/* COLONNA CENTRALE (50%): Wizard Chiamata */}
                  <div className="lg:col-span-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>{isScheduleMode ? "Programma Chiamata" : "Avvia Chiamata AI"}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Step 1: Numero */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                            Numero da chiamare
                          </Label>
                          {selectedClient && (
                            <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                                  {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                                </div>
                                <span className="text-sm font-medium">{selectedClient.firstName} {selectedClient.lastName}</span>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedClient(null); setOutboundPhone(""); }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🇮🇹</span>
                            <Input
                              type="tel"
                              placeholder="+39 XXX XXX XXXX"
                              value={outboundPhone}
                              onChange={(e) => setOutboundPhone(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>

                        {/* Step 2: Obiettivo */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                            Cosa deve dire l'AI
                          </Label>
                          <div className="flex gap-1 mb-2">
                            <Button 
                              variant={instructionType === 'task' ? "default" : "outline"} 
                              size="sm" 
                              onClick={() => setInstructionType(instructionType === 'task' ? null : 'task')}
                            >
                              <ClipboardList className="h-3 w-3 mr-1" /> Task
                            </Button>
                            <Button 
                              variant={instructionType === 'reminder' ? "default" : "outline"} 
                              size="sm" 
                              onClick={() => setInstructionType(instructionType === 'reminder' ? null : 'reminder')}
                            >
                              <Bell className="h-3 w-3 mr-1" /> Reminder
                            </Button>
                          </div>
                          {instructionType && (
                            <Textarea 
                              value={callInstruction} 
                              onChange={(e) => setCallInstruction(e.target.value)} 
                              placeholder="Descrivi l'obiettivo della chiamata..." 
                              className="min-h-[80px]" 
                            />
                          )}
                          <div className="flex flex-wrap gap-1">
                            {['Ricorda scadenza contratto', 'Recupera pagamento', 'Follow-up preventivo', 'Upsell servizio'].map(ex => (
                              <Badge 
                                key={ex} 
                                variant="outline" 
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors" 
                                onClick={() => { setInstructionType('task'); setCallInstruction(ex); }}
                              >
                                {ex}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Step 3: Data/Ora (solo se programma) */}
                        {isScheduleMode && (
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                              Quando chiamare
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                              <Input 
                                type="date" 
                                value={outboundScheduledDate} 
                                onChange={(e) => setOutboundScheduledDate(e.target.value)} 
                                min={new Date().toISOString().split('T')[0]} 
                              />
                              <Input 
                                type="time" 
                                value={outboundScheduledTime} 
                                onChange={(e) => setOutboundScheduledTime(e.target.value)} 
                              />
                            </div>
                          </div>
                        )}

                        {/* BOTTONE AZIONE */}
                        <Button
                          size="lg"
                          className="w-full h-14 text-lg bg-purple-600 hover:bg-purple-700"
                          onClick={isScheduleMode ? handleScheduleCall : handleTriggerCall}
                          disabled={triggerOutboundMutation.isPending || scheduleOutboundMutation.isPending || !outboundPhone.trim()}
                        >
                          {(triggerOutboundMutation.isPending || scheduleOutboundMutation.isPending) ? (
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          ) : (
                            <PhoneOutgoing className="h-5 w-5 mr-2" />
                          )}
                          {isScheduleMode ? "🟣 PROGRAMMA CHIAMATA" : "🟣 AVVIA CHIAMATA AI ORA"}
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          {isScheduleMode ? "La chiamata partirà all'orario impostato" : "L'AI chiamerà entro 5 secondi"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* COLONNA DESTRA (25%): Template */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4" />
                        Template
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1 max-h-[400px] overflow-auto">
                        {TEMPLATE_LIBRARY.map((category) => {
                          const CategoryIcon = category.icon;
                          const isExpanded = expandedCategory === category.category;
                          return (
                            <div key={category.category}>
                              <button
                                onClick={() => setExpandedCategory(isExpanded ? null : category.category)}
                                className={`w-full flex items-center justify-between p-1.5 rounded text-left hover:bg-muted/50 transition-colors ${isExpanded ? 'bg-muted' : ''}`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <CategoryIcon className={`h-3 w-3 ${category.color}`} />
                                  <span className="text-xs font-medium">{category.label}</span>
                                </div>
                                <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                              {isExpanded && (
                                <div className="ml-4 mt-1 space-y-0.5">
                                  {category.items.map((item, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleSelectTemplate(item)}
                                      className="w-full flex items-center gap-1 p-1.5 text-left text-xs rounded hover:bg-primary/10 transition-colors"
                                    >
                                      {item.type === 'task' ? (
                                        <ClipboardList className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                      ) : (
                                        <Bell className="h-3 w-3 text-orange-500 flex-shrink-0" />
                                      )}
                                      <span className="truncate">{item.label}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* TABELLA CHIAMATE PROGRAMMATE - FULL WIDTH */}
                <Card className="mt-6">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Chiamate Programmate
                        <Badge variant="secondary">{scheduledCallsData?.count || 0}</Badge>
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        {/* Filtro per stato */}
                        <Select value={scheduledStatusFilter} onValueChange={(v) => { setScheduledStatusFilter(v); setScheduledPage(1); }}>
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Stato" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tutti gli stati</SelectItem>
                            <SelectItem value="pending">In Attesa</SelectItem>
                            <SelectItem value="calling">Chiamando</SelectItem>
                            <SelectItem value="talking">In Corso</SelectItem>
                            <SelectItem value="completed">Completate</SelectItem>
                            <SelectItem value="no_answer">Nessuna Risposta</SelectItem>
                            <SelectItem value="busy">Occupato</SelectItem>
                            <SelectItem value="short_call">Staccata</SelectItem>
                            <SelectItem value="retry_scheduled">Retry Programmato</SelectItem>
                            <SelectItem value="failed">Fallite</SelectItem>
                            <SelectItem value="cancelled">Cancellate</SelectItem>
                          </SelectContent>
                        </Select>
                        {/* Filtro per tipo istruzione */}
                        <Select value={scheduledTypeFilter} onValueChange={(v) => { setScheduledTypeFilter(v); setScheduledPage(1); }}>
                          <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tutti i tipi</SelectItem>
                            <SelectItem value="task">Task</SelectItem>
                            <SelectItem value="reminder">Reminder</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => refetchScheduledCalls()}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingScheduledCalls ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : !filteredScheduledCalls.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <PhoneOutgoing className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>Nessuna chiamata programmata</p>
                      </div>
                    ) : (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Numero</TableHead>
                              <TableHead>Stato</TableHead>
                              <TableHead>Tentativi</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Data/Ora</TableHead>
                              <TableHead>Istruzione</TableHead>
                              <TableHead className="text-right">Azioni</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedScheduledCalls.map((call) => {
                              const statusConfig = OUTBOUND_STATUS_CONFIG[call.status] || OUTBOUND_STATUS_CONFIG.pending;
                              const isRetryState = ['no_answer', 'busy', 'short_call', 'retry_scheduled'].includes(call.status);
                              const retryReasonLabel = call.retry_reason ? (OUTBOUND_STATUS_CONFIG[call.retry_reason]?.label || call.retry_reason) : null;
                              return (
                                <TableRow key={call.id}>
                                  <TableCell className="font-mono text-sm">{call.target_phone}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <Badge className={`${statusConfig.color} text-xs`}>
                                        {statusConfig.icon && <span className="mr-1">{statusConfig.icon}</span>}
                                        {statusConfig.label}
                                      </Badge>
                                      {call.status === 'retry_scheduled' && call.next_retry_at && (
                                        <span className="text-xs text-muted-foreground">
                                          Retry: {format(new Date(call.next_retry_at), "HH:mm", { locale: it })}
                                        </span>
                                      )}
                                      {isRetryState && retryReasonLabel && call.status !== call.retry_reason && (
                                        <span className="text-xs text-orange-600">
                                          Motivo: {retryReasonLabel}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <span className={`text-sm font-medium ${call.attempts >= call.max_attempts ? 'text-red-500' : ''}`}>
                                        {call.attempts}/{call.max_attempts}
                                      </span>
                                      {call.attempts > 0 && call.attempts < call.max_attempts && (
                                        <RotateCcw className="h-3 w-3 text-purple-500" />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {call.instruction_type === 'task' ? (
                                      <div className="flex items-center gap-1 text-sm">
                                        <ClipboardList className="h-3 w-3 text-blue-500" />
                                        <span>Task</span>
                                      </div>
                                    ) : call.instruction_type === 'reminder' ? (
                                      <div className="flex items-center gap-1 text-sm">
                                        <Bell className="h-3 w-3 text-orange-500" />
                                        <span>Reminder</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {call.scheduled_at ? format(new Date(call.scheduled_at), "dd/MM HH:mm", { locale: it }) : 'Immediata'}
                                  </TableCell>
                                  <TableCell className="max-w-[200px]">
                                    <p className="truncate text-sm text-muted-foreground">{call.call_instruction || '-'}</p>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {(call.status === 'pending' || call.status === 'failed' || call.status === 'retry_scheduled') && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => cancelOutboundMutation.mutate(call.id)}
                                        disabled={cancelOutboundMutation.isPending}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        {scheduledTotalPages > 1 && (
                          <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                              {filteredScheduledCalls.length} chiamate filtrate
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={scheduledPage <= 1}
                                onClick={() => setScheduledPage(p => p - 1)}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <span className="text-sm px-2">
                                {scheduledPage} / {scheduledTotalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={scheduledPage >= scheduledTotalPages}
                                onClick={() => setScheduledPage(p => p + 1)}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="non-client" className="space-y-6">
                {loadingNonClientSettings ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Mic2 className="h-5 w-5" />
                              Direttive Vocali
                            </CardTitle>
                            <CardDescription>
                              Queste istruzioni vengono sempre aggiunte in cima al prompt finale. Definiscono il tono, lo stile e le regole di comunicazione.
                            </CardDescription>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetDirectives}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Ripristina Default
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={voiceDirectives}
                          onChange={(e) => {
                            setVoiceDirectives(e.target.value);
                            setHasChanges(true);
                          }}
                          className="min-h-[200px] font-mono text-sm"
                          placeholder="Direttive vocali..."
                        />
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* INBOUND Card */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <PhoneIncoming className="h-5 w-5 text-green-600" />
                            Chiamate in Entrata (INBOUND)
                          </CardTitle>
                          <CardDescription>
                            Configurazione quando un non-cliente chiama te
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* ISTRUZIONI CHIAMATA */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="h-4 w-4 text-green-600" />
                              <h4 className="font-medium text-sm">Istruzioni Chiamata</h4>
                            </div>
                            <RadioGroup
                              value={inboundPromptSource}
                              onValueChange={(value: 'agent' | 'manual' | 'template') => {
                                setInboundPromptSource(value);
                                if (value === 'agent') {
                                  setInboundBrandVoiceEnabled(false);
                                  setInboundBrandVoiceAgentId(null);
                                }
                                setHasChanges(true);
                              }}
                              className="space-y-3"
                            >
                              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors overflow-hidden">
                                <RadioGroupItem value="template" id="inbound-template" className="mt-1 shrink-0" />
                                <div className="flex-1 min-w-0 space-y-2">
                                  <Label htmlFor="inbound-template" className="flex items-center gap-2 cursor-pointer text-sm">
                                    <Settings className="h-4 w-4" />
                                    Template Predefinito
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Consigliato</Badge>
                                  </Label>
                                  {inboundPromptSource === 'template' && (
                                    <div className="pt-1 w-full">
                                      <Select
                                        value={inboundTemplateId}
                                        onValueChange={(value) => {
                                          setInboundTemplateId(value);
                                          setHasChanges(true);
                                        }}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Seleziona template..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(nonClientSettingsData?.availableInboundTemplates || [
                                            { id: 'mini-discovery', name: 'Mini Discovery', description: 'Scopri chi chiama e proponi appuntamento' },
                                            { id: 'receptionist', name: 'Receptionist', description: 'Risposta professionale e smistamento' },
                                            { id: 'support-basic', name: 'Supporto Base', description: 'Assistenza clienti generica' },
                                          ]).map((template) => (
                                            <SelectItem key={template.id} value={template.id}>
                                              <div className="flex flex-col">
                                                <span className="font-medium">{template.name}</span>
                                                <span className="text-xs text-muted-foreground">{template.description}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {(() => {
                                        const selectedTemplate = nonClientSettingsData?.availableInboundTemplates?.find(t => t.id === inboundTemplateId);
                                        if (selectedTemplate?.prompt) {
                                          return (
                                            <div className="mt-3 p-3 bg-muted rounded-md border w-full overflow-hidden">
                                              <div className="flex items-center gap-2 mb-2">
                                                <FileText className="h-4 w-4 text-green-600 shrink-0" />
                                                <span className="text-xs font-medium truncate">Anteprima Template: {selectedTemplate.name}</span>
                                              </div>
                                              <div className="text-xs whitespace-pre-wrap max-h-[200px] overflow-y-auto overflow-x-hidden text-muted-foreground break-all w-full">
                                                {selectedTemplate.prompt}
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <RadioGroupItem value="manual" id="inbound-manual" className="mt-1" />
                                <div className="flex-1 space-y-2">
                                  <Label htmlFor="inbound-manual" className="flex items-center gap-2 cursor-pointer text-sm">
                                    <FileText className="h-4 w-4" />
                                    Template Manuale
                                  </Label>
                                  {inboundPromptSource === 'manual' && (
                                    <Textarea
                                      value={inboundManualPrompt}
                                      onChange={(e) => {
                                        setInboundManualPrompt(e.target.value);
                                        setHasChanges(true);
                                      }}
                                      className="min-h-[150px] font-mono text-sm"
                                      placeholder="Scrivi il tuo prompt personalizzato per chiamate in entrata..."
                                    />
                                  )}
                                </div>
                              </div>

                              {/* OPZIONE AGENTE WHATSAPP */}
                              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <RadioGroupItem value="agent" id="inbound-agent" className="mt-1" />
                                <div className="flex-1 space-y-2">
                                  <Label htmlFor="inbound-agent" className="flex items-center gap-2 cursor-pointer text-sm">
                                    <Bot className="h-4 w-4" />
                                    Importa da Agente WhatsApp
                                    <Badge variant="outline" className="text-xs">Tutto incluso</Badge>
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    Usa istruzioni + brand voice dall'agente WhatsApp
                                  </p>
                                  {inboundPromptSource === 'agent' && (
                                    <div className="pt-1">
                                      <Select
                                        value={inboundAgentId || ''}
                                        onValueChange={(value) => {
                                          setInboundAgentId(value || null);
                                          setHasChanges(true);
                                        }}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Seleziona un agente..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {nonClientSettingsData?.availableAgents.map((agent) => (
                                            <SelectItem key={agent.id} value={agent.id}>
                                              <div className="flex items-center gap-2">
                                                <span>{agent.name}</span>
                                                {agent.persona && (
                                                  <Badge variant="outline" className="text-xs">
                                                    {agent.persona}
                                                  </Badge>
                                                )}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {selectedInboundAgent?.prompt && (
                                        <AgentPromptPreview prompt={selectedInboundAgent.prompt} agentName={selectedInboundAgent.name} />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </RadioGroup>
                          </div>

                          {/* CONTESTO BUSINESS - solo per template/manual */}
                          {inboundPromptSource !== 'agent' && (
                          <div className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-purple-600" />
                                <h4 className="font-medium text-sm">Contesto Business</h4>
                                <Badge variant="outline" className="text-xs">Opzionale</Badge>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[300px]">
                                      <p>Permette all'AI di conoscere il tuo business senza includere le istruzioni dell'agente WhatsApp. Usa solo le info del brand voice.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Switch
                                checked={inboundBrandVoiceEnabled}
                                onCheckedChange={(checked) => {
                                  setInboundBrandVoiceEnabled(checked);
                                  if (!checked) setInboundBrandVoiceAgentId(null);
                                  setHasChanges(true);
                                }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Includi info business da un agente WhatsApp
                            </p>
                            {inboundBrandVoiceEnabled && (
                              <div className="space-y-3 pt-2">
                                <Select
                                  value={inboundBrandVoiceAgentId || ''}
                                  onValueChange={(value) => {
                                    setInboundBrandVoiceAgentId(value || null);
                                    setHasChanges(true);
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Seleziona un agente..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {nonClientSettingsData?.availableAgents.map((agent) => (
                                      <SelectItem key={agent.id} value={agent.id}>
                                        <div className="flex items-center gap-2">
                                          <span>{agent.name}</span>
                                          {agent.persona && (
                                            <Badge variant="outline" className="text-xs">
                                              {agent.persona}
                                            </Badge>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {(() => {
                                  const selectedAgent = nonClientSettingsData?.availableAgents.find(a => a.id === inboundBrandVoiceAgentId);
                                  if (selectedAgent?.prompt) {
                                    return (
                                      <BrandVoicePreview prompt={selectedAgent.prompt} agentName={selectedAgent.name} />
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}
                          </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* OUTBOUND Card */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <PhoneOutgoing className="h-5 w-5 text-blue-600" />
                            Chiamate in Uscita (OUTBOUND)
                          </CardTitle>
                          <CardDescription>
                            Configurazione quando tu chiami un non-cliente
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* ISTRUZIONI CHIAMATA */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="h-4 w-4 text-blue-600" />
                              <h4 className="font-medium text-sm">Istruzioni Chiamata</h4>
                            </div>
                            <RadioGroup
                              value={outboundPromptSource}
                              onValueChange={(value: 'agent' | 'manual' | 'template') => {
                                setOutboundPromptSource(value);
                                if (value === 'agent') {
                                  setOutboundBrandVoiceEnabled(false);
                                  setOutboundBrandVoiceAgentId(null);
                                }
                                setHasChanges(true);
                              }}
                              className="space-y-3"
                            >
                              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors overflow-hidden">
                                <RadioGroupItem value="template" id="outbound-template" className="mt-1 shrink-0" />
                                <div className="flex-1 min-w-0 space-y-2">
                                  <Label htmlFor="outbound-template" className="flex items-center gap-2 cursor-pointer text-sm">
                                    <Settings className="h-4 w-4" />
                                    Template Predefinito
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Consigliato</Badge>
                                  </Label>
                                  {outboundPromptSource === 'template' && (
                                    <div className="pt-1 w-full">
                                      <Select
                                        value={outboundTemplateId}
                                        onValueChange={(value) => {
                                          setOutboundTemplateId(value);
                                          setHasChanges(true);
                                        }}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Seleziona template..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(nonClientSettingsData?.availableOutboundTemplates || [
                                            { id: 'sales-orbitale', name: 'Sales Orbitale', description: 'Script vendita con metodo Orbitale' },
                                            { id: 'lead-qualification', name: 'Qualifica Lead', description: 'Qualificazione e raccolta informazioni' },
                                            { id: 'appointment-setter', name: 'Fissa Appuntamento', description: 'Focus su prenotazione meeting' },
                                          ]).map((template) => (
                                            <SelectItem key={template.id} value={template.id}>
                                              <div className="flex flex-col">
                                                <span className="font-medium">{template.name}</span>
                                                <span className="text-xs text-muted-foreground">{template.description}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {(() => {
                                        const selectedTemplate = nonClientSettingsData?.availableOutboundTemplates?.find(t => t.id === outboundTemplateId);
                                        if (selectedTemplate?.prompt) {
                                          return (
                                            <div className="mt-3 p-3 bg-muted rounded-md border w-full overflow-hidden">
                                              <div className="flex items-center gap-2 mb-2">
                                                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                                                <span className="text-xs font-medium truncate">Anteprima Template: {selectedTemplate.name}</span>
                                              </div>
                                              <div className="text-xs whitespace-pre-wrap max-h-[200px] overflow-y-auto overflow-x-hidden text-muted-foreground break-all w-full">
                                                {selectedTemplate.prompt}
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <RadioGroupItem value="manual" id="outbound-manual" className="mt-1" />
                                <div className="flex-1 space-y-2">
                                  <Label htmlFor="outbound-manual" className="flex items-center gap-2 cursor-pointer text-sm">
                                    <FileText className="h-4 w-4" />
                                    Template Manuale
                                  </Label>
                                  {outboundPromptSource === 'manual' && (
                                    <Textarea
                                      value={outboundManualPrompt}
                                      onChange={(e) => {
                                        setOutboundManualPrompt(e.target.value);
                                        setHasChanges(true);
                                      }}
                                      className="min-h-[150px] font-mono text-sm"
                                      placeholder="Scrivi il tuo prompt personalizzato per chiamate in uscita..."
                                    />
                                  )}
                                </div>
                              </div>

                              {/* OPZIONE AGENTE WHATSAPP */}
                              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <RadioGroupItem value="agent" id="outbound-agent" className="mt-1" />
                                <div className="flex-1 space-y-2">
                                  <Label htmlFor="outbound-agent" className="flex items-center gap-2 cursor-pointer text-sm">
                                    <Bot className="h-4 w-4" />
                                    Importa da Agente WhatsApp
                                    <Badge variant="outline" className="text-xs">Tutto incluso</Badge>
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    Usa istruzioni + brand voice dall'agente WhatsApp
                                  </p>
                                  {outboundPromptSource === 'agent' && (
                                    <div className="pt-1">
                                      <Select
                                        value={outboundAgentId || ''}
                                        onValueChange={(value) => {
                                          setOutboundAgentId(value || null);
                                          setHasChanges(true);
                                        }}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Seleziona un agente..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {nonClientSettingsData?.availableAgents.map((agent) => (
                                            <SelectItem key={agent.id} value={agent.id}>
                                              <div className="flex items-center gap-2">
                                                <span>{agent.name}</span>
                                                {agent.persona && (
                                                  <Badge variant="outline" className="text-xs">
                                                    {agent.persona}
                                                  </Badge>
                                                )}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {selectedOutboundAgent?.prompt && (
                                        <AgentPromptPreview prompt={selectedOutboundAgent.prompt} agentName={selectedOutboundAgent.name} />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </RadioGroup>
                          </div>

                          {/* CONTESTO BUSINESS - solo per template/manual */}
                          {outboundPromptSource !== 'agent' && (
                          <div className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-purple-600" />
                                <h4 className="font-medium text-sm">Contesto Business</h4>
                                <Badge variant="outline" className="text-xs">Opzionale</Badge>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[300px]">
                                      <p>Permette all'AI di conoscere il tuo business senza includere le istruzioni dell'agente WhatsApp. Usa solo le info del brand voice.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Switch
                                checked={outboundBrandVoiceEnabled}
                                onCheckedChange={(checked) => {
                                  setOutboundBrandVoiceEnabled(checked);
                                  if (!checked) setOutboundBrandVoiceAgentId(null);
                                  setHasChanges(true);
                                }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Includi info business da un agente WhatsApp
                            </p>
                            {outboundBrandVoiceEnabled && (
                              <div className="space-y-3 pt-2">
                                <Select
                                  value={outboundBrandVoiceAgentId || ''}
                                  onValueChange={(value) => {
                                    setOutboundBrandVoiceAgentId(value || null);
                                    setHasChanges(true);
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Seleziona un agente..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {nonClientSettingsData?.availableAgents.map((agent) => (
                                      <SelectItem key={agent.id} value={agent.id}>
                                        <div className="flex items-center gap-2">
                                          <span>{agent.name}</span>
                                          {agent.persona && (
                                            <Badge variant="outline" className="text-xs">
                                              {agent.persona}
                                            </Badge>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {(() => {
                                  const selectedAgent = nonClientSettingsData?.availableAgents.find(a => a.id === outboundBrandVoiceAgentId);
                                  if (selectedAgent?.prompt) {
                                    return (
                                      <BrandVoicePreview prompt={selectedAgent.prompt} agentName={selectedAgent.name} />
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}
                          </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => saveNonClientSettingsMutation.mutate()}
                        disabled={!hasChanges || saveNonClientSettingsMutation.isPending}
                        size="lg"
                      >
                        {saveNonClientSettingsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salva Impostazioni
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="vps" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Configurazione VPS Voice Bridge
                    </CardTitle>
                    <CardDescription>
                      Configura il bridge VPS per connettere FreeSWITCH a questa piattaforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Stato Token */}
                    <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/50">
                      <div className={`p-2 rounded-full ${tokenStatus?.hasToken || serviceToken ? 'bg-green-100' : 'bg-yellow-100'}`}>
                        <Key className={`h-5 w-5 ${tokenStatus?.hasToken || serviceToken ? 'text-green-600' : 'text-yellow-600'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {tokenStatus?.hasToken || serviceToken ? 'Token Attivo' : 'Nessun Token'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {serviceToken 
                            ? 'Il token è pronto. Copialo nel file .env della VPS.' 
                            : tokenStatus?.hasToken 
                              ? tokenStatus.message
                              : 'Genera un token per connettere il VPS a questa piattaforma.'}
                        </p>
                        {tokenStatus?.hasToken && tokenStatus.lastGeneratedAt && !serviceToken && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ultimo generato: {new Date(tokenStatus.lastGeneratedAt).toLocaleString('it-IT')}
                            {tokenStatus.revokedCount > 0 && (
                              <span className="ml-2 text-orange-600">
                                ({tokenStatus.revokedCount} token precedenti revocati)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <Button 
                        onClick={() => generateTokenMutation.mutate()}
                        disabled={generateTokenMutation.isPending}
                        variant={tokenStatus?.hasToken || serviceToken ? "outline" : "default"}
                      >
                        {generateTokenMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : tokenStatus?.hasToken || serviceToken ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Rigenera
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-2" />
                            Genera Token
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Token input/output */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Token di Servizio (REPLIT_SERVICE_TOKEN):</label>
                      <div className="flex gap-2">
                        <Input
                          value={serviceToken || ''}
                          onChange={(e) => setServiceToken(e.target.value)}
                          placeholder="Incolla qui il token JWT esistente oppure genera uno nuovo"
                          className="font-mono text-xs"
                        />
                        <Button onClick={copyToken} variant="outline" size="icon" disabled={!serviceToken}>
                          {tokenCopied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          onClick={() => saveTokenMutation.mutate(serviceToken || '')}
                          disabled={saveTokenMutation.isPending || !serviceToken}
                          variant="default"
                        >
                          {saveTokenMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Salva
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Incolla il token esistente dalla VPS oppure generane uno nuovo. Clicca "Salva" per sincronizzarlo.
                      </p>
                    </div>

                    {/* VPS Bridge URL */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">URL del VPS Bridge (per chiamate in uscita):</label>
                      <div className="flex gap-2">
                        <Input
                          value={vpsBridgeUrl}
                          onChange={(e) => setVpsBridgeUrl(e.target.value)}
                          placeholder="http://72.62.50.40:9090"
                          className="font-mono text-xs"
                        />
                        <Button 
                          onClick={() => saveVpsUrlMutation.mutate(vpsBridgeUrl)}
                          disabled={saveVpsUrlMutation.isPending}
                          variant="outline"
                        >
                          {saveVpsUrlMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Salva
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        L'indirizzo IP e porta del tuo VPS dove gira il bridge (es: http://IP:9090)
                      </p>
                    </div>

                    {/* Retry Settings per chiamate in uscita */}
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5 text-blue-600" />
                        <h4 className="font-medium">Configurazione Retry Chiamate in Uscita</h4>
                      </div>
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="retryMaxAttempts" className="text-sm font-medium">
                            Max tentativi retry (1-5)
                          </Label>
                          <Input
                            id="retryMaxAttempts"
                            type="number"
                            min={1}
                            max={5}
                            value={retryMaxAttempts}
                            onChange={(e) => setRetryMaxAttempts(Math.max(1, Math.min(5, parseInt(e.target.value) || 3)))}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            Numero di tentativi se la chiamata non viene risposta
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="retryIntervalMinutes" className="text-sm font-medium">
                            Intervallo base retry (1-30 min)
                          </Label>
                          <Input
                            id="retryIntervalMinutes"
                            type="number"
                            min={1}
                            max={30}
                            value={retryIntervalMinutes}
                            onChange={(e) => setRetryIntervalMinutes(Math.max(1, Math.min(30, parseInt(e.target.value) || 5)))}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            Minuti tra il primo e il secondo tentativo
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/50 rounded-md">
                        <div className="flex-1">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            <strong>Backoff esponenziale:</strong> L'intervallo raddoppia ad ogni tentativo
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            Es: {retryIntervalMinutes}min → {retryIntervalMinutes * 2}min → {retryIntervalMinutes * 4}min...
                          </p>
                        </div>
                        <Button
                          onClick={() => saveRetrySettingsMutation.mutate({ 
                            maxAttempts: retryMaxAttempts, 
                            intervalMinutes: retryIntervalMinutes 
                          })}
                          disabled={saveRetrySettingsMutation.isPending}
                          size="sm"
                        >
                          {saveRetrySettingsMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Salva Retry
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* WS_AUTH_TOKEN */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">WS_AUTH_TOKEN (per FreeSWITCH):</label>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setWsAuthToken(crypto.randomUUID().replace(/-/g, ''))}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Rigenera
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={wsAuthToken}
                          readOnly
                          className="font-mono text-xs"
                        />
                        <Button 
                          onClick={() => {
                            navigator.clipboard.writeText(wsAuthToken);
                            toast({ title: "Copiato!", description: "WS_AUTH_TOKEN copiato" });
                          }} 
                          variant="outline" 
                          size="icon"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Questo token autentica FreeSWITCH al bridge. Usalo sia nel .env che nel dialplan.
                      </p>
                    </div>

                    {/* Template .env */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">File .env per la VPS:</label>
                      <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                        <pre>{`# Bridge WebSocket Server
WS_HOST=0.0.0.0
WS_PORT=9090
WS_AUTH_TOKEN=${wsAuthToken}

# Connessione a Replit (NO /ws/ai-voice - lo aggiunge il codice)
REPLIT_WS_URL=${window.location.origin}
REPLIT_API_URL=${window.location.origin}
REPLIT_API_TOKEN=${serviceToken || 'GENERA_IL_TOKEN_SOPRA'}

# Audio
AUDIO_SAMPLE_RATE_IN=8000
AUDIO_SAMPLE_RATE_OUT=8000
SESSION_TIMEOUT_MS=1800000
MAX_CONCURRENT_CALLS=10
LOG_LEVEL=debug

# FreeSWITCH Event Socket
ESL_HOST=127.0.0.1
ESL_PORT=8021
ESL_PASSWORD=LA_TUA_PASSWORD_ESL

# SIP Trunk per chiamate in uscita
SIP_GATEWAY=voip_trunk
SIP_CALLER_ID=+39TUONUMERO

# Token per autenticare richieste outbound (usa lo stesso di REPLIT_API_TOKEN)
REPLIT_SERVICE_TOKEN=${serviceToken || 'GENERA_IL_TOKEN_SOPRA'}`}</pre>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const envContent = `# Bridge WebSocket Server
WS_HOST=0.0.0.0
WS_PORT=9090
WS_AUTH_TOKEN=${wsAuthToken}

# Connessione a Replit (NO /ws/ai-voice - lo aggiunge il codice)
REPLIT_WS_URL=${window.location.origin}
REPLIT_API_URL=${window.location.origin}
REPLIT_API_TOKEN=${serviceToken || 'GENERA_IL_TOKEN_SOPRA'}

# Audio
AUDIO_SAMPLE_RATE_IN=8000
AUDIO_SAMPLE_RATE_OUT=8000
SESSION_TIMEOUT_MS=1800000
MAX_CONCURRENT_CALLS=10
LOG_LEVEL=debug

# FreeSWITCH Event Socket
ESL_HOST=127.0.0.1
ESL_PORT=8021
ESL_PASSWORD=LA_TUA_PASSWORD_ESL

# SIP Trunk per chiamate in uscita
SIP_GATEWAY=voip_trunk
SIP_CALLER_ID=+39TUONUMERO

# Token per autenticare richieste outbound (usa lo stesso di REPLIT_API_TOKEN)
REPLIT_SERVICE_TOKEN=${serviceToken || 'GENERA_IL_TOKEN_SOPRA'}`;
                          navigator.clipboard.writeText(envContent);
                          toast({ title: "Copiato!", description: "Template .env copiato negli appunti" });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copia Template .env
                      </Button>
                    </div>

                    {/* Istruzioni FreeSWITCH */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Configurazione FreeSWITCH (dialplan):</label>
                      <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                        <pre>{`<action application="audio_stream" data="ws://127.0.0.1:9090?token=${wsAuthToken} mono 8000"/>`}</pre>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`<action application="audio_stream" data="ws://127.0.0.1:9090?token=${wsAuthToken} mono 8000"/>`);
                          toast({ title: "Copiato!", description: "Configurazione FreeSWITCH copiata" });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copia Dialplan
                      </Button>
                    </div>

                    {/* Comandi VPS */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Comandi per avviare il bridge sulla VPS:</label>
                      <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                        <pre>{`cd /opt/alessia-voice
npm install
npm run build
systemctl restart alessia-voice
journalctl -u alessia-voice -f  # Per vedere i log`}</pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ai-tasks" className="space-y-4">
                {/* GOOGLE CALENDAR STYLE HEADER */}
                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-xl border shadow-sm px-4 py-3">
                  <div className="flex items-center gap-4">
                    {/* Month/Year Navigation - Google Style */}
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-9 px-3 hover:bg-muted"
                        onClick={() => setCalendarWeekStart(prev => addDays(prev, -7))}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-9 px-3 hover:bg-muted"
                        onClick={() => setCalendarWeekStart(prev => addDays(prev, 7))}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                      <h2 className="text-xl font-normal text-foreground ml-2">
                        {format(calendarWeekStart, 'MMMM yyyy', { locale: it })}
                      </h2>
                    </div>
                    
                    {/* Today button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-4 rounded-md border-muted-foreground/30"
                      onClick={() => setCalendarWeekStart(startOfWeek(new Date(), {weekStartsOn: 1}))}
                    >
                      Oggi
                    </Button>
                    
                    {/* Compact Legend */}
                    <div className="hidden md:flex items-center gap-3 ml-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-purple-500"></div>
                        <span className="text-muted-foreground">AI Tasks</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-blue-500"></div>
                        <span className="text-muted-foreground">Chiamate</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Segment Control Toggle - Google Style */}
                  <div className="flex items-center gap-2">
                    <div className="flex bg-muted/50 rounded-lg p-0.5">
                      <button
                        onClick={() => setAITasksView('list')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          aiTasksView === 'list' 
                            ? 'bg-white dark:bg-zinc-800 shadow-sm text-foreground' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <List className="h-4 w-4" />
                        <span className="hidden sm:inline">Lista</span>
                      </button>
                      <button
                        onClick={() => setAITasksView('calendar')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          aiTasksView === 'calendar' 
                            ? 'bg-white dark:bg-zinc-800 shadow-sm text-foreground' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Calendar className="h-4 w-4" />
                        <span className="hidden sm:inline">Settimana</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista o Calendario */}
                {aiTasksView === 'list' ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardList className="h-5 w-5" />Task Programmati
                          <Badge variant="secondary">{aiTasksData?.pagination?.total || 0}</Badge>
                        </CardTitle>
                        <div className="flex gap-2 flex-wrap">
                          {["all","scheduled","in_progress","retry_pending","completed"].map(f => (
                            <Button key={f} variant={aiTasksFilter===f?"default":"outline"} size="sm" 
                              onClick={() => {setAITasksFilter(f); setAITasksPage(1);}}>
                              {f==="all"?"Tutti":f==="scheduled"?"Programmati":f==="in_progress"?"In corso":f==="retry_pending"?"Retry":"Completati"}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loadingAITasks ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      ) : !aiTasksData?.tasks?.length ? (
                        <div className="text-center py-12">
                          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium">Nessun task AI trovato</h3>
                          <p className="text-muted-foreground">
                            Usa il form sopra per programmare la tua prima chiamata AI
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {aiTasksData.tasks.map((task) => {
                              const statusBadge = getAITaskStatusBadge(task.status);
                              return (
                                <Card key={task.id} className="hover:shadow-md transition-shadow">
                                  <CardContent className="pt-6">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        {getAITaskTypeIcon(task.task_type)}
                                        <div>
                                          <p className="font-medium">
                                            {task.contact_name || "Contatto"}
                                          </p>
                                          <p className="text-sm text-muted-foreground font-mono">
                                            {task.contact_phone}
                                          </p>
                                        </div>
                                      </div>
                                      <Badge className={statusBadge.className}>
                                        {statusBadge.label}
                                      </Badge>
                                    </div>

                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                      {task.ai_instruction}
                                    </p>

                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                                      <Calendar className="h-3 w-3" />
                                      {format(new Date(task.scheduled_at), "dd/MM/yyyy HH:mm", { locale: it })}
                                      {task.recurrence_type !== "once" && (
                                        <Badge variant="outline" className="text-xs">
                                          {task.recurrence_type === "daily" ? "Giornaliero" : "Settimanale"}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                      {(task.status === "scheduled" || task.status === "paused" || task.status === "retry_pending") && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => executeAITaskMutation.mutate(task.id)}
                                                disabled={executeAITaskMutation.isPending}
                                              >
                                                <Play className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Esegui ora</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {(task.status === "scheduled" || task.status === "in_progress") && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => pauseAITaskMutation.mutate(task.id)}
                                                disabled={pauseAITaskMutation.isPending}
                                              >
                                                <Pause className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Pausa</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                              onClick={() => deleteAITaskMutation.mutate(task.id)}
                                              disabled={deleteAITaskMutation.isPending}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Elimina</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>

                          {aiTasksData.pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4">
                              <p className="text-sm text-muted-foreground">
                                {aiTasksData.pagination.total} task totali
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={aiTasksPage <= 1}
                                  onClick={() => setAITasksPage((p) => p - 1)}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="flex items-center px-2 text-sm">
                                  {aiTasksPage} / {aiTasksData.pagination.totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={aiTasksPage >= aiTasksData.pagination.totalPages}
                                  onClick={() => setAITasksPage((p) => p + 1)}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {/* Sezione Prossimi Invii */}
                    {(() => {
                      const now = new Date();
                      const upcomingTasks = (calendarData?.aiTasks || [])
                        .filter((t: AITask) => new Date(t.scheduled_at) > now && t.status === 'scheduled')
                        .sort((a: AITask, b: AITask) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                        .slice(0, 5);
                      const upcomingCalls = (calendarData?.scheduledCalls || [])
                        .filter((c: any) => c.scheduled_at && new Date(c.scheduled_at) > now && c.status === 'pending')
                        .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                        .slice(0, 5);
                      const allUpcoming = [...upcomingTasks.map((t: AITask) => ({ ...t, eventType: 'task' as const })), ...upcomingCalls.map((c: any) => ({ ...c, eventType: 'call' as const }))]
                        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                        .slice(0, 5);
                      
                      if (allUpcoming.length === 0) return null;
                      
                      return (
                        <Card className="border-l-4 border-l-violet-500">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Clock className="h-4 w-4 text-violet-500" />
                              Prossimi Invii
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                              {allUpcoming.map((event) => {
                                const eventDate = new Date(event.scheduled_at);
                                const isTask = event.eventType === 'task';
                                return (
                                  <div
                                    key={event.id}
                                    onClick={() => {
                                      setSelectedEvent({ type: event.eventType, data: event });
                                      setShowEventDetails(true);
                                    }}
                                    className={`flex-shrink-0 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                                      isTask 
                                        ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800' 
                                        : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      {isTask ? (
                                        <Bot className="h-4 w-4 text-purple-500" />
                                      ) : (
                                        <Phone className="h-4 w-4 text-blue-500" />
                                      )}
                                      <span className="text-xs font-medium">
                                        {format(eventDate, 'EEE d', { locale: it })}
                                      </span>
                                    </div>
                                    <p className="text-sm font-semibold truncate max-w-[120px]">
                                      {isTask ? (event.contact_name || event.contact_phone) : event.target_phone}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(eventDate, 'HH:mm')}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                    
                    {/* Calendario */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border shadow-sm overflow-hidden">
                      {(() => {
                        const HOUR_HEIGHT = 60;
                        const START_HOUR = 0;
                        const END_HOUR = 24;
                        const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
                        
                        const handleCalendarSlotClick = (day: Date, hour: number) => {
                          setNewTaskData({
                            ...newTaskData,
                            scheduled_date: format(day, 'yyyy-MM-dd'),
                            scheduled_time: `${hour.toString().padStart(2, '0')}:00`
                          });
                          toast({
                            title: "Slot selezionato",
                            description: `Selezionato: ${format(day, 'EEEE d MMM', { locale: it })} alle ${hour.toString().padStart(2, '0')}:00`
                          });
                          document.getElementById('ai-task-form')?.scrollIntoView({ behavior: 'smooth' });
                        };

                        const now = new Date();
                        const currentHour = now.getHours() + now.getMinutes() / 60;
                        const currentTimeTop = (currentHour - START_HOUR) * HOUR_HEIGHT;
                        const showCurrentTime = currentHour >= START_HOUR && currentHour <= END_HOUR && 
                          [0,1,2,3,4,5,6].some(offset => isSameDay(addDays(calendarWeekStart, offset), now));
                        const todayColumnIndex = [0,1,2,3,4,5,6].findIndex(offset => isSameDay(addDays(calendarWeekStart, offset), now));

                        return (
                          <>
                            {/* Header giorni - GOOGLE CALENDAR STYLE */}
                            <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-0 border-b border-muted/40">
                              <div className="py-3"></div>
                              {[0,1,2,3,4,5,6].map(dayOffset => {
                                const day = addDays(calendarWeekStart, dayOffset);
                                const isToday = isSameDay(day, new Date());
                                return (
                                  <div key={dayOffset} className="text-center py-3 border-l border-muted/30">
                                    <div className={`text-xs font-medium uppercase tracking-wide ${isToday ? 'text-blue-600' : 'text-muted-foreground'}`}>
                                      {format(day, 'EEE', { locale: it })}
                                    </div>
                                    <div className={`mt-1 inline-flex items-center justify-center text-2xl font-normal ${
                                      isToday 
                                        ? 'w-11 h-11 rounded-full bg-blue-600 text-white' 
                                        : 'text-foreground'
                                    }`}>
                                      {format(day, 'd')}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Griglia oraria con scroll - GOOGLE CALENDAR STYLE */}
                            <div 
                              className="relative overflow-auto" 
                              style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '500px' }}
                              onMouseLeave={() => {
                                if (isDragging) {
                                  setIsDragging(false);
                                  setDragStart(null);
                                  setDragEnd(null);
                                }
                              }}
                            >
                              <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-0" style={{ minHeight: hours.length * HOUR_HEIGHT }}>
                                {/* Colonna ore - Google Style */}
                                <div className="relative border-r border-muted/20">
                                  {hours.map((hour) => (
                                    <div
                                      key={hour}
                                      className="absolute w-full text-[11px] text-muted-foreground text-right pr-2 -translate-y-1/2 font-normal"
                                      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                                    >
                                      {hour.toString().padStart(2, '0')}:00
                                    </div>
                                  ))}
                                </div>

                                {/* Colonne giorni */}
                                {[0,1,2,3,4,5,6].map(dayOffset => {
                                  const day = addDays(calendarWeekStart, dayOffset);
                                  const isToday = isSameDay(day, new Date());
                                  const dayTasks = calendarData?.aiTasks?.filter((t: AITask) => isSameDay(new Date(t.scheduled_at), day)) || [];
                                  const dayCalls = calendarData?.scheduledCalls?.filter((c: any) => c.scheduled_at && isSameDay(new Date(c.scheduled_at), day)) || [];
                                  
                                  // Altezza fissa per eventi puntuali (non range)
                                  const EVENT_HEIGHT = 32;
                                  const OVERLAP_THRESHOLD = 0.5; // 30 minuti
                                  
                                  // Combina tutti gli eventi per calcolare sovrapposizioni
                                  const allEvents = [
                                    ...dayTasks.map((t: AITask) => ({ 
                                      ...t, 
                                      type: 'task' as const, 
                                      time: new Date(t.scheduled_at).getHours() + new Date(t.scheduled_at).getMinutes() / 60 
                                    })),
                                    ...dayCalls.map((c: any) => ({ 
                                      ...c, 
                                      type: 'call' as const, 
                                      time: new Date(c.scheduled_at).getHours() + new Date(c.scheduled_at).getMinutes() / 60 
                                    }))
                                  ].sort((a, b) => a.time - b.time);
                                  
                                  // Calcola posizioni per eventi sovrapposti (entro 30 minuti = fianco a fianco)
                                  const eventPositions = new Map<string, { left: number; width: number }>();
                                  
                                  // Raggruppa eventi che si sovrappongono (entro 30 min)
                                  const overlapGroups: any[][] = [];
                                  allEvents.forEach(evt => {
                                    let addedToGroup = false;
                                    for (const group of overlapGroups) {
                                      const lastInGroup = group[group.length - 1];
                                      if (Math.abs(evt.time - lastInGroup.time) < OVERLAP_THRESHOLD) {
                                        group.push(evt);
                                        addedToGroup = true;
                                        break;
                                      }
                                    }
                                    if (!addedToGroup) {
                                      overlapGroups.push([evt]);
                                    }
                                  });
                                  
                                  overlapGroups.forEach((group) => {
                                    const count = group.length;
                                    group.forEach((evt, idx) => {
                                      eventPositions.set(evt.id, {
                                        left: (idx / count) * 100,
                                        width: 100 / count
                                      });
                                    });
                                  });

                                  return (
                                    <div key={dayOffset} className={`relative border-l border-muted/20 ${isToday ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                                      {/* Linee orizzontali per ogni ora - molto leggere */}
                                      {hours.map((hour) => (
                                        <div
                                          key={hour}
                                          className="absolute w-full border-t border-muted/15 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors select-none"
                                          style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            setShowQuickCreate(false);
                                            setIsDragging(true);
                                            setDragStart({ day, hour });
                                            setDragEnd({ day, hour });
                                          }}
                                          onMouseMove={() => {
                                            if (isDragging && dragStart && isSameDay(dragStart.day, day)) {
                                              setDragEnd({ day, hour });
                                            }
                                          }}
                                          onMouseUp={(e) => {
                                            if (isDragging && dragStart) {
                                              const startH = Math.min(dragStart.hour, dragEnd?.hour || dragStart.hour);
                                              const endH = Math.max(dragStart.hour, dragEnd?.hour || dragStart.hour) + 1;
                                              setNewTaskData({
                                                ...newTaskData,
                                                scheduled_date: format(dragStart.day, 'yyyy-MM-dd'),
                                                scheduled_time: `${startH.toString().padStart(2, '0')}:00`
                                              });
                                              setShowQuickCreate(true);
                                            }
                                            setIsDragging(false);
                                          }}
                                        />
                                      ))}

                                      {/* Drag preview - Google style */}
                                      {((isDragging || showQuickCreate) && dragStart && dragEnd) && isSameDay(dragStart.day, day) && (
                                        <div
                                          className="absolute left-1 right-1 bg-blue-100 dark:bg-blue-900/50 border-l-4 border-blue-600 rounded-r-lg z-20 pointer-events-none shadow-sm"
                                          style={{
                                            top: (Math.min(dragStart.hour, dragEnd.hour) - START_HOUR) * HOUR_HEIGHT + 1,
                                            height: (Math.abs(dragEnd.hour - dragStart.hour) + 1) * HOUR_HEIGHT - 2
                                          }}
                                        >
                                          <div className="text-xs text-purple-700 dark:text-purple-300 p-1 font-medium">
                                            {Math.min(dragStart.hour, dragEnd.hour).toString().padStart(2,'0')}:00 - {(Math.max(dragStart.hour, dragEnd.hour) + 1).toString().padStart(2,'0')}:00
                                          </div>
                                        </div>
                                      )}

                                      {/* AI Tasks - Posizionati al minuto esatto */}
                                      {dayTasks.map((task: AITask) => {
                                        const taskDate = new Date(task.scheduled_at);
                                        const taskHour = taskDate.getHours() + taskDate.getMinutes() / 60;
                                        const top = (taskHour - START_HOUR) * HOUR_HEIGHT;
                                        if (taskHour < START_HOUR || taskHour > END_HOUR) return null;
                                        const pos = eventPositions.get(task.id) || { left: 0, width: 100 };
                                        const isNarrow = pos.width < 40;
                                        return (
                                          <div
                                            key={task.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedEvent({ type: 'task', data: task });
                                              setShowEventDetails(true);
                                            }}
                                            className="absolute bg-purple-500 hover:bg-purple-600 text-white rounded-md shadow-sm overflow-hidden z-10 cursor-pointer transition-all hover:shadow-lg hover:z-30 border-l-[3px] border-purple-700"
                                            style={{ 
                                              top: top, 
                                              height: EVENT_HEIGHT,
                                              left: `calc(${pos.left}% + 2px)`,
                                              width: `calc(${pos.width}% - 4px)`,
                                              minWidth: '60px'
                                            }}
                                            title={`${task.contact_name || task.contact_phone} - ${format(taskDate, 'HH:mm')} - ${task.ai_instruction}`}
                                          >
                                            <div className="px-1.5 py-0.5 h-full flex flex-col justify-center">
                                              <div className={`font-medium truncate leading-tight ${isNarrow ? 'text-[9px]' : 'text-[11px]'}`}>
                                                {task.contact_name || task.contact_phone}
                                              </div>
                                              <div className={`text-white/80 truncate ${isNarrow ? 'text-[8px]' : 'text-[10px]'}`}>
                                                {format(taskDate, 'HH:mm')}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}

                                      {/* Scheduled Calls - Posizionate al minuto esatto */}
                                      {dayCalls.map((call: any) => {
                                        const callDate = new Date(call.scheduled_at);
                                        const callHour = callDate.getHours() + callDate.getMinutes() / 60;
                                        const top = (callHour - START_HOUR) * HOUR_HEIGHT;
                                        if (callHour < START_HOUR || callHour > END_HOUR) return null;
                                        const pos = eventPositions.get(call.id) || { left: 0, width: 100 };
                                        const isNarrow = pos.width < 40;
                                        return (
                                          <div
                                            key={call.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedEvent({ type: 'call', data: call });
                                              setShowEventDetails(true);
                                            }}
                                            className="absolute bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm overflow-hidden z-10 cursor-pointer transition-all hover:shadow-lg hover:z-30 border-l-[3px] border-blue-700"
                                            style={{ 
                                              top: top, 
                                              height: EVENT_HEIGHT,
                                              left: `calc(${pos.left}% + 2px)`,
                                              width: `calc(${pos.width}% - 4px)`,
                                              minWidth: '60px'
                                            }}
                                            title={`${call.target_phone} - ${format(callDate, 'HH:mm')} - ${call.call_instruction || 'Chiamata programmata'}`}
                                          >
                                            <div className="px-1.5 py-0.5 h-full flex flex-col justify-center">
                                              <div className={`font-medium truncate leading-tight ${isNarrow ? 'text-[9px]' : 'text-[11px]'}`}>
                                                {call.target_phone}
                                              </div>
                                              <div className={`text-white/80 truncate ${isNarrow ? 'text-[8px]' : 'text-[10px]'}`}>
                                                {format(callDate, 'HH:mm')}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}

                                      {/* Indicatore ora corrente - Google Style */}
                                      {showCurrentTime && dayOffset === todayColumnIndex && (
                                        <div
                                          className="absolute left-0 right-0 z-30 pointer-events-none"
                                          style={{ top: currentTimeTop }}
                                        >
                                          <div className="relative flex items-center">
                                            <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 shadow-sm" />
                                            <div className="flex-1 h-[2px] bg-red-500" />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>


                            {/* Quick Create Sheet - Design Premium */}
                            <Sheet open={showQuickCreate} onOpenChange={(open) => {
                              if (!open) {
                                setShowQuickCreate(false);
                                setDragStart(null);
                                setDragEnd(null);
                                setQuickCreateExpandedCategory(null);
                                setQuickCreateSelectedTemplate(null);
                                setQuickCreateTemplateValues({});
                              }
                            }}>
                              <SheetContent className="sm:max-w-xl overflow-auto p-0 border-l-0">
                                {/* HEADER GRADIENT */}
                                <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 py-5 text-white">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                                      <Phone className="h-6 w-6" />
                                    </div>
                                    <div>
                                      <h2 className="text-xl font-semibold">Nuova Chiamata AI</h2>
                                      <p className="text-white/70 text-sm">Programma una chiamata automatica</p>
                                    </div>
                                  </div>
                                  {/* Badge data + input ora precisa */}
                                  <div className="flex items-center gap-2 mt-4">
                                    <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2">
                                      <CalendarDays className="h-4 w-4" />
                                      <span className="text-sm font-medium">
                                        {dragStart && format(dragStart.day, 'EEE d MMM', { locale: it })}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
                                      <Clock className="h-4 w-4" />
                                      <input
                                        type="time"
                                        value={newTaskData.scheduled_time}
                                        onChange={(e) => setNewTaskData({...newTaskData, scheduled_time: e.target.value})}
                                        className="bg-transparent text-sm font-medium border-none outline-none w-20 text-white [color-scheme:dark]"
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="px-6 py-6 space-y-8">
                                  {/* SEZIONE 1: TIPO CHIAMATA */}
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                      <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                                        <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                      </div>
                                      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Tipo di chiamata</h3>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                      {[
                                        { value: 'single_call', label: 'Chiamata', icon: Phone, desc: 'Una singola chiamata', color: 'emerald', gradient: 'from-emerald-500 to-teal-600' },
                                        { value: 'follow_up', label: 'Follow-up', icon: RepeatIcon, desc: 'Serie programmata', color: 'blue', gradient: 'from-blue-500 to-cyan-600' },
                                        { value: 'ai_task', label: 'Task AI', icon: Bot, desc: 'Azione automatica', color: 'purple', gradient: 'from-purple-500 to-pink-600' }
                                      ].map((type) => {
                                        const isSelected = newTaskData.task_type === type.value;
                                        return (
                                          <button
                                            key={type.value}
                                            onClick={() => {
                                              const newType = type.value as 'single_call' | 'follow_up' | 'ai_task';
                                              setNewTaskData({
                                                ...newTaskData, 
                                                task_type: newType,
                                                recurrence_type: newType === 'single_call' ? 'once' : newTaskData.recurrence_type,
                                                recurrence_days: newType === 'single_call' ? [] : newTaskData.recurrence_days,
                                                template_id: newType === 'ai_task' ? undefined : newTaskData.template_id
                                              });
                                            }}
                                            className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 ${
                                              isSelected 
                                                ? `border-${type.color}-500 bg-gradient-to-br ${type.gradient} text-white shadow-lg shadow-${type.color}-500/25 scale-[1.02]` 
                                                : 'border-border bg-card hover:border-muted-foreground/30 hover:shadow-md'
                                            }`}
                                          >
                                            {isSelected && (
                                              <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-lg">
                                                <Check className={`h-3.5 w-3.5 text-${type.color}-600`} />
                                              </div>
                                            )}
                                            <div className={`p-3 rounded-xl ${isSelected ? 'bg-white/20' : `bg-${type.color}-100 dark:bg-${type.color}-900/20`}`}>
                                              <type.icon className={`h-6 w-6 ${isSelected ? 'text-white' : `text-${type.color}-600 dark:text-${type.color}-400`}`} />
                                            </div>
                                            <div className="text-center">
                                              <span className="text-sm font-semibold block">{type.label}</span>
                                              <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-muted-foreground'}`}>{type.desc}</span>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* SEZIONE 2: CONTATTO con ricerca clienti */}
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Contatto</h3>
                                      </div>
                                    </div>
                                    
                                    {/* Ricerca clienti esistenti - usa filteredClients come nell'altra sezione */}
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Search className="h-3.5 w-3.5" />
                                        Cerca tra i clienti esistenti
                                      </Label>
                                      {loadingClients ? (
                                        <div className="flex items-center justify-center py-3 bg-muted/30 rounded-lg">
                                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          <span className="text-xs text-muted-foreground">Caricamento clienti...</span>
                                        </div>
                                      ) : (() => {
                                        const allClientsWithPhone = [
                                          ...(clientsData?.active?.filter(c => c.phoneNumber && c.phoneNumber.trim() !== '') || []),
                                          ...(clientsData?.inactive?.filter(c => c.phoneNumber && c.phoneNumber.trim() !== '') || [])
                                        ];
                                        const activeWithPhone = clientsData?.active?.filter(c => c.phoneNumber && c.phoneNumber.trim() !== '') || [];
                                        const inactiveWithPhone = clientsData?.inactive?.filter(c => c.phoneNumber && c.phoneNumber.trim() !== '') || [];
                                        
                                        if (allClientsWithPhone.length === 0) {
                                          return (
                                            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                              <div>
                                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Nessun cliente con telefono</p>
                                                <p className="text-xs text-amber-600 dark:text-amber-500">Aggiungi numeri ai tuoi clienti per selezionarli qui</p>
                                              </div>
                                            </div>
                                          );
                                        }
                                        
                                        return (
                                          <Select
                                            value=""
                                            onValueChange={(clientId) => {
                                              const client = allClientsWithPhone.find(c => c.id === clientId);
                                              if (client) {
                                                const phone = client.phoneNumber.startsWith('+') ? client.phoneNumber : `+39${client.phoneNumber}`;
                                                setNewTaskData({
                                                  ...newTaskData, 
                                                  contact_phone: phone,
                                                  contact_name: `${client.firstName} ${client.lastName}`
                                                });
                                              }
                                            }}
                                          >
                                            <SelectTrigger className="h-10 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                                              <div className="flex items-center gap-2 text-muted-foreground">
                                                <Users className="h-4 w-4" />
                                                <span>Seleziona un cliente ({allClientsWithPhone.length})</span>
                                              </div>
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[300px] z-[999]">
                                              {activeWithPhone.length > 0 && (
                                                <>
                                                  <div className="px-2 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
                                                    Clienti Attivi ({activeWithPhone.length})
                                                  </div>
                                                  {activeWithPhone.map((client) => (
                                                    <SelectItem key={client.id} value={client.id}>
                                                      <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                        <span className="font-medium">{client.firstName} {client.lastName}</span>
                                                        <span className="text-xs text-muted-foreground">{client.phoneNumber}</span>
                                                      </div>
                                                    </SelectItem>
                                                  ))}
                                                </>
                                              )}
                                              {inactiveWithPhone.length > 0 && (
                                                <>
                                                  <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-slate-950/30 mt-1">
                                                    Clienti Inattivi ({inactiveWithPhone.length})
                                                  </div>
                                                  {inactiveWithPhone.map((client) => (
                                                    <SelectItem key={client.id} value={client.id}>
                                                      <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                                                        <span>{client.firstName} {client.lastName}</span>
                                                        <span className="text-xs text-muted-foreground">{client.phoneNumber}</span>
                                                      </div>
                                                    </SelectItem>
                                                  ))}
                                                </>
                                              )}
                                            </SelectContent>
                                          </Select>
                                        );
                                      })()}
                                    </div>
                                    
                                    {/* Input manuali */}
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-sm flex items-center gap-1.5">
                                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                          Telefono <span className="text-red-500">*</span>
                                        </Label>
                                        <Input 
                                          placeholder="+39 333 1234567" 
                                          value={newTaskData.contact_phone}
                                          onChange={(e) => setNewTaskData({...newTaskData, contact_phone: e.target.value})}
                                          className="h-11 bg-muted/30 border-muted-foreground/20 focus:border-primary"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-sm flex items-center gap-1.5">
                                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                                          Nome
                                        </Label>
                                        <Input 
                                          placeholder="Mario Rossi" 
                                          value={newTaskData.contact_name}
                                          onChange={(e) => setNewTaskData({...newTaskData, contact_name: e.target.value})}
                                          className="h-11 bg-muted/30 border-muted-foreground/20 focus:border-primary"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* SEZIONE 2.5: TEMPLATE VOCE OUTBOUND */}
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                      <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <PhoneOutgoing className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                      </div>
                                      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Template Voce</h3>
                                      <Badge variant="outline" className="text-xs">Opzionale</Badge>
                                    </div>
                                    
                                    <Select
                                      value={newTaskData.voice_template_id || 'default'}
                                      onValueChange={(value) => setNewTaskData({...newTaskData, voice_template_id: value === 'default' ? undefined : value})}
                                    >
                                      <SelectTrigger className="h-10 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                                        <SelectValue placeholder="Usa template di default" />
                                      </SelectTrigger>
                                      <SelectContent className="z-[999]">
                                        <SelectItem value="default">
                                          <div className="flex items-center gap-2">
                                            <Settings className="h-4 w-4 text-muted-foreground" />
                                            <span>Usa template di default</span>
                                          </div>
                                        </SelectItem>
                                        {(nonClientSettingsData?.availableOutboundTemplates || []).map((template) => (
                                          <SelectItem key={template.id} value={template.id}>
                                            <div className="flex flex-col">
                                              <span className="font-medium">{template.name}</span>
                                              <span className="text-xs text-muted-foreground">{template.description}</span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    
                                    {newTaskData.voice_template_id && (
                                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-center gap-2 mb-2">
                                          <FileText className="h-4 w-4 text-blue-600" />
                                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                            Template selezionato: {nonClientSettingsData?.availableOutboundTemplates?.find(t => t.id === newTaskData.voice_template_id)?.name}
                                          </span>
                                        </div>
                                        <p className="text-xs text-blue-600 dark:text-blue-400">
                                          Questo template verrà usato al posto di quello configurato di default
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {/* SEZIONE 2.6: TEMPLATE LIBRARY (categorie espandibili) - solo per single_call e follow_up */}
                                  {(newTaskData.task_type === 'single_call' || newTaskData.task_type === 'follow_up') && (
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                      <div className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                                        <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                      </div>
                                      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Istruzione Specifica</h3>
                                      <Badge variant="outline" className="text-xs">Opzionale</Badge>
                                    </div>
                                    
                                    {/* Categorie Template espandibili */}
                                    <div className="space-y-1 max-h-[200px] overflow-auto rounded-xl border bg-muted/20 p-2">
                                      {TEMPLATE_LIBRARY.map((category) => {
                                        const CategoryIcon = category.icon;
                                        const isExpanded = quickCreateExpandedCategory === category.category;
                                        return (
                                          <div key={category.category}>
                                            <button 
                                              type="button"
                                              onClick={() => setQuickCreateExpandedCategory(isExpanded ? null : category.category)}
                                              className={`w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-muted/50 transition-colors ${isExpanded ? 'bg-muted' : ''}`}
                                            >
                                              <div className="flex items-center gap-2">
                                                <CategoryIcon className={`h-4 w-4 ${category.color}`} />
                                                <span className="text-sm font-medium">{category.label}</span>
                                                <Badge variant="secondary" className="text-xs">{category.items.length}</Badge>
                                              </div>
                                              <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            </button>
                                            {isExpanded && (
                                              <div className="ml-6 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                                {category.items.map((item, idx) => (
                                                  <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                      if (item.fields && item.fields.length > 0) {
                                                        setQuickCreateSelectedTemplate(item);
                                                        setQuickCreateTemplateValues({});
                                                      } else {
                                                        setNewTaskData({
                                                          ...newTaskData, 
                                                          ai_instruction: item.text,
                                                          template_id: item.label
                                                        });
                                                        setQuickCreateSelectedTemplate(null);
                                                      }
                                                    }}
                                                    className="w-full flex items-center gap-2 p-2 text-left text-sm rounded-lg hover:bg-primary/10 transition-colors"
                                                  >
                                                    {item.type === 'task' ? (
                                                      <ClipboardList className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                    ) : (
                                                      <Bell className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                                    )}
                                                    <span className="truncate">{item.label}</span>
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    {/* Campi Template selezionato (se ha fields) */}
                                    {quickCreateSelectedTemplate?.fields?.length ? (
                                      <div className="animate-in slide-in-from-top-2 duration-200 p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border-2 border-dashed border-primary/30">
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-semibold">{quickCreateSelectedTemplate.label}</span>
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setQuickCreateSelectedTemplate(null);
                                              setQuickCreateTemplateValues({});
                                            }}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                          {quickCreateSelectedTemplate.fields.map((field) => (
                                            <div key={field.name} className={field.type === 'text' ? 'col-span-2' : ''}>
                                              <Label className="text-xs mb-1 block">{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
                                              {field.type === 'select' && field.options ? (
                                                <Select
                                                  value={quickCreateTemplateValues[field.name] || ''}
                                                  onValueChange={(v) => {
                                                    const newValues = { ...quickCreateTemplateValues, [field.name]: v };
                                                    setQuickCreateTemplateValues(newValues);
                                                    const allRequiredFilled = quickCreateSelectedTemplate.fields!
                                                      .filter(f => f.required)
                                                      .every(f => newValues[f.name]);
                                                    if (allRequiredFilled && quickCreateSelectedTemplate.generateText) {
                                                      setNewTaskData(prev => ({
                                                        ...prev,
                                                        ai_instruction: quickCreateSelectedTemplate.generateText!(newValues),
                                                        template_id: quickCreateSelectedTemplate.label
                                                      }));
                                                    }
                                                  }}
                                                >
                                                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                                                  <SelectContent>
                                                    {field.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                                  </SelectContent>
                                                </Select>
                                              ) : (
                                                <Input
                                                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
                                                  className="h-9 text-sm"
                                                  placeholder={field.placeholder}
                                                  value={quickCreateTemplateValues[field.name] || ''}
                                                  onChange={(e) => {
                                                    const newValues = { ...quickCreateTemplateValues, [field.name]: e.target.value };
                                                    setQuickCreateTemplateValues(newValues);
                                                    const allRequiredFilled = quickCreateSelectedTemplate.fields!
                                                      .filter(f => f.required)
                                                      .every(f => newValues[f.name]);
                                                    if (allRequiredFilled && quickCreateSelectedTemplate.generateText) {
                                                      setNewTaskData(prev => ({
                                                        ...prev,
                                                        ai_instruction: quickCreateSelectedTemplate.generateText!(newValues),
                                                        template_id: quickCreateSelectedTemplate.label
                                                      }));
                                                    }
                                                  }}
                                                />
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                  )}

                                  {/* SEZIONE 3: ISTRUZIONE AI - adattiva per tipo */}
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                      <div className={`p-1.5 rounded-lg ${
                                        newTaskData.task_type === 'ai_task' 
                                          ? 'bg-purple-100 dark:bg-purple-900/30' 
                                          : 'bg-amber-100 dark:bg-amber-900/30'
                                      }`}>
                                        {newTaskData.task_type === 'ai_task' 
                                          ? <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                          : <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                        }
                                      </div>
                                      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                                        {newTaskData.task_type === 'ai_task' ? 'Compito AI' : 'Istruzione per la chiamata'}
                                      </h3>
                                      {newTaskData.template_id && (
                                        <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-xs">
                                          Template attivo
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="relative">
                                      <Textarea 
                                        placeholder={
                                          newTaskData.task_type === 'single_call' 
                                            ? "Es: 'Ricorda l'appuntamento di domani e conferma la disponibilità'"
                                            : newTaskData.task_type === 'follow_up'
                                            ? "Es: 'Ricontatta il lead per sapere se ha avuto modo di valutare la proposta'"
                                            : "Es: 'Invia un messaggio di follow-up, analizza la risposta e aggiorna il CRM'"
                                        }
                                        className={`bg-muted/30 border-muted-foreground/20 focus:border-primary resize-none pr-12 ${
                                          newTaskData.task_type === 'ai_task' ? 'min-h-[160px]' : 'min-h-[100px]'
                                        }`}
                                        value={newTaskData.ai_instruction}
                                        onChange={(e) => setNewTaskData({...newTaskData, ai_instruction: e.target.value})}
                                      />
                                      <Bot className="absolute right-4 bottom-4 h-5 w-5 text-muted-foreground/30" />
                                    </div>
                                    {newTaskData.task_type === 'ai_task' && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Sparkles className="h-3 w-3" />
                                        L'AI eseguirà automaticamente questo compito senza necessità di chiamata
                                      </p>
                                    )}
                                  </div>

                                  {/* SEZIONE 4: DATA E ORA - Prominente */}
                                  <div className="space-y-5 p-5 rounded-2xl border-2 border-violet-300 dark:border-violet-700 bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-950/30 dark:via-purple-950/20 dark:to-indigo-950/20">
                                    <div className="flex items-center gap-2">
                                      <div className="p-2 bg-violet-100 dark:bg-violet-900/40 rounded-xl">
                                        <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                                      </div>
                                      <h3 className="font-bold text-base text-violet-900 dark:text-violet-200">Quando chiamare</h3>
                                    </div>
                                    
                                    {/* Data e Ora principali */}
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium text-violet-800 dark:text-violet-300 flex items-center gap-1.5">
                                          <CalendarDays className="h-4 w-4" />
                                          Data
                                        </Label>
                                        <Input 
                                          type="date" 
                                          value={newTaskData.scheduled_date}
                                          onChange={(e) => setNewTaskData({...newTaskData, scheduled_date: e.target.value})}
                                          className="h-12 text-lg font-semibold bg-white dark:bg-slate-800 border-violet-200 dark:border-violet-700 focus:border-violet-500"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium text-violet-800 dark:text-violet-300 flex items-center gap-1.5">
                                          <Clock className="h-4 w-4" />
                                          Ora
                                        </Label>
                                        <Input 
                                          type="time" 
                                          value={newTaskData.scheduled_time}
                                          onChange={(e) => setNewTaskData({...newTaskData, scheduled_time: e.target.value})}
                                          className="h-12 text-lg font-semibold bg-white dark:bg-slate-800 border-violet-200 dark:border-violet-700 focus:border-violet-500 [color-scheme:light] dark:[color-scheme:dark]"
                                        />
                                      </div>
                                    </div>
                                    
                                    {/* Riepilogo visivo */}
                                    <div className="flex items-center gap-3 p-3 bg-violet-100/70 dark:bg-violet-900/30 rounded-xl">
                                      <Sparkles className="h-5 w-5 text-violet-600" />
                                      <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
                                        {newTaskData.scheduled_date && newTaskData.scheduled_time ? (
                                          <>Chiamata il <span className="font-bold">{format(new Date(newTaskData.scheduled_date), 'EEEE d MMMM yyyy', { locale: it })}</span> alle <span className="font-bold">{newTaskData.scheduled_time}</span></>
                                        ) : (
                                          'Seleziona data e ora'
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* SEZIONE 5: PROGRAMMAZIONE AVANZATA */}
                                  <div className={`space-y-5 p-5 rounded-2xl border ${
                                    newTaskData.task_type === 'single_call' 
                                      ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800/50'
                                      : newTaskData.task_type === 'follow_up'
                                      ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800/50'
                                      : 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/30 border-slate-200 dark:border-slate-700/50'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${
                                          newTaskData.task_type === 'single_call' 
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                            : newTaskData.task_type === 'follow_up'
                                            ? 'bg-blue-100 dark:bg-blue-900/30'
                                            : 'bg-indigo-100 dark:bg-indigo-900/30'
                                        }`}>
                                          <CalendarClock className={`h-4 w-4 ${
                                            newTaskData.task_type === 'single_call' 
                                              ? 'text-emerald-600 dark:text-emerald-400'
                                              : newTaskData.task_type === 'follow_up'
                                              ? 'text-blue-600 dark:text-blue-400'
                                              : 'text-indigo-600 dark:text-indigo-400'
                                          }`} />
                                        </div>
                                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                                          Ripetizione
                                        </h3>
                                      </div>
                                      {newTaskData.task_type === 'single_call' && (
                                        <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 dark:text-emerald-400">
                                          Chiamata singola
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {/* Tipo frequenza */}
                                    <div className="grid grid-cols-4 gap-2">
                                      {[
                                        { value: 'once', label: 'Una volta', icon: Circle },
                                        { value: 'daily', label: 'Ogni giorno', icon: CalendarDays },
                                        { value: 'weekly', label: 'Settimanale', icon: CalendarRange },
                                        { value: 'specific_dates', label: 'Date specifiche', icon: CalendarCheck }
                                      ].map((freq) => {
                                        const isSelected = newTaskData.recurrence_type === freq.value;
                                        return (
                                          <button
                                            key={freq.value}
                                            type="button"
                                            onClick={() => setNewTaskData({...newTaskData, recurrence_type: freq.value as any})}
                                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${
                                              isSelected 
                                                ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25' 
                                                : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
                                            }`}
                                          >
                                            <freq.icon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-muted-foreground'}`} />
                                            <span className="text-xs font-semibold text-center leading-tight">{freq.label}</span>
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {/* Giorni settimana (se weekly) */}
                                    {newTaskData.recurrence_type === 'weekly' && (
                                      <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 duration-200">
                                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                          <CalendarCheck className="h-3.5 w-3.5" />
                                          Seleziona i giorni della settimana
                                        </Label>
                                        <div className="flex gap-2 justify-between">
                                          {[
                                            { short: 'L', full: 'Lunedì' },
                                            { short: 'M', full: 'Martedì' },
                                            { short: 'M', full: 'Mercoledì' },
                                            { short: 'G', full: 'Giovedì' },
                                            { short: 'V', full: 'Venerdì' },
                                            { short: 'S', full: 'Sabato' },
                                            { short: 'D', full: 'Domenica' }
                                          ].map((day, idx) => {
                                            const dayNum = idx + 1;
                                            const isSelected = (newTaskData.recurrence_days || []).includes(dayNum);
                                            const isWeekend = idx >= 5;
                                            return (
                                              <button
                                                key={idx}
                                                type="button"
                                                title={day.full}
                                                onClick={() => {
                                                  const current = newTaskData.recurrence_days || [];
                                                  const updated = isSelected 
                                                    ? current.filter(d => d !== dayNum)
                                                    : [...current, dayNum].sort();
                                                  setNewTaskData({...newTaskData, recurrence_days: updated});
                                                }}
                                                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-200 ${
                                                  isSelected 
                                                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-110' 
                                                    : isWeekend 
                                                      ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100' 
                                                      : 'bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                                                }`}
                                              >
                                                {day.short}
                                              </button>
                                            );
                                          })}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                          La chiamata avverrà ogni settimana nei giorni selezionati alle <span className="font-semibold">{newTaskData.scheduled_time || '00:00'}</span>
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* Date specifiche con data + ora */}
                                    {newTaskData.recurrence_type === 'specific_dates' && (
                                      <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 duration-200">
                                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                          <CalendarCheck className="h-3.5 w-3.5" />
                                          Aggiungi data e ora specifiche
                                        </Label>
                                        <div className="flex gap-2">
                                          <Input 
                                            type="date" 
                                            id="add-specific-date"
                                            className="flex-1 h-10 bg-white dark:bg-slate-700"
                                            min={format(new Date(), 'yyyy-MM-dd')}
                                          />
                                          <Input 
                                            type="time" 
                                            id="add-specific-time"
                                            defaultValue="10:00"
                                            className="w-24 h-10 bg-white dark:bg-slate-700 [color-scheme:light] dark:[color-scheme:dark]"
                                          />
                                          <Button 
                                            type="button" 
                                            variant="default"
                                            className="h-10 bg-violet-600 hover:bg-violet-700"
                                            onClick={() => {
                                              const dateInput = document.getElementById('add-specific-date') as HTMLInputElement;
                                              const timeInput = document.getElementById('add-specific-time') as HTMLInputElement;
                                              if (dateInput?.value && timeInput?.value) {
                                                const newEntry = { date: dateInput.value, time: timeInput.value };
                                                const currentEntries = (newTaskData as any).specific_datetime || [];
                                                const exists = currentEntries.some((e: any) => e.date === newEntry.date && e.time === newEntry.time);
                                                if (!exists) {
                                                  const updated = [...currentEntries, newEntry].sort((a: any, b: any) => {
                                                    const dateCompare = a.date.localeCompare(b.date);
                                                    return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
                                                  });
                                                  setNewTaskData({...newTaskData, specific_datetime: updated} as any);
                                                }
                                                dateInput.value = '';
                                              }
                                            }}
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Aggiungi
                                          </Button>
                                        </div>
                                        
                                        {/* Lista date aggiunte */}
                                        {((newTaskData as any).specific_datetime || []).length > 0 && (
                                          <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {((newTaskData as any).specific_datetime || []).map((entry: {date: string, time: string}, idx: number) => (
                                              <div 
                                                key={idx} 
                                                className="flex items-center justify-between p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800"
                                              >
                                                <div className="flex items-center gap-3">
                                                  <CalendarDays className="h-4 w-4 text-violet-600" />
                                                  <span className="font-medium text-sm">
                                                    {format(new Date(entry.date), 'EEEE d MMMM', { locale: it })}
                                                  </span>
                                                  <Badge variant="outline" className="border-violet-300 text-violet-700">
                                                    {entry.time}
                                                  </Badge>
                                                </div>
                                                <button 
                                                  type="button"
                                                  onClick={() => {
                                                    const updated = ((newTaskData as any).specific_datetime || []).filter((_: any, i: number) => i !== idx);
                                                    setNewTaskData({...newTaskData, specific_datetime: updated} as any);
                                                  }}
                                                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                                >
                                                  <Trash2 className="h-4 w-4 text-red-500" />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        
                                        {((newTaskData as any).specific_datetime || []).length === 0 && (
                                          <p className="text-xs text-muted-foreground text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                            Nessuna data aggiunta. Seleziona data e ora sopra.
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {/* Riga: Tentativi + Retry + Data fine */}
                                    <div className="grid grid-cols-3 gap-4 pt-2">
                                      {/* Tentativi */}
                                      <div className="space-y-2">
                                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                          <RotateCcw className="h-3.5 w-3.5" />
                                          Tentativi
                                        </Label>
                                        <div className="flex gap-1">
                                          {[1, 2, 3, 4, 5].map((n) => (
                                            <button
                                              key={n}
                                              type="button"
                                              onClick={() => setNewTaskData({...newTaskData, max_attempts: n})}
                                              className={`flex-1 h-9 rounded-lg text-sm font-bold transition-all duration-200 ${
                                                newTaskData.max_attempts === n 
                                                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md' 
                                                  : 'bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                                              }`}
                                            >
                                              {n}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Intervallo retry */}
                                      <div className="space-y-2">
                                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                          <Timer className="h-3.5 w-3.5" />
                                          Intervallo retry
                                        </Label>
                                        <select
                                          value={String(newTaskData.retry_delay_minutes || 15)}
                                          onChange={(e) => setNewTaskData({...newTaskData, retry_delay_minutes: parseInt(e.target.value)})}
                                          className="h-9 w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-sm"
                                        >
                                          <option value="5">5 min</option>
                                          <option value="10">10 min</option>
                                          <option value="15">15 min</option>
                                          <option value="30">30 min</option>
                                          <option value="60">1 ora</option>
                                        </select>
                                      </div>

                                      {/* Data fine (solo per daily/weekly) */}
                                      <div className="space-y-2">
                                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                          <CalendarX className="h-3.5 w-3.5" />
                                          Termina il
                                        </Label>
                                        <Input 
                                          type="date" 
                                          value={newTaskData.recurrence_end_date || ''}
                                          onChange={(e) => setNewTaskData({...newTaskData, recurrence_end_date: e.target.value})}
                                          className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                                          disabled={newTaskData.recurrence_type === 'once' || newTaskData.recurrence_type === 'specific_dates'}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* FOOTER STICKY */}
                                <div className="sticky bottom-0 bg-background border-t px-6 py-4">
                                  <div className="flex gap-3">
                                    <Button 
                                      variant="outline" 
                                      size="lg"
                                      className="flex-1"
                                      onClick={() => {
                                        setShowQuickCreate(false);
                                        setDragStart(null);
                                        setDragEnd(null);
                                      }}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Annulla
                                    </Button>
                                    <Button 
                                      size="lg"
                                      className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-600/25"
                                      disabled={!newTaskData.contact_phone || !newTaskData.ai_instruction || createAITaskMutation.isPending}
                                      onClick={() => {
                                        createAITaskMutation.mutate(newTaskData, {
                                          onSuccess: () => {
                                            setShowQuickCreate(false);
                                            setDragStart(null);
                                            setDragEnd(null);
                                          }
                                        });
                                      }}
                                    >
                                      {createAITaskMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      ) : (
                                        <Sparkles className="h-4 w-4 mr-2" />
                                      )}
                                      Programma Chiamata
                                    </Button>
                                  </div>
                                </div>
                              </SheetContent>
                            </Sheet>

                            {/* Event Details Dialog */}
                            <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
                              <DialogContent className="sm:max-w-lg">
                                {selectedEvent && (
                                  <>
                                    <DialogHeader>
                                      <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${selectedEvent.type === 'task' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                                          {selectedEvent.type === 'task' ? (
                                            <Bot className={`h-5 w-5 text-purple-600 dark:text-purple-400`} />
                                          ) : (
                                            <Phone className={`h-5 w-5 text-blue-600 dark:text-blue-400`} />
                                          )}
                                        </div>
                                        <div>
                                          <DialogTitle className="text-lg">
                                            {selectedEvent.type === 'task' ? 'AI Task' : 'Chiamata Programmata'}
                                          </DialogTitle>
                                          <DialogDescription>
                                            {selectedEvent.type === 'task' 
                                              ? (selectedEvent.data.contact_name || selectedEvent.data.contact_phone)
                                              : selectedEvent.data.target_phone
                                            }
                                          </DialogDescription>
                                        </div>
                                      </div>
                                    </DialogHeader>
                                    
                                    <div className="space-y-4 py-4">
                                      {/* Data e ora */}
                                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                        <CalendarDays className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                          <p className="font-medium">
                                            {format(new Date(selectedEvent.data.scheduled_at), 'EEEE d MMMM yyyy', { locale: it })}
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            alle {format(new Date(selectedEvent.data.scheduled_at), 'HH:mm')}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {/* Stato */}
                                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                        <div className={`w-3 h-3 rounded-full ${
                                          selectedEvent.data.status === 'pending' || selectedEvent.data.status === 'scheduled' ? 'bg-amber-500' :
                                          selectedEvent.data.status === 'completed' ? 'bg-green-500' :
                                          selectedEvent.data.status === 'failed' ? 'bg-red-500' :
                                          selectedEvent.data.status === 'calling' || selectedEvent.data.status === 'in_progress' ? 'bg-blue-500 animate-pulse' :
                                          'bg-gray-400'
                                        }`} />
                                        <div>
                                          <p className="font-medium capitalize">{selectedEvent.data.status}</p>
                                          {selectedEvent.data.attempt_count && (
                                            <p className="text-sm text-muted-foreground">
                                              Tentativo {selectedEvent.data.attempt_count}/{selectedEvent.data.max_attempts || 3}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Istruzioni AI */}
                                      {(selectedEvent.data.ai_instruction || selectedEvent.data.call_instruction) && (
                                        <div className="p-3 bg-muted/50 rounded-lg">
                                          <p className="text-xs font-medium text-muted-foreground mb-1">Istruzioni AI</p>
                                          <p className="text-sm">
                                            {selectedEvent.data.ai_instruction || selectedEvent.data.call_instruction}
                                          </p>
                                        </div>
                                      )}
                                      
                                      {/* Template */}
                                      {(selectedEvent.data.template_id || selectedEvent.data.voice_template_id) && (
                                        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                                          <FileText className="h-4 w-4 text-muted-foreground" />
                                          <div>
                                            <p className="text-xs font-medium text-muted-foreground">Template</p>
                                            <p className="text-sm">{selectedEvent.data.template_id || selectedEvent.data.voice_template_id}</p>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Ricorrenza */}
                                      {selectedEvent.data.recurrence_type && selectedEvent.data.recurrence_type !== 'once' && (
                                        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                                          <RepeatIcon className="h-4 w-4 text-muted-foreground" />
                                          <div>
                                            <p className="text-xs font-medium text-muted-foreground">Ricorrenza</p>
                                            <p className="text-sm capitalize">{selectedEvent.data.recurrence_type}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex justify-between gap-2 pt-2">
                                      <Button 
                                        variant="outline" 
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => {
                                          if (confirm('Sei sicuro di voler cancellare questo evento?')) {
                                            // TODO: Implement delete
                                            setShowEventDetails(false);
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Elimina
                                      </Button>
                                      <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => setShowEventDetails(false)}>
                                          Chiudi
                                        </Button>
                                        <Button 
                                          className="bg-gradient-to-r from-violet-600 to-purple-600"
                                          onClick={() => {
                                            // TODO: Implement edit - populate form and open Quick Create
                                            setShowEventDetails(false);
                                          }}
                                        >
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Modifica
                                        </Button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </DialogContent>
                            </Dialog>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
