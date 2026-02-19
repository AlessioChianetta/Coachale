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

const PRIVATE_ONBOARDING_QUESTIONS = [
  { step: 0, field: 'user_name', fallback: 'Ciao! 👋 Per conoscerti meglio, come ti chiami?' },
  { step: 1, field: 'user_job', fallback: 'Piacere! Che lavoro fai?' },
  { step: 2, field: 'user_goals', fallback: 'Interessante! Quali sono i tuoi obiettivi principali?' },
  { step: 3, field: 'user_desires', fallback: 'Perfetto! Cosa desideri raggiungere?' },
];

const GROUP_ONBOARDING_QUESTIONS = [
  { step: 0, field: 'group_context', fallback: 'Ciao a tutti! 👋 Di cosa si occupa questo gruppo?' },
  { step: 1, field: 'group_members', fallback: 'Capito! Chi sono i membri principali?' },
  { step: 2, field: 'group_objectives', fallback: 'Ottimo! Quali sono gli obiettivi del gruppo?' },
];

const PRIVATE_QUESTION_PROMPTS = [
  "Come ti chiami?",
  "Che lavoro fai?",
  "Quali sono i tuoi obiettivi principali?",
  "Cosa desideri raggiungere?",
];

const GROUP_QUESTION_PROMPTS = [
  "Di cosa si occupa questo gruppo?",
  "Chi sono i membri principali?",
  "Quali sono gli obiettivi del gruppo?",
];

async function generatePersonalityQuestion(
  aiRole: string,
  questionPrompt: string,
  fallbackText: string,
  consultantId: string,
  stepIndex: number,
  isFirstMessage: boolean
): Promise<string> {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } = await import("../ai/provider-factory");
    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) return fallbackText;

    const ai = new GoogleGenAI({ apiKey });
    const roleName = aiRole.charAt(0).toUpperCase() + aiRole.slice(1);

    const systemPrompt = `Sei ${roleName}. Devi formulare una domanda di onboarding con il tuo stile personale.
La domanda base è: "${questionPrompt}"
${isFirstMessage ? 'Questo è il primo messaggio — presentati brevemente e fai la domanda.' : 'Hai già parlato con questa persona — fai la domanda in modo naturale.'}

REGOLE:
- Scrivi SOLO la domanda riformulata nel tuo stile, max 2-3 righe
- NON dire che sei un bot o un'AI
- Sii naturale e colloquiale come su Telegram
- Usa emoji con moderazione
- Rispondi in italiano`;

    const result = await trackedGenerateContent(ai, {
      model: GEMINI_3_MODEL,
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      config: { temperature: 0.9 },
    }, {
      consultantId,
      feature: "telegram_onboarding",
      keySource: "superadmin",
      callerRole: "consultant",
    });

    const aiText = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text;
    return aiText || fallbackText;
  } catch (err: any) {
    console.error(`[TELEGRAM-ONBOARDING] AI question generation error:`, err.message);
    return fallbackText;
  }
}

async function generateWelcomeMessage(
  aiRole: string,
  consultantId: string,
  isGroup: boolean,
  profileSummary: string
): Promise<string> {
  const fallback = isGroup
    ? "✅ Perfetto, ora conosco meglio il gruppo! Sono pronto ad aiutarvi. Scrivetemi quando volete!"
    : "✅ Grazie per le informazioni! Ora ti conosco meglio e posso aiutarti al meglio. Scrivimi quando vuoi!";
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } = await import("../ai/provider-factory");
    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) return fallback;

    const ai = new GoogleGenAI({ apiKey });
    const roleName = aiRole.charAt(0).toUpperCase() + aiRole.slice(1);

    const systemPrompt = `Sei ${roleName}. L'onboarding è appena terminato. Hai raccolto queste informazioni:
${profileSummary}

Scrivi un breve messaggio di benvenuto (max 3-4 righe) nel tuo stile personale.
- Ringrazia per le informazioni
- Digli che sei pronto ad aiutarlo/aiutarli
- NON dire che sei un bot o AI
- Sii naturale e caloroso
- Rispondi in italiano`;

    const result = await trackedGenerateContent(ai, {
      model: GEMINI_3_MODEL,
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      config: { temperature: 0.9 },
    }, {
      consultantId,
      feature: "telegram_onboarding",
      keySource: "superadmin",
      callerRole: "consultant",
    });

    const aiText = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text;
    return aiText || fallback;
  } catch (err: any) {
    console.error(`[TELEGRAM-ONBOARDING] Welcome message generation error:`, err.message);
    return fallback;
  }
}

