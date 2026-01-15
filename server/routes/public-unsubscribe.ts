import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import crypto from "crypto";

const router = Router();

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || "nurturing-unsubscribe-secret-2026";

function validateUnsubscribeToken(token: string): { valid: boolean; leadId?: string; consultantId?: string } {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) {
      return { valid: false };
    }
    
    const [leadId, consultantId, signature] = parts;
    
    if (!leadId || leadId.length < 10 || !consultantId || !signature) {
      return { valid: false };
    }
    
    const expectedSignature = crypto
      .createHmac("sha256", UNSUBSCRIBE_SECRET)
      .update(`${leadId}:${consultantId}`)
      .digest("base64url")
      .substring(0, 32);
    
    if (signature !== expectedSignature) {
      console.warn(`[UNSUBSCRIBE] Invalid signature for lead ${leadId}`);
      return { valid: false };
    }
    
    return { valid: true, leadId, consultantId };
  } catch (error) {
    console.error("[UNSUBSCRIBE] Token validation error:", error);
    return { valid: false };
  }
}

export function generateUnsubscribeToken(leadId: string, consultantId: string): string {
  const signature = crypto
    .createHmac("sha256", UNSUBSCRIBE_SECRET)
    .update(`${leadId}:${consultantId}`)
    .digest("base64url")
    .substring(0, 32);
  
  return `${leadId}:${consultantId}:${signature}`;
}

router.get("/unsubscribe/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const validation = validateUnsubscribeToken(token);
    
    if (!validation.valid || !validation.leadId) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link non valido</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #ef4444; margin-bottom: 16px; }
            p { color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Link non valido</h1>
            <p>Il link di disiscrizione non è valido o è scaduto.</p>
          </div>
        </body>
        </html>
      `);
    }
    
    const [lead] = await db.select()
      .from(schema.proactiveLeads)
      .where(eq(schema.proactiveLeads.id, validation.leadId))
      .limit(1);
    
    if (!lead) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Non trovato</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #f59e0b; margin-bottom: 16px; }
            p { color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Iscrizione non trovata</h1>
            <p>Non abbiamo trovato la tua iscrizione nel nostro sistema.</p>
          </div>
        </body>
        </html>
      `);
    }
    
    if (lead.nurturingOptOutAt) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Già disiscritto</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #10b981; margin-bottom: 16px; }
            p { color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Già disiscritto</h1>
            <p>Sei già stato rimosso dalla nostra mailing list.</p>
          </div>
        </body>
        </html>
      `);
    }
    
    res.send(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conferma disiscrizione</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
          .container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h1 { color: #1e293b; margin-bottom: 16px; }
          p { color: #64748b; margin-bottom: 24px; }
          button { background: #ef4444; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; }
          button:hover { background: #dc2626; }
          .cancel { background: #e5e7eb; color: #374151; margin-left: 12px; }
          .cancel:hover { background: #d1d5db; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Conferma disiscrizione</h1>
          <p>Sei sicuro di voler smettere di ricevere le nostre email? Ci mancherai!</p>
          <form method="POST" action="/unsubscribe/${token}">
            <button type="submit">Disiscrivimi</button>
            <button type="button" class="cancel" onclick="window.close()">Annulla</button>
          </form>
        </div>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error("[UNSUBSCRIBE] Error:", error);
    res.status(500).send("Si è verificato un errore. Riprova più tardi.");
  }
});

router.post("/unsubscribe/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const validation = validateUnsubscribeToken(token);
    
    if (!validation.valid || !validation.leadId) {
      return res.status(400).send("Token non valido");
    }
    
    await db.update(schema.proactiveLeads)
      .set({
        nurturingEnabled: false,
        nurturingOptOutAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.proactiveLeads.id, validation.leadId));
    
    console.log(`📧 [UNSUBSCRIBE] Lead ${validation.leadId} unsubscribed from nurturing`);
    
    res.send(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Disiscrizione completata</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
          .container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h1 { color: #10b981; margin-bottom: 16px; }
          p { color: #64748b; }
          .icon { font-size: 48px; margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>Disiscrizione completata</h1>
          <p>Sei stato rimosso dalla nostra mailing list. Non riceverai più email di nurturing.</p>
          <p style="margin-top: 24px; font-size: 14px;">Puoi chiudere questa pagina.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error("[UNSUBSCRIBE] Error:", error);
    res.status(500).send("Si è verificato un errore. Riprova più tardi.");
  }
});

export default router;
