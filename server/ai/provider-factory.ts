/**
 * AI Provider Factory
 * Implements 3-tier priority system for AI provider selection:
 * 1. Client Vertex AI (self-managed)
 * 2. Admin Vertex AI (consultant-managed)
 * 3. Google AI Studio (fallback)
 */

import { GoogleGenAI } from "@google/genai";
import { VertexAI, GenerativeModel } from "@google-cloud/vertexai";
import { db } from "../db";
import { vertexAiSettings, vertexAiClientAccess, users, superadminVertexConfig, consultantVertexAccess } from "../../shared/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { AiProviderMetadata } from "./retry-manager";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * AI provider source (tier)
 */
export type AiProviderSource = "superadmin" | "client" | "admin" | "google";

/**
 * Gemini client interface wrapping AI operations
 */
export interface GeminiClient {
  generateContent(params: {
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig?: any;
  }): Promise<{ response: { text: () => string } }>;

  generateContentStream(params: {
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig?: any;
  }): Promise<AsyncIterable<{ text?: string }>>;
}

/**
 * Adapter class that wraps VertexAI GenerativeModel and implements GeminiClient interface
 * Translates the VertexAI API to match the expected interface
 */
class VertexAIClientAdapter implements GeminiClient {
  private currentModelName: string;
  public vertexAI?: VertexAI;

  constructor(private model: GenerativeModel, modelName: string = 'gemini-2.5-flash') {
    this.currentModelName = modelName;
  }

  async generateContent(params: {
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig?: any;
  }): Promise<{ response: { text: () => string } }> {
    // Extract systemInstruction from generationConfig if present
    const { systemInstruction, ...restConfig } = params.generationConfig || {};

    // If a different model is requested and we have access to vertexAI, create new model instance
    let modelToUse = this.model;
    if (params.model && params.model !== this.currentModelName && this.vertexAI) {
      console.log(`🔄 Switching model from ${this.currentModelName} to ${params.model}`);
      modelToUse = this.vertexAI.preview.getGenerativeModel({ model: params.model });
      this.currentModelName = params.model;
      this.model = modelToUse;
    }

    const result = await modelToUse.generateContent({
      contents: params.contents,
      generationConfig: restConfig,
      systemInstruction: systemInstruction,
    });

    return {
      response: {
        text: () => {
          // Try multiple fallback strategies for Vertex AI responses

          // 1. Native text() method (some Vertex AI responses have this)
          if (typeof result.response?.text === 'function') {
            return result.response.text();
          }

          // 2. Direct text string
          if (typeof result.response?.text === 'string') {
            return result.response.text;
          }

          // 3. Candidates path (typical Vertex AI structure)
          if (result.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.response.candidates[0].content.parts[0].text;
          }

          // 4. Direct text on result
          if (result.text) {
            return result.text;
          }

          // 5. Try iterating through all parts (some responses have text in different parts)
          const candidate = result.response?.candidates?.[0];
          if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.text) {
                return part.text;
              }
            }
          }

          // 6. Check for functionCall response (model may have returned a function call instead of text)
          if (candidate?.content?.parts?.[0]?.functionCall) {
            console.log(`⚠️ [VertexAI Adapter] Response contains function call, not text`);
            return JSON.stringify(candidate.content.parts[0].functionCall);
          }

          // 7. Check if response was truncated due to MAX_TOKENS
          if (candidate?.finishReason === 'MAX_TOKENS') {
            console.warn(`⚠️ [VertexAI Adapter] Response truncated due to MAX_TOKENS. Increase maxOutputTokens.`);
            // Return empty string instead of throwing - will be handled upstream
            return '';
          }

          // All strategies failed - log detailed structure and throw
          console.error(`❌ [VertexAI Adapter] Failed to extract text. Response structure:`, JSON.stringify({
            hasResponse: !!result.response,
            responseType: typeof result.response,
            hasText: !!result.response?.text,
            textType: typeof result.response?.text,
            hasCandidates: !!result.response?.candidates,
            candidatesLength: result.response?.candidates?.length,
            candidateContent: candidate?.content,
            candidateParts: candidate?.content?.parts,
            finishReason: candidate?.finishReason,
          }, null, 2));

          throw new Error("Failed to extract text from Vertex AI response");
        }
      }
    };
  }

  async generateContentStream(params: {
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig?: any;
  }): Promise<AsyncIterable<{ text?: string }>> {
    // Extract systemInstruction from generationConfig if present
    const { systemInstruction, ...restConfig } = params.generationConfig || {};

    // If a different model is requested and we have access to vertexAI, create new model instance
    let modelToUse = this.model;
    if (params.model && params.model !== this.currentModelName && this.vertexAI) {
      console.log(`🔄 Switching model from ${this.currentModelName} to ${params.model}`);
      modelToUse = this.vertexAI.preview.getGenerativeModel({ model: params.model });
      this.currentModelName = params.model;
      this.model = modelToUse;
    }

    const streamResult = await modelToUse.generateContentStream({
      contents: params.contents,
      generationConfig: restConfig,
      systemInstruction: systemInstruction,
    });

    return {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of streamResult.stream) {
          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
          yield { text };
        }
      }
    };
  }
}

