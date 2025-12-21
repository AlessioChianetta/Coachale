import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { z } from "zod";
import { sendEmail } from "../services/email-scheduler";
import { db } from "../db";
import { automatedEmailsLog, users, systemSettings } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

// Track ongoing scheduler executions to prevent parallel runs for the same consultant
const ongoingExecutions = new Set<string>();

// GET /api/email-tracking/:trackingId/:emailLogId - Track email opens (no auth required)
router.get("/email-tracking/:trackingId/:emailLogId", async (req, res) => {
  try {
    const { trackingId, emailLogId } = req.params;

    // Validate tracking ID to prevent unauthorized tracking
    const { validateTrackingId } = await import("../services/email-html-wrapper");

    if (!validateTrackingId(trackingId, emailLogId)) {
      console.warn(`⚠️  [EMAIL TRACKING] Invalid tracking ID for email: ${emailLogId}`);
      // Still return pixel to not break email rendering
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );
      res.writeHead(200, { 'Content-Type': 'image/gif' });
      return res.end(pixel);
    }

    console.log(`📧 [EMAIL TRACKING] Email opened - Log ID: ${emailLogId}`);

    // Update openedAt timestamp if not already set
    await db
      .update(automatedEmailsLog)
      .set({ openedAt: sql`COALESCE(opened_at, now())` }) // Only set if null
      .where(eq(automatedEmailsLog.id, emailLogId));

    console.log(`✅ [EMAIL TRACKING] Updated openedAt for email log: ${emailLogId}`);

    // Return 1x1 transparent GIF pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );

    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(pixel);
  } catch (error: any) {
    console.error('❌ [EMAIL TRACKING] Error:', error);
    // Still return pixel even on error to not break email rendering
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.writeHead(200, { 'Content-Type': 'image/gif' });
    res.end(pixel);
  }
});

// GET /api/consultant/email-logs - Get email logs with client names (consultant only)
router.get("/consultant/email-logs", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { clientId, type } = req.query;

    // Get all recent logs (last 90 days) for consultant's clients
    let logs = await storage.getRecentEmailLogs(90);

    // Filter to only show logs for consultant's clients
    const consultantClients = await storage.getClientsByConsultant(req.user!.id);
    const clientIds = new Set(consultantClients.map(c => c.id));
    logs = logs.filter(log => clientIds.has(log.clientId));

    // Filter by clientId if provided
    if (clientId) {
      logs = logs.filter(log => log.clientId === clientId);
    }

    // Filter by type if provided
    if (type && type !== "all") {
      logs = logs.filter(log => log.emailType === type);
    }

    // Add client names to logs
    const logsWithClientNames = await Promise.all(
      logs.map(async (log) => {
        const client = await storage.getUser(log.clientId);
        return {
          id: log.id,
          clientId: log.clientId,
          clientName: client ? `${client.firstName} ${client.lastName}` : "Unknown",
          subject: log.subject,
          body: log.body,
          status: "sent" as const, // All logs are sent emails
          emailType: log.emailType,
          sentAt: log.sentAt ? log.sentAt.toISOString() : new Date().toISOString(),
          openedAt: log.openedAt ? log.openedAt.toISOString() : null,
          isTest: log.isTest || false,
        };
      })
    );

    res.json(logsWithClientNames);
  } catch (error: any) {
    console.error("❌ [EMAIL LOGS] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch email logs"
    });
  }
});

// GET /api/automated-emails/logs - Get email logs (consultant only)
router.get("/automated-emails/logs", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { clientId, days } = req.query;

    let logs;

    if (clientId) {
      // Get logs for specific client
      const client = await storage.getUser(clientId as string);

      if (!client) {
        return res.status(404).json({
          success: false,
          error: "Client not found"
        });
      }

      // Verify consultant owns this client
      if (client.consultantId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: "Access denied - this is not your client"
        });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      logs = await storage.getEmailLogsByClient(clientId as string, limit);
    } else if (days) {
      // Get recent logs across all clients
      const daysSince = parseInt(days as string);
      if (isNaN(daysSince) || daysSince < 1 || daysSince > 365) {
        return res.status(400).json({
          success: false,
          error: "Invalid days parameter (must be between 1 and 365)"
        });
      }

      logs = await storage.getRecentEmailLogs(daysSince);

      // Filter to only show logs for consultant's clients
      const consultantClients = await storage.getClientsByConsultant(req.user!.id);
      const clientIds = new Set(consultantClients.map(c => c.id));
      logs = logs.filter(log => clientIds.has(log.clientId));
    } else {
      // Get all recent logs (last 30 days) for consultant's clients
      logs = await storage.getRecentEmailLogs(30);

      const consultantClients = await storage.getClientsByConsultant(req.user!.id);
      const clientIds = new Set(consultantClients.map(c => c.id));
      logs = logs.filter(log => clientIds.has(log.clientId));
    }

    res.json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch email logs"
    });
  }
});

