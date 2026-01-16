import cron from "node-cron";
import { db } from "../db";
import { eq, and, isNull, lte, gte } from "drizzle-orm";
import * as schema from "@shared/schema";
import { sendEmail } from "../services/email-scheduler";
import { compileTemplate, buildTemplateVariables } from "../services/template-compiler";
import { storage } from "../storage";
import { generateUnsubscribeToken } from "../routes/public-unsubscribe";
import { createSmtpService } from "../services/email-hub/smtp-service";

async function logNurturingEmailActivity(
  leadId: string,
  consultantId: string,
  agentConfigId: string | null,
  eventType: "nurturing_email_sent" | "nurturing_email_failed",
  eventMessage: string,
  eventDetails: {
    emailRecipient?: string;
    emailSubject?: string;
    emailHtml?: string;
    emailType?: "welcome" | "nurturing";
    nurturingDay?: number;
    errorMessage?: string;
  },
  leadStatusAtEvent?: string
) {
  try {
    await db.insert(schema.proactiveLeadActivityLogs).values({
      leadId,
      consultantId,
      agentConfigId,
      eventType,
      eventMessage,
      eventDetails,
      leadStatusAtEvent: leadStatusAtEvent as any,
    });
    console.log(`📧 [NURTURING ACTIVITY LOG] ${eventType}: ${eventMessage}`);
  } catch (error) {
    console.error(`❌ [NURTURING ACTIVITY LOG] Failed to save log:`, error);
  }
}

let nurturingJob: cron.ScheduledTask | null = null;
let cleanupJob: cron.ScheduledTask | null = null;

const EMAILS_PER_BATCH = 50;
const BATCH_DELAY_MS = 2000;

function calculateCurrentDay(startDate: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - startDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.min(diffDays + 1, 365);
}

async function processNurturingEmails(): Promise<void> {
  console.log(`📧 [NURTURING SCHEDULER] Starting nurturing email processing...`);
  
  try {
    const configs = await db.select()
      .from(schema.leadNurturingConfig)
      .where(eq(schema.leadNurturingConfig.isEnabled, true));
    
    console.log(`📧 [NURTURING SCHEDULER] Found ${configs.length} active nurturing configs`);
    
    for (const config of configs) {
      await processConsultantNurturing(config);
    }
    
    console.log(`📧 [NURTURING SCHEDULER] Nurturing processing completed`);
  } catch (error) {
    console.error(`❌ [NURTURING SCHEDULER] Error:`, error);
  }
}

