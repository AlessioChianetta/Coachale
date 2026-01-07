import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../db';
import { 
  consultantOnboardingStatus, 
  vertexAiSettings, 
  consultantSmtpSettings, 
  consultantTurnConfig, 
  consultantKnowledgeDocuments, 
  externalApiConfigs, 
  consultantAvailabilitySettings, 
  users,
  consultantWhatsappConfig,
  whatsappAgentShares,
  consultantAiIdeas,
  universityYears,
  exercises,
  emailDrafts,
  whatsappCustomTemplates,
  whatsappTemplateVersions,
  superadminVertexConfig,
  consultantVertexAccess,
  marketingCampaigns,
  consultantInstagramConfig,
  consultantLicenses,
} from '@shared/schema';
import { eq, and, count, sql, inArray, isNotNull, ne } from 'drizzle-orm';
import { VertexAI } from '@google-cloud/vertexai';
import { getCalendarClient, getAgentCalendarClient } from '../google-calendar-service';
import { getAIProvider, getModelWithThinking } from '../ai/provider-factory';
import nodemailer from 'nodemailer';
import { decrypt, decryptForConsultant } from '../encryption';
import { upload } from '../middleware/upload';
import { extractTextFromFile } from '../services/document-processor';
import fs from 'fs/promises';

const router = Router();

router.get('/status', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    let status = await db.query.consultantOnboardingStatus.findFirst({
      where: eq(consultantOnboardingStatus.consultantId, consultantId),
    });
    
    if (!status) {
      const [newStatus] = await db.insert(consultantOnboardingStatus)
        .values({ consultantId })
        .returning();
      status = newStatus;
    }
    
    const vertexSettings = await db.query.vertexAiSettings.findFirst({
      where: eq(vertexAiSettings.userId, consultantId),
    });
    
    const smtpSettings = await db.query.consultantSmtpSettings.findFirst({
      where: eq(consultantSmtpSettings.consultantId, consultantId),
    });
    
    const turnConfig = await db.query.consultantTurnConfig.findFirst({
      where: eq(consultantTurnConfig.consultantId, consultantId),
    });
    
    const docsResult = await db.select({ count: count() })
      .from(consultantKnowledgeDocuments)
      .where(eq(consultantKnowledgeDocuments.consultantId, consultantId));
    const documentsCount = docsResult[0]?.count || 0;
    
    // Count WhatsApp agents by type
    const inboundAgentResult = await db.select({ count: count() })
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.consultantId, consultantId),
        eq(consultantWhatsappConfig.agentType, 'reactive_lead')
      ));
    const hasInboundAgent = Number(inboundAgentResult[0]?.count || 0) > 0;
    
    const outboundAgentResult = await db.select({ count: count() })
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.consultantId, consultantId),
        eq(consultantWhatsappConfig.agentType, 'proactive_setter')
      ));
    const hasOutboundAgent = Number(outboundAgentResult[0]?.count || 0) > 0;
    
    const consultativeAgentResult = await db.select({ count: count() })
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.consultantId, consultantId),
        eq(consultantWhatsappConfig.agentType, 'informative_advisor')
      ));
    const hasConsultativeAgent = Number(consultativeAgentResult[0]?.count || 0) > 0;
    
    // Check if at least one agent has Twilio configured
    const twilioConfiguredAgentResult = await db.select({ count: count() })
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.consultantId, consultantId),
        sql`twilio_account_sid IS NOT NULL AND twilio_account_sid != ''`,
        sql`twilio_auth_token IS NOT NULL AND twilio_auth_token != ''`
      ));
    const hasTwilioConfiguredAgent = Number(twilioConfiguredAgentResult[0]?.count || 0) > 0;
    
    // Count public agent links
    const publicLinksResult = await db.select({ count: count() })
      .from(whatsappAgentShares)
      .where(and(
        eq(whatsappAgentShares.consultantId, consultantId),
        eq(whatsappAgentShares.isActive, true)
      ));
    const publicLinksCount = Number(publicLinksResult[0]?.count || 0);
    const hasPublicAgentLink = publicLinksCount > 0;
    
    // Count AI ideas
    const ideasResult = await db.select({ count: count() })
      .from(consultantAiIdeas)
      .where(eq(consultantAiIdeas.consultantId, consultantId));
    const generatedIdeasCount = Number(ideasResult[0]?.count || 0);
    const hasGeneratedIdeas = generatedIdeasCount > 0;
    
    // Count courses (university years)
    const coursesResult = await db.select({ count: count() })
      .from(universityYears)
      .where(eq(universityYears.createdBy, consultantId));
    const coursesCount = Number(coursesResult[0]?.count || 0);
    const hasCreatedCourse = coursesCount > 0;
    
    // Count exercises
    const exercisesResult = await db.select({ count: count() })
      .from(exercises)
      .where(eq(exercises.createdBy, consultantId));
    const exercisesCount = Number(exercisesResult[0]?.count || 0);
    const hasCreatedExercise = exercisesCount > 0;
    
    // Count summary emails sent
    const summaryEmailsResult = await db.select({ count: count() })
      .from(emailDrafts)
      .where(and(
        eq(emailDrafts.consultantId, consultantId),
        eq(emailDrafts.emailType, 'consultation_summary'),
        eq(emailDrafts.status, 'sent')
      ));
    const summaryEmailsCount = Number(summaryEmailsResult[0]?.count || 0);
    const hasFirstSummaryEmail = summaryEmailsCount > 0;
    
    // Count custom WhatsApp templates
    const customTemplatesResult = await db.select({ count: count() })
      .from(whatsappCustomTemplates)
      .where(eq(whatsappCustomTemplates.consultantId, consultantId));
    const customTemplatesCount = Number(customTemplatesResult[0]?.count || 0);
    const hasCustomTemplate = customTemplatesCount > 0;
    
    // Count approved WhatsApp templates (check via template versions)
    const approvedTemplatesResult = await db
      .selectDistinct({ templateId: whatsappCustomTemplates.id })
      .from(whatsappCustomTemplates)
      .innerJoin(
        whatsappTemplateVersions,
        eq(whatsappTemplateVersions.templateId, whatsappCustomTemplates.id)
      )
      .where(and(
        eq(whatsappCustomTemplates.consultantId, consultantId),
        eq(whatsappTemplateVersions.twilioStatus, 'approved')
      ));
    const approvedTemplatesCount = approvedTemplatesResult.length;
    const hasApprovedTemplate = approvedTemplatesCount > 0;
    
    // Count marketing campaigns
    const campaignsResult = await db.select({ count: count() })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.consultantId, consultantId));
    const campaignsCount = Number(campaignsResult[0]?.count || 0);
    const hasFirstCampaign = campaignsCount > 0;
    
    // Check if Instagram is configured
    const instagramConfig = await db.query.consultantInstagramConfig.findFirst({
      where: eq(consultantInstagramConfig.consultantId, consultantId),
    });
    const hasInstagramConfigured = !!(instagramConfig?.instagramPageId && instagramConfig?.pageAccessToken);
    
    // Check Stripe Connect status
    const license = await db.query.consultantLicenses.findFirst({
      where: eq(consultantLicenses.consultantId, consultantId),
    });
    const hasStripeAccount = !!license?.stripeAccountId;
    const stripeAccountStatus = license?.stripeAccountStatus || null;
    
    // Update the status record with calculated values
    await db.update(consultantOnboardingStatus)
      .set({
        hasInboundAgent,
        hasOutboundAgent,
        hasConsultativeAgent,
        hasPublicAgentLink,
        publicLinksCount,
        hasGeneratedIdeas,
        generatedIdeasCount,
        hasCreatedCourse,
        coursesCount,
        hasCreatedExercise,
        exercisesCount,
        hasFirstSummaryEmail,
        summaryEmailsCount,
        updatedAt: new Date(),
      })
      .where(eq(consultantOnboardingStatus.consultantId, consultantId));
    
    const enrichedStatus = {
      ...status,
      hasVertexConfig: !!vertexSettings?.projectId,
      hasSmtpConfig: !!smtpSettings?.smtpHost,
      hasTurnConfig: !!turnConfig?.usernameEncrypted,
      documentsCount,
      hasInboundAgent,
      hasOutboundAgent,
      hasConsultativeAgent,
      hasTwilioConfiguredAgent,
      hasPublicAgentLink,
      publicLinksCount,
      hasGeneratedIdeas,
      generatedIdeasCount,
      hasCreatedCourse,
      coursesCount,
      hasCreatedExercise,
      exercisesCount,
      hasFirstSummaryEmail,
      summaryEmailsCount,
      hasCustomTemplate,
      customTemplatesCount,
      hasApprovedTemplate,
      approvedTemplatesCount,
      hasFirstCampaign,
      campaignsCount,
      hasInstagramConfigured,
      instagramStatus: hasInstagramConfigured ? 'verified' : 'pending',
      hasStripeAccount,
      stripeAccountStatus,
    };
    
    res.json({
      success: true,
      data: enrichedStatus,
    });
  } catch (error: any) {
    console.error('Error fetching onboarding status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch onboarding status',
    });
  }
});

