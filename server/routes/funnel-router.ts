import { Router, Response } from "express";
import { authenticateToken, requireAnyRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { getAIProvider, trackedGenerateContent } from "../ai/provider-factory";

const router = Router();

(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS consultant_funnel_chats (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        consultant_id VARCHAR NOT NULL,
        funnel_id VARCHAR,
        messages JSONB DEFAULT '[]'::jsonb,
        status VARCHAR DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.error("[Funnel] Error creating funnel_chats table:", e);
  }
})();

(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS consultant_funnel_versions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        funnel_id VARCHAR NOT NULL,
        consultant_id VARCHAR NOT NULL,
        version_number INTEGER NOT NULL DEFAULT 1,
        label TEXT,
        source VARCHAR NOT NULL DEFAULT 'manual',
        nodes_data JSONB NOT NULL DEFAULT '[]',
        edges_data JSONB NOT NULL DEFAULT '[]',
        funnel_name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_funnel_versions_funnel_id
        ON consultant_funnel_versions(funnel_id, created_at DESC)
    `);
  } catch (e) {
    console.error("[Funnel] Error creating funnel_versions table:", e);
  }
})();

(async () => {
  try {
    await db.execute(sql`ALTER TABLE consultant_funnels ADD COLUMN IF NOT EXISTS delivery_session_id VARCHAR`);
    await db.execute(sql`ALTER TABLE consultant_funnels ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'manual'`);
    await db.execute(sql`ALTER TABLE consultant_funnels ADD COLUMN IF NOT EXISTS lead_name VARCHAR`);
    await db.execute(sql`DROP INDEX IF EXISTS idx_funnels_delivery_session`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_funnels_delivery_session ON consultant_funnels(consultant_id, delivery_session_id) WHERE delivery_session_id IS NOT NULL`);
  } catch (e) {
    console.error("[Funnel] Error adding delivery columns:", e);
  }
})();

function getConsultantId(req: AuthRequest): string | null {
  const user = req.user;
  if (!user) return null;
  if (user.role === "super_admin") {
    return (req.query.consultant_id as string) || (req.body?.consultant_id as string) || user.id;
  }
  return user.id;
}

const AI_ROLE_DEFINITIONS = [
  { id: "alessia", name: "Alessia", displayName: "Alessia – Voice Consultant", accentColor: "pink", shortDescription: "Chiamate AI proattive e follow-up vocale" },
  { id: "millie", name: "Millie", displayName: "Millie – Email Writer", accentColor: "purple", shortDescription: "Scrittura email personalizzate AI" },
  { id: "echo", name: "Echo", displayName: "Echo – Summarizer", accentColor: "orange", shortDescription: "Riassunti automatici conversazioni" },
  { id: "nova", name: "Nova", displayName: "Nova – Social Media Manager", accentColor: "pink", shortDescription: "Gestione social media AI" },
  { id: "stella", name: "Stella", displayName: "Stella – WhatsApp Assistant", accentColor: "emerald", shortDescription: "Assistente WhatsApp AI" },
  { id: "marco", name: "Marco", displayName: "Marco – Executive Coach", accentColor: "indigo", shortDescription: "Coaching esecutivo AI" },
  { id: "robert", name: "Robert", displayName: "Robert – Sales Coach", accentColor: "amber", shortDescription: "Coaching vendite AI" },
  { id: "hunter", name: "Hunter", displayName: "Hunter – Lead Prospector", accentColor: "teal", shortDescription: "Ricerca lead automatica" },
  { id: "personalizza", name: "Personalizza", displayName: "Personalizza – Assistente Custom", accentColor: "gray", shortDescription: "Assistente AI personalizzato" },
  { id: "architetto", name: "Leonardo", displayName: "Leonardo – Architetto dei Funnel", accentColor: "cyan", shortDescription: "Progettazione funnel strategici con contesto di mercato" },
];

