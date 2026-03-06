import { Router, Response } from "express";
import { db } from "../db";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { serviceCatalogItems, clientPurchasedItems, users, consultantLicenses, superadminStripeConfig } from "../../shared/schema";
import { AuthRequest, authenticateToken, requireAnyRole } from "../middleware/auth";
import { getAIProvider, GEMINI_3_MODEL, getModelWithThinking } from "../ai/provider-factory";
import { decrypt } from "../encryption";

const router = Router();

router.get("/consultant/catalog", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const items = await db
      .select()
      .from(serviceCatalogItems)
      .where(eq(serviceCatalogItems.consultantId, consultantId))
      .orderBy(asc(serviceCatalogItems.sortOrder), desc(serviceCatalogItems.createdAt));
    res.json({ success: true, data: items });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] GET catalog error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/consultant/catalog", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const {
      name, description, shortDescription, icon, category, itemType,
      bundleItems, priceCents, originalPriceCents, currency, billingType,
      paymentMode, stripePriceId, stripeDirectLink, featuresUnlocked,
      isActive, isFeatured, sortOrder, badgeText,
    } = req.body;

    if (!name) return res.status(400).json({ success: false, error: "name is required" });

    const [item] = await db.insert(serviceCatalogItems).values({
      consultantId,
      name,
      description: description || null,
      shortDescription: shortDescription || null,
      icon: icon || "📦",
      category: category || "other",
      itemType: itemType || "single",
      bundleItems: bundleItems || null,
      priceCents: priceCents ?? 0,
      originalPriceCents: originalPriceCents ?? null,
      currency: currency || "eur",
      billingType: billingType || "monthly",
      paymentMode: paymentMode || "connect",
      stripePriceId: stripePriceId || null,
      stripeDirectLink: stripeDirectLink || null,
      featuresUnlocked: featuresUnlocked || [],
      isActive: isActive ?? true,
      isFeatured: isFeatured ?? false,
      sortOrder: sortOrder ?? 0,
      badgeText: badgeText || null,
    }).returning();

    console.log(`[SERVICE-CATALOG] Created item "${name}" for consultant ${consultantId}`);
    res.json({ success: true, data: item });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] POST catalog error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/consultant/catalog/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;

    const [existing] = await db.select().from(serviceCatalogItems)
      .where(and(eq(serviceCatalogItems.id, id), eq(serviceCatalogItems.consultantId, consultantId)));
    if (!existing) return res.status(404).json({ success: false, error: "Item not found" });

    const updateData: any = { updatedAt: new Date() };
    const allowedFields = [
      "name", "description", "shortDescription", "icon", "category", "itemType",
      "bundleItems", "priceCents", "originalPriceCents", "currency", "billingType",
      "paymentMode", "stripePriceId", "stripeDirectLink", "featuresUnlocked",
      "isActive", "isFeatured", "sortOrder", "badgeText",
    ];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const [updated] = await db.update(serviceCatalogItems)
      .set(updateData)
      .where(and(eq(serviceCatalogItems.id, id), eq(serviceCatalogItems.consultantId, consultantId)))
      .returning();

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] PUT catalog error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/consultant/catalog/:id", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;

    const [updated] = await db.update(serviceCatalogItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(serviceCatalogItems.id, id), eq(serviceCatalogItems.consultantId, consultantId)))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: "Item not found" });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] DELETE catalog error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch("/consultant/catalog/:id/toggle", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;

    const [existing] = await db.select().from(serviceCatalogItems)
      .where(and(eq(serviceCatalogItems.id, id), eq(serviceCatalogItems.consultantId, consultantId)));
    if (!existing) return res.status(404).json({ success: false, error: "Item not found" });

    const [updated] = await db.update(serviceCatalogItems)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(serviceCatalogItems.id, id))
      .returning();

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] PATCH toggle error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/consultant/catalog/reorder", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { items } = req.body;

    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: "items array required" });

    for (const item of items) {
      if (item.id && typeof item.sortOrder === "number") {
        await db.update(serviceCatalogItems)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(and(eq(serviceCatalogItems.id, item.id), eq(serviceCatalogItems.consultantId, consultantId)));
      }
    }

    res.json({ success: true, message: "Reorder completed" });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] PUT reorder error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const AI_SYSTEM_PROMPT = `Sei un esperto di marketing e vendita di servizi digitali per consulenti italiani.
La piattaforma offre questi servizi/moduli che il consulente può vendere ai suoi clienti:
- AI Receptionist (centralino AI per rispondere alle chiamate)
- WhatsApp AI Agent (assistente AI su WhatsApp per gestire clienti)
- Email Hub (gestione email intelligente con AI)
- Lead Scraper (ricerca e analisi lead con AI)
- Automazioni AI (task automatici, outreach, follow-up)
- Academy / Formazione (corsi, esercizi, percorsi formativi)
- Analytics & Dashboard (monitoraggio KPI, engagement)
- Content Studio (creazione contenuti social con AI)
- Voice AI (chiamate outbound/inbound con AI)
- CRM Intelligente (gestione clienti e pipeline)

Quando generi prodotti/servizi:
- Usa nomi accattivanti e professionali in italiano
- Scrivi descrizioni che vendono, evidenziando i benefici per il cliente finale
- Suggerisci prezzi realistici per il mercato italiano (tra 29€ e 499€/mese)
- Scegli la categoria più appropriata tra: ai, marketing, automation, communication, analytics, other
- Scegli un'emoji rappresentativa come icona
- Il billing_type può essere: one_time, monthly, yearly
- Rispondi SEMPRE in formato JSON valido`;

