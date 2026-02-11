import { db } from "../db";
import { sql } from "drizzle-orm";
import { listEvents } from "../google-calendar-service";
import { FileSearchService } from "../ai/file-search-service";

function buildTaskMemorySection(recentAllTasks: any[], roleId: string): string {
  const myRoleTasks = recentAllTasks.filter(t => t.role === roleId);
  const otherRoleTasks = recentAllTasks.filter(t => t.role !== roleId);
  
  const pendingTasks = myRoleTasks.filter(t => ['scheduled', 'waiting_approval', 'approved'].includes(t.status));
  const cancelledTasks = myRoleTasks.filter(t => t.status === 'cancelled');
  const completedTasks = myRoleTasks.filter(t => t.status === 'completed');
  const failedTasks = myRoleTasks.filter(t => t.status === 'failed');

  let section = `\n⚠️ MEMORIA TASK (ULTIMI 7 GIORNI) - ANTI-DUPLICAZIONE:`;
  
  if (pendingTasks.length > 0) {
    section += `\n\nTASK GIÀ IN CODA (NON duplicare):`;
    section += `\n${JSON.stringify(pendingTasks.map(t => ({ contact: t.contact, category: t.category, instruction: t.instruction, status: t.status })), null, 2)}`;
  }
  
  if (cancelledTasks.length > 0) {
    section += `\n\nTASK RIFIUTATI/CANCELLATI DAL CONSULENTE (NON riproporre lo stesso tipo di task per lo stesso cliente):`;
    section += `\n${JSON.stringify(cancelledTasks.map(t => ({ contact: t.contact, category: t.category, instruction: t.instruction })), null, 2)}`;
  }
  
  if (completedTasks.length > 0) {
    section += `\n\nTASK GIÀ COMPLETATI (evita ripetizioni simili):`;
    section += `\n${JSON.stringify(completedTasks.map(t => ({ contact: t.contact, category: t.category, instruction: t.instruction })), null, 2)}`;
  }
  
  if (failedTasks.length > 0) {
    section += `\n\nTASK FALLITI (valuta se riprovare con approccio diverso):`;
    section += `\n${JSON.stringify(failedTasks.map(t => ({ contact: t.contact, category: t.category, instruction: t.instruction })), null, 2)}`;
  }
  
  if (otherRoleTasks.length > 0) {
    section += `\n\nTASK CREATI DA ALTRI RUOLI AI (per contesto, evita sovrapposizioni):`;
    section += `\n${JSON.stringify(otherRoleTasks.slice(0, 10).map(t => ({ contact: t.contact, role: t.role, category: t.category, status: t.status })), null, 2)}`;
  }
  
  if (recentAllTasks.length === 0) {
    section += `\nNessun task creato negli ultimi 7 giorni.`;
  }
  
  section += `\n\nREGOLA ANTI-DUPLICAZIONE: NON creare task identici o molto simili a quelli già in coda, completati o cancellati. Se un task è stato cancellato, il consulente non lo vuole - non riproporlo. Se un altro ruolo AI ha già un task per quel cliente, evita sovrapposizioni.\n`;
  
  return section;
}

export interface AIRoleDefinition {
  id: string;
  name: string;
  displayName: string;
  avatar: string;
  accentColor: string;
  description: string;
  shortDescription: string;
  categories: string[];
  preferredChannels: string[];
  typicalPlan: string[];
  maxTasksPerRun: number;
  buildPrompt: (params: {
    clientsList: any[];
    roleData: Record<string, any>;
    settings: any;
    romeTimeStr: string;
    recentCompletedTasks: any[];
    recentAllTasks: any[];
  }) => string;
  fetchRoleData: (consultantId: string, clientIds: string[]) => Promise<Record<string, any>>;
}

async function fetchAlessiaData(consultantId: string, clientIds: string[]): Promise<Record<string, any>> {
  if (clientIds.length === 0) return { consultations: [], voiceCalls: [] };

  const clientIdsStr = clientIds.map(id => `'${id}'`).join(',');

  const consultationsResult = await db.execute(sql`
    SELECT c.client_id, c.scheduled_at, c.duration, c.notes, c.status,
           c.summary_email, c.transcript,
           u.first_name || ' ' || u.last_name as client_name
    FROM consultations c
    JOIN users u ON u.id::text = c.client_id
    WHERE c.consultant_id = ${consultantId}
      AND c.status IN ('completed', 'scheduled')
    ORDER BY c.scheduled_at DESC
    LIMIT 50
  `);

  const voiceCallsResult = await db.execute(sql`
    SELECT svc.target_phone, svc.scheduled_at, svc.status, svc.duration_seconds,
           svc.call_instruction, svc.hangup_cause, svc.source_task_id
    FROM scheduled_voice_calls svc
    WHERE svc.consultant_id = ${consultantId}
      AND svc.status IN ('completed', 'failed', 'scheduled')
    ORDER BY svc.scheduled_at DESC
    LIMIT 30
  `);

  return {
    consultations: consultationsResult.rows,
    voiceCalls: voiceCallsResult.rows,
  };
}

async function fetchMillieData(consultantId: string, clientIds: string[]): Promise<Record<string, any>> {
  if (clientIds.length === 0) return { journeyProgress: [], emailLogs: [] };

  const journeyResult = await db.execute(sql`
    SELECT jp.client_id, jp.current_day, jp.last_email_sent_at,
           jp.last_email_subject, jp.last_email_body,
           u.first_name || ' ' || u.last_name as client_name
    FROM client_email_journey_progress jp
    JOIN users u ON u.id::text = jp.client_id
    WHERE jp.consultant_id = ${consultantId}
    ORDER BY jp.last_email_sent_at DESC NULLS LAST
    LIMIT 50
  `);

  const emailLogsResult = await db.execute(sql`
    SELECT ael.client_id, ael.sent_at, ael.subject, ael.email_type, ael.opened_at
    FROM automated_emails_log ael
    JOIN client_email_journey_progress jp ON jp.client_id = ael.client_id AND jp.consultant_id = ${consultantId}
    WHERE ael.sent_at > NOW() - INTERVAL '14 days'
    ORDER BY ael.sent_at DESC
    LIMIT 50
  `);

  return {
    journeyProgress: journeyResult.rows,
    emailLogs: emailLogsResult.rows,
  };
}

