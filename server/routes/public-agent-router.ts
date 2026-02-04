import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  managerUsers,
  managerLinkAssignments,
  managerConversations,
  managerMessages,
  whatsappAgentShares,
  consultantWhatsappConfig,
  bronzeUsers,
  users,
  clientLevelSubscriptions,
  consultantLicenses,
} from "@shared/schema";
import { getAIProvider, getModelWithThinking } from "../ai/provider-factory";
import { buildWhatsAppAgentPrompt } from "../whatsapp/agent-consultant-chat-service";
import { fileSearchSyncService } from "../services/file-search-sync-service";
import { fileSearchService } from "../ai/file-search-service";
import { conversationMemoryService } from "../services/conversation-memory";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "your-secret-key";

interface ManagerTokenPayload {
  managerId: string;
  consultantId: string;
  shareId: string;
  role: string;
}

interface BronzeTokenPayload {
  bronzeUserId: string;
  consultantId: string;
  email: string;
  type: "bronze";
}

interface SilverGoldTokenPayload {
  subscriptionId: string;
  consultantId: string;
  email: string;
  level: "2" | "3";
  type: "silver" | "gold";
}

interface ManagerRequest extends Request {
  manager?: ManagerTokenPayload;
  bronzeUser?: BronzeTokenPayload;
  silverGoldUser?: SilverGoldTokenPayload;
  share?: typeof whatsappAgentShares.$inferSelect;
  agentConfig?: typeof consultantWhatsappConfig.$inferSelect;
}

async function verifyManagerToken(
  req: ManagerRequest,
  res: Response,
  next: NextFunction
) {
  try {
    let token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token && req.cookies?.managerToken) {
      token = req.cookies.managerToken;
    }

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Handle Bronze token (type: "bronze")
    if (decoded.type === "bronze" && decoded.bronzeUserId) {
      const [bronzeUser] = await db.select()
        .from(bronzeUsers)
        .where(eq(bronzeUsers.id, decoded.bronzeUserId))
        .limit(1);

      if (!bronzeUser || !bronzeUser.isActive) {
        return res.status(403).json({ message: "Bronze account not active" });
      }

      // Set bronzeUser on request for Bronze flow
      req.bronzeUser = {
        bronzeUserId: decoded.bronzeUserId,
        consultantId: decoded.consultantId,
        email: decoded.email,
        type: "bronze",
      };
      
      // Also set a compatible manager object for shared endpoints
      req.manager = {
        managerId: decoded.bronzeUserId,
        consultantId: decoded.consultantId,
        shareId: `bronze-${decoded.bronzeUserId}`,
        role: "bronze",
      };
      
      return next();
    }
    
    // Handle Silver/Gold token (type: "silver" or "gold")
    if ((decoded.type === "silver" || decoded.type === "gold") && decoded.subscriptionId) {
      console.log(`[PUBLIC AGENT] Silver/Gold token detected - type: ${decoded.type}, subscriptionId: ${decoded.subscriptionId}, email: ${decoded.email}`);
      
      const [subscription] = await db.select()
        .from(clientLevelSubscriptions)
        .where(eq(clientLevelSubscriptions.id, decoded.subscriptionId))
        .limit(1);

      if (!subscription || subscription.status !== "active") {
        console.log(`[PUBLIC AGENT] Silver/Gold subscription not active or not found: ${decoded.subscriptionId}`);
        return res.status(403).json({ message: "Subscription not active" });
      }

      console.log(`[PUBLIC AGENT] Silver/Gold auth successful - level: ${subscription.level}, hasCompletedOnboarding: ${subscription.hasCompletedOnboarding}`);

      // Set silverGoldUser on request - use subscription.level from DB (not decoded.level from token)
      // This ensures upgrades are reflected immediately without requiring token refresh
      const actualLevel = subscription.level as "2" | "3";
      const actualType = actualLevel === "3" ? "gold" : "silver";
      
      req.silverGoldUser = {
        subscriptionId: decoded.subscriptionId,
        consultantId: subscription.consultantId,
        email: subscription.email,
        level: actualLevel,
        type: actualType,
      };
      
      // Also set a compatible manager object for shared endpoints
      req.manager = {
        managerId: decoded.subscriptionId,
        consultantId: decoded.consultantId,
        shareId: `${decoded.type}-${decoded.subscriptionId}`,
        role: decoded.type,
      };
      
      return next();
    }
    
    // Handle Gold client token (users table with role: "client")
    // Gold client tokens have userId but NO type, bronzeUserId, subscriptionId, or managerId
    if (decoded.userId && !decoded.type && !decoded.bronzeUserId && !decoded.subscriptionId && !decoded.managerId) {
      console.log(`[PUBLIC AGENT] Potential Gold client token detected - userId: ${decoded.userId}`);
      
      const [goldUser] = await db.select()
        .from(users)
        .where(and(
          eq(users.id, decoded.userId),
          eq(users.role, "client"),
          eq(users.isActive, true)
        ))
        .limit(1);

      if (goldUser) {
        console.log(`[PUBLIC AGENT] Gold client auth successful - email: ${goldUser.email}`);

        // Set silverGoldUser on request (treating Gold clients as level 3)
        req.silverGoldUser = {
          subscriptionId: decoded.userId, // Use userId as subscriptionId for compatibility
          consultantId: goldUser.consultantId!,
          email: goldUser.email,
          level: "3",
          type: "gold",
        };
        
        // Also set a compatible manager object for shared endpoints
        req.manager = {
          managerId: decoded.userId,
          consultantId: goldUser.consultantId!,
          shareId: `gold-${decoded.userId}`,
          role: "gold",
        };
        
        return next();
      }
      
      // Not a Gold client - could be a consultant or other user type, let it fall through
      console.log(`[PUBLIC AGENT] userId ${decoded.userId} is not a Gold client, checking other auth types...`);
    }
    
    // Handle Manager token (role: "manager")
    if (decoded.role !== "manager") {
      return res.status(403).json({ message: "Invalid token role" });
    }

    const [manager] = await db.select()
      .from(managerUsers)
      .where(eq(managerUsers.id, decoded.managerId))
      .limit(1);

    if (!manager || manager.status !== "active") {
      return res.status(403).json({ message: "Manager account not active" });
    }

    req.manager = decoded;
    next();
  } catch (error: any) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    console.error("[PUBLIC AGENT] Token verification error:", error);
    return res.status(500).json({ message: "Authentication error" });
  }
}

