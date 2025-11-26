-- Add default lead fields to consultant_whatsapp_config table
-- These fields are used to provide default values when creating proactive leads
-- without explicit obiettivi, desideri, uncino, or idealState

ALTER TABLE consultant_whatsapp_config 
ADD COLUMN IF NOT EXISTS default_obiettivi TEXT,
ADD COLUMN IF NOT EXISTS default_desideri TEXT,
ADD COLUMN IF NOT EXISTS default_uncino TEXT,
ADD COLUMN IF NOT EXISTS default_ideal_state TEXT;

-- Set default values for existing configs based on "Metodo ORBITALE"
-- These can be customized per agent in the WhatsApp configuration UI
UPDATE consultant_whatsapp_config
SET 
  default_obiettivi = 'creare un patrimonio tra 100.000 e 500.000€ in 2-4 anni con il Metodo ORBITALE',
  default_desideri = 'generare una rendita passiva di almeno 2.000€/mese',
  default_uncino = 'ho visto che potresti essere interessato a costruire un patrimonio solido senza dipendere dallo stipendio',
  default_ideal_state = 'la libertà finanziaria con un patrimonio che lavora al posto tuo'
WHERE default_obiettivi IS NULL;
