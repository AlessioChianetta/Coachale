import express, { Router, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../db";
import { users, bronzeUsers, clientLevelSubscriptions, consultantLicenses } from "@shared/schema";
import { eq, and, ne, sql, ilike, or, count } from "drizzle-orm";
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
      // Validate and parse Level 2 prices (Silver) - Minimo €49/mese
      if (pricingPageConfig.level2MonthlyPriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level2MonthlyPriceCents);
        if (isNaN(price) || price < 4900) {
          return res.status(400).json({ 
            error: "Il prezzo mensile Silver deve essere almeno €49" 
          });
        }
        pricingPageConfig.level2MonthlyPriceCents = price;
      }
      
      if (pricingPageConfig.level2YearlyPriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level2YearlyPriceCents);
        if (isNaN(price) || price < 49000) { // €490 minimo annuale Silver
          return res.status(400).json({ 
            error: "Il prezzo annuale Silver deve essere almeno €490" 
          });
        }
        pricingPageConfig.level2YearlyPriceCents = price;
      }
      
      // Validate and parse Level 3 prices (Gold) - Minimo €99/mese, €990/anno
      if (pricingPageConfig.level3MonthlyPriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level3MonthlyPriceCents);
        if (isNaN(price) || price < 9900) {
          return res.status(400).json({ 
            error: "Il prezzo mensile Gold deve essere almeno €99" 
          });
        }
        pricingPageConfig.level3MonthlyPriceCents = price;
      }
      
      if (pricingPageConfig.level3YearlyPriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level3YearlyPriceCents);
        if (isNaN(price) || price < 99000) { // €990 minimo annuale Gold
          return res.status(400).json({ 
            error: "Il prezzo annuale Gold deve essere almeno €990" 
          });
        }
        pricingPageConfig.level3YearlyPriceCents = price;
      }
      
      // Backwards compatibility - also validate old price fields with new minimums
      if (pricingPageConfig.level2PriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level2PriceCents);
        if (!isNaN(price) && price >= 4900) {
          pricingPageConfig.level2PriceCents = price;
        }
      }
      
      if (pricingPageConfig.level3PriceCents !== undefined) {
        const price = parseInt(pricingPageConfig.level3PriceCents);
        if (!isNaN(price) && price >= 9900) {
          pricingPageConfig.level3PriceCents = price;
        }
      }
      
      // Validate Level 1 monthly message limit (max 100 messaggi/mese)
      if (pricingPageConfig.level1DailyMessageLimit !== undefined) {
        const limit = parseInt(pricingPageConfig.level1DailyMessageLimit);
        if (!isNaN(limit) && limit >= 1 && limit <= 100) {
          pricingPageConfig.level1DailyMessageLimit = limit;
        } else if (limit > 100) {
          pricingPageConfig.level1DailyMessageLimit = 100; // max 100 al mese
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

// GET /api/consultant/pricing/users/bronze - Lista utenti Bronze (Level 1)
router.get("/consultant/pricing/users/bronze", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = (req.query.search as string) || "";
    const offset = (page - 1) * limit;

    let whereCondition = eq(bronzeUsers.consultantId, consultantId);
    
    if (search) {
      whereCondition = and(
        eq(bronzeUsers.consultantId, consultantId),
        or(
          ilike(bronzeUsers.email, `%${search}%`),
          ilike(bronzeUsers.firstName, `%${search}%`),
          ilike(bronzeUsers.lastName, `%${search}%`)
        )
      )!;
    }

    const [bronzeUsersList, totalResult] = await Promise.all([
      db.select({
        id: bronzeUsers.id,
        email: bronzeUsers.email,
        firstName: bronzeUsers.firstName,
        lastName: bronzeUsers.lastName,
        dailyMessagesUsed: bronzeUsers.dailyMessagesUsed,
        dailyMessageLimit: bronzeUsers.dailyMessageLimit,
        lastMessageResetAt: bronzeUsers.lastMessageResetAt,
        createdAt: bronzeUsers.createdAt,
        lastLoginAt: bronzeUsers.lastLoginAt,
        isActive: bronzeUsers.isActive,
      })
        .from(bronzeUsers)
        .where(whereCondition)
        .orderBy(bronzeUsers.createdAt)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() })
        .from(bronzeUsers)
        .where(whereCondition)
    ]);

    res.json({
      users: bronzeUsersList,
      total: totalResult[0]?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
    });
  } catch (error) {
    console.error("[Consultant Pricing] Get bronze users error:", error);
    res.status(500).json({ error: "Failed to get bronze users" });
  }
});

