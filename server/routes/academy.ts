import { Router, Response } from 'express';
import { authenticateToken, requireRole, requireSuperAdmin, type AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

async function ensureTables() {
  const statements = [
    sql`CREATE TABLE IF NOT EXISTS consultant_academy_completions (
      id SERIAL PRIMARY KEY,
      consultant_id VARCHAR NOT NULL,
      step_id VARCHAR NOT NULL,
      completed_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(consultant_id, step_id)
    )`,
    sql`CREATE TABLE IF NOT EXISTS academy_modules (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR NOT NULL UNIQUE,
      title VARCHAR NOT NULL,
      emoji VARCHAR NOT NULL DEFAULT '📖',
      tagline VARCHAR NOT NULL DEFAULT '',
      color VARCHAR NOT NULL DEFAULT 'slate',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS academy_lessons (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_id VARCHAR NOT NULL UNIQUE,
      module_id VARCHAR NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
      title VARCHAR NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      duration VARCHAR NOT NULL DEFAULT '5 min',
      video_url TEXT,
      video_type VARCHAR DEFAULT 'iframe',
      config_link VARCHAR NOT NULL DEFAULT '/',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS academy_lesson_documents (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_id VARCHAR NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
      title VARCHAR NOT NULL,
      file_url TEXT NOT NULL,
      file_type VARCHAR NOT NULL DEFAULT 'link',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  ];
  for (const stmt of statements) {
    try { await db.execute(stmt); } catch (e: any) {
      if (!e.message?.includes('already exists')) console.warn('[Academy] Table warn:', e.message);
    }
  }
}

async function seedIfEmpty() {
  try {
    const check = await db.execute(sql`SELECT COUNT(*) as cnt FROM academy_modules`);
    const count = Number((check.rows[0] as any).cnt);
    if (count > 0) return;

    console.log('[Academy] Seeding initial data...');

    const modules = [
      { slug: 'setup_base', title: 'Setup Base', emoji: '⚙️', tagline: 'Configura le fondamenta della piattaforma', color: 'slate', sort_order: 0 },
      { slug: 'acquisisci_lead', title: 'Acquisisci Lead', emoji: '🎯', tagline: 'Attira e qualifica i tuoi potenziali clienti', color: 'blue', sort_order: 1 },
      { slug: 'vendi_converti', title: 'Vendi & Converti', emoji: '💰', tagline: 'Trasforma i lead in clienti paganti', color: 'violet', sort_order: 2 },
      { slug: 'automazioni_ai', title: 'Automazioni AI', emoji: '🤖', tagline: 'La piattaforma lavora per te 24/7', color: 'indigo', sort_order: 3 },
      { slug: 'contenuti_corsi', title: 'Contenuti & Corsi', emoji: '📚', tagline: 'Educa i clienti e posizionati come esperto', color: 'amber', sort_order: 4 },
      { slug: 'avanzato', title: 'Avanzato', emoji: '🚀', tagline: 'Funzionalità premium per massimizzare i risultati', color: 'rose', sort_order: 5 },
    ];

    for (const m of modules) {
      await db.execute(sql`
        INSERT INTO academy_modules (id, slug, title, emoji, tagline, color, sort_order)
        VALUES (gen_random_uuid(), ${m.slug}, ${m.title}, ${m.emoji}, ${m.tagline}, ${m.color}, ${m.sort_order})
        ON CONFLICT (slug) DO NOTHING
      `);
    }

    const moduleRows = await db.execute(sql`SELECT id, slug FROM academy_modules`);
    const moduleMap: Record<string, string> = {};
    for (const r of moduleRows.rows as any[]) {
      moduleMap[r.slug] = r.id;
    }

    const lessons = [
      { lesson_id: 'vertex_ai', module: 'setup_base', title: 'AI Backend (Vertex AI)', description: 'Collega Google Vertex AI per abilitare tutte le funzioni di intelligenza artificiale: agenti, email, idee e molto altro.', duration: '8 min', config_link: '/consultant/api-keys-unified', sort_order: 0 },
      { lesson_id: 'twilio', module: 'setup_base', title: 'Twilio + WhatsApp Business', description: 'Collega il tuo numero WhatsApp Business tramite Twilio per ricevere e inviare messaggi automatici ai tuoi lead e clienti.', duration: '10 min', config_link: '/consultant/api-keys-unified?tab=twilio', sort_order: 1 },
      { lesson_id: 'smtp', module: 'setup_base', title: 'Email SMTP', description: 'Configura il server SMTP per inviare email transazionali, riepilogative e di nurturing direttamente dalla piattaforma.', duration: '6 min', config_link: '/consultant/smtp-settings', sort_order: 2 },
      { lesson_id: 'google_calendar', module: 'setup_base', title: 'Google Calendar', description: 'Collega il tuo calendario Google per sincronizzare automaticamente gli appuntamenti con i clienti e abilitare il booking AI.', duration: '5 min', config_link: '/consultant/calendar', sort_order: 3 },
      { lesson_id: 'lead_import', module: 'acquisisci_lead', title: 'Import Lead da API Esterne', description: 'Configura le API per importare automaticamente lead da CRM, form o altre fonti esterne nel tuo database.', duration: '8 min', config_link: '/consultant/api-keys-unified?tab=lead-import', sort_order: 0 },
      { lesson_id: 'agent_inbound', module: 'acquisisci_lead', title: 'Agente Inbound', description: 'Crea un agente AI che risponde automaticamente ai lead in entrata su WhatsApp, qualificandoli prima della consulenza.', duration: '12 min', config_link: '/consultant/whatsapp', sort_order: 1 },
      { lesson_id: 'whatsapp_template', module: 'acquisisci_lead', title: 'Template WhatsApp Approvato', description: 'Crea e fatti approvare almeno un template da Twilio per inviare messaggi proattivi ai tuoi lead.', duration: '10 min', config_link: '/consultant/whatsapp-templates', sort_order: 2 },
      { lesson_id: 'agent_public_link', module: 'acquisisci_lead', title: 'Link Pubblico Agente', description: 'Genera un link pubblico per permettere ai clienti di iniziare una conversazione con il tuo agente AI via WhatsApp.', duration: '5 min', config_link: '/consultant/whatsapp-agents-chat', sort_order: 3 },
      { lesson_id: 'instagram', module: 'acquisisci_lead', title: 'Instagram Direct Messaging', description: 'Collega il tuo account Instagram Business per gestire automaticamente i messaggi diretti con AI.', duration: '8 min', config_link: '/consultant/api-keys-unified?tab=instagram', sort_order: 4 },
      { lesson_id: 'whatsapp_ai', module: 'acquisisci_lead', title: 'WhatsApp AI Personale', description: 'Configura le chiavi Gemini per abilitare le risposte AI personalizzate sui tuoi agenti WhatsApp.', duration: '6 min', config_link: '/consultant/api-keys-unified', sort_order: 5 },
      { lesson_id: 'stripe_connect', module: 'vendi_converti', title: 'Stripe — Pagamenti', description: 'Collega Stripe per gestire pagamenti, abbonamenti e incassi automatici direttamente dalla piattaforma.', duration: '8 min', config_link: '/consultant/whatsapp?tab=licenses', sort_order: 0 },
      { lesson_id: 'agent_outbound', module: 'vendi_converti', title: 'Agente Outbound', description: "Crea un agente AI per le campagne di contatto proattivo verso i lead: l'agente scrive lui, tu chiudi.", duration: '12 min', config_link: '/consultant/whatsapp', sort_order: 1 },
      { lesson_id: 'agent_consultative', module: 'vendi_converti', title: 'Agente Consulenziale', description: 'Crea un agente specializzato per supporto avanzato, rispondendo a domande complesse con la knowledge base.', duration: '10 min', config_link: '/consultant/whatsapp', sort_order: 2 },
      { lesson_id: 'first_campaign', module: 'vendi_converti', title: 'Prima Campagna Marketing', description: 'Lancia la tua prima campagna WhatsApp per contattare i lead automaticamente con messaggi personalizzati AI.', duration: '15 min', config_link: '/consultant/campaigns', sort_order: 3 },
      { lesson_id: 'summary_email', module: 'vendi_converti', title: 'Email Riassuntiva Post-Consulenza', description: "Invia la tua prima email riassuntiva dopo una consulenza: l'AI genera automaticamente il recap per il cliente.", duration: '5 min', config_link: '/consultant/appointments', sort_order: 4 },
      { lesson_id: 'ai_autonomo', module: 'automazioni_ai', title: 'AI Autonomo', description: "Attiva il sistema AI autonomo: l'AI pianifica e completa task automaticamente ogni giorno senza intervento manuale.", duration: '10 min', config_link: '/consultant/ai-autonomy', sort_order: 0 },
      { lesson_id: 'email_journey', module: 'automazioni_ai', title: 'Email Journey', description: "Configura l'automazione email post-consulenza: bozze o invio automatico con template personalizzati dall'AI.", duration: '10 min', config_link: '/consultant/ai-config?tab=ai-email', sort_order: 1 },
      { lesson_id: 'nurturing_emails', module: 'automazioni_ai', title: 'Email Nurturing 365', description: "Genera 365 email automatiche per nutrire i tuoi lead nel tempo e mantenerli coinvolti fino alla decisione d'acquisto.", duration: '12 min', config_link: '/consultant/ai-config?tab=lead-nurturing', sort_order: 2 },
      { lesson_id: 'email_hub', module: 'automazioni_ai', title: 'Email Hub', description: 'Collega il tuo account email per gestire inbox, invii automatici e risposte AI direttamente dalla piattaforma.', duration: '10 min', config_link: '/consultant/email-hub', sort_order: 3 },
      { lesson_id: 'voice_calls', module: 'automazioni_ai', title: 'Chiamate Voice (Alessia AI)', description: "Completa una chiamata vocale AI con Alessia: l'agente chiama i lead, qualifica e prenota appuntamenti in autonomia.", duration: '8 min', config_link: '/consultant/voice-calls', sort_order: 4 },
      { lesson_id: 'google_calendar_agents', module: 'automazioni_ai', title: 'Calendario Agenti AI', description: 'Collega Google Calendar ai tuoi agenti per permettere loro di prenotare appuntamenti in autonomia durante le conversazioni.', duration: '8 min', config_link: '/consultant/whatsapp', sort_order: 5 },
      { lesson_id: 'knowledge_base', module: 'contenuti_corsi', title: 'Base di Conoscenza', description: "Carica i tuoi documenti (PDF, Word, testo) per alimentare l'AI con informazioni specifiche del tuo business.", duration: '10 min', config_link: '/consultant/knowledge-documents', sort_order: 0 },
      { lesson_id: 'first_course', module: 'contenuti_corsi', title: 'Primo Corso', description: 'Crea il tuo primo corso formativo per i clienti: struttura lezioni, aggiungi materiali e assegna ai clienti.', duration: '15 min', config_link: '/consultant/university', sort_order: 1 },
      { lesson_id: 'first_exercise', module: 'contenuti_corsi', title: 'Primo Esercizio', description: 'Crea il tuo primo esercizio pratico: assegnalo ai clienti e monitora lo svolgimento con feedback AI.', duration: '10 min', config_link: '/consultant/exercises', sort_order: 2 },
      { lesson_id: 'agent_ideas', module: 'contenuti_corsi', title: 'Idee AI per gli Agenti', description: "Usa l'AI per generare idee creative su come personalizzare i tuoi agenti e migliorare le conversioni.", duration: '8 min', config_link: '/consultant/whatsapp?tab=ideas', sort_order: 3 },
      { lesson_id: 'more_templates', module: 'contenuti_corsi', title: 'Libreria Template WhatsApp', description: 'Espandi la tua libreria di template WhatsApp per coprire tutti gli scenari di comunicazione automatica.', duration: '8 min', config_link: '/consultant/whatsapp-templates', sort_order: 4 },
      { lesson_id: 'turn_config', module: 'avanzato', title: 'Video Meeting (TURN Server)', description: 'Configura Metered.ca per videochiamate WebRTC affidabili e sicure con i tuoi clienti, senza dipendenze esterne.', duration: '8 min', config_link: '/consultant/api-keys-unified?tab=video-meeting', sort_order: 0 },
    ];

    for (const l of lessons) {
      const modId = moduleMap[l.module];
      if (!modId) continue;
      await db.execute(sql`
        INSERT INTO academy_lessons (id, lesson_id, module_id, title, description, duration, config_link, sort_order)
        VALUES (gen_random_uuid(), ${l.lesson_id}, ${modId}, ${l.title}, ${l.description}, ${l.duration}, ${l.config_link}, ${l.sort_order})
        ON CONFLICT (lesson_id) DO NOTHING
      `);
    }

    console.log('[Academy] Seed complete: 6 modules, 27 lessons');
  } catch (err) {
    console.error('[Academy] Seed error:', err);
  }
}

ensureTables().then(() => seedIfEmpty()).catch(err => console.error('[Academy] Init error:', err));

// ─── PUBLIC: Get all modules + lessons + documents (for consultant frontend) ───

router.get('/modules', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const modulesRes = await db.execute(sql`
      SELECT * FROM academy_modules ORDER BY sort_order ASC
    `);
    const lessonsRes = await db.execute(sql`
      SELECT * FROM academy_lessons ORDER BY sort_order ASC
    `);
    const docsRes = await db.execute(sql`
      SELECT * FROM academy_lesson_documents ORDER BY sort_order ASC
    `);

    const docs = docsRes.rows as any[];
    const lessons = (lessonsRes.rows as any[]).map(l => ({
      ...l,
      documents: docs.filter(d => d.lesson_id === l.id),
    }));

    const modules = (modulesRes.rows as any[]).map(m => ({
      ...m,
      lessons: lessons.filter(l => l.module_id === m.id),
    }));

    res.json({ success: true, data: modules });
  } catch (err: any) {
    console.error('[Academy] GET modules error:', err);
    res.status(500).json({ success: false, error: 'Errore nel recupero moduli' });
  }
});

// ─── PUBLIC: Get lesson count ───

router.get('/count', async (_req, res: Response) => {
  try {
    const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM academy_lessons`);
    const count = Number((result.rows[0] as any).cnt);
    res.json({ success: true, count });
  } catch (err: any) {
    res.json({ success: true, count: 27 });
  }
});

