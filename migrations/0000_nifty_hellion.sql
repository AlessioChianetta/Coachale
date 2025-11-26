CREATE TABLE "client_analytics_summary" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"period" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_exercises_assigned" integer DEFAULT 0,
	"total_exercises_completed" integer DEFAULT 0,
	"completion_rate" integer DEFAULT 0,
	"avg_completion_time" integer DEFAULT 0,
	"avg_score" integer DEFAULT 0,
	"avg_difficulty_rating" integer DEFAULT 0,
	"avg_satisfaction_rating" integer DEFAULT 0,
	"total_session_time" integer DEFAULT 0,
	"login_frequency" integer DEFAULT 0,
	"engagement_score" integer DEFAULT 0,
	"streak_days" integer DEFAULT 0,
	"goals_set" integer DEFAULT 0,
	"goals_achieved" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_engagement_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"login_count" integer DEFAULT 0,
	"session_duration" integer DEFAULT 0,
	"exercises_viewed" integer DEFAULT 0,
	"exercises_started" integer DEFAULT 0,
	"exercises_completed" integer DEFAULT 0,
	"messages_received" integer DEFAULT 0,
	"messages_read" integer DEFAULT 0,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"exercises_completed" integer DEFAULT 0,
	"total_exercises" integer DEFAULT 0,
	"streak_days" integer DEFAULT 0,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "consultant_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"period" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_clients" integer DEFAULT 0,
	"active_clients" integer DEFAULT 0,
	"new_clients" integer DEFAULT 0,
	"exercises_created" integer DEFAULT 0,
	"exercises_assigned" integer DEFAULT 0,
	"exercises_completed" integer DEFAULT 0,
	"total_completion_rate" integer DEFAULT 0,
	"avg_client_engagement" integer DEFAULT 0,
	"total_consultations" integer DEFAULT 0,
	"consultation_duration" integer DEFAULT 0,
	"client_retention_rate" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"duration" integer NOT NULL,
	"notes" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercise_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"due_date" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"score" integer,
	"consultant_feedback" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "exercise_performance_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"assignment_id" varchar NOT NULL,
	"submission_id" varchar,
	"started_at" timestamp,
	"completed_at" timestamp,
	"time_spent" integer,
	"difficulty_rating" integer,
	"satisfaction_rating" integer,
	"score" integer,
	"attempts" integer DEFAULT 1,
	"hints_used" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercise_revision_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"submission_id" varchar,
	"action" text NOT NULL,
	"consultant_feedback" text,
	"client_notes" text,
	"score" integer,
	"previous_status" text NOT NULL,
	"new_status" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"answers" json DEFAULT '[]'::json,
	"attachments" json DEFAULT '[]'::json,
	"notes" text,
	"submitted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercise_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"type" text NOT NULL,
	"estimated_duration" integer,
	"instructions" text,
	"questions" json DEFAULT '[]'::json,
	"tags" json DEFAULT '[]'::json,
	"created_by" varchar NOT NULL,
	"is_public" boolean DEFAULT false,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"estimated_duration" integer,
	"instructions" text,
	"attachments" json DEFAULT '[]'::json,
	"questions" json DEFAULT '[]'::json,
	"work_platform" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_value" text NOT NULL,
	"current_value" text DEFAULT '0',
	"unit" text,
	"target_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_type" text NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"details" text,
	"session_id" varchar,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"start_time" timestamp DEFAULT now(),
	"end_time" timestamp,
	"last_activity" timestamp DEFAULT now(),
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "user_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" text NOT NULL,
	"avatar" text,
	"consultant_id" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "client_analytics_summary" ADD CONSTRAINT "client_analytics_summary_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_analytics_summary" ADD CONSTRAINT "client_analytics_summary_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_engagement_metrics" ADD CONSTRAINT "client_engagement_metrics_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_engagement_metrics" ADD CONSTRAINT "client_engagement_metrics_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_progress" ADD CONSTRAINT "client_progress_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_analytics" ADD CONSTRAINT "consultant_analytics_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_assignments" ADD CONSTRAINT "exercise_assignments_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_assignments" ADD CONSTRAINT "exercise_assignments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_assignments" ADD CONSTRAINT "exercise_assignments_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_performance_metrics" ADD CONSTRAINT "exercise_performance_metrics_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_performance_metrics" ADD CONSTRAINT "exercise_performance_metrics_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_performance_metrics" ADD CONSTRAINT "exercise_performance_metrics_assignment_id_exercise_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."exercise_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_performance_metrics" ADD CONSTRAINT "exercise_performance_metrics_submission_id_exercise_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."exercise_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_revision_history" ADD CONSTRAINT "exercise_revision_history_assignment_id_exercise_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."exercise_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_revision_history" ADD CONSTRAINT "exercise_revision_history_submission_id_exercise_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."exercise_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_revision_history" ADD CONSTRAINT "exercise_revision_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_assignment_id_exercise_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."exercise_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_templates" ADD CONSTRAINT "exercise_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;