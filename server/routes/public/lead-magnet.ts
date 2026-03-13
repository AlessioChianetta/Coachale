import { Router, Response, Request } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { getAIProvider, getModelWithThinking } from '../../ai/provider-factory';
import { searchGoogleMaps, scrapeWebsiteWithFirecrawl } from '../../services/lead-scraper-service';
import { decrypt } from '../../encryption';
import { superadminLeadScraperConfig } from '../../../shared/schema';
import { ensureProactiveLead } from '../../utils/ensure-proactive-lead';
import { randomUUID } from 'crypto';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../../services/email-scheduler';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'your-secret-key';

const router = Router();

(async () => {
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_lead_magnet BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE delivery_agent_sessions ADD COLUMN IF NOT EXISTS lead_user_id VARCHAR`);
    console.log('[LeadMagnet] DB columns ensured');
  } catch (e) {
    console.error('[LeadMagnet] DB migration error:', e);
  }
})();

const FALLBACK_CONSULTANT_ID = '0c73bbe5-51e1-4108-866b-6be7a52fce3b';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveConsultantId(consultantIdOrSlug?: string): Promise<string> {
  if (consultantIdOrSlug && consultantIdOrSlug.trim()) {
    const val = consultantIdOrSlug.trim();
    if (UUID_REGEX.test(val)) {
      const res = await db.execute(sql`SELECT id FROM users WHERE id = ${val} AND role IN ('consultant', 'super_admin') LIMIT 1`);
      if (res.rows.length > 0) return val;
    } else {
      const res = await db.execute(sql`SELECT id FROM users WHERE slug = ${val.toLowerCase()} AND role IN ('consultant', 'super_admin') LIMIT 1`);
      if (res.rows.length > 0) return (res.rows[0] as any).id;
    }
  }
  return FALLBACK_CONSULTANT_ID;
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_START = 5;
const RATE_LIMIT_MAX_CHAT = 30;
const RATE_LIMIT_MAX_REPORT = 3;

function checkRateLimit(key: string, max: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

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
    console.error("[LeadMagnet] Error reading lead scraper keys:", e);
  }
  return {
    serpApiKey: process.env.SERPAPI_KEY || null,
    firecrawlKey: process.env.FIRECRAWL_API_KEY || null,
  };
}

router.post('/start', async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`start:${clientIp}`, RATE_LIMIT_MAX_START)) {
      return res.status(429).json({ success: false, error: 'Troppe richieste. Riprova tra un minuto.' });
    }

    const { name, email, phone, password, consultantId: reqConsultantId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Nome è obbligatorio' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email è obbligatoria' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Telefono è obbligatorio' });
    }
    if (!password || password.trim().length < 6) {
      return res.status(400).json({ success: false, error: 'La password deve avere almeno 6 caratteri' });
    }

    const consultantId = await resolveConsultantId(reqConsultantId);

    const normalizedEmail = email.trim().toLowerCase();

    const existingSession = await db.execute(sql`
      SELECT id, public_token FROM delivery_agent_sessions
      WHERE consultant_id = ${consultantId}
        AND LOWER(TRIM(lead_email)) = ${normalizedEmail}
        AND mode = 'onboarding'
        AND is_public = true
      ORDER BY created_at DESC
      LIMIT 1
    `);

    let sessionId: string;
    let publicToken: string;

    if (existingSession.rows.length > 0) {
      sessionId = (existingSession.rows[0] as any).id;
      publicToken = (existingSession.rows[0] as any).public_token;
      await db.execute(sql`
        UPDATE delivery_agent_sessions
        SET lead_name = ${name.trim()}, lead_phone = ${phone.trim()}, updated_at = NOW()
        WHERE id = ${sessionId}
      `);
    } else {
      publicToken = randomUUID();
      const sessionRes = await db.execute(sql`
        INSERT INTO delivery_agent_sessions (
          consultant_id, mode, status, is_public, public_token,
          lead_name, lead_email, lead_phone
        ) VALUES (
          ${consultantId}, 'onboarding', 'discovery', true, ${publicToken},
          ${name.trim()}, ${normalizedEmail}, ${phone.trim()}
        )
        RETURNING id
      `);
      sessionId = (sessionRes.rows[0] as any).id;
    }

    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    await ensureProactiveLead({
      consultantId,
      phoneNumber: phone.trim(),
      contactName: name.trim(),
      email: email.trim(),
      source: 'lead_magnet',
      status: 'pending',
      leadInfo: {
        fonte: 'Lead Magnet — Onboarding Gratuito',
        obiettivi: 'Analisi gratuita AI per il business',
        lead_magnet_session_id: sessionId,
      },
      consultantNotes: `Lead da Onboarding Gratuito. Nome: ${name.trim()}. Email: ${email.trim()}.`,
    });

    let userId: string | null = null;
    let username: string = '';
    let isNewUser = false;
    let authToken: string | null = null;
    let userObject: any = null;

    const emailLower = email.trim().toLowerCase();
    const existingUserRes = await db.execute(sql`
      SELECT id, username, password, is_lead_magnet FROM users WHERE LOWER(email) = ${emailLower} LIMIT 1
    `);

    if (existingUserRes.rows.length > 0) {
      const existingUser = existingUserRes.rows[0] as any;
      if (existingUser.is_lead_magnet === true) {
        const passwordMatch = await bcrypt.compare(password.trim(), existingUser.password);
        if (!passwordMatch) {
          return res.status(401).json({ success: false, error: 'Password non corretta per questo account. Se hai dimenticato la password, accedi dalla pagina di login.' });
        }

        userId = existingUser.id;
        username = existingUser.username;

        await db.execute(sql`
          UPDATE delivery_agent_sessions SET lead_user_id = ${userId} WHERE id = ${sessionId}
        `);

        const tokenPayload: any = { userId, profileId: null, type: 'lead_magnet', consultantId, email: emailLower };
        authToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
        userObject = {
          id: userId, username, email: emailLower, firstName, lastName,
          role: 'client', tier: 'lead_magnet', isActive: true, consultantId,
        };
      } else {
        await db.execute(sql`
          UPDATE delivery_agent_sessions SET lead_user_id = ${existingUser.id} WHERE id = ${sessionId}
        `);
        console.log(`[LeadMagnet] Email ${emailLower} exists as non-lead user — session linked, no auto-login`);
      }
    } else {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      const emailPrefix = emailLower.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().substring(0, 15);
      const randomSuffix = crypto.randomBytes(2).toString('hex');
      username = `lm_${emailPrefix}_${randomSuffix}`;

      const newUserRes = await db.execute(sql`
        INSERT INTO users (username, email, password, first_name, last_name, role, consultant_id, is_active, is_lead_magnet)
        VALUES (${username}, ${emailLower}, ${hashedPassword}, ${firstName}, ${lastName}, 'client', ${consultantId}, true, true)
        RETURNING id
      `);
      userId = (newUserRes.rows[0] as any).id;
      isNewUser = true;

      await db.execute(sql`
        UPDATE delivery_agent_sessions SET lead_user_id = ${userId} WHERE id = ${sessionId}
      `);

      const tokenPayload: any = { userId, profileId: null, type: 'lead_magnet', consultantId, email: emailLower };
      authToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
      userObject = {
        id: userId, username, email: emailLower, firstName, lastName,
        role: 'client', tier: 'lead_magnet', isActive: true, consultantId,
      };

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      try {
        await sendEmail({
          to: emailLower,
          subject: `Ciao ${firstName} — La tua Analisi AI è pronta`,
          consultantId,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 40px 32px; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #06b6d4); display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; color: #fff;">SO</div>
                <h2 style="margin: 16px 0 0; font-size: 22px; font-weight: 700;">Sistema Orbitale</h2>
              </div>
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Ciao <strong>${firstName}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px;">Abbiamo creato il tuo accesso alla piattaforma. Per accedere in futuro usa le credenziali che hai scelto durante la registrazione:</p>
              <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                <p style="margin: 0 0 8px; font-size: 14px; color: #94a3b8;">Email</p>
                <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600;">${emailLower}</p>
                <p style="margin: 0 0 8px; font-size: 14px; color: #94a3b8;">Password</p>
                <p style="margin: 0; font-size: 14px; color: #94a3b8;">Quella che hai scelto durante la registrazione</p>
              </div>
              <div style="text-align: center; margin: 0 0 24px;">
                <a href="${baseUrl}/login" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #10b981, #06b6d4); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Accedi alla Piattaforma</a>
              </div>
              <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">Se sei già connesso, trovi la tua analisi direttamente nella piattaforma. In caso di disconnessione, usa questi dati per rientrare.</p>
            </div>
          `,
        });
        console.log(`[LeadMagnet] Welcome email sent to ${emailLower}`);
      } catch (emailErr) {
        console.error('[LeadMagnet] Failed to send welcome email:', emailErr);
      }
    }

    console.log(`[LeadMagnet] New session ${sessionId} for ${name.trim()} (${email.trim()}, ${phone.trim()}) userId=${userId || 'existing-non-lead'}`);

    const responseData: any = { token: publicToken, sessionId };
    if (authToken && userObject) {
      responseData.authToken = authToken;
      responseData.user = userObject;
    }
    res.json({ success: true, data: responseData });
  } catch (err: any) {
    console.error('[LeadMagnet] Start error:', err);
    res.status(500).json({ success: false, error: 'Errore durante la registrazione. Riprova.' });
  }
});

