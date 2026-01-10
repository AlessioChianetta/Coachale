import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { db } from "../../db";
import {
  emailAccountKnowledgeItems,
  emailAccounts,
} from "../../../shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { extractTextFromFile, getKnowledgeItemType } from "../../services/document-processor";
import { FileSearchSyncService } from "../../services/file-search-sync-service";
import fs from "fs/promises";
import path from "path";

const router = Router();

/**
 * GET /api/email-hub/accounts/:accountId/knowledge
 * List all knowledge items for an email account
 */
router.get(
  "/email-hub/accounts/:accountId/knowledge",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { accountId } = req.params;
      const consultantId = req.user!.id;

      const [account] = await db
        .select()
        .from(emailAccounts)
        .where(
          and(
            eq(emailAccounts.id, accountId),
            eq(emailAccounts.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: "Account email non trovato",
        });
      }

      const items = await db
        .select()
        .from(emailAccountKnowledgeItems)
        .where(eq(emailAccountKnowledgeItems.accountId, accountId))
        .orderBy(asc(emailAccountKnowledgeItems.order), asc(emailAccountKnowledgeItems.createdAt));

      res.json({
        success: true,
        data: items,
        count: items.length,
      });
    } catch (error: any) {
      console.error("❌ [EMAIL KNOWLEDGE] Errore fetch items:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore nel recupero documenti",
      });
    }
  }
);

/**
 * POST /api/email-hub/accounts/:accountId/knowledge
 * Create a new knowledge item (text or document)
 */
router.post(
  "/email-hub/accounts/:accountId/knowledge",
  authenticateToken,
  requireRole("consultant"),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const { accountId } = req.params;
      const consultantId = req.user!.id;

      const [account] = await db
        .select()
        .from(emailAccounts)
        .where(
          and(
            eq(emailAccounts.id, accountId),
            eq(emailAccounts.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: "Account email non trovato",
        });
      }

      const { title, type, content: textContent } = req.body;

      if (!title || !type) {
        return res.status(400).json({
          success: false,
          error: "Campi obbligatori mancanti: title, type",
        });
      }

      if (!['text', 'pdf', 'docx', 'txt'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: "Tipo non valido. Usa: text, pdf, docx, txt",
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
            error: "Il contenuto è obbligatorio per tipo text",
          });
        }
        content = textContent.trim();
      } else {
        const file = req.file;

        if (!file) {
          return res.status(400).json({
            success: false,
            error: `File obbligatorio per tipo: ${type}`,
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
            error: `Tipo file non corrispondente. Atteso ${type}, ricevuto ${file.mimetype}`,
          });
        }

        try {
          content = await extractTextFromFile(file.path, file.mimetype);
          
          if (!content || content.trim().length === 0) {
            await fs.unlink(file.path).catch(() => {});
            return res.status(400).json({
              success: false,
              error: "Impossibile estrarre testo dal documento",
            });
          }
        } catch (extractError: any) {
          await fs.unlink(file.path).catch(() => {});
          return res.status(400).json({
            success: false,
            error: `Errore estrazione testo: ${extractError.message}`,
          });
        }

        filePath = file.path;
        fileName = file.originalname;
        fileSize = file.size;
      }

      const existingItems = await db
        .select({ order: emailAccountKnowledgeItems.order })
        .from(emailAccountKnowledgeItems)
        .where(eq(emailAccountKnowledgeItems.accountId, accountId))
        .orderBy(asc(emailAccountKnowledgeItems.order));

      const nextOrder = existingItems.length > 0 
        ? Math.max(...existingItems.map(i => i.order)) + 1 
        : 0;

      const [newItem] = await db
        .insert(emailAccountKnowledgeItems)
        .values({
          accountId,
          consultantId,
          title: title.trim(),
          type,
          content,
          filePath,
          fileName,
          fileSize,
          order: nextOrder,
        })
        .returning();

      console.log(`✅ [EMAIL KNOWLEDGE] Creato item: ${newItem.id} per account ${accountId}`);

      try {
        await FileSearchSyncService.syncEmailAccountKnowledge(accountId);
        console.log(`🔄 [EMAIL KNOWLEDGE] Sync FileSearch completato per account ${accountId}`);
      } catch (syncError: any) {
        console.error(`⚠️ [EMAIL KNOWLEDGE] Errore sync FileSearch:`, syncError.message);
      }

      res.status(201).json({
        success: true,
        data: newItem,
      });
    } catch (error: any) {
      console.error("❌ [EMAIL KNOWLEDGE] Errore creazione item:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore nella creazione del documento",
      });
    }
  }
);

