CREATE TABLE "ai_training_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"script_id" varchar NOT NULL,
	"script_name" text,
	"persona_id" text NOT NULL,
	"prospect_name" text NOT NULL,
	"prospect_email" text,
	"status" text DEFAULT 'running' NOT NULL,
	"conversation_id" varchar,
	"current_phase" text DEFAULT 'starting',
	"completion_rate" real DEFAULT 0,
	"ladder_activations" integer DEFAULT 0,
	"message_count" integer DEFAULT 0,
	"last_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"result_score" real,
	"result_notes" text
);
--> statement-breakpoint
ALTER TABLE "sales_scripts" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_training_sessions" ADD CONSTRAINT "ai_training_sessions_agent_id_client_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."client_sales_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_training_sessions" ADD CONSTRAINT "ai_training_sessions_script_id_sales_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."sales_scripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_training_sessions_agent_idx" ON "ai_training_sessions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "ai_training_sessions_status_idx" ON "ai_training_sessions" USING btree ("status");