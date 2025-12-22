-- Migration: Add consultant village progress table for gamified onboarding
-- This stores the game state for the Pokemon-style setup wizard

CREATE TABLE IF NOT EXISTS consultant_village_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Position in the village
  position_x REAL DEFAULT 400,
  position_y REAL DEFAULT 300,
  
  -- Buildings visited and completed
  visited_buildings TEXT[] DEFAULT '{}',
  completed_buildings TEXT[] DEFAULT '{}',
  
  -- Unlocked areas
  unlocked_areas TEXT[] DEFAULT ARRAY['plaza'],
  
  -- Badges earned
  badges TEXT[] DEFAULT '{}',
  
  -- Game state
  intro_completed BOOLEAN DEFAULT FALSE,
  prefer_classic_mode BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(consultant_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_village_progress_consultant ON consultant_village_progress(consultant_id);
