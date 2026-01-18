import express, { Router, Request, Response } from "express";
import crypto from "crypto";
import { db } from "../db";
import { consultantLicenses, superadminStripeConfig, users, clientLevelSubscriptions, employeeLicensePurchases, managerUsers, managerLinkAssignments, whatsappAgentShares, bronzeUsers, consultantWhatsappConfig, managerConversations, managerMessages, whatsappAgentConsultantConversations, consultantDirectLinks } from "@shared/schema";
import { eq, sql, isNotNull, desc, and } from "drizzle-orm";
import { authenticateToken, AuthRequest, requireRole } from "../middleware/auth";
import { decrypt } from "../encryption";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendEmail } from "../services/email-scheduler";
import { sendWelcomeEmail } from "../services/welcome-email-service";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "your-secret-key";

function generateRandomPassword(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function parseClientName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return { firstName: 'Cliente', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

const router: Router = express.Router();

async function getStripeInstance() {
  console.log("[getStripeInstance] Fetching Stripe configuration from superadmin_stripe_config...");
  const [config] = await db.select().from(superadminStripeConfig).limit(1);
  
  if (!config) {
    console.error("[getStripeInstance] No Stripe configuration found in database");
    throw new Error("Stripe not configured - no config record found");
  }
  
  if (!config.stripeSecretKey) {
    console.error("[getStripeInstance] Stripe config found but stripeSecretKey is empty");
    throw new Error("Stripe not configured - secret key is empty");
  }
  
  console.log("[getStripeInstance] Stripe config found, key length:", config.stripeSecretKey.length);
  
  let secretKey = config.stripeSecretKey;
  if (secretKey.includes(':')) {
    console.log("[getStripeInstance] Key appears encrypted, attempting decryption...");
    try {
      secretKey = decrypt(secretKey);
      console.log("[getStripeInstance] Decryption successful, decrypted key length:", secretKey.length);
    } catch (e: any) {
      console.error("[getStripeInstance] Decryption failed:", e?.message);
      console.log("[getStripeInstance] Falling back to plain text key");
    }
  } else {
    console.log("[getStripeInstance] Key appears to be plain text");
  }
  
  // Verify key format (Stripe keys start with sk_test_ or sk_live_)
  const keyPrefix = secretKey.substring(0, 8);
  console.log("[getStripeInstance] Key prefix:", keyPrefix);
  
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    console.warn("[getStripeInstance] Warning: Key doesn't have expected Stripe prefix");
  }
  
  const Stripe = (await import("stripe")).default;
  console.log("[getStripeInstance] Stripe instance created successfully");
  return new Stripe(secretKey, { apiVersion: "2024-12-18.acacia" as any });
}

router.get("/consultant/stripe-connect/status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const [license] = await db.select().from(consultantLicenses)
      .where(eq(consultantLicenses.consultantId, consultantId));
    
    if (!license?.stripeConnectAccountId) {
      return res.json({ connected: false });
    }
    
    res.json({
      connected: true,
      stripeAccountId: license.stripeConnectAccountId,
      detailsSubmitted: license.stripeConnectDetailsSubmitted,
      onboarded: license.stripeConnectOnboarded,
      revenueSharePercentage: license.revenueSharePercentage || 50,
    });
  } catch (error) {
    console.error("[Stripe Connect Status] Error:", error);
    res.status(500).json({ error: "Failed to get status" });
  }
});

