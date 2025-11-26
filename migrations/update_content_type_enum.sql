
-- Update content_type to allow 'both' value
-- First, check if the column has a constraint
DO $$ 
BEGIN
  -- Drop the existing check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'library_documents_content_type_check'
  ) THEN
    ALTER TABLE library_documents DROP CONSTRAINT library_documents_content_type_check;
  END IF;
  
  -- Add new check constraint with 'both' option
  ALTER TABLE library_documents 
  ADD CONSTRAINT library_documents_content_type_check 
  CHECK (content_type IN ('text', 'video', 'both'));
END $$;
