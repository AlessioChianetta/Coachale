import {
  type User,
  type InsertUser,
  type Exercise,
  type InsertExercise,
  type ExerciseAssignment,
  type InsertExerciseAssignment,
  type ExerciseSubmission,
  type InsertExerciseSubmission,
  type Consultation,
  type InsertConsultation,
  type Goal,
  type InsertGoal,
  type ClientProgress,
  type InsertClientProgress,
  type ExerciseRevisionHistory,
  type InsertExerciseRevisionHistory,
  type ClientEngagementMetrics,
  type InsertClientEngagementMetrics,
  type ExercisePerformanceMetrics,
  type InsertExercisePerformanceMetrics,
  type ConsultantAnalytics,
  type InsertConsultantAnalytics,
  type ClientAnalyticsSummary,
  type InsertClientAnalyticsSummary,
  type UserActivityLog,
  type InsertUserActivityLog,
  type UserSession,
  type InsertUserSession,
  type ExerciseTemplate,
  type InsertExerciseTemplate,
  type TemplateClientAssociation,
  type InsertTemplateClientAssociation,
  type RoadmapPhase,
  type InsertRoadmapPhase,
  type RoadmapGroup,
  type InsertRoadmapGroup,
  type RoadmapItem,
  type InsertRoadmapItem,
  type ClientRoadmapProgress,
  type InsertClientRoadmapProgress,
  type LibraryCategory,
  type InsertLibraryCategory,
  type LibrarySubcategory,
  type InsertLibrarySubcategory,
  type LibraryDocument,
  type InsertLibraryDocument,
  type LibraryDocumentSection,
  type InsertLibraryDocumentSection,
  type ClientLibraryProgress,
  type InsertClientLibraryProgress,
  type LibraryCategoryClientAssignment,
  type InsertLibraryCategoryClientAssignment,
  type DailyTask,
  type InsertDailyTask,
  type DailyReflection,
  type InsertDailyReflection,
  type ConsultationTask,
  type InsertConsultationTask,
  type UpdateConsultationTask,
  type ClientStateTracking,
  type InsertClientStateTracking,
  type UpdateClientStateTracking,
  type AutomatedEmailsLog,
  type InsertAutomatedEmailsLog,
  type UniversityYear,
  type InsertUniversityYear,
  type UniversityTrimester,
  type InsertUniversityTrimester,
  type UniversityModule,
  type InsertUniversityModule,
  type UniversityLesson,
  type InsertUniversityLesson,
  type UniversityProgress,
  type InsertUniversityProgress,
  type UniversityGrade,
  type InsertUniversityGrade,
  type UniversityCertificate,
  type InsertUniversityCertificate,
  type UniversityYearClientAssignment,
  type InsertUniversityYearClientAssignment,
  type UserFinanceSettings,
  type InsertUserFinanceSettings,
  type ConsultantSmtpSettings,
  type InsertConsultantSmtpSettings,
  type EmailDraft,
  type InsertEmailDraft,
  type UpdateEmailDraft,
  type ClientEmailAutomation,
  type InsertClientEmailAutomation,
  type UpdateClientEmailAutomation,
  type SchedulerExecutionLog,
  type InsertSchedulerExecutionLog,
  type CalendarEvent,
  type InsertCalendarEvent,
  type EmailJourneyTemplate,
  type InsertEmailJourneyTemplate,
  type ClientEmailJourneyProgress,
  type InsertClientEmailJourneyProgress,
  type UpdateClientEmailJourneyProgress,
  type ExternalApiConfig,
  type InsertExternalApiConfig,
  type UpdateExternalApiConfig,
  type ExternalLeadImportLog,
  type InsertExternalLeadImportLog,
  type WebhookConfig,
  type InsertWebhookConfig,
  type UpdateWebhookConfig,
  type VertexAiSettings,
  type InsertVertexAiSettings,
  type UpdateVertexAiSettings,
  type WhatsappVertexAiSettings,
  type InsertWhatsappVertexAiSettings,
  type SuperadminVertexConfig,
  type ConsultantVertexAccess,
  type WhatsappGeminiApiKeys,
  type InsertWhatsappGeminiApiKeys,
  type ClientSalesAgent,
  type InsertClientSalesAgent,
  type ClientSalesConversation,
  type InsertClientSalesConversation,
  type ClientSalesKnowledge,
  type InsertClientSalesKnowledge,
  type GeminiSessionHandle,
  type InsertGeminiSessionHandle,
  type ConsultationInvite,
  type InsertConsultationInvite,
  type UserRoleProfile,
  type InsertUserRoleProfile,
} from "@shared/schema";

