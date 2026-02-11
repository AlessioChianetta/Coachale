import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from "lucide-react";

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
}

export interface ChartData {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'kpi';
  title: string;
  unit?: 'currency' | 'percentage' | 'number';
  data?: ChartDataPoint[];
  series?: ChartSeries[];
  value?: number;
  sourceTool?: string;
  metric?: string;
}

interface ChartBlockProps {
  chart: ChartData;
  compact?: boolean;
}

const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];

function formatChartValue(value: number, unit?: string): string {
  if (unit === 'currency') {
    return value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  if (unit === 'percentage') {
    return value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }
  return value.toLocaleString('it-IT');
}

function ChartTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'kpi': return <TrendingUp className="h-4 w-4 text-violet-500" />;
    case 'bar': return <BarChart3 className="h-4 w-4 text-violet-500" />;
    case 'line': return <LineChartIcon className="h-4 w-4 text-violet-500" />;
    case 'pie': return <PieChartIcon className="h-4 w-4 text-violet-500" />;
    default: return <BarChart3 className="h-4 w-4 text-violet-500" />;
  }
}

function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-semibold" style={{ color: entry.color || '#8b5cf6' }}>
          {entry.name ? `${entry.name}: ` : ''}{formatChartValue(entry.value, unit)}
        </p>
      ))}
    </div>
  );
}

function KpiCard({ chart, compact }: ChartBlockProps) {
  const displayValue = chart.value ?? chart.data?.[0]?.value ?? 0;
  return (
    <div className="w-full bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 rounded-xl border border-violet-200/50 dark:border-violet-800/30 p-5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-violet-500" />
        <span className="text-xs font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wide">
          {chart.metric || chart.title}
        </span>
      </div>
      <div className="text-center py-2">
        <p className={`font-bold text-gray-900 dark:text-white ${compact ? 'text-2xl' : 'text-3xl'}`}>
          {formatChartValue(displayValue, chart.unit)}
        </p>
      </div>
    </div>
  );
}

function BarChartBlock({ chart, compact }: ChartBlockProps) {
  const chartData = chart.data?.map(d => ({ name: d.label, value: d.value })) || [];
  const height = compact ? 200 : 280;
  const manyItems = chartData.length > 6;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: compact ? 0 : 10, bottom: manyItems ? 50 : 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            angle={manyItems ? -45 : 0}
            textAnchor={manyItems ? "end" : "middle"}
            height={manyItems ? 60 : 30}
          />
          {!compact && (
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatChartValue(v, chart.unit)}
              width={70}
            />
          )}
          <Tooltip content={<CustomTooltip unit={chart.unit} />} />
          <defs>
            <linearGradient id={`barGrad-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <Bar
            dataKey="value"
            fill={`url(#barGrad-${chart.id})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={50}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineChartBlock({ chart, compact }: ChartBlockProps) {
  const chartData = chart.data?.map(d => ({ name: d.label, value: d.value })) || [];
  const height = compact ? 200 : 280;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: compact ? 0 : 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
          {!compact && (
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => formatChartValue(v, chart.unit)}
              width={70}
            />
          )}
          <Tooltip content={<CustomTooltip unit={chart.unit} />} />
          <defs>
            <linearGradient id={`areaGrad-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill={`url(#areaGrad-${chart.id})`}
            dot={{ r: 4, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieChartBlock({ chart, compact }: ChartBlockProps) {
  const chartData = chart.data?.map((d, i) => ({
    name: d.label,
    value: d.value,
    color: d.color || CHART_COLORS[i % CHART_COLORS.length],
  })) || [];
  const height = compact ? 220 : 280;
  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  const renderLabel = ({ name, value, cx, x, y }: any) => {
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
    const anchor = x > cx ? 'start' : 'end';
    return (
      <text x={x} y={y} fill="#6b7280" textAnchor={anchor} dominantBaseline="central" fontSize={11}>
        {`${pct}%`}
      </text>
    );
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="45%"
            innerRadius="50%"
            outerRadius="80%"
            paddingAngle={2}
            label={renderLabel}
            labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip unit={chart.unit} />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartBlock({ chart, compact = false }: ChartBlockProps) {
  const hasData = chart.type === 'kpi'
    ? (chart.value != null || (chart.data && chart.data.length > 0))
    : (chart.data && chart.data.length > 0) || (chart.series && chart.series.length > 0);

  if (!hasData) return null;

  return (
    <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {chart.type !== 'kpi' && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <ChartTypeIcon type={chart.type} />
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
            {chart.title}
          </h4>
        </div>
      )}
      <div className={chart.type === 'kpi' ? '' : 'px-2 pb-3'}>
        {chart.type === 'kpi' && <KpiCard chart={chart} compact={compact} />}
        {chart.type === 'bar' && <BarChartBlock chart={chart} compact={compact} />}
        {chart.type === 'line' && <LineChartBlock chart={chart} compact={compact} />}
        {chart.type === 'pie' && <PieChartBlock chart={chart} compact={compact} />}
      </div>
    </div>
  );
}