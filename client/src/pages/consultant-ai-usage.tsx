import { useQuery } from "@tanstack/react-query";
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
  ArrowLeft, CalendarIcon, Menu
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
  'checkin-personalization': { label: 'Email Journey', category: 'Lavoro Quotidiano', icon: 'Sparkles' },
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
  'live-session': { label: 'Live Consultation', category: 'AI Avanzato', icon: 'Video' },
  'client-chat': { label: 'Chat AI (Cliente)', category: 'Cliente', icon: 'Sparkles' },
  'client-title-gen': { label: 'Chat AI (Cliente)', category: 'Cliente', icon: 'Sparkles' },
  'client-state': { label: 'Dashboard Cliente', category: 'Cliente', icon: 'Home' },
  'youtube-service': { label: 'Corsi YouTube', category: 'Sistema', icon: 'BookOpen' },
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
  return FEATURE_MAP[feature]?.label || feature;
}

function getFeatureCategory(feature: string): string {
  return FEATURE_MAP[feature]?.category || 'Altro';
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
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [presetLabel, setPresetLabel] = useState("Questo mese");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [granularity, setGranularity] = useState("day");
  const [activeTab, setActiveTab] = useState("panoramica");

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

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return presetLabel;
    if (presetLabel && presetLabel !== "Personalizzato") return presetLabel;
    const fromStr = format(dateRange.from, "d MMM", { locale: it });
    const toStr = dateRange.to ? format(dateRange.to, "d MMM yyyy", { locale: it }) : fromStr;
    return `${fromStr} – ${toStr}`;
  }, [dateRange, presetLabel]);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
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
                            {allFeaturesWithData.map((row, i) => {
                              const catColor = CATEGORY_COLORS[row.category] || CATEGORY_COLORS['Altro'];
                              const hasData = row.totalTokens > 0 || row.requestCount > 0;
                              const uid = `${row.category}::${row.label}`;
                              const isExpanded = expandedFeatures.has(uid);
                              const hasSubKeys = row.subKeys.length > 0;
                              return (
                                <React.Fragment key={`feat-${i}`}>
                                  <TableRow
                                    className={`${hasData ? '' : 'opacity-50'} cursor-pointer hover:bg-slate-50/80 dark:hover:bg-gray-800/50`}
                                    onClick={() => toggleFeatureExpand(uid)}
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
                                      <span
                                        className="inline-block text-[11px] px-2 py-0.5 rounded-full font-medium text-white"
                                        style={{ backgroundColor: catColor }}
                                      >
                                        {row.category}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">{hasData ? formatTokens(row.consultantTokens) : '—'}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{hasData ? formatCost(row.consultantCost) : '—'}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{hasData ? formatTokens(row.clientTokens) : '—'}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{hasData ? formatCost(row.clientCost) : '—'}</TableCell>
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
                                    <TableRow key={`${i}-sub-${j}`} className="bg-slate-50/60 dark:bg-gray-800/30">
                                      <TableCell className="pl-16">
                                        <div className="flex items-center gap-2">
                                          <Code className="h-3 w-3 text-slate-400 shrink-0" />
                                          <code className="text-xs font-mono text-slate-500 dark:text-slate-400">{sk.key}</code>
                                        </div>
                                      </TableCell>
                                      <TableCell />
                                      <TableCell className="text-right font-mono text-xs text-slate-500" colSpan={2}>{formatTokens(sk.totalTokens)}</TableCell>
                                      <TableCell className="text-right font-mono text-xs text-slate-500" colSpan={2}>{formatCost(sk.totalCost)}</TableCell>
                                      <TableCell className="text-right text-xs text-slate-500">{sk.requestCount}</TableCell>
                                      <TableCell />
                                    </TableRow>
                                  ))}
                                  {isExpanded && !hasSubKeys && !FEATURE_GUIDE[row.label] && (
                                    <TableRow className="bg-slate-50/40 dark:bg-gray-800/20">
                                      <TableCell colSpan={8} className="pl-16">
                                        <span className="text-xs text-slate-400 italic">Nessun utilizzo registrato nel periodo selezionato</span>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {isExpanded && FEATURE_GUIDE[row.label] && (
                                    <TableRow className="bg-blue-50/50 dark:bg-blue-900/10">
                                      <TableCell colSpan={8} className="pl-16">
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
                                              <Code className="h-3 w-3 text-slate-400 shrink-0" />
                                              <code className="text-xs font-mono text-slate-500 dark:text-slate-400">{sk.key}</code>
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
