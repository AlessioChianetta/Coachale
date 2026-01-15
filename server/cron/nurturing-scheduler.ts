import cron from "node-cron";
import { db } from "../db";
import { eq, and, isNull, lte, gte } from "drizzle-orm";
import * as schema from "@shared/schema";
import { sendEmail } from "../services/email-scheduler";
import { compileTemplate, buildTemplateVariables } from "../services/template-compiler";
import { storage } from "../storage";
import { generateUnsubscribeToken } from "../routes/public-unsubscribe";

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
  emailVars: schema.ConsultantEmailVariables | null
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
  
  const lastSent = lead.nurturingLastEmailAt;
  if (lastSent) {
    const hoursSinceLastEmail = (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastEmail < 20) {
      return { success: false, error: "Email sent recently" };
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
  
  await sendEmail({
    to: leadEmail,
    subject: compiled.subject,
    html: compiled.body,
    consultantId: config.consultantId,
  });
  
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
  
  console.log(`✅ [NURTURING] Sent day ${currentDay} email to ${leadEmail}`);
  return { success: true };
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
