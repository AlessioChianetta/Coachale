-- Migration: Create system_errors table for centralized error tracking
-- This table logs critical system errors for visibility in the UI

CREATE TABLE IF NOT EXISTS system_errors (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_config_id VARCHAR REFERENCES consultant_whatsapp_config(id) ON DELETE CASCADE,
  
  -- Error classification
  error_type TEXT NOT NULL,
  -- Possible values: template_not_approved, twilio_auth_failed, duplicate_lead, 
  --                  message_send_failed, invalid_credentials, configuration_error
  
  error_message TEXT NOT NULL,
  error_details JSONB,
  -- JSON structure: { leadId?, phoneNumber?, templateSid?, twilioError?, stackTrace? }
  
  -- Status tracking
  resolved_at TIMESTAMP,
  resolved_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_errors_consultant_id ON system_errors(consultant_id);
CREATE INDEX IF NOT EXISTS idx_system_errors_agent_config_id ON system_errors(agent_config_id);
CREATE INDEX IF NOT EXISTS idx_system_errors_error_type ON system_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_system_errors_resolved ON system_errors(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_errors_created_at ON system_errors(created_at DESC);

-- Add comments
COMMENT ON TABLE system_errors IS 'Centralized error tracking for critical system issues';
COMMENT ON COLUMN system_errors.error_type IS 'Error classification: template_not_approved, twilio_auth_failed, duplicate_lead, message_send_failed, etc.';
COMMENT ON COLUMN system_errors.error_details IS 'Additional context as JSON (leadId, phoneNumber, templateSid, twilioError, etc.)';
