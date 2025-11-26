
-- Add whatsapp_sent column to exercise_assignments table
ALTER TABLE exercise_assignments 
ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN DEFAULT FALSE;