router.get('/status/for-ai', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    // Fetch all configuration statuses in parallel for efficiency
    const [
      onboardingStatus,
      vertexSettings,
      consultant,
      smtpSettings,
      turnConfig,
      docsResult,
      agentsByType,
      twilioAgentResult,
      publicLinksResult,
      ideasResult,
      coursesResult,
      exercisesResult,
      summaryEmailResult,
      approvedTemplatesResult,
      moreTemplatesResult,
      campaignsResult,
      leadImportConfigResult,
      agentCalendarResult,
      instagramConfig,
      license
    ] = await Promise.all([
      db.query.consultantOnboardingStatus.findFirst({
        where: eq(consultantOnboardingStatus.consultantId, consultantId),
      }),
      db.query.vertexAiSettings.findFirst({
        where: eq(vertexAiSettings.userId, consultantId),
      }),
      db.query.users.findFirst({
        where: eq(users.id, consultantId),
        columns: { useSuperadminVertex: true },
      }),
      db.query.consultantSmtpSettings.findFirst({
        where: eq(consultantSmtpSettings.consultantId, consultantId),
      }),
      db.query.consultantTurnConfig.findFirst({
        where: eq(consultantTurnConfig.consultantId, consultantId),
      }),
      db.select({ count: count() })
        .from(consultantKnowledgeDocuments)
        .where(eq(consultantKnowledgeDocuments.consultantId, consultantId)),
      db.select({ 
        agentType: consultantWhatsappConfig.agentType,
        count: count()
      })
        .from(consultantWhatsappConfig)
        .where(eq(consultantWhatsappConfig.consultantId, consultantId))
        .groupBy(consultantWhatsappConfig.agentType),
      db.select({ count: count() })
        .from(consultantWhatsappConfig)
        .where(and(
          eq(consultantWhatsappConfig.consultantId, consultantId),
          isNotNull(consultantWhatsappConfig.twilioAccountSid),
          ne(consultantWhatsappConfig.twilioAccountSid, '')
        )),
      db.select({ count: count() })
        .from(whatsappAgentShares)
        .where(and(
          eq(whatsappAgentShares.consultantId, consultantId),
          eq(whatsappAgentShares.isActive, true)
        )),
      db.select({ count: count() })
        .from(consultantAiIdeas)
        .where(eq(consultantAiIdeas.consultantId, consultantId)),
      db.select({ count: count() })
        .from(universityYears)
        .where(eq(universityYears.createdBy, consultantId)),
      db.select({ count: count() })
        .from(exercises)
        .where(eq(exercises.createdBy, consultantId)),
      db.select({ count: count() })
        .from(emailDrafts)
        .where(and(
          eq(emailDrafts.consultantId, consultantId),
          eq(emailDrafts.emailType, 'consultation_summary'),
          eq(emailDrafts.status, 'sent')
        )),
      db.selectDistinct({ templateId: whatsappCustomTemplates.id })
        .from(whatsappCustomTemplates)
        .innerJoin(
          whatsappTemplateVersions,
          eq(whatsappTemplateVersions.templateId, whatsappCustomTemplates.id)
        )
        .where(and(
          eq(whatsappCustomTemplates.consultantId, consultantId),
          eq(whatsappTemplateVersions.twilioStatus, 'approved')
        )),
      db.select({ count: count() })
        .from(whatsappCustomTemplates)
        .where(eq(whatsappCustomTemplates.consultantId, consultantId)),
      db.select({ count: count() })
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.consultantId, consultantId)),
      db.select({ id: externalApiConfigs.id })
        .from(externalApiConfigs)
        .where(eq(externalApiConfigs.consultantId, consultantId))
        .limit(1),
      db.select({ id: consultantWhatsappConfig.id })
        .from(consultantWhatsappConfig)
        .where(and(
          eq(consultantWhatsappConfig.consultantId, consultantId),
          isNotNull(consultantWhatsappConfig.googleAccessToken),
          ne(consultantWhatsappConfig.googleAccessToken, '')
        )),
      db.query.consultantInstagramConfig.findFirst({
        where: eq(consultantInstagramConfig.consultantId, consultantId),
      }),
      db.query.consultantLicenses.findFirst({
        where: eq(consultantLicenses.consultantId, consultantId),
      })
    ]);
    
    const documentsCount = Number(docsResult[0]?.count || 0);
    const agentTypeMap = new Map(agentsByType.map(a => [a.agentType, Number(a.count)]));
    const hasTwilio = Number(twilioAgentResult[0]?.count || 0) > 0;
    const hasPublicLink = Number(publicLinksResult[0]?.count || 0) > 0;
    const hasIdeas = Number(ideasResult[0]?.count || 0) > 0;
    const hasCourse = Number(coursesResult[0]?.count || 0) > 0;
    const hasExercise = Number(exercisesResult[0]?.count || 0) > 0;
    const hasSummaryEmail = Number(summaryEmailResult[0]?.count || 0) > 0;
    const hasApprovedTemplate = approvedTemplatesResult.length > 0;
    const hasMoreTemplates = Number(moreTemplatesResult[0]?.count || 0) > 1;
    const hasCampaign = Number(campaignsResult[0]?.count || 0) > 0;
    const hasLeadImport = leadImportConfigResult.length > 0;
    const hasCalendar = agentCalendarResult.length > 0;
    const hasInstagram = !!(instagramConfig?.instagramPageId && instagramConfig?.pageAccessToken);
    const hasStripeAccount = !!license?.stripeAccountId;
    const stripeAccountStatus = license?.stripeAccountStatus;
    
    type OnboardingStepStatus = 'pending' | 'configured' | 'verified' | 'error' | 'skipped';
    type OnboardingStepId = 
      | 'vertex_ai' | 'smtp' | 'google_calendar' | 'twilio' | 'instagram' | 'whatsapp_template' | 'first_campaign'
      | 'agent_inbound' | 'agent_outbound' | 'agent_consultative' | 'agent_public_link' | 'agent_ideas' | 'more_templates'
      | 'first_course' | 'first_exercise' | 'knowledge_base'
      | 'summary_email' | 'turn_config' | 'lead_import' | 'stripe_connect';
    
    interface OnboardingStatus {
      stepId: OnboardingStepId;
      status: OnboardingStepStatus;
    }
    
    // Helper to determine status: prioritize verified status from onboardingStatus table,
    // then fall back to checking if credentials exist (configured), otherwise pending
    const getStepStatus = (
      savedStatus: 'pending' | 'configured' | 'verified' | 'error' | undefined | null,
      hasCredentials: boolean
    ): OnboardingStepStatus => {
      if (savedStatus === 'verified') return 'verified';
      if (savedStatus === 'error') return 'error';
      if (hasCredentials) return 'configured';
      return 'pending';
    };
    
    // Determine Stripe Connect status
    const getStripeStatus = (): OnboardingStepStatus => {
      if (!hasStripeAccount) return 'pending';
      if (stripeAccountStatus === 'active') return 'verified';
      if (stripeAccountStatus === 'restricted' || stripeAccountStatus === 'pending') return 'configured';
      return 'pending';
    };
    
    const statuses: OnboardingStatus[] = [
      { stepId: 'vertex_ai', status: getStepStatus(onboardingStatus?.vertexAiStatus, !!vertexSettings?.projectId || !!consultant?.useSuperadminVertex) },
      { stepId: 'smtp', status: getStepStatus(onboardingStatus?.smtpStatus, !!smtpSettings?.smtpHost) },
      { stepId: 'google_calendar', status: getStepStatus(onboardingStatus?.googleCalendarStatus, hasCalendar) },
      { stepId: 'twilio', status: hasTwilio ? 'verified' : 'pending' },
      { stepId: 'instagram', status: hasInstagram ? 'verified' : 'pending' },
      { stepId: 'whatsapp_template', status: hasApprovedTemplate ? 'verified' : 'pending' },
      { stepId: 'first_campaign', status: hasCampaign ? 'verified' : 'pending' },
      { stepId: 'agent_inbound', status: (agentTypeMap.get('reactive_lead') || 0) > 0 ? 'verified' : 'pending' },
      { stepId: 'agent_outbound', status: (agentTypeMap.get('proactive_setter') || 0) > 0 ? 'verified' : 'pending' },
      { stepId: 'agent_consultative', status: (agentTypeMap.get('informative_advisor') || 0) > 0 ? 'verified' : 'pending' },
      { stepId: 'agent_public_link', status: hasPublicLink ? 'verified' : 'pending' },
      { stepId: 'agent_ideas', status: hasIdeas ? 'verified' : 'pending' },
      { stepId: 'more_templates', status: hasMoreTemplates ? 'verified' : 'pending' },
      { stepId: 'first_course', status: hasCourse ? 'verified' : 'pending' },
      { stepId: 'first_exercise', status: hasExercise ? 'verified' : 'pending' },
      { stepId: 'knowledge_base', status: documentsCount > 0 ? 'verified' : 'pending' },
      { stepId: 'summary_email', status: hasSummaryEmail ? 'verified' : 'pending' },
      { stepId: 'turn_config', status: getStepStatus(onboardingStatus?.videoMeetingStatus, !!turnConfig?.usernameEncrypted) },
      { stepId: 'lead_import', status: hasLeadImport ? 'verified' : 'pending' },
      { stepId: 'stripe_connect', status: getStripeStatus() },
    ];
    
    res.json({
      success: true,
      data: statuses,
    });
  } catch (error: any) {
    console.error('Error fetching onboarding status for AI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch onboarding status for AI',
    });
  }
});

