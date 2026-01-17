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
  const [apiKeys] = await db
    .select({ stripeSecretKey: schema.externalApiKeys.stripeSecretKey })
    .from(schema.externalApiKeys)
    .where(eq(schema.externalApiKeys.consultantId, consultantId))
    .limit(1);

  if (!apiKeys?.stripeSecretKey) {
    return null;
  }

  return new Stripe(apiKeys.stripeSecretKey, { apiVersion: "2024-12-18.acacia" });
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
    // Get consultant's webhook secret
    const [apiKeys] = await db
      .select({ 
        stripeWebhookSecret: schema.externalApiKeys.stripeWebhookSecret,
        stripeSecretKey: schema.externalApiKeys.stripeSecretKey 
      })
      .from(schema.externalApiKeys)
      .where(eq(schema.externalApiKeys.consultantId, consultantId))
      .limit(1);

    if (!apiKeys?.stripeWebhookSecret || !apiKeys?.stripeSecretKey) {
      console.error(`[STRIPE WEBHOOK] Missing Stripe config for consultant: ${consultantId}`);
      return res.status(400).json({ error: "Configurazione Stripe mancante" });
    }

    const stripe = new Stripe(apiKeys.stripeSecretKey, { apiVersion: "2024-12-18.acacia" });

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, apiKeys.stripeWebhookSecret);
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
  const customerPhone = session.customer_details?.phone || "";

  console.log(`[STRIPE AUTOMATION] Processing for email: ${customerEmail}`);

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

    // Check if user already exists
    const [existingUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, customerEmail.toLowerCase()))
      .limit(1);

    let userId: string;
    let password: string | null = null;
    const rolesAssigned: string[] = [];

    if (existingUser) {
      // User exists - update roles if needed
      userId = existingUser.id;
      console.log(`[STRIPE AUTOMATION] User already exists: ${userId}`);

      // Add client relationship if needed
      if (automation.createAsClient) {
        const [existingRelation] = await db
          .select({ id: schema.consultantClients.id })
          .from(schema.consultantClients)
          .where(and(
            eq(schema.consultantClients.consultantId, consultantId),
            eq(schema.consultantClients.clientId, userId)
          ))
          .limit(1);

        if (!existingRelation) {
          await db.insert(schema.consultantClients).values({
            consultantId,
            clientId: userId,
            status: "active",
          });
          rolesAssigned.push("client");
        }

        // Update client level if specified
        if (automation.clientLevel) {
          const levelMap = { bronze: 1, silver: 2, gold: 3 };
          await db
            .update(schema.clientLevelSubscriptions)
            .set({ 
              level: levelMap[automation.clientLevel],
              isActive: true,
            })
            .where(and(
              eq(schema.clientLevelSubscriptions.clientId, userId),
              eq(schema.clientLevelSubscriptions.consultantId, consultantId)
            ));
        }
      }
    } else {
      // Create new user
      password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const nameParts = customerName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const roles: string[] = [];
      if (automation.createAsClient) roles.push("client");
      if (automation.createAsConsultant) roles.push("consultant");

      const [newUser] = await db
        .insert(schema.users)
        .values({
          email: customerEmail.toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName,
          roles,
          phoneNumber: customerPhone || null,
        })
        .returning();

      userId = newUser.id;
      rolesAssigned.push(...roles);
      console.log(`[STRIPE AUTOMATION] Created new user: ${userId}`);

      // Create client relationship
      if (automation.createAsClient) {
        await db.insert(schema.consultantClients).values({
          consultantId,
          clientId: userId,
          status: "active",
        });

        // Create client level subscription
        if (automation.clientLevel) {
          const levelMap = { bronze: 1, silver: 2, gold: 3 };
          await db.insert(schema.clientLevelSubscriptions).values({
            clientId: userId,
            consultantId,
            level: levelMap[automation.clientLevel],
            isActive: true,
          });
        }
      }
    }

    // Send welcome email if enabled
    if (automation.sendWelcomeEmail && customerEmail) {
      await sendProvisioningEmail({
        consultantId,
        recipientEmail: customerEmail,
        recipientName: customerName,
        password,
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
  password: string | null;
  tier: string;
  customSubject?: string;
  customTemplate?: string;
}) {
  const { consultantId, recipientEmail, recipientName, password, tier, customSubject, customTemplate } = params;

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

  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
  const baseUrl = replitDomain 
    ? (replitDomain.startsWith("http") ? replitDomain : `https://${replitDomain}`)
    : "https://app.example.com";
  const loginUrl = `${baseUrl}/login`;

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
      .replace(/\{\{password\}\}/g, password || "(usa la password esistente)")
      .replace(/\{\{tier\}\}/g, tierName)
      .replace(/\{\{consultant\}\}/g, consultantName)
      .replace(/\{\{loginUrl\}\}/g, loginUrl);
  } else {
    // Default email template
    const credentialsSection = password 
      ? `
        <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-weight: 600;">Le tue credenziali di accesso:</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> ${recipientEmail}</p>
          <p style="margin: 4px 0;"><strong>Password:</strong> ${password}</p>
          <p style="color: #92400e; font-size: 14px; margin: 12px 0 0 0;">
            ⚠️ Conserva questa email e cambia la password al primo accesso per sicurezza.
          </p>
        </div>
      `
      : `
        <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0;">Il tuo account è già attivo. Accedi con le tue credenziali esistenti.</p>
        </div>
      `;

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
              <h1 style="color: white; margin: 0; font-size: 24px;">Benvenuto!</h1>
              <p style="color: #dbeafe; margin: 8px 0 0 0;">Il tuo accesso ${tierName} è pronto</p>
            </div>
            
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #334155; margin: 0 0 16px 0;">
                Ciao${recipientName ? ` ${recipientName}` : ""},
              </p>
              
              <p style="font-size: 16px; color: #334155; margin: 0 0 16px 0;">
                Grazie per il tuo acquisto! Il tuo account è stato creato automaticamente e puoi accedere subito alla piattaforma.
              </p>
              
              ${credentialsSection}
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Accedi alla Piattaforma
                </a>
              </div>
              
              <p style="font-size: 14px; color: #64748b; margin: 24px 0 0 0;">
                Un saluto,<br>
                <strong>${consultantName}</strong>
              </p>
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
    });
    console.log(`[STRIPE AUTOMATION] Welcome email sent to: ${recipientEmail}`);
  } catch (error) {
    console.error(`[STRIPE AUTOMATION] Failed to send email:`, error);
    throw error;
  }
}
