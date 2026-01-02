import { sendEmail } from "./email-scheduler";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";

export interface WelcomeEmailParams {
  consultantId: string;
  recipientEmail: string;
  recipientName: string;
  password: string;
  tier: "bronze" | "silver";
  loginUrl?: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { consultantId, recipientEmail, recipientName, password, tier, loginUrl } = params;

    const [consultant] = await db
      .select({
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        companyName: schema.users.companyName,
        pricingPageSlug: schema.users.pricingPageSlug,
      })
      .from(schema.users)
      .where(eq(schema.users.id, consultantId))
      .limit(1);

    if (!consultant) {
      console.error(`[WELCOME EMAIL] Consultant not found: ${consultantId}`);
      return { success: false, error: "Consulente non trovato" };
    }

    const consultantName = consultant.companyName || `${consultant.firstName} ${consultant.lastName}`.trim() || "Il tuo consulente";
    
    const tierLabels = {
      bronze: { name: "Bronze", color: "#CD7F32", description: "Piano Gratuito" },
      silver: { name: "Silver", color: "#C0C0C0", description: "Piano Abbonamento" },
    };

    const tierInfo = tierLabels[tier];
    // Get base URL from REPLIT_DOMAINS (already includes domain, no protocol)
    const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const baseUrl = replitDomain 
      ? (replitDomain.startsWith("http") ? replitDomain : `https://${replitDomain}`)
      : "https://app.example.com";
    const finalLoginUrl = loginUrl || `${baseUrl}/login`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Benvenuto!</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Benvenuto! 🎉</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                Il tuo account ${tierInfo.name} è stato creato
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Ciao <strong>${recipientName || "Cliente"}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Il tuo account <span style="color: ${tierInfo.color}; font-weight: 600;">${tierInfo.name}</span> 
                con <strong>${consultantName}</strong> è stato creato con successo!
              </p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px;">Le tue credenziali di accesso</h3>
                <table cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Email:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${recipientEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Password:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; font-family: monospace; background-color: #fef3c7; padding: 4px 8px; border-radius: 4px;">${password}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${finalLoginUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Accedi Ora
                </a>
              </div>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                  <strong>⚠️ Importante:</strong> Ti consigliamo di cambiare la password al primo accesso per maggiore sicurezza.
                </p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                Se hai domande, non esitare a contattare il tuo consulente.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                Questa email è stata inviata da ${consultantName}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await sendEmail({
      to: recipientEmail,
      subject: `Benvenuto! Le tue credenziali per ${tierInfo.name}`,
      html: htmlContent,
      consultantId,
    });

    console.log(`[WELCOME EMAIL] Sent successfully to ${recipientEmail} (${tier})`);
    return { success: true };
  } catch (error: any) {
    console.error(`[WELCOME EMAIL] Error:`, error);
    return { success: false, error: error.message };
  }
}
