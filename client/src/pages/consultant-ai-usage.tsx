import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Battery, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Pencil,
} from "lucide-react";
import { format, subDays, getDay } from "date-fns";
import { it } from "date-fns/locale";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

const FEATURE_COLORS: Record<string, string> = {
  "Chat AI": "#6366f1",
  "WhatsApp": "#22c55e",
  "Agenti Autonomi": "#f59e0b",
  "Stato Cliente": "#ec4899",
  "Content Studio": "#06b6d4",
  "Altro": "#94a3b8",
};

const FEATURE_LIST = Object.keys(FEATURE_COLORS);

const CLIENT_NAMES = [
  { id: "c1", name: "Marco Rossi", tokens: 420000, cost: 2.24 },
  { id: "c2", name: "Giulia Bianchi", tokens: 380000, cost: 2.03 },
  { id: "c3", name: "Alessandro Ferrara", tokens: 310000, cost: 1.66 },
  { id: "c4", name: "Chiara Esposito", tokens: 285000, cost: 1.52 },
  { id: "c5", name: "Luca Moretti", tokens: 260000, cost: 1.39 },
  { id: "c6", name: "Francesca Romano", tokens: 230000, cost: 1.23 },
  { id: "c7", name: "Giuseppe Colombo", tokens: 195000, cost: 1.04 },
  { id: "c8", name: "Sofia Ricci", tokens: 180000, cost: 0.96 },
];

const FEATURE_BREAKDOWN = [
  { name: "Chat AI", value: 35, color: FEATURE_COLORS["Chat AI"] },
  { name: "WhatsApp", value: 25, color: FEATURE_COLORS["WhatsApp"] },
  { name: "Agenti Autonomi", value: 20, color: FEATURE_COLORS["Agenti Autonomi"] },
  { name: "Stato Cliente", value: 8, color: FEATURE_COLORS["Stato Cliente"] },
  { name: "Content Studio", value: 7, color: FEATURE_COLORS["Content Studio"] },
  { name: "Altro", value: 5, color: FEATURE_COLORS["Altro"] },
];

const PRICING_MODELS = [
  { model: "Gemini 2.5 Flash", inputPrice: 0.15, outputPrice: 0.60 },
  { model: "Gemini 2.5 Pro", inputPrice: 1.25, outputPrice: 10.00 },
  { model: "Gemini 2.0 Flash Lite", inputPrice: 0.075, outputPrice: 0.30 },
];

function generateDailyData() {
  const data = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = subDays(today, i);
    const dayOfWeek = getDay(date);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const base = isWeekend ? 40000 : 80000;
    const variance = Math.floor(Math.random() * 30000) - 15000;
    const inputTokens = Math.max(20000, base + variance);
    const outputTokens = Math.max(10000, Math.floor(inputTokens * (0.4 + Math.random() * 0.2)));
    data.push({
      date: format(date, "d MMM", { locale: it }),
      fullDate: format(date, "dd/MM/yyyy", { locale: it }),
      input: inputTokens,
      output: outputTokens,
    });
  }
  return data;
}

function generateDetailedCalls() {
  const models = ["Gemini 2.5 Flash", "Gemini 2.5 Pro", "Gemini 2.0 Flash Lite"];
  const features = FEATURE_LIST;
  const clients = CLIENT_NAMES.map(c => c.name);
  const calls = [];
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    const date = subDays(now, Math.floor(Math.random() * 7));
    const hours = 8 + Math.floor(Math.random() * 12);
    const mins = Math.floor(Math.random() * 60);
    date.setHours(hours, mins, 0);
    const model = models[Math.floor(Math.random() * models.length)];
    const feature = features[Math.floor(Math.random() * (features.length - 1))];
    const client = clients[Math.floor(Math.random() * clients.length)];
    const inputTokens = 500 + Math.floor(Math.random() * 15000);
    const outputTokens = 200 + Math.floor(Math.random() * 8000);
    const pricing = PRICING_MODELS.find(p => p.model === model)!;
    const cost = (inputTokens / 1_000_000) * pricing.inputPrice + (outputTokens / 1_000_000) * pricing.outputPrice;
    calls.push({
      id: `call-${i}`,
      dateTime: format(date, "dd/MM/yyyy HH:mm", { locale: it }),
      timestamp: date.getTime(),
      feature,
      client,
      model,
      inputTokens,
      outputTokens,
      cost: Math.round(cost * 10000) / 10000,
    });
  }
  return calls.sort((a, b) => b.timestamp - a.timestamp);
}