async function fetchEchoData(consultantId: string, clientIds: string[]): Promise<Record<string, any>> {
  if (clientIds.length === 0) return { unsummarizedConsultations: [], recentSummaries: [], pipelineStats: null };

  const unsummarizedResult = await db.execute(sql`
    SELECT c.id, c.client_id, c.scheduled_at, c.duration, c.notes, c.status,
           c.transcript, c.fathom_share_link,
           c.summary_email, c.summary_email_status,
           u.first_name || ' ' || u.last_name as client_name
    FROM consultations c
    JOIN users u ON u.id::text = c.client_id
    WHERE c.consultant_id = ${consultantId}
      AND c.status = 'completed'
      AND (c.summary_email IS NULL OR c.summary_email = '')
      AND c.scheduled_at > NOW() - INTERVAL '30 days'
    ORDER BY c.scheduled_at DESC
    LIMIT 20
  `);

  const recentSummariesResult = await db.execute(sql`
    SELECT c.id, c.client_id, c.scheduled_at, c.summary_email_status,
           c.summary_email_sent_at,
           u.first_name || ' ' || u.last_name as client_name
    FROM consultations c
    JOIN users u ON u.id::text = c.client_id
    WHERE c.consultant_id = ${consultantId}
      AND c.summary_email IS NOT NULL
      AND c.summary_email != ''
      AND c.scheduled_at > NOW() - INTERVAL '30 days'
    ORDER BY c.scheduled_at DESC
    LIMIT 10
  `);

  const pipelineStatsResult = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled_count,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed_total,
      COUNT(*) FILTER (WHERE status = 'completed' AND (transcript IS NULL OR transcript = '')) AS missing_transcript,
      COUNT(*) FILTER (WHERE status = 'completed' AND (fathom_share_link IS NULL OR fathom_share_link = '')) AS missing_fathom,
      COUNT(*) FILTER (WHERE status = 'completed' AND transcript IS NOT NULL AND transcript != '' AND (summary_email_status IS NULL OR summary_email_status = 'missing')) AS ready_for_email,
      COUNT(*) FILTER (WHERE status = 'completed' AND summary_email_status = 'draft') AS email_draft,
      COUNT(*) FILTER (WHERE status = 'completed' AND summary_email_status IN ('sent', 'approved', 'saved_for_ai')) AS email_sent
    FROM consultations
    WHERE consultant_id = ${consultantId}
      AND scheduled_at > NOW() - INTERVAL '60 days'
  `);

  return {
    unsummarizedConsultations: unsummarizedResult.rows,
    recentSummaries: recentSummariesResult.rows,
    pipelineStats: pipelineStatsResult.rows[0] || null,
  };
}

async function fetchNovaData(consultantId: string, clientIds: string[]): Promise<Record<string, any>> {
  const recentPostsResult = await db.execute(sql`
    SELECT cp.id, cp.title, cp.content_type, cp.platform, cp.status,
           cp.published_at, cp.scheduled_at, cp.created_at
    FROM content_posts cp
    WHERE cp.consultant_id = ${consultantId}
    ORDER BY cp.created_at DESC
    LIMIT 20
  `);

  const ideasResult = await db.execute(sql`
    SELECT ci.id, ci.title, ci.status, ci.content_type, ci.created_at
    FROM content_ideas ci
    WHERE ci.consultant_id = ${consultantId}
      AND ci.status = 'pending'
    ORDER BY ci.created_at DESC
    LIMIT 10
  `);

  return {
    recentPosts: recentPostsResult.rows,
    pendingIdeas: ideasResult.rows,
  };
}

async function fetchStellaData(consultantId: string, clientIds: string[]): Promise<Record<string, any>> {
  if (clientIds.length === 0) return { conversations: [], recentMessages: [] };

  const conversationsResult = await db.execute(sql`
    SELECT wc.id, wc.phone_number, wc.user_id, wc.last_message_at,
           wc.last_message_from, wc.is_lead, wc.message_count,
           wc.unread_by_consultant,
           u.first_name || ' ' || u.last_name as client_name
    FROM whatsapp_conversations wc
    LEFT JOIN users u ON u.id::text = wc.user_id::text
    WHERE wc.consultant_id = ${consultantId}
      AND wc.is_active = true
    ORDER BY wc.last_message_at DESC NULLS LAST
    LIMIT 30
  `);

  const recentMessagesResult = await db.execute(sql`
    SELECT wm.conversation_id, wm.message_text, wm.direction, wm.sender,
           wm.created_at, wc.phone_number
    FROM whatsapp_messages wm
    JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id
    WHERE wc.consultant_id = ${consultantId}
      AND wm.created_at > NOW() - INTERVAL '7 days'
    ORDER BY wm.created_at DESC
    LIMIT 50
  `);

  return {
    conversations: conversationsResult.rows,
    recentMessages: recentMessagesResult.rows,
  };
}

async function fetchIrisData(consultantId: string, clientIds: string[]): Promise<Record<string, any>> {
  const unansweredResult = await db.execute(sql`
    SELECT he.id, he.subject, he.from_name, he.from_email, he.snippet,
           he.direction, he.is_read, he.received_at, he.account_id
    FROM hub_emails he
    WHERE he.consultant_id = ${consultantId}
      AND he.direction = 'inbound'
      AND he.is_read = false
      AND he.received_at > NOW() - INTERVAL '7 days'
    ORDER BY he.received_at DESC
    LIMIT 20
  `);

  const ticketsResult = await db.execute(sql`
    SELECT et.id, et.status, et.priority, et.reason, et.reason_details,
           et.ai_classification, et.created_at, et.updated_at
    FROM email_tickets et
    WHERE et.consultant_id = ${consultantId}
      AND et.status IN ('open', 'pending')
    ORDER BY et.created_at DESC
    LIMIT 15
  `);

  return {
    unansweredEmails: unansweredResult.rows,
    openTickets: ticketsResult.rows,
  };
}

async function fetchMarcoData(consultantId: string, clientIds: string[]): Promise<Record<string, any>> {
  const upcomingResult = await db.execute(sql`
    SELECT c.id, c.client_id, c.scheduled_at, c.duration, c.notes, c.status,
           c.google_calendar_event_id,
           u.first_name || ' ' || u.last_name as client_name
    FROM consultations c
    JOIN users u ON u.id::text = c.client_id
    WHERE c.consultant_id = ${consultantId}
      AND c.status = 'scheduled'
      AND c.scheduled_at > NOW()
      AND c.scheduled_at < NOW() + INTERVAL '7 days'
    ORDER BY c.scheduled_at ASC
    LIMIT 20
  `);

  const dbConsultations = upcomingResult.rows.map((row: any) => ({
    ...row,
    source: 'database' as const,
  }));

  let mergedConsultations = [...dbConsultations];

  try {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const calendarEvents = await listEvents(consultantId, now, sevenDaysLater);

    if (calendarEvents && calendarEvents.length > 0) {
      const dbScheduledTimes = new Set(
        dbConsultations.map((c: any) => Math.floor(new Date(c.scheduled_at).getTime() / 60000))
      );

      const calendarOnlyEvents = calendarEvents.filter(event => {
        const eventTimeRounded = Math.floor(event.start.getTime() / 60000);
        return !dbScheduledTimes.has(eventTimeRounded);
      });

      const mappedCalendarEvents = calendarOnlyEvents.map((event, index) => {
        const durationMs = event.end.getTime() - event.start.getTime();
        const durationMinutes = Math.round(durationMs / 60000);

        return {
          id: `gcal_${index}_${event.start.getTime()}`,
          client_id: null,
          scheduled_at: event.start.toISOString(),
          duration: durationMinutes,
          notes: event.summary,
          status: 'scheduled',
          client_name: event.summary,
          source: 'google_calendar' as const,
        };
      });

      mergedConsultations = [...mergedConsultations, ...mappedCalendarEvents];
    }
  } catch (error: any) {
    console.log(`⚠️ [MARCO] Failed to fetch Google Calendar events for consultant ${consultantId}: ${error.message}`);
  }

  mergedConsultations.sort((a: any, b: any) => {
    const timeA = new Date(a.scheduled_at).getTime();
    const timeB = new Date(b.scheduled_at).getTime();
    return timeA - timeB;
  });

  const workloadResult = await db.execute(sql`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'completed' AND updated_at > NOW() - INTERVAL '30 days') as completed_30d,
      COUNT(*) FILTER (WHERE status = 'completed' AND updated_at > NOW() - INTERVAL '7 days') as completed_7d,
      COUNT(*) FILTER (WHERE status IN ('pending', 'scheduled')) as pending_tasks
    FROM ai_scheduled_tasks
    WHERE consultant_id = ${consultantId}
  `);

  const clientCountResult = await db.execute(sql`
    SELECT COUNT(*) as total_clients
    FROM users u
    WHERE u.consultant_id = ${consultantId}
      AND u.is_active = true
  `);

  const marcoContextResult = await db.execute(sql`
    SELECT marco_context FROM ai_autonomy_settings 
    WHERE consultant_id = ${consultantId} LIMIT 1
  `);
  const marcoContext = (marcoContextResult.rows[0] as any)?.marco_context || {};

  let kbDocumentTitles: string[] = [];
  let fileSearchStoreNames: string[] = [];
  const linkedIds = marcoContext.linkedKbDocumentIds || [];
  if (linkedIds.length > 0) {
    const kbResult = await db.execute(sql`
      SELECT title
      FROM consultant_knowledge_documents
      WHERE id = ANY(${linkedIds}::varchar[])
      AND consultant_id = ${consultantId}
      AND status = 'indexed'
    `);
    kbDocumentTitles = kbResult.rows.map((r: any) => r.title);

    try {
      const fileSearchService = new FileSearchService();
      fileSearchStoreNames = await fileSearchService.getConsultantOwnStores(consultantId);
    } catch (err: any) {
      console.error(`⚠️ [MARCO] Failed to get file search stores: ${err.message}`);
    }
  }

  const consultationMonitoringResult = await db.execute(sql`
    SELECT 
      u.id,
      u.email,
      u.first_name || ' ' || u.last_name as client_name,
      u.monthly_consultation_limit,
      COALESCE(c_direct.consultation_count, 0)::int as consultations_used
    FROM users u
    LEFT JOIN (
      SELECT client_id, COUNT(*)::int as consultation_count
      FROM consultations
      WHERE consultant_id = ${consultantId}
        AND client_id IS NOT NULL
        AND status IN ('completed', 'scheduled')
        AND scheduled_at >= date_trunc('month', NOW())
        AND scheduled_at < date_trunc('month', NOW()) + INTERVAL '1 month'
      GROUP BY client_id
    ) c_direct ON c_direct.client_id = u.id::text
    WHERE u.consultant_id = ${consultantId}
      AND u.is_active = true
      AND u.monthly_consultation_limit IS NOT NULL
    ORDER BY (u.monthly_consultation_limit - COALESCE(c_direct.consultation_count, 0)) ASC
  `);

  const schedulingGapsResult = await db.execute(sql`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', NOW()),
        date_trunc('month', NOW()) + INTERVAL '2 months',
        INTERVAL '1 month'
      ) as month_start
    )
    SELECT 
      u.id as client_id,
      u.email,
      u.first_name || ' ' || u.last_name as client_name,
      u.monthly_consultation_limit,
      u.phone_number,
      m.month_start,
      to_char(m.month_start, 'YYYY-MM') as month_label,
      to_char(m.month_start, 'TMMonth YYYY') as month_name,
      COALESCE(c_direct.cnt, 0)::int as scheduled_count
    FROM users u
    CROSS JOIN months m
    LEFT JOIN (
      SELECT client_id, date_trunc('month', scheduled_at) as month, COUNT(*)::int as cnt
      FROM consultations
      WHERE consultant_id = ${consultantId}
        AND client_id IS NOT NULL
        AND status IN ('scheduled', 'completed')
      GROUP BY client_id, date_trunc('month', scheduled_at)
    ) c_direct ON c_direct.client_id = u.id::text AND c_direct.month = m.month_start
    WHERE u.consultant_id = ${consultantId}
      AND u.is_active = true
      AND u.monthly_consultation_limit IS NOT NULL
    ORDER BY u.first_name, m.month_start
  `);

  // Enrich with Google Calendar events matched by attendee email (same logic as monitoring page)
  let calendarEventsForCounting: Array<{ start: Date; end: Date; summary: string; attendeeEmails: string[] }> = [];
  try {
    const calConnected = await (await import("../google-calendar-service")).isGoogleCalendarConnected(consultantId);
    if (calConnected) {
      const calStart = new Date();
      calStart.setDate(1); calStart.setHours(0, 0, 0, 0);
      const calEnd = new Date(calStart);
      calEnd.setMonth(calEnd.getMonth() + 3);
      calendarEventsForCounting = await listEvents(consultantId, calStart, calEnd);
    }
  } catch (err: any) {
    console.log(`⚠️ [MARCO] Failed to fetch calendar events for counting: ${err.message}`);
  }

  if (calendarEventsForCounting.length > 0) {
    const HIDDEN_EVENTS = ['INIZIO GIORNATA', 'PRANZO', 'FINE GIORNATA'];
    const clientCalEvents = calendarEventsForCounting.filter(
      e => !HIDDEN_EVENTS.includes(e.summary?.trim()) && e.attendeeEmails?.length > 0
    );

    // Build email -> client_id map from both result sets
    const emailToClientId: Record<string, string> = {};
    for (const row of consultationMonitoringResult.rows as any[]) {
      if (row.email) emailToClientId[row.email.toLowerCase()] = row.id;
    }

    // Get existing DB consultation dates to avoid double-counting
    const dbConsultationDates = await db.execute(sql`
      SELECT client_id, scheduled_at::date as sdate
      FROM consultations
      WHERE consultant_id = ${consultantId}
        AND client_id IS NOT NULL
        AND status IN ('completed', 'scheduled')
        AND scheduled_at >= date_trunc('month', NOW())
        AND scheduled_at < date_trunc('month', NOW()) + INTERVAL '3 months'
    `);
    const existingDates = new Set(
      (dbConsultationDates.rows as any[]).map(r => `${r.client_id}-${r.sdate}`)
    );

    // Count calendar events per client per month
    const calCountByClientMonth: Record<string, number> = {};
    const calCountByClientCurrentMonth: Record<string, number> = {};
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    for (const evt of clientCalEvents) {
      for (const email of evt.attendeeEmails) {
        const clientId = emailToClientId[email.toLowerCase()];
        if (!clientId) continue;
        const dateKey = `${clientId}-${evt.start.toISOString().split('T')[0]}`;
        if (existingDates.has(dateKey)) continue;
        existingDates.add(dateKey);

        // For schedulingGaps: month key
        const monthKey = `${clientId}-${evt.start.getFullYear()}-${evt.start.getMonth()}`;
        calCountByClientMonth[monthKey] = (calCountByClientMonth[monthKey] || 0) + 1;

        // For consultationMonitoring: current month only
        if (evt.start >= currentMonthStart && evt.start < currentMonthEnd) {
          calCountByClientCurrentMonth[clientId] = (calCountByClientCurrentMonth[clientId] || 0) + 1;
        }
      }
    }

    // Enrich consultationMonitoring rows
    for (const row of consultationMonitoringResult.rows as any[]) {
      const extra = calCountByClientCurrentMonth[row.id] || 0;
      if (extra > 0) {
        row.consultations_used = (parseInt(row.consultations_used) || 0) + extra;
      }
    }

    // Enrich schedulingGaps rows
    for (const row of schedulingGapsResult.rows as any[]) {
      const monthDate = new Date(row.month_start);
      const monthKey = `${row.client_id}-${monthDate.getFullYear()}-${monthDate.getMonth()}`;
      const extra = calCountByClientMonth[monthKey] || 0;
      if (extra > 0) {
        row.scheduled_count = (parseInt(row.scheduled_count) || 0) + extra;
      }
    }
  }

  return {
    upcomingConsultations: mergedConsultations,
    workload: workloadResult.rows[0] || {},
    clientCount: clientCountResult.rows[0]?.total_clients || 0,
    consultationMonitoring: consultationMonitoringResult.rows,
    schedulingGaps: schedulingGapsResult.rows,
    marcoContext,
    kbDocumentTitles,
    fileSearchStoreNames,
  };
}

async function fetchPersonalizzaData(consultantId: string, clientIds: string[]): Promise<Record<string, any>> {
  if (clientIds.length === 0) return { consultations: [], recentTasks: [] };

  const consultationsResult = await db.execute(sql`
    SELECT c.client_id, c.scheduled_at, c.duration, c.status,
           u.first_name || ' ' || u.last_name as client_name
    FROM consultations c
    JOIN users u ON u.id::text = c.client_id
    WHERE c.consultant_id = ${consultantId}
      AND c.scheduled_at > NOW() - INTERVAL '30 days'
    ORDER BY c.scheduled_at DESC
    LIMIT 30
  `);

  const recentTasksResult = await db.execute(sql`
    SELECT ast.id, ast.contact_name, ast.task_category, ast.status,
           ast.preferred_channel, ast.origin_type, ast.created_at
    FROM ai_scheduled_tasks ast
    WHERE ast.consultant_id = ${consultantId}
      AND ast.created_at > NOW() - INTERVAL '14 days'
    ORDER BY ast.created_at DESC
    LIMIT 20
  `);

  const configResult = await db.execute(sql`
    SELECT personalizza_config FROM ai_autonomy_settings 
    WHERE consultant_id = ${consultantId}::uuid LIMIT 1
  `);
  const personalizzaConfig = (configResult.rows[0] as any)?.personalizza_config || null;

  return {
    consultations: consultationsResult.rows,
    recentTasks: recentTasksResult.rows,
    personalizzaConfig,
  };
}

export const AI_ROLES: Record<string, AIRoleDefinition> = {
  alessia: {
    id: "alessia",
    name: "Alessia",
    displayName: "Alessia – Voice Consultant",
    avatar: "alessia",
    accentColor: "pink",
    description: "Analizza lo storico delle consulenze e delle chiamate per identificare clienti che hanno bisogno di un contatto vocale proattivo: follow-up, check-in, supporto post-consulenza.",
    shortDescription: "Chiamate AI proattive e follow-up vocale",
    categories: ["followup", "reminder"],
    preferredChannels: ["voice"],
    typicalPlan: ["fetch_client_data", "search_private_stores", "analyze_patterns", "prepare_call", "voice_call"],
    maxTasksPerRun: 2,
    fetchRoleData: fetchAlessiaData,
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks, recentAllTasks }) => {
      const consultationsSummary = (roleData.consultations || []).map((c: any) => ({
        client: c.client_name,
        client_id: c.client_id,
        date: c.scheduled_at,
        duration: c.duration,
        status: c.status,
        has_notes: !!c.notes,
        has_transcript: !!c.transcript,
        has_summary: !!c.summary_email,
        notes_preview: c.notes?.substring(0, 200) || null,
      }));

      const callsSummary = (roleData.voiceCalls || []).map((v: any) => ({
        phone: v.target_phone,
        date: v.scheduled_at,
        status: v.status,
        duration_sec: v.duration_seconds,
        instruction_preview: v.call_instruction?.substring(0, 150) || null,
      }));

      return `Sei ALESSIA, Voice Consultant AI. Il tuo ruolo è analizzare lo storico delle consulenze e delle chiamate per identificare clienti che hanno bisogno di un contatto vocale proattivo.

