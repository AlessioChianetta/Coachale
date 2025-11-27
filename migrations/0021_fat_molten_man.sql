CREATE TABLE "agent_script_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"script_id" varchar NOT NULL,
	"script_type" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" varchar
);
--> statement-breakpoint
CREATE TABLE "sales_script_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"script_id" varchar NOT NULL,
	"version" text NOT NULL,
	"content" text NOT NULL,
	"structure" jsonb,
	"created_by" varchar NOT NULL,
	"change_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_scripts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"script_type" text NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"content" text NOT NULL,
	"structure" jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_draft" boolean DEFAULT true NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"usage_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"energy_settings" jsonb DEFAULT '{}'::jsonb,
	"ladder_overrides" jsonb DEFAULT '{}'::jsonb,
	"step_questions" jsonb DEFAULT '{}'::jsonb,
	"step_biscottini" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_analysis_history" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"analyzed_files" jsonb DEFAULT '[]'::jsonb,
	"improvements" jsonb DEFAULT '[]'::jsonb,
	"conversations_analyzed" integer DEFAULT 0 NOT NULL,
	"total_improvements" integer DEFAULT 0 NOT NULL,
	"critical_improvements" integer DEFAULT 0 NOT NULL,
	"high_improvements" integer DEFAULT 0 NOT NULL,
	"analyzed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_sales_conversations" ADD COLUMN "used_script_id" varchar;--> statement-breakpoint
ALTER TABLE "client_sales_conversations" ADD COLUMN "used_script_name" text;--> statement-breakpoint
ALTER TABLE "client_sales_conversations" ADD COLUMN "used_script_type" text;--> statement-breakpoint
ALTER TABLE "client_sales_conversations" ADD COLUMN "used_script_source" text;--> statement-breakpoint
ALTER TABLE "client_sales_conversations" ADD COLUMN "pending_feedback" text;--> statement-breakpoint
ALTER TABLE "client_sales_conversations" ADD COLUMN "pending_feedback_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "sales_agent_training_summary" ADD COLUMN "total_contextual_responses" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sales_agent_training_summary" ADD COLUMN "avg_contextual_responses_per_conversation" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD COLUMN "phase_activations" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD COLUMN "contextual_responses" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD COLUMN "objections_encountered" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD COLUMN "used_script_id" varchar;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD COLUMN "used_script_name" text;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD COLUMN "used_script_type" text;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD COLUMN "ai_analysis_result" jsonb;--> statement-breakpoint
ALTER TABLE "agent_script_assignments" ADD CONSTRAINT "agent_script_assignments_agent_id_client_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."client_sales_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_script_assignments" ADD CONSTRAINT "agent_script_assignments_script_id_sales_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."sales_scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_script_assignments" ADD CONSTRAINT "agent_script_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_script_versions" ADD CONSTRAINT "sales_script_versions_script_id_sales_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."sales_scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_script_versions" ADD CONSTRAINT "sales_script_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_scripts" ADD CONSTRAINT "sales_scripts_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_scripts" ADD CONSTRAINT "sales_scripts_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_analysis_history" ADD CONSTRAINT "training_analysis_history_agent_id_client_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."client_sales_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_analysis_history" ADD CONSTRAINT "training_analysis_history_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_script_type_unique_idx" ON "agent_script_assignments" USING btree ("agent_id","script_type");--> statement-breakpoint
CREATE INDEX "sales_scripts_client_type_idx" ON "sales_scripts" USING btree ("client_id","script_type");--> statement-breakpoint
CREATE INDEX "sales_scripts_active_type_idx" ON "sales_scripts" USING btree ("is_active","script_type");