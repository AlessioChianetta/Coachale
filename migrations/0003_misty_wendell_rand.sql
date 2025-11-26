CREATE TABLE "proactive_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"agent_config_id" varchar NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone_number" text NOT NULL,
	"lead_info" jsonb DEFAULT '{}'::jsonb,
	"ideal_state" text,
	"contact_schedule" timestamp NOT NULL,
	"contact_frequency" integer DEFAULT 7 NOT NULL,
	"last_contacted_at" timestamp,
	"last_message_sent" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "proactive_leads_consultant_id_phone_number_unique" UNIQUE("consultant_id","phone_number")
);
--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" DROP CONSTRAINT "consultant_whatsapp_config_consultant_id_unique";--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "agent_name" text DEFAULT 'Receptionist Principale' NOT NULL;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "agent_type" text DEFAULT 'reactive_lead' NOT NULL;--> statement-breakpoint
ALTER TABLE "proactive_leads" ADD CONSTRAINT "proactive_leads_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proactive_leads" ADD CONSTRAINT "proactive_leads_agent_config_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE cascade ON UPDATE no action;