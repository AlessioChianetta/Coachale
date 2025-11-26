CREATE TABLE "whatsapp_agent_knowledge_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_config_id" varchar NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"file_path" text,
	"file_name" text,
	"file_size" integer,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_agent_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"agent_config_id" varchar NOT NULL,
	"slug" text NOT NULL,
	"access_type" text DEFAULT 'public' NOT NULL,
	"password_hash" text,
	"allowed_domains" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp,
	"revoke_reason" text,
	"expire_at" timestamp,
	"last_access_at" timestamp,
	"total_access_count" integer DEFAULT 0 NOT NULL,
	"unique_visitors_count" integer DEFAULT 0 NOT NULL,
	"total_messages_count" integer DEFAULT 0 NOT NULL,
	"rate_limit_config" jsonb DEFAULT '{"maxMessagesPerHour": 20, "maxMessagesPerDay": 100}'::jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "whatsapp_agent_shares_slug_unique" UNIQUE("slug"),
	CONSTRAINT "whatsapp_agent_shares_agent_config_id_unique" UNIQUE("agent_config_id")
);
--> statement-breakpoint
ALTER TABLE "whatsapp_agent_consultant_conversations" ADD COLUMN "share_id" varchar;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_consultant_conversations" ADD COLUMN "external_visitor_id" text;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_consultant_conversations" ADD COLUMN "visitor_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_knowledge_items" ADD CONSTRAINT "whatsapp_agent_knowledge_items_agent_config_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_shares" ADD CONSTRAINT "whatsapp_agent_shares_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_shares" ADD CONSTRAINT "whatsapp_agent_shares_agent_config_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_agent_shares" ADD CONSTRAINT "whatsapp_agent_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;