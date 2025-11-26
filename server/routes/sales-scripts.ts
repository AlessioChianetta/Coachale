import { Router, Response } from 'express';
import { db } from '../db';
import { salesScripts, salesScriptVersions, users, clientSalesAgents, agentScriptAssignments } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getDiscoveryScript, getDemoScript, getObjectionsScript } from '../ai/sales-scripts-base';
import { AuthRequest, requireRole } from '../middleware/auth';
import { clearScriptCache } from '../ai/sales-agent-prompt-builder';

const router = Router();

// Middleware to require client role (clients manage their own sales agents' scripts)
const requireClient = requireRole('client');

// GET /api/sales-scripts - Get all scripts for the client
router.get('/', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    
    const scripts = await db
      .select()
      .from(salesScripts)
      .where(eq(salesScripts.clientId, clientId))
      .orderBy(desc(salesScripts.updatedAt));
    
    res.json(scripts);
  } catch (error) {
    console.error('Error fetching sales scripts:', error);
    res.status(500).json({ error: 'Errore nel recupero degli script' });
  }
});

// GET /api/sales-scripts/active - Get active scripts by type
router.get('/active', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    
    const activeScripts = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.clientId, clientId),
        eq(salesScripts.isActive, true)
      ));
    
    const result = {
      discovery: activeScripts.find(s => s.scriptType === 'discovery') || null,
      demo: activeScripts.find(s => s.scriptType === 'demo') || null,
      objections: activeScripts.find(s => s.scriptType === 'objections') || null,
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching active scripts:', error);
    res.status(500).json({ error: 'Errore nel recupero degli script attivi' });
  }
});

// GET /api/sales-scripts/:id - Get single script with version history
router.get('/:id', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    
    const [script] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    const versions = await db
      .select()
      .from(salesScriptVersions)
      .where(eq(salesScriptVersions.scriptId, id))
      .orderBy(desc(salesScriptVersions.createdAt));
    
    res.json({ ...script, versions });
  } catch (error) {
    console.error('Error fetching script:', error);
    res.status(500).json({ error: 'Errore nel recupero dello script' });
  }
});

// POST /api/sales-scripts - Create new script
router.post('/', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { name, scriptType, content, description, tags, isActive } = req.body;
    
    // Recupera il consultantId dal profilo utente
    const [userProfile] = await db
      .select({ consultantId: users.consultantId })
      .from(users)
      .where(eq(users.id, clientId));
    
    const consultantId = userProfile?.consultantId || null;
    
    if (!name || !scriptType || !content) {
      return res.status(400).json({ error: 'Nome, tipo e contenuto sono obbligatori' });
    }
    
    if (!['discovery', 'demo', 'objections'].includes(scriptType)) {
      return res.status(400).json({ error: 'Tipo script non valido' });
    }
    
    // Parse structure from content
    const structure = parseScriptStructure(content, scriptType);
    
    // Se lo script viene creato come attivo, disattiva gli altri dello stesso tipo
    // Altrimenti, se ci sono già script attivi, lascia questo come non attivo
    if (isActive) {
      await db
        .update(salesScripts)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(
          eq(salesScripts.clientId, clientId),
          eq(salesScripts.scriptType, scriptType),
          eq(salesScripts.isActive, true)
        ));
    }
    
    const [newScript] = await db
      .insert(salesScripts)
      .values({
        name,
        scriptType,
        content,
        structure,
        description,
        tags: tags || [],
        isActive: isActive || false,
        isDraft: false,
        clientId,
        consultantId,
        version: '1.0.0',
      })
      .returning();
    
    // Clear script cache if creating an active script
    if (isActive) {
      clearScriptCache(clientId);
      console.log(`🔄 [ScriptCreate] Cleared script cache for client ${clientId}`);
    }
    
    res.status(201).json(newScript);
  } catch (error) {
    console.error('Error creating script:', error);
    res.status(500).json({ error: 'Errore nella creazione dello script' });
  }
});

