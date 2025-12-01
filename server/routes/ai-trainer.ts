import express from 'express';
import { randomUUID } from 'crypto';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { clientSalesAgents, salesScripts, aiTrainingSessions, agentScriptAssignments, users, salesConversationTraining, clientSalesConversations } from '@shared/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
import { PROSPECT_PERSONAS, getPersonaById, generateProspectData } from '@shared/prospect-personas';
import { ProspectSimulator } from '../services/prospect-simulator';
import { clearScriptCache } from '../ai/sales-agent-prompt-builder';

type TestMode = 'discovery' | 'demo' | 'discovery_demo';

const router = express.Router();

const activeSimulators = new Map<string, ProspectSimulator>();

router.get('/personas', authenticateToken, async (req: AuthRequest, res) => {
  try {
    res.json(PROSPECT_PERSONAS);
  } catch (error) {
    console.error('Error fetching personas:', error);
    res.status(500).json({ message: 'Failed to fetch personas' });
  }
});

router.get(
  '/sessions/:agentId',
  authenticateToken,
  requireRole('client'),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;

      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, agentId))
        .limit(1);

      if (!agent[0]) {
        return res.status(404).json({ message: 'Sales agent not found' });
      }

      if (agent[0].clientId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const sessions = await db.select()
        .from(aiTrainingSessions)
        .where(eq(aiTrainingSessions.agentId, agentId))
        .orderBy(desc(aiTrainingSessions.startedAt))
        .limit(20);

      const formattedSessions = sessions.map(session => {
        const persona = getPersonaById(session.personaId);
        return {
          id: session.id,
          personaId: session.personaId,
          personaName: persona?.name || session.personaId,
          personaEmoji: persona?.emoji || '🤖',
          scriptId: session.scriptId,
          scriptName: session.scriptName || 'Script',
          prospectName: session.prospectName,
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          currentPhase: session.currentPhase || 'starting',
          completionRate: session.completionRate || 0,
          ladderActivations: session.ladderActivations || 0,
          messageCount: session.messageCount || 0,
          lastMessage: session.lastMessage,
        };
      });

      res.json(formattedSessions);
    } catch (error) {
      console.error('Error fetching training sessions:', error);
      res.status(500).json({ message: 'Failed to fetch sessions' });
    }
  }
);

