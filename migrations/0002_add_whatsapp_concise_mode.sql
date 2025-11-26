ALTER TABLE "consultant_whatsapp_config" ADD COLUMN "whatsapp_concise_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_templates" ADD COLUMN "library_document_id" varchar;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "template_id" varchar;--> statement-breakpoint
ALTER TABLE "exercise_templates" ADD CONSTRAINT "exercise_templates_library_document_id_library_documents_id_fk" FOREIGN KEY ("library_document_id") REFERENCES "public"."library_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_template_id_exercise_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."exercise_templates"("id") ON DELETE no action ON UPDATE no action;