router.get('/:token/session', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!UUID_REGEX.test(token)) {
      return res.status(400).json({ success: false, error: 'Token non valido' });
    }

    const sessionRes = await db.execute(sql`
      SELECT * FROM delivery_agent_sessions
      WHERE public_token = ${token} AND is_public = true
    `);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    }
    const session = sessionRes.rows[0] as any;

    const messagesRes = await db.execute(sql`
      SELECT id, role, content, created_at FROM delivery_agent_messages
      WHERE session_id = ${session.id}
      ORDER BY created_at ASC
    `);

    const reportRes = await db.execute(sql`
      SELECT report_json, created_at FROM delivery_agent_reports
      WHERE session_id = ${session.id}
      LIMIT 1
    `);

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          leadName: session.lead_name,
          mode: session.mode,
        },
        messages: messagesRes.rows,
        report: reportRes.rows[0] || null,
      },
    });
  } catch (err: any) {
    console.error('[LeadMagnet] Get session error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:token/chat', async (req: Request, res: Response) => {
  const { token } = req.params;
  const { message } = req.body;

  if (!UUID_REGEX.test(token)) {
    return res.status(400).json({ success: false, error: 'Token non valido' });
  }
  if (!checkRateLimit(`chat:${token}`, RATE_LIMIT_MAX_CHAT)) {
    return res.status(429).json({ success: false, error: 'Troppe richieste. Riprova tra un minuto.' });
  }
  if (!message) {
    return res.status(400).json({ success: false, error: 'Messaggio richiesto' });
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
      WHERE public_token = ${token} AND is_public = true
    `);
    if (sessionRes.rows.length === 0) {
      sendSSE('error', { error: 'Sessione non trovata' });
      res.end();
      return;
    }
    const session = sessionRes.rows[0] as any;
    const sessionId = session.id;

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
      const { getPublicOnboardingPrompt } = await import('../../prompts/delivery-agent-prompt');
      systemPromptText = getPublicOnboardingPrompt(session.lead_name || 'Visitatore');
    } catch {
      systemPromptText = `Sei Luca, un consulente AI esperto. Aiuta il visitatore a capire come l'intelligenza artificiale può migliorare il suo business. Fai domande sul suo lavoro e i suoi processi.`;
    }

    const provider = await getAIProvider(session.consultant_id || FALLBACK_CONSULTANT_ID);
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
    console.error('[LeadMagnet] Chat error:', err);
    sendSSE('error', { error: err.message || 'Errore durante la conversazione' });
    res.end();
  }
});

