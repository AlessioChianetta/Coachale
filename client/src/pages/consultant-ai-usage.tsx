import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import Sidebar from "@/components/sidebar";
import { getToken } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import React, { useState, useMemo } from "react";
import { format, startOfDay, startOfWeek, startOfMonth, subDays, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  DollarSign, Zap, Hash, TrendingUp, BarChart3, Users,
  Sparkles, Home, ListTodo, MessageSquare, Phone, Bot, Target,
  Lightbulb, PenLine, Palette, FileText, FileSearch, Video,
  BookOpen, HelpCircle, LayoutGrid, ChevronRight, ChevronDown, Code,
  ArrowLeft, CalendarIcon, Menu, RefreshCw
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  PieChart,
  Pie,
} from "recharts";

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Sparkles, Home, BarChart3, ListTodo, MessageSquare, Phone, Bot, Target,
  Lightbulb, PenLine, Palette, FileText, FileSearch, Video, BookOpen, HelpCircle, Zap, LayoutGrid,
};

const FEATURE_MAP: Record<string, { label: string; category: string; icon: string }> = {
  'consultant-chat': { label: 'AI Assistant', category: 'Principale', icon: 'Sparkles' },
  'chat-text-response': { label: 'AI Assistant', category: 'Principale', icon: 'Sparkles' },
  'consultant-title-gen': { label: 'AI Assistant', category: 'Principale', icon: 'Sparkles' },
  'discovery-rec': { label: 'Discovery REC', category: 'Comunicazione', icon: 'FileSearch' },
  'dashboard-insights': { label: 'Dashboard', category: 'Principale', icon: 'Home' },
  'data-analysis': { label: 'Analisi Dati', category: 'Lavoro Quotidiano', icon: 'BarChart3' },
  'personal-tasks': { label: 'Task', category: 'Lavoro Quotidiano', icon: 'ListTodo' },
  'consultation-tasks': { label: 'Task', category: 'Lavoro Quotidiano', icon: 'ListTodo' },
  'checkin-personalization': { label: 'Email Journey', category: 'Lavoro Quotidiano', icon: 'Sparkles' },
  'email-automated': { label: 'Email Journey', category: 'Lavoro Quotidiano', icon: 'Sparkles' },
  'email-generator': { label: 'Email Journey', category: 'Lavoro Quotidiano', icon: 'Sparkles' },
  'whatsapp-agent-response': { label: 'Dipendenti WhatsApp', category: 'Comunicazione', icon: 'MessageSquare' },
  'whatsapp-agent': { label: 'Dipendenti WhatsApp', category: 'Comunicazione', icon: 'MessageSquare' },
  'whatsapp-image-analysis': { label: 'Dipendenti WhatsApp', category: 'Comunicazione', icon: 'MessageSquare' },
  'whatsapp-document-analysis': { label: 'Dipendenti WhatsApp', category: 'Comunicazione', icon: 'MessageSquare' },
  'whatsapp-audio-transcription': { label: 'Dipendenti WhatsApp', category: 'Comunicazione', icon: 'MessageSquare' },
  'voice-call': { label: 'Chiamate Voice', category: 'Comunicazione', icon: 'Phone' },
  'tts': { label: 'Chiamate Voice', category: 'Comunicazione', icon: 'Phone' },
  'decision-engine': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'task-executor': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'ai-task-file-search': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'ai-task-scheduler': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'ai-task-alessia': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'ai-task-millie': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'ai-task-echo': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'ai-task-nova': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'ai-task-stella': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'ai-task-iris': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'ai-task-marco': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'ai-task-personalizza': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'lead-import': { label: 'HUB Lead', category: 'Comunicazione', icon: 'Target' },
  'advisage': { label: 'AdVisage AI', category: 'Content Studio', icon: 'Zap' },
  'advisage-analyze': { label: 'AdVisage AI', category: 'Content Studio', icon: 'Zap' },
  'content-ideas': { label: 'Idee Contenuti', category: 'Content Studio', icon: 'Lightbulb' },
  'topic-suggest': { label: 'Idee Contenuti', category: 'Content Studio', icon: 'Lightbulb' },
  'post-copy': { label: 'Contenuti', category: 'Content Studio', icon: 'PenLine' },
  'post-copy-variations': { label: 'Contenuti', category: 'Content Studio', icon: 'PenLine' },
  'campaign-content': { label: 'Contenuti', category: 'Content Studio', icon: 'PenLine' },
  'image-prompt': { label: 'Contenuti', category: 'Content Studio', icon: 'PenLine' },
  'shorten-copy': { label: 'Contenuti', category: 'Content Studio', icon: 'PenLine' },
  'content-compress': { label: 'Contenuti', category: 'Content Studio', icon: 'PenLine' },
  'content-suggest-levels': { label: 'Contenuti', category: 'Content Studio', icon: 'PenLine' },
  'content-suggest-niche': { label: 'Contenuti', category: 'Content Studio', icon: 'PenLine' },
  'brand-voice-generator': { label: 'Brand Assets', category: 'Content Studio', icon: 'Palette' },
  'memory-service': { label: 'Memoria & Documenti', category: 'Cervello AI', icon: 'FileText' },
  'document-processing': { label: 'File Search', category: 'Cervello AI', icon: 'FileSearch' },
  'intent-classifier': { label: 'Consulenze AI', category: 'AI Avanzato', icon: 'Sparkles' },
  'objection-detector': { label: 'Consulenze AI', category: 'AI Avanzato', icon: 'Sparkles' },
  'live-session': { label: 'Chiamate Voice', category: 'Comunicazione', icon: 'Phone' },
  'client-chat': { label: 'Chat AI (Cliente)', category: 'Cliente', icon: 'Sparkles' },
  'client-title-gen': { label: 'Chat AI (Cliente)', category: 'Cliente', icon: 'Sparkles' },
  'client-state': { label: 'Dashboard Cliente', category: 'Cliente', icon: 'Home' },
  'youtube-service': { label: 'Corsi YouTube', category: 'Sistema', icon: 'BookOpen' },
  'ai-task-executor': { label: 'AI Autonomo', category: 'Comunicazione', icon: 'Bot' },
  'chat-assistant': { label: 'AI Assistant', category: 'Principale', icon: 'Sparkles' },
  'echo': { label: 'Echo Agent', category: 'Comunicazione', icon: 'MessageSquare' },
  'followup-engine': { label: 'Follow-up AI', category: 'Comunicazione', icon: 'Target' },
  'instagram-agent': { label: 'Instagram DM', category: 'Comunicazione', icon: 'MessageSquare' },
  'lead-welcome': { label: 'Email Benvenuto', category: 'Comunicazione', icon: 'Target' },
  'onboarding': { label: 'Onboarding', category: 'Sistema', icon: 'BookOpen' },
  'prospect-simulator': { label: 'Simulatore Prospect', category: 'Comunicazione', icon: 'Target' },
  'public-chat': { label: 'Chat Pubblica', category: 'Comunicazione', icon: 'MessageSquare' },
  'whatsapp-templates': { label: 'Template WhatsApp', category: 'Comunicazione', icon: 'MessageSquare' },
  'whatsapp-instructions': { label: 'Istruzioni Agente', category: 'Comunicazione', icon: 'MessageSquare' },
  'sales-agent': { label: 'Sales Agent', category: 'Comunicazione', icon: 'Target' },
  'sales-reports': { label: 'Report Vendite', category: 'Content Studio', icon: 'BarChart3' },
  'script-builder': { label: 'Script Builder', category: 'Content Studio', icon: 'PenLine' },
  'step-advancement': { label: 'Avanzamento Step', category: 'Sistema', icon: 'ListTodo' },
  'training-analyzer': { label: 'Analisi Training', category: 'Sistema', icon: 'BookOpen' },
  'university-generator': { label: 'Università AI', category: 'Content Studio', icon: 'BookOpen' },
  'video-copilot': { label: 'Video Copilot', category: 'AI Avanzato', icon: 'Video' },
  'content-autopilot': { label: 'Content Autopilot', category: 'Content Studio', icon: 'Zap' },
  'email-hub-ai': { label: 'Email Hub AI', category: 'Comunicazione', icon: 'MessageSquare' },
  'voice-booking': { label: 'Chiamate Voice', category: 'Comunicazione', icon: 'Phone' },
  'voice-task': { label: 'Chiamate Voice', category: 'Comunicazione', icon: 'Phone' },
  'booking-detector': { label: 'Chiamate Voice', category: 'Comunicazione', icon: 'Phone' },
  'column-discovery': { label: 'Analisi Dati', category: 'Lavoro Quotidiano', icon: 'BarChart3' },
  'document-processing-direct': { label: 'File Search', category: 'Cervello AI', icon: 'FileSearch' },
  'youtube-ai': { label: 'Corsi YouTube', category: 'Sistema', icon: 'BookOpen' },
  'whatsapp-media': { label: 'Dipendenti WhatsApp', category: 'Comunicazione', icon: 'MessageSquare' },
  'library-suggest-modules': { label: 'Libreria AI', category: 'Sistema', icon: 'BookOpen' },
  'library-auto-assign': { label: 'Libreria AI', category: 'Sistema', icon: 'BookOpen' },
  'lead-hub-assistant': { label: 'HUB Lead', category: 'Comunicazione', icon: 'Target' },
  'agent-chat-tts': { label: 'Chiamate Voice', category: 'Comunicazione', icon: 'Phone' },
  'agent-chat-audio': { label: 'Chiamate Voice', category: 'Comunicazione', icon: 'Phone' },
  'unknown': { label: 'Non classificato', category: 'Sistema', icon: 'HelpCircle' },
};