/**
 * Adapter class that wraps GoogleGenAI and implements GeminiClient interface
 * Translates the GoogleGenAI API to match the expected interface
 */
class GeminiClientAdapter implements GeminiClient {
  constructor(private ai: GoogleGenAI) { }

  async generateContent(params: {
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig?: any;
  }): Promise<{ response: { text: () => string } }> {
    // NEW API: Call ai.models.generateContent directly (no getGenerativeModel)
    const result = await this.ai.models.generateContent({
      model: params.model,
      contents: params.contents,
      config: params.generationConfig,
    });

    // Normalize response format
    return {
      response: {
        text: () => {
          // Try multiple extraction paths
          if (typeof result.response?.text === 'function') {
            return result.response.text();
          }
          if (typeof result.response?.text === 'string') {
            return result.response.text;
          }
          if (result.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.response.candidates[0].content.parts[0].text;
          }
          if (result.text) {
            return result.text;
          }
          throw new Error("Failed to extract text from response");
        }
      }
    };
  }

  async generateContentStream(params: {
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig?: any;
  }): Promise<AsyncIterable<{ text?: string }>> {
    // NEW API: generateContentStream returns AsyncGenerator directly
    const streamGenerator = await this.ai.models.generateContentStream({
      model: params.model,
      contents: params.contents,
      config: params.generationConfig,
    });

    // Normalize streaming response: yield {text: chunk} objects
    return {
      async *[Symbol.asyncIterator]() {
        // Iterate directly on the AsyncGenerator
        for await (const chunk of streamGenerator) {
          // Extract text from chunk and normalize to {text?: string} format
          let text: string | undefined;

          if (typeof chunk.text === 'function') {
            text = chunk.text();
          } else if (typeof chunk.text === 'string') {
            text = chunk.text;
          } else if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
            text = chunk.candidates[0].content.parts[0].text;
          }

          yield { text };
        }
      }
    };
  }
}

/**
 * AI provider result returned by factory
 */
export interface AiProviderResult {
  client: GeminiClient;
  vertexClient?: VertexAI;  // Original VertexAI client for TTS
  metadata: AiProviderMetadata;
  source: AiProviderSource;
  cleanup?: () => Promise<void>;
}

/**
 * Service account credentials structure
 */
interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * Cached credentials entry
 */
interface CachedCredentials {
  credentials: ServiceAccountCredentials;
  activatedAt: Date;
  settingsId: string;
}

/**
 * In-memory cache for decrypted credentials
 * Keyed by vertex_ai_settings.id
 */
const credentialsCache = new Map<string, CachedCredentials>();

/**
 * Shared helper to parse Service Account JSON with backward compatibility
 * Tries plaintext JSON first, then falls back to legacy encrypted format
 * @param serviceAccountJson - JSON string (plaintext or encrypted)
 * @returns Parsed credentials object or null if both parsing methods fail
 */
