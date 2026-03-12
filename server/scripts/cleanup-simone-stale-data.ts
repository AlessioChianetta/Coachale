import { db } from "../db";
import { sql } from "drizzle-orm";

export async function cleanupSimoneStaleData(consultantId?: string): Promise<{ deletedTasks: number; deletedMessages: number; deletedReasoning: number }> {
  const whereClause = consultantId
    ? sql`AND consultant_id = ${consultantId}`
    : sql``;

  const tasksResult = await db.execute(sql`
    DELETE FROM ai_scheduled_tasks
    WHERE ai_role = 'simone'
      AND status IN ('waiting_approval', 'draft')
      ${whereClause}
  `);
  const deletedTasks = tasksResult.rowCount || 0;

  const messagesResult = await db.execute(sql`
    DELETE FROM agent_chat_messages
    WHERE ai_role = 'simone'
      ${whereClause}
  `);
  const deletedMessages = messagesResult.rowCount || 0;

  let deletedReasoning = 0;
  try {
    const reasoningResult = await db.execute(sql`
      DELETE FROM ai_reasoning_logs
      WHERE role_id = 'simone'
        ${whereClause}
    `);
    deletedReasoning = reasoningResult.rowCount || 0;
  } catch {}

  return { deletedTasks, deletedMessages, deletedReasoning };
}
