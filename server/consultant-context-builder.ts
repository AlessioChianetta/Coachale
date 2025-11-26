// Consultant Context Builder
// Builds comprehensive consultant context for AI Assistant
// Mirrors client context builder architecture but focuses on consultant workflow data

import { db } from "./db";
import {
  users,
  exerciseAssignments,
  exercises,
  exerciseSubmissions,
  consultations,
  consultationTasks,
  goals,
  calendarEvents,
  whatsappConversations,
  whatsappMessages,
  proactiveLeads,
  emailCampaigns,
  schedulerExecutionLog,
  emailDrafts,
  universityYears,
  universityYearClientAssignments,
  universityProgress,
  universityTemplates,
  universityTrimesters,
  universityModules,
  universityLessons,
  clientStateTracking,
  consultantSmtpSettings,
  emailJourneyTemplates,
  whatsappCustomTemplates,
  whatsappTemplateVersions,
  whatsappTemplateVariables,
  whatsappVariableCatalog,
  whatsappTemplateAssignments,
  libraryCategories,
  libraryDocuments,
  exerciseTemplates,
  automatedEmailsLog,
  clientEmailAutomation,
  clientEmailJourneyProgress,
  consultantWhatsappConfig,
  marketingCampaigns,
  campaignAnalytics,
  externalApiConfigs,
  externalLeadImportLogs,
  consultantAvailabilitySettings,
} from "../shared/schema";
import { eq, and, desc, gte, sql, inArray, count, asc } from "drizzle-orm";
import twilio from "twilio";


// ========================================
// TOKEN ESTIMATION UTILITIES
// ========================================

// Helper function to estimate token count (approximate: 4 chars = 1 token)
function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// Helper function to mask sensitive credentials (first 4 + last 4 chars only)
function maskSensitiveCredential(value: string | null): string | null {
  if (!value || value.length < 8) return null;
  const prefix = value.substring(0, 4);
  const suffix = value.substring(value.length - 4);
  return `${prefix}***...***${suffix}`;
}

// Calculate detailed token breakdown by context section
function calculateConsultantTokenBreakdown(context: ConsultantContext): {
  dashboard: number;
  clients: number;
  exercises: number;
  emailMarketing: number;
  whatsappLeads: number;
  calendar: number;
  consultations: number;
  consultationTasks: number;
  clientGoals: number;
  clientStates: number;
  smtpConfiguration: number;
  emailTemplates: number;
  whatsappTemplates: number;
  libraryDocuments: number;
  exerciseFeedback: number;
  university: number;
  exerciseTemplates: number;
  emailMarketingDetailed: number;
  whatsappDetailed: number;
  aiAgents: number;
  leadManagement: number;
  campaignMarketing: number;
  apiSettings: number;
  whatsappConfig: number;
  whatsappTemplatesDetailed: number;
  whatsappTemplateAssignments: number;
  twilioTemplates: number;
  calendarSettings: number;
  base: number;
  total: number;
} {
  const dashboardTokens = estimateTokens(JSON.stringify(context.dashboard));
  const clientsTokens = estimateTokens(JSON.stringify(context.clients));
  const exercisesTokens = estimateTokens(JSON.stringify(context.exercises));
  const emailMarketingTokens = estimateTokens(JSON.stringify(context.emailMarketing));
  const whatsappLeadsTokens = estimateTokens(JSON.stringify(context.whatsappLeads));
  const calendarTokens = estimateTokens(JSON.stringify(context.calendar));
  const consultationsTokens = estimateTokens(JSON.stringify(context.consultations));
  const consultationTasksTokens = estimateTokens(JSON.stringify(context.consultationTasks));
  const clientGoalsTokens = estimateTokens(JSON.stringify(context.clientGoals));
  const clientStatesTokens = estimateTokens(JSON.stringify(context.clientStates));
  const smtpConfigurationTokens = estimateTokens(JSON.stringify(context.smtpConfiguration));
  const emailTemplatesTokens = estimateTokens(JSON.stringify(context.emailTemplates));
  const whatsappTemplatesTokens = estimateTokens(JSON.stringify(context.whatsappTemplates));
  const libraryDocumentsTokens = estimateTokens(JSON.stringify(context.libraryDocuments));
  const exerciseFeedbackTokens = estimateTokens(JSON.stringify(context.exerciseFeedback));
  const universityTokens = estimateTokens(JSON.stringify(context.university));
  const exerciseTemplatesTokens = estimateTokens(JSON.stringify(context.exerciseTemplates));
  
  // Optional sections (only if present)
  const emailMarketingDetailedTokens = context.emailMarketingDetailed 
    ? estimateTokens(JSON.stringify(context.emailMarketingDetailed))
    : 0;
  const whatsappDetailedTokens = context.whatsappDetailed
    ? estimateTokens(JSON.stringify(context.whatsappDetailed))
    : 0;
  const aiAgentsTokens = context.aiAgents
    ? estimateTokens(JSON.stringify(context.aiAgents))
    : 0;
  const leadManagementTokens = context.leadManagement
    ? estimateTokens(JSON.stringify(context.leadManagement))
    : 0;
  const campaignMarketingTokens = context.campaignMarketing
    ? estimateTokens(JSON.stringify(context.campaignMarketing))
    : 0;
  const apiSettingsTokens = context.apiSettings
    ? estimateTokens(JSON.stringify(context.apiSettings))
    : 0;
  const whatsappConfigTokens = context.whatsappConfig
    ? estimateTokens(JSON.stringify(context.whatsappConfig))
    : 0;
  const whatsappTemplatesDetailedTokens = context.whatsappTemplatesDetailed
    ? estimateTokens(JSON.stringify(context.whatsappTemplatesDetailed))
    : 0;
  const whatsappTemplateAssignmentsTokens = context.whatsappTemplateAssignments
    ? estimateTokens(JSON.stringify(context.whatsappTemplateAssignments))
    : 0;
  const twilioTemplatesTokens = context.twilioTemplates
    ? estimateTokens(JSON.stringify(context.twilioTemplates))
    : 0;
  const calendarSettingsTokens = context.calendarSettings
    ? estimateTokens(JSON.stringify(context.calendarSettings))
    : 0;
  
  // Base context (consultant profile + timestamps)
  const baseTokens = estimateTokens(JSON.stringify({
    currentDate: context.currentDate,
    currentDateTime: context.currentDateTime,
    consultant: context.consultant,
  })) + 5000; // +5k for static system prompts
  
  const total = 
    dashboardTokens +
    clientsTokens +
    exercisesTokens +
    emailMarketingTokens +
    whatsappLeadsTokens +
    calendarTokens +
    consultationsTokens +
    consultationTasksTokens +
    clientGoalsTokens +
    clientStatesTokens +
    smtpConfigurationTokens +
    emailTemplatesTokens +
    whatsappTemplatesTokens +
    libraryDocumentsTokens +
    exerciseFeedbackTokens +
    universityTokens +
    exerciseTemplatesTokens +
    emailMarketingDetailedTokens +
    whatsappDetailedTokens +
    aiAgentsTokens +
    leadManagementTokens +
    campaignMarketingTokens +
    apiSettingsTokens +
    whatsappConfigTokens +
    whatsappTemplatesDetailedTokens +
    whatsappTemplateAssignmentsTokens +
    twilioTemplatesTokens +
    calendarSettingsTokens +
    baseTokens;
  
  return {
    dashboard: dashboardTokens,
    clients: clientsTokens,
    exercises: exercisesTokens,
    emailMarketing: emailMarketingTokens,
    whatsappLeads: whatsappLeadsTokens,
    calendar: calendarTokens,
    consultations: consultationsTokens,
    consultationTasks: consultationTasksTokens,
    clientGoals: clientGoalsTokens,
    clientStates: clientStatesTokens,
    smtpConfiguration: smtpConfigurationTokens,
    emailTemplates: emailTemplatesTokens,
    whatsappTemplates: whatsappTemplatesTokens,
    libraryDocuments: libraryDocumentsTokens,
    exerciseFeedback: exerciseFeedbackTokens,
    university: universityTokens,
    exerciseTemplates: exerciseTemplatesTokens,
    emailMarketingDetailed: emailMarketingDetailedTokens,
    whatsappDetailed: whatsappDetailedTokens,
    aiAgents: aiAgentsTokens,
    leadManagement: leadManagementTokens,
    campaignMarketing: campaignMarketingTokens,
    apiSettings: apiSettingsTokens,
    whatsappConfig: whatsappConfigTokens,
    whatsappTemplatesDetailed: whatsappTemplatesDetailedTokens,
    whatsappTemplateAssignments: whatsappTemplateAssignmentsTokens,
    twilioTemplates: twilioTemplatesTokens,
    calendarSettings: calendarSettingsTokens,
    base: baseTokens,
    total,
  };
}

// ========================================
// CONSULTANT INTENT DETECTION
// ========================================

export type ConsultantIntent = 
  | 'clients_overview' 
  | 'exercises_management' 
  | 'email_marketing' 
  | 'whatsapp_leads' 
  | 'calendar_scheduling' 
  | 'client_specific'
  | 'ai_agents'
  | 'lead_management'
  | 'campaign_marketing'
  | 'api_settings'
  | 'whatsapp_config_management'
  | 'general';

export function detectConsultantIntent(message: string): ConsultantIntent {
  const lower = message.toLowerCase();

  // Client-specific queries (highest priority)
  if (lower.match(/client[ei].*\b(mario|giulia|luca|[A-Z][a-z]+)\b|chi è|stato.*di.*cliente|progressi.*di|come.*sta/i)) {
    console.log(`👤 [INTENT: client_specific] Query specifica su un cliente`);
    return 'client_specific';
  }

  // Email Marketing - PRIORITY CHECK: explicit email + campaign markers (before campaign_marketing)
  // This prevents "campagne email" from being captured by the generic campaign pattern
  if (lower.match(/email.*campagn|campagn.*email|smtp|newsletter|journey.*email|template.*journey|automation.*email|open.*rate|email.*automation|scheduler.*email|invia.*email.*automat/i)) {
    console.log(`📧 [INTENT: email_marketing] Email marketing (marker espliciti rilevati)`);
    return 'email_marketing';
  }

  // AI agents - performance, metrics, agents
  if (lower.match(/agenti.*intelligenti|dot|millie|echo|spec|performance.*agent|metriche.*agent/i)) {
    console.log(`🤖 [INTENT: ai_agents] Agenti AI e metriche`);
    return 'ai_agents';
  }

  // Lead Management - proactive leads, import, status, contact, convert (must have specific context to avoid WhatsApp conflicts)
  if (lower.match(/(?:proattiv|import.*lead|status.*lead|contatt.*lead|converti.*lead|gestione.*lead|lead.*(?:pendent|risposto|freddo|tiepido|caldo|recupero|categoria)|quant[io].*lead|lead.*da.*contattare)/i)) {
    console.log(`🎯 [INTENT: lead_management] Gestione lead`);
    return 'lead_management';
  }

  // Campaign Marketing - WhatsApp/Lead campaigns with specific context
  // Tightened to require WhatsApp/lead/marketing terminology paired with "campagn"
  if (lower.match(/campagn.*marketing|marketing.*campagn|campagn.*whatsapp|whatsapp.*campagn|campagn.*lead|lead.*campagn|uncino|conversion.*rate.*campagn|campagn.*conversion|campagn.*attiv|template.*whatsapp.*campagn|nuova.*campagn|crea.*campagn|analytic.*campagn|performance.*campagn|roi.*campagn/i)) {
    console.log(`📊 [INTENT: campaign_marketing] Campagne Marketing (WhatsApp/Lead)`);
    return 'campaign_marketing';
  }

  // WhatsApp Config Management - configuration, templates, agents, services
  if (lower.match(/config.*whatsapp|whatsapp.*config|template.*whatsapp|whatsapp.*template|agenti.*whatsapp|whatsapp.*agenti|servizi.*offer|offer.*serviz|vision.*mission|anni.*esperienza|clienti.*aiutat|case.*stud|garanzie|valore.*predefinit|lead.*default|credenziali.*twilio/i)) {
    console.log(`📱 [INTENT: whatsapp_config_management] Configurazione WhatsApp completa`);
    return 'whatsapp_config_management';
  }

  // API Settings - external API configuration, imports, polling
  if (lower.match(/api.*config|import.*api|external.*api|polling|impostazion.*api|connession.*api|test.*api|log.*import|api.*estern/i)) {
    console.log(`🔌 [INTENT: api_settings] Impostazioni API`);
    return 'api_settings';
  }

  // Clients overview - portfolio, stats, chi è indietro
  if (lower.match(/client[ei]|portfolio|quant[io].*client|attiv[io]|inattiv[io]|indietro|progresso|completamento/i)) {
    console.log(`👥 [INTENT: clients_overview] Panoramica clienti`);
    return 'clients_overview';
  }

  // Exercise management - assignments, reviews, pending
  if (lower.match(/eserciz[io]|assignment|da.*revidere|pending|compiti|valutare|feedback.*dare/i)) {
    console.log(`📝 [INTENT: exercises_management] Gestione esercizi`);
    return 'exercises_management';
  }

  // Email marketing - FALLBACK for generic email queries (after campaign check)
  // Removed "campagn[ae]" to avoid conflicts with campaign_marketing
  if (lower.match(/email|invia[to].*email|automat.*email|journey|log.*scheduler|aperture|giorno.*\d+|smtp.*config|smtp.*test/i)) {
    console.log(`📧 [INTENT: email_marketing] Email marketing (query generica)`);
    return 'email_marketing';
  }

  // WhatsApp & leads - conversations, booking, leads, AI agents, chats
  if (lower.match(/whatsapp|lead|conversazion[ei]|messagg[io]|prenot[ao]|appuntament[io].*lead|agente.*ai|chat.*ai|conversazioni.*recenti/i)) {
    console.log(`💬 [INTENT: whatsapp_leads] WhatsApp e lead`);
    return 'whatsapp_leads';
  }

  // Calendar & scheduling - appointments, availability
  if (lower.match(/calendar[io]|appuntament[io]|disponibilit[àa]|agende|slot|consulenz[ae].*data/i)) {
    console.log(`📅 [INTENT: calendar_scheduling] Calendario`);
    return 'calendar_scheduling';
  }

  return 'general';
}

// ========================================
// IN-MEMORY CACHE WITH TTL
// ========================================
const consultantContextCache = new Map<string, { context: ConsultantContext; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();
  let removedCount = 0;

  for (const [consultantId, entry] of Array.from(consultantContextCache.entries())) {
    if (now - entry.timestamp >= CACHE_TTL) {
      consultantContextCache.delete(consultantId);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`🧹 [Consultant Cache] Cleaned up ${removedCount} expired entries`);
  }
}, 10 * 60 * 1000);