router.post("/stripe-connect/onboard", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const stripe = await getStripeInstance();
    
    let [license] = await db.select().from(consultantLicenses)
      .where(eq(consultantLicenses.consultantId, consultantId));
    
    let accountId = license?.stripeConnectAccountId;
    
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "IT",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          consultantId,
        },
      });
      accountId = account.id;
      
      if (!license) {
        await db.insert(consultantLicenses).values({
          consultantId,
          stripeConnectAccountId: accountId,
          stripeConnectOnboarded: false,
          stripeConnectDetailsSubmitted: false,
        });
      } else {
        await db.update(consultantLicenses)
          .set({ stripeConnectAccountId: accountId })
          .where(eq(consultantLicenses.consultantId, consultantId));
      }
    }
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";
    
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/consultant/api-keys-unified?tab=stripe&refresh=true`,
      return_url: `${baseUrl}/api/stripe-connect/callback?account_id=${accountId}`,
      type: "account_onboarding",
    });
    
    res.json({ onboardingUrl: accountLink.url });
  } catch (error) {
    console.error("[Stripe Connect Onboard] Error:", error);
    res.status(500).json({ error: "Failed to start onboarding" });
  }
});

router.get("/stripe-connect/callback", async (req, res) => {
  try {
    const { account_id } = req.query;
    
    if (!account_id) {
      return res.redirect("/consultant/api-keys-unified?tab=stripe&error=missing_account");
    }
    
    const stripe = await getStripeInstance();
    const account = await stripe.accounts.retrieve(account_id as string);
    
    const [license] = await db.select().from(consultantLicenses)
      .where(eq(consultantLicenses.stripeConnectAccountId, account_id as string));
    
    if (license) {
      await db.update(consultantLicenses)
        .set({
          stripeConnectDetailsSubmitted: account.details_submitted || false,
          stripeConnectOnboarded: account.charges_enabled || false,
        })
        .where(eq(consultantLicenses.stripeConnectAccountId, account_id as string));
    }
    
    res.redirect("/consultant/api-keys-unified?tab=stripe&success=true");
  } catch (error) {
    console.error("[Stripe Connect Callback] Error:", error);
    res.redirect("/consultant/api-keys-unified?tab=stripe&error=callback_failed");
  }
});

router.post("/consultant/stripe-connect/disconnect", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    await db.update(consultantLicenses)
      .set({
        stripeConnectAccountId: null,
        stripeConnectOnboarded: false,
        stripeConnectDetailsSubmitted: false,
      })
      .where(eq(consultantLicenses.consultantId, consultantId));
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Stripe Connect Disconnect] Error:", error);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

router.post("/stripe/create-checkout", async (req: Request, res: Response) => {
  try {
    const { 
      consultantSlug, 
      agentId, 
      level, 
      clientEmail, 
      clientName, 
      billingPeriod,
      firstName,
      lastName,
      password,
      phone 
    } = req.body;
    
    if (!consultantSlug || !level) {
      return res.status(400).json({ error: "Missing required fields: consultantSlug, level" });
    }
    
    if (!clientEmail || !firstName || !lastName || !password || !phone) {
      return res.status(400).json({ error: "Missing required registration fields: email, firstName, lastName, password, phone" });
    }
    
    if (level !== "2" && level !== "3") {
      return res.status(400).json({ error: "Invalid level. Must be '2' or '3'" });
    }
    
    const validBillingPeriod = billingPeriod === 'yearly' ? 'yearly' : 'monthly';
    
    const [consultant] = await db.select().from(users)
      .where(eq(users.pricingPageSlug, consultantSlug));
    
    if (!consultant) {
      return res.status(404).json({ error: "Consultant not found" });
    }
    
    const [license] = await db.select().from(consultantLicenses)
      .where(eq(consultantLicenses.consultantId, consultant.id));
    
    if (!license?.stripeConnectAccountId) {
      return res.status(400).json({ error: "Consultant has not connected Stripe account" });
    }
    
    if (!license.stripeConnectOnboarded) {
      return res.status(400).json({ error: "Consultant Stripe account is not fully onboarded" });
    }
    
    const pricingConfig = consultant.pricingPageConfig as {
      level2PriceCents?: number;
      level3PriceCents?: number;
      level2MonthlyPriceCents?: number;
      level3MonthlyPriceCents?: number;
      level2YearlyPriceCents?: number;
      level3YearlyPriceCents?: number;
      level2Name?: string;
      level3Name?: string;
    } | null;
    
    let price: number;
    if (level === "2") {
      if (validBillingPeriod === 'yearly') {
        price = pricingConfig?.level2YearlyPriceCents || (pricingConfig?.level2PriceCents ? pricingConfig.level2PriceCents * 12 : 29900);
      } else {
        price = pricingConfig?.level2MonthlyPriceCents || pricingConfig?.level2PriceCents || 2900;
      }
    } else {
      if (validBillingPeriod === 'yearly') {
        price = pricingConfig?.level3YearlyPriceCents || (pricingConfig?.level3PriceCents ? pricingConfig.level3PriceCents * 12 : 59900);
      } else {
        price = pricingConfig?.level3MonthlyPriceCents || pricingConfig?.level3PriceCents || 5900;
      }
    }
    
    const revenueSharePercentage = license.revenueSharePercentage || 50;
    const applicationFeePercent = revenueSharePercentage;
    
    const stripe = await getStripeInstance();
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";
    
    const productName = level === "2" 
      ? (pricingConfig?.level2Name || "Licenza Argento")
      : (pricingConfig?.level3Name || "Licenza Deluxe");
    
    const intervalLabel = validBillingPeriod === 'yearly' ? 'anno' : 'mese';
    
    // Hash password before storing in metadata (for security)
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: productName,
            description: `Abbonamento ${level === "2" ? "Argento" : "Deluxe"} ai servizi AI (${intervalLabel})`,
          },
          unit_amount: price,
          recurring: {
            interval: validBillingPeriod === 'yearly' ? 'year' : 'month',
          },
        },
        quantity: 1,
      }],
      subscription_data: {
        application_fee_percent: applicationFeePercent,
        transfer_data: {
          destination: license.stripeConnectAccountId,
        },
        metadata: {
          consultantId: consultant.id,
          consultantSlug,
          clientEmail,
          clientName: clientName || "",
          level,
          agentId: agentId || "",
          billingPeriod: validBillingPeriod,
          firstName,
          lastName,
          hashedPassword,
          phone: phone || "",
        },
      },
      customer_email: clientEmail || undefined,
      metadata: {
        consultantId: consultant.id,
        consultantSlug,
        clientEmail,
        clientName: clientName || "",
        level,
        agentId: agentId || "",
        billingPeriod: validBillingPeriod,
        firstName,
        lastName,
        hashedPassword,
        phone: phone || "",
      },
      success_url: `${baseUrl}/c/${consultantSlug}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/c/${consultantSlug}/pricing?canceled=true`,
    });
    
    console.log(`[Stripe Checkout] Subscription session created for ${clientEmail} (Level ${level}, ${validBillingPeriod}) - Consultant: ${consultant.id}`);
    
    res.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    res.status(500).json({ error: "Failed to create checkout" });
  }
});

router.post("/stripe/upgrade-subscription", async (req: Request, res: Response) => {
  try {
    const { slug, targetLevel } = req.body;
    
    console.log("[Stripe Upgrade] Request received:", { slug, targetLevel });
    
    if (!slug || !targetLevel) {
      return res.status(400).json({ error: "Missing required fields: slug, targetLevel" });
    }
    
    if (targetLevel !== "2" && targetLevel !== "3") {
      return res.status(400).json({ error: "Invalid targetLevel. Must be '2' or '3'" });
    }
    
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    console.log("[Stripe Upgrade] Token decoded:", { type: decoded.type, role: decoded.role, bronzeUserId: decoded.bronzeUserId, managerId: decoded.managerId });
    
    // Validate slug is a string
    const slugStr = String(slug || "").trim();
    if (!slugStr) {
      return res.status(400).json({ error: "Invalid slug" });
    }
    
    // First try whatsappAgentShares (Manager system)
    let consultantId: string | null = null;
    let agentConfigId: string | null = null;
    
    const [share] = await db.select()
      .from(whatsappAgentShares)
      .where(eq(whatsappAgentShares.slug, slugStr))
      .limit(1);
    
    if (share) {
      consultantId = share.consultantId;
      agentConfigId = share.agentConfigId;
    } else {
      // Try consultantWhatsappConfig (Bronze/Level 1 system) with public_slug
      const [agentConfig] = await db.select()
        .from(consultantWhatsappConfig)
        .where(eq(consultantWhatsappConfig.publicSlug, slugStr))
        .limit(1);
      
      if (agentConfig) {
        consultantId = agentConfig.consultantId;
        agentConfigId = agentConfig.id;
        console.log("[Stripe Upgrade] Found agent via Bronze public_slug:", slugStr, "agentConfigId:", agentConfigId);
      }
    }
    
    if (!consultantId) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    // Validate consultantId is a valid string
    if (!consultantId || typeof consultantId !== "string") {
      console.error("[Stripe Upgrade] Invalid consultantId from share:", consultantId);
      return res.status(500).json({ error: "Invalid consultant configuration" });
    }
    
    console.log("[Stripe Upgrade] Looking up consultant:", consultantId);
    
    const [consultant] = await db.select().from(users)
      .where(eq(users.id, consultantId));
    
    if (!consultant) {
      return res.status(404).json({ error: "Consultant not found" });
    }
    
    const [license] = await db.select().from(consultantLicenses)
      .where(eq(consultantLicenses.consultantId, consultantId));
    
    if (!license?.stripeConnectAccountId || !license.stripeConnectOnboarded) {
      return res.status(400).json({ error: "Consultant Stripe account not configured" });
    }
    
    let userEmail: string | null = null;
    let existingSubscription: typeof clientLevelSubscriptions.$inferSelect | null = null;
    let isBronzeUser = false;
    
    if (decoded.type === "bronze" && decoded.bronzeUserId) {
      // Validate bronzeUserId is a valid string
      const bronzeUserIdStr = String(decoded.bronzeUserId || "").trim();
      if (!bronzeUserIdStr) {
        return res.status(401).json({ error: "Invalid bronze user ID" });
      }
      
      console.log("[Stripe Upgrade] Looking up bronze user:", bronzeUserIdStr);
      
      const [bronzeUser] = await db.select()
        .from(bronzeUsers)
        .where(eq(bronzeUsers.id, bronzeUserIdStr))
        .limit(1);
      
      if (!bronzeUser) {
        return res.status(404).json({ error: "Bronze user not found" });
      }
      
      if (bronzeUser.consultantId !== consultantId) {
        return res.status(403).json({ error: "User does not belong to this consultant" });
      }
      
      userEmail = bronzeUser.email;
      isBronzeUser = true;
      
      // Safely get lowercase email
      const emailLower = (bronzeUser.email || "").toLowerCase().trim();
      if (!emailLower) {
        return res.status(500).json({ error: "Invalid user email" });
      }
      
      console.log("[Stripe Upgrade] Checking existing subscription for:", { email: emailLower, consultantId });
      
      const [existingSub] = await db.select()
        .from(clientLevelSubscriptions)
        .where(and(
          eq(clientLevelSubscriptions.clientEmail, emailLower),
          eq(clientLevelSubscriptions.consultantId, consultantId),
          eq(clientLevelSubscriptions.status, "active")
        ))
        .limit(1);
      
      existingSubscription = existingSub || null;
    } else if ((decoded.type === "silver" || decoded.type === "gold") && decoded.subscriptionId) {
      // Handle Silver/Gold subscription upgrades
      const subscriptionIdStr = String(decoded.subscriptionId || "").trim();
      if (!subscriptionIdStr) {
        return res.status(401).json({ error: "Invalid subscription ID" });
      }
      
      console.log("[Stripe Upgrade] Looking up Silver/Gold subscription:", subscriptionIdStr);
      
      const [subscription] = await db.select()
        .from(clientLevelSubscriptions)
        .where(eq(clientLevelSubscriptions.id, subscriptionIdStr))
        .limit(1);
      
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      
      if (subscription.consultantId !== consultantId) {
        return res.status(403).json({ error: "Subscription does not belong to this consultant" });
      }
      
      userEmail = subscription.clientEmail;
      existingSubscription = subscription;
      
      console.log("[Stripe Upgrade] Found Silver/Gold subscription:", { 
        email: userEmail, 
        level: subscription.level,
        status: subscription.status 
      });
    } else if (decoded.role === "manager" && decoded.managerId) {
      // Validate managerId is a valid string
      const managerIdStr = String(decoded.managerId || "").trim();
      if (!managerIdStr) {
        return res.status(401).json({ error: "Invalid manager ID" });
      }
      
      console.log("[Stripe Upgrade] Looking up manager:", managerIdStr);
      
      const [manager] = await db.select()
        .from(managerUsers)
        .where(eq(managerUsers.id, managerIdStr))
        .limit(1);
      
      if (!manager) {
        return res.status(404).json({ error: "Manager not found" });
      }
      
      if (decoded.consultantId && decoded.consultantId !== consultantId) {
        return res.status(403).json({ error: "Manager does not belong to this consultant" });
      }
      
      userEmail = manager.email;
      
      // Safely get lowercase email
      const emailLower = (manager.email || "").toLowerCase().trim();
      if (!emailLower) {
        return res.status(500).json({ error: "Invalid manager email" });
      }
      
      console.log("[Stripe Upgrade] Checking existing subscription for manager:", { email: emailLower, consultantId });
      
      const [existingSub] = await db.select()
        .from(clientLevelSubscriptions)
        .where(and(
          eq(clientLevelSubscriptions.clientEmail, emailLower),
          eq(clientLevelSubscriptions.consultantId, consultantId),
          eq(clientLevelSubscriptions.status, "active")
        ))
        .limit(1);
      
      existingSubscription = existingSub || null;
    } else {
      return res.status(401).json({ error: "Invalid token type" });
    }
    
    const pricingConfig = consultant.pricingPageConfig as {
      level2MonthlyPriceCents?: number;
      level3MonthlyPriceCents?: number;
      level2PriceCents?: number;
      level3PriceCents?: number;
      level2Name?: string;
      level3Name?: string;
    } | null;
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";
    
    // Check if user originally paid via Direct Link - if so, use Direct Links for upgrade too
    const isDirectLinkUser = existingSubscription?.paymentSource === "direct_link";
    console.log("[Stripe Upgrade] paymentSource check:", {
      paymentSource: existingSubscription?.paymentSource,
      isDirectLinkUser,
      existingLevel: existingSubscription?.level,
      targetLevel
    });
    
    if (isDirectLinkUser && existingSubscription) {
      // Use Direct Links for upgrade to preserve 100% consultant commission
      const targetTier = targetLevel === "2" ? "silver" : "gold";
      
      // Find the consultant's Direct Link for the target tier
      const [directLink] = await db.select()
        .from(consultantDirectLinks)
        .where(and(
          eq(consultantDirectLinks.consultantId, consultantId),
          eq(consultantDirectLinks.tier, targetTier),
          eq(consultantDirectLinks.isActive, true)
        ))
        .limit(1);
      
      if (directLink?.paymentLinkUrl) {
        console.log("[Stripe Upgrade] Using Direct Link for upgrade:", {
          tier: targetTier,
          paymentLinkUrl: directLink.paymentLinkUrl.substring(0, 50) + "..."
        });
        
        // Generate upgrade token to link the payment to this subscription
        const upgradeToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        
        // Store upgrade token in database with source_type to distinguish from Bronze upgrades
        await db.execute(sql`
          INSERT INTO upgrade_tokens (id, bronze_user_id, consultant_id, target_tier, expires_at, source_type)
          VALUES (${upgradeToken}, ${existingSubscription.id}, ${consultantId}, ${targetTier}, ${expiresAt}, 'subscription')
        `);
        
        // Append upgrade token and prefilled email to Direct Link URL
        const emailParam = userEmail ? `&prefilled_email=${encodeURIComponent(userEmail)}` : "";
        const upgradeUrl = `${directLink.paymentLinkUrl}?client_reference_id=${upgradeToken}${emailParam}`;
        
        console.log("[Stripe Upgrade] Direct Link upgrade URL generated for Silver→Gold with email:", userEmail);
        return res.json({ checkoutUrl: upgradeUrl });
      } else {
        console.log("[Stripe Upgrade] No Direct Link found for tier:", targetTier, "- falling back to Stripe Connect");
      }
    }
    
    if (!existingSubscription || !existingSubscription.stripeSubscriptionId) {
      const price = targetLevel === "2" 
        ? (pricingConfig?.level2MonthlyPriceCents || pricingConfig?.level2PriceCents || 2900)
        : (pricingConfig?.level3MonthlyPriceCents || pricingConfig?.level3PriceCents || 5900);
      
      const productName = targetLevel === "2" 
        ? (pricingConfig?.level2Name || "Licenza Argento")
        : (pricingConfig?.level3Name || "Licenza Oro");
      
      const stripe = await getStripeInstance();
      
      const revenueSharePercentage = license.revenueSharePercentage || 50;
      
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: {
              name: productName,
              description: `Abbonamento ${targetLevel === "2" ? "Argento" : "Oro"} ai servizi AI`,
            },
            unit_amount: price,
            recurring: { interval: "month" },
          },
          quantity: 1,
        }],
        subscription_data: {
          application_fee_percent: revenueSharePercentage,
          transfer_data: {
            destination: license.stripeConnectAccountId,
          },
          metadata: {
            consultantId,
            clientEmail: userEmail,
            level: targetLevel,
            upgradeFromBronze: isBronzeUser ? "true" : "false",
          },
        },
        customer_email: userEmail || undefined,
        metadata: {
          consultantId,
          clientEmail: userEmail,
          level: targetLevel,
          upgradeFromBronze: isBronzeUser ? "true" : "false",
          agentConfigId: agentConfigId || "",
        },
        success_url: targetLevel === "3" 
          ? `${baseUrl}/login?upgrade=gold&session_id={CHECKOUT_SESSION_ID}` 
          : `${baseUrl}/agent/${slug}?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/agent/${slug}?upgrade=canceled`,
      });
      
      console.log(`[Stripe Upgrade] New checkout session for ${userEmail} (Level ${targetLevel})`);
      return res.json({ checkoutUrl: session.url });
    }
    
    if (existingSubscription.level === "3") {
      return res.status(400).json({ error: "Already at the highest level" });
    }
    
    if (existingSubscription.level === "2" && targetLevel === "2") {
      return res.status(400).json({ error: "Already at Silver level" });
    }
    
    const stripe = await getStripeInstance();
    const stripeSubscription = await stripe.subscriptions.retrieve(existingSubscription.stripeSubscriptionId);
    
    if (stripeSubscription.status !== "active") {
      return res.status(400).json({ error: "Current subscription is not active" });
    }
    
    const newPrice = targetLevel === "2"
      ? (pricingConfig?.level2MonthlyPriceCents || pricingConfig?.level2PriceCents || 2900)
      : (pricingConfig?.level3MonthlyPriceCents || pricingConfig?.level3PriceCents || 5900);
    
    const productName = targetLevel === "2" 
      ? (pricingConfig?.level2Name || "Licenza Argento")
      : (pricingConfig?.level3Name || "Licenza Oro");
    
    const newPriceObj = await stripe.prices.create({
      currency: "eur",
      unit_amount: newPrice,
      recurring: { interval: "month" },
      product_data: {
        name: productName,
      },
    });
    
    console.log("[Stripe Upgrade] Updating Stripe subscription:", {
      subscriptionId: existingSubscription.stripeSubscriptionId,
      itemId: stripeSubscription.items.data[0]?.id,
      newPriceId: newPriceObj.id,
    });
    
    // Use always_invoice to charge the proration difference immediately
    const updatedSubscription = await stripe.subscriptions.update(existingSubscription.stripeSubscriptionId, {
      items: [{
        id: stripeSubscription.items.data[0].id,
        price: newPriceObj.id,
      }],
      proration_behavior: "always_invoice",
      payment_behavior: "error_if_incomplete",
      metadata: {
        level: targetLevel,
        upgradedAt: new Date().toISOString(),
      },
    });
    
    // Check if the invoice was paid successfully
    if (updatedSubscription.status !== "active") {
      console.error("[Stripe Upgrade] Subscription update failed, status:", updatedSubscription.status);
      return res.status(400).json({ error: "Payment failed. Please check your payment method." });
    }
    
    console.log("[Stripe Upgrade] Proration invoice created and paid, subscription status:", updatedSubscription.status);
    
    // Validate subscription ID before database update
    const subscriptionIdStr = String(existingSubscription.id || "").trim();
    if (!subscriptionIdStr) {
      console.error("[Stripe Upgrade] Invalid subscription ID for database update:", existingSubscription.id);
      return res.status(500).json({ error: "Invalid subscription ID" });
    }
    
    console.log("[Stripe Upgrade] Updating database subscription:", { id: subscriptionIdStr, newLevel: targetLevel });
    
    await db.update(clientLevelSubscriptions)
      .set({
        level: targetLevel as "2" | "3",
        updatedAt: new Date(),
      })
      .where(eq(clientLevelSubscriptions.id, subscriptionIdStr));
    
    console.log(`[Stripe Upgrade] Subscription ${existingSubscription.stripeSubscriptionId} upgraded from ${existingSubscription.level} to ${targetLevel} with proration`);
    
    // For Gold (level 3) upgrades, create a user record in the users table
    if (targetLevel === "3" && userEmail) {
      const emailLower = userEmail.toLowerCase().trim();
      
      // Check if user already exists
      const [existingUser] = await db.select()
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);
      
      if (!existingUser) {
        // Get password from subscription or bronze user
        let passwordHash = existingSubscription?.passwordHash;
        let firstName = existingSubscription?.clientName?.split(' ')[0] || 'Cliente';
        let lastName = existingSubscription?.clientName?.split(' ').slice(1).join(' ') || '';
        
        // If no password in subscription, try bronze user
        if (!passwordHash && isBronzeUser && decoded.bronzeUserId) {
          const [bronzeUser] = await db.select()
            .from(bronzeUsers)
            .where(eq(bronzeUsers.id, decoded.bronzeUserId))
            .limit(1);
          
          if (bronzeUser) {
            passwordHash = bronzeUser.passwordHash;
            firstName = bronzeUser.firstName || firstName;
            lastName = bronzeUser.lastName || lastName;
          }
        }
        
        if (passwordHash) {
          // Create the Gold user in users table
          const username = emailLower.split('@')[0] + '_' + Date.now();
          
          await db.insert(users).values({
            username,
            email: emailLower,
            password: passwordHash,
            firstName,
            lastName,
            role: "client",
            consultantId,
            isActive: true,
            enrolledAt: new Date(),
          });
          
          console.log(`[Stripe Upgrade] Created Gold user in users table: ${emailLower}`);
        } else {
          console.warn(`[Stripe Upgrade] No password hash found for Gold user: ${emailLower}`);
        }
      } else {
        console.log(`[Stripe Upgrade] User already exists in users table: ${emailLower}`);
      }
    }
    
    return res.json({ success: true, message: `Upgraded to level ${targetLevel}` });
    
  } catch (error: any) {
    console.error("[Stripe Upgrade] Error:", error);
    console.error("[Stripe Upgrade] Error details:", { code: error.code, severity: error.severity, position: error.position, message: error.message });
    res.status(500).json({ error: error.message || "Failed to upgrade subscription" });
  }
});

router.post("/stripe/webhook", async (req: Request, res: Response) => {
  try {
    const sig = req.headers["stripe-signature"] as string;
    
    if (!sig) {
      console.error("[Stripe Webhook] Missing stripe-signature header");
      return res.status(400).send("Missing stripe-signature header");
    }
    
    const [config] = await db.select().from(superadminStripeConfig).limit(1);
    const webhookSecret = config?.stripeWebhookSecret;
    
    if (!webhookSecret) {
      console.error("[Stripe Webhook] Webhook secret not configured");
      return res.status(400).send("Webhook secret not configured");
    }
    
    let decryptedWebhookSecret = webhookSecret;
    if (webhookSecret.includes(':')) {
      try {
        decryptedWebhookSecret = decrypt(webhookSecret);
      } catch (e) {
        console.log("[Stripe Webhook] Using plain text webhook secret");
      }
    }
    
    const stripe = await getStripeInstance();
    
    let event;
    try {
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        console.error("[Stripe Webhook] Raw body not available");
        return res.status(400).send("Raw body required");
      }
      event = stripe.webhooks.constructEvent(rawBody, sig as string, decryptedWebhookSecret);
    } catch (err: any) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    console.log(`[Stripe Webhook] Received event: ${event.type}`);
    
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const metadata = session.metadata || {};
        
        if (metadata.type === "employee_licenses") {
          const { purchaseId } = metadata;
          
          const [purchase] = await db.select()
            .from(employeeLicensePurchases)
            .where(eq(employeeLicensePurchases.id, purchaseId));
          
          if (!purchase || purchase.status === "completed") {
            console.log("[Stripe Webhook] Purchase not found or already completed:", purchaseId);
            break;
          }
          
          const qty = purchase.quantity;
          const consultantId = purchase.consultantId;
          
          await db.update(employeeLicensePurchases)
            .set({ 
              status: "completed",
              stripePaymentIntentId: session.payment_intent 
            })
            .where(eq(employeeLicensePurchases.id, purchaseId));
          
          await db.update(consultantLicenses)
            .set({ 
              employeeTotal: sql`employee_total + ${qty}` 
            })
            .where(eq(consultantLicenses.consultantId, consultantId));
          
          console.log(`[Stripe Webhook] Employee licenses added: ${qty} for consultant ${consultantId}`);
          break;
        }
        
        const { 
          consultantId, 
          clientEmail, 
          clientName, 
          level, 
          agentId,
          agentConfigId,
          billingPeriod,
          firstName: metaFirstName,
          lastName: metaLastName,
          hashedPassword: metaHashedPassword,
          phone: metaPhone
        } = metadata;
        
        // Log full metadata for debugging
        console.log(`[Stripe Webhook] Checkout metadata:`, JSON.stringify({
          consultantId,
          clientEmail,
          level,
          agentId,
          billingPeriod,
          sessionId: session.id,
          subscriptionId: session.subscription
        }));
        
        if (!consultantId || !clientEmail) {
          console.error("[Stripe Webhook] Missing consultantId or clientEmail in checkout session");
          break;
        }
        
        // CRITICAL: Validate level is explicitly set - never default to Gold
        if (!level || !["2", "3"].includes(level)) {
          console.error(`[Stripe Webhook] CRITICAL: Invalid or missing level in metadata: "${level}". Rejecting webhook to prevent wrong tier assignment.`);
          break;
        }
        
        // Idempotency check: skip if subscription already exists for this Stripe subscription ID
        // This is the primary idempotency mechanism - Stripe subscription IDs are unique
        const stripeSubscriptionId = session.subscription || null;
        if (stripeSubscriptionId) {
          const [existingSubscription] = await db.select()
            .from(clientLevelSubscriptions)
            .where(eq(clientLevelSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
            .limit(1);
          
          if (existingSubscription) {
            console.log(`[Stripe Webhook] Subscription already processed: ${stripeSubscriptionId}. Acknowledging to prevent retry.`);
            break;
          }
        }
        
        // Secondary check: prevent duplicate active subscriptions for same email+consultant
        // This catches edge cases where user opens multiple checkout sessions before first completes
        const [existingActive] = await db.select()
          .from(clientLevelSubscriptions)
          .where(and(
            eq(clientLevelSubscriptions.clientEmail, clientEmail),
            eq(clientLevelSubscriptions.consultantId, consultantId),
            eq(clientLevelSubscriptions.status, "active")
          ))
          .limit(1);
        
        if (existingActive) {
          console.log(`[Stripe Webhook] Active subscription already exists for ${clientEmail}. Processing as duplicate - consider refunding extra Stripe subscription.`);
          // Log but don't create duplicate - the user should get a refund for the extra charge
          break;
        }
        
        // Check if Bronze user exists to migrate preferences and conversations
        const [existingBronzeUser] = await db.select()
          .from(bronzeUsers)
          .where(and(
            eq(bronzeUsers.email, clientEmail),
            eq(bronzeUsers.consultantId, consultantId)
          ))
          .limit(1);
        
        // Use password from registration form if available, 
        // OR use existing Bronze user password if upgrading,
        // otherwise generate temp password (but NEVER send it in email)
        const isUpgrade = !!existingBronzeUser;
        const userProvidedPassword = !!metaHashedPassword;
        const hashedPassword = metaHashedPassword || existingBronzeUser?.passwordHash || await bcrypt.hash(generateRandomPassword(8), 10);
        
        // Migrate Bronze preferences if user is upgrading
        const migratedPreferences = existingBronzeUser ? {
          hasCompletedOnboarding: existingBronzeUser.hasCompletedOnboarding || false,
          writingStyle: existingBronzeUser.writingStyle || null,
          responseLength: existingBronzeUser.responseLength || null,
          customInstructions: existingBronzeUser.customInstructions || null,
        } : {
          hasCompletedOnboarding: false,
          writingStyle: null,
          responseLength: null,
          customInstructions: null,
        };
        
        if (existingBronzeUser) {
          console.log(`[Stripe Webhook] Bronze->Silver/Gold UPGRADE for ${clientEmail}: using existing password, migrating preferences`);
        }
        
        const [subscription] = await db.insert(clientLevelSubscriptions).values({
          consultantId,
          clientEmail,
          clientName: clientName || null,
          phone: metaPhone || null,
          level: level as "2" | "3",
          status: "active",
          startDate: new Date(),
          stripeCustomerId: session.customer || null,
          stripeSubscriptionId: session.subscription || null,
          tempPassword: null, // NEVER store or send plain text passwords
          passwordHash: hashedPassword,
          paymentSource: "stripe_connect", // Track origin for revenue sharing vs 100% commission
          // If upgrading from Bronze or user provided password, they don't need to change
          // Otherwise they need to change the auto-generated password
          mustChangePassword: !isUpgrade && !userProvidedPassword,
          // Migrate onboarding state from Bronze or initialize fresh
          ...migratedPreferences,
        }).returning();
        
        // Migrate Bronze conversations to new subscription ID
        if (existingBronzeUser) {
          try {
            // Find the agent's share to update shareId as well (needed for conversation queries)
            // Silver/Gold users use the actual share, not virtual bronze share
            // Use agentConfigId from metadata, falling back to agentId for backwards compatibility
            const effectiveAgentId = agentConfigId || agentId;
            const [agentShare] = effectiveAgentId ? await db.select({ id: whatsappAgentShares.id })
              .from(whatsappAgentShares)
              .where(eq(whatsappAgentShares.agentConfigId, effectiveAgentId))
              .limit(1) : [];
            
            console.log(`[Stripe Webhook] Migration lookup - agentConfigId: ${agentConfigId}, agentId: ${agentId}, effectiveAgentId: ${effectiveAgentId}, agentShare found: ${!!agentShare}`);
            
            // MIGRATION 1: Migrate from managerConversations (legacy)
            const updateData: { managerId: string; shareId?: string } = { managerId: subscription.id };
            if (agentShare) {
              updateData.shareId = agentShare.id;
            }
            
            const migratedManagerConversations = await db.update(managerConversations)
              .set(updateData)
              .where(eq(managerConversations.managerId, existingBronzeUser.id))
              .returning({ id: managerConversations.id });
            
            console.log(`[Stripe Webhook] Migrated ${migratedManagerConversations.length} manager_conversations from Bronze ${existingBronzeUser.id} to Silver/Gold ${subscription.id}`);
            
            // MIGRATION 2: Migrate from whatsappAgentConsultantConversations (actual Bronze conversations)
            // Bronze conversations have externalVisitorId format: manager_${bronzeUserId}_${timestamp}
            // and shareId is NULL
            const bronzeConversations = await db.select({ id: whatsappAgentConsultantConversations.id, externalVisitorId: whatsappAgentConsultantConversations.externalVisitorId })
              .from(whatsappAgentConsultantConversations)
              .where(
                and(
                  sql`${whatsappAgentConsultantConversations.externalVisitorId} LIKE ${'manager_' + existingBronzeUser.id + '_%'}`,
                  sql`${whatsappAgentConsultantConversations.shareId} IS NULL`
                )
              );
            
            if (bronzeConversations.length > 0 && agentShare) {
              // Update shareId AND externalVisitorId to link conversations to the new Silver/Gold subscription
              // The externalVisitorId must be updated because the conversation query uses the new subscriptionId
              for (const conv of bronzeConversations) {
                const newExternalVisitorId = conv.externalVisitorId.replace(
                  `manager_${existingBronzeUser.id}`,
                  `manager_${subscription.id}`
                );
                await db.update(whatsappAgentConsultantConversations)
                  .set({ 
                    shareId: agentShare.id,
                    externalVisitorId: newExternalVisitorId
                  })
                  .where(eq(whatsappAgentConsultantConversations.id, conv.id));
              }
              
              console.log(`[Stripe Webhook] Migrated ${bronzeConversations.length} whatsapp_conversations from Bronze ${existingBronzeUser.id} to Silver/Gold ${subscription.id} with shareId ${agentShare.id}`);
            } else {
              console.log(`[Stripe Webhook] No Bronze whatsapp_conversations found for ${existingBronzeUser.id} (agentShare: ${!!agentShare}, conversations: ${bronzeConversations.length})`);
            }
          } catch (migrationError: any) {
            console.error(`[Stripe Webhook] Failed to migrate conversations:`, migrationError.message);
          }
        }
        
        // Welcome email is now sent after account creation (see below)
        
        if (level === "2") {
          await db.update(consultantLicenses)
            .set({
              level2Used: sql`${consultantLicenses.level2Used} + 1`,
            })
            .where(eq(consultantLicenses.consultantId, consultantId));
        } else if (level === "3") {
          await db.update(consultantLicenses)
            .set({
              level3Used: sql`${consultantLicenses.level3Used} + 1`,
            })
            .where(eq(consultantLicenses.consultantId, consultantId));
        }
        
        const baseUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : "http://localhost:5000";
        
        try {
          // Use metadata names if available, otherwise parse from clientName
          const displayFirstName = metaFirstName || parseClientName(clientName || '').firstName || clientEmail.split('@')[0];
          const displayLastName = metaLastName || parseClientName(clientName || '').lastName || '';
          const fullDisplayName = `${displayFirstName} ${displayLastName}`.trim() || clientName || clientEmail.split('@')[0];
          
          if (level === "2") {
            const existing = await db.select()
              .from(managerUsers)
              .where(and(
                eq(managerUsers.email, clientEmail),
                eq(managerUsers.consultantId, consultantId)
              ))
              .limit(1);
            
            if (existing.length === 0) {
              const [manager] = await db.insert(managerUsers).values({
                consultantId,
                name: fullDisplayName,
                email: clientEmail,
                passwordHash: hashedPassword,
                status: "active",
                metadata: {
                  createdVia: "stripe_subscription",
                  subscriptionId: subscription.id,
                  agentId: agentId || null,
                  firstName: metaFirstName || null,
                  lastName: metaLastName || null,
                  phone: metaPhone || null,
                },
              }).returning();
              
              if (agentId) {
                const [agentShare] = await db.select()
                  .from(whatsappAgentShares)
                  .where(eq(whatsappAgentShares.agentConfigId, agentId))
                  .limit(1);
                
                if (agentShare) {
                  try {
                    await db.insert(managerLinkAssignments).values({
                      managerId: manager.id,
                      shareId: agentShare.id,
                      assignedBy: consultantId,
                    });
                  } catch (assignError) {
                    console.log(`[Stripe Webhook] Manager assignment failed:`, assignError);
                  }
                }
              }
              
              console.log(`[Stripe Webhook] Manager created for ${clientEmail}`);
            }
            
            const loginUrl = `${baseUrl}/login`;
            
            // Send Silver welcome email using centralized service
            // SECURITY: Never send passwords in email - user uses their existing password (from Bronze) or the one they set during registration
            console.log(`[Stripe Webhook] Sending Silver welcome email to ${clientEmail} (upgrade: ${isUpgrade})`);
            sendWelcomeEmail({
              consultantId,
              recipientEmail: clientEmail,
              recipientName: fullDisplayName,
              tier: "silver",
              loginUrl,
            }).catch(err => {
              console.error("[Stripe Webhook] Failed to send Silver welcome email:", err);
            });
            
          } else if (level === "3") {
            const existingUser = await db.select()
              .from(users)
              .where(eq(users.email, clientEmail))
              .limit(1);
            
            if (existingUser.length === 0) {
              const username = clientEmail.split('@')[0] + '_' + Date.now().toString(36);
              
              await db.insert(users).values({
                username,
                email: clientEmail,
                password: hashedPassword,
                firstName: displayFirstName,
                lastName: displayLastName,
                phone: metaPhone || null,
                role: "client",
                consultantId,
                isActive: true,
                enrolledAt: new Date(),
              });
              
              console.log(`[Stripe Webhook] Client user created for ${clientEmail}`);
            }
            
            const loginUrl = `${baseUrl}/login`;
            
            // Send Gold welcome email using centralized service
            // SECURITY: Never send passwords in email - user uses their existing password (from Bronze) or the one they set during registration
            console.log(`[Stripe Webhook] Sending Gold welcome email to ${clientEmail} (upgrade: ${isUpgrade})`);
            sendWelcomeEmail({
              consultantId,
              recipientEmail: clientEmail,
              recipientName: fullDisplayName,
              tier: "gold",
              loginUrl,
            }).catch(err => {
              console.error("[Stripe Webhook] Failed to send Gold welcome email:", err);
            });
          }
        } catch (accountError: any) {
          console.error(`[Stripe Webhook] Account creation/email failed:`, accountError.message);
        }
        
        console.log(`[Stripe Webhook] Subscription created for ${clientEmail} (Level ${level}, ${billingPeriod || 'monthly'}) - Consultant: ${consultantId}`);
        
        // Deactivate Bronze user after successful upgrade to prevent dual access
        try {
          const deactivateResult = await db.update(bronzeUsers)
            .set({ isActive: false })
            .where(and(
              eq(bronzeUsers.email, clientEmail),
              eq(bronzeUsers.consultantId, consultantId)
            ));
          console.log(`[Stripe Webhook] Bronze user deactivated for ${clientEmail} after upgrade to level ${level}`);
        } catch (bronzeError: any) {
          console.log(`[Stripe Webhook] No Bronze user to deactivate for ${clientEmail} (or already inactive):`, bronzeError?.message);
        }
        
        break;
      }
      
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as any;
        console.log(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`);
        
        // Try to find the subscription and notify customer + consultant
        try {
          const customerId = paymentIntent.customer;
          if (customerId) {
            // Find the subscription associated with this customer
            const [subscription] = await db.select()
              .from(clientLevelSubscriptions)
              .where(eq(clientLevelSubscriptions.stripeCustomerId, customerId))
              .limit(1);
            
            if (subscription) {
              const clientEmail = subscription.clientEmail;
              const consultantId = subscription.consultantId;
              const level = subscription.level;
              
              // Get consultant email
              const [consultant] = await db.select()
                .from(users)
                .where(eq(users.id, consultantId))
                .limit(1);
              
              const baseUrl = process.env.REPLIT_DEV_DOMAIN 
                ? `https://${process.env.REPLIT_DEV_DOMAIN}`
                : "http://localhost:5000";
              
              // Notify client about failed payment
              if (clientEmail) {
                await sendEmail({
                  to: clientEmail,
                  subject: "Pagamento non riuscito - Azione richiesta",
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #e53e3e;">Pagamento non riuscito</h2>
                      <p>Gentile Cliente,</p>
                      <p>Il pagamento per il tuo abbonamento ${level === 2 ? "Silver" : "Gold"} non è andato a buon fine.</p>
                      <p>Per continuare ad utilizzare i servizi, ti preghiamo di aggiornare il metodo di pagamento.</p>
                      <p>Se hai bisogno di assistenza, contatta il tuo consulente.</p>
                      <br/>
                      <p>Cordiali saluti</p>
                    </div>
                  `,
                }, consultantId).catch(e => console.error("[Stripe Webhook] Failed to send payment failed email to client:", e));
                console.log(`[Stripe Webhook] Payment failed email sent to ${clientEmail}`);
              }
              
              // Notify consultant
              if (consultant?.email) {
                await sendEmail({
                  to: consultant.email,
                  subject: `Pagamento fallito - Cliente ${clientEmail}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #e53e3e;">Notifica pagamento fallito</h2>
                      <p>Il pagamento per il cliente <strong>${clientEmail}</strong> (${level === 2 ? "Silver" : "Gold"}) non è andato a buon fine.</p>
                      <p>Il sistema riproverà automaticamente il pagamento nei prossimi giorni.</p>
                      <p>Se il problema persiste, il cliente potrebbe perdere l'accesso ai servizi.</p>
                    </div>
                  `,
                }, consultantId).catch(e => console.error("[Stripe Webhook] Failed to send payment failed email to consultant:", e));
              }
            }
          }
        } catch (notifyError: any) {
          console.error("[Stripe Webhook] Failed to process payment failed notification:", notifyError.message);
        }
        break;
      }
      
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;
        const status = subscription.status;
        
        // Get existing subscription to check if status changed
        const [existingSub] = await db.select()
          .from(clientLevelSubscriptions)
          .where(eq(clientLevelSubscriptions.stripeSubscriptionId, subscriptionId))
          .limit(1);
        
        let dbStatus: "active" | "canceled" | "past_due" | "pending" = "active";
        if (status === "canceled" || status === "unpaid") {
          dbStatus = "canceled";
        } else if (status === "past_due") {
          dbStatus = "past_due";
        } else if (status === "active" || status === "trialing") {
          dbStatus = "active";
        }
        
        await db.update(clientLevelSubscriptions)
          .set({
            status: dbStatus,
            updatedAt: new Date(),
          })
          .where(eq(clientLevelSubscriptions.stripeSubscriptionId, subscriptionId));
        
        // Send email notification if status changed to past_due (first time warning)
        if (existingSub && existingSub.status !== "past_due" && dbStatus === "past_due") {
          const { consultantId, level, clientEmail } = existingSub;
          
          // Get consultant for notification
          const [consultant] = await db.select()
            .from(users)
            .where(eq(users.id, consultantId))
            .limit(1);
          
          // Warn client about past_due status
          if (clientEmail) {
            await sendEmail({
              to: clientEmail,
              subject: "Avviso: Pagamento in sospeso - Azione richiesta",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #dd6b20;">Pagamento in sospeso</h2>
                  <p>Gentile Cliente,</p>
                  <p>Il pagamento per il tuo abbonamento ${level === 2 ? "Silver" : "Gold"} non è andato a buon fine.</p>
                  <p><strong>L'accesso ai servizi è temporaneamente sospeso</strong> fino al completamento del pagamento.</p>
                  <p>Il sistema riproverà automaticamente nei prossimi giorni. Se il problema persiste, ti preghiamo di aggiornare il metodo di pagamento o contattare il tuo consulente.</p>
                  <br/>
                  <p>Cordiali saluti</p>
                </div>
              `,
            }, consultantId).catch(e => console.error("[Stripe Webhook] Failed to send past_due email to client:", e));
            console.log(`[Stripe Webhook] Past due warning email sent to ${clientEmail}`);
          }
          
          // Notify consultant
          if (consultant?.email) {
            await sendEmail({
              to: consultant.email,
              subject: `Abbonamento in sospeso - Cliente ${clientEmail}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #dd6b20;">Notifica pagamento in sospeso</h2>
                  <p>L'abbonamento del cliente <strong>${clientEmail}</strong> (${level === 2 ? "Silver" : "Gold"}) è in stato <strong>past_due</strong>.</p>
                  <p>Il cliente non può accedere ai servizi premium fino a quando il pagamento non sarà completato.</p>
                  <p>Il sistema riproverà automaticamente il pagamento.</p>
                </div>
              `,
            }, consultantId).catch(e => console.error("[Stripe Webhook] Failed to send past_due email to consultant:", e));
          }
        }
        
        console.log(`[Stripe Webhook] Subscription ${subscriptionId} updated to status: ${dbStatus}`);
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;
        
        // Get subscription details before marking as cancelled
        const [existingSub] = await db.select()
          .from(clientLevelSubscriptions)
          .where(eq(clientLevelSubscriptions.stripeSubscriptionId, subscriptionId))
          .limit(1);
        
        await db.update(clientLevelSubscriptions)
          .set({
            status: "canceled",
            endDate: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(clientLevelSubscriptions.stripeSubscriptionId, subscriptionId));
        
        // Decrement license count and send notification emails
        if (existingSub) {
          const { consultantId, level, clientEmail } = existingSub;
          
          // Decrement the appropriate license counter
          if (level === 2) {
            await db.update(consultantLicenses)
              .set({
                level2Used: sql`GREATEST(0, ${consultantLicenses.level2Used} - 1)`,
              })
              .where(eq(consultantLicenses.consultantId, consultantId));
            console.log(`[Stripe Webhook] Decremented level2Used for consultant ${consultantId}`);
          } else if (level === 3) {
            await db.update(consultantLicenses)
              .set({
                level3Used: sql`GREATEST(0, ${consultantLicenses.level3Used} - 1)`,
              })
              .where(eq(consultantLicenses.consultantId, consultantId));
            console.log(`[Stripe Webhook] Decremented level3Used for consultant ${consultantId}`);
          }
          
          // Get consultant for notification
          const [consultant] = await db.select()
            .from(users)
            .where(eq(users.id, consultantId))
            .limit(1);
          
          // Send cancellation email to client
          if (clientEmail) {
            await sendEmail({
              to: clientEmail,
              subject: "Abbonamento cancellato",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #4a5568;">Abbonamento cancellato</h2>
                  <p>Gentile Cliente,</p>
                  <p>Il tuo abbonamento ${level === 2 ? "Silver" : "Gold"} è stato cancellato.</p>
                  <p>L'accesso ai servizi premium non sarà più disponibile.</p>
                  <p>Se desideri riattivare l'abbonamento, contatta il tuo consulente.</p>
                  <br/>
                  <p>Cordiali saluti</p>
                </div>
              `,
            }, consultantId).catch(e => console.error("[Stripe Webhook] Failed to send cancellation email to client:", e));
            console.log(`[Stripe Webhook] Cancellation email sent to ${clientEmail}`);
          }
          
          // Notify consultant
          if (consultant?.email) {
            await sendEmail({
              to: consultant.email,
              subject: `Abbonamento cancellato - Cliente ${clientEmail}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #4a5568;">Notifica cancellazione abbonamento</h2>
                  <p>L'abbonamento del cliente <strong>${clientEmail}</strong> (${level === 2 ? "Silver" : "Gold"}) è stato cancellato.</p>
                  <p>La licenza è stata automaticamente liberata e può essere riutilizzata.</p>
                </div>
              `,
            }, consultantId).catch(e => console.error("[Stripe Webhook] Failed to send cancellation email to consultant:", e));
          }
        }
        
        console.log(`[Stripe Webhook] Subscription ${subscriptionId} cancelled`);
        break;
      }
      
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

router.get("/stripe/checkout-success/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }
    
    const stripe = await getStripeInstance();
    
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const metadata = session.metadata || {};
    const level = metadata.level;
    const billingPeriod = metadata.billingPeriod || 'monthly';
    const clientEmail = metadata.clientEmail;
    const clientName = metadata.clientName;
    const consultantSlug = metadata.consultantSlug;
    
    let userType: 'manager' | 'client' | null = null;
    if (level === "2") {
      userType = 'manager';
    } else if (level === "3") {
      userType = 'client';
    }
    
    const subscription = session.subscription as any;
    const subscriptionStatus = subscription?.status || 'active';
    
    // Build loginUrl that goes to agent selection page for the consultant
    let loginUrl: string | null = null;
    if (consultantSlug) {
      // Direct to Bronze auth with the consultant's slug - will redirect to agent selection after login
      loginUrl = `/c/${consultantSlug}/auth`;
    } else {
      // Fallback to old behavior if no slug available
      loginUrl = userType === 'manager' ? '/manager-chat' : userType === 'client' ? '/login' : null;
    }
    
    res.json({
      success: true,
      level,
      billingPeriod,
      userType,
      clientEmail,
      clientName,
      subscriptionStatus,
      consultantSlug,
      loginUrl,
    });
  } catch (error: any) {
    console.error("[Stripe Checkout Success] Error:", error);
    res.status(500).json({ error: "Failed to retrieve session", details: error.message });
  }
});

router.get("/consultant/subscriptions", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  // Disable caching to always get fresh Stripe data
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  try {
    const consultantId = req.user!.id;
    
    // Get subscriptions from database
    const dbSubscriptions = await db.select()
      .from(clientLevelSubscriptions)
      .where(eq(clientLevelSubscriptions.consultantId, consultantId))
      .orderBy(desc(clientLevelSubscriptions.startDate));
    
    // Get platform Stripe instance
    let stripe: any;
    try {
      stripe = await getStripeInstance();
      console.log("[Subscriptions] Stripe instance initialized successfully");
    } catch (e: any) {
      // If Stripe not configured, return database data only
      console.log("[Subscriptions] Stripe not configured, returning DB-only data:", e?.message);
      return res.json({ success: true, data: dbSubscriptions });
    }
    
    // Enrich each subscription with live Stripe data
    const enrichedSubscriptions = await Promise.all(
      dbSubscriptions.map(async (sub) => {
        let stripeData: any = {};
        let invoices: any[] = [];
        
        // Use phone from subscription record (saved during checkout)
        // Fallback to user tables for legacy records without phone
        let phone: string | null = sub.phone || null;
        if (!phone) {
          if (sub.level === "2") {
            const [manager] = await db.select()
              .from(managerUsers)
              .where(eq(managerUsers.email, sub.clientEmail));
            phone = manager?.phone || null;
          } else if (sub.level === "3") {
            const [user] = await db.select()
              .from(users)
              .where(eq(users.email, sub.clientEmail));
            phone = user?.phoneNumber || null;
          }
        }
        
        // Fetch live data from Stripe if we have a subscription ID
        if (sub.stripeSubscriptionId) {
          try {
            console.log(`[Subscriptions] Fetching Stripe data for subscription: ${sub.stripeSubscriptionId}`);
            const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
            console.log(`[Subscriptions] Retrieved Stripe subscription, status: ${stripeSub.status}`);
            
            stripeData = {
              currentPeriodEnd: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
              currentPeriodStart: stripeSub.current_period_start ? new Date(stripeSub.current_period_start * 1000).toISOString() : null,
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
              canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000).toISOString() : null,
              stripeStatus: stripeSub.status,
              // Get price info from the first item
              amount: stripeSub.items?.data?.[0]?.price?.unit_amount || null,
              currency: stripeSub.items?.data?.[0]?.price?.currency || 'eur',
              interval: stripeSub.items?.data?.[0]?.price?.recurring?.interval || null,
              intervalCount: stripeSub.items?.data?.[0]?.price?.recurring?.interval_count || 1,
            };
            
            // Fetch invoice history for this subscription
            if (sub.stripeCustomerId) {
              try {
                const invoiceList = await stripe.invoices.list({
                  customer: sub.stripeCustomerId,
                  subscription: sub.stripeSubscriptionId,
                  limit: 10,
                });
                
                invoices = invoiceList.data.map((inv: any) => ({
                  id: inv.id,
                  number: inv.number,
                  amountPaid: inv.amount_paid,
                  currency: inv.currency,
                  status: inv.status,
                  created: new Date(inv.created * 1000).toISOString(),
                  invoicePdf: inv.invoice_pdf,
                  hostedInvoiceUrl: inv.hosted_invoice_url,
                }));
              } catch (invErr) {
                console.error(`[Subscriptions] Failed to fetch invoices for ${sub.id}:`, invErr);
              }
            }
          } catch (stripeErr: any) {
            console.error(`[Subscriptions] Failed to fetch Stripe data for ${sub.stripeSubscriptionId}:`, stripeErr?.message);
          }
        }
        
        return {
          ...sub,
          phone,
          stripe: stripeData,
          invoices,
          totalPaid: invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0),
        };
      })
    );
    
    console.log(`[Subscriptions] Returning ${enrichedSubscriptions.length} subscriptions with Stripe data`);
    res.json({ success: true, data: enrichedSubscriptions });
  } catch (error) {
    console.error("[Consultant Subscriptions] Error:", error);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

// Cancel a subscription
router.post("/consultant/subscriptions/:subscriptionId/cancel", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { subscriptionId } = req.params;
    const { cancelImmediately } = req.body;
    
    // Verify subscription belongs to this consultant
    const [sub] = await db.select()
      .from(clientLevelSubscriptions)
      .where(and(
        eq(clientLevelSubscriptions.id, subscriptionId),
        eq(clientLevelSubscriptions.consultantId, consultantId)
      ));
    
    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }
    
    if (!sub.stripeSubscriptionId) {
      return res.status(400).json({ error: "No Stripe subscription linked" });
    }
    
    const stripe = await getStripeInstance();
    
    if (cancelImmediately) {
      // Cancel immediately
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      
      await db.update(clientLevelSubscriptions)
        .set({ status: "canceled", updatedAt: new Date() })
        .where(eq(clientLevelSubscriptions.id, subscriptionId));
    } else {
      // Cancel at period end
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }
    
    res.json({ success: true, canceledImmediately: !!cancelImmediately });
  } catch (error: any) {
    console.error("[Cancel Subscription] Error:", error);
    res.status(500).json({ error: "Failed to cancel subscription", details: error?.message });
  }
});

// Reset password for a subscribed user
router.post("/consultant/subscriptions/:subscriptionId/reset-password", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { subscriptionId } = req.params;
    
    // Verify subscription belongs to this consultant
    const [sub] = await db.select()
      .from(clientLevelSubscriptions)
      .where(and(
        eq(clientLevelSubscriptions.id, subscriptionId),
        eq(clientLevelSubscriptions.consultantId, consultantId)
      ));
    
    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }
    
    // Generate new password
    const newPassword = generateRandomPassword(10);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    if (sub.level === "2") {
      // Update managerUsers
      await db.update(managerUsers)
        .set({ passwordHash: hashedPassword })
        .where(eq(managerUsers.email, sub.clientEmail));
    } else if (sub.level === "3") {
      // Update users table
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.email, sub.clientEmail));
    }
    
    // Send email with new password
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";
    
    const loginUrl = sub.level === "2" ? `${baseUrl}/manager-chat` : `${baseUrl}/login`;
    
    await sendEmail({
      to: sub.clientEmail,
      subject: "Password Reset - Nuova Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reimpostata</h2>
          <p>La tua password è stata reimpostata dal consulente.</p>
          <p><strong>Nuova password:</strong> ${newPassword}</p>
          <p><a href="${loginUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Accedi Ora</a></p>
          <p style="color: #666; font-size: 14px;">Ti consigliamo di cambiare la password dopo il primo accesso.</p>
        </div>
      `,
    });
    
    res.json({ success: true, message: "Password reset email sent" });
  } catch (error: any) {
    console.error("[Reset Password] Error:", error);
    res.status(500).json({ error: "Failed to reset password", details: error?.message });
  }
});

router.post("/consultant/licenses/checkout", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    // SECURITY FIX: Enforce valid quantities only
    const allowedQuantities = [10, 20, 50];
    const requestedQty = parseInt(req.body.quantity, 10) || 10;
    const quantity = allowedQuantities.includes(requestedQty) ? requestedQty : 10;
    
    const stripe = await getStripeInstance();
    
    // Price calculated server-side based on validated quantity
    const pricePerLicense = 2000; // 20€ per license in cents
    const totalAmount = quantity * pricePerLicense;
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";
    
    const [purchase] = await db.insert(employeeLicensePurchases).values({
      consultantId,
      quantity,
      amountCents: totalAmount,
      status: "pending",
    }).returning();
    
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `Licenze Dipendenti (${quantity} posti)`,
            description: `Pacchetto di ${quantity} licenze per dipendenti/collaboratori`,
          },
          unit_amount: totalAmount,
        },
        quantity: 1,
      }],
      metadata: {
        type: "employee_licenses",
        consultantId,
        quantity: quantity.toString(),
        purchaseId: purchase.id,
      },
      success_url: `${baseUrl}/consultant/whatsapp?tab=licenses&purchase=success`,
      cancel_url: `${baseUrl}/consultant/whatsapp?tab=licenses&purchase=canceled`,
    });
    
    await db.update(employeeLicensePurchases)
      .set({ stripeSessionId: session.id })
      .where(eq(employeeLicensePurchases.id, purchase.id));
    
    res.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("[Employee License Checkout] Error:", error);
    res.status(500).json({ error: "Failed to create checkout" });
  }
});