const NODE_TYPES_SCHEMA = `
Available node types (use ONLY these exact type values):
SORGENTI TRAFFICO: facebook_ads, google_ads, instagram_ads, tiktok_ads, offline_referral, organic
CATTURA: landing_page, form_modulo, lead_magnet, webhook
GESTIONE LEAD: import_excel, crm_hunter, setter_ai
COMUNICAZIONE: whatsapp, email, voice_call, sms, instagram_dm, nurturing_lead365, email_journey
CONVERSIONE: appuntamento, prima_call, seconda_call, chiusura, pagamento
DELIVERY: onboarding, servizio, followup
CUSTOM: custom_step

MAPPATURE ENTITÀ — ogni tipo di nodo si collega a risorse reali della piattaforma:
- facebook_ads/instagram_ads/tiktok_ads/google_ads/organic → Post del Content Studio (contenuti pubblicati/pianificati)
- offline_referral → Pagina Referral (landing page passaparola)
- form_modulo → Pagina Optin (form di contatto diretto)
- lead_magnet → Lead Magnet AI (onboarding gratuito con agente AI)
- crm_hunter → Ricerche Hunter (lead scraper automatico)
- setter_ai → Dipendenti AI (Alessia, Stella, Marco, etc.)
- onboarding → Lead Magnet AI (Dipendente Delivery "Luca", /onboarding-gratuito/:id)
- whatsapp → Agenti WhatsApp (chatbot configurati)
- email → Account Email (SMTP/IMAP configurati)
- voice_call → Numeri Voice (numeri telefonici AI)
- appuntamento → Sistema Prenotazioni (booking page)
- pagamento/servizio → Catalogo Servizi (prodotti e servizi con prezzi)
- followup → Campagne Marketing (follow-up automatici)
- nurturing_lead365 → Config Nurturing Lead 365 (sequenza email automatica 365 giorni per lead proattivi, riscaldamento graduale)
- email_journey → Config Email Journey (percorso email mensile 31 giorni per clienti attivi, contenuti AI personalizzati)
- landing_page/webhook/sms/instagram_dm/import_excel/prima_call/seconda_call/chiusura/custom_step → Configurazione manuale

ACADEMY LESSONS — ogni tipo di nodo ha lezioni formative associate dall'Accademia:
- facebook_ads → AdVisage AI, Ideas Generator
- google_ads → AdVisage AI
- instagram_ads → AdVisage AI, Instagram DM, Ideas Generator
- tiktok_ads → AdVisage AI
- offline_referral → Vendere licenze ai clienti
- organic → Ideas Generator, Pubblicare con Publer
- landing_page → Link Pubblico Agente
- form_modulo → Import Lead da API Esterne
- lead_magnet → Base di Conoscenza
- webhook → Import Lead da API Esterne
- import_excel → Import Lead da API Esterne
- crm_hunter → Lead Scraper (3 lezioni)
- setter_ai → Setter AI (3 lezioni)
- whatsapp → Agente Inbound, Template WhatsApp, WhatsApp AI
- email → Email SMTP, Email Hub
- voice_call → Chiamate Voice, Voce AI (3 lezioni)
- sms → Twilio + WhatsApp Business
- instagram_dm → Instagram Direct Messaging
- nurturing_lead365 → Email Nurturing 365
- email_journey → Email Journey
- appuntamento → Google Calendar, Calendario Agenti AI
- prima_call/seconda_call → Agente Consulenziale
- chiusura/pagamento → Stripe — Pagamenti
- onboarding → Primo Corso, Formazione
- servizio → Modello di business, Gestire licenze
- followup → Email Riassuntiva, Prima Campagna Marketing
`;

const SUBTITLE_SUGGESTIONS = `
SOTTOTITOLI CONSIGLIATI per ogni tipo di nodo (usa questi o simili in italiano):
- facebook_ads → "Campagna Meta Ads"
- google_ads → "Campagna Google Search/Display"
- instagram_ads → "Campagna Instagram Ads"
- tiktok_ads → "Campagna TikTok Ads"
- offline_referral → "Passaparola e segnalazioni"
- organic → "Contenuto organico"
- landing_page → "Pagina di atterraggio"
- form_modulo → "Cattura contatti optin"
- lead_magnet → "Risorsa gratuita di valore"
- webhook → "Integrazione esterna"
- import_excel → "Import contatti da file"
- crm_hunter → "Ricerca lead automatica"
- setter_ai → "Qualifica lead via AI"
- whatsapp → "Messaggio WhatsApp AI"
- email → "Email automatica personalizzata"
- voice_call → "Chiamata vocale AI"
- sms → "Messaggio SMS"
- instagram_dm → "DM Instagram automatico"
- appuntamento → "Prenotazione consulenza"
- prima_call → "Prima chiamata conoscitiva"
- seconda_call → "Follow-up telefonico"
- chiusura → "Chiusura contratto"
- pagamento → "Pagamento e fatturazione"
- onboarding → "Onboarding con Luca (Lead Magnet AI)"
- servizio → "Erogazione servizio"
- followup → "Follow-up post-vendita"
- nurturing_lead365 → "Sequenza nurturing 365 giorni"
- email_journey → "Percorso email mensile clienti"
- custom_step → "Step personalizzato"
`;

const NODE_TYPE_ACADEMY_MAP: Record<string, string[]> = {
  facebook_ads: ["pkg_cs_advisage", "pkg_cs_ideas"],
  google_ads: ["pkg_cs_advisage"],
  instagram_ads: ["pkg_cs_advisage", "instagram", "pkg_cs_ideas"],
  tiktok_ads: ["pkg_cs_advisage"],
  offline_referral: ["pkg_pay_vendere"],
  organic: ["pkg_cs_ideas", "pkg_cs_publer"],
  landing_page: ["agent_public_link"],
  form_modulo: ["lead_import"],
  lead_magnet: ["knowledge_base"],
  webhook: ["lead_import"],
  import_excel: ["lead_import"],
  crm_hunter: ["pkg_hunter_come_funziona", "pkg_hunter_ricerca", "pkg_hunter_contatto"],
  setter_ai: ["pkg_setter_come_funziona", "pkg_setter_primo_agente", "pkg_setter_qualifica"],
  whatsapp: ["agent_inbound", "whatsapp_template", "whatsapp_ai"],
  email: ["smtp", "email_hub", "pkg_email_hub"],
  voice_call: ["voice_calls", "pkg_voce_alessia", "pkg_voce_centralino"],
  sms: ["twilio"],
  instagram_dm: ["instagram"],
  nurturing_lead365: ["nurturing_emails", "pkg_email_nurturing"],
  email_journey: ["email_journey", "pkg_email_sequenza"],
  appuntamento: ["google_calendar", "google_calendar_agents", "pkg_lq_appuntamenti"],
  prima_call: ["agent_consultative", "pkg_lq_appuntamenti"],
  seconda_call: ["agent_consultative"],
  chiusura: ["stripe_connect", "pkg_pay_stripe"],
  pagamento: ["stripe_connect", "pkg_pay_stripe", "pkg_pay_vendere"],
  onboarding: ["first_course", "pkg_form_corso"],
  servizio: ["pkg_pay_modello", "pkg_team_licenze"],
  followup: ["summary_email", "first_campaign", "pkg_email_sequenza"],
  custom_step: [],
};

