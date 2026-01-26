/**
 * Twitter/X Webhook Router
 * Handles incoming webhook events from X Account Activity API
 */

import { Router, Request, Response } from "express";
import { verifyTwitterWebhook, handleTwitterWebhook } from "../../twitter/webhook-handler";

const router = Router();

/**
 * GET /api/twitter/webhook
 * CRC (Challenge Response Check) verification
 * X sends this periodically to verify the webhook is alive
 */
router.get("/", async (req: Request, res: Response) => {
  await verifyTwitterWebhook(req, res);
});

/**
 * POST /api/twitter/webhook
 * Incoming webhook events (DMs, typing, reads, etc.)
 */
router.post("/", async (req: Request, res: Response) => {
  await handleTwitterWebhook(req, res);
});

export default router;