router.put('/status/:step', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { step } = req.params;
    const { status, errorMessage } = req.body;
    
    const validSteps = [
      'vertex_ai', 'smtp', 'google_calendar', 'video_meeting',
      'lead_import', 'whatsapp_ai', 'knowledge_base', 'client_ai_strategy',
      'twilio_agent'
    ];
    
    if (!validSteps.includes(step)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid step',
      });
    }
    
    const statusField = `${step.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}Status` as keyof typeof consultantOnboardingStatus;
    const testedAtField = `${step.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}TestedAt`;
    const errorField = `${step.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}ErrorMessage`;
    
    const updateData: any = {
      [statusField]: status,
      lastUpdatedStep: step,
      updatedAt: new Date(),
    };
    
    if (status === 'verified' || status === 'error') {
      updateData[testedAtField] = new Date();
    }
    
    if (errorMessage) {
      updateData[errorField] = errorMessage;
    } else if (status === 'verified') {
      updateData[errorField] = null;
    }
    
    const [updated] = await db.update(consultantOnboardingStatus)
      .set(updateData)
      .where(eq(consultantOnboardingStatus.consultantId, consultantId))
      .returning();
    
    if (!updated) {
      await db.insert(consultantOnboardingStatus)
        .values({ consultantId, ...updateData });
    }
    
    res.json({
      success: true,
      message: 'Status updated',
    });
  } catch (error: any) {
    console.error('Error updating onboarding status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update status',
    });
  }
});

router.post('/test/vertex-ai', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    // Check if consultant uses SuperAdmin Vertex AI
    const consultant = await db.query.users.findFirst({
      where: eq(users.id, consultantId),
      columns: { useSuperadminVertex: true },
    });
    
    if (consultant?.useSuperadminVertex) {
      // Test SuperAdmin Vertex AI configuration
      const superadminConfig = await db.query.superadminVertexConfig.findFirst({
        where: eq(superadminVertexConfig.enabled, true),
      });
      
      if (!superadminConfig) {
        return res.status(400).json({
          success: false,
          error: 'SuperAdmin Vertex AI non configurato. Contatta il supporto.',
        });
      }
      
      let serviceAccountJson;
      try {
        serviceAccountJson = JSON.parse(superadminConfig.serviceAccountJson);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Errore nel parsing delle credenziali SuperAdmin Vertex AI.',
        });
      }
      
      try {
        const vertexAI = new VertexAI({
          project: superadminConfig.projectId,
          location: superadminConfig.location,
          googleAuthOptions: {
            credentials: serviceAccountJson,
          },
        });
        
        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent('Rispondi solo "OK" se funziona.');
        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        await db.update(consultantOnboardingStatus)
          .set({
            vertexAiStatus: 'verified',
            vertexAiTestedAt: new Date(),
            vertexAiErrorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(consultantOnboardingStatus.consultantId, consultantId));
        
        res.json({
          success: true,
          message: 'SuperAdmin Vertex AI funziona correttamente!',
          response: text.substring(0, 100),
          source: 'superadmin',
        });
      } catch (vertexError: any) {
        await db.update(consultantOnboardingStatus)
          .set({
            vertexAiStatus: 'error',
            vertexAiTestedAt: new Date(),
            vertexAiErrorMessage: vertexError.message,
            updatedAt: new Date(),
          })
          .where(eq(consultantOnboardingStatus.consultantId, consultantId));
        
        res.status(400).json({
          success: false,
          error: `Test SuperAdmin Vertex AI fallito: ${vertexError.message}`,
        });
      }
      return;
    }
    
    // Test consultant's own Vertex AI configuration
    const vertexSettings = await db.query.vertexAiSettings.findFirst({
      where: eq(vertexAiSettings.userId, consultantId),
    });
    
    if (!vertexSettings) {
      return res.status(400).json({
        success: false,
        error: 'Vertex AI non configurato. Vai su API Keys per configurarlo.',
      });
    }
    
    let serviceAccountJson;
    try {
      // Vertex AI credentials are stored in plain text
      serviceAccountJson = JSON.parse(vertexSettings.serviceAccountJson);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Errore nel parsing delle credenziali Vertex AI. Verifica che il JSON sia valido.',
      });
    }
    
    try {
      const vertexAI = new VertexAI({
        project: vertexSettings.projectId,
        location: vertexSettings.location,
        googleAuthOptions: {
          credentials: serviceAccountJson,
        },
      });
      
      const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent('Rispondi solo "OK" se funziona.');
      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      await db.update(consultantOnboardingStatus)
        .set({
          vertexAiStatus: 'verified',
          vertexAiTestedAt: new Date(),
          vertexAiErrorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.json({
        success: true,
        message: 'Vertex AI funziona correttamente!',
        response: text.substring(0, 100),
        source: 'own',
      });
    } catch (vertexError: any) {
      await db.update(consultantOnboardingStatus)
        .set({
          vertexAiStatus: 'error',
          vertexAiTestedAt: new Date(),
          vertexAiErrorMessage: vertexError.message,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.status(400).json({
        success: false,
        error: `Test Vertex AI fallito: ${vertexError.message}`,
      });
    }
  } catch (error: any) {
    console.error('Error testing Vertex AI:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante il test',
    });
  }
});

