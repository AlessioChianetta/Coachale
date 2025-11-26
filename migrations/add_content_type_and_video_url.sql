
-- Add content type and video URL columns to library_documents table
ALTER TABLE library_documents 
ADD COLUMN content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'video')),
ADD COLUMN video_url TEXT;

-- Update existing documents to have content_type as 'text'
UPDATE library_documents SET content_type = 'text' WHERE content_type IS NULL;

-- Make content_type NOT NULL after setting default values
ALTER TABLE library_documents ALTER COLUMN content_type SET NOT NULL;
