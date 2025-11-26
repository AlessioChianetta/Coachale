import { ExternalLeadApiClient } from './external-api-client';
import { storage } from '../storage';
import type { ExternalApiConfig } from '@shared/schema';
import { db } from '../db';
import * as schema from '@shared/schema';

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function hasLeadInfo(leadInfo: any): boolean {
  if (!leadInfo || typeof leadInfo !== 'object') return false;
  
  const validFields = ['obiettivi', 'desideri', 'uncino', 'fonte'];
  
  return validFields.some(field => {
    const value = leadInfo[field];
    if (value === undefined || value === null) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    return true;
  });
}

export interface ImportResult {
  imported: number;
  updated: number;
  duplicated: number;
  errored: number;
  errors: string[];
}

export class LeadImportService {
  async importLeadsFromExternal(
    config: ExternalApiConfig,
    importType: 'manual' | 'scheduled'
  ): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      updated: 0,
      duplicated: 0,
      errored: 0,
      errors: [],
    };

    const startedAt = new Date();
    let status: 'success' | 'partial' | 'error' = 'success';

    try {
      const client = new ExternalLeadApiClient(config.baseUrl, config.apiKey);

      // BUG 4 FIX: Implement pagination loop to fetch all leads
      console.log(`📥 External API Import: Starting pagination fetch for config ${config.configName}`);
      
      let allLeads: any[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      const maxLeadsPerImport = (config as any).maxLeadsPerImport;

      while (hasMore) {
        const result = await client.fetchLeads({
          type: config.leadType,
          limit,
          offset,
          days: config.daysFilter || undefined,
          source: config.sourceFilter || undefined,
          campaign: config.campaignFilter || undefined,
        });

        if (!result.success || !result.data) {
          if (allLeads.length === 0) {
            throw new Error(result.error || 'Failed to fetch leads from external API');
          }
          break;
        }

        console.log(`📄 Fetched page at offset ${offset}: ${result.data.length} leads`);
        allLeads = allLeads.concat(result.data);
        offset += limit;
        hasMore = result.data.length === limit;

        // BUG 3 FIX: Respect maxLeadsPerImport during fetch to avoid unnecessary API calls
        if (maxLeadsPerImport && allLeads.length >= maxLeadsPerImport) {
          console.log(`⚠️ Reached maxLeadsPerImport limit (${maxLeadsPerImport}) during fetch`);
          allLeads = allLeads.slice(0, maxLeadsPerImport);
          break;
        }
      }

      console.log(`📥 Total leads fetched from API: ${allLeads.length}`);

      // BUG 3 FIX: Apply maxLeadsPerImport limit if not already applied during fetch
      let leadsToImport = allLeads;
      if (maxLeadsPerImport && leadsToImport.length > maxLeadsPerImport) {
        console.log(`⚠️ Limiting import to ${maxLeadsPerImport} leads (total available: ${leadsToImport.length})`);
        const skippedCount = leadsToImport.length - maxLeadsPerImport;
        leadsToImport = leadsToImport.slice(0, maxLeadsPerImport);
        result.errors.push(`${skippedCount} lead(s) skipped due to maxLeadsPerImport limit`);
      }

      // BUG 2 FIX: Proper agent config lookup with campaign fallback
      let agentConfigId: string | null = null;
      let campaign: any = null;
      let agentConfig: any = null;

      // Option A: Try to get campaign and agent if targetCampaignId is specified
      if (config.targetCampaignId) {
        campaign = await storage.getCampaign(config.targetCampaignId, config.consultantId);
        if (campaign?.preferredAgentConfigId) {
          agentConfigId = campaign.preferredAgentConfigId;
          console.log(`✅ Using agent from campaign: ${agentConfigId}`);
        }
      }

      // Option B (fallback): Get first available agent config for consultant
      if (!agentConfigId) {
        const agents = await db.select()
          .from(schema.consultantWhatsappConfig)
          .where(schema.eq(schema.consultantWhatsappConfig.consultantId, config.consultantId));

        if (agents.length === 0) {
          throw new Error('Nessun agente WhatsApp configurato. Configura almeno un agente prima di importare lead.');
        }

        agentConfigId = agents[0].id;
        console.log(`✅ Using first available agent (fallback): ${agentConfigId}`);
      }

      // Retrieve full agent config for defaults
      if (agentConfigId) {
        agentConfig = await storage.getConsultantWhatsappConfig(config.consultantId, agentConfigId);
        console.log(`✅ Retrieved agent config for defaults: ${agentConfigId}`);
      }

      // BUG 1 FIX: Progressive contact scheduling with delay and jitter
      const baseTime = new Date();
      const delayMinutes = (config as any).contactDelayMinutes || 1;
      
      console.log(`⏰ Scheduling ${leadsToImport.length} leads with ${delayMinutes} minute delay between each`);

      for (let i = 0; i < leadsToImport.length; i++) {
        const leadData = leadsToImport[i];
        
        try {
          const { firstName, lastName } = splitFullName(leadData.fullName || '');

          if (!firstName || !leadData.phone) {
            result.errored++;
            result.errors.push(`Lead ${leadData.id}: Missing required fields (name or phone)`);
            continue;
          }

          // Normalize phone number: ensure it starts with +39
          let phoneNumber = leadData.phone.trim();
          
          // Remove any spaces, dashes, or parentheses
          phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
          
          // If it starts with 39 but not +39, add the +
          if (phoneNumber.startsWith('39') && !phoneNumber.startsWith('+39')) {
            phoneNumber = '+' + phoneNumber;
          }
          // If it doesn't start with + or 39, assume it's an Italian number and add +39
          else if (!phoneNumber.startsWith('+') && !phoneNumber.startsWith('39')) {
            phoneNumber = '+39' + phoneNumber;
          }

          const existingLead = await storage.getProactiveLeadByPhone(
            config.consultantId,
            phoneNumber
          );

          const leadInfo: any = {};

          if (leadData.type === 'marketing' && leadData.details) {
            if (leadData.details.additionalData?.obiettivi) {
              leadInfo.obiettivi = leadData.details.additionalData.obiettivi;
            }
            if (leadData.details.additionalData?.desideri) {
              leadInfo.desideri = leadData.details.additionalData.desideri;
            }
            if (leadData.details.additionalData?.uncino) {
              leadInfo.uncino = leadData.details.additionalData.uncino;
            }
          }

          if (leadData.source) {
            leadInfo.fonte = leadData.source;
          }

          // Apply campaign and agent defaults (same logic as POST /api/proactive-leads)
          const appliedLeadInfo = {
            obiettivi: leadInfo.obiettivi?.trim() || campaign?.defaultObiettivi || agentConfig?.defaultObiettivi || undefined,
            desideri: leadInfo.desideri?.trim() || campaign?.implicitDesires || agentConfig?.defaultDesideri || undefined,
            uncino: leadInfo.uncino?.trim() || campaign?.hookText || agentConfig?.defaultUncino || undefined,
            fonte: leadInfo.fonte?.trim() || undefined,
          };

          // Only include leadInfo if it has at least one defined value
          const finalLeadInfo = hasLeadInfo(appliedLeadInfo) ? appliedLeadInfo : undefined;

          if (existingLead) {
            const updatePayload: any = {
              firstName,
              lastName,
              status: leadData.status === 'converted' ? 'converted' : existingLead.status,
            };
            
            if (finalLeadInfo) {
              updatePayload.leadInfo = finalLeadInfo;
            }
            
            await storage.updateProactiveLead(existingLead.id, config.consultantId, updatePayload);
            result.updated++;
            console.log(`🔄 Updated existing lead: ${phoneNumber}`);
          } else {
            // BUG 1 FIX: Calculate progressive schedule with jitter
            const scheduleTime = new Date(baseTime.getTime() + (i * delayMinutes * 60000));
            
            // Add random jitter ±30 seconds
            const jitterSeconds = Math.floor(Math.random() * 60) - 30;
            const finalSchedule = new Date(scheduleTime.getTime() + (jitterSeconds * 1000));

            const createPayload: any = {
              consultantId: config.consultantId,
              agentConfigId: agentConfigId,
              campaignId: config.targetCampaignId || null,
              firstName,
              lastName,
              phoneNumber,
              contactSchedule: finalSchedule,
              status: 'pending',
            };
            
            if (finalLeadInfo) {
              createPayload.leadInfo = finalLeadInfo;
            }

            await storage.createProactiveLead(createPayload);
            result.imported++;
            
            const scheduleOffset = Math.round((finalSchedule.getTime() - baseTime.getTime()) / 60000);
            console.log(`✅ Imported new lead: ${phoneNumber} (scheduled in ${scheduleOffset} min, leadInfo applied: ${!!finalLeadInfo})`);
          }
        } catch (error: any) {
          result.errored++;
          result.errors.push(`Lead ${leadData.id || leadData.phone}: ${error.message}`);
          console.error(`Error processing lead ${leadData.id}:`, error);
        }
      }

      if (result.errored > 0 && result.imported + result.updated > 0) {
        status = 'partial';
      } else if (result.errored === leadsToImport.length && leadsToImport.length > 0) {
        status = 'error';
      }

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await storage.createExternalLeadImportLog({
        configId: config.id,
        consultantId: config.consultantId,
        importType,
        status,
        leadsProcessed: allLeads.length,
        leadsImported: result.imported,
        leadsUpdated: result.updated,
        leadsDuplicated: result.duplicated,
        leadsErrored: result.errored,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        errorDetails: result.errors.length > 0 ? { failedLeads: result.errors.map(e => ({ phoneNumber: '', error: e })) } : null,
        startedAt,
        completedAt,
        durationMs,
      });

      await storage.updateExternalApiConfig(config.id, config.consultantId, {
        lastImportAt: completedAt,
        lastImportStatus: status,
        lastImportLeadsCount: result.imported + result.updated,
        lastImportErrorMessage: result.errors.length > 0 ? result.errors[0] : null,
      });

      console.log(`✅ Import completed: ${result.imported} imported, ${result.updated} updated, ${result.errored} errors`);

      return result;
    } catch (error: any) {
      console.error('Fatal error during lead import:', error);

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await storage.createExternalLeadImportLog({
        configId: config.id,
        consultantId: config.consultantId,
        importType,
        status: 'error',
        leadsProcessed: 0,
        leadsImported: 0,
        leadsUpdated: 0,
        leadsDuplicated: 0,
        leadsErrored: 0,
        errorMessage: error.message,
        errorDetails: { apiError: error.message },
        startedAt,
        completedAt,
        durationMs,
      });

      await storage.updateExternalApiConfig(config.id, config.consultantId, {
        lastImportAt: completedAt,
        lastImportStatus: 'error',
        lastImportLeadsCount: 0,
        lastImportErrorMessage: error.message,
      });

      throw error;
    }
  }
}
