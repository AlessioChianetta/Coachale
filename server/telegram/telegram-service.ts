import { db } from "../db";
import { sql } from "drizzle-orm";

const TELEGRAM_API = "https://api.telegram.org/bot";

const gatekeeperChatHistory = new Map<string, { role: string; text: string; ts: number }[]>();
const GATEKEEPER_MAX_MESSAGES = 20;
const GATEKEEPER_TTL_MS = 30 * 60 * 1000;

function getGatekeeperHistory(chatId: string): { role: string; text: string }[] {
  const key = chatId;
  const history = gatekeeperChatHistory.get(key) || [];
  const now = Date.now();
  const valid = history.filter(m => now - m.ts < GATEKEEPER_TTL_MS);
  if (valid.length !== history.length) gatekeeperChatHistory.set(key, valid);
  return valid.map(m => ({ role: m.role, text: m.text }));
}

function addGatekeeperMessage(chatId: string, role: "user" | "model", text: string) {
  const key = chatId;
  if (!gatekeeperChatHistory.has(key)) gatekeeperChatHistory.set(key, []);
  const history = gatekeeperChatHistory.get(key)!;
  history.push({ role, text, ts: Date.now() });
  if (history.length > GATEKEEPER_MAX_MESSAGES) {
    history.splice(0, history.length - GATEKEEPER_MAX_MESSAGES);
  }
}

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

  const activateMatch = text.match(/^\/attiva\s+(\w+)$/i);
  if (activateMatch) {
    const code = activateMatch[1].toUpperCase();
    const codeCheck = await db.execute(sql`
      SELECT activation_code FROM telegram_bot_configs 
      WHERE id = ${parseInt(configId)} AND activation_code = ${code}
      LIMIT 1
    `);
    if (codeCheck.rows.length > 0) {
      await db.execute(sql`
        INSERT INTO telegram_chat_links (consultant_id, ai_role, telegram_chat_id, chat_type, chat_title, username, first_name, active, is_owner)
        VALUES (${consultantId}::uuid, ${aiRole}, ${chatId}, ${chatType}, ${chatTitle || null}, ${username || null}, ${firstName || null}, true, true)
        ON CONFLICT (consultant_id, ai_role, telegram_chat_id) DO UPDATE SET
          active = true, is_owner = true,
          chat_type = EXCLUDED.chat_type, chat_title = EXCLUDED.chat_title,
          username = EXCLUDED.username, first_name = EXCLUDED.first_name
      `);
      const { randomBytes } = await import("crypto");
      const newCode = randomBytes(3).toString('hex').toUpperCase();
      await db.execute(sql`
        UPDATE telegram_bot_configs SET activation_code = ${newCode}, updated_at = NOW()
        WHERE id = ${parseInt(configId)}
      `);
      await sendTelegramMessage(botToken, chatId, "✅ Attivazione riuscita! Ora puoi usare questo bot normalmente.");
      return;
    } else {
      await sendTelegramMessage(botToken, chatId, "❌ Codice di attivazione non valido.");
      return;
    }
  }

  const ownerCheck = await db.execute(sql`
    SELECT id FROM telegram_chat_links
    WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId} AND is_owner = true AND active = true
    LIMIT 1
  `);

  if (ownerCheck.rows.length === 0) {
    console.log(`[TELEGRAM] Unauthorized access from chat ${chatId}, sending friendly gatekeeper response`);
    try {
      const roleName = aiRole.charAt(0).toUpperCase() + aiRole.slice(1);
      const { GoogleGenAI } = await import("@google/genai");
      const { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } = await import("../ai/provider-factory");
      const apiKey = await getGeminiApiKeyForClassifier();
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const systemPrompt = `Sei ${roleName}, assistente personale di un consulente finanziario. Lavori come se fossi un vero membro del team — una persona reale, non un bot o un'intelligenza artificiale.

REGOLE FONDAMENTALI:
- NON dire MAI che sei un bot, un'AI, un assistente artificiale o automatico
- NON dire MAI "sono un assistente AI" o simili — tu sei ${roleName}, punto
- Comportati come un essere umano: una persona dello staff che gestisce i messaggi
- Rispondi in modo DIVERSO ogni volta, mai la stessa frase due volte
- Usa un tono naturale, colloquiale, come parleresti su WhatsApp con un conoscente
- Sii caloroso/a ma professionale, come chi lavora in un'azienda moderna
- Max 2-3 righe, scrivi come una persona vera (no elenchi, no frasi fatte)
- Hai MEMORIA della conversazione: ricordi cosa ti hanno detto prima e non ripeti le stesse cose
- Se hai già spiegato come attivare l'accesso, NON ripeterlo — rispondi normalmente alla conversazione

COSA DEVI COMUNICARE (solo la PRIMA volta o se ha senso ripeterlo):
- Che al momento gestisci le comunicazioni solo per i clienti del consulente
- Che se sono interessati, possono chiedere al consulente il codice di accesso
- Che una volta ricevuto basta scrivere /attiva e il codice

Reagisci al CONTENUTO del messaggio (es. se dicono "ciao" saluta, se chiedono "cosa fai" spiega chi sei, se ringraziano rispondi con calore, se fanno domande specifiche rispondi come meglio puoi).

Rispondi in italiano. Scrivi come una persona vera su Telegram.`;

        const previousMessages = getGatekeeperHistory(chatId);
        const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

        contents.push({ role: "user", parts: [{ text: systemPrompt }] });
        contents.push({ role: "model", parts: [{ text: "Capito, sono pronto a rispondere come " + roleName + "." }] });

        for (const msg of previousMessages) {
          contents.push({ role: msg.role, parts: [{ text: msg.text }] });
        }

        contents.push({ role: "user", parts: [{ text: text.substring(0, 500) }] });

        const result = await trackedGenerateContent(ai, {
          model: GEMINI_3_MODEL,
          contents,
          config: { temperature: 1 },
        }, {
          consultantId,
          feature: "telegram_gatekeeper",
          keySource: "superadmin",
          callerRole: "consultant",
        });
        const aiReply = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiReply) {
          addGatekeeperMessage(chatId, "user", text.substring(0, 500));
          addGatekeeperMessage(chatId, "model", aiReply);
          await sendTelegramMessage(botToken, chatId, aiReply);
          return;
        }
      }
    } catch (gatekeeperErr: any) {
      console.error(`[TELEGRAM] Gatekeeper AI error:`, gatekeeperErr.message);
    }
    await sendTelegramMessage(botToken, chatId, `Ciao! Sono ${aiRole.charAt(0).toUpperCase() + aiRole.slice(1)} 👋 Al momento seguo solo i clienti del consulente. Se ti interessa, chiedigli il codice di accesso e poi scrivimi /attiva seguito dal codice!`);
    return;
  }

  let processedText = text;
  if (isGroupChat && botUsername) {
    processedText = text.replace(new RegExp(`@${botUsername}\\b`, 'gi'), '').trim();
  }

  if (!processedText) {
    console.log(`[TELEGRAM] Empty message after mention removal, skipping`);
    return;
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
