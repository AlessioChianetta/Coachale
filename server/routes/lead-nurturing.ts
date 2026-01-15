import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, desc, asc } from "drizzle-orm";
import * as schema from "@shared/schema";
import { generateNurturingTemplates, regenerateTemplate, getTemplateCount } from "../services/lead-nurturing-generation-service";
import { validateTemplate } from "../services/template-compiler";

const router = Router();

router.get("/lead-nurturing/config", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const config = await storage.getNurturingConfig(consultantId);
    
    if (!config) {
      return res.json({
        success: true,
        config: {
          isEnabled: false,
          sendHour: 9,
          sendMinute: 0,
          timezone: "Europe/Rome",
          skipWeekends: false,
        },
      });
    }
    
    res.json({ success: true, config });
  } catch (error: any) {
    console.error("[NURTURING] Error fetching config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/lead-nurturing/config", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { isEnabled, sendHour, sendMinute, timezone, skipWeekends } = req.body;
    
    const existing = await storage.getNurturingConfig(consultantId);
    
    if (existing) {
      await db.update(schema.leadNurturingConfig)
        .set({
          isEnabled: isEnabled ?? existing.isEnabled,
          sendHour: sendHour ?? existing.sendHour,
          sendMinute: sendMinute ?? existing.sendMinute,
          timezone: timezone ?? existing.timezone,
          skipWeekends: skipWeekends ?? existing.skipWeekends,
          updatedAt: new Date(),
        })
        .where(eq(schema.leadNurturingConfig.consultantId, consultantId));
    } else {
      await db.insert(schema.leadNurturingConfig).values({
        consultantId,
        isEnabled: isEnabled ?? false,
        sendHour: sendHour ?? 9,
        sendMinute: sendMinute ?? 0,
        timezone: timezone ?? "Europe/Rome",
        skipWeekends: skipWeekends ?? false,
      });
    }
    
    const updated = await storage.getNurturingConfig(consultantId);
    res.json({ success: true, config: updated });
  } catch (error: any) {
    console.error("[NURTURING] Error updating config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/lead-nurturing/templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const category = req.query.category as string;
    
    const offset = (page - 1) * limit;
    
    let query = db.select()
      .from(schema.leadNurturingTemplates)
      .where(eq(schema.leadNurturingTemplates.consultantId, consultantId))
      .orderBy(asc(schema.leadNurturingTemplates.dayNumber));
    
    const allTemplates = await query;
    
    let filtered = allTemplates;
    if (category) {
      filtered = allTemplates.filter(t => t.category === category);
    }
    
    const total = filtered.length;
    const templates = filtered.slice(offset, offset + limit);
    
    res.json({
      success: true,
      templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("[NURTURING] Error fetching templates:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/lead-nurturing/templates/:dayNumber", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const dayNumber = parseInt(req.params.dayNumber);
    
    if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 365) {
      return res.status(400).json({ success: false, error: "dayNumber deve essere tra 1 e 365" });
    }
    
    const [template] = await db.select()
      .from(schema.leadNurturingTemplates)
      .where(
        and(
          eq(schema.leadNurturingTemplates.consultantId, consultantId),
          eq(schema.leadNurturingTemplates.dayNumber, dayNumber)
        )
      )
      .limit(1);
    
    if (!template) {
      return res.status(404).json({ success: false, error: "Template non trovato" });
    }
    
    res.json({ success: true, template });
  } catch (error: any) {
    console.error("[NURTURING] Error fetching template:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/lead-nurturing/templates/:dayNumber", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const dayNumber = parseInt(req.params.dayNumber);
    const { subject, body, isActive } = req.body;
    
    if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 365) {
      return res.status(400).json({ success: false, error: "dayNumber deve essere tra 1 e 365" });
    }
    
    if (subject !== undefined || body !== undefined) {
      const validation = validateTemplate({ 
        subject: subject ?? "", 
        body: body ?? "" 
      });
      if (!validation.valid) {
        return res.status(400).json({ 
          success: false, 
          error: "Template non valido",
          errors: validation.errors 
        });
      }
    }
    
    const [existing] = await db.select()
      .from(schema.leadNurturingTemplates)
      .where(
        and(
          eq(schema.leadNurturingTemplates.consultantId, consultantId),
          eq(schema.leadNurturingTemplates.dayNumber, dayNumber)
        )
      )
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: "Template non trovato" });
    }
    
    await db.update(schema.leadNurturingTemplates)
      .set({
        subject: subject ?? existing.subject,
        body: body ?? existing.body,
        isActive: isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.leadNurturingTemplates.consultantId, consultantId),
          eq(schema.leadNurturingTemplates.dayNumber, dayNumber)
        )
      );
    
    const [updated] = await db.select()
      .from(schema.leadNurturingTemplates)
      .where(
        and(
          eq(schema.leadNurturingTemplates.consultantId, consultantId),
          eq(schema.leadNurturingTemplates.dayNumber, dayNumber)
        )
      )
      .limit(1);
    
    res.json({ success: true, template: updated });
  } catch (error: any) {
    console.error("[NURTURING] Error updating template:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/lead-nurturing/templates/:dayNumber/regenerate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const dayNumber = parseInt(req.params.dayNumber);
    const { businessDescription, targetAudience, tone, companyName, senderName } = req.body;
    
    if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 365) {
      return res.status(400).json({ success: false, error: "dayNumber deve essere tra 1 e 365" });
    }
    
    if (!businessDescription) {
      return res.status(400).json({ success: false, error: "businessDescription è richiesto" });
    }
    
    const result = await regenerateTemplate(consultantId, dayNumber, {
      consultantId,
      businessDescription,
      targetAudience: targetAudience || "Clienti interessati ai nostri servizi",
      tone: tone || "professionale ma amichevole",
      companyName,
      senderName,
    });
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    const [template] = await db.select()
      .from(schema.leadNurturingTemplates)
      .where(
        and(
          eq(schema.leadNurturingTemplates.consultantId, consultantId),
          eq(schema.leadNurturingTemplates.dayNumber, dayNumber)
        )
      )
      .limit(1);
    
    res.json({ success: true, template });
  } catch (error: any) {
    console.error("[NURTURING] Error regenerating template:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/lead-nurturing/variables", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const variables = await storage.getEmailVariables(consultantId);
    
    if (!variables) {
      return res.json({
        success: true,
        variables: {
          calendarLink: null,
          companyName: null,
          whatsappNumber: null,
          emailSignature: null,
          customVariables: {},
        },
      });
    }
    
    res.json({ success: true, variables });
  } catch (error: any) {
    console.error("[NURTURING] Error fetching variables:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/lead-nurturing/variables", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { calendarLink, companyName, whatsappNumber, emailSignature, customVariables } = req.body;
    
    const existing = await storage.getEmailVariables(consultantId);
    
    if (existing) {
      await db.update(schema.consultantEmailVariables)
        .set({
          calendarLink: calendarLink !== undefined ? calendarLink : existing.calendarLink,
          companyName: companyName !== undefined ? companyName : existing.companyName,
          whatsappNumber: whatsappNumber !== undefined ? whatsappNumber : existing.whatsappNumber,
          emailSignature: emailSignature !== undefined ? emailSignature : existing.emailSignature,
          customVariables: customVariables !== undefined ? customVariables : existing.customVariables,
          updatedAt: new Date(),
        })
        .where(eq(schema.consultantEmailVariables.consultantId, consultantId));
    } else {
      await db.insert(schema.consultantEmailVariables).values({
        consultantId,
        calendarLink,
        companyName,
        whatsappNumber,
        emailSignature,
        customVariables: customVariables || {},
      });
    }
    
    const updated = await storage.getEmailVariables(consultantId);
    res.json({ success: true, variables: updated });
  } catch (error: any) {
    console.error("[NURTURING] Error updating variables:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/lead-nurturing/generate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { businessDescription, targetAudience, tone, companyName, senderName } = req.body;
    
    if (!businessDescription) {
      return res.status(400).json({ success: false, error: "businessDescription è richiesto" });
    }
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    
    const result = await generateNurturingTemplates({
      consultantId,
      businessDescription,
      targetAudience: targetAudience || "Clienti interessati ai nostri servizi",
      tone: tone || "professionale ma amichevole",
      companyName,
      senderName,
    }, res);
    
    res.write(`data: ${JSON.stringify({ 
      status: result.success ? "completed" : "error",
      generated: result.generated,
      errors: result.errors 
    })}\n\n`);
    
    res.end();
  } catch (error: any) {
    console.error("[NURTURING] Error generating templates:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ status: "error", error: error.message })}\n\n`);
      res.end();
    }
  }
});

router.get("/lead-nurturing/analytics", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const analytics = await storage.getNurturingAnalytics(consultantId);
    
    res.json({ success: true, analytics });
  } catch (error: any) {
    console.error("[NURTURING] Error fetching analytics:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/lead-nurturing/templates/count", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const count = await getTemplateCount(consultantId);
    
    res.json({ success: true, count, total: 365 });
  } catch (error: any) {
    console.error("[NURTURING] Error fetching template count:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
