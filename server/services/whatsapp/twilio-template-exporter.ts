import { db } from "../../db";
import {
  whatsappCustomTemplates,
  whatsappTemplateVersions,
  whatsappTemplateVariables,
  whatsappVariableCatalog,
  consultantWhatsappConfig,
} from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import twilio from "twilio";
import { convertToTwilioFormat } from "./variable-converter";

export interface ExportResult {
  success: boolean;
  twilioContentSid: string;
  friendlyName: string;
  message: string;
}

/**
 * Sanitize template name for use as Twilio friendlyName
 * - Converts to lowercase
 * - Replaces spaces and special chars with underscores
 * - Collapses sequential underscores into one
 * - Removes leading/trailing underscores
 * - Limits to 50 characters
 * - Falls back to 'template' if result is empty
 */
function sanitizeTemplateName(templateName: string): string {
  const sanitized = templateName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')  // Replace special chars with underscore
    .replace(/_+/g, '_')            // Collapse multiple underscores into one
    .replace(/^_+|_+$/g, '')        // Remove leading/trailing underscores
    .substring(0, 50);              // Limit to 50 characters
  
  // Fallback to 'template' if empty after sanitization
  return sanitized || 'template';
}

/**
 * Export a custom template to Twilio Content API
 * Converts variables from {nome_lead} format to {{1}} format
 * 
 * @param templateId - ID of the custom template
 * @param consultantId - ID of the consultant (for authorization)
 * @param agentConfigId - Optional specific agent config ID to use for export
 * @returns ExportResult with SID and status
 */
