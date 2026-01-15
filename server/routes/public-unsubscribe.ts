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

function generateStyledPage(options: {
  title: string;
  icon?: string;
  iconColor?: string;
  heading: string;
  message: string;
  leadName?: string;
  consultantName?: string;
  consultantLogo?: string;
  showForm?: boolean;
  formAction?: string;
  primaryButtonText?: string;
  showCancelButton?: boolean;
  accentColor?: string;
}) {
  const {
    title,
    icon,
    iconColor = "#3b82f6",
    heading,
    message,
    leadName,
    consultantName,
    consultantLogo,
    showForm = false,
    formAction = "",
    primaryButtonText = "Conferma",
    showCancelButton = true,
    accentColor = "#3b82f6",
  } = options;

  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        
        .card {
          background: white;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          max-width: 440px;
          width: 100%;
          padding: 48px 40px;
          text-align: center;
          animation: fadeIn 0.5s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .logo {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          margin-bottom: 24px;
          border: 3px solid #f1f5f9;
        }
        
        .icon {
          font-size: 56px;
          margin-bottom: 24px;
          display: block;
        }
        
        .consultant-name {
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        
        h1 {
          color: #1e293b;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 16px;
          line-height: 1.3;
        }
        
        .lead-name {
          color: ${accentColor};
          font-weight: 600;
        }
        
        .message {
          color: #64748b;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 32px;
        }
        
        .buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          border: none;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
        }
        
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
        }
        
        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }
        
        .btn-secondary:hover {
          background: #e2e8f0;
        }
        
        .footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
          color: #94a3b8;
          font-size: 13px;
        }
        
        @media (max-width: 480px) {
          .card {
            padding: 32px 24px;
            border-radius: 20px;
          }
          
          h1 {
            font-size: 20px;
          }
          
          .message {
            font-size: 15px;
          }
          
          .icon {
            font-size: 48px;
          }
        }
      </style>
    </head>
    <body>
      <div class="card">
        ${consultantLogo ? `<img src="${consultantLogo}" alt="Logo" class="logo">` : ""}
        ${consultantName ? `<div class="consultant-name">${consultantName}</div>` : ""}
        ${icon ? `<span class="icon" style="color: ${iconColor}">${icon}</span>` : ""}
        <h1>${heading}</h1>
        ${leadName ? `<p class="message">Ciao <span class="lead-name">${leadName}</span>, ${message}</p>` : `<p class="message">${message}</p>`}
        ${showForm ? `
          <form method="POST" action="${formAction}">
            <div class="buttons">
              <button type="submit" class="btn btn-primary">${primaryButtonText}</button>
              ${showCancelButton ? `<a href="javascript:history.back()" class="btn btn-secondary">Annulla</a>` : ""}
            </div>
          </form>
        ` : ""}
        <div class="footer">
          ${consultantName ? `Non riceverai più email da ${consultantName}` : "Gestione preferenze email"}
        </div>
      </div>
    </body>
    </html>
  `;
}

router.get("/unsubscribe/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const validation = validateUnsubscribeToken(token);
    
    if (!validation.valid || !validation.leadId) {
      return res.status(400).send(generateStyledPage({
        title: "Link non valido",
        icon: "⚠️",
        iconColor: "#ef4444",
        heading: "Link non valido",
        message: "Il link di disiscrizione non è valido o è scaduto. Contatta il supporto se hai bisogno di assistenza.",
      }));
    }
    
    const [lead] = await db.select()
      .from(schema.proactiveLeads)
      .where(eq(schema.proactiveLeads.id, validation.leadId))
      .limit(1);
    
    if (!lead) {
      return res.status(404).send(generateStyledPage({
        title: "Non trovato",
        icon: "🔍",
        iconColor: "#f59e0b",
        heading: "Iscrizione non trovata",
        message: "Non abbiamo trovato la tua iscrizione nel nostro sistema.",
      }));
    }
    
    let consultant = null;
    if (validation.consultantId) {
      [consultant] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, validation.consultantId))
        .limit(1);
    }
    
    const consultantName = consultant ? `${consultant.firstName} ${consultant.lastName}` : undefined;
    const consultantLogo = (consultant?.pricingPageConfig as any)?.logoUrl || undefined;
    const accentColor = (consultant?.pricingPageConfig as any)?.accentColor || "#3b82f6";
    const leadName = lead.firstName || lead.name?.split(" ")[0] || undefined;
    
    if (lead.nurturingOptOutAt) {
      return res.send(generateStyledPage({
        title: "Già disiscritto",
        icon: "✓",
        iconColor: "#10b981",
        heading: "Sei già disiscritto",
        message: "Sei già stato rimosso dalla nostra mailing list. Non riceverai più email.",
        consultantName,
        consultantLogo,
        leadName,
        accentColor,
      }));
    }
    
    res.send(generateStyledPage({
      title: "Conferma disiscrizione",
      icon: "📧",
      iconColor: "#3b82f6",
      heading: "Sei sicuro di volerti disiscrivere?",
      message: "se confermi, non riceverai più le nostre email. Ci mancherai!",
      leadName,
      consultantName,
      consultantLogo,
      accentColor,
      showForm: true,
      formAction: `/unsubscribe/${token}`,
      primaryButtonText: "Conferma Disiscrizione",
      showCancelButton: true,
    }));
  } catch (error: any) {
    console.error("[UNSUBSCRIBE] Error:", error);
    res.status(500).send(generateStyledPage({
      title: "Errore",
      icon: "❌",
      iconColor: "#ef4444",
      heading: "Si è verificato un errore",
      message: "Riprova più tardi o contatta il supporto.",
    }));
  }
});

router.post("/unsubscribe/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const validation = validateUnsubscribeToken(token);
    
    if (!validation.valid || !validation.leadId) {
      return res.status(400).send(generateStyledPage({
        title: "Token non valido",
        icon: "⚠️",
        iconColor: "#ef4444",
        heading: "Token non valido",
        message: "Il link di disiscrizione non è valido.",
      }));
    }
    
    const [lead] = await db.select()
      .from(schema.proactiveLeads)
      .where(eq(schema.proactiveLeads.id, validation.leadId))
      .limit(1);
    
    await db.update(schema.proactiveLeads)
      .set({
        nurturingEnabled: false,
        nurturingOptOutAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.proactiveLeads.id, validation.leadId));
    
    console.log(`📧 [UNSUBSCRIBE] Lead ${validation.leadId} unsubscribed from nurturing`);
    
    let consultant = null;
    if (validation.consultantId) {
      [consultant] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, validation.consultantId))
        .limit(1);
    }
    
    const consultantName = consultant ? `${consultant.firstName} ${consultant.lastName}` : undefined;
    const consultantLogo = (consultant?.pricingPageConfig as any)?.logoUrl || undefined;
    const accentColor = (consultant?.pricingPageConfig as any)?.accentColor || "#3b82f6";
    const leadName = lead?.firstName || lead?.name?.split(" ")[0] || undefined;
    
    res.send(generateStyledPage({
      title: "Disiscrizione completata",
      icon: "✅",
      iconColor: "#10b981",
      heading: "Ti sei disiscritto con successo",
      message: consultantName 
        ? `Non riceverai più email da ${consultantName}. Puoi chiudere questa pagina.`
        : "Non riceverai più email di nurturing. Puoi chiudere questa pagina.",
      leadName,
      consultantName,
      consultantLogo,
      accentColor,
    }));
  } catch (error: any) {
    console.error("[UNSUBSCRIBE] Error:", error);
    res.status(500).send(generateStyledPage({
      title: "Errore",
      icon: "❌",
      iconColor: "#ef4444",
      heading: "Si è verificato un errore",
      message: "Riprova più tardi o contatta il supporto.",
    }));
  }
});

export default router;
