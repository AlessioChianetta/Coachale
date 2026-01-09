import { Router, type Request, type Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

function normalizePhone(phone: string | undefined): string {
  if (!phone) return '';
  
  // Remove spaces, dashes, parentheses, dots
  let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Extract just digits for analysis
  const digitsOnly = normalized.replace(/\D/g, '');
  
  console.log(`🔧 [PHONE-NORMALIZE] Input: "${phone}" -> cleaned: "${normalized}" -> digits: "${digitsOnly}"`);
  
  // Handle Italian numbers specifically
  // Italian mobile numbers: 3XX XXX XXXX (10 digits starting with 3)
  // Italian landlines: 0X XXX XXXX (9-10 digits starting with 0)
  
  // Case 1: Number starts with +1 (US prefix) but looks Italian (10 digits starting with 3)
  if (normalized.startsWith('+1') && digitsOnly.length === 11 && digitsOnly.startsWith('13')) {
    // +1 3XX XXX XXXX -> +39 3XX XXX XXXX
    const italianNumber = '+39' + digitsOnly.substring(1);
    console.log(`🔧 [PHONE-NORMALIZE] Converted +1 to +39: "${italianNumber}"`);
    return italianNumber;
  }
  
  // Case 2: Just digits starting with 3 (Italian mobile without prefix)
  if (digitsOnly.length === 10 && digitsOnly.startsWith('3')) {
    const italianNumber = '+39' + digitsOnly;
    console.log(`🔧 [PHONE-NORMALIZE] Added +39 prefix: "${italianNumber}"`);
    return italianNumber;
  }
  
  // Case 3: Digits starting with 39 followed by 3 (Italian with country code but no +)
  if (digitsOnly.length === 12 && digitsOnly.startsWith('393')) {
    const italianNumber = '+' + digitsOnly;
    console.log(`🔧 [PHONE-NORMALIZE] Added + prefix: "${italianNumber}"`);
    return italianNumber;
  }
  
  // Case 4: Number starts with 0039 (old Italian international format)
  if (digitsOnly.startsWith('0039')) {
    const italianNumber = '+39' + digitsOnly.substring(4);
    console.log(`🔧 [PHONE-NORMALIZE] Converted 0039 to +39: "${italianNumber}"`);
    return italianNumber;
  }
  
  // Case 5: Number starts with 00 followed by country code (international format)
  if (normalized.startsWith('00')) {
    const internationalNumber = '+' + digitsOnly.substring(2);
    console.log(`🔧 [PHONE-NORMALIZE] Converted 00 to +: "${internationalNumber}"`);
    return internationalNumber;
  }
  
  // Case 6: Already has + prefix, keep as is
  if (normalized.startsWith('+')) {
    console.log(`🔧 [PHONE-NORMALIZE] Already formatted: "${normalized}"`);
    return normalized;
  }
  
  // Case 7: Default - add + prefix
  const result = '+' + normalized;
  console.log(`🔧 [PHONE-NORMALIZE] Default + prefix: "${result}"`);
  return result;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

interface HubdigitalPayload {
  // Metadati Evento
  type?: string;
  locationId?: string;
  id?: string; // ID univoco contatto GHL
  
  // Dati Anagrafici
  firstName?: string;
  lastName?: string;
  name?: string;
  dateOfBirth?: string;
  
  // Dati Contatto
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  
  // Dati Aziendali
  companyName?: string;
  website?: string;
  
  // Metadati CRM
  source?: string;
  assignedTo?: string;
  dateAdded?: string;
  tags?: string[];
  customFields?: Array<{ id: string; value: any }> | Record<string, any>;
  attachments?: any[];
  
  // Privacy DND
  dnd?: boolean;
  dndSettings?: {
    SMS?: { status: string; message?: string; code?: string };
    Email?: { status: string; message?: string; code?: string };
    WhatsApp?: { status: string; message?: string; code?: string };
    Call?: { status: string; message?: string; code?: string };
    FB?: { status: string; message?: string; code?: string };
    GMB?: { status: string; message?: string; code?: string };
  };
}

router.get('/hubdigital/:secretKey/test', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is active',
  });
});

