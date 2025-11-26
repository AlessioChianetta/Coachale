CREATE TABLE "ai_weekly_consultations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"recurrence_rule" text DEFAULT 'WEEKLY',
	"status" text DEFAULT 'scheduled' NOT NULL,
	"max_duration_minutes" integer DEFAULT 90,
	"ai_conversation_id" varchar,
	"started_at" timestamp,
	"completed_at" timestamp,
	"actual_duration_minutes" integer,
	"transcript" text,
	"summary" text,
	"is_test_mode" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_weekly_consultations" ADD CONSTRAINT "ai_weekly_consultations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_weekly_consultations" ADD CONSTRAINT "ai_weekly_consultations_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_weekly_consultations" ADD CONSTRAINT "ai_weekly_consultations_ai_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("ai_conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;