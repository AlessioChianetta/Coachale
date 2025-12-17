import { Router, type Request, type Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

function normalizePhone(phone: string | undefined): string {
  if (!phone) return '';
  let normalized = phone.replace(/[\s\-\(\)]/g, '');
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  return normalized;
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
    console.log(`📨 [WEBHOOK] Payload type: ${payload.type}`);

    const webhookConfig = await storage.getWebhookConfigBySecret(secretKey);
    
    if (!webhookConfig) {
      console.log(`❌ [WEBHOOK] Invalid secretKey: ${secretKey.substring(0, 8)}...`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    if (!webhookConfig.isActive) {
      console.log(`⛔ [WEBHOOK] Webhook config is inactive for consultant: ${webhookConfig.consultantId}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden - Webhook is inactive',
      });
    }

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

    const leadData: schema.InsertProactiveLead = {
      consultantId: webhookConfig.consultantId,
      agentConfigId: agentConfigId,
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
      leadInfo: leadInfo,
      contactSchedule: new Date(),
      status: 'pending',
      campaignId: webhookConfig.targetCampaignId || undefined,
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

export default router;
