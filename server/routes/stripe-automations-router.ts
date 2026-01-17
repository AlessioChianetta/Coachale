import { Router, Request, Response } from "express";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import Stripe from "stripe";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendEmail } from "../services/email-scheduler";

const router = Router();

// ============================================================
// HELPER: Generate cryptographically secure random password
// ============================================================
function generatePassword(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
  const randomBytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(randomBytes[i] % chars.length);
  }
  return password;
}

// ============================================================
// HELPER: Get consultant's Stripe instance
// ============================================================
async function getStripeForConsultant(consultantId: string): Promise<Stripe | null> {
  const [user] = await db
    .select({ stripeSecretKey: schema.users.stripeSecretKey })
    .from(schema.users)
    .where(eq(schema.users.id, consultantId))
    .limit(1);

  if (!user?.stripeSecretKey) {
    return null;
  }

  return new Stripe(user.stripeSecretKey, { apiVersion: "2024-12-18.acacia" });
}

// ============================================================
// GET /api/stripe-automations - List all automations for consultant
// ============================================================
router.get("/", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const automations = await db
      .select()
      .from(schema.stripePaymentAutomations)
      .where(eq(schema.stripePaymentAutomations.consultantId, consultantId))
      .orderBy(desc(schema.stripePaymentAutomations.createdAt));

    res.json(automations);
  } catch (error) {
    console.error("[STRIPE AUTOMATIONS] Error fetching automations:", error);
    res.status(500).json({ error: "Errore nel recupero delle automazioni" });
  }
});

// ============================================================
// GET /api/stripe-automations/webhook-url - Get webhook URL for consultant
// ============================================================
router.get("/webhook-url", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const baseUrl = replitDomain 
      ? (replitDomain.startsWith("http") ? replitDomain : `https://${replitDomain}`)
      : "https://your-app.replit.app";
    
    const webhookUrl = `${baseUrl}/api/webhooks/stripe/${consultantId}`;
    
    res.json({ 
      webhookUrl,
      instructions: [
        "1. Vai nella dashboard Stripe → Sviluppatori → Webhook",
        "2. Clicca 'Aggiungi endpoint'",
        "3. Incolla l'URL del webhook sopra",
        "4. Seleziona l'evento 'checkout.session.completed'",
        "5. Copia il 'Signing secret' e salvalo nelle tue API Keys"
      ]
    });
  } catch (error) {
    console.error("[STRIPE AUTOMATIONS] Error getting webhook URL:", error);
    res.status(500).json({ error: "Errore" });
  }
});