export async function parseServiceAccountJson(serviceAccountJson: string): Promise<ServiceAccountCredentials | null> {
  try {
    // Try plaintext JSON first
    try {
      const credentials = JSON.parse(serviceAccountJson) as ServiceAccountCredentials;
      console.log("✅ Parsed credentials as plaintext JSON");

      // Fix newlines if needed
      if (credentials.private_key && typeof credentials.private_key === 'string') {
        const hasLiteralNewlines = credentials.private_key.includes('\\n');
        if (hasLiteralNewlines) {
          credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
          console.log("🔍 Converted literal \\n to real newlines");
        }
      }

      return credentials;
    } catch (parseError) {
      // Fallback: Try legacy encrypted format
      console.log("⚠️  Failed plaintext parse, trying legacy decryption...");
      try {
        const { decryptJSON } = await import("../encryption");
        const credentials = decryptJSON(serviceAccountJson);
        console.log("✅ Decrypted legacy encrypted credentials");
        console.log("⚠️  WARNING: Re-upload credentials to save in plaintext format");

        // Fix newlines if needed
        if (credentials.private_key && typeof credentials.private_key === 'string') {
          const hasLiteralNewlines = credentials.private_key.includes('\\n');
          if (hasLiteralNewlines) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
          }
        }

        return credentials;
      } catch (decryptError) {
        console.error("❌ Failed both plaintext and decryption");
        throw parseError; // Re-throw original error
      }
    }
  } catch (error: any) {
    console.error("❌ Failed to parse service account JSON:", error.message);
    return null;
  }
}

/**
 * Get or parse service account credentials with caching
 */
async function getParsedCredentials(
  settingsId: string,
  serviceAccountJson: string,
  activatedAt: Date
): Promise<ServiceAccountCredentials | null> {
  // Check cache first
  const cached = credentialsCache.get(settingsId);
  if (cached && cached.activatedAt.getTime() === activatedAt.getTime()) {
    console.log(`✅ Using cached credentials for settings ${settingsId}`);
    return cached.credentials;
  }

  // Use shared helper to parse with backward compatibility
  const credentials = await parseServiceAccountJson(serviceAccountJson);

  if (!credentials) {
    console.error(`❌ Failed to parse credentials for settings ${settingsId}`);
    return null;
  }

  // Validate credentials structure
  if (!credentials.private_key || !credentials.client_email) {
    console.error(`❌ Invalid service account credentials structure for settings ${settingsId}`);
    return null;
  }

  // Cache the parsed credentials
  credentialsCache.set(settingsId, {
    credentials,
    activatedAt,
    settingsId,
  });

  console.log(`✅ Parsed and cached credentials for settings ${settingsId}`);
  return credentials;
}

/**
 * Check if Vertex AI settings are valid and not expired
 */
function isValidAndNotExpired(settings: {
  enabled: boolean;
  expiresAt: Date | null;
  activatedAt: Date;
}): boolean {
  if (!settings.enabled) {
    return false;
  }

  const now = new Date();

  // Check expiresAt if present
  if (settings.expiresAt) {
    return settings.expiresAt > now;
  }

  // Otherwise calculate 90-day expiration from activatedAt
  const expirationDate = new Date(settings.activatedAt);
  expirationDate.setDate(expirationDate.getDate() + 90);
  return expirationDate > now;
}

/**
 * Shared helper to create Vertex AI GeminiClient from credentials
 * Used by both provider-factory and WhatsApp message-processor
 */
export function createVertexGeminiClient(
  projectId: string,
  location: string,
  credentials: any,
  modelName: string = 'gemini-2.5-flash'
): GeminiClient {
  console.log("🚀 Creating VertexAI instance with Service Account credentials");
  console.log("  - project:", projectId);
  console.log("  - location:", location);
  console.log("  - model:", modelName);
  console.log("  - credentials:", credentials.client_email);

  const vertexAI = new VertexAI({
    project: projectId,
    location: location,
    googleAuthOptions: {
      credentials: credentials,
    },
  });

  console.log("✅ VertexAI instance created successfully");
  console.log("🔧 Getting Generative Model...");

  const model = vertexAI.preview.getGenerativeModel({
    model: modelName,
  });

  console.log("✅ GenerativeModel created successfully");

  // Wrap in VertexAI adapter to normalize API
  const adapter = new VertexAIClientAdapter(model, modelName);

  // Attach the original vertexAI client for TTS access and dynamic model switching
  adapter.vertexAI = vertexAI;
  (adapter as any).__vertexAI = vertexAI;

  return adapter;
}

/**
 * Create Vertex AI client from settings
 */
