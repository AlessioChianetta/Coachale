-- AI Director Tracking Fields Migration
-- Run this to add tracking columns to conversation_states

ALTER TABLE conversation_states 
ADD COLUMN IF NOT EXISTS long_term_schedule_type TEXT,
ADD COLUMN IF NOT EXISTS conversation_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completion_reason TEXT,
ADD COLUMN IF NOT EXISTS silence_reason TEXT;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversation_states' 
AND column_name IN ('long_term_schedule_type', 'conversation_completed_at', 'completion_reason', 'silence_reason');
