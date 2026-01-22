// Email Scheduler Service
// Sends automated motivational emails to clients every 2 days

import { storage } from "../storage";
import { generateMotivationalEmail } from "../ai/email-template-generator";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const ITALY_TIMEZONE = "Europe/Rome";
const SEND_HOUR = 13; // 13:00 Italian time

/**
 * Get the current time in Italian timezone.
 * This ensures all date calculations use Italian time.
 */
function getItalianNow(): Date {
  return toZonedTime(new Date(), ITALY_TIMEZONE);
}

/**
 * Set a date to 13:00 Italian time (Europe/Rome timezone).
 * This ensures emails are always scheduled at 13:00 Italian time regardless of server timezone.
 */
function setToItalianTime(date: Date, hour: number = SEND_HOUR): Date {
  // Convert UTC date to Italian timezone to get the correct day
  const italianDate = toZonedTime(date, ITALY_TIMEZONE);
  // Set to the desired hour in Italian time
  italianDate.setHours(hour, 0, 0, 0);
  // Convert back from Italian time to UTC
  return fromZonedTime(italianDate, ITALY_TIMEZONE);
}

/**
 * Calculate the next real send time based on current Italian time.
 * Uses the same setToItalianTime() function used for actual scheduling.
 * If current time < today at SEND_HOUR, returns today at 13:00.
 * If current time >= today at SEND_HOUR, returns tomorrow at 13:00.
 */
function getNextSendTime(): { nextSendTime: Date; nextSendTimeItaly: Date; isToday: boolean; hoursUntil: number; minutesUntil: number } {
  const nowItaly = getItalianNow();
  
  // Calculate today's send time using the same function used for scheduling
  const todaySendTime = setToItalianTime(new Date());
  const todaySendTimeItaly = toZonedTime(todaySendTime, ITALY_TIMEZONE);
  
  // Compare full datetime (not just hour) to determine if we're before or after send time
  const isBeforeSendTime = nowItaly.getTime() < todaySendTimeItaly.getTime();
  
  // If before today's send time, next send is today
  // If at or after today's send time, next send is tomorrow
  let nextSendTime: Date;
  let nextSendTimeItaly: Date;
  
  if (isBeforeSendTime) {
    nextSendTime = todaySendTime;
    nextSendTimeItaly = todaySendTimeItaly;
  } else {
    // Tomorrow at SEND_HOUR
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    nextSendTime = setToItalianTime(tomorrow);
    nextSendTimeItaly = toZonedTime(nextSendTime, ITALY_TIMEZONE);
  }
  
  // Calculate time until next send
  const diffMs = nextSendTimeItaly.getTime() - nowItaly.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hoursUntil = Math.floor(totalMinutes / 60);
  const minutesUntil = totalMinutes % 60;
  
  return {
    nextSendTime,
    nextSendTimeItaly,
    isToday: isBeforeSendTime,
    hoursUntil,
    minutesUntil
  };
}

/**
 * Calculate which template day to use based on current day and month length.
 * Uses dynamic template selection for end-of-month templates (28-31).
 * 
 * Strategy:
 * - Days 1-20: Always use fixed templates (1→1, 2→2, ..., 20→20)
 * - Days 21-27: Use fixed templates ONLY if we're not in the final 4 days
 * - Final 4 days: Use end-of-month templates (28, 29, 30, 31)
 * 
 * Examples:
 * - Month with 28 days: 1-20 fixed, 21-24 fixed, 25→28, 26→29, 27→30, 28→31
 * - Month with 30 days: 1-20 fixed, 21-26 fixed, 27→28, 28→29, 29→30, 30→31
 * - Month with 31 days: 1-20 fixed, 21-27 fixed, 28→28, 29→29, 30→30, 31→31
 * 
 * @param currentDay - Current day of the journey (1-31)
 * @param lastDayOfMonth - Last day of the current month (28, 29, 30, or 31)
 * @returns Template day to use (1-31)
 */
export function calculateTemplateDay(currentDay: number, lastDayOfMonth: number): number {
  // Days 1-20: Always use fixed templates
  if (currentDay <= 20) {
    return currentDay;
  }
  
  // Calculate distance from end of month
  const daysUntilEnd = lastDayOfMonth - currentDay;
  
  // Final 4 days of month: Use end-of-month templates (28, 29, 30, 31)
  if (daysUntilEnd === 3) {
    // 4th day from end -> "Final Week Sprint" (Template 28)
    return 28;
  } else if (daysUntilEnd === 2) {
    // 3rd day from end -> "Final Push" (Template 29)
    return 29;
  } else if (daysUntilEnd === 1) {
    // 2nd day from end -> "Month Closure Preparation" (Template 30)
    return 30;
  } else if (daysUntilEnd === 0) {
    // Last day of month -> "Month Closure" (Template 31)
    return 31;
  }
  
  // Days 21-27: Use fixed templates (only if not in final 4 days)
  // This handles the middle part of longer months
  if (currentDay <= 27) {
    return currentDay;
  }
  
  // Edge case: Day 28-31 in very long month but NOT in final 4 days
  // This should rarely happen with our 28-31 day range, but handle it gracefully
  // Use the last fixed template before end-of-month templates
  return 27;
}

