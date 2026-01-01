import express, { Router, Request, Response } from "express";
import { db } from "../db";
import { consultantLicenses, superadminStripeConfig, users, clientLevelSubscriptions, employeeLicensePurchases } from "@shared/schema";
import { eq, sql, isNotNull, desc } from "drizzle-orm";
import { authenticateToken, AuthRequest, requireRole } from "../middleware/auth";
import { decrypt } from "../encryption";

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
    const { consultantSlug, agentId, level, clientEmail, clientName } = req.body;
    
    if (!consultantSlug || !level) {
      return res.status(400).json({ error: "Missing required fields: consultantSlug, level" });
    }
    
    if (level !== "2" && level !== "3") {
      return res.status(400).json({ error: "Invalid level. Must be '2' or '3'" });
    }
    
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
    } | null;
    
    const price = level === "2" 
      ? (pricingConfig?.level2PriceCents || 2900)
      : (pricingConfig?.level3PriceCents || 5900);
    
    const revenueSharePercentage = license.revenueSharePercentage || 50;
    const applicationFee = Math.round((price * revenueSharePercentage) / 100);
    
    const stripe = await getStripeInstance();
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";
    
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: level === "2" ? "Licenza Argento" : "Licenza Deluxe",
            description: `Accesso ${level === "2" ? "Argento" : "Deluxe"} ai servizi AI`,
          },
          unit_amount: price,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: license.stripeConnectAccountId,
        },
      },
      customer_email: clientEmail || undefined,
      metadata: {
        consultantId: consultant.id,
        clientEmail,
        clientName: clientName || "",
        level,
        agentId: agentId || "",
      },
      success_url: `${baseUrl}/c/${consultantSlug}/pricing?success=true`,
      cancel_url: `${baseUrl}/c/${consultantSlug}/pricing?canceled=true`,
    });
    
    console.log(`[Stripe Checkout] Session created for ${clientEmail} (Level ${level}) - Consultant: ${consultant.id}`);
    
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
          
          // SECURITY FIX: Fetch purchase record from database to get canonical quantity
          const [purchase] = await db.select()
            .from(employeeLicensePurchases)
            .where(eq(employeeLicensePurchases.id, purchaseId));
          
          if (!purchase || purchase.status === "completed") {
            console.log("[Stripe Webhook] Purchase not found or already completed:", purchaseId);
            break;
          }
          
          // Use quantity from DB record, not from metadata
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
        
        const { consultantId, clientEmail, clientName, level, agentId } = metadata;
        
        if (!consultantId || !clientEmail || !level) {
          console.error("[Stripe Webhook] Missing metadata in checkout session");
          break;
        }
        
        await db.insert(clientLevelSubscriptions).values({
          consultantId,
          clientEmail,
          clientName: clientName || null,
          level: level as "2" | "3",
          status: "active",
          startDate: new Date(),
          stripeCustomerId: session.customer || null,
        });
        
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
        
        console.log(`[Stripe Webhook] Subscription created for ${clientEmail} (Level ${level}) - Consultant: ${consultantId}`);
        break;
      }
      
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as any;
        console.log(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`);
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

router.get("/consultant/subscriptions", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const subscriptions = await db.select()
      .from(clientLevelSubscriptions)
      .where(eq(clientLevelSubscriptions.consultantId, consultantId))
      .orderBy(desc(clientLevelSubscriptions.startDate));
    
    res.json(subscriptions);
  } catch (error) {
    console.error("[Consultant Subscriptions] Error:", error);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
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
