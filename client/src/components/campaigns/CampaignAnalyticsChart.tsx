import { format } from 'date-fns';
import it from 'date-fns/locale/it';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface AnalyticsData {
  date: string;
  leads_created: number;
  leads_contacted: number;
  leads_responded: number;
  leads_converted: number;
}

interface CampaignAnalyticsChartProps {
  data: AnalyticsData[];
}

export default function CampaignAnalyticsChart({ data }: CampaignAnalyticsChartProps) {
  const chartData = data.map((item) => ({
    date: format(new Date(item.date), 'dd MMM', { locale: it }),
    'Lead Creati': item.leads_created,
    'Contattati': item.leads_contacted,
    'Risposte': item.leads_responded,
    'Convertiti': item.leads_converted,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: '20px',
            }}
          />
          <Line
            type="monotone"
            dataKey="Lead Creati"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Contattati"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Risposte"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Convertiti"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