async function loadShareAndAgent(
  req: ManagerRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ message: "Slug is required" });
    }

    // First try to find in whatsappAgentShares (legacy manager system)
    const [share] = await db.select()
      .from(whatsappAgentShares)
      .where(eq(whatsappAgentShares.slug, slug))
      .limit(1);

    if (share) {
      // Found in shares table - use legacy flow
      if (!share.isActive) {
        return res.status(403).json({ message: "Agent is not active" });
      }

      if (share.expireAt && new Date(share.expireAt) < new Date()) {
        return res.status(403).json({ message: "Agent link has expired" });
      }

      const [agentConfig] = await db.select()
        .from(consultantWhatsappConfig)
        .where(eq(consultantWhatsappConfig.id, share.agentConfigId))
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({ message: "Agent configuration not found" });
      }

      req.share = share;
      req.agentConfig = agentConfig;
      return next();
    }

    // Not found in shares - try to find by public_slug in consultantWhatsappConfig (Bronze/Level 1 system)
    let [agentConfig] = await db.select()
      .from(consultantWhatsappConfig)
      .where(and(
        eq(consultantWhatsappConfig.publicSlug, slug),
        eq(consultantWhatsappConfig.isActive, true)
      ))
      .limit(1);

    // If not found by publicSlug, try to find by ID (for Gold preview access and agents without slug)
    if (!agentConfig) {
      [agentConfig] = await db.select()
        .from(consultantWhatsappConfig)
        .where(and(
          eq(consultantWhatsappConfig.id, slug),
          eq(consultantWhatsappConfig.isActive, true)
        ))
        .limit(1);
    }

    if (!agentConfig) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Create a virtual share object for Bronze agents
    const virtualShare = {
      id: `bronze-${agentConfig.id}`,
      slug: slug,
      agentConfigId: agentConfig.id,
      agentName: agentConfig.agentName || "AI Assistant",
      consultantId: agentConfig.consultantId,
      isActive: true,
      requiresLogin: true, // Bronze requires login
      expireAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as typeof whatsappAgentShares.$inferSelect;

    req.share = virtualShare;
    req.agentConfig = agentConfig;
    next();
  } catch (error: any) {
    console.error("[PUBLIC AGENT] Load share error:", error);
    return res.status(500).json({ message: "Failed to load agent" });
  }
}

router.get("/:slug", loadShareAndAgent, async (req: ManagerRequest, res: Response) => {
  try {
    const share = req.share!;
    const agentConfig = req.agentConfig!;

    res.json({
      id: agentConfig.id,
      agentName: share.agentName,
      description: agentConfig.businessDescription || null,
      requiresLogin: share.requiresLogin,
      businessName: agentConfig.businessName || null,
      consultantName: agentConfig.consultantDisplayName || null,
      // Extended agent info for welcome screen
      whoWeHelp: agentConfig.whoWeHelp || null,
      whatWeDo: agentConfig.whatWeDo || null,
      howWeDoIt: agentConfig.howWeDoIt || null,
      usp: agentConfig.usp || null,
      mission: agentConfig.mission || null,
      vision: agentConfig.vision || null,
    });
  } catch (error: any) {
    console.error("[PUBLIC AGENT] Get info error:", error);
    res.status(500).json({ message: "Failed to get agent info" });
  }
});