// ============================================================
// GET /api/stripe-automations/payment-links - Get all payment links from Stripe
// ============================================================
router.get("/payment-links", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    const stripe = await getStripeForConsultant(consultantId);
    if (!stripe) {
      return res.status(400).json({ 
        error: "Chiavi Stripe non configurate",
        message: "Configura le tue chiavi API Stripe nella pagina Impostazioni → Chiavi API"
      });
    }

    // Fetch payment links from Stripe with line items expanded
    const paymentLinks = await stripe.paymentLinks.list({
      limit: 100,
      expand: ['data.line_items'],
    });

    // Get existing automations for this consultant
    const existingAutomations = await db
      .select({ stripePaymentLinkId: schema.stripePaymentAutomations.stripePaymentLinkId })
      .from(schema.stripePaymentAutomations)
      .where(eq(schema.stripePaymentAutomations.consultantId, consultantId));
    
    const automatedLinkIds = new Set(existingAutomations.map(a => a.stripePaymentLinkId));

    // Map payment links with automation status and product names
    const links = paymentLinks.data.map(link => {
      let createdAt = null;
      try {
        if (link.created && typeof link.created === 'number') {
          createdAt = new Date(link.created * 1000).toISOString();
        }
      } catch (e) {
        // Ignore date parsing errors
      }
      
      // Extract product name from line items
      let productName = null;
      try {
        const lineItems = (link as any).line_items?.data;
        if (lineItems && lineItems.length > 0) {
          // Get the first product's name
          productName = lineItems[0]?.price?.product?.name || 
                        lineItems[0]?.description ||
                        (lineItems.length > 1 ? `${lineItems.length} prodotti` : null);
        }
      } catch (e) {
        // Ignore line item parsing errors
      }
      
      // Also check metadata for a custom name
      const customName = link.metadata?.name || link.metadata?.title || link.metadata?.description;
      
      return {
        id: link.id,
        url: link.url,
        active: link.active,
        name: customName || productName,
        metadata: link.metadata,
        hasAutomation: automatedLinkIds.has(link.id),
        createdAt,
      };
    });

    res.json({ 
      links,
      total: links.length,
      hasApiKey: true
    });
  } catch (error: any) {
    console.error("[STRIPE] Error fetching payment links:", error);
    
    if (error.type === "StripeAuthenticationError") {
      return res.status(401).json({ 
        error: "Chiave Stripe non valida",
        message: "La chiave API Stripe configurata non è valida. Verifica le tue credenziali."
      });
    }
    
    if (error.type === "StripePermissionError" || error.code === "secret_key_required") {
      return res.status(400).json({ 
        error: "Chiave pubblica invece di segreta",
        message: "Hai configurato una chiave PUBBLICA (pk_...). Serve la chiave SEGRETA (sk_test_... o sk_live_...). Vai su Impostazioni → Chiavi API e inserisci la Secret Key.",
        needsSecretKey: true
      });
    }
    
    res.status(500).json({ error: "Errore nel recupero dei Payment Links" });
  }
});

// ============================================================
// POST /api/stripe-automations - Create new automation
// ============================================================
router.post("/", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const {
      stripePaymentLinkId,
      linkName,
      createAsClient = true,
      createAsConsultant = false,
      clientLevel,
      assignToAgents = [],
      sendWelcomeEmail = true,
      welcomeEmailSubject,
      welcomeEmailTemplate,
    } = req.body;

    if (!stripePaymentLinkId || !linkName) {
      return res.status(400).json({ error: "ID Payment Link e nome sono obbligatori" });
    }

    // Check if automation already exists for this link
    const existing = await db
      .select({ id: schema.stripePaymentAutomations.id })
      .from(schema.stripePaymentAutomations)
      .where(and(
        eq(schema.stripePaymentAutomations.consultantId, consultantId),
        eq(schema.stripePaymentAutomations.stripePaymentLinkId, stripePaymentLinkId)
      ))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Esiste già un'automazione per questo Payment Link" });
    }

    const [automation] = await db
      .insert(schema.stripePaymentAutomations)
      .values({
        consultantId,
        stripePaymentLinkId,
        linkName,
        createAsClient,
        createAsConsultant,
        clientLevel: clientLevel || null,
        assignToAgents: assignToAgents || [],
        sendWelcomeEmail,
        welcomeEmailSubject,
        welcomeEmailTemplate,
      })
      .returning();

    res.status(201).json(automation);
  } catch (error) {
    console.error("[STRIPE AUTOMATIONS] Error creating automation:", error);
    res.status(500).json({ error: "Errore nella creazione dell'automazione" });
  }
});

// ============================================================
// PATCH /api/stripe-automations/:id - Update automation
// ============================================================
router.patch("/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const automationId = req.params.id;
    const updates = req.body;

    // Verify ownership
    const [existing] = await db
      .select({ id: schema.stripePaymentAutomations.id })
      .from(schema.stripePaymentAutomations)
      .where(and(
        eq(schema.stripePaymentAutomations.id, automationId),
        eq(schema.stripePaymentAutomations.consultantId, consultantId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Automazione non trovata" });
    }

    const [updated] = await db
      .update(schema.stripePaymentAutomations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.stripePaymentAutomations.id, automationId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("[STRIPE AUTOMATIONS] Error updating automation:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento" });
  }
});

