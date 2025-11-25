import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import type { User } from "@shared/schema";

export interface ClientPriorityData {
  client: User;
  priorityScore: number;
  priorityLevel: "high" | "medium" | "low"; // 3 livelli: Alta, Media, Bassa
  inactiveDays: number;
  pendingExercises: number;
  exercisesToReview: number;
  emailJourneyPending: number;
  whatsappUnread: number;
  universityPerformanceDrop: boolean;
  isOnline: boolean;
  momentumStreak: number;
  lastActivity?: Date;
  reasons: string[];
}

export function useClientPriorityScore() {
  // Fetch all required data in parallel
  const { data: clients = [], isError: clientsError, error: clientsErr } = useQuery<User[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const { data: assignments = [], isError: assignmentsError, error: assignmentsErr } = useQuery<any[]>({
    queryKey: ["/api/exercise-assignments/consultant"],
    queryFn: async () => {
      const response = await fetch("/api/exercise-assignments/consultant", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch assignments");
      return response.json();
    },
  });

  const { data: activeSessions = [], isError: sessionsError, error: sessionsErr } = useQuery<any[]>({
    queryKey: ["/api/activity/sessions/active"],
    queryFn: async () => {
      const response = await fetch("/api/activity/sessions/active", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch active sessions");
      return response.json();
    },
    refetchInterval: 30000, // 30s refresh for real-time
  });

  const { data: activityLogs = [], isError: activityError, error: activityErr } = useQuery<any[]>({
    queryKey: ["/api/activity/clients"],
    queryFn: async () => {
      const response = await fetch("/api/activity/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch activity logs");
      return response.json();
    },
    retry: false,
  });

  const { data: emailJourneyProgress = [], isError: emailJourneyError, error: emailJourneyErr } = useQuery<any[]>({
    queryKey: ["/api/email-journey-progress"],
    queryFn: async () => {
      const response = await fetch("/api/email-journey-progress", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch email journey progress");
      return response.json();
    },
  });

  const { data: universityStats = [], isError: universityError, error: universityErr } = useQuery<any[]>({
    queryKey: ["/api/university/stats/overview"],
    queryFn: async () => {
      const response = await fetch("/api/university/stats/overview?activeOnly=false", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch university stats");
      return response.json();
    },
  });

  const { data: whatsappConversations = [], isError: whatsappError, error: whatsappErr } = useQuery<any[]>({
    queryKey: ["/api/whatsapp/conversations", "all"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/conversations?filter=all", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch WhatsApp conversations: ${response.status}`);
      }
      const data = await response.json();
      return data.conversations || [];
    },
  });

  // Check for any critical errors in data fetching
  const hasError = clientsError || assignmentsError || sessionsError || activityError || 
                   emailJourneyError || universityError || whatsappError;

  // Aggregate error details for diagnostics
  const errorDetails = {
    clients: clientsErr,
    assignments: assignmentsErr,
    sessions: sessionsErr,
    activity: activityErr,
    emailJourney: emailJourneyErr,
    university: universityErr,
    whatsapp: whatsappErr,
  };

  // Find first failing source
  const firstError = clientsErr || assignmentsErr || sessionsErr || activityErr || 
                     emailJourneyErr || universityErr || whatsappErr;

  const failingSource = clientsError ? 'clients' :
                        assignmentsError ? 'assignments' :
                        sessionsError ? 'sessions' :
                        activityError ? 'activity' :
                        emailJourneyError ? 'email journey' :
                        universityError ? 'university' :
                        whatsappError ? 'WhatsApp' : 'unknown';

  const clientPriorities = useMemo(() => {
    // If any query failed, return empty array (errors will be handled by consumer)
    if (hasError) {
      console.error('Client priority scoring failed:', failingSource, 'source unavailable', errorDetails);
      return [];
    }

    // Pre-index ALL data by clientId for O(1) lookups
    // Add Array.isArray checks to handle error states gracefully
    const activityByClient = new Map<string, any[]>();
    if (Array.isArray(activityLogs)) {
      activityLogs.forEach((log: any) => {
        if (!activityByClient.has(log.clientId)) {
          activityByClient.set(log.clientId, []);
        }
        activityByClient.get(log.clientId)!.push(log);
      });
    }

    const assignmentsByClient = new Map<string, any[]>();
    if (Array.isArray(assignments)) {
      assignments.forEach((assignment: any) => {
        if (!assignmentsByClient.has(assignment.clientId)) {
          assignmentsByClient.set(assignment.clientId, []);
        }
        assignmentsByClient.get(assignment.clientId)!.push(assignment);
      });
    }

    const whatsappByClient = new Map<string, any[]>();
    if (Array.isArray(whatsappConversations)) {
      whatsappConversations.forEach((conv: any) => {
        const clientId = conv.clientId || conv.userId;
        if (clientId) {
          if (!whatsappByClient.has(clientId)) {
            whatsappByClient.set(clientId, []);
          }
          whatsappByClient.get(clientId)!.push(conv);
        }
      });
    }

    const emailJourneyByClient = new Map<string, any>();
    if (Array.isArray(emailJourneyProgress)) {
      emailJourneyProgress.forEach((progress: any) => {
        if (progress.clientId) {
          emailJourneyByClient.set(progress.clientId, progress);
        }
      });
    }

    const universityByClient = new Map<string, any>();
    if (Array.isArray(universityStats)) {
      universityStats.forEach((stats: any) => {
        if (stats.clientId) {
          universityByClient.set(stats.clientId, stats);
        }
      });
    }

    const onlineClients = new Set<string>();
    if (Array.isArray(activeSessions)) {
      activeSessions.forEach((session: any) => {
        if (session.clientId) {
          onlineClients.add(session.clientId);
        }
      });
    }

    // FILTRO: Solo clienti con isActive: true
    const activeClients = clients.filter((client: User) => client.isActive === true);

    return activeClients.map((client) => {
      const reasons: string[] = [];
      let score = 0;

      // Check if client is online (using pre-indexed set)
      const isOnline = onlineClients.has(client.id);

      // Calculate inactive days with fallback chain (never use 999!)
      const clientActivity = (activityByClient.get(client.id) || []).sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      let lastActivity: Date | null = null;
      let activitySource = '';

      // Try 1: Activity logs (most accurate)
      if (clientActivity[0]) {
        const activityDate = new Date(clientActivity[0].timestamp);
        if (!isNaN(activityDate.getTime())) {
          lastActivity = activityDate;
          activitySource = 'activity_logs';
        }
      }

      // Try 2: Active sessions (if online or recently online)
      if (!lastActivity && Array.isArray(activeSessions)) {
        const clientSession = activeSessions.find((s: any) => s.userId === client.id || s.clientId === client.id);
        if (clientSession?.lastActivity) {
          const sessionDate = new Date(clientSession.lastActivity);
          if (!isNaN(sessionDate.getTime())) {
            lastActivity = sessionDate;
            activitySource = 'active_session';
          }
        }
      }

      // Try 3: Last assignment update (fallback)
      if (!lastActivity) {
        const clientAssignments = assignmentsByClient.get(client.id) || [];
        const recentAssignment = clientAssignments
          .filter((a: any) => a.updatedAt)
          .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        
        if (recentAssignment?.updatedAt) {
          const assignmentDate = new Date(recentAssignment.updatedAt);
          if (!isNaN(assignmentDate.getTime())) {
            lastActivity = assignmentDate;
            activitySource = 'assignment_update';
          }
        }
      }

      // Try 4: User creation date (last resort)
      if (!lastActivity && client.createdAt) {
        const createdDate = new Date(client.createdAt);
        if (!isNaN(createdDate.getTime())) {
          lastActivity = createdDate;
          activitySource = 'user_creation';
        }
      }

      // Calculate inactive days with 30-day cap
      let inactiveDays = 0;
      if (lastActivity) {
        const rawDays = Math.floor(
          (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
        );
        inactiveDays = Math.min(rawDays, 30); // Cap at 30 days max
      } else {
        // If we truly have NO data at all, show 30 days (not 999!)
        inactiveDays = 30;
        activitySource = 'no_data_available';
      }

      if (inactiveDays >= 7) {
        score += 30; // Rebalanced
        reasons.push(`Non logga da ${inactiveDays} giorni`);
      } else if (inactiveDays >= 3) {
        score += 15; // Rebalanced
        reasons.push(`Non logga da ${inactiveDays} giorni`);
      }

      // Check pending exercises (using pre-indexed data)
      const clientAssignments = assignmentsByClient.get(client.id) || [];
      const pendingExercises = clientAssignments.filter(
        (a: any) => a.status === "pending" || a.status === "in_progress"
      ).length;

      // Check exercises to review (submitted, waiting for consultant)
      const exercisesToReview = clientAssignments.filter(
        (a: any) => a.status === "submitted" || a.status === "in_review"
      ).length;

      if (exercisesToReview > 0) {
        score += exercisesToReview * 15; // Reduced from 20 to rebalance
        reasons.push(`${exercisesToReview} esercizi da validare`);
      }

      // Check email journey pending actions (using pre-indexed map)
      const clientEmailProgress = emailJourneyByClient.get(client.id);

      const emailJourneyPending =
        clientEmailProgress?.lastEmailActions?.filter(
          (action: any) =>
            !clientEmailProgress.actionsCompletedData?.details?.find(
              (d: any) => d.action === action.action && d.completed
            )
        ).length || 0;

      // EMAIL JOURNEY PENDING REMOVED FROM CRITICAL ALERTS
      // Manteniamo il calcolo per visualizzazione ma non aggiungiamo score/reasons

      // Check WhatsApp unread/pending messages (using pre-indexed map)
      const clientWhatsapp = whatsappByClient.get(client.id) || [];
      const whatsappUnread = clientWhatsapp.filter(
        (conv: any) => conv.status === "pending" || (conv.unreadCount && conv.unreadCount > 0)
      ).length;

      if (whatsappUnread > 0) {
        score += whatsappUnread * 15; // Rebalanced
        reasons.push(`${whatsappUnread} messaggi WhatsApp da rispondere`);
      }

      // Check university performance (using pre-indexed map)
      const clientUnivStats = universityByClient.get(client.id);

      const universityPerformanceDrop =
        clientUnivStats &&
        typeof clientUnivStats.completionRate === 'number' &&
        clientUnivStats.completionRate < 50 &&
        (clientUnivStats.lessonsCompleted || 0) > 5;

      if (universityPerformanceDrop) {
        score += 20; // Rebalanced
        reasons.push("Performance università in calo");
      }

      // Calculate momentum streak with safety guards
      const recentDays = 7;
      const cutoffDate = Date.now() - recentDays * 24 * 60 * 60 * 1000;
      const recentActivity = (activityByClient.get(client.id) || []).filter(
        (log: any) => {
          const timestamp = new Date(log.timestamp);
          if (isNaN(timestamp.getTime())) return false;
          return timestamp.getTime() > cutoffDate;
        }
      );

      const uniqueDays = new Set(
        recentActivity.map((log: any) =>
          new Date(log.timestamp).toDateString()
        )
      ).size;

      const momentumStreak = uniqueDays || 0;

      // Determine priority level with validated scoring (3 livelli)
      // Ensure score is a valid number
      const validScore = typeof score === 'number' && !isNaN(score) ? score : 0;
      
      // 3 LIVELLI: Alta, Media, Bassa
      let priorityLevel: ClientPriorityData["priorityLevel"] = "low";
      if (validScore >= 30) {
        priorityLevel = "high"; // Alta: 2+ esercizi da validare O 7+ giorni inattività
      } else if (validScore >= 10) {
        priorityLevel = "medium"; // Media: 1 esercizio O 3+ giorni inattività
      }
      // else rimane "low" (Bassa)

      return {
        client,
        priorityScore: validScore,
        priorityLevel,
        inactiveDays: inactiveDays || 0,
        pendingExercises: pendingExercises || 0,
        exercisesToReview: exercisesToReview || 0,
        emailJourneyPending: emailJourneyPending || 0,
        whatsappUnread: whatsappUnread || 0,
        universityPerformanceDrop: universityPerformanceDrop || false,
        isOnline,
        momentumStreak: momentumStreak || 0,
        lastActivity: lastActivity || undefined,
        reasons,
      } as ClientPriorityData;
    });
  }, [
    hasError,
    failingSource,
    clients,
    assignments,
    activeSessions,
    activityLogs,
    emailJourneyProgress,
    universityStats,
    whatsappConversations,
  ]);

  // Sort by priority score (highest first)
  const sortedByPriority = useMemo(() => {
    return [...clientPriorities].sort(
      (a, b) => b.priorityScore - a.priorityScore
    );
  }, [clientPriorities]);

  // 3 LIVELLI DI PRIORITÀ
  const highPriorityClients = useMemo(() => {
    return sortedByPriority.filter((c) => c.priorityLevel === "high");
  }, [sortedByPriority]);

  const mediumPriorityClients = useMemo(() => {
    return sortedByPriority.filter((c) => c.priorityLevel === "medium");
  }, [sortedByPriority]);

  const lowPriorityClients = useMemo(() => {
    return sortedByPriority.filter((c) => c.priorityLevel === "low");
  }, [sortedByPriority]);

  // Get top performers with weighted performance score
  const topPerformers = useMemo(() => {
    // Calculate performance score for each client
    const clientsWithScore = clientPriorities.map((client) => {
      // Performance Score Components (weighted)
      let score = 0;
      
      // 1. Exercises completed (40 points max) - HIGH WEIGHT
      score += Math.min(client.exercisesToReview * 8, 40);
      
      // 2. Momentum streak (30 points max) - HIGH WEIGHT
      score += Math.min(client.momentumStreak * 5, 30);
      
      // 3. Completion ratio (15 points max) - MEDIUM WEIGHT
      // Bonus for high completion rate vs pending
      const totalExercises = client.exercisesToReview + client.pendingExercises;
      if (totalExercises > 0) {
        const completionRatio = client.exercisesToReview / totalExercises;
        score += completionRatio * 15;
      }
      
      // 4. Recent activity (10 points max) - MEDIUM WEIGHT
      // More points for being more active recently
      if (client.inactiveDays === 0) score += 10;
      else if (client.inactiveDays <= 1) score += 8;
      else if (client.inactiveDays <= 3) score += 5;
      else if (client.inactiveDays <= 7) score += 2;
      
      // 5. Email journey engagement (3 points max) - LOW WEIGHT
      score += Math.min(client.emailJourneyPending * 1, 3);
      
      // 6. Low pending exercises bonus (2 points max) - LOW WEIGHT
      // Reward for keeping pending low
      if (client.pendingExercises === 0) score += 2;
      else if (client.pendingExercises <= 2) score += 1;
      
      return {
        ...client,
        performanceScore: score
      };
    });
    
    // Filter: Show only clients with actual activity/engagement
    // Exclude completely inactive clients (those with only pending exercises but no real activity)
    const performers = clientsWithScore.filter(
      (c) => 
        c.exercisesToReview > 0 || // Has completed at least one exercise
        c.momentumStreak > 0 || // Has momentum streak
        c.inactiveDays <= 7 // Been active in the last week
    );
    
    // If no performers, return empty
    if (performers.length === 0) return [];
    
    // Sort by performance score (highest first) - show ALL active clients
    return performers
      .sort((a, b) => b.performanceScore - a.performanceScore);
  }, [clientPriorities]);

  return {
    clientPriorities: sortedByPriority,
    highPriorityClients: highPriorityClients || [],
    mediumPriorityClients: mediumPriorityClients || [],
    lowPriorityClients: lowPriorityClients || [],
    topPerformers: topPerformers || [],
    totalClients: clients.filter((c: User) => c.isActive === true).length,
    hasError,
    error: hasError ? {
      source: failingSource,
      message: firstError?.message || 'Unknown error',
      raw: firstError,
    } : null,
    errorDetails: hasError ? errorDetails : null,
  };
}