const DAILY_DATA = generateDailyData();
const DETAILED_CALLS = generateDetailedCalls();

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function ConsultantAIUsagePage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [periodo, setPeriodo] = useState("questo-mese");
  const [clienteFilter, setClienteFilter] = useState("all");
  const [funzionalitaFilter, setFunzionalitaFilter] = useState("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  const dailyData = useMemo(() => DAILY_DATA, []);
  const detailedCalls = useMemo(() => DETAILED_CALLS, []);
  const maxClientTokens = useMemo(() => Math.max(...CLIENT_NAMES.map(c => c.tokens)), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 rounded-xl sm:rounded-2xl">
                <Battery className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Consumo AI</h1>
                <p className="text-muted-foreground text-xs sm:text-sm">Monitora l'utilizzo delle API AI e i costi associati</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oggi">Oggi</SelectItem>
                  <SelectItem value="ultima-settimana">Ultima Settimana</SelectItem>
                  <SelectItem value="questo-mese">Questo Mese</SelectItem>
                  <SelectItem value="ultimo-trimestre">Ultimo Trimestre</SelectItem>
                </SelectContent>
              </Select>
              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i Clienti</SelectItem>
                  {CLIENT_NAMES.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={funzionalitaFilter} onValueChange={setFunzionalitaFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Funzionalità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  {FEATURE_LIST.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Token Totali</p>
                <p className="text-3xl font-bold text-foreground mt-1">2.4M</p>
                <p className="text-xs text-muted-foreground mt-1">1.6M input + 0.8M output</p>
                <div className="flex items-center mt-3 text-sm text-emerald-600 dark:text-emerald-400">
                  <ArrowUp className="h-4 w-4 mr-1" />
                  +15% vs mese scorso
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Costo Stimato</p>
                <p className="text-3xl font-bold text-foreground mt-1">€12.80</p>
                <p className="text-xs text-muted-foreground mt-1">basato sul listino corrente</p>
                <div className="flex items-center mt-3 text-sm text-emerald-600 dark:text-emerald-400">
                  <ArrowUp className="h-4 w-4 mr-1" />
                  +€2.10 vs mese scorso
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Media Giornaliera</p>
                <p className="text-3xl font-bold text-foreground mt-1">82K</p>
                <p className="text-xs text-muted-foreground mt-1">tokens al giorno</p>
                <div className="flex items-center mt-3 text-sm text-red-600 dark:text-red-400">
                  <ArrowDown className="h-4 w-4 mr-1" />
                  -5% vs mese scorso
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Consumo Giornaliero</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tickFormatter={(v: number) => formatTokens(v)} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border rounded-lg shadow-lg p-3">
                              <p className="font-medium text-sm">{label}</p>
                              <p className="text-sm text-indigo-600">Input: {formatTokens(payload[0]?.value as number)}</p>
                              <p className="text-sm text-violet-600">Output: {formatTokens(payload[1]?.value as number)}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Totale: {formatTokens((payload[0]?.value as number) + (payload[1]?.value as number))}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="input"
                      stackId="1"
                      stroke="#6366f1"
                      fill="url(#inputGrad)"
                      name="Input Tokens"
                    />
                    <Area
                      type="monotone"
                      dataKey="output"
                      stackId="1"
                      stroke="#8b5cf6"
                      fill="url(#outputGrad)"
                      name="Output Tokens"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Two Columns: Feature Breakdown + Top Clients */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Feature Breakdown Donut */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Per Funzionalità</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={FEATURE_BREAKDOWN}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {FEATURE_BREAKDOWN.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-background border rounded-lg shadow-lg p-3">
                                <p className="font-medium text-sm">{d.name}</p>
                                <p className="text-sm">{d.value}%</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {FEATURE_BREAKDOWN.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name} {item.value}%
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Clients */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Per Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 text-xs font-medium text-muted-foreground px-1">
                    <span>#</span>
                    <span>Cliente</span>
                    <span className="text-right">Token</span>
                    <span className="text-right">Costo</span>
                  </div>
                  {CLIENT_NAMES.map((client, idx) => (
                    <div key={client.id} className="relative">
                      <div
                        className="absolute inset-y-0 left-0 bg-indigo-100 dark:bg-indigo-900/30 rounded"
                        style={{ width: `${(client.tokens / maxClientTokens) * 100}%` }}
                      />
                      <div className="relative grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-center py-2 px-2 text-sm">
                        <span className="text-muted-foreground font-medium w-5 text-center">{idx + 1}</span>
                        <button
                          className="text-left font-medium text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
                          onClick={() => setClienteFilter(client.id)}
                        >
                          {client.name}
                        </button>
                        <span className="text-right text-muted-foreground">{formatTokens(client.tokens)}</span>
                        <span className="text-right text-muted-foreground">€{client.cost.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Calls (Collapsible) */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Dettaglio Chiamate</CardTitle>
                    {detailsOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Data/Ora</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Funzionalità</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Cliente</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Modello</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">Input</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">Output</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailedCalls.map((call) => (
                          <tr key={call.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 px-2 whitespace-nowrap">{call.dateTime}</td>
                            <td className="py-2 px-2">
                              <Badge
                                variant="outline"
                                style={{
                                  borderColor: FEATURE_COLORS[call.feature] || "#94a3b8",
                                  color: FEATURE_COLORS[call.feature] || "#94a3b8",
                                }}
                              >
                                {call.feature}
                              </Badge>
                            </td>
                            <td className="py-2 px-2">{call.client}</td>
                            <td className="py-2 px-2 text-muted-foreground text-xs">{call.model}</td>
                            <td className="py-2 px-2 text-right">{formatTokens(call.inputTokens)}</td>
                            <td className="py-2 px-2 text-right">{formatTokens(call.outputTokens)}</td>
                            <td className="py-2 px-2 text-right">€{call.cost.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Pricing Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Listino Prezzi AI</CardTitle>
                  <CardDescription>Prezzi usati per calcolare i costi stimati</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast({ title: "Coming soon", description: "La modifica dei prezzi sarà disponibile a breve." })}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Modifica
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Modello</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Input / 1M token</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Output / 1M token</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRICING_MODELS.map((pm) => (
                      <tr key={pm.model} className="border-b last:border-0">
                        <td className="py-2 px-2 font-medium">{pm.model}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">€{pm.inputPrice.toFixed(3)}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">€{pm.outputPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}
