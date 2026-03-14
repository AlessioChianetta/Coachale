import { Router, Response } from 'express';
import { authenticateToken, requireRole, requireSuperAdmin, type AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

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
      content TEXT DEFAULT NULL,
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
    sql`CREATE TABLE IF NOT EXISTS academy_lesson_videos (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_id VARCHAR NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
      title VARCHAR NOT NULL DEFAULT '',
      video_url TEXT NOT NULL,
      video_type VARCHAR NOT NULL DEFAULT 'iframe',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS academy_lesson_steps (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_id VARCHAR NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL DEFAULT 0,
      timestamp VARCHAR DEFAULT NULL,
      title VARCHAR NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      screenshot_url TEXT DEFAULT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  ];
  try { await db.execute(sql`ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS guide_embed_url TEXT DEFAULT NULL`); } catch {}
  try { await db.execute(sql`ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS guide_display_mode VARCHAR DEFAULT 'native'`); } catch {}
  try { await db.execute(sql`ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS guide_local_video_url TEXT DEFAULT NULL`); } catch {}
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
      { slug: 'pkg_setter_ai', title: 'Setter AI', emoji: '📡', tagline: 'Acquisizione & Primo Contatto automatico', color: 'blue', sort_order: 6 },
      { slug: 'pkg_dipendenti_ai', title: 'Dipendenti AI', emoji: '🤖', tagline: 'Il team AI che lavora per te 24/7', color: 'indigo', sort_order: 7 },
      { slug: 'pkg_hunter', title: 'Hunter', emoji: '🎯', tagline: 'Lead Generation & Outreach automatico', color: 'green', sort_order: 8 },
      { slug: 'pkg_email_journey', title: 'Email Journey', emoji: '📧', tagline: 'Comunicazione continuativa e nurturing', color: 'violet', sort_order: 9 },
      { slug: 'pkg_lavoro_quotidiano', title: 'Lavoro Quotidiano', emoji: '📋', tagline: 'Operatività e gestione giornaliera', color: 'slate', sort_order: 10 },
      { slug: 'pkg_formazione', title: 'Formazione & Corsi', emoji: '🎓', tagline: 'Educa i clienti e posizionati come esperto', color: 'amber', sort_order: 11 },
      { slug: 'pkg_content_studio', title: 'Content Studio', emoji: '🎨', tagline: 'Marketing & Contenuti creativi con AI', color: 'orange', sort_order: 12 },
      { slug: 'pkg_voce_ai', title: 'Voce AI', emoji: '📞', tagline: 'Centralino & Chiamate vocali intelligenti', color: 'red', sort_order: 13 },
      { slug: 'pkg_pagamenti', title: 'Pagamenti & Stripe', emoji: '💳', tagline: 'Monetizzazione e rivendita licenze', color: 'teal', sort_order: 14 },
      { slug: 'pkg_team', title: 'Team & Dipendenti', emoji: '👥', tagline: 'Gestione team umano e licenze', color: 'rose', sort_order: 15 },
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
      { lesson_id: 'vertex_ai', module: 'setup_base', title: 'AI Engine (Gemini)', description: 'Collega Google AI Studio per abilitare tutte le funzioni di intelligenza artificiale: agenti, email, idee e molto altro.', duration: '8 min', config_link: '/consultant/api-keys-unified', sort_order: 0 },
      { lesson_id: 'twilio', module: 'setup_base', title: 'Twilio + WhatsApp Business', description: 'Collega il tuo numero WhatsApp Business tramite Twilio per ricevere e inviare messaggi automatici ai tuoi lead e clienti.', duration: '10 min', config_link: '/consultant/api-keys-unified?tab=twilio', sort_order: 1 },
      { lesson_id: 'smtp', module: 'setup_base', title: 'Email SMTP', description: 'Configura il server SMTP per inviare email transazionali, riepilogative e di nurturing direttamente dalla piattaforma.', duration: '6 min', config_link: '/consultant/smtp-settings', sort_order: 2 },
      { lesson_id: 'google_calendar', module: 'setup_base', title: 'Google Calendar', description: 'Collega il tuo calendario Google per sincronizzare automaticamente gli appuntamenti con i clienti e abilitare il booking AI.', duration: '5 min', config_link: '/consultant/appointments', sort_order: 3 },
      { lesson_id: 'lead_import', module: 'acquisisci_lead', title: 'Import Lead da API Esterne', description: 'Configura le API per importare automaticamente lead da CRM, form o altre fonti esterne nel tuo database.', duration: '8 min', config_link: '/consultant/api-keys-unified?tab=lead-import', sort_order: 0 },
      { lesson_id: 'agent_inbound', module: 'acquisisci_lead', title: 'Agente Inbound', description: 'Crea un agente AI che risponde automaticamente ai lead in entrata su WhatsApp, qualificandoli prima della consulenza.', duration: '12 min', config_link: '/consultant/whatsapp', sort_order: 1 },
      { lesson_id: 'whatsapp_template', module: 'acquisisci_lead', title: 'Template WhatsApp Approvato', description: 'Crea e fatti approvare almeno un template da Twilio per inviare messaggi proattivi ai tuoi lead.', duration: '10 min', config_link: '/consultant/whatsapp-templates', sort_order: 2 },
      { lesson_id: 'agent_public_link', module: 'acquisisci_lead', title: 'Link Pubblico Agente', description: 'Genera un link pubblico per permettere ai clienti di iniziare una conversazione con il tuo agente AI via WhatsApp.', duration: '5 min', config_link: '/consultant/whatsapp-agents-chat', sort_order: 3 },
      { lesson_id: 'instagram', module: 'acquisisci_lead', title: 'Instagram Direct Messaging', description: 'Collega il tuo account Instagram Business per gestire automaticamente i messaggi diretti con AI.', duration: '8 min', config_link: '/consultant/api-keys-unified?tab=instagram', sort_order: 4 },
      { lesson_id: 'whatsapp_ai', module: 'acquisisci_lead', title: 'WhatsApp AI Personale', description: 'Configura le chiavi Gemini per abilitare le risposte AI personalizzate sui tuoi agenti WhatsApp.', duration: '6 min', config_link: '/consultant/api-keys-unified', sort_order: 5 },
      { lesson_id: 'stripe_connect', module: 'vendi_converti', title: 'Stripe — Pagamenti', description: 'Collega Stripe per gestire pagamenti, abbonamenti e incassi automatici direttamente dalla piattaforma.', duration: '8 min', config_link: '/consultant/api-keys-unified?tab=stripe', sort_order: 0 },
      { lesson_id: 'agent_outbound', module: 'vendi_converti', title: 'Agente Outbound', description: "Crea un agente AI per le campagne di contatto proattivo verso i lead: l'agente scrive lui, tu chiudi.", duration: '12 min', config_link: '/consultant/whatsapp', sort_order: 1 },
      { lesson_id: 'agent_consultative', module: 'vendi_converti', title: 'Agente Consulenziale', description: 'Crea un agente specializzato per supporto avanzato, rispondendo a domande complesse con la knowledge base.', duration: '10 min', config_link: '/consultant/whatsapp', sort_order: 2 },
      { lesson_id: 'first_campaign', module: 'vendi_converti', title: 'Prima Campagna Marketing', description: 'Lancia la tua prima campagna WhatsApp per contattare i lead automaticamente con messaggi personalizzati AI.', duration: '15 min', config_link: '/consultant/campaigns', sort_order: 3 },
      { lesson_id: 'summary_email', module: 'vendi_converti', title: 'Email Riassuntiva Post-Consulenza', description: "Invia la tua prima email riassuntiva dopo una consulenza: l'AI genera automaticamente il recap per il cliente.", duration: '5 min', config_link: '/consultant/appointments', sort_order: 4 },
      { lesson_id: 'ai_autonomo', module: 'automazioni_ai', title: 'AI Autonomo', description: "Attiva il sistema AI autonomo: l'AI pianifica e completa task automaticamente ogni giorno senza intervento manuale.", duration: '10 min', config_link: '/consultant/ai-autonomy', sort_order: 0 },
      { lesson_id: 'email_journey', module: 'automazioni_ai', title: 'Email Journey', description: "Configura l'automazione email post-consulenza: bozze o invio automatico con template personalizzati dall'AI.", duration: '10 min', config_link: '/consultant/ai-config?tab=ai-email', sort_order: 1 },
      { lesson_id: 'nurturing_emails', module: 'automazioni_ai', title: 'Email Nurturing 365', description: "Genera 365 email automatiche per nutrire i tuoi lead nel tempo e mantenerli coinvolti fino alla decisione d'acquisto.", duration: '12 min', config_link: '/consultant/ai-config?tab=lead-nurturing', sort_order: 2 },
      { lesson_id: 'email_hub', module: 'automazioni_ai', title: 'Email Hub', description: 'Collega il tuo account email per gestire inbox, invii automatici e risposte AI direttamente dalla piattaforma.', duration: '10 min', config_link: '/consultant/email-hub', sort_order: 3 },
      { lesson_id: 'voice_calls', module: 'automazioni_ai', title: 'Chiamate Voice (Alessia AI)', description: "Completa una chiamata vocale AI con Alessia: l'agente chiama i lead, qualifica e prenota appuntamenti in autonomia.", duration: '8 min', config_link: '/consultant/voice-calls', sort_order: 4 },
      { lesson_id: 'google_calendar_agents', module: 'automazioni_ai', title: 'Calendario Agenti AI', description: 'Collega Google Calendar ai tuoi agenti per permettere prenotazioni automatiche con round robin, booking pool e distribuzione intelligente tra più agenti.', duration: '8 min', config_link: '/consultant/whatsapp', sort_order: 5 },
      { lesson_id: 'knowledge_base', module: 'contenuti_corsi', title: 'Base di Conoscenza', description: "Carica i tuoi documenti (PDF, Word, testo) per alimentare l'AI con informazioni specifiche del tuo business.", duration: '10 min', config_link: '/consultant/knowledge-documents', sort_order: 0 },
      { lesson_id: 'first_course', module: 'contenuti_corsi', title: 'Primo Corso', description: 'Crea il tuo primo corso formativo per i clienti: struttura lezioni, aggiungi materiali e assegna ai clienti.', duration: '15 min', config_link: '/consultant/university', sort_order: 1 },
      { lesson_id: 'first_exercise', module: 'contenuti_corsi', title: 'Primo Esercizio', description: 'Crea il tuo primo esercizio pratico: assegnalo ai clienti e monitora lo svolgimento con feedback AI.', duration: '10 min', config_link: '/consultant/exercises', sort_order: 2 },
      { lesson_id: 'agent_ideas', module: 'contenuti_corsi', title: 'Idee AI per gli Agenti', description: "Usa l'AI per generare idee creative su come personalizzare i tuoi agenti e migliorare le conversioni.", duration: '8 min', config_link: '/consultant/whatsapp?tab=ideas', sort_order: 3 },
      { lesson_id: 'more_templates', module: 'contenuti_corsi', title: 'Libreria Template WhatsApp', description: 'Espandi la tua libreria di template WhatsApp per coprire tutti gli scenari di comunicazione automatica.', duration: '8 min', config_link: '/consultant/whatsapp-templates', sort_order: 4 },
      { lesson_id: 'turn_config', module: 'avanzato', title: 'Video Meeting (TURN Server)', description: 'Configura Metered.ca per videochiamate WebRTC affidabili e sicure con i tuoi clienti, senza dipendenze esterne.', duration: '8 min', config_link: '/consultant/api-keys-unified?tab=video-meeting', sort_order: 0 },
      { lesson_id: 'pkg_setter_come_funziona', module: 'pkg_setter_ai', title: 'Come funziona il Setter AI', description: 'Il Setter AI è il tuo primo punto di contatto automatico. Risponde ai lead WhatsApp e Instagram 24/7, qualifica e prenota appuntamenti.', duration: '10 min', config_link: '/consultant/whatsapp', sort_order: 0 },
      { lesson_id: 'pkg_setter_primo_agente', module: 'pkg_setter_ai', title: 'Configurare il primo agente inbound', description: 'Passo-passo per creare il tuo primo agente: System Prompt, Knowledge Base, test e link pubblico.', duration: '15 min', config_link: '/consultant/whatsapp', sort_order: 1 },
      { lesson_id: 'pkg_setter_qualifica', module: 'pkg_setter_ai', title: 'Strategia di qualifica lead', description: "Come configurare l'agente per qualificare i lead con il framework BANT e integrarsi con il funnel di vendita.", duration: '10 min', config_link: '/consultant/whatsapp', sort_order: 2 },
      { lesson_id: 'pkg_dip_chi_sono', module: 'pkg_dipendenti_ai', title: 'I 9 Dipendenti AI — Chi sono e cosa fanno', description: 'Panoramica completa di Stella, Marco, Millie, Luna, Alex, Sara, Tomas, Nina e Hunter.', duration: '12 min', config_link: '/consultant/ai-autonomy', sort_order: 0 },
      { lesson_id: 'pkg_dip_attivare', module: 'pkg_dipendenti_ai', title: "Attivare e configurare l'AI Autonomo", description: "Come attivare l'autonomia, configurare orari lavorativi, modalità approvazione e personalizzare ogni dipendente.", duration: '10 min', config_link: '/consultant/ai-autonomy', sort_order: 1 },
      { lesson_id: 'pkg_dip_monitorare', module: 'pkg_dipendenti_ai', title: 'Monitorare e gestire i task AI', description: 'Leggere la dashboard task, approvare o rifiutare azioni, capire il ragionamento dei dipendenti.', duration: '8 min', config_link: '/consultant/ai-autonomy', sort_order: 2 },
      { lesson_id: 'pkg_hunter_come_funziona', module: 'pkg_hunter', title: 'Come funziona il Lead Scraper', description: 'Il Lead Scraper cerca su Google Maps, arricchisce con dati web, assegna un punteggio AI e presenta i lead in un CRM dedicato.', duration: '10 min', config_link: '/consultant/lead-scraper', sort_order: 0 },
      { lesson_id: 'pkg_hunter_ricerca', module: 'pkg_hunter', title: 'Configurare una ricerca lead', description: 'Come definire il target, scegliere la zona, impostare i filtri e lanciare ricerche efficaci.', duration: '8 min', config_link: '/consultant/lead-scraper', sort_order: 1 },
      { lesson_id: 'pkg_hunter_contatto', module: 'pkg_hunter', title: 'Gestire i lead e avviare il contatto', description: 'Pipeline multi-canale: WhatsApp via Hunter, campagne batch, chiamate vocali, email nurturing.', duration: '10 min', config_link: '/consultant/lead-scraper', sort_order: 2 },
      { lesson_id: 'pkg_email_nurturing', module: 'pkg_email_journey', title: 'Come funziona il Nurturing Email', description: 'Il nurturing mantiene viva la relazione con i lead nel tempo con email personalizzate AI.', duration: '10 min', config_link: '/consultant/ai-config?tab=lead-nurturing', sort_order: 0 },
      { lesson_id: 'pkg_email_sequenza', module: 'pkg_email_journey', title: 'Creare la prima sequenza email', description: 'Configurare Email Journey post-consulenza e Nurturing 365: settore, tono, obiettivo, generazione.', duration: '12 min', config_link: '/consultant/ai-config?tab=ai-email', sort_order: 1 },
      { lesson_id: 'pkg_email_hub', module: 'pkg_email_journey', title: 'Email Hub — Inbox e risposte AI', description: 'Inbox unificata, classificazione AI con Millie, risposte suggerite e collegamento CRM.', duration: '10 min', config_link: '/consultant/email-hub', sort_order: 2 },
      { lesson_id: 'pkg_lq_dashboard', module: 'pkg_lavoro_quotidiano', title: 'Dashboard e KPI', description: 'Il cruscotto quotidiano: clienti attivi, appuntamenti, lead in pipeline, task AI, email, revenue.', duration: '8 min', config_link: '/consultant', sort_order: 0 },
      { lesson_id: 'pkg_lq_appuntamenti', module: 'pkg_lavoro_quotidiano', title: 'Gestire appuntamenti e calendario', description: 'Sincronizzazione Google Calendar, booking AI automatico, reminder WhatsApp, riepilogo post-consulenza.', duration: '10 min', config_link: '/consultant/appointments', sort_order: 1 },
      { lesson_id: 'pkg_lq_crm', module: 'pkg_lavoro_quotidiano', title: 'CRM — Gestire clienti e contatti', description: 'Clienti attivi vs contatti CRM, profilo cliente, azioni rapide, filtri, conversione CRM→Cliente.', duration: '10 min', config_link: '/consultant/clients', sort_order: 2 },
      { lesson_id: 'pkg_form_corso', module: 'pkg_formazione', title: 'Creare un corso per i tuoi clienti', description: 'Struttura Anno→Trimestre→Modulo→Lezione, generazione AI dei corsi, tracciamento e certificati.', duration: '12 min', config_link: '/consultant/university', sort_order: 0 },
      { lesson_id: 'pkg_form_esercizi', module: 'pkg_formazione', title: 'Esercizi pratici e valutazione', description: 'Tipi di esercizi, correzione AI, feedback, voti e gamification.', duration: '10 min', config_link: '/consultant/exercises', sort_order: 1 },
      { lesson_id: 'pkg_form_gamification', module: 'pkg_formazione', title: 'Gamification e motivazione', description: 'Punti XP, livelli, badge, classifica, streak. Come configurarli per i clienti Gold.', duration: '8 min', config_link: '/consultant/academy', sort_order: 2 },
      { lesson_id: 'pkg_cs_advisage', module: 'pkg_content_studio', title: 'AdVisage AI — La fabbrica creativa', description: 'Genera concept pubblicitari: brief, Multi-Style Engine, Pitch Mode e Batch Analysis.', duration: '10 min', config_link: '/consultant/content-studio/advisage', sort_order: 0 },
      { lesson_id: 'pkg_cs_ideas', module: 'pkg_content_studio', title: 'Ideas Generator e calendario editoriale', description: 'Brainstorming AI per contenuti: idee per post, articoli, video. Calendario editoriale.', duration: '8 min', config_link: '/consultant/content-studio/ideas', sort_order: 1 },
      { lesson_id: 'pkg_cs_publer', module: 'pkg_content_studio', title: 'Pubblicare e monitorare con Publer', description: 'Export verso Publer, schedulazione multi-piattaforma, sync delle metriche.', duration: '8 min', config_link: '/consultant/content-studio/ideas', sort_order: 2 },
      { lesson_id: 'pkg_voce_alessia', module: 'pkg_voce_ai', title: 'Alessia AI — Le chiamate vocali', description: 'Chiamate outbound, centralino AI, prenotazione appuntamenti vocale, follow-up automatici.', duration: '10 min', config_link: '/consultant/voice-calls', sort_order: 0 },
      { lesson_id: 'pkg_voce_centralino', module: 'pkg_voce_ai', title: "Centralino AI e coda d'attesa", description: 'Risposta automatica, riconoscimento intento, routing intelligente, messaggi fuori orario.', duration: '8 min', config_link: '/consultant/voice-calls', sort_order: 1 },
      { lesson_id: 'pkg_voce_numeri', module: 'pkg_voce_ai', title: 'Provisioning numeri VoIP', description: 'Acquistare e configurare numeri Telnyx: ricerca, acquisto, configurazione automatica e test.', duration: '8 min', config_link: '/consultant/voice-settings', sort_order: 2 },
      { lesson_id: 'pkg_pay_modello', module: 'pkg_pagamenti', title: 'Il modello di business — Diamond, Gold, Silver', description: 'Come funziona la rivendita licenze: tu hai Diamond, vendi Gold/Silver ai clienti, revenue share 50/50.', duration: '12 min', config_link: '/consultant/api-keys-unified?tab=stripe', sort_order: 0 },
      { lesson_id: 'pkg_pay_stripe', module: 'pkg_pagamenti', title: 'Configurare Stripe Connect', description: 'Wizard di onboarding a 3 step: account Express, webhook, API keys.', duration: '10 min', config_link: '/consultant/api-keys-unified?tab=stripe', sort_order: 1 },
      { lesson_id: 'pkg_pay_vendere', module: 'pkg_pagamenti', title: 'Vendere licenze ai clienti', description: 'Flusso completo: creare contatto CRM → generare link pagamento → conversione automatica.', duration: '10 min', config_link: '/consultant/clients', sort_order: 2 },
      { lesson_id: 'pkg_team_reparti', module: 'pkg_team', title: 'Creare reparti e organizzare il team', description: 'Struttura organizzativa: reparti, dipendenti umani, ruoli e permessi. Ogni membro ha il suo AI.', duration: '10 min', config_link: '/consultant/clients?tab=employees', sort_order: 0 },
      { lesson_id: 'pkg_team_licenze', module: 'pkg_team', title: 'Gestire le licenze', description: "Come funzionano le licenze, contatore, piani, strategia d'uso con contatti CRM.", duration: '8 min', config_link: '/consultant/clients', sort_order: 1 },
      { lesson_id: 'pkg_team_multiprofilo', module: 'pkg_team', title: 'Multi-profilo e accesso multi-consulente', description: 'Un utente può essere cliente di più consulenti: come funziona e come lo gestisce il sistema.', duration: '6 min', config_link: '/consultant/clients', sort_order: 2 },
    ];

    for (const l of lessons) {
      const modId = moduleMap[l.module];
      if (!modId) continue;
      await db.execute(sql`
        INSERT INTO academy_lessons (id, lesson_id, module_id, title, description, duration, config_link, sort_order)
        VALUES (gen_random_uuid(), ${l.lesson_id}, ${modId}, ${l.title}, ${l.description}, ${l.duration}, ${l.config_link}, ${l.sort_order})
        ON CONFLICT (lesson_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          config_link = EXCLUDED.config_link,
          sort_order = EXCLUDED.sort_order
      `);
    }

    console.log('[Academy] Seed complete: 16 modules, 57 lessons');
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
    const videosRes = await db.execute(sql`
      SELECT * FROM academy_lesson_videos ORDER BY sort_order ASC
    `);

    const stepsRes = await db.execute(sql`
      SELECT * FROM academy_lesson_steps ORDER BY sort_order ASC
    `);

    const docs = docsRes.rows as any[];
    const videos = videosRes.rows as any[];
    const steps = stepsRes.rows as any[];
    const lessons = (lessonsRes.rows as any[]).map(l => ({
      ...l,
      documents: docs.filter(d => d.lesson_id === l.id),
      videos: videos.filter(v => v.lesson_id === l.id),
      steps: steps.filter(s => s.lesson_id === l.id),
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

// ─── ADMIN: Video CRUD ───

router.post('/admin/lessons/:lessonId/videos', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { title, video_url, video_type } = req.body;
    if (!video_url) return res.status(400).json({ success: false, error: 'URL video richiesto' });
    if (!title || !title.trim()) return res.status(400).json({ success: false, error: 'Titolo video richiesto' });
    try { const u = new URL(video_url); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); } catch { return res.status(400).json({ success: false, error: 'URL video non valido. Inserisci un URL completo (es: https://www.youtube.com/watch?v=...)' }); }
    const maxOrder = await db.execute(sql`SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM academy_lesson_videos WHERE lesson_id = ${lessonId}`);
    const nextOrder = Number((maxOrder.rows[0] as any).next_order);
    const result = await db.execute(sql`
      INSERT INTO academy_lesson_videos (id, lesson_id, title, video_url, video_type, sort_order)
      VALUES (gen_random_uuid(), ${lessonId}, ${title || ''}, ${video_url}, ${video_type || 'iframe'}, ${nextOrder})
      RETURNING *
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    console.error('[Academy] POST video error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admin/videos/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, video_url, video_type } = req.body;
    const result = await db.execute(sql`
      UPDATE academy_lesson_videos
      SET title = COALESCE(${title}, title),
          video_url = COALESCE(${video_url}, video_url),
          video_type = COALESCE(${video_type}, video_type)
      WHERE id = ${id}
      RETURNING *
    `);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Video non trovato' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/admin/videos/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM academy_lesson_videos WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admin/videos/reorder', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ success: false, error: 'order deve essere un array' });
    for (let i = 0; i < order.length; i++) {
      await db.execute(sql`UPDATE academy_lesson_videos SET sort_order = ${i} WHERE id = ${order[i]}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ADMIN: Guide embed + display mode ───

router.put('/admin/lessons/:id/guide-settings', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { guide_embed_url, guide_display_mode } = req.body;
    const validModes = ['native', 'embed', 'both'];
    if (guide_display_mode !== undefined && !validModes.includes(guide_display_mode)) {
      return res.status(400).json({ success: false, error: `guide_display_mode deve essere: ${validModes.join(', ')}` });
    }

    const updates: string[] = [];
    const values: any = {};
    if (guide_embed_url !== undefined) {
      if (guide_embed_url && !guide_embed_url.startsWith('https://')) {
        return res.status(400).json({ success: false, error: 'guide_embed_url deve iniziare con https://' });
      }
      updates.push('guide_embed_url');
      values.guide_embed_url = guide_embed_url || null;
    }
    if (guide_display_mode !== undefined) {
      updates.push('guide_display_mode');
      values.guide_display_mode = guide_display_mode;
    }

    let result;
    if (updates.includes('guide_embed_url') && updates.includes('guide_display_mode')) {
      result = await db.execute(sql`UPDATE academy_lessons SET guide_embed_url = ${values.guide_embed_url}, guide_display_mode = ${values.guide_display_mode}, updated_at = NOW() WHERE id = ${id} RETURNING *`);
    } else if (updates.includes('guide_embed_url')) {
      result = await db.execute(sql`UPDATE academy_lessons SET guide_embed_url = ${values.guide_embed_url}, updated_at = NOW() WHERE id = ${id} RETURNING *`);
    } else if (updates.includes('guide_display_mode')) {
      result = await db.execute(sql`UPDATE academy_lessons SET guide_display_mode = ${values.guide_display_mode}, updated_at = NOW() WHERE id = ${id} RETURNING *`);
    } else {
      return res.status(400).json({ success: false, error: 'Nessun campo da aggiornare' });
    }

    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Lezione non trovata' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ADMIN: Parse Guidde embed HTML ───

router.post('/admin/parse-guidde', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { html } = req.body;
    if (!html) return res.status(400).json({ success: false, error: 'HTML richiesto' });

    let embedUrl = '';
    const iframeSrcMatch = html.match(/src="([^"]+)"/);
    if (iframeSrcMatch) embedUrl = iframeSrcMatch[1];

    const steps: Array<{ step_number: number; timestamp: string; title: string; description: string }> = [];
    const pRegex = /<p>(\d{2}:\d{2}):\s*(.*?)<\/p>/gi;
    let match;
    let stepNum = 0;
    while ((match = pRegex.exec(html)) !== null) {
      stepNum++;
      const timestamp = match[1];
      const text = match[2].trim();
      const firstSentenceEnd = text.indexOf('. ');
      const title = firstSentenceEnd > 0 && firstSentenceEnd < 60 ? text.substring(0, firstSentenceEnd) : text.substring(0, 60);
      const description = firstSentenceEnd > 0 && firstSentenceEnd < 60 ? text.substring(firstSentenceEnd + 2) : text;
      steps.push({ step_number: stepNum, timestamp, title, description: description || text });
    }

    res.json({ success: true, data: { embedUrl, steps } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ADMIN: Step CRUD ───

router.post('/admin/lessons/:lessonId/steps', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { step_number, timestamp, title, description, screenshot_url } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Titolo richiesto' });
    const maxOrder = await db.execute(sql`SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM academy_lesson_steps WHERE lesson_id = ${lessonId}`);
    const nextOrder = Number((maxOrder.rows[0] as any).next_order);
    const result = await db.execute(sql`
      INSERT INTO academy_lesson_steps (id, lesson_id, step_number, timestamp, title, description, screenshot_url, sort_order)
      VALUES (gen_random_uuid(), ${lessonId}, ${step_number || nextOrder + 1}, ${timestamp || null}, ${title}, ${description || ''}, ${screenshot_url || null}, ${nextOrder})
      RETURNING *
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admin/lessons/:lessonId/steps/bulk', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { steps, guide_embed_url } = req.body;
    if (!Array.isArray(steps)) return res.status(400).json({ success: false, error: 'steps deve essere un array' });

    await db.execute(sql`BEGIN`);
    try {
      await db.execute(sql`DELETE FROM academy_lesson_steps WHERE lesson_id = ${lessonId}`);

      const inserted = [];
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const result = await db.execute(sql`
          INSERT INTO academy_lesson_steps (id, lesson_id, step_number, timestamp, title, description, screenshot_url, sort_order)
          VALUES (gen_random_uuid(), ${lessonId}, ${s.step_number || i + 1}, ${s.timestamp || null}, ${s.title || ''}, ${s.description || ''}, ${s.screenshot_url || null}, ${i})
          RETURNING *
        `);
        inserted.push(result.rows[0]);
      }

      if (guide_embed_url !== undefined) {
        if (guide_embed_url && !guide_embed_url.startsWith('https://')) {
          throw new Error('guide_embed_url deve iniziare con https://');
        }
        await db.execute(sql`UPDATE academy_lessons SET guide_embed_url = ${guide_embed_url || null}, updated_at = NOW() WHERE id = ${lessonId}`);
      }

      await db.execute(sql`COMMIT`);
      res.json({ success: true, data: inserted });
    } catch (innerErr: any) {
      await db.execute(sql`ROLLBACK`);
      throw innerErr;
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admin/steps/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { step_number, timestamp, title, description, screenshot_url } = req.body;
    const result = await db.execute(sql`
      UPDATE academy_lesson_steps
      SET step_number = COALESCE(${step_number}, step_number),
          timestamp = COALESCE(${timestamp}, timestamp),
          title = COALESCE(${title}, title),
          description = COALESCE(${description}, description),
          screenshot_url = COALESCE(${screenshot_url}, screenshot_url)
      WHERE id = ${id}
      RETURNING *
    `);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Step non trovato' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/admin/steps/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM academy_lesson_steps WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admin/steps/reorder', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ success: false, error: 'order deve essere un array' });
    for (let i = 0; i < order.length; i++) {
      await db.execute(sql`UPDATE academy_lesson_steps SET sort_order = ${i}, step_number = ${i + 1} WHERE id = ${order[i]}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('169.254.')) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

async function downloadFileToLocal(url: string, destDir: string, filenamePrefix: string): Promise<{ localPath: string; filename: string } | null> {
  try {
    if (!isValidExternalUrl(url)) {
      console.error(`[Academy] Blocked download for unsafe URL: ${url}`);
      return null;
    }

    const MAX_SIZE = 500 * 1024 * 1024;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_SIZE) throw new Error(`File too large: ${contentLength} bytes`);

    const contentType = response.headers.get('content-type') || '';
    let ext = '.bin';
    if (contentType.includes('video/mp4') || url.includes('.mp4')) ext = '.mp4';
    else if (contentType.includes('video/webm') || url.includes('.webm')) ext = '.webm';
    else if (contentType.includes('image/png') || url.includes('.png')) ext = '.png';
    else if (contentType.includes('image/jpeg') || url.includes('.jpg') || url.includes('.jpeg')) ext = '.jpg';
    else if (contentType.includes('image/webp') || url.includes('.webp')) ext = '.webp';
    else if (contentType.includes('image/gif') || url.includes('.gif')) ext = '.gif';
    else if (contentType.includes('image/svg')) ext = '.svg';
    else if (contentType.includes('video/')) ext = '.mp4';
    else if (contentType.includes('image/')) ext = '.png';

    const filename = `${filenamePrefix}_${randomUUID().slice(0, 8)}${ext}`;
    const destPath = path.join(destDir, filename);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);

    return { localPath: destPath, filename };
  } catch (err: any) {
    console.error(`[Academy] Download failed for ${url}:`, err.message);
    return null;
  }
}

router.post('/admin/lessons/:lessonId/download-media', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { video_url, step_screenshots } = req.body as {
      video_url?: string;
      step_screenshots?: Array<{ step_id: string; screenshot_url: string }>;
    };

    const lessonDir = path.join('uploads', 'academy', lessonId);
    if (!fs.existsSync(lessonDir)) fs.mkdirSync(lessonDir, { recursive: true });

    const results: {
      video?: { success: boolean; localUrl?: string; error?: string };
      screenshots: Array<{ step_id: string; success: boolean; localUrl?: string; error?: string }>;
    } = { screenshots: [] };

    if (video_url) {
      const dl = await downloadFileToLocal(video_url, lessonDir, 'video');
      if (dl) {
        const localUrl = `/uploads/academy/${lessonId}/${dl.filename}`;
        await db.execute(sql`UPDATE academy_lessons SET guide_local_video_url = ${localUrl}, updated_at = NOW() WHERE id = ${lessonId}`);
        results.video = { success: true, localUrl };
      } else {
        results.video = { success: false, error: 'Download video fallito' };
      }
    }

    if (step_screenshots && Array.isArray(step_screenshots)) {
      for (const ss of step_screenshots) {
        if (!ss.screenshot_url || !ss.step_id) {
          results.screenshots.push({ step_id: ss.step_id || 'unknown', success: false, error: 'Dati mancanti' });
          continue;
        }
        const dl = await downloadFileToLocal(ss.screenshot_url, lessonDir, `step_${ss.step_id.slice(0, 8)}`);
        if (dl) {
          const localUrl = `/uploads/academy/${lessonId}/${dl.filename}`;
          await db.execute(sql`UPDATE academy_lesson_steps SET screenshot_url = ${localUrl} WHERE id = ${ss.step_id}`);
          results.screenshots.push({ step_id: ss.step_id, success: true, localUrl });
        } else {
          results.screenshots.push({ step_id: ss.step_id, success: false, error: 'Download screenshot fallito' });
        }
      }
    }

    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('[Academy] Download media error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
