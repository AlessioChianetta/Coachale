import { Router } from "express";
import { pool } from "../db";

const router = Router();

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

router.get("/o/:token", async (req, res) => {
  const { token } = req.params;
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
  const ua = req.headers["user-agent"] || "";

  try {
    const result = await pool.query(
      `SELECT id, triggered_at FROM email_tracking_events WHERE token = $1 AND event_type = 'open' LIMIT 1`,
      [token]
    );
    if (result.rows.length > 0 && !result.rows[0].triggered_at) {
      await pool.query(
        `UPDATE email_tracking_events SET triggered_at = now(), ip_address = $1, user_agent = $2 WHERE token = $3`,
        [ip, ua, token]
      );
    }
  } catch (err) {
    console.error("[TRACKING-OPEN] Error:", err);
  }

  res.set({
    "Content-Type": "image/gif",
    "Content-Length": TRANSPARENT_GIF.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
  });
  res.status(200).end(TRANSPARENT_GIF);
});

router.get("/c/:token", async (req, res) => {
  const { token } = req.params;
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
  const ua = req.headers["user-agent"] || "";

  let targetUrl = "https://google.com";

  try {
    const result = await pool.query(
      `SELECT id, target_url, triggered_at FROM email_tracking_events WHERE token = $1 AND event_type = 'click' LIMIT 1`,
      [token]
    );
    if (result.rows.length > 0) {
      if (result.rows[0].target_url) {
        targetUrl = result.rows[0].target_url;
      }
      if (!result.rows[0].triggered_at) {
        await pool.query(
          `UPDATE email_tracking_events SET triggered_at = now(), ip_address = $1, user_agent = $2 WHERE token = $3`,
          [ip, ua, token]
        );
      }
    }
  } catch (err) {
    console.error("[TRACKING-CLICK] Error:", err);
  }

  res.redirect(302, targetUrl);
});

export default router;