// POST /api/automated-emails/preview - Generate email preview using AI
router.post("/automated-emails/preview", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "clientId is required"
      });
    }

    // Verify client exists
    const client = await storage.getUser(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }

    // Verify consultant owns this client
    if (client.consultantId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied - this is not your client"
      });
    }

    // Get client state
    const state = await storage.getClientState(clientId, req.user!.id);
    if (!state) {
      return res.status(404).json({
        success: false,
        error: "Client state not configured. Please set up client state first."
      });
    }

    // Get incomplete tasks
    const allTasks = await storage.getClientTasks(clientId, {});
    const incompleteTasks = allTasks.filter(t => !t.completed);

    // Get active goals
    const allGoals = await storage.getGoalsByClient(clientId);
    const activeGoals = allGoals.filter(g => g.status === 'active');

    // Get next consultation
    const consultations = await storage.getConsultationsByClient(clientId);
    const now = new Date();
    const upcomingConsultations = consultations
      .filter(c => c.status === 'scheduled' && new Date(c.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const nextConsultation = upcomingConsultations[0];

    // Calculate days until next consultation using precise date-only comparison
    let daysUntilNextConsultation: number | null = null;
    if (nextConsultation) {
      // Import date-fns at top of file if not already imported
      const { startOfDay, differenceInCalendarDays } = await import('date-fns');

      const now = new Date();
      const consultationDate = new Date(nextConsultation.scheduledAt);

      // Compare only dates, not times, to get accurate day count
      const todayStart = startOfDay(now);
      const consultationDayStart = startOfDay(consultationDate);

      // differenceInCalendarDays gives exact calendar day difference
      daysUntilNextConsultation = differenceInCalendarDays(consultationDayStart, todayStart);

      console.log(`📅 Next consultation for ${client.firstName}:`, {
        consultationDate: consultationDate.toISOString(),
        consultationDateOnly: consultationDayStart.toISOString(),
        now: now.toISOString(),
        nowDateOnly: todayStart.toISOString(),
        daysUntil: daysUntilNextConsultation,
        calculationMethod: 'differenceInCalendarDays (date-fns)'
      });
    }

    // Get consultant SMTP settings for email tone
    const smtpSettings = await storage.getConsultantSmtpSettings(req.user!.id);

    // Import email generator
    let emailPreview;
    try {
      const { generateMotivationalEmail } = await import("../ai/email-template-generator");

      emailPreview = await generateMotivationalEmail({
        clientId,
        consultantId: req.user!.id,
        emailTone: smtpSettings?.emailTone || undefined,
        clientName: client.firstName,
        currentState: state.currentState,
        idealState: state.idealState,
        internalBenefit: state.internalBenefit || "",
        externalBenefit: state.externalBenefit || "",
        mainObstacle: state.mainObstacle || "",
        pastAttempts: state.pastAttempts || undefined,
        currentActions: state.currentActions || undefined,
        futureVision: state.futureVision || undefined,
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
        motivationDrivers: state.motivationDrivers || undefined
      });
    } catch (importError) {
      // AI service not yet available - return placeholder
      emailPreview = {
        subject: `${client.firstName}, ricordiamoci dove stai andando 🎯`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Ciao ${client.firstName}! 👋</h2>
            <p>Questa è un'anteprima. Il servizio AI per generare email personalizzate sarà disponibile a breve.</p>

            <h3>📊 Il tuo stato attuale:</h3>
            <p>${state.currentState}</p>

            <h3>🎯 Dove vuoi arrivare:</h3>
            <p>${state.idealState}</p>

            <h3>✅ Task da completare (${incompleteTasks.length}):</h3>
            <ul>
              ${incompleteTasks.slice(0, 5).map(t => `<li>${t.title}</li>`).join('')}
            </ul>

            <h3>🎯 Obiettivi attivi (${activeGoals.length}):</h3>
            <ul>
              ${activeGoals.slice(0, 3).map(g => `<li>${g.title}: ${g.currentValue} → ${g.targetValue}</li>`).join('')}
            </ul>
          </div>
        `,
        preview: `Ciao ${client.firstName}! Ti ricordo dove sei e dove stai andando...`
      };
    }

    res.json({
      success: true,
      data: {
        ...emailPreview,
        context: {
          clientName: client.firstName,
          incompleteTasks: incompleteTasks.length,
          activeGoals: activeGoals.length,
          daysUntilNextConsultation,
          motivationDrivers: state.motivationDrivers
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate email preview"
    });
  }
});

// POST /api/consultant/ai-email/test-generate - Generate and send test email to custom address
router.post("/consultant/ai-email/test-generate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { clientId, testEmail, testDay } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "clientId is required"
      });
    }

    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: "testEmail is required"
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return res.status(400).json({
        success: false,
        error: "Invalid test email address"
      });
    }

    // Validate testDay if provided
    if (testDay !== undefined && (testDay < 1 || testDay > 31)) {
      return res.status(400).json({
        success: false,
        error: "testDay must be between 1 and 31"
      });
    }

    // Verify client exists
    const client = await storage.getUser(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }

    // Verify consultant owns this client
    if (client.consultantId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied - this is not your client"
      });
    }

    // Get client state
    const state = await storage.getClientState(clientId, req.user!.id);
    if (!state) {
      return res.status(404).json({
        success: false,
        error: "Client state not configured. Please set up client state first."
      });
    }

    // Get incomplete tasks
    const allTasks = await storage.getClientTasks(clientId, {});
    const incompleteTasks = allTasks.filter(t => !t.completed);

    // Get active goals
    const allGoals = await storage.getGoalsByClient(clientId);
    const activeGoals = allGoals.filter(g => g.status === 'active');

    // Get next consultation
    const consultations = await storage.getConsultationsByClient(clientId);
    const now = new Date();
    const upcomingConsultations = consultations
      .filter(c => c.status === 'scheduled' && new Date(c.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const nextConsultation = upcomingConsultations[0];

    // Calculate days until next consultation using precise date-only comparison
    let daysUntilNextConsultation: number | null = null;
    if (nextConsultation) {
      // Import date-fns at top of file if not already imported
      const { startOfDay, differenceInCalendarDays } = await import('date-fns');

      const now = new Date();
      const consultationDate = new Date(nextConsultation.scheduledAt);

      // Compare only dates, not times, to get accurate day count
      const todayStart = startOfDay(now);
      const consultationDayStart = startOfDay(consultationDate);

      // differenceInCalendarDays gives exact calendar day difference
      daysUntilNextConsultation = differenceInCalendarDays(consultationDayStart, todayStart);

      console.log(`📅 Next consultation for ${client.firstName}:`, {
        consultationDate: consultationDate.toISOString(),
        consultationDateOnly: consultationDayStart.toISOString(),
        now: now.toISOString(),
        nowDateOnly: todayStart.toISOString(),
        daysUntil: daysUntilNextConsultation,
        calculationMethod: 'differenceInCalendarDays (date-fns)'
      });
    }

    // Get consultant SMTP settings for email tone
    const smtpSettings = await storage.getConsultantSmtpSettings(req.user!.id);

    if (!smtpSettings) {
      return res.status(400).json({
        success: false,
        error: "SMTP settings not configured. Please configure SMTP first."
      });
    }

    let emailContent: { subject: string; body: string; preview: string };
    let usedJourneyTemplate = false;
    let journeyDay = testDay;

    // If testDay is provided, use journey template system
    if (testDay !== undefined && testDay >= 1 && testDay <= 31) {
      console.log(`🧪 [TEST EMAIL] Using journey template for day ${testDay}`);

      // Get journey template for this day
      const template = await storage.getEmailJourneyTemplateByDay(testDay);

      if (!template || !template.isActive) {
        return res.status(404).json({
          success: false,
          error: `No active journey template found for day ${testDay}`
        });
      }

      console.log(`✅ [TEST EMAIL] Found template: ${template.title} (${template.emailType})`);

      // Import AI email generator
      const { generateMotivationalEmail } = await import("../ai/email-template-generator");

      // Generate email using journey template
      emailContent = await generateMotivationalEmail({
        clientId,
        consultantId: req.user!.id,
        journeyTemplate: template,
        clientName: client.firstName,
        currentState: state.currentState,
        idealState: state.idealState,
        internalBenefit: state.internalBenefit || "",
        externalBenefit: state.externalBenefit || "",
        mainObstacle: state.mainObstacle || "",
        pastAttempts: state.pastAttempts || undefined,
        currentActions: state.currentActions || undefined,
        futureVision: state.futureVision || undefined,
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
        motivationDrivers: state.motivationDrivers || undefined
      });

      usedJourneyTemplate = true;

      // Update journey progress to mark this day as tested
      await storage.upsertClientEmailJourneyProgress(clientId, {
        currentDay: testDay,
        lastEmailSentAt: new Date(),
        lastEmailAction: `Test email giorno ${testDay} - ${template.title}`
      });

    } else {
      // Use generic motivational email if no testDay specified
      console.log(`🧪 [TEST EMAIL] Using generic motivational email (no testDay specified)`);

      const { generateMotivationalEmail } = await import("../ai/email-template-generator");

      emailContent = await generateMotivationalEmail({
        clientId,
        consultantId: req.user!.id,
        emailTone: smtpSettings.emailTone || undefined,
        clientName: client.firstName,
        currentState: state.currentState,
        idealState: state.idealState,
        internalBenefit: state.internalBenefit || "",
        externalBenefit: state.externalBenefit || "",
        mainObstacle: state.mainObstacle || "",
        pastAttempts: state.pastAttempts || undefined,
        currentActions: state.currentActions || undefined,
        futureVision: state.futureVision || undefined,
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
        motivationDrivers: state.motivationDrivers || undefined
      });
    }

    // Save test email to log FIRST to get ID for tracking
    const emailLog = await storage.createEmailLog({
      clientId,
      emailType: 'motivational',
      journeyDay: usedJourneyTemplate ? journeyDay : undefined, // Only set if using journey template
      subject: `[TEST] ${emailContent.subject}`,
      body: emailContent.body,
      includesTasks: incompleteTasks.length > 0,
      includesGoals: activeGoals.length > 0,
      includesState: true,
      tasksCount: incompleteTasks.length,
      goalsCount: activeGoals.length,
      isTest: true
    });

    // Generate tracking pixel URL
    const { generateTrackingPixelUrl, enhanceEmailTypography } = await import("../services/email-html-wrapper");
    const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000';
    const trackingPixelUrl = generateTrackingPixelUrl(emailLog.id, baseUrl);

    // Add test banner with tracking pixel
    const testBanner = `
      <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
        <h3 style="color: #856404; margin: 0 0 10px 0;">🧪 EMAIL DI TEST ${usedJourneyTemplate ? `- GIORNO ${journeyDay}` : ''}</h3>
        <p style="color: #856404; margin: 0; font-size: 14px;">
          Questa è un'email di test generata con i dati del cliente <strong>${client.firstName} ${client.lastName}</strong>.<br>
          ${usedJourneyTemplate ? `🗓️ <strong>Journey Template Giorno ${journeyDay}</strong> - Sistema email journey attivo<br>` : '📧 <strong>Email motivazionale generica</strong> (nessun giorno journey specificato)<br>'}
          Email destinatario test: <strong>${testEmail}</strong><br>
          Email cliente reale: <strong>${client.email}</strong> (NON riceverà questa email)
        </p>
      </div>
    `;

    const htmlWithTracking = enhanceEmailTypography(
      `${testBanner}${emailContent.body}`,
      trackingPixelUrl
    );

    // Send test email with tracking
    await sendEmail({
      to: testEmail,
      subject: `[TEST] ${emailContent.subject}`,
      html: htmlWithTracking,
      consultantId: req.user!.id
    });

    res.json({
      success: true,
      message: usedJourneyTemplate 
        ? `Email journey giorno ${journeyDay} inviata a ${testEmail}` 
        : `Email di test inviata a ${testEmail}`,
      data: {
        subject: emailContent.subject,
        preview: emailContent.preview,
        testRecipient: testEmail,
        clientName: `${client.firstName} ${client.lastName}`,
        clientEmail: client.email,
        sentAt: new Date().toISOString(),
        emailLogId: emailLog.id,
        journeyDay: usedJourneyTemplate ? journeyDay : null,
        usedJourneyTemplate
      }
    });

  } catch (error: any) {
    console.error("❌ [TEST EMAIL] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate and send test email"
    });
  }
});

// GET /api/consultant/client-automation-status - Get automation status and next email for all clients
router.get("/consultant/client-automation-status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    // Get consultant's SMTP settings for email frequency
    const smtpSettings = await storage.getConsultantSmtpSettings(req.user!.id);
    const emailFrequencyDays = smtpSettings?.emailFrequencyDays || 2; // Default 2 days
    const automationEnabled = smtpSettings?.automationEnabled || false;

    // Get only active clients
    const clients = await storage.getClientsByConsultant(req.user!.id, true); // activeOnly = true

    // For each client, get automation status and calculate next email
    const clientsStatus = await Promise.all(
      clients.map(async (client) => {
        // Get client automation settings
        const clientAutomation = await storage.getClientEmailAutomation(req.user!.id, client.id);

        // Get last sent email
        const allLogs = await storage.getRecentEmailLogs(90);
        const clientLogs = allLogs
          .filter(log => log.clientId === client.id && !log.isTest)
          .sort((a, b) => {
            const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
            const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
            return dateB - dateA;
          });

        const lastEmail = clientLogs[0];
        const lastEmailDate = lastEmail?.sentAt ? new Date(lastEmail.sentAt) : null;

        // Calculate next email date
        let nextEmailDate = null;
        let daysUntilNext = null;

        if (lastEmailDate) {
          nextEmailDate = new Date(lastEmailDate);
          nextEmailDate.setDate(nextEmailDate.getDate() + emailFrequencyDays);

          const now = new Date();
          const diffTime = nextEmailDate.getTime() - now.getTime();
          daysUntilNext = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } else {
          // No email sent yet - next email could be sent now
          daysUntilNext = 0;
        }

        return {
          id: client.id,
          name: `${client.firstName} ${client.lastName}`,
          email: client.email,
          isActive: client.isActive || false,
          automationEnabled: clientAutomation?.enabled || false,
          lastEmailSentAt: lastEmailDate ? lastEmailDate.toISOString() : null,
          nextEmailDate: nextEmailDate ? nextEmailDate.toISOString() : null,
          daysUntilNext,
          emailsSentCount: clientLogs.length
        };
      })
    );

    res.json({
      success: true,
      automationEnabled,
      emailFrequencyDays,
      clients: clientsStatus
    });

  } catch (error: any) {
    console.error("❌ [CLIENT AUTOMATION STATUS] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch client automation status"
    });
  }
});

// POST /api/consultant/email-drafts/generate - Generate email as draft (manual generation)
router.post("/consultant/email-drafts/generate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "clientId is required"
      });
    }

    // Verify client exists
    const client = await storage.getUser(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }

    // Verify consultant owns this client
    if (client.consultantId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied - this is not your client"
      });
    }

    // Get client state
    const state = await storage.getClientState(clientId, req.user!.id);
    if (!state) {
      return res.status(404).json({
        success: false,
        error: "Client state not configured. Please set up client state first."
      });
    }

    // Get incomplete tasks
    const allTasks = await storage.getClientTasks(clientId, {});
    const incompleteTasks = allTasks.filter(t => !t.completed);

    // Get active goals
    const allGoals = await storage.getGoalsByClient(clientId);
    const activeGoals = allGoals.filter(g => g.status === 'active');

    // Get next consultation
    const consultations = await storage.getConsultationsByClient(clientId);
    const now = new Date();
    const upcomingConsultations = consultations
      .filter(c => c.status === 'scheduled' && new Date(c.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const nextConsultation = upcomingConsultations[0];

    // Calculate days until next consultation using precise date-only comparison
    let daysUntilNextConsultation: number | null = null;
    if (nextConsultation) {
      // Import date-fns at top of file if not already imported
      const { startOfDay, differenceInCalendarDays } = await import('date-fns');

      const now = new Date();
      const consultationDate = new Date(nextConsultation.scheduledAt);

      // Compare only dates, not times, to get accurate day count
      const todayStart = startOfDay(now);
      const consultationDayStart = startOfDay(consultationDate);

      // differenceInCalendarDays gives exact calendar day difference
      daysUntilNextConsultation = differenceInCalendarDays(consultationDayStart, todayStart);

      console.log(`📅 Next consultation for ${client.firstName}:`, {
        consultationDate: consultationDate.toISOString(),
        consultationDateOnly: consultationDayStart.toISOString(),
        now: now.toISOString(),
        nowDateOnly: todayStart.toISOString(),
        daysUntil: daysUntilNextConsultation,
        calculationMethod: 'differenceInCalendarDays (date-fns)'
      });
    }

    // Get consultant SMTP settings for email tone
    const smtpSettings = await storage.getConsultantSmtpSettings(req.user!.id);

    // Generate email with AI
    console.log(`🤖 Generating email for draft (manual) - Client: ${client.firstName}`);
    const { generateMotivationalEmail } = await import("../ai/email-template-generator");

    const emailContent = await generateMotivationalEmail({
      clientId,
      consultantId: req.user!.id,
      emailTone: smtpSettings?.emailTone || undefined,
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
      motivationDrivers: state.motivationDrivers || undefined
    });

    // Create draft
    console.log(`📝 Creating email draft for ${client.firstName}...`);
    const draft = await storage.createEmailDraft({
      consultantId: req.user!.id,
      clientId,
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

    console.log(`✅ Email draft created successfully (ID: ${draft.id})`);

    res.json({
      success: true,
      message: `Bozza email creata per ${client.firstName} ${client.lastName}`,
      data: {
        draftId: draft.id,
        clientName: `${client.firstName} ${client.lastName}`,
        subject: emailContent.subject,
        preview: emailContent.preview
      }
    });

  } catch (error: any) {
    console.error("❌ [GENERATE DRAFT] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate email draft"
    });
  }
});

// POST /api/consultant/email-drafts/generate-series - Generate N emails as drafts (test variety)
router.post("/consultant/email-drafts/generate-series", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { clientId, count = 4 } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "clientId is required"
      });
    }

    if (count < 1 || count > 10) {
      return res.status(400).json({
        success: false,
        error: "count must be between 1 and 10"
      });
    }

    // Verify client exists
    const client = await storage.getUser(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }

    // Verify consultant owns this client
    if (client.consultantId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied - this is not your client"
      });
    }

    // Get client state
    const state = await storage.getClientState(clientId, req.user!.id);
    if (!state) {
      return res.status(404).json({
        success: false,
        error: "Client state not configured. Please set up client state first."
      });
    }

    // Get tasks and goals once (same for all emails)
    const allTasks = await storage.getClientTasks(clientId, {});
    const incompleteTasks = allTasks.filter(t => !t.completed);
    const allGoals = await storage.getGoalsByClient(clientId);
    const activeGoals = allGoals.filter(g => g.status === 'active');

    // Get next consultation
    const consultations = await storage.getConsultationsByClient(clientId);
    const now = new Date();
    const upcomingConsultations = consultations
      .filter(c => c.status === 'scheduled' && new Date(c.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const nextConsultation = upcomingConsultations[0];
    // Calculate days until next consultation using precise date-only comparison
    let daysUntilNextConsultation: number | null = null;
    if (nextConsultation) {
      // Import date-fns at top of file if not already imported
      const { startOfDay, differenceInCalendarDays } = await import('date-fns');

      const now = new Date();
      const consultationDate = new Date(nextConsultation.scheduledAt);

      // Compare only dates, not times, to get accurate day count
      const todayStart = startOfDay(now);
      const consultationDayStart = startOfDay(consultationDate);

      // differenceInCalendarDays gives exact calendar day difference
      daysUntilNextConsultation = differenceInCalendarDays(consultationDayStart, todayStart);

      console.log(`📅 Next consultation for ${client.firstName}:`, {
        consultationDate: consultationDate.toISOString(),
        consultationDateOnly: consultationDayStart.toISOString(),
        now: now.toISOString(),
        nowDateOnly: todayStart.toISOString(),
        daysUntil: daysUntilNextConsultation,
        calculationMethod: 'differenceInCalendarDays (date-fns)'
      });
    }


    // Get consultant SMTP settings
    const smtpSettings = await storage.getConsultantSmtpSettings(req.user!.id);
    const { generateMotivationalEmail } = await import("../ai/email-template-generator");

    console.log(`🤖 Generating ${count} email drafts for ${client.firstName}...`);

    const drafts = [];

    for (let i = 0; i < count; i++) {
      console.log(`📧 [${i + 1}/${count}] Generating email...`);

      // Generate email with AI
      const emailContent = await generateMotivationalEmail({
        clientId,
        consultantId: req.user!.id,
        emailTone: smtpSettings?.emailTone || undefined,
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
        motivationDrivers: state.motivationDrivers || undefined
      });

      // Create draft
      const draft = await storage.createEmailDraft({
        consultantId: req.user!.id,
        clientId,
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

      drafts.push({
        id: draft.id,
        subject: emailContent.subject,
        preview: emailContent.preview
      });

      console.log(`✅ [${i + 1}/${count}] Draft created: ${emailContent.subject.substring(0, 50)}...`);

      // Small delay to avoid rate limits (500ms between each)
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Generated ${count} email drafts for ${client.firstName}`);

    res.json({
      success: true,
      message: `${count} bozze email create per ${client.firstName} ${client.lastName}`,
      data: {
        clientName: `${client.firstName} ${client.lastName}`,
        count: drafts.length,
        drafts
      }
    });

  } catch (error: any) {
    console.error("❌ [GENERATE SERIES] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate email series"
    });
  }
});

