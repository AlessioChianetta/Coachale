import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { useTrainingAnalytics, type ObjectionData } from '@/hooks/useTrainingAnalytics';

interface ObjectionHandlingTabProps {
  agentId: string;
}

export function ObjectionHandlingTab({ agentId }: ObjectionHandlingTabProps) {
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

  const objections = data?.objectionHandling?.objections || [];
  const totalObjections = data?.objectionHandling?.totalObjections || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Pattern Obiezioni - Frequenza & Resolution Rate
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Analisi delle obiezioni più comuni e quanto efficacemente l'AI le gestisce.
            {totalObjections > 0 && ` Totale obiezioni rilevate: ${totalObjections}`}
          </p>
        </CardHeader>
        <CardContent>
          {objections.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Nessuna obiezione rilevata
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Le obiezioni appariranno qui quando verranno registrate nelle conversazioni
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Obiezione
                    </th>
                    <th className="text-center p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Frequenza
                    </th>
                    <th className="text-center p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Risolte
                    </th>
                    <th className="text-center p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Non Risolte
                    </th>
                    <th className="text-center p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Resolution Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {objections.map((obj, idx) => (
                    <tr 
                      key={idx}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="p-3 text-sm text-gray-900 dark:text-white font-medium capitalize">
                        {obj.objection}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline">{obj.frequency}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-400">{obj.resolved}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-600 dark:text-red-400">{obj.notResolved}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge 
                          className={`${
                            obj.resolutionRate >= 70 
                              ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' 
                              : obj.resolutionRate >= 50
                              ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300'
                              : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {obj.resolutionRate.toFixed(0)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
            Pattern Script Vincenti per Obiezioni
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 p-3 rounded">
              <h5 className="text-sm font-semibold mb-1 text-green-700 dark:text-green-400">
                ✅ Cosa Funziona
              </h5>
              <ul className="text-xs space-y-1 text-gray-700 dark:text-gray-300 list-disc ml-4">
                <li>Acknowledgment empatico ("Capisco...")</li>
                <li>Reframe con valore quantificato (ROI, risparmio tempo)</li>
                <li>Social proof ("Altri clienti nella tua situazione...")</li>
                <li>Domande di approfondimento (tecnica ladder)</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded">
              <h5 className="text-sm font-semibold mb-1 text-red-700 dark:text-red-400">
                ❌ Cosa Evitare
              </h5>
              <ul className="text-xs space-y-1 text-gray-700 dark:text-gray-300 list-disc ml-4">
                <li>Risposta generica senza personalizzazione</li>
                <li>Insistere senza capire il vero motivo</li>
                <li>Sconto immediato (devalorizza l'offerta)</li>
                <li>Ignorare l'obiezione e proseguire lo script</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
