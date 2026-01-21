import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertProactiveLeadSchema, updateProactiveLeadSchema } from "@shared/schema";
import { z } from "zod";
import { processProactiveOutreach } from "../whatsapp/proactive-outreach";

const router = Router();

// Throttling: Track last run time per consultant (60s cooldown)
const lastRunByConsultant = new Map<string, number>();
const COOLDOWN_MS = 60000; // 60 seconds

// Custom validation schemas
const phoneNumberSchema = z.string().regex(/^\+\d{1,15}$/, "Phone number must start with + and contain only digits");

const statusSchema = z.enum(["pending", "contacted", "responded", "converted", "inactive"]);

// GET /api/proactive-leads - List all leads for current consultant
router.get("/proactive-leads", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = req.query.status as string | undefined;
    const source = req.query.source as string | undefined;
    
    // Validate status if provided
    if (status) {
      const statusValidation = statusSchema.safeParse(status);
      if (!statusValidation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid status. Must be one of: pending, contacted, responded, converted, inactive"
        });
      }
    }
    
    let leads = await storage.getAllProactiveLeads(consultantId, status);
    
    // Filter by source if provided
    if (source) {
      leads = leads.filter((lead: any) => lead.source === source);
    }
    
    res.json({
      success: true,
      leads: leads,
      count: leads.length
    });
  } catch (error: any) {
    console.error("❌ [PROACTIVE LEADS] Error fetching leads:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch proactive leads"
    });
  }
});

