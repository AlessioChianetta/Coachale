import { db } from "../db";
import { whatsappPendingMessages, whatsappMessages, whatsappConversations } from "../../shared/schema";
import { and, isNull, sql, inArray } from "drizzle-orm";

const ZOMBIE_THRESHOLD_HOURS = 1;

export async function cleanupZombieMessages(dryRun: boolean = true): Promise<{
  found: number;
  cleaned: number;
  errors: number;
}> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧹 [ZOMBIE CLEANUP] Starting cleanup of stuck pending messages');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`⏰ Threshold: Messages pending for > ${ZOMBIE_THRESHOLD_HOURS} hour(s)`);
  console.log(`🔍 Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will mark as processed)'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const zombieThreshold = new Date(Date.now() - ZOMBIE_THRESHOLD_HOURS * 60 * 60 * 1000);

    const zombies = await db
      .select()
      .from(whatsappPendingMessages)
      .where(
        and(
          isNull(whatsappPendingMessages.processedAt),
          sql`${whatsappPendingMessages.receivedAt} < ${zombieThreshold}`
        )
      );

    console.log(`📊 [ZOMBIE CLEANUP] Found ${zombies.length} zombie message(s)`);

    if (zombies.length === 0) {
      console.log('✅ [ZOMBIE CLEANUP] No zombies found - system is healthy!\n');
      return { found: 0, cleaned: 0, errors: 0 };
    }

    let cleaned = 0;
    let errors = 0;

    for (const zombie of zombies) {
      try {
        const age = Math.round((Date.now() - zombie.receivedAt.getTime()) / (1000 * 60));
        console.log(`\n🧟 Zombie found:`);
        console.log(`   ID: ${zombie.id}`);
        console.log(`   Twilio SID: ${zombie.twilioSid || 'N/A'}`);
        console.log(`   Phone: ${zombie.phoneNumber}`);
        console.log(`   Age: ${age} minutes`);
        console.log(`   Text: ${zombie.messageText.substring(0, 50)}...`);

        if (dryRun) {
          console.log(`   ⚠️  [DRY RUN] Would mark as processed`);
          cleaned++;
        } else {
          const [conversation] = await db
            .select()
            .from(whatsappConversations)
            .where(sql`${whatsappConversations.id} = ${zombie.conversationId}`)
            .limit(1);

          if (conversation) {
            await db.insert(whatsappMessages).values({
              conversationId: conversation.id,
              messageText: zombie.messageText,
              direction: "inbound",
              sender: "client",
              twilioSid: zombie.twilioSid || undefined,
              mediaUrl: zombie.mediaUrl || undefined,
              mediaType: zombie.mediaType as any || "text",
              mediaContentType: zombie.mediaContentType || undefined,
              metadata: {
                ...zombie.metadata,
                zombieRecovery: true,
                zombieAge: age,
                recoveredAt: new Date().toISOString(),
              },
            })
            .onConflictDoNothing({ target: whatsappMessages.twilioSid });
          }

          await db
            .update(whatsappPendingMessages)
            .set({
              processedAt: new Date(),
              metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
                zombieCleanup: true,
                zombieAge: age,
                cleanedAt: new Date().toISOString(),
              })}::jsonb`
            })
            .where(sql`${whatsappPendingMessages.id} = ${zombie.id}`);

          console.log(`   ✅ Marked as processed and saved to conversation history`);
          cleaned++;
        }

      } catch (err) {
        console.error(`   ❌ Error processing zombie ${zombie.id}:`, err);
        errors++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [ZOMBIE CLEANUP] Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   🔍 Found: ${zombies.length}`);
    console.log(`   ✅ ${dryRun ? 'Would clean' : 'Cleaned'}: ${cleaned}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return { found: zombies.length, cleaned, errors };

  } catch (error) {
    console.error('❌ [ZOMBIE CLEANUP] Fatal error:', error);
    throw error;
  }
}

// ES module check - run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const dryRun = !process.argv.includes('--force');

  if (!dryRun) {
    console.log('⚠️  WARNING: Running in LIVE mode - messages will be marked as processed!');
    console.log('💡 Use without --force flag for dry run\n');
  }

  cleanupZombieMessages(dryRun)
    .then((result) => {
      if (dryRun && result.found > 0) {
        console.log('\n💡 To actually clean these zombies, run:');
        console.log('   npx tsx server/whatsapp/cleanup-zombie-messages.ts --force\n');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
