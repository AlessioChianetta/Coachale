import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertClientStateTrackingSchema, updateClientStateTrackingSchema } from "@shared/schema";
import { z } from "zod";
import { buildUserContext } from "../ai-context-builder";
import { buildSystemPrompt } from "../ai-prompts";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_3_MODEL, getSuperAdminGeminiKeys } from "../ai/provider-factory";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq, sql as drizzleSql } from "drizzle-orm";

const router = Router();

// POST /api/clients/:id/state - Upsert client state (consultant only)
router.post("/clients/:id/state", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const clientId = req.params.id;
    
    // Verify client exists
    const client = await storage.getUser(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: "Client not found" 
      });
    }
    
    // Verify consultant has access to this client (supports both clients and consultants who are also clients)
    if (client.consultantId !== req.user!.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied - this is not your client" 
      });
    }
    
    // Validate and upsert state
    const validatedData = insertClientStateTrackingSchema.parse({
      ...req.body,
      clientId,
      consultantId: req.user!.id,
      source: req.body.source || "manual",
    });
    
    const state = await storage.upsertClientState(validatedData);
    
    res.status(200).json({ 
      success: true, 
      data: state 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to save client state" 
    });
  }
});

// GET /api/clients/:id/state - Get client state (client can see only their own, consultant can see all their clients)
router.get("/clients/:id/state", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const clientId = req.params.id;
    
    // Verify client exists
    const client = await storage.getUser(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: "Client not found" 
      });
    }
    
    // Check access: client can see only their own state, consultant can see their clients' states
    let hasAccess = false;
    let consultantId = "";
    
    if (req.user!.role === "client") {
      // Client can only see their own state
      hasAccess = clientId === req.user!.id;
      if (hasAccess && client.consultantId) {
        consultantId = client.consultantId;
      }
    } else if (req.user!.role === "consultant") {
      // Consultant can see their clients' states
      hasAccess = client.consultantId === req.user!.id;
      consultantId = req.user!.id;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    if (!consultantId) {
      return res.status(400).json({ 
        success: false, 
        error: "Client has no assigned consultant" 
      });
    }
    
    const state = await storage.getClientState(clientId, consultantId);
    
    if (!state) {
      return res.status(404).json({ 
        success: false, 
        error: "Client state not found" 
      });
    }
    
    res.json({ 
      success: true, 
      data: state 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch client state" 
    });
  }
});

// GET /api/clients/my/state - Get logged-in client's state
router.get("/clients/my/state", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.id;
    
    // Get client to find their consultant
    const client = await storage.getUser(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: "Client not found" 
      });
    }
    
    if (!client.consultantId) {
      return res.status(400).json({ 
        success: false, 
        error: "No consultant assigned to this client" 
      });
    }
    
    const state = await storage.getClientState(clientId, client.consultantId);
    
    if (!state) {
      return res.status(404).json({ 
        success: false, 
        error: "Client state not found" 
      });
    }
    
    res.json({ 
      success: true, 
      data: state 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch client state" 
    });
  }
});

// GET /api/clients/state/statistics - Get client state statistics for consultant (consultant only)
router.get("/clients/state/statistics", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    // Get all states for this consultant's clients
    const states = await storage.getClientStatesByConsultant(consultantId);
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const uniqueClients = new Set(states.map(s => s.clientId));
    
    const latestByClient = new Map<string, typeof states[0]>();
    for (const s of states) {
      const existing = latestByClient.get(s.clientId);
      if (!existing || s.version > existing.version) {
        latestByClient.set(s.clientId, s);
      }
    }
    const latestStates = Array.from(latestByClient.values());
    
    const stats = {
      totalClientsWithState: uniqueClients.size,
      aiGenerated: states.filter(s => s.source === "ai").length,
      updatedToday: latestStates.filter(s => {
        if (!s.lastUpdated) return false;
        const lastUpdated = new Date(s.lastUpdated);
        return lastUpdated >= todayStart;
      }).length,
    };
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("❌ [STATS] Error fetching client state statistics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch statistics",
    });
  }
});

// GET /api/clients/:id/state/history - Get all state versions for a client
router.get("/clients/:id/state/history", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const clientId = req.params.id;
    const consultantId = req.user!.id;

    const client = await storage.getUser(clientId);
    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    if (client.consultantId !== consultantId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const history = await storage.getClientStateHistory(clientId, consultantId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch state history",
    });
  }
});

