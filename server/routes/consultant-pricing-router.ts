import express, { Router, Response } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import { authenticateToken, AuthRequest, requireRole } from "../middleware/auth";

const router: Router = express.Router();

router.get("/consultant/pricing-page", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const [consultant] = await db.select({
      pricingPageSlug: users.pricingPageSlug,
      pricingPageConfig: users.pricingPageConfig,
    })
      .from(users)
      .where(eq(users.id, consultantId));
    
    if (!consultant) {
      return res.status(404).json({ error: "Consultant not found" });
    }
    
    res.json({
      pricingPageSlug: consultant.pricingPageSlug || "",
      pricingPageConfig: consultant.pricingPageConfig || {},
    });
  } catch (error) {
    console.error("[Consultant Pricing] Get error:", error);
    res.status(500).json({ error: "Failed to get pricing configuration" });
  }
});

router.post("/consultant/pricing-page", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { pricingPageSlug, pricingPageConfig } = req.body;
    
    if (pricingPageSlug !== undefined && pricingPageSlug !== null && pricingPageSlug !== "") {
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(pricingPageSlug)) {
        return res.status(400).json({ 
          error: "Lo slug deve contenere solo lettere minuscole, numeri e trattini" 
        });
      }
      
      if (pricingPageSlug.length < 3 || pricingPageSlug.length > 30) {
        return res.status(400).json({ 
          error: "Lo slug deve essere tra 3 e 30 caratteri" 
        });
      }
      
      const [existingSlug] = await db.select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.pricingPageSlug, pricingPageSlug),
            ne(users.id, consultantId)
          )
        );
      
      if (existingSlug) {
        return res.status(400).json({ 
          error: "Questo slug è già in uso da un altro consulente" 
        });
      }
    }
    
    if (pricingPageConfig) {
      // Validate and parse Level 2 prices
      if (pricingPageConfig.level2MonthlyPriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level2MonthlyPriceCents);
        if (isNaN(price) || price < 100) {
          return res.status(400).json({ 
            error: "Il prezzo mensile Level 2 deve essere almeno 1€" 
          });
        }
        pricingPageConfig.level2MonthlyPriceCents = price;
      }
      
      if (pricingPageConfig.level2YearlyPriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level2YearlyPriceCents);
        if (isNaN(price) || price < 100) {
          return res.status(400).json({ 
            error: "Il prezzo annuale Level 2 deve essere almeno 1€" 
          });
        }
        pricingPageConfig.level2YearlyPriceCents = price;
      }
      
      // Validate and parse Level 3 prices
      if (pricingPageConfig.level3MonthlyPriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level3MonthlyPriceCents);
        if (isNaN(price) || price < 100) {
          return res.status(400).json({ 
            error: "Il prezzo mensile Level 3 deve essere almeno 1€" 
          });
        }
        pricingPageConfig.level3MonthlyPriceCents = price;
      }
      
      if (pricingPageConfig.level3YearlyPriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level3YearlyPriceCents);
        if (isNaN(price) || price < 100) {
          return res.status(400).json({ 
            error: "Il prezzo annuale Level 3 deve essere almeno 1€" 
          });
        }
        pricingPageConfig.level3YearlyPriceCents = price;
      }
      
      // Backwards compatibility - also validate old price fields
      if (pricingPageConfig.level2PriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level2PriceCents);
        if (!isNaN(price) && price >= 100) {
          pricingPageConfig.level2PriceCents = price;
        }
      }
      
      if (pricingPageConfig.level3PriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level3PriceCents);
        if (!isNaN(price) && price >= 100) {
          pricingPageConfig.level3PriceCents = price;
        }
      }
      
      // Validate Level 1 daily message limit
      if (pricingPageConfig.level1DailyMessageLimit !== undefined) {
        const limit = parseInt(pricingPageConfig.level1DailyMessageLimit);
        if (!isNaN(limit) && limit >= 1) {
          pricingPageConfig.level1DailyMessageLimit = limit;
        } else {
          pricingPageConfig.level1DailyMessageLimit = 15; // default
        }
      }
      
      // Validate guarantee days
      if (pricingPageConfig.guaranteeDays !== undefined) {
        const days = parseInt(pricingPageConfig.guaranteeDays);
        if (!isNaN(days) && days >= 0) {
          pricingPageConfig.guaranteeDays = days;
        } else {
          pricingPageConfig.guaranteeDays = 30; // default
        }
      }
    }
    
    await db.update(users)
      .set({
        pricingPageSlug: pricingPageSlug || null,
        pricingPageConfig: pricingPageConfig || {},
      })
      .where(eq(users.id, consultantId));
    
    res.json({ 
      success: true, 
      message: "Configurazione prezzi salvata con successo" 
    });
  } catch (error) {
    console.error("[Consultant Pricing] Save error:", error);
    res.status(500).json({ error: "Failed to save pricing configuration" });
  }
});

router.get("/consultant/pricing-page/check-slug/:slug", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { slug } = req.params;
    
    if (!slug || slug.length < 3) {
      return res.json({ available: false, reason: "too_short" });
    }
    
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return res.json({ available: false, reason: "invalid_format" });
    }
    
    const [existingSlug] = await db.select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.pricingPageSlug, slug),
          ne(users.id, consultantId)
        )
      );
    
    res.json({ 
      available: !existingSlug,
      reason: existingSlug ? "taken" : null
    });
  } catch (error) {
    console.error("[Consultant Pricing] Check slug error:", error);
    res.status(500).json({ error: "Failed to check slug availability" });
  }
});

export default router;