// ============================================================
// DELETE /api/stripe-automations/:id - Delete automation
// ============================================================
router.delete("/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const automationId = req.params.id;

    const [deleted] = await db
      .delete(schema.stripePaymentAutomations)
      .where(and(
        eq(schema.stripePaymentAutomations.id, automationId),
        eq(schema.stripePaymentAutomations.consultantId, consultantId)
      ))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Automazione non trovata" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[STRIPE AUTOMATIONS] Error deleting automation:", error);
    res.status(500).json({ error: "Errore nell'eliminazione" });
  }
});

// ============================================================
// GET /api/stripe-automations/:id/logs - Get logs for automation
// ============================================================
router.get("/:id/logs", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const automationId = req.params.id;

    // Verify ownership
    const [automation] = await db
      .select({ id: schema.stripePaymentAutomations.id })
      .from(schema.stripePaymentAutomations)
      .where(and(
        eq(schema.stripePaymentAutomations.id, automationId),
        eq(schema.stripePaymentAutomations.consultantId, consultantId)
      ))
      .limit(1);

    if (!automation) {
      return res.status(404).json({ error: "Automazione non trovata" });
    }

    const logs = await db
      .select({
        id: schema.stripeAutomationLogs.id,
        customerEmail: schema.stripeAutomationLogs.customerEmail,
        customerName: schema.stripeAutomationLogs.customerName,
        rolesAssigned: schema.stripeAutomationLogs.rolesAssigned,
        status: schema.stripeAutomationLogs.status,
        errorMessage: schema.stripeAutomationLogs.errorMessage,
        createdAt: schema.stripeAutomationLogs.createdAt,
      })
      .from(schema.stripeAutomationLogs)
      .where(eq(schema.stripeAutomationLogs.automationId, automationId))
      .orderBy(desc(schema.stripeAutomationLogs.createdAt))
      .limit(50);

    res.json(logs);
  } catch (error) {
    console.error("[STRIPE AUTOMATIONS] Error fetching logs:", error);
    res.status(500).json({ error: "Errore nel recupero dei log" });
  }
});

// ============================================================
// GET /api/stripe-automations/payment-links - Fetch Payment Links from Stripe
// ============================================================
router.get("/payment-links", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const stripe = await getStripeForConsultant(consultantId);

    if (!stripe) {
      return res.status(400).json({ 
        error: "Stripe API Key non configurata",
        needsConfig: true 
      });
    }

    const paymentLinks = await stripe.paymentLinks.list({ limit: 100, active: true });

    const links = paymentLinks.data.map(link => ({
      id: link.id,
      url: link.url,
      active: link.active,
    }));

    res.json(links);
  } catch (error: any) {
    console.error("[STRIPE AUTOMATIONS] Error fetching payment links:", error);
    if (error.type === "StripeAuthenticationError") {
      return res.status(400).json({ error: "API Key Stripe non valida", needsConfig: true });
    }
    res.status(500).json({ error: "Errore nel recupero dei Payment Links" });
  }
});

export default router;

