import { Router } from "express";
import { authenticateToken, type AuthRequest } from "../../middleware/auth";
import { storage } from "../../storage";
import { insertClientSalesAgentSchema, updateClientSalesAgentSchema, salesConversationTraining, salesAgentTrainingSummary, salesScripts } from "@shared/schema";
import { z } from "zod";
import { nanoid } from "nanoid";
import { extractSalesAgentContext } from "../../ai/sales-agent-context-builder";
import { SalesScriptTracker } from "../../ai/sales-script-tracker";
import { db } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseScriptContentToStructure } from "../../ai/sales-script-structure-parser";

const router = Router();

router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere ai sales agents" });
    }

    console.log(`[SalesAgentConfig] GET list for client ${userId}`);

    const agents = await storage.getClientSalesAgents(userId);

    res.json(agents);
  } catch (error: any) {
    console.error(`[SalesAgentConfig] GET list error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero degli agenti di vendita",
      error: error.message
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET SALES SCRIPT STRUCTURE - Global endpoint (not agent-specific)
// ⚠️ MUST BE BEFORE /:agentId route to avoid route collision
// 🔄 Now loads from client's ACTIVE scripts in database first!
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get("/script-structure", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere allo script structure" });
    }

    console.log(`[ScriptStructure] GET script structure for client ${userId}`);

    // 1. Try to load from client's ACTIVE scripts in database
    const activeScripts = await db
      .select({
        scriptType: salesScripts.scriptType,
        content: salesScripts.content,
        structure: salesScripts.structure,
        name: salesScripts.name,
        version: salesScripts.version,
      })
      .from(salesScripts)
      .where(and(
        eq(salesScripts.clientId, userId),
        eq(salesScripts.isActive, true)
      ));

    if (activeScripts.length > 0) {
      console.log(`[ScriptStructure] Found ${activeScripts.length} active script(s) in database for client ${userId}`);
      
      // Combine structures from all active scripts
      const combinedPhases: any[] = [];
      const scriptTypes: string[] = [];
      
      for (const script of activeScripts) {
        scriptTypes.push(script.scriptType);
        
        // Use stored structure if available, otherwise parse from content
        if (script.structure && script.structure.phases) {
          combinedPhases.push(...script.structure.phases);
        } else if (script.content) {
          try {
            const parsed = parseScriptContentToStructure(script.content, script.scriptType);
            combinedPhases.push(...parsed.phases);
          } catch (parseError) {
            console.warn(`[ScriptStructure] Failed to parse script ${script.name}:`, parseError);
          }
        }
      }
      
      const combinedStructure = {
        version: activeScripts[0]?.version || '1.0.0',
        lastExtracted: new Date().toISOString(),
        sourceFile: 'database:active_scripts',
        phases: combinedPhases,
        metadata: {
          totalPhases: combinedPhases.length,
          totalSteps: combinedPhases.reduce((sum, p) => sum + (p.steps?.length || 0), 0),
          totalCheckpoints: combinedPhases.reduce((sum, p) => sum + (p.checkpoints?.length || 0), 0),
          scriptTypes,
          activeScriptNames: activeScripts.map(s => s.name),
        }
      };
      
      console.log(`[ScriptStructure] Loaded from DB: ${combinedStructure.metadata.totalPhases} phases, scripts: ${combinedStructure.metadata.activeScriptNames.join(', ')}`);
      
      return res.json(combinedStructure);
    }

    // 2. Fallback: Load from static JSON file
    console.log(`[ScriptStructure] No active scripts in DB, falling back to static file`);
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const scriptStructurePath = path.join(__dirname, '../../ai/sales-script-structure.json');

    if (!fs.existsSync(scriptStructurePath)) {
      console.error(`[ScriptStructure] Static file not found at ${scriptStructurePath}`);
      return res.status(404).json({ 
        message: "Nessuno script attivo trovato e file statico non disponibile. Attiva uno script nel Script Manager.",
        path: scriptStructurePath
      });
    }

    const scriptStructureContent = fs.readFileSync(scriptStructurePath, 'utf-8');
    const scriptStructure = JSON.parse(scriptStructureContent);

    console.log(`[ScriptStructure] Loaded from static file v${scriptStructure.version} with ${scriptStructure.metadata.totalPhases} phases`);

    res.json(scriptStructure);
  } catch (error: any) {
    console.error(`[ScriptStructure] GET error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero dello script structure",
      error: error.message
    });
  }
});

