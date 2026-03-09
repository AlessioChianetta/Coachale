import { Router, Response } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getAIProvider, getModelWithThinking, GEMINI_3_MODEL } from '../ai/provider-factory';
import { searchGoogleMaps, scrapeWebsiteWithFirecrawl } from '../services/lead-scraper-service';
import { decrypt } from '../encryption';
import { superadminLeadScraperConfig } from '../../shared/schema';
import { getOnboardingStatusForAI } from './onboarding';
import { fileSearchService } from '../ai/file-search-service';

const fileSearchBootstrapped = new Set<string>();

async function ensureFileSearchBootstrap(consultantId: string): Promise<void> {
  if (fileSearchBootstrapped.has(consultantId)) return;

  try {
    const checkRes = await db.execute(sql`
      SELECT id FROM file_search_documents
      WHERE source_type = 'consultant_guide'
        AND source_id = ${'consultant-guide-' + consultantId}
        AND status = 'indexed'
      LIMIT 1
    `);

    if (checkRes.rows.length > 0) {
      fileSearchBootstrapped.add(consultantId);
      console.log(`[DeliveryAgent] File search already indexed for consultant ${consultantId}`);
      return;
    }

    console.log(`[DeliveryAgent] Bootstrapping file search for consultant ${consultantId}...`);
    const { FileSearchSyncService } = await import('../services/file-search-sync-service');
    const result = await FileSearchSyncService.syncConsultantGuide(consultantId);
    if (result.success) {
      fileSearchBootstrapped.add(consultantId);
    }
    console.log(`[DeliveryAgent] File search bootstrap result:`, result);
  } catch (err) {
    console.warn(`[DeliveryAgent] File search bootstrap failed (non-blocking, will retry):`, err);
  }
}

async function getLeadScraperKeys(): Promise<{ serpApiKey: string | null; firecrawlKey: string | null }> {
  try {
    const [config] = await db.select().from(superadminLeadScraperConfig).limit(1);
    if (config && config.enabled) {
      return {
        serpApiKey: config.serpapiKeyEncrypted ? decrypt(config.serpapiKeyEncrypted) : null,
        firecrawlKey: config.firecrawlKeyEncrypted ? decrypt(config.firecrawlKeyEncrypted) : null,
      };
    }
  } catch (e) {
    console.error("[DeliveryAgent] Error reading lead scraper keys:", e);
  }
  return {
    serpApiKey: process.env.SERPAPI_KEY || null,
    firecrawlKey: process.env.FIRECRAWL_API_KEY || null,
  };
}

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

