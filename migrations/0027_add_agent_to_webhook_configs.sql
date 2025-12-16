CREATE TABLE "admin_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" varchar NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_turn_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'metered' NOT NULL,
	"username_encrypted" text,
	"password_encrypted" text,
	"api_key_encrypted" text,
	"turn_urls" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultant_ai_ideas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"target_audience" text,
	"agent_type" text DEFAULT 'whatsapp' NOT NULL,
	"integration_types" jsonb DEFAULT '[]'::jsonb,
	"source_type" text DEFAULT 'generated' NOT NULL,
	"suggested_agent_type" text DEFAULT 'reactive_lead',
	"personality" text,
	"who_we_help" text,
	"who_we_dont_help" text,
	"what_we_do" text,
	"how_we_do_it" text,
	"usp" text,
	"suggested_instructions" text,
	"use_cases" jsonb DEFAULT '[]'::jsonb,
	"vision" text,
	"mission" text,
	"business_name" text,
	"consultant_display_name" text,
	"is_implemented" boolean DEFAULT false,
	"implemented_agent_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultant_onboarding_status" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"vertex_ai_status" text DEFAULT 'pending' NOT NULL,
	"vertex_ai_tested_at" timestamp,
	"vertex_ai_error_message" text,
	"smtp_status" text DEFAULT 'pending' NOT NULL,
	"smtp_tested_at" timestamp,
	"smtp_error_message" text,
	"google_calendar_status" text DEFAULT 'pending' NOT NULL,
	"google_calendar_tested_at" timestamp,
	"google_calendar_error_message" text,
	"video_meeting_status" text DEFAULT 'pending' NOT NULL,
	"video_meeting_tested_at" timestamp,
	"video_meeting_error_message" text,
	"lead_import_status" text DEFAULT 'pending' NOT NULL,
	"lead_import_tested_at" timestamp,
	"lead_import_error_message" text,
	"whatsapp_ai_status" text DEFAULT 'pending' NOT NULL,
	"whatsapp_ai_tested_at" timestamp,
	"whatsapp_ai_error_message" text,
	"knowledge_base_status" text DEFAULT 'pending' NOT NULL,
	"knowledge_base_documents_count" integer DEFAULT 0,
	"has_inbound_agent" boolean DEFAULT false NOT NULL,
	"has_outbound_agent" boolean DEFAULT false NOT NULL,
	"has_consultative_agent" boolean DEFAULT false NOT NULL,
	"has_public_agent_link" boolean DEFAULT false NOT NULL,
	"public_links_count" integer DEFAULT 0,
	"has_generated_ideas" boolean DEFAULT false NOT NULL,
	"generated_ideas_count" integer DEFAULT 0,
	"has_created_course" boolean DEFAULT false NOT NULL,
	"courses_count" integer DEFAULT 0,
	"has_created_exercise" boolean DEFAULT false NOT NULL,
	"exercises_count" integer DEFAULT 0,
	"has_first_summary_email" boolean DEFAULT false NOT NULL,
	"summary_emails_count" integer DEFAULT 0,
	"client_ai_strategy" text DEFAULT 'undecided' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_completed_at" timestamp,
	"last_updated_step" text,
	"interactive_intro_completed" boolean DEFAULT false NOT NULL,
	"interactive_intro_completed_at" timestamp,
	"interactive_intro_responses" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "consultant_onboarding_status_consultant_id_unique" UNIQUE("consultant_id")
);
--> statement-breakpoint
CREATE TABLE "consultant_vertex_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"has_access" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "consultant_vertex_access_consultant_id_unique" UNIQUE("consultant_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"current_state" text DEFAULT 'new_contact' NOT NULL,
	"previous_state" text,
	"has_asked_price" boolean DEFAULT false NOT NULL,
	"has_mentioned_urgency" boolean DEFAULT false NOT NULL,
	"has_said_no_explicitly" boolean DEFAULT false NOT NULL,
	"discovery_completed" boolean DEFAULT false NOT NULL,
	"demo_presented" boolean DEFAULT false NOT NULL,
	"followup_count" integer DEFAULT 0 NOT NULL,
	"max_followups_allowed" integer DEFAULT 5 NOT NULL,
	"last_followup_at" timestamp,
	"next_followup_scheduled_at" timestamp,
	"engagement_score" integer DEFAULT 50 NOT NULL,
	"conversion_probability" real DEFAULT 0.5,
	"last_ai_evaluation_at" timestamp,
	"ai_recommendation" text,
	"temperature_level" text DEFAULT 'warm',
	"state_changed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "conversation_states_conversation_id_unique" UNIQUE("conversation_id")
);
--> statement-breakpoint
CREATE TABLE "followup_ai_evaluation_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"conversation_context" jsonb NOT NULL,
	"decision" text NOT NULL,
	"urgency" text,
	"selected_template_id" varchar,
	"reasoning" text NOT NULL,
	"confidence_score" real NOT NULL,
	"matched_rule_id" varchar,
	"matched_rule_reason" text,
	"was_executed" boolean DEFAULT false NOT NULL,
	"lead_replied" boolean,
	"replied_within_hours" integer,
	"outcome_positive" boolean,
	"model_used" text DEFAULT 'gemini-2.5-flash' NOT NULL,
	"tokens_used" integer,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "followup_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"agent_id" varchar,
	"template_id" varchar,
	"rule_id" varchar,
	"date" timestamp NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"messages_delivered" integer DEFAULT 0 NOT NULL,
	"messages_read" integer DEFAULT 0 NOT NULL,
	"replies_received" integer DEFAULT 0 NOT NULL,
	"conversions_achieved" integer DEFAULT 0 NOT NULL,
	"delivery_rate" real,
	"read_rate" real,
	"response_rate" real,
	"conversion_rate" real,
	"ai_decisions_made" integer DEFAULT 0 NOT NULL,
	"ai_decisions_accepted" integer DEFAULT 0 NOT NULL,
	"avg_confidence_score" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "followup_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"agent_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" text DEFAULT 'time_based' NOT NULL,
	"trigger_condition" jsonb NOT NULL,
	"template_id" varchar,
	"fallback_message" text,
	"applicable_to_states" jsonb DEFAULT '[]'::jsonb,
	"applicable_to_agent_types" jsonb DEFAULT '[]'::jsonb,
	"applicable_to_channels" jsonb DEFAULT '[]'::jsonb,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"cooldown_hours" integer DEFAULT 24 NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proactive_lead_activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"agent_config_id" varchar,
	"event_type" text NOT NULL,
	"event_message" text NOT NULL,
	"event_details" jsonb DEFAULT '{}'::jsonb,
	"lead_status_at_event" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduled_followup_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"rule_id" varchar,
	"template_id" varchar,
	"scheduled_for" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"template_variables" jsonb DEFAULT '{}'::jsonb,
	"fallback_message" text,
	"ai_decision_reasoning" text,
	"ai_confidence_score" real,
	"sent_at" timestamp,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_attempt_at" timestamp,
	"next_retry_at" timestamp,
	"last_error_code" text,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "superadmin_vertex_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"location" text DEFAULT 'us-central1' NOT NULL,
	"service_account_json" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"category" text NOT NULL,
	"description" text,
	"is_encrypted" boolean DEFAULT false,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_role_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text NOT NULL,
	"consultant_id" varchar,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_role_profiles_user_id_role_consultant_id_unique" UNIQUE("user_id","role","consultant_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"provider_name" text NOT NULL,
	"display_name" text NOT NULL,
	"config_name" text,
	"secret_key" text NOT NULL,
	"agent_config_id" varchar,
	"target_campaign_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_webhook_at" timestamp,
	"total_leads_received" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "webhook_configs_secret_key_unique" UNIQUE("secret_key")
);
--> statement-breakpoint
ALTER TABLE "whatsapp_custom_templates" DROP CONSTRAINT "whatsapp_custom_templates_consultant_id_template_type_unique";--> statement-breakpoint
ALTER TABLE "whatsapp_template_assignments" DROP CONSTRAINT "whatsapp_template_assignments_agent_config_id_template_type_unique";--> statement-breakpoint
ALTER TABLE "whatsapp_template_assignments" DROP CONSTRAINT "whatsapp_template_assignments_template_id_whatsapp_custom_templates_id_fk";
--> statement-breakpoint
ALTER TABLE "whatsapp_custom_templates" ALTER COLUMN "template_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_template_assignments" ALTER COLUMN "template_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_knowledge_documents" ADD COLUMN "structured_data" jsonb;--> statement-breakpoint
ALTER TABLE "client_knowledge_documents" ADD COLUMN "google_drive_file_id" text;--> statement-breakpoint
ALTER TABLE "client_knowledge_documents" ADD COLUMN "source_consultant_doc_id" varchar;--> statement-breakpoint
ALTER TABLE "consultant_availability_settings" ADD COLUMN "google_drive_refresh_token" text;--> statement-breakpoint
ALTER TABLE "consultant_availability_settings" ADD COLUMN "google_drive_access_token" text;--> statement-breakpoint
ALTER TABLE "consultant_availability_settings" ADD COLUMN "google_drive_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "consultant_availability_settings" ADD COLUMN "google_drive_connected_at" timestamp;--> statement-breakpoint
ALTER TABLE "consultant_availability_settings" ADD COLUMN "google_drive_email" text;--> statement-breakpoint
ALTER TABLE "consultant_knowledge_documents" ADD COLUMN "google_drive_file_id" text;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "is_proactive_agent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_drive_refresh_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_drive_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_drive_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_drive_connected_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_drive_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twilio_account_sid" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twilio_auth_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twilio_whatsapp_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "use_superadmin_vertex" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "whatsapp_custom_templates" ADD COLUMN "use_case" text;--> statement-breakpoint
ALTER TABLE "whatsapp_custom_templates" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "whatsapp_custom_templates" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_template_assignments" ADD COLUMN "priority" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "whatsapp_template_assignments" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_ai_ideas" ADD CONSTRAINT "consultant_ai_ideas_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_onboarding_status" ADD CONSTRAINT "consultant_onboarding_status_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_vertex_access" ADD CONSTRAINT "consultant_vertex_access_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_states" ADD CONSTRAINT "conversation_states_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_ai_evaluation_log" ADD CONSTRAINT "followup_ai_evaluation_log_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_analytics" ADD CONSTRAINT "followup_analytics_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_analytics" ADD CONSTRAINT "followup_analytics_agent_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_analytics" ADD CONSTRAINT "followup_analytics_template_id_whatsapp_custom_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_custom_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_analytics" ADD CONSTRAINT "followup_analytics_rule_id_followup_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."followup_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_rules" ADD CONSTRAINT "followup_rules_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_rules" ADD CONSTRAINT "followup_rules_agent_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_rules" ADD CONSTRAINT "followup_rules_template_id_whatsapp_custom_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_custom_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proactive_lead_activity_logs" ADD CONSTRAINT "proactive_lead_activity_logs_lead_id_proactive_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."proactive_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proactive_lead_activity_logs" ADD CONSTRAINT "proactive_lead_activity_logs_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proactive_lead_activity_logs" ADD CONSTRAINT "proactive_lead_activity_logs_agent_config_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_followup_messages" ADD CONSTRAINT "scheduled_followup_messages_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_followup_messages" ADD CONSTRAINT "scheduled_followup_messages_rule_id_followup_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."followup_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_followup_messages" ADD CONSTRAINT "scheduled_followup_messages_template_id_whatsapp_custom_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_custom_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_profiles" ADD CONSTRAINT "user_role_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_profiles" ADD CONSTRAINT "user_role_profiles_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_agent_config_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_target_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("target_campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_knowledge_documents" ADD CONSTRAINT "client_knowledge_documents_source_consultant_doc_id_consultant_knowledge_documents_id_fk" FOREIGN KEY ("source_consultant_doc_id") REFERENCES "public"."consultant_knowledge_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_knowledge_doc_google_drive_idx" ON "client_knowledge_documents" USING btree ("google_drive_file_id");--> statement-breakpoint
CREATE INDEX "client_knowledge_doc_source_consultant_idx" ON "client_knowledge_documents" USING btree ("source_consultant_doc_id");--> statement-breakpoint
CREATE INDEX "knowledge_doc_google_drive_idx" ON "consultant_knowledge_documents" USING btree ("google_drive_file_id");