router.post("/generate", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt richiesto" });
    }

    const provider = await getAIProvider(consultantId);
    if (!provider?.client) {
      return res.status(500).json({ error: "Provider AI non disponibile" });
    }

    const systemPrompt = `Sei un esperto di marketing e funnel di vendita. L'utente ti descriverà un funnel e tu devi generare un diagramma di nodi e connessioni in formato JSON.

${NODE_TYPES_SCHEMA}

${SUBTITLE_SUGGESTIONS}

REGOLE:
1. Ogni nodo deve avere: id (stringa univoca tipo "node_1"), type (dal tipo sopra), position (oggetto con x e y), data (oggetto con label, subtitle, e category)
2. Ogni edge deve avere: id (stringa univoca tipo "edge_1_2"), source (id nodo sorgente), target (id nodo destinazione)
3. Posiziona i nodi in un flusso dall'alto verso il basso. Il primo nodo parte a y=0. Ogni livello successivo è ~180px più in basso
4. Se ci sono rami paralleli (es. Facebook Ads E Google Ads), mettili sulla stessa riga Y ma con X diversi (distanza ~300px tra nodi paralleli, centrati rispetto al flusso)
5. Se due o più nodi convergono verso un unico nodo successivo, crea edge da tutti verso quel nodo
6. Usa label in italiano, brevi e descrittive
7. Il campo data.label è il titolo del nodo (es. "Facebook Ads", "Landing Page", "Setter AI WhatsApp")
8. Il campo data.subtitle è un breve testo descrittivo del ruolo del nodo nel funnel (usa i sottotitoli suggeriti come riferimento)
9. Il campo data.category deve essere una delle seguenti: sorgenti, cattura, gestione, comunicazione, conversione, delivery, custom
10. Per funnel con percorsi paralleli, distribuisci i nodi simmetricamente (es. 2 nodi paralleli a x=-150 e x=150, 3 nodi a x=-300, x=0, x=300)

FORMATO OUTPUT — rispondi SOLO con JSON valido, senza markdown:
{
  "name": "Nome del funnel",
  "nodes": [
    { "id": "node_1", "type": "facebook_ads", "position": { "x": -150, "y": 0 }, "data": { "label": "Facebook Ads", "subtitle": "Campagna Meta Ads", "category": "sorgenti" } }
  ],
  "edges": [
    { "id": "edge_1_3", "source": "node_1", "target": "node_3" }
  ]
}`;

    const result = await trackedGenerateContent(provider.client, {
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: systemPrompt + "\n\nDescrizione del funnel dell'utente:\n" + prompt }] }
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      }
    }, {
      consultantId,
      feature: "funnel_generation",
      keySource: provider.keySource,
    });

    const text = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch);
    } catch {
      const extractMatch = jsonMatch.match(/\{[\s\S]*\}/);
      if (extractMatch) {
        parsed = JSON.parse(extractMatch[0]);
      } else {
        return res.status(500).json({ error: "L'AI non ha generato un JSON valido", raw: text });
      }
    }

    if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
      return res.status(500).json({ error: "Formato non valido: mancano i nodi" });
    }

    let academyLessonsByLessonId: Record<string, any> = {};
    try {
      const academyResult = await db.execute(sql`
        SELECT
          al.lesson_id as "lessonId",
          al.title,
          am.title as "moduleTitle",
          am.emoji as "moduleEmoji",
          al.config_link as "configLink",
          (SELECT COUNT(*)::int FROM academy_lesson_videos alv WHERE alv.lesson_id = al.id) as "videoCount"
        FROM academy_lessons al
        JOIN academy_modules am ON al.module_id = am.id
      `);
      for (const row of academyResult.rows as any[]) {
        academyLessonsByLessonId[row.lessonId] = row;
      }
    } catch (e) {
      console.error("[Funnel] Academy lessons fetch for auto-linking:", e);
    }

    const validCategories = ["sorgenti", "cattura", "gestione", "comunicazione", "conversione", "delivery", "custom"];

    const nodes = parsed.nodes.map((n: any) => {
      const nodeType = n.type || "custom_step";
      const rawCategory = n.data?.category;
      const category = validCategories.includes(rawCategory) ? rawCategory : getCategoryForType(nodeType);

      const mappedLessonIds = NODE_TYPE_ACADEMY_MAP[nodeType] || [];
      const academyLessons = mappedLessonIds
        .map((lid: string) => academyLessonsByLessonId[lid])
        .filter(Boolean)
        .map((l: any) => ({
          lessonId: l.lessonId,
          title: l.title,
          moduleTitle: l.moduleTitle,
          moduleEmoji: l.moduleEmoji,
          configLink: l.configLink,
          videoCount: l.videoCount || 0,
        }));

      return {
      id: n.id || `node_${Math.random().toString(36).substr(2, 9)}`,
      type: "funnelNode",
      position: n.position || { x: 0, y: 0 },
      data: {
        nodeType,
        type: nodeType,
        category,
        label: n.data?.label || n.label || "Step",
        subtitle: n.data?.subtitle || n.subtitle || "",
        notes: n.data?.notes || "",
        conversionRate: n.data?.conversionRate || null,
        linkedEntity: null,
        linkedEntities: [],
        academyLessons: academyLessons.length > 0 ? academyLessons : undefined,
      },
    };
    });

    const edges = (parsed.edges || []).map((e: any) => ({
      id: e.id || `edge_${Math.random().toString(36).substr(2, 9)}`,
      source: e.source,
      target: e.target,
      type: "funnelEdge",
      data: { label: e.label || e.data?.label || "" },
    }));

    res.json({
      name: parsed.name || "Funnel Generato",
      nodes,
      edges,
    });
  } catch (error: any) {
    console.error("[Funnel] Generate error:", error);
    res.status(500).json({ error: "Errore nella generazione AI del funnel" });
  }
});


