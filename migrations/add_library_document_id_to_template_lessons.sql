
-- Aggiungi colonna library_document_id alla tabella template_lessons
ALTER TABLE template_lessons 
ADD COLUMN library_document_id VARCHAR REFERENCES library_documents(id);

-- Aggiungi indice per ottimizzare le query
CREATE INDEX IF NOT EXISTS idx_template_lessons_library_document_id 
ON template_lessons(library_document_id);