// POST /api/proactive-leads - Create new lead with validation
router.post("/proactive-leads", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    // Validate phone number format
    const phoneValidation = phoneNumberSchema.safeParse(req.body.phoneNumber);
    if (!phoneValidation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number format. Phone number must start with + and contain only digits."
      });
    }

    // ✅ CHECK FOR DUPLICATE PHONE NUMBER
    // Prevent creating duplicate leads for the same consultant+phone combination
    const existingLead = await storage.getProactiveLeadByPhone(consultantId, req.body.phoneNumber);
    if (existingLead) {
      // Log duplicate attempt to system_errors
      const { logSystemError } = await import('../services/error-logger');
      await logSystemError({
        consultantId,
        errorType: 'duplicate_lead',
        errorMessage: `Tentativo di creare lead duplicato per il numero ${req.body.phoneNumber}`,
        errorDetails: {
          phoneNumber: req.body.phoneNumber,
          existingLeadId: existingLead.id,
          existingLeadName: `${existingLead.firstName} ${existingLead.lastName}`,
          existingLeadStatus: existingLead.status,
        }
      });

      return res.status(409).json({
        success: false,
        error: `⚠️ Lead già esistente con questo numero`,
        details: {
          message: `Esiste già un lead con il numero ${req.body.phoneNumber}`,
          existingLead: {
            id: existingLead.id,
            name: `${existingLead.firstName} ${existingLead.lastName}`,
            phoneNumber: existingLead.phoneNumber,
            status: existingLead.status,
            createdAt: existingLead.createdAt,
          }
        }
      });
    }
    
    // Load campaign if campaignId is provided (for auto-population)
    let campaign = null;
    if (req.body.campaignId) {
      campaign = await storage.getCampaign(req.body.campaignId, consultantId);
      if (!campaign) {
        return res.status(400).json({
          success: false,
          error: "Invalid campaignId. The campaign does not exist or does not belong to you."
        });
      }
    }
    
    // Determine agentConfigId: from request, or from campaign, or required
    const agentConfigId = req.body.agentConfigId || campaign?.preferredAgentConfigId || null;
    if (!agentConfigId) {
      return res.status(400).json({
        success: false,
        error: "agentConfigId is required (either in request or via campaign)"
      });
    }
    
    // Validate agentConfigId exists and belongs to consultant
    const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentConfigId);
    if (!agentConfig) {
      return res.status(400).json({
        success: false,
        error: "Invalid agentConfigId. The agent configuration does not exist or does not belong to you."
      });
    }
    
    // Validate contactSchedule is in the future
    if (!req.body.contactSchedule) {
      return res.status(400).json({
        success: false,
        error: "contactSchedule is required"
      });
    }
    
    const contactSchedule = new Date(req.body.contactSchedule);
    if (isNaN(contactSchedule.getTime())) {
      return res.status(400).json({
        success: false,
        error: "contactSchedule must be a valid date/time"
      });
    }
    
    const now = new Date();
    const shouldTriggerImmediately = contactSchedule <= now;
    
    // Validate status if provided
    if (req.body.status) {
      const statusValidation = statusSchema.safeParse(req.body.status);
      if (!statusValidation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid status. Must be one of: pending, contacted, responded, converted, inactive"
        });
      }
    }
    
    // Apply default values with precedence: request > campaign > agentConfig
    const leadInfo = req.body.leadInfo || {};
    
    // Build leadInfo object, applying defaults from campaign (if exists) or agent config
    const appliedLeadInfo = {
      obiettivi: leadInfo.obiettivi?.trim() || campaign?.defaultObiettivi || agentConfig.defaultObiettivi || undefined,
      desideri: leadInfo.desideri?.trim() || campaign?.implicitDesires || agentConfig.defaultDesideri || undefined,
      uncino: leadInfo.uncino?.trim() || campaign?.hookText || agentConfig.defaultUncino || undefined,
      fonte: leadInfo.fonte?.trim() || undefined,
    };
    
    // Check if leadInfo is effectively empty (all undefined values)
    const hasLeadInfo = Object.values(appliedLeadInfo).some(val => val !== undefined);
    const finalLeadInfo = hasLeadInfo ? appliedLeadInfo : undefined;
    
    // Apply idealState default with precedence: request > campaign > agentConfig
    const appliedIdealState = req.body.idealState?.trim() || campaign?.idealStateDescription || agentConfig.defaultIdealState || undefined;
    
    // Apply leadCategory from campaign if not provided
    const appliedLeadCategory = req.body.leadCategory || campaign?.leadCategory || undefined;
    
    // Build data object for validation - MANUALLY construct to avoid undefined fields
    // ✅ Round contactSchedule to the nearest minute (remove seconds)
    const scheduleDate = new Date(req.body.contactSchedule);
    scheduleDate.setSeconds(0, 0); // Zero out seconds and milliseconds
    
    const dataToValidate: any = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phoneNumber: req.body.phoneNumber,
      agentConfigId: agentConfigId, // Use resolved agentConfigId
      contactSchedule: scheduleDate,
      contactFrequency: req.body.contactFrequency,
      consultantId,
    };
    
    // Only add leadInfo if it has values
    if (finalLeadInfo) {
      dataToValidate.leadInfo = finalLeadInfo;
    }
    
    // Only add idealState if it has a value
    if (appliedIdealState) {
      dataToValidate.idealState = appliedIdealState;
    }
    
    // Add campaignId if provided
    if (req.body.campaignId) {
      dataToValidate.campaignId = req.body.campaignId;
    }
    
    // Add leadCategory if available (from request or campaign)
    if (appliedLeadCategory) {
      dataToValidate.leadCategory = appliedLeadCategory;
    }
    
    // Add optional fields if provided
    if (req.body.status) {
      dataToValidate.status = req.body.status;
    }
    if (req.body.metadata) {
      dataToValidate.metadata = req.body.metadata;
    }
    
    // Add email and email options if provided
    if (req.body.email?.trim()) {
      dataToValidate.email = req.body.email.trim();
      dataToValidate.welcomeEmailEnabled = req.body.welcomeEmailEnabled === true;
      dataToValidate.nurturingEnabled = req.body.nurturingEnabled === true;
    }
    
    // Validate with Zod schema
    const validatedData = insertProactiveLeadSchema.parse(dataToValidate);
    
    const lead = await storage.createProactiveLead(validatedData);
    
    let immediateOutreachResult = null;
    
    if (shouldTriggerImmediately) {
      console.log(`⚡ [PROACTIVE LEADS] Lead ${lead.id} has past/present contactSchedule - triggering immediate outreach`);
      const { processSingleLeadImmediately } = await import('../whatsapp/proactive-outreach');
      immediateOutreachResult = await processSingleLeadImmediately(lead.id);
    }
    
    res.status(201).json({
      success: true,
      data: lead,
      message: shouldTriggerImmediately 
        ? (immediateOutreachResult?.success 
            ? "Lead creato e primo messaggio inviato immediatamente" 
            : `Lead creato. Outreach immediato fallito: ${immediateOutreachResult?.message}`)
        : "Proactive lead created successfully",
      immediateOutreach: immediateOutreachResult
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // Enhanced Zod error logging for easier debugging
      console.error("❌ [PROACTIVE LEADS] Zod validation failed:");
      error.errors.forEach((err, index) => {
        console.error(`   ${index + 1}. Field: ${err.path.join('.')} - ${err.message}`);
        console.error(`      Received: ${JSON.stringify(err.received)}`);
      });
      
      // Return user-friendly error with detailed validation info
      const errorMessage = error.errors.map(e => 
        `${e.path.join('.')}: ${e.message}`
      ).join('; ');
      
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${errorMessage}`,
        details: error.errors
      });
    }
    
    // Handle unique constraint violation (duplicate phone number for consultant)
    if (error.code === '23505' && error.constraint === 'proactive_leads_consultant_id_phone_number_unique') {
      return res.status(409).json({
        success: false,
        error: "A lead with this phone number already exists for your account"
      });
    }
    
    console.error("❌ [PROACTIVE LEADS] Error creating lead:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create proactive lead"
    });
  }
});

// PATCH /api/proactive-leads/:id - Update lead (verify ownership)
router.patch("/proactive-leads/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const leadId = req.params.id;
    const consultantId = req.user!.id;
    
    // Verify lead exists and belongs to consultant
    const existingLead = await storage.getProactiveLead(leadId, consultantId);
    if (!existingLead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found or access denied"
      });
    }
    
    // Validate phone number format if provided
    if (req.body.phoneNumber) {
      const phoneValidation = phoneNumberSchema.safeParse(req.body.phoneNumber);
      if (!phoneValidation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid phone number format. Phone number must start with + and contain only digits."
        });
      }
    }
    
    // Validate agentConfigId if provided
    if (req.body.agentConfigId) {
      const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, req.body.agentConfigId);
      if (!agentConfig) {
        return res.status(400).json({
          success: false,
          error: "Invalid agentConfigId. The agent configuration does not exist or does not belong to you."
        });
      }
    }
    
    // Validate contactSchedule format if provided
    if (req.body.contactSchedule) {
      const contactSchedule = new Date(req.body.contactSchedule);
      if (isNaN(contactSchedule.getTime())) {
        return res.status(400).json({
          success: false,
          error: "contactSchedule must be a valid date/time"
        });
      }
    }
    
    // Validate status if provided
    if (req.body.status) {
      const statusValidation = statusSchema.safeParse(req.body.status);
      if (!statusValidation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid status. Must be one of: pending, contacted, responded, converted, inactive"
        });
      }
    }
    
    // Build update payload manually (field-by-field) to avoid spreading empty objects
    const dataToUpdate: any = {};
    
    // Add provided fields only
    if (req.body.firstName !== undefined) dataToUpdate.firstName = req.body.firstName;
    if (req.body.lastName !== undefined) dataToUpdate.lastName = req.body.lastName;
    if (req.body.phoneNumber !== undefined) dataToUpdate.phoneNumber = req.body.phoneNumber;
    if (req.body.agentConfigId !== undefined) dataToUpdate.agentConfigId = req.body.agentConfigId;
    if (req.body.contactSchedule !== undefined) {
      // ✅ Round contactSchedule to the nearest minute (remove seconds)
      const scheduleDate = new Date(req.body.contactSchedule);
      scheduleDate.setSeconds(0, 0); // Zero out seconds and milliseconds
      dataToUpdate.contactSchedule = scheduleDate;
    }
    if (req.body.contactFrequency !== undefined) dataToUpdate.contactFrequency = req.body.contactFrequency;
    if (req.body.status !== undefined) dataToUpdate.status = req.body.status;
    if (req.body.metadata !== undefined) dataToUpdate.metadata = req.body.metadata;
    
    // Handle email and email options
    if (req.body.email !== undefined) {
      dataToUpdate.email = req.body.email?.trim() || null;
    }
    if (req.body.welcomeEmailEnabled !== undefined) {
      dataToUpdate.welcomeEmailEnabled = req.body.welcomeEmailEnabled === true;
    }
    if (req.body.nurturingEnabled !== undefined) {
      dataToUpdate.nurturingEnabled = req.body.nurturingEnabled === true;
    }
    
    // Handle leadInfo with defaults from agent config
    if (req.body.leadInfo !== undefined || req.body.agentConfigId) {
      const agentConfigId = req.body.agentConfigId || existingLead.agentConfigId;
      const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentConfigId);
      
      if (agentConfig && req.body.leadInfo) {
        const leadInfo = req.body.leadInfo;
        const appliedLeadInfo = {
          obiettivi: leadInfo.obiettivi?.trim() || agentConfig.defaultObiettivi || undefined,
          desideri: leadInfo.desideri?.trim() || agentConfig.defaultDesideri || undefined,
          uncino: leadInfo.uncino?.trim() || agentConfig.defaultUncino || undefined,
          fonte: leadInfo.fonte?.trim() || undefined,
        };
        
        // Only add leadInfo if it has actual values
        const hasLeadInfo = Object.values(appliedLeadInfo).some(val => val !== undefined);
        if (hasLeadInfo) {
          dataToUpdate.leadInfo = appliedLeadInfo;
        }
      } else if (req.body.leadInfo) {
        // No agent config, but leadInfo provided - add if not empty
        const leadInfo = req.body.leadInfo;
        const cleanLeadInfo = {
          obiettivi: leadInfo.obiettivi?.trim() || undefined,
          desideri: leadInfo.desideri?.trim() || undefined,
          uncino: leadInfo.uncino?.trim() || undefined,
          fonte: leadInfo.fonte?.trim() || undefined,
        };
        
        const hasLeadInfo = Object.values(cleanLeadInfo).some(val => val !== undefined);
        if (hasLeadInfo) {
          dataToUpdate.leadInfo = cleanLeadInfo;
        }
      }
    }
    
    // Handle idealState with defaults from agent config
    if (req.body.idealState !== undefined) {
      const agentConfigId = req.body.agentConfigId || existingLead.agentConfigId;
      const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentConfigId);
      
      const appliedIdealState = req.body.idealState?.trim() || agentConfig?.defaultIdealState || undefined;
      if (appliedIdealState) {
        dataToUpdate.idealState = appliedIdealState;
      }
    }
    
    // Validate with Zod schema
    const validatedData = updateProactiveLeadSchema.parse(dataToUpdate);
    
    const updatedLead = await storage.updateProactiveLead(leadId, consultantId, validatedData);
    
    if (!updatedLead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found after update"
      });
    }
    
    res.json({
      success: true,
      data: updatedLead,
      message: "Lead updated successfully"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // Enhanced Zod error logging for easier debugging
      console.error("❌ [PROACTIVE LEADS UPDATE] Zod validation failed:");
      error.errors.forEach((err, index) => {
        console.error(`   ${index + 1}. Field: ${err.path.join('.')} - ${err.message}`);
        console.error(`      Received: ${JSON.stringify(err.received)}`);
      });
      
      // Return user-friendly error with detailed validation info
      const errorMessage = error.errors.map(e => 
        `${e.path.join('.')}: ${e.message}`
      ).join('; ');
      
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${errorMessage}`,
        details: error.errors
      });
    }
    
    // Handle unique constraint violation
    if (error.code === '23505' && error.constraint === 'proactive_leads_consultant_id_phone_number_unique') {
      return res.status(409).json({
        success: false,
        error: "A lead with this phone number already exists for your account"
      });
    }
    
    console.error("❌ [PROACTIVE LEADS] Error updating lead:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update lead"
    });
  }
});

