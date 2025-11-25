ALTER TABLE "ai_conversations" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD COLUMN "sales_conversation_id" varchar;--> statement-breakpoint
ALTER TABLE "consultation_invites" ADD COLUMN "scheduled_date" text;--> statement-breakpoint
ALTER TABLE "consultation_invites" ADD COLUMN "start_time" text;--> statement-breakpoint
ALTER TABLE "consultation_invites" ADD COLUMN "end_time" text;--> statement-breakpoint
ALTER TABLE "gemini_session_handles" ADD COLUMN "invite_token" text;