async function processConsultantNurturing(config: schema.LeadNurturingConfig): Promise<void> {
  const { consultantId, skipWeekends } = config;
  
  if (skipWeekends) {
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(`📧 [NURTURING] Skipping ${consultantId} - weekend mode enabled`);
      return;
    }
  }
  
  const leads = await db.select()
    .from(schema.proactiveLeads)
    .where(
      and(
        eq(schema.proactiveLeads.consultantId, consultantId),
        eq(schema.proactiveLeads.nurturingEnabled, true),
        isNull(schema.proactiveLeads.nurturingOptOutAt)
      )
    );
  
  console.log(`📧 [NURTURING] Processing ${leads.length} leads for consultant ${consultantId}`);
  
  const emailVars = await storage.getEmailVariables(consultantId);
  
  let emailsSent = 0;
  for (const lead of leads) {
    if (emailsSent >= EMAILS_PER_BATCH) {
      console.log(`📧 [NURTURING] Batch limit reached, waiting ${BATCH_DELAY_MS}ms...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      emailsSent = 0;
    }
    
    try {
      const result = await sendNurturingEmail(lead, config, emailVars);
      if (result.success) {
        emailsSent++;
      }
    } catch (error: any) {
      console.error(`❌ [NURTURING] Error sending to lead ${lead.id}:`, error.message);
    }
  }
}

async function sendNurturingEmail(
  lead: schema.ProactiveLead,
  config: schema.LeadNurturingConfig,
  emailVars: schema.ConsultantEmailVariables | null,
  options?: { skipCooldown?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const leadEmail = storage.getLeadEmail(lead);
  if (!leadEmail) {
    return { success: false, error: "No email" };
  }
  
  if (!lead.nurturingStartDate) {
    return { success: false, error: "No start date" };
  }
  
  const currentDay = calculateCurrentDay(lead.nurturingStartDate);
  
  if (currentDay > 365) {
    await db.update(schema.proactiveLeads)
      .set({ nurturingEnabled: false, updatedAt: new Date() })
      .where(eq(schema.proactiveLeads.id, lead.id));
    return { success: false, error: "Nurturing completed (365 days)" };
  }
  
  // Skip cooldown check if manual test trigger
  if (!options?.skipCooldown) {
    const lastSent = lead.nurturingLastEmailAt;
    if (lastSent) {
      const hoursSinceLastEmail = (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastEmail < 20) {
        return { success: false, error: "Email sent recently" };
      }
    }
  }
  
  const [template] = await db.select()
    .from(schema.leadNurturingTemplates)
    .where(
      and(
        eq(schema.leadNurturingTemplates.consultantId, config.consultantId),
        eq(schema.leadNurturingTemplates.dayNumber, currentDay),
        eq(schema.leadNurturingTemplates.isActive, true)
      )
    )
    .limit(1);
  
  if (!template) {
    return { success: false, error: `No template for day ${currentDay}` };
  }
  
  const unsubscribeToken = generateUnsubscribeToken(lead.id, lead.consultantId);
  
  const variables = buildTemplateVariables(lead, emailVars, unsubscribeToken, currentDay);
  
  const compiled = compileTemplate(
    { subject: template.subject, body: template.body },
    variables
  );
  
  if (compiled.errors.length > 0) {
    console.warn(`⚠️ [NURTURING] Template compilation warnings for day ${currentDay}:`, compiled.errors);
  }
  
  try {
    // Try to find a configured Email Hub account
    const [emailAccount] = await db
      .select()
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.consultantId, config.consultantId))
      .limit(1);
    
    let messageId: string | undefined;
    
    if (emailAccount && emailAccount.smtpHost && emailAccount.smtpUser && emailAccount.smtpPassword) {
      // Use Email Hub account SMTP - email will appear in "Sent" folder
      console.log(`📧 [NURTURING] Using Email Hub account: ${emailAccount.emailAddress}`);
      
      const smtpService = createSmtpService({
        host: emailAccount.smtpHost,
        port: emailAccount.smtpPort || 587,
        user: emailAccount.smtpUser,
        password: emailAccount.smtpPassword,
        tls: emailAccount.smtpTls ?? true,
      });
      
      const sendResult = await smtpService.sendEmail({
        from: emailAccount.emailAddress,
        fromName: emailAccount.displayName || emailVars?.consultantName || "Consulente",
        to: leadEmail,
        subject: compiled.subject,
        html: compiled.body,
      });
      
      if (!sendResult.success) {
        throw new Error(`SMTP invio fallito: ${sendResult.error}`);
      }
      
      messageId = sendResult.messageId;
      
      // Save email to Email Hub for visibility in "Sent" folder
      const generatedMessageId = messageId || `nurturing-day${currentDay}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      await db.insert(schema.hubEmails).values({
        accountId: emailAccount.id,
        consultantId: config.consultantId,
        messageId: generatedMessageId,
        subject: compiled.subject,
        fromName: emailAccount.displayName || emailVars?.consultantName || "Consulente",
        fromEmail: emailAccount.emailAddress,
        toRecipients: [leadEmail],
        bodyHtml: compiled.body,
        bodyText: compiled.body.replace(/<[^>]*>/g, '').substring(0, 500),
        snippet: compiled.body.replace(/<[^>]*>/g, '').substring(0, 200),
        direction: "outbound",
        folder: "sent",
        isRead: true,
        sentAt: new Date(),
        receivedAt: new Date(),
        processingStatus: "sent",
      });
      
      console.log(`📧 [NURTURING] Saved to Email Hub with messageId: ${generatedMessageId}`);
      
    } else {
      // Fallback to global SMTP settings (won't appear in Email Hub)
      console.log(`📧 [NURTURING] No Email Hub account with SMTP, using global SMTP settings`);
      
      await sendEmail({
        to: leadEmail,
        subject: compiled.subject,
        html: compiled.body,
        consultantId: config.consultantId,
      });
    }
    
    await db.insert(schema.leadNurturingLogs).values({
      leadId: lead.id,
      consultantId: config.consultantId,
      templateId: template.id,
      dayNumber: currentDay,
      emailTo: leadEmail,
      sentAt: new Date(),
    });
    
    await db.update(schema.proactiveLeads)
      .set({
        nurturingEmailsSent: (lead.nurturingEmailsSent || 0) + 1,
        nurturingLastEmailAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.proactiveLeads.id, lead.id));
    
    await logNurturingEmailActivity(
      lead.id,
      config.consultantId,
      lead.agentConfigId,
      "nurturing_email_sent",
      `Email nurturing giorno ${currentDay} inviata a ${leadEmail}`,
      {
        emailRecipient: leadEmail,
        emailSubject: compiled.subject,
        emailHtml: compiled.body,
        emailType: "nurturing",
        nurturingDay: currentDay,
      },
      lead.status
    );
    
    console.log(`✅ [NURTURING] Sent day ${currentDay} email to ${leadEmail}`);
    return { success: true };
  } catch (error: any) {
    await logNurturingEmailActivity(
      lead.id,
      config.consultantId,
      lead.agentConfigId,
      "nurturing_email_failed",
      `Errore invio email nurturing giorno ${currentDay}: ${error.message}`,
      {
        emailRecipient: leadEmail,
        emailSubject: compiled.subject,
        emailType: "nurturing",
        nurturingDay: currentDay,
        errorMessage: error.message || "Errore sconosciuto",
      },
      lead.status
    );
    
    throw error;
  }
}