// PUT /api/sales-scripts/:id - Update script (creates new version)
router.put('/:id', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    const { name, content, description, tags, createNewVersion, changeNotes } = req.body;
    
    const [existingScript] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!existingScript) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    // Parse new structure if content changed
    const structure = content ? parseScriptStructure(content, existingScript.scriptType) : existingScript.structure;
    
    // Calculate new version
    let newVersion = existingScript.version;
    if (createNewVersion && content !== existingScript.content) {
      const versionParts = existingScript.version.split('.').map(Number);
      versionParts[1] += 1; // Increment minor version
      newVersion = versionParts.join('.');
      
      // Save old version to history
      await db.insert(salesScriptVersions).values({
        scriptId: id,
        version: existingScript.version,
        content: existingScript.content,
        structure: existingScript.structure,
        createdBy: clientId,
        changeNotes: changeNotes || `Aggiornato a v${newVersion}`,
      });
    }
    
    const [updatedScript] = await db
      .update(salesScripts)
      .set({
        name: name || existingScript.name,
        content: content || existingScript.content,
        structure,
        description: description !== undefined ? description : existingScript.description,
        tags: tags || existingScript.tags,
        version: newVersion,
        isDraft: false,
        updatedAt: new Date(),
      })
      .where(eq(salesScripts.id, id))
      .returning();
    
    // Clear script cache for this client so AI uses updated scripts
    clearScriptCache(clientId);
    console.log(`🔄 [ScriptUpdate] Cleared script cache for client ${clientId}`);
    
    res.json(updatedScript);
  } catch (error) {
    console.error('Error updating script:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento dello script' });
  }
});

// POST /api/sales-scripts/:id/activate - Set script as active for a specific agent
// Requires agentId in body - assigns script to that agent (1 agent = max 1 script per type)
router.post('/:id/activate', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    const clientId = req.user!.id;
    
    // Validate agentId is provided
    if (!agentId) {
      return res.status(400).json({ error: 'agentId è obbligatorio. Seleziona un agente.' });
    }
    
    // Verify script exists and belongs to client
    const [script] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    // Verify agent exists and belongs to client
    const [agent] = await db
      .select()
      .from(clientSalesAgents)
      .where(and(
        eq(clientSalesAgents.id, agentId),
        eq(clientSalesAgents.clientId, clientId)
      ));
    
    if (!agent) {
      return res.status(404).json({ error: 'Agente non trovato' });
    }
    
    // Remove any existing assignment for this agent + scriptType (upsert logic)
    await db
      .delete(agentScriptAssignments)
      .where(and(
        eq(agentScriptAssignments.agentId, agentId),
        eq(agentScriptAssignments.scriptType, script.scriptType)
      ));
    
    // Create new assignment
    const [assignment] = await db
      .insert(agentScriptAssignments)
      .values({
        agentId,
        scriptId: id,
        scriptType: script.scriptType,
        assignedBy: clientId,
      })
      .returning();
    
    // Also mark script as active (for backward compatibility)
    await db
      .update(salesScripts)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(salesScripts.id, id));
    
    // Clear script cache so AI uses the newly activated script
    clearScriptCache(clientId);
    console.log(`🔄 [ScriptActivate] Script ${id} assigned to agent ${agentId} (type: ${script.scriptType})`);
    
    res.json({ 
      success: true, 
      assignment,
      script,
      agent: { id: agent.id, name: agent.agentName }
    });
  } catch (error) {
    console.error('Error activating script:', error);
    res.status(500).json({ error: 'Errore nell\'attivazione dello script' });
  }
});

// GET /api/sales-scripts/agents - Get all agents for the client with their script assignments
router.get('/agents', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    
    // Get all agents for this client
    const agents = await db
      .select({
        id: clientSalesAgents.id,
        agentName: clientSalesAgents.agentName,
        displayName: clientSalesAgents.displayName,
        businessName: clientSalesAgents.businessName,
        isActive: clientSalesAgents.isActive,
      })
      .from(clientSalesAgents)
      .where(eq(clientSalesAgents.clientId, clientId));
    
    // Get all script assignments for these agents
    const agentIds = agents.map(a => a.id);
    
    let assignments: Array<{
      agentId: string;
      scriptId: string;
      scriptType: string;
      scriptName?: string;
    }> = [];
    
    if (agentIds.length > 0) {
      // Get assignments with script names
      const rawAssignments = await db
        .select({
          agentId: agentScriptAssignments.agentId,
          scriptId: agentScriptAssignments.scriptId,
          scriptType: agentScriptAssignments.scriptType,
          scriptName: salesScripts.name,
        })
        .from(agentScriptAssignments)
        .leftJoin(salesScripts, eq(agentScriptAssignments.scriptId, salesScripts.id));
      
      assignments = rawAssignments.filter(a => agentIds.includes(a.agentId));
    }
    
    // Combine agents with their assignments
    const agentsWithAssignments = agents.map(agent => ({
      ...agent,
      scriptAssignments: {
        discovery: assignments.find(a => a.agentId === agent.id && a.scriptType === 'discovery') || null,
        demo: assignments.find(a => a.agentId === agent.id && a.scriptType === 'demo') || null,
        objections: assignments.find(a => a.agentId === agent.id && a.scriptType === 'objections') || null,
      }
    }));
    
    res.json(agentsWithAssignments);
  } catch (error) {
    console.error('Error fetching agents with assignments:', error);
    res.status(500).json({ error: 'Errore nel recupero degli agenti' });
  }
});

