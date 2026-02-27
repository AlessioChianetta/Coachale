import { db } from "../db";
import { sql } from "drizzle-orm";
import { logActivity } from "../cron/ai-task-scheduler";
import { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } from "./provider-factory";

const LOG_PREFIX = "🎯 [HUNTER-DIRECT]";

export async function runDirectHunterForConsultant(consultantId: string): Promise<{ success: boolean; action?: any; reason?: string }> {
  try {
    const settingsResult = await db.execute(sql`
      SELECT outreach_config, consultant_name
      FROM ai_autonomy_settings
      WHERE consultant_id::text = ${consultantId}::text
      LIMIT 1
    `);
    const settings = settingsResult.rows[0] as any;
    if (!settings) {
      return { success: false, reason: "No autonomy settings found" };
    }

    const outreachConfig = settings.outreach_config || {};
    const hunterMode = outreachConfig.hunter_mode ?? "approval";
    const enabled = outreachConfig.enabled ?? false;

    if (hunterMode !== "direct") {
      return { success: false, reason: `hunter_mode is '${hunterMode}', not 'direct'` };
    }
    if (!enabled) {
      return { success: false, reason: "Hunter is disabled" };
    }

    const scoreThreshold = outreachConfig.score_threshold ?? outreachConfig.minScoreThreshold ?? 60;
    const channelPriority: string[] = outreachConfig.channel_priority ?? outreachConfig.channelPriority ?? ["voice", "whatsapp", "email"];
    const whatsappConfigId = outreachConfig.whatsapp_config_id ?? outreachConfig.whatsappConfigId ?? null;
    const voiceTemplateId = outreachConfig.voice_template_id ?? outreachConfig.voiceTemplateId ?? null;
    const emailAccountId = outreachConfig.email_account_id ?? outreachConfig.emailAccountId ?? null;
    const consultantName = settings.consultant_name || "Consulente";

    console.log(`${LOG_PREFIX} Starting for ${consultantId} (threshold: ${scoreThreshold}, channels: ${channelPriority.join(",")})`);

    const leadResult = await db.execute(sql`
      SELECT id, business_name, category, phone, email, website, address,
             ai_sales_summary, score, lead_status
      FROM lead_scraper_results
      WHERE consultant_id = ${consultantId}
        AND score >= ${scoreThreshold}
        AND (lead_status IS NULL OR lead_status NOT IN ('contacted', 'not_interested', 'in_negotiation', 'in_outreach'))
        AND (lead_next_action_date IS NULL OR lead_next_action_date < NOW())
      ORDER BY score DESC
      LIMIT 1
    `);

    if (leadResult.rows.length === 0) {
      console.log(`${LOG_PREFIX} No eligible leads for ${consultantId}`);
      return { success: false, reason: "No eligible leads" };
    }

    const lead = leadResult.rows[0] as any;
    console.log(`${LOG_PREFIX} Found lead: ${lead.business_name} (score: ${lead.score})`);

    let selectedChannel: string | null = null;
    for (const ch of channelPriority) {
      if (ch === "voice" && lead.phone) { selectedChannel = "voice"; break; }
      if (ch === "whatsapp" && lead.phone && whatsappConfigId) { selectedChannel = "whatsapp"; break; }
      if (ch === "email" && lead.email && emailAccountId) { selectedChannel = "email"; break; }
    }

    if (!selectedChannel) {
      if (lead.phone) selectedChannel = "voice";
      else if (lead.email) selectedChannel = "email";
      else {
        console.log(`${LOG_PREFIX} Lead ${lead.business_name} has no phone or email, skipping`);
        await db.execute(sql`
          UPDATE lead_scraper_results SET lead_status = 'not_interested',
            lead_next_action = 'No contact info available'
          WHERE id = ${lead.id}
        `);
        return { success: false, reason: "Lead has no contact info" };
      }
    }

    console.log(`${LOG_PREFIX} Channel selected: ${selectedChannel} for ${lead.business_name}`);

    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) {
      return { success: false, reason: "No Gemini API key available" };
    }

    const { GoogleGenAI } = await import("@google/genai");
    const genAI = new GoogleGenAI({ apiKey });

    const channelPrompt = selectedChannel === "voice"
      ? `Genera un'istruzione per una chiamata commerciale (max 3 frasi): cosa dire, obiettivo della chiamata, tono da usare. Rispondi in JSON: { "call_instruction": "...", "scheduled_offset_minutes": 60 } dove scheduled_offset_minutes è tra 30 e 480.`
      : selectedChannel === "whatsapp"
      ? `Genera un messaggio WhatsApp breve e professionale (max 2-3 frasi) per un primo contatto commerciale. Non usare formattazione markdown. Rispondi in JSON: { "message": "...", "scheduled_offset_minutes": 15 } dove scheduled_offset_minutes è tra 5 e 60.`
      : `Genera un'email professionale con oggetto e corpo per un primo contatto commerciale (max 5 frasi nel corpo). Rispondi in JSON: { "subject": "...", "body": "...", "scheduled_offset_minutes": 0 }`;

    const aiPrompt = `Sei un assistente commerciale AI. Devi preparare il primo contatto per un lead trovato automaticamente.

CONSULENTE: ${consultantName}
LEAD: ${lead.business_name}
SETTORE: ${lead.category || "N/A"}
SITO WEB: ${lead.website || "N/A"}
INDIRIZZO: ${lead.address || "N/A"}
ANALISI AI: ${lead.ai_sales_summary ? lead.ai_sales_summary.substring(0, 500) : "Non disponibile"}
SCORE: ${lead.score}/100

${channelPrompt}

Rispondi SOLO con il JSON, senza markdown.`;

    let aiDecision: any = {};
    try {
      const aiResult = await trackedGenerateContent(genAI, {
        model: GEMINI_3_MODEL,
        contents: [{ role: "user", parts: [{ text: aiPrompt }] }],
        config: { temperature: 0.7, maxOutputTokens: 512 },
      }, "hunter_direct", consultantId);

      const responseText = aiResult?.text || "";
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiDecision = JSON.parse(jsonMatch[0]);
      }
    } catch (aiErr: any) {
      console.warn(`${LOG_PREFIX} AI generation failed, using defaults: ${aiErr.message}`);
      if (selectedChannel === "voice") {
        aiDecision = { call_instruction: `Primo contatto commerciale con ${lead.business_name}. Presentati come ${consultantName}, spiega brevemente i tuoi servizi e chiedi se sono interessati.`, scheduled_offset_minutes: 60 };
      } else if (selectedChannel === "whatsapp") {
        aiDecision = { message: `Buongiorno, sono ${consultantName}. Ho notato la vostra attività ${lead.business_name} e vorrei presentarvi i miei servizi di consulenza. Possiamo fissare una breve chiamata?`, scheduled_offset_minutes: 15 };
      } else {
        aiDecision = { subject: `Collaborazione con ${lead.business_name}`, body: `Buongiorno,\n\nSono ${consultantName} e vorrei presentarvi i miei servizi di consulenza professionale.\n\nSarebbe possibile fissare una breve chiamata per capire se posso esservi utile?\n\nCordiali saluti,\n${consultantName}`, scheduled_offset_minutes: 0 };
      }
    }

    const offsetMinutes = Math.max(0, Math.min(480, aiDecision.scheduled_offset_minutes || 0));
    let actionStatus = "sent";
    let messagePreview = "";
    let resultNote = "";
    let scheduledAt: Date | null = null;

    try {
      if (selectedChannel === "voice") {
        const callInstruction = aiDecision.call_instruction || `Primo contatto con ${lead.business_name}`;
        const scheduledCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const useDefaultTemplate = !voiceTemplateId;

        await db.execute(sql`
          INSERT INTO scheduled_voice_calls (
            id, consultant_id, target_phone, scheduled_at, status, ai_mode,
            call_instruction, instruction_type, attempts, max_attempts,
            priority, attempts_log, use_default_template, voice_template_id,
            notes, created_at, updated_at
          ) VALUES (
            ${scheduledCallId}, ${consultantId}, ${lead.phone},
            NOW() + (${offsetMinutes} * interval '1 minute'),
            'scheduled', 'outreach',
            ${callInstruction}, 'task', 0, 3,
            2, '[]'::jsonb, ${useDefaultTemplate}, ${voiceTemplateId},
            ${"Lead trovato da Hunter (score: " + lead.score + "/100) - " + lead.business_name},
            NOW(), NOW()
          )
        `);

        const timeResult = await db.execute(sql`
          SELECT to_char(scheduled_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY HH24:MI') as display_time,
                 scheduled_at
          FROM scheduled_voice_calls WHERE id = ${scheduledCallId} LIMIT 1
        `);
        const callInfo = timeResult.rows[0] as any;

        actionStatus = "scheduled";
        messagePreview = callInstruction;
        scheduledAt = callInfo?.scheduled_at || new Date();
        resultNote = `Chiamata schedulata per ${callInfo?.display_time || "N/A"} (ID: ${scheduledCallId})`;
        console.log(`${LOG_PREFIX} Voice call scheduled: ${scheduledCallId} at ${callInfo?.display_time}`);

      } else if (selectedChannel === "whatsapp") {
        const waMessage = aiDecision.message || `Buongiorno, sono ${consultantName}. Vorrei presentarvi i miei servizi.`;

        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await db.execute(sql`
          INSERT INTO ai_scheduled_tasks (
            id, consultant_id, contact_phone, contact_name,
            task_type, ai_instruction, scheduled_at, timezone,
            status, priority, task_category, ai_role,
            preferred_channel, whatsapp_config_id,
            additional_context,
            max_attempts, current_attempt, retry_delay_minutes,
            created_at, updated_at
          ) VALUES (
            ${taskId}, ${consultantId}, ${lead.phone}, ${lead.business_name},
            'ai_task', ${waMessage},
            NOW() + (${offsetMinutes} * interval '1 minute'),
            'Europe/Rome', 'scheduled', 2, 'outreach', 'hunter',
            'whatsapp', ${whatsappConfigId},
            ${JSON.stringify({ hunter_direct: true, lead_score: lead.score, lead_id: lead.id })}::text,
            1, 0, 5,
            NOW(), NOW()
          )
        `);

        const timeResult = await db.execute(sql`
          SELECT to_char(scheduled_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY HH24:MI') as display_time,
                 scheduled_at
          FROM ai_scheduled_tasks WHERE id = ${taskId} LIMIT 1
        `);
        const taskInfo = timeResult.rows[0] as any;

        actionStatus = "scheduled";
        messagePreview = waMessage;
        scheduledAt = taskInfo?.scheduled_at || new Date();
        resultNote = `WhatsApp schedulato per ${taskInfo?.display_time || "N/A"} (task: ${taskId})`;
        console.log(`${LOG_PREFIX} WhatsApp scheduled: ${taskId} at ${taskInfo?.display_time}`);

      } else if (selectedChannel === "email") {
        const emailSubject = aiDecision.subject || `Collaborazione con ${lead.business_name}`;
        const emailBody = aiDecision.body || `Buongiorno, vorrei presentarvi i miei servizi.`;

        const smtpResult = await db.execute(sql`
          SELECT id, smtp_host, smtp_port, smtp_user, smtp_password, email_address, display_name
          FROM email_accounts
          WHERE consultant_id = ${consultantId} AND smtp_host IS NOT NULL
          ${emailAccountId ? sql`AND id = ${emailAccountId}` : sql``}
          ORDER BY created_at
          LIMIT 1
        `);

        if (smtpResult.rows.length === 0) {
          actionStatus = "failed";
          resultNote = "Nessun account email SMTP configurato";
        } else {
          const smtpConfig = smtpResult.rows[0] as any;
          try {
            const nodemailer = await import("nodemailer");
            const transporter = nodemailer.createTransport({
              host: smtpConfig.smtp_host,
              port: parseInt(smtpConfig.smtp_port) || 587,
              secure: parseInt(smtpConfig.smtp_port) === 465,
              auth: {
                user: smtpConfig.smtp_user,
                pass: smtpConfig.smtp_password,
              },
            });
            await transporter.sendMail({
              from: smtpConfig.display_name
                ? `"${smtpConfig.display_name}" <${smtpConfig.email_address}>`
                : smtpConfig.email_address,
              to: lead.email,
              subject: emailSubject,
              text: emailBody,
            });
            actionStatus = "sent";
            resultNote = `Email inviata a ${lead.email}`;
            console.log(`${LOG_PREFIX} Email sent to ${lead.email}`);
          } catch (emailErr: any) {
            actionStatus = "failed";
            resultNote = `Errore invio email: ${emailErr.message}`;
            console.error(`${LOG_PREFIX} Email send failed: ${emailErr.message}`);
          }
        }
        messagePreview = `[${emailSubject}] ${emailBody}`.substring(0, 500);
      }
    } catch (execErr: any) {
      actionStatus = "failed";
      resultNote = `Errore esecuzione: ${execErr.message}`;
      console.error(`${LOG_PREFIX} Execution error for ${lead.business_name}: ${execErr.message}`);
    }

    let proactiveLeadId: string | null = null;
    try {
      const existingLead = await db.execute(sql`
        SELECT id FROM proactive_leads
        WHERE consultant_id = ${consultantId}
        AND phone_number = ${lead.phone || ""}
        LIMIT 1
      `);

      if (existingLead.rows.length > 0) {
        proactiveLeadId = (existingLead.rows[0] as any).id;
        await db.execute(sql`
          UPDATE proactive_leads
          SET status = 'contacted', last_contacted_at = NOW()
          WHERE id = ${proactiveLeadId}
        `);
      } else {
        const nameParts = (lead.business_name || "Lead Hunter").split(" ");
        const firstName = nameParts[0] || "Lead";
        const lastName = nameParts.slice(1).join(" ") || "Hunter";

        const insertResult = await db.execute(sql`
          INSERT INTO proactive_leads (
            consultant_id, agent_config_id,
            first_name, last_name, phone_number, email,
            source, status, contact_schedule,
            lead_info, metadata, created_at, updated_at
          ) VALUES (
            ${consultantId},
            ${whatsappConfigId},
            ${firstName}, ${lastName}, ${lead.phone || ""}, ${lead.email || null},
            'hunter', 'contacted',
            NOW(),
            ${JSON.stringify({
              fonte: "Hunter AI",
              settore: lead.category || null,
              website: lead.website || null,
              obiettivi: `Lead trovato da Hunter con score ${lead.score}/100`,
              companyName: lead.business_name,
            })}::jsonb,
            ${JSON.stringify({
              notes: `Lead trovato automaticamente da Hunter. Score: ${lead.score}/100. Canale: ${selectedChannel}`,
              hunter_lead_id: lead.id,
            })}::jsonb,
            NOW(), NOW()
          )
          RETURNING id
        `);
        proactiveLeadId = (insertResult.rows[0] as any)?.id || null;
      }

      if (proactiveLeadId) {
        await db.execute(sql`
          INSERT INTO proactive_lead_activity_logs (
            lead_id, consultant_id, type, title, description, metadata, created_at
          ) VALUES (
            ${proactiveLeadId}, ${consultantId},
            'outreach_sent',
            ${"Hunter ha contattato il lead via " + selectedChannel},
            ${resultNote || "Primo contatto automatico"},
            ${JSON.stringify({
              channel: selectedChannel,
              status: actionStatus,
              lead_score: lead.score,
              message_preview: messagePreview?.substring(0, 200),
            })}::jsonb,
            NOW()
          )
        `);
      }
    } catch (plErr: any) {
      console.warn(`${LOG_PREFIX} Failed to create/update proactive lead: ${plErr.message}`);
    }

    const actionResult = await db.execute(sql`
      INSERT INTO hunter_actions (
        consultant_id, lead_id, proactive_lead_id,
        lead_name, lead_phone, lead_email,
        channel, status, message_preview,
        scheduled_at, executed_at, result_note
      ) VALUES (
        ${consultantId}, ${lead.id}, ${proactiveLeadId},
        ${lead.business_name}, ${lead.phone || null}, ${lead.email || null},
        ${selectedChannel}, ${actionStatus}, ${messagePreview?.substring(0, 500) || null},
        ${scheduledAt}, ${actionStatus === "sent" ? new Date() : null}, ${resultNote}
      )
      RETURNING *
    `);
    const action = actionResult.rows[0] as any;

    if (actionStatus !== "failed") {
      await db.execute(sql`
        UPDATE lead_scraper_results
        SET lead_status = 'in_outreach',
            lead_next_action = ${"Contattato via " + selectedChannel + " da Hunter"},
            lead_next_action_date = NOW() + INTERVAL '7 days'
        WHERE id = ${lead.id}
      `);
    } else {
      await db.execute(sql`
        UPDATE lead_scraper_results
        SET lead_next_action = ${"Tentativo fallito via " + selectedChannel + " - " + (resultNote || "errore sconosciuto")},
            lead_next_action_date = NOW() + INTERVAL '1 day'
        WHERE id = ${lead.id}
      `);
    }

    try {
      await db.execute(sql`
        INSERT INTO lead_scraper_activities (
          lead_id, consultant_id, type, title, description,
          metadata, created_at, updated_at
        ) VALUES (
          ${lead.id}::uuid, ${consultantId}, 'hunter_direct_outreach',
          ${"Hunter Diretto: " + selectedChannel + " a " + lead.business_name},
          ${resultNote},
          ${JSON.stringify({
            channel: selectedChannel,
            status: actionStatus,
            score: lead.score,
            proactive_lead_id: proactiveLeadId,
          })}::jsonb,
          NOW(), NOW()
        )
      `);
    } catch (actErr: any) {
      console.warn(`${LOG_PREFIX} Failed to log scraper activity: ${actErr.message}`);
    }

    const statusEmoji = actionStatus === "sent" ? "✅" : actionStatus === "scheduled" ? "📅" : "❌";
    const channelEmoji = selectedChannel === "voice" ? "📞" : selectedChannel === "whatsapp" ? "💬" : "📧";
    await logActivity(consultantId, {
      event_type: "hunter_direct_action",
      title: `${statusEmoji} ${channelEmoji} Hunter ha contattato ${lead.business_name}`,
      description: `Score: ${lead.score}/100. Canale: ${selectedChannel}. ${resultNote}`,
      icon: channelEmoji,
      severity: actionStatus === "failed" ? "warning" : "info",
      ai_role: "hunter",
    });

    console.log(`${LOG_PREFIX} Completed for ${lead.business_name}: ${selectedChannel} → ${actionStatus}`);
    return { success: true, action };

  } catch (error: any) {
    console.error(`${LOG_PREFIX} Fatal error for ${consultantId}: ${error.message}`);
    return { success: false, reason: error.message };
  }
}