export async function generateFunnelFromReport(consultantId: string, sessionId: string): Promise<{ funnelId: string; name: string; nodes: any[]; edges: any[] }> {
  const existingFunnel = await db.execute(sql`
    SELECT id FROM consultant_funnels
    WHERE delivery_session_id = ${sessionId} AND consultant_id = ${consultantId}
    LIMIT 1
  `);
  if (existingFunnel.rows.length > 0) {
    const existing = existingFunnel.rows[0] as any;
    return { funnelId: existing.id, name: "existing", nodes: [], edges: [] };
  }

  const sessionRes = await db.execute(sql`
    SELECT * FROM delivery_agent_sessions
    WHERE id = ${sessionId}::uuid AND consultant_id = ${consultantId}
  `);
  if (sessionRes.rows.length === 0) throw new Error("Session non trovata");
  const session = sessionRes.rows[0] as any;

  const messagesRes = await db.execute(sql`
    SELECT role, content FROM delivery_agent_messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `);
  const conversationText = (messagesRes.rows as any[])
    .map(m => `${m.role === 'assistant' ? 'Luca' : 'Cliente'}: ${m.content}`)
    .join('\n\n');

  const reportRes = await db.execute(sql`
    SELECT report_json FROM delivery_agent_reports
    WHERE session_id = ${sessionId}
    ORDER BY created_at DESC LIMIT 1
  `);
  if (reportRes.rows.length === 0) throw new Error("Report non trovato per questa sessione");
  const reportJson = (reportRes.rows[0] as any).report_json;

  const catalogRes = await db.execute(sql`
    SELECT id, name, description, price_cents, billing_type, is_active
    FROM service_catalog_items
    WHERE consultant_id = ${consultantId} AND is_active = true
    ORDER BY created_at DESC
  `);
  const serviceCatalog = catalogRes.rows;

  const clientProfile = session.client_profile_json || {};
  const leadName = clientProfile.nome_attivita || clientProfile.nome || session.lead_name || "Cliente";

  const reportSummary = typeof reportJson === 'string' ? reportJson : JSON.stringify(reportJson, null, 2);

  const catalogText = serviceCatalog.length > 0
    ? serviceCatalog.map((s: any) => `- ${s.name}: ${s.description || ''} (${s.price_cents ? (s.price_cents / 100).toFixed(2) + '€' : 'prezzo da definire'}, ${s.billing_type || 'una tantum'})`).join('\n')
    : 'Catalogo non ancora configurato';

  const reportFunnelPrompt = `Sei Leonardo, l'architetto dei funnel di Orbitale. Devi generare un funnel di vendita PERSONALIZZATO per un cliente specifico basandoti su tre fonti di dati.

${NODE_TYPES_SCHEMA}

${SUBTITLE_SUGGESTIONS}

FONTI DATI:

=== 1. CONVERSAZIONE DISCOVERY (tra Luca e il cliente) ===
${conversationText.slice(0, 12000)}

=== 2. REPORT STRATEGICO GENERATO ===
${reportSummary.slice(0, 15000)}

=== 3. CATALOGO SERVIZI DEL CONSULENTE ===
${catalogText}

=== PROFILO CLIENTE ===
${JSON.stringify(clientProfile, null, 2)}

ISTRUZIONI PER LA GENERAZIONE DEL FUNNEL:

1. Analizza il report: guarda i "pacchetti_consigliati" e la "roadmap" per capire quale percorso è stato progettato per questo cliente
2. Mappa i pacchetti ai nodi del funnel:
   - Se c'è un pacchetto Hunter/Setter → aggiungi nodi crm_hunter e/o setter_ai
   - Se c'è un pacchetto Content/Social → aggiungi nodi organici e/o ads
   - Se c'è un pacchetto Voice/Email → aggiungi nodi comunicazione appropriati
   - Se c'è un pacchetto Booking/Payment → aggiungi nodi conversione
3. Il funnel deve seguire la struttura standard: SORGENTI → CATTURA → GESTIONE → COMUNICAZIONE → CONVERSIONE → DELIVERY
4. Personalizza i label e subtitle usando il nome del cliente ("${leadName}") e dettagli specifici emersi dalla discovery
5. Includi SOLO i nodi che hanno senso per questo cliente (non tutti i tipi disponibili)
6. Il primo nodo "onboarding" è il Lead Magnet AI (la discovery con Luca che è appena avvenuta)
7. Se nel catalogo servizi del consulente ci sono servizi specifici, mappa i nodi di delivery/pagamento a quelli

REGOLE POSIZIONAMENTO:
- Primo nodo a y=0, ogni livello successivo ~180px più in basso
- Rami paralleli sulla stessa Y con X diversi (distanza ~300px)
- Tipicamente 8-15 nodi per un funnel completo

FORMATO OUTPUT — rispondi SOLO con JSON valido, senza markdown:
{
  "name": "Funnel Personalizzato per ${leadName}",
  "description": "Percorso strategico generato dalla discovery con Luca",
  "nodes": [
    { "id": "node_1", "type": "lead_magnet", "position": { "x": 0, "y": 0 }, "data": { "label": "Discovery Gratuita", "subtitle": "Onboarding con Luca AI", "category": "cattura" } }
  ],
  "edges": [
    { "id": "edge_1_2", "source": "node_1", "target": "node_2" }
  ]
}`;

  const provider = await getAIProvider(consultantId);
  if (!provider?.client) {
    throw new Error("Provider AI non disponibile");
  }

  console.log(`[Funnel] Generating funnel from report — session: ${sessionId}, lead: ${leadName}, catalog: ${serviceCatalog.length} services`);

  const result = await trackedGenerateContent(provider.client, {
    model: "gemini-2.5-flash",
    contents: [
      { role: "user", parts: [{ text: reportFunnelPrompt }] }
    ],
    config: {
      temperature: 0.5,
      maxOutputTokens: 8192,
    }
  }, {
    consultantId,
    feature: "funnel_from_report",
    keySource: provider.keySource,
  });

  const text = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const jsonMatch = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch);
  } catch {
    const extractMatch = jsonMatch.match(/\{[\s\S]*\}/);
    if (extractMatch) {
      parsed = JSON.parse(extractMatch[0]);
    } else {
      throw new Error("L'AI non ha generato un JSON valido");
    }
  }

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error("Formato non valido: mancano i nodi");
  }

  let academyLessonsByLessonId: Record<string, any> = {};
  try {
    const academyResult = await db.execute(sql`
      SELECT
        al.lesson_id as "lessonId",
        al.title,
        am.title as "moduleTitle",
        am.emoji as "moduleEmoji",
        al.config_link as "configLink",
        (SELECT COUNT(*)::int FROM academy_lesson_videos alv WHERE alv.lesson_id = al.id) as "videoCount"
      FROM academy_lessons al
      JOIN academy_modules am ON al.module_id = am.id
    `);
    for (const row of academyResult.rows as any[]) {
      academyLessonsByLessonId[row.lessonId] = row;
    }
  } catch (e) {
    console.error("[Funnel] Academy lessons fetch for report auto-linking:", e);
  }

  const validCategories = ["sorgenti", "cattura", "gestione", "comunicazione", "conversione", "delivery", "custom"];

  const nodes = parsed.nodes.map((n: any) => {
    const nodeType = n.type || "custom_step";
    const rawCategory = n.data?.category;
    const category = validCategories.includes(rawCategory) ? rawCategory : getCategoryForType(nodeType);

    const mappedLessonIds = NODE_TYPE_ACADEMY_MAP[nodeType] || [];
    const academyLessons = mappedLessonIds
      .map((lid: string) => academyLessonsByLessonId[lid])
      .filter(Boolean)
      .map((l: any) => ({
        lessonId: l.lessonId,
        title: l.title,
        moduleTitle: l.moduleTitle,
        moduleEmoji: l.moduleEmoji,
        configLink: l.configLink,
        videoCount: l.videoCount || 0,
      }));

    return {
      id: n.id || `node_${Math.random().toString(36).substr(2, 9)}`,
      type: "funnelNode",
      position: n.position || { x: 0, y: 0 },
      data: {
        nodeType,
        type: nodeType,
        category,
        label: n.data?.label || n.label || "Step",
        subtitle: n.data?.subtitle || n.subtitle || "",
        notes: n.data?.notes || "",
        conversionRate: n.data?.conversionRate || null,
        linkedEntity: null,
        linkedEntities: [],
        academyLessons: academyLessons.length > 0 ? academyLessons : undefined,
      },
    };
  });

  const edges = (parsed.edges || []).map((e: any) => ({
    id: e.id || `edge_${Math.random().toString(36).substr(2, 9)}`,
    source: e.source,
    target: e.target,
    type: "funnelEdge",
    data: { label: e.label || e.data?.label || "" },
  }));

  const funnelName = parsed.name || `Funnel per ${leadName}`;
  const funnelDesc = parsed.description || `Percorso strategico personalizzato generato dalla discovery con Luca`;

  const insertResult = await db.execute(sql`
    INSERT INTO consultant_funnels (consultant_id, name, description, nodes_data, edges_data, theme, delivery_session_id, source, lead_name)
    VALUES (
      ${consultantId},
      ${funnelName},
      ${funnelDesc},
      ${JSON.stringify(nodes)}::jsonb,
      ${JSON.stringify(edges)}::jsonb,
      ${"orbitale"},
      ${sessionId},
      ${"delivery_report"},
      ${leadName}
    )
    ON CONFLICT (consultant_id, delivery_session_id) WHERE delivery_session_id IS NOT NULL
    DO UPDATE SET updated_at = NOW()
    RETURNING id
  `);

  const funnelId = (insertResult.rows[0] as any).id;

  try {
    await db.execute(sql`
      INSERT INTO consultant_funnel_versions
        (funnel_id, consultant_id, version_number, label, source, nodes_data, edges_data, funnel_name)
      VALUES
        (${funnelId}, ${consultantId}, 1, ${'Generato da report'}, ${'auto_generate'},
         ${JSON.stringify(nodes)}::jsonb, ${JSON.stringify(edges)}::jsonb, ${funnelName})
    `);
  } catch (vErr) {
    console.warn("[Funnel] Could not save initial version snapshot:", vErr);
  }

  console.log(`[Funnel] Generated funnel from report — id: ${funnelId}, nodes: ${nodes.length}, edges: ${edges.length}, lead: ${leadName}`);

  return { funnelId, name: funnelName, nodes, edges };
}