// GET /api/sales-scripts/:id/assignments - Get all agents assigned to a specific script
router.get('/:id/assignments', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    
    // Verify script belongs to client
    const [script] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    // Get all assignments for this script with agent details
    const assignments = await db
      .select({
        assignmentId: agentScriptAssignments.id,
        agentId: agentScriptAssignments.agentId,
        assignedAt: agentScriptAssignments.assignedAt,
        agentName: clientSalesAgents.agentName,
        displayName: clientSalesAgents.displayName,
      })
      .from(agentScriptAssignments)
      .leftJoin(clientSalesAgents, eq(agentScriptAssignments.agentId, clientSalesAgents.id))
      .where(eq(agentScriptAssignments.scriptId, id));
    
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching script assignments:', error);
    res.status(500).json({ error: 'Errore nel recupero delle assegnazioni' });
  }
});

// POST /api/sales-scripts/:id/duplicate - Duplicate a script
router.post('/:id/duplicate', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    const { newName } = req.body;
    
    const [original] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!original) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    const [duplicate] = await db
      .insert(salesScripts)
      .values({
        name: newName || `${original.name} (Copia)`,
        scriptType: original.scriptType,
        content: original.content,
        structure: original.structure,
        description: original.description,
        tags: original.tags,
        isActive: false,
        isDraft: true,
        clientId,
        version: '1.0.0',
      })
      .returning();
    
    res.status(201).json(duplicate);
  } catch (error) {
    console.error('Error duplicating script:', error);
    res.status(500).json({ error: 'Errore nella duplicazione dello script' });
  }
});

