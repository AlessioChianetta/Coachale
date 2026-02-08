import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Settings, Activity, Bell, BellOff, Phone, Mail, MessageSquare,
  Clock, Calendar, Shield, Zap, Brain, CheckCircle, AlertCircle, AlertTriangle,
  XCircle, Info, Loader2, RefreshCw, Eye, ChevronLeft, ChevronRight,
  Save, BarChart3, ListTodo, Target, TrendingUp, Hash, Minus,
  Sparkles, User, Lightbulb,
  ArrowRight, Play, Cog, Timer, ChevronDown, ChevronUp, Plus, BookOpen, Database, Search, FileText, PhoneCall, Globe, Table2
} from "lucide-react";
import { motion } from "framer-motion";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AllessiaSidePanel } from "@/components/alessia/FloatingEmployeeChat";

interface AutonomySettings {
  is_active: boolean;
  autonomy_level: number;
  default_mode: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
  max_daily_calls: number;
  max_daily_emails: number;
  max_daily_whatsapp: number;
  max_daily_analyses: number;
  channels_enabled: {
    voice: boolean;
    email: boolean;
    whatsapp: boolean;
  };
  allowed_task_categories: string[];
  custom_instructions: string;
}

interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  severity: "info" | "success" | "warning" | "error";
  created_at: string;
  contact_name?: string;
  is_read: boolean;
}

interface ActivityResponse {
  activities: ActivityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TaskStepPlan {
  step: number;
  action: string;
  description: string;
  status: string;
}

interface AITask {
  id: string;
  ai_instruction: string;
  status: string;
  task_category: string;
  origin_type: string;
  priority: number;
  contact_name?: string;
  ai_reasoning?: string;
  ai_confidence?: number;
  execution_plan?: TaskStepPlan[];
  result_summary?: string;
  result_data?: any;
  scheduled_at?: string;
  completed_at?: string;
  created_at: string;
}

interface TasksResponse {
  tasks: AITask[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TasksStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  pending: number;
}

interface TaskDetailResponse {
  task: AITask;
  activity: ActivityItem[];
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Gio" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sab" },
  { value: 7, label: "Dom" },
];

const TASK_CATEGORIES = [
  { value: "outreach", label: "Contatto", description: "Contattare nuovi o esistenti clienti" },
  { value: "reminder", label: "Promemoria", description: "Ricordare scadenze, appuntamenti, pagamenti" },
  { value: "followup", label: "Follow-up", description: "Ricontattare dopo consulenze o eventi" },
  { value: "analysis", label: "Analisi", description: "Analizzare dati finanziari e pattern del cliente" },
  { value: "report", label: "Report", description: "Generare report e documenti di analisi" },
  { value: "research", label: "Ricerca", description: "Ricercare informazioni di mercato e normative" },
  { value: "preparation", label: "Preparazione", description: "Preparare materiale per consulenze e incontri" },
  { value: "monitoring", label: "Monitoraggio", description: "Monitorare proattivamente situazioni e scadenze clienti" },
];

const TASK_LIBRARY: Array<{
  id: string;
  icon: string;
  title: string;
  description: string;
  category: string;
  instruction: string;
  preferred_channel?: string;
  tone?: string;
  urgency?: string;
  objective?: string;
  priority?: number;
  voice_template_suggestion?: string;
}> = [
  {
    id: "outreach-call",
    icon: "📞",
    title: "Chiamata commerciale",
    description: "Contatta il cliente per presentare i tuoi servizi e proporre un appuntamento conoscitivo",
    category: "outreach",
    instruction: "Contatta il cliente per presentare i servizi disponibili e proporre un appuntamento conoscitivo",
    preferred_channel: "voice",
    tone: "persuasivo",
    objective: "vendere",
    priority: 2,
    voice_template_suggestion: "sales-orbitale",
  },
  {
    id: "outreach-email",
    icon: "📧",
    title: "Email di presentazione",
    description: "Invia un'email professionale per presentare i tuoi servizi e invitare a fissare un incontro",
    category: "outreach",
    instruction: "Invia un'email professionale di presentazione dei servizi offerti, evidenziando i vantaggi e invitando a fissare un appuntamento",
    preferred_channel: "email",
    tone: "professionale",
    objective: "vendere",
    priority: 3,
  },
  {
    id: "outreach-whatsapp",
    icon: "💬",
    title: "Messaggio WhatsApp",
    description: "Invia un messaggio WhatsApp breve e cordiale per presentarsi e proporre un primo contatto",
    category: "outreach",
    instruction: "Invia un messaggio WhatsApp breve e cordiale per presentarsi e proporre una prima consulenza gratuita",
    preferred_channel: "whatsapp",
    tone: "informale",
    objective: "vendere",
    priority: 3,
  },
  {
    id: "followup-post-consulenza",
    icon: "🔄",
    title: "Follow-up post incontro",
    description: "Ricontatta il cliente dopo l'ultimo incontro per raccogliere feedback e proporre i prossimi passi",
    category: "followup",
    instruction: "Ricontatta il cliente dopo l'ultimo incontro per verificare se ha domande, raccogliere feedback e proporre i prossimi passi",
    preferred_channel: "voice",
    tone: "empatico",
    objective: "fidelizzare",
    priority: 2,
    voice_template_suggestion: "follow-up-lead",
  },
  {
    id: "followup-email",
    icon: "📩",
    title: "Follow-up email",
    description: "Invia un'email di follow-up con il riepilogo dei punti discussi e le azioni concordate",
    category: "followup",
    instruction: "Invia un'email di follow-up dopo l'incontro con un riepilogo dei punti discussi e le azioni concordate",
    preferred_channel: "email",
    tone: "professionale",
    objective: "fidelizzare",
    priority: 3,
  },
  {
    id: "followup-sollecito",
    icon: "🔔",
    title: "Sollecito pagamento",
    description: "Contatta il cliente per ricordare gentilmente un pagamento in sospeso e offrire assistenza",
    category: "followup",
    instruction: "Contatta il cliente per ricordare gentilmente un pagamento in sospeso e offrire assistenza per il saldo",
    preferred_channel: "voice",
    tone: "formale",
    objective: "raccogliere_info",
    priority: 1,
    voice_template_suggestion: "recupero-crediti",
  },
  {
    id: "reminder-scadenza",
    icon: "⏰",
    title: "Scadenza contratto",
    description: "Avvisa il cliente di una scadenza imminente e suggerisci una revisione o un rinnovo",
    category: "reminder",
    instruction: "Avvisa il cliente della prossima scadenza del suo contratto o servizio attivo e suggerisci una revisione insieme",
    preferred_channel: "voice",
    tone: "professionale",
    objective: "informare",
    priority: 2,
  },
  {
    id: "reminder-appuntamento",
    icon: "📅",
    title: "Promemoria appuntamento",
    description: "Ricorda al cliente l'appuntamento programmato e conferma la sua disponibilità",
    category: "reminder",
    instruction: "Ricorda al cliente l'appuntamento programmato e conferma la sua disponibilità",
    preferred_channel: "whatsapp",
    tone: "informale",
    objective: "informare",
    priority: 1,
  },
  {
    id: "analysis-cliente",
    icon: "📊",
    title: "Analisi cliente",
    description: "Analizza lo storico del cliente, identifica pattern nelle interazioni e genera raccomandazioni strategiche",
    category: "analysis",
    instruction: "Analizza lo storico del cliente, identifica pattern nelle interazioni passate e genera raccomandazioni strategiche per migliorare il rapporto",
    tone: "professionale",
    objective: "informare",
    priority: 2,
  },
  {
    id: "report-mensile",
    icon: "📋",
    title: "Report mensile",
    description: "Genera un report mensile dettagliato con un riepilogo delle attività, risultati e prossimi passi",
    category: "report",
    instruction: "Genera un report mensile dettagliato con il riepilogo delle attività svolte, i risultati ottenuti e le raccomandazioni per il mese prossimo",
    tone: "professionale",
    objective: "informare",
    priority: 3,
  },
  {
    id: "research-settore",
    icon: "🔍",
    title: "Ricerca di settore",
    description: "Cerca e analizza le ultime tendenze, normative e opportunità rilevanti per il tuo settore",
    category: "research",
    instruction: "Cerca e analizza le ultime tendenze di settore, normative aggiornate e opportunità rilevanti per i clienti",
    tone: "professionale",
    objective: "informare",
    priority: 3,
  },
  {
    id: "monitoring-checkin",
    icon: "💚",
    title: "Check-in periodico",
    description: "Effettua un check-in di cortesia con il cliente per mantenere il rapporto e verificare la soddisfazione",
    category: "monitoring",
    instruction: "Effettua un check-in di cortesia con il cliente per verificare il suo stato, rispondere a domande e mantenere il rapporto",
    preferred_channel: "voice",
    tone: "empatico",
    objective: "fidelizzare",
    priority: 3,
    voice_template_suggestion: "check-in-cliente",
  },
  {
    id: "monitoring-proattivo",
    icon: "👀",
    title: "Monitoraggio proattivo",
    description: "Monitora la situazione del cliente, verifica scadenze imminenti e segnala eventuali criticità",
    category: "monitoring",
    instruction: "Monitora la situazione del cliente, verifica scadenze imminenti e segnala eventuali criticità che richiedono attenzione",
    tone: "professionale",
    objective: "supporto",
    priority: 2,
  },
  {
    id: "preparation-consulenza",
    icon: "📝",
    title: "Preparazione incontro",
    description: "Prepara materiale e dossier per il prossimo incontro: situazione attuale, obiettivi e proposte",
    category: "preparation",
    instruction: "Prepara materiale e dossier per il prossimo incontro con il cliente: analisi situazione attuale, obiettivi e proposte da discutere",
    tone: "professionale",
    objective: "informare",
    priority: 2,
  },
];

const DEFAULT_SETTINGS: AutonomySettings = {
  is_active: false,
  autonomy_level: 1,
  default_mode: "manual",
  working_hours_start: "08:00",
  working_hours_end: "20:00",
  working_days: [1, 2, 3, 4, 5],
  max_daily_calls: 10,
  max_daily_emails: 20,
  max_daily_whatsapp: 30,
  max_daily_analyses: 50,
  channels_enabled: { voice: true, email: false, whatsapp: false },
  allowed_task_categories: ["outreach", "reminder", "followup"],
  custom_instructions: "",
};

function getAutonomyLabel(level: number): { label: string; color: string; description: string } {
  if (level === 0) return { label: "Disattivato", color: "text-muted-foreground", description: "Il dipendente AI è completamente disattivato. Non eseguirà alcuna azione." };
  if (level === 1) return { label: "Solo manuale", color: "text-green-500", description: "Modalità manuale: puoi creare task per l'AI, che li eseguirà solo quando programmati. Nessuna azione autonoma." };
  if (level <= 3) return { label: "Proposte", color: "text-green-500", description: "L'AI può eseguire task programmati autonomamente durante l'orario di lavoro, ma solo nelle categorie abilitate. Ti notifica ogni azione." };
  if (level <= 6) return { label: "Semi-autonomo", color: "text-yellow-500", description: "L'AI esegue task di routine autonomamente e può proporre nuove azioni. Chiede approvazione per decisioni importanti come chiamate e email." };
  if (level <= 9) return { label: "Quasi autonomo", color: "text-orange-500", description: "L'AI opera in modo indipendente: analizza, decide e agisce. Ti notifica solo per situazioni critiche o fuori dalla norma." };
  return { label: "Autonomia completa", color: "text-red-500", description: "L'AI gestisce tutto autonomamente entro i limiti configurati. Agisce senza approvazione su tutte le categorie e canali abilitati." };
}

function getAutonomyBadgeColor(level: number): string {
  if (level === 0) return "bg-muted text-muted-foreground";
  if (level <= 3) return "bg-green-500/20 text-green-500 border-green-500/30";
  if (level <= 6) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
  if (level <= 9) return "bg-orange-500/20 text-orange-500 border-orange-500/30";
  return "bg-red-500/20 text-red-500 border-red-500/30";
}

function getActivityIcon(icon: string) {
  switch (icon) {
    case "brain": return <Brain className="h-5 w-5" />;
    case "check": return <CheckCircle className="h-5 w-5" />;
    case "alert": return <AlertCircle className="h-5 w-5" />;
    case "phone": return <Phone className="h-5 w-5" />;
    case "mail": return <Mail className="h-5 w-5" />;
    case "chart": return <BarChart3 className="h-5 w-5" />;
    default: return <Activity className="h-5 w-5" />;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "info": return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Info</Badge>;
    case "success": return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Successo</Badge>;
    case "warning": return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Avviso</Badge>;
    case "error": return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Errore</Badge>;
    default: return <Badge variant="secondary">{severity}</Badge>;
  }
}

function getTaskStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
    case "in_progress":
    case "approved":
      return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Attivo</Badge>;
    case "completed":
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Completato</Badge>;
    case "failed":
      return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Fallito</Badge>;
    case "paused":
    case "draft":
    case "waiting_approval":
      return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">In pausa</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    outreach: "Contatto",
    analysis: "Analisi",
    report: "Report",
    followup: "Follow-up",
    research: "Ricerca",
    preparation: "Preparazione",
    monitoring: "Monitoraggio",
    reminder: "Promemoria",
  };
  return map[category] || category;
}

