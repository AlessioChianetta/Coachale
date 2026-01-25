// PROACTIVE OUTREACH - Responsabilità UNICA: Primo messaggio di apertura
// I follow-up dopo il primo contatto sono gestiti dal followup-scheduler
// (server/cron/followup-scheduler.ts)

import cron from 'node-cron';
import { db } from '../db';
import { 
  proactiveLeads, 
  users, 
  consultantWhatsappConfig, 
  whatsappConversations, 
  whatsappMessages,
  proactiveLeadActivityLogs,
  conversationStates
} from '../../shared/schema';
import { eq, lte, and } from 'drizzle-orm';
import { 
  buildOpeningTemplateVariables
} from './proactive-message-builder';
import { sendWhatsAppMessage } from './twilio-client';
import { findOrCreateConversation, normalizePhoneNumber } from './webhook-handler';
import { storage } from '../storage';
import { checkTemplateApprovalStatus } from '../services/whatsapp/template-approval-checker';
import { sendProactiveLeadWelcomeEmail } from '../services/proactive-lead-welcome-email';

let schedulerTask: cron.ScheduledTask | null = null;

// Lock to prevent concurrent execution (race condition protection)
let isProcessingOutreach = false;

// Set to track leads currently being processed (to avoid duplicates within same cycle)
const processingLeadIds = new Set<string>();

/**
 * Helper function to log lead activity to the database
 */
async function logLeadActivity(
  leadId: string,
  consultantId: string,
  agentConfigId: string,
  eventType: string,
  eventMessage: string,
  eventDetails: any = {},
  leadStatusAtEvent?: string
) {
  try {
    await db.insert(proactiveLeadActivityLogs).values({
      leadId,
      consultantId,
      agentConfigId,
      eventType: eventType as any,
      eventMessage,
      eventDetails,
      leadStatusAtEvent: leadStatusAtEvent as any,
    });
    console.log(`📝 [ACTIVITY LOG] ${eventType}: ${eventMessage}`);
  } catch (error) {
    console.error(`❌ [ACTIVITY LOG] Failed to save log:`, error);
  }
}

/**
 * Replace template variables {{1}}, {{2}}, etc. with actual values
 */
function replaceTemplateVariables(
  templateText: string, 
  variables: Record<string, string>
): string {
  let result = templateText;
  
  // Replace each variable {{1}}, {{2}}, etc.
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  
  return result;
}

/**
 * Check if current time is within working hours
 */
function isWithinWorkingHours(config: any): boolean {
  if (!config.workingHoursEnabled) {
    return true; // Always available if working hours not enabled
  }

  if (!config.workingHoursStart || !config.workingHoursEnd || !config.workingDays) {
    return true; // If not configured, assume always available
  }

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];

  // Check if current day is in working days
  if (!config.workingDays.includes(currentDay)) {
    return false;
  }

  // Parse time strings (format: "HH:mm")
  const [startHour, startMin] = config.workingHoursStart.split(':').map(Number);
  const [endHour, endMin] = config.workingHoursEnd.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * DEPRECATED: Moved to shared service module
 * @see server/services/whatsapp/template-approval-checker.ts
 */
