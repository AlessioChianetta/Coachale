// AI Context Builder
// Referenced from blueprint:javascript_gemini
// Builds comprehensive user context for AI Assistant

import { db } from "./db";
import {
  users,
  exerciseAssignments,
  exercises,
  exerciseSubmissions,
  dailyTasks,
  dailyReflections,
  consultations,
  consultationTasks,
  goals,
  universityYears,
  universityTrimesters,
  universityModules,
  universityLessons,
  universityProgress,
  universityYearClientAssignments,
  roadmapPhases,
  roadmapGroups,
  roadmapItems,
  clientRoadmapProgress,
  libraryCategories,
  libraryDocuments,
  libraryCategoryClientAssignments,
  clientLibraryProgress,
  userFinanceSettings,
  momentumCheckins,
  momentumGoals,
  calendarEvents
} from "../shared/schema";
import { eq, and, or, desc, gte, lt, sql, inArray, asc } from "drizzle-orm";
import { scrapeGoogleDoc } from "./web-scraper";
import type { FinanceData } from "./percorso-capitale-types";
import { PercorsoCapitaleClient } from "./percorso-capitale-client";
import { PercorsoCapitaleDataProcessor } from "./percorso-capitale-processor";

// ========================================
// INTENT DETECTION
// ========================================

export type UserIntent = 'list' | 'exercises' | 'finances_current' | 'finances_historical' | 'university' | 'library' | 'consultations' | 'appointment_request' | 'general';

export function detectIntent(message: string): UserIntent {
  const lower = message.toLowerCase();

  // PRIORITY 1: List requests - SOLO elenchi esercizi/compiti, no analisi
  // Deve contenere keywords lista + keywords esercizi + NO keywords analisi
  const listKeywords = lower.match(/elenca|elenco|lista|quant[io]|mostra|mostrami|dimmi.*tutti|quali sono|dammi.*lista|fammi.*lista|vediamo/i);
  const exerciseKeywords = lower.match(/eserciz[io]|compiti|assignment|lavori|attivit[àa].*da.*fare|da.*completare|pending|da.*svolgere/i);
  const hasNoAnalysisKeywords = !lower.match(/analizza|analisi|controlla|rivedi|feedback|punteggio|valuta|spiega|aiuta|come.*fatto|perch[eé]|spiegami|dettagli/i);
  
  // SOLO se parla di esercizi E chiede lista E non chiede analisi
  if (listKeywords && exerciseKeywords && hasNoAnalysisKeywords) {
    console.log(`📋 [INTENT: list] Lista esercizi rilevata → context minimo (solo exercises metadata)`);
    return 'list';
  }

  // PRIORITY 2: Full context requests - analisi complete, 360°, overview totale
  // Questi devono sempre usare intent 'general' per avere TUTTO il contesto
  if (lower.match(/complet[oa]|360|panoramic[oa]|totale|intero|tutto|personalizzat[oa].*client|chi è.*client|analisi.*client/i)) {
    return 'general';
  }

  // PRIORITY 2: Business/Strategic Analysis - richieste che necessitano consulenze + finanze + esercizi
  // Queste domande richiedono visione olistica del percorso e dei dati economici
  const hasBusinessKeywords = lower.match(/margin[ei]|profitt[io]|ricav[io]|fattur[ato]|vendite|incass[io]/i);
  const hasStrategicKeywords = lower.match(/strategi[ac]|business|attività|locale|ristorante|negozio|azienda/i);
  const hasAnalysisKeywords = lower.match(/analisi|miglior[ae]|ottimizz[ae]|piano|azione|consult[ao]/i);
  const hasImprovementContext = lower.match(/migliorare|ottimizzare|aumentare|ridurre.*cost[io]|incrementare/i);
  
  // Se la domanda combina keywords business/strategiche, usa 'general' per context completo
  if (hasBusinessKeywords || 
      (hasStrategicKeywords && hasAnalysisKeywords) ||
      (hasStrategicKeywords && hasImprovementContext)) {
    console.log(`🎯 Business/Strategic query detected → forcing intent 'general' for complete context (consultations + finances + exercises)`);
    return 'general';
  }

  // PRIORITY 3: Exercises - solo domande specifiche sugli esercizi
  if (lower.match(/eserciz[io]|compiti|da fare|lavori? da completare|assignment|pending|scadenz[ae]/i)) {
    return 'exercises';
  }

  // PRIORITY 4: Appointment Booking Requests - richieste di prenotazione appuntamento
  // Questo ha priorità alta perché è un'azione specifica che richiede slot disponibili
  const appointmentMatch = lower.match(/appuntamento|prenotare|disponibile quando|disponibilit[àa]|fissare.*incontro|fissare.*appuntamento|chiamata|consulenza gratuita|orari.*liberi?|quando.*sei.*libero|quando.*disponibile|posso venire|vorrei.*incontrar[ti]|vorrei.*parlar[ti]/i);
  if (appointmentMatch) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📅 [APPOINTMENT BOOKING] Intent Detected!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎯 Matched keyword: "${appointmentMatch[0]}"`);
    console.log(`💬 Lead message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
    console.log(`📊 Intent priority: PRIORITY 4 (Appointment Booking)`);
    console.log(`⚡ Next step: Fetch available slots and propose to lead`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return 'appointment_request';
  }

  // Finances - mantieni temporale + aggiungi sinonimi
  const hasFinanceKeywords = lower.match(/budget|spes[ae]|transazion[ei]|entrat[ae]|uscit[ae]|soldi|denaro|finanz[ae]|patrimonio|risparmi[oa]|investiment[io]|cont[io]/i);
  if (hasFinanceKeywords) {
    if (lower.match(/ultim[io]|storico|trend|confronta|mesi fa|scorso|passato|precedent[ei]/i)) {
      return 'finances_historical';
    }
    return 'finances_current';
  }

  // University - aggiungi varianti
  if (lower.match(/universit[àa]|lezion[ei]|cors[oi]|modul[io]|trimestr[ei]|anno accademico|studio|studia/i)) {
    return 'university';
  }

  // Library - FIX CRITICO: aggiungi plurali e sinonimi
  if (lower.match(/document[io]|libreria|risors[ae]|guid[ae]|material[ei]|articol[io]|content[io]|lettur[ae]/i)) {
    return 'library';
  }

  // Consultations - aggiungi varianti
  if (lower.match(/consulenz[ae]|consulente|meeting|colloquio|session[ei]/i)) {
    return 'consultations';
  }

  return 'general';
}

