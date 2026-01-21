import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "@shared/schema";
import { 
  insertBrandAssetSchema,
  insertContentIdeaSchema,
  insertContentPostSchema,
  insertAdCampaignSchema,
  insertContentCalendarSchema,
  insertGeneratedImageSchema,
  insertContentTemplateSchema,
  insertContentFolderSchema
} from "@shared/schema";
import { eq, and, desc, gte, lte, isNull, asc, inArray } from "drizzle-orm";
import { z } from "zod";
import { getSuperAdminGeminiKeys, getAIProvider, getModelWithThinking } from "../ai/provider-factory";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { upload } from "../middleware/upload";
import { extractTextFromFile } from "../services/document-processor";

const router = Router();

// ============================================================
// BRAND ASSETS
// ============================================================

// GET /api/content/brand-assets - Get consultant's brand assets
router.get("/brand-assets", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const [brandAsset] = await db.select()
      .from(schema.brandAssets)
      .where(eq(schema.brandAssets.consultantId, consultantId))
      .limit(1);
    
    res.json({
      success: true,
      data: brandAsset || null
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching brand assets:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch brand assets"
    });
  }
});

// PUT /api/content/brand-assets - Create or update brand assets
router.put("/brand-assets", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const validatedData = insertBrandAssetSchema.parse({
      ...req.body,
      consultantId
    });
    
    // Check if brand assets already exist
    const [existing] = await db.select()
      .from(schema.brandAssets)
      .where(eq(schema.brandAssets.consultantId, consultantId))
      .limit(1);
    
    let result;
    if (existing) {
      // Update existing
      [result] = await db.update(schema.brandAssets)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(schema.brandAssets.id, existing.id))
        .returning();
    } else {
      // Create new
      [result] = await db.insert(schema.brandAssets)
        .values(validatedData)
        .returning();
    }
    
    res.json({
      success: true,
      data: result,
      message: existing ? "Brand assets updated" : "Brand assets created"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error saving brand assets:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to save brand assets"
    });
  }
});

// ============================================================
// CONTENT STUDIO BRAND VOICE (independent from Lead Nurturing)
// ============================================================

// GET /api/content/brand-voice - Get consultant's Content Studio brand voice
router.get("/brand-voice", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const [config] = await db.select()
      .from(schema.contentStudioConfig)
      .where(eq(schema.contentStudioConfig.consultantId, consultantId))
      .limit(1);
    
    res.json({
      success: true,
      brandVoice: config?.brandVoiceData || {},
      enabled: config?.brandVoiceEnabled ?? false
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching brand voice:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch brand voice"
    });
  }
});

// POST /api/content/brand-voice - Save consultant's Content Studio brand voice
router.post("/brand-voice", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { brandVoice, enabled } = req.body;
    
    const [existing] = await db.select()
      .from(schema.contentStudioConfig)
      .where(eq(schema.contentStudioConfig.consultantId, consultantId))
      .limit(1);
    
    if (existing) {
      await db.update(schema.contentStudioConfig)
        .set({
          brandVoiceData: brandVoice,
          brandVoiceEnabled: enabled ?? true,
          updatedAt: new Date(),
        })
        .where(eq(schema.contentStudioConfig.consultantId, consultantId));
    } else {
      await db.insert(schema.contentStudioConfig).values({
        consultantId,
        brandVoiceData: brandVoice,
        brandVoiceEnabled: enabled ?? true,
      });
    }
    
    const [updated] = await db.select()
      .from(schema.contentStudioConfig)
      .where(eq(schema.contentStudioConfig.consultantId, consultantId))
      .limit(1);
    
    res.json({ 
      success: true, 
      brandVoice: updated?.brandVoiceData || {},
      enabled: updated?.brandVoiceEnabled ?? false
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error saving brand voice:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to save brand voice"
    });
  }
});

// ============================================================
// CONTENT IDEAS
// ============================================================

// GET /api/content/ideas - List all ideas for consultant
router.get("/ideas", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = req.query.status as string | undefined;
    const contentType = req.query.contentType as string | undefined;
    
    let query = db.select()
      .from(schema.contentIdeas)
      .where(eq(schema.contentIdeas.consultantId, consultantId))
      .orderBy(desc(schema.contentIdeas.createdAt));
    
    const ideas = await query;
    
    // Filter in memory for optional params
    let filtered = ideas;
    if (status) {
      filtered = filtered.filter(i => i.status === status);
    }
    if (contentType) {
      filtered = filtered.filter(i => i.contentType === contentType);
    }
    
    res.json({
      success: true,
      data: filtered,
      count: filtered.length
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching content ideas:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch content ideas"
    });
  }
});

// POST /api/content/ideas - Create new idea
router.post("/ideas", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const validatedData = insertContentIdeaSchema.parse({
      ...req.body,
      consultantId
    });
    
    const [idea] = await db.insert(schema.contentIdeas)
      .values(validatedData)
      .returning();
    
    res.status(201).json({
      success: true,
      data: idea,
      message: "Content idea created"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error creating content idea:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create content idea"
    });
  }
});

// GET /api/content/ideas/:id - Get single idea by ID
router.get("/ideas/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const ideaId = req.params.id;
    
    const [idea] = await db.select()
      .from(schema.contentIdeas)
      .where(and(
        eq(schema.contentIdeas.id, ideaId),
        eq(schema.contentIdeas.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!idea) {
      return res.status(404).json({
        success: false,
        error: "Content idea not found"
      });
    }
    
    res.json({
      success: true,
      data: idea
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching content idea:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch content idea"
    });
  }
});

// PUT /api/content/ideas/:id - Update idea
router.put("/ideas/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const ideaId = req.params.id;
    
    // Verify ownership
    const [existing] = await db.select()
      .from(schema.contentIdeas)
      .where(and(
        eq(schema.contentIdeas.id, ideaId),
        eq(schema.contentIdeas.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Content idea not found"
      });
    }
    
    const validatedData = insertContentIdeaSchema.partial().parse(req.body);
    
    const [updated] = await db.update(schema.contentIdeas)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(schema.contentIdeas.id, ideaId))
      .returning();
    
    res.json({
      success: true,
      data: updated,
      message: "Content idea updated"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error updating content idea:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update content idea"
    });
  }
});

// DELETE /api/content/ideas/:id - Delete idea
router.delete("/ideas/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const ideaId = req.params.id;
    
    const [deleted] = await db.delete(schema.contentIdeas)
      .where(and(
        eq(schema.contentIdeas.id, ideaId),
        eq(schema.contentIdeas.consultantId, consultantId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Content idea not found"
      });
    }
    
    res.json({
      success: true,
      message: "Content idea deleted"
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error deleting content idea:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete content idea"
    });
  }
});

// ============================================================
// CONTENT IDEA TEMPLATES
// ============================================================

// GET /api/content/idea-templates - Get all templates for consultant
router.get("/idea-templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const templates = await db.select()
      .from(schema.contentIdeaTemplates)
      .where(eq(schema.contentIdeaTemplates.consultantId, consultantId))
      .orderBy(desc(schema.contentIdeaTemplates.createdAt));
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching idea templates:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch idea templates"
    });
  }
});

