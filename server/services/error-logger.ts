import { db } from "../db";
import { systemErrors } from "../../shared/schema";

/**
 * Log critical system errors to database for visibility in UI
 */
export async function logSystemError(params: {
  consultantId: string;
  agentConfigId?: string | null;
  errorType: "template_not_approved" | "twilio_auth_failed" | "duplicate_lead" | "message_send_failed" | "invalid_credentials" | "configuration_error";
  errorMessage: string;
  errorDetails?: Record<string, any>;
}): Promise<void> {
  try {
    await db.insert(systemErrors).values({
      consultantId: params.consultantId,
      agentConfigId: params.agentConfigId || null,
      errorType: params.errorType,
      errorMessage: params.errorMessage,
      errorDetails: params.errorDetails || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`📝 [ERROR LOGGED] ${params.errorType}: ${params.errorMessage}`);
  } catch (error: any) {
    // Don't throw - logging errors shouldn't break the main flow
    console.error(`⚠️  [ERROR LOGGER] Failed to log error to database:`, error.message);
  }
}

/**
 * Get unresolved errors for a consultant (for UI display)
 */
export async function getUnresolvedErrorsCount(consultantId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: systemErrors.id })
      .from(systemErrors)
      .where((table) => table.consultantId === consultantId && table.resolvedAt === null);
    
    return result.length;
  } catch (error) {
    console.error(`⚠️  [ERROR LOGGER] Failed to count errors:`, error);
    return 0;
  }
}