router.post("/generate-from-report", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "Session ID richiesto" });

    const result = await generateFunnelFromReport(consultantId, sessionId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[Funnel] Generate from report error:", error);
    res.status(500).json({ error: error.message || "Errore nella generazione del funnel dal report" });
  }
});

router.get("/by-session/:sessionId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, name, description, source, lead_name, created_at
      FROM consultant_funnels
      WHERE delivery_session_id = ${req.params.sessionId} AND consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) return res.status(404).json({ error: "Nessun funnel trovato per questa sessione" });
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[Funnel] By-session error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/academy-lessons", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        al.id,
        al.lesson_id as "lessonId",
        al.title,
        am.title as "moduleTitle",
        am.emoji as "moduleEmoji",
        al.config_link as "configLink",
        (SELECT COUNT(*)::int FROM academy_lesson_videos alv WHERE alv.lesson_id = al.id) as "videoCount"
      FROM academy_lessons al
      JOIN academy_modules am ON al.module_id = am.id
      ORDER BY am.sort_order, al.sort_order
    `);

    res.json({ lessons: result.rows, nodeTypeMap: NODE_TYPE_ACADEMY_MAP });
  } catch (error: any) {
    console.error("[Funnel] Entities/academy-lessons error:", error);
    res.json({ lessons: [], nodeTypeMap: {} });
  }
});

router.get("/entities/posts", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const platform = req.query.platform as string | undefined;

    let result;
    if (platform) {
      result = await db.execute(sql`
        SELECT id, title as name, platform, content_type as "contentType", image_url as "imageUrl", hook, body, full_copy as "fullCopy", cta, status,
               scheduled_at as "scheduledAt", published_at as "publishedAt"
        FROM content_posts
        WHERE consultant_id = ${consultantId} AND LOWER(platform) = LOWER(${platform})
        ORDER BY created_at DESC
        LIMIT 50
      `);
    } else {
      result = await db.execute(sql`
        SELECT id, title as name, platform, content_type as "contentType", image_url as "imageUrl", hook, body, full_copy as "fullCopy", cta, status,
               scheduled_at as "scheduledAt", published_at as "publishedAt"
        FROM content_posts
        WHERE consultant_id = ${consultantId}
        ORDER BY created_at DESC
        LIMIT 50
      `);
    }

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/posts error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/referral-config", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, COALESCE(headline, 'Pagina Referral') as name, headline, description, bonus_text as "bonusText", profile_image_url as "profileImageUrl",
             preferred_channel as "preferredChannel", is_active as "isActive",
             cta_button_text as "ctaText"
      FROM referral_landing_config
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/referral-config error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/optin-config", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, COALESCE(headline, 'Pagina Optin') as name, headline, description, profile_image_url as "profileImageUrl",
             preferred_channel as "preferredChannel", is_active as "isActive",
             cta_button_text as "ctaText"
      FROM optin_landing_config
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/optin-config error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/lead-magnet", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT cas.id, 'Lead Magnet AI' as name, cas.booking_slug as "bookingSlug",
             cas.booking_page_enabled as "bookingPageEnabled",
             CASE WHEN rlc.id IS NOT NULL THEN true ELSE false END as "hasLeadMagnet"
      FROM consultant_availability_settings cas
      LEFT JOIN referral_landing_config rlc ON rlc.consultant_id = cas.consultant_id AND rlc.is_active = true
      WHERE cas.consultant_id = ${consultantId}
      LIMIT 1
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/lead-magnet error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/hunter-searches", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, query as name, location, results_count as "resultCount",
             status, created_at as "createdAt"
      FROM lead_scraper_searches
      WHERE consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 30
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/hunter-searches error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/ai-employees", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const settingsResult = await db.execute(sql`
      SELECT enabled_roles as "enabledRoles"
      FROM ai_autonomy_settings
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    const enabledRoles: Record<string, boolean> = (settingsResult.rows[0] as any)?.enabledRoles || {};

    const employees = AI_ROLE_DEFINITIONS.map(role => ({
      id: role.id,
      name: role.displayName,
      roleName: role.name,
      accentColor: role.accentColor,
      shortDescription: role.shortDescription,
      isEnabled: enabledRoles[role.id] === true,
    }));

    res.json(employees);
  } catch (error: any) {
    console.error("[Funnel] Entities/ai-employees error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/email-accounts", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, email_address as name, display_name as "displayName", provider,
             account_type as "accountType", is_active as "isActive"
      FROM email_accounts
      WHERE consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/email-accounts error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/booking", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, COALESCE('Prenotazione – ' || booking_slug, 'Prenotazione') as name,
             booking_slug as "bookingSlug", booking_page_enabled as "bookingPageEnabled",
             appointment_duration as "appointmentDuration"
      FROM consultant_availability_settings
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/booking error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/campaigns", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, campaign_name as name, campaign_type as "campaignType", lead_category as "leadCategory", hook_text as "hookText",
             total_leads as "totalLeads", converted_leads as "convertedLeads", conversion_rate as "conversionRate", is_active as "isActive"
      FROM marketing_campaigns
      WHERE consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/campaigns error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/agents", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, agent_name as name, agent_type as "agentType", twilio_whatsapp_number as "phoneNumber",
             business_name as "businessName", is_active as "isActive"
      FROM consultant_whatsapp_config
      WHERE consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/agents error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/nurturing-config", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, consultant_id, send_hour as "sendHour", 
             CASE WHEN enabled THEN 'active' ELSE 'disabled' END as status
      FROM lead_nurturing_config
      WHERE consultant_id = ${consultantId}
      LIMIT 1
    `);

    const entities = result.rows.map((r: any) => ({
      id: r.id,
      name: "Nurturing Lead 365",
      isActive: r.status === "active",
      extra: { sendHour: r.sendHour },
    }));

    res.json(entities);
  } catch (error: any) {
    res.json([]);
  }
});

router.get("/entities/email-journey-config", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT sc.id, sc.automation_enabled as "automationEnabled"
      FROM smtp_configurations sc
      WHERE sc.consultant_id = ${consultantId}
      LIMIT 1
    `);

    const entities = result.rows.map((r: any) => ({
      id: r.id || consultantId,
      name: "Email Journey",
      isActive: r.automationEnabled === true,
    }));

    if (entities.length === 0) {
      entities.push({ id: consultantId, name: "Email Journey", isActive: false });
    }

    res.json(entities);
  } catch (error: any) {
    res.json([]);
  }
});