router.get(
  "/:slug/manager/me",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const manager = req.manager!;
      const share = req.share!;

      // Handle Bronze users
      if (req.bronzeUser) {
        const [bronzeUser] = await db.select({
          id: bronzeUsers.id,
          firstName: bronzeUsers.firstName,
          lastName: bronzeUsers.lastName,
          email: bronzeUsers.email,
          isActive: bronzeUsers.isActive,
          dailyMessagesUsed: bronzeUsers.dailyMessagesUsed,
          dailyMessageLimit: bronzeUsers.dailyMessageLimit,
          lastMessageResetAt: bronzeUsers.lastMessageResetAt,
          hasCompletedOnboarding: bronzeUsers.hasCompletedOnboarding,
          upgradedAt: bronzeUsers.upgradedAt,
          upgradedToLevel: bronzeUsers.upgradedToLevel,
          upgradedSubscriptionId: bronzeUsers.upgradedSubscriptionId,
        })
          .from(bronzeUsers)
          .where(eq(bronzeUsers.id, req.bronzeUser.bronzeUserId))
          .limit(1);

        if (!bronzeUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // PRIORITY 1: Check if bronzeUser has been directly marked as upgraded (most secure - uses bronzeUserId link)
        if (bronzeUser.upgradedAt && bronzeUser.upgradedToLevel && bronzeUser.upgradedSubscriptionId) {
          const tier = bronzeUser.upgradedToLevel;
          const level = tier === "gold" ? "3" : tier === "deluxe" ? "4" : "2";
          console.log(`[PUBLIC AGENT] Bronze user ${bronzeUser.email} marked as upgraded to ${tier} - returning upgraded status (secure)`);
          
          // Get subscription details
          const [subscription] = await db.select()
            .from(clientLevelSubscriptions)
            .where(eq(clientLevelSubscriptions.id, bronzeUser.upgradedSubscriptionId))
            .limit(1);
          
          // Get consultant's pricing page slug
          const [consultant] = await db.select({
            pricingPageSlug: users.pricingPageSlug,
          })
            .from(users)
            .where(eq(users.id, req.bronzeUser.consultantId))
            .limit(1);

          // Generate new token for Silver/Gold user with subscriptionId as managerId
          // This is CRITICAL for conversation migration to work properly
          const tokenType = tier === "gold" || tier === "deluxe" ? "gold" : "silver";
          const newToken = jwt.sign({
            subscriptionId: bronzeUser.upgradedSubscriptionId,
            consultantId: req.bronzeUser.consultantId,
            email: bronzeUser.email,
            type: tokenType,
            level,
          }, JWT_SECRET, { expiresIn: '30d' });

          console.log(`[PUBLIC AGENT] Generated new ${tokenType} token for upgraded user ${bronzeUser.email}, subscriptionId: ${bronzeUser.upgradedSubscriptionId}`);

          return res.json({
            success: true,
            upgraded: true,
            newToken,
            tierType: tier,
            id: bronzeUser.upgradedSubscriptionId,
            name: subscription?.clientName || [bronzeUser.firstName, bronzeUser.lastName].filter(Boolean).join(" ") || "User",
            email: bronzeUser.email,
            status: "active",
            isBronze: false,
            tier,
            level,
            hasCompletedOnboarding: subscription?.hasCompletedOnboarding || bronzeUser.hasCompletedOnboarding || false,
            consultantSlug: consultant?.pricingPageSlug || null,
            upgradedFromBronze: true,
          });
        }

        // PRIORITY 2: Fallback - Check by email matching (for backwards compatibility with older upgrades)
        const [upgradedSubscription] = await db.select()
          .from(clientLevelSubscriptions)
          .where(and(
            eq(clientLevelSubscriptions.clientEmail, bronzeUser.email.toLowerCase()),
            eq(clientLevelSubscriptions.consultantId, req.bronzeUser.consultantId),
            eq(clientLevelSubscriptions.status, "active")
          ))
          .limit(1);

        if (upgradedSubscription) {
          // User has been upgraded via email match (legacy flow)
          const tier = upgradedSubscription.level === "3" ? "gold" : upgradedSubscription.level === "4" ? "deluxe" : "silver";
          console.log(`[PUBLIC AGENT] Bronze user ${bronzeUser.email} has active ${tier} subscription (email match) - returning upgraded status`);
          
          // Get consultant's pricing page slug
          const [consultant] = await db.select({
            pricingPageSlug: users.pricingPageSlug,
          })
            .from(users)
            .where(eq(users.id, req.bronzeUser.consultantId))
            .limit(1);

          // Generate new token for Silver/Gold user with subscriptionId as managerId
          const tokenType = tier === "gold" || tier === "deluxe" ? "gold" : "silver";
          const newToken = jwt.sign({
            subscriptionId: upgradedSubscription.id,
            consultantId: req.bronzeUser.consultantId,
            email: bronzeUser.email,
            type: tokenType,
            level: upgradedSubscription.level,
          }, JWT_SECRET, { expiresIn: '30d' });

          console.log(`[PUBLIC AGENT] Generated new ${tokenType} token for upgraded user ${bronzeUser.email} (email match), subscriptionId: ${upgradedSubscription.id}`);

          return res.json({
            success: true,
            upgraded: true,
            newToken,
            tierType: tier,
            id: upgradedSubscription.id,
            name: upgradedSubscription.clientName || [bronzeUser.firstName, bronzeUser.lastName].filter(Boolean).join(" ") || "User",
            email: bronzeUser.email,
            status: "active",
            isBronze: false,
            tier,
            level: upgradedSubscription.level,
            hasCompletedOnboarding: upgradedSubscription.hasCompletedOnboarding || bronzeUser.hasCompletedOnboarding || false,
            consultantSlug: consultant?.pricingPageSlug || null,
            upgradedFromBronze: true,
          });
        }

        // Check if we need to reset the daily counter (new day)
        let dailyUsed = bronzeUser.dailyMessagesUsed;
        const dailyLimit = bronzeUser.dailyMessageLimit;
        const lastReset = bronzeUser.lastMessageResetAt;
        
        // Helper to check if it's a new day
        const isNewDay = (lastResetDate: Date | null): boolean => {
          if (!lastResetDate) return true;
          const now = new Date();
          const lastResetDay = new Date(lastResetDate).setHours(0, 0, 0, 0);
          const today = new Date(now).setHours(0, 0, 0, 0);
          return today > lastResetDay;
        };

        if (isNewDay(lastReset)) {
          dailyUsed = 0;
        }

        // Get consultant's pricing page slug for logout redirect
        const [consultant] = await db.select({
          pricingPageSlug: users.pricingPageSlug,
        })
          .from(users)
          .where(eq(users.id, req.bronzeUser.consultantId))
          .limit(1);

        return res.json({
          id: bronzeUser.id,
          name: [bronzeUser.firstName, bronzeUser.lastName].filter(Boolean).join(" ") || "Bronze User",
          email: bronzeUser.email,
          status: bronzeUser.isActive ? "active" : "inactive",
          isBronze: true,
          tier: "bronze",
          dailyMessagesUsed: dailyUsed,
          dailyMessageLimit: dailyLimit,
          remaining: Math.max(0, dailyLimit - dailyUsed),
          hasCompletedOnboarding: bronzeUser.hasCompletedOnboarding || false,
          consultantSlug: consultant?.pricingPageSlug || null,
        });
      }

      // Handle Silver/Gold users
      if (req.silverGoldUser) {
        console.log(`[PUBLIC AGENT] GET /manager/me - Silver/Gold user: ${req.silverGoldUser.email}, subscriptionId: ${req.silverGoldUser.subscriptionId}, type: ${req.silverGoldUser.type}`);
        
        // Check if this is a Gold client from users table (type came from verifyManagerToken)
        if (req.silverGoldUser.type === "gold" && req.silverGoldUser.level === "3") {
          // First try to find in clientLevelSubscriptions
          const [subscription] = await db.select()
            .from(clientLevelSubscriptions)
            .where(eq(clientLevelSubscriptions.id, req.silverGoldUser.subscriptionId))
            .limit(1);
          
          if (subscription) {
            // Found in subscriptions table
            const [consultant] = await db.select({
              pricingPageSlug: users.pricingPageSlug,
            })
              .from(users)
              .where(eq(users.id, req.silverGoldUser.consultantId))
              .limit(1);

            console.log(`[PUBLIC AGENT] Returning Gold subscription user data - hasCompletedOnboarding: ${subscription.hasCompletedOnboarding}`);

            return res.json({
              id: subscription.id,
              name: subscription.clientName || subscription.clientEmail.split("@")[0],
              email: subscription.clientEmail,
              status: subscription.status,
              isBronze: false,
              tier: "gold",
              level: "3",
              hasCompletedOnboarding: subscription.hasCompletedOnboarding || false,
              consultantSlug: consultant?.pricingPageSlug || null,
            });
          }
          
          // Not in subscriptions - must be a Gold client from users table
          const [goldClient] = await db.select()
            .from(users)
            .where(and(
              eq(users.id, req.silverGoldUser.subscriptionId),
              eq(users.role, "client")
            ))
            .limit(1);
          
          if (goldClient) {
            const [consultant] = await db.select({
              pricingPageSlug: users.pricingPageSlug,
            })
              .from(users)
              .where(eq(users.id, goldClient.consultantId!))
              .limit(1);

            console.log(`[PUBLIC AGENT] Returning Gold client user data - email: ${goldClient.email}`);

            return res.json({
              id: goldClient.id,
              name: `${goldClient.firstName || ""} ${goldClient.lastName || ""}`.trim() || goldClient.email.split("@")[0],
              email: goldClient.email,
              status: goldClient.isActive ? "active" : "inactive",
              isBronze: false,
              tier: "gold",
              level: "3",
              hasCompletedOnboarding: true, // Gold clients are always onboarded
              consultantSlug: consultant?.pricingPageSlug || null,
            });
          }
          
          return res.status(404).json({ message: "Gold user not found" });
        }
        
        // Standard Silver/Gold from subscriptions table
        const [subscription] = await db.select()
          .from(clientLevelSubscriptions)
          .where(eq(clientLevelSubscriptions.id, req.silverGoldUser.subscriptionId))
          .limit(1);

        if (!subscription) {
          return res.status(404).json({ message: "Subscription not found" });
        }

        // Get consultant's pricing page slug for logout redirect
        const [consultant] = await db.select({
          pricingPageSlug: users.pricingPageSlug,
        })
          .from(users)
          .where(eq(users.id, req.silverGoldUser.consultantId))
          .limit(1);

        const tierType = subscription.level === "3" ? "gold" : "silver";

        console.log(`[PUBLIC AGENT] Returning Silver/Gold user data - tier: ${tierType}, hasCompletedOnboarding: ${subscription.hasCompletedOnboarding}`);

        return res.json({
          id: subscription.id,
          name: subscription.clientName || subscription.clientEmail.split("@")[0],
          email: subscription.clientEmail,
          status: subscription.status,
          isBronze: false,
          tier: tierType,
          level: subscription.level,
          hasCompletedOnboarding: subscription.hasCompletedOnboarding || false,
          consultantSlug: consultant?.pricingPageSlug || null,
        });
      }

      // Handle Manager users (legacy flow)
      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const [managerData] = await db.select({
        id: managerUsers.id,
        name: managerUsers.name,
        email: managerUsers.email,
        status: managerUsers.status,
      })
        .from(managerUsers)
        .where(eq(managerUsers.id, manager.managerId))
        .limit(1);

      if (!managerData) {
        return res.status(404).json({ message: "Manager not found" });
      }

      res.json(managerData);
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Get manager info error:", error);
      res.status(500).json({ message: "Failed to get manager info" });
    }
  }
);

