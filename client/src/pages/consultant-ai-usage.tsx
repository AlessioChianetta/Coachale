import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getToken } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useMemo } from "react";
import { DollarSign, Zap, Hash, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

const FEATURE_MAP: Record<string, { label: string; category: string; icon: string }> = {
  'consultant-chat': { label: 'AI Assistant', category: 'Principale', icon: 'Sparkles' },
  'chat-text-response': { label: 'AI Assistant', category: 'Principale', icon: 'Sparkles' },
  'consultant-title-gen': { label: 'AI Assistant', category: 'Principale', icon: 'Sparkles' },
  'discovery-rec': { label: 'Dashboard', category: 'Principale', icon: 'Home' },
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

export default function ConsultantAIUsagePage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState("month");

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["/api/ai-usage/summary", period],
    queryFn: () => fetchWithAuth(`/api/ai-usage/summary?period=${period}`),
  });

  const { data: byClient, isLoading: loadingClient } = useQuery({
    queryKey: ["/api/ai-usage/by-client", period],
    queryFn: () => fetchWithAuth(`/api/ai-usage/by-client?period=${period}`),
  });

  const { data: byFeature, isLoading: loadingFeature } = useQuery({
    queryKey: ["/api/ai-usage/by-feature", period],
    queryFn: () => fetchWithAuth(`/api/ai-usage/by-feature?period=${period}`),
  });

  const { data: timeline, isLoading: loadingTimeline } = useQuery({
    queryKey: ["/api/ai-usage/timeline", period],
    queryFn: () => fetchWithAuth(`/api/ai-usage/timeline?period=${period}`),
  });

  const stats = summary?.data || summary || {};
  const timelineData = timeline?.data || timeline || [];
  const clientData = byClient?.data || byClient || [];
  const featureData = byFeature?.data || byFeature || [];

  const totalFeatureTokens = featureData.reduce?.((sum: number, f: any) => sum + (f.totalTokens || 0), 0) || 1;

  const categoryData = useMemo(() => {
    if (!featureData?.length) return [];
    const catMap = new Map<string, { category: string; totalCost: number; totalTokens: number; requestCount: number }>();
    featureData.forEach((f: any) => {
      const cat = getFeatureCategory(f.feature);
      const existing = catMap.get(cat) || { category: cat, totalCost: 0, totalTokens: 0, requestCount: 0 };
      existing.totalCost += f.totalCost || 0;
      existing.totalTokens += f.totalTokens || 0;
      existing.requestCount += f.requestCount || 0;
      catMap.set(cat, existing);
    });
    return Array.from(catMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [featureData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex">
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Costi AI</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Monitora i costi e l'utilizzo delle API AI</p>
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Oggi</SelectItem>
                  <SelectItem value="week">Settimana</SelectItem>
                  <SelectItem value="month">Mese</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {loadingSummary ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                <>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Costo Totale</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCost(stats.totalCost || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-teal-500" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Token Totali</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatTokens(stats.totalTokens || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Hash className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Richieste</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.requestCount || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-violet-500" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Costo Medio/Richiesta</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCost(stats.requestCount ? (stats.totalCost || 0) / stats.requestCount : 0)}
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trend Giornaliero</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTimeline ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-slate-500" />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 12 }}
                        className="text-slate-500"
                        tickFormatter={(v: number) => "$" + v.toFixed(2)}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        className="text-slate-500"
                        tickFormatter={(v: number) => formatTokens(v)}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === "Costo") return ["$" + value.toFixed(4), "Costo"];
                          return [formatTokens(value), "Token"];
                        }}
                        labelFormatter={(label) => `Data: ${label}`}
                        contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px" }}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="totalCost" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Costo" />
                      <Line yAxisId="right" type="monotone" dataKey="totalTokens" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Token" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-slate-400">
                    Nessun dato disponibile per il periodo selezionato
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Utilizzo per Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingFeature ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => "$" + v.toFixed(2)} />
                        <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip
                          formatter={(value: number) => ["$" + value.toFixed(4), "Costo"]}
                          contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px" }}
                        />
                        <Bar dataKey="totalCost" radius={[0, 4, 4, 0]}>
                          {categoryData.map((entry, index) => (
                            <Cell key={index} fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS['Altro']} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-slate-400">
                      Nessun dato disponibile
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Per Utente</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingClient ? (
                    <div className="p-6 space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : clientData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Utente</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Funz. principale</TableHead>
                            <TableHead className="text-right">Token</TableHead>
                            <TableHead className="text-right">Costo</TableHead>
                            <TableHead className="text-right">Richieste</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientData.map((row: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{row.clientName || "—"}</TableCell>
                              <TableCell>
                                {row.clientRole === "consultant" ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100">Tu</Badge>
                                ) : (
                                  <Badge variant="secondary">Cliente</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                                {row.topFeature ? getFeatureLabel(row.topFeature) : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatTokens(row.totalTokens || 0)}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatCost(row.totalCost || 0)}</TableCell>
                              <TableCell className="text-right">{row.requestCount || 0}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400">Nessun dato disponibile</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dettaglio per Funzionalità</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingFeature ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : featureData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Funzionalità</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Token</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                          <TableHead className="text-right">Richieste</TableHead>
                          <TableHead className="w-[180px]">% del Totale</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {featureData.map((row: any, i: number) => {
                          const pct = totalFeatureTokens > 0 ? ((row.totalTokens || 0) / totalFeatureTokens) * 100 : 0;
                          const cat = getFeatureCategory(row.feature);
                          return (
                            <TableRow key={i}>
                              <TableCell>
                                <div>
                                  <span className="font-medium">{getFeatureLabel(row.feature)}</span>
                                  <div className="mt-0.5">
                                    <span
                                      className="inline-block text-[10px] px-1.5 py-0.5 rounded-full text-white"
                                      style={{ backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLORS['Altro'] }}
                                    >
                                      {cat}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{cat}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatTokens(row.totalTokens || 0)}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatCost(row.totalCost || 0)}</TableCell>
                              <TableCell className="text-right">{row.requestCount || 0}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={pct} className="h-2 flex-1" />
                                  <span className="text-xs text-slate-500 w-10 text-right">{pct.toFixed(1)}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400">Nessun dato disponibile</div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