async function checkTemplateApprovalStatus_OLD(
  twilioAccountSid: string,
  twilioAuthToken: string,
  contentSid: string
): Promise<{ approved: boolean; status: string; reason?: string }> {
  try {
    const twilio = (await import('twilio')).default;
    const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    
    // STRATEGY 1: Fetch template content details from Twilio Content API
    console.log(`🔍 [TEMPLATE VALIDATION] Fetching content details for ${contentSid}...`);
    const content = await twilioClient.content.v1.contents(contentSid).fetch();
    
    // 🔥 DEBUG: Log the FULL API response to understand structure
    console.log(`📋 [API RESPONSE] Full content object keys: ${Object.keys(content).join(', ')}`);
    console.log(`📋 [API RESPONSE] approvalRequests type: ${typeof content.approvalRequests}`);
    
    if (content.approvalRequests) {
      console.log(`📋 [API RESPONSE] approvalRequests keys: ${Object.keys(content.approvalRequests as any).join(', ')}`);
      const approvalReq = content.approvalRequests as any;
      if (approvalReq.whatsapp) {
        console.log(`📋 [API RESPONSE] whatsapp approval object:`, JSON.stringify(approvalReq.whatsapp, null, 2));
      }
    }
    
    if (content.types) {
      console.log(`📋 [API RESPONSE] types keys: ${Object.keys(content.types).join(', ')}`);
    }
    
    let approvalStatus: string | null = null;
    let rejectionReason: string | undefined;
    
    // PATH 1: Try content.approvalRequests.whatsapp.status (most common)
    const approvalRequests = content.approvalRequests as any;
    if (approvalRequests?.whatsapp?.status) {
      approvalStatus = approvalRequests.whatsapp.status;
      rejectionReason = approvalRequests.whatsapp.rejection_reason;
      console.log(`✅ [PATH 1] Found status via approvalRequests.whatsapp.status: ${approvalStatus}`);
    }
    
    // PATH 2: Try content.types['twilio/whatsapp'] structure
    if (!approvalStatus && content.types) {
      const types = content.types as any;
      if (types['twilio/whatsapp']?.approval?.status) {
        approvalStatus = types['twilio/whatsapp'].approval.status;
        console.log(`✅ [PATH 2] Found status via types['twilio/whatsapp'].approval.status: ${approvalStatus}`);
      } else if (types['twilio/whatsapp']?.status) {
        approvalStatus = types['twilio/whatsapp'].status;
        console.log(`✅ [PATH 2] Found status via types['twilio/whatsapp'].status: ${approvalStatus}`);
      }
    }
    
    // PATH 3: Try fetching from separate ApprovalRequests endpoint
    if (!approvalStatus) {
      try {
        console.log(`🔄 [PATH 3] Trying separate ApprovalRequests endpoint...`);
        const approvalFetch = await twilioClient.content.v1
          .contents(contentSid)
          .approvalFetch()
          .fetch();
        
        console.log(`📋 [PATH 3 RESPONSE] Full approval object:`, JSON.stringify(approvalFetch, null, 2));
        
        const approvalData = approvalFetch as any;
        if (approvalData.whatsapp?.status) {
          approvalStatus = approvalData.whatsapp.status;
          rejectionReason = approvalData.whatsapp.rejection_reason;
          console.log(`✅ [PATH 3] Found status via ApprovalRequests endpoint: ${approvalStatus}`);
        }
      } catch (approvalError: any) {
        console.warn(`⚠️  [PATH 3] ApprovalRequests endpoint failed: ${approvalError.message}`);
      }
    }
    
    // PATH 4: Check if template has never been submitted for approval
    if (!approvalStatus) {
      // If no approval info exists at all, template might not be submitted yet
      console.warn(`⚠️  [PATH 4] No approval status found in any path - template may not be submitted for approval`);
      approvalStatus = 'not_submitted';
    }
    
    console.log(`🎯 [FINAL STATUS] Template ${contentSid} status: ${approvalStatus}`);
    
    // Interpret the status
    // Possible values: 'approved', 'pending', 'received', 'rejected', 'paused', 'disabled'
    if (approvalStatus === 'approved') {
      return { approved: true, status: 'approved' };
    } else if (approvalStatus === 'pending' || approvalStatus === 'received') {
      // 'received' means Twilio received it and is forwarding to WhatsApp
      return { 
        approved: false, 
        status: approvalStatus,
        reason: 'Template è in attesa di approvazione WhatsApp. Controlla Twilio Console per lo status.' 
      };
    } else if (approvalStatus === 'rejected') {
      return { 
        approved: false, 
        status: 'rejected',
        reason: `Template rifiutato da WhatsApp. Motivo: ${rejectionReason || 'Nessun motivo fornito'}` 
      };
    } else if (approvalStatus === 'paused') {
      return { 
        approved: false, 
        status: 'paused',
        reason: 'Template in pausa (feedback negativo utenti) e non può essere usato' 
      };
    } else if (approvalStatus === 'disabled') {
      return { 
        approved: false, 
        status: 'disabled',
        reason: 'Template disabilitato da WhatsApp per violazioni ripetute' 
      };
    } else if (approvalStatus === 'not_submitted') {
      return { 
        approved: false, 
        status: 'not_submitted',
        reason: 'Template non ancora inviato per approvazione. Vai su Twilio Console e invia per approvazione.' 
      };
    } else {
      return { 
        approved: false, 
        status: approvalStatus || 'unknown',
        reason: `Status template sconosciuto: ${approvalStatus || 'unknown'}. Controlla Twilio Console manualmente.` 
      };
    }
  } catch (error: any) {
    console.error(`❌ [TEMPLATE VALIDATION ERROR] ${error.message}`);
    // Don't log full error object - may contain sensitive credentials
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    // If we can't check, assume not approved for safety
    return { 
      approved: false, 
      status: 'error',
      reason: `Errore nel verificare status template: ${error.message}` 
    };
  }
}

/**
 * Process a single lead: send message and update database
 */
