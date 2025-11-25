CREATE TABLE "ai_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"mode" text NOT NULL,
	"consultant_type" text,
	"title" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_message_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"tokens_used" integer,
	"context_snapshot" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_user_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"preferred_mode" text DEFAULT 'assistenza',
	"preferred_consultant_type" text DEFAULT 'finanziario',
	"enable_proactive_suggestions" boolean DEFAULT true,
	"daily_digest_enabled" boolean DEFAULT false,
	"last_interaction" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_user_preferences_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "appointment_bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"conversation_id" varchar,
	"client_phone" text NOT NULL,
	"client_name" text,
	"client_surname" text,
	"client_email" text,
	"appointment_date" date NOT NULL,
	"appointment_time" text NOT NULL,
	"appointment_end_time" text,
	"google_event_id" text,
	"calendar_event_id" varchar,
	"status" text DEFAULT 'proposed' NOT NULL,
	"proposed_slots" jsonb DEFAULT '[]'::jsonb,
	"cancellation_reason" text,
	"confirmed_at" timestamp,
	"cancelled_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "automated_emails_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultation_id" varchar,
	"email_type" text NOT NULL,
	"journey_day" integer,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"opened_at" timestamp,
	"is_test" boolean DEFAULT false NOT NULL,
	"includes_tasks" boolean DEFAULT false NOT NULL,
	"includes_goals" boolean DEFAULT false NOT NULL,
	"includes_state" boolean DEFAULT false NOT NULL,
	"tasks_count" integer DEFAULT 0 NOT NULL,
	"goals_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start" timestamp NOT NULL,
	"end" timestamp NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"color" text DEFAULT '#3b82f6',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_email_automation" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_email_automation_consultant_id_client_id_unique" UNIQUE("consultant_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "client_email_journey_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"current_day" integer DEFAULT 1 NOT NULL,
	"month_start_date" timestamp DEFAULT now() NOT NULL,
	"last_email_sent_at" timestamp,
	"last_template_used_id" varchar,
	"last_email_subject" text,
	"last_email_body" text,
	"last_email_actions" jsonb DEFAULT '[]'::jsonb,
	"actions_completed_data" jsonb DEFAULT '{"completed": false, "details": []}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_email_journey_progress_consultant_id_client_id_unique" UNIQUE("consultant_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "client_library_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"time_spent" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_library_progress_client_id_document_id_unique" UNIQUE("client_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "client_objection_profile" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"phone_number" text,
	"difficulty_score" real DEFAULT 5 NOT NULL,
	"total_objections" integer DEFAULT 0 NOT NULL,
	"resolved_objections" integer DEFAULT 0 NOT NULL,
	"avg_sentiment" real DEFAULT 0,
	"avg_response_time_minutes" integer,
	"last_objection_at" timestamp,
	"escalation_required" boolean DEFAULT false NOT NULL,
	"escalated_at" timestamp,
	"profile_type" text DEFAULT 'neutral' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_roadmap_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"notes" text,
	"consultant_notes" text,
	"grade" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_roadmap_progress_client_id_item_id_unique" UNIQUE("client_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "client_state_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"current_state" text NOT NULL,
	"ideal_state" text NOT NULL,
	"internal_benefit" text,
	"external_benefit" text,
	"main_obstacle" text,
	"past_attempts" text,
	"current_actions" text,
	"future_vision" text,
	"motivation_drivers" text,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "client_state_tracking_client_id_consultant_id_unique" UNIQUE("client_id","consultant_id")
);
--> statement-breakpoint
CREATE TABLE "consultant_availability_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"google_service_account_json" jsonb,
	"google_oauth_client_id" text,
	"google_oauth_client_secret" text,
	"google_oauth_redirect_uri" text,
	"google_calendar_id" text,
	"google_refresh_token" text,
	"google_access_token" text,
	"google_token_expires_at" timestamp,
	"working_hours" jsonb DEFAULT '{}'::jsonb,
	"ai_availability" jsonb DEFAULT '{"enabled": true, "workingDays": {}}'::jsonb,
	"appointment_availability" jsonb DEFAULT '{"enabled": true, "workingDays": {}, "appointmentDuration": 60, "bufferBefore": 15, "bufferAfter": 15, "maxDaysInAdvance": 30, "minNoticeHours": 24}'::jsonb,
	"appointment_duration" integer DEFAULT 60 NOT NULL,
	"buffer_before" integer DEFAULT 15 NOT NULL,
	"buffer_after" integer DEFAULT 15 NOT NULL,
	"morning_slot_start" text DEFAULT '09:00' NOT NULL,
	"morning_slot_end" text DEFAULT '13:00' NOT NULL,
	"afternoon_slot_start" text DEFAULT '14:00' NOT NULL,
	"afternoon_slot_end" text DEFAULT '18:00' NOT NULL,
	"max_days_ahead" integer DEFAULT 30 NOT NULL,
	"min_hours_notice" integer DEFAULT 24 NOT NULL,
	"timezone" text DEFAULT 'Europe/Rome' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "consultant_availability_settings_consultant_id_unique" UNIQUE("consultant_id")
);
--> statement-breakpoint
CREATE TABLE "consultant_calendar_sync" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"google_event_id" text NOT NULL,
	"title" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'google' NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultant_smtp_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer NOT NULL,
	"smtp_secure" boolean DEFAULT true NOT NULL,
	"smtp_user" text NOT NULL,
	"smtp_password" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"email_tone" text DEFAULT 'motivazionale',
	"email_signature" text,
	"automation_enabled" boolean DEFAULT false NOT NULL,
	"email_frequency_days" integer DEFAULT 2 NOT NULL,
	"email_send_time" text DEFAULT '10:00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_tested_at" timestamp,
	"scheduler_enabled" boolean DEFAULT false,
	"scheduler_paused" boolean DEFAULT false,
	"scheduler_status" text DEFAULT 'idle',
	"last_scheduler_run" timestamp,
	"next_scheduler_run" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "consultant_smtp_settings_consultant_id_unique" UNIQUE("consultant_id")
);
--> statement-breakpoint
CREATE TABLE "consultant_whatsapp_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"twilio_account_sid" text NOT NULL,
	"twilio_auth_token" text NOT NULL,
	"twilio_whatsapp_number" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"auto_response_enabled" boolean DEFAULT true NOT NULL,
	"working_hours_enabled" boolean DEFAULT false NOT NULL,
	"working_hours_start" text,
	"working_hours_end" text,
	"working_days" jsonb,
	"after_hours_message" text,
	"business_name" text,
	"business_description" text,
	"consultant_bio" text,
	"sales_script" text,
	"vision" text,
	"mission" text,
	"values" jsonb,
	"usp" text,
	"who_we_help" text,
	"who_we_dont_help" text,
	"what_we_do" text,
	"how_we_do_it" text,
	"software_created" jsonb,
	"books_published" jsonb,
	"years_experience" integer,
	"clients_helped" integer,
	"results_generated" text,
	"case_studies" jsonb,
	"services_offered" jsonb,
	"guarantees" text,
	"ai_personality" text DEFAULT 'amico_fidato',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "consultant_whatsapp_config_consultant_id_unique" UNIQUE("consultant_id")
);
--> statement-breakpoint
CREATE TABLE "consultation_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" timestamp,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text DEFAULT 'reminder' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_reflections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"date" date NOT NULL,
	"grateful" json DEFAULT '[]'::json,
	"make_great" json DEFAULT '[]'::json,
	"do_better" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "daily_reflections_client_id_date_unique" UNIQUE("client_id","date")
);
--> statement-breakpoint
CREATE TABLE "daily_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"description" text NOT NULL,
	"date" date NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_drafts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"consultation_id" varchar,
	"journey_template_id" varchar,
	"journey_day" integer,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"email_type" text DEFAULT 'motivational' NOT NULL,
	"includes_tasks" boolean DEFAULT false NOT NULL,
	"includes_goals" boolean DEFAULT false NOT NULL,
	"includes_state" boolean DEFAULT false NOT NULL,
	"tasks_count" integer DEFAULT 0 NOT NULL,
	"goals_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"generated_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_journey_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_of_month" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"email_type" text NOT NULL,
	"prompt_template" text NOT NULL,
	"tone" text DEFAULT 'motivazionale',
	"priority" integer DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_journey_templates_day_of_month_unique" UNIQUE("day_of_month")
);
--> statement-breakpoint
CREATE TABLE "library_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'BookOpen',
	"color" text DEFAULT 'blue',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "library_category_client_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "library_category_client_assignments_category_id_client_id_consultant_id_unique" UNIQUE("category_id","client_id","consultant_id")
);
--> statement-breakpoint
CREATE TABLE "library_document_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "library_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar NOT NULL,
	"subcategory_id" varchar,
	"title" text NOT NULL,
	"subtitle" text,
	"description" text,
	"content" text,
	"content_type" text DEFAULT 'text' NOT NULL,
	"video_url" text,
	"level" text DEFAULT 'base' NOT NULL,
	"estimated_duration" integer,
	"tags" json DEFAULT '[]'::json,
	"attachments" json DEFAULT '[]'::json,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "library_subcategories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text DEFAULT 'Folder',
	"color" text DEFAULT 'gray',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "momentum_checkins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"timestamp" timestamp NOT NULL,
	"activity_description" text NOT NULL,
	"is_productive" boolean NOT NULL,
	"category" varchar(50),
	"notes" text,
	"mood" integer,
	"energy_level" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "momentum_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"target_date" date,
	"progress" integer DEFAULT 0,
	"category" varchar(50),
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "momentum_settings" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"checkin_interval_minutes" integer DEFAULT 60,
	"quiet_hours_enabled" boolean DEFAULT true,
	"quiet_hours_start" text DEFAULT '22:00',
	"quiet_hours_end" text DEFAULT '08:00',
	"notifications_enabled" boolean DEFAULT true,
	"default_productive_categories" jsonb DEFAULT '["lavoro", "studio", "esercizio fisico"]'::jsonb,
	"default_break_categories" jsonb DEFAULT '["pausa", "relax", "social"]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "objection_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"message_id" varchar,
	"objection_type" text NOT NULL,
	"objection_text" text NOT NULL,
	"ai_response" text,
	"was_resolved" boolean DEFAULT false NOT NULL,
	"resolution_strategy" text,
	"sentiment_score" real,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposed_appointment_slots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"slots" jsonb NOT NULL,
	"proposed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_for_booking" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roadmap_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" varchar NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "roadmap_groups_phase_id_sort_order_unique" UNIQUE("phase_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "roadmap_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"external_link" text,
	"external_link_title" text,
	"sort_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "roadmap_items_group_id_sort_order_unique" UNIQUE("group_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "roadmap_phases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"objective" text NOT NULL,
	"month_range" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "roadmap_phases_sort_order_unique" UNIQUE("sort_order")
);
--> statement-breakpoint
CREATE TABLE "scheduler_execution_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"clients_processed" integer DEFAULT 0 NOT NULL,
	"emails_sent" integer DEFAULT 0 NOT NULL,
	"drafts_created" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"error_details" jsonb DEFAULT '[]'::jsonb,
	"execution_time_ms" integer,
	"status" text DEFAULT 'success' NOT NULL,
	"details" text
);
--> statement-breakpoint
CREATE TABLE "template_client_associations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_lessons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_module_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"resource_url" text,
	"library_document_id" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_trimester_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_trimesters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "university_certificates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"certificate_type" text NOT NULL,
	"reference_id" varchar NOT NULL,
	"title" text NOT NULL,
	"average_grade" real,
	"pdf_url" text,
	"issued_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "university_grades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" varchar NOT NULL,
	"grade" integer NOT NULL,
	"feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "university_lessons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"resource_url" text,
	"exercise_id" varchar,
	"library_document_id" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "university_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trimester_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "university_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"lesson_id" varchar NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "university_progress_client_id_lesson_id_unique" UNIQUE("client_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "university_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "university_trimesters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "university_year_client_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "university_year_client_assignments_year_id_client_id_unique" UNIQUE("year_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "university_years" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_locked" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"badge_type" text NOT NULL,
	"badge_name" text NOT NULL,
	"badge_description" text,
	"earned_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_badges_user_id_badge_type_unique" UNIQUE("user_id","badge_type")
);
--> statement-breakpoint
CREATE TABLE "user_finance_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"percorso_capitale_email" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_finance_settings_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_api_key_rotation_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" varchar NOT NULL,
	"phone_number" text NOT NULL,
	"conversation_id" varchar,
	"message_id" varchar,
	"used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"user_id" varchar,
	"consultant_id" varchar NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"overridden_at" timestamp,
	"overridden_by" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_message_at" timestamp DEFAULT now(),
	"last_message_from" text,
	"is_lead" boolean DEFAULT false NOT NULL,
	"lead_converted_at" timestamp,
	"message_count" integer DEFAULT 0 NOT NULL,
	"unread_by_consultant" integer DEFAULT 0 NOT NULL,
	"last_reset_at" timestamp,
	"test_mode_override" text,
	"test_mode_user_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_daily_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"date" date NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"inbound_messages" integer DEFAULT 0 NOT NULL,
	"outbound_messages" integer DEFAULT 0 NOT NULL,
	"unique_contacts" integer DEFAULT 0 NOT NULL,
	"new_leads" integer DEFAULT 0 NOT NULL,
	"converted_leads" integer DEFAULT 0 NOT NULL,
	"avg_response_time_seconds" integer,
	"ai_responses" integer DEFAULT 0 NOT NULL,
	"manual_responses" integer DEFAULT 0 NOT NULL,
	"images_received" integer DEFAULT 0 NOT NULL,
	"documents_received" integer DEFAULT 0 NOT NULL,
	"audio_received" integer DEFAULT 0 NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"messages_delivered" integer DEFAULT 0 NOT NULL,
	"messages_read" integer DEFAULT 0 NOT NULL,
	"messages_failed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_followup_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"trigger_after_hours" integer NOT NULL,
	"last_message_at" timestamp NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"reminder_type" text NOT NULL,
	"reminder_message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"failure_reason" text,
	"received_reply" boolean DEFAULT false NOT NULL,
	"replied_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_global_api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"api_key" text NOT NULL,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "whatsapp_global_api_keys_consultant_id_api_key_unique" UNIQUE("consultant_id","api_key")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_media_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"original_url" text NOT NULL,
	"local_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"downloaded" boolean DEFAULT false NOT NULL,
	"downloaded_at" timestamp,
	"ai_processed" boolean DEFAULT false NOT NULL,
	"ai_analysis" text,
	"extracted_text" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"message_text" text NOT NULL,
	"direction" text NOT NULL,
	"sender" text NOT NULL,
	"media_type" text DEFAULT 'text',
	"media_url" text,
	"media_content_type" text,
	"media_size" integer,
	"local_media_path" text,
	"is_batched" boolean DEFAULT false NOT NULL,
	"batch_id" varchar,
	"twilio_sid" text,
	"twilio_status" text,
	"twilio_error_code" text,
	"twilio_error_message" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"failed_at" timestamp,
	"api_key_used" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	CONSTRAINT "whatsapp_messages_twilio_sid_unique" UNIQUE("twilio_sid")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_pending_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"phone_number" text NOT NULL,
	"message_text" text NOT NULL,
	"media_type" text,
	"media_url" text,
	"media_content_type" text,
	"twilio_sid" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"batch_id" varchar
);
--> statement-breakpoint
ALTER TABLE "exercise_assignments" DROP CONSTRAINT "exercise_assignments_exercise_id_exercises_id_fk";
--> statement-breakpoint
ALTER TABLE "exercise_submissions" DROP CONSTRAINT "exercise_submissions_assignment_id_exercise_assignments_id_fk";
--> statement-breakpoint
ALTER TABLE "exercise_submissions" ALTER COLUMN "submitted_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "google_meet_link" text;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "fathom_share_link" text;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "transcript" text;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "summary_email" text;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "summary_email_generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "google_calendar_event_id" text;--> statement-breakpoint
ALTER TABLE "exercise_assignments" ADD COLUMN "whatsapp_sent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "exercise_assignments" ADD COLUMN "work_platform" text;--> statement-breakpoint
ALTER TABLE "exercise_assignments" ADD COLUMN "auto_graded_score" integer;--> statement-breakpoint
ALTER TABLE "exercise_assignments" ADD COLUMN "question_grades" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "exercise_assignments" ADD COLUMN "exam_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "exercise_assignments" ADD COLUMN "exam_submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "exercise_templates" ADD COLUMN "time_limit" integer;--> statement-breakpoint
ALTER TABLE "exercise_templates" ADD COLUMN "work_platform" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "library_document_id" varchar;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "is_exam" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "exam_date" timestamp;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "year_id" varchar;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "trimester_id" varchar;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "auto_correct" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "total_points" integer;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "passing_score" integer;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "exam_time_limit" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "enrolled_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "level" text DEFAULT 'studente';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gemini_api_keys" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gemini_api_key_index" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_user_preferences" ADD CONSTRAINT "ai_user_preferences_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_bookings" ADD CONSTRAINT "appointment_bookings_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_bookings" ADD CONSTRAINT "appointment_bookings_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_bookings" ADD CONSTRAINT "appointment_bookings_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automated_emails_log" ADD CONSTRAINT "automated_emails_log_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automated_emails_log" ADD CONSTRAINT "automated_emails_log_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_email_automation" ADD CONSTRAINT "client_email_automation_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_email_automation" ADD CONSTRAINT "client_email_automation_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_email_journey_progress" ADD CONSTRAINT "client_email_journey_progress_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_email_journey_progress" ADD CONSTRAINT "client_email_journey_progress_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_email_journey_progress" ADD CONSTRAINT "client_email_journey_progress_last_template_used_id_email_journey_templates_id_fk" FOREIGN KEY ("last_template_used_id") REFERENCES "public"."email_journey_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_library_progress" ADD CONSTRAINT "client_library_progress_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_library_progress" ADD CONSTRAINT "client_library_progress_document_id_library_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."library_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_objection_profile" ADD CONSTRAINT "client_objection_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_roadmap_progress" ADD CONSTRAINT "client_roadmap_progress_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_roadmap_progress" ADD CONSTRAINT "client_roadmap_progress_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_roadmap_progress" ADD CONSTRAINT "client_roadmap_progress_item_id_roadmap_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."roadmap_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_state_tracking" ADD CONSTRAINT "client_state_tracking_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_state_tracking" ADD CONSTRAINT "client_state_tracking_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_availability_settings" ADD CONSTRAINT "consultant_availability_settings_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_calendar_sync" ADD CONSTRAINT "consultant_calendar_sync_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_smtp_settings" ADD CONSTRAINT "consultant_smtp_settings_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD CONSTRAINT "consultant_whatsapp_config_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_tasks" ADD CONSTRAINT "consultation_tasks_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_tasks" ADD CONSTRAINT "consultation_tasks_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reflections" ADD CONSTRAINT "daily_reflections_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reflections" ADD CONSTRAINT "daily_reflections_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_journey_template_id_email_journey_templates_id_fk" FOREIGN KEY ("journey_template_id") REFERENCES "public"."email_journey_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_category_client_assignments" ADD CONSTRAINT "library_category_client_assignments_category_id_library_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."library_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_category_client_assignments" ADD CONSTRAINT "library_category_client_assignments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_category_client_assignments" ADD CONSTRAINT "library_category_client_assignments_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_document_sections" ADD CONSTRAINT "library_document_sections_document_id_library_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."library_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_category_id_library_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."library_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_subcategory_id_library_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."library_subcategories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_subcategories" ADD CONSTRAINT "library_subcategories_category_id_library_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."library_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_subcategories" ADD CONSTRAINT "library_subcategories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "momentum_checkins" ADD CONSTRAINT "momentum_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "momentum_goals" ADD CONSTRAINT "momentum_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "momentum_settings" ADD CONSTRAINT "momentum_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objection_tracking" ADD CONSTRAINT "objection_tracking_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objection_tracking" ADD CONSTRAINT "objection_tracking_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_appointment_slots" ADD CONSTRAINT "proposed_appointment_slots_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_appointment_slots" ADD CONSTRAINT "proposed_appointment_slots_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_groups" ADD CONSTRAINT "roadmap_groups_phase_id_roadmap_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."roadmap_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_group_id_roadmap_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."roadmap_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler_execution_log" ADD CONSTRAINT "scheduler_execution_log_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_client_associations" ADD CONSTRAINT "template_client_associations_template_id_exercise_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."exercise_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_client_associations" ADD CONSTRAINT "template_client_associations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_client_associations" ADD CONSTRAINT "template_client_associations_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_lessons" ADD CONSTRAINT "template_lessons_template_module_id_template_modules_id_fk" FOREIGN KEY ("template_module_id") REFERENCES "public"."template_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_lessons" ADD CONSTRAINT "template_lessons_library_document_id_library_documents_id_fk" FOREIGN KEY ("library_document_id") REFERENCES "public"."library_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_modules" ADD CONSTRAINT "template_modules_template_trimester_id_template_trimesters_id_fk" FOREIGN KEY ("template_trimester_id") REFERENCES "public"."template_trimesters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_trimesters" ADD CONSTRAINT "template_trimesters_template_id_university_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."university_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_certificates" ADD CONSTRAINT "university_certificates_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_certificates" ADD CONSTRAINT "university_certificates_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_grades" ADD CONSTRAINT "university_grades_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_grades" ADD CONSTRAINT "university_grades_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_lessons" ADD CONSTRAINT "university_lessons_module_id_university_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."university_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_lessons" ADD CONSTRAINT "university_lessons_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_lessons" ADD CONSTRAINT "university_lessons_library_document_id_library_documents_id_fk" FOREIGN KEY ("library_document_id") REFERENCES "public"."library_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_modules" ADD CONSTRAINT "university_modules_trimester_id_university_trimesters_id_fk" FOREIGN KEY ("trimester_id") REFERENCES "public"."university_trimesters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_progress" ADD CONSTRAINT "university_progress_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_progress" ADD CONSTRAINT "university_progress_lesson_id_university_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."university_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_templates" ADD CONSTRAINT "university_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_trimesters" ADD CONSTRAINT "university_trimesters_year_id_university_years_id_fk" FOREIGN KEY ("year_id") REFERENCES "public"."university_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_year_client_assignments" ADD CONSTRAINT "university_year_client_assignments_year_id_university_years_id_fk" FOREIGN KEY ("year_id") REFERENCES "public"."university_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_year_client_assignments" ADD CONSTRAINT "university_year_client_assignments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_year_client_assignments" ADD CONSTRAINT "university_year_client_assignments_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_years" ADD CONSTRAINT "university_years_template_id_university_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."university_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_years" ADD CONSTRAINT "university_years_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_finance_settings" ADD CONSTRAINT "user_finance_settings_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_api_key_rotation_log" ADD CONSTRAINT "whatsapp_api_key_rotation_log_api_key_id_whatsapp_global_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."whatsapp_global_api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_test_mode_user_id_users_id_fk" FOREIGN KEY ("test_mode_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_daily_stats" ADD CONSTRAINT "whatsapp_daily_stats_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_followup_reminders" ADD CONSTRAINT "whatsapp_followup_reminders_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_followup_reminders" ADD CONSTRAINT "whatsapp_followup_reminders_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_global_api_keys" ADD CONSTRAINT "whatsapp_global_api_keys_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_media_files" ADD CONSTRAINT "whatsapp_media_files_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_api_key_used_whatsapp_global_api_keys_id_fk" FOREIGN KEY ("api_key_used") REFERENCES "public"."whatsapp_global_api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_pending_messages" ADD CONSTRAINT "whatsapp_pending_messages_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_assignments" ADD CONSTRAINT "exercise_assignments_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_assignment_id_exercise_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."exercise_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_library_document_id_library_documents_id_fk" FOREIGN KEY ("library_document_id") REFERENCES "public"."library_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_year_id_university_years_id_fk" FOREIGN KEY ("year_id") REFERENCES "public"."university_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_trimester_id_university_trimesters_id_fk" FOREIGN KEY ("trimester_id") REFERENCES "public"."university_trimesters"("id") ON DELETE no action ON UPDATE no action;