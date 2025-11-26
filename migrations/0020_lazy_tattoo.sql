CREATE TABLE "sales_agent_training_summary" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"total_conversations" integer DEFAULT 0 NOT NULL,
	"avg_conversion_rate" real DEFAULT 0,
	"phase_completion_rates" jsonb DEFAULT '{}'::jsonb,
	"common_fail_points" jsonb DEFAULT '[]'::jsonb,
	"checkpoint_completion_rates" jsonb DEFAULT '{}'::jsonb,
	"avg_conversation_duration" integer DEFAULT 0,
	"ladder_activation_rate" real DEFAULT 0,
	"avg_ladder_depth" real DEFAULT 0,
	"best_performing_phases" jsonb DEFAULT '[]'::jsonb,
	"worst_performing_phases" jsonb DEFAULT '[]'::jsonb,
	"last_structure_check" timestamp,
	"structure_mismatch" boolean DEFAULT false,
	"script_version" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sales_agent_training_summary_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "sales_conversation_training" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"current_phase" text NOT NULL,
	"phases_reached" jsonb DEFAULT '[]'::jsonb,
	"checkpoints_completed" jsonb DEFAULT '[]'::jsonb,
	"semantic_types" jsonb DEFAULT '[]'::jsonb,
	"ai_reasoning" jsonb DEFAULT '[]'::jsonb,
	"full_transcript" jsonb DEFAULT '[]'::jsonb,
	"ladder_activations" jsonb DEFAULT '[]'::jsonb,
	"questions_asked" jsonb DEFAULT '[]'::jsonb,
	"drop_off_point" text,
	"drop_off_reason" text,
	"completion_rate" real DEFAULT 0,
	"total_duration" integer DEFAULT 0,
	"script_snapshot" jsonb,
	"script_version" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sales_conversation_training_conversation_id_unique" UNIQUE("conversation_id")
);
--> statement-breakpoint
CREATE TABLE "vertex_ai_usage_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"session_id" text,
	"call_type" text NOT NULL,
	"model_name" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"candidates_tokens" integer DEFAULT 0 NOT NULL,
	"cached_content_token_count" integer DEFAULT 0 NOT NULL,
	"audio_input_seconds" real DEFAULT 0,
	"audio_output_seconds" real DEFAULT 0,
	"text_input_cost" real DEFAULT 0 NOT NULL,
	"audio_input_cost" real DEFAULT 0 NOT NULL,
	"audio_output_cost" real DEFAULT 0 NOT NULL,
	"cached_input_cost" real DEFAULT 0 NOT NULL,
	"total_cost" real DEFAULT 0 NOT NULL,
	"request_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_agent_training_summary" ADD CONSTRAINT "sales_agent_training_summary_agent_id_client_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."client_sales_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD CONSTRAINT "sales_conversation_training_conversation_id_client_sales_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."client_sales_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_conversation_training" ADD CONSTRAINT "sales_conversation_training_agent_id_client_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."client_sales_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vertex_ai_usage_tracking" ADD CONSTRAINT "vertex_ai_usage_tracking_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consultant_session_idx" ON "vertex_ai_usage_tracking" USING btree ("consultant_id","session_id");--> statement-breakpoint
CREATE INDEX "call_type_idx" ON "vertex_ai_usage_tracking" USING btree ("call_type");--> statement-breakpoint
CREATE INDEX "created_at_idx" ON "vertex_ai_usage_tracking" USING btree ("created_at");