router.get(
  "/:slug/manager/preferences",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const manager = req.manager!;
      const share = req.share!;

      const defaultPreferences = {
        writingStyle: "eccentric",
        responseLength: "balanced",
        customInstructions: null,
        aiModel: null,
        thinkingLevel: null,
      };

      // Handle Bronze users - get preferences from bronze_users table
      if (req.bronzeUser) {
        const [bronzeData] = await db.select({
          writingStyle: bronzeUsers.writingStyle,
          responseLength: bronzeUsers.responseLength,
          customInstructions: bronzeUsers.customInstructions,
        })
          .from(bronzeUsers)
          .where(eq(bronzeUsers.id, req.bronzeUser.bronzeUserId))
          .limit(1);
        
        if (bronzeData) {
          return res.json({
            ...defaultPreferences,
            writingStyle: bronzeData.writingStyle || "eccentric",
            responseLength: bronzeData.responseLength || "balanced",
            customInstructions: bronzeData.customInstructions || null,
          });
        }
        return res.json(defaultPreferences);
      }

      // Handle Silver/Gold users - get preferences from client_level_subscriptions
      if (req.silverGoldUser) {
        const [subscriptionData] = await db.select({
          writingStyle: clientLevelSubscriptions.writingStyle,
          responseLength: clientLevelSubscriptions.responseLength,
          customInstructions: clientLevelSubscriptions.customInstructions,
        })
          .from(clientLevelSubscriptions)
          .where(eq(clientLevelSubscriptions.id, req.silverGoldUser.subscriptionId))
          .limit(1);
        
        if (subscriptionData) {
          return res.json({
            ...defaultPreferences,
            writingStyle: subscriptionData.writingStyle || "eccentric",
            responseLength: subscriptionData.responseLength || "balanced",
            customInstructions: subscriptionData.customInstructions || null,
          });
        }
        return res.json(defaultPreferences);
      }

      // Handle Manager users (legacy flow)
      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const [managerData] = await db.select({
        aiPreferences: managerUsers.aiPreferences,
      })
        .from(managerUsers)
        .where(eq(managerUsers.id, manager.managerId))
        .limit(1);

      if (!managerData) {
        return res.status(404).json({ message: "Manager not found" });
      }

      res.json({ ...defaultPreferences, ...(managerData.aiPreferences || {}) });
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Get manager preferences error:", error);
      res.status(500).json({ message: "Failed to get manager preferences" });
    }
  }
);

router.get(
  "/:slug/manager/memory",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      if (!req.silverGoldUser || req.silverGoldUser.level !== "3") {
        return res.status(403).json({ message: "Memory summaries are only available for Gold tier users" });
      }

      const summaries = await conversationMemoryService.getManagerDailySummaries(
        req.silverGoldUser.subscriptionId,
        30
      );

      res.json({ summaries });
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Get manager memory error:", error);
      res.status(500).json({ message: "Failed to get memory summaries" });
    }
  }
);

router.post(
  "/:slug/manager/memory/generate",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      if (!req.silverGoldUser || req.silverGoldUser.level !== "3") {
        return res.status(403).json({ message: "Memory generation is only available for Gold tier users" });
      }

      const { getSuperAdminGeminiKeys } = await import("../ai/provider-factory");
      const { ConversationMemoryService } = await import("../services/conversation-memory/memory-service");
      
      const superAdminKeys = await getSuperAdminGeminiKeys();
      if (!superAdminKeys || !superAdminKeys.enabled || superAdminKeys.keys.length === 0) {
        return res.status(400).json({ message: "AI service not available" });
      }

      const apiKey = superAdminKeys.keys[0];
      const memoryService = new ConversationMemoryService();
      
      // If force=true, delete existing summaries first to allow regeneration
      const force = req.body?.force === true;
      if (force) {
        await memoryService.deleteManagerSummaries(req.silverGoldUser.subscriptionId);
        console.log(`[MANAGER MEMORY] Force regenerate - deleted existing summaries for subscription ${req.silverGoldUser.subscriptionId.slice(0, 8)}...`);
      }
      
      const startTime = Date.now();
      const result = await memoryService.generateManagerMissingDailySummariesWithProgress(
        req.silverGoldUser.subscriptionId,
        req.silverGoldUser.consultantId,
        apiKey,
        () => {}
      );
      const durationMs = Date.now() - startTime;

      console.log(`[MANAGER MEMORY] Generated ${result.generated} summaries for Gold user ${req.silverGoldUser.email} in ${durationMs}ms`);

      res.json({ 
        message: result.generated > 0 ? `Generati ${result.generated} riassunti` : "Nessun riassunto da generare",
        generated: result.generated,
        total: result.total,
        durationMs
      });
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Generate manager memory error:", error);
      res.status(500).json({ message: "Failed to generate memory summaries" });
    }
  }
);

