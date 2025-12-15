import { db } from "../db";
import { adminTurnConfig, consultantTurnConfig, users, humanSellers } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt, encryptForConsultant, decryptForConsultant, generateEncryptionSalt } from "../encryption";

export interface TurnCredentials {
  provider: "metered" | "twilio" | "custom";
  username: string;
  password: string;
  apiKey?: string;
  turnUrls?: string[];
  source: "consultant" | "admin";
}

export interface AdminTurnConfigInput {
  provider: "metered" | "twilio" | "custom";
  username: string;
  password: string;
  apiKey?: string;
  turnUrls?: string[];
  enabled?: boolean;
}

export async function getTurnCredentials(consultantId: string): Promise<TurnCredentials | null> {
  const consultantConfig = await db
    .select()
    .from(consultantTurnConfig)
    .where(
      and(
        eq(consultantTurnConfig.consultantId, consultantId),
        eq(consultantTurnConfig.enabled, true)
      )
    )
    .limit(1);

  if (consultantConfig.length > 0 && consultantConfig[0].usernameEncrypted && consultantConfig[0].passwordEncrypted) {
    const [consultant] = await db
      .select({ encryptionSalt: users.encryptionSalt })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    if (consultant?.encryptionSalt) {
      try {
        const username = decryptForConsultant(consultantConfig[0].usernameEncrypted, consultant.encryptionSalt);
        const password = decryptForConsultant(consultantConfig[0].passwordEncrypted, consultant.encryptionSalt);
        
        let apiKey: string | undefined;
        if (consultantConfig[0].apiKeyEncrypted) {
          apiKey = decryptForConsultant(consultantConfig[0].apiKeyEncrypted, consultant.encryptionSalt);
        }

        console.log(`✅ [TURN] Using consultant-specific TURN config for ${consultantId}`);
        return {
          provider: consultantConfig[0].provider,
          username,
          password,
          apiKey,
          turnUrls: consultantConfig[0].turnUrls || undefined,
          source: "consultant"
        };
      } catch (decryptError) {
        console.error(`❌ [TURN] Failed to decrypt consultant config:`, decryptError);
      }
    }
  }

  return getAdminTurnCredentials();
}

export async function getAdminTurnCredentials(): Promise<TurnCredentials | null> {
  const [config] = await db
    .select()
    .from(adminTurnConfig)
    .where(eq(adminTurnConfig.enabled, true))
    .limit(1);

  if (!config || !config.usernameEncrypted || !config.passwordEncrypted) {
    console.log(`❌ [TURN] No admin TURN config found`);
    return null;
  }

  try {
    const username = decrypt(config.usernameEncrypted);
    const password = decrypt(config.passwordEncrypted);
    
    let apiKey: string | undefined;
    if (config.apiKeyEncrypted) {
      apiKey = decrypt(config.apiKeyEncrypted);
    }

    console.log(`✅ [TURN] Using admin TURN config (fallback)`);
    return {
      provider: config.provider,
      username,
      password,
      apiKey,
      turnUrls: config.turnUrls || undefined,
      source: "admin"
    };
  } catch (decryptError) {
    console.error(`❌ [TURN] Failed to decrypt admin config:`, decryptError);
    return null;
  }
}

export async function getAdminTurnConfig(): Promise<{
  configured: boolean;
  config: {
    id: string;
    provider: string;
    username: string;
    password: string;
    apiKey?: string;
    turnUrls?: string[];
    enabled: boolean;
    createdAt: Date | null;
    updatedAt: Date | null;
  } | null;
}> {
  const [config] = await db
    .select()
    .from(adminTurnConfig)
    .limit(1);

  if (!config) {
    return {
      configured: false,
      config: null
    };
  }

  let username = "";
  let password = "";
  let apiKey: string | undefined;

  if (config.usernameEncrypted && config.passwordEncrypted) {
    try {
      username = decrypt(config.usernameEncrypted);
      password = decrypt(config.passwordEncrypted);
      
      if (config.apiKeyEncrypted) {
        apiKey = decrypt(config.apiKeyEncrypted);
      }
    } catch (decryptError) {
      console.error("❌ Error decrypting admin TURN config:", decryptError);
    }
  }

  return {
    configured: true,
    config: {
      id: config.id,
      provider: config.provider,
      username,
      password,
      apiKey,
      turnUrls: config.turnUrls || undefined,
      enabled: config.enabled,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }
  };
}

export async function saveAdminTurnConfig(input: AdminTurnConfigInput): Promise<{
  success: boolean;
  config?: {
    id: string;
    provider: string;
    enabled: boolean;
  };
  error?: string;
}> {
  try {
    const usernameEncrypted = encrypt(input.username);
    const passwordEncrypted = encrypt(input.password);
    
    let apiKeyEncrypted: string | undefined;
    if (input.apiKey) {
      apiKeyEncrypted = encrypt(input.apiKey);
    }

    const [existingConfig] = await db
      .select({ id: adminTurnConfig.id })
      .from(adminTurnConfig)
      .limit(1);

    let result;
    
    if (existingConfig) {
      [result] = await db
        .update(adminTurnConfig)
        .set({
          provider: input.provider,
          usernameEncrypted,
          passwordEncrypted,
          apiKeyEncrypted: apiKeyEncrypted || null,
          turnUrls: input.turnUrls || null,
          enabled: input.enabled ?? true,
          updatedAt: new Date()
        })
        .where(eq(adminTurnConfig.id, existingConfig.id))
        .returning();

      console.log(`✅ [TURN] Updated admin TURN config`);
    } else {
      [result] = await db
        .insert(adminTurnConfig)
        .values({
          provider: input.provider,
          usernameEncrypted,
          passwordEncrypted,
          apiKeyEncrypted: apiKeyEncrypted || null,
          turnUrls: input.turnUrls || null,
          enabled: input.enabled ?? true
        })
        .returning();

      console.log(`✅ [TURN] Created admin TURN config`);
    }

    return {
      success: true,
      config: {
        id: result.id,
        provider: result.provider,
        enabled: result.enabled
      }
    };
  } catch (error: any) {
    console.error("❌ Error saving admin TURN config:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getTurnCredentialsForMeeting(
  sellerId: string | null
): Promise<TurnCredentials | null> {
  if (!sellerId) {
    return getAdminTurnCredentials();
  }

  const [seller] = await db
    .select({
      clientId: humanSellers.clientId
    })
    .from(humanSellers)
    .where(eq(humanSellers.id, sellerId))
    .limit(1);

  if (!seller?.clientId) {
    return getAdminTurnCredentials();
  }

  const [owner] = await db
    .select({
      role: users.role,
      consultantId: users.consultantId
    })
    .from(users)
    .where(eq(users.id, seller.clientId))
    .limit(1);

  let turnConfigOwnerId = seller.clientId;

  if (owner?.role === "client" && owner.consultantId) {
    console.log(`🔗 [TURN] Owner ${seller.clientId} is a client, looking for consultant ${owner.consultantId}'s TURN config`);
    turnConfigOwnerId = owner.consultantId;
  }

  const credentials = await getTurnCredentials(turnConfigOwnerId);
  
  if (credentials) {
    return credentials;
  }

  console.log(`⚠️ [TURN] No config found for ${turnConfigOwnerId}, falling back to admin config`);
  return getAdminTurnCredentials();
}
