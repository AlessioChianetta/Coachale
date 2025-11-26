
-- Migration: Add updated_at column to whatsapp_agent_knowledge_items
-- This fixes the error "column updated_at does not exist"

ALTER TABLE whatsapp_agent_knowledge_items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Set updated_at to created_at for existing records
UPDATE whatsapp_agent_knowledge_items 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN whatsapp_agent_knowledge_items.updated_at IS 'Timestamp of last update to the knowledge item';
