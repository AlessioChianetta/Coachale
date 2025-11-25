
-- Aggiungere tabella sotto-categorie
CREATE TABLE IF NOT EXISTS library_subcategories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR NOT NULL REFERENCES library_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Folder',
  color TEXT DEFAULT 'gray',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Aggiungere colonna subcategory_id alla tabella documenti
ALTER TABLE library_documents 
ADD COLUMN IF NOT EXISTS subcategory_id VARCHAR REFERENCES library_subcategories(id) ON DELETE CASCADE;

-- Creare indici per performance
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON library_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_sort_order ON library_subcategories(sort_order);
CREATE INDEX IF NOT EXISTS idx_documents_subcategory_id ON library_documents(subcategory_id);
