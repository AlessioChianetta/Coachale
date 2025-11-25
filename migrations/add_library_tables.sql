
-- Migrazione per aggiungere le tabelle della libreria formativa

-- Tabella categorie libreria
CREATE TABLE IF NOT EXISTS library_categories (
    id VARCHAR DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT DEFAULT 'BookOpen',
    color TEXT DEFAULT 'blue',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Tabella documenti libreria
CREATE TABLE IF NOT EXISTS library_documents (
    id VARCHAR DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id VARCHAR NOT NULL REFERENCES library_categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    content TEXT,
    level TEXT NOT NULL DEFAULT 'base' CHECK (level IN ('base', 'intermedio', 'avanzato')),
    estimated_duration INTEGER,
    tags JSON DEFAULT '[]'::json,
    attachments JSON DEFAULT '[]'::json,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_by VARCHAR NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Tabella sezioni documenti
CREATE TABLE IF NOT EXISTS library_document_sections (
    id VARCHAR DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id VARCHAR NOT NULL REFERENCES library_documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'highlight', 'example', 'note', 'warning')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

-- Tabella progresso clienti
CREATE TABLE IF NOT EXISTS client_library_progress (
    id VARCHAR DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id VARCHAR NOT NULL REFERENCES library_documents(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    time_spent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(client_id, document_id)
);

-- Indici per ottimizzazione query
CREATE INDEX IF NOT EXISTS idx_library_categories_sort_order ON library_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_library_documents_category_id ON library_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_library_documents_sort_order ON library_documents(sort_order);
CREATE INDEX IF NOT EXISTS idx_library_documents_level ON library_documents(level);
CREATE INDEX IF NOT EXISTS idx_library_document_sections_document_id ON library_document_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_library_document_sections_sort_order ON library_document_sections(sort_order);
CREATE INDEX IF NOT EXISTS idx_client_library_progress_client_id ON client_library_progress(client_id);
CREATE INDEX IF NOT EXISTS idx_client_library_progress_document_id ON client_library_progress(document_id);
