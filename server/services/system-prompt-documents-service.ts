import { db } from "../db";
import { sql } from "drizzle-orm";

function formatSystemDocsSection(docs: Array<{ title: string; content: string }>): string {
  if (docs.length === 0) return "";

  let result = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 ISTRUZIONI PERSONALIZZATE DEL CONSULENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (const doc of docs) {
    result += `\n--- ${doc.title} ---\n${doc.content}\n`;
  }

  return result;
}

function formatKnowledgeDocsSection(docs: Array<{ title: string; content: string }>): string {
  if (docs.length === 0) return "";

  let result = `\n📚 DOCUMENTI KNOWLEDGE BASE ASSEGNATI:\n`;

  for (const doc of docs) {
    result += `\n--- ${doc.title} ---\n${doc.content}\n`;
  }

  return result;
}

export async function fetchSystemDocumentsForClientAssistant(
  consultantId: string,
  clientInfo?: { clientId: string; isEmployee: boolean; departmentId: string | null }
): Promise<string> {
  try {
    const result = await db.execute(sql`
      SELECT title, content, target_client_mode, target_client_ids, target_department_ids
      FROM system_prompt_documents
      WHERE consultant_id = ${consultantId}
        AND is_active = true
        AND target_client_assistant = true
        AND injection_mode = 'system_prompt'
      ORDER BY priority DESC, created_at ASC
    `);

    const allRows = result.rows as Array<{
      title: string;
      content: string;
      target_client_mode: string | null;
      target_client_ids: string[] | null;
      target_department_ids: string[] | null;
    }>;

    const rows = clientInfo
      ? allRows.filter(doc => {
          const mode = doc.target_client_mode || 'all';
          if (mode === 'all') return true;
          if (mode === 'clients_only') return !clientInfo.isEmployee;
          if (mode === 'employees_only') return clientInfo.isEmployee;
          if (mode === 'specific_clients') {
            const ids = doc.target_client_ids || [];
            return ids.includes(clientInfo.clientId);
          }
          if (mode === 'specific_departments') {
            const deptIds = doc.target_department_ids || [];
            return clientInfo.departmentId ? deptIds.includes(clientInfo.departmentId) : false;
          }
          if (mode === 'specific_employees') {
            const ids = doc.target_client_ids || [];
            return clientInfo.isEmployee && ids.includes(clientInfo.clientId);
          }
          return true;
        })
      : allRows;

    console.log(`📌 [SYSTEM-DOCS] Fetched ${rows.length}/${allRows.length} system docs for client assistant of consultant ${consultantId}${clientInfo ? ` (client: ${clientInfo.clientId}, employee: ${clientInfo.isEmployee}, dept: ${clientInfo.departmentId})` : ''}`);

    if (rows.length === 0) return "";

    return formatSystemDocsSection(rows);
  } catch (error: any) {
    console.error(`❌ [SYSTEM-DOCS] Error fetching system docs for client assistant:`, error.message);
    return "";
  }
}

export async function fetchSystemDocumentsForAgent(consultantId: string, agentId: string): Promise<string> {
  try {
    const systemDocsResult = await db.execute(sql`
      SELECT title, content
      FROM system_prompt_documents
      WHERE consultant_id = ${consultantId}
        AND is_active = true
        AND target_autonomous_agents->>${agentId} = 'true'
        AND injection_mode = 'system_prompt'
      ORDER BY priority DESC, created_at ASC
    `);

    const systemRows = systemDocsResult.rows as Array<{ title: string; content: string }>;
    console.log(`📌 [SYSTEM-DOCS] Fetched ${systemRows.length} system docs for agent "${agentId}" of consultant ${consultantId}`);

    const kbResult = await db.execute(sql`
      SELECT d.title, COALESCE(d.extracted_content, d.content_summary, '') as content
      FROM agent_knowledge_assignments a
      JOIN consultant_knowledge_documents d ON d.id = a.document_id AND d.consultant_id = a.consultant_id
      WHERE a.consultant_id = ${consultantId}
        AND a.agent_id = ${agentId}
        AND d.status = 'indexed'
      ORDER BY d.created_at ASC
    `);

    const kbRows = kbResult.rows as Array<{ title: string; content: string }>;
    console.log(`📌 [SYSTEM-DOCS] Fetched ${kbRows.length} KB docs for agent "${agentId}" of consultant ${consultantId}`);

    if (systemRows.length === 0 && kbRows.length === 0) return "";

    let combined = "";
    if (systemRows.length > 0) {
      combined += formatSystemDocsSection(systemRows);
    }
    if (kbRows.length > 0) {
      combined += formatKnowledgeDocsSection(kbRows);
    }

    return combined;
  } catch (error: any) {
    console.error(`❌ [SYSTEM-DOCS] Error fetching docs for agent "${agentId}":`, error.message);
    return "";
  }
}

