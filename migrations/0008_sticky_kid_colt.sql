CREATE TABLE "campaign_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"date" date NOT NULL,
	"leads_created" integer DEFAULT 0 NOT NULL,
	"leads_contacted" integer DEFAULT 0 NOT NULL,
	"leads_responded" integer DEFAULT 0 NOT NULL,
	"leads_converted" integer DEFAULT 0 NOT NULL,
	"avg_response_time_hours" real,
	"conversion_rate" real DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "campaign_analytics_campaign_id_date_unique" UNIQUE("campaign_id","date")
);
--> statement-breakpoint
CREATE TABLE "external_api_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"config_name" text NOT NULL,
	"api_key" text NOT NULL,
	"base_url" text NOT NULL,
	"lead_type" text DEFAULT 'both' NOT NULL,
	"source_filter" text,
	"campaign_filter" text,
	"days_filter" text,
	"target_campaign_id" varchar,
	"polling_enabled" boolean DEFAULT false NOT NULL,
	"polling_interval_minutes" integer DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_import_at" timestamp,
	"last_import_status" text DEFAULT 'never',
	"last_import_leads_count" integer DEFAULT 0,
	"last_import_error_message" text,
	"next_scheduled_run" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "external_api_configs_consultant_id_config_name_unique" UNIQUE("consultant_id","config_name")
);
--> statement-breakpoint
CREATE TABLE "external_lead_import_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"import_type" text NOT NULL,
	"status" text NOT NULL,
	"leads_processed" integer DEFAULT 0 NOT NULL,
	"leads_imported" integer DEFAULT 0 NOT NULL,
	"leads_updated" integer DEFAULT 0 NOT NULL,
	"leads_duplicated" integer DEFAULT 0 NOT NULL,
	"leads_errored" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_details" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"campaign_name" text NOT NULL,
	"campaign_type" text NOT NULL,
	"lead_category" text DEFAULT 'freddo' NOT NULL,
	"hook_text" text,
	"ideal_state_description" text,
	"implicit_desires" text,
	"default_obiettivi" text,
	"preferred_agent_config_id" varchar,
	"opening_template_id" varchar,
	"followup_gentle_template_id" varchar,
	"followup_value_template_id" varchar,
	"followup_final_template_id" varchar,
	"total_leads" integer DEFAULT 0 NOT NULL,
	"converted_leads" integer DEFAULT 0 NOT NULL,
	"conversion_rate" real DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "marketing_campaigns_consultant_id_campaign_name_unique" UNIQUE("consultant_id","campaign_name")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_template_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_config_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"template_type" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_template_assignments_agent_config_id_template_type_unique" UNIQUE("agent_config_id","template_type")
);
--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "template_bodies" jsonb;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "is_dry_run" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "proactive_leads" ADD COLUMN "campaign_id" varchar;--> statement-breakpoint
ALTER TABLE "proactive_leads" ADD COLUMN "lead_category" text;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD COLUMN "is_proactive_lead" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD COLUMN "proactive_lead_id" varchar;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD COLUMN "proactive_lead_assigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "whatsapp_pending_messages" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_analytics" ADD CONSTRAINT "campaign_analytics_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_api_configs" ADD CONSTRAINT "external_api_configs_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_api_configs" ADD CONSTRAINT "external_api_configs_target_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("target_campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lead_import_logs" ADD CONSTRAINT "external_lead_import_logs_config_id_external_api_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."external_api_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lead_import_logs" ADD CONSTRAINT "external_lead_import_logs_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_preferred_agent_config_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("preferred_agent_config_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_opening_template_id_whatsapp_custom_templates_id_fk" FOREIGN KEY ("opening_template_id") REFERENCES "public"."whatsapp_custom_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_followup_gentle_template_id_whatsapp_custom_templates_id_fk" FOREIGN KEY ("followup_gentle_template_id") REFERENCES "public"."whatsapp_custom_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_followup_value_template_id_whatsapp_custom_templates_id_fk" FOREIGN KEY ("followup_value_template_id") REFERENCES "public"."whatsapp_custom_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_followup_final_template_id_whatsapp_custom_templates_id_fk" FOREIGN KEY ("followup_final_template_id") REFERENCES "public"."whatsapp_custom_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_template_assignments" ADD CONSTRAINT "whatsapp_template_assignments_agent_config_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_template_assignments" ADD CONSTRAINT "whatsapp_template_assignments_template_id_whatsapp_custom_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_custom_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proactive_leads" ADD CONSTRAINT "proactive_leads_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_proactive_lead_id_proactive_leads_id_fk" FOREIGN KEY ("proactive_lead_id") REFERENCES "public"."proactive_leads"("id") ON DELETE set null ON UPDATE no action;