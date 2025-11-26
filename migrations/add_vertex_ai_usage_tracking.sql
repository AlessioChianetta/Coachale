-- Migration: Add vertex_ai_usage_tracking table for comprehensive Vertex AI cost tracking
-- Date: 2025-11-23
-- Purpose: Track all Vertex AI API calls with accurate cost breakdown for Live API and standard API
--          Support cache optimization monitoring (94% cost reduction on cached tokens)

CREATE TABLE IF NOT EXISTS vertex_ai_usage_tracking (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT, -- For grouping calls in the same Live API session
  call_type TEXT NOT NULL CHECK (call_type IN ('live_api', 'standard_api')), -- Type of API call
  model_name TEXT NOT NULL, -- e.g., "gemini-2.0-flash-exp"
  
  -- Token counts
  prompt_tokens INTEGER NOT NULL DEFAULT 0, -- Text input tokens (fresh)
  candidates_tokens INTEGER NOT NULL DEFAULT 0, -- Text output tokens
  cached_content_token_count INTEGER NOT NULL DEFAULT 0, -- Cached input tokens (94% savings!)
  
  -- Audio metrics (for Live API only)
  audio_input_seconds REAL DEFAULT 0, -- Audio input duration in seconds
  audio_output_seconds REAL DEFAULT 0, -- Audio output duration in seconds
  
  -- Cost breakdown (in USD) - Official Vertex AI Live API pricing
  -- Cached: $0.03/1M tokens, Text Input: $0.50/1M, Audio Input: $3.00/1M, Audio Output: $12.00/1M
  text_input_cost REAL NOT NULL DEFAULT 0, -- Fresh text input cost
  audio_input_cost REAL NOT NULL DEFAULT 0, -- Audio input cost
  audio_output_cost REAL NOT NULL DEFAULT 0, -- Audio output cost (most expensive!)
  cached_input_cost REAL NOT NULL DEFAULT 0, -- Cached input cost (94% cheaper than fresh!)
  total_cost REAL NOT NULL DEFAULT 0, -- Sum of all costs
  
  -- Metadata
  request_metadata JSONB DEFAULT '{}'::jsonb, -- Store full usage metadata from Vertex AI response
  
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS consultant_session_idx ON vertex_ai_usage_tracking(consultant_id, session_id);
CREATE INDEX IF NOT EXISTS call_type_idx ON vertex_ai_usage_tracking(call_type);
CREATE INDEX IF NOT EXISTS created_at_idx ON vertex_ai_usage_tracking(created_at);

-- Comment on table
COMMENT ON TABLE vertex_ai_usage_tracking IS 'Comprehensive tracking of Vertex AI API usage with accurate cost breakdown. Supports Live API (audio/text) and standard API. Enables cache optimization monitoring (94% cost reduction on cached tokens: $0.50 → $0.03 per 1M tokens).';