// ============================================================
// WEBHOOK HANDLER - Exported for use in main routes
// ============================================================
export async function handleStripeWebhook(req: Request, res: Response) {
  const consultantId = req.params.consultantId;
  const sig = req.headers["stripe-signature"] as string;

  console.log(`[STRIPE WEBHOOK] Received webhook for consultant: ${consultantId}`);

  try {
    // Get consultant's webhook secret from users table
    const [consultant] = await db
      .select({ 
        stripeWebhookSecret: schema.users.stripeWebhookSecret,
        stripeSecretKey: schema.users.stripeSecretKey 
      })
      .from(schema.users)
      .where(eq(schema.users.id, consultantId))
      .limit(1);

    if (!consultant?.stripeWebhookSecret || !consultant?.stripeSecretKey) {
      console.error(`[STRIPE WEBHOOK] Missing Stripe config for consultant: ${consultantId}`);
      return res.status(400).json({ error: "Configurazione Stripe mancante" });
    }

    const stripe = new Stripe(consultant.stripeSecretKey, { apiVersion: "2024-12-18.acacia" });

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, consultant.stripeWebhookSecret);
    } catch (err: any) {
      console.error(`[STRIPE WEBHOOK] Signature verification failed:`, err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    console.log(`[STRIPE WEBHOOK] Event type: ${event.type}`);

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Get payment link ID from session
      const paymentLinkId = session.payment_link as string;
      
      if (!paymentLinkId) {
        console.log(`[STRIPE WEBHOOK] No payment link ID in session, skipping`);
        return res.json({ received: true, action: "skipped" });
      }

      // Find matching automation
      const [automation] = await db
        .select()
        .from(schema.stripePaymentAutomations)
        .where(and(
          eq(schema.stripePaymentAutomations.consultantId, consultantId),
          eq(schema.stripePaymentAutomations.stripePaymentLinkId, paymentLinkId),
          eq(schema.stripePaymentAutomations.isActive, true)
        ))
        .limit(1);

      if (!automation) {
        console.log(`[STRIPE WEBHOOK] No automation found for payment link: ${paymentLinkId}`);
        return res.json({ received: true, action: "no_automation" });
      }

      // Process the automation
      await processPaymentAutomation(automation, session, consultantId);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[STRIPE WEBHOOK] Error processing webhook:", error);
    res.status(500).json({ error: "Errore interno" });
  }
}