DATA/ORA ATTUALE: ${romeTimeStr}

IL TUO FOCUS: Chiamate di follow-up, check-in post-consulenza, supporto proattivo via telefono.

CLIENTI ATTIVI (che necessitano attenzione):
${JSON.stringify(clientsList, null, 2)}

STORICO CONSULENZE RECENTI:
${consultationsSummary.length > 0 ? JSON.stringify(consultationsSummary, null, 2) : 'Nessuna consulenza recente'}

STORICO CHIAMATE AI RECENTI:
${callsSummary.length > 0 ? JSON.stringify(callsSummary, null, 2) : 'Nessuna chiamata AI recente'}

${buildTaskMemorySection(recentAllTasks, 'alessia')}

ISTRUZIONI PERSONALIZZATE DEL CONSULENTE:
${settings.custom_instructions || 'Nessuna istruzione personalizzata'}

REGOLE DI ALESSIA:
1. Suggerisci MASSIMO 2 task di tipo chiamata vocale
2. Priorità di contatto:
   - Clienti con consulenza recente (ultimi 7 giorni) ma SENZA follow-up → check-in post-consulenza
   - Clienti che non sentono da >2 settimane → chiamata proattiva di supporto
   - Clienti con note che indicano difficoltà o dubbi → chiamata di supporto mirato