router.post(
  '/start-session',
  authenticateToken,
  requireRole('client'),
  async (req: AuthRequest, res) => {
    try {
      const { agentId, scriptId, demoScriptId, personaId, responseSpeed, testMode } = req.body;

      if (!agentId || !scriptId || !personaId) {
        return res.status(400).json({ message: 'Missing required fields: agentId, scriptId, personaId' });
      }

      const validSpeeds = ['fast', 'normal', 'slow', 'disabled'];
      const speed = validSpeeds.includes(responseSpeed) ? responseSpeed : 'normal';
      
      const validTestModes: TestMode[] = ['discovery', 'demo', 'discovery_demo'];
      const resolvedTestMode: TestMode = validTestModes.includes(testMode) ? testMode : 'discovery';
      
      console.log(`🎯 [AI TRAINER] Test mode: ${resolvedTestMode}`);
      
      if (resolvedTestMode === 'discovery_demo' && !demoScriptId) {
        return res.status(400).json({ 
          message: 'Discovery + Demo mode requires both a Discovery script and a Demo script.' 
        });
      }

      if (resolvedTestMode === 'demo') {
        const existingRec = await db.select({
          id: clientSalesConversations.id,
          discoveryRec: clientSalesConversations.discoveryRec,
        })
          .from(clientSalesConversations)
          .where(and(
            eq(clientSalesConversations.agentId, agentId),
            isNotNull(clientSalesConversations.discoveryRec)
          ))
          .limit(1);

        if (!existingRec[0] || !existingRec[0].discoveryRec) {
          return res.status(400).json({ 
            message: 'Solo Demo mode requires an existing Discovery REC. Please run a Discovery session first or use Discovery+Demo mode.' 
          });
        }
        console.log(`✅ [AI TRAINER] Discovery REC found for demo mode`);
      }

      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, agentId))
        .limit(1);

      if (!agent[0]) {
        return res.status(404).json({ message: 'Sales agent not found' });
      }

      if (agent[0].clientId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const script = await db.select()
        .from(salesScripts)
        .where(eq(salesScripts.id, scriptId))
        .limit(1);

      if (!script[0]) {
        return res.status(404).json({ message: 'Script not found' });
      }

      if (script[0].clientId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied: script belongs to another client' });
      }

      let demoScript: typeof script[0] | null = null;
      if (demoScriptId && resolvedTestMode === 'discovery_demo') {
        const demoScriptResult = await db.select()
          .from(salesScripts)
          .where(eq(salesScripts.id, demoScriptId))
          .limit(1);

        if (!demoScriptResult[0]) {
          return res.status(404).json({ message: 'Demo script not found' });
        }

        if (demoScriptResult[0].clientId !== req.user?.id) {
          return res.status(403).json({ message: 'Access denied: demo script belongs to another client' });
        }

        if (demoScriptResult[0].scriptType !== 'demo') {
          return res.status(400).json({ message: 'Selected demo script must be of type "demo"' });
        }

        demoScript = demoScriptResult[0];
        console.log(`📋 [AI TRAINER] Demo script loaded: ${demoScript.name}`);
      }

      const persona = getPersonaById(personaId);
      if (!persona) {
        return res.status(400).json({ message: 'Invalid persona ID' });
      }

      const prospectData = generateProspectData(persona);
      
      const clientId = req.user!.id;
      const [userProfile] = await db
        .select({ consultantId: users.consultantId })
        .from(users)
        .where(eq(users.id, clientId));
      const consultantId = userProfile?.consultantId ?? req.user?.consultantId ?? undefined;

      const sessionId = randomUUID();
      
      const existingAssignment = await db.select()
        .from(agentScriptAssignments)
        .where(and(
          eq(agentScriptAssignments.agentId, agentId),
          eq(agentScriptAssignments.scriptType, script[0].scriptType)
        ))
        .limit(1);
      
      const previousScriptId = existingAssignment[0]?.scriptId || null;
      
      await db.delete(agentScriptAssignments)
        .where(and(
          eq(agentScriptAssignments.agentId, agentId),
          eq(agentScriptAssignments.scriptType, script[0].scriptType)
        ));
      
      await db.insert(agentScriptAssignments).values({
        agentId,
        scriptId,
        scriptType: script[0].scriptType,
        assignedBy: req.user?.id,
      });
      
      if (demoScript && resolvedTestMode === 'discovery_demo') {
        await db.delete(agentScriptAssignments)
          .where(and(
            eq(agentScriptAssignments.agentId, agentId),
            eq(agentScriptAssignments.scriptType, 'demo')
          ));
        
        await db.insert(agentScriptAssignments).values({
          agentId,
          scriptId: demoScript.id,
          scriptType: 'demo',
          assignedBy: req.user?.id,
        });
        console.log(`📋 [AI TRAINER] Demo script also assigned: ${demoScript.name}`);
      }
      
      clearScriptCache(undefined, agentId);
      
      console.log(`📋 [AI TRAINER] Script assigned to agent for training`);
      console.log(`   Previous: ${previousScriptId || 'none'}`);
      console.log(`   New: ${scriptId} (${script[0].name})`);
      
      await db.insert(aiTrainingSessions).values({
        id: sessionId,
        agentId,
        scriptId,
        scriptName: script[0].name,
        demoScriptId: demoScript?.id || null,
        testMode: resolvedTestMode,
        personaId,
        prospectName: prospectData.name,
        prospectEmail: prospectData.email,
        status: 'running',
        startedAt: new Date(),
        currentPhase: 'starting',
        completionRate: 0,
        ladderActivations: 0,
        messageCount: 0,
      });

      console.log(`\n🎮 [AI TRAINER] Starting training session`);
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Agent: ${agent[0].agentName}`);
      console.log(`   Script: ${script[0].name}`);
      console.log(`   Persona: ${persona.emoji} ${persona.name}`);
      console.log(`   Prospect: ${prospectData.name} (${prospectData.email})`);

      const restoreScriptAssignment = async () => {
        try {
          await db.delete(agentScriptAssignments)
            .where(and(
              eq(agentScriptAssignments.agentId, agentId),
              eq(agentScriptAssignments.scriptType, script[0].scriptType)
            ));
          
          if (previousScriptId) {
            await db.insert(agentScriptAssignments).values({
              agentId,
              scriptId: previousScriptId,
              scriptType: script[0].scriptType,
              assignedBy: req.user?.id,
            });
            console.log(`🔄 [AI TRAINER] Restored previous script: ${previousScriptId}`);
          } else {
            console.log(`🔄 [AI TRAINER] No previous script to restore (agent had none)`);
          }
          
          clearScriptCache(undefined, agentId);
        } catch (restoreError) {
          console.error(`❌ [AI TRAINER] Failed to restore script assignment:`, restoreError);
        }
      };

      try {
        const agentData = agent[0];
        
        const parseJsonArray = <T>(value: any, defaultValue: T[]): T[] => {
          if (!value) return defaultValue;
          if (Array.isArray(value)) return value as T[];
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              return Array.isArray(parsed) ? parsed : defaultValue;
            } catch {
              return defaultValue;
            }
          }
          return defaultValue;
        };
        
        const agentConfig = {
          businessName: agentData.businessName || 'Business',
          businessDescription: agentData.businessDescription || null,
          displayName: agentData.displayName || agentData.agentName || 'Agente',
          consultantBio: agentData.consultantBio || null,
          vision: agentData.vision || null,
          mission: agentData.mission || null,
          values: parseJsonArray<string>(agentData.values, []),
          usp: agentData.usp || null,
          targetClient: agentData.targetClient || null,
          nonTargetClient: agentData.nonTargetClient || null,
          whatWeDo: agentData.whatWeDo || null,
          howWeDoIt: agentData.howWeDoIt || null,
          servicesOffered: parseJsonArray<{name: string; description: string; price: string}>(agentData.servicesOffered, []),
          guarantees: agentData.guarantees || null,
          yearsExperience: agentData.yearsExperience ?? 0,
          clientsHelped: agentData.clientsHelped ?? 0,
          resultsGenerated: agentData.resultsGenerated || null,
        };
        
        console.log(`📋 [AI TRAINER] Agent config loaded:`);
        console.log(`   Business: ${agentConfig.businessName}`);
        console.log(`   Target: ${agentConfig.targetClient || 'Non specificato'}`);
        console.log(`   Services: ${agentConfig.servicesOffered?.length || 0} servizi`);
        
        const simulator = new ProspectSimulator({
          sessionId,
          agentId,
          clientId,
          consultantId,
          agent: agentData,
          agentConfig,
          script: script[0],
          demoScript: demoScript || undefined,
          persona,
          prospectData,
          responseSpeed: speed as 'fast' | 'normal' | 'slow' | 'disabled',
          testMode: resolvedTestMode,
          onSessionEnd: restoreScriptAssignment,
          onStatusUpdate: async (status) => {
            const updateData: any = {
              status: status.status,
              currentPhase: status.currentPhase,
              completionRate: status.completionRate,
              ladderActivations: status.ladderActivations,
              messageCount: status.messageCount,
              lastMessage: status.lastMessage,
            };
            
            if (status.conversationId) {
              updateData.conversationId = status.conversationId;
            }
            
            if (status.status !== 'running') {
              updateData.endedAt = new Date();
            }
            
            await db.update(aiTrainingSessions)
              .set(updateData)
              .where(eq(aiTrainingSessions.id, sessionId));
          },
        });

        activeSimulators.set(sessionId, simulator);

        simulator.start().catch(async (error) => {
          console.error(`❌ [AI TRAINER] Simulator error for session ${sessionId}:`, error);
          activeSimulators.delete(sessionId);
          
          await db.update(aiTrainingSessions)
            .set({ status: 'stopped', endedAt: new Date() })
            .where(eq(aiTrainingSessions.id, sessionId));
          
          await restoreScriptAssignment();
        });

      } catch (simError) {
        console.error('❌ [AI TRAINER] Failed to start simulator:', simError);
        await db.update(aiTrainingSessions)
          .set({ status: 'stopped', endedAt: new Date() })
          .where(eq(aiTrainingSessions.id, sessionId));
        
        await restoreScriptAssignment();
        
        return res.status(500).json({ message: 'Failed to start training simulator' });
      }

      res.json({
        sessionId,
        status: 'running',
        prospectName: prospectData.name,
        prospectEmail: prospectData.email,
        personaName: persona.name,
        personaEmoji: persona.emoji,
      });

    } catch (error) {
      console.error('Error starting training session:', error);
      res.status(500).json({ message: 'Failed to start training session' });
    }
  }
);

router.post(
  '/stop-session/:sessionId',
  authenticateToken,
  requireRole('client'),
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;

      const session = await db.select()
        .from(aiTrainingSessions)
        .where(eq(aiTrainingSessions.id, sessionId))
        .limit(1);

      if (!session[0]) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, session[0].agentId))
        .limit(1);

      if (!agent[0] || agent[0].clientId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const simulator = activeSimulators.get(sessionId);
      if (simulator) {
        await simulator.stop();
        activeSimulators.delete(sessionId);
      }

      await db.update(aiTrainingSessions)
        .set({
          status: 'stopped',
          endedAt: new Date(),
        })
        .where(eq(aiTrainingSessions.id, sessionId));

      console.log(`🛑 [AI TRAINER] Session stopped: ${sessionId}`);

      res.json({
        success: true,
        finalStats: {
          duration: session[0].startedAt ? 
            Math.floor((Date.now() - new Date(session[0].startedAt).getTime()) / 1000) : 0,
          completionRate: session[0].completionRate,
          ladderActivations: session[0].ladderActivations,
          messageCount: session[0].messageCount,
        },
      });

    } catch (error) {
      console.error('Error stopping training session:', error);
      res.status(500).json({ message: 'Failed to stop session' });
    }
  }
);

router.get(
  '/session/:sessionId/transcript',
  authenticateToken,
  requireRole('client'),
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;

      // Disable caching for real-time transcript updates
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });

      const session = await db.select()
        .from(aiTrainingSessions)
        .where(eq(aiTrainingSessions.id, sessionId))
        .limit(1);

      if (!session[0]) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // First check if simulator is active (live session)
      const simulator = activeSimulators.get(sessionId);
      if (simulator) {
        const transcript = simulator.getTranscript();
        return res.json(transcript);
      }

      // Session ended - try to get transcript from database
      if (session[0].conversationId) {
        const training = await db.select()
          .from(salesConversationTraining)
          .where(eq(salesConversationTraining.conversationId, session[0].conversationId))
          .limit(1);

        if (training[0]?.fullTranscript) {
          // Convert from DB format to TranscriptMessage format
          const transcriptFromDb = (training[0].fullTranscript as any[]).map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.timestamp,
            phase: msg.phase,
          }));
          return res.json(transcriptFromDb);
        }
      }

      res.json([]);

    } catch (error) {
      console.error('Error fetching transcript:', error);
      res.status(500).json({ message: 'Failed to fetch transcript' });
    }
  }
);

router.get(
  '/session/:sessionId/manager-analysis',
  authenticateToken,
  requireRole('client'),
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;

      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });

      const session = await db.select()
        .from(aiTrainingSessions)
        .where(eq(aiTrainingSessions.id, sessionId))
        .limit(1);

      if (!session[0]) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, session[0].agentId))
        .limit(1);

      if (!agent[0] || agent[0].clientId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const simulator = activeSimulators.get(sessionId);
      if (simulator) {
        // Return complete analysis history array
        const analysisHistory = simulator.getManagerAnalysisHistory();
        return res.json(analysisHistory);
      }

      // Session ended - analysis history is not persisted yet
      // TODO: Add DB persistence for manager analysis history
      res.json([]);

    } catch (error) {
      console.error('Error fetching manager analysis:', error);
      res.status(500).json({ message: 'Failed to fetch manager analysis' });
    }
  }
);

router.get(
  '/discovery-rec-status/:agentId',
  authenticateToken,
  requireRole('client'),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;

      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, agentId))
        .limit(1);

      if (!agent[0]) {
        return res.status(404).json({ message: 'Sales agent not found' });
      }

      if (agent[0].clientId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const conversationsWithRec = await db.select({
        id: clientSalesConversations.id,
        discoveryRec: clientSalesConversations.discoveryRec,
        createdAt: clientSalesConversations.createdAt,
      })
        .from(clientSalesConversations)
        .where(and(
          eq(clientSalesConversations.agentId, agentId),
          isNotNull(clientSalesConversations.discoveryRec)
        ))
        .orderBy(desc(clientSalesConversations.createdAt))
        .limit(1);

      const hasDiscoveryRec = conversationsWithRec.length > 0 && conversationsWithRec[0].discoveryRec !== null;
      const lastRecDate = conversationsWithRec[0]?.createdAt?.toISOString() || undefined;

      res.json({
        hasDiscoveryRec,
        lastRecDate,
      });

    } catch (error) {
      console.error('Error checking discovery REC status:', error);
      res.status(500).json({ message: 'Failed to check discovery REC status' });
    }
  }
);

// ========================================================================================
// REC ANALYTICS ENDPOINTS - Per visualizzare e rigenerare REC nelle analytics
// ========================================================================================

/**
 * GET /conversations/:id/discovery-rec
 * Ottiene il Discovery REC di una conversazione specifica
 * Supports both numeric IDs and UUID strings
 */
router.get(
  '/conversations/:id/discovery-rec',
  authenticateToken,
  requireRole('client'),
  async (req: AuthRequest, res) => {
    try {
      const conversationId = req.params.id;
      
      if (!conversationId || conversationId === 'NaN' || conversationId === 'undefined' || conversationId === 'null') {
        return res.status(400).json({ message: 'Invalid conversation ID', hasDiscoveryRec: false });
      }

      // Ottieni la conversazione con REC (ID is VARCHAR/UUID in database)
      const conversation = await db.select()
        .from(clientSalesConversations)
        .where(eq(clientSalesConversations.id, conversationId))
        .limit(1);

      if (!conversation || !conversation[0]) {
        return res.status(404).json({ message: 'Conversation not found', hasDiscoveryRec: false });
      }
      
      const conv = conversation[0];
      
      // Null safety check for agentId
      if (!conv.agentId) {
        return res.status(400).json({ message: 'Conversation has no agent assigned', hasDiscoveryRec: false });
      }

      // Verifica che l'utente sia proprietario dell'agent
      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, conv.agentId))
        .limit(1);

      if (!agent || !agent[0] || agent[0].clientId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verifica transcript - potrebbe essere array o string
      const transcriptData = conv.fullTranscript;
      let transcriptStr = '';
      if (transcriptData) {
        if (Array.isArray(transcriptData)) {
          transcriptStr = JSON.stringify(transcriptData);
        } else if (typeof transcriptData === 'string') {
          transcriptStr = transcriptData;
        }
      }
      
      // Ritorna il REC (potrebbe essere null)
      res.json({
        conversationId: conv.id,
        discoveryRec: conv.discoveryRec || null,
        hasDiscoveryRec: !!conv.discoveryRec,
        hasTranscript: transcriptStr.length > 100,
        createdAt: conv.createdAt ? conv.createdAt.toISOString() : null,
      });

    } catch (error) {
      console.error('Error fetching discovery REC:', error);
      res.status(500).json({ message: 'Failed to fetch discovery REC', hasDiscoveryRec: false });
    }
  }
);

/**
 * POST /conversations/:id/discovery-rec/generate
 * Genera o rigenera il Discovery REC di una conversazione
 * Supports both numeric IDs and UUID strings
 */
router.post(
  '/conversations/:id/discovery-rec/generate',
  authenticateToken,
  requireRole('client'),
  async (req: AuthRequest, res) => {
    try {
      const conversationId = req.params.id;
      
      console.log(`\n🔍 [REC GENERATION] Starting for conversation: ${conversationId}`);
      
      if (!conversationId || conversationId === 'NaN' || conversationId === 'undefined') {
        console.log(`❌ [REC GENERATION] Invalid conversation ID`);
        return res.status(400).json({ message: 'Invalid conversation ID' });
      }

      // Ottieni la conversazione (ID is VARCHAR/UUID in database)
      console.log(`📋 [REC GENERATION] Fetching conversation details...`);
      const conversation = await db.select()
        .from(clientSalesConversations)
        .where(eq(clientSalesConversations.id, conversationId))
        .limit(1);

      if (!conversation[0]) {
        console.log(`❌ [REC GENERATION] Conversation not found: ${conversationId}`);
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const conv = conversation[0];
      console.log(`✅ [REC GENERATION] Conversation found - agentId: ${conv.agentId}`);
      console.log(`📝 [REC GENERATION] Transcript length: ${conv.fullTranscript?.length || 0}`);

      // Verifica accesso
      console.log(`🔐 [REC GENERATION] Checking agent access for agentId: ${conv.agentId}`);
      
      if (!conv.agentId) {
        console.log(`❌ [REC GENERATION] No agentId in conversation`);
        return res.status(400).json({ message: 'Conversation has no agent assigned' });
      }
      
      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, conv.agentId))
        .limit(1);

      console.log(`📊 [REC GENERATION] Agent query result:`, {
        found: !!agent[0],
        hasClientId: !!agent[0]?.clientId,
        hasApiKey: !!agent[0]?.geminiApiKey,
        requestUserId: req.user?.id
      });

      if (!agent[0]) {
        console.log(`❌ [REC GENERATION] Agent not found for id: ${conversation[0].agentId}`);
        return res.status(404).json({ message: 'Agent not found' });
      }

      if (agent[0].clientId !== req.user?.id) {
        console.log(`❌ [REC GENERATION] Access denied - clientId mismatch`);
        console.log(`   Agent clientId: ${agent[0].clientId}`);
        console.log(`   Request user id: ${req.user?.id}`);
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verifica che ci sia un transcript
      const transcriptLength = conv.fullTranscript?.length || 0;
      console.log(`📏 [REC GENERATION] Transcript validation - length: ${transcriptLength}`);
      
      if (transcriptLength < 100) {
        console.log(`❌ [REC GENERATION] Transcript too short: ${transcriptLength} chars`);
        return res.status(400).json({ 
          message: 'Transcript troppo breve o mancante. Il REC può essere generato solo da conversazioni con trascrizione completa.',
          transcriptLength
        });
      }

      // Import dinamico per evitare circular dependencies
      console.log(`📦 [REC GENERATION] Loading discovery-rec-generator module...`);
      const { generateDiscoveryRec } = await import('../ai/discovery-rec-generator');
      
      // Ottieni API key (prova agent, poi env var)
      const apiKey = agent[0]?.geminiApiKey || process.env.GEMINI_API_KEY;
      
      console.log(`🔑 [REC GENERATION] API Key source:`, {
        fromAgent: !!agent[0].geminiApiKey,
        fromEnv: !!process.env.GEMINI_API_KEY,
        hasKey: !!apiKey
      });
      
      if (!apiKey) {
        console.log(`❌ [REC GENERATION] No API key available`);
        return res.status(500).json({ message: 'Gemini API key non configurata' });
      }

      console.log(`🚀 [REC GENERATION] Starting REC generation...`);
      console.log(`   Conversation: ${conversationId}`);
      console.log(`   Transcript length: ${transcriptLength} chars`);
      
      // Genera il REC
      const discoveryRec = await generateDiscoveryRec(
        conv.fullTranscript,
        apiKey
      );

      console.log(`📋 [REC GENERATION] Generation complete - checking result...`);
      
      if (!discoveryRec) {
        console.log(`❌ [REC GENERATION] Generator returned null`);
        return res.status(500).json({ message: 'Failed to generate Discovery REC' });
      }

      console.log(`✅ [REC GENERATION] REC generated successfully`);
      console.log(`📊 [REC GENERATION] Content summary:`, {
        hasMotivazione: !!discoveryRec.motivazioneCall,
        hasTipoAttivita: !!discoveryRec.tipoAttivita,
        problemiCount: discoveryRec.problemi?.length || 0,
        hasStatoAttuale: !!discoveryRec.statoAttuale,
        hasStatoIdeale: !!discoveryRec.statoIdeale,
        hasUrgenza: !!discoveryRec.urgenza,
        hasDecisionMaker: discoveryRec.decisionMaker !== undefined,
        hasBudget: !!discoveryRec.budget
      });

      // Verifica che il REC abbia contenuto significativo
      const hasContent = discoveryRec.motivazioneCall || 
                         discoveryRec.tipoAttivita || 
                         discoveryRec.problemi?.length || 
                         discoveryRec.statoAttuale;
      
      if (!hasContent) {
        console.log(`⚠️ [REC GENERATION] REC is empty - no meaningful content`);
        return res.status(400).json({ 
          message: 'Il REC generato è vuoto. Probabilmente il transcript non contiene informazioni di discovery sufficienti.',
          discoveryRec 
        });
      }

      // Salva nel database
      console.log(`💾 [REC GENERATION] Saving REC to database...`);
      await db.update(clientSalesConversations)
        .set({ discoveryRec })
        .where(eq(clientSalesConversations.id, conversationId));

      console.log(`✅ [REC GENERATION] REC saved successfully for conversation ${conversationId}`);

      res.json({
        success: true,
        conversationId,
        discoveryRec,
        generatedAt: discoveryRec.generatedAt,
      });

    } catch (error) {
      console.error(`\n❌ [REC GENERATION] CRITICAL ERROR:`);
      console.error(`   Type: ${error?.constructor?.name}`);
      console.error(`   Message: ${error?.message}`);
      console.error(`   Stack:`, error?.stack);
      
      if (error?.message?.includes('orderSelectedFields')) {
        console.error(`\n🔍 [REC GENERATION] This is a Drizzle ORM query error`);
        console.error(`   Likely cause: Invalid field selection in database query`);
        console.error(`   Conversation ID: ${req.params.id}`);
      }
      
      res.status(500).json({ 
        message: 'Failed to generate discovery REC',
        error: error?.message,
        type: error?.constructor?.name
      });
    }
  }
);

export default router;
