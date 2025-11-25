import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';

interface DailyStats {
  date: string;
  totalCheckins: number;
  productiveCheckins: number;
  productivityScore: number;
  categoriesBreakdown: Record<string, number>;
  averageMood: number | null;
  averageEnergy: number | null;
}

interface StreakData {
  streak: number;
}

interface MomentumSnapshot {
  streak: number;
  todayCheckins: number;
  productivityScore: number;
  isLoading: boolean;
}

export function useMomentumSnapshot(): MomentumSnapshot {
  const today = new Date().toISOString().split('T')[0];

  // Fetch current streak
  const { data: streakData, isLoading: isLoadingStreak } = useQuery<StreakData>({
    queryKey: ['/api/momentum/checkins/current-streak'],
    queryFn: async () => {
      const response = await fetch('/api/momentum/checkins/current-streak', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch streak');
      return response.json();
    },
    // Cache for 5 minutes, refetch in background
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch today's stats
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
    // Cache for 2 minutes, refetch in background
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  return {
    streak: streakData?.streak ?? 0,
    todayCheckins: dailyStats?.totalCheckins ?? 0,
    productivityScore: dailyStats?.productivityScore ?? 0,
    isLoading: isLoadingStreak || isLoadingDaily,
  };
}