3. L'ai_instruction DEVE essere dettagliata e includere:
   - Cosa è stato discusso nell'ultima consulenza (se disponibile)
   - Punti specifici da toccare nella chiamata
   - Tono da usare (empatico, professionale, motivazionale)
   - Obiettivo specifico della chiamata
4. Il campo preferred_channel DEVE essere "voice"
5. Non suggerire chiamate a clienti già chiamati negli ultimi 3 giorni
6. Usa le categorie: followup, reminder

IMPORTANTE: Il campo "overall_reasoning" è OBBLIGATORIO. Devi SEMPRE spiegare il tuo ragionamento completo, anche se non suggerisci alcun task. Descrivi: cosa hai analizzato, quali dati hai valutato, quale conclusione hai raggiunto e perché.

Rispondi SOLO con JSON valido (senza markdown, senza backtick):
{
  "overall_reasoning": "Spiegazione dettagliata della tua analisi: quali dati hai valutato, quali clienti hai considerato, perché hai deciso di creare (o non creare) task. Se non crei task, spiega chiaramente il motivo (es: tutti i clienti sono già seguiti, nessuna urgenza, etc.)",
  "tasks": [
    {
      "contact_id": "uuid del cliente",
      "contact_name": "Nome del cliente",
      "contact_phone": "+39...",
      "ai_instruction": "Istruzione dettagliata per la chiamata...",
      "task_category": "followup|reminder",
      "priority": 3,
      "reasoning": "Motivazione basata sui dati analizzati",
      "preferred_channel": "voice",
      "urgency": "normale|oggi|settimana",
      "tone": "professionale|informale|empatico"
    }
  ]
}`;
    },
  },

  millie: {
    id: "millie",
    name: "Millie",
    displayName: "Millie – Email Writer",
    avatar: "millie",
    accentColor: "purple",
    description: "Analizza il journey email di ogni cliente e l'engagement (aperture, click) per identificare chi ha bisogno di un'email personalizzata per mantenere viva la relazione.",
    shortDescription: "Email personalizzate e nurturing relazionale",
    categories: ["outreach", "followup"],
    preferredChannels: ["email"],
    typicalPlan: ["fetch_client_data", "search_private_stores", "analyze_patterns", "generate_report", "send_email"],
    maxTasksPerRun: 2,
    fetchRoleData: fetchMillieData,
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks, recentAllTasks }) => {
      const journeySummary = (roleData.journeyProgress || []).map((jp: any) => ({
        client: jp.client_name,
        client_id: jp.client_id,
        journey_day: jp.current_day,
        last_email_sent: jp.last_email_sent_at,
        last_subject: jp.last_email_subject?.substring(0, 100),
      }));

      const emailLogSummary = (roleData.emailLogs || []).slice(0, 20).map((el: any) => ({
        client_id: el.client_id,
        sent_at: el.sent_at,
        subject: el.subject?.substring(0, 80),
        email_type: el.email_type,
        opened: !!el.opened_at,
      }));

      return `Sei MILLIE, Email Writer AI. Il tuo ruolo è analizzare il journey email e l'engagement di ogni cliente per creare email personalizzate che mantengano viva la relazione.

DATA/ORA ATTUALE: ${romeTimeStr}

IL TUO FOCUS: Email personalizzate, nurturing relazionale, contenuti di valore via email.

CLIENTI ATTIVI:
${JSON.stringify(clientsList, null, 2)}

PROGRESSO JOURNEY EMAIL:
${journeySummary.length > 0 ? JSON.stringify(journeySummary, null, 2) : 'Nessun journey email attivo'}

LOG EMAIL RECENTI (ultimi 14 giorni):
${emailLogSummary.length > 0 ? JSON.stringify(emailLogSummary, null, 2) : 'Nessuna email inviata di recente'}

${buildTaskMemorySection(recentAllTasks, 'millie')}

ISTRUZIONI PERSONALIZZATE:
${settings.custom_instructions || 'Nessuna'}

REGOLE DI MILLIE:
1. Suggerisci MASSIMO 2 task di tipo email
2. Priorità:
   - Clienti senza email negli ultimi 7 giorni → email di check-in
   - Clienti con journey fermo (nessuna email recente) → riattivazione
   - Clienti che hanno aperto email recenti → follow-up con contenuto di valore
3. L'ai_instruction DEVE includere:
   - Argomento specifico dell'email basato sul contesto del cliente
   - Tipo di email (check-in, contenuto educativo, motivazionale, aggiornamento)
   - Tono da usare
   - Punti chiave da coprire
4. Il campo preferred_channel DEVE essere "email"
5. Usa le categorie: outreach, followup

IMPORTANTE: Il campo "overall_reasoning" è OBBLIGATORIO. Devi SEMPRE spiegare il tuo ragionamento completo, anche se non suggerisci alcun task. Descrivi: cosa hai analizzato, quali dati hai valutato, quale conclusione hai raggiunto e perché.