router.get("/entities/voice-numbers", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, phone_number as "phoneNumber", display_name as name, ai_mode as "aiMode", is_active as "isActive"
      FROM voice_numbers
      WHERE consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/voice error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/services", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, name, price_cents as "priceCents", billing_type as "billingType", is_active as "isActive"
      FROM service_catalog_items
      WHERE consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/services error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, name, description, is_active, source, lead_name, delivery_session_id, created_at, updated_at
      FROM consultant_funnels
      WHERE consultant_id = ${consultantId}
      ORDER BY updated_at DESC
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] List error:", error);
    res.status(500).json({ error: "Errore nel recupero dei funnel" });
  }
});

router.post("/", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const { name, description, nodes_data, edges_data, theme } = req.body;

    const result = await db.execute(sql`
      INSERT INTO consultant_funnels (consultant_id, name, description, nodes_data, edges_data, theme)
      VALUES (
        ${consultantId},
        ${name || "Nuovo Funnel"},
        ${description || null},
        ${JSON.stringify(nodes_data || [])}::jsonb,
        ${JSON.stringify(edges_data || [])}::jsonb,
        ${theme || "classico"}
      )
      RETURNING *
    `);

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[Funnel] Create error:", error);
    res.status(500).json({ error: "Errore nella creazione del funnel" });
  }
});