// GET /api/consultant/pricing/users/silver - Lista utenti Argento (Level 2)
router.get("/consultant/pricing/users/silver", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const silverUsers = await db.select({
      id: clientLevelSubscriptions.id,
      clientEmail: clientLevelSubscriptions.clientEmail,
      clientName: clientLevelSubscriptions.clientName,
      status: clientLevelSubscriptions.status,
      startDate: clientLevelSubscriptions.startDate,
      endDate: clientLevelSubscriptions.endDate,
      stripeSubscriptionId: clientLevelSubscriptions.stripeSubscriptionId,
      clientId: clientLevelSubscriptions.clientId,
      paymentSource: clientLevelSubscriptions.paymentSource,
    })
      .from(clientLevelSubscriptions)
      .where(
        and(
          eq(clientLevelSubscriptions.consultantId, consultantId),
          eq(clientLevelSubscriptions.level, "2")
        )
      )
      .orderBy(clientLevelSubscriptions.createdAt);

    const totalResult = await db.select({ count: count() })
      .from(clientLevelSubscriptions)
      .where(
        and(
          eq(clientLevelSubscriptions.consultantId, consultantId),
          eq(clientLevelSubscriptions.level, "2")
        )
      );

    res.json({
      users: silverUsers,
      total: totalResult[0]?.count || 0,
    });
  } catch (error) {
    console.error("[Consultant Pricing] Get silver users error:", error);
    res.status(500).json({ error: "Failed to get silver users" });
  }
});

// GET /api/consultant/pricing/users/gold - Lista utenti Oro (Level 3)
router.get("/consultant/pricing/users/gold", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const goldUsers = await db.select({
      id: clientLevelSubscriptions.id,
      clientEmail: clientLevelSubscriptions.clientEmail,
      clientName: clientLevelSubscriptions.clientName,
      status: clientLevelSubscriptions.status,
      startDate: clientLevelSubscriptions.startDate,
      endDate: clientLevelSubscriptions.endDate,
      stripeSubscriptionId: clientLevelSubscriptions.stripeSubscriptionId,
      clientId: clientLevelSubscriptions.clientId,
      paymentSource: clientLevelSubscriptions.paymentSource,
    })
      .from(clientLevelSubscriptions)
      .where(
        and(
          eq(clientLevelSubscriptions.consultantId, consultantId),
          eq(clientLevelSubscriptions.level, "3")
        )
      )
      .orderBy(clientLevelSubscriptions.createdAt);

    const totalResult = await db.select({ count: count() })
      .from(clientLevelSubscriptions)
      .where(
        and(
          eq(clientLevelSubscriptions.consultantId, consultantId),
          eq(clientLevelSubscriptions.level, "3")
        )
      );

    res.json({
      users: goldUsers,
      total: totalResult[0]?.count || 0,
    });
  } catch (error) {
    console.error("[Consultant Pricing] Get gold users error:", error);
    res.status(500).json({ error: "Failed to get gold users" });
  }
});

