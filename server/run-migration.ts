import DataMigrator from './migrate-data.js';
import path from 'path';

async function runMigration() {
  console.log('Current working directory:', process.cwd());
  console.log('Data directory should be at:', path.join(process.cwd(), '../data'));
  
  const migrator = new DataMigrator();
  await migrator.migrateAll();
}

runMigration().catch(console.error);