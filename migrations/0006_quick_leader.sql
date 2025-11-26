CREATE TABLE "whatsapp_template_variables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_version_id" varchar NOT NULL,
	"variable_catalog_id" varchar NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "whatsapp_template_variables_template_version_id_position_unique" UNIQUE("template_version_id","position"),
	CONSTRAINT "whatsapp_template_variables_template_version_id_variable_catalog_id_unique" UNIQUE("template_version_id","variable_catalog_id")
);
--> statement-breakpoint
ALTER TABLE "whatsapp_template_samples" ADD COLUMN "template_id" varchar;--> statement-breakpoint
ALTER TABLE "whatsapp_template_variables" ADD CONSTRAINT "whatsapp_template_variables_template_version_id_whatsapp_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."whatsapp_template_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_template_variables" ADD CONSTRAINT "whatsapp_template_variables_variable_catalog_id_whatsapp_variable_catalog_id_fk" FOREIGN KEY ("variable_catalog_id") REFERENCES "public"."whatsapp_variable_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_template_samples" ADD CONSTRAINT "whatsapp_template_samples_template_id_whatsapp_custom_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_custom_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_template_versions" DROP COLUMN "variable_order";--> statement-breakpoint
ALTER TABLE "whatsapp_template_samples" ADD CONSTRAINT "whatsapp_template_samples_consultant_id_is_default_unique" UNIQUE("consultant_id","is_default");