const FEATURE_GUIDE: Record<string, { dove: string; comeTesta: string }> = {
  'AI Assistant': { dove: 'Sidebar → Chat AI (pagina principale)', comeTesta: 'Apri la chat AI e fai una domanda qualsiasi al tuo assistente' },
  'Dashboard': { dove: 'Sidebar → Home', comeTesta: 'Apri la dashboard, clicca "Genera Briefing AI" per ottenere suggerimenti' },
  'Discovery REC': { dove: 'Durante chiamate di vendita', comeTesta: 'Effettua una discovery call con il sales agent AI' },
  'Analisi Dati': { dove: 'Sidebar → Analisi Dati', comeTesta: 'Carica un file Excel/CSV e fai domande sui dati' },
  'Task': { dove: 'Sidebar → Task', comeTesta: 'Crea un task e usa la generazione AI del contenuto' },
  'Email Journey': { dove: 'Sidebar → Email Journey', comeTesta: 'Configura un check-in settimanale per un cliente' },
  'Dipendenti WhatsApp': { dove: 'Sidebar → Dipendenti → WhatsApp', comeTesta: 'Invia un messaggio WhatsApp a un agente configurato' },
  'Chiamate Voice': { dove: 'Sidebar → Dipendenti → Alessia (Voice)', comeTesta: 'Avvia una chiamata AI o ricevi una chiamata in entrata' },
  'AI Autonomo': { dove: 'Sidebar → Dipendenti → Impostazioni Autonomia', comeTesta: 'Attiva un dipendente AI e aspetta che esegua task autonomi' },
  'HUB Lead': { dove: 'Sidebar → HUB Lead', comeTesta: 'Importa un lead e lascia che l\'AI analizzi i dati' },
  'AdVisage AI': { dove: 'Sidebar → Content Studio → AdVisage', comeTesta: 'Analizza una creatività pubblicitaria con l\'AI' },
  'Idee Contenuti': { dove: 'Sidebar → Content Studio → Idee', comeTesta: 'Genera idee per contenuti social con l\'AI' },
  'Contenuti': { dove: 'Sidebar → Content Studio → Crea', comeTesta: 'Genera un post copy, una variazione o una campagna' },
  'Brand Assets': { dove: 'Sidebar → Content Studio → Brand', comeTesta: 'Genera la voce del brand con l\'AI' },
  'Memoria & Documenti': { dove: 'Sidebar → Cervello AI → Memoria', comeTesta: 'La memoria si popola automaticamente dalle conversazioni AI' },
  'File Search': { dove: 'Sidebar → Cervello AI → Knowledge Base', comeTesta: 'Carica un documento nella Knowledge Base e cerca con l\'AI' },
  'Consulenze AI': { dove: 'Durante una consulenza attiva', comeTesta: 'Avvia una consulenza e l\'AI classifica automaticamente gli intenti' },
  'Live Consultation': { dove: 'Sidebar → Consulenze → Sessione Live', comeTesta: 'Avvia una sessione di consulenza live con un cliente' },
  'Chat AI (Cliente)': { dove: 'Il cliente accede dalla sua dashboard', comeTesta: 'Accedi come cliente e usa la chat AI dalla dashboard' },
  'Dashboard Cliente': { dove: 'Dashboard del cliente', comeTesta: 'Il cliente vede la sua dashboard con stato e suggerimenti AI' },
  'Corsi YouTube': { dove: 'Sidebar → Corsi YouTube', comeTesta: 'Importa un video YouTube e genera un corso con l\'AI' },
  'Echo Agent': { dove: 'Sidebar → Echo', comeTesta: 'Invia un messaggio ad Echo' },
  'Follow-up AI': { dove: 'Sistema automatico', comeTesta: 'Attendi un follow-up automatico' },
  'Instagram DM': { dove: 'Sidebar → Instagram', comeTesta: 'Rispondi a un DM Instagram' },
  'Sales Agent': { dove: 'Sidebar → Sales Agent', comeTesta: 'Configura e testa l\'agente vendita' },
  'Chat Pubblica': { dove: 'Link pubblico condiviso', comeTesta: 'Apri il link pubblico e chatta' },
  'Email Benvenuto': { dove: 'Automatico per nuovi lead', comeTesta: 'Aggiungi un nuovo lead' },
  'Content Autopilot': { dove: 'Content Studio → Autopilot', comeTesta: 'Attiva il Content Autopilot' },
  'Email Hub AI': { dove: 'Sidebar → Email Hub', comeTesta: 'Genera una risposta AI in Email Hub' },
  'Università AI': { dove: 'Sidebar → Università', comeTesta: 'Genera un corso o lezione AI' },
  'Report Vendite': { dove: 'Dashboard → Report', comeTesta: 'Visualizza un report vendite' },
  'Script Builder': { dove: 'Sidebar → Script Builder', comeTesta: 'Genera uno script di vendita' },
  'Non classificato': { dove: 'Sistema interno', comeTesta: 'Chiamate di sistema non associate a una funzionalità specifica' },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Principale': '#10b981',
  'Lavoro Quotidiano': '#f59e0b',
  'Comunicazione': '#6366f1',
  'Content Studio': '#8b5cf6',
  'Cervello AI': '#14b8a6',
  'AI Avanzato': '#ec4899',
  'Cliente': '#06b6d4',
  'Sistema': '#94a3b8',
  'Altro': '#cbd5e1',
};

const CATEGORY_ORDER = [
  'Principale',
  'Lavoro Quotidiano',
  'Comunicazione',
  'Content Studio',
  'Cervello AI',
  'AI Avanzato',
  'Cliente',
  'Sistema',
];

interface SidebarFeature {
  label: string;
  category: string;
  icon: string;
  featureKeys: string[];
}

