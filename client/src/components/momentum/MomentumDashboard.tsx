import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  Flame,
  Target,
  Plus,
  Calendar as CalendarIcon,
  Settings,
  Activity,
  Zap,
  Brain,
  Clock,
  CheckCircle2,
  Coffee,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import it from 'date-fns/locale/it';

interface DailyStats {
  date: string;
  totalCheckins: number;
  productiveCheckins: number;
  productivityScore: number;
  categoriesBreakdown: Record<string, number>;
  averageMood: number | null;
  averageEnergy: number | null;
}

interface WeeklyStats {
  date: string;
  totalCheckins: number;
  productiveCheckins: number;
  productivityScore: number;
}

interface MomentumDashboardProps {
  onOpenCheckin: () => void;
  onOpenCalendar: () => void;
  onOpenGoals: () => void;
  onOpenSettings: () => void;
}

export default function MomentumDashboard({
  onOpenCheckin,
  onOpenCalendar,
  onOpenGoals,
  onOpenSettings,
}: MomentumDashboardProps) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Fetch daily stats
  const { data: dailyStats } = useQuery<DailyStats>({
    queryKey: ['/api/momentum/checkins/daily-stats', selectedDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/momentum/checkins/daily-stats?date=${selectedDate}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch daily stats');
      return response.json();
    },
  });

  // Fetch weekly stats
  const { data: weeklyStats } = useQuery<WeeklyStats[]>({
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

  // Fetch current streak
  const { data: streakData } = useQuery<{ streak: number }>({
    queryKey: ['/api/momentum/checkins/current-streak'],
    queryFn: async () => {
      const response = await fetch('/api/momentum/checkins/current-streak', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch streak');
      return response.json();
    },
  });

  // Fetch active goals
  const { data: activeGoals = [] } = useQuery({
    queryKey: ['/api/momentum/goals', 'active'],
    queryFn: async () => {
      const response = await fetch('/api/momentum/goals?status=active', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    },
  });

  // Fetch recent check-ins
  const { data: recentCheckins = [] } = useQuery({
    queryKey: ['/api/momentum/checkins', { limit: 10 }],
    queryFn: async () => {
      const response = await fetch('/api/momentum/checkins?limit=10', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch check-ins');
      return response.json();
    },
  });

  // Sync check-ins to calendar
  const syncCheckinToCalendar = async (checkin: any) => {
    try {
      const startTime = new Date(checkin.timestamp);
      const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 minutes default

      const calendarEvent = {
        title: `${checkin.isProductive ? '✅' : '☕'} ${checkin.activityDescription}`,
        description: checkin.notes || '',
        start: startTime,
        end: endTime,
        allDay: false,
        color: checkin.isProductive ? '#10b981' : '#f97316', // Green for productive, orange for breaks
      };

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(calendarEvent),
      });

      if (!response.ok) throw new Error('Failed to sync to calendar');
      return response.json();
    } catch (error) {
      console.error('Error syncing check-in to calendar:', error);
      throw error;
    }
  };

  const productivityScore = dailyStats?.productivityScore ?? 0;
  const streak = streakData?.streak ?? 0;
  const totalCheckins = dailyStats?.totalCheckins ?? 0;
  const productiveCheckins = dailyStats?.productiveCheckins ?? 0;

  // Prepare chart data
  const chartData = weeklyStats?.map((stat) => ({
    name: format(new Date(stat.date), 'EEE', { locale: it }),
    produttivi: stat.productiveCheckins || 0,
    pause: (stat.totalCheckins || 0) - (stat.productiveCheckins || 0),
    score: stat.productivityScore || 0,
  })) ?? [];

  // Get insights based on data
  const getInsights = () => {
    const insights = [];

    if (streak >= 7) {
      insights.push({
        icon: Sparkles,
        text: `Incredibile! Hai mantenuto ${streak} giorni di streak consecutivi!`,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
      });
    } else if (streak >= 3) {
      insights.push({
        icon: Flame,
        text: `Ottimo lavoro! ${streak} giorni di fila, continua così!`,
        color: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-900/20',
      });
    }

    if (productivityScore >= 80) {
      insights.push({
        icon: TrendingUp,
        text: 'Produttività eccellente oggi! Mantieni questo ritmo.',
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-900/20',
      });
    } else if (productivityScore >= 60) {
      insights.push({
        icon: Activity,
        text: 'Buona produttività, ma c\'è margine di miglioramento.',
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
      });
    } else if (totalCheckins > 0) {
      insights.push({
        icon: Coffee,
        text: 'Sembra una giornata tranquilla. Ricorda di fare pause regolari!',
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
      });
    }

    if (dailyStats?.averageMood && dailyStats.averageMood >= 4) {
      insights.push({
        icon: Brain,
        text: 'Il tuo umore è ottimo! L\'energia positiva aumenta la produttività.',
        color: 'text-pink-600 dark:text-pink-400',
        bg: 'bg-pink-50 dark:bg-pink-900/20',
      });
    }

    return insights;
  };

  const insights = getInsights();

  return (
    <div className="space-y-6">
      {/* Header con Quick Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="h-8 w-8 text-blue-600" />
            Momentum
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Registra cosa stai facendo ogni 30-60 minuti con un check-in per costruire consapevolezza e mantenere lo slancio
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Button 
            onClick={onOpenCheckin} 
            size="lg"
            className="gap-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 text-base font-semibold px-8 py-6 flex-1 md:flex-initial"
          >
            <Plus className="h-6 w-6" />
            Nuovo Check-in
          </Button>
          <Button onClick={onOpenSettings} variant="outline" size="lg" className="px-4">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Metriche Real-Time */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Punteggio Produttività */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Produttività Oggi
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <div className="relative w-32 h-32">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - productivityScore / 100)}`}
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
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {productivityScore}%
                  </span>
                </div>
              </div>
            </div>
            <Progress value={productivityScore} className="mt-2" />
          </CardContent>
        </Card>

        {/* Streak */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Streak Giorni
            </CardTitle>
            <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <div className="flex items-center justify-center gap-3">
                <Flame className="h-16 w-16 text-orange-500 animate-pulse" />
                <div className="text-6xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  {streak}
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                {streak >= 7 ? 'Straordinario! 🎉' : streak >= 3 ? 'Continua così! 💪' : 'Inizia una nuova streak!'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Attività Oggi */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Attività Oggi
            </CardTitle>
            <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
                {totalCheckins}
              </div>
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {productiveCheckins} produttivi
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Coffee className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {totalCheckins - productiveCheckins} pause
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendario Visivo Check-in */}
      <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
              Calendario Check-in
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(calendarMonth, 'MMMM yyyy', { locale: it })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-2 text-center">
              {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
                <div key={day} className="text-xs font-semibold text-gray-600 dark:text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const monthStart = startOfMonth(calendarMonth);
                const monthEnd = endOfMonth(calendarMonth);
                const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
                const endDate = endOfMonth(monthEnd);
                const days = eachDayOfInterval({ start: startDate, end: endDate });
                
                return days.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayCheckins = recentCheckins.filter((c: any) => 
                    format(new Date(c.timestamp), 'yyyy-MM-dd') === dateStr
                  );
                  const productiveCount = dayCheckins.filter((c: any) => c.isProductive).length;
                  const breakCount = dayCheckins.length - productiveCount;
                  const isCurrentMonth = isSameMonth(day, calendarMonth);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`
                        relative p-3 rounded-lg border transition-all duration-200
                        ${!isCurrentMonth ? 'opacity-30' : 'opacity-100'}
                        ${isToday ? 'border-blue-600 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700'}
                        ${selectedDate === dateStr ? 'ring-2 ring-blue-600' : ''}
                        hover:bg-gray-50 dark:hover:bg-gray-800
                      `}
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {format(day, 'd')}
                      </div>
                      {dayCheckins.length > 0 && (
                        <div className="flex gap-1 justify-center mt-1">
                          {productiveCount > 0 && (
                            <div className="flex items-center gap-0.5">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">{productiveCount}</span>
                            </div>
                          )}
                          {breakCount > 0 && (
                            <div className="flex items-center gap-0.5">
                              <div className="w-2 h-2 rounded-full bg-orange-500" />
                              <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">{breakCount}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                });
              })()}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Check-in produttivi</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Pause</span>
              </div>
            </div>

            {/* Detailed Check-ins Table for Selected Date */}
            {selectedDate && (() => {
              const dayCheckins = recentCheckins.filter((c: any) => 
                format(new Date(c.timestamp), 'yyyy-MM-dd') === selectedDate
              ).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

              if (dayCheckins.length === 0) return null;

              return (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Check-in del {format(new Date(selectedDate), 'dd MMMM yyyy', { locale: it })}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Ora</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Cosa ho fatto</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Tipo</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Categoria</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Umore</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Energia</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayCheckins.map((checkin: any) => (
                          <tr 
                            key={checkin.id}
                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                              {format(new Date(checkin.timestamp), 'HH:mm', { locale: it })} - {format(new Date(new Date(checkin.timestamp).getTime() + 30 * 60000), 'HH:mm', { locale: it })}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                              {checkin.activityDescription}
                            </td>
                            <td className="py-3 px-4">
                              {checkin.isProductive ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Produttivo
                                </Badge>
                              ) : (
                                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                                  <Coffee className="h-3 w-3 mr-1" />
                                  Pausa
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              {checkin.category || '-'}
                            </td>
                            <td className="py-3 px-4">
                              {checkin.mood ? (
                                <div className="flex items-center justify-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <div
                                      key={i}
                                      className={`w-2 h-2 rounded-full ${
                                        i < checkin.mood ? 'bg-pink-500' : 'bg-gray-300 dark:bg-gray-600'
                                      }`}
                                    />
                                  ))}
                                  <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                                    {checkin.mood}/5
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {checkin.energyLevel ? (
                                <div className="flex items-center justify-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <div
                                      key={i}
                                      className={`w-2 h-2 rounded-full ${
                                        i < checkin.energyLevel ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                                      }`}
                                    />
                                  ))}
                                  <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                                    {checkin.energyLevel}/5
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                              {checkin.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Insights e Obiettivi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Insights */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length > 0 ? (
              insights.map((insight, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg ${insight.bg} flex items-start gap-3 hover:scale-105 transition-transform duration-200`}
                >
                  <insight.icon className={`h-5 w-5 ${insight.color} mt-0.5`} />
                  <p className={`text-sm font-medium ${insight.color}`}>{insight.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                Registra il tuo primo check-in per vedere insights personalizzati!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Obiettivi Attivi */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Obiettivi Attivi
            </CardTitle>
            <Button onClick={onOpenGoals} variant="ghost" size="sm">
              Vedi tutti
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeGoals.length > 0 ? (
              activeGoals.slice(0, 3).map((goal: any) => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {goal.title}
                    </span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {goal.progress}%
                    </span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                  {goal.targetDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Scadenza: {format(new Date(goal.targetDate), 'dd MMM yyyy', { locale: it })}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Nessun obiettivo attivo
                </p>
                <Button onClick={onOpenGoals} variant="outline" size="sm">
                  Crea il tuo primo obiettivo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Bottom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          onClick={onOpenCalendar}
          variant="outline"
          className="h-20 justify-start gap-4 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200"
        >
          <CalendarIcon className="h-8 w-8 text-blue-600" />
          <div className="text-left">
            <div className="font-semibold text-gray-900 dark:text-white">Vista Calendario</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Compila slot temporali retroattivamente
            </div>
          </div>
        </Button>

        <Button
          onClick={onOpenGoals}
          variant="outline"
          className="h-20 justify-start gap-4 hover:bg-purple-50 dark:hover:bg-purple-950 transition-all duration-200"
        >
          <Target className="h-8 w-8 text-purple-600" />
          <div className="text-left">
            <div className="font-semibold text-gray-900 dark:text-white">Gestisci Obiettivi</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Crea e traccia i tuoi obiettivi a lungo termine
            </div>
          </div>
        </Button>
      </div>
    </div>
  );
}
