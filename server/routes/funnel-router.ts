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
COMUNICAZIONE: whatsapp, email, voice_call, sms, instagram_dm
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
- landing_page/webhook/sms/instagram_dm/import_excel/prima_call/seconda_call/chiusura/custom_step → Configurazione manuale
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
- custom_step → "Step personalizzato"
`;

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

    const validCategories = ["sorgenti", "cattura", "gestione", "comunicazione", "conversione", "delivery", "custom"];

    const nodes = parsed.nodes.map((n: any) => {
      const nodeType = n.type || "custom_step";
      const rawCategory = n.data?.category;
      const category = validCategories.includes(rawCategory) ? rawCategory : getCategoryForType(nodeType);
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


router.get("/entities/posts", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const platform = req.query.platform as string | undefined;

    let result;
    if (platform) {
      result = await db.execute(sql`
        SELECT id, title as name, platform, content_type as "contentType", image_url as "imageUrl", hook, status,
               scheduled_at as "scheduledAt", published_at as "publishedAt"
        FROM content_posts
        WHERE consultant_id = ${consultantId} AND LOWER(platform) = LOWER(${platform})
        ORDER BY created_at DESC
        LIMIT 50
      `);
    } else {
      result = await db.execute(sql`
        SELECT id, title as name, platform, content_type as "contentType", image_url as "imageUrl", hook, status,
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
      SELECT id, name, description, is_active, created_at, updated_at
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

    const { name, description, nodes_data, edges_data } = req.body;

    const result = await db.execute(sql`
      INSERT INTO consultant_funnels (consultant_id, name, description, nodes_data, edges_data)
      VALUES (
        ${consultantId},
        ${name || "Nuovo Funnel"},
        ${description || null},
        ${JSON.stringify(nodes_data || [])}::jsonb,
        ${JSON.stringify(edges_data || [])}::jsonb
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

router.put("/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const { name, description, nodes_data, edges_data } = req.body;

    const result = await db.execute(sql`
      UPDATE consultant_funnels
      SET
        name = COALESCE(${name || null}, name),
        description = COALESCE(${description !== undefined ? description : null}, description),
        nodes_data = COALESCE(${nodes_data ? JSON.stringify(nodes_data) : null}::jsonb, nodes_data),
        edges_data = COALESCE(${edges_data ? JSON.stringify(edges_data) : null}::jsonb, edges_data),
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
    appuntamento: "conversione", prima_call: "conversione", seconda_call: "conversione",
    chiusura: "conversione", pagamento: "conversione",
    onboarding: "delivery", servizio: "delivery", followup: "delivery",
    custom_step: "custom",
  };
  return categoryMap[type] || "custom";
}

export default router;
