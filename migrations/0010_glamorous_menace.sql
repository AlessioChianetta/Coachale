CREATE TABLE "vertex_ai_client_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vertex_settings_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"has_access" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "vertex_ai_client_access_vertex_settings_id_client_id_unique" UNIQUE("vertex_settings_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_gemini_api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"api_key" text NOT NULL,
	"key_preview" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_vertex_ai_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"location" varchar(100) DEFAULT 'us-central1' NOT NULL,
	"service_account_json" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_vertex_ai_settings_consultant_id_unique" UNIQUE("consultant_id")
);
--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "agent_instructions" text;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "agent_instructions_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "selected_template" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_ai_provider" text DEFAULT 'vertex_admin';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "encryption_salt" text;--> statement-breakpoint
ALTER TABLE "vertex_ai_settings" ADD COLUMN "usage_scope" text DEFAULT 'both';--> statement-breakpoint
ALTER TABLE "vertex_ai_client_access" ADD CONSTRAINT "vertex_ai_client_access_vertex_settings_id_vertex_ai_settings_id_fk" FOREIGN KEY ("vertex_settings_id") REFERENCES "public"."vertex_ai_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vertex_ai_client_access" ADD CONSTRAINT "vertex_ai_client_access_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_gemini_api_keys" ADD CONSTRAINT "whatsapp_gemini_api_keys_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_vertex_ai_settings" ADD CONSTRAINT "whatsapp_vertex_ai_settings_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;