// DELETE /api/proactive-leads/bulk - Bulk delete leads (MUST be before /:id to avoid route conflict)
router.delete("/proactive-leads/bulk", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { ids } = req.body;

    // Validate request body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Request body must contain a non-empty 'ids' array"
      });
    }

    console.log(`🗑️ [PROACTIVE LEADS BULK DELETE] Deleting ${ids.length} leads for consultant ${consultantId}`);

    let deletedCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Delete each lead, verifying ownership
    for (const leadId of ids) {
      try {
        // Verify lead exists and belongs to consultant
        const existingLead = await storage.getProactiveLead(leadId, consultantId);
        if (!existingLead) {
          errors.push({ id: leadId, error: "Lead not found or access denied" });
          continue;
        }

        const deleted = await storage.deleteProactiveLead(leadId, consultantId);
        if (deleted) {
          deletedCount++;
        } else {
          errors.push({ id: leadId, error: "Failed to delete lead" });
        }
      } catch (err: any) {
        errors.push({ id: leadId, error: err.message || "Unknown error" });
      }
    }

    console.log(`✅ [PROACTIVE LEADS BULK DELETE] Deleted ${deletedCount}/${ids.length} leads. Errors: ${errors.length}`);

    res.json({
      success: true,
      deletedCount,
      totalRequested: ids.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `${deletedCount} lead eliminati con successo`
    });
  } catch (error: any) {
    console.error("❌ [PROACTIVE LEADS BULK DELETE] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete leads"
    });
  }
});