// POST /api/clients/:id/state/ai-generate - AI auto-generates client state from full context (consultant only)
router.post("/clients/:id/state/ai-generate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const clientId = req.params.id;
    const consultantId = req.user!.id;
    
    console.log(`🤖 [AI STATE] Generating client state for ${clientId} by consultant ${consultantId}`);
    
    // Verify client exists and belongs to this consultant
    const client = await storage.getUser(clientId);
    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }
    
    if (client.consultantId !== consultantId) {
      return res.status(403).json({ success: false, error: "Access denied - this is not your client" });
    }
    
    // Get consultant's API keys for Gemini
    const [consultantUser] = await db.select().from(users).where(eq(users.id, consultantId)).limit(1);
    const apiKeys = consultantUser?.geminiApiKeys || [];
    const currentIndex = consultantUser?.geminiApiKeyIndex || 0;
    let apiKey: string;
    let shouldRotate = false;

    if (apiKeys.length > 0) {
      apiKey = apiKeys[currentIndex % apiKeys.length];
      shouldRotate = true;
    } else {
      const superAdminKeys = await getSuperAdminGeminiKeys();
      if (superAdminKeys && superAdminKeys.enabled && superAdminKeys.keys.length > 0) {
        apiKey = superAdminKeys.keys[0];
      } else {
        apiKey = process.env.GEMINI_API_KEY || "";
      }
    }

    if (!apiKey) {
      return res.status(500).json({ success: false, error: "Gemini API key not configured" });
    }
    
    // Build full user context (EXACTLY like AI assistant does)
    console.log(`🔍 [AI STATE] Building full 360° context for client...`);
    const userContext = await buildUserContext(clientId);
    
    // Use buildSystemPrompt EXACTLY like AI Assistant does
    // This puts ALL the rich context (finance data, exercises, etc.) into the system instruction
    console.log(`🤖 [AI STATE] Building system prompt with buildSystemPrompt...`);
    const systemPrompt = buildSystemPrompt('consulente', 'finanziario', userContext);
    
    // Short user message - only asks for JSON extraction
    // All the context is already in systemPrompt, so this can be brief
    const userMessage = `Basandoti su TUTTO il contesto fornito nel system prompt (dati finanziari dal Software Orbitale, esercizi, lezioni, roadmap, obiettivi, ecc.), crea un'analisi COMPLETA e PERSONALIZZATA del cliente.

🎯 IMPORTANTE:
- Analizza in modo PROFONDO tutti i dati disponibili
- Usa un tono EMPATICO e CALDO
- I campi pastAttempts, currentActions e futureVision sono OBBLIGATORI (non lasciarli mai vuoti)
- Se hai dati dal Software Orbitale, INCLUDILI nello stato attuale con valori precisi

Rispondi SOLO con JSON valido:
{
  "currentState": "2-3 frasi sulla situazione ATTUALE (includi dati finanziari se disponibili)",
  "idealState": "2-3 frasi su dove VUOLE ARRIVARE",
  "internalBenefit": "1-2 frasi sul beneficio PERSONALE/EMOTIVO",
  "externalBenefit": "1-2 frasi sul beneficio CONCRETO",
  "mainObstacle": "1-2 frasi sull'ostacolo PRINCIPALE",
  "pastAttempts": "2-3 frasi su cosa ha GIÀ PROVATO (OBBLIGATORIO)",
  "currentActions": "2-3 frasi su cosa sta facendo ORA (OBBLIGATORIO)",
  "futureVision": "2-3 frasi su dove si vede tra 3-5 anni (OBBLIGATORIO)",
  "motivationDrivers": "Testo descrittivo di cosa motiva il cliente a raggiungere i suoi obiettivi"
}`;
    
    // Call Gemini API EXACTLY like ai-service.ts does (with systemInstruction!)
    console.log(`🤖 [AI STATE] Calling Gemini API with systemInstruction...`);
    const genai = new GoogleGenAI({ apiKey });
    const result = await genai.models.generateContent({
      model: GEMINI_3_MODEL,
      config: {
        temperature: 0.7,
        maxOutputTokens: 250000,
        responseMimeType: "application/json",
        systemInstruction: systemPrompt, // 🔥 KEY: Use buildSystemPrompt as systemInstruction (like AI Assistant)
      },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
    });
    
    const responseText = result.text || "";
    console.log(`📝 [AI STATE] Raw response length: ${responseText.length} chars`);
    
    if (!responseText || responseText.trim().length === 0) {
      throw new Error("Gemini API returned empty response");
    }
    
    // Parse JSON response
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    console.log(`📝 [AI STATE] Cleaned JSON text (first 200 chars): ${jsonText.substring(0, 200)}`);
    
    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(jsonText);
    } catch (parseError: any) {
      console.warn(`⚠️ [AI STATE] JSON parse error, attempting repair: ${parseError.message}`);
      try {
        const lastBrace = jsonText.lastIndexOf('}');
        if (lastBrace > 0) {
          const trimmed = jsonText.substring(0, lastBrace + 1);
          aiAnalysis = JSON.parse(trimmed);
          console.log(`✅ [AI STATE] JSON repaired by trimming trailing content`);
        } else {
          throw parseError;
        }
      } catch {
        try {
          const openBraces = (jsonText.match(/\{/g) || []).length;
          const closeBraces = (jsonText.match(/\}/g) || []).length;
          let repaired = jsonText;
          if (openBraces > closeBraces) {
            const lastQuote = repaired.lastIndexOf('"');
            if (lastQuote > 0) {
              repaired = repaired.substring(0, lastQuote + 1);
            }
            for (let i = 0; i < openBraces - closeBraces; i++) {
              repaired += '}';
            }
            aiAnalysis = JSON.parse(repaired);
            console.log(`✅ [AI STATE] JSON repaired by closing ${openBraces - closeBraces} braces`);
          } else {
            throw parseError;
          }
        } catch {
          console.error(`❌ [AI STATE] JSON repair failed`);
          console.error(`📝 [AI STATE] Failed JSON text:`, jsonText.substring(0, 500));
          throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
        }
      }
    }
    
    // Validate structure
    if (!aiAnalysis.currentState || !aiAnalysis.idealState) {
      throw new Error("Invalid AI analysis structure");
    }
    
    console.log(`✅ [AI STATE] AI analysis generated successfully`);
    console.log(`   Campi generati: currentState, idealState, pastAttempts, currentActions, futureVision`);
    
    // Rotate API key if using consultant's keys
    if (shouldRotate) {
      await db.execute(
        drizzleSql`UPDATE users 
            SET gemini_api_key_index = (COALESCE(gemini_api_key_index, 0) + 1) % ${apiKeys.length}
            WHERE id = ${consultantId}`
      );
      console.log(`🔄 [AI STATE] Rotated API key for consultant ${consultantId}`);
    }
    
    // Validate that AI generated all required fields
    if (!aiAnalysis.pastAttempts || !aiAnalysis.currentActions || !aiAnalysis.futureVision) {
      console.warn(`⚠️ [AI STATE] AI response missing some fields:`, {
        hasPastAttempts: !!aiAnalysis.pastAttempts,
        hasCurrentActions: !!aiAnalysis.currentActions,
        hasFutureVision: !!aiAnalysis.futureVision
      });
    }
    
    // Save to database
    const stateData = {
      clientId,
      consultantId,
      currentState: aiAnalysis.currentState,
      idealState: aiAnalysis.idealState,
      internalBenefit: aiAnalysis.internalBenefit || null,
      externalBenefit: aiAnalysis.externalBenefit || null,
      mainObstacle: aiAnalysis.mainObstacle || null,
      pastAttempts: aiAnalysis.pastAttempts || null,
      currentActions: aiAnalysis.currentActions || null,
      futureVision: aiAnalysis.futureVision || null,
      motivationDrivers: aiAnalysis.motivationDrivers || null,
      source: "ai" as const,
    };
    
    console.log(`📝 [AI STATE] Saving data with fields:`, {
      hasPastAttempts: !!stateData.pastAttempts,
      hasCurrentActions: !!stateData.currentActions,
      hasFutureVision: !!stateData.futureVision,
      pastAttemptsLength: stateData.pastAttempts?.length || 0,
      currentActionsLength: stateData.currentActions?.length || 0,
      futureVisionLength: stateData.futureVision?.length || 0
    });
    
    const savedState = await storage.upsertClientState(stateData);
    
    console.log(`💾 [AI STATE] State saved to database`);
    
    res.json({
      success: true,
      data: savedState,
      message: "Client state generated successfully by AI"
    });
    
  } catch (error: any) {
    console.error("❌ [AI STATE] Error generating client state:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate client state with AI"
    });
  }
});

// GET /api/client/consultant-info - Get consultant info for Gold/Deluxe clients to access employee agents
router.get("/client/consultant-info", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.id;
    const client = await storage.getUser(clientId);
    
    if (!client || !client.consultantId) {
      return res.status(404).json({
        success: false,
        error: "Consultant not found for this client"
      });
    }
    
    // Get consultant's pricing page slug
    const consultant = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      pricingPageSlug: users.pricingPageSlug,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, client.consultantId))
    .limit(1);
    
    if (consultant.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Consultant not found"
      });
    }
    
    const c = consultant[0];
    const slug = c.pricingPageSlug || c.username;
    
    res.json({
      success: true,
      data: {
        consultantId: c.id,
        consultantName: `${c.firstName} ${c.lastName}`.trim(),
        slug: slug,
      }
    });
  } catch (error: any) {
    console.error("❌ [CLIENT CONSULTANT INFO] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get consultant info"
    });
  }
});

export default router;