router.post('/test/smtp', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const smtpSettings = await storage.getConsultantSmtpSettings(consultantId);
    
    if (!smtpSettings) {
      return res.status(400).json({
        success: false,
        message: 'SMTP non configurato. Vai su Impostazioni Email per configurarlo.',
      });
    }
    
    try {
      // SMTP password is stored in plain text
      const transporter = nodemailer.createTransport({
        host: smtpSettings.smtpHost,
        port: smtpSettings.smtpPort,
        secure: smtpSettings.smtpSecure,
        auth: {
          user: smtpSettings.smtpUser,
          pass: smtpSettings.smtpPassword,
        },
      });
      
      await transporter.verify();
      
      await db.update(consultantOnboardingStatus)
        .set({
          smtpStatus: 'verified',
          smtpTestedAt: new Date(),
          smtpErrorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.json({
        success: true,
        message: 'Connessione SMTP verificata con successo!',
        details: { host: smtpSettings.smtpHost, user: smtpSettings.smtpUser },
      });
    } catch (smtpError: any) {
      await db.update(consultantOnboardingStatus)
        .set({
          smtpStatus: 'error',
          smtpTestedAt: new Date(),
          smtpErrorMessage: smtpError.message,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.status(400).json({
        success: false,
        message: `Test SMTP fallito: ${smtpError.message}`,
      });
    }
  } catch (error: any) {
    console.error('Error testing SMTP:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il test SMTP',
    });
  }
});

router.post('/test/google-calendar', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    // Check if any agent has Google Calendar connected (requires both tokens)
    const agentsWithCalendar = await db.query.consultantWhatsappConfig.findMany({
      where: and(
        eq(consultantWhatsappConfig.consultantId, consultantId),
        sql`${consultantWhatsappConfig.googleRefreshToken} IS NOT NULL`,
        sql`${consultantWhatsappConfig.googleAccessToken} IS NOT NULL`
      ),
    });
    
    if (agentsWithCalendar.length === 0) {
      await db.update(consultantOnboardingStatus)
        .set({
          googleCalendarStatus: 'error',
          googleCalendarTestedAt: new Date(),
          googleCalendarErrorMessage: 'Nessun agente ha Google Calendar connesso',
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      return res.status(400).json({
        success: false,
        message: 'Nessun agente ha Google Calendar connesso. Vai nella sezione Dipendenti/Agenti e collega il calendario a un agente.',
      });
    }
    
    // Test the first agent's calendar connection
    const firstAgent = agentsWithCalendar[0];
    try {
      const calendar = await getAgentCalendarClient(firstAgent.id);
      const calendarList = await calendar.calendarList.list();
      const calendarsCount = calendarList.data.items?.length || 0;
      
      await db.update(consultantOnboardingStatus)
        .set({
          googleCalendarStatus: 'verified',
          googleCalendarTestedAt: new Date(),
          googleCalendarErrorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      const agentNames = agentsWithCalendar.map(a => a.agentName).join(', ');
      res.json({
        success: true,
        message: `Google Calendar connesso! ${agentsWithCalendar.length} agente/i con calendario: ${agentNames}`,
        details: { 
          calendarsCount,
          agentsWithCalendar: agentsWithCalendar.length,
          agentNames 
        },
      });
    } catch (calendarError: any) {
      await db.update(consultantOnboardingStatus)
        .set({
          googleCalendarStatus: 'error',
          googleCalendarTestedAt: new Date(),
          googleCalendarErrorMessage: calendarError.message,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.status(400).json({
        success: false,
        message: `Test Google Calendar fallito per agente "${firstAgent.agentName}": ${calendarError.message}`,
      });
    }
  } catch (error: any) {
    console.error('Error testing Google Calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il test Google Calendar',
    });
  }
});

// Test Google Calendar for a specific agent
router.post('/test/google-calendar-agent/:agentId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { agentId } = req.params;
    
    // Verify the agent belongs to this consultant
    const agent = await db.query.consultantWhatsappConfig.findFirst({
      where: and(
        eq(consultantWhatsappConfig.id, agentId),
        eq(consultantWhatsappConfig.consultantId, consultantId)
      ),
    });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente non trovato o non appartenente a questo consultant.',
      });
    }
    
    // Check if agent has calendar connected
    if (!agent.googleAccessToken || !agent.googleRefreshToken) {
      return res.status(400).json({
        success: false,
        message: `L'agente "${agent.agentName}" non ha Google Calendar connesso. Vai nelle impostazioni dell'agente per collegare il calendario.`,
      });
    }
    
    try {
      const calendar = await getAgentCalendarClient(agentId);
      const calendarList = await calendar.calendarList.list();
      const calendarsCount = calendarList.data.items?.length || 0;
      
      res.json({
        success: true,
        message: `Google Calendar dell'agente "${agent.agentName}" connesso con successo! Account: ${agent.googleCalendarEmail || 'N/A'}, ${calendarsCount} calendari disponibili.`,
        details: { 
          calendarsCount, 
          agentName: agent.agentName,
          calendarEmail: agent.googleCalendarEmail 
        },
      });
    } catch (calendarError: any) {
      res.status(400).json({
        success: false,
        message: `Test Google Calendar per agente "${agent.agentName}" fallito: ${calendarError.message}`,
      });
    }
  } catch (error: any) {
    console.error('Error testing agent Google Calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il test Google Calendar per agente',
    });
  }
});

