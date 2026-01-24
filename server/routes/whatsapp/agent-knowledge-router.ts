import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { db } from "../../db";
import {
  whatsappAgentKnowledgeItems,
  consultantWhatsappConfig,
  consultantKnowledgeDocuments,
  insertWhatsappAgentKnowledgeItemSchema,
  updateWhatsappAgentKnowledgeItemSchema,
  fileSearchStores,
  fileSearchDocuments,
  whatsappConversations,
  whatsappMessages,
} from "../../../shared/schema";
import { eq, and, asc, notInArray, desc, isNotNull, inArray, sql } from "drizzle-orm";
import { extractTextFromFile, getKnowledgeItemType } from "../../services/document-processor";
import { ensureGeminiFileValid } from "../../services/gemini-file-manager";
import { FileSearchService } from "../../ai/file-search-service";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const fileSearchService = new FileSearchService();

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

      // Check for duplicate title
      const [existingByTitle] = await db
        .select({ id: whatsappAgentKnowledgeItems.id, title: whatsappAgentKnowledgeItems.title })
        .from(whatsappAgentKnowledgeItems)
        .where(and(
          eq(whatsappAgentKnowledgeItems.agentConfigId, agentConfigId),
          eq(whatsappAgentKnowledgeItems.title, title)
        ))
        .limit(1);

      if (existingByTitle) {
        // Clean up uploaded file if exists
        if (filePath) {
          await fs.unlink(filePath).catch(() => {});
        }
        return res.status(409).json({
          success: false,
          error: "duplicate",
          message: `Un documento con il titolo "${title}" esiste già per questo agente`,
          existingId: existingByTitle.id,
        });
      }

      // Check for duplicate content (same hash)
      const contentHash = crypto.createHash('md5').update(content).digest('hex');
      const [existingByContent] = await db
        .select({ id: whatsappAgentKnowledgeItems.id, title: whatsappAgentKnowledgeItems.title })
        .from(whatsappAgentKnowledgeItems)
        .where(and(
          eq(whatsappAgentKnowledgeItems.agentConfigId, agentConfigId),
          sql`md5(${whatsappAgentKnowledgeItems.content}) = ${contentHash}`
        ))
        .limit(1);

      if (existingByContent) {
        // Clean up uploaded file if exists
        if (filePath) {
          await fs.unlink(filePath).catch(() => {});
        }
        return res.status(409).json({
          success: false,
          error: "duplicate_content",
          message: `Un documento con lo stesso contenuto esiste già: "${existingByContent.title}"`,
          existingId: existingByContent.id,
        });
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
 * POST /api/whatsapp/agent-config/:agentConfigId/knowledge/import
 * Import documents from consultant's Knowledge Base into this agent
 */
router.post(
  "/whatsapp/agent-config/:agentConfigId/knowledge/import",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentConfigId } = req.params;
      const consultantId = req.user!.id;
      const { documentIds } = req.body;

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "documentIds array is required",
        });
      }

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

      // Fetch the consultant's KB documents to import
      const kbDocuments = await db
        .select()
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.consultantId, consultantId),
            inArray(consultantKnowledgeDocuments.id, documentIds)
          )
        );

      if (kbDocuments.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No matching documents found in your Knowledge Base",
        });
      }

      // Ensure Gemini files are valid for PDFs (async, doesn't block)
      for (const doc of kbDocuments) {
        if (doc.geminiFileUri && doc.fileType === 'pdf') {
          ensureGeminiFileValid(doc.id).catch((error: any) => {
            console.warn(`⚠️ [GEMINI] Failed to ensure Gemini file validity during import: ${error.message}`);
          });
        }
      }

      // Get existing knowledge items for this agent to check for duplicates and get max order
      const existingItems = await db
        .select({ contentHash: whatsappAgentKnowledgeItems.contentHash })
        .from(whatsappAgentKnowledgeItems)
        .where(eq(whatsappAgentKnowledgeItems.agentConfigId, agentConfigId));

      const existingHashes = new Set(existingItems.map(item => item.contentHash).filter(Boolean));

      // Get max order
      const [maxOrderResult] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${whatsappAgentKnowledgeItems.order}), 0)` })
        .from(whatsappAgentKnowledgeItems)
        .where(eq(whatsappAgentKnowledgeItems.agentConfigId, agentConfigId));

      let nextOrder = (maxOrderResult?.maxOrder || 0) + 1;

      // Import each document
      let importedCount = 0;
      let skippedCount = 0;
      const importedItems: any[] = [];

      for (const doc of kbDocuments) {
        // Check for duplicate content using hash
        const contentHash = doc.extractedText 
          ? crypto.createHash('sha256').update(doc.extractedText).digest('hex')
          : null;

        if (contentHash && existingHashes.has(contentHash)) {
          console.log(`⏭️ [KB IMPORT] Skipping duplicate: "${doc.fileName}"`);
          skippedCount++;
          continue;
        }

        // Map KB document type to agent knowledge type
        let itemType: 'text' | 'pdf' | 'docx' | 'txt' = 'text';
        if (doc.fileType === 'application/pdf' || doc.fileType === 'pdf') {
          itemType = 'pdf';
        } else if (doc.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || doc.fileType === 'docx') {
          itemType = 'docx';
        } else if (doc.fileType === 'text/plain' || doc.fileType === 'txt') {
          itemType = 'txt';
        }

        // Create the knowledge item
        const itemId = crypto.randomUUID();
        const [newItem] = await db
          .insert(whatsappAgentKnowledgeItems)
          .values({
            id: itemId,
            agentConfigId,
            title: doc.fileName?.replace(/\.[^/.]+$/, '') || `Documento ${importedCount + 1}`,
            type: itemType,
            content: doc.extractedText || '',
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            contentHash,
            order: nextOrder++,
          })
          .returning();

        if (contentHash) {
          existingHashes.add(contentHash);
        }

        importedItems.push(newItem);
        importedCount++;
        console.log(`✅ [KB IMPORT] Imported: "${doc.fileName}" -> agent ${agentConfigId}`);
      }

      console.log(`📥 [KB IMPORT] Completed: ${importedCount} imported, ${skippedCount} skipped (duplicates)`);

      res.status(201).json({
        success: true,
        importedCount,
        skippedCount,
        data: importedItems,
        message: `Imported ${importedCount} document(s)${skippedCount > 0 ? `, skipped ${skippedCount} duplicate(s)` : ''}`,
      });
    } catch (error: any) {
      console.error("❌ [KB IMPORT] Error importing documents:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to import documents",
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

      // Delete from FileSearch first (get consultant store and pass storeId)
      try {
        const [consultantStore] = await db
          .select({ id: fileSearchStores.id })
          .from(fileSearchStores)
          .where(and(
            eq(fileSearchStores.ownerId, consultantId),
            eq(fileSearchStores.ownerType, 'consultant')
          ))
          .limit(1);
        
        if (consultantStore) {
          const deleteResult = await fileSearchService.deleteDocumentBySource(
            'whatsapp_agent_knowledge',
            itemId,
            consultantStore.id,
            consultantId
          );
          if (deleteResult.deleted > 0) {
            console.log(`🗑️ [KNOWLEDGE ITEMS] Deleted ${deleteResult.deleted} document(s) from FileSearch`);
          }
        }
      } catch (fileSearchError: any) {
        console.warn(`⚠️ [KNOWLEDGE ITEMS] Could not delete from FileSearch:`, fileSearchError.message);
        // Don't fail the request if FileSearch deletion fails
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

/**
 * GET /api/whatsapp/agents/:agentId/import-candidates
 * List documents from consultant's KB that can be imported (not already imported)
 */
router.get(
  "/whatsapp/agents/:agentId/import-candidates",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      const consultantId = req.user!.id;

      // Verify agent config belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentId),
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

      // Get already imported document IDs for this agent
      const alreadyImported = await db
        .select({ sourceDocId: whatsappAgentKnowledgeItems.sourceConsultantDocId })
        .from(whatsappAgentKnowledgeItems)
        .where(
          and(
            eq(whatsappAgentKnowledgeItems.agentConfigId, agentId),
            isNotNull(whatsappAgentKnowledgeItems.sourceConsultantDocId)
          )
        );

      const importedDocIds = alreadyImported
        .map(item => item.sourceDocId)
        .filter((id): id is string => id !== null);

      // Fetch consultant's KB documents that are indexed and not already imported
      let query = db
        .select({
          id: consultantKnowledgeDocuments.id,
          title: consultantKnowledgeDocuments.title,
          fileType: consultantKnowledgeDocuments.fileType,
          fileName: consultantKnowledgeDocuments.fileName,
          fileSize: consultantKnowledgeDocuments.fileSize,
          createdAt: consultantKnowledgeDocuments.createdAt,
          category: consultantKnowledgeDocuments.category,
        })
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.consultantId, consultantId),
            eq(consultantKnowledgeDocuments.status, "indexed")
          )
        )
        .orderBy(desc(consultantKnowledgeDocuments.createdAt));

      const candidates = await query;

      // Filter out already imported documents
      const filteredCandidates = importedDocIds.length > 0
        ? candidates.filter(doc => !importedDocIds.includes(doc.id))
        : candidates;

      console.log(`📋 [IMPORT CANDIDATES] Found ${filteredCandidates.length} documents for agent ${agentId}`);

      res.json({
        success: true,
        data: filteredCandidates,
        count: filteredCandidates.length,
        alreadyImportedCount: importedDocIds.length,
      });
    } catch (error: any) {
      console.error("❌ [IMPORT CANDIDATES] Error fetching candidates:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch import candidates",
      });
    }
  }
);

/**
 * POST /api/whatsapp/agents/:agentId/import-from-kb
 * Import selected documents from consultant's KB into agent's knowledge base
 */
router.post(
  "/whatsapp/agents/:agentId/import-from-kb",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      const { documentIds } = req.body as { documentIds: string[] };
      const consultantId = req.user!.id;

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "documentIds array is required and must not be empty",
        });
      }

      // Verify agent config belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentId),
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

      // Fetch the source documents
      const sourceDocuments = await db
        .select()
        .from(consultantKnowledgeDocuments)
        .where(
          and(
            eq(consultantKnowledgeDocuments.consultantId, consultantId),
            eq(consultantKnowledgeDocuments.status, "indexed")
          )
        );

      // Filter to only requested documents
      const docsToImport = sourceDocuments.filter(doc => documentIds.includes(doc.id));

      if (docsToImport.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid documents found to import",
        });
      }

      // Get max order value for this agent
      const [maxOrderResult] = await db
        .select({
          maxOrder: whatsappAgentKnowledgeItems.order,
        })
        .from(whatsappAgentKnowledgeItems)
        .where(eq(whatsappAgentKnowledgeItems.agentConfigId, agentId))
        .orderBy(desc(whatsappAgentKnowledgeItems.order))
        .limit(1);

      let nextOrder = (maxOrderResult?.maxOrder || 0) + 1;

      // Map consultant KB file type to agent knowledge type
      const mapFileType = (fileType: string): "text" | "pdf" | "docx" | "txt" => {
        if (fileType === "pdf") return "pdf";
        if (fileType === "docx") return "docx";
        if (fileType === "txt") return "txt";
        // For other types like md, csv, xlsx, etc., treat as text
        return "text";
      };

      // Import each document
      const importedItems = [];
      for (const doc of docsToImport) {
        const itemId = crypto.randomUUID();
        
        const [newItem] = await db
          .insert(whatsappAgentKnowledgeItems)
          .values({
            id: itemId,
            agentConfigId: agentId,
            title: doc.title,
            type: mapFileType(doc.fileType),
            content: doc.extractedContent || "",
            filePath: doc.filePath,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            order: nextOrder++,
            sourceConsultantDocId: doc.id,
          })
          .returning();

        importedItems.push(newItem);
        console.log(`✅ [IMPORT FROM KB] Imported "${doc.title}" -> agent ${agentId}`);
      }

      res.status(201).json({
        success: true,
        data: importedItems,
        message: `Successfully imported ${importedItems.length} document(s)`,
        importedCount: importedItems.length,
      });
    } catch (error: any) {
      console.error("❌ [IMPORT FROM KB] Error importing documents:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to import documents",
      });
    }
  }
);

/**
 * GET /api/whatsapp/agents/:configId/stats
 * Returns statistics for a WhatsApp agent including token usage and knowledge base info
 */
router.get(
  "/whatsapp/agents/:configId/stats",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { configId } = req.params;

      // Verify the agent belongs to this consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, configId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Get knowledge items for this agent
      const knowledgeItems = await db
        .select()
        .from(whatsappAgentKnowledgeItems)
        .where(eq(whatsappAgentKnowledgeItems.agentConfigId, configId));

      // Count by type and estimate tokens
      const estimateTokens = (text: string) => Math.ceil((text || "").length / 4);

      const knowledgeStats = {
        total: knowledgeItems.length,
        active: knowledgeItems.length, // All items are considered active (no isActive field in schema)
        byType: {} as Record<string, { count: number; tokens: number }>,
        totalTokens: 0,
      };

      for (const item of knowledgeItems) {
        const type = item.type || "text";
        if (!knowledgeStats.byType[type]) {
          knowledgeStats.byType[type] = { count: 0, tokens: 0 };
        }
        knowledgeStats.byType[type].count++;
        const tokens = estimateTokens(item.content || "");
        knowledgeStats.byType[type].tokens += tokens;
        knowledgeStats.totalTokens += tokens;
      }

      // Get FileSearch documents for this agent
      const [consultantStore] = await db
        .select()
        .from(fileSearchStores)
        .where(
          and(
            eq(fileSearchStores.ownerId, consultantId),
            eq(fileSearchStores.ownerType, "consultant"),
            eq(fileSearchStores.isActive, true)
          )
        )
        .limit(1);

      let fileSearchStats = {
        synced: 0,
        pending: 0,
        failed: 0,
        totalTokens: 0,
      };

      if (consultantStore) {
        // Get FileSearch documents that belong to this agent's knowledge items
        const knowledgeItemIds = knowledgeItems.map((i) => i.id);
        if (knowledgeItemIds.length > 0) {
          const fsDocuments = await db
            .select()
            .from(fileSearchDocuments)
            .where(
              and(
                eq(fileSearchDocuments.storeId, consultantStore.id),
                eq(fileSearchDocuments.sourceType, "whatsapp_agent_knowledge"),
                inArray(fileSearchDocuments.sourceId, knowledgeItemIds)
              )
            );

          for (const doc of fsDocuments) {
            if (doc.status === "indexed") fileSearchStats.synced++;
            else if (doc.status === "pending" || doc.status === "processing")
              fileSearchStats.pending++;
            else if (doc.status === "failed") fileSearchStats.failed++;
            fileSearchStats.totalTokens += doc.contentSize
              ? Math.ceil(doc.contentSize / 4)
              : 0;
          }
        }
      }

      // Get conversation stats for this agent
      const conversations = await db
        .select()
        .from(whatsappConversations)
        .where(eq(whatsappConversations.agentConfigId, configId));

      const conversationStats = {
        total: conversations.length,
        active: conversations.filter((c) => c.isActive).length,
        leads: conversations.filter((c) => c.isLead).length,
        proactiveLeads: conversations.filter((c) => c.isProactiveLead).length,
        converted: conversations.filter((c) => c.leadConvertedAt !== null).length,
      };

      // Get message count for this agent's conversations
      let messageTotal = 0;
      if (conversations.length > 0) {
        const conversationIds = conversations.map((c) => c.id);
        const messages = await db
          .select({ count: sql<number>`count(*)` })
          .from(whatsappMessages)
          .where(inArray(whatsappMessages.conversationId, conversationIds));
        messageTotal = Number(messages[0]?.count) || 0;
      }

      const messageStats = {
        total: messageTotal,
      };

      console.log(`📊 [WhatsApp Stats] Agent ${configId}: ${knowledgeStats.total} knowledge items, ${messageTotal} messages`);

      res.json({
        agentId: configId,
        agentName: agentConfig.agentName,
        isActive: agentConfig.isActive,
        knowledge: knowledgeStats,
        fileSearch: fileSearchStats,
        conversations: conversationStats,
        messages: messageStats,
      });
    } catch (error: any) {
      console.error("[WhatsApp Stats] Error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
