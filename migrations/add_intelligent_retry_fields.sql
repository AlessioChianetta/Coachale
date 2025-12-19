-- Add Intelligent Retry configuration fields to consultant_ai_preferences
ALTER TABLE consultant_ai_preferences 
ADD COLUMN IF NOT EXISTS max_no_reply_before_dormancy INTEGER DEFAULT 3 NOT NULL,
ADD COLUMN IF NOT EXISTS dormancy_duration_days INTEGER DEFAULT 90 NOT NULL,
ADD COLUMN IF NOT EXISTS final_attempt_after_dormancy BOOLEAN DEFAULT true NOT NULL;
