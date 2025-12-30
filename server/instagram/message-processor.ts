/**
 * Instagram Message Processor
 * 
 * Processes incoming Instagram messages and generates AI responses.
 * Reuses shared AI logic from WhatsApp implementation:
 * - ai-prompts.ts: System prompt building
 * - ai-context-builder.ts: User context building
 * 
 * Key differences from WhatsApp:
 * - 24h window enforcement (cannot send if window closed)
 * - Uses Meta Graph API instead of Twilio
 * - No template messages for outreach
 */

import { db } from "../db";
import {
  instagramPendingMessages,
  instagramMessages,
  instagramConversations,
  consultantInstagramConfig,
  consultantWhatsappConfig,
  users,
} from "../../shared/schema";
import { eq, isNull, and, desc, asc, sql } from "drizzle-orm";
import { buildUserContext, detectIntent } from "../ai-context-builder";
import { buildWhatsAppAgentPrompt } from "../whatsapp/agent-consultant-chat-service";
import { getAIProvider, GEMINI_3_MODEL } from "../ai/provider-factory";
import { MetaClient, createMetaClient } from "./meta-client";
import { WindowTracker, checkWindowStatus } from "./window-tracker";
import { decryptForConsultant } from "../encryption";
import { nanoid } from "nanoid";

const processingQueue = new Map<string, NodeJS.Timeout>();
const BATCH_DELAY_MS = 3000;

/**
 * Schedule message processing with batching
 * Batches multiple messages from same user within BATCH_DELAY_MS
 */
export function scheduleInstagramMessageProcessing(
  conversationId: string,
  agentConfigId: string,
  consultantId: string
): void {
  const key = `${conversationId}`;

  if (processingQueue.has(key)) {
    clearTimeout(processingQueue.get(key)!);
  }

  const timeout = setTimeout(async () => {
    processingQueue.delete(key);
    await processInstagramConversation(conversationId, agentConfigId, consultantId);
  }, BATCH_DELAY_MS);

  processingQueue.set(key, timeout);
  console.log(`⏰ [INSTAGRAM] Scheduled processing for conversation ${conversationId} in ${BATCH_DELAY_MS}ms`);
}

/**
 * Process a conversation - main entry point
 */
async function processInstagramConversation(
  conversationId: string,
  agentConfigId: string,
  consultantId: string
): Promise<void> {
  const startTime = Date.now();
  console.log(`\n🔄 [INSTAGRAM] Processing conversation ${conversationId}`);

  try {
    // Check if window is still open
    const windowStatus = await checkWindowStatus(conversationId);
    if (!windowStatus.canSendMessage) {
      console.log(`⚠️ [INSTAGRAM] Window closed for conversation ${conversationId}. Cannot send message.`);
      await markPendingMessagesProcessed(conversationId);
      return;
    }

    // Get pending messages
    const pendingMessages = await db
      .select()
      .from(instagramPendingMessages)
      .where(
        and(
          eq(instagramPendingMessages.conversationId, conversationId),
          isNull(instagramPendingMessages.processedAt)
        )
      )
      .orderBy(asc(instagramPendingMessages.receivedAt));

    if (pendingMessages.length === 0) {
      console.log(`📭 [INSTAGRAM] No pending messages for conversation ${conversationId}`);
      return;
    }

    console.log(`📬 [INSTAGRAM] Found ${pendingMessages.length} pending message(s)`);

    // Get conversation and config
    const [conversation] = await db
      .select()
      .from(instagramConversations)
      .where(eq(instagramConversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      console.error(`❌ [INSTAGRAM] Conversation ${conversationId} not found`);
      return;
    }

    const [config] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(eq(consultantInstagramConfig.id, agentConfigId))
      .limit(1);

    if (!config || !config.isActive) {
      console.error(`❌ [INSTAGRAM] Config ${agentConfigId} not found or inactive`);
      return;
    }

    // Get consultant
    const [consultant] = await db
      .select()
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    if (!consultant) {
      console.error(`❌ [INSTAGRAM] Consultant ${consultantId} not found`);
      return;
    }

    // Look for linked WhatsApp agent (1 agent per Instagram account)
    const [linkedAgent] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.instagramConfigId, config.id),
          eq(consultantWhatsappConfig.consultantId, consultantId),
          eq(consultantWhatsappConfig.isActive, true)
        )
      )
      .limit(1);

    if (linkedAgent) {
      console.log(`🔗 [INSTAGRAM] Found linked WhatsApp agent: ${linkedAgent.agentName} (${linkedAgent.id})`);
    } else {
      console.log(`⚠️ [INSTAGRAM] No linked WhatsApp agent, using Instagram config settings`);
    }

    // Combine pending messages
    const combinedMessage = pendingMessages
      .map((m) => m.messageText)
      .join("\n");

    // Mark as processing (generate batch ID)
    const batchId = nanoid(10);
    await db
      .update(instagramPendingMessages)
      .set({ batchId })
      .where(
        and(
          eq(instagramPendingMessages.conversationId, conversationId),
          isNull(instagramPendingMessages.processedAt)
        )
      );

    // Get conversation history
    const messageHistory = await db
      .select()
      .from(instagramMessages)
      .where(eq(instagramMessages.conversationId, conversationId))
      .orderBy(desc(instagramMessages.createdAt))
      .limit(30);

    // Format history for AI
    const formattedHistory = messageHistory
      .reverse()
      .map((m) => ({
        role: m.sender === "client" ? "user" as const : "assistant" as const,
        content: m.messageText,
      }));

    // Generate AI response using shared logic (prefer linked agent settings)
    const aiResponse = await generateAIResponse(
      config,
      consultant,
      conversation,
      combinedMessage,
      formattedHistory,
      linkedAgent || null,
      pendingMessages
    );

    if (!aiResponse) {
      console.log(`⚠️ [INSTAGRAM] No AI response generated`);
      await markPendingMessagesProcessed(conversationId);
      return;
    }

    // Send message via Meta API
    await sendInstagramResponse(
      config,
      consultant,
      conversation,
      aiResponse,
      windowStatus.canUseHumanAgentTag
    );

    // Mark pending messages as processed
    await markPendingMessagesProcessed(conversationId);

    const duration = Date.now() - startTime;
    console.log(`✅ [INSTAGRAM] Processed conversation ${conversationId} in ${duration}ms`);
  } catch (error) {
    console.error(`❌ [INSTAGRAM] Error processing conversation ${conversationId}:`, error);
    await markPendingMessagesProcessed(conversationId);
  }
}

