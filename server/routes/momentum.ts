import { Router } from "express";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { 
  insertMomentumCheckinSchema, 
  insertMomentumGoalSchema,
  updateMomentumGoalSchema,
  insertMomentumSettingsSchema,
  updateMomentumSettingsSchema
} from "@shared/schema";

const router = Router();

// ==================== CHECK-INS API ====================

// Create check-in
router.post("/checkins", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    console.log("🔍 [CHECKIN] Received request body:", JSON.stringify(req.body, null, 2));
    console.log("🔍 [CHECKIN] User ID:", userId);
    
    const dataToValidate = {
      ...req.body,
      userId,
    };
    
    console.log("🔍 [CHECKIN] Data to validate:", JSON.stringify(dataToValidate, null, 2));
    
    const validatedData = insertMomentumCheckinSchema.parse(dataToValidate);
    
    console.log("✅ [CHECKIN] Validation passed:", JSON.stringify(validatedData, null, 2));
    
    const [checkin] = await db
      .insert(schema.momentumCheckins)
      .values(validatedData)
      .returning();

    console.log("✅ [CHECKIN] Successfully created checkin:", checkin.id);
    res.json(checkin);
  } catch (error: any) {
    console.error("❌ [CHECKIN] Validation/Creation error:", error);
    console.error("❌ [CHECKIN] Error details:", {
      message: error.message,
      issues: error.issues || error.errors,
      stack: error.stack
    });
    
    res.status(400).json({ 
      message: error.message || "Failed to create check-in",
      issues: error.issues || error.errors,
      receivedData: req.body
    });
  }
});

// Get check-ins with filters
router.get("/checkins", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { from, to, limit = "100" } = req.query;

    let query = db
      .select()
      .from(schema.momentumCheckins)
      .where(eq(schema.momentumCheckins.userId, userId))
      .orderBy(desc(schema.momentumCheckins.timestamp))
      .limit(parseInt(limit as string));

    // Apply date filters if provided
    if (from || to) {
      const conditions = [eq(schema.momentumCheckins.userId, userId)];
      
      if (from) {
        conditions.push(gte(schema.momentumCheckins.timestamp, new Date(from as string)));
      }
      if (to) {
        conditions.push(lte(schema.momentumCheckins.timestamp, new Date(to as string)));
      }

      query = db
        .select()
        .from(schema.momentumCheckins)
        .where(and(...conditions))
        .orderBy(desc(schema.momentumCheckins.timestamp))
        .limit(parseInt(limit as string));
    }

    const checkins = await query;
    res.json(checkins);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch check-ins" });
  }
});

// Get daily stats
router.get("/checkins/daily-stats", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    const startOfDay = new Date(date as string);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date as string);
    endOfDay.setHours(23, 59, 59, 999);

    const checkins = await db
      .select()
      .from(schema.momentumCheckins)
      .where(
        and(
          eq(schema.momentumCheckins.userId, userId),
          gte(schema.momentumCheckins.timestamp, startOfDay),
          lte(schema.momentumCheckins.timestamp, endOfDay)
        )
      );

    const totalCheckins = checkins.length;
    const productiveCheckins = checkins.filter(c => c.isProductive).length;
    const productivityScore = totalCheckins > 0 
      ? Math.round((productiveCheckins / totalCheckins) * 100) 
      : 0;

    // Categories breakdown
    const categoriesBreakdown: Record<string, number> = {};
    checkins.forEach(c => {
      if (c.category) {
        categoriesBreakdown[c.category] = (categoriesBreakdown[c.category] || 0) + 1;
      }
    });

    // Average mood and energy
    const moodValues = checkins.filter(c => c.mood !== null).map(c => c.mood!);
    const energyValues = checkins.filter(c => c.energyLevel !== null).map(c => c.energyLevel!);
    
    const averageMood = moodValues.length > 0
      ? moodValues.reduce((a, b) => a + b, 0) / moodValues.length
      : null;
    
    const averageEnergy = energyValues.length > 0
      ? energyValues.reduce((a, b) => a + b, 0) / energyValues.length
      : null;

    res.json({
      date,
      totalCheckins,
      productiveCheckins,
      productivityScore,
      categoriesBreakdown,
      averageMood: averageMood ? Math.round(averageMood * 10) / 10 : null,
      averageEnergy: averageEnergy ? Math.round(averageEnergy * 10) / 10 : null,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch daily stats" });
  }
});

// Get weekly stats
router.get("/checkins/weekly-stats", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { weekStart } = req.query;

    const startDate = weekStart 
      ? new Date(weekStart as string) 
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - d.getDay()); // Start of current week (Sunday)
          return d;
        })();

    const weeklyStats = [];

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayCheckins = await db
        .select()
        .from(schema.momentumCheckins)
        .where(
          and(
            eq(schema.momentumCheckins.userId, userId),
            gte(schema.momentumCheckins.timestamp, dayStart),
            lte(schema.momentumCheckins.timestamp, dayEnd)
          )
        );

      const totalCheckins = dayCheckins.length;
      const productiveCheckins = dayCheckins.filter(c => c.isProductive).length;
      const productivityScore = totalCheckins > 0 
        ? Math.round((productiveCheckins / totalCheckins) * 100) 
        : 0;

      weeklyStats.push({
        date: dayStart.toISOString().split('T')[0],
        totalCheckins,
        productiveCheckins,
        productivityScore,
      });
    }

    res.json(weeklyStats);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch weekly stats" });
  }
});

