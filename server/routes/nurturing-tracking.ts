import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";

const router = Router();

const TRANSPARENT_PIXEL_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const TRANSPARENT_PIXEL = Buffer.from(TRANSPARENT_PIXEL_BASE64, "base64");

router.get("/api/nurturing/track/open/:logId", async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;
    
    if (!logId) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      return res.send(TRANSPARENT_PIXEL);
    }
    
    const [log] = await db.select()
      .from(schema.leadNurturingLogs)
      .where(eq(schema.leadNurturingLogs.id, logId))
      .limit(1);
    
    if (log && !log.openedAt) {
      await db.update(schema.leadNurturingLogs)
        .set({
          openedAt: new Date(),
        })
        .where(eq(schema.leadNurturingLogs.id, logId));
      
      console.log(`📧 [TRACKING] Email opened for log ${logId}`);
    }
    
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(TRANSPARENT_PIXEL);
  } catch (error: any) {
    console.error("[TRACKING] Open tracking error:", error);
    res.setHeader("Content-Type", "image/png");
    res.send(TRANSPARENT_PIXEL);
  }
});

router.get("/api/nurturing/track/click/:logId/:linkId", async (req: Request, res: Response) => {
  try {
    const { logId, linkId } = req.params;
    const { url } = req.query;
    
    if (!logId) {
      return res.redirect(typeof url === "string" ? url : "/");
    }
    
    const [log] = await db.select()
      .from(schema.leadNurturingLogs)
      .where(eq(schema.leadNurturingLogs.id, logId))
      .limit(1);
    
    if (log && !log.clickedAt) {
      await db.update(schema.leadNurturingLogs)
        .set({
          clickedAt: new Date(),
        })
        .where(eq(schema.leadNurturingLogs.id, logId));
      
      console.log(`📧 [TRACKING] Link clicked for log ${logId}, linkId: ${linkId}`);
    }
    
    if (typeof url === "string" && url) {
      try {
        const decoded = decodeURIComponent(url);
        const parsedUrl = new URL(decoded);
        if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
          return res.redirect(parsedUrl.href);
        }
        console.warn(`[TRACKING] Blocked suspicious redirect URL: ${decoded}`);
      } catch {
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return res.redirect(url);
        }
        console.warn(`[TRACKING] Blocked invalid redirect URL: ${url}`);
      }
    }
    
    if (log) {
      const [consultant] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, log.consultantId))
        .limit(1);
      
      if (consultant?.siteUrl) {
        return res.redirect(consultant.siteUrl);
      }
    }
    
    res.send(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Link non disponibile</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
          .container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h1 { color: #f59e0b; margin-bottom: 16px; }
          p { color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Link non disponibile</h1>
          <p>Il link richiesto non è più disponibile.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error("[TRACKING] Click tracking error:", error);
    const { url } = req.query;
    if (typeof url === "string" && url) {
      return res.redirect(url);
    }
    res.redirect("/");
  }
});

export default router;
