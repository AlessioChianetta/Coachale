import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../db';
import { consultantOnboardingStatus, vertexAiSettings, consultantSmtpSettings, consultantTurnConfig, consultantKnowledgeDocuments, whatsappVertexAiSettings, externalApiConfigs, consultantAvailabilitySettings } from '@shared/schema';
import { eq, and, count } from 'drizzle-orm';
import { VertexAI } from '@google-cloud/vertexai';
import { getCalendarClient } from '../google-calendar-service';
import nodemailer from 'nodemailer';

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
    
    const enrichedStatus = {
      ...status,
      hasVertexConfig: !!vertexSettings?.projectId,
      hasSmtpConfig: !!smtpSettings?.smtpHost,
      hasTurnConfig: !!turnConfig?.usernameEncrypted,
      documentsCount,
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

router.put('/status/:step', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { step } = req.params;
    const { status, errorMessage } = req.body;
    
    const validSteps = [
      'vertex_ai', 'smtp', 'google_calendar', 'video_meeting',
      'lead_import', 'whatsapp_ai', 'knowledge_base', 'client_ai_strategy'
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
      const decrypted = await storage.decryptData(vertexSettings.serviceAccountJson, consultantId);
      serviceAccountJson = JSON.parse(decrypted);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Errore nella decrittazione delle credenziali Vertex AI',
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
      
      const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
    
    let decryptedPassword: string;
    try {
      decryptedPassword = await storage.decryptData(smtpSettings.smtpPassword, consultantId);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Errore nella decrittazione della password SMTP',
      });
    }
    
    try {
      const transporter = nodemailer.createTransport({
        host: smtpSettings.smtpHost,
        port: smtpSettings.smtpPort,
        secure: smtpSettings.smtpSecure,
        auth: {
          user: smtpSettings.smtpUser,
          pass: decryptedPassword,
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
    
    try {
      const calendar = await getCalendarClient(consultantId);
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
      
      res.json({
        success: true,
        message: `Google Calendar connesso! Trovati ${calendarsCount} calendari.`,
        details: { calendarsCount },
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
        message: `Test Google Calendar fallito: ${calendarError.message}`,
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

router.post('/test/video-meeting', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const turnConfig = await db.query.consultantTurnConfig.findFirst({
      where: eq(consultantTurnConfig.consultantId, consultantId),
    });
    
    if (!turnConfig || !turnConfig.usernameEncrypted) {
      return res.status(400).json({
        success: false,
        message: 'Credenziali TURN non configurate. Vai su Impostazioni Video per configurarle.',
      });
    }
    
    try {
      const decryptedApiKey = await storage.decryptData(turnConfig.usernameEncrypted, consultantId);
      
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
      if (!apiConfig.apiKey || !apiConfig.apiEndpoint) {
        throw new Error('Configurazione API incompleta: manca API key o endpoint');
      }
      
      const decryptedApiKey = await storage.decryptData(apiConfig.apiKey, consultantId);
      
      const response = await fetch(apiConfig.apiEndpoint, {
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
    
    const whatsappSettings = await db.query.whatsappVertexAiSettings.findFirst({
      where: eq(whatsappVertexAiSettings.consultantId, consultantId),
    });
    
    if (!whatsappSettings) {
      return res.status(400).json({
        success: false,
        message: 'Vertex AI per WhatsApp non configurato. Vai su Impostazioni WhatsApp AI per configurarlo.',
      });
    }
    
    try {
      const decrypted = await storage.decryptData(whatsappSettings.serviceAccountJson, consultantId);
      const serviceAccountJson = JSON.parse(decrypted);
      
      const vertexAI = new VertexAI({
        project: whatsappSettings.projectId,
        location: whatsappSettings.location,
        googleAuthOptions: {
          credentials: serviceAccountJson,
        },
      });
      
      const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
        message: 'Vertex AI per WhatsApp funziona correttamente!',
        details: { response: text.substring(0, 100) },
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

export default router;
