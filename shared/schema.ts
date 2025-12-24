import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, bigint, timestamp, json, jsonb, date, real, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Placeholder for generateId function if it's defined elsewhere and used.
// For this example, we'll assume it's not critical for the schema definition itself.
const generateId = () => `temp_id_${Math.random().toString(36).substring(2, 15)}`;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().$type<"consultant" | "client" | "super_admin">(),
  avatar: text("avatar"),
  phoneNumber: text("phone_number"),
  consultantId: varchar("consultant_id"),
  isActive: boolean("is_active").default(true).notNull(),
  enrolledAt: timestamp("enrolled_at"), // When client was enrolled/joined
  level: text("level").$type<"studente" | "esperto" | "mentor" | "master">().default("studente"), // Gamification level
  geminiApiKeys: jsonb("gemini_api_keys").$type<string[]>().default(sql`'[]'::jsonb`), // Array of up to 10 Gemini API keys for rotation (custom provider only)
  geminiApiKeyIndex: integer("gemini_api_key_index").default(0), // Current index for API key rotation
  preferredAiProvider: text("preferred_ai_provider").$type<"vertex_admin" | "google_studio" | "custom" | "vertex_self">().default("vertex_admin"), // AI provider preference: vertex_admin (default Vertex AI), google_studio (fallback Google AI Studio), custom (client's own Google AI Studio API keys), vertex_self (client's own Vertex AI)
  encryptionSalt: text("encryption_salt"), // Unique salt for per-consultant encryption key derivation (only for consultants)
  googleClientId: text("google_client_id"), // Google OAuth Client ID for video meeting authentication (consultant-level)

  // Google Drive Integration (for clients to connect their own Drive)
  googleDriveRefreshToken: text("google_drive_refresh_token"),
  googleDriveAccessToken: text("google_drive_access_token"),
  googleDriveTokenExpiresAt: timestamp("google_drive_token_expires_at"),
  googleDriveConnectedAt: timestamp("google_drive_connected_at"),
  googleDriveEmail: text("google_drive_email"),

  // Twilio Configuration (consultant-level centralized settings)
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioWhatsappNumber: text("twilio_whatsapp_number"),

  // Vertex AI Inheritance - consultants can use SuperAdmin's Vertex or their own
  useSuperadminVertex: boolean("use_superadmin_vertex").default(true), // If true, consultant uses SuperAdmin's Vertex; if false, uses their own

  // Gemini AI Inheritance - consultants can use SuperAdmin's Gemini API keys or their own
  useSuperadminGemini: boolean("use_superadmin_gemini").default(true), // If true, consultant uses SuperAdmin's Gemini; if false, uses their own

  // External Services Configuration
  siteUrl: text("site_url"), // Custom site URL for SiteAle external service (e.g., client's website)

  createdAt: timestamp("created_at").default(sql`now()`),
});

export const exercises = pgTable("exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().$type<"general" | "personalized">(),
  category: text("category").notNull().$type<"post-consulenza" | "newsletter" | "finanza-personale" | "vendita" | "marketing" | "imprenditoria" | "risparmio-investimenti" | "contabilità" | "gestione-risorse" | "strategia" | "metodo-turbo" | "metodo-hybrid">(),
  estimatedDuration: integer("estimated_duration"), // in minutes
  instructions: text("instructions"),
  attachments: json("attachments").$type<string[]>().default([]),
  questions: json("questions").$type<Question[]>().default([]),
  workPlatform: text("work_platform"), // Link to work platform (Google Sheets, etc.)
  libraryDocumentId: varchar("library_document_id").references(() => libraryDocuments.id), // Link to library document
  templateId: varchar("template_id").references(() => exerciseTemplates.id), // Link to template if created from template
  isPublic: boolean("is_public").default(false),
  createdBy: varchar("created_by").references(() => users.id).notNull(),

  // Exam-specific fields
  isExam: boolean("is_exam").default(false),
  examDate: timestamp("exam_date"),
  yearId: varchar("year_id").references(() => universityYears.id),
  trimesterId: varchar("trimester_id").references(() => universityTrimesters.id),
  autoCorrect: boolean("auto_correct").default(false), // Enable auto-correction for closed questions
  totalPoints: integer("total_points"), // Total points for the exam
  passingScore: integer("passing_score"), // Minimum score to pass
  examTimeLimit: integer("exam_time_limit"), // Overall exam time limit in minutes

  createdAt: timestamp("created_at").default(sql`now()`),
});

export const exerciseAssignments = pgTable("exercise_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: varchar("exercise_id").references(() => exercises.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(),
  assignedAt: timestamp("assigned_at").default(sql`now()`),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().$type<"pending" | "in_progress" | "submitted" | "in_review" | "completed" | "rejected" | "returned">().default("pending"),
  completedAt: timestamp("completed_at"),
  submittedAt: timestamp("submitted_at"),
  reviewedAt: timestamp("reviewed_at"),
  score: integer("score"),
  consultantFeedback: jsonb("consultant_feedback").$type<Array<{ feedback: string; timestamp: string }>>().default(sql`'[]'::jsonb`),
  whatsappSent: boolean("whatsapp_sent").default(false),
  workPlatform: text("work_platform"), // Custom work platform link for this specific assignment

  // Exam-specific fields
  autoGradedScore: integer("auto_graded_score"), // Auto-graded score before consultant review
  questionGrades: jsonb("question_grades").$type<Array<{ questionId: string; score: number; maxScore: number; isCorrect?: boolean; feedback?: string }>>().default(sql`'[]'::jsonb`),
  examStartedAt: timestamp("exam_started_at"), // When student started the exam
  examSubmittedAt: timestamp("exam_submitted_at"), // When student submitted the exam
});

export const exerciseSubmissions = pgTable("exercise_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").references(() => exerciseAssignments.id, { onDelete: "cascade" }).notNull(),
  answers: json("answers").$type<Array<{ questionId: string; answer: string | string[]; uploadedFiles?: string[] }>>().default([]),
  attachments: json("attachments").$type<string[]>().default([]),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at"), // Nullable to support drafts
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const exerciseRevisionHistory = pgTable("exercise_revision_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").references(() => exerciseAssignments.id).notNull(),
  submissionId: varchar("submission_id").references(() => exerciseSubmissions.id),
  action: text("action").notNull().$type<"submitted" | "approved" | "rejected" | "returned">(),
  consultantFeedback: text("consultant_feedback"),
  clientNotes: text("client_notes"),
  score: integer("score"),
  previousStatus: text("previous_status").notNull().$type<"pending" | "in_progress" | "submitted" | "in_review" | "completed" | "rejected" | "returned">(),
  newStatus: text("new_status").notNull().$type<"pending" | "in_progress" | "submitted" | "in_review" | "completed" | "rejected" | "returned">(),
  createdAt: timestamp("created_at").default(sql`now()`),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
});

export const consultations = pgTable("consultations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").notNull(), // in minutes
  notes: text("notes"),
  status: text("status").notNull().$type<"scheduled" | "completed" | "cancelled">().default("scheduled"),
  googleMeetLink: text("google_meet_link"),
  fathomShareLink: text("fathom_share_link"),
  transcript: text("transcript"), // Trascrizione completa da Fathom
  summaryEmail: text("summary_email"), // Email di riepilogo generata dall'AI (finale approvata)
  summaryEmailGeneratedAt: timestamp("summary_email_generated_at"), // Quando è stata generata
  googleCalendarEventId: text("google_calendar_event_id"),
  
  // Echo System - Email Status Tracking
  summaryEmailStatus: text("summary_email_status").$type<"missing" | "draft" | "approved" | "sent" | "discarded">().default("missing"),
  summaryEmailDraft: jsonb("summary_email_draft").$type<{
    subject: string;
    body: string;
    extractedTasks: Array<{
      title: string;
      description: string | null;
      dueDate: string | null;
      priority: "low" | "medium" | "high" | "urgent";
      category: "preparation" | "follow-up" | "exercise" | "goal" | "reminder";
    }>;
  }>(),
  summaryEmailApprovedAt: timestamp("summary_email_approved_at"),
  summaryEmailSentAt: timestamp("summary_email_sent_at"),
  
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const goals = pgTable("goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetValue: text("target_value").notNull(),
  currentValue: text("current_value").default("0"),
  unit: text("unit"),
  targetDate: timestamp("target_date"),
  status: text("status").notNull().$type<"active" | "completed" | "paused">().default("active"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const clientProgress = pgTable("client_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  exercisesCompleted: integer("exercises_completed").default(0),
  totalExercises: integer("total_exercises").default(0),
  streakDays: integer("streak_days").default(0),
  notes: text("notes"),
});

// Analytics tables
export const clientEngagementMetrics = pgTable("client_engagement_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  loginCount: integer("login_count").default(0),
  sessionDuration: integer("session_duration").default(0), // in minutes
  exercisesViewed: integer("exercises_viewed").default(0),
  exercisesStarted: integer("exercises_started").default(0),
  exercisesCompleted: integer("exercises_completed").default(0),
  messagesReceived: integer("messages_received").default(0),
  messagesRead: integer("messages_read").default(0),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const exercisePerformanceMetrics = pgTable("exercise_performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: varchar("exercise_id").references(() => exercises.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  assignmentId: varchar("assignment_id").references(() => exerciseAssignments.id).notNull(),
  submissionId: varchar("submission_id").references(() => exerciseSubmissions.id),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  timeSpent: integer("time_spent"), // in minutes
  difficultyRating: integer("difficulty_rating"), // 1-5 scale
  satisfactionRating: integer("satisfaction_rating"), // 1-5 scale
  score: integer("score"), // percentage or points
  attempts: integer("attempts").default(1),
  hintsUsed: integer("hints_used").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const consultantAnalytics = pgTable("consultant_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(),
  period: text("period").notNull().$type<"daily" | "weekly" | "monthly">(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalClients: integer("total_clients").default(0),
  activeClients: integer("active_clients").default(0),
  newClients: integer("new_clients").default(0),
  exercisesCreated: integer("exercises_created").default(0),
  exercisesAssigned: integer("exercises_assigned").default(0),
  exercisesCompleted: integer("exercises_completed").default(0),
  totalCompletionRate: integer("total_completion_rate").default(0), // percentage
  avgClientEngagement: integer("avg_client_engagement").default(0), // percentage
  totalConsultations: integer("total_consultations").default(0),
  consultationDuration: integer("consultation_duration").default(0), // in minutes
  clientRetentionRate: integer("client_retention_rate").default(0), // percentage
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const clientAnalyticsSummary = pgTable("client_analytics_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(),
  period: text("period").notNull().$type<"daily" | "weekly" | "monthly">(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalExercisesAssigned: integer("total_exercises_assigned").default(0),
  totalExercisesCompleted: integer("total_exercises_completed").default(0),
  completionRate: integer("completion_rate").default(0), // percentage
  avgCompletionTime: integer("avg_completion_time").default(0), // in minutes
  avgScore: integer("avg_score").default(0), // percentage
  avgDifficultyRating: integer("avg_difficulty_rating").default(0), // 1-5 scale
  avgSatisfactionRating: integer("avg_satisfaction_rating").default(0), // 1-5 scale
  totalSessionTime: integer("total_session_time").default(0), // in minutes
  loginFrequency: integer("login_frequency").default(0), // days per week
  engagementScore: integer("engagement_score").default(0), // 0-100 scale
  streakDays: integer("streak_days").default(0),
  goalsSet: integer("goals_set").default(0),
  goalsAchieved: integer("goals_achieved").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Define Question type for clarity, assuming it's used in exercises and templates
export type Question = {
  id: string;
  question: string;
  type: "text" | "number" | "select" | "multiple_choice" | "true_false" | "multiple_answer" | "file_upload";
  options?: string[];
  correctAnswers?: string[]; // For auto-grading (multiple choice, true/false, multiple answer)
  points?: number; // Custom points for this question
  timeLimit?: number; // Time limit in seconds for this question
  allowFileUpload?: boolean; // Whether file upload is allowed
};

export const exerciseTemplates = pgTable("exercise_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().$type<"post-consulenza" | "newsletter" | "finanza-personale" | "vendita" | "marketing" | "imprenditoria" | "risparmio-investimenti" | "contabilità" | "gestione-risorse" | "strategia">(),
  type: text("type").notNull().$type<"general" | "personalized">(),
  estimatedDuration: integer("estimated_duration"), // in minutes
  timeLimit: integer("time_limit"), // in minutes, optional
  instructions: text("instructions"),
  questions: json("questions").$type<Question[]>().default([]),
  workPlatform: text("work_platform"), // Link to work platform (e.g., Google Sheets, Notion)
  libraryDocumentId: varchar("library_document_id").references(() => libraryDocuments.id), // Link to library document
  tags: json("tags").$type<string[]>().default([]),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const templateClientAssociations = pgTable("template_client_associations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => exerciseTemplates.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Activity Log Tables
export const userActivityLogs = pgTable("user_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  activityType: text("activity_type").notNull().$type<"login" | "logout" | "exercise_start" | "exercise_view" | "page_view">(),
  timestamp: timestamp("timestamp").default(sql`now()`),
  details: text("details"), // JSON string
  sessionId: varchar("session_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sessionId: varchar("session_id").notNull().unique(),
  startTime: timestamp("start_time").default(sql`now()`),
  endTime: timestamp("end_time"),
  lastActivity: timestamp("last_activity").default(sql`now()`),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// Roadmap ORBITALE Tables
export const roadmapPhases = pgTable("roadmap_phases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  objective: text("objective").notNull(),
  monthRange: text("month_range").notNull(), // e.g., "Mesi 1-2"
  sortOrder: integer("sort_order").notNull().unique(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const roadmapGroups = pgTable("roadmap_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id").references(() => roadmapPhases.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => {
  return {
    uniquePhaseOrder: unique().on(table.phaseId, table.sortOrder),
  }
});

export const roadmapItems = pgTable("roadmap_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").references(() => roadmapGroups.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  externalLink: text("external_link"),
  externalLinkTitle: text("external_link_title"),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueGroupOrder: unique().on(table.groupId, table.sortOrder),
  }
});

export const clientRoadmapProgress = pgTable("client_roadmap_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  itemId: varchar("item_id").references(() => roadmapItems.id, { onDelete: "cascade" }).notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  consultantNotes: text("consultant_notes"), // Note del consulente
  grade: integer("grade"), // Voto da 1 a 5
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueClientItem: unique().on(table.clientId, table.itemId),
  }
});

// Daily Tasks and Reflections Tables
export const dailyTasks = pgTable("daily_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  date: date("date").notNull(),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const dailyReflections = pgTable("daily_reflections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  grateful: json("grateful").$type<string[]>().default([]), // 3 cose di cui sono grato
  makeGreat: json("make_great").$type<string[]>().default([]), // 3 cose che renderebbero oggi grandioso
  doBetter: text("do_better"), // Cosa potevo fare meglio?
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueClientDate: unique().on(table.clientId, table.date),
  }
});

// Consultation Tasks Table
export const consultationTasks = pgTable("consultation_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultationId: varchar("consultation_id").references(() => consultations.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  priority: text("priority").notNull().$type<"low" | "medium" | "high" | "urgent">().default("medium"),
  category: text("category").notNull().$type<"preparation" | "follow-up" | "exercise" | "goal" | "reminder">().default("reminder"),
  
  // Echo System - Task Source & Draft Status
  source: text("source").$type<"manual" | "echo_extracted" | "auto_followup">().default("manual"),
  draftStatus: text("draft_status").$type<"draft" | "active" | "discarded">().default("active"),
  activatedAt: timestamp("activated_at"), // When task was activated (email approved)
  
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Client State Tracking Table
export const clientStateTracking = pgTable("client_state_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  currentState: text("current_state").notNull(),
  idealState: text("ideal_state").notNull(),
  internalBenefit: text("internal_benefit"),
  externalBenefit: text("external_benefit"),
  mainObstacle: text("main_obstacle"),
  pastAttempts: text("past_attempts"), // Cosa ha già provato in passato
  currentActions: text("current_actions"), // Cosa sta facendo adesso
  futureVision: text("future_vision"), // Dove vuole essere tra 3-5 anni
  motivationDrivers: text("motivation_drivers"), // nullable - cosa motiva il cliente
  lastUpdated: timestamp("last_updated").default(sql`now()`),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueClientConsultant: unique().on(table.clientId, table.consultantId),
  }
});

// Automated Emails Log Table
export const automatedEmailsLog = pgTable("automated_emails_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultationId: varchar("consultation_id").references(() => consultations.id, { onDelete: "set null" }), // Link to consultation for summary emails
  emailType: text("email_type").notNull(),
  journeyDay: integer("journey_day"), // Giorno del journey template (1-31) usato per questa email
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at").default(sql`now()`),
  openedAt: timestamp("opened_at"), // Email tracking - quando il cliente ha aperto l'email
  isTest: boolean("is_test").notNull().default(false), // Flag per email di test
  includesTasks: boolean("includes_tasks").notNull().default(false),
  includesGoals: boolean("includes_goals").notNull().default(false),
  includesState: boolean("includes_state").notNull().default(false),
  tasksCount: integer("tasks_count").notNull().default(0),
  goalsCount: integer("goals_count").notNull().default(0),
});

// Email Drafts Table - Bozze email generate dall'AI in attesa di approvazione
export const emailDrafts = pgTable("email_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultationId: varchar("consultation_id").references(() => consultations.id, { onDelete: "set null" }), // Link to consultation for summary emails
  journeyTemplateId: varchar("journey_template_id").references(() => emailJourneyTemplates.id),
  journeyDay: integer("journey_day"), // Giorno del journey (1-31) al momento della generazione
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").$type<"pending" | "approved" | "rejected" | "sent">().notNull().default("pending"),
  emailType: text("email_type").notNull().default("motivational"), // motivational, consultation_summary, etc.
  includesTasks: boolean("includes_tasks").notNull().default(false),
  includesGoals: boolean("includes_goals").notNull().default(false),
  includesState: boolean("includes_state").notNull().default(false),
  tasksCount: integer("tasks_count").notNull().default(0),
  goalsCount: integer("goals_count").notNull().default(0),
  metadata: jsonb("metadata").$type<{
    fathomLink?: string;
    transcriptLength?: number;
    consultationDate?: string;
    consultantName?: string;
    additionalContext?: string; // Appunti aggiuntivi usati solo per la generazione
  }>(),
  generatedAt: timestamp("generated_at").default(sql`now()`),
  approvedAt: timestamp("approved_at"),
  sentAt: timestamp("sent_at"),
});

// Consultant SMTP Settings Table
export const consultantSmtpSettings = pgTable("consultant_smtp_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpSecure: boolean("smtp_secure").notNull().default(true),
  smtpUser: text("smtp_user").notNull(),
  smtpPassword: text("smtp_password").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  emailTone: text("email_tone").$type<"formale" | "amichevole" | "motivazionale" | "professionale">().default("motivazionale"),
  emailSignature: text("email_signature"),
  automationEnabled: boolean("automation_enabled").notNull().default(false),
  emailFrequencyDays: integer("email_frequency_days").notNull().default(2),
  emailSendTime: text("email_send_time").notNull().default("10:00"), // HH:MM format (24h)
  isActive: boolean("is_active").notNull().default(true),
  lastTestedAt: timestamp("last_tested_at"),
  // Scheduler control fields
  schedulerEnabled: boolean("scheduler_enabled").default(false),
  schedulerPaused: boolean("scheduler_paused").default(false),
  schedulerStatus: text("scheduler_status").$type<"idle" | "running">().default("idle"),
  lastSchedulerRun: timestamp("last_scheduler_run"), // Last execution timestamp
  nextSchedulerRun: timestamp("next_scheduler_run"), // Next calculated execution
  // Journey Template Personalization
  useCustomTemplates: boolean("use_custom_templates").default(false), // Use consultant-specific templates instead of defaults
  businessContext: text("business_context"), // Description of consultant's business for AI template generation
  lastTemplatesGeneratedAt: timestamp("last_templates_generated_at"), // When custom templates were last generated
  // Account reference and notes for credential tracking
  accountReference: text("account_reference"), // Which account these credentials belong to (e.g., "Gmail aziendale marketing@company.com")
  notes: text("notes"), // Additional notes about this configuration
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Vertex AI Settings - Support for both admin-managed and client self-service configurations
export const vertexAiSettings = pgTable("vertex_ai_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  managedBy: text("managed_by").$type<"admin" | "self">().notNull(), // Who configured this: admin (consultant) or self (client)
  projectId: text("project_id").notNull(), // Google Cloud Project ID
  location: text("location").notNull().default("us-central1"), // Vertex AI location (us-central1, europe-west1, etc.)
  serviceAccountJson: text("service_account_json").notNull(), // Encrypted service account credentials (JSON)
  enabled: boolean("enabled").notNull().default(true), // Enable/disable Vertex AI
  usageScope: text("usage_scope").$type<"both" | "consultant_only" | "clients_only" | "selective">().default("both"), // Who can use this Vertex AI: both, consultant_only, clients_only, or selective (per-client)
  allowClientOverride: boolean("allow_client_override").default(false), // Only for consultants: allow clients to use their own Vertex AI
  activatedAt: timestamp("activated_at").notNull().default(sql`now()`), // When Vertex AI was first activated
  expiresAt: timestamp("expires_at").notNull(), // Calculated: activatedAt + 90 days
  lastUsedAt: timestamp("last_used_at"), // Last time this config was used for AI generation
  usageCount: integer("usage_count").notNull().default(0), // Number of times this config was used
  // Account reference and notes for credential tracking
  accountReference: text("account_reference"), // Which Google Cloud project/account (e.g., "Progetto GCP principale - console.cloud.google.com")
  notes: text("notes"), // Additional notes about this configuration
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Vertex AI Client Access - Per-client access control when usageScope is 'selective'
export const vertexAiClientAccess = pgTable("vertex_ai_client_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vertexSettingsId: varchar("vertex_settings_id").references(() => vertexAiSettings.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  hasAccess: boolean("has_access").notNull().default(true), // Whether this client can use Vertex AI
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueSettingsClient: unique().on(table.vertexSettingsId, table.clientId),
  }
});

// SuperAdmin Vertex Config - Centralized Vertex AI configuration managed by SuperAdmin
// Consultants inherit this by default, clients inherit from their consultant
export const superadminVertexConfig = pgTable("superadmin_vertex_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull(), // Google Cloud Project ID
  location: text("location").notNull().default("us-central1"), // Vertex AI location
  serviceAccountJson: text("service_account_json").notNull(), // Service account credentials (JSON)
  enabled: boolean("enabled").notNull().default(true), // Enable/disable SuperAdmin Vertex AI
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Consultant Vertex Access - Controls which consultants can use SuperAdmin's Vertex AI
// By default all consultants have access (has_access = true)
export const consultantVertexAccess = pgTable("consultant_vertex_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  hasAccess: boolean("has_access").notNull().default(true), // Whether this consultant can use SuperAdmin's Vertex AI
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// SuperAdmin Gemini Config - Centralized Gemini API keys managed by SuperAdmin
// Consultants can choose to use these centralized keys instead of their own
export const superadminGeminiConfig = pgTable("superadmin_gemini_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeysEncrypted: text("api_keys_encrypted").notNull(), // JSON array of encrypted API keys
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// SuperAdmin TURN Config - Centralized TURN server configuration managed by SuperAdmin
// Consultants without their own config will cascade/fallback to this config
// Only one row allowed (singleton pattern)
export const adminTurnConfig = pgTable("admin_turn_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").$type<"metered" | "twilio" | "custom">().default("metered").notNull(),
  usernameEncrypted: text("username_encrypted"), // Encrypted with master key
  passwordEncrypted: text("password_encrypted"), // Encrypted with master key
  apiKeyEncrypted: text("api_key_encrypted"), // For providers that need API key (optional)
  turnUrls: jsonb("turn_urls").$type<string[]>(), // Custom TURN URLs (optional, for custom provider)
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Vertex AI Usage Tracking - Track all Vertex AI API calls with accurate cost breakdown
// Supports Live API (audio/text) and standard API tracking
export const vertexAiUsageTracking = pgTable("vertex_ai_usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sessionId: text("session_id"), // For grouping calls in the same Live API session
  callType: text("call_type").$type<"live_api" | "standard_api">().notNull(), // Type of API call
  modelName: text("model_name").notNull(), // e.g., "gemini-2.0-flash-exp"

  // Token counts
  promptTokens: integer("prompt_tokens").notNull().default(0), // Text input tokens (fresh)
  candidatesTokens: integer("candidates_tokens").notNull().default(0), // Text output tokens
  cachedContentTokenCount: integer("cached_content_token_count").notNull().default(0), // Cached input tokens

  // Audio metrics (for Live API only)
  audioInputSeconds: real("audio_input_seconds").default(0), // Audio input duration in seconds
  audioOutputSeconds: real("audio_output_seconds").default(0), // Audio output duration in seconds

  // Cost breakdown (in USD) - Official Live API pricing
  // Cached: $0.03/1M tokens, Text Input: $0.50/1M, Audio Input: $3.00/1M, Audio Output: $12.00/1M
  textInputCost: real("text_input_cost").notNull().default(0), // Fresh text input cost
  audioInputCost: real("audio_input_cost").notNull().default(0), // Audio input cost
  audioOutputCost: real("audio_output_cost").notNull().default(0), // Audio output cost (most expensive!)
  cachedInputCost: real("cached_input_cost").notNull().default(0), // Cached input cost (94% savings!)
  totalCost: real("total_cost").notNull().default(0), // Sum of all costs

  // Metadata
  requestMetadata: jsonb("request_metadata").$type<{
    usageMetadata?: any;
    serverContent?: any;
    toolCall?: any;
    endOfTurn?: boolean;
  }>().default(sql`'{}'::jsonb`), // Store full usage metadata from Vertex AI response

  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
}, (table) => {
  return {
    consultantSessionIdx: index("consultant_session_idx").on(table.consultantId, table.sessionId),
    callTypeIdx: index("call_type_idx").on(table.callType),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
  }
});

// WhatsApp Vertex AI Settings - Separate AI configuration for WhatsApp system
export const whatsappVertexAiSettings = pgTable("whatsapp_vertex_ai_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  projectId: varchar("project_id", { length: 255 }).notNull(),
  location: varchar("location", { length: 100 }).default("us-central1").notNull(),
  serviceAccountJson: text("service_account_json").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// WhatsApp Gemini API Keys - Multiple API keys for WhatsApp AI with rotation
export const whatsappGeminiApiKeys = pgTable("whatsapp_gemini_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  apiKey: text("api_key").notNull(),
  keyPreview: varchar("key_preview", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// Client Email Automation Settings - Per quali clienti attivare l'automazione email
export const clientEmailAutomation = pgTable("client_email_automation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueConsultantClient: unique().on(table.consultantId, table.clientId),
  }
});

// Scheduler Execution Log - Traccia le esecuzioni dello scheduler
export const schedulerExecutionLog = pgTable("scheduler_execution_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  executedAt: timestamp("executed_at").default(sql`now()`).notNull(),
  clientsProcessed: integer("clients_processed").notNull().default(0),
  emailsSent: integer("emails_sent").notNull().default(0),
  draftsCreated: integer("drafts_created").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  errorDetails: jsonb("error_details").$type<Array<{ clientId: string; clientName: string; error: string }>>().default(sql`'[]'::jsonb`),
  executionTimeMs: integer("execution_time_ms"), // Tempo di esecuzione in millisecondi
  status: text("status").$type<"success" | "partial" | "failed">().notNull().default("success"),
  details: text("details"), // Note aggiuntive
});

// Email Journey Templates - Template per ogni giorno del ciclo mensile (1-28 giorni)
export const emailJourneyTemplates = pgTable("email_journey_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dayOfMonth: integer("day_of_month").notNull(), // 1-28 (ciclo fisso di 28 giorni)
  title: text("title").notNull(), // Es: "Recap Mensile", "Check Esercizi Pending"
  description: text("description"), // Descrizione del template e del suo obiettivo
  emailType: text("email_type").notNull(), // "esercizi", "corsi", "momentum", "celebrazione", "follow_up", etc.
  promptTemplate: text("prompt_template").notNull(), // Template del prompt AI per questo tipo di email
  tone: text("tone").$type<"formale" | "amichevole" | "motivazionale" | "professionale">().default("motivazionale"),
  priority: integer("priority").notNull().default(5), // 1-10, per ordinamento se necessario
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueDay: unique().on(table.dayOfMonth), // Ogni giorno ha un solo template
  }
});

// Consultant Journey Templates - Template personalizzati per consultant (sovrascrivono i default)
export const consultantJourneyTemplates = pgTable("consultant_journey_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  dayOfMonth: integer("day_of_month").notNull(), // 1-31
  title: text("title").notNull(),
  description: text("description"),
  emailType: text("email_type").notNull(),
  promptTemplate: text("prompt_template").notNull(), // Prompt AI personalizzato
  tone: text("tone").$type<"formale" | "amichevole" | "motivazionale" | "professionale">().default("motivazionale"),
  priority: integer("priority").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  generatedFromDefault: boolean("generated_from_default").default(true), // Se generato da template default
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueConsultantDay: unique().on(table.consultantId, table.dayOfMonth), // Ogni consultant ha un solo template per giorno
  }
});

// Client Email Journey Progress - Traccia il progresso del cliente nel journey mensile
export const clientEmailJourneyProgress = pgTable("client_email_journey_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  currentDay: integer("current_day").notNull().default(1), // Giorno corrente nel journey (1-28)
  monthStartDate: timestamp("month_start_date").notNull().default(sql`now()`), // Quando è iniziato il ciclo corrente
  lastEmailSentAt: timestamp("last_email_sent_at"),
  lastTemplateUsedId: varchar("last_template_used_id").references(() => emailJourneyTemplates.id),
  lastEmailSubject: text("last_email_subject"),
  lastEmailBody: text("last_email_body"), // Corpo dell'ultima email per analisi
  lastEmailActions: jsonb("last_email_actions").$type<Array<{ action: string; type: string; expectedCompletion?: string }>>().default(sql`'[]'::jsonb`),
  actionsCompletedData: jsonb("actions_completed_data").$type<{ completed: boolean; details: Array<{ action: string; completed: boolean; completedAt?: string }> }>().default(sql`'{"completed": false, "details": []}'::jsonb`),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueConsultantClient: unique().on(table.consultantId, table.clientId),
  }
});


// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
  createdBy: true,
  createdAt: true,
}).extend({
  libraryDocumentId: z.string().uuid().optional().nullable(),
});

export const insertExerciseAssignmentSchema = createInsertSchema(exerciseAssignments).omit({
  id: true,
  assignedAt: true,
  completedAt: true,
  submittedAt: true,
  reviewedAt: true,
});

export const insertExerciseSubmissionSchema = createInsertSchema(exerciseSubmissions).omit({
  id: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for draft submissions (auto-saving)
export const insertExerciseDraftSchema = createInsertSchema(exerciseSubmissions).omit({
  id: true,
  submittedAt: true,
  createdAt: true,
});

export const insertExerciseRevisionHistorySchema = createInsertSchema(exerciseRevisionHistory).omit({
  id: true,
  createdAt: true,
});

export const exerciseRevisionHistorySchema = z.object({
  assignmentId: z.string().uuid(),
  submissionId: z.string().uuid().optional(),
  action: z.enum(["submitted", "approved", "rejected", "returned"]),
  consultantFeedback: z.string().optional(),
  clientNotes: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  previousStatus: z.enum(["pending", "in_progress", "submitted", "in_review", "completed", "rejected", "returned"]),
  newStatus: z.enum(["pending", "in_progress", "submitted", "in_review", "completed", "rejected", "returned"]),
  createdBy: z.string().uuid(),
}).refine((data) => {
  // When action is "submitted", submissionId is required
  if (data.action === "submitted" && !data.submissionId) {
    return false;
  }
  // For review actions (approved/rejected/returned), consultantFeedback should be present
  if (["approved", "rejected", "returned"].includes(data.action) && !data.consultantFeedback?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Invalid revision history data: submissionId required for 'submitted' action, consultantFeedback required for review actions",
});

export const insertConsultationSchema = z.object({
  consultantId: z.string().uuid(),
  clientId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  duration: z.coerce.number().int().positive(),
  notes: z.string().nullable().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
});

export const updateConsultationSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
  duration: z.coerce.number().int().positive().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  clientId: z.string().uuid().optional(),
  googleMeetLink: z.string().nullable().optional(),
  fathomShareLink: z.string().nullable().optional(),
  transcript: z.string().nullable().optional(),
  googleCalendarEventId: z.string().nullable().optional(),
});

export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
  createdAt: true,
});

export const insertClientProgressSchema = createInsertSchema(clientProgress).omit({
  id: true,
});

export const insertClientEngagementMetricsSchema = createInsertSchema(clientEngagementMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertExercisePerformanceMetricsSchema = createInsertSchema(exercisePerformanceMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertConsultantAnalyticsSchema = createInsertSchema(consultantAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertClientAnalyticsSummarySchema = createInsertSchema(clientAnalyticsSummary).omit({
  id: true,
  createdAt: true,
});

export const insertExerciseTemplateSchema = createInsertSchema(exerciseTemplates).omit({
  id: true,
  createdBy: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateClientAssociationSchema = createInsertSchema(templateClientAssociations).omit({
  id: true,
  createdAt: true,
});

// Roadmap insert schemas
export const insertRoadmapPhaseSchema = createInsertSchema(roadmapPhases).omit({
  id: true,
  createdAt: true,
});

export const insertRoadmapGroupSchema = createInsertSchema(roadmapGroups).omit({
  id: true,
  createdAt: true,
});

export const insertRoadmapItemSchema = createInsertSchema(roadmapItems).omit({
  id: true,
  createdAt: true,
});

export const insertClientRoadmapProgressSchema = createInsertSchema(clientRoadmapProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDailyTaskSchema = createInsertSchema(dailyTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  description: z.string().min(1, "Description is required"),
  completed: z.boolean().optional().default(false),
  completedAt: z.coerce.date().optional().nullable(),
});

export const insertDailyReflectionSchema = createInsertSchema(dailyReflections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  grateful: z.array(z.string()).optional().default([]),
  makeGreat: z.array(z.string()).optional().default([]),
  doBetter: z.string().optional().nullable(),
});

// Consultation Tasks insert schema
export const insertConsultationTaskSchema = createInsertSchema(consultationTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  title: z.string().min(1, "Title is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  category: z.enum(["preparation", "follow-up", "exercise", "goal", "reminder"]).optional().default("reminder"),
  dueDate: z.coerce.date().optional().nullable(),
  completed: z.boolean().optional().default(false),
});

export const updateConsultationTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  completed: z.boolean().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  category: z.enum(["preparation", "follow-up", "exercise", "goal", "reminder"]).optional(),
});

// Client State Tracking insert schema
export const insertClientStateTrackingSchema = createInsertSchema(clientStateTracking).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
}).extend({
  currentState: z.string().min(1, "Current state is required"),
  idealState: z.string().min(1, "Ideal state is required"),
  motivationDrivers: z.string().nullable().optional(),
});

export const updateClientStateTrackingSchema = z.object({
  currentState: z.string().min(1).optional(),
  idealState: z.string().min(1).optional(),
  internalBenefit: z.string().nullable().optional(),
  externalBenefit: z.string().nullable().optional(),
  mainObstacle: z.string().nullable().optional(),
  pastAttempts: z.string().nullable().optional(),
  currentActions: z.string().nullable().optional(),
  futureVision: z.string().nullable().optional(),
  motivationDrivers: z.string().nullable().optional(),
});

// Automated Emails Log insert schema
export const insertAutomatedEmailsLogSchema = createInsertSchema(automatedEmailsLog).omit({
  id: true,
  sentAt: true,
}).extend({
  emailType: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
});

// Consultant SMTP Settings insert schema
export const insertConsultantSmtpSettingsSchema = createInsertSchema(consultantSmtpSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTestedAt: true,
}).extend({
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.number().int().min(1).max(65535, "Invalid SMTP port"),
  smtpUser: z.string().min(1, "SMTP user is required"),
  smtpPassword: z.string().min(1, "SMTP password is required"),
  fromEmail: z.string().email("Invalid from email"),
  fromName: z.string().nullable().optional(),
  emailTone: z.enum(["formale", "amichevole", "motivazionale", "professionale"]).optional(),
  emailSignature: z.string().nullable().optional(),
  automationEnabled: z.boolean().optional(),
});

export const updateConsultantSmtpSettingsSchema = insertConsultantSmtpSettingsSchema.partial();

// Vertex AI Settings insert schema
export const insertVertexAiSettingsSchema = createInsertSchema(vertexAiSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
  usageCount: true,
}).extend({
  projectId: z.string().min(1, "Project ID is required"),
  location: z.string().min(1, "Location is required"),
  serviceAccountJson: z.string().min(1, "Service account JSON is required"),
  managedBy: z.enum(["admin", "self"]),
  enabled: z.boolean().optional(),
  allowClientOverride: z.boolean().optional(),
  expiresAt: z.coerce.date(), // Must be calculated as activatedAt + 90 days
});

export const updateVertexAiSettingsSchema = insertVertexAiSettingsSchema.partial().extend({
  id: z.string().uuid().optional(),
});

// WhatsApp Vertex AI Settings insert schema
export const insertWhatsappVertexAiSettingsSchema = createInsertSchema(whatsappVertexAiSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  projectId: z.string().min(1, "Project ID is required"),
  location: z.string().min(1, "Location is required"),
  serviceAccountJson: z.string().min(1, "Service account JSON is required"),
  enabled: z.boolean().optional(),
});

// WhatsApp Gemini API Keys insert schema
export const insertWhatsappGeminiApiKeysSchema = createInsertSchema(whatsappGeminiApiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  usageCount: true,
}).extend({
  apiKey: z.string().min(20, "API key must be at least 20 characters"),
  keyPreview: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Email Drafts insert schema
export const insertEmailDraftSchema = createInsertSchema(emailDrafts).omit({
  id: true,
  generatedAt: true,
  approvedAt: true,
  sentAt: true,
});

export const updateEmailDraftSchema = z.object({
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  status: z.enum(["pending", "approved", "rejected", "sent"]).optional(),
});

// Email Journey Templates insert schema
export const insertEmailJourneyTemplateSchema = createInsertSchema(emailJourneyTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dayOfMonth: z.number().int().min(1).max(28, "Day must be between 1 and 28"),
  title: z.string().min(1, "Title is required"),
  emailType: z.string().min(1, "Email type is required"),
  promptTemplate: z.string().min(1, "Prompt template is required"),
  tone: z.enum(["formale", "amichevole", "motivazionale", "professionale"]).optional(),
  priority: z.number().int().min(1).max(10).optional(),
});

export const updateEmailJourneyTemplateSchema = insertEmailJourneyTemplateSchema.partial();

// Consultant Journey Templates insert schema
export const insertConsultantJourneyTemplateSchema = createInsertSchema(consultantJourneyTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateConsultantJourneyTemplateSchema = insertConsultantJourneyTemplateSchema.partial();

// Client Email Journey Progress insert schema
export const insertClientEmailJourneyProgressSchema = createInsertSchema(clientEmailJourneyProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  monthStartDate: true,
  lastEmailSentAt: true,
}).extend({
  consultantId: z.string().uuid(),
  clientId: z.string().uuid(),
  currentDay: z.number().int().min(1).max(28).optional(),
});

export const updateClientEmailJourneyProgressSchema = z.object({
  currentDay: z.number().int().min(1).max(28).optional(),
  lastEmailSentAt: z.date().optional(),
  lastTemplateUsedId: z.string().uuid().optional().nullable(),
  lastEmailSubject: z.string().optional().nullable(),
  lastEmailBody: z.string().optional().nullable(),
  lastEmailActions: z.array(z.object({
    action: z.string(),
    type: z.string(),
    expectedCompletion: z.string().optional(),
  })).optional(),
  actionsCompletedData: z.object({
    completed: z.boolean(),
    details: z.array(z.object({
      action: z.string(),
      completed: z.boolean(),
      completedAt: z.string().optional(),
    })),
  }).optional(),
});

// Client Email Automation insert schema
export const insertClientEmailAutomationSchema = createInsertSchema(clientEmailAutomation).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientEmailAutomationSchema = z.object({
  enabled: z.boolean(),
});

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const updateClientAiConfigSchema = z.object({
  preferredAiProvider: z.enum(["vertex_admin", "google_studio", "custom", "vertex_self"]),
  geminiApiKeys: z.array(z.string()).max(10).optional(),
  vertexProjectId: z.string().optional(),
  vertexLocation: z.string().optional(),
  vertexServiceAccountJson: z.string().optional(),
});

// Schemas for exercise assignment and submission
export const exerciseAssignmentSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  clientId: z.string(),
  consultantId: z.string(),
  assignedAt: z.date(),
  dueDate: z.date().optional().nullable(),
  status: z.enum(["pending", "in_progress", "submitted", "in_review", "completed", "rejected", "returned"]),
  completedAt: z.date().optional().nullable(),
  submittedAt: z.date().optional().nullable(),
  reviewedAt: z.date().optional().nullable(),
  score: z.number().optional().nullable(),
  consultantFeedback: z.union([
    z.string().optional().nullable(), // Legacy support for string format
    z.array(z.object({
      feedback: z.string(),
      timestamp: z.string()
    })).optional().nullable() // New array format
  ]),
  priority: z.enum(["low", "medium", "high"]).optional().nullable(),
  whatsappSent: z.boolean().optional(), // Added this field
});

export const exerciseSubmissionSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.union([z.string(), z.array(z.string())]), // Support both single and multiple answers
    uploadedFiles: z.array(z.string()).optional(), // Support file uploads for specific question types
  })),
  notes: z.string().min(50, "Devi scrivere almeno 50 caratteri per descrivere come ti sei trovato con l'esercizio"),
  attachments: z.array(z.string()).optional(),
  submittedAt: z.date(),
});

// Analytics query validation schemas
const validateDateRange = (data: any) => {
  if (!data.startDate || !data.endDate) return true;
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return start <= end && diffDays <= 365;
};

export const analyticsPeriodSchema = z.enum(["daily", "weekly", "monthly"]);

export const analyticsOverviewQuerySchema = z.object({
  startDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "Start date must be a valid date not in the future"),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "End date must be a valid date not in the future"),
}).refine(validateDateRange, "Date range must be valid (start <= end) and not exceed 365 days");

export const analyticsCompletionTrendsQuerySchema = z.object({
  startDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "Start date must be a valid date not in the future"),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "End date must be a valid date not in the future"),
  period: analyticsPeriodSchema.default("weekly"),
}).refine(validateDateRange, "Date range must be valid (start <= end) and not exceed 365 days");

export const analyticsEngagementTrendsQuerySchema = z.object({
  startDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "Start date must be a valid date not in the future"),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "End date must be a valid date not in the future"),
  period: analyticsPeriodSchema.default("weekly"),
}).refine(validateDateRange, "Date range must be valid (start <= end) and not exceed 365 days");

export const analyticsClientPerformanceQuerySchema = z.object({
  startDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "Start date must be a valid date not in the future"),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "End date must be a valid date not in the future"),
  clientId: z.string().uuid().optional(),
  limit: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseInt(val);
    return !isNaN(num) && num > 0 && num <= 100;
  }, "Limit must be a number between 1 and 100"),
  offset: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseInt(val);
    return !isNaN(num) && num >= 0;
  }, "Offset must be a non-negative number"),
}).refine(validateDateRange, "Date range must be valid (start <= end) and not exceed 365 days");

export const analyticsClientEngagementQuerySchema = z.object({
  startDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "Start date must be a valid date not in the future"),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "End date must be a valid date not in the future"),
  clientId: z.string().uuid("Client ID must be a valid UUID"),
}).refine(validateDateRange, "Date range must be valid (start <= end) and not exceed 365 days");

export const analyticsConsultantSummaryQuerySchema = z.object({
  startDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "Start date must be a valid date not in the future"),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "End date must be a valid date not in the future"),
  period: analyticsPeriodSchema.default("monthly"),
}).refine(validateDateRange, "Date range must be valid (start <= end) and not exceed 365 days");

export const analyticsClientSummaryQuerySchema = z.object({
  startDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "Start date must be a valid date not in the future"),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, "End date must be a valid date not in the future"),
  clientId: z.string().uuid("Client ID must be a valid UUID"),
  period: analyticsPeriodSchema.default("monthly"),
}).refine(validateDateRange, "Date range must be valid (start <= end) and not exceed 365 days");