// POST /api/proactive-leads/bulk-nurturing - Bulk enable/disable nurturing
router.post("/proactive-leads/bulk-nurturing", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { enable, excludeStatuses = ["converted", "inactive"] } = req.body;

    if (typeof enable !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "Request body must contain 'enable' boolean"
      });
    }

    console.log(`📧 [NURTURING BULK] ${enable ? 'Enabling' : 'Disabling'} nurturing for consultant ${consultantId}`);

    // Get all leads that should be updated
    const allLeads = await storage.getAllProactiveLeads(consultantId);
    
    // Filter leads: exclude specified statuses and already in desired state
    const leadsToUpdate = allLeads.filter(lead => {
      // Exclude leads with specified statuses
      if (excludeStatuses.includes(lead.status)) return false;
      // Only update if different from desired state
      if (lead.nurturingEnabled === enable) return false;
      // For enabling, need email
      if (enable && !storage.getLeadEmail(lead)) return false;
      return true;
    });

    console.log(`📧 [NURTURING BULK] Found ${leadsToUpdate.length} leads to update`);

    let updatedCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const lead of leadsToUpdate) {
      try {
        const updateData: any = {
          nurturingEnabled: enable,
          updatedAt: new Date(),
        };
        
        // If enabling, set start date if not already set
        if (enable && !lead.nurturingStartDate) {
          updateData.nurturingStartDate = new Date();
        }

        await storage.updateProactiveLead(lead.id, consultantId, updateData);
        updatedCount++;
      } catch (err: any) {
        errors.push({ id: lead.id, error: err.message || "Unknown error" });
      }
    }

    console.log(`✅ [NURTURING BULK] Updated ${updatedCount}/${leadsToUpdate.length} leads`);

    res.json({
      success: true,
      updatedCount,
      totalEligible: leadsToUpdate.length,
      excludedStatuses: excludeStatuses,
      errors: errors.length > 0 ? errors : undefined,
      message: enable 
        ? `Nurturing attivato per ${updatedCount} lead` 
        : `Nurturing disattivato per ${updatedCount} lead`
    });
  } catch (error: any) {
    console.error("❌ [NURTURING BULK] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update nurturing"
    });
  }
});

