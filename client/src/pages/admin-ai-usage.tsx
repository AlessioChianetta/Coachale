import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/navbar";
import { getToken } from "@/lib/auth";
import { useState } from "react";
import { DollarSign, Users, Key, TrendingUp } from "lucide-react";
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

const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

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

export default function AdminAIUsagePage() {
  const [period, setPeriod] = useState("month");

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["/api/admin/ai-usage/platform-summary", period],
    queryFn: () => fetchWithAuth(`/api/admin/ai-usage/platform-summary?period=${period}`),
  });

  const { data: consultants, isLoading: loadingConsultants } = useQuery({
    queryKey: ["/api/admin/ai-usage/all-consultants", period],
    queryFn: () => fetchWithAuth(`/api/admin/ai-usage/all-consultants?period=${period}`),
  });

  const stats = summary?.data || summary || {};
  const consultantData = consultants?.data || consultants || [];
  const timelineData = stats.timeline || [];
  const topFeatures = stats.topFeatures || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      <Navbar onMenuClick={() => {}} />
      <main className="p-4 md:p-6 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Costi AI - Admin</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Panoramica dei costi AI di tutta la piattaforma</p>
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
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Costo Totale Piattaforma</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCost(stats.totalPlatformCost || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-teal-500" />
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Consulenti Attivi</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeConsultants || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Key className="h-4 w-4 text-blue-500" />
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Costo Key SuperAdmin</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCost(stats.superAdminKeyCost || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-violet-500" />
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Costo Key Utenti</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCost(stats.userKeyCost || 0)}</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trend Costi Piattaforma</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSummary ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => ["$" + value.toFixed(4), "Costo"]}
                        contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px" }}
                      />
                      <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-slate-400">
                    Nessun dato disponibile
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Funzionalità</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSummary ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : topFeatures.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={topFeatures} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="feature" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip
                        formatter={(value: number) => ["$" + value.toFixed(4), "Costo"]}
                        contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px" }}
                      />
                      <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                        {topFeatures.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-slate-400">
                    Nessun dato disponibile
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tutti i Consulenti</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingConsultants ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : consultantData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Clienti</TableHead>
                        <TableHead className="text-right">Token</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead>Sorgente Key</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consultantData.map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.name || row.consultantName || "—"}</TableCell>
                          <TableCell className="text-right">{row.clientCount || 0}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatTokens(row.totalTokens || 0)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatCost(row.totalCost || 0)}</TableCell>
                          <TableCell>
                            <Badge variant={row.keySource === "superadmin" ? "default" : "secondary"}>
                              {row.keySource === "superadmin" ? "SuperAdmin" : row.keySource === "own" ? "Propria" : row.keySource || "—"}
                            </Badge>
                          </TableCell>
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
      </main>
    </div>
  );
}
