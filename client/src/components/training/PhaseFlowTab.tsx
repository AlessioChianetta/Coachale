import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTrainingAnalytics } from '@/hooks/useTrainingAnalytics';

interface PhaseFlowTabProps {
  agentId: string;
}

const PHASE_NAMES: Record<string, string> = {
  'phase_1_2': 'Intro & Discovery',
  'phase_3': 'Demo & Presentazione',
  'phase_4': 'Gestione Obiezioni',
  'phase_5': 'Closing',
  'phase_6_7_8': 'Follow-up & Converted',
};

export function PhaseFlowTab({ agentId }: PhaseFlowTabProps) {
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

  const phaseRates = data?.phaseFlow?.phaseCompletionRates || {};
  const totalConv = data?.phaseFlow?.totalConversations || 0;

  const funnelData = [
    {
      name: PHASE_NAMES['phase_1_2'],
      value: (phaseRates['phase_1_2'] || 0) * 100,
      count: Math.round((phaseRates['phase_1_2'] || 0) * totalConv),
      phase: 'phase_1_2',
    },
    {
      name: PHASE_NAMES['phase_3'],
      value: (phaseRates['phase_3'] || 0) * 100,
      count: Math.round((phaseRates['phase_3'] || 0) * totalConv),
      phase: 'phase_3',
    },
    {
      name: PHASE_NAMES['phase_4'],
      value: (phaseRates['phase_4'] || 0) * 100,
      count: Math.round((phaseRates['phase_4'] || 0) * totalConv),
      phase: 'phase_4',
    },
    {
      name: PHASE_NAMES['phase_5'],
      value: (phaseRates['phase_5'] || 0) * 100,
      count: Math.round((phaseRates['phase_5'] || 0) * totalConv),
      phase: 'phase_5',
    },
    {
      name: PHASE_NAMES['phase_6_7_8'],
      value: (phaseRates['phase_6_7_8'] || 0) * 100,
      count: Math.round((phaseRates['phase_6_7_8'] || 0) * totalConv),
      phase: 'phase_6_7_8',
    },
  ];

  const getColorByRate = (rate: number): string => {
    if (rate >= 70) return '#10b981';
    if (rate >= 40) return '#f59e0b'; 
    return '#ef4444';
  };

  const calculateDropoff = (currentRate: number, previousRate: number): number => {
    if (previousRate === 0) return 0;
    return ((previousRate - currentRate) / previousRate) * 100;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Phase Flow Funnel - Conversion tra Fasi
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Analizza il flusso delle conversazioni attraverso le fasi dello script.
            Identifica dove i prospect abbandonano per ottimizzare il tuo approccio.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                        <p className="font-semibold">{data.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Completamento: {data.value.toFixed(1)}%
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Conversazioni: {data.count}/{totalConv}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColorByRate(entry.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {funnelData.map((phase, idx) => {
          const previousPhase = idx > 0 ? funnelData[idx - 1] : null;
          const dropoff = previousPhase ? calculateDropoff(phase.value, previousPhase.value) : 0;
          
          return (
            <Card key={phase.phase} className="bg-white dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">{phase.name}</h4>
                  <Badge 
                    variant="outline"
                    className={`${
                      phase.value >= 70 
                        ? 'bg-green-50 dark:bg-green-950 border-green-500 text-green-700 dark:text-green-300' 
                        : phase.value >= 40
                        ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-500 text-yellow-700 dark:text-yellow-300'
                        : 'bg-red-50 dark:bg-red-950 border-red-500 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {phase.value.toFixed(1)}%
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span>{phase.count} / {totalConv} conversazioni</span>
                </div>

                {previousPhase && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-xs">
                      {dropoff > 50 ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : dropoff > 20 ? (
                        <Minus className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      )}
                      <span className={`${
                        dropoff > 50 ? 'text-red-600' : dropoff > 20 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {dropoff > 0 ? `-${dropoff.toFixed(1)}%` : 'Stabile'} vs fase precedente
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <ArrowRight className="h-4 w-4" />
            Come Interpretare il Funnel
          </h4>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
            <li><strong>Verde (&gt;70%):</strong> Fase performante - la maggior parte dei prospect procede</li>
            <li><strong>Giallo (40-70%):</strong> Zona d'attenzione - c'è margine di miglioramento</li>
            <li><strong>Rosso (&lt;40%):</strong> Punto critico - molti prospect abbandonano qui</li>
            <li><strong>Drop-off elevato:</strong> Identifica la fase dove ottimizzare script/approccio</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
