import { Router } from "express";
import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq, and, desc, sql, or, isNull, isNotNull, ne, inArray } from "drizzle-orm";
import { authenticateToken, requireRole } from "../middleware/auth";
import twilio from "twilio";
import { normalizePhoneNumber } from "../whatsapp/webhook-handler";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";
import { addDays, setHours, setMinutes, getDay } from "date-fns";
import { runDailySchedulingNow } from "../cron/weekly-checkin-scheduler";

/**
 * Get or create a WhatsApp conversation for check-in messages
 * This ensures the check-in message appears in conversation history for AI context
 */
async function getOrCreateConversation(
  phoneNumber: string,
  consultantId: string,
  agentConfigId: string,
  clientId?: string
): Promise<{ id: string }> {
  // Use consistent phone normalization from webhook-handler
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  // Try to find existing conversation with this agent
  let [conversation] = await db
    .select({ id: schema.whatsappConversations.id })
    .from(schema.whatsappConversations)
    .where(
      and(
        eq(schema.whatsappConversations.phoneNumber, normalizedPhone),
        eq(schema.whatsappConversations.consultantId, consultantId),
        eq(schema.whatsappConversations.agentConfigId, agentConfigId)
      )
    )
    .limit(1);
  
  if (conversation) {
    return conversation;
  }
  
  // Try to find any existing conversation for this phone/consultant
  [conversation] = await db
    .select({ id: schema.whatsappConversations.id })
    .from(schema.whatsappConversations)
    .where(
      and(
        eq(schema.whatsappConversations.phoneNumber, normalizedPhone),
        eq(schema.whatsappConversations.consultantId, consultantId)
      )
    )
    .limit(1);
  
  if (conversation) {
    return conversation;
  }
  
  // Create new conversation
  const [newConversation] = await db
    .insert(schema.whatsappConversations)
    .values({
      phoneNumber: normalizedPhone,
      consultantId,
      userId: clientId || null,
      isLead: !clientId,
      aiEnabled: true,
      isActive: true,
      agentConfigId,
    })
    .returning({ id: schema.whatsappConversations.id });
  
  console.log(`[WEEKLY-CHECKIN] Created new conversation ${newConversation.id} for ${normalizedPhone}`);
  return newConversation;
}

const router = Router();

interface ApprovedTemplateInfo {
  id: string;
  friendlyName: string;
  bodyText: string;
  twilioContentSid: string;
  approvalStatus: string;
}

async function fetchApprovedTemplatesForConsultant(
  consultantId: string
): Promise<ApprovedTemplateInfo[]> {
  console.log(`[WEEKLY-CHECKIN] Fetching approved templates for consultant ${consultantId}`);
  
  try {
    const templates = await db
      .select({
        id: schema.whatsappCustomTemplates.id,
        name: schema.whatsappCustomTemplates.templateName,
        twilioContentSid: schema.whatsappTemplateVersions.twilioContentSid,
        bodyText: schema.whatsappTemplateVersions.bodyText,
        useCase: schema.whatsappCustomTemplates.useCase,
      })
      .from(schema.whatsappCustomTemplates)
      .innerJoin(
        schema.whatsappTemplateVersions,
        and(
          eq(schema.whatsappTemplateVersions.templateId, schema.whatsappCustomTemplates.id),
          eq(schema.whatsappTemplateVersions.isActive, true)
        )
      )
      .where(
        and(
          eq(schema.whatsappCustomTemplates.consultantId, consultantId),
          isNotNull(schema.whatsappTemplateVersions.twilioContentSid),
          ne(schema.whatsappTemplateVersions.twilioContentSid, '')
        )
      )
      .orderBy(schema.whatsappCustomTemplates.templateName);

    const result = templates.map(t => ({
      id: t.twilioContentSid!,
      friendlyName: t.name,
      bodyText: t.bodyText || '',
      twilioContentSid: t.twilioContentSid!,
      approvalStatus: 'approved',
      useCase: t.useCase || '',
    }));

    console.log(`[WEEKLY-CHECKIN] Found ${result.length} approved WhatsApp templates for consultant ${consultantId}`);
    return result;
  } catch (error: any) {
    console.error(`[WEEKLY-CHECKIN] Error in fetchApprovedTemplatesForConsultant:`, error);
    throw error;
  }
}

