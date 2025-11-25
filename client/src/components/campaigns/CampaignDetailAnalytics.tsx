import { lazy, Suspense } from 'react';
import { useCampaignAnalytics } from '@/hooks/useCampaigns';
import CampaignMetricsCards from './CampaignMetricsCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import it from 'date-fns/locale/it';

const CampaignAnalyticsChart = lazy(() => import('./CampaignAnalyticsChart'));

interface CampaignDetailAnalyticsProps {
  campaignId: string;
  campaignName?: string;
}

export default function CampaignDetailAnalytics({
  campaignId,
  campaignName,
}: CampaignDetailAnalyticsProps) {
  const { data: analyticsData, isLoading, error } = useCampaignAnalytics(campaignId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Errore nel caricamento delle analytics</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nessun dato disponibile</p>
      </div>
    );
  }

  const { daily_metrics, totals } = analyticsData;

  const metrics = {
    totalLeads: totals.total_leads || 0,
    totalContacted: totals.total_contacted || 0,
    totalResponded: totals.total_responded || 0,
    totalConverted: totals.total_converted || 0,
    conversionRate:
      totals.total_leads > 0
        ? (totals.total_converted / totals.total_leads) * 100
        : 0,
  };

  return (
    <div className="space-y-6">
      {campaignName && (
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Analytics: {campaignName}
          </h3>
        </div>
      )}

      <CampaignMetricsCards metrics={metrics} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Andamento nel Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {daily_metrics && daily_metrics.length > 0 ? (
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
              <CampaignAnalyticsChart data={daily_metrics} />
            </Suspense>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Nessun dato giornaliero disponibile
            </div>
          )}
        </CardContent>
      </Card>

      {daily_metrics && daily_metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dettaglio Giornaliero</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Data</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">Creati</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">Contattati</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">Risposte</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">Convertiti</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {daily_metrics.map((metric, index) => {
                    const convRate =
                      metric.leads_created > 0
                        ? ((metric.leads_converted / metric.leads_created) * 100).toFixed(1)
                        : '0.0';
                    
                    return (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">
                          {format(new Date(metric.date), 'dd MMM yyyy', { locale: it })}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant="outline">{metric.leads_created}</Badge>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant="outline">{metric.leads_contacted}</Badge>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant="outline">{metric.leads_responded}</Badge>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {metric.leads_converted}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-center font-semibold text-green-700">
                          {convRate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
