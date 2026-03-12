CREATE TABLE IF NOT EXISTS consultant_meta_ads_config (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_account_id VARCHAR(100),
  ad_account_name TEXT,
  business_id VARCHAR(100),
  business_name TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMP,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP,
  sync_error TEXT,
  connected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_config_consultant ON consultant_meta_ads_config(consultant_id);

CREATE TABLE IF NOT EXISTS meta_ad_insights (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  config_id VARCHAR REFERENCES consultant_meta_ads_config(id) ON DELETE CASCADE,
  meta_ad_id VARCHAR(100) NOT NULL,
  meta_campaign_id VARCHAR(100),
  meta_adset_id VARCHAR(100),
  ad_name TEXT,
  campaign_name TEXT,
  adset_name TEXT,
  ad_status VARCHAR(50),
  campaign_status VARCHAR(50),
  daily_budget REAL,
  lifetime_budget REAL,
  spend REAL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  cpc REAL,
  cpm REAL,
  ctr REAL,
  cpl REAL,
  frequency REAL,
  roas REAL,
  creative_thumbnail_url TEXT,
  creative_body TEXT,
  creative_title TEXT,
  date_start DATE,
  date_stop DATE,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_consultant ON meta_ad_insights(consultant_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_meta_ad ON meta_ad_insights(meta_ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_config ON meta_ad_insights(config_id);

CREATE TABLE IF NOT EXISTS meta_ad_insights_daily (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meta_ad_id VARCHAR(100) NOT NULL,
  snapshot_date DATE NOT NULL,
  spend REAL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  cpc REAL,
  cpm REAL,
  ctr REAL,
  cpl REAL,
  frequency REAL,
  roas REAL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_daily_consultant ON meta_ad_insights_daily(consultant_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_daily_ad ON meta_ad_insights_daily(meta_ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_daily_date ON meta_ad_insights_daily(snapshot_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_ad_daily_unique ON meta_ad_insights_daily(consultant_id, meta_ad_id, snapshot_date);

ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS meta_ad_id VARCHAR(100);
