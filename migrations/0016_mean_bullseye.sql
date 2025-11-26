CREATE TABLE "gemini_session_handles" (
	"handle" text PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"share_token" text,
	"conversation_id" varchar,
	"mode" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "gemini_session_handles" ADD CONSTRAINT "gemini_session_handles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;