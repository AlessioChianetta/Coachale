import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, or, sql } from "drizzle-orm";
import { bronzeUsers, consultantLicenses, users } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendWelcomeEmail } from "../services/welcome-email-service";

const router = Router();

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("[BRONZE AUTH] JWT_SECRET or SESSION_SECRET environment variable is required");
  }
  return secret;
};

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "30d";

interface BronzeAuthRequest extends Request {
  bronzeUser?: {
    bronzeUserId: string;
    consultantId: string;
    email: string;
    type: "bronze";
  };
}

function isNewDay(lastResetAt: Date | null): boolean {
  if (!lastResetAt) return true;
  const now = new Date();
  const lastReset = new Date(lastResetAt);
  return now.toDateString() !== lastReset.toDateString();
}

async function authenticateBronzeToken(req: BronzeAuthRequest, res: Response, next: Function) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token di accesso richiesto" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      bronzeUserId: string;
      consultantId: string;
      email: string;
      type: string;
    };

    if (decoded.type !== "bronze") {
      return res.status(401).json({ error: "Token non valido per utenti Bronze" });
    }

    req.bronzeUser = {
      bronzeUserId: decoded.bronzeUserId,
      consultantId: decoded.consultantId,
      email: decoded.email,
      type: "bronze",
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Token non valido o scaduto" });
  }
}