router.get("/consultant/licenses/purchases", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const purchases = await db.select()
      .from(employeeLicensePurchases)
      .where(eq(employeeLicensePurchases.consultantId, consultantId))
      .orderBy(desc(employeeLicensePurchases.createdAt));
    
    res.json(purchases);
  } catch (error) {
    console.error("[Employee License Purchases] Error:", error);
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
});

router.get("/admin/stripe-stats", authenticateToken, requireRole("super_admin"), async (req: AuthRequest, res: Response) => {
  try {
    const connectedConsultants = await db
      .select({
        id: consultantLicenses.id,
        consultantId: consultantLicenses.consultantId,
        stripeConnectAccountId: consultantLicenses.stripeConnectAccountId,
        stripeConnectOnboarded: consultantLicenses.stripeConnectOnboarded,
        revenueSharePercentage: consultantLicenses.revenueSharePercentage,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(consultantLicenses)
      .leftJoin(users, eq(users.id, consultantLicenses.consultantId))
      .where(isNotNull(consultantLicenses.stripeConnectAccountId));

    const activeSubscriptions = await db
      .select()
      .from(clientLevelSubscriptions)
      .where(eq(clientLevelSubscriptions.status, "active"));

    const recentSubscriptions = await db
      .select()
      .from(clientLevelSubscriptions)
      .orderBy(desc(clientLevelSubscriptions.createdAt))
      .limit(10);

    let totalPlatformRevenueCents = 0;
    activeSubscriptions.forEach((sub) => {
      const price = sub.level === "2" ? 2900 : 5900;
      const license = connectedConsultants.find(c => c.consultantId === sub.consultantId);
      const revenueSharePercentage = license?.revenueSharePercentage || 50;
      totalPlatformRevenueCents += Math.round((price * revenueSharePercentage) / 100);
    });

    res.json({
      connectedConsultants: connectedConsultants.length,
      totalSubscriptions: activeSubscriptions.length,
      platformRevenue: totalPlatformRevenueCents / 100,
      recentSubscriptions: recentSubscriptions,
      consultantsWithStripe: connectedConsultants.map(c => ({
        id: c.consultantId,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'N/A',
        email: c.email || 'N/A',
        stripeConnected: !!c.stripeConnectAccountId,
        onboarded: c.stripeConnectOnboarded,
        revenueSharePercentage: c.revenueSharePercentage || 50,
      })),
    });
  } catch (error) {
    console.error("[Stripe Stats] Error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Verify upgrade session and generate new token - works as fallback or primary verification
router.post("/verify-upgrade-session", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID required" });
    }
    
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const token = authHeader.split(" ")[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    console.log(`[Verify Session] Checking session ${sessionId}`);
    
    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== "paid") {
      return res.json({ success: false, message: "Payment not completed" });
    }
    
    const clientEmail = session.metadata?.clientEmail;
    const level = session.metadata?.level as "2" | "3";
    const consultantId = session.metadata?.consultantId;
    
    if (!clientEmail || !level || !consultantId) {
      return res.status(400).json({ error: "Missing session metadata" });
    }
    
    // Check if subscription already exists (created by webhook)
    let subscription = await db.select().from(clientLevelSubscriptions)
      .where(and(
        eq(clientLevelSubscriptions.clientEmail, clientEmail),
        eq(clientLevelSubscriptions.consultantId, consultantId),
        eq(clientLevelSubscriptions.status, "active")
      ))
      .then(rows => rows[0]);
    
    if (!subscription) {
      // Create subscription if webhook didn't (fallback)
      const clientName = session.metadata?.clientName || clientEmail.split("@")[0];
      const stripeSubscriptionId = session.subscription as string;
      const stripeCustomerId = session.customer as string;
      const subscriptionId = crypto.randomUUID();
      
      console.log(`[Verify Session] Creating subscription for ${clientEmail}, level ${level}`);
      
      await db.insert(clientLevelSubscriptions).values({
        id: subscriptionId,
        consultantId,
        level,
        clientEmail,
        clientName,
        stripeSubscriptionId,
        stripeCustomerId,
        status: "active",
        startDate: new Date(),
        mustChangePassword: true, // Fallback creation needs password change
        // Initialize onboarding state for new subscriptions
        hasCompletedOnboarding: false,
        writingStyle: null,
        responseLength: null,
        customInstructions: null,
      });
      
      subscription = { id: subscriptionId, level, clientEmail, clientName, consultantId, hasCompletedOnboarding: false } as any;
    }
    
    // Update bronze user to inactive if this was an upgrade from Bronze
    if (decoded.type === "bronze" && decoded.bronzeUserId) {
      await db.update(bronzeUsers)
        .set({ isActive: false })
        .where(eq(bronzeUsers.id, decoded.bronzeUserId));
      console.log(`[Verify Session] Deactivated bronze user ${decoded.bronzeUserId}`);
    }
    
    // Generate new Silver/Gold token
    const tierType = level === "2" ? "silver" : "gold";
    const newToken = jwt.sign({
      type: tierType,
      subscriptionId: subscription.id,
      email: clientEmail,
      consultantId,
      level,
    }, JWT_SECRET, { expiresIn: "30d" });
    
    console.log(`[Verify Session] Successfully verified upgrade for ${clientEmail} to ${tierType}`);
    
    res.json({ 
      success: true, 
      upgraded: true,
      newToken,
      level,
      tierType,
      subscriptionId: subscription.id,
    });
    
  } catch (error) {
    console.error("[Verify Session] Error:", error);
    res.status(500).json({ error: "Failed to verify session" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Default Onboarding Preferences - Consultant sets default preferences for new clients
// ═══════════════════════════════════════════════════════════════════════════

router.get("/consultant/default-onboarding-preferences", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const [license] = await db.select()
      .from(consultantLicenses)
      .where(eq(consultantLicenses.consultantId, consultantId))
      .limit(1);
    
    if (!license) {
      return res.json({ 
        success: true, 
        preferences: null 
      });
    }
    
    res.json({ 
      success: true, 
      preferences: license.defaultOnboardingPreferences || null 
    });
  } catch (error: any) {
    console.error("[Default Onboarding Preferences] GET Error:", error);
    res.status(500).json({ error: "Failed to get preferences", details: error?.message });
  }
});

router.put("/consultant/default-onboarding-preferences", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { writingStyle, responseLength, customInstructions } = req.body;
    
    const preferences = {
      writingStyle: writingStyle || null,
      responseLength: responseLength || null,
      customInstructions: customInstructions || null,
    };
    
    // Check if license exists
    const [existingLicense] = await db.select({ id: consultantLicenses.id })
      .from(consultantLicenses)
      .where(eq(consultantLicenses.consultantId, consultantId))
      .limit(1);
    
    if (existingLicense) {
      await db.update(consultantLicenses)
        .set({ 
          defaultOnboardingPreferences: preferences,
          updatedAt: new Date()
        })
        .where(eq(consultantLicenses.consultantId, consultantId));
    } else {
      await db.insert(consultantLicenses).values({
        consultantId,
        level2Total: 20,
        level2Used: 0,
        level3Total: 10,
        level3Used: 0,
        defaultOnboardingPreferences: preferences,
      });
    }
    
    console.log(`[Default Onboarding Preferences] Updated for consultant ${consultantId}`);
    
    res.json({ 
      success: true, 
      message: "Preferences saved successfully",
      preferences 
    });
  } catch (error: any) {
    console.error("[Default Onboarding Preferences] PUT Error:", error);
    res.status(500).json({ error: "Failed to save preferences", details: error?.message });
  }
});

// Bulk apply preferences to all clients
router.post("/consultant/bulk-apply-preferences", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { writingStyle, responseLength, customInstructions, targetTiers } = req.body;
    
    if (!targetTiers || !Array.isArray(targetTiers) || targetTiers.length === 0) {
      return res.status(400).json({ error: "targetTiers must be a non-empty array" });
    }
    
    let updatedCount = 0;
    
    // Update Silver/Gold subscriptions
    if (targetTiers.includes("2") || targetTiers.includes("3")) {
      const levels = targetTiers.filter((t: string) => t === "2" || t === "3");
      
      for (const level of levels) {
        const result = await db.update(clientLevelSubscriptions)
          .set({
            writingStyle: writingStyle || null,
            responseLength: responseLength || null,
            customInstructions: customInstructions || null,
          })
          .where(and(
            eq(clientLevelSubscriptions.consultantId, consultantId),
            eq(clientLevelSubscriptions.level, level as "2" | "3"),
            eq(clientLevelSubscriptions.status, "active")
          ));
        
        updatedCount += (result as any).rowCount || 0;
      }
    }
    
    // Update Bronze users
    if (targetTiers.includes("1")) {
      // Get consultant's whatsapp config to find associated bronze users
      const [config] = await db.select()
        .from(consultantWhatsappConfig)
        .where(eq(consultantWhatsappConfig.consultantId, consultantId))
        .limit(1);
      
      if (config) {
        const result = await db.update(bronzeUsers)
          .set({
            writingStyle: writingStyle || null,
            responseLength: responseLength || null,
            customInstructions: customInstructions || null,
          })
          .where(and(
            eq(bronzeUsers.consultantId, consultantId),
            eq(bronzeUsers.isActive, true)
          ));
        
        updatedCount += (result as any).rowCount || 0;
      }
    }
    
    console.log(`[Bulk Apply Preferences] Updated ${updatedCount} clients for consultant ${consultantId}`);
    
    res.json({ 
      success: true, 
      message: `Preferences applied to ${updatedCount} clients`,
      updatedCount 
    });
  } catch (error: any) {
    console.error("[Bulk Apply Preferences] Error:", error);
    res.status(500).json({ error: "Failed to apply preferences", details: error?.message });
  }
});

export default router;