// ─── CONSULTANT: Completions ───

router.get('/completions', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const rows = await db.execute(sql`
      SELECT step_id FROM consultant_academy_completions
      WHERE consultant_id = ${consultantId}
    `);
    const stepIds = (rows.rows as { step_id: string }[]).map(r => r.step_id);
    res.json({ success: true, data: stepIds });
  } catch (err: any) {
    console.error('[Academy] GET completions error:', err);
    res.status(500).json({ success: false, error: 'Errore nel recupero completamenti' });
  }
});

router.post('/completions/:stepId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { stepId } = req.params;
    await db.execute(sql`
      INSERT INTO consultant_academy_completions (consultant_id, step_id)
      VALUES (${consultantId}, ${stepId})
      ON CONFLICT (consultant_id, step_id) DO NOTHING
    `);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Academy] POST completion error:', err);
    res.status(500).json({ success: false, error: 'Errore nel salvataggio' });
  }
});

router.delete('/completions/:stepId', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { stepId } = req.params;
    await db.execute(sql`
      DELETE FROM consultant_academy_completions
      WHERE consultant_id = ${consultantId} AND step_id = ${stepId}
    `);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Academy] DELETE completion error:', err);
    res.status(500).json({ success: false, error: 'Errore nella rimozione' });
  }
});

