import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  TrendingUp,
  Target,
  CheckCircle2,
  Coffee,
  Smile,
  Calendar,
  Plus,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { useMomentumSnapshot } from '@/hooks/use-momentum-snapshot';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format, startOfWeek } from 'date-fns';
import it from 'date-fns/locale/it';

interface MomentumSidebarProps {
  onOpenCheckin: () => void;
  onSwitchToMomentum: () => void;
}

interface WeeklyStats {
  date: string;
  totalCheckins: number;
  productiveCheckins: number;
  productivityScore: number;
}

interface DailyStats {
  date: string;
  totalCheckins: number;
  productiveCheckins: number;
  productivityScore: number;
  categoriesBreakdown: Record<string, number>;
  averageMood: number | null;
  averageEnergy: number | null;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
}

export default function MomentumSidebar({
  onOpenCheckin,
  onSwitchToMomentum,
}: MomentumSidebarProps) {
  // Collapse state from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('momentum-sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('momentum-sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Fetch data
  const { streak, todayCheckins, productivityScore, isLoading: isLoadingSnapshot } = useMomentumSnapshot();

  const today = new Date().toISOString().split('T')[0];
  const { data: dailyStats, isLoading: isLoadingDaily } = useQuery<DailyStats>({
    queryKey: ['/api/momentum/checkins/daily-stats', today],
    queryFn: async () => {
      const response = await fetch(
        `/api/momentum/checkins/daily-stats?date=${today}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch daily stats');
      return response.json();
    },
  });

  const { data: weeklyStats, isLoading: isLoadingWeekly } = useQuery<WeeklyStats[]>({
    queryKey: ['/api/momentum/checkins/weekly-stats'],
    queryFn: async () => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const response = await fetch(
        `/api/momentum/checkins/weekly-stats?weekStart=${weekStart.toISOString().split('T')[0]}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch weekly stats');
      return response.json();
    },
  });

  const { data: activeGoals = [], isLoading: isLoadingGoals } = useQuery<Goal[]>({
    queryKey: ['/api/momentum/goals', 'active', { limit: 3 }],
    queryFn: async () => {
      const response = await fetch('/api/momentum/goals?status=active&limit=3', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    },
  });

  const productiveCheckins = dailyStats?.productiveCheckins ?? 0;
  const breakCheckins = todayCheckins - productiveCheckins;
  const averageMood = dailyStats?.averageMood;

  // Prepare chart data - ensure we have 7 days
  const chartData = weeklyStats?.map((stat) => ({
    name: format(new Date(stat.date), 'EEE', { locale: it }).toLowerCase(),
    value: Math.round(stat.productivityScore || 0),
  })) ?? [];
  
  // Check if we have any non-zero data
  const hasData = chartData.some(d => d.value > 0);

  if (isCollapsed) {
    return (
      <div className="hidden md:flex flex-col items-center border-l bg-white dark:bg-gray-800 p-2 w-12">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex flex-col items-center gap-4 mt-6">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold hover:scale-110 transition-transform duration-200 cursor-default">
            {productivityScore}
          </div>
          <div className="writing-mode-vertical text-xs text-gray-600 dark:text-gray-400 font-medium transform rotate-180">
            Momentum
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className="hidden md:flex flex-col border-l bg-gray-50 dark:bg-gray-800 w-80 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#1a73e8] transition-transform duration-200 hover:scale-110" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Momentum</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(true)}
          className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 active:scale-95"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Today Section */}
        <Card className="border shadow-sm hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-default">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Calendar className="h-4 w-4" />
              Oggi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Productivity Score - Circular */}
            {isLoadingSnapshot || isLoadingDaily ? (
              <div className="flex justify-center py-4">
                <Skeleton className="w-24 h-24 rounded-full" />
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24">
                  <svg className="transform -rotate-90 w-24 h-24">
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 44}`}
                      strokeDashoffset={`${2 * Math.PI * 44 * (1 - productivityScore / 100)}`}
                      className={`${
                        productivityScore >= 80
                          ? 'text-green-500'
                          : productivityScore >= 60
                          ? 'text-blue-500'
                          : productivityScore >= 40
                          ? 'text-orange-500'
                          : 'text-red-500'
                      } transition-all duration-500`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white animate-count-up">
                      {productivityScore}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Produttività</p>
              </div>
            )}

            {/* Check-ins breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-gray-700 dark:text-gray-300">Produttivi</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {isLoadingDaily ? '...' : productiveCheckins}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-gray-700 dark:text-gray-300">Pause</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {isLoadingDaily ? '...' : breakCheckins}
                </span>
              </div>
            </div>

            {/* Average Mood */}
            {averageMood !== null && averageMood !== undefined && (
              <div className="pt-2 border-t dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Smile className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                    <span className="text-gray-700 dark:text-gray-300">Umore</span>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-lg ${
                          star <= averageMood
                            ? 'text-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Trend Section */}
        <Card className="border shadow-sm hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-default">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <TrendingUp className="h-4 w-4" />
              Andamento Settimana
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingWeekly ? (
              <Skeleton className="w-full h-40" />
            ) : !hasData || chartData.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nessun dato questa settimana
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Inizia a fare check-in per vedere il tuo andamento
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    stroke="#6b7280"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#6b7280"
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Score']}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.value >= 80
                            ? '#10b981'
                            : entry.value >= 60
                            ? '#3b82f6'
                            : entry.value >= 40
                            ? '#f97316'
                            : '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Active Goals Section */}
        <Card className="border shadow-sm hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-default">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Target className="h-4 w-4" />
              Obiettivi Attivi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingGoals ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="w-full h-16" />
                ))}
              </div>
            ) : activeGoals.length > 0 ? (
              <div className="space-y-3">
                {activeGoals.map((goal) => {
                  const progress = Math.min(
                    (goal.currentValue / goal.targetValue) * 100,
                    100
                  );
                  return (
                    <div
                      key={goal.id}
                      className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-[#1a73e8] dark:hover:border-[#1a73e8] hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                          {goal.title}
                        </h4>
                        <Badge
                          variant={goal.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs ml-2 shrink-0"
                        >
                          {goal.status}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <Progress value={progress} className="h-2 animate-fill" />
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>
                            {goal.currentValue} / {goal.targetValue} {goal.unit}
                          </span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <Target className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nessun obiettivo attivo
                </p>
                <Button
                  variant="link"
                  onClick={onSwitchToMomentum}
                  className="text-[#1a73e8] mt-2"
                  size="sm"
                >
                  Crea un obiettivo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Footer */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t p-4 space-y-2">
        <Button
          onClick={onOpenCheckin}
          className="w-full bg-[#1a73e8] hover:bg-[#1557b0] hover:brightness-105 text-white gap-2 shadow-sm transition-all duration-150 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Fai Check-in
        </Button>
        <Button
          onClick={onSwitchToMomentum}
          variant="outline"
          className="w-full gap-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 active:scale-95"
        >
          <Zap className="h-4 w-4" />
          Vai a Momentum
        </Button>
      </div>
    </aside>
  );
}
