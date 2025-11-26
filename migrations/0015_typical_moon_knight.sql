CREATE TABLE "client_sales_agents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"agent_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"share_token" text NOT NULL,
	"display_name" text NOT NULL,
	"business_name" text NOT NULL,
	"business_description" text,
	"consultant_bio" text,
	"vision" text,
	"mission" text,
	"values" jsonb DEFAULT '[]'::jsonb,
	"usp" text,
	"target_client" text,
	"non_target_client" text,
	"what_we_do" text,
	"how_we_do_it" text,
	"years_experience" integer DEFAULT 0,
	"clients_helped" integer DEFAULT 0,
	"results_generated" text,
	"software_created" jsonb DEFAULT '[]'::jsonb,
	"books_published" jsonb DEFAULT '[]'::jsonb,
	"case_studies" jsonb DEFAULT '[]'::jsonb,
	"services_offered" jsonb DEFAULT '[]'::jsonb,
	"guarantees" text,
	"enable_discovery" boolean DEFAULT true NOT NULL,
	"enable_demo" boolean DEFAULT true NOT NULL,
	"enable_payment" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_sales_agents_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "client_sales_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"ai_conversation_id" varchar,
	"prospect_name" text NOT NULL,
	"prospect_email" text,
	"prospect_phone" text,
	"current_phase" text DEFAULT 'discovery' NOT NULL,
	"collected_data" jsonb DEFAULT '{}'::jsonb,
	"objections_raised" jsonb DEFAULT '[]'::jsonb,
	"outcome" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_sales_knowledge" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"content" text,
	"file_path" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "client_sales_agents" ADD CONSTRAINT "client_sales_agents_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_sales_agents" ADD CONSTRAINT "client_sales_agents_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_sales_conversations" ADD CONSTRAINT "client_sales_conversations_agent_id_client_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."client_sales_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_sales_conversations" ADD CONSTRAINT "client_sales_conversations_ai_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("ai_conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_sales_knowledge" ADD CONSTRAINT "client_sales_knowledge_agent_id_client_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."client_sales_agents"("id") ON DELETE cascade ON UPDATE no action;