// POST /api/content/idea-templates - Create new template (or update if name exists)
router.post("/idea-templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const body = req.body;
    
    // Check if template with same name exists for this consultant
    const [existingTemplate] = await db.select()
      .from(schema.contentIdeaTemplates)
      .where(and(
        eq(schema.contentIdeaTemplates.consultantId, consultantId),
        eq(schema.contentIdeaTemplates.name, body.name)
      ))
      .limit(1);
    
    if (existingTemplate) {
      // Update existing template
      const [updated] = await db.update(schema.contentIdeaTemplates)
        .set({
          topic: body.topic,
          targetAudience: body.targetAudience,
          objective: body.objective,
          contentTypes: body.contentTypes,
          additionalContext: body.additionalContext,
          awarenessLevel: body.awarenessLevel,
          sophisticationLevel: body.sophisticationLevel,
          mediaType: body.mediaType,
          copyType: body.copyType,
        })
        .where(eq(schema.contentIdeaTemplates.id, existingTemplate.id))
        .returning();
      
      return res.json({
        success: true,
        data: updated,
        message: "Template aggiornato",
        id: existingTemplate.id
      });
    }
    
    // Create new template
    const [template] = await db.insert(schema.contentIdeaTemplates)
      .values({
        consultantId,
        name: body.name,
        topic: body.topic,
        targetAudience: body.targetAudience,
        objective: body.objective,
        contentTypes: body.contentTypes,
        additionalContext: body.additionalContext,
        awarenessLevel: body.awarenessLevel,
        sophisticationLevel: body.sophisticationLevel,
        mediaType: body.mediaType,
        copyType: body.copyType,
      })
      .returning();
    
    res.status(201).json({
      success: true,
      data: template,
      message: "Template saved"
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error creating idea template:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create idea template"
    });
  }
});

// DELETE /api/content/idea-templates/:id - Delete template
router.delete("/idea-templates/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const templateId = req.params.id;
    
    const [deleted] = await db.delete(schema.contentIdeaTemplates)
      .where(and(
        eq(schema.contentIdeaTemplates.id, templateId),
        eq(schema.contentIdeaTemplates.consultantId, consultantId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Template not found"
      });
    }
    
    res.json({
      success: true,
      message: "Template deleted"
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error deleting idea template:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete idea template"
    });
  }
});

// ============================================================
// CONTENT POSTS
// ============================================================

// GET /api/content/posts - List all posts for consultant
router.get("/posts", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = req.query.status as string | undefined;
    const platform = req.query.platform as string | undefined;
    const contentType = req.query.contentType as string | undefined;
    const folderId = req.query.folderId as string | undefined;
    
    const posts = await db.select({
      post: schema.contentPosts,
      folder: schema.contentFolders
    })
      .from(schema.contentPosts)
      .leftJoin(schema.contentFolders, eq(schema.contentPosts.folderId, schema.contentFolders.id))
      .where(eq(schema.contentPosts.consultantId, consultantId))
      .orderBy(desc(schema.contentPosts.createdAt));
    
    let filtered = posts.map(row => ({
      ...row.post,
      folder: row.folder || null
    }));
    
    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }
    if (platform) {
      filtered = filtered.filter(p => p.platform === platform);
    }
    if (contentType) {
      filtered = filtered.filter(p => p.contentType === contentType);
    }
    if (folderId) {
      if (folderId === "null" || folderId === "root") {
        filtered = filtered.filter(p => p.folderId === null);
      } else {
        filtered = filtered.filter(p => p.folderId === folderId);
      }
    }
    
    res.json({
      success: true,
      data: filtered,
      count: filtered.length
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching content posts:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch content posts"
    });
  }
});

// POST /api/content/posts - Create new post
router.post("/posts", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    // Debug log to trace what fields arrive
    console.log("📝 [CONTENT-STUDIO] POST /posts - Incoming long copy fields:", {
      chiCosaCome: req.body.chiCosaCome?.substring(0, 50) || "(empty)",
      errore: req.body.errore?.substring(0, 50) || "(empty)",
      soluzione: req.body.soluzione?.substring(0, 50) || "(empty)",
      riprovaSociale: req.body.riprovaSociale?.substring(0, 50) || "(empty)",
    });
    
    const validatedData = insertContentPostSchema.parse({
      ...req.body,
      consultantId
    });
    
    console.log("📝 [CONTENT-STUDIO] POST /posts - After validation long copy fields:", {
      chiCosaCome: (validatedData as any).chiCosaCome?.substring(0, 50) || "(empty)",
      errore: (validatedData as any).errore?.substring(0, 50) || "(empty)",
      soluzione: (validatedData as any).soluzione?.substring(0, 50) || "(empty)",
      riprovaSociale: (validatedData as any).riprovaSociale?.substring(0, 50) || "(empty)",
    });
    
    const [post] = await db.insert(schema.contentPosts)
      .values(validatedData)
      .returning();
    
    res.status(201).json({
      success: true,
      data: post,
      message: "Content post created"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error creating content post:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create content post"
    });
  }
});

// PUT /api/content/posts/:id - Update post
router.put("/posts/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const postId = req.params.id;
    
    // Verify ownership
    const [existing] = await db.select()
      .from(schema.contentPosts)
      .where(and(
        eq(schema.contentPosts.id, postId),
        eq(schema.contentPosts.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Content post not found"
      });
    }
    
    const validatedData = insertContentPostSchema.partial().parse(req.body);
    
    const [updated] = await db.update(schema.contentPosts)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(schema.contentPosts.id, postId))
      .returning();
    
    res.json({
      success: true,
      data: updated,
      message: "Content post updated"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error updating content post:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update content post"
    });
  }
});

// DELETE /api/content/posts/:id - Delete post
router.delete("/posts/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const postId = req.params.id;
    
    const [deleted] = await db.delete(schema.contentPosts)
      .where(and(
        eq(schema.contentPosts.id, postId),
        eq(schema.contentPosts.consultantId, consultantId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Content post not found"
      });
    }
    
    res.json({
      success: true,
      message: "Content post deleted"
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error deleting content post:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete content post"
    });
  }
});

// PATCH /api/content/posts/:id/folder - Move post to a different folder
router.patch("/posts/:id/folder", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const postId = req.params.id;
    const { folderId } = req.body;
    
    const [existing] = await db.select()
      .from(schema.contentPosts)
      .where(and(
        eq(schema.contentPosts.id, postId),
        eq(schema.contentPosts.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Content post not found"
      });
    }
    
    if (folderId !== null) {
      const [folder] = await db.select()
        .from(schema.contentFolders)
        .where(and(
          eq(schema.contentFolders.id, folderId),
          eq(schema.contentFolders.consultantId, consultantId)
        ))
        .limit(1);
      
      if (!folder) {
        return res.status(404).json({
          success: false,
          error: "Folder not found"
        });
      }
    }
    
    const [updated] = await db.update(schema.contentPosts)
      .set({ folderId: folderId || null, updatedAt: new Date() })
      .where(eq(schema.contentPosts.id, postId))
      .returning();
    
    res.json({
      success: true,
      data: updated,
      message: "Post moved to folder"
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error moving post to folder:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to move post to folder"
    });
  }
});

// ============================================================
// AD CAMPAIGNS
// ============================================================

// GET /api/content/campaigns - List all campaigns for consultant
router.get("/campaigns", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = req.query.status as string | undefined;
    const objective = req.query.objective as string | undefined;
    
    const campaigns = await db.select()
      .from(schema.adCampaigns)
      .where(eq(schema.adCampaigns.consultantId, consultantId))
      .orderBy(desc(schema.adCampaigns.createdAt));
    
    let filtered = campaigns;
    if (status) {
      filtered = filtered.filter(c => c.status === status);
    }
    if (objective) {
      filtered = filtered.filter(c => c.objective === objective);
    }
    
    res.json({
      success: true,
      data: filtered,
      count: filtered.length
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching ad campaigns:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch ad campaigns"
    });
  }
});

