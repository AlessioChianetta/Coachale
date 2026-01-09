import { db } from "../../db";
import * as schema from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

export interface TicketWebhookPayload {
  event: "ticket.suggested" | "ticket.created" | "ticket.updated" | "ticket.resolved";
  timestamp: string;
  ticket: {
    id: string;
    status: string;
    priority: string;
    reason: string;
    reasonDetails?: string;
  };
  email: {
    id: string;
    subject?: string;
    fromEmail: string;
    fromName?: string;
    snippet?: string;
    receivedAt?: string;
  };
  aiClassification?: {
    intent?: string;
    urgency?: string;
    sentiment?: string;
    category?: string;
    suggestedAction?: string;
  };
  suggestedResponse?: string;
  consultant: {
    id: string;
    email?: string;
  };
}

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  logId?: string;
}

export async function sendTicketWebhook(
  ticketId: string,
  eventType: TicketWebhookPayload["event"] = "ticket.suggested"
): Promise<WebhookResult> {
  const [ticket] = await db
    .select()
    .from(schema.emailTickets)
    .where(eq(schema.emailTickets.id, ticketId));

  if (!ticket) {
    return { success: false, error: "Ticket not found" };
  }

  const [settings] = await db
    .select()
    .from(schema.emailTicketSettings)
    .where(eq(schema.emailTicketSettings.consultantId, ticket.consultantId));

  if (!settings?.webhookEnabled || !settings?.webhookUrl) {
    console.log(`[WEBHOOK] Webhook not enabled for consultant ${ticket.consultantId}`);
    return { success: true, error: "Webhook not configured" };
  }

  const [email] = await db
    .select()
    .from(schema.hubEmails)
    .where(eq(schema.hubEmails.id, ticket.emailId));

  const [consultant] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, ticket.consultantId));

  const payload: TicketWebhookPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    ticket: {
      id: ticket.id,
      status: ticket.status,
      priority: ticket.priority,
      reason: ticket.reason,
      reasonDetails: ticket.reasonDetails || undefined,
    },
    email: {
      id: ticket.emailId,
      subject: email?.subject || undefined,
      fromEmail: email?.fromEmail || "",
      fromName: email?.fromName || undefined,
      snippet: email?.snippet || undefined,
      receivedAt: email?.receivedAt?.toISOString(),
    },
    aiClassification: ticket.aiClassification as TicketWebhookPayload["aiClassification"],
    suggestedResponse: ticket.suggestedResponse || undefined,
    consultant: {
      id: ticket.consultantId,
      email: consultant?.email,
    },
  };

  const signature = generateSignature(payload, settings.webhookSecret || "");

  const [log] = await db
    .insert(schema.emailWebhookLogs)
    .values({
      consultantId: ticket.consultantId,
      ticketId: ticket.id,
      eventType,
      payload: payload as any,
      webhookUrl: settings.webhookUrl,
      status: "pending",
      attempts: 0,
    })
    .returning();

  try {
    console.log(`[WEBHOOK] Sending ${eventType} to ${settings.webhookUrl}`);

    const response = await fetch(settings.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": eventType,
        "X-Webhook-Timestamp": payload.timestamp,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    const responseBody = await response.text().catch(() => "");

    await db
      .update(schema.emailWebhookLogs)
      .set({
        status: response.ok ? "success" : "failed",
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 1000),
        attempts: 1,
        lastAttemptAt: new Date(),
      })
      .where(eq(schema.emailWebhookLogs.id, log.id));

    await db
      .update(schema.emailTickets)
      .set({
        webhookSent: true,
        webhookSentAt: new Date(),
        webhookResponseStatus: response.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.emailTickets.id, ticketId));

    if (response.ok) {
      console.log(`[WEBHOOK] Successfully sent ${eventType} for ticket ${ticketId}`);
      return { success: true, statusCode: response.status, logId: log.id };
    } else {
      console.error(`[WEBHOOK] Failed with status ${response.status}: ${responseBody}`);
      return { 
        success: false, 
        statusCode: response.status, 
        error: `HTTP ${response.status}`,
        logId: log.id,
      };
    }
  } catch (error: any) {
    console.error(`[WEBHOOK] Error sending webhook:`, error);

    await db
      .update(schema.emailWebhookLogs)
      .set({
        status: "failed",
        errorMessage: error.message,
        attempts: 1,
        lastAttemptAt: new Date(),
      })
      .where(eq(schema.emailWebhookLogs.id, log.id));

    return { success: false, error: error.message, logId: log.id };
  }
}

function generateSignature(payload: object, secret: string): string {
  if (!secret) return "";
  
  const payloadString = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadString);
  return `sha256=${hmac.digest("hex")}`;
}

export async function createTicketFromEmail(
  emailId: string,
  consultantId: string,
  accountId: string,
  reason: schema.EmailTicket["reason"],
  options: {
    reasonDetails?: string;
    aiClassification?: any;
    suggestedResponse?: string;
    priority?: schema.EmailTicket["priority"];
  } = {}
): Promise<schema.EmailTicket | null> {
  try {
    const [existingTicket] = await db
      .select()
      .from(schema.emailTickets)
      .where(
        and(
          eq(schema.emailTickets.emailId, emailId),
          eq(schema.emailTickets.status, "open")
        )
      );

    if (existingTicket) {
      console.log(`[TICKET] Ticket already exists for email ${emailId}`);
      return existingTicket;
    }

    const priority = options.priority || determinePriority(reason, options.aiClassification);

    const [ticket] = await db
      .insert(schema.emailTickets)
      .values({
        consultantId,
        emailId,
        accountId,
        status: "open",
        priority,
        reason,
        reasonDetails: options.reasonDetails,
        aiClassification: options.aiClassification,
        suggestedResponse: options.suggestedResponse,
      })
      .returning();

    console.log(`[TICKET] Created ticket ${ticket.id} for email ${emailId} (reason: ${reason})`);

    await sendTicketWebhook(ticket.id, "ticket.suggested");

    return ticket;
  } catch (error) {
    console.error("[TICKET] Error creating ticket:", error);
    return null;
  }
}

function determinePriority(
  reason: schema.EmailTicket["reason"],
  aiClassification?: any
): schema.EmailTicket["priority"] {
  if (reason === "high_urgency") return "urgent";
  if (reason === "negative_sentiment") return "high";
  if (reason === "escalation_keyword") return "high";
  
  if (aiClassification?.urgency === "high") return "high";
  if (aiClassification?.sentiment === "negative") return "high";
  
  return "medium";
}

export async function getTicketSettings(consultantId: string): Promise<schema.EmailTicketSettings | null> {
  const [settings] = await db
    .select()
    .from(schema.emailTicketSettings)
    .where(eq(schema.emailTicketSettings.consultantId, consultantId));

  return settings || null;
}

export async function updateTicketSettings(
  consultantId: string,
  data: Partial<schema.InsertEmailTicketSettings>
): Promise<schema.EmailTicketSettings> {
  const existing = await getTicketSettings(consultantId);

  if (existing) {
    const [updated] = await db
      .update(schema.emailTicketSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.emailTicketSettings.consultantId, consultantId))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(schema.emailTicketSettings)
      .values({ consultantId, ...data })
      .returning();
    return created;
  }
}