// DELETE /api/proactive-leads/:id - Delete lead (verify ownership)
router.delete("/proactive-leads/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const leadId = req.params.id;
    const consultantId = req.user!.id;
    
    // Verify lead exists and belongs to consultant
    const existingLead = await storage.getProactiveLead(leadId, consultantId);
    if (!existingLead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found or access denied"
      });
    }
    
    const deleted = await storage.deleteProactiveLead(leadId, consultantId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Lead not found"
      });
    }
    
    res.json({
      success: true,
      message: "Lead deleted successfully"
    });
  } catch (error: any) {
    console.error("❌ [PROACTIVE LEADS] Error deleting lead:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete lead"
    });
  }
});

// PATCH /api/proactive-leads/:id/status - Update only status field
router.patch("/proactive-leads/:id/status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const leadId = req.params.id;
    const consultantId = req.user!.id;
    
    // Verify lead exists and belongs to consultant
    const existingLead = await storage.getProactiveLead(leadId, consultantId);
    if (!existingLead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found or access denied"
      });
    }
    
    // Validate status
    if (!req.body.status) {
      return res.status(400).json({
        success: false,
        error: "status field is required"
      });
    }
    
    const statusValidation = statusSchema.safeParse(req.body.status);
    if (!statusValidation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid status. Must be one of: pending, contacted, responded, converted, inactive"
      });
    }
    
    // Update only the status field
    const updatedLead = await storage.updateProactiveLead(leadId, consultantId, {
      status: req.body.status
    });
    
    if (!updatedLead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found after update"
      });
    }
    
    res.json({
      success: true,
      data: updatedLead,
      message: "Lead status updated successfully"
    });
  } catch (error: any) {
    console.error("❌ [PROACTIVE LEADS] Error updating lead status:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update lead status"
    });
  }
});

