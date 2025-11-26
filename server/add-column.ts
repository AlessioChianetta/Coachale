
import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function addIsPublicColumn() {
  try {
    console.log('Adding is_public column to exercises table...');
    
    // Add the column
    await db.execute(sql`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false`);
    
    // Update existing records
    await db.execute(sql`UPDATE exercises SET is_public = false WHERE is_public IS NULL`);
    
    console.log('Successfully added is_public column to exercises table');
  } catch (error) {
    console.error('Error adding is_public column:', error);
  }
}

addIsPublicColumn();
