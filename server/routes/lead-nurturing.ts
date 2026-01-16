import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, desc, asc, inArray, sql, notInArray, gte, lte } from "drizzle-orm";
import * as schema from "@shared/schema";
import { generateNurturingTemplates, regenerateTemplate, getTemplateCount, generatePreviewTemplate, generateRemainingTemplates, getGenerationStatus, generateWeekBlock } from "../services/lead-nurturing-generation-service";
import { validateTemplate } from "../services/template-compiler";
import { extractTextFromFile } from "../services/document-processor";
import fs from "fs/promises";
import crypto from "crypto";

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
    
    // Carica Brand Voice data dal database
    const config = await storage.getNurturingConfig(consultantId);
    const brandVoiceData = config?.brandVoiceData || undefined;
    
    const result = await regenerateTemplate(consultantId, dayNumber, {
      consultantId,
      businessDescription,
      targetAudience: targetAudience || "Clienti interessati ai nostri servizi",
      tone: tone || "professionale ma amichevole",
      companyName,
      senderName,
      brandVoiceData,
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
    
    // Carica Brand Voice data dal database
    const config = await storage.getNurturingConfig(consultantId);
    const brandVoiceData = config?.brandVoiceData || undefined;
    
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
      brandVoiceData,
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

router.post("/lead-nurturing/generate-preview", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { businessDescription, targetAudience, tone, companyName, senderName } = req.body;
    
    if (!businessDescription) {
      return res.status(400).json({ success: false, error: "businessDescription è richiesto" });
    }
    
    const config = await storage.getNurturingConfig(consultantId);
    const brandVoiceData = config?.brandVoiceData || undefined;
    
    const result = await generatePreviewTemplate({
      consultantId,
      businessDescription,
      targetAudience: targetAudience || "Clienti interessati ai nostri servizi",
      tone: tone || "professionale ma amichevole",
      companyName,
      senderName,
      brandVoiceData,
    });
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    res.json({ success: true, template: result.template });
  } catch (error: any) {
    console.error("[NURTURING] Error generating preview:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/lead-nurturing/generate-remaining", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { businessDescription, targetAudience, tone, companyName, senderName, previewTemplate } = req.body;
    
    if (!businessDescription) {
      return res.status(400).json({ success: false, error: "businessDescription è richiesto" });
    }
    
    const config = await storage.getNurturingConfig(consultantId);
    const brandVoiceData = config?.brandVoiceData || undefined;
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    
    if (previewTemplate) {
      await db.delete(schema.leadNurturingTemplates)
        .where(eq(schema.leadNurturingTemplates.consultantId, consultantId));
      
      await db.insert(schema.leadNurturingTemplates).values({
        consultantId,
        dayNumber: 1,
        subject: previewTemplate.subject,
        body: previewTemplate.body,
        category: previewTemplate.category || "welcome",
        isActive: true,
      });
      
      res.write(`data: ${JSON.stringify({ progress: { current: 1, total: 365, percent: 0.27 } })}\n\n`);
    }
    
    const result = await generateRemainingTemplates({
      consultantId,
      businessDescription,
      targetAudience: targetAudience || "Clienti interessati ai nostri servizi",
      tone: tone || "professionale ma amichevole",
      companyName,
      senderName,
      brandVoiceData,
    }, 2, res);
    
    res.write(`data: ${JSON.stringify({ 
      completed: true,
      status: result.success ? "completed" : "error",
      generated: result.generated + 1,
      errors: result.errors 
    })}\n\n`);
    
    res.end();
  } catch (error: any) {
    console.error("[NURTURING] Error generating remaining templates:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ status: "error", error: error.message })}\n\n`);
      res.end();
    }
  }
});

// NEW: Get generation status - how many templates exist and next day to generate
router.get("/lead-nurturing/generation-status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = await getGenerationStatus(consultantId);
    
    res.json({ success: true, ...status });
  } catch (error: any) {
    console.error("[NURTURING] Error fetching generation status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Generate a week block (7 days at a time)
router.post("/lead-nurturing/generate-week", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { businessDescription, targetAudience, tone, companyName, senderName, startDay, previewTemplate } = req.body;
    
    if (!businessDescription) {
      return res.status(400).json({ success: false, error: "businessDescription è richiesto" });
    }
    
    const config = await storage.getNurturingConfig(consultantId);
    const brandVoiceData = config?.brandVoiceData || undefined;
    
    let actualStartDay = startDay || 1;
    let previewSaved = false;
    const savedTemplates: { dayNumber: number; subject: string; body: string; category: string }[] = [];
    
    // Fixed: If startDay === 1 and previewTemplate is provided, save it as day 1 first
    if (actualStartDay === 1 && previewTemplate && previewTemplate.subject && previewTemplate.body) {
      console.log(`[NURTURING] Saving approved preview template as day 1 for consultant ${consultantId}`);
      
      const category = "welcome"; // Day 1 is always welcome category
      
      // Check if day 1 already exists
      const existing = await db.select()
        .from(schema.leadNurturingTemplates)
        .where(
          and(
            eq(schema.leadNurturingTemplates.consultantId, consultantId),
            eq(schema.leadNurturingTemplates.dayNumber, 1)
          )
        );
      
      if (existing.length > 0) {
        // Update existing
        await db.update(schema.leadNurturingTemplates)
          .set({
            subject: previewTemplate.subject,
            body: previewTemplate.body,
            category,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.leadNurturingTemplates.consultantId, consultantId),
              eq(schema.leadNurturingTemplates.dayNumber, 1)
            )
          );
      } else {
        // Insert new
        await db.insert(schema.leadNurturingTemplates).values({
          consultantId,
          dayNumber: 1,
          subject: previewTemplate.subject,
          body: previewTemplate.body,
          category,
          isActive: true,
        });
      }
      
      savedTemplates.push({
        dayNumber: 1,
        subject: previewTemplate.subject,
        body: previewTemplate.body,
        category,
      });
      
      previewSaved = true;
      actualStartDay = 2; // Start generating from day 2
      console.log(`[NURTURING] Preview template saved as day 1, starting generation from day 2`);
    }
    
    const result = await generateWeekBlock({
      consultantId,
      businessDescription,
      targetAudience: targetAudience || "Clienti interessati ai nostri servizi",
      tone: tone || "professionale ma amichevole",
      companyName,
      senderName,
      brandVoiceData,
    }, actualStartDay);
    
    // Combine saved preview template with generated templates
    const allTemplates = [...savedTemplates, ...result.templates];
    const totalGenerated = previewSaved ? result.generated + 1 : result.generated;
    
    res.json({ 
      success: result.success, 
      generated: totalGenerated,
      templates: allTemplates,
      nextDay: result.nextDay,
      isComplete: result.isComplete,
      errors: result.errors,
      previewSaved,
    });
  } catch (error: any) {
    console.error("[NURTURING] Error generating week block:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE templates - single, range, or all
router.delete("/lead-nurturing/templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { days, range, all } = req.body as { 
      days?: number[];
      range?: { from: number; to: number };
      all?: boolean;
    };
    
    let deletedCount = 0;
    
    if (all) {
      // Delete all templates for this consultant
      const result = await db.delete(schema.leadNurturingTemplates)
        .where(eq(schema.leadNurturingTemplates.consultantId, consultantId))
        .returning();
      deletedCount = result.length;
      
      // Reset config
      await db.update(schema.leadNurturingConfig)
        .set({
          templatesGenerated: false,
          templatesCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(schema.leadNurturingConfig.consultantId, consultantId));
        
    } else if (range && range.from && range.to) {
      // Delete templates in range
      const result = await db.delete(schema.leadNurturingTemplates)
        .where(
          and(
            eq(schema.leadNurturingTemplates.consultantId, consultantId),
            gte(schema.leadNurturingTemplates.dayNumber, range.from),
            lte(schema.leadNurturingTemplates.dayNumber, range.to)
          )
        )
        .returning();
      deletedCount = result.length;
      
    } else if (days && days.length > 0) {
      // Delete specific days
      const result = await db.delete(schema.leadNurturingTemplates)
        .where(
          and(
            eq(schema.leadNurturingTemplates.consultantId, consultantId),
            inArray(schema.leadNurturingTemplates.dayNumber, days)
          )
        )
        .returning();
      deletedCount = result.length;
    } else {
      return res.status(400).json({ success: false, error: "Specificare days, range, o all" });
    }
    
    // Update templates count
    const status = await getGenerationStatus(consultantId);
    await db.update(schema.leadNurturingConfig)
      .set({
        templatesGenerated: status.totalGenerated > 0,
        templatesCount: status.totalGenerated,
        updatedAt: new Date(),
      })
      .where(eq(schema.leadNurturingConfig.consultantId, consultantId));
    
    console.log(`[NURTURING] Deleted ${deletedCount} templates for consultant ${consultantId}`);
    
    res.json({ 
      success: true, 
      deletedCount,  // Match frontend expected field name
      remaining: status.totalGenerated,
      nextDay: status.nextDay,
    });
  } catch (error: any) {
    console.error("[NURTURING] Error deleting templates:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// REGENERATE templates for specific days
router.post("/lead-nurturing/templates/regenerate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { days, range } = req.body as { 
      days?: number[];
      range?: { from: number; to: number };
    };
    
    // Get config for generation params
    const config = await storage.getNurturingConfig(consultantId);
    if (!config) {
      return res.status(400).json({ success: false, error: "Configurazione nurturing non trovata" });
    }
    
    // Determine which days to regenerate
    let daysToRegenerate: number[] = [];
    
    if (range && range.from && range.to) {
      daysToRegenerate = Array.from({ length: range.to - range.from + 1 }, (_, i) => i + range.from);
    } else if (days && days.length > 0) {
      daysToRegenerate = days;
    } else {
      return res.status(400).json({ success: false, error: "Specificare days o range" });
    }
    
    // Delete existing templates for these days first
    await db.delete(schema.leadNurturingTemplates)
      .where(
        and(
          eq(schema.leadNurturingTemplates.consultantId, consultantId),
          inArray(schema.leadNurturingTemplates.dayNumber, daysToRegenerate)
        )
      );
    
    // Regenerate each requested day (not just a 7-day block)
    const generationConfig = {
      consultantId,
      businessDescription: config.businessDescription || "",
      targetAudience: "Clienti interessati ai nostri servizi",
      tone: config.preferredTone || "professionale ma amichevole",
      brandVoiceData: config.brandVoiceData || undefined,
    };
    
    // Generate templates for all requested days in 7-day chunks
    const allTemplates: any[] = [];
    const allErrors: string[] = [];
    
    // Sort days and process in chunks of 7
    const sortedDays = [...daysToRegenerate].sort((a, b) => a - b);
    
    for (let i = 0; i < sortedDays.length; i += 7) {
      const chunkStart = sortedDays[i];
      const result = await generateWeekBlock(generationConfig, chunkStart);
      
      // Filter to only include templates for days we actually requested
      const relevantTemplates = result.templates.filter(t => sortedDays.includes(t.dayNumber));
      allTemplates.push(...relevantTemplates);
      allErrors.push(...result.errors);
    }
    
    // Update config count
    const status = await getGenerationStatus(consultantId);
    await db.update(schema.leadNurturingConfig)
      .set({
        templatesGenerated: status.totalGenerated > 0,
        templatesCount: status.totalGenerated,
        updatedAt: new Date(),
      })
      .where(eq(schema.leadNurturingConfig.consultantId, consultantId));
    
    res.json({
      success: allErrors.length === 0,
      regeneratedCount: allTemplates.length,  // Match frontend expected field name
      templates: allTemplates,
      errors: allErrors,
    });
  } catch (error: any) {
    console.error("[NURTURING] Error regenerating templates:", error);
    res.status(500).json({ success: false, error: error.message });
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

// Brand Voice endpoint per salvare dati identità brand
router.get("/lead-nurturing/brand-voice", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const config = await storage.getNurturingConfig(consultantId);
    
    res.json({ 
      success: true, 
      brandVoice: config?.brandVoiceData || {} 
    });
  } catch (error: any) {
    console.error("[NURTURING] Error fetching brand voice:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/lead-nurturing/brand-voice", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const brandVoiceData = req.body;
    
    const existing = await storage.getNurturingConfig(consultantId);
    
    if (existing) {
      await db.update(schema.leadNurturingConfig)
        .set({
          brandVoiceData,
          updatedAt: new Date(),
        })
        .where(eq(schema.leadNurturingConfig.consultantId, consultantId));
    } else {
      await db.insert(schema.leadNurturingConfig).values({
        consultantId,
        brandVoiceData,
      });
    }
    
    const updated = await storage.getNurturingConfig(consultantId);
    res.json({ success: true, brandVoice: updated?.brandVoiceData });
  } catch (error: any) {
    console.error("[NURTURING] Error saving brand voice:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== KNOWLEDGE BASE ENDPOINTS =====================

router.get("/lead-nurturing/knowledge", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const items = await db
      .select()
      .from(schema.nurturingKnowledgeItems)
      .where(eq(schema.nurturingKnowledgeItems.consultantId, consultantId))
      .orderBy(asc(schema.nurturingKnowledgeItems.order), asc(schema.nurturingKnowledgeItems.createdAt));

    res.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error: any) {
    console.error("[NURTURING KB] Error fetching knowledge items:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/lead-nurturing/knowledge", authenticateToken, requireRole("consultant"), upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { title, type, content: textContent } = req.body;

    if (!title || !type) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: title, type",
      });
    }

    if (!['text', 'pdf', 'docx', 'txt'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid type. Must be one of: text, pdf, docx, txt",
      });
    }

    let content: string;
    let filePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    if (type === 'text') {
      if (!textContent || textContent.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Content is required for text type",
        });
      }
      content = textContent.trim();
    } else {
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: `File upload is required for type: ${type}`,
        });
      }

      const expectedMimeTypes: Record<string, string[]> = {
        pdf: ['application/pdf'],
        docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
        txt: ['text/plain'],
      };

      if (!expectedMimeTypes[type]?.includes(file.mimetype)) {
        await fs.unlink(file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          error: `File type mismatch. Expected ${type}, got ${file.mimetype}`,
        });
      }

      try {
        content = await extractTextFromFile(file.path, file.mimetype);
        filePath = file.path;
        fileName = file.originalname;
        fileSize = file.size;
      } catch (extractionError: any) {
        await fs.unlink(file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          error: `Text extraction failed: ${extractionError.message}`,
        });
      }
    }

    const [existingByTitle] = await db
      .select({ id: schema.nurturingKnowledgeItems.id, title: schema.nurturingKnowledgeItems.title })
      .from(schema.nurturingKnowledgeItems)
      .where(and(
        eq(schema.nurturingKnowledgeItems.consultantId, consultantId),
        eq(schema.nurturingKnowledgeItems.title, title)
      ))
      .limit(1);

    if (existingByTitle) {
      if (filePath) {
        await fs.unlink(filePath).catch(() => {});
      }
      return res.status(409).json({
        success: false,
        error: "duplicate",
        message: `Un documento con il titolo "${title}" esiste già`,
        existingId: existingByTitle.id,
      });
    }

    const [maxOrderResult] = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${schema.nurturingKnowledgeItems.order}), 0)` })
      .from(schema.nurturingKnowledgeItems)
      .where(eq(schema.nurturingKnowledgeItems.consultantId, consultantId));

    const nextOrder = (maxOrderResult?.maxOrder || 0) + 1;

    const itemId = crypto.randomUUID();
    const [newItem] = await db
      .insert(schema.nurturingKnowledgeItems)
      .values({
        id: itemId,
        consultantId,
        title,
        type: type as 'text' | 'pdf' | 'docx' | 'txt',
        content,
        filePath,
        fileName,
        fileSize,
        order: nextOrder,
      })
      .returning();

    console.log(`✅ [NURTURING KB] Created item: "${title}" (type: ${type})`);

    res.status(201).json({
      success: true,
      data: newItem,
      message: "Knowledge item created successfully",
    });
  } catch (error: any) {
    console.error("[NURTURING KB] Error creating item:", error);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/lead-nurturing/knowledge/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;

    const [existingItem] = await db
      .select()
      .from(schema.nurturingKnowledgeItems)
      .where(
        and(
          eq(schema.nurturingKnowledgeItems.id, id),
          eq(schema.nurturingKnowledgeItems.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: "Knowledge item not found",
      });
    }

    if (existingItem.filePath) {
      await fs.unlink(existingItem.filePath).catch((err) => {
        console.warn(`[NURTURING KB] Could not delete file ${existingItem.filePath}:`, err.message);
      });
    }

    await db
      .delete(schema.nurturingKnowledgeItems)
      .where(eq(schema.nurturingKnowledgeItems.id, id));

    console.log(`🗑️ [NURTURING KB] Deleted item: "${existingItem.title}"`);

    res.json({
      success: true,
      message: "Knowledge item deleted successfully",
    });
  } catch (error: any) {
    console.error("[NURTURING KB] Error deleting item:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/lead-nurturing/knowledge/import-candidates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;

    const existingItems = await db
      .select({ sourceConsultantDocId: schema.nurturingKnowledgeItems.sourceConsultantDocId })
      .from(schema.nurturingKnowledgeItems)
      .where(eq(schema.nurturingKnowledgeItems.consultantId, consultantId));

    const alreadyImportedIds = existingItems
      .map(item => item.sourceConsultantDocId)
      .filter((id): id is string => id !== null);

    let query = db
      .select()
      .from(schema.consultantKnowledgeDocuments)
      .where(eq(schema.consultantKnowledgeDocuments.consultantId, consultantId));

    const candidates = await query;

    const availableCandidates = candidates.filter(
      doc => !alreadyImportedIds.includes(doc.id)
    );

    res.json({
      success: true,
      data: availableCandidates,
      count: availableCandidates.length,
      totalInKB: candidates.length,
      alreadyImported: alreadyImportedIds.length,
    });
  } catch (error: any) {
    console.error("[NURTURING KB] Error fetching import candidates:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/lead-nurturing/knowledge/import", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "documentIds array is required",
      });
    }

    const kbDocuments = await db
      .select()
      .from(schema.consultantKnowledgeDocuments)
      .where(
        and(
          eq(schema.consultantKnowledgeDocuments.consultantId, consultantId),
          inArray(schema.consultantKnowledgeDocuments.id, documentIds)
        )
      );

    if (kbDocuments.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No matching documents found in your Knowledge Base",
      });
    }

    const existingItems = await db
      .select({ sourceConsultantDocId: schema.nurturingKnowledgeItems.sourceConsultantDocId })
      .from(schema.nurturingKnowledgeItems)
      .where(eq(schema.nurturingKnowledgeItems.consultantId, consultantId));

    const alreadyImportedIds = new Set(
      existingItems.map(item => item.sourceConsultantDocId).filter((id): id is string => id !== null)
    );

    const [maxOrderResult] = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${schema.nurturingKnowledgeItems.order}), 0)` })
      .from(schema.nurturingKnowledgeItems)
      .where(eq(schema.nurturingKnowledgeItems.consultantId, consultantId));

    let nextOrder = (maxOrderResult?.maxOrder || 0) + 1;

    let importedCount = 0;
    let skippedCount = 0;
    const importedItems: any[] = [];

    for (const doc of kbDocuments) {
      if (alreadyImportedIds.has(doc.id)) {
        console.log(`⏭️ [NURTURING KB IMPORT] Skipping already imported: "${doc.fileName}"`);
        skippedCount++;
        continue;
      }

      let itemType: 'text' | 'pdf' | 'docx' | 'txt' = 'text';
      if (doc.fileType === 'application/pdf' || doc.fileType === 'pdf') {
        itemType = 'pdf';
      } else if (doc.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || doc.fileType === 'docx') {
        itemType = 'docx';
      } else if (doc.fileType === 'text/plain' || doc.fileType === 'txt') {
        itemType = 'txt';
      }

      const itemId = crypto.randomUUID();
      const [newItem] = await db
        .insert(schema.nurturingKnowledgeItems)
        .values({
          id: itemId,
          consultantId,
          title: doc.fileName?.replace(/\.[^/.]+$/, '') || `Documento ${importedCount + 1}`,
          type: itemType,
          content: doc.extractedText || '',
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          sourceConsultantDocId: doc.id,
          order: nextOrder++,
        })
        .returning();

      alreadyImportedIds.add(doc.id);
      importedItems.push(newItem);
      importedCount++;
      console.log(`✅ [NURTURING KB IMPORT] Imported: "${doc.fileName}"`);
    }

    console.log(`📥 [NURTURING KB IMPORT] Completed: ${importedCount} imported, ${skippedCount} skipped`);

    res.status(201).json({
      success: true,
      importedCount,
      skippedCount,
      data: importedItems,
      message: `Imported ${importedCount} document(s)${skippedCount > 0 ? `, skipped ${skippedCount} already imported` : ''}`,
    });
  } catch (error: any) {
    console.error("[NURTURING KB IMPORT] Error importing documents:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// TOPICS ENDPOINTS - Argomenti 365 giorni
// ============================================================

// GET /lead-nurturing/topics - Lista tutti gli argomenti
router.get("/lead-nurturing/topics", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const topics = await db.select()
      .from(schema.leadNurturingTopics)
      .where(eq(schema.leadNurturingTopics.consultantId, consultantId))
      .orderBy(asc(schema.leadNurturingTopics.day));
    
    res.json({ 
      success: true, 
      topics,
      count: topics.length 
    });
  } catch (error: any) {
    console.error("[NURTURING TOPICS] Error fetching topics:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /lead-nurturing/topics/:id - Modifica un argomento
router.put("/lead-nurturing/topics/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const topicId = req.params.id;
    const { title, description } = req.body;
    
    // Verifica che il topic appartenga al consulente
    const [existing] = await db.select()
      .from(schema.leadNurturingTopics)
      .where(and(
        eq(schema.leadNurturingTopics.id, topicId),
        eq(schema.leadNurturingTopics.consultantId, consultantId)
      ));
    
    if (!existing) {
      return res.status(404).json({ success: false, error: "Topic not found" });
    }
    
    const [updated] = await db.update(schema.leadNurturingTopics)
      .set({
        title: title || existing.title,
        description: description !== undefined ? description : existing.description,
        updatedAt: new Date(),
      })
      .where(eq(schema.leadNurturingTopics.id, topicId))
      .returning();
    
    res.json({ success: true, topic: updated });
  } catch (error: any) {
    console.error("[NURTURING TOPICS] Error updating topic:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /lead-nurturing/topics - Elimina tutti gli argomenti (per rigenerazione)
router.delete("/lead-nurturing/topics", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    await db.delete(schema.leadNurturingTopics)
      .where(eq(schema.leadNurturingTopics.consultantId, consultantId));
    
    res.json({ success: true, message: "All topics deleted" });
  } catch (error: any) {
    console.error("[NURTURING TOPICS] Error deleting topics:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /lead-nurturing/topics-generation-status - Ottieni stato generazione topics (per polling)
router.get("/lead-nurturing/topics-generation-status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const config = await storage.getNurturingConfig(consultantId);
    
    if (!config) {
      return res.json({
        success: true,
        status: "idle",
        progress: 0,
        total: 365,
        error: null,
      });
    }
    
    res.json({
      success: true,
      status: config.topicsGenerationStatus || "idle",
      progress: config.topicsGenerationProgress || 0,
      total: 365,
      error: config.topicsGenerationError || null,
    });
  } catch (error: any) {
    console.error("[TOPICS STATUS] Error getting status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /lead-nurturing/generate-outline - Genera 365 argomenti con AI
router.post("/lead-nurturing/generate-outline", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    // Ottieni config per brand voice
    const config = await storage.getNurturingConfig(consultantId);
    const brandVoiceData = config?.brandVoiceData || {};
    
    // Importa il servizio di generazione argomenti
    const { generateTopicsOutline } = await import("../services/lead-nurturing-generation-service");
    
    // Avvia la generazione in background (non aspettiamo il completamento)
    generateTopicsOutline(consultantId, brandVoiceData)
      .then(result => {
        console.log(`[TOPICS GENERATION] Background generation completed: ${result.generated} topics`);
      })
      .catch(err => {
        console.error("[TOPICS GENERATION] Background generation error:", err);
      });
    
    // Rispondi subito - il frontend userà polling per seguire il progresso
    res.json({ 
      success: true, 
      message: "Generazione avviata in background",
      status: "running"
    });
  } catch (error: any) {
    console.error("[NURTURING TOPICS] Error starting outline generation:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /lead-nurturing/save-config - Salva configurazione (businessDescription, targetAudience, tone)
router.put("/lead-nurturing/save-config", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { businessDescription, targetAudience, preferredTone, referenceEmail } = req.body;
    
    const existing = await storage.getNurturingConfig(consultantId);
    
    if (existing) {
      await db.update(schema.leadNurturingConfig)
        .set({
          businessDescription: businessDescription ?? existing.businessDescription,
          targetAudience: targetAudience ?? existing.targetAudience,
          preferredTone: preferredTone ?? existing.preferredTone,
          referenceEmail: referenceEmail ?? existing.referenceEmail,
          updatedAt: new Date(),
        })
        .where(eq(schema.leadNurturingConfig.consultantId, consultantId));
    } else {
      await db.insert(schema.leadNurturingConfig).values({
        consultantId,
        businessDescription,
        targetAudience,
        preferredTone: preferredTone || "professionale",
        referenceEmail,
      });
    }
    
    const updated = await storage.getNurturingConfig(consultantId);
    res.json({ success: true, config: updated, message: "Configurazione salvata con successo" });
  } catch (error: any) {
    console.error("[NURTURING CONFIG] Error saving config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