// GET /api/content/campaigns/:id - Get single campaign
router.get("/campaigns/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const campaignId = req.params.id;
    
    const [campaign] = await db.select()
      .from(schema.adCampaigns)
      .where(and(
        eq(schema.adCampaigns.id, campaignId),
        eq(schema.adCampaigns.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: "Ad campaign not found"
      });
    }
    
    res.json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching ad campaign:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch ad campaign"
    });
  }
});

// POST /api/content/campaigns - Create new campaign
router.post("/campaigns", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const validatedData = insertAdCampaignSchema.parse({
      ...req.body,
      consultantId
    });
    
    const [campaign] = await db.insert(schema.adCampaigns)
      .values(validatedData)
      .returning();
    
    res.status(201).json({
      success: true,
      data: campaign,
      message: "Ad campaign created"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error creating ad campaign:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create ad campaign"
    });
  }
});

// PUT /api/content/campaigns/:id - Update campaign
router.put("/campaigns/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const campaignId = req.params.id;
    
    // Verify ownership
    const [existing] = await db.select()
      .from(schema.adCampaigns)
      .where(and(
        eq(schema.adCampaigns.id, campaignId),
        eq(schema.adCampaigns.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Ad campaign not found"
      });
    }
    
    const validatedData = insertAdCampaignSchema.partial().parse(req.body);
    
    const [updated] = await db.update(schema.adCampaigns)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(schema.adCampaigns.id, campaignId))
      .returning();
    
    res.json({
      success: true,
      data: updated,
      message: "Ad campaign updated"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error updating ad campaign:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update ad campaign"
    });
  }
});

// DELETE /api/content/campaigns/:id - Delete campaign
router.delete("/campaigns/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const campaignId = req.params.id;
    
    const [deleted] = await db.delete(schema.adCampaigns)
      .where(and(
        eq(schema.adCampaigns.id, campaignId),
        eq(schema.adCampaigns.consultantId, consultantId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Ad campaign not found"
      });
    }
    
    res.json({
      success: true,
      message: "Ad campaign deleted"
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error deleting ad campaign:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete ad campaign"
    });
  }
});

// ============================================================
// CONTENT CALENDAR
// ============================================================

// GET /api/content/calendar - List calendar items with date range filter
router.get("/calendar", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const status = req.query.status as string | undefined;
    const platform = req.query.platform as string | undefined;
    
    let conditions = [eq(schema.contentCalendar.consultantId, consultantId)];
    
    if (startDate) {
      conditions.push(gte(schema.contentCalendar.scheduledDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.contentCalendar.scheduledDate, endDate));
    }
    
    const items = await db.select()
      .from(schema.contentCalendar)
      .where(and(...conditions))
      .orderBy(schema.contentCalendar.scheduledDate);
    
    let filtered = items;
    if (status) {
      filtered = filtered.filter(i => i.status === status);
    }
    if (platform) {
      filtered = filtered.filter(i => i.platform === platform);
    }
    
    // Transform items to include computed 'type' field for frontend compatibility
    const transformedItems = filtered.map(item => ({
      ...item,
      type: item.campaignId ? "campaign" : "post" as "post" | "campaign",
    }));
    
    res.json({
      success: true,
      data: transformedItems,
      count: transformedItems.length
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching calendar items:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch calendar items"
    });
  }
});

// Custom schema for calendar item creation that accepts 'type' field from frontend
const createCalendarItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  scheduledTime: z.string().optional().default("09:00"),
  type: z.enum(["post", "campaign"]).optional(),
  platform: z.string().optional(),
  contentType: z.string().optional(),
  status: z.enum(["scheduled", "published", "missed", "cancelled"]).optional(),
  postId: z.string().optional(),
  campaignId: z.string().optional(),
});

// POST /api/content/calendar - Create calendar item
router.post("/calendar", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const validatedData = createCalendarItemSchema.parse(req.body);
    
    // Extract type and remove it from data to insert (since DB doesn't have type column)
    const { type, ...restData } = validatedData;
    
    const [item] = await db.insert(schema.contentCalendar)
      .values({
        ...restData,
        consultantId,
      })
      .returning();
    
    // Return with computed type field for frontend compatibility
    res.status(201).json({
      success: true,
      data: {
        ...item,
        type: item.campaignId ? "campaign" : "post" as "post" | "campaign",
      },
      message: "Calendar item created"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error creating calendar item:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create calendar item"
    });
  }
});

// PUT /api/content/calendar/:id - Update calendar item
router.put("/calendar/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const itemId = req.params.id;
    
    // Verify ownership
    const [existing] = await db.select()
      .from(schema.contentCalendar)
      .where(and(
        eq(schema.contentCalendar.id, itemId),
        eq(schema.contentCalendar.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Calendar item not found"
      });
    }
    
    // Use custom schema that handles 'type' field from frontend
    const validatedData = createCalendarItemSchema.partial().parse(req.body);
    
    // Extract type and remove it from data to update (since DB doesn't have type column)
    const { type, ...restData } = validatedData;
    
    const [updated] = await db.update(schema.contentCalendar)
      .set(restData)
      .where(eq(schema.contentCalendar.id, itemId))
      .returning();
    
    // Return with computed type field for frontend compatibility
    res.json({
      success: true,
      data: {
        ...updated,
        type: updated.campaignId ? "campaign" : "post" as "post" | "campaign",
      },
      message: "Calendar item updated"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error updating calendar item:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update calendar item"
    });
  }
});

// DELETE /api/content/calendar/:id - Delete calendar item
router.delete("/calendar/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const itemId = req.params.id;
    
    const [deleted] = await db.delete(schema.contentCalendar)
      .where(and(
        eq(schema.contentCalendar.id, itemId),
        eq(schema.contentCalendar.consultantId, consultantId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Calendar item not found"
      });
    }
    
    res.json({
      success: true,
      message: "Calendar item deleted"
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error deleting calendar item:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete calendar item"
    });
  }
});

// ============================================================
// GENERATED IMAGES
// ============================================================

// GET /api/content/images - List generated images for consultant
router.get("/images", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = req.query.status as string | undefined;
    const style = req.query.style as string | undefined;
    
    const images = await db.select()
      .from(schema.generatedImages)
      .where(eq(schema.generatedImages.consultantId, consultantId))
      .orderBy(desc(schema.generatedImages.createdAt));
    
    let filtered = images;
    if (status) {
      filtered = filtered.filter(i => i.status === status);
    }
    if (style) {
      filtered = filtered.filter(i => i.style === style);
    }
    
    res.json({
      success: true,
      data: filtered,
      count: filtered.length
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching generated images:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch generated images"
    });
  }
});

// POST /api/content/images - Create image record
router.post("/images", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const validatedData = insertGeneratedImageSchema.parse({
      ...req.body,
      consultantId
    });
    
    const [image] = await db.insert(schema.generatedImages)
      .values(validatedData)
      .returning();
    
    res.status(201).json({
      success: true,
      data: image,
      message: "Image record created"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error creating image record:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create image record"
    });
  }
});

// DELETE /api/content/images/:id - Delete image
router.delete("/images/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const imageId = req.params.id;
    
    const [deleted] = await db.delete(schema.generatedImages)
      .where(and(
        eq(schema.generatedImages.id, imageId),
        eq(schema.generatedImages.consultantId, consultantId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Image not found"
      });
    }
    
    res.json({
      success: true,
      message: "Image deleted"
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error deleting image:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete image"
    });
  }
});

// ============================================================
// CONTENT TEMPLATES
// ============================================================