router.post("/:slug/register", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e password sono obbligatori" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Formato email non valido" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La password deve essere di almeno 6 caratteri" });
    }

    const [consultant] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, "consultant"),
          or(eq(users.pricingPageSlug, slug), eq(users.username, slug))
        )
      )
      .limit(1);

    if (!consultant) {
      return res.status(404).json({ error: "Consulente non trovato" });
    }

    const [existingUser] = await db
      .select({ id: bronzeUsers.id })
      .from(bronzeUsers)
      .where(
        and(
          eq(bronzeUsers.consultantId, consultant.id),
          eq(bronzeUsers.email, email.toLowerCase())
        )
      )
      .limit(1);

    if (existingUser) {
      return res.status(409).json({ error: "Email già registrata per questo consulente" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [newBronzeUser] = await db
      .insert(bronzeUsers)
      .values({
        consultantId: consultant.id,
        email: email.toLowerCase(),
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        dailyMessagesUsed: 0,
        dailyMessageLimit: 15,
        isActive: true,
      })
      .returning();

    await db
      .insert(consultantLicenses)
      .values({
        consultantId: consultant.id,
        level1Used: 1,
      })
      .onConflictDoUpdate({
        target: consultantLicenses.consultantId,
        set: {
          level1Used: sql`COALESCE(${consultantLicenses.level1Used}, 0) + 1`,
        },
      });

    const token = jwt.sign(
      {
        bronzeUserId: newBronzeUser.id,
        consultantId: consultant.id,
        email: newBronzeUser.email,
        type: "bronze",
      },
      getJwtSecret(),
      { expiresIn: TOKEN_EXPIRY }
    );

    // Send welcome email with credentials (async, don't block response)
    sendWelcomeEmail({
      consultantId: consultant.id,
      recipientEmail: email.toLowerCase(),
      recipientName: firstName || email.split('@')[0],
      password: password,
      tier: "bronze",
    }).catch(err => {
      console.error("[BRONZE AUTH] Failed to send welcome email:", err);
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newBronzeUser.id,
        email: newBronzeUser.email,
        firstName: newBronzeUser.firstName,
        lastName: newBronzeUser.lastName,
        dailyMessagesUsed: newBronzeUser.dailyMessagesUsed,
        dailyMessageLimit: newBronzeUser.dailyMessageLimit,
      },
    });
  } catch (error: any) {
    console.error("[BRONZE AUTH] Register error:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

router.post("/:slug/login", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e password sono obbligatori" });
    }

    const [consultant] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, "consultant"),
          or(eq(users.pricingPageSlug, slug), eq(users.username, slug))
        )
      )
      .limit(1);

    if (!consultant) {
      return res.status(404).json({ error: "Consulente non trovato" });
    }

    const [bronzeUser] = await db
      .select()
      .from(bronzeUsers)
      .where(
        and(
          eq(bronzeUsers.consultantId, consultant.id),
          eq(bronzeUsers.email, email.toLowerCase())
        )
      )
      .limit(1);

    if (!bronzeUser) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    if (!bronzeUser.isActive) {
      return res.status(403).json({ error: "Account disattivato" });
    }

    const validPassword = await bcrypt.compare(password, bronzeUser.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    let dailyMessagesUsed = bronzeUser.dailyMessagesUsed;
    const updates: { lastLoginAt: Date; dailyMessagesUsed?: number; lastMessageResetAt?: Date } = {
      lastLoginAt: new Date(),
    };

    if (isNewDay(bronzeUser.lastMessageResetAt)) {
      updates.dailyMessagesUsed = 0;
      updates.lastMessageResetAt = new Date();
      dailyMessagesUsed = 0;
    }

    await db
      .update(bronzeUsers)
      .set(updates)
      .where(eq(bronzeUsers.id, bronzeUser.id));

    const token = jwt.sign(
      {
        bronzeUserId: bronzeUser.id,
        consultantId: consultant.id,
        email: bronzeUser.email,
        type: "bronze",
      },
      getJwtSecret(),
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
      success: true,
      token,
      user: {
        id: bronzeUser.id,
        email: bronzeUser.email,
        firstName: bronzeUser.firstName,
        lastName: bronzeUser.lastName,
        dailyMessagesUsed,
        dailyMessageLimit: bronzeUser.dailyMessageLimit,
      },
    });
  } catch (error: any) {
    console.error("[BRONZE AUTH] Login error:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

router.get("/me", authenticateBronzeToken, async (req: BronzeAuthRequest, res: Response) => {
  try {
    const { bronzeUserId } = req.bronzeUser!;

    const [bronzeUser] = await db
      .select()
      .from(bronzeUsers)
      .where(eq(bronzeUsers.id, bronzeUserId))
      .limit(1);

    if (!bronzeUser) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    if (!bronzeUser.isActive) {
      return res.status(403).json({ error: "Account disattivato" });
    }

    let dailyMessagesUsed = bronzeUser.dailyMessagesUsed;
    if (isNewDay(bronzeUser.lastMessageResetAt)) {
      await db
        .update(bronzeUsers)
        .set({ dailyMessagesUsed: 0, lastMessageResetAt: new Date() })
        .where(eq(bronzeUsers.id, bronzeUserId));
      dailyMessagesUsed = 0;
    }

    res.json({
      id: bronzeUser.id,
      email: bronzeUser.email,
      firstName: bronzeUser.firstName,
      lastName: bronzeUser.lastName,
      consultantId: bronzeUser.consultantId,
      dailyMessagesUsed,
      dailyMessageLimit: bronzeUser.dailyMessageLimit,
      isActive: bronzeUser.isActive,
      createdAt: bronzeUser.createdAt,
      lastLoginAt: bronzeUser.lastLoginAt,
    });
  } catch (error: any) {
    console.error("[BRONZE AUTH] Me error:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

router.post("/increment-message", authenticateBronzeToken, async (req: BronzeAuthRequest, res: Response) => {
  try {
    const { bronzeUserId } = req.bronzeUser!;

    const [bronzeUser] = await db
      .select()
      .from(bronzeUsers)
      .where(eq(bronzeUsers.id, bronzeUserId))
      .limit(1);

    if (!bronzeUser) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    if (!bronzeUser.isActive) {
      return res.status(403).json({ error: "Account disattivato", allowed: false, remaining: 0 });
    }

    let dailyMessagesUsed = bronzeUser.dailyMessagesUsed;
    let shouldReset = isNewDay(bronzeUser.lastMessageResetAt);

    if (shouldReset) {
      dailyMessagesUsed = 0;
    }

    if (dailyMessagesUsed >= bronzeUser.dailyMessageLimit) {
      return res.json({
        allowed: false,
        remaining: 0,
        dailyMessagesUsed,
        dailyMessageLimit: bronzeUser.dailyMessageLimit,
      });
    }

    const newCount = dailyMessagesUsed + 1;
    const remaining = Math.max(0, bronzeUser.dailyMessageLimit - newCount);

    const updateData: { dailyMessagesUsed: number; lastMessageResetAt?: Date } = {
      dailyMessagesUsed: newCount,
    };

    if (shouldReset) {
      updateData.lastMessageResetAt = new Date();
    }

    await db
      .update(bronzeUsers)
      .set(updateData)
      .where(eq(bronzeUsers.id, bronzeUserId));

    res.json({
      allowed: true,
      remaining,
      dailyMessagesUsed: newCount,
      dailyMessageLimit: bronzeUser.dailyMessageLimit,
    });
  } catch (error: any) {
    console.error("[BRONZE AUTH] Increment message error:", error);
    res.status(500).json({ error: "Errore interno del server", allowed: false, remaining: 0 });
  }
});

export default router;