/**
 * Generate AI response using shared AI logic
 * If a linked WhatsApp agent exists, use its settings; otherwise fall back to Instagram config
 */
async function generateAIResponse(
  config: typeof consultantInstagramConfig.$inferSelect,
  consultant: typeof users.$inferSelect,
  conversation: typeof instagramConversations.$inferSelect,
  userMessage: string,
  messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
  linkedAgent: typeof consultantWhatsappConfig.$inferSelect | null,
  pendingMessages?: Array<typeof instagramPendingMessages.$inferSelect>
): Promise<string | null> {
  try {
    // Use linked WhatsApp agent settings if available, otherwise fall back to Instagram config
    const source = linkedAgent || config;
    
    // Build agent config object compatible with WhatsApp structure
    const agentConfigForAI = {
      id: linkedAgent?.id || config.id,
      consultantId: config.consultantId,
      agentName: source.agentName,
      agentType: source.agentType,
      businessName: source.businessName,
      consultantDisplayName: source.consultantDisplayName,
      businessDescription: source.businessDescription,
      consultantBio: source.consultantBio,
      salesScript: source.salesScript,
      aiPersonality: source.aiPersonality,
      vision: source.vision,
      mission: source.mission,
      values: source.values,
      usp: source.usp,
      whoWeHelp: source.whoWeHelp,
      whoWeDontHelp: source.whoWeDontHelp,
      whatWeDo: source.whatWeDo,
      howWeDoIt: source.howWeDoIt,
      agentInstructions: source.agentInstructions,
      agentInstructionsEnabled: source.agentInstructionsEnabled,
      bookingEnabled: source.bookingEnabled,
      objectionHandlingEnabled: source.objectionHandlingEnabled,
      disqualificationEnabled: source.disqualificationEnabled,
      isProactiveAgent: linkedAgent?.isProactiveAgent || false,
      integrationMode: "whatsapp_ai" as const,
    };
    
    console.log(`🤖 [INSTAGRAM] Using ${linkedAgent ? 'linked WhatsApp agent' : 'Instagram config'} settings for AI: ${agentConfigForAI.agentName}`);
    console.log(`📋 [INSTAGRAM] Agent instructions enabled: ${agentConfigForAI.agentInstructionsEnabled}, length: ${agentConfigForAI.agentInstructions?.length || 0}`);
    console.log(`📋 [INSTAGRAM] Booking enabled: ${agentConfigForAI.bookingEnabled}, Objection: ${agentConfigForAI.objectionHandlingEnabled}`);

    // Build system prompt using shared WhatsApp agent logic
    const systemPrompt = await buildWhatsAppAgentPrompt(agentConfigForAI);
    console.log(`📝 [INSTAGRAM] System prompt length: ${systemPrompt.length} chars`);

    // Fetch user profile for richer context
    let userProfileInfo = "";
    try {
      let pageAccessToken = config.pageAccessToken;
      if (pageAccessToken && consultant.encryptionSalt) {
        try {
          pageAccessToken = decryptForConsultant(pageAccessToken, consultant.encryptionSalt);
        } catch (e) {
          console.log("🔓 [INSTAGRAM] Token not encrypted, using as-is for profile fetch");
        }
      }
      
      if (pageAccessToken && config.instagramPageId) {
        const metaClient = createMetaClient({
          pageAccessToken,
          instagramPageId: config.instagramPageId,
          isDryRun: config.isDryRun,
        });
        const profile = await metaClient.getUserProfile(conversation.instagramUserId);
        if (profile) {
          userProfileInfo = `
- Username Instagram: @${profile.username || conversation.instagramUsername || "sconosciuto"}
- Nome: ${profile.name || "Non disponibile"}`;
          console.log(`👤 [INSTAGRAM] Fetched profile for ${profile.username || conversation.instagramUserId}`);
        }
      }
    } catch (e) {
      console.log("⚠️ [INSTAGRAM] Could not fetch user profile:", e);
      userProfileInfo = `
- Username Instagram: @${conversation.instagramUsername || conversation.instagramUserId}`;
    }

    // Extract trigger context from pending messages metadata (use latest message with metadata)
    let triggerContext = "";
    const latestPendingWithMeta = pendingMessages?.slice().reverse().find(m => m.metadata);
    if (latestPendingWithMeta?.metadata) {
      const meta = latestPendingWithMeta.metadata as any;
      if (meta.commentTrigger) {
        triggerContext = `
- Questa conversazione è iniziata da un COMMENTO su un tuo post Instagram
- L'utente ha scritto: "${latestPendingWithMeta.messageText?.replace('[Comment Trigger] User commented: ', '') || ''}"
- L'utente è interessato al contenuto del post, rispondi contestualmente`;
      } else if (meta.iceBreaker) {
        triggerContext = `
- L'utente ha usato un ICE BREAKER (domanda rapida predefinita)
- Domanda selezionata: "${meta.payload || ''}"
- Rispondi direttamente alla domanda in modo chiaro e conciso`;
      }
    }

    // Build source context based on conversation source type
    let sourceContext = "";
    switch (conversation.sourceType) {
      case "dm":
        sourceContext = "L'utente ti ha scritto direttamente in DM";
        break;
      case "story_reply":
        sourceContext = "L'utente ha RISPOSTO a una tua STORIA Instagram - menziona brevemente la storia se rilevante";
        break;
      case "story_mention":
        sourceContext = "L'utente ti ha MENZIONATO in una sua STORIA - ringrazialo e coinvolgilo";
        break;
      case "comment":
        sourceContext = "L'utente ha commentato un tuo post e tu lo stai contattando in DM";
        break;
      case "ice_breaker":
        sourceContext = "L'utente ha usato una domanda rapida (Ice Breaker)";
        break;
      default:
        sourceContext = "Messaggio diretto";
    }

    // Add Instagram-specific context to system prompt
    const instagramContext = `

## Instagram-Specific Context
- Canale: Instagram Direct Messages
${userProfileInfo}
- Come è iniziata la conversazione: ${sourceContext}
${triggerContext}
- Finestra messaggi: ${conversation.windowExpiresAt ? `scade tra ${Math.round((new Date(conversation.windowExpiresAt).getTime() - Date.now()) / 3600000)}h` : "attiva"}

⚠️ REGOLE FONDAMENTALI PER INSTAGRAM DM:
1. LIMITE 1000 CARATTERI: I messaggi Instagram hanno un limite MASSIMO di 1000 caratteri. Le tue risposte DEVONO essere SEMPRE sotto i 900 caratteri.
2. RISPOSTE BREVI: Su Instagram le persone si aspettano messaggi brevi e diretti, come una chat tra amici. NON scrivere paragrafi lunghi o elenchi puntati estesi.
3. STILE CONVERSAZIONALE: Scrivi come se stessi chattando, non come se scrivessi un'email formale.
4. UNA DOMANDA ALLA VOLTA: Fai UNA sola domanda per messaggio, non bombardare l'utente.
5. Hai solo 24h dalla risposta dell'utente per rispondere. Se non risponde, non puoi contattarlo.
`;

    const fullSystemPrompt = systemPrompt + instagramContext;

    // Get AI provider and generate response (use consultantId for both params like WhatsApp)
    const aiProvider = await getAIProvider(consultant.id, consultant.id);
    
    console.log(`🤖 [INSTAGRAM] AI Provider: ${aiProvider.source} (${aiProvider.metadata.name})`);
    
    let response: string | null = null;

    // Use the unified client from getAIProvider (handles both Vertex AI and Google AI Studio)
    const result = await aiProvider.client.generateContent({
      model: GEMINI_3_MODEL,
      systemInstruction: fullSystemPrompt,
      contents: [
        ...messageHistory.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: userMessage }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    // Extract response text with fallback (matching other files' pattern)
    response = result.response?.text?.() || 
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    
    console.log(`✅ [INSTAGRAM] AI response generated: ${response ? response.substring(0, 50) + '...' : 'null'}`);

    // Clean up response (remove markdown, actions, etc.)
    if (response) {
      response = cleanAIResponse(response);
    }

    return response;
  } catch (error) {
    console.error("❌ [INSTAGRAM] Error generating AI response:", error);
    return null;
  }
}

/**
 * Clean AI response for Instagram
 */
function cleanAIResponse(text: string): string {
  let cleaned = text;

  // Remove [ACTIONS] sections
  cleaned = cleaned.replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, "");
  cleaned = cleaned.replace(/\{"actions":\s*\[[\s\S]*?\]\}/gi, "");
  cleaned = cleaned.replace(/\[\/ACTIONS\]/gi, "");

  // Remove bold markers
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, "$1");

  // Convert list markers
  cleaned = cleaned.replace(/^\s*\*\s+/gm, "- ");

  // Clean up whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Split message into chunks respecting Instagram's 1000 char limit
 * Tries to split at sentence boundaries for natural reading
 */
function splitMessageForInstagram(text: string, maxLength: number = 950): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining.trim());
      break;
    }

    // Try to find a good breaking point (sentence end, paragraph, or word boundary)
    let breakPoint = maxLength;
    
    // Try to break at paragraph first
    const paragraphBreak = remaining.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak > maxLength * 0.5) {
      breakPoint = paragraphBreak;
    } else {
      // Try to break at sentence end
      const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
      let bestBreak = -1;
      for (const ender of sentenceEnders) {
        const pos = remaining.lastIndexOf(ender, maxLength);
        if (pos > bestBreak && pos > maxLength * 0.3) {
          bestBreak = pos + ender.length - 1;
        }
      }
      if (bestBreak > 0) {
        breakPoint = bestBreak;
      } else {
        // Fall back to word boundary
        const spaceBreak = remaining.lastIndexOf(' ', maxLength);
        if (spaceBreak > maxLength * 0.5) {
          breakPoint = spaceBreak;
        }
      }
    }

    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks;
}