router.get("/:agentId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere ai sales agents" });
    }

    console.log(`[SalesAgentConfig] GET agent ${agentId} for client ${userId}`);

    const agent = await storage.getClientSalesAgentById(agentId);

    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per accedere a questo agente" });
    }

    res.json(agent);
  } catch (error: any) {
    console.error(`[SalesAgentConfig] GET agent error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero dell'agente",
      error: error.message
    });
  }
});

router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono creare sales agents" });
    }

    console.log(`[SalesAgentConfig] POST create agent for client ${userId}`);

    const user = await storage.getUser(userId);
    if (!user || !user.consultantId) {
      return res.status(400).json({ message: "Utente non associato a un consulente" });
    }

    const validatedData = insertClientSalesAgentSchema.parse(req.body);

    let shareToken = nanoid(16);
    let existingToken = await storage.getClientSalesAgentByShareToken(shareToken);
    while (existingToken) {
      console.warn(`[SalesAgentConfig] Token collision detected, regenerating...`);
      shareToken = nanoid(16);
      existingToken = await storage.getClientSalesAgentByShareToken(shareToken);
    }

    const agent = await storage.createClientSalesAgent({
      ...validatedData,
      clientId: userId,
      consultantId: user.consultantId,
      shareToken,
    });

    console.log(`[SalesAgentConfig] Agent created successfully with id ${agent.id}`);

    res.status(201).json(agent);
  } catch (error: any) {
    console.error(`[SalesAgentConfig] POST create error:`, error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Dati non validi",
        errors: error.errors
      });
    }

    res.status(500).json({
      message: "Errore durante la creazione dell'agente",
      error: error.message
    });
  }
});

router.put("/:agentId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono modificare sales agents" });
    }

    console.log(`[SalesAgentConfig] PUT update agent ${agentId} for client ${userId}`);

    const existingAgent = await storage.getClientSalesAgentById(agentId);

    if (!existingAgent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (existingAgent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per modificare questo agente" });
    }

    const validatedData = updateClientSalesAgentSchema.parse(req.body);

    const updatedAgent = await storage.updateClientSalesAgent(agentId, validatedData);

    if (!updatedAgent) {
      return res.status(500).json({ message: "Errore durante l'aggiornamento dell'agente" });
    }

    console.log(`[SalesAgentConfig] Agent ${agentId} updated successfully`);

    res.json(updatedAgent);
  } catch (error: any) {
    console.error(`[SalesAgentConfig] PUT update error:`, error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Dati non validi",
        errors: error.errors
      });
    }

    res.status(500).json({
      message: "Errore durante l'aggiornamento dell'agente",
      error: error.message
    });
  }
});

router.delete("/:agentId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono eliminare sales agents" });
    }

    console.log(`[SalesAgentConfig] DELETE agent ${agentId} for client ${userId}`);

    const existingAgent = await storage.getClientSalesAgentById(agentId);

    if (!existingAgent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (existingAgent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per eliminare questo agente" });
    }

    await storage.deleteClientSalesAgent(agentId);

    console.log(`[SalesAgentConfig] Agent ${agentId} deleted successfully`);

    res.json({ message: "Agente eliminato con successo" });
  } catch (error: any) {
    console.error(`[SalesAgentConfig] DELETE error:`, error);
    res.status(500).json({
      message: "Errore durante l'eliminazione dell'agente",
      error: error.message
    });
  }
});

// POST /:agentId/generate-context - Magic Button endpoint
router.post("/:agentId/generate-context", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono usare il Magic Button" });
    }

    console.log(`[MagicButton] Generating context for agent ${agentId}, client ${userId}`);

    // Verify agent ownership (skip if creating new agent)
    if (agentId !== 'new') {
      const agent = await storage.getClientSalesAgentById(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agente non trovato" });
      }

      if (agent.clientId !== userId) {
        return res.status(403).json({ message: "Non hai i permessi per questo agente" });
      }
    }

    // Get user to retrieve consultantId
    const user = await storage.getUser(userId);
    if (!user || !user.consultantId) {
      return res.status(400).json({ message: "Utente non associato a un consulente" });
    }

    // Extract context using AI
    const extractedContext = await extractSalesAgentContext(userId, user.consultantId);

    console.log(`[MagicButton] Context extracted successfully for ${agentId === 'new' ? 'new agent' : `agent ${agentId}`}`);

    res.json({
      success: true,
      context: extractedContext,
      message: agentId === 'new' 
        ? "Contesto estratto con successo dal tuo profilo! Ora puoi applicare questi suggerimenti per iniziare."
        : "Contesto estratto con successo! Ora puoi applicare questi suggerimenti alla configurazione dell'agente."
    });
  } catch (error: any) {
    console.error(`[MagicButton] Error:`, error);
    res.status(500).json({
      message: "Errore durante l'estrazione del contesto",
      error: error.message
    });
  }
});

// ===== KNOWLEDGE BASE ENDPOINTS =====

// GET /:agentId/knowledge - Lista knowledge base items
router.get("/:agentId/knowledge", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere alla knowledge base" });
    }

    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    const knowledge = await storage.getClientSalesKnowledge(agentId);
    res.json(knowledge);
  } catch (error: any) {
    console.error(`[KnowledgeBase] GET error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero della knowledge base",
      error: error.message
    });
  }
});

