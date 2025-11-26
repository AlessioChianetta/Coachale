import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Target, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTrainingAnalytics } from '@/hooks/useTrainingAnalytics';

interface LadderAnalyticsTabProps {
  agentId: string;
}

export function LadderAnalyticsTab({ agentId }: LadderAnalyticsTabProps) {
  const { data, isLoading, error } = useTrainingAnalytics(agentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Caricamento analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertCircle className="h-5 w-5" />
            <span>Errore nel caricamento dei dati: {error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgDepth = data?.ladderAnalytics?.averageDepth || 0;
  const totalActivations = data?.ladderAnalytics?.totalActivations || 0;
  const depthDist = data?.ladderAnalytics?.depthDistribution || {
    depth_1: 0, depth_2: 0, depth_3: 0, depth_4: 0, depth_5_plus: 0
  };

  const targetDepth = 4;
  const gap = targetDepth - avgDepth;

  const depthDistribution = [
    { depth: '1x', count: depthDist.depth_1, label: '1 PERCHÉ' },
    { depth: '2x', count: depthDist.depth_2, label: '2 PERCHÉ' },
    { depth: '3x', count: depthDist.depth_3, label: '3 PERCHÉ' },
    { depth: '4x', count: depthDist.depth_4, label: '4 PERCHÉ (Target)' },
    { depth: '5x+', count: depthDist.depth_5_plus, label: '5+ PERCHÉ' },
  ];

  const getBarColor = (depth: string): string => {
    if (depth === '4x') return '#10b981';
    if (depth === '3x' || depth === '5x+') return '#f59e0b';
    return '#94a3b8';
  };

  // Assuming totalConv is available in data or can be calculated
  const totalConv = data?.ladderAnalytics?.totalConversations || 0;

  // Assuming stats object contains ladderActivationRate
  const stats = data?.ladderAnalytics;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Media Ladder Depth
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {avgDepth.toFixed(1)}x
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Target Depth
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {targetDepth}.0x
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Gap vs Target
                </p>
                <p className={`text-3xl font-bold ${gap > 0 ? 'text-red-600' : gap < -0.5 ? 'text-orange-600' : 'text-green-600'}`}>
                  {gap > 0 ? '-' : '+'}{Math.abs(gap).toFixed(1)}x
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                gap > 0 ? 'bg-red-100 dark:bg-red-900' : gap < -0.5 ? 'bg-orange-100 dark:bg-orange-900' : 'bg-green-100 dark:bg-green-900'
              }`}>
                <TrendingUp className={`h-6 w-6 ${gap > 0 ? 'text-red-600' : gap < -0.5 ? 'text-orange-600' : 'text-green-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Distribuzione Ladder Depth
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Analisi di quanto profondamente l'AI utilizza la tecnica del 3-5 PERCHÉ per approfondire risposte vaghe.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={depthDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                        <p className="font-semibold">{data.label}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Conversazioni: {data.count}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Percentuale: {totalConv > 0 ? ((data.count / totalConv) * 100).toFixed(1) : '0.0'}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {depthDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.depth)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-3 text-purple-900 dark:text-purple-100">
            Ladder Effectiveness - Best Practices
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
              <Badge className="mb-2 bg-green-500">Ottimale (3-4x)</Badge>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                <strong>Profondità ideale:</strong> L'AI approfondisce abbastanza per ottenere informazioni utili
                senza trasformare la conversazione in un interrogatorio. Target: 4x PERCHÉ.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
              <Badge className="mb-2 bg-yellow-500">Attenzione (1-2x)</Badge>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                <strong>Troppo superficiale:</strong> L'AI non approfondisce abbastanza, rischiando di perdere
                informazioni critiche su bisogni reali e budget del prospect.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
              <Badge className="mb-2 bg-orange-500">Eccessivo (5x+)</Badge>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                <strong>Over-questioning:</strong> Troppi "perché" consecutivi possono irritare il prospect
                e far sembrare la conversazione innaturale o aggressiva.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
              <Badge className="mb-2 bg-blue-500">Activation Rate</Badge>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                <strong>Quando attivare:</strong> La ladder dovrebbe attivarsi quando il prospect dà risposte vaghe
                come "stiamo cercando di migliorare" o "vogliamo crescere". Rate ideale: {stats?.ladderActivationRate != null ? `${(stats.ladderActivationRate * 100).toFixed(0)}%` : 'N/A'}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}