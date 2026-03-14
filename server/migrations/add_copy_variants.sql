DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_posts' AND column_name = 'copy_variants'
  ) THEN
    ALTER TABLE content_posts ADD COLUMN copy_variants jsonb DEFAULT '[]'::jsonb;
  END IF;
END
$$;