function getCategoryBadge(category: string) {
  return <Badge variant="outline" className="text-xs">{getCategoryLabel(category)}</Badge>;
}

function getPriorityIndicator(priority: number) {
  if (priority === 1) return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-xs">Alta</Badge>;
  if (priority === 2) return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 text-xs">Media-Alta</Badge>;
  if (priority === 3) return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-xs">Media</Badge>;
  return <Badge className="bg-muted text-muted-foreground text-xs">Bassa</Badge>;
}

function getStepStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "in_progress":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "skipped":
      return <Minus className="h-5 w-5 text-muted-foreground" />;
    default:
      return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40" />;
  }
}

function getStepActionLabel(action: string): string {
  const labels: Record<string, string> = {
    fetch_client_data: "📊 Raccolta dati cliente",
    analyze_patterns: "🔍 Analisi pattern e trend",
    generate_report: "📝 Generazione report",
    prepare_call: "📞 Preparazione chiamata",
    voice_call: "🗣️ Chiamata vocale",
    send_email: "📧 Invio email",
    send_whatsapp: "💬 Invio WhatsApp",
    web_search: "🌐 Ricerca web",
  };
  return labels[action] || action;
}

function tryParseJSON(value: any): any {
  if (typeof value !== 'string') return value;
  let cleaned = value.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return value;
  }
}

