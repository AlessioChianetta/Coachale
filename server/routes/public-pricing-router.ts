import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, isNotNull, or } from "drizzle-orm";
import { users, consultantWhatsappConfig } from "@shared/schema";

const router = Router();

router.get("/:slug/pricing", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ error: "Slug is required" });
    }

    const [consultant] = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      pricingPageSlug: users.pricingPageSlug,
      pricingPageConfig: users.pricingPageConfig,
    })
      .from(users)
      .where(
        and(
          eq(users.role, "consultant"),
          or(
            eq(users.pricingPageSlug, slug),
            eq(users.username, slug)
          )
        )
      )
      .limit(1);

    if (!consultant) {
      return res.status(404).json({ error: "Consulente non trovato" });
    }

    const agents = await db.select({
      agentId: consultantWhatsappConfig.id,
      agentName: consultantWhatsappConfig.agentName,
      level: consultantWhatsappConfig.level,
      publicSlug: consultantWhatsappConfig.publicSlug,
      dailyMessageLimit: consultantWhatsappConfig.dailyMessageLimit,
      businessName: consultantWhatsappConfig.businessName,
      businessDescription: consultantWhatsappConfig.businessDescription,
    })
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.consultantId, consultant.id),
          isNotNull(consultantWhatsappConfig.level),
          eq(consultantWhatsappConfig.isActive, true)
        )
      );

    const level1Or2Agents = agents.filter(a => a.level === "1" || a.level === "2");
    if (level1Or2Agents.length === 0) {
      return res.status(404).json({ error: "Nessun agente disponibile" });
    }

    const config = consultant.pricingPageConfig || {};
    const pricing = {
      level2MonthlyPrice: config.level2PriceCents ? Math.floor(config.level2PriceCents / 100) : 29,
      level2YearlyPrice: config.level2PriceCents ? Math.floor((config.level2PriceCents * 10) / 100) : 290,
      level2Name: config.level2Name || "Livello Argento",
      level2Description: config.level2Description || "Per chi vuole il massimo dal proprio assistente",
      accentColor: config.accentColor || null,
      logoUrl: config.logoUrl || null,
    };

    res.json({
      consultantName: `${consultant.firstName} ${consultant.lastName}`.trim(),
      consultantSlug: consultant.pricingPageSlug || consultant.username,
      agents,
      pricing,
    });
  } catch (error: any) {
    console.error("[PUBLIC PRICING] Get pricing error:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

router.post("/:slug/checkout", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { email, agentId, level } = req.body;

    if (!email || !agentId || !level) {
      return res.status(400).json({ 
        success: false, 
        error: "Email, agentId e level sono obbligatori" 
      });
    }

    return res.json({
      success: false,
      message: "Integrazione Stripe in arrivo! Presto potrai acquistare questo piano.",
    });
  } catch (error: any) {
    console.error("[PUBLIC PRICING] Checkout error:", error);
    res.status(500).json({ success: false, error: "Errore interno del server" });
  }
});

export default router;
