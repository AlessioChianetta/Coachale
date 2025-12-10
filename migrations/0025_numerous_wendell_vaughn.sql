CREATE TABLE "consultant_turn_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"provider" text DEFAULT 'metered' NOT NULL,
	"username_encrypted" text,
	"password_encrypted" text,
	"api_key_encrypted" text,
	"turn_urls" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "consultant_turn_config_consultant_id_unique" UNIQUE("consultant_id")
);
--> statement-breakpoint
CREATE TABLE "human_seller_coaching_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"seller_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"prospect_archetype" text,
	"timestamp_ms" bigint,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "human_seller_meeting_training" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"seller_id" varchar NOT NULL,
	"current_phase" text,
	"current_phase_index" integer DEFAULT 0,
	"phases_reached" jsonb DEFAULT '[]'::jsonb,
	"checkpoints_completed" jsonb DEFAULT '[]'::jsonb,
	"validated_checkpoint_items" jsonb DEFAULT '{}'::jsonb,
	"conversation_messages" jsonb DEFAULT '[]'::jsonb,
	"archetype_state" jsonb,
	"full_transcript" jsonb DEFAULT '[]'::jsonb,
	"script_snapshot" jsonb,
	"script_version" text,
	"coaching_metrics" jsonb,
	"completion_rate" real DEFAULT 0,
	"total_duration" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "human_seller_meeting_training_meeting_id_unique" UNIQUE("meeting_id")
);
--> statement-breakpoint
CREATE TABLE "human_seller_performance_summary" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"period" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_meetings" integer DEFAULT 0,
	"completed_meetings" integer DEFAULT 0,
	"total_duration_minutes" integer DEFAULT 0,
	"avg_duration_minutes" integer DEFAULT 0,
	"total_buy_signals" integer DEFAULT 0,
	"avg_buy_signals_per_meeting" real DEFAULT 0,
	"total_objections" integer DEFAULT 0,
	"objection_handling_rate" real DEFAULT 0,
	"avg_script_adherence" real DEFAULT 0,
	"avg_checkpoint_completion" real DEFAULT 0,
	"won_deals" integer DEFAULT 0,
	"lost_deals" integer DEFAULT 0,
	"follow_ups" integer DEFAULT 0,
	"conversion_rate" real DEFAULT 0,
	"archetype_breakdown" jsonb,
	"tone_warnings_total" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "human_seller_script_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" varchar NOT NULL,
	"script_id" varchar NOT NULL,
	"script_type" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" varchar
);
--> statement-breakpoint
CREATE TABLE "human_seller_session_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"seller_id" varchar NOT NULL,
	"duration_seconds" integer,
	"total_buy_signals" integer DEFAULT 0,
	"total_objections" integer DEFAULT 0,
	"objections_handled" integer DEFAULT 0,
	"checkpoints_completed" integer DEFAULT 0,
	"total_checkpoints" integer DEFAULT 0,
	"phases_completed" integer DEFAULT 0,
	"total_phases" integer DEFAULT 0,
	"script_adherence_score" real,
	"tone_warnings_count" integer DEFAULT 0,
	"prospect_archetype" text,
	"outcome" text,
	"outcome_notes" text,
	"ai_analysis_summary" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "human_seller_session_metrics_meeting_id_unique" UNIQUE("meeting_id")
);
--> statement-breakpoint
CREATE TABLE "human_sellers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar,
	"seller_name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"owner_email" text,
	"is_active" boolean DEFAULT true,
	"business_name" text,
	"business_description" text,
	"consultant_bio" text,
	"vision" text,
	"mission" text,
	"values" jsonb DEFAULT '[]'::jsonb,
	"usp" text,
	"target_client" text,
	"non_target_client" text,
	"what_we_do" text,
	"how_we_do_it" text,
	"years_experience" integer DEFAULT 0,
	"clients_helped" integer DEFAULT 0,
	"results_generated" text,
	"guarantees" text,
	"services_offered" jsonb DEFAULT '[]'::jsonb,
	"voice_name" varchar(50) DEFAULT 'achernar',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "video_meeting_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"duration_seconds" integer,
	"talk_ratio" real,
	"script_adherence" real,
	"avg_sentiment_score" real,
	"objections_count" integer,
	"objections_handled" integer,
	"ai_summary" text,
	"action_items" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "video_meeting_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "video_meeting_transcripts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"speaker_id" varchar,
	"speaker_name" text,
	"text" text NOT NULL,
	"timestamp_ms" bigint,
	"sentiment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "video_meetings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" varchar NOT NULL,
	"meeting_token" varchar NOT NULL,
	"playbook_id" varchar,
	"prospect_name" text NOT NULL,
	"prospect_email" text,
	"owner_email" text,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"status" text DEFAULT 'scheduled',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "video_meetings_meeting_token_unique" UNIQUE("meeting_token")
);
--> statement-breakpoint
ALTER TABLE "appointment_bookings" ALTER COLUMN "client_phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_sales_agents" ALTER COLUMN "voice_name" SET DEFAULT 'Puck';--> statement-breakpoint
ALTER TABLE "ai_training_sessions" ADD COLUMN "demo_script_id" varchar;--> statement-breakpoint
ALTER TABLE "ai_training_sessions" ADD COLUMN "test_mode" text DEFAULT 'discovery';--> statement-breakpoint
ALTER TABLE "appointment_bookings" ADD COLUMN "public_conversation_id" varchar;--> statement-breakpoint
ALTER TABLE "appointment_bookings" ADD COLUMN "source" text DEFAULT 'whatsapp' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD COLUMN "manager_analysis_history" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD COLUMN "validated_checkpoint_items" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_client_id" text;--> statement-breakpoint
ALTER TABLE "consultant_turn_config" ADD CONSTRAINT "consultant_turn_config_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_coaching_events" ADD CONSTRAINT "human_seller_coaching_events_meeting_id_video_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."video_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_coaching_events" ADD CONSTRAINT "human_seller_coaching_events_seller_id_human_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."human_sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_meeting_training" ADD CONSTRAINT "human_seller_meeting_training_meeting_id_video_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."video_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_meeting_training" ADD CONSTRAINT "human_seller_meeting_training_seller_id_human_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."human_sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_performance_summary" ADD CONSTRAINT "human_seller_performance_summary_seller_id_human_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."human_sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_performance_summary" ADD CONSTRAINT "human_seller_performance_summary_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_script_assignments" ADD CONSTRAINT "human_seller_script_assignments_seller_id_human_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."human_sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_script_assignments" ADD CONSTRAINT "human_seller_script_assignments_script_id_sales_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."sales_scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_script_assignments" ADD CONSTRAINT "human_seller_script_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_session_metrics" ADD CONSTRAINT "human_seller_session_metrics_meeting_id_video_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."video_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_seller_session_metrics" ADD CONSTRAINT "human_seller_session_metrics_seller_id_human_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."human_sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_sellers" ADD CONSTRAINT "human_sellers_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_sellers" ADD CONSTRAINT "human_sellers_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_meeting_analytics" ADD CONSTRAINT "video_meeting_analytics_meeting_id_video_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."video_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_meeting_participants" ADD CONSTRAINT "video_meeting_participants_meeting_id_video_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."video_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_meeting_transcripts" ADD CONSTRAINT "video_meeting_transcripts_meeting_id_video_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."video_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_meetings" ADD CONSTRAINT "video_meetings_seller_id_human_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."human_sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coaching_events_meeting_idx" ON "human_seller_coaching_events" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "coaching_events_seller_idx" ON "human_seller_coaching_events" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "coaching_events_type_idx" ON "human_seller_coaching_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "performance_summary_seller_idx" ON "human_seller_performance_summary" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "performance_summary_period_idx" ON "human_seller_performance_summary" USING btree ("period","period_start");--> statement-breakpoint
CREATE INDEX "performance_summary_client_idx" ON "human_seller_performance_summary" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "seller_script_type_unique_idx" ON "human_seller_script_assignments" USING btree ("seller_id","script_type");--> statement-breakpoint
CREATE INDEX "session_metrics_seller_idx" ON "human_seller_session_metrics" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "session_metrics_outcome_idx" ON "human_seller_session_metrics" USING btree ("outcome");--> statement-breakpoint
ALTER TABLE "ai_training_sessions" ADD CONSTRAINT "ai_training_sessions_demo_script_id_sales_scripts_id_fk" FOREIGN KEY ("demo_script_id") REFERENCES "public"."sales_scripts"("id") ON DELETE no action ON UPDATE no action;