// API 1: GET /api/consultant/email-drafts - Get all email drafts for consultant
router.get("/consultant/email-drafts", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { status, emailType } = req.query;

    const drafts = await storage.getEmailDraftsByConsultant(
      req.user!.id,
      status as string | undefined
    );

    // Filter by emailType if provided (e.g., "consultation_summary")
    let filteredDrafts = drafts;
    if (emailType) {
      filteredDrafts = drafts.filter(draft => draft.emailType === emailType);
    }

    // Ensure metadata is always an object (parse if string)
    const normalizedDrafts = filteredDrafts.map(draft => ({
      ...draft,
      metadata: typeof draft.metadata === 'string' 
        ? JSON.parse(draft.metadata) 
        : (draft.metadata || {})
    }));

    res.json({
      success: true,
      data: normalizedDrafts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch email drafts"
    });
  }
});

// API 2: POST /api/consultant/email-drafts/:id/approve - Approve and send draft
router.post("/consultant/email-drafts/:id/approve", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const draft = await storage.getEmailDraft(id);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: "Email draft not found"
      });
    }

    if (draft.consultantId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied - this is not your draft"
      });
    }

    if (draft.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Cannot approve draft with status: ${draft.status}`
      });
    }

    await storage.updateEmailDraftStatus(id, "approved");

    const client = await storage.getUser(draft.clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }

    // Save email to log FIRST to get ID for tracking
    const emailLog = await storage.createEmailLog({
      clientId: draft.clientId,
      emailType: draft.emailType,
      journeyDay: draft.journeyDay || undefined, // Track which template was used
      subject: draft.subject,
      body: draft.body,
      includesTasks: draft.includesTasks || false,
      includesGoals: draft.includesGoals || false,
      includesState: draft.includesState || false,
      tasksCount: draft.tasksCount || 0,
      goalsCount: draft.goalsCount || 0,
      isTest: false
    });

    // Generate tracking pixel URL and enhance HTML
    const { generateTrackingPixelUrl, enhanceEmailTypography } = await import("../services/email-html-wrapper");
    const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000';
    const trackingPixelUrl = generateTrackingPixelUrl(emailLog.id, baseUrl);
    const htmlWithTracking = enhanceEmailTypography(draft.body, trackingPixelUrl);

    // Send email with tracking pixel
    await sendEmail({
      to: client.email,
      subject: draft.subject,
      html: htmlWithTracking,
      consultantId: req.user!.id
    });

    await storage.updateEmailDraftStatus(id, "sent", new Date());

    // If this is a consultation summary email, save it to the consultation record and sync status
    if (draft.emailType === "consultation_summary" && draft.consultationId) {
      console.log(`📋 Saving consultation summary email to consultation ${draft.consultationId}`);
      try {
        await storage.updateConsultation(draft.consultationId, {
          summaryEmail: draft.body,
          summaryEmailStatus: "sent",
          summaryEmailSentAt: new Date()
        });
        console.log(`✅ Consultation summary email saved and status synced to ECHO system`);
      } catch (error: any) {
        console.error(`❌ Failed to save consultation summary email:`, error);
        // Don't fail the whole operation, just log the error
      }
    }

    res.json({
      success: true,
      message: "Email approved and sent"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to approve and send email"
    });
  }
});

// API 2b: POST /api/consultant/email-drafts/:id/save-for-ai - Save consultation summary for AI without sending
router.post("/consultant/email-drafts/:id/save-for-ai", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const draft = await storage.getEmailDraft(id);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: "Email draft not found"
      });
    }

    if (draft.consultantId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied - this is not your draft"
      });
    }

    if (draft.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Cannot save draft with status: ${draft.status}`
      });
    }

    // Verify this is a consultation summary email
    if (draft.emailType !== "consultation_summary") {
      return res.status(400).json({
        success: false,
        error: "This action is only available for consultation summary emails"
      });
    }

    // Verify consultationId exists (it's a direct column in the draft table)
    if (!draft.consultationId) {
      return res.status(400).json({
        success: false,
        error: "Consultation ID not found in draft"
      });
    }

    console.log(`💾 [SAVE FOR AI] Saving consultation summary to consultation ${draft.consultationId}`);
    console.log(`💾 [SAVE FOR AI] Draft ID: ${id}`);
    console.log(`💾 [SAVE FOR AI] Client ID: ${draft.clientId}`);

    // Save email to consultation record for AI context (NOT sending to client)
    // Also sync summaryEmailStatus to "approved" so ECHO recognizes this consultation is handled
    try {
      await storage.updateConsultation(draft.consultationId, {
        summaryEmail: draft.body,
        summaryEmailGeneratedAt: new Date(),
        summaryEmailStatus: "approved",
        summaryEmailApprovedAt: new Date()
      });
      console.log(`✅ [SAVE FOR AI] Summary email saved to consultation and status synced to ECHO system`);
    } catch (error: any) {
      console.error(`❌ [SAVE FOR AI] Failed to save summary email:`, error);
      return res.status(500).json({
        success: false,
        error: "Failed to save summary to consultation record"
      });
    }

    // Mark draft as approved (so it disappears from the pending list)
    await storage.updateEmailDraftStatus(id, "approved");
    console.log(`✅ [SAVE FOR AI] Draft marked as approved`);

    res.json({
      success: true,
      message: "Riepilogo salvato per AI (non inviato al cliente)"
    });
  } catch (error: any) {
    console.error(`❌ [SAVE FOR AI] Error:`, error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to save consultation summary for AI"
    });
  }
});

