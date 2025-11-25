import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { TrendingUp, TrendingDown, Users, Target, Clock, BarChart3 } from "lucide-react";

interface ExerciseCompletionTrendProps {
  data: {
    date: Date;
    completed: number;
    assigned: number;
    completionRate: number;
  }[];
  period: "daily" | "weekly" | "monthly";
  onPeriodChange: (period: "daily" | "weekly" | "monthly") => void;
}

export function ExerciseCompletionTrend({ data, period, onPeriodChange }: ExerciseCompletionTrendProps) {
  const chartData = data.map(item => ({
    date: item.date.toLocaleDateString('it-IT', {
      day: period === 'daily' ? '2-digit' : undefined,
      month: 'short',
      year: period === 'monthly' ? 'numeric' : undefined,
    }),
    completed: item.completed,
    assigned: item.assigned,
    completionRate: item.completionRate,
  }));

  const lastTwoPoints = chartData.slice(-2);
  const isIncreasing = lastTwoPoints.length === 2 && 
    lastTwoPoints[1].completionRate > lastTwoPoints[0].completionRate;

  return (
    <Card data-testid="chart-completion-trend">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading">Trend Completamento Esercizi</CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={period} onValueChange={onPeriodChange}>
              <SelectTrigger className="w-32" data-testid="select-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Giornaliero</SelectItem>
                <SelectItem value="weekly">Settimanale</SelectItem>
                <SelectItem value="monthly">Mensile</SelectItem>
              </SelectContent>
            </Select>
            <Badge 
              variant="outline" 
              className={isIncreasing ? "text-success border-success" : "text-destructive border-destructive"}
              data-testid="trend-indicator"
            >
              {isIncreasing ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {isIncreasing ? "In crescita" : "In calo"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis yAxisId="count" orientation="left" />
              <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background p-3 border rounded-lg shadow-lg">
                        <p className="font-medium">{label}</p>
                        <div className="space-y-1">
                          <p className="text-sm text-primary">
                            Completati: {payload[0]?.value}
                          </p>
                          <p className="text-sm text-secondary">
                            Assegnati: {payload[1]?.value}
                          </p>
                          <p className="text-sm text-accent">
                            Tasso: {payload[2]?.value}%
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Bar yAxisId="count" dataKey="completed" fill="hsl(var(--primary))" name="Completati" />
              <Bar yAxisId="count" dataKey="assigned" fill="hsl(var(--secondary))" name="Assegnati" />
              <Line 
                yAxisId="rate" 
                type="monotone" 
                dataKey="completionRate" 
                stroke="hsl(var(--accent))" 
                strokeWidth={3}
                name="Tasso Completamento (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface ClientEngagementChartProps {
  data: {
    date: Date;
    totalSessions: number;
    avgSessionDuration: number;
    totalLogins: number;
    activeClients: number;
  }[];
}

export function ClientEngagementChart({ data }: ClientEngagementChartProps) {
  const chartData = data.map(item => ({
    date: item.date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
    sessions: item.totalSessions,
    duration: Math.round(item.avgSessionDuration),
    logins: item.totalLogins,
    clients: item.activeClients,
  }));

  return (
    <Card data-testid="chart-client-engagement">
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center space-x-2">
          <Users size={20} />
          <span>Engagement Clienti</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="clientsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background p-3 border rounded-lg shadow-lg">
                        <p className="font-medium">{label}</p>
                        <div className="space-y-1">
                          <p className="text-sm text-primary">
                            Sessioni: {payload[0]?.value}
                          </p>
                          <p className="text-sm text-secondary">
                            Clienti Attivi: {payload[1]?.value}
                          </p>
                          <p className="text-sm text-accent">
                            Login: {payload[2]?.value}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Durata Media: {payload[3]?.value} min
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="sessions"
                stackId="1"
                stroke="hsl(var(--primary))"
                fill="url(#sessionsGradient)"
                name="Sessioni"
              />
              <Area
                type="monotone"
                dataKey="clients"
                stackId="2"
                stroke="hsl(var(--secondary))"
                fill="url(#clientsGradient)"
                name="Clienti Attivi"
              />
              <Line type="monotone" dataKey="logins" stroke="hsl(var(--accent))" name="Login" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface PerformanceDistributionProps {
  data: {
    client: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatar?: string;
    };
    performance: {
      completionRate: number;
      avgScore: number;
      engagementScore: number;
      streakDays: number;
    };
  }[];
}

export function PerformanceDistribution({ data }: PerformanceDistributionProps) {
  const chartData = data.map(item => ({
    name: `${item.client.firstName} ${item.client.lastName[0]}.`,
    completionRate: item.performance.completionRate,
    avgScore: item.performance.avgScore,
    engagement: item.performance.engagementScore,
    streak: item.performance.streakDays,
  }));

  return (
    <Card data-testid="chart-performance-distribution">
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center space-x-2">
          <Target size={20} />
          <span>Distribuzione Performance</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis domain={[0, 100]} />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background p-3 border rounded-lg shadow-lg">
                        <p className="font-medium">{label}</p>
                        <div className="space-y-1">
                          <p className="text-sm text-primary">
                            Completamento: {payload[0]?.value}%
                          </p>
                          <p className="text-sm text-secondary">
                            Punteggio Medio: {payload[1]?.value}%
                          </p>
                          <p className="text-sm text-accent">
                            Engagement: {payload[2]?.value}%
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Bar dataKey="completionRate" fill="hsl(var(--primary))" name="Tasso Completamento" />
              <Bar dataKey="avgScore" fill="hsl(var(--secondary))" name="Punteggio Medio" />
              <Bar dataKey="engagement" fill="hsl(var(--accent))" name="Engagement" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface CategoryCompletionProps {
  data: {
    category: string;
    completed: number;
    total: number;
    percentage: number;
  }[];
}

export function CategoryCompletion({ data }: CategoryCompletionProps) {
  const COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))',
    'hsl(var(--accent))',
    'hsl(var(--success))',
    'hsl(var(--warning))',
  ];

  const chartData = data.map((item, index) => ({
    name: item.category,
    value: item.completed,
    total: item.total,
    percentage: item.percentage,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <Card data-testid="chart-category-completion">
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center space-x-2">
          <BarChart3 size={20} />
          <span>Completamento per Categoria</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background p-3 border rounded-lg shadow-lg">
                        <p className="font-medium">{data.name}</p>
                        <div className="space-y-1">
                          <p className="text-sm">
                            Completati: {data.value}/{data.total}
                          </p>
                          <p className="text-sm">
                            Percentuale: {data.percentage}%
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface ClientScoreRadialProps {
  data: {
    client: {
      id: string;
      firstName: string;
      lastName: string;
    };
    performance: {
      completionRate: number;
      avgScore: number;
      engagementScore: number;
    };
  }[];
}

export function ClientScoreRadial({ data }: ClientScoreRadialProps) {
  const chartData = data.slice(0, 5).map((item, index) => ({
    name: `${item.client.firstName} ${item.client.lastName[0]}.`,
    score: item.performance.avgScore,
    completion: item.performance.completionRate,
    engagement: item.performance.engagementScore,
    fill: `hsl(${120 + index * 30}, 70%, 50%)`, // Different colors for each client
  }));

  return (
    <Card data-testid="chart-client-score-radial">
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center space-x-2">
          <Clock size={20} />
          <span>Top Clienti - Performance</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={chartData}>
              <RadialBar
                minAngle={15}
                label={{ position: 'insideStart', fill: '#fff' }}
                background
                clockWise
                dataKey="score"
              />
              <Legend 
                iconSize={10}
                wrapperStyle={{ fontSize: '12px' }}
                content={({ payload }) => (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {payload?.map((item: any, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <span 
                          className="w-2 h-2 rounded-full mr-1" 
                          style={{ backgroundColor: item.color }}
                        />
                        {item.value}
                      </Badge>
                    ))}
                  </div>
                )}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background p-3 border rounded-lg shadow-lg">
                        <p className="font-medium">{data.name}</p>
                        <div className="space-y-1">
                          <p className="text-sm">Punteggio: {data.score}%</p>
                          <p className="text-sm">Completamento: {data.completion}%</p>
                          <p className="text-sm">Engagement: {data.engagement}%</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Utility component for displaying chart statistics
interface ChartStatsProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  subtitle?: string;
}

export function ChartStats({ title, value, change, changeType = "neutral", icon, subtitle }: ChartStatsProps) {
  return (
    <Card data-testid="chart-stats">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {icon && (
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>
        {change && (
          <div className="flex items-center mt-4 text-sm">
            {changeType === "positive" ? (
              <TrendingUp className="text-success mr-1" size={16} />
            ) : changeType === "negative" ? (
              <TrendingDown className="text-destructive mr-1" size={16} />
            ) : null}
            <span className={
              changeType === "positive" ? "text-success" : 
              changeType === "negative" ? "text-destructive" : 
              "text-muted-foreground"
            }>
              {change}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}