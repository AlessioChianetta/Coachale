// Load environment variables first
import "../loadEnv.cjs";
import { FileSearchSyncService } from "../services/file-search-sync-service";

const CONSULTANT_ID = "0c73bbe5-51e1-4108-866b-6be7a52fce3b";

async function main() {
  console.log("🎓 Starting University Lessons Sync...");
  console.log(`Consultant ID: ${CONSULTANT_ID}`);
  
  try {
    const result = await FileSearchSyncService.syncAllUniversityLessons(CONSULTANT_ID);
    console.log("\n✅ Sync Complete!");
    console.log(`Total lessons: ${result.total}`);
    console.log(`Synced: ${result.synced}`);
    console.log(`Failed: ${result.failed}`);
    console.log(`Skipped: ${result.skipped}`);
    
    if (result.errors.length > 0) {
      console.log("\nErrors:");
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
  } catch (error) {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