async function handleOpenModeOnboarding(
  consultantId: string,
  aiRole: string,
  chatId: number,
  chatType: string,
  text: string,
  botToken: string,
  botUsername: string,
  firstName: string,
  username: string,
  chatTitle: string,
  isGroupChat: boolean
): Promise<'handled' | 'completed' | 'not_applicable'> {
  try {
    const profileResult = await db.execute(sql`
      SELECT id, onboarding_status, onboarding_step, user_name, user_job, user_goals, user_desires,
             group_context, group_members, group_objectives
      FROM telegram_user_profiles
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId}
      LIMIT 1
    `);

    const questions = isGroupChat ? GROUP_ONBOARDING_QUESTIONS : PRIVATE_ONBOARDING_QUESTIONS;
    const questionPrompts = isGroupChat ? GROUP_QUESTION_PROMPTS : PRIVATE_QUESTION_PROMPTS;
    const maxSteps = questions.length;

    if (profileResult.rows.length === 0) {
      console.log(`[TELEGRAM-ONBOARDING] New ${isGroupChat ? 'group' : 'private'} chat ${chatId}, starting onboarding`);

      await db.execute(sql`
        INSERT INTO telegram_user_profiles (consultant_id, ai_role, telegram_chat_id, chat_type, onboarding_status, onboarding_step, first_name, username)
        VALUES (${consultantId}::uuid, ${aiRole}, ${chatId}, ${chatType}, 'in_onboarding', 0, ${firstName || null}, ${username || null})
        ON CONFLICT (consultant_id, ai_role, telegram_chat_id) DO UPDATE SET
          onboarding_status = 'in_onboarding', onboarding_step = 0, updated_at = NOW()
      `);

      await db.execute(sql`
        INSERT INTO telegram_chat_links (consultant_id, ai_role, telegram_chat_id, chat_type, chat_title, username, first_name, active, is_owner)
        VALUES (${consultantId}::uuid, ${aiRole}, ${chatId}, ${chatType}, ${chatTitle || null}, ${username || null}, ${firstName || null}, true, false)
        ON CONFLICT (consultant_id, ai_role, telegram_chat_id) DO UPDATE SET
          active = true, chat_type = EXCLUDED.chat_type, chat_title = EXCLUDED.chat_title,
          username = EXCLUDED.username, first_name = EXCLUDED.first_name
      `);

      const question = await generatePersonalityQuestion(
        aiRole, questionPrompts[0], questions[0].fallback, consultantId, 0, true
      );
      await sendTelegramMessage(botToken, chatId, question);
      return 'handled';
    }

    const profile = profileResult.rows[0] as any;

    if (profile.onboarding_status === 'completed') {
      const linkCheck = await db.execute(sql`
        SELECT id FROM telegram_chat_links
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId} AND active = true
        LIMIT 1
      `);
      if (linkCheck.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO telegram_chat_links (consultant_id, ai_role, telegram_chat_id, chat_type, chat_title, username, first_name, active, is_owner)
          VALUES (${consultantId}::uuid, ${aiRole}, ${chatId}, ${chatType}, ${chatTitle || null}, ${username || null}, ${firstName || null}, true, false)
          ON CONFLICT (consultant_id, ai_role, telegram_chat_id) DO UPDATE SET
            active = true, chat_type = EXCLUDED.chat_type, chat_title = EXCLUDED.chat_title,
            username = EXCLUDED.username, first_name = EXCLUDED.first_name
        `);
        console.log(`[TELEGRAM-ONBOARDING] Re-linked chat ${chatId} for completed profile`);
      }
      return 'completed';
    }

    if (profile.onboarding_status === 'in_onboarding') {
      const currentStep = profile.onboarding_step || 0;
      const answer = text.trim().substring(0, 1000);

      const currentQuestion = questions[currentStep];
      if (currentQuestion) {
        const fieldName = currentQuestion.field;
        await db.execute(sql`
          UPDATE telegram_user_profiles
          SET ${sql.raw(fieldName)} = ${answer}, updated_at = NOW()
          WHERE id = ${profile.id}
        `);
        console.log(`[TELEGRAM-ONBOARDING] Saved ${fieldName} for chat ${chatId}: "${answer.substring(0, 50)}"`);
      }

      const nextStep = currentStep + 1;

      if (nextStep >= maxSteps) {
        const updatedProfile = await db.execute(sql`
          SELECT user_name, user_job, user_goals, user_desires, group_context, group_members, group_objectives
          FROM telegram_user_profiles WHERE id = ${profile.id}
        `);
        const p = updatedProfile.rows[0] as any;
        const fullProfile = isGroupChat
          ? { group_context: p.group_context, group_members: p.group_members, group_objectives: p.group_objectives }
          : { user_name: p.user_name, user_job: p.user_job, user_goals: p.user_goals, user_desires: p.user_desires };

        await db.execute(sql`
          UPDATE telegram_user_profiles
          SET onboarding_status = 'completed', onboarding_step = ${nextStep},
              full_profile_json = ${JSON.stringify(fullProfile)}::jsonb, updated_at = NOW()
          WHERE id = ${profile.id}
        `);

        const profileSummary = isGroupChat
          ? `Contesto: ${p.group_context || '-'}\nMembri: ${p.group_members || '-'}\nObiettivi: ${p.group_objectives || '-'}`
          : `Nome: ${p.user_name || '-'}\nLavoro: ${p.user_job || '-'}\nObiettivi: ${p.user_goals || '-'}\nDesideri: ${p.user_desires || '-'}`;

        const welcomeMsg = await generateWelcomeMessage(aiRole, consultantId, isGroupChat, profileSummary);
        await sendTelegramMessage(botToken, chatId, welcomeMsg);
        console.log(`[TELEGRAM-ONBOARDING] Onboarding completed for chat ${chatId}`);
        return 'handled';
      }

      await db.execute(sql`
        UPDATE telegram_user_profiles SET onboarding_step = ${nextStep}, updated_at = NOW()
        WHERE id = ${profile.id}
      `);

      const nextQuestion = questions[nextStep];
      const question = await generatePersonalityQuestion(
        aiRole, questionPrompts[nextStep], nextQuestion.fallback, consultantId, nextStep, false
      );
      await sendTelegramMessage(botToken, chatId, question);
      return 'handled';
    }

    if (profile.onboarding_status === 'pending') {
      await db.execute(sql`
        UPDATE telegram_user_profiles
        SET onboarding_status = 'in_onboarding', onboarding_step = 0, updated_at = NOW()
        WHERE id = ${profile.id}
      `);

      const question = await generatePersonalityQuestion(
        aiRole, questionPrompts[0], questions[0].fallback, consultantId, 0, true
      );
      await sendTelegramMessage(botToken, chatId, question);
      return 'handled';
    }

    return 'not_applicable';
  } catch (err: any) {
    console.error(`[TELEGRAM-ONBOARDING] Error:`, err.message);
    return 'not_applicable';
  }
}

async function getProfileContext(consultantId: string, aiRole: string, chatId: number): Promise<string | null> {
  try {
    const profileResult = await db.execute(sql`
      SELECT onboarding_status, chat_type, user_name, user_job, user_goals, user_desires,
             group_context, group_members, group_objectives
      FROM telegram_user_profiles
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId}
        AND onboarding_status = 'completed'
      LIMIT 1
    `);

    if (profileResult.rows.length === 0) return null;

    const p = profileResult.rows[0] as any;
    const isGroup = p.chat_type === 'group' || p.chat_type === 'supergroup';

    if (isGroup) {
      const parts = [];
      if (p.group_context) parts.push(`Contesto gruppo: ${p.group_context}`);
      if (p.group_members) parts.push(`Membri: ${p.group_members}`);
      if (p.group_objectives) parts.push(`Obiettivi: ${p.group_objectives}`);
      if (parts.length === 0) return null;
      return `[CONTESTO GRUPPO TELEGRAM: ${parts.join(', ')}]`;
    } else {
      const parts = [];
      if (p.user_name) parts.push(`Nome: ${p.user_name}`);
      if (p.user_job) parts.push(`Lavoro: ${p.user_job}`);
      if (p.user_goals) parts.push(`Obiettivi: ${p.user_goals}`);
      if (p.user_desires) parts.push(`Desideri: ${p.user_desires}`);
      if (parts.length === 0) return null;
      return `[CONTESTO UTENTE TELEGRAM: ${parts.join(', ')}]`;
    }
  } catch (err: any) {
    console.error(`[TELEGRAM] Error fetching profile context:`, err.message);
    return null;
  }
}

function buildTelegramChatContext(params: {
  isGroupChat: boolean;
  chatTitle: string;
  firstName: string;
  username: string;
  senderId: string;
  senderStatus: 'owner' | 'open_mode' | 'unknown';
}): string {
  const { isGroupChat, chatTitle, firstName, username, senderId, senderStatus } = params;
  const parts: string[] = [];

  if (isGroupChat) {
    parts.push(`[CONTESTO TELEGRAM: Stai rispondendo in un GRUPPO chiamato "${chatTitle || 'Gruppo senza nome'}"]`);
  } else {
    parts.push(`[CONTESTO TELEGRAM: Stai rispondendo in una CHAT PRIVATA]`);
  }

  const senderParts: string[] = [];
  if (firstName) senderParts.push(`nome: ${firstName}`);
  if (username) senderParts.push(`username: @${username}`);
  if (senderId) senderParts.push(`id: ${senderId}`);

  const statusLabel = senderStatus === 'owner'
    ? 'proprietario/consulente verificato'
    : senderStatus === 'open_mode'
      ? 'utente registrato via modalità aperta'
      : 'utente non riconosciuto';

  senderParts.push(`stato: ${statusLabel}`);
  parts.push(`[MITTENTE: ${senderParts.join(', ')}]`);

  if (isGroupChat) {
    parts.push(`[NOTA: Nel gruppo rispondi in modo conciso e diretto. Rivolgiti a ${firstName || username || 'l\'utente'} per nome quando possibile. Adatta il tono alla persona che ti scrive. Ricorda chi è ogni persona per le interazioni future.]`);
  } else {
    parts.push(`[NOTA: In chat privata puoi essere più dettagliato. Adatta il tono alla persona che ti scrive.]`);
  }

  return parts.join('\n');
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
    SELECT id, consultant_id, ai_role, bot_token, bot_username, enabled, group_support, open_mode
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

  let openModeBypassMention = false;
  if (isGroupChat && config.open_mode) {
    const groupProfile = await db.execute(sql`
      SELECT onboarding_status FROM telegram_user_profiles
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId}
      LIMIT 1
    `);
    if (groupProfile.rows.length === 0 || (groupProfile.rows[0] as any).onboarding_status === 'in_onboarding') {
      openModeBypassMention = true;
    }
  }

  if (isGroupChat && !openModeBypassMention) {
    if (!config.group_support && !config.open_mode) {
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

  if (config.open_mode) {
    const openModeResult = await handleOpenModeOnboarding(
      consultantId, aiRole, chatId, chatType, text, botToken, botUsername, firstName, username, chatTitle, isGroupChat
    );
    if (openModeResult === 'handled') {
      return;
    }
    if (openModeResult === 'completed') {
      let processedText = text;
      if (isGroupChat && botUsername) {
        processedText = text.replace(new RegExp(`@${botUsername}\\b`, 'gi'), '').trim();
      }
      if (!processedText) return;

      const profileContext = await getProfileContext(consultantId, aiRole, chatId);
      const senderId = String(fromUser?.id || '');
      const chatContext = buildTelegramChatContext({ isGroupChat, chatTitle, firstName, username, senderId, senderStatus: 'open_mode' });
      const contextParts = [chatContext];
      if (profileContext) contextParts.push(profileContext);
      contextParts.push(processedText);
      const messageWithContext = contextParts.join('\n\n');

      console.log(`[TELEGRAM-PROMPT] Open mode message for ${aiRole} from chat ${chatId}:`);
      console.log(`[TELEGRAM-PROMPT] Chat context: ${chatContext}`);
      console.log(`[TELEGRAM-PROMPT] Profile context: ${profileContext || 'none'}`);
      console.log(`[TELEGRAM-PROMPT] User message: ${processedText}`);
      console.log(`[TELEGRAM-PROMPT] Full message with context: ${messageWithContext.substring(0, 500)}`);

      try {
        const roleName = aiRole;
        const telegramMetadata = JSON.stringify({ source: "telegram", telegram_chat_id: chatId, chat_type: chatType, sender_id: senderId, sender_name: firstName, sender_username: username });
        await db.execute(sql`
          INSERT INTO agent_chat_messages (consultant_id, ai_role, role_name, sender, message, metadata)
          VALUES (${consultantId}::uuid, ${aiRole}, ${roleName}, 'consultant', ${processedText.trim()}, ${telegramMetadata}::jsonb)
        `);

        const { processAgentChatInternal } = await import("../routes/ai-autonomy-router");
        const aiResponse = await processAgentChatInternal(consultantId, aiRole, messageWithContext, {
          skipUserMessageInsert: true,
          metadata: { source: "telegram", telegram_chat_id: chatId, chat_type: chatType, chat_title: chatTitle, sender_id: senderId, sender_name: firstName, sender_username: username },
          source: "telegram",
        });

        await sendTelegramMessage(botToken, chatId, aiResponse, "Markdown");
        console.log(`[TELEGRAM] Open mode response sent to chat ${chatId} for role ${aiRole}`);
      } catch (err: any) {
        console.error(`[TELEGRAM] Error processing open mode message:`, err.message);
        await sendTelegramMessage(botToken, chatId, "⚠️ Mi dispiace, c'è stato un errore. Riprova tra poco.");
      }
      return;
    }
  }

  let ownerCheck = await db.execute(sql`
    SELECT id FROM telegram_chat_links
    WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId} AND is_owner = true AND active = true
    LIMIT 1
  `);

  if (ownerCheck.rows.length === 0 && isGroupChat && config.group_support && fromUser?.id) {
    const senderUserId = String(fromUser.id);
    const privateOwnerCheck = await db.execute(sql`
      SELECT id FROM telegram_chat_links
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${senderUserId} AND chat_type = 'private' AND is_owner = true AND active = true
      LIMIT 1
    `);
    if (privateOwnerCheck.rows.length > 0) {
      console.log(`[TELEGRAM] Auto-linking group ${chatId} for owner ${senderUserId} (already verified via private chat)`);
      await db.execute(sql`
        INSERT INTO telegram_chat_links (consultant_id, ai_role, telegram_chat_id, chat_type, chat_title, username, first_name, active, is_owner)
        VALUES (${consultantId}::uuid, ${aiRole}, ${chatId}, ${chatType}, ${chatTitle || null}, ${username || null}, ${firstName || null}, true, true)
        ON CONFLICT (consultant_id, ai_role, telegram_chat_id) DO UPDATE SET
          active = true, is_owner = true,
          chat_type = EXCLUDED.chat_type, chat_title = EXCLUDED.chat_title,
          username = EXCLUDED.username, first_name = EXCLUDED.first_name
      `);
      ownerCheck = { rows: [{ id: 'auto-linked' }] } as any;
    }
  }

  if (ownerCheck.rows.length === 0) {
    console.log(`[TELEGRAM] Unauthorized access from chat ${chatId}, sending friendly gatekeeper response`);
    try {
      const roleName = aiRole.charAt(0).toUpperCase() + aiRole.slice(1);
      const { GoogleGenAI } = await import("@google/genai");
      const { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } = await import("../ai/provider-factory");
      const apiKey = await getGeminiApiKeyForClassifier();
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const gatekeeperSenderId = String(fromUser?.id || '');
        const gatekeeperChatCtx = buildTelegramChatContext({ isGroupChat, chatTitle, firstName, username, senderId: gatekeeperSenderId, senderStatus: 'unknown' });
        const systemPrompt = `Sei ${roleName}, assistente personale di un professionista. Lavori come se fossi un vero membro del team — una persona reale, non un bot o un'intelligenza artificiale.

${gatekeeperChatCtx}

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

  const profileContext = await getProfileContext(consultantId, aiRole, chatId);
  const ownerSenderId = String(fromUser?.id || '');
  const chatContext = buildTelegramChatContext({ isGroupChat, chatTitle, firstName, username, senderId: ownerSenderId, senderStatus: 'owner' });
  const contextParts = [chatContext];
  if (profileContext) contextParts.push(profileContext);
  contextParts.push(processedText);
  const messageWithContext = contextParts.join('\n\n');

  console.log(`[TELEGRAM-PROMPT] Owner message for ${aiRole} from chat ${chatId}:`);
  console.log(`[TELEGRAM-PROMPT] Chat context: ${chatContext}`);
  console.log(`[TELEGRAM-PROMPT] Profile context: ${profileContext || 'none'}`);
  console.log(`[TELEGRAM-PROMPT] User message: ${processedText}`);
  console.log(`[TELEGRAM-PROMPT] Full message with context: ${messageWithContext.substring(0, 500)}`);

  try {
    const roleName = aiRole;
    const telegramMetadata = JSON.stringify({ source: "telegram", telegram_chat_id: chatId, chat_type: chatType, sender_id: ownerSenderId, sender_name: firstName, sender_username: username });
    await db.execute(sql`
      INSERT INTO agent_chat_messages (consultant_id, ai_role, role_name, sender, message, metadata)
      VALUES (${consultantId}::uuid, ${aiRole}, ${roleName}, 'consultant', ${processedText.trim()}, ${telegramMetadata}::jsonb)
    `);

    const { processAgentChatInternal } = await import("../routes/ai-autonomy-router");
    const aiResponse = await processAgentChatInternal(consultantId, aiRole, messageWithContext, {
      skipUserMessageInsert: true,
      metadata: { source: "telegram", telegram_chat_id: chatId, chat_type: chatType, chat_title: chatTitle, sender_id: ownerSenderId, sender_name: firstName, sender_username: username },
      source: "telegram",
    });

    await sendTelegramMessage(botToken, chatId, aiResponse, "Markdown");
    console.log(`[TELEGRAM] Response sent to chat ${chatId} for role ${aiRole}`);
  } catch (err: any) {
    console.error(`[TELEGRAM] Error processing message:`, err.message);
    await sendTelegramMessage(botToken, chatId, "⚠️ Mi dispiace, c'è stato un errore. Riprova tra poco.");
  }
}