// API 3: POST /api/consultant/email-drafts/:id/reject - Reject draft
router.post("/consultant/email-drafts/:id/reject", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const draft = await storage.getEmailDraft(id);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: "Email draft not found"
      });
    }

    if (draft.consultantId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied - this is not your draft"
      });
    }

    await storage.updateEmailDraftStatus(id, "rejected");

    res.json({
      success: true,
      message: "Email draft rejected"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to reject email draft"
    });
  }
});

// API 4: PUT /api/consultant/email-drafts/:id - Update draft subject/body
router.put("/consultant/email-drafts/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const updateSchema = z.object({
      subject: z.string().optional(),
      body: z.string().optional()
    });

    const validatedData = updateSchema.parse(req.body);

    if (!validatedData.subject && !validatedData.body) {
      return res.status(400).json({
        success: false,
        error: "At least one of subject or body must be provided"
      });
    }

    const draft = await storage.getEmailDraft(id);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: "Email draft not found"
      });
    }

    if (draft.consultantId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied - this is not your draft"
      });
    }

    if (draft.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Cannot update draft with status: ${draft.status}`
      });
    }

    const updatedDraft = await storage.updateEmailDraft(id, validatedData);

    res.json({
      success: true,
      data: updatedDraft
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to update email draft"
    });
  }
});

// API 5: DELETE /api/consultant/email-drafts/:id - Delete draft
router.delete("/consultant/email-drafts/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const draft = await storage.getEmailDraft(id);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: "Email draft not found"
      });
    }

    if (draft.consultantId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied - this is not your draft"
      });
    }

    // Can only delete pending or rejected drafts
    if (draft.status !== "pending" && draft.status !== "rejected") {
      return res.status(400).json({
        success: false,
        error: `Cannot delete draft with status: ${draft.status}`
      });
    }

    const deleted = await storage.deleteEmailDraft(id);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: "Failed to delete email draft"
      });
    }

    res.json({
      success: true,
      message: "Email draft deleted successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete email draft"
    });
  }
});

// API 6: POST /api/consultant/email-drafts/generate-system-updates - Generate system update drafts for multiple clients
router.post("/consultant/email-drafts/generate-system-updates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { systemPrompt, updateContent, clientIds } = req.body;

    // Validation
    if (!systemPrompt || typeof systemPrompt !== 'string' || systemPrompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "systemPrompt is required and must be a non-empty string"
      });
    }

    if (!updateContent || typeof updateContent !== 'string' || updateContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "updateContent is required and must be a non-empty string"
      });
    }

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "clientIds must be a non-empty array"
      });
    }

    if (clientIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Cannot generate more than 50 drafts at once"
      });
    }

    console.log(`📢 [SYSTEM UPDATES] Generating ${clientIds.length} system update email drafts...`);
    console.log(`📢 [SYSTEM UPDATES] System Prompt: ${systemPrompt.substring(0, 100)}...`);
    console.log(`📢 [SYSTEM UPDATES] Update Content: ${updateContent.substring(0, 100)}...`);

    const results = [];
    const errors = [];

    // Import AI generator function
    const { generateSystemUpdateEmail } = await import("../ai/email-template-generator");

    for (const clientId of clientIds) {
      try {
        // Verify client exists and belongs to consultant
        const client = await storage.getUser(clientId);
        if (!client) {
          errors.push({ clientId, error: "Client not found" });
          continue;
        }

        if (client.consultantId !== req.user!.id) {
          errors.push({ clientId, error: "Access denied - not your client" });
          continue;
        }

        // Get client context (optional but helpful for personalization)
        const state = await storage.getClientState(clientId, req.user!.id);
        const allTasks = await storage.getClientTasks(clientId, {});
        const incompleteTasks = allTasks.filter(t => !t.completed);
        const allGoals = await storage.getGoalsByClient(clientId);
        const activeGoals = allGoals.filter(g => g.status === 'active');

        console.log(`📧 [SYSTEM UPDATES] Generating email for ${client.firstName} ${client.lastName}...`);

        // Generate personalized email
        const emailContent = await generateSystemUpdateEmail({
          clientId,
          consultantId: req.user!.id,
          systemPrompt,
          updateContent,
          clientName: client.firstName,
          clientContext: state ? {
            currentState: state.currentState,
            idealState: state.idealState,
            tasksCount: incompleteTasks.length,
            goalsCount: activeGoals.length
          } : undefined
        });

        // Create draft with system_update type
        const draft = await storage.createEmailDraft({
          consultantId: req.user!.id,
          clientId,
          subject: emailContent.subject,
          body: emailContent.body,
          status: 'pending',
          emailType: 'system_update',
          includesTasks: false,
          includesGoals: false,
          includesState: false,
          tasksCount: 0,
          goalsCount: 0,
          metadata: {
            systemPrompt: systemPrompt.substring(0, 200),
            updateContentPreview: updateContent.substring(0, 200)
          }
        });

        console.log(`✅ [SYSTEM UPDATES] Draft created for ${client.firstName} (ID: ${draft.id})`);

        results.push({
          clientId,
          clientName: `${client.firstName} ${client.lastName}`,
          draftId: draft.id,
          subject: emailContent.subject
        });

      } catch (error: any) {
        console.error(`❌ [SYSTEM UPDATES] Error generating draft for client ${clientId}:`, error);
        errors.push({
          clientId,
          error: error.message || "Failed to generate draft"
        });
      }
    }

    console.log(`✅ [SYSTEM UPDATES] Generation complete: ${results.length} successful, ${errors.length} failed`);

    res.json({
      success: true,
      message: `Generated ${results.length} system update draft${results.length !== 1 ? 's' : ''}`,
      data: {
        drafts: results,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          total: clientIds.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error: any) {
    console.error("❌ [SYSTEM UPDATES] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate system update drafts"
    });
  }
});

// API 7: GET /api/consultant/client-automation - Get clients with automation status
router.get("/consultant/client-automation", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const clients = await storage.getClientsByConsultant(req.user!.id);

    const clientsWithAutomation = await Promise.all(
      clients.map(async (client) => {
        const automation = await storage.getClientEmailAutomation(req.user!.id, client.id);

        return {
          id: client.id,
          name: `${client.firstName} ${client.lastName}`,
          email: client.email,
          automationEnabled: automation?.enabled || false
        };
      })
    );

    res.json({
      success: true,
      data: clientsWithAutomation
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch client automation settings"
    });
  }
});

// API 6: POST /api/consultant/client-automation/:clientId/toggle - Toggle client automation
router.post("/consultant/client-automation/:clientId/toggle", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    const toggleSchema = z.object({
      enabled: z.boolean()
    });

    const { enabled } = toggleSchema.parse(req.body);

    const client = await storage.getUser(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }

    if (client.consultantId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied - this is not your client"
      });
    }

    const automation = await storage.toggleClientEmailAutomation(
      req.user!.id,
      clientId,
      enabled
    );

    res.json({
      success: true,
      data: automation
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to toggle client automation"
    });
  }
});

// Get SMTP settings
router.get("/consultant/smtp-settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    console.log(`📥 [SMTP GET] Fetching settings for consultant: ${req.user!.id}`);
    const settings = await storage.getConsultantSmtpSettings(req.user!.id);

    if (!settings) {
      console.log(`❌ [SMTP GET] No settings found for consultant: ${req.user!.id}`);
      return res.status(404).json({ message: "SMTP settings not found" });
    }

    console.log(`✅ [SMTP GET] Settings found, returning JSON`);
    res.json(settings);
  } catch (error: any) {
    console.error("❌ [SMTP GET] Error fetching SMTP settings:", error);
    res.status(500).json({ message: error.message || "Error fetching SMTP settings" });
  }
});

// Save/Update SMTP settings
router.post("/consultant/smtp-settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    console.log(`📥 [SMTP POST] Received request for consultant: ${req.user!.id}`);
    console.log(`📥 [SMTP POST] Request body keys:`, Object.keys(req.body));

    // Check if this is a partial update (only automation settings)
    const isPartialUpdate = req.body.automationEnabled !== undefined && !req.body.host;

    if (isPartialUpdate) {
      console.log(`🔄 [SMTP POST] Partial update - automation settings only`);

      // Get existing settings first
      const existingSettings = await storage.getConsultantSmtpSettings(req.user!.id);

      if (!existingSettings) {
        return res.status(400).json({ 
          message: "Cannot update automation settings without SMTP configuration. Please configure SMTP first." 
        });
      }

      // Parse emailFrequencyDays carefully
      let emailFrequencyDays = 2; // default
      if (req.body.emailFrequencyDays !== undefined && req.body.emailFrequencyDays !== null) {
        const parsed = Number(req.body.emailFrequencyDays);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
          emailFrequencyDays = parsed;
        }
      } else {
        // Keep existing value if not provided
        emailFrequencyDays = existingSettings.emailFrequencyDays || 2;
      }

      const validatedData = {
        consultantId: req.user!.id,
        smtpHost: existingSettings.smtpHost,
        smtpPort: existingSettings.smtpPort,
        smtpSecure: existingSettings.smtpSecure,
        smtpUser: existingSettings.smtpUser,
        smtpPassword: existingSettings.smtpPassword,
        fromEmail: existingSettings.fromEmail,
        fromName: existingSettings.fromName || undefined,
        emailTone: existingSettings.emailTone || "motivazionale",
        emailSignature: existingSettings.emailSignature || undefined,
        automationEnabled: req.body.automationEnabled ?? existingSettings.automationEnabled,
        emailFrequencyDays: emailFrequencyDays,
      };

      console.log(`💾 [SMTP POST] Updating automation settings...`);
      console.log(`   automationEnabled: ${validatedData.automationEnabled}`);
      console.log(`   emailFrequencyDays: ${validatedData.emailFrequencyDays}`);

      const settings = await storage.upsertConsultantSmtpSettings(validatedData);
      console.log(`✅ [SMTP POST] Settings saved successfully`);

      return res.json({
        message: "Automation settings updated successfully",
        settings
      });
    }

    // Full SMTP settings update
    // Parse and validate emailFrequencyDays
    let emailFrequencyDays = 2; // default
    if (req.body.emailFrequencyDays !== undefined && req.body.emailFrequencyDays !== null) {
      const parsed = Number(req.body.emailFrequencyDays);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
        emailFrequencyDays = parsed;
      }
    }

    const validatedData = {
      consultantId: req.user!.id,
      smtpHost: req.body.host,
      smtpPort: Number(req.body.port),
      smtpSecure: Boolean(req.body.secure),
      smtpUser: req.body.username,
      smtpPassword: req.body.password,
      fromEmail: req.body.fromEmail,
      fromName: req.body.fromName || undefined,
      emailTone: req.body.emailTone || "motivazionale",
      emailSignature: req.body.emailSignature || undefined,
      automationEnabled: req.body.automationEnabled ?? false,
      emailFrequencyDays: emailFrequencyDays,
    };

    console.log(`💾 [SMTP POST] Saving settings to database...`);
    const settings = await storage.upsertConsultantSmtpSettings(validatedData);
    console.log(`✅ [SMTP POST] Settings saved successfully`);

    const response = {
      message: "SMTP settings saved successfully",
      settings
    };

    console.log(`📤 [SMTP POST] Sending JSON response`);
    res.setHeader('Content-Type', 'application/json');
    res.json(response);
  } catch (error: any) {
    console.error("❌ [SMTP POST] Error saving SMTP settings:", error);
    console.error("❌ [SMTP POST] Error stack:", error.stack);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ message: error.message || "Error saving SMTP settings" });
  }
});

// Test SMTP connection
router.post("/consultant/smtp-settings/test", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    console.log(`\n🧪 [SMTP TEST] Starting connection test for consultant: ${req.user!.id}`);
    console.log(`🧪 [SMTP TEST] Request body:`, {
      host: req.body.host,
      port: req.body.port,
      secure: req.body.secure,
      username: req.body.username,
      fromEmail: req.body.fromEmail
    });

    const nodemailer = await import("nodemailer");

    console.log(`🔧 [SMTP TEST] Creating transporter with settings...`);
    const transporter = nodemailer.default.createTransport({
      host: req.body.host,
      port: Number(req.body.port),
      secure: Boolean(req.body.secure),
      auth: {
        user: req.body.username,
        pass: req.body.password,
      },
      logger: true,
      debug: true,
    });

    console.log(`📡 [SMTP TEST] Verifying connection...`);
    await transporter.verify();
    console.log(`✅ [SMTP TEST] Connection verified successfully!`);

    console.log(`📧 [SMTP TEST] Sending test email...`);
    const fromField = req.body.fromName 
      ? `${req.body.fromName} <${req.body.fromEmail}>`
      : req.body.fromEmail;

    const info = await transporter.sendMail({
      from: fromField,
      to: req.body.fromEmail,
      subject: "Test Connessione SMTP - Successo! ✅",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">✅ Connessione SMTP Verificata!</h2>
          <p>La tua configurazione SMTP funziona correttamente.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            <strong>Host:</strong> ${req.body.host}<br>
            <strong>Porta:</strong> ${req.body.port}<br>
            <strong>Secure:</strong> ${req.body.secure ? 'Sì' : 'No'}<br>
            <strong>Username:</strong> ${req.body.username}
          </p>
        </div>
      `,
    });

    console.log(`✅ [SMTP TEST] Test email sent successfully!`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}\n`);

    res.json({
      success: true,
      message: "Connessione SMTP verificata con successo! Email di test inviata.",
      details: {
        messageId: info.messageId,
        response: info.response
      }
    });
  } catch (error: any) {
    console.error(`\n❌ [SMTP TEST] Connection test failed!`);
    console.error(`   Error type: ${error.name || 'Unknown'}`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error code: ${error.code || 'N/A'}`);

    let userMessage = "Errore durante il test della connessione SMTP";

    if (error.code === 'EAUTH') {
      console.error(`   🔐 Authentication failed`);
      userMessage = "Autenticazione fallita: verifica username e password";
    } else if (error.code === 'ECONNECTION' || error.code === 'ENOTFOUND') {
      console.error(`   🔌 Connection failed`);
      userMessage = "Impossibile connettersi al server: verifica host e porta";
    } else if (error.code === 'ETIMEDOUT') {
      console.error(`   ⏱️  Connection timeout`);
      userMessage = "Timeout della connessione: verifica firewall e rete";
    } else if (error.responseCode) {
      console.error(`   📋 SMTP response code: ${error.responseCode}`);
      userMessage = `Errore SMTP (${error.responseCode}): ${error.message}`;
    }

    console.error(`   Full error:`, error);
    console.error(`\n`);

    res.status(500).json({
      success: false,
      message: userMessage,
      error: error.message,
      code: error.code
    });
  }
});

