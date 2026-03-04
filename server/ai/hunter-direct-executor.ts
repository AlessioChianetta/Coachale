import { db } from "../db";
import { sql } from "drizzle-orm";
import { logActivity } from "../cron/ai-task-scheduler";
import { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } from "./provider-factory";
import { selectBestTemplate, GOLDEN_RULES, type EmailTemplate } from "./email-templates-library";

const LOG_PREFIX = "🎯 [HUNTER-DIRECT]";

export async function runDirectHunterForConsultant(consultantId: string): Promise<{ success: boolean; action?: any; reason?: string }> {
  try {
    const settingsResult = await db.execute(sql`
      SELECT a.outreach_config, CONCAT(u.first_name, ' ', u.last_name) as consultant_name
      FROM ai_autonomy_settings a
      JOIN users u ON a.consultant_id::text = u.id::text
      WHERE a.consultant_id::text = ${consultantId}::text
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
      if (ch === "whatsapp" && lead.phone && whatsappConfigId) {
        const waTemplateSids: string[] = outreachConfig.whatsapp_template_ids || [];
        if (waTemplateSids.length === 0) {
          console.log(`${LOG_PREFIX} WhatsApp skipped: no approved templates configured (free-text not allowed)`);
          continue;
        }
        selectedChannel = "whatsapp"; break;
      }
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

    const websiteData = lead.website_data || lead.websiteData || null;
    const hasWebsiteData = !!websiteData;
    const websiteStr = hasWebsiteData ? (typeof websiteData === 'string' ? websiteData : JSON.stringify(websiteData)) : '';
    const hasSpecificDetail = hasWebsiteData && /servizi|chi siamo|about|team|portfolio|clienti|recensioni/i.test(websiteStr);

    const emailTemplate: EmailTemplate = selectBestTemplate({
      stepNumber: 1,
      hasWebsiteData,
      hasSpecificDetail,
      sector: lead.category || undefined,
      scrapeData: websiteData,
    });

    console.log(`${LOG_PREFIX} Selected email template: ${emailTemplate.name} (${emailTemplate.id})`);

    const websiteContext = hasWebsiteData ? `\nDATI DAL SITO WEB:\n${websiteStr.substring(0, 800)}` : '';

    const channelPrompt = selectedChannel === "voice"
      ? `Genera un'istruzione per una chiamata commerciale (max 3 frasi): cosa dire, obiettivo della chiamata, tono da usare. Rispondi in JSON: { "call_instruction": "...", "scheduled_offset_minutes": 60 } dove scheduled_offset_minutes è tra 30 e 480.`
      : selectedChannel === "whatsapp"
      ? `Genera un messaggio WhatsApp breve e professionale (max 2-3 frasi) per un primo contatto commerciale. Non usare formattazione markdown. Rispondi in JSON: { "message": "...", "scheduled_offset_minutes": 15 } dove scheduled_offset_minutes è tra 5 e 60.`
      : `Genera un'email professionale con oggetto e corpo per un primo contatto commerciale.

SEGUI ESATTAMENTE la struttura del seguente template. Sostituisci TUTTI i placeholder con dati reali del lead. Puoi adattare singole frasi al contesto ma MANTIENI la struttura, il tono e la leva psicologica del template.

--- TEMPLATE DA SEGUIRE: "${emailTemplate.name}" ---
SCENARIO: ${emailTemplate.whenToUse}
LEVA PSICOLOGICA: ${emailTemplate.psychologicalLever}
OGGETTO: ${emailTemplate.subject}
CORPO:
${emailTemplate.body}
--- FINE TEMPLATE ---

${GOLDEN_RULES}

Rispondi in JSON: { "subject": "...", "body": "...", "scheduled_offset_minutes": 0, "template_used": "${emailTemplate.id}" }
IMPORTANTE: Sostituisci tutti i placeholder ({contactName}, {businessName}, {sector}, {specificDetail}, {problemOpportunity}, {painStatistic}, {resultMetric}, {timeframe}, {valueProposition}, ecc.) con dati reali del lead.
Il corpo deve essere in testo piano (no markdown/HTML).
LUNGHEZZA: MINIMO 10 righe, MASSIMO 15. Le email troppo corte (3-5 righe) sembrano spam automatizzato.
OBBLIGATORIO: includi almeno un NUMERO o PERCENTUALE concreto come social proof. Se non hai un dato reale, inventa un risultato plausibile per il settore.
CTA: con opzioni temporali concrete (es: "Preferisci giovedì mattina o venerdì pomeriggio?"), MAI "ti andrebbe una demo?" o CTA vaghi.`;

    const aiPrompt = `Sei un consulente commerciale VERO che scrive email a mano. NON sei un software di marketing automation. Scrivi come parleresti a un contatto LinkedIn che non conosci ma stimi — diretto, professionale, umano. Niente frasi da brochure, niente tono da template. Devi preparare il primo contatto per un lead trovato automaticamente.

CONSULENTE: ${consultantName}
LEAD: ${lead.business_name}
SETTORE: ${lead.category || "N/A"}
SITO WEB: ${lead.website || "N/A"}
INDIRIZZO: ${lead.address || "N/A"}
ANALISI AI: ${lead.ai_sales_summary ? lead.ai_sales_summary.substring(0, 500) : "Non disponibile"}
SCORE: ${lead.score}/100
RATING: ${lead.rating || "N/A"}/5${websiteContext}

${channelPrompt}

Rispondi SOLO con il JSON, senza markdown.`;

    let aiDecision: any = {};
    try {
      const aiResult = await trackedGenerateContent(genAI, {
        model: GEMINI_3_MODEL,
        contents: [{ role: "user", parts: [{ text: aiPrompt }] }],
        config: { temperature: 0.7, maxOutputTokens: 1024 },
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
        const waTemplateSids: string[] = outreachConfig.whatsapp_template_ids || [];
        let templateResult: any = null;
        let waTemplateName = "";
        let waTemplateSid = "";
        let waTemplateBody = "";
        let waTemplateFilled = "";
        let waTemplateVariables: Record<string, string> = {};
        let waMessage = "";

        if (waTemplateSids.length > 0) {
          const tplResult = await db.execute(sql`
            SELECT t.template_name, v.twilio_content_sid, v.body_text, v.id as version_id
            FROM whatsapp_custom_templates t
            INNER JOIN whatsapp_template_versions v ON v.template_id = t.id AND v.is_active = true
            WHERE t.consultant_id = ${consultantId}
              AND v.twilio_content_sid IN ${sql`(${sql.join(waTemplateSids.map(s => sql`${s}`), sql`, `)})`}
              AND v.twilio_content_sid IS NOT NULL AND v.twilio_content_sid != ''
            LIMIT 10
          `);

          if (tplResult.rows.length > 0) {
            const selected = tplResult.rows[Math.floor(Math.random() * tplResult.rows.length)] as any;
            waTemplateName = selected.template_name;
            waTemplateSid = selected.twilio_content_sid;
            waTemplateBody = selected.body_text || '';

            const varsResult = await db.execute(sql`
              SELECT tv.position, vc.variable_key, vc.variable_name
              FROM whatsapp_template_variables tv
              INNER JOIN whatsapp_variable_catalog vc ON vc.id = tv.variable_catalog_id
              WHERE tv.template_version_id = ${selected.version_id}
              ORDER BY tv.position
            `);

            waTemplateFilled = waTemplateBody;
            for (const v of varsResult.rows as any[]) {
              let val = '';
              if (v.variable_key === 'nome_lead') val = lead.contact_name || lead.business_name || '';
              else if (v.variable_key === 'mio_nome') val = consultantName;
              else if (v.variable_key === 'azienda') val = lead.business_name || '';
              else if (v.variable_key === 'settore') val = lead.category || '';
              else val = lead.business_name || consultantName;

              waTemplateVariables[String(v.position)] = val;
              waTemplateFilled = waTemplateFilled.replace(new RegExp(`\\{\\{${v.position}\\}\\}`, 'g'), val);
              waTemplateFilled = waTemplateFilled.replace(new RegExp(`\\{${v.variable_key}\\}`, 'g'), val);
            }

            waMessage = waTemplateFilled;
            console.log(`${LOG_PREFIX} WA template "${waTemplateName}" (sid=${waTemplateSid}) filled for ${lead.business_name}: "${waTemplateFilled.substring(0, 150)}..." | Twilio vars: ${JSON.stringify(waTemplateVariables)}`);
          }
        }

        if (!waMessage) {
          console.log(`${LOG_PREFIX} WhatsApp BLOCKED: no templates available for ${lead.business_name}`);
          throw new Error("No WhatsApp template available");
        }

        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const additionalCtx = JSON.stringify({
          hunter_direct: true,
          lead_score: lead.score,
          lead_id: lead.id,
          business_name: lead.business_name,
          sector: lead.category,
          use_wa_template: true,
          wa_template_name: waTemplateName,
          wa_template_sid: waTemplateSid,
          wa_template_body: waTemplateBody,
          wa_template_filled: waTemplateFilled,
          wa_template_variables: waTemplateVariables,
        });

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
            'single_whatsapp', ${waMessage},
            NOW() + (${offsetMinutes} * interval '1 minute'),
            'Europe/Rome', 'scheduled', 2, 'outreach', 'hunter',
            'whatsapp', ${whatsappConfigId},
            ${additionalCtx}::text,
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
        messagePreview = `Template: ${waTemplateName}\n${waTemplateFilled}`;
        scheduledAt = taskInfo?.scheduled_at || new Date();
        resultNote = `WhatsApp schedulato per ${taskInfo?.display_time || "N/A"} — Template: ${waTemplateName} (task: ${taskId})`;
        console.log(`${LOG_PREFIX} WhatsApp scheduled: ${taskId} at ${taskInfo?.display_time} — Template: ${waTemplateName}`);

      } else if (selectedChannel === "email") {
        const emailSubject = aiDecision.subject || `Collaborazione con ${lead.business_name}`;
        const emailBody = aiDecision.body || `Buongiorno, vorrei presentarvi i miei servizi.`;

        const poolId = outreachConfig.pool_id ?? null;
        const today = new Date().toISOString().slice(0, 10);

        // Reset daily counters for accounts where the date has changed
        if (poolId) {
          await db.execute(sql`
            UPDATE email_accounts
            SET daily_send_count = 0, last_send_reset_date = ${today}
            WHERE outreach_pool_id = ${poolId}
              AND (last_send_reset_date IS NULL OR last_send_reset_date != ${today})
          `);
        } else if (emailAccountId) {
          await db.execute(sql`
            UPDATE email_accounts
            SET daily_send_count = 0, last_send_reset_date = ${today}
            WHERE id = ${emailAccountId}
              AND (last_send_reset_date IS NULL OR last_send_reset_date != ${today})
          `);
        }

        // Select account: pool rotation or single fallback
        const smtpResult = poolId
          ? await db.execute(sql`
              SELECT ea.id, ea.smtp_host, ea.smtp_port, ea.smtp_user, ea.smtp_password,
                     ea.email_address, ea.display_name, ea.outreach_pool_id,
                     ea.daily_send_count, ea.daily_send_limit,
                     eop.tracking_domain, eop.sales_context as pool_sales_context,
                     eop.custom_instructions as pool_custom_instructions
              FROM email_accounts ea
              JOIN email_outreach_pools eop ON eop.id = ea.outreach_pool_id
              WHERE ea.outreach_pool_id = ${poolId}
                AND ea.is_outreach_sender = true
                AND ea.smtp_host IS NOT NULL
                AND ea.daily_send_count < ea.daily_send_limit
                AND ea.is_active = true
              ORDER BY ea.daily_send_count ASC
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT ea.id, ea.smtp_host, ea.smtp_port, ea.smtp_user, ea.smtp_password,
                     ea.email_address, ea.display_name, ea.outreach_pool_id,
                     ea.daily_send_count, ea.daily_send_limit,
                     NULL as tracking_domain,
                     NULL as pool_sales_context,
                     NULL as pool_custom_instructions
              FROM email_accounts ea
              WHERE ea.consultant_id = ${consultantId} AND ea.smtp_host IS NOT NULL
              ${emailAccountId ? sql`AND ea.id = ${emailAccountId}` : sql``}
              ORDER BY ea.created_at
              LIMIT 1
            `);

        if (smtpResult.rows.length === 0) {
          actionStatus = "failed";
          resultNote = poolId
            ? "Tutti gli account del pool hanno raggiunto il limite giornaliero di invii"
            : "Nessun account email SMTP configurato";
          console.warn(`${LOG_PREFIX} No SMTP account available (poolId: ${poolId})`);
        } else {
          const smtpConfig = smtpResult.rows[0] as any;
          const trackingDomain: string | null = smtpConfig.tracking_domain || null;

          // Prepare email body with tracking if domain is configured
          let finalBodyText = emailBody;
          let finalBodyHtml = emailBody.replace(/\n/g, "<br>");
          let openTrackingToken: string | null = null;

          if (trackingDomain) {
            // Create open tracking event
            const openTokenResult = await db.execute(sql`
              INSERT INTO email_tracking_events (consultant_id, account_id, pool_id, lead_id, event_type)
              VALUES (${consultantId}, ${smtpConfig.id}, ${smtpConfig.outreach_pool_id || null}, ${lead.id}, 'open')
              RETURNING token
            `);
            openTrackingToken = (openTokenResult.rows[0] as any)?.token || null;

            // Wrap links in body for click tracking
            const linkRegex = /href=["'](https?:\/\/[^"']+)["']/g;
            let clickWrappedHtml = finalBodyHtml;
            let match;
            while ((match = linkRegex.exec(finalBodyHtml)) !== null) {
              const originalUrl = match[1];
              const clickResult = await db.execute(sql`
                INSERT INTO email_tracking_events (consultant_id, account_id, pool_id, lead_id, event_type, target_url)
                VALUES (${consultantId}, ${smtpConfig.id}, ${smtpConfig.outreach_pool_id || null}, ${lead.id}, 'click', ${originalUrl})
                RETURNING token
              `);
              const clickToken = (clickResult.rows[0] as any)?.token;
              if (clickToken) {
                clickWrappedHtml = clickWrappedHtml.replace(
                  originalUrl,
                  `https://${trackingDomain}/track/c/${clickToken}`
                );
              }
            }

            // Add open pixel before closing body
            if (openTrackingToken) {
              const pixel = `<img src="https://${trackingDomain}/track/o/${openTrackingToken}" width="1" height="1" style="display:none;border:0" alt="" />`;
              clickWrappedHtml = clickWrappedHtml.includes("</body>")
                ? clickWrappedHtml.replace("</body>", `${pixel}</body>`)
                : `${clickWrappedHtml}${pixel}`;
            }

            finalBodyHtml = clickWrappedHtml;
            console.log(`${LOG_PREFIX} Tracking enabled via ${trackingDomain} (open: ${openTrackingToken})`);
          }

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
            const sendResult = await transporter.sendMail({
              from: smtpConfig.display_name
                ? `"${smtpConfig.display_name}" <${smtpConfig.email_address}>`
                : smtpConfig.email_address,
              to: lead.email,
              subject: emailSubject,
              text: finalBodyText,
              html: finalBodyHtml,
            });

            // Increment daily counter on used account
            await db.execute(sql`
              UPDATE email_accounts
              SET daily_send_count = daily_send_count + 1, last_send_reset_date = ${today}
              WHERE id = ${smtpConfig.id}
            `);

            // Save to hub_emails for Millie thread tracking
            const outgoingMsgId = sendResult.messageId || `outreach-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const hubEmailId = `outreach-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            await db.execute(sql`
              INSERT INTO hub_emails (
                id, account_id, consultant_id, message_id,
                subject, from_email, from_name,
                to_recipients, body_html, body_text, snippet,
                direction, folder, is_read, processing_status,
                is_outreach_email, outreach_lead_id, outreach_pool_id,
                sent_at, created_at, updated_at
              ) VALUES (
                ${hubEmailId}, ${smtpConfig.id}, ${consultantId}, ${outgoingMsgId},
                ${emailSubject}, ${smtpConfig.email_address}, ${smtpConfig.display_name || null},
                ${JSON.stringify([{ email: lead.email, name: lead.business_name || lead.email }])},
                ${finalBodyHtml}, ${finalBodyText}, ${finalBodyText.substring(0, 200)},
                'outbound', 'sent', true, 'sent',
                true, ${lead.id}, ${smtpConfig.outreach_pool_id || null},
                NOW(), NOW(), NOW()
              )
            `);

            // Update open tracking event with message id
            if (openTrackingToken) {
              await db.execute(sql`
                UPDATE email_tracking_events
                SET outreach_message_id = ${outgoingMsgId}
                WHERE token = ${openTrackingToken}
              `);
            }

            actionStatus = "sent";
            resultNote = `Email inviata a ${lead.email} tramite ${smtpConfig.email_address} (${smtpConfig.daily_send_count + 1}/${smtpConfig.daily_send_limit} oggi)`;
            console.log(`${LOG_PREFIX} Email sent to ${lead.email} via ${smtpConfig.email_address}`);
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
      const activityTypeMap: Record<string, string> = {
        'voice': 'chiamata',
        'whatsapp': 'whatsapp_inviato',
        'email': 'email_inviata',
      };
      const standardActivityType = activityTypeMap[selectedChannel] || 'email_inviata';

      await db.execute(sql`
        INSERT INTO lead_scraper_activities (
          lead_id, consultant_id, type, title, description,
          metadata, created_at, updated_at
        ) VALUES (
          ${lead.id}::uuid, ${consultantId}, ${standardActivityType},
          ${"Hunter Diretto: " + selectedChannel + " a " + lead.business_name},
          ${resultNote || messagePreview?.substring(0, 500) || ''},
          ${JSON.stringify({
            source: 'hunter_direct',
            channel: selectedChannel,
            status: actionStatus,
            score: lead.score,
            proactive_lead_id: proactiveLeadId,
            template_name: selectedChannel === 'email' ? emailTemplate.name : undefined,
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
