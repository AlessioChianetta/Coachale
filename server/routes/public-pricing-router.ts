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

    const availableAgents = agents.filter(a => a.level === "1" || a.level === "2" || a.level === "3");
    if (availableAgents.length === 0) {
      return res.status(404).json({ error: "Nessun agente disponibile" });
    }

    const config = consultant.pricingPageConfig as any || {};
    
    // Calculate prices with backwards compatibility - use proper decimal conversion
    const centsToEuros = (cents: number) => Number((cents / 100).toFixed(2));
    
    const level2MonthlyPrice = config.level2MonthlyPriceCents 
      ? centsToEuros(config.level2MonthlyPriceCents) 
      : (config.level2PriceCents ? centsToEuros(config.level2PriceCents) : 29);
    
    const level2YearlyPrice = config.level2YearlyPriceCents 
      ? centsToEuros(config.level2YearlyPriceCents) 
      : Number((level2MonthlyPrice * 10).toFixed(2));
    
    const level3MonthlyPrice = config.level3MonthlyPriceCents 
      ? centsToEuros(config.level3MonthlyPriceCents) 
      : (config.level3PriceCents ? centsToEuros(config.level3PriceCents) : Number((level2MonthlyPrice * 2).toFixed(2)));
    
    const level3YearlyPrice = config.level3YearlyPriceCents 
      ? centsToEuros(config.level3YearlyPriceCents) 
      : Number((level3MonthlyPrice * 10).toFixed(2));

    // Build comprehensive pricing response
    const pricing = {
      // Hero Section
      heroTitle: config.heroTitle || null,
      heroSubtitle: config.heroSubtitle || null,
      heroBadgeText: config.heroBadgeText || null,
      
      // Level 1 (Bronze - Free)
      level1Name: config.level1Name || "Bronze",
      level1Description: config.level1Description || "Per iniziare a scoprire il tuo assistente AI",
      level1DailyMessageLimit: config.level1DailyMessageLimit || 15,
      level1Features: config.level1Features || [
        "Messaggi limitati al giorno",
        "Accesso senza registrazione",
        "Risposte AI immediate",
        "Disponibile 24/7"
      ],
      
      // Level 2 (Silver)
      level2Name: config.level2Name || "Argento",
      level2Description: config.level2Description || "Per chi vuole il massimo dal proprio assistente",
      level2ShortDescription: config.level2ShortDescription || null,
      level2MonthlyPrice,
      level2YearlyPrice,
      level2Features: config.level2Features || [
        "Messaggi illimitati",
        "Tutto del piano Bronze",
        "Accesso alla Knowledge Base",
        "Risposte personalizzate avanzate",
        "Storico conversazioni salvato"
      ],
      level2Badge: config.level2Badge || "Più Popolare",
      level2CtaText: config.level2CtaText || "Inizia Ora",
      
      // Level 3 (Gold)
      level3Name: config.level3Name || "Oro",
      level3Description: config.level3Description || "Per professionisti che vogliono tutto",
      level3ShortDescription: config.level3ShortDescription || null,
      level3MonthlyPrice,
      level3YearlyPrice,
      level3Features: config.level3Features || [
        "Accesso completo al software",
        "Tutto del piano Argento",
        "AI Manager dedicato",
        "Dashboard personale completa",
        "Supporto VIP prioritario",
        "Integrazioni avanzate"
      ],
      level3Badge: config.level3Badge || "Premium",
      level3CtaText: config.level3CtaText || "Acquista Premium",
      
      // Visual
      accentColor: config.accentColor || null,
      logoUrl: config.logoUrl || null,
      backgroundStyle: config.backgroundStyle || "gradient",
      
      // FAQs
      faqs: config.faqs || [],
      
      // Testimonials
      testimonials: config.testimonials || [],
      
      // Trust Badges
      trustBadges: config.trustBadges || [],
      
      // Guarantee
      guaranteeEnabled: config.guaranteeEnabled || false,
      guaranteeDays: config.guaranteeDays || 30,
      guaranteeText: config.guaranteeText || "Soddisfatti o rimborsati",
      
      // Footer
      footerText: config.footerText || null,
      contactEmail: config.contactEmail || null,
      termsUrl: config.termsUrl || null,
      privacyUrl: config.privacyUrl || null,
      
      // Comparison Table
      showComparisonTable: config.showComparisonTable !== false,
      comparisonFeatures: config.comparisonFeatures || [],
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
