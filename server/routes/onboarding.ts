import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../db';
import { consultantOnboardingStatus, vertexAiSettings, consultantSmtpSettings, consultantTurnConfig, consultantKnowledgeDocuments } from '@shared/schema';
import { eq, and, count } from 'drizzle-orm';
import { VertexAI } from '@google-cloud/vertexai';

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
