-- Add is_default column to consultant_whatsapp_config
-- Marks the system-created "Assistenza Clienti" agent as the default
-- This allows CRM access control based on a stable flag rather than the agent name

ALTER TABLE consultant_whatsapp_config
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Backfill: mark existing "Assistenza Clienti" agents as default
UPDATE consultant_whatsapp_config
  SET is_default = true
  WHERE agent_name = 'Assistenza Clienti';
