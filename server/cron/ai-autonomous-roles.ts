import { db } from "../db";
import { sql } from "drizzle-orm";

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
    WHERE svc.consultant_id = ${consultantId}::uuid
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
    SELECT ael.client_id, ael.sent_at, ael.subject, ael.status, ael.opened_at
    FROM automated_emails_log ael
    WHERE ael.consultant_id = ${consultantId}
      AND ael.sent_at > NOW() - INTERVAL '14 days'
    ORDER BY ael.sent_at DESC
    LIMIT 50
  `);

  return {
    journeyProgress: journeyResult.rows,
    emailLogs: emailLogsResult.rows,
  };
}

async function fetchEchoData(consultantId: string, clientIds: string[]): Promise<Record<string, any>> {
  if (clientIds.length === 0) return { unsummarizedConsultations: [], recentSummaries: [] };

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

  return {
    unsummarizedConsultations: unsummarizedResult.rows,
    recentSummaries: recentSummariesResult.rows,
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
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks }) => {
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

TASK COMPLETATI NEGLI ULTIMI 7 GIORNI:
${recentCompletedTasks.length > 0 ? JSON.stringify(recentCompletedTasks, null, 2) : 'Nessun task completato di recente'}

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

Rispondi SOLO con un JSON valido (senza markdown, senza backtick):
{
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
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks }) => {
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
        status: el.status,
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

TASK COMPLETATI NEGLI ULTIMI 7 GIORNI:
${recentCompletedTasks.length > 0 ? JSON.stringify(recentCompletedTasks, null, 2) : 'Nessuno'}

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

Rispondi SOLO con JSON valido (senza markdown, senza backtick):
{
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
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks }) => {
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

      return `Sei ECHO, Summarizer AI. Il tuo ruolo è identificare consulenze completate che necessitano di un riepilogo strutturato e generare report professionali post-sessione.

DATA/ORA ATTUALE: ${romeTimeStr}

IL TUO FOCUS: Riepiloghi consulenze, report post-sessione, documentazione professionale.

CLIENTI ATTIVI:
${JSON.stringify(clientsList, null, 2)}

CONSULENZE SENZA RIEPILOGO (da elaborare):
${unsummarized.length > 0 ? JSON.stringify(unsummarized, null, 2) : 'Tutte le consulenze hanno già un riepilogo!'}

RIEPILOGHI GIÀ GENERATI (ultimi 30 giorni):
${summarized.length > 0 ? JSON.stringify(summarized, null, 2) : 'Nessuno'}

ISTRUZIONI PERSONALIZZATE:
${settings.custom_instructions || 'Nessuna'}

REGOLE DI ECHO:
1. Suggerisci MASSIMO 2 task per riepiloghi
2. Priorità:
   - Consulenze con trascrizione/note ma senza riepilogo → URGENTE
   - Consulenze recenti (ultimi 7 giorni) senza riepilogo → alta priorità
   - Consulenze più vecchie senza riepilogo → media priorità
3. L'ai_instruction DEVE includere:
   - ID della consulenza da riepilogare
   - Contesto disponibile (note, trascrizione, Fathom)
   - Formato del riepilogo desiderato
   - Se inviare automaticamente al cliente via email
4. Preferred_channel: "email" (invio riepilogo al cliente)
5. Se NON ci sono consulenze da riepilogare, restituisci tasks vuoto
6. Usa la categoria: analysis

Rispondi SOLO con JSON valido (senza markdown, senza backtick):
{
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
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks }) => {
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

Rispondi SOLO con JSON valido:
{
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
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks }) => {
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

Rispondi SOLO con JSON valido:
{
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
    buildPrompt: ({ clientsList, roleData, settings, romeTimeStr, recentCompletedTasks }) => {
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

Rispondi SOLO con JSON valido:
{
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