// GET /api/content/templates - List templates
router.get("/templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const category = req.query.category as string | undefined;
    
    const templates = await db.select()
      .from(schema.contentTemplates)
      .where(eq(schema.contentTemplates.consultantId, consultantId))
      .orderBy(desc(schema.contentTemplates.createdAt));
    
    let filtered = templates;
    if (category) {
      filtered = filtered.filter(t => t.category === category);
    }
    
    res.json({
      success: true,
      data: filtered,
      count: filtered.length
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching content templates:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch content templates"
    });
  }
});

// POST /api/content/templates - Create template
router.post("/templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const validatedData = insertContentTemplateSchema.parse({
      ...req.body,
      consultantId
    });
    
    const [template] = await db.insert(schema.contentTemplates)
      .values(validatedData)
      .returning();
    
    res.status(201).json({
      success: true,
      data: template,
      message: "Content template created"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error creating content template:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create content template"
    });
  }
});

// PUT /api/content/templates/:id - Update template
router.put("/templates/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const templateId = req.params.id;
    
    // Verify ownership
    const [existing] = await db.select()
      .from(schema.contentTemplates)
      .where(and(
        eq(schema.contentTemplates.id, templateId),
        eq(schema.contentTemplates.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Content template not found"
      });
    }
    
    const validatedData = insertContentTemplateSchema.partial().parse(req.body);
    
    const [updated] = await db.update(schema.contentTemplates)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(schema.contentTemplates.id, templateId))
      .returning();
    
    res.json({
      success: true,
      data: updated,
      message: "Content template updated"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error updating content template:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update content template"
    });
  }
});

// DELETE /api/content/templates/:id - Delete template
router.delete("/templates/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const templateId = req.params.id;
    
    const [deleted] = await db.delete(schema.contentTemplates)
      .where(and(
        eq(schema.contentTemplates.id, templateId),
        eq(schema.contentTemplates.consultantId, consultantId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Content template not found"
      });
    }
    
    res.json({
      success: true,
      message: "Content template deleted"
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error deleting content template:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete content template"
    });
  }
});

// ============================================================
// AI GENERATION ENDPOINTS
// ============================================================

import {
  generateContentIdeas,
  generatePostCopy,
  generatePostCopyVariations,
  generateCampaignContent,
  generateImagePrompt,
  type ContentType,
  type ContentObjective,
  type Platform,
  type ImageStyle,
} from "../services/content-ai-service";

const generateIdeasSchema = z.object({
  niche: z.string().min(1, "Niche is required"),
  targetAudience: z.string().min(1, "Target audience is required"),
  objective: z.enum(["awareness", "engagement", "leads", "sales", "education", "authority"]),
  additionalContext: z.string().optional(),
  count: z.number().min(1).max(5).optional(),
  mediaType: z.enum(["video", "photo"]).default("photo"),
  copyType: z.enum(["short", "long"]).default("short"),
  awarenessLevel: z.enum(["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"]).default("problem_aware"),
  sophisticationLevel: z.enum(["level_1", "level_2", "level_3", "level_4", "level_5"]).optional(),
  brandVoiceData: z.object({
    consultantDisplayName: z.string().optional(),
    businessName: z.string().optional(),
    businessDescription: z.string().optional(),
    consultantBio: z.string().optional(),
    vision: z.string().optional(),
    mission: z.string().optional(),
    values: z.array(z.string()).optional(),
    usp: z.string().optional(),
    whoWeHelp: z.string().optional(),
    whatWeDo: z.string().optional(),
    howWeDoIt: z.string().optional(),
    yearsExperience: z.number().optional(),
    clientsHelped: z.number().optional(),
    resultsGenerated: z.string().optional(),
    caseStudies: z.array(z.object({ client: z.string(), result: z.string() })).optional(),
    servicesOffered: z.array(z.object({ name: z.string(), price: z.string(), description: z.string() })).optional(),
    guarantees: z.string().optional(),
  }).optional(),
  kbDocumentIds: z.array(z.string()).optional(),
  kbContent: z.string().optional(),
});

const generateCopySchema = z.object({
  idea: z.string().min(1, "Idea is required"),
  platform: z.enum(["instagram", "facebook", "linkedin", "tiktok", "youtube", "twitter"]),
  brandVoice: z.string().optional(),
  brandVoiceData: z.object({
    consultantDisplayName: z.string().optional(),
    businessName: z.string().optional(),
    businessDescription: z.string().optional(),
    consultantBio: z.string().optional(),
    vision: z.string().optional(),
    mission: z.string().optional(),
    values: z.array(z.string()).optional(),
    usp: z.string().optional(),
    whoWeHelp: z.string().optional(),
    whatWeDo: z.string().optional(),
    howWeDoIt: z.string().optional(),
    yearsExperience: z.number().optional(),
    clientsHelped: z.number().optional(),
    resultsGenerated: z.string().optional(),
    caseStudies: z.array(z.object({ client: z.string(), result: z.string() })).optional(),
    servicesOffered: z.array(z.object({ name: z.string(), price: z.string(), description: z.string() })).optional(),
    guarantees: z.string().optional(),
  }).optional(),
  keywords: z.array(z.string()).optional(),
  tone: z.string().optional(),
  maxLength: z.number().optional(),
  outputType: z.enum(["copy_short", "copy_long", "video_script", "image_copy"]).optional(),
});

const generateCampaignSchema = z.object({
  productOrService: z.string().min(1, "Product or service is required"),
  targetAudience: z.string().min(1, "Target audience is required"),
  objective: z.enum(["awareness", "engagement", "leads", "sales", "education"]),
  budget: z.string().optional(),
  duration: z.string().optional(),
  uniqueSellingPoints: z.array(z.string()).optional(),
  brandVoice: z.string().optional(),
  brandVoiceData: z.object({
    consultantDisplayName: z.string().optional(),
    businessName: z.string().optional(),
    businessDescription: z.string().optional(),
    consultantBio: z.string().optional(),
    vision: z.string().optional(),
    mission: z.string().optional(),
    values: z.array(z.string()).optional(),
    usp: z.string().optional(),
    whoWeHelp: z.string().optional(),
    whatWeDo: z.string().optional(),
    howWeDoIt: z.string().optional(),
    yearsExperience: z.number().optional(),
    clientsHelped: z.number().optional(),
    resultsGenerated: z.string().optional(),
    caseStudies: z.array(z.object({ client: z.string(), result: z.string() })).optional(),
    servicesOffered: z.array(z.object({ name: z.string(), price: z.string(), description: z.string() })).optional(),
    guarantees: z.string().optional(),
  }).optional(),
});

const generateImagePromptSchema = z.object({
  contentDescription: z.string().min(1, "Content description is required"),
  brandColors: z.array(z.string()).optional(),
  style: z.enum(["realistic", "illustration", "minimal", "bold", "professional", "playful"]),
  platform: z.enum(["instagram", "facebook", "linkedin", "tiktok", "youtube", "twitter"]),
  aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]).optional(),
  mood: z.string().optional(),
  includeText: z.boolean().optional(),
  textToInclude: z.string().optional(),
});

