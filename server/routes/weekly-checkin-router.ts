import { Router } from "express";
import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq, and, desc, sql, or, isNull, isNotNull, ne } from "drizzle-orm";
import { authenticateToken, requireRole } from "../middleware/auth";
import twilio from "twilio";

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

    const messageSid = await sendWhatsAppMessage(
      req.user!.id,
      client.phoneNumber,
      messageText,
      undefined,
      {
        contentSid: templateId,
        contentVariables,
        agentConfigId: config.agentConfigId,
      }
    );

    const now = new Date();
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

export default router;
