import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFollowupAnalytics } from "@/hooks/useFollowupApi";
import { Send, Eye, MessageSquare, CheckCircle, Loader2, BarChart } from "lucide-react";

export function AnalyticsDashboard() {
  const { data, isLoading, error } = useFollowupAnalytics();

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

  const totals = data?.totals || {};
  const hasData = totals.totalSent > 0 || totals.totalRead > 0 || totals.totalReplies > 0 || totals.totalConversions > 0;

  if (!hasData) {
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

  const metrics = [
    {
      title: "Messaggi inviati",
      value: totals.totalSent || 0,
      icon: Send,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Messaggi letti",
      value: totals.totalRead || 0,
      icon: Eye,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Risposte ricevute",
      value: totals.totalReplies || 0,
      icon: MessageSquare,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Conversioni",
      value: totals.totalConversions || 0,
      icon: CheckCircle,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <div className={`p-2 rounded-full ${metric.bgColor}`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riepilogo Prestazioni</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Tasso di lettura</span>
              <span className="font-medium">
                {totals.totalSent > 0
                  ? `${((totals.totalRead / totals.totalSent) * 100).toFixed(1)}%`
                  : "0%"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Tasso di risposta</span>
              <span className="font-medium">
                {totals.totalSent > 0
                  ? `${((totals.totalReplies / totals.totalSent) * 100).toFixed(1)}%`
                  : "0%"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Tasso di conversione</span>
              <span className="font-medium">
                {totals.totalSent > 0
                  ? `${((totals.totalConversions / totals.totalSent) * 100).toFixed(1)}%`
                  : "0%"}
              </span>
            </div>
            {totals.aiDecisions > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Decisioni AI prese</span>
                <span className="font-medium">{totals.aiDecisions.toLocaleString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