export function clearConsultantContextCache(consultantId?: string): void {
  if (consultantId) {
    // Clear all cache entries for this consultant (all intents)
    let deletedCount = 0;
    for (const key of Array.from(consultantContextCache.keys())) {
      if (key.startsWith(`${consultantId}-`)) {
        consultantContextCache.delete(key);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      console.log(`🗑️ Cleared ${deletedCount} consultant cache entries for ${consultantId}`);
    }
  } else {
    const size = consultantContextCache.size;
    consultantContextCache.clear();
    console.log(`🗑️ Cleared entire consultant cache (${size} entries)`);
  }
}

// ========================================
// CONSULTANT PAGE CONTEXT INTERFACE
// ========================================

export interface ConsultantPageContext {
  pageType: string; // es: 'whatsapp_config' | 'calendar_settings' | 'clients_management' | 'dashboard' | 'campaigns' | ...
  stats?: {
    totalClients?: number;
    activeClients?: number;
    unreadWhatsAppMessages?: number;
    upcomingAppointments?: number;
    pendingReviews?: number;
    activeCampaigns?: number;
    totalLeads?: number;
    [key: string]: number | undefined; // Allow dynamic stats
  };
}

// ========================================
// CONSULTANT CONTEXT INTERFACE
// ========================================

export interface ConsultantContext {
  currentDate: string;
  currentDateTime: string;
  consultant: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  dashboard: {
    totalClients: number;
    activeClients: number;
    pendingReviews: number;
    upcomingAppointments: number;
    todayAppointments: number;
  };
  clients: {
    all: Array<{
      id: string;
      name: string;
      email: string;
      level: string;
      enrolledAt: string | null;
      lastActivity: string | null;
      stats: {
        assignedExercises: number;
        completedExercises: number;
        pendingExercises: number;
        completionRate: number;
        universityProgress: number;
        recentConsultations: number;
      };
    }>;
  };
  exercises: {
    pendingReviews: Array<{
      id: string;
      exerciseTitle: string;
      clientName: string;
      submittedAt: string;
      dueDate: string | null;
    }>;
    recentlyCreated: Array<{
      id: string;
      title: string;
      category: string;
      assignedTo: number;
      createdAt: string;
    }>;
    stats: {
      totalCreated: number;
      totalAssigned: number;
      awaitingReview: number;
      completedThisWeek: number;
    };
  };
  emailMarketing: {
    automation: {
      enabled: boolean;
      schedulerActive: boolean;
      lastRun: string | null;
      nextRun: string | null;
    };
    recentDrafts: Array<{
      id: string;
      clientName: string;
      subject: string;
      status: string;
      generatedAt: string;
    }>;
    stats: {
      totalSent: number;
      sentThisWeek: number;
      sentThisMonth: number;
      pendingDrafts: number;
    };
  };
  whatsappLeads: {
    activeLeads: Array<{
      id: string;
      phoneNumber: string;
      name: string | null;
      status: string;
      lastMessage: string;
      lastMessageAt: string;
    }>;
    recentConversations: Array<{
      id: string;
      phoneNumber: string;
      participantName: string | null;
      lastMessage: string;
      lastMessageAt: string;
      unreadCount: number;
    }>;
    stats: {
      totalLeads: number;
      qualifiedLeads: number;
      appointmentsBooked: number;
      activeConversations: number;
    };
  };
  calendar: {
    upcomingAppointments: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      clientName: string | null;
      consultationType: string | null;
      relatedEmails?: Array<{
        id: string;
        subject: string;
        status: string;
        generatedAt: string;
      }>;
    }>;
    todayEvents: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
    }>;
    stats: {
      totalUpcoming: number;
      todayCount: number;
      thisWeekCount: number;
    };
  };
  consultations: {
    upcoming: Array<{
      id: string;
      clientName: string;
      scheduledAt: string;
      status: string;
      notes: string | null;
    }>;
    recent: Array<{
      id: string;
      clientName: string;
      scheduledAt: string;
      status: string;
      summary: string | null;
    }>;
    stats: {
      total: number;
      upcoming: number;
      completed: number;
      thisWeek: number;
    };
  };
  consultationTasks: {
    pending: Array<{
      id: string;
      consultationId: string;
      clientName: string;
      title: string;
      dueDate: string | null;
      priority: string;
      category: string;
    }>;
    stats: {
      total: number;
      pending: number;
      completed: number;
      overdue: number;
    };
  };
  clientGoals: {
    active: Array<{
      id: string;
      clientName: string;
      title: string;
      description: string | null;
      deadline: string | null;
      targetValue: string;
      currentValue: string;
      unit: string | null;
      progress: number;
      status: string;
    }>;
    stats: {
      total: number;
      active: number;
      completed: number;
      avgProgress: number;
    };
  };
  clientStates: {
    all: Array<{
      id: string;
      clientId: string;
      clientName: string;
      currentState: string;
      idealState: string;
      internalBenefit: string | null;
      externalBenefit: string | null;
      mainObstacle: string | null;
      pastAttempts: string | null;
      currentActions: string | null;
      futureVision: string | null;
      motivationDrivers: string | null;
      lastUpdated: string;
      createdAt: string;
    }>;
    stats: {
      totalWithState: number;
      totalWithoutState: number;
    };
  };
  smtpConfiguration: {
    configured: boolean;
    fromEmail: string | null;
    fromName: string | null;
    automationEnabled: boolean;
    emailTone: string | null;
  };
  emailTemplates: {
    available: Array<{
      id: string;
      dayOfMonth: number;
      title: string;
      emailType: string;
      tone: string;
      isActive: boolean;
    }>;
    stats: {
      total: number;
      active: number;
    };
  };
  whatsappTemplates: {
    custom: Array<{
      id: string;
      templateName: string;
      templateType: string;
      currentVersion: string | null;
      isActive: boolean;
    }>;
    stats: {
      total: number;
      active: number;
    };
  };
  libraryDocuments: {
    recent: Array<{
      id: string;
      title: string;
      category: string;
      contentType: string;
      level: string;
      isPublished: boolean;
    }>;
    stats: {
      total: number;
      published: number;
      categories: number;
    };
  };
  exerciseFeedback: {
    recent: Array<{
      id: string;
      exerciseTitle: string;
      clientName: string;
      feedbackItems: Array<{
        feedback: string;
        timestamp: string;
      }>;
      lastFeedbackAt: string;
    }>;
    stats: {
      total: number;
      withFeedback: number;
    };
  };
  university: {
    templates: Array<{
      id: string;
      name: string;
      description: string | null;
      isActive: boolean;
      createdAt: string;
    }>;
    yearAssignments: Array<{
      id: string;
      clientName: string;
      yearName: string;
      assignedAt: string;
      progress: number;
      completedLessons: number;
      totalLessons: number;
      trimesters: Array<{
        id: string;
        title: string;
        modules: Array<{
          id: string;
          title: string;
          lessons: Array<{
            id: string;
            title: string;
            isCompleted: boolean;
          }>;
        }>;
      }>;
    }>;
    stats: {
      totalTemplates: number;
      activeTemplates: number;
      totalAssignments: number;
      avgProgress: number;
      activeStudents: number;
    };
  };
  exerciseTemplates: {
    available: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      type: string;
      usageCount: number;
      estimatedDuration: number | null;
      createdAt: string;
    }>;
    stats: {
      total: number;
      totalUsage: number;
      byCategory: Record<string, number>;
    };
  };
  emailMarketingDetailed?: {
    smtpConfig: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      fromEmail: string;
      fromName: string;
      emailTone: string | null;
      emailSignature: string | null;
      emailFrequencyDays: number;
      isActive: boolean;
    } | null;
    schedulerLogs: Array<{
      id: string;
      executedAt: string;
      clientsProcessed: number;
      emailsSent: number;
      draftsCreated: number;
      errors: number;
      status: 'success' | 'partial' | 'failed';
      errorDetails: string | null;
    }>;
    emailHistory: Array<{
      id: string;
      clientId: string;
      clientName: string;
      subject: string;
      emailType: string;
      journeyDay: number | null;
      sentAt: string;
      openedAt: string | null;
      includesTasks: boolean;
      includesGoals: boolean;
      isTest: boolean;
    }>;
    journeyTemplates: Array<{
      id: string;
      dayOfMonth: number;
      title: string;
      description: string;
      emailType: string;
      tone: string;
      priority: number;
      isActive: boolean;
    }>;
    clientAutomation: Array<{
      clientId: string;
      clientName: string;
      automationEnabled: boolean;
      currentDay: number | null;
      lastEmailSentAt: string | null;
      nextEmailDate: string | null;
      journeyTemplateTitle: string | null;
    }>;
  };
  whatsappDetailed?: {
    conversations: Array<{
      id: string;
      phoneNumber: string;
      userId: string | null;
      clientName: string | null;
      agentName: string;
      isLead: boolean;
      aiEnabled: boolean;
      lastMessageAt: string;
      lastMessageText: string;
      lastMessageFrom: string;
      unreadCount: number;
      messageCount: number;
    }>;
    recentMessages: Array<{
      conversationId: string;
      messages: Array<{
        id: string;
        text: string;
        sender: 'client' | 'consultant' | 'ai';
        createdAt: string;
      }>;
    }>;
    agents: Array<{
      id: string;
      name: string;
      systemPrompt: string | null;
      personality: string | null;
      isDryRun: boolean;
      isActive: boolean;
    }>;
    metrics: {
      totalConversations: number;
      aiEnabledCount: number;
      messagesToday: number;
      messagesThisWeek: number;
      leadsConverted: number;
    };
  };
  aiAgents?: {
    dot: {
      name: string;
      role: string;
      conversationsManaged: number;
      appointmentsBooked: number;
      leadsQualified: number;
      avgResponseTime: string | null;
    };
    millie: {
      name: string;
      role: string;
      emailsGenerated: number;
      draftsPending: number;
      emailsSentThisWeek: number;
      openRate: number;
    };
    echo: {
      name: string;
      role: string;
      summariesGenerated: number;
      consultationEmailsSent: number;
      avgSummaryLength: number;
    };
    spec: {
      name: string;
      role: string;
      clientConversations: number;
      questionsAnswered: number;
      documentsReferenced: number;
    };
  };
  leadManagement?: {
    leads: Array<{
      id: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
      campaignId: string | null;
      campaignName: string | null;
      agentConfigId: string;
      agentName: string;
      leadCategory: string | null;
      status: string;
      contactSchedule: string;
      lastContactedAt: string | null;
      lastMessageSent: string | null;
      idealState: string | null;
      leadInfo: {
        obiettivi?: string;
        desideri?: string;
        uncino?: string;
        fonte?: string;
      };
      metadata: {
        tags?: string[];
        notes?: string;
        conversationId?: string;
      };
    }>;
    stats: {
      total: number;
      byStatus: {
        pending: number;
        contacted: number;
        responded: number;
        converted: number;
        inactive: number;
      };
      byCategory: {
        freddo: number;
        tiepido: number;
        caldo: number;
        recupero: number;
        referral: number;
      };
      conversionRate: number;
      avgResponseTime: number | null;
      scheduledToday: number;
      scheduledThisWeek: number;
    };
    byCampaign: Array<{
      campaignId: string | null;
      campaignName: string;
      leadCount: number;
      convertedCount: number;
      conversionRate: number;
    }>;
  };
  campaignMarketing?: {
    campaigns: Array<{
      id: string;
      campaignName: string;
      campaignType: string;
      leadCategory: string;
      hookText: string | null;
      idealStateDescription: string | null;
      implicitDesires: string | null;
      defaultObiettivi: string | null;
      preferredAgentName: string | null;
      templateAssignments: {
        opening: string | null;
        followupGentle: string | null;
        followupValue: string | null;
        followupFinal: string | null;
      };
      totalLeads: number;
      convertedLeads: number;
      conversionRate: number;
      isActive: boolean;
      createdAt: string;
    }>;
    analytics: {
      last30Days: Array<{
        campaignId: string;
        campaignName: string;
        date: string;
        leadsCreated: number;
        leadsContacted: number;
        leadsResponded: number;
        leadsConverted: number;
        avgResponseTimeHours: number | null;
        conversionRate: number;
      }>;
      summary: {
        totalCampaigns: number;
        activeCampaigns: number;
        totalLeadsAllTime: number;
        totalConvertedAllTime: number;
        avgConversionRate: number;
        bestPerformingCampaign: {
          name: string;
          conversionRate: number;
        } | null;
      };
    };
  };
  apiSettings?: {
    configs: Array<{
      id: string;
      configName: string;
      baseUrl: string;
      apiKeyMasked: string;
      leadType: string;
      sourceFilter: string | null;
      campaignFilter: string | null;
      daysFilter: string | null;
      targetCampaignId: string | null;
      targetCampaignName: string | null;
      pollingEnabled: boolean;
      pollingIntervalMinutes: number;
      isActive: boolean;
      lastImportAt: string | null;
      lastImportStatus: string | null;
      lastImportLeadsCount: number;
      lastImportErrorMessage: string | null;
      nextScheduledRun: string | null;
    }>;
    recentImports: Array<{
      id: string;
      configId: string;
      configName: string;
      importType: string;
      status: string;
      leadsProcessed: number;
      leadsImported: number;
      leadsUpdated: number;
      leadsDuplicated: number;
      leadsErrored: number;
      errorMessage: string | null;
      startedAt: string;
      completedAt: string | null;
      durationMs: number | null;
    }>;
    stats: {
      totalConfigs: number;
      activeConfigs: number;
      pollingEnabledCount: number;
      totalImportsLast30Days: number;
      totalLeadsImportedLast30Days: number;
      avgImportDurationMs: number;
      lastSuccessfulImport: string | null;
    };
  };
  whatsappConfig?: {
    configured: boolean;
    accountSidMasked: string | null;
    authTokenMasked: string | null;
    whatsappNumber: string | null;
    isActive: boolean;
    autoResponseEnabled: boolean;
    workingHoursEnabled: boolean;
    workingHoursStart: string | null;
    workingHoursEnd: string | null;
    workingDays: string[] | null;
    businessName: string | null;
    consultantDisplayName: string | null;
    isDryRun: boolean;
    agentName: string;
  };
  pageContext?: {
    pageType: string;
    contextNotes: string[];
  };
}

// ========================================
// BUILD CONSULTANT CONTEXT
// ========================================