router.post("/consultant/catalog/ai-generate", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ success: false, error: "prompt is required" });

    const provider = await getAIProvider(consultantId);
    if (provider.setFeature) provider.setFeature("service-catalog-ai", "consultant");

    const { model } = getModelWithThinking(provider.metadata?.providerName);

    const result = await provider.client.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: `Genera un prodotto/servizio completo basato su questa richiesta del consulente:\n\n"${prompt}"\n\nRispondi con un JSON con questi campi:\n{\n  "name": "nome del prodotto",\n  "description": "descrizione dettagliata (2-3 paragrafi, evidenzia benefici)",\n  "short_description": "descrizione breve (max 100 caratteri)",\n  "icon": "emoji rappresentativa",\n  "category": "ai|marketing|automation|communication|analytics|other",\n  "price_cents": numero (prezzo in centesimi, es. 9900 = 99€),\n  "billing_type": "one_time|monthly|yearly"\n}\n\nRispondi SOLO con il JSON, senza testo aggiuntivo.` }],
        },
      ],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      systemInstruction: { role: "system", parts: [{ text: AI_SYSTEM_PROMPT }] },
    });

    const responseText = result.response.text();
    let parsed: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      return res.status(500).json({ success: false, error: "AI returned invalid JSON", raw: responseText });
    }

    res.json({
      success: true,
      data: {
        name: parsed.name || "",
        description: parsed.description || "",
        shortDescription: parsed.short_description || "",
        icon: parsed.icon || "📦",
        category: parsed.category || "other",
        priceCents: parsed.price_cents || 0,
        billingType: parsed.billing_type || "monthly",
      },
    });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] AI generate error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/consultant/catalog/ai-describe", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { name, category, priceCents } = req.body;

    if (!name) return res.status(400).json({ success: false, error: "name is required" });

    const priceEur = priceCents ? (priceCents / 100).toFixed(2) : "N/D";

    const provider = await getAIProvider(consultantId);
    if (provider.setFeature) provider.setFeature("service-catalog-ai", "consultant");

    const { model } = getModelWithThinking(provider.metadata?.providerName);

    const result = await provider.client.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: `Il consulente ha creato un prodotto con questi dati:\n- Nome: ${name}\n- Categoria: ${category || "other"}\n- Prezzo: €${priceEur}\n\nGenera una descrizione accattivante e una descrizione breve. Rispondi con un JSON:\n{\n  "description": "descrizione dettagliata (2-3 paragrafi, focalizzata sui benefici per il cliente)",\n  "short_description": "descrizione breve (max 100 caratteri)"\n}\n\nRispondi SOLO con il JSON, senza testo aggiuntivo.` }],
        },
      ],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      systemInstruction: { role: "system", parts: [{ text: AI_SYSTEM_PROMPT }] },
    });

    const responseText = result.response.text();
    let parsed: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      return res.status(500).json({ success: false, error: "AI returned invalid JSON", raw: responseText });
    }

    res.json({
      success: true,
      data: {
        description: parsed.description || "",
        shortDescription: parsed.short_description || "",
      },
    });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] AI describe error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function getStripeInstance() {
  const [config] = await db.select().from(superadminStripeConfig).limit(1);
  if (!config?.stripeSecretKey) throw new Error("Stripe not configured");
  let secretKey = config.stripeSecretKey;
  if (secretKey.includes(':')) {
    try { secretKey = decrypt(secretKey); } catch { }
  }
  const Stripe = (await import("stripe")).default;
  return new Stripe(secretKey, { apiVersion: "2024-12-18.acacia" as any });
}