// POST /api/proactive-leads/bulk - Bulk import leads with batch validation
router.post("/proactive-leads/bulk", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    // Validate request body is an array
    if (!Array.isArray(req.body.leads)) {
      return res.status(400).json({
        success: false,
        error: "Request body must contain a 'leads' array"
      });
    }
    
    const leads = req.body.leads;
    
    if (leads.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Leads array cannot be empty"
      });
    }
    
    // Load campaign if campaignId is provided (optional)
    let campaign = null;
    const campaignId = req.body.campaignId || leads[0]?.campaignId;
    if (campaignId) {
      campaign = await storage.getCampaign(campaignId, consultantId);
      if (!campaign) {
        return res.status(400).json({
          success: false,
          error: "Invalid campaignId. The campaign does not exist or does not belong to you."
        });
      }
      console.log(`📋 [PROACTIVE LEADS BULK] Using campaign: ${campaign.campaignName} (ID: ${campaign.id})`);
    }
    
    // Determine agentConfigId: from request body, or from campaign, or from first lead
    const agentConfigId = req.body.agentConfigId || campaign?.preferredAgentConfigId || leads[0]?.agentConfigId;
    if (!agentConfigId) {
      return res.status(400).json({
        success: false,
        error: "agentConfigId is required for bulk import (provide it directly or via campaign)"
      });
    }
    
    // Fetch agent config once for all leads
    const agentConfig = await storage.getConsultantWhatsappConfig(consultantId, agentConfigId);
    if (!agentConfig) {
      return res.status(400).json({
        success: false,
        error: "Invalid agentConfigId. The agent configuration does not exist or does not belong to you."
      });
    }
    
    console.log(`📋 [PROACTIVE LEADS BULK] Processing ${leads.length} leads for consultant ${consultantId}`);
    
    const created: any[] = [];
    const errors: Array<{ row: number; phone?: string; error: string }> = [];
    const now = new Date();
    
    // Process each lead individually
    for (let i = 0; i < leads.length; i++) {
      const leadData = leads[i];
      const rowNumber = i + 1;
      
      try {
        // Validate phone number format
        const phoneValidation = phoneNumberSchema.safeParse(leadData.phoneNumber);
        if (!phoneValidation.success) {
          errors.push({
            row: rowNumber,
            phone: leadData.phoneNumber,
            error: "Invalid phone number format. Phone number must start with + and contain only digits."
          });
          continue;
        }
        
        // Validate contactSchedule is in the future
        if (!leadData.contactSchedule) {
          errors.push({
            row: rowNumber,
            phone: leadData.phoneNumber,
            error: "contactSchedule is required"
          });
          continue;
        }
        
        const contactSchedule = new Date(leadData.contactSchedule);
        if (isNaN(contactSchedule.getTime())) {
          errors.push({
            row: rowNumber,
            phone: leadData.phoneNumber,
            error: "Invalid contactSchedule date format"
          });
          continue;
        }
        
        // Validate status if provided
        if (leadData.status) {
          const statusValidation = statusSchema.safeParse(leadData.status);
          if (!statusValidation.success) {
            errors.push({
              row: rowNumber,
              phone: leadData.phoneNumber,
              error: "Invalid status. Must be one of: pending, contacted, responded, converted, inactive"
            });
            continue;
          }
        }
        
        // Ensure agentConfigId matches the resolved one (prevent cross-config imports)
        if (leadData.agentConfigId && leadData.agentConfigId !== agentConfigId) {
          errors.push({
            row: rowNumber,
            phone: leadData.phoneNumber,
            error: `agentConfigId mismatch. All leads must use the same agentConfigId: ${agentConfigId}`
          });
          continue;
        }
        
        // Apply default values with precedence: lead data > campaign > agent config
        const leadInfo = leadData.leadInfo || {};
        const appliedLeadInfo = {
          obiettivi: leadInfo.obiettivi?.trim() || campaign?.defaultObiettivi || agentConfig.defaultObiettivi || undefined,
          desideri: leadInfo.desideri?.trim() || campaign?.implicitDesires || agentConfig.defaultDesideri || undefined,
          uncino: leadInfo.uncino?.trim() || campaign?.hookText || agentConfig.defaultUncino || undefined,
          fonte: leadInfo.fonte?.trim() || undefined,
        };
        
        // Check if leadInfo is effectively empty (all undefined values)
        const hasLeadInfo = Object.values(appliedLeadInfo).some(val => val !== undefined);
        const finalLeadInfo = hasLeadInfo ? appliedLeadInfo : undefined;
        
        // Apply idealState with precedence: lead data > campaign > agent config
        const appliedIdealState = leadData.idealState?.trim() || campaign?.idealStateDescription || agentConfig.defaultIdealState || undefined;
        
        // Apply leadCategory from campaign if not provided
        const appliedLeadCategory = leadData.leadCategory || campaign?.leadCategory || undefined;
        
        // Build data object for validation
        const dataToValidate: any = {
          ...leadData,
          consultantId,
          agentConfigId,
        };
        
        // Only add leadInfo if it has values
        if (finalLeadInfo) {
          dataToValidate.leadInfo = finalLeadInfo;
        }
        
        // Only add idealState if it has a value
        if (appliedIdealState) {
          dataToValidate.idealState = appliedIdealState;
        }
        
        // Add campaignId if available
        if (campaignId) {
          dataToValidate.campaignId = campaignId;
        }
        
        // Add leadCategory if available
        if (appliedLeadCategory) {
          dataToValidate.leadCategory = appliedLeadCategory;
        }
        
        // Validate with Zod schema
        const validatedData = insertProactiveLeadSchema.parse(dataToValidate);
        
        // Create the lead
        const lead = await storage.createProactiveLead(validatedData);
        created.push(lead);
        
        console.log(`✅ [PROACTIVE LEADS BULK] Created lead ${rowNumber}: ${lead.firstName} ${lead.lastName} (${lead.phoneNumber})`);
        
      } catch (error: any) {
        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
          errors.push({
            row: rowNumber,
            phone: leadData.phoneNumber,
            error: `Validation failed: ${errorMessage}`
          });
          continue;
        }
        
        // Handle unique constraint violation (duplicate phone number)
        if (error.code === '23505' && error.constraint === 'proactive_leads_consultant_id_phone_number_unique') {
          errors.push({
            row: rowNumber,
            phone: leadData.phoneNumber,
            error: "A lead with this phone number already exists for your account"
          });
          continue;
        }
        
        // Handle other database errors
        errors.push({
          row: rowNumber,
          phone: leadData.phoneNumber,
          error: error.message || "Failed to create lead"
        });
        
        console.error(`❌ [PROACTIVE LEADS BULK] Error creating lead ${rowNumber}:`, error.message);
      }
    }
    
    const summary = {
      total: leads.length,
      successful: created.length,
      failed: errors.length
    };
    
    console.log(`📊 [PROACTIVE LEADS BULK] Completed: ${summary.successful}/${summary.total} leads created, ${summary.failed} failed`);
    
    res.status(created.length > 0 ? 200 : 400).json({
      success: created.length > 0,
      summary,
      created,
      errors
    });
    
  } catch (error: any) {
    console.error("❌ [PROACTIVE LEADS BULK] Error processing bulk import:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process bulk import"
    });
  }
});

