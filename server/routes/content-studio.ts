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
  insertContentTemplateSchema
} from "@shared/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { z } from "zod";

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
// CONTENT POSTS
// ============================================================

// GET /api/content/posts - List all posts for consultant
router.get("/posts", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = req.query.status as string | undefined;
    const platform = req.query.platform as string | undefined;
    const contentType = req.query.contentType as string | undefined;
    
    const posts = await db.select()
      .from(schema.contentPosts)
      .where(eq(schema.contentPosts.consultantId, consultantId))
      .orderBy(desc(schema.contentPosts.createdAt));
    
    let filtered = posts;
    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }
    if (platform) {
      filtered = filtered.filter(p => p.platform === platform);
    }
    if (contentType) {
      filtered = filtered.filter(p => p.contentType === contentType);
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
    
    const validatedData = insertContentPostSchema.parse({
      ...req.body,
      consultantId
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
    
    res.json({
      success: true,
      data: filtered,
      count: filtered.length
    });
  } catch (error: any) {
    console.error("❌ [CONTENT-STUDIO] Error fetching calendar items:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch calendar items"
    });
  }
});

// POST /api/content/calendar - Create calendar item
router.post("/calendar", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const validatedData = insertContentCalendarSchema.parse({
      ...req.body,
      consultantId
    });
    
    const [item] = await db.insert(schema.contentCalendar)
      .values(validatedData)
      .returning();
    
    res.status(201).json({
      success: true,
      data: item,
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
    
    const validatedData = insertContentCalendarSchema.partial().parse(req.body);
    
    const [updated] = await db.update(schema.contentCalendar)
      .set(validatedData)
      .where(eq(schema.contentCalendar.id, itemId))
      .returning();
    
    res.json({
      success: true,
      data: updated,
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

export default router;