export async function fetchSystemDocumentsForWhatsApp(consultantId: string, whatsappAgentId?: string): Promise<string> {
  try {
    let result;
    if (whatsappAgentId) {
      result = await db.execute(sql`
        SELECT title, content
        FROM system_prompt_documents
        WHERE consultant_id = ${consultantId}
          AND is_active = true
          AND injection_mode = 'system_prompt'
          AND target_whatsapp_agents->>${whatsappAgentId} = 'true'
        ORDER BY priority DESC, created_at ASC
      `);
    } else {
      result = await db.execute(sql`
        SELECT title, content
        FROM system_prompt_documents
        WHERE consultant_id = ${consultantId}
          AND is_active = true
          AND injection_mode = 'system_prompt'
          AND target_whatsapp_agents != '{}'::jsonb
        ORDER BY priority DESC, created_at ASC
      `);
    }

    const rows = result.rows as Array<{ title: string; content: string }>;
    console.log(`📌 [SYSTEM-DOCS] Fetched ${rows.length} system docs for WhatsApp${whatsappAgentId ? ` agent "${whatsappAgentId}"` : ''} of consultant ${consultantId}`);

    if (rows.length === 0) return "";

    return formatSystemDocsSection(rows);
  } catch (error: any) {
    console.error(`❌ [SYSTEM-DOCS] Error fetching system docs for WhatsApp:`, error.message);
    return "";
  }
}

export async function fetchFileSearchDocumentIds(consultantId: string, target: 'client_assistant' | 'autonomous_agent' | 'whatsapp_agent', agentId?: string): Promise<Array<{ id: string; title: string; content: string }>> {
  try {
    let result;
    if (target === 'client_assistant') {
      result = await db.execute(sql`
        SELECT id, title, content
        FROM system_prompt_documents
        WHERE consultant_id = ${consultantId}
          AND is_active = true
          AND target_client_assistant = true
          AND injection_mode = 'file_search'
        ORDER BY priority DESC, created_at ASC
      `);
    } else if (target === 'autonomous_agent' && agentId) {
      result = await db.execute(sql`
        SELECT id, title, content
        FROM system_prompt_documents
        WHERE consultant_id = ${consultantId}
          AND is_active = true
          AND target_autonomous_agents->>${agentId} = 'true'
          AND injection_mode = 'file_search'
        ORDER BY priority DESC, created_at ASC
      `);
    } else if (target === 'whatsapp_agent' && agentId) {
      result = await db.execute(sql`
        SELECT id, title, content
        FROM system_prompt_documents
        WHERE consultant_id = ${consultantId}
          AND is_active = true
          AND target_whatsapp_agents->>${agentId} = 'true'
          AND injection_mode = 'file_search'
        ORDER BY priority DESC, created_at ASC
      `);
    } else {
      return [];
    }

    return result.rows as Array<{ id: string; title: string; content: string }>;
  } catch (error: any) {
    console.error(`❌ [SYSTEM-DOCS] Error fetching file_search docs for ${target}:`, error.message);
    return [];
  }
}