// Define types for UserActivityLog and UserSession
export interface UserActivityLog {
  id: string;
  userId: string;
  activityType: 'login' | 'logout' | 'exercise_start' | 'exercise_view' | 'page_view';
  timestamp: Date;
  details?: string | null;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface InsertUserActivityLog {
  userId: string;
  activityType: 'login' | 'logout' | 'exercise_start' | 'exercise_view' | 'page_view';
  details?: string | null;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface UserSession {
  id: string;
  userId: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  lastActivity: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface InsertUserSession {
  userId: string;
  sessionId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByRole(role: "client" | "consultant"): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getClientsByConsultant(consultantId: string, activeOnly?: boolean): Promise<User[]>;

  // Exercise operations
  getExercise(id: string): Promise<Exercise | undefined>;
  createExercise(exercise: InsertExercise, createdBy: string): Promise<Exercise>;
  updateExercise(id: string, updates: Partial<Exercise>): Promise<Exercise | undefined>;
  deleteExercise(id: string): Promise<boolean>;
  getExercisesByConsultant(consultantId: string): Promise<Exercise[]>;
  getGeneralExercises(): Promise<Exercise[]>;
  getPublicExercises(): Promise<Exercise[]>;
  getPublicExerciseAssignment(exerciseId: string, clientId: string): Promise<ExerciseAssignment | undefined>;

  // Exercise assignment operations
  createExerciseAssignment(assignment: InsertExerciseAssignment): Promise<ExerciseAssignment>;
  getExerciseAssignment(id: string): Promise<ExerciseAssignment | undefined>;
  getAssignmentsByClient(clientId: string, options?: { isExam?: boolean }): Promise<(ExerciseAssignment & { exercise: Exercise, consultant: User })[]>;
  getAssignmentsByConsultant(consultantId: string): Promise<(ExerciseAssignment & { exercise: Exercise, client: User })[]>;
  updateAssignmentStatus(id: string, status: "pending" | "in_progress" | "submitted" | "completed" | "rejected" | "returned"): Promise<ExerciseAssignment | undefined>;
  reviewAssignment(id: string, review: { score: number; consultantFeedback?: string; status: string; reviewedAt: Date; questionGrades?: Array<{questionId: string; score: number; maxScore: number; isCorrect?: boolean; feedback?: string}>; }, createdBy: string): Promise<ExerciseAssignment | undefined>;
  rejectAssignment(id: string, rejection: { consultantFeedback: string; reviewedAt: Date }, createdBy: string): Promise<ExerciseAssignment | undefined>;
  returnAssignmentToClient(id: string, updates: { consultantFeedback: string; status: string; reviewedAt: Date }, createdBy: string): Promise<ExerciseAssignment | undefined>;
  updateAssignmentWhatsappSent(assignmentId: string, whatsappSent: boolean): Promise<ExerciseAssignment | undefined>;
  updateAssignmentWorkPlatform(assignmentId: string, workPlatform: string | null): Promise<ExerciseAssignment | undefined>;

  // Exercise submission operations
  createExerciseSubmission(submission: InsertExerciseSubmission): Promise<ExerciseSubmission>;
  getSubmissionsByAssignment(assignmentId: string): Promise<ExerciseSubmission[]>;
  getExerciseSubmissionByAssignment(assignmentId: string): Promise<ExerciseSubmission | undefined>;
  // Draft submission methods
  saveDraftSubmission(submission: InsertExerciseSubmission): Promise<ExerciseSubmission>;
  getDraftSubmission(assignmentId: string): Promise<ExerciseSubmission | undefined>;

  // Exercise revision history operations
  createRevisionHistoryEntry(entry: InsertExerciseRevisionHistory): Promise<ExerciseRevisionHistory>;
  getRevisionHistoryByAssignment(assignmentId: string): Promise<ExerciseRevisionHistory[]>;
  getLatestRevisionByAssignment(assignmentId: string): Promise<ExerciseRevisionHistory | undefined>;

  // Consultation operations
  createConsultation(consultation: InsertConsultation): Promise<Consultation>;
  getConsultationsByClient(clientId: string): Promise<(Consultation & { consultant: User })[]>;
  getConsultationsByConsultant(consultantId: string): Promise<(Consultation & { client: User })[]>;
  updateConsultation(id: string, updates: Partial<Consultation>): Promise<Consultation | undefined>;
  getConsultation(id: string): Promise<Consultation | undefined>;
  deleteConsultation(id: string): Promise<boolean>;

  // Goal operations
  createGoal(goal: InsertGoal): Promise<Goal>;
  getGoalsByClient(clientId: string): Promise<Goal[]>;
  updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | undefined>;

  // Daily Tasks operations
  createDailyTask(task: InsertDailyTask): Promise<DailyTask>;
  getDailyTasksByClient(clientId: string, startDate?: string, endDate?: string): Promise<DailyTask[]>;
  getDailyTasksByConsultant(consultantId: string, clientId?: string, startDate?: string, endDate?: string): Promise<DailyTask[]>;
  updateDailyTask(id: string, updates: Partial<DailyTask>): Promise<DailyTask | undefined>;
  deleteDailyTask(id: string): Promise<boolean>;

  // Daily Reflections operations
  createDailyReflection(reflection: InsertDailyReflection): Promise<DailyReflection>;
  getDailyReflectionsByClient(clientId: string, startDate?: string, endDate?: string): Promise<DailyReflection[]>;
  getDailyReflectionsByConsultant(consultantId: string, clientId?: string, startDate?: string, endDate?: string): Promise<DailyReflection[]>;
  getDailyReflectionByDate(clientId: string, date: string): Promise<DailyReflection | undefined>;
  updateDailyReflection(id: string, updates: Partial<DailyReflection>): Promise<DailyReflection | undefined>;

  // Consultation Tasks operations
  createConsultationTask(data: InsertConsultationTask): Promise<ConsultationTask>;
  getConsultationTasks(consultationId: string): Promise<ConsultationTask[]>;
  getConsultationTaskById(id: string): Promise<ConsultationTask | undefined>;
  getClientTasks(clientId: string, filters?: {completed?: boolean; priority?: string; category?: string; consultationId?: string; excludeDraftStatus?: boolean}): Promise<ConsultationTask[]>;
  getConsultationTasksByConsultant(consultantId: string): Promise<(ConsultationTask & { clientName: string })[]>;
  updateConsultationTask(id: string, updates: UpdateConsultationTask): Promise<ConsultationTask | undefined>;
  deleteConsultationTask(id: string): Promise<boolean>;
  completeConsultationTask(id: string): Promise<ConsultationTask | undefined>;

  // Client State Tracking operations
  upsertClientState(data: InsertClientStateTracking): Promise<ClientStateTracking>;
  getClientState(clientId: string, consultantId: string): Promise<ClientStateTracking | undefined>;
  updateClientState(id: string, updates: UpdateClientStateTracking): Promise<ClientStateTracking | undefined>;
  getClientStatesByConsultant(consultantId: string): Promise<ClientStateTracking[]>;

  // Automated Emails Log operations
  createEmailLog(data: InsertAutomatedEmailsLog): Promise<AutomatedEmailsLog>;
  getEmailLogsByClient(clientId: string, limit?: number, excludeTest?: boolean): Promise<AutomatedEmailsLog[]>;
  getRecentEmailLogs(daysSince: number): Promise<AutomatedEmailsLog[]>;

  // Consultant SMTP Settings operations
  getConsultantSmtpSettings(consultantId: string): Promise<ConsultantSmtpSettings | undefined>;
  upsertConsultantSmtpSettings(data: InsertConsultantSmtpSettings): Promise<ConsultantSmtpSettings>;
  deleteConsultantSmtpSettings(consultantId: string): Promise<boolean>;

  // Email Drafts operations
  createEmailDraft(data: InsertEmailDraft): Promise<EmailDraft>;
  getEmailDraftsByConsultant(consultantId: string, status?: string): Promise<(EmailDraft & { client: User })[]>;
  getEmailDraft(id: string): Promise<EmailDraft | undefined>;
  updateEmailDraft(id: string, updates: UpdateEmailDraft): Promise<EmailDraft | undefined>;
  updateEmailDraftStatus(id: string, status: "pending" | "approved" | "rejected" | "sent", sentAt?: Date): Promise<EmailDraft | undefined>;
  deleteEmailDraft(id: string): Promise<boolean>;
  getPendingDraftsByClient(clientId: string): Promise<EmailDraft[]>;
  
  // Consultation Summary Email - Duplicate Checks
  checkExistingConsultationSummaryDraft(consultationId: string): Promise<EmailDraft | null>;
  checkConsultationSummaryAlreadySent(consultationId: string): Promise<{ sent: boolean; sentAt?: Date }>;

  // Client Email Automation operations
  getClientEmailAutomation(consultantId: string, clientId: string): Promise<ClientEmailAutomation | undefined>;
  upsertClientEmailAutomation(data: InsertClientEmailAutomation): Promise<ClientEmailAutomation>;
  getClientsWithAutomationEnabled(consultantId: string): Promise<User[]>;
  toggleClientEmailAutomation(consultantId: string, clientId: string, enabled: boolean): Promise<ClientEmailAutomation>;

  // Email Journey Templates operations
  getEmailJourneyTemplate(dayOfMonth: number): Promise<EmailJourneyTemplate | null>;
  getAllEmailJourneyTemplates(): Promise<EmailJourneyTemplate[]>;
  createEmailJourneyTemplate(templateData: InsertEmailJourneyTemplate): Promise<EmailJourneyTemplate>;
  updateEmailJourneyTemplate(id: string, updates: Partial<InsertEmailJourneyTemplate>): Promise<EmailJourneyTemplate | null>;

  // Client Email Journey Progress operations
  getClientEmailJourneyProgress(consultantId: string, clientId: string): Promise<ClientEmailJourneyProgress | null>;
  upsertClientEmailJourneyProgress(
    consultantId: string,
    clientId: string,
    updates: Partial<InsertClientEmailJourneyProgress & UpdateClientEmailJourneyProgress> & { monthStartDate?: Date }
  ): Promise<ClientEmailJourneyProgress>;
  getAllClientEmailJourneyProgress(consultantId: string): Promise<ClientEmailJourneyProgress[]>;
  resetClientJourneyIfNeeded(consultantId: string, clientId: string): Promise<void>;

  // Scheduler operations
  updateSchedulerStatus(consultantId: string, updates: { schedulerEnabled?: boolean; schedulerPaused?: boolean; lastSchedulerRun?: Date; nextSchedulerRun?: Date; schedulerStatus?: "idle" | "running" }): Promise<ConsultantSmtpSettings | undefined>;
  createSchedulerLog(data: InsertSchedulerExecutionLog): Promise<SchedulerExecutionLog>;
  getSchedulerLogs(consultantId: string, limit?: number): Promise<SchedulerExecutionLog[]>;
  getLatestSchedulerRun(consultantId: string): Promise<SchedulerExecutionLog | undefined>;
  acquireSchedulerLock(consultantId: string): Promise<boolean>;
  releaseSchedulerLock(consultantId: string): Promise<void>;

  // Progress operations
  createClientProgress(progress: InsertClientProgress): Promise<ClientProgress>;
  getClientProgress(clientId: string, date?: Date): Promise<ClientProgress[]>;
  updateClientProgress(clientId: string, date: Date, updates: Partial<ClientProgress>): Promise<ClientProgress | undefined>;

  // Exercise template operations
  createExerciseTemplate(template: InsertExerciseTemplate, createdBy: string): Promise<ExerciseTemplate>;
  getExerciseTemplate(id: string): Promise<ExerciseTemplate | undefined>;
  getExerciseTemplatesByConsultant(consultantId: string): Promise<ExerciseTemplate[]>;
  getPublicExerciseTemplates(): Promise<ExerciseTemplate[]>;
  searchExerciseTemplates(filters: {
    category?: string;
    tags?: string[];
    type?: "general" | "personalized";
    createdBy?: string;
    isPublic?: boolean;
  }): Promise<ExerciseTemplate[]>;
  updateExerciseTemplate(id: string, updates: Partial<ExerciseTemplate>): Promise<ExerciseTemplate | undefined>;
  deleteExerciseTemplate(id: string): Promise<boolean>;
  // Method to check if a template has associated exercises
  hasAssociatedExercises(templateId: string): Promise<boolean>;
  // Method to delete associated exercises
  deleteAssociatedExercises(templateId: string): Promise<boolean>;
  incrementTemplateUsage(id: string): Promise<ExerciseTemplate | undefined>;
  copyTemplateToExercise(templateId: string, createdBy: string): Promise<Exercise>;

  // Template Client Association Operations
  associateTemplateWithClient(templateId: string, clientId: string): Promise<TemplateClientAssociation>;
  associateTemplateWithClients(templateId: string, clientIds: string[], consultantId: string, customPlatformLinks?: Record<string, string>): Promise<void>;
  getAssociatedClientsForTemplate(templateId: string): Promise<User[]>;
  getTemplateClientAssociations(templateId: string, consultantId: string): Promise<TemplateClientAssociation[]>;
  getAssociatedTemplatesForClient(clientId: string): Promise<ExerciseTemplate[]>;
  removeTemplateAssociation(templateId: string, clientId: string): Promise<boolean>;
  isTemplateAssociatedWithClient(templateId: string, clientId: string): Promise<boolean>;

  // Analytics operations
  createClientEngagementMetrics(metrics: InsertClientEngagementMetrics): Promise<ClientEngagementMetrics>;
  getClientEngagementMetrics(clientId: string, consultantId: string, startDate?: Date, endDate?: Date): Promise<ClientEngagementMetrics[]>;
  updateClientEngagementMetrics(id: string, updates: Partial<ClientEngagementMetrics>): Promise<ClientEngagementMetrics | undefined>;

  createExercisePerformanceMetrics(metrics: InsertExercisePerformanceMetrics): Promise<ExercisePerformanceMetrics>;
  getExercisePerformanceMetrics(exerciseId?: string, clientId?: string, assignmentId?: string): Promise<ExercisePerformanceMetrics[]>;
  updateExercisePerformanceMetrics(id: string, updates: Partial<ExercisePerformanceMetrics>): Promise<ExercisePerformanceMetrics | undefined>;

  createConsultantAnalytics(analytics: InsertConsultantAnalytics): Promise<ConsultantAnalytics>;
  getConsultantAnalytics(consultantId: string, period?: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<ConsultantAnalytics[]>;
  updateConsultantAnalytics(id: string, updates: Partial<ConsultantAnalytics>): Promise<ConsultantAnalytics | undefined>;

  createClientAnalyticsSummary(summary: InsertClientAnalyticsSummary): Promise<ClientAnalyticsSummary>;
  getClientAnalyticsSummary(clientId?: string, consultantId?: string, period?: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<ClientAnalyticsSummary[]>;
  updateClientAnalyticsSummary(id: string, updates: Partial<ClientAnalyticsSummary>): Promise<ClientAnalyticsSummary | undefined>;

  // Activity Logging
  createUserActivityLog(log: InsertUserActivityLog): Promise<UserActivityLog>;
  getUserActivityLogs(userId?: string, startDate?: Date, endDate?: Date, activityType?: string): Promise<UserActivityLog[]>;
  getUserActivityLogsByConsultant(consultantId: string, startDate?: Date, endDate?: Date): Promise<UserActivityLog[]>;

  // User Session Management
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  getUserSession(sessionId: string): Promise<UserSession | undefined>;
  updateUserSession(sessionId: string, updates: Partial<UserSession>): Promise<UserSession | undefined>;
  getActiveUserSessions(consultantId?: string): Promise<UserSession[]>;
  endUserSession(sessionId: string): Promise<UserSession | undefined>;

  // Computed analytics methods
  calculateConsultantOverallStats(consultantId: string, startDate?: Date, endDate?: Date): Promise<{
    totalClients: number;
    activeClients: number;
    totalExercises: number;
    completedExercises: number;
    completionRate: number;
    avgClientEngagement: number;
    totalConsultations: number;
    clientRetentionRate: number;
  }>;

  calculateClientPerformanceStats(clientId: string, consultantId: string, startDate?: Date, endDate?: Date): Promise<{
    totalExercisesAssigned: number;
    completedExercises: number;
    completionRate: number;
    avgCompletionTime: number;
    avgScore: number;
    avgSatisfactionRating: number;
    streakDays: number;
    engagementScore: number;
  }>;

  getExerciseCompletionTrends(consultantId: string, period: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<{
    date: Date;
    completed: number;
    assigned: number;
    completionRate: number;
  }[]>;

  getClientEngagementTrends(consultantId: string, period: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<{
    date: Date;
    totalSessions: number;
    avgSessionDuration: number;
    totalLogins: number;
    activeClients: number;
  }[]>;

  // Roadmap operations
  createRoadmapPhase(phase: InsertRoadmapPhase): Promise<RoadmapPhase>;
  getRoadmapPhases(): Promise<RoadmapPhase[]>;
  getRoadmapPhase(id: string): Promise<RoadmapPhase | undefined>;
  updateRoadmapPhase(id: string, updates: Partial<RoadmapPhase>): Promise<RoadmapPhase | undefined>;

  createRoadmapGroup(group: InsertRoadmapGroup): Promise<RoadmapGroup>;
  getRoadmapGroupsByPhase(phaseId: string): Promise<RoadmapGroup[]>;
  getRoadmapGroup(id: string): Promise<RoadmapGroup | undefined>;
  updateRoadmapGroup(id: string, updates: Partial<RoadmapGroup>): Promise<RoadmapGroup | undefined>;

  createRoadmapItem(item: InsertRoadmapItem): Promise<RoadmapItem>;
  getRoadmapItemsByGroup(groupId: string): Promise<RoadmapItem[]>;
  getRoadmapItem(id: string): Promise<RoadmapItem | undefined>;
  updateRoadmapItem(id: string, updates: Partial<RoadmapItem>): Promise<RoadmapItem | undefined>;

  // Client roadmap progress operations
  createClientRoadmapProgress(progress: InsertClientRoadmapProgress): Promise<ClientRoadmapProgress>;
  getClientRoadmapProgress(clientId: string, itemId: string): Promise<ClientRoadmapProgress | undefined>;
  getClientRoadmapProgressAll(clientId: string): Promise<ClientRoadmapProgress[]>;
  updateClientRoadmapProgress(clientId: string, itemId: string, updates: Partial<ClientRoadmapProgress>): Promise<ClientRoadmapProgress | null>;

  // Complete roadmap structure with progress
  getFullRoadmapWithProgress(clientId: string): Promise<(RoadmapPhase & {
    groups: (RoadmapGroup & {
      items: (RoadmapItem & {
        progress?: ClientRoadmapProgress;
      })[];
    })[];
  })[]>;

  // Get roadmap progress for consultant dashboard
  getConsultantRoadmapOverview(consultantId: string): Promise<{
    clientId: string;
    clientName: string;
    totalItems: number;
    completedItems: number;
    progressPercentage: number;
  }[]>;

  // Library methods

  // Categories
  createLibraryCategory(categoryData: InsertLibraryCategory): Promise<LibraryCategory>;
  getLibraryCategories(consultantId?: string): Promise<LibraryCategory[]>;
  getLibraryCategory(categoryId: string): Promise<LibraryCategory | null>;
  updateLibraryCategory(categoryId: string, updates: Partial<InsertLibraryCategory>): Promise<LibraryCategory | null>;
  deleteLibraryCategory(categoryId: string): Promise<boolean>;

  // Subcategories
  createLibrarySubcategory(subcategoryData: InsertLibrarySubcategory): Promise<LibrarySubcategory>;
  getLibrarySubcategories(consultantId?: string): Promise<LibrarySubcategory[]>;
  getLibrarySubcategoriesByCategory(categoryId: string): Promise<LibrarySubcategory[]>;
  getLibrarySubcategory(subcategoryId: string): Promise<LibrarySubcategory | null>;
  updateLibrarySubcategory(subcategoryId: string, updates: Partial<InsertLibrarySubcategory>): Promise<LibrarySubcategory | null>;
  deleteLibrarySubcategory(subcategoryId: string): Promise<boolean>;

  // Documents
  createLibraryDocument(documentData: InsertLibraryDocument): Promise<LibraryDocument>;
  getLibraryDocuments(consultantId?: string): Promise<LibraryDocument[]>;
  getLibraryDocumentsByCategory(categoryId: string): Promise<LibraryDocument[]>;
  getLibraryDocumentsBySubcategory(subcategoryId: string): Promise<LibraryDocument[]>;
  getLibraryDocument(documentId: string): Promise<LibraryDocument | null>;
  updateLibraryDocument(documentId: string, updates: Partial<InsertLibraryDocument>): Promise<LibraryDocument | null>;
  deleteLibraryDocument(documentId: string): Promise<boolean>;

  // Document sections
  createLibraryDocumentSection(sectionData: InsertLibraryDocumentSection): Promise<LibraryDocumentSection>;
  getLibraryDocumentSections(documentId: string): Promise<LibraryDocumentSection[]>;

  // Client progress
  markDocumentAsRead(progressData: InsertClientLibraryProgress): Promise<ClientLibraryProgress>;
  getClientLibraryProgress(clientId: string): Promise<ClientLibraryProgress[]>;

  // University module methods
  // Years
  createUniversityYear(year: InsertUniversityYear): Promise<UniversityYear>;
  getUniversityYears(consultantId?: string): Promise<UniversityYear[]>;
  getUniversityYear(id: string): Promise<UniversityYear | null>;
  updateUniversityYear(id: string, updates: Partial<InsertUniversityYear>): Promise<UniversityYear | null>;
  deleteUniversityYear(id: string): Promise<boolean>;

  // Trimesters
  createUniversityTrimester(trimester: InsertUniversityTrimester): Promise<UniversityTrimester>;
  getUniversityTrimestersByYear(yearId: string): Promise<UniversityTrimester[]>;
  getUniversityTrimester(id: string): Promise<UniversityTrimester | null>;
  updateUniversityTrimester(id: string, updates: Partial<InsertUniversityTrimester>): Promise<UniversityTrimester | null>;
  deleteUniversityTrimester(id: string): Promise<boolean>;

  // Modules
  createUniversityModule(module: InsertUniversityModule): Promise<UniversityModule>;
  getUniversityModulesByTrimester(trimesterId: string): Promise<UniversityModule[]>;
  getUniversityModule(id: string): Promise<UniversityModule | null>;
  updateUniversityModule(id: string, updates: Partial<InsertUniversityModule>): Promise<UniversityModule | null>;
  deleteUniversityModule(id: string): Promise<boolean>;

  // Lessons
  createUniversityLesson(lesson: InsertUniversityLesson): Promise<UniversityLesson>;
  getUniversityLessonsByModule(moduleId: string): Promise<UniversityLesson[]>;
  getUniversityLesson(id: string): Promise<UniversityLesson | null>;
  updateUniversityLesson(id: string, updates: Partial<InsertUniversityLesson>): Promise<UniversityLesson | null>;
  deleteUniversityLesson(id: string): Promise<boolean>;

  // Progress
  createUniversityProgress(progress: InsertUniversityProgress): Promise<UniversityProgress>;
  getUniversityProgress(clientId: string, lessonId: string): Promise<UniversityProgress | null>;
  getUniversityProgressByClient(clientId: string): Promise<UniversityProgress[]>;
  updateUniversityProgress(clientId: string, lessonId: string, updates: Partial<InsertUniversityProgress>): Promise<UniversityProgress | null>;
  
  // Grades
  createUniversityGrade(grade: InsertUniversityGrade): Promise<UniversityGrade>;
  getUniversityGradesByClient(clientId: string): Promise<UniversityGrade[]>;
  getUniversityGrade(clientId: string, referenceType: string, referenceId: string): Promise<UniversityGrade | null>;
  updateUniversityGrade(id: string, updates: Partial<InsertUniversityGrade>): Promise<UniversityGrade | null>;
  deleteUniversityGrade(id: string): Promise<boolean>;

  // Certificates
  createUniversityCertificate(certificate: InsertUniversityCertificate): Promise<UniversityCertificate>;
  getUniversityCertificatesByClient(clientId: string): Promise<UniversityCertificate[]>;
  getUniversityCertificate(id: string): Promise<UniversityCertificate | null>;
  
  // Full university structure with progress for client
  getFullUniversityWithProgress(clientId: string, consultantId?: string): Promise<(UniversityYear & {
    trimesters: (UniversityTrimester & {
      modules: (UniversityModule & {
        lessons: (UniversityLesson & {
          progress?: UniversityProgress;
        })[];
        grade?: UniversityGrade;
      })[];
      grade?: UniversityGrade;
    })[];
    grade?: UniversityGrade;
  })[]>;

  // Statistics for client dashboard
  getUniversityStats(clientId: string): Promise<{
    totalLessons: number;
    completedLessons: number;
    completionPercentage: number;
    averageGrade: number | null;
    totalCertificates: number;
  }>;

  // Get current path (year/trimester/module) for client
  getCurrentPath(clientId: string): Promise<{
    currentYear: UniversityYear | null;
    currentTrimester: UniversityTrimester | null;
    currentModule: UniversityModule | null;
  }>;

  // Certificate helper methods
  getGradesForPeriod(clientId: string, referenceType: "module" | "trimester" | "year", referenceId: string): Promise<UniversityGrade[]>;
  isPeriodCompleted(clientId: string, referenceType: "module" | "trimester" | "year", referenceId: string): Promise<boolean>;
  calculatePeriodAverage(clientId: string, referenceType: "module" | "trimester" | "year", referenceId: string): Promise<number | null>;

  // Year-Client Assignments
  createYearClientAssignment(assignment: InsertUniversityYearClientAssignment): Promise<UniversityYearClientAssignment>;
  getYearClientAssignments(yearId: string): Promise<UniversityYearClientAssignment[]>;
  getClientYearAssignments(clientId: string): Promise<UniversityYearClientAssignment[]>;
  deleteYearClientAssignment(yearId: string, clientId: string): Promise<boolean>;
  getYearsForClient(clientId: string): Promise<UniversityYear[]>;
  
  // User Finance Settings (Percorso Capitale integration)
  getUserFinanceSettings(userId: string): Promise<UserFinanceSettings | null>;
  createUserFinanceSettings(settings: InsertUserFinanceSettings): Promise<UserFinanceSettings>;
  updateUserFinanceSettings(userId: string, updates: Partial<InsertUserFinanceSettings>): Promise<UserFinanceSettings | null>;
  deleteUserFinanceSettings(userId: string): Promise<boolean>;
  getAllActiveFinanceSettings(): Promise<UserFinanceSettings[]>;

  // Calendar Events operations
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  getCalendarEventsByUser(userId: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]>;
  getCalendarEvent(id: string): Promise<CalendarEvent | undefined>;
  updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<boolean>;

  // Proactive Lead helper - get lead by phone to prevent duplicates
  getProactiveLeadByPhone(consultantId: string, phoneNumber: string): Promise<any>;

  // External API Configuration operations
  getExternalApiConfig(consultantId: string, configId: string): Promise<ExternalApiConfig | null>;
  getAllExternalApiConfigs(consultantId: string): Promise<ExternalApiConfig[]>;
  createExternalApiConfig(data: InsertExternalApiConfig): Promise<ExternalApiConfig>;
  updateExternalApiConfig(configId: string, consultantId: string, data: Partial<UpdateExternalApiConfig>): Promise<ExternalApiConfig | null>;
  deleteExternalApiConfig(configId: string, consultantId: string): Promise<boolean>;

  // Webhook Configuration operations
  getWebhookConfig(consultantId: string, id: string): Promise<WebhookConfig | null>;
  getWebhookConfigBySecret(secretKey: string): Promise<WebhookConfig | null>;
  getAllWebhookConfigs(consultantId: string): Promise<WebhookConfig[]>;
  createWebhookConfig(data: InsertWebhookConfig): Promise<WebhookConfig>;
  updateWebhookConfig(id: string, consultantId: string, data: UpdateWebhookConfig): Promise<WebhookConfig | null>;
  deleteWebhookConfig(id: string, consultantId: string): Promise<boolean>;
  incrementWebhookLeadsCount(id: string): Promise<void>;

  // External Lead Import Log operations
  createExternalLeadImportLog(data: InsertExternalLeadImportLog): Promise<ExternalLeadImportLog>;
  getExternalLeadImportLogs(configId: string, limit?: number): Promise<ExternalLeadImportLog[]>;

  // WhatsApp Vertex AI Settings operations
  getWhatsAppVertexAISettings(consultantId: string): Promise<WhatsappVertexAiSettings | null>;
  saveWhatsAppVertexAISettings(consultantId: string, settings: { projectId: string; location: string; serviceAccountJson: string; enabled: boolean }): Promise<void>;
  deleteWhatsAppVertexAISettings(consultantId: string): Promise<boolean>;

  // WhatsApp Gemini API Keys operations
  getWhatsAppGeminiApiKeys(consultantId: string): Promise<WhatsappGeminiApiKeys[]>;
  addWhatsAppGeminiApiKey(consultantId: string, apiKey: string): Promise<WhatsappGeminiApiKeys>;
  deleteWhatsAppGeminiApiKey(keyId: string, consultantId: string): Promise<boolean>;
  toggleWhatsAppGeminiApiKey(keyId: string, consultantId: string): Promise<WhatsappGeminiApiKeys | null>;
  updateWhatsAppGeminiKeyUsage(keyId: string): Promise<void>;
  getWhatsAppGeminiApiKeyLRU(consultantId: string): Promise<WhatsappGeminiApiKeys | null>;

  // WhatsApp Agent Consultant Chat operations (internal testing/chat)
  getConsultantAgentConversations(consultantId: string, agentConfigId?: string): Promise<WhatsappAgentConsultantConversation[]>;
  getConsultantAgentConversation(conversationId: string, consultantId: string): Promise<WhatsappAgentConsultantConversation | null>;
  createConsultantAgentConversation(consultantId: string, agentConfigId: string): Promise<WhatsappAgentConsultantConversation>;
  getConsultantAgentMessages(conversationId: string, consultantId: string): Promise<WhatsappAgentConsultantMessage[]>;
  createConsultantAgentMessage(conversationId: string, role: 'consultant' | 'agent', content: string, metadata: any, consultantId: string): Promise<WhatsappAgentConsultantMessage>;
  deleteConsultantAgentConversation(conversationId: string, consultantId: string): Promise<boolean>;
  updateConsultantAgentConversationTitle(conversationId: string, title: string, consultantId: string): Promise<WhatsappAgentConsultantConversation | null>;
  incrementConversationMessageCount(conversationId: string): Promise<void>;

  // Client Sales Agents operations
  getClientSalesAgents(clientId: string): Promise<ClientSalesAgent[]>;
  getClientSalesAgentById(agentId: string): Promise<ClientSalesAgent | null>;
  getClientSalesAgentByShareToken(shareToken: string): Promise<ClientSalesAgent | null>;
  createClientSalesAgent(data: InsertClientSalesAgent): Promise<ClientSalesAgent>;
  updateClientSalesAgent(agentId: string, data: Partial<InsertClientSalesAgent>): Promise<ClientSalesAgent | null>;
  deleteClientSalesAgent(agentId: string): Promise<boolean>;

  // Client Sales Conversations operations
  getClientSalesConversations(agentId: string): Promise<ClientSalesConversation[]>;
  getClientSalesConversationById(conversationId: string): Promise<ClientSalesConversation | null>;
  createClientSalesConversation(data: InsertClientSalesConversation): Promise<ClientSalesConversation>;
  updateClientSalesConversation(conversationId: string, data: Partial<InsertClientSalesConversation>): Promise<ClientSalesConversation | null>;
  deleteClientSalesConversation(conversationId: string): Promise<boolean>;
  deleteAiConversation(aiConversationId: string): Promise<boolean>;
  getAiMessagesByConversation(aiConversationId: string): Promise<AiMessage[]>;

  // Client Sales Knowledge operations
  getClientSalesKnowledge(agentId: string): Promise<ClientSalesKnowledge[]>;
  getClientSalesKnowledgeById(knowledgeId: string): Promise<ClientSalesKnowledge | null>;
  createClientSalesKnowledge(data: InsertClientSalesKnowledge): Promise<ClientSalesKnowledge>;
  deleteClientSalesKnowledge(knowledgeId: string): Promise<boolean>;

  // Consultation Invites operations (Google Meet-style persistent links)
  getConsultationInvitesByAgent(agentId: string): Promise<ConsultationInvite[]>;
  getConsultationInviteByToken(inviteToken: string): Promise<ConsultationInvite | null>;
  createConsultationInvite(data: InsertConsultationInvite): Promise<ConsultationInvite>;
  updateConsultationInvite(inviteToken: string, data: Partial<Omit<InsertConsultationInvite, 'inviteToken' | 'agentId'>>): Promise<ConsultationInvite | null>;
  deleteConsultationInvite(inviteToken: string): Promise<boolean>;
  trackConsultationInviteAccess(inviteToken: string): Promise<void>;

  // Encryption/Decryption operations for credentials
  encryptData(text: string): string;
  decryptData(text: string): string;

  // User Role Profiles operations (Email Condivisa feature)
  getUserRoleProfiles(userId: string): Promise<UserRoleProfile[]>;
  getUserRoleProfilesByEmail(email: string): Promise<UserRoleProfile[]>;
  getUserRoleProfileById(profileId: string): Promise<UserRoleProfile | null>;
  createUserRoleProfile(profile: InsertUserRoleProfile): Promise<UserRoleProfile>;
  setDefaultProfile(userId: string, profileId: string): Promise<void>;
}

import { db } from "./db.js";
import * as schema from "@shared/schema";
import { eq, and, or, gte, lte, desc, asc, sql, like, count, sum, avg, isNull, isNotNull, inArray, notExists, ne } from "drizzle-orm";
import crypto from 'crypto';

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values([insertUser]).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, id))
      .returning();
    return user || undefined;
  }

  async getUsersByRole(role: "client" | "consultant"): Promise<User[]> {
    return db.select().from(schema.users).where(eq(schema.users.role, role));
  }

  async getClientsByConsultant(consultantId: string, activeOnly: boolean = false): Promise<User[]> {
    // Return all users assigned to this consultant (both clients and consultants who are also clients)
    // A user is considered a "client" of a consultant if they have consultantId set to that consultant
    const conditions = [
      eq(schema.users.consultantId, consultantId)
    ];
    
    if (activeOnly) {
      conditions.push(eq(schema.users.isActive, true));
    }
    
    return db.select().from(schema.users).where(and(...conditions));
  }

  // Exercise operations
  async getExercise(id: string): Promise<Exercise | undefined> {
    const [exercise] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, id));
    return exercise || undefined;
  }

  async createExercise(insertExercise: InsertExercise, createdBy: string): Promise<Exercise> {
    const [exercise] = await db.insert(schema.exercises)
      .values([{ ...insertExercise, createdBy, type: insertExercise.type as 'general' | 'personalized' }])
      .returning();
    return exercise;
  }

  async updateExercise(id: string, updates: Partial<Exercise>): Promise<Exercise | undefined> {
    const [exercise] = await db.update(schema.exercises)
      .set(updates)
      .where(eq(schema.exercises.id, id))
      .returning();
    return exercise || undefined;
  }

  async deleteExercise(id: string): Promise<boolean> {
    // Delete related assignments first
    await db.delete(schema.exerciseSubmissions)
      .where(sql`${schema.exerciseSubmissions.assignmentId} IN (
        SELECT id FROM ${schema.exerciseAssignments} WHERE ${schema.exerciseAssignments.exerciseId} = ${id}
      )`);

    await db.delete(schema.exerciseAssignments)
      .where(eq(schema.exerciseAssignments.exerciseId, id));

    const result = await db.delete(schema.exercises)
      .where(eq(schema.exercises.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getExercisesByConsultant(consultantId: string): Promise<Exercise[]> {
    return db.select().from(schema.exercises)
      .where(eq(schema.exercises.createdBy, consultantId));
  }

  async getGeneralExercises(): Promise<Exercise[]> {
    const exercises = await db.select().from(schema.exercises).where(eq(schema.exercises.type, "general"));
    return exercises;
  }

  async getPublicExercises(): Promise<Exercise[]> {
    try {
      const exercises = await db.select().from(schema.exercises)
        .where(
          and(
            eq(schema.exercises.isPublic, true),
            or(
              eq(schema.exercises.isExam, false),
              isNull(schema.exercises.isExam)
            )
          )
        )
        .orderBy(desc(schema.exercises.createdAt));

      console.log('Public exercises query result:', exercises.length);
      return exercises;
    } catch (error) {
      console.error('Error fetching public exercises:', error);
      return [];
    }
  }

  async getPublicExerciseAssignment(exerciseId: string, clientId: string): Promise<ExerciseAssignment | undefined> {
    const [assignment] = await db.select().from(schema.exerciseAssignments)
      .where(and(
        eq(schema.exerciseAssignments.exerciseId, exerciseId),
        eq(schema.exerciseAssignments.clientId, clientId)
      ));
    return assignment || undefined;
  }

  // Exercise assignment operations
  async createExerciseAssignment(insertAssignment: InsertExerciseAssignment): Promise<ExerciseAssignment> {
    const [assignment] = await db.insert(schema.exerciseAssignments)
      .values([{ ...insertAssignment, status: insertAssignment.status as 'pending' | 'in_progress' | 'submitted' | 'completed' | 'rejected' | 'returned' || 'pending' }])
      .returning();
    return assignment;
  }

  async getExerciseAssignment(id: string): Promise<ExerciseAssignment | undefined> {
    const [assignment] = await db.select().from(schema.exerciseAssignments)
      .where(eq(schema.exerciseAssignments.id, id));
    return assignment || undefined;
  }

  async getAssignmentsByClient(clientId: string, options?: { isExam?: boolean }): Promise<(ExerciseAssignment & { exercise: Exercise, consultant: User })[]> {
    const whereConditions = [eq(schema.exerciseAssignments.clientId, clientId)];
    
    // Filter by isExam if specified
    if (options?.isExam !== undefined) {
      whereConditions.push(eq(schema.exercises.isExam, options.isExam));
    }
    
    const assignments = await db.select()
      .from(schema.exerciseAssignments)
      .leftJoin(schema.exercises, eq(schema.exerciseAssignments.exerciseId, schema.exercises.id))
      .leftJoin(schema.users, eq(schema.exerciseAssignments.consultantId, schema.users.id))
      .where(and(...whereConditions));

    return assignments.map(row => ({
      ...row.exercise_assignments,
      exercise: row.exercises!,
      consultant: row.users!
    }));
  }

  async getAssignmentsByConsultant(consultantId: string): Promise<(ExerciseAssignment & { exercise: Exercise, client: User })[]> {
    const assignments = await db.select()
      .from(schema.exerciseAssignments)
      .leftJoin(schema.exercises, eq(schema.exerciseAssignments.exerciseId, schema.exercises.id))
      .leftJoin(schema.users, eq(schema.exerciseAssignments.clientId, schema.users.id))
      .where(eq(schema.exerciseAssignments.consultantId, consultantId));

    return assignments.map(row => ({
      ...row.exercise_assignments,
      exercise: row.exercises!,
      client: row.users!
    }));
  }

  async updateAssignmentStatus(assignmentId: string, status: "pending" | "in_progress" | "submitted" | "completed" | "rejected" | "returned"): Promise<ExerciseAssignment | undefined> {
    const [assignment] = await db.update(schema.exerciseAssignments)
      .set({
        status,
        ...(status === 'in_progress' && { completedAt: null }),
        ...(status === 'completed' && { completedAt: new Date() }),
        ...(status === 'submitted' && { submittedAt: new Date() }),
      })
      .where(eq(schema.exerciseAssignments.id, assignmentId))
      .returning();
    return assignment || undefined;
  }

  async reviewAssignment(id: string, review: { score: number; consultantFeedback?: string; status: string; reviewedAt: Date; questionGrades?: Array<{questionId: string; score: number; maxScore: number; isCorrect?: boolean; feedback?: string}>; }, createdBy: string): Promise<ExerciseAssignment | undefined> {
    const assignment = await this.getExerciseAssignment(id);
    if (!assignment) return undefined;

    const newFeedback = review.consultantFeedback ?
      [{ feedback: review.consultantFeedback, timestamp: new Date().toISOString() }] : [];

    const [updatedAssignment] = await db.update(schema.exerciseAssignments)
      .set({
        ...review,
        consultantFeedback: [...(assignment.consultantFeedback || []), ...newFeedback],
        status: review.status as any,
        completedAt: review.status === "completed" ? new Date() : assignment.completedAt,
        ...(review.questionGrades && { questionGrades: review.questionGrades })
      })
      .where(eq(schema.exerciseAssignments.id, id))
      .returning();

    return updatedAssignment || undefined;
  }

  async rejectAssignment(id: string, rejection: { consultantFeedback: string; reviewedAt: Date }, createdBy: string): Promise<ExerciseAssignment | undefined> {
    const assignment = await this.getExerciseAssignment(id);
    if (!assignment) return undefined;

    const newFeedback = [{ feedback: rejection.consultantFeedback, timestamp: new Date().toISOString() }];

    const [updatedAssignment] = await db.update(schema.exerciseAssignments)
      .set({
        status: 'rejected' as const,
        consultantFeedback: [...(assignment.consultantFeedback || []), ...newFeedback],
        reviewedAt: rejection.reviewedAt
      })
      .where(eq(schema.exerciseAssignments.id, id))
      .returning();

    return updatedAssignment || undefined;
  }

  async returnAssignmentToClient(id: string, updates: { consultantFeedback: string; status: string; reviewedAt: Date }, createdBy: string): Promise<ExerciseAssignment | undefined> {
    const assignment = await this.getExerciseAssignment(id);
    if (!assignment) return undefined;

    const newFeedback = [{ feedback: updates.consultantFeedback, timestamp: new Date().toISOString() }];

    const [updatedAssignment] = await db.update(schema.exerciseAssignments)
      .set({
        ...updates,
        consultantFeedback: [...(assignment.consultantFeedback || []), ...newFeedback],
        status: updates.status as any,
        submittedAt: null,
        completedAt: null
      })
      .where(eq(schema.exerciseAssignments.id, id))
      .returning();

    return updatedAssignment || undefined;
  }

  async updateAssignmentWhatsappSent(assignmentId: string, whatsappSent: boolean): Promise<ExerciseAssignment | undefined> {
    try {
      const [assignment] = await db.update(schema.exerciseAssignments)
        .set({ whatsappSent: whatsappSent })
        .where(eq(schema.exerciseAssignments.id, assignmentId))
        .returning();
      return assignment || undefined;
    } catch (error) {
      console.error('Error updating WhatsApp sent status:', error);
      throw error;
    }
  }

  async updateAssignmentWorkPlatform(assignmentId: string, workPlatform: string | null): Promise<ExerciseAssignment | undefined> {
    try {
      const [assignment] = await db.update(schema.exerciseAssignments)
        .set({ workPlatform: workPlatform })
        .where(eq(schema.exerciseAssignments.id, assignmentId))
        .returning();
      return assignment || undefined;
    } catch (error) {
      console.error('Error updating assignment workPlatform:', error);
      throw error;
    }
  }

  // Exercise submission operations
  async createExerciseSubmission(insertSubmission: InsertExerciseSubmission): Promise<ExerciseSubmission> {
    const [submission] = await db.insert(schema.exerciseSubmissions)
      .values([insertSubmission])
      .returning();
    return submission;
  }

  async getSubmissionsByAssignment(assignmentId: string): Promise<ExerciseSubmission[]> {
    return db.select().from(schema.exerciseSubmissions)
      .where(eq(schema.exerciseSubmissions.assignmentId, assignmentId));
  }

  async getExerciseSubmissionByAssignment(assignmentId: string): Promise<ExerciseSubmission | undefined> {
    const [submission] = await db.select().from(schema.exerciseSubmissions)
      .where(eq(schema.exerciseSubmissions.assignmentId, assignmentId))
      .orderBy(desc(schema.exerciseSubmissions.submittedAt))
      .limit(1);
    return submission || undefined;
  }

  // Draft submission operations
  async saveDraftSubmission(insertSubmission: InsertExerciseSubmission): Promise<ExerciseSubmission> {
    console.log('========== SAVE DRAFT DEBUG START ==========');
    console.log('1. Saving draft for assignmentId:', insertSubmission.assignmentId);
    console.log('2. Answers to save:', insertSubmission.answers);

    // Check if a draft already exists for this assignment
    const existingDraft = await this.getDraftSubmission(insertSubmission.assignmentId);
    console.log('3. Existing draft found:', !!existingDraft);

    if (existingDraft) {
      console.log('4. Updating existing draft with ID:', existingDraft.id);
      // Update existing draft using the specific ID to avoid any ambiguity
      const [updatedSubmission] = await db.update(schema.exerciseSubmissions)
        .set({
          answers: insertSubmission.answers,
          notes: insertSubmission.notes,
          attachments: insertSubmission.attachments,
          updatedAt: new Date()
        })
        .where(eq(schema.exerciseSubmissions.id, existingDraft.id))
        .returning();

      console.log('5. Draft updated successfully:', updatedSubmission.id);
      console.log('6. Updated answers:', updatedSubmission.answers);
      console.log('========== SAVE DRAFT DEBUG END ==========');
      return updatedSubmission;
    } else {
      console.log('4. Creating new draft');
      // Create new draft (submittedAt remains null)
      const [submission] = await db.insert(schema.exerciseSubmissions)
        .values([{
          ...insertSubmission,
          submittedAt: null // Explicitly set to null for drafts
        }])
        .returning();

      console.log('5. New draft created with ID:', submission.id);
      console.log('6. New draft answers:', submission.answers);
      console.log('========== SAVE DRAFT DEBUG END ==========');
      return submission;
    }
  }

  async getDraftSubmission(assignmentId: string): Promise<ExerciseSubmission | null> {
    console.log('========== GET DRAFT DEBUG START ==========');
    console.log('1. Getting draft for assignmentId:', assignmentId);

    const [submission] = await db.select()
      .from(schema.exerciseSubmissions)
      .where(
        and(
          eq(schema.exerciseSubmissions.assignmentId, assignmentId),
          isNull(schema.exerciseSubmissions.submittedAt)
        )
      )
      .orderBy(desc(schema.exerciseSubmissions.updatedAt)) // Ordina per aggiornamento più recente
      .limit(1);

    console.log('2. Draft found in DB:', !!submission);
    if (submission) {
      console.log('3. Draft details from DB:', {
        id: submission.id,
        assignmentId: submission.assignmentId,
        answers: {
          type: typeof submission.answers,
          isArray: Array.isArray(submission.answers),
          length: submission.answers?.length,
          content: submission.answers
        },
        notes: submission.notes,
        submittedAt: submission.submittedAt,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt
      });
    }
    console.log('========== GET DRAFT DEBUG END ==========');

    return submission || null;
  }

  // Stub implementations for remaining methods to satisfy interface
  async createRevisionHistoryEntry(entry: InsertExerciseRevisionHistory): Promise<ExerciseRevisionHistory> {
    throw new Error('Not implemented');
  }

  async getRevisionHistoryByAssignment(assignmentId: string): Promise<ExerciseRevisionHistory[]> {
    return [];
  }

  async getLatestRevisionByAssignment(assignmentId: string): Promise<ExerciseRevisionHistory | undefined> {
    return undefined;
  }

  async createConsultation(insertConsultation: InsertConsultation): Promise<Consultation> {
    const [consultation] = await db.insert(schema.consultations)
      .values([insertConsultation])
      .returning();
    return consultation;
  }

  async getConsultationsByClient(clientId: string): Promise<(Consultation & { consultant: User })[]> {
    const consultations = await db.select()
      .from(schema.consultations)
      .leftJoin(schema.users, eq(schema.consultations.consultantId, schema.users.id))
      .where(eq(schema.consultations.clientId, clientId))
      .orderBy(desc(schema.consultations.scheduledAt));

    return consultations.map(row => ({
      ...row.consultations,
      consultant: row.users!
    }));
  }

  async getConsultationsByConsultant(consultantId: string): Promise<(Consultation & { client: User })[]> {
    const consultations = await db.select()
      .from(schema.consultations)
      .leftJoin(schema.users, eq(schema.consultations.clientId, schema.users.id))
      .where(eq(schema.consultations.consultantId, consultantId));

    return consultations.map(row => ({
      ...row.consultations,
      client: row.users!
    }));
  }

  async updateConsultation(id: string, updates: Partial<Consultation>): Promise<Consultation | undefined> {
    // Get current consultation to check if status is changing to 'completed'
    const currentConsultation = await db.select().from(schema.consultations)
      .where(eq(schema.consultations.id, id))
      .limit(1);
    
    const [consultation] = await db.update(schema.consultations)
      .set(updates)
      .where(eq(schema.consultations.id, id))
      .returning();
    
    // AUTO-SYNC TRIGGER: When consultation is completed and has content,
    // automatically sync to client's private File Search store
    if (consultation && 
        updates.status === 'completed' && 
        currentConsultation[0]?.status !== 'completed' &&
        (consultation.transcript || consultation.notes)) {
      
      // Import dynamically to avoid circular dependencies
      import('./services/file-search-sync-service').then(({ fileSearchSyncService }) => {
        console.log(`🔄 [AUTO-SYNC] Triggering consultation sync for completed consultation ${id}`);
        fileSearchSyncService.syncClientConsultationNotes(
          consultation.id,
          consultation.clientId,
          consultation.consultantId
        ).then(result => {
          if (result.success) {
            console.log(`✅ [AUTO-SYNC] Consultation ${id} synced to client private store`);
          } else {
            console.warn(`⚠️ [AUTO-SYNC] Failed to sync consultation ${id}: ${result.error}`);
          }
        }).catch(err => {
          console.error(`❌ [AUTO-SYNC] Error syncing consultation ${id}:`, err);
        });
      }).catch(err => {
        console.error(`❌ [AUTO-SYNC] Failed to import file-search-sync-service:`, err);
      });
    }
    
    return consultation || undefined;
  }

  async getConsultation(id: string): Promise<Consultation | undefined> {
    const [consultation] = await db.select().from(schema.consultations)
      .where(eq(schema.consultations.id, id));
    return consultation || undefined;
  }

  async deleteConsultation(id: string): Promise<boolean> {
    const result = await db.delete(schema.consultations)
      .where(eq(schema.consultations.id, id));
    return (result.rowCount || 0) > 0;
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const [goal] = await db.insert(schema.goals)
      .values([{ ...insertGoal, status: insertGoal.status as 'active' | 'completed' | 'paused' || 'active' }])
      .returning();
    return goal;
  }

  async getGoalsByClient(clientId: string): Promise<Goal[]> {
    return db.select().from(schema.goals)
      .where(eq(schema.goals.clientId, clientId));
  }

  async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | undefined> {
    const [goal] = await db.update(schema.goals)
      .set(updates)
      .where(eq(schema.goals.id, id))
      .returning();
    return goal || undefined;
  }

  // Daily Tasks operations
  async createDailyTask(data: InsertDailyTask): Promise<DailyTask> {
    // Ensure date is in the correct format for PostgreSQL date type
    const taskData = {
      ...data,
      date: data.date // Already in YYYY-MM-DD format from validation
    };

    const [task] = await db.insert(schema.dailyTasks).values(taskData).returning();
    return task;
  }

  async getDailyTasksByClient(clientId: string, startDate?: string, endDate?: string): Promise<DailyTask[]> {
    let query = db.select().from(schema.dailyTasks)
      .where(eq(schema.dailyTasks.clientId, clientId));

    if (startDate && endDate) {
      query = query.where(and(
        eq(schema.dailyTasks.clientId, clientId),
        gte(schema.dailyTasks.date, startDate),
        lte(schema.dailyTasks.date, endDate)
      ));
    }

    return query.orderBy(schema.dailyTasks.date);
  }

  async getDailyTasksByConsultant(consultantId: string, clientId?: string, startDate?: string, endDate?: string): Promise<DailyTask[]> {
    let conditions = [eq(schema.dailyTasks.consultantId, consultantId)];

    if (clientId) {
      conditions.push(eq(schema.dailyTasks.clientId, clientId));
    }

    if (startDate && endDate) {
      conditions.push(gte(schema.dailyTasks.date, startDate));
      conditions.push(lte(schema.dailyTasks.date, endDate));
    }

    return db.select().from(schema.dailyTasks)
      .where(and(...conditions))
      .orderBy(schema.dailyTasks.date);
  }

  async updateDailyTask(id: string, updates: Partial<DailyTask>): Promise<DailyTask | undefined> {
    const [task] = await db.update(schema.dailyTasks)
      .set(updates)
      .where(eq(schema.dailyTasks.id, id))
      .returning();
    return task || undefined;
  }

  async deleteDailyTask(id: string): Promise<boolean> {
    const result = await db.delete(schema.dailyTasks)
      .where(eq(schema.dailyTasks.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Daily Reflections operations
  async createDailyReflection(insertReflection: InsertDailyReflection): Promise<DailyReflection> {
    const [reflection] = await db.insert(schema.dailyReflections)
      .values([insertReflection])
      .returning();
    return reflection;
  }

  async getDailyReflectionsByClient(clientId: string, startDate?: string, endDate?: string): Promise<DailyReflection[]> {
    let query = db.select().from(schema.dailyReflections)
      .where(eq(schema.dailyReflections.clientId, clientId));

    if (startDate && endDate) {
      query = query.where(and(
        eq(schema.dailyReflections.clientId, clientId),
        gte(schema.dailyReflections.date, startDate),
        lte(schema.dailyReflections.date, endDate)
      ));
    }

    return query.orderBy(schema.dailyReflections.date);
  }

  async getDailyReflectionsByConsultant(consultantId: string, clientId?: string, startDate?: string, endDate?: string): Promise<DailyReflection[]> {
    let conditions = [eq(schema.dailyReflections.consultantId, consultantId)];

    if (clientId) {
      conditions.push(eq(schema.dailyReflections.clientId, clientId));
    }

    if (startDate && endDate) {
      conditions.push(gte(schema.dailyReflections.date, startDate));
      conditions.push(lte(schema.dailyReflections.date, endDate));
    }

    return db.select().from(schema.dailyReflections)
      .where(and(...conditions))
      .orderBy(schema.dailyReflections.date);
  }

  async getDailyReflectionByDate(clientId: string, date: string): Promise<DailyReflection | undefined> {
    const [reflection] = await db.select().from(schema.dailyReflections)
      .where(and(
        eq(schema.dailyReflections.clientId, clientId),
        eq(schema.dailyReflections.date, date)
      ));
    return reflection || undefined;
  }

  async updateDailyReflection(id: string, updates: Partial<DailyReflection>): Promise<DailyReflection | undefined> {
    const [reflection] = await db.update(schema.dailyReflections)
      .set(updates)
      .where(eq(schema.dailyReflections.id, id))
      .returning();
    return reflection || undefined;
  }

  async deleteDailyReflection(id: string): Promise<boolean> {
    const result = await db.delete(schema.dailyReflections)
      .where(eq(schema.dailyReflections.id, id));
    return true;
  }

  // Consultation Tasks operations
  async createConsultationTask(data: InsertConsultationTask): Promise<ConsultationTask> {
    const [task] = await db.insert(schema.consultationTasks)
      .values(data)
      .returning();
    return task;
  }

  async getConsultationTasks(consultationId: string): Promise<ConsultationTask[]> {
    return db.select()
      .from(schema.consultationTasks)
      .where(eq(schema.consultationTasks.consultationId, consultationId))
      .orderBy(asc(schema.consultationTasks.dueDate));
  }

  async getConsultationTaskById(id: string): Promise<ConsultationTask | undefined> {
    const [task] = await db.select()
      .from(schema.consultationTasks)
      .where(eq(schema.consultationTasks.id, id));
    return task || undefined;
  }

  async getClientTasks(
    clientId: string, 
    filters?: {completed?: boolean; priority?: string; category?: string; consultationId?: string; excludeDraftStatus?: boolean}
  ): Promise<ConsultationTask[]> {
    let conditions = [eq(schema.consultationTasks.clientId, clientId)];

    if (filters?.completed !== undefined) {
      conditions.push(eq(schema.consultationTasks.completed, filters.completed));
    }

    if (filters?.priority) {
      conditions.push(eq(schema.consultationTasks.priority, filters.priority as "low" | "medium" | "high" | "urgent"));
    }

    if (filters?.category) {
      conditions.push(eq(schema.consultationTasks.category, filters.category as "preparation" | "follow-up" | "exercise" | "goal" | "reminder"));
    }

    if (filters?.consultationId) {
      conditions.push(eq(schema.consultationTasks.consultationId, filters.consultationId));
    }

    // By default, exclude draft and discarded tasks - only show active tasks or tasks without draftStatus
    if (filters?.excludeDraftStatus !== false) {
      conditions.push(
        or(
          eq(schema.consultationTasks.draftStatus, "active"),
          isNull(schema.consultationTasks.draftStatus)
        )!
      );
    }

    return db.select()
      .from(schema.consultationTasks)
      .where(and(...conditions))
      .orderBy(asc(schema.consultationTasks.dueDate));
  }

  async getConsultationTasksByConsultant(consultantId: string): Promise<(ConsultationTask & { clientName: string })[]> {
    const tasks = await db
      .select({
        task: schema.consultationTasks,
        clientFirstName: schema.users.firstName,
        clientLastName: schema.users.lastName,
      })
      .from(schema.consultationTasks)
      .innerJoin(schema.consultations, eq(schema.consultationTasks.consultationId, schema.consultations.id))
      .innerJoin(schema.users, eq(schema.consultationTasks.clientId, schema.users.id))
      .where(eq(schema.consultations.consultantId, consultantId))
      .orderBy(asc(schema.consultationTasks.dueDate));

    return tasks.map(({ task, clientFirstName, clientLastName }) => ({
      ...task,
      clientName: `${clientFirstName} ${clientLastName}`
    }));
  }

  async updateConsultationTask(id: string, updates: UpdateConsultationTask): Promise<ConsultationTask | undefined> {
    const [task] = await db.update(schema.consultationTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.consultationTasks.id, id))
      .returning();
    return task || undefined;
  }

  async deleteConsultationTask(id: string): Promise<boolean> {
    const result = await db.delete(schema.consultationTasks)
      .where(eq(schema.consultationTasks.id, id));
    return (result.rowCount || 0) > 0;
  }

  async completeConsultationTask(id: string): Promise<ConsultationTask | undefined> {
    const [task] = await db.update(schema.consultationTasks)
      .set({ 
        completed: true, 
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.consultationTasks.id, id))
      .returning();
    return task || undefined;
  }

  // Client State Tracking operations
  async upsertClientState(data: InsertClientStateTracking): Promise<ClientStateTracking> {
    const [state] = await db.insert(schema.clientStateTracking)
      .values(data)
      .onConflictDoUpdate({
        target: [schema.clientStateTracking.clientId, schema.clientStateTracking.consultantId],
        set: {
          currentState: data.currentState,
          idealState: data.idealState,
          internalBenefit: data.internalBenefit,
          externalBenefit: data.externalBenefit,
          mainObstacle: data.mainObstacle,
          pastAttempts: data.pastAttempts,
          currentActions: data.currentActions,
          futureVision: data.futureVision,
          motivationDrivers: data.motivationDrivers,
          lastUpdated: new Date(),
        }
      })
      .returning();
    return state;
  }

  async getClientState(clientId: string, consultantId: string): Promise<ClientStateTracking | undefined> {
    const [state] = await db.select()
      .from(schema.clientStateTracking)
      .where(and(
        eq(schema.clientStateTracking.clientId, clientId),
        eq(schema.clientStateTracking.consultantId, consultantId)
      ));
    return state || undefined;
  }

  async updateClientState(id: string, updates: UpdateClientStateTracking): Promise<ClientStateTracking | undefined> {
    const [state] = await db.update(schema.clientStateTracking)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(schema.clientStateTracking.id, id))
      .returning();
    return state || undefined;
  }

  async getClientStatesByConsultant(consultantId: string): Promise<ClientStateTracking[]> {
    return db.select()
      .from(schema.clientStateTracking)
      .where(eq(schema.clientStateTracking.consultantId, consultantId));
  }

  // Automated Emails Log operations
  async createEmailLog(data: InsertAutomatedEmailsLog): Promise<AutomatedEmailsLog> {
    const [log] = await db.insert(schema.automatedEmailsLog)
      .values(data)
      .returning();
    return log;
  }

  async getEmailLogsByClient(clientId: string, limit?: number, excludeTest: boolean = false): Promise<AutomatedEmailsLog[]> {
    let query = db.select()
      .from(schema.automatedEmailsLog)
      .where(
        excludeTest 
          ? and(
              eq(schema.automatedEmailsLog.clientId, clientId),
              eq(schema.automatedEmailsLog.isTest, false)
            )!
          : eq(schema.automatedEmailsLog.clientId, clientId)
      )
      .orderBy(desc(schema.automatedEmailsLog.sentAt));

    if (limit) {
      return query.limit(limit);
    }

    return query;
  }

  async getRecentEmailLogs(daysSince: number): Promise<AutomatedEmailsLog[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSince);

    return db.select()
      .from(schema.automatedEmailsLog)
      .where(gte(schema.automatedEmailsLog.sentAt, cutoffDate))
      .orderBy(desc(schema.automatedEmailsLog.sentAt));
  }

  async getConsultantSmtpSettings(consultantId: string): Promise<ConsultantSmtpSettings | undefined> {
    const [settings] = await db.select()
      .from(schema.consultantSmtpSettings)
      .where(eq(schema.consultantSmtpSettings.consultantId, consultantId));
    return settings;
  }

  async upsertConsultantSmtpSettings(data: InsertConsultantSmtpSettings): Promise<ConsultantSmtpSettings> {
    const [settings] = await db.insert(schema.consultantSmtpSettings)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.consultantSmtpSettings.consultantId,
        set: {
          ...data,
          updatedAt: new Date(),
        }
      })
      .returning();
    return settings;
  }

  async deleteConsultantSmtpSettings(consultantId: string): Promise<boolean> {
    const result = await db.delete(schema.consultantSmtpSettings)
      .where(eq(schema.consultantSmtpSettings.consultantId, consultantId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Email Drafts operations
  async createEmailDraft(data: InsertEmailDraft): Promise<EmailDraft> {
    const [draft] = await db.insert(schema.emailDrafts)
      .values(data)
      .returning();
    return draft;
  }

  async getEmailDraftsByConsultant(consultantId: string, status?: string): Promise<(EmailDraft & { client: User, journeyTemplate?: EmailJourneyTemplate })[]> {
    let conditions = [eq(schema.emailDrafts.consultantId, consultantId)];
    
    if (status) {
      conditions.push(eq(schema.emailDrafts.status, status as any));
    }

    const results = await db.select({
      draft: schema.emailDrafts,
      client: schema.users,
      journeyTemplate: schema.emailJourneyTemplates,
    })
      .from(schema.emailDrafts)
      .innerJoin(schema.users, eq(schema.emailDrafts.clientId, schema.users.id))
      .leftJoin(schema.emailJourneyTemplates, eq(schema.emailDrafts.journeyTemplateId, schema.emailJourneyTemplates.id))
      .where(and(...conditions))
      .orderBy(desc(schema.emailDrafts.generatedAt));
    
    return results.map((r: any) => ({ ...r.draft, client: r.client, journeyTemplate: r.journeyTemplate }));
  }

  async getEmailDraft(id: string): Promise<EmailDraft | undefined> {
    const [draft] = await db.select()
      .from(schema.emailDrafts)
      .where(eq(schema.emailDrafts.id, id));
    return draft;
  }

  async updateEmailDraft(id: string, updates: UpdateEmailDraft): Promise<EmailDraft | undefined> {
    const [draft] = await db.update(schema.emailDrafts)
      .set(updates)
      .where(eq(schema.emailDrafts.id, id))
      .returning();
    return draft;
  }

  async updateEmailDraftStatus(id: string, status: "pending" | "approved" | "rejected" | "sent", sentAt?: Date): Promise<EmailDraft | undefined> {
    const updateData: any = { status };
    
    if (status === "approved") {
      updateData.approvedAt = new Date();
    } else if (status === "sent") {
      updateData.sentAt = sentAt || new Date();
    }
    
    const [draft] = await db.update(schema.emailDrafts)
      .set(updateData)
      .where(eq(schema.emailDrafts.id, id))
      .returning();
    return draft;
  }

  async deleteEmailDraft(id: string): Promise<boolean> {
    // Get draft first to check if it's a consultation summary
    const draft = await this.getEmailDraft(id);
    
    // Delete the draft
    const result = await db.delete(schema.emailDrafts)
      .where(eq(schema.emailDrafts.id, id));
    
    // If it was a consultation summary, clear it from the consultation too
    if (draft && draft.emailType === "consultation_summary" && draft.consultationId) {
      await db.update(schema.consultations)
        .set({
          summaryEmail: null,
          summaryEmailGeneratedAt: null,
        })
        .where(eq(schema.consultations.id, draft.consultationId));
      console.log(`✅ Cleared summary email from consultation ${draft.consultationId}`);
    }
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getPendingDraftsByClient(clientId: string): Promise<EmailDraft[]> {
    return db.select()
      .from(schema.emailDrafts)
      .where(
        and(
          eq(schema.emailDrafts.clientId, clientId),
          eq(schema.emailDrafts.status, "pending"),
          // Exclude consultation_summary emails - they are manual drafts, not journey emails
          ne(schema.emailDrafts.emailType, "consultation_summary"),
          // Exclude system_update emails - they are manual drafts, not journey emails
          ne(schema.emailDrafts.emailType, "system_update")
        )
      )
      .orderBy(desc(schema.emailDrafts.generatedAt));
  }

  async checkExistingConsultationSummaryDraft(consultationId: string): Promise<EmailDraft | null> {
    const [draft] = await db.select()
      .from(schema.emailDrafts)
      .where(
        and(
          eq(schema.emailDrafts.consultationId, consultationId),
          eq(schema.emailDrafts.emailType, "consultation_summary"),
          or(
            eq(schema.emailDrafts.status, "pending"),
            eq(schema.emailDrafts.status, "approved")
          )
        )
      )
      .limit(1);
    return draft || null;
  }

  async checkConsultationSummaryAlreadySent(consultationId: string): Promise<{ sent: boolean; sentAt?: Date }> {
    // Check in emailDrafts first (sent status)
    const [draftSent] = await db.select()
      .from(schema.emailDrafts)
      .where(
        and(
          eq(schema.emailDrafts.consultationId, consultationId),
          eq(schema.emailDrafts.emailType, "consultation_summary"),
          eq(schema.emailDrafts.status, "sent")
        )
      )
      .limit(1);

    if (draftSent) {
      return { sent: true, sentAt: draftSent.sentAt || undefined };
    }

    // Check in automatedEmailsLog as backup
    const [logEntry] = await db.select()
      .from(schema.automatedEmailsLog)
      .where(
        and(
          eq(schema.automatedEmailsLog.consultationId, consultationId),
          eq(schema.automatedEmailsLog.emailType, "consultation_summary")
        )
      )
      .limit(1);

    if (logEntry) {
      return { sent: true, sentAt: logEntry.sentAt };
    }

    return { sent: false };
  }

  // ============================================
  // CONSULTATION SUMMARY EMAIL - DUPLICATE CHECKS
  // ============================================
  
  /**
   * Controlla se esiste già una bozza email di riepilogo consulenza per questa consultationId
   * Verifica solo bozze in stato pending/approved (non sent/rejected)
   */
  async checkExistingConsultationSummaryDraft(consultationId: string): Promise<EmailDraft | null> {
    const [draft] = await db.select()
      .from(schema.emailDrafts)
      .where(
        and(
          eq(schema.emailDrafts.consultationId, consultationId),
          eq(schema.emailDrafts.emailType, "consultation_summary"),
          inArray(schema.emailDrafts.status, ["pending", "approved"])
        )
      )
      .limit(1);
    
    return draft || null;
  }

  /**
   * Controlla se è già stata inviata un'email di riepilogo consulenza per questa consultationId
   * Verifica sia draft già inviati che log email inviate
   */
  async checkConsultationSummaryAlreadySent(consultationId: string): Promise<{ sent: boolean; sentAt?: Date }> {
    // Controlla prima nei draft sent
    const [sentDraft] = await db.select()
      .from(schema.emailDrafts)
      .where(
        and(
          eq(schema.emailDrafts.consultationId, consultationId),
          eq(schema.emailDrafts.emailType, "consultation_summary"),
          eq(schema.emailDrafts.status, "sent")
        )
      )
      .limit(1);
    
    if (sentDraft && sentDraft.sentAt) {
      return { sent: true, sentAt: sentDraft.sentAt };
    }
    
    // Controlla anche nel log email automatiche
    const [emailLog] = await db.select()
      .from(schema.automatedEmailsLog)
      .where(
        and(
          eq(schema.automatedEmailsLog.consultationId, consultationId),
          eq(schema.automatedEmailsLog.emailType, "consultation_summary")
        )
      )
      .limit(1);
    
    if (emailLog) {
      return { sent: true, sentAt: emailLog.sentAt };
    }
    
    return { sent: false };
  }

  // Client Email Automation operations
  async getClientEmailAutomation(consultantId: string, clientId: string): Promise<ClientEmailAutomation | undefined> {
    const [automation] = await db.select()
      .from(schema.clientEmailAutomation)
      .where(
        and(
          eq(schema.clientEmailAutomation.consultantId, consultantId),
          eq(schema.clientEmailAutomation.clientId, clientId)
        )
      );
    return automation;
  }

  async upsertClientEmailAutomation(data: InsertClientEmailAutomation): Promise<ClientEmailAutomation> {
    const [automation] = await db.insert(schema.clientEmailAutomation)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.clientEmailAutomation.consultantId, schema.clientEmailAutomation.clientId],
        set: {
          enabled: data.enabled,
          updatedAt: new Date(),
        }
      })
      .returning();
    return automation;
  }

  async getClientsWithAutomationEnabled(consultantId: string): Promise<User[]> {
    const results = await db.select({
      user: schema.users,
    })
      .from(schema.clientEmailAutomation)
      .innerJoin(schema.users, eq(schema.clientEmailAutomation.clientId, schema.users.id))
      .where(
        and(
          eq(schema.clientEmailAutomation.consultantId, consultantId),
          eq(schema.clientEmailAutomation.enabled, true)
        )
      );
    
    return results.map(r => r.user);
  }

  async toggleClientEmailAutomation(consultantId: string, clientId: string, enabled: boolean): Promise<ClientEmailAutomation> {
    return this.upsertClientEmailAutomation({
      consultantId,
      clientId,
      enabled,
    });
  }

  // Scheduler operations
  async updateSchedulerStatus(consultantId: string, updates: { schedulerEnabled?: boolean; schedulerPaused?: boolean; schedulerStatus?: "idle" | "running"; lastSchedulerRun?: Date; nextSchedulerRun?: Date }): Promise<ConsultantSmtpSettings | undefined> {
    const [settings] = await db.update(schema.consultantSmtpSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.consultantSmtpSettings.consultantId, consultantId))
      .returning();
    return settings;
  }

  async createSchedulerLog(data: InsertSchedulerExecutionLog): Promise<SchedulerExecutionLog> {
    const [log] = await db.insert(schema.schedulerExecutionLog)
      .values(data)
      .returning();
    return log;
  }

  async getSchedulerLogs(consultantId: string, limit?: number): Promise<SchedulerExecutionLog[]> {
    let query = db.select()
      .from(schema.schedulerExecutionLog)
      .where(eq(schema.schedulerExecutionLog.consultantId, consultantId))
      .orderBy(desc(schema.schedulerExecutionLog.executedAt));

    if (limit) {
      return query.limit(limit);
    }

    return query;
  }

  async getLatestSchedulerRun(consultantId: string): Promise<SchedulerExecutionLog | undefined> {
    const [log] = await db.select()
      .from(schema.schedulerExecutionLog)
      .where(eq(schema.schedulerExecutionLog.consultantId, consultantId))
      .orderBy(desc(schema.schedulerExecutionLog.executedAt))
      .limit(1);
    return log;
  }

  // Atomic lock acquisition for distributed scheduler
  // 🔒 IMPROVED: Retry logic with exponential backoff for robust contention handling
  async acquireSchedulerLock(consultantId: string, maxRetries: number = 3): Promise<boolean> {
    const LOCK_TIMEOUT_MINUTES = 5;
    const BASE_RETRY_DELAY_MS = 500; // Start with 500ms
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const now = new Date();
      const timeoutThreshold = new Date(now.getTime() - LOCK_TIMEOUT_MINUTES * 60 * 1000);

      if (attempt === 0) {
        console.log(`🔒 [LOCK] Attempting to acquire scheduler lock for consultant: ${consultantId}`);
        console.log(`🔒 [LOCK] Max retries: ${maxRetries}, Timeout threshold: ${LOCK_TIMEOUT_MINUTES} minutes`);
      } else {
        console.log(`🔒 [LOCK] Retry attempt ${attempt + 1}/${maxRetries} for consultant: ${consultantId}`);
      }

      // Try to acquire lock atomically with row-level locking
      const [result] = await db.update(schema.consultantSmtpSettings)
        .set({
          schedulerStatus: 'running',
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.consultantSmtpSettings.consultantId, consultantId),
            or(
              // Lock is NULL (never initialized) - treat as idle
              isNull(schema.consultantSmtpSettings.schedulerStatus),
              // Lock is idle - we can acquire it
              eq(schema.consultantSmtpSettings.schedulerStatus, 'idle'),
              // Lock is running but stale (older than 5 minutes) - we can take over
              and(
                eq(schema.consultantSmtpSettings.schedulerStatus, 'running'),
                sql`${schema.consultantSmtpSettings.updatedAt} < ${timeoutThreshold}`
              )
            )
          )
        )
        .returning();

      const lockAcquired = result !== undefined;
      
      if (lockAcquired) {
        console.log(`✅ [LOCK] Lock acquired successfully for consultant: ${consultantId} at ${now.toISOString()} (attempt ${attempt + 1})`);
        return true;
      }

      // If not last attempt, wait before retrying with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt); // Exponential backoff: 500ms, 1000ms, 2000ms
        const jitter = Math.random() * 200; // Add random jitter 0-200ms to prevent thundering herd
        const totalDelay = delay + jitter;
        
        console.log(`⏳ [LOCK] Lock busy, waiting ${Math.round(totalDelay)}ms before retry ${attempt + 2}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }

    console.log(`❌ [LOCK] Failed to acquire lock for consultant: ${consultantId} after ${maxRetries} attempts - another instance is running`);
    return false;
  }

  // Release scheduler lock
  // 🔒 IMPROVED: Added detailed logging
  async releaseSchedulerLock(consultantId: string): Promise<void> {
    const now = new Date();
    console.log(`🔓 [LOCK] Releasing scheduler lock for consultant: ${consultantId} at ${now.toISOString()}`);
    
    await db.update(schema.consultantSmtpSettings)
      .set({
        schedulerStatus: 'idle',
        updatedAt: now,
      })
      .where(eq(schema.consultantSmtpSettings.consultantId, consultantId));
    
    console.log(`✅ [LOCK] Lock released successfully for consultant: ${consultantId}`);
  }

  async createClientProgress(insertProgress: InsertClientProgress): Promise<ClientProgress> {
    const [progress] = await db.insert(schema.clientProgress)
      .values([insertProgress])
      .returning();
    return progress;
  }

  async getClientProgress(clientId: string, date?: Date): Promise<ClientProgress[]> {
    const query = db.select().from(schema.clientProgress)
      .where(eq(schema.clientProgress.clientId, clientId));

    if (date) {
      return query.where(and(
        eq(schema.clientProgress.clientId, clientId),
        eq(schema.clientProgress.date, date)
      ));
    }

    return query;
  }

  async updateClientProgress(clientId: string, date: Date, updates: Partial<ClientProgress>): Promise<ClientProgress | undefined> {
    const [progress] = await db.update(schema.clientProgress)
      .set(updates)
      .where(and(
        eq(schema.clientProgress.clientId, clientId),
        eq(schema.clientProgress.date, date)
      ))
      .returning();
    return progress || undefined;
  }

  // Template operations (simplified stubs)
  async createExerciseTemplate(template: InsertExerciseTemplate, createdBy: string): Promise<ExerciseTemplate> {
    const [exerciseTemplate] = await db.insert(schema.exerciseTemplates)
      .values([{ ...template, createdBy, type: template.type as 'general' | 'personalized' }])
      .returning();
    return exerciseTemplate;
  }

  async getExerciseTemplate(id: string): Promise<ExerciseTemplate | undefined> {
    const [template] = await db.select().from(schema.exerciseTemplates)
      .where(eq(schema.exerciseTemplates.id, id));
    return template || undefined;
  }

  async getExerciseTemplatesByConsultant(consultantId: string): Promise<ExerciseTemplate[]> {
    return db.select().from(schema.exerciseTemplates)
      .where(eq(schema.exerciseTemplates.createdBy, consultantId));
  }

  async getPublicExerciseTemplates(): Promise<ExerciseTemplate[]> {
    return db.select().from(schema.exerciseTemplates)
      .where(eq(schema.exerciseTemplates.isPublic, true));
  }

  async searchExerciseTemplates(filters: any): Promise<ExerciseTemplate[]> {
    return db.select().from(schema.exerciseTemplates);
  }

  async updateExerciseTemplate(id: string, updates: Partial<ExerciseTemplate>): Promise<ExerciseTemplate | undefined> {
    const [template] = await db.update(schema.exerciseTemplates)
      .set(updates)
      .where(eq(schema.exerciseTemplates.id, id))
      .returning();
    return template || undefined;
  }

  async deleteExerciseTemplate(id: string): Promise<boolean> {
    // Check if there are associated exercises
    const hasExercises = await this.hasAssociatedExercises(id);
    if (hasExercises) {
      // Optionally, you could prompt the user here or return a flag indicating associated exercises
      // For now, we'll just return false to indicate it wasn't deleted without confirmation
      // In a real app, this would involve a confirmation dialog before proceeding.
      // If the caller confirms deletion of associated exercises, they will call deleteAssociatedExercises.
      return false; // Indicate that deletion requires further action or confirmation
    }

    // If no associated exercises, proceed with deletion
    const result = await db.delete(schema.exerciseTemplates)
      .where(eq(schema.exerciseTemplates.id, id));
    return (result.rowCount || 0) > 0;
  }

  async hasAssociatedExercises(templateId: string): Promise<boolean> {
    // Simplified: templates can always be deleted
    return false;
  }

  async deleteAssociatedExercises(templateId: string): Promise<boolean> {
    // Simplified: no associations to delete
    return true;
  }

  async getExercisesFromTemplate(templateId: string, consultantId: string): Promise<Exercise[]> {
    // Instead of getting exercises from template, get client associations
    // This method should return an empty array since exercises aren't created from templates in this design
    return [];
  }

  async deleteExercisesFromTemplate(templateId: string, consultantId: string): Promise<boolean> {
    // Simplified: no associations to delete
    return true;
  }

  async incrementTemplateUsage(id: string): Promise<ExerciseTemplate | undefined> {
    const [template] = await db.update(schema.exerciseTemplates)
      .set({ usageCount: sql`${schema.exerciseTemplates.usageCount} + 1` })
      .where(eq(schema.exerciseTemplates.id, id))
      .returning();
    return template || undefined;
  }

  async copyTemplateToExercise(templateId: string, createdBy: string): Promise<Exercise> {
    const template = await this.getExerciseTemplate(templateId);
    if (!template) throw new Error('Template not found');

    return this.createExercise({
      title: template.name,
      description: template.description,
      type: template.type,
      category: template.category,
      estimatedDuration: template.estimatedDuration,
      instructions: template.instructions,
      questions: template.questions,
      attachments: []
    }, createdBy);
  }

  // Template Client Association Operations
  async associateTemplateWithClient(templateId: string, clientId: string): Promise<TemplateClientAssociation> {
    const [association] = await db.insert(schema.templateClientAssociations)
      .values([{ templateId, clientId, consultantId: '' }])
      .returning();
    return association;
  }

  async getAssociatedClientsForTemplate(templateId: string): Promise<User[]> {
    const associations = await db.select()
      .from(schema.templateClientAssociations)
      .where(eq(schema.templateClientAssociations.templateId, templateId))
      .leftJoin(schema.users, eq(schema.templateClientAssociations.clientId, schema.users.id));

    return associations.map(row => row.users!).filter(Boolean);
  }

  async getAssociatedTemplatesForClient(clientId: string): Promise<ExerciseTemplate[]> {
    const associations = await db.select()
      .from(schema.templateClientAssociations)
      .where(eq(schema.templateClientAssociations.clientId, clientId))
      .leftJoin(schema.exerciseTemplates, eq(schema.templateClientAssociations.templateId, schema.exerciseTemplates.id));

    return associations.map(row => row.exercise_templates!).filter(Boolean);
  }

  async removeTemplateAssociation(templateId: string, clientId: string): Promise<boolean> {
    const result = await db.delete(schema.templateClientAssociations)
      .where(and(
        eq(schema.templateClientAssociations.templateId, templateId),
        eq(schema.templateClientAssociations.clientId, clientId)
      ));
    return (result.rowCount || 0) > 0;
  }

  async isTemplateAssociatedWithClient(templateId: string, clientId: string): Promise<boolean> {
    const [association] = await db.select()
      .from(schema.templateClientAssociations)
      .where(and(
        eq(schema.templateClientAssociations.templateId, templateId),
        eq(schema.templateClientAssociations.clientId, clientId)
      ));
    return !!association;
  }

  async associateTemplateWithClients(templateId: string, clientIds: string[], consultantId: string, customPlatformLinks: Record<string, string> = {}): Promise<void> {
    // Get current associations to identify removed and new clients
    const currentAssociations = await db.select()
      .from(schema.templateClientAssociations)
      .where(eq(schema.templateClientAssociations.templateId, templateId));
    
    const currentClientIds = currentAssociations.map(a => a.clientId);
    const removedClientIds = currentClientIds.filter(id => !clientIds.includes(id));
    const newClientIds = clientIds.filter(id => !currentClientIds.includes(id));
    
    // Get the template for both deletion and creation
    const [template] = await db.select()
      .from(schema.exerciseTemplates)
      .where(eq(schema.exerciseTemplates.id, templateId));
    
    if (!template) {
      console.log('⚠️ Template not found');
      return;
    }
    
    // Delete exercise assignments for removed clients
    if (removedClientIds.length > 0) {
      console.log(`🗑️ Deleting exercise assignments for template ${templateId} and removed clients:`, removedClientIds);

      // Find ALL exercises related to this template by:
      // 1. Exercises created FROM this template (have templateId)
      // 2. Exercises with the same libraryDocumentId (same lesson)
      // 3. Exercises with the same title and category (manual duplicates)
      const relatedExercises = await db.select({ id: schema.exercises.id })
        .from(schema.exercises)
        .where(
          or(
            eq(schema.exercises.templateId, templateId),
            template.libraryDocumentId ? eq(schema.exercises.libraryDocumentId, template.libraryDocumentId) : sql`false`,
            and(
              eq(schema.exercises.title, template.name),
              eq(schema.exercises.category, template.category),
              eq(schema.exercises.createdBy, consultantId)
            )
          )
        );

      const exerciseIds = relatedExercises.map(e => e.id);
      
      if (exerciseIds.length > 0) {
        // Delete assignments for these exercises and removed clients
        await db.delete(schema.exerciseAssignments)
          .where(and(
            inArray(schema.exerciseAssignments.exerciseId, exerciseIds),
            inArray(schema.exerciseAssignments.clientId, removedClientIds)
          ));
        
        console.log(`✅ Deleted assignments for ${removedClientIds.length} removed clients from ${exerciseIds.length} related exercises`);
      } else {
        console.log(`ℹ️ No related exercises found for template ${templateId}`);
      }
    }
    
    // Create exercises for new clients
    if (newClientIds.length > 0) {
      console.log(`➕ Creating exercises for template ${templateId} and new clients:`, newClientIds);
      
      for (const clientId of newClientIds) {
        try {
          // Create exercise from template - copy all relevant fields
          const exercise = await this.createExercise({
            title: template.name,
            description: template.description,
            type: template.type,
            category: template.category,
            estimatedDuration: template.estimatedDuration,
            instructions: template.instructions,
            questions: template.questions || [],
            workPlatform: template.workPlatform || undefined,
            libraryDocumentId: template.libraryDocumentId || undefined,
            templateId: templateId,
            attachments: (template as any).attachments || [],
            timeLimit: template.timeLimit || undefined,
            maxScore: (template as any).maxScore || undefined,
            passingScore: (template as any).passingScore || undefined,
            allowRetries: (template as any).allowRetries !== undefined ? (template as any).allowRetries : true,
            showProgressBar: (template as any).showProgressBar !== undefined ? (template as any).showProgressBar : true,
            randomizeQuestions: (template as any).randomizeQuestions || false
          }, consultantId);
          
          // Create assignment for the new client with optional custom platform link
          const customLink = customPlatformLinks[clientId] || null;
          await this.createExerciseAssignment({
            exerciseId: exercise.id,
            clientId: clientId,
            consultantId: consultantId,
            dueDate: null,
            status: "pending",
            workPlatform: customLink
          });
          
          if (customLink) {
            console.log(`🔗 Assignment created with custom link for client ${clientId}: ${customLink}`);
          }
          
          console.log(`✅ Created exercise ${exercise.id} and assignment for client ${clientId}`);
        } catch (error) {
          console.error(`❌ Failed to create exercise for client ${clientId}:`, error);
        }
      }
    }
    
    // Delete all existing template associations
    await db.delete(schema.templateClientAssociations)
      .where(eq(schema.templateClientAssociations.templateId, templateId));
    
    // Insert new associations
    if (clientIds.length > 0) {
      await db.insert(schema.templateClientAssociations)
        .values(clientIds.map(clientId => ({
          templateId,
          clientId,
          consultantId,
          isVisible: true
        })));
    }
  }

  async getTemplateClientAssociations(templateId: string, consultantId: string): Promise<TemplateClientAssociation[]> {
    return db.select()
      .from(schema.templateClientAssociations)
      .where(and(
        eq(schema.templateClientAssociations.templateId, templateId),
        eq(schema.templateClientAssociations.consultantId, consultantId)
      ));
  }

  // Analytics stubs - returning empty data for now
  async createClientEngagementMetrics(): Promise<ClientEngagementMetrics> {
    throw new Error('Not implemented');
  }

  async getClientEngagementMetrics(): Promise<ClientEngagementMetrics[]> {
    return [];
  }

  async updateClientEngagementMetrics(): Promise<ClientEngagementMetrics | undefined> {
    return undefined;
  }

  async createExercisePerformanceMetrics(): Promise<ExercisePerformanceMetrics> {
    throw new Error('Not implemented');
  }

  async getExercisePerformanceMetrics(): Promise<ExercisePerformanceMetrics[]> {
    return [];
  }

  async updateExercisePerformanceMetrics(): Promise<ExercisePerformanceMetrics | undefined> {
    return undefined;
  }

  async createConsultantAnalytics(): Promise<ConsultantAnalytics> {
    throw new Error('Not implemented');
  }

  async getConsultantAnalytics(): Promise<ConsultantAnalytics[]> {
    return [];
  }

  async updateConsultantAnalytics(): Promise<ConsultantAnalytics | undefined> {
    return undefined;
  }

  async createClientAnalyticsSummary(): Promise<ClientAnalyticsSummary> {
    throw new Error('Not implemented');
  }

  async getClientAnalyticsSummary(): Promise<ClientAnalyticsSummary[]> {
    return [];
  }

  async updateClientAnalyticsSummary(): Promise<ClientAnalyticsSummary | undefined> {
    return undefined;
  }

  async createUserActivityLog(activityLog: InsertUserActivityLog): Promise<UserActivityLog> {
    const [log] = await db.insert(schema.userActivityLogs)
      .values([activityLog])
      .returning();
    return log;
  }

  async getUserActivityLogs(userId?: string, startDate?: Date, endDate?: Date, activityType?: string): Promise<UserActivityLog[]> {
    let query = db.select().from(schema.userActivityLogs);

    const conditions = [];
    if (userId) conditions.push(eq(schema.userActivityLogs.userId, userId));
    if (startDate) conditions.push(gte(schema.userActivityLogs.timestamp, startDate));
    if (endDate) conditions.push(lte(schema.userActivityLogs.timestamp, endDate));
    if (activityType) conditions.push(eq(schema.userActivityLogs.activityType, activityType as any));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(desc(schema.userActivityLogs.timestamp));
  }

  async getUserActivityLogsByConsultant(consultantId: string, startDate?: Date, endDate?: Date, limit: number = 500): Promise<UserActivityLog[]> {
    // Get all clients assigned to this consultant
    const clients = await this.getClientsByConsultant(consultantId);
    const clientIds = clients.map(c => c.id);

    if (clientIds.length === 0) return [];

    const conditions = [inArray(schema.userActivityLogs.userId, clientIds)];
    if (startDate) conditions.push(gte(schema.userActivityLogs.timestamp, startDate));
    if (endDate) conditions.push(lte(schema.userActivityLogs.timestamp, endDate));

    return db.select().from(schema.userActivityLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.userActivityLogs.timestamp))
      .limit(limit);
  }

  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const now = new Date();
    const [userSession] = await db.insert(schema.userSessions)
      .values([{
        ...session,
        startTime: now,
        lastActivity: now,
      }])
      .returning();
    return userSession;
  }

  async getUserSession(sessionId: string): Promise<UserSession | undefined> {
    const [session] = await db.select().from(schema.userSessions)
      .where(eq(schema.userSessions.sessionId, sessionId));
    return session || undefined;
  }

  async updateUserSession(sessionId: string, updates: Partial<UserSession>): Promise<UserSession | undefined> {
    const [session] = await db.update(schema.userSessions)
      .set(updates)
      .where(eq(schema.userSessions.sessionId, sessionId))
      .returning();
    return session || undefined;
  }

  async getActiveUserSessions(consultantId?: string): Promise<UserSession[]> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    let query = db.select().from(schema.userSessions)
      .where(and(
        sql`${schema.userSessions.endTime} IS NULL`,
        gte(schema.userSessions.lastActivity, fifteenMinutesAgo)
      ));

    if (consultantId) {
      // Get clients assigned to this consultant
      const clients = await this.getClientsByConsultant(consultantId);
      const clientIds = clients.map(c => c.id);

      if (clientIds.length === 0) return [];

      query = db.select().from(schema.userSessions)
        .where(and(
          inArray(schema.userSessions.userId, clientIds),
          sql`${schema.userSessions.endTime} IS NULL`,
          gte(schema.userSessions.lastActivity, fifteenMinutesAgo)
        ));
    }

    return query.orderBy(desc(schema.userSessions.lastActivity));
  }

  async endUserSession(sessionId: string): Promise<UserSession | undefined> {
    const [session] = await db.update(schema.userSessions)
      .set({ endTime: new Date() })
      .where(eq(schema.userSessions.sessionId, sessionId))
      .returning();
    return session || undefined;
  }

  async calculateConsultantOverallStats(): Promise<any> {
    return {
      totalClients: 0,
      activeClients: 0,
      totalExercises: 0,
      completedExercises: 0,
      completionRate: 0,
      avgClientEngagement: 0,
      totalConsultations: 0,
      clientRetentionRate: 0
    };
  }

  async calculateClientPerformanceStats(): Promise<any> {
    return {
      totalExercisesAssigned: 0,
      completedExercises: 0,
      completionRate: 0,
      avgCompletionTime: 0,
      avgScore: 0,
      avgSatisfactionRating: 0,
      streakDays: 0,
      engagementScore: 0
    };
  }

  async getExerciseCompletionTrends(): Promise<any[]> {
    return [];
  }

  async getClientEngagementTrends(): Promise<any[]> {
    return [];
  }

  // Roadmap operations implementation
  async createRoadmapPhase(phase: InsertRoadmapPhase): Promise<RoadmapPhase> {
    const [roadmapPhase] = await db.insert(schema.roadmapPhases)
      .values([phase])
      .returning();
    return roadmapPhase;
  }

  async getRoadmapPhases(): Promise<RoadmapPhase[]> {
    return db.select()
      .from(schema.roadmapPhases)
      .orderBy(asc(schema.roadmapPhases.sortOrder));
  }

  async getRoadmapPhase(id: string): Promise<RoadmapPhase | undefined> {
    const [phase] = await db.select()
      .from(schema.roadmapPhases)
      .where(eq(schema.roadmapPhases.id, id));
    return phase || undefined;
  }

  async updateRoadmapPhase(id: string, updates: Partial<RoadmapPhase>): Promise<RoadmapPhase | undefined> {
    const [phase] = await db.update(schema.roadmapPhases)
      .set(updates)
      .where(eq(schema.roadmapPhases.id, id))
      .returning();
    return phase || undefined;
  }

  async createRoadmapGroup(group: InsertRoadmapGroup): Promise<RoadmapGroup> {
    const [roadmapGroup] = await db.insert(schema.roadmapGroups)
      .values([group])
      .returning();
    return roadmapGroup;
  }

  async getRoadmapGroupsByPhase(phaseId: string): Promise<RoadmapGroup[]> {
    return db.select()
      .from(schema.roadmapGroups)
      .where(eq(schema.roadmapGroups.phaseId, phaseId))
      .orderBy(asc(schema.roadmapGroups.sortOrder));
  }

  async getRoadmapGroup(id: string): Promise<RoadmapGroup | undefined> {
    const [group] = await db.select()
      .from(schema.roadmapGroups)
      .where(eq(schema.roadmapGroups.id, id));
    return group || undefined;
  }

  async updateRoadmapGroup(id: string, updates: Partial<RoadmapGroup>): Promise<RoadmapGroup | undefined> {
    const [group] = await db.update(schema.roadmapGroups)
      .set(updates)
      .where(eq(schema.roadmapGroups.id, id))
      .returning();
    return group || undefined;
  }

  async createRoadmapItem(item: InsertRoadmapItem): Promise<RoadmapItem> {
    const [roadmapItem] = await db.insert(schema.roadmapItems)
      .values([item])
      .returning();
    return roadmapItem;
  }

  async getRoadmapItemsByGroup(groupId: string): Promise<RoadmapItem[]> {
    return db.select()
      .from(schema.roadmapItems)
      .where(eq(schema.roadmapItems.groupId, groupId))
      .orderBy(asc(schema.roadmapItems.sortOrder));
  }

  async getRoadmapItem(id: string): Promise<RoadmapItem | undefined> {
    const [item] = await db.select()
      .from(schema.roadmapItems)
      .where(eq(schema.roadmapItems.id, id));
    return item || undefined;
  }

  async updateRoadmapItem(id: string, updates: Partial<RoadmapItem>): Promise<RoadmapItem | undefined> {
    const [item] = await db.update(schema.roadmapItems)
      .set(updates)
      .where(eq(schema.roadmapItems.id, id))
      .returning();
    return item || undefined;
  }

  async createClientRoadmapProgress(progress: InsertClientRoadmapProgress): Promise<ClientRoadmapProgress> {
    const [roadmapProgress] = await db.insert(schema.clientRoadmapProgress)
      .values([{
        ...progress,
        updatedAt: new Date(),
      }])
      .returning();
    return roadmapProgress;
  }

  async getClientRoadmapProgress(clientId: string, itemId: string): Promise<ClientRoadmapProgress | undefined> {
    const [progress] = await db.select()
      .from(schema.clientRoadmapProgress)
      .where(and(
        eq(schema.clientRoadmapProgress.clientId, clientId),
        eq(schema.clientRoadmapProgress.itemId, itemId)
      ));
    return progress || undefined;
  }

  async getClientRoadmapProgressAll(clientId: string): Promise<ClientRoadmapProgress[]> {
    return db.select()
      .from(schema.clientRoadmapProgress)
      .where(eq(schema.clientRoadmapProgress.clientId, clientId));
  }

  async updateClientRoadmapProgress(
    clientId: string,
    itemId: string,
    updates: Partial<InsertClientRoadmapProgress>
  ): Promise<ClientRoadmapProgress | null> {
    try {
      const result = await db.update(schema.clientRoadmapProgress)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(
          eq(schema.clientRoadmapProgress.clientId, clientId),
          eq(schema.clientRoadmapProgress.itemId, itemId)
        ))
        .returning();

      return result[0] || null;
    } catch (error) {
      console.error("Error updating client roadmap progress:", error);
      return null;
    }
  }

  async getFullRoadmapWithProgress(clientId: string): Promise<(RoadmapPhase & {
    groups: (RoadmapGroup & {
      items: (RoadmapItem & {
        progress?: ClientRoadmapProgress;
      })[];
    })[];
  })[]> {
    console.log("getFullRoadmapWithProgress called for clientId:", clientId);

    try {
      // Get all phases
      console.log("Fetching roadmap phases...");
      const phases = await this.getRoadmapPhases();
      console.log("Phases found:", phases.length);

      // Get all groups for phases
      console.log("Fetching roadmap groups...");
      const allGroups = await db.select()
        .from(schema.roadmapGroups)
        .orderBy(asc(schema.roadmapGroups.sortOrder));
      console.log("Groups found:", allGroups.length);

      // Get all items for groups
      console.log("Fetching roadmap items...");
      const allItems = await db.select()
        .from(schema.roadmapItems)
        .orderBy(asc(schema.roadmapItems.sortOrder));
      console.log("Items found:", allItems.length);

      // Get all progress for client
      console.log("Fetching client progress for clientId:", clientId);
      const allProgress = await db.select()
        .from(schema.clientRoadmapProgress)
        .where(eq(schema.clientRoadmapProgress.clientId, clientId));
      console.log("Progress records found:", allProgress.length);

      // Build the nested structure
      console.log("Building nested roadmap structure...");
      const result = phases.map(phase => {
        const phaseGroups = allGroups.filter(group => group.phaseId === phase.id);

        return {
          ...phase,
          groups: phaseGroups.map(group => {
            const groupItems = allItems.filter(item => item.groupId === group.id);

            return {
              ...group,
              items: groupItems.map(item => {
                const itemProgress = allProgress.find(progress => progress.itemId === item.id);

                return {
                  ...item,
                  progress: itemProgress || undefined,
                };
              }),
            };
          }),
        };
      });

      console.log("Roadmap structure built successfully, phases:", result.length);
      return result;

    } catch (error) {
      console.error("Error in getFullRoadmapWithProgress:", error);
      throw error;
    }

    // Build the complete structure
    const result = phases.map(phase => ({
      ...phase,
      groups: allGroups
        .filter(group => group.phaseId === phase.id)
        .map(group => ({
          ...group,
          items: allItems
            .filter(item => item.groupId === group.id)
            .map(item => ({
              ...item,
              progress: allProgress.find(p => p.itemId === item.id)
            }))
        }))
    }));

    return result;
  }

  async getConsultantRoadmapOverview(consultantId: string): Promise<{
    clientId: string;
    clientName: string;
    totalItems: number;
    completedItems: number;
    progressPercentage: number;
  }[]> {
    // Get clients for this consultant
    const clients = await this.getClientsByConsultant(consultantId);

    // Get total number of items in the roadmap
    const totalItemsResult = await db.select({ count: count() })
      .from(schema.roadmapItems);
    const totalItems = totalItemsResult[0]?.count || 0;

    // Get progress for each client
    const overview = await Promise.all(
      clients.map(async (client) => {
        const completedItemsResult = await db.select({ count: count() })
          .from(schema.clientRoadmapProgress)
          .where(and(
            eq(schema.clientRoadmapProgress.clientId, client.id),
            eq(schema.clientRoadmapProgress.isCompleted, true)
          ));

        const completedItems = completedItemsResult[0]?.count || 0;
        const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        return {
          clientId: client.id,
          clientName: `${client.firstName} ${client.lastName}`,
          totalItems,
          completedItems,
          progressPercentage,
        };
      })
    );

    return overview;
  }

  // Cleanup orphaned assignments (assignments without exercises)
  async cleanupOrphanedAssignments(): Promise<number> {
    try {
      const result = await db.delete(schema.exerciseAssignments)
        .where(
          notExists(
            db.select().from(schema.exercises)
              .where(eq(schema.exercises.id, schema.exerciseAssignments.exerciseId))
          )
        );

      return result.rowCount || 0;
    } catch (error: any) {
      console.error("Error cleaning up orphaned assignments:", error);
      throw new Error("Failed to cleanup orphaned assignments");
    }
  }

  // Library methods

  // Categories
  async createLibraryCategory(categoryData: InsertLibraryCategory): Promise<LibraryCategory> {
    try {
      const [category] = await db.insert(schema.libraryCategories)
        .values(categoryData)
        .returning();
      return category;
    } catch (error: any) {
      console.error("Error creating library category:", error);
      throw new Error("Failed to create library category");
    }
  }

  async getLibraryCategories(consultantId?: string): Promise<LibraryCategory[]> {
    try {
      if (consultantId) {
        return await db.select().from(schema.libraryCategories)
          .where(and(
            eq(schema.libraryCategories.isActive, true),
            eq(schema.libraryCategories.createdBy, consultantId)
          ))
          .orderBy(schema.libraryCategories.sortOrder, schema.libraryCategories.name);
      }
      return await db.select().from(schema.libraryCategories)
        .where(eq(schema.libraryCategories.isActive, true))
        .orderBy(schema.libraryCategories.sortOrder, schema.libraryCategories.name);
    } catch (error: any) {
      console.error("Error fetching library categories:", error);
      throw new Error("Failed to fetch library categories");
    }
  }

  async getLibraryCategory(categoryId: string): Promise<LibraryCategory | null> {
    try {
      const [category] = await db.select().from(schema.libraryCategories)
        .where(eq(schema.libraryCategories.id, categoryId));
      return category || null;
    } catch (error: any) {
      console.error("Error fetching library category:", error);
      throw new Error("Failed to fetch library category");
    }
  }

  async updateLibraryCategory(categoryId: string, updates: Partial<InsertLibraryCategory>): Promise<LibraryCategory | null> {
    const [updatedCategory] = await db
      .update(schema.libraryCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.libraryCategories.id, categoryId))
      .returning();

    return updatedCategory || null;
  }

  async deleteLibraryCategory(categoryId: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.libraryCategories)
        .where(eq(schema.libraryCategories.id, categoryId));

      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      console.error("Error deleting library category:", error);
      throw new Error("Failed to delete library category");
    }
  }

  // Category-Client Assignments
  async assignCategoryToClients(categoryId: string, clientIds: string[], consultantId: string): Promise<void> {
    try {
      // First, remove all existing assignments for this category and consultant
      await db.delete(schema.libraryCategoryClientAssignments)
        .where(and(
          eq(schema.libraryCategoryClientAssignments.categoryId, categoryId),
          eq(schema.libraryCategoryClientAssignments.consultantId, consultantId)
        ));

      // Then, add new assignments
      if (clientIds.length > 0) {
        const assignments = clientIds.map(clientId => ({
          categoryId,
          clientId,
          consultantId,
          isVisible: true,
        }));

        await db.insert(schema.libraryCategoryClientAssignments).values(assignments);
      }
    } catch (error: any) {
      console.error("Error assigning category to clients:", error);
      throw new Error("Failed to assign category to clients");
    }
  }

  async getCategoryClientAssignments(categoryId: string, consultantId: string): Promise<LibraryCategoryClientAssignment[]> {
    try {
      const assignments = await db.select()
        .from(schema.libraryCategoryClientAssignments)
        .where(and(
          eq(schema.libraryCategoryClientAssignments.categoryId, categoryId),
          eq(schema.libraryCategoryClientAssignments.consultantId, consultantId)
        ));

      return assignments;
    } catch (error: any) {
      console.error("Error getting category client assignments:", error);
      throw new Error("Failed to get category client assignments");
    }
  }

  async updateCategoryClientVisibility(categoryId: string, clientId: string, consultantId: string, isVisible: boolean): Promise<void> {
    try {
      await db.update(schema.libraryCategoryClientAssignments)
        .set({ isVisible })
        .where(and(
          eq(schema.libraryCategoryClientAssignments.categoryId, categoryId),
          eq(schema.libraryCategoryClientAssignments.clientId, clientId),
          eq(schema.libraryCategoryClientAssignments.consultantId, consultantId)
        ));
    } catch (error: any) {
      console.error("Error updating category client visibility:", error);
      throw new Error("Failed to update category client visibility");
    }
  }

  async getVisibleCategoriesForClient(clientId: string): Promise<LibraryCategory[]> {
    try {
      const categories = await db.select({
        id: schema.libraryCategories.id,
        name: schema.libraryCategories.name,
        description: schema.libraryCategories.description,
        icon: schema.libraryCategories.icon,
        color: schema.libraryCategories.color,
        sortOrder: schema.libraryCategories.sortOrder,
        isActive: schema.libraryCategories.isActive,
        createdBy: schema.libraryCategories.createdBy,
        createdAt: schema.libraryCategories.createdAt,
        updatedAt: schema.libraryCategories.updatedAt,
      })
        .from(schema.libraryCategories)
        .innerJoin(
          schema.libraryCategoryClientAssignments,
          and(
            eq(schema.libraryCategoryClientAssignments.categoryId, schema.libraryCategories.id),
            eq(schema.libraryCategoryClientAssignments.clientId, clientId),
            eq(schema.libraryCategoryClientAssignments.isVisible, true)
          )
        )
        .where(eq(schema.libraryCategories.isActive, true));

      return categories;
    } catch (error: any) {
      console.error("Error getting visible categories for client:", error);
      throw new Error("Failed to get visible categories for client");
    }
  }

  // Subcategories
  async createLibrarySubcategory(subcategoryData: InsertLibrarySubcategory): Promise<LibrarySubcategory> {
    const [subcategory] = await db
      .insert(schema.librarySubcategories)
      .values(subcategoryData)
      .returning();

    return subcategory;
  }

  async getLibrarySubcategories(consultantId?: string): Promise<LibrarySubcategory[]> {
    if (consultantId) {
      return await db
        .select()
        .from(schema.librarySubcategories)
        .where(and(
          eq(schema.librarySubcategories.isActive, true),
          eq(schema.librarySubcategories.createdBy, consultantId)
        ))
        .orderBy(asc(schema.librarySubcategories.sortOrder), asc(schema.librarySubcategories.name));
    }
    return await db
      .select()
      .from(schema.librarySubcategories)
      .where(eq(schema.librarySubcategories.isActive, true))
      .orderBy(asc(schema.librarySubcategories.sortOrder), asc(schema.librarySubcategories.name));
  }

  async getLibrarySubcategoriesByCategory(categoryId: string): Promise<LibrarySubcategory[]> {
    return await db
      .select()
      .from(schema.librarySubcategories)
      .where(and(
        eq(schema.librarySubcategories.categoryId, categoryId),
        eq(schema.librarySubcategories.isActive, true)
      ))
      .orderBy(asc(schema.librarySubcategories.sortOrder), asc(schema.librarySubcategories.name));
  }

  async getLibrarySubcategory(subcategoryId: string): Promise<LibrarySubcategory | null> {
    const [subcategory] = await db
      .select()
      .from(schema.librarySubcategories)
      .where(eq(schema.librarySubcategories.id, subcategoryId));

    return subcategory || null;
  }

  async updateLibrarySubcategory(subcategoryId: string, updates: Partial<InsertLibrarySubcategory>): Promise<LibrarySubcategory | null> {
    const [updatedSubcategory] = await db
      .update(schema.librarySubcategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.librarySubcategories.id, subcategoryId))
      .returning();

    return updatedSubcategory || null;
  }

  async deleteLibrarySubcategory(subcategoryId: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.librarySubcategories)
        .where(eq(schema.librarySubcategories.id, subcategoryId));
      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      console.error("Error deleting library subcategory:", error);
      throw new Error("Failed to delete library subcategory");
    }
  }

  // Documents
  async createLibraryDocument(documentData: InsertLibraryDocument): Promise<LibraryDocument> {
    try {
      console.log("========== STORAGE CREATE DOCUMENT DEBUG START ==========");
      console.log("1. Received documentData in storage:", JSON.stringify(documentData, null, 2));
      console.log("2. documentData.subcategoryId:", documentData.subcategoryId);
      console.log("3. documentData.isPublished:", documentData.isPublished);

      console.log("4. Processing cleanData...");

      // Ensure subcategoryId is properly handled - convert empty string to null
      const subcategoryIdProcessed = documentData.subcategoryId && documentData.subcategoryId.trim() !== '' ? documentData.subcategoryId : null;
      console.log("5. subcategoryId processing:");
      console.log("   - original:", documentData.subcategoryId);
      console.log("   - processed:", subcategoryIdProcessed);

      const cleanData = {
        ...documentData,
        subcategoryId: subcategoryIdProcessed
      };

      console.log("6. Final cleanData being inserted:", JSON.stringify(cleanData, null, 2));
      console.log("7. cleanData.subcategoryId:", cleanData.subcategoryId);
      console.log("8. cleanData.isPublished:", cleanData.isPublished);

      console.log("9. About to insert into database...");

      const [document] = await db.insert(schema.libraryDocuments)
        .values(cleanData)
        .returning();

      console.log("10. Database insertion completed");
      console.log("11. Document returned from database:", JSON.stringify(document, null, 2));
      console.log("12. document.subcategoryId from DB:", document.subcategoryId);
      console.log("13. document.isPublished from DB:", document.isPublished);
      console.log("========== STORAGE CREATE DOCUMENT DEBUG END ==========");

      return document;
    } catch (error: any) {
      console.error("ERROR in storage createLibraryDocument:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      throw new Error("Failed to create library document: " + error.message);
    }
  }

  async getLibraryDocuments(consultantId?: string): Promise<LibraryDocument[]> {
    try {
      if (consultantId) {
        return await db.select().from(schema.libraryDocuments)
          .where(and(
            eq(schema.libraryDocuments.isPublished, true),
            eq(schema.libraryDocuments.createdBy, consultantId)
          ))
          .orderBy(schema.libraryDocuments.createdAt);
      }
      return await db.select().from(schema.libraryDocuments)
        .where(eq(schema.libraryDocuments.isPublished, true))
        .orderBy(schema.libraryDocuments.createdAt);
    } catch (error: any) {
      console.error("Error fetching library documents:", error);
      throw new Error("Failed to fetch library documents");
    }
  }

  async getLibraryDocumentsByCategory(categoryId: string): Promise<LibraryDocument[]> {
    try {
      return await db.select().from(schema.libraryDocuments)
        .where(and(
          eq(schema.libraryDocuments.categoryId, categoryId),
          eq(schema.libraryDocuments.isPublished, true)
        ))
        .orderBy(schema.libraryDocuments.sortOrder, schema.libraryDocuments.title);
    } catch (error: any) {
      console.error("Error fetching library documents by category:", error);
      throw new Error("Failed to fetch library documents by category");
    }
  }

  async getLibraryDocumentsBySubcategory(subcategoryId: string): Promise<LibraryDocument[]> {
    try {
      return await db.select().from(schema.libraryDocuments)
        .where(and(
          eq(schema.libraryDocuments.subcategoryId, subcategoryId),
          eq(schema.libraryDocuments.isPublished, true)
        ))
        .orderBy(schema.libraryDocuments.sortOrder, schema.libraryDocuments.title);
    } catch (error: any) {
      console.error("Error fetching library documents by subcategory:", error);
      throw new Error("Failed to fetch library documents by subcategory");
    }
  }

  async getLibraryDocument(documentId: string): Promise<LibraryDocument | null> {
    try {
      const [document] = await db.select().from(schema.libraryDocuments)
        .where(eq(schema.libraryDocuments.id, documentId));
      return document || null;
    } catch (error: any) {
      console.error("Error fetching library document:", error);
      throw new Error("Failed to fetch library document");
    }
  }

  async updateLibraryDocument(documentId: string, updates: Partial<InsertLibraryDocument>): Promise<LibraryDocument | null> {
    try {
      const [updatedDocument] = await db.update(schema.libraryDocuments)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.libraryDocuments.id, documentId))
        .returning();
      return updatedDocument || null;
    } catch (error: any) {
      console.error("Error updating library document:", error);
      throw new Error("Failed to update library document");
    }
  }

  async deleteLibraryDocument(documentId: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.libraryDocuments)
        .where(eq(schema.libraryDocuments.id, documentId));
      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      console.error("Error deleting library document:", error);
      throw new Error("Failed to delete library document");
    }
  }

  // Document sections
  async createLibraryDocumentSection(sectionData: InsertLibraryDocumentSection): Promise<LibraryDocumentSection> {
    try {
      const [section] = await db.insert(schema.libraryDocumentSections)
        .values(sectionData)
        .returning();
      return section;
    } catch (error: any) {
      console.error("Error creating library document section:", error);
      throw new Error("Failed to create library document section");
    }
  }

  async getLibraryDocumentSections(documentId: string): Promise<LibraryDocumentSection[]> {
    try {
      return await db.select().from(schema.libraryDocumentSections)
        .where(eq(schema.libraryDocumentSections.documentId, documentId))
        .orderBy(schema.libraryDocumentSections.sortOrder);
    } catch (error: any) {
      console.error("Error fetching library document sections:", error);
      throw new Error("Failed to fetch library document sections");
    }
  }

  // Client progress
  async markDocumentAsRead(progressData: InsertClientLibraryProgress): Promise<ClientLibraryProgress> {
    try {
      // Try to update existing progress
      const [existingProgress] = await db.select().from(schema.clientLibraryProgress)
        .where(and(
          eq(schema.clientLibraryProgress.clientId, progressData.clientId),
          eq(schema.clientLibraryProgress.documentId, progressData.documentId)
        ));

      if (existingProgress) {
        const [updatedProgress] = await db.update(schema.clientLibraryProgress)
          .set({
            isRead: progressData.isRead ?? true,
            readAt: progressData.readAt ?? new Date(),
            timeSpent: progressData.timeSpent ?? 0,
            updatedAt: new Date(),
          })
          .where(eq(schema.clientLibraryProgress.id, existingProgress.id))
          .returning();
        return updatedProgress;
      } else {
        // Create new progress record
        const [newProgress] = await db.insert(schema.clientLibraryProgress)
          .values({
            ...progressData,
            isRead: progressData.isRead ?? true,
            readAt: progressData.readAt ?? new Date(),
          })
          .returning();
        return newProgress;
      }
    } catch (error: any) {
      console.error("Error marking document as read:", error);
      throw new Error("Failed to mark document as read");
    }
  }

  async getClientLibraryProgress(clientId: string): Promise<ClientLibraryProgress[]> {
    try {
      return await db.select().from(schema.clientLibraryProgress)
        .where(eq(schema.clientLibraryProgress.clientId, clientId));
    } catch (error: any) {
      console.error("Error fetching client library progress:", error);
      throw new Error("Failed to fetch client library progress");
    }
  }

  // University module implementations
  // Years
  async createUniversityYear(year: InsertUniversityYear): Promise<UniversityYear> {
    try {
      const [newYear] = await db.insert(schema.universityYears)
        .values(year)
        .returning();
      return newYear;
    } catch (error: any) {
      console.error("Error creating university year:", error);
      throw new Error("Failed to create university year");
    }
  }

  async getUniversityYears(consultantId?: string): Promise<UniversityYear[]> {
    try {
      if (consultantId) {
        return await db.select().from(schema.universityYears)
          .where(eq(schema.universityYears.createdBy, consultantId))
          .orderBy(asc(schema.universityYears.sortOrder));
      }
      return await db.select().from(schema.universityYears)
        .orderBy(asc(schema.universityYears.sortOrder));
    } catch (error: any) {
      console.error("Error fetching university years:", error);
      throw new Error("Failed to fetch university years");
    }
  }

  async getUniversityYear(id: string): Promise<UniversityYear | null> {
    try {
      const [year] = await db.select().from(schema.universityYears)
        .where(eq(schema.universityYears.id, id));
      return year || null;
    } catch (error: any) {
      console.error("Error fetching university year:", error);
      throw new Error("Failed to fetch university year");
    }
  }

  async updateUniversityYear(id: string, updates: Partial<InsertUniversityYear>): Promise<UniversityYear | null> {
    try {
      const [updatedYear] = await db.update(schema.universityYears)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.universityYears.id, id))
        .returning();
      return updatedYear || null;
    } catch (error: any) {
      console.error("Error updating university year:", error);
      throw new Error("Failed to update university year");
    }
  }

  async deleteUniversityYear(id: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.universityYears)
        .where(eq(schema.universityYears.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      console.error("Error deleting university year:", error);
      throw new Error("Failed to delete university year");
    }
  }

  // Trimesters
  async createUniversityTrimester(trimester: InsertUniversityTrimester): Promise<UniversityTrimester> {
    try {
      const [newTrimester] = await db.insert(schema.universityTrimesters)
        .values(trimester)
        .returning();
      return newTrimester;
    } catch (error: any) {
      console.error("Error creating university trimester:", error);
      throw new Error("Failed to create university trimester");
    }
  }

  async getUniversityTrimestersByYear(yearId: string): Promise<UniversityTrimester[]> {
    try {
      return await db.select().from(schema.universityTrimesters)
        .where(eq(schema.universityTrimesters.yearId, yearId))
        .orderBy(asc(schema.universityTrimesters.sortOrder));
    } catch (error: any) {
      console.error("Error fetching university trimesters:", error);
      throw new Error("Failed to fetch university trimesters");
    }
  }

  async getUniversityTrimester(id: string): Promise<UniversityTrimester | null> {
    try {
      const [trimester] = await db.select().from(schema.universityTrimesters)
        .where(eq(schema.universityTrimesters.id, id));
      return trimester || null;
    } catch (error: any) {
      console.error("Error fetching university trimester:", error);
      throw new Error("Failed to fetch university trimester");
    }
  }

  async updateUniversityTrimester(id: string, updates: Partial<InsertUniversityTrimester>): Promise<UniversityTrimester | null> {
    try {
      const [updatedTrimester] = await db.update(schema.universityTrimesters)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.universityTrimesters.id, id))
        .returning();
      return updatedTrimester || null;
    } catch (error: any) {
      console.error("Error updating university trimester:", error);
      throw new Error("Failed to update university trimester");
    }
  }

  async deleteUniversityTrimester(id: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.universityTrimesters)
        .where(eq(schema.universityTrimesters.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      console.error("Error deleting university trimester:", error);
      throw new Error("Failed to delete university trimester");
    }
  }

  // Modules
  async createUniversityModule(module: InsertUniversityModule): Promise<UniversityModule> {
    try {
      const [newModule] = await db.insert(schema.universityModules)
        .values(module)
        .returning();
      return newModule;
    } catch (error: any) {
      console.error("Error creating university module:", error);
      throw new Error("Failed to create university module");
    }
  }

  async getUniversityModulesByTrimester(trimesterId: string): Promise<UniversityModule[]> {
    try {
      return await db.select().from(schema.universityModules)
        .where(eq(schema.universityModules.trimesterId, trimesterId))
        .orderBy(asc(schema.universityModules.sortOrder));
    } catch (error: any) {
      console.error("Error fetching university modules:", error);
      throw new Error("Failed to fetch university modules");
    }
  }

  async getUniversityModule(id: string): Promise<UniversityModule | null> {
    try {
      const [module] = await db.select().from(schema.universityModules)
        .where(eq(schema.universityModules.id, id));
      return module || null;
    } catch (error: any) {
      console.error("Error fetching university module:", error);
      throw new Error("Failed to fetch university module");
    }
  }

  async updateUniversityModule(id: string, updates: Partial<InsertUniversityModule>): Promise<UniversityModule | null> {
    try {
      const [updatedModule] = await db.update(schema.universityModules)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.universityModules.id, id))
        .returning();
      return updatedModule || null;
    } catch (error: any) {
      console.error("Error updating university module:", error);
      throw new Error("Failed to update university module");
    }
  }

  async deleteUniversityModule(id: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.universityModules)
        .where(eq(schema.universityModules.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      console.error("Error deleting university module:", error);
      throw new Error("Failed to delete university module");
    }
  }

  // Lessons
  async createUniversityLesson(lesson: InsertUniversityLesson): Promise<UniversityLesson> {
    try {
      const [newLesson] = await db.insert(schema.universityLessons)
        .values(lesson)
        .returning();
      return newLesson;
    } catch (error: any) {
      console.error("Error creating university lesson:", error);
      throw new Error("Failed to create university lesson");
    }
  }

  async getUniversityLessonsByModule(moduleId: string): Promise<UniversityLesson[]> {
    try {
      return await db.select().from(schema.universityLessons)
        .where(eq(schema.universityLessons.moduleId, moduleId))
        .orderBy(asc(schema.universityLessons.sortOrder));
    } catch (error: any) {
      console.error("Error fetching university lessons:", error);
      throw new Error("Failed to fetch university lessons");
    }
  }

  async getUniversityLesson(id: string): Promise<UniversityLesson | null> {
    try {
      const [lesson] = await db.select().from(schema.universityLessons)
        .where(eq(schema.universityLessons.id, id));
      return lesson || null;
    } catch (error: any) {
      console.error("Error fetching university lesson:", error);
      throw new Error("Failed to fetch university lesson");
    }
  }

  async updateUniversityLesson(id: string, updates: Partial<InsertUniversityLesson>): Promise<UniversityLesson | null> {
    try {
      const [updatedLesson] = await db.update(schema.universityLessons)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.universityLessons.id, id))
        .returning();
      return updatedLesson || null;
    } catch (error: any) {
      console.error("Error updating university lesson:", error);
      throw new Error("Failed to update university lesson");
    }
  }

  async deleteUniversityLesson(id: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.universityLessons)
        .where(eq(schema.universityLessons.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      console.error("Error deleting university lesson:", error);
      throw new Error("Failed to delete university lesson");
    }
  }

  // Progress
  async createUniversityProgress(progress: InsertUniversityProgress): Promise<UniversityProgress> {
    try {
      const [newProgress] = await db.insert(schema.universityProgress)
        .values(progress)
        .returning();
      return newProgress;
    } catch (error: any) {
      console.error("Error creating university progress:", error);
      throw new Error("Failed to create university progress");
    }
  }

  async getUniversityProgress(clientId: string, lessonId: string): Promise<UniversityProgress | null> {
    try {
      const [progress] = await db.select().from(schema.universityProgress)
        .where(and(
          eq(schema.universityProgress.clientId, clientId),
          eq(schema.universityProgress.lessonId, lessonId)
        ));
      return progress || null;
    } catch (error: any) {
      console.error("Error fetching university progress:", error);
      throw new Error("Failed to fetch university progress");
    }
  }

  async getUniversityProgressByClient(clientId: string): Promise<UniversityProgress[]> {
    try {
      return await db.select().from(schema.universityProgress)
        .where(eq(schema.universityProgress.clientId, clientId));
    } catch (error: any) {
      console.error("Error fetching university progress by client:", error);
      throw new Error("Failed to fetch university progress by client");
    }
  }

  async updateUniversityProgress(clientId: string, lessonId: string, updates: Partial<InsertUniversityProgress>): Promise<UniversityProgress | null> {
    try {
      // Try to update existing progress
      const [updated] = await db.update(schema.universityProgress)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(
          eq(schema.universityProgress.clientId, clientId),
          eq(schema.universityProgress.lessonId, lessonId)
        ))
        .returning();

      // If no existing progress, create it
      if (!updated) {
        return await this.createUniversityProgress({
          clientId,
          lessonId,
          ...updates,
        });
      }

      return updated;
    } catch (error: any) {
      console.error("Error updating university progress:", error);
      throw new Error("Failed to update university progress");
    }
  }

  // Grades
  async createUniversityGrade(grade: InsertUniversityGrade): Promise<UniversityGrade> {
    try {
      const [newGrade] = await db.insert(schema.universityGrades)
        .values(grade)
        .returning();
      return newGrade;
    } catch (error: any) {
      console.error("Error creating university grade:", error);
      throw new Error("Failed to create university grade");
    }
  }

  async getUniversityGradesByClient(clientId: string): Promise<UniversityGrade[]> {
    try {
      return await db.select().from(schema.universityGrades)
        .where(eq(schema.universityGrades.clientId, clientId));
    } catch (error: any) {
      console.error("Error fetching university grades:", error);
      throw new Error("Failed to fetch university grades");
    }
  }

  async getUniversityGrade(clientId: string, referenceType: string, referenceId: string): Promise<UniversityGrade | null> {
    try {
      const [grade] = await db.select().from(schema.universityGrades)
        .where(and(
          eq(schema.universityGrades.clientId, clientId),
          eq(schema.universityGrades.referenceType, referenceType as "module" | "trimester" | "year"),
          eq(schema.universityGrades.referenceId, referenceId)
        ));
      return grade || null;
    } catch (error: any) {
      console.error("Error fetching university grade:", error);
      throw new Error("Failed to fetch university grade");
    }
  }

  async updateUniversityGrade(id: string, updates: Partial<InsertUniversityGrade>): Promise<UniversityGrade | null> {
    try {
      const [updatedGrade] = await db.update(schema.universityGrades)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.universityGrades.id, id))
        .returning();
      return updatedGrade || null;
    } catch (error: any) {
      console.error("Error updating university grade:", error);
      throw new Error("Failed to update university grade");
    }
  }

  async deleteUniversityGrade(id: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.universityGrades)
        .where(eq(schema.universityGrades.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      console.error("Error deleting university grade:", error);
      throw new Error("Failed to delete university grade");
    }
  }

  // Certificates
  async createUniversityCertificate(certificate: InsertUniversityCertificate): Promise<UniversityCertificate> {
    try {
      const [newCertificate] = await db.insert(schema.universityCertificates)
        .values(certificate)
        .returning();
      return newCertificate;
    } catch (error: any) {
      console.error("Error creating university certificate:", error);
      throw new Error("Failed to create university certificate");
    }
  }

  async getUniversityCertificatesByClient(clientId: string): Promise<UniversityCertificate[]> {
    try {
      return await db.select().from(schema.universityCertificates)
        .where(eq(schema.universityCertificates.clientId, clientId))
        .orderBy(desc(schema.universityCertificates.issuedAt));
    } catch (error: any) {
      console.error("Error fetching university certificates:", error);
      throw new Error("Failed to fetch university certificates");
    }
  }

  async getUniversityCertificate(id: string): Promise<UniversityCertificate | null> {
    try {
      const [certificate] = await db.select().from(schema.universityCertificates)
        .where(eq(schema.universityCertificates.id, id));
      return certificate || null;
    } catch (error: any) {
      console.error("Error fetching university certificate:", error);
      throw new Error("Failed to fetch university certificate");
    }
  }

  // Full university structure with progress
  async getFullUniversityWithProgress(clientId: string, consultantId?: string): Promise<(UniversityYear & {
    trimesters: (UniversityTrimester & {
      modules: (UniversityModule & {
        lessons: (UniversityLesson & {
          progress?: UniversityProgress;
        })[];
        grade?: UniversityGrade;
      })[];
      grade?: UniversityGrade;
    })[];
    grade?: UniversityGrade;
  })[]> {
    try {
      // Get only years assigned to this client
      const years = await this.getYearsForClient(clientId);

      // Get all trimesters
      const trimesters = await db.select().from(schema.universityTrimesters)
        .orderBy(asc(schema.universityTrimesters.sortOrder));

      // Get all modules
      const modules = await db.select().from(schema.universityModules)
        .orderBy(asc(schema.universityModules.sortOrder));

      // Get all lessons
      const lessons = await db.select().from(schema.universityLessons)
        .orderBy(asc(schema.universityLessons.sortOrder));

      // Get all progress for client
      const progress = await db.select().from(schema.universityProgress)
        .where(eq(schema.universityProgress.clientId, clientId));

      // Get all grades for client
      const grades = await db.select().from(schema.universityGrades)
        .where(eq(schema.universityGrades.clientId, clientId));

      // Build the nested structure
      return years.map(year => ({
        ...year,
        grade: grades.find(g => g.referenceType === 'year' && g.referenceId === year.id),
        trimesters: trimesters
          .filter(t => t.yearId === year.id)
          .map(trimester => ({
            ...trimester,
            grade: grades.find(g => g.referenceType === 'trimester' && g.referenceId === trimester.id),
            modules: modules
              .filter(m => m.trimesterId === trimester.id)
              .map(module => ({
                ...module,
                grade: grades.find(g => g.referenceType === 'module' && g.referenceId === module.id),
                lessons: lessons
                  .filter(l => l.moduleId === module.id)
                  .map(lesson => ({
                    ...lesson,
                    progress: progress.find(p => p.lessonId === lesson.id),
                  })),
              })),
          })),
      }));
    } catch (error: any) {
      console.error("Error fetching full university structure:", error);
      throw new Error("Failed to fetch full university structure");
    }
  }

  // Statistics
  async getUniversityStats(clientId: string): Promise<{
    totalLessons: number;
    completedLessons: number;
    completionPercentage: number;
    averageGrade: number | null;
    totalCertificates: number;
  }> {
    try {
      // Get client to find their consultant
      const client = await this.getUser(clientId);
      if (!client || !client.consultantId) {
        return {
          totalLessons: 0,
          completedLessons: 0,
          completionPercentage: 0,
          averageGrade: null,
          totalCertificates: 0,
        };
      }

      // Get only years assigned to this client
      const assignedYears = await db.select({ yearId: schema.universityYearClientAssignments.yearId })
        .from(schema.universityYearClientAssignments)
        .where(eq(schema.universityYearClientAssignments.clientId, clientId));

      const assignedYearIds = assignedYears.map(y => y.yearId);

      if (assignedYearIds.length === 0) {
        return {
          totalLessons: 0,
          completedLessons: 0,
          completionPercentage: 0,
          averageGrade: null,
          totalCertificates: 0,
        };
      }

      // Get all lessons from assigned years only (excluding locked years)
      const allLessonsData = await db.select({
        total: count(),
      })
      .from(schema.universityLessons)
      .innerJoin(schema.universityModules, eq(schema.universityLessons.moduleId, schema.universityModules.id))
      .innerJoin(schema.universityTrimesters, eq(schema.universityModules.trimesterId, schema.universityTrimesters.id))
      .innerJoin(schema.universityYears, eq(schema.universityTrimesters.yearId, schema.universityYears.id))
      .where(
        and(
          inArray(schema.universityYears.id, assignedYearIds),
          eq(schema.universityYears.isLocked, false)
        )
      );

      // Get completed lessons for this client (only from unlocked years)
      const completedData = await db.select({
        completed: count(),
      })
      .from(schema.universityProgress)
      .innerJoin(schema.universityLessons, eq(schema.universityProgress.lessonId, schema.universityLessons.id))
      .innerJoin(schema.universityModules, eq(schema.universityLessons.moduleId, schema.universityModules.id))
      .innerJoin(schema.universityTrimesters, eq(schema.universityModules.trimesterId, schema.universityTrimesters.id))
      .innerJoin(schema.universityYears, eq(schema.universityTrimesters.yearId, schema.universityYears.id))
      .where(
        and(
          eq(schema.universityProgress.clientId, clientId),
          eq(schema.universityProgress.isCompleted, true),
          inArray(schema.universityYears.id, assignedYearIds),
          eq(schema.universityYears.isLocked, false)
        )
      );

      // Get average grade
      const gradeData = await db.select({
        avgGrade: avg(schema.universityGrades.grade),
      })
      .from(schema.universityGrades)
      .where(eq(schema.universityGrades.clientId, clientId));

      // Get total certificates
      const certificateData = await db.select({
        total: count(),
      })
      .from(schema.universityCertificates)
      .where(eq(schema.universityCertificates.clientId, clientId));

      const totalLessons = Number(allLessonsData[0]?.total || 0);
      const completedLessons = Number(completedData[0]?.completed || 0);
      const completionPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const averageGrade = gradeData[0]?.avgGrade ? Number(gradeData[0].avgGrade) : null;
      const totalCertificates = Number(certificateData[0]?.total || 0);

      return {
        totalLessons,
        completedLessons,
        completionPercentage,
        averageGrade,
        totalCertificates,
      };
    } catch (error: any) {
      console.error("Error fetching university stats:", error);
      throw new Error("Failed to fetch university stats");
    }
  }

  // Certificate helper methods
  async getGradesForPeriod(clientId: string, referenceType: "module" | "trimester" | "year", referenceId: string): Promise<UniversityGrade[]> {
    try {
      if (referenceType === "module") {
        // Get all grades for lessons in this module
        const grades = await db.select()
          .from(schema.universityGrades)
          .where(
            and(
              eq(schema.universityGrades.clientId, clientId),
              eq(schema.universityGrades.referenceType, "module"),
              eq(schema.universityGrades.referenceId, referenceId)
            )
          );
        return grades;
      } else if (referenceType === "trimester") {
        // Get all grades for modules in this trimester
        const modules = await db.select()
          .from(schema.universityModules)
          .where(eq(schema.universityModules.trimesterId, referenceId));
        
        const moduleIds = modules.map(m => m.id);
        if (moduleIds.length === 0) return [];
        
        const grades = await db.select()
          .from(schema.universityGrades)
          .where(
            and(
              eq(schema.universityGrades.clientId, clientId),
              eq(schema.universityGrades.referenceType, "module"),
              inArray(schema.universityGrades.referenceId, moduleIds)
            )
          );
        return grades;
      } else {
        // Get all grades for trimesters in this year
        const trimesters = await db.select()
          .from(schema.universityTrimesters)
          .where(eq(schema.universityTrimesters.yearId, referenceId));
        
        const trimesterIds = trimesters.map(t => t.id);
        if (trimesterIds.length === 0) return [];
        
        const grades = await db.select()
          .from(schema.universityGrades)
          .where(
            and(
              eq(schema.universityGrades.clientId, clientId),
              eq(schema.universityGrades.referenceType, "trimester"),
              inArray(schema.universityGrades.referenceId, trimesterIds)
            )
          );
        return grades;
      }
    } catch (error: any) {
      console.error("Error getting grades for period:", error);
      throw new Error("Failed to get grades for period");
    }
  }

  async isPeriodCompleted(clientId: string, referenceType: "module" | "trimester" | "year", referenceId: string): Promise<boolean> {
    try {
      let lessons: any[] = [];

      if (referenceType === "module") {
        // Get all lessons in this module
        lessons = await db.select()
          .from(schema.universityLessons)
          .where(eq(schema.universityLessons.moduleId, referenceId));
      } else if (referenceType === "trimester") {
        // Get all lessons in modules of this trimester
        const modules = await db.select()
          .from(schema.universityModules)
          .where(eq(schema.universityModules.trimesterId, referenceId));
        
        const moduleIds = modules.map(m => m.id);
        if (moduleIds.length === 0) return false;
        
        lessons = await db.select()
          .from(schema.universityLessons)
          .where(inArray(schema.universityLessons.moduleId, moduleIds));
      } else {
        // Get all lessons in trimesters of this year
        const trimesters = await db.select()
          .from(schema.universityTrimesters)
          .where(eq(schema.universityTrimesters.yearId, referenceId));
        
        const trimesterIds = trimesters.map(t => t.id);
        if (trimesterIds.length === 0) return false;
        
        const modules = await db.select()
          .from(schema.universityModules)
          .where(inArray(schema.universityModules.trimesterId, trimesterIds));
        
        const moduleIds = modules.map(m => m.id);
        if (moduleIds.length === 0) return false;
        
        lessons = await db.select()
          .from(schema.universityLessons)
          .where(inArray(schema.universityLessons.moduleId, moduleIds));
      }

      if (lessons.length === 0) return false;

      // Check if all lessons are completed
      const lessonIds = lessons.map(l => l.id);
      const completedProgress = await db.select()
        .from(schema.universityProgress)
        .where(
          and(
            eq(schema.universityProgress.clientId, clientId),
            inArray(schema.universityProgress.lessonId, lessonIds),
            eq(schema.universityProgress.isCompleted, true)
          )
        );

      return completedProgress.length === lessons.length;
    } catch (error: any) {
      console.error("Error checking if period is completed:", error);
      throw new Error("Failed to check if period is completed");
    }
  }

  async calculatePeriodAverage(clientId: string, referenceType: "module" | "trimester" | "year", referenceId: string): Promise<number | null> {
    try {
      const grades = await this.getGradesForPeriod(clientId, referenceType, referenceId);
      
      if (grades.length === 0) return null;
      
      const sum = grades.reduce((acc, grade) => acc + Number(grade.grade), 0);
      const average = sum / grades.length;
      
      return Math.round(average * 100) / 100; // Round to 2 decimal places
    } catch (error: any) {
      console.error("Error calculating period average:", error);
      throw new Error("Failed to calculate period average");
    }
  }

  // Year-Client Assignment methods
  async createYearClientAssignment(assignment: InsertUniversityYearClientAssignment): Promise<UniversityYearClientAssignment> {
    try {
      const [newAssignment] = await db.insert(schema.universityYearClientAssignments)
        .values(assignment)
        .returning();
      return newAssignment;
    } catch (error: any) {
      console.error("Error creating year-client assignment:", error);
      throw new Error("Failed to create year-client assignment");
    }
  }

  async getYearClientAssignments(yearId: string): Promise<any[]> {
    try {
      const assignments = await db.select({
        id: schema.universityYearClientAssignments.id,
        yearId: schema.universityYearClientAssignments.yearId,
        clientId: schema.universityYearClientAssignments.clientId,
        consultantId: schema.universityYearClientAssignments.consultantId,
        assignedAt: schema.universityYearClientAssignments.assignedAt,
        createdAt: schema.universityYearClientAssignments.createdAt,
        client: {
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          email: schema.users.email,
          avatar: schema.users.avatar,
        }
      })
        .from(schema.universityYearClientAssignments)
        .leftJoin(schema.users, eq(schema.universityYearClientAssignments.clientId, schema.users.id))
        .where(eq(schema.universityYearClientAssignments.yearId, yearId));
      return assignments;
    } catch (error: any) {
      console.error("Error fetching year-client assignments:", error);
      throw new Error("Failed to fetch year-client assignments");
    }
  }

  async getClientYearAssignments(clientId: string): Promise<UniversityYearClientAssignment[]> {
    try {
      const assignments = await db.select()
        .from(schema.universityYearClientAssignments)
        .where(eq(schema.universityYearClientAssignments.clientId, clientId));
      return assignments;
    } catch (error: any) {
      console.error("Error fetching client year assignments:", error);
      throw new Error("Failed to fetch client year assignments");
    }
  }

  async deleteYearClientAssignment(yearId: string, clientId: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.universityYearClientAssignments)
        .where(
          and(
            eq(schema.universityYearClientAssignments.yearId, yearId),
            eq(schema.universityYearClientAssignments.clientId, clientId)
          )
        );
      return true;
    } catch (error: any) {
      console.error("Error deleting year-client assignment:", error);
      return false;
    }
  }

  async getYearsForClient(clientId: string): Promise<UniversityYear[]> {
    try {
      const years = await db.select({
        id: schema.universityYears.id,
        templateId: schema.universityYears.templateId,
        title: schema.universityYears.title,
        description: schema.universityYears.description,
        sortOrder: schema.universityYears.sortOrder,
        isLocked: schema.universityYears.isLocked,
        createdBy: schema.universityYears.createdBy,
        createdAt: schema.universityYears.createdAt,
        updatedAt: schema.universityYears.updatedAt,
      })
      .from(schema.universityYears)
      .innerJoin(
        schema.universityYearClientAssignments,
        eq(schema.universityYears.id, schema.universityYearClientAssignments.yearId)
      )
      .where(eq(schema.universityYearClientAssignments.clientId, clientId))
      .orderBy(asc(schema.universityYears.sortOrder));
      
      return years;
    } catch (error: any) {
      console.error("Error fetching years for client:", error);
      throw new Error("Failed to fetch years for client");
    }
  }

  async getCurrentPath(clientId: string): Promise<{
    currentYear: UniversityYear | null;
    currentTrimester: UniversityTrimester | null;
    currentModule: UniversityModule | null;
  }> {
    try {
      // Get all client's progress
      const progress = await db.select()
        .from(schema.universityProgress)
        .where(eq(schema.universityProgress.clientId, clientId));

      // Get all years assigned to client
      const years = await this.getYearsForClient(clientId);
      
      if (years.length === 0) {
        return { currentYear: null, currentTrimester: null, currentModule: null };
      }

      // Find the first incomplete year/trimester/module
      for (const year of years) {
        const trimesters = await this.getUniversityTrimestersByYear(year.id);
        
        for (const trimester of trimesters) {
          const modules = await this.getUniversityModulesByTrimester(trimester.id);
          
          for (const module of modules) {
            const lessons = await this.getUniversityLessonsByModule(module.id);
            const lessonIds = lessons.map(l => l.id);
            
            // Check if any lesson in this module is incomplete
            const incompleteLessons = lessons.filter(lesson => 
              !progress.some(p => p.lessonId === lesson.id && p.isCompleted)
            );
            
            if (incompleteLessons.length > 0) {
              // This is the current module
              return {
                currentYear: year,
                currentTrimester: trimester,
                currentModule: module
              };
            }
          }
        }
      }

      // If all lessons are completed, return the last year/trimester/module
      const lastYear = years[years.length - 1];
      const lastTrimesters = await this.getUniversityTrimestersByYear(lastYear.id);
      const lastTrimester = lastTrimesters[lastTrimesters.length - 1] || null;
      
      let lastModule = null;
      if (lastTrimester) {
        const lastModules = await this.getUniversityModulesByTrimester(lastTrimester.id);
        lastModule = lastModules[lastModules.length - 1] || null;
      }

      return {
        currentYear: lastYear,
        currentTrimester: lastTrimester,
        currentModule: lastModule
      };
    } catch (error: any) {
      console.error("Error getting current path:", error);
      throw new Error("Failed to get current path");
    }
  }

  async getUserFinanceSettings(userId: string): Promise<UserFinanceSettings | null> {
    try {
      const [settings] = await db
        .select()
        .from(schema.userFinanceSettings)
        .where(eq(schema.userFinanceSettings.clientId, userId))
        .limit(1);
      return settings || null;
    } catch (error: any) {
      console.error("Error fetching user finance settings:", error);
      throw new Error("Failed to fetch user finance settings");
    }
  }

  async createUserFinanceSettings(settings: InsertUserFinanceSettings): Promise<UserFinanceSettings> {
    try {
      const [created] = await db
        .insert(schema.userFinanceSettings)
        .values(settings)
        .returning();
      return created;
    } catch (error: any) {
      console.error("Error creating user finance settings:", error);
      throw new Error("Failed to create user finance settings");
    }
  }

  async updateUserFinanceSettings(userId: string, updates: Partial<InsertUserFinanceSettings>): Promise<UserFinanceSettings | null> {
    try {
      const [updated] = await db
        .update(schema.userFinanceSettings)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.userFinanceSettings.clientId, userId))
        .returning();
      return updated || null;
    } catch (error: any) {
      console.error("Error updating user finance settings:", error);
      throw new Error("Failed to update user finance settings");
    }
  }

  async deleteUserFinanceSettings(userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(schema.userFinanceSettings)
        .where(eq(schema.userFinanceSettings.clientId, userId));
      return true;
    } catch (error: any) {
      console.error("Error deleting user finance settings:", error);
      return false;
    }
  }

  async getAllActiveFinanceSettings(): Promise<UserFinanceSettings[]> {
    try {
      const settings = await db
        .select()
        .from(schema.userFinanceSettings)
        .where(eq(schema.userFinanceSettings.isEnabled, true));
      return settings;
    } catch (error: any) {
      console.error("Error fetching all active finance settings:", error);
      return [];
    }
  }

  // Calendar Events operations
  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db.insert(schema.calendarEvents)
      .values([insertEvent])
      .returning();
    return event;
  }

  async getCalendarEventsByUser(userId: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    const conditions = [eq(schema.calendarEvents.userId, userId)];
    
    if (startDate) {
      conditions.push(gte(schema.calendarEvents.start, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(schema.calendarEvents.end, endDate));
    }
    
    return db.select()
      .from(schema.calendarEvents)
      .where(and(...conditions))
      .orderBy(asc(schema.calendarEvents.start));
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    const [event] = await db.select()
      .from(schema.calendarEvents)
      .where(eq(schema.calendarEvents.id, id));
    return event || undefined;
  }

  async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
    const [event] = await db.update(schema.calendarEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.calendarEvents.id, id))
      .returning();
    return event || undefined;
  }

  async deleteCalendarEvent(id: string): Promise<boolean> {
    const result = await db.delete(schema.calendarEvents)
      .where(eq(schema.calendarEvents.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Email Journey Templates operations
  async getEmailJourneyTemplate(dayOfMonth: number): Promise<schema.EmailJourneyTemplate | null> {
    try {
      const [template] = await db.select()
        .from(schema.emailJourneyTemplates)
        .where(
          and(
            eq(schema.emailJourneyTemplates.dayOfMonth, dayOfMonth),
            eq(schema.emailJourneyTemplates.isActive, true)
          )
        );
      return template || null;
    } catch (error: any) {
      console.error(`Error fetching email journey template for day ${dayOfMonth}:`, error);
      return null;
    }
  }

  async getAllEmailJourneyTemplates(): Promise<schema.EmailJourneyTemplate[]> {
    try {
      return await db.select()
        .from(schema.emailJourneyTemplates)
        .where(eq(schema.emailJourneyTemplates.isActive, true))
        .orderBy(asc(schema.emailJourneyTemplates.dayOfMonth));
    } catch (error: any) {
      console.error("Error fetching all email journey templates:", error);
      return [];
    }
  }

  async createEmailJourneyTemplate(templateData: schema.InsertEmailJourneyTemplate): Promise<schema.EmailJourneyTemplate> {
    try {
      const [template] = await db.insert(schema.emailJourneyTemplates)
        .values(templateData)
        .returning();
      return template;
    } catch (error: any) {
      console.error("Error creating email journey template:", error);
      throw error;
    }
  }

  async updateEmailJourneyTemplate(id: string, updates: Partial<schema.InsertEmailJourneyTemplate>): Promise<schema.EmailJourneyTemplate | null> {
    try {
      const [updated] = await db.update(schema.emailJourneyTemplates)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.emailJourneyTemplates.id, id))
        .returning();
      return updated || null;
    } catch (error: any) {
      console.error(`Error updating email journey template ${id}:`, error);
      return null;
    }
  }

  // Consultant Journey Templates operations (custom templates per consultant)
  async getConsultantJourneyTemplate(consultantId: string, dayOfMonth: number): Promise<schema.ConsultantJourneyTemplate | null> {
    try {
      const [template] = await db.select()
        .from(schema.consultantJourneyTemplates)
        .where(
          and(
            eq(schema.consultantJourneyTemplates.consultantId, consultantId),
            eq(schema.consultantJourneyTemplates.dayOfMonth, dayOfMonth),
            eq(schema.consultantJourneyTemplates.isActive, true)
          )
        );
      return template || null;
    } catch (error: any) {
      console.error(`Error fetching consultant journey template for day ${dayOfMonth}:`, error);
      return null;
    }
  }

  async getConsultantJourneyTemplates(consultantId: string): Promise<schema.ConsultantJourneyTemplate[]> {
    try {
      return await db.select()
        .from(schema.consultantJourneyTemplates)
        .where(
          and(
            eq(schema.consultantJourneyTemplates.consultantId, consultantId),
            eq(schema.consultantJourneyTemplates.isActive, true)
          )
        )
        .orderBy(asc(schema.consultantJourneyTemplates.dayOfMonth));
    } catch (error: any) {
      console.error(`Error fetching consultant journey templates:`, error);
      return [];
    }
  }

  async upsertConsultantJourneyTemplate(templateData: schema.InsertConsultantJourneyTemplate): Promise<schema.ConsultantJourneyTemplate> {
    try {
      const existing = await this.getConsultantJourneyTemplate(templateData.consultantId, templateData.dayOfMonth);
      
      if (existing) {
        const [updated] = await db.update(schema.consultantJourneyTemplates)
          .set({ ...templateData, updatedAt: new Date() })
          .where(eq(schema.consultantJourneyTemplates.id, existing.id))
          .returning();
        return updated;
      } else {
        const [created] = await db.insert(schema.consultantJourneyTemplates)
          .values(templateData)
          .returning();
        return created;
      }
    } catch (error: any) {
      console.error(`Error upserting consultant journey template:`, error);
      throw error;
    }
  }

  async deleteConsultantJourneyTemplates(consultantId: string): Promise<void> {
    try {
      await db.delete(schema.consultantJourneyTemplates)
        .where(eq(schema.consultantJourneyTemplates.consultantId, consultantId));
    } catch (error: any) {
      console.error(`Error deleting consultant journey templates:`, error);
      throw error;
    }
  }

  async updateConsultantSmtpBusinessContext(
    consultantId: string, 
    businessContext: string, 
    useCustomTemplates: boolean
  ): Promise<void> {
    try {
      await db.update(schema.consultantSmtpSettings)
        .set({ 
          businessContext, 
          useCustomTemplates,
          lastTemplatesGeneratedAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(schema.consultantSmtpSettings.consultantId, consultantId));
    } catch (error: any) {
      console.error(`Error updating consultant business context:`, error);
      throw error;
    }
  }

  // Client Email Journey Progress operations
  async getClientEmailJourneyProgress(consultantId: string, clientId: string): Promise<schema.ClientEmailJourneyProgress | null> {
    try {
      const [progress] = await db.select()
        .from(schema.clientEmailJourneyProgress)
        .where(
          and(
            eq(schema.clientEmailJourneyProgress.consultantId, consultantId),
            eq(schema.clientEmailJourneyProgress.clientId, clientId)
          )
        );
      return progress || null;
    } catch (error: any) {
      console.error(`Error fetching journey progress for client ${clientId}:`, error);
      return null;
    }
  }

  async upsertClientEmailJourneyProgress(
    consultantId: string,
    clientId: string,
    updates: Partial<schema.InsertClientEmailJourneyProgress & schema.UpdateClientEmailJourneyProgress> & { monthStartDate?: Date }
  ): Promise<schema.ClientEmailJourneyProgress> {
    try {
      // Check if progress exists
      const existing = await this.getClientEmailJourneyProgress(consultantId, clientId);

      if (existing) {
        // Update existing
        const [updated] = await db.update(schema.clientEmailJourneyProgress)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(schema.clientEmailJourneyProgress.id, existing.id))
          .returning();
        return updated;
      } else {
        // Create new
        const [created] = await db.insert(schema.clientEmailJourneyProgress)
          .values({
            consultantId,
            clientId,
            ...updates,
          })
          .returning();
        return created;
      }
    } catch (error: any) {
      console.error(`Error upserting journey progress for client ${clientId}:`, error);
      throw error;
    }
  }

  async getAllClientEmailJourneyProgress(consultantId: string): Promise<schema.ClientEmailJourneyProgress[]> {
    try {
      return await db.select()
        .from(schema.clientEmailJourneyProgress)
        .where(eq(schema.clientEmailJourneyProgress.consultantId, consultantId))
        .orderBy(desc(schema.clientEmailJourneyProgress.updatedAt));
    } catch (error: any) {
      console.error(`Error fetching all journey progress for consultant ${consultantId}:`, error);
      return [];
    }
  }

  // Reset journey if it's a new month (after the last day of the month)
  async resetClientJourneyIfNeeded(consultantId: string, clientId: string): Promise<void> {
    try {
      const progress = await this.getClientEmailJourneyProgress(consultantId, clientId);
      
      if (!progress) {
        return; // No progress to reset
      }

      const now = new Date();
      const monthStart = new Date(progress.monthStartDate);
      
      // Calculate the last day of the month when the journey started
      const lastDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
      
      // Check if it's been more than the last day of that month since journey started
      const daysSinceStart = Math.floor((now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceStart >= lastDayOfMonth) {
        console.log(`🔄 Resetting journey for client ${clientId} - ${lastDayOfMonth} days completed (full month cycle)`);
        await db.update(schema.clientEmailJourneyProgress)
          .set({
            currentDay: 1,
            monthStartDate: now,
            lastEmailSentAt: null,
            lastTemplateUsedId: null,
            lastEmailSubject: null,
            lastEmailBody: null,
            lastEmailActions: [],
            actionsCompletedData: { completed: false, details: [] },
            updatedAt: now,
          })
          .where(eq(schema.clientEmailJourneyProgress.id, progress.id));
      }
    } catch (error: any) {
      console.error(`Error resetting journey for client ${clientId}:`, error);
    }
  }

  // Proactive Leads operations
  async createProactiveLead(data: schema.InsertProactiveLead): Promise<schema.ProactiveLead> {
    try {
      const [lead] = await db.insert(schema.proactiveLeads)
        .values(data)
        .returning();
      return lead;
    } catch (error: any) {
      console.error('Error creating proactive lead:', error);
      throw error;
    }
  }

  async getProactiveLead(id: string, consultantId: string): Promise<schema.ProactiveLead | null> {
    try {
      const [lead] = await db.select()
        .from(schema.proactiveLeads)
        .where(
          and(
            eq(schema.proactiveLeads.id, id),
            eq(schema.proactiveLeads.consultantId, consultantId)
          )
        );
      return lead || null;
    } catch (error: any) {
      console.error(`Error fetching proactive lead ${id}:`, error);
      return null;
    }
  }

  async getAllProactiveLeads(consultantId: string, status?: string): Promise<schema.ProactiveLead[]> {
    try {
      const conditions = [eq(schema.proactiveLeads.consultantId, consultantId)];
      
      if (status) {
        conditions.push(eq(schema.proactiveLeads.status, status));
      }
      
      return await db.select()
        .from(schema.proactiveLeads)
        .where(and(...conditions))
        .orderBy(desc(schema.proactiveLeads.contactSchedule));
    } catch (error: any) {
      console.error(`Error fetching proactive leads for consultant ${consultantId}:`, error);
      return [];
    }
  }

  async updateProactiveLead(
    id: string,
    consultantId: string,
    updates: schema.UpdateProactiveLead
  ): Promise<schema.ProactiveLead | null> {
    try {
      const [updated] = await db.update(schema.proactiveLeads)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(
            eq(schema.proactiveLeads.id, id),
            eq(schema.proactiveLeads.consultantId, consultantId)
          )
        )
        .returning();
      return updated || null;
    } catch (error: any) {
      console.error(`Error updating proactive lead ${id}:`, error);
      throw error;
    }
  }

  async deleteProactiveLead(id: string, consultantId: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.proactiveLeads)
        .where(
          and(
            eq(schema.proactiveLeads.id, id),
            eq(schema.proactiveLeads.consultantId, consultantId)
          )
        )
        .returning();
      return result.length > 0;
    } catch (error: any) {
      console.error(`Error deleting proactive lead ${id}:`, error);
      throw error;
    }
  }

  async getProactiveLeadByPhone(consultantId: string, phoneNumber: string): Promise<schema.ProactiveLead | null> {
    try {
      const [lead] = await db.select()
        .from(schema.proactiveLeads)
        .where(
          and(
            eq(schema.proactiveLeads.consultantId, consultantId),
            eq(schema.proactiveLeads.phoneNumber, phoneNumber)
          )
        );
      return lead || null;
    } catch (error: any) {
      console.error(`Error fetching proactive lead by phone ${phoneNumber}:`, error);
      return null;
    }
  }

  // Marketing Campaigns operations
  async createCampaign(data: schema.InsertMarketingCampaign): Promise<schema.MarketingCampaign> {
    try {
      const [campaign] = await db.insert(schema.marketingCampaigns)
        .values(data)
        .returning();
      return campaign;
    } catch (error: any) {
      console.error('Error creating marketing campaign:', error);
      throw error;
    }
  }

  async getCampaign(id: string, consultantId: string): Promise<schema.MarketingCampaign | null> {
    try {
      const [campaign] = await db.select()
        .from(schema.marketingCampaigns)
        .where(
          and(
            eq(schema.marketingCampaigns.id, id),
            eq(schema.marketingCampaigns.consultantId, consultantId)
          )
        );
      return campaign || null;
    } catch (error: any) {
      console.error(`Error fetching campaign ${id}:`, error);
      return null;
    }
  }

  async getAllCampaigns(consultantId: string, activeOnly: boolean = false): Promise<schema.MarketingCampaign[]> {
    try {
      const conditions = [eq(schema.marketingCampaigns.consultantId, consultantId)];
      if (activeOnly) {
        conditions.push(eq(schema.marketingCampaigns.isActive, true));
      }
      
      return await db.select()
        .from(schema.marketingCampaigns)
        .where(and(...conditions))
        .orderBy(desc(schema.marketingCampaigns.createdAt));
    } catch (error: any) {
      console.error(`Error fetching campaigns for consultant ${consultantId}:`, error);
      return [];
    }
  }

  async updateCampaign(
    id: string,
    consultantId: string,
    updates: schema.UpdateMarketingCampaign
  ): Promise<schema.MarketingCampaign | null> {
    try {
      const [campaign] = await db.update(schema.marketingCampaigns)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(schema.marketingCampaigns.id, id),
            eq(schema.marketingCampaigns.consultantId, consultantId)
          )
        )
        .returning();
      return campaign || null;
    } catch (error: any) {
      console.error(`Error updating campaign ${id}:`, error);
      throw error;
    }
  }

  async deleteCampaign(id: string, consultantId: string): Promise<{ deleted: boolean; softDeleted: boolean }> {
    try {
      // Check if campaign has associated leads
      const [leadCount] = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.proactiveLeads)
        .where(eq(schema.proactiveLeads.campaignId, id));

      if (leadCount && leadCount.count > 0) {
        // Soft delete: mark as inactive instead of deleting
        const result = await db.update(schema.marketingCampaigns)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(schema.marketingCampaigns.id, id),
              eq(schema.marketingCampaigns.consultantId, consultantId)
            )
          )
          .returning();
        
        // Check if update actually modified a row
        if (result.length === 0) {
          return { deleted: false, softDeleted: false };
        }
        return { deleted: true, softDeleted: true };
      } else {
        // Hard delete: no leads associated
        const result = await db.delete(schema.marketingCampaigns)
          .where(
            and(
              eq(schema.marketingCampaigns.id, id),
              eq(schema.marketingCampaigns.consultantId, consultantId)
            )
          )
          .returning();
        return { deleted: result.length > 0, softDeleted: false };
      }
    } catch (error: any) {
      console.error(`Error deleting campaign ${id}:`, error);
      throw error;
    }
  }

  async getCampaignAnalytics(campaignId: string, consultantId: string): Promise<schema.CampaignAnalytics[]> {
    try {
      // Verify campaign belongs to consultant
      const campaign = await this.getCampaign(campaignId, consultantId);
      if (!campaign) {
        return [];
      }

      return await db.select()
        .from(schema.campaignAnalytics)
        .where(eq(schema.campaignAnalytics.campaignId, campaignId))
        .orderBy(desc(schema.campaignAnalytics.date));
    } catch (error: any) {
      console.error(`Error fetching campaign analytics for ${campaignId}:`, error);
      return [];
    }
  }

  async updateCampaignMetrics(campaignId: string): Promise<void> {
    try {
      // Calculate metrics from proactive_leads
      const [metrics] = await db.select({
        totalLeads: sql<number>`count(*)::int`,
        convertedLeads: sql<number>`count(*) FILTER (WHERE status = 'converted')::int`,
      })
        .from(schema.proactiveLeads)
        .where(eq(schema.proactiveLeads.campaignId, campaignId));

      const conversionRate = metrics && metrics.totalLeads > 0
        ? (metrics.convertedLeads / metrics.totalLeads) * 100
        : 0;

      await db.update(schema.marketingCampaigns)
        .set({
          totalLeads: metrics?.totalLeads || 0,
          convertedLeads: metrics?.convertedLeads || 0,
          conversionRate: conversionRate,
          updatedAt: new Date()
        })
        .where(eq(schema.marketingCampaigns.id, campaignId));
    } catch (error: any) {
      console.error(`Error updating campaign metrics for ${campaignId}:`, error);
      throw error;
    }
  }

  async getCampaignWithLeads(campaignId: string, consultantId: string) {
    try {
      const campaign = await this.getCampaign(campaignId, consultantId);
      if (!campaign) {
        return null;
      }

      const leads = await db.select()
        .from(schema.proactiveLeads)
        .where(eq(schema.proactiveLeads.campaignId, campaignId))
        .orderBy(desc(schema.proactiveLeads.createdAt));

      return {
        ...campaign,
        leads
      };
    } catch (error: any) {
      console.error(`Error fetching campaign with leads ${campaignId}:`, error);
      return null;
    }
  }

  async getConsultantWhatsappConfig(consultantId: string, agentConfigId: string): Promise<schema.ConsultantWhatsappConfig | null> {
    try {
      const [config] = await db.select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, agentConfigId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId)
          )
        );
      return config || null;
    } catch (error: any) {
      console.error(`Error fetching WhatsApp config ${agentConfigId}:`, error);
      return null;
    }
  }

  // Encryption helpers for API keys
  private getEncryptionKey(): Buffer {
    const keySource = process.env.ENCRYPTION_KEY || 'replit-lead-import-default-key';
    // Use scrypt to derive a 32-byte key from any input string
    return crypto.scryptSync(keySource, 'salt', 32);
  }

  private encryptApiKey(text: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decryptApiKey(text: string): string {
    const key = this.getEncryptionKey();
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  // Public encryption/decryption methods for credentials
  encryptData(text: string): string {
    return this.encryptApiKey(text);
  }

  decryptData(text: string): string {
    return this.decryptApiKey(text);
  }

  // External API Configuration operations
  async getExternalApiConfig(consultantId: string, configId: string): Promise<ExternalApiConfig | null> {
    try {
      const [config] = await db.select()
        .from(schema.externalApiConfigs)
        .where(
          and(
            eq(schema.externalApiConfigs.id, configId),
            eq(schema.externalApiConfigs.consultantId, consultantId)
          )
        );
      
      if (!config) return null;

      return {
        ...config,
        apiKey: this.decryptApiKey(config.apiKey)
      };
    } catch (error: any) {
      console.error(`Error fetching external API config ${configId}:`, error);
      return null;
    }
  }

  async getAllExternalApiConfigs(consultantId: string): Promise<ExternalApiConfig[]> {
    try {
      const configs = await db.select()
        .from(schema.externalApiConfigs)
        .where(eq(schema.externalApiConfigs.consultantId, consultantId))
        .orderBy(desc(schema.externalApiConfigs.createdAt));

      return configs.map(config => ({
        ...config,
        apiKey: this.decryptApiKey(config.apiKey)
      }));
    } catch (error: any) {
      console.error(`Error fetching external API configs for consultant ${consultantId}:`, error);
      return [];
    }
  }

  async createExternalApiConfig(data: InsertExternalApiConfig): Promise<ExternalApiConfig> {
    try {
      const encryptedData = {
        ...data,
        apiKey: this.encryptApiKey(data.apiKey)
      };

      const [config] = await db.insert(schema.externalApiConfigs)
        .values(encryptedData)
        .returning();

      return {
        ...config,
        apiKey: data.apiKey
      };
    } catch (error: any) {
      console.error('Error creating external API config:', error);
      throw error;
    }
  }

  async updateExternalApiConfig(configId: string, consultantId: string, data: Partial<UpdateExternalApiConfig>): Promise<ExternalApiConfig | null> {
    try {
      const updateData: any = { ...data, updatedAt: new Date() };
      
      if (data.apiKey) {
        updateData.apiKey = this.encryptApiKey(data.apiKey);
      }

      const [config] = await db.update(schema.externalApiConfigs)
        .set(updateData)
        .where(
          and(
            eq(schema.externalApiConfigs.id, configId),
            eq(schema.externalApiConfigs.consultantId, consultantId)
          )
        )
        .returning();

      if (!config) return null;

      return {
        ...config,
        apiKey: data.apiKey || this.decryptApiKey(config.apiKey)
      };
    } catch (error: any) {
      console.error(`Error updating external API config ${configId}:`, error);
      return null;
    }
  }

  async deleteExternalApiConfig(configId: string, consultantId: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.externalApiConfigs)
        .where(
          and(
            eq(schema.externalApiConfigs.id, configId),
            eq(schema.externalApiConfigs.consultantId, consultantId)
          )
        );
      
      return true;
    } catch (error: any) {
      console.error(`Error deleting external API config ${configId}:`, error);
      return false;
    }
  }

  // Webhook Configuration operations
  async getWebhookConfig(consultantId: string, id: string): Promise<WebhookConfig | null> {
    try {
      const [config] = await db.select()
        .from(schema.webhookConfigs)
        .where(
          and(
            eq(schema.webhookConfigs.id, id),
            eq(schema.webhookConfigs.consultantId, consultantId)
          )
        );
      
      return config || null;
    } catch (error: any) {
      console.error(`Error fetching webhook config ${id}:`, error);
      return null;
    }
  }

  async getWebhookConfigBySecret(secretKey: string): Promise<WebhookConfig | null> {
    try {
      const [config] = await db.select()
        .from(schema.webhookConfigs)
        .where(eq(schema.webhookConfigs.secretKey, secretKey));
      
      return config || null;
    } catch (error: any) {
      console.error(`Error fetching webhook config by secret:`, error);
      return null;
    }
  }

  async getAllWebhookConfigs(consultantId: string): Promise<WebhookConfig[]> {
    try {
      const configs = await db.select()
        .from(schema.webhookConfigs)
        .where(eq(schema.webhookConfigs.consultantId, consultantId))
        .orderBy(desc(schema.webhookConfigs.createdAt));

      return configs;
    } catch (error: any) {
      console.error(`Error fetching webhook configs for consultant ${consultantId}:`, error);
      return [];
    }
  }

  async createWebhookConfig(data: InsertWebhookConfig): Promise<WebhookConfig> {
    try {
      const [config] = await db.insert(schema.webhookConfigs)
        .values(data)
        .returning();

      return config;
    } catch (error: any) {
      console.error('Error creating webhook config:', error);
      throw error;
    }
  }

  async updateWebhookConfig(id: string, consultantId: string, data: UpdateWebhookConfig): Promise<WebhookConfig | null> {
    try {
      const updateData: any = { ...data, updatedAt: new Date() };

      const [config] = await db.update(schema.webhookConfigs)
        .set(updateData)
        .where(
          and(
            eq(schema.webhookConfigs.id, id),
            eq(schema.webhookConfigs.consultantId, consultantId)
          )
        )
        .returning();

      return config || null;
    } catch (error: any) {
      console.error(`Error updating webhook config ${id}:`, error);
      return null;
    }
  }

  async deleteWebhookConfig(id: string, consultantId: string): Promise<boolean> {
    try {
      await db.delete(schema.webhookConfigs)
        .where(
          and(
            eq(schema.webhookConfigs.id, id),
            eq(schema.webhookConfigs.consultantId, consultantId)
          )
        );
      
      return true;
    } catch (error: any) {
      console.error(`Error deleting webhook config ${id}:`, error);
      return false;
    }
  }

  async incrementWebhookLeadsCount(id: string): Promise<void> {
    try {
      await db.update(schema.webhookConfigs)
        .set({
          totalLeadsReceived: sql`${schema.webhookConfigs.totalLeadsReceived} + 1`,
          lastWebhookAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.webhookConfigs.id, id));
    } catch (error: any) {
      console.error(`Error incrementing webhook leads count for ${id}:`, error);
    }
  }

  async incrementWebhookSkippedCount(id: string): Promise<void> {
    try {
      await db.update(schema.webhookConfigs)
        .set({
          skippedLeadsCount: sql`${schema.webhookConfigs.skippedLeadsCount} + 1`,
          lastWebhookAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.webhookConfigs.id, id));
    } catch (error: any) {
      console.error(`Error incrementing webhook skipped count for ${id}:`, error);
    }
  }

  // External Lead Import Log operations
  async createExternalLeadImportLog(data: InsertExternalLeadImportLog): Promise<ExternalLeadImportLog> {
    try {
      const [log] = await db.insert(schema.externalLeadImportLogs)
        .values(data)
        .returning();
      
      return log;
    } catch (error: any) {
      console.error('Error creating external lead import log:', error);
      throw error;
    }
  }

  async getExternalLeadImportLogs(configId: string, limit: number = 50): Promise<ExternalLeadImportLog[]> {
    try {
      const logs = await db.select()
        .from(schema.externalLeadImportLogs)
        .where(eq(schema.externalLeadImportLogs.configId, configId))
        .orderBy(desc(schema.externalLeadImportLogs.createdAt))
        .limit(limit);

      return logs;
    } catch (error: any) {
      console.error(`Error fetching import logs for config ${configId}:`, error);
      return [];
    }
  }

  // WhatsApp Vertex AI Settings operations
  // DEPRECATED: These functions now use the unified Vertex configuration
  // instead of the separate whatsapp_vertex_ai_settings table.
  // Priority: 1. SuperAdmin Vertex (if consultant has access) 2. Consultant's vertexAiSettings
  
  async getWhatsAppVertexAISettings(consultantId: string): Promise<WhatsappVertexAiSettings | null> {
    try {
      // NEW UNIFIED APPROACH: Check SuperAdmin Vertex first, then consultant's own vertexAiSettings
      
      // 1. Check if consultant can use SuperAdmin Vertex
      const [consultant] = await db.select({ useSuperadminVertex: schema.users.useSuperadminVertex })
        .from(schema.users)
        .where(eq(schema.users.id, consultantId))
        .limit(1);
      
      if (consultant?.useSuperadminVertex) {
        // Check consultant_vertex_access (default = true if no record exists)
        const [accessRecord] = await db.select({ hasAccess: schema.consultantVertexAccess.hasAccess })
          .from(schema.consultantVertexAccess)
          .where(eq(schema.consultantVertexAccess.consultantId, consultantId))
          .limit(1);
        
        const hasAccess = accessRecord?.hasAccess ?? true;
        
        if (hasAccess) {
          // Get SuperAdmin Vertex config
          const [superadminConfig] = await db.select()
            .from(schema.superadminVertexConfig)
            .where(eq(schema.superadminVertexConfig.enabled, true))
            .limit(1);
          
          if (superadminConfig) {
            console.log(`✅ Using SuperAdmin Vertex AI for WhatsApp (consultant ${consultantId})`);
            return {
              id: superadminConfig.id,
              consultantId: consultantId,
              projectId: superadminConfig.projectId,
              location: superadminConfig.location,
              serviceAccountJson: superadminConfig.serviceAccountJson,
              enabled: true,
              expiresAt: null,
              createdAt: superadminConfig.createdAt,
              updatedAt: superadminConfig.updatedAt,
            } as WhatsappVertexAiSettings;
          }
        }
      }
      
      // 2. Fallback: Check consultant's own vertexAiSettings
      const [vertexSettings] = await db.select()
        .from(schema.vertexAiSettings)
        .where(and(
          eq(schema.vertexAiSettings.userId, consultantId),
          eq(schema.vertexAiSettings.enabled, true)
        ))
        .limit(1);
      
      if (vertexSettings) {
        console.log(`✅ Using consultant's own Vertex AI for WhatsApp (consultant ${consultantId})`);
        return {
          id: vertexSettings.id,
          consultantId: consultantId,
          projectId: vertexSettings.projectId,
          location: vertexSettings.location,
          serviceAccountJson: vertexSettings.serviceAccountJson,
          enabled: true,
          expiresAt: vertexSettings.expiresAt,
          createdAt: vertexSettings.createdAt,
          updatedAt: vertexSettings.updatedAt,
        } as WhatsappVertexAiSettings;
      }
      
      console.log(`⚠️ No Vertex AI configuration found for WhatsApp (consultant ${consultantId})`);
      return null;
    } catch (error: any) {
      console.error(`Error fetching WhatsApp Vertex AI settings for consultant ${consultantId}:`, error);
      return null;
    }
  }