async function cleanupOldLogs(): Promise<void> {
  console.log(`🧹 [NURTURING CLEANUP] Starting weekly log cleanup...`);
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const deleted = await db.delete(schema.leadNurturingLogs)
      .where(lte(schema.leadNurturingLogs.sentAt, thirtyDaysAgo));
    
    console.log(`🧹 [NURTURING CLEANUP] Cleanup completed`);
  } catch (error) {
    console.error(`❌ [NURTURING CLEANUP] Error:`, error);
  }
}

export function startNurturingScheduler(): void {
  if (nurturingJob) {
    nurturingJob.stop();
  }
  if (cleanupJob) {
    cleanupJob.stop();
  }
  
  nurturingJob = cron.schedule("0 9 * * *", processNurturingEmails, {
    timezone: "Europe/Rome",
  });
  
  cleanupJob = cron.schedule("0 3 * * 0", cleanupOldLogs, {
    timezone: "Europe/Rome",
  });
  
  console.log(`✅ [NURTURING SCHEDULER] Started`);
  console.log(`   📧 Email sending: Daily at 09:00 (Europe/Rome)`);
  console.log(`   🧹 Log cleanup: Weekly on Sunday at 03:00 (Europe/Rome)`);
}

export function stopNurturingScheduler(): void {
  if (nurturingJob) {
    nurturingJob.stop();
    nurturingJob = null;
  }
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
  }
  console.log(`⏹️ [NURTURING SCHEDULER] Stopped`);
}

// Export for manual test trigger
export async function triggerNurturingNow(consultantId: string): Promise<{
  success: boolean;
  processed: number;
  sent: number;
  errors: string[];
}> {
  console.log(`📧 [NURTURING MANUAL] Manual trigger for consultant ${consultantId}`);
  
  const errors: string[] = [];
  let processed = 0;
  let sent = 0;
  
  try {
    const [config] = await db.select()
      .from(schema.leadNurturingConfig)
      .where(eq(schema.leadNurturingConfig.consultantId, consultantId))
      .limit(1);
    
    if (!config) {
      return { success: false, processed: 0, sent: 0, errors: ["Configurazione nurturing non trovata"] };
    }
    
    const leads = await db.select()
      .from(schema.proactiveLeads)
      .where(
        and(
          eq(schema.proactiveLeads.consultantId, consultantId),
          eq(schema.proactiveLeads.nurturingEnabled, true),
          isNull(schema.proactiveLeads.nurturingOptOutAt)
        )
      );
    
    console.log(`📧 [NURTURING MANUAL] Found ${leads.length} leads with nurturing enabled`);
    
    const emailVars = await storage.getEmailVariables(consultantId);
    
    for (const lead of leads) {
      processed++;
      const leadEmail = storage.getLeadEmail(lead);
      console.log(`📧 [NURTURING MANUAL] Processing lead ${lead.firstName || lead.id}: email=${leadEmail || 'NONE'}, startDate=${lead.nurturingStartDate}`);
      try {
        // Skip cooldown for manual test triggers
        const result = await sendNurturingEmail(lead, config, emailVars, { skipCooldown: true });
        if (result.success) {
          sent++;
          console.log(`✅ [NURTURING MANUAL] Email sent to ${lead.firstName || lead.id}`);
        } else if (result.error) {
          console.log(`⚠️ [NURTURING MANUAL] Skipped ${lead.firstName || lead.id}: ${result.error}`);
          errors.push(`Lead ${lead.firstName || lead.id}: ${result.error}`);
        }
      } catch (error: any) {
        console.error(`❌ [NURTURING MANUAL] Error for ${lead.firstName || lead.id}:`, error.message);
        errors.push(`Lead ${lead.firstName || lead.id}: ${error.message}`);
      }
    }
    
    console.log(`📧 [NURTURING MANUAL] Completed: ${sent}/${processed} emails sent`);
    return { success: true, processed, sent, errors };
  } catch (error: any) {
    console.error(`❌ [NURTURING MANUAL] Error:`, error);
    return { success: false, processed, sent, errors: [error.message] };
  }
}
