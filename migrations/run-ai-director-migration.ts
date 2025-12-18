// Run SQL migration directly
import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function runMigration() {
    console.log("🔄 Running AI Director fields migration...");

    try {
        await db.execute(sql`
      ALTER TABLE conversation_states 
      ADD COLUMN IF NOT EXISTS long_term_schedule_type TEXT,
      ADD COLUMN IF NOT EXISTS conversation_completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS completion_reason TEXT,
      ADD COLUMN IF NOT EXISTS silence_reason TEXT
    `);

        console.log("✅ Migration completed successfully!");
        console.log("Added columns: long_term_schedule_type, conversation_completed_at, completion_reason, silence_reason");

    } catch (error) {
        console.error("❌ Migration failed:", error);
    }

    process.exit(0);
}

runMigration();
