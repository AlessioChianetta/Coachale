CREATE TABLE "system_errors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"agent_config_id" varchar,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"error_details" jsonb,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_agent_consultant_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"agent_config_id" varchar NOT NULL,
	"title" text,
	"last_message_at" timestamp DEFAULT now(),
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_agent_consultant_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'completed',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "booking_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "objection_handling_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "disqualification_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "upselling_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "template_approval_status" jsonb;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "last_approval_check" timestamp;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "business_header_mode" text DEFAULT 'assistant';--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "professional_role" text;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "custom_business_header" text;--> statement-breakpoint
ALTER TABLE "system_errors" ADD CONSTRAINT "system_errors_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_errors" ADD CONSTRAINT "system_errors_agent_config_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_errors" ADD CONSTRAINT "system_errors_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_consultant_conversations" ADD CONSTRAINT "whatsapp_agent_consultant_conversations_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_consultant_conversations" ADD CONSTRAINT "whatsapp_agent_consultant_conversations_agent_config_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_consultant_messages" ADD CONSTRAINT "whatsapp_agent_consultant_messages_conversation_id_whatsapp_agent_consultant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_agent_consultant_conversations"("id") ON DELETE cascade ON UPDATE no action;