export type TaskNotifyEvent = 'completed' | 'failed' | 'waiting_input' | 'waiting_approval' | 'created' | 'follow_up';

interface TaskNotifyData {
  taskId: string;
  instruction?: string;
  contactName?: string;
  resultSummary?: string;
  errorMessage?: string;
  stepInfo?: string;
  taskCategory?: string;
}

const TASK_NOTIFY_MESSAGES: Record<TaskNotifyEvent, (roleName: string, data: TaskNotifyData) => string> = {
  completed: (roleName, data) => {
    const contact = data.contactName ? `per *${data.contactName}*` : '';
    const instruction = data.instruction || '';
    const summary = data.resultSummary ? `\n\n📝 *Risultato:*\n${data.resultSummary.substring(0, 800)}` : '';
    return `✅ *${roleName}* ha completato un task ${contact}\n\n${instruction}${summary}`;
  },
  failed: (roleName, data) => {
    const contact = data.contactName ? `per *${data.contactName}*` : '';
    const instruction = data.instruction || '';
    const error = data.errorMessage ? `\n\n⚠️ *Motivo:*\n${data.errorMessage.substring(0, 500)}` : '';
    return `❌ *${roleName}* non è riuscito a completare un task ${contact}\n\n${instruction}${error}`;
  },
  waiting_input: (roleName, data) => {
    const contact = data.contactName ? `per *${data.contactName}*` : '';
    const instruction = data.instruction || '';
    const step = data.stepInfo ? `\n\n🔹 *Step attuale:*\n${data.stepInfo.substring(0, 500)}` : '';
    return `⏸️ *${roleName}* ha bisogno del tuo input ${contact}\n\n${instruction}${step}\n\n👉 Apri la piattaforma per rispondere.`;
  },
  waiting_approval: (roleName, data) => {
    const contact = data.contactName ? `per *${data.contactName}*` : '';
    const instruction = data.instruction || '';
    return `🔔 *${roleName}* ha preparato un task ${contact} e attende la tua approvazione\n\n${instruction}\n\n👉 Apri la piattaforma per approvare.`;
  },
  created: (roleName, data) => {
    const contact = data.contactName ? `per *${data.contactName}*` : '';
    const category = data.taskCategory ? ` [${data.taskCategory}]` : '';
    const instruction = data.instruction || '';
    return `📋 Nuovo task creato ${contact}${category}\n\n${instruction}`;
  },
  follow_up: (roleName, data) => {
    const contact = data.contactName ? `per *${data.contactName}*` : '';
    const instruction = data.instruction || '';
    return `🔄 *${roleName}* ha aggiornato un task esistente ${contact}\n\n${instruction}`;
  },
};

