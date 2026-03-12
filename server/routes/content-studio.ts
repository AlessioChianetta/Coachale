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
import { eq, and, desc, gte, lte, lt, isNull, isNotNull, asc, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getSuperAdminGeminiKeys, getAIProvider, getModelWithThinking, getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } from "../ai/provider-factory";
import { ensureGeminiFileValid } from "../services/gemini-file-manager";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { upload } from "../middleware/upload";
import { extractTextFromFile } from "../services/document-processor";
import { generateAutopilotBatch, AutopilotConfig } from "../services/content-autopilot-service";

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

// POST /api/content/ideas/sync-developed - Sync ideas with existing posts
router.post("/ideas/sync-developed", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    // Find all posts that have ideaId set, ordered by creation date (latest first)
    const postsWithIdeas = await db.select({
      postId: schema.contentPosts.id,
      ideaId: schema.contentPosts.ideaId,
      createdAt: schema.contentPosts.createdAt,
    })
      .from(schema.contentPosts)
      .where(and(
        eq(schema.contentPosts.consultantId, consultantId),
        isNotNull(schema.contentPosts.ideaId)
      ))
      .orderBy(desc(schema.contentPosts.createdAt));
    
    // De-duplicate: keep only the latest post for each idea
    const ideaToPostMap = new Map<string, string>();
    for (const post of postsWithIdeas) {
      if (post.ideaId && !ideaToPostMap.has(post.ideaId)) {
        ideaToPostMap.set(post.ideaId, post.postId);
      }
    }
    
    let updatedCount = 0;
    
    // Update each idea with its latest post
    for (const [ideaId, postId] of ideaToPostMap.entries()) {
      const [updated] = await db.update(schema.contentIdeas)
        .set({
          status: "developed",
          developedPostId: postId,
          updatedAt: new Date()
        })
        .where(and(
          eq(schema.contentIdeas.id, ideaId),
          eq(schema.contentIdeas.consultantId, consultantId)
        ))
        .returning();
      
      if (updated) {
        updatedCount++;
      }
    }
    
    console.log(`✅ [CONTENT-STUDIO] Synced ${updatedCount} ideas as developed (from ${postsWithIdeas.length} posts)`);
    
    res.json({
      success: true,
      message: `${updatedCount} idee sincronizzate come sviluppate`,
      updatedCount
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error syncing developed ideas:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to sync developed ideas"
    });
  }
});

// ============================================================
// GLOBAL MARKET RESEARCH (per-consultant)
// ============================================================

router.get("/market-research", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const [config] = await db.select({
      marketResearchData: schema.contentStudioConfig.marketResearchData,
    })
      .from(schema.contentStudioConfig)
      .where(eq(schema.contentStudioConfig.consultantId, consultantId))
      .limit(1);

    res.json({
      success: true,
      data: config?.marketResearchData || null
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching global market research:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch market research" });
  }
});

