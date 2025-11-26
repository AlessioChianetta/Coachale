-- Migration: Add WhatsApp Polling Watermarks table
-- Purpose: Prevent re-downloading all messages from Twilio when local messages are deleted
-- This table maintains a persistent record of the last processed message per consultant

CREATE TABLE IF NOT EXISTS "whatsapp_polling_watermarks" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "consultant_id" varchar NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
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
  "updated_at" timestamp DEFAULT now()
);

-- Add index for faster consultant lookups
CREATE INDEX IF NOT EXISTS "idx_watermarks_consultant" ON "whatsapp_polling_watermarks"("consultant_id");

-- Add index for circuit breaker queries
CREATE INDEX IF NOT EXISTS "idx_watermarks_circuit_breaker" ON "whatsapp_polling_watermarks"("is_circuit_breaker_open");