router.get("/config", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const [config] = await db
      .select()
      .from(schema.weeklyCheckinConfig)
      .where(eq(schema.weeklyCheckinConfig.consultantId, req.user!.id))
      .limit(1);

    res.json(config || null);
  } catch (error: any) {
    console.error("Error fetching weekly checkin config:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/config", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const {
      isEnabled,
      preferredTimeStart,
      preferredTimeEnd,
      excludedDays,
      templateIds,
      useAiPersonalization,
      targetAudience,
      minDaysSinceLastContact,
      agentConfigId,
    } = req.body;

    const [existing] = await db
      .select()
      .from(schema.weeklyCheckinConfig)
      .where(eq(schema.weeklyCheckinConfig.consultantId, req.user!.id))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(schema.weeklyCheckinConfig)
        .set({
          isEnabled: isEnabled ?? existing.isEnabled,
          preferredTimeStart: preferredTimeStart ?? existing.preferredTimeStart,
          preferredTimeEnd: preferredTimeEnd ?? existing.preferredTimeEnd,
          excludedDays: excludedDays ?? existing.excludedDays,
          templateIds: templateIds ?? existing.templateIds,
          useAiPersonalization: useAiPersonalization ?? existing.useAiPersonalization,
          targetAudience: targetAudience ?? existing.targetAudience,
          minDaysSinceLastContact: minDaysSinceLastContact ?? existing.minDaysSinceLastContact,
          agentConfigId: agentConfigId !== undefined ? agentConfigId : existing.agentConfigId,
          updatedAt: new Date(),
        })
        .where(eq(schema.weeklyCheckinConfig.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(schema.weeklyCheckinConfig)
        .values({
          consultantId: req.user!.id,
          isEnabled: isEnabled ?? false,
          preferredTimeStart: preferredTimeStart ?? "09:00",
          preferredTimeEnd: preferredTimeEnd ?? "18:00",
          excludedDays: excludedDays ?? [],
          templateIds: templateIds ?? [],
          useAiPersonalization: useAiPersonalization ?? true,
          targetAudience: targetAudience ?? "all_active",
          minDaysSinceLastContact: minDaysSinceLastContact ?? 5,
          agentConfigId: agentConfigId ?? null,
        })
        .returning();
      res.status(201).json(created);
    }
  } catch (error: any) {
    console.error("Error saving weekly checkin config:", error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/config/toggle", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const [config] = await db
      .select()
      .from(schema.weeklyCheckinConfig)
      .where(eq(schema.weeklyCheckinConfig.consultantId, req.user!.id))
      .limit(1);

    if (!config) {
      return res.status(404).json({ message: "Configuration not found" });
    }

    const [updated] = await db
      .update(schema.weeklyCheckinConfig)
      .set({
        isEnabled: !config.isEnabled,
        updatedAt: new Date(),
      })
      .where(eq(schema.weeklyCheckinConfig.id, config.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.error("Error toggling weekly checkin:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/stats", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const [config] = await db
      .select()
      .from(schema.weeklyCheckinConfig)
      .where(eq(schema.weeklyCheckinConfig.consultantId, req.user!.id))
      .limit(1);

    if (!config) {
      return res.json({
        totalSent: 0,
        totalResponses: 0,
        responseRate: 0,
        lastRunAt: null,
      });
    }

    const [stats] = await db
      .select({
        totalSent: sql<number>`count(*) filter (where ${schema.weeklyCheckinLogs.status} != 'scheduled' and ${schema.weeklyCheckinLogs.status} != 'cancelled')`,
        totalResponses: sql<number>`count(*) filter (where ${schema.weeklyCheckinLogs.status} = 'replied')`,
      })
      .from(schema.weeklyCheckinLogs)
      .where(eq(schema.weeklyCheckinLogs.consultantId, req.user!.id));

    const totalSent = Number(stats?.totalSent || 0);
    const totalResponses = Number(stats?.totalResponses || 0);
    const responseRate = totalSent > 0 ? Math.round((totalResponses / totalSent) * 100) : 0;

    res.json({
      totalSent,
      totalResponses,
      responseRate,
      lastRunAt: config.lastRunAt,
    });
  } catch (error: any) {
    console.error("Error fetching weekly checkin stats:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/logs", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const logs = await db
      .select()
      .from(schema.weeklyCheckinLogs)
      .where(eq(schema.weeklyCheckinLogs.consultantId, req.user!.id))
      .orderBy(desc(schema.weeklyCheckinLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.weeklyCheckinLogs)
      .where(eq(schema.weeklyCheckinLogs.consultantId, req.user!.id));

    const total = Number(countResult?.count || 0);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching weekly checkin logs:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/pending-logs", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const pendingLogs = await db
      .select()
      .from(schema.weeklyCheckinLogs)
      .where(
        and(
          eq(schema.weeklyCheckinLogs.consultantId, req.user!.id),
          eq(schema.weeklyCheckinLogs.status, "scheduled")
        )
      )
      .orderBy(schema.weeklyCheckinLogs.scheduledFor)
      .limit(limit);

    res.json({ logs: pendingLogs });
  } catch (error: any) {
    console.error("Error fetching pending weekly checkin logs:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/templates", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const templates = await fetchApprovedTemplatesForConsultant(req.user!.id);
    res.json(templates);
  } catch (error: any) {
    console.error("Error fetching approved WhatsApp templates:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/eligible-clients", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    console.log(`[WEEKLY-CHECKIN] Fetching eligible clients for consultant ${req.user!.id}`);
    
    const [config] = await db
      .select()
      .from(schema.weeklyCheckinConfig)
      .where(eq(schema.weeklyCheckinConfig.consultantId, req.user!.id))
      .limit(1);

    const minDays = config?.minDaysSinceLastContact || 5;
    console.log(`[WEEKLY-CHECKIN] Config minDays: ${minDays}`);

    // Match consultant-clients.tsx behavior: show clients with isActive !== false
    // This includes isActive = true AND isActive = null (default active)
    const allClients = await db
      .select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        phoneNumber: schema.users.phoneNumber,
        isActive: schema.users.isActive,
        enabledForWeeklyCheckin: schema.users.enabledForWeeklyCheckin,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.consultantId, req.user!.id),
          or(
            eq(schema.users.isActive, true),
            isNull(schema.users.isActive)
          )
        )
      )
      .orderBy(schema.users.firstName);
    
    console.log(`[WEEKLY-CHECKIN] Total clients found: ${allClients.length}`);
    console.log(`[WEEKLY-CHECKIN] Sample clients:`, allClients.slice(0, 3).map(c => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      phone: c.phoneNumber ? 'yes' : 'no',
      isActive: c.isActive,
      enabledForWeeklyCheckin: c.enabledForWeeklyCheckin
    })));

    const recentLogs = await db
      .select({
        clientId: schema.weeklyCheckinLogs.clientId,
        lastSent: sql<string>`MAX(${schema.weeklyCheckinLogs.sentAt})`,
      })
      .from(schema.weeklyCheckinLogs)
      .where(
        and(
          eq(schema.weeklyCheckinLogs.consultantId, req.user!.id),
          isNotNull(schema.weeklyCheckinLogs.sentAt)
        )
      )
      .groupBy(schema.weeklyCheckinLogs.clientId);

    const recentLogMap = new Map(recentLogs.map(l => [l.clientId, new Date(l.lastSent)]));

    const eligible: any[] = [];
    const excluded: any[] = [];

    for (const client of allClients) {
      const lastSent = recentLogMap.get(client.id);
      const daysSinceLastContact = lastSent 
        ? Math.floor((Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const clientData = {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phoneNumber: client.phoneNumber,
        isActive: client.isActive,
        enabledForWeeklyCheckin: client.enabledForWeeklyCheckin,
        lastCheckinSent: lastSent?.toISOString() || null,
        daysSinceLastContact,
      };

      let blockingReason: string | null = null;
      if (!client.phoneNumber) {
        blockingReason = "Nessun numero di telefono";
      } else if (client.isActive === false) {
        blockingReason = "Cliente non attivo";
      } else if (daysSinceLastContact !== null && daysSinceLastContact < minDays) {
        blockingReason = `Contattato ${daysSinceLastContact} giorni fa (minimo: ${minDays})`;
      }

      if (client.enabledForWeeklyCheckin === true) {
        eligible.push({ ...clientData, blockingReason });
      } else {
        excluded.push({ ...clientData, exclusionReason: blockingReason || "Non selezionato" });
      }
    }

    console.log(`[WEEKLY-CHECKIN] Results: eligible=${eligible.length}, excluded=${excluded.length}`);
    
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });
    
    res.json({
      eligible,
      excluded,
      config: {
        isEnabled: config?.isEnabled || false,
        minDaysSinceLastContact: minDays,
      },
    });
  } catch (error: any) {
    console.error("Error fetching eligible clients:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /next-send
 * Calcola il prossimo invio programmato con countdown e template pre-selezionato
 */
router.get("/next-send", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;
    
    // Load config
    const [config] = await db
      .select()
      .from(schema.weeklyCheckinConfig)
      .where(eq(schema.weeklyCheckinConfig.consultantId, consultantId))
      .limit(1);
    
    if (!config || !config.isEnabled) {
      return res.json({
        isEnabled: false,
        nextSendAt: null,
        selectedTemplate: null,
        message: "Check-in automatico disabilitato"
      });
    }
    
    // FIRST: Check if there are already scheduled/pending logs (pending sends)
    // Include "scheduled" and "pending" statuses as they represent future sends
    const now = new Date();
    const [nextScheduledLog] = await db
      .select({
        scheduledFor: schema.weeklyCheckinLogs.scheduledFor,
        templateName: schema.weeklyCheckinLogs.templateName,
        personalizedMessage: schema.weeklyCheckinLogs.personalizedMessage,
        clientName: schema.users.firstName,
        status: schema.weeklyCheckinLogs.status,
      })
      .from(schema.weeklyCheckinLogs)
      .leftJoin(schema.users, eq(schema.weeklyCheckinLogs.clientId, schema.users.id))
      .where(
        and(
          eq(schema.weeklyCheckinLogs.consultantId, consultantId),
          sql`${schema.weeklyCheckinLogs.status} IN ('scheduled', 'pending')`,
          sql`${schema.weeklyCheckinLogs.scheduledFor} > ${now}`
        )
      )
      .orderBy(schema.weeklyCheckinLogs.scheduledFor)
      .limit(1);
    
    if (nextScheduledLog) {
      // Return the next already-scheduled send (actual data from scheduler)
      return res.json({
        isEnabled: true,
        nextSendAt: nextScheduledLog.scheduledFor.toISOString(),
        selectedTemplate: {
          id: null,
          name: nextScheduledLog.templateName || "Template programmato",
          bodyText: nextScheduledLog.personalizedMessage || null,
        },
        templateCount: 1,
        message: null,
        isFromScheduledLog: true,
        isEstimate: false,
        clientName: nextScheduledLog.clientName || null,
      });
    }
    
    // No pending scheduled logs - calculate ESTIMATED next scheduling run
    // Note: This is an estimate based on config, actual send depends on scheduler execution
    
    // Check if scheduler ran today (helps determine accuracy of estimate)
    const ROME_TZ = "Europe/Rome";
    const SCHEDULER_HOUR = 8; // Cron runs at 08:00
    const nowUtcEarly = new Date();
    const nowRomeEarly = toZonedTime(nowUtcEarly, ROME_TZ);
    const lastRunAt = config.lastRunAt;
    let schedulerRanToday = false;
    
    if (lastRunAt) {
      const lastRunRome = toZonedTime(lastRunAt, ROME_TZ);
      // Check if lastRunAt is from today (same date in Rome timezone)
      schedulerRanToday = 
        lastRunRome.getFullYear() === nowRomeEarly.getFullYear() &&
        lastRunRome.getMonth() === nowRomeEarly.getMonth() &&
        lastRunRome.getDate() === nowRomeEarly.getDate();
    }
    
    // Calculate if past scheduler time (used later)
    const currentHourRome = nowRomeEarly.getHours();
    const isPastSchedulerTime = currentHourRome >= SCHEDULER_HOUR;
    
    // Check if there are eligible clients
    const eligibleClientsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.consultantId, consultantId),
          eq(schema.users.enabledForWeeklyCheckin, true),
          eq(schema.users.isActive, true)
        )
      );
    
    const hasEligibleClients = Number(eligibleClientsCount[0]?.count || 0) > 0;
    
    if (!hasEligibleClients) {
      return res.json({
        isEnabled: true,
        nextSendAt: null,
        selectedTemplate: null,
        message: "Nessun cliente abilitato per il check-in"
      });
    }
    
    // Check if agent is configured
    if (!config.agentConfigId) {
      return res.json({
        isEnabled: true,
        nextSendAt: null,
        selectedTemplate: null,
        message: "Nessun agente WhatsApp configurato"
      });
    }
    
    // Get templates
    const rawTemplateIds = config.templateIds;
    const templateIds: string[] = Array.isArray(rawTemplateIds) ? rawTemplateIds : [];
    if (templateIds.length === 0) {
      return res.json({
        isEnabled: true,
        nextSendAt: null,
        selectedTemplate: null,
        message: "Nessun template selezionato"
      });
    }
    
    // Fetch template details using twilio_content_sid (HX format) since that's what's saved in config
    const templates = await db
      .select({
        id: schema.whatsappTemplateVersions.twilioContentSid,
        name: schema.whatsappCustomTemplates.templateName,
        bodyText: schema.whatsappTemplateVersions.bodyText,
      })
      .from(schema.whatsappCustomTemplates)
      .innerJoin(
        schema.whatsappTemplateVersions,
        and(
          eq(schema.whatsappTemplateVersions.templateId, schema.whatsappCustomTemplates.id),
          eq(schema.whatsappTemplateVersions.isActive, true)
        )
      )
      .where(
        and(
          eq(schema.whatsappCustomTemplates.consultantId, consultantId),
          inArray(schema.whatsappTemplateVersions.twilioContentSid, templateIds)
        )
      );
    
    if (templates.length === 0) {
      return res.json({
        isEnabled: true,
        nextSendAt: null,
        selectedTemplate: null,
        message: "Template non trovati"
      });
    }
    
    // NOW check awaiting scheduler state (after confirming config is valid)
    // If past 08:00 and scheduler hasn't run today, return awaiting state
    if (isPastSchedulerTime && !schedulerRanToday) {
      return res.json({
        isEnabled: true,
        nextSendAt: null,
        selectedTemplate: null,
        message: "In attesa dello scheduler (lo scheduler non ha ancora girato oggi)",
        isFromScheduledLog: false,
        isEstimate: false,
        awaitingScheduler: true,
      });
    }
    
    // Check if scheduler ran today but created no logs (no sends for today)
    // This happens when all clients are excluded or already contacted
    // We'll still compute estimate but flag that today had no scheduled sends
    const noSendsToday = isPastSchedulerTime && schedulerRanToday;
    
    // Calculate next send time using date-fns-tz for proper Rome timezone handling
    // Scheduler cron runs at 08:00 Europe/Rome daily, scheduling messages for that day
    // Note: ROME_TZ and SCHEDULER_HOUR already declared above
    const preferredStart = config.preferredTimeStart || "09:00";
    const preferredEnd = config.preferredTimeEnd || "18:00";
    // excludedDays is already an array of numbers (0=Sunday, 1=Monday, etc.)
    const excludedDayNums: number[] = (config.excludedDays || []) as number[];
    
    const [startHour, startMin] = preferredStart.split(':').map(Number);
    const [endHour, endMin] = preferredEnd.split(':').map(Number);
    
    // Validate time window
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    if (endMinutes <= startMinutes) {
      return res.json({
        isEnabled: true,
        nextSendAt: null,
        selectedTemplate: null,
        message: "Configurazione orario non valida (fine prima di inizio)"
      });
    }
    
    let attempts = 0;
    const maxAttempts = 14;
    let foundDate: Date | null = null;
    
    // Reuse nowRomeEarly from above
    const nowRomeHour = nowRomeEarly.getHours();
    
    // Determine starting day: if past 08:00 Rome, start from tomorrow
    let checkDay = nowRomeEarly;
    if (nowRomeHour >= SCHEDULER_HOUR) {
      // Today's scheduling already happened, start from tomorrow
      checkDay = addDays(nowRomeEarly, 1);
    }
    
    while (attempts < maxAttempts) {
      const dayOfWeek = getDay(checkDay); // 0=Sunday, 1=Monday, etc.
      const isDayExcluded = excludedDayNums.includes(dayOfWeek);
      
      if (!isDayExcluded) {
        // This day is valid - schedule within the window
        const dateSeed = checkDay.getDate() + checkDay.getMonth() * 31;
        const windowSize = endMinutes - startMinutes;
        const randomOffset = (dateSeed * 17) % windowSize;
        const targetMinutes = startMinutes + randomOffset;
        const targetHour = Math.floor(targetMinutes / 60);
        const targetMin = targetMinutes % 60;
        
        // Set the time in Rome timezone, then convert to UTC
        let scheduleRome = setHours(checkDay, targetHour);
        scheduleRome = setMinutes(scheduleRome, targetMin);
        foundDate = fromZonedTime(scheduleRome, ROME_TZ);
        break;
      }
      
      // Move to next day
      checkDay = addDays(checkDay, 1);
      attempts++;
    }
    
    if (!foundDate) {
      return res.json({
        isEnabled: true,
        nextSendAt: null,
        selectedTemplate: null,
        message: "Impossibile calcolare il prossimo invio (tutti i giorni esclusi?)"
      });
    }
    
    // Pre-select template using deterministic seed based on date
    const templateSeed = foundDate.getDate() + foundDate.getMonth() * 31 + foundDate.getFullYear();
    const selectedIndex = templateSeed % templates.length;
    const selectedTemplate = templates[selectedIndex];
    
    res.json({
      isEnabled: true,
      nextSendAt: foundDate.toISOString(),
      selectedTemplate: {
        id: selectedTemplate.id,
        name: selectedTemplate.name,
        bodyText: selectedTemplate.bodyText,
      },
      templateCount: templates.length,
      message: null,
      isFromScheduledLog: false,
      isEstimate: true, // Computed from config, not actual scheduled log
      schedulerRanToday, // Did the scheduler run today?
      noSendsToday, // Scheduler ran today but no pending logs (all clients excluded/contacted)
      lastSchedulerRun: lastRunAt?.toISOString() || null,
    });
  } catch (error: any) {
    console.error("Error calculating next send:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/toggle-client", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { clientId, enabled } = req.body;

    if (!clientId || typeof enabled !== "boolean") {
      return res.status(400).json({ message: "clientId and enabled (boolean) are required" });
    }

    // Don't filter by role - consultant clients are also valid
    const [client] = await db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, clientId),
          eq(schema.users.consultantId, req.user!.id)
        )
      )
      .limit(1);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    await db
      .update(schema.users)
      .set({ enabledForWeeklyCheckin: enabled })
      .where(eq(schema.users.id, clientId));

    res.json({ 
      success: true, 
      clientId, 
      enabled,
      message: enabled ? "Cliente abilitato per check-in" : "Cliente rimosso dal check-in"
    });
  } catch (error: any) {
    console.error("Error toggling client check-in status:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/test", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { clientId, templateId } = req.body;

    if (!clientId) {
      return res.status(400).json({ message: "clientId is required" });
    }

    const [client] = await db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, clientId),
          eq(schema.users.consultantId, req.user!.id)
        )
      )
      .limit(1);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    if (!client.phoneNumber) {
      return res.status(400).json({ message: "Client has no phone number" });
    }

    const [config] = await db
      .select()
      .from(schema.weeklyCheckinConfig)
      .where(eq(schema.weeklyCheckinConfig.consultantId, req.user!.id))
      .limit(1);

    if (!config) {
      return res.status(400).json({ message: "Weekly check-in not configured. Please create a configuration first." });
    }

    let templateInfo = null;
    if (templateId && templateId.startsWith('HX')) {
      const templates = await fetchTwilioTemplatesForConsultant(req.user!.id);
      templateInfo = templates.find(t => t.id === templateId);
    }

    const now = new Date();
    const [log] = await db
      .insert(schema.weeklyCheckinLogs)
      .values({
        configId: config.id,
        consultantId: req.user!.id,
        clientId: client.id,
        phoneNumber: client.phoneNumber,
        scheduledFor: now,
        scheduledDay: now.getDay(),
        scheduledHour: now.getHours(),
        templateId: templateInfo?.id || null,
        templateName: templateInfo?.friendlyName || "Test Message",
        originalTemplateBody: templateInfo?.bodyText || "Test check-in message",
        personalizedMessage: templateInfo?.bodyText?.replace(/\{\{1\}\}/g, client.firstName || "Cliente") || `Ciao ${client.firstName || "Cliente"}! Questo è un messaggio di test del sistema di check-in settimanale.`,
        status: "scheduled",
        aiPersonalizationContext: {
          clientName: client.firstName || undefined,
        },
      })
      .returning();

    res.status(201).json({
      message: "Test check-in scheduled",
      log,
    });
  } catch (error: any) {
    console.error("Error sending test check-in:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/send-test", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ message: "clientId is required" });
    }

    const [client] = await db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, clientId),
          eq(schema.users.consultantId, req.user!.id)
        )
      )
      .limit(1);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    if (!client.phoneNumber) {
      return res.status(400).json({ message: "Client has no phone number" });
    }

    const [config] = await db
      .select()
      .from(schema.weeklyCheckinConfig)
      .where(eq(schema.weeklyCheckinConfig.consultantId, req.user!.id))
      .limit(1);

    if (!config) {
      return res.status(400).json({ message: "Weekly check-in not configured" });
    }

    if (!config.agentConfigId) {
      return res.status(400).json({ message: "Nessun agente WhatsApp selezionato. Vai nelle impostazioni e seleziona un agente." });
    }

    if (!config.templateIds || config.templateIds.length === 0) {
      return res.status(400).json({ message: "Nessun template selezionato. Vai nelle impostazioni e seleziona almeno un template." });
    }

    const templateId = config.templateIds[0];

    const { sendWhatsAppMessage } = await import("../whatsapp/twilio-client");
    const { generateCheckinVariables } = await import("../ai/checkin-personalization-service");

    let contentVariables: Record<string, string> | undefined;

    try {
      const variables = await generateCheckinVariables(clientId, req.user!.id);
      if (variables) {
        contentVariables = {
          '1': variables.name,
          '2': variables.aiMessage,
        };
        console.log(`[WEEKLY-CHECKIN] AI Message (${variables.aiMessage.length} chars):`);
        console.log(`[WEEKLY-CHECKIN] "${variables.aiMessage}"`);
      }
    } catch (aiError) {
      console.error("[WEEKLY-CHECKIN] AI personalization failed:", aiError);
      contentVariables = {
        '1': client.firstName || 'Cliente',
        '2': 'spero che questa settimana stia andando bene per te',
      };
    }

    const messageText = `Ciao ${contentVariables?.['1'] || 'Cliente'}! ${contentVariables?.['2'] || 'Come stai questa settimana?'}`;

    // Get or create conversation for this client to save message in history
    const conversation = await getOrCreateConversation(
      client.phoneNumber,
      req.user!.id,
      config.agentConfigId,
      client.id
    );

    const messageSid = await sendWhatsAppMessage(
      req.user!.id,
      client.phoneNumber,
      messageText,
      undefined,
      {
        contentSid: templateId,
        contentVariables,
        agentConfigId: config.agentConfigId,
        conversationId: conversation.id,
      }
    );

    const now = new Date();
    
    // Save check-in message to conversation history so AI has context when client responds
    // Use twilioSid (not twilioMessageSid) to match schema, with onConflictDoNothing for retry safety
    await db.insert(schema.whatsappMessages).values({
      conversationId: conversation.id,
      messageText: messageText,
      direction: "outbound",
      sender: "ai",
      twilioSid: messageSid,
      metadata: {
        type: "weekly_checkin",
        templateId: templateId,
        isAutomated: true,
      },
    }).onConflictDoNothing();
    console.log(`[WEEKLY-CHECKIN] Saved check-in message to conversation history (conversation: ${conversation.id})`);
    
    await db
      .insert(schema.weeklyCheckinLogs)
      .values({
        configId: config.id,
        consultantId: req.user!.id,
        clientId: client.id,
        phoneNumber: client.phoneNumber,
        scheduledFor: now,
        scheduledDay: now.getDay(),
        scheduledHour: now.getHours(),
        templateId: templateId,
        templateName: "Test Check-in",
        personalizedMessage: contentVariables?.['2'] || null,
        status: "sent",
        sentAt: now,
        twilioMessageSid: messageSid,
        aiPersonalizationContext: contentVariables ? {
          clientName: contentVariables['1'],
          aiMessage: contentVariables['2'],
          generatedAt: now.toISOString(),
        } : null,
      });

    res.json({
      success: true,
      message: "Test check-in inviato con successo!",
      messageSid,
    });
  } catch (error: any) {
    console.error("Error sending test check-in:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /trigger-now - Avvia manualmente lo scheduler dei check-in
 * Esegue immediatamente la programmazione degli invii per oggi
 */
router.post("/trigger-now", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const consultantId = req.user!.id;
    console.log(`🚀 [WEEKLY-CHECKIN] Manual trigger requested by consultant ${consultantId}`);
    
    // Verifica che il consulente abbia una configurazione attiva
    const [config] = await db
      .select()
      .from(schema.weeklyCheckinConfig)
      .where(eq(schema.weeklyCheckinConfig.consultantId, consultantId))
      .limit(1);
    
    if (!config) {
      return res.status(400).json({ 
        success: false, 
        message: "Nessuna configurazione check-in trovata. Configura prima i check-in settimanali." 
      });
    }
    
    if (!config.isEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: "I check-in automatici sono disabilitati. Attivali prima di avviare manualmente." 
      });
    }
    
    // Avvia lo scheduler (funziona per tutti i consulenti attivi)
    await runDailySchedulingNow();
    
    console.log(`✅ [WEEKLY-CHECKIN] Manual trigger completed for consultant ${consultantId}`);
    
    res.json({ 
      success: true, 
      message: "Scheduler avviato! I check-in verranno inviati a breve." 
    });
  } catch (error: any) {
    console.error("Error triggering check-in scheduler:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Errore durante l'avvio dello scheduler" 
    });
  }
});

export default router;
