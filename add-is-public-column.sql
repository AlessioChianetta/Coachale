
-- Add is_public column to exercises table
ALTER TABLE exercises ADD COLUMN is_public boolean DEFAULT false;

-- Update existing exercises to be private by default
UPDATE exercises SET is_public = false WHERE is_public IS NULL;
