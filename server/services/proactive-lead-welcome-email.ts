import { sendEmail } from "./email-scheduler";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import { getAIProvider, GEMINI_3_MODEL, GEMINI_3_THINKING_LEVEL } from "../ai/provider-factory";

export interface ProactiveLeadWelcomeEmailParams {
  leadId: string;
  consultantId: string;
}

export interface WelcomeEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function generateHookFromObjectives(
  lead: schema.ProactiveLead,
  consultantName: string,
  consultantId: string
): Promise<string> {
  try {
    const leadInfo = lead.leadInfo as any || {};
    const campaignSnapshot = lead.campaignSnapshot as any || {};
    
    const obiettivi = leadInfo.obiettivi || campaignSnapshot.obiettivi || lead.idealState || "i tuoi obiettivi finanziari";
    const desideri = leadInfo.desideri || campaignSnapshot.desideri || "";
    const uncino = leadInfo.uncino || campaignSnapshot.uncino || "";
    
    const provider = await getAIProvider(consultantId, consultantId);
    console.log(`[WELCOME EMAIL] Using AI provider: ${provider.metadata.name} with model ${GEMINI_3_MODEL}`);

    const prompt = `Sei un copywriter esperto. Genera un breve "hook" (2-3 frasi) per un'email di benvenuto a un potenziale cliente.

CONTESTO:
- Nome lead: ${lead.firstName}
- Obiettivi dichiarati: ${obiettivi}
- Desideri: ${desideri}
- Uncino iniziale: ${uncino}
- Nome consulente: ${consultantName}

REGOLE:
- Massimo 2-3 frasi
- Tono professionale ma caldo
- Richiama gli obiettivi specifici del lead
- NON usare frasi generiche
- In italiano

Rispondi SOLO con il testo dell'hook, senza virgolette o prefissi.`;

    const result = await provider.client.generateContent({
      model: GEMINI_3_MODEL,
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: GEMINI_3_THINKING_LEVEL === "minimal" ? 0 : 
                         GEMINI_3_THINKING_LEVEL === "low" ? 1024 : 
                         GEMINI_3_THINKING_LEVEL === "medium" ? 4096 : 8192,
        },
      },
    });
    const hook = result.text?.trim() || "";
    
    return hook || `Hai fatto un ottimo passo contattandoci per parlare di ${obiettivi}. Siamo qui per aiutarti a raggiungere i tuoi obiettivi.`;
  } catch (error) {
    console.error("[WELCOME EMAIL] Error generating hook:", error);
    const leadInfo = lead.leadInfo as any || {};
    const obiettivi = leadInfo.obiettivi || lead.idealState || "i tuoi obiettivi";
    return `Hai fatto un ottimo passo contattandoci per parlare di ${obiettivi}. Siamo qui per aiutarti a raggiungere i tuoi obiettivi.`;
  }
}

function buildWelcomeEmailHtml(params: {
  leadName: string;
  consultantName: string;
  hook: string;
  whatsappNumber?: string;
  calendarLink?: string;
  signature?: string;
}): string {
  const { leadName, consultantName, hook, whatsappNumber, calendarLink, signature } = params;

  let ctaSection = "";
  if (calendarLink) {
    ctaSection = `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${calendarLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Prenota una Consulenza Gratuita
        </a>
      </div>
    `;
  } else if (whatsappNumber) {
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    ctaSection = `
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://wa.me/${cleanNumber}" style="display: inline-block; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Contattaci su WhatsApp
        </a>
      </div>
    `;
  }

  const signatureHtml = signature || consultantName;

  return `
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
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Benvenuto${leadName ? `, ${leadName}` : ''}!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                Grazie per averci contattato
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Ciao <strong>${leadName || "!"}</strong>,
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ${hook}
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Ho ricevuto la tua richiesta e sono molto contento di poterti aiutare. 
                Il mio obiettivo è fornirti un supporto personalizzato basato sulle tue esigenze specifiche.
              </p>
              
              ${ctaSection}
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                A presto,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 8px 0 0 0; font-weight: 600;">
                ${signatureHtml}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                Questa email ti è stata inviata perché hai espresso interesse nei nostri servizi.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendProactiveLeadWelcomeEmail(
  params: ProactiveLeadWelcomeEmailParams
): Promise<WelcomeEmailResult> {
  const { leadId, consultantId } = params;
  
  try {
    console.log(`[WELCOME EMAIL] Starting for lead ${leadId}`);
    
    const lead = await storage.getProactiveLead(leadId, consultantId);
    if (!lead) {
      return { success: false, error: "Lead non trovato" };
    }
    
    const leadEmail = storage.getLeadEmail(lead);
    if (!leadEmail) {
      console.log(`[WELCOME EMAIL] Lead ${leadId} has no email, skipping`);
      return { success: false, error: "Lead senza email" };
    }
    
    if (!validateEmail(leadEmail)) {
      console.log(`[WELCOME EMAIL] Invalid email format: ${leadEmail}`);
      return { success: false, error: "Formato email non valido" };
    }
    
    if (lead.welcomeEmailSent) {
      console.log(`[WELCOME EMAIL] Already sent to lead ${leadId}`);
      return { success: false, error: "Email già inviata" };
    }
    
    if (!lead.welcomeEmailEnabled) {
      console.log(`[WELCOME EMAIL] Disabled for lead ${leadId}`);
      return { success: false, error: "Email benvenuto disabilitata" };
    }
    
    const [consultant] = await db
      .select({
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(eq(schema.users.id, consultantId))
      .limit(1);

    if (!consultant) {
      return { success: false, error: "Consulente non trovato" };
    }
    
    const consultantName = `${consultant.firstName} ${consultant.lastName}`.trim();
    
    const emailVars = await storage.getEmailVariables(consultantId);
    
    const [agentConfig] = await db
      .select({
        twilioWhatsappNumber: schema.consultantWhatsappConfig.twilioWhatsappNumber,
      })
      .from(schema.consultantWhatsappConfig)
      .where(eq(schema.consultantWhatsappConfig.id, lead.agentConfigId))
      .limit(1);
    
    const whatsappNumber = emailVars?.whatsappNumber || agentConfig?.twilioWhatsappNumber;
    
    const hook = await generateHookFromObjectives(lead, consultantName, consultantId);
    
    const htmlContent = buildWelcomeEmailHtml({
      leadName: lead.firstName,
      consultantName,
      hook,
      whatsappNumber,
      calendarLink: emailVars?.calendarLink || undefined,
      signature: emailVars?.emailSignature || undefined,
    });
    
    await sendEmail({
      to: leadEmail,
      subject: `${lead.firstName}, benvenuto! Ecco come posso aiutarti`,
      html: htmlContent,
      consultantId,
    });
    
    await db.update(schema.proactiveLeads)
      .set({
        welcomeEmailSent: true,
        welcomeEmailSentAt: new Date(),
        welcomeEmailError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.proactiveLeads.id, leadId),
          eq(schema.proactiveLeads.consultantId, consultantId)
        )
      );
    
    console.log(`[WELCOME EMAIL] Sent successfully to ${leadEmail} for lead ${leadId}`);
    return { success: true };
    
  } catch (error: any) {
    console.error(`[WELCOME EMAIL] Error for lead ${leadId}:`, error);
    
    await db.update(schema.proactiveLeads)
      .set({
        welcomeEmailError: error.message || "Errore sconosciuto",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.proactiveLeads.id, leadId),
          eq(schema.proactiveLeads.consultantId, consultantId)
        )
      );
    
    return { success: false, error: error.message };
  }
}
