import express, { Router, Request, Response } from "express";
import { db } from "../db";
import { consultantLicenses, superadminStripeConfig, users, clientLevelSubscriptions, employeeLicensePurchases, managerUsers, managerLinkAssignments, whatsappAgentShares } from "@shared/schema";
import { eq, sql, isNotNull, desc, and } from "drizzle-orm";
import { authenticateToken, AuthRequest, requireRole } from "../middleware/auth";
import { decrypt } from "../encryption";
import bcrypt from "bcrypt";
import { sendEmail } from "../services/email-scheduler";
import { sendWelcomeEmail } from "../services/welcome-email-service";

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
  const [config] = await db.select().from(superadminStripeConfig).limit(1);
  if (!config?.stripeSecretKey) {
    throw new Error("Stripe not configured");
  }
  
  let secretKey = config.stripeSecretKey;
  if (secretKey.includes(':')) {
    try {
      secretKey = decrypt(secretKey);
    } catch (e) {
      console.log("[Stripe Connect] Using plain text key");
    }
  }
  
  const Stripe = (await import("stripe")).default;
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
          billingPeriod,
          firstName: metaFirstName,
          lastName: metaLastName,
          hashedPassword: metaHashedPassword,
          phone: metaPhone
        } = metadata;
        
        if (!consultantId || !clientEmail || !level) {
          console.error("[Stripe Webhook] Missing metadata in checkout session");
          break;
        }
        
        // Idempotency check: skip if subscription already exists for this Stripe session
        const stripeSubscriptionId = session.subscription || null;
        if (stripeSubscriptionId) {
          const [existingSubscription] = await db.select()
            .from(clientLevelSubscriptions)
            .where(eq(clientLevelSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
            .limit(1);
          
          if (existingSubscription) {
            console.log(`[Stripe Webhook] Subscription already processed: ${stripeSubscriptionId}`);
            break;
          }
        }
        
        // Also check by session ID to prevent duplicate one-time payments
        const stripeSessionId = session.id;
        const [existingBySession] = await db.select()
          .from(clientLevelSubscriptions)
          .where(eq(clientLevelSubscriptions.stripeCustomerId, stripeSessionId))
          .limit(1);
        
        if (existingBySession) {
          console.log(`[Stripe Webhook] Session already processed: ${stripeSessionId}`);
          break;
        }
        
        // Use password from registration form if available, otherwise generate temp password
        const userProvidedPassword = !!metaHashedPassword;
        const tempPassword = userProvidedPassword ? null : generateRandomPassword(8);
        const hashedPassword = metaHashedPassword || await bcrypt.hash(tempPassword!, 10);
        
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
          tempPassword,
          passwordHash: hashedPassword,
        }).returning();
        
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
            
            const loginUrl = `${baseUrl}/manager-chat`;
            
            // Send Silver welcome email using centralized service
            // Note: If user provided their own password (metaHashedPassword), we only have the hash,
            // so we can't include it in the email. The template handles this by showing
            // "Usa la password che hai scelto durante la registrazione."
            console.log(`[Stripe Webhook] Sending Silver welcome email to ${clientEmail} (temp password: ${!!tempPassword})`);
            sendWelcomeEmail({
              consultantId,
              recipientEmail: clientEmail,
              recipientName: fullDisplayName,
              password: tempPassword || undefined,
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
            // Note: If user provided their own password (metaHashedPassword), we only have the hash,
            // so we can't include it in the email. The template handles this by showing
            // "Usa la password che hai scelto durante la registrazione."
            console.log(`[Stripe Webhook] Sending Gold welcome email to ${clientEmail} (temp password: ${!!tempPassword})`);
            sendWelcomeEmail({
              consultantId,
              recipientEmail: clientEmail,
              recipientName: fullDisplayName,
              password: tempPassword || undefined,
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
        break;
      }
      
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as any;
        console.log(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`);
        break;
      }
      
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;
        const status = subscription.status;
        
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
        
        console.log(`[Stripe Webhook] Subscription ${subscriptionId} updated to status: ${dbStatus}`);
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;
        
        await db.update(clientLevelSubscriptions)
          .set({
            status: "canceled",
            endDate: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(clientLevelSubscriptions.stripeSubscriptionId, subscriptionId));
        
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
    
    let userType: 'manager' | 'client' | null = null;
    if (level === "2") {
      userType = 'manager';
    } else if (level === "3") {
      userType = 'client';
    }
    
    const subscription = session.subscription as any;
    const subscriptionStatus = subscription?.status || 'active';
    
    res.json({
      success: true,
      level,
      billingPeriod,
      userType,
      clientEmail,
      clientName,
      subscriptionStatus,
      loginUrl: userType === 'manager' 
        ? '/manager-chat'
        : userType === 'client' 
          ? '/login'
          : null,
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

export default router;
