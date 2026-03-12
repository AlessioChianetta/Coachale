import { db } from "../db";
import { sql } from "drizzle-orm";

export async function cleanupSimoneStaleData(consultantId: string): Promise<{ deletedTasks: number; deletedMessages: number; deletedReasoning: number }> {
  const tasksResult = await db.execute(sql`
    DELETE FROM ai_scheduled_tasks
    WHERE ai_role = 'simone'
      AND status IN ('waiting_approval', 'draft')
      AND consultant_id = ${consultantId}
      AND created_at < NOW() - INTERVAL '24 hours'
  `);
  const deletedTasks = tasksResult.rowCount || 0;

  const messagesResult = await db.execute(sql`
    DELETE FROM agent_chat_messages
    WHERE ai_role = 'simone'
      AND consultant_id = ${consultantId}
      AND role = 'assistant'
      AND created_at < NOW() - INTERVAL '24 hours'
  `);
  const deletedMessages = messagesResult.rowCount || 0;

  let deletedReasoning = 0;
  try {
    const reasoningResult = await db.execute(sql`
      DELETE FROM ai_reasoning_logs
      WHERE role_id = 'simone'
        AND consultant_id = ${consultantId}
        AND created_at < NOW() - INTERVAL '24 hours'
    `);
    deletedReasoning = reasoningResult.rowCount || 0;
  } catch {}

  return { deletedTasks, deletedMessages, deletedReasoning };
}