router.post('/test/video-meeting', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const turnConfig = await db.query.consultantTurnConfig.findFirst({
      where: eq(consultantTurnConfig.consultantId, consultantId),
    });
    
    if (!turnConfig || (!turnConfig.apiKeyEncrypted && !turnConfig.usernameEncrypted)) {
      return res.status(400).json({
        success: false,
        message: 'Credenziali TURN non configurate. Vai su Impostazioni Video per configurarle.',
      });
    }
    
    try {
      // TURN config uses encryptForConsultant with salt
      const [consultant] = await db.select({ encryptionSalt: users.encryptionSalt })
        .from(users)
        .where(eq(users.id, consultantId))
        .limit(1);
      
      if (!consultant?.encryptionSalt) {
        throw new Error('Salt di crittografia non trovato per il consultant');
      }
      
      // Use apiKeyEncrypted if available, otherwise try usernameEncrypted for backwards compatibility
      const encryptedApiKey = turnConfig.apiKeyEncrypted || turnConfig.usernameEncrypted;
      if (!encryptedApiKey) {
        throw new Error('API Key Metered non trovata nella configurazione');
      }
      const decryptedApiKey = decryptForConsultant(encryptedApiKey, consultant.encryptionSalt);
      
      const response = await fetch(`https://global.relay.metered.ca/api/v1/turn/credentials?apiKey=${decryptedApiKey}`);
      
      if (response.ok) {
        const data = await response.json();
        
        await db.update(consultantOnboardingStatus)
          .set({
            videoMeetingStatus: 'verified',
            videoMeetingTestedAt: new Date(),
            videoMeetingErrorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(consultantOnboardingStatus.consultantId, consultantId));
        
        res.json({
          success: true,
          message: 'Credenziali TURN verificate con successo!',
          details: { credentialsCount: Array.isArray(data) ? data.length : 1 },
        });
      } else {
        const errorText = await response.text();
        throw new Error(`API Metered ha risposto con status ${response.status}: ${errorText}`);
      }
    } catch (turnError: any) {
      await db.update(consultantOnboardingStatus)
        .set({
          videoMeetingStatus: 'error',
          videoMeetingTestedAt: new Date(),
          videoMeetingErrorMessage: turnError.message,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.status(400).json({
        success: false,
        message: `Test TURN fallito: ${turnError.message}`,
      });
    }
  } catch (error: any) {
    console.error('Error testing Video Meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il test Video Meeting',
    });
  }
});

router.post('/test/lead-import', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const apiConfig = await db.query.externalApiConfigs.findFirst({
      where: eq(externalApiConfigs.consultantId, consultantId),
    });
    
    if (!apiConfig) {
      await db.update(consultantOnboardingStatus)
        .set({
          leadImportStatus: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      return res.json({
        success: true,
        message: 'Lead Import non configurato. Questo passaggio può essere saltato se non utilizzi API esterne.',
        details: { skippable: true },
      });
    }
    
    try {
      if (!apiConfig.apiKey || !apiConfig.baseUrl) {
        throw new Error('Configurazione API incompleta: manca API key o base URL');
      }
      
      const decryptedApiKey = storage.decryptData(apiConfig.apiKey);
      
      const response = await fetch(apiConfig.baseUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${decryptedApiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok || response.status === 401 || response.status === 403) {
        await db.update(consultantOnboardingStatus)
          .set({
            leadImportStatus: response.ok ? 'verified' : 'error',
            leadImportTestedAt: new Date(),
            leadImportErrorMessage: response.ok ? null : 'Autenticazione API fallita',
            updatedAt: new Date(),
          })
          .where(eq(consultantOnboardingStatus.consultantId, consultantId));
        
        if (response.ok) {
          res.json({
            success: true,
            message: 'API Lead Import connessa con successo!',
            details: { provider: apiConfig.provider },
          });
        } else {
          res.status(400).json({
            success: false,
            message: 'Autenticazione API fallita. Verifica le credenziali.',
          });
        }
      } else {
        throw new Error(`API ha risposto con status ${response.status}`);
      }
    } catch (apiError: any) {
      await db.update(consultantOnboardingStatus)
        .set({
          leadImportStatus: 'error',
          leadImportTestedAt: new Date(),
          leadImportErrorMessage: apiError.message,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.status(400).json({
        success: false,
        message: `Test Lead Import fallito: ${apiError.message}`,
      });
    }
  } catch (error: any) {
    console.error('Error testing Lead Import:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il test Lead Import',
    });
  }
});

router.post('/test/whatsapp-ai', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    // NEW UNIFIED APPROACH: Check SuperAdmin Vertex first, then consultant's own vertexAiSettings
    let vertexSettings: { projectId: string; location: string; serviceAccountJson: string } | null = null;
    let source = '';
    
    // 1. Check if consultant can use SuperAdmin Vertex
    const [consultant] = await db.select({ useSuperadminVertex: users.useSuperadminVertex })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);
    
    if (consultant?.useSuperadminVertex) {
      const [accessRecord] = await db.select({ hasAccess: consultantVertexAccess.hasAccess })
        .from(consultantVertexAccess)
        .where(eq(consultantVertexAccess.consultantId, consultantId))
        .limit(1);
      
      const hasAccess = accessRecord?.hasAccess ?? true;
      
      if (hasAccess) {
        const [superadminConfig] = await db.select()
          .from(superadminVertexConfig)
          .where(eq(superadminVertexConfig.enabled, true))
          .limit(1);
        
        if (superadminConfig) {
          vertexSettings = superadminConfig;
          source = 'SuperAdmin';
        }
      }
    }
    
    // 2. Fallback: Check consultant's own vertexAiSettings
    if (!vertexSettings) {
      const [consultantVertex] = await db.select()
        .from(vertexAiSettings)
        .where(and(
          eq(vertexAiSettings.userId, consultantId),
          eq(vertexAiSettings.enabled, true)
        ))
        .limit(1);
      
      if (consultantVertex) {
        vertexSettings = consultantVertex;
        source = 'Consultant';
      }
    }
    
    if (!vertexSettings) {
      return res.status(400).json({
        success: false,
        message: 'Vertex AI per WhatsApp non configurato. Configura Vertex AI nelle impostazioni.',
      });
    }
    
    try {
      const serviceAccountJson = JSON.parse(vertexSettings.serviceAccountJson);
      
      const vertexAI = new VertexAI({
        project: vertexSettings.projectId,
        location: vertexSettings.location,
        googleAuthOptions: {
          credentials: serviceAccountJson,
        },
      });
      
      const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent('Rispondi solo "OK" se funziona.');
      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      await db.update(consultantOnboardingStatus)
        .set({
          whatsappAiStatus: 'verified',
          whatsappAiTestedAt: new Date(),
          whatsappAiErrorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.json({
        success: true,
        message: `Vertex AI per WhatsApp funziona correttamente! (fonte: ${source})`,
        details: { response: text.substring(0, 100), source },
      });
    } catch (vertexError: any) {
      await db.update(consultantOnboardingStatus)
        .set({
          whatsappAiStatus: 'error',
          whatsappAiTestedAt: new Date(),
          whatsappAiErrorMessage: vertexError.message,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.status(400).json({
        success: false,
        message: `Test WhatsApp AI fallito: ${vertexError.message}`,
      });
    }
  } catch (error: any) {
    console.error('Error testing WhatsApp AI:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il test WhatsApp AI',
    });
  }
});

router.post('/test/twilio-agent', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const agentWithTwilio = await db.query.consultantWhatsappConfig.findFirst({
      where: and(
        eq(consultantWhatsappConfig.consultantId, consultantId),
        sql`twilio_account_sid IS NOT NULL AND twilio_account_sid != ''`,
        sql`twilio_auth_token IS NOT NULL AND twilio_auth_token != ''`
      )
    });
    
    if (!agentWithTwilio) {
      await db.update(consultantOnboardingStatus)
        .set({
          twilioAgentStatus: 'pending',
          twilioAgentTestedAt: new Date(),
          twilioAgentErrorMessage: 'Nessun agente con credenziali Twilio configurate.',
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      return res.status(400).json({
        success: false,
        message: 'Nessun agente WhatsApp con credenziali Twilio configurate. Configura Twilio Account SID e Auth Token in almeno un agente.',
      });
    }
    
    await db.update(consultantOnboardingStatus)
      .set({
        twilioAgentStatus: 'verified',
        twilioAgentTestedAt: new Date(),
        twilioAgentErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(consultantOnboardingStatus.consultantId, consultantId));
    
    res.json({
      success: true,
      message: `Credenziali Twilio configurate correttamente nell'agente "${agentWithTwilio.name}"!`,
      details: { agentName: agentWithTwilio.name },
    });
  } catch (error: any) {
    console.error('Error testing Twilio Agent:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il test Twilio Agent',
    });
  }
});

router.post('/test/instagram', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const encryptionSalt = req.user!.encryptionSalt;
    
    const config = await db.query.consultantInstagramConfig.findFirst({
      where: eq(consultantInstagramConfig.consultantId, consultantId),
    });
    
    if (!config || !config.instagramPageId || !config.pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Configurazione Instagram incompleta. Inserisci Page ID e Access Token nella tab Instagram delle API Keys.',
      });
    }
    
    // Decrypt token - try per-consultant first, then legacy
    let accessToken = config.pageAccessToken;
    if (encryptionSalt) {
      try {
        accessToken = decryptForConsultant(config.pageAccessToken, encryptionSalt);
      } catch (e) {
        // Token might be encrypted with legacy method, try that
        try {
          accessToken = decrypt(config.pageAccessToken);
        } catch (e2) {
          // Token might not be encrypted at all
        }
      }
    } else {
      // No salt, try legacy decryption
      try {
        accessToken = decrypt(config.pageAccessToken);
      } catch (e) {
        // Token might not be encrypted
      }
    }
    
    // Test API connection
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${config.instagramPageId}?fields=id,username,name&access_token=${accessToken}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      return res.status(400).json({
        success: false,
        message: `Errore API Instagram: ${error.error?.message || "Token non valido o scaduto"}`,
      });
    }
    
    const pageInfo = await response.json();
    
    res.json({
      success: true,
      message: `Connesso a Instagram come @${pageInfo.username || pageInfo.name}!`,
      details: { 
        pageId: pageInfo.id,
        username: pageInfo.username,
        name: pageInfo.name,
      },
    });
  } catch (error: any) {
    console.error('Error testing Instagram:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il test Instagram',
    });
  }
});