  async saveWhatsAppVertexAISettings(
    consultantId: string,
    settings: { projectId: string; location: string; serviceAccountJson: string; enabled: boolean }
  ): Promise<void> {
    // DEPRECATED: WhatsApp now uses the unified Vertex configuration.
    // This function now saves to vertexAiSettings instead of whatsappVertexAiSettings.
    // Validate JSON format
    try {
      JSON.parse(settings.serviceAccountJson);
    } catch (error) {
      throw new Error('Invalid service account JSON format');
    }
    
    // Save to vertexAiSettings (unified config)
    await db
      .insert(schema.vertexAiSettings)
      .values({
        userId: consultantId,
        projectId: settings.projectId,
        location: settings.location,
        serviceAccountJson: settings.serviceAccountJson,
        enabled: settings.enabled ?? true,
        managedBy: 'self' as const,
        activatedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.vertexAiSettings.userId,
        set: {
          projectId: settings.projectId,
          location: settings.location,
          serviceAccountJson: settings.serviceAccountJson,
          enabled: settings.enabled ?? true,
          updatedAt: new Date(),
        },
      });
    
    console.log(`✅ Saved WhatsApp Vertex AI settings to unified vertexAiSettings (consultant ${consultantId})`);
  }

  async deleteWhatsAppVertexAISettings(consultantId: string): Promise<boolean> {
    // DEPRECATED: WhatsApp now uses the unified Vertex configuration.
    // This function is a no-op since we don't want to delete the unified config
    // which may be used by other features.
    console.log(`⚠️ deleteWhatsAppVertexAISettings is deprecated. Use unified Vertex settings management instead.`);
    return true;
  }