// DELETE /api/sales-scripts/:id - Delete a script
router.delete('/:id', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    
    const [script] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    // Nessun controllo - permetti cancellazione anche se attivo
    await db.delete(salesScripts).where(eq(salesScripts.id, id));
    
    // Clear script cache in case deleted script was cached
    clearScriptCache(clientId);
    console.log(`🔄 [ScriptDelete] Cleared script cache for client ${clientId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting script:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione dello script' });
  }
});

// POST /api/sales-scripts/create-from-template - Create a single script from template
router.post('/create-from-template', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { scriptType, name } = req.body;
    
    if (!scriptType || !['discovery', 'demo', 'objections'].includes(scriptType)) {
      return res.status(400).json({ error: 'Tipo script non valido' });
    }
    
    const [userProfile] = await db
      .select({ consultantId: users.consultantId })
      .from(users)
      .where(eq(users.id, clientId));
    
    const consultantId = userProfile?.consultantId || null;
    
    let content: string;
    let defaultName: string;
    let description: string;
    
    switch (scriptType) {
      case 'discovery':
        content = getDiscoveryScript();
        defaultName = 'Discovery Call - Nuovo';
        description = 'Script per la Discovery Call';
        break;
      case 'demo':
        content = getDemoScript('Il Tuo Business', 'Il Tuo Nome', [], [], null);
        defaultName = 'Demo Call - Nuovo';
        description = 'Script per la Demo Call';
        break;
      case 'objections':
        content = getObjectionsScript();
        defaultName = 'Gestione Obiezioni - Nuovo';
        description = 'Script per la gestione delle obiezioni';
        break;
      default:
        return res.status(400).json({ error: 'Tipo script non valido' });
    }
    
    const [newScript] = await db
      .insert(salesScripts)
      .values({
        name: name || defaultName,
        scriptType,
        content,
        structure: parseScriptStructure(content, scriptType),
        description,
        tags: ['template'],
        isActive: false,
        isDraft: true,
        clientId,
        consultantId,
        version: '1.0.0',
      })
      .returning();
    
    res.status(201).json(newScript);
  } catch (error) {
    console.error('Error creating script from template:', error);
    res.status(500).json({ error: 'Errore nella creazione dello script' });
  }
});

// POST /api/sales-scripts/seed-defaults - Seed default scripts for client
router.post('/seed-defaults', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    
    // Recupera il consultantId dal profilo utente (client ha un consultant assegnato)
    const [userProfile] = await db
      .select({ consultantId: users.consultantId })
      .from(users)
      .where(eq(users.id, clientId));
    
    const consultantId = userProfile?.consultantId || null;
    
    // Check if already seeded
    const existing = await db
      .select()
      .from(salesScripts)
      .where(eq(salesScripts.clientId, clientId));
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Gli script sono già stati inizializzati' });
    }
    
    const discoveryContent = getDiscoveryScript();
    const demoContent = getDemoScript('Il Tuo Business', 'Il Tuo Nome', [], [], null);
    const objectionsContent = getObjectionsScript();
    
    const scripts = [
      {
        name: 'Discovery Call - Base',
        scriptType: 'discovery' as const,
        content: discoveryContent,
        structure: parseScriptStructure(discoveryContent, 'discovery'),
        description: 'Script base per la Discovery Call',
        tags: ['base', 'discovery'],
        isActive: true,
        isDraft: false,
        clientId,
        consultantId,
        version: '1.0.0',
      },
      {
        name: 'Demo Call - Base',
        scriptType: 'demo' as const,
        content: demoContent,
        structure: parseScriptStructure(demoContent, 'demo'),
        description: 'Script base per la Demo Call',
        tags: ['base', 'demo'],
        isActive: true,
        isDraft: false,
        clientId,
        consultantId,
        version: '1.0.0',
      },
      {
        name: 'Gestione Obiezioni - Base',
        scriptType: 'objections' as const,
        content: objectionsContent,
        structure: parseScriptStructure(objectionsContent, 'objections'),
        description: 'Script base per la gestione delle obiezioni',
        tags: ['base', 'obiezioni'],
        isActive: true,
        isDraft: false,
        clientId,
        consultantId,
        version: '1.0.0',
      },
    ];
    
    const insertedScripts = await db.insert(salesScripts).values(scripts).returning();
    
    res.status(201).json({ 
      message: 'Script di default creati con successo',
      scripts: insertedScripts 
    });
  } catch (error) {
    console.error('Error seeding default scripts:', error);
    res.status(500).json({ error: 'Errore nella creazione degli script di default' });
  }
});

// Helper function to parse script content into structured format
function parseScriptStructure(content: string, scriptType: string): any {
  const phases: any[] = [];
  
  try {
    // Parse phases from markdown-like content
    const phaseMatches = content.matchAll(/\*\*FASE #?(\d+(?:\s*e\s*#?\d+)?)\s*[-–]\s*([^*]+)\*\*/gi);
    
    for (const match of phaseMatches) {
      const phaseNumber = match[1].trim();
      const phaseName = match[2].trim();
      const phaseId = `phase_${phaseNumber.replace(/\s+/g, '_').replace('#', '')}`;
      
      phases.push({
        id: phaseId,
        number: phaseNumber,
        name: phaseName,
        description: '',
        semanticType: getSemanticType(phaseName),
        steps: [],
        checkpoints: [],
      });
    }
    
    // Parse steps within each phase
    const stepMatches = content.matchAll(/STEP\s+(\d+)\s*[-–]\s*([^:]+):/gi);
    let currentPhaseIndex = 0;
    
    for (const match of stepMatches) {
      const stepNumber = parseInt(match[1]);
      const stepName = match[2].trim();
      
      // Find the relevant phase
      while (currentPhaseIndex < phases.length - 1 && stepNumber > getMaxStepForPhase(currentPhaseIndex)) {
        currentPhaseIndex++;
      }
      
      if (phases[currentPhaseIndex]) {
        // Extract objective
        const objectiveMatch = content.slice(match.index).match(/🎯\s*OBIETTIVO:\s*([^\n]+)/i);
        
        // Extract questions
        const questions: Array<{text: string; marker?: string}> = [];
        const questionMatches = content.slice(match.index, match.index! + 2000).matchAll(/📌\s*(?:DOMANDA[^:]*:|[^:]+:)\s*\n?\s*[""]([^""]+)[""]/gi);
        for (const q of questionMatches) {
          questions.push({ text: q[1].trim() });
        }
        
        phases[currentPhaseIndex].steps.push({
          id: `step_${stepNumber}`,
          number: stepNumber,
          name: stepName,
          objective: objectiveMatch ? objectiveMatch[1].trim() : '',
          questions,
          hasLadder: content.slice(match.index, match.index! + 3000).toLowerCase().includes('ladder'),
        });
      }
    }
    
    // Parse checkpoints
    const checkpointMatches = content.matchAll(/⛔\s*CHECKPOINT\s+(?:OBBLIGATORIO\s+)?(?:FASE\s+#?)?([^⛔\n]+)⛔/gi);
    for (const match of checkpointMatches) {
      const checkpointDesc = match[1].trim();
      
      // Extract verifications
      const verifications: string[] = [];
      const afterCheckpoint = content.slice(match.index! + match[0].length, match.index! + 1000);
      const verifyMatches = afterCheckpoint.matchAll(/[✓✅]\s*([^\n?]+\??)/g);
      for (const v of verifyMatches) {
        verifications.push(v[1].trim());
      }
      
      if (phases.length > 0) {
        const lastPhase = phases[phases.length - 1];
        lastPhase.checkpoints.push({
          id: `checkpoint_${lastPhase.id}`,
          description: checkpointDesc,
          verifications,
        });
      }
    }
    
  } catch (error) {
    console.error('Error parsing script structure:', error);
  }
  
  return {
    version: '1.0.0',
    scriptType,
    phases,
    parsedAt: new Date().toISOString(),
  };
}

function getSemanticType(phaseName: string): string {
  const name = phaseName.toLowerCase();
  if (name.includes('apertura') || name.includes('impostazione')) return 'opening';
  if (name.includes('pain') || name.includes('discovery')) return 'discovery';
  if (name.includes('business') || name.includes('info')) return 'business_info';
  if (name.includes('inquisitorio') || name.includes('gap')) return 'gap_stretching';
  if (name.includes('qualificazione')) return 'qualification';
  if (name.includes('serietà') || name.includes('urgenza')) return 'urgency_budget';
  if (name.includes('demo') || name.includes('presentazione')) return 'presentation';
  if (name.includes('obiezioni')) return 'objections';
  if (name.includes('closing') || name.includes('chiusura')) return 'closing';
  return 'general';
}

function getMaxStepForPhase(phaseIndex: number): number {
  const stepRanges = [2, 6, 7, 9, 11, 12, 15, 16];
  return stepRanges[phaseIndex] || 20;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENERGY SETTINGS, LADDER LEVELS, QUESTIONS ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// PUT /api/sales-scripts/:id/energy - Update energy settings for a phase or step
router.put('/:id/energy', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    const { phaseOrStepId, settings } = req.body;
    
    if (!phaseOrStepId || !settings) {
      return res.status(400).json({ error: 'phaseOrStepId e settings sono obbligatori' });
    }
    
    const [script] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    // Merge new energy settings with existing
    const currentSettings = (script.energySettings as Record<string, any>) || {};
    currentSettings[phaseOrStepId] = {
      level: settings.level || 'MEDIO',
      tone: settings.tone || 'SICURO',
      volume: settings.volume || 'NORMAL',
      pace: settings.pace || 'MODERATO',
      vocabulary: settings.vocabulary || 'COLLOQUIALE',
      reason: settings.reason || undefined
    };
    
    const [updatedScript] = await db
      .update(salesScripts)
      .set({ 
        energySettings: currentSettings,
        updatedAt: new Date() 
      })
      .where(eq(salesScripts.id, id))
      .returning();
    
    console.log(`🔊 [EnergyUpdate] Updated energy for ${phaseOrStepId} in script ${id}`);
    
    res.json({ success: true, energySettings: updatedScript.energySettings });
  } catch (error) {
    console.error('Error updating energy settings:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento degli energy settings' });
  }
});

// PUT /api/sales-scripts/:id/ladder - Update ladder levels for a step
router.put('/:id/ladder', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    const { stepId, hasLadder, levels } = req.body;
    
    if (!stepId) {
      return res.status(400).json({ error: 'stepId è obbligatorio' });
    }
    
    const [script] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    // Merge new ladder settings with existing
    const currentLadder = (script.ladderOverrides as Record<string, any>) || {};
    currentLadder[stepId] = {
      hasLadder: hasLadder ?? true,
      levels: levels || []
    };
    
    const [updatedScript] = await db
      .update(salesScripts)
      .set({ 
        ladderOverrides: currentLadder,
        updatedAt: new Date() 
      })
      .where(eq(salesScripts.id, id))
      .returning();
    
    console.log(`🪜 [LadderUpdate] Updated ladder for step ${stepId} in script ${id}`);
    
    res.json({ success: true, ladderOverrides: updatedScript.ladderOverrides });
  } catch (error) {
    console.error('Error updating ladder settings:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento dei ladder levels' });
  }
});

// PUT /api/sales-scripts/:id/questions - Update questions for a step
router.put('/:id/questions', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    const { stepId, questions } = req.body;
    
    if (!stepId || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'stepId e questions array sono obbligatori' });
    }
    
    const [script] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    // Merge new questions with existing
    const currentQuestions = (script.stepQuestions as Record<string, any>) || {};
    currentQuestions[stepId] = questions.map((q: any, index: number) => ({
      id: q.id || `q_${Date.now()}_${index}`,
      text: q.text,
      order: q.order ?? index + 1,
      type: q.type || 'general'
    }));
    
    const [updatedScript] = await db
      .update(salesScripts)
      .set({ 
        stepQuestions: currentQuestions,
        updatedAt: new Date() 
      })
      .where(eq(salesScripts.id, id))
      .returning();
    
    console.log(`❓ [QuestionsUpdate] Updated ${questions.length} questions for step ${stepId} in script ${id}`);
    
    res.json({ success: true, stepQuestions: updatedScript.stepQuestions });
  } catch (error) {
    console.error('Error updating step questions:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento delle domande' });
  }
});

// PUT /api/sales-scripts/:id/biscottini - Update biscottini for a step
router.put('/:id/biscottini', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    const { stepId, biscottini } = req.body;
    
    if (!stepId || !Array.isArray(biscottini)) {
      return res.status(400).json({ error: 'stepId e biscottini array sono obbligatori' });
    }
    
    const [script] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    // Merge new biscottini with existing
    const currentBiscottini = (script.stepBiscottini as Record<string, any>) || {};
    currentBiscottini[stepId] = biscottini.map((b: any) => ({
      text: b.text,
      type: b.type || 'other'
    }));
    
    const [updatedScript] = await db
      .update(salesScripts)
      .set({ 
        stepBiscottini: currentBiscottini,
        updatedAt: new Date() 
      })
      .where(eq(salesScripts.id, id))
      .returning();
    
    console.log(`🍪 [BiscottiniUpdate] Updated biscottini for step ${stepId} in script ${id}`);
    
    res.json({ success: true, stepBiscottini: updatedScript.stepBiscottini });
  } catch (error) {
    console.error('Error updating biscottini:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento dei biscottini' });
  }
});

// GET /api/sales-scripts/:id/enhanced - Get script with all enhanced data
router.get('/:id/enhanced', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    
    const [script] = await db
      .select()
      .from(salesScripts)
      .where(and(
        eq(salesScripts.id, id),
        eq(salesScripts.clientId, clientId)
      ));
    
    if (!script) {
      return res.status(404).json({ error: 'Script non trovato' });
    }
    
    res.json({
      ...script,
      energySettings: script.energySettings || {},
      ladderOverrides: script.ladderOverrides || {},
      stepQuestions: script.stepQuestions || {},
      stepBiscottini: script.stepBiscottini || {}
    });
  } catch (error) {
    console.error('Error fetching enhanced script:', error);
    res.status(500).json({ error: 'Errore nel recupero dello script' });
  }
});

export default router;