router.post("/store/checkout/:itemId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { itemId } = req.params;

    const [item] = await db.select().from(serviceCatalogItems)
      .where(and(eq(serviceCatalogItems.id, itemId), eq(serviceCatalogItems.isActive, true)));

    if (!item) {
      return res.status(404).json({ success: false, error: "Item not found or inactive" });
    }

    if (item.paymentMode === "direct") {
      if (!item.stripeDirectLink) {
        return res.status(400).json({ success: false, error: "Direct link not configured for this item" });
      }
      return res.json({ success: true, redirectUrl: item.stripeDirectLink });
    }

    const sellerId = item.consultantId;
    const [license] = await db.select().from(consultantLicenses)
      .where(eq(consultantLicenses.consultantId, sellerId));

    if (!license?.stripeConnectAccountId || !license.stripeConnectOnboarded) {
      return res.status(400).json({ success: false, error: "Seller Stripe Connect not configured" });
    }

    const stripe = await getStripeInstance();
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";

    const revenueSharePercentage = license.revenueSharePercentage || 50;
    const applicationFeeAmount = Math.round(item.priceCents * revenueSharePercentage / 100);

    const [buyer] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));

    const commonMetadata = {
      type: "service_catalog_purchase",
      catalogItemId: item.id,
      buyerUserId: userId,
      sellerConsultantId: sellerId,
      itemName: item.name,
    };

    const isSubscription = item.billingType === "monthly" || item.billingType === "yearly";

    let session;
    if (isSubscription) {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: item.currency || "eur",
            product_data: {
              name: item.name,
              description: item.shortDescription || item.description || undefined,
            },
            unit_amount: item.priceCents,
            recurring: {
              interval: item.billingType === "yearly" ? "year" : "month",
            },
          },
          quantity: 1,
        }],
        subscription_data: {
          application_fee_percent: revenueSharePercentage,
          transfer_data: {
            destination: license.stripeConnectAccountId,
          },
          metadata: commonMetadata,
        },
        customer_email: buyer?.email || undefined,
        metadata: commonMetadata,
        success_url: `${baseUrl}/client/store?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/client/store?purchase=cancelled`,
      });
    } else {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: item.currency || "eur",
            product_data: {
              name: item.name,
              description: item.shortDescription || item.description || undefined,
            },
            unit_amount: item.priceCents,
          },
          quantity: 1,
        }],
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          transfer_data: {
            destination: license.stripeConnectAccountId,
          },
          metadata: commonMetadata,
        },
        customer_email: buyer?.email || undefined,
        metadata: commonMetadata,
        success_url: `${baseUrl}/client/store?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/client/store?purchase=cancelled`,
      });
    }

    console.log(`[SERVICE-CATALOG] Checkout session created for item "${item.name}" by user ${userId}`);
    res.json({ success: true, checkoutUrl: session.url });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] Checkout error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/store/my-purchases", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const purchases = await db
      .select({
        id: clientPurchasedItems.id,
        catalogItemId: clientPurchasedItems.catalogItemId,
        sellerConsultantId: clientPurchasedItems.sellerConsultantId,
        paymentMode: clientPurchasedItems.paymentMode,
        amountCents: clientPurchasedItems.amountCents,
        status: clientPurchasedItems.status,
        purchasedAt: clientPurchasedItems.purchasedAt,
        expiresAt: clientPurchasedItems.expiresAt,
        itemName: serviceCatalogItems.name,
        itemDescription: serviceCatalogItems.shortDescription,
        itemIcon: serviceCatalogItems.icon,
        itemCategory: serviceCatalogItems.category,
        itemBillingType: serviceCatalogItems.billingType,
      })
      .from(clientPurchasedItems)
      .innerJoin(serviceCatalogItems, eq(clientPurchasedItems.catalogItemId, serviceCatalogItems.id))
      .where(and(
        eq(clientPurchasedItems.buyerUserId, userId),
        eq(clientPurchasedItems.status, "active"),
      ))
      .orderBy(desc(clientPurchasedItems.purchasedAt));

    res.json({ success: true, data: purchases });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] GET my-purchases error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/consultant/catalog/sales", authenticateToken, requireAnyRole(["consultant", "super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const sales = await db
      .select({
        id: clientPurchasedItems.id,
        buyerUserId: clientPurchasedItems.buyerUserId,
        catalogItemId: clientPurchasedItems.catalogItemId,
        paymentMode: clientPurchasedItems.paymentMode,
        amountCents: clientPurchasedItems.amountCents,
        status: clientPurchasedItems.status,
        purchasedAt: clientPurchasedItems.purchasedAt,
        stripePaymentId: clientPurchasedItems.stripePaymentId,
        itemName: serviceCatalogItems.name,
        itemIcon: serviceCatalogItems.icon,
        itemCategory: serviceCatalogItems.category,
        buyerFirstName: users.firstName,
        buyerLastName: users.lastName,
        buyerEmail: users.email,
      })
      .from(clientPurchasedItems)
      .innerJoin(serviceCatalogItems, eq(clientPurchasedItems.catalogItemId, serviceCatalogItems.id))
      .innerJoin(users, eq(clientPurchasedItems.buyerUserId, users.id))
      .where(eq(clientPurchasedItems.sellerConsultantId, consultantId))
      .orderBy(desc(clientPurchasedItems.purchasedAt));

    const totalRevenue = sales.reduce((sum, s) => sum + (s.amountCents || 0), 0);
    const activeSales = sales.filter(s => s.status === "active").length;

    res.json({
      success: true,
      data: sales,
      summary: {
        totalSales: sales.length,
        activeSales,
        totalRevenueCents: totalRevenue,
      },
    });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] GET sales error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/store/catalog", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const [user] = await db.select({ consultantId: users.consultantId }).from(users).where(eq(users.id, userId));
    if (!user?.consultantId) {
      return res.json({ success: true, data: [] });
    }

    const items = await db
      .select()
      .from(serviceCatalogItems)
      .where(and(
        eq(serviceCatalogItems.consultantId, user.consultantId),
        eq(serviceCatalogItems.isActive, true),
      ))
      .orderBy(asc(serviceCatalogItems.sortOrder), desc(serviceCatalogItems.createdAt));

    res.json({ success: true, data: items });
  } catch (err: any) {
    console.error("[SERVICE-CATALOG] GET store catalog error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
