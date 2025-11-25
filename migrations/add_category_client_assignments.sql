
-- Migration to add category-client assignments table
CREATE TABLE IF NOT EXISTS library_category_client_assignments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR NOT NULL REFERENCES library_categories(id) ON DELETE CASCADE,
  client_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(category_id, client_id, consultant_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_category_client_assignments_category_id ON library_category_client_assignments(category_id);
CREATE INDEX IF NOT EXISTS idx_category_client_assignments_client_id ON library_category_client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_category_client_assignments_consultant_id ON library_category_client_assignments(consultant_id);