// POST /:agentId/knowledge - Aggiungi knowledge item
router.post("/:agentId/knowledge", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono aggiungere knowledge" });
    }

    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    const { title, type, content, filePath } = req.body;

    if (!title || !type) {
      return res.status(400).json({ message: "Title e type sono obbligatori" });
    }

    const knowledge = await storage.createClientSalesKnowledge({
      agentId,
      title,
      type,
      content: content || null,
      filePath: filePath || null,
    });

    res.status(201).json(knowledge);
  } catch (error: any) {
    console.error(`[KnowledgeBase] POST error:`, error);
    res.status(500).json({
      message: "Errore durante l'aggiunta del knowledge",
      error: error.message
    });
  }
});

// DELETE /:agentId/knowledge/:knowledgeId - Elimina knowledge item
router.delete("/:agentId/knowledge/:knowledgeId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId, knowledgeId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono eliminare knowledge" });
    }

    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    const knowledge = await storage.getClientSalesKnowledgeById(knowledgeId);
    if (!knowledge || knowledge.agentId !== agentId) {
      return res.status(404).json({ message: "Knowledge item non trovato" });
    }

    await storage.deleteClientSalesKnowledge(knowledgeId);
    res.json({ message: "Knowledge eliminato con successo" });
  } catch (error: any) {
    console.error(`[KnowledgeBase] DELETE error:`, error);
    res.status(500).json({
      message: "Errore durante l'eliminazione del knowledge",
      error: error.message
    });
  }
});

// ===== ANALYTICS & CONVERSATIONS ENDPOINTS =====