router.post("/ai/generate-ideas", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const validatedData = generateIdeasSchema.parse(req.body);
    
    console.log(`🤖 [CONTENT-AI] Generating ideas for consultant ${consultantId} (mediaType: ${validatedData.mediaType}, copyType: ${validatedData.copyType})`);
    
    // Combina contenuto da file temporanei (kbContent diretto) e documenti KB
    let kbContentParts: string[] = [];
    
    // 1. Contenuto passato direttamente (file temporanei estratti client-side)
    if (validatedData.kbContent && validatedData.kbContent.trim().length > 0) {
      kbContentParts.push(validatedData.kbContent);
      console.log(`📄 [CONTENT-AI] Using direct kbContent (${validatedData.kbContent.length} chars)`);
    }
    
    // 2. Documenti dalla Knowledge Base permanente
    if (validatedData.kbDocumentIds && validatedData.kbDocumentIds.length > 0) {
      const kbDocs = await db
        .select({ 
          title: schema.consultantKnowledgeDocuments.title,
          extractedContent: schema.consultantKnowledgeDocuments.extractedContent 
        })
        .from(schema.consultantKnowledgeDocuments)
        .where(
          and(
            eq(schema.consultantKnowledgeDocuments.consultantId, consultantId),
            inArray(schema.consultantKnowledgeDocuments.id, validatedData.kbDocumentIds)
          )
        );
      
      const kbDocsContent = kbDocs
        .filter(d => d.extractedContent)
        .map(d => `## ${d.title}\n\n${d.extractedContent}`)
        .join("\n\n---\n\n");
      
      if (kbDocsContent.length > 0) {
        kbContentParts.push(kbDocsContent);
        console.log(`📚 [CONTENT-AI] Loaded ${kbDocs.length} KB documents (${kbDocsContent.length} chars) for idea generation`);
      }
    }
    
    const kbContent = kbContentParts.join("\n\n---\n\n");
    
    const result = await generateContentIdeas({
      consultantId,
      niche: validatedData.niche,
      targetAudience: validatedData.targetAudience,
      objective: validatedData.objective,
      additionalContext: validatedData.additionalContext,
      count: validatedData.count,
      mediaType: validatedData.mediaType,
      copyType: validatedData.copyType,
      awarenessLevel: validatedData.awarenessLevel,
      sophisticationLevel: validatedData.sophisticationLevel,
      brandVoiceData: validatedData.brandVoiceData,
      kbContent: kbContent,
    });
    
    console.log(`✅ [CONTENT-AI] Generated ${result.ideas.length} ideas using ${result.modelUsed}`);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors,
      });
    }
    console.error("❌ [CONTENT-AI] Error generating ideas:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate content ideas",
    });
  }
});

router.post("/ai/generate-copy", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const validatedData = generateCopySchema.parse(req.body);
    
    console.log(`🤖 [CONTENT-AI] Generating copy for consultant ${consultantId}`);
    
    const result = await generatePostCopy({
      consultantId,
      idea: validatedData.idea,
      platform: validatedData.platform as Platform,
      brandVoice: validatedData.brandVoice,
      brandVoiceData: validatedData.brandVoiceData,
      keywords: validatedData.keywords,
      tone: validatedData.tone,
      maxLength: validatedData.maxLength,
    });
    
    console.log(`✅ [CONTENT-AI] Generated copy using ${result.modelUsed}`);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors,
      });
    }
    console.error("❌ [CONTENT-AI] Error generating copy:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate post copy",
    });
  }
});

router.post("/ai/generate-copy-variations", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const validatedData = generateCopySchema.parse(req.body);
    
    const outputType = validatedData.outputType || "copy_long";
    console.log(`🤖 [CONTENT-AI] Generating 3 copy variations (${outputType}) for consultant ${consultantId}`);
    
    const result = await generatePostCopyVariations({
      consultantId,
      idea: validatedData.idea,
      platform: validatedData.platform as Platform,
      brandVoice: validatedData.brandVoice,
      brandVoiceData: validatedData.brandVoiceData,
      keywords: validatedData.keywords,
      tone: validatedData.tone,
      maxLength: validatedData.maxLength,
      outputType,
    });
    
    console.log(`✅ [CONTENT-AI] Generated ${result.variations.length} ${outputType} variations using ${result.modelUsed}`);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors,
      });
    }
    console.error("❌ [CONTENT-AI] Error generating copy variations:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate post copy variations",
    });
  }
});

router.post("/ai/generate-campaign", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const validatedData = generateCampaignSchema.parse(req.body);
    
    console.log(`🤖 [CONTENT-AI] Generating campaign for consultant ${consultantId}`);
    
    const result = await generateCampaignContent({
      consultantId,
      productOrService: validatedData.productOrService,
      targetAudience: validatedData.targetAudience,
      objective: validatedData.objective as ContentObjective,
      budget: validatedData.budget,
      duration: validatedData.duration,
      uniqueSellingPoints: validatedData.uniqueSellingPoints,
      brandVoice: validatedData.brandVoice,
      brandVoiceData: validatedData.brandVoiceData,
    });
    
    console.log(`✅ [CONTENT-AI] Generated campaign using ${result.modelUsed}`);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors,
      });
    }
    console.error("❌ [CONTENT-AI] Error generating campaign:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate campaign content",
    });
  }
});

router.post("/ai/generate-image-prompt", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const validatedData = generateImagePromptSchema.parse(req.body);
    
    console.log(`🤖 [CONTENT-AI] Generating image prompt for consultant ${consultantId}`);
    
    const result = await generateImagePrompt({
      consultantId,
      contentDescription: validatedData.contentDescription,
      brandColors: validatedData.brandColors,
      style: validatedData.style as ImageStyle,
      platform: validatedData.platform as Platform,
      aspectRatio: validatedData.aspectRatio,
      mood: validatedData.mood,
      includeText: validatedData.includeText,
      textToInclude: validatedData.textToInclude,
    });
    
    console.log(`✅ [CONTENT-AI] Generated image prompt using ${result.modelUsed}`);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors,
      });
    }
    console.error("❌ [CONTENT-AI] Error generating image prompt:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate image prompt",
    });
  }
});

// ============================================================
// AI SUGGEST LEVELS ENDPOINT
// ============================================================

