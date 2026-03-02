import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { systemSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

async function getWebhookPublicKey(): Promise<string | null> {
  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "telnyx_webhook_public_key"))
    .limit(1);
  return (setting?.value as string) || null;
}

function decodePublicKey(publicKeyInput: string): Buffer {
  const trimmed = publicKeyInput.trim();
  if (trimmed.endsWith("=") || /^[A-Za-z0-9+/]/.test(trimmed)) {
    try {
      const decoded = Buffer.from(trimmed, "base64");
      if (decoded.length === 32) return decoded;
    } catch {}
  }
  const hexDecoded = Buffer.from(trimmed, "hex");
  if (hexDecoded.length === 32) return hexDecoded;
  throw new Error(`Invalid public key format (length=${trimmed.length}). Expected 32-byte key in base64 or hex.`);
}

function verifyTelnyxSignature(rawBody: Buffer, signature: string, timestamp: string, publicKeyRaw: string): boolean {
  try {
    const signedPayload = `${timestamp}|${rawBody.toString("utf8")}`;
    const signatureBuffer = Buffer.from(signature, "base64");
    const publicKeyBuffer = decodePublicKey(publicKeyRaw);

    const keyObject = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        publicKeyBuffer,
      ]),
      format: "der",
      type: "spki",
    });

    return crypto.verify(null, Buffer.from(signedPayload), keyObject, signatureBuffer);
  } catch (err: any) {
    console.error("[TELNYX-WEBHOOK] Signature verification error:", err.message);
    return false;
  }
}

