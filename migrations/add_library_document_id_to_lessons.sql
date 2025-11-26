
-- Aggiungi colonna libraryDocumentId alla tabella university_lessons
ALTER TABLE university_lessons 
ADD COLUMN library_document_id VARCHAR REFERENCES library_documents(id);

-- Aggiungi indice per ottimizzare le query
CREATE INDEX IF NOT EXISTS idx_university_lessons_library_document_id 
ON university_lessons(library_document_id);