router.post("/market-research", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { data: marketResearchData } = req.body;

    if (!marketResearchData) {
      return res.status(400).json({ success: false, error: "Missing market research data" });
    }

    const [existing] = await db.select({ id: schema.contentStudioConfig.id })
      .from(schema.contentStudioConfig)
      .where(eq(schema.contentStudioConfig.consultantId, consultantId))
      .limit(1);

    if (existing) {
      await db.update(schema.contentStudioConfig)
        .set({ marketResearchData, updatedAt: new Date() })
        .where(eq(schema.contentStudioConfig.consultantId, consultantId));
    } else {
      await db.insert(schema.contentStudioConfig).values({
        consultantId,
        marketResearchData,
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error saving global market research:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to save market research" });
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
      .orderBy(desc(schema.contentIdeaTemplates.isDefault), desc(schema.contentIdeaTemplates.createdAt));
    
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
          marketResearchProblems: body.marketResearchProblems || [],
          marketResearchData: body.marketResearchData || undefined,
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
        marketResearchProblems: body.marketResearchProblems || [],
        marketResearchData: body.marketResearchData || undefined,
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

// PUT /api/content/idea-templates/:id - Update existing template by ID
router.put("/idea-templates/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const templateId = req.params.id;
    const body = req.body;
    
    const [updated] = await db.update(schema.contentIdeaTemplates)
      .set({
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
        marketResearchProblems: body.marketResearchProblems || [],
        marketResearchData: body.marketResearchData || undefined,
      })
      .where(and(
        eq(schema.contentIdeaTemplates.id, templateId),
        eq(schema.contentIdeaTemplates.consultantId, consultantId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    
    res.json({ success: true, data: updated, message: "Template aggiornato" });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error updating idea template:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update template" });
  }
});

// PATCH /api/content/idea-templates/:id/default - Set template as default
router.patch("/idea-templates/:id/default", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const templateId = req.params.id;
    
    await db.update(schema.contentIdeaTemplates)
      .set({ isDefault: false })
      .where(eq(schema.contentIdeaTemplates.consultantId, consultantId));
    
    const [updated] = await db.update(schema.contentIdeaTemplates)
      .set({ isDefault: true })
      .where(and(
        eq(schema.contentIdeaTemplates.id, templateId),
        eq(schema.contentIdeaTemplates.consultantId, consultantId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    
    res.json({ success: true, data: updated, message: "Template impostato come predefinito" });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error setting default template:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to set default" });
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

// GET /api/content/posts/scheduled-count - Count scheduled posts in date range
router.get("/posts/scheduled-count", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { startDate, endDate, platforms } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "startDate and endDate are required" });
    }
    
    const platformList = (platforms as string)?.split(",").filter(Boolean) || [];
    const platformDbMap: Record<string, string> = {
      instagram: "instagram",
      x: "twitter",
      linkedin: "linkedin",
    };
    
    const dbPlatforms = platformList.map(p => platformDbMap[p] || p);
    
    const posts = await db.select({
      id: schema.contentPosts.id,
      platform: schema.contentPosts.platform,
      scheduledAt: schema.contentPosts.scheduledAt,
      status: schema.contentPosts.status,
    })
      .from(schema.contentPosts)
      .where(and(
        eq(schema.contentPosts.consultantId, consultantId),
        eq(schema.contentPosts.status, "scheduled"),
        gte(schema.contentPosts.scheduledAt, new Date(`${startDate}T00:00:00`)),
        lt(schema.contentPosts.scheduledAt, new Date(`${endDate}T23:59:59`))
      ));
    
    // Filter by platforms if specified
    const filteredPosts = dbPlatforms.length > 0 
      ? posts.filter(p => dbPlatforms.includes(p.platform || ""))
      : posts;
    
    // Count by platform
    const byPlatform: Record<string, number> = {};
    const byDate: Record<string, number> = {};
    
    for (const post of filteredPosts) {
      const platform = post.platform || "unknown";
      byPlatform[platform] = (byPlatform[platform] || 0) + 1;
      
      if (post.scheduledAt) {
        const dateStr = new Date(post.scheduledAt).toISOString().split("T")[0];
        byDate[dateStr] = (byDate[dateStr] || 0) + 1;
      }
    }
    
    res.json({
      success: true,
      data: {
        total: filteredPosts.length,
        byPlatform,
        byDate,
      }
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error counting scheduled posts:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to count scheduled posts"
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
    
    // If post was created from an idea, mark the idea as developed
    // Security: ensure idea belongs to same consultant (multi-tenant safety)
    if (post.ideaId) {
      const [updatedIdea] = await db.update(schema.contentIdeas)
        .set({
          status: "developed",
          developedPostId: post.id,
          updatedAt: new Date()
        })
        .where(and(
          eq(schema.contentIdeas.id, post.ideaId),
          eq(schema.contentIdeas.consultantId, consultantId)
        ))
        .returning();
      if (updatedIdea) {
        console.log(`✅ [CONTENT-STUDIO] Marked idea ${post.ideaId} as developed with post ${post.id}`);
      }
    }
    
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
  shortenCopy,
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
  sophisticationLevel: z.enum(["level_1", "level_2", "level_3", "level_4", "level_5"]).optional().nullable(),
  targetPlatform: z.enum(["instagram", "x", "linkedin"]).optional(),
  postCategory: z.enum(["ads", "valore", "formazione", "altri"]).optional(),
  postSchema: z.string().optional(),
  schemaStructure: z.string().optional(),
  schemaLabel: z.string().optional(),
  charLimit: z.number().optional(),
  writingStyle: z.enum(["default", "conversational", "direct", "persuasive", "custom"]).default("default"),
  customWritingInstructions: z.string().optional(),
  brandVoiceData: z.object({
    consultantDisplayName: z.string().nullish(),
    businessName: z.string().nullish(),
    businessDescription: z.string().nullish(),
    consultantBio: z.string().nullish(),
    vision: z.string().nullish(),
    mission: z.string().nullish(),
    values: z.array(z.string()).nullish(),
    usp: z.string().nullish(),
    whoWeHelp: z.string().nullish(),
    audienceSegments: z.array(z.object({ name: z.string(), description: z.string() })).nullish(),
    whatWeDo: z.string().nullish(),
    howWeDoIt: z.string().nullish(),
    yearsExperience: z.number().nullish(),
    clientsHelped: z.number().nullish(),
    resultsGenerated: z.string().nullish(),
    caseStudies: z.array(z.object({ client: z.string(), result: z.string() })).nullish(),
    servicesOffered: z.array(z.object({ name: z.string().nullish(), price: z.string().nullish(), description: z.string().nullish() })).nullish(),
    guarantees: z.string().nullish(),
  }).optional(),
  kbDocumentIds: z.array(z.string()).optional(),
  kbContent: z.string().optional(),
  marketResearchProblems: z.array(z.string()).optional(),
  marketResearchData: z.object({
    currentState: z.array(z.string()).optional(),
    idealState: z.array(z.string()).optional(),
    avatar: z.object({
      nightThought: z.string().optional().default(""),
      biggestFear: z.string().optional().default(""),
      dailyFrustration: z.string().optional().default(""),
      deepestDesire: z.string().optional().default(""),
      currentSituation: z.string().optional().default(""),
      decisionStyle: z.string().optional().default(""),
      languageUsed: z.preprocess((v) => Array.isArray(v) ? v.join("\n") : v, z.string().optional().default("")),
      influencers: z.preprocess((v) => Array.isArray(v) ? v.join(", ") : v, z.string().optional().default("")),
    }).optional(),
    emotionalDrivers: z.array(z.string()).optional(),
    existingSolutionProblems: z.array(z.string()).optional(),
    internalObjections: z.array(z.string()).optional(),
    externalObjections: z.array(z.string()).optional(),
    coreLies: z.array(z.object({
      name: z.string(),
      problem: z.string(),
      cureOrPrevent: z.enum(["C", "P"]),
      isAware: z.boolean(),
      importance: z.number(),
    })).optional(),
    uniqueMechanism: z.object({
      name: z.string().optional().default(""),
      description: z.string().optional().default(""),
    }).optional(),
    uvp: z.string().optional().default(""),
  }).optional(),
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
    audienceSegments: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
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
    audienceSegments: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
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

// ============================================================
// MARKET RESEARCH — Deep Research with Dual Google Search + AI
// ============================================================

const generateMarketResearchSchema = z.object({
  niche: z.string().min(1, "Nicchia obbligatoria"),
  targetAudience: z.string().default(""),
  brandVoiceData: z.record(z.any()).optional(),
  whatYouSell: z.string().optional(),
  promisedResult: z.string().optional(),
  phase: z.string().optional(),
});

async function getMarketResearchKeys(): Promise<{ serpApiKey: string | null }> {
  try {
    const [config] = await db.select().from(schema.superadminLeadScraperConfig).limit(1);
    if (config && config.enabled) {
      const { decrypt: dec } = await import("../encryption");
      return {
        serpApiKey: config.serpapiKeyEncrypted ? dec(config.serpapiKeyEncrypted) : null,
      };
    }
  } catch (e) {
    console.error("[MARKET-RESEARCH] Error reading keys from DB, falling back to env:", e);
  }
  return {
    serpApiKey: process.env.SERPAPI_KEY || null,
  };
}

const marketResearchJobs = new Map<string, {
  status: 'running' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  stepDetails: string;
  steps: Array<{ label: string; status: 'pending' | 'running' | 'completed' | 'error'; details: string; startedAt?: number; completedAt?: number }>;
  result?: any;
  error?: string;
  createdAt: number;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
}>();

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of marketResearchJobs) {
    if (now - job.createdAt > 10 * 60 * 1000) marketResearchJobs.delete(id);
  }
}, 60000);

function parseAIJson(rawText: string): any {
  try {
    return JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("AI response was not valid JSON");
  }
}

function normalizeMarketResearchData(parsed: any) {
  return {
    currentState: Array.isArray(parsed.currentState) ? parsed.currentState : [""],
    idealState: Array.isArray(parsed.idealState) ? parsed.idealState : [""],
    avatar: {
      nightThought: parsed.avatar?.nightThought || "",
      biggestFear: parsed.avatar?.biggestFear || "",
      dailyFrustration: parsed.avatar?.dailyFrustration || "",
      deepestDesire: parsed.avatar?.deepestDesire || "",
      currentSituation: parsed.avatar?.currentSituation || "",
      decisionStyle: parsed.avatar?.decisionStyle || "",
      languageUsed: Array.isArray(parsed.avatar?.languageUsed) ? parsed.avatar.languageUsed.join("\n") : (parsed.avatar?.languageUsed || ""),
      influencers: Array.isArray(parsed.avatar?.influencers) ? parsed.avatar.influencers.join(", ") : (parsed.avatar?.influencers || ""),
    },
    emotionalDrivers: Array.isArray(parsed.emotionalDrivers) ? parsed.emotionalDrivers.map((d: string) => {
      const keyMap: Record<string, string> = { fuga_dal_dolore: 'fuga_dolore', pulsione_sessuale: 'sessualita', approvazione_sociale: 'approvazione' };
      return keyMap[d] || d;
    }) : [],
    existingSolutionProblems: Array.isArray(parsed.existingSolutionProblems) ? parsed.existingSolutionProblems : [""],
    internalObjections: Array.isArray(parsed.internalObjections) ? parsed.internalObjections : [""],
    externalObjections: Array.isArray(parsed.externalObjections) ? parsed.externalObjections : [""],
    coreLies: Array.isArray(parsed.coreLies) ? parsed.coreLies.map((cl: any) => ({
      name: cl.name || "",
      problem: cl.problem || "",
      cureOrPrevent: cl.cureOrPrevent === 'P' ? 'P' : 'C',
      isAware: !!cl.isAware,
      importance: typeof cl.importance === 'number' ? Math.min(10, Math.max(1, cl.importance)) : 5,
    })) : [],
    uniqueMechanism: {
      name: parsed.uniqueMechanism?.name || "",
      description: parsed.uniqueMechanism?.description || "",
    },
    uvp: parsed.uvp || "",
  };
}

router.post("/ai/generate-market-research", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const input = generateMarketResearchSchema.parse(req.body);
    const jobId = `mr_${consultantId}_${Date.now()}`;

    const isSinglePhase = !!input.phase;
    const phaseLabels: Record<string, string> = {
      trasformazione: '🔄 Stato Attuale → Ideale',
      avatar: '👤 Avatar Cliente',
      leve: '⚡ Leve Emotive',
      obiezioni: '🛡️ Obiezioni',
      errore: '❌ Errore Fatale (Core Lies)',
      meccanismo: '⚙️ Meccanismo Unico',
      posizionamento: '🎯 Posizionamento (UVP)',
    };

    const job = {
      status: 'running' as const,
      currentStep: 1,
      totalSteps: isSinglePhase ? 1 : 4,
      stepLabel: isSinglePhase ? (phaseLabels[input.phase!] || input.phase!) : 'Ricerca Google',
      stepDetails: isSinglePhase ? `Generazione ${phaseLabels[input.phase!] || input.phase!}...` : 'Avvio ricerca su Google con SerpApi e Gemini Grounding...',
      steps: isSinglePhase
        ? [{ label: `✨ ${phaseLabels[input.phase!] || input.phase!}`, status: 'running' as const, details: 'Generazione in corso...', startedAt: Date.now() }]
        : [
            { label: '🔍 Ricerca Google (SerpApi + Gemini)', status: 'running' as const, details: 'Raccolta dati reali dal mercato...', startedAt: Date.now() },
            { label: '🧠 Analisi di Mercato (Gemini Pro)', status: 'pending' as const, details: '' },
            { label: '👤 Profilo Psicologico & Linguaggio', status: 'pending' as const, details: '' },
            { label: '🎯 Sintesi Finale — 7 Fasi', status: 'pending' as const, details: '' },
          ],
      createdAt: Date.now(),
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
    marketResearchJobs.set(jobId, job);

    res.json({ success: true, jobId });

    console.log(`🔬 [MARKET-RESEARCH] Job ${jobId} started for "${input.niche}" / "${input.targetAudience}"${isSinglePhase ? ` (phase: ${input.phase})` : ''}`);

    const brandCtx = input.brandVoiceData || {};
    let brandSection = "";
    if (Object.keys(brandCtx).length > 0) {
      brandSection = `\n=== BRAND VOICE ===\n`;
      if (brandCtx.consultantDisplayName) brandSection += `Consulente: ${brandCtx.consultantDisplayName}\n`;
      if (brandCtx.businessName) brandSection += `Business: ${brandCtx.businessName}\n`;
      if (brandCtx.businessDescription) brandSection += `Descrizione: ${brandCtx.businessDescription}\n`;
      if (brandCtx.consultantBio) brandSection += `Bio: ${brandCtx.consultantBio}\n`;
      if (brandCtx.usp) brandSection += `USP: ${brandCtx.usp}\n`;
      if (brandCtx.whatWeDo) brandSection += `Cosa facciamo: ${brandCtx.whatWeDo}\n`;
      if (brandCtx.whoWeHelp) brandSection += `Chi aiutiamo: ${brandCtx.whoWeHelp}\n`;
      if (brandCtx.whoWeDontHelp) brandSection += `Chi NON aiutiamo: ${brandCtx.whoWeDontHelp}\n`;
      const segArr = Array.isArray(brandCtx.audienceSegments) ? brandCtx.audienceSegments : [];
      if (segArr.length > 0) {
        brandSection += `\n--- Segmenti di Pubblico ---\n`;
        segArr.forEach((s: any) => {
          brandSection += `• ${s.name || ''}: ${s.description || ''}\n`;
        });
      }
      if (brandCtx.howWeDoIt) brandSection += `Come lo facciamo: ${brandCtx.howWeDoIt}\n`;
      if (brandCtx.vision) brandSection += `Vision: ${brandCtx.vision}\n`;
      if (brandCtx.mission) brandSection += `Mission: ${brandCtx.mission}\n`;
      if (Array.isArray(brandCtx.values) && brandCtx.values.length > 0) brandSection += `Valori: ${brandCtx.values.join(", ")}\n`;
      if (brandCtx.guarantees) brandSection += `Garanzie: ${brandCtx.guarantees}\n`;

      const swArr = Array.isArray(brandCtx.softwareCreated) ? brandCtx.softwareCreated : [];
      const bkArr = Array.isArray(brandCtx.booksPublished) ? brandCtx.booksPublished : [];
      const csArr = Array.isArray(brandCtx.caseStudies) ? brandCtx.caseStudies : [];
      const hasCredentials = brandCtx.yearsExperience || brandCtx.clientsHelped || brandCtx.resultsGenerated ||
        swArr.length > 0 || bkArr.length > 0 || csArr.length > 0;
      if (hasCredentials) {
        brandSection += `\n--- Credibilità & Prove Sociali ---\n`;
        if (brandCtx.yearsExperience) brandSection += `Anni di esperienza: ${brandCtx.yearsExperience}\n`;
        if (brandCtx.clientsHelped) brandSection += `Clienti aiutati: ${brandCtx.clientsHelped}+\n`;
        if (brandCtx.resultsGenerated) brandSection += `Risultati generati: ${brandCtx.resultsGenerated}\n`;
        if (swArr.length > 0) {
          brandSection += `Software creati: ${swArr.map((s: any) => `${s.emoji || ''} ${s.name || ''}${s.description ? ': ' + s.description : ''}`).join('; ')}\n`;
        }
        if (bkArr.length > 0) {
          brandSection += `Libri pubblicati: ${bkArr.map((b: any) => `"${b.title || ''}"${b.year ? ' (' + b.year + ')' : ''}`).join('; ')}\n`;
        }
        if (csArr.length > 0) {
          brandSection += `Case studies: ${csArr.map((c: any) => `${c.client || ''} → ${c.result || ''}`).join('; ')}\n`;
        }
      }

      const svArr = Array.isArray(brandCtx.servicesOffered) ? brandCtx.servicesOffered : [];
      if (svArr.length > 0) {
        brandSection += `\n--- Servizi Offerti ---\n`;
        svArr.forEach((s: any) => {
          brandSection += `- ${s.name || ''}${s.price ? ' (' + s.price + ')' : ''}${s.description ? ': ' + s.description : ''}\n`;
        });
      }

      const weArr = Array.isArray(brandCtx.writingExamples) ? brandCtx.writingExamples : [];
      const spArr = Array.isArray(brandCtx.signaturePhrases) ? brandCtx.signaturePhrases : [];
      const hasStyle = brandCtx.personalTone || brandCtx.contentPersonality || brandCtx.audienceLanguage ||
        brandCtx.avoidPatterns || weArr.length > 0 || spArr.length > 0;
      if (hasStyle) {
        brandSection += `\n--- Stile di Comunicazione ---\n`;
        if (brandCtx.personalTone) brandSection += `Tono: ${brandCtx.personalTone}\n`;
        if (brandCtx.contentPersonality) brandSection += `Personalità contenuti: ${brandCtx.contentPersonality}\n`;
        if (brandCtx.audienceLanguage) brandSection += `Linguaggio del pubblico: ${brandCtx.audienceLanguage}\n`;
        if (brandCtx.avoidPatterns) brandSection += `Da evitare: ${brandCtx.avoidPatterns}\n`;
        if (weArr.length > 0) {
          brandSection += `Esempi di scrittura reale:\n${weArr.map((e: string) => `  "${e}"`).join('\n')}\n`;
        }
        if (spArr.length > 0) {
          brandSection += `Frasi firma: ${spArr.join('; ')}\n`;
        }
      }
    }

    (async () => {
      try {
        // ══════════════════════════════════════════════════════════
        // SINGLE PHASE GENERATION (when phase is specified)
        // ══════════════════════════════════════════════════════════
        if (isSinglePhase && input.phase) {
          const { GoogleGenAI } = await import("@google/genai");
          const apiKey = await getGeminiApiKeyForClassifier();
          if (!apiKey) throw new Error("No AI API key available");
          const ai = new GoogleGenAI({ apiKey });

          const phasePrompts: Record<string, { prompt: string; jsonShape: string }> = {
            trasformazione: {
              prompt: `Genera lo Stato Attuale e lo Stato Ideale per il target di questa nicchia. Lo stato attuale sono i 5 problemi/frustrazioni principali del target. Lo stato ideale sono i 5 risultati che sognano di ottenere.`,
              jsonShape: `{"currentState": ["problema 1", "problema 2", "problema 3", "problema 4", "problema 5"], "idealState": ["risultato 1", "risultato 2", "risultato 3", "risultato 4", "risultato 5"]}`,
            },
            avatar: {
              prompt: `Genera il profilo dell'Avatar Cliente ideale: cosa pensa alle 3 di notte, la sua paura più grande, la frustrazione quotidiana, il desiderio profondo, la situazione attuale, come prende decisioni, il linguaggio che usa (10-15 frasi reali), chi lo influenza.`,
              jsonShape: `{"avatar": {"nightThought": "...", "biggestFear": "...", "dailyFrustration": "...", "deepestDesire": "...", "currentSituation": "...", "decisionStyle": "...", "languageUsed": "...", "influencers": "..."}}`,
            },
            leve: {
              prompt: `Identifica le leve emotive più potenti per questo target e i problemi delle soluzioni esistenti sul mercato.`,
              jsonShape: `{"emotionalDrivers": ["leva1", "leva2"], "existingSolutionProblems": ["problema 1", "problema 2", "problema 3"]}`,
            },
            obiezioni: {
              prompt: `Genera le obiezioni interne (paure, scuse, dubbi interiori — 5 pensieri in prima persona) e le obiezioni esterne (dubbi concreti su prezzo, credibilità, funzionamento — 5 dubbi) del target.`,
              jsonShape: `{"internalObjections": ["pensiero 1", "pensiero 2", "pensiero 3", "pensiero 4", "pensiero 5"], "externalObjections": ["dubbio 1", "dubbio 2", "dubbio 3", "dubbio 4", "dubbio 5"]}`,
            },
            errore: {
              prompt: `Genera 3-4 Core Lies (convinzioni errate) che il target ha riguardo al problema o alle soluzioni. Per ognuna: nome, perché è un problema, se è cura (C) o prevenzione (P), se ne è consapevole, importanza (1-10).`,
              jsonShape: `{"coreLies": [{"name": "...", "problem": "...", "cureOrPrevent": "C", "isAware": false, "importance": 8}]}`,
            },
            meccanismo: {
              prompt: `Genera il Meccanismo Unico: un nome evocativo e una descrizione di come funziona e perché è diverso da tutto il resto sul mercato.`,
              jsonShape: `{"uniqueMechanism": {"name": "...", "description": "..."}}`,
            },
            posizionamento: {
              prompt: `Genera la UVP (Unique Value Proposition) nel formato: "Aiuto [target specifico] a [risultato concreto] senza [dolore principale] grazie a [meccanismo unico]"`,
              jsonShape: `{"uvp": "Aiuto ... a ... senza ... grazie a ..."}`,
            },
          };

          const phaseConfig = phasePrompts[input.phase];
          if (!phaseConfig) throw new Error(`Fase sconosciuta: ${input.phase}`);

          const singlePrompt = `${phaseConfig.prompt}

NICCHIA: ${input.niche}
TARGET: ${input.targetAudience}
${input.whatYouSell ? `PRODOTTO/SERVIZIO: ${input.whatYouSell}` : ''}
${input.promisedResult ? `RISULTATO PROMESSO: ${input.promisedResult}` : ''}
${brandSection}

REGOLE:
- Scrivi TUTTO con le parole del cliente, NON linguaggio da marketer o consulente
- Ogni frase deve suonare come se il cliente stesso l'avesse detta
- Le obiezioni interne sono pensieri in prima persona ("Non ce la faccio", "Non ho tempo")
- Le obiezioni esterne sono dubbi concreti ("Costa troppo", "Chi mi dice che funziona?")
- emotionalDrivers SOLO tra: sopravvivenza, piacere, fuga_dolore, sessualita, comfort, status, protezione, approvazione

Rispondi SOLO con JSON valido (no markdown, no backtick):
${phaseConfig.jsonShape}`;

          const phaseResult = await trackedGenerateContent(ai, {
            model: GEMINI_3_MODEL,
            contents: [{ role: "user", parts: [{ text: singlePrompt }] }],
            config: { temperature: 0.6, maxOutputTokens: 4096, responseMimeType: "application/json" },
          }, { consultantId, feature: `market-research-phase-${input.phase}`, callerRole: 'consultant' });

          const phaseUsage = phaseResult?.usageMetadata;
          if (phaseUsage) {
            job.tokenUsage.inputTokens += phaseUsage.promptTokenCount || 0;
            job.tokenUsage.outputTokens += phaseUsage.candidatesTokenCount || 0;
            job.tokenUsage.totalTokens += phaseUsage.totalTokenCount || 0;
          }

          const rawText = typeof phaseResult.text === 'function' ? phaseResult.text() : (phaseResult as any).text || '';
          const parsed = parseAIJson(rawText);

          if (parsed.emotionalDrivers) {
            const keyMap: Record<string, string> = { fuga_dal_dolore: 'fuga_dolore', pulsione_sessuale: 'sessualita', approvazione_sociale: 'approvazione' };
            parsed.emotionalDrivers = parsed.emotionalDrivers.map((d: string) => keyMap[d] || d);
          }
          if (parsed.coreLies) {
            parsed.coreLies = parsed.coreLies.map((cl: any) => ({
              name: cl.name || "", problem: cl.problem || "", cureOrPrevent: cl.cureOrPrevent === 'P' ? 'P' : 'C',
              isAware: !!cl.isAware, importance: typeof cl.importance === 'number' ? Math.min(10, Math.max(1, cl.importance)) : 5,
            }));
          }

          job.steps[0].status = 'completed';
          job.steps[0].details = 'Generazione completata';
          job.steps[0].completedAt = Date.now();
          job.status = 'completed';
          job.stepLabel = 'Completato';
          job.stepDetails = `${phaseLabels[input.phase] || input.phase} generata!`;
          job.result = {
            data: parsed,
            meta: { tokenUsage: { ...job.tokenUsage }, singlePhase: input.phase },
          };

          console.log(`✅ [MARKET-RESEARCH] Single phase "${input.phase}" completed for job ${jobId}`);
          return;
        }

        // ══════════════════════════════════════════════════════════
        // STEP 1: Dual Web Research (SerpApi + Gemini Grounding)
        // ══════════════════════════════════════════════════════════
        const serpApiPromise = (async () => {
          try {
            const keys = await getMarketResearchKeys();
            if (!keys.serpApiKey) return [];
            const { searchGoogleWeb } = await import("../services/lead-scraper-service");
            const queries = [
              `${input.niche} problemi frustrazioni clienti`,
              `${input.niche} ${input.targetAudience} forum opinioni recensioni`,
              `${input.niche} concorrenti soluzioni alternative`,
              `${input.niche} obiezioni paure acquisto`,
            ];
            const results = await Promise.allSettled(
              queries.map(q => searchGoogleWeb(q, "", 8, keys.serpApiKey!, 0))
            );
            const snippets: string[] = [];
            results.forEach((r, i) => {
              if (r.status === "fulfilled") {
                r.value.forEach((item: any) => {
                  if (item.snippet) snippets.push(`[${queries[i]}] ${item.snippet}`);
                });
              }
            });
            return snippets;
          } catch (err: any) {
            console.warn("[MARKET-RESEARCH] SerpApi failed:", err.message);
            return [];
          }
        })();

        const geminiGroundingPromise = (async () => {
          try {
            const { GoogleGenAI } = await import("@google/genai");
            const apiKey = await getGeminiApiKeyForClassifier();
            if (!apiKey) return { text: "", sources: [] as Array<{ url: string; title: string }>, queries: [] as string[] };
            const groundingAi = new GoogleGenAI({ apiKey });
            const result = await trackedGenerateContent(groundingAi, {
              model: GEMINI_3_MODEL,
              contents: [{ role: "user", parts: [{ text: `Sei un ricercatore di mercato esperto. Cerca informazioni reali e aggiornate su questo mercato:\n\nNicchia: ${input.niche}\nTarget: ${input.targetAudience}\n${input.whatYouSell ? `Prodotto/Servizio: ${input.whatYouSell}` : ''}\n${input.promisedResult ? `Risultato promesso: ${input.promisedResult}` : ''}\n\nTrova e riporta:\n1. Problemi reali e frustrazioni dei clienti\n2. Soluzioni dei concorrenti e lacune\n3. Recensioni e lamentele reali\n4. Pattern emotivi e paure ricorrenti\n5. Obiezioni comuni all'acquisto\n6. Tendenze di mercato attuali\n7. Il LINGUAGGIO ESATTO che i clienti usano (frasi, espressioni, parole) quando parlano dei loro problemi — cerca nei forum, recensioni, gruppi\n\nRiporta SOLO informazioni reali dalla ricerca. Cita le fonti.` }] }],
              config: { temperature: 0.3, maxOutputTokens: 4096, tools: [{ googleSearch: {} }] },
            }, { consultantId, feature: 'market-research-grounding', callerRole: 'consultant' });
            const groundingUsage = result?.usageMetadata;
            if (groundingUsage) {
              job.tokenUsage.inputTokens += groundingUsage.promptTokenCount || 0;
              job.tokenUsage.outputTokens += groundingUsage.candidatesTokenCount || 0;
              job.tokenUsage.totalTokens += groundingUsage.totalTokenCount || 0;
            }
            const text = typeof result.text === 'function' ? result.text() : (result as any).text || '';
            const groundingMetadata = (result as any).candidates?.[0]?.groundingMetadata;
            const chunks = groundingMetadata?.groundingChunks || [];
            const sources = chunks.filter((c: any) => c.web).map((c: any) => ({ url: c.web.uri, title: c.web.title || "Fonte web" }));
            return { text, sources, queries: groundingMetadata?.webSearchQueries || [] };
          } catch (err: any) {
            console.warn("[MARKET-RESEARCH] Gemini grounding failed:", err.message);
            return { text: "", sources: [] as Array<{ url: string; title: string }>, queries: [] as string[] };
          }
        })();

        const [serpSnippets, groundingResult] = await Promise.all([serpApiPromise, geminiGroundingPromise]);

        job.steps[0].status = 'completed';
        job.steps[0].details = `${serpSnippets.length} snippet SerpApi, ${groundingResult.sources.length} fonti Gemini`;
        job.steps[0].completedAt = Date.now();
        console.log(`[MARKET-RESEARCH] Step 1 done: ${serpSnippets.length} snippets, ${groundingResult.sources.length} sources`);

        let webDataSection = "";
        if (serpSnippets.length > 0 || groundingResult.text) {
          webDataSection = `\n\n=== DATI REALI DAL MERCATO ===\n`;
          if (serpSnippets.length > 0) webDataSection += `\n--- Google Search (SerpApi) ---\n${serpSnippets.slice(0, 30).join("\n")}\n`;
          if (groundingResult.text) webDataSection += `\n--- Gemini Grounding ---\n${groundingResult.text}\n`;
          if (groundingResult.sources.length > 0) webDataSection += `\n--- Fonti ---\n${groundingResult.sources.map(s => `- ${s.title}: ${s.url}`).join("\n")}\n`;
        }

        const { GoogleGenAI } = await import("@google/genai");
        const apiKey = await getGeminiApiKeyForClassifier();
        if (!apiKey) throw new Error("No AI API key available");
        const ai = new GoogleGenAI({ apiKey });

        // ══════════════════════════════════════════════════════════
        // STEP 2: Market Analysis (Deep strategic analysis)
        // ══════════════════════════════════════════════════════════
        job.currentStep = 2;
        job.stepLabel = 'Analisi di Mercato';
        job.stepDetails = 'Gemini Pro sta analizzando il mercato, i concorrenti e le opportunità...';
        job.steps[1].status = 'running';
        job.steps[1].details = 'Analisi strategica del mercato con Gemini...';
        job.steps[1].startedAt = Date.now();

        const step2Prompt = `Sei un analista strategico di mercato con 20 anni di esperienza. Analizza TUTTI i dati raccolti dalla ricerca Google e produci un'analisi strategica approfondita.

NICCHIA: ${input.niche}
TARGET: ${input.targetAudience}
${input.whatYouSell ? `PRODOTTO/SERVIZIO: ${input.whatYouSell}` : ''}
${input.promisedResult ? `RISULTATO PROMESSO: ${input.promisedResult}` : ''}
${brandSection}
${webDataSection}

Produci un'analisi strategica che copra:

1. MAPPA DEI PROBLEMI REALI: I 5-7 problemi più sentiti dal target basandoti sui dati reali. Per ogni problema, indica quanto è urgente (1-10) e quanto ne sono consapevoli.

2. PANORAMA COMPETITIVO: Chi sono i concorrenti? Quali soluzioni offrono? Dove falliscono? Cosa manca nel mercato?

3. PATTERN EMOTIVI: Quali emozioni dominano nel target? Quali paure, frustrazioni, desideri emergono dai dati reali? Cosa li tiene svegli di notte?

4. OBIEZIONI E RESISTENZE: Perché il target NON compra? Quali scuse si dà? Quali dubbi ha sulla soluzione?

5. OPPORTUNITÀ NON SFRUTTATE: Cosa nessun concorrente sta facendo che potrebbe fare la differenza?

Rispondi in modo dettagliato e strutturato, basandoti sui dati reali. Non essere generico.`;

        const step2Result = await trackedGenerateContent(ai, {
          model: GEMINI_3_MODEL,
          contents: [{ role: "user", parts: [{ text: step2Prompt }] }],
          config: { temperature: 0.5, maxOutputTokens: 8192 },
        }, { consultantId, feature: 'market-research-step2', callerRole: 'consultant' });
        const step2Usage = step2Result?.usageMetadata;
        if (step2Usage) {
          job.tokenUsage.inputTokens += step2Usage.promptTokenCount || 0;
          job.tokenUsage.outputTokens += step2Usage.candidatesTokenCount || 0;
          job.tokenUsage.totalTokens += step2Usage.totalTokenCount || 0;
        }
        const marketAnalysis = typeof step2Result.text === 'function' ? step2Result.text() : (step2Result as any).text || '';

        job.steps[1].status = 'completed';
        job.steps[1].details = `Analisi completata (${marketAnalysis.length} caratteri)`;
        job.steps[1].completedAt = Date.now();
        console.log(`[MARKET-RESEARCH] Step 2 done: ${marketAnalysis.length} chars analysis`);

        // ══════════════════════════════════════════════════════════
        // STEP 3: Psychological Profile & Language Extraction
        // ══════════════════════════════════════════════════════════
        job.currentStep = 3;
        job.stepLabel = 'Profilo Psicologico';
        job.stepDetails = 'Estrazione del linguaggio reale del cliente e profilo psicologico...';
        job.steps[2].status = 'running';
        job.steps[2].details = 'Analisi del linguaggio e della psicologia del target...';
        job.steps[2].startedAt = Date.now();

        const step3Prompt = `Sei uno psicologo del consumatore e copywriter esperto. Basandoti sui dati della ricerca di mercato e sull'analisi strategica, devi creare un PROFILO PSICOLOGICO DETTAGLIATO del cliente ideale.

NICCHIA: ${input.niche}
TARGET: ${input.targetAudience}
${brandSection}

=== DATI DALLA RICERCA ===
${webDataSection}

=== ANALISI DI MERCATO ===
${marketAnalysis}

ISTRUZIONE CRITICA: Tutto quello che scrivi deve essere detto CON LE PAROLE DEL CLIENTE. Non usare linguaggio da marketer o da consulente. Usa il linguaggio che il target usa realmente quando parla dei suoi problemi con amici, nei forum, nelle recensioni.

Esempio SBAGLIATO: "Il cliente manifesta insoddisfazione per la mancanza di risultati tangibili"
Esempio GIUSTO: "Ho provato di tutto ma non cambia niente, butto solo soldi"

Genera un profilo dettagliato con:

1. PENSIERO ALLE 3 DI NOTTE: La frase esatta che il cliente si dice quando non riesce a dormire. Scritta in prima persona, con il suo linguaggio.

2. PAURA PIÙ GRANDE: Cosa lo terrorizza di più? Scritto come lo direbbe a un amico intimo.

3. FRUSTRAZIONE QUOTIDIANA: Cosa lo fa imprecare ogni giorno? Il momento specifico in cui si sente perso.

4. DESIDERIO PROFONDO: Cosa vorrebbe davvero? Non la versione "pulita" — quella vera, emotiva, viscerale.

5. COME VIVE LA SITUAZIONE: Descrivi la sua giornata tipo rispetto a questo problema. Dettagli concreti.

6. COME PRENDE DECISIONI: È impulsivo? Confronta? Chiede consiglio? A chi? Si fa bloccare dai prezzi? Dalle recensioni?

7. PAROLE E FRASI ESATTE: Lista di 10-15 frasi/espressioni che il target usa REALMENTE parlando del problema. Prendi da forum, recensioni, social. Devono suonare autentiche.

8. CHI LO INFLUENZA: Persone, creator, community, amici, familiari — chi ha peso sulle sue decisioni?

9. LEVE EMOTIVE: Quali di queste leve sono più potenti per questo target? Sopravvivenza, Piacere, Fuga dal dolore, Aspetto/Sessualità, Comfort, Status/Vincere, Protezione dei cari, Approvazione sociale. Per ognuna spiega PERCHÉ funziona su questo target specifico.

10. CONVINZIONI ERRATE (CORE LIES): 3-4 convinzioni sbagliate che il target ha sul proprio problema o sulle soluzioni. Per ognuna: nome, perché è un problema, se è una "cura" (C) o "prevenzione" (P), se ne è consapevole, quanto è importante (1-10).

11. OBIEZIONI INTERNE: 3-5 pensieri che bloccano il target dall'agire. Sono dubbi interiori, paure, scuse che si dice ("Non sono capace", "Non ho tempo", "Non fa per me", ecc.). Scritte in prima persona come il cliente le pensa davvero.

12. OBIEZIONI ESTERNE: 3-5 dubbi concreti e razionali sul prodotto/servizio/soluzione. Riguardano prezzo, credibilità, funzionamento, garanzie, differenza dai concorrenti. Scritte come il cliente le direbbe parlando con un amico ("Ma costa troppo", "Chi mi dice che funziona davvero?", ecc.).

Scrivi TUTTO con il linguaggio del cliente. Ogni frase deve suonare come se il cliente stesso l'avesse detta.`;

        const step3Result = await trackedGenerateContent(ai, {
          model: GEMINI_3_MODEL,
          contents: [{ role: "user", parts: [{ text: step3Prompt }] }],
          config: { temperature: 0.7, maxOutputTokens: 8192 },
        }, { consultantId, feature: 'market-research-step3', callerRole: 'consultant' });
        const step3Usage = step3Result?.usageMetadata;
        if (step3Usage) {
          job.tokenUsage.inputTokens += step3Usage.promptTokenCount || 0;
          job.tokenUsage.outputTokens += step3Usage.candidatesTokenCount || 0;
          job.tokenUsage.totalTokens += step3Usage.totalTokenCount || 0;
        }
        const psychProfile = typeof step3Result.text === 'function' ? step3Result.text() : (step3Result as any).text || '';

        job.steps[2].status = 'completed';
        job.steps[2].details = `Profilo psicologico completato (${psychProfile.length} caratteri)`;
        job.steps[2].completedAt = Date.now();
        console.log(`[MARKET-RESEARCH] Step 3 done: ${psychProfile.length} chars psych profile`);

        // ══════════════════════════════════════════════════════════
        // STEP 4: Final Synthesis — Generate structured 7-phase JSON
        // ══════════════════════════════════════════════════════════
        job.currentStep = 4;
        job.stepLabel = 'Sintesi Finale';
        job.stepDetails = 'Combinazione di tutti i dati nelle 7 fasi del framework...';
        job.steps[3].status = 'running';
        job.steps[3].details = 'Generazione della struttura finale...';
        job.steps[3].startedAt = Date.now();

        const step4Prompt = `Hai a disposizione 3 fonti di ricerca su questa nicchia. Combinale in un output JSON strutturato.

NICCHIA: ${input.niche}
TARGET: ${input.targetAudience}
${input.whatYouSell ? `PRODOTTO/SERVIZIO: ${input.whatYouSell}` : ''}
${input.promisedResult ? `RISULTATO PROMESSO: ${input.promisedResult}` : ''}
${brandSection}

=== FONTE 1: DATI GOOGLE ===
${webDataSection}

=== FONTE 2: ANALISI STRATEGICA DI MERCATO ===
${marketAnalysis}

=== FONTE 3: PROFILO PSICOLOGICO & LINGUAGGIO DEL CLIENTE ===
${psychProfile}

ISTRUZIONE FONDAMENTALE: 
- currentState e idealState devono essere scritti CON LE PAROLE DEL CLIENTE, non con linguaggio da marketer
- L'avatar deve contenere frasi che il cliente direbbe davvero
- Le obiezioni devono suonare come le direbbe il cliente
- Il tutto deve sembrare "preso da un forum" non "scritto da un consulente"

Rispondi SOLO con JSON valido (no markdown, no backtick):

{
  "currentState": ["frase problema 1 (con le parole del cliente)", "frase problema 2", "frase problema 3", "frase problema 4", "frase problema 5"],
  "idealState": ["risultato sognato 1 (con le parole del cliente)", "risultato 2", "risultato 3", "risultato 4", "risultato 5"],
  "avatar": {
    "nightThought": "frase in prima persona che il cliente si dice alle 3 di notte",
    "biggestFear": "la paura più grande scritta come la direbbe a un amico",
    "dailyFrustration": "la frustrazione quotidiana con dettagli specifici",
    "deepestDesire": "il desiderio profondo, emotivo e viscerale",
    "currentSituation": "come vive il problema nella vita quotidiana",
    "decisionStyle": "come prende decisioni di acquisto",
    "languageUsed": "10-15 frasi/espressioni REALI che il target usa",
    "influencers": "chi influenza le sue decisioni"
  },
  "emotionalDrivers": ["solo_le_leve_rilevanti"],
  "existingSolutionProblems": ["cosa non funziona delle soluzioni attuali (parole del cliente)"],
  "internalObjections": ["pensiero interiore che blocca il cliente 1", "pensiero 2", "pensiero 3", "pensiero 4", "pensiero 5"],
  "externalObjections": ["dubbio concreto sul prodotto/servizio 1", "dubbio 2", "dubbio 3", "dubbio 4", "dubbio 5"],
  "coreLies": [
    { "name": "nome convinzione errata", "problem": "perché è un problema", "cureOrPrevent": "C", "isAware": false, "importance": 8 }
  ],
  "uniqueMechanism": {
    "name": "nome del meccanismo unico",
    "description": "come funziona e perché è diverso"
  },
  "uvp": "Aiuto [target specifico] a [risultato concreto] senza [dolore principale] grazie a [meccanismo unico]"
}

REGOLE:
- emotionalDrivers: SOLO tra: sopravvivenza, piacere, fuga_dolore, sessualita, comfort, status, protezione, approvazione
- coreLies: 2-4 convinzioni con importanza 1-10
- internalObjections: OBBLIGATORIO 3-5 obiezioni interne (paure, scuse, dubbi interiori del cliente). NON lasciare vuoto.
- externalObjections: OBBLIGATORIO 3-5 obiezioni esterne (dubbi concreti su prezzo, credibilità, funzionamento). NON lasciare vuoto.
- TUTTO scritto con il linguaggio del cliente, NON linguaggio da marketer
- Rispondi SOLO con JSON valido`;

        const step4Result = await trackedGenerateContent(ai, {
          model: GEMINI_3_MODEL,
          contents: [{ role: "user", parts: [{ text: step4Prompt }] }],
          config: { temperature: 0.5, maxOutputTokens: 8192, responseMimeType: "application/json" },
        }, { consultantId, feature: 'market-research-step4', callerRole: 'consultant' });
        const step4Usage = step4Result?.usageMetadata;
        if (step4Usage) {
          job.tokenUsage.inputTokens += step4Usage.promptTokenCount || 0;
          job.tokenUsage.outputTokens += step4Usage.candidatesTokenCount || 0;
          job.tokenUsage.totalTokens += step4Usage.totalTokenCount || 0;
        }
        const rawText = typeof step4Result.text === 'function' ? step4Result.text() : (step4Result as any).text || '';
        const parsed = parseAIJson(rawText);
        const marketResearchData = normalizeMarketResearchData(parsed);

        job.steps[3].status = 'completed';
        job.steps[3].details = 'Framework completo — 7 fasi generate';
        job.steps[3].completedAt = Date.now();

        job.status = 'completed';
        job.currentStep = 4;
        job.stepLabel = 'Completato';
        job.stepDetails = 'Deep Research completata con successo!';
        job.result = {
          data: marketResearchData,
          meta: {
            serpSnippetsCount: serpSnippets.length,
            groundingSourcesCount: groundingResult.sources.length,
            groundingQueriesUsed: groundingResult.queries,
            tokenUsage: { ...job.tokenUsage },
          },
        };

        console.log(`✅ [MARKET-RESEARCH] Job ${jobId} completed: ${serpSnippets.length} snippets, ${groundingResult.sources.length} sources, 4 AI steps`);

      } catch (error: any) {
        console.error(`❌ [MARKET-RESEARCH] Job ${jobId} failed:`, error);
        job.status = 'error';
        job.stepDetails = error.message || 'Errore sconosciuto';
        job.error = error.message;
        const runningStep = job.steps.find(s => s.status === 'running');
        if (runningStep) {
          runningStep.status = 'error';
          runningStep.details = error.message;
        }
      }
    })();

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
      });
    }
    console.error("❌ [MARKET-RESEARCH] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to start market research" });
  }
});

router.get("/ai/market-research-status/:jobId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  const job = marketResearchJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: "Job not found" });
  res.json({
    success: true,
    status: job.status,
    currentStep: job.currentStep,
    totalSteps: job.totalSteps,
    stepLabel: job.stepLabel,
    stepDetails: job.stepDetails,
    steps: job.steps,
    tokenUsage: job.tokenUsage,
    result: job.status === 'completed' ? job.result : undefined,
    error: job.status === 'error' ? job.error : undefined,
  });
});

