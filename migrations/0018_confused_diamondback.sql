CREATE TABLE "consultation_invites" (
	"invite_token" varchar(64) PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"consultant_name" text NOT NULL,
	"prospect_name" text,
	"prospect_email" text,
	"prospect_phone" text,
	"conversation_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "consultation_invites" ADD CONSTRAINT "consultation_invites_agent_id_client_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."client_sales_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_invites" ADD CONSTRAINT "consultation_invites_conversation_id_client_sales_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."client_sales_conversations"("id") ON DELETE set null ON UPDATE no action;