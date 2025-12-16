import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useWeeklyStats } from "@/hooks/useFollowupApi";
import { Send, AlertTriangle, Clock, Loader2, BarChart, Brain, FileText, TrendingUp } from "lucide-react";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Progress } from "@/components/ui/progress";

const COLORS = {
  sent: "#22c55e",
  pending: "#3b82f6", 
  failed: "#ef4444",
  ai: "#8b5cf6",
  template: "#f59e0b",
};

export function AnalyticsDashboard() {
  const { data, isLoading, error } = useWeeklyStats();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Caricamento statistiche...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart className="h-16 w-16 text-destructive mb-4" />
            <h3 className="text-xl font-semibold mb-2">Errore</h3>
            <p className="text-muted-foreground">Impossibile caricare le statistiche</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalSent = data?.dailyChart?.reduce((sum, d) => sum + d.sent, 0) || 0;
  const totalPending = data?.dailyChart?.reduce((sum, d) => sum + d.pending, 0) || 0;
  const totalFailed = data?.dailyChart?.reduce((sum, d) => sum + d.failed, 0) || 0;
  const hasData = totalSent > 0 || totalPending > 0 || totalFailed > 0;

  if (!hasData && (!data?.topErrors || data.topErrors.length === 0)) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nessun dato disponibile</h3>
            <p className="text-muted-foreground max-w-md">
              Le statistiche appariranno quando inizierai a usare il sistema di automazioni.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const responseRatePieData = [
    { name: "AI", value: data?.responseRates?.ai?.rate || 0, color: COLORS.ai },
    { name: "Template", value: data?.responseRates?.template?.rate || 0, color: COLORS.template },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inviati (7gg)</CardTitle>
            <div className="p-2 rounded-full bg-green-500/10">
              <Send className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSent}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Attesa (7gg)</CardTitle>
            <div className="p-2 rounded-full bg-blue-500/10">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPending}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falliti (7gg)</CardTitle>
            <div className="p-2 rounded-full bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFailed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Messaggi Ultimi 7 Giorni
            </CardTitle>
            <CardDescription>Inviati, in attesa e falliti per giorno</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={data?.dailyChart || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="sent" name="Inviati" fill={COLORS.sent} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="In Attesa" fill={COLORS.pending} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Falliti" fill={COLORS.failed} radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tasso di Risposta
            </CardTitle>
            <CardDescription>Confronto AI vs Template (entro 24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Messaggi AI</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {data?.responseRates?.ai?.replied || 0}/{data?.responseRates?.ai?.sent || 0} ({data?.responseRates?.ai?.rate || 0}%)
                  </span>
                </div>
                <Progress value={data?.responseRates?.ai?.rate || 0} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Template WhatsApp</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {data?.responseRates?.template?.replied || 0}/{data?.responseRates?.template?.sent || 0} ({data?.responseRates?.template?.rate || 0}%)
                  </span>
                </div>
                <Progress value={data?.responseRates?.template?.rate || 0} className="h-2" />
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  Tasso = risposte ricevute entro 24h dall'invio
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.topErrors && data.topErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Top 5 Errori
            </CardTitle>
            <CardDescription>Errori più frequenti negli ultimi 7 giorni</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topErrors.map((error, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-red-500">#{index + 1}</span>
                    <span className="text-sm truncate max-w-[400px]">{error.message}</span>
                  </div>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {error.count}x
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
