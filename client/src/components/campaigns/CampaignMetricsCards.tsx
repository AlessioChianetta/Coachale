import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, MessageSquare, Reply, CheckCircle2, TrendingUp } from 'lucide-react';

interface CampaignMetrics {
  totalLeads: number;
  totalContacted: number;
  totalResponded: number;
  totalConverted: number;
  conversionRate: number;
}

interface CampaignMetricsCardsProps {
  metrics: CampaignMetrics;
}

export default function CampaignMetricsCards({ metrics }: CampaignMetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Lead Totali
          </CardTitle>
          <UserPlus className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{metrics.totalLeads}</div>
          <p className="text-xs text-gray-500 mt-1">Lead nella campagna</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Contattati
          </CardTitle>
          <MessageSquare className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{metrics.totalContacted}</div>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.totalLeads > 0
              ? `${((metrics.totalContacted / metrics.totalLeads) * 100).toFixed(1)}% del totale`
              : 'Nessun lead'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Risposte
          </CardTitle>
          <Reply className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{metrics.totalResponded}</div>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.totalContacted > 0
              ? `${((metrics.totalResponded / metrics.totalContacted) * 100).toFixed(1)}% dei contattati`
              : 'Nessun lead contattato'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Convertiti
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{metrics.totalConverted}</div>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.totalLeads > 0
              ? `${((metrics.totalConverted / metrics.totalLeads) * 100).toFixed(1)}% del totale`
              : 'Nessun lead'}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-800">
            Conversion Rate
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-900">
            {metrics.conversionRate.toFixed(1)}%
          </div>
          <p className="text-xs text-green-700 mt-1">
            Performance complessiva
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
