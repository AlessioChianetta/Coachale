
-- Add opened_at column to automated_emails_log table
ALTER TABLE automated_emails_log 
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP;

-- Add comment to column
COMMENT ON COLUMN automated_emails_log.opened_at IS 'Timestamp when the client opened the email (email tracking)';