router.post("/ai/suggest-levels", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { topic, targetAudience, objective, mediaType, copyType, additionalContext, brandVoiceData } = req.body;
    
    if (!topic && !targetAudience && !brandVoiceData) {
      return res.status(400).json({ error: "Fornisci almeno topic, target audience o brand voice" });
    }
    
    const { client, metadata } = await getAIProvider(consultantId, "content-suggest-levels");
    const { model } = getModelWithThinking(metadata?.name);
    
    // Build brand voice context if available
    let brandVoiceContext = "";
    if (brandVoiceData) {
      const parts = [];
      if (brandVoiceData.nameDisplayConsultant) parts.push(`Consulente: ${brandVoiceData.nameDisplayConsultant}`);
      if (brandVoiceData.nameBusiness) parts.push(`Business: ${brandVoiceData.nameBusiness}`);
      if (brandVoiceData.descriptionBusiness) parts.push(`Descrizione Business: ${brandVoiceData.descriptionBusiness}`);
      if (brandVoiceData.vision) parts.push(`Vision: ${brandVoiceData.vision}`);
      if (brandVoiceData.mission) parts.push(`Mission: ${brandVoiceData.mission}`);
      if (brandVoiceData.values) parts.push(`Valori: ${brandVoiceData.values}`);
      if (brandVoiceData.usp) parts.push(`USP: ${brandVoiceData.usp}`);
      if (brandVoiceData.whatWeDo) parts.push(`Cosa Facciamo: ${brandVoiceData.whatWeDo}`);
      if (brandVoiceData.whatWeDoNot) parts.push(`Cosa NON Facciamo: ${brandVoiceData.whatWeDoNot}`);
      if (brandVoiceData.howWeDoIt) parts.push(`Come lo Facciamo: ${brandVoiceData.howWeDoIt}`);
      if (parts.length > 0) {
        brandVoiceContext = `\n\n=== BRAND VOICE & IDENTITÀ ===\n${parts.join("\n")}`;
      }
    }
    
    const prompt = `Sei un esperto di marketing strategico. Analizza attentamente i dati forniti e suggerisci i livelli OTTIMALI per questa specifica campagna.

=== DATI DA ANALIZZARE ===
Topic/Nicchia: "${topic || "Non specificato"}"
Target Audience: "${targetAudience || "Non specificato"}"  
Obiettivo: "${objective || "Non specificato"}"
Tipo Media: "${mediaType || "Non specificato"}"
Tipo Copy: "${copyType || "Non specificato"}"
Contesto Aggiuntivo: "${additionalContext || "Non specificato"}"${brandVoiceContext}

=== LIVELLI DI CONSAPEVOLEZZA (Piramide Eugene Schwartz) ===
- unaware: Il pubblico NON sa di avere un problema. Serve educazione.
- problem_aware: Sentono disagio/frustrazione ma non conoscono soluzioni concrete.
- solution_aware: Sanno che esistono soluzioni ma non conoscono la TUA.
- product_aware: Conoscono il tuo prodotto/servizio ma non sono ancora convinti.
- most_aware: Sono pronti all'acquisto, aspettano solo l'offerta giusta.

=== LIVELLI DI SOFISTICAZIONE DEL MERCATO ===
- level_1: Mercato VERGINE - sei il primo, basta un claim semplice e diretto.
- level_2: Concorrenza INIZIALE - devi amplificare la promessa con prove concrete.
- level_3: Mercato SATURO - serve un meccanismo unico che ti differenzi.
- level_4: Concorrenza AGGUERRITA - meccanismo migliorato e ultra-specializzato.
- level_5: Mercato SCETTICO - focus su identità, valori e connessione emotiva.

=== ISTRUZIONI ===
1. Analizza il topic e il target audience forniti
2. Ragiona su quale livello di consapevolezza ha probabilmente questo pubblico
3. Valuta quanto è saturo/competitivo questo mercato
4. Fornisci spiegazioni SPECIFICHE e PERSONALIZZATE basate sui dati forniti

Rispondi ESCLUSIVAMENTE con questo JSON (nessun testo prima o dopo):
{"awarenessLevel": "<scegli tra: unaware, problem_aware, solution_aware, product_aware, most_aware>", "awarenessReason": "<spiega in 1-2 frasi PERCHÉ questo livello è adatto AL TARGET SPECIFICO fornito>", "sophisticationLevel": "<scegli tra: level_1, level_2, level_3, level_4, level_5>", "sophisticationReason": "<spiega in 1-2 frasi PERCHÉ questo livello è adatto AL MERCATO SPECIFICO di questo topic>"}`;

    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    });
    
    const responseText = result.response.text();
    console.log("[SUGGEST-LEVELS] Model:", model);
    console.log("[SUGGEST-LEVELS] Response length:", responseText.length, "chars");
    console.log("[SUGGEST-LEVELS] AI Response (full):", JSON.stringify(responseText));
    
    // Remove markdown code blocks if present
    let cleanedResponse = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    // Try to find and parse JSON
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[SUGGEST-LEVELS] No JSON found in response after cleaning");
      console.error("[SUGGEST-LEVELS] Cleaned response was:", cleanedResponse);
      return res.json({ 
        awarenessLevel: "problem_aware",
        sophisticationLevel: "level_3",
        awarenessReason: "L'AI non ha fornito una risposta strutturata",
        sophisticationReason: "L'AI non ha fornito una risposta strutturata"
      });
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log("[SUGGEST-LEVELS] Parsed result:", parsed);
      
      // Validate required fields
      if (!parsed.awarenessReason || !parsed.sophisticationReason) {
        console.warn("[SUGGEST-LEVELS] Missing reason fields, using defaults");
        parsed.awarenessReason = parsed.awarenessReason || "Analisi basata sul target specificato";
        parsed.sophisticationReason = parsed.sophisticationReason || "Analisi basata sul mercato di riferimento";
      }
      
      return res.json(parsed);
    } catch (parseError) {
      console.error("[SUGGEST-LEVELS] JSON parse error:", parseError);
      console.error("[SUGGEST-LEVELS] Attempted to parse:", jsonMatch[0]);
      return res.json({ 
        awarenessLevel: "problem_aware",
        sophisticationLevel: "level_3",
        awarenessReason: "Errore nel parsing della risposta AI",
        sophisticationReason: "Errore nel parsing della risposta AI"
      });
    }
  } catch (error) {
    console.error("Error suggesting levels:", error);
    return res.json({
      awarenessLevel: "problem_aware",
      sophisticationLevel: "level_3",
      awarenessReason: "Errore nell'analisi AI",
      sophisticationReason: "Errore nell'analisi AI"
    });
  }
});

// Suggest niche and target audience based on Brand Voice
router.post("/ai/suggest-niche-target", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { brandVoiceData } = req.body;
    
    if (!brandVoiceData || Object.keys(brandVoiceData).length === 0) {
      return res.status(400).json({ success: false, error: "Brand Voice data richiesto" });
    }
    
    const { client, metadata } = await getAIProvider(consultantId, "content-suggest-niche");
    const { model } = getModelWithThinking(metadata?.name);
    
    // Build brand voice context
    const parts = [];
    if (brandVoiceData.consultantDisplayName) parts.push(`Consulente: ${brandVoiceData.consultantDisplayName}`);
    if (brandVoiceData.businessName) parts.push(`Business: ${brandVoiceData.businessName}`);
    if (brandVoiceData.businessDescription) parts.push(`Descrizione Business: ${brandVoiceData.businessDescription}`);
    if (brandVoiceData.consultantBio) parts.push(`Bio Consulente: ${brandVoiceData.consultantBio}`);
    if (brandVoiceData.vision) parts.push(`Vision: ${brandVoiceData.vision}`);
    if (brandVoiceData.mission) parts.push(`Mission: ${brandVoiceData.mission}`);
    if (brandVoiceData.values?.length) parts.push(`Valori: ${brandVoiceData.values.join(", ")}`);
    if (brandVoiceData.usp) parts.push(`USP: ${brandVoiceData.usp}`);
    if (brandVoiceData.whoWeHelp) parts.push(`Chi Aiutiamo: ${brandVoiceData.whoWeHelp}`);
    if (brandVoiceData.whatWeDo) parts.push(`Cosa Facciamo: ${brandVoiceData.whatWeDo}`);
    if (brandVoiceData.howWeDoIt) parts.push(`Come lo Facciamo: ${brandVoiceData.howWeDoIt}`);
    if (brandVoiceData.servicesOffered?.length) {
      const services = brandVoiceData.servicesOffered.map((s: any) => s.name).join(", ");
      parts.push(`Servizi Offerti: ${services}`);
    }
    
    const brandVoiceContext = parts.join("\n");
    
    const prompt = `Sei un esperto di marketing e posizionamento. Analizza i dati del Brand Voice forniti e suggerisci la nicchia di mercato ottimale e il pubblico target ideale.

=== BRAND VOICE & IDENTITÀ ===
${brandVoiceContext}

=== ISTRUZIONI ===
1. Analizza attentamente l'identità, i servizi e il posizionamento del brand
2. Identifica la nicchia di mercato più specifica e profittevole
3. Definisci il pubblico target ideale con caratteristiche demografiche e psicografiche
4. Sii SPECIFICO e CONCRETO, evita risposte generiche

Rispondi ESCLUSIVAMENTE con questo JSON (nessun testo prima o dopo):
{"niche": "<nicchia specifica in 3-8 parole, es: 'Finanza personale per professionisti under 40'>", "targetAudience": "<descrizione target in 5-15 parole, es: 'Professionisti 30-45 anni con reddito medio-alto che vogliono investire'>"}`;

    const result = await client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });
    
    const responseText = result.response.text();
    console.log("[SUGGEST-NICHE-TARGET] Model:", model);
    console.log("[SUGGEST-NICHE-TARGET] Response:", responseText);
    
    // Remove markdown code blocks if present
    let cleanedResponse = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    // Try to find and parse JSON - handle potentially truncated responses
    let jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    let parsed: { niche?: string; targetAudience?: string } = {};
    
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseErr) {
        console.log("[SUGGEST-NICHE-TARGET] JSON parse failed, trying to extract fields manually");
      }
    }
    
    // If parsing failed or incomplete, try to extract fields manually
    if (!parsed.niche || !parsed.targetAudience) {
      const nicheMatch = cleanedResponse.match(/"niche"\s*:\s*"([^"]+)"/);
      const targetMatch = cleanedResponse.match(/"targetAudience"\s*:\s*"([^"]+)"/);
      
      if (nicheMatch) parsed.niche = nicheMatch[1];
      if (targetMatch) parsed.targetAudience = targetMatch[1];
    }
    
    // If we still don't have both fields, return error
    if (!parsed.niche && !parsed.targetAudience) {
      console.error("[SUGGEST-NICHE-TARGET] Could not extract any fields from response");
      return res.status(500).json({ success: false, error: "AI non ha fornito una risposta valida" });
    }
    
    console.log("[SUGGEST-NICHE-TARGET] Parsed result:", parsed);
    
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("Error suggesting niche/target:", error);
    return res.status(500).json({ success: false, error: error.message || "Errore nella generazione" });
  }
});

