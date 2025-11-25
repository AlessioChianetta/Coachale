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
    
    const leads = await storage.getAllProactiveLeads(consultantId, status);
    
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
    if (contactSchedule <= now) {
      return res.status(400).json({
        success: false,
        error: "contactSchedule must be a future timestamp"
      });
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
    
    // Validate with Zod schema
    const validatedData = insertProactiveLeadSchema.parse(dataToValidate);
    
    const lead = await storage.createProactiveLead(validatedData);
    
    res.status(201).json({
      success: true,
      data: lead,
      message: "Proactive lead created successfully"
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
    
    // Validate contactSchedule is in the future if provided
    if (req.body.contactSchedule) {
      const contactSchedule = new Date(req.body.contactSchedule);
      if (isNaN(contactSchedule.getTime())) {
        return res.status(400).json({
          success: false,
          error: "contactSchedule must be a valid date/time"
        });
      }
      
      const now = new Date();
      if (contactSchedule <= now) {
        return res.status(400).json({
          success: false,
          error: "contactSchedule must be a future timestamp"
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
        
        if (contactSchedule <= now) {
          errors.push({
            row: rowNumber,
            phone: leadData.phoneNumber,
            error: "contactSchedule must be a future timestamp"
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

// POST /api/proactive-leads/run - Manually trigger proactive outreach process
router.post("/proactive-leads/run", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    // Throttling check: prevent spam (60s cooldown per consultant)
    const now = Date.now();
    const lastRun = lastRunByConsultant.get(consultantId);
    
    if (lastRun && (now - lastRun) < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - lastRun)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Devi aspettare ${remainingSeconds} secondi prima di eseguire nuovamente`,
        remainingSeconds
      });
    }
    
    console.log(`🚀 [MANUAL TRIGGER] Proactive outreach triggered by consultant ${consultantId}`);
    
    // Update last run timestamp
    lastRunByConsultant.set(consultantId, now);
    
    // Run the proactive outreach process
    const startedAt = new Date();
    
    // Run async without blocking response
    processProactiveOutreach()
      .then(() => {
        console.log(`✅ [MANUAL TRIGGER] Proactive outreach completed successfully`);
      })
      .catch((error) => {
        console.error(`❌ [MANUAL TRIGGER] Proactive outreach failed:`, error);
      });
    
    // Respond immediately
    res.json({
      success: true,
      message: "Processo di outreach proattivo avviato",
      startedAt: startedAt.toISOString()
    });
    
  } catch (error: any) {
    console.error("❌ [PROACTIVE LEADS RUN] Error triggering proactive outreach:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to trigger proactive outreach"
    });
  }
});

export default router;
