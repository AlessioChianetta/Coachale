
-- Add external_link column to roadmap_items table
ALTER TABLE roadmap_items 
ADD COLUMN external_link TEXT;

-- Add external_link_title column for custom link titles
ALTER TABLE roadmap_items 
ADD COLUMN external_link_title TEXT;