router.put(
  "/:slug/manager/preferences",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const manager = req.manager!;
      const share = req.share!;
      const { writingStyle, responseLength, customInstructions } = req.body;

      const aiPreferences = {
        writingStyle: writingStyle || "default",
        responseLength: responseLength || "balanced",
        customInstructions: customInstructions || null,
      };

      // Handle Bronze users - save to bronze_users table
      if (req.bronzeUser) {
        await db.update(bronzeUsers)
          .set({
            writingStyle: aiPreferences.writingStyle,
            responseLength: aiPreferences.responseLength,
            customInstructions: aiPreferences.customInstructions,
            updatedAt: new Date(),
          })
          .where(eq(bronzeUsers.id, req.bronzeUser.bronzeUserId));
        
        console.log(`[PREFERENCES] Saved preferences for Bronze user ${req.bronzeUser.email}`);
        return res.json(aiPreferences);
      }

      // Handle Silver/Gold users - save to client_level_subscriptions table
      if (req.silverGoldUser) {
        await db.update(clientLevelSubscriptions)
          .set({
            writingStyle: aiPreferences.writingStyle,
            responseLength: aiPreferences.responseLength,
            customInstructions: aiPreferences.customInstructions,
            updatedAt: new Date(),
          })
          .where(eq(clientLevelSubscriptions.id, req.silverGoldUser.subscriptionId));
        
        console.log(`[PREFERENCES] Saved preferences for ${req.silverGoldUser.type} user ${req.silverGoldUser.email}`);
        return res.json(aiPreferences);
      }

      // Handle Manager users (legacy flow)
      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      await db.update(managerUsers)
        .set({ 
          aiPreferences,
          updatedAt: new Date(),
        })
        .where(eq(managerUsers.id, manager.managerId));

      res.json(aiPreferences);
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Update manager preferences error:", error);
      res.status(500).json({ message: "Failed to update manager preferences" });
    }
  }
);

router.get(
  "/:slug/conversations",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const manager = req.manager!;

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const conversations = await db.select({
        id: managerConversations.id,
        title: managerConversations.title,
        messageCount: managerConversations.messageCount,
        lastMessageAt: managerConversations.lastMessageAt,
        createdAt: managerConversations.createdAt,
      })
        .from(managerConversations)
        .where(and(
          eq(managerConversations.managerId, manager.managerId),
          eq(managerConversations.shareId, share.id)
        ))
        .orderBy(desc(managerConversations.lastMessageAt));

      res.json(conversations);
    } catch (error: any) {
      console.error("[PUBLIC AGENT] List conversations error:", error);
      res.status(500).json({ message: "Failed to list conversations" });
    }
  }
);

router.post(
  "/:slug/conversations",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const manager = req.manager!;

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const [conversation] = await db.insert(managerConversations).values({
        managerId: manager.managerId,
        shareId: share.id,
        agentConfigId: share.agentConfigId,
        title: "Nuova conversazione",
        messageCount: 0,
        metadata: {
          userAgent: req.headers["user-agent"],
          ipAddress: req.ip,
        },
      }).returning();

      res.status(201).json(conversation);
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Create conversation error:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  }
);

router.get(
  "/:slug/conversations/:conversationId",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const manager = req.manager!;
      const { conversationId } = req.params;

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const [conversation] = await db.select()
        .from(managerConversations)
        .where(and(
          eq(managerConversations.id, conversationId),
          eq(managerConversations.managerId, manager.managerId),
          eq(managerConversations.shareId, share.id)
        ))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const messages = await db.select()
        .from(managerMessages)
        .where(eq(managerMessages.conversationId, conversationId))
        .orderBy(managerMessages.createdAt);

      res.json({
        ...conversation,
        messages,
      });
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Get conversation error:", error);
      res.status(500).json({ message: "Failed to get conversation" });
    }
  }
);

