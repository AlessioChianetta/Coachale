-- Migration: Add Authority & Positioning fields to consultant_whatsapp_config
-- Created: 2025-01-30
-- Purpose: Add comprehensive consultant profile, authority, and positioning fields

-- Business Profile fields
ALTER TABLE consultant_whatsapp_config 
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS business_description TEXT,
ADD COLUMN IF NOT EXISTS consultant_bio TEXT;

-- Note: sales_script already exists, no need to add

-- Authority & Positioning
ALTER TABLE consultant_whatsapp_config
ADD COLUMN IF NOT EXISTS vision TEXT,
ADD COLUMN IF NOT EXISTS mission TEXT,
ADD COLUMN IF NOT EXISTS values JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS usp TEXT;

-- Who We Help & Don't Help
ALTER TABLE consultant_whatsapp_config
ADD COLUMN IF NOT EXISTS who_we_help TEXT,
ADD COLUMN IF NOT EXISTS who_we_dont_help TEXT,
ADD COLUMN IF NOT EXISTS what_we_do TEXT,
ADD COLUMN IF NOT EXISTS how_we_do_it TEXT;

-- Software & Books
ALTER TABLE consultant_whatsapp_config
ADD COLUMN IF NOT EXISTS software_created JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS books_published JSONB DEFAULT '[]'::jsonb;

-- Proof & Credibility
ALTER TABLE consultant_whatsapp_config
ADD COLUMN IF NOT EXISTS years_experience INTEGER,
ADD COLUMN IF NOT EXISTS clients_helped INTEGER,
ADD COLUMN IF NOT EXISTS results_generated TEXT,
ADD COLUMN IF NOT EXISTS case_studies JSONB DEFAULT '[]'::jsonb;

-- Services & Guarantees
ALTER TABLE consultant_whatsapp_config
ADD COLUMN IF NOT EXISTS services_offered JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS guarantees TEXT;

-- Add comment to track migration
COMMENT ON TABLE consultant_whatsapp_config IS 'WhatsApp Business configuration with comprehensive consultant authority profile';
