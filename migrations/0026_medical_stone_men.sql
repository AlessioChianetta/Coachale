CREATE TABLE "client_knowledge_api_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_config_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"cache_key" text DEFAULT 'default' NOT NULL,
	"cached_data" jsonb NOT NULL,
	"data_summary" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_knowledge_apis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'custom' NOT NULL,
	"base_url" text NOT NULL,
	"api_key" text,
	"auth_type" text DEFAULT 'api_key' NOT NULL,
	"auth_config" jsonb,
	"default_endpoint" text,
	"endpoint" text,
	"request_method" text DEFAULT 'GET' NOT NULL,
	"request_headers" jsonb DEFAULT '{}'::jsonb,
	"custom_headers" jsonb DEFAULT '{}'::jsonb,
	"request_params" jsonb DEFAULT '{}'::jsonb,
	"data_mapping" jsonb,
	"cache_duration_minutes" integer DEFAULT 60 NOT NULL,
	"auto_refresh" boolean DEFAULT false NOT NULL,
	"refresh_interval_minutes" integer DEFAULT 60,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_status" text DEFAULT 'never',
	"last_sync_error" text,
	"summary_enabled" boolean DEFAULT false NOT NULL,
	"data_summary" text,
	"template_id" text,
	"template_name" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"priority" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_knowledge_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'other' NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" text NOT NULL,
	"extracted_content" text,
	"content_summary" text,
	"summary_enabled" boolean DEFAULT false NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_version_id" varchar,
	"priority" integer DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"error_message" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultant_knowledge_api_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_config_id" varchar NOT NULL,
	"consultant_id" varchar NOT NULL,
	"cache_key" text DEFAULT 'default' NOT NULL,
	"cached_data" jsonb NOT NULL,
	"data_summary" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultant_knowledge_apis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'custom' NOT NULL,
	"base_url" text NOT NULL,
	"api_key" text,
	"auth_type" text DEFAULT 'api_key' NOT NULL,
	"auth_config" jsonb,
	"default_endpoint" text,
	"request_method" text DEFAULT 'GET' NOT NULL,
	"request_headers" jsonb DEFAULT '{}'::jsonb,
	"request_params" jsonb DEFAULT '{}'::jsonb,
	"data_mapping" jsonb,
	"cache_duration_minutes" integer DEFAULT 60 NOT NULL,
	"auto_refresh" boolean DEFAULT false NOT NULL,
	"refresh_interval_minutes" integer DEFAULT 60,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_status" text DEFAULT 'never',
	"last_sync_error" text,
	"summary_enabled" boolean DEFAULT false NOT NULL,
	"data_summary" text,
	"template_id" text,
	"template_name" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"priority" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultant_knowledge_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'other' NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" text NOT NULL,
	"extracted_content" text,
	"content_summary" text,
	"summary_enabled" boolean DEFAULT false NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_version_id" varchar,
	"priority" integer DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"error_message" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "appointment_bookings" ADD COLUMN "last_completed_action" jsonb;--> statement-breakpoint
ALTER TABLE "client_knowledge_api_cache" ADD CONSTRAINT "client_knowledge_api_cache_api_config_id_client_knowledge_apis_id_fk" FOREIGN KEY ("api_config_id") REFERENCES "public"."client_knowledge_apis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_knowledge_api_cache" ADD CONSTRAINT "client_knowledge_api_cache_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_knowledge_apis" ADD CONSTRAINT "client_knowledge_apis_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_knowledge_documents" ADD CONSTRAINT "client_knowledge_documents_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_knowledge_api_cache" ADD CONSTRAINT "consultant_knowledge_api_cache_api_config_id_consultant_knowledge_apis_id_fk" FOREIGN KEY ("api_config_id") REFERENCES "public"."consultant_knowledge_apis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_knowledge_api_cache" ADD CONSTRAINT "consultant_knowledge_api_cache_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_knowledge_apis" ADD CONSTRAINT "consultant_knowledge_apis_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_knowledge_documents" ADD CONSTRAINT "consultant_knowledge_documents_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_knowledge_cache_api_idx" ON "client_knowledge_api_cache" USING btree ("api_config_id");--> statement-breakpoint
CREATE INDEX "client_knowledge_cache_expires_idx" ON "client_knowledge_api_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "client_knowledge_cache_key_idx" ON "client_knowledge_api_cache" USING btree ("api_config_id","cache_key");--> statement-breakpoint
CREATE INDEX "client_knowledge_api_client_idx" ON "client_knowledge_apis" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_knowledge_api_category_idx" ON "client_knowledge_apis" USING btree ("category");--> statement-breakpoint
CREATE INDEX "client_knowledge_api_active_idx" ON "client_knowledge_apis" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "client_knowledge_doc_client_idx" ON "client_knowledge_documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_knowledge_doc_category_idx" ON "client_knowledge_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "client_knowledge_doc_status_idx" ON "client_knowledge_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_cache_api_idx" ON "consultant_knowledge_api_cache" USING btree ("api_config_id");--> statement-breakpoint
CREATE INDEX "knowledge_cache_expires_idx" ON "consultant_knowledge_api_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "knowledge_cache_key_idx" ON "consultant_knowledge_api_cache" USING btree ("api_config_id","cache_key");--> statement-breakpoint
CREATE INDEX "knowledge_api_consultant_idx" ON "consultant_knowledge_apis" USING btree ("consultant_id");--> statement-breakpoint
CREATE INDEX "knowledge_api_category_idx" ON "consultant_knowledge_apis" USING btree ("category");--> statement-breakpoint
CREATE INDEX "knowledge_api_active_idx" ON "consultant_knowledge_apis" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "knowledge_doc_consultant_idx" ON "consultant_knowledge_documents" USING btree ("consultant_id");--> statement-breakpoint
CREATE INDEX "knowledge_doc_category_idx" ON "consultant_knowledge_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "knowledge_doc_status_idx" ON "consultant_knowledge_documents" USING btree ("status");