router.post('/test/knowledge-base', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const docsResult = await db.select({ count: count() })
      .from(consultantKnowledgeDocuments)
      .where(eq(consultantKnowledgeDocuments.consultantId, consultantId));
    const documentsCount = Number(docsResult[0]?.count) || 0;
    
    if (documentsCount >= 1) {
      await db.update(consultantOnboardingStatus)
        .set({
          knowledgeBaseStatus: 'verified',
          knowledgeBaseTestedAt: new Date(),
          knowledgeBaseErrorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.json({
        success: true,
        message: `Knowledge Base configurata con ${documentsCount} documenti.`,
        details: { documentsCount },
      });
    } else {
      await db.update(consultantOnboardingStatus)
        .set({
          knowledgeBaseStatus: 'pending',
          knowledgeBaseTestedAt: new Date(),
          knowledgeBaseErrorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(consultantOnboardingStatus.consultantId, consultantId));
      
      res.json({
        success: true,
        message: 'Nessun documento caricato. Carica almeno un documento nella Knowledge Base.',
        details: { documentsCount: 0, needsConfiguration: true },
      });
    }
  } catch (error: any) {
    console.error('Error testing Knowledge Base:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il test Knowledge Base',
    });
  }
});

router.post('/complete', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    await db.update(consultantOnboardingStatus)
      .set({
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(consultantOnboardingStatus.consultantId, consultantId));
    
    res.json({
      success: true,
      message: 'Onboarding completato!',
    });
  } catch (error: any) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete onboarding',
    });
  }
});

router.put('/client-ai-strategy', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { strategy } = req.body;
    
    if (!['vertex_shared', 'vertex_per_client', 'undecided'].includes(strategy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strategy',
      });
    }
    
    await db.update(consultantOnboardingStatus)
      .set({
        clientAiStrategy: strategy,
        updatedAt: new Date(),
      })
      .where(eq(consultantOnboardingStatus.consultantId, consultantId));
    
    res.json({
      success: true,
      message: 'Strategy updated',
    });
  } catch (error: any) {
    console.error('Error updating client AI strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update strategy',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI Ideas CRUD API
// ═══════════════════════════════════════════════════════════════════════════

router.get('/ai-ideas', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const ideas = await db.select()
      .from(consultantAiIdeas)
      .where(eq(consultantAiIdeas.consultantId, consultantId))
      .orderBy(consultantAiIdeas.createdAt);
    
    res.json({
      success: true,
      data: ideas,
    });
  } catch (error: any) {
    console.error('Error fetching AI ideas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AI ideas',
    });
  }
});

router.post('/ai-ideas', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { 
      name, description, targetAudience, agentType, integrationTypes, sourceType,
      suggestedAgentType, personality, whoWeHelp, whoWeDontHelp, whatWeDo, howWeDoIt, usp, suggestedInstructions, useCases,
      vision, mission, businessName, consultantDisplayName
    } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Name and description are required',
      });
    }
    
    const [newIdea] = await db.insert(consultantAiIdeas)
      .values({
        consultantId,
        name,
        description,
        targetAudience: targetAudience || null,
        agentType: agentType || 'whatsapp',
        integrationTypes: integrationTypes || [],
        sourceType: sourceType || 'generated',
        suggestedAgentType: suggestedAgentType || 'reactive_lead',
        personality: personality || null,
        whoWeHelp: whoWeHelp || null,
        whoWeDontHelp: whoWeDontHelp || null,
        whatWeDo: whatWeDo || null,
        howWeDoIt: howWeDoIt || null,
        usp: usp || null,
        suggestedInstructions: suggestedInstructions || null,
        useCases: useCases || [],
        vision: vision || null,
        mission: mission || null,
        businessName: businessName || null,
        consultantDisplayName: consultantDisplayName || null,
      })
      .returning();
    
    res.json({
      success: true,
      data: newIdea,
    });
  } catch (error: any) {
    console.error('Error creating AI idea:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create AI idea',
    });
  }
});

router.post('/ai-ideas/bulk', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { ideas } = req.body;
    
    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ideas array is required',
      });
    }
    
    const ideasToInsert = ideas.map((idea: any) => ({
      consultantId,
      name: idea.name,
      description: idea.description,
      targetAudience: idea.targetAudience || null,
      agentType: idea.agentType || 'whatsapp',
      integrationTypes: idea.integrationTypes || [],
      sourceType: idea.sourceType || 'generated',
    }));
    
    const newIdeas = await db.insert(consultantAiIdeas)
      .values(ideasToInsert)
      .returning();
    
    res.json({
      success: true,
      data: newIdeas,
      count: newIdeas.length,
    });
  } catch (error: any) {
    console.error('Error creating AI ideas in bulk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create AI ideas',
    });
  }
});

