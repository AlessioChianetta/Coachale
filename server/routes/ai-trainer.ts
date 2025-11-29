import express from 'express';
import { randomUUID } from 'crypto';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { clientSalesAgents, salesScripts, aiTrainingSessions, agentScriptAssignments, users } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { PROSPECT_PERSONAS, getPersonaById, generateProspectData } from '@shared/prospect-personas';
import { ProspectSimulator } from '../services/prospect-simulator';
import { clearScriptCache } from '../ai/sales-agent-prompt-builder';

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
      const { agentId, scriptId, personaId, responseSpeed } = req.body;

      if (!agentId || !scriptId || !personaId) {
        return res.status(400).json({ message: 'Missing required fields: agentId, scriptId, personaId' });
      }

      const validSpeeds = ['fast', 'normal', 'slow', 'disabled'];
      const speed = validSpeeds.includes(responseSpeed) ? responseSpeed : 'normal';

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
      
      clearScriptCache(undefined, agentId);
      
      console.log(`📋 [AI TRAINER] Script assigned to agent for training`);
      console.log(`   Previous: ${previousScriptId || 'none'}`);
      console.log(`   New: ${scriptId} (${script[0].name})`);
      
      await db.insert(aiTrainingSessions).values({
        id: sessionId,
        agentId,
        scriptId,
        scriptName: script[0].name,
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
          persona,
          prospectData,
          responseSpeed: speed as 'fast' | 'normal' | 'slow' | 'disabled',
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

      const simulator = activeSimulators.get(sessionId);
      if (simulator) {
        const transcript = simulator.getTranscript();
        return res.json(transcript);
      }

      res.json([]);

    } catch (error) {
      console.error('Error fetching transcript:', error);
      res.status(500).json({ message: 'Failed to fetch transcript' });
    }
  }
);

export default router;
