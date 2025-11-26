CREATE TABLE "custom_live_prompts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"prompt_text" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_agent_share_visitor_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" varchar NOT NULL,
	"visitor_id" text NOT NULL,
	"password_validated_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"referrer" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "whatsapp_agent_share_visitor_sessions_share_id_visitor_id_unique" UNIQUE("share_id","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ALTER COLUMN "twilio_account_sid" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ALTER COLUMN "twilio_auth_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ALTER COLUMN "twilio_whatsapp_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "message_type" varchar(20) DEFAULT 'text';--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "audio_url" text;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "ai_audio_url" text;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "voice_used" varchar(50);--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "integration_mode" text DEFAULT 'whatsapp_ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "tts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "audio_response_mode" text DEFAULT 'always_text' NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_consultant_messages" ADD COLUMN "transcription" text;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_consultant_messages" ADD COLUMN "audio_url" text;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_consultant_messages" ADD COLUMN "audio_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_shares" ADD COLUMN "agent_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_live_prompts" ADD CONSTRAINT "custom_live_prompts_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_share_visitor_sessions" ADD CONSTRAINT "whatsapp_agent_share_visitor_sessions_share_id_whatsapp_agent_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."whatsapp_agent_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_consultant_conversations" ADD CONSTRAINT "whatsapp_agent_consultant_conversations_share_id_whatsapp_agent_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."whatsapp_agent_shares"("id") ON DELETE set null ON UPDATE no action;