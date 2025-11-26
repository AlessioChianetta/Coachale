-- Migration: Fix WhatsApp polling watermarks to use agent_config_id instead of consultant_id
-- This fixes the bug where multiple WhatsApp agents for the same consultant share one watermark
-- causing infinite polling loops when conversations are deleted

-- Step 1: Add agent_config_id column (nullable first)
ALTER TABLE whatsapp_polling_watermarks 
ADD COLUMN IF NOT EXISTS agent_config_id VARCHAR;

-- Step 2: Populate agent_config_id from existing consultant_id
-- For each watermark, find the first active agent config for that consultant
UPDATE whatsapp_polling_watermarks w
SET agent_config_id = (
  SELECT id 
  FROM consultant_whatsapp_config c
  WHERE c.consultant_id = w.consultant_id
    AND c.is_active = true
  ORDER BY c.created_at ASC
  LIMIT 1
)
WHERE agent_config_id IS NULL;

-- Step 3: Delete watermarks without valid agent_config_id (orphaned records)
DELETE FROM whatsapp_polling_watermarks
WHERE agent_config_id IS NULL;

-- Step 4: Make agent_config_id required and unique
ALTER TABLE whatsapp_polling_watermarks
ALTER COLUMN agent_config_id SET NOT NULL;

ALTER TABLE whatsapp_polling_watermarks
ADD CONSTRAINT whatsapp_polling_watermarks_agent_config_id_unique UNIQUE (agent_config_id);

-- Step 5: Add foreign key constraint
ALTER TABLE whatsapp_polling_watermarks
ADD CONSTRAINT whatsapp_polling_watermarks_agent_config_id_fkey 
FOREIGN KEY (agent_config_id) 
REFERENCES consultant_whatsapp_config(id) 
ON DELETE CASCADE;

-- Step 6: Remove old consultant_id UNIQUE constraint if it exists
ALTER TABLE whatsapp_polling_watermarks
DROP CONSTRAINT IF EXISTS whatsapp_polling_watermarks_consultant_id_unique;

-- Step 7: Create additional watermarks for consultants with multiple agents
-- This ensures each agent config gets its own watermark
INSERT INTO whatsapp_polling_watermarks (
  consultant_id,
  agent_config_id,
  last_processed_message_date,
  last_processed_twilio_sid,
  messages_processed_count,
  last_polled_at,
  consecutive_errors,
  is_circuit_breaker_open
)
SELECT 
  c.consultant_id,
  c.id as agent_config_id,
  COALESCE(
    (SELECT last_processed_message_date 
     FROM whatsapp_polling_watermarks w2 
     WHERE w2.consultant_id = c.consultant_id 
     LIMIT 1),
    NOW() - INTERVAL '24 hours'
  ) as last_processed_message_date,
  NULL as last_processed_twilio_sid,
  0 as messages_processed_count,
  NOW() as last_polled_at,
  0 as consecutive_errors,
  false as is_circuit_breaker_open
FROM consultant_whatsapp_config c
WHERE c.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM whatsapp_polling_watermarks w
    WHERE w.agent_config_id = c.id
  );