export async function exportTemplateToTwilio(
  templateId: string,
  consultantId: string,
  agentConfigId?: string
): Promise<ExportResult> {
  // 1. Fetch template and verify ownership
  const templates = await db
    .select()
    .from(whatsappCustomTemplates)
    .where(
      and(
        eq(whatsappCustomTemplates.id, templateId),
        eq(whatsappCustomTemplates.consultantId, consultantId)
      )
    )
    .limit(1);

  const template = templates[0];
  if (!template) {
    throw new Error("Template non trovato o non appartiene al tuo account");
  }

  // 2. Fetch active version
  const activeVersions = await db
    .select()
    .from(whatsappTemplateVersions)
    .where(
      and(
        eq(whatsappTemplateVersions.templateId, templateId),
        eq(whatsappTemplateVersions.isActive, true)
      )
    )
    .limit(1);

  const activeVersion = activeVersions[0];
  if (!activeVersion) {
    throw new Error("Nessuna versione attiva trovata per questo template");
  }

  // 3. Fetch variables for this version, ordered by position
  const variables = await db
    .select({
      id: whatsappTemplateVariables.id,
      position: whatsappTemplateVariables.position,
      variableKey: whatsappVariableCatalog.variableKey,
      variableName: whatsappVariableCatalog.variableName,
    })
    .from(whatsappTemplateVariables)
    .innerJoin(
      whatsappVariableCatalog,
      eq(whatsappTemplateVariables.variableCatalogId, whatsappVariableCatalog.id)
    )
    .where(eq(whatsappTemplateVariables.templateVersionId, activeVersion.id))
    .orderBy(whatsappTemplateVariables.position);

  // 4. Convert bodyText from {nome_lead} to {{1}} format
  const variableMappings = variables.map((v) => ({
    variableKey: v.variableKey,
    position: v.position,
  }));

  const { convertedBody } = convertToTwilioFormat(
    activeVersion.bodyText,
    variableMappings
  );

  // 5. Create Twilio variables object: { "1": "Nome Lead", "2": "Nome Consulente" }
  const twilioVariables: Record<string, string> = {};
  variables.forEach((v) => {
    twilioVariables[v.position.toString()] = v.variableName;
  });

  // 6. Fetch consultant's Twilio credentials
  let agentConfig;
  
  if (agentConfigId) {
    // Specific agent requested: fetch and verify ownership
    const configs = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.id, agentConfigId),
          eq(consultantWhatsappConfig.consultantId, consultantId),
          eq(consultantWhatsappConfig.isActive, true)
        )
      )
      .limit(1);

    agentConfig = configs[0];
    if (!agentConfig) {
      throw new Error(
        "Agente WhatsApp non trovato o non appartiene al tuo account"
      );
    }
  } else {
    // No specific agent: use first active config (backward compatible)
    const configs = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.consultantId, consultantId),
          eq(consultantWhatsappConfig.isActive, true)
        )
      )
      .limit(1);

    agentConfig = configs[0];
    if (!agentConfig) {
      throw new Error(
        "Configura prima le credenziali Twilio nella sezione Agenti WhatsApp"
      );
    }
  }

  if (!agentConfig.twilioAccountSid || !agentConfig.twilioAuthToken) {
    throw new Error(
      "Credenziali Twilio incomplete. Verifica la configurazione dell'agente WhatsApp"
    );
  }

  // 7. Call Twilio Content API
  const twilioClient = twilio(
    agentConfig.twilioAccountSid,
    agentConfig.twilioAuthToken
  );

  const sanitizedName = sanitizeTemplateName(template.templateName);
  const friendlyName = `${sanitizedName}_v${activeVersion.versionNumber}`;

  try {
    console.log(`📤 [TWILIO EXPORT] Creating content template`);
    console.log(`   Template Name: "${template.templateName}" → Sanitized: "${sanitizedName}"`);
    console.log(`   Friendly Name: ${friendlyName}`);
    console.log(`   Template ID: ${templateId}`);
    console.log(`   Version: ${activeVersion.versionNumber}`);
    console.log(`   Variables: ${variables.length}`);

    const content = await twilioClient.content.v1.contents.create({
      friendlyName,
      language: "it",
      variables: twilioVariables,
      types: {
        "twilio/text": {
          body: convertedBody,
        },
      },
    });

    console.log(`✅ [TWILIO EXPORT] Content created successfully: ${content.sid}`);

    // 8. Submit template for WhatsApp approval
    let approvalStatus = "pending_approval";
    try {
      console.log(`📤 [TWILIO EXPORT] Submitting template for WhatsApp approval...`);
      
      // Use approvalCreate.create() - SDK v1 method for WhatsApp approval
      const approval = await twilioClient.content.v1
        .contents(content.sid)
        .approvalCreate
        .create({
          name: friendlyName, // Use full friendlyName including version suffix to avoid collisions
          category: "UTILITY",
        });

      console.log(`✅ [TWILIO EXPORT] Approval request submitted!`);
      console.log(`   Approval Status: ${approval.status || 'pending'}`);
      console.log(`   Template Name: ${approval.name}`);
      
      // Map Twilio approval status to our status (SDK returns status directly)
      const twilioStatus = approval.status?.toLowerCase();
      if (twilioStatus === 'approved') {
        approvalStatus = 'approved';
      } else if (twilioStatus === 'rejected') {
        approvalStatus = 'rejected';
      } else {
        approvalStatus = 'pending_approval';
      }
    } catch (approvalError: any) {
      console.error(`⚠️ [TWILIO EXPORT] Approval submission failed:`, approvalError.message);
      console.log(`   Template created but not submitted for approval. You can sync later.`);
      approvalStatus = "draft";
    }

    // 9. Save twilioContentSid and update status in DB
    await db
      .update(whatsappTemplateVersions)
      .set({
        twilioContentSid: content.sid,
        twilioStatus: approvalStatus,
        lastSyncedAt: new Date(),
      })
      .where(eq(whatsappTemplateVersions.id, activeVersion.id));

    console.log(`💾 [TWILIO EXPORT] Database updated with SID: ${content.sid}, Status: ${approvalStatus}`);

    // 10. Return success
    const statusMessage = approvalStatus === 'pending_approval' 
      ? "Template inviato per approvazione! Meta impiegherà 1-48 ore."
      : approvalStatus === 'approved'
      ? "Template approvato immediatamente!"
      : approvalStatus === 'draft'
      ? "Template creato su Twilio ma non inviato per approvazione. Sincronizza per riprovare."
      : "Template in elaborazione.";

    return {
      success: true,
      twilioContentSid: content.sid,
      friendlyName,
      message: `${statusMessage} SID: ${content.sid}`,
    };
  } catch (error: any) {
    console.error(`❌ [TWILIO EXPORT] Error creating content:`, error);

    // Handle specific Twilio errors
    if (error.code === 20404) {
      throw new Error(
        "Account Twilio non trovato. Verifica le credenziali dell'agente WhatsApp"
      );
    }

    if (error.code === 20003) {
      throw new Error(
        "Credenziali Twilio non valide. Verifica la configurazione dell'agente WhatsApp"
      );
    }

    if (error.message?.includes("already exists") || error.code === 54301) {
      throw new Error(
        `Un template con nome "${friendlyName}" esiste già in Twilio. Prova a creare una nuova versione.`
      );
    }

    // Generic error
    throw new Error(
      `Errore durante l'export a Twilio: ${error.message || "Errore sconosciuto"}`
    );
  }
}
