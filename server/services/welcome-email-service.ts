import { sendEmail } from "./email-scheduler";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";

export interface WelcomeEmailParams {
  consultantId: string;
  recipientEmail: string;
  recipientName: string;
  password?: string; // Optional - if not provided, user set their own password
  tier: "bronze" | "silver" | "gold";
  loginUrl?: string;
  dailyMessageLimit?: number; // For Bronze tier
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { consultantId, recipientEmail, recipientName, password, tier, loginUrl, dailyMessageLimit } = params;

    const [consultant] = await db
      .select({
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        pricingPageSlug: schema.users.pricingPageSlug,
        pricingPageConfig: schema.users.pricingPageConfig,
      })
      .from(schema.users)
      .where(eq(schema.users.id, consultantId))
      .limit(1);

    if (!consultant) {
      console.error(`[WELCOME EMAIL] Consultant not found: ${consultantId}`);
      return { success: false, error: "Consulente non trovato" };
    }

    const consultantName = `${consultant.firstName} ${consultant.lastName}`.trim() || "Il tuo consulente";
    
    // Get tier names and features from consultant's pricing config
    const config = consultant.pricingPageConfig || {};
    const tierNames = {
      bronze: config.level1Name || "Bronze",
      silver: config.level2Name || "Argento",
      gold: config.level3Name || "Oro",
    };
    
    const tierFeatures = {
      bronze: config.level1Features || [
        "Accesso all'Assistente AI",
        "Messaggi limitati al giorno",
        "Risposte personalizzate",
        "Supporto via chat"
      ],
      silver: config.level2Features || [
        "Messaggi illimitati",
        "Accesso alla Knowledge Base completa",
        "Risposte più accurate e contestualizzate",
        "Storico conversazioni salvato",
        "Supporto prioritario"
      ],
      gold: config.level3Features || [
        "Accesso completo al software",
        "Dashboard personale con statistiche",
        "AI Assistant con funzionalità avanzate",
        "Gestione esercizi e percorsi formativi",
        "Supporto dedicato premium"
      ],
    };
    
    const tierLabels = {
      bronze: { name: tierNames.bronze, color: "#CD7F32", gradient: "linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)" },
      silver: { name: tierNames.silver, color: "#A0AEC0", gradient: "linear-gradient(135deg, #718096 0%, #A0AEC0 100%)" },
      gold: { name: tierNames.gold, color: "#D69E2E", gradient: "linear-gradient(135deg, #D69E2E 0%, #F6E05E 100%)" },
    };

    const tierInfo = tierLabels[tier];
    const features = tierFeatures[tier];
    
    // Get base URL from REPLIT_DOMAINS (already includes domain, no protocol)
    const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const baseUrl = replitDomain 
      ? (replitDomain.startsWith("http") ? replitDomain : `https://${replitDomain}`)
      : "https://app.example.com";
    const finalLoginUrl = loginUrl || `${baseUrl}/login`;

    // Build credentials section based on whether password is provided
    const credentialsSection = password ? `
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
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>⚠️ Importante:</strong> Ti consigliamo di cambiare la password al primo accesso per maggiore sicurezza.
        </p>
      </div>
    ` : `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px;">Il tuo account</h3>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Email:</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${recipientEmail}</td>
          </tr>
        </table>
        <p style="color: #64748b; font-size: 14px; margin: 12px 0 0 0;">
          Usa la password che hai scelto durante la registrazione.
        </p>
      </div>
    `;

    // Build tier-specific features section using consultant's config
    const tierStyles = {
      bronze: { bg: "#f0fdf4", border: "#86efac", textColor: "#166534", icon: "✨" },
      silver: { bg: "#f8fafc", border: "#cbd5e1", textColor: "#475569", icon: "⭐" },
      gold: { bg: "#fffbeb", border: "#fcd34d", textColor: "#92400e", icon: "👑" },
    };
    const style = tierStyles[tier];
    const limit = dailyMessageLimit || config.level1DailyMessageLimit || 15;
    
    const featuresListHtml = features.map(f => `<li>${f}</li>`).join("\n            ");
    
    let featuresSection = `
      <div style="background-color: ${style.bg}; border: 1px solid ${style.border}; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="color: ${style.textColor}; margin: 0 0 12px 0; font-size: 16px;">${style.icon} Il tuo Piano ${tierInfo.name} include:</h3>
        <ul style="color: ${style.textColor}; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            ${featuresListHtml}
        </ul>
        ${tier === "bronze" ? `
        <p style="color: ${style.textColor}; margin: 16px 0 0 0; font-size: 13px; font-style: italic;">
          Hai ${limit} messaggi al giorno. Vuoi messaggi illimitati? Passa a ${tierNames.silver} o ${tierNames.gold}!
        </p>` : ""}
      </div>
    `;

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
            <td style="background: ${tierInfo.gradient}; padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Benvenuto! 🎉</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                Il tuo account <strong>${tierInfo.name}</strong> è stato creato
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
                con <strong>${consultantName}</strong> è stato attivato con successo!
              </p>
              
              ${credentialsSection}
              
              ${featuresSection}
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${finalLoginUrl}" style="display: inline-block; background: ${tierInfo.gradient}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Accedi Ora
                </a>
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
      subject: `Benvenuto! Il tuo account ${tierInfo.name} è attivo`,
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
