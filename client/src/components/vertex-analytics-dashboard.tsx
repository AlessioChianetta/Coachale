import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  TrendingDown,
  Zap,
  Activity,
  Mic,
  Volume2,
  Database,
  Sparkles,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";

interface VertexAIUsageStats {
  totalSessions: number;
  totalApiCalls: number;
  totalCost: number;
  avgCostPerSession: number;
  costBreakdown: {
    textInput: number;
    audioInput: number;
    audioOutput: number;
    cachedInput: number;
  };
  tokens: {
    totalPrompt: number;
    totalCandidates: number;
    totalCached: number;
    cacheHitRate: number;
  };
  audio: {
    totalInputSeconds: number;
    totalOutputSeconds: number;
  };
  cacheOptimization: {
    savingsUSD: number;
    savingsPercentage: number;
    costWithoutCache: number;
    costWithCache: number;
  };
}

export default function VertexAnalyticsDashboard() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<string>("30d");

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    return { startDate, endDate: now };
  };

  // Fetch Vertex AI usage analytics
  const { data: stats, isLoading, error } = useQuery<VertexAIUsageStats>({
    queryKey: ["/api/analytics/vertex-usage", dateRange],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      const params = new URLSearchParams();
      params.append("startDate", startDate.toISOString());
      params.append("endDate", endDate.toISOString());
      
      const response = await fetch(`/api/analytics/vertex-usage?${params}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to fetch Vertex AI analytics");
      }
      
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: "Errore Caricamento Dati",
        description: error.message || "Impossibile caricare le statistiche Vertex AI",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('it-IT').format(value);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Errore nel caricamento delle analytics Vertex AI</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with date range selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Vertex AI Live API Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoraggio costi e usage per chiamate vocali con Gemini 2.0 Flash
          </p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 giorni</SelectItem>
            <SelectItem value="30d">30 giorni</SelectItem>
            <SelectItem value="90d">90 giorni</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessioni Live</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalSessions)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(stats.totalApiCalls)} API calls totali
            </p>
          </CardContent>
        </Card>

        {/* Total Cost */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Totale</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</div>
            <p className="text-xs text-muted-foreground">
              Media: {formatCurrency(stats.avgCostPerSession)}/sessione
            </p>
          </CardContent>
        </Card>

        {/* Cache Hit Rate */}
        <Card className="border-green-500/20 bg-green-50/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.tokens.cacheHitRate.toFixed(1)}%
            </div>
            <Progress value={stats.tokens.cacheHitRate} className="mt-2" />
          </CardContent>
        </Card>

        {/* Cache Savings */}
        <Card className="border-purple-500/20 bg-purple-50/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risparmio Cache</CardTitle>
            <TrendingDown className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(stats.cacheOptimization.savingsUSD)}
            </div>
            <Badge variant="outline" className="mt-1 text-xs bg-purple-100 text-purple-700 border-purple-300">
              -{stats.cacheOptimization.savingsPercentage.toFixed(0)}% rispetto a no-cache
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Breakdown Costi per Tipo
          </CardTitle>
          <CardDescription>
            Dettaglio distribuzione costi: input/output, testo/audio, cache
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Audio Output (most expensive) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Audio Output</span>
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                    $12.00/1M tokens
                  </Badge>
                </div>
                <span className="text-sm font-bold">{formatCurrency(stats.costBreakdown.audioOutput)}</span>
              </div>
              <Progress 
                value={(stats.costBreakdown.audioOutput / stats.totalCost) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formatDuration(stats.audio.totalOutputSeconds)} di audio generato
              </p>
            </div>

            {/* Audio Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Audio Input</span>
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                    $3.00/1M tokens
                  </Badge>
                </div>
                <span className="text-sm font-bold">{formatCurrency(stats.costBreakdown.audioInput)}</span>
              </div>
              <Progress 
                value={(stats.costBreakdown.audioInput / stats.totalCost) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formatDuration(stats.audio.totalInputSeconds)} di audio ricevuto
              </p>
            </div>

            {/* Text Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Text Input (Fresh)</span>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    $0.50/1M tokens
                  </Badge>
                </div>
                <span className="text-sm font-bold">{formatCurrency(stats.costBreakdown.textInput)}</span>
              </div>
              <Progress 
                value={(stats.costBreakdown.textInput / stats.totalCost) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(stats.tokens.totalPrompt)} tokens non cachati
              </p>
            </div>

            {/* Cached Input (cheapest!) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Cached Input</span>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    $0.03/1M tokens ⚡ 94% cheaper!
                  </Badge>
                </div>
                <span className="text-sm font-bold text-green-600">
                  {formatCurrency(stats.costBreakdown.cachedInput)}
                </span>
              </div>
              <Progress 
                value={(stats.costBreakdown.cachedInput / stats.totalCost) * 100} 
                className="h-2 bg-green-100" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(stats.tokens.totalCached)} tokens cachati (scripts di vendita)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Optimization Impact */}
      <Card className="border-green-500/30 bg-gradient-to-r from-green-50/50 to-purple-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Impatto Ottimizzazione Cache
          </CardTitle>
          <CardDescription>
            Scripts di vendita cachati per ridurre drasticamente i costi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white rounded-lg border">
              <p className="text-sm text-muted-foreground mb-1">Senza Cache</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.cacheOptimization.costWithoutCache)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Costo teorico a $0.50/1M
              </p>
            </div>
            
            <div className="text-center p-4 bg-white rounded-lg border">
              <p className="text-sm text-muted-foreground mb-1">Con Cache</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.cacheOptimization.costWithCache)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Costo effettivo a $0.03/1M
              </p>
            </div>
            
            <div className="text-center p-4 bg-gradient-to-br from-purple-100 to-green-100 rounded-lg border-2 border-purple-300">
              <p className="text-sm font-medium text-purple-900 mb-1">Risparmio Totale</p>
              <p className="text-2xl font-bold text-purple-700">
                {formatCurrency(stats.cacheOptimization.savingsUSD)}
              </p>
              <Badge className="mt-2 bg-purple-600">
                -{stats.cacheOptimization.savingsPercentage.toFixed(1)}% 🎉
              </Badge>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>💡 Come funziona:</strong> Gli script di vendita (Discovery, Demo, Obiezioni) 
              sono cachati nella <code className="px-1 py-0.5 bg-blue-100 rounded">system_instruction</code> 
              di Gemini. Ogni volta che vengono riutilizzati, paghiamo solo $0.03/1M invece di $0.50/1M - 
              un risparmio del <strong>94%</strong>! 🚀
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