  // WhatsApp Gemini API Keys operations
  async getWhatsAppGeminiApiKeys(consultantId: string): Promise<WhatsappGeminiApiKeys[]> {
    try {
      const keys = await db.select()
        .from(schema.whatsappGeminiApiKeys)
        .where(eq(schema.whatsappGeminiApiKeys.consultantId, consultantId))
        .orderBy(desc(schema.whatsappGeminiApiKeys.createdAt));

      // Return API keys as-is (no decryption needed)
      return keys;
    } catch (error: any) {
      console.error(`Error fetching WhatsApp Gemini API keys for consultant ${consultantId}:`, error);
      return [];
    }
  }

  async addWhatsAppGeminiApiKey(consultantId: string, apiKey: string): Promise<WhatsappGeminiApiKeys> {
    const keyPreview = apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4);
    
    const [created] = await db.insert(schema.whatsappGeminiApiKeys).values({
      consultantId,
      apiKey: apiKey, // Store as plain text (no encryption)
      keyPreview,
      isActive: true,
      usageCount: 0,
    }).returning();

    return created;
  }

  async deleteWhatsAppGeminiApiKey(keyId: string, consultantId: string): Promise<boolean> {
    await db
      .delete(schema.whatsappGeminiApiKeys)
      .where(
        and(
          eq(schema.whatsappGeminiApiKeys.id, keyId),
          eq(schema.whatsappGeminiApiKeys.consultantId, consultantId)
        )
      );
    
    return true;
  }

  async toggleWhatsAppGeminiApiKey(keyId: string, consultantId: string): Promise<WhatsappGeminiApiKeys | null> {
    const key = await db.query.whatsappGeminiApiKeys.findFirst({
      where: and(
        eq(schema.whatsappGeminiApiKeys.id, keyId),
        eq(schema.whatsappGeminiApiKeys.consultantId, consultantId)
      ),
    });
    
    if (!key) return null;
    
    const [updated] = await db
      .update(schema.whatsappGeminiApiKeys)
      .set({ isActive: !key.isActive })
      .where(eq(schema.whatsappGeminiApiKeys.id, keyId))
      .returning();
    
    return updated;
  }

  async updateWhatsAppGeminiKeyUsage(keyId: string): Promise<void> {
    await db
      .update(schema.whatsappGeminiApiKeys)
      .set({
        usageCount: sql`${schema.whatsappGeminiApiKeys.usageCount} + 1`,
        lastUsedAt: sql`now()`,
      })
      .where(eq(schema.whatsappGeminiApiKeys.id, keyId));
  }

  async getWhatsAppGeminiApiKeyLRU(consultantId: string): Promise<WhatsappGeminiApiKeys | null> {
    const key = await db.query.whatsappGeminiApiKeys.findFirst({
      where: and(
        eq(schema.whatsappGeminiApiKeys.consultantId, consultantId),
        eq(schema.whatsappGeminiApiKeys.isActive, true)
      ),
      orderBy: [asc(schema.whatsappGeminiApiKeys.lastUsedAt)],
    });
    
    if (!key) return null;
    
    // Return key as-is (no decryption needed)
    return key;
  }

  // WhatsApp Agent Consultant Chat operations (internal testing/chat)
  // These conversations are SEPARATE from client WhatsApp conversations
  // They are used for consultant-agent internal testing and always use Vertex AI (never Twilio)
  
  async getConsultantAgentConversations(consultantId: string, agentConfigId?: string): Promise<WhatsappAgentConsultantConversation[]> {
    const conditions = [
      eq(schema.whatsappAgentConsultantConversations.consultantId, consultantId),
      isNull(schema.whatsappAgentConsultantConversations.shareId), // Filter out public conversations
    ];
    
    if (agentConfigId) {
      conditions.push(eq(schema.whatsappAgentConsultantConversations.agentConfigId, agentConfigId));
    }

    return db.select()
      .from(schema.whatsappAgentConsultantConversations)
      .where(and(...conditions))
      .orderBy(desc(schema.whatsappAgentConsultantConversations.lastMessageAt));
  }

  async createConsultantAgentConversation(consultantId: string, agentConfigId: string): Promise<WhatsappAgentConsultantConversation> {
    const [conversation] = await db.insert(schema.whatsappAgentConsultantConversations)
      .values({
        consultantId,
        agentConfigId,
        title: null, // Will be set after first message
        messageCount: 0,
      })
      .returning();
    
    return conversation;
  }

  async getConsultantAgentConversation(conversationId: string, consultantId: string): Promise<WhatsappAgentConsultantConversation | null> {
    const [conversation] = await db.select()
      .from(schema.whatsappAgentConsultantConversations)
      .where(
        and(
          eq(schema.whatsappAgentConsultantConversations.id, conversationId),
          eq(schema.whatsappAgentConsultantConversations.consultantId, consultantId)
        )
      )
      .limit(1);
    
    return conversation || null;
  }

  async getConsultantAgentMessages(conversationId: string, consultantId: string): Promise<WhatsappAgentConsultantMessage[]> {
    // Verify the conversation belongs to the consultant
    const conversation = await db.query.whatsappAgentConsultantConversations.findFirst({
      where: and(
        eq(schema.whatsappAgentConsultantConversations.id, conversationId),
        eq(schema.whatsappAgentConsultantConversations.consultantId, consultantId)
      ),
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    return db.select()
      .from(schema.whatsappAgentConsultantMessages)
      .where(eq(schema.whatsappAgentConsultantMessages.conversationId, conversationId))
      .orderBy(asc(schema.whatsappAgentConsultantMessages.createdAt));
  }

  async createConsultantAgentMessage(
    conversationId: string,
    role: 'consultant' | 'agent',
    content: string,
    metadata: any,
    consultantId: string
  ): Promise<WhatsappAgentConsultantMessage> {
    console.log(`\n📩 [CONSULTANT-AGENT-MESSAGE] Creating ${role} message for conversation ${conversationId}`);
    
    // Verify the conversation belongs to the consultant
    const conversation = await db.query.whatsappAgentConsultantConversations.findFirst({
      where: and(
        eq(schema.whatsappAgentConsultantConversations.id, conversationId),
        eq(schema.whatsappAgentConsultantConversations.consultantId, consultantId)
      ),
    });

    if (!conversation) {
      console.error(`❌ [CONSULTANT-AGENT-MESSAGE] Conversation ${conversationId} not found or access denied`);
      throw new Error('Conversation not found or access denied');
    }

    console.log(`✅ [CONSULTANT-AGENT-MESSAGE] Conversation verified - Current messageCount: ${conversation.messageCount}`);

    // Extract transcription, audioUrl and audioDuration from metadata if present
    const transcription = metadata?.transcription || null;
    const audioUrl = metadata?.audioUrl || null;
    const audioDuration = metadata?.audioDuration || null;

    // Insert message
    const [message] = await db.insert(schema.whatsappAgentConsultantMessages)
      .values({
        conversationId,
        role,
        content,
        transcription,
        audioUrl,
        audioDuration,
        metadata: metadata || {},
        status: 'completed',
      })
      .returning();

    console.log(`✅ [CONSULTANT-AGENT-MESSAGE] Message created with ID: ${message.id}`);

    // Update conversation lastMessageAt and messageCount
    console.log(`🔄 [CONSULTANT-AGENT-MESSAGE] Updating conversation metadata...`);
    
    try {
      const updateResult = await db.update(schema.whatsappAgentConsultantConversations)
        .set({
          lastMessageAt: sql`now()`,
          messageCount: sql`${schema.whatsappAgentConsultantConversations.messageCount} + 1`,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.whatsappAgentConsultantConversations.id, conversationId));

      const rowsAffected = updateResult.rowCount || 0;
      
      if (rowsAffected === 0) {
        console.error(`❌ [CONSULTANT-AGENT-MESSAGE] Failed to update conversation metadata - no rows affected`);
        throw new Error('Failed to update conversation metadata');
      }

      console.log(`✅ [CONSULTANT-AGENT-MESSAGE] Conversation metadata updated successfully (${rowsAffected} row affected)`);
      console.log(`   New messageCount: ${conversation.messageCount + 1}, lastMessageAt: updated to now()`);
    } catch (error: any) {
      console.error(`❌ [CONSULTANT-AGENT-MESSAGE] Error updating conversation metadata:`, error);
      throw new Error(`Failed to update conversation metadata: ${error.message}`);
    }

    return message;
  }

  async deleteConsultantAgentConversation(conversationId: string, consultantId: string): Promise<boolean> {
    const result = await db.delete(schema.whatsappAgentConsultantConversations)
      .where(
        and(
          eq(schema.whatsappAgentConsultantConversations.id, conversationId),
          eq(schema.whatsappAgentConsultantConversations.consultantId, consultantId)
        )
      );
    
    return (result.rowCount || 0) > 0;
  }

  async updateConsultantAgentConversationTitle(
    conversationId: string,
    title: string,
    consultantId: string
  ): Promise<WhatsappAgentConsultantConversation | null> {
    const [updated] = await db.update(schema.whatsappAgentConsultantConversations)
      .set({
        title,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(schema.whatsappAgentConsultantConversations.id, conversationId),
          eq(schema.whatsappAgentConsultantConversations.consultantId, consultantId)
        )
      )
      .returning();
    
    return updated || null;
  }

  async incrementConversationMessageCount(conversationId: string): Promise<void> {
    await db.update(schema.whatsappAgentConsultantConversations)
      .set({
        messageCount: sql`${schema.whatsappAgentConsultantConversations.messageCount} + 1`,
        lastMessageAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.whatsappAgentConsultantConversations.id, conversationId));
  }

  /**
   * Clean up empty consultant-agent conversations (messageCount = 0) older than specified hours
   * SECURITY: Only deletes conversations belonging to the specified consultant
   * @param consultantId - ID of the consultant (REQUIRED for data isolation)
   * @param hoursOld - Delete conversations older than this many hours (default: 24)
   * @param agentConfigId - Optional: limit cleanup to specific agent
   * @returns Number of conversations deleted
   */
  async cleanupEmptyConsultantAgentConversations(
    consultantId: string,
    hoursOld: number = 24,
    agentConfigId?: string
  ): Promise<number> {
    console.log(`\n🧹 [CLEANUP] Starting cleanup of empty consultant-agent conversations older than ${hoursOld} hours...`);
    console.log(`🔒 [SECURITY] Scoped to consultant: ${consultantId}${agentConfigId ? `, agent: ${agentConfigId}` : ''}`);
    
    try {
      const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
      
      const conditions = [
        eq(schema.whatsappAgentConsultantConversations.consultantId, consultantId),
        eq(schema.whatsappAgentConsultantConversations.messageCount, 0),
        sql`${schema.whatsappAgentConsultantConversations.createdAt} < ${cutoffDate}`
      ];
      
      if (agentConfigId) {
        conditions.push(eq(schema.whatsappAgentConsultantConversations.agentConfigId, agentConfigId));
      }
      
      const result = await db.delete(schema.whatsappAgentConsultantConversations)
        .where(and(...conditions));
      
      const deletedCount = result.rowCount || 0;
      
      if (deletedCount > 0) {
        console.log(`✅ [CLEANUP] Deleted ${deletedCount} empty conversation(s) for consultant ${consultantId}`);
      } else {
        console.log(`ℹ️  [CLEANUP] No empty conversations to clean up for consultant ${consultantId}`);
      }
      
      return deletedCount;
    } catch (error: any) {
      console.error(`❌ [CLEANUP] Error cleaning up empty conversations:`, error);
      return 0;
    }
  }

  // ===== CLIENT SALES AGENTS OPERATIONS =====

  async getClientSalesAgents(clientId: string): Promise<ClientSalesAgent[]> {
    const agents = await db
      .select()
      .from(schema.clientSalesAgents)
      .where(eq(schema.clientSalesAgents.clientId, clientId))
      .orderBy(desc(schema.clientSalesAgents.createdAt));
    return agents;
  }

  async getClientSalesAgentById(agentId: string): Promise<ClientSalesAgent | null> {
    const [agent] = await db
      .select()
      .from(schema.clientSalesAgents)
      .where(eq(schema.clientSalesAgents.id, agentId));
    return agent || null;
  }

  async getClientSalesAgentByShareToken(shareToken: string): Promise<ClientSalesAgent | null> {
    const [agent] = await db
      .select()
      .from(schema.clientSalesAgents)
      .where(eq(schema.clientSalesAgents.shareToken, shareToken));
    return agent || null;
  }

  async createClientSalesAgent(data: InsertClientSalesAgent): Promise<ClientSalesAgent> {
    const [agent] = await db
      .insert(schema.clientSalesAgents)
      .values(data)
      .returning();
    return agent;
  }

  async updateClientSalesAgent(agentId: string, data: Partial<InsertClientSalesAgent>): Promise<ClientSalesAgent | null> {
    const [updated] = await db
      .update(schema.clientSalesAgents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.clientSalesAgents.id, agentId))
      .returning();
    return updated || null;
  }

  async deleteClientSalesAgent(agentId: string): Promise<boolean> {
    const result = await db
      .delete(schema.clientSalesAgents)
      .where(eq(schema.clientSalesAgents.id, agentId));
    return (result.rowCount || 0) > 0;
  }

  // ===== CLIENT SALES CONVERSATIONS OPERATIONS =====

  async getClientSalesConversations(agentId: string): Promise<ClientSalesConversation[]> {
    const conversations = await db
      .select()
      .from(schema.clientSalesConversations)
      .where(eq(schema.clientSalesConversations.agentId, agentId))
      .orderBy(desc(schema.clientSalesConversations.createdAt));
    return conversations;
  }

  async getClientSalesConversationById(conversationId: string): Promise<ClientSalesConversation | null> {
    const [conversation] = await db
      .select()
      .from(schema.clientSalesConversations)
      .where(eq(schema.clientSalesConversations.id, conversationId));
    return conversation || null;
  }

  async createClientSalesConversation(data: InsertClientSalesConversation): Promise<ClientSalesConversation> {
    const [conversation] = await db
      .insert(schema.clientSalesConversations)
      .values(data)
      .returning();
    return conversation;
  }

  async updateClientSalesConversation(conversationId: string, data: Partial<InsertClientSalesConversation>): Promise<ClientSalesConversation | null> {
    const [updated] = await db
      .update(schema.clientSalesConversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.clientSalesConversations.id, conversationId))
      .returning();
    return updated || null;
  }

  async deleteClientSalesConversation(conversationId: string): Promise<boolean> {
    const result = await db
      .delete(schema.clientSalesConversations)
      .where(eq(schema.clientSalesConversations.id, conversationId));
    return (result.rowCount || 0) > 0;
  }

  async deleteAiConversation(aiConversationId: string): Promise<boolean> {
    const result = await db
      .delete(schema.aiConversations)
      .where(eq(schema.aiConversations.id, aiConversationId));
    return (result.rowCount || 0) > 0;
  }

  async getAiMessagesByConversation(aiConversationId: string): Promise<AiMessage[]> {
    const messages = await db
      .select()
      .from(schema.aiMessages)
      .where(eq(schema.aiMessages.conversationId, aiConversationId))
      .orderBy(schema.aiMessages.createdAt);
    return messages;
  }

  // ===== CLIENT SALES KNOWLEDGE OPERATIONS =====

  async getClientSalesKnowledge(agentId: string): Promise<ClientSalesKnowledge[]> {
    const knowledge = await db
      .select()
      .from(schema.clientSalesKnowledge)
      .where(eq(schema.clientSalesKnowledge.agentId, agentId))
      .orderBy(desc(schema.clientSalesKnowledge.createdAt));
    return knowledge;
  }

  async getClientSalesKnowledgeById(knowledgeId: string): Promise<ClientSalesKnowledge | null> {
    const [item] = await db
      .select()
      .from(schema.clientSalesKnowledge)
      .where(eq(schema.clientSalesKnowledge.id, knowledgeId));
    return item || null;
  }

  async createClientSalesKnowledge(data: InsertClientSalesKnowledge): Promise<ClientSalesKnowledge> {
    const [knowledge] = await db
      .insert(schema.clientSalesKnowledge)
      .values(data)
      .returning();
    return knowledge;
  }

  async deleteClientSalesKnowledge(knowledgeId: string): Promise<boolean> {
    const result = await db
      .delete(schema.clientSalesKnowledge)
      .where(eq(schema.clientSalesKnowledge.id, knowledgeId));
    return (result.rowCount || 0) > 0;
  }

  // ===== CONSULTATION INVITES OPERATIONS =====

  async getConsultationInvitesByAgent(agentId: string): Promise<ConsultationInvite[]> {
    const invites = await db
      .select()
      .from(schema.consultationInvites)
      .where(eq(schema.consultationInvites.agentId, agentId))
      .orderBy(desc(schema.consultationInvites.createdAt));
    return invites;
  }

  async getConsultationInviteByToken(inviteToken: string): Promise<ConsultationInvite | null> {
    const [invite] = await db
      .select()
      .from(schema.consultationInvites)
      .where(eq(schema.consultationInvites.inviteToken, inviteToken));
    return invite || null;
  }

  async createConsultationInvite(data: InsertConsultationInvite): Promise<ConsultationInvite> {
    const [invite] = await db
      .insert(schema.consultationInvites)
      .values(data)
      .returning();
    return invite;
  }

  async updateConsultationInvite(inviteToken: string, data: Partial<Omit<InsertConsultationInvite, 'inviteToken' | 'agentId'>>): Promise<ConsultationInvite | null> {
    const [updated] = await db
      .update(schema.consultationInvites)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.consultationInvites.inviteToken, inviteToken))
      .returning();
    return updated || null;
  }

  async deleteConsultationInvite(inviteToken: string): Promise<boolean> {
    const result = await db
      .delete(schema.consultationInvites)
      .where(eq(schema.consultationInvites.inviteToken, inviteToken));
    return (result.rowCount || 0) > 0;
  }

  async trackConsultationInviteAccess(inviteToken: string): Promise<void> {
    await db
      .update(schema.consultationInvites)
      .set({
        accessCount: sql<number>`${schema.consultationInvites.accessCount} + 1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(schema.consultationInvites.inviteToken, inviteToken));
  }

  // ===== GEMINI SESSION HANDLES OPERATIONS =====

  async saveGeminiSessionHandle(data: InsertGeminiSessionHandle): Promise<GeminiSessionHandle> {
    // SECURITY: For consulente mode, consultantType is REQUIRED to prevent cross-specialist sharing
    if (data.mode === 'consulente' && !data.consultantType) {
      throw new Error('consultantType is required for consulente mode to ensure session isolation');
    }
    
    const [handle] = await db
      .insert(schema.geminiSessionHandles)
      .values(data)
      .onConflictDoUpdate({
        target: schema.geminiSessionHandles.handle,
        set: {
          userId: data.userId,
          shareToken: data.shareToken,
          inviteToken: data.inviteToken,
          conversationId: data.conversationId,
          mode: data.mode,
          consultantType: data.consultantType,
          createdAt: new Date(),
        },
      })
      .returning();
    return handle;
  }

  async validateGeminiSessionHandle(
    handle: string,
    mode: 'assistenza' | 'consulente' | 'sales_agent' | 'consultation_invite',
    userId?: string,
    shareToken?: string,
    conversationId?: string,
    consultantType?: 'finanziario' | 'vendita' | 'business',
    inviteToken?: string
  ): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(schema.geminiSessionHandles)
      .where(eq(schema.geminiSessionHandles.handle, handle));

    if (!existing) {
      return false;
    }

    if (existing.mode !== mode) {
      console.warn(`🚨 [SESSION HANDLE VALIDATION] Mode mismatch: expected ${mode}, got ${existing.mode}`);
      return false;
    }

    if (mode === 'sales_agent') {
      // SECURITY: Reject if identifiers are missing
      if (!shareToken || !conversationId) {
        console.warn(`🚨 [SESSION HANDLE VALIDATION] Sales agent missing required identifiers`);
        console.warn(`   → shareToken: ${shareToken ? 'present' : 'MISSING'}`);
        console.warn(`   → conversationId: ${conversationId ? 'present' : 'MISSING'}`);
        return false;
      }
      
      const isValid = existing.shareToken === shareToken && existing.conversationId === conversationId;
      if (!isValid) {
        console.warn(`🚨 [SESSION HANDLE VALIDATION] Sales agent ownership mismatch`);
        console.warn(`   → Expected: shareToken=${shareToken}, conversationId=${conversationId}`);
        console.warn(`   → Found: shareToken=${existing.shareToken}, conversationId=${existing.conversationId}`);
      }
      return isValid;
    } else if (mode === 'consultation_invite') {
      // SECURITY: Reject if identifiers are missing
      if (!inviteToken || !conversationId) {
        console.warn(`🚨 [SESSION HANDLE VALIDATION] Consultation invite missing required identifiers`);
        console.warn(`   → inviteToken: ${inviteToken ? 'present' : 'MISSING'}`);
        console.warn(`   → conversationId: ${conversationId ? 'present' : 'MISSING'}`);
        return false;
      }
      
      const isValid = existing.inviteToken === inviteToken && existing.conversationId === conversationId;
      if (!isValid) {
        console.warn(`🚨 [SESSION HANDLE VALIDATION] Consultation invite ownership mismatch`);
        console.warn(`   → Expected: inviteToken=${inviteToken}, conversationId=${conversationId}`);
        console.warn(`   → Found: inviteToken=${existing.inviteToken}, conversationId=${existing.conversationId}`);
      }
      return isValid;
    } else {
      // SECURITY: Reject if userId is missing
      if (!userId) {
        console.warn(`🚨 [SESSION HANDLE VALIDATION] Missing userId for authenticated mode`);
        return false;
      }
      
      // Check userId match
      if (existing.userId !== userId) {
        console.warn(`🚨 [SESSION HANDLE VALIDATION] User ownership mismatch`);
        console.warn(`   → Expected userId: ${userId}`);
        console.warn(`   → Found userId: ${existing.userId}`);
        return false;
      }
      
      // SECURITY: For consulente mode, also check consultantType to prevent cross-specialist sharing
      if (mode === 'consulente') {
        // CRITICAL: Check for null/undefined first - reject legacy data immediately
        if (!existing.consultantType) {
          console.warn(`🚨 [SESSION HANDLE VALIDATION] Legacy handle with null consultantType - rejecting for security`);
          console.warn(`   → Expected consultantType: ${consultantType}`);
          console.warn(`   → Found consultantType: null/undefined (legacy data)`);
          console.warn(`   → This prevents cross-specialist session sharing via legacy handles`);
          return false;
        }
        
        // Now safely compare non-null values - strict equality required
        if (existing.consultantType !== consultantType) {
          console.warn(`🚨 [SESSION HANDLE VALIDATION] Consultant type mismatch`);
          console.warn(`   → Expected consultantType: ${consultantType}`);
          console.warn(`   → Found consultantType: ${existing.consultantType}`);
          return false;
        }
      }
      
      return true;
    }
  }

  async deleteGeminiSessionHandle(handle: string): Promise<boolean> {
    const result = await db
      .delete(schema.geminiSessionHandles)
      .where(eq(schema.geminiSessionHandles.handle, handle));
    return (result.rowCount || 0) > 0;
  }

  async cleanupOldGeminiSessionHandles(maxAgeMinutes: number = 90): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const result = await db
      .delete(schema.geminiSessionHandles)
      .where(sql`${schema.geminiSessionHandles.createdAt} < ${cutoffTime}`);
    return result.rowCount || 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // User Role Profiles operations (Email Condivisa feature)
  // ═══════════════════════════════════════════════════════════════════════════

  async getUserRoleProfiles(userId: string): Promise<UserRoleProfile[]> {
    return db.select().from(schema.userRoleProfiles)
      .where(and(
        eq(schema.userRoleProfiles.userId, userId),
        eq(schema.userRoleProfiles.isActive, true)
      ))
      .orderBy(desc(schema.userRoleProfiles.isDefault));
  }

  async getUserRoleProfilesByEmail(email: string): Promise<UserRoleProfile[]> {
    const user = await this.getUserByEmail(email);
    if (!user) return [];
    return this.getUserRoleProfiles(user.id);
  }

  async getUserRoleProfileById(profileId: string): Promise<UserRoleProfile | null> {
    const [profile] = await db.select().from(schema.userRoleProfiles)
      .where(eq(schema.userRoleProfiles.id, profileId));
    return profile || null;
  }

  async createUserRoleProfile(profile: InsertUserRoleProfile): Promise<UserRoleProfile> {
    const [created] = await db.insert(schema.userRoleProfiles)
      .values([profile])
      .returning();
    return created;
  }

  async setDefaultProfile(userId: string, profileId: string): Promise<void> {
    // First, set all profiles for this user to non-default
    await db.update(schema.userRoleProfiles)
      .set({ isDefault: false })
      .where(eq(schema.userRoleProfiles.userId, userId));
    
    // Then, set the specified profile as default
    await db.update(schema.userRoleProfiles)
      .set({ isDefault: true })
      .where(and(
        eq(schema.userRoleProfiles.id, profileId),
        eq(schema.userRoleProfiles.userId, userId)
      ));
  }
}

export const storage = new DatabaseStorage();