// Get current streak
router.get("/checkins/current-streak", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Check backwards from today
    while (true) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const productiveCheckins = await db
        .select()
        .from(schema.momentumCheckins)
        .where(
          and(
            eq(schema.momentumCheckins.userId, userId),
            eq(schema.momentumCheckins.isProductive, true),
            gte(schema.momentumCheckins.timestamp, dayStart),
            lte(schema.momentumCheckins.timestamp, dayEnd)
          )
        )
        .limit(1);

      if (productiveCheckins.length === 0) {
        break;
      }

      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    res.json({ streak });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch streak" });
  }
});

// Update check-in
router.patch("/checkins/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Verify ownership
    const existing = await db
      .select()
      .from(schema.momentumCheckins)
      .where(
        and(
          eq(schema.momentumCheckins.id, id),
          eq(schema.momentumCheckins.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Check-in not found" });
    }

    const [updated] = await db
      .update(schema.momentumCheckins)
      .set(req.body)
      .where(eq(schema.momentumCheckins.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to update check-in" });
  }
});

// Delete check-in
router.delete("/checkins/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await db
      .delete(schema.momentumCheckins)
      .where(
        and(
          eq(schema.momentumCheckins.id, id),
          eq(schema.momentumCheckins.userId, userId)
        )
      )
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ message: "Check-in not found" });
    }

    res.json({ message: "Check-in deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to delete check-in" });
  }
});

// ==================== GOALS API ====================

// Create goal
router.post("/goals", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const validatedData = insertMomentumGoalSchema.parse({
      ...req.body,
      userId,
    });

    const [goal] = await db
      .insert(schema.momentumGoals)
      .values(validatedData as any)
      .returning();

    res.json(goal);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to create goal" });
  }
});

// Get goals
router.get("/goals", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { status } = req.query;

    let query = db
      .select()
      .from(schema.momentumGoals)
      .where(eq(schema.momentumGoals.userId, userId))
      .orderBy(desc(schema.momentumGoals.createdAt));

    if (status) {
      query = db
        .select()
        .from(schema.momentumGoals)
        .where(
          and(
            eq(schema.momentumGoals.userId, userId),
            eq(schema.momentumGoals.status, status as any)
          )
        )
        .orderBy(desc(schema.momentumGoals.createdAt));
    }

    const goals = await query;
    res.json(goals);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch goals" });
  }
});

// Update goal
router.patch("/goals/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Verify ownership
    const existing = await db
      .select()
      .from(schema.momentumGoals)
      .where(
        and(
          eq(schema.momentumGoals.id, id),
          eq(schema.momentumGoals.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Goal not found" });
    }

    const [updated] = await db
      .update(schema.momentumGoals)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(schema.momentumGoals.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to update goal" });
  }
});

// Update goal progress (shortcut)
router.patch("/goals/:id/progress", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { progress } = req.body;

    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return res.status(400).json({ message: "Progress must be between 0 and 100" });
    }

    // Verify ownership
    const existing = await db
      .select()
      .from(schema.momentumGoals)
      .where(
        and(
          eq(schema.momentumGoals.id, id),
          eq(schema.momentumGoals.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Goal not found" });
    }

    // Auto-complete if progress is 100
    const status = progress === 100 ? 'completed' : existing[0].status;

    const [updated] = await db
      .update(schema.momentumGoals)
      .set({
        progress,
        status: status as any,
        updatedAt: new Date(),
      })
      .where(eq(schema.momentumGoals.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to update goal progress" });
  }
});

// Delete goal
router.delete("/goals/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await db
      .delete(schema.momentumGoals)
      .where(
        and(
          eq(schema.momentumGoals.id, id),
          eq(schema.momentumGoals.userId, userId)
        )
      )
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ message: "Goal not found" });
    }

    res.json({ message: "Goal deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to delete goal" });
  }
});

// ==================== SETTINGS API ====================

// Get settings
router.get("/settings", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    let settings = await db
      .select()
      .from(schema.momentumSettings)
      .where(eq(schema.momentumSettings.userId, userId))
      .limit(1);

    // Create default settings if none exist
    if (settings.length === 0) {
      const [newSettings] = await db
        .insert(schema.momentumSettings)
        .values({ userId })
        .returning();
      
      settings = [newSettings];
    }

    res.json(settings[0]);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch settings" });
  }
});

// Update settings
router.patch("/settings", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Check if settings exist
    const existing = await db
      .select()
      .from(schema.momentumSettings)
      .where(eq(schema.momentumSettings.userId, userId))
      .limit(1);

    let updated;

    if (existing.length === 0) {
      // Create new settings
      [updated] = await db
        .insert(schema.momentumSettings)
        .values({
          userId,
          ...req.body,
        })
        .returning();
    } else {
      // Update existing settings
      [updated] = await db
        .update(schema.momentumSettings)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(schema.momentumSettings.userId, userId))
        .returning();
    }

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to update settings" });
  }
});

export default router;
