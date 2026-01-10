import twilio from "twilio";
import { db } from "../db";
import { consultantWhatsappConfig, whatsappMessages, whatsappPendingMessages, whatsappConversations } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { scheduleMessageProcessing } from "./message-processor";

/**
 * Split long message into chunks under MAX_CHARS, respecting sentence boundaries
 */
function chunkMessage(text: string, maxChars: number = 3000): string[] {
  // If message is short enough, return as-is
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    if (remainingText.length <= maxChars) {
      chunks.push(remainingText);
      break;
    }

    // Find a good breaking point (prefer paragraph > sentence > word)
    let breakPoint = maxChars;

    // Try to break at paragraph boundary (\n\n)
    const paragraphBreak = remainingText.lastIndexOf('\n\n', maxChars);
    if (paragraphBreak > maxChars * 0.7) { // At least 70% of maxChars
      breakPoint = paragraphBreak + 2; // Include the \n\n
    } else {
      // Try to break at sentence boundary (. or ! or ?)
      const sentenceBreak = Math.max(
        remainingText.lastIndexOf('. ', maxChars),
        remainingText.lastIndexOf('! ', maxChars),
        remainingText.lastIndexOf('? ', maxChars)
      );
      if (sentenceBreak > maxChars * 0.7) {
        breakPoint = sentenceBreak + 2; // Include the punctuation and space
      } else {
        // Last resort: break at word boundary
        const wordBreak = remainingText.lastIndexOf(' ', maxChars);
        if (wordBreak > maxChars * 0.5) {
          breakPoint = wordBreak + 1; // Include the space
        }
        // If no good break point, force break at maxChars
      }
    }

    chunks.push(remainingText.substring(0, breakPoint).trim());
    remainingText = remainingText.substring(breakPoint).trim();
  }

  return chunks;
}

function formatWhatsAppText(text: string): string {
  // Remove all markdown formatting and AI metadata
  let formatted = text;

  // Remove [ACTIONS] section (including JSON content)
  formatted = formatted.replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '');
  formatted = formatted.replace(/\[\/ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '');
  formatted = formatted.replace(/\{"actions":\s*\[[\s\S]*?\]\}/gi, '');
  formatted = formatted.replace(/\[\/ACTIONS\]/gi, '');

  // Remove bold markers
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '$1');

  // Convert list markers to simple dash
  formatted = formatted.replace(/^\s*\*\s+/gm, '- ');

  // Clean up any trailing whitespace
  formatted = formatted.trim();

  return formatted;
}

