import { Router, Response } from 'express';
import { db } from '../db';
import { salesScripts, salesScriptVersions, users, clientSalesAgents, agentScriptAssignments } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getDiscoveryScript, getDemoScript, getObjectionsScript } from '../ai/sales-scripts-base';
import { AuthRequest, requireRole } from '../middleware/auth';
import { clearScriptCache } from '../ai/sales-agent-prompt-builder';
import { parseTextToBlocks } from '../../shared/script-parser';

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

// GET /api/sales-scripts/agents - Get all agents for the client with their script assignments
// NOTE: This route MUST be before /:id to avoid being caught by the :id param
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
    
    let rawAssignments: Array<{
      agentId: string;
      scriptId: string;
      scriptType: string;
      scriptName: string | null;
    }> = [];
    
    if (agentIds.length > 0) {
      // Get assignments with script names
      const dbAssignments = await db
        .select({
          agentId: agentScriptAssignments.agentId,
          scriptId: agentScriptAssignments.scriptId,
          scriptType: agentScriptAssignments.scriptType,
          scriptName: salesScripts.name,
        })
        .from(agentScriptAssignments)
        .leftJoin(salesScripts, eq(agentScriptAssignments.scriptId, salesScripts.id));
      
      rawAssignments = dbAssignments.filter(a => agentIds.includes(a.agentId));
    }
    
    // Combine agents with their assignments as ARRAY (not object)
    // Frontend expects: assignments: { scriptId, scriptType, scriptName }[]
    const agentsWithAssignments = agents.map(agent => {
      const agentAssignments = rawAssignments
        .filter(a => a.agentId === agent.id)
        .map(a => ({
          scriptId: a.scriptId,
          scriptType: a.scriptType,
          scriptName: a.scriptName || 'Script senza nome',
        }));
      
      return {
        ...agent,
        assignments: agentAssignments,
      };
    });
    
    console.log(`[ScriptsAPI] Found ${agents.length} agents for client ${clientId}`);
    res.json(agentsWithAssignments);
  } catch (error) {
    console.error('Error fetching agents with assignments:', error);
    res.status(500).json({ error: 'Errore nel recupero degli agenti' });
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
    
    // Parse structure from content using the complete parser
    const structure = parseTextToBlocks(content, scriptType as 'discovery' | 'demo' | 'objections');
    
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
// 🔧 FIX: Accept structure from client to preserve block IDs
router.put('/:id', requireClient, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user!.id;
    const { name, content, structure: clientStructure, description, tags, createNewVersion, changeNotes } = req.body;
    
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
    
    // 🔧 FIX: Use client-provided structure if available (preserves IDs!)
    // Only fall back to parseTextToBlocks for legacy clients or text-only updates
    let structure = existingScript.structure;
    if (clientStructure && typeof clientStructure === 'object' && Array.isArray(clientStructure.phases)) {
      // ✅ Client sent structure with preserved IDs - use it directly
      structure = clientStructure;
      console.log(`📦 [ScriptUpdate] Using client-provided structure (IDs preserved): ${clientStructure.phases?.length || 0} phases`);
    } else if (content && content !== existingScript.content) {
      // Fallback: Parse from content if no structure provided and content changed
      structure = parseTextToBlocks(content, existingScript.scriptType as 'discovery' | 'demo' | 'objections');
      console.log(`⚠️ [ScriptUpdate] No structure provided, parsing from content (new IDs generated)`);
    }
    
    // 🔧 FIX: Ensure structure always has metadata (repair legacy structures)
    if (structure && typeof structure === 'object') {
      const structureObj = structure as any;
      if (!structureObj.metadata) {
        structureObj.metadata = {
          name: name || existingScript.name || 'Script',
          type: existingScript.scriptType as 'discovery' | 'demo' | 'objections',
          version: '1.0.0',
        };
        console.log(`🔧 [ScriptUpdate] Created missing metadata for structure`);
      }
      if (!structureObj.globalRules) {
        structureObj.globalRules = [];
      }
      structure = structureObj;
    }
    
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

// POST /api/sales-scripts/:id/reparse - Force re-parse script structure with corrected IDs
router.post('/:id/reparse', requireClient, async (req: AuthRequest, res: Response) => {
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
    
    // Re-parse the structure with corrected ID format using the complete parser
    const newStructure = parseTextToBlocks(script.content, script.scriptType as 'discovery' | 'demo' | 'objections');
    
    // Log the changes for debugging
    console.log(`🔄 [REPARSE] Re-parsing script ${id}`);
    console.log(`   Old phases: ${script.structure?.phases?.length || 0}`);
    console.log(`   New phases: ${newStructure.phases?.length || 0}`);
    
    if (newStructure.phases?.length > 0) {
      const firstPhase = newStructure.phases[0];
      console.log(`   First phase ID: ${firstPhase.id}`);
      if (firstPhase.steps?.length > 0) {
        console.log(`   First step ID: ${firstPhase.steps[0].id}`);
        console.log(`   First step questions: ${firstPhase.steps[0].questions?.length || 0}`);
      }
    }
    
    const [updatedScript] = await db
      .update(salesScripts)
      .set({
        structure: newStructure,
        updatedAt: new Date(),
      })
      .where(eq(salesScripts.id, id))
      .returning();
    
    // Clear cache so AI uses updated structure
    clearScriptCache(clientId);
    console.log(`✅ [REPARSE] Script ${id} re-parsed successfully`);
    
    res.json({ 
      success: true, 
      message: 'Script ri-parsato con successo',
      structure: newStructure 
    });
  } catch (error) {
    console.error('Error re-parsing script:', error);
    res.status(500).json({ error: 'Errore nel re-parsing dello script' });
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
    
    // Find and deactivate any existing script assignment for this agent + scriptType
    const [existingAssignment] = await db
      .select({ scriptId: agentScriptAssignments.scriptId })
      .from(agentScriptAssignments)
      .where(and(
        eq(agentScriptAssignments.agentId, agentId),
        eq(agentScriptAssignments.scriptType, script.scriptType)
      ));
    
    // If there was a previous script, set it as inactive
    if (existingAssignment && existingAssignment.scriptId !== id) {
      await db
        .update(salesScripts)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(salesScripts.id, existingAssignment.scriptId));
      console.log(`🗑️ [ScriptDeactivate] Previous script ${existingAssignment.scriptId} deactivated for agent ${agentId}`);
    }
    
    // Remove the old assignment (upsert logic)
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
    clearScriptCache(clientId, agentId);
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
        structure: parseTextToBlocks(content, scriptType as 'discovery' | 'demo' | 'objections'),
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
        structure: parseTextToBlocks(discoveryContent, 'discovery'),
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
        structure: parseTextToBlocks(demoContent, 'demo'),
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
        structure: parseTextToBlocks(objectionsContent, 'objections'),
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

// NOTE: Old parseScriptStructure function removed - now using parseTextToBlocks from shared/script-parser.ts
// This complete parser properly handles energy settings, ladder, checkpoints, biscottino, and all metadata

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
