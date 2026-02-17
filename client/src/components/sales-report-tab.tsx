import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, addWeeks, subWeeks, addMonths, subMonths, getDay } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Phone, CalendarDays, Users, DollarSign, TrendingUp, Bot, Loader2, ChevronLeft, ChevronRight, Save, BarChart3, FileText } from "lucide-react";

interface SalesReport {
  id: string;
  userId: string;
  date: string;
  calls: number;
  discoBooked: number;
  discoScheduled: number;
  discoShowed: number;
  demoBooked: number;
  demoScheduled: number;
  demoShowed: number;
  depositsAmount: string;
  contractsClosed: number;
  contractsAmount: string;
  notes: string | null;
}

interface SalesReportTabProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const emptyReport = {
  calls: 0,
  discoBooked: 0,
  discoScheduled: 0,
  discoShowed: 0,
  demoBooked: 0,
  demoScheduled: 0,
  demoShowed: 0,
  depositsAmount: "0",
  contractsClosed: 0,
  contractsAmount: "0",
  notes: "",
};

function sumReports(reports: SalesReport[]) {
  const totals = { calls: 0, discoBooked: 0, discoScheduled: 0, discoShowed: 0, demoBooked: 0, demoScheduled: 0, demoShowed: 0, depositsAmount: 0, contractsClosed: 0, contractsAmount: 0 };
  for (const r of reports) {
    totals.calls += r.calls;
    totals.discoBooked += r.discoBooked;
    totals.discoScheduled += r.discoScheduled;
    totals.discoShowed += r.discoShowed;
    totals.demoBooked += r.demoBooked;
    totals.demoScheduled += r.demoScheduled;
    totals.demoShowed += r.demoShowed;
    totals.depositsAmount += parseFloat(r.depositsAmount || "0");
    totals.contractsClosed += r.contractsClosed;
    totals.contractsAmount += parseFloat(r.contractsAmount || "0");
  }
  return totals;
}