Rispondi SOLO con JSON valido (senza markdown, senza backtick):
{
  "overall_reasoning": "Spiegazione dettagliata della tua analisi: quali dati hai valutato, quali clienti hai considerato, perché hai deciso di creare (o non creare) task. Se non crei task, spiega chiaramente il motivo (es: tutti i clienti sono già seguiti, nessuna urgenza, etc.)",
  "tasks": [
    {
      "contact_id": "uuid",
      "contact_name": "Nome",
      "contact_phone": "+39...",
      "ai_instruction": "Istruzione dettagliata...",
      "task_category": "outreach|followup",
      "priority": 3,
      "reasoning": "Motivazione basata sui dati",
      "preferred_channel": "email",
      "urgency": "normale|oggi|settimana",
      "tone": "professionale|informale|empatico"
    }
  ]
}`;
    },
  },

  echo: {
    id: "echo",
    name: "Echo",
    displayName: "Echo – Summarizer",
    avatar: "echo",
    accentColor: "orange",
    description: "Identifica consulenze completate che non hanno ancora un riepilogo strutturato e crea task per generarli e inviarli al cliente.",
    shortDescription: "Riepiloghi consulenze e report post-sessione",
    categories: ["analysis"],
    preferredChannels: ["email"],
    typicalPlan: ["fetch_client_data", "search_private_stores", "analyze_patterns", "generate_report", "send_email"],
    maxTasksPerRun: 2,
    fetchRoleData: fetchEchoData,
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks, recentAllTasks }) => {
      const unsummarized = (roleData.unsummarizedConsultations || []).map((c: any) => ({
        consultation_id: c.id,
        client: c.client_name,
        client_id: c.client_id,
        date: c.scheduled_at,
        duration: c.duration,
        has_notes: !!c.notes,
        has_transcript: !!c.transcript,
        has_fathom: !!c.fathom_share_link,
        notes_preview: c.notes?.substring(0, 300) || null,
      }));

      const summarized = (roleData.recentSummaries || []).map((c: any) => ({
        client: c.client_name,
        date: c.scheduled_at,
        status: c.summary_email_status,
        sent_at: c.summary_email_sent_at,
      }));

      const stats = roleData.pipelineStats;
      const pipelineSection = stats ? `
STATO PIPELINE CONSULENZE (ultimi 60 giorni):
- Consulenze programmate (in attesa): ${stats.scheduled_count}
- Consulenze completate (totale): ${stats.completed_total}
- Completate SENZA trascrizione/riassunto: ${stats.missing_transcript} ${Number(stats.missing_transcript) > 0 ? '⚠️ ATTENZIONE' : '✅'}
- Completate SENZA registrazione Fathom: ${stats.missing_fathom}
- Pronte per generare email (hanno riassunto ma non email): ${stats.ready_for_email} ${Number(stats.ready_for_email) > 0 ? '⚠️ DA GESTIRE' : '✅'}
- Email in bozza (da inviare): ${stats.email_draft} ${Number(stats.email_draft) > 0 ? '⚠️ BOZZE IN ATTESA' : '✅'}
- Email inviate/completate: ${stats.email_sent} ✅` : '';

      return `Sei ECHO, Summarizer AI. Il tuo ruolo è identificare consulenze completate che necessitano di un riepilogo strutturato e generare report professionali post-sessione. Monitori anche lo stato complessivo della pipeline consulenze per segnalare colli di bottiglia.

DATA/ORA ATTUALE: ${romeTimeStr}

IL TUO FOCUS: Riepiloghi consulenze, report post-sessione, documentazione professionale, monitoraggio pipeline.
${pipelineSection}

CLIENTI ATTIVI:
${JSON.stringify(clientsList, null, 2)}

CONSULENZE SENZA RIEPILOGO (da elaborare):
${unsummarized.length > 0 ? JSON.stringify(unsummarized, null, 2) : 'Tutte le consulenze hanno già un riepilogo!'}

RIEPILOGHI GIÀ GENERATI (ultimi 30 giorni):
${summarized.length > 0 ? JSON.stringify(summarized, null, 2) : 'Nessuno'}

${buildTaskMemorySection(recentAllTasks, 'echo')}

ISTRUZIONI PERSONALIZZATE:
${settings.custom_instructions || 'Nessuna'}

REGOLE DI ECHO:
1. Suggerisci MASSIMO 2 task per riepiloghi
2. Priorità:
   - Consulenze con trascrizione/note ma senza riepilogo → URGENTE
   - Consulenze recenti (ultimi 7 giorni) senza riepilogo → alta priorità
   - Consulenze più vecchie senza riepilogo → media priorità
   - Consulenze pronte per email (hanno riassunto ma email mancante) → alta priorità
   - Bozze email non inviate → segnala nel reasoning
3. L'ai_instruction DEVE includere:
   - ID della consulenza da riepilogare
   - Contesto disponibile (note, trascrizione, Fathom)
   - Formato del riepilogo desiderato
   - Se inviare automaticamente al cliente via email
4. Preferred_channel: "email" (invio riepilogo al cliente)
5. Se NON ci sono consulenze da riepilogare, restituisci tasks vuoto
6. Usa la categoria: analysis

IMPORTANTE: Il campo "overall_reasoning" è OBBLIGATORIO. Devi SEMPRE spiegare il tuo ragionamento completo, anche se non suggerisci alcun task. Descrivi: cosa hai analizzato, quali dati hai valutato, quale conclusione hai raggiunto e perché.

Rispondi SOLO con JSON valido (senza markdown, senza backtick):
{
  "overall_reasoning": "Spiegazione dettagliata della tua analisi: quali dati hai valutato, quali clienti hai considerato, perché hai deciso di creare (o non creare) task. Se non crei task, spiega chiaramente il motivo (es: tutti i clienti sono già seguiti, nessuna urgenza, etc.)",
  "tasks": [
    {
      "contact_id": "uuid",
      "contact_name": "Nome",
      "contact_phone": "+39...",
      "ai_instruction": "Genera riepilogo per consulenza ID:... del giorno... Note disponibili: ... Trascrizione: si/no...",
      "task_category": "analysis",
      "priority": 2,
      "reasoning": "Motivazione",
      "preferred_channel": "email",
      "urgency": "normale|oggi|settimana",
      "tone": "professionale"
    }
  ]
}`;
    },
  },

  nova: {
    id: "nova",
    name: "Nova",
    displayName: "Nova – Social Media Manager",
    avatar: "nova",
    accentColor: "pink",
    description: "Analizza il calendario contenuti, identifica gap nella pubblicazione e suggerisce nuovi contenuti da creare per mantenere la presenza social attiva.",
    shortDescription: "Contenuti social e calendario editoriale",
    categories: ["analysis", "outreach"],
    preferredChannels: ["none"],
    typicalPlan: ["fetch_client_data", "web_search", "analyze_patterns", "generate_report"],
    maxTasksPerRun: 1,
    fetchRoleData: fetchNovaData,
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks, recentAllTasks }) => {
      const postsSummary = (roleData.recentPosts || []).map((p: any) => ({
        title: p.title?.substring(0, 80),
        type: p.content_type,
        platform: p.platform,
        status: p.status,
        published: p.published_at,
        scheduled: p.scheduled_at,
      }));

      const ideasSummary = (roleData.pendingIdeas || []).map((i: any) => ({
        title: i.title?.substring(0, 80),
        type: i.content_type,
        created: i.created_at,
      }));

      return `Sei NOVA, Social Media Manager AI. Il tuo ruolo è analizzare il calendario contenuti del consulente e suggerire nuove idee e post da creare per mantenere la presenza social forte e costante.

DATA/ORA ATTUALE: ${romeTimeStr}

IL TUO FOCUS: Strategia contenuti, calendario editoriale, idee post, analisi trend.

NOTA: Non lavori sui singoli clienti ma sull'immagine del consulente. Analizza il calendario e suggerisci contenuti.

POST RECENTI:
${postsSummary.length > 0 ? JSON.stringify(postsSummary, null, 2) : 'Nessun post recente'}

IDEE PENDENTI:
${ideasSummary.length > 0 ? JSON.stringify(ideasSummary, null, 2) : 'Nessuna idea pendente'}

${buildTaskMemorySection(recentAllTasks, 'nova')}

ISTRUZIONI PERSONALIZZATE:
${settings.custom_instructions || 'Nessuna'}

REGOLE DI NOVA:
1. Suggerisci MASSIMO 1 task
2. Il task deve riguardare la creazione di contenuti per il brand del consulente, NON per singoli clienti
3. Per contact_id e contact_name, usa i dati del consulente stesso (se disponibili) o lascia null
4. Priorità:
   - Nessun post negli ultimi 5 giorni → suggerisci contenuto urgente
   - Gap nel calendario → suggerisci pianificazione
   - Trend rilevante nel settore → suggerisci post tempestivo
5. L'ai_instruction DEVE includere:
   - Tipo di contenuto (post, carosello, reel idea, articolo)
   - Piattaforme target
   - Tema/argomento specifico
   - Hook e CTA suggeriti
6. Usa le categorie: analysis, outreach

