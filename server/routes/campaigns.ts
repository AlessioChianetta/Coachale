import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertMarketingCampaignSchema, updateMarketingCampaignSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// GET /api/campaigns - List all campaigns for current consultant
router.get("/campaigns", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const activeOnly = req.query.active === "true";
    
    const campaigns = await storage.getAllCampaigns(consultantId, activeOnly);
    
    res.json({
      success: true,
      data: campaigns,
      count: campaigns.length
    });
  } catch (error: any) {
    console.error("❌ [CAMPAIGNS] Error fetching campaigns:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch campaigns"
    });
  }
});

// POST /api/campaigns - Create new campaign
router.post("/campaigns", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    // Validate with Zod schema
    const validatedData = insertMarketingCampaignSchema.parse({
      ...req.body,
      consultantId
    });
    
    const campaign = await storage.createCampaign(validatedData);
    
    res.status(201).json({
      success: true,
      data: campaign,
      message: "Campaign created successfully"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${errorMessage}`,
        details: error.errors
      });
    }
    
    // Handle unique constraint violation (duplicate campaign name for consultant)
    if (error.code === '23505' && error.constraint === 'marketing_campaigns_consultant_id_campaign_name_unique') {
      return res.status(409).json({
        success: false,
        error: "A campaign with this name already exists. Please choose a different name."
      });
    }
    
    console.error("❌ [CAMPAIGNS] Error creating campaign:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create campaign"
    });
  }
});

// GET /api/campaigns/:id - Get campaign details
router.get("/campaigns/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const consultantId = req.user!.id;
    
    const campaign = await storage.getCampaign(campaignId, consultantId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: "Campaign not found or access denied"
      });
    }
    
    res.json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    console.error(`❌ [CAMPAIGNS] Error fetching campaign ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch campaign"
    });
  }
});

// PATCH /api/campaigns/:id - Update campaign
router.patch("/campaigns/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const consultantId = req.user!.id;
    
    // Verify campaign exists and belongs to consultant
    const existingCampaign = await storage.getCampaign(campaignId, consultantId);
    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        error: "Campaign not found or access denied"
      });
    }
    
    // Validate with Zod schema
    const validatedData = updateMarketingCampaignSchema.parse(req.body);
    
    const updatedCampaign = await storage.updateCampaign(campaignId, consultantId, validatedData);
    
    if (!updatedCampaign) {
      return res.status(404).json({
        success: false,
        error: "Campaign not found after update"
      });
    }
    
    res.json({
      success: true,
      data: updatedCampaign,
      message: "Campaign updated successfully"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${errorMessage}`,
        details: error.errors
      });
    }
    
    // Handle unique constraint violation
    if (error.code === '23505' && error.constraint === 'marketing_campaigns_consultant_id_campaign_name_unique') {
      return res.status(409).json({
        success: false,
        error: "A campaign with this name already exists. Please choose a different name."
      });
    }
    
    console.error(`❌ [CAMPAIGNS] Error updating campaign ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update campaign"
    });
  }
});

// DELETE /api/campaigns/:id - Delete campaign (soft delete if has leads)
router.delete("/campaigns/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const consultantId = req.user!.id;
    
    // Verify campaign exists and belongs to consultant
    const existingCampaign = await storage.getCampaign(campaignId, consultantId);
    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        error: "Campaign not found or access denied"
      });
    }
    
    const result = await storage.deleteCampaign(campaignId, consultantId);
    
    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        error: "Campaign not found"
      });
    }
    
    res.json({
      success: true,
      message: result.softDeleted 
        ? "Campaign has associated leads and has been archived. It will no longer appear in active campaigns."
        : "Campaign deleted successfully",
      softDeleted: result.softDeleted
    });
  } catch (error: any) {
    console.error(`❌ [CAMPAIGNS] Error deleting campaign ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete campaign"
    });
  }
});

// GET /api/campaigns/:id/analytics - Get campaign analytics
router.get("/campaigns/:id/analytics", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const consultantId = req.user!.id;
    
    const analytics = await storage.getCampaignAnalytics(campaignId, consultantId);
    
    res.json({
      success: true,
      data: analytics,
      count: analytics.length
    });
  } catch (error: any) {
    console.error(`❌ [CAMPAIGNS] Error fetching analytics for campaign ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch campaign analytics"
    });
  }
});

// GET /api/campaigns/:id/leads - Get campaign with all associated leads
router.get("/campaigns/:id/leads", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const consultantId = req.user!.id;
    
    const campaignWithLeads = await storage.getCampaignWithLeads(campaignId, consultantId);
    
    if (!campaignWithLeads) {
      return res.status(404).json({
        success: false,
        error: "Campaign not found or access denied"
      });
    }
    
    res.json({
      success: true,
      data: campaignWithLeads
    });
  } catch (error: any) {
    console.error(`❌ [CAMPAIGNS] Error fetching campaign with leads ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch campaign with leads"
    });
  }
});

export default router;
