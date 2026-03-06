import { Router, Response } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getAIProvider, getModelWithThinking, GEMINI_3_MODEL } from '../ai/provider-factory';

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
}

ensureTables().catch(err => console.error('[DeliveryAgent] Init error:', err));

router.post('/sessions', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { mode } = req.body;
    if (!mode || !['onboarding', 'discovery'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'Mode must be onboarding or discovery' });
    }
    const result = await db.execute(sql`
      INSERT INTO delivery_agent_sessions (consultant_id, mode, status)
      VALUES (${consultantId}, ${mode}, 'discovery')
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

    let systemPromptText = '';
    try {
      const { getDeliveryAgentSystemPrompt } = await import('../prompts/delivery-agent-prompt');
      systemPromptText = getDeliveryAgentSystemPrompt(session.mode, session.status, session.client_profile_json);
    } catch {
      systemPromptText = `You are a delivery agent assistant. Mode: ${session.mode}. Status: ${session.status}. Help the consultant with onboarding and discovery.`;
    }

    const provider = await getAIProvider(consultantId);
    if (provider.setFeature) {
      provider.setFeature('delivery-agent', 'consultant');
    }

    const { model, useThinking, thinkingLevel } = getModelWithThinking(provider.metadata?.providerName);

    const generationConfig: any = {
      maxOutputTokens: 12288,
      temperature: 0.7,
    };
    if (useThinking) {
      generationConfig.thinkingConfig = { thinkingBudget: thinkingLevel === 'high' ? 8192 : thinkingLevel === 'medium' ? 4096 : 2048 };
    }

    const stream = await provider.client.generateContentStream({
      model,
      contents,
      generationConfig,
      systemInstruction: { role: 'system', parts: [{ text: systemPromptText }] },
    });

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
      .map(m => `${m.role === 'assistant' ? 'Agente' : 'Consulente'}: ${m.content}`)
      .join('\n\n');

    const profileJson = session.client_profile_json ? JSON.stringify(session.client_profile_json) : 'Non disponibile';

    let reportPrompt = '';
    try {
      const { getReportGenerationPrompt } = await import('../prompts/delivery-agent-prompt');
      reportPrompt = getReportGenerationPrompt();
    } catch {
      reportPrompt = `Generate a structured onboarding report in JSON format with these 6 sections: profilo_cliente, diagnosi, moduli_consigliati, roadmap, quick_wins, metriche_successo.`;
    }

    const provider = await getAIProvider(consultantId);
    if (provider.setFeature) {
      provider.setFeature('delivery-agent-report', 'consultant');
    }

    const { model } = getModelWithThinking(provider.metadata?.providerName);

    const result = await provider.client.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{
            text: `Profilo Cliente Estratto:\n${profileJson}\n\nConversazione Completa:\n${conversationText}\n\nGenera il report strutturato.`,
          }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 16384,
        temperature: 0.5,
      },
      systemInstruction: { role: 'system', parts: [{ text: reportPrompt }] },
    });

    const responseText = result.response.text();
    let reportJson: any = null;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try { reportJson = JSON.parse(jsonMatch[1]); } catch { /* ignore */ }
    }
    if (!reportJson) {
      try { reportJson = JSON.parse(responseText); } catch {
        reportJson = { raw_text: responseText };
      }
    }

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