// GET /:agentId/conversations - Lista conversazioni
router.get("/:agentId/conversations", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere alle conversazioni" });
    }

    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    const conversations = await storage.getClientSalesConversations(agentId);
    res.json(conversations);
  } catch (error: any) {
    console.error(`[Analytics] GET conversations error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero delle conversazioni",
      error: error.message
    });
  }
});

// GET /:agentId/analytics - Analytics dashboard data
router.get("/:agentId/analytics", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere alle analytics" });
    }

    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    const conversations = await storage.getClientSalesConversations(agentId);

    // Calculate analytics
    const totalConversations = conversations.length;
    const discoveryCompleted = conversations.filter(c => 
      c.currentPhase === 'demo' || c.currentPhase === 'objections' || c.currentPhase === 'closing'
    ).length;
    const demoPresented = conversations.filter(c => 
      c.currentPhase === 'objections' || c.currentPhase === 'closing'
    ).length;
    const interested = conversations.filter(c => c.outcome === 'interested').length;
    const closed = conversations.filter(c => c.outcome === 'closed').length;
    const pending = conversations.filter(c => c.outcome === 'pending').length;
    const notInterested = conversations.filter(c => c.outcome === 'not_interested').length;

    // Objections count
    const objectionsMap: Record<string, number> = {};
    conversations.forEach(conv => {
      if (conv.objectionsRaised && Array.isArray(conv.objectionsRaised)) {
        conv.objectionsRaised.forEach(obj => {
          objectionsMap[obj] = (objectionsMap[obj] || 0) + 1;
        });
      }
    });

    const topObjections = Object.entries(objectionsMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([objection, count]) => ({ objection, count }));

    // Interested prospects (da ricontattare)
    const interestedProspects = conversations
      .filter(c => c.outcome === 'interested' || c.outcome === 'pending')
      .map(c => ({
        id: c.id,
        prospectName: c.prospectName,
        prospectEmail: c.prospectEmail,
        prospectPhone: c.prospectPhone,
        currentPhase: c.currentPhase,
        collectedData: c.collectedData,
        createdAt: c.createdAt,
        outcome: c.outcome,
      }));

    res.json({
      summary: {
        totalConversations,
        discoveryCompleted,
        demoPresented,
        interested,
        closed,
        pending,
        notInterested,
      },
      conversionFunnel: {
        started: totalConversations,
        discoveryCompleted,
        demoPresented,
        interested,
        closed,
      },
      topObjections,
      interestedProspects,
    });
  } catch (error: any) {
    console.error(`[Analytics] GET analytics error:`, error);
    res.status(500).json({
      message: "Errore durante il calcolo delle analytics",
      error: error.message
    });
  }
});

// POST /:agentId/generate-invite - Generate unique consultation invite link (Google Meet-style)
router.post("/:agentId/generate-invite", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono generare link invito" });
    }

    console.log(`[GenerateInvite] Generating invite for agent ${agentId}, client ${userId}`);

    // Verify agent ownership
    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    // Validate request body (all fields optional)
    const validatedData = z.object({
      prospectName: z.string().optional(),
      prospectEmail: z.string().email().optional().or(z.literal('')),
      prospectPhone: z.string().optional(),
      scheduledDate: z.string().optional(), // ISO date string (YYYY-MM-DD)
      startTime: z.string().optional(), // HH:MM format
      endTime: z.string().optional(), // HH:MM format
    }).parse(req.body);

    // Generate unique invite token
    let inviteToken = `inv_${nanoid(16)}`;
    let existingInvite = await storage.getConsultationInviteByToken(inviteToken);
    while (existingInvite) {
      console.warn(`[GenerateInvite] Token collision detected, regenerating...`);
      inviteToken = `inv_${nanoid(16)}`;
      existingInvite = await storage.getConsultationInviteByToken(inviteToken);
    }

    // Create consultation invite
    // Use displayName if available, fallback to agentName
    const consultantName = agent.displayName || agent.agentName || 'Consulente';
    
    const invite = await storage.createConsultationInvite({
      inviteToken,
      agentId: agent.id,
      consultantName,
      prospectName: validatedData.prospectName || null,
      prospectEmail: validatedData.prospectEmail || null,
      prospectPhone: validatedData.prospectPhone || null,
      scheduledDate: validatedData.scheduledDate || null,
      startTime: validatedData.startTime || null,
      endTime: validatedData.endTime || null,
    });

    console.log(`[GenerateInvite] Invite created successfully with token ${inviteToken}`);

    // Generate full URL
    const protocol = req.protocol;
    const host = req.get('host');
    const inviteUrl = `${protocol}://${host}/invite/${inviteToken}`;

    res.status(201).json({
      inviteToken: invite.inviteToken,
      inviteUrl,
      consultantName: invite.consultantName,
      prospectName: invite.prospectName,
      prospectEmail: invite.prospectEmail,
      prospectPhone: invite.prospectPhone,
      status: invite.status,
      createdAt: invite.createdAt,
    });
  } catch (error: any) {
    console.error(`[GenerateInvite] POST generate error:`, error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Dati non validi",
        errors: error.errors
      });
    }

    res.status(500).json({
      message: "Errore durante la generazione del link invito",
      error: error.message
    });
  }
});