router.get("/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT * FROM consultant_funnels
      WHERE id = ${req.params.id} AND consultant_id = ${consultantId}
      LIMIT 1
    `);

    if (result.rows.length === 0) return res.status(404).json({ error: "Funnel non trovato" });
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[Funnel] Get error:", error);
    res.status(500).json({ error: "Errore nel recupero del funnel" });
  }
});

router.get("/:id/versions", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT
        id, version_number, label, source, funnel_name, created_at,
        jsonb_array_length(COALESCE(nodes_data, '[]'::jsonb)) as node_count,
        jsonb_array_length(COALESCE(edges_data, '[]'::jsonb)) as edge_count
      FROM consultant_funnel_versions
      WHERE funnel_id = ${req.params.id} AND consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 30
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Versions error:", error);
    res.status(500).json({ error: "Errore nel recupero delle versioni" });
  }
});

router.post("/:id/restore/:versionId", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const versionResult = await db.execute(sql`
      SELECT * FROM consultant_funnel_versions
      WHERE id = ${req.params.versionId} AND funnel_id = ${req.params.id} AND consultant_id = ${consultantId}
      LIMIT 1
    `);

    if (versionResult.rows.length === 0) return res.status(404).json({ error: "Versione non trovata" });
    const version = versionResult.rows[0] as any;

    const currentResult = await db.execute(sql`
      SELECT * FROM consultant_funnels
      WHERE id = ${req.params.id} AND consultant_id = ${consultantId}
      LIMIT 1
    `);
    if (currentResult.rows.length === 0) return res.status(404).json({ error: "Funnel non trovato" });
    const current = currentResult.rows[0] as any;

    const maxVer = await db.execute(sql`
      SELECT COALESCE(MAX(version_number), 0) as max_ver
      FROM consultant_funnel_versions
      WHERE funnel_id = ${req.params.id}
    `);
    const nextVersion = ((maxVer.rows[0] as any)?.max_ver || 0) + 1;

    await db.execute(sql`
      INSERT INTO consultant_funnel_versions
        (funnel_id, consultant_id, version_number, label, source, nodes_data, edges_data, funnel_name)
      VALUES
        (${req.params.id}, ${consultantId}, ${nextVersion},
         ${'Snapshot pre-ripristino v' + version.version_number}, 'restore',
         ${JSON.stringify(current.nodes_data || [])}::jsonb,
         ${JSON.stringify(current.edges_data || [])}::jsonb,
         ${current.name})
    `);

    const updated = await db.execute(sql`
      UPDATE consultant_funnels
      SET nodes_data = ${JSON.stringify(version.nodes_data || [])}::jsonb,
          edges_data = ${JSON.stringify(version.edges_data || [])}::jsonb,
          updated_at = NOW()
      WHERE id = ${req.params.id} AND consultant_id = ${consultantId}
      RETURNING *
    `);

    res.json({ success: true, funnel: updated.rows[0], restoredVersion: version.version_number });
  } catch (error: any) {
    console.error("[Funnel] Restore error:", error);
    res.status(500).json({ error: "Errore nel ripristino del funnel" });
  }
});

router.put("/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const { name, description, nodes_data, edges_data, theme } = req.body;

    const currentResult = await db.execute(sql`
      SELECT nodes_data, edges_data, name FROM consultant_funnels
      WHERE id = ${req.params.id} AND consultant_id = ${consultantId}
      LIMIT 1
    `);

    if (currentResult.rows.length > 0) {
      const current = currentResult.rows[0] as any;
      const maxVer = await db.execute(sql`
        SELECT COALESCE(MAX(version_number), 0) as max_ver
        FROM consultant_funnel_versions
        WHERE funnel_id = ${req.params.id}
      `);
      const nextVersion = ((maxVer.rows[0] as any)?.max_ver || 0) + 1;

      await db.execute(sql`
        INSERT INTO consultant_funnel_versions
          (funnel_id, consultant_id, version_number, source, nodes_data, edges_data, funnel_name)
        VALUES
          (${req.params.id}, ${consultantId}, ${nextVersion}, 'manual',
           ${JSON.stringify(current.nodes_data || [])}::jsonb,
           ${JSON.stringify(current.edges_data || [])}::jsonb,
           ${current.name})
      `);

      await db.execute(sql`
        DELETE FROM consultant_funnel_versions
        WHERE funnel_id = ${req.params.id}
          AND id NOT IN (
            SELECT id FROM consultant_funnel_versions
            WHERE funnel_id = ${req.params.id}
            ORDER BY created_at DESC
            LIMIT 30
          )
      `);
    }

    const result = await db.execute(sql`
      UPDATE consultant_funnels
      SET
        name = COALESCE(${name || null}, name),
        description = COALESCE(${description !== undefined ? description : null}, description),
        nodes_data = COALESCE(${nodes_data !== undefined ? JSON.stringify(nodes_data) : null}::jsonb, nodes_data),
        edges_data = COALESCE(${edges_data !== undefined ? JSON.stringify(edges_data) : null}::jsonb, edges_data),
        theme = COALESCE(${theme || null}, theme),
        updated_at = NOW()
      WHERE id = ${req.params.id} AND consultant_id = ${consultantId}
      RETURNING *
    `);

    if (result.rows.length === 0) return res.status(404).json({ error: "Funnel non trovato" });
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[Funnel] Update error:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento del funnel" });
  }
});

router.delete("/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      DELETE FROM consultant_funnels
      WHERE id = ${req.params.id} AND consultant_id = ${consultantId}
      RETURNING id
    `);

    if (result.rows.length === 0) return res.status(404).json({ error: "Funnel non trovato" });
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Funnel] Delete error:", error);
    res.status(500).json({ error: "Errore nella cancellazione del funnel" });
  }
});

function getCategoryForType(type: string): string {
  const categoryMap: Record<string, string> = {
    facebook_ads: "sorgenti", google_ads: "sorgenti", instagram_ads: "sorgenti",
    tiktok_ads: "sorgenti", offline_referral: "sorgenti", organic: "sorgenti",
    landing_page: "cattura", form_modulo: "cattura", lead_magnet: "cattura", webhook: "cattura",
    import_excel: "gestione", crm_hunter: "gestione", setter_ai: "gestione",
    whatsapp: "comunicazione", email: "comunicazione", voice_call: "comunicazione",
    sms: "comunicazione", instagram_dm: "comunicazione",
    nurturing_lead365: "comunicazione", email_journey: "comunicazione",
    appuntamento: "conversione", prima_call: "conversione", seconda_call: "conversione",
    chiusura: "conversione", pagamento: "conversione",
    onboarding: "delivery", servizio: "delivery", followup: "delivery",
    custom_step: "custom",
  };
  return categoryMap[type] || "custom";
}

export default router;
