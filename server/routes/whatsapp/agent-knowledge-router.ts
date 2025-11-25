import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { db } from "../../db";
import {
  whatsappAgentKnowledgeItems,
  consultantWhatsappConfig,
  insertWhatsappAgentKnowledgeItemSchema,
  updateWhatsappAgentKnowledgeItemSchema,
} from "../../../shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { extractTextFromFile, getKnowledgeItemType } from "../../services/document-processor";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = Router();

/**
 * GET /api/whatsapp/agent-config/:agentConfigId/knowledge
 * List all knowledge items for an agent config
 */
router.get(
  "/whatsapp/agent-config/:agentConfigId/knowledge",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentConfigId } = req.params;
      const consultantId = req.user!.id;

      // Verify agent config belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agent configuration not found",
        });
      }

      // Fetch all knowledge items for this agent
      const items = await db
        .select()
        .from(whatsappAgentKnowledgeItems)
        .where(eq(whatsappAgentKnowledgeItems.agentConfigId, agentConfigId))
        .orderBy(asc(whatsappAgentKnowledgeItems.order), asc(whatsappAgentKnowledgeItems.createdAt));

      res.json({
        success: true,
        data: items,
        count: items.length,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE ITEMS] Error fetching items:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch knowledge items",
      });
    }
  }
);

/**
 * POST /api/whatsapp/agent-config/:agentConfigId/knowledge
 * Create a new knowledge item (text or document)
 * 
 * For type='text': expects { title, type: 'text', content }
 * For type='pdf/docx/txt': expects multipart/form-data with file + { title, type }
 */
router.post(
  "/whatsapp/agent-config/:agentConfigId/knowledge",
  authenticateToken,
  requireRole("consultant"),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const { agentConfigId } = req.params;
      const consultantId = req.user!.id;

      // Verify agent config belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agent configuration not found",
        });
      }

      const { title, type, content: textContent } = req.body;

      if (!title || !type) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: title, type",
        });
      }

      // Validate type
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

      // Handle text-based knowledge item
      if (type === 'text') {
        if (!textContent || textContent.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: "Content is required for text type",
          });
        }
        content = textContent.trim();
      }
      // Handle file-based knowledge item
      else {
        const file = req.file;

        if (!file) {
          return res.status(400).json({
            success: false,
            error: `File upload is required for type: ${type}`,
          });
        }

        // Verify file type matches expected type
        const expectedMimeTypes: Record<string, string[]> = {
          pdf: ['application/pdf'],
          docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
          txt: ['text/plain'],
        };

        if (!expectedMimeTypes[type]?.includes(file.mimetype)) {
          // Clean up uploaded file
          await fs.unlink(file.path).catch(() => {});
          return res.status(400).json({
            success: false,
            error: `File type mismatch. Expected ${type}, got ${file.mimetype}`,
          });
        }

        // Extract text from file
        try {
          content = await extractTextFromFile(file.path, file.mimetype);
          filePath = file.path;
          fileName = file.originalname;
          fileSize = file.size;
        } catch (extractionError: any) {
          // Clean up uploaded file on extraction error
          await fs.unlink(file.path).catch(() => {});
          return res.status(400).json({
            success: false,
            error: `Text extraction failed: ${extractionError.message}`,
          });
        }
      }

      // Get max order value for this agent to append new item at end
      const [maxOrderResult] = await db
        .select({
          maxOrder: whatsappAgentKnowledgeItems.order,
        })
        .from(whatsappAgentKnowledgeItems)
        .where(eq(whatsappAgentKnowledgeItems.agentConfigId, agentConfigId))
        .orderBy(asc(whatsappAgentKnowledgeItems.order))
        .limit(1);

      const nextOrder = (maxOrderResult?.maxOrder || 0) + 1;

      // Create knowledge item
      const itemId = crypto.randomUUID();
      const [newItem] = await db
        .insert(whatsappAgentKnowledgeItems)
        .values({
          id: itemId,
          agentConfigId,
          title,
          type: type as 'text' | 'pdf' | 'docx' | 'txt',
          content,
          filePath,
          fileName,
          fileSize,
          order: nextOrder,
        })
        .returning();

      console.log(`✅ [KNOWLEDGE ITEMS] Created item: "${title}" (type: ${type})`);

      res.status(201).json({
        success: true,
        data: newItem,
        message: "Knowledge item created successfully",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE ITEMS] Error creating item:", error);

      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }

      res.status(500).json({
        success: false,
        error: error.message || "Failed to create knowledge item",
      });
    }
  }
);

