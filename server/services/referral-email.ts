import { db } from "../db";
import { users, referralLandingConfig, consultantSmtpSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";

interface ReferralInviteEmailParams {
  referralId: string;
  friendEmail: string;
  friendFirstName: string;
  referrerFirstName: string;
  referrerLastName: string;
  consultantId: string;
  referralCode: string;
}

interface ReferralConfirmationEmailParams {
  referralId: string;
  friendEmail: string;
  friendFirstName: string;
  consultantId: string;
}

async function getTransporter(consultantId: string) {
  const smtpSettings = await db.query.consultantSmtpSettings.findFirst({
    where: eq(consultantSmtpSettings.consultantId, consultantId),
  });

  if (!smtpSettings || !smtpSettings.smtpHost || !smtpSettings.smtpUser || !smtpSettings.smtpPassword) {
    console.log("[REFERRAL EMAIL] No SMTP settings found for consultant:", consultantId);
    return null;
  }

  return nodemailer.createTransport({
    host: smtpSettings.smtpHost,
    port: smtpSettings.smtpPort || 587,
    secure: smtpSettings.smtpPort === 465,
    auth: {
      user: smtpSettings.smtpUser,
      pass: smtpSettings.smtpPassword,
    },
  });
}

export async function sendReferralInviteEmail(params: ReferralInviteEmailParams): Promise<boolean> {
  const { friendEmail, friendFirstName, referrerFirstName, referrerLastName, consultantId, referralCode } = params;

  try {
    const consultant = await db.query.users.findFirst({
      where: eq(users.id, consultantId),
    });

    if (!consultant) {
      console.error("[REFERRAL EMAIL] Consultant not found:", consultantId);
      return false;
    }

    const landingConfig = await db.query.referralLandingConfig.findFirst({
      where: eq(referralLandingConfig.consultantId, consultantId),
    });

    const transporter = await getTransporter(consultantId);
    if (!transporter) {
      console.log("[REFERRAL EMAIL] No transporter available, skipping email");
      return false;
    }

    const baseUrl = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
    const landingUrl = `https://${baseUrl}/r/${referralCode}`;

    const bonusText = landingConfig?.bonusText || "una consulenza gratuita";
    const consultantName = `${consultant.firstName} ${consultant.lastName}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hai ricevuto un invito speciale!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
          
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">
                Ciao ${friendFirstName}!
              </h1>
              <p style="margin: 15px 0 0 0; font-size: 18px; color: rgba(255,255,255,0.9);">
                ${referrerFirstName} ${referrerLastName} ti ha pensato!
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Il tuo amico <strong>${referrerFirstName}</strong> ti ha consigliato di conoscere <strong>${consultantName}</strong>.
              </p>
              
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #92400e; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                  Il tuo bonus esclusivo
                </p>
                <p style="margin: 10px 0 0 0; font-size: 20px; font-weight: 700; color: #78350f;">
                  ${bonusText}
                </p>
              </div>
              
              <p style="margin: 25px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Clicca il pulsante qui sotto per scoprire come posso aiutarti a raggiungere i tuoi obiettivi.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${landingUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);">
                  Scopri il tuo bonus
                </a>
              </div>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                Questa email ti è stata inviata perché ${referrerFirstName} ${referrerLastName} ha pensato a te.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const smtpSettings = await db.query.consultantSmtpSettings.findFirst({
      where: eq(consultantSmtpSettings.consultantId, consultantId),
    });

    await transporter.sendMail({
      from: smtpSettings?.fromEmail || `"${consultantName}" <noreply@example.com>`,
      to: friendEmail,
      subject: `${referrerFirstName} ti ha consigliato ${consultantName}!`,
      html: htmlContent,
    });

    console.log("[REFERRAL EMAIL] Invite email sent successfully to:", friendEmail);
    return true;
  } catch (error) {
    console.error("[REFERRAL EMAIL] Failed to send invite email:", error);
    return false;
  }
}

export async function sendReferralConfirmationEmail(params: ReferralConfirmationEmailParams): Promise<boolean> {
  const { friendEmail, friendFirstName, consultantId } = params;

  try {
    const consultant = await db.query.users.findFirst({
      where: eq(users.id, consultantId),
    });

    if (!consultant) {
      console.error("[REFERRAL EMAIL] Consultant not found:", consultantId);
      return false;
    }

    const transporter = await getTransporter(consultantId);
    if (!transporter) {
      console.log("[REFERRAL EMAIL] No transporter available, skipping confirmation email");
      return false;
    }

    const consultantName = `${consultant.firstName} ${consultant.lastName}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Richiesta ricevuta!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
          
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 15px;">✓</div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">
                Richiesta ricevuta!
              </h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Ciao <strong>${friendFirstName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Grazie per aver compilato il modulo! La tua richiesta è stata presa in carico.
              </p>
              
              <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 16px; color: #166534;">
                  <strong>${consultantName}</strong> ti contatterà presto per organizzare la tua consulenza.
                </p>
              </div>
              
              <p style="margin: 25px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">
                A presto!
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                Questa email conferma la ricezione della tua richiesta.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const smtpSettings = await db.query.consultantSmtpSettings.findFirst({
      where: eq(consultantSmtpSettings.consultantId, consultantId),
    });

    await transporter.sendMail({
      from: smtpSettings?.fromEmail || `"${consultantName}" <noreply@example.com>`,
      to: friendEmail,
      subject: `Richiesta ricevuta - ${consultantName}`,
      html: htmlContent,
    });

    console.log("[REFERRAL EMAIL] Confirmation email sent successfully to:", friendEmail);
    return true;
  } catch (error) {
    console.error("[REFERRAL EMAIL] Failed to send confirmation email:", error);
    return false;
  }
}