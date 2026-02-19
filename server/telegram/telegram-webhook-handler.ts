import { Request, Response } from "express";
import { processIncomingTelegramMessage } from "./telegram-service";
import { db } from "../db";
import { sql } from "drizzle-orm";

export async function handleTelegramWebhook(req: Request, res: Response) {
  const configId = req.params.configId;
  if (!configId) {
    console.error("[TELEGRAM] Webhook called without configId");
    return res.status(400).json({ error: "Missing configId" });
  }

  try {
    const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string;
    const configResult = await db.execute(sql`
      SELECT webhook_secret FROM telegram_bot_configs WHERE id = ${parseInt(configId)} LIMIT 1
    `);
    const storedSecret = (configResult.rows[0] as any)?.webhook_secret;

    if (!storedSecret || storedSecret !== secretToken) {
      console.warn(`[TELEGRAM] Webhook secret mismatch for configId ${configId}`);
      return res.status(403).json({ error: "Forbidden" });
    }
  } catch (err: any) {
    console.error("[TELEGRAM] Webhook auth error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }

  res.status(200).json({ ok: true });

  try {
    await processIncomingTelegramMessage(req.body, configId);
  } catch (err: any) {
    console.error("[TELEGRAM] Webhook processing error:", err.message);
  }
}