async function ensureTables() {
  const statements = [
    sql`CREATE TABLE IF NOT EXISTS delivery_agent_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      consultant_id VARCHAR NOT NULL,
      mode VARCHAR NOT NULL DEFAULT 'onboarding',
      status VARCHAR NOT NULL DEFAULT 'discovery',
      client_profile_json JSONB,
      public_token VARCHAR UNIQUE,
      lead_name VARCHAR,
      lead_email VARCHAR,
      lead_phone VARCHAR,
      is_public BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS delivery_agent_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR NOT NULL,
      role VARCHAR NOT NULL,
      content TEXT NOT NULL,
      metadata_json JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS delivery_agent_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR NOT NULL,
      consultant_id VARCHAR NOT NULL,
      report_json JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  ];
  for (const stmt of statements) {
    try { await db.execute(stmt); } catch (e: any) {
      if (!e.message?.includes('already exists')) console.warn('[DeliveryAgent] Table warn:', e.message);
    }
  }

  const alterStatements = [
    sql`ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS public_token VARCHAR UNIQUE`,
    sql`ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_name VARCHAR`,
    sql`ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_email VARCHAR`,
    sql`ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_phone VARCHAR`,
    sql`ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false`,
  ];
  for (const stmt of alterStatements) {
    try { await db.execute(stmt); } catch (e: any) {
      console.warn('[DeliveryAgent] Alter warn:', e.message);
    }
  }
}

ensureTables().catch(err => console.error('[DeliveryAgent] Init error:', err));

router.post('/sessions', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { mode, simulatorConfig, salesCoachConfig } = req.body;
    if (!mode || !['onboarding', 'discovery', 'simulator', 'sales_coach'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'Mode must be onboarding, discovery, simulator, or sales_coach' });
    }

    if (mode === 'sales_coach') {
      const existing = await db.execute(sql`
        SELECT * FROM delivery_agent_sessions
        WHERE consultant_id = ${consultantId} AND mode = 'sales_coach'
        ORDER BY updated_at DESC LIMIT 1
      `);
      if (existing.rows.length > 0) {
        return res.json({ success: true, data: existing.rows[0] });
      }
      const initialProfile = JSON.stringify({ sales_coach: { packages: ['all'], package_labels: ['Panoramica Completa'] } });
      const result = await db.execute(sql`
        INSERT INTO delivery_agent_sessions (consultant_id, mode, status, client_profile_json)
        VALUES (${consultantId}, 'sales_coach', 'assistant', ${initialProfile}::jsonb)
        RETURNING *
      `);
      return res.json({ success: true, data: result.rows[0] });
    }

    let initialProfile = null;
    if (mode === 'simulator') {
      if (!simulatorConfig || !simulatorConfig.niche || !simulatorConfig.attitude) {
        return res.status(400).json({ success: false, error: 'simulatorConfig with niche and attitude is required for simulator mode' });
      }
      initialProfile = JSON.stringify({ simulator: { niche: simulatorConfig.niche, niche_label: simulatorConfig.niche_label || simulatorConfig.niche, attitude: simulatorConfig.attitude, attitude_label: simulatorConfig.attitude_label || simulatorConfig.attitude } });
    }
    const result = await db.execute(sql`
      INSERT INTO delivery_agent_sessions (consultant_id, mode, status, client_profile_json)
      VALUES (${consultantId}, ${mode}, 'discovery', ${initialProfile}::jsonb)
      RETURNING *
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    console.error('[DeliveryAgent] POST sessions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/sessions', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const sessions = await db.execute(sql`
      SELECT s.*,
        (SELECT content FROM delivery_agent_messages WHERE session_id = s.id::text ORDER BY created_at DESC LIMIT 1) as last_message
      FROM delivery_agent_sessions s
      WHERE s.consultant_id = ${consultantId}
      ORDER BY s.updated_at DESC
    `);
    res.json({ success: true, data: sessions.rows });
  } catch (err: any) {
    console.error('[DeliveryAgent] GET sessions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/sessions/:id', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;
    const sessionRes = await db.execute(sql`
      SELECT * FROM delivery_agent_sessions
      WHERE id = ${id}::uuid AND consultant_id = ${consultantId}
    `);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    const messagesRes = await db.execute(sql`
      SELECT * FROM delivery_agent_messages
      WHERE session_id = ${id}
      ORDER BY created_at ASC
    `);
    const reportRes = await db.execute(sql`
      SELECT * FROM delivery_agent_reports
      WHERE session_id = ${id}
      LIMIT 1
    `);
    res.json({
      success: true,
      data: {
        session: sessionRes.rows[0],
        messages: messagesRes.rows,
        report: reportRes.rows[0] || null,
      },
    });
  } catch (err: any) {
    console.error('[DeliveryAgent] GET session error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/chat', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  const consultantId = req.user!.id;
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ success: false, error: 'sessionId and message required' });
  }
  if (!isValidUUID(sessionId)) {
    return res.status(400).json({ success: false, error: 'Invalid session ID format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendSSE = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    ensureFileSearchBootstrap(consultantId).catch(() => {});

    const sessionRes = await db.execute(sql`
      SELECT * FROM delivery_agent_sessions
      WHERE id = ${sessionId}::uuid AND consultant_id = ${consultantId}
    `);
    if (sessionRes.rows.length === 0) {
      sendSSE('error', { error: 'Session not found' });
      res.end();
      return;
    }
    const session = sessionRes.rows[0] as any;

    await db.execute(sql`
      INSERT INTO delivery_agent_messages (session_id, role, content)
      VALUES (${sessionId}, 'user', ${message})
    `);

    const historyRes = await db.execute(sql`
      SELECT role, content FROM delivery_agent_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `);

    const contents = (historyRes.rows as any[]).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    let activationStatuses: { stepId: string; status: string }[] = [];
    try {
      activationStatuses = await getOnboardingStatusForAI(consultantId);
    } catch (e: any) {
      console.warn('[DeliveryAgent] Could not fetch activation statuses:', e.message);
    }

    let customDocuments: { title: string; content: string }[] = [];
    if (session.mode === 'sales_coach') {
      try {
        const settingsRes = await db.execute(sql`
          SELECT agent_contexts FROM ai_autonomy_settings
          WHERE consultant_id::text = ${consultantId}::text LIMIT 1
        `);
        const agentContexts = (settingsRes.rows[0] as any)?.agent_contexts || {};
        const robertCtx = agentContexts.robert || {};
        const linkedDocIds: string[] = robertCtx.linkedKbDocumentIds || [];
        if (linkedDocIds.length > 0) {
          const docsRes = await db.execute(sql`
            SELECT title, content FROM consultant_knowledge_documents
            WHERE id = ANY(${linkedDocIds}::uuid[]) AND consultant_id = ${consultantId}
          `);
          customDocuments = (docsRes.rows as any[]).map((d: any) => ({
            title: d.title || 'Documento senza titolo',
            content: (d.content || '').substring(0, 50000),
          }));
          if (customDocuments.length === 0) console.warn('[DeliveryAgent] Robert linkedKbDocumentIds resolved to 0 documents');
        }
      } catch (e: any) {
        console.warn('[DeliveryAgent] Failed to fetch Robert custom documents:', e.message);
      }
    }

    let systemPromptText = '';
    try {
      const { getDeliveryAgentSystemPrompt } = await import('../prompts/delivery-agent-prompt');
      systemPromptText = getDeliveryAgentSystemPrompt(session.mode, session.status, session.client_profile_json, activationStatuses, customDocuments);
    } catch {
      systemPromptText = `You are a delivery agent assistant. Mode: ${session.mode}. Status: ${session.status}. Help the consultant with onboarding and discovery.`;
    }

    if (session.mode === 'sales_coach') {
      console.log(`\n${'='.repeat(80)}\n[SALES COACH] FULL SYSTEM PROMPT (${systemPromptText.length} chars):\n${'='.repeat(80)}\n${systemPromptText}\n${'='.repeat(80)}\n`);
    }

    const provider = await getAIProvider(consultantId);
    if (provider.setFeature) {
      provider.setFeature('delivery-agent', 'consultant');
    }

    let fileSearchTool: any = null;
    try {
      const { storeNames, breakdown } = await fileSearchService.getStoreBreakdownForGeneration(consultantId, 'consultant');
      if (storeNames.length > 0) {
        fileSearchTool = fileSearchService.buildFileSearchTool(storeNames);
        console.log(`🔍 [DeliveryAgent] File Search enabled with ${storeNames.length} stores:`, breakdown.map(b => `${b.storeDisplayName} (${b.totalDocs} docs)`).join(', '));
      } else {
        console.log(`⚠️ [DeliveryAgent] No File Search stores found for consultant ${consultantId}`);
      }
    } catch (fsErr: any) {
      console.warn(`[DeliveryAgent] File Search setup failed (non-blocking):`, fsErr.message);
    }

    const { model, useThinking, thinkingLevel } = getModelWithThinking(provider.metadata?.providerName);

    const generationConfig: any = {
      maxOutputTokens: 12288,
      temperature: 0.7,
    };
    if (useThinking) {
      generationConfig.thinkingConfig = { thinkingBudget: thinkingLevel === 'high' ? 8192 : thinkingLevel === 'medium' ? 4096 : 2048 };
    }

    const streamConfig: any = {
      model,
      contents,
      generationConfig,
      systemInstruction: { role: 'system', parts: [{ text: systemPromptText }] },
    };
    if (fileSearchTool) {
      streamConfig.tools = [fileSearchTool];
    }

    const stream = await provider.client.generateContentStream(streamConfig);

    let fullText = '';
    let thinkingText = '';
    for await (const chunk of stream) {
      if (chunk.candidates) {
        for (const candidate of chunk.candidates) {
          if (candidate.content?.parts) {
            for (const part of candidate.content.parts) {
              if ((part as any).thought && part.text) {
                thinkingText += part.text;
                sendSSE('thinking', { content: part.text });
              } else if (part.text) {
                fullText += part.text;
                sendSSE('delta', { content: part.text });
              }
            }
          }
        }
      } else {
        const chunkText = typeof chunk.text === 'function' ? chunk.text() : (typeof chunk.text === 'string' ? chunk.text : '');
        if (chunkText) {
          fullText += chunkText;
          sendSSE('delta', { content: chunkText });
        }
      }
    }

    const metadataJson = thinkingText ? JSON.stringify({ thinking: thinkingText }) : null;
    await db.execute(sql`
      INSERT INTO delivery_agent_messages (session_id, role, content, metadata_json)
      VALUES (${sessionId}, 'assistant', ${fullText}, ${metadataJson}::jsonb)
    `);

    if (session.status === 'discovery' && fullText.includes('[DISCOVERY_COMPLETE]')) {
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
      let profileJson = null;
      if (jsonMatch) {
        try { profileJson = JSON.parse(jsonMatch[1]); } catch { /* ignore */ }
      }
      await db.execute(sql`
        UPDATE delivery_agent_sessions
        SET status = 'elaborating',
            client_profile_json = ${profileJson ? JSON.stringify(profileJson) : null}::jsonb,
            updated_at = NOW()
        WHERE id = ${sessionId}::uuid
      `);
      sendSSE('phase_change', { phase: 'elaborating', profile: profileJson });
    }

    await db.execute(sql`
      UPDATE delivery_agent_sessions SET updated_at = NOW() WHERE id = ${sessionId}::uuid
    `);

    sendSSE('complete', { content: fullText });
    res.end();
  } catch (err: any) {
    console.error('[DeliveryAgent] Chat error:', err);
    sendSSE('error', { error: err.message || 'Chat error' });
    res.end();
  }
});

router.post('/generate-report/:sessionId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { sessionId } = req.params;

    const sessionRes = await db.execute(sql`
      SELECT * FROM delivery_agent_sessions
      WHERE id = ${sessionId}::uuid AND consultant_id = ${consultantId}
    `);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    const session = sessionRes.rows[0] as any;

    const messagesRes = await db.execute(sql`
      SELECT role, content FROM delivery_agent_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `);

    const conversationText = (messagesRes.rows as any[])
      .map(m => `${m.role === 'assistant' ? 'Luca' : 'Consulente'}: ${m.content}`)
      .join('\n\n');

    const profileJson = session.client_profile_json ? JSON.stringify(session.client_profile_json, null, 2) : 'Non disponibile';
    const clientProfile = session.client_profile_json || {};

    let businessIntelligence: any = null;
    try {
      const nomeAttivita = clientProfile.nome_attivita || null;
      const sitoWeb = clientProfile.sito_web || null;
      const citta = clientProfile.citta_operativa || null;

      if (nomeAttivita || sitoWeb) {
        console.log(`[DeliveryAgent] Business Intelligence: scraping for "${nomeAttivita}" in "${citta}", website: ${sitoWeb}`);
        const keys = await getLeadScraperKeys();

        const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
          Promise.race([
            promise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)),
          ]);

        if (nomeAttivita && citta && keys.serpApiKey) {
          try {
            const mapResults = await withTimeout(searchGoogleMaps(nomeAttivita, citta, 1, keys.serpApiKey), 15000, 'Google Maps');
            if (mapResults.length > 0) {
              const biz = mapResults[0];
              businessIntelligence = {
                googleRating: biz.rating || null,
                reviewCount: biz.reviews || null,
                address: biz.address || null,
                phone: biz.phone || null,
                website: biz.website || sitoWeb || null,
              };
              console.log(`[DeliveryAgent] Google Maps found: ${biz.title}, rating: ${biz.rating}, reviews: ${biz.reviews}`);

              if (!sitoWeb && biz.website) {
                businessIntelligence.website = biz.website;
              }
            }
          } catch (mapErr: any) {
            console.warn(`[DeliveryAgent] Google Maps scraping failed: ${mapErr.message}`);
          }
        }

        const websiteToScrape = sitoWeb || businessIntelligence?.website;
        if (websiteToScrape && keys.firecrawlKey) {
          try {
            const siteData = await withTimeout(scrapeWebsiteWithFirecrawl(websiteToScrape, keys.firecrawlKey), 20000, 'Firecrawl');
            if (!businessIntelligence) businessIntelligence = {};
            businessIntelligence.website = websiteToScrape;
            businessIntelligence.websiteDescription = siteData.description || null;
            businessIntelligence.servicesOffered = siteData.services || [];
            businessIntelligence.socialLinks = siteData.socialLinks || {};
            businessIntelligence.teamMembers = siteData.teamMembers || [];
            console.log(`[DeliveryAgent] Website scraped: ${siteData.services?.length || 0} services, ${siteData.teamMembers?.length || 0} team members`);
          } catch (scrapeErr: any) {
            console.warn(`[DeliveryAgent] Website scraping failed: ${scrapeErr.message}`);
          }
        }

        if (businessIntelligence) {
          console.log(`[DeliveryAgent] Business Intelligence collected successfully`);
        } else {
          console.log(`[DeliveryAgent] No business intelligence data found — proceeding without`);
        }
      } else {
        console.log(`[DeliveryAgent] No business name or website in profile — skipping scraping`);
      }
    } catch (biErr: any) {
      console.warn(`[DeliveryAgent] Business Intelligence failed entirely: ${biErr.message} — continuing without`);
      businessIntelligence = null;
    }

    let reportPrompt = '';
    try {
      const { getReportGenerationPrompt } = await import('../prompts/delivery-agent-prompt');
      reportPrompt = getReportGenerationPrompt(businessIntelligence);
    } catch {
      reportPrompt = `Generate a structured onboarding report in JSON format with these sections: lettera_personale, profilo_cliente, diagnosi, pacchetti_consigliati, roadmap, quick_wins, azioni_questa_settimana, metriche_successo, chiusura_personale.`;
    }

    const provider = await getAIProvider(consultantId);
    if (provider.setFeature) {
      provider.setFeature('delivery-agent-report', 'consultant');
    }

    const { model, useThinking, thinkingLevel } = getModelWithThinking(provider.metadata?.providerName);

    const thinkingConfig: any = {};
    if (useThinking) {
      thinkingConfig.thinkingConfig = { thinkingBudget: thinkingLevel === 'high' ? 16384 : thinkingLevel === 'medium' ? 8192 : 4096 };
    }

    const multiTurnContents = (messagesRes.rows as any[]).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    console.log(`[DeliveryAgent] Report generation START — session: ${sessionId}, messages: ${messagesRes.rows.length}, conversation length: ${conversationText.length} chars`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: ANALISI — Ragiona sulla conversazione e identifica pattern
    // ═══════════════════════════════════════════════════════════════
    let analysisText = '';
    console.log('[DeliveryAgent] STEP 1: Analisi della conversazione...');
    try {
      const step1Contents = [
        ...multiTurnContents,
        {
          role: 'user',
          parts: [{
            text: `La discovery è conclusa. Profilo Estratto:\n${profileJson}\n\n${businessIntelligence ? `BUSINESS INTELLIGENCE (dati dalla ricerca online):\n${JSON.stringify(businessIntelligence, null, 2)}\n\n` : ''}COMPITO: Analizza in profondità questa conversazione. NON generare ancora il report. Fai un'analisi critica:

1. **Pattern chiave emersi**: Quali sono i 3-5 pattern più importanti che hai notato? (es. "il consulente ha un business solido ma dipende completamente da lui", "ha molti clienti ma li perde per mancanza di follow-up")

2. **Contraddizioni o lacune**: Ci sono cose che non tornano? Risposte vaghe che non hai potuto approfondire? Informazioni mancanti?

3. **Urgenza reale vs percepita**: Cosa dice il consulente di volere vs cosa emerge come bisogno reale dalla conversazione?

4. **Pacchetti candidati**: Quali pacchetti servizio sono chiaramente rilevanti? Quali sono borderline? Quali sono sicuramente da escludere? Motiva ogni scelta con riferimenti specifici alla conversazione.

5. **Rischi e dipendenze**: Quali sono i rischi principali nell'implementazione? Ci sono prerequisiti tecnici che potrebbero bloccare il consulente?

6. **Ordine di priorità**: Se il consulente potesse attivare solo 2 pacchetti nei prossimi 30 giorni, quali sarebbero e perché?

Ragiona in modo strutturato e critico. Questa analisi servirà come base per il report finale.`,
          }],
        },
      ];

      const analysisResult = await provider.client.generateContent({
        model,
        contents: step1Contents,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.6,
          ...thinkingConfig,
        },
        systemInstruction: { role: 'system', parts: [{ text: reportPrompt }] },
      });

      analysisText = analysisResult.response.text();
      console.log(`[DeliveryAgent] STEP 1 DONE — Analysis: ${analysisText.length} chars`);
    } catch (step1Err: any) {
      console.error('[DeliveryAgent] STEP 1 FAILED, continuing without analysis:', step1Err.message);
      analysisText = `Analisi non disponibile a causa di un errore. Genera il report basandoti direttamente sulla conversazione e sul profilo estratto.`;
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: DRAFT — Genera il report JSON basato sull'analisi
    // ═══════════════════════════════════════════════════════════════
    let draftJson: any = null;
    let draftText = '';
    console.log('[DeliveryAgent] STEP 2: Generazione draft report...');
    try {
      const draftResult = await provider.client.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{
              text: `Profilo Cliente Estratto:\n${profileJson}\n\nConversazione Completa:\n${conversationText}`,
            }],
          },
          {
            role: 'model',
            parts: [{
              text: `Ho analizzato la conversazione in profondità. Ecco la mia analisi:\n\n${analysisText}`,
            }],
          },
          {
            role: 'user',
            parts: [{
              text: `Perfetto. Ora basandoti sulla tua analisi, genera il report JSON strutturato completo. Segui esattamente il template nel system prompt. Ricorda:
- Includi SOLO i pacchetti che servono davvero nei pacchetti_consigliati (tipicamente 4-7, non tutti e 10)
- Ogni "perche_per_te" deve citare cose specifiche dette dal consulente durante la conversazione
- La roadmap deve rispettare le dipendenze — ogni fase deve avere "vita_dopo" che descrive come cambia la vita lavorativa
- I quick_wins devono essere azioni concrete sotto i 30 minuti — includi "testo_da_copiare" quando l'azione prevede un messaggio o template
- Le metriche devono essere misurabili nella piattaforma
- Includi "flusso_completo" — un paragrafo narrativo su come i moduli si parlano nel caso specifico
- Includi "avvertimento_onesto" — dove farai fatica e perché vale la pena
- Includi "segnali_successo" — almeno 3 segnali con timeframe diversificati e "dove_guardare" nella piattaforma
- Ogni modulo nei pacchetti_consigliati deve avere "primo_passo" e "come_misuri"
- Il catalogo_completo deve includere TUTTI E 10 i pacchetti con analisi APPROFONDITA per ciascuno: punteggio (1-10), cosa_va_bene, cosa_non_funziona, diagnosi_critica (opzionale), come_correggere (2-4 azioni con →), descrizione_personalizzata, esempi_concreti (2-3). Stessa profondità dei pacchetti_consigliati — non descrizioni superficiali.

Rispondi SOLO con il JSON nel formato richiesto.`,
            }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 32768,
          temperature: 0.4,
          ...thinkingConfig,
        },
        systemInstruction: { role: 'system', parts: [{ text: reportPrompt }] },
      });

      draftText = draftResult.response.text();
      console.log(`[DeliveryAgent] STEP 2 DONE — Draft: ${draftText.length} chars`);

      const draftMatch = draftText.match(/```json\s*([\s\S]*?)```/);
      if (draftMatch) {
        try { draftJson = JSON.parse(draftMatch[1]); } catch { /* continue */ }
      }
      if (!draftJson) {
        try { draftJson = JSON.parse(draftText); } catch { /* continue */ }
      }
    } catch (step2Err: any) {
      console.error('[DeliveryAgent] STEP 2 FAILED:', step2Err.message);
      throw new Error(`Report draft generation failed: ${step2Err.message}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: REVISIONE — Rileggi, critica e migliora il report
    // ═══════════════════════════════════════════════════════════════
    let reportJson: any = null;
    console.log('[DeliveryAgent] STEP 3: Revisione critica del report...');
    try {
      const reviewResult = await provider.client.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{
              text: `Sei Luca. Hai generato questo report per un consulente dopo una discovery approfondita.

REPORT DRAFT:
\`\`\`json
${JSON.stringify(draftJson || draftText, null, 2)}
\`\`\`

PROFILO ORIGINALE:
${profileJson}

ANALISI ORIGINALE:
${analysisText}

CONVERSAZIONE COMPLETA (per verificare coerenza):
${conversationText}

COMPITO DI REVISIONE CRITICA: Rileggi il report e valuta:

1. **Coerenza con la conversazione**: I "perche_per_te" citano davvero cose dette dal consulente o sono generici? Se sono generici, riscrivili con riferimenti specifici.

2. **Pacchetti mancanti o superflui**: C'è un pacchetto che dovrebbe esserci ma manca? C'è un pacchetto consigliato che non serve davvero?

3. **Roadmap realistica**: L'ordine delle settimane rispetta le dipendenze? Le azioni sono concrete e fattibili nei tempi indicati?

4. **Quick wins**: Sono davvero rapidi (sotto 30 min)? Sono ad alto impatto per QUESTO consulente specifico?

5. **Metriche**: Sono misurabili nella piattaforma o sono metriche astratte?

6. **Diagnosi**: La sezione "dove_sei_ora" e "gap_analysis" riflettono davvero la situazione emersa?

7. **Catalogo Completo**: Ci sono tutti e 10 i pacchetti? Ogni pacchetto ha punteggio, cosa_va_bene, cosa_non_funziona, come_correggere con almeno 2 azioni concrete? Le descrizioni sono personalizzate e gli esempi tangibili?

8. **Nuovi campi**: C'è il flusso_completo (paragrafo narrativo)? L'avvertimento_onesto è genuinamente onesto? I segnali_successo hanno almeno 3 entry con timeframe diversificati? Le quick_wins hanno testo_da_copiare dove serve? I moduli hanno primo_passo e come_misuri? La roadmap ha vita_dopo per ogni fase?

Se trovi problemi, genera il report JSON CORRETTO e COMPLETO (incluso catalogo_completo con TUTTI i 10 pacchetti e analisi approfondita). Se il report è già buono, restituiscilo invariato.
Rispondi SOLO con il JSON finale nel formato \`\`\`json ... \`\`\`.`,
            }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 32768,
          temperature: 0.3,
          ...thinkingConfig,
        },
        systemInstruction: { role: 'system', parts: [{ text: reportPrompt }] },
      });

      const reviewText = reviewResult.response.text();
      console.log(`[DeliveryAgent] STEP 3 DONE — Review: ${reviewText.length} chars`);

      const reviewMatch = reviewText.match(/```json\s*([\s\S]*?)```/);
      if (reviewMatch) {
        try { reportJson = JSON.parse(reviewMatch[1]); } catch { /* fallback to draft */ }
      }
      if (!reportJson) {
        try { reportJson = JSON.parse(reviewText); } catch { /* fallback to draft */ }
      }
    } catch (step3Err: any) {
      console.warn('[DeliveryAgent] STEP 3 FAILED, using draft:', step3Err.message);
    }

    if (!reportJson && draftJson) {
      console.log('[DeliveryAgent] Using draft report (review unavailable or parse failed)');
      reportJson = draftJson;
    }
    if (!reportJson) {
      try { reportJson = JSON.parse(draftText); } catch {
        reportJson = { raw_text: draftText };
      }
    }

    console.log(`[DeliveryAgent] Report generation COMPLETE — final report has ${reportJson?.pacchetti_consigliati?.length || 0} packages`);

    await db.execute(sql`
      INSERT INTO delivery_agent_reports (session_id, consultant_id, report_json)
      VALUES (${sessionId}, ${consultantId}, ${JSON.stringify(reportJson)}::jsonb)
    `);

    await db.execute(sql`
      UPDATE delivery_agent_sessions
      SET status = 'assistant', updated_at = NOW()
      WHERE id = ${sessionId}::uuid
    `);

    res.json({ success: true, data: { report: reportJson, status: 'assistant' } });
  } catch (err: any) {
    console.error('[DeliveryAgent] Report generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reports/:sessionId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { sessionId } = req.params;
    const result = await db.execute(sql`
      SELECT r.* FROM delivery_agent_reports r
      JOIN delivery_agent_sessions s ON s.id::text = r.session_id
      WHERE r.session_id = ${sessionId} AND s.consultant_id = ${consultantId}
      LIMIT 1
    `);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    console.error('[DeliveryAgent] GET report error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reports/:sessionId/pdf', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { sessionId } = req.params;
    const result = await db.execute(sql`
      SELECT r.* FROM delivery_agent_reports r
      JOIN delivery_agent_sessions s ON s.id::text = r.session_id
      WHERE r.session_id = ${sessionId} AND s.consultant_id = ${consultantId}
      LIMIT 1
    `);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    const reportRow = result.rows[0] as any;
    const raw = reportRow.report_json || {};

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 60, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="piano-strategico-${sessionId.slice(0, 8)}.pdf"`);
    doc.pipe(res);

    doc.on('error', (pdfErr: any) => {
      console.error('[DeliveryAgent] PDFKit stream error:', pdfErr);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'PDF generation failed' });
      }
    });

    const INDIGO = '#4f46e5';
    const DARK = '#1e1b4b';
    const GRAY = '#64748b';
    const LIGHT_BG = '#f8fafc';
    const GREEN = '#059669';
    const AMBER = '#d97706';
    const RED = '#dc2626';
    const pageW = 595.28 - 120;

    const addFooter = () => {
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.save();
        doc.fontSize(7).fillColor(GRAY).font('Helvetica');
        doc.text('Documento riservato — uso esclusivo del destinatario', 60, 800, { align: 'center', width: pageW });
        doc.text(`${i + 1}`, 60, 800, { align: 'right', width: pageW });
        doc.restore();
      }
    };

    const wrapText = (text: string, opts?: { fontSize?: number; color?: string; font?: string; lineGap?: number }) => {
      const { fontSize = 10, color = DARK, font = 'Helvetica', lineGap = 4 } = opts || {};
      doc.font(font).fontSize(fontSize).fillColor(color);
      doc.text(text, { lineGap, width: pageW });
    };

    const sectionTitle = (num: string, title: string) => {
      if (doc.y > 680) doc.addPage();
      doc.moveDown(1.5);
      doc.font('Helvetica').fontSize(11).fillColor(GRAY).text(num, { continued: true });
      doc.font('Helvetica-Bold').fontSize(16).fillColor(DARK).text(`  ${title}`);
      doc.moveDown(0.3);
      doc.moveTo(60, doc.y).lineTo(60 + pageW, doc.y).strokeColor(INDIGO).lineWidth(1.5).stroke();
      doc.moveDown(0.8);
    };

    const today = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.moveDown(8);
    doc.moveTo(250, doc.y).lineTo(345, doc.y).strokeColor(INDIGO).lineWidth(2).stroke();
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(28).fillColor(DARK).text('PIANO STRATEGICO', { align: 'center' });
    doc.font('Helvetica').fontSize(22).fillColor(GRAY).text('PERSONALIZZATO', { align: 'center' });
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(10).fillColor(GRAY).text(today, { align: 'center' });
    doc.text('Documento riservato', { align: 'center' });

    const profilo = raw.profilo_cliente || raw.client_profile;
    if (profilo) {
      const nome = profilo.nome || profilo.name;
      if (nome) {
        doc.moveDown(3);
        doc.font('Helvetica').fontSize(8).fillColor(GRAY).text('PREPARATO PER', { align: 'center' });
        doc.font('Helvetica-Bold').fontSize(14).fillColor(DARK).text(nome, { align: 'center' });
        const tipo = profilo.tipo_business || profilo.business_type;
        if (tipo) doc.font('Helvetica').fontSize(10).fillColor(GRAY).text(tipo, { align: 'center' });
      }
    }

    const lettera = raw.lettera_personale || raw.personal_letter;
    if (lettera) {
      doc.addPage();
      sectionTitle('', 'Lettera Personale');
      const paragraphs = lettera.split('\n\n');
      for (const p of paragraphs) {
        wrapText(p, { fontSize: 11, lineGap: 5 });
        doc.moveDown(0.6);
      }
    }

    if (profilo) {
      doc.addPage();
      sectionTitle('01', 'Profilo Cliente');
      const fields: [string, any][] = [
        ['Tipo Attività', profilo.tipo_business || profilo.business_type],
        ['Settore', profilo.settore || profilo.sector],
        ['Nicchia', profilo.nicchia || profilo.niche],
        ['Scala', profilo.scala_descrizione || profilo.scale],
        ['Team', profilo.team_size],
        ['Maturità Digitale', profilo.maturita_digitale || profilo.digital_maturity],
        ['Metodo Vendita', profilo.metodo_vendita || profilo.sales_method],
        ['Budget', profilo.budget],
        ['Sito Web', profilo.sito_web || profilo.website],
        ['Città', profilo.citta || profilo.city],
      ];
      for (const [label, value] of fields) {
        if (value) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text(label.toUpperCase(), { continued: true });
          doc.font('Helvetica').fontSize(10).fillColor(DARK).text(`  ${value}`);
          doc.moveDown(0.2);
        }
      }
      const painPoint = profilo.pain_point_badge || profilo.main_pain_point || profilo.pain_point_principale;
      if (painPoint) {
        doc.moveDown(0.5);
        const y = doc.y;
        doc.rect(60, y, pageW, 40).fillColor('#fef3c7').fill();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(AMBER).text('PAIN POINT PRINCIPALE', 70, y + 8);
        doc.font('Helvetica').fontSize(9).fillColor('#92400e').text(painPoint, 70, y + 22, { width: pageW - 20 });
        doc.y = y + 48;
      }
    }

    const diagnosi = raw.diagnosi || raw.diagnosis;
    if (diagnosi) {
      doc.addPage();
      sectionTitle('02', 'La Diagnosi');
      const doveOra = diagnosi.dove_sei_ora || diagnosi.current_state;
      const doveVuoi = diagnosi.dove_vuoi_arrivare || diagnosi.desired_state;
      if (doveOra) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(RED).text('DOVE SEI ORA');
        doc.moveDown(0.2);
        wrapText(doveOra, { fontSize: 10, color: '#7f1d1d' });
        doc.moveDown(0.8);
      }
      if (doveVuoi) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN).text('DOVE VUOI ARRIVARE');
        doc.moveDown(0.2);
        wrapText(doveVuoi, { fontSize: 10, color: '#064e3b' });
        doc.moveDown(0.8);
      }
      const gap = diagnosi.gap_analysis || diagnosi.analisi_gap;
      if (gap) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('ANALISI GAP');
        doc.moveDown(0.2);
        wrapText(gap);
        doc.moveDown(0.8);
      }
      const table = diagnosi.tabella_diagnostica || diagnosi.diagnostic_table;
      if (table && Array.isArray(table) && table.length > 0) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('DIAGNOSI PER AREA');
        doc.moveDown(0.4);
        const colW = [pageW * 0.25, pageW * 0.30, pageW * 0.15, pageW * 0.30];
        const headers = ['Area', 'Stato', 'Impatto', 'Nota'];
        let ty = doc.y;
        doc.rect(60, ty, pageW, 16).fillColor('#e2e8f0').fill();
        let tx = 60;
        for (let c = 0; c < headers.length; c++) {
          doc.font('Helvetica-Bold').fontSize(7).fillColor(GRAY).text(headers[c], tx + 4, ty + 4, { width: colW[c] - 8 });
          tx += colW[c];
        }
        ty += 16;
        for (const row of table) {
          if (ty > 740) { doc.addPage(); ty = 80; }
          const vals = [row.area, row.stato || row.status, row.impatto || row.impact || 'medio', row.nota || row.note || ''];
          tx = 60;
          const bg = vals[2] === 'urgente' ? '#fef2f2' : vals[2] === 'alto' ? '#fffbeb' : '#ffffff';
          doc.rect(60, ty, pageW, 18).fillColor(bg).fill();
          for (let c = 0; c < vals.length; c++) {
            const isImpatto = c === 2;
            doc.font(isImpatto ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(
              isImpatto ? (vals[2] === 'urgente' ? RED : vals[2] === 'alto' ? AMBER : DARK) : DARK
            ).text(String(vals[c]), tx + 4, ty + 4, { width: colW[c] - 8 });
            tx += colW[c];
          }
          ty += 18;
        }
        doc.y = ty + 8;
      }
      const insight = diagnosi.insight_chiave || diagnosi.key_insight;
      if (insight) {
        doc.moveDown(0.5);
        const iy = doc.y;
        doc.rect(60, iy, 3, 40).fillColor(AMBER).fill();
        doc.rect(63, iy, pageW - 3, 40).fillColor('#fffbeb').fill();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(AMBER).text('INSIGHT CHIAVE', 72, iy + 6);
        doc.font('Helvetica').fontSize(9).fillColor('#92400e').text(insight, 72, iy + 18, { width: pageW - 24 });
        doc.y = iy + 48;
      }
    }

    const pkgs = raw.pacchetti_consigliati || raw.recommended_packages;
    if (pkgs && Array.isArray(pkgs)) {
      pkgs.forEach((pkg: any, idx: number) => {
        doc.addPage();
        const num = String(idx + 3).padStart(2, '0');
        const name = pkg.nome_pacchetto || pkg.package_name || `Pacchetto ${idx + 1}`;
        const subtitle = pkg.sottotitolo || pkg.subtitle || '';
        const score = pkg.punteggio || pkg.score;
        sectionTitle(num, name);
        if (subtitle) {
          doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(subtitle);
          doc.moveDown(0.3);
        }
        if (score !== undefined) {
          doc.font('Helvetica-Bold').fontSize(20).fillColor(score >= 7 ? GREEN : score >= 4 ? AMBER : RED).text(`${score}/10`, { continued: true });
          const sl = pkg.punteggio_label || pkg.score_label;
          if (sl) doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`  ${sl}`);
          else doc.text('');
          doc.moveDown(0.5);
        }
        const reason = pkg.perche_per_te || pkg.reason;
        if (reason) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('PERCHÉ PER TE');
          doc.moveDown(0.2);
          wrapText(reason, { fontSize: 10 });
          doc.moveDown(0.6);
        }
        const good = pkg.cosa_va_bene || pkg.whats_good;
        if (good) {
          const gy = doc.y;
          doc.rect(60, gy, pageW, 0).fillColor('#ecfdf5');
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN).text('COSA HAI FATTO BENE');
          doc.moveDown(0.2);
          wrapText(good, { fontSize: 9, color: '#064e3b' });
          doc.moveDown(0.6);
        }
        const bad = pkg.cosa_non_funziona || pkg.whats_wrong;
        if (bad) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(AMBER).text('COSA NON FUNZIONA');
          doc.moveDown(0.2);
          wrapText(bad, { fontSize: 9, color: '#92400e' });
          doc.moveDown(0.6);
        }
        const fix = pkg.come_correggere || pkg.how_to_fix;
        if (fix && Array.isArray(fix)) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('COME CORREGGERE');
          doc.moveDown(0.3);
          for (const action of fix) {
            doc.font('Helvetica').fontSize(9).fillColor(INDIGO).text('→ ', { continued: true });
            doc.fillColor(DARK).text(action.replace(/^→\s*/, ''));
            doc.moveDown(0.3);
          }
          doc.moveDown(0.3);
        }
        const diag = pkg.diagnosi_critica || pkg.critical_diagnosis;
        if (diag) {
          const dy = doc.y;
          doc.rect(60, dy, 3, 30).fillColor(RED).fill();
          doc.rect(63, dy, pageW - 3, 30).fillColor('#fef2f2').fill();
          doc.font('Helvetica-Bold').fontSize(8).fillColor(RED).text('DIAGNOSI CRITICA', 72, dy + 6);
          doc.font('Helvetica').fontSize(9).fillColor('#7f1d1d').text(diag, 72, dy + 18, { width: pageW - 24 });
          doc.y = dy + 38;
        }
        const mods = pkg.moduli_inclusi || pkg.modules;
        if (mods && Array.isArray(mods) && mods.length > 0) {
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text(`MODULI INCLUSI (${mods.length})`);
          doc.moveDown(0.3);
          for (const mod of mods) {
            const modName = mod.nome || mod.name;
            doc.font('Helvetica').fontSize(9).fillColor(GREEN).text('✓ ', { continued: true });
            doc.fillColor(DARK).text(modName);
            doc.moveDown(0.15);
          }
        }
      });
    }

    const roadmap = raw.roadmap;
    if (roadmap) {
      doc.addPage();
      const rNum = String((pkgs?.length || 0) + 3).padStart(2, '0');
      sectionTitle(rNum, 'Roadmap Operativa');
      const weeks = [
        roadmap.settimana_1 || roadmap.week1,
        roadmap.settimana_2 || roadmap.week2,
        roadmap.settimana_3 || roadmap.week3,
        roadmap.settimana_4 || roadmap.week4,
      ];
      weeks.forEach((w: any, i: number) => {
        if (!w) return;
        if (doc.y > 680) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(11).fillColor(INDIGO).text(`Settimana ${i + 1}`);
        const titolo = w.titolo || w.title;
        if (titolo) doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(titolo);
        doc.moveDown(0.3);
        const azioni = w.azioni_prioritarie || w.azioni || w.actions || [];
        for (const a of azioni) {
          doc.font('Helvetica').fontSize(9).fillColor(DARK).text(`• ${a}`);
          doc.moveDown(0.15);
        }
        const obj = w.obiettivo || w.objective;
        if (obj) {
          doc.moveDown(0.2);
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('Obiettivo: ', { continued: true });
          doc.font('Helvetica').fillColor(DARK).text(obj);
        }
        const kpi = w.kpi_target || w.kpi;
        if (kpi) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('KPI: ', { continued: true });
          doc.font('Helvetica').fillColor(DARK).text(kpi);
        }
        doc.moveDown(0.8);
      });
    }

    const qw = raw.quick_wins;
    if (qw && Array.isArray(qw) && qw.length > 0) {
      if (doc.y > 500) doc.addPage();
      const qNum = String((pkgs?.length || 0) + 4).padStart(2, '0');
      sectionTitle(qNum, 'Quick Wins');
      qw.forEach((q: any, i: number) => {
        if (doc.y > 700) doc.addPage();
        const title = q.titolo || q.title;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text(`${i + 1}. ${title}`);
        const steps = q.passi || q.steps || [];
        for (let s = 0; s < steps.length; s++) {
          doc.font('Helvetica').fontSize(9).fillColor(DARK).text(`   ${s + 1}. ${steps[s]}`);
          doc.moveDown(0.1);
        }
        const tempo = q.tempo_stimato || q.estimated_time;
        if (tempo) doc.font('Helvetica').fontSize(8).fillColor(GRAY).text(`   ⏱ ${tempo}`);
        doc.moveDown(0.6);
      });
    }

    const metrics = raw.metriche_successo || raw.success_metrics;
    if (metrics && Array.isArray(metrics) && metrics.length > 0) {
      if (doc.y > 500) doc.addPage();
      const mNum = String((pkgs?.length || 0) + 5).padStart(2, '0');
      sectionTitle(mNum, 'Metriche di Successo');
      for (const m of metrics) {
        if (doc.y > 720) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text(m.kpi);
        doc.font('Helvetica').fontSize(8).fillColor(GRAY).text(`Target: ${m.valore_target || m.target || ''} | Misura: ${m.come_misurare || m.measurement || ''} | Periodo: ${m.timeframe || ''}`);
        doc.moveDown(0.5);
      }
    }

    const azioni = raw.azioni_questa_settimana || raw.priority_actions;
    if (azioni && Array.isArray(azioni) && azioni.length > 0) {
      doc.addPage();
      const aNum = String((pkgs?.length || 0) + 6).padStart(2, '0');
      sectionTitle(aNum, 'Le Azioni di Questa Settimana');
      azioni.forEach((a: any, i: number) => {
        if (doc.y > 660) doc.addPage();
        const title = a.titolo || a.title || '';
        const desc = a.descrizione || a.description || '';
        const tempo = a.tempo || a.time || '';
        const impatto = a.impatto || a.impact || '';
        doc.font('Helvetica-Bold').fontSize(18).fillColor(INDIGO).text(`${i + 1}`, { continued: true });
        doc.font('Helvetica-Bold').fontSize(12).fillColor(DARK).text(`  ${title}`);
        doc.moveDown(0.3);
        wrapText(desc, { fontSize: 10 });
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(8).fillColor(GRAY).text(`⏱ ${tempo}   📈 ${impatto}`);
        doc.moveDown(1);
      });
    }

    const chiusura = raw.chiusura_personale || raw.closing_message;
    if (chiusura) {
      if (doc.y > 500) doc.addPage();
      doc.moveDown(2);
      doc.moveTo(230, doc.y).lineTo(365, doc.y).strokeColor(GRAY).lineWidth(0.5).stroke();
      doc.moveDown(1);
      const paras = chiusura.split('\n\n');
      for (const p of paras) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(GRAY).text(p, { align: 'center', width: pageW });
        doc.moveDown(0.4);
      }
    }

    addFooter();
    doc.end();

  } catch (err: any) {
    console.error('[DeliveryAgent] PDF generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

const activeSimulators = new Map<string, { running: boolean; turn: number; status: string }>();

router.post('/simulator/run', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  const consultantId = req.user!.id;
  const { sessionId } = req.body;

  if (!sessionId || !isValidUUID(sessionId)) {
    return res.status(400).json({ success: false, error: 'Valid sessionId required' });
  }

  try {
    const sessionRes = await db.execute(sql`
      SELECT * FROM delivery_agent_sessions
      WHERE id = ${sessionId}::uuid AND consultant_id = ${consultantId} AND mode = 'simulator'
    `);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Simulator session not found' });
    }
    const session = sessionRes.rows[0] as any;
    const simulatorData = session.client_profile_json?.simulator;
    if (!simulatorData?.niche || !simulatorData?.attitude) {
      return res.status(400).json({ success: false, error: 'Invalid simulator config' });
    }

    if (activeSimulators.has(sessionId)) {
      return res.status(409).json({ success: false, error: 'Simulation already running' });
    }

    const simState = { running: true, turn: 0, status: 'starting' };
    activeSimulators.set(sessionId, simState);

    res.json({ success: true, message: 'Simulation started' });

    (async () => {
      try {
        const provider = await getAIProvider(consultantId);
        if (provider.setFeature) provider.setFeature('delivery-agent-simulator', 'consultant');
        const { model } = getModelWithThinking(provider.metadata?.providerName);

        const { getDeliveryAgentSystemPrompt, getSimulatedClientPrompt } = await import('../prompts/delivery-agent-prompt');

        const MAX_TURNS = 30;
        let turnNumber = 0;
        let discoveryComplete = false;

        const existingMsgs = await db.execute(sql`
          SELECT role, content FROM delivery_agent_messages
          WHERE session_id = ${sessionId} ORDER BY created_at ASC
        `);
        const history = (existingMsgs.rows as any[]).map(m => ({
          role: m.role === 'assistant' ? 'model' as const : 'user' as const,
          parts: [{ text: m.content }],
        }));
        turnNumber = Math.floor(history.length / 2);

        if (history.length === 0) {
          simState.status = 'Luca sta iniziando la conversazione...';

          const lucaSystemPrompt = getDeliveryAgentSystemPrompt('simulator', 'discovery', session.client_profile_json);

          const lucaGreetingResult = await provider.client.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: 'Ciao' }] }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
            systemInstruction: { role: 'system', parts: [{ text: lucaSystemPrompt }] },
          });

          let lucaGreeting = '';
          try { lucaGreeting = (lucaGreetingResult as any).response.text(); } catch {}
          if (!lucaGreeting) {
            const parts = (lucaGreetingResult as any).response?.candidates?.[0]?.content?.parts || [];
            lucaGreeting = parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join('');
          }
          console.log(`[Simulator] Luca greeting length: ${lucaGreeting.length}`);

          const greetingText = lucaGreeting || 'Ciao! Sono Luca, il tuo consulente. Raccontami un po\' della tua attività — cosa fai e come lavori oggi?';
          await db.execute(sql`
            INSERT INTO delivery_agent_messages (session_id, role, content) VALUES (${sessionId}, 'assistant', ${greetingText})
          `);
          history.push({ role: 'model', parts: [{ text: greetingText }] });
        }

        while (simState.running && turnNumber < MAX_TURNS && !discoveryComplete) {
          turnNumber++;
          simState.turn = turnNumber;
          simState.status = `Turno ${turnNumber} — Il cliente sta rispondendo...`;

          const clientSystemPrompt = getSimulatedClientPrompt(simulatorData.niche, simulatorData.attitude, turnNumber);

          const clientHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
          for (const m of history) {
            const swappedRole = m.role === 'model' ? 'user' : 'model';
            if (clientHistory.length > 0 && clientHistory[clientHistory.length - 1].role === swappedRole) {
              clientHistory[clientHistory.length - 1].parts = [
                ...clientHistory[clientHistory.length - 1].parts,
            ...m.parts,
          ];
        } else {
          clientHistory.push({ role: swappedRole, parts: [...m.parts] });
        }
      }
      if (clientHistory.length === 0 || clientHistory[0].role !== 'user') {
        clientHistory.unshift({ role: 'user', parts: [{ text: 'Ciao, ho sentito parlare di voi e vorrei capire come potete aiutarmi.' }] });
      }

      const clientResult = await provider.client.generateContent({
        model,
        contents: clientHistory,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.8 },
        systemInstruction: { role: 'system', parts: [{ text: clientSystemPrompt }] },
      });

      let clientMsg = '';
      try { clientMsg = (clientResult as any).response.text(); } catch {}
      if (!clientMsg) {
        const parts = (clientResult as any).response?.candidates?.[0]?.content?.parts || [];
        clientMsg = parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join('');
      }
      console.log(`[Simulator] Turn ${turnNumber} client response length: ${clientMsg.length}, preview: "${clientMsg.substring(0, 100)}"`);

      if (!clientMsg.trim()) {
        console.log(`[Simulator] Empty client response at turn ${turnNumber}, stopping`);
        break;
      }

      await db.execute(sql`
        INSERT INTO delivery_agent_messages (session_id, role, content) VALUES (${sessionId}, 'user', ${clientMsg})
      `);
      history.push({ role: 'user', parts: [{ text: clientMsg }] });
      if (!simState.running) break;

      await new Promise(r => setTimeout(r, 1500));

      simState.status = `Turno ${turnNumber} — Luca sta rispondendo...`;

      const lucaSessionRes = await db.execute(sql`
        SELECT status, client_profile_json FROM delivery_agent_sessions WHERE id = ${sessionId}::uuid
      `);
      const freshSession = lucaSessionRes.rows[0] as any;
      const lucaSystemPrompt = getDeliveryAgentSystemPrompt('simulator', freshSession?.status || 'discovery', freshSession?.client_profile_json || session.client_profile_json);

      const lucaContents = [...history];
      if (lucaContents.length > 0 && lucaContents[0].role !== 'user') {
        lucaContents.unshift({ role: 'user', parts: [{ text: 'Ciao' }] });
      }

      const lucaResult = await provider.client.generateContent({
        model,
        contents: lucaContents,
        generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
        systemInstruction: { role: 'system', parts: [{ text: lucaSystemPrompt }] },
      });

      let lucaMsg = '';
      try { lucaMsg = (lucaResult as any).response.text(); } catch {}
      if (!lucaMsg) {
        const parts = (lucaResult as any).response?.candidates?.[0]?.content?.parts || [];
        lucaMsg = parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join('');
      }
      console.log(`[Simulator] Turn ${turnNumber} Luca response length: ${lucaMsg.length}`);

      if (!lucaMsg.trim()) {
        console.log(`[Simulator] Empty Luca response at turn ${turnNumber}, stopping`);
        break;
      }

      await db.execute(sql`
        INSERT INTO delivery_agent_messages (session_id, role, content) VALUES (${sessionId}, 'assistant', ${lucaMsg})
      `);
      history.push({ role: 'model', parts: [{ text: lucaMsg }] });

      if (lucaMsg.includes('[DISCOVERY_COMPLETE]')) {
        discoveryComplete = true;
        const jsonMatch = lucaMsg.match(/```json\s*([\s\S]*?)```/);
        let profileJson = null;
        if (jsonMatch) {
          try { profileJson = JSON.parse(jsonMatch[1]); } catch {}
        }
        await db.execute(sql`
          UPDATE delivery_agent_sessions
          SET status = 'elaborating',
              client_profile_json = COALESCE(${profileJson ? JSON.stringify(profileJson) : null}::jsonb, client_profile_json),
              updated_at = NOW()
          WHERE id = ${sessionId}::uuid
        `);
      }

      await db.execute(sql`
        UPDATE delivery_agent_sessions SET updated_at = NOW() WHERE id = ${sessionId}::uuid
      `);

      if (!simState.running) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`[Simulator] Finished session ${sessionId} after ${turnNumber} turns. Reason: ${discoveryComplete ? 'discovery_complete' : !simState.running ? 'stopped' : 'max_turns'}`);
    activeSimulators.delete(sessionId);
      } catch (err: any) {
        console.error('[DeliveryAgent] Simulator background error:', err);
        activeSimulators.delete(sessionId);
      }
    })();
  } catch (err: any) {
    console.error('[DeliveryAgent] Simulator run error:', err);
    activeSimulators.delete(sessionId);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/simulator/status/:sessionId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  const consultantId = req.user!.id;
  const { sessionId } = req.params;
  if (!sessionId || !isValidUUID(sessionId)) {
    return res.status(400).json({ success: false, error: 'Valid sessionId required' });
  }
  const sim = activeSimulators.get(sessionId);
  res.json({
    success: true,
    running: !!sim?.running,
    turn: sim?.turn || 0,
    status: sim?.status || '',
  });
});

router.post('/simulator/stop', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  const consultantId = req.user!.id;
  const { sessionId } = req.body;
  if (!sessionId || !isValidUUID(sessionId)) {
    return res.status(400).json({ success: false, error: 'Valid sessionId required' });
  }
  const sessionCheck = await db.execute(sql`
    SELECT id FROM delivery_agent_sessions
    WHERE id = ${sessionId}::uuid AND consultant_id = ${consultantId} AND mode = 'simulator'
  `);
  if (sessionCheck.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  const sim = activeSimulators.get(sessionId);
  if (sim) {
    sim.running = false;
    activeSimulators.delete(sessionId);
  }
  res.json({ success: true, stopped: !!sim });
});

router.delete('/sessions/:id', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;
    const sessionRes = await db.execute(sql`
      SELECT id FROM delivery_agent_sessions
      WHERE id = ${id}::uuid AND consultant_id = ${consultantId}
    `);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    await db.execute(sql`DELETE FROM delivery_agent_reports WHERE session_id = ${id}`);
    await db.execute(sql`DELETE FROM delivery_agent_messages WHERE session_id = ${id}`);
    await db.execute(sql`DELETE FROM delivery_agent_sessions WHERE id = ${id}::uuid`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[DeliveryAgent] DELETE session error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