// ==========================================
// GOOGLE OAUTH SETTINGS (for video meeting authentication)
// Now uses global settings from Super Admin
// ==========================================

// GET Google OAuth settings - Returns global settings configured by Super Admin
router.get("/consultant/google-oauth", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    // Fetch global Video Meeting OAuth settings from systemSettings
    const [globalSetting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "video_meeting_google_client_id"))
      .limit(1);
    
    res.json({
      googleClientId: globalSetting?.value || null,
      isGlobal: true, // Indicate this is a global setting
    });
  } catch (error: any) {
    console.error("[GoogleOAuth GET] Error:", error);
    res.status(500).json({ error: "Errore nel recupero delle impostazioni Google OAuth" });
  }
});

// ==========================================
// SCHEDULER CONTROL ENDPOINTS
// ==========================================

// GET /api/consultant/scheduler/status - Get scheduler status
router.get("/consultant/scheduler/status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const smtpSettings = await storage.getConsultantSmtpSettings(req.user!.id);

    if (!smtpSettings) {
      return res.json({
        success: true,
        data: {
          schedulerEnabled: false,
          schedulerPaused: false,
          smtpConfigured: false,
          lastSchedulerRun: null,
          nextSchedulerRun: null,
          emailFrequencyDays: 2
        }
      });
    }

    res.json({
      success: true,
      data: {
        schedulerEnabled: smtpSettings.schedulerEnabled || false,
        schedulerPaused: smtpSettings.schedulerPaused || false,
        smtpConfigured: smtpSettings.isActive || false,
        lastSchedulerRun: smtpSettings.lastSchedulerRun ? smtpSettings.lastSchedulerRun.toISOString() : null,
        nextSchedulerRun: smtpSettings.nextSchedulerRun ? smtpSettings.nextSchedulerRun.toISOString() : null,
        emailFrequencyDays: smtpSettings.emailFrequencyDays || 2
      }
    });
  } catch (error: any) {
    console.error("❌ [SCHEDULER STATUS] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch scheduler status"
    });
  }
});

