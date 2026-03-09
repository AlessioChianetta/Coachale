import { Router, Response } from "express";
import { authenticateToken, requireAnyRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { getAIProvider, trackedGenerateContent } from "../ai/provider-factory";

const router = Router();

function getConsultantId(req: AuthRequest): string | null {
  const user = req.user;
  if (!user) return null;
  if (user.role === "super_admin") {
    return (req.query.consultant_id as string) || (req.body?.consultant_id as string) || user.id;
  }
  return user.id;
}

const NODE_TYPES_SCHEMA = `
Available node types (use ONLY these exact type values):
SORGENTI TRAFFICO: facebook_ads, google_ads, instagram_ads, tiktok_ads, offline_referral, organic
CATTURA: landing_page, form_modulo, lead_magnet, webhook
GESTIONE LEAD: import_excel, crm_hunter, setter_ai
COMUNICAZIONE: whatsapp, email, voice_call, sms, instagram_dm
CONVERSIONE: appuntamento, prima_call, seconda_call, chiusura, pagamento
DELIVERY: onboarding, servizio, followup
CUSTOM: custom_step
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

REGOLE:
1. Ogni nodo deve avere: id (stringa univoca tipo "node_1"), type (dal tipo sopra), position (oggetto con x e y), data (oggetto con label e subtitle opzionale)
2. Ogni edge deve avere: id (stringa univoca tipo "edge_1_2"), source (id nodo sorgente), target (id nodo destinazione)
3. Posiziona i nodi in un flusso dall'alto verso il basso. Il primo nodo parte a y=0. Ogni livello successivo è ~180px più in basso
4. Se ci sono rami paralleli (es. Facebook Ads E Google Ads), mettili sulla stessa riga Y ma con X diversi (distanza ~300px)
5. Se due nodi convergono verso un unico nodo successivo, crea edge da entrambi
6. Usa label in italiano, brevi e descrittive
7. Il campo data.label è il titolo del nodo (es. "Facebook Ads", "Landing Page", "Setter AI WhatsApp")
8. Il campo data.subtitle è opzionale, breve (es. "Campagna traffico", "Modulo contatto")

FORMATO OUTPUT — rispondi SOLO con JSON valido, senza markdown:
{
  "name": "Nome del funnel",
  "nodes": [
    { "id": "node_1", "type": "facebook_ads", "position": { "x": 0, "y": 0 }, "data": { "label": "Facebook Ads", "subtitle": "Campagna traffico" } }
  ],
  "edges": [
    { "id": "edge_1_2", "source": "node_1", "target": "node_2" }
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

    const nodes = parsed.nodes.map((n: any) => ({
      id: n.id || `node_${Math.random().toString(36).substr(2, 9)}`,
      type: "funnelNode",
      position: n.position || { x: 0, y: 0 },
      data: {
        nodeType: n.type || "custom_step",
        type: n.type || "custom_step",
        category: getCategoryForType(n.type || "custom_step"),
        label: n.data?.label || n.label || "Step",
        subtitle: n.data?.subtitle || n.subtitle || "",
        notes: n.data?.notes || "",
        conversionRate: n.data?.conversionRate || null,
        linkedEntity: null,
      },
    }));

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

router.get("/entities/ads", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, campaign_name as name, objective, image_url as "imageUrl", primary_text as "primaryText", headline,
             platform, status, spend, impressions, clicks, leads, ctr, cpl,
             start_date as "startDate", end_date as "endDate"
      FROM ad_campaigns
      WHERE consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/ads error:", error);
    res.status(500).json({ error: "Errore" });
  }
});

router.get("/entities/posts", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = getConsultantId(req);
    if (!consultantId) return res.status(400).json({ error: "Consultant ID non trovato" });

    const result = await db.execute(sql`
      SELECT id, title as name, platform, content_type as "contentType", image_url as "imageUrl", hook, status,
             scheduled_at as "scheduledAt", published_at as "publishedAt"
      FROM content_posts
      WHERE consultant_id = ${consultantId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error("[Funnel] Entities/posts error:", error);
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
      SELECT id, agent_name as name, agent_type as "agentType", twilio_whatsapp_number as "twilioWhatsappNumber",
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