export default function SalesReportTab({ selectedDate, onDateChange }: SalesReportTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState("day");
  const [formData, setFormData] = useState(emptyReport);
  const [hasChanges, setHasChanges] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [weekDate, setWeekDate] = useState(new Date());
  const [monthDate, setMonthDate] = useState(new Date());

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(weekDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(weekDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

  const { data: dayReport } = useQuery<SalesReport>({
    queryKey: ["/api/sales-reports", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/sales-reports/${dateStr}`, { headers: getAuthHeaders() });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: weekReports = [] } = useQuery<SalesReport[]>({
    queryKey: ["/api/sales-reports", "week", weekStart, weekEnd],
    queryFn: async () => {
      const res = await fetch(`/api/sales-reports?startDate=${weekStart}&endDate=${weekEnd}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: view === "week" || view === "month",
  });

  const { data: monthReports = [] } = useQuery<SalesReport[]>({
    queryKey: ["/api/sales-reports", "month", monthStart, monthEnd],
    queryFn: async () => {
      const res = await fetch(`/api/sales-reports?startDate=${monthStart}&endDate=${monthEnd}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: view === "month",
  });

  useEffect(() => {
    if (dayReport) {
      setFormData({
        calls: dayReport.calls,
        discoBooked: dayReport.discoBooked,
        discoScheduled: dayReport.discoScheduled,
        discoShowed: dayReport.discoShowed,
        demoBooked: dayReport.demoBooked,
        demoScheduled: dayReport.demoScheduled,
        demoShowed: dayReport.demoShowed,
        depositsAmount: dayReport.depositsAmount || "0",
        contractsClosed: dayReport.contractsClosed,
        contractsAmount: dayReport.contractsAmount || "0",
        notes: dayReport.notes || "",
      });
      setHasChanges(false);
    } else {
      setFormData(emptyReport);
      setHasChanges(false);
    }
  }, [dayReport, dateStr]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sales-reports", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, ...formData }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-reports"] });
      setHasChanges(false);
      toast({ title: "Report salvato", description: `Report del ${format(selectedDate, "dd MMMM yyyy", { locale: it })} salvato` });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile salvare il report", variant: "destructive" });
    },
  });

  const aiMutation = useMutation({
    mutationFn: async (params: { startDate: string; endDate: string }) => {
      const res = await fetch("/api/sales-reports/ai-analyze", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "AI analysis failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setAiAnalysis(data.analysis);
    },
    onError: (err: Error) => {
      toast({ title: "Errore AI", description: err.message, variant: "destructive" });
    },
  });

  const updateField = useCallback((field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const getAiRange = () => {
    if (view === "week") return { startDate: weekStart, endDate: weekEnd };
    if (view === "month") return { startDate: monthStart, endDate: monthEnd };
    const ws = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const we = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    return { startDate: ws, endDate: we };
  };

  return (
    <div className="space-y-6">
      <Tabs value={view} onValueChange={setView}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="day" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            Giorno
          </TabsTrigger>
          <TabsTrigger value="week" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Settimana
          </TabsTrigger>
          <TabsTrigger value="month" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Mese
          </TabsTrigger>
        </TabsList>

        <TabsContent value="day" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => onDateChange(addDays(selectedDate, -1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">
                {format(selectedDate, "EEEE d MMMM yyyy", { locale: it })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => onDateChange(addDays(selectedDate, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !hasChanges} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salva
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-500" />
                  Chiamate & Discovery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Call effettuate</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.calls} onChange={e => updateField("calls", parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Disco Prenotate</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.discoBooked} onChange={e => updateField("discoBooked", parseInt(e.target.value) || 0)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-500" />
                  Discovery del Giorno
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Disco Programmate</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.discoScheduled} onChange={e => updateField("discoScheduled", parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Presentati</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.discoShowed} onChange={e => updateField("discoShowed", parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Demo Prenotate</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.demoBooked} onChange={e => updateField("demoBooked", parseInt(e.target.value) || 0)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-purple-500" />
                  Demo del Giorno
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Demo Programmate</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.demoScheduled} onChange={e => updateField("demoScheduled", parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Presentati</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.demoShowed} onChange={e => updateField("demoShowed", parseInt(e.target.value) || 0)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  Risultati
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Depositi (€)</Label>
                  <Input type="number" min={0} step="0.01" className="w-28 text-right" value={formData.depositsAmount} onChange={e => updateField("depositsAmount", e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Contratti Chiusi</Label>
                  <Input type="number" min={0} className="w-24 text-right" value={formData.contractsClosed} onChange={e => updateField("contractsClosed", parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Importo Contratti (€)</Label>
                  <Input type="number" min={0} step="0.01" className="w-28 text-right" value={formData.contractsAmount} onChange={e => updateField("contractsAmount", e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="Note sul giorno, motivi, riflessioni..." value={formData.notes} onChange={e => updateField("notes", e.target.value)} rows={3} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="week" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setWeekDate(subWeeks(weekDate, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">
                {format(startOfWeek(weekDate, { weekStartsOn: 1 }), "d MMM", { locale: it })} - {format(endOfWeek(weekDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: it })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => setWeekDate(addWeeks(weekDate, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <WeeklyTable reports={weekReports} weekStart={startOfWeek(weekDate, { weekStartsOn: 1 })} />
        </TabsContent>

        <TabsContent value="month" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setMonthDate(subMonths(monthDate, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold capitalize">
                {format(monthDate, "MMMM yyyy", { locale: it })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <MonthlyTable reports={monthReports} monthDate={monthDate} />
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-500" />
              Assistente AI Vendite
            </CardTitle>
            <Button variant="default" size="sm" className="gap-2" disabled={aiMutation.isPending} onClick={() => aiMutation.mutate(getAiRange())}>
              {aiMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              {aiMutation.isPending ? "Analisi in corso..." : "Analizza Performance"}
            </Button>
          </div>
        </CardHeader>
        {aiAnalysis && (
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap bg-muted/50 rounded-lg p-4">
              {aiAnalysis}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function WeeklyTable({ reports, weekStart }: { reports: SalesReport[]; weekStart: Date }) {
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const reportMap = new Map(reports.map(r => [r.date, r]));
  const totals = sumReports(reports);

  const metrics = [
    { key: "calls", label: "Call", icon: Phone },
    { key: "discoBooked", label: "Disco Prenotate", icon: CalendarDays },
    { key: "discoScheduled", label: "Disco Programmate", icon: CalendarDays },
    { key: "discoShowed", label: "Disco Presentati", icon: Users },
    { key: "demoBooked", label: "Demo Prenotate", icon: CalendarDays },
    { key: "demoScheduled", label: "Demo Programmate", icon: CalendarDays },
    { key: "demoShowed", label: "Demo Presentati", icon: Users },
    { key: "depositsAmount", label: "Depositi €", icon: DollarSign },
    { key: "contractsClosed", label: "Contratti", icon: TrendingUp },
    { key: "contractsAmount", label: "Importo €", icon: DollarSign },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium min-w-[150px]">Metrica</th>
                {days.map(d => (
                  <th key={d.toISOString()} className="text-center p-3 font-medium min-w-[70px]">
                    <div className="text-xs text-muted-foreground">{format(d, "EEE", { locale: it })}</div>
                    <div>{format(d, "d")}</div>
                  </th>
                ))}
                <th className="text-center p-3 font-semibold min-w-[80px] bg-primary/5">Totale</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => (
                <tr key={m.key} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium flex items-center gap-2">
                    <m.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {m.label}
                  </td>
                  {days.map(d => {
                    const r = reportMap.get(format(d, "yyyy-MM-dd"));
                    const val = r ? (r as any)[m.key] : 0;
                    const display = m.key.includes("Amount") ? (parseFloat(val || "0") > 0 ? `€${parseFloat(val).toFixed(0)}` : "-") : (val > 0 ? val : "-");
                    return (
                      <td key={d.toISOString()} className="text-center p-3">
                        <span className={val > 0 ? "font-medium" : "text-muted-foreground"}>{display}</span>
                      </td>
                    );
                  })}
                  <td className="text-center p-3 font-semibold bg-primary/5">
                    {m.key.includes("Amount") ? `€${(totals as any)[m.key].toFixed(0)}` : (totals as any)[m.key]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CardContent className="border-t">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Tassi di Conversione
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ConversionBadge label="Call → Disco" value={totals.calls > 0 ? (totals.discoBooked / totals.calls * 100) : 0} />
          <ConversionBadge label="Disco Show Rate" value={totals.discoScheduled > 0 ? (totals.discoShowed / totals.discoScheduled * 100) : 0} />
          <ConversionBadge label="Demo Show Rate" value={totals.demoScheduled > 0 ? (totals.demoShowed / totals.demoScheduled * 100) : 0} />
          <ConversionBadge label="Demo → Contratti" value={totals.demoShowed > 0 ? (totals.contractsClosed / totals.demoShowed * 100) : 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyTable({ reports, monthDate }: { reports: SalesReport[]; monthDate: Date }) {
  const monthS = startOfMonth(monthDate);
  const monthE = endOfMonth(monthDate);

  const weeks: { start: Date; end: Date; label: string }[] = [];
  let current = startOfWeek(monthS, { weekStartsOn: 1 });
  while (current <= monthE) {
    const wEnd = addDays(current, 6);
    weeks.push({
      start: current,
      end: wEnd,
      label: `${format(current, "d MMM", { locale: it })} - ${format(wEnd, "d MMM", { locale: it })}`,
    });
    current = addDays(wEnd, 1);
  }

  const totals = sumReports(reports);
  const metrics = [
    { key: "calls", label: "Call" },
    { key: "discoBooked", label: "Disco Prenotate" },
    { key: "discoScheduled", label: "Disco Programmate" },
    { key: "discoShowed", label: "Disco Presentati" },
    { key: "demoBooked", label: "Demo Prenotate" },
    { key: "demoScheduled", label: "Demo Programmate" },
    { key: "demoShowed", label: "Demo Presentati" },
    { key: "depositsAmount", label: "Depositi €" },
    { key: "contractsClosed", label: "Contratti" },
    { key: "contractsAmount", label: "Importo €" },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium min-w-[150px]">Metrica</th>
                {weeks.map((w, i) => (
                  <th key={i} className="text-center p-3 font-medium min-w-[100px]">
                    <div className="text-xs">{w.label}</div>
                  </th>
                ))}
                <th className="text-center p-3 font-semibold min-w-[80px] bg-primary/5">Totale</th>
                <th className="text-center p-3 font-semibold min-w-[80px] bg-primary/5">Media/g</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => {
                const weekValues = weeks.map(w => {
                  const wReports = reports.filter(r => {
                    const d = new Date(r.date);
                    return d >= w.start && d <= w.end;
                  });
                  return sumReports(wReports);
                });
                const daysWithData = reports.length || 1;
                const totalVal = (totals as any)[m.key];
                const avg = m.key.includes("Amount") ? (totalVal / daysWithData).toFixed(0) : (totalVal / daysWithData).toFixed(1);

                return (
                  <tr key={m.key} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{m.label}</td>
                    {weekValues.map((wv, i) => {
                      const val = (wv as any)[m.key];
                      const display = m.key.includes("Amount") ? (val > 0 ? `€${val.toFixed(0)}` : "-") : (val > 0 ? val : "-");
                      return <td key={i} className="text-center p-3">{display}</td>;
                    })}
                    <td className="text-center p-3 font-semibold bg-primary/5">
                      {m.key.includes("Amount") ? `€${totalVal.toFixed(0)}` : totalVal}
                    </td>
                    <td className="text-center p-3 text-muted-foreground bg-primary/5">
                      {m.key.includes("Amount") ? `€${avg}` : avg}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CardContent className="border-t">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Tassi di Conversione Mensili
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ConversionBadge label="Call → Disco" value={totals.calls > 0 ? (totals.discoBooked / totals.calls * 100) : 0} />
          <ConversionBadge label="Disco Show Rate" value={totals.discoScheduled > 0 ? (totals.discoShowed / totals.discoScheduled * 100) : 0} />
          <ConversionBadge label="Demo Show Rate" value={totals.demoScheduled > 0 ? (totals.demoShowed / totals.demoScheduled * 100) : 0} />
          <ConversionBadge label="Demo → Contratti" value={totals.demoShowed > 0 ? (totals.contractsClosed / totals.demoShowed * 100) : 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function ConversionBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 50 ? "text-green-600 bg-green-50 dark:bg-green-950/30" : value >= 25 ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30" : "text-red-600 bg-red-50 dark:bg-red-950/30";
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-lg font-bold">{value.toFixed(1)}%</div>
    </div>
  );
}