router.delete('/ai-ideas/:id', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;
    
    const [deleted] = await db.delete(consultantAiIdeas)
      .where(and(
        eq(consultantAiIdeas.id, id),
        eq(consultantAiIdeas.consultantId, consultantId)
      ))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Idea not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Idea deleted',
    });
  } catch (error: any) {
    console.error('Error deleting AI idea:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete AI idea',
    });
  }
});

router.put('/ai-ideas/:id/implement', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;
    const { implementedAgentId } = req.body;
    
    const [updated] = await db.update(consultantAiIdeas)
      .set({
        isImplemented: true,
        implementedAgentId: implementedAgentId || null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(consultantAiIdeas.id, id),
        eq(consultantAiIdeas.consultantId, consultantId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Idea not found',
      });
    }
    
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error marking idea as implemented:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update idea',
    });
  }
});

router.get('/ai-ideas/:id', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;
    
    const idea = await db.query.consultantAiIdeas.findFirst({
      where: and(
        eq(consultantAiIdeas.id, id),
        eq(consultantAiIdeas.consultantId, consultantId)
      ),
    });
    
    if (!idea) {
      return res.status(404).json({
        success: false,
        error: 'Idea not found',
      });
    }
    
    res.json({
      success: true,
      data: idea,
    });
  } catch (error: any) {
    console.error('Error fetching AI idea:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AI idea',
    });
  }
});

router.post('/ai-ideas/upload-files', authenticateToken, requireRole('consultant'), upload.array('files', 10), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessun file caricato',
      });
    }
    
    console.log(`📁 [AI-IDEAS] Processing ${files.length} uploaded files`);
    
    const extractedTexts: { fileName: string; text: string; error?: string }[] = [];
    
    for (const file of files) {
      try {
        console.log(`📄 [AI-IDEAS] Extracting text from: ${file.originalname} (${file.mimetype})`);
        const text = await extractTextFromFile(file.path, file.mimetype);
        extractedTexts.push({
          fileName: file.originalname,
          text: text.substring(0, 10000),
        });
        console.log(`✅ [AI-IDEAS] Extracted ${text.length} chars from ${file.originalname}`);
      } catch (extractError: any) {
        console.error(`❌ [AI-IDEAS] Failed to extract from ${file.originalname}:`, extractError.message);
        extractedTexts.push({
          fileName: file.originalname,
          text: '',
          error: extractError.message,
        });
      } finally {
        try {
          await fs.unlink(file.path);
        } catch (e) {
        }
      }
    }
    
    res.json({
      success: true,
      data: extractedTexts,
    });
  } catch (error: any) {
    console.error('Error processing uploaded files:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante l\'elaborazione dei file',
    });
  }
});

router.post('/ai-ideas/improve-text', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }
    
    const providerResult = await getAIProvider(consultantId, consultantId);
    
    if (!providerResult || !providerResult.client) {
      return res.status(400).json({
        success: false,
        error: 'AI non disponibile. Configura Vertex AI o Google AI Studio.',
      });
    }
    
    const prompt = `Sei un esperto copywriter italiano. Migliora e espandi il seguente testo di descrizione business, mantenendo le informazioni originali ma:
- Rendilo più professionale e dettagliato
- Aggiungi dettagli su servizi, target audience, valori
- Espandilo a circa 200-300 parole
- Mantieni un tono professionale ma accessibile
- NON inventare informazioni false, solo espandi e migliora ciò che è già presente

TESTO ORIGINALE:
${text}

TESTO MIGLIORATO (rispondi SOLO con il testo migliorato, senza introduzioni o commenti):`;
    
    const { model: improveModel, useThinking: improveUseThinking, thinkingLevel: improveThinkingLevel } = getModelWithThinking(providerResult.metadata?.name || 'Vertex AI');
    console.log(`🧠 [ONBOARDING] Improve text using model: ${improveModel} with thinking: ${improveUseThinking ? improveThinkingLevel : 'disabled'}`);
    
    const result = await providerResult.client.generateContent({
      model: improveModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        ...(improveUseThinking && { thinkingConfig: { thinkingLevel: improveThinkingLevel } })
      }
    });
    const improvedText = result.response.text() || text;
    
    res.json({
      success: true,
      improvedText: improvedText.trim(),
    });
  } catch (error: any) {
    console.error('Error improving text:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante il miglioramento del testo',
    });
  }
});