IMPORTANTE: Il campo "overall_reasoning" è OBBLIGATORIO. Devi SEMPRE spiegare il tuo ragionamento completo, anche se non suggerisci alcun task. Descrivi: cosa hai analizzato, quali dati hai valutato, quale conclusione hai raggiunto e perché.

Rispondi SOLO con JSON valido (senza markdown, senza backtick):
{
  "overall_reasoning": "Spiegazione dettagliata della tua analisi: quali dati hai valutato, quali clienti hai considerato, perché hai deciso di creare (o non creare) task. Se non crei task, spiega chiaramente il motivo (es: tutti i clienti sono già seguiti, nessuna urgenza, etc.)",
  "tasks": [
    {
      "contact_id": null,
      "contact_name": "Content Strategy",
      "contact_phone": "N/A",
      "ai_instruction": "Istruzione dettagliata...",
      "task_category": "analysis|outreach",
      "priority": 3,
      "reasoning": "Motivazione",
      "preferred_channel": "none",
      "urgency": "normale|oggi|settimana",
      "tone": "professionale"
    }
  ]
}`;
    },
  },

  stella: {
    id: "stella",
    name: "Stella",
    displayName: "Stella – WhatsApp Assistant",
    avatar: "stella",
    accentColor: "emerald",
    description: "Analizza le conversazioni WhatsApp per identificare lead non qualificati, clienti che aspettano risposta, e opportunità di follow-up via messaggio.",
    shortDescription: "Follow-up WhatsApp e qualificazione lead",
    categories: ["outreach", "followup"],
    preferredChannels: ["whatsapp"],
    typicalPlan: ["fetch_client_data", "analyze_patterns", "send_whatsapp"],
    maxTasksPerRun: 2,
    fetchRoleData: fetchStellaData,
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks, recentAllTasks }) => {
      const convSummary = (roleData.conversations || []).slice(0, 15).map((c: any) => ({
        client: c.client_name || c.phone_number,
        phone: c.phone_number,
        user_id: c.user_id,
        last_message: c.last_message_at,
        last_from: c.last_message_from,
        is_lead: c.is_lead,
        messages: c.message_count,
        unread: c.unread_by_consultant,
      }));

      const msgSummary = (roleData.recentMessages || []).slice(0, 20).map((m: any) => ({
        phone: m.phone_number,
        text: m.message_text?.substring(0, 150),
        direction: m.direction,
        sender: m.sender,
        date: m.created_at,
      }));

      return `Sei STELLA, WhatsApp Assistant AI. Il tuo ruolo è analizzare le conversazioni WhatsApp per identificare opportunità di follow-up, lead da qualificare e clienti che aspettano risposta.

DATA/ORA ATTUALE: ${romeTimeStr}

IL TUO FOCUS: Messaggi WhatsApp proattivi, qualificazione lead, follow-up conversazioni.

CLIENTI ATTIVI:
${JSON.stringify(clientsList, null, 2)}

CONVERSAZIONI WHATSAPP ATTIVE:
${convSummary.length > 0 ? JSON.stringify(convSummary, null, 2) : 'Nessuna conversazione attiva'}

MESSAGGI RECENTI (ultimi 7 giorni):
${msgSummary.length > 0 ? JSON.stringify(msgSummary, null, 2) : 'Nessun messaggio recente'}

${buildTaskMemorySection(recentAllTasks, 'stella')}

ISTRUZIONI PERSONALIZZATE:
${settings.custom_instructions || 'Nessuna'}

REGOLE DI STELLA:
1. Suggerisci MASSIMO 2 task WhatsApp
2. Priorità:
   - Conversazioni con messaggi non letti dal consulente → risposta urgente
   - Lead non qualificati con messaggi recenti → qualificazione
   - Clienti senza messaggi da >5 giorni → check-in via WhatsApp
3. L'ai_instruction DEVE includere:
   - Contesto dell'ultima conversazione
   - Tipo di messaggio da inviare (saluto, follow-up, info, promemoria)
   - Punti chiave da comunicare
   - Tono appropriato
4. Il campo preferred_channel DEVE essere "whatsapp"
5. Usa le categorie: outreach, followup

IMPORTANTE: Il campo "overall_reasoning" è OBBLIGATORIO. Devi SEMPRE spiegare il tuo ragionamento completo, anche se non suggerisci alcun task. Descrivi: cosa hai analizzato, quali dati hai valutato, quale conclusione hai raggiunto e perché.

Rispondi SOLO con JSON valido (senza markdown, senza backtick):
{
  "overall_reasoning": "Spiegazione dettagliata della tua analisi: quali dati hai valutato, quali clienti hai considerato, perché hai deciso di creare (o non creare) task. Se non crei task, spiega chiaramente il motivo (es: tutti i clienti sono già seguiti, nessuna urgenza, etc.)",
  "tasks": [
    {
      "contact_id": "uuid",
      "contact_name": "Nome",
      "contact_phone": "+39...",
      "ai_instruction": "Istruzione dettagliata...",
      "task_category": "outreach|followup",
      "priority": 3,
      "reasoning": "Motivazione",
      "preferred_channel": "whatsapp",
      "urgency": "normale|oggi|settimana",
      "tone": "professionale|informale|empatico"
    }
  ]
}`;
    },
  },

  iris: {
    id: "iris",
    name: "Iris",
    displayName: "Iris – Email Hub Manager",
    avatar: "iris",
    accentColor: "teal",
    description: "Monitora le email in arrivo e i ticket aperti per identificare comunicazioni che richiedono attenzione, risposte AI o escalation al consulente.",
    shortDescription: "Gestione email in arrivo e ticket",
    categories: ["reminder", "followup"],
    preferredChannels: ["email"],
    typicalPlan: ["fetch_client_data", "analyze_patterns", "send_email"],
    maxTasksPerRun: 2,
    fetchRoleData: fetchIrisData,
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks, recentAllTasks }) => {
      const emailSummary = (roleData.unansweredEmails || []).map((e: any) => ({
        from: e.from_name || e.from_email,
        email: e.from_email,
        subject: e.subject?.substring(0, 100),
        snippet: e.snippet?.substring(0, 200),
        received: e.received_at,
        is_read: e.is_read,
      }));

      const ticketSummary = (roleData.openTickets || []).map((t: any) => ({
        reason: t.reason || 'N/A',
        details: t.reason_details?.substring(0, 100) || null,
        status: t.status,
        priority: t.priority,
        classification: t.ai_classification,
        created: t.created_at,
      }));

      return `Sei IRIS, Email Hub Manager AI. Il tuo ruolo è monitorare le email in arrivo e i ticket aperti per assicurare che nessuna comunicazione importante venga ignorata.

DATA/ORA ATTUALE: ${romeTimeStr}

IL TUO FOCUS: Email senza risposta, ticket aperti, comunicazioni urgenti.

EMAIL NON LETTE (ultimi 7 giorni):
${emailSummary.length > 0 ? JSON.stringify(emailSummary, null, 2) : 'Nessuna email non letta'}

TICKET APERTI:
${ticketSummary.length > 0 ? JSON.stringify(ticketSummary, null, 2) : 'Nessun ticket aperto'}

${buildTaskMemorySection(recentAllTasks, 'iris')}

ISTRUZIONI PERSONALIZZATE:
${settings.custom_instructions || 'Nessuna'}

REGOLE DI IRIS:
1. Suggerisci MASSIMO 2 task
2. Priorità:
   - Email da clienti attivi senza risposta da >24h → urgente
   - Ticket aperti con priorità alta → alta priorità
   - Email da lead/prospect → media priorità
3. L'ai_instruction DEVE includere:
   - Chi ha scritto e quando
   - Oggetto e sintesi dell'email
   - Tipo di risposta suggerita (risposta diretta, escalation, follow-up)
   - Punti chiave da includere nella risposta
4. Il campo preferred_channel DEVE essere "email"
5. Se non ci sono email/ticket da gestire, restituisci tasks vuoto
6. Usa le categorie: reminder, followup

IMPORTANTE: Il campo "overall_reasoning" è OBBLIGATORIO. Devi SEMPRE spiegare il tuo ragionamento completo, anche se non suggerisci alcun task. Descrivi: cosa hai analizzato, quali dati hai valutato, quale conclusione hai raggiunto e perché.