// POST /api/consultant/scheduler/start - Enable scheduler
router.post("/consultant/scheduler/start", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const smtpSettings = await storage.getConsultantSmtpSettings(req.user!.id);

    if (!smtpSettings || !smtpSettings.isActive) {
      return res.status(400).json({
        success: false,
        error: "Configurare prima le impostazioni SMTP"
      });
    }

    // Calculate next run based on email frequency
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + (smtpSettings.emailFrequencyDays || 2));
    // Always set next run to 13:00 (1:00 PM)
    nextRun.setHours(13, 0, 0, 0);

    await storage.updateSchedulerStatus(req.user!.id, {
      schedulerEnabled: true,
      schedulerPaused: false,
      nextSchedulerRun: nextRun
    });

    res.json({
      success: true,
      message: "Scheduler attivato con successo",
      data: {
        schedulerEnabled: true,
        schedulerPaused: false,
        nextSchedulerRun: nextRun.toISOString()
      }
    });
  } catch (error: any) {
    console.error("❌ [SCHEDULER START] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to start scheduler"
    });
  }
});

// POST /api/consultant/scheduler/pause - Pause scheduler
router.post("/consultant/scheduler/pause", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    await storage.updateSchedulerStatus(req.user!.id, {
      schedulerPaused: true
    });

    res.json({
      success: true,
      message: "Scheduler messo in pausa",
      data: {
        schedulerPaused: true
      }
    });
  } catch (error: any) {
    console.error("❌ [SCHEDULER PAUSE] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to pause scheduler"
    });
  }
});