// Configuration
const SCHEDULER_ENABLED = process.env.EMAIL_SCHEDULER_ENABLED !== "false"; // Enabled by default

export interface EmailSendResult {
  success: boolean;
  clientId: string;
  clientName: string;
  subject?: string;
  error?: string;
  drafted?: boolean; // true if email was drafted instead of sent
}

// Email sender using SMTP (configured per consultant)
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  consultantId: string;
}): Promise<void> {
  console.log(`📧 [SMTP] Preparing to send email to ${params.to}...`);
  
  // 1. Get consultant SMTP settings from database
  const smtpSettings = await storage.getConsultantSmtpSettings(params.consultantId);
  
  if (!smtpSettings || !smtpSettings.isActive) {
    console.warn(`⚠️  [SMTP] No active SMTP settings found for consultant ${params.consultantId}`);
    console.warn(`⚠️  [SMTP] Email to ${params.to} will NOT be sent`);
    console.warn(`⚠️  [SMTP] Consultant needs to configure SMTP settings to enable email sending`);
    return;
  }

  console.log(`🔧 [SMTP] Using SMTP settings for consultant ${params.consultantId}`);
  console.log(`   Host: ${smtpSettings.smtpHost}:${smtpSettings.smtpPort}`);
  console.log(`   Secure: ${smtpSettings.smtpSecure}`);
  console.log(`   User: ${smtpSettings.smtpUser}`);
  console.log(`   From: ${smtpSettings.fromEmail}`);

  // 2. Create nodemailer transporter with consultant's SMTP settings
  let transporter: Transporter;
  try {
    transporter = nodemailer.createTransport({
      host: smtpSettings.smtpHost,
      port: smtpSettings.smtpPort,
      secure: smtpSettings.smtpSecure, // true for 465, false for other ports (will use STARTTLS)
      auth: {
        user: smtpSettings.smtpUser,
        pass: smtpSettings.smtpPassword,
      },
      logger: false, // Set to true for debugging
      debug: false, // Set to true for debugging
    });

    console.log(`✓ [SMTP] Transporter created successfully`);
  } catch (error: any) {
    console.error(`❌ [SMTP] Failed to create transporter:`, error.message);
    throw new Error(`SMTP transporter creation failed: ${error.message}`);
  }

  // 3. Prepare email with proper from field
  const fromField = smtpSettings.fromName 
    ? `${smtpSettings.fromName} <${smtpSettings.fromEmail}>`
    : smtpSettings.fromEmail;

  // 4. Send email via SMTP
  try {
    console.log(`📨 [SMTP] Sending email via SMTP...`);
    
    const info = await transporter.sendMail({
      from: fromField,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    console.log(`✅ [SMTP] Email sent successfully to ${params.to}`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
  } catch (error: any) {
    console.error(`❌ [SMTP] Failed to send email to ${params.to}`);
    console.error(`   Error type: ${error.name || 'Unknown'}`);
    console.error(`   Error message: ${error.message}`);
    
    // Detailed error handling
    if (error.code === 'EAUTH') {
      console.error(`   🔐 Authentication failed - check SMTP username/password`);
      throw new Error(`SMTP authentication failed: Invalid credentials`);
    } else if (error.code === 'ECONNECTION') {
      console.error(`   🔌 Connection failed - check SMTP host and port`);
      throw new Error(`SMTP connection failed: Cannot reach server`);
    } else if (error.code === 'ETIMEDOUT') {
      console.error(`   ⏱️  Connection timeout - check network and firewall`);
      throw new Error(`SMTP timeout: Connection took too long`);
    } else if (error.responseCode) {
      console.error(`   📋 SMTP response code: ${error.responseCode}`);
      throw new Error(`SMTP error (${error.responseCode}): ${error.message}`);
    } else {
      throw new Error(`SMTP error: ${error.message}`);
    }
  }
}

// Get clients who should receive an email for a specific consultant
async function getClientsForEmail(consultantId: string): Promise<Array<{ id: string; email: string; firstName: string; consultantId: string }>> {
  try {
    // Get all active clients for this consultant
    const allClients = await storage.getClientsByConsultant(consultantId, true); // activeOnly = true
    
    // FILTER: Only include clients with automation enabled (enabled=true)
    // Clients with enabled=false should NOT receive any emails (not even drafts)
    const enabledClients = [];
    for (const client of allClients) {
      const clientAutomation = await storage.getClientEmailAutomation(consultantId, client.id);
      if (clientAutomation?.enabled) {
        enabledClients.push(client);
      } else {
        console.log(`🚫 ${client.firstName} - automation disabled, skipping entirely`);
      }
    }
    
    console.log(`📊 ${enabledClients.length}/${allClients.length} clients have automation enabled`);
    
    // Get SMTP settings for this consultant to get emailFrequencyDays
    const smtpSettings = await storage.getConsultantSmtpSettings(consultantId);
    const emailFrequencyDays = smtpSettings?.emailFrequencyDays || 2; // Default to 2 days if not configured
    
    // Calculate today's template day (with end-of-month remapping) using Italian timezone
    const now = getItalianNow();
    const currentDay = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const todayTemplateDay = calculateTemplateDay(currentDay, lastDayOfMonth);
    
    // Calculate next real send time using the dedicated function
    const { nextSendTimeItaly, isToday, hoursUntil, minutesUntil } = getNextSendTime();
    const nowTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const nextSendDateStr = nextSendTimeItaly.toLocaleDateString('it-IT');
    const nextSendTimeStr = `${nextSendTimeItaly.getHours().toString().padStart(2, '0')}:${nextSendTimeItaly.getMinutes().toString().padStart(2, '0')}`;
    const timeUntilStr = `${hoursUntil}h ${minutesUntil}m`;
    
    console.log(`📅 Italy: ${now.toLocaleDateString('it-IT')} ${nowTimeStr} → Calendar day ${currentDay}, Template ${todayTemplateDay}/${lastDayOfMonth}`);
    console.log(`⏰ Prossimo invio: ${isToday ? 'OGGI' : 'DOMANI'} ${nextSendDateStr} alle ${nextSendTimeStr} (tra ${timeUntilStr})`);
    
    // Check which clients should receive a new email for today's template
    const clientsToEmail = [];
    
    for (const client of enabledClients) {
      // Check if template for today already exists (as draft OR sent email)
      
      // 1. Check pending drafts for today's template
      const pendingDrafts = await storage.getPendingDraftsByClient(client.id);
      const todayDraft = pendingDrafts.find(
        draft => draft.emailType === 'motivation_reminder' && draft.journeyDay === todayTemplateDay
      );
      
      if (todayDraft) {
        console.log(`⏭️  ${client.firstName} - already has draft for template ${todayTemplateDay} (skipping)`);
        continue;
      }
      
      // 2. Check sent emails for today's template
      const allRecentEmails = await storage.getEmailLogsByClient(client.id, 31, true); // Get last month
      const todaySentEmail = allRecentEmails.find(email => {
        if (email.emailType !== 'motivation_reminder' || !email.sentAt) return false;
        
        const sentDate = new Date(email.sentAt);
        if (sentDate.getMonth() !== now.getMonth()) return false; // Different month
        
        // If journeyDay is set, use it directly
        if (email.journeyDay !== null && email.journeyDay !== undefined) {
          return email.journeyDay === todayTemplateDay;
        }
        
        // For old emails without journeyDay, calculate what template was used based on sent date
        const sentDay = sentDate.getDate();
        const sentMonthLastDay = new Date(sentDate.getFullYear(), sentDate.getMonth() + 1, 0).getDate();
        const sentTemplateDay = calculateTemplateDay(sentDay, sentMonthLastDay);
        
        return sentTemplateDay === todayTemplateDay;
      });
      
      if (todaySentEmail) {
        const sentDate = new Date(todaySentEmail.sentAt!);
        console.log(`⏭️  ${client.firstName} - already sent template ${todayTemplateDay} on ${sentDate.toLocaleDateString('it-IT')} (skipping)`);
        continue;
      }
      
      // 3. Check if enough time has passed since last email (frequency check)
      const recentJourneyEmails = allRecentEmails.filter(
        email => email.emailType !== 'consultation_summary'
      );
      
      if (recentJourneyEmails.length === 0) {
        // Never sent a journey email to this client - generate first email
        console.log(`📧 ${client.firstName} - never received journey email, generating template ${todayTemplateDay}`);
        clientsToEmail.push({
          id: client.id,
          email: client.email,
          firstName: client.firstName,
          consultantId: consultantId
        });
      } else {
        // Check if enough days have passed based on emailFrequencyDays
        const lastEmail = recentJourneyEmails[0];
        const lastEmailDate = lastEmail.sentAt ? new Date(lastEmail.sentAt) : new Date();
        
        // Calculate the scheduled send date (last email date + frequency days)
        const scheduledSendDateBase = new Date(lastEmailDate);
        scheduledSendDateBase.setDate(scheduledSendDateBase.getDate() + emailFrequencyDays);
        // Always set to 13:00 Italian time (Europe/Rome)
        const scheduledSendDate = setToItalianTime(scheduledSendDateBase);
        
        // Generate email only if current time is >= scheduled send time (13:00 of the scheduled day)
        if (now >= scheduledSendDate) {
          const daysSinceLastEmail = Math.floor((now.getTime() - lastEmailDate.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`📧 ${client.firstName} - ${daysSinceLastEmail} days since last email (frequency: ${emailFrequencyDays}), generating template ${todayTemplateDay}`);
          clientsToEmail.push({
            id: client.id,
            email: client.email,
            firstName: client.firstName,
            consultantId: consultantId
          });
        } else {
          const hoursUntilNext = Math.round((scheduledSendDate.getTime() - now.getTime()) / (1000 * 60 * 60));
          console.log(`⏰ ${client.firstName} - next email scheduled in ~${hoursUntilNext}h (${scheduledSendDate.toLocaleString('it-IT')}), then will generate template ${todayTemplateDay}`);
        }
      }
    }
    
    return clientsToEmail;
  } catch (error: any) {
    console.error("Error getting clients for email:", error);
    return [];
  }
}

// Send automated email to a single client
async function sendAutomatedEmailToClient(client: {
  id: string;
  email: string;
  firstName: string;
  consultantId: string;
}): Promise<EmailSendResult> {
  try {
    console.log(`📨 Processing automated email for client: ${client.firstName} (${client.id})`);
    
    // 1. Get SMTP settings to access emailTone
    const smtpSettings = await storage.getConsultantSmtpSettings(client.consultantId);
    const emailTone = smtpSettings?.emailTone || undefined;
    if (emailTone) {
      console.log(`🎨 Using email tone from SMTP settings: ${emailTone}`);
    }
    
    // 2. Get client state
    const state = await storage.getClientState(client.id, client.consultantId);
    if (!state) {
      console.log(`⏭️  Skipping ${client.firstName} - no client state configured`);
      return {
        success: false,
        clientId: client.id,
        clientName: client.firstName,
        error: "Client state not configured"
      };
    }
    
    // 2.5. Journey Progress - Get/create (for tracking email history)
    console.log(`📅 Managing Email Journey progress for ${client.firstName}...`);
    
    // Get or create journey progress (used for tracking previous emails/actions)
    let journeyProgress = await storage.getClientEmailJourneyProgress(client.consultantId, client.id);
    
    if (!journeyProgress) {
      console.log(`🆕 Creating new journey progress for ${client.firstName}`);
      journeyProgress = await storage.upsertClientEmailJourneyProgress(
        client.consultantId,
        client.id,
        {
          currentDay: 1,
          monthStartDate: new Date(),
        }
      );
    }
    
    // ⚡ USE CURRENT CALENDAR DAY in Italian timezone instead of journey counter
    const now = getItalianNow();
    const currentDay = now.getDate(); // Get day of month (1-31) from current date in Italian timezone
    
    // Calculate last day of current month
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    console.log(`📅 Calendario (Italy): ${now.toLocaleDateString('it-IT')} → Giorno ${currentDay}/${lastDayOfMonth} del mese`);
    
    // Use dynamic template selection based on calendar day
    const templateDay = calculateTemplateDay(currentDay, lastDayOfMonth);
    
    if (templateDay !== currentDay) {
      const daysUntilEnd = lastDayOfMonth - currentDay;
      console.log(`📅 Dynamic template: using template ${templateDay} for day ${currentDay} (${daysUntilEnd} giorni alla fine)`);
    }
    
    // Check for custom templates first, then fall back to defaults
    let journeyTemplate = null;
    
    if (smtpSettings?.useCustomTemplates) {
      journeyTemplate = await storage.getConsultantJourneyTemplate(client.consultantId, templateDay);
      if (journeyTemplate) {
        console.log(`📝 Using CUSTOM journey template: "${journeyTemplate.title}" (${journeyTemplate.emailType})`);
      }
    }
    
    // Fall back to default template if no custom template found
    if (!journeyTemplate) {
      journeyTemplate = await storage.getEmailJourneyTemplate(templateDay);
      if (journeyTemplate) {
        console.log(`📝 Using DEFAULT journey template: "${journeyTemplate.title}" (${journeyTemplate.emailType})`);
      }
    }
    
    if (!journeyTemplate) {
      console.warn(`⚠️  No journey template found for day ${templateDay} - will use generic email`);
    } else {
      // Log is already done above
    }
    
    // 2.6. Check if there's already a draft for TODAY's template (same templateDay)
    // IMPORTANT: We check using templateDay (not currentDay) because calculateTemplateDay()
    // may remap days (e.g., day 28 in a 30-day month uses template 29 for end-of-month logic)
    // This prevents duplicate generation of the same template on the same day
    // but allows generating new templates for new days even if old drafts are pending
    console.log(`🔍 Checking for existing draft for template day ${templateDay} (calendar day ${currentDay})...`);
    const pendingDrafts = await storage.getPendingDraftsByClient(client.id);
    
    // Filter for motivation_reminder drafts with the same templateDay as today
    const todayTemplateDrafts = pendingDrafts.filter(
      draft => draft.emailType === 'motivation_reminder' && draft.journeyDay === templateDay
    );
    
    if (todayTemplateDrafts.length > 0) {
      console.log(`⏭️  Skipping ${client.firstName} - already has draft for template ${templateDay} (prevents duplicates)`);
      console.log(`   📊 Other pending drafts: ${pendingDrafts.length - todayTemplateDrafts.length} from other templates`);
      return {
        success: true, // Not an error - just skipped to prevent duplicates
        clientId: client.id,
        clientName: client.firstName,
        error: `Draft for template day ${templateDay} already exists`,
        drafted: false
      };
    }
    
    const otherPendingDrafts = pendingDrafts.filter(
      draft => draft.emailType === 'motivation_reminder' && draft.journeyDay !== templateDay
    );
    if (otherPendingDrafts.length > 0) {
      console.log(`ℹ️  ${client.firstName} has ${otherPendingDrafts.length} pending draft(s) from other templates - still generating template ${templateDay}`);
    }
    console.log(`✓ No draft found for template ${templateDay} - proceeding with generation`);
    
    // 3. Get incomplete tasks
    const allTasks = await storage.getClientTasks(client.id, {});
    const incompleteTasks = allTasks.filter(t => !t.completed);
    
    // 4. Get active goals
    const allGoals = await storage.getGoalsByClient(client.id);
    const activeGoals = allGoals.filter(g => g.status === 'active');
    
    // 5. Get next consultation
    const consultations = await storage.getConsultationsByClient(client.id);
    // Reuse 'now' from journey calculation above
    const upcomingConsultations = consultations
      .filter(c => c.status === 'scheduled' && new Date(c.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    
    const nextConsultation = upcomingConsultations[0];
    
    let daysUntilNextConsultation = null;
    if (nextConsultation) {
      const consultationDate = new Date(nextConsultation.scheduledAt);
      
      // Check if consultation is on the same calendar day
      const nowDay = now.getDate();
      const nowMonth = now.getMonth();
      const nowYear = now.getFullYear();
      const consultationDay = consultationDate.getDate();
      const consultationMonth = consultationDate.getMonth();
      const consultationYear = consultationDate.getFullYear();
      
      if (nowYear === consultationYear && nowMonth === consultationMonth && nowDay === consultationDay) {
        // Same day - 0 days until consultation
        daysUntilNextConsultation = 0;
      } else {
        // Different day - calculate days difference
        const diffTime = consultationDate.getTime() - now.getTime();
        daysUntilNextConsultation = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }
    
    // 6. Generate email with AI using full context and journey template
    console.log(`🤖 Generating email with AI for ${client.firstName}...`);
    const emailContent = await generateMotivationalEmail({
      clientId: client.id,
      consultantId: client.consultantId,
      emailTone,
      clientName: client.firstName,
      currentState: state.currentState,
      idealState: state.idealState,
      internalBenefit: state.internalBenefit || "",
      externalBenefit: state.externalBenefit || "",
      mainObstacle: state.mainObstacle || "",
      incompleteTasks: incompleteTasks.map(t => ({
        title: t.title,
        dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString('it-IT') : null,
        priority: t.priority
      })),
      activeGoals: activeGoals.map(g => ({
        title: g.title,
        targetValue: g.targetValue,
        currentValue: g.currentValue || "0"
      })),
      daysUntilNextConsultation,
      motivationDrivers: state.motivationDrivers || undefined,
      // Journey-specific parameters
      journeyTemplate: journeyTemplate || undefined,
      previousEmailData: journeyProgress ? {
        lastEmailSubject: journeyProgress.lastEmailSubject || undefined,
        lastEmailBody: journeyProgress.lastEmailBody || undefined,
        lastEmailActions: journeyProgress.lastEmailActions || [],
        actionsCompletedData: journeyProgress.actionsCompletedData || { completed: false, details: [] },
      } : undefined,
    });
    
    // 7. Check automation settings and decide whether to send or draft
    console.log(`🔍 Checking automation settings...`);
    
    // We already have smtpSettings from step 1
    let shouldAutoSend = false;

    // Get client automation settings
    const clientAutomation = await storage.getClientEmailAutomation(client.consultantId, client.id);
    
    if (smtpSettings?.automationEnabled) {
      console.log(`✓ Consultant has automation enabled`);
      // Check if this specific client has automation enabled
      const clientEnabled = clientAutomation?.enabled || false;
      const clientSaveAsDraft = clientAutomation?.saveAsDraft || false;
      
      if (clientEnabled && !clientSaveAsDraft) {
        shouldAutoSend = true;
        console.log(`✓ Client has automation enabled and NOT set to draft - will send email directly`);
      } else if (clientEnabled && clientSaveAsDraft) {
        shouldAutoSend = false;
        console.log(`⏸️  Client has automation enabled but set to draft mode - will create draft for approval`);
      } else {
        console.log(`⏸️  Client automation disabled - will create draft for approval`);
      }
    } else {
      console.log(`⏸️  Consultant automation disabled - will create draft for approval`);
    }

    if (shouldAutoSend) {
      // Send email immediately (existing logic)
      console.log(`📧 Sending email to ${client.email}...`);
      await sendEmail({
        to: client.email,
        subject: emailContent.subject,
        html: emailContent.body,
        consultantId: client.consultantId
      });
      
      // Log email as sent
      console.log(`💾 Logging email for ${client.firstName}...`);
      await storage.createEmailLog({
        clientId: client.id,
        emailType: 'motivation_reminder',
        journeyDay: templateDay, // Track which template was used
        subject: emailContent.subject,
        body: emailContent.body,
        includesTasks: incompleteTasks.length > 0,
        includesGoals: activeGoals.length > 0,
        includesState: true,
        tasksCount: incompleteTasks.length,
        goalsCount: activeGoals.length
      });
      
      // Update journey progress after sending (including currentDay for DB sync)
      console.log(`📊 Updating journey progress (email sent)...`);
      await storage.upsertClientEmailJourneyProgress(
        client.consultantId,
        client.id,
        {
          currentDay, // Keep DB in sync with calendar-based currentDay
          lastEmailSentAt: now,
          lastTemplateUsedId: journeyTemplate?.id || null,
          lastEmailSubject: emailContent.subject,
          lastEmailBody: emailContent.body,
          lastEmailActions: emailContent.actions || [],
        }
      );
      
      console.log(`✅ Successfully sent automated email to ${client.firstName}`);
      
      return {
        success: true,
        clientId: client.id,
        clientName: client.firstName,
        subject: emailContent.subject,
        drafted: false
      };
    } else {
      // Create draft for manual approval
      const draftCreationTime = new Date();
      console.log(`📝 Creating email draft for ${client.firstName} at ${draftCreationTime.toISOString()}...`);
      console.log(`📝 Draft details: Consultant ID: ${client.consultantId}, Client ID: ${client.id}`);
      
      const draft = await storage.createEmailDraft({
        consultantId: client.consultantId,
        clientId: client.id,
        journeyTemplateId: journeyTemplate?.id || null,
        journeyDay: templateDay, // Use templateDay (after remapping) not currentDay for accurate tracking
        subject: emailContent.subject,
        body: emailContent.body,
        status: 'pending',
        emailType: 'motivation_reminder',
        includesTasks: incompleteTasks.length > 0,
        includesGoals: activeGoals.length > 0,
        includesState: true,
        tasksCount: incompleteTasks.length,
        goalsCount: activeGoals.length,
      });
      
      // Update journey progress after drafting (including currentDay for DB sync)
      console.log(`📊 Updating journey progress (draft created)...`);
      await storage.upsertClientEmailJourneyProgress(
        client.consultantId,
        client.id,
        {
          currentDay, // Keep DB in sync with calendar-based currentDay
          lastEmailSentAt: now,
          lastTemplateUsedId: journeyTemplate?.id || null,
          lastEmailSubject: emailContent.subject,
          lastEmailBody: emailContent.body,
          lastEmailActions: emailContent.actions || [],
        }
      );
      
      console.log(`✅ Email draft created successfully for client ${client.firstName}`);
      console.log(`✅ Draft ID: ${draft.id}, Generated at: ${draft.generatedAt}`);
      
      return {
        success: true,
        clientId: client.id,
        clientName: client.firstName,
        subject: emailContent.subject,
        drafted: true
      };
    }
  } catch (error: any) {
    console.error(`❌ Error sending email to ${client.firstName}:`, error);
    return {
      success: false,
      clientId: client.id,
      clientName: client.firstName,
      error: error.message || "Unknown error"
    };
  }
}

// Main function to send automated emails to all eligible clients
export async function sendAutomatedEmails(): Promise<{
  total: number;
  sent: number;
  failed: number;
  results: EmailSendResult[];
}> {
  // 🔍 Generate unique execution ID for tracking duplicates
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = new Date();
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📬 AUTOMATED EMAIL SCHEDULER - Starting");
  console.log(`🆔 Execution ID: ${executionId}`);
  console.log(`🏭 Process ID (PID): ${process.pid}`);
  console.log(`📅 ${startTime.toLocaleString('it-IT')}`);
  console.log(`🕐 Timestamp: ${startTime.toISOString()}`);
  console.log(`🔍 Stack trace (first 3 calls):`);
  const stack = new Error().stack?.split('\n').slice(1, 4).join('\n') || 'N/A';
  console.log(stack);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  if (!SCHEDULER_ENABLED) {
    console.log("⏸️  Email scheduler is disabled (EMAIL_SCHEDULER_ENABLED=false)");
    return { total: 0, sent: 0, failed: 0, results: [] };
  }
  
  try {
    // Get all consultants with retry logic (handles database sleep)
    console.log("🔍 Checking consultants with scheduler enabled...");
    const { withRetry } = await import('../db');
    const allConsultants = await withRetry(() => storage.getUsersByRole('consultant'));
    
    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;
    const allResults: EmailSendResult[] = [];
    
    // Process each consultant separately
    for (const consultant of allConsultants) {
      console.log(`\n📋 Checking consultant: ${consultant.firstName} ${consultant.lastName} (${consultant.id})`);
      
      // Get SMTP settings and check scheduler status (with retry)
      const smtpSettings = await withRetry(() => storage.getConsultantSmtpSettings(consultant.id));
      
      if (!smtpSettings || !smtpSettings.isActive) {
        console.log(`⏭️  Skipping - SMTP not configured or inactive`);
        continue;
      }
      
      // Check scheduler flags
      if (!smtpSettings.schedulerEnabled) {
        console.log(`⏸️  Skipping - Scheduler disabled for this consultant`);
        continue;
      }
      
      if (smtpSettings.schedulerPaused) {
        console.log(`⏸️  Skipping - Scheduler paused for this consultant`);
        continue;
      }
      
      // 🔒 Try to acquire atomic lock for this consultant (with retry)
      console.log(`🔒 [${executionId}] Attempting to acquire scheduler lock for ${consultant.firstName} (${consultant.id})...`);
      const lockAcquired = await withRetry(() => storage.acquireSchedulerLock(consultant.id));
      
      if (!lockAcquired) {
        console.log(`⏭️  [${executionId}] Lock not acquired - another instance is already processing this consultant. Skipping.`);
        continue;
      }
      
      console.log(`✅ [${executionId}] Lock acquired successfully! Processing emails for ${consultant.firstName}`);
      
      const executionStartTime = new Date();
      
      // 🔐 Wrap entire processing in try-finally to ensure lock is ALWAYS released
      try {
        // Get clients who should receive an email for this consultant (with retry)
        console.log(`🔍 Finding clients who need an email...`);
        const clients = await withRetry(() => getClientsForEmail(consultant.id));
        console.log(`📊 Found ${clients.length} clients eligible for email`);
        
        if (clients.length === 0) {
          console.log(`✓ No clients need emails at this time`);
          
          // Still log the execution
          await withRetry(() => storage.createSchedulerLog({
            consultantId: consultant.id,
            executedAt: executionStartTime,
            clientsProcessed: 0,
            emailsSent: 0,
            draftsCreated: 0,
            errors: 0,
            status: 'success',
            errorDetails: []
          }));
          
          // Update lastSchedulerRun and reset schedulerStatus (releases lock)
          const emailFrequencyDays = smtpSettings.emailFrequencyDays || 2;
          const nextRunBase = new Date(executionStartTime);
          nextRunBase.setDate(nextRunBase.getDate() + emailFrequencyDays);
          // Always set next run to 13:00 Italian time (Europe/Rome)
          const nextRun = setToItalianTime(nextRunBase);
          
          await withRetry(() => storage.updateSchedulerStatus(consultant.id, {
            lastSchedulerRun: executionStartTime,
            nextSchedulerRun: nextRun,
            schedulerStatus: "idle"
          }));
          
          continue;
        }
        
        // Send emails sequentially (to avoid rate limits)
        const results: EmailSendResult[] = [];
        
        for (let i = 0; i < clients.length; i++) {
          const client = clients[i];
          console.log(`\n[${i + 1}/${clients.length}] Processing: ${client.firstName}`);
          console.log("─".repeat(50));
          
          const result = await sendAutomatedEmailToClient(client);
          results.push(result);
          
          // Small delay between emails to avoid rate limits (1 second)
          if (i < clients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // Calculate stats
        const sent = results.filter(r => r.success && !r.drafted).length;
        const drafted = results.filter(r => r.success && r.drafted).length;
        const failed = results.filter(r => !r.success).length;
        
        // Log execution
        const errorDetails = results
          .filter(r => !r.success)
          .map(r => ({
            clientId: r.clientId,
            clientName: r.clientName,
            error: r.error || 'Unknown error'
          }));
        
        await withRetry(() => storage.createSchedulerLog({
          consultantId: consultant.id,
          executedAt: executionStartTime,
          clientsProcessed: clients.length,
          emailsSent: sent,
          draftsCreated: drafted,
          errors: failed,
          status: failed > 0 ? 'partial' : 'success',
          errorDetails: errorDetails
        }));
        
        // Update lastSchedulerRun, nextSchedulerRun and reset schedulerStatus (releases lock)
        const emailFrequencyDays = smtpSettings.emailFrequencyDays || 2;
        const nextRunBase = new Date(executionStartTime);
        nextRunBase.setDate(nextRunBase.getDate() + emailFrequencyDays);
        // Always set next run to 13:00 Italian time (Europe/Rome)
        const nextRun = setToItalianTime(nextRunBase);
        
        await withRetry(() => storage.updateSchedulerStatus(consultant.id, {
          lastSchedulerRun: executionStartTime,
          nextSchedulerRun: nextRun,
          schedulerStatus: "idle"
        }));
        
        console.log(`\n📊 Consultant ${consultant.firstName} Summary:`);
        console.log(`✅ Successfully sent: ${sent}/${clients.length}`);
        console.log(`📝 Drafts created: ${drafted}/${clients.length}`);
        console.log(`❌ Failed: ${failed}/${clients.length}`);
        
        totalProcessed += clients.length;
        totalSent += sent;
        totalFailed += failed;
        allResults.push(...results);
      } catch (error: any) {
        // Log the error but ensure we release the lock
        console.error(`❌ Error processing consultant ${consultant.firstName}:`, error);
        
        // Log the failed execution (with retry)
        await withRetry(() => storage.createSchedulerLog({
          consultantId: consultant.id,
          executedAt: executionStartTime,
          clientsProcessed: 0,
          emailsSent: 0,
          draftsCreated: 0,
          errors: 1,
          status: 'failed',
          errorDetails: [{
            clientId: 'N/A',
            clientName: 'N/A',
            error: error.message || 'Unknown error'
          }]
        }));
        
        // Don't rethrow - continue with next consultant
      } finally {
        // 🔓 ALWAYS release the lock, even if there was an error (with retry)
        console.log(`🔓 Releasing scheduler lock for ${consultant.firstName}...`);
        await withRetry(() => storage.releaseSchedulerLock(consultant.id));
        console.log(`✅ Lock released for ${consultant.firstName}`);
      }
    }
    
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 AUTOMATED EMAIL SCHEDULER - Global Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📋 Total clients processed: ${totalProcessed}`);
    console.log(`✅ Total emails sent: ${totalSent}`);
    console.log(`📝 Total drafts created: ${allResults.filter(r => r.drafted).length}`);
    console.log(`❌ Total failed: ${totalFailed}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    return {
      total: totalProcessed,
      sent: totalSent,
      failed: totalFailed,
      results: allResults
    };
  } catch (error: any) {
    console.error("\n❌ Fatal error in email scheduler:", error);
    return {
      total: 0,
      sent: 0,
      failed: 0,
      results: []
    };
  }
}

// Test function - sends email to a specific client (for testing)
export async function sendTestEmail(clientId: string): Promise<EmailSendResult> {
  const user = await storage.getUser(clientId);
  
  if (!user || user.role !== 'client') {
    throw new Error("User not found or not a client");
  }
  
  if (!user.consultantId) {
    throw new Error("Client has no assigned consultant");
  }
  
  return sendAutomatedEmailToClient({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    consultantId: user.consultantId
  });
}