/**
 * Send response via Meta Graph API
 * In Dry Run mode: logs the message, saves to DB with isDryRun metadata, but doesn't actually send
 */
async function sendInstagramResponse(
  config: typeof consultantInstagramConfig.$inferSelect,
  consultant: typeof users.$inferSelect,
  conversation: typeof instagramConversations.$inferSelect,
  responseText: string,
  canUseHumanAgentTag: boolean
): Promise<void> {
  // Dry Run Mode - detailed logging without sending
  if (config.isDryRun) {
    console.log(`\n🧪 ======================= DRY RUN MODE =======================`);
    console.log(`📍 [INSTAGRAM DRY RUN] Conversation: ${conversation.id}`);
    console.log(`👤 [INSTAGRAM DRY RUN] To User: ${conversation.instagramUserId} (@${conversation.instagramUsername || 'unknown'})`);
    console.log(`💬 [INSTAGRAM DRY RUN] Message that WOULD be sent:`);
    console.log(`────────────────────────────────────────────────────────────────`);
    console.log(responseText);
    console.log(`────────────────────────────────────────────────────────────────`);
    console.log(`🏷️ [INSTAGRAM DRY RUN] Would use HUMAN_AGENT tag: ${canUseHumanAgentTag && conversation.overriddenAt !== null}`);
    console.log(`📊 [INSTAGRAM DRY RUN] Message length: ${responseText.length} chars`);
    console.log(`🧪 ============================================================\n`);

    // Save message to database with dry run indicator in metadata
    await db.insert(instagramMessages).values({
      conversationId: conversation.id,
      messageText: responseText,
      direction: "outbound",
      sender: "ai",
      mediaType: "text",
      instagramMessageId: `dry_run_${Date.now()}`,
      metaStatus: "dry_run",
      metadata: { isDryRun: true, simulatedAt: new Date().toISOString() },
      sentAt: new Date(),
      createdAt: new Date(),
    });

    // Update conversation stats (even in dry run for testing)
    await db
      .update(instagramConversations)
      .set({
        messageCount: sql`${instagramConversations.messageCount} + 1`,
        lastMessageAt: new Date(),
        lastMessageFrom: "ai",
        updatedAt: new Date(),
      })
      .where(eq(instagramConversations.id, conversation.id));

    console.log(`✅ [INSTAGRAM DRY RUN] Message saved to DB with isDryRun flag. No actual message sent.`);
    return;
  }

  // Normal Mode - Actually send the message
  // Decrypt page access token
  let pageAccessToken = config.pageAccessToken;
  if (pageAccessToken && consultant.encryptionSalt) {
    try {
      pageAccessToken = decryptForConsultant(pageAccessToken, consultant.encryptionSalt);
    } catch (e) {
      console.log("🔓 [INSTAGRAM] Token not encrypted, using as-is");
    }
  }

  if (!pageAccessToken || !config.facebookPageId) {
    console.error("❌ [INSTAGRAM] Missing page access token or Facebook page ID");
    return;
  }

  // Create Meta client - use Facebook Page ID for the endpoint (NOT Instagram Account ID)
  // Instagram Messaging API requires: POST /{facebook-page-id}/messages
  const client = createMetaClient({
    pageAccessToken,
    instagramPageId: config.facebookPageId, // Must be Facebook Page ID, not Instagram Account ID!
    isDryRun: false,
  });

  // Split message if too long (Instagram limit: 1000 chars)
  const messageChunks = splitMessageForInstagram(responseText, 950);
  console.log(`📨 [INSTAGRAM] Sending ${messageChunks.length} message chunk(s) (total: ${responseText.length} chars)`);

  let lastMessageId: string | null = null;
  const useHumanTag = canUseHumanAgentTag && conversation.overriddenAt !== null;

  // Send each chunk
  for (let i = 0; i < messageChunks.length; i++) {
    const chunk = messageChunks[i];
    
    // Small delay between messages to avoid rate limiting
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const result = await client.sendMessage(
      conversation.instagramUserId,
      chunk,
      { useHumanAgentTag: useHumanTag }
    );

    if (!result) {
      console.error(`❌ [INSTAGRAM] Failed to send message chunk ${i + 1}/${messageChunks.length}`);
      continue;
    }

    lastMessageId = result.message_id;

    // Save each chunk to database
    await db.insert(instagramMessages).values({
      conversationId: conversation.id,
      messageText: chunk,
      direction: "outbound",
      sender: "ai",
      mediaType: "text",
      instagramMessageId: result.message_id,
      metaStatus: "sent",
      sentAt: new Date(),
      createdAt: new Date(),
    });

    console.log(`✅ [INSTAGRAM] Sent chunk ${i + 1}/${messageChunks.length}: ${result.message_id}`);
  }

  if (!lastMessageId) {
    console.error("❌ [INSTAGRAM] All message chunks failed to send");
    return;
  }

  // Update conversation stats (count as 1 response even if multiple chunks)
  await db
    .update(instagramConversations)
    .set({
      messageCount: sql`${instagramConversations.messageCount} + 1`,
      lastMessageAt: new Date(),
      lastMessageFrom: "ai",
      updatedAt: new Date(),
    })
    .where(eq(instagramConversations.id, conversation.id));

  console.log(`📤 [INSTAGRAM] Sent response to ${conversation.instagramUserId}: ${lastMessageId}`);
}

/**
 * Mark pending messages as processed
 */
async function markPendingMessagesProcessed(conversationId: string): Promise<void> {
  await db
    .update(instagramPendingMessages)
    .set({ processedAt: new Date() })
    .where(
      and(
        eq(instagramPendingMessages.conversationId, conversationId),
        isNull(instagramPendingMessages.processedAt)
      )
    );
}

/**
 * Process a single Instagram message (for external calls)
 */
export async function processInstagramMessage(
  conversationId: string,
  agentConfigId: string,
  consultantId: string
): Promise<void> {
  return processInstagramConversation(conversationId, agentConfigId, consultantId);
}