const improveAdSchema = z.object({
  adIdea: z.string().min(1),
  niche: z.string().optional(),
  targetAudience: z.string().optional(),
  brandVoiceData: z.record(z.any()).optional(),
});

router.post("/ai/improve-ad", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    let validatedBody;
    try {
      validatedBody = improveAdSchema.parse(req.body);
    } catch (zodError: any) {
      return res.status(400).json({ success: false, error: zodError.errors?.[0]?.message || "Dati non validi" });
    }
    const { adIdea, niche, targetAudience, brandVoiceData } = validatedBody;

    let brandSection = "";
    if (brandVoiceData && Object.keys(brandVoiceData).length > 0) {
      const parts: string[] = [];
      if (brandVoiceData.businessName) parts.push(`Business: ${brandVoiceData.businessName}`);
      if (brandVoiceData.whoWeHelp) parts.push(`Target: ${brandVoiceData.whoWeHelp}`);
      if (brandVoiceData.usp) parts.push(`USP: ${brandVoiceData.usp}`);
      if (brandVoiceData.whatWeDo) parts.push(`Cosa facciamo: ${brandVoiceData.whatWeDo}`);
      if (Array.isArray(brandVoiceData.servicesOffered)) {
        parts.push(`Servizi: ${brandVoiceData.servicesOffered.map((s: any) => s.name).join(", ")}`);
      }
      if (brandVoiceData.vision) parts.push(`Vision: ${brandVoiceData.vision}`);
      if (parts.length > 0) brandSection = `\n\nCONTESTO BRAND:\n${parts.join("\n")}`;
    }

    const nicheContext = niche ? `\nNICCHIA: ${niche}` : "";
    const audienceContext = targetAudience ? `\nPUBBLICO TARGET: ${targetAudience}` : "";

    const prompt = `Sei un esperto di copywriting e advertising per social media. Il consulente ha un'idea di inserzione/post e vuole il tuo consiglio per migliorarla.

IDEA ORIGINALE DEL CONSULENTE:
"${adIdea}"${nicheContext}${audienceContext}${brandSection}

ANALIZZA l'idea e restituisci una versione migliorata. Per ogni miglioramento:
1. HOOK più forte e d'impatto (prima riga che cattura l'attenzione)
2. ANGOLO specifico e differenziante
3. STRUTTURA ottimizzata per il formato social
4. CALL TO ACTION chiara e convincente
5. SUGGERIMENTI su cosa aggiungere o togliere

Rispondi in italiano in formato JSON:
{
  "improved_ad": "Il testo completo dell'inserzione migliorata, pronta da usare",
  "hook": "L'hook migliorato (prima riga)",
  "angle": "L'angolo specifico scelto e perché",
  "improvements": ["lista di miglioramenti applicati"],
  "tips": ["suggerimenti aggiuntivi per massimizzare l'efficacia"]
}`;

    const { trackedGenerateContent, metadata, setFeature } = await getAIProvider(consultantId, "content-improve-ad");
    setFeature?.('content-improve-ad');
    const { model } = getModelWithThinking(metadata?.name);

    const result = await trackedGenerateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
      },
    } as any, { consultantId, feature: 'content-improve-ad', callerRole: 'consultant' });

    const responseText = result.response.text().trim();
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { improved_ad: responseText, hook: "", angle: "", improvements: [], tips: [] };
    }

    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("❌ [CONTENT-AI] Error improving ad:", error);
    res.status(500).json({ success: false, error: error.message || "Errore nel miglioramento" });
  }
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
        .select()
        .from(schema.consultantKnowledgeDocuments)
        .where(
          and(
            eq(schema.consultantKnowledgeDocuments.consultantId, consultantId),
            inArray(schema.consultantKnowledgeDocuments.id, validatedData.kbDocumentIds)
          )
        );
      
      // Ensure Gemini files are valid for PDFs (async, doesn't block)
      for (const doc of kbDocs) {
        if (doc.geminiFileUri && doc.fileType === 'pdf') {
          ensureGeminiFileValid(doc.id).catch((error: any) => {
            console.warn(`⚠️ [GEMINI] Failed to ensure Gemini file validity in content studio: ${error.message}`);
          });
        }
      }
      
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
      targetPlatform: validatedData.targetPlatform,
      postCategory: validatedData.postCategory,
      postSchema: validatedData.postSchema,
      schemaStructure: validatedData.schemaStructure,
      schemaLabel: validatedData.schemaLabel,
      charLimit: validatedData.charLimit,
      writingStyle: validatedData.writingStyle,
      customWritingInstructions: validatedData.customWritingInstructions,
      marketResearchProblems: validatedData.marketResearchProblems,
      marketResearchData: validatedData.marketResearchData as any,
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

