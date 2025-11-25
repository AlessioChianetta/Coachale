
-- Add last_reset_at column to whatsapp_conversations table
ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMP;

-- Add comment to column
COMMENT ON COLUMN whatsapp_conversations.last_reset_at IS 'Timestamp dell''ultimo reset conversazione';
