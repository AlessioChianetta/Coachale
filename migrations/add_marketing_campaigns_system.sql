-- Add Marketing Campaigns System
-- This migration creates the marketing campaigns feature that allows consultants
-- to organize leads by campaign source, with automatic population of hooks, objectives,
-- and messaging based on campaign configuration.

-- Step 1: Create marketing_campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Campaign Info
  campaign_name TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('outbound_ads', 'inbound_form', 'referral', 'recovery', 'partner', 'walk_in')),
  lead_category TEXT NOT NULL DEFAULT 'freddo' CHECK (lead_category IN ('freddo', 'tiepido', 'caldo', 'recupero', 'referral')),
  
  -- Campaign Positioning & Messaging
  hook_text TEXT,
  ideal_state_description TEXT,
  implicit_desires TEXT,
  default_obiettivi TEXT,
  
  -- Agent & Template Configuration
  preferred_agent_config_id VARCHAR REFERENCES consultant_whatsapp_config(id) ON DELETE SET NULL,
  opening_template_id VARCHAR REFERENCES whatsapp_custom_templates(id) ON DELETE SET NULL,
  followup_gentle_template_id VARCHAR REFERENCES whatsapp_custom_templates(id) ON DELETE SET NULL,
  followup_value_template_id VARCHAR REFERENCES whatsapp_custom_templates(id) ON DELETE SET NULL,
  followup_final_template_id VARCHAR REFERENCES whatsapp_custom_templates(id) ON DELETE SET NULL,
  
  -- Metrics (calculated from leads)
  total_leads INTEGER NOT NULL DEFAULT 0,
  converted_leads INTEGER NOT NULL DEFAULT 0,
  conversion_rate REAL DEFAULT 0,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Unique constraint: one campaign name per consultant
  UNIQUE(consultant_id, campaign_name)
);

-- Step 2: Create campaign_analytics table for daily metrics
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Daily metrics
  leads_created INTEGER NOT NULL DEFAULT 0,
  leads_contacted INTEGER NOT NULL DEFAULT 0,
  leads_responded INTEGER NOT NULL DEFAULT 0,
  leads_converted INTEGER NOT NULL DEFAULT 0,
  
  -- Calculated metrics
  avg_response_time_hours REAL,
  conversion_rate REAL DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT now(),
  
  -- Unique constraint: one record per campaign per date
  UNIQUE(campaign_id, date)
);

-- Step 3: Add new columns to proactive_leads table
ALTER TABLE proactive_leads 
ADD COLUMN IF NOT EXISTS campaign_id VARCHAR REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lead_category TEXT CHECK (lead_category IN ('freddo', 'tiepido', 'caldo', 'recupero', 'referral'));

-- Step 4: Create legacy campaign for each consultant who has existing leads
-- This ensures all existing leads get associated with a campaign
DO $$
DECLARE
  consultant_record RECORD;
  legacy_campaign_id VARCHAR;
  first_config_id VARCHAR;
  first_lead_info JSONB;
BEGIN
  FOR consultant_record IN 
    SELECT DISTINCT consultant_id 
    FROM proactive_leads 
    WHERE campaign_id IS NULL
  LOOP
    -- Get first agent config for this consultant (to use as preferred)
    SELECT id INTO first_config_id
    FROM consultant_whatsapp_config
    WHERE consultant_id = consultant_record.consultant_id
    LIMIT 1;
    
    -- Get leadInfo from first lead to use as defaults for legacy campaign
    SELECT lead_info INTO first_lead_info
    FROM proactive_leads
    WHERE consultant_id = consultant_record.consultant_id
    LIMIT 1;
    
    -- Create legacy campaign for this consultant
    INSERT INTO marketing_campaigns (
      consultant_id,
      campaign_name,
      campaign_type,
      lead_category,
      hook_text,
      ideal_state_description,
      default_obiettivi,
      preferred_agent_config_id,
      is_active
    ) VALUES (
      consultant_record.consultant_id,
      'Legacy - Pre Sistema Campagne',
      'inbound_form',
      'freddo',
      COALESCE(first_lead_info->>'uncino', 'lead importato prima del sistema campagne'),
      COALESCE(first_lead_info->>'obiettivi', 'obiettivi da definire'),
      COALESCE(first_lead_info->>'obiettivi', 'obiettivi da definire'),
      first_config_id,
      false -- Imposta come inattiva per incoraggiare creazione di campagne reali
    )
    RETURNING id INTO legacy_campaign_id;
    
    -- Associate all existing leads to this legacy campaign
    UPDATE proactive_leads
    SET 
      campaign_id = legacy_campaign_id,
      lead_category = COALESCE(lead_category, 'freddo')
    WHERE 
      consultant_id = consultant_record.consultant_id 
      AND campaign_id IS NULL;
      
    -- Update campaign metrics
    UPDATE marketing_campaigns
    SET 
      total_leads = (
        SELECT COUNT(*) 
        FROM proactive_leads 
        WHERE campaign_id = legacy_campaign_id
      ),
      converted_leads = (
        SELECT COUNT(*) 
        FROM proactive_leads 
        WHERE campaign_id = legacy_campaign_id AND status = 'converted'
      )
    WHERE id = legacy_campaign_id;
    
    -- Calculate conversion rate
    UPDATE marketing_campaigns
    SET conversion_rate = CASE 
      WHEN total_leads > 0 THEN (converted_leads::REAL / total_leads::REAL * 100)
      ELSE 0
    END
    WHERE id = legacy_campaign_id;
    
    RAISE NOTICE 'Created legacy campaign for consultant % with % leads', 
      consultant_record.consultant_id, 
      (SELECT COUNT(*) FROM proactive_leads WHERE campaign_id = legacy_campaign_id);
  END LOOP;
END $$;

-- Step 5: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_consultant ON marketing_campaigns(consultant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_active ON marketing_campaigns(consultant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign ON campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_date ON campaign_analytics(campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_proactive_leads_campaign ON proactive_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_proactive_leads_category ON proactive_leads(lead_category);

-- Step 6: Add comment for documentation
COMMENT ON TABLE marketing_campaigns IS 'Marketing campaigns configuration with hooks, objectives, and template assignments';
COMMENT ON TABLE campaign_analytics IS 'Daily aggregated metrics for marketing campaigns';
COMMENT ON COLUMN proactive_leads.campaign_id IS 'Link to marketing campaign source (NULL for legacy leads)';
COMMENT ON COLUMN proactive_leads.lead_category IS 'Lead temperature/type from campaign (freddo, tiepido, caldo, recupero, referral)';