// Additional schemas for other analytics endpoints
export const analyticsExercisePerformanceQuerySchema = z.object({
  exerciseId: z.string().uuid("Exercise ID must be a valid UUID"),
  clientId: z.string().uuid("Client ID must be a valid UUID").optional(),
  assignmentId: z.string().uuid("Assignment ID must be a valid UUID").optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type ExerciseAssignment = typeof exerciseAssignments.$inferSelect;
export type InsertExerciseAssignment = z.infer<typeof insertExerciseAssignmentSchema>;
export type ExerciseSubmission = typeof exerciseSubmissions.$inferSelect;
export type InsertExerciseSubmission = z.infer<typeof insertExerciseSubmissionSchema>;
export type ExerciseRevisionHistory = typeof exerciseRevisionHistory.$inferSelect;
export type InsertExerciseRevisionHistory = z.infer<typeof insertExerciseRevisionHistorySchema>;
export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type ClientProgress = typeof clientProgress.$inferSelect;
export type InsertClientProgress = z.infer<typeof insertClientProgressSchema>;
export type ClientEngagementMetrics = typeof clientEngagementMetrics.$inferSelect;
export type InsertClientEngagementMetrics = z.infer<typeof insertClientEngagementMetricsSchema>;
export type ExercisePerformanceMetrics = typeof exercisePerformanceMetrics.$inferSelect;
export type InsertExercisePerformanceMetrics = z.infer<typeof insertExercisePerformanceMetricsSchema>;
export type ConsultantAnalytics = typeof consultantAnalytics.$inferSelect;
export type InsertConsultantAnalytics = z.infer<typeof insertConsultantAnalyticsSchema>;
export type ClientAnalyticsSummary = typeof clientAnalyticsSummary.$inferSelect;
export type InsertClientAnalyticsSummary = typeof clientAnalyticsSummary.$inferInsert;

export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertUserActivityLog = typeof userActivityLogs.$inferInsert;

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;
export type ExerciseTemplate = typeof exerciseTemplates.$inferSelect;
export type InsertExerciseTemplate = z.infer<typeof insertExerciseTemplateSchema>;
export type TemplateClientAssociation = typeof templateClientAssociations.$inferSelect;
export type InsertTemplateClientAssociation = z.infer<typeof insertTemplateClientAssociationSchema>;

// Library tables
export const libraryCategories = pgTable("library_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").default("BookOpen"),
  color: text("color").default("blue"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const librarySubcategories = pgTable("library_subcategories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => libraryCategories.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").default("Folder"),
  color: text("color").default("gray"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const libraryDocuments = pgTable("library_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => libraryCategories.id, { onDelete: "cascade" }).notNull(),
  subcategoryId: varchar("subcategory_id").references(() => librarySubcategories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  content: text("content"), // Rich text content
  contentType: text("content_type").notNull().$type<"text" | "video" | "both">().default("text"),
  videoUrl: text("video_url"),
  level: text("level").notNull().$type<"base" | "intermedio" | "avanzato">().default("base"),
  estimatedDuration: integer("estimated_duration"), // in minutes
  tags: json("tags").$type<string[]>().default([]),
  attachments: json("attachments").$type<Array<{ filename: string, originalName: string, size: number, mimetype: string } | string>>().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").default(true),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const libraryDocumentSections = pgTable("library_document_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => libraryDocuments.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().$type<"text" | "highlight" | "example" | "note" | "warning">().default("text"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const clientLibraryProgress = pgTable("client_library_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  documentId: varchar("document_id").references(() => libraryDocuments.id, { onDelete: "cascade" }).notNull(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  timeSpent: integer("time_spent").default(0), // in seconds
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueClientDocument: unique().on(table.clientId, table.documentId),
  }
});

export const libraryCategoryClientAssignments = pgTable("library_category_client_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => libraryCategories.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueCategoryClient: unique().on(table.categoryId, table.clientId, table.consultantId),
  }
});

// Insert schemas for library
export const insertLibraryCategorySchema = createInsertSchema(libraryCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLibrarySubcategorySchema = createInsertSchema(librarySubcategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLibraryDocumentSchema = createInsertSchema(libraryDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  contentType: z.enum(["text", "video", "both"]).default("text"),
  videoUrl: z.string().optional().nullable(),
});

export const insertLibraryDocumentSectionSchema = createInsertSchema(libraryDocumentSections).omit({
  id: true,
  createdAt: true,
});

export const insertClientLibraryProgressSchema = createInsertSchema(clientLibraryProgress).omit({
  id: true,
  readAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLibraryCategoryClientAssignmentSchema = createInsertSchema(libraryCategoryClientAssignments).omit({
  id: true,
  createdAt: true,
});

// Roadmap types
export type RoadmapPhase = typeof roadmapPhases.$inferSelect;
export type InsertRoadmapPhase = z.infer<typeof insertRoadmapPhaseSchema>;
export type RoadmapGroup = typeof roadmapGroups.$inferSelect;
export type InsertRoadmapGroup = z.infer<typeof insertRoadmapGroupSchema>;
export type RoadmapItem = typeof roadmapItems.$inferSelect;
export type InsertRoadmapItem = z.infer<typeof insertRoadmapItemSchema>;
export type ClientRoadmapProgress = typeof clientRoadmapProgress.$inferSelect;
export type InsertClientRoadmapProgress = z.infer<typeof insertClientRoadmapProgressSchema>;

// Library types
export type LibraryCategory = typeof libraryCategories.$inferSelect;
export type InsertLibraryCategory = z.infer<typeof insertLibraryCategorySchema>;
export type LibrarySubcategory = typeof librarySubcategories.$inferSelect;
export type InsertLibrarySubcategory = z.infer<typeof insertLibrarySubcategorySchema>;
export type LibraryDocument = typeof libraryDocuments.$inferSelect;
export type InsertLibraryDocument = z.infer<typeof insertLibraryDocumentSchema>;
export type LibraryDocumentSection = typeof libraryDocumentSections.$inferSelect;
export type InsertLibraryDocumentSection = z.infer<typeof insertLibraryDocumentSectionSchema>;
export type ClientLibraryProgress = typeof clientLibraryProgress.$inferSelect;
export type InsertClientLibraryProgress = z.infer<typeof insertClientLibraryProgressSchema>;
export type LibraryCategoryClientAssignment = typeof libraryCategoryClientAssignments.$inferSelect;
export type InsertLibraryCategoryClientAssignment = z.infer<typeof insertLibraryCategoryClientAssignmentSchema>;

// University Module Tables

// University Templates - for creating multiple curriculum templates
export const universityTemplates = pgTable("university_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "Percorso Base", "Percorso Avanzato"
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Template Structure - allows templates to have predefined trimesters, modules, and lessons
export const templateTrimesters = pgTable("template_trimesters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => universityTemplates.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const templateModules = pgTable("template_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateTrimesterId: varchar("template_trimester_id").references(() => templateTrimesters.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const templateLessons = pgTable("template_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateModuleId: varchar("template_module_id").references(() => templateModules.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  resourceUrl: text("resource_url"),
  libraryDocumentId: varchar("library_document_id").references(() => libraryDocuments.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const universityYears = pgTable("university_years", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => universityTemplates.id, { onDelete: "cascade" }), // Link to template
  title: text("title").notNull(), // e.g., "Anno 1 – Fondazioni"
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isLocked: boolean("is_locked").default(true).notNull(), // Lock/unlock like a videogame level
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const universityTrimesters = pgTable("university_trimesters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  yearId: varchar("year_id").references(() => universityYears.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(), // e.g., "Q1 – Mindset e Diagnosi"
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const universityModules = pgTable("university_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trimesterId: varchar("trimester_id").references(() => universityTrimesters.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const universityLessons = pgTable("university_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => universityModules.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  resourceUrl: text("resource_url"), // Link to resource
  exerciseId: varchar("exercise_id").references(() => exercises.id), // Optional link to existing exercise
  libraryDocumentId: varchar("library_document_id").references(() => libraryDocuments.id), // Optional link to library document
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const universityProgress = pgTable("university_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  lessonId: varchar("lesson_id").references(() => universityLessons.id, { onDelete: "cascade" }).notNull(),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  notes: text("notes"), // Client's personal notes
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueClientLesson: unique().on(table.clientId, table.lessonId),
  }
});

export const universityGrades = pgTable("university_grades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(),
  referenceType: text("reference_type").notNull().$type<"module" | "trimester" | "year">(), // What is being graded
  referenceId: varchar("reference_id").notNull(), // ID of module/trimester/year
  grade: integer("grade").notNull(), // Voto 1-10
  feedback: text("feedback"), // Feedback testuale
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const universityCertificates = pgTable("university_certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(),
  certificateType: text("certificate_type").notNull().$type<"trimester" | "year">(), // Type of certificate
  referenceId: varchar("reference_id").notNull(), // ID of trimester or year
  title: text("title").notNull(), // e.g., "Anno 1 – Fondazioni"
  averageGrade: real("average_grade"), // Media voti
  pdfUrl: text("pdf_url"), // Link to generated PDF
  issuedAt: timestamp("issued_at").default(sql`now()`),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Client-Year Assignment for University
export const universityYearClientAssignments = pgTable("university_year_client_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  yearId: varchar("year_id").references(() => universityYears.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(),
  assignedAt: timestamp("assigned_at").default(sql`now()`),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueYearClient: unique().on(table.yearId, table.clientId),
  }
});

// AI Assistant Tables
export const aiConversations = pgTable("ai_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }), // Nullable for sales agent prospects
  salesConversationId: varchar("sales_conversation_id"), // References client_sales_conversations.id - defined after the table
  mode: text("mode").notNull().$type<"assistenza" | "consulente" | "live_voice">(),
  consultantType: text("consultant_type").$type<"finanziario" | "business" | "vendita">(),
  title: text("title"), // Auto-generated or user-defined
  isActive: boolean("is_active").default(true).notNull(),
  lastMessageAt: timestamp("last_message_at").default(sql`now()`),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const aiMessages = pgTable("ai_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull().$type<"user" | "assistant" | "system">(),
  content: text("content").notNull(),
  status: text("status").notNull().default("completed").$type<"pending" | "processing" | "completed" | "error">(),
  tokensUsed: integer("tokens_used"),
  contextSnapshot: jsonb("context_snapshot"), // Snapshot of user context at message time
  metadata: jsonb("metadata"), // Suggested actions, references, etc.
  messageType: varchar("message_type", { length: 20 }).default("text"), // 'text' | 'voice'
  audioUrl: text("audio_url"), // URL audio utente in storage
  aiAudioUrl: text("ai_audio_url"), // URL audio AI in storage
  durationSeconds: integer("duration_seconds"), // Durata in secondi
  voiceUsed: varchar("voice_used", { length: 50 }), // Nome voce usata (es: "Achernar")
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const aiUserPreferences = pgTable("ai_user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  preferredMode: text("preferred_mode").$type<"assistenza" | "consulente">().default("assistenza"),
  preferredConsultantType: text("preferred_consultant_type").$type<"finanziario" | "business" | "vendita">().default("finanziario"),
  enableProactiveSuggestions: boolean("enable_proactive_suggestions").default(true),
  dailyDigestEnabled: boolean("daily_digest_enabled").default(false),
  lastInteraction: timestamp("last_interaction"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const customLivePrompts = pgTable("custom_live_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  promptText: text("prompt_text").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// AI Weekly Consultations - Consulenze AI settimanali programmate
export const aiWeeklyConsultations = pgTable("ai_weekly_consultations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(),

  // Programmazione consulenza
  scheduledFor: timestamp("scheduled_for").notNull(), // martedì 15:00
  recurrenceRule: text("recurrence_rule").default("WEEKLY"), // per future espansioni

  // Stato e durata
  status: text("status").notNull().default("scheduled").$type<"scheduled" | "in_progress" | "completed" | "cancelled">(),
  maxDurationMinutes: integer("max_duration_minutes").default(90), // 1.5 ore

  // Collegamento alla conversazione Live
  aiConversationId: varchar("ai_conversation_id").references(() => aiConversations.id, { onDelete: "set null" }),

  // Trascrizione e metadati
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  actualDurationMinutes: integer("actual_duration_minutes"),
  transcript: text("transcript"), // trascrizione completa
  summary: text("summary"), // riassunto AI-generato

  // Flag test per sviluppo
  isTestMode: boolean("is_test_mode").default(false),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// User Badges for Gamification
export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  badgeType: text("badge_type").notNull().$type<"prima_lezione" | "primo_trimestre" | "anno_completato" | "perfezionista" | "velocista" | "esperto" | "mentor" | "master">(),
  badgeName: text("badge_name").notNull(), // Display name
  badgeDescription: text("badge_description"), // Description
  earnedAt: timestamp("earned_at").default(sql`now()`),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueUserBadge: unique().on(table.userId, table.badgeType),
  }
});

// Calendar Events Table
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  allDay: boolean("all_day").default(false).notNull(),
  color: text("color").default("#3b82f6"), // Default blue color
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Insert schemas for calendar
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schemas for university
export const insertUniversityTemplateSchema = createInsertSchema(universityTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateTrimesterSchema = createInsertSchema(templateTrimesters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateModuleSchema = createInsertSchema(templateModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateLessonSchema = createInsertSchema(templateLessons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  libraryDocumentId: z.string().uuid().optional().nullable(),
});

export const insertUniversityYearSchema = createInsertSchema(universityYears).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUniversityTrimesterSchema = createInsertSchema(universityTrimesters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUniversityModuleSchema = createInsertSchema(universityModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUniversityLessonSchema = createInsertSchema(universityLessons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUniversityProgressSchema = createInsertSchema(universityProgress).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUniversityGradeSchema = createInsertSchema(universityGrades).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  referenceType: z.enum(["module", "trimester", "year"]),
  grade: z.number().min(1).max(10),
});

export const insertUniversityCertificateSchema = createInsertSchema(universityCertificates).omit({
  id: true,
  issuedAt: true,
  createdAt: true,
}).extend({
  certificateType: z.enum(["trimester", "year"]),
});

export const insertUniversityYearClientAssignmentSchema = createInsertSchema(universityYearClientAssignments).omit({
  id: true,
  assignedAt: true,
  createdAt: true,
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  earnedAt: true,
  createdAt: true,
}).extend({
  badgeType: z.enum(["prima_lezione", "primo_trimestre", "anno_completato", "perfezionista", "velocista", "esperto", "mentor", "master"]),
});

// AI Assistant insert schemas
export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({
  id: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  mode: z.enum(["assistenza", "consulente"]),
  consultantType: z.enum(["finanziario", "business", "vendita"]).optional(),
});

export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({
  id: true,
  createdAt: true,
}).extend({
  role: z.enum(["user", "assistant", "system"]),
});

export const insertAiUserPreferencesSchema = createInsertSchema(aiUserPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  preferredMode: z.enum(["assistenza", "consulente"]).optional(),
  preferredConsultantType: z.enum(["finanziario", "business", "vendita"]).optional(),
});

export const insertCustomLivePromptSchema = createInsertSchema(customLivePrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiWeeklyConsultationSchema = createInsertSchema(aiWeeklyConsultations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
});

export const updateAiWeeklyConsultationSchema = insertAiWeeklyConsultationSchema.partial().omit({
  clientId: true,
  consultantId: true,
});

// University types
export type UniversityTemplate = typeof universityTemplates.$inferSelect;
export type InsertUniversityTemplate = z.infer<typeof insertUniversityTemplateSchema>;
export type TemplateTrimester = typeof templateTrimesters.$inferSelect;
export type InsertTemplateTrimester = z.infer<typeof insertTemplateTrimesterSchema>;
export type TemplateModule = typeof templateModules.$inferSelect;
export type InsertTemplateModule = z.infer<typeof insertTemplateModuleSchema>;
export type TemplateLesson = typeof templateLessons.$inferSelect;
export type InsertTemplateLesson = z.infer<typeof insertTemplateLessonSchema>;
export type UniversityYear = typeof universityYears.$inferSelect;
export type InsertUniversityYear = z.infer<typeof insertUniversityYearSchema>;
export type UniversityTrimester = typeof universityTrimesters.$inferSelect;
export type InsertUniversityTrimester = z.infer<typeof insertUniversityTrimesterSchema>;
export type UniversityModule = typeof universityModules.$inferSelect;
export type InsertUniversityModule = z.infer<typeof insertUniversityModuleSchema>;
export type UniversityLesson = typeof universityLessons.$inferSelect;
export type InsertUniversityLesson = z.infer<typeof insertUniversityLessonSchema>;
export type UniversityProgress = typeof universityProgress.$inferSelect;
export type InsertUniversityProgress = z.infer<typeof insertUniversityProgressSchema>;
export type UniversityGrade = typeof universityGrades.$inferSelect;
export type InsertUniversityGrade = z.infer<typeof insertUniversityGradeSchema>;
export type UniversityCertificate = typeof universityCertificates.$inferSelect;
export type InsertUniversityCertificate = z.infer<typeof insertUniversityCertificateSchema>;
export type UniversityYearClientAssignment = typeof universityYearClientAssignments.$inferSelect;
export type InsertUniversityYearClientAssignment = z.infer<typeof insertUniversityYearClientAssignmentSchema>;
export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;

// Daily Tasks and Reflections types
export type DailyTask = typeof dailyTasks.$inferSelect;
export type InsertDailyTask = z.infer<typeof insertDailyTaskSchema>;
export type DailyReflection = typeof dailyReflections.$inferSelect;
export type InsertDailyReflection = z.infer<typeof insertDailyReflectionSchema>;

// Consultation Tasks types
export type ConsultationTask = typeof consultationTasks.$inferSelect;
export type InsertConsultationTask = z.infer<typeof insertConsultationTaskSchema>;
export type UpdateConsultationTask = z.infer<typeof updateConsultationTaskSchema>;

// Client State Tracking types
export type ClientStateTracking = typeof clientStateTracking.$inferSelect;
export type InsertClientStateTracking = z.infer<typeof insertClientStateTrackingSchema>;
export type UpdateClientStateTracking = z.infer<typeof updateClientStateTrackingSchema>;

// Automated Emails Log types
export type AutomatedEmailsLog = typeof automatedEmailsLog.$inferSelect;
export type InsertAutomatedEmailsLog = z.infer<typeof insertAutomatedEmailsLogSchema>;

// Consultant SMTP Settings types
export type ConsultantSmtpSettings = typeof consultantSmtpSettings.$inferSelect & {
  schedulerStatus?: "idle" | "running" | null;
};
export type InsertConsultantSmtpSettings = typeof consultantSmtpSettings.$inferInsert;
export type UpdateConsultantSmtpSettings = z.infer<typeof updateConsultantSmtpSettingsSchema>;

// Vertex AI Settings types
export type VertexAiSettings = typeof vertexAiSettings.$inferSelect;
export type InsertVertexAiSettings = z.infer<typeof insertVertexAiSettingsSchema>;
export type UpdateVertexAiSettings = z.infer<typeof updateVertexAiSettingsSchema>;

// WhatsApp Vertex AI Settings types
export type WhatsappVertexAiSettings = typeof whatsappVertexAiSettings.$inferSelect;
export type InsertWhatsappVertexAiSettings = typeof whatsappVertexAiSettings.$inferInsert;

// SuperAdmin Vertex Config types
export type SuperadminVertexConfig = typeof superadminVertexConfig.$inferSelect;
export type InsertSuperadminVertexConfig = typeof superadminVertexConfig.$inferInsert;

// Admin TURN Config types
export type AdminTurnConfig = typeof adminTurnConfig.$inferSelect;
export type InsertAdminTurnConfig = typeof adminTurnConfig.$inferInsert;

// Consultant Vertex Access types
export type ConsultantVertexAccess = typeof consultantVertexAccess.$inferSelect;
export type InsertConsultantVertexAccess = typeof consultantVertexAccess.$inferInsert;

// SuperAdmin Gemini Config types
export type SuperadminGeminiConfig = typeof superadminGeminiConfig.$inferSelect;
export type InsertSuperadminGeminiConfig = typeof superadminGeminiConfig.$inferInsert;

// WhatsApp Gemini API Keys types
export type WhatsappGeminiApiKeys = typeof whatsappGeminiApiKeys.$inferSelect;
export type InsertWhatsappGeminiApiKeys = typeof whatsappGeminiApiKeys.$inferInsert;

// AI Assistant types
export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiUserPreferences = typeof aiUserPreferences.$inferSelect;
export type InsertAiUserPreferences = z.infer<typeof insertAiUserPreferencesSchema>;
export type CustomLivePrompt = typeof customLivePrompts.$inferSelect;
export type InsertCustomLivePrompt = z.infer<typeof insertCustomLivePromptSchema>;
export type AiWeeklyConsultation = typeof aiWeeklyConsultations.$inferSelect;
export type InsertAiWeeklyConsultation = z.infer<typeof insertAiWeeklyConsultationSchema>;
export type UpdateAiWeeklyConsultation = z.infer<typeof updateAiWeeklyConsultationSchema>;

// Calendar Events types
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

// Momentum - Productivity Tracking
export const momentumCheckins = pgTable("momentum_checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  activityDescription: text("activity_description").notNull(),
  isProductive: boolean("is_productive").notNull(),
  category: varchar("category", { length: 50 }),
  notes: text("notes"),
  mood: integer("mood"), // 1-5 scale
  energyLevel: integer("energy_level"), // 1-5 scale
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const momentumGoals = pgTable("momentum_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  targetDate: date("target_date"),
  progress: integer("progress").default(0), // 0-100
  category: varchar("category", { length: 50 }),
  status: text("status").notNull().$type<"active" | "completed" | "paused" | "cancelled">().default("active"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const momentumSettings = pgTable("momentum_settings", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  checkinIntervalMinutes: integer("checkin_interval_minutes").default(60),
  quietHoursEnabled: boolean("quiet_hours_enabled").default(true),
  quietHoursStart: text("quiet_hours_start").default("22:00"),
  quietHoursEnd: text("quiet_hours_end").default("08:00"),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  defaultProductiveCategories: jsonb("default_productive_categories").$type<string[]>().default(sql`'["lavoro", "studio", "esercizio fisico"]'::jsonb`),
  defaultBreakCategories: jsonb("default_break_categories").$type<string[]>().default(sql`'["pausa", "relax", "social"]'::jsonb`),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Percorso Capitale Finance Integration
export const userFinanceSettings = pgTable("user_finance_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  percorsoCapitaleEmail: text("percorso_capitale_email").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const insertUserFinanceSettingsSchema = createInsertSchema(userFinanceSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserFinanceSettings = typeof userFinanceSettings.$inferSelect;
export type InsertUserFinanceSettings = z.infer<typeof insertUserFinanceSettingsSchema>;

// Momentum schemas
export const insertMomentumCheckinSchema = createInsertSchema(momentumCheckins).omit({
  id: true,
  createdAt: true,
}).extend({
  timestamp: z.string().datetime().transform((val) => new Date(val)),
});

export const insertMomentumGoalSchema = createInsertSchema(momentumGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMomentumGoalSchema = insertMomentumGoalSchema.partial();

export const insertMomentumSettingsSchema = createInsertSchema(momentumSettings).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateMomentumSettingsSchema = insertMomentumSettingsSchema.partial().omit({
  userId: true,
});

// Momentum types
export type MomentumCheckin = typeof momentumCheckins.$inferSelect;
export type InsertMomentumCheckin = z.infer<typeof insertMomentumCheckinSchema>;
export type MomentumGoal = typeof momentumGoals.$inferSelect;
export type InsertMomentumGoal = z.infer<typeof insertMomentumGoalSchema>;
export type UpdateMomentumGoal = z.infer<typeof updateMomentumGoalSchema>;
export type MomentumSettings = typeof momentumSettings.$inferSelect;
export type InsertMomentumSettings = z.infer<typeof insertMomentumSettingsSchema>;
export type UpdateMomentumSettings = z.infer<typeof updateMomentumSettingsSchema>;

// Scheduler Execution Log types
export type SchedulerExecutionLog = typeof schedulerExecutionLog.$inferSelect;
export type InsertSchedulerExecutionLog = typeof schedulerExecutionLog.$inferInsert;

// Email Journey Templates types
export type EmailJourneyTemplate = typeof emailJourneyTemplates.$inferSelect;
export type InsertEmailJourneyTemplate = z.infer<typeof insertEmailJourneyTemplateSchema>;
export type UpdateEmailJourneyTemplate = z.infer<typeof updateEmailJourneyTemplateSchema>;

// Consultant Journey Templates types
export type ConsultantJourneyTemplate = typeof consultantJourneyTemplates.$inferSelect;
export type InsertConsultantJourneyTemplate = z.infer<typeof insertConsultantJourneyTemplateSchema>;
export type UpdateConsultantJourneyTemplate = z.infer<typeof updateConsultantJourneyTemplateSchema>;

// Client Email Journey Progress types
export type ClientEmailJourneyProgress = typeof clientEmailJourneyProgress.$inferSelect;
export type InsertClientEmailJourneyProgress = z.infer<typeof insertClientEmailJourneyProgressSchema>;
export type UpdateClientEmailJourneyProgress = z.infer<typeof updateClientEmailJourneyProgressSchema>;

// Email Drafts types
export type EmailDraft = typeof emailDrafts.$inferSelect;
export type InsertEmailDraft = z.infer<typeof insertEmailDraftSchema>;
export type UpdateEmailDraft = z.infer<typeof updateEmailDraftSchema>;

// Client Email Automation types
export type ClientEmailAutomation = typeof clientEmailAutomation.$inferSelect;
export type InsertClientEmailAutomation = z.infer<typeof insertClientEmailAutomationSchema>;
export type UpdateClientEmailAutomation = z.infer<typeof updateClientEmailAutomationSchema>;

// WhatsApp Integration Tables
export const consultantWhatsappConfig = pgTable("consultant_whatsapp_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentName: text("agent_name").notNull().default("Receptionist Principale"),
  integrationMode: text("integration_mode").$type<"whatsapp_ai" | "ai_only">().default("whatsapp_ai").notNull(),
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioWhatsappNumber: text("twilio_whatsapp_number"),
  isActive: boolean("is_active").default(true).notNull(),
  autoResponseEnabled: boolean("auto_response_enabled").default(true).notNull(),
  workingHoursEnabled: boolean("working_hours_enabled").default(false).notNull(),
  workingHoursStart: text("working_hours_start"),
  workingHoursEnd: text("working_hours_end"),
  workingDays: jsonb("working_days").$type<string[]>(),
  afterHoursMessage: text("after_hours_message"),

  // Business Profile
  businessName: text("business_name"),
  consultantDisplayName: text("consultant_display_name"), // Nome da mostrare nei messaggi (es: "Marco", "Dott. Rossi")
  businessDescription: text("business_description"),
  consultantBio: text("consultant_bio"),
  salesScript: text("sales_script"),

  // Authority & Positioning
  vision: text("vision"),
  mission: text("mission"),
  values: jsonb("values").$type<string[]>(),
  usp: text("usp"),

  // Who We Help & Don't Help
  whoWeHelp: text("who_we_help"),
  whoWeDontHelp: text("who_we_dont_help"),
  whatWeDo: text("what_we_do"),
  howWeDoIt: text("how_we_do_it"),

  // Software & Books
  softwareCreated: jsonb("software_created").$type<Array<{
    name: string;
    description: string;
    users?: string;
  }>>(),
  booksPublished: jsonb("books_published").$type<Array<{
    title: string;
    year: string;
    description: string;
    link?: string;
  }>>(),

  // Proof & Credibility
  yearsExperience: integer("years_experience"),
  clientsHelped: integer("clients_helped"),
  resultsGenerated: text("results_generated"),
  caseStudies: jsonb("case_studies").$type<Array<{
    clientName?: string;
    sector: string;
    before: string;
    after: string;
    timeFrame: string;
  }>>(),

  // Services & Guarantees
  servicesOffered: jsonb("services_offered").$type<Array<{
    name: string;
    description: string;
    forWho: string;
    investment: string;
  }>>(),
  guarantees: text("guarantees"),

  // AI Personality Configuration
  aiPersonality: text("ai_personality").$type<"amico_fidato" | "coach_motivazionale" | "consulente_professionale" | "mentore_paziente" | "venditore_energico" | "consigliere_empatico" | "stratega_diretto" | "educatore_socratico" | "esperto_tecnico" | "compagno_entusiasta">().default("amico_fidato"),

  // WhatsApp Conversation Style (only for clients)
  whatsappConciseMode: boolean("whatsapp_concise_mode").default(false).notNull(),

  // Agent Type: reactive (waits for messages) vs proactive (writes first) vs informative (teaches without booking) vs customer_success (post-sale) vs intake_coordinator (document collection)
  agentType: text("agent_type").$type<"reactive_lead" | "proactive_setter" | "informative_advisor" | "customer_success" | "intake_coordinator">().default("reactive_lead").notNull(),

  // WhatsApp Message Templates (ContentSid for proactive outreach)
  // PRECEDENCE: Custom template ID > Twilio SID > plaintext fallback
  // Only ONE source should be configured per slot (validated at runtime)
  whatsappTemplates: jsonb("whatsapp_templates").$type<{
    // Legacy Twilio SID (direct reference to approved template)
    openingMessageContentSid?: string;
    followUpGentleContentSid?: string;
    followUpValueContentSid?: string;
    followUpFinalContentSid?: string;
    // Custom template references (FK to whatsapp_custom_templates)
    openingTemplateId?: string;
    followUpGentleTemplateId?: string;
    followUpValueTemplateId?: string;
    followUpFinalTemplateId?: string;
  }>(),

  // Template body texts (for dry run preview and testing)
  // Stores the actual template text with {{1}}, {{2}}, etc. placeholders
  templateBodies: jsonb("template_bodies").$type<{
    openingMessageBody?: string;
    followUpGentleBody?: string;
    followUpValueBody?: string;
    followUpFinalBody?: string;
  }>(),

  // Proactive Lead Defaults (applied when creating leads without explicit values)
  defaultObiettivi: text("default_obiettivi"),
  defaultDesideri: text("default_desideri"),
  defaultUncino: text("default_uncino"),
  defaultIdealState: text("default_ideal_state"),

  // DRY RUN MODE - Per-agent test mode (simulates messages without sending)
  isDryRun: boolean("is_dry_run").default(true).notNull(),

  // Proactive Agent Mode - Can initiate conversations (outreach) instead of only responding
  isProactiveAgent: boolean("is_proactive_agent").default(false).notNull(),

  // Agent Instructions Configuration (migrazione da hardcoded a DB)
  agentInstructions: text("agent_instructions"),
  agentInstructionsEnabled: boolean("agent_instructions_enabled").default(false).notNull(),
  selectedTemplate: text("selected_template").$type<"receptionist" | "marco_setter" | "informative_advisor" | "customer_success" | "intake_coordinator" | "custom">(),

  // Feature Blocks Configuration (on/off per funzionalità modulari)
  bookingEnabled: boolean("booking_enabled").default(true).notNull(),
  objectionHandlingEnabled: boolean("objection_handling_enabled").default(true).notNull(),
  disqualificationEnabled: boolean("disqualification_enabled").default(true).notNull(),
  upsellingEnabled: boolean("upselling_enabled").default(false).notNull(),

  // Template Approval Status Cache (to avoid excessive Twilio API calls)
  templateApprovalStatus: jsonb("template_approval_status").$type<{
    [contentSid: string]: {
      status: "approved" | "pending" | "received" | "rejected" | "paused" | "disabled" | "not_submitted" | "unknown" | "error";
      checkedAt: string; // ISO timestamp
      reason?: string;
    };
  }>(),
  lastApprovalCheck: timestamp("last_approval_check"),

  // Business Header Configuration (come si presenta l'AI)
  businessHeaderMode: text("business_header_mode").$type<"assistant" | "direct_consultant" | "direct_professional" | "custom" | "none">().default("assistant"),
  professionalRole: text("professional_role"), // Es: "Insegnante di matematica", "Coach finanziario"
  customBusinessHeader: text("custom_business_header"), // Header completamente personalizzato

  // TTS (Text-to-Speech) Configuration for voice responses
  ttsEnabled: boolean("tts_enabled").default(false).notNull(),
  audioResponseMode: text("audio_response_mode").$type<"always_text" | "always_audio" | "mirror" | "always_both">().default("always_text").notNull(),

  // Agent-specific Google Calendar Integration (each agent can have its own calendar)
  googleCalendarId: text("google_calendar_id"), // Calendar ID (e.g., "primary" or specific calendar email)
  googleCalendarEmail: text("google_calendar_email"), // Email of connected Google account
  googleAccessToken: text("google_access_token"), // OAuth access token
  googleRefreshToken: text("google_refresh_token"), // OAuth refresh token
  googleTokenExpiry: timestamp("google_token_expiry"), // Token expiration timestamp
  calendarConnectedAt: timestamp("calendar_connected_at"), // When calendar was connected

  // Agent-specific Availability Settings (independent from consultant settings)
  availabilityTimezone: text("availability_timezone").default("Europe/Rome"),
  availabilityAppointmentDuration: integer("availability_appointment_duration").default(60), // minutes
  availabilityBufferBefore: integer("availability_buffer_before").default(15), // minutes before appointment
  availabilityBufferAfter: integer("availability_buffer_after").default(15), // minutes after appointment
  availabilityMaxDaysAhead: integer("availability_max_days_ahead").default(30), // max days in advance for booking
  availabilityMinHoursNotice: integer("availability_min_hours_notice").default(24), // minimum hours notice
  availabilityWorkingHours: jsonb("availability_working_hours").$type<{
    monday?: { enabled: boolean; start: string; end: string };
    tuesday?: { enabled: boolean; start: string; end: string };
    wednesday?: { enabled: boolean; start: string; end: string };
    thursday?: { enabled: boolean; start: string; end: string };
    friday?: { enabled: boolean; start: string; end: string };
    saturday?: { enabled: boolean; start: string; end: string };
    sunday?: { enabled: boolean; start: string; end: string };
  }>().default(sql`'{"monday":{"enabled":true,"start":"09:00","end":"18:00"},"tuesday":{"enabled":true,"start":"09:00","end":"18:00"},"wednesday":{"enabled":true,"start":"09:00","end":"18:00"},"thursday":{"enabled":true,"start":"09:00","end":"18:00"},"friday":{"enabled":true,"start":"09:00","end":"18:00"},"saturday":{"enabled":false,"start":"09:00","end":"13:00"},"sunday":{"enabled":false,"start":"09:00","end":"13:00"}}'::jsonb`),

  // Account references and notes for credential tracking (per service)
  twilioAccountReference: text("twilio_account_reference"), // Which Twilio account (e.g., "Account Twilio principale - console.twilio.com")
  twilioNotes: text("twilio_notes"), // Notes about Twilio configuration
  googleCalendarAccountReference: text("google_calendar_account_reference"), // Which Google account for calendar (e.g., "villonbajana2021@gmail.com")
  googleCalendarNotes: text("google_calendar_notes"), // Notes about Google Calendar configuration

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// WhatsApp Agent Knowledge Base Items - Modular knowledge system (text + documents)
export const whatsappAgentKnowledgeItems = pgTable("whatsapp_agent_knowledge_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentConfigId: varchar("agent_config_id").references(() => consultantWhatsappConfig.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(), // Es: "Listino Prezzi 2024", "FAQ Clienti"
  type: text("type").$type<"text" | "pdf" | "docx" | "txt">().notNull(), // Tipo di elemento
  content: text("content").notNull(), // Testo diretto (se type=text) o testo estratto dal documento
  filePath: text("file_path"), // Path del file caricato (solo per pdf/docx/txt)
  fileName: text("file_name"), // Nome originale del file (solo per pdf/docx/txt)
  fileSize: integer("file_size"), // Dimensione in bytes (solo per pdf/docx/txt)
  order: integer("order").default(0).notNull(), // Ordinamento (per drag & drop futuro)
  sourceConsultantDocId: varchar("source_consultant_doc_id").references(() => consultantKnowledgeDocuments.id, { onDelete: "set null" }), // ID del documento KB consulente da cui è stato importato
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const whatsappGlobalApiKeys = pgTable("whatsapp_global_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  apiKey: text("api_key").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  uniqueKeyPerConsultant: unique().on(table.consultantId, table.apiKey),
}));

export const whatsappConversations = pgTable("whatsapp_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentConfigId: varchar("agent_config_id").references(() => consultantWhatsappConfig.id, { onDelete: "cascade" }),
  aiEnabled: boolean("ai_enabled").default(true).notNull(),
  overriddenAt: timestamp("overridden_at"),
  overriddenBy: varchar("overridden_by").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  lastMessageAt: timestamp("last_message_at").default(sql`now()`),
  lastMessageFrom: text("last_message_from").$type<"client" | "consultant" | "ai">(),
  isLead: boolean("is_lead").default(false).notNull(),
  leadConvertedAt: timestamp("lead_converted_at"),
  isProactiveLead: boolean("is_proactive_lead").default(false).notNull(),
  proactiveLeadId: varchar("proactive_lead_id").references(() => proactiveLeads.id, { onDelete: "set null" }),
  proactiveLeadAssignedAt: timestamp("proactive_lead_assigned_at"),
  messageCount: integer("message_count").default(0).notNull(),
  unreadByConsultant: integer("unread_by_consultant").default(0).notNull(),
  lastResetAt: timestamp("last_reset_at"),
  testModeOverride: text("test_mode_override").$type<"client" | "lead" | "consulente">(),
  testModeUserId: varchar("test_mode_user_id").references(() => users.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").$type<{
    lastReadByConsultant?: string;
    tags?: string[];
    notes?: string;
  }>(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }).notNull(),
  messageText: text("message_text").notNull(),
  direction: text("direction").$type<"inbound" | "outbound">().notNull(),
  sender: text("sender").$type<"client" | "consultant" | "ai">().notNull(),
  mediaType: text("media_type").$type<"text" | "image" | "document" | "audio" | "video">().default("text"),
  mediaUrl: text("media_url"),
  mediaContentType: text("media_content_type"),
  mediaSize: integer("media_size"),
  localMediaPath: text("local_media_path"),
  isBatched: boolean("is_batched").default(false).notNull(),
  batchId: varchar("batch_id"),
  twilioSid: text("twilio_sid").unique(),
  twilioStatus: text("twilio_status").$type<"queued" | "sent" | "delivered" | "read" | "failed" | "undelivered">(),
  twilioErrorCode: text("twilio_error_code"),
  twilioErrorMessage: text("twilio_error_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  failedAt: timestamp("failed_at"),
  apiKeyUsed: varchar("api_key_used").references(() => whatsappGlobalApiKeys.id),
  metadata: jsonb("metadata").$type<{
    aiVisionAnalysis?: string;
    extractedText?: string;
    audioDuration?: number;
    audioTranscript?: string;
    simulated?: boolean;
    simulatedAt?: string;
    simulatedBy?: string;
  }>(),
  createdAt: timestamp("created_at").default(sql`now()`),
  processedAt: timestamp("processed_at"),
});

export const whatsappPendingMessages = pgTable("whatsapp_pending_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }).notNull(),
  phoneNumber: text("phone_number").notNull(),
  messageText: text("message_text").notNull(),
  mediaType: text("media_type"),
  mediaUrl: text("media_url"),
  mediaContentType: text("media_content_type"),
  twilioSid: text("twilio_sid"),
  receivedAt: timestamp("received_at").default(sql`now()`).notNull(),
  processedAt: timestamp("processed_at"),
  batchId: varchar("batch_id"),
  metadata: jsonb("metadata").$type<{
    simulated?: boolean;
    simulatedAt?: string;
    simulatedBy?: string;
  }>(),
});

export const whatsappMediaFiles = pgTable("whatsapp_media_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => whatsappMessages.id, { onDelete: "cascade" }).notNull(),
  originalUrl: text("original_url").notNull(),
  localPath: text("local_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  downloaded: boolean("downloaded").default(false).notNull(),
  downloadedAt: timestamp("downloaded_at"),
  aiProcessed: boolean("ai_processed").default(false).notNull(),
  aiAnalysis: text("ai_analysis"),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const whatsappApiKeyRotationLog = pgTable("whatsapp_api_key_rotation_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id").references(() => whatsappGlobalApiKeys.id).notNull(),
  phoneNumber: text("phone_number").notNull(),
  conversationId: varchar("conversation_id"),
  messageId: varchar("message_id"),
  usedAt: timestamp("used_at").default(sql`now()`).notNull(),
});

export const whatsappDailyStats = pgTable("whatsapp_daily_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  totalMessages: integer("total_messages").default(0).notNull(),
  inboundMessages: integer("inbound_messages").default(0).notNull(),
  outboundMessages: integer("outbound_messages").default(0).notNull(),
  uniqueContacts: integer("unique_contacts").default(0).notNull(),
  newLeads: integer("new_leads").default(0).notNull(),
  convertedLeads: integer("converted_leads").default(0).notNull(),
  avgResponseTimeSeconds: integer("avg_response_time_seconds"),
  aiResponses: integer("ai_responses").default(0).notNull(),
  manualResponses: integer("manual_responses").default(0).notNull(),
  imagesReceived: integer("images_received").default(0).notNull(),
  documentsReceived: integer("documents_received").default(0).notNull(),
  audioReceived: integer("audio_received").default(0).notNull(),
  messagesSent: integer("messages_sent").default(0).notNull(),
  messagesDelivered: integer("messages_delivered").default(0).notNull(),
  messagesRead: integer("messages_read").default(0).notNull(),
  messagesFailed: integer("messages_failed").default(0).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const whatsappFollowupReminders = pgTable("whatsapp_followup_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  triggerAfterHours: integer("trigger_after_hours").notNull(),
  lastMessageAt: timestamp("last_message_at").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  reminderType: text("reminder_type").$type<"lead_followup" | "client_checkin" | "consultation_reminder" | "custom">().notNull(),
  reminderMessage: text("reminder_message").notNull(),
  status: text("status").$type<"pending" | "sent" | "cancelled" | "failed">().default("pending").notNull(),
  sentAt: timestamp("sent_at"),
  failureReason: text("failure_reason"),
  receivedReply: boolean("received_reply").default(false).notNull(),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Objection Tracking System
export const objectionTracking = pgTable("objection_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }).notNull(),
  messageId: varchar("message_id").references(() => whatsappMessages.id, { onDelete: "cascade" }),
  objectionType: text("objection_type").$type<"price" | "time" | "trust" | "competitor" | "value" | "other">().notNull(),
  objectionText: text("objection_text").notNull(),
  aiResponse: text("ai_response"),
  wasResolved: boolean("was_resolved").default(false).notNull(),
  resolutionStrategy: text("resolution_strategy"),
  sentimentScore: real("sentiment_score"), // -1.0 to 1.0
  detectedAt: timestamp("detected_at").default(sql`now()`).notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const clientObjectionProfile = pgTable("client_objection_profile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number"), // For leads without userId
  difficultyScore: real("difficulty_score").default(5.0).notNull(), // 0-10 scale
  totalObjections: integer("total_objections").default(0).notNull(),
  resolvedObjections: integer("resolved_objections").default(0).notNull(),
  avgSentiment: real("avg_sentiment").default(0.0), // -1.0 to 1.0
  avgResponseTimeMinutes: integer("avg_response_time_minutes"),
  lastObjectionAt: timestamp("last_objection_at"),
  escalationRequired: boolean("escalation_required").default(false).notNull(),
  escalatedAt: timestamp("escalated_at"),
  profileType: text("profile_type").$type<"easy" | "neutral" | "difficult">().default("neutral").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// WhatsApp Polling Watermarks - Tracks last processed message timestamp per consultant
// This prevents re-downloading all messages from Twilio when local messages are deleted
export const whatsappPollingWatermarks = pgTable("whatsapp_polling_watermarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentConfigId: varchar("agent_config_id").references(() => consultantWhatsappConfig.id, { onDelete: "cascade" }).notNull().unique(),
  lastProcessedMessageDate: timestamp("last_processed_message_date").notNull(),
  lastProcessedTwilioSid: text("last_processed_twilio_sid"),
  messagesProcessedCount: integer("messages_processed_count").default(0).notNull(),
  lastPolledAt: timestamp("last_polled_at").default(sql`now()`).notNull(),
  consecutiveErrors: integer("consecutive_errors").default(0).notNull(),
  lastErrorAt: timestamp("last_error_at"),
  lastErrorMessage: text("last_error_message"),
  isCircuitBreakerOpen: boolean("is_circuit_breaker_open").default(false).notNull(),
  circuitBreakerOpenedAt: timestamp("circuit_breaker_opened_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Appointment Booking System
export const consultantAvailabilitySettings = pgTable("consultant_availability_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),

  // Google Service Account Credentials (NEW - simpler than OAuth)
  googleServiceAccountJson: jsonb("google_service_account_json").$type<{
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
  }>(),

  // Google OAuth Credentials (LEGACY - keeping for backward compatibility)
  googleOAuthClientId: text("google_oauth_client_id"),
  googleOAuthClientSecret: text("google_oauth_client_secret"),
  googleOAuthRedirectUri: text("google_oauth_redirect_uri"),

  // Google Calendar Integration
  googleCalendarId: text("google_calendar_id"),
  googleRefreshToken: text("google_refresh_token"),
  googleAccessToken: text("google_access_token"),
  googleTokenExpiresAt: timestamp("google_token_expires_at"),

  // Google Drive Integration
  googleDriveRefreshToken: text("google_drive_refresh_token"),
  googleDriveAccessToken: text("google_drive_access_token"),
  googleDriveTokenExpiresAt: timestamp("google_drive_token_expires_at"),
  googleDriveConnectedAt: timestamp("google_drive_connected_at"),
  googleDriveEmail: text("google_drive_email"),

  workingHours: jsonb("working_hours").$type<{
    monday?: { enabled: boolean; start: string; end: string };
    tuesday?: { enabled: boolean; start: string; end: string };
    wednesday?: { enabled: boolean; start: string; end: string };
    thursday?: { enabled: boolean; start: string; end: string };
    friday?: { enabled: boolean; start: string; end: string };
    saturday?: { enabled: boolean; start: string; end: string };
    sunday?: { enabled: boolean; start: string; end: string };
  }>().default(sql`'{}'::jsonb`),

  // AI Availability Configuration - when AI responds to WhatsApp messages
  aiAvailability: jsonb("ai_availability").$type<{
    enabled: boolean;
    workingDays: {
      monday?: { enabled: boolean; start: string; end: string };
      tuesday?: { enabled: boolean; start: string; end: string };
      wednesday?: { enabled: boolean; start: string; end: string };
      thursday?: { enabled: boolean; start: string; end: string };
      friday?: { enabled: boolean; start: string; end: string };
      saturday?: { enabled: boolean; start: string; end: string };
      sunday?: { enabled: boolean; start: string; end: string };
    };
  }>().default(sql`'{"enabled": true, "workingDays": {}}'::jsonb`),

  // Appointment Availability Configuration - when clients can book appointments
  appointmentAvailability: jsonb("appointment_availability").$type<{
    enabled: boolean;
    workingDays: {
      monday?: { enabled: boolean; start: string; end: string };
      tuesday?: { enabled: boolean; start: string; end: string };
      wednesday?: { enabled: boolean; start: string; end: string };
      thursday?: { enabled: boolean; start: string; end: string };
      friday?: { enabled: boolean; start: string; end: string };
      saturday?: { enabled: boolean; start: string; end: string };
      sunday?: { enabled: boolean; start: string; end: string };
    };
    morningSlot?: { start: string; end: string };
    afternoonSlot?: { start: string; end: string };
    appointmentDuration: number;
    bufferBefore: number;
    bufferAfter: number;
    maxDaysInAdvance: number;
    minNoticeHours: number;
  }>().default(sql`'{"enabled": true, "workingDays": {}, "appointmentDuration": 60, "bufferBefore": 15, "bufferAfter": 15, "maxDaysInAdvance": 30, "minNoticeHours": 24}'::jsonb`),

  appointmentDuration: integer("appointment_duration").default(60).notNull(), // minutes
  bufferBefore: integer("buffer_before").default(15).notNull(), // minutes
  bufferAfter: integer("buffer_after").default(15).notNull(), // minutes
  morningSlotStart: text("morning_slot_start").default("09:00").notNull(),
  morningSlotEnd: text("morning_slot_end").default("13:00").notNull(),
  afternoonSlotStart: text("afternoon_slot_start").default("14:00").notNull(),
  afternoonSlotEnd: text("afternoon_slot_end").default("18:00").notNull(),
  maxDaysAhead: integer("max_days_ahead").default(30).notNull(),
  minHoursNotice: integer("min_hours_notice").default(24).notNull(),
  timezone: text("timezone").default("Europe/Rome").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const consultantCalendarSync = pgTable("consultant_calendar_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  googleEventId: text("google_event_id").notNull(),
  title: text("title").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  source: text("source").$type<"google" | "local">().default("google").notNull(),
  syncedAt: timestamp("synced_at").default(sql`now()`).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const appointmentBookings = pgTable("appointment_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }),
  publicConversationId: varchar("public_conversation_id"), // For public link bookings (references whatsappAgentConsultantConversations)
  source: text("source").$type<"whatsapp" | "public_link">().default("whatsapp").notNull(), // Booking source
  clientPhone: text("client_phone"), // Nullable for public link bookings
  clientName: text("client_name"),
  clientSurname: text("client_surname"),
  clientEmail: text("client_email"),
  appointmentDate: date("appointment_date").notNull(),
  appointmentTime: text("appointment_time").notNull(),
  appointmentEndTime: text("appointment_end_time"),
  googleEventId: text("google_event_id"),
  calendarEventId: varchar("calendar_event_id").references(() => calendarEvents.id),
  status: text("status").$type<"proposed" | "confirmed" | "cancelled" | "completed">().default("proposed").notNull(),
  proposedSlots: jsonb("proposed_slots").$type<Array<{
    date: string;
    time: string;
    period: "morning" | "afternoon";
  }>>().default(sql`'[]'::jsonb`),
  cancellationReason: text("cancellation_reason"),
  confirmedAt: timestamp("confirmed_at"),
  cancelledAt: timestamp("cancelled_at"),
  completedAt: timestamp("completed_at"),
  lastCompletedAction: jsonb("last_completed_action").$type<{
    type: 'MODIFY' | 'CANCEL' | 'ADD_ATTENDEES';
    completedAt: string;
    triggerMessageId: string;
    details?: {
      oldDate?: string;
      oldTime?: string;
      newDate?: string;
      newTime?: string;
      attendeesAdded?: string[];
    };
  }>(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Proposed Appointment Slots - Fixes availableSlots scope bug
export const proposedAppointmentSlots = pgTable("proposed_appointment_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  slots: jsonb("slots").$type<Array<{
    start: Date;
    end: Date;
    formatted: string;
  }>>().notNull(),
  proposedAt: timestamp("proposed_at").default(sql`now()`).notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 24 hours from proposedAt
  usedForBooking: boolean("used_for_booking").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// WhatsApp schema validators
export const insertConsultantWhatsappConfigSchema = createInsertSchema(consultantWhatsappConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappAgentKnowledgeItemSchema = createInsertSchema(whatsappAgentKnowledgeItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateWhatsappAgentKnowledgeItemSchema = insertWhatsappAgentKnowledgeItemSchema.partial();

export const insertWhatsappGlobalApiKeySchema = createInsertSchema(whatsappGlobalApiKeys).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappMediaFileSchema = createInsertSchema(whatsappMediaFiles).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappApiKeyRotationLogSchema = createInsertSchema(whatsappApiKeyRotationLog).omit({
  id: true,
});

export const insertWhatsappDailyStatsSchema = createInsertSchema(whatsappDailyStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappFollowupReminderSchema = createInsertSchema(whatsappFollowupReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertObjectionTrackingSchema = createInsertSchema(objectionTracking).omit({
  id: true,
  createdAt: true,
});

export const insertClientObjectionProfileSchema = createInsertSchema(clientObjectionProfile).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsultantAvailabilitySettingsSchema = createInsertSchema(consultantAvailabilitySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsultantCalendarSyncSchema = createInsertSchema(consultantCalendarSync).omit({
  id: true,
  createdAt: true,
});

export const insertAppointmentBookingSchema = createInsertSchema(appointmentBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposedAppointmentSlotsSchema = createInsertSchema(proposedAppointmentSlots).omit({
  id: true,
  createdAt: true,
});

// Booking Extraction State - Accumulator pattern for progressive data extraction
// Stores partially extracted booking data to prevent field loss during re-extraction
export const bookingExtractionState = pgTable("booking_extraction_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }),
  publicConversationId: varchar("public_conversation_id"), // For public link conversations
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Accumulated extracted data (null = not yet extracted, empty string = explicitly empty)
  extractedDate: text("extracted_date"),
  extractedTime: text("extracted_time"),
  extractedPhone: text("extracted_phone"),
  extractedEmail: text("extracted_email"),
  extractedName: text("extracted_name"),
  
  // Last extraction confidence
  confidence: text("confidence").$type<"high" | "medium" | "low">(),
  
  // State management
  completedAt: timestamp("completed_at"), // Set when booking is completed
  expiresAt: timestamp("expires_at").notNull(), // Auto-expire after 24h of inactivity
  
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueWhatsappConversation: unique().on(table.conversationId),
  uniquePublicConversation: unique().on(table.publicConversationId),
}));

export const insertBookingExtractionStateSchema = createInsertSchema(bookingExtractionState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Marketing Campaigns - Configurazione campagne di marketing
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Campaign Info
  campaignName: text("campaign_name").notNull(),
  campaignType: text("campaign_type").$type<"outbound_ads" | "inbound_form" | "referral" | "recovery" | "partner" | "walk_in">().notNull(),
  leadCategory: text("lead_category").$type<"freddo" | "tiepido" | "caldo" | "recupero" | "referral">().default("freddo").notNull(),

  // Campaign Positioning & Messaging
  hookText: text("hook_text"), // Uncino principale della campagna
  idealStateDescription: text("ideal_state_description"), // Stato ideale del lead
  implicitDesires: text("implicit_desires"), // Desiderio implicito del lead
  defaultObiettivi: text("default_obiettivi"), // Obiettivi predefiniti

  // Agent & Template Configuration
  preferredAgentConfigId: varchar("preferred_agent_config_id").references(() => consultantWhatsappConfig.id, { onDelete: "set null" }),

  // Custom templates per campagna (opzionali - se null usa quelli dell'agent)
  openingTemplateId: varchar("opening_template_id").references(() => whatsappCustomTemplates.id, { onDelete: "set null" }),
  followupGentleTemplateId: varchar("followup_gentle_template_id").references(() => whatsappCustomTemplates.id, { onDelete: "set null" }),
  followupValueTemplateId: varchar("followup_value_template_id").references(() => whatsappCustomTemplates.id, { onDelete: "set null" }),
  followupFinalTemplateId: varchar("followup_final_template_id").references(() => whatsappCustomTemplates.id, { onDelete: "set null" }),

  // Metrics (calculated from leads)
  totalLeads: integer("total_leads").default(0).notNull(),
  convertedLeads: integer("converted_leads").default(0).notNull(),
  conversionRate: real("conversion_rate").default(0),

  // Status
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueCampaignName: unique().on(table.consultantId, table.campaignName),
}));

// Campaign Analytics - Metriche aggregate giornaliere per campagna
export const campaignAnalytics = pgTable("campaign_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => marketingCampaigns.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),

  // Daily metrics
  leadsCreated: integer("leads_created").default(0).notNull(),
  leadsContacted: integer("leads_contacted").default(0).notNull(),
  leadsResponded: integer("leads_responded").default(0).notNull(),
  leadsConverted: integer("leads_converted").default(0).notNull(),

  // Calculated metrics
  avgResponseTimeHours: real("avg_response_time_hours"),
  conversionRate: real("conversion_rate").default(0),

  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  uniqueCampaignDate: unique().on(table.campaignId, table.date),
}));

// Proactive Leads for Setter Agents
export const proactiveLeads = pgTable("proactive_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentConfigId: varchar("agent_config_id").references(() => consultantWhatsappConfig.id, { onDelete: "cascade" }).notNull(),

  // Campaign Association (NEW)
  campaignId: varchar("campaign_id").references(() => marketingCampaigns.id, { onDelete: "set null" }),
  leadCategory: text("lead_category").$type<"freddo" | "tiepido" | "caldo" | "recupero" | "referral">(),

  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phoneNumber: text("phone_number").notNull(),

  // Lead Information (extended for Hubdigital.io webhook data)
  leadInfo: jsonb("lead_info").$type<{
    obiettivi?: string;
    desideri?: string;
    uncino?: string;
    fonte?: string;
    // Contact info
    email?: string;
    companyName?: string;
    website?: string;
    customFields?: Array<{ id: string; value: any }> | Record<string, any>;
    dateAdded?: string;
    dateOfBirth?: string;
    // Address
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    // GHL reference IDs
    ghlContactId?: string;
    ghlLocationId?: string;
    assignedTo?: string;
    // Tags and DND
    tags?: string[];
    dnd?: boolean;
    dndSettings?: {
      SMS?: { status: string; message?: string; code?: string };
      Email?: { status: string; message?: string; code?: string };
      WhatsApp?: { status: string; message?: string; code?: string };
      Call?: { status: string; message?: string; code?: string };
      FB?: { status: string; message?: string; code?: string };
      GMB?: { status: string; message?: string; code?: string };
    };
  }>().default(sql`'{}'::jsonb`),
  idealState: text("ideal_state"),

  // Scheduling
  contactSchedule: timestamp("contact_schedule").notNull(),
  contactFrequency: integer("contact_frequency").default(7).notNull(), // giorni tra follow-up
  lastContactedAt: timestamp("last_contacted_at"),
  lastMessageSent: text("last_message_sent"),

  // Status tracking
  // 'processing' = temporary lock during message send (race condition protection)
  // 'lost' = lead marked as uncontactable (template error, etc)
  status: text("status").$type<"pending" | "processing" | "contacted" | "responded" | "converted" | "inactive" | "lost">().default("pending").notNull(),

  // Metadata
  metadata: jsonb("metadata").$type<{
    tags?: string[];
    notes?: string;
    conversationId?: string;
  }>().default(sql`'{}'::jsonb`),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniquePhonePerConsultant: unique().on(table.consultantId, table.phoneNumber),
}));

// Marketing Campaigns validation schemas
export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({
  id: true,
  totalLeads: true,
  convertedLeads: true,
  conversionRate: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  campaignName: z.string().min(1, "Il nome della campagna è obbligatorio"),
  campaignType: z.enum(["outbound_ads", "inbound_form", "referral", "recovery", "partner", "walk_in"]),
  leadCategory: z.enum(["freddo", "tiepido", "caldo", "recupero", "referral"]).default("freddo"),
});

export const updateMarketingCampaignSchema = insertMarketingCampaignSchema.partial().omit({
  consultantId: true,
});

// Campaign Analytics validation schemas
export const insertCampaignAnalyticsSchema = createInsertSchema(campaignAnalytics).omit({
  id: true,
  createdAt: true,
});

// Marketing Campaigns types
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;
export type UpdateMarketingCampaign = z.infer<typeof updateMarketingCampaignSchema>;
export type CampaignAnalytics = typeof campaignAnalytics.$inferSelect;
export type InsertCampaignAnalytics = z.infer<typeof insertCampaignAnalyticsSchema>;

// Proactive Leads validation schemas (updated)
export const insertProactiveLeadSchema = createInsertSchema(proactiveLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProactiveLeadSchema = insertProactiveLeadSchema.partial().omit({
  consultantId: true,
});

// Proactive Leads types
export type ProactiveLead = typeof proactiveLeads.$inferSelect;
export type InsertProactiveLead = z.infer<typeof insertProactiveLeadSchema>;
export type UpdateProactiveLead = z.infer<typeof updateProactiveLeadSchema>;

// Proactive Lead Activity Logs - Log delle attività dei lead proattivi
export const proactiveLeadActivityLogs = pgTable("proactive_lead_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => proactiveLeads.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentConfigId: varchar("agent_config_id").references(() => consultantWhatsappConfig.id, { onDelete: "set null" }),

  // Event type
  eventType: text("event_type").$type<
    "created" | "scheduled" | "processing" | "sent" | "failed" | "skipped" | "responded" | "converted" | "manual_trigger"
  >().notNull(),

  // Event details
  eventMessage: text("event_message").notNull(),
  eventDetails: jsonb("event_details").$type<{
    templateSid?: string;
    templateName?: string;
    messageType?: string;
    skipReason?: string;
    errorMessage?: string;
    twilioMessageSid?: string;
    isDryRun?: boolean;
    workingHoursCheck?: boolean;
    templateVariables?: Record<string, string>;
  }>().default(sql`'{}'::jsonb`),

  // Status at time of event
  leadStatusAtEvent: text("lead_status_at_event").$type<"pending" | "contacted" | "responded" | "converted" | "inactive">(),

  createdAt: timestamp("created_at").default(sql`now()`),
});

export type ProactiveLeadActivityLog = typeof proactiveLeadActivityLogs.$inferSelect;
export type InsertProactiveLeadActivityLog = typeof proactiveLeadActivityLogs.$inferInsert;

// WhatsApp Template System Tables

// Variable catalog - defines all available variables for templates
export const whatsappVariableCatalog = pgTable("whatsapp_variable_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  variableKey: text("variable_key").unique().notNull(), // "nome_lead" (without braces)
  variableName: text("variable_name").notNull(), // "Nome Lead"
  description: text("description").notNull(), // "Il nome del potenziale cliente"
  sourceType: text("source_type").$type<"lead" | "agent_config" | "consultant" | "computed">().notNull(),
  sourcePath: text("source_path").notNull(), // "firstName" or "consultantDisplayName"
  fallbackSourcePath: text("fallback_source_path"), // Alternative path if primary is null
  fallbackValue: text("fallback_value"), // Static fallback if all paths fail
  dataType: text("data_type").$type<"string" | "number" | "boolean">().default("string").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Custom templates metadata (consultant-owned template definitions)
export const whatsappCustomTemplates = pgTable("whatsapp_custom_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  templateName: text("template_name").notNull(),
  templateType: text("template_type").$type<"opening" | "followup_gentle" | "followup_value" | "followup_final">(), // DEPRECATED: kept for backward compatibility, use useCase instead
  useCase: text("use_case"), // Freeform text describing template purpose: "primo contatto", "follow-up dopo demo", "richiesta referral", etc.
  description: text("description"), // Optional description of template purpose
  body: text("body"), // Template body text (moved from versions for simpler access)
  isActive: boolean("is_active").default(true).notNull(), // Quick filter for active templates
  archivedAt: timestamp("archived_at"), // NULL = active, set = archived
  // NEW: System template fields
  isSystemTemplate: boolean("is_system_template").default(false).notNull(), // True = default template from system
  targetAgentType: text("target_agent_type").$type<"receptionist" | "proactive_setter" | "informative_advisor" | "customer_success" | "intake_coordinator">(), // Target agent type for this template
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});
// NOTE: Removed UNIQUE constraint on (consultantId, templateType) to allow unlimited templates per consultant

// Template versions - each edit creates a new version
export const whatsappTemplateVersions = pgTable("whatsapp_template_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => whatsappCustomTemplates.id, { onDelete: "cascade" }).notNull(),
  versionNumber: integer("version_number").notNull(), // Incrementing version (1, 2, 3, ...)
  bodyText: text("body_text").notNull(), // Text with {nome_lead}, {nome_consulente}, etc.
  twilioContentSid: text("twilio_content_sid"), // Set after export to Twilio
  twilioStatus: text("twilio_status").$type<"not_synced" | "pending" | "approved" | "rejected">().default("not_synced").notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  isActive: boolean("is_active").default(false).notNull(), // Only one active version per template
  createdAt: timestamp("created_at").default(sql`now()`),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }), // Track who created this version
}, (table) => ({
  // Version number must be unique per template
  uniqueVersionNumber: unique().on(table.templateId, table.versionNumber),
  // NOTE: uniqueActiveVersion constraint is added as partial index in migration
  // to allow multiple inactive versions: WHERE is_active = true
}));

// Template variables mapping - links template versions to catalog variables with ordering
export const whatsappTemplateVariables = pgTable("whatsapp_template_variables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateVersionId: varchar("template_version_id").references(() => whatsappTemplateVersions.id, { onDelete: "cascade" }).notNull(),
  variableCatalogId: varchar("variable_catalog_id").references(() => whatsappVariableCatalog.id, { onDelete: "restrict" }).notNull(),
  position: integer("position").notNull(), // Position in Twilio template: 1 = {{1}}, 2 = {{2}}, etc.
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  // Ensure each position is unique per template version
  uniquePositionPerVersion: unique().on(table.templateVersionId, table.position),
  // Ensure each variable is only used once per template version
  uniqueVariablePerVersion: unique().on(table.templateVersionId, table.variableCatalogId),
}));

// Template assignments - links custom templates to WhatsApp agent configurations
// Allows N templates per agent - AI will choose the most appropriate one based on context
export const whatsappTemplateAssignments = pgTable("whatsapp_template_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentConfigId: varchar("agent_config_id")
    .references(() => consultantWhatsappConfig.id, { onDelete: "cascade" })
    .notNull(),
  templateId: varchar("template_id").notNull(),
  templateType: text("template_type")
    .$type<"opening" | "followup_gentle" | "followup_value" | "followup_final" | "twilio">(), // Supports custom templates and Twilio built-in templates
  priority: integer("priority").default(0), // Higher priority = preferred by AI when multiple templates match
  assignedAt: timestamp("assigned_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});
// NOTE: Removed UNIQUE constraint on (agentConfigId, templateType) to allow N templates per agent

// Sample data for template preview
export const whatsappTemplateSamples = pgTable("whatsapp_template_samples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  templateId: varchar("template_id").references(() => whatsappCustomTemplates.id, { onDelete: "cascade" }), // Optional: link to specific template
  sampleName: text("sample_name").notNull(),
  sampleData: jsonb("sample_data").$type<Record<string, string>>().notNull(), // {"nome_lead": "Mario", ...}
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  // Only one default sample per consultant (for global defaults) or per template
  uniqueDefaultPerConsultant: unique().on(table.consultantId, table.isDefault),
}));

// Template assignments relations
export const whatsappTemplateAssignmentsRelations = relations(
  whatsappTemplateAssignments,
  ({ one }) => ({
    agentConfig: one(consultantWhatsappConfig, {
      fields: [whatsappTemplateAssignments.agentConfigId],
      references: [consultantWhatsappConfig.id],
    }),
    template: one(whatsappCustomTemplates, {
      fields: [whatsappTemplateAssignments.templateId],
      references: [whatsappCustomTemplates.id],
    }),
  })
);

// Template validation schemas
export const insertWhatsappVariableCatalogSchema = createInsertSchema(whatsappVariableCatalog).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappCustomTemplateSchema = createInsertSchema(whatsappCustomTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateWhatsappCustomTemplateSchema = insertWhatsappCustomTemplateSchema.partial().omit({
  consultantId: true,
});

export const insertWhatsappTemplateVersionSchema = createInsertSchema(whatsappTemplateVersions).omit({
  id: true,
  createdAt: true,
});

export const updateWhatsappTemplateVersionSchema = insertWhatsappTemplateVersionSchema.partial().omit({
  templateId: true,
  versionNumber: true,
});

export const insertWhatsappTemplateVariableSchema = createInsertSchema(whatsappTemplateVariables).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappTemplateSampleSchema = createInsertSchema(whatsappTemplateSamples).omit({
  id: true,
  createdAt: true,
});

// Template types
export type WhatsappVariableCatalog = typeof whatsappVariableCatalog.$inferSelect;
export type InsertWhatsappVariableCatalog = z.infer<typeof insertWhatsappVariableCatalogSchema>;
export type WhatsappCustomTemplate = typeof whatsappCustomTemplates.$inferSelect;
export type InsertWhatsappCustomTemplate = z.infer<typeof insertWhatsappCustomTemplateSchema>;
export type UpdateWhatsappCustomTemplate = z.infer<typeof updateWhatsappCustomTemplateSchema>;
export type WhatsappTemplateVersion = typeof whatsappTemplateVersions.$inferSelect;
export type InsertWhatsappTemplateVersion = z.infer<typeof insertWhatsappTemplateVersionSchema>;
export type UpdateWhatsappTemplateVersion = z.infer<typeof updateWhatsappTemplateVersionSchema>;
export type WhatsappTemplateVariable = typeof whatsappTemplateVariables.$inferSelect;
export type InsertWhatsappTemplateVariable = z.infer<typeof insertWhatsappTemplateVariableSchema>;
export type WhatsappTemplateSample = typeof whatsappTemplateSamples.$inferSelect;
export type InsertWhatsappTemplateSample = z.infer<typeof insertWhatsappTemplateSampleSchema>;
export type WhatsAppTemplateAssignment = typeof whatsappTemplateAssignments.$inferSelect;
export type NewWhatsAppTemplateAssignment = typeof whatsappTemplateAssignments.$inferInsert;

// WhatsApp types
export type ConsultantWhatsappConfig = typeof consultantWhatsappConfig.$inferSelect;
export type InsertConsultantWhatsappConfig = z.infer<typeof insertConsultantWhatsappConfigSchema>;
export type WhatsappAgentKnowledgeItem = typeof whatsappAgentKnowledgeItems.$inferSelect;
export type InsertWhatsappAgentKnowledgeItem = z.infer<typeof insertWhatsappAgentKnowledgeItemSchema>;
export type UpdateWhatsappAgentKnowledgeItem = z.infer<typeof updateWhatsappAgentKnowledgeItemSchema>;
export type WhatsappGlobalApiKey = typeof whatsappGlobalApiKeys.$inferSelect;
export type InsertWhatsappGlobalApiKey = z.infer<typeof insertWhatsappGlobalApiKeySchema>;
export type WhatsappConversation = typeof whatsappConversations.$inferSelect;
export type InsertWhatsappConversation = z.infer<typeof insertWhatsappConversationSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappPendingMessage = typeof whatsappPendingMessages.$inferSelect;
export type WhatsappMediaFile = typeof whatsappMediaFiles.$inferSelect;
export type InsertWhatsappMediaFile = z.infer<typeof insertWhatsappMediaFileSchema>;
export type WhatsappApiKeyRotationLog = typeof whatsappApiKeyRotationLog.$inferSelect;
export type InsertWhatsappApiKeyRotationLog = z.infer<typeof insertWhatsappApiKeyRotationLogSchema>;
export type WhatsappDailyStats = typeof whatsappDailyStats.$inferSelect;
export type InsertWhatsappDailyStats = z.infer<typeof insertWhatsappDailyStatsSchema>;
export type WhatsappFollowupReminder = typeof whatsappFollowupReminders.$inferSelect;
export type InsertWhatsappFollowupReminder = z.infer<typeof insertWhatsappFollowupReminderSchema>;

// Objection Tracking types
export type ObjectionTracking = typeof objectionTracking.$inferSelect;
export type InsertObjectionTracking = z.infer<typeof insertObjectionTrackingSchema>;
export type ClientObjectionProfile = typeof clientObjectionProfile.$inferSelect;
export type InsertClientObjectionProfile = z.infer<typeof insertClientObjectionProfileSchema>;

// Appointment Booking types
export type ConsultantAvailabilitySettings = typeof consultantAvailabilitySettings.$inferSelect;
export type InsertConsultantAvailabilitySettings = z.infer<typeof insertConsultantAvailabilitySettingsSchema>;
export type ConsultantCalendarSync = typeof consultantCalendarSync.$inferSelect;
export type InsertConsultantCalendarSync = z.infer<typeof insertConsultantCalendarSyncSchema>;
export type AppointmentBooking = typeof appointmentBookings.$inferSelect;
export type InsertAppointmentBooking = z.infer<typeof insertAppointmentBookingSchema>;
export type ProposedAppointmentSlots = typeof proposedAppointmentSlots.$inferSelect;
export type InsertProposedAppointmentSlots = z.infer<typeof insertProposedAppointmentSlotsSchema>;
export type BookingExtractionState = typeof bookingExtractionState.$inferSelect;
export type InsertBookingExtractionState = z.infer<typeof insertBookingExtractionStateSchema>;

// External API Configuration - for importing leads from external systems
export const externalApiConfigs = pgTable("external_api_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Configuration naming
  configName: text("config_name").notNull(), // "Metodo Orbitale Import", "Recovery Leads API"

  // API Credentials (encrypted at rest)
  apiKey: text("api_key").notNull(), // Encrypted API key
  baseUrl: text("base_url").notNull(), // https://api.example.com

  // Lead Import Settings
  leadType: text("lead_type").$type<"crm" | "marketing" | "both">().default("both").notNull(),

  // Optional Filters
  sourceFilter: text("source_filter"), // e.g., "facebook", "landing-page-orbitale"
  campaignFilter: text("campaign_filter"), // e.g., "metodo-orbitale"
  daysFilter: text("days_filter"), // e.g., "7", "30", "all"

  // Mapping to Marketing Campaign (optional)
  targetCampaignId: varchar("target_campaign_id").references(() => marketingCampaigns.id, { onDelete: "set null" }),

  // Polling Configuration
  pollingEnabled: boolean("polling_enabled").default(false).notNull(),
  pollingIntervalMinutes: integer("polling_interval_minutes").default(5).notNull(), // Default: 5 minutes

  // Status & Tracking
  isActive: boolean("is_active").default(true).notNull(),
  lastImportAt: timestamp("last_import_at"),
  lastImportStatus: text("last_import_status").$type<"success" | "error" | "never">().default("never"),
  lastImportLeadsCount: integer("last_import_leads_count").default(0),
  lastImportErrorMessage: text("last_import_error_message"),

  // Scheduling metadata
  nextScheduledRun: timestamp("next_scheduled_run"),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueConfigName: unique().on(table.consultantId, table.configName),
}));

// External Lead Import Logs - audit trail for imports
export const externalLeadImportLogs = pgTable("external_lead_import_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").references(() => externalApiConfigs.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Import metadata
  importType: text("import_type").$type<"manual" | "scheduled">().notNull(),
  status: text("status").$type<"success" | "partial" | "error">().notNull(),

  // Results
  leadsProcessed: integer("leads_processed").default(0).notNull(),
  leadsImported: integer("leads_imported").default(0).notNull(), // New leads created
  leadsUpdated: integer("leads_updated").default(0).notNull(), // Existing leads updated
  leadsDuplicated: integer("leads_duplicated").default(0).notNull(), // Skipped duplicates
  leadsErrored: integer("leads_errored").default(0).notNull(),

  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details").$type<{
    failedLeads?: Array<{ phoneNumber: string; error: string }>;
    apiError?: string;
  }>(),

  // Duration
  startedAt: timestamp("started_at").default(sql`now()`).notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),

  createdAt: timestamp("created_at").default(sql`now()`),
});

// External API Config validation schemas
export const insertExternalApiConfigSchema = createInsertSchema(externalApiConfigs).omit({
  id: true,
  lastImportAt: true,
  lastImportStatus: true,
  lastImportLeadsCount: true,
  lastImportErrorMessage: true,
  nextScheduledRun: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  configName: z.string().min(1, "Il nome della configurazione è obbligatorio"),
  apiKey: z.string().min(10, "API key non valida"),
  baseUrl: z.string().url("URL base non valido"),
  leadType: z.enum(["crm", "marketing", "both"]).default("both"),
  pollingIntervalMinutes: z.number().min(1).max(1440), // Max: 24 hours
});

export const updateExternalApiConfigSchema = insertExternalApiConfigSchema.partial().omit({
  consultantId: true,
});

// External Lead Import Log validation schemas
export const insertExternalLeadImportLogSchema = createInsertSchema(externalLeadImportLogs).omit({
  id: true,
  createdAt: true,
});

// External API types
export type ExternalApiConfig = typeof externalApiConfigs.$inferSelect;
export type InsertExternalApiConfig = z.infer<typeof insertExternalApiConfigSchema>;
export type UpdateExternalApiConfig = z.infer<typeof updateExternalApiConfigSchema>;
export type ExternalLeadImportLog = typeof externalLeadImportLogs.$inferSelect;
export type InsertExternalLeadImportLog = z.infer<typeof insertExternalLeadImportLogSchema>;

// Webhook Configurations - Hubdigital.io and other webhook providers
export const webhookConfigs = pgTable("webhook_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Provider identification
  providerName: text("provider_name").notNull(), // "hubdigital", "altro_webhook"
  displayName: text("display_name").notNull(), // "Hubdigital.io"
  configName: text("config_name"), // Custom name to distinguish multiple configs (e.g., "Campagna Facebook", "Campagna Google")

  // Security
  secretKey: text("secret_key").notNull(), // Unique secret key for webhook authentication

  // Agent Association - which WhatsApp agent should handle leads from this webhook
  agentConfigId: varchar("agent_config_id").references(() => consultantWhatsappConfig.id, { onDelete: "set null" }),

  // Mapping to Marketing Campaign (optional)
  targetCampaignId: varchar("target_campaign_id").references(() => marketingCampaigns.id, { onDelete: "set null" }),

  // Default source to override payload source (if set, ignores payload.source)
  defaultSource: text("default_source"),

  // Status & Tracking
  isActive: boolean("is_active").default(true).notNull(),
  lastWebhookAt: timestamp("last_webhook_at"), // Last webhook received timestamp
  totalLeadsReceived: integer("total_leads_received").default(0).notNull(),
  skippedLeadsCount: integer("skipped_leads_count").default(0).notNull(), // Leads filtered out by source filter

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  // Unique secret key for security
  uniqueSecretKey: unique().on(table.secretKey),
}));

// Webhook Config validation schemas
export const insertWebhookConfigSchema = createInsertSchema(webhookConfigs).omit({
  id: true,
  lastWebhookAt: true,
  totalLeadsReceived: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  providerName: z.string().min(1, "Il nome del provider è obbligatorio"),
  displayName: z.string().min(1, "Il nome visualizzato è obbligatorio"),
  configName: z.string().optional(),
  secretKey: z.string().min(16, "La chiave segreta deve essere almeno 16 caratteri"),
  agentConfigId: z.string().optional().nullable(),
});

export const updateWebhookConfigSchema = insertWebhookConfigSchema.partial().omit({
  consultantId: true,
});

// Webhook Config types
export type WebhookConfig = typeof webhookConfigs.$inferSelect;
export type InsertWebhookConfig = z.infer<typeof insertWebhookConfigSchema>;
export type UpdateWebhookConfig = z.infer<typeof updateWebhookConfigSchema>;

// System Errors (centralized error tracking)
export const systemErrors = pgTable("system_errors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentConfigId: varchar("agent_config_id").references(() => consultantWhatsappConfig.id, { onDelete: "cascade" }),

  // Error classification
  errorType: text("error_type").notNull().$type<
    "template_not_approved" |
    "twilio_auth_failed" |
    "duplicate_lead" |
    "message_send_failed" |
    "invalid_credentials" |
    "configuration_error"
  >(),
  errorMessage: text("error_message").notNull(),
  errorDetails: jsonb("error_details").$type<{
    leadId?: string;
    phoneNumber?: string;
    templateSid?: string;
    twilioError?: string;
    stackTrace?: string;
    [key: string]: any;
  }>(),

  // Status tracking
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolutionNotes: text("resolution_notes"),

  // Timestamps
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// System Errors types
export type SystemError = typeof systemErrors.$inferSelect;
export type InsertSystemError = typeof systemErrors.$inferInsert;

// WhatsApp Agent Consultant Chat Tables
// Separate tables for consultant-agent conversations (internal testing/chat)
// These are completely separate from client WhatsApp conversations
export const whatsappAgentConsultantConversations = pgTable("whatsapp_agent_consultant_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentConfigId: varchar("agent_config_id").references(() => consultantWhatsappConfig.id, { onDelete: "cascade" }).notNull(),
  title: text("title"), // Auto-generated from first message, null until first message
  lastMessageAt: timestamp("last_message_at").default(sql`now()`),
  messageCount: integer("message_count").default(0).notNull(),

  // External sharing support (when conversation is from public shared link)
  shareId: varchar("share_id").references(() => whatsappAgentShares.id, { onDelete: "set null" }), // FK to whatsappAgentShares (nullable - null for internal consultant chats)
  externalVisitorId: text("external_visitor_id"), // Unique visitor session ID for anonymous users
  visitorMetadata: jsonb("visitor_metadata").$type<{
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
    firstAccessAt?: string;
    country?: string;
    [key: string]: any;
  }>(),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const whatsappAgentConsultantMessages = pgTable("whatsapp_agent_consultant_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => whatsappAgentConsultantConversations.id, { onDelete: "cascade" }).notNull(),
  role: text("role").$type<"consultant" | "agent" | "visitor">().notNull(), // Added "visitor" role for external users
  content: text("content").notNull(),
  status: text("status").$type<"sending" | "completed" | "error">().default("completed"),
  metadata: jsonb("metadata").$type<{
    vertexRequestId?: string;
    errorMessage?: string;
    errorDetails?: string;
    [key: string]: any;
  }>(),
  transcription: text("transcription"), // Audio transcription for voice messages
  audioUrl: text("audio_url"), // URL to audio file for TTS responses
  audioDuration: integer("audio_duration_seconds"), // Duration of audio in seconds
  createdAt: timestamp("created_at").default(sql`now()`),
});

// WhatsApp Agent Shares - Public sharing configuration for agents
// Allows consultants to share specific agents via public link or iframe embed
export const whatsappAgentShares = pgTable("whatsapp_agent_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentConfigId: varchar("agent_config_id").references(() => consultantWhatsappConfig.id, { onDelete: "cascade" }).notNull(),
  agentName: text("agent_name").notNull(),

  // Public access configuration
  slug: text("slug").notNull().unique(), // Unique URL slug (e.g., "demo-monitor-abc123")
  accessType: text("access_type").$type<"public" | "password" | "token">().default("public").notNull(),
  passwordHash: text("password_hash"), // bcrypt hash if accessType = 'password'

  // Domain whitelisting for iframe embeds
  allowedDomains: jsonb("allowed_domains").$type<string[]>().default(sql`'[]'::jsonb`), // Empty array = allow all domains

  // Status and lifecycle
  isActive: boolean("is_active").default(true).notNull(),
  revokedAt: timestamp("revoked_at"),
  revokeReason: text("revoke_reason"),
  expireAt: timestamp("expire_at"), // Optional expiration date

  // Analytics and tracking
  lastAccessAt: timestamp("last_access_at"),
  totalAccessCount: integer("total_access_count").default(0).notNull(),
  uniqueVisitorsCount: integer("unique_visitors_count").default(0).notNull(),
  totalMessagesCount: integer("total_messages_count").default(0).notNull(),

  // Rate limiting configuration
  rateLimitConfig: jsonb("rate_limit_config").$type<{
    maxMessagesPerHour?: number;
    maxMessagesPerDay?: number;
    maxConversationsPerVisitor?: number;
  }>().default(sql`'{"maxMessagesPerHour": 20, "maxMessagesPerDay": 100}'::jsonb`),

  // Metadata
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueAgentShare: unique().on(table.agentConfigId), // One active share per agent config
  };
});

// WhatsApp Agent Share Visitor Sessions
// Tracks authenticated visitor sessions for password-protected shares
export const whatsappAgentShareVisitorSessions = pgTable("whatsapp_agent_share_visitor_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shareId: varchar("share_id").references(() => whatsappAgentShares.id, { onDelete: "cascade" }).notNull(),
  visitorId: text("visitor_id").notNull(), // Generated visitor session ID (nanoid)

  // Authentication tracking
  passwordValidatedAt: timestamp("password_validated_at").default(sql`now()`),
  expiresAt: timestamp("expires_at").notNull(), // Session expiration (e.g., 24 hours)

  // Security and analytics
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueVisitorPerShare: unique().on(table.shareId, table.visitorId), // One session per visitor per share
  };
});

// WhatsApp Agent Consultant Chat types
export type WhatsappAgentConsultantConversation = typeof whatsappAgentConsultantConversations.$inferSelect;
export type InsertWhatsappAgentConsultantConversation = typeof whatsappAgentConsultantConversations.$inferInsert;
export type WhatsappAgentConsultantMessage = typeof whatsappAgentConsultantMessages.$inferSelect;
export type InsertWhatsappAgentConsultantMessage = typeof whatsappAgentConsultantMessages.$inferInsert;

// WhatsApp Agent Shares types
export type WhatsappAgentShare = typeof whatsappAgentShares.$inferSelect;
export type InsertWhatsappAgentShare = typeof whatsappAgentShares.$inferInsert;

// Zod validation schemas for agent shares
export const insertWhatsappAgentShareSchema = createInsertSchema(whatsappAgentShares).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalAccessCount: true,
  uniqueVisitorsCount: true,
  totalMessagesCount: true,
  lastAccessAt: true,
  revokedAt: true,
});

export const updateWhatsappAgentShareSchema = insertWhatsappAgentShareSchema.partial().omit({
  consultantId: true,
  agentConfigId: true,
  createdBy: true,
  slug: true,
});

// ===== SALES AGENTS AI - CLIENT FEATURE =====

// Client Sales Agents - AI sales agents configured by clients (not consultants)
export const clientSalesAgents = pgTable("client_sales_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(), // For reference

  // Agent basic info
  agentName: text("agent_name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  shareToken: text("share_token").notNull().unique(), // Unique token for public URL

  // Business info
  displayName: text("display_name").notNull(), // e.g., "Marco Rossi"
  businessName: text("business_name").notNull(), // e.g., "Momentum Coaching"
  businessDescription: text("business_description"), // What the business does
  consultantBio: text("consultant_bio"), // Bio/presentation

  // Authority & Positioning
  vision: text("vision"), // Where the business wants to go
  mission: text("mission"), // Why it exists
  values: jsonb("values").$type<string[]>().default(sql`'[]'::jsonb`), // ["Integrità", "Risultati"]
  usp: text("usp"), // Unique Selling Proposition
  targetClient: text("target_client"), // Who they help
  nonTargetClient: text("non_target_client"), // Who they DON'T help
  whatWeDo: text("what_we_do"), // Services summary
  howWeDoIt: text("how_we_do_it"), // Method/process

  // Credentials & Results
  yearsExperience: integer("years_experience").default(0),
  clientsHelped: integer("clients_helped").default(0),
  resultsGenerated: text("results_generated"), // e.g., "€10M+ revenue generated"
  softwareCreated: jsonb("software_created").$type<Array<{ emoji: string; name: string; description: string }>>().default(sql`'[]'::jsonb`),
  booksPublished: jsonb("books_published").$type<Array<{ title: string; year: string }>>().default(sql`'[]'::jsonb`),
  caseStudies: jsonb("case_studies").$type<Array<{ client: string; result: string }>>().default(sql`'[]'::jsonb`),

  // Services & Guarantees
  servicesOffered: jsonb("services_offered").$type<Array<{ name: string; description: string; price: string }>>().default(sql`'[]'::jsonb`),
  guarantees: text("guarantees"),

  // Sales modes
  enableDiscovery: boolean("enable_discovery").default(true).notNull(),
  enableDemo: boolean("enable_demo").default(true).notNull(),
  enablePayment: boolean("enable_payment").default(false).notNull(),

  // Voice configuration
  voiceName: varchar("voice_name", { length: 50 }).default("Puck"), // Voice name for Gemini Live (Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr)

  // Metadata
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Client Sales Conversations - Tracks conversations between prospects and sales AI
export const clientSalesConversations = pgTable("client_sales_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => clientSalesAgents.id, { onDelete: "cascade" }).notNull(),
  aiConversationId: varchar("ai_conversation_id").references(() => aiConversations.id, { onDelete: "set null" }), // Link to main AI conversation

  // Prospect info
  prospectName: text("prospect_name").notNull(),
  prospectEmail: text("prospect_email"),
  prospectPhone: text("prospect_phone"),

  // Conversation state
  currentPhase: text("current_phase").$type<"discovery" | "demo" | "objections" | "closing">().default("discovery").notNull(),

  // Data collected during conversation
  collectedData: jsonb("collected_data").$type<{
    business?: string;
    currentState?: string;
    idealState?: string;
    painPoints?: string[];
    budget?: string;
    urgency?: string;
    isDecisionMaker?: boolean;
    [key: string]: any;
  }>().default(sql`'{}'::jsonb`),

  // Objections raised
  objectionsRaised: jsonb("objections_raised").$type<string[]>().default(sql`'[]'::jsonb`),

  // Outcome
  outcome: text("outcome").$type<"interested" | "not_interested" | "closed" | "pending">().default("pending"),

  // Used Script tracking - quale script dal DB era attivo durante questa conversazione
  usedScriptId: varchar("used_script_id"),
  usedScriptName: text("used_script_name"),
  usedScriptType: text("used_script_type").$type<"discovery" | "demo" | "objections">(),
  usedScriptSource: text("used_script_source").$type<"database" | "hardcoded_default" | "unknown">(), // Tracks whether script came from DB or hardcoded defaults

  // Sales Manager feedback - pending feedback for injection (survives WebSocket reconnections)
  pendingFeedback: text("pending_feedback"), // Feedback from SalesManagerAgent waiting to be injected
  pendingFeedbackCreatedAt: timestamp("pending_feedback_created_at"), // When the feedback was created

  // Discovery REC - Summary generated at end of discovery phase before transitioning to demo
  // Generated by Gemini 2.5 Flash from discovery transcript, used as context for demo phase
  discoveryRec: jsonb("discovery_rec").$type<{
    motivazioneCall?: string;           // Perché il prospect ha fatto la call
    altroProvato?: string;              // Cos'altro ha già provato
    tipoAttivita?: string;              // Tipo di business/attività
    statoAttuale?: string;              // Situazione corrente
    livelloFatturato?: string;          // Range di fatturato
    problemi?: string[];                // Lista problemi identificati
    statoIdeale?: string;               // Dove vuole arrivare
    urgenza?: string;                   // Quanto è urgente (1-10 o descrizione)
    decisionMaker?: boolean;            // È il decision maker?
    budget?: string;                    // Budget disponibile/previsto
    obiezioniEmerse?: string[];         // Obiezioni già emerse in discovery
    noteAggiuntive?: string;            // Altre info rilevanti
    generatedAt?: string;               // ISO timestamp di quando è stato generato
  }>(),

  // Metadata
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Client Sales Knowledge - Knowledge base items for sales agents (similar to WhatsApp agent knowledge)
export const clientSalesKnowledge = pgTable("client_sales_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => clientSalesAgents.id, { onDelete: "cascade" }).notNull(),

  title: text("title").notNull(),
  type: text("type").$type<"text" | "pdf" | "docx" | "txt">().notNull(),
  content: text("content"), // For type="text"
  filePath: text("file_path"), // For uploaded files

  createdAt: timestamp("created_at").default(sql`now()`),
});

// Gemini Session Handles - Track ownership of session resume handles for isolation
export const geminiSessionHandles = pgTable("gemini_session_handles", {
  handle: text("handle").primaryKey(), // The Gemini session resume handle
  userId: varchar("user_id").references(() => users.id), // For normal/consultant mode (nullable for sales_agent/consultation_invite)
  shareToken: text("share_token"), // For sales_agent mode (nullable for other modes)
  inviteToken: text("invite_token"), // For consultation_invite mode (nullable for other modes)
  conversationId: varchar("conversation_id"), // For sales_agent/consultation_invite mode (nullable for client modes)
  mode: text("mode").notNull().$type<"assistenza" | "consulente" | "sales_agent" | "consultation_invite">(), // Session mode
  consultantType: text("consultant_type").$type<"finanziario" | "vendita" | "business">(), // For consulente mode - ensures different consultant types don't share sessions
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Consultation Invites - Google Meet-style persistent invite links for AI consultations
export const consultationInvites = pgTable("consultation_invites", {
  inviteToken: varchar("invite_token", { length: 64 }).primaryKey(), // Unique invite token (e.g., inv_abc123xyz)
  agentId: varchar("agent_id").references(() => clientSalesAgents.id, { onDelete: "cascade" }).notNull(),

  // Agent info (denormalized for performance)
  consultantName: text("consultant_name").notNull(), // e.g., "Marco Rossi"

  // Prospect info (optional - can be filled in lobby or pre-filled by admin)
  prospectName: text("prospect_name"),
  prospectEmail: text("prospect_email"),
  prospectPhone: text("prospect_phone"),

  // Schedule (optional - restricts access to specific date/time window)
  scheduledDate: text("scheduled_date"), // ISO date string (YYYY-MM-DD)
  startTime: text("start_time"), // HH:MM format (e.g., "14:00")
  endTime: text("end_time"), // HH:MM format (e.g., "15:00")

  // Linked conversation (created when prospect joins for first time)
  conversationId: varchar("conversation_id").references(() => clientSalesConversations.id, { onDelete: "set null" }),

  // Status tracking
  status: text("status").$type<"pending" | "active" | "completed">().default("pending").notNull(),

  // Access tracking
  accessCount: integer("access_count").default(0).notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),

  // Metadata
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Types for Sales Agents
export type ClientSalesAgent = typeof clientSalesAgents.$inferSelect;
export type InsertClientSalesAgent = typeof clientSalesAgents.$inferInsert;
export type ClientSalesConversation = typeof clientSalesConversations.$inferSelect;
export type InsertClientSalesConversation = typeof clientSalesConversations.$inferInsert;
export type ClientSalesKnowledge = typeof clientSalesKnowledge.$inferSelect;
export type InsertClientSalesKnowledge = typeof clientSalesKnowledge.$inferInsert;
export type GeminiSessionHandle = typeof geminiSessionHandles.$inferSelect;
export type InsertGeminiSessionHandle = typeof geminiSessionHandles.$inferInsert;
export type ConsultationInvite = typeof consultationInvites.$inferSelect;
export type InsertConsultationInvite = typeof consultationInvites.$inferInsert;

// Zod schemas for validation
export const insertClientSalesAgentSchema = createInsertSchema(clientSalesAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  shareToken: true, // Generated server-side
  clientId: true, // Added server-side from authenticated user
  consultantId: true, // Added server-side from authenticated user
});

export const updateClientSalesAgentSchema = insertClientSalesAgentSchema.partial().omit({
  clientId: true,
  consultantId: true,
  shareToken: true, // Never allow modifying share token via API
  createdAt: true,  // Prevent tampering with creation timestamp
});

export const insertClientSalesConversationSchema = createInsertSchema(clientSalesConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientSalesKnowledgeSchema = createInsertSchema(clientSalesKnowledge).omit({
  id: true,
  createdAt: true,
});

export const insertConsultationInviteSchema = createInsertSchema(consultationInvites).omit({
  inviteToken: true, // Generated server-side
  conversationId: true, // Created when prospect joins
  status: true, // Starts as 'pending'
  accessCount: true, // Tracked automatically
  lastAccessedAt: true, // Tracked automatically
  createdAt: true,
  updatedAt: true,
});

export const updateConsultationInviteSchema = insertConsultationInviteSchema.partial().omit({
  agentId: true, // Cannot change agent after creation
  inviteToken: true, // Never allow modifying invite token
});

// ===== SALES AGENT TRAINING SYSTEM =====

// Sales Conversation Training - Tracks training data for individual conversations
export const salesConversationTraining = pgTable("sales_conversation_training", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => clientSalesConversations.id, { onDelete: "cascade" }).notNull().unique(),
  agentId: varchar("agent_id").references(() => clientSalesAgents.id, { onDelete: "cascade" }).notNull(),

  // Phase tracking
  currentPhase: text("current_phase").notNull(), // e.g., "phase_3", "phase_6"
  phasesReached: jsonb("phases_reached").$type<string[]>().default(sql`'[]'::jsonb`), // ["phase_1_2", "phase_3"]

  // Phase activation tracking (WHY a phase was activated) - flat structure for UI compatibility
  phaseActivations: jsonb("phase_activations").$type<Array<{
    phase: string; // phaseId (e.g., "phase_3")
    timestamp: string;
    trigger: "semantic_match" | "keyword_match" | "exact_match";
    matchedQuestion?: string;
    keywordsMatched?: string[];
    similarity?: number;
    messageId?: string;
    excerpt?: string;
    reasoning?: string;
  }>>().default(sql`'[]'::jsonb`),

  // Checkpoint tracking with structured evidence
  checkpointsCompleted: jsonb("checkpoints_completed").$type<Array<{
    checkpointId: string;
    status: "completed" | "pending" | "failed";
    completedAt: string;
    verifications: Array<{
      requirement: string;
      status: "verified" | "pending" | "failed";
      evidence?: {
        messageId: string;
        excerpt: string;
        matchedKeywords: string[];
        timestamp: string;
      };
    }>;
  }>>().default(sql`'[]'::jsonb`),

  // Semantic classification
  semanticTypes: jsonb("semantic_types").$type<string[]>().default(sql`'[]'::jsonb`), // ["opening", "discovery", "gap_stretching"]

  // AI reasoning and decisions
  aiReasoning: jsonb("ai_reasoning").$type<Array<{
    timestamp: string;
    phase: string;
    decision: string;
    reasoning: string;
  }>>().default(sql`'[]'::jsonb`),

  // Full conversation transcript
  fullTranscript: jsonb("full_transcript").$type<Array<{
    messageId: string; // Unique ID for this message (for linking evidence)
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    phase?: string;
    checkpoint?: string;
  }>>().default(sql`'[]'::jsonb`),

  // Ladder tracking (3-5 PERCHÉ rule)
  ladderActivations: jsonb("ladder_activations").$type<Array<{
    timestamp: string;
    phase: string;
    level: number; // 1-6
    question: string;
    userResponse?: string;
    wasVague: boolean; // Was response vague?
  }>>().default(sql`'[]'::jsonb`),

  // Contextual Responses tracking (Anti-Robot Mode)
  contextualResponses: jsonb("contextual_responses").$type<Array<{
    timestamp: string;
    phase: string;
    prospectQuestion: string;
    aiResponse: string;
  }>>().default(sql`'[]'::jsonb`),

  // Questions asked by AI (for analytics)
  questionsAsked: jsonb("questions_asked").$type<Array<{
    timestamp: string;
    phase: string;
    stepId?: string;
    question: string;
    questionType?: string; // "opening", "discovery", "ladder", etc.
  }>>().default(sql`'[]'::jsonb`),

  // Objections tracking
  objectionsEncountered: jsonb("objections_encountered").$type<Array<{
    timestamp: string;
    phase: string;
    objection: string; // Text of objection
    aiResponse: string; // How AI handled it
    resolved: boolean; // Whether it was successfully resolved
  }>>().default(sql`'[]'::jsonb`),

  // Drop-off tracking
  dropOffPoint: text("drop_off_point"), // e.g., "checkpoint_4" or "phase_5_step_2"
  dropOffReason: text("drop_off_reason"), // e.g., "user_left", "too_many_questions", "vague_answers"

  // Completion metrics
  completionRate: real("completion_rate").default(0.0), // Percentage of script completed (0.0 to 1.0)
  totalDuration: integer("total_duration").default(0), // Total conversation duration in seconds

  // Script snapshot (for historical comparison)
  scriptSnapshot: jsonb("script_snapshot").$type<any>(), // Snapshot of sales-script-structure.json at conversation time (nullable)
  scriptVersion: text("script_version"), // Version of the script (e.g., "1.0.0") (nullable)

  // Used Script tracking - quale script dal DB era attivo durante questa conversazione
  // Nota: Non può usare .references() perché salesScripts è definita dopo questa tabella
  usedScriptId: varchar("used_script_id"), // ID dello script usato (FK logica a sales_scripts.id)
  usedScriptName: text("used_script_name"), // Nome dello script per display facile (es. "Discovery Call v2.0")
  usedScriptType: text("used_script_type").$type<"discovery" | "demo" | "objections">(), // Tipo di script usato

  // AI Analysis Result (Gemini 2.5 Pro analysis for this specific conversation)
  aiAnalysisResult: jsonb("ai_analysis_result").$type<{
    insights: Array<{ category: string; text: string; priority: string }>;
    problems: Array<{ category: string; text: string; severity: string }>;
    suggestions: Array<{ category: string; text: string; impact: string }>;
    strengths: Array<{ category: string; text: string }>;
    score: {
      overall: number;
      phaseProgression: number;
      questionQuality: number;
      ladderEffectiveness: number;
      checkpointCompletion: number;
    };
    analyzedAt: string;
    analyzedFiles?: string[]; // List of files used in analysis (if any)
  }>(),

  // Sales Manager Analysis History (real-time coaching feedback during conversation)
  managerAnalysisHistory: jsonb("manager_analysis_history").$type<Array<{
    timestamp: string;
    stepAdvancement: {
      shouldAdvance: boolean;
      nextPhaseId: string | null;
      nextStepId: string | null;
      confidence: number;
      reasoning: string;
    };
    checkpointStatus: {
      checkpointId: string;
      checkpointName: string;
      isComplete: boolean;
      completedItems: string[];
      missingItems: string[];
      canAdvance: boolean;
    } | null;
    buySignals: {
      detected: boolean;
      signals: Array<{ type: string; phrase: string; confidence: number }>;
    };
    objections: {
      detected: boolean;
      objections: Array<{ type: string; phrase: string }>;
    };
    archetypeState: {
      current: string;
      confidence: number;
    } | null;
    currentPhase: {
      id: string;
      name: string;
      stepName: string;
    };
    analysisTimeMs: number;
  }>>().default(sql`'[]'::jsonb`),

  // 🔒 STICKY VALIDATION: Item singoli già validati (verde = resta verde)
  // Struttura: { "checkpoint_phase_1": [{ check: "...", status: "validated", ... }], ... }
  validatedCheckpointItems: jsonb("validated_checkpoint_items").$type<Record<string, Array<{
    check: string;
    status: 'validated' | 'missing' | 'vague';
    infoCollected?: string;
    evidenceQuote?: string;
    reason?: string;
    validatedAt?: string;
  }>>>().default(sql`'{}'::jsonb`),

  // Metadata
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Sales Agent Training Summary - Aggregated training data per agent
export const salesAgentTrainingSummary = pgTable("sales_agent_training_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => clientSalesAgents.id, { onDelete: "cascade" }).notNull().unique(),

  // Statistics
  totalConversations: integer("total_conversations").default(0).notNull(),
  avgConversionRate: real("avg_conversion_rate").default(0.0),

  // Phase completion rates (percentage per phase)
  phaseCompletionRates: jsonb("phase_completion_rates").$type<{
    [phaseId: string]: number; // e.g., { "phase_1_2": 0.98, "phase_3": 0.75 }
  }>().default(sql`'{}'::jsonb`),

  // Common fail points (where conversations drop off)
  commonFailPoints: jsonb("common_fail_points").$type<Array<{
    phaseId: string;
    checkpointId?: string;
    failureCount: number;
    failureRate: number;
    reason?: string;
  }>>().default(sql`'[]'::jsonb`),

  // Checkpoint completion rates (detailed per checkpoint)
  checkpointCompletionRates: jsonb("checkpoint_completion_rates").$type<{
    [checkpointId: string]: number; // e.g., { "checkpoint_1_2": 0.95, "checkpoint_3": 0.72 }
  }>().default(sql`'{}'::jsonb`),

  // Average metrics
  avgConversationDuration: integer("avg_conversation_duration").default(0), // Average duration in seconds

  // Ladder effectiveness (3-5 PERCHÉ rule)
  ladderActivationRate: real("ladder_activation_rate").default(0.0), // % of times ladder activated when needed
  avgLadderDepth: real("avg_ladder_depth").default(0.0), // Average levels reached (1-6)

  // Anti-Robot Mode effectiveness (Contextual Responses)
  totalContextualResponses: integer("total_contextual_responses").default(0), // Total number of times AI answered prospect questions
  avgContextualResponsesPerConversation: real("avg_contextual_responses_per_conversation").default(0.0), // Average per conversation

  // Performance insights
  bestPerformingPhases: jsonb("best_performing_phases").$type<string[]>().default(sql`'[]'::jsonb`), // ["phase_1_2", "phase_3"]
  worstPerformingPhases: jsonb("worst_performing_phases").$type<string[]>().default(sql`'[]'::jsonb`), // ["phase_4", "phase_5"]

  // Script structure validation
  lastStructureCheck: timestamp("last_structure_check"), // Last time script was validated
  structureMismatch: boolean("structure_mismatch").default(false), // Alert if script changed
  scriptVersion: text("script_version"), // Version of script structure used

  // Metadata
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Types for Training System
export type SalesConversationTraining = typeof salesConversationTraining.$inferSelect;
export type InsertSalesConversationTraining = typeof salesConversationTraining.$inferInsert;
export type SalesAgentTrainingSummary = typeof salesAgentTrainingSummary.$inferSelect;
export type InsertSalesAgentTrainingSummary = typeof salesAgentTrainingSummary.$inferInsert;

// Zod schemas for validation
export const insertSalesConversationTrainingSchema = createInsertSchema(salesConversationTraining).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesAgentTrainingSummarySchema = createInsertSchema(salesAgentTrainingSummary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Training Analysis History - Stores Gemini 2.5 Pro AI analysis results
export const trainingAnalysisHistory = pgTable("training_analysis_history", {
  id: varchar("id").primaryKey(),
  agentId: varchar("agent_id").references(() => clientSalesAgents.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id).notNull(),

  // Analysis results
  analyzedFiles: jsonb("analyzed_files").$type<Array<{
    filename: string;
    status: 'success' | 'error';
    error?: string;
  }>>().default(sql`'[]'::jsonb`),

  improvements: jsonb("improvements").$type<Array<{
    id: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    title: string;
    problem: string;
    evidence: string[];
    currentScript: string | null;
    suggestedScript: string;
    reasoning: string;
    estimatedImpact: number;
    effort: 'low' | 'medium' | 'high';
    sourceFile: string;
  }>>().default(sql`'[]'::jsonb`),

  // Metrics
  conversationsAnalyzed: integer("conversations_analyzed").default(0).notNull(),
  totalImprovements: integer("total_improvements").default(0).notNull(),
  criticalImprovements: integer("critical_improvements").default(0).notNull(),
  highImprovements: integer("high_improvements").default(0).notNull(),

  // Timestamps
  analyzedAt: timestamp("analyzed_at").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export type TrainingAnalysisHistory = typeof trainingAnalysisHistory.$inferSelect;
export type InsertTrainingAnalysisHistory = typeof trainingAnalysisHistory.$inferInsert;

export const insertTrainingAnalysisHistorySchema = createInsertSchema(trainingAnalysisHistory).omit({
  createdAt: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// Sales Scripts Management - CMS per Script di Vendita
// ═══════════════════════════════════════════════════════════════════════════

export const salesScripts = pgTable("sales_scripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Identificazione
  name: text("name").notNull(), // es. "Discovery Call v2.0", "Script Empatico"
  scriptType: text("script_type").notNull().$type<"discovery" | "demo" | "objections">(),
  version: text("version").notNull().default("1.0.0"), // Semantic versioning

  // Contenuto
  content: text("content").notNull(), // Il testo completo dello script in markdown
  structure: jsonb("structure").$type<{
    version: string;
    phases: Array<{
      id: string;
      number: string;
      name: string;
      description: string;
      semanticType: string;
      steps: Array<{
        id: string;
        number: number;
        name: string;
        objective: string;
        questions: Array<{ text: string; marker?: string }>;
        hasLadder: boolean;
        ladderLevels?: number;
      }>;
      checkpoints: Array<{
        id: string;
        description: string;
        verifications: string[];
      }>;
    }>;
  }>(), // Struttura JSON parsata per visualizzazione step-by-step

  // Stato
  isActive: boolean("is_active").default(false).notNull(), // Solo uno attivo per tipo
  isDraft: boolean("is_draft").default(true).notNull(), // Bozza o pubblicato
  isArchived: boolean("is_archived").default(false).notNull(), // Script archiviato (non eliminabile se ha sessioni training)

  // Metadati - Chi possiede lo script
  clientId: varchar("client_id").references(() => users.id).notNull(), // Il client che possiede questo script
  consultantId: varchar("consultant_id").references(() => users.id), // Opzionale - consultant che ha creato
  description: text("description"), // Descrizione opzionale
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`), // es. ["aggressivo", "b2b"]

  // Statistiche
  usageCount: integer("usage_count").default(0), // Quante volte è stato usato
  lastUsedAt: timestamp("last_used_at"),

  // Energy Settings per fase/step - Override personalizzati
  energySettings: jsonb("energy_settings").$type<{
    [phaseOrStepId: string]: {
      level: "BASSO" | "MEDIO" | "ALTO";
      tone: "CALMO" | "SICURO" | "CONFIDENZIALE" | "ENTUSIASTA";
      volume: "SOFT" | "NORMAL" | "LOUD";
      pace: "LENTO" | "MODERATO" | "VELOCE";
      vocabulary: "FORMALE" | "COLLOQUIALE" | "TECNICO";
      reason?: string;
    };
  }>().default(sql`'{}'::jsonb`),

  // Ladder Levels Override - I 5 livelli del perché personalizzati per step
  ladderOverrides: jsonb("ladder_overrides").$type<{
    [stepId: string]: {
      hasLadder: boolean;
      levels: Array<{
        level: number; // 1-5
        text: string;
        purpose: string;
      }>;
    };
  }>().default(sql`'{}'::jsonb`),

  // Step Questions Override - Domande chiave personalizzate per step
  stepQuestions: jsonb("step_questions").$type<{
    [stepId: string]: Array<{
      id: string;
      text: string;
      order: number;
      type?: string; // "opening", "discovery", "closing", etc.
    }>;
  }>().default(sql`'{}'::jsonb`),

  // Biscottini Override - Piccole vittorie/cookies per step
  stepBiscottini: jsonb("step_biscottini").$type<{
    [stepId: string]: Array<{
      text: string;
      type: "rapport" | "value" | "agreement" | "other";
    }>;
  }>().default(sql`'{}'::jsonb`),

  // Timestamp
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
}, (table) => {
  return {
    clientTypeIdx: index("sales_scripts_client_type_idx").on(table.clientId, table.scriptType),
    activeTypeIdx: index("sales_scripts_active_type_idx").on(table.isActive, table.scriptType),
  };
});

export type SalesScript = typeof salesScripts.$inferSelect;
export type InsertSalesScript = typeof salesScripts.$inferInsert;

export const insertSalesScriptSchema = createInsertSchema(salesScripts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Script Version History - Per tenere traccia delle versioni precedenti
export const salesScriptVersions = pgTable("sales_script_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scriptId: varchar("script_id").references(() => salesScripts.id, { onDelete: "cascade" }).notNull(),

  // Snapshot della versione
  version: text("version").notNull(),
  content: text("content").notNull(),
  structure: jsonb("structure"),

  // Chi ha creato questa versione
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  changeNotes: text("change_notes"), // Note sulle modifiche

  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export type SalesScriptVersion = typeof salesScriptVersions.$inferSelect;
export type InsertSalesScriptVersion = typeof salesScriptVersions.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// Agent Script Assignments - Collega script specifici ad agenti specifici
// Un agente può avere max 1 script per tipo (discovery, demo, objections)
// ═══════════════════════════════════════════════════════════════════════════

export const agentScriptAssignments = pgTable("agent_script_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Relazioni
  agentId: varchar("agent_id").references(() => clientSalesAgents.id, { onDelete: "cascade" }).notNull(),
  scriptId: varchar("script_id").references(() => salesScripts.id, { onDelete: "cascade" }).notNull(),

  // Tipo script per vincolo unicità (1 agente = max 1 script per tipo)
  scriptType: text("script_type").notNull().$type<"discovery" | "demo" | "objections">(),

  // Metadata
  assignedAt: timestamp("assigned_at").default(sql`now()`).notNull(),
  assignedBy: varchar("assigned_by").references(() => users.id), // Chi ha fatto l'assegnazione
}, (table) => {
  return {
    // Vincolo unicità: 1 agente può avere solo 1 script per tipo
    agentTypeUnique: index("agent_script_type_unique_idx").on(table.agentId, table.scriptType),
  };
});

export type AgentScriptAssignment = typeof agentScriptAssignments.$inferSelect;
export type InsertAgentScriptAssignment = typeof agentScriptAssignments.$inferInsert;

export const insertAgentScriptAssignmentSchema = createInsertSchema(agentScriptAssignments).omit({
  id: true,
  assignedAt: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// AI Training Sessions - Sessioni di training automatico con AI Prospect
// ═══════════════════════════════════════════════════════════════════════════

export const aiTrainingSessions = pgTable("ai_training_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  agentId: varchar("agent_id").references(() => clientSalesAgents.id, { onDelete: "cascade" }).notNull(),
  scriptId: varchar("script_id").references(() => salesScripts.id).notNull(),
  scriptName: text("script_name"),

  demoScriptId: varchar("demo_script_id").references(() => salesScripts.id),
  testMode: text("test_mode").$type<"discovery" | "demo" | "discovery_demo">().default("discovery"),

  personaId: text("persona_id").notNull(),
  prospectName: text("prospect_name").notNull(),
  prospectEmail: text("prospect_email"),

  status: text("status").notNull().$type<"running" | "completed" | "stopped">().default("running"),

  conversationId: varchar("conversation_id"),

  currentPhase: text("current_phase").default("starting"),
  completionRate: real("completion_rate").default(0),
  ladderActivations: integer("ladder_activations").default(0),
  messageCount: integer("message_count").default(0),
  lastMessage: text("last_message"),

  startedAt: timestamp("started_at").default(sql`now()`).notNull(),
  endedAt: timestamp("ended_at"),

  resultScore: real("result_score"),
  resultNotes: text("result_notes"),
}, (table) => {
  return {
    agentIdx: index("ai_training_sessions_agent_idx").on(table.agentId),
    statusIdx: index("ai_training_sessions_status_idx").on(table.status),
  };
});

export type AITrainingSession = typeof aiTrainingSessions.$inferSelect;
export type InsertAITrainingSession = typeof aiTrainingSessions.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// Human Sellers - Venditori umani con AI Copilot per video call
// ═══════════════════════════════════════════════════════════════════════════

export const humanSellers = pgTable("human_sellers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id), // Consultant con Vertex AI configurato

  // Basic Info
  sellerName: text("seller_name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  ownerEmail: text("owner_email"), // Email del proprietario/venditore per riconoscimento come host nel meeting
  isActive: boolean("is_active").default(true),

  // Business Info (come client_sales_agents)
  businessName: text("business_name"),
  businessDescription: text("business_description"),
  consultantBio: text("consultant_bio"),

  // Authority & Positioning
  vision: text("vision"),
  mission: text("mission"),
  values: jsonb("values").$type<string[]>().default(sql`'[]'::jsonb`),
  usp: text("usp"),
  targetClient: text("target_client"),
  nonTargetClient: text("non_target_client"),
  whatWeDo: text("what_we_do"),
  howWeDoIt: text("how_we_do_it"),

  // Credentials & Results
  yearsExperience: integer("years_experience").default(0),
  clientsHelped: integer("clients_helped").default(0),
  resultsGenerated: text("results_generated"),
  guarantees: text("guarantees"),

  // Services
  servicesOffered: jsonb("services_offered").$type<Array<{ name: string; description: string; price: string }>>().default(sql`'[]'::jsonb`),

  // Voice configuration
  voiceName: varchar("voice_name", { length: 50 }).default("achernar"),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type HumanSeller = typeof humanSellers.$inferSelect;
export type InsertHumanSeller = typeof humanSellers.$inferInsert;

export const insertHumanSellerSchema = createInsertSchema(humanSellers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// Human Seller Script Assignments - Collega script specifici a venditori umani
// Un venditore può avere max 1 script per tipo (discovery, demo)
// ═══════════════════════════════════════════════════════════════════════════

export const humanSellerScriptAssignments = pgTable("human_seller_script_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Relazioni
  sellerId: varchar("seller_id").references(() => humanSellers.id, { onDelete: "cascade" }).notNull(),
  scriptId: varchar("script_id").references(() => salesScripts.id, { onDelete: "cascade" }).notNull(),

  // Tipo script per vincolo unicità (1 venditore = max 1 script per tipo)
  scriptType: text("script_type").notNull().$type<"discovery" | "demo">(),

  // Metadata
  assignedAt: timestamp("assigned_at").default(sql`now()`).notNull(),
  assignedBy: varchar("assigned_by").references(() => users.id),
}, (table) => {
  return {
    // Vincolo unicità: 1 venditore può avere solo 1 script per tipo
    sellerTypeUnique: index("seller_script_type_unique_idx").on(table.sellerId, table.scriptType),
  };
});

export type HumanSellerScriptAssignment = typeof humanSellerScriptAssignments.$inferSelect;
export type InsertHumanSellerScriptAssignment = typeof humanSellerScriptAssignments.$inferInsert;

export const insertHumanSellerScriptAssignmentSchema = createInsertSchema(humanSellerScriptAssignments).omit({
  id: true,
  assignedAt: true,
});

// Video Meetings - Meeting video programmati
export const videoMeetings = pgTable("video_meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").references(() => humanSellers.id, { onDelete: "cascade" }).notNull(),
  meetingToken: varchar("meeting_token").unique().notNull(),
  playbookId: varchar("playbook_id"),
  prospectName: text("prospect_name").notNull(),
  prospectEmail: text("prospect_email"),
  ownerEmail: text("owner_email"), // Email del proprietario del meeting (per riconoscimento come Google Meet)
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  status: text("status").default("scheduled").$type<"scheduled" | "in_progress" | "completed" | "cancelled">(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export type VideoMeeting = typeof videoMeetings.$inferSelect;
export type InsertVideoMeeting = typeof videoMeetings.$inferInsert;

export const insertVideoMeetingSchema = createInsertSchema(videoMeetings).omit({
  id: true,
  createdAt: true,
});

// Video Meeting Participants - Partecipanti ai meeting
export const videoMeetingParticipants = pgTable("video_meeting_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").references(() => videoMeetings.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().$type<"host" | "guest" | "prospect">(),
  joinedAt: timestamp("joined_at"),
  leftAt: timestamp("left_at"),
});

export type VideoMeetingParticipant = typeof videoMeetingParticipants.$inferSelect;
export type InsertVideoMeetingParticipant = typeof videoMeetingParticipants.$inferInsert;

// Video Meeting Transcripts - Trascrizioni con speaker
export const videoMeetingTranscripts = pgTable("video_meeting_transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").references(() => videoMeetings.id, { onDelete: "cascade" }).notNull(),
  speakerId: varchar("speaker_id"),
  speakerName: text("speaker_name"),
  text: text("text").notNull(),
  timestampMs: bigint("timestamp_ms", { mode: "number" }),
  sentiment: text("sentiment").$type<"positive" | "neutral" | "negative">(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export type VideoMeetingTranscript = typeof videoMeetingTranscripts.$inferSelect;
export type InsertVideoMeetingTranscript = typeof videoMeetingTranscripts.$inferInsert;

// Video Meeting Analytics - Metriche per meeting
export const videoMeetingAnalytics = pgTable("video_meeting_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").references(() => videoMeetings.id, { onDelete: "cascade" }).notNull(),
  durationSeconds: integer("duration_seconds"),
  talkRatio: real("talk_ratio"),
  scriptAdherence: real("script_adherence"),
  avgSentimentScore: real("avg_sentiment_score"),
  objectionsCount: integer("objections_count"),
  objectionsHandled: integer("objections_handled"),
  aiSummary: text("ai_summary"),
  actionItems: jsonb("action_items").$type<Array<{ text: string; completed: boolean }>>(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export type VideoMeetingAnalytic = typeof videoMeetingAnalytics.$inferSelect;
export type InsertVideoMeetingAnalytic = typeof videoMeetingAnalytics.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// Consultant TURN Config - Configurazione TURN servers per WebRTC
// ═══════════════════════════════════════════════════════════════════════════

export const consultantTurnConfig = pgTable("consultant_turn_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  provider: text("provider").$type<"metered" | "twilio" | "custom">().default("metered").notNull(),
  usernameEncrypted: text("username_encrypted"), // Encrypted with consultant salt
  passwordEncrypted: text("password_encrypted"), // Encrypted with consultant salt
  apiKeyEncrypted: text("api_key_encrypted"), // For providers that need API key (optional)
  turnUrls: jsonb("turn_urls").$type<string[]>(), // Custom TURN URLs (optional, for custom provider)
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type ConsultantTurnConfig = typeof consultantTurnConfig.$inferSelect;
export type InsertConsultantTurnConfig = typeof consultantTurnConfig.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// Human Seller Analytics - Analytics dettagliate per venditori umani
// ═══════════════════════════════════════════════════════════════════════════

// Coaching Events - Eventi di coaching registrati durante le chiamate
export const humanSellerCoachingEvents = pgTable("human_seller_coaching_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").references(() => videoMeetings.id, { onDelete: "cascade" }).notNull(),
  sellerId: varchar("seller_id").references(() => humanSellers.id, { onDelete: "cascade" }).notNull(),
  eventType: text("event_type").notNull().$type<"buy_signal" | "objection" | "checkpoint_complete" | "phase_advance" | "tone_warning" | "coaching_feedback">(),
  eventData: jsonb("event_data").$type<{
    phrase?: string;
    confidence?: number;
    suggestedAction?: string;
    suggestedResponse?: string;
    fromScript?: boolean;
    checkpointId?: string;
    checkpointName?: string;
    phaseId?: string;
    phaseName?: string;
    priority?: string;
    message?: string;
    toneReminder?: string;
    feedbackType?: string;
  }>(),
  prospectArchetype: text("prospect_archetype").$type<"analizzatore" | "decisore" | "amichevole" | "scettico" | "impaziente" | "riflessivo" | "esigente" | "prudente" | "neutral">(),
  timestampMs: bigint("timestamp_ms", { mode: "number" }),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => {
  return {
    meetingIdx: index("coaching_events_meeting_idx").on(table.meetingId),
    sellerIdx: index("coaching_events_seller_idx").on(table.sellerId),
    typeIdx: index("coaching_events_type_idx").on(table.eventType),
  };
});

export type HumanSellerCoachingEvent = typeof humanSellerCoachingEvents.$inferSelect;
export type InsertHumanSellerCoachingEvent = typeof humanSellerCoachingEvents.$inferInsert;

// Session Metrics - Metriche di sessione aggregate per meeting completati
export const humanSellerSessionMetrics = pgTable("human_seller_session_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").references(() => videoMeetings.id, { onDelete: "cascade" }).notNull().unique(),
  sellerId: varchar("seller_id").references(() => humanSellers.id, { onDelete: "cascade" }).notNull(),
  durationSeconds: integer("duration_seconds"),
  totalBuySignals: integer("total_buy_signals").default(0),
  totalObjections: integer("total_objections").default(0),
  objectionsHandled: integer("objections_handled").default(0),
  checkpointsCompleted: integer("checkpoints_completed").default(0),
  totalCheckpoints: integer("total_checkpoints").default(0),
  phasesCompleted: integer("phases_completed").default(0),
  totalPhases: integer("total_phases").default(0),
  scriptAdherenceScore: real("script_adherence_score"), // 0-100
  toneWarningsCount: integer("tone_warnings_count").default(0),
  prospectArchetype: text("prospect_archetype").$type<"analizzatore" | "decisore" | "amichevole" | "scettico" | "impaziente" | "riflessivo" | "esigente" | "prudente" | "neutral">(),
  outcome: text("outcome").$type<"won" | "lost" | "follow_up" | "no_decision">(),
  outcomeNotes: text("outcome_notes"),
  aiAnalysisSummary: text("ai_analysis_summary"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    sellerIdx: index("session_metrics_seller_idx").on(table.sellerId),
    outcomeIdx: index("session_metrics_outcome_idx").on(table.outcome),
  };
});

export type HumanSellerSessionMetric = typeof humanSellerSessionMetrics.$inferSelect;
export type InsertHumanSellerSessionMetric = typeof humanSellerSessionMetrics.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// Human Seller Meeting Training - Stato sessione completo per persistenza
// Equivalente a sales_conversation_training per AI agents
// ═══════════════════════════════════════════════════════════════════════════

export const humanSellerMeetingTraining = pgTable("human_seller_meeting_training", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").references(() => videoMeetings.id, { onDelete: "cascade" }).notNull().unique(),
  sellerId: varchar("seller_id").references(() => humanSellers.id, { onDelete: "cascade" }).notNull(),

  // Phase tracking
  currentPhase: text("current_phase"),
  currentPhaseIndex: integer("current_phase_index").default(0),
  phasesReached: jsonb("phases_reached").$type<string[]>().default(sql`'[]'::jsonb`),

  // Checkpoint tracking
  checkpointsCompleted: jsonb("checkpoints_completed").$type<Array<{
    checkpointId: string;
    status: "completed" | "pending";
    completedAt: string;
  }>>().default(sql`'[]'::jsonb`),

  // Validated items per checkpoint
  validatedCheckpointItems: jsonb("validated_checkpoint_items").$type<Record<string, Array<{
    check: string;
    status: "validated";
    infoCollected: string;
    evidenceQuote: string;
  }>>>().default(sql`'{}'::jsonb`),

  // Conversation messages
  conversationMessages: jsonb("conversation_messages").$type<Array<{
    role: "seller" | "prospect";
    content: string;
    timestamp: number;
    phase?: string;
  }>>().default(sql`'[]'::jsonb`),

  // Archetype state
  archetypeState: jsonb("archetype_state").$type<{
    detectedArchetype: string;
    confidence: number;
    traits: string[];
  } | null>(),

  // Full transcript (per replay)
  fullTranscript: jsonb("full_transcript").$type<Array<{
    speakerId: string;
    speakerName: string;
    text: string;
    timestamp: number;
    sentiment: "positive" | "neutral" | "negative";
  }>>().default(sql`'[]'::jsonb`),

  // Script snapshot
  scriptSnapshot: jsonb("script_snapshot"),
  scriptVersion: text("script_version"),

  // Coaching metrics
  coachingMetrics: jsonb("coaching_metrics").$type<{
    totalBuySignals: number;
    totalObjections: number;
    objectionsHandled: number;
    scriptAdherenceScores: number[];
  }>(),

  // Calculated metrics
  completionRate: real("completion_rate").default(0),
  totalDuration: integer("total_duration").default(0),

  // Timestamps
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type HumanSellerMeetingTraining = typeof humanSellerMeetingTraining.$inferSelect;
export type InsertHumanSellerMeetingTraining = typeof humanSellerMeetingTraining.$inferInsert;

// Performance Summary - Metriche aggregate per periodo (giornaliera, settimanale, mensile)
export const humanSellerPerformanceSummary = pgTable("human_seller_performance_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").references(() => humanSellers.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  period: text("period").notNull().$type<"daily" | "weekly" | "monthly">(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalMeetings: integer("total_meetings").default(0),
  completedMeetings: integer("completed_meetings").default(0),
  totalDurationMinutes: integer("total_duration_minutes").default(0),
  avgDurationMinutes: integer("avg_duration_minutes").default(0),
  totalBuySignals: integer("total_buy_signals").default(0),
  avgBuySignalsPerMeeting: real("avg_buy_signals_per_meeting").default(0),
  totalObjections: integer("total_objections").default(0),
  objectionHandlingRate: real("objection_handling_rate").default(0), // percentage
  avgScriptAdherence: real("avg_script_adherence").default(0), // 0-100
  avgCheckpointCompletion: real("avg_checkpoint_completion").default(0), // percentage
  wonDeals: integer("won_deals").default(0),
  lostDeals: integer("lost_deals").default(0),
  followUps: integer("follow_ups").default(0),
  conversionRate: real("conversion_rate").default(0), // percentage
  archetypeBreakdown: jsonb("archetype_breakdown").$type<Record<string, number>>(), // { "analizzatore": 5, "decisore": 3, ... }
  toneWarningsTotal: integer("tone_warnings_total").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    sellerIdx: index("performance_summary_seller_idx").on(table.sellerId),
    periodIdx: index("performance_summary_period_idx").on(table.period, table.periodStart),
    clientIdx: index("performance_summary_client_idx").on(table.clientId),
  };
});

export type HumanSellerPerformanceSummary = typeof humanSellerPerformanceSummary.$inferSelect;
export type InsertHumanSellerPerformanceSummary = typeof humanSellerPerformanceSummary.$inferInsert;

// ============================================
// CONSULTANT KNOWLEDGE BASE
// Base di conoscenza AI per consulenti
// ============================================

// Documenti della Knowledge Base - documenti caricati dal consulente per arricchire l'AI
export const consultantKnowledgeDocuments = pgTable("consultant_knowledge_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Document metadata
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").$type<
    "white_paper" | "case_study" | "manual" | "normative" | "research" | "article" | "other"
  >().default("other").notNull(),

  // File information
  fileName: text("file_name").notNull(),
  fileType: text("file_type").$type<"pdf" | "docx" | "txt" | "md" | "rtf" | "odt" | "csv" | "xlsx" | "xls" | "pptx" | "ppt" | "mp3" | "wav" | "m4a" | "ogg" | "webm_audio">().notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  filePath: text("file_path").notNull(), // path to stored file

  // Extracted content for AI search
  extractedContent: text("extracted_content"), // Full text extracted from document
  contentSummary: text("content_summary"), // AI-generated summary (only when enabled)
  summaryEnabled: boolean("summary_enabled").default(false).notNull(), // Toggle for enabling summary generation
  keywords: jsonb("keywords").$type<string[]>().default(sql`'[]'::jsonb`), // Extracted keywords
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`), // Custom user tags

  // Versioning
  version: integer("version").default(1).notNull(), // Document version number
  previousVersionId: varchar("previous_version_id"), // Link to previous version

  // Search optimization
  priority: integer("priority").default(5).notNull(), // 1-10, higher = more important

  // Processing status
  status: text("status").$type<"uploading" | "processing" | "indexed" | "error">().default("uploading").notNull(),
  errorMessage: text("error_message"),

  // Usage tracking
  usageCount: integer("usage_count").default(0).notNull(), // Times used in AI responses
  lastUsedAt: timestamp("last_used_at"),

  // Import source tracking
  googleDriveFileId: text("google_drive_file_id"), // Google Drive file ID if imported from Drive

  // Timestamps
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  consultantIdx: index("knowledge_doc_consultant_idx").on(table.consultantId),
  categoryIdx: index("knowledge_doc_category_idx").on(table.category),
  statusIdx: index("knowledge_doc_status_idx").on(table.status),
  googleDriveIdx: index("knowledge_doc_google_drive_idx").on(table.googleDriveFileId),
}));

// API esterne per Knowledge Base - configurazioni per interrogare servizi esterni
export const consultantKnowledgeApis = pgTable("consultant_knowledge_apis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // API identification
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").$type<
    "market_data" | "regulatory" | "benchmarking" | "news" | "analytics" | "custom"
  >().default("custom").notNull(),

  // Connection settings
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key"), // Encrypted API key
  authType: text("auth_type").$type<"none" | "api_key" | "bearer" | "basic" | "oauth">().default("api_key").notNull(),
  authConfig: jsonb("auth_config").$type<{
    headerName?: string; // e.g., "X-API-Key", "Authorization"
    prefix?: string; // e.g., "Bearer ", "Basic "
    username?: string; // for basic auth
    oauthTokenUrl?: string; // for OAuth
    oauthClientId?: string;
  }>(),

  // Request configuration
  defaultEndpoint: text("default_endpoint"), // e.g., "/v1/data"
  requestMethod: text("request_method").$type<"GET" | "POST">().default("GET").notNull(),
  requestHeaders: jsonb("request_headers").$type<Record<string, string>>().default(sql`'{}'::jsonb`),
  requestParams: jsonb("request_params").$type<Record<string, string>>().default(sql`'{}'::jsonb`),

  // Data extraction configuration
  dataMapping: jsonb("data_mapping").$type<{
    responsePath?: string; // JSON path to extract data, e.g., "data.results"
    fields?: Array<{
      sourceField: string;
      targetName: string;
      transform?: "string" | "number" | "date" | "array";
    }>;
  }>(),

  // Caching & refresh settings
  cacheDurationMinutes: integer("cache_duration_minutes").default(60).notNull(),
  autoRefresh: boolean("auto_refresh").default(false).notNull(),
  refreshIntervalMinutes: integer("refresh_interval_minutes").default(60),

  // Status & tracking
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status").$type<"success" | "error" | "never">().default("never"),
  lastSyncError: text("last_sync_error"),

  // Summary settings
  summaryEnabled: boolean("summary_enabled").default(false).notNull(), // Toggle for enabling summary generation
  dataSummary: text("data_summary"), // AI-generated summary of the API data

  // Template info (for pre-configured templates)
  templateId: text("template_id"), // e.g., "hubspot", "salesforce", "istat"
  templateName: text("template_name"), // Friendly name of the template

  // Usage tracking
  usageCount: integer("usage_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at"),

  // Priority for AI Controller
  priority: integer("priority").default(5).notNull(), // 1-10

  // Timestamps
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  consultantIdx: index("knowledge_api_consultant_idx").on(table.consultantId),
  categoryIdx: index("knowledge_api_category_idx").on(table.category),
  activeIdx: index("knowledge_api_active_idx").on(table.isActive),
}));

// Cache per dati API - evita chiamate ripetute
export const consultantKnowledgeApiCache = pgTable("consultant_knowledge_api_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiConfigId: varchar("api_config_id").references(() => consultantKnowledgeApis.id, { onDelete: "cascade" }).notNull(),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Cache key (for different queries to same API)
  cacheKey: text("cache_key").default("default").notNull(),

  // Cached data
  cachedData: jsonb("cached_data").notNull(),
  dataSummary: text("data_summary"), // AI summary of cached data

  // Cache validity
  expiresAt: timestamp("expires_at").notNull(),

  // Timestamps
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  apiConfigIdx: index("knowledge_cache_api_idx").on(table.apiConfigId),
  expiresIdx: index("knowledge_cache_expires_idx").on(table.expiresAt),
  cacheKeyIdx: index("knowledge_cache_key_idx").on(table.apiConfigId, table.cacheKey),
}));

// Validation schemas for Knowledge Documents
export const insertConsultantKnowledgeDocumentSchema = createInsertSchema(consultantKnowledgeDocuments).omit({
  id: true,
  extractedContent: true,
  contentSummary: true,
  summaryEnabled: true,
  keywords: true,
  tags: true,
  version: true,
  previousVersionId: true,
  status: true,
  errorMessage: true,
  usageCount: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "Il titolo è obbligatorio"),
  category: z.enum(["white_paper", "case_study", "manual", "normative", "research", "article", "other"]).default("other"),
  priority: z.number().min(1).max(10).default(5),
});

export const updateConsultantKnowledgeDocumentSchema = insertConsultantKnowledgeDocumentSchema.partial().omit({
  consultantId: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  filePath: true,
});

// Validation schemas for Knowledge APIs
export const insertConsultantKnowledgeApiSchema = createInsertSchema(consultantKnowledgeApis).omit({
  id: true,
  lastSyncAt: true,
  lastSyncStatus: true,
  lastSyncError: true,
  usageCount: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Il nome dell'API è obbligatorio"),
  baseUrl: z.string().url("URL base non valido"),
  category: z.enum(["market_data", "regulatory", "benchmarking", "news", "analytics", "custom"]).default("custom"),
  authType: z.enum(["none", "api_key", "bearer", "basic", "oauth"]).default("api_key"),
  requestMethod: z.enum(["GET", "POST"]).default("GET"),
  cacheDurationMinutes: z.number().min(1).max(1440).default(60),
  priority: z.number().min(1).max(10).default(5),
});

export const updateConsultantKnowledgeApiSchema = insertConsultantKnowledgeApiSchema.partial().omit({
  consultantId: true,
});

// Types for Knowledge Base
export type ConsultantKnowledgeDocument = typeof consultantKnowledgeDocuments.$inferSelect;
export type InsertConsultantKnowledgeDocument = z.infer<typeof insertConsultantKnowledgeDocumentSchema>;
export type UpdateConsultantKnowledgeDocument = z.infer<typeof updateConsultantKnowledgeDocumentSchema>;

export type ConsultantKnowledgeApi = typeof consultantKnowledgeApis.$inferSelect;
export type InsertConsultantKnowledgeApi = z.infer<typeof insertConsultantKnowledgeApiSchema>;
export type UpdateConsultantKnowledgeApi = z.infer<typeof updateConsultantKnowledgeApiSchema>;

export type ConsultantKnowledgeApiCache = typeof consultantKnowledgeApiCache.$inferSelect;
export type InsertConsultantKnowledgeApiCache = typeof consultantKnowledgeApiCache.$inferInsert;

// ============================================
// CLIENT KNOWLEDGE BASE TABLES
// ============================================
// Replica dell'infrastruttura Knowledge Base per i client (AI Assistant /client/ai-assistant)

// Documenti della Knowledge Base Client - documenti caricati dal client per arricchire l'AI
export const clientKnowledgeDocuments = pgTable("client_knowledge_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Document metadata
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").$type<
    "white_paper" | "case_study" | "manual" | "normative" | "research" | "article" | "other"
  >().default("other").notNull(),

  // File information
  fileName: text("file_name").notNull(),
  fileType: text("file_type").$type<"pdf" | "docx" | "txt" | "md" | "rtf" | "odt" | "csv" | "xlsx" | "xls" | "pptx" | "ppt" | "mp3" | "wav" | "m4a" | "ogg" | "webm_audio">().notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),

  // Extracted content for AI search
  extractedContent: text("extracted_content"),
  contentSummary: text("content_summary"),
  summaryEnabled: boolean("summary_enabled").default(false).notNull(),
  keywords: jsonb("keywords").$type<string[]>().default(sql`'[]'::jsonb`),
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),

  // Structured data for tabular files (CSV/Excel) - used for preview
  structuredData: jsonb("structured_data").$type<{
    sheets: Array<{
      name: string;
      headers: string[];
      rows: any[][];
      rowCount: number;
      columnCount: number;
    }>;
    totalRows: number;
    totalColumns: number;
    fileType: 'csv' | 'xlsx' | 'xls';
  } | null>(),

  // Versioning
  version: integer("version").default(1).notNull(),
  previousVersionId: varchar("previous_version_id"),

  // Search optimization
  priority: integer("priority").default(5).notNull(),

  // Processing status
  status: text("status").$type<"uploading" | "processing" | "indexed" | "error">().default("uploading").notNull(),
  errorMessage: text("error_message"),

  // Usage tracking
  usageCount: integer("usage_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at"),

  // Import source tracking
  googleDriveFileId: text("google_drive_file_id"), // Google Drive file ID if imported from Drive
  sourceConsultantDocId: varchar("source_consultant_doc_id").references(() => consultantKnowledgeDocuments.id, { onDelete: "set null" }), // Source consultant document if imported from consultant's KB

  // Timestamps
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  clientIdx: index("client_knowledge_doc_client_idx").on(table.clientId),
  categoryIdx: index("client_knowledge_doc_category_idx").on(table.category),
  statusIdx: index("client_knowledge_doc_status_idx").on(table.status),
  googleDriveIdx: index("client_knowledge_doc_google_drive_idx").on(table.googleDriveFileId),
  sourceConsultantDocIdx: index("client_knowledge_doc_source_consultant_idx").on(table.sourceConsultantDocId),
}));

// API esterne per Knowledge Base Client - configurazioni per interrogare servizi esterni
export const clientKnowledgeApis = pgTable("client_knowledge_apis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // API identification
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").$type<
    "market_data" | "regulatory" | "benchmarking" | "news" | "analytics" | "custom"
  >().default("custom").notNull(),

  // Connection settings
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key"), // Encrypted API key (uses same encryption as consultant)
  authType: text("auth_type").$type<"none" | "api_key" | "bearer" | "basic" | "oauth">().default("api_key").notNull(),
  authConfig: jsonb("auth_config").$type<{
    headerName?: string;
    prefix?: string;
    username?: string;
    oauthTokenUrl?: string;
    oauthClientId?: string;
  }>(),

  // Request configuration
  defaultEndpoint: text("default_endpoint"),
  endpoint: text("endpoint"),
  requestMethod: text("request_method").$type<"GET" | "POST">().default("GET").notNull(),
  requestHeaders: jsonb("request_headers").$type<Record<string, string>>().default(sql`'{}'::jsonb`),
  customHeaders: jsonb("custom_headers").$type<Record<string, string>>().default(sql`'{}'::jsonb`),
  requestParams: jsonb("request_params").$type<Record<string, string>>().default(sql`'{}'::jsonb`),

  // Data extraction configuration
  dataMapping: jsonb("data_mapping").$type<{
    responsePath?: string;
    fields?: Array<{
      sourceField: string;
      targetName: string;
      transform?: "string" | "number" | "date" | "array";
    }>;
  }>(),

  // Caching & refresh settings
  cacheDurationMinutes: integer("cache_duration_minutes").default(60).notNull(),
  autoRefresh: boolean("auto_refresh").default(false).notNull(),
  refreshIntervalMinutes: integer("refresh_interval_minutes").default(60),

  // Status & tracking
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status").$type<"success" | "error" | "never">().default("never"),
  lastSyncError: text("last_sync_error"),

  // Summary settings
  summaryEnabled: boolean("summary_enabled").default(false).notNull(),
  dataSummary: text("data_summary"),

  // Template info
  templateId: text("template_id"),
  templateName: text("template_name"),

  // Usage tracking
  usageCount: integer("usage_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at"),

  // Priority for AI Controller
  priority: integer("priority").default(5).notNull(),

  // Timestamps
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  clientIdx: index("client_knowledge_api_client_idx").on(table.clientId),
  categoryIdx: index("client_knowledge_api_category_idx").on(table.category),
  activeIdx: index("client_knowledge_api_active_idx").on(table.isActive),
}));

// Cache per dati API Client - evita chiamate ripetute
export const clientKnowledgeApiCache = pgTable("client_knowledge_api_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiConfigId: varchar("api_config_id").references(() => clientKnowledgeApis.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Cache key
  cacheKey: text("cache_key").default("default").notNull(),

  // Cached data
  cachedData: jsonb("cached_data").notNull(),
  dataSummary: text("data_summary"),

  // Cache validity
  expiresAt: timestamp("expires_at").notNull(),

  // Timestamps
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  apiConfigIdx: index("client_knowledge_cache_api_idx").on(table.apiConfigId),
  expiresIdx: index("client_knowledge_cache_expires_idx").on(table.expiresAt),
  cacheKeyIdx: index("client_knowledge_cache_key_idx").on(table.apiConfigId, table.cacheKey),
}));

// Validation schemas for Client Knowledge Documents
export const insertClientKnowledgeDocumentSchema = createInsertSchema(clientKnowledgeDocuments).omit({
  id: true,
  extractedContent: true,
  contentSummary: true,
  summaryEnabled: true,
  keywords: true,
  tags: true,
  version: true,
  previousVersionId: true,
  status: true,
  errorMessage: true,
  usageCount: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "Il titolo è obbligatorio"),
  category: z.enum(["white_paper", "case_study", "manual", "normative", "research", "article", "other"]).default("other"),
  priority: z.number().min(1).max(10).default(5),
});

export const updateClientKnowledgeDocumentSchema = insertClientKnowledgeDocumentSchema.partial().omit({
  clientId: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  filePath: true,
});

// Validation schemas for Client Knowledge APIs
export const insertClientKnowledgeApiSchema = createInsertSchema(clientKnowledgeApis).omit({
  id: true,
  lastSyncAt: true,
  lastSyncStatus: true,
  lastSyncError: true,
  usageCount: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Il nome dell'API è obbligatorio"),
  baseUrl: z.string().url("URL base non valido"),
  category: z.enum(["market_data", "regulatory", "benchmarking", "news", "analytics", "custom"]).default("custom"),
  authType: z.enum(["none", "api_key", "bearer", "basic", "oauth"]).default("api_key"),
  requestMethod: z.enum(["GET", "POST"]).default("GET"),
  cacheDurationMinutes: z.number().min(1).max(1440).default(60),
  priority: z.number().min(1).max(10).default(5),
});

export const updateClientKnowledgeApiSchema = insertClientKnowledgeApiSchema.partial().omit({
  clientId: true,
});

// Types for Client Knowledge Base
export type ClientKnowledgeDocument = typeof clientKnowledgeDocuments.$inferSelect;
export type InsertClientKnowledgeDocument = z.infer<typeof insertClientKnowledgeDocumentSchema>;
export type UpdateClientKnowledgeDocument = z.infer<typeof updateClientKnowledgeDocumentSchema>;

export type ClientKnowledgeApi = typeof clientKnowledgeApis.$inferSelect;
export type InsertClientKnowledgeApi = z.infer<typeof insertClientKnowledgeApiSchema>;
export type UpdateClientKnowledgeApi = z.infer<typeof updateClientKnowledgeApiSchema>;

export type ClientKnowledgeApiCache = typeof clientKnowledgeApiCache.$inferSelect;
export type InsertClientKnowledgeApiCache = typeof clientKnowledgeApiCache.$inferInsert;

// ============================================
// SUPER ADMIN - System Settings
// ============================================

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  category: text("category").$type<"google_oauth" | "email" | "integrations" | "general">().notNull(),
  description: text("description"),
  isEncrypted: boolean("is_encrypted").default(false),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const adminAuditLog = pgTable("admin_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").$type<"user" | "setting" | "system">().notNull(),
  targetId: varchar("target_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Types for System Settings
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// Consultant Onboarding Status - Track setup completion for each consultant
// ═══════════════════════════════════════════════════════════════════════════

export const consultantOnboardingStatus = pgTable("consultant_onboarding_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),

  // Core Infrastructure
  vertexAiStatus: text("vertex_ai_status").$type<"pending" | "configured" | "verified" | "error">().default("pending").notNull(),
  vertexAiTestedAt: timestamp("vertex_ai_tested_at"),
  vertexAiErrorMessage: text("vertex_ai_error_message"),

  smtpStatus: text("smtp_status").$type<"pending" | "configured" | "verified" | "error">().default("pending").notNull(),
  smtpTestedAt: timestamp("smtp_tested_at"),
  smtpErrorMessage: text("smtp_error_message"),

  googleCalendarStatus: text("google_calendar_status").$type<"pending" | "configured" | "verified" | "error">().default("pending").notNull(),
  googleCalendarTestedAt: timestamp("google_calendar_tested_at"),
  googleCalendarErrorMessage: text("google_calendar_error_message"),

  videoMeetingStatus: text("video_meeting_status").$type<"pending" | "configured" | "verified" | "error" | "skipped">().default("pending").notNull(),
  videoMeetingTestedAt: timestamp("video_meeting_tested_at"),
  videoMeetingErrorMessage: text("video_meeting_error_message"),

  // Optional Integrations
  leadImportStatus: text("lead_import_status").$type<"pending" | "configured" | "verified" | "error" | "skipped">().default("pending").notNull(),
  leadImportTestedAt: timestamp("lead_import_tested_at"),
  leadImportErrorMessage: text("lead_import_error_message"),

  // WhatsApp AI (Separate from Twilio)
  whatsappAiStatus: text("whatsapp_ai_status").$type<"pending" | "configured" | "verified" | "error" | "skipped">().default("pending").notNull(),
  whatsappAiTestedAt: timestamp("whatsapp_ai_tested_at"),
  whatsappAiErrorMessage: text("whatsapp_ai_error_message"),

  // Knowledge Base
  knowledgeBaseStatus: text("knowledge_base_status").$type<"pending" | "configured" | "verified">().default("pending").notNull(),
  knowledgeBaseDocumentsCount: integer("knowledge_base_documents_count").default(0),

  // WhatsApp Agents (by type)
  hasInboundAgent: boolean("has_inbound_agent").default(false).notNull(),
  hasOutboundAgent: boolean("has_outbound_agent").default(false).notNull(),
  hasConsultativeAgent: boolean("has_consultative_agent").default(false).notNull(),

  // Public Agent Link
  hasPublicAgentLink: boolean("has_public_agent_link").default(false).notNull(),
  publicLinksCount: integer("public_links_count").default(0),

  // AI Ideas Generated
  hasGeneratedIdeas: boolean("has_generated_ideas").default(false).notNull(),
  generatedIdeasCount: integer("generated_ideas_count").default(0),

  // Courses (University)
  hasCreatedCourse: boolean("has_created_course").default(false).notNull(),
  coursesCount: integer("courses_count").default(0),

  // Exercises
  hasCreatedExercise: boolean("has_created_exercise").default(false).notNull(),
  exercisesCount: integer("exercises_count").default(0),

  // First Summary Email Sent (from appointments)
  hasFirstSummaryEmail: boolean("has_first_summary_email").default(false).notNull(),
  summaryEmailsCount: integer("summary_emails_count").default(0),

  // Client AI Decision
  clientAiStrategy: text("client_ai_strategy").$type<"vertex_shared" | "vertex_per_client" | "undecided">().default("undecided").notNull(),

  // Overall Status
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  lastUpdatedStep: text("last_updated_step"),

  // Interactive Intro (Minigame AI Narrativo)
  interactiveIntroCompleted: boolean("interactive_intro_completed").default(false).notNull(),
  interactiveIntroCompletedAt: timestamp("interactive_intro_completed_at"),
  interactiveIntroResponses: jsonb("interactive_intro_responses").$type<{
    businessType?: string;
    mainChallenge?: string;
    clientCount?: string;
    whyHere?: string;
    suggestedPath?: string[];
  }>(),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type ConsultantOnboardingStatus = typeof consultantOnboardingStatus.$inferSelect;
export type InsertConsultantOnboardingStatus = typeof consultantOnboardingStatus.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// Consultant AI Ideas - Persist generated ideas for WhatsApp agents
// ═══════════════════════════════════════════════════════════════════════════

export const consultantAiIdeas = pgTable("consultant_ai_ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  name: text("name").notNull(),
  description: text("description").notNull(),
  targetAudience: text("target_audience"),
  agentType: text("agent_type").$type<"whatsapp" | "public_link" | "both">().default("whatsapp").notNull(),
  integrationTypes: jsonb("integration_types").$type<string[]>().default([]),
  sourceType: text("source_type").$type<"generated" | "template" | "custom">().default("generated").notNull(),

  suggestedAgentType: text("suggested_agent_type").$type<"reactive_lead" | "proactive_setter" | "informative_advisor">().default("reactive_lead"),
  personality: text("personality"),
  whoWeHelp: text("who_we_help"),
  whoWeDontHelp: text("who_we_dont_help"),
  whatWeDo: text("what_we_do"),
  howWeDoIt: text("how_we_do_it"),
  usp: text("usp"),
  suggestedInstructions: text("suggested_instructions"),
  useCases: jsonb("use_cases").$type<string[]>().default([]),

  vision: text("vision"),
  mission: text("mission"),
  businessName: text("business_name"),
  consultantDisplayName: text("consultant_display_name"),

  isImplemented: boolean("is_implemented").default(false),
  implementedAgentId: varchar("implemented_agent_id"),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type ConsultantAiIdea = typeof consultantAiIdeas.$inferSelect;
export type InsertConsultantAiIdea = typeof consultantAiIdeas.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// User Role Profiles - Allow same email to have multiple roles (consultant + client)
// ═══════════════════════════════════════════════════════════════════════════

export const userRoleProfiles = pgTable("user_role_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull().$type<"consultant" | "client" | "super_admin">(),
  consultantId: varchar("consultant_id").references(() => users.id), // null for consultants, references consultant for clients
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueUserRoleConsultant: unique().on(table.userId, table.role, table.consultantId),
  }
});

export type UserRoleProfile = typeof userRoleProfiles.$inferSelect;
export type InsertUserRoleProfile = typeof userRoleProfiles.$inferInsert;

export const insertUserRoleProfileSchema = createInsertSchema(userRoleProfiles).omit({
  id: true,
  createdAt: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// Follow-up Algorithmic System - Intelligent proactive outreach
// ═══════════════════════════════════════════════════════════════════════════

// Conversation States - Track conversation lifecycle
export const conversationStates = pgTable("conversation_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }).notNull(),

  currentState: text("current_state").$type<
    "new_contact" | "contacted" | "engaged" | "qualified" | "stalled" |
    "negotiating" | "demo" | "closed_won" | "closed_lost" | "ghost" | "nurturing"
  >().default("new_contact").notNull(),
  previousState: text("previous_state").$type<
    "new_contact" | "contacted" | "engaged" | "qualified" | "stalled" |
    "negotiating" | "demo" | "closed_won" | "closed_lost" | "ghost" | "nurturing"
  >(),

  // Signals detected by AI
  hasAskedPrice: boolean("has_asked_price").default(false).notNull(),
  hasMentionedUrgency: boolean("has_mentioned_urgency").default(false).notNull(),
  hasSaidNoExplicitly: boolean("has_said_no_explicitly").default(false).notNull(),
  discoveryCompleted: boolean("discovery_completed").default(false).notNull(),
  demoPresented: boolean("demo_presented").default(false).notNull(),

  // Follow-up tracking
  followupCount: integer("followup_count").default(0).notNull(),
  maxFollowupsAllowed: integer("max_followups_allowed").default(5).notNull(),
  lastFollowupAt: timestamp("last_followup_at"),
  nextFollowupScheduledAt: timestamp("next_followup_scheduled_at"),

  // Intelligent retry logic - NEW FIELDS
  consecutiveNoReplyCount: integer("consecutive_no_reply_count").default(0).notNull(), // Tentativi senza risposta consecutivi
  lastReplyAt: timestamp("last_reply_at"), // Ultima risposta del lead
  dormantUntil: timestamp("dormant_until"), // Data fine dormienza (3 mesi dopo 3 tentativi)
  permanentlyExcluded: boolean("permanently_excluded").default(false).notNull(), // Mai più contattare
  dormantReason: text("dormant_reason"), // Motivo dormienza es: "Nessuna risposta dopo 3 tentativi"

  // AI scoring
  engagementScore: integer("engagement_score").default(50).notNull(), // 0-100
  conversionProbability: real("conversion_probability").default(0.5), // 0-1
  lastAiEvaluationAt: timestamp("last_ai_evaluation_at"),
  aiRecommendation: text("ai_recommendation"), // Last AI decision reasoning

  // Temperature segmentation for scalability (hot=<2h, warm=<24h, cold=<7d, ghost=>7d)
  temperatureLevel: text("temperature_level").$type<"hot" | "warm" | "cold" | "ghost">().default("warm"),

  stateChangedAt: timestamp("state_changed_at").default(sql`now()`),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => {
  return {
    uniqueConversationId: unique().on(table.conversationId),
  }
});

export type ConversationState = typeof conversationStates.$inferSelect;
export type InsertConversationState = typeof conversationStates.$inferInsert;

// Follow-up Rules - Configurable automation rules (uses existing whatsappCustomTemplates from line ~2811)
export const followupRules = pgTable("followup_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentId: varchar("agent_id").references(() => consultantWhatsappConfig.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  description: text("description"),

  triggerType: text("trigger_type").$type<"time_based" | "event_based" | "ai_decision">().default("time_based").notNull(),
  triggerCondition: jsonb("trigger_condition").$type<{
    hoursWithoutReply?: number;
    daysWithoutReply?: number;
    afterState?: string;
    onEvent?: string;
    minEngagementScore?: number;
    maxEngagementScore?: number;
  }>().notNull(),

  templateId: varchar("template_id").references(() => whatsappCustomTemplates.id, { onDelete: "set null" }),
  fallbackMessage: text("fallback_message"),

  applicableToStates: jsonb("applicable_to_states").$type<string[]>().default([]),
  applicableToAgentTypes: jsonb("applicable_to_agent_types").$type<string[]>().default([]),
  applicableToChannels: jsonb("applicable_to_channels").$type<string[]>().default([]),

  maxAttempts: integer("max_attempts").default(3).notNull(),
  cooldownHours: integer("cooldown_hours").default(24).notNull(),
  priority: integer("priority").default(5).notNull(),

  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type FollowupRule = typeof followupRules.$inferSelect;
export type InsertFollowupRule = typeof followupRules.$inferInsert;

// Scheduled Follow-up Messages - Queue for pending outreach
export const scheduledFollowupMessages = pgTable("scheduled_followup_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }).notNull(),
  ruleId: varchar("rule_id").references(() => followupRules.id, { onDelete: "set null" }),
  templateId: varchar("template_id"),

  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").$type<"pending" | "sent" | "cancelled" | "failed" | "skipped">().default("pending").notNull(),

  // Template variables
  templateVariables: jsonb("template_variables").$type<Record<string, string>>().default({}),
  fallbackMessage: text("fallback_message"),

  // AI decision context
  aiDecisionReasoning: text("ai_decision_reasoning"),
  aiConfidenceScore: real("ai_confidence_score"),
  messagePreview: text("message_preview"),
  aiSelectedTemplateReasoning: text("ai_selected_template_reasoning"),

  // Execution tracking
  sentAt: timestamp("sent_at"),
  twilioMessageSid: varchar("twilio_message_sid"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason").$type<"user_replied" | "manual" | "max_reached" | "state_changed" | "error">(),
  errorMessage: text("error_message"),

  // Retry tracking
  attemptCount: integer("attempt_count").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextRetryAt: timestamp("next_retry_at"),
  lastErrorCode: text("last_error_code").$type<"rate_limit" | "network" | "timeout" | "invalid_number" | "blocked" | "template_rejected" | "unknown">(),
  failureReason: text("failure_reason").$type<"max_retries_exceeded" | "permanent_error" | "user_blocked" | "invalid_recipient">(),

  createdAt: timestamp("created_at").default(sql`now()`),
});

export type ScheduledFollowupMessage = typeof scheduledFollowupMessages.$inferSelect;
export type InsertScheduledFollowupMessage = typeof scheduledFollowupMessages.$inferInsert;

// Error codes that allow retry vs permanent failures
export const RETRYABLE_ERROR_CODES = ["rate_limit", "network", "timeout", "unknown"] as const;
export const PERMANENT_ERROR_CODES = ["invalid_number", "blocked", "template_rejected"] as const;

// Follow-up Analytics - Track performance metrics
export const followupAnalytics = pgTable("followup_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentId: varchar("agent_id").references(() => consultantWhatsappConfig.id, { onDelete: "cascade" }),
  templateId: varchar("template_id").references(() => whatsappCustomTemplates.id, { onDelete: "set null" }),
  ruleId: varchar("rule_id").references(() => followupRules.id, { onDelete: "set null" }),

  // Time period
  date: timestamp("date").notNull(),

  // Counts
  messagesSent: integer("messages_sent").default(0).notNull(),
  messagesDelivered: integer("messages_delivered").default(0).notNull(),
  messagesRead: integer("messages_read").default(0).notNull(),
  repliesReceived: integer("replies_received").default(0).notNull(),
  conversionsAchieved: integer("conversions_achieved").default(0).notNull(),

  // Rates (calculated)
  deliveryRate: real("delivery_rate"),
  readRate: real("read_rate"),
  responseRate: real("response_rate"),
  conversionRate: real("conversion_rate"),

  // AI metrics
  aiDecisionsMade: integer("ai_decisions_made").default(0).notNull(),
  aiDecisionsAccepted: integer("ai_decisions_accepted").default(0).notNull(),
  avgConfidenceScore: real("avg_confidence_score"),

  createdAt: timestamp("created_at").default(sql`now()`),
});

export type FollowupAnalytic = typeof followupAnalytics.$inferSelect;
export type InsertFollowupAnalytic = typeof followupAnalytics.$inferInsert;

// Follow-up AI Evaluation Log - Track AI decisions for learning
export const followupAiEvaluationLog = pgTable("followup_ai_evaluation_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }).notNull(),

  // AI Input
  conversationContext: jsonb("conversation_context").$type<{
    lastMessages: Array<{ role: string; content: string; timestamp: string }>;
    currentState: string;
    daysSilent: number;
    followupCount: number;
    channel: string;
    agentType: string;
    signals: Record<string, boolean>;
  }>().notNull(),

  // AI Output
  decision: text("decision").$type<"send_now" | "schedule" | "skip" | "stop">().notNull(),
  urgency: text("urgency").$type<"now" | "tomorrow" | "next_week" | "never">(),
  selectedTemplateId: varchar("selected_template_id"),
  reasoning: text("reasoning").notNull(),
  confidenceScore: real("confidence_score").notNull(),

  // System rule matching (if a deterministic rule was applied instead of AI)
  matchedRuleId: varchar("matched_rule_id"),
  matchedRuleReason: text("matched_rule_reason"),

  // Outcome tracking (filled later)
  wasExecuted: boolean("was_executed").default(false).notNull(),
  leadReplied: boolean("lead_replied"),
  repliedWithinHours: integer("replied_within_hours"),
  outcomePositive: boolean("outcome_positive"), // Did it lead to engagement/conversion?

  // Model info
  modelUsed: text("model_used").default("gemini-3-flash-preview").notNull(),
  tokensUsed: integer("tokens_used"),
  latencyMs: integer("latency_ms"),

  createdAt: timestamp("created_at").default(sql`now()`),
});

export type FollowupAiEvaluationLog = typeof followupAiEvaluationLog.$inferSelect;
export type InsertFollowupAiEvaluationLog = typeof followupAiEvaluationLog.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// Consultant AI Preferences - Personalizzazione comportamento AI Follow-up
// ═══════════════════════════════════════════════════════════════════════════

export const consultantAiPreferences = pgTable("consultant_ai_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),

  // === PARAMETRI GLOBALI ===
  maxFollowupsTotal: integer("max_followups_total").default(5).notNull(),
  minHoursBetweenFollowups: integer("min_hours_between_followups").default(24).notNull(),
  workingHoursStart: integer("working_hours_start").default(9).notNull(), // 0-23
  workingHoursEnd: integer("working_hours_end").default(19).notNull(), // 0-23
  workingDays: jsonb("working_days").$type<number[]>().default(sql`'[1,2,3,4,5]'::jsonb`), // 0=Sun, 1=Mon...6=Sat

  // === STILE COMUNICATIVO ===
  toneStyle: text("tone_style").$type<"professionale" | "amichevole" | "diretto" | "formale">().default("professionale"),
  messageLength: text("message_length").$type<"breve" | "medio" | "dettagliato">().default("medio"),
  useEmojis: boolean("use_emojis").default(false).notNull(),

  // === AGGRESSIVITÀ FOLLOW-UP ===
  aggressivenessLevel: integer("aggressiveness_level").default(5).notNull(), // 1-10 (1=molto passivo, 10=molto aggressivo)
  persistenceLevel: integer("persistence_level").default(5).notNull(), // 1-10 (quante volte insistere su lead freddi)

  // === TIMING PREFERENZE ===
  firstFollowupDelayHours: integer("first_followup_delay_hours").default(24).notNull(),
  templateNoResponseDelayHours: integer("template_no_response_delay_hours").default(48).notNull(),
  coldLeadReactivationDays: integer("cold_lead_reactivation_days").default(7).notNull(),

  // === ISTRUZIONI PERSONALIZZATE (TESTO LIBERO) ===
  customInstructions: text("custom_instructions"), // Istruzioni libere per l'AI
  businessContext: text("business_context"), // Contesto del business
  targetAudience: text("target_audience"), // Descrizione target

  // === REGOLE SPECIALI ===
  neverContactWeekends: boolean("never_contact_weekends").default(false).notNull(),
  respectHolidays: boolean("respect_holidays").default(true).notNull(),
  stopOnFirstNo: boolean("stop_on_first_no").default(true).notNull(),
  requireLeadResponseForFreeform: boolean("require_lead_response_for_freeform").default(true).notNull(),

  // === AI BEHAVIOR FLAGS ===
  allowAiToSuggestTemplates: boolean("allow_ai_to_suggest_templates").default(true).notNull(),
  allowAiToWriteFreeformMessages: boolean("allow_ai_to_write_freeform_messages").default(true).notNull(),
  logAiReasoning: boolean("log_ai_reasoning").default(true).notNull(),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type ConsultantAiPreferences = typeof consultantAiPreferences.$inferSelect;
export type InsertConsultantAiPreferences = typeof consultantAiPreferences.$inferInsert;

export const insertConsultantAiPreferencesSchema = createInsertSchema(consultantAiPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// Gemini File Search - RAG Storage for AI Assistant
// ═══════════════════════════════════════════════════════════════════════════

export const fileSearchStores = pgTable("file_search_stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleStoreName: text("google_store_name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull(),
  ownerType: text("owner_type").$type<"consultant" | "client" | "system" | "whatsapp_agent">().notNull(),
  documentCount: integer("document_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  ownerIdx: index("file_search_stores_owner_idx").on(table.ownerId, table.ownerType),
}));

export type FileSearchStore = typeof fileSearchStores.$inferSelect;
export type InsertFileSearchStore = typeof fileSearchStores.$inferInsert;

export const fileSearchDocuments = pgTable("file_search_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => fileSearchStores.id, { onDelete: "cascade" }).notNull(),
  googleFileId: text("google_file_id").notNull(),
  fileName: text("file_name").notNull(),
  displayName: text("display_name").notNull(),
  mimeType: text("mime_type").notNull(),
  status: text("status").$type<"pending" | "processing" | "indexed" | "failed">().default("pending").notNull(),
  sourceType: text("source_type").$type<"library" | "knowledge_base" | "exercise" | "consultation" | "university" | "university_lesson" | "manual" | "financial_data" | "whatsapp_agent_knowledge" | "exercise_response" | "consultant_guide">().notNull(),
  sourceId: varchar("source_id"),
  contentHash: text("content_hash"),
  contentSize: integer("content_size"),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "set null" }),
  chunkingConfig: jsonb("chunking_config").$type<{ maxTokensPerChunk: number; maxOverlapTokens: number }>(),
  customMetadata: jsonb("custom_metadata").$type<{
    docType?: string;
    category?: string;
    moduleId?: string;
    yearId?: string;
    trimesterId?: string;
    lessonId?: string;
    tags?: string[];
  }>(),
  errorMessage: text("error_message"),
  uploadedAt: timestamp("uploaded_at").default(sql`now()`),
  indexedAt: timestamp("indexed_at"),
  lastModifiedAt: timestamp("last_modified_at"),
}, (table) => ({
  storeIdx: index("file_search_documents_store_idx").on(table.storeId),
  sourceIdx: index("file_search_documents_source_idx").on(table.sourceType, table.sourceId),
  hashIdx: index("file_search_documents_hash_idx").on(table.contentHash),
  clientIdx: index("file_search_documents_client_idx").on(table.clientId),
}));

export type FileSearchDocument = typeof fileSearchDocuments.$inferSelect;
export type InsertFileSearchDocument = typeof fileSearchDocuments.$inferInsert;

export const fileSearchUsageLogs = pgTable("file_search_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => users.id, { onDelete: "set null" }),
  requestType: text("request_type").$type<"consultant_chat" | "client_chat" | "whatsapp" | "api">().notNull(),
  storeNames: jsonb("store_names").$type<string[]>().default([]).notNull(),
  storeCount: integer("store_count").default(0).notNull(),
  documentCount: integer("document_count").default(0).notNull(),
  citationsCount: integer("citations_count").default(0).notNull(),
  usedFileSearch: boolean("used_file_search").default(false).notNull(),
  providerUsed: text("provider_used").$type<"google_ai_studio" | "vertex_ai" | "fallback">().notNull(),
  apiKeySource: text("api_key_source").$type<"env_gemini_key" | "user_key" | "consultant_key">(),
  tokensSaved: integer("tokens_saved").default(0),
  responseTimeMs: integer("response_time_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  consultantIdx: index("file_search_usage_logs_consultant_idx").on(table.consultantId),
  clientIdx: index("file_search_usage_logs_client_idx").on(table.clientId),
  createdAtIdx: index("file_search_usage_logs_created_at_idx").on(table.createdAt),
}));

export type FileSearchUsageLog = typeof fileSearchUsageLogs.$inferSelect;
export type InsertFileSearchUsageLog = typeof fileSearchUsageLogs.$inferInsert;

export const fileSearchSettings = pgTable("file_search_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  enabled: boolean("enabled").default(true).notNull(),
  autoSyncLibrary: boolean("auto_sync_library").default(true).notNull(),
  autoSyncKnowledgeBase: boolean("auto_sync_knowledge_base").default(true).notNull(),
  autoSyncExercises: boolean("auto_sync_exercises").default(false).notNull(),
  autoSyncConsultations: boolean("auto_sync_consultations").default(false).notNull(),
  autoSyncUniversity: boolean("auto_sync_university").default(false).notNull(),
  autoSyncClientKnowledge: boolean("auto_sync_client_knowledge").default(false).notNull(),
  autoSyncExerciseResponses: boolean("auto_sync_exercise_responses").default(false).notNull(),
  autoSyncFinancial: boolean("auto_sync_financial").default(false).notNull(),
  autoSyncWhatsappAgents: boolean("auto_sync_whatsapp_agents").default(false).notNull(),
  autoSyncGoals: boolean("auto_sync_goals").default(false).notNull(),
  autoSyncTasks: boolean("auto_sync_tasks").default(false).notNull(),
  autoSyncDailyReflections: boolean("auto_sync_daily_reflections").default(false).notNull(),
  autoSyncClientProgress: boolean("auto_sync_client_progress").default(false).notNull(),
  autoSyncLibraryProgress: boolean("auto_sync_library_progress").default(false).notNull(),
  autoSyncEmailJourney: boolean("auto_sync_email_journey").default(false).notNull(),
  autoSyncAssignedExercises: boolean("auto_sync_assigned_exercises").default(false).notNull(),
  autoSyncAssignedLibrary: boolean("auto_sync_assigned_library").default(false).notNull(),
  autoSyncAssignedUniversity: boolean("auto_sync_assigned_university").default(false).notNull(),
  autoSyncConsultantGuides: boolean("auto_sync_consultant_guides").default(true).notNull(),
  scheduledSyncEnabled: boolean("scheduled_sync_enabled").default(false).notNull(),
  scheduledSyncHour: integer("scheduled_sync_hour").default(3).notNull(),
  lastScheduledSync: timestamp("last_scheduled_sync"),
  lastSyncAt: timestamp("last_sync_at"),
  totalDocumentsSynced: integer("total_documents_synced").default(0).notNull(),
  totalUsageCount: integer("total_usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type FileSearchSettings = typeof fileSearchSettings.$inferSelect;
export type InsertFileSearchSettings = typeof fileSearchSettings.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// YouTube Videos & AI Lesson Generation
// ═══════════════════════════════════════════════════════════════════════════

export const youtubeVideos = pgTable("youtube_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  videoId: varchar("video_id").notNull(),
  videoUrl: text("video_url").notNull(),
  title: text("title"),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  channelName: text("channel_name"),
  duration: integer("duration"),
  transcript: text("transcript"),
  transcriptLanguage: varchar("transcript_language", { length: 10 }),
  transcriptStatus: varchar("transcript_status", { length: 50 }).default("pending"),
  playlistId: varchar("playlist_id"),
  playlistTitle: text("playlist_title"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  consultantIdx: index("idx_youtube_videos_consultant").on(table.consultantId),
  playlistIdx: index("idx_youtube_videos_playlist").on(table.playlistId),
}));

export type YoutubeVideo = typeof youtubeVideos.$inferSelect;
export type InsertYoutubeVideo = typeof youtubeVideos.$inferInsert;

export const consultantAiLessonSettings = pgTable("consultant_ai_lesson_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  writingInstructions: text("writing_instructions"),
  defaultContentType: varchar("default_content_type", { length: 20 }).default("both"),
  defaultLevel: varchar("default_level", { length: 20 }).default("base"),
  preserveSpeakerStyle: boolean("preserve_speaker_style").default(true),
  includeTimestamps: boolean("include_timestamps").default(false),
  customPrompts: jsonb("custom_prompts").default({}),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type ConsultantAiLessonSettings = typeof consultantAiLessonSettings.$inferSelect;
export type InsertConsultantAiLessonSettings = typeof consultantAiLessonSettings.$inferInsert;

export const insertYoutubeVideoSchema = createInsertSchema(youtubeVideos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsultantAiLessonSettingsSchema = createInsertSchema(consultantAiLessonSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const aiBuilderDrafts = pgTable("ai_builder_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  youtubeUrl: text("youtube_url"),
  inputType: varchar("input_type", { length: 20 }).default("video"),
  selectedCategoryId: varchar("selected_category_id"),
  selectedSubcategoryId: varchar("selected_subcategory_id"),
  selectedVideoIds: jsonb("selected_video_ids").default([]),
  playlistVideos: jsonb("playlist_videos").default([]),
  savedVideoIds: jsonb("saved_video_ids").default([]),
  aiInstructions: text("ai_instructions"),
  contentType: varchar("content_type", { length: 20 }).default("both"),
  level: varchar("level", { length: 20 }).default("base"),
  currentStep: integer("current_step").default(1),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  consultantIdx: index("idx_ai_builder_drafts_consultant").on(table.consultantId),
}));

export type AiBuilderDraft = typeof aiBuilderDrafts.$inferSelect;
export type InsertAiBuilderDraft = typeof aiBuilderDrafts.$inferInsert;

export const insertAiBuilderDraftSchema = createInsertSchema(aiBuilderDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});