-- Migration: Add preferred_ai_provider to users table
-- Created: 2025-11-13
-- Purpose: Centralize AI provider management per client with default Vertex AI

-- Add preferred_ai_provider column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferred_ai_provider TEXT DEFAULT 'vertex_admin';

-- Backfill existing clients:
-- - If they have geminiApiKeys configured, set to 'custom'
-- - Otherwise keep default 'vertex_admin'
UPDATE users 
SET preferred_ai_provider = 'custom'
WHERE role = 'client' 
  AND gemini_api_keys IS NOT NULL 
  AND json_array_length(gemini_api_keys::json) > 0;

-- Add comment to track migration
COMMENT ON COLUMN users.preferred_ai_provider IS 'AI provider preference: vertex_admin (default, uses consultant Vertex AI), google_studio (uses consultant Google AI Studio fallback), custom (uses client own geminiApiKeys with rotation)';