/**
 * PUT /api/email-hub/accounts/:accountId/knowledge/:itemId
 * Update a knowledge item
 */
router.put(
  "/email-hub/accounts/:accountId/knowledge/:itemId",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { accountId, itemId } = req.params;
      const consultantId = req.user!.id;

      const [account] = await db
        .select()
        .from(emailAccounts)
        .where(
          and(
            eq(emailAccounts.id, accountId),
            eq(emailAccounts.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: "Account email non trovato",
        });
      }

      const [existingItem] = await db
        .select()
        .from(emailAccountKnowledgeItems)
        .where(
          and(
            eq(emailAccountKnowledgeItems.id, itemId),
            eq(emailAccountKnowledgeItems.accountId, accountId)
          )
        )
        .limit(1);

      if (!existingItem) {
        return res.status(404).json({
          success: false,
          error: "Documento non trovato",
        });
      }

      const { title, content } = req.body;
      const updates: Partial<typeof emailAccountKnowledgeItems.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (title !== undefined) updates.title = title.trim();
      if (content !== undefined && existingItem.type === 'text') {
        updates.content = content.trim();
      }

      const [updated] = await db
        .update(emailAccountKnowledgeItems)
        .set(updates)
        .where(eq(emailAccountKnowledgeItems.id, itemId))
        .returning();

      try {
        await FileSearchSyncService.syncEmailAccountKnowledge(accountId);
      } catch (syncError: any) {
        console.error(`⚠️ [EMAIL KNOWLEDGE] Errore sync FileSearch:`, syncError.message);
      }

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      console.error("❌ [EMAIL KNOWLEDGE] Errore aggiornamento item:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore nell'aggiornamento",
      });
    }
  }
);

/**
 * DELETE /api/email-hub/accounts/:accountId/knowledge/:itemId
 * Delete a knowledge item
 */
router.delete(
  "/email-hub/accounts/:accountId/knowledge/:itemId",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { accountId, itemId } = req.params;
      const consultantId = req.user!.id;

      const [account] = await db
        .select()
        .from(emailAccounts)
        .where(
          and(
            eq(emailAccounts.id, accountId),
            eq(emailAccounts.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: "Account email non trovato",
        });
      }

      const [item] = await db
        .select()
        .from(emailAccountKnowledgeItems)
        .where(
          and(
            eq(emailAccountKnowledgeItems.id, itemId),
            eq(emailAccountKnowledgeItems.accountId, accountId)
          )
        )
        .limit(1);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: "Documento non trovato",
        });
      }

      if (item.filePath) {
        await fs.unlink(item.filePath).catch(() => {});
      }

      await db
        .delete(emailAccountKnowledgeItems)
        .where(eq(emailAccountKnowledgeItems.id, itemId));

      console.log(`🗑️ [EMAIL KNOWLEDGE] Eliminato item: ${itemId}`);

      try {
        await FileSearchSyncService.syncEmailAccountKnowledge(accountId);
      } catch (syncError: any) {
        console.error(`⚠️ [EMAIL KNOWLEDGE] Errore sync FileSearch:`, syncError.message);
      }

      res.json({
        success: true,
        message: "Documento eliminato con successo",
      });
    } catch (error: any) {
      console.error("❌ [EMAIL KNOWLEDGE] Errore eliminazione item:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore nell'eliminazione",
      });
    }
  }
);

/**
 * POST /api/email-hub/accounts/:accountId/knowledge/sync
 * Force sync knowledge base to FileSearch
 */
router.post(
  "/email-hub/accounts/:accountId/knowledge/sync",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { accountId } = req.params;
      const consultantId = req.user!.id;

      const [account] = await db
        .select()
        .from(emailAccounts)
        .where(
          and(
            eq(emailAccounts.id, accountId),
            eq(emailAccounts.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: "Account email non trovato",
        });
      }

      const result = await FileSearchSyncService.syncEmailAccountKnowledge(accountId);

      res.json({
        success: true,
        message: "Sync completato",
        ...result,
      });
    } catch (error: any) {
      console.error("❌ [EMAIL KNOWLEDGE] Errore sync:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Errore nel sync",
      });
    }
  }
);

export default router;
