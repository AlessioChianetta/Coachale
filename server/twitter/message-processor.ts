/**
 * Twitter/X Message Processor
 * Handles AI response generation and message sending
 * Integrates with existing AI agent infrastructure
 */

import { db } from "../db";
import {
  consultantTwitterConfig,
  twitterConversations,
  twitterMessages,
  twitterPendingMessages,
  consultantWhatsappConfig,
  users,
} from "../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { decrypt } from "../encryption";
import { TwitterClient } from "./twitter-client";

// Batching configuration
const BATCH_DELAY_MS = 3000; // Wait 3 seconds for additional messages
const pendingBatches: Map<string, NodeJS.Timeout> = new Map();

/**
 * Schedule message processing with batching
 * Groups rapid-fire messages before AI processing
 */
export async function scheduleTwitterMessageProcessing(
  conversationId: string,
  configId: string
): Promise<void> {
  const batchKey = `${conversationId}`;

  // Clear existing timeout for this conversation
  const existingTimeout = pendingBatches.get(batchKey);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Schedule processing after batch delay
  const timeout = setTimeout(async () => {
    pendingBatches.delete(batchKey);
    await processTwitterMessage(conversationId, configId);
  }, BATCH_DELAY_MS);

  pendingBatches.set(batchKey, timeout);
  console.log(`⏱️ [TWITTER PROCESSOR] Scheduled processing for conversation ${conversationId}`);
}

/**
 * Process a Twitter DM conversation and generate AI response
 */
export async function processTwitterMessage(
  conversationId: string,
  configId: string
): Promise<void> {
  console.log(`\n🤖 [TWITTER PROCESSOR] Processing conversation ${conversationId}`);

  try {
    // Get conversation
    const [conversation] = await db
      .select()
      .from(twitterConversations)
      .where(eq(twitterConversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      console.log(`❌ [TWITTER PROCESSOR] Conversation not found`);
      return;
    }

    // Check if AI is enabled for this conversation
    if (!conversation.aiEnabled) {
      console.log(`⏸️ [TWITTER PROCESSOR] AI disabled for this conversation`);
      return;
    }

    // Get config
    const [config] = await db
      .select()
      .from(consultantTwitterConfig)
      .where(eq(consultantTwitterConfig.id, configId))
      .limit(1);

    if (!config) {
      console.log(`❌ [TWITTER PROCESSOR] Config not found`);
      return;
    }

    // Get recent messages for context
    const recentMessages = await db
      .select()
      .from(twitterMessages)
      .where(eq(twitterMessages.conversationId, conversationId))
      .orderBy(desc(twitterMessages.createdAt))
      .limit(20);

    // Reverse to get chronological order
    const chronologicalMessages = recentMessages.reverse();

    // Get the last user message
    const lastUserMessage = chronologicalMessages.find(m => m.direction === "inbound");
    if (!lastUserMessage) {
      console.log(`⚠️ [TWITTER PROCESSOR] No user message to respond to`);
      return;
    }

    // Build conversation history for AI
    const conversationHistory = chronologicalMessages.map(m => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.messageText,
    }));

    // Generate AI response using existing infrastructure
    const aiResponse = await generateAIResponse(
      config,
      conversationHistory,
      lastUserMessage.messageText
    );

    if (!aiResponse) {
      console.log(`⚠️ [TWITTER PROCESSOR] No AI response generated`);
      return;
    }

    console.log(`💬 [TWITTER PROCESSOR] AI Response: "${aiResponse.slice(0, 100)}..."`);

    // Send the response
    await sendTwitterDM(config, conversation.twitterUserId, aiResponse, conversationId);

  } catch (error) {
    console.error(`❌ [TWITTER PROCESSOR] Error processing message:`, error);
  }
}

/**
 * Generate AI response using existing AI infrastructure
 */
async function generateAIResponse(
  config: typeof consultantTwitterConfig.$inferSelect,
  conversationHistory: Array<{ role: string; content: string }>,
  lastMessage: string
): Promise<string | null> {
  try {
    // Build system prompt from config
    const systemPrompt = buildSystemPrompt(config);

    // Use Gemini for response generation (same as WhatsApp/Instagram)
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    // Get API key from environment or config
    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.log(`⚠️ [TWITTER PROCESSOR] No Gemini API key configured`);
      return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Build chat history
    const chatHistory = conversationHistory.slice(0, -1).map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
      systemInstruction: systemPrompt,
    });

    const result = await chat.sendMessage(lastMessage);
    const response = result.response.text();

    return response.trim();
  } catch (error) {
    console.error(`❌ [TWITTER PROCESSOR] AI generation error:`, error);
    return null;
  }
}

/**
 * Build system prompt from config
 */