// Shorten copy to fit character limits
const shortenCopySchema = z.object({
  originalCopy: z.string().min(1, "Original copy is required"),
  targetLimit: z.number().min(100, "Target limit must be at least 100"),
  platform: z.string().min(1, "Platform is required"),
});

router.post("/ai/shorten-copy", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const validatedData = shortenCopySchema.parse(req.body);
    
    console.log(`✂️ [CONTENT-AI] Shortening copy for consultant ${consultantId}: ${validatedData.originalCopy.length} chars -> ${validatedData.targetLimit} limit`);
    
    const result = await shortenCopy({
      consultantId,
      originalCopy: validatedData.originalCopy,
      targetLimit: validatedData.targetLimit,
      platform: validatedData.platform,
    });
    
    console.log(`✅ [CONTENT-AI] Shortened copy: ${result.originalLength} -> ${result.newLength} chars`);
    
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
    console.error("❌ [CONTENT-AI] Error shortening copy:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to shorten copy",
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
    
    const { trackedGenerateContent, metadata, setFeature } = await getAIProvider(consultantId, "content-suggest-levels");
    setFeature?.('content-suggest-levels');
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

    const result = await trackedGenerateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    } as any, { consultantId, feature: 'content-suggest-levels', callerRole: 'consultant' });
    
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
    
    const { trackedGenerateContent, metadata, setFeature } = await getAIProvider(consultantId, "content-suggest-niche");
    setFeature?.('content-suggest-niche');
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

    const result = await trackedGenerateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    } as any, { consultantId, feature: 'content-suggest-niche', callerRole: 'consultant' });
    
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
    
    // If parsing failed or incomplete, try to extract fields manually (handles truncated responses)
    if (!parsed.niche || !parsed.targetAudience) {
      // First try complete values, then fall back to partial extraction for truncated responses
      const nicheMatch = cleanedResponse.match(/"niche"\s*:\s*"([^"]+)"/) || 
                         cleanedResponse.match(/"niche"\s*:\s*"([^"]{10,})/);
      const targetMatch = cleanedResponse.match(/"targetAudience"\s*:\s*"([^"]+)"/) || 
                          cleanedResponse.match(/"targetAudience"\s*:\s*"([^"]{10,})/);
      
      if (nicheMatch && !parsed.niche) parsed.niche = nicheMatch[1].replace(/["\s]+$/, '');
      if (targetMatch && !parsed.targetAudience) parsed.targetAudience = targetMatch[1].replace(/["\s]+$/, '');
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

// POST /api/content/ai/suggest-market-problems - AI generates market research problems
router.post("/ai/suggest-market-problems", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { niche, targetAudience, brandVoiceData } = req.body;
    
    if (!niche && !targetAudience && (!brandVoiceData || Object.keys(brandVoiceData).length === 0)) {
      return res.status(400).json({ success: false, error: "Serve almeno una nicchia, un pubblico target o Brand Voice" });
    }
    
    const { trackedGenerateContent, metadata, setFeature } = await getAIProvider(consultantId, "content-suggest-problems");
    setFeature?.('content-suggest-problems');
    const { model } = getModelWithThinking(metadata?.name);
    
    const contextParts = [];
    if (niche) contextParts.push(`Nicchia/Settore: ${niche}`);
    if (targetAudience) contextParts.push(`Pubblico Target: ${targetAudience}`);
    
    if (brandVoiceData) {
      if (brandVoiceData.businessName) contextParts.push(`Business: ${brandVoiceData.businessName}`);
      if (brandVoiceData.businessDescription) contextParts.push(`Descrizione: ${brandVoiceData.businessDescription}`);
      if (brandVoiceData.whoWeHelp) contextParts.push(`Chi Aiutiamo: ${brandVoiceData.whoWeHelp}`);
      if (brandVoiceData.whatWeDo) contextParts.push(`Cosa Facciamo: ${brandVoiceData.whatWeDo}`);
      if (brandVoiceData.usp) contextParts.push(`USP: ${brandVoiceData.usp}`);
      if (brandVoiceData.servicesOffered?.length) {
        contextParts.push(`Servizi: ${brandVoiceData.servicesOffered.map((s: any) => s.name).filter(Boolean).join(", ")}`);
      }
    }
    
    const prompt = `Sei un esperto di ricerca di mercato e copywriting. Analizza il contesto fornito e identifica i problemi REALI, le frustrazioni e i bisogni più profondi del pubblico target.

=== CONTESTO ===
${contextParts.join("\n")}

=== ISTRUZIONI ===
1. Identifica 5-7 problemi concreti e specifici (non generici)
2. Ogni problema deve essere una frase completa che descrive una frustrazione reale
3. Usa il linguaggio che userebbe il target (non tecnico, emotivo)
4. Includi sia problemi pratici che emotivi/psicologici
5. Ordina dal più urgente/doloroso al meno

Rispondi ESCLUSIVAMENTE con questo JSON (nessun testo prima o dopo):
{"problems": ["problema 1", "problema 2", "problema 3", "problema 4", "problema 5"]}`;

    const result = await trackedGenerateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048,
      },
    } as any, { consultantId, feature: 'content-suggest-problems', callerRole: 'consultant' });
    
    const responseText = result.response.text();
    console.log("[SUGGEST-MARKET-PROBLEMS] Response:", responseText);
    
    let cleanedResponse = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ success: false, error: "AI non ha fornito una risposta valida" });
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.problems || !Array.isArray(parsed.problems) || parsed.problems.length === 0) {
      return res.status(500).json({ success: false, error: "Nessun problema identificato" });
    }
    
    return res.json({ success: true, data: { problems: parsed.problems } });
  } catch (error: any) {
    console.error("Error suggesting market problems:", error);
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
// LEAD FORM GENERATION (AI + Imagen 4)
// ============================================================

const generateLeadFormSchema = z.object({
  postId: z.string().min(1, "Post ID is required"),
  body: z.string().max(5000).optional(),
  hook: z.string().max(1000).optional(),
  cta: z.string().max(1000).optional(),
  platform: z.string().max(100).optional(),
  title: z.string().max(500).optional(),
  generateImage: z.boolean().optional().default(true),
});

async function callImagen4Api(
  apiKey: string,
  prompt: string,
  aspectRatio: string = "1.91:1"
): Promise<{ imageData: string; mimeType: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-preview-06-06:predict?key=${apiKey}`;
  
  const requestBody = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio,
      sampleCount: 1,
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[IMAGEN4] API Error: ${response.status}`, errorText);
    throw new Error(`Imagen 4 API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  if (!result.predictions || result.predictions.length === 0) {
    throw new Error("No image generated from Imagen 4 API");
  }

  return {
    imageData: result.predictions[0].bytesBase64Encoded,
    mimeType: result.predictions[0].mimeType || "image/png",
  };
}

router.post("/ai/generate-lead-form", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  const startTime = Date.now();
  try {
    const consultantId = req.user!.id;
    const validatedData = generateLeadFormSchema.parse(req.body);
    
    console.log(`📋 [LEAD-FORM] Generating lead form for post ${validatedData.postId}`);
    
    const [post] = await db.select()
      .from(schema.contentPosts)
      .where(and(
        eq(schema.contentPosts.id, validatedData.postId),
        eq(schema.contentPosts.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    const postBody = validatedData.body || post.fullCopy || post.body || "";
    const postHook = validatedData.hook || post.hook || "";
    const postCta = validatedData.cta || post.cta || "";
    const postTitle = validatedData.title || post.title || "";
    const postPlatform = validatedData.platform || post.platform || "facebook";

    const { trackedGenerateContent } = await getAIProvider(consultantId, "lead-form-generator");

    const leadFormPrompt = `Sei un esperto di Facebook Ads e Lead Generation. Devi creare il contenuto completo per un Facebook Lead Form (Modulo Interattivo / Instant Form) basato sull'inserzione fornita.

OBIETTIVO OSSESSIVO: Massimizzare i contatti REALI e filtrare i curiosi. Ogni elemento deve essere progettato per:
1. Far restare le persone nel modulo (NON farle uscire)
2. Motivare a lasciare dati VERI (email vera, telefono vero)
3. Qualificare i lead con domande strategiche
4. Creare urgenza e valore percepito

DATI DELL'INSERZIONE:
- Titolo: ${postTitle}
- Hook: ${postHook}
- Body: ${postBody}
- CTA: ${postCta}
- Piattaforma: ${postPlatform}

STRUTTURA FACEBOOK INSTANT FORM DA COMPILARE:

1. TIPO MODULO: Scegli "higher_intent" (Intenzione più elevata) — aggiunge una schermata di revisione prima dell'invio, riducendo i lead fake.

2. SCHERMATA INTRO/BENVENUTO:
   - headline: Titolo accattivante (MAX 60 caratteri) che promette un beneficio concreto
   - description: Paragrafo persuasivo (2-3 frasi) che spiega COSA riceveranno e PERCHÉ vale la pena compilare. Deve creare urgenza e valore percepito. NON ripetere il copy dell'inserzione.
   - imagePrompt: Descrizione dettagliata per generare un'immagine di sfondo professionale e coerente col messaggio. L'immagine deve trasmettere fiducia, professionalità e il valore dell'offerta. Descrivi colori, elementi, stile.

3. DOMANDE STANDARD (prefilled da Facebook):
   Per ognuna, scrivi una "motivazione" breve che appare sopra il campo per spiegare PERCHÉ serve quel dato:
   - email: motivazione (es. "Dove ti mandiamo la guida gratuita?")
   - fullName: motivazione (es. "Per personalizzare il tuo piano")
   - phoneNumber: motivazione (es. "Per fissare la call gratuita di 15 min")

4. DOMANDE PERSONALIZZATE (2-3 domande qualificanti):
   Domande strategiche che:
   - Filtrano chi è davvero interessato da chi clicca per curiosità
   - Sono coerenti con l'offerta/servizio
   - Aiutano a preparare il follow-up
   Ogni domanda ha: question, type ("short_answer" o "multiple_choice"), options (se multiple_choice)

5. PRIVACY/DISCLAIMER:
   Testo rassicurante che:
   - Spiega come verranno usati i dati
   - Rassicura sulla privacy
   - Menziona GDPR compliance
   - MAX 2 frasi

6. SCHERMATA THANK YOU:
   - headline: Messaggio di conferma entusiasta
   - description: Spiega i PROSSIMI STEP concreti (cosa succede ora, quando verranno contattati)
   - buttonText: Testo del pulsante CTA (es. "Visita il sito", "Scarica ora")
   - buttonUrl: Suggerimento URL (es. "URL_DEL_TUO_SITO")

RISPONDI IN JSON con questa struttura ESATTA:
{
  "formType": "higher_intent",
  "intro": {
    "headline": "...",
    "description": "...",
    "imagePrompt": "..."
  },
  "standardQuestions": {
    "email": { "enabled": true, "motivation": "..." },
    "fullName": { "enabled": true, "motivation": "..." },
    "phoneNumber": { "enabled": true, "motivation": "..." }
  },
  "customQuestions": [
    {
      "question": "...",
      "type": "short_answer|multiple_choice",
      "options": ["...", "..."]
    }
  ],
  "privacyDisclaimer": "...",
  "thankYou": {
    "headline": "...",
    "description": "...",
    "buttonText": "...",
    "buttonUrl": "..."
  }
}`;

    const result = await trackedGenerateContent(
      {
        contents: [{ role: "user", parts: [{ text: leadFormPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      },
      { consultantId, feature: "lead-form-generator" }
    );

    const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error("No response from AI");
    }

    let leadFormData: any;
    try {
      leadFormData = JSON.parse(responseText);
    } catch (e) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        leadFormData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    if (!leadFormData.intro || typeof leadFormData.intro !== "object") {
      leadFormData.intro = { headline: "", description: "", imagePrompt: "" };
    }
    leadFormData.intro.headline = leadFormData.intro.headline || "";
    leadFormData.intro.description = leadFormData.intro.description || "";
    
    if (!leadFormData.standardQuestions || typeof leadFormData.standardQuestions !== "object") {
      leadFormData.standardQuestions = {};
    }
    for (const field of ["email", "fullName", "phoneNumber"]) {
      if (!leadFormData.standardQuestions[field]) {
        leadFormData.standardQuestions[field] = { enabled: true, motivation: "" };
      }
    }
    
    if (!Array.isArray(leadFormData.customQuestions)) {
      leadFormData.customQuestions = [];
    }
    leadFormData.customQuestions = leadFormData.customQuestions.map((q: any) => ({
      question: q?.question || "",
      type: q?.type === "multiple_choice" ? "multiple_choice" : "short_answer",
      options: Array.isArray(q?.options) ? q.options : [],
    }));
    
    leadFormData.privacyDisclaimer = leadFormData.privacyDisclaimer || "";
    
    if (!leadFormData.thankYou || typeof leadFormData.thankYou !== "object") {
      leadFormData.thankYou = { headline: "", description: "", buttonText: "", buttonUrl: "" };
    }
    leadFormData.thankYou.headline = leadFormData.thankYou.headline || "";
    leadFormData.thankYou.description = leadFormData.thankYou.description || "";
    leadFormData.thankYou.buttonText = leadFormData.thankYou.buttonText || "";
    leadFormData.thankYou.buttonUrl = leadFormData.thankYou.buttonUrl || "";
    
    leadFormData.formType = leadFormData.formType || "higher_intent";

    console.log(`✅ [LEAD-FORM] Text content generated in ${Date.now() - startTime}ms`);

    let introBackgroundImage: string | null = null;
    if (validatedData.generateImage && leadFormData.intro?.imagePrompt) {
      try {
        const apiKey = await getGeminiApiKey(consultantId);
        if (apiKey) {
          console.log(`🖼️ [LEAD-FORM] Generating intro background image with Imagen 4...`);
          
          const { imageData, mimeType } = await callImagen4Api(
            apiKey,
            leadFormData.intro.imagePrompt + ". Professional, clean, high-quality marketing image. No text overlay.",
            "1.91:1"
          );

          const uploadsDir = path.join(process.cwd(), "uploads", "advisage", "lead-forms");
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }

          const extension = mimeType === "image/jpeg" ? "jpg" : "png";
          const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
          const filePath = path.join(uploadsDir, filename);
          
          const imageBuffer = Buffer.from(imageData, "base64");
          fs.writeFileSync(filePath, imageBuffer);
          
          introBackgroundImage = `/uploads/advisage/lead-forms/${filename}`;
          console.log(`✅ [LEAD-FORM] Background image saved: ${introBackgroundImage}`);
        }
      } catch (imgError: any) {
        console.error(`⚠️ [LEAD-FORM] Image generation failed (continuing without image):`, imgError.message);
      }
    }

    leadFormData.intro.backgroundImage = introBackgroundImage;
    leadFormData.generatedAt = new Date().toISOString();

    const existingStructured = (post.structuredContent as Record<string, unknown>) || {};
    const updatedStructured = { ...existingStructured, leadForm: leadFormData };
    
    await db.update(schema.contentPosts)
      .set({ 
        structuredContent: updatedStructured,
        updatedAt: new Date() 
      })
      .where(eq(schema.contentPosts.id, validatedData.postId));

    const totalTime = Date.now() - startTime;
    console.log(`✅ [LEAD-FORM] Complete generation finished in ${totalTime}ms`);

    res.json({
      success: true,
      data: leadFormData,
      generationTimeMs: totalTime,
    });
  } catch (error: any) {
    console.error(`❌ [LEAD-FORM] Error:`, error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
      });
    }
    const safeMessage = error.message?.includes("API")
      ? "AI generation service error. Please try again."
      : (error.message || "Failed to generate lead form");
    res.status(500).json({
      success: false,
      error: safeMessage,
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

// ============================================================
// BRAND VOICE AI GENERATOR
// ============================================================

// POST /api/content/generate-brand-voice - Generate brand voice using AI
router.post("/generate-brand-voice", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { answers } = req.body;
    
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        error: "Answers object is required"
      });
    }
    
    const { chiSei, cosaFai, perChi, comeTiDifferenzi, tono, valori } = answers;
    
    console.log(`🤖 [BRAND-VOICE-AI] Generating brand voice for consultant ${consultantId}`);
    
    const { trackedGenerateContent, metadata, setFeature } = await getAIProvider(consultantId, "brand-voice-generator");
    setFeature?.('brand-voice-generator');
    const { model } = getModelWithThinking(metadata?.name);
    
    const prompt = `Sei un esperto di brand strategy e copywriting. Devi creare una Brand Voice completa basata sulle risposte dell'utente.

=== RISPOSTE DELL'UTENTE ===

**Chi sei?** (nome, ruolo, esperienza)
${chiSei || "Non specificato"}

**Cosa fai?** (servizi/prodotti principali)
${cosaFai || "Non specificato"}

**Per chi lo fai?** (target audience)
${perChi || "Non specificato"}

**Come ti differenzi?** (USP, metodo unico)
${comeTiDifferenzi || "Non specificato"}

**Che tono vuoi usare?**
${tono || "Non specificato"}

**Valori del brand?** (cosa ti sta a cuore)
${valori || "Non specificato"}

=== ISTRUZIONI ===

Genera una Brand Voice completa con i seguenti elementi:

1. **chiSono**: Una storia professionale completa e coinvolgente in prima persona (150-250 parole). Deve raccontare chi è la persona, la sua esperienza, cosa fa e per chi. Scrivi in modo autentico e personale.

2. **brandVoice**: Una descrizione dettagliata del tono di voce da usare nei contenuti (80-150 parole). Descrivi lo stile comunicativo, il registro linguistico, come ci si rivolge al pubblico.

3. **noteForAi**: Istruzioni specifiche per l'AI che genererà i contenuti (10-15 bullet points). Include indicazioni su:
   - Stile di scrittura
   - Parole/espressioni da usare o evitare
   - Struttura dei contenuti
   - Riferimenti al metodo/approccio unico
   - Tono e personalità da mantenere

4. **keywords**: Un array di 5-10 parole chiave rilevanti per il brand che dovrebbero apparire frequentemente nei contenuti.

Rispondi ESCLUSIVAMENTE con questo JSON (nessun testo prima o dopo):
{
  "chiSono": "<storia professionale completa>",
  "brandVoice": "<descrizione del tono di voce>",
  "noteForAi": "<istruzioni bullet point per l'AI>",
  "keywords": ["parola1", "parola2", "parola3", ...]
}`;

    const result = await trackedGenerateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
      },
    } as any, { consultantId, feature: 'brand-voice-generator', callerRole: 'consultant' });
    
    const responseText = result.response.text();
    console.log("[BRAND-VOICE-AI] Model:", model);
    console.log("[BRAND-VOICE-AI] Response length:", responseText.length, "chars");
    
    // Remove markdown code blocks if present
    let cleanedResponse = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    // Try to find and parse JSON
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[BRAND-VOICE-AI] No JSON found in response");
      return res.status(500).json({
        success: false,
        error: "L'AI non ha generato una risposta valida. Riprova."
      });
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.chiSono || !parsed.brandVoice || !parsed.noteForAi || !parsed.keywords) {
        console.error("[BRAND-VOICE-AI] Missing required fields in response");
        return res.status(500).json({
          success: false,
          error: "La risposta dell'AI è incompleta. Riprova."
        });
      }
      
      // Ensure keywords is an array
      if (!Array.isArray(parsed.keywords)) {
        parsed.keywords = [];
      }
      
      console.log(`✅ [BRAND-VOICE-AI] Successfully generated brand voice using ${model}`);
      
      return res.json({
        success: true,
        data: {
          chiSono: parsed.chiSono,
          brandVoice: parsed.brandVoice,
          noteForAi: parsed.noteForAi,
          keywords: parsed.keywords
        },
        modelUsed: model
      });
    } catch (parseError) {
      console.error("[BRAND-VOICE-AI] JSON parse error:", parseError);
      return res.status(500).json({
        success: false,
        error: "Errore nel parsing della risposta AI. Riprova."
      });
    }
  } catch (error: any) {
    console.error("❌ [BRAND-VOICE-AI] Error generating brand voice:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate brand voice"
    });
  }
});

// ============================================================
// CONTENT AUTOPILOT - Batch generation with SSE progress
// ============================================================

// GET /api/content/autopilot/templates - Get all templates (system + consultant)
router.get("/autopilot/templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const templates = await db.select()
      .from(schema.autopilotTemplates)
      .where(
        or(
          eq(schema.autopilotTemplates.isDefault, true),
          eq(schema.autopilotTemplates.consultantId, consultantId)
        )
      )
      .orderBy(desc(schema.autopilotTemplates.isDefault), asc(schema.autopilotTemplates.name));
    
    res.json({ success: true, data: templates });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching autopilot templates:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch autopilot templates"
    });
  }
});

router.post("/autopilot/generate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    
    const { 
      startDate, 
      endDate, 
      platforms,
      targetPlatform,
      targetPlatforms,
      postsPerDay,
      postSchema,
      schemaStructure,
      schemaLabel,
      postCategory,
      contentTypes,
      excludeWeekends,
      excludeHolidays,
      excludedDates,
      writingStyle,
      customInstructions,
      optimalTimes,
      mediaType,
      copyType,
      awarenessLevel,
      sophisticationLevel,
      // Parameters from unified form
      niche,
      targetAudience,
      objective,
      brandVoiceData,
      kbContent,
      charLimit,
      // Flags for image generation and publishing
      autoGenerateImages,
      autoPublish,
      reviewMode,
      advisageSettings,
      // Per-day configuration
      perDayConfig,
    } = req.body;
    
    let resolvedPlatforms = platforms;
    if (!resolvedPlatforms && targetPlatforms && Array.isArray(targetPlatforms)) {
      resolvedPlatforms = {};
      for (const p of targetPlatforms) {
        resolvedPlatforms[p] = { enabled: true, postsPerDay: postsPerDay || 1 };
      }
    } else if (!resolvedPlatforms && targetPlatform) {
      resolvedPlatforms = {
        [targetPlatform]: { enabled: true, postsPerDay: postsPerDay || 1 }
      };
    }
    
    if (!startDate || !endDate || !resolvedPlatforms) {
      return res.status(400).json({ error: "Missing required fields: startDate, endDate, platforms or targetPlatforms" });
    }
    
    const config: AutopilotConfig = {
      consultantId: user.id,
      startDate,
      endDate,
      platforms: resolvedPlatforms,
      perDayConfig,
      postSchema,
      schemaStructure,
      schemaLabel,
      postCategory,
      contentTypes,
      excludeWeekends,
      excludeHolidays,
      excludedDates,
      writingStyle,
      customInstructions,
      optimalTimes,
      mediaType,
      copyType,
      awarenessLevel,
      sophisticationLevel,
      // Unified form parameters
      niche,
      targetAudience,
      objective,
      brandVoiceData,
      kbContent,
      charLimit,
      // Image generation and publishing flags
      autoGenerateImages,
      autoPublish,
      reviewMode,
      advisageSettings,
    };
    
    // Create batch record first and return batchId immediately
    const [batch] = await db.insert(schema.autopilotBatches).values({
      consultantId: user.id,
      config: config as any,
      autoGenerateImages: autoGenerateImages || false,
      autoPublish: autoPublish || false,
      reviewMode: reviewMode || false,
      advisageSettings: advisageSettings || { mood: 'professional', stylePreference: 'realistic' },
      status: "generating",
      totalPosts: 0,
      generatedPosts: 0,
      imagesGenerated: 0,
      generatedPostsDetails: [],
    }).returning({ id: schema.autopilotBatches.id });
    
    const batchId = batch?.id;
    
    if (!batchId) {
      return res.status(500).json({ error: "Failed to create batch" });
    }
    
    // Return batchId immediately, run generation in background
    res.json({ success: true, batchId });
    
    // Run generation in background (fire-and-forget)
    setImmediate(async () => {
      try {
        // Pass batchId so service uses existing batch instead of creating new one
        await generateAutopilotBatch({ ...config, existingBatchId: batchId }, null);
      } catch (error: any) {
        console.error("[AUTOPILOT BACKGROUND] Error:", error.message);
        // Update batch status to failed
        await db.update(schema.autopilotBatches)
          .set({ status: "failed", lastError: error.message, updatedAt: new Date() })
          .where(eq(schema.autopilotBatches.id, batchId));
      }
    });
  } catch (error: any) {
    console.error("[AUTOPILOT ENDPOINT] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// GET batch status for polling
router.get("/autopilot/batch/:batchId/status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    
    const { batchId } = req.params;
    
    const [batch] = await db.select()
      .from(schema.autopilotBatches)
      .where(and(
        eq(schema.autopilotBatches.id, batchId),
        eq(schema.autopilotBatches.consultantId, user.id)
      ))
      .limit(1);
    
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }
    
    res.json({
      success: true,
      data: {
        id: batch.id,
        status: batch.status,
        totalPosts: batch.totalPosts,
        generatedPosts: batch.generatedPosts,
        imagesGenerated: batch.imagesGenerated,
        totalDays: batch.totalDays,
        currentDayIndex: batch.currentDayIndex,
        processingDate: batch.processingDate,
        processingPlatform: batch.processingPlatform,
        generatedPostsDetails: batch.generatedPostsDetails || [],
        lastError: batch.lastError,
        completedAt: batch.completedAt,
      }
    });
  } catch (error: any) {
    console.error("[AUTOPILOT STATUS] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ADVISAGE AI - Ad Copy Analysis
// ============================================================

const advisageAnalysisSchema = z.object({
  text: z.string().min(5),
  platform: z.enum(['instagram', 'facebook', 'linkedin', 'tiktok']),
  mood: z.enum(['professional', 'energetic', 'luxury', 'minimalist', 'playful']),
  stylePreference: z.enum(['realistic', '3d-render', 'illustration', 'cyberpunk', 'lifestyle']),
  brandColor: z.string().optional(),
  brandFont: z.string().optional(),
  conceptTypes: z.array(z.string()).optional(),
  stylesMode: z.enum(['manual', 'auto']).optional(),
});

router.post("/advisage/analyze", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const validated = advisageAnalysisSchema.parse(req.body);
    
    console.log(`[ADVISAGE] Analysis request from ${consultantId}, conceptTypes: ${validated.conceptTypes?.join(', ') || 'auto'}`);
    
    const result = await analyzeAdTextServerSide(consultantId, validated.text, validated.platform, {
      mood: validated.mood,
      stylePreference: validated.stylePreference,
      brandColor: validated.brandColor,
      brandFont: validated.brandFont,
      conceptTypes: validated.conceptTypes,
      stylesMode: validated.stylesMode,
    });
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[ADVISAGE] Analysis error:", error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Analisi fallita" 
    });
  }
});

// ============================================================
// ADVISAGE AI - Server-side Image Generation
// ============================================================

import { analyzeAdTextServerSide, generateImageServerSide, analyzeAndGenerateImage } from "../services/advisage-server-service";

const advisageImageSchema = z.object({
  prompt: z.string().min(5),
  aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).default('1:1'),
  variant: z.enum(['text', 'clean']).default('clean'),
  hookText: z.string().optional(),
  styleType: z.string().optional(),
  promptVisual: z.any().optional(),
  visualDescription: z.string().optional(),
  originalText: z.string().optional(),
  mood: z.string().optional(),
  stylePreference: z.string().optional(),
  brandColor: z.string().optional(),
  lightingStyle: z.string().optional(),
  colorGrading: z.string().optional(),
  cameraAngle: z.string().optional(),
  backgroundStyle: z.string().optional(),
  imageQuality: z.string().optional(),
});

router.post("/advisage/generate-image-server", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const validated = advisageImageSchema.parse(req.body);
    
    console.log(`[ADVISAGE-SERVER] Richiesta generazione immagine da ${consultantId}, variante: ${validated.variant}`);
    
    const { imageUrl, error } = await generateImageServerSide(
      consultantId,
      validated.prompt,
      validated.aspectRatio,
      validated.variant,
      validated.hookText,
      validated.styleType,
      validated.promptVisual,
      validated.visualDescription,
      {
        originalText: validated.originalText,
        mood: validated.mood,
        stylePreference: validated.stylePreference,
        brandColor: validated.brandColor,
        lightingStyle: validated.lightingStyle,
        colorGrading: validated.colorGrading,
        cameraAngle: validated.cameraAngle,
        backgroundStyle: validated.backgroundStyle,
        imageQuality: validated.imageQuality,
      }
    );
    
    if (error) {
      return res.status(500).json({ success: false, error });
    }
    
    res.json({ success: true, data: { imageUrl } });
  } catch (error: any) {
    console.error("[ADVISAGE-SERVER] Endpoint error:", error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Generazione immagine fallita" 
    });
  }
});

const advisageFullPipelineSchema = z.object({
  text: z.string().min(5),
  platform: z.enum(['instagram', 'facebook', 'linkedin', 'tiktok', 'x']),
  settings: z.object({
    mood: z.enum(['professional', 'energetic', 'luxury', 'minimalist', 'playful']).default('professional'),
    stylePreference: z.enum(['realistic', '3d-render', 'illustration', 'cyberpunk', 'lifestyle']).default('realistic'),
    brandColor: z.string().optional(),
    brandFont: z.string().optional(),
  }).optional(),
});

router.post("/advisage/analyze-and-generate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const validated = advisageFullPipelineSchema.parse(req.body);
    
    console.log(`[ADVISAGE-SERVER] Full pipeline request from ${consultantId}`);
    
    const result = await analyzeAndGenerateImage(
      consultantId,
      validated.text,
      validated.platform,
      validated.settings as any
    );
    
    if (!result.analysis && result.error) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    res.json({ 
      success: true, 
      data: {
        analysis: result.analysis,
        imageUrl: result.imageUrl,
        error: result.error
      }
    });
  } catch (error: any) {
    console.error("[ADVISAGE-SERVER] Full pipeline error:", error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Pipeline AdVisage fallita" 
    });
  }
});

// ============================================================
// ADVISAGE SESSIONS - Persistence & History
// ============================================================

router.get("/advisage/sessions", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const result = await db.execute(sql`
      SELECT s.id, s.name, s.status, s.created_at, s.updated_at,
        (SELECT COUNT(*) FROM advisage_generated_images WHERE session_id = s.id) as image_count,
        jsonb_array_length(COALESCE(s.batch_results, '[]'::jsonb)) as concept_count
      FROM advisage_sessions s
      WHERE s.consultant_id = ${consultantId}
      ORDER BY s.created_at DESC
      LIMIT 50
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("[ADVISAGE-SESSIONS] List error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/advisage/sessions/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const sessionId = req.params.id;
    
    const sessionResult = await db.execute(sql`
      SELECT * FROM advisage_sessions
      WHERE id = ${sessionId} AND consultant_id = ${consultantId}
    `);
    if (!sessionResult.rows.length) {
      return res.status(404).json({ success: false, error: "Sessione non trovata" });
    }
    
    const imagesResult = await db.execute(sql`
      SELECT agi.* FROM advisage_generated_images agi
      JOIN advisage_sessions s ON s.id = agi.session_id
      WHERE agi.session_id = ${sessionId} AND s.consultant_id = ${consultantId}
      ORDER BY agi.created_at ASC
    `);
    
    res.json({ 
      success: true, 
      data: {
        session: sessionResult.rows[0],
        images: imagesResult.rows
      }
    });
  } catch (error: any) {
    console.error("[ADVISAGE-SESSIONS] Load error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/advisage/sessions", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { name, settings, batchResults, postInputs } = req.body;
    
    const result = await db.execute(sql`
      INSERT INTO advisage_sessions (consultant_id, name, settings, batch_results, post_inputs)
      VALUES (${consultantId}, ${name || null}, ${JSON.stringify(settings || {})}, ${JSON.stringify(batchResults || [])}, ${JSON.stringify(postInputs || [])})
      RETURNING id, created_at
    `);
    
    const session = result.rows[0];
    console.log(`[ADVISAGE-SESSIONS] Created session ${session.id} for consultant ${consultantId}`);
    res.json({ success: true, data: session });
  } catch (error: any) {
    console.error("[ADVISAGE-SESSIONS] Create error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/advisage/sessions/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const sessionId = req.params.id;
    const { name, settings, batchResults, postInputs, status } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    
    await db.execute(sql`
      UPDATE advisage_sessions
      SET 
        name = COALESCE(${name || null}, name),
        settings = COALESCE(${settings ? JSON.stringify(settings) : null}::jsonb, settings),
        batch_results = COALESCE(${batchResults ? JSON.stringify(batchResults) : null}::jsonb, batch_results),
        post_inputs = COALESCE(${postInputs ? JSON.stringify(postInputs) : null}::jsonb, post_inputs),
        status = COALESCE(${status || null}, status),
        updated_at = NOW()
      WHERE id = ${sessionId} AND consultant_id = ${consultantId}
    `);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[ADVISAGE-SESSIONS] Update error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/advisage/sessions/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const sessionId = req.params.id;
    
    const imagesDir = path.join(process.cwd(), "uploads", "advisage", sessionId);
    if (fs.existsSync(imagesDir)) {
      fs.rmSync(imagesDir, { recursive: true, force: true });
    }
    
    await db.execute(sql`
      DELETE FROM advisage_sessions
      WHERE id = ${sessionId} AND consultant_id = ${consultantId}
    `);
    
    console.log(`[ADVISAGE-SESSIONS] Deleted session ${sessionId}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[ADVISAGE-SESSIONS] Delete error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/advisage/sessions/:id/images", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const sessionId = req.params.id;
    const { conceptId, variant, imageBase64, settingsUsed } = req.body;
    
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: "imageBase64 richiesto" });
    }
    
    const mimeMatch = imageBase64.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
    if (!mimeMatch) {
      return res.status(400).json({ success: false, error: "Formato immagine non valido" });
    }
    
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const MAX_SIZE = 40 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({ success: false, error: "Immagine troppo grande (max 40MB)" });
    }
    
    const sessionCheck = await db.execute(sql`
      SELECT id FROM advisage_sessions
      WHERE id = ${sessionId} AND consultant_id = ${consultantId}
    `);
    if (!sessionCheck.rows.length) {
      return res.status(404).json({ success: false, error: "Sessione non trovata" });
    }
    
    const uploadsDir = path.join(process.cwd(), "uploads", "advisage", sessionId);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const ext = mimeMatch[1] === 'jpeg' || mimeMatch[1] === 'jpg' ? 'jpg' : mimeMatch[1];
    const safeConceptId = conceptId.replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${safeConceptId}-${variant || 'clean'}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fsPromises.writeFile(filePath, buffer);
    
    const imagePath = `/uploads/advisage/${sessionId}/${filename}`;
    
    const result = await db.execute(sql`
      INSERT INTO advisage_generated_images (session_id, concept_id, variant, image_path, settings_used)
      VALUES (${sessionId}, ${conceptId}, ${variant || 'clean'}, ${imagePath}, ${JSON.stringify(settingsUsed || {})})
      RETURNING id, image_path, created_at
    `);
    
    console.log(`[ADVISAGE-SESSIONS] Saved image for concept ${conceptId} in session ${sessionId}`);
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("[ADVISAGE-SESSIONS] Save image error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/advisage/save-image-file", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: "imageBase64 richiesto" });
    }
    const mimeMatch = imageBase64.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
    if (!mimeMatch) {
      return res.status(400).json({ success: false, error: "Formato immagine non valido" });
    }
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const MAX_SIZE = 40 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({ success: false, error: "Immagine troppo grande (max 40MB)" });
    }
    const uploadsDir = path.join(process.cwd(), "uploads", "advisage", "post-images");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const ext = mimeMatch[1] === 'jpeg' || mimeMatch[1] === 'jpg' ? 'jpg' : mimeMatch[1];
    const filename = `post-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fsPromises.writeFile(filePath, buffer);
    const imagePath = `/uploads/advisage/post-images/${filename}`;
    console.log(`[ADVISAGE] Saved image file: ${imagePath} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    res.json({ success: true, data: { imagePath } });
  } catch (error: any) {
    console.error("[ADVISAGE] Save image file error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// AUTOPILOT BATCHES - Review Mode Endpoints
// ============================================================

router.get("/autopilot/batches", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const batches = await db.select()
      .from(schema.autopilotBatches)
      .where(eq(schema.autopilotBatches.consultantId, consultantId))
      .orderBy(desc(schema.autopilotBatches.createdAt))
      .limit(50);
    
    res.json({ success: true, data: batches });
  } catch (error: any) {
    console.error("[AUTOPILOT-BATCH] List error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/autopilot/batches/:batchId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { batchId } = req.params;
    
    const [batch] = await db.select()
      .from(schema.autopilotBatches)
      .where(and(
        eq(schema.autopilotBatches.id, batchId),
        eq(schema.autopilotBatches.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!batch) {
      return res.status(404).json({ success: false, error: "Batch non trovato" });
    }
    
    const posts = await db.select()
      .from(schema.contentPosts)
      .where(eq(schema.contentPosts.autopilotBatchId, batchId))
      .orderBy(schema.contentPosts.scheduledAt);
    
    res.json({ success: true, data: { batch, posts } });
  } catch (error: any) {
    console.error("[AUTOPILOT-BATCH] Get error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const approveBatchSchema = z.object({
  postIds: z.array(z.string()).optional(),
  action: z.enum(['approve_all', 'reject_all', 'approve_selected']),
});

router.post("/autopilot/batches/:batchId/approve", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { batchId } = req.params;
    const validated = approveBatchSchema.parse(req.body);
    
    const [batch] = await db.select()
      .from(schema.autopilotBatches)
      .where(and(
        eq(schema.autopilotBatches.id, batchId),
        eq(schema.autopilotBatches.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!batch) {
      return res.status(404).json({ success: false, error: "Batch non trovato" });
    }
    
    let updatedCount = 0;
    
    if (validated.action === 'approve_all') {
      const result = await db.update(schema.contentPosts)
        .set({ 
          reviewStatus: 'approved', 
          reviewedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(schema.contentPosts.autopilotBatchId, batchId),
          eq(schema.contentPosts.reviewStatus, 'pending')
        ));
      updatedCount = result.rowCount || 0;
      
    } else if (validated.action === 'reject_all') {
      const result = await db.update(schema.contentPosts)
        .set({ 
          reviewStatus: 'rejected', 
          reviewedAt: new Date(),
          status: 'archived',
          updatedAt: new Date()
        })
        .where(and(
          eq(schema.contentPosts.autopilotBatchId, batchId),
          eq(schema.contentPosts.reviewStatus, 'pending')
        ));
      updatedCount = result.rowCount || 0;
      
    } else if (validated.action === 'approve_selected' && validated.postIds?.length) {
      for (const postId of validated.postIds) {
        await db.update(schema.contentPosts)
          .set({ 
            reviewStatus: 'approved', 
            reviewedAt: new Date(),
            updatedAt: new Date()
          })
          .where(and(
            eq(schema.contentPosts.id, postId),
            eq(schema.contentPosts.autopilotBatchId, batchId)
          ));
        updatedCount++;
      }
    }
    
    const approvedPosts = await db.select({ count: sql`count(*)` })
      .from(schema.contentPosts)
      .where(and(
        eq(schema.contentPosts.autopilotBatchId, batchId),
        eq(schema.contentPosts.reviewStatus, 'approved')
      ));
    
    await db.update(schema.autopilotBatches)
      .set({
        approvedPosts: Number(approvedPosts[0]?.count || 0),
        status: 'approved',
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.autopilotBatches.id, batchId));
    
    res.json({ success: true, data: { updatedCount } });
  } catch (error: any) {
    console.error("[AUTOPILOT-BATCH] Approve error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/autopilot/batches/:batchId/publish", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { batchId } = req.params;
    
    const [batch] = await db.select()
      .from(schema.autopilotBatches)
      .where(and(
        eq(schema.autopilotBatches.id, batchId),
        eq(schema.autopilotBatches.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!batch) {
      return res.status(404).json({ success: false, error: "Batch non trovato" });
    }
    
    const approvedPosts = await db.select()
      .from(schema.contentPosts)
      .where(and(
        eq(schema.contentPosts.autopilotBatchId, batchId),
        eq(schema.contentPosts.reviewStatus, 'approved'),
        eq(schema.contentPosts.status, 'scheduled')
      ));
    
    console.log(`[AUTOPILOT-BATCH] Publishing ${approvedPosts.length} approved posts from batch ${batchId}`);
    
    let publishedCount = 0;
    const errors: string[] = [];
    
    for (const post of approvedPosts) {
      try {
        publishedCount++;
      } catch (err: any) {
        errors.push(`Post ${post.id}: ${err.message}`);
      }
    }
    
    await db.update(schema.autopilotBatches)
      .set({
        publishedPosts: publishedCount,
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.autopilotBatches.id, batchId));
    
    res.json({ 
      success: true, 
      data: { 
        publishedCount,
        errors: errors.length > 0 ? errors : undefined
      } 
    });
  } catch (error: any) {
    console.error("[AUTOPILOT-BATCH] Publish error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// CONTENT TOPICS - Argomenti/Pillar per organizzare i contenuti
// ============================================================

// GET /api/content/topics - Get all topics for consultant
router.get("/topics", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { pillar, active } = req.query;
    
    let query = db.select()
      .from(schema.contentTopics)
      .where(eq(schema.contentTopics.consultantId, consultantId))
      .orderBy(desc(schema.contentTopics.updatedAt));
    
    const topics = await query;
    
    let filteredTopics = topics;
    if (pillar && typeof pillar === 'string') {
      filteredTopics = filteredTopics.filter(t => t.pillar === pillar);
    }
    if (active === 'true') {
      filteredTopics = filteredTopics.filter(t => t.isActive);
    }
    
    res.json({
      success: true,
      data: filteredTopics,
      count: filteredTopics.length
    });
  } catch (error: any) {
    console.error("[CONTENT-TOPICS] Error fetching topics:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/content/topics - Create a new topic
router.post("/topics", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { name, pillar, description, keywords, notes } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Nome argomento richiesto" });
    }
    
    const [newTopic] = await db.insert(schema.contentTopics)
      .values({
        consultantId,
        name: name.trim(),
        pillar: pillar || null,
        description: description || null,
        keywords: keywords || null,
        notes: notes || null,
      })
      .returning();
    
    console.log(`[CONTENT-TOPICS] Created topic: ${newTopic.name} (${newTopic.id})`);
    
    res.status(201).json({
      success: true,
      data: newTopic
    });
  } catch (error: any) {
    console.error("[CONTENT-TOPICS] Error creating topic:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/content/topics/:id - Update a topic
router.put("/topics/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const topicId = req.params.id;
    const { name, pillar, description, keywords, notes, isActive } = req.body;
    
    const [existingTopic] = await db.select()
      .from(schema.contentTopics)
      .where(and(
        eq(schema.contentTopics.id, topicId),
        eq(schema.contentTopics.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existingTopic) {
      return res.status(404).json({ success: false, error: "Argomento non trovato" });
    }
    
    const [updatedTopic] = await db.update(schema.contentTopics)
      .set({
        name: name !== undefined ? name.trim() : existingTopic.name,
        pillar: pillar !== undefined ? pillar : existingTopic.pillar,
        description: description !== undefined ? description : existingTopic.description,
        keywords: keywords !== undefined ? keywords : existingTopic.keywords,
        notes: notes !== undefined ? notes : existingTopic.notes,
        isActive: isActive !== undefined ? isActive : existingTopic.isActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.contentTopics.id, topicId))
      .returning();
    
    res.json({
      success: true,
      data: updatedTopic
    });
  } catch (error: any) {
    console.error("[CONTENT-TOPICS] Error updating topic:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/content/topics/:id - Delete a topic
router.delete("/topics/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const topicId = req.params.id;
    
    const [existingTopic] = await db.select()
      .from(schema.contentTopics)
      .where(and(
        eq(schema.contentTopics.id, topicId),
        eq(schema.contentTopics.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existingTopic) {
      return res.status(404).json({ success: false, error: "Argomento non trovato" });
    }
    
    await db.delete(schema.contentTopics)
      .where(eq(schema.contentTopics.id, topicId));
    
    console.log(`[CONTENT-TOPICS] Deleted topic: ${existingTopic.name} (${topicId})`);
    
    res.json({
      success: true,
      message: "Argomento eliminato"
    });
  } catch (error: any) {
    console.error("[CONTENT-TOPICS] Error deleting topic:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/content/topics/:id/mark-used - Mark topic as used (after content generation)
router.post("/topics/:id/mark-used", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const topicId = req.params.id;
    const { platform, postSchema } = req.body;
    
    const [existingTopic] = await db.select()
      .from(schema.contentTopics)
      .where(and(
        eq(schema.contentTopics.id, topicId),
        eq(schema.contentTopics.consultantId, consultantId)
      ))
      .limit(1);
    
    if (!existingTopic) {
      return res.status(404).json({ success: false, error: "Argomento non trovato" });
    }
    
    const platformsUsed = existingTopic.platformsUsed || [];
    const schemasUsed = existingTopic.schemasUsed || [];
    
    if (platform && !platformsUsed.includes(platform)) {
      platformsUsed.push(platform);
    }
    if (postSchema && !schemasUsed.includes(postSchema)) {
      schemasUsed.push(postSchema);
    }
    
    const [updatedTopic] = await db.update(schema.contentTopics)
      .set({
        lastUsedAt: new Date(),
        timesUsed: (existingTopic.timesUsed || 0) + 1,
        platformsUsed,
        schemasUsed,
        updatedAt: new Date(),
      })
      .where(eq(schema.contentTopics.id, topicId))
      .returning();
    
    console.log(`[CONTENT-TOPICS] Marked topic as used: ${updatedTopic.name} (times: ${updatedTopic.timesUsed})`);
    
    res.json({
      success: true,
      data: updatedTopic
    });
  } catch (error: any) {
    console.error("[CONTENT-TOPICS] Error marking topic as used:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/content/topics/pillars - Get unique pillars for consultant
router.get("/topics/pillars", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const topics = await db.select({ pillar: schema.contentTopics.pillar })
      .from(schema.contentTopics)
      .where(and(
        eq(schema.contentTopics.consultantId, consultantId),
        isNotNull(schema.contentTopics.pillar)
      ));
    
    const uniquePillars = [...new Set(topics.map(t => t.pillar).filter(Boolean))] as string[];
    
    res.json({
      success: true,
      data: uniquePillars
    });
  } catch (error: any) {
    console.error("[CONTENT-TOPICS] Error fetching pillars:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/content/topics/suggest - AI suggests topics based on niche/business
router.get("/topics/suggest", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { niche, count = 5 } = req.query;
    
    const [brandAsset] = await db.select()
      .from(schema.brandAssets)
      .where(eq(schema.brandAssets.consultantId, consultantId))
      .limit(1);
    
    const businessContext = brandAsset?.nicheDescription || niche || "business generico";
    
    const { trackedGenerateContent, metadata, setFeature } = await getAIProvider(consultantId, "topic-suggest");
    setFeature?.('topic-suggest');
    const { model } = getModelWithThinking(metadata?.name);
    
    const prompt = `Sei un esperto di content marketing. Genera ${count} argomenti/topic per creare contenuti social per un business nel settore: "${businessContext}".

Per ogni argomento fornisci:
- name: Nome breve dell'argomento (max 50 caratteri)
- pillar: Categoria macro (es. "Educazione", "Behind the Scenes", "Vendita", "Engagement", "Authority")
- description: Breve descrizione di cosa trattare (max 150 caratteri)
- keywords: 3-5 parole chiave correlate

Rispondi SOLO con un JSON array valido, senza spiegazioni:
[{"name": "...", "pillar": "...", "description": "...", "keywords": ["...", "..."]}]`;

    const result = await trackedGenerateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 2000 }
    } as any, { consultantId, feature: 'topic-suggest', callerRole: 'consultant' });
    
    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      return res.status(500).json({ success: false, error: "Risposta AI non valida" });
    }
    
    const suggestions = JSON.parse(jsonMatch[0]);
    
    res.json({
      success: true,
      data: suggestions
    });
  } catch (error: any) {
    console.error("[CONTENT-TOPICS] Error suggesting topics:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