// ============================================================
// PROCESS PAYMENT AUTOMATION - Create user and send email
// ============================================================
async function processPaymentAutomation(
  automation: schema.StripePaymentAutomation,
  session: Stripe.Checkout.Session,
  consultantId: string
) {
  const customerEmail = session.customer_details?.email || session.customer_email;
  const customerName = session.customer_details?.name || "";
  
  // Get phone from customer_details or from custom_fields (if user added phone field to Payment Link)
  let customerPhone = session.customer_details?.phone || "";
  if (!customerPhone && (session as any).custom_fields) {
    const customFields = (session as any).custom_fields as Array<{key: string; text?: {value: string}}>;
    const phoneField = customFields.find(f => 
      f.key?.toLowerCase().includes('phone') || 
      f.key?.toLowerCase().includes('telefono') ||
      f.key?.toLowerCase().includes('tel')
    );
    if (phoneField?.text?.value) {
      customerPhone = phoneField.text.value;
    }
  }

  console.log(`[STRIPE AUTOMATION] Processing for email: ${customerEmail}, phone: ${customerPhone}`);

  // Create log entry
  const [log] = await db
    .insert(schema.stripeAutomationLogs)
    .values({
      automationId: automation.id,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent as string,
      customerEmail: customerEmail || "unknown",
      customerName,
      customerPhone,
      status: "pending",
      stripeEventData: session as any,
    })
    .returning();

  try {
    if (!customerEmail) {
      throw new Error("Email cliente mancante nella sessione Stripe");
    }

    // Check if user already exists - also get tempPassword and mustChangePassword for email
    const [existingUser] = await db
      .select({ 
        id: schema.users.id,
        tempPassword: schema.users.tempPassword,
        mustChangePassword: schema.users.mustChangePassword,
      })
      .from(schema.users)
      .where(eq(schema.users.email, customerEmail.toLowerCase()))
      .limit(1);

    let userId: string;
    let password: string | null = null;
    let userMustChangePassword = false;
    const rolesAssigned: string[] = [];

    if (existingUser) {
      // User exists - update consultantId relationship if needed
      userId = existingUser.id;
      // If user never changed password, we can show the temp password in email
      if (existingUser.mustChangePassword && existingUser.tempPassword) {
        password = existingUser.tempPassword;
        userMustChangePassword = true;
      }
      console.log(`[STRIPE AUTOMATION] User already exists: ${userId}, mustChangePassword: ${existingUser.mustChangePassword}`);

      // Check if this is subscription-only (no roles, just level)
      const isSubscriptionOnly = !automation.createAsConsultant && !automation.createAsClient && automation.clientLevel;

      // Add client relationship by setting consultantId on user (when client role OR subscription-only)
      if (automation.createAsClient || isSubscriptionOnly) {
        await db
          .update(schema.users)
          .set({ consultantId })
          .where(eq(schema.users.id, userId));
        
        if (automation.createAsClient) {
          rolesAssigned.push("client");
        }
        console.log(`[STRIPE AUTOMATION] Updated consultantId for existing user`);
      }

      // Create/update subscription for Silver/Gold levels (works with or without roles)
      if (automation.clientLevel && (automation.clientLevel === "silver" || automation.clientLevel === "gold")) {
        const levelMap: Record<string, "2" | "3"> = { silver: "2", gold: "3" };
        const [existingSub] = await db
          .select({ id: schema.clientLevelSubscriptions.id })
          .from(schema.clientLevelSubscriptions)
          .where(and(
            eq(schema.clientLevelSubscriptions.clientId, userId),
            eq(schema.clientLevelSubscriptions.consultantId, consultantId)
          ))
          .limit(1);

        if (existingSub) {
          await db
            .update(schema.clientLevelSubscriptions)
            .set({ 
              level: levelMap[automation.clientLevel],
              status: "active",
              paymentSource: "direct_link", // Mark as direct link for 100% commission
            })
            .where(eq(schema.clientLevelSubscriptions.id, existingSub.id));
        } else {
          await db.insert(schema.clientLevelSubscriptions).values({
            clientId: userId,
            consultantId,
            clientEmail: customerEmail.toLowerCase(),
            clientName: customerName || null,
            phone: customerPhone || null,
            level: levelMap[automation.clientLevel],
            status: "active",
            startDate: new Date(),
            paymentSource: "direct_link", // Mark as direct link for 100% commission
          });
        }
        rolesAssigned.push(`${automation.clientLevel}_subscriber`);
        console.log(`[STRIPE AUTOMATION] Created/updated ${automation.clientLevel} subscription with paymentSource: direct_link`);
      }
      
      // Handle Bronze for existing user - add to bronzeUsers if not already there
      if (automation.clientLevel === "bronze") {
        const [existingBronze] = await db
          .select({ id: schema.bronzeUsers.id })
          .from(schema.bronzeUsers)
          .where(and(
            eq(schema.bronzeUsers.email, customerEmail.toLowerCase()),
            eq(schema.bronzeUsers.consultantId, consultantId)
          ))
          .limit(1);
        
        if (!existingBronze) {
          // Create bronze user record linked to this consultant
          const tempPassword = generatePassword();
          const hashedPassword = await bcrypt.hash(tempPassword, 10);
          await db.insert(schema.bronzeUsers).values({
            consultantId,
            email: customerEmail.toLowerCase(),
            passwordHash: hashedPassword,
            firstName: customerName.split(" ")[0] || "",
            lastName: customerName.split(" ").slice(1).join(" ") || "",
            phone: customerPhone || null,
            isActive: true,
          });
          rolesAssigned.push("bronze_subscriber");
          console.log(`[STRIPE AUTOMATION] Created Bronze record for existing user`);
        }
      }
    } else {
      // Create new user
      password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const nameParts = customerName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      // Generate username from email (part before @) + random suffix
      const emailPrefix = customerEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const username = `${emailPrefix}_${randomSuffix}`;

      // Check if this is a subscription-only user (no roles, just level)
      const isSubscriptionOnly = !automation.createAsConsultant && !automation.createAsClient && automation.clientLevel;
      
      // For Bronze-only users (no roles), create in bronzeUsers table instead of users
      if (isSubscriptionOnly && automation.clientLevel === "bronze") {
        // Create Bronze user directly in bronzeUsers table
        const [bronzeUser] = await db.insert(schema.bronzeUsers).values({
          consultantId,
          email: customerEmail.toLowerCase(),
          passwordHash: hashedPassword,
          firstName,
          lastName,
          phone: customerPhone || null,
          isActive: true,
        }).returning();
        
        userId = bronzeUser.id;
        userMustChangePassword = true;
        rolesAssigned.push("bronze_subscriber");
        console.log(`[STRIPE AUTOMATION] Created Bronze subscriber (no roles): ${userId}`);
      } else {
        // Determine primary role: consultant takes precedence, then client, then default to client for Silver/Gold
        let primaryRole: "consultant" | "client" = "client";
        if (automation.createAsConsultant) {
          primaryRole = "consultant";
        }
        
        // Set consultantId on user when:
        // 1. Creating as client only (not consultant)
        // 2. OR subscription-only (Silver/Gold without roles) - they need to be linked to the consultant
        const userConsultantId = (automation.createAsClient && !automation.createAsConsultant) || isSubscriptionOnly 
          ? consultantId 
          : null;

        const [newUser] = await db
          .insert(schema.users)
          .values({
            username,
            email: customerEmail.toLowerCase(),
            password: hashedPassword,
            tempPassword: password, // Store plain text password for email reminders until user changes it
            firstName,
            lastName,
            role: primaryRole,
            phoneNumber: customerPhone || null,
            mustChangePassword: true,
            consultantId: userConsultantId,
          })
          .returning();
        
        userMustChangePassword = true;
        userId = newUser.id;
        console.log(`[STRIPE AUTOMATION] Created new user: ${userId} with role: ${primaryRole}, consultantId: ${userConsultantId}`);

        // Create user role profiles for multi-role support (like Fernando)
        if (automation.createAsConsultant) {
          await db.insert(schema.userRoleProfiles).values({
            userId,
            role: "consultant",
            consultantId: null, // They are the consultant
            isDefault: !automation.createAsClient, // Default only if not also a client
            isActive: true,
          });
          rolesAssigned.push("consultant");
          console.log(`[STRIPE AUTOMATION] Created consultant profile for user`);
        }

        if (automation.createAsClient) {
          await db.insert(schema.userRoleProfiles).values({
            userId,
            role: "client",
            consultantId, // Associated to the consultant who owns this automation
            isDefault: true, // Client profile is default when both roles exist
            isActive: true,
          });
          rolesAssigned.push("client");
          console.log(`[STRIPE AUTOMATION] Created client profile for user (linked to consultant ${consultantId})`);
        }

        // Create subscription for Silver/Gold (Level 2/3) - works with or without roles
        if (automation.clientLevel && (automation.clientLevel === "silver" || automation.clientLevel === "gold")) {
          const levelMap: Record<string, "2" | "3"> = { silver: "2", gold: "3" };
          await db.insert(schema.clientLevelSubscriptions).values({
            clientId: userId,
            consultantId,
            clientEmail: customerEmail.toLowerCase(),
            clientName: customerName || null,
            phone: customerPhone || null,
            level: levelMap[automation.clientLevel],
            status: "active",
            startDate: new Date(),
            passwordHash: hashedPassword,
            tempPassword: password,
            paymentSource: "direct_link", // Track that this came from consultant's direct link (100% commission)
          });
          rolesAssigned.push(`${automation.clientLevel}_subscriber`);
          console.log(`[STRIPE AUTOMATION] Created ${automation.clientLevel} subscription with paymentSource: direct_link`);
        }
      }
    }

    // Send welcome email if enabled
    if (automation.sendWelcomeEmail && customerEmail) {
      await sendProvisioningEmail({
        consultantId,
        recipientEmail: customerEmail,
        recipientName: customerName,
        recipientPhone: customerPhone || undefined,
        password,
        mustChangePassword: userMustChangePassword,
        tier: automation.clientLevel || "bronze",
        customSubject: automation.welcomeEmailSubject || undefined,
        customTemplate: automation.welcomeEmailTemplate || undefined,
      });
    }

    // Update log as success
    await db
      .update(schema.stripeAutomationLogs)
      .set({
        status: "success",
        createdUserId: userId,
        rolesAssigned,
      })
      .where(eq(schema.stripeAutomationLogs.id, log.id));

    // Increment users created count
    await db
      .update(schema.stripePaymentAutomations)
      .set({
        usersCreatedCount: sql`${schema.stripePaymentAutomations.usersCreatedCount} + 1`,
      })
      .where(eq(schema.stripePaymentAutomations.id, automation.id));

    console.log(`[STRIPE AUTOMATION] Successfully processed for: ${customerEmail}`);
  } catch (error: any) {
    console.error(`[STRIPE AUTOMATION] Error:`, error);
    
    await db
      .update(schema.stripeAutomationLogs)
      .set({
        status: "failed",
        errorMessage: error.message || "Errore sconosciuto",
      })
      .where(eq(schema.stripeAutomationLogs.id, log.id));
  }
}

