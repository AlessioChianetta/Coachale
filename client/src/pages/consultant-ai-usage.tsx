import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getToken } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { DollarSign, Zap, Hash, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
                      <YAxis tick={{ fontSize: 12 }} className="text-slate-500" />
                      <Tooltip
                        formatter={(value: number) => ["$" + value.toFixed(4), "Costo"]}
                        labelFormatter={(label) => `Data: ${label}`}
                        contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px" }}
                      />
                      <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Costo" />
                      <Line type="monotone" dataKey="tokens" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Token" hide />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-slate-400">
                    Nessun dato disponibile per il periodo selezionato
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="by-client">
              <TabsList>
                <TabsTrigger value="by-client">Per Cliente</TabsTrigger>
                <TabsTrigger value="by-feature">Per Funzionalità</TabsTrigger>
              </TabsList>

              <TabsContent value="by-client">
                <Card>
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
                              <TableHead>Cliente</TableHead>
                              <TableHead>Ruolo</TableHead>
                              <TableHead className="text-right">Token</TableHead>
                              <TableHead className="text-right">Costo</TableHead>
                              <TableHead className="text-right">Richieste</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clientData.map((row: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{row.name || row.clientName || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={row.clientRole === "consultant" ? "default" : "secondary"}>
                                    {row.clientRole === "consultant" ? "Consulente" : "Cliente"}
                                  </Badge>
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
              </TabsContent>

              <TabsContent value="by-feature">
                <Card>
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
                              <TableHead className="text-right">Token</TableHead>
                              <TableHead className="text-right">Costo</TableHead>
                              <TableHead className="text-right">Richieste</TableHead>
                              <TableHead className="w-[180px]">% del Totale</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {featureData.map((row: any, i: number) => {
                              const pct = totalFeatureTokens > 0 ? ((row.totalTokens || 0) / totalFeatureTokens) * 100 : 0;
                              return (
                                <TableRow key={i}>
                                  <TableCell className="font-medium">{row.feature || row.featureName || "—"}</TableCell>
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
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
