import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { referralCodes, referrals, referralLandingConfig, optinLandingConfig, users, proactiveLeads } from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";

const router = Router();

function generateReferralCode(firstName: string): string {
  const namePart = firstName.toUpperCase().slice(0, 5).replace(/[^A-Z]/g, "");
  const randomPart = nanoid(4).toUpperCase();
  return `${namePart}-${randomPart}`;
}

// ===========================================
// REFERRAL CODES API
// ===========================================

// GET /api/referral/my-code - Get or generate user's referral code
router.get("/referral/my-code", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    let existingCode = await db.query.referralCodes.findFirst({
      where: eq(referralCodes.userId, userId),
    });

    if (!existingCode) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const consultantId = userRole === "consultant" ? userId : user.consultantId;
      if (!consultantId) {
        return res.status(400).json({ success: false, error: "No consultant associated" });
      }

      const code = generateReferralCode(user.firstName);
      const codeType = userRole === "consultant" ? "consultant" : "client";

      const [newCode] = await db.insert(referralCodes).values({
        userId,
        consultantId,
        code,
        codeType,
      }).returning();

      existingCode = newCode;
    }

    const consultant = await db.query.users.findFirst({
      where: eq(users.id, existingCode.consultantId),
      columns: { id: true, firstName: true, lastName: true, avatar: true },
    });

    const landingConfig = await db.query.referralLandingConfig.findFirst({
      where: eq(referralLandingConfig.consultantId, existingCode.consultantId),
    });

    res.json({
      success: true,
      code: existingCode.code,
      codeType: existingCode.codeType,
      isActive: existingCode.isActive,
      consultant: consultant ? {
        id: consultant.id,
        firstName: consultant.firstName,
        lastName: consultant.lastName,
        avatar: consultant.avatar,
      } : null,
      bonusText: landingConfig?.bonusText || "Consulenza gratuita",
      bonusValue: landingConfig?.bonusValue,
    });
  } catch (error: any) {
    console.error("[REFERRAL] Error getting code:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/referral/validate/:code - Validate a referral code (public)
router.get("/referral/validate/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const referralCode = await db.query.referralCodes.findFirst({
      where: and(
        eq(referralCodes.code, code.toUpperCase()),
        eq(referralCodes.isActive, true)
      ),
    });

    if (!referralCode) {
      return res.status(404).json({ success: false, valid: false, error: "Invalid or inactive code" });
    }

    const consultant = await db.query.users.findFirst({
      where: eq(users.id, referralCode.consultantId),
      columns: { id: true, firstName: true, lastName: true, avatar: true },
    });

    const referrer = await db.query.users.findFirst({
      where: eq(users.id, referralCode.userId),
      columns: { id: true, firstName: true, lastName: true },
    });

    res.json({
      success: true,
      valid: true,
      codeType: referralCode.codeType,
      consultant: consultant ? {
        id: consultant.id,
        firstName: consultant.firstName,
        lastName: consultant.lastName,
        avatar: consultant.avatar,
      } : null,
      referrer: referrer ? {
        firstName: referrer.firstName,
        lastName: referrer.lastName,
      } : null,
    });
  } catch (error: any) {
    console.error("[REFERRAL] Error validating code:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// CLIENT INVITES API
// ===========================================

const inviteSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(5),
  notes: z.string().optional(),
});

