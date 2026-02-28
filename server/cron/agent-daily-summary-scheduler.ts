import cron from 'node-cron';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const ITALIAN_TIMEZONE = 'Europe/Rome';
let schedulerTask: cron.ScheduledTask | null = null;

export function initAgentDailySummaryScheduler() {
  if (schedulerTask) {
    console.log('[AGENT-DAILY-SUMMARY] Already initialized, skipping');
    return;
  }

  console.log('[AGENT-DAILY-SUMMARY] Initializing daily summary scheduler (23:55 Europe/Rome)');

  schedulerTask = cron.schedule('55 23 * * *', async () => {
    console.log(`[AGENT-DAILY-SUMMARY] Running daily summary generation...`);
    await generateDailySummariesForAllConsultants();
  }, {
    timezone: ITALIAN_TIMEZONE
  });

  console.log('[AGENT-DAILY-SUMMARY] Scheduled to run daily at 23:55 (Europe/Rome)');
}

export function stopAgentDailySummaryScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('[AGENT-DAILY-SUMMARY] Stopped');
  }
}

async function generateDailySummariesForAllConsultants() {
  const startTime = Date.now();
  let totalGenerated = 0;
  let totalSkipped = 0;
  let errors: string[] = [];

  try {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: ITALIAN_TIMEZONE });

    const consultantsWithMessages = await db.execute(sql`
      SELECT DISTINCT consultant_id, ai_role
      FROM agent_chat_messages
      WHERE DATE(created_at AT TIME ZONE 'Europe/Rome') = ${today}::date
    `);

    if (consultantsWithMessages.rows.length === 0) {
      console.log('[AGENT-DAILY-SUMMARY] No messages today, nothing to summarize');
      return;
    }

    console.log(`[AGENT-DAILY-SUMMARY] Found ${consultantsWithMessages.rows.length} consultant-role pairs with messages today`);

    const existingSummaries = await db.execute(sql`
      SELECT consultant_id, ai_role FROM agent_chat_daily_summaries
      WHERE summary_date = ${today}::date
    `);
    const existingSet = new Set(
      (existingSummaries.rows as any[]).map(r => `${r.consultant_id}:${r.ai_role}`)
    );

    const { GoogleGenAI } = await import("@google/genai");

    let aiClient: any = null;
    try {
      const { getSuperAdminGeminiKeys } = await import("../ai/provider-factory");
      const superAdminKeys = await getSuperAdminGeminiKeys();
      if (superAdminKeys?.enabled && superAdminKeys.keys.length > 0) {
        aiClient = new GoogleGenAI({ apiKey: superAdminKeys.keys[0] });
      }
    } catch (err: any) {
      console.warn('[AGENT-DAILY-SUMMARY] Could not get SuperAdmin keys:', err.message);
    }

    if (!aiClient) {
      try {
        const { getGeminiApiKeyForClassifier } = await import("../ai/provider-factory");
        const apiKey = await getGeminiApiKeyForClassifier();
        if (apiKey) {
          aiClient = new GoogleGenAI({ apiKey });
        }
      } catch {}
    }

    if (!aiClient) {
      console.error('[AGENT-DAILY-SUMMARY] No AI client available, aborting');
      return;
    }

    const AI_ROLE_NAMES: Record<string, string> = {
      alessia: 'Alessia', millie: 'Millie', echo: 'Echo', nova: 'Nova',
      stella: 'Stella', marco: 'Marco', personalizza: 'Personalizza',
    };

    for (const row of consultantsWithMessages.rows as any[]) {
      const { consultant_id, ai_role } = row;
      const key = `${consultant_id}:${ai_role}`;

      if (existingSet.has(key)) {
        totalSkipped++;
        continue;
      }

      try {
        const messagesResult = await db.execute(sql`
          SELECT sender, message, created_at FROM agent_chat_messages
          WHERE consultant_id = ${consultant_id}::uuid AND ai_role = ${ai_role}
            AND DATE(created_at AT TIME ZONE 'Europe/Rome') = ${today}::date
          ORDER BY created_at ASC
        `);

        const messages = messagesResult.rows as any[];
        if (messages.length < 2) {
          totalSkipped++;
          continue;
        }

        const roleName = AI_ROLE_NAMES[ai_role] || ai_role;
        const summaryInput = messages.map((m: any) =>
          `[${m.sender === 'consultant' ? 'Consulente' : roleName}] ${m.message}`
        ).join('\n\n');

        const summaryPrompt = `Riassumi questa conversazione del ${today} tra il consulente e ${roleName} in modo conciso ma completo. Mantieni:
- Decisioni prese
- Azioni concordate
- Aggiornamenti importanti
- Feedback e preferenze espresse dal consulente
- Task discussi e il loro stato
Scrivi il riassunto in italiano, in terza persona, max 300 parole.

CONVERSAZIONE DEL ${today}:
${summaryInput.substring(0, 15000)}`;

        const result = await aiClient.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
          config: { temperature: 0.3, maxOutputTokens: 600 },
        });

        const summaryText = result.text?.() || result.response?.text?.() || '';
        if (summaryText && summaryText.length > 30) {
          await db.execute(sql`
            INSERT INTO agent_chat_daily_summaries (consultant_id, ai_role, summary_date, summary_text, message_count)
            VALUES (${consultant_id}::uuid, ${ai_role}, ${today}::date, ${summaryText}, ${messages.length})
            ON CONFLICT (consultant_id, ai_role, summary_date) DO UPDATE SET
              summary_text = EXCLUDED.summary_text, message_count = EXCLUDED.message_count, updated_at = NOW()
          `);
          totalGenerated++;
          console.log(`[AGENT-DAILY-SUMMARY] ✅ ${ai_role} for ${consultant_id.substring(0, 8)}: ${messages.length} msgs summarized`);
        }
      } catch (err: any) {
        errors.push(`${ai_role}@${consultant_id.substring(0, 8)}: ${err.message}`);
        console.error(`[AGENT-DAILY-SUMMARY] ❌ Error for ${ai_role}:`, err.message);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[AGENT-DAILY-SUMMARY] Complete: ${totalGenerated} generated, ${totalSkipped} skipped, ${errors.length} errors (${(durationMs / 1000).toFixed(1)}s)`);
  } catch (err: any) {
    console.error('[AGENT-DAILY-SUMMARY] Fatal error:', err.message);
  }
}

export { generateDailySummariesForAllConsultants };