Rispondi SOLO con JSON valido (senza markdown, senza backtick):
{
  "overall_reasoning": "Spiegazione dettagliata della tua analisi: quali dati hai valutato, quali clienti hai considerato, perché hai deciso di creare (o non creare) task. Se non crei task, spiega chiaramente il motivo (es: tutti i clienti sono già seguiti, nessuna urgenza, etc.)",
  "tasks": [
    {
      "contact_id": "uuid o null",
      "contact_name": "Nome mittente",
      "contact_phone": "N/A",
      "ai_instruction": "Istruzione dettagliata...",
      "task_category": "reminder|followup",
      "priority": 2,
      "reasoning": "Motivazione",
      "preferred_channel": "email",
      "urgency": "normale|oggi|settimana",
      "tone": "professionale"
    }
  ]
}`;
    },
  },

  marco: {
    id: "marco",
    name: "Marco",
    displayName: "Marco – Executive Coach",
    avatar: "marco",
    accentColor: "indigo",
    description: "Analizza la tua agenda, il carico di lavoro e le performance per aiutarti a organizzare meglio la giornata e prepararti agli incontri.",
    shortDescription: "Coaching operativo e organizzazione consulente",
    categories: ["preparation", "monitoring", "report", "scheduling"],
    preferredChannels: ["voice", "none"],
    typicalPlan: ["fetch_client_data", "analyze_patterns", "generate_report"],
    maxTasksPerRun: 2,
    fetchRoleData: fetchMarcoData,
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks, recentAllTasks }) => {
      const upcomingSummary = (roleData.upcomingConsultations || []).map((c: any) => ({
        consultation_id: c.id,
        client: c.client_name,
        client_id: c.client_id,
        date: c.scheduled_at,
        duration: c.duration,
        status: c.status,
        has_notes: !!c.notes,
        notes_preview: c.notes?.substring(0, 200) || null,
      }));

      const workload = roleData.workload || {};
      const clientCount = roleData.clientCount || 0;

      const monitoringSummary = (roleData.consultationMonitoring || []).map((m: any) => {
        const limit = m.monthly_consultation_limit;
        const used = m.consultations_used;
        const remaining = Math.max(0, limit - used);
        const percentUsed = Math.round((used / limit) * 100);
        return {
          client: m.client_name,
          client_id: m.id,
          limite_mensile: limit,
          usate_questo_mese: used,
          rimanenti: remaining,
          percentuale_usata: `${percentUsed}%`,
          stato: remaining === 0 ? 'ESAURITO' : percentUsed >= 75 ? 'QUASI_ESAURITO' : 'OK',
        };
      });

      const schedulingGaps = (roleData.schedulingGaps || []);
      const clientSchedulingMap: Record<string, any> = {};
      for (const gap of schedulingGaps) {
        if (!clientSchedulingMap[gap.client_id]) {
          clientSchedulingMap[gap.client_id] = {
            client: gap.client_name,
            client_id: gap.client_id,
            phone: gap.phone_number,
            limite_mensile: gap.monthly_consultation_limit,
            mesi: [],
          };
        }
        const missing = Math.max(0, gap.monthly_consultation_limit - gap.scheduled_count);
        clientSchedulingMap[gap.client_id].mesi.push({
          mese: gap.month_name,
          programmate: gap.scheduled_count,
          mancanti: missing,
          stato: missing === 0 ? 'COMPLETO' : missing === gap.monthly_consultation_limit ? 'NESSUNA_PROGRAMMATA' : 'PARZIALE',
        });
      }

      const clientsNeedingScheduling = Object.values(clientSchedulingMap).filter((c: any) => 
        c.mesi.some((m: any) => m.mancanti > 0)
      );

      return `Sei MARCO, Executive Coach AI. Il tuo ruolo è analizzare l'agenda, il carico di lavoro e le performance del consulente per aiutarlo a organizzare meglio la giornata e prepararsi agli incontri.

DATA/ORA ATTUALE: ${romeTimeStr}

IL TUO FOCUS: Organizzazione agenda, preparazione consulenze, monitoraggio carico di lavoro, coaching operativo per il CONSULENTE (non per i clienti).

CONSULENZE IN PROGRAMMA (prossimi 7 giorni):
${upcomingSummary.length > 0 ? JSON.stringify(upcomingSummary, null, 2) : 'Nessuna consulenza programmata nei prossimi 7 giorni'}

METRICHE CARICO DI LAVORO:
- Task completati ultimi 30 giorni: ${workload.completed_30d || 0}
- Task completati ultimi 7 giorni: ${workload.completed_7d || 0}
- Task pendenti/programmati: ${workload.pending_tasks || 0}
- Clienti attivi totali: ${clientCount}

MONITORAGGIO CONSULENZE LIMITATE:
${monitoringSummary.length > 0 ? JSON.stringify(monitoringSummary, null, 2) : 'Nessun cliente con pacchetto consulenze limitato'}

SCHEDULAZIONE CONSULENZE FUTURE (prossimi 3 mesi):
${clientsNeedingScheduling.length > 0 ? JSON.stringify(clientsNeedingScheduling, null, 2) : 'Tutti i clienti con pacchetti hanno consulenze programmate per i prossimi mesi'}

${buildTaskMemorySection(recentAllTasks, 'marco')}

CLIENTI ATTIVI:
${JSON.stringify(clientsList, null, 2)}

ISTRUZIONI PERSONALIZZATE DEL CONSULENTE:
${settings.custom_instructions || 'Nessuna istruzione personalizzata'}

OBIETTIVI STRATEGICI DEL CONSULENTE:
${(() => {
  const objectives = roleData.marcoContext?.objectives || [];
  if (objectives.length === 0) return 'Nessun obiettivo definito';
  return objectives.map((obj: any, i: number) => `${i + 1}. ${obj.text || obj}${obj.completed ? ' ✅ COMPLETATO' : ''}`).join('\n');
})()}

ROADMAP E NOTE STRATEGICHE:
${roleData.marcoContext?.roadmap || 'Nessuna roadmap definita'}

DOCUMENTI DI RIFERIMENTO (dalla Knowledge Base):
${(() => {
  const titles = roleData.kbDocumentTitles || [];
  if (titles.length === 0) return 'Nessun documento collegato';
  return titles.map((t: string, i: number) => `${i + 1}. 📄 ${t}`).join('\n');
})()}
I contenuti di questi documenti sono disponibili tramite il sistema File Search. Usa le informazioni recuperate per contestualizzare la tua analisi.

STILE REPORT PREFERITO: ${roleData.marcoContext?.reportStyle || 'bilanciato'}
${roleData.marcoContext?.reportFocus ? `FOCUS REPORT: ${roleData.marcoContext.reportFocus}` : ''}

REGOLE DI MARCO:
1. Suggerisci MASSIMO 2 task
2. Il tuo focus è sul CONSULENTE, non sui singoli clienti. Aiuta il consulente a organizzarsi meglio.
3. Priorità:
   - Consulenze nelle prossime 24-48h senza preparazione → task di preparazione briefing URGENTE
   - Clienti con pacchetto consulenze ESAURITO o QUASI_ESAURITO → task di monitoraggio per avvisare il consulente
   - Clienti con mesi senza consulenze programmate (stato NESSUNA_PROGRAMMATA o PARZIALE) → task URGENTE per ricordare al consulente di programmare le consulenze. Il preferred_channel DEVE essere "voice" per questi task.
   - Troppi task pendenti (>10) → task di monitoraggio e riorganizzazione
   - Gap nell'agenda (giorni senza consulenze) → suggerisci attività produttive
   - Carico di lavoro squilibrato → suggerisci ottimizzazioni
4. L'ai_instruction DEVE includere:
   - Contesto specifico (quale consulenza preparare, quali metriche analizzare)
   - Azioni concrete suggerite al consulente
   - Punti chiave da considerare