// POST /api/referral/invite - Client invites a friend
router.post("/referral/invite", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const validation = inviteSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.errors });
    }

    const { firstName, lastName, email, phone, notes } = validation.data;

    const userCode = await db.query.referralCodes.findFirst({
      where: eq(referralCodes.userId, userId),
    });

    if (!userCode) {
      return res.status(400).json({ success: false, error: "No referral code found. Please generate one first." });
    }

    const existingReferral = await db.query.referrals.findFirst({
      where: and(
        eq(referrals.friendEmail, email.toLowerCase()),
        eq(referrals.consultantId, userCode.consultantId)
      ),
    });

    if (existingReferral) {
      return res.status(409).json({ success: false, error: "This email has already been referred" });
    }

    const consultant = await db.query.users.findFirst({
      where: eq(users.id, userCode.consultantId),
    });

    let proactiveLeadId = null;
    if (consultant) {
      const agentConfig = await db.query.consultantWhatsappConfig.findFirst({
        where: eq(sql`consultant_id`, userCode.consultantId),
      });

      if (agentConfig) {
        const [lead] = await db.insert(proactiveLeads).values({
          consultantId: userCode.consultantId,
          agentConfigId: agentConfig.id,
          firstName,
          lastName: lastName || "",
          phoneNumber: phone,
          email: email.toLowerCase(),
          leadCategory: "referral",
          status: "pending",
          notes: `Referral da ${req.user!.firstName} ${req.user!.lastName}. ${notes || ""}`,
        }).returning();
        proactiveLeadId = lead.id;
      }
    }

    const [newReferral] = await db.insert(referrals).values({
      referralCodeId: userCode.id,
      referrerUserId: userId,
      consultantId: userCode.consultantId,
      proactiveLeadId,
      friendFirstName: firstName,
      friendLastName: lastName || null,
      friendEmail: email.toLowerCase(),
      friendPhone: phone,
      inviteMethod: "manual_entry",
      notes,
    }).returning();

    try {
      const { sendReferralInviteEmail } = await import("../services/referral-email");
      await sendReferralInviteEmail({
        referralId: newReferral.id,
        friendEmail: email,
        friendFirstName: firstName,
        referrerFirstName: req.user!.firstName,
        referrerLastName: req.user!.lastName || "",
        consultantId: userCode.consultantId,
        referralCode: userCode.code,
      });

      await db.update(referrals)
        .set({ emailSentAt: new Date() })
        .where(eq(referrals.id, newReferral.id));
    } catch (emailError) {
      console.error("[REFERRAL] Email send failed:", emailError);
    }

    res.json({
      success: true,
      referral: newReferral,
      message: "Invito inviato con successo!",
    });
  } catch (error: any) {
    console.error("[REFERRAL] Error creating invite:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/referral/my-invites - List client's invites
router.get("/referral/my-invites", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const myReferrals = await db.query.referrals.findMany({
      where: eq(referrals.referrerUserId, userId),
      orderBy: desc(referrals.createdAt),
    });

    const bonusAwarded = myReferrals.filter(r => r.bonusAwarded);

    res.json({
      success: true,
      referrals: myReferrals,
      stats: {
        total: myReferrals.length,
        pending: myReferrals.filter(r => r.status === "pending").length,
        contacted: myReferrals.filter(r => r.status === "contacted").length,
        closedWon: myReferrals.filter(r => r.status === "closed_won").length,
        closedLost: myReferrals.filter(r => r.status === "closed_lost").length,
        bonusEarned: bonusAwarded.length,
      },
    });
  } catch (error: any) {
    console.error("[REFERRAL] Error fetching invites:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// CONSULTANT MANAGEMENT API
// ===========================================

// GET /api/consultant/referrals - All referrals for consultant's clients
router.get("/consultant/referrals", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const status = req.query.status as string | undefined;

    let whereClause = eq(referrals.consultantId, consultantId);
    if (status) {
      whereClause = and(whereClause, eq(referrals.status, status as any)) as any;
    }

    const allReferrals = await db.query.referrals.findMany({
      where: whereClause,
      orderBy: desc(referrals.createdAt),
    });

    const referralsWithReferrer = await Promise.all(
      allReferrals.map(async (referral) => {
        const referrer = await db.query.users.findFirst({
          where: eq(users.id, referral.referrerUserId),
          columns: { id: true, firstName: true, lastName: true, email: true },
        });
        return { ...referral, referrer };
      })
    );

    res.json({
      success: true,
      referrals: referralsWithReferrer,
    });
  } catch (error: any) {
    console.error("[REFERRAL] Error fetching consultant referrals:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/consultant/referrals/:id - Update referral status
router.put("/consultant/referrals/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;
    const { status, notes, bonusAwarded } = req.body;

    const existingReferral = await db.query.referrals.findFirst({
      where: and(
        eq(referrals.id, id),
        eq(referrals.consultantId, consultantId)
      ),
    });

    if (!existingReferral) {
      return res.status(404).json({ success: false, error: "Referral not found" });
    }

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (bonusAwarded !== undefined) {
      updateData.bonusAwarded = bonusAwarded;
      if (bonusAwarded) updateData.bonusAwardedAt = new Date();
    }

    const [updated] = await db.update(referrals)
      .set(updateData)
      .where(eq(referrals.id, id))
      .returning();

    res.json({ success: true, referral: updated });
  } catch (error: any) {
    console.error("[REFERRAL] Error updating referral:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/consultant/referral-stats - Aggregate statistics
router.get("/consultant/referral-stats", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;

    const allReferrals = await db.query.referrals.findMany({
      where: eq(referrals.consultantId, consultantId),
    });

    const stats = {
      total: allReferrals.length,
      pending: allReferrals.filter(r => r.status === "pending").length,
      contacted: allReferrals.filter(r => r.status === "contacted").length,
      appointmentSet: allReferrals.filter(r => r.status === "appointment_set").length,
      closedWon: allReferrals.filter(r => r.status === "closed_won").length,
      closedLost: allReferrals.filter(r => r.status === "closed_lost").length,
      bonusAwarded: allReferrals.filter(r => r.bonusAwarded).length,
      conversionRate: allReferrals.length > 0 
        ? Math.round((allReferrals.filter(r => r.status === "closed_won").length / allReferrals.length) * 100) 
        : 0,
    };

    res.json({ success: true, stats });
  } catch (error: any) {
    console.error("[REFERRAL] Error fetching stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// LANDING PAGE CONFIG API
// ===========================================

// GET /api/consultant/referral-landing - Get landing config
router.get("/consultant/referral-landing", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;

    let config = await db.query.referralLandingConfig.findFirst({
      where: eq(referralLandingConfig.consultantId, consultantId),
    });

    if (!config) {
      const consultant = await db.query.users.findFirst({
        where: eq(users.id, consultantId),
      });

      const [newConfig] = await db.insert(referralLandingConfig).values({
        consultantId,
        headline: `Inizia il tuo percorso con ${consultant?.firstName || "me"}`,
        description: "Sono qui per aiutarti a raggiungere i tuoi obiettivi.",
        bonusText: "Consulenza gratuita di 30 minuti",
        profileImageUrl: consultant?.avatar,
      }).returning();

      config = newConfig;
    }

    res.json({ success: true, config });
  } catch (error: any) {
    console.error("[REFERRAL] Error fetching landing config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/consultant/referral-landing - Save landing config
router.put("/consultant/referral-landing", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const {
      headline,
      description,
      bonusText,
      profileImageUrl,
      preferredChannel,
      agentConfigId,
      showAiChat,
      aiAssistantIframeUrl,
      bonusType,
      bonusValue,
      bonusDescription,
      accentColor,
      isActive,
      defaultCampaignId,
      ctaButtonText,
      welcomeMessage,
      maxUsesPerCode,
      qualificationFieldsConfig,
    } = req.body;

    const existing = await db.query.referralLandingConfig.findFirst({
      where: eq(referralLandingConfig.consultantId, consultantId),
    });

    const configData = {
      headline,
      description,
      bonusText,
      profileImageUrl,
      preferredChannel,
      agentConfigId,
      showAiChat,
      aiAssistantIframeUrl,
      bonusType,
      bonusValue,
      bonusDescription,
      accentColor,
      isActive,
      defaultCampaignId,
      ctaButtonText,
      welcomeMessage,
      maxUsesPerCode,
      qualificationFieldsConfig,
      updatedAt: new Date(),
    };

    let config;
    if (existing) {
      [config] = await db.update(referralLandingConfig)
        .set(configData)
        .where(eq(referralLandingConfig.consultantId, consultantId))
        .returning();
    } else {
      [config] = await db.insert(referralLandingConfig).values({
        consultantId,
        ...configData,
      }).returning();
    }

    res.json({ success: true, config });
  } catch (error: any) {
    console.error("[REFERRAL] Error saving landing config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// OPTIN LANDING CONFIG API (Direct Contact, no referral)
// ===========================================

// GET /api/consultant/optin-landing - Get optin landing config
router.get("/consultant/optin-landing", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;

    const config = await db.query.optinLandingConfig.findFirst({
      where: eq(optinLandingConfig.consultantId, consultantId),
    });

    res.json({ success: true, config });
  } catch (error: any) {
    console.error("[OPTIN] Error fetching landing config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/consultant/optin-landing - Save optin landing config
router.put("/consultant/optin-landing", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const {
      headline,
      description,
      profileImageUrl,
      preferredChannel,
      agentConfigId,
      showAiChat,
      aiAssistantIframeUrl,
      accentColor,
      isActive,
      defaultCampaignId,
      ctaButtonText,
      welcomeMessage,
      qualificationFieldsConfig,
    } = req.body;

    const existing = await db.query.optinLandingConfig.findFirst({
      where: eq(optinLandingConfig.consultantId, consultantId),
    });

    const configData = {
      headline,
      description,
      profileImageUrl,
      preferredChannel,
      agentConfigId,
      showAiChat,
      aiAssistantIframeUrl,
      accentColor,
      isActive,
      defaultCampaignId,
      ctaButtonText,
      welcomeMessage,
      qualificationFieldsConfig,
      updatedAt: new Date(),
    };

    let config;
    if (existing) {
      [config] = await db.update(optinLandingConfig)
        .set(configData)
        .where(eq(optinLandingConfig.consultantId, consultantId))
        .returning();
    } else {
      [config] = await db.insert(optinLandingConfig).values({
        consultantId,
        ...configData,
      }).returning();
    }

    res.json({ success: true, config });
  } catch (error: any) {
    console.error("[OPTIN] Error saving landing config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// PUBLIC API (no auth)
// ===========================================

// GET /api/public/optin/:consultantId - Public optin landing page data
router.get("/public/optin/:consultantId", async (req, res) => {
  try {
    const { consultantId } = req.params;

    const consultant = await db.query.users.findFirst({
      where: eq(users.id, consultantId),
      columns: { id: true, firstName: true, lastName: true, avatar: true },
    });

    if (!consultant) {
      return res.status(404).json({ success: false, error: "Consultant not found" });
    }

    const config = await db.query.optinLandingConfig.findFirst({
      where: and(
        eq(optinLandingConfig.consultantId, consultantId),
        eq(optinLandingConfig.isActive, true)
      ),
    });

    if (!config) {
      return res.status(404).json({ success: false, error: "Optin landing not active" });
    }

    res.json({
      success: true,
      data: {
        consultant: {
          firstName: consultant.firstName,
          lastName: consultant.lastName,
          avatar: consultant.avatar,
        },
        config: {
          headline: config.headline,
          description: config.description,
          profileImageUrl: config.profileImageUrl,
          ctaButtonText: config.ctaButtonText,
          accentColor: config.accentColor,
          showAiChat: config.showAiChat,
          aiAssistantIframeUrl: config.aiAssistantIframeUrl,
          welcomeMessage: config.welcomeMessage,
          qualificationFieldsConfig: config.qualificationFieldsConfig,
          preferredChannel: config.preferredChannel,
        },
      },
    });
  } catch (error: any) {
    console.error("[OPTIN] Error fetching public landing data:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/public/referral/:code - Public landing page data
router.get("/public/referral/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const referralCode = await db.query.referralCodes.findFirst({
      where: and(
        eq(referralCodes.code, code.toUpperCase()),
        eq(referralCodes.isActive, true)
      ),
    });

    if (!referralCode) {
      return res.status(404).json({ success: false, error: "Invalid referral code" });
    }

    const consultant = await db.query.users.findFirst({
      where: eq(users.id, referralCode.consultantId),
      columns: { id: true, firstName: true, lastName: true, avatar: true },
    });

    const referrer = await db.query.users.findFirst({
      where: eq(users.id, referralCode.userId),
      columns: { firstName: true, lastName: true },
    });

    const landingConfig = await db.query.referralLandingConfig.findFirst({
      where: eq(referralLandingConfig.consultantId, referralCode.consultantId),
    });

    res.json({
      success: true,
      code: referralCode.code,
      codeType: referralCode.codeType,
      consultant: consultant ? {
        id: consultant.id,
        firstName: consultant.firstName,
        lastName: consultant.lastName,
        avatar: consultant.avatar,
      } : null,
      referrer: referrer ? {
        firstName: referrer.firstName,
        lastName: referrer.lastName,
      } : null,
      landing: landingConfig ? {
        headline: landingConfig.headline,
        description: landingConfig.description,
        bonusText: landingConfig.bonusText,
        profileImageUrl: landingConfig.profileImageUrl || consultant?.avatar,
        preferredChannel: landingConfig.preferredChannel,
        showAiChat: landingConfig.showAiChat,
        aiAssistantIframeUrl: landingConfig.aiAssistantIframeUrl,
        agentConfigId: landingConfig.agentConfigId,
        accentColor: landingConfig.accentColor,
        ctaButtonText: landingConfig.ctaButtonText || "Richiedi il tuo bonus",
        welcomeMessage: landingConfig.welcomeMessage,
        qualificationFieldsConfig: landingConfig.qualificationFieldsConfig,
      } : {
        headline: `Inizia il tuo percorso con ${consultant?.firstName || "noi"}`,
        description: "Siamo qui per aiutarti a raggiungere i tuoi obiettivi.",
        bonusText: "Consulenza gratuita",
        profileImageUrl: consultant?.avatar,
        preferredChannel: "all",
        showAiChat: false,
        aiAssistantIframeUrl: null,
        accentColor: "#6366f1",
        ctaButtonText: "Richiedi il tuo bonus",
        welcomeMessage: null,
        qualificationFieldsConfig: null,
      },
    });
  } catch (error: any) {
    console.error("[REFERRAL] Error fetching public landing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/public/referral/:code/submit - Public form submission
router.post("/public/referral/:code/submit", async (req, res) => {
  try {
    const { code } = req.params;
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      notes,
      qualificationRole,
      qualificationCompanyType,
      qualificationSector,
      qualificationEmployeeCount,
      qualificationAnnualRevenue,
      qualificationCurrentCompany,
      qualificationCurrentPosition,
      qualificationYearsExperience,
      qualificationFieldOfStudy,
      qualificationUniversity,
      qualificationMotivation,
      qualificationBiggestProblem,
      qualificationGoal12Months,
      qualificationCurrentBlocker,
    } = req.body;

    if (!firstName || !email || !phone) {
      return res.status(400).json({ success: false, error: "Nome, email e telefono sono obbligatori" });
    }

    const referralCode = await db.query.referralCodes.findFirst({
      where: and(
        eq(referralCodes.code, code.toUpperCase()),
        eq(referralCodes.isActive, true)
      ),
    });

    if (!referralCode) {
      return res.status(404).json({ success: false, error: "Invalid referral code" });
    }

    const existingReferral = await db.query.referrals.findFirst({
      where: and(
        eq(referrals.friendEmail, email.toLowerCase()),
        eq(referrals.consultantId, referralCode.consultantId)
      ),
    });

    if (existingReferral) {
      return res.status(409).json({ success: false, error: "Questa email è già stata registrata" });
    }

    const consultant = await db.query.users.findFirst({
      where: eq(users.id, referralCode.consultantId),
    });

    const landingConfig = await db.query.referralLandingConfig.findFirst({
      where: eq(referralLandingConfig.consultantId, referralCode.consultantId),
    });

    let proactiveLeadId = null;
    const agentConfigId = landingConfig?.agentConfigId;
    const campaignId = landingConfig?.defaultCampaignId;

    if (consultant && agentConfigId) {
      const referrer = await db.query.users.findFirst({
        where: eq(users.id, referralCode.userId),
      });

      let campaignSnapshot = null;
      if (campaignId) {
        const campaign = await db.query.marketingCampaigns.findFirst({
          where: eq(sql`id`, campaignId),
        });
        if (campaign) {
          campaignSnapshot = {
            name: campaign.name,
            goal: campaign.goal,
            obiettivi: campaign.obiettivi,
            desideri: campaign.desideri,
            uncino: campaign.uncino,
            statoIdeale: campaign.statoIdeale,
          };
        }
      }

      const [lead] = await db.insert(proactiveLeads).values({
        consultantId: referralCode.consultantId,
        agentConfigId,
        campaignId: campaignId || null,
        campaignSnapshot,
        firstName,
        lastName: lastName || "",
        phoneNumber: phone,
        email: email.toLowerCase(),
        leadCategory: "referral",
        status: "pending",
        contactSchedule: new Date(),
        notes: `Referral da landing page. Invitato da ${referrer?.firstName || ""} ${referrer?.lastName || ""}. ${notes || ""}`,
      }).returning();
      proactiveLeadId = lead.id;
    }

    const [newReferral] = await db.insert(referrals).values({
      referralCodeId: referralCode.id,
      referrerUserId: referralCode.userId,
      consultantId: referralCode.consultantId,
      proactiveLeadId,
      friendFirstName: firstName,
      friendLastName: lastName || null,
      friendEmail: email.toLowerCase(),
      friendPhone: phone,
      inviteMethod: "link_shared",
      notes,
      qualificationRole,
      qualificationCompanyType,
      qualificationSector,
      qualificationEmployeeCount,
      qualificationAnnualRevenue,
      qualificationCurrentCompany,
      qualificationCurrentPosition,
      qualificationYearsExperience,
      qualificationFieldOfStudy,
      qualificationUniversity,
      qualificationMotivation,
      qualificationBiggestProblem,
      qualificationGoal12Months,
      qualificationCurrentBlocker,
    }).returning();

    try {
      const { sendReferralConfirmationEmail } = await import("../services/referral-email");
      await sendReferralConfirmationEmail({
        referralId: newReferral.id,
        friendEmail: email,
        friendFirstName: firstName,
        consultantId: referralCode.consultantId,
      });
      
      await db.update(referrals)
        .set({ emailSentAt: new Date() })
        .where(eq(referrals.id, newReferral.id));
    } catch (emailError) {
      console.error("[REFERRAL] Confirmation email failed:", emailError);
    }

    res.json({
      success: true,
      message: "Richiesta inviata con successo! Ti contatteremo presto.",
      referralId: newReferral.id,
    });
  } catch (error: any) {
    console.error("[REFERRAL] Error submitting form:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;