async function createVertexAIClient(
  settings: {
    id: string;
    projectId: string;
    location: string;
    serviceAccountJson: string;
    activatedAt: Date;
    managedBy: "admin" | "self";
    expiresAt: Date | null;
  }
): Promise<{ client: GeminiClient; metadata: AiProviderMetadata } | null> {
  try {
    // Get parsed credentials (with caching)
    const credentials = await getParsedCredentials(
      settings.id,
      settings.serviceAccountJson,
      settings.activatedAt
    );

    if (!credentials) {
      return null;
    }

    // Use shared helper to create Vertex AI client
    const client = createVertexGeminiClient(
      settings.projectId,
      settings.location,
      credentials
    );

    // Create metadata
    const metadata: AiProviderMetadata = {
      name: settings.managedBy === "self" ? "Vertex AI (tuo)" : "Vertex AI (admin)",
      managedBy: settings.managedBy,
      expiresAt: settings.expiresAt || undefined,
    };

    console.log(`✅ Created Vertex AI client (${metadata.name}) from settings ${settings.id}`);

    // Extract the original VertexAI client for TTS
    const vertexClient = (client as any).__vertexAI as VertexAI | undefined;

    return {
      client,
      vertexClient,
      metadata,
    };
  } catch (error: any) {
    console.error(`❌ Failed to create Vertex AI client for settings ${settings.id}:`, error.message);
    return null;
  }
}

/**
 * Create SuperAdmin Vertex AI client
 * Uses the global superadmin_vertex_config table instead of per-consultant vertexAiSettings
 */
async function createSuperadminVertexClient(): Promise<{
  client: GeminiClient;
  vertexClient?: VertexAI;
  metadata: AiProviderMetadata
} | null> {
  try {
    console.log("🔍 Looking for SuperAdmin Vertex AI configuration...");

    // Get the SuperAdmin Vertex configuration (there should only be one)
    const [config] = await db
      .select()
      .from(superadminVertexConfig)
      .where(eq(superadminVertexConfig.enabled, true))
      .limit(1);

    if (!config) {
      console.log("⚠️ No enabled SuperAdmin Vertex AI configuration found");
      return null;
    }

    console.log(`📋 Found SuperAdmin Vertex AI config: project=${config.projectId}, location=${config.location}`);

    // Parse credentials
    const credentials = await parseServiceAccountJson(config.serviceAccountJson);

    if (!credentials) {
      console.error("❌ Failed to parse SuperAdmin Vertex AI credentials");
      return null;
    }

    // Validate credentials structure
    if (!credentials.private_key || !credentials.client_email) {
      console.error("❌ Invalid SuperAdmin Vertex AI credentials structure");
      return null;
    }

    // Create Vertex AI client using shared helper
    const client = createVertexGeminiClient(
      config.projectId,
      config.location,
      credentials
    );

    // Extract the original VertexAI client for TTS
    const vertexClient = (client as any).__vertexAI as VertexAI | undefined;

    // Create metadata
    const metadata: AiProviderMetadata = {
      name: "Vertex AI (SuperAdmin)",
      managedBy: "admin",
    };

    console.log("✅ Created SuperAdmin Vertex AI client successfully");

    return {
      client,
      vertexClient,
      metadata,
    };
  } catch (error: any) {
    console.error("❌ Failed to create SuperAdmin Vertex AI client:", error.message);
    return null;
  }
}

/**
 * Check if a consultant can use SuperAdmin's Vertex AI
 * Returns true if:
 * 1. Consultant has useSuperadminVertex = true in users table
 * 2. Consultant has access (consultant_vertex_access.has_access = true, or no record = default true)
 */
