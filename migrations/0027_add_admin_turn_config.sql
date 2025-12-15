-- SuperAdmin TURN Config - Centralized TURN server configuration managed by SuperAdmin
-- Consultants without their own config will cascade/fallback to this config
-- Only one row allowed (singleton pattern)
CREATE TABLE IF NOT EXISTS "admin_turn_config" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" text NOT NULL DEFAULT 'metered',
  "username_encrypted" text,
  "password_encrypted" text,
  "api_key_encrypted" text,
  "turn_urls" jsonb,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