router.post('/:token/generate-report', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!UUID_REGEX.test(token)) {
      return res.status(400).json({ success: false, error: 'Token non valido' });
    }
    if (!checkRateLimit(`report:${token}`, RATE_LIMIT_MAX_REPORT)) {
      return res.status(429).json({ success: false, error: 'Report già in generazione. Riprova tra un minuto.' });
    }

    const sessionRes = await db.execute(sql`
      SELECT * FROM delivery_agent_sessions
      WHERE public_token = ${token} AND is_public = true
    `);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    }
    const session = sessionRes.rows[0] as any;
    const sessionId = session.id;

    const messagesRes = await db.execute(sql`
      SELECT role, content FROM delivery_agent_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `);

    const conversationText = (messagesRes.rows as any[])
      .map(m => `${m.role === 'assistant' ? 'Luca' : 'Prospect'}: ${m.content}`)
      .join('\n\n');

    const profileJson = session.client_profile_json ? JSON.stringify(session.client_profile_json, null, 2) : 'Non disponibile';
    const clientProfile = session.client_profile_json || {};

    let businessIntelligence: any = null;
    try {
      const nomeAttivita = clientProfile.nome_attivita || null;
      const sitoWeb = clientProfile.sito_web || null;
      const citta = clientProfile.citta_operativa || null;

      if (nomeAttivita || sitoWeb) {
        console.log(`[LeadMagnet] Business Intelligence: scraping for "${nomeAttivita}" in "${citta}", website: ${sitoWeb}`);
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
            }
          } catch (mapErr: any) {
            console.warn(`[LeadMagnet] Google Maps scraping failed: ${mapErr.message}`);
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
          } catch (scrapeErr: any) {
            console.warn(`[LeadMagnet] Website scraping failed: ${scrapeErr.message}`);
          }
        }
      }
    } catch (biErr: any) {
      console.warn(`[LeadMagnet] Business Intelligence failed: ${biErr.message}`);
      businessIntelligence = null;
    }

    let reportPrompt = '';
    try {
      const { getReportGenerationPrompt } = await import('../../prompts/delivery-agent-prompt');
      reportPrompt = getReportGenerationPrompt(businessIntelligence);
    } catch {
      reportPrompt = `Generate a structured onboarding report in JSON format.`;
    }

    const provider = await getAIProvider(session.consultant_id || FALLBACK_CONSULTANT_ID);
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

    console.log(`[LeadMagnet] Report generation START — session: ${sessionId}`);

    let analysisText = '';
    try {
      const step1Contents = [
        ...multiTurnContents,
        {
          role: 'user',
          parts: [{
            text: `La discovery è conclusa. Profilo Estratto:\n${profileJson}\n\n${businessIntelligence ? `BUSINESS INTELLIGENCE:\n${JSON.stringify(businessIntelligence, null, 2)}\n\n` : ''}COMPITO: Analizza questa conversazione. NON generare ancora il report. Fai un'analisi critica:

1. **Pattern chiave emersi**: I 3-5 pattern più importanti
2. **Contraddizioni o lacune**: Cose che non tornano
3. **Urgenza reale vs percepita**: Bisogno reale vs dichiarato
4. **Pacchetti candidati**: Quali servizi AI sono rilevanti
5. **Rischi e dipendenze**: Prerequisiti tecnici
6. **Ordine di priorità**: Top 2 soluzioni AI per i prossimi 30 giorni

Ragiona in modo strutturato e critico.`,
          }],
        },
      ];

      const analysisResult = await provider.client.generateContent({
        model,
        contents: step1Contents,
        generationConfig: { maxOutputTokens: 8192, temperature: 0.6, ...thinkingConfig },
        systemInstruction: { role: 'system', parts: [{ text: reportPrompt }] },
      });

      analysisText = analysisResult.response.text();
      console.log(`[LeadMagnet] STEP 1 DONE — Analysis: ${analysisText.length} chars`);
    } catch (step1Err: any) {
      console.error('[LeadMagnet] STEP 1 FAILED:', step1Err.message);
      analysisText = 'Analisi non disponibile.';
    }

    let reportJson: any = null;
    let draftText = '';
    try {
      const draftResult = await provider.client.generateContent({
        model,
        contents: [
          { role: 'user', parts: [{ text: `Profilo Cliente:\n${profileJson}\n\nConversazione:\n${conversationText}` }] },
          { role: 'model', parts: [{ text: `Analisi:\n\n${analysisText}` }] },
          {
            role: 'user',
            parts: [{
              text: `Genera il report JSON strutturato completo. Includi SOLO i pacchetti rilevanti (4-7). Ogni "perche_per_te" deve citare cose specifiche dalla conversazione. Rispondi SOLO con il JSON.`,
            }],
          },
        ],
        generationConfig: { maxOutputTokens: 32768, temperature: 0.4, ...thinkingConfig },
        systemInstruction: { role: 'system', parts: [{ text: reportPrompt }] },
      });

      draftText = draftResult.response.text();
      console.log(`[LeadMagnet] STEP 2 DONE — Draft: ${draftText.length} chars`);

      const draftMatch = draftText.match(/```json\s*([\s\S]*?)```/);
      if (draftMatch) {
        try { reportJson = JSON.parse(draftMatch[1]); } catch { /* continue */ }
      }
      if (!reportJson) {
        try { reportJson = JSON.parse(draftText); } catch { /* continue */ }
      }
    } catch (step2Err: any) {
      console.error('[LeadMagnet] STEP 2 FAILED:', step2Err.message);
      throw new Error(`Report generation failed: ${step2Err.message}`);
    }

    if (!reportJson) {
      reportJson = { raw_text: draftText };
    }

    console.log(`[LeadMagnet] Report COMPLETE — ${reportJson?.pacchetti_consigliati?.length || 0} packages`);

    await db.execute(sql`
      INSERT INTO delivery_agent_reports (session_id, consultant_id, report_json)
      VALUES (${sessionId}, ${session.consultant_id || FALLBACK_CONSULTANT_ID}, ${JSON.stringify(reportJson)}::jsonb)
    `);

    await db.execute(sql`
      UPDATE delivery_agent_sessions
      SET status = 'assistant', updated_at = NOW()
      WHERE id = ${sessionId}::uuid
    `);

    try {
      const enrichedNotes = `Lead da Onboarding Gratuito (report completato). Business: ${clientProfile.tipo_business || 'N/A'} — ${clientProfile.settore || 'N/A'}. Pacchetti consigliati: ${(reportJson.pacchetti_consigliati || []).map((p: any) => p.nome || p.titolo).filter(Boolean).join(', ') || 'N/A'}.`;
      const enrichedInfo: Record<string, any> = {
        fonte: 'Lead Magnet — Onboarding Gratuito (report completato)',
        obiettivi: clientProfile.obiettivi?.priorita_numero_uno || 'Analisi AI completata',
        lead_magnet_session_id: sessionId,
        tipo_business: clientProfile.tipo_business || null,
        settore: clientProfile.settore || null,
        pain_points: clientProfile.pain_points || [],
        pacchetti_consigliati: (reportJson.pacchetti_consigliati || []).map((p: any) => p.nome || p.titolo).filter(Boolean),
      };

      let normalizedPhone = (session.lead_phone || '').replace(/[\s\-()]/g, '');
      if (!normalizedPhone.startsWith('+') && normalizedPhone.length >= 9) {
        normalizedPhone = '+39' + normalizedPhone;
      }

      if (normalizedPhone) {
        await db.execute(sql`
          UPDATE proactive_leads
          SET lead_info = ${JSON.stringify(enrichedInfo)}::jsonb,
              consultant_notes = ${enrichedNotes},
              lead_category = 'tiepido',
              updated_at = NOW()
          WHERE consultant_id = ${session.consultant_id || FALLBACK_CONSULTANT_ID}
            AND phone_number = ${normalizedPhone}
        `);
        console.log(`[LeadMagnet] Enriched proactive lead for ${normalizedPhone}`);
      }
    } catch (enrichErr: any) {
      console.warn(`[LeadMagnet] Lead enrichment failed (non-blocking):`, enrichErr.message);
    }

    (async () => {
      try {
        const consultantIdForFunnel = session.consultant_id || FALLBACK_CONSULTANT_ID;
        console.log(`[LeadMagnet] Auto-triggering funnel generation for session ${session.id}...`);
        const { generateFunnelFromReport } = await import('../funnel-router');
        await generateFunnelFromReport(consultantIdForFunnel, session.id);
        console.log(`[LeadMagnet] Funnel auto-generated for session ${session.id}`);
      } catch (funnelErr: any) {
        console.warn(`[LeadMagnet] Auto funnel generation failed (non-blocking): ${funnelErr.message}`);
      }
    })();

    res.json({ success: true, data: { report: reportJson, status: 'assistant' } });
  } catch (err: any) {
    console.error('[LeadMagnet] Report generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:token/funnel', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ success: false, error: 'Token richiesto' });

    const sessionRes = await db.execute(sql`
      SELECT id, consultant_id FROM delivery_agent_sessions
      WHERE public_token = ${token} AND is_public = true
      LIMIT 1
    `);
    if (sessionRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    const session = sessionRes.rows[0] as any;

    const funnelConsultantId = session.consultant_id || FALLBACK_CONSULTANT_ID;
    const funnelRes = await db.execute(sql`
      SELECT id, name, description, nodes_data, edges_data, theme, lead_name, created_at
      FROM consultant_funnels
      WHERE delivery_session_id = ${session.id} AND consultant_id = ${funnelConsultantId}
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (funnelRes.rows.length === 0) {
      return res.json({ success: true, data: null, message: 'Funnel non ancora generato' });
    }

    const funnel = funnelRes.rows[0] as any;
    res.json({
      success: true,
      data: {
        id: funnel.id,
        name: funnel.name,
        description: funnel.description,
        nodes: funnel.nodes_data,
        edges: funnel.edges_data,
        theme: funnel.theme,
        leadName: funnel.lead_name,
        createdAt: funnel.created_at,
      }
    });
  } catch (err: any) {
    console.error('[LeadMagnet] Funnel fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