router.post('/ai-ideas/generate', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { textDescription, urls, knowledgeDocIds, integrations, numberOfIdeas, uploadedFilesText, businessName, consultantDisplayName } = req.body;
    
    if (!integrations || integrations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Seleziona almeno un\'integrazione (booking o consultation)',
      });
    }
    
    const providerResult = await getAIProvider(consultantId, consultantId);
    
    if (!providerResult || !providerResult.client) {
      return res.status(400).json({
        success: false,
        error: 'AI non disponibile. Configura Vertex AI o Google AI Studio.',
      });
    }
    
    let combinedContent = '';
    
    if (businessName) {
      combinedContent += `\n\nNOME BUSINESS: ${businessName}`;
    }
    
    if (consultantDisplayName) {
      combinedContent += `\nNOME CONSULENTE: ${consultantDisplayName}`;
    }
    
    if (textDescription) {
      combinedContent += `\n\nDESCRIZIONE BUSINESS:\n${textDescription}`;
    }
    
    if (knowledgeDocIds && knowledgeDocIds.length > 0) {
      const docs = await db.select()
        .from(consultantKnowledgeDocuments)
        .where(and(
          eq(consultantKnowledgeDocuments.consultantId, consultantId),
          inArray(consultantKnowledgeDocuments.id, knowledgeDocIds)
        ));
      
      for (const doc of docs) {
        if (doc.extractedContent) {
          combinedContent += `\n\nDOCUMENTO "${doc.fileName}":\n${doc.extractedContent.substring(0, 5000)}`;
        }
      }
    }
    
    if (urls && urls.length > 0) {
      combinedContent += `\n\nURL DA ANALIZZARE: ${urls.filter((u: string) => u).join(', ')}`;
    }
    
    if (uploadedFilesText && uploadedFilesText.length > 0) {
      for (const fileData of uploadedFilesText) {
        if (fileData.text) {
          combinedContent += `\n\nFILE CARICATO "${fileData.fileName}":\n${fileData.text.substring(0, 5000)}`;
        }
      }
    }
    
    if (!combinedContent.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Fornisci almeno una fonte: testo, documenti o URL',
      });
    }
    
    // Map selected agent types to their descriptions
    const agentTypeDescriptions: Record<string, string> = {
      'reactive_lead': 'Agente INBOUND/RECEPTIONIST che riceve messaggi, risponde e può prenotare appuntamenti',
      'proactive_setter': 'Agente OUTBOUND/SETTER che contatta proattivamente i lead per fissare appuntamenti',
      'informative_advisor': 'Agente CONSULENZIALE/EDUCATIVO che informa ed educa senza prenotare appuntamenti',
      'customer_success': 'Agente CUSTOMER SUCCESS post-vendita che supporta i clienti esistenti, gestisce retention e upselling',
      'intake_coordinator': 'Agente INTAKE COORDINATOR che raccoglie documenti, informazioni preliminari e prepara i clienti prima delle consulenze'
    };
    
    // Filter only selected agent types
    const selectedAgentTypes = integrations.filter((i: string) => 
      ['reactive_lead', 'proactive_setter', 'informative_advisor', 'customer_success', 'intake_coordinator'].includes(i)
    );
    
    const selectedAgentTypesDescription = selectedAgentTypes.map((type: string) => 
      `- ${type}: ${agentTypeDescriptions[type] || type}`
    ).join('\n');
    
    // Build the allowed types string for the prompt
    const allowedTypesEnum = selectedAgentTypes.map((t: string) => `"${t}"`).join(' | ');
    
    const prompt = `Sei un esperto di automazione WhatsApp per business. Analizza il seguente contesto aziendale e genera ${numberOfIdeas || 3} idee per agenti AI WhatsApp.

CONTESTO AZIENDALE:
${combinedContent}

TIPI DI AGENTE SELEZIONATI DALL'UTENTE (GENERA SOLO TRA QUESTI):
${selectedAgentTypesDescription}

Per ogni idea, genera un JSON con questa struttura ESATTA:
{
  "name": "Nome breve dell'agente (max 30 caratteri)",
  "description": "Descrizione completa di cosa fa l'agente (2-3 frasi)",
  "personality": "professionale" | "amichevole" | "empatico" | "diretto",
  "suggestedAgentType": ${allowedTypesEnum || '"reactive_lead"'},
  "integrations": ["booking"] e/o ["consultation"],
  "useCases": ["Caso d'uso 1", "Caso d'uso 2", "Caso d'uso 3"],
  "whoWeHelp": "Chi aiutiamo (target audience)",
  "whoWeDontHelp": "Chi NON aiutiamo",
  "whatWeDo": "Cosa facciamo per loro",
  "howWeDoIt": "Come lo facciamo",
  "usp": "Punto di forza unico",
  "vision": "La visione a lungo termine del business (es: 'Rendere l'automazione accessibile a tutti')",
  "mission": "La missione quotidiana del business (es: 'Aiutare le PMI a risparmiare tempo con l'AI')",
  "businessName": "Nome del business/azienda estratto dal contesto (se disponibile, altrimenti suggerisci)",
  "consultantDisplayName": "Nome del consulente/professionista estratto dal contesto (se disponibile, altrimenti suggerisci)",
  "suggestedInstructions": "Istruzioni dettagliate per l'agente AI su come comportarsi, rispondere e gestire le conversazioni (min 200 parole). Includi: tono da usare, come presentarsi, come gestire obiezioni, come chiudere la conversazione."
}

REGOLE OBBLIGATORIE:
- GENERA SOLO agenti con suggestedAgentType tra quelli selezionati: [${selectedAgentTypes.join(', ')}]
- NON generare MAI tipi di agente non selezionati dall'utente
- Se sono selezionati più tipi, distribuisci le idee tra i tipi selezionati
- Genera idee diverse tra loro
- Per vision e mission, estrai dal contesto se possibile, altrimenti genera basandoti sul business
- Per businessName e consultantDisplayName, estrai dal contesto se disponibili
- Le suggestedInstructions devono essere dettagliate e specifiche per il tipo di agente
- Rispondi SOLO con un array JSON valido, senza altri commenti

RISPOSTA (array JSON):`;

    const { model: ideasModel, useThinking: ideasUseThinking, thinkingLevel: ideasThinkingLevel } = getModelWithThinking(providerResult.metadata?.name || 'Vertex AI');
    console.log(`🧠 [ONBOARDING] Generate ideas using model: ${ideasModel} with thinking: ${ideasUseThinking ? ideasThinkingLevel : 'disabled'}`);

    const ideasResult = await providerResult.client.generateContent({
      model: ideasModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        ...(ideasUseThinking && { thinkingConfig: { thinkingLevel: ideasThinkingLevel } })
      }
    });
    const responseText = ideasResult.response.text() || '';
    
    let ideas;
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      ideas = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Error parsing AI response:', responseText);
      return res.status(500).json({
        success: false,
        error: 'Errore nel parsing della risposta AI. Riprova.',
      });
    }
    
    res.json({
      success: true,
      data: ideas,
    });
  } catch (error: any) {
    console.error('Error generating AI ideas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore durante la generazione delle idee',
    });
  }
});

router.get('/knowledge-documents', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const docs = await db.select({
      id: consultantKnowledgeDocuments.id,
      fileName: consultantKnowledgeDocuments.fileName,
      fileType: consultantKnowledgeDocuments.fileType,
      fileSize: consultantKnowledgeDocuments.fileSize,
      createdAt: consultantKnowledgeDocuments.createdAt,
    })
      .from(consultantKnowledgeDocuments)
      .where(eq(consultantKnowledgeDocuments.consultantId, consultantId))
      .orderBy(consultantKnowledgeDocuments.createdAt);
    
    res.json({
      success: true,
      data: docs,
    });
  } catch (error: any) {
    console.error('Error fetching knowledge documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge documents',
    });
  }
});

// Interactive Intro Story - Complete onboarding story
router.post('/interactive-intro/complete', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { responses, suggestedPath } = req.body;
    
    // Validate responses
    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Responses are required',
      });
    }
    
    // Update onboarding status with interactive intro completion
    const [updated] = await db.update(consultantOnboardingStatus)
      .set({
        interactiveIntroCompleted: true,
        interactiveIntroCompletedAt: new Date(),
        interactiveIntroResponses: {
          businessType: responses.businessType,
          mainChallenge: responses.mainChallenge,
          clientCount: responses.clientCount,
          whyHere: responses.whyHere,
          suggestedPath: suggestedPath || [],
        },
        updatedAt: new Date(),
      })
      .where(eq(consultantOnboardingStatus.consultantId, consultantId))
      .returning();
    
    // If no record exists, create one
    if (!updated) {
      await db.insert(consultantOnboardingStatus)
        .values({
          consultantId,
          interactiveIntroCompleted: true,
          interactiveIntroCompletedAt: new Date(),
          interactiveIntroResponses: {
            businessType: responses.businessType,
            mainChallenge: responses.mainChallenge,
            clientCount: responses.clientCount,
            whyHere: responses.whyHere,
            suggestedPath: suggestedPath || [],
          },
        });
    }
    
    res.json({
      success: true,
      message: 'Interactive intro completed successfully!',
    });
  } catch (error: any) {
    console.error('Error completing interactive intro:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete interactive intro',
    });
  }
});

// Get interactive intro status
router.get('/interactive-intro/status', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const status = await db.query.consultantOnboardingStatus.findFirst({
      where: eq(consultantOnboardingStatus.consultantId, consultantId),
      columns: {
        interactiveIntroCompleted: true,
        interactiveIntroCompletedAt: true,
        interactiveIntroResponses: true,
      },
    });
    
    res.json({
      success: true,
      data: {
        completed: status?.interactiveIntroCompleted || false,
        completedAt: status?.interactiveIntroCompletedAt || null,
        responses: status?.interactiveIntroResponses || null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching interactive intro status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interactive intro status',
    });
  }
});

export default router;
