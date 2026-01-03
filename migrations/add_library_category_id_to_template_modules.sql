-- Add library_category_id column to template_modules table
ALTER TABLE template_modules ADD COLUMN IF NOT EXISTS library_category_id VARCHAR REFERENCES library_categories(id);