// ========================================
// IN-MEMORY CACHE WITH TTL
// ========================================
const userContextCache = new Map<string, { context: UserContext; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Periodic cleanup of expired cache entries (runs every 10 minutes)
setInterval(() => {
  const now = Date.now();
  let removedCount = 0;

  for (const [clientId, entry] of Array.from(userContextCache.entries())) {
    if (now - entry.timestamp >= CACHE_TTL) {
      userContextCache.delete(clientId);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`🧹 Cache cleanup: removed ${removedCount} expired entries`);
  }
}, 10 * 60 * 1000);

/**
 * Clear user context cache for a specific client or all clients
 * @param clientId - Optional client ID. If not provided, clears entire cache
 */
export function clearUserContextCache(clientId?: string): void {
  if (clientId) {
    const deleted = userContextCache.delete(clientId);
    if (deleted) {
      console.log(`🗑️ Cleared cache for client ${clientId}`);
    }
  } else {
    const size = userContextCache.size;
    userContextCache.clear();
    console.log(`🗑️ Cleared entire cache (${size} entries)`);
  }
}

// Helper function to truncate long content while keeping it useful
function truncateContent(content: string | null, maxLength: number = 1500): string | null {
  if (!content) return null;

  if (content.length <= maxLength) {
    return content;
  }

  // Try to cut at a paragraph or sentence boundary
  const truncated = content.substring(0, maxLength);
  const lastParagraph = truncated.lastIndexOf('\n\n');
  const lastSentence = truncated.lastIndexOf('. ');

  if (lastParagraph > maxLength * 0.7) {
    return truncated.substring(0, lastParagraph) + '\n\n[...contenuto troncato per lunghezza...]';
  } else if (lastSentence > maxLength * 0.7) {
    return truncated.substring(0, lastSentence + 1) + ' [...contenuto troncato per lunghezza...]';
  } else {
    return truncated + '... [...contenuto troncato per lunghezza...]';
  }
}

export interface UserContext {
  currentDate: string; // ISO date string of today
  currentDateTime: string; // Full ISO datetime
  user: {
    id: string;
    name: string;
    email: string;
    level: string;
    enrolledAt: string | null;
  };
  dashboard: {
    pendingExercises: number;
    completedExercises: number;
    todayTasks: number;
    upcomingConsultations: number;
  };
  exercises: {
    all: Array<{
      id: string;
      title: string;
      category: string;
      dueDate: string | null;
      status: string;
      workPlatform: string | null;
      workPlatformContent: string | null;
      score: number | null;
      completedAt: string | null;
      consultantFeedback: Array<{feedback: string; timestamp: string}> | null;
      questionGrades: Array<{questionId: string; score: number; maxScore: number; isCorrect?: boolean; feedback?: string}> | null;
      clientNotes: string | null;
      answers: Array<{questionId: string; answer: string | string[]; uploadedFiles?: string[]}> | null;
      questions: Array<{questionText: string; type?: string; options?: string[]; correctAnswer?: string}> | null;
    }>;
  };
  university: {
    assignedYears: Array<{
      id: string;
      title: string;
      trimesters: Array<{
        id: string;
        title: string;
        modules: Array<{
          id: string;
          title: string;
          lessons: Array<{
            id: string;
            title: string;
            description: string | null;
            resourceUrl: string | null;
            completed: boolean;
            linkedDocument: {
              id: string;
              title: string;
              content: string | null;
              contentType: string;
              videoUrl: string | null;
            } | null;
          }>;
        }>;
      }>;
    }>;
    overallProgress: {
      totalLessons: number;
      completedLessons: number;
      progressPercentage: number;
    };
  };
  dailyActivity: {
    todayTasks: Array<{
      id: string;
      description: string;
      completed: boolean;
    }>;
    todayReflection: {
      grateful: string[];
      makeGreat: string[];
      doBetter: string | null;
    } | null;
  };
  consultations: {
    upcoming: Array<{
      id: string;
      scheduledAt: string;
      duration: number;
      notes: string | null;
      status: string;
      consultantType: string | null;
    }>;
    recent: Array<{
      id: string;
      scheduledAt: string;
      notes: string | null;
      transcript: string | null;
      summaryEmail: string | null;
    }>;
  };
  consultationTasks: Array<{
    id: string;
    consultationId: string;
    title: string;
    description: string | null;
    category: string;
    priority: string;
    dueDate: string | null;
    completed: boolean;
    completedAt: string | null;
  }>;
  goals: Array<{
    id: string;
    title: string;
    targetValue: string;
    currentValue: string;
    status: string;
    targetDate: string | null;
  }>;
  roadmap: {
    phases: Array<{
      id: string;
      title: string;
      objective: string;
      groups: Array<{
        id: string;
        title: string;
        items: Array<{
          id: string;
          title: string;
          description: string;
          completed: boolean;
          grade: number | null;
        }>;
      }>;
    }>;
  };
  library: {
    documents: Array<{
      id: string;
      title: string;
      description: string | null;
      content: string | null;
      contentType: string;
      videoUrl: string | null;
      categoryName: string;
      level: string;
      isRead: boolean;
      estimatedDuration: number | null;
    }>;
  };
  momentum: {
    recentCheckins: Array<{
      id: string;
      timestamp: string;
      activityDescription: string;
      isProductive: boolean;
      category: string | null;
      mood: number | null;  // 1-5 scale
      energyLevel: number | null;  // 1-5 scale
      notes: string | null;
    }>;
    activeGoals: Array<{
      id: string;
      title: string;
      description: string | null;
      progress: number;  // 0-100
      category: string | null;
      targetDate: string | null;
      status: string;
      createdAt: string;
    }>;
    stats: {
      totalCheckins: number;
      productiveCheckins: number;
      productivityRate: number;  // percentage
      averageMood: number | null;  // 1-5
      averageEnergy: number | null;  // 1-5
      currentStreak: number;  // days with at least 1 productive checkin
      todayCheckins: Array<{
        id: string;
        timestamp: Date;
        activityDescription: string;
        isProductive: boolean;
        category: string | null;
        mood: number | null;
        energyLevel: number | null;
        notes: string | null;
      }>;
      recentCheckins: Array<{
        id: string;
        timestamp: Date;
        activityDescription: string;
        isProductive: boolean;
        category: string | null;
        mood: number | null;
        energyLevel: number | null;
        notes: string | null;
      }>;
    };
  };
  calendar: {
    upcomingEvents: Array<{
      id: string;
      title: string;
      description: string | null;
      start: string;  // ISO datetime
      end: string;    // ISO datetime
      allDay: boolean;
      color: string | null;
    }>;
    ongoingEvents: Array<{
      id: string;
      title: string;
      description: string | null;
      start: string;  // ISO datetime
      end: string;    // ISO datetime
      allDay: boolean;
      color: string | null;
    }>;
    recentEvents: Array<{
      id: string;
      title: string;
      description: string | null;
      start: string;
      end: string;
      allDay: boolean;
      color: string | null;
    }>;
    stats: {
      totalUpcoming: number;
      totalOngoing: number;
      eventsToday: number;
      eventsThisWeek: number;
    };
  };
  financeData?: FinanceData;
  conversation?: {
    isProactiveLead: boolean;
    proactiveLeadId: string | null;
    isLead: boolean;
    messageCount: number;
  };
}

export async function buildUserContext(
  clientId: string,
  options?: {
    intent?: UserIntent;
    message?: string;
    pageContext?: any; // PageContext from AI assistant
    conversation?: any; // WhatsApp conversation data for proactive/reactive detection
    sessionType?: 'weekly_consultation' | undefined; // NEW: Distinguish session types
  }
): Promise<UserContext> {
  // ========================================
  // CHECK CACHE FIRST - Cache scoped per intent to prevent poisoning
  // ========================================
  const intent = options?.intent || 'general';
  const pageContext = options?.pageContext;
  const sessionKey = options?.sessionType || 'normal';
  const cacheKey = `${clientId}-${intent}-${sessionKey}`; // Separate cache per session type

  const cached = userContextCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    const cacheAge = Math.round((Date.now() - cached.timestamp) / 1000);
    console.log(`✅ Using cached context for client ${clientId} (intent: ${intent}, sessionType: ${options?.sessionType || 'normal'}, age: ${cacheAge}s)`);
    return cached.context;
  }

  console.log(`🔄 Building context for client ${clientId} (intent: ${intent}, sessionType: ${options?.sessionType || 'normal'})`);

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  // ========================================
  // PHASE 1: Determine what to load based on intent (optimize queries)
  // ========================================
  // INTENT 'list': Carica SOLO exercises metadata, skippa tutto il resto per velocità
  // INTENT 'general': Carica TUTTO per analisi complete
  // CONSULTATIONS: SEMPRE caricate (tranne 'list') perché fondamentali per capire il percorso cliente
  const shouldLoadExercises = intent === 'list' || intent === 'exercises' || intent === 'general';
  const shouldLoadUniversity = intent === 'university' || intent === 'general'; // NO per 'list'
  const shouldLoadFinances = intent === 'finances_current' || intent === 'finances_historical' || intent === 'general'; // NO per 'list'
  const shouldLoadConsultations = intent !== 'list'; // SEMPRE (tranne 'list')

  // ========================================
  // PHASE 2: Parallelize queries conditionally based on intent
  // ========================================
  const [
    userResult,
    allExerciseAssignments,
    todayTasks,
    todayReflectionResult,
    allConsultations,
    allConsultationTasks,
    userGoals,
    yearAssignments,
    financeSettings,
    recentCheckinsRaw, // Renamed to avoid conflict
    activeGoals,
    last30DaysCheckins,
    last7DaysCheckins,
    allCheckinsForStreak,
    totalUpcomingCountResult,
    upcomingCalendarEvents,
    ongoingCalendarEvents,
    recentCalendarEvents,
  ] = await Promise.all([
    // User info - SEMPRE
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        level: users.level,
        enrolledAt: users.enrolledAt,
      })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1),

    // Exercises - SOLO se necessario
    shouldLoadExercises
      ? db
          .select({
            id: exerciseAssignments.id,
            exerciseId: exerciseAssignments.exerciseId,
            status: exerciseAssignments.status,
            dueDate: exerciseAssignments.dueDate,
            score: exerciseAssignments.score,
            completedAt: exerciseAssignments.completedAt,
            consultantFeedback: exerciseAssignments.consultantFeedback,
            questionGrades: exerciseAssignments.questionGrades,
            exerciseTitle: exercises.title,
            exerciseCategory: exercises.category,
            workPlatform: exercises.workPlatform,
            workPlatformUrl: exerciseAssignments.workPlatform,
            libraryDocumentId: exercises.libraryDocumentId,
            submissionNotes: exerciseSubmissions.notes,
            submissionAnswers: exerciseSubmissions.answers,
            questions: exercises.questions,
          })
          .from(exerciseAssignments)
          .leftJoin(exercises, eq(exerciseAssignments.exerciseId, exercises.id))
          .leftJoin(exerciseSubmissions, eq(exerciseSubmissions.assignmentId, exerciseAssignments.id))
          .where(eq(exerciseAssignments.clientId, clientId))
          .orderBy(desc(exerciseAssignments.assignedAt))
      : Promise.resolve([]),

    // Daily tasks - SEMPRE (sono poche)
    db
      .select()
      .from(dailyTasks)
      .where(and(
        eq(dailyTasks.clientId, clientId),
        eq(dailyTasks.date, today)
      )),

    // Daily reflection - SEMPRE (è una)
    db
      .select()
      .from(dailyReflections)
      .where(and(
        eq(dailyReflections.clientId, clientId),
        eq(dailyReflections.date, today)
      ))
      .limit(1),

    // Consultations - SOLO se necessario
    shouldLoadConsultations
      ? db
          .select()
          .from(consultations)
          .where(eq(consultations.clientId, clientId))
          .orderBy(consultations.scheduledAt)
      : Promise.resolve([]),

    // Consultation tasks - SOLO se necessario
    shouldLoadConsultations
      ? db
          .select()
          .from(consultationTasks)
          .where(eq(consultationTasks.clientId, clientId))
          .orderBy(asc(consultationTasks.dueDate))
      : Promise.resolve([]),

    // Goals - SEMPRE (sono pochi)
    db
      .select()
      .from(goals)
      .where(eq(goals.clientId, clientId)),

    // University - SOLO se necessario
    shouldLoadUniversity
      ? db
          .select({
            yearId: universityYearClientAssignments.yearId,
            yearTitle: universityYears.title,
          })
          .from(universityYearClientAssignments)
          .leftJoin(universityYears, eq(universityYearClientAssignments.yearId, universityYears.id))
          .where(and(
            eq(universityYearClientAssignments.clientId, clientId),
            eq(universityYears.isLocked, false)
          ))
      : Promise.resolve([]),

    // Finance settings - SOLO se necessario
    shouldLoadFinances
      ? db
          .select()
          .from(userFinanceSettings)
          .where(eq(userFinanceSettings.clientId, clientId))
          .limit(1)
      : Promise.resolve([]),

    // Momentum: Recent check-ins - SEMPRE (sono pochi)
    db
      .select()
      .from(momentumCheckins)
      .where(eq(momentumCheckins.userId, clientId))
      .orderBy(desc(momentumCheckins.timestamp))
      .limit(20),

    // Momentum: Active goals - SEMPRE (sono pochi)
    db
      .select()
      .from(momentumGoals)
      .where(and(
        eq(momentumGoals.userId, clientId),
        eq(momentumGoals.status, 'active')
      )),

    // Momentum: Last 30 days check-ins for stats
    db
      .select()
      .from(momentumCheckins)
      .where(and(
        eq(momentumCheckins.userId, clientId),
        gte(momentumCheckins.timestamp, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      )),

    // Momentum: Last 7 days check-ins for mood/energy average
    db
      .select()
      .from(momentumCheckins)
      .where(and(
        eq(momentumCheckins.userId, clientId),
        gte(momentumCheckins.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      )),

    // Momentum: All check-ins ordered by date DESC for streak calculation
    db
      .select({
        timestamp: momentumCheckins.timestamp,
        isProductive: momentumCheckins.isProductive,
      })
      .from(momentumCheckins)
      .where(eq(momentumCheckins.userId, clientId))
      .orderBy(desc(momentumCheckins.timestamp)),

    // Calendar: Total upcoming count - SEMPRE (per fix Bug 1)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.userId, clientId),
        gte(calendarEvents.start, now)
      )),

    // Calendar: Upcoming events - SEMPRE (sono pochi) - FIXED: only future events (not started yet)
    db
      .select()
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.userId, clientId),
        gte(calendarEvents.start, now)
      ))
      .orderBy(asc(calendarEvents.start))
      .limit(10),

    // Calendar: Ongoing events - SEMPRE (sono pochi) - NEW per Bug 2
    db
      .select()
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.userId, clientId),
        lt(calendarEvents.start, now),
        gte(calendarEvents.end, now)
      ))
      .orderBy(asc(calendarEvents.end))
      .limit(5),

    // Calendar: Recent events - SEMPRE (sono pochi)
    db
      .select()
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.userId, clientId),
        lt(calendarEvents.end, now)
      ))
      .orderBy(desc(calendarEvents.start))
      .limit(5),
  ]);

  const [user] = userResult;
  if (!user) {
    throw new Error("User not found");
  }

  const [todayReflection] = todayReflectionResult;

  // Process exercises - DEDUPLICATE by assignment ID
  const exerciseMap = new Map<string, any>();

  allExerciseAssignments.forEach((e: any) => {
    // Se già presente, mantieni quello con più informazioni (con submission)
    if (!exerciseMap.has(e.id) || (e.submissionAnswers && !exerciseMap.get(e.id).submissionAnswers)) {
      const platformUrl = e.workPlatformUrl || e.workPlatform;
      exerciseMap.set(e.id, {
        id: e.id,
        title: e.exerciseTitle || '',
        category: e.exerciseCategory || '',
        dueDate: e.dueDate ? e.dueDate.toISOString() : null,
        status: e.status,
        workPlatform: platformUrl,
        workPlatformContent: null, // Will be populated below
        score: e.score,
        completedAt: e.completedAt ? e.completedAt.toISOString() : null,
        consultantFeedback: e.consultantFeedback || null,
        questionGrades: e.questionGrades || null,
        clientNotes: e.submissionNotes || null,
        answers: e.submissionAnswers || null,
        questions: e.questions || null,
      });
    }
  });

  // Convert map to array and filter/prioritize based on intent
  let allExercises = Array.from(exerciseMap.values());

  // Sort by priority: pending > in_progress > returned > completed
  const statusPriority: Record<string, number> = {
    'pending': 1,
    'in_progress': 2,
    'returned': 3,
    'completed': 4
  };
  allExercises.sort((a, b) => {
    const priorityA = statusPriority[a.status] || 999;
    const priorityB = statusPriority[b.status] || 999;
    return priorityA - priorityB;
  });

  // CRITICAL: If pageContext indicates specific exercise, ONLY include that one
  if (pageContext?.pageType === 'exercise' && pageContext?.resourceTitle) {
    // Match by title because resourceId is exercise.id but allExercises contains assignments
    const specificExercise = allExercises.find(e => 
      e.title.toLowerCase() === pageContext.resourceTitle.toLowerCase()
    );
    if (specificExercise) {
      allExercises = [specificExercise];
      console.log(`🎯 PageContext detected - filtering to ONLY exercise: "${specificExercise.title}" (assignment: ${specificExercise.id})`);
    } else {
      console.log(`⚠️ PageContext exercise "${pageContext.resourceTitle}" not found in exercises list`);
    }
  }
  // No filtering or limits - always show ALL exercises in full
  console.log(`📚 Including ALL ${allExercises.length} exercises in context (no limits applied)`);


  // ========================================
  // EXERCISE CONTENT - SMART SCRAPING WITH CACHE
  // ========================================
  // Content is scraped ON-DEMAND in ai-service.ts using intelligent cache
  // EXCEPT when user is on a specific exercise page (pageContext) - in that case, load it NOW
  
  // Set workPlatformContent to null by default (will be populated on-demand in ai-service.ts)
  allExercises.forEach(exercise => {
    exercise.workPlatformContent = null;
  });
  
  // SPECIAL CASE: If user is on a specific exercise page, scrape that content NOW with cache
  if (pageContext?.pageType === 'exercise' && pageContext?.resourceTitle && allExercises.length === 1) {
    const specificExercise = allExercises[0];
    
    if (specificExercise.workPlatform) {
      console.log(`🎯 PageContext detected - loading content for exercise: "${specificExercise.title}"`);
      
      try {
        // Import cache functions
        const { getCachedExercise, setCachedExercise, scrapeGoogleDoc } = await import('./exercise-scrape-cache');
        const { scrapeGoogleDoc: scrapeDoc } = await import('./web-scraper');
        
        // Check cache first
        const cached = getCachedExercise(
          specificExercise.workPlatform,
          specificExercise.id,
          null
        );
        
        if (cached) {
          specificExercise.workPlatformContent = cached.content;
          console.log(`   ✅ [CACHE HIT] Content loaded from cache (age: ${cached.age}s, ${cached.content.length.toLocaleString()} chars)`);
        } else {
          console.log(`   🔄 [CACHE MISS] Scraping content from Google Docs...`);
          const scraped = await scrapeDoc(specificExercise.workPlatform, 100000); // SCRAPING TOTALE
          
          if (scraped.success && scraped.content) {
            specificExercise.workPlatformContent = scraped.content;
            setCachedExercise(
              specificExercise.workPlatform,
              specificExercise.id,
              specificExercise.title,
              scraped.content,
              null
            );
            console.log(`   ✅ [SCRAPED] Content loaded and cached (${scraped.content.length.toLocaleString()} chars)`);
          } else {
            console.log(`   ⚠️ Scraping failed: ${scraped.error}`);
          }
        }
      } catch (error: any) {
        console.error(`   ❌ Error loading exercise content: ${error.message}`);
      }
    }
  } else {
    console.log(`📚 Prepared ${allExercises.length} exercise metadata (content will be loaded on-demand when asked)`);
  }

  // Process consultations - TUTTE le consultations, senza limiti
  const upcomingConsultations = allConsultations
    .filter((c: any) => c.scheduledAt > now && c.status === 'scheduled')
    // Rimosso .slice(0, 5) per includere TUTTE le consulenze future
    .map((c: any) => ({
      id: c.id,
      scheduledAt: c.scheduledAt.toISOString(),
      duration: c.duration,
      notes: c.notes,
      status: c.status,
      consultantType: c.consultantType,
    }));

  const recentConsultations = allConsultations
    .filter((c: any) => c.scheduledAt <= now && c.status === 'completed')
    // Rimuovo .slice(-5) per includere TUTTE le consulenze completate
    .map((c: any) => ({
      id: c.id,
      scheduledAt: c.scheduledAt.toISOString(),
      notes: c.notes,
      transcript: c.transcript,
      summaryEmail: c.summaryEmail,
      status: c.status,
      consultantType: c.consultantType,
      duration: c.duration,
    }));
  
  // Anche tutte le altre consultations (cancelled, no-show, etc.) per context completo
  const otherConsultations = allConsultations
    .filter((c: any) => c.status !== 'scheduled' && c.status !== 'completed')
    .map((c: any) => ({
      id: c.id,
      scheduledAt: c.scheduledAt.toISOString(),
      status: c.status,
      notes: c.notes,
      consultantType: c.consultantType,
    }));

  // ========================================
  // PHASE 2: Optimize University (eliminate N+1)
  // ========================================
  const assignedYears = [];
  let totalLessons = 0;
  let completedLessons = 0;

  const yearIds = yearAssignments.map(ya => ya.yearId).filter(Boolean) as string[];

  if (yearIds.length > 0) {
    // Bulk fetch all trimesters for all years
    const allTrimesters = await db
      .select()
      .from(universityTrimesters)
      .where(inArray(universityTrimesters.yearId, yearIds))
      .orderBy(universityTrimesters.sortOrder);

    const trimesterIds = allTrimesters.map(t => t.id);

    if (trimesterIds.length > 0) {
      // Bulk fetch all modules for all trimesters
      const allModules = await db
        .select()
        .from(universityModules)
        .where(inArray(universityModules.trimesterId, trimesterIds))
        .orderBy(universityModules.sortOrder);

      const moduleIds = allModules.map(m => m.id);

      if (moduleIds.length > 0) {
        // Bulk fetch all lessons for all modules with library documents
        const allLessons = await db
          .select({
            id: universityLessons.id,
            title: universityLessons.title,
            description: universityLessons.description,
            resourceUrl: universityLessons.resourceUrl,
            libraryDocumentId: universityLessons.libraryDocumentId,
            moduleId: universityLessons.moduleId,
            sortOrder: universityLessons.sortOrder,
            docTitle: libraryDocuments.title,
            docContent: libraryDocuments.content,
            docContentType: libraryDocuments.contentType,
            docVideoUrl: libraryDocuments.videoUrl,
          })
          .from(universityLessons)
          .leftJoin(libraryDocuments, eq(universityLessons.libraryDocumentId, libraryDocuments.id))
          .where(inArray(universityLessons.moduleId, moduleIds))
          .orderBy(universityLessons.sortOrder);

        const lessonIds = allLessons.map(l => l.id);

        // Bulk fetch all progress for all lessons
        let allProgress: any[] = [];
        if (lessonIds.length > 0) {
          allProgress = await db
            .select()
            .from(universityProgress)
            .where(and(
              eq(universityProgress.clientId, clientId),
              inArray(universityProgress.lessonId, lessonIds)
            ));
        }

        // Create lookup maps for efficient assembly
        const progressMap = new Map(allProgress.map(p => [p.lessonId, p]));
        const lessonsByModule = new Map<string, any[]>();
        const modulesByTrimester = new Map<string, any[]>();
        const trimestersByYear = new Map<string, any[]>();

        // Group lessons by module
        allLessons.forEach(lesson => {
          if (!lessonsByModule.has(lesson.moduleId)) {
            lessonsByModule.set(lesson.moduleId, []);
          }
          lessonsByModule.get(lesson.moduleId)!.push(lesson);
        });

        // Group modules by trimester
        allModules.forEach(module => {
          if (!modulesByTrimester.has(module.trimesterId)) {
            modulesByTrimester.set(module.trimesterId, []);
          }
          modulesByTrimester.get(module.trimesterId)!.push(module);
        });

        // Group trimesters by year
        allTrimesters.forEach(trimester => {
          if (!trimestersByYear.has(trimester.yearId)) {
            trimestersByYear.set(trimester.yearId, []);
          }
          trimestersByYear.get(trimester.yearId)!.push(trimester);
        });

        // Reassemble the hierarchy
        for (const yearAssignment of yearAssignments) {
          if (!yearAssignment.yearId) continue;

          const trimesters = trimestersByYear.get(yearAssignment.yearId) || [];
          const trimestersWithModules = [];

          for (const trimester of trimesters) {
            const modules = modulesByTrimester.get(trimester.id) || [];
            const modulesWithLessons = [];

            for (const module of modules) {
              const lessons = lessonsByModule.get(module.id) || [];
              const lessonsWithProgress = [];

              for (const lesson of lessons) {
                totalLessons++;
                const progress = progressMap.get(lesson.id);
                const isCompleted = progress?.isCompleted || false;
                if (isCompleted) completedLessons++;

                lessonsWithProgress.push({
                  id: lesson.id,
                  title: lesson.title,
                  description: lesson.description,
                  resourceUrl: lesson.resourceUrl,
                  completed: isCompleted,
                  linkedDocument: lesson.libraryDocumentId ? {
                    id: lesson.libraryDocumentId,
                    title: lesson.docTitle || '',
                    content: truncateContent(lesson.docContent, 5000),
                    contentType: lesson.docContentType || 'text',
                    videoUrl: lesson.docVideoUrl,
                  } : null,
                });
              }

              modulesWithLessons.push({
                id: module.id,
                title: module.title,
                lessons: lessonsWithProgress,
              });
            }

            trimestersWithModules.push({
              id: trimester.id,
              title: trimester.title,
              modules: modulesWithLessons,
            });
          }

          assignedYears.push({
            id: yearAssignment.yearId,
            title: yearAssignment.yearTitle || '',
            trimesters: trimestersWithModules,
          });
        }
      }
    }
  }

  // ========================================
  // PHASE 3: Optimize Roadmap (eliminate N+1)
  // ========================================
  const phases = await db
    .select()
    .from(roadmapPhases)
    .orderBy(roadmapPhases.sortOrder);

  const roadmapData = [];
  const phaseIds = phases.map(p => p.id);

  if (phaseIds.length > 0) {
    // Bulk fetch all groups for all phases
    const allGroups = await db
      .select()
      .from(roadmapGroups)
      .where(inArray(roadmapGroups.phaseId, phaseIds))
      .orderBy(roadmapGroups.sortOrder);

    const groupIds = allGroups.map(g => g.id);

    if (groupIds.length > 0) {
      // Bulk fetch all items for all groups
      const allItems = await db
        .select({
          id: roadmapItems.id,
          title: roadmapItems.title,
          description: roadmapItems.description,
          groupId: roadmapItems.groupId,
          sortOrder: roadmapItems.sortOrder,
        })
        .from(roadmapItems)
        .where(inArray(roadmapItems.groupId, groupIds))
        .orderBy(roadmapItems.sortOrder);

      const itemIds = allItems.map(i => i.id);

      // Bulk fetch all progress for all items
      let allRoadmapProgress: any[] = [];
      if (itemIds.length > 0) {
        allRoadmapProgress = await db
          .select()
          .from(clientRoadmapProgress)
          .where(and(
            eq(clientRoadmapProgress.clientId, clientId),
            inArray(clientRoadmapProgress.itemId, itemIds)
          ));
      }

      // Create lookup maps
      const roadmapProgressMap = new Map(allRoadmapProgress.map(p => [p.itemId, p]));
      const itemsByGroup = new Map<string, any[]>();
      const groupsByPhase = new Map<string, any[]>();

      // Group items by group
      allItems.forEach(item => {
        if (!itemsByGroup.has(item.groupId)) {
          itemsByGroup.set(item.groupId, []);
        }
        itemsByGroup.get(item.groupId)!.push(item);
      });

      // Group groups by phase
      allGroups.forEach(group => {
        if (!groupsByPhase.has(group.phaseId)) {
          groupsByPhase.set(group.phaseId, []);
        }
        groupsByPhase.get(group.phaseId)!.push(group);
      });

      // Reassemble the hierarchy
      for (const phase of phases) {
        const groups = groupsByPhase.get(phase.id) || [];
        const groupsWithItems = [];

        for (const group of groups) {
          const items = itemsByGroup.get(group.id) || [];
          const itemsWithProgress = [];

          for (const item of items) {
            const progress = roadmapProgressMap.get(item.id);
            itemsWithProgress.push({
              id: item.id,
              title: item.title,
              description: item.description,
              completed: progress?.isCompleted || false,
              grade: progress?.grade || null,
            });
          }

          groupsWithItems.push({
            id: group.id,
            title: group.title,
            items: itemsWithProgress,
          });
        }

        roadmapData.push({
          id: phase.id,
          title: phase.title,
          objective: phase.objective,
          groups: groupsWithItems,
        });
      }
    } else {
      // No groups, just add phases
      for (const phase of phases) {
        roadmapData.push({
          id: phase.id,
          title: phase.title,
          objective: phase.objective,
          groups: [],
        });
      }
    }
  }

  // ========================================
  // PHASE 4: Optimize Library (eliminate N+1)
  // ========================================

  // Step 1: Get documents from assigned library categories
  const assignedCategories = await db
    .select({
      categoryId: libraryCategoryClientAssignments.categoryId,
    })
    .from(libraryCategoryClientAssignments)
    .where(eq(libraryCategoryClientAssignments.clientId, clientId));

  const categoryIds = assignedCategories.map(ac => ac.categoryId);

  // Step 2: Extract document IDs from exercises (ALWAYS include these!)
  const exerciseDocumentIds = allExerciseAssignments
    .map((e: any) => e.libraryDocumentId)
    .filter((id: any) => id != null) as string[];

  console.log(`📚 Found ${exerciseDocumentIds.length} documents linked to exercises`);

  // Step 3: Combine document IDs (from categories + from exercises, removing duplicates)
  const uniqueDocIds = new Set(exerciseDocumentIds); // ALWAYS include exercise documents first
  const allDocumentIds = Array.from(uniqueDocIds);

  let libraryDocs: any[] = [];

  // Build the query conditions
  const documentQueryConditions = [eq(libraryDocuments.isPublished, true)];

  // If we have document IDs from exercises OR categories, fetch them
  if (allDocumentIds.length > 0 || categoryIds.length > 0) {
    // Combine: documents from exercises OR documents from assigned categories
    if (allDocumentIds.length > 0 && categoryIds.length > 0) {
      // Both: fetch docs that are either in exercises OR in assigned categories
      const docs = await db
        .select({
          id: libraryDocuments.id,
          title: libraryDocuments.title,
          description: libraryDocuments.description,
          content: libraryDocuments.content,
          contentType: libraryDocuments.contentType,
          videoUrl: libraryDocuments.videoUrl,
          categoryId: libraryDocuments.categoryId,
          level: libraryDocuments.level,
          estimatedDuration: libraryDocuments.estimatedDuration,
          categoryName: libraryCategories.name,
        })
        .from(libraryDocuments)
        .leftJoin(libraryCategories, eq(libraryDocuments.categoryId, libraryCategories.id))
        .where(and(
          eq(libraryDocuments.isPublished, true),
          or(
            inArray(libraryDocuments.id, allDocumentIds),
            inArray(libraryDocuments.categoryId, categoryIds)
          )
        ))
        .limit(30); // Increased limit to accommodate both sources

      const docIds = docs.map(d => d.id);
      let allLibraryProgress: any[] = [];
      if (docIds.length > 0) {
        allLibraryProgress = await db
          .select()
          .from(clientLibraryProgress)
          .where(and(
            eq(clientLibraryProgress.clientId, clientId),
            inArray(clientLibraryProgress.documentId, docIds)
          ));
      }

      const libraryProgressMap = new Map(allLibraryProgress.map(p => [p.documentId, p]));

      libraryDocs = docs.map(doc => {
        const progress = libraryProgressMap.get(doc.id);

        // Apply intent-based truncation for library documents
        let contentTruncateLimit = 1500; // Default
        if (intent === 'library') {
          contentTruncateLimit = 1500; // Full content for library intent
        } else {
          contentTruncateLimit = 500; // Minimal content for other intents
        }

        return {
          id: doc.id,
          title: doc.title,
          description: doc.description,
          content: truncateContent(doc.content, contentTruncateLimit),
          contentType: doc.contentType,
          videoUrl: doc.videoUrl,
          categoryName: doc.categoryName || '',
          level: doc.level,
          isRead: progress?.isRead || false,
          estimatedDuration: doc.estimatedDuration,
        };
      });
    } else if (allDocumentIds.length > 0) {
      // Only exercise documents
      const docs = await db
        .select({
          id: libraryDocuments.id,
          title: libraryDocuments.title,
          description: libraryDocuments.description,
          content: libraryDocuments.content,
          contentType: libraryDocuments.contentType,
          videoUrl: libraryDocuments.videoUrl,
          categoryId: libraryDocuments.categoryId,
          level: libraryDocuments.level,
          estimatedDuration: libraryDocuments.estimatedDuration,
          categoryName: libraryCategories.name,
        })
        .from(libraryDocuments)
        .leftJoin(libraryCategories, eq(libraryDocuments.categoryId, libraryCategories.id))
        .where(and(
          eq(libraryDocuments.isPublished, true),
          inArray(libraryDocuments.id, allDocumentIds)
        ));

      const docIds = docs.map(d => d.id);
      let allLibraryProgress: any[] = [];
      if (docIds.length > 0) {
        allLibraryProgress = await db
          .select()
          .from(clientLibraryProgress)
          .where(and(
            eq(clientLibraryProgress.clientId, clientId),
            inArray(clientLibraryProgress.documentId, docIds)
          ));
      }

      const libraryProgressMap = new Map(allLibraryProgress.map(p => [p.documentId, p]));

      libraryDocs = docs.map(doc => {
        const progress = libraryProgressMap.get(doc.id);

        // Apply intent-based truncation for library documents
        let contentTruncateLimit = 1500; // Default
        if (intent === 'library') {
          contentTruncateLimit = 1500; // Full content for library intent
        } else {
          contentTruncateLimit = 500; // Minimal content for other intents
        }

        return {
          id: doc.id,
          title: doc.title,
          description: doc.description,
          content: truncateContent(doc.content, contentTruncateLimit),
          contentType: doc.contentType,
          videoUrl: doc.videoUrl,
          categoryName: doc.categoryName || '',
          level: doc.level,
          isRead: progress?.isRead || false,
          estimatedDuration: doc.estimatedDuration,
        };
      });
    } else if (categoryIds.length > 0) {
      // Only category documents
      const docs = await db
        .select({
          id: libraryDocuments.id,
          title: libraryDocuments.title,
          description: libraryDocuments.description,
          content: libraryDocuments.content,
          contentType: libraryDocuments.contentType,
          videoUrl: libraryDocuments.videoUrl,
          categoryId: libraryDocuments.categoryId,
          level: libraryDocuments.level,
          estimatedDuration: libraryDocuments.estimatedDuration,
          categoryName: libraryCategories.name,
        })
        .from(libraryDocuments)
        .leftJoin(libraryCategories, eq(libraryDocuments.categoryId, libraryCategories.id))
        .where(and(
          eq(libraryDocuments.isPublished, true),
          inArray(libraryDocuments.categoryId, categoryIds)
        ))
        .limit(20);

      const docIds = docs.map(d => d.id);
      let allLibraryProgress: any[] = [];
      if (docIds.length > 0) {
        allLibraryProgress = await db
          .select()
          .from(clientLibraryProgress)
          .where(and(
            eq(clientLibraryProgress.clientId, clientId),
            inArray(clientLibraryProgress.documentId, docIds)
          ));
      }

      const libraryProgressMap = new Map(allLibraryProgress.map(p => [p.documentId, p]));

      libraryDocs = docs.map(doc => {
        const progress = libraryProgressMap.get(doc.id);

        // Apply intent-based truncation for library documents
        let contentTruncateLimit = 1500; // Default
        if (intent === 'library') {
          contentTruncateLimit = 1500; // Full content for library intent
        } else {
          contentTruncateLimit = 500; // Minimal content for other intents
        }

        return {
          id: doc.id,
          title: doc.title,
          description: doc.description,
          content: truncateContent(doc.content, contentTruncateLimit),
          contentType: doc.contentType,
          videoUrl: doc.videoUrl,
          categoryName: doc.categoryName || '',
          level: doc.level,
          isRead: progress?.isRead || false,
          estimatedDuration: doc.estimatedDuration,
        };
      });
    }
  }

  // Apply intent-based document count limits
  if (intent === 'library') {
    // For library intent: show up to 20 documents
    libraryDocs = libraryDocs.slice(0, 20);
  } else if (intent === 'exercises' || intent === 'finances_current' || intent === 'finances_historical') {
    // For exercises and finance intents: omit library documents to save tokens
    libraryDocs = [];
  } else {
    // For other intents: show only 5 documents
    libraryDocs = libraryDocs.slice(0, 5);
  }

  console.log(`📚 Total library documents included in context: ${libraryDocs.length} (intent: ${intent})`);

  // ========================================
  // PHASE 5: Fetch Percorso Capitale Finance Data (if configured)
  // ========================================
  let financeData: FinanceData | undefined = undefined;
  const [userFinanceConfig] = financeSettings;

  if (userFinanceConfig && userFinanceConfig.isEnabled && userFinanceConfig.percorsoCapitaleEmail) {
    const apiKey = process.env.PERCORSO_CAPITALE_API_KEY;
    const baseUrl = process.env.PERCORSO_CAPITALE_BASE_URL;

    if (apiKey && baseUrl) {
      try {
        console.log(`🏦 Fetching finance data for ${userFinanceConfig.percorsoCapitaleEmail}`);
        const pcClient = PercorsoCapitaleClient.getInstance(apiKey, baseUrl, userFinanceConfig.percorsoCapitaleEmail);

        const [dashboardRaw, budgetsRaw, transactionsRaw, accountArchRaw, budgetSettingsRaw, investmentsRaw, goalsRaw] = await Promise.all([
          pcClient.getDashboard(),
          pcClient.getCategoryBudgets(),
          pcClient.getTransactions(),
          pcClient.getAccountArchitecture(),
          pcClient.getBudgetSettings(),
          pcClient.getInvestments(),
          pcClient.getGoals(),
        ]);

        // ========================================
        // PROCESS RAW DATA usando PercorsoCapitaleDataProcessor
        // ========================================

        const processedDashboard = dashboardRaw ? PercorsoCapitaleDataProcessor.processDashboard(dashboardRaw) : null;
        const processedAccountArch = accountArchRaw ? PercorsoCapitaleDataProcessor.processAccountArchitecture(accountArchRaw) : null;

        // BUDGET MESE CORRENTE (per sezione "BUDGET CATEGORIE")
        const processedBudgets = (budgetsRaw && transactionsRaw) ? PercorsoCapitaleDataProcessor.processCategoryBudgets(budgetsRaw, transactionsRaw) : null;

        // BUDGET MULTI-MESE: Calcola budget per ultimi 3 mesi (ottimizzato da 6 a 3)
        const budgetsByMonth: Record<string, any[]> = {};
        if (budgetsRaw && transactionsRaw) {
          const now = new Date();
          for (let i = 0; i < 3; i++) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = monthDate.toISOString().slice(0, 7);
            const monthName = monthDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
            budgetsByMonth[monthName] = PercorsoCapitaleDataProcessor.processCategoryBudgets(budgetsRaw, transactionsRaw, monthKey);
          }
        }

        const processedGoals = goalsRaw ? PercorsoCapitaleDataProcessor.processGoals(goalsRaw) : null;
        const processedInvestments = investmentsRaw ? PercorsoCapitaleDataProcessor.processInvestments(investmentsRaw) : null;

        // ANALISI MULTI-MESE (ultimi 6 mesi)
        const multiMonthAnalysis = (budgetsRaw && transactionsRaw)
          ? PercorsoCapitaleDataProcessor.analyzeMultipleMonths(transactionsRaw, budgetsRaw, 6)
          : null;

        // 1. DASHBOARD - Con TUTTI i calcoli richiesti
        const dashboardData = processedDashboard ? {
          netWorth: processedDashboard.netWorth,
          availableLiquidity: processedDashboard.availableLiquidity,
          totalIncome: processedDashboard.totalIncome,
          totalExpenses: processedDashboard.totalExpenses,
          monthlyIncome: processedDashboard.monthlyIncome,
          monthlyExpenses: processedDashboard.monthlyExpenses,
          savingsRate: processedDashboard.savingsRate,
          availableMonthlyFlow: processedDashboard.availableMonthlyFlow
        } : undefined;

        // 2. ACCOUNTS - Usa i dati processati con allocations, bankName e IBAN
        const accountsData = processedAccountArch ? {
          accounts: processedAccountArch.accountsWithAllocations.map(acc => ({
            name: acc.name,
            bank: (acc as any).bankName || acc.name,
            balance: acc.balance,
            type: acc.type as "income" | "wealth" | "operating" | "emergency" | "investment" | "savings",
            iban: (acc as any).iban || '',
            monthlyAllocation: acc.allocation
          })),
          totalLiquidity: processedAccountArch.totalBalance
        } : undefined;

        // 3. BUDGETS - Usa i dati processati con spent, percentage, status
        const budgets = processedBudgets?.map(b => ({
          category: b.category,
          budgetAmount: parseFloat(b.monthlyBudget || '0'),
          budgetType: b.budgetType,
          spentAmount: parseFloat(b.spent || '0'),
          percentage: parseFloat(b.percentage || '0'),
          status: b.status === 'over' || b.status === 'warning' ? 'exceeded' as const :
                  b.status === 'excellent' ? 'under_budget' as const : 'on_track' as const
        })) || [];

        const totalBudgeted = budgets.reduce((sum, b) => sum + b.budgetAmount, 0);
        const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
        const budgetsData = budgets.length > 0 ? { budgets, totalBudgeted, totalSpent } : undefined;

        // 4. TRANSACTIONS - Convert types and filter based on intent
        let transactions = transactionsRaw?.map(t => ({
          id: t.id.toString(),
          date: t.date,
          description: t.description,
          amount: parseFloat(t.amount || '0'),
          category: t.category,
          subcategory: t.subcategory,
          account: t.accountType,
          type: t.type,
          currency: t.currency
        })) || [];

        // Apply intent-based transaction filtering
        if (intent === 'finances_current') {
          // For current finances: show all transactions from current month
          const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
          transactions = transactions.filter(t => t.date.startsWith(currentMonth));
        } else if (intent === 'finances_historical') {
          // For historical finances: aggregate by category and month (no individual transactions)
          const aggregated: Record<string, any> = {};
          transactions.forEach(t => {
            const monthKey = t.date.slice(0, 7); // YYYY-MM
            const key = `${monthKey}_${t.category}`;
            if (!aggregated[key]) {
              aggregated[key] = {
                month: monthKey,
                category: t.category,
                totalAmount: 0,
                count: 0,
                type: t.type
              };
            }
            aggregated[key].totalAmount += t.amount;
            aggregated[key].count += 1;
          });
          // Convert aggregated data to array format (simplified for AI)
          transactions = Object.values(aggregated).map(agg => ({
            id: `agg_${agg.month}_${agg.category}`,
            date: agg.month,
            description: `${agg.category} - ${agg.count} transazioni`,
            amount: agg.totalAmount,
            category: agg.category,
            subcategory: '',
            account: '',
            type: agg.type,
            currency: 'EUR'
          }));
        } else if (intent === 'exercises' || intent === 'university' || intent === 'library' || intent === 'consultations') {
          // For non-finance intents: omit transactions completely
          transactions = [];
        } else {
          // For general intent: show only last 10 transactions
          transactions = transactions.slice(-10);
        }

        const transactionsData = transactions.length > 0 ? {
          transactions,
          totalCount: transactions.length
        } : undefined;

        // 5. BUDGET SETTINGS - Convert strings to numbers
        const budgetSettingsData = budgetSettingsRaw ? {
          monthlyIncome: parseFloat(budgetSettingsRaw.monthlyIncome || '0'),
          needsPercentage: parseFloat(budgetSettingsRaw.needsPercentage || '0'),
          wantsPercentage: parseFloat(budgetSettingsRaw.wantsPercentage || '0'),
          savingsPercentage: parseFloat(budgetSettingsRaw.savingsPercentage || '0')
        } : undefined;

        // 6. INVESTMENTS - Usa i dati processati con gain/loss
        const investments = processedInvestments?.map(inv => ({
          id: inv.id.toString(),
          name: inv.name,
          value: parseFloat(inv.currentValue || '0'),
          purchaseValue: parseFloat(inv.totalInvested || '0'),
          return: parseFloat(inv.gainLossPercent?.replace('%', '') || '0'),
          returnAmount: parseFloat(inv.gainLoss || '0'),
          type: inv.type
        })) || [];

        const totalValue = investments.reduce((sum, inv) => sum + inv.value, 0);
        const totalReturn = investments.length > 0
          ? investments.reduce((sum, inv) => sum + inv.return, 0) / investments.length
          : 0;
        const totalReturnAmount = investments.reduce((sum, inv) => sum + inv.returnAmount, 0);

        const investmentsData = investments.length > 0 ? {
          investments,
          totalValue,
          totalReturn,
          totalReturnAmount
        } : undefined;

        // 7. GOALS - Usa i dati processati con progress, deadlines, monthlyRequired
        const goalsData = processedGoals?.map(goal => {
          const targetAmount = parseFloat(goal.targetAmount || '0');
          const currentAmount = parseFloat(goal.currentAmount || '0');
          const monthlyContribution = parseFloat(goal.monthlyContribution || '0');

          let status: "on_track" | "behind" | "ahead" | "completed" = "on_track";
          if (goal.status === 'completed') {
            status = "completed";
          } else if (goal.status === 'overdue') {
            status = "behind";
          } else if (goal.status === 'on-track') {
            status = "on_track";
          } else if (goal.status === 'needs-attention') {
            status = "behind";
          } else if (goal.status === 'critical') {
            status = "behind";
          }

          return {
            id: goal.id.toString(),
            name: goal.name,
            targetAmount,
            currentAmount,
            deadline: goal.targetDate,
            monthlyContribution,
            status
          };
        }) || [];

        const totalGoalsAmount = goalsData.reduce((sum, g) => sum + g.targetAmount, 0);
        const totalSavedAmount = goalsData.reduce((sum, g) => sum + g.currentAmount, 0);
        const completedGoals = goalsData.filter(g => g.status === "completed").length;
        const activeGoalsCount = goalsData.filter(g => g.status !== "completed").length;

        const goalsContainer = goalsData.length > 0 ? {
          goals: goalsData,
          totalGoalsAmount,
          totalSavedAmount,
          completedGoals,
          activeGoals: activeGoalsCount
        } : undefined;

        // Build normalized FinanceData
        financeData = {
          dashboard: dashboardData,
          budgets: budgetsData,
          budgetsByMonth: Object.keys(budgetsByMonth).length > 0 ? budgetsByMonth : undefined,
          transactions: transactionsData,
          accounts: accountsData,
          budgetSettings: budgetSettingsData,
          investments: investmentsData,
          goals: goalsContainer,
          multiMonthAnalysis: multiMonthAnalysis as any,
        };

        const accountCount = accountsData?.accounts?.length || 0;
        const budgetCount = budgetsData?.budgets?.length || 0;
        const transactionCount = transactionsData?.transactions?.length || 0;
        console.log(`✅ Finance data fetched and transformed successfully (${accountCount} accounts, ${budgetCount} budgets, ${transactionCount} transactions)`);
      } catch (error) {
        console.error('❌ Error fetching Percorso Capitale data:', error);
      }
    } else {
      console.warn('⚠️ Percorso Capitale API credentials not configured');
    }
  }

  // ========================================
  // PHASE 6: Calculate Momentum Stats
  // ========================================

  // Process detailed check-ins for today and recent
  const todayDetailedCheckins = recentCheckinsRaw
    .filter((c: any) => {
      const checkinDate = new Date(c.timestamp).toISOString().split('T')[0];
      return checkinDate === today;
    })
    .map((c: any) => ({
      id: c.id,
      timestamp: c.timestamp,
      activityDescription: c.activityDescription,
      isProductive: c.isProductive,
      category: c.category,
      mood: c.mood,
      energyLevel: c.energyLevel,
      notes: c.notes,
    }));

  const recentDetailedCheckins = recentCheckinsRaw.map((c: any) => ({
    id: c.id,
    timestamp: c.timestamp,
    activityDescription: c.activityDescription,
    isProductive: c.isProductive,
    category: c.category,
    mood: c.mood,
    energyLevel: c.energyLevel,
    notes: c.notes,
  }));

  // Calculate totalCheckins and productiveCheckins from last 30 days
  const totalCheckins = last30DaysCheckins.length;
  const productiveCheckins = last30DaysCheckins.filter((c: any) => c.isProductive).length;
  const productivityRate = totalCheckins > 0 ? Math.round((productiveCheckins / totalCheckins) * 100) : 0;

  // Calculate averageMood from last 7 days (excluding NULL and undefined)
  const moodsLast7Days = last7DaysCheckins
    .map((c: any) => c.mood)
    .filter((m): m is number => m != null);
  const averageMood = moodsLast7Days.length > 0
    ? Math.round((moodsLast7Days.reduce((a: number, b: number) => a + b, 0) / moodsLast7Days.length) * 10) / 10
    : null;

  // Calculate averageEnergy from last 7 days (excluding NULL and undefined)
  const energyLast7Days = last7DaysCheckins
    .map((c: any) => c.energyLevel)
    .filter((e): e is number => e != null);
  const averageEnergy = energyLast7Days.length > 0
    ? Math.round((energyLast7Days.reduce((a: number, b: number) => a + b, 0) / energyLast7Days.length) * 10) / 10
    : null;

  // Calculate currentStreak (consecutive days with at least 1 productive check-in, starting from today backwards)
  let currentStreak = 0;
  if (allCheckinsForStreak.length > 0) {
    // Raggruppa check-in per giorno (aggregate check-ins by day)
    const checkinsPerDay = new Map<string, boolean>(); // date -> hasProductiveCheckin
    allCheckinsForStreak.forEach((c: any) => {
      const dayKey = c.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      if (c.isProductive) {
        checkinsPerDay.set(dayKey, true);
      } else if (!checkinsPerDay.has(dayKey)) {
        checkinsPerDay.set(dayKey, false);
      }
    });

    // Calcola streak a ritroso partendo da oggi (calculate streak backwards from today)
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date(today);

    while (true) {
      const dateKey = checkDate.toISOString().split('T')[0];
      if (checkinsPerDay.get(dateKey) === true) { // productive checkin quel giorno
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1); // vai al giorno precedente
      } else {
        break; // streak interrotto
      }

      // Safety limit: don't go back more than 365 days
      if (currentStreak >= 365) break;
    }
  }

  console.log(`📊 Momentum stats: ${totalCheckins} check-ins (${productiveCheckins} productive, ${productivityRate}% rate), streak: ${currentStreak} days`);

  // ========================================
  // PHASE 7: Calculate Calendar Stats
  // ========================================

  // Extract total upcoming count from count query (FIX BUG 1)
  const totalUpcoming = totalUpcomingCountResult[0]?.count || 0;

  // Calculate total ongoing events (FIX BUG 2)
  const totalOngoing = ongoingCalendarEvents.length;

  // Calculate events today (events that start OR end today, including ongoing)
  const todayDateString = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const upcomingToday = upcomingCalendarEvents.filter((e: any) => {
    const eventStartDate = e.start.toISOString().split('T')[0];
    const eventEndDate = e.end.toISOString().split('T')[0];
    return eventStartDate === todayDateString || eventEndDate === todayDateString;
  }).length;
  const ongoingToday = ongoingCalendarEvents.filter((e: any) => {
    const eventStartDate = e.start.toISOString().split('T')[0];
    const eventEndDate = e.end.toISOString().split('T')[0];
    return eventStartDate === todayDateString || eventEndDate === todayDateString;
  }).length;
  const recentToday = recentCalendarEvents.filter((e: any) => {
    const eventStartDate = e.start.toISOString().split('T')[0];
    const eventEndDate = e.end.toISOString().split('T')[0];
    return eventStartDate === todayDateString || eventEndDate === todayDateString;
  }).length;
  const eventsToday = upcomingToday + ongoingToday + recentToday;

  // Calculate events this week (next 7 days from today, including ongoing)
  const oneWeekFromNow = new Date();
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
  const upcomingThisWeek = upcomingCalendarEvents.filter((e: any) => {
    return e.start <= oneWeekFromNow;
  }).length;
  const ongoingThisWeek = ongoingCalendarEvents.filter((e: any) => {
    return e.end <= oneWeekFromNow;
  }).length;
  const eventsThisWeek = upcomingThisWeek + ongoingThisWeek;

  console.log(`📅 Calendar stats: ${totalUpcoming} total upcoming (${totalOngoing} ongoing, ${eventsToday} today, ${eventsThisWeek} this week)`);

  // ========================================
  // Build and cache the complete context
  // ========================================
  const currentDateTime = new Date();

  // Detailed mapping for active goals and calendar events
  const activeGoalsDetailed = activeGoals.map((g: any) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    progress: g.progress || 0,
    category: g.category,
    targetDate: g.targetDate 
      ? (typeof g.targetDate === 'string' ? g.targetDate : g.targetDate.toISOString()) 
      : null,
    status: g.status,
    createdAt: g.createdAt,
  }));

  const upcomingEventsDetailed = upcomingCalendarEvents.map((e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    color: e.color,
  }));

  const ongoingEventsDetailed = ongoingCalendarEvents.map((e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    color: e.color,
  }));

  const recentEventsDetailed = recentCalendarEvents.map((e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    color: e.color,
  }));

  const context: UserContext = {
    currentDate: currentDateTime.toISOString().split('T')[0], // YYYY-MM-DD
    currentDateTime: currentDateTime.toISOString(), // Full ISO string
    user: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      level: user.level || 'studente',
      enrolledAt: user.enrolledAt ? user.enrolledAt.toISOString() : null,
    },
    dashboard: {
      pendingExercises: allExercises.filter(e => e.status === 'pending' || e.status === 'in_progress').length,
      completedExercises: allExercises.filter(e => e.status === 'completed').length,
      todayTasks: todayTasks.filter(t => !t.completed).length,
      upcomingConsultations: upcomingConsultations.length,
    },
    exercises: {
      all: allExercises,
    },
    university: {
      assignedYears,
      overallProgress: {
        totalLessons,
        completedLessons,
        progressPercentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      },
    },
    dailyActivity: {
      todayTasks: todayTasks.map((t: any) => ({
        id: t.id,
        description: t.description,
        completed: t.completed,
      })),
      todayReflection: todayReflection ? {
        grateful: todayReflection.grateful as string[],
        makeGreat: todayReflection.makeGreat as string[],
        doBetter: todayReflection.doBetter,
      } : null,
    },
    consultations: {
      upcoming: upcomingConsultations,
      recent: recentConsultations,
    },
    consultationTasks: allConsultationTasks.map((t: any) => ({
      id: t.id,
      consultationId: t.consultationId,
      title: t.title,
      description: t.description,
      category: t.category,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      completed: t.completed,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    })),
    goals: userGoals.map((g: any) => ({
      id: g.id,
      title: g.title,
      targetValue: g.targetValue,
      currentValue: g.currentValue || '0',
      status: g.status,
      targetDate: g.targetDate ? g.targetDate.toISOString() : null,
    })),
    roadmap: {
      phases: roadmapData,
    },
    library: {
      documents: libraryDocs,
    },
    momentum: {
      recentCheckins: recentDetailedCheckins,
      activeGoals: activeGoalsDetailed,
      stats: {
        totalCheckins,
        productiveCheckins,
        productivityRate,
        averageMood,
        averageEnergy,
        currentStreak,
        todayCheckins: todayDetailedCheckins,
        recentCheckins: recentDetailedCheckins,
      },
    },
    calendar: {
      upcomingEvents: upcomingEventsDetailed,
      ongoingEvents: ongoingEventsDetailed,
      recentEvents: recentEventsDetailed,
      stats: {
        totalUpcoming,
        totalOngoing,
        eventsToday,
        eventsThisWeek,
      },
    },
    financeData,
  };

  // ========================================
  // CACHE STRATEGY: Skip caching for specific pageContext
  // ========================================
  // When user is on a specific page (exercise, library doc, lesson),
  // the context is filtered to ONLY that resource.
  // We should NOT cache this filtered context because it would cause
  // "cache poisoning" if reused later in the general assistant.
  //
  // Example bug scenario:
  // 1. User on exercise page → context filtered to 1 exercise → saved to cache
  // 2. User goes to general assistant → reuses cache with 1 exercise → BUG!
  //
  // Solution: Only cache general/broad contexts, not page-specific ones.
  const hasSpecificPageContext = 
    pageContext?.pageType === 'exercise' ||
    pageContext?.pageType === 'library_document' ||
    pageContext?.pageType === 'university_lesson';

  if (hasSpecificPageContext) {
    console.log(`⚠️ Skipping cache save - context is specific to pageType: ${pageContext.pageType}`);
    console.log(`   (Filtered context for "${pageContext.resourceTitle || pageContext.resourceId}" should not pollute general cache)`);
  } else {
    // Store in cache with scoped key (prevents cache poisoning for general contexts)
    userContextCache.set(cacheKey, { context, timestamp: Date.now() });
    console.log(`💾 Stored fresh context in cache for client ${clientId} (intent: ${intent})`);
  }

  // Merge conversation data if provided (after cache to avoid cache poisoning)
  if (options?.conversation) {
    context.conversation = {
      isProactiveLead: options.conversation.isProactiveLead || false,
      proactiveLeadId: options.conversation.proactiveLeadId || null,
      isLead: options.conversation.isLead || false,
      messageCount: options.conversation.messageCount || 0,
    };
    console.log(`🔄 Added conversation context: isProactiveLead=${context.conversation.isProactiveLead}, messageCount=${context.conversation.messageCount}`);
  }

  return context;
}