async function appendProvisioningLog(requestId: number, message: string) {
  await db.execute(sql`
    UPDATE voip_provisioning_requests
    SET error_log = COALESCE(error_log, '') || ${`[${new Date().toISOString()}] ${message}\n`},
        updated_at = NOW()
    WHERE id = ${requestId}
  `);
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["telnyx-signature-ed25519"] as string;
    const timestamp = req.headers["telnyx-timestamp"] as string;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    const publicKey = await getWebhookPublicKey();

    if (publicKey) {
      if (!signature || !timestamp || !rawBody) {
        console.warn("[TELNYX-WEBHOOK] Public key configured but missing signature headers — rejecting request");
        return res.status(401).json({ error: "Missing signature headers" });
      }
      const valid = verifyTelnyxSignature(rawBody, signature, timestamp, publicKey);
      if (!valid) {
        console.warn("[TELNYX-WEBHOOK] Invalid signature — rejecting request");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else {
      console.warn("[TELNYX-WEBHOOK] No public key configured — skipping signature verification");
    }

    const body = req.body;
    const eventData = body?.data;
    if (!eventData) {
      console.warn("[TELNYX-WEBHOOK] No event data in payload");
      return res.status(200).json({ received: true });
    }

    const eventType = eventData.event_type;
    const payload = eventData.payload;

    if (!eventType || !payload) {
      console.warn("[TELNYX-WEBHOOK] Missing event_type or payload");
      return res.status(200).json({ received: true });
    }

    console.log(`[TELNYX-WEBHOOK] Received event: ${eventType}, payload.status: ${payload.status}, payload.id: ${payload.id}`);

    if (eventType === "requirement_group.status_changed") {
      await handleRequirementGroupEvent(payload, eventType);
    } else if (eventType === "number_order.status_updated") {
      await handleNumberOrderEvent(payload, eventType);
    } else {
      console.log(`[TELNYX-WEBHOOK] Unhandled event type: ${eventType}`);
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("[TELNYX-WEBHOOK] Error processing webhook:", error.message);
    return res.status(200).json({ received: true, error: "internal" });
  }
});

async function handleRequirementGroupEvent(payload: any, eventType: string) {
  const groupId = payload.id;
  const status = payload.status;

  if (!groupId) {
    console.warn("[TELNYX-WEBHOOK] requirement_group event without id");
    return;
  }

  const result = await db.execute(sql`
    SELECT id, status, consultant_id FROM voip_provisioning_requests
    WHERE telnyx_requirement_group_id = ${groupId}
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.warn(`[TELNYX-WEBHOOK] No provisioning request found for requirement_group: ${groupId}`);
    return;
  }

  const request = result.rows[0] as any;

  if (status === "approved") {
    console.log(`[TELNYX-WEBHOOK] KYC approved for request ${request.id}`);
    await db.execute(sql`
      UPDATE voip_provisioning_requests
      SET status = 'kyc_approved', updated_at = NOW()
      WHERE id = ${request.id} AND status IN ('kyc_submitted', 'documents_uploaded')
    `);
    await appendProvisioningLog(request.id, `WEBHOOK: KYC approved (event: ${eventType})`);
  } else if (status === "action-required" || status === "rejected" || status === "declined") {
    console.log(`[TELNYX-WEBHOOK] KYC rejected/action-required for request ${request.id}: ${status}`);
    await db.execute(sql`
      UPDATE voip_provisioning_requests
      SET status = 'rejected', updated_at = NOW()
      WHERE id = ${request.id} AND status IN ('kyc_submitted', 'documents_uploaded')
    `);
    await appendProvisioningLog(request.id, `WEBHOOK: KYC ${status} (event: ${eventType}). Details: ${JSON.stringify(payload).substring(0, 500)}`);
  } else {
    console.log(`[TELNYX-WEBHOOK] requirement_group status unchanged or unknown: ${status}`);
    await appendProvisioningLog(request.id, `WEBHOOK: requirement_group status=${status} (no action taken)`);
  }
}

async function handleNumberOrderEvent(payload: any, eventType: string) {
  const orderId = payload.id;
  const status = payload.status;
  const phoneNumbers = payload.phone_numbers || [];

  if (!orderId) {
    console.warn("[TELNYX-WEBHOOK] number_order event without id");
    return;
  }

  const result = await db.execute(sql`
    SELECT id, status, consultant_id FROM voip_provisioning_requests
    WHERE telnyx_number_order_id = ${orderId}
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.warn(`[TELNYX-WEBHOOK] No provisioning request found for number_order: ${orderId}`);
    return;
  }

  const request = result.rows[0] as any;

  if (status === "success") {
    const assignedNumber = phoneNumbers[0]?.phone_number || phoneNumbers[0] || null;
    console.log(`[TELNYX-WEBHOOK] Number order completed for request ${request.id}, number: ${assignedNumber}`);
    
    const updateFields: any = { status: 'number_active' };
    if (assignedNumber) {
      await db.execute(sql`
        UPDATE voip_provisioning_requests
        SET status = 'number_active', assigned_number = ${assignedNumber}, updated_at = NOW()
        WHERE id = ${request.id} AND status IN ('number_ordered', 'kyc_approved')
      `);
    } else {
      await db.execute(sql`
        UPDATE voip_provisioning_requests
        SET status = 'number_active', updated_at = NOW()
        WHERE id = ${request.id} AND status IN ('number_ordered', 'kyc_approved')
      `);
    }
    await appendProvisioningLog(request.id, `WEBHOOK: Number order completed (event: ${eventType}). Number: ${assignedNumber || 'unknown'}`);
  } else if (status === "failure") {
    console.log(`[TELNYX-WEBHOOK] Number order failed for request ${request.id}`);
    await db.execute(sql`
      UPDATE voip_provisioning_requests
      SET status = 'rejected', updated_at = NOW()
      WHERE id = ${request.id} AND status IN ('number_ordered', 'kyc_approved')
    `);
    await appendProvisioningLog(request.id, `WEBHOOK: Number order failed (event: ${eventType}). Details: ${JSON.stringify(payload).substring(0, 500)}`);
  } else {
    console.log(`[TELNYX-WEBHOOK] number_order status: ${status} (no action taken)`);
    await appendProvisioningLog(request.id, `WEBHOOK: number_order status=${status} (no action taken)`);
  }
}

export default router;