export async function sendWhatsAppMessage(
  consultantId: string,
  phoneNumber: string,
  messageText: string,
  messageId?: string,
  options?: {
    contentSid?: string;
    contentVariables?: Record<string, string>;
    agentConfigId?: string;
    conversationId?: string;
    mediaUrl?: string | null;
  }
): Promise<string> {
  // Intelligent agent routing:
  // 1. If agentConfigId is explicitly provided, use it (verify consultant ownership and active status)
  // 2. Else if conversationId exists, fetch and use the same agent from that conversation (verify ownership)
  // 3. Else fallback to first active agent for the consultant
  let config;
  const { and } = await import('drizzle-orm');
  
  if (options?.agentConfigId) {
    // Explicit agent specified - SECURITY: verify consultant ownership and active status
    [config] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.id, options.agentConfigId),
          eq(consultantWhatsappConfig.consultantId, consultantId),
          eq(consultantWhatsappConfig.isActive, true)
        )
      )
      .limit(1);
    
    if (!config) {
      throw new Error(`Agent ${options.agentConfigId} not found, not active, or does not belong to consultant ${consultantId}`);
    }
    
    console.log(`✅ Using explicitly specified agent: ${config.agentName} (${config.id})`);
  } else if (options?.conversationId) {
    // Fetch agent from existing conversation - SECURITY: verify conversation belongs to consultant
    const { whatsappConversations } = await import('../../shared/schema');
    const [conversation] = await db
      .select()
      .from(whatsappConversations)
      .where(
        and(
          eq(whatsappConversations.id, options.conversationId),
          eq(whatsappConversations.consultantId, consultantId)
        )
      )
      .limit(1);
    
    if (!conversation) {
      throw new Error(`Conversation ${options.conversationId} not found or does not belong to consultant ${consultantId}`);
    }
    
    if (conversation.agentConfigId) {
      // Verify agent is active and has valid credentials
      [config] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, conversation.agentConfigId),
            eq(consultantWhatsappConfig.isActive, true)
          )
        )
        .limit(1);
      
      if (config) {
        console.log(`✅ Using agent from existing conversation: ${config.agentName} (${config.id})`);
      }
    }
  }
  
  // Fallback to first active agent with valid credentials if not found yet
  if (!config) {
    [config] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.consultantId, consultantId),
          eq(consultantWhatsappConfig.isActive, true)
        )
      )
      .limit(1);
    
    if (config) {
      console.log(`⚠️  Using fallback agent (first active): ${config.agentName} (${config.id})`);
    }
  }

  if (!config) {
    throw new Error(`No active Twilio config found for consultant ${consultantId}`);
  }
  
  // Final validation: ensure Twilio credentials are present
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioWhatsappNumber) {
    throw new Error(`Agent ${config.agentName} (${config.id}) is missing required Twilio credentials`);
  }

  // Check per-agent DRY_RUN mode (default to true for safety if not configured)
  const isDryRun = config.isDryRun ?? true;
  
  if (isDryRun) {
    console.log('\n🔒 ═══════════════════════════════════════════════════════════');
    console.log(`🔒 DRY RUN MODE - Agent: ${config.agentName}`);
    console.log('🔒 No real messages will be sent (simulated only)');
    console.log('🔒 ═══════════════════════════════════════════════════════════');
  }

  // Only create Twilio client if not in dry run mode
  const client = isDryRun ? null : twilio(config.twilioAccountSid, config.twilioAuthToken);

  // Ensure phone number has whatsapp: prefix (add if not present)
  const formattedTo = phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`;
  const formattedFrom = config.twilioWhatsappNumber.startsWith('whatsapp:') 
    ? config.twilioWhatsappNumber 
    : `whatsapp:${config.twilioWhatsappNumber}`;

  // Validate From number format
  const fromNumberOnly = formattedFrom.replace('whatsapp:', '');
  if (!fromNumberOnly.startsWith('+') || fromNumberOnly.length < 10) {
    console.error(`❌ [TWILIO ERROR] Invalid From number format: ${formattedFrom}`);
    console.error(`   Agent: ${config.agentName} (${config.id})`);
    console.error(`   Expected format: whatsapp:+1234567890`);
    throw new Error(`Numero WhatsApp business non valido: "${fromNumberOnly}". Deve iniziare con + e contenere almeno 10 cifre. Verifica la configurazione dell'agente "${config.agentName}".`);
  }
  
  console.log(`📱 Using From number: ${formattedFrom} (Agent: ${config.agentName})`);

  // TEMPLATE MODE: If contentSid is provided, send with template (for proactive messages)
  if (options?.contentSid) {
    console.log(`📤 ${isDryRun ? '[DRY RUN] Would send' : 'Sending'} WhatsApp message with template: ${options.contentSid}`);
    
    if (isDryRun) {
      // DRY RUN: Log what would be sent
      console.log('📋 Template Details:');
      console.log(`   From: ${formattedFrom}`);
      console.log(`   To: ${formattedTo}`);
      console.log(`   Template SID: ${options.contentSid}`);
      console.log(`   Variables: ${JSON.stringify(options.contentVariables, null, 2)}`);
      console.log(`   Message Text (fallback): ${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}`);
      
      // Generate fake SID for testing
      const fakeSid = `DRY_RUN_TEMPLATE_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log(`✅ [DRY RUN] Simulated template message: ${fakeSid}`);
      
      // Update database as normal (for testing flow)
      if (messageId) {
        // Fetch existing message to preserve metadata
        const [existingMsg] = await db
          .select()
          .from(whatsappMessages)
          .where(eq(whatsappMessages.id, messageId))
          .limit(1);
        
        // Parse existing metadata if it's a string (Drizzle returns JSON as string)
        const existingMetadata = existingMsg?.metadata 
          ? (typeof existingMsg.metadata === 'string' 
              ? JSON.parse(existingMsg.metadata) 
              : existingMsg.metadata)
          : {};
        
        await db
          .update(whatsappMessages)
          .set({
            twilioSid: fakeSid,
            twilioStatus: 'sent',
            sentAt: new Date(),
            metadata: { 
              ...existingMetadata,
              dryRun: true,
              templateMode: true, 
              twilioSimulatedSid: fakeSid,
            },
          })
          .where(eq(whatsappMessages.id, messageId));
      }
      
      return fakeSid;
    }
    
    try {
      const message = await client!.messages.create({
        from: formattedFrom,
        to: formattedTo,
        contentSid: options.contentSid,
        contentVariables: options.contentVariables ? JSON.stringify(options.contentVariables) : undefined,
      });

      console.log(`✅ Sent template message: ${message.sid}`);

      // Update database
      if (messageId) {
        const validStatus = ["queued", "sent", "delivered", "read", "failed", "undelivered"].includes(message.status)
          ? (message.status as "queued" | "sent" | "delivered" | "read" | "failed" | "undelivered")
          : "sent";

        // Fetch existing message to preserve metadata (templateBody, etc.)
        const [existingMsg] = await db
          .select()
          .from(whatsappMessages)
          .where(eq(whatsappMessages.id, messageId))
          .limit(1);
        
        // Parse existing metadata if it's a string
        const existingMetadata = existingMsg?.metadata 
          ? (typeof existingMsg.metadata === 'string' 
              ? JSON.parse(existingMsg.metadata) 
              : existingMsg.metadata)
          : {};

        await db
          .update(whatsappMessages)
          .set({
            twilioSid: message.sid,
            twilioStatus: validStatus,
            sentAt: new Date(),
            metadata: { 
              ...existingMetadata,
              templateMode: true, 
              contentSid: options.contentSid,
              contentVariables: options.contentVariables 
            },
          })
          .where(eq(whatsappMessages.id, messageId));
      }

      return message.sid;
    } catch (error: any) {
      console.error(`❌ Template message failed: ${error.message}`);
      
      // Check if it's a "Channel not found" error (From number not configured in Twilio)
      if (error.message?.includes('Channel with the specified From address') || error.code === 21608) {
        console.error(`\n❌ ═══════════════════════════════════════════════════════════`);
        console.error(`❌ TWILIO ERROR: Numero WhatsApp Business non trovato`);
        console.error(`❌ ═══════════════════════════════════════════════════════════`);
        console.error(`   From Number: ${formattedFrom}`);
        console.error(`   Agent: ${config.agentName} (${config.id})`);
        console.error(`\n📋 POSSIBILI CAUSE:`);
        console.error(`   1. Il numero "${fromNumberOnly}" non è configurato come WhatsApp Sender in Twilio`);
        console.error(`   2. Se usi Sandbox: devi usare il numero sandbox (+14155238886)`);
        console.error(`   3. Se usi Business: il numero deve essere verificato su Twilio Console`);
        console.error(`\n🔧 COME RISOLVERE:`);
        console.error(`   - Vai su Twilio Console > Messaging > Try it out > Send a WhatsApp message`);
        console.error(`   - Verifica quale numero è configurato come "From" nel tuo account`);
        console.error(`   - Aggiorna la configurazione dell'agente con il numero corretto\n`);
        
        throw new Error(`Numero WhatsApp "${fromNumberOnly}" non configurato in Twilio. Verifica la configurazione dell'agente "${config.agentName}" e assicurati che il numero sia abilitato come WhatsApp Sender nella console Twilio.`);
      }
      
      // Check if it's a template approval error
      if (error.code === 63016 || error.message?.includes('not approved') || error.message?.includes('pending')) {
        console.error(`⚠️  Template ${options.contentSid} is NOT APPROVED by WhatsApp yet`);
        console.error(`   Error details: ${error.message}`);
        console.error(`   Falling back to plain text (will only work if 24-hour window is open)`);
        
        // Fall through to normal message sending below
      } else {
        // Other error - throw immediately
        throw error;
      }
    }
  }

  // NORMAL MODE: Send as plain text or with media (for reactive messages or template fallback)
  const hasMedia = options?.mediaUrl && options.mediaUrl !== null;
  console.log(`📤 ${isDryRun ? '[DRY RUN] Would send' : 'Sending'} WhatsApp message${hasMedia ? ' with media' : ' as plain text'}`);
  
  // Format text for WhatsApp
  const formattedText = formatWhatsAppText(messageText);

  if (isDryRun) {
    // DRY RUN: Log what would be sent
    console.log('📋 Message Details:');
    console.log(`   From: ${formattedFrom}`);
    console.log(`   To: ${formattedTo}`);
    if (hasMedia) {
      console.log(`   Media URL: ${options.mediaUrl}`);
      console.log(`   Media Type: audio/wav (TTS generated)`);
    }
    console.log(`   Text length: ${formattedText.length} chars`);
    console.log('');
    console.log('📝 Message content:');
    console.log('─'.repeat(60));
    console.log(formattedText);
    console.log('─'.repeat(60));
    
    // Generate fake SID for testing
    const fakeSid = `DRY_RUN_${hasMedia ? 'MEDIA' : 'PLAINTEXT'}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.log(`✅ [DRY RUN] Simulated ${hasMedia ? 'media' : 'plain text'} message: ${fakeSid}`);
    
    // Update database as normal (for testing flow) - preserve existing metadata
    if (messageId) {
      // Fetch existing message to preserve metadata
      const [existingMessage] = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.id, messageId))
        .limit(1);

      // Parse existing metadata if it's a string (Drizzle returns JSON as string)
      const existingMetadata = existingMessage?.metadata 
        ? (typeof existingMessage.metadata === 'string' 
            ? JSON.parse(existingMessage.metadata) 
            : existingMessage.metadata)
        : {};

      const mergedMetadata = {
        ...existingMetadata,
        dryRun: true,
        hasMedia,
      };

      await db
        .update(whatsappMessages)
        .set({
          twilioSid: fakeSid,
          twilioStatus: 'sent',
          sentAt: new Date(),
          metadata: mergedMetadata,
        })
        .where(eq(whatsappMessages.id, messageId));
    }
    
    if (isDryRun) {
      console.log('🔒 ═══════════════════════════════════════════════════════════');
      console.log('');
    }
    
    return fakeSid;
  }

  // MEDIA MODE: Send with media (audio file)
  if (hasMedia) {
    console.log(`🎙️ Sending WhatsApp media message with audio file`);
    
    // Convert relative URL to absolute URL for Twilio
    // Priority: PUBLIC_BASE_URL > Replit domains > error
    let baseUrl: string;
    
    if (process.env.PUBLIC_BASE_URL) {
      // Use configured public URL (for custom domains or non-Replit deployments)
      baseUrl = process.env.PUBLIC_BASE_URL;
    } else if (process.env.REPLIT_DOMAINS) {
      // Use Replit's public domain (comma-separated list, take first)
      const domains = process.env.REPLIT_DOMAINS.split(',')[0].trim();
      baseUrl = `https://${domains}`;
    } else if (process.env.REPL_ID) {
      // Fallback to old Replit URL format
      baseUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    } else {
      // Error: cannot build public URL for Twilio
      throw new Error(
        'Cannot send audio to Twilio: no PUBLIC_BASE_URL or REPLIT_DOMAINS found. ' +
        'Set PUBLIC_BASE_URL environment variable to your public deployment URL.'
      );
    }
    
    const absoluteMediaUrl = options.mediaUrl!.startsWith('http') 
      ? options.mediaUrl 
      : `${baseUrl}${options.mediaUrl}`;
    
    console.log(`📎 Media URL: ${absoluteMediaUrl}`);

    const message = await client!.messages.create({
      from: formattedFrom,
      to: formattedTo,
      mediaUrl: [absoluteMediaUrl],
    });

    console.log(`✅ Sent WhatsApp media message: ${message.sid}`);

    // Update database - merge with existing metadata to preserve audio generation info
    if (messageId) {
      const validStatus = ["queued", "sent", "delivered", "read", "failed", "undelivered"].includes(message.status)
        ? (message.status as "queued" | "sent" | "delivered" | "read" | "failed" | "undelivered")
        : "sent";

      // Fetch existing message to preserve metadata
      const [existingMessage] = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.id, messageId))
        .limit(1);

      // Parse existing metadata if it's a string (Drizzle returns JSON as string)
      const existingMetadata = existingMessage?.metadata 
        ? (typeof existingMessage.metadata === 'string' 
            ? JSON.parse(existingMessage.metadata) 
            : existingMessage.metadata)
        : {};

      const mergedMetadata = {
        ...existingMetadata,
        twilioSent: true,
        twilioMediaUrl: absoluteMediaUrl,
      };

      await db
        .update(whatsappMessages)
        .set({
          twilioSid: message.sid,
          twilioStatus: validStatus,
          sentAt: new Date(),
          metadata: mergedMetadata,
        })
        .where(eq(whatsappMessages.id, messageId));
    }

    return message.sid;
  }

  // TEXT MODE: Send as plain text with chunking if needed
  const chunks = chunkMessage(formattedText, 1500);

  if (chunks.length > 1) {
    console.log(`📨 Message too long (${messageText.length} chars) - splitting into ${chunks.length} chunks`);
  }

  // Send all chunks sequentially
  const messageSids: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isLastChunk = i === chunks.length - 1;

    // Add part indicator for multi-part messages (except last one)
    const bodyText = chunks.length > 1 && !isLastChunk
      ? `${chunk}\n\n[continua...${i + 1}/${chunks.length}]`
      : chunk;

    const message = await client!.messages.create({
      from: formattedFrom,
      to: formattedTo,
      body: bodyText,
    });

    messageSids.push(message.sid);
    console.log(`✅ Sent WhatsApp message chunk ${i + 1}/${chunks.length}: ${message.sid} (${bodyText.length} chars)`);

    // Small delay between chunks to ensure correct order
    if (!isLastChunk) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Update database with FIRST message SID only (for tracking)
    if (messageId && i === 0) {
      const validStatus = ["queued", "sent", "delivered", "read", "failed", "undelivered"].includes(message.status)
        ? (message.status as "queued" | "sent" | "delivered" | "read" | "failed" | "undelivered")
        : "sent";

      await db
        .update(whatsappMessages)
        .set({
          twilioSid: message.sid,
          twilioStatus: validStatus,
          sentAt: new Date(),
          metadata: chunks.length > 1 ? { chunked: true, totalChunks: chunks.length } : null,
        })
        .where(eq(whatsappMessages.id, messageId));
    }
  }

  return messageSids[0]; // Return first SID for backward compatibility
}

