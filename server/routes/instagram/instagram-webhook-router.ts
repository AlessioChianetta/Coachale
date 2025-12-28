/**
 * Instagram Webhook Router
 * 
 * Handles Meta webhook verification and incoming message events.
 * Endpoints are public (no auth) as Meta requires direct access.
 */

import { Router, Request, Response } from "express";
import { verifyInstagramWebhook, handleInstagramWebhook } from "../../instagram/webhook-handler";

const router = Router();

/**
 * GET /api/instagram/webhook
 * Meta webhook verification (challenge-response)
 */
router.get("/webhook", async (req: Request, res: Response) => {
  await verifyInstagramWebhook(req, res);
});

/**
 * POST /api/instagram/webhook
 * Receive incoming messages and events from Meta
 */
router.post("/webhook", async (req: Request, res: Response) => {
  await handleInstagramWebhook(req, res);
});

export default router;
