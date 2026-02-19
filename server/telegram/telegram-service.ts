import { db } from "../db";
import { sql } from "drizzle-orm";

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function setTelegramWebhook(botToken: string, webhookUrl: string, secretToken?: string): Promise<boolean> {
  try {
    const body: any = {
      url: webhookUrl,
      allowed_updates: ["message", "channel_post"],
    };
    if (secretToken) {
      body.secret_token = secretToken;
    }
    const res = await fetch(`${TELEGRAM_API}${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log(`[TELEGRAM] setWebhook result:`, data);
    return data.ok === true;
  } catch (err: any) {
    console.error(`[TELEGRAM] setWebhook error:`, err.message);
    return false;
  }
}

export async function removeTelegramWebhook(botToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/deleteWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    const data = await res.json();
    console.log(`[TELEGRAM] deleteWebhook result:`, data);
    return data.ok === true;
  } catch (err: any) {
    console.error(`[TELEGRAM] deleteWebhook error:`, err.message);
    return false;
  }
}

export async function getBotInfo(botToken: string): Promise<{ ok: boolean; username?: string; firstName?: string; error?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/getMe`);
    const data = await res.json();
    if (data.ok) {
      return {
        ok: true,
        username: data.result.username,
        firstName: data.result.first_name,
      };
    }
    return { ok: false, error: data.description || "Unknown error" };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

function splitMessage(text: string, maxLength: number = 4096): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt < maxLength * 0.3) splitAt = remaining.lastIndexOf(' ', maxLength);
    if (splitAt < maxLength * 0.3) splitAt = maxLength;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trimStart();
  }
  return chunks;
}

export async function sendTelegramMessage(botToken: string, chatId: number | string, text: string, parseMode?: string): Promise<boolean> {
  try {
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      const body: any = { chat_id: chatId, text: chunk };
      if (parseMode) body.parse_mode = parseMode;

      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.ok) {
        if (parseMode === "Markdown" || parseMode === "MarkdownV2") {
          console.warn(`[TELEGRAM] Markdown send failed, retrying without parse_mode:`, data.description);
          const retryRes = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: chunk }),
          });
          const retryData = await retryRes.json();
          if (!retryData.ok) {
            console.error(`[TELEGRAM] sendMessage retry failed:`, retryData.description);
            return false;
          }
        } else {
          console.error(`[TELEGRAM] sendMessage failed:`, data.description);
          return false;
        }
      }
    }
    return true;
  } catch (err: any) {
    console.error(`[TELEGRAM] sendMessage error:`, err.message);
    return false;
  }
}

export async function processIncomingTelegramMessage(update: any, configId: string): Promise<void> {
  const msg = update.message || update.channel_post;
  if (!msg) {
    console.log(`[TELEGRAM] Update has no message, skipping. Type: ${Object.keys(update).join(', ')}`);
    return;
  }

  const chatId = msg.chat.id;
  const text = msg.text;
  const chatType = msg.chat.type;
  const fromUser = msg.from;
  const username = fromUser?.username || '';
  const firstName = fromUser?.first_name || '';
  const chatTitle = msg.chat.title || '';

  if (!text) {
    console.log(`[TELEGRAM] Non-text message from chat ${chatId}, skipping`);
    return;
  }

  console.log(`[TELEGRAM] Incoming message from chat ${chatId} (${chatType}): "${text.substring(0, 100)}"`);

  const configResult = await db.execute(sql`
    SELECT id, consultant_id, ai_role, bot_token, bot_username, enabled, group_support
    FROM telegram_bot_configs
    WHERE id = ${parseInt(configId)} AND enabled = true
    LIMIT 1
  `);

  if (configResult.rows.length === 0) {
    console.warn(`[TELEGRAM] No active config found for configId ${configId}`);
    return;
  }

  const config = configResult.rows[0] as any;
  const botUsername = config.bot_username || '';
  const botToken = config.bot_token;
  const consultantId = config.consultant_id;
  const aiRole = config.ai_role;

  const isGroupChat = chatType === 'group' || chatType === 'supergroup';
  if (isGroupChat) {
    if (!config.group_support) {
      console.log(`[TELEGRAM] Group support disabled for config ${configId}, ignoring`);
      return;
    }
    const mentionPattern = new RegExp(`@${botUsername}\\b`, 'i');
    if (!mentionPattern.test(text)) {
      return;
    }
  }

  let processedText = text;
  if (isGroupChat && botUsername) {
    processedText = text.replace(new RegExp(`@${botUsername}\\b`, 'gi'), '').trim();
  }

  if (!processedText) {
    console.log(`[TELEGRAM] Empty message after mention removal, skipping`);
    return;
  }

  const linkResult = await db.execute(sql`
    SELECT id, consultant_id, ai_role FROM telegram_chat_links
    WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId} AND active = true
    LIMIT 1
  `);

  if (linkResult.rows.length === 0) {
    console.log(`[TELEGRAM] No chat link found, auto-creating for chat ${chatId}`);
    try {
      await db.execute(sql`
        INSERT INTO telegram_chat_links (consultant_id, ai_role, telegram_chat_id, chat_type, chat_title, username, first_name, active)
        VALUES (${consultantId}::uuid, ${aiRole}, ${chatId}, ${chatType}, ${chatTitle || null}, ${username || null}, ${firstName || null}, true)
        ON CONFLICT (consultant_id, ai_role, telegram_chat_id) DO UPDATE SET
          active = true,
          chat_type = EXCLUDED.chat_type,
          chat_title = EXCLUDED.chat_title,
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name
      `);
    } catch (linkErr: any) {
      console.error(`[TELEGRAM] Error creating chat link:`, linkErr.message);
    }
  }

  try {
    const roleName = aiRole;
    const telegramMetadata = JSON.stringify({ source: "telegram", telegram_chat_id: chatId });
    await db.execute(sql`
      INSERT INTO agent_chat_messages (consultant_id, ai_role, role_name, sender, message, metadata)
      VALUES (${consultantId}::uuid, ${aiRole}, ${roleName}, 'consultant', ${processedText.trim()}, ${telegramMetadata}::jsonb)
    `);

    const { processAgentChatInternal } = await import("../routes/ai-autonomy-router");
    const aiResponse = await processAgentChatInternal(consultantId, aiRole, processedText, {
      skipUserMessageInsert: true,
      metadata: { source: "telegram", telegram_chat_id: chatId },
    });

    await sendTelegramMessage(botToken, chatId, aiResponse, "Markdown");
    console.log(`[TELEGRAM] Response sent to chat ${chatId} for role ${aiRole}`);
  } catch (err: any) {
    console.error(`[TELEGRAM] Error processing message:`, err.message);
    await sendTelegramMessage(botToken, chatId, "⚠️ Mi dispiace, c'è stato un errore. Riprova tra poco.");
  }
}
