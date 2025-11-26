CREATE TABLE "vertex_ai_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"managed_by" text NOT NULL,
	"project_id" text NOT NULL,
	"location" text DEFAULT 'us-central1' NOT NULL,
	"service_account_json" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"allow_client_override" boolean DEFAULT false,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "vertex_ai_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_polling_watermarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"agent_config_id" varchar NOT NULL,
	"last_processed_message_date" timestamp NOT NULL,
	"last_processed_twilio_sid" text,
	"messages_processed_count" integer DEFAULT 0 NOT NULL,
	"last_polled_at" timestamp DEFAULT now() NOT NULL,
	"consecutive_errors" integer DEFAULT 0 NOT NULL,
	"last_error_at" timestamp,
	"last_error_message" text,
	"is_circuit_breaker_open" boolean DEFAULT false NOT NULL,
	"circuit_breaker_opened_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "whatsapp_polling_watermarks_agent_config_id_unique" UNIQUE("agent_config_id")
);
--> statement-breakpoint
ALTER TABLE "vertex_ai_settings" ADD CONSTRAINT "vertex_ai_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_polling_watermarks" ADD CONSTRAINT "whatsapp_polling_watermarks_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_polling_watermarks" ADD CONSTRAINT "whatsapp_polling_watermarks_agent_config_id_consultant_whatsapp_config_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."consultant_whatsapp_config"("id") ON DELETE cascade ON UPDATE no action;