// ============================================================
// SEND PROVISIONING EMAIL
// ============================================================
async function sendProvisioningEmail(params: {
  consultantId: string;
  recipientEmail: string;
  recipientName: string;
  recipientPhone?: string;
  password: string | null;
  mustChangePassword: boolean;
  tier: string;
  customSubject?: string;
  customTemplate?: string;
}) {
  const { consultantId, recipientEmail, recipientName, recipientPhone, password, mustChangePassword, tier, customSubject, customTemplate } = params;

  // Get consultant info
  const [consultant] = await db
    .select({
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      pricingPageConfig: schema.users.pricingPageConfig,
    })
    .from(schema.users)
    .where(eq(schema.users.id, consultantId))
    .limit(1);

  const consultantName = consultant 
    ? `${consultant.firstName} ${consultant.lastName}`.trim() 
    : "Il tuo consulente";

  // Fixed login URL
  const loginUrl = "https://www.conorbitale.it/login";

  // Get tier name from config
  const config = consultant?.pricingPageConfig || {};
  const tierNames: Record<string, string> = {
    bronze: config.level1Name || "Bronze",
    silver: config.level2Name || "Argento",
    gold: config.level3Name || "Oro",
  };
  const tierName = tierNames[tier] || tier;

  const subject = customSubject || `Benvenuto! Il tuo accesso ${tierName} è pronto`;

  // Build email HTML
  let emailHtml: string;
  
  if (customTemplate) {
    // Use custom template with variable replacement
    emailHtml = customTemplate
      .replace(/\{\{name\}\}/g, recipientName || "")
      .replace(/\{\{email\}\}/g, recipientEmail)
      .replace(/\{\{phone\}\}/g, recipientPhone || "")
      .replace(/\{\{password\}\}/g, password || "(usa la password esistente)")
      .replace(/\{\{tier\}\}/g, tierName)
      .replace(/\{\{consultant\}\}/g, consultantName)
      .replace(/\{\{loginUrl\}\}/g, loginUrl);
  } else {
    // Default email template with enthusiastic copy and step-by-step instructions
    const phoneSection = recipientPhone 
      ? `<p style="margin: 4px 0;"><strong>Telefono:</strong> ${recipientPhone}</p>`
      : "";
    
    // Build credentials section based on whether password is available and if user must change it
    let credentialsSection: string;
    
    if (password && mustChangePassword) {
      // New user or user who never changed password - show password and step-by-step
      credentialsSection = `
        <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 16px 0; font-weight: 700; font-size: 16px; color: #92400e;">Le tue credenziali di accesso:</p>
          <div style="background: white; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
            <p style="margin: 4px 0;"><strong>Email:</strong> ${recipientEmail}</p>
            ${phoneSection}
            <p style="margin: 8px 0 0 0;"><strong>Password temporanea:</strong></p>
            <p style="margin: 4px 0;"><code style="background: #fef9c3; padding: 8px 16px; border-radius: 4px; font-family: monospace; font-size: 16px; display: inline-block; letter-spacing: 1px; border: 1px dashed #fbbf24;">${password}</code></p>
          </div>
          
          <div style="background: #fffbeb; border-radius: 6px; padding: 16px;">
            <p style="margin: 0 0 12px 0; font-weight: 700; font-size: 15px; color: #92400e;">Come accedere - 3 semplici passi:</p>
            <div style="margin: 8px 0;">
              <p style="margin: 4px 0; font-size: 14px;"><strong style="color: #3b82f6;">STEP 1:</strong> Vai su <a href="${loginUrl}" style="color: #3b82f6; font-weight: 600;">www.conorbitale.it/login</a></p>
            </div>
            <div style="margin: 8px 0;">
              <p style="margin: 4px 0; font-size: 14px;"><strong style="color: #3b82f6;">STEP 2:</strong> Inserisci la tua email e la password temporanea qui sopra</p>
            </div>
            <div style="margin: 8px 0;">
              <p style="margin: 4px 0; font-size: 14px;"><strong style="color: #3b82f6;">STEP 3:</strong> Ti verra' chiesto di scegliere la tua nuova password personale</p>
            </div>
          </div>
          
          <p style="color: #b45309; font-size: 13px; margin: 16px 0 0 0; font-style: italic;">
            Conserva questa email! Contiene la password temporanea necessaria per il primo accesso.
          </p>
        </div>
      `;
    } else {
      // User already has their own password
      credentialsSection = `
        <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 12px 0; font-weight: 700; font-size: 16px; color: #166534;">Il tuo account e' gia' attivo!</p>
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
            Accedi con la password che hai gia' impostato in precedenza.
          </p>
          <div style="background: white; border-radius: 6px; padding: 12px;">
            <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> ${recipientEmail}</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Password:</strong> quella che hai scelto tu</p>
          </div>
          <p style="color: #166534; font-size: 13px; margin: 12px 0 0 0;">
            Se hai dimenticato la password, puoi reimpostarla dalla pagina di login.
          </p>
        </div>
      `;
    }

    emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Benvenuto a bordo!</h1>
              <p style="color: #dbeafe; margin: 8px 0 0 0; font-size: 16px;">Il tuo accesso ${tierName} e' pronto</p>
            </div>
            
            <div style="padding: 32px;">
              <p style="font-size: 18px; color: #334155; margin: 0 0 16px 0;">
                Ciao${recipientName ? ` ${recipientName}` : ""}!
              </p>
              
              <p style="font-size: 16px; color: #334155; margin: 0 0 8px 0;">
                Sono super contento di averti con noi!
              </p>
              
              <p style="font-size: 16px; color: #334155; margin: 0 0 16px 0;">
                Il tuo account su ConOrbitale e' stato creato con successo e sei pronto per iniziare il tuo percorso verso i tuoi obiettivi finanziari.
              </p>
              
              ${credentialsSection}
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
                  Accedi Subito
                </a>
              </div>
              
              <p style="font-size: 14px; color: #64748b; text-align: center; margin: 16px 0 0 0;">
                Link diretto: <a href="${loginUrl}" style="color: #3b82f6;">www.conorbitale.it/login</a>
              </p>
              
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                <p style="font-size: 16px; color: #334155; margin: 0 0 8px 0;">
                  Non vedo l'ora di iniziare a lavorare insieme!
                </p>
                <p style="font-size: 14px; color: #64748b; margin: 0;">
                  Un caro saluto,<br>
                  <strong>${consultantName}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  try {
    await sendEmail({
      to: recipientEmail,
      subject,
      html: emailHtml,
      consultantId,
    });
    console.log(`[STRIPE AUTOMATION] Welcome email sent to: ${recipientEmail}`);
  } catch (error) {
    console.error(`[STRIPE AUTOMATION] Failed to send email:`, error);
    throw error;
  }
}