// GET /:agentId/conversations/:conversationId/messages - Get messages for a specific conversation
router.get("/:agentId/conversations/:conversationId/messages", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId, conversationId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere ai messaggi" });
    }

    console.log(`[GetMessages] Fetching messages for conversation ${conversationId}, agent ${agentId}, client ${userId}`);

    // Verify agent ownership
    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    // Get conversation to verify it belongs to this agent
    const conversation = await storage.getClientSalesConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversazione non trovata" });
    }

    if (conversation.agentId !== agentId) {
      return res.status(403).json({ message: "Questa conversazione non appartiene a questo agente" });
    }

    // Get messages from aiConversation if it exists
    if (!conversation.aiConversationId) {
      return res.json({ messages: [], conversation });
    }

    const messages = await storage.getAiMessagesByConversation(conversation.aiConversationId);

    console.log(`[GetMessages] Found ${messages.length} messages for conversation ${conversationId}`);

    res.json({ messages, conversation });
  } catch (error: any) {
    console.error(`[GetMessages] Error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero dei messaggi",
      error: error.message
    });
  }
});

// GET /:agentId/invites - Get all consultation invites for an agent
router.get("/:agentId/invites", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere agli inviti" });
    }

    console.log(`[GetInvites] Fetching invites for agent ${agentId}, client ${userId}`);

    // Verify agent ownership
    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    // Get all invites for this agent
    const invites = await storage.getConsultationInvitesByAgent(agentId);

    console.log(`[GetInvites] Found ${invites.length} invites for agent ${agentId}`);

    // Format response with full invite URLs
    const protocol = req.protocol;
    const host = req.get('host');

    const invitesWithUrls = invites.map(invite => ({
      ...invite,
      inviteUrl: `${protocol}://${host}/invite/${invite.inviteToken}`,
    }));

    res.json(invitesWithUrls);
  } catch (error: any) {
    console.error(`[GetInvites] Error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero degli inviti",
      error: error.message
    });
  }
});

// DELETE /:agentId/invites/:inviteToken - Delete single consultation invite and associated conversation
router.delete("/:agentId/invites/:inviteToken", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId, inviteToken } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono eliminare inviti" });
    }

    console.log(`[DeleteInvite] Deleting invite ${inviteToken} for agent ${agentId}, client ${userId}`);

    // Verify agent ownership
    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    // Get invite to verify it belongs to this agent
    const invite = await storage.getConsultationInviteByToken(inviteToken);
    if (!invite) {
      return res.status(404).json({ message: "Invito non trovato" });
    }

    if (invite.agentId !== agentId) {
      return res.status(403).json({ message: "Questo invito non appartiene a questo agente" });
    }

    // Delete associated conversation and aiConversation if exists
    if (invite.conversationId) {
      const conversation = await storage.getClientSalesConversationById(invite.conversationId);
      if (conversation) {
        // Delete aiConversation (this will cascade delete aiMessages)
        if (conversation.aiConversationId) {
          await storage.deleteAiConversation(conversation.aiConversationId);
          console.log(`[DeleteInvite] Deleted aiConversation ${conversation.aiConversationId}`);
        }
        // Delete sales conversation
        await storage.deleteClientSalesConversation(invite.conversationId);
        console.log(`[DeleteInvite] Deleted conversation ${invite.conversationId}`);
      }
    }

    // Delete invite
    const deleted = await storage.deleteConsultationInvite(inviteToken);
    if (!deleted) {
      return res.status(500).json({ message: "Errore durante l'eliminazione dell'invito" });
    }

    console.log(`[DeleteInvite] Invite ${inviteToken} deleted successfully`);

    res.json({ 
      message: "Invito e conversazione eliminati con successo",
      deletedInviteToken: inviteToken
    });
  } catch (error: any) {
    console.error(`[DeleteInvite] Error:`, error);
    res.status(500).json({
      message: "Errore durante l'eliminazione dell'invito",
      error: error.message
    });
  }
});

// DELETE /:agentId/invites - Delete all consultation invites and conversations for an agent
router.delete("/:agentId/invites", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono eliminare inviti" });
    }

    console.log(`[DeleteAllInvites] Deleting all invites for agent ${agentId}, client ${userId}`);

    // Verify agent ownership
    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    // Get all invites for this agent
    const invites = await storage.getConsultationInvitesByAgent(agentId);

    if (invites.length === 0) {
      return res.json({ message: "Nessun invito da eliminare", deletedCount: 0 });
    }

    let deletedCount = 0;

    // Delete each invite and its associated conversation
    for (const invite of invites) {
      try {
        // Delete associated conversation and aiConversation if exists
        if (invite.conversationId) {
          const conversation = await storage.getClientSalesConversationById(invite.conversationId);
          if (conversation) {
            // Delete aiConversation (this will cascade delete aiMessages)
            if (conversation.aiConversationId) {
              await storage.deleteAiConversation(conversation.aiConversationId);
            }
            // Delete sales conversation
            await storage.deleteClientSalesConversation(invite.conversationId);
          }
        }

        // Delete invite
        const deleted = await storage.deleteConsultationInvite(invite.inviteToken);
        if (deleted) {
          deletedCount++;
        }
      } catch (err: any) {
        console.error(`[DeleteAllInvites] Error deleting invite ${invite.inviteToken}:`, err.message);
        // Continue with next invite even if one fails
      }
    }

    console.log(`[DeleteAllInvites] Deleted ${deletedCount}/${invites.length} invites for agent ${agentId}`);

    res.json({ 
      message: `Eliminati ${deletedCount} inviti e conversazioni`,
      deletedCount,
      totalInvites: invites.length
    });
  } catch (error: any) {
    console.error(`[DeleteAllInvites] Error:`, error);
    res.status(500).json({
      message: "Errore durante l'eliminazione degli inviti",
      error: error.message
    });
  }
});

// ===== TRAINING SYSTEM ENDPOINTS =====

// GET /:agentId/training/conversations - Lista conversazioni con dati training
router.get("/:agentId/training/conversations", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere ai dati training" });
    }

    console.log(`[TrainingAPI] GET training conversations for agent ${agentId}, client ${userId}`);

    // Verify agent ownership
    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    // Query training data with JOIN to get prospect names
    const trainingData = await db
      .select({
        conversationId: salesConversationTraining.conversationId,
        currentPhase: salesConversationTraining.currentPhase,
        phasesReached: salesConversationTraining.phasesReached,
        completionRate: salesConversationTraining.completionRate,
        totalDuration: salesConversationTraining.totalDuration,
        ladderActivations: salesConversationTraining.ladderActivations,
        checkpointsCompleted: salesConversationTraining.checkpointsCompleted,
        aiAnalysisResult: salesConversationTraining.aiAnalysisResult, // Include AI analysis for badge
        createdAt: salesConversationTraining.createdAt,
        updatedAt: salesConversationTraining.updatedAt,
      })
      .from(salesConversationTraining)
      .where(eq(salesConversationTraining.agentId, agentId))
      .orderBy(desc(salesConversationTraining.createdAt));

    console.log(`[TrainingAPI] Found ${trainingData.length} raw training records for agent ${agentId}`);

    // Get conversation details for each training record
    const enrichedData = await Promise.all(
      trainingData.map(async (training) => {
        const conversation = await storage.getClientSalesConversationById(training.conversationId);
        return {
          id: training.conversationId, // FIX: Use 'id' instead of 'conversationId' for consistency
          prospectName: conversation?.prospectName || 'Unknown',
          prospectEmail: conversation?.prospectEmail || null,
          currentPhase: training.currentPhase,
          phasesReached: training.phasesReached,
          completionRate: training.completionRate,
          ladderActivationCount: Array.isArray(training.ladderActivations) ? training.ladderActivations.length : 0,
          checkpointsCompletedCount: Array.isArray(training.checkpointsCompleted) ? training.checkpointsCompleted.length : 0,
          totalDuration: training.totalDuration,
          aiAnalysisResult: training.aiAnalysisResult, // Include AI analysis for badge display
          createdAt: training.createdAt,
          updatedAt: training.updatedAt,
        };
      })
    );

    console.log(`[TrainingAPI] Returning ${enrichedData.length} enriched conversations. Sample:`, enrichedData[0]);

    res.json(enrichedData);
  } catch (error: any) {
    console.error(`[TrainingAPI] GET conversations error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero dei dati training",
      error: error.message
    });
  }
});