function renderFormattedText(text: any): React.ReactNode {
  if (typeof text !== 'string') return text;
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const processItalicAndBreaks = (str: string, keyPrefix: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    const italicRegex = /\*(.+?)\*/g;
    let iLastIndex = 0;
    let iMatch: RegExpExecArray | null;
    while ((iMatch = italicRegex.exec(str)) !== null) {
      if (iMatch.index > iLastIndex) {
        const before = str.slice(iLastIndex, iMatch.index);
        before.split('\n').forEach((line, li, arr) => {
          result.push(<React.Fragment key={`${keyPrefix}-t-${iLastIndex}-${li}`}>{line}</React.Fragment>);
          if (li < arr.length - 1) result.push(<br key={`${keyPrefix}-br-${iLastIndex}-${li}`} />);
        });
      }
      result.push(<em key={`${keyPrefix}-em-${iMatch.index}`}>{iMatch[1]}</em>);
      iLastIndex = iMatch.index + iMatch[0].length;
    }
    if (iLastIndex < str.length) {
      const remaining = str.slice(iLastIndex);
      remaining.split('\n').forEach((line, li, arr) => {
        result.push(<React.Fragment key={`${keyPrefix}-t-${iLastIndex}-${li}`}>{line}</React.Fragment>);
        if (li < arr.length - 1) result.push(<br key={`${keyPrefix}-br-${iLastIndex}-${li}`} />);
      });
    }
    return result;
  };
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...processItalicAndBreaks(text.slice(lastIndex, match.index), `p-${lastIndex}`));
    }
    parts.push(<strong key={`b-${match.index}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(...processItalicAndBreaks(text.slice(lastIndex), `p-${lastIndex}`));
  }
  return <>{parts}</>;
}

function cleanBoldMarkers(text: string): string {
  if (typeof text !== 'string') return String(text || '');
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
}

async function generateTaskPDF(task: AITask) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNum = 1;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 25) {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Pagina ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.addPage();
      pageNum++;
      y = margin;
    }
  };

  const addText = (text: string, fontSize: number, options?: { bold?: boolean; color?: [number, number, number]; maxWidth?: number; lineHeight?: number }) => {
    const cleaned = cleanBoldMarkers(text);
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    if (options?.color) doc.setTextColor(...options.color);
    else doc.setTextColor(40, 40, 40);
    const w = options?.maxWidth || contentWidth;
    const lines = doc.splitTextToSize(cleaned, w);
    const lh = options?.lineHeight || fontSize * 0.5;
    for (const line of lines) {
      checkPageBreak(lh);
      doc.text(line, margin, y);
      y += lh;
    }
  };

  const addSpacer = (h: number) => { y += h; };

  const parsedResults: Record<string, any> = {};
  if (task.result_data?.results) {
    for (const key of Object.keys(task.result_data.results)) {
      parsedResults[key] = tryParseJSON(task.result_data.results[key]);
    }
  }

  const report = parsedResults.generate_report;
  const analysis = parsedResults.analyze_patterns;
  const webSearch = parsedResults.web_search;
  const callPrep = parsedResults.prepare_call;

  const title = report?.title || task.ai_instruction || 'Report AI';
  const contactName = task.contact_name || '';
  const dateStr = task.completed_at
    ? new Date(task.completed_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  doc.setFillColor(20, 30, 50);
  doc.rect(0, 0, pageWidth, 45, 'F');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(cleanBoldMarkers(title), contentWidth);
  let titleY = 18;
  for (const line of titleLines) {
    doc.text(line, margin, titleY);
    titleY += 8;
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 220);
  const headerInfo = [contactName && `Cliente: ${contactName}`, `Data: ${dateStr}`].filter(Boolean).join('  |  ');
  doc.text(headerInfo, margin, Math.max(titleY + 2, 38));
  y = 55;

  if (report && typeof report === 'object') {
    if (report.summary) {
      addText('Riepilogo', 13, { bold: true, color: [30, 30, 30] });
      addSpacer(2);
      addText(report.summary, 10, { color: [80, 80, 80], lineHeight: 4.5 });
      addSpacer(6);
    }

    if (report.sections && Array.isArray(report.sections)) {
      for (const section of report.sections) {
        checkPageBreak(15);
        addText(section.heading, 12, { bold: true, color: [30, 30, 30] });
        addSpacer(2);
        addText(section.content, 10, { color: [80, 80, 80], lineHeight: 4.5 });
        addSpacer(6);
      }
    }

    if (report.key_findings && Array.isArray(report.key_findings) && report.key_findings.length > 0) {
      checkPageBreak(15);
      addText('Risultati Chiave', 13, { bold: true, color: [30, 100, 30] });
      addSpacer(2);
      for (const finding of report.key_findings) {
        checkPageBreak(8);
        addText(`• ${finding}`, 10, { color: [60, 60, 60], lineHeight: 4.5 });
        addSpacer(2);
      }
      addSpacer(4);
    }

    if (report.recommendations && Array.isArray(report.recommendations) && report.recommendations.length > 0) {
      checkPageBreak(15);
      addText('Raccomandazioni', 13, { bold: true, color: [30, 30, 130] });
      addSpacer(2);
      for (const rec of report.recommendations) {
        checkPageBreak(12);
        const priorityLabel = rec.priority === 'high' ? '[ALTA]' : rec.priority === 'medium' ? '[MEDIA]' : '[BASSA]';
        addText(`${priorityLabel} ${rec.action}`, 10, { bold: true, color: [40, 40, 40] });
        if (rec.rationale) {
          addText(rec.rationale, 9, { color: [100, 100, 100], lineHeight: 4 });
        }
        addSpacer(3);
      }
      addSpacer(4);
    }

    if (report.next_steps && Array.isArray(report.next_steps) && report.next_steps.length > 0) {
      checkPageBreak(15);
      addText('Prossimi Passi', 13, { bold: true, color: [30, 80, 130] });
      addSpacer(2);
      report.next_steps.forEach((step: string, i: number) => {
        checkPageBreak(8);
        addText(`${i + 1}. ${step}`, 10, { color: [60, 60, 60], lineHeight: 4.5 });
        addSpacer(2);
      });
      addSpacer(4);
    }
  }

  if (webSearch && typeof webSearch === 'object') {
    checkPageBreak(15);
    const webSearchY = y;
    const boxHeight = (webSearch.findings ? 25 : 8) + (webSearch.sources?.length || 0) * 8;
    doc.setFillColor(240, 245, 255);
    doc.rect(margin - 2, webSearchY - 3, contentWidth + 4, boxHeight, 'F');
    doc.setDrawColor(100, 150, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, webSearchY + boxHeight - 5, margin + contentWidth, webSearchY + boxHeight - 5);
    addText('Ricerca Web', 13, { bold: true, color: [30, 30, 130] });
    addSpacer(3);
    if (webSearch.findings) {
      addText(webSearch.findings, 10.5, { color: [80, 80, 80], lineHeight: 5 });
      addSpacer(5);
    }
    if (webSearch.sources && Array.isArray(webSearch.sources) && webSearch.sources.length > 0) {
      addText('Fonti:', 11, { bold: true, color: [40, 40, 40] });
      addSpacer(2);
      for (const source of webSearch.sources) {
        checkPageBreak(6);
        addText(`• ${source.title || source.url}`, 10, { color: [40, 80, 160] });
        if (source.url && source.title) {
          addText(`  ${source.url}`, 9, { color: [120, 120, 120] });
        }
        addSpacer(3);
      }
      addSpacer(4);
    }
  }

  if (analysis && typeof analysis === 'object' && !report) {
    checkPageBreak(15);
    addText('Analisi', 13, { bold: true, color: [30, 30, 30] });
    addSpacer(2);

    if (analysis.client_profile_summary) {
      addText('Profilo Cliente', 11, { bold: true });
      addSpacer(2);
      addText(analysis.client_profile_summary, 10, { color: [80, 80, 80], lineHeight: 4.5 });
      addSpacer(4);
    }

    const listSections: Array<{ label: string; items: string[]; color: [number, number, number] }> = [];
    if (analysis.strengths?.length) listSections.push({ label: 'Punti di Forza', items: analysis.strengths, color: [30, 120, 30] });
    if (analysis.weaknesses?.length) listSections.push({ label: 'Aree di Miglioramento', items: analysis.weaknesses, color: [180, 100, 30] });
    if (analysis.opportunities?.length) listSections.push({ label: 'Opportunità', items: analysis.opportunities, color: [30, 80, 160] });
    if (analysis.behavioral_patterns?.length) listSections.push({ label: 'Pattern Comportamentali', items: analysis.behavioral_patterns, color: [80, 80, 80] });
    if (analysis.insights?.length) listSections.push({ label: 'Insight', items: analysis.insights, color: [130, 100, 30] });

    for (const sec of listSections) {
      checkPageBreak(12);
      addText(sec.label, 11, { bold: true, color: sec.color });
      addSpacer(2);
      for (const item of sec.items) {
        checkPageBreak(8);
        addText(`• ${item}`, 10, { color: [60, 60, 60], lineHeight: 4.5 });
        addSpacer(1);
      }
      addSpacer(4);
    }

    if (analysis.risk_assessment) {
      checkPageBreak(12);
      const riskLabel = analysis.risk_assessment.level === 'high' ? 'Alto' : analysis.risk_assessment.level === 'medium' ? 'Medio' : 'Basso';
      addText(`Valutazione Rischio: ${riskLabel}`, 11, { bold: true, color: analysis.risk_assessment.level === 'high' ? [180, 30, 30] : analysis.risk_assessment.level === 'medium' ? [180, 150, 30] : [30, 130, 30] });
      addSpacer(2);
      addText(analysis.risk_assessment.description, 10, { color: [80, 80, 80], lineHeight: 4.5 });
      addSpacer(4);
    }

    if (analysis.suggested_approach) {
      checkPageBreak(12);
      addText('Approccio Suggerito', 11, { bold: true });
      addSpacer(2);
      addText(analysis.suggested_approach, 10, { color: [80, 80, 80], lineHeight: 4.5 });
      addSpacer(4);
    }

    if (analysis.recommendations?.length) {
      checkPageBreak(12);
      addText('Raccomandazioni', 11, { bold: true, color: [30, 30, 130] });
      addSpacer(2);
      for (const rec of analysis.recommendations) {
        checkPageBreak(6);
        addText(`• ${typeof rec === 'string' ? rec : rec.action || JSON.stringify(rec)}`, 10, { color: [60, 60, 60], lineHeight: 4.5 });
        addSpacer(1);
      }
      addSpacer(4);
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Pagina ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  const safeName = (contactName || 'task').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const fileDate = task.completed_at
    ? new Date(task.completed_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  doc.save(`report_${safeName}_${fileDate}.pdf`);
}

function DeepResearchResults({ results }: { results: Record<string, any> }) {
  const sections: React.ReactNode[] = [];

  const parsedResults = { ...results };
  for (const key of Object.keys(parsedResults)) {
    parsedResults[key] = tryParseJSON(parsedResults[key]);
  }
  const report = parsedResults.generate_report;
  const analysis = parsedResults.analyze_patterns;
  const webSearch = parsedResults.web_search;
  const callPrep = parsedResults.prepare_call;

  if (report && typeof report === 'object') {
    sections.push(
      <div key="report" className="space-y-8">
        <h3 className="text-base font-bold flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-primary" />
          {report.title || "Report"}
        </h3>
        {report.summary && (
          <p className="text-sm text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg p-5 leading-[1.8] mb-4">
            {renderFormattedText(report.summary)}
          </p>
        )}
        {report.sections && Array.isArray(report.sections) && report.sections.map((section: any, i: number) => (
          <div key={i} className="space-y-3 mt-6">
            <h4 className="text-sm font-semibold text-foreground mb-3">{section.heading}</h4>
            <p className="text-sm text-muted-foreground leading-[1.85] whitespace-pre-wrap mb-4">{renderFormattedText(section.content)}</p>
          </div>
        ))}
        {report.key_findings && Array.isArray(report.key_findings) && report.key_findings.length > 0 && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-xl p-5 mt-6">
            <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-4">🔑 Risultati Chiave</p>
            <ul className="space-y-3">
              {report.key_findings.map((finding: string, i: number) => (
                <li key={i} className="text-sm text-green-700 dark:text-green-300 flex items-start gap-2 leading-[1.8]">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{renderFormattedText(finding)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.recommendations && Array.isArray(report.recommendations) && report.recommendations.length > 0 && (
          <div className="space-y-4 mt-6">
            <p className="text-sm font-semibold mb-3">💡 Raccomandazioni</p>
            {report.recommendations.map((rec: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                <div className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 mt-0.5",
                  rec.priority === 'high' ? "bg-red-500/20 text-red-600" :
                  rec.priority === 'medium' ? "bg-yellow-500/20 text-yellow-600" :
                  "bg-green-500/20 text-green-600"
                )}>
                  {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Bassa'}
                </div>
                <div>
                  <p className="text-sm font-medium leading-[1.8]">{renderFormattedText(rec.action)}</p>
                  {rec.rationale && <p className="text-xs text-muted-foreground mt-2 leading-[1.75]">{renderFormattedText(rec.rationale)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {report.next_steps && Array.isArray(report.next_steps) && report.next_steps.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-5 mt-6">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-4">➡️ Prossimi Passi</p>
            <ol className="space-y-3 list-decimal list-inside">
              {report.next_steps.map((step: string, i: number) => (
                <li key={i} className="text-sm text-blue-700 dark:text-blue-300 leading-[1.8]">{renderFormattedText(step)}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }

  if (analysis && typeof analysis === 'object' && !report) {
    sections.push(
      <div key="analysis" className="space-y-8">
        <h3 className="text-base font-bold flex items-center gap-2 mb-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          Analisi
        </h3>
        {analysis.client_profile_summary && (
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-5">
            <p className="text-sm font-semibold mb-3">Profilo Cliente</p>
            <p className="text-sm text-muted-foreground leading-[1.85] whitespace-pre-wrap mb-4">{renderFormattedText(analysis.client_profile_summary)}</p>
          </div>
        )}
        {analysis.strengths && Array.isArray(analysis.strengths) && analysis.strengths.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3">💪 Punti di Forza</p>
            <ul className="space-y-3">
              {analysis.strengths.map((s: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-500" />
                  <span>{renderFormattedText(s)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.weaknesses && Array.isArray(analysis.weaknesses) && analysis.weaknesses.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-3">⚠️ Aree di Miglioramento</p>
            <ul className="space-y-3">
              {analysis.weaknesses.map((w: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-500" />
                  <span>{renderFormattedText(w)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.opportunities && Array.isArray(analysis.opportunities) && analysis.opportunities.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3">🚀 Opportunità</p>
            <ul className="space-y-3">
              {analysis.opportunities.map((o: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
                  <span>{renderFormattedText(o)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.behavioral_patterns && Array.isArray(analysis.behavioral_patterns) && analysis.behavioral_patterns.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold mb-3">📊 Pattern Comportamentali</p>
            <ul className="space-y-3">
              {analysis.behavioral_patterns.map((p: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <span className="text-muted-foreground/60">•</span>
                  <span>{renderFormattedText(p)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.past_consultation_insights && Array.isArray(analysis.past_consultation_insights) && analysis.past_consultation_insights.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold mb-3">📋 Insight dalle Consulenze Passate</p>
            <ul className="space-y-3">
              {analysis.past_consultation_insights.map((ins: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" />
                  <span>{renderFormattedText(ins)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.insights && Array.isArray(analysis.insights) && (
          <div className="space-y-3">
            <p className="text-sm font-semibold mb-3">💡 Insight</p>
            <ul className="space-y-3">
              {analysis.insights.map((insight: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-500" />
                  <span>{renderFormattedText(insight)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.risk_assessment && (
          <div className={cn(
            "rounded-xl p-5 border",
            analysis.risk_assessment.level === 'high' ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50" :
            analysis.risk_assessment.level === 'medium' ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/50" :
            "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50"
          )}>
            <p className="text-sm font-semibold mb-3">
              {analysis.risk_assessment.level === 'high' ? '🔴' : analysis.risk_assessment.level === 'medium' ? '🟡' : '🟢'} Valutazione Rischio: {analysis.risk_assessment.level === 'high' ? 'Alto' : analysis.risk_assessment.level === 'medium' ? 'Medio' : 'Basso'}
            </p>
            <p className="text-sm text-muted-foreground leading-[1.8]">{renderFormattedText(analysis.risk_assessment.description)}</p>
          </div>
        )}
        {analysis.suggested_approach && (
          <div className="bg-muted/50 rounded-lg p-5 border border-border">
            <p className="text-sm font-semibold mb-3">Approccio Suggerito</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-[1.85]">{renderFormattedText(analysis.suggested_approach)}</p>
          </div>
        )}
      </div>
    );
  }

  if (webSearch && typeof webSearch === 'object') {
    sections.push(
      <div key="websearch" className="space-y-7">
        <h3 className="text-base font-bold flex items-center gap-2 mb-3">
          🌐 Ricerca Web
        </h3>
        {webSearch.findings && (
          <div className="text-sm text-muted-foreground leading-[1.85] whitespace-pre-wrap bg-muted/30 rounded-lg p-5 border border-border mb-4">
            {renderFormattedText(webSearch.findings)}
          </div>
        )}
        {webSearch.sources && Array.isArray(webSearch.sources) && webSearch.sources.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-3">Fonti</p>
            <div className="space-y-2">
              {webSearch.sources.map((source: any, i: number) => (
                <a key={i} href={source.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  <ArrowRight className="h-3 w-3" />
                  {source.title || source.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (callPrep && typeof callPrep === 'object') {
    sections.push(
      <div key="callprep" className="space-y-7">
        <h3 className="text-base font-bold flex items-center gap-2 mb-3">
          <Phone className="h-5 w-5 text-primary" />
          Preparazione Chiamata
        </h3>
        {callPrep.opening_script && (
          <div className="bg-muted/50 rounded-lg p-5 border border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Apertura</p>
            <p className="text-sm italic leading-[1.8]">"{renderFormattedText(callPrep.opening_script)}"</p>
          </div>
        )}
        {callPrep.talking_points && Array.isArray(callPrep.talking_points) && (
          <div className="space-y-4">
            <p className="text-sm font-semibold mb-3">Punti di Discussione</p>
            {callPrep.talking_points.map((tp: any, i: number) => (
              <div key={i} className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-sm font-medium leading-[1.8]">{renderFormattedText(tp.topic)}</p>
                <p className="text-xs text-muted-foreground mt-2 leading-[1.75]">{renderFormattedText(tp.key_message)}</p>
                {tp.supporting_details && <p className="text-xs text-muted-foreground mt-2 italic leading-[1.75]">{renderFormattedText(tp.supporting_details)}</p>}
              </div>
            ))}
          </div>
        )}
        {callPrep.closing_script && (
          <div className="bg-muted/50 rounded-lg p-5 border border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Chiusura</p>
            <p className="text-sm italic leading-[1.8]">"{renderFormattedText(callPrep.closing_script)}"</p>
          </div>
        )}
      </div>
    );
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Separator />
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        Risultati Deep Research
      </h3>
      {sections}
    </div>
  );
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "ora" : "ore"} fa`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "giorno" : "giorni"} fa`;
  return date.toLocaleDateString("it-IT");
}

export default function ConsultantAIAutonomyPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [settings, setSettings] = useState<AutonomySettings>(DEFAULT_SETTINGS);
  const [activityPage, setActivityPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [dashboardPage, setDashboardPage] = useState(1);
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<string>("all");
  const [dashboardCategoryFilter, setDashboardCategoryFilter] = useState<string>("all");
  const [dashboardOriginFilter, setDashboardOriginFilter] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showArchDetails, setShowArchDetails] = useState(true);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showLibrary, setShowLibrary] = useState(true);
  const [newTask, setNewTask] = useState({
    ai_instruction: "", task_category: "analysis", priority: 3, contact_name: "", contact_phone: "", client_id: "",
    preferred_channel: "", tone: "", urgency: "normale", scheduled_datetime: "", objective: "", additional_context: "", voice_template_suggestion: "", language: "it"
  });
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [clientSearchFilter, setClientSearchFilter] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ["/api/ai-autonomy/settings"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/settings", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allClients } = useQuery<Array<{ id: string; firstName: string; lastName: string; email: string; phoneNumber?: string; isActive: boolean }>>({
    queryKey: ["/api/clients-for-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  useEffect(() => {
    if (settingsData) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...settingsData,
        custom_instructions: settingsData.custom_instructions || "",
        channels_enabled: {
          ...DEFAULT_SETTINGS.channels_enabled,
          ...(settingsData.channels_enabled || {}),
        },
      });
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async (data: AutonomySettings) => {
      const res = await fetch("/api/ai-autonomy/settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Salvato", description: "Impostazioni di autonomia aggiornate con successo" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const activityUrl = `/api/ai-autonomy/activity?page=${activityPage}&limit=20${severityFilter !== "all" ? `&severity=${severityFilter}` : ""}`;
  const { data: activityData, isLoading: loadingActivity } = useQuery<ActivityResponse>({
    queryKey: [activityUrl],
    queryFn: async () => {
      const res = await fetch(activityUrl, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "activity",
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/ai-autonomy/activity/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/activity/unread-count", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai-autonomy/activity/${id}/read`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activityUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/activity/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai-autonomy/activity/read-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Fatto", description: "Tutte le attività segnate come lette" });
      queryClient.invalidateQueries({ queryKey: [activityUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/activity/unread-count"] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      const res = await fetch("/api/ai-autonomy/tasks", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella creazione");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task creato", description: "Il task è stato programmato per l'esecuzione" });
      setShowCreateTask(false);
      setNewTask({ ai_instruction: "", task_category: "analysis", priority: 3, contact_name: "", contact_phone: "", client_id: "", preferred_channel: "", tone: "", urgency: "normale", scheduled_datetime: "", objective: "", additional_context: "", voice_template_suggestion: "", language: "it" });
      setAiSuggested(false);
      setClientSearchFilter("");
      queryClient.invalidateQueries({ queryKey: [tasksUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const analyzeWithAI = async () => {
    if (!newTask.ai_instruction.trim()) return;
    setAiAnalyzing(true);
    try {
      const res = await fetch("/api/ai-autonomy/tasks/analyze", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ai_instruction: newTask.ai_instruction }),
      });
      if (!res.ok) throw new Error("Analisi fallita");
      const data = await res.json();
      if (data.success && data.suggestions) {
        const s = data.suggestions;
        setNewTask(prev => ({
          ...prev,
          task_category: s.task_category || prev.task_category,
          priority: s.priority || prev.priority,
          client_id: s.client_id || prev.client_id,
          contact_name: s.client_name || s.contact_name || prev.contact_name,
          contact_phone: s.contact_phone || prev.contact_phone,
          preferred_channel: s.preferred_channel && s.preferred_channel !== "none" ? s.preferred_channel : prev.preferred_channel,
          tone: s.tone || prev.tone,
          urgency: s.urgency || prev.urgency,
          objective: s.objective || prev.objective,
          voice_template_suggestion: s.voice_template_suggestion || prev.voice_template_suggestion,
          language: s.language || prev.language,
          additional_context: s.additional_context || prev.additional_context,
          scheduled_datetime: s.scheduled_datetime || prev.scheduled_datetime,
        }));
        setAiSuggested(true);
        toast({ title: "Analisi completata", description: s.reasoning || "Campi compilati dall'AI" });
      }
    } catch (err: any) {
      toast({ title: "Errore analisi", description: err.message, variant: "destructive" });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const { data: activeTasks } = useQuery<AITask[]>({
    queryKey: ["/api/ai-autonomy/active-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/tasks?status=active&limit=5", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return data.tasks || [];
    },
    enabled: activeTab === "dashboard",
    refetchInterval: 5000,
  });

  const { data: tasksStats, isLoading: loadingStats } = useQuery<TasksStats>({
    queryKey: ["/api/ai-autonomy/tasks-stats"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/tasks-stats", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "dashboard",
  });

  const tasksUrl = `/api/ai-autonomy/tasks?page=${dashboardPage}&limit=10${dashboardStatusFilter !== "all" ? `&status=${dashboardStatusFilter}` : ""}${dashboardCategoryFilter !== "all" ? `&category=${dashboardCategoryFilter}` : ""}${dashboardOriginFilter !== "all" ? `&origin=${dashboardOriginFilter}` : ""}`;
  const { data: tasksData, isLoading: loadingTasks } = useQuery<TasksResponse>({
    queryKey: [tasksUrl],
    queryFn: async () => {
      const res = await fetch(tasksUrl, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "dashboard",
  });

  const { data: taskDetailData, isLoading: loadingTaskDetail } = useQuery<TaskDetailResponse>({
    queryKey: [`/api/ai-autonomy/tasks/${selectedTaskId}`],
    queryFn: async () => {
      const res = await fetch(`/api/ai-autonomy/tasks/${selectedTaskId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedTaskId,
    refetchInterval: (query) => {
      const data = query.state.data as TaskDetailResponse | undefined;
      return data?.task?.status === 'in_progress' ? 2000 : false;
    },
  });

  const executeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/ai-autonomy/tasks/${taskId}/execute`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to execute");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Esecuzione avviata", description: "Alessia sta lavorando sul task..." });
      queryClient.invalidateQueries({ queryKey: [`/api/ai-autonomy/tasks/${selectedTaskId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks"] });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile avviare l'esecuzione", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
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

  const unreadCount = unreadData?.count || 0;
  const autonomyInfo = getAutonomyLabel(settings.autonomy_level);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col min-h-0 ${isMobile ? "w-full" : "ml-0"}`}>
        <div className="flex-1 flex min-h-0">
          <main className="flex-1 p-6 lg:px-8 overflow-auto">
            <div className="max-w-5xl space-y-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Bot className="h-8 w-8" />
                Dipendente AI - Autonomia
              </h1>
              <p className="text-muted-foreground mt-1">
                Configura il livello di autonomia e monitora le attività del tuo dipendente AI
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 max-w-3xl">
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Impostazioni
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Feed Attività
                  {unreadCount > 0 && (
                    <Badge className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="data-catalog" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Catalogo Dati
                </TabsTrigger>
              </TabsList>

              <TabsContent value="settings" className="mt-6">
                {loadingSettings ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="space-y-8"
                  >
                    <Card className="rounded-xl shadow-sm border-l-4 border-l-cyan-500 bg-gradient-to-r from-cyan-500/5 via-teal-500/5 to-transparent dark:from-cyan-950/30 dark:via-teal-950/20 dark:to-transparent">
                      <CardContent className="py-5 px-6">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className={cn(
                              "flex items-center justify-center h-14 w-14 rounded-2xl text-2xl font-bold text-white shadow-lg",
                              settings.autonomy_level === 0 ? "bg-muted-foreground" :
                              settings.autonomy_level <= 3 ? "bg-green-500" :
                              settings.autonomy_level <= 6 ? "bg-yellow-500" :
                              settings.autonomy_level <= 9 ? "bg-orange-500" : "bg-red-500"
                            )}>
                              {settings.autonomy_level}
                            </div>
                            {settings.is_active && (
                              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500" />
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Zap className="h-4 w-4 text-cyan-500" />
                              <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">Stato attuale</span>
                            </div>
                            <p className="text-sm text-foreground">
                              Il tuo Dipendente AI è in modalità{" "}
                              <span className="font-semibold">
                                {settings.default_mode === "manual" ? "Manuale" : settings.default_mode === "hybrid" ? "Ibrido" : "Automatico"}
                              </span>.{" "}
                              {settings.is_active ? (
                                <span className="text-green-600 dark:text-green-400">
                                  Sta operando con autonomia livello {settings.autonomy_level}.
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Non sta eseguendo azioni autonome.
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant="outline" className="text-xs gap-1">
                                <Activity className="h-3 w-3" />
                                {[settings.channels_enabled.voice, settings.channels_enabled.email, settings.channels_enabled.whatsapp].filter(Boolean).length} canali attivi
                              </Badge>
                              <Badge className={cn("text-xs", getAutonomyBadgeColor(settings.autonomy_level))}>
                                {autonomyInfo.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl shadow-sm border-primary/10 bg-gradient-to-br from-primary/[0.03] to-primary/[0.06] dark:from-primary/[0.05] dark:to-primary/[0.08]">
                      <CardHeader className="cursor-pointer" onClick={() => setShowArchDetails(!showArchDetails)}>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
                              <Bot className="h-6 w-6 text-white" />
                            </div>
                            <span className="text-xl font-bold">Cosa può fare il tuo Dipendente AI</span>
                          </div>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            {showArchDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CardTitle>
                        <CardDescription>
                          Architettura, modalità operative e guardrail di sicurezza
                        </CardDescription>
                      </CardHeader>

                      {showArchDetails && (
                        <CardContent>
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                          >
                            <div className="rounded-xl border-l-4 border-purple-500 bg-gradient-to-r from-purple-500/10 to-transparent p-4">
                              <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0">
                                  <Brain className="h-6 w-6 text-white" />
                                </div>
                                <div className="space-y-2 flex-1">
                                  <h4 className="font-semibold text-sm flex items-center gap-2">
                                    Come funziona
                                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs hover:scale-105 transition-transform cursor-default">Il Cervello</Badge>
                                  </h4>
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    Un <span className="font-medium text-foreground">motore decisionale</span> basato su Gemini analizza il contesto di ogni cliente
                                    (storico, dati, scadenze) e crea <span className="font-medium text-foreground">piani di esecuzione multi-step</span>.
                                    Ragiona come un consulente esperto per decidere cosa fare, quando e come.
                                  </p>
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    <Badge variant="outline" className="text-xs gap-1 hover:scale-105 transition-transform cursor-default"><Eye className="h-3 w-3" /> Analisi contesto</Badge>
                                    <Badge variant="outline" className="text-xs gap-1 hover:scale-105 transition-transform cursor-default"><ListTodo className="h-3 w-3" /> Piani multi-step</Badge>
                                    <Badge variant="outline" className="text-xs gap-1 hover:scale-105 transition-transform cursor-default"><Sparkles className="h-3 w-3" /> Reasoning AI</Badge>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            <div className="rounded-xl border-l-4 border-blue-500 bg-gradient-to-r from-blue-500/10 to-transparent p-4">
                              <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                                <Cog className="h-4 w-4 text-blue-500" />
                                Le 3 Modalità
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className={cn(
                                  "rounded-xl border bg-card p-5 space-y-3 hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-default relative",
                                  settings.default_mode === "manual" && "ring-2 ring-primary border-primary/30"
                                )}>
                                  <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-green-500/15">
                                      <User className="h-5 w-5 text-green-500" />
                                    </div>
                                    <span className="font-semibold text-sm">Manuale</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    Tu crei i task, l'AI li esegue quando programmati. Controllo totale su ogni azione.
                                  </p>
                                  <p className="text-[11px] font-medium text-green-600 dark:text-green-400">
                                    Ideale per: chi vuole controllo totale
                                  </p>
                                </div>
                                <div className={cn(
                                  "rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-3 hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-default relative",
                                  settings.default_mode === "hybrid" && "ring-2 ring-primary border-primary/30"
                                )}>
                                  <Badge className="absolute -top-3 right-3 bg-blue-500 text-white text-xs px-2.5 py-0.5 shadow-sm">⭐ Consigliata</Badge>
                                  <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-blue-500/15">
                                      <Lightbulb className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <span className="font-semibold text-sm">Ibrida</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    L'AI propone nuove azioni ma chiede approvazione per quelle importanti.
                                  </p>
                                  <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                    Ideale per: consulenti e team piccoli
                                  </p>
                                </div>
                                <div className={cn(
                                  "rounded-xl border bg-card p-5 space-y-3 hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-default relative",
                                  settings.default_mode === "automatic" && "ring-2 ring-primary border-primary/30"
                                )}>
                                  <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-orange-500/15">
                                      <Zap className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <span className="font-semibold text-sm">Automatica</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    L'AI opera in piena autonomia entro i limiti configurati.
                                  </p>
                                  <p className="text-[11px] font-medium text-orange-600 dark:text-orange-400">
                                    Ideale per: aziende strutturate
                                  </p>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            <div className="rounded-xl border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-500/10 to-transparent p-4">
                              <h4 className="font-semibold text-sm mb-5 flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 text-emerald-500" />
                                Il Ciclo di Lavoro
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {[
                                  { step: 1, icon: Timer, title: "CRON Scheduler", desc: "Verifica task ogni minuto", color: "text-cyan-500", bg: "bg-cyan-500" },
                                  { step: 2, icon: Brain, title: "Decision Engine", desc: "Analizza contesto e priorità", color: "text-purple-500", bg: "bg-purple-500" },
                                  { step: 3, icon: ListTodo, title: "Piano Esecuzione", desc: "Crea piano multi-step", color: "text-blue-500", bg: "bg-blue-500" },
                                  { step: 4, icon: Play, title: "Task Executor", desc: "Esegue azioni su tutti i canali", color: "text-emerald-500", bg: "bg-emerald-500" },
                                ].map((item, idx) => (
                                  <div key={item.step} className="flex items-start gap-3 relative">
                                    <div className="flex flex-col items-center gap-1 shrink-0">
                                      <div className={cn("flex items-center justify-center h-9 w-9 rounded-full text-sm font-bold text-white shadow-md", item.bg)}>
                                        {item.step}
                                      </div>
                                      {idx < 3 && <div className={cn("hidden lg:block h-[3px] w-6 absolute top-4 -right-1.5 rounded-full", item.bg, "opacity-40")} />}
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <item.icon className={cn("h-4 w-4", item.color)} />
                                        <span className="text-xs font-semibold truncate">{item.title}</span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-4 flex flex-wrap gap-1.5">
                                {[
                                  { icon: Phone, label: "Chiamate", color: "text-green-500" },
                                  { icon: Mail, label: "Email", color: "text-blue-500" },
                                  { icon: MessageSquare, label: "WhatsApp", color: "text-emerald-500" },
                                  { icon: BarChart3, label: "Analisi", color: "text-purple-500" },
                                  { icon: Target, label: "Ricerca", color: "text-cyan-500" },
                                ].map((ch) => (
                                  <Badge key={ch.label} variant="outline" className="text-[10px] gap-1 py-0.5 hover:scale-105 transition-transform cursor-default">
                                    <ch.icon className={cn("h-3 w-3", ch.color)} />
                                    {ch.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <Separator />

                            <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4">
                              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                <Shield className="h-5 w-5 text-amber-500" />
                                Guardrail di Sicurezza
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                                {[
                                  { icon: Clock, text: "Opera solo nell'orario di lavoro configurato", col: 1 },
                                  { icon: Shield, text: "Limiti giornalieri per ogni canale", col: 1 },
                                  { icon: Zap, text: "Solo canali e categorie abilitate", col: 1 },
                                  { icon: AlertCircle, text: "Livello autonomia richiesto per ogni azione", col: 2 },
                                  { icon: Activity, text: "Ogni azione registrata nel feed attività", col: 2 },
                                  { icon: CheckCircle, text: "Nessuna azione duplicata o ridondante", col: 2 },
                                ].map((rule, i) => (
                                  <div key={i} className={cn(
                                    "flex items-center gap-2.5 text-[13px] text-muted-foreground py-1.5",
                                    i < 3 && "sm:border-r sm:border-amber-200 dark:sm:border-amber-800/30 sm:pr-6"
                                  )}>
                                    <rule.icon className="h-5 w-5 text-amber-500 shrink-0" />
                                    <span>{rule.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        </CardContent>
                      )}
                    </Card>

                    <Card className="rounded-xl shadow-sm overflow-hidden">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          Stato e Livello di Autonomia
                        </CardTitle>
                        <CardDescription>
                          Definisci quanto il tuo dipendente AI può operare in modo indipendente
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-base font-medium">Abilita Dipendente AI</Label>
                            <p className="text-sm text-muted-foreground">
                              Attiva o disattiva il dipendente AI
                            </p>
                          </div>
                          <Switch
                            checked={settings.is_active}
                            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_active: checked }))}
                          />
                        </div>

                        <Separator />

                        <div className="space-y-5">
                          <div className="flex flex-col items-center justify-center py-4">
                            <div className="relative">
                              <div className={cn(
                                "absolute inset-0 rounded-full blur-xl opacity-30 animate-pulse",
                                settings.autonomy_level === 0 ? "bg-muted-foreground" :
                                settings.autonomy_level <= 3 ? "bg-green-500" :
                                settings.autonomy_level <= 6 ? "bg-yellow-500" :
                                settings.autonomy_level <= 9 ? "bg-orange-500" : "bg-red-500"
                              )} />
                              <div className={cn(
                                "relative flex items-center justify-center h-28 w-28 rounded-full border-4 text-5xl font-bold",
                                settings.autonomy_level === 0 ? "border-muted-foreground/30 text-muted-foreground" :
                                settings.autonomy_level <= 3 ? "border-green-500/40 text-green-500" :
                                settings.autonomy_level <= 6 ? "border-yellow-500/40 text-yellow-500" :
                                settings.autonomy_level <= 9 ? "border-orange-500/40 text-orange-500" : "border-red-500/40 text-red-500"
                              )}>
                                {settings.autonomy_level}
                              </div>
                            </div>
                            <p className={cn("text-lg font-semibold mt-3", autonomyInfo.color)}>
                              {autonomyInfo.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">su 10</p>
                          </div>

                          <div className="rounded-xl bg-muted/40 dark:bg-muted/20 border p-5 space-y-4">
                            <div className="flex items-center justify-between mb-1">
                              <Label className="text-base font-medium">Livello di Autonomia</Label>
                              <Badge className={getAutonomyBadgeColor(settings.autonomy_level)}>
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
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">0 Off</Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-green-500 border-green-500/30">1-3</Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-yellow-500 border-yellow-500/30">4-6</Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-orange-500 border-orange-500/30">7-9</Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-red-500 border-red-500/30">10</Badge>
                            </div>
                          </div>

                          <div className={cn(
                            "p-4 rounded-xl border-2",
                            autonomyInfo.color === "text-muted-foreground" ? "bg-muted/50 border-muted" :
                            settings.autonomy_level <= 3 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/40" :
                            settings.autonomy_level <= 6 ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/40" :
                            settings.autonomy_level <= 9 ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40" :
                            "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40"
                          )}>
                            <p className={cn("text-sm font-medium flex items-start gap-2", autonomyInfo.color)}>
                              <Info className="h-4 w-4 mt-0.5 shrink-0" />
                              {autonomyInfo.description}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-base font-medium">Modalità Predefinita</Label>
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
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Orari di Lavoro
                        </CardTitle>
                        <CardDescription>
                          Imposta quando il dipendente AI può operare
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
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
                          <Label className="text-base font-medium">Giorni Lavorativi</Label>
                          <div className="flex flex-wrap gap-3">
                            {DAYS_OF_WEEK.map((day) => (
                              <div key={day.value} className="flex items-center gap-2">
                                <Checkbox
                                  id={`day-${day.value}`}
                                  checked={settings.working_days.includes(day.value)}
                                  onCheckedChange={() => toggleWorkingDay(day.value)}
                                />
                                <Label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                                  {day.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          Limiti Giornalieri
                        </CardTitle>
                        <CardDescription>
                          Imposta i limiti massimi di azioni giornaliere
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
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
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          Canali Abilitati
                        </CardTitle>
                        <CardDescription>
                          Scegli su quali canali il dipendente AI può operare
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-500" />
                            <Label>Voice (Chiamate)</Label>
                          </div>
                          <Switch
                            checked={settings.channels_enabled.voice}
                            onCheckedChange={(checked) => setSettings(prev => ({
                              ...prev,
                              channels_enabled: { ...prev.channels_enabled, voice: checked },
                            }))}
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-500" />
                            <Label>Email</Label>
                          </div>
                          <Switch
                            checked={settings.channels_enabled.email}
                            onCheckedChange={(checked) => setSettings(prev => ({
                              ...prev,
                              channels_enabled: { ...prev.channels_enabled, email: checked },
                            }))}
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-emerald-500" />
                            <Label>WhatsApp</Label>
                          </div>
                          <Switch
                            checked={settings.channels_enabled.whatsapp}
                            onCheckedChange={(checked) => setSettings(prev => ({
                              ...prev,
                              channels_enabled: { ...prev.channels_enabled, whatsapp: checked },
                            }))}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ListTodo className="h-5 w-5" />
                          Categorie Task Abilitate
                        </CardTitle>
                        <CardDescription>
                          Scegli quali categorie di task il dipendente AI può gestire
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {TASK_CATEGORIES.map((cat) => (
                            <div key={cat.value} className="flex items-start gap-3 p-3 rounded-xl border bg-muted/30">
                              <Checkbox
                                id={`cat-${cat.value}`}
                                checked={settings.allowed_task_categories.includes(cat.value)}
                                onCheckedChange={() => toggleCategory(cat.value)}
                              />
                              <div className="space-y-0.5">
                                <Label htmlFor={`cat-${cat.value}`} className="text-sm font-medium cursor-pointer">
                                  {cat.label}
                                </Label>
                                <p className="text-xs text-muted-foreground">{cat.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5" />
                          Istruzioni Personalizzate
                        </CardTitle>
                        <CardDescription>
                          Fornisci istruzioni specifiche per guidare il comportamento dell'AI
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={settings.custom_instructions}
                          onChange={(e) => setSettings(prev => ({ ...prev, custom_instructions: e.target.value }))}
                          placeholder="Es: Non chiamare mai i clienti prima delle 10. Prioritizza i lead caldi."
                          rows={4}
                        />
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button onClick={handleSave} disabled={saveMutation.isPending} size="lg">
                        {saveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salva Impostazioni
                      </Button>
                    </div>
                  </motion.div>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-4 mt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Select value={severityFilter} onValueChange={(val) => { setSeverityFilter(val); setActivityPage(1); }}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Filtra per tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Successo</SelectItem>
                        <SelectItem value="warning">Avviso</SelectItem>
                        <SelectItem value="error">Errore</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending || unreadCount === 0}
                  >
                    {markAllReadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Segna tutto come letto
                  </Button>
                </div>

                {loadingActivity ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !activityData?.activities?.length ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nessuna attività trovata</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {activityData.activities.map((item) => (
                      <Card key={item.id} className={`transition-colors ${!item.is_read ? "border-primary/30 bg-primary/5" : ""}`}>
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start gap-4">
                            <div className={`mt-0.5 p-2 rounded-full ${
                              item.severity === "error" ? "bg-red-500/10 text-red-500" :
                              item.severity === "warning" ? "bg-yellow-500/10 text-yellow-500" :
                              item.severity === "success" ? "bg-green-500/10 text-green-500" :
                              "bg-blue-500/10 text-blue-500"
                            }`}>
                              {getActivityIcon(item.icon)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{item.title}</span>
                                {getSeverityBadge(item.severity)}
                                {!item.is_read && (
                                  <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                                    Nuovo
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {getRelativeTime(item.created_at)}
                                </span>
                                {item.contact_name && (
                                  <span className="flex items-center gap-1">
                                    <Bot className="h-3 w-3" />
                                    {item.contact_name}
                                  </span>
                                )}
                              </div>
                            </div>

                            {!item.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                onClick={() => markReadMutation.mutate(item.id)}
                                disabled={markReadMutation.isPending}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {activityData && activityData.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                      disabled={activityPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Precedente
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Pagina {activityData.page} di {activityData.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivityPage(p => Math.min(activityData.totalPages, p + 1))}
                      disabled={activityPage >= activityData.totalPages}
                    >
                      Successiva
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="dashboard" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Dashboard Task</h2>
                    {!showCreateTask && (
                      <Button onClick={() => setShowCreateTask(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Crea Nuovo Task
                      </Button>
                    )}
                  </div>

                  {showCreateTask && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-transparent">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center justify-between text-base">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-purple-500/15">
                                <Sparkles className="h-4 w-4 text-purple-500" />
                              </div>
                              Crea Nuovo Task AI
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-8 gap-1 text-xs", showLibrary && "bg-indigo-500/10 text-indigo-500")}
                                onClick={() => setShowLibrary(prev => !prev)}
                              >
                                <BookOpen className="h-3.5 w-3.5" />
                                Libreria
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowCreateTask(false)}>
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        {showLibrary && (
                          <div className="px-6 pb-2">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-indigo-500" />
                                <span className="text-sm font-semibold">Libreria Task</span>
                                <Badge className="bg-indigo-500/20 text-indigo-500 border-indigo-500/30 text-[10px]">{TASK_LIBRARY.length} preset</Badge>
                              </div>
                            </div>
                            <ScrollArea className="h-[200px]">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pr-3">
                                {TASK_LIBRARY.map((preset) => (
                                  <button
                                    key={preset.id}
                                    onClick={() => {
                                      setNewTask(prev => ({
                                        ...prev,
                                        ai_instruction: preset.instruction,
                                        task_category: preset.category,
                                        priority: preset.priority || 3,
                                        preferred_channel: preset.preferred_channel || "",
                                        tone: preset.tone || "",
                                        urgency: preset.urgency || "normale",
                                        objective: preset.objective || "",
                                        voice_template_suggestion: preset.voice_template_suggestion || "",
                                      }));
                                      setAiSuggested(false);
                                    }}
                                    className="flex items-start gap-2.5 p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-indigo-500/40 transition-all duration-200 text-left group"
                                  >
                                    <span className="text-lg shrink-0 mt-0.5">{preset.icon}</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">{preset.title}</p>
                                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{preset.description}</p>
                                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                        {getCategoryBadge(preset.category)}
                                        {preset.preferred_channel && (
                                          <Badge variant="outline" className="text-[9px] py-0 px-1">
                                            {preset.preferred_channel === 'voice' ? '📞' : preset.preferred_channel === 'email' ? '📧' : '💬'}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </ScrollArea>
                            <Separator className="mt-3" />
                          </div>
                        )}
                        <CardContent className="space-y-5">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Istruzioni per l'AI</Label>
                            <Textarea
                              placeholder="Descrivi cosa deve fare l'AI... es: Chiama Mario Rossi per ricordargli la scadenza del portafoglio"
                              value={newTask.ai_instruction}
                              onChange={(e) => { setNewTask(prev => ({ ...prev, ai_instruction: e.target.value })); setAiSuggested(false); }}
                              rows={3}
                              className="resize-none"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={analyzeWithAI}
                              disabled={!newTask.ai_instruction.trim() || aiAnalyzing}
                              className="gap-2 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                            >
                              {aiAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                              {aiAnalyzing ? "Analisi in corso..." : "Analizza con AI"}
                            </Button>
                          </div>

                          {aiSuggested && (
                            <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 bg-purple-500/10 rounded-lg px-3 py-2 border border-purple-500/20">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Campi compilati dall'AI — puoi modificarli prima di creare il task</span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                Categoria
                                {aiSuggested && <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-[9px] px-1 py-0">AI</Badge>}
                              </Label>
                              <Select value={newTask.task_category} onValueChange={(v) => setNewTask(prev => ({ ...prev, task_category: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {TASK_CATEGORIES.map(cat => (
                                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                Priorità
                                {aiSuggested && <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-[9px] px-1 py-0">AI</Badge>}
                              </Label>
                              <Select value={String(newTask.priority)} onValueChange={(v) => setNewTask(prev => ({ ...prev, priority: parseInt(v) }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">Alta</SelectItem>
                                  <SelectItem value="2">Media-Alta</SelectItem>
                                  <SelectItem value="3">Media</SelectItem>
                                  <SelectItem value="4">Bassa</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                Canale preferito
                                {aiSuggested && <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-[9px] px-1 py-0">AI</Badge>}
                              </Label>
                              <Select value={newTask.preferred_channel || "none"} onValueChange={(v) => setNewTask(prev => ({ ...prev, preferred_channel: v === "none" ? "" : v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nessun canale specifico</SelectItem>
                                  <SelectItem value="voice">Voce (Chiamata)</SelectItem>
                                  <SelectItem value="email">Email</SelectItem>
                                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                Tono
                                {aiSuggested && <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-[9px] px-1 py-0">AI</Badge>}
                              </Label>
                              <Select value={newTask.tone || "professionale"} onValueChange={(v) => setNewTask(prev => ({ ...prev, tone: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="formale">Formale</SelectItem>
                                  <SelectItem value="informale">Informale</SelectItem>
                                  <SelectItem value="empatico">Empatico</SelectItem>
                                  <SelectItem value="professionale">Professionale</SelectItem>
                                  <SelectItem value="persuasivo">Persuasivo</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                Urgenza
                                {aiSuggested && <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-[9px] px-1 py-0">AI</Badge>}
                              </Label>
                              <Select value={newTask.urgency || "normale"} onValueChange={(v) => setNewTask(prev => ({ ...prev, urgency: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="immediata">Immediata</SelectItem>
                                  <SelectItem value="oggi">Entro oggi</SelectItem>
                                  <SelectItem value="settimana">Entro questa settimana</SelectItem>
                                  <SelectItem value="programmata">Programmata (data specifica)</SelectItem>
                                  <SelectItem value="normale">Normale</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                Obiettivo
                                {aiSuggested && <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-[9px] px-1 py-0">AI</Badge>}
                              </Label>
                              <Select value={newTask.objective || "informare"} onValueChange={(v) => setNewTask(prev => ({ ...prev, objective: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="informare">Informare</SelectItem>
                                  <SelectItem value="vendere">Vendere / Proporre</SelectItem>
                                  <SelectItem value="fidelizzare">Fidelizzare</SelectItem>
                                  <SelectItem value="raccogliere_info">Raccogliere Informazioni</SelectItem>
                                  <SelectItem value="supporto">Supporto</SelectItem>
                                  <SelectItem value="followup">Follow-up Generico</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {newTask.urgency === "programmata" && (
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Data e ora programmata</Label>
                              <Input
                                type="datetime-local"
                                value={newTask.scheduled_datetime}
                                onChange={(e) => setNewTask(prev => ({ ...prev, scheduled_datetime: e.target.value }))}
                              />
                            </div>
                          )}

                          {newTask.preferred_channel === "voice" && (
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                Template Vocale
                                {aiSuggested && newTask.voice_template_suggestion && <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-[9px] px-1 py-0">AI</Badge>}
                              </Label>
                              <Select value={newTask.voice_template_suggestion || "__none__"} onValueChange={(v) => setNewTask(prev => ({ ...prev, voice_template_suggestion: v === "__none__" ? "" : v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessun template specifico</SelectItem>
                                  <SelectItem value="sales-orbitale">Sales Call Orbitale</SelectItem>
                                  <SelectItem value="follow-up-lead">Follow-up Lead</SelectItem>
                                  <SelectItem value="recupero-crediti">Recupero Crediti</SelectItem>
                                  <SelectItem value="check-in-cliente">Check-in Cliente</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                Cliente <span className="text-muted-foreground font-normal">(opzionale)</span>
                                {aiSuggested && newTask.client_id && <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-[9px] px-1 py-0">AI</Badge>}
                              </Label>
                              <Select
                                value={newTask.client_id}
                                onValueChange={(v) => {
                                  const selectedClient = allClients?.find(c => c.id === v);
                                  if (v === "__none__") {
                                    setNewTask(prev => ({ ...prev, client_id: "", contact_name: "", contact_phone: "" }));
                                    setClientSearchFilter("");
                                  } else if (selectedClient) {
                                    setNewTask(prev => ({
                                      ...prev,
                                      client_id: v,
                                      contact_name: `${selectedClient.firstName} ${selectedClient.lastName}`,
                                      contact_phone: selectedClient.phoneNumber || "",
                                    }));
                                    setClientSearchFilter("");
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona un cliente..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <div className="px-2 py-1.5">
                                    <Input
                                      placeholder="Cerca cliente..."
                                      value={clientSearchFilter}
                                      onChange={(e) => setClientSearchFilter(e.target.value)}
                                      className="h-8 text-sm"
                                      onKeyDown={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <SelectItem value="__none__">Nessun cliente specifico</SelectItem>
                                  {(() => {
                                    const filtered = (allClients || []).filter(c => {
                                      if (!clientSearchFilter) return true;
                                      const search = clientSearchFilter.toLowerCase();
                                      return `${c.firstName} ${c.lastName}`.toLowerCase().includes(search) || c.email.toLowerCase().includes(search);
                                    });
                                    const activeClients = filtered.filter(c => c.isActive);
                                    const inactiveClients = filtered.filter(c => !c.isActive);
                                    return (
                                      <>
                                        {activeClients.length > 0 && (
                                          <>
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                              Clienti attivi <span className="font-normal text-[10px]">(include consulenti-clienti)</span>
                                            </div>
                                            {activeClients.map(c => (
                                              <SelectItem key={c.id} value={c.id}>
                                                <span className="flex items-center gap-2">
                                                  {c.firstName} {c.lastName}
                                                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px] px-1 py-0">Attivo</Badge>
                                                </span>
                                              </SelectItem>
                                            ))}
                                          </>
                                        )}
                                        {inactiveClients.length > 0 && (
                                          <>
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                              Clienti inattivi
                                            </div>
                                            {inactiveClients.map(c => (
                                              <SelectItem key={c.id} value={c.id}>
                                                <span className="flex items-center gap-2">
                                                  {c.firstName} {c.lastName}
                                                  <Badge className="bg-muted text-muted-foreground text-[10px] px-1 py-0">Inattivo</Badge>
                                                </span>
                                              </SelectItem>
                                            ))}
                                          </>
                                        )}
                                        {filtered.length === 0 && (
                                          <div className="px-2 py-3 text-sm text-muted-foreground text-center">Nessun cliente trovato</div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Telefono <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
                              <Input
                                placeholder="es: +39 333 1234567 o 1009"
                                value={newTask.contact_phone}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9+\s\-()]/g, '');
                                  setNewTask(prev => ({ ...prev, contact_phone: val }));
                                }}
                                className={cn("h-9 text-sm", newTask.contact_phone && !/^\+?[0-9\s\-()]{3,20}$/.test(newTask.contact_phone) && "border-red-500 focus-visible:ring-red-500")}
                                type="tel"
                              />
                              {newTask.contact_phone && !/^\+?[0-9\s\-()]{3,20}$/.test(newTask.contact_phone) && (
                                <p className="text-xs text-red-500">Formato non valido. Usa un numero di telefono o interno (es: +39 333 1234567, 1009)</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Contesto aggiuntivo <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
                            <Textarea
                              placeholder="Note o contesto extra per l'AI... es: Il cliente ha mostrato interesse per i fondi pensione nell'ultima call"
                              value={newTask.additional_context}
                              onChange={(e) => setNewTask(prev => ({ ...prev, additional_context: e.target.value }))}
                              rows={2}
                              className="resize-none"
                            />
                          </div>

                          <div className="flex items-center gap-3 pt-2">
                            <Button
                              onClick={() => createTaskMutation.mutate(newTask)}
                              disabled={!newTask.ai_instruction.trim() || createTaskMutation.isPending}
                              className="gap-2"
                            >
                              {createTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              Crea Task
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowCreateTask(false);
                                setNewTask({ ai_instruction: "", task_category: "analysis", priority: 3, contact_name: "", contact_phone: "", client_id: "", preferred_channel: "", tone: "", urgency: "normale", scheduled_datetime: "", objective: "", additional_context: "", voice_template_suggestion: "", language: "it" });
                                setClientSearchFilter("");
                                setAiSuggested(false);
                              }}
                            >
                              Annulla
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>

                {activeTasks && activeTasks.length > 0 && (
                  <Card className="border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 to-transparent">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                        </span>
                        Task Attive in Tempo Reale
                        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">{activeTasks.length}</Badge>
                        <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Ultimo aggiornamento: {new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {activeTasks.map((task, index) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.08 }}
                          className="rounded-lg border bg-card p-4 space-y-3 cursor-pointer hover:border-cyan-500/40 transition-colors"
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{task.ai_instruction}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {getCategoryBadge(task.task_category)}
                                {getPriorityIndicator(task.priority)}
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                  {task.status === "in_progress" ? "In esecuzione" : "Programmato"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          {task.execution_plan && task.execution_plan.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Progresso</span>
                                <span>{task.execution_plan.filter(s => s.status === "completed").length}/{task.execution_plan.length} step</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${(task.execution_plan.filter(s => s.status === "completed").length / task.execution_plan.length) * 100}%` }}
                                />
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {task.execution_plan.map((step) => (
                                  <div key={step.step} className="flex items-center gap-1 text-xs">
                                    {step.status === "completed" ? (
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                    ) : step.status === "in_progress" ? (
                                      <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                                    ) : step.status === "failed" ? (
                                      <XCircle className="h-3 w-3 text-red-500" />
                                    ) : (
                                      <div className="h-3 w-3 rounded-full border border-muted-foreground/40" />
                                    )}
                                    <span className={step.status === "completed" ? "text-green-500" : step.status === "in_progress" ? "text-blue-500" : "text-muted-foreground"}>
                                      {step.action.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {task.result_summary && (
                            <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{task.result_summary}</p>
                          )}
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-500/10">
                          <ListTodo className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{loadingStats ? "—" : tasksStats?.total ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Totali</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-500/10">
                          <TrendingUp className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{loadingStats ? "—" : tasksStats?.active ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Attivi</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-green-500/10">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{loadingStats ? "—" : tasksStats?.completed ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Completati</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-red-500/10">
                          <XCircle className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{loadingStats ? "—" : tasksStats?.failed ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Falliti</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Select value={dashboardStatusFilter} onValueChange={(val) => { setDashboardStatusFilter(val); setDashboardPage(1); }}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Stato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="active">Attivi</SelectItem>
                      <SelectItem value="completed">Completati</SelectItem>
                      <SelectItem value="failed">Falliti</SelectItem>
                      <SelectItem value="paused">In pausa</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dashboardCategoryFilter} onValueChange={(val) => { setDashboardCategoryFilter(val); setDashboardPage(1); }}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="outreach">Contatto</SelectItem>
                      <SelectItem value="reminder">Promemoria</SelectItem>
                      <SelectItem value="followup">Follow-up</SelectItem>
                      <SelectItem value="analysis">Analisi</SelectItem>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="research">Ricerca</SelectItem>
                      <SelectItem value="preparation">Preparazione</SelectItem>
                      <SelectItem value="monitoring">Monitoraggio</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dashboardOriginFilter} onValueChange={(val) => { setDashboardOriginFilter(val); setDashboardPage(1); }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Origine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="manual">Manuali</SelectItem>
                      <SelectItem value="autonomous">Autonomi (AI)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loadingTasks ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !tasksData?.tasks?.length ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nessun task trovato</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {tasksData.tasks.map((task) => (
                      <Card
                        key={task.id}
                        className="cursor-pointer hover:border-primary/40 transition-colors"
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start gap-4">
                            <div className="mt-0.5 p-2 rounded-full bg-primary/10">
                              <Target className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold truncate max-w-[400px]">
                                  {task.ai_instruction.length > 80
                                    ? task.ai_instruction.substring(0, 80) + "…"
                                    : task.ai_instruction}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {getTaskStatusBadge(task.status)}
                                {getCategoryBadge(task.task_category)}
                                {getPriorityIndicator(task.priority)}
                                {task.origin_type === 'autonomous' && (
                                  <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-xs">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    AI Autonomo
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {getRelativeTime(task.created_at)}
                                </span>
                                {task.contact_name && (
                                  <span className="flex items-center gap-1">
                                    <Bot className="h-3 w-3" />
                                    {task.contact_name}
                                  </span>
                                )}
                                {task.completed_at && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Completato: {new Date(task.completed_at).toLocaleString("it-IT")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {tasksData && tasksData.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDashboardPage(p => Math.max(1, p - 1))}
                      disabled={dashboardPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Precedente
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Pagina {tasksData.page} di {tasksData.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDashboardPage(p => Math.min(tasksData.totalPages, p + 1))}
                      disabled={dashboardPage >= tasksData.totalPages}
                    >
                      Successiva
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}

                <Dialog open={!!selectedTaskId} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                    {loadingTaskDetail ? (
                      <div className="flex items-center justify-center py-20">
                        <DialogHeader className="sr-only"><DialogTitle>Caricamento task</DialogTitle><DialogDescription>Caricamento dettagli task in corso</DialogDescription></DialogHeader>
                        <div className="text-center space-y-3">
                          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                          <p className="text-sm text-muted-foreground">Caricamento...</p>
                        </div>
                      </div>
                    ) : taskDetailData?.task ? (() => {
                      const task = taskDetailData.task;
                      const formatTime = (d: string) => new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      const sortedActivity = taskDetailData.activity
                        ? [...taskDetailData.activity].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                        : [];
                      const hasResults = task.result_data && task.result_data.results;
                      const isFinished = task.status === 'completed' || task.status === 'failed';

                      const executionDuration = (() => {
                        if (task.status === 'in_progress') return "In corso...";
                        if (task.completed_at && task.created_at) {
                          const start = new Date(task.created_at).getTime();
                          const end = new Date(task.completed_at).getTime();
                          const diffMs = end - start;
                          const diffSec = Math.floor(diffMs / 1000);
                          if (diffSec < 60) return `${diffSec}s`;
                          const diffMin = Math.floor(diffSec / 60);
                          const remainSec = diffSec % 60;
                          if (diffMin < 60) return `${diffMin}m ${remainSec}s`;
                          const diffHrs = Math.floor(diffMin / 60);
                          const remainMin = diffMin % 60;
                          return `${diffHrs}h ${remainMin}m`;
                        }
                        return null;
                      })();

                      const progressPercent = task.execution_plan && task.execution_plan.length > 0
                        ? Math.max(5, (task.execution_plan.filter(s => s.status === 'completed').length / task.execution_plan.length) * 100)
                        : 30;

                      return (
                        <div className="p-6 space-y-4">
                          <DialogHeader className="sr-only">
                            <DialogTitle>Deep Research</DialogTitle>
                            <DialogDescription>Dettaglio task e risultati deep research</DialogDescription>
                          </DialogHeader>

                          {/* Section 1: Hero Summary Card */}
                          <div className="rounded-xl border shadow-sm bg-card p-6 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0">
                                  <Brain className="h-5 w-5 text-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h2 className="text-lg font-semibold text-foreground">Deep Research</h2>
                                    <span className={cn(
                                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                      task.status === 'completed' ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" :
                                      task.status === 'failed' ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" :
                                      task.status === 'in_progress' ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" :
                                      task.status === 'paused' ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" :
                                      "bg-muted text-muted-foreground border-border"
                                    )}>
                                      {task.status === 'completed' ? '✅ Completato' :
                                       task.status === 'failed' ? '❌ Fallito' :
                                       task.status === 'in_progress' ? '⚡ In esecuzione' :
                                       task.status === 'paused' ? '⏸️ In pausa' :
                                       task.status === 'scheduled' ? '📅 Programmato' :
                                       task.status}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground leading-relaxed" title={task.ai_instruction}>
                                    {task.ai_instruction.length > 200 ? task.ai_instruction.slice(0, 200) + '...' : task.ai_instruction}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                              {getCategoryBadge(task.task_category)}
                              {task.contact_name && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/80 rounded-full px-2.5 py-1 border border-border">
                                  <User className="h-3 w-3" /> {task.contact_name}
                                </span>
                              )}
                              {executionDuration && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/80 rounded-full px-2.5 py-1 border border-border">
                                  <Timer className="h-3 w-3" /> {executionDuration}
                                </span>
                              )}
                              {task.ai_confidence != null && (
                                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/80 rounded-full px-2.5 py-1 border border-border">
                                  <Target className="h-3 w-3" />
                                  <span>{Math.round(task.ai_confidence * 100)}%</span>
                                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        task.ai_confidence >= 0.8 ? "bg-green-500" :
                                        task.ai_confidence >= 0.5 ? "bg-yellow-500" :
                                        "bg-red-500"
                                      )}
                                      style={{ width: `${Math.round(task.ai_confidence * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {task.status === 'in_progress' && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                                  </div>
                                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                    {task.result_summary || "Alessia sta lavorando..."}
                                  </p>
                                </div>
                                <div className="h-1 bg-blue-100 dark:bg-blue-950/50 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-pulse" style={{
                                    width: `${progressPercent}%`,
                                    transition: 'width 0.5s ease'
                                  }} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Section 2: AI Process - COLLAPSED */}
                          {(task.ai_reasoning || (task.execution_plan && task.execution_plan.length > 0) || sortedActivity.length > 0) && (
                            <div className="rounded-xl border shadow-sm bg-card p-5 space-y-3">
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Cog className="h-5 w-5 text-muted-foreground" />
                                Processo AI
                              </h3>

                              {task.ai_reasoning && (
                                <details className="group">
                                  <summary className="cursor-pointer select-none flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                                    <Sparkles className="h-4 w-4 text-purple-500" />
                                    <span className="text-[15px] font-medium text-purple-700 dark:text-purple-300">Ragionamento AI</span>
                                  </summary>
                                  <div className="mt-2 ml-6 relative rounded-xl overflow-hidden">
                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10" />
                                    <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-purple-200 dark:border-purple-800/50 rounded-xl p-4">
                                      <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed whitespace-pre-wrap">
                                        {task.ai_reasoning}
                                      </p>
                                    </div>
                                  </div>
                                </details>
                              )}

                              {task.execution_plan && task.execution_plan.length > 0 && (
                                <details className="group">
                                  <summary className="cursor-pointer select-none flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                                    <ListTodo className="h-4 w-4 text-blue-500" />
                                    <span className="text-[15px] font-medium">Piano di Esecuzione</span>
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({task.execution_plan.filter(s => s.status === 'completed').length}/{task.execution_plan.length})
                                    </span>
                                  </summary>
                                  <div className="mt-3 ml-6">
                                    <div className="flex flex-wrap items-start gap-0">
                                      {task.execution_plan.map((step, idx) => {
                                        const isActive = step.status === 'in_progress';
                                        const isCompleted = step.status === 'completed';
                                        const isFailed = step.status === 'failed';
                                        const isSkipped = step.status === 'skipped';
                                        const isLast = idx === task.execution_plan!.length - 1;

                                        return (
                                          <div key={step.step} className="flex items-start">
                                            <div className="flex flex-col items-center" style={{ minWidth: '80px' }}>
                                              <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2",
                                                isCompleted ? "bg-green-500 border-green-500 text-white shadow-sm shadow-green-500/30" :
                                                isActive ? "bg-blue-500 border-blue-500 text-white shadow-sm shadow-blue-500/30 animate-pulse" :
                                                isFailed ? "bg-red-500 border-red-500 text-white shadow-sm shadow-red-500/30" :
                                                isSkipped ? "bg-muted border-muted-foreground/30 text-muted-foreground" :
                                                "bg-background border-border text-muted-foreground"
                                              )}>
                                                {isCompleted ? <CheckCircle className="h-4 w-4" /> :
                                                 isActive ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                                 isFailed ? <XCircle className="h-4 w-4" /> :
                                                 isSkipped ? <Minus className="h-4 w-4" /> :
                                                 step.step}
                                              </div>
                                              <p className={cn(
                                                "text-[10px] mt-1.5 text-center leading-tight max-w-[80px]",
                                                isActive ? "text-blue-600 dark:text-blue-400 font-medium" :
                                                isCompleted ? "text-green-700 dark:text-green-400" :
                                                isFailed ? "text-red-600 dark:text-red-400" :
                                                "text-muted-foreground"
                                              )}>
                                                {getStepActionLabel(step.action).replace(/^[^\s]+\s/, '')}
                                              </p>
                                            </div>
                                            {!isLast && (
                                              <div className={cn(
                                                "h-[2px] mt-4 w-6 shrink-0",
                                                isCompleted ? "bg-green-500" : "bg-border"
                                              )} />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </details>
                              )}

                              {sortedActivity.length > 0 && (
                                <details className="group">
                                  <summary className="cursor-pointer select-none flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                                    <Activity className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-[15px] font-medium">Registro Attività</span>
                                    <span className="text-xs text-muted-foreground ml-1">({sortedActivity.length})</span>
                                  </summary>
                                  <div className="mt-3 ml-6 space-y-1.5">
                                    {sortedActivity.map((act) => (
                                      <div key={act.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                                        <div className={cn(
                                          "mt-0.5 p-1 rounded-full shrink-0",
                                          act.severity === "error" ? "bg-red-500/10 text-red-500" :
                                          act.severity === "warning" ? "bg-yellow-500/10 text-yellow-500" :
                                          act.severity === "success" ? "bg-green-500/10 text-green-500" :
                                          "bg-blue-500/10 text-blue-500"
                                        )}>
                                          {getActivityIcon(act.icon)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium">{act.title}</p>
                                          <p className="text-xs text-muted-foreground">{act.description}</p>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap mt-0.5">
                                          {formatTime(act.created_at)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </div>
                          )}

                          {/* Section 3: Results - THE MAIN CONTENT */}
                          <div className="rounded-xl border shadow-sm bg-card p-6">
                            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                              <Sparkles className="h-5 w-5 text-primary" />
                              Risultati Analisi
                            </h3>

                            {task.result_summary && task.status !== 'in_progress' && (
                              <div className="mb-5 rounded-xl bg-primary/5 border border-primary/10 p-4">
                                <p className="text-[15px] font-medium text-foreground mb-1">Riepilogo</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">{task.result_summary}</p>
                              </div>
                            )}

                            {hasResults ? (
                              <DeepResearchResults results={task.result_data.results} />
                            ) : (
                              <div className="text-center py-10">
                                <div className="p-3 rounded-full bg-muted/50 w-fit mx-auto mb-3">
                                  {task.status === 'in_progress' ? (
                                    <Brain className="h-8 w-8 text-blue-500 animate-pulse" />
                                  ) : task.status === 'scheduled' ? (
                                    <Clock className="h-8 w-8 text-muted-foreground" />
                                  ) : task.status === 'failed' ? (
                                    <AlertCircle className="h-8 w-8 text-red-500" />
                                  ) : (
                                    <Info className="h-8 w-8 text-muted-foreground" />
                                  )}
                                </div>
                                <p className="text-[15px] font-medium text-foreground">
                                  {task.status === 'in_progress' ? "Analisi in corso..." :
                                   task.status === 'scheduled' ? "Analisi programmata" :
                                   task.status === 'failed' ? "Analisi non completata" :
                                   "Nessun risultato disponibile"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {task.status === 'in_progress' ? "I risultati appariranno qui al termine dell'elaborazione" :
                                   task.status === 'scheduled' ? "L'analisi verrà eseguita all'orario programmato" :
                                   task.status === 'failed' ? "Puoi riprovare l'esecuzione con il pulsante in basso" :
                                   ""}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Section 4: Action Buttons */}
                          <div className="rounded-xl border shadow-sm bg-card p-4">
                            <div className="flex items-center gap-3 flex-wrap">
                              {(task.status === 'paused' || task.status === 'scheduled') && (
                                <Button
                                  onClick={() => executeTaskMutation.mutate(task.id)}
                                  disabled={executeTaskMutation.isPending}
                                  className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white border-0"
                                >
                                  {executeTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
                                  Esegui ora
                                </Button>
                              )}
                              {task.status === 'failed' && (
                                <Button
                                  onClick={() => executeTaskMutation.mutate(task.id)}
                                  disabled={executeTaskMutation.isPending}
                                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0"
                                >
                                  {executeTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                                  Riprova
                                </Button>
                              )}
                              {task.status === 'completed' && (
                                <Button
                                  onClick={() => executeTaskMutation.mutate(task.id)}
                                  disabled={executeTaskMutation.isPending}
                                  variant="outline"
                                >
                                  {executeTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                                  Rigenera Analisi
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                onClick={() => generateTaskPDF(task)}
                              >
                                <Save className="h-4 w-4 mr-1.5" />
                                Scarica PDF
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="py-12 text-center text-muted-foreground">
                        <DialogHeader className="sr-only"><DialogTitle>Task non trovato</DialogTitle><DialogDescription>Il task richiesto non esiste</DialogDescription></DialogHeader>
                        Task non trovato
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

              </TabsContent>

              <TabsContent value="data-catalog" className="space-y-6 mt-6">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-5"
                >
                  <Card className="rounded-xl shadow-sm border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-500/5 via-cyan-500/5 to-transparent">
                    <CardContent className="py-5 px-6">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md">
                          <Database className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-lg font-bold">Catalogo Dati Accessibili</h2>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Tutte le query e operazioni che il Dipendente AI esegue internamente, step per step
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline" className="text-xs gap-1">
                              <Table2 className="h-3 w-3 text-teal-500" />
                              3 tabelle
                            </Badge>
                            <Badge variant="outline" className="text-xs gap-1">
                              <Sparkles className="h-3 w-3 text-purple-500" />
                              9 operazioni
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="rounded-xl border-l-4 border-teal-500 bg-gradient-to-r from-teal-500/10 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-teal-500/15 shrink-0">
                        <Search className="h-5 w-5 text-teal-500" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          1. Recupero Dati Cliente
                          <Badge className="bg-teal-500/20 text-teal-500 border-teal-500/30 text-xs">fetch_client_data</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Cerca le informazioni del contatto nel database. Se il task ha un <span className="font-medium text-foreground">ID contatto</span>, lo usa direttamente.
                          Altrimenti cerca per <span className="font-medium text-foreground">numero di telefono</span>.
                        </p>
                        <div className="mt-3 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-400">
                            <Table2 className="h-3.5 w-3.5" />
                            Query 1 — Tabella: users
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            <p><span className="font-medium text-foreground">Campi letti:</span> id, first_name, last_name, email, phone_number, role, level, consultant_id, is_active, enrolled_at, created_at</p>
                            <p><span className="font-medium text-foreground">Filtro:</span> per ID contatto oppure per numero di telefono</p>
                            <p><span className="font-medium text-foreground">Scopo:</span> Recuperare l'anagrafica completa del contatto associato al task</p>
                          </div>
                        </div>
                        <div className="mt-2 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-400">
                            <Table2 className="h-3.5 w-3.5" />
                            Query 2 — Tabella: ai_scheduled_tasks
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            <p><span className="font-medium text-foreground">Campi letti:</span> id, task_type, task_category, status, ai_instruction, scheduled_at, result_summary, priority</p>
                            <p><span className="font-medium text-foreground">Filtro:</span> per contact_id, ordine cronologico (ultimi 10)</p>
                            <p><span className="font-medium text-foreground">Scopo:</span> Vedere i task precedenti per quel contatto ed evitare azioni duplicate</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border-l-4 border-amber-500 bg-gradient-to-r from-amber-500/10 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/15 shrink-0">
                        <BookOpen className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          2. Ricerca Documenti Privati
                          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">search_private_stores</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Cerca esclusivamente nei <span className="font-medium text-foreground">documenti privati del cliente</span> usando
                          <span className="font-medium text-foreground"> ricerca semantica AI</span> (Gemini File Search).
                        </p>
                        <div className="mt-3 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Search className="h-3.5 w-3.5" />
                            Store Privato del Cliente
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            <p><span className="font-medium text-foreground">Fonti:</span> Note consulenze, risposte esercizi, documenti caricati, storico interazioni</p>
                            <p><span className="font-medium text-foreground">Metodo:</span> Ricerca semantica nei documenti indicizzati del contatto</p>
                          </div>
                        </div>
                        <div className="mt-2 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Sparkles className="h-3.5 w-3.5" />
                            Output AI
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            <p><span className="font-medium text-foreground">Produce:</span> Riassunto documenti trovati, citazioni con fonti, conteggio documenti per categoria</p>
                            <p><span className="font-medium text-foreground">Scopo:</span> Arricchire il contesto con dati reali dal fascicolo privato del cliente</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border-l-4 border-purple-500 bg-gradient-to-r from-purple-500/10 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/15 shrink-0">
                        <Brain className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          3. Analisi Pattern
                          <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-xs">analyze_patterns</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <span className="font-medium text-foreground">Non fa query dirette al DB.</span> Prende i dati recuperati negli step precedenti (anagrafica + task recenti + documenti privati)
                          e li passa a <span className="font-medium text-foreground">Gemini AI</span> per un'analisi dettagliata.
                        </p>
                        <div className="mt-3 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
                            <Sparkles className="h-3.5 w-3.5" />
                            Output AI
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            <p><span className="font-medium text-foreground">Input:</span> Dati contatto + storico task recenti + documenti privati (se trovati)</p>
                            <p><span className="font-medium text-foreground">Produce:</span> Punteggio engagement, argomenti chiave, frequenza contatti, rischi identificati, raccomandazioni</p>
                            <p><span className="font-medium text-foreground">Scopo:</span> Capire la situazione del cliente prima di agire</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border-l-4 border-blue-500 bg-gradient-to-r from-blue-500/10 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/15 shrink-0">
                        <FileText className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          4. Generazione Report
                          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-xs">generate_report</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <span className="font-medium text-foreground">Non fa query dirette al DB.</span> Usa i dati di fetch + analisi per generare un
                          <span className="font-medium text-foreground"> documento strutturato</span> tramite Gemini AI.
                        </p>
                        <div className="mt-3 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                            <FileText className="h-3.5 w-3.5" />
                            Output AI
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            <p><span className="font-medium text-foreground">Input:</span> Dati contatto + analisi pattern + documenti privati + istruzione originale</p>
                            <p><span className="font-medium text-foreground">Produce:</span> Titolo, sommario, sezioni dettagliate, risultati chiave, raccomandazioni, prossimi passi</p>
                            <p><span className="font-medium text-foreground">Scopo:</span> Creare un report scritto e strutturato da consultare</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border-l-4 border-green-500 bg-gradient-to-r from-green-500/10 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-green-500/15 shrink-0">
                        <PhoneCall className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          5. Preparazione Chiamata
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">prepare_call</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <span className="font-medium text-foreground">Non fa query dirette al DB.</span> Usa i dati raccolti per generare uno
                          <span className="font-medium text-foreground"> script di chiamata</span> personalizzato tramite Gemini AI.
                        </p>
                        <div className="mt-3 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-green-600 dark:text-green-400">
                            <Sparkles className="h-3.5 w-3.5" />
                            Output AI
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            <p><span className="font-medium text-foreground">Input:</span> Analisi pattern + report + dati contatto</p>
                            <p><span className="font-medium text-foreground">Produce:</span> Punti chiave, frase di apertura, frase di chiusura, risposte a obiezioni, durata stimata, priorità</p>
                            <p><span className="font-medium text-foreground">Scopo:</span> Preparare l'AI per una chiamata vocale efficace</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-500/10 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/15 shrink-0">
                        <Phone className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          6. Chiamata Vocale
                          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs">voice_call</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <span className="font-medium text-foreground">Scrive nel DB</span> per programmare una chiamata vocale AI.
                          Crea un record nella tabella delle chiamate e un task figlio.
                        </p>
                        <div className="mt-3 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Table2 className="h-3.5 w-3.5" />
                            INSERT — Tabella: scheduled_voice_calls
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            <p><span className="font-medium text-foreground">Campi scritti:</span> id, consultant_id, target_phone, scheduled_at, status, ai_mode, custom_prompt, call_instruction, instruction_type, attempts, max_attempts, priority, source_task_id, attempts_log, use_default_template, created_at, updated_at</p>
                            <p><span className="font-medium text-foreground">Scopo:</span> Programmare la chiamata nel sistema vocale FreeSWITCH</p>
                          </div>
                        </div>
                        <div className="mt-2 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Table2 className="h-3.5 w-3.5" />
                            INSERT — Tabella: ai_scheduled_tasks
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            <p><span className="font-medium text-foreground">Campi scritti:</span> id, consultant_id, contact_phone, contact_name, task_type, ai_instruction, scheduled_at, timezone, status, priority, parent_task_id, contact_id, task_category, voice_call_id, max_attempts, current_attempt, retry_delay_minutes, created_at, updated_at</p>
                            <p><span className="font-medium text-foreground">Scopo:</span> Creare un task figlio collegato alla chiamata per il tracciamento</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border-l-4 border-sky-500 bg-gradient-to-r from-sky-500/10 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-sky-500/15 shrink-0">
                        <Mail className="h-5 w-5 text-sky-500" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          7. Invio Email
                          <Badge className="bg-sky-500/20 text-sky-500 border-sky-500/30 text-xs">send_email</Badge>
                          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">In arrivo</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Attualmente <span className="font-medium text-foreground">registra l'intenzione nel feed attività</span> ma non invia email reali.
                          L'integrazione completa è prevista in una fase futura.
                        </p>
                        <div className="mt-3 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
                            <Activity className="h-3.5 w-3.5" />
                            Azione attuale
                          </div>
                          <div className="text-xs text-muted-foreground pl-5">
                            <p>Registra un evento di tipo "send_email" nel feed attività con nome contatto, categoria task e dati del report</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border-l-4 border-green-600 bg-gradient-to-r from-green-600/10 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-green-600/15 shrink-0">
                        <MessageSquare className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          8. Invio WhatsApp
                          <Badge className="bg-green-600/20 text-green-600 border-green-600/30 text-xs">send_whatsapp</Badge>
                          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">In arrivo</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Attualmente <span className="font-medium text-foreground">registra l'intenzione nel feed attività</span> ma non invia messaggi reali.
                          L'integrazione completa è prevista in una fase futura.
                        </p>
                        <div className="mt-3 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-green-700 dark:text-green-400">
                            <Activity className="h-3.5 w-3.5" />
                            Azione attuale
                          </div>
                          <div className="text-xs text-muted-foreground pl-5">
                            <p>Registra un evento di tipo "send_whatsapp" nel feed attività con nome contatto, telefono e dati del report</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border-l-4 border-cyan-500 bg-gradient-to-r from-cyan-500/10 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-cyan-500/15 shrink-0">
                        <Globe className="h-5 w-5 text-cyan-500" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          9. Ricerca Web
                          <Badge className="bg-cyan-500/20 text-cyan-500 border-cyan-500/30 text-xs">web_search</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <span className="font-medium text-foreground">Non interroga il DB.</span> Usa Gemini AI con
                          <span className="font-medium text-foreground"> Google Search integrato</span> per cercare informazioni aggiornate su internet.
                        </p>
                        <div className="mt-3 rounded-lg bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                            <Globe className="h-3.5 w-3.5" />
                            Ricerca esterna
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            <p><span className="font-medium text-foreground">Input:</span> Query di ricerca (dall'istruzione del task o parametri)</p>
                            <p><span className="font-medium text-foreground">Produce:</span> Risultati di ricerca, fonti web con URL, query utilizzate, metadati di grounding</p>
                            <p><span className="font-medium text-foreground">Scopo:</span> Trovare normative, tendenze, notizie e dati di settore aggiornati</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Card className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <Info className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Riepilogo accessi al database</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Table2 className="h-3 w-3 text-teal-500" />
                              users — Lettura
                            </Badge>
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Table2 className="h-3 w-3 text-teal-500" />
                              ai_scheduled_tasks — Lettura + Scrittura
                            </Badge>
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Table2 className="h-3 w-3 text-emerald-500" />
                              scheduled_voice_calls — Scrittura
                            </Badge>
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Sparkles className="h-3 w-3 text-purple-500" />
                              Gemini AI — 5 step
                            </Badge>
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Search className="h-3 w-3 text-amber-500" />
                              File Search — Ricerca semantica
                            </Badge>
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Globe className="h-3 w-3 text-cyan-500" />
                              Google Search — 1 step
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

            </Tabs>
          </div>
        </main>
        <div className="w-[380px] border-l border-border shrink-0 hidden lg:flex flex-col min-h-0">
          <AllessiaSidePanel />
        </div>
        </div>

        {isMobile && (
          <>
            <Button
              onClick={() => setShowMobileChat(!showMobileChat)}
              size="lg"
              className={cn(
                "fixed bottom-6 right-6 z-50 h-12 px-4 rounded-xl shadow-2xl transition-all duration-300 flex items-center gap-2 lg:hidden",
                "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
              )}
            >
              <Bot className="h-5 w-5 text-white" />
              <span className="text-white font-medium">Alessia</span>
            </Button>
            {showMobileChat && (
              <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-sm">Alessia</span>
                  <Button variant="ghost" size="sm" onClick={() => setShowMobileChat(false)}>Chiudi</Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <AllessiaSidePanel />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