router.post(
  "/:slug/conversations/:conversationId/messages",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const agentConfig = req.agentConfig!;
      const manager = req.manager!;
      const { conversationId } = req.params;
      const { content, preferences: bodyPreferences } = req.body;
      
      // Load preferences from database for Silver/Gold users
      let preferences = bodyPreferences;
      if (req.silverGoldUser) {
        const [subscription] = await db.select()
          .from(clientLevelSubscriptions)
          .where(eq(clientLevelSubscriptions.id, req.silverGoldUser.subscriptionId))
          .limit(1);
        
        if (subscription) {
          // Merge DB preferences with body preferences (body takes priority)
          preferences = {
            writingStyle: bodyPreferences?.writingStyle || subscription.writingStyle,
            responseLength: bodyPreferences?.responseLength || subscription.responseLength,
            customInstructions: bodyPreferences?.customInstructions || subscription.customInstructions,
          };
        }
      }

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      const [conversation] = await db.select()
        .from(managerConversations)
        .where(and(
          eq(managerConversations.id, conversationId),
          eq(managerConversations.managerId, manager.managerId),
          eq(managerConversations.shareId, share.id)
        ))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const sendSSE = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const [userMessage] = await db.insert(managerMessages).values({
        conversationId,
        role: "user",
        content: content.trim(),
        status: "completed",
      }).returning();

      const previousMessages = await db.select()
        .from(managerMessages)
        .where(eq(managerMessages.conversationId, conversationId))
        .orderBy(managerMessages.createdAt)
        .limit(20);

      let aiResponseContent = "";
      let modelUsed = "";

      try {
        const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
        const { model: modelName } = getModelWithThinking(aiProvider.metadata.name);
        modelUsed = modelName;

        // Build rich prompt using the same logic as WhatsApp public share
        console.log('[PUBLIC AGENT] Building rich prompt using WhatsApp agent logic...');
        const basePrompt = await buildWhatsAppAgentPrompt(agentConfig);
        
        // If share has custom instructions, they can override or complement the base prompt
        let systemPrompt: string;
        if (share.agentInstructions) {
          // Share has custom instructions - append them to the rich base prompt
          systemPrompt = basePrompt + `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ISTRUZIONI SPECIFICHE SHARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${share.agentInstructions}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        } else {
          systemPrompt = basePrompt;
        }
        
        // Append manager style preferences (supports both legacy and new values)
        let styleInstructions = "";
        if (preferences) {
          const { writingStyle, responseLength, customInstructions } = preferences;
          
          // Map writing style to instructions (support both legacy and new values)
          const styleMap: Record<string, string> = {
            // New values from onboarding wizard
            'formale': "Mantieni un tono formale e professionale, appropriato per contesti business.",
            'amichevole': "Usa un tono amichevole e caloroso, come se stessi parlando con un amico fidato.",
            'tecnico': "Usa un linguaggio tecnico e preciso, con terminologia specifica del settore.",
            'casual': "Usa un tono casual e rilassato, come una chat informale.",
            // Legacy values (for backward compatibility)
            'conversational': "Usa un tono amichevole e informale, come se stessi parlando con un collega.",
            'professional': "Mantieni un tono formale e professionale, appropriato per contesti business.",
            'concise': "Sii breve e diretto. Vai subito al punto senza dilungarti.",
            'detailed': "Fornisci spiegazioni approfondite e dettagliate, con esempi quando utile.",
          };
          
          if (writingStyle && styleMap[writingStyle]) {
            styleInstructions += `\n\nStile di comunicazione: ${styleMap[writingStyle]}`;
          }
          
          // Map response length to instructions (support both legacy and new values)
          const lengthMap: Record<string, string> = {
            // New values from onboarding wizard
            'breve': "Mantieni le risposte brevi e concise, 1-2 paragrafi al massimo.",
            'media': "Fornisci risposte di lunghezza moderata, bilanciando completezza e concisione.",
            'dettagliata': "Fornisci risposte complete ed esaustive, coprendo tutti gli aspetti rilevanti con esempi.",
            // Legacy values (for backward compatibility)
            'brief': "Mantieni le risposte brevi, 1-2 paragrafi al massimo.",
            'comprehensive': "Fornisci risposte complete ed esaustive, coprendo tutti gli aspetti rilevanti.",
          };
          
          if (responseLength && lengthMap[responseLength]) {
            styleInstructions += `\nLunghezza risposta: ${lengthMap[responseLength]}`;
          }
          
          // Add custom instructions if provided
          if (customInstructions && customInstructions.trim()) {
            styleInstructions += `\nIstruzioni personalizzate: ${customInstructions.trim()}`;
          }
        }
        
        if (styleInstructions) {
          systemPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 PREFERENZE MANAGER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${styleInstructions}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }

        // GOLD EXCLUSIVE: AI Memory injection for manager
        // Only Gold tier (level 3) gets access to conversation memory
        if (req.silverGoldUser?.level === "3" && req.silverGoldUser?.subscriptionId) {
          try {
            console.log(`[PUBLIC AGENT] Gold manager detected - injecting AI memory for subscription ${req.silverGoldUser.subscriptionId.slice(0, 8)}...`);
            
            // 1. Inject recent conversations (last 5 detailed)
            const historyContext = await memoryContextBuilder.buildManagerHistoryContext(
              req.silverGoldUser.subscriptionId,
              conversationId // exclude current conversation
            );
            
            if (historyContext.hasHistory) {
              systemPrompt += `\n\n${historyContext.contextText}`;
              console.log(`[PUBLIC AGENT] Gold history injected: ${historyContext.conversationCount} recent conversations`);
            }
            
            // 2. Inject daily summaries (last 7 days) - filtered to current agent
            const memoryContext = await memoryContextBuilder.buildManagerDailySummaryContext(
              req.silverGoldUser.subscriptionId,
              7,
              agentConfig.id
            );
            
            if (memoryContext.hasHistory) {
              systemPrompt += `\n\n${memoryContext.contextText}`;
              console.log(`[PUBLIC AGENT] Gold memory injected: ${memoryContext.conversationCount} conversations from daily summaries`);
            }
            
            if (!historyContext.hasHistory && !memoryContext.hasHistory) {
              console.log(`[PUBLIC AGENT] Gold manager has no memory yet`);
            }
          } catch (memoryError: any) {
            console.warn(`[PUBLIC AGENT] Failed to inject Gold memory: ${memoryError.message}`);
          }
        }
        
        console.log(`[PUBLIC AGENT] System prompt built: ${systemPrompt.length} characters`);

        // Check for File Search support
        // SECURITY: ONLY Level 3 (Deluxe) agents can access consultant's full store
        // All other levels (null, "1", "2") can ONLY access agent-specific store
        // Consultant store contains CRM data, client info, consultations - must be protected
        const agentLevel = agentConfig.level; // "1" = Bronze, "2" = Silver, "3" = Deluxe, null = internal/public
        const canAccessConsultantStore = agentLevel === "3"; // STRICT: Only explicit Level 3
        
        console.log(`[PUBLIC AGENT] Access check - Agent level: ${agentLevel}, canAccessConsultantStore: ${canAccessConsultantStore}`);
        
        let fileSearchTool: any = null;
        try {
          // First try agent-specific store (safe for all users)
          const agentStore = await fileSearchSyncService.getWhatsappAgentStore(agentConfig.id);
          if (agentStore && agentStore.documentCount > 0) {
            fileSearchTool = fileSearchService.buildFileSearchTool([agentStore.googleStoreName]);
            console.log(`[PUBLIC AGENT] File Search enabled with agent store: ${agentStore.displayName} (${agentStore.documentCount} docs)`);
          } else if (canAccessConsultantStore) {
            // ONLY Level 3 (Deluxe) can fallback to consultant's store
            // All other levels (null, "1", "2") are blocked from CRM data
            const consultantStore = await fileSearchSyncService.getConsultantStore(agentConfig.consultantId);
            if (consultantStore && consultantStore.documentCount > 0) {
              fileSearchTool = fileSearchService.buildFileSearchTool([consultantStore.googleStoreName]);
              console.log(`[PUBLIC AGENT] File Search enabled with consultant store: ${consultantStore.displayName} (${consultantStore.documentCount} docs)`);
            } else {
              console.log('[PUBLIC AGENT] No File Search store available');
            }
          } else {
            console.log(`[PUBLIC AGENT] Non-Deluxe agent (Level ${agentLevel ?? 'null'}) - consultant store BLOCKED for security`);
          }
        } catch (fsError: any) {
          console.warn(`[PUBLIC AGENT] Error checking File Search stores: ${fsError.message}`);
        }

        const conversationHistory = previousMessages.slice(0, -1).map(msg => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        }));

        conversationHistory.push({
          role: "user",
          parts: [{ text: content.trim() }],
        });

        // Build generation config
        const generationConfig: any = {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 4096,
        };

        // Build request with optional File Search tool
        const requestConfig: any = {
          model: modelName,
          contents: conversationHistory,
          generationConfig,
        };
        
        if (fileSearchTool) {
          requestConfig.tools = [fileSearchTool];
        }

        const result = await aiProvider.client.generateContent(requestConfig);

        aiResponseContent = result.response.text() || "";
        sendSSE({ type: "delta", content: aiResponseContent });
      } catch (aiError: any) {
        console.error("[PUBLIC AGENT] AI generation error:", aiError);
        aiResponseContent = "Mi dispiace, si è verificato un errore durante l'elaborazione della risposta. Riprova più tardi.";
        sendSSE({ type: "delta", content: aiResponseContent });
      }

      const [assistantMessage] = await db.insert(managerMessages).values({
        conversationId,
        role: "assistant",
        content: aiResponseContent,
        status: "completed",
        metadata: { modelUsed },
      }).returning();

      const newMessageCount = (conversation.messageCount || 0) + 2;
      await db.update(managerConversations)
        .set({
          messageCount: newMessageCount,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(managerConversations.id, conversationId));

      if (newMessageCount === 2) {
        const titlePrompt = `Genera un titolo breve (max 5 parole) per questa conversazione basandoti sul primo messaggio dell'utente: "${content.trim()}"`;
        try {
          // Use Gemini Flash Lite for title generation (fast and cheap)
          const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
          
          const titleResult = await aiProvider.client.generateContent({
            model: "gemini-2.0-flash-lite",
            contents: [{ role: "user", parts: [{ text: titlePrompt }] }],
            generationConfig: { 
              systemInstruction: "Rispondi solo con il titolo, senza virgolette o altro testo.",
              temperature: 0.5, 
              maxOutputTokens: 50 
            },
          });

          const generatedTitle = (titleResult.response.text() || "").trim().replace(/["\n]/g, "").slice(0, 100);
          if (generatedTitle) {
            await db.update(managerConversations)
              .set({ title: generatedTitle })
              .where(eq(managerConversations.id, conversationId));
            console.log(`[PUBLIC AGENT] Title generated with Flash Lite: "${generatedTitle}"`);
          }
        } catch (titleError) {
          console.error("[PUBLIC AGENT] Title generation error:", titleError);
        }
      }

      sendSSE({ type: "complete", messageId: assistantMessage.id });
      res.end();
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Send message error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  }
);

router.delete(
  "/:slug/conversations/:conversationId",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const manager = req.manager!;
      const { conversationId } = req.params;

      if (manager.shareId !== share.id) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      const [conversation] = await db.select()
        .from(managerConversations)
        .where(and(
          eq(managerConversations.id, conversationId),
          eq(managerConversations.managerId, manager.managerId),
          eq(managerConversations.shareId, share.id)
        ))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      await db.delete(managerConversations)
        .where(eq(managerConversations.id, conversationId));

      res.json({ message: "Conversation deleted successfully" });
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Delete conversation error:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  }
);

router.post(
  "/:slug/anonymous/chat",
  loadShareAndAgent,
  async (req: ManagerRequest, res: Response) => {
    try {
      const share = req.share!;
      const agentConfig = req.agentConfig!;
      const { content, conversationHistory = [] } = req.body;

      if (share.requiresLogin) {
        return res.status(403).json({ message: "This agent requires login. Please authenticate first." });
      }

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      let aiResponseContent = "Mi dispiace, si è verificato un errore. Riprova più tardi.";

      try {
        const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
        const { model: modelName } = getModelWithThinking(aiProvider.metadata.name);

        const systemPrompt = agentConfig.agentInstructions || 
          `Sei ${agentConfig.agentName}, un assistente AI professionale per ${agentConfig.businessName || "l'azienda"}.
${agentConfig.businessDescription ? `Descrizione: ${agentConfig.businessDescription}` : ""}
Rispondi in modo professionale e utile.`;

        const geminiHistory = conversationHistory.map((msg: { role: string; content: string }) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        }));

        geminiHistory.push({
          role: "user",
          parts: [{ text: content.trim() }],
        });

        const result = await aiProvider.client.generateContent({
          model: modelName,
          contents: geminiHistory,
          generationConfig: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 4096,
          },
        });

        aiResponseContent = result.response.text() || aiResponseContent;

        await db.update(whatsappAgentShares)
          .set({ 
            totalMessagesCount: sql`${whatsappAgentShares.totalMessagesCount} + 1`,
            lastAccessAt: new Date(),
          })
          .where(eq(whatsappAgentShares.id, share.id));

      } catch (aiError: any) {
        console.error("[PUBLIC AGENT] Anonymous AI error:", aiError);
      }

      res.json({
        role: "assistant",
        content: aiResponseContent,
      });
    } catch (error: any) {
      console.error("[PUBLIC AGENT] Anonymous chat error:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  }
);

router.post(
  "/:slug/onboarding-explanation",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const agentConfig = req.agentConfig!;

      // Only Silver/Gold users can access onboarding explanation
      if (!req.silverGoldUser) {
        return res.status(403).json({ message: "Only Silver/Gold users can access onboarding explanation" });
      }

      console.log(`[ONBOARDING] POST /onboarding-explanation - Silver/Gold user: ${req.silverGoldUser.email}, subscriptionId: ${req.silverGoldUser.subscriptionId}`);

      // Use subscriptionId from verified token - more secure than clientEmail from body
      const [subscription] = await db.select()
        .from(clientLevelSubscriptions)
        .where(eq(clientLevelSubscriptions.id, req.silverGoldUser.subscriptionId))
        .limit(1);

      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      console.log(`[ONBOARDING] Generating explanation for ${subscription.clientEmail} with agent ${agentConfig.agentName}`);
      const clientEmail = subscription.clientEmail;

      // Check if already cached
      if (subscription.onboardingExplanation) {
        console.log(`[ONBOARDING] Returning cached explanation for ${clientEmail}`);
        return res.json({ 
          explanation: subscription.onboardingExplanation,
          cached: true 
        });
      }

      // Build context from agent config
      const agentName = agentConfig.agentName || "Assistente AI";
      const businessName = agentConfig.businessName || "";
      const whatWeDo = agentConfig.whatWeDo || "";
      const howWeDoIt = agentConfig.howWeDoIt || "";
      const usp = agentConfig.usp || "";
      const mission = agentConfig.mission || "";
      const businessDescription = agentConfig.businessDescription || "";
      const aiPersonality = agentConfig.aiPersonality || "amico_fidato";

      // Map personality to brand voice
      const brandVoiceMap: Record<string, string> = {
        "amico_fidato": "amichevole e disponibile, come un amico di fiducia",
        "coach_motivazionale": "motivante e incoraggiante, come un coach personale",
        "consulente_professionale": "professionale e competente, come un consulente esperto",
        "mentore_paziente": "paziente e comprensivo, come un mentore saggio",
        "venditore_energico": "entusiasta e dinamico, con energia positiva",
        "consigliere_empatico": "empatico e attento, che capisce le tue esigenze",
        "stratega_diretto": "diretto e strategico, che va dritto al punto",
        "educatore_socratico": "educativo e stimolante, che ti fa riflettere",
        "esperto_tecnico": "tecnico e preciso, con competenza approfondita",
        "compagno_entusiasta": "entusiasta e coinvolgente, sempre pronto ad aiutare"
      };
      const brandVoice = brandVoiceMap[aiPersonality] || "professionale e disponibile";

      // Level name
      const levelName = subscription.level === "3" ? "Gold" : "Silver";

      // Build the prompt
      const prompt = `Genera un messaggio di benvenuto personalizzato in italiano per un utente che ha appena effettuato l'upgrade al livello ${levelName}.

CONTESTO AGENTE:
- Nome agente: ${agentName}
- Brand voice: ${brandVoice}
- Business: ${businessName}
${businessDescription ? `- Descrizione: ${businessDescription}` : ""}
${whatWeDo ? `- Cosa facciamo: ${whatWeDo}` : ""}
${howWeDoIt ? `- Come lo facciamo: ${howWeDoIt}` : ""}
${usp ? `- Proposta unica: ${usp}` : ""}
${mission ? `- Missione: ${mission}` : ""}

REQUISITI:
1. Inizia con un benvenuto caloroso usando il nome dell'agente
2. Spiega brevemente cosa l'assistente AI può fare per l'utente
3. Mantieni il tono ${brandVoice}
4. Sii accogliente verso un nuovo utente ${levelName}
5. Lunghezza: 100-150 parole
6. Scrivi SOLO il messaggio, senza virgolette o prefissi

Genera il messaggio di benvenuto:`;

      try {
        const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);

        const result = await aiProvider.client.generateContent({
          model: "gemini-2.0-flash-lite",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        });

        const explanation = (result.response.text() || "").trim();

        if (!explanation) {
          console.error("[ONBOARDING] Empty response from Gemini");
          return res.status(500).json({ message: "Failed to generate explanation" });
        }

        // Cache the result
        await db.update(clientLevelSubscriptions)
          .set({ 
            onboardingExplanation: explanation,
            updatedAt: new Date(),
          })
          .where(eq(clientLevelSubscriptions.id, subscription.id));

        console.log(`[ONBOARDING] Generated and cached explanation for ${clientEmail} (${explanation.length} chars)`);

        res.json({ 
          explanation,
          cached: false 
        });
      } catch (aiError: any) {
        console.error("[ONBOARDING] AI generation error:", aiError);
        res.status(500).json({ message: "Failed to generate explanation" });
      }
    } catch (error: any) {
      console.error("[ONBOARDING] Error:", error);
      res.status(500).json({ message: "Failed to process onboarding explanation" });
    }
  }
);