/**
 * PUT /api/whatsapp/agent-config/:agentConfigId/knowledge/:itemId
 * Update a knowledge item (only title and content for text type)
 */
router.put(
  "/whatsapp/agent-config/:agentConfigId/knowledge/:itemId",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentConfigId, itemId } = req.params;
      const consultantId = req.user!.id;

      // Verify agent config belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agent configuration not found",
        });
      }

      // Fetch existing item
      const [existingItem] = await db
        .select()
        .from(whatsappAgentKnowledgeItems)
        .where(
          and(
            eq(whatsappAgentKnowledgeItems.id, itemId),
            eq(whatsappAgentKnowledgeItems.agentConfigId, agentConfigId)
          )
        )
        .limit(1);

      if (!existingItem) {
        return res.status(404).json({
          success: false,
          error: "Knowledge item not found",
        });
      }

      // Allow updating title for all types, content only for text type
      const { title, content } = req.body;
      const updates: any = {};

      if (title !== undefined) {
        updates.title = title;
      }

      if (content !== undefined) {
        if (existingItem.type !== 'text') {
          return res.status(400).json({
            success: false,
            error: "Content can only be updated for text type items. For documents, delete and re-upload.",
          });
        }
        updates.content = content;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: "No fields to update",
        });
      }

      updates.updatedAt = new Date();

      // Update item
      const [updatedItem] = await db
        .update(whatsappAgentKnowledgeItems)
        .set(updates)
        .where(eq(whatsappAgentKnowledgeItems.id, itemId))
        .returning();

      console.log(`✅ [KNOWLEDGE ITEMS] Updated item: "${updatedItem.title}"`);

      res.json({
        success: true,
        data: updatedItem,
        message: "Knowledge item updated successfully",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE ITEMS] Error updating item:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update knowledge item",
      });
    }
  }
);

/**
 * DELETE /api/whatsapp/agent-config/:agentConfigId/knowledge/:itemId
 * Delete a knowledge item (and associated file if exists)
 */
router.delete(
  "/whatsapp/agent-config/:agentConfigId/knowledge/:itemId",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentConfigId, itemId } = req.params;
      const consultantId = req.user!.id;

      // Verify agent config belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentConfigId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agent configuration not found",
        });
      }

      // Fetch item to get file path
      const [item] = await db
        .select()
        .from(whatsappAgentKnowledgeItems)
        .where(
          and(
            eq(whatsappAgentKnowledgeItems.id, itemId),
            eq(whatsappAgentKnowledgeItems.agentConfigId, agentConfigId)
          )
        )
        .limit(1);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: "Knowledge item not found",
        });
      }

      // Delete from database
      await db
        .delete(whatsappAgentKnowledgeItems)
        .where(eq(whatsappAgentKnowledgeItems.id, itemId));

      // Delete associated file if exists
      if (item.filePath) {
        try {
          await fs.unlink(item.filePath);
          console.log(`🗑️  [KNOWLEDGE ITEMS] Deleted file: ${item.filePath}`);
        } catch (fileError) {
          console.warn(`⚠️  [KNOWLEDGE ITEMS] Could not delete file: ${item.filePath}`, fileError);
          // Don't fail the request if file deletion fails
        }
      }

      console.log(`✅ [KNOWLEDGE ITEMS] Deleted item: "${item.title}"`);

      res.json({
        success: true,
        message: "Knowledge item deleted successfully",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE ITEMS] Error deleting item:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete knowledge item",
      });
    }
  }
);

export default router;