export async function notifyTaskViaTelegram(
  consultantId: string,
  roleId: string,
  event: TaskNotifyEvent,
  data: TaskNotifyData
): Promise<void> {
  try {
    const configResult = await db.execute(sql`
      SELECT id, bot_token FROM telegram_bot_configs
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId} AND enabled = true
      LIMIT 1
    `);
    if (configResult.rows.length === 0) return;

    const config = configResult.rows[0] as any;
    const botToken = config.bot_token;

    const ownerResult = await db.execute(sql`
      SELECT telegram_chat_id FROM telegram_chat_links
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${roleId} AND is_owner = true AND active = true
      LIMIT 1
    `);
    if (ownerResult.rows.length === 0) return;

    const chatId = (ownerResult.rows[0] as any).telegram_chat_id;
    const roleName = roleId.charAt(0).toUpperCase() + roleId.slice(1);
    const message = TASK_NOTIFY_MESSAGES[event](roleName, data);

    await sendTelegramMessage(botToken, chatId, message, "Markdown");
    console.log(`[TELEGRAM-NOTIFY] Sent ${event} notification to owner chat ${chatId} for role ${roleId}`);

    try {
      const plainMessage = message.replace(/\*/g, '');
      const telegramMetadata = JSON.stringify({ source: "telegram", telegram_chat_id: chatId, notification_type: event, task_id: data.taskId });
      await db.execute(sql`
        INSERT INTO agent_chat_messages (consultant_id, ai_role, role_name, sender, message, metadata)
        VALUES (${consultantId}::uuid, ${roleId}, ${roleName}, 'assistant', ${plainMessage}, ${telegramMetadata}::jsonb)
      `);
      console.log(`[TELEGRAM-NOTIFY] Saved ${event} notification to agent_chat_messages for role ${roleId}`);
    } catch (saveErr: any) {
      console.error(`[TELEGRAM-NOTIFY] Failed to save notification to chat history:`, saveErr.message);
    }
  } catch (err: any) {
    console.error(`[TELEGRAM-NOTIFY] Failed to notify ${event} for role ${roleId}:`, err.message);
  }
}