router.put(
  "/:slug/onboarding-preferences",
  loadShareAndAgent,
  verifyManagerToken,
  async (req: ManagerRequest, res: Response) => {
    try {
      const { writingStyle, responseLength, customInstructions } = req.body;

      const validWritingStyles = ["default", "professional", "friendly", "direct", "eccentric", "efficient", "nerd", "cynical", "custom"];
      const validResponseLengths = ["short", "balanced", "comprehensive"];

      if (writingStyle && !validWritingStyles.includes(writingStyle)) {
        return res.status(400).json({ message: "Invalid writingStyle" });
      }

      if (responseLength && !validResponseLengths.includes(responseLength)) {
        return res.status(400).json({ message: "Invalid responseLength" });
      }

      // Handle Bronze users
      if (req.bronzeUser) {
        console.log(`[ONBOARDING-PREFERENCES] Saving preferences for Bronze user ${req.bronzeUser.bronzeUserId}`);

        await db.update(bronzeUsers)
          .set({
            writingStyle: writingStyle || null,
            responseLength: responseLength || null,
            customInstructions: customInstructions || null,
            hasCompletedOnboarding: true,
          })
          .where(eq(bronzeUsers.id, req.bronzeUser.bronzeUserId));

        console.log(`[ONBOARDING-PREFERENCES] Preferences saved and onboarding marked complete for Bronze user ${req.bronzeUser.email}`);

        return res.json({
          success: true,
          writingStyle: writingStyle || null,
          responseLength: responseLength || null,
          customInstructions: customInstructions || null,
          hasCompletedOnboarding: true,
        });
      }

      // Handle Silver/Gold users
      if (!req.silverGoldUser) {
        return res.status(403).json({ message: "Not authorized to save onboarding preferences" });
      }

      console.log(`[ONBOARDING-PREFERENCES] Saving preferences for subscription ${req.silverGoldUser.subscriptionId}`);

      await db.update(clientLevelSubscriptions)
        .set({
          writingStyle: writingStyle || null,
          responseLength: responseLength || null,
          customInstructions: customInstructions || null,
          hasCompletedOnboarding: true,
          updatedAt: new Date(),
        })
        .where(eq(clientLevelSubscriptions.id, req.silverGoldUser.subscriptionId));

      console.log(`[ONBOARDING-PREFERENCES] Preferences saved and onboarding marked complete for ${req.silverGoldUser.email}`);

      res.json({
        success: true,
        writingStyle: writingStyle || null,
        responseLength: responseLength || null,
        customInstructions: customInstructions || null,
        hasCompletedOnboarding: true,
      });
    } catch (error: any) {
      console.error("[ONBOARDING-PREFERENCES] Error:", error);
      res.status(500).json({ message: "Failed to save onboarding preferences" });
    }
  }
);