// POST /api/proactive-leads/run - Manually trigger CRM lead import
router.post("/proactive-leads/run", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    console.log(`📥 [MANUAL IMPORT] Consultant ${consultantId} triggered manual CRM import`);
    
    // Get all active external API configs for this consultant
    const configs = await storage.getAllExternalApiConfigs(consultantId);
    const activeConfigs = configs.filter(c => c.isActive && c.pollingEnabled);
    
    if (activeConfigs.length === 0) {
      return res.json({
        success: true,
        results: [],
        message: "Nessun CRM configurato con polling attivo. Vai in Impostazioni > API Esterne per configurare un'integrazione CRM."
      });
    }
    
    // Import from all active configs
    const { LeadImportService } = await import('../services/lead-import-service');
    const importService = new LeadImportService();
    const results = [];
    
    for (const config of activeConfigs) {
      try {
        console.log(`📥 [MANUAL IMPORT] Importing from ${config.configName}...`);
        const result = await importService.importLeadsFromExternal(config, 'manual');
        results.push({
          configName: config.configName,
          ...result
        });
        console.log(`✅ [MANUAL IMPORT] ${config.configName}: ${result.imported} imported, ${result.updated} updated`);
      } catch (importError: any) {
        console.error(`❌ [MANUAL IMPORT] Error importing from ${config.configName}:`, importError.message);
        results.push({
          configName: config.configName,
          imported: 0,
          updated: 0,
          duplicated: 0,
          errored: 1,
          errors: [importError.message]
        });
      }
    }
    
    res.json({
      success: true,
      results,
      totalConfigs: activeConfigs.length
    });
    
  } catch (error: any) {
    console.error("❌ [PROACTIVE LEADS RUN] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process request"
    });
  }
});

// GET /api/proactive-leads/:id/activity-logs - Get activity log timeline for a specific lead
router.get("/proactive-leads/:id/activity-logs", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const leadId = req.params.id;
    
    // Verify lead belongs to consultant
    const lead = await storage.getProactiveLead(leadId, consultantId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found"
      });
    }
    
    // Get activity logs for this lead
    const { db } = await import('../db');
    const { proactiveLeadActivityLogs } = await import('../../shared/schema');
    const { eq, desc, and } = await import('drizzle-orm');
    
    const logs = await db
      .select()
      .from(proactiveLeadActivityLogs)
      .where(and(
        eq(proactiveLeadActivityLogs.leadId, leadId),
        eq(proactiveLeadActivityLogs.consultantId, consultantId)
      ))
      .orderBy(desc(proactiveLeadActivityLogs.createdAt))
      .limit(100);
    
    res.json({
      success: true,
      leadId,
      leadName: `${lead.firstName} ${lead.lastName}`,
      logs,
      count: logs.length
    });
    
  } catch (error: any) {
    console.error("❌ [PROACTIVE LEADS] Error fetching activity logs:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch activity logs"
    });
  }
});