export async function getTwilioClient(consultantId: string) {
  const [config] = await db
    .select()
    .from(consultantWhatsappConfig)
    .where(eq(consultantWhatsappConfig.consultantId, consultantId))
    .limit(1);

  if (!config) {
    throw new Error(`No Twilio config found for consultant ${consultantId}`);
  }

  return twilio(config.twilioAccountSid, config.twilioAuthToken);
}

/**
 * Fetches the body text of a Twilio WhatsApp template by its Content SID (HX...).
 * This retrieves the actual template content from Twilio API with retry logic.
 * 
 * @param twilioAccountSid - Twilio Account SID
 * @param twilioAuthToken - Twilio Auth Token
 * @param contentSid - The template Content SID (starts with HX)
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @returns The template body text or null if not found/error
 */
export async function fetchTwilioTemplateBody(
  twilioAccountSid: string,
  twilioAuthToken: string,
  contentSid: string,
  maxRetries: number = 2
): Promise<string | null> {
  if (!twilioAccountSid || !twilioAuthToken || !contentSid) {
    console.warn(`⚠️ [TWILIO] Missing credentials or contentSid for template fetch`);
    return null;
  }

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      const content = await twilioClient.content.v1.contents(contentSid).fetch();
      
      // Extract body text from WhatsApp template structure
      const whatsappTemplate = content.types?.['twilio/whatsapp']?.template;
      if (whatsappTemplate?.components) {
        const bodyComponent = whatsappTemplate.components.find(
          (comp: any) => comp.type === 'BODY'
        );
        if (bodyComponent?.text) {
          return bodyComponent.text;
        }
      }
      
      // Fallback to text body if available
      if (content.types?.['twilio/text']?.body) {
        return content.types['twilio/text'].body;
      }
      
      // Template found but no body - this is not a retry-able error
      console.warn(`⚠️ [TWILIO] Template ${contentSid} exists but has no body text`);
      return null;
      
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on auth errors (401, 403) or not found (404)
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        console.warn(`⚠️ [TWILIO] Template ${contentSid} fetch failed (${error.status}): ${error.message}`);
        return null;
      }
      
      // Retry on rate limits (429) or server errors (5xx)
      if (attempt <= maxRetries) {
        const waitMs = Math.min(500 * Math.pow(2, attempt - 1), 2000);
        console.log(`⏳ [TWILIO] Retry ${attempt}/${maxRetries} for ${contentSid} after ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }
  
  console.error(`❌ [TWILIO] Failed to fetch template ${contentSid} after ${maxRetries + 1} attempts: ${lastError?.message}`);
  return null;
}

/**
 * Fetches template bodies for multiple Content SIDs in parallel.
 * More efficient than calling fetchTwilioTemplateBody for each one.
 * 
 * @param twilioAccountSid - Twilio Account SID
 * @param twilioAuthToken - Twilio Auth Token
 * @param contentSids - Array of template Content SIDs
 * @returns Map of contentSid -> bodyText
 */
export async function fetchMultipleTwilioTemplateBodies(
  twilioAccountSid: string,
  twilioAuthToken: string,
  contentSids: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  if (!twilioAccountSid || !twilioAuthToken || contentSids.length === 0) {
    return results;
  }

  const fetchPromises = contentSids.map(async (sid) => {
    const body = await fetchTwilioTemplateBody(twilioAccountSid, twilioAuthToken, sid);
    if (body) {
      results.set(sid, body);
    }
  });

  await Promise.all(fetchPromises);
  return results;
}