async function processLead(
  lead: typeof proactiveLeads.$inferSelect,
  consultant: typeof users.$inferSelect,
  agentConfig: typeof consultantWhatsappConfig.$inferSelect
): Promise<void> {
  try {
    console.log(`📤 Processing lead: ${lead.firstName} ${lead.lastName} (${lead.phoneNumber})`);

    await logLeadActivity(
      lead.id,
      lead.consultantId,
      lead.agentConfigId,
      'processing',
      `Inizio elaborazione lead ${lead.firstName} ${lead.lastName}`,
      { phoneNumber: lead.phoneNumber },
      lead.status
    );

    // Check working hours
    if (!isWithinWorkingHours(agentConfig)) {
      console.log(`⏰ Skipping lead ${lead.id} - outside working hours`);
      await logLeadActivity(
        lead.id,
        lead.consultantId,
        lead.agentConfigId,
        'skipped',
        'Fuori orario lavorativo - lead non processato',
        { skipReason: 'working_hours' },
        lead.status
      );
      return;
    }

    // Load campaign if associated (for template override)
    let campaign = null;
    if (lead.campaignId) {
      campaign = await storage.getCampaign(lead.campaignId, consultant.id);
      if (campaign) {
        console.log(`\n📋 [CAMPAIGN INFO] Lead associated with campaign`);
        console.log(`   Campaign ID: ${campaign.id}`);
        console.log(`   Campaign Name: ${campaign.campaignName}`);
        console.log(`   Campaign Type: ${campaign.campaignType}`);
        console.log(`   Is Active: ${campaign.isActive}`);
        console.log(`   Lead Category: ${lead.leadCategory || 'N/A'}`);
        
        // Log campaign defaults
        console.log(`   Campaign Defaults:`);
        console.log(`     - Obiettivi: ${campaign.defaultObiettivi || 'NOT SET'}`);
        console.log(`     - Desideri: ${campaign.defaultDesideri || 'NOT SET'}`);
        console.log(`     - Uncino: ${campaign.defaultUncino || 'NOT SET'}`);
        console.log(`     - Stato Ideale: ${campaign.defaultIdealState || 'NOT SET'}`);
        
        // Log campaign template assignments
        console.log(`   Campaign Template Overrides:`);
        console.log(`     - Opening Template: ${campaign.openingTemplateId || 'NOT SET (using agent default)'}`);
        console.log(`     - Gentle Follow-up: ${campaign.followupGentleTemplateId || 'NOT SET (using agent default)'}`);
        console.log(`     - Value Follow-up: ${campaign.followupValueTemplateId || 'NOT SET (using agent default)'}`);
        console.log(`     - Final Follow-up: ${campaign.followupFinalTemplateId || 'NOT SET (using agent default)'}\n`);
      } else {
        console.log(`⚠️  Campaign ID ${lead.campaignId} not found or not accessible for consultant ${consultant.id}`);
      }
    } else {
      console.log(`ℹ️  Lead ${lead.id} has no campaign association - using agent defaults only`);
    }

    // VALIDATION: Check if obiettivi are configured (from lead, campaign, or agent config)
    const leadObiettivi = lead.leadInfo?.obiettivi?.trim();
    const campaignObiettivi = campaign?.defaultObiettivi?.trim();
    const agentObiettivi = agentConfig.defaultObiettivi?.trim();
    
    if (!leadObiettivi && !campaignObiettivi && !agentObiettivi) {
      console.log(`❌ [OBIETTIVI MISSING] Skipping lead ${lead.id} - no obiettivi configured`);
      await logLeadActivity(
        lead.id,
        lead.consultantId,
        lead.agentConfigId,
        'skipped',
        'Obiettivi non configurati - impossibile procedere con outreach',
        { skipReason: 'missing_obiettivi', leadHasObiettivi: !!leadObiettivi, campaignHasObiettivi: !!campaignObiettivi, agentHasObiettivi: !!agentObiettivi },
        lead.status
      );
      return;
    }
    console.log(`✅ [OBIETTIVI CHECK] Lead has obiettivi: ${leadObiettivi ? 'from lead' : campaignObiettivi ? 'from campaign' : 'from agent config'}`);

    // Check if WhatsApp templates are configured
    // Precedence: campaign templates > agent config templates
    const agentTemplates = agentConfig.whatsappTemplates as {
      openingMessageContentSid?: string;
      followUpGentleContentSid?: string;
      followUpValueContentSid?: string;
      followUpFinalContentSid?: string;
    } | null;

    console.log(`\n🎯 [TEMPLATE PRECEDENCE] Resolving opening template assignment`);
    console.log(`   Agent Template (default): ${agentTemplates?.openingMessageContentSid || 'NOT SET'}`);
    
    if (campaign) {
      console.log(`   Campaign Template (override): ${campaign.openingTemplateId || 'NOT SET'}`);
    }

    const openingTemplateContentSid = campaign?.openingTemplateId || agentTemplates?.openingMessageContentSid;
    
    console.log(`   Final Opening Template: ${openingTemplateContentSid || 'NOT SET'}\n`);

    const consultantInfo = {
      id: consultant.id,
      firstName: consultant.firstName,
      lastName: consultant.lastName
    };

    const agentInfo = {
      id: agentConfig.id,
      agentName: agentConfig.agentName || `${consultant.firstName} ${consultant.lastName}`,
      consultantDisplayName: agentConfig.consultantDisplayName,
      businessName: agentConfig.businessName
    };

    // PROACTIVE OUTREACH: Solo primo messaggio di apertura (status = 'pending')
    // I follow-up sono gestiti dal followup-scheduler
    const messageType = 'opening';
    const contentSid = openingTemplateContentSid;
    
    // STRICT VALIDATION: Template MUST be assigned
    if (!contentSid) {
      console.error(`❌ [PROACTIVE OUTREACH] Template validation failed - SKIPPING LEAD`);
      console.error(`   Agent ID: ${agentConfig.id}`);
      console.error(`   Agent Name: ${agentConfig.agentName}`);
      console.error(`   Lead ID: ${lead.id}`);
      console.error(`   Lead Name: ${lead.firstName} ${lead.lastName}`);
      console.error(`   Message Type: ${messageType}`);
      console.error(`   Reason: No template assigned in "Assegnazione Template agli Agenti"`);
      console.error(`   Action: Lead skipped, no message sent`);
      await logLeadActivity(
        lead.id,
        lead.consultantId,
        lead.agentConfigId,
        'skipped',
        'Template di apertura non assegnato',
        { skipReason: 'no_opening_template', messageType: 'opening' },
        lead.status
      );
      return;
    }
    
    const contentVariables = buildOpeningTemplateVariables(lead, consultantInfo, agentInfo);
    const message = `TEMPLATE:${contentSid}`;

    // Detailed logging before sending
    console.log(`\n📋 [PROACTIVE OUTREACH] Sending template message:`);
    console.log(`   Agent ID: ${agentConfig.id}`);
    console.log(`   Agent Name: ${agentConfig.agentName}`);
    console.log(`   Template SID: ${contentSid}`);
    console.log(`   Message Type: ${messageType}`);
    console.log(`   Lead ID: ${lead.id}`);
    console.log(`   Lead Name: ${lead.firstName} ${lead.lastName}`);
    console.log(`   Template Variables:`);
    Object.entries(contentVariables).forEach(([key, value]) => {
      console.log(`     {{${key}}}: "${value}"`);
    });
    console.log(`   Dry Run: ${agentConfig.isDryRun ?? true}\n`);

    // Check if agent is in dry run mode BEFORE validation/sending
    const isDryRun = agentConfig.isDryRun ?? true;

    // ✅ TEMPLATE APPROVAL VALIDATION: Check if template is approved before sending
    // Only validate in production mode (skip in dry run for testing)
    if (!isDryRun && agentConfig.twilioAccountSid && agentConfig.twilioAuthToken) {
      console.log(`🔍 [TEMPLATE VALIDATION] Checking approval status for ${contentSid}...`);
      
      const approvalCheck = await checkTemplateApprovalStatus(
        agentConfig.twilioAccountSid,
        agentConfig.twilioAuthToken,
        contentSid
      );
      
      if (!approvalCheck.approved) {
        console.error(`\n❌ [TEMPLATE NOT APPROVED] Cannot send message - template validation failed`);
        console.error(`   Template SID: ${contentSid}`);
        console.error(`   Status: ${approvalCheck.status}`);
        console.error(`   Reason: ${approvalCheck.reason}`);
        console.error(`   Lead ID: ${lead.id}`);
        console.error(`   Lead Name: ${lead.firstName} ${lead.lastName}`);
        console.error(`   Agent ID: ${agentConfig.id}`);
        console.error(`   Agent Name: ${agentConfig.agentName}`);
        console.error(`   Action: Lead skipped, no message sent\n`);
        
        // ✅ Salva messaggio errore in conversazione SOLO per errori DEFINITIVI
        // Stati definitivi: rejected, paused, disabled (azioni bloccate da WhatsApp/Twilio)
        // NON salvare per: unknown, not_submitted, error (potrebbero essere transitori)
        const definiteErrorStatuses = ['rejected', 'paused', 'disabled'];
        const shouldSaveToConversation = definiteErrorStatuses.includes(approvalCheck.status);
        
        if (shouldSaveToConversation) {
          const normalizedPhone = normalizePhoneNumber(lead.phoneNumber);
          const conversation = await findOrCreateConversation(
            normalizedPhone,
            lead.consultantId,
            lead.agentConfigId,
            true,
            lead.id,
            lead.email || null
          );
          
          await db.insert(whatsappMessages).values({
            conversationId: conversation.id,
            messageText: `⚠️ Impossibile inviare messaggio template\n\nMotivo: ${approvalCheck.reason}\n\nTemplate ID: ${contentSid}\nStatus: ${approvalCheck.status}\n\n📝 Azione richiesta: Ottieni l'approvazione del template nella Twilio Console prima di poter inviare messaggi.`,
            direction: 'outbound',
            sender: 'system',
            metadata: {
              isError: true,
              errorType: 'template_not_approved',
              templateSid: contentSid,
              templateStatus: approvalCheck.status,
              templateReason: approvalCheck.reason,
              messageType: messageType,
              leadId: lead.id,
            }
          });
          
          console.log(`💾 Saved error message to conversation ${conversation.id} for DEFINITE error status: ${approvalCheck.status}`);
        } else {
          console.log(`⏭️  Skipping conversation error message for transient status: ${approvalCheck.status} (only save for rejected/paused/disabled)`);
        }
        
        // ✅ LOG ERROR TO SYSTEM_ERRORS TABLE for UI visibility (sempre, anche per stati transitori)
        const { logSystemError } = await import('../services/error-logger');
        await logSystemError({
          consultantId: lead.consultantId,
          agentConfigId: agentConfig.id,
          errorType: 'template_not_approved',
          errorMessage: `Template ${contentSid} non approvato: ${approvalCheck.reason}`,
          errorDetails: {
            templateSid: contentSid,
            templateStatus: approvalCheck.status,
            templateReason: approvalCheck.reason,
            leadId: lead.id,
            leadName: `${lead.firstName} ${lead.lastName}`,
            phoneNumber: lead.phoneNumber,
            messageType,
          }
        });
        
        // ✅ IDEMPOTENCY FIX: Update lead status to prevent infinite retry loop
        // Mark as 'lost' with error metadata so it won't be reprocessed
        await db
          .update(proactiveLeads)
          .set({
            status: 'lost',
            lastContactedAt: new Date(),
            updatedAt: new Date(),
            metadata: {
              ...(lead.metadata ?? {}), // ✅ NULL GUARD: spread only if metadata exists
              templateApprovalError: true,
              errorReason: approvalCheck.reason,
              errorStatus: approvalCheck.status,
              errorTimestamp: new Date().toISOString(),
            }
          })
          .where(eq(proactiveLeads.id, lead.id));
        
        console.log(`⏭️  Skipping lead ${lead.id} - template not approved, marked as 'lost'\n`);
        await logLeadActivity(
          lead.id,
          lead.consultantId,
          lead.agentConfigId,
          'failed',
          `Template non approvato: ${approvalCheck.reason}`,
          { 
            skipReason: 'template_not_approved', 
            templateSid: contentSid,
            templateStatus: approvalCheck.status,
            errorMessage: approvalCheck.reason 
          },
          lead.status
        );
        return; // Skip this lead
      }
      
      console.log(`✅ [TEMPLATE VALIDATION] Template approved - proceeding with send\n`);
    } else if (isDryRun) {
      console.log(`🔒 [DRY RUN] Skipping template approval check (dry run mode)\n`);
    }

    // Normalize phone number (remove whatsapp: prefix for database)
    const normalizedPhone = normalizePhoneNumber(lead.phoneNumber);
    
    // Format for Twilio API (add whatsapp: prefix)
    const twilioFormattedPhone = normalizedPhone.startsWith('whatsapp:') 
      ? normalizedPhone 
      : `whatsapp:${normalizedPhone}`;

    // Find or create conversation with proactive lead flags (using normalized number)
    const conversation = await findOrCreateConversation(
      normalizedPhone,
      lead.consultantId,
      lead.agentConfigId,
      true, // isProactiveLead
      lead.id, // proactiveLeadId
      lead.email || null // proactiveLeadEmail for client recognition
    );

    // Ensure conversation is marked as lead and has correct agent
    const conversationUpdates: any = {};
    
    if (!conversation.isLead) {
      conversationUpdates.isLead = true;
    }
    
    // Update agentConfigId if missing or different (fix "Unknown Agent" issue)
    if (!conversation.agentConfigId || conversation.agentConfigId !== lead.agentConfigId) {
      conversationUpdates.agentConfigId = lead.agentConfigId;
      console.log(`📌 Updating conversation agent: ${conversation.agentConfigId || 'none'} → ${lead.agentConfigId}`);
    }
    
    // Apply updates if needed
    if (Object.keys(conversationUpdates).length > 0) {
      await db
        .update(whatsappConversations)
        .set(conversationUpdates)
        .where(eq(whatsappConversations.id, conversation.id));
    }

    // Get template bodies from agent config (cached)
    let templateBodies = agentConfig.templateBodies as {
      openingMessageBody?: string;
      followUpGentleBody?: string;
      followUpValueBody?: string;
      followUpFinalBody?: string;
    } | null;

    // Helper to fetch template body from Twilio in real-time if not cached
    const fetchTemplateBodyRealtime = async (sid: string): Promise<string | null> => {
      if (!agentConfig.twilioAccountSid || !agentConfig.twilioAuthToken) {
        return null;
      }

      try {
        const twilio = (await import('twilio')).default;
        const twilioClient = twilio(agentConfig.twilioAccountSid, agentConfig.twilioAuthToken);
        
        const content = await twilioClient.content.v1.contents(sid).fetch();
        
        // Extract body text
        const bodyComponent = content.types?.['twilio/whatsapp']?.template?.components?.find(
          (comp: any) => comp.type === 'BODY'
        );
        const bodyText = bodyComponent?.text || content.types?.['twilio/text']?.body || '';
        
        return bodyText || null;
      } catch (error: any) {
        console.warn(`⚠️  Could not fetch template ${sid} in real-time: ${error.message}`);
        return null;
      }
    };

    // Build a human-readable preview of the template message
    const buildTemplatePreview = async (
      vars: Record<string, string>, 
      messageType: string
    ): Promise<string> => {
      // Try to get the template body text for this message type
      let templateBody: string | undefined;
      let bodyKey: string | undefined;
      
      switch (messageType) {
        case 'opening':
          templateBody = templateBodies?.openingMessageBody;
          bodyKey = 'openingMessageBody';
          break;
        case 'followup_gentle':
          templateBody = templateBodies?.followUpGentleBody;
          bodyKey = 'followUpGentleBody';
          break;
        case 'followup_value':
          templateBody = templateBodies?.followUpValueBody;
          bodyKey = 'followUpValueBody';
          break;
        case 'followup_final':
          templateBody = templateBodies?.followUpFinalBody;
          bodyKey = 'followUpFinalBody';
          break;
      }

      // If not cached, fetch in real-time from Twilio
      if (!templateBody && contentSid) {
        console.log(`📥 Template body not cached, fetching from Twilio in real-time...`);
        const fetchedBody = await fetchTemplateBodyRealtime(contentSid);
        
        if (fetchedBody) {
          templateBody = fetchedBody;
          
          // Cache it for next time
          const updatedBodies = { ...(templateBodies || {}), [bodyKey!]: fetchedBody };
          await db
            .update(consultantWhatsappConfig)
            .set({ templateBodies: updatedBodies })
            .where(eq(consultantWhatsappConfig.id, agentConfig.id));
          
          console.log(`✅ Fetched and cached template body for ${bodyKey}`);
        }
      }

      // If we have the template body, replace variables and show formatted message
      if (templateBody) {
        const formattedMessage = replaceTemplateVariables(templateBody, vars);
        return `🧪 DRY RUN - Anteprima Messaggio\n\n${formattedMessage}\n\n───────────────────\nTemplate ID: ${contentSid}`;
      }

      // Fallback: show variable list (only if Twilio fetch also failed)
      const varList = Object.entries(vars)
        .map(([key, value]) => `{{${key}}}: "${value}"`)
        .join('\n   ');
      return `🧪 DRY RUN - Template Message\n\nVariabili del template:\n   ${varList}\n\nTemplate ID: ${contentSid}\n\n⚠️ Nota: Impossibile fetchare testo template da Twilio.`;
    };

    // Get formatted template body for metadata (used by frontend for display)
    let formattedTemplateBody: string | undefined;
    
    if (contentSid && contentVariables) {
      let templateBody: string | undefined;
      let bodyKey: string | undefined;
      
      // Try to get cached template body
      switch (messageType) {
        case 'opening':
          templateBody = templateBodies?.openingMessageBody;
          bodyKey = 'openingMessageBody';
          break;
        case 'followup_gentle':
          templateBody = templateBodies?.followUpGentleBody;
          bodyKey = 'followUpGentleBody';
          break;
        case 'followup_value':
          templateBody = templateBodies?.followUpValueBody;
          bodyKey = 'followUpValueBody';
          break;
        case 'followup_final':
          templateBody = templateBodies?.followUpFinalBody;
          bodyKey = 'followUpFinalBody';
          break;
      }

      // If not cached, fetch in real-time from Twilio and cache it
      if (!templateBody && bodyKey) {
        const fetchedBody = await fetchTemplateBodyRealtime(contentSid);
        
        if (fetchedBody) {
          templateBody = fetchedBody;
          
          // Cache it for next time
          const updatedBodies = { ...(templateBodies || {}), [bodyKey]: fetchedBody };
          await db
            .update(consultantWhatsappConfig)
            .set({ templateBodies: updatedBodies })
            .where(eq(consultantWhatsappConfig.id, agentConfig.id));
          
          // Update local reference to prevent duplicate fetch in buildTemplatePreview
          templateBodies = updatedBodies;
          
          console.log(`✅ Fetched and cached template body for ${bodyKey}`);
        }
      }

      // Replace variables to get final formatted text
      if (templateBody) {
        formattedTemplateBody = replaceTemplateVariables(templateBody, contentVariables);
      }
    }

    // Save message to database (both in dry run and production mode)
    // In dry run: show template preview with variables replaced
    // In production: show template placeholder (will be replaced by Twilio)
    let savedMessageId: string | undefined;
    const messageTextToSave = isDryRun && contentSid && contentVariables
      ? await buildTemplatePreview(contentVariables, messageType)
      : message;
    
    console.log(`💾 [INSERT] Inserting message for lead ${lead.id} (${lead.firstName}) to conversation ${conversation.id}`);
    console.log(`   Message text preview: "${messageTextToSave.substring(0, 100)}..."`);
    console.log(`   Dry run: ${isDryRun}, Template SID: ${contentSid || 'none'}`);
    
    const [savedMessage] = await db
      .insert(whatsappMessages)
      .values({
        conversationId: conversation.id,
        messageText: messageTextToSave,
        direction: 'outbound',
        sender: 'ai',
        mediaType: 'text',
        metadata: isDryRun ? {
          isDryRun: true,
          templateSid: contentSid,
          templateVariables: contentVariables,
          messageType: messageType,
          templateBody: formattedTemplateBody,
        } : (contentSid ? {
          templateSid: contentSid,
          templateVariables: contentVariables,
          messageType: messageType,
          templateBody: formattedTemplateBody,
        } : null),
      })
      .returning();
    
    savedMessageId = savedMessage.id;
    
    console.log(`✅ [INSERT] Message saved with ID: ${savedMessage.id}`);
    if (isDryRun) {
      console.log(`🔒 [DRY RUN] Saved simulated message to database: ${savedMessage.id}`);
    }

    // Update conversation with last message info
    await db
      .update(whatsappConversations)
      .set({
        lastMessageAt: new Date(),
        lastMessageFrom: 'ai',
        messageCount: conversation.messageCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(whatsappConversations.id, conversation.id));

    // CRITICAL FIX: Update conversation_states to increment followupCount
    // This prevents race condition with followup-scheduler thinking it's a new lead
    await db
      .update(conversationStates)
      .set({
        followupCount: 1, // First message sent by proactive outreach
        lastFollowupAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversationStates.conversationId, conversation.id));
    
    console.log(`📊 [PROACTIVE OUTREACH] Updated conversation_states: followupCount=1 for ${conversation.id}`);

    // Send via Twilio (with template if available)
    await sendWhatsAppMessage(
      lead.consultantId,
      twilioFormattedPhone,
      message,
      savedMessageId,
      {
        // ✅ FIX: Always pass routing options to prevent fallback agent warning
        agentConfigId: agentConfig.id,
        conversationId: conversation.id,
        // Include template options only if template is used
        ...(contentSid ? { contentSid, contentVariables } : {})
      }
    );

    if (isDryRun) {
      console.log(`🔒 [DRY RUN] Simulated message to ${lead.firstName} ${lead.lastName} - updating status to prevent duplicates`);
      
      // In dry run, update status AND metadata to prevent re-sending
      await db
        .update(proactiveLeads)
        .set({
          lastContactedAt: new Date(),
          status: 'contacted',
          lastMessageSent: message,
          updatedAt: new Date(),
          metadata: {
            ...lead.metadata,
            conversationId: conversation.id,
            lastDryRunSimulation: new Date().toISOString(),
            dryRunMessagePreview: message.substring(0, 100),
            isDryRunTest: true
          }
        })
        .where(eq(proactiveLeads.id, lead.id));
      
      console.log(`🔒 [DRY RUN] Lead ${lead.id} status updated to 'contacted' (prevents duplicate sends)`);

      await logLeadActivity(
        lead.id,
        lead.consultantId,
        lead.agentConfigId,
        'sent',
        'Messaggio simulato (DRY RUN)',
        { 
          isDryRun: true,
          templateSid: contentSid,
          messageType,
          templateVariables: contentVariables
        },
        'contacted'
      );
    } else {
      console.log(`✅ Sent message to ${lead.firstName} ${lead.lastName}`);
      
      // Update lead status only when actually sent
      await db
        .update(proactiveLeads)
        .set({
          lastContactedAt: new Date(),
          status: 'contacted',
          lastMessageSent: message,
          updatedAt: new Date(),
          metadata: {
            ...lead.metadata,
            conversationId: conversation.id
          }
        })
        .where(eq(proactiveLeads.id, lead.id));

      console.log(`✅ Updated lead ${lead.id} status to 'contacted'`);

      await logLeadActivity(
        lead.id,
        lead.consultantId,
        lead.agentConfigId,
        'sent',
        'Messaggio inviato con successo',
        { 
          isDryRun: false,
          templateSid: contentSid,
          messageType,
          templateVariables: contentVariables
        },
        'contacted'
      );

    }

    // Trigger welcome email (async, non-blocking) - INDEPENDENT from WhatsApp result
    triggerWelcomeEmail(lead);

  } catch (error: any) {
    console.error(`❌ Error processing lead ${lead.id}:`, error.message);
    await logLeadActivity(
      lead.id,
      lead.consultantId,
      lead.agentConfigId,
      'error',
      `Errore durante elaborazione: ${error.message}`,
      { 
        errorMessage: error.message,
        errorStack: error.stack
      },
      lead.status
    );

    // Trigger welcome email even if WhatsApp fails - email is independent
    triggerWelcomeEmail(lead);
  }
}

/**
 * Helper function to trigger welcome email (non-blocking)
 * Called independently from WhatsApp success/failure
 */
function triggerWelcomeEmail(lead: typeof proactiveLeads.$inferSelect): void {
  sendProactiveLeadWelcomeEmail({
    leadId: lead.id,
    consultantId: lead.consultantId,
  }).then(result => {
    if (result.success) {
      console.log(`📧 [WELCOME EMAIL] Sent to lead ${lead.id}`);
    } else {
      console.log(`📧 [WELCOME EMAIL] Skipped for lead ${lead.id}: ${result.error}`);
    }
  }).catch(err => {
    console.error(`📧 [WELCOME EMAIL] Error for lead ${lead.id}:`, err.message);
  });
}

/**
 * Main cron job function - processes all leads
 * Protected against concurrent execution (race condition fix)
 */
export async function processProactiveOutreach(): Promise<void> {
  // RACE CONDITION PROTECTION: Prevent concurrent execution
  if (isProcessingOutreach) {
    console.log(`⏳ [PROACTIVE OUTREACH] Already processing - skipping this cycle`);
    return;
  }
  
  isProcessingOutreach = true;
  const startTime = Date.now();
  console.log(`\n🚀 [PROACTIVE OUTREACH] Starting scheduled run at ${new Date().toISOString()}`);

  try {
    // Query: Pending leads whose contact schedule has passed
    // NOTA: I follow-up sono gestiti dal followup-scheduler (server/cron/followup-scheduler.ts)
    // CRITICAL: Only process leads with proactive_setter agents
    const pendingLeads = await db
      .select({
        lead: proactiveLeads,
        consultant: users,
        agentConfig: consultantWhatsappConfig
      })
      .from(proactiveLeads)
      .innerJoin(users, eq(proactiveLeads.consultantId, users.id))
      .innerJoin(consultantWhatsappConfig, eq(proactiveLeads.agentConfigId, consultantWhatsappConfig.id))
      .where(
        and(
          eq(proactiveLeads.status, 'pending'),
          lte(proactiveLeads.contactSchedule, new Date()),
          eq(consultantWhatsappConfig.agentType, 'proactive_setter') // CRITICAL: Only proactive agents
        )
      );

    console.log(`📋 Found ${pendingLeads.length} pending leads to contact (first message only)`);

    if (pendingLeads.length === 0) {
      console.log(`✅ No pending leads to process at this time`);
      return; // Lock will be released in finally block
    }

    // Process each pending lead (first opening message only)
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const { lead, consultant, agentConfig } of pendingLeads) {
      // DUPLICATE PROTECTION (in-memory): Skip if lead is already being processed in this instance
      if (processingLeadIds.has(lead.id)) {
        console.log(`⏭️ Skipping lead ${lead.id} - already being processed in this instance`);
        skippedCount++;
        continue;
      }
      
      // Mark lead as being processed locally
      processingLeadIds.add(lead.id);
      
      // DATABASE-LEVEL ATOMIC LOCK: Try to claim this lead by updating status from 'pending' to 'processing'
      // Only one instance/process can succeed - this prevents race conditions across multiple server instances
      const claimedLeads = await db
        .update(proactiveLeads)
        .set({ 
          status: 'processing', // Temporary status during processing
          updatedAt: new Date()
        })
        .where(
          and(
            eq(proactiveLeads.id, lead.id),
            eq(proactiveLeads.status, 'pending') // CRITICAL: Only claim if still pending
          )
        )
        .returning({ id: proactiveLeads.id });
      
      if (claimedLeads.length === 0) {
        // Another instance already claimed this lead
        console.log(`⏭️ Skipping lead ${lead.id} - already claimed by another instance (status changed)`);
        processingLeadIds.delete(lead.id);
        skippedCount++;
        continue;
      }
      
      console.log(`🔒 [LOCK ACQUIRED] Claimed lead ${lead.id} for processing`);
      
      // Validate that we have all required data
      if (!consultant) {
        console.error(`❌ Skipping lead ${lead.id} - consultant not found`);
        // Revert status back to pending since we didn't process it
        await db.update(proactiveLeads).set({ status: 'pending' }).where(eq(proactiveLeads.id, lead.id));
        processingLeadIds.delete(lead.id);
        errorCount++;
        continue;
      }

      if (!agentConfig) {
        console.error(`❌ Skipping lead ${lead.id} - agent config not found`);
        await db.update(proactiveLeads).set({ status: 'pending' }).where(eq(proactiveLeads.id, lead.id));
        processingLeadIds.delete(lead.id);
        errorCount++;
        continue;
      }

      // CRITICAL: Double-check agent type (defensive programming)
      if (agentConfig.agentType !== 'proactive_setter') {
        console.error(`❌ Skipping lead ${lead.id} - agent "${agentConfig.agentName}" is type "${agentConfig.agentType}" not "proactive_setter"`);
        console.error(`   This should not happen - check database query filters!`);
        await db.update(proactiveLeads).set({ status: 'pending' }).where(eq(proactiveLeads.id, lead.id));
        processingLeadIds.delete(lead.id);
        errorCount++;
        continue;
      }

      try {
        await processLead(lead, consultant, agentConfig);
        successCount++;
        // Note: processLead already updates status to 'contacted' on success
      } catch (error: any) {
        console.error(`❌ Failed to process lead ${lead.id}:`, error.message);
        errorCount++;
        
        // Track failed attempt for anti-loop protection
        const currentAttempts = (lead.failedAttempts || 0) + 1;
        const MAX_FAILED_ATTEMPTS = 3;
        
        if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
          console.log(`🚫 [ANTI-LOOP] Lead ${lead.id} reached ${currentAttempts} failed attempts - marking as 'failed'`);
          await db.update(proactiveLeads).set({ 
            status: 'failed',
            failedAttempts: currentAttempts,
            lastError: error.message,
            updatedAt: new Date()
          }).where(eq(proactiveLeads.id, lead.id));
        } else {
          // Increment failed attempts but keep as pending for retry
          await db.update(proactiveLeads).set({ 
            status: 'pending',
            failedAttempts: currentAttempts,
            lastError: error.message,
            updatedAt: new Date()
          }).where(eq(proactiveLeads.id, lead.id));
          console.log(`⚠️ [RETRY] Lead ${lead.id} failed attempt ${currentAttempts}/${MAX_FAILED_ATTEMPTS} - will retry`);
        }
      } finally {
        // Always remove from local processing set
        processingLeadIds.delete(lead.id);
        
        // SAFETY: Verify status was updated - if still 'processing', handle with anti-loop logic
        // This handles any early returns in processLead that don't update status
        const [finalState] = await db
          .select({ status: proactiveLeads.status, failedAttempts: proactiveLeads.failedAttempts })
          .from(proactiveLeads)
          .where(eq(proactiveLeads.id, lead.id))
          .limit(1);
        
        if (finalState?.status === 'processing') {
          const currentAttempts = (finalState.failedAttempts || 0) + 1;
          const MAX_FAILED_ATTEMPTS = 3;
          
          if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
            console.log(`🚫 [ANTI-LOOP] Lead ${lead.id} still processing after ${currentAttempts} attempts - marking as 'failed'`);
            await db.update(proactiveLeads).set({ 
              status: 'failed',
              failedAttempts: currentAttempts,
              lastError: 'Processing timeout - max retries reached',
              updatedAt: new Date()
            }).where(eq(proactiveLeads.id, lead.id));
          } else {
            console.log(`⚠️ [LOCK RELEASE] Lead ${lead.id} still in 'processing' state - reverting to 'pending' (attempt ${currentAttempts}/${MAX_FAILED_ATTEMPTS})`);
            await db.update(proactiveLeads).set({ 
              status: 'pending',
              failedAttempts: currentAttempts,
              updatedAt: new Date()
            }).where(eq(proactiveLeads.id, lead.id));
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ [PROACTIVE OUTREACH] Completed in ${duration}ms`);
    console.log(`   📊 Results: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped, ${pendingLeads.length} pending leads total`);

  } catch (error: any) {
    console.error(`❌ [PROACTIVE OUTREACH] Fatal error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    // ALWAYS release lock
    isProcessingOutreach = false;
  }
}

/**
 * Process a single lead immediately (for instant outreach when lead is created/imported)
 * This bypasses the 5-minute scheduler cycle for immediate first contact
 * @param leadId - The lead ID to process
 * @returns Result with success status and message
 */
export async function processSingleLeadImmediately(leadId: string): Promise<{ success: boolean; message: string }> {
  console.log(`⚡ [IMMEDIATE OUTREACH] Processing lead ${leadId} immediately`);
  
  try {
    const leadData = await db
      .select({
        lead: proactiveLeads,
        consultant: users,
        agentConfig: consultantWhatsappConfig
      })
      .from(proactiveLeads)
      .innerJoin(users, eq(proactiveLeads.consultantId, users.id))
      .innerJoin(consultantWhatsappConfig, eq(proactiveLeads.agentConfigId, consultantWhatsappConfig.id))
      .where(eq(proactiveLeads.id, leadId))
      .limit(1);
    
    if (leadData.length === 0) {
      console.log(`⚠️ [IMMEDIATE OUTREACH] Lead ${leadId} not found or missing relationships`);
      return { success: false, message: "Lead not found" };
    }
    
    const { lead, consultant, agentConfig } = leadData[0];
    
    if (lead.status !== 'pending') {
      console.log(`⚠️ [IMMEDIATE OUTREACH] Lead ${leadId} is not pending (status: ${lead.status})`);
      return { success: false, message: `Lead status is ${lead.status}, not pending` };
    }
    
    if (agentConfig.agentType !== 'proactive_setter') {
      console.log(`⚠️ [IMMEDIATE OUTREACH] Agent ${agentConfig.agentName} is not proactive_setter`);
      return { success: false, message: "Agent is not a proactive setter" };
    }
    
    if (processingLeadIds.has(leadId)) {
      console.log(`⚠️ [IMMEDIATE OUTREACH] Lead ${leadId} already being processed`);
      return { success: false, message: "Lead already being processed" };
    }
    
    processingLeadIds.add(leadId);
    
    const claimedLeads = await db
      .update(proactiveLeads)
      .set({ 
        status: 'processing',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(proactiveLeads.id, leadId),
          eq(proactiveLeads.status, 'pending')
        )
      )
      .returning({ id: proactiveLeads.id });
    
    if (claimedLeads.length === 0) {
      processingLeadIds.delete(leadId);
      console.log(`⚠️ [IMMEDIATE OUTREACH] Could not claim lead ${leadId}`);
      return { success: false, message: "Lead already claimed by another process" };
    }
    
    try {
      await processLead(lead, consultant, agentConfig);
      console.log(`✅ [IMMEDIATE OUTREACH] Successfully processed lead ${leadId}`);
      return { success: true, message: "First message sent successfully" };
    } catch (error: any) {
      console.error(`❌ [IMMEDIATE OUTREACH] Failed to process lead ${leadId}:`, error.message);
      return { success: false, message: error.message };
    } finally {
      processingLeadIds.delete(leadId);
      
      const [finalStatus] = await db
        .select({ status: proactiveLeads.status })
        .from(proactiveLeads)
        .where(eq(proactiveLeads.id, leadId))
        .limit(1);
      
      if (finalStatus?.status === 'processing') {
        await db.update(proactiveLeads).set({ status: 'pending' }).where(eq(proactiveLeads.id, leadId));
      }
    }
  } catch (error: any) {
    console.error(`❌ [IMMEDIATE OUTREACH] Error:`, error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Start the proactive outreach scheduler
 * Runs every 1 minute for precise timing based on contactSchedule
 */
export function startProactiveOutreachScheduler(): void {
  if (schedulerTask) {
    console.log(`⚠️ Proactive outreach scheduler already running`);
    return;
  }

  console.log(`🚀 Starting proactive outreach scheduler (every 1 minute)`);

  // Schedule: Every 1 minute for precise contactSchedule timing
  schedulerTask = cron.schedule('* * * * *', async () => {
    await processProactiveOutreach();
  }, {
    timezone: 'Europe/Rome' // Use Italian timezone for consistency
  });

  console.log(`✅ Proactive outreach scheduler started successfully (checking every 1 minute)`);

  // Run immediately on startup (optional - comment out if not desired)
  // processProactiveOutreach().catch(error => {
  //   console.error('❌ Initial proactive outreach run failed:', error);
  // });
}

/**
 * Stop the proactive outreach scheduler
 */
export function stopProactiveOutreachScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log(`🛑 Proactive outreach scheduler stopped`);
  } else {
    console.log(`⚠️ Proactive outreach scheduler not running`);
  }
}