// GET /api/consultant/pricing/users/stats - Statistiche aggregate
router.get("/consultant/pricing/users/stats", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const [bronzeTotal, bronzeActive, silverTotal, silverActive, goldTotal, goldActive] = await Promise.all([
      db.select({ count: count() })
        .from(bronzeUsers)
        .where(eq(bronzeUsers.consultantId, consultantId)),
      db.select({ count: count() })
        .from(bronzeUsers)
        .where(and(eq(bronzeUsers.consultantId, consultantId), eq(bronzeUsers.isActive, true))),
      db.select({ count: count() })
        .from(clientLevelSubscriptions)
        .where(and(eq(clientLevelSubscriptions.consultantId, consultantId), eq(clientLevelSubscriptions.level, "2"))),
      db.select({ count: count() })
        .from(clientLevelSubscriptions)
        .where(and(
          eq(clientLevelSubscriptions.consultantId, consultantId),
          eq(clientLevelSubscriptions.level, "2"),
          eq(clientLevelSubscriptions.status, "active")
        )),
      db.select({ count: count() })
        .from(clientLevelSubscriptions)
        .where(and(eq(clientLevelSubscriptions.consultantId, consultantId), eq(clientLevelSubscriptions.level, "3"))),
      db.select({ count: count() })
        .from(clientLevelSubscriptions)
        .where(and(
          eq(clientLevelSubscriptions.consultantId, consultantId),
          eq(clientLevelSubscriptions.level, "3"),
          eq(clientLevelSubscriptions.status, "active")
        )),
    ]);

    res.json({
      bronze: {
        total: bronzeTotal[0]?.count || 0,
        active: bronzeActive[0]?.count || 0,
      },
      silver: {
        total: silverTotal[0]?.count || 0,
        active: silverActive[0]?.count || 0,
      },
      gold: {
        total: goldTotal[0]?.count || 0,
        active: goldActive[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error("[Consultant Pricing] Get stats error:", error);
    res.status(500).json({ error: "Failed to get user stats" });
  }
});

// DELETE /api/consultant/pricing/users/bronze/:id - Elimina utente Bronze
router.delete("/consultant/pricing/users/bronze/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const bronzeUserId = req.params.id;

    const [bronzeUser] = await db.select()
      .from(bronzeUsers)
      .where(and(eq(bronzeUsers.id, bronzeUserId), eq(bronzeUsers.consultantId, consultantId)));

    if (!bronzeUser) {
      return res.status(404).json({ error: "Utente Bronze non trovato o non autorizzato" });
    }

    await db.delete(bronzeUsers).where(eq(bronzeUsers.id, bronzeUserId));

    await db.update(consultantLicenses)
      .set({
        level1Used: sql`GREATEST(${consultantLicenses.level1Used} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(consultantLicenses.consultantId, consultantId));

    res.json({ success: true, message: "Utente Bronze eliminato con successo" });
  } catch (error) {
    console.error("[Consultant Pricing] Delete bronze user error:", error);
    res.status(500).json({ error: "Failed to delete bronze user" });
  }
});

// POST /api/consultant/pricing/users/bronze/:id/reset-password - Reset password utente Bronze
router.post("/consultant/pricing/users/bronze/:id/reset-password", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const bronzeUserId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "La password deve essere di almeno 6 caratteri" });
    }

    const [bronzeUser] = await db.select()
      .from(bronzeUsers)
      .where(and(eq(bronzeUsers.id, bronzeUserId), eq(bronzeUsers.consultantId, consultantId)));

    if (!bronzeUser) {
      return res.status(404).json({ error: "Utente Bronze non trovato o non autorizzato" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.update(bronzeUsers)
      .set({ passwordHash })
      .where(eq(bronzeUsers.id, bronzeUserId));

    res.json({ success: true, message: "Password aggiornata con successo" });
  } catch (error) {
    console.error("[Consultant Pricing] Reset bronze password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// POST /api/consultant/pricing/users/silver/:id/reset-password - Reset password utente Silver
router.post("/consultant/pricing/users/silver/:id/reset-password", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const subscriptionId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "La password deve essere di almeno 6 caratteri" });
    }

    const [subscription] = await db.select()
      .from(clientLevelSubscriptions)
      .where(and(
        eq(clientLevelSubscriptions.id, subscriptionId),
        eq(clientLevelSubscriptions.consultantId, consultantId),
        eq(clientLevelSubscriptions.level, "2")
      ));

    if (!subscription) {
      return res.status(404).json({ error: "Sottoscrizione Silver non trovata o non autorizzata" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.update(clientLevelSubscriptions)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(clientLevelSubscriptions.id, subscriptionId));

    res.json({ success: true, message: "Password aggiornata con successo" });
  } catch (error) {
    console.error("[Consultant Pricing] Reset silver password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;
