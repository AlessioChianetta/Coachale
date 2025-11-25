-- Remove unique constraint on (consultant_id, twilio_whatsapp_number)
-- This allows using the same Twilio test number (+14155238886) for multiple agents
ALTER TABLE "consultant_whatsapp_config" DROP CONSTRAINT IF EXISTS "consultant_whatsapp_config_consultant_number_unique";