// GET /:agentId/training/conversation/:conversationId - Dettagli completi conversazione
router.get("/:agentId/training/conversation/:conversationId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId, conversationId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere ai dati training" });
    }

    console.log(`[TrainingAPI] GET training details for conversation ${conversationId}, agent ${agentId}, client ${userId}`);

    // Verify agent ownership
    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    // Verify conversation belongs to this agent
    const conversation = await storage.getClientSalesConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversazione non trovata" });
    }

    if (conversation.agentId !== agentId) {
      return res.status(403).json({ message: "Questa conversazione non appartiene a questo agente" });
    }

    // Get training data
    const trainingData = await db
      .select()
      .from(salesConversationTraining)
      .where(eq(salesConversationTraining.conversationId, conversationId))
      .limit(1);

    if (trainingData.length === 0) {
      return res.status(404).json({ message: "Dati training non trovati per questa conversazione" });
    }

    const training = trainingData[0];

    // Return complete training details
    const response = {
      conversationId: training.conversationId,
      agentId: training.agentId,
      prospectName: conversation.prospectName,
      prospectEmail: conversation.prospectEmail,
      prospectPhone: conversation.prospectPhone,
      currentPhase: training.currentPhase,
      phasesReached: training.phasesReached,
      phaseActivations: training.phaseActivations || [],
      checkpointsCompleted: training.checkpointsCompleted,
      semanticTypes: training.semanticTypes,
      ladderActivations: training.ladderActivations,
      contextualResponses: training.contextualResponses || [],
      questionsAsked: training.questionsAsked,
      fullTranscript: training.fullTranscript,
      aiReasoning: training.aiReasoning,
      objectionsEncountered: training.objectionsEncountered || [],
      dropOffPoint: training.dropOffPoint,
      dropOffReason: training.dropOffReason,
      completionRate: training.completionRate,
      totalDuration: training.totalDuration,
      scriptSnapshot: training.scriptSnapshot,
      scriptVersion: training.scriptVersion,
      aiAnalysisResult: training.aiAnalysisResult, // FIX: Include AI analysis for GeminiReportPanel
      createdAt: training.createdAt,
      updatedAt: training.updatedAt,
    };

    console.log(`[TrainingAPI] Returning complete training data for conversation ${conversationId}`);

    res.json(response);
  } catch (error: any) {
    console.error(`[TrainingAPI] GET conversation details error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero dei dettagli training",
      error: error.message
    });
  }
});

// GET /:agentId/training/summary - Aggregati per agente
router.get("/:agentId/training/summary", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere ai dati training" });
    }

    console.log(`[TrainingAPI] GET training summary for agent ${agentId}, client ${userId}`);

    // Verify agent ownership
    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    // Check if sales script has been modified after JSON extraction
    const scriptOutdated = SalesScriptTracker.checkScriptVersion();

    // Try to get pre-calculated summary from database
    const summaryData = await db
      .select()
      .from(salesAgentTrainingSummary)
      .where(eq(salesAgentTrainingSummary.agentId, agentId))
      .limit(1);

    if (summaryData.length > 0) {
      // Return pre-calculated summary with scriptOutdated flag
      console.log(`[TrainingAPI] Returning pre-calculated summary for agent ${agentId}`);
      res.json({
        ...summaryData[0],
        scriptOutdated
      });
    } else {
      // Calculate summary on-the-fly
      console.log(`[TrainingAPI] No pre-calculated summary found, calculating on-the-fly for agent ${agentId}`);

      const trainingData = await db
        .select()
        .from(salesConversationTraining)
        .where(eq(salesConversationTraining.agentId, agentId));

      if (trainingData.length === 0) {
        // No training data yet - return empty summary with scriptOutdated flag
        return res.json({
          agentId,
          totalConversations: 0,
          avgConversionRate: 0,
          phaseCompletionRates: {},
          commonFailPoints: [],
          checkpointCompletionRates: {},
          avgConversationDuration: 0,
          ladderActivationRate: 0,
          avgLadderDepth: 0,
          bestPerformingPhases: [],
          worstPerformingPhases: [],
          scriptOutdated,
          message: "Nessun dato di training disponibile per questo agente"
        });
      }

      // Calculate aggregated metrics
      const totalConversations = trainingData.length;
      const avgCompletionRate = trainingData.reduce((sum, t) => sum + (t.completionRate || 0), 0) / totalConversations;
      const avgDuration = Math.round(trainingData.reduce((sum, t) => sum + (t.totalDuration || 0), 0) / totalConversations);

      // Phase distribution
      const phaseDistribution: Record<string, number> = {};
      trainingData.forEach(t => {
        if (Array.isArray(t.phasesReached)) {
          t.phasesReached.forEach(phase => {
            phaseDistribution[phase] = (phaseDistribution[phase] || 0) + 1;
          });
        }
      });

      // Phase completion rates (percentage)
      const phaseCompletionRates: Record<string, number> = {};
      Object.keys(phaseDistribution).forEach(phase => {
        phaseCompletionRates[phase] = phaseDistribution[phase] / totalConversations;
      });

      // Ladder metrics
      let totalLadderActivations = 0;
      let totalLadderDepth = 0;
      trainingData.forEach(t => {
        if (Array.isArray(t.ladderActivations)) {
          totalLadderActivations += t.ladderActivations.length;
          t.ladderActivations.forEach(ladder => {
            totalLadderDepth += ladder.level || 0;
          });
        }
      });

      const avgLadderDepth = totalLadderActivations > 0 ? totalLadderDepth / totalLadderActivations : 0;
      const avgLadderActivationsPerConv = totalLadderActivations / totalConversations;

      // Best/worst performing phases
      const sortedPhases = Object.entries(phaseCompletionRates)
        .sort(([, a], [, b]) => b - a);
      
      const bestPerformingPhases = sortedPhases.slice(0, 3).map(([phase]) => phase);
      const worstPerformingPhases = sortedPhases.slice(-3).map(([phase]) => phase);

      const summary = {
        agentId,
        totalConversations,
        avgConversionRate: avgCompletionRate,
        phaseCompletionRates,
        commonFailPoints: [], // TODO: Calculate from drop-off data
        checkpointCompletionRates: {}, // TODO: Calculate from checkpoint data
        avgConversationDuration: avgDuration,
        ladderActivationRate: avgLadderActivationsPerConv,
        avgLadderDepth,
        bestPerformingPhases,
        worstPerformingPhases,
        scriptOutdated,
        calculatedOnTheFly: true,
      };

      res.json(summary);
    }
  } catch (error: any) {
    console.error(`[TrainingAPI] GET summary error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero del summary training",
      error: error.message
    });
  }
});

