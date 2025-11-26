
-- Migration to add template-client associations table
CREATE TABLE template_client_associations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id VARCHAR NOT NULL REFERENCES exercise_templates(id) ON DELETE CASCADE,
  client_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(template_id, client_id, consultant_id)
);

-- Add indexes for better performance
CREATE INDEX idx_template_client_associations_template_id ON template_client_associations(template_id);
CREATE INDEX idx_template_client_associations_client_id ON template_client_associations(client_id);
CREATE INDEX idx_template_client_associations_consultant_id ON template_client_associations(consultant_id);