const ALL_SIDEBAR_FEATURES: SidebarFeature[] = (() => {
  const map = new Map<string, SidebarFeature>();
  Object.entries(FEATURE_MAP).forEach(([key, val]) => {
    const uid = `${val.category}::${val.label}`;
    if (map.has(uid)) {
      map.get(uid)!.featureKeys.push(key);
    } else {
      map.set(uid, { label: val.label, category: val.category, icon: val.icon, featureKeys: [key] });
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.label.localeCompare(b.label);
  });
})();

function getFeatureLabel(feature: string): string {
  if (feature.startsWith('public-chat:')) return 'Chat Pubblica';
  if (feature.startsWith('whatsapp-agent:')) return 'Dipendenti WhatsApp';
  if (feature.startsWith('voice-call:')) return 'Chiamate Voice';
  if (feature.startsWith('tts:')) return 'Chiamate Voice';
  if (feature.startsWith('agent-chat:')) return 'Chat Dipendenti';
  if (feature.startsWith('agent-chat-summary:')) return 'Chat Dipendenti';
  return FEATURE_MAP[feature]?.label || feature;
}

function getFeatureCategory(feature: string): string {
  if (feature.startsWith('public-chat:')) return 'Comunicazione';
  if (feature.startsWith('whatsapp-agent:')) return 'Comunicazione';
  if (feature.startsWith('voice-call:')) return 'Comunicazione';
  if (feature.startsWith('tts:')) return 'Comunicazione';
  if (feature.startsWith('agent-chat:')) return 'Comunicazione';
  if (feature.startsWith('agent-chat-summary:')) return 'Comunicazione';
  return FEATURE_MAP[feature]?.category || 'Altro';
}

const SUBKEY_LABELS: Record<string, string> = {
  'ai-task-alessia': '👩‍💼 Alessia',
  'ai-task-millie': '👩‍💻 Millie',
  'ai-task-echo': '🔊 Echo',
  'ai-task-nova': '⭐ Nova',
  'ai-task-stella': '✨ Stella',
  'ai-task-iris': '🌈 Iris',
  'ai-task-marco': '👨‍💼 Marco',
  'ai-task-personalizza': '🎨 Personalizza',
  'ai-task-scheduler': '🗓️ Pianificatore',
  'ai-task-executor': '⚙️ Esecutore',
  'ai-task-file-search': '🔍 File Search',
  'decision-engine': '🧠 Decision Engine',
  'task-executor': '⚙️ Esecutore (legacy)',
  'live-session': '📞 Sessione Live',
};

function getSubKeyLabel(key: string): string {
  if (SUBKEY_LABELS[key]) return SUBKEY_LABELS[key];
  if (key.startsWith('public-chat:')) {
    const agentName = key.replace('public-chat:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `🌐 ${agentName}`;
  }
  if (key.startsWith('whatsapp-agent:')) {
    const agentName = key.replace('whatsapp-agent:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `📱 ${agentName}`;
  }
  if (key.startsWith('instagram-agent:')) {
    const agentName = key.replace('instagram-agent:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `📸 ${agentName}`;
  }
  if (key.startsWith('voice-call:')) {
    const agentName = key.replace('voice-call:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `📞 ${agentName}`;
  }
  if (key.startsWith('tts:')) {
    const agentName = key.replace('tts:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `🔊 ${agentName}`;
  }
  if (key.startsWith('agent-chat:')) {
    const agentName = key.replace('agent-chat:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `💬 ${agentName}`;
  }
  if (key.startsWith('agent-chat-summary:')) {
    const agentName = key.replace('agent-chat-summary:', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `📋 ${agentName} (Riassunto)`;
  }
  return key;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function formatCost(n: number): string {
  return "$" + n.toFixed(4);
}

async function fetchWithAuth(url: string) {
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Errore nel caricamento");
  return res.json();
}

function FeatureIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] || HelpCircle;
  return <Icon className={className} style={style} />;
}

export default function ConsultantAIUsagePage() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [presetLabel, setPresetLabel] = useState("Questo mese");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [granularity, setGranularity] = useState("day");
  const [activeTab, setActiveTab] = useState("panoramica");
  const [editingPricing, setEditingPricing] = useState<Record<string, { input: number; output: number; cachedInput: number }>>({});
  const [recalculating, setRecalculating] = useState(false);
  const [applyRetroactively, setApplyRetroactively] = useState(true);
  const [pricingSaved, setPricingSaved] = useState(false);

  const dateQueryParams = useMemo(() => {
    if (!dateRange?.from) return "period=month";
    const from = format(dateRange.from, "yyyy-MM-dd");
    const to = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : from;
    return `period=custom&from=${from}&to=${to}`;
  }, [dateRange]);

  const applyPreset = (label: string, from: Date, to: Date) => {
    setDateRange({ from, to });
    setPresetLabel(label);
    setCalendarOpen(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/ai-usage');
      },
    });
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handlePricingUpdate = (model: string, field: 'input' | 'output' | 'cachedInput', value: string) => {
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 0) return;
    setEditingPricing(prev => ({
      ...prev,
      [model]: {
        ...((pricingData?.pricing || {})[model] || { input: 0, output: 0, cachedInput: 0 }),
        ...prev[model],
        [field]: numVal,
      },
    }));
    setPricingSaved(false);
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const token = getToken();
      const pricingToSend = Object.keys(editingPricing).length > 0 ? currentPricing : undefined;
      const res = await fetch('/api/ai-usage/pricing/recalculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ 
          applyRetroactively,
          customPricing: pricingToSend,
        }),
      });
      if (!res.ok) throw new Error('Errore nel ricalcolo');
      const result = await res.json();
      setPricingSaved(true);
      setEditingPricing({});
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/ai-usage');
        },
      });
      setTimeout(() => setPricingSaved(false), 3000);
    } catch (e) {
      console.error('Recalculate error:', e);
    } finally {
      setRecalculating(false);
    }
  };

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return presetLabel;
    if (presetLabel && presetLabel !== "Personalizzato") return presetLabel;
    const fromStr = format(dateRange.from, "d MMM", { locale: it });
    const toStr = dateRange.to ? format(dateRange.to, "d MMM yyyy", { locale: it }) : fromStr;
    return `${fromStr} – ${toStr}`;
  }, [dateRange, presetLabel]);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [expandedUserFeatures, setExpandedUserFeatures] = useState<Set<string>>(new Set());

  const selectUser = (userId: string, userName: string, userRole: string) => {
    setSelectedUser({ id: userId, name: userName, role: userRole });
    setExpandedUserFeatures(new Set());
  };

  const toggleUserFeatureExpand = (uid: string) => {
    setExpandedUserFeatures(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleFeatureExpand = (uid: string) => {
    setExpandedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleCategoryExpand = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["/api/ai-usage/summary", dateQueryParams],
    queryFn: () => fetchWithAuth(`/api/ai-usage/summary?${dateQueryParams}`),
  });

  const { data: byClient, isLoading: loadingClient } = useQuery({
    queryKey: ["/api/ai-usage/by-client", dateQueryParams],
    queryFn: () => fetchWithAuth(`/api/ai-usage/by-client?${dateQueryParams}`),
  });

  const { data: byFeature, isLoading: loadingFeature } = useQuery({
    queryKey: ["/api/ai-usage/by-feature", dateQueryParams],
    queryFn: () => fetchWithAuth(`/api/ai-usage/by-feature?${dateQueryParams}`),
  });

  const { data: timeline, isLoading: loadingTimeline } = useQuery({
    queryKey: ["/api/ai-usage/timeline", dateQueryParams, granularity],
    queryFn: () => fetchWithAuth(`/api/ai-usage/timeline?${dateQueryParams}&granularity=${granularity}`),
  });

  const { data: selectedUserFeatures, isLoading: loadingUserFeatures } = useQuery({
    queryKey: ["/api/ai-usage/by-client", selectedUser?.id, "features", dateQueryParams],
    queryFn: () => fetchWithAuth(`/api/ai-usage/by-client/${selectedUser!.id}/features?${dateQueryParams}`),
    enabled: !!selectedUser,
  });

  const { data: pricingData, isLoading: loadingPricing, refetch: refetchPricing } = useQuery({
    queryKey: ["/api/ai-usage/pricing"],
    queryFn: () => fetchWithAuth(`/api/ai-usage/pricing`),
    enabled: activeTab === 'prezzi',
  });

  const currentPricing = useMemo(() => {
    const serverPricing = pricingData?.pricing || {};
    return { ...serverPricing, ...editingPricing };
  }, [pricingData, editingPricing]);

  const stats = summary?.data || summary || {};
  const timelineData = timeline?.data || timeline || [];
  const clientData = byClient?.data || byClient || [];
  const featureData = byFeature?.data || byFeature || [];
  const selectedUserFeatureData = selectedUserFeatures?.data || selectedUserFeatures || [];

  const selectedUserFeaturesWithData = useMemo(() => {
    if (!selectedUser) return [];
    const featureMap = new Map<string, { totalTokens: number; totalCost: number; requestCount: number }>();
    const keyBreakdown = new Map<string, { key: string; totalTokens: number; totalCost: number; requestCount: number }[]>();
    const knownUids = new Set<string>();
    const unknownFeatures: SidebarFeature[] = [];

    (selectedUserFeatureData as any[]).forEach((f: any) => {
      const label = getFeatureLabel(f.feature);
      const cat = getFeatureCategory(f.feature);
      const uid = `${cat}::${label}`;
      const existing = featureMap.get(uid) || { totalTokens: 0, totalCost: 0, requestCount: 0 };
      existing.totalTokens += f.totalTokens || 0;
      existing.totalCost += f.totalCost || 0;
      existing.requestCount += f.requestCount || 0;
      featureMap.set(uid, existing);

      const breakdown = keyBreakdown.get(uid) || [];
      breakdown.push({ key: f.feature, totalTokens: f.totalTokens || 0, totalCost: f.totalCost || 0, requestCount: f.requestCount || 0 });
      keyBreakdown.set(uid, breakdown);

      if (!FEATURE_MAP[f.feature] && !knownUids.has(uid)) {
        knownUids.add(uid);
        unknownFeatures.push({ label, category: cat, icon: 'HelpCircle', featureKeys: [f.feature] });
      }
    });

    const totalTokens = Array.from(featureMap.values()).reduce((s, v) => s + v.totalTokens, 0) || 1;
    const allFeatures = [...ALL_SIDEBAR_FEATURES];
    unknownFeatures.forEach(uf => {
      if (!allFeatures.some(af => `${af.category}::${af.label}` === `${uf.category}::${uf.label}`)) allFeatures.push(uf);
    });

    return allFeatures.map(sf => {
      const uid = `${sf.category}::${sf.label}`;
      const data = featureMap.get(uid) || { totalTokens: 0, totalCost: 0, requestCount: 0 };
      const keys = keyBreakdown.get(uid) || [];
      return { ...sf, ...data, pct: totalTokens > 0 ? (data.totalTokens / totalTokens) * 100 : 0, subKeys: keys.sort((a, b) => b.totalTokens - a.totalTokens) };
    });
  }, [selectedUserFeatureData, selectedUser]);

  const selectedUserStats = useMemo(() => {
    if (!selectedUserFeaturesWithData.length) return { totalTokens: 0, totalCost: 0, requestCount: 0 };
    return selectedUserFeaturesWithData.reduce((acc, f) => ({
      totalTokens: acc.totalTokens + f.totalTokens,
      totalCost: acc.totalCost + f.totalCost,
      requestCount: acc.requestCount + f.requestCount,
    }), { totalTokens: 0, totalCost: 0, requestCount: 0 });
  }, [selectedUserFeaturesWithData]);

  const selectedUserCategoryData = useMemo(() => {
    const catMap = new Map<string, { category: string; totalCost: number; totalTokens: number; requestCount: number }>();
    selectedUserFeaturesWithData.forEach(f => {
      const existing = catMap.get(f.category) || { category: f.category, totalCost: 0, totalTokens: 0, requestCount: 0 };
      existing.totalCost += f.totalCost;
      existing.totalTokens += f.totalTokens;
      existing.requestCount += f.requestCount;
      catMap.set(f.category, existing);
    });
    return CATEGORY_ORDER
      .map(cat => catMap.get(cat) || { category: cat, totalCost: 0, totalTokens: 0, requestCount: 0 })
      .filter(c => c.totalCost > 0 || c.totalTokens > 0);
  }, [selectedUserFeaturesWithData]);

  const selectedUserPieData = useMemo(() => {
    return selectedUserCategoryData.filter(c => c.totalCost > 0).map(c => ({
      name: c.category,
      value: c.totalCost,
      fill: CATEGORY_COLORS[c.category] || CATEGORY_COLORS['Altro'],
    }));
  }, [selectedUserCategoryData]);

  const allFeaturesWithData = useMemo(() => {
    const featureMap = new Map<string, { totalTokens: number; totalCost: number; requestCount: number; consultantTokens: number; consultantCost: number; consultantRequests: number; clientTokens: number; clientCost: number; clientRequests: number }>();
    const keyBreakdown = new Map<string, { key: string; totalTokens: number; totalCost: number; requestCount: number }[]>();
    const knownUids = new Set<string>();
    const unknownFeatures: SidebarFeature[] = [];

    (featureData as any[]).forEach((f: any) => {
      const label = getFeatureLabel(f.feature);
      const cat = getFeatureCategory(f.feature);
      const uid = `${cat}::${label}`;
      const existing = featureMap.get(uid) || { totalTokens: 0, totalCost: 0, requestCount: 0, consultantTokens: 0, consultantCost: 0, consultantRequests: 0, clientTokens: 0, clientCost: 0, clientRequests: 0 };
      existing.totalTokens += f.totalTokens || 0;
      existing.totalCost += f.totalCost || 0;
      existing.requestCount += f.requestCount || 0;
      existing.consultantTokens += f.consultantTokens || 0;
      existing.consultantCost += f.consultantCost || 0;
      existing.consultantRequests += f.consultantRequests || 0;
      existing.clientTokens += f.clientTokens || 0;
      existing.clientCost += f.clientCost || 0;
      existing.clientRequests += f.clientRequests || 0;
      featureMap.set(uid, existing);

      const breakdown = keyBreakdown.get(uid) || [];
      breakdown.push({
        key: f.feature,
        totalTokens: f.totalTokens || 0,
        totalCost: f.totalCost || 0,
        requestCount: f.requestCount || 0,
        inputTokens: f.inputTokens || 0,
        outputTokens: f.outputTokens || 0,
        thinkingTokens: f.thinkingTokens || 0,
        modelBreakdown: f.modelBreakdown || [],
      });
      keyBreakdown.set(uid, breakdown);

      if (!FEATURE_MAP[f.feature]) {
        if (!knownUids.has(uid)) {
          knownUids.add(uid);
          unknownFeatures.push({ label, category: cat, icon: 'HelpCircle', featureKeys: [f.feature] });
        }
      }
    });

    const totalTokens = Array.from(featureMap.values()).reduce((s, v) => s + v.totalTokens, 0) || 1;

    const allFeatures = [...ALL_SIDEBAR_FEATURES];
    unknownFeatures.forEach(uf => {
      const exists = allFeatures.some(af => `${af.category}::${af.label}` === `${uf.category}::${uf.label}`);
      if (!exists) allFeatures.push(uf);
    });

    return allFeatures.map(sf => {
      const uid = `${sf.category}::${sf.label}`;
      const data = featureMap.get(uid) || { totalTokens: 0, totalCost: 0, requestCount: 0, consultantTokens: 0, consultantCost: 0, consultantRequests: 0, clientTokens: 0, clientCost: 0, clientRequests: 0 };
      const keys = keyBreakdown.get(uid) || [];
      return {
        ...sf,
        ...data,
        pct: totalTokens > 0 ? (data.totalTokens / totalTokens) * 100 : 0,
        subKeys: keys.sort((a, b) => b.totalTokens - a.totalTokens),
      };
    });
  }, [featureData]);

  const groupedFeatures = useMemo(() => {
    const groups: { category: string; features: typeof allFeaturesWithData; totals: { consultantTokens: number; consultantCost: number; clientTokens: number; clientCost: number; requestCount: number; totalTokens: number; totalCost: number; pct: number } }[] = [];

    const byCategory = new Map<string, typeof allFeaturesWithData>();
    allFeaturesWithData.forEach(f => {
      const list = byCategory.get(f.category) || [];
      list.push(f);
      byCategory.set(f.category, list);
    });

    const grandTotal = allFeaturesWithData.reduce((s, f) => s + f.totalTokens, 0) || 1;

    CATEGORY_ORDER.forEach(cat => {
      const features = byCategory.get(cat) || [];
      const totals = features.reduce((acc, f) => ({
        consultantTokens: acc.consultantTokens + (f.consultantTokens || 0),
        consultantCost: acc.consultantCost + (f.consultantCost || 0),
        clientTokens: acc.clientTokens + (f.clientTokens || 0),
        clientCost: acc.clientCost + (f.clientCost || 0),
        requestCount: acc.requestCount + (f.requestCount || 0),
        totalTokens: acc.totalTokens + (f.totalTokens || 0),
        totalCost: acc.totalCost + (f.totalCost || 0),
        pct: 0,
      }), { consultantTokens: 0, consultantCost: 0, clientTokens: 0, clientCost: 0, requestCount: 0, totalTokens: 0, totalCost: 0, pct: 0 });
      totals.pct = (totals.totalTokens / grandTotal) * 100;

      groups.push({ category: cat, features, totals });
    });

    byCategory.forEach((features, cat) => {
      if (!CATEGORY_ORDER.includes(cat)) {
        const totals = features.reduce((acc, f) => ({
          consultantTokens: acc.consultantTokens + (f.consultantTokens || 0),
          consultantCost: acc.consultantCost + (f.consultantCost || 0),
          clientTokens: acc.clientTokens + (f.clientTokens || 0),
          clientCost: acc.clientCost + (f.clientCost || 0),
          requestCount: acc.requestCount + (f.requestCount || 0),
          totalTokens: acc.totalTokens + (f.totalTokens || 0),
          totalCost: acc.totalCost + (f.totalCost || 0),
          pct: 0,
        }), { consultantTokens: 0, consultantCost: 0, clientTokens: 0, clientCost: 0, requestCount: 0, totalTokens: 0, totalCost: 0, pct: 0 });
        totals.pct = (totals.totalTokens / grandTotal) * 100;
        groups.push({ category: cat, features, totals });
      }
    });

    return groups;
  }, [allFeaturesWithData]);

  const categoryData = useMemo(() => {
    const catMap = new Map<string, { category: string; totalCost: number; totalTokens: number; requestCount: number }>();
    allFeaturesWithData.forEach(f => {
      const existing = catMap.get(f.category) || { category: f.category, totalCost: 0, totalTokens: 0, requestCount: 0 };
      existing.totalCost += f.totalCost;
      existing.totalTokens += f.totalTokens;
      existing.requestCount += f.requestCount;
      catMap.set(f.category, existing);
    });
    return CATEGORY_ORDER
      .map(cat => catMap.get(cat) || { category: cat, totalCost: 0, totalTokens: 0, requestCount: 0 })
      .filter(c => c.totalCost > 0 || c.totalTokens > 0);
  }, [allFeaturesWithData]);

  const pieData = useMemo(() => {
    return categoryData.filter(c => c.totalCost > 0).map(c => ({
      name: c.category,
      value: c.totalCost,
      fill: CATEGORY_COLORS[c.category] || CATEGORY_COLORS['Altro'],
    }));
  }, [categoryData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      <div className="flex">
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 shadow-lg">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0djJoLTJ2LTJoMnptMCA0djJoLTJ2LTJoMnptLTQtNHYyaC0ydi0yaDJ6bTAgNHYyaC0ydi0yaDJ6bS00LTR2MmgtMnYtMmgyem0wIDR2MmgtMnYtMmgyem0tNC00djJoLTJ2LTJoMnptMCA0djJoLTJ2LTJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  {isMobile && (
                    <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-white/10">
                      <Menu className="h-5 w-5 text-white/80" />
                    </button>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-white tracking-tight">Costi AI</h1>
                      <p className="text-xs text-white/60">Monitora consumi e spese delle API AI</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="bg-white/15 hover:bg-white/25 border-0 text-white backdrop-blur-sm shadow-none h-9 w-9"
                    title="Aggiorna dati"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="secondary" className="bg-white/15 hover:bg-white/25 border-0 text-white backdrop-blur-sm gap-2 shadow-none">
                      <CalendarIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">{dateLabel}</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
                    <div className="flex">
                      <div className="border-r p-3 space-y-1 min-w-[150px]">
                        <p className="text-xs font-medium text-slate-500 mb-2 px-2">Periodo</p>
                        {[
                          { label: "Oggi", fn: () => { const t = new Date(); applyPreset("Oggi", startOfDay(t), t); } },
                          { label: "Ieri", fn: () => { const y = subDays(new Date(), 1); applyPreset("Ieri", startOfDay(y), y); } },
                          { label: "Ultimi 7 giorni", fn: () => applyPreset("Ultimi 7 giorni", subDays(new Date(), 6), new Date()) },
                          { label: "Ultimi 14 giorni", fn: () => applyPreset("Ultimi 14 giorni", subDays(new Date(), 13), new Date()) },
                          { label: "Ultimi 30 giorni", fn: () => applyPreset("Ultimi 30 giorni", subDays(new Date(), 29), new Date()) },
                          { label: "Questo mese", fn: () => applyPreset("Questo mese", startOfMonth(new Date()), new Date()) },
                          { label: "Mese scorso", fn: () => { const pm = subMonths(new Date(), 1); applyPreset("Mese scorso", startOfMonth(pm), new Date(pm.getFullYear(), pm.getMonth() + 1, 0)); } },
                          { label: "Ultimi 3 mesi", fn: () => applyPreset("Ultimi 3 mesi", subMonths(new Date(), 3), new Date()) },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            onClick={preset.fn}
                            className={`block w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                              presetLabel === preset.label
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="p-3">
                        <CalendarComponent
                          mode="range"
                          selected={dateRange}
                          onSelect={(range) => {
                            setDateRange(range);
                            setPresetLabel("Personalizzato");
                            if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) {
                              setCalendarOpen(false);
                            }
                          }}
                          numberOfMonths={2}
                          locale={it}
                          disabled={{ after: new Date() }}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {loadingSummary ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                <>
                  <StatCard icon={DollarSign} iconColor="text-amber-500" iconBg="bg-amber-50 dark:bg-amber-900/20" label="Costo Totale" value={formatCost(stats.totalCost || 0)} />
                  <StatCard icon={Zap} iconColor="text-teal-500" iconBg="bg-teal-50 dark:bg-teal-900/20" label="Token Totali" value={formatTokens(stats.totalTokens || 0)} />
                  <StatCard icon={Hash} iconColor="text-blue-500" iconBg="bg-blue-50 dark:bg-blue-900/20" label="Richieste" value={String(stats.requestCount || 0)} />
                  <StatCard icon={TrendingUp} iconColor="text-violet-500" iconBg="bg-violet-50 dark:bg-violet-900/20" label="Costo Medio" value={formatCost(stats.requestCount ? (stats.totalCost || 0) / stats.requestCount : 0)} />
                </>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-white dark:bg-gray-800 border shadow-sm">
                <TabsTrigger value="panoramica" className="gap-1.5">
                  <BarChart3 className="h-4 w-4" />
                  Panoramica
                </TabsTrigger>
                <TabsTrigger value="funzionalita" className="gap-1.5">
                  <LayoutGrid className="h-4 w-4" />
                  Funzionalità
                </TabsTrigger>
                <TabsTrigger value="utenti" className="gap-1.5">
                  <Users className="h-4 w-4" />
                  Per Utente
                </TabsTrigger>
                <TabsTrigger value="prezzi" className="gap-1.5">
                  <DollarSign className="h-4 w-4" />
                  Prezzi
                </TabsTrigger>
              </TabsList>

              <TabsContent value="panoramica" className="mt-4 space-y-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {granularity === 'day' ? 'Trend Giornaliero' : granularity === 'week' ? 'Trend Settimanale' : 'Trend Mensile'}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-gray-700 rounded-lg p-0.5">
                        {([
                          { value: 'day', label: 'Giorno' },
                          { value: 'week', label: 'Settimana' },
                          { value: 'month', label: 'Mese' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setGranularity(opt.value)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                              granularity === opt.value
                                ? 'bg-white dark:bg-gray-600 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingTimeline ? (
                      <Skeleton className="h-[280px] w-full" />
                    ) : timelineData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: string) => {
                            if (granularity === 'month') {
                              const parts = v.split('-');
                              const months = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
                              return months[parseInt(parts[1]) - 1] + ' ' + parts[0].slice(2);
                            }
                            if (granularity === 'week') {
                              const d = new Date(v);
                              return d.getDate() + '/' + (d.getMonth() + 1);
                            }
                            const d = new Date(v);
                            return d.getDate() + '/' + (d.getMonth() + 1);
                          }} />
                          <YAxis
                            yAxisId="left"
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v: number) => "$" + v.toFixed(2)}
                            width={55}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v: number) => formatTokens(v)}
                            width={55}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              if (name === "Costo") return ["$" + value.toFixed(4), "Costo"];
                              return [formatTokens(value), "Token"];
                            }}
                            labelFormatter={(label: string) => {
                              if (granularity === 'week') return `Sett. dal ${label}`;
                              if (granularity === 'month') {
                                const months = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
                                const parts = label.split('-');
                                return months[parseInt(parts[1]) - 1] + ' ' + parts[0];
                              }
                              return label;
                            }}
                            contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 13 }}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                          <Area yAxisId="left" type="monotone" dataKey="totalCost" stroke="#10b981" strokeWidth={2} fill="url(#costGrad)" name="Costo" dot={{ r: 3, fill: '#10b981' }} />
                          <Area yAxisId="right" type="monotone" dataKey="totalTokens" stroke="#6366f1" strokeWidth={2} fill="url(#tokenGrad)" name="Token" dot={{ r: 3, fill: '#6366f1' }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                        Nessun dato disponibile per il periodo selezionato
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Costo per Categoria</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingFeature ? (
                        <Skeleton className="h-[280px] w-full" />
                      ) : categoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 16, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => "$" + v.toFixed(3)} />
                            <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={110} />
                            <Tooltip
                              formatter={(value: number) => ["$" + value.toFixed(4), "Costo"]}
                              contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 13 }}
                            />
                            <Bar dataKey="totalCost" radius={[0, 6, 6, 0]} barSize={24}>
                              {categoryData.map((entry, index) => (
                                <Cell key={index} fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS['Altro']} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                          Nessun dato disponibile
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Distribuzione</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingFeature ? (
                        <Skeleton className="h-[280px] w-full" />
                      ) : pieData.length > 0 ? (
                        <div className="flex flex-col items-center">
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={85}
                                paddingAngle={2}
                                stroke="none"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={index} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) => ["$" + value.toFixed(4), "Costo"]}
                                contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 13 }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                            {pieData.map((entry, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                                {entry.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                          Nessun dato disponibile
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="funzionalita" className="mt-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Tutte le Funzionalità AI</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Tutte le funzionalità disponibili con i relativi consumi nel periodo selezionato</p>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingFeature ? (
                      <div className="p-6 space-y-3">
                        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/50 dark:bg-gray-800/50">
                              <TableHead className="w-[220px]">Funzionalità</TableHead>
                              <TableHead className="w-[120px]">Categoria</TableHead>
                              <TableHead className="text-right">Token (Tu)</TableHead>
                              <TableHead className="text-right">Costo (Tu)</TableHead>
                              <TableHead className="text-right">Token (Clienti)</TableHead>
                              <TableHead className="text-right">Costo (Clienti)</TableHead>
                              <TableHead className="text-right">Totale</TableHead>
                              <TableHead className="w-[150px]">%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedFeatures.map((group) => {
                              const catColor = CATEGORY_COLORS[group.category] || CATEGORY_COLORS['Altro'];
                              const isCatExpanded = expandedCategories.has(group.category);
                              const featuresWithData = group.features.filter(f => f.totalTokens > 0 || f.requestCount > 0);
                              const featCount = group.features.length;

                              return (
                                <React.Fragment key={`cat-${group.category}`}>
                                  <TableRow
                                    className="cursor-pointer hover:bg-slate-100/80 dark:hover:bg-gray-700/50 bg-slate-50/80 dark:bg-gray-800/60 border-t-2"
                                    style={{ borderTopColor: catColor + '40' }}
                                    onClick={() => toggleCategoryExpand(group.category)}
                                  >
                                    <TableCell>
                                      <div className="flex items-center gap-2.5">
                                        {isCatExpanded ? <ChevronDown className="h-4 w-4 shrink-0" style={{ color: catColor }} /> : <ChevronRight className="h-4 w-4 shrink-0" style={{ color: catColor }} />}
                                        <span
                                          className="inline-block text-xs px-2.5 py-1 rounded-full font-semibold text-white"
                                          style={{ backgroundColor: catColor }}
                                        >
                                          {group.category}
                                        </span>
                                        <span className="text-xs text-slate-400 ml-1">{featCount} funzionalità</span>
                                      </div>
                                    </TableCell>
                                    <TableCell />
                                    <TableCell className="text-right font-mono text-sm font-semibold">{formatTokens(group.totals.consultantTokens)}</TableCell>
                                    <TableCell className="text-right font-mono text-sm font-semibold">{formatCost(group.totals.consultantCost)}</TableCell>
                                    <TableCell className="text-right font-mono text-sm font-semibold">{formatTokens(group.totals.clientTokens)}</TableCell>
                                    <TableCell className="text-right font-mono text-sm font-semibold">{formatCost(group.totals.clientCost)}</TableCell>
                                    <TableCell className="text-right text-sm font-semibold">{group.totals.requestCount}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Progress value={group.totals.pct} className="h-1.5 flex-1" />
                                        <span className="text-xs text-slate-500 w-12 text-right font-mono">{group.totals.pct.toFixed(1)}%</span>
                                      </div>
                                    </TableCell>
                                  </TableRow>

                                  {isCatExpanded && group.features.map((row, i) => {
                                    const hasData = row.totalTokens > 0 || row.requestCount > 0;
                                    const uid = `${row.category}::${row.label}`;
                                    const isExpanded = expandedFeatures.has(uid);
                                    return (
                                      <React.Fragment key={`feat-${group.category}-${i}`}>
                                        <TableRow
                                          className={`${hasData ? '' : 'opacity-50'} cursor-pointer hover:bg-slate-50/80 dark:hover:bg-gray-800/50`}
                                          onClick={() => toggleFeatureExpand(uid)}
                                        >
                                          <TableCell className="pl-10">
                                            <div className="flex items-center gap-2.5">
                                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                                              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: catColor + '18' }}>
                                                <FeatureIcon name={row.icon} className="h-3.5 w-3.5" style={{ color: catColor }} />
                                              </div>
                                              <span className="font-medium text-sm">{row.label}</span>
                                            </div>
                                          </TableCell>
                                          <TableCell />
                                          <TableCell className="text-right font-mono text-sm">{formatTokens(row.consultantTokens)}</TableCell>
                                          <TableCell className="text-right font-mono text-sm">{formatCost(row.consultantCost)}</TableCell>
                                          <TableCell className="text-right font-mono text-sm">{formatTokens(row.clientTokens)}</TableCell>
                                          <TableCell className="text-right font-mono text-sm">{formatCost(row.clientCost)}</TableCell>
                                          <TableCell className="text-right text-sm">{row.requestCount}</TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              <Progress value={row.pct} className="h-1.5 flex-1" />
                                              <span className="text-xs text-slate-500 w-12 text-right font-mono">{row.pct.toFixed(1)}%</span>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                        {isExpanded && row.subKeys.map((sk: any, j: number) => (
                                          <React.Fragment key={`${group.category}-${i}-sub-${j}`}>
                                            <TableRow className="bg-slate-50/60 dark:bg-gray-800/30">
                                              <TableCell className="pl-20">
                                                <div className="flex items-center gap-2">
                                                  {SUBKEY_LABELS[sk.key] || sk.key.startsWith('public-chat:') || sk.key.startsWith('whatsapp-agent:') || sk.key.startsWith('instagram-agent:') || sk.key.startsWith('voice-call:') || sk.key.startsWith('tts:') || sk.key.startsWith('agent-chat:') || sk.key.startsWith('agent-chat-summary:') ? (
                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{getSubKeyLabel(sk.key)}</span>
                                                  ) : (
                                                    <>
                                                      <Code className="h-3 w-3 text-slate-400 shrink-0" />
                                                      <code className="text-xs font-mono text-slate-500 dark:text-slate-400">{sk.key}</code>
                                                    </>
                                                  )}
                                                </div>
                                              </TableCell>
                                              <TableCell />
                                              <TableCell className="text-right font-mono text-xs text-slate-500" colSpan={2}>{formatTokens(sk.totalTokens)}</TableCell>
                                              <TableCell className="text-right font-mono text-xs text-slate-500" colSpan={2}>{formatCost(sk.totalCost)}</TableCell>
                                              <TableCell className="text-right text-xs text-slate-500">{sk.requestCount}</TableCell>
                                              <TableCell />
                                            </TableRow>
                                            {sk.modelBreakdown && sk.modelBreakdown.length > 0 && sk.modelBreakdown.map((mb: any, k: number) => (
                                              <TableRow key={`${group.category}-${i}-sub-${j}-model-${k}`} className="bg-slate-50/30 dark:bg-gray-800/15">
                                                <TableCell className="pl-28">
                                                  <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                    <code className="text-[11px] font-mono text-slate-400">{mb.model}</code>
                                                  </div>
                                                </TableCell>
                                                <TableCell />
                                                <TableCell className="text-right font-mono text-[11px] text-slate-400" colSpan={2}>
                                                  <span className="flex items-center justify-end gap-1.5">
                                                    <span className="text-slate-500" title="Token fatturabili (input + output)">
                                                      {formatTokens(mb.inputTokens + mb.outputTokens)}
                                                    </span>
                                                    {mb.thinkingTokens > 0 && (
                                                      <span className="text-purple-400 text-[10px]" title="Token di ragionamento (fatturati come output)">
                                                        +{formatTokens(mb.thinkingTokens)} think
                                                      </span>
                                                    )}
                                                  </span>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-[11px] text-slate-400" colSpan={2}>{formatCost(mb.totalCost)}</TableCell>
                                                <TableCell className="text-right text-[11px] text-slate-400">{mb.requestCount}</TableCell>
                                                <TableCell />
                                              </TableRow>
                                            ))}
                                          </React.Fragment>
                                        ))}
                                        {isExpanded && FEATURE_GUIDE[row.label] && (
                                          <TableRow className="bg-blue-50/50 dark:bg-blue-900/10">
                                            <TableCell colSpan={8} className="pl-20">
                                              <div className="flex gap-6 text-xs py-1">
                                                <div><span className="font-medium text-slate-600">Dove:</span> <span className="text-slate-500">{FEATURE_GUIDE[row.label].dove}</span></div>
                                                <div><span className="font-medium text-slate-600">Come testare:</span> <span className="text-slate-500">{FEATURE_GUIDE[row.label].comeTesta}</span></div>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="utenti" className="mt-4">
                {selectedUser ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedUser(null)}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Torna alla lista
                      </button>
                      <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{selectedUser.name}</span>
                        {selectedUser.role === 'consultant' ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 text-xs">Tu</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Cliente</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <StatCard icon={Zap} iconColor="text-teal-500" iconBg="bg-teal-50 dark:bg-teal-900/20" label="Token Totali" value={formatTokens(selectedUserStats.totalTokens)} />
                      <StatCard icon={DollarSign} iconColor="text-amber-500" iconBg="bg-amber-50 dark:bg-amber-900/20" label="Costo Totale" value={formatCost(selectedUserStats.totalCost)} />
                      <StatCard icon={Hash} iconColor="text-blue-500" iconBg="bg-blue-50 dark:bg-blue-900/20" label="Richieste" value={String(selectedUserStats.requestCount)} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-semibold">Costo per Categoria</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {loadingUserFeatures ? (
                            <Skeleton className="h-[220px] w-full" />
                          ) : selectedUserCategoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={selectedUserCategoryData} layout="vertical" margin={{ left: 0, right: 16, top: 5, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => "$" + v.toFixed(3)} />
                                <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={110} />
                                <Tooltip formatter={(value: number) => ["$" + value.toFixed(4), "Costo"]} contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 13 }} />
                                <Bar dataKey="totalCost" radius={[0, 6, 6, 0]} barSize={20}>
                                  {selectedUserCategoryData.map((entry, index) => (
                                    <Cell key={index} fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS['Altro']} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">Nessun dato disponibile</div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-semibold">Distribuzione</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {loadingUserFeatures ? (
                            <Skeleton className="h-[220px] w-full" />
                          ) : selectedUserPieData.length > 0 ? (
                            <div className="flex flex-col items-center">
                              <ResponsiveContainer width="100%" height={170}>
                                <PieChart>
                                  <Pie data={selectedUserPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} stroke="none">
                                    {selectedUserPieData.map((entry, index) => (
                                      <Cell key={index} fill={entry.fill} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: number) => ["$" + value.toFixed(4), "Costo"]} contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 13 }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
                                {selectedUserPieData.map((entry, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                                    {entry.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">Nessun dato disponibile</div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Funzionalità utilizzate da {selectedUser.name}</CardTitle>
                        <p className="text-xs text-slate-500 mt-1">Dettaglio completo di tutte le funzionalità AI nel periodo selezionato</p>
                      </CardHeader>
                      <CardContent className="p-0">
                        {loadingUserFeatures ? (
                          <div className="p-6 space-y-3">
                            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-gray-800/50">
                                  <TableHead className="w-[240px]">Funzionalità</TableHead>
                                  <TableHead className="w-[130px]">Categoria</TableHead>
                                  <TableHead className="text-right">Token</TableHead>
                                  <TableHead className="text-right">Costo</TableHead>
                                  <TableHead className="text-right">Richieste</TableHead>
                                  <TableHead className="w-[160px]">% del Totale</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedUserFeaturesWithData.map((row, i) => {
                                  const catColor = CATEGORY_COLORS[row.category] || CATEGORY_COLORS['Altro'];
                                  const hasData = row.totalTokens > 0 || row.requestCount > 0;
                                  const uid = `${row.category}::${row.label}`;
                                  const isExpanded = expandedUserFeatures.has(uid);
                                  const hasSubKeys = row.subKeys.length > 0;
                                  return (
                                    <React.Fragment key={`uf-${i}`}>
                                      <TableRow
                                        className={`${hasData ? '' : 'opacity-50'} cursor-pointer hover:bg-slate-50/80 dark:hover:bg-gray-800/50`}
                                        onClick={() => toggleUserFeatureExpand(uid)}
                                      >
                                        <TableCell>
                                          <div className="flex items-center gap-2.5">
                                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: catColor + '18' }}>
                                              <FeatureIcon name={row.icon} className="h-3.5 w-3.5" style={{ color: catColor }} />
                                            </div>
                                            <span className="font-medium text-sm">{row.label}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <span className="inline-block text-[11px] px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: catColor }}>
                                            {row.category}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">{hasData ? formatTokens(row.totalTokens) : '—'}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">{hasData ? formatCost(row.totalCost) : '—'}</TableCell>
                                        <TableCell className="text-right text-sm">{hasData ? row.requestCount : '—'}</TableCell>
                                        <TableCell>
                                          {hasData ? (
                                            <div className="flex items-center gap-2">
                                              <Progress value={row.pct} className="h-1.5 flex-1" />
                                              <span className="text-xs text-slate-500 w-12 text-right font-mono">{row.pct.toFixed(1)}%</span>
                                            </div>
                                          ) : (
                                            <span className="text-xs text-slate-400">—</span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                      {isExpanded && row.subKeys.map((sk, j) => (
                                        <TableRow key={`uf-${i}-sub-${j}`} className="bg-slate-50/60 dark:bg-gray-800/30">
                                          <TableCell className="pl-16">
                                            <div className="flex items-center gap-2">
                                              {SUBKEY_LABELS[sk.key] || sk.key.startsWith('public-chat:') || sk.key.startsWith('whatsapp-agent:') || sk.key.startsWith('instagram-agent:') || sk.key.startsWith('voice-call:') || sk.key.startsWith('tts:') || sk.key.startsWith('agent-chat:') || sk.key.startsWith('agent-chat-summary:') ? (
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{getSubKeyLabel(sk.key)}</span>
                                              ) : (
                                                <>
                                                  <Code className="h-3 w-3 text-slate-400 shrink-0" />
                                                  <code className="text-xs font-mono text-slate-500 dark:text-slate-400">{sk.key}</code>
                                                </>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell />
                                          <TableCell className="text-right font-mono text-xs text-slate-500">{formatTokens(sk.totalTokens)}</TableCell>
                                          <TableCell className="text-right font-mono text-xs text-slate-500">{formatCost(sk.totalCost)}</TableCell>
                                          <TableCell className="text-right text-xs text-slate-500">{sk.requestCount}</TableCell>
                                          <TableCell />
                                        </TableRow>
                                      ))}
                                      {isExpanded && !hasSubKeys && !FEATURE_GUIDE[row.label] && (
                                        <TableRow className="bg-slate-50/40 dark:bg-gray-800/20">
                                          <TableCell colSpan={6} className="pl-16">
                                            <span className="text-xs text-slate-400 italic">Nessun utilizzo registrato nel periodo selezionato</span>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                      {isExpanded && FEATURE_GUIDE[row.label] && (
                                        <TableRow className="bg-blue-50/50 dark:bg-blue-900/10">
                                          <TableCell colSpan={6} className="pl-16">
                                            <div className="flex gap-6 text-xs py-1">
                                              <div><span className="font-medium text-slate-600">Dove:</span> <span className="text-slate-500">{FEATURE_GUIDE[row.label].dove}</span></div>
                                              <div><span className="font-medium text-slate-600">Come testare:</span> <span className="text-slate-500">{FEATURE_GUIDE[row.label].comeTesta}</span></div>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Consumo per Utente</CardTitle>
                      <p className="text-xs text-slate-500 mt-1">Clicca su un utente per vedere il dettaglio completo delle funzionalità</p>
                    </CardHeader>
                    <CardContent className="p-0">
                      {loadingClient ? (
                        <div className="p-6 space-y-3">
                          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                      ) : clientData.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50/50 dark:bg-gray-800/50">
                                <TableHead>Utente</TableHead>
                                <TableHead className="w-[90px]">Tipo</TableHead>
                                <TableHead>Funzione principale</TableHead>
                                <TableHead className="text-right">Token</TableHead>
                                <TableHead className="text-right">Costo</TableHead>
                                <TableHead className="text-right">Richieste</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {clientData.map((row: any, i: number) => {
                                const hasData = (row.totalTokens || 0) > 0;
                                const userId = row.clientRole === 'consultant' ? 'self' : row.clientId;
                                return (
                                  <TableRow
                                    key={`user-${i}`}
                                    className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-gray-800/50"
                                    onClick={() => userId && selectUser(userId, row.clientName || 'Sconosciuto', row.clientRole)}
                                  >
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        {row.clientName || "—"}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {row.clientRole === "consultant" ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 text-xs">Tu</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-xs">Cliente</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                                      {row.topFeature ? getFeatureLabel(row.topFeature) : "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">{hasData ? formatTokens(row.totalTokens) : '—'}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{hasData ? formatCost(row.totalCost) : '—'}</TableCell>
                                    <TableCell className="text-right text-sm">{hasData ? row.requestCount : '—'}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-400 text-sm">Nessun dato disponibile</div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="prezzi" className="mt-4 space-y-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-semibold">Prezzi Modelli AI</CardTitle>
                        <p className="text-xs text-slate-500 mt-1">Modifica i prezzi per milione di token per ogni modello Gemini. I costi vengono ricalcolati automaticamente.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={applyRetroactively}
                            onChange={(e) => setApplyRetroactively(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Applica retroattivamente
                        </label>
                        <Button
                          onClick={handleRecalculate}
                          disabled={recalculating}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                          size="sm"
                        >
                          {recalculating ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : pricingSaved ? (
                            <span>Salvato</span>
                          ) : (
                            <span>Ricalcola Costi</span>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingPricing ? (
                      <div className="p-6 space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/50 dark:bg-gray-800/50">
                              <TableHead className="w-[280px]">Modello</TableHead>
                              <TableHead className="text-right w-[140px]">Input ($/1M tok)</TableHead>
                              <TableHead className="text-right w-[140px]">Output ($/1M tok)</TableHead>
                              <TableHead className="text-right w-[140px]">Cache ($/1M tok)</TableHead>
                              <TableHead className="text-right w-[100px]">Richieste</TableHead>
                              <TableHead className="text-right w-[100px]">Token</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(currentPricing)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([model, prices]: [string, any]) => {
                                const usage = (pricingData?.usedModels || []).find((m: any) => m.model === model);
                                const isEdited = editingPricing[model] !== undefined;
                                return (
                                  <TableRow key={model} className={isEdited ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs font-mono text-slate-700 dark:text-slate-300">{model}</code>
                                        {isEdited && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">modificato</span>}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={prices.input}
                                        onChange={(e) => handlePricingUpdate(model, 'input', e.target.value)}
                                        className="w-24 text-right text-sm font-mono px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={prices.output}
                                        onChange={(e) => handlePricingUpdate(model, 'output', e.target.value)}
                                        className="w-24 text-right text-sm font-mono px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <input
                                        type="number"
                                        step="0.001"
                                        min="0"
                                        value={prices.cachedInput}
                                        onChange={(e) => handlePricingUpdate(model, 'cachedInput', e.target.value)}
                                        className="w-24 text-right text-sm font-mono px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs text-slate-500">
                                      {usage ? usage.requestCount : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs text-slate-500">
                                      {usage ? formatTokens(usage.totalTokens) : '—'}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {applyRetroactively && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      <p className="font-medium">Ricalcolo retroattivo attivo</p>
                      <p className="mt-0.5 text-amber-700 dark:text-amber-300">Cliccando "Ricalcola Costi", tutti i costi storici nel database verranno ricalcolati con i nuovi prezzi. Questo aggiorna anche i dati nelle altre schede.</p>
                    </div>
                  </div>
                )}

                {!applyRetroactively && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-800 dark:text-blue-200">
                      <p className="font-medium">Solo modifiche future</p>
                      <p className="mt-0.5 text-blue-700 dark:text-blue-300">I nuovi prezzi verranno applicati solo alle future richieste AI. I costi storici rimarranno invariati.</p>
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

function StatCard({ icon: Icon, iconColor, iconBg, label, value }: { icon: React.ComponentType<any>; iconColor: string; iconBg: string; label: string; value: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
