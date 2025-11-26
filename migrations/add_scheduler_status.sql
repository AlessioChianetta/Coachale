
-- Add scheduler_status column to consultant_smtp_settings
ALTER TABLE consultant_smtp_settings 
ADD COLUMN IF NOT EXISTS scheduler_status TEXT DEFAULT 'idle' CHECK (scheduler_status IN ('idle', 'running'));

-- Set all existing rows to 'idle'
UPDATE consultant_smtp_settings SET scheduler_status = 'idle' WHERE scheduler_status IS NULL;
