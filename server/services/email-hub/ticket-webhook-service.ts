import { db } from "../../db";
import * as schema from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { createSmtpService } from "./smtp-service";

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

    sendTicketEmailNotification(ticket.id, emailId, consultantId, accountId, reason, options.reasonDetails).catch(err => {
      console.error(`[TICKET] Email notification failed for ticket ${ticket.id}:`, err.message);
    });

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

const REASON_LABELS: Record<string, string> = {
  no_kb_answer: "Knowledge Base senza risposta",
  high_urgency: "Alta urgenza rilevata",
  negative_sentiment: "Sentiment negativo rilevato",
  escalation_keyword: "Parola chiave di escalation",
  ai_low_confidence: "Bassa confidenza AI",
  low_confidence: "Bassa confidenza",
  manual: "Creazione manuale",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendTicketEmailNotification(
  ticketId: string,
  emailId: string,
  consultantId: string,
  accountId: string,
  reason: string,
  reasonDetails?: string
): Promise<void> {
  const [account] = await db
    .select()
    .from(schema.emailAccounts)
    .where(eq(schema.emailAccounts.id, accountId));

  if (!account?.smtpHost || !account?.smtpUser || !account?.smtpPassword) {
    console.log(`[TICKET-EMAIL] No SMTP config for account ${accountId}, skipping notification`);
    return;
  }

  const [consultant] = await db
    .select({ email: schema.users.email, firstName: schema.users.firstName })
    .from(schema.users)
    .where(eq(schema.users.id, consultantId));

  if (!consultant?.email) {
    console.log(`[TICKET-EMAIL] No consultant email found for ${consultantId}`);
    return;
  }

  const [email] = await db
    .select({
      subject: schema.hubEmails.subject,
      fromEmail: schema.hubEmails.fromEmail,
      fromName: schema.hubEmails.fromName,
      snippet: schema.hubEmails.snippet,
      receivedAt: schema.hubEmails.receivedAt,
    })
    .from(schema.hubEmails)
    .where(eq(schema.hubEmails.id, emailId));

  const [ticket] = await db
    .select()
    .from(schema.emailTickets)
    .where(eq(schema.emailTickets.id, ticketId));

  if (!email || !ticket) return;

  const reasonLabel = escapeHtml(REASON_LABELS[reason] || reason);
  const priorityLabel = escapeHtml(PRIORITY_LABELS[ticket.priority] || ticket.priority);
  const senderName = escapeHtml(email.fromName || email.fromEmail);
  const senderEmail = escapeHtml(email.fromEmail);
  const emailSubject = escapeHtml(email.subject || "(Nessun oggetto)");
  const snippet = email.snippet ? escapeHtml(email.snippet.substring(0, 200)) : "";
  const receivedDate = email.receivedAt 
    ? new Date(email.receivedAt).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })
    : "";
  const safeReasonDetails = reasonDetails ? escapeHtml(reasonDetails) : "";
  const safeSuggestedResponse = ticket.suggestedResponse ? escapeHtml(ticket.suggestedResponse.substring(0, 500)) : "";

  const priorityColor = ticket.priority === "urgent" ? "#ef4444" 
    : ticket.priority === "high" ? "#f97316" 
    : ticket.priority === "medium" ? "#3b82f6" 
    : "#6b7280";

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Millie — Nuovo Ticket</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Un'email richiede la tua attenzione</p>
      </div>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <span style="background: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
            Priorità: ${priorityLabel}
          </span>
          <span style="background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;">
            ${reasonLabel}
          </span>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 4px; font-size: 14px; color: #64748b;">Email originale:</p>
          <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #1e293b;">${emailSubject}</p>
          <p style="margin: 0 0 4px; font-size: 13px; color: #64748b;">Da: <strong style="color: #334155;">${senderName}</strong> &lt;${senderEmail}&gt;</p>
          ${receivedDate ? `<p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">Ricevuta: ${receivedDate}</p>` : ""}
          ${snippet ? `<p style="margin: 8px 0 0; font-size: 13px; color: #475569; border-left: 3px solid #e2e8f0; padding-left: 12px;">${snippet}...</p>` : ""}
        </div>

        ${safeReasonDetails ? `
        <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <p style="margin: 0; font-size: 13px; color: #92400e;"><strong>Dettagli:</strong> ${safeReasonDetails}</p>
        </div>
        ` : ""}

        ${safeSuggestedResponse ? `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #166534; font-weight: 600;">Risposta suggerita da Millie:</p>
          <p style="margin: 0; font-size: 13px; color: #15803d; white-space: pre-wrap;">${safeSuggestedResponse}</p>
        </div>
        ` : ""}

        <p style="margin: 16px 0 0; font-size: 13px; color: #64748b; text-align: center;">
          Gestisci questo ticket dall'Email Hub → sezione Ticket
        </p>
      </div>
      
      <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 16px;">
        Questa notifica è stata inviata automaticamente da Millie Email Writer
      </p>
    </div>
  `;

  const textBody = `
Millie — Nuovo Ticket Creato

Priorità: ${priorityLabel}
Motivo: ${reasonLabel}

Email originale:
Oggetto: ${emailSubject}
Da: ${senderName} <${email.fromEmail}>
${receivedDate ? `Ricevuta: ${receivedDate}` : ""}
${snippet ? `\nAnteprima: ${snippet}...` : ""}
${reasonDetails ? `\nDettagli: ${reasonDetails}` : ""}
${ticket.suggestedResponse ? `\nRisposta suggerita: ${ticket.suggestedResponse.substring(0, 500)}` : ""}

Gestisci questo ticket dall'Email Hub → sezione Ticket
  `.trim();

  try {
    const smtpService = createSmtpService({
      host: account.smtpHost,
      port: account.smtpPort || 587,
      user: account.smtpUser,
      password: account.smtpPassword,
      tls: account.smtpTls ?? true,
    });

    const result = await smtpService.sendEmail({
      from: account.emailAddress,
      fromName: "Millie — Email Hub",
      to: consultant.email,
      subject: `[Ticket] ${emailSubject} — ${reasonLabel}`,
      html: htmlBody,
      text: textBody,
    });

    if (result.success) {
      console.log(`[TICKET-EMAIL] Notification sent to ${consultant.email} for ticket ${ticketId}`);
    } else {
      console.error(`[TICKET-EMAIL] Failed to send notification: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`[TICKET-EMAIL] Error sending notification:`, error.message);
  }
}