// ─── ADMIN: Module CRUD ───

router.post('/admin/modules', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { slug, title, emoji, tagline, color } = req.body;
    if (!title || !slug) return res.status(400).json({ success: false, error: 'Titolo e slug richiesti' });
    const maxOrder = await db.execute(sql`SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM academy_modules`);
    const nextOrder = Number((maxOrder.rows[0] as any).next_order);
    const result = await db.execute(sql`
      INSERT INTO academy_modules (id, slug, title, emoji, tagline, color, sort_order)
      VALUES (gen_random_uuid(), ${slug}, ${title}, ${emoji || '📖'}, ${tagline || ''}, ${color || 'slate'}, ${nextOrder})
      RETURNING *
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    console.error('[Academy] POST module error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admin/modules/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, emoji, tagline, color, slug } = req.body;
    const result = await db.execute(sql`
      UPDATE academy_modules
      SET title = COALESCE(${title}, title),
          emoji = COALESCE(${emoji}, emoji),
          tagline = COALESCE(${tagline}, tagline),
          color = COALESCE(${color}, color),
          slug = COALESCE(${slug}, slug)
      WHERE id = ${id}
      RETURNING *
    `);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Modulo non trovato' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    console.error('[Academy] PUT module error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/admin/modules/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM academy_modules WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Academy] DELETE module error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admin/modules/reorder', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ success: false, error: 'order deve essere un array' });
    for (let i = 0; i < order.length; i++) {
      await db.execute(sql`UPDATE academy_modules SET sort_order = ${i} WHERE id = ${order[i]}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ADMIN: Lesson CRUD ───

router.post('/admin/lessons', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { lesson_id, module_id, title, description, duration, video_url, video_type, config_link } = req.body;
    if (!title || !module_id || !lesson_id) return res.status(400).json({ success: false, error: 'Campi richiesti: lesson_id, module_id, title' });
    const maxOrder = await db.execute(sql`SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM academy_lessons WHERE module_id = ${module_id}`);
    const nextOrder = Number((maxOrder.rows[0] as any).next_order);
    const result = await db.execute(sql`
      INSERT INTO academy_lessons (id, lesson_id, module_id, title, description, duration, video_url, video_type, config_link, sort_order)
      VALUES (gen_random_uuid(), ${lesson_id}, ${module_id}, ${title}, ${description || ''}, ${duration || '5 min'}, ${video_url || null}, ${video_type || 'iframe'}, ${config_link || '/'}, ${nextOrder})
      RETURNING *
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    console.error('[Academy] POST lesson error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admin/lessons/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, duration, video_url, video_type, config_link, lesson_id } = req.body;
    const setVideoUrl = video_url !== undefined;
    const result = setVideoUrl
      ? await db.execute(sql`
          UPDATE academy_lessons
          SET title = COALESCE(${title}, title),
              description = COALESCE(${description}, description),
              duration = COALESCE(${duration}, duration),
              video_url = ${video_url || null},
              video_type = COALESCE(${video_type}, video_type),
              config_link = COALESCE(${config_link}, config_link),
              lesson_id = COALESCE(${lesson_id}, lesson_id),
              updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `)
      : await db.execute(sql`
          UPDATE academy_lessons
          SET title = COALESCE(${title}, title),
              description = COALESCE(${description}, description),
              duration = COALESCE(${duration}, duration),
              video_type = COALESCE(${video_type}, video_type),
              config_link = COALESCE(${config_link}, config_link),
              lesson_id = COALESCE(${lesson_id}, lesson_id),
              updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Lezione non trovata' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    console.error('[Academy] PUT lesson error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/admin/lessons/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM academy_lessons WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admin/lessons/reorder', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ success: false, error: 'order deve essere un array' });
    for (let i = 0; i < order.length; i++) {
      await db.execute(sql`UPDATE academy_lessons SET sort_order = ${i} WHERE id = ${order[i]}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ADMIN: Document CRUD ───

router.post('/admin/lessons/:lessonId/documents', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { title, file_url, file_type } = req.body;
    if (!title || !file_url) return res.status(400).json({ success: false, error: 'Titolo e URL richiesti' });
    const maxOrder = await db.execute(sql`SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM academy_lesson_documents WHERE lesson_id = ${lessonId}`);
    const nextOrder = Number((maxOrder.rows[0] as any).next_order);
    const result = await db.execute(sql`
      INSERT INTO academy_lesson_documents (id, lesson_id, title, file_url, file_type, sort_order)
      VALUES (gen_random_uuid(), ${lessonId}, ${title}, ${file_url}, ${file_type || 'link'}, ${nextOrder})
      RETURNING *
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/admin/documents/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM academy_lesson_documents WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