// GET /:agentId/training/stats - Metriche rapide per dashboard
router.get("/:agentId/training/stats", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { agentId } = req.params;

    if (userRole !== "client") {
      return res.status(403).json({ message: "Solo i clienti possono accedere ai dati training" });
    }

    console.log(`[TrainingAPI] GET training stats for agent ${agentId}, client ${userId}`);

    // Verify agent ownership
    const agent = await storage.getClientSalesAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agente non trovato" });
    }

    if (agent.clientId !== userId) {
      return res.status(403).json({ message: "Non hai i permessi per questo agente" });
    }

    // Get all training data for this agent
    const trainingData = await db
      .select()
      .from(salesConversationTraining)
      .where(eq(salesConversationTraining.agentId, agentId));

    console.log(`[TrainingAPI] Found ${trainingData.length} training records for agent ${agentId}`);

    if (trainingData.length === 0) {
      // No training data yet
      console.log(`[TrainingAPI] No training data, returning zeros`);
      return res.json({
        totalConversations: 0,
        avgCompletionRate: 0,
        totalLadderActivations: 0,
        avgDurationSeconds: 0,
        lastConversationDate: null
      });
    }

    // Calculate quick stats
    const totalConversations = trainingData.length;
    const avgCompletionRate = Math.round(
      (trainingData.reduce((sum, t) => sum + (t.completionRate || 0), 0) / totalConversations) * 100
    );

    let totalLadderActivations = 0;
    let conversationsWithLadder = 0;
    const depthCounts = { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
    
    trainingData.forEach(t => {
      if (Array.isArray(t.ladderActivations) && t.ladderActivations.length > 0) {
        conversationsWithLadder++;
        const maxDepth = Math.max(...t.ladderActivations.map((la: any) => la.level || 1));
        totalLadderActivations += t.ladderActivations.length;
        
        // Categorize depth
        if (maxDepth === 1) depthCounts['1']++;
        else if (maxDepth === 2) depthCounts['2']++;
        else if (maxDepth === 3) depthCounts['3']++;
        else if (maxDepth === 4) depthCounts['4']++;
        else depthCounts['5+']++;
      }
    });

    const avgDurationSeconds = Math.round(
      trainingData.reduce((sum, t) => sum + (t.totalDuration || 0), 0) / totalConversations
    );
    
    // Calculate average ladder depth
    const avgLadderDepth = conversationsWithLadder > 0 
      ? totalLadderActivations / conversationsWithLadder 
      : 0;
    
    // Calculate ladder activation rate
    const ladderActivationRate = totalConversations > 0
      ? conversationsWithLadder / totalConversations
      : 0;
    
    // Build depth distribution for chart
    const ladderDepthDistribution = [
      { depth: '1x', count: depthCounts['1'], label: '1 PERCHÉ' },
      { depth: '2x', count: depthCounts['2'], label: '2 PERCHÉ' },
      { depth: '3x', count: depthCounts['3'], label: '3 PERCHÉ' },
      { depth: '4x', count: depthCounts['4'], label: '4 PERCHÉ (Target)' },
      { depth: '5x+', count: depthCounts['5+'], label: '5+ PERCHÉ' },
    ];

    // Get most recent conversation date
    const sortedByDate = [...trainingData].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const lastConversationDate = sortedByDate[0]?.createdAt || null;

    const stats = {
      totalConversations,
      avgCompletionRate,
      totalLadderActivations,
      avgDurationSeconds,
      lastConversationDate,
      avgLadderDepth,
      ladderActivationRate,
      ladderDepthDistribution
    };

    console.log(`[TrainingAPI] Calculated stats for agent ${agentId}:`, stats);

    res.json(stats);
  } catch (error: any) {
    console.error(`[TrainingAPI] GET stats error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero delle statistiche training",
      error: error.message
    });
  }
});

export default router;
