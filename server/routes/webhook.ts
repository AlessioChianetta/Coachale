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
  type?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  source?: string;
  customFields?: Record<string, any>;
  dateAdded?: string;
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
    const source = payload.source || 'hubdigital';

    const leadInfo: {
      obiettivi?: string;
      desideri?: string;
      uncino?: string;
      fonte?: string;
      email?: string;
      companyName?: string;
      customFields?: Record<string, any>;
      dateAdded?: string;
    } = {
      fonte: source,
    };

    if (payload.email) {
      leadInfo.email = payload.email;
    }
    if (payload.companyName) {
      leadInfo.companyName = payload.companyName;
    }
    if (payload.customFields) {
      leadInfo.customFields = payload.customFields;
    }
    if (payload.dateAdded) {
      leadInfo.dateAdded = payload.dateAdded;
    }

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
