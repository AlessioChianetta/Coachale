/**
 * Migration Script: Auto-detect and create column mappings for existing datasets
 * Run with: npx tsx server/scripts/migrate-dataset-column-mappings.ts
 */

import { db } from "../db";
import { clientDataDatasets, datasetColumnMappings } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { autoDetectAllColumns } from "../ai/data-analysis/logical-columns";

async function migrateDatasetColumnMappings() {
  console.log("🔄 Starting dataset column mappings migration...\n");
  
  const datasets = await db
    .select()
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.status, "ready"));
  
  console.log(`📊 Found ${datasets.length} ready datasets to process\n`);
  
  let totalMapped = 0;
  let datasetsProcessed = 0;
  
  for (const dataset of datasets) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📁 Dataset ${dataset.id}: ${dataset.name}`);
    
    const existingMappings = await db
      .select()
      .from(datasetColumnMappings)
      .where(eq(datasetColumnMappings.datasetId, dataset.id));
    
    if (existingMappings.length > 0) {
      console.log(`   ⏭️  Already has ${existingMappings.length} mappings, skipping`);
      continue;
    }
    
    const columnMapping = dataset.columnMapping as Record<string, any>;
    if (!columnMapping) {
      console.log(`   ⚠️  No column mapping found, skipping`);
      continue;
    }
    
    const physicalColumns = Object.keys(columnMapping);
    console.log(`   📋 Physical columns: ${physicalColumns.join(", ")}`);
    
    const detectedMappings = autoDetectAllColumns(physicalColumns);
    
    if (detectedMappings.size === 0) {
      console.log(`   ❌ No logical columns detected`);
      continue;
    }
    
    console.log(`   ✅ Detected ${detectedMappings.size} logical columns:`);
    
    for (const [physical, detection] of detectedMappings) {
      console.log(`      ${detection.logicalColumn} → "${physical}" (confidence: ${(detection.confidence * 100).toFixed(0)}%)`);
      
      try {
        await db.insert(datasetColumnMappings).values({
          datasetId: dataset.id,
          logicalColumn: detection.logicalColumn,
          physicalColumn: physical,
          confidence: detection.confidence.toFixed(2),
          isConfirmed: detection.confidence >= 0.85,
        });
        totalMapped++;
      } catch (error: any) {
        if (error.code === "23505") {
          console.log(`      ⚠️  Mapping already exists, skipping`);
        } else {
          console.error(`      ❌ Error inserting mapping:`, error.message);
        }
      }
    }
    
    datasetsProcessed++;
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Migration complete!`);
  console.log(`   📊 Datasets processed: ${datasetsProcessed}`);
  console.log(`   🔗 Total mappings created: ${totalMapped}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

migrateDatasetColumnMappings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
