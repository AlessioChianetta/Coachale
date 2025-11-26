-- Migration: Add template approval status caching to consultant_whatsapp_config
-- This allows caching Twilio template approval status to avoid excessive API calls

-- Add template_approval_status column (JSONB to store status for each template SID)
ALTER TABLE consultant_whatsapp_config 
ADD COLUMN IF NOT EXISTS template_approval_status JSONB;

-- Add last_approval_check column (timestamp of last global check)
ALTER TABLE consultant_whatsapp_config 
ADD COLUMN IF NOT EXISTS last_approval_check TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN consultant_whatsapp_config.template_approval_status IS 
'Cache of WhatsApp template approval status from Twilio. Format: { "HXxxxxx": { "status": "approved", "checkedAt": "2025-11-16T12:00:00Z", "reason": "..." } }';

COMMENT ON COLUMN consultant_whatsapp_config.last_approval_check IS 
'Timestamp of last time template approval statuses were checked via Twilio API';