function buildSystemPrompt(config: typeof consultantTwitterConfig.$inferSelect): string {
  const parts: string[] = [];

  // Base instruction
  parts.push(`Sei un assistente AI che risponde ai messaggi diretti su X (Twitter) per conto di ${config.consultantDisplayName || config.businessName || "un professionista"}.`);

  // Business context
  if (config.businessDescription) {
    parts.push(`\nContesto business: ${config.businessDescription}`);
  }

  if (config.whatWeDo) {
    parts.push(`\nCosa facciamo: ${config.whatWeDo}`);
  }

  if (config.whoWeHelp) {
    parts.push(`\nChi aiutiamo: ${config.whoWeHelp}`);
  }

  if (config.usp) {
    parts.push(`\nProposta unica: ${config.usp}`);
  }

  // AI Personality
  const personalityDescriptions: Record<string, string> = {
    amico_fidato: "Rispondi in modo amichevole e informale, come un amico fidato.",
    coach_motivazionale: "Sii motivante e incoraggiante, come un coach personale.",
    consulente_professionale: "Mantieni un tono professionale e competente.",
    mentore_paziente: "Sii paziente e guida l'utente passo dopo passo.",
    venditore_energico: "Sii entusiasta e orientato alla conversione.",
    consigliere_empatico: "Mostra empatia e comprensione.",
    stratega_diretto: "Vai dritto al punto con consigli pratici.",
    educatore_socratico: "Fai domande per guidare l'utente alla comprensione.",
    esperto_tecnico: "Fornisci risposte tecniche dettagliate.",
    compagno_entusiasta: "Sii entusiasta e positivo in ogni interazione.",
  };

  const personality = config.aiPersonality || "amico_fidato";
  if (personalityDescriptions[personality]) {
    parts.push(`\nStile di comunicazione: ${personalityDescriptions[personality]}`);
  }

  // Custom instructions
  if (config.agentInstructionsEnabled && config.agentInstructions) {
    parts.push(`\nIstruzioni specifiche:\n${config.agentInstructions}`);
  }

  // Sales script
  if (config.salesScript) {
    parts.push(`\nScript di vendita:\n${config.salesScript}`);
  }

  // Platform-specific guidelines
  parts.push(`\n\nLinee guida per X (Twitter):
- Rispondi in modo conciso (Twitter ha limiti di caratteri)
- Usa un tono appropriato al contesto social
- Evita messaggi troppo lunghi
- Puoi usare emoji con moderazione
- Se l'utente chiede di fissare un appuntamento, raccogli le informazioni necessarie
- Non rivelare mai che sei un AI a meno che non venga chiesto direttamente`);

  return parts.join("\n");
}

/**
 * Send a DM response
 */
async function sendTwitterDM(
  config: typeof consultantTwitterConfig.$inferSelect,
  recipientUserId: string,
  message: string,
  conversationId: string
): Promise<boolean> {
  try {
    // Get API credentials from superadmin config
    const [superAdminConfig] = await db
      .select()
      .from(require("../../shared/schema").superadminTwitterConfig)
      .where(eq(require("../../shared/schema").superadminTwitterConfig.enabled, true))
      .limit(1);

    if (!superAdminConfig) {
      console.log(`❌ [TWITTER DM] No superadmin config found`);
      return false;
    }

    if (!config.accessToken || !config.accessTokenSecret) {
      console.log(`❌ [TWITTER DM] No access tokens for config ${config.id}`);
      return false;
    }

    // Create Twitter client
    const client = new TwitterClient({
      apiKey: decrypt(superAdminConfig.apiKeyEncrypted),
      apiSecret: decrypt(superAdminConfig.apiSecretEncrypted),
      accessToken: decrypt(config.accessToken),
      accessTokenSecret: decrypt(config.accessTokenSecret),
    });

    // Send the message
    const result = await client.sendDirectMessage(recipientUserId, {
      text: message,
    });

    console.log(`✅ [TWITTER DM] Sent message, event ID: ${result.dm_event_id}`);

    // Save the outbound message
    await db.insert(twitterMessages).values({
      conversationId,
      messageText: message,
      direction: "outbound",
      sender: "ai",
      mediaType: "text",
      twitterMessageId: result.dm_event_id,
      dmEventId: result.dm_event_id,
      status: "sent",
      sentAt: new Date(),
    });

    // Update conversation
    await db
      .update(twitterConversations)
      .set({
        messageCount: sql`${twitterConversations.messageCount} + 1`,
        lastMessageAt: new Date(),
        lastMessageFrom: "ai",
        updatedAt: new Date(),
      })
      .where(eq(twitterConversations.id, conversationId));

    return true;
  } catch (error) {
    console.error(`❌ [TWITTER DM] Failed to send:`, error);

    // Log the failure
    await db.insert(twitterMessages).values({
      conversationId,
      messageText: message,
      direction: "outbound",
      sender: "ai",
      mediaType: "text",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      failedAt: new Date(),
    });

    return false;
  }
}