router.get(
  "/:slug/default-preferences",
  loadShareAndAgent,
  async (req: ManagerRequest, res: Response) => {
    try {
      const agentConfig = req.agentConfig;
      const share = req.share;

      let consultantId: string | null = null;

      if (share) {
        consultantId = share.consultantId;
      } else if (agentConfig) {
        consultantId = agentConfig.consultantId;
      }

      if (!consultantId) {
        return res.json({
          success: true,
          preferences: null,
        });
      }

      // Security: Require authentication and validate tenant ownership
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        // No token provided - require authentication
        console.log(`[DEFAULT-PREFERENCES] No token provided, returning 401`);
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        // Check if user's consultantId matches the agent's consultant
        if (decoded.consultantId && decoded.consultantId !== consultantId) {
          console.log(`[DEFAULT-PREFERENCES] Access denied: token consultantId ${decoded.consultantId} does not match agent consultantId ${consultantId}`);
          return res.status(403).json({ success: false, error: "Access denied" });
        }
      } catch (tokenError) {
        // Invalid token - require valid authentication
        console.log(`[DEFAULT-PREFERENCES] Invalid or expired token, returning 401`);
        return res.status(401).json({ success: false, error: "Invalid or expired token" });
      }

      const [license] = await db.select()
        .from(consultantLicenses)
        .where(eq(consultantLicenses.consultantId, consultantId))
        .limit(1);

      const preferences = license?.defaultOnboardingPreferences as {
        writingStyle?: string;
        responseLength?: string;
        customInstructions?: string;
      } | null;

      console.log(`[DEFAULT-PREFERENCES] Fetched default preferences for consultant ${consultantId}:`, preferences ? "found" : "not set");

      res.json({
        success: true,
        preferences: preferences || null,
      });
    } catch (error: any) {
      console.error("[DEFAULT-PREFERENCES] Error:", error);
      res.status(500).json({ message: "Failed to fetch default preferences" });
    }
  }
);

export default router;
