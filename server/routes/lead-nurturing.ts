import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, desc, asc, inArray, sql, notInArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import { generateNurturingTemplates, regenerateTemplate, getTemplateCount, generatePreviewTemplate, generateRemainingTemplates } from "../services/lead-nurturing-generation-service";
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

export default router;