async function canUseSuperadminVertex(consultantId: string): Promise<boolean> {
  try {
    // 1. Check if consultant has useSuperadminVertex = true
    const [consultant] = await db
      .select({ useSuperadminVertex: users.useSuperadminVertex })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    if (!consultant || !consultant.useSuperadminVertex) {
      console.log(`⚠️ Consultant ${consultantId} has useSuperadminVertex = false`);
      return false;
    }

    // 2. Check consultant_vertex_access (default = true if no record exists)
    const [accessRecord] = await db
      .select({ hasAccess: consultantVertexAccess.hasAccess })
      .from(consultantVertexAccess)
      .where(eq(consultantVertexAccess.consultantId, consultantId))
      .limit(1);

    // If no record exists, default to true (all consultants have access by default)
    const hasAccess = accessRecord?.hasAccess ?? true;

    if (!hasAccess) {
      console.log(`⚠️ Consultant ${consultantId} has been denied SuperAdmin Vertex access`);
      return false;
    }

    console.log(`✅ Consultant ${consultantId} can use SuperAdmin Vertex AI`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error checking SuperAdmin Vertex access for consultant ${consultantId}:`, error.message);
    return false;
  }
}

/**
 * Create Google AI Studio client (fallback)
 */
async function createGoogleAIStudioClient(
  clientId: string
): Promise<{ client: GeminiClient; metadata: AiProviderMetadata } | null> {
  try {
    // Get user's API keys
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    // Get current API key from rotation
    const apiKeys = user.geminiApiKeys || [];
    const currentIndex = user.geminiApiKeyIndex || 0;

    let apiKey: string;
    if (apiKeys.length > 0) {
      const validIndex = currentIndex % apiKeys.length;
      apiKey = apiKeys[validIndex];
    } else {
      // Use default environment API key
      apiKey = process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        throw new Error("No Gemini API key available");
      }
    }

    // Create Google AI Studio GoogleGenAI instance
    const ai = new GoogleGenAI({ apiKey });

    // Wrap in adapter to normalize API
    const client = new GeminiClientAdapter(ai);

    // Create metadata
    const metadata: AiProviderMetadata = {
      name: "Google AI Studio",
    };

    console.log(`✅ Created Google AI Studio client for user ${clientId}`);

    return {
      client,
      metadata,
    };
  } catch (error: any) {
    console.error(`❌ Failed to create Google AI Studio client:`, error.message);
    return null;
  }
}

/**
 * Update usage metrics for Vertex AI settings
 */
async function updateUsageMetrics(settingsId: string): Promise<void> {
  try {
    await db
      .update(vertexAiSettings)
      .set({
        lastUsedAt: new Date(),
        usageCount: sql`${vertexAiSettings.usageCount} + 1`,
      })
      .where(eq(vertexAiSettings.id, settingsId));
  } catch (error: any) {
    console.error(`⚠️ Failed to update usage metrics for settings ${settingsId}:`, error.message);
    // Don't throw - this is non-critical
  }
}

/**
 * Check if a user can use Vertex AI settings based on usageScope
 * @param settings - Vertex AI settings with usageScope field
 * @param clientId - The client ID trying to use Vertex AI
 * @param isConsultantUsingOwnAI - Whether it's the consultant using their own AI
 * @returns true if user can use these settings, false otherwise
 */
async function checkUsageScope(
  settings: { id: string; usageScope: "both" | "consultant_only" | "clients_only" | "selective" | null },
  clientId: string,
  isConsultantUsingOwnAI: boolean
): Promise<boolean> {
  const usageScope = settings.usageScope || "both"; // Default to "both" if not set

  // "both" - everyone can use
  if (usageScope === "both") {
    console.log(`✅ usageScope is 'both' - access granted`);
    return true;
  }

  // "consultant_only" - only consultant can use
  if (usageScope === "consultant_only") {
    if (isConsultantUsingOwnAI) {
      console.log(`✅ usageScope is 'consultant_only' and user is consultant - access granted`);
      return true;
    } else {
      console.log(`❌ usageScope is 'consultant_only' but user is a client - access denied`);
      return false;
    }
  }

  // "clients_only" - only clients can use
  if (usageScope === "clients_only") {
    if (!isConsultantUsingOwnAI) {
      console.log(`✅ usageScope is 'clients_only' and user is a client - access granted`);
      return true;
    } else {
      console.log(`❌ usageScope is 'clients_only' but user is consultant - access denied`);
      return false;
    }
  }

  // "selective" - check vertex_ai_client_access table
  if (usageScope === "selective") {
    // Consultant always has access to their own settings
    if (isConsultantUsingOwnAI) {
      console.log(`✅ usageScope is 'selective' but user is consultant (owner) - access granted`);
      return true;
    }

    // Check if client has explicit access
    const [accessRecord] = await db
      .select()
      .from(vertexAiClientAccess)
      .where(
        and(
          eq(vertexAiClientAccess.vertexSettingsId, settings.id),
          eq(vertexAiClientAccess.clientId, clientId)
        )
      )
      .limit(1);

    if (accessRecord && accessRecord.hasAccess) {
      console.log(`✅ usageScope is 'selective' and client has explicit access - access granted`);
      return true;
    } else {
      console.log(`❌ usageScope is 'selective' but client has no explicit access record - access denied`);
      return false;
    }
  }

  // Fallback: deny access for unknown usageScope values
  console.log(`❌ Unknown usageScope '${usageScope}' - access denied by default`);
  return false;
}

/**
 * Get OAuth2 access token for Gemini Live API with Vertex AI credentials
 * Returns token + project info for manual WebSocket connection
 * 
 * @param clientId - Client user ID
 * @param consultantId - Consultant user ID
 * @returns Access token and project config or null if unavailable
 */
export async function getVertexAITokenForLive(
  clientId: string,
  consultantId: string
): Promise<{ accessToken: string; projectId: string; location: string; modelId: string } | null> {
  try {
    console.log(`🔍 Getting Vertex AI token for Live API - client ${clientId}, consultant ${consultantId}...`);

    // Find all enabled Vertex AI settings for the consultant
    const allVertexSettings = await db
      .select()
      .from(vertexAiSettings)
      .where(
        and(
          eq(vertexAiSettings.userId, consultantId),
          eq(vertexAiSettings.enabled, true)
        )
      )
      .orderBy(vertexAiSettings.managedBy);

    if (allVertexSettings.length === 0) {
      console.log(`⚠️ No Vertex AI settings found for consultant ${consultantId}`);
      return null;
    }

    // Try each setting until we find one that works
    for (const settings of allVertexSettings) {
      try {
        if (!isValidAndNotExpired(settings)) {
          continue;
        }

        const isConsultantUsingOwnAI = clientId === consultantId;
        const canUse = await checkUsageScope(settings, clientId, isConsultantUsingOwnAI);

        if (!canUse) {
          continue;
        }

        // Get parsed credentials
        const credentials = await getParsedCredentials(
          settings.id,
          settings.serviceAccountJson,
          settings.activatedAt
        );

        if (!credentials) {
          continue;
        }

        console.log(`🚀 Generating OAuth2 token for Live API from Vertex AI credentials...`);
        console.log(`  - project: ${settings.projectId}`);
        console.log(`  - location: ${settings.location}`);
        console.log(`  - credentials: ${credentials.client_email}`);

        // Fix private_key format (ensure proper newlines)
        const fixedCredentials = {
          ...credentials,
          private_key: credentials.private_key.replace(/\\n/g, '\n')
        };

        // Use google-auth-library to generate OAuth2 access token
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({
          credentials: fixedCredentials,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          projectId: settings.projectId,
        });

        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();

        if (!tokenResponse.token) {
          console.error(`❌ Failed to get access token from service account`);
          continue;
        }

        console.log(`✅ Generated OAuth2 access token for Live API`);

        return {
          accessToken: tokenResponse.token,
          projectId: settings.projectId,
          location: settings.location,
          modelId: 'gemini-live-2.5-flash-native-audio',
        };
      } catch (settingError: any) {
        console.error(`❌ Error generating token with setting:`, settingError.message);
        continue;
      }
    }

    console.log(`⚠️ No valid Vertex AI settings available for Live API`);
    return null;
  } catch (error: any) {
    console.error(`❌ Failed to get Vertex AI token for Live API:`, error.message);
    return null;
  }
}

/**
 * Get AI provider using 3-tier priority system with client preference
 * 
 * Priority (respecting client's preferredAiProvider):
 * - vertex_admin: Use admin Vertex AI (skip client tier)
 * - google_studio: Use Google AI Studio (skip client and admin tiers)
 * - custom: Use client's custom API keys only
 * 
 * Fallback logic if preferred provider fails:
 * 1. Client Vertex AI (userId = clientId, managedBy = 'self') - only if preferredAiProvider allows
 * 2. Admin Vertex AI (userId = consultantId, managedBy = 'admin') - if preferredAiProvider != 'custom'
 * 3. Google AI Studio (fallback) - if preferredAiProvider != 'custom'
 * 
 * @param clientId - Client user ID
 * @param consultantId - Consultant user ID (optional - if undefined, skip consultant-tier lookups)
 * @returns AI provider result with client, metadata, source, and optional cleanup
 */
export async function getAIProvider(
  clientId: string,
  consultantId?: string
): Promise<AiProviderResult> {
  const now = new Date();

  console.log(`🔍 Finding AI provider for client ${clientId} (consultant: ${consultantId ?? 'none'})...`);

  // Get client's AI provider preference
  const [client] = await db
    .select()
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);

  const preferredProvider = client?.preferredAiProvider || "vertex_admin";
  console.log(`📋 Client preferred AI provider: ${preferredProvider}`);

  // If custom provider: ONLY use client's API keys, no fallback
  if (preferredProvider === "custom") {
    console.log(`✅ Using CUSTOM provider (client's own API keys)`);
    const result = await createGoogleAIStudioClient(clientId);
    if (!result) {
      throw new Error(
        "❌ Failed to initialize custom AI provider. " +
        "Client has custom provider configured but no valid API keys. " +
        "Please add Gemini API keys or switch to vertex_admin/google_studio."
      );
    }
    return {
      client: result.client,
      metadata: result.metadata,
      source: "google",
    };
  }

  // If google_studio preference: Skip Vertex AI tiers, go directly to Google AI Studio
  if (preferredProvider === "google_studio") {
    console.log(`✅ Using GOOGLE STUDIO provider (consultant's fallback keys)`);
    const googleStudioUserId = consultantId ?? clientId;
    const result = await createGoogleAIStudioClient(googleStudioUserId);
    if (!result) {
      throw new Error(
        "❌ Failed to initialize Google AI Studio provider. " +
        "No valid Gemini API keys found. " +
        "Please add API keys or configure Vertex AI."
      );
    }
    return {
      client: result.client,
      metadata: result.metadata,
      source: "google",
    };
  }

  // TIER 0: Try SuperAdmin Vertex AI
  // This is the highest priority - if consultant has opted in and has access, use SuperAdmin's Vertex
  if (consultantId) {
    try {
      console.log(`🔍 TIER 0: Checking SuperAdmin Vertex AI eligibility...`);

      // Determine the consultant to check for SuperAdmin Vertex access
      // If clientId !== consultantId, user is a client - need to get their consultant's settings
      let consultantToCheck = consultantId;

      // Check if user is a client (has a different consultantId)
      if (clientId !== consultantId) {
        console.log(`📋 User ${clientId} is a client, checking their consultant ${consultantId}'s settings`);
      } else {
        console.log(`📋 User ${clientId} is the consultant themselves`);
      }

      // Check if consultant can use SuperAdmin Vertex
      const canUse = await canUseSuperadminVertex(consultantToCheck);

      if (canUse) {
        const result = await createSuperadminVertexClient();
        if (result) {
          console.log(`✅ TIER 0: Successfully created SuperAdmin Vertex AI client`);

          return {
            client: result.client,
            vertexClient: result.vertexClient,
            metadata: result.metadata,
            source: "superadmin",
          };
        } else {
          console.log(`⚠️ TIER 0: SuperAdmin Vertex AI config not available, falling back to TIER 1`);
        }
      } else {
        console.log(`⚠️ TIER 0: Consultant ${consultantToCheck} cannot use SuperAdmin Vertex, falling back to TIER 1`);
      }
    } catch (error: any) {
      console.error(`❌ TIER 0 Error:`, error.message);
      // Continue to TIER 1
    }
  } else {
    console.log(`⚠️ TIER 0: Skipped (no consultantId provided)`);
  }

  // TIER 1: Try client-managed Vertex AI (userId = clientId, managedBy = 'self')
  // This allows clients with their own Vertex AI credentials to use them
  try {
    console.log(`🔍 TIER 1: Looking for client-managed Vertex AI (clientId: ${clientId})...`);

    const clientVertexSettings = await db
      .select()
      .from(vertexAiSettings)
      .where(
        and(
          eq(vertexAiSettings.userId, clientId),
          eq(vertexAiSettings.managedBy, "self"),
          eq(vertexAiSettings.enabled, true)
        )
      )
      .limit(1);

    if (clientVertexSettings.length > 0) {
      const vertexSettings = clientVertexSettings[0];
      console.log(`📋 Found client-managed Vertex AI setting`);

      if (isValidAndNotExpired(vertexSettings)) {
        const result = await createVertexAIClient(vertexSettings);
        if (result) {
          console.log(`✅ TIER 1: Successfully created client-managed Vertex AI client`);

          updateUsageMetrics(vertexSettings.id);

          return {
            client: result.client,
            vertexClient: result.vertexClient,
            metadata: result.metadata,
            source: "client",
            cleanup: async () => {
              credentialsCache.delete(vertexSettings.id);
            },
          };
        } else {
          console.log(`⚠️ TIER 1: Failed to create client with this setting, continuing to TIER 2`);
        }
      } else {
        console.log(`⚠️ TIER 1: Client Vertex AI setting expired or invalid, continuing to TIER 2`);
      }
    } else {
      console.log(`⚠️ TIER 1: No client-managed Vertex AI settings found`);
    }
  } catch (error: any) {
    console.error(`❌ TIER 1 Error:`, error.message);
  }

  // TIER 2: Try Vertex AI (consultant-managed)
  // Only run if consultantId is provided
  // Find all enabled Vertex AI settings for the consultant and iterate until one passes usageScope check
  if (consultantId) {
    try {
      const isConsultantUsingOwnAI = clientId === consultantId;

      console.log(`🔍 TIER 2: Finding Vertex AI settings for consultant ${consultantId} (isConsultantUsingOwnAI: ${isConsultantUsingOwnAI})`);

      // Get ALL enabled Vertex AI settings for consultant, ordered by managedBy
      // Priority: 'admin' settings first (for clients), then 'self' (for consultant's own use)
      const allVertexSettings = await db
        .select()
        .from(vertexAiSettings)
        .where(
          and(
            eq(vertexAiSettings.userId, consultantId),
            eq(vertexAiSettings.enabled, true)
          )
        )
        .orderBy(vertexAiSettings.managedBy); // 'admin' comes before 'self' alphabetically

      if (allVertexSettings.length === 0) {
        console.log(`⚠️ TIER 2: No Vertex AI settings found for consultant ${consultantId}`);
      } else {
        console.log(`📋 TIER 2: Found ${allVertexSettings.length} Vertex AI setting(s) for consultant`);

        // Try each setting until we find one that passes all checks
        for (const vertexSettings of allVertexSettings) {
          try {
            console.log(`🔍 Checking Vertex AI setting: managedBy=${vertexSettings.managedBy}, usageScope=${vertexSettings.usageScope}`);

            if (!isValidAndNotExpired(vertexSettings)) {
              console.log(`⚠️ Setting expired or invalid, skipping`);
              continue;
            }

            // Check usageScope to determine if this user can use this Vertex AI
            const canUse = await checkUsageScope(vertexSettings, clientId, isConsultantUsingOwnAI);

            if (!canUse) {
              console.log(`⚠️ usageScope '${vertexSettings.usageScope}' prevents this user from using this setting, trying next`);
              continue;
            }

            // Try to create client with this setting
            const result = await createVertexAIClient(vertexSettings);
            if (result) {
              console.log(`✅ TIER 2: Successfully created Vertex AI client (managedBy: ${vertexSettings.managedBy}, usageScope: ${vertexSettings.usageScope})`);

              // Update usage metrics asynchronously
              updateUsageMetrics(vertexSettings.id);

              return {
                client: result.client,
                vertexClient: result.vertexClient,
                metadata: result.metadata,
                source: "admin",
                cleanup: async () => {
                  // Cleanup: clear cache entry if needed
                  credentialsCache.delete(vertexSettings.id);
                },
              };
            } else {
              console.log(`⚠️ Failed to create client with this setting, trying next`);
            }
          } catch (settingError: any) {
            console.error(`❌ Error processing Vertex AI setting (managedBy: ${vertexSettings.managedBy}):`, settingError.message);
            console.log(`⚠️ Continuing to next setting...`);
            // Continue to next setting instead of failing entire tier
          }
        }

        console.log(`⚠️ TIER 2: No valid Vertex AI settings available for this user, falling back to TIER 3`);
      }
    } catch (error: any) {
      console.error(`❌ TIER 2 Error:`, error.message);
      // Continue to next tier
    }
  } else {
    console.log(`⚠️ TIER 2: Skipped (no consultantId provided)`);
  }

  // TIER 3: Fallback to Google AI Studio (use consultant keys if available, otherwise client keys)
  const fallbackUserId = consultantId ?? clientId;
  console.log(`⚠️ TIER 3: No Vertex AI available, falling back to Google AI Studio (user: ${fallbackUserId})`);

  const result = await createGoogleAIStudioClient(fallbackUserId);
  if (!result) {
    throw new Error(
      "❌ Failed to initialize AI provider. " +
      "No valid Vertex AI configuration found and Google AI Studio fallback failed. " +
      "Please configure Vertex AI or add Gemini API keys."
    );
  }

  return {
    client: result.client,
    metadata: result.metadata,
    source: "google",
  };
}

/**
 * Clear credentials cache (for testing or manual invalidation)
 */
export function clearCredentialsCache(): void {
  credentialsCache.clear();
  console.log(`🗑️ Credentials cache cleared`);
}

/**
 * Get cache stats (for monitoring)
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ settingsId: string; activatedAt: Date }>;
} {
  return {
    size: credentialsCache.size,
    entries: Array.from(credentialsCache.values()).map(entry => ({
      settingsId: entry.settingsId,
      activatedAt: entry.activatedAt,
    })),
  };
}