// ============================================================
// IMAGE GENERATION (Gemini Imagen 3)
// ============================================================

const generateImageSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  aspectRatio: z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]).optional().default("1:1"),
  style: z.string().optional(),
  negativePrompt: z.string().optional(),
  postId: z.string().optional(),
  campaignId: z.string().optional(),
});

async function getGeminiApiKey(consultantId: string): Promise<string | null> {
  try {
    const [user] = await db.select({
      useSuperadminGemini: schema.users.useSuperadminGemini,
      geminiApiKeys: schema.users.geminiApiKeys,
      geminiApiKeyIndex: schema.users.geminiApiKeyIndex,
    })
    .from(schema.users)
    .where(eq(schema.users.id, consultantId))
    .limit(1);

    if (!user) {
      console.error(`[IMAGEN] User not found: ${consultantId}`);
      return null;
    }

    if (user.useSuperadminGemini !== false) {
      const superAdminKeys = await getSuperAdminGeminiKeys();
      if (superAdminKeys && superAdminKeys.keys.length > 0) {
        const index = Math.floor(Math.random() * superAdminKeys.keys.length);
        console.log(`🔑 [IMAGEN] Using SuperAdmin Gemini key (${index + 1}/${superAdminKeys.keys.length})`);
        return superAdminKeys.keys[index];
      }
    }

    const userApiKeys = (user.geminiApiKeys as string[]) || [];
    if (userApiKeys.length > 0) {
      const currentIndex = user.geminiApiKeyIndex || 0;
      const validIndex = currentIndex % userApiKeys.length;
      console.log(`🔑 [IMAGEN] Using consultant's Gemini key (${validIndex + 1}/${userApiKeys.length})`);
      return userApiKeys[validIndex];
    }

    console.error("[IMAGEN] No Gemini API keys available");
    return null;
  } catch (error) {
    console.error("[IMAGEN] Error fetching API key:", error);
    return null;
  }
}