5. Il campo preferred_channel DEVE essere "none" per task interni. MA per promemoria schedulazione consulenze mancanti, DEVE essere "voice" per chiamare il consulente e ricordarglielo.
6. Usa le categorie: preparation, monitoring, report, scheduling
7. Per contact_id usa il client_id della consulenza da preparare, o null per task organizzativi generali
8. Se il consulente ha definito obiettivi strategici, valuta sempre il progresso verso quegli obiettivi nella tua analisi.
9. Se ci sono documenti di riferimento dalla Knowledge Base, usa quelle informazioni per contestualizzare i tuoi suggerimenti.
10. Rispetta lo stile report preferito dal consulente (sintetico = max 3 frasi per sezione, dettagliato = analisi approfondita, bilanciato = via di mezzo).

IMPORTANTE: Il campo "overall_reasoning" è OBBLIGATORIO. Devi SEMPRE spiegare il tuo ragionamento completo, anche se non suggerisci alcun task. Descrivi: cosa hai analizzato, quali dati hai valutato, quale conclusione hai raggiunto e perché.

Rispondi SOLO con JSON valido (senza markdown, senza backtick):
{
  "overall_reasoning": "Spiegazione dettagliata della tua analisi: quali dati hai valutato, quali metriche hai considerato, perché hai deciso di creare (o non creare) task. Se non crei task, spiega chiaramente il motivo.",
  "tasks": [
    {
      "contact_id": "uuid del cliente o null",
      "contact_name": "Nome cliente o Organizzazione",
      "contact_phone": "N/A",
      "ai_instruction": "Istruzione dettagliata per il task di coaching/preparazione...",
      "task_category": "preparation|monitoring|report|scheduling",
      "priority": 2,
      "reasoning": "Motivazione basata sui dati analizzati",
      "preferred_channel": "none",
      "urgency": "normale|oggi|settimana",
      "tone": "professionale"
    }
  ]
}`;
    },
  },

  personalizza: {
    id: "personalizza",
    name: "Personalizza",
    displayName: "Personalizza – Assistente Custom",
    avatar: "personalizza",
    accentColor: "gray",
    description: "Un dipendente AI completamente personalizzabile. Definisci tu cosa deve analizzare, quali dati leggere e che tipo di task creare.",
    shortDescription: "Ruolo personalizzabile con istruzioni libere",
    categories: ["outreach", "reminder", "followup", "analysis", "report", "monitoring", "preparation"],
    preferredChannels: ["voice", "email", "whatsapp", "none"],
    typicalPlan: ["fetch_client_data", "search_private_stores", "analyze_patterns", "generate_report", "send_email", "send_whatsapp", "voice_call"],
    maxTasksPerRun: 3,
    fetchRoleData: fetchPersonalizzaData,
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks, recentAllTasks }) => {
      const consultationsSummary = (roleData.consultations || []).map((c: any) => ({
        client: c.client_name,
        client_id: c.client_id,
        date: c.scheduled_at,
        duration: c.duration,
        status: c.status,
      }));

      const tasksSummary = (roleData.recentTasks || []).map((t: any) => ({
        id: t.id,
        contact: t.contact_name,
        category: t.task_category,
        status: t.status,
        channel: t.preferred_channel,
        role: t.ai_role,
        created: t.created_at,
      }));

      const personalizzaConfig = roleData.personalizzaConfig;
      const hasDetailedConfig = personalizzaConfig && (
        personalizzaConfig.detailed_instructions?.trim() || 
        personalizzaConfig.custom_name?.trim()
      );
      const hasCustomInstructions = hasDetailedConfig || !!(settings.custom_instructions && settings.custom_instructions.trim().length > 0);
      const customName = personalizzaConfig?.custom_name?.trim() || 'PERSONALIZZA';

      return `Sei ${customName}, un assistente AI completamente configurabile dal consulente. Il tuo comportamento, le tue analisi e i task che crei dipendono interamente dalle istruzioni personalizzate fornite dal consulente.

DATA/ORA ATTUALE: ${romeTimeStr}

${hasDetailedConfig ? `CONFIGURAZIONE PERSONALIZZATA:
- Nome: ${personalizzaConfig.custom_name || 'Personalizza'}
- Tono di voce: ${personalizzaConfig.tone_of_voice || 'professionale'}
- Canali preferiti: ${(personalizzaConfig.preferred_channels || []).join(', ') || 'tutti'}
- Categorie task: ${(personalizzaConfig.task_categories || []).join(', ') || 'tutte'}
- Segmento clienti: ${personalizzaConfig.client_segments || 'tutti'}
- Frequenza: ${personalizzaConfig.analysis_frequency || 'ogni ciclo'}
- Max task per ciclo: ${personalizzaConfig.max_tasks_per_run || 3}
${personalizzaConfig.priority_rules ? `- Regole priorità: ${personalizzaConfig.priority_rules}` : ''}

ISTRUZIONI DETTAGLIATE (SEGUI COME PRIORITÀ PRINCIPALE):
${personalizzaConfig.detailed_instructions}` : hasCustomInstructions ? `ISTRUZIONI PERSONALIZZATE DEL CONSULENTE:
${settings.custom_instructions}` : `⚠️ NESSUNA ISTRUZIONE PERSONALIZZATA CONFIGURATA.
Il consulente non ha ancora definito cosa vuoi che tu faccia. Suggerisci al consulente di configurare le istruzioni personalizzate per questo ruolo, spiegando che può definire:
- Quali dati analizzare
- Che tipo di task creare
- Quali canali usare
- Quali clienti prioritizzare
- Qualsiasi logica personalizzata`}

CLIENTI ATTIVI:
${JSON.stringify(clientsList, null, 2)}

CONSULENZE RECENTI (ultimi 30 giorni):
${consultationsSummary.length > 0 ? JSON.stringify(consultationsSummary, null, 2) : 'Nessuna consulenza recente'}

TASK AI RECENTI (ultimi 14 giorni):
${tasksSummary.length > 0 ? JSON.stringify(tasksSummary, null, 2) : 'Nessun task recente'}

${buildTaskMemorySection(recentAllTasks, 'personalizza')}

REGOLE DI PERSONALIZZA:
1. Suggerisci MASSIMO 3 task
2. TUTTE le categorie sono disponibili: outreach, reminder, followup, analysis, report, monitoring, preparation
3. TUTTI i canali sono disponibili: voice, email, whatsapp, none
4. Se il consulente ha fornito istruzioni personalizzate, seguile come priorità assoluta
5. Se NON ci sono istruzioni personalizzate, NON creare task. Restituisci tasks vuoto e nel reasoning spiega che il consulente deve configurare le istruzioni
6. L'ai_instruction DEVE essere dettagliata e contestualizzata
7. Adatta il tono e lo stile alle istruzioni del consulente

IMPORTANTE: Il campo "overall_reasoning" è OBBLIGATORIO. Devi SEMPRE spiegare il tuo ragionamento completo, anche se non suggerisci alcun task. Descrivi: cosa hai analizzato, quali dati hai valutato, quale conclusione hai raggiunto e perché.

Rispondi SOLO con JSON valido (senza markdown, senza backtick):
{
  "overall_reasoning": "Spiegazione dettagliata della tua analisi: quali dati hai valutato, quali istruzioni personalizzate hai seguito, perché hai deciso di creare (o non creare) task. Se non crei task, spiega chiaramente il motivo.",
  "tasks": [
    {
      "contact_id": "uuid del cliente o null",
      "contact_name": "Nome",
      "contact_phone": "+39... o N/A",
      "ai_instruction": "Istruzione dettagliata basata sulle istruzioni personalizzate del consulente...",
      "task_category": "outreach|reminder|followup|analysis|report|monitoring|preparation",
      "priority": 3,
      "reasoning": "Motivazione basata sui dati e sulle istruzioni personalizzate",
      "preferred_channel": "voice|email|whatsapp|none",
      "urgency": "normale|oggi|settimana",
      "tone": "professionale|informale|empatico"
    }
  ]
}`;
    },
  },
};

export function getActiveRoles(enabledRoles: Record<string, boolean>): AIRoleDefinition[] {
  return Object.entries(AI_ROLES)
    .filter(([id]) => enabledRoles[id] !== false)
    .map(([, role]) => role);
}

export function getRoleById(roleId: string): AIRoleDefinition | undefined {
  return AI_ROLES[roleId];
}

export function getAllRoleIds(): string[] {
  return Object.keys(AI_ROLES);
}

export function getDefaultEnabledRoles(): Record<string, boolean> {
  return Object.fromEntries(Object.keys(AI_ROLES).map(id => [id, true]));
}