// POST /api/proactive-leads/:id/trigger-now - Trigger immediate outreach for a specific lead
router.post("/proactive-leads/:id/trigger-now", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const leadId = req.params.id;
    const isDryRun = req.body.isDryRun ?? false;
    
    console.log(`🚀 [MANUAL TRIGGER] Consultant ${consultantId} triggered immediate outreach for lead ${leadId} (isDryRun: ${isDryRun})`);
    
    // Verify lead belongs to consultant
    const lead = await storage.getProactiveLead(leadId, consultantId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found"
      });
    }
    
    // Check if lead is in valid status for outreach
    if (!['pending'].includes(lead.status)) {
      return res.status(400).json({
        success: false,
        error: `Lead status "${lead.status}" non valido per outreach. Solo lead "pending" possono essere contattati manualmente.`
      });
    }

    // Import db and schema for validation and logging
    const { db } = await import('../db');
    const { proactiveLeadActivityLogs, marketingCampaigns, consultantWhatsappConfig } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');

    // VALIDATION: Check if obiettivi are configured (from lead, campaign, or agent config)
    const leadObiettivi = lead.leadInfo?.obiettivi?.trim();
    if (!leadObiettivi) {
      // Try to get from campaign or agent config
      let hasObiettivi = false;
      
      if ((lead as any).campaignId) {
        const campaign = await db.select()
          .from(marketingCampaigns)
          .where(eq(marketingCampaigns.id, (lead as any).campaignId))
          .then(rows => rows[0]);
        if (campaign?.defaultObiettivi?.trim()) {
          hasObiettivi = true;
        }
      }
      
      if (!hasObiettivi) {
        const agentConfig = await db.select()
          .from(consultantWhatsappConfig)
          .where(eq(consultantWhatsappConfig.id, lead.agentConfigId))
          .then(rows => rows[0]);
        if (agentConfig?.defaultObiettivi?.trim()) {
          hasObiettivi = true;
        }
      }
      
      if (!hasObiettivi) {
        return res.status(400).json({
          success: false,
          error: "Impossibile avviare l'outreach: gli Obiettivi non sono configurati. Modifica il lead e assegna una campagna con obiettivi, oppure inserisci gli obiettivi manualmente."
        });
      }
    }
    
    // Log manual trigger
    
    await db.insert(proactiveLeadActivityLogs).values({
      leadId: lead.id,
      consultantId: lead.consultantId,
      agentConfigId: lead.agentConfigId,
      eventType: 'manual_trigger',
      eventMessage: `Trigger manuale avviato${isDryRun ? ' (DRY RUN)' : ''}`,
      eventDetails: { 
        triggeredBy: consultantId,
        isDryRun,
        originalSchedule: lead.contactSchedule?.toISOString()
      },
      leadStatusAtEvent: lead.status,
    });
    
    // Process the lead immediately
    const result = await processProactiveOutreach(consultantId, isDryRun);
    
    res.json({
      success: true,
      message: isDryRun 
        ? `Simulazione completata per ${lead.firstName} ${lead.lastName}` 
        : `Outreach inviato a ${lead.firstName} ${lead.lastName}`,
      leadId,
      result
    });
    
  } catch (error: any) {
    console.error("❌ [MANUAL TRIGGER] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to trigger outreach"
    });
  }
});

// Rate limiting for welcome email
const welcomeEmailRateLimiter = new Map<string, number[]>();
const WELCOME_EMAIL_RATE_LIMIT = 5; // 5 per minute per lead
const WELCOME_EMAIL_RATE_WINDOW = 60000; // 1 minute

// POST /api/proactive-leads/:leadId/send-welcome-email - Send welcome email manually
router.post("/proactive-leads/:leadId/send-welcome-email", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const leadId = req.params.leadId;
    
    // Rate limiting check
    const now = Date.now();
    const key = `${consultantId}:${leadId}`;
    const timestamps = welcomeEmailRateLimiter.get(key) || [];
    const recentTimestamps = timestamps.filter(t => now - t < WELCOME_EMAIL_RATE_WINDOW);
    
    if (recentTimestamps.length >= WELCOME_EMAIL_RATE_LIMIT) {
      return res.status(429).json({
        success: false,
        error: `Limite raggiunto: massimo ${WELCOME_EMAIL_RATE_LIMIT} email al minuto per lead`
      });
    }
    
    // Get the lead
    const lead = await storage.getProactiveLead(leadId, consultantId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead non trovato"
      });
    }
    
    // Get email
    const leadEmail = storage.getLeadEmail(lead);
    if (!leadEmail) {
      return res.status(400).json({
        success: false,
        error: "Il lead non ha un indirizzo email configurato"
      });
    }
    
    // Check if already sent (unless force=true)
    const force = req.body.force === true;
    if (lead.welcomeEmailSent && !force) {
      return res.status(400).json({
        success: false,
        error: "Email di benvenuto già inviata. Usa force=true per reinviare.",
        sentAt: lead.welcomeEmailSentAt
      });
    }
    
    // Import and call the welcome email service
    const { sendProactiveLeadWelcomeEmail } = await import('../services/proactive-lead-welcome-email');
    
    // Reset welcome email status if forcing resend
    if (force && lead.welcomeEmailSent) {
      const { db } = await import('../db');
      const { proactiveLeads } = await import('../../shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      await db.update(proactiveLeads)
        .set({
          welcomeEmailSent: false,
          welcomeEmailSentAt: null,
          welcomeEmailError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(proactiveLeads.id, leadId),
            eq(proactiveLeads.consultantId, consultantId)
          )
        );
    }
    
    const result = await sendProactiveLeadWelcomeEmail({
      leadId,
      consultantId,
    });
    
    // Update rate limiter
    recentTimestamps.push(now);
    welcomeEmailRateLimiter.set(key, recentTimestamps);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Email di benvenuto inviata a ${leadEmail}`,
        leadId,
        email: leadEmail
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || "Errore nell'invio dell'email"
      });
    }
    
  } catch (error: any) {
    console.error("❌ [WELCOME EMAIL] Manual send error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Errore nell'invio dell'email di benvenuto"
    });
  }
});

export default router;