router.post('/hubdigital/:secretKey', async (req: Request, res: Response) => {
  try {
    const { secretKey } = req.params;
    const payload: HubdigitalPayload = req.body;

    console.log(`📨 [WEBHOOK] Received webhook with secretKey: ${secretKey.substring(0, 8)}...`);

    const webhookConfig = await storage.getWebhookConfigBySecret(secretKey);
    
    if (!webhookConfig) {
      console.log(`❌ [WEBHOOK] Invalid secretKey: ${secretKey.substring(0, 8)}...`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Verify provider scoping - ensure this config is for Hubdigital
    if (webhookConfig.providerName !== 'hubdigital') {
      console.log(`❌ [WEBHOOK] Provider mismatch - config is for: ${webhookConfig.providerName}`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Provider mismatch',
      });
    }

    if (!webhookConfig.isActive) {
      console.log(`⛔ [WEBHOOK] Webhook config is inactive for consultant: ${webhookConfig.consultantId}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden - Webhook is inactive',
      });
    }

    // Log event type after auth
    console.log(`📨 [WEBHOOK] Payload type: ${payload.type}`);

    if (payload.type && payload.type !== 'ContactCreate') {
      console.log(`ℹ️ [WEBHOOK] Ignoring event type: ${payload.type}`);
      return res.json({
        success: true,
        message: `Event type '${payload.type}' ignored`,
      });
    }

    // SOURCE FILTER LOGIC: If defaultSource is configured, ONLY accept leads with matching source
    // Leads with different sources are skipped and counted
    const payloadSource = payload.source || '';
    const configuredSource = webhookConfig.defaultSource || '';
    
    if (configuredSource && payloadSource !== configuredSource) {
      console.log(`⏭️ [WEBHOOK] Source filter active - Skipping lead. Expected: "${configuredSource}", Got: "${payloadSource}"`);
      
      // Increment skipped leads counter
      await storage.incrementWebhookSkippedCount(webhookConfig.id);
      
      return res.json({
        success: true,
        skipped: true,
        message: `Lead skipped: source "${payloadSource}" does not match filter "${configuredSource}"`,
        expectedSource: configuredSource,
        receivedSource: payloadSource,
      });
    }

    let firstName = payload.firstName || '';
    let lastName = payload.lastName || '';
    
    if (!firstName && !lastName && payload.name) {
      const nameParts = splitFullName(payload.name);
      firstName = nameParts.firstName;
      lastName = nameParts.lastName;
    }

    if (!firstName) {
      firstName = 'Lead';
    }

    const phoneNumber = normalizePhone(payload.phone);
    
    if (!phoneNumber) {
      console.log(`❌ [WEBHOOK] Missing phone number in payload`);
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Use the configured agent if specified, otherwise fall back to first available
    let agentConfigId = webhookConfig.agentConfigId;
    
    if (!agentConfigId) {
      // Fallback: get first available agent for this consultant
      const agents = await db.select()
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.consultantId, webhookConfig.consultantId));

      if (agents.length === 0) {
        console.log(`❌ [WEBHOOK] No WhatsApp agent configured for consultant: ${webhookConfig.consultantId}`);
        return res.status(500).json({
          success: false,
          error: 'No WhatsApp agent configured',
        });
      }
      agentConfigId = agents[0].id;
      console.log(`ℹ️ [WEBHOOK] Using fallback agent: ${agentConfigId}`);
    } else {
      console.log(`✅ [WEBHOOK] Using configured agent: ${agentConfigId}`);
    }
    // Use the source from payload (already validated if filter is active) or default to 'hubdigital'
    const source = payloadSource || 'hubdigital';

    // Fetch campaign to apply defaults (obiettivi, desideri, uncino, idealState)
    let campaign: any = null;
    if (webhookConfig.targetCampaignId) {
      const campaigns = await db.select()
        .from(schema.marketingCampaigns)
        .where(eq(schema.marketingCampaigns.id, webhookConfig.targetCampaignId));
      
      if (campaigns.length > 0) {
        campaign = campaigns[0];
        console.log(`📣 [WEBHOOK] Found campaign: ${campaign.campaignName} - applying defaults`);
      }
    }

    // Also fetch agent config for fallback defaults
    const agentConfigs = await db.select()
      .from(schema.consultantWhatsappConfig)
      .where(eq(schema.consultantWhatsappConfig.id, agentConfigId));
    const agentConfig = agentConfigs.length > 0 ? agentConfigs[0] : null;

    const leadInfo: {
      obiettivi?: string;
      desideri?: string;
      uncino?: string;
      fonte?: string;
      email?: string;
      companyName?: string;
      website?: string;
      customFields?: Array<{ id: string; value: any }> | Record<string, any>;
      dateAdded?: string;
      dateOfBirth?: string;
      // Indirizzo
      address?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      // GHL IDs
      ghlContactId?: string;
      ghlLocationId?: string;
      assignedTo?: string;
      // Tags e DND
      tags?: string[];
      dnd?: boolean;
      dndSettings?: any;
    } = {
      fonte: source,
      // Apply campaign defaults (priority: campaign > agentConfig)
      obiettivi: campaign?.defaultObiettivi || agentConfig?.defaultObiettivi || undefined,
      desideri: campaign?.implicitDesires || agentConfig?.defaultDesideri || undefined,
      uncino: campaign?.hookText || agentConfig?.defaultUncino || undefined,
    };

    // Dati contatto base
    if (payload.email) leadInfo.email = payload.email;
    if (payload.companyName) leadInfo.companyName = payload.companyName;
    if (payload.website) leadInfo.website = payload.website;
    if (payload.customFields) leadInfo.customFields = payload.customFields;
    if (payload.dateAdded) leadInfo.dateAdded = payload.dateAdded;
    if (payload.dateOfBirth) leadInfo.dateOfBirth = payload.dateOfBirth;
    
    // Indirizzo completo
    if (payload.address1) leadInfo.address = payload.address1;
    if (payload.city) leadInfo.city = payload.city;
    if (payload.state) leadInfo.state = payload.state;
    if (payload.postalCode) leadInfo.postalCode = payload.postalCode;
    if (payload.country) leadInfo.country = payload.country;
    
    // GHL IDs per riferimento
    if (payload.id) leadInfo.ghlContactId = payload.id;
    if (payload.locationId) leadInfo.ghlLocationId = payload.locationId;
    if (payload.assignedTo) leadInfo.assignedTo = payload.assignedTo;
    
    // Tags
    if (payload.tags && Array.isArray(payload.tags) && payload.tags.length > 0) {
      leadInfo.tags = payload.tags;
    }
    
    // DND (Do Not Disturb)
    if (payload.dnd !== undefined) leadInfo.dnd = payload.dnd;
    if (payload.dndSettings) leadInfo.dndSettings = payload.dndSettings;

    // Apply idealState from campaign or agent config
    const idealState = campaign?.idealStateDescription || agentConfig?.defaultIdealState || undefined;

    // Build campaign snapshot for display in proactive-leads page
    const campaignSnapshot = campaign ? {
      name: campaign.name || campaign.campaignName,
      goal: campaign.obiettivi || campaign.defaultObiettivi || campaign.name,
      obiettivi: campaign.obiettivi || campaign.defaultObiettivi,
      desideri: campaign.desideri || campaign.implicitDesires,
      uncino: campaign.uncino || campaign.hookText,
      statoIdeale: campaign.statoIdeale || campaign.idealStateDescription,
    } : undefined;

    const leadData: schema.InsertProactiveLead = {
      consultantId: webhookConfig.consultantId,
      agentConfigId: agentConfigId,
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
      leadInfo: leadInfo,
      idealState: idealState,
      contactSchedule: new Date(),
      status: 'pending',
      campaignId: webhookConfig.targetCampaignId || undefined,
      campaignSnapshot: campaignSnapshot,
    };

    console.log(`📝 [WEBHOOK] Creating proactive lead: ${firstName} ${lastName} (${phoneNumber})`);

    const lead = await storage.createProactiveLead(leadData);

    await storage.incrementWebhookLeadsCount(webhookConfig.id);

    console.log(`✅ [WEBHOOK] Lead created successfully: ${lead.id}`);

    res.json({
      success: true,
      leadId: lead.id,
    });
  } catch (error: any) {
    console.error('❌ [WEBHOOK] Error processing webhook:', error);
    
    if (error.message?.includes('duplicate') || error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Lead with this phone number already exists',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ActiveCampaign Webhook Payload Interface
interface ActiveCampaignPayload {
  // Event metadata
  type?: string; // 'subscribe', 'contact_add', 'contact_update', etc.
  date_time?: string;
  initiated_from?: string;
  initiated_by?: string;
  
  // Contact data (can be nested or flat depending on webhook type)
  contact?: {
    id?: string | number;
    email?: string;
    firstName?: string;
    lastName?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    tags?: string[];
    fieldValues?: Array<{ field: string | number; value: any }>;
    orgname?: string;
    orgid?: string | number;
  };
  
  // Flat contact data (some webhooks send data this way)
  email?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  
  // List/subscription data
  list?: string;
  
  // Additional metadata
  id?: string;
}

// ActiveCampaign Webhook Test Endpoint
router.get('/activecampaign/:secretKey/test', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'ActiveCampaign webhook endpoint is active',
    provider: 'activecampaign',
  });
});

// Helper to parse ActiveCampaign bracket notation (contact[email] -> nested object)
function parseACBracketNotation(payload: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(payload)) {
    // Check if key has bracket notation like "contact[email]" or "contact[fields][39]"
    const bracketMatch = key.match(/^([^\[]+)(\[.+\])$/);
    
    if (bracketMatch) {
      const rootKey = bracketMatch[1]; // e.g., "contact"
      const brackets = bracketMatch[2]; // e.g., "[email]" or "[fields][39]"
      
      // Extract all bracket contents
      const parts = brackets.match(/\[([^\]]*)\]/g)?.map(b => b.slice(1, -1)) || [];
      
      if (!result[rootKey]) {
        result[rootKey] = {};
      }
      
      // Navigate/create nested structure
      let current = result[rootKey];
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
      
      // Set the final value
      if (parts.length > 0) {
        current[parts[parts.length - 1]] = value;
      }
    } else {
      // No bracket notation, copy directly
      result[key] = value;
    }
  }
  
  return result;
}

// ActiveCampaign Webhook Handler
router.post('/activecampaign/:secretKey', async (req: Request, res: Response) => {
  try {
    const { secretKey } = req.params;
    const rawPayload = req.body;
    
    // Parse bracket notation into nested objects
    const payload: any = parseACBracketNotation(rawPayload);

    console.log(`📨 [AC-WEBHOOK] Received ActiveCampaign webhook with secretKey: ${secretKey.substring(0, 8)}...`);

    // Validate webhook config BEFORE logging payload data
    const webhookConfig = await storage.getWebhookConfigBySecret(secretKey);
    
    if (!webhookConfig) {
      console.log(`❌ [AC-WEBHOOK] Invalid secretKey: ${secretKey.substring(0, 8)}...`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Verify provider scoping - ensure this config is for ActiveCampaign
    if (webhookConfig.providerName !== 'activecampaign') {
      console.log(`❌ [AC-WEBHOOK] Provider mismatch - config is for: ${webhookConfig.providerName}`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Provider mismatch',
      });
    }

    if (!webhookConfig.isActive) {
      console.log(`⛔ [AC-WEBHOOK] Webhook config is inactive for consultant: ${webhookConfig.consultantId}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden - Webhook is inactive',
      });
    }

    // Now safe to log payload details (after auth)
    console.log(`📨 [AC-WEBHOOK] Payload type: ${payload.type}`);
    console.log(`📨 [AC-WEBHOOK] Parsed payload:`, JSON.stringify(payload, null, 2));

    // Accept relevant event types from ActiveCampaign
    const acceptedTypes = ['subscribe', 'contact_add', 'contact_update', undefined, ''];
    if (payload.type && !acceptedTypes.includes(payload.type.toLowerCase())) {
      console.log(`ℹ️ [AC-WEBHOOK] Ignoring event type: ${payload.type}`);
      return res.json({
        success: true,
        message: `Event type '${payload.type}' ignored`,
      });
    }

    // Extract contact data - ActiveCampaign can send data in different formats
    const contact = payload.contact || {};
    const contactFields = contact.fields || {};
    
    console.log(`📋 [AC-WEBHOOK] Contact object:`, JSON.stringify(contact, null, 2));
    console.log(`📋 [AC-WEBHOOK] Contact fields:`, JSON.stringify(contactFields, null, 2));
    
    // Get name - try multiple field variations
    let firstName = contact.firstName || contact.first_name || payload.firstName || payload.first_name || '';
    let lastName = contact.lastName || contact.last_name || payload.lastName || payload.last_name || '';
    
    if (!firstName) {
      firstName = 'Lead';
    }

    // Helper to find phone in an object by checking known field names
    const findPhoneInObject = (obj: Record<string, any>): string => {
      if (!obj) return '';
      
      // Direct phone field names
      const phoneFieldNames = ['phone', 'phone_number', 'mobile', 'cellulare', 'telefono', 'PHONE', 'MOBILE', 'CELLULARE', 'TELEFONO'];
      for (const fieldName of phoneFieldNames) {
        if (obj[fieldName]) return obj[fieldName];
      }
      
      // Check all field values for phone-like patterns (for custom fields with numeric IDs)
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.length >= 8 && value.length <= 20) {
          // Check if it looks like a phone number (contains mostly digits)
          const digits = value.replace(/\D/g, '');
          if (digits.length >= 8 && digits.length <= 15) {
            console.log(`📞 [AC-WEBHOOK] Found potential phone in field "${key}": ${value}`);
            return value;
          }
        }
      }
      
      return '';
    };

    // Get phone - try many locations
    let rawPhone = 
      contact.phone || 
      contact.phone_number ||
      contact.mobile ||
      contact.cellulare ||
      contact.telefono ||
      payload.phone || 
      payload.phone_number ||
      payload.mobile ||
      payload.cellulare ||
      payload.telefono ||
      findPhoneInObject(contactFields) ||
      findPhoneInObject(payload.fields) ||
      '';
    
    console.log(`📞 [AC-WEBHOOK] Phone search result - rawPhone: "${rawPhone}"`);
    
    const phoneNumber = normalizePhone(rawPhone);
    
    if (!phoneNumber) {
      console.log(`❌ [AC-WEBHOOK] Missing phone number in payload - tried all field variations`);
      console.log(`💡 [AC-WEBHOOK] Tip: Make sure the phone field is mapped in ActiveCampaign automation`);
      return res.status(400).json({
        success: false,
        error: 'Phone number is required. Ensure your ActiveCampaign automation includes the phone field.',
      });
    }

    // Get email
    const email = contact.email || payload.email || '';

    // Use the configured agent if specified, otherwise fall back to first available
    let agentConfigId = webhookConfig.agentConfigId;
    
    if (!agentConfigId) {
      const agents = await db.select()
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.consultantId, webhookConfig.consultantId));

      if (agents.length === 0) {
        console.log(`❌ [AC-WEBHOOK] No WhatsApp agent configured for consultant: ${webhookConfig.consultantId}`);
        return res.status(500).json({
          success: false,
          error: 'No WhatsApp agent configured',
        });
      }
      agentConfigId = agents[0].id;
      console.log(`ℹ️ [AC-WEBHOOK] Using fallback agent: ${agentConfigId}`);
    } else {
      console.log(`✅ [AC-WEBHOOK] Using configured agent: ${agentConfigId}`);
    }

    // Determine source
    const source = webhookConfig.defaultSource || 'activecampaign';

    // Fetch campaign to apply defaults
    let campaign: any = null;
    if (webhookConfig.targetCampaignId) {
      const campaigns = await db.select()
        .from(schema.marketingCampaigns)
        .where(eq(schema.marketingCampaigns.id, webhookConfig.targetCampaignId));
      
      if (campaigns.length > 0) {
        campaign = campaigns[0];
        console.log(`📣 [AC-WEBHOOK] Found campaign: ${campaign.campaignName} - applying defaults`);
      }
    }

    // Fetch agent config for fallback defaults
    const agentConfigs = await db.select()
      .from(schema.consultantWhatsappConfig)
      .where(eq(schema.consultantWhatsappConfig.id, agentConfigId));
    const agentConfig = agentConfigs.length > 0 ? agentConfigs[0] : null;

    // Build lead info
    const leadInfo: {
      obiettivi?: string;
      desideri?: string;
      uncino?: string;
      fonte?: string;
      email?: string;
      acContactId?: string;
      tags?: string[];
      customFields?: Array<{ field: string | number; value: any }>;
      companyName?: string;
      list?: string;
    } = {
      fonte: source,
      obiettivi: campaign?.defaultObiettivi || agentConfig?.defaultObiettivi || undefined,
      desideri: campaign?.implicitDesires || agentConfig?.defaultDesideri || undefined,
      uncino: campaign?.hookText || agentConfig?.defaultUncino || undefined,
    };

    // Add contact data
    if (email) leadInfo.email = email;
    if (contact.id) leadInfo.acContactId = String(contact.id);
    if (contact.tags && Array.isArray(contact.tags)) leadInfo.tags = contact.tags;
    if (contact.fieldValues) leadInfo.customFields = contact.fieldValues;
    if (contact.orgname) leadInfo.companyName = contact.orgname;
    if (payload.list) leadInfo.list = payload.list;

    // Apply idealState from campaign or agent config
    const idealState = campaign?.idealStateDescription || agentConfig?.defaultIdealState || undefined;

    // Build campaign snapshot for display in proactive-leads page
    const campaignSnapshot = campaign ? {
      name: campaign.name || campaign.campaignName,
      goal: campaign.obiettivi || campaign.defaultObiettivi || campaign.name,
      obiettivi: campaign.obiettivi || campaign.defaultObiettivi,
      desideri: campaign.desideri || campaign.implicitDesires,
      uncino: campaign.uncino || campaign.hookText,
      statoIdeale: campaign.statoIdeale || campaign.idealStateDescription,
    } : undefined;

    const leadData: schema.InsertProactiveLead = {
      consultantId: webhookConfig.consultantId,
      agentConfigId: agentConfigId,
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
      leadInfo: leadInfo,
      idealState: idealState,
      contactSchedule: new Date(),
      status: 'pending',
      campaignId: webhookConfig.targetCampaignId || undefined,
      campaignSnapshot: campaignSnapshot,
    };

    console.log(`📝 [AC-WEBHOOK] Creating proactive lead: ${firstName} ${lastName} (${phoneNumber})`);

    const lead = await storage.createProactiveLead(leadData);

    await storage.incrementWebhookLeadsCount(webhookConfig.id);

    console.log(`✅ [AC-WEBHOOK] Lead created successfully: ${lead.id}`);

    res.json({
      success: true,
      leadId: lead.id,
      message: 'Lead imported from ActiveCampaign',
    });
  } catch (error: any) {
    console.error('❌ [AC-WEBHOOK] Error processing webhook:', error);
    
    if (error.message?.includes('duplicate') || error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Lead with this phone number already exists',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
