import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';

interface MomentumSettings {
  userId: string;
  checkinIntervalMinutes: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  notificationsEnabled: boolean;
  defaultProductiveCategories: string[];
  defaultBreakCategories: string[];
}

export function useCheckinScheduler() {
  const [showCheckinReminder, setShowCheckinReminder] = useState(false);
  const [nextCheckinTime, setNextCheckinTime] = useState<Date | null>(null);
  const [isInQuietHours, setIsInQuietHours] = useState(false);

  // Fetch user settings
  const { data: settings } = useQuery<MomentumSettings>({
    queryKey: ['/api/momentum/settings'],
    queryFn: async () => {
      const response = await fetch('/api/momentum/settings', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
    refetchInterval: 60000, // Refresh settings every minute
  });

  // Fetch last check-in
  const { data: lastCheckins } = useQuery({
    queryKey: ['/api/momentum/checkins', { limit: 1 }],
    queryFn: async () => {
      const response = await fetch('/api/momentum/checkins?limit=1', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch check-ins');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Check if current time is in quiet hours
  const checkQuietHours = useCallback((quietStart: string, quietEnd: string): boolean => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = quietStart.split(':').map(Number);
    const [endHour, endMin] = quietEnd.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle quiet hours that span midnight
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }
    
    return currentTime >= startTime && currentTime < endTime;
  }, []);

  // Calculate next check-in time
  useEffect(() => {
    if (!settings || !settings.notificationsEnabled) {
      setNextCheckinTime(null);
      return;
    }

    const lastCheckin = lastCheckins && lastCheckins.length > 0 ? lastCheckins[0] : null;
    const intervalMs = settings.checkinIntervalMinutes * 60 * 1000;

    if (lastCheckin) {
      const lastTime = new Date(lastCheckin.timestamp);
      const next = new Date(lastTime.getTime() + intervalMs);
      setNextCheckinTime(next);
    } else {
      // No check-ins yet, schedule one now
      setNextCheckinTime(new Date());
    }
  }, [settings, lastCheckins]);

  // Schedule reminder
  useEffect(() => {
    if (!settings || !nextCheckinTime || !settings.notificationsEnabled) {
      return;
    }

    const checkAndSchedule = () => {
      const now = new Date();
      const timeUntilNext = nextCheckinTime.getTime() - now.getTime();

      // Check if in quiet hours
      if (settings.quietHoursEnabled) {
        const inQuiet = checkQuietHours(settings.quietHoursStart, settings.quietHoursEnd);
        setIsInQuietHours(inQuiet);
        
        if (inQuiet) {
          setShowCheckinReminder(false);
          return;
        }
      }

      // Show reminder if time has passed
      if (timeUntilNext <= 0) {
        setShowCheckinReminder(true);
      } else {
        setShowCheckinReminder(false);
      }
    };

    // Check immediately
    checkAndSchedule();

    // Set up interval to check every 30 seconds
    const interval = setInterval(checkAndSchedule, 30000);

    return () => clearInterval(interval);
  }, [settings, nextCheckinTime, checkQuietHours]);

  const dismissReminder = useCallback(() => {
    setShowCheckinReminder(false);
    
    // Reschedule for next interval
    if (settings) {
      const next = new Date(Date.now() + settings.checkinIntervalMinutes * 60 * 1000);
      setNextCheckinTime(next);
    }
  }, [settings]);

  const snoozeReminder = useCallback((minutes: number) => {
    setShowCheckinReminder(false);
    const next = new Date(Date.now() + minutes * 60 * 1000);
    setNextCheckinTime(next);
  }, []);

  return {
    showCheckinReminder,
    nextCheckinTime,
    isInQuietHours,
    dismissReminder,
    snoozeReminder,
    settings,
  };
}