async function callImagenApi(
  apiKey: string,
  prompt: string,
  aspectRatio: string,
  negativePrompt?: string
): Promise<{ imageData: string; mimeType: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
  
  const requestBody = {
    instances: [
      {
        prompt: prompt,
      }
    ],
    parameters: {
      aspectRatio: aspectRatio,
      ...(negativePrompt && { negativePrompt }),
      sampleCount: 1,
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[IMAGEN] API Error: ${response.status}`, errorText);
    throw new Error(`Imagen API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.predictions || result.predictions.length === 0) {
    throw new Error("No image generated from Imagen API");
  }

  const prediction = result.predictions[0];
  return {
    imageData: prediction.bytesBase64Encoded,
    mimeType: prediction.mimeType || "image/png",
  };
}

router.post("/ai/generate-image", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  const startTime = Date.now();
  try {
    const consultantId = req.user!.id;
    const validatedData = generateImageSchema.parse(req.body);
    
    console.log(`🖼️ [IMAGEN] Generating image for consultant ${consultantId}`);
    console.log(`   Prompt: "${validatedData.prompt.substring(0, 100)}..."`);
    console.log(`   Aspect Ratio: ${validatedData.aspectRatio}`);
    
    const apiKey = await getGeminiApiKey(consultantId);
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "No Gemini API key available. Please configure your API keys.",
      });
    }

    let fullPrompt = validatedData.prompt;
    if (validatedData.style) {
      fullPrompt = `${validatedData.prompt}, ${validatedData.style} style`;
    }

    const { imageData, mimeType } = await callImagenApi(
      apiKey,
      fullPrompt,
      validatedData.aspectRatio,
      validatedData.negativePrompt
    );

    const uploadsDir = path.join(process.cwd(), "uploads", "generated-images");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const extension = mimeType === "image/jpeg" ? "jpg" : "png";
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const filePath = path.join(uploadsDir, filename);
    
    const imageBuffer = Buffer.from(imageData, "base64");
    fs.writeFileSync(filePath, imageBuffer);
    
    const imageUrl = `/uploads/generated-images/${filename}`;
    console.log(`✅ [IMAGEN] Image saved: ${imageUrl}`);

    const [generatedImage] = await db.insert(schema.generatedImages)
      .values({
        consultantId,
        prompt: validatedData.prompt,
        negativePrompt: validatedData.negativePrompt,
        style: validatedData.style,
        aspectRatio: validatedData.aspectRatio,
        imageUrl,
        generationProvider: "imagen-3.0-generate-002",
        generationTimeMs: Date.now() - startTime,
        status: "generated",
        postId: validatedData.postId,
        campaignId: validatedData.campaignId,
      })
      .returning();

    const generationTimeMs = Date.now() - startTime;
    console.log(`✅ [IMAGEN] Generation completed in ${generationTimeMs}ms`);

    res.json({
      success: true,
      data: {
        id: generatedImage.id,
        imageUrl,
        prompt: validatedData.prompt,
        aspectRatio: validatedData.aspectRatio,
        generationTimeMs,
      },
    });
  } catch (error: any) {
    const generationTimeMs = Date.now() - startTime;
    console.error(`❌ [IMAGEN] Error after ${generationTimeMs}ms:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate image",
    });
  }
});

// ============================================================
// CONTENT FOLDERS
// ============================================================

// Helper function to build folder tree structure
function buildFolderTree(folders: schema.ContentFolder[]): (schema.ContentFolder & { children: any[] })[] {
  const folderMap = new Map<string, schema.ContentFolder & { children: any[] }>();
  const rootFolders: (schema.ContentFolder & { children: any[] })[] = [];
  
  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });
  
  folders.forEach(folder => {
    const folderWithChildren = folderMap.get(folder.id)!;
    if (folder.parentId && folderMap.has(folder.parentId)) {
      folderMap.get(folder.parentId)!.children.push(folderWithChildren);
    } else {
      rootFolders.push(folderWithChildren);
    }
  });
  
  const sortByOrder = (a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0);
  const sortTree = (nodes: any[]) => {
    nodes.sort(sortByOrder);
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortTree(node.children);
      }
    });
  };
  sortTree(rootFolders);
  
  return rootFolders;
}

// GET /api/content/folders - List all folders for consultant (hierarchical tree structure)
router.get("/folders", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const flat = req.query.flat === "true";
    
    const folders = await db.select()
      .from(schema.contentFolders)
      .where(eq(schema.contentFolders.consultantId, consultantId))
      .orderBy(asc(schema.contentFolders.sortOrder), asc(schema.contentFolders.createdAt));
    
    if (flat) {
      res.json({
        success: true,
        data: folders,
        count: folders.length
      });
    } else {
      const tree = buildFolderTree(folders);
      res.json({
        success: true,
        data: tree,
        count: folders.length
      });
    }
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching content folders:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch content folders"
    });
  }
});

// POST /api/content/folders - Create a new folder/project
router.post("/folders", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const validatedData = insertContentFolderSchema.parse({
      ...req.body,
      consultantId
    });
    
    if (validatedData.parentId) {
      const [parentFolder] = await db.select()
        .from(schema.contentFolders)
        .where(and(
          eq(schema.contentFolders.id, validatedData.parentId),
          eq(schema.contentFolders.consultantId, consultantId)
        ))
        .limit(1);
      
      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          error: "Parent folder not found"
        });
      }
    }
    
    const [folder] = await db.insert(schema.contentFolders)
      .values(validatedData)
      .returning();
    
    res.status(201).json({
      success: true,
      data: folder,
      message: "Content folder created"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error creating content folder:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create content folder"
    });
  }
});

// PUT /api/content/folders/:id - Update folder name, color, icon, etc.
router.put("/folders/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const folderId = req.params.id;
    
    const [existing] = await db.select()
      .from(schema.contentFolders)
      .where(and(
        eq(schema.contentFolders.id, folderId),
        eq(schema.contentFolders.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Content folder not found"
      });
    }
    
    const validatedData = insertContentFolderSchema.partial().parse(req.body);
    
    const [updated] = await db.update(schema.contentFolders)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(schema.contentFolders.id, folderId))
      .returning();
    
    res.json({
      success: true,
      data: updated,
      message: "Content folder updated"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        details: error.errors
      });
    }
    console.error("❌ [CONTENT-STUDIO] Error updating content folder:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update content folder"
    });
  }
});

// DELETE /api/content/folders/:id - Delete folder (cascade to children)
router.delete("/folders/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const folderId = req.params.id;
    
    const [existing] = await db.select()
      .from(schema.contentFolders)
      .where(and(
        eq(schema.contentFolders.id, folderId),
        eq(schema.contentFolders.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Content folder not found"
      });
    }
    
    const collectDescendantIds = async (parentId: string): Promise<string[]> => {
      const children = await db.select()
        .from(schema.contentFolders)
        .where(and(
          eq(schema.contentFolders.parentId, parentId),
          eq(schema.contentFolders.consultantId, consultantId)
        ));
      
      let ids: string[] = [];
      for (const child of children) {
        ids.push(child.id);
        const descendantIds = await collectDescendantIds(child.id);
        ids = ids.concat(descendantIds);
      }
      return ids;
    };
    
    const descendantIds = await collectDescendantIds(folderId);
    const allFolderIds = [folderId, ...descendantIds];
    
    for (const id of allFolderIds) {
      await db.update(schema.contentPosts)
        .set({ folderId: null, updatedAt: new Date() })
        .where(eq(schema.contentPosts.folderId, id));
    }
    
    for (const id of [...descendantIds].reverse()) {
      await db.delete(schema.contentFolders)
        .where(eq(schema.contentFolders.id, id));
    }
    
    await db.delete(schema.contentFolders)
      .where(eq(schema.contentFolders.id, folderId));
    
    res.json({
      success: true,
      message: `Content folder and ${descendantIds.length} sub-folders deleted`
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error deleting content folder:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete content folder"
    });
  }
});

// PATCH /api/content/folders/:id/move - Move folder to new parent
router.patch("/folders/:id/move", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const folderId = req.params.id;
    const { parentId } = req.body;
    
    const [existing] = await db.select()
      .from(schema.contentFolders)
      .where(and(
        eq(schema.contentFolders.id, folderId),
        eq(schema.contentFolders.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Content folder not found"
      });
    }
    
    if (parentId === folderId) {
      return res.status(400).json({
        success: false,
        error: "Cannot move folder into itself"
      });
    }
    
    if (parentId !== null && parentId !== undefined) {
      const [parentFolder] = await db.select()
        .from(schema.contentFolders)
        .where(and(
          eq(schema.contentFolders.id, parentId),
          eq(schema.contentFolders.consultantId, consultantId)
        ))
        .limit(1);
      
      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          error: "Parent folder not found"
        });
      }
      
      const isDescendant = async (potentialParentId: string, targetId: string): Promise<boolean> => {
        const children = await db.select()
          .from(schema.contentFolders)
          .where(and(
            eq(schema.contentFolders.parentId, targetId),
            eq(schema.contentFolders.consultantId, consultantId)
          ));
        
        for (const child of children) {
          if (child.id === potentialParentId) {
            return true;
          }
          if (await isDescendant(potentialParentId, child.id)) {
            return true;
          }
        }
        return false;
      };
      
      if (await isDescendant(parentId, folderId)) {
        return res.status(400).json({
          success: false,
          error: "Cannot move folder into its own descendant"
        });
      }
    }
    
    const [updated] = await db.update(schema.contentFolders)
      .set({ parentId: parentId || null, updatedAt: new Date() })
      .where(eq(schema.contentFolders.id, folderId))
      .returning();
    
    res.json({
      success: true,
      data: updated,
      message: "Folder moved successfully"
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error moving content folder:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to move content folder"
    });
  }
});

// ============================================================
// TEMPORARY TEXT EXTRACTION (for Content Studio Ideas)
// ============================================================

// POST /api/content/extract-text - Extract text from file without saving to DB
router.post(
  "/extract-text",
  authenticateToken,
  requireRole("consultant"),
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Nessun file caricato",
        });
      }

      const { originalname, mimetype, path: filePath, size } = req.file;
      
      console.log(`📄 [CONTENT-STUDIO] Extracting text for temp use: ${originalname} (${mimetype})`);

      // Extract text from file
      let extractedText = "";
      try {
        extractedText = await extractTextFromFile(filePath, mimetype);
      } catch (extractError: any) {
        console.error("❌ [CONTENT-STUDIO] Text extraction failed:", extractError);
        // Clean up file
        await fsPromises.unlink(filePath).catch(() => {});
        return res.status(400).json({
          success: false,
          error: `Impossibile estrarre testo: ${extractError.message}`,
        });
      }

      // Clean up temporary file immediately
      await fsPromises.unlink(filePath).catch(() => {});

      // Get file type for badge display
      const getFileType = (mime: string): string => {
        if (mime === "application/pdf") return "pdf";
        if (mime.includes("word") || mime.includes("document")) return "docx";
        if (mime === "text/plain") return "txt";
        if (mime === "text/markdown" || mime === "text/x-markdown") return "md";
        if (mime === "text/csv" || mime === "application/csv") return "csv";
        return "text";
      };

      console.log(`✅ [CONTENT-STUDIO] Extracted ${extractedText.length} chars from ${originalname}`);

      res.json({
        success: true,
        data: {
          title: originalname.replace(/\.[^/.]+$/, ""),
          fileName: originalname,
          fileType: getFileType(mimetype),
          fileSize: size,
          content: extractedText,
          tokenEstimate: Math.ceil(extractedText.length / 4),
        },
      });
    } catch (error: any) {
      console.error("❌ [CONTENT-STUDIO] Error extracting text:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to extract text from file",
      });
    }
  }
);

export default router;