export async function buildConsultantContext(
  consultantId: string,
  options?: {
    intent?: ConsultantIntent;
    message?: string;
    pageContext?: ConsultantPageContext;
  }
): Promise<ConsultantContext> {
  let intent: ConsultantIntent = options?.intent || 'general';
  
  // Always detect intent from message if not explicitly provided
  if (!options?.intent && options?.message) {
    intent = detectConsultantIntent(options.message);
    console.log(`🔍 [Intent Detection] Detected intent from message: ${intent}`);
  }
  
  // If pageContext is provided, optionally refine intent for vague messages
  // IMPORTANT: Only override if detected intent is 'general' (low confidence)
  if (options?.pageContext && options?.message && intent === 'general') {
    const pageType = options.pageContext.pageType;
    const messageLower = options.message.toLowerCase();
    
    // Page-specific intent refinement (only if message is vague AND intent is general)
    const isVagueMessage = messageLower.length < 20 || 
      messageLower.match(/^(come|cosa|mostra|vedi|stats?|info|aiuto|help|stato)/i);
    
    if (isVagueMessage) {
      // Map pageType to intent for vague queries
      const pageToIntentMap: Record<string, ConsultantIntent> = {
        'whatsapp_config': 'whatsapp_config_management',
        'calendar_settings': 'calendar_scheduling',
        'clients_management': 'clients_overview',
        'campaigns': 'campaign_marketing',
        'lead_management': 'lead_management',
        'ai_agents': 'ai_agents',
        'email_marketing': 'email_marketing',
        'api_settings': 'api_settings',
      };
      
      const mappedIntent = pageToIntentMap[pageType];
      if (mappedIntent) {
        intent = mappedIntent;
        console.log(`🎯 [Page Context] Vague message on ${pageType} with general intent → overriding to: ${intent}`);
      }
    }
  }
  
  const cacheKey = `${consultantId}-${intent}`;
  console.log(`🔑 [Cache Key] Using cache key: ${cacheKey}`);

  // Check cache first
  const cached = consultantContextCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    const cacheAge = Math.round((Date.now() - cached.timestamp) / 1000);
    console.log(`✅ Using cached consultant context (intent: ${intent}, age: ${cacheAge}s)`);
    return cached.context;
  }

  console.log(`🔄 Building fresh consultant context (intent: ${intent})`);

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Determine what to load based on intent
  const shouldLoadClients = intent === 'clients_overview' || intent === 'client_specific' || intent === 'general';
  const shouldLoadExercises = intent === 'exercises_management' || intent === 'general';
  const shouldLoadClientData = intent === 'clients_overview' || intent === 'client_specific' || intent === 'general'; // For feedback, university, templates
  const shouldLoadEmail = intent === 'email_marketing' || intent === 'general';
  const shouldLoadWhatsApp = intent === 'whatsapp_leads' || intent === 'general';
  const shouldLoadCalendar = intent === 'calendar_scheduling' || intent === 'general';
  const shouldLoadConsultations = intent === 'calendar_scheduling' || intent === 'client_specific' || intent === 'general';
  const shouldLoadEmailDetailed = intent === 'email_marketing';
  const shouldLoadWhatsAppDetailed = intent === 'whatsapp_leads' || intent === 'lead_management' || intent === 'campaign_marketing' || intent === 'api_settings' || intent === 'general';
  const shouldLoadAIAgents = intent === 'ai_agents';
  const shouldLoadLeads = intent === 'lead_management' || intent === 'campaign_marketing' || intent === 'whatsapp_leads' || intent === 'ai_agents' || intent === 'general';
  const shouldLoadCampaigns = intent === 'campaign_marketing' || intent === 'lead_management' || intent === 'api_settings' || intent === 'general';
  const shouldLoadApiSettings = intent === 'api_settings' || intent === 'general';
  const shouldLoadWhatsAppConfig = intent === 'whatsapp_config_management' || intent === 'api_settings' || intent === 'whatsapp_leads' || intent === 'ai_agents' || intent === 'campaign_marketing' || intent === 'lead_management' || intent === 'general';

  console.log(`🔍 [DEBUG] Query flags:`, { shouldLoadClients, shouldLoadExercises, shouldLoadClientData, shouldLoadEmail, shouldLoadWhatsApp, shouldLoadCalendar, shouldLoadConsultations, shouldLoadEmailDetailed, shouldLoadWhatsAppDetailed, shouldLoadAIAgents, shouldLoadLeads, shouldLoadCampaigns, shouldLoadApiSettings, shouldLoadWhatsAppConfig });

  // Parallel queries for optimal performance - WITH AGGRESSIVE LOGGING
  const [
    consultantResult,
    allClients,
    pendingReviewsResult,
    recentExercisesResult,
    exerciseStatsResult,
    emailDraftsResult,
    schedulerLogsResult,
    whatsappLeadsResult,
    whatsappConversationsResult,
    upcomingAppointmentsResult,
    todayAppointmentsResult,
    allConsultationsResult,
    allConsultationTasksResult,
    allClientGoalsResult,
    allClientStatesResult,
    smtpSettingsResult,
    emailTemplatesResult,
    whatsappTemplatesResult,
    libraryDocumentsResult,
    exerciseFeedbackResult,
    universityYearAssignmentsResult,
    exerciseTemplatesResult,
    universityTemplatesResult,
    smtpConfigDetailedResult,
    schedulerLogsDetailedResult,
    emailHistoryResult,
    journeyTemplatesDetailedResult,
    clientAutomationResult,
    whatsappConversationsDetailedResult,
    whatsappRecentMessagesResult,
    whatsappAgentConfigsResult,
    dotMetrics,
    millieMetrics,
    echoMetrics,
    specMetrics,
    proactiveLeadsResult,
    leadStatsByStatusResult,
    leadStatsByCategoryResult,
    leadStatsByCampaignResult,
    marketingCampaignsResult,
    campaignAnalyticsResult,
    externalApiConfigsResult,
    externalLeadImportLogsResult,
    whatsappConfigResult,
    whatsappCustomTemplatesResult,
    whatsappTemplateAssignmentsResult,
    twilioTemplatesResult,
    calendarSettingsResult,
  ] = await Promise.all([
    // Consultant info - ALWAYS
    (async () => {
      console.log(`🔍 [Q1] Fetching consultant info...`);
      const result = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, consultantId))
        .limit(1);
      console.log(`✅ [Q1] Consultant info fetched`);
      return result;
    })(),

    // All clients with basic info
    shouldLoadClients
      ? (async () => {
          console.log(`🔍 [Q2] Fetching all clients...`);
          const result = await db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
              level: users.level,
              enrolledAt: users.enrolledAt,
              lastActivityAt: clientStateTracking.lastUpdated,
            })
            .from(users)
            .leftJoin(clientStateTracking, eq(users.id, clientStateTracking.clientId))
            .where(and(
              eq(users.consultantId, consultantId),
              eq(users.role, 'client')
            ))
            .orderBy(desc(clientStateTracking.lastUpdated));
          console.log(`✅ [Q2] All clients fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Pending exercise reviews
    shouldLoadExercises
      ? (async () => {
          console.log(`🔍 [Q3] Fetching pending exercise reviews...`);
          
          const latestSubmissions = db
            .select({
              assignmentId: exerciseSubmissions.assignmentId,
              submittedAt: sql<Date>`MAX(${exerciseSubmissions.submittedAt})`.as('latest_submitted_at'),
            })
            .from(exerciseSubmissions)
            .where(sql`${exerciseSubmissions.submittedAt} IS NOT NULL`)
            .groupBy(exerciseSubmissions.assignmentId)
            .as('latest_submissions');

          const result = await db
            .select({
              assignmentId: exerciseAssignments.id,
              exerciseTitle: exercises.title,
              clientFirstName: users.firstName,
              clientLastName: users.lastName,
              submittedAt: latestSubmissions.submittedAt,
              dueDate: exerciseAssignments.dueDate,
            })
            .from(exerciseAssignments)
            .innerJoin(exercises, eq(exerciseAssignments.exerciseId, exercises.id))
            .innerJoin(users, eq(exerciseAssignments.clientId, users.id))
            .leftJoin(latestSubmissions, eq(latestSubmissions.assignmentId, exerciseAssignments.id))
            .where(and(
              eq(exerciseAssignments.consultantId, consultantId),
              inArray(exerciseAssignments.status, ['submitted', 'returned'])
            ))
            .orderBy(asc(exerciseAssignments.dueDate))
            .limit(100);
          console.log(`✅ [Q3] Pending exercise reviews fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Recently created exercises
    shouldLoadExercises
      ? (async () => {
          console.log(`🔍 [Q4] Fetching recently created exercises...`);
          const result = await db
            .select({
              id: exercises.id,
              title: exercises.title,
              category: exercises.category,
              createdAt: exercises.createdAt,
              assignedCount: sql<number>`COUNT(DISTINCT ${exerciseAssignments.id})::int`,
            })
            .from(exercises)
            .leftJoin(exerciseAssignments, eq(exercises.id, exerciseAssignments.exerciseId))
            .where(eq(exercises.createdBy, consultantId))
            .groupBy(exercises.id)
            .orderBy(desc(exercises.createdAt))
            .limit(50);
          console.log(`✅ [Q4] Recently created exercises fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Exercise stats
    shouldLoadExercises
      ? (async () => {
          console.log(`🔍 [Q5] Fetching exercise stats...`);
          const result = await db
            .select({
              totalCreated: sql<number>`COUNT(DISTINCT ${exercises.id})::int`,
              totalAssigned: sql<number>`COUNT(${exerciseAssignments.id})::int`,
              awaitingReview: sql<number>`COUNT(CASE WHEN ${exerciseAssignments.status} = 'pending_review' THEN 1 END)::int`,
              completedThisWeek: sql<number>`COUNT(CASE WHEN ${exerciseAssignments.status} = 'completed' AND ${exerciseAssignments.completedAt} >= ${oneWeekAgo} THEN 1 END)::int`,
            })
            .from(exercises)
            .leftJoin(exerciseAssignments, eq(exercises.id, exerciseAssignments.exerciseId))
            .where(eq(exercises.createdBy, consultantId));
          console.log(`✅ [Q5] Exercise stats fetched`);
          return result;
        })()
      : Promise.resolve([]),

    // Email drafts - Get ALL drafts for stats (not limited)
    shouldLoadEmail
      ? (async () => {
          console.log(`🔍 [Q6] Fetching email drafts...`);
          const result = await db
            .select({
              id: emailDrafts.id,
              clientId: emailDrafts.clientId,
              consultationId: emailDrafts.consultationId,
              clientFirstName: users.firstName,
              clientLastName: users.lastName,
              subject: emailDrafts.subject,
              status: emailDrafts.status,
              generatedAt: emailDrafts.generatedAt,
            })
            .from(emailDrafts)
            .innerJoin(users, eq(emailDrafts.clientId, users.id))
            .where(eq(emailDrafts.consultantId, consultantId))
            .orderBy(desc(emailDrafts.generatedAt));
          console.log(`✅ [Q6] Email drafts fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Scheduler logs
    shouldLoadEmail
      ? (async () => {
          console.log(`🔍 [Q7] Fetching scheduler logs...`);
          const result = await db
            .select()
            .from(schedulerExecutionLog)
            .where(eq(schedulerExecutionLog.consultantId, consultantId))
            .orderBy(desc(schedulerExecutionLog.executedAt))
            .limit(1);
          console.log(`✅ [Q7] Scheduler logs fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // WhatsApp leads
    shouldLoadWhatsApp
      ? (async () => {
          console.log(`🔍 [Q8] Fetching WhatsApp leads...`);
          const result = await db
            .select()
            .from(proactiveLeads)
            .where(eq(proactiveLeads.consultantId, consultantId))
            .orderBy(desc(proactiveLeads.lastContactedAt))
            .limit(30);
          console.log(`✅ [Q8] WhatsApp leads fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // WhatsApp conversations (recent)
    shouldLoadWhatsApp
      ? (async () => {
          console.log(`🔍 [Q9] Fetching WhatsApp conversations...`);
          const result = await db
            .select({
              id: whatsappConversations.id,
              phoneNumber: whatsappConversations.phoneNumber,
              userId: whatsappConversations.userId,
              lastMessageAt: whatsappConversations.lastMessageAt,
              lastMessageFrom: whatsappConversations.lastMessageFrom,
              messageCount: whatsappConversations.messageCount,
              unreadByConsultant: whatsappConversations.unreadByConsultant,
              isLead: whatsappConversations.isLead,
            })
            .from(whatsappConversations)
            .where(eq(whatsappConversations.consultantId, consultantId))
            .orderBy(desc(whatsappConversations.lastMessageAt))
            .limit(20);
          console.log(`✅ [Q9] WhatsApp conversations fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Upcoming appointments
    shouldLoadCalendar
      ? (async () => {
          console.log(`🔍 [Q10] Fetching upcoming appointments...`);
          const result = await db
            .select({
              id: calendarEvents.id,
              title: calendarEvents.title,
              start: calendarEvents.start,
              end: calendarEvents.end,
              userId: calendarEvents.userId,
            })
            .from(calendarEvents)
            .where(and(
              eq(calendarEvents.userId, consultantId),
              gte(calendarEvents.start, now)
            ))
            .orderBy(asc(calendarEvents.start))
            .limit(20);
          console.log(`✅ [Q10] Upcoming appointments fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Today appointments
    shouldLoadCalendar
      ? (async () => {
          console.log(`🔍 [Q11] Fetching today appointments...`);
          const result = await db
            .select({
              id: calendarEvents.id,
              title: calendarEvents.title,
              start: calendarEvents.start,
              end: calendarEvents.end,
            })
            .from(calendarEvents)
            .where(and(
              eq(calendarEvents.userId, consultantId),
              gte(calendarEvents.start, new Date(today)),
              gte(new Date(today + 'T23:59:59'), calendarEvents.start)
            ))
            .orderBy(asc(calendarEvents.start));
          console.log(`✅ [Q11] Today appointments fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // All consultations with clients
    shouldLoadConsultations
      ? (async () => {
          console.log(`🔍 [Q12] Fetching all consultations...`);
          const result = await db
            .select({
              id: consultations.id,
              consultantId: consultations.consultantId,
              clientId: consultations.clientId,
              scheduledAt: consultations.scheduledAt,
              duration: consultations.duration,
              notes: consultations.notes,
              status: consultations.status,
              googleMeetLink: consultations.googleMeetLink,
              fathomShareLink: consultations.fathomShareLink,
              transcript: consultations.transcript,
              summaryEmail: consultations.summaryEmail,
              summaryEmailGeneratedAt: consultations.summaryEmailGeneratedAt,
              googleCalendarEventId: consultations.googleCalendarEventId,
              createdAt: consultations.createdAt,
              clientFirstName: users.firstName,
              clientLastName: users.lastName,
            })
            .from(consultations)
            .innerJoin(users, eq(consultations.clientId, users.id))
            .where(eq(consultations.consultantId, consultantId))
            .orderBy(desc(consultations.scheduledAt))
            .limit(30);
          console.log(`✅ [Q12] All consultations fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // All consultation tasks
    shouldLoadConsultations
      ? (async () => {
          console.log(`🔍 [Q13] Fetching consultation tasks...`);
          const result = await db
            .select({
              id: consultationTasks.id,
              consultationId: consultationTasks.consultationId,
              clientId: consultationTasks.clientId,
              title: consultationTasks.title,
              dueDate: consultationTasks.dueDate,
              priority: consultationTasks.priority,
              category: consultationTasks.category,
              completed: consultationTasks.completed,
              consultantId: consultations.consultantId,
              clientFirstName: users.firstName,
              clientLastName: users.lastName,
            })
            .from(consultationTasks)
            .innerJoin(consultations, eq(consultationTasks.consultationId, consultations.id))
            .innerJoin(users, eq(consultationTasks.clientId, users.id))
            .where(eq(consultations.consultantId, consultantId))
            .orderBy(asc(consultationTasks.dueDate))
            .limit(50);
          console.log(`✅ [Q13] Consultation tasks fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // All client goals (always load - few records)
    shouldLoadClients
      ? (async () => {
          console.log(`🔍 [Q13a] Fetching client goals...`);
          const result = await db
            .select({
              id: goals.id,
              clientId: goals.clientId,
              title: goals.title,
              description: goals.description,
              targetDate: goals.targetDate,
              targetValue: goals.targetValue,
              currentValue: goals.currentValue,
              unit: goals.unit,
              status: goals.status,
              createdAt: goals.createdAt,
              clientFirstName: users.firstName,
              clientLastName: users.lastName,
              consultantId: users.consultantId,
            })
            .from(goals)
            .innerJoin(users, eq(goals.clientId, users.id))
            .where(eq(users.consultantId, consultantId))
            .orderBy(desc(goals.createdAt));
          console.log(`✅ [Q13a] Client goals fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Client State Tracking - CRITICAL: All 9 fields required by user
    // IMPORTANT: Only fetch the LATEST state per client to avoid duplicates
    shouldLoadClients
      ? (async () => {
          console.log(`🔍 [Q13b] Fetching client state tracking data (latest per client)...`);
          
          // Use raw SQL with DISTINCT ON to get only the latest state per client
          const result = await db.execute(sql`
            SELECT DISTINCT ON (cst.client_id)
              cst.id,
              cst.client_id,
              cst.consultant_id,
              cst.current_state,
              cst.ideal_state,
              cst.internal_benefit,
              cst.external_benefit,
              cst.main_obstacle,
              cst.past_attempts,
              cst.current_actions,
              cst.future_vision,
              cst.motivation_drivers,
              cst.last_updated,
              cst.created_at,
              u.first_name as client_first_name,
              u.last_name as client_last_name
            FROM client_state_tracking cst
            INNER JOIN users u ON cst.client_id = u.id
            WHERE cst.consultant_id = ${consultantId}
            ORDER BY cst.client_id, cst.last_updated DESC
          `);
          
          // Map raw results to typed objects
          const mappedResult = (result.rows || []).map((row: any) => ({
            id: row.id,
            clientId: row.client_id,
            consultantId: row.consultant_id,
            currentState: row.current_state,
            idealState: row.ideal_state,
            internalBenefit: row.internal_benefit,
            externalBenefit: row.external_benefit,
            mainObstacle: row.main_obstacle,
            pastAttempts: row.past_attempts,
            currentActions: row.current_actions,
            futureVision: row.future_vision,
            motivationDrivers: row.motivation_drivers,
            lastUpdated: row.last_updated,
            createdAt: row.created_at,
            clientFirstName: row.client_first_name,
            clientLastName: row.client_last_name,
          }));
          
          console.log(`✅ [Q13b] Client state tracking fetched (unique clients): ${mappedResult.length}`);
          return mappedResult;
        })()
      : Promise.resolve([]),

    // SMTP configuration - always load (single record)
    (async () => {
      console.log(`🔍 [Q14] Fetching SMTP settings...`);
      const result = await db
        .select({
          id: consultantSmtpSettings.id,
          fromEmail: consultantSmtpSettings.fromEmail,
          fromName: consultantSmtpSettings.fromName,
          automationEnabled: consultantSmtpSettings.automationEnabled,
          emailTone: consultantSmtpSettings.emailTone,
          isActive: consultantSmtpSettings.isActive,
        })
        .from(consultantSmtpSettings)
        .where(eq(consultantSmtpSettings.consultantId, consultantId))
        .limit(1);
      console.log(`✅ [Q14] SMTP settings fetched: ${result.length}`);
      return result;
    })(),

    // Email journey templates - always load (few records)
    (async () => {
      console.log(`🔍 [Q15] Fetching email journey templates...`);
      const result = await db
        .select({
          id: emailJourneyTemplates.id,
          dayOfMonth: emailJourneyTemplates.dayOfMonth,
          title: emailJourneyTemplates.title,
          emailType: emailJourneyTemplates.emailType,
          tone: emailJourneyTemplates.tone,
          isActive: emailJourneyTemplates.isActive,
        })
        .from(emailJourneyTemplates)
        .where(eq(emailJourneyTemplates.isActive, true))
        .orderBy(asc(emailJourneyTemplates.dayOfMonth))
        .limit(50);
      console.log(`✅ [Q15] Email journey templates fetched: ${result.length}`);
      return result;
    })(),

    // WhatsApp custom templates - always load
    (async () => {
      console.log(`🔍 [Q16] Fetching WhatsApp custom templates...`);
      const result = await db
        .select({
          id: whatsappCustomTemplates.id,
          templateName: whatsappCustomTemplates.templateName,
          templateType: whatsappCustomTemplates.templateType,
          archivedAt: whatsappCustomTemplates.archivedAt,
        })
        .from(whatsappCustomTemplates)
        .where(eq(whatsappCustomTemplates.consultantId, consultantId))
        .orderBy(desc(whatsappCustomTemplates.createdAt))
        .limit(50);
      console.log(`✅ [Q16] WhatsApp custom templates fetched: ${result.length}`);
      return result;
    })(),

    // Library documents with category names - always load (recent 20)
    (async () => {
      console.log(`🔍 [Q17] Fetching library documents...`);
      const result = await db
        .select({
          id: libraryDocuments.id,
          title: libraryDocuments.title,
          categoryId: libraryDocuments.categoryId,
          categoryName: libraryCategories.name,
          contentType: libraryDocuments.contentType,
          level: libraryDocuments.level,
          isPublished: libraryDocuments.isPublished,
        })
        .from(libraryDocuments)
        .innerJoin(libraryCategories, eq(libraryDocuments.categoryId, libraryCategories.id))
        .where(eq(libraryDocuments.isPublished, true))
        .orderBy(desc(libraryDocuments.createdAt))
        .limit(20);
      console.log(`✅ [Q17] Library documents fetched: ${result.length}`);
      return result;
    })(),

    // Exercise feedback - with JSONB parsing (intent-based)
    shouldLoadClientData
      ? (async () => {
          console.log(`🔍 [Q18] Fetching exercise feedback...`);
          const result = await db.execute(sql`
            SELECT 
              ea.id,
              e.title as exercise_title,
              u.first_name as client_first_name,
              u.last_name as client_last_name,
              ea.consultant_feedback
            FROM exercise_assignments ea
            INNER JOIN exercises e ON ea.exercise_id = e.id
            INNER JOIN users u ON ea.client_id = u.id
            WHERE ea.consultant_id = ${consultantId}
              AND ea.consultant_feedback IS NOT NULL
              AND ea.consultant_feedback != '[]'::jsonb
            ORDER BY (ea.consultant_feedback->-1->>'timestamp')::timestamp DESC
            LIMIT 10
          `);
          
          const mappedResult = (result.rows || []).map((row: any) => ({
            id: row.id,
            exerciseTitle: row.exercise_title,
            clientFirstName: row.client_first_name,
            clientLastName: row.client_last_name,
            consultantFeedback: row.consultant_feedback,
          }));
          
          console.log(`✅ [Q18] Exercise feedback fetched: ${mappedResult.length}`);
          return mappedResult;
        })()
      : Promise.resolve([]),

    // University year assignments with detailed structure (intent-based)
    shouldLoadClientData
      ? (async () => {
          console.log(`🔍 [Q19] Fetching university year assignments with detailed structure...`);
          const result = await db.execute(sql`
            SELECT 
              uyca.id as assignment_id,
              uyca.assigned_at,
              uyca.client_id,
              u.first_name as client_first_name,
              u.last_name as client_last_name,
              uy.id as year_id,
              uy.title as year_name,
              ut.id as trimester_id,
              ut.title as trimester_title,
              ut.sort_order as trimester_sort_order,
              um.id as module_id,
              um.title as module_title,
              um.sort_order as module_sort_order,
              ul.id as lesson_id,
              ul.title as lesson_title,
              ul.sort_order as lesson_sort_order,
              COALESCE(up.is_completed, false) as is_completed
            FROM university_year_client_assignments uyca
            INNER JOIN users u ON uyca.client_id = u.id
            INNER JOIN university_years uy ON uyca.year_id = uy.id
            LEFT JOIN university_trimesters ut ON ut.year_id = uy.id
            LEFT JOIN university_modules um ON um.trimester_id = ut.id
            LEFT JOIN university_lessons ul ON ul.module_id = um.id
            LEFT JOIN university_progress up ON up.client_id = uyca.client_id AND up.lesson_id = ul.id
            WHERE uyca.consultant_id = ${consultantId}
            ORDER BY uyca.assigned_at DESC, ut.sort_order ASC, um.sort_order ASC, ul.sort_order ASC
          `);
          
          console.log(`✅ [Q19] University year assignments raw data fetched: ${result.rows?.length || 0} rows`);
          return result.rows || [];
        })()
      : Promise.resolve([]),

    // Exercise templates with usage count (intent-based)
    shouldLoadClientData
      ? (async () => {
          console.log(`🔍 [Q20] Fetching exercise templates...`);
          const result = await db
            .select({
              id: exerciseTemplates.id,
              name: exerciseTemplates.name,
              description: exerciseTemplates.description,
              category: exerciseTemplates.category,
              type: exerciseTemplates.type,
              usageCount: exerciseTemplates.usageCount,
              estimatedDuration: exerciseTemplates.estimatedDuration,
              createdAt: exerciseTemplates.createdAt,
            })
            .from(exerciseTemplates)
            .where(eq(exerciseTemplates.createdBy, consultantId))
            .orderBy(desc(exerciseTemplates.usageCount))
            .limit(100);
          console.log(`✅ [Q20] Exercise templates fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // University templates (percorsi disponibili)
    shouldLoadClientData
      ? (async () => {
          console.log(`🔍 [Q21] Fetching university templates...`);
          const result = await db
            .select({
              id: universityTemplates.id,
              name: universityTemplates.name,
              description: universityTemplates.description,
              isActive: universityTemplates.isActive,
              createdAt: universityTemplates.createdAt,
            })
            .from(universityTemplates)
            .where(eq(universityTemplates.createdBy, consultantId))
            .orderBy(desc(universityTemplates.isActive), desc(universityTemplates.createdAt));
          console.log(`✅ [Q21] University templates fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // SMTP Config Detailed (for email marketing intent)
    shouldLoadEmailDetailed
      ? (async () => {
          console.log(`🔍 [Q22] Fetching detailed SMTP config...`);
          const result = await db
            .select()
            .from(consultantSmtpSettings)
            .where(eq(consultantSmtpSettings.consultantId, consultantId))
            .limit(1);
          console.log(`✅ [Q22] Detailed SMTP config fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Scheduler Logs Detailed (ultimi 10)
    shouldLoadEmailDetailed
      ? (async () => {
          console.log(`🔍 [Q23] Fetching detailed scheduler logs...`);
          const result = await db
            .select()
            .from(schedulerExecutionLog)
            .where(eq(schedulerExecutionLog.consultantId, consultantId))
            .orderBy(desc(schedulerExecutionLog.executedAt))
            .limit(10);
          console.log(`✅ [Q23] Detailed scheduler logs fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Email History (ultimi 30 giorni)
    shouldLoadEmailDetailed
      ? (async () => {
          console.log(`🔍 [Q24] Fetching email history (last 30 days)...`);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const result = await db.select({
            id: automatedEmailsLog.id,
            clientId: automatedEmailsLog.clientId,
            clientFirstName: users.firstName,
            clientLastName: users.lastName,
            subject: automatedEmailsLog.subject,
            emailType: automatedEmailsLog.emailType,
            journeyDay: automatedEmailsLog.journeyDay,
            sentAt: automatedEmailsLog.sentAt,
            openedAt: automatedEmailsLog.openedAt,
            includesTasks: automatedEmailsLog.includesTasks,
            includesGoals: automatedEmailsLog.includesGoals,
            isTest: automatedEmailsLog.isTest,
          })
          .from(automatedEmailsLog)
          .innerJoin(users, eq(automatedEmailsLog.clientId, users.id))
          .where(and(
            eq(users.consultantId, consultantId),
            gte(automatedEmailsLog.sentAt, thirtyDaysAgo)
          ))
          .orderBy(desc(automatedEmailsLog.sentAt))
          .limit(100);
          console.log(`✅ [Q24] Email history fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Journey Templates Detailed (tutti i template attivi)
    shouldLoadEmailDetailed
      ? (async () => {
          console.log(`🔍 [Q25] Fetching detailed journey templates...`);
          const result = await db
            .select()
            .from(emailJourneyTemplates)
            .orderBy(asc(emailJourneyTemplates.dayOfMonth))
            .limit(50);
          console.log(`✅ [Q25] Detailed journey templates fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Client Automation (con join a users e clientEmailJourneyProgress)
    shouldLoadEmailDetailed
      ? (async () => {
          console.log(`🔍 [Q26] Fetching client automation data...`);
          const result = await db.select({
            clientId: users.id,
            clientFirstName: users.firstName,
            clientLastName: users.lastName,
            automationEnabled: clientEmailAutomation.enabled,
            currentDay: clientEmailJourneyProgress.currentDay,
            lastEmailSentAt: clientEmailJourneyProgress.lastEmailSentAt,
            lastTemplateId: clientEmailJourneyProgress.lastTemplateUsedId,
          })
          .from(users)
          .leftJoin(clientEmailAutomation, and(
            eq(clientEmailAutomation.clientId, users.id),
            eq(clientEmailAutomation.consultantId, consultantId)
          ))
          .leftJoin(clientEmailJourneyProgress, and(
            eq(clientEmailJourneyProgress.clientId, users.id),
            eq(clientEmailJourneyProgress.consultantId, consultantId)
          ))
          .where(and(
            eq(users.consultantId, consultantId),
            eq(users.role, 'client')
          ))
          .limit(100);
          console.log(`✅ [Q26] Client automation data fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // WhatsApp Conversations Detailed (ultime 20)
    shouldLoadWhatsAppDetailed
      ? (async () => {
          console.log(`🔍 [Q27] Fetching detailed WhatsApp conversations...`);
          const result = await db.select({
            id: whatsappConversations.id,
            phoneNumber: whatsappConversations.phoneNumber,
            userId: whatsappConversations.userId,
            agentConfigId: whatsappConversations.agentConfigId,
            aiEnabled: whatsappConversations.aiEnabled,
            lastMessageAt: whatsappConversations.lastMessageAt,
            lastMessageFrom: whatsappConversations.lastMessageFrom,
            unreadByConsultant: whatsappConversations.unreadByConsultant,
            messageCount: whatsappConversations.messageCount,
            isLead: whatsappConversations.isLead,
          })
          .from(whatsappConversations)
          .where(eq(whatsappConversations.consultantId, consultantId))
          .orderBy(desc(whatsappConversations.lastMessageAt))
          .limit(20);
          console.log(`✅ [Q27] Detailed WhatsApp conversations fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // WhatsApp Recent Messages (per le ultime conversazioni)
    shouldLoadWhatsAppDetailed
      ? (async () => {
          console.log(`🔍 [Q28] Fetching recent WhatsApp messages...`);
          const result = await db
            .select({
              id: whatsappMessages.id,
              conversationId: whatsappMessages.conversationId,
              messageText: whatsappMessages.messageText,
              sender: whatsappMessages.sender,
              createdAt: whatsappMessages.createdAt,
            })
            .from(whatsappMessages)
            .innerJoin(whatsappConversations, eq(whatsappMessages.conversationId, whatsappConversations.id))
            .where(eq(whatsappConversations.consultantId, consultantId))
            .orderBy(desc(whatsappMessages.createdAt))
            .limit(100);
          console.log(`✅ [Q28] Recent WhatsApp messages fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // WhatsApp Agent Configs
    shouldLoadWhatsAppDetailed
      ? (async () => {
          console.log(`🔍 [Q29] Fetching WhatsApp agent configs...`);
          const result = await db
            .select({
              id: consultantWhatsappConfig.id,
              agentName: consultantWhatsappConfig.agentName,
              salesScript: consultantWhatsappConfig.salesScript,
              aiPersonality: consultantWhatsappConfig.aiPersonality,
              isDryRun: consultantWhatsappConfig.isDryRun,
              isActive: consultantWhatsappConfig.isActive,
            })
            .from(consultantWhatsappConfig)
            .where(eq(consultantWhatsappConfig.consultantId, consultantId));
          console.log(`✅ [Q29] WhatsApp agent configs fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // AI AGENTS METRICS - DOT (AI Receptionist)
    shouldLoadAIAgents
      ? (async () => {
          console.log(`🔍 [Q30] Fetching DOT metrics (AI Receptionist)...`);
          const [conversationsManaged, appointmentsBooked, leadsQualified] = await Promise.all([
            db.select({ count: count() })
              .from(whatsappConversations)
              .where(and(
                eq(whatsappConversations.consultantId, consultantId),
                eq(whatsappConversations.aiEnabled, true)
              )),
            db.select({ count: count() })
              .from(whatsappConversations)
              .where(and(
                eq(whatsappConversations.consultantId, consultantId),
                sql`${whatsappConversations.metadata}::jsonb->>'appointmentBooked' = 'true'`
              )),
            db.select({ count: count() })
              .from(whatsappConversations)
              .where(and(
                eq(whatsappConversations.consultantId, consultantId),
                sql`${whatsappConversations.metadata}::jsonb->>'leadStatus' = 'qualified'`
              ))
          ]);
          console.log(`✅ [Q30] DOT metrics fetched`);
          return {
            conversationsManaged: conversationsManaged[0]?.count || 0,
            appointmentsBooked: appointmentsBooked[0]?.count || 0,
            leadsQualified: leadsQualified[0]?.count || 0,
          };
        })()
      : Promise.resolve(null),

    // AI AGENTS METRICS - MILLIE (AI Email Writer)
    shouldLoadAIAgents
      ? (async () => {
          console.log(`🔍 [Q31] Fetching MILLIE metrics (AI Email Writer)...`);
          const [emailsGenerated, draftsPending, automatedEmailsSent, automatedEmailsOpened] = await Promise.all([
            db.select({ count: count() })
              .from(emailDrafts)
              .where(eq(emailDrafts.consultantId, consultantId)),
            db.select({ count: count() })
              .from(emailDrafts)
              .where(and(
                eq(emailDrafts.consultantId, consultantId),
                eq(emailDrafts.status, 'pending')
              )),
            db.select({ count: count() })
              .from(automatedEmailsLog)
              .innerJoin(users, eq(automatedEmailsLog.clientId, users.id))
              .where(and(
                eq(users.consultantId, consultantId),
                gte(automatedEmailsLog.sentAt, oneWeekAgo)
              )),
            db.select({ 
              total: count(),
              opened: sql<number>`COUNT(CASE WHEN ${automatedEmailsLog.openedAt} IS NOT NULL THEN 1 END)::int`
            })
              .from(automatedEmailsLog)
              .innerJoin(users, eq(automatedEmailsLog.clientId, users.id))
              .where(eq(users.consultantId, consultantId))
          ]);
          
          const totalEmails = automatedEmailsOpened[0]?.total || 0;
          const openedEmails = automatedEmailsOpened[0]?.opened || 0;
          const openRate = totalEmails > 0 ? Math.round((openedEmails / totalEmails) * 100) : 0;
          
          console.log(`✅ [Q31] MILLIE metrics fetched`);
          return {
            emailsGenerated: emailsGenerated[0]?.count || 0,
            draftsPending: draftsPending[0]?.count || 0,
            emailsSentThisWeek: automatedEmailsSent[0]?.count || 0,
            openRate,
          };
        })()
      : Promise.resolve(null),

    // AI AGENTS METRICS - ECHO (AI Consultation Summarizer)
    shouldLoadAIAgents
      ? (async () => {
          console.log(`🔍 [Q32] Fetching ECHO metrics (AI Consultation Summarizer)...`);
          const [summariesGenerated, consultationEmailsSent, avgLength] = await Promise.all([
            db.select({ count: count() })
              .from(consultations)
              .where(and(
                eq(consultations.consultantId, consultantId),
                sql`${consultations.summaryEmail} IS NOT NULL`
              )),
            db.select({ count: count() })
              .from(automatedEmailsLog)
              .innerJoin(users, eq(automatedEmailsLog.clientId, users.id))
              .where(and(
                eq(users.consultantId, consultantId),
                eq(automatedEmailsLog.emailType, 'post_consultation')
              )),
            db.select({
              avgLength: sql<number>`COALESCE(AVG(LENGTH(${consultations.summaryEmail}))::int, 0)`
            })
              .from(consultations)
              .where(and(
                eq(consultations.consultantId, consultantId),
                sql`${consultations.summaryEmail} IS NOT NULL`
              ))
          ]);
          console.log(`✅ [Q32] ECHO metrics fetched`);
          return {
            summariesGenerated: summariesGenerated[0]?.count || 0,
            consultationEmailsSent: consultationEmailsSent[0]?.count || 0,
            avgSummaryLength: avgLength[0]?.avgLength || 0,
          };
        })()
      : Promise.resolve(null),

    // AI AGENTS METRICS - SPEC (AI Client Researcher)
    shouldLoadAIAgents
      ? (async () => {
          console.log(`🔍 [Q33] Fetching SPEC metrics (AI Client Researcher)...`);
          const [clientConversations, questionsAnswered] = await Promise.all([
            db.select({ count: sql<number>`COUNT(DISTINCT ${whatsappConversations.id})::int` })
              .from(whatsappConversations)
              .where(and(
                eq(whatsappConversations.consultantId, consultantId),
                sql`${whatsappConversations.userId} IS NOT NULL`,
                eq(whatsappConversations.isLead, false)
              )),
            db.select({ count: count() })
              .from(whatsappMessages)
              .innerJoin(whatsappConversations, eq(whatsappMessages.conversationId, whatsappConversations.id))
              .where(and(
                eq(whatsappConversations.consultantId, consultantId),
                eq(whatsappMessages.sender, 'ai')
              ))
          ]);
          console.log(`✅ [Q33] SPEC metrics fetched`);
          return {
            clientConversations: clientConversations[0]?.count || 0,
            questionsAnswered: questionsAnswered[0]?.count || 0,
            documentsReferenced: 0,
          };
        })()
      : Promise.resolve(null),

    // Q40: Proactive Leads - Fixed: leadInfo is JSONB, not separate fields
    shouldLoadLeads
      ? (async () => {
          console.log(`🔍 [Q40] Fetching proactive leads...`);
          const result = await db.select({
            id: proactiveLeads.id,
            firstName: proactiveLeads.firstName,
            lastName: proactiveLeads.lastName,
            phoneNumber: proactiveLeads.phoneNumber,
            campaignId: proactiveLeads.campaignId,
            agentConfigId: proactiveLeads.agentConfigId,
            leadCategory: proactiveLeads.leadCategory,
            status: proactiveLeads.status,
            contactSchedule: proactiveLeads.contactSchedule,
            lastContactedAt: proactiveLeads.lastContactedAt,
            lastMessageSent: proactiveLeads.lastMessageSent,
            idealState: proactiveLeads.idealState,
            leadInfo: proactiveLeads.leadInfo,
            metadata: proactiveLeads.metadata,
          })
          .from(proactiveLeads)
          .where(eq(proactiveLeads.consultantId, consultantId))
          .orderBy(desc(proactiveLeads.createdAt))
          .limit(100);
          console.log(`✅ [Q40] Proactive leads fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Q41: Lead Stats by Status
    shouldLoadLeads
      ? (async () => {
          console.log(`🔍 [Q41] Fetching lead stats by status...`);
          const result = await db.select({
            status: proactiveLeads.status,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(proactiveLeads)
          .where(eq(proactiveLeads.consultantId, consultantId))
          .groupBy(proactiveLeads.status);
          console.log(`✅ [Q41] Lead stats by status fetched: ${result.length} statuses`);
          return result;
        })()
      : Promise.resolve([]),

    // Q42: Lead Stats by Category
    shouldLoadLeads
      ? (async () => {
          console.log(`🔍 [Q42] Fetching lead stats by category...`);
          const result = await db.select({
            category: proactiveLeads.leadCategory,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(proactiveLeads)
          .where(eq(proactiveLeads.consultantId, consultantId))
          .groupBy(proactiveLeads.leadCategory);
          console.log(`✅ [Q42] Lead stats by category fetched: ${result.length} categories`);
          return result;
        })()
      : Promise.resolve([]),

    // Q43: Lead Stats by Campaign (campaignName retrieved from Q44 mapping)
    shouldLoadLeads
      ? (async () => {
          console.log(`🔍 [Q43] Fetching lead stats by campaign...`);
          const result = await db.select({
            campaignId: proactiveLeads.campaignId,
            totalCount: sql<number>`COUNT(*)::int`,
            convertedCount: sql<number>`COUNT(CASE WHEN ${proactiveLeads.status} = 'converted' THEN 1 END)::int`,
          })
          .from(proactiveLeads)
          .where(eq(proactiveLeads.consultantId, consultantId))
          .groupBy(proactiveLeads.campaignId);
          console.log(`✅ [Q43] Lead stats by campaign fetched: ${result.length} campaigns`);
          return result;
        })()
      : Promise.resolve([]),

    // Q44: Marketing Campaigns with Agent Names
    shouldLoadCampaigns
      ? (async () => {
          try {
            console.log(`🔍 [Q44] Fetching marketing campaigns with agent names...`);
            console.log(`🔍 [Q44] Building query with leftJoin...`);
            const result = await db.select({
              id: marketingCampaigns.id,
              campaignName: marketingCampaigns.campaignName,
              campaignType: marketingCampaigns.campaignType,
              leadCategory: marketingCampaigns.leadCategory,
              hookText: marketingCampaigns.hookText,
              idealStateDescription: marketingCampaigns.idealStateDescription,
              implicitDesires: marketingCampaigns.implicitDesires,
              defaultObiettivi: marketingCampaigns.defaultObiettivi,
              preferredAgentConfigId: marketingCampaigns.preferredAgentConfigId,
              preferredAgentName: sql<string | null>`${consultantWhatsappConfig.agentName}`,
              openingTemplateId: marketingCampaigns.openingTemplateId,
              followupGentleTemplateId: marketingCampaigns.followupGentleTemplateId,
              followupValueTemplateId: marketingCampaigns.followupValueTemplateId,
              followupFinalTemplateId: marketingCampaigns.followupFinalTemplateId,
              isActive: marketingCampaigns.isActive,
              createdAt: marketingCampaigns.createdAt,
            })
            .from(marketingCampaigns)
            .leftJoin(consultantWhatsappConfig, eq(marketingCampaigns.preferredAgentConfigId, consultantWhatsappConfig.id))
            .where(eq(marketingCampaigns.consultantId, consultantId))
            .orderBy(desc(marketingCampaigns.createdAt));
            console.log(`✅ [Q44] Marketing campaigns fetched: ${result.length}`);
            return result;
          } catch (error) {
            console.error(`❌ [Q44] ERROR:`, error);
            throw error;
          }
        })()
      : Promise.resolve([]),

    // Q45: Campaign Analytics (last 30 days)
    shouldLoadCampaigns
      ? (async () => {
          console.log(`🔍 [Q45] Fetching campaign analytics (last 30 days)...`);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const result = await db.select({
            campaignId: campaignAnalytics.campaignId,
            campaignName: marketingCampaigns.campaignName,
            date: campaignAnalytics.date,
            leadsCreated: campaignAnalytics.leadsCreated,
            leadsContacted: campaignAnalytics.leadsContacted,
            leadsResponded: campaignAnalytics.leadsResponded,
            leadsConverted: campaignAnalytics.leadsConverted,
            avgResponseTimeHours: campaignAnalytics.avgResponseTimeHours,
          })
          .from(campaignAnalytics)
          .innerJoin(marketingCampaigns, eq(campaignAnalytics.campaignId, marketingCampaigns.id))
          .where(and(
            eq(marketingCampaigns.consultantId, consultantId),
            gte(campaignAnalytics.date, thirtyDaysAgo.toISOString().split('T')[0])
          ))
          .orderBy(desc(campaignAnalytics.date))
          .limit(300);
          console.log(`✅ [Q45] Campaign analytics fetched: ${result.length} records`);
          return result;
        })()
      : Promise.resolve([]),

    // Q46: External API Configs with Target Campaign Names
    shouldLoadApiSettings
      ? (async () => {
          try {
            console.log(`🔍 [Q46] Fetching external API configs...`);
            console.log(`🔍 [Q46] Building query with leftJoin...`);
            const result = await db.select({
              id: externalApiConfigs.id,
              configName: externalApiConfigs.configName,
              baseUrl: externalApiConfigs.baseUrl,
              apiKey: externalApiConfigs.apiKey,
              leadType: externalApiConfigs.leadType,
              sourceFilter: externalApiConfigs.sourceFilter,
              campaignFilter: externalApiConfigs.campaignFilter,
              daysFilter: externalApiConfigs.daysFilter,
              targetCampaignId: externalApiConfigs.targetCampaignId,
              targetCampaignName: sql<string | null>`${marketingCampaigns.campaignName}`,
              pollingEnabled: externalApiConfigs.pollingEnabled,
              pollingIntervalMinutes: externalApiConfigs.pollingIntervalMinutes,
              isActive: externalApiConfigs.isActive,
              lastImportAt: externalApiConfigs.lastImportAt,
              lastImportStatus: externalApiConfigs.lastImportStatus,
              lastImportLeadsCount: externalApiConfigs.lastImportLeadsCount,
              lastImportErrorMessage: externalApiConfigs.lastImportErrorMessage,
              nextScheduledRun: externalApiConfigs.nextScheduledRun,
            })
            .from(externalApiConfigs)
            .leftJoin(marketingCampaigns, eq(externalApiConfigs.targetCampaignId, marketingCampaigns.id))
            .where(eq(externalApiConfigs.consultantId, consultantId))
            .orderBy(desc(externalApiConfigs.createdAt));
            console.log(`✅ [Q46] External API configs fetched: ${result.length}`);
            return result;
          } catch (error) {
            console.error(`❌ [Q46] ERROR:`, error);
            throw error;
          }
        })()
      : Promise.resolve([]),

    // Q47: External Lead Import Logs (last 30 days)
    shouldLoadApiSettings
      ? (async () => {
          console.log(`🔍 [Q47] Fetching external lead import logs (last 30 days)...`);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const result = await db.select({
            id: externalLeadImportLogs.id,
            configId: externalLeadImportLogs.configId,
            configName: externalApiConfigs.configName,
            importType: externalLeadImportLogs.importType,
            status: externalLeadImportLogs.status,
            leadsProcessed: externalLeadImportLogs.leadsProcessed,
            leadsImported: externalLeadImportLogs.leadsImported,
            leadsUpdated: externalLeadImportLogs.leadsUpdated,
            leadsDuplicated: externalLeadImportLogs.leadsDuplicated,
            leadsErrored: externalLeadImportLogs.leadsErrored,
            errorMessage: externalLeadImportLogs.errorMessage,
            startedAt: externalLeadImportLogs.startedAt,
            completedAt: externalLeadImportLogs.completedAt,
            durationMs: externalLeadImportLogs.durationMs,
          })
          .from(externalLeadImportLogs)
          .innerJoin(externalApiConfigs, eq(externalLeadImportLogs.configId, externalApiConfigs.id))
          .where(and(
            eq(externalApiConfigs.consultantId, consultantId),
            gte(externalLeadImportLogs.startedAt, thirtyDaysAgo)
          ))
          .orderBy(desc(externalLeadImportLogs.startedAt))
          .limit(50);
          console.log(`✅ [Q47] External lead import logs fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Q48: WhatsApp Configuration (Twilio credentials and settings) - COMPREHENSIVE
    shouldLoadWhatsAppConfig
      ? (async () => {
          console.log(`🔍 [Q48] Fetching WhatsApp/Twilio configuration (FULL)...`);
          const result = await db.select({
            // Credentials & Basic
            twilioAccountSid: consultantWhatsappConfig.twilioAccountSid,
            twilioAuthToken: consultantWhatsappConfig.twilioAuthToken,
            twilioWhatsappNumber: consultantWhatsappConfig.twilioWhatsappNumber,
            isActive: consultantWhatsappConfig.isActive,
            autoResponseEnabled: consultantWhatsappConfig.autoResponseEnabled,
            workingHoursEnabled: consultantWhatsappConfig.workingHoursEnabled,
            workingHoursStart: consultantWhatsappConfig.workingHoursStart,
            workingHoursEnd: consultantWhatsappConfig.workingHoursEnd,
            workingDays: consultantWhatsappConfig.workingDays,
            afterHoursMessage: consultantWhatsappConfig.afterHoursMessage,
            isDryRun: consultantWhatsappConfig.isDryRun,
            agentName: consultantWhatsappConfig.agentName,
            
            // Business Profile
            businessName: consultantWhatsappConfig.businessName,
            consultantDisplayName: consultantWhatsappConfig.consultantDisplayName,
            businessDescription: consultantWhatsappConfig.businessDescription,
            consultantBio: consultantWhatsappConfig.consultantBio,
            salesScript: consultantWhatsappConfig.salesScript,
            
            // Authority & Positioning
            vision: consultantWhatsappConfig.vision,
            mission: consultantWhatsappConfig.mission,
            usp: consultantWhatsappConfig.usp,
            values: consultantWhatsappConfig.values,
            
            // Target Audience
            whoWeHelp: consultantWhatsappConfig.whoWeHelp,
            whoWeDontHelp: consultantWhatsappConfig.whoWeDontHelp,
            whatWeDo: consultantWhatsappConfig.whatWeDo,
            howWeDoIt: consultantWhatsappConfig.howWeDoIt,
            
            // Proof & Credibility
            yearsExperience: consultantWhatsappConfig.yearsExperience,
            clientsHelped: consultantWhatsappConfig.clientsHelped,
            resultsGenerated: consultantWhatsappConfig.resultsGenerated,
            caseStudies: consultantWhatsappConfig.caseStudies,
            softwareCreated: consultantWhatsappConfig.softwareCreated,
            booksPublished: consultantWhatsappConfig.booksPublished,
            
            // Services & Guarantees
            servicesOffered: consultantWhatsappConfig.servicesOffered,
            guarantees: consultantWhatsappConfig.guarantees,
            
            // AI Settings
            aiPersonality: consultantWhatsappConfig.aiPersonality,
            whatsappConciseMode: consultantWhatsappConfig.whatsappConciseMode,
            agentType: consultantWhatsappConfig.agentType,
            
            // Templates
            whatsappTemplates: consultantWhatsappConfig.whatsappTemplates,
            templateBodies: consultantWhatsappConfig.templateBodies,
            
            // Lead Defaults
            defaultObiettivi: consultantWhatsappConfig.defaultObiettivi,
            defaultDesideri: consultantWhatsappConfig.defaultDesideri,
            defaultUncino: consultantWhatsappConfig.defaultUncino,
            defaultIdealState: consultantWhatsappConfig.defaultIdealState,
          })
          .from(consultantWhatsappConfig)
          .where(eq(consultantWhatsappConfig.consultantId, consultantId))
          .limit(1);
          console.log(`✅ [Q48] WhatsApp/Twilio configuration (FULL) fetched: ${result.length} record(s)`);
          return result;
        })()
      : Promise.resolve([]),

    // Q49: WhatsApp Custom Templates with Active Version Details
    shouldLoadWhatsAppConfig
      ? (async () => {
          console.log(`🔍 [Q49] Fetching WhatsApp custom templates with versions...`);
          const result = await db
            .select({
              templateId: whatsappCustomTemplates.id,
              templateName: whatsappCustomTemplates.templateName,
              templateType: whatsappCustomTemplates.templateType,
              description: whatsappCustomTemplates.description,
              archivedAt: whatsappCustomTemplates.archivedAt,
              createdAt: whatsappCustomTemplates.createdAt,
              activeVersionId: whatsappTemplateVersions.id,
              activeVersionNumber: whatsappTemplateVersions.versionNumber,
              activeVersionBodyText: whatsappTemplateVersions.bodyText,
              activeVersionTwilioContentSid: whatsappTemplateVersions.twilioContentSid,
              activeVersionTwilioStatus: whatsappTemplateVersions.twilioStatus,
              activeVersionLastSyncedAt: whatsappTemplateVersions.lastSyncedAt,
            })
            .from(whatsappCustomTemplates)
            .leftJoin(
              whatsappTemplateVersions,
              and(
                eq(whatsappTemplateVersions.templateId, whatsappCustomTemplates.id),
                eq(whatsappTemplateVersions.isActive, true)
              )
            )
            .where(eq(whatsappCustomTemplates.consultantId, consultantId))
            .orderBy(whatsappCustomTemplates.templateType);
          console.log(`✅ [Q49] WhatsApp custom templates fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Q50: WhatsApp Template Assignments to Agents
    shouldLoadWhatsAppConfig
      ? (async () => {
          console.log(`🔍 [Q50] Fetching WhatsApp template assignments...`);
          const result = await db
            .select({
              assignmentId: whatsappTemplateAssignments.id,
              agentConfigId: whatsappTemplateAssignments.agentConfigId,
              agentName: consultantWhatsappConfig.agentName,
              agentType: consultantWhatsappConfig.agentType,
              templateId: whatsappTemplateAssignments.templateId,
              templateName: whatsappCustomTemplates.templateName,
              templateType: whatsappTemplateAssignments.templateType,
              assignedAt: whatsappTemplateAssignments.assignedAt,
            })
            .from(whatsappTemplateAssignments)
            .innerJoin(consultantWhatsappConfig, eq(whatsappTemplateAssignments.agentConfigId, consultantWhatsappConfig.id))
            .innerJoin(whatsappCustomTemplates, eq(whatsappTemplateAssignments.templateId, whatsappCustomTemplates.id))
            .where(eq(consultantWhatsappConfig.consultantId, consultantId))
            .orderBy(whatsappTemplateAssignments.agentConfigId, whatsappTemplateAssignments.templateType);
          console.log(`✅ [Q50] WhatsApp template assignments fetched: ${result.length}`);
          return result;
        })()
      : Promise.resolve([]),

    // Q51: Twilio WhatsApp Templates (Content API)
    shouldLoadWhatsAppConfig
      ? (async () => {
          console.log(`🔍 [Q51] Fetching Twilio WhatsApp templates from Content API...`);
          const allTwilioTemplates: any[] = [];
          
          // Get all active WhatsApp configs
          const configs = await db
            .select()
            .from(consultantWhatsappConfig)
            .where(
              and(
                eq(consultantWhatsappConfig.consultantId, consultantId),
                eq(consultantWhatsappConfig.isActive, true)
              )
            );
          
          // Fetch templates from each agent's Twilio account
          for (const config of configs) {
            if (!config.twilioAccountSid || !config.twilioAuthToken) continue;

            try {
              // Initialize Twilio client for this agent
              const twilioClient = twilio(config.twilioAccountSid, config.twilioAuthToken);

              // Fetch content templates from Twilio
              const contents = await twilioClient.content.v1.contents.list({ 
                pageSize: 50 
              });

              // Helper function to extract body text from WhatsApp template components
              const extractWhatsAppBody = (types: any): string => {
                if (types?.['twilio/whatsapp']?.template?.components) {
                  const bodyComponent = types['twilio/whatsapp'].template.components.find(
                    (component: any) => component.type === 'BODY'
                  );
                  return bodyComponent?.text || '';
                }
                return '';
              };

              // Helper function to extract variables from template text
              const extractVariables = (text: string): string[] => {
                const matches = text.match(/\{\{(\d+)\}\}/g) || [];
                return [...new Set(matches.map((m: string) => m.replace(/[{}]/g, '')))].sort();
              };

              // Format templates for this agent
              const agentTemplates = contents.map(content => {
                // Try WhatsApp template first (approved templates with components array)
                let bodyText = extractWhatsAppBody(content.types);
                
                // Fall back to text template (legacy/draft templates)
                if (!bodyText) {
                  bodyText = content.types?.['twilio/text']?.body || '';
                }
                
                // Extract variables from the body text
                const variables = extractVariables(bodyText);
                
                return {
                  sid: content.sid,
                  friendlyName: content.friendlyName,
                  language: content.language || 'N/A',
                  bodyText,
                  variables,
                  agentId: config.id,
                  agentName: config.agentName,
                  agentType: config.agentType,
                };
              });

              allTwilioTemplates.push(...agentTemplates);
            } catch (agentError: any) {
              console.error(`❌ Error fetching Twilio templates for agent ${config.agentName}:`, agentError);
            }
          }

          console.log(`✅ [Q51] Twilio WhatsApp templates fetched: ${allTwilioTemplates.length} from ${configs.length} agent(s)`);
          return allTwilioTemplates;
        })()
      : Promise.resolve([]),

    // Q52: Calendar Settings (Google Calendar connection, AI availability, appointment availability)
    shouldLoadCalendar || intent === 'calendar_management' || intent === 'general'
      ? (async () => {
          console.log(`🔍 [Q52] Fetching calendar settings...`);
          const result = await db
            .select()
            .from(consultantAvailabilitySettings)
            .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
            .limit(1);
          console.log(`✅ [Q52] Calendar settings fetched: ${result.length > 0 ? 'Found' : 'Not configured'}`);
          return result[0] || null;
        })()
      : Promise.resolve(null),
  ]);

  const consultant = consultantResult[0];
  if (!consultant) {
    throw new Error('Consultant not found');
  }

  // Build client stats (for each client, get exercise stats)
  const clientsWithStats = await Promise.all(
    allClients.map(async (client) => {
      const [assignmentStats, universityProgressData] = await Promise.all([
        db
          .select({
            total: sql<number>`COUNT(*)::int`,
            completed: sql<number>`COUNT(CASE WHEN ${exerciseAssignments.status} = 'completed' THEN 1 END)::int`,
            pending: sql<number>`COUNT(CASE WHEN ${exerciseAssignments.status} IN ('assigned', 'in_progress', 'pending_review') THEN 1 END)::int`,
          })
          .from(exerciseAssignments)
          .where(eq(exerciseAssignments.clientId, client.id)),

        db
          .select({
            completedLessons: sql<number>`COUNT(CASE WHEN ${universityProgress.isCompleted} = true THEN 1 END)::int`,
            totalLessons: sql<number>`COUNT(*)::int`,
          })
          .from(universityYearClientAssignments)
          .leftJoin(universityProgress, eq(universityProgress.clientId, universityYearClientAssignments.clientId))
          .where(eq(universityYearClientAssignments.clientId, client.id)),
      ]);

      const stats = assignmentStats[0] || { total: 0, completed: 0, pending: 0 };
      const uniProgress = universityProgressData[0] || { completedLessons: 0, totalLessons: 0 };

      // Count recent consultations (last 30 days)
      const recentConsultationsCount = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(consultations)
        .where(and(
          eq(consultations.clientId, client.id),
          gte(consultations.scheduledAt, oneMonthAgo)
        ));

      return {
        id: client.id,
        name: `${client.firstName} ${client.lastName}`,
        email: client.email,
        level: client.level || 'studente',
        enrolledAt: client.enrolledAt,
        lastActivity: client.lastActivityAt,
        stats: {
          assignedExercises: stats.total,
          completedExercises: stats.completed,
          pendingExercises: stats.pending,
          completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
          universityProgress: uniProgress.totalLessons > 0 
            ? Math.round((uniProgress.completedLessons / uniProgress.totalLessons) * 100) 
            : 0,
          recentConsultations: recentConsultationsCount[0]?.count || 0,
        },
      };
    })
  );

  // Build context
  const context: ConsultantContext = {
    currentDate: today,
    currentDateTime: now.toISOString(),
    consultant: {
      id: consultant.id,
      name: `${consultant.firstName} ${consultant.lastName}`,
      email: consultant.email,
      role: consultant.role,
    },
    dashboard: {
      totalClients: allClients.length,
      activeClients: allClients.filter(c => {
        // Include clients without tracking (newly enrolled) AND clients active in last 30 days
        if (!c.lastActivityAt) return true;
        const lastActivity = new Date(c.lastActivityAt);
        return (now.getTime() - lastActivity.getTime()) < 30 * 24 * 60 * 60 * 1000;
      }).length,
      pendingReviews: pendingReviewsResult.length,
      upcomingAppointments: upcomingAppointmentsResult.length,
      todayAppointments: todayAppointmentsResult.length,
    },
    clients: {
      all: clientsWithStats,
    },
    exercises: {
      pendingReviews: pendingReviewsResult.map(r => ({
        id: r.assignmentId,
        exerciseTitle: r.exerciseTitle,
        clientName: `${r.clientFirstName} ${r.clientLastName}`,
        submittedAt: r.submittedAt || '',
        dueDate: r.dueDate,
      })),
      recentlyCreated: recentExercisesResult.map(e => ({
        id: e.id,
        title: e.title,
        category: e.category || 'generale',
        assignedTo: e.assignedCount,
        createdAt: e.createdAt || '',
      })),
      stats: exerciseStatsResult[0] || {
        totalCreated: 0,
        totalAssigned: 0,
        awaitingReview: 0,
        completedThisWeek: 0,
      },
    },
    emailMarketing: {
      automation: {
        enabled: schedulerLogsResult.length > 0,
        schedulerActive: true, // TODO: get from settings
        lastRun: schedulerLogsResult[0]?.executedAt || null,
        nextRun: null, // TODO: calculate next run
      },
      recentDrafts: emailDraftsResult.slice(0, 10).map(d => ({
        id: d.id,
        clientName: `${d.clientFirstName} ${d.clientLastName}`,
        subject: d.subject,
        status: d.status,
        generatedAt: d.generatedAt || '',
      })),
      stats: {
        totalSent: emailDraftsResult.filter(d => d.status === 'sent').length,
        sentThisWeek: emailDraftsResult.filter(d => {
          const generated = d.generatedAt ? new Date(d.generatedAt) : null;
          return d.status === 'sent' && generated && generated >= oneWeekAgo;
        }).length,
        sentThisMonth: emailDraftsResult.filter(d => {
          const generated = d.generatedAt ? new Date(d.generatedAt) : null;
          return d.status === 'sent' && generated && generated >= oneMonthAgo;
        }).length,
        pendingDrafts: emailDraftsResult.filter(d => d.status === 'pending').length,
      },
    },
    whatsappLeads: {
      activeLeads: whatsappLeadsResult.slice(0, 15).map(lead => ({
        id: lead.id,
        phoneNumber: lead.phoneNumber,
        name: lead.name,
        status: lead.status,
        lastMessage: lead.lastMessage || '',
        lastMessageAt: lead.lastMessageAt || '',
      })),
      recentConversations: whatsappConversationsResult.map(conv => ({
        id: conv.id,
        phoneNumber: conv.phoneNumber,
        participantName: conv.participantName,
        lastMessage: conv.lastMessage || '',
        lastMessageAt: conv.lastMessageAt || '',
        unreadCount: conv.unreadCount || 0,
      })),
      stats: {
        totalLeads: whatsappLeadsResult.length,
        qualifiedLeads: whatsappLeadsResult.filter(l => l.status === 'qualified').length,
        appointmentsBooked: whatsappLeadsResult.filter(l => l.status === 'appointment_booked').length,
        activeConversations: whatsappConversationsResult.filter(c => (c.unreadCount || 0) > 0).length,
      },
    },
    calendar: {
      upcomingAppointments: (() => {
        // Create a map of consultationId -> related emails
        const emailsByConsultationId = new Map<string, Array<{
          id: string;
          subject: string;
          status: string;
          generatedAt: string;
        }>>();
        
        // Filter and map emails that are linked to consultations
        // Only include emails with status 'pending', 'sent', or 'approved'
        emailDraftsResult
          .filter(email => 
            email.consultationId && 
            (email.status === 'pending' || email.status === 'sent' || email.status === 'approved')
          )
          .forEach(email => {
            const consultationId = email.consultationId!;
            if (!emailsByConsultationId.has(consultationId)) {
              emailsByConsultationId.set(consultationId, []);
            }
            emailsByConsultationId.get(consultationId)!.push({
              id: email.id,
              subject: email.subject,
              status: email.status,
              generatedAt: email.generatedAt || '',
            });
          });
        
        console.log(`📧 [EMAIL MAPPING] Created email mapping for ${emailsByConsultationId.size} consultations`);

        // 1. Map calendar events to appointment format
        const calendarAppointments = upcomingAppointmentsResult.map(apt => ({
          id: apt.id,
          title: apt.title,
          start: apt.start.toISOString(),
          end: apt.end.toISOString(),
          clientName: null,
          consultationType: null,
          source: 'calendar' as const,
        }));

        // 2. Map future consultations to appointment format with related emails
        const futureConsultations = allConsultationsResult
          .filter(c => new Date(c.scheduledAt) >= now && c.status !== 'completed')
          .map(c => {
            const startDate = new Date(c.scheduledAt);
            const durationMinutes = c.duration || 60; // Default to 1 hour if duration is null
            const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
            
            // Get related emails for this consultation
            const relatedEmails = emailsByConsultationId.get(c.id) || [];
            
            return {
              id: c.id,
              title: `Consulenza con ${c.clientFirstName} ${c.clientLastName}`,
              start: startDate.toISOString(),
              end: endDate.toISOString(),
              clientName: `${c.clientFirstName} ${c.clientLastName}`,
              consultationType: 'consultation' as const,
              source: 'consultation' as const,
              relatedEmails: relatedEmails.length > 0 ? relatedEmails : undefined,
            };
          });

        // 3. Combine and sort by start date
        const allAppointments = [...calendarAppointments, ...futureConsultations]
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          .slice(0, 10);

        return allAppointments;
      })(),
      todayEvents: todayAppointmentsResult.map(evt => ({
        id: evt.id,
        title: evt.title,
        start: evt.start.toISOString(),
        end: evt.end.toISOString(),
      })),
      stats: (() => {
        // Include both calendar events AND future consultations in stats
        const futureConsultationsCount = allConsultationsResult.filter(
          c => new Date(c.scheduledAt) >= now && c.status !== 'completed'
        ).length;
        
        const totalUpcoming = upcomingAppointmentsResult.length + futureConsultationsCount;
        
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const calendarThisWeek = upcomingAppointmentsResult.filter(apt => {
          const start = new Date(apt.start);
          return start <= nextWeek;
        }).length;
        
        const consultationsThisWeek = allConsultationsResult.filter(c => {
          const scheduled = new Date(c.scheduledAt);
          return scheduled >= now && scheduled <= nextWeek && c.status !== 'completed';
        }).length;
        
        return {
          totalUpcoming,
          todayCount: todayAppointmentsResult.length,
          thisWeekCount: calendarThisWeek + consultationsThisWeek,
        };
      })(),
    },
    consultations: {
      upcoming: allConsultationsResult
        .filter(c => new Date(c.scheduledAt) >= now && c.status !== 'completed')
        .slice(0, 10)
        .map(c => ({
          id: c.id,
          clientName: `${c.clientFirstName} ${c.clientLastName}`,
          scheduledAt: c.scheduledAt.toISOString(),
          status: c.status,
          notes: c.notes,
        })),
      recent: allConsultationsResult
        .filter(c => c.status === 'completed')
        .slice(0, 10)
        .map(c => ({
          id: c.id,
          clientName: `${c.clientFirstName} ${c.clientLastName}`,
          scheduledAt: c.scheduledAt.toISOString(),
          status: c.status,
          summary: c.summaryEmail || c.transcript || null,
        })),
      stats: {
        total: allConsultationsResult.length,
        upcoming: allConsultationsResult.filter(c => new Date(c.scheduledAt) >= now && c.status !== 'completed').length,
        completed: allConsultationsResult.filter(c => c.status === 'completed').length,
        thisWeek: allConsultationsResult.filter(c => {
          const scheduled = new Date(c.scheduledAt);
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          return scheduled >= now && scheduled <= nextWeek;
        }).length,
      },
    },
    consultationTasks: {
      pending: allConsultationTasksResult
        .filter(t => !t.completed)
        .slice(0, 20)
        .map(t => ({
          id: t.id,
          consultationId: t.consultationId,
          clientName: `${t.clientFirstName} ${t.clientLastName}`,
          title: t.title,
          dueDate: t.dueDate,
          priority: t.priority || 'medium',
          category: t.category || 'generale',
        })),
      stats: {
        total: allConsultationTasksResult.length,
        pending: allConsultationTasksResult.filter(t => !t.completed).length,
        completed: allConsultationTasksResult.filter(t => t.completed).length,
        overdue: allConsultationTasksResult.filter(t => {
          return !t.completed && t.dueDate && new Date(t.dueDate) < now;
        }).length,
      },
    },
    clientGoals: {
      active: allClientGoalsResult
        .filter(g => g.status === 'active')
        .slice(0, 20)
        .map(g => {
          const current = parseFloat(g.currentValue) || 0;
          const target = parseFloat(g.targetValue) || 0;
          const progress = target > 0 ? Math.round((current / target) * 100) : 0;
          
          return {
            id: g.id,
            clientName: `${g.clientFirstName} ${g.clientLastName}`,
            title: g.title,
            description: g.description,
            deadline: g.targetDate,
            targetValue: g.targetValue,
            currentValue: g.currentValue,
            unit: g.unit,
            progress,
            status: g.status,
          };
        }),
      stats: {
        total: allClientGoalsResult.length,
        active: allClientGoalsResult.filter(g => g.status === 'active').length,
        completed: allClientGoalsResult.filter(g => g.status === 'completed').length,
        avgProgress: allClientGoalsResult.length > 0
          ? Math.round(
              allClientGoalsResult.reduce((sum, g) => {
                const current = parseFloat(g.currentValue) || 0;
                const target = parseFloat(g.targetValue) || 0;
                const progress = target > 0 ? (current / target) * 100 : 0;
                return sum + progress;
              }, 0) / allClientGoalsResult.length
            )
          : 0,
      },
    },
    clientStates: {
      all: allClientStatesResult.map(state => ({
        id: state.id,
        clientId: state.clientId,
        clientName: `${state.clientFirstName} ${state.clientLastName}`,
        currentState: state.currentState,
        idealState: state.idealState,
        internalBenefit: state.internalBenefit,
        externalBenefit: state.externalBenefit,
        mainObstacle: state.mainObstacle,
        pastAttempts: state.pastAttempts,
        currentActions: state.currentActions,
        futureVision: state.futureVision,
        motivationDrivers: state.motivationDrivers,
        lastUpdated: state.lastUpdated || '',
        createdAt: state.createdAt || '',
      })),
      stats: {
        totalWithState: allClientStatesResult.length,
        totalWithoutState: allClients.length - allClientStatesResult.length,
      },
    },
    exerciseFeedback: {
      recent: exerciseFeedbackResult.map(item => {
        const feedbackArray = Array.isArray(item.consultantFeedback) 
          ? item.consultantFeedback 
          : [];
        const lastFeedback = feedbackArray.length > 0 
          ? feedbackArray[feedbackArray.length - 1] 
          : null;
        
        return {
          id: item.id,
          exerciseTitle: item.exerciseTitle,
          clientName: `${item.clientFirstName} ${item.clientLastName}`,
          feedbackItems: feedbackArray,
          lastFeedbackAt: lastFeedback?.timestamp || '',
        };
      }),
      stats: {
        total: exerciseFeedbackResult.length,
        withFeedback: exerciseFeedbackResult.filter(item => {
          const feedbackArray = Array.isArray(item.consultantFeedback) 
            ? item.consultantFeedback 
            : [];
          return feedbackArray.length > 0;
        }).length,
      },
    },
    university: (() => {
      // Process university year assignments into hierarchical structure
      const assignmentsMap = new Map<string, any>();
      
      for (const row of universityYearAssignmentsResult) {
        const assignmentId = row.assignment_id;
        
        if (!assignmentsMap.has(assignmentId)) {
          assignmentsMap.set(assignmentId, {
            id: assignmentId,
            clientName: `${row.client_first_name} ${row.client_last_name}`,
            yearName: row.year_name,
            assignedAt: row.assigned_at || '',
            trimesters: new Map<string, any>(),
            lessonsCompleted: 0,
            lessonsTotal: 0,
          });
        }
        
        const assignment = assignmentsMap.get(assignmentId);
        
        // Skip if no trimester data (assignment without structure)
        if (!row.trimester_id) continue;
        
        // Add trimester if not exists
        if (!assignment.trimesters.has(row.trimester_id)) {
          assignment.trimesters.set(row.trimester_id, {
            id: row.trimester_id,
            title: row.trimester_title,
            sortOrder: row.trimester_sort_order,
            modules: new Map<string, any>(),
          });
        }
        
        const trimester = assignment.trimesters.get(row.trimester_id);
        
        // Skip if no module data
        if (!row.module_id) continue;
        
        // Add module if not exists
        if (!trimester.modules.has(row.module_id)) {
          trimester.modules.set(row.module_id, {
            id: row.module_id,
            title: row.module_title,
            sortOrder: row.module_sort_order,
            lessons: [],
          });
        }
        
        const module = trimester.modules.get(row.module_id);
        
        // Skip if no lesson data
        if (!row.lesson_id) continue;
        
        // Add lesson (avoid duplicates by checking if already added)
        const lessonExists = module.lessons.some((l: any) => l.id === row.lesson_id);
        if (!lessonExists) {
          module.lessons.push({
            id: row.lesson_id,
            title: row.lesson_title,
            isCompleted: row.is_completed || false,
          });
          
          assignment.lessonsTotal++;
          if (row.is_completed) {
            assignment.lessonsCompleted++;
          }
        }
      }
      
      // Convert Maps to Arrays and build final structure
      const processedAssignments = Array.from(assignmentsMap.values());
      const yearAssignments = processedAssignments.map(assignment => {
        const trimesters = Array.from(assignment.trimesters.values())
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(trimester => ({
            id: trimester.id,
            title: trimester.title,
            modules: Array.from(trimester.modules.values())
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map(module => ({
                id: module.id,
                title: module.title,
                lessons: module.lessons,
              })),
          }));
        
        const progress = assignment.lessonsTotal > 0
          ? Math.round((assignment.lessonsCompleted / assignment.lessonsTotal) * 100)
          : 0;
        
        return {
          id: assignment.id,
          clientName: assignment.clientName,
          yearName: assignment.yearName,
          assignedAt: assignment.assignedAt,
          progress,
          completedLessons: assignment.lessonsCompleted,
          totalLessons: assignment.lessonsTotal,
          trimesters,
        };
      });
      
      // Calculate stats
      const uniqueClients = new Set(universityYearAssignmentsResult.map((r: any) => `${r.client_first_name} ${r.client_last_name}`));
      const totalProgress = processedAssignments.reduce((sum, a) => {
        const progress = a.lessonsTotal > 0 
          ? (a.lessonsCompleted / a.lessonsTotal) * 100 
          : 0;
        return sum + progress;
      }, 0);
      
      return {
        templates: universityTemplatesResult.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          isActive: template.isActive,
          createdAt: template.createdAt || '',
        })),
        yearAssignments,
        stats: {
          totalTemplates: universityTemplatesResult.length,
          activeTemplates: universityTemplatesResult.filter(t => t.isActive).length,
          totalAssignments: assignmentsMap.size,
          avgProgress: processedAssignments.length > 0
            ? Math.round(totalProgress / processedAssignments.length)
            : 0,
          activeStudents: uniqueClients.size,
        },
      };
    })(),
    exerciseTemplates: {
      available: exerciseTemplatesResult.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category || 'generale',
        type: template.type || 'general',
        usageCount: template.usageCount || 0,
        estimatedDuration: template.estimatedDuration,
        createdAt: template.createdAt || '',
      })),
      stats: {
        total: exerciseTemplatesResult.length,
        totalUsage: exerciseTemplatesResult.reduce((sum, t) => sum + (t.usageCount || 0), 0),
        byCategory: exerciseTemplatesResult.reduce((acc, t) => {
          const category = t.category || 'generale';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    },
    ...(shouldLoadEmailDetailed && {
      emailMarketingDetailed: {
        smtpConfig: smtpConfigDetailedResult[0] ? {
          host: smtpConfigDetailedResult[0].smtpHost,
          port: smtpConfigDetailedResult[0].smtpPort,
          secure: smtpConfigDetailedResult[0].smtpSecure,
          username: smtpConfigDetailedResult[0].smtpUser,
          fromEmail: smtpConfigDetailedResult[0].fromEmail,
          fromName: smtpConfigDetailedResult[0].fromName,
          emailTone: smtpConfigDetailedResult[0].emailTone,
          emailSignature: smtpConfigDetailedResult[0].emailSignature,
          emailFrequencyDays: smtpConfigDetailedResult[0].emailFrequencyDays || 2,
          isActive: smtpConfigDetailedResult[0].isActive,
        } : null,
        emailStats: (() => {
          const currentDate = new Date();
          currentDate.setHours(0, 0, 0, 0);
          
          const currentDayOfWeek = currentDate.getDay();
          const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
          
          const thisWeekMonday = new Date(currentDate);
          thisWeekMonday.setDate(currentDate.getDate() - daysFromMonday);
          
          const lastWeekMonday = new Date(thisWeekMonday);
          lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
          
          const lastWeekSunday = new Date(thisWeekMonday);
          lastWeekSunday.setDate(thisWeekMonday.getDate() - 1);
          lastWeekSunday.setHours(23, 59, 59, 999);
          
          const last30DaysStart = new Date(currentDate);
          last30DaysStart.setDate(currentDate.getDate() - 30);
          
          let thisWeekSent = 0;
          let thisWeekOpened = 0;
          let lastWeekSent = 0;
          let lastWeekOpened = 0;
          let last30DaysSent = 0;
          let last30DaysOpened = 0;
          
          emailHistoryResult.forEach(email => {
            const sentAt = email.sentAt ? new Date(email.sentAt) : null;
            if (!sentAt) return;
            
            const wasOpened = email.openedAt !== null;
            
            if (sentAt >= thisWeekMonday) {
              thisWeekSent++;
              if (wasOpened) thisWeekOpened++;
            }
            
            if (sentAt >= lastWeekMonday && sentAt <= lastWeekSunday) {
              lastWeekSent++;
              if (wasOpened) lastWeekOpened++;
            }
            
            if (sentAt >= last30DaysStart) {
              last30DaysSent++;
              if (wasOpened) last30DaysOpened++;
            }
          });
          
          const openRate = last30DaysSent > 0 
            ? Math.round((last30DaysOpened / last30DaysSent) * 100) 
            : 0;
          
          return {
            thisWeek: {
              sent: thisWeekSent,
              opened: thisWeekOpened,
            },
            lastWeek: {
              sent: lastWeekSent,
              opened: lastWeekOpened,
            },
            last30Days: {
              sent: last30DaysSent,
              opened: last30DaysOpened,
              openRate,
            },
          };
        })(),
        schedulerLogs: schedulerLogsDetailedResult.map(log => ({
          id: log.id,
          executedAt: log.executedAt.toISOString(),
          clientsProcessed: log.clientsProcessed,
          emailsSent: log.emailsSent,
          draftsCreated: log.draftsCreated,
          errors: log.errors,
          status: log.status,
          errorDetails: log.errorDetails,
        })),
        emailHistory: emailHistoryResult.map(email => ({
          id: email.id,
          clientId: email.clientId,
          clientName: `${email.clientFirstName} ${email.clientLastName}`,
          subject: email.subject,
          emailType: email.emailType,
          journeyDay: email.journeyDay,
          sentAt: email.sentAt?.toISOString() || '',
          openedAt: email.openedAt?.toISOString() || null,
          includesTasks: email.includesTasks,
          includesGoals: email.includesGoals,
          isTest: email.isTest,
        })),
        journeyTemplates: journeyTemplatesDetailedResult.map(template => ({
          id: template.id,
          dayOfMonth: template.dayOfMonth,
          title: template.title,
          description: template.description,
          emailType: template.emailType,
          tone: template.tone,
          priority: template.priority,
          isActive: template.isActive,
        })),
        clientAutomation: clientAutomationResult.map(client => {
          const emailFrequencyDays = smtpConfigDetailedResult[0]?.emailFrequencyDays || 2;
          let nextEmailDate = null;
          if (client.lastEmailSentAt) {
            const lastSent = new Date(client.lastEmailSentAt);
            const nextDate = new Date(lastSent);
            nextDate.setDate(nextDate.getDate() + emailFrequencyDays);
            nextEmailDate = nextDate.toISOString();
          }
          
          return {
            clientId: client.clientId,
            clientName: `${client.clientFirstName} ${client.clientLastName}`,
            automationEnabled: client.automationEnabled || false,
            currentDay: client.currentDay,
            lastEmailSentAt: client.lastEmailSentAt?.toISOString() || null,
            nextEmailDate,
            journeyTemplateTitle: null,
          };
        }),
      }
    }),
    ...(shouldLoadWhatsAppDetailed && {
      whatsappDetailed: {
        conversations: (() => {
          // Group messages by conversation
          const messagesByConv = new Map<string, any[]>();
          whatsappRecentMessagesResult.forEach(msg => {
            if (!messagesByConv.has(msg.conversationId)) {
              messagesByConv.set(msg.conversationId, []);
            }
            messagesByConv.get(msg.conversationId)!.push(msg);
          });
          
          // Map conversations with agent names and client names
          return whatsappConversationsDetailedResult.map(conv => {
            const messages = messagesByConv.get(conv.id) || [];
            const lastMessage = messages[0] || null;
            
            // Find agent name
            const agent = whatsappAgentConfigsResult.find(a => a.id === conv.agentConfigId);
            
            // Find client name if userId exists
            const client = conv.userId ? allClients.find(c => c.id === conv.userId) : null;
            
            return {
              id: conv.id,
              phoneNumber: conv.phoneNumber,
              userId: conv.userId,
              clientName: client ? `${client.firstName} ${client.lastName}` : null,
              agentName: agent?.agentName || 'Default Agent',
              isLead: conv.isLead,
              aiEnabled: conv.aiEnabled,
              lastMessageAt: conv.lastMessageAt?.toISOString() || '',
              lastMessageText: lastMessage?.messageText || '',
              lastMessageFrom: conv.lastMessageFrom || 'client',
              unreadCount: conv.unreadByConsultant || 0,
              messageCount: conv.messageCount || 0,
            };
          });
        })(),
        recentMessages: (() => {
          const messagesByConv = new Map<string, any[]>();
          whatsappRecentMessagesResult.forEach(msg => {
            if (!messagesByConv.has(msg.conversationId)) {
              messagesByConv.set(msg.conversationId, []);
            }
            messagesByConv.get(msg.conversationId)!.push({
              id: msg.id,
              text: msg.messageText,
              sender: msg.sender,
              createdAt: msg.createdAt?.toISOString() || '',
            });
          });
          
          return Array.from(messagesByConv.entries()).map(([conversationId, messages]) => ({
            conversationId,
            messages: messages.slice(0, 10),
          }));
        })(),
        agents: whatsappAgentConfigsResult.map(agent => ({
          id: agent.id,
          name: agent.agentName,
          systemPrompt: agent.salesScript,
          personality: agent.aiPersonality,
          isDryRun: agent.isDryRun,
          isActive: agent.isActive,
        })),
        metrics: {
          totalConversations: whatsappConversationsDetailedResult.length,
          aiEnabledCount: whatsappConversationsDetailedResult.filter(c => c.aiEnabled).length,
          messagesToday: whatsappRecentMessagesResult.filter(m => {
            const messageDate = m.createdAt ? new Date(m.createdAt) : new Date();
            return messageDate >= new Date(new Date().setHours(0, 0, 0, 0));
          }).length,
          messagesThisWeek: whatsappRecentMessagesResult.filter(m => {
            const messageDate = m.createdAt ? new Date(m.createdAt) : new Date();
            return messageDate >= oneWeekAgo;
          }).length,
          leadsConverted: whatsappConversationsDetailedResult.filter(c => c.isLead && c.userId).length,
        },
      }
    }),
    ...(shouldLoadAIAgents && dotMetrics && millieMetrics && echoMetrics && specMetrics && {
      aiAgents: {
        dot: {
          name: "Dot",
          role: "AI Receptionist",
          conversationsManaged: dotMetrics.conversationsManaged,
          appointmentsBooked: dotMetrics.appointmentsBooked,
          leadsQualified: dotMetrics.leadsQualified,
          avgResponseTime: null,
        },
        millie: {
          name: "Millie",
          role: "AI Email Writer",
          emailsGenerated: millieMetrics.emailsGenerated,
          draftsPending: millieMetrics.draftsPending,
          emailsSentThisWeek: millieMetrics.emailsSentThisWeek,
          openRate: millieMetrics.openRate,
        },
        echo: {
          name: "Echo",
          role: "AI Consultation Summarizer",
          summariesGenerated: echoMetrics.summariesGenerated,
          consultationEmailsSent: echoMetrics.consultationEmailsSent,
          avgSummaryLength: echoMetrics.avgSummaryLength,
        },
        spec: {
          name: "Spec",
          role: "AI Client Researcher",
          clientConversations: specMetrics.clientConversations,
          questionsAnswered: specMetrics.questionsAnswered,
          documentsReferenced: specMetrics.documentsReferenced,
        },
      }
    }),
    ...(shouldLoadLeads && {
      leadManagement: {
        leads: proactiveLeadsResult.map(lead => {
          const campaign = marketingCampaignsResult.find(c => c.id === lead.campaignId);
          const agent = whatsappAgentConfigsResult?.find(a => a.id === lead.agentConfigId);
          return {
            id: lead.id,
            firstName: lead.firstName,
            lastName: lead.lastName,
            phoneNumber: lead.phoneNumber,
            campaignId: lead.campaignId,
            campaignName: campaign?.campaignName || 'Senza campagna',
            agentConfigId: lead.agentConfigId,
            agentName: agent?.agentName || 'Nessun agente',
            leadCategory: lead.leadCategory,
            status: lead.status,
            contactSchedule: lead.contactSchedule,
            lastContactedAt: lead.lastContactedAt,
            lastMessageSent: lead.lastMessageSent,
            idealState: lead.idealState,
            leadInfo: typeof lead.leadInfo === 'object' && lead.leadInfo !== null
              ? lead.leadInfo as { obiettivi?: string; desideri?: string; uncino?: string; fonte?: string }
              : {},
            metadata: typeof lead.metadata === 'object' && lead.metadata !== null
              ? lead.metadata as { tags?: string[]; notes?: string; conversationId?: string }
              : {},
          };
        }),
        stats: (() => {
          const statusMap = new Map(leadStatsByStatusResult.map(s => [s.status, s.count]));
          const categoryMap = new Map(leadStatsByCategoryResult.map(c => [c.category, c.count]));
          
          const totalLeads = proactiveLeadsResult.length;
          const convertedLeads = statusMap.get('converted') || 0;
          const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
          
          const todayStr = today;
          const scheduledToday = proactiveLeadsResult.filter(lead => {
            if (!lead.contactSchedule) return false;
            const scheduleStr = lead.contactSchedule instanceof Date 
              ? lead.contactSchedule.toISOString() 
              : String(lead.contactSchedule);
            return scheduleStr.startsWith(todayStr);
          }).length;
          
          const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const scheduledThisWeek = proactiveLeadsResult.filter(lead => {
            if (!lead.contactSchedule) return false;
            const scheduleStr = lead.contactSchedule instanceof Date 
              ? lead.contactSchedule.toISOString() 
              : String(lead.contactSchedule);
            const scheduleDate = scheduleStr.split('T')[0];
            return scheduleDate >= todayStr && scheduleDate <= weekFromNow;
          }).length;
          
          return {
            total: totalLeads,
            byStatus: {
              pending: statusMap.get('pending') || 0,
              contacted: statusMap.get('contacted') || 0,
              responded: statusMap.get('responded') || 0,
              converted: statusMap.get('converted') || 0,
              inactive: statusMap.get('inactive') || 0,
            },
            byCategory: {
              freddo: categoryMap.get('freddo') || 0,
              tiepido: categoryMap.get('tiepido') || 0,
              caldo: categoryMap.get('caldo') || 0,
              recupero: categoryMap.get('recupero') || 0,
              referral: categoryMap.get('referral') || 0,
            },
            conversionRate,
            avgResponseTime: null,
            scheduledToday,
            scheduledThisWeek,
          };
        })(),
        byCampaign: (() => {
          // Build campaign names map from Q44 (marketing campaigns)
          const campaignNamesMap = new Map<string, string>();
          marketingCampaignsResult.forEach(c => campaignNamesMap.set(c.id, c.campaignName));
          
          return leadStatsByCampaignResult.map(campaign => ({
            campaignId: campaign.campaignId,
            campaignName: campaign.campaignId 
              ? (campaignNamesMap.get(campaign.campaignId) || 'Senza campagna')
              : 'Senza campagna',
            leadCount: campaign.totalCount,
            convertedCount: campaign.convertedCount,
            conversionRate: campaign.totalCount > 0 
              ? Math.round((campaign.convertedCount / campaign.totalCount) * 100) 
              : 0,
          }));
        })(),
      }
    }),
    ...(shouldLoadCampaigns && {
      campaignMarketing: {
        campaigns: (() => {
          const leadCountMap = new Map(leadStatsByCampaignResult.map(c => [c.campaignId, {
            total: c.totalCount,
            converted: c.convertedCount,
          }]));
          
          return marketingCampaignsResult.map(campaign => {
            const leadStats = leadCountMap.get(campaign.id) || { total: 0, converted: 0 };
            const conversionRate = leadStats.total > 0 
              ? Math.round((leadStats.converted / leadStats.total) * 100) 
              : 0;
            
            return {
              id: campaign.id,
              campaignName: campaign.campaignName,
              campaignType: campaign.campaignType,
              leadCategory: campaign.leadCategory,
              hookText: campaign.hookText,
              idealStateDescription: campaign.idealStateDescription,
              implicitDesires: campaign.implicitDesires,
              defaultObiettivi: campaign.defaultObiettivi,
              preferredAgentName: campaign.preferredAgentName || 'Nessun agente',
              templateAssignments: {
                opening: campaign.openingTemplateId,
                followupGentle: campaign.followupGentleTemplateId,
                followupValue: campaign.followupValueTemplateId,
                followupFinal: campaign.followupFinalTemplateId,
              },
              totalLeads: leadStats.total,
              convertedLeads: leadStats.converted,
              conversionRate,
              isActive: campaign.isActive,
              createdAt: campaign.createdAt || '',
            };
          });
        })(),
        analytics: {
          last30Days: campaignAnalyticsResult.map(analytics => ({
            campaignId: analytics.campaignId,
            campaignName: analytics.campaignName || 'Campagna sconosciuta',
            date: analytics.date,
            leadsCreated: analytics.leadsCreated,
            leadsContacted: analytics.leadsContacted,
            leadsResponded: analytics.leadsResponded,
            leadsConverted: analytics.leadsConverted,
            avgResponseTimeHours: analytics.avgResponseTimeHours,
            conversionRate: analytics.leadsCreated > 0 
              ? Math.round((analytics.leadsConverted / analytics.leadsCreated) * 100) 
              : 0,
          })),
          summary: (() => {
            const totalCampaigns = marketingCampaignsResult.length;
            const activeCampaigns = marketingCampaignsResult.filter(c => c.isActive).length;
            
            const totalLeadsAllTime = leadStatsByCampaignResult.reduce((sum, c) => sum + c.totalCount, 0);
            const totalConvertedAllTime = leadStatsByCampaignResult.reduce((sum, c) => sum + c.convertedCount, 0);
            
            const avgConversionRate = totalLeadsAllTime > 0 
              ? Math.round((totalConvertedAllTime / totalLeadsAllTime) * 100) 
              : 0;
            
            const bestPerforming = leadStatsByCampaignResult
              .map(c => ({
                name: c.campaignName || 'Senza campagna',
                conversionRate: c.totalCount > 0 
                  ? Math.round((c.convertedCount / c.totalCount) * 100) 
                  : 0,
              }))
              .sort((a, b) => b.conversionRate - a.conversionRate)[0] || null;
            
            return {
              totalCampaigns,
              activeCampaigns,
              totalLeadsAllTime,
              totalConvertedAllTime,
              avgConversionRate,
              bestPerformingCampaign: bestPerforming,
            };
          })(),
        },
      }
    }),
    ...(shouldLoadApiSettings && {
      apiSettings: {
        configs: externalApiConfigsResult.map(config => {
          const apiKey = config.apiKey || '';
          const apiKeyMasked = apiKey.length > 10 
            ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 3)}`
            : '***';
          
          return {
            id: config.id,
            configName: config.configName,
            baseUrl: config.baseUrl,
            apiKeyMasked,
            leadType: config.leadType,
            sourceFilter: config.sourceFilter,
            campaignFilter: config.campaignFilter,
            daysFilter: config.daysFilter,
            targetCampaignId: config.targetCampaignId,
            targetCampaignName: config.targetCampaignName || 'Nessuna campagna',
            pollingEnabled: config.pollingEnabled,
            pollingIntervalMinutes: config.pollingIntervalMinutes,
            isActive: config.isActive,
            lastImportAt: config.lastImportAt,
            lastImportStatus: config.lastImportStatus,
            lastImportLeadsCount: config.lastImportLeadsCount,
            lastImportErrorMessage: config.lastImportErrorMessage,
            nextScheduledRun: config.nextScheduledRun,
          };
        }),
        recentImports: externalLeadImportLogsResult.map(log => ({
          id: log.id,
          configId: log.configId,
          configName: log.configName || 'Config sconosciuta',
          importType: log.importType,
          status: log.status,
          leadsProcessed: log.leadsProcessed,
          leadsImported: log.leadsImported,
          leadsUpdated: log.leadsUpdated,
          leadsDuplicated: log.leadsDuplicated,
          leadsErrored: log.leadsErrored,
          errorMessage: log.errorMessage,
          startedAt: log.startedAt || '',
          completedAt: log.completedAt,
          durationMs: log.durationMs,
        })),
        stats: (() => {
          const totalConfigs = externalApiConfigsResult.length;
          const activeConfigs = externalApiConfigsResult.filter(c => c.isActive).length;
          const pollingEnabledCount = externalApiConfigsResult.filter(c => c.pollingEnabled).length;
          
          const totalImportsLast30Days = externalLeadImportLogsResult.length;
          const totalLeadsImportedLast30Days = externalLeadImportLogsResult.reduce((sum, log) => sum + log.leadsImported, 0);
          
          const completedImports = externalLeadImportLogsResult.filter(log => log.durationMs !== null);
          const avgImportDurationMs = completedImports.length > 0
            ? Math.round(completedImports.reduce((sum, log) => sum + (log.durationMs || 0), 0) / completedImports.length)
            : 0;
          
          const successfulImports = externalLeadImportLogsResult.filter(log => log.status === 'success');
          const lastSuccessfulImport = successfulImports.length > 0 
            ? successfulImports[0].startedAt 
            : null;
          
          return {
            totalConfigs,
            activeConfigs,
            pollingEnabledCount,
            totalImportsLast30Days,
            totalLeadsImportedLast30Days,
            avgImportDurationMs,
            lastSuccessfulImport,
          };
        })(),
      }
    }),
    ...(shouldLoadWhatsAppConfig && {
      whatsappConfig: (() => {
        const config = whatsappConfigResult[0];
        
        // If no config found, return unconfigured state
        if (!config) {
          return {
            // === BASIC CONFIGURATION ===
            configured: false,
            accountSidMasked: null,
            authTokenMasked: null,
            whatsappNumber: null,
            isActive: false,
            autoResponseEnabled: false,
            workingHoursEnabled: false,
            workingHoursStart: null,
            workingHoursEnd: null,
            workingDays: null,
            afterHoursMessage: null,
            isDryRun: false,
            agentName: 'Default Agent',
            
            // === BUSINESS PROFILE ===
            businessName: null,
            consultantDisplayName: null,
            businessDescription: null,
            consultantBio: null,
            salesScript: null,
            
            // === AUTHORITY & POSITIONING ===
            vision: null,
            mission: null,
            usp: null,
            values: null,
            
            // === TARGET AUDIENCE ===
            whoWeHelp: null,
            whoWeDontHelp: null,
            whatWeDo: null,
            howWeDoIt: null,
            
            // === PROOF & CREDIBILITY ===
            yearsExperience: null,
            clientsHelped: null,
            resultsGenerated: null,
            caseStudies: null,
            softwareCreated: null,
            booksPublished: null,
            
            // === SERVICES & GUARANTEES ===
            servicesOffered: null,
            guarantees: null,
            
            // === AI PERSONALITY & SETTINGS ===
            aiPersonality: null,
            whatsappConciseMode: false,
            agentType: null,
            
            // === TEMPLATE REFERENCES ===
            whatsappTemplates: null,
            templateBodies: null,
            
            // === LEAD DEFAULTS ===
            defaultObiettivi: null,
            defaultDesideri: null,
            defaultUncino: null,
            defaultIdealState: null,
          };
        }
        
        // Parse workingDays from JSON if it's a string
        let parsedWorkingDays: string[] | null = null;
        if (config.workingDays) {
          try {
            if (typeof config.workingDays === 'string') {
              parsedWorkingDays = JSON.parse(config.workingDays);
            } else if (Array.isArray(config.workingDays)) {
              parsedWorkingDays = config.workingDays;
            }
          } catch (e) {
            console.warn(`⚠️ Failed to parse workingDays: ${e}`);
            parsedWorkingDays = null;
          }
        }
        
        // Mask sensitive credentials
        const accountSidMasked = maskSensitiveCredential(config.twilioAccountSid);
        const authTokenMasked = maskSensitiveCredential(config.twilioAuthToken);
        
        console.log(`🔐 [WhatsApp Config] Populated with masked credentials (Account SID: ${accountSidMasked ? 'MASKED' : 'NULL'}, Auth Token: ${authTokenMasked ? 'MASKED' : 'NULL'})`);
        
        // Parse JSON arrays for complex fields
        let parsedValues: string[] | null = null;
        if (config.values) {
          try {
            parsedValues = typeof config.values === 'string' 
              ? JSON.parse(config.values) 
              : config.values;
          } catch (e) {
            console.warn(`⚠️ Failed to parse values: ${e}`);
          }
        }
        
        let parsedSoftwareCreated: any[] | null = null;
        if (config.softwareCreated) {
          try {
            parsedSoftwareCreated = typeof config.softwareCreated === 'string'
              ? JSON.parse(config.softwareCreated)
              : config.softwareCreated;
          } catch (e) {
            console.warn(`⚠️ Failed to parse softwareCreated: ${e}`);
          }
        }
        
        let parsedBooksPublished: any[] | null = null;
        if (config.booksPublished) {
          try {
            parsedBooksPublished = typeof config.booksPublished === 'string'
              ? JSON.parse(config.booksPublished)
              : config.booksPublished;
          } catch (e) {
            console.warn(`⚠️ Failed to parse booksPublished: ${e}`);
          }
        }
        
        let parsedCaseStudies: any[] | null = null;
        if (config.caseStudies) {
          try {
            parsedCaseStudies = typeof config.caseStudies === 'string'
              ? JSON.parse(config.caseStudies)
              : config.caseStudies;
          } catch (e) {
            console.warn(`⚠️ Failed to parse caseStudies: ${e}`);
          }
        }
        
        let parsedServicesOffered: any[] | null = null;
        if (config.servicesOffered) {
          try {
            parsedServicesOffered = typeof config.servicesOffered === 'string'
              ? JSON.parse(config.servicesOffered)
              : config.servicesOffered;
          } catch (e) {
            console.warn(`⚠️ Failed to parse servicesOffered: ${e}`);
          }
        }
        
        let parsedWhatsappTemplates: any | null = null;
        if (config.whatsappTemplates) {
          try {
            parsedWhatsappTemplates = typeof config.whatsappTemplates === 'string'
              ? JSON.parse(config.whatsappTemplates)
              : config.whatsappTemplates;
          } catch (e) {
            console.warn(`⚠️ Failed to parse whatsappTemplates: ${e}`);
          }
        }
        
        let parsedTemplateBodies: any | null = null;
        if (config.templateBodies) {
          try {
            parsedTemplateBodies = typeof config.templateBodies === 'string'
              ? JSON.parse(config.templateBodies)
              : config.templateBodies;
          } catch (e) {
            console.warn(`⚠️ Failed to parse templateBodies: ${e}`);
          }
        }
        
        return {
          // === BASIC CONFIGURATION ===
          configured: true,
          accountSidMasked,
          authTokenMasked,
          whatsappNumber: config.twilioWhatsappNumber,
          isActive: config.isActive,
          autoResponseEnabled: config.autoResponseEnabled,
          workingHoursEnabled: config.workingHoursEnabled,
          workingHoursStart: config.workingHoursStart,
          workingHoursEnd: config.workingHoursEnd,
          workingDays: parsedWorkingDays,
          afterHoursMessage: config.afterHoursMessage,
          isDryRun: config.isDryRun,
          agentName: config.agentName,
          
          // === BUSINESS PROFILE ===
          businessName: config.businessName,
          consultantDisplayName: config.consultantDisplayName,
          businessDescription: config.businessDescription,
          consultantBio: config.consultantBio,
          salesScript: config.salesScript,
          
          // === AUTHORITY & POSITIONING ===
          vision: config.vision,
          mission: config.mission,
          usp: config.usp,
          values: parsedValues,
          
          // === TARGET AUDIENCE ===
          whoWeHelp: config.whoWeHelp,
          whoWeDontHelp: config.whoWeDontHelp,
          whatWeDo: config.whatWeDo,
          howWeDoIt: config.howWeDoIt,
          
          // === PROOF & CREDIBILITY ===
          yearsExperience: config.yearsExperience,
          clientsHelped: config.clientsHelped,
          resultsGenerated: config.resultsGenerated,
          caseStudies: parsedCaseStudies,
          softwareCreated: parsedSoftwareCreated,
          booksPublished: parsedBooksPublished,
          
          // === SERVICES & GUARANTEES ===
          servicesOffered: parsedServicesOffered,
          guarantees: config.guarantees,
          
          // === AI PERSONALITY & SETTINGS ===
          aiPersonality: config.aiPersonality,
          whatsappConciseMode: config.whatsappConciseMode,
          agentType: config.agentType,
          
          // === TEMPLATE REFERENCES ===
          whatsappTemplates: parsedWhatsappTemplates,
          templateBodies: parsedTemplateBodies,
          
          // === LEAD DEFAULTS ===
          defaultObiettivi: config.defaultObiettivi,
          defaultDesideri: config.defaultDesideri,
          defaultUncino: config.defaultUncino,
          defaultIdealState: config.defaultIdealState,
        };
      })()
    }),
    ...(shouldLoadWhatsAppConfig && {
      whatsappTemplatesDetailed: whatsappCustomTemplatesResult.map(t => ({
        id: t.templateId,
        name: t.templateName,
        type: t.templateType,
        description: t.description,
        archivedAt: t.archivedAt,
        createdAt: t.createdAt,
        activeVersion: t.activeVersionId ? {
          id: t.activeVersionId,
          versionNumber: t.activeVersionNumber,
          bodyText: t.activeVersionBodyText,
          twilioContentSid: t.activeVersionTwilioContentSid,
          twilioStatus: t.activeVersionTwilioStatus,
          lastSyncedAt: t.activeVersionLastSyncedAt,
        } : null,
      })),
    }),
    ...(shouldLoadWhatsAppConfig && {
      whatsappTemplateAssignments: (() => {
        // Group assignments by agent
        const assignmentsByAgent: Record<string, any> = {};
        
        for (const assignment of whatsappTemplateAssignmentsResult) {
          if (!assignmentsByAgent[assignment.agentConfigId]) {
            assignmentsByAgent[assignment.agentConfigId] = {
              agentConfigId: assignment.agentConfigId,
              agentName: assignment.agentName,
              agentType: assignment.agentType,
              templates: {
                opening: null,
                followupGentle: null,
                followupValue: null,
                followupFinal: null,
              },
            };
          }
          
          const agentData = assignmentsByAgent[assignment.agentConfigId];
          const templateInfo = {
            id: assignment.templateId,
            name: assignment.templateName,
            assignedAt: assignment.assignedAt,
          };
          
          if (assignment.templateType === 'opening') {
            agentData.templates.opening = templateInfo;
          } else if (assignment.templateType === 'followup_gentle') {
            agentData.templates.followupGentle = templateInfo;
          } else if (assignment.templateType === 'followup_value') {
            agentData.templates.followupValue = templateInfo;
          } else if (assignment.templateType === 'followup_final') {
            agentData.templates.followupFinal = templateInfo;
          }
        }
        
        return Object.values(assignmentsByAgent);
      })(),
    }),
    ...(shouldLoadWhatsAppConfig && {
      twilioTemplates: (() => {
        // Group Twilio templates by agent
        const templatesByAgent: Record<string, any> = {};
        
        for (const template of twilioTemplatesResult) {
          if (!templatesByAgent[template.agentId]) {
            templatesByAgent[template.agentId] = {
              agentId: template.agentId,
              agentName: template.agentName,
              agentType: template.agentType,
              templates: [],
            };
          }
          
          templatesByAgent[template.agentId].templates.push({
            sid: template.sid,
            friendlyName: template.friendlyName,
            language: template.language,
            bodyText: template.bodyText,
            variables: template.variables,
          });
        }
        
        return {
          totalTemplates: twilioTemplatesResult.length,
          byAgent: Object.values(templatesByAgent),
          allTemplates: twilioTemplatesResult.map(t => ({
            sid: t.sid,
            friendlyName: t.friendlyName,
            language: t.language,
            bodyText: t.bodyText,
            variables: t.variables,
            agentId: t.agentId,
            agentName: t.agentName,
            agentType: t.agentType,
          })),
        };
      })(),
    }),
    calendarSettings: calendarSettingsResult ? {
      googleCalendarConnected: !!(calendarSettingsResult.googleRefreshToken || calendarSettingsResult.googleAccessToken),
      hasOAuthCredentials: !!(calendarSettingsResult.googleOAuthClientId && calendarSettingsResult.googleOAuthClientSecret),
      calendarId: calendarSettingsResult.googleCalendarId || 'primary',
      aiAvailability: calendarSettingsResult.aiAvailability,
      appointmentAvailability: calendarSettingsResult.appointmentAvailability,
      timezone: calendarSettingsResult.timezone || 'Europe/Rome',
    } : null,
  };

  // Enrich context with pageContext if provided
  if (options?.pageContext) {
    const pageType = options.pageContext.pageType;
    const stats = options.pageContext.stats || {};
    
    console.log(`\n📄 [Page Context] Enriching context with page info:`, {
      pageType,
      stats: Object.keys(stats).length > 0 ? stats : 'none',
    });
    
    // Add a contextNote to guide AI based on the current page
    const contextNotes: string[] = [];
    
    // Page-specific context notes
    switch (pageType) {
      case 'whatsapp_config':
        contextNotes.push('L\'utente sta visualizzando la configurazione WhatsApp.');
        if (stats.unreadWhatsAppMessages) {
          contextNotes.push(`Ci sono ${stats.unreadWhatsAppMessages} messaggi WhatsApp non letti.`);
        }
        break;
      
      case 'calendar_settings':
        contextNotes.push('L\'utente sta visualizzando le impostazioni del calendario.');
        if (stats.upcomingAppointments) {
          contextNotes.push(`Ci sono ${stats.upcomingAppointments} appuntamenti futuri programmati.`);
        }
        break;
      
      case 'clients_management':
        contextNotes.push('L\'utente sta visualizzando la gestione clienti.');
        if (stats.totalClients) {
          contextNotes.push(`Totale clienti: ${stats.totalClients}.`);
        }
        if (stats.activeClients) {
          contextNotes.push(`Clienti attivi: ${stats.activeClients}.`);
        }
        break;
      
      case 'campaigns':
        contextNotes.push('L\'utente sta visualizzando le campagne marketing.');
        if (stats.activeCampaigns) {
          contextNotes.push(`Campagne attive: ${stats.activeCampaigns}.`);
        }
        break;
      
      case 'lead_management':
        contextNotes.push('L\'utente sta visualizzando la gestione lead.');
        if (stats.totalLeads) {
          contextNotes.push(`Totale lead: ${stats.totalLeads}.`);
        }
        break;
      
      case 'dashboard':
        contextNotes.push('L\'utente sta visualizzando la dashboard principale.');
        break;
      
      default:
        contextNotes.push(`L'utente sta visualizzando la pagina: ${pageType}.`);
    }
    
    // Persist page context notes to the context object for use in system prompt
    if (contextNotes.length > 0) {
      context.pageContext = {
        pageType: options.pageContext?.pageType ?? 'unknown',
        contextNotes
      };
      console.log(`   📝 Context Notes:`, contextNotes);
    }
  }
  
  // Calculate and log token breakdown
  const tokenBreakdown = calculateConsultantTokenBreakdown(context);
  
  console.log(`\n📊 Token Usage Breakdown (Intent: ${intent}):`);
  console.log(`   Dashboard: ${tokenBreakdown.dashboard.toLocaleString()} tokens`);
  console.log(`   Clients (${context.clients.all.length} clients): ${tokenBreakdown.clients.toLocaleString()} tokens`);
  console.log(`   Exercises: ${tokenBreakdown.exercises.toLocaleString()} tokens`);
  console.log(`   Email Marketing: ${tokenBreakdown.emailMarketing.toLocaleString()} tokens`);
  console.log(`   WhatsApp Leads: ${tokenBreakdown.whatsappLeads.toLocaleString()} tokens`);
  console.log(`   Calendar: ${tokenBreakdown.calendar.toLocaleString()} tokens`);
  console.log(`   Consultations: ${tokenBreakdown.consultations.toLocaleString()} tokens`);
  console.log(`   Consultation Tasks: ${tokenBreakdown.consultationTasks.toLocaleString()} tokens`);
  console.log(`   Client Goals: ${tokenBreakdown.clientGoals.toLocaleString()} tokens`);
  console.log(`   Client States (${context.clientStates.all.length} states): ${tokenBreakdown.clientStates.toLocaleString()} tokens`);
  console.log(`   SMTP Configuration: ${tokenBreakdown.smtpConfiguration.toLocaleString()} tokens`);
  console.log(`   Email Templates: ${tokenBreakdown.emailTemplates.toLocaleString()} tokens`);
  console.log(`   WhatsApp Templates: ${tokenBreakdown.whatsappTemplates.toLocaleString()} tokens`);
  console.log(`   Library Documents: ${tokenBreakdown.libraryDocuments.toLocaleString()} tokens`);
  console.log(`   Exercise Feedback: ${tokenBreakdown.exerciseFeedback.toLocaleString()} tokens`);
  console.log(`   University: ${tokenBreakdown.university.toLocaleString()} tokens`);
  console.log(`   Exercise Templates: ${tokenBreakdown.exerciseTemplates.toLocaleString()} tokens`);
  
  if (tokenBreakdown.emailMarketingDetailed > 0) {
    console.log(`   📧 Email Marketing (Detailed): ${tokenBreakdown.emailMarketingDetailed.toLocaleString()} tokens`);
  }
  if (tokenBreakdown.whatsappDetailed > 0) {
    console.log(`   💬 WhatsApp (Detailed): ${tokenBreakdown.whatsappDetailed.toLocaleString()} tokens`);
  }
  if (tokenBreakdown.aiAgents > 0) {
    console.log(`   🤖 AI Agents: ${tokenBreakdown.aiAgents.toLocaleString()} tokens`);
  }
  if (tokenBreakdown.leadManagement > 0) {
    console.log(`   🎯 Lead Management: ${tokenBreakdown.leadManagement.toLocaleString()} tokens`);
  }
  if (tokenBreakdown.campaignMarketing > 0) {
    console.log(`   📊 Campaign Marketing: ${tokenBreakdown.campaignMarketing.toLocaleString()} tokens`);
  }
  if (tokenBreakdown.apiSettings > 0) {
    console.log(`   🔌 API Settings: ${tokenBreakdown.apiSettings.toLocaleString()} tokens`);
  }
  if (tokenBreakdown.whatsappConfig > 0) {
    console.log(`   📱 WhatsApp Config: ${tokenBreakdown.whatsappConfig.toLocaleString()} tokens`);
  }
  if (tokenBreakdown.whatsappTemplatesDetailed > 0) {
    console.log(`   📝 WhatsApp Templates (Detailed): ${tokenBreakdown.whatsappTemplatesDetailed.toLocaleString()} tokens`);
  }
  if (tokenBreakdown.whatsappTemplateAssignments > 0) {
    console.log(`   🔗 WhatsApp Template Assignments: ${tokenBreakdown.whatsappTemplateAssignments.toLocaleString()} tokens`);
  }
  if (tokenBreakdown.twilioTemplates > 0) {
    console.log(`   📲 Twilio WhatsApp Templates: ${tokenBreakdown.twilioTemplates.toLocaleString()} tokens`);
  }
  if (tokenBreakdown.calendarSettings > 0) {
    console.log(`   📅 Calendar Settings: ${tokenBreakdown.calendarSettings.toLocaleString()} tokens`);
  }
  
  console.log(`   Base (prompts + metadata): ${tokenBreakdown.base.toLocaleString()} tokens`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   🎯 TOTAL ESTIMATED: ${tokenBreakdown.total.toLocaleString()} tokens\n`);
  
  // Cache the result
  consultantContextCache.set(cacheKey, { context, timestamp: Date.now() });
  console.log(`✅ Built and cached consultant context (intent: ${intent})`);

  return context;
}