// POST /api/consultant/scheduler/resume - Resume scheduler
router.post("/consultant/scheduler/resume", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    await storage.updateSchedulerStatus(req.user!.id, {
      schedulerPaused: false
    });

    res.json({
      success: true,
      message: "Scheduler riattivato",
      data: {
        schedulerPaused: false
      }
    });
  } catch (error: any) {
    console.error("❌ [SCHEDULER RESUME] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to resume scheduler"
    });
  }
});

// POST /api/consultant/scheduler/stop - Disable scheduler
router.post("/consultant/scheduler/stop", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    await storage.updateSchedulerStatus(req.user!.id, {
      schedulerEnabled: false,
      schedulerPaused: false
    });

    res.json({
      success: true,
      message: "Scheduler disattivato",
      data: {
        schedulerEnabled: false,
        schedulerPaused: false
      }
    });
  } catch (error: any) {
    console.error("❌ [SCHEDULER STOP] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to stop scheduler"
    });
  }
});

// POST /api/consultant/scheduler/execute-now - Execute scheduler immediately
router.post("/consultant/scheduler/execute-now", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  const consultantId = req.user!.id;

  try {
    console.log(`🔍 [SCHEDULER EXECUTE] Manual execution requested for consultant ${consultantId}`);

    // Check if SMTP is configured
    const smtpSettings = await storage.getConsultantSmtpSettings(consultantId);

    if (!smtpSettings || !smtpSettings.isActive) {
      return res.status(400).json({
        success: false,
        error: "Configurare prima le impostazioni SMTP"
      });
    }

    // Check if already running (service-level lock check)
    if (smtpSettings.schedulerStatus === 'running') {
      console.log(`⚠️ [SCHEDULER EXECUTE] Execution already in progress for consultant ${consultantId}`);
      return res.status(409).json({
        success: false,
        error: "Un'esecuzione dello scheduler è già in corso. Attendi che finisca."
      });
    }

    // Check for recent executions (last 1 minute) to prevent accidental double-clicks
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
    if (smtpSettings.lastSchedulerRun && new Date(smtpSettings.lastSchedulerRun) > oneMinuteAgo) {
      console.log(`⚠️ [SCHEDULER EXECUTE] Execution too soon after last run for consultant ${consultantId}`);
      return res.status(429).json({
        success: false,
        error: "Esecuzione troppo ravvicinata. Attendi almeno 1 minuto tra un'esecuzione e l'altra."
      });
    }

    console.log(`✅ [SCHEDULER EXECUTE] Starting manual execution for consultant ${consultantId}`);

    // Import and execute scheduler immediately
    const { sendAutomatedEmails } = await import("../services/email-scheduler");

    // Execute in background (don't wait for completion)
    // The service will handle lock acquisition with retry logic
    setImmediate(async () => {
      try {
        await sendAutomatedEmails();
        console.log(`✅ [SCHEDULER EXECUTE] Manual execution completed successfully`);
      } catch (error) {
        console.error(`❌ [SCHEDULER EXECUTE] Error during manual execution:`, error);
      }
    });

    res.json({
      success: true,
      message: "Esecuzione scheduler avviata. Controlla i log tra qualche minuto per vedere i risultati."
    });
  } catch (error: any) {
    console.error("❌ [SCHEDULER EXECUTE] Error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Failed to execute scheduler"
    });
  }
});

// GET /api/consultant/scheduler/logs - Get scheduler execution logs
router.get("/consultant/scheduler/logs", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const logs = await storage.getSchedulerLogs(req.user!.id, limit);

    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        executedAt: log.executedAt ? log.executedAt.toISOString() : null,
        clientsProcessed: log.clientsProcessed,
        emailsSent: log.emailsSent,
        draftsCreated: log.draftsCreated,
        errors: log.errors,
        errorDetails: log.errorDetails,
        status: log.status,
        executionTimeMs: log.executionTimeMs,
        details: log.details
      }))
    });
  } catch (error: any) {
    console.error("❌ [SCHEDULER LOGS] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch scheduler logs"
    });
  }
});

export default router;
