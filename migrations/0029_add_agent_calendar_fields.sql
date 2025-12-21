-- Migration: Add Google Calendar fields to consultant_whatsapp_config
-- Each agent can now have its own Google Calendar for appointments

ALTER TABLE "consultant_whatsapp_config" 
ADD COLUMN IF NOT EXISTS "google_calendar_id" text,
ADD COLUMN IF NOT EXISTS "google_calendar_email" text,
ADD COLUMN IF NOT EXISTS "google_access_token" text,
ADD COLUMN IF NOT EXISTS "google_refresh_token" text,
ADD COLUMN IF NOT EXISTS "google_token_expiry" timestamp,
ADD COLUMN IF NOT EXISTS "calendar_connected_at" timestamp;

-- Add comment for documentation
COMMENT ON COLUMN "consultant_whatsapp_config"."google_calendar_id" IS 'Calendar ID for this agent (e.g., primary or specific calendar email)';
COMMENT ON COLUMN "consultant_whatsapp_config"."google_calendar_email" IS 'Email of the Google account connected to this agent';
COMMENT ON COLUMN "consultant_whatsapp_config"."google_access_token" IS 'OAuth access token for Google Calendar API';
COMMENT ON COLUMN "consultant_whatsapp_config"."google_refresh_token" IS 'OAuth refresh token for Google Calendar API';
COMMENT ON COLUMN "consultant_whatsapp_config"."google_token_expiry" IS 'Expiration timestamp of the access token';
COMMENT ON COLUMN "consultant_whatsapp_config"."calendar_connected_at" IS 'Timestamp when the calendar was connected';
