import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";

export interface PageContext {
  pageType: "library_document" | "university_lesson" | "exercise" | "course" | "dashboard" | "exercises_list" | "other";
  resourceId?: string;
  resourceTitle?: string;
  resourceContent?: string;
  additionalContext?: {
    categoryName?: string;
    level?: string;
    estimatedDuration?: number;
    exerciseCategory?: string;
    exerciseType?: string;
    status?: string;
    dueDate?: string;
    // Additional context for exercises_list page
    statistics?: any;
    filters?: any;
    exercisesOverview?: any;
    // Additional context for university/course page
    universityStats?: any;
    universityStructure?: any;
    grades?: any;
    certificates?: any;
    exams?: any;
  };
  // Momentum data
  momentumData?: {
    streak: number;
    todayCheckins: number;
    productivityScore: number;
    activeGoals: Array<{
      id: string;
      title: string;
      currentValue: number;
      targetValue: number;
      unit: string;
    }>;
  };
  // Calendar data
  calendarData?: {
    upcomingEvents: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      description?: string;
    }>;
  };
}

interface UsePageContextOptions {
  documentId?: string;
  documentTitle?: string;
  documentContent?: string;
  documentData?: any;
  lessonId?: string;
  lessonTitle?: string;
  lessonData?: any;
  exerciseId?: string;
  exerciseTitle?: string;
  exerciseData?: any;
  // For exercises_list page
  exercisesListData?: {
    statistics?: any;
    filters?: any;
    exercisesOverview?: any;
  };
  // For university/course page
  universityData?: {
    stats?: any;
    structure?: any;
    grades?: any;
    certificates?: any;
    exams?: any;
  };
}

/**
 * Hook per rilevare automaticamente il contesto della pagina corrente
 * Può essere usato con o senza parametri.
 * Se viene usato senza parametri, rileva il contesto solo dal path.
 * Se viene usato con parametri, include anche i dettagli della risorsa.
 */
export function usePageContext(options: UsePageContextOptions = {}): PageContext {
  const [location] = useLocation();
  const [context, setContext] = useState<PageContext>({
    pageType: "other"
  });

  // Fetch Momentum snapshot
  const today = new Date().toISOString().split('T')[0];
  const { data: momentumSnapshot } = useQuery({
    queryKey: ['/api/momentum/checkins/daily-stats', today],
    queryFn: async () => {
      const response = await fetch(`/api/momentum/checkins/daily-stats?date=${today}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: streakData } = useQuery({
    queryKey: ['/api/momentum/checkins/current-streak'],
    queryFn: async () => {
      const response = await fetch('/api/momentum/checkins/current-streak', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch active goals
  const { data: activeGoals } = useQuery({
    queryKey: ['/api/momentum/goals', { status: 'active' }],
    queryFn: async () => {
      const response = await fetch('/api/momentum/goals?status=active', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch upcoming calendar events (next 7 days)
  const { data: upcomingEvents } = useQuery({
    queryKey: ['/api/calendar/events/upcoming'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/events', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      const allEvents = await response.json();
      
      // Filter for next 7 days
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      return allEvents
        .filter((event: any) => {
          const eventStart = new Date(event.start);
          return eventStart >= now && eventStart <= nextWeek;
        })
        .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .slice(0, 5); // Max 5 events
    },
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const newContext: PageContext = {
      pageType: "other"
    };

    // Rileva il tipo di pagina dal percorso URL
    if (location.includes("/client/library/") && !location.includes("/client/library?")) {
      newContext.pageType = "library_document";
      
      // Estrai l'ID del documento dall'URL
      const match = location.match(/\/client\/library\/([^/?]+)/);
      if (match) {
        newContext.resourceId = match[1];
      }
      
      // Se abbiamo i dati del documento, li includiamo
      if (options.documentId) {
        newContext.resourceId = options.documentId;
      }
      if (options.documentTitle) {
        newContext.resourceTitle = options.documentTitle;
      }
      if (options.documentContent) {
        newContext.resourceContent = options.documentContent;
      }
      if (options.documentData) {
        newContext.additionalContext = {
          categoryName: options.documentData.categoryName,
          level: options.documentData.level,
          estimatedDuration: options.documentData.estimatedDuration
        };
      }
    } else if (location.includes("/client/university")) {
      // Verifica se siamo su una lezione specifica o sulla panoramica università
      if (options.lessonId || options.lessonTitle) {
        newContext.pageType = "university_lesson";
        newContext.resourceId = options.lessonId;
        newContext.resourceTitle = options.lessonTitle;
        
        if (options.lessonData) {
          newContext.resourceContent = options.lessonData.description;
          newContext.additionalContext = {
            categoryName: options.lessonData.moduleName
          };
        }
      } else {
        newContext.pageType = "course";
        
        // Aggiungi dati università se disponibili
        if (options.universityData) {
          newContext.additionalContext = {
            universityStats: options.universityData.stats,
            universityStructure: options.universityData.structure,
            grades: options.universityData.grades,
            certificates: options.universityData.certificates,
            exams: options.universityData.exams
          };
        }
      }
    } else if (location.includes("/client/exercises")) {
      // Pagina lista esercizi
      newContext.pageType = "exercises_list";
      
      if (options.exercisesListData) {
        newContext.additionalContext = {
          statistics: options.exercisesListData.statistics,
          filters: options.exercisesListData.filters,
          exercisesOverview: options.exercisesListData.exercisesOverview
        };
      }
    } else if (location.includes("/exercise/")) {
      newContext.pageType = "exercise";
      
      // Estrai l'ID dell'esercizio dall'URL
      const match = location.match(/\/exercise\/([^/?]+)/);
      if (match) {
        newContext.resourceId = match[1];
      }
      
      // Se abbiamo i dati dell'esercizio, li includiamo
      if (options.exerciseId) {
        newContext.resourceId = options.exerciseId;
      }
      if (options.exerciseTitle) {
        newContext.resourceTitle = options.exerciseTitle;
      }
      if (options.exerciseData) {
        newContext.resourceContent = options.exerciseData.description;
        newContext.additionalContext = {
          exerciseCategory: options.exerciseData.category,
          exerciseType: options.exerciseData.type,
          status: options.exerciseData.status,
          dueDate: options.exerciseData.dueDate,
          estimatedDuration: options.exerciseData.estimatedDuration
        };
      }
    } else if (location.includes("/client/dashboard") || location === "/client") {
      newContext.pageType = "dashboard";
    }

    // Add Momentum data if available
    if (momentumSnapshot || streakData || (activeGoals && activeGoals.length > 0)) {
      newContext.momentumData = {
        streak: streakData?.streak ?? 0,
        todayCheckins: momentumSnapshot?.totalCheckins ?? 0,
        productivityScore: momentumSnapshot?.productivityScore ?? 0,
        activeGoals: (activeGoals || []).map((goal: any) => ({
          id: goal.id,
          title: goal.title,
          currentValue: goal.currentValue ?? 0,
          targetValue: goal.targetValue ?? 0,
          unit: goal.unit ?? '',
        })),
      };
    }

    // Add Calendar data if available
    if (upcomingEvents && upcomingEvents.length > 0) {
      newContext.calendarData = {
        upcomingEvents: upcomingEvents.map((event: any) => ({
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end,
          description: event.description,
        })),
      };
    }

    setContext(newContext);
  }, [location, options.documentId, options.documentTitle, options.documentContent, 
      options.lessonId, options.lessonTitle, options.exerciseId, options.exerciseTitle,
      options.exercisesListData, options.universityData, 
      momentumSnapshot, streakData, activeGoals, upcomingEvents]);

  return context;
}
