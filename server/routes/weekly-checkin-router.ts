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
  const templates = await db
    .select({
      id: schema.whatsappCustomTemplates.id,
      name: schema.whatsappCustomTemplates.templateName,
      twilioContentSid: schema.whatsappTemplateVersions.twilioContentSid,
      bodyText: schema.whatsappTemplateVersions.body,
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

  const result: ApprovedTemplateInfo[] = templates.map(t => ({
    id: t.twilioContentSid!,
    friendlyName: t.name,
    bodyText: t.bodyText || '',
    twilioContentSid: t.twilioContentSid!,
    approvalStatus: 'approved',
  }));

  console.log(`[WEEKLY-CHECKIN] Found ${result.length} approved WhatsApp templates for consultant ${consultantId}`);
  return result;
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

router.get("/templates", authenticateToken, requireRole("consultant"), async (req, res) => {
  try {
    const templates = await fetchApprovedTemplatesForConsultant(req.user!.id);
    res.json(templates);
  } catch (error: any) {
    console.error("Error fetching approved WhatsApp templates:", error);
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

export default router;
