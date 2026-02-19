import { db } from "../db";
import { sql } from "drizzle-orm";

const TELEGRAM_API = "https://api.telegram.org/bot";

const groupHistoryBuffer = new Map<number, {
  messages: Array<{ from: string; text: string; date: number }>;
  timer: NodeJS.Timeout | null;
  configId: string;
  consultantId: string;
  aiRole: string;
  botToken: string;
}>();

const HISTORY_THRESHOLD_SECONDS = 30;
const HISTORY_FLUSH_DELAY_MS = 3000;

const onboardingBuffer = new Map<string, {
  messages: Array<{ from: string; text: string }>;
  timer: NodeJS.Timeout | null;
  consultantId: string;
  aiRole: string;
  chatId: number;
  chatType: string;
  botToken: string;
  botUsername: string;
  chatTitle: string;
  isGroupChat: boolean;
}>();

const ONBOARDING_BUFFER_DELAY_MS = 5000;

async function getGroupInfo(botToken: string, chatId: number): Promise<{ title?: string; description?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/getChat?chat_id=${chatId}`);
    const data = await res.json();
    if (data.ok && data.result) {
      console.log(`[TELEGRAM-HISTORY] getChat result for ${chatId}: title="${data.result.title}", description="${(data.result.description || '').substring(0, 100)}"`);
      return {
        title: data.result.title || undefined,
        description: data.result.description || undefined,
      };
    }
    console.warn(`[TELEGRAM-HISTORY] getChat failed for ${chatId}:`, data.description);
    return {};
  } catch (err: any) {
    console.error(`[TELEGRAM-HISTORY] getChat error for ${chatId}:`, err.message);
    return {};
  }
}

async function flushHistoryBuffer(chatId: number): Promise<void> {
  const buffer = groupHistoryBuffer.get(chatId);
  if (!buffer || buffer.messages.length === 0) {
    groupHistoryBuffer.delete(chatId);
    return;
  }

  try {
    const { consultantId, aiRole, botToken } = buffer;
    const sorted = [...buffer.messages].sort((a, b) => a.date - b.date);

    const formattedLines = sorted.map(m => {
      const d = new Date(m.date * 1000);
      const ts = d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `[${ts}] ${m.from}: ${m.text}`;
    });
    const historyText = formattedLines.join('\n');

    console.log(`[TELEGRAM-HISTORY] Flushing ${sorted.length} historical messages for chat ${chatId}`);

    const groupInfo = await getGroupInfo(botToken, chatId);
    const groupDescription = groupInfo.description || null;

    await db.execute(sql`
      INSERT INTO telegram_user_profiles (consultant_id, ai_role, telegram_chat_id, chat_type, onboarding_status, group_history, group_description)
      VALUES (${consultantId}::uuid, ${aiRole}, ${chatId}, 'group', 'pending', ${historyText}, ${groupDescription})
      ON CONFLICT (consultant_id, ai_role, telegram_chat_id) DO UPDATE SET
        group_history = COALESCE(${historyText}, telegram_user_profiles.group_history),
        group_description = COALESCE(${groupDescription}, telegram_user_profiles.group_description),
        updated_at = NOW()
    `);

    console.log(`[TELEGRAM-HISTORY] Saved ${sorted.length} historical messages and group info for chat ${chatId}`);
  } catch (err: any) {
    console.error(`[TELEGRAM-HISTORY] Error flushing history buffer for chat ${chatId}:`, err.message);
  } finally {
    groupHistoryBuffer.delete(chatId);
  }
}

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

const MAX_ONBOARDING_STEPS = 15;

const ROLE_ONBOARDING_PROMPTS: Record<string, { private: string; group: string }> = {
  marco: {
    private: `Sei MARCO, Executive Coach. Stai facendo l'onboarding di una persona nuova su Telegram.
Il tuo stile: diretto, crudo, provocatorio, senza filtri. Non sei un assistente gentile - sei il coach che spinge oltre i limiti.

OBIETTIVO: Conosci questa persona per poterla aiutare davvero. Devi raccogliere abbastanza informazioni per poi essere un coach efficace.

COME PROCEDERE:
- Presentati brevemente con il tuo stile al primo messaggio
- Fai domande una alla volta, in modo naturale e provocatorio
- Commenta OGNI risposta prima di fare la prossima domanda (provoca, sfida, approfondisci)
- Decidi TU quali domande fare in base a quello che la persona ti dice
- Se dice qualcosa di vago, insisti. Non accettare risposte generiche.
- Adatta le domande alla situazione: un imprenditore riceverà domande diverse da un disoccupato

INFORMAZIONI DA RACCOGLIERE (non necessariamente in quest'ordine):
- Nome
- Cosa fa nella vita (lavoro, studio, situazione)
- Situazione finanziaria (guadagni, risparmi, debiti)
- Obiettivo concreto con numeri e tempistiche
- Cosa ha provato finora per raggiungerlo
- Perché ha deciso di agire adesso

QUANDO HAI FINITO:
Quando hai raccolto abbastanza informazioni (minimo 4-5 scambi), chiudi l'onboarding con:
1. Un riassunto brutalmente onesto della situazione della persona
2. La tua prima valutazione da coach (cosa pensi, dove sono i problemi, dove puoi aiutare)
3. Aggiungi ESATTAMENTE il tag [ONBOARDING_COMPLETE] alla fine del tuo ultimo messaggio

REGOLE:
- Scrivi come su Telegram: breve, diretto, informale
- Dai del "tu"
- NON dire mai che sei un bot o un'AI
- NON fare liste di domande tutte insieme - UNA domanda alla volta
- Rispondi SEMPRE in italiano`,
    group: `Sei MARCO, Executive Coach. Stai facendo l'onboarding di un GRUPPO nuovo su Telegram.
Il tuo stile: diretto, crudo, provocatorio, senza filtri.

OBIETTIVO: Conosci questo gruppo per poterlo aiutare davvero. Devi capire chi sono, cosa fanno e dove vogliono arrivare.

COME PROCEDERE:
- Presentati brevemente con il tuo stile al primo messaggio
- Fai domande una alla volta, in modo naturale
- Commenta OGNI risposta prima di fare la prossima domanda
- Decidi TU quali domande fare in base a quello che il gruppo ti dice

INFORMAZIONI DA RACCOGLIERE:
- Contesto del gruppo (azienda, team, progetto)
- Chi sono i membri principali e i loro ruoli
- Obiettivi del gruppo con numeri e tempistiche
- Sfide attuali e cosa hanno provato finora
- Cosa si aspettano da te

QUANDO HAI FINITO:
Quando hai raccolto abbastanza informazioni (minimo 3-4 scambi), chiudi con:
1. Un riassunto della situazione del gruppo
2. La tua valutazione iniziale
3. Aggiungi ESATTAMENTE il tag [ONBOARDING_COMPLETE] alla fine del tuo ultimo messaggio

REGOLE:
- Scrivi come su Telegram: breve, diretto, informale
- NON dire mai che sei un bot o un'AI
- UNA domanda alla volta
- Rispondi SEMPRE in italiano`,
  },
  stella: {
    private: `Sei STELLA, Assistente WhatsApp & Comunicazione. Stai facendo l'onboarding di una persona nuova su Telegram.
Il tuo stile: empatico, caloroso, accogliente ma professionale. Metti le persone a loro agio.

OBIETTIVO: Conosci questa persona per poterla assistere al meglio nella comunicazione e gestione clienti.

COME PROCEDERE:
- Presentati con calore al primo messaggio
- Fai domande una alla volta, in modo naturale e empatico
- Mostra interesse genuino per ogni risposta prima di procedere
- Adatta le domande alla situazione della persona

INFORMAZIONI DA RACCOGLIERE (non necessariamente in quest'ordine):
- Nome
- Cosa fa nella vita
- Come gestisce attualmente la comunicazione con i clienti
- Obiettivi principali
- Cosa si aspetta da te

QUANDO HAI FINITO:
Quando hai raccolto abbastanza informazioni (minimo 4-5 scambi), chiudi con:
1. Un riassunto affettuoso ma preciso della situazione
2. Come pensi di poterla aiutare
3. Aggiungi ESATTAMENTE il tag [ONBOARDING_COMPLETE] alla fine del tuo ultimo messaggio

REGOLE:
- Scrivi come su Telegram: breve, caloroso, informale
- Dai del "tu"
- NON dire mai che sei un bot o un'AI
- UNA domanda alla volta
- Rispondi SEMPRE in italiano`,
    group: `Sei STELLA, Assistente WhatsApp & Comunicazione. Stai facendo l'onboarding di un GRUPPO su Telegram.
Il tuo stile: empatico, caloroso, accogliente.

OBIETTIVO: Conosci questo gruppo per supportarlo nella comunicazione.

COME PROCEDERE:
- Presentati con calore
- Fai domande una alla volta
- Mostra interesse genuino per ogni risposta

INFORMAZIONI DA RACCOGLIERE:
- Contesto del gruppo
- Membri principali e ruoli
- Come gestiscono la comunicazione attualmente
- Obiettivi del gruppo

QUANDO HAI FINITO:
Dopo 3-4 scambi, chiudi con un riassunto e aggiungi [ONBOARDING_COMPLETE] alla fine.

REGOLE:
- Breve, calorosa, informale
- NON dire mai che sei un bot o un'AI
- UNA domanda alla volta
- Rispondi SEMPRE in italiano`,
  },
  iris: {
    private: `Sei IRIS, Assistente Email & Analisi. Stai facendo l'onboarding di una persona nuova su Telegram.
Il tuo stile: analitico, preciso, strutturato ma amichevole. Vai al sodo con eleganza.

OBIETTIVO: Conosci questa persona per ottimizzare la sua gestione email e analisi dati.

COME PROCEDERE:
- Presentati in modo professionale al primo messaggio
- Fai domande una alla volta, precise e mirate
- Analizza ogni risposta prima di procedere
- Adatta le domande alla situazione

INFORMAZIONI DA RACCOGLIERE (non necessariamente in quest'ordine):
- Nome
- Cosa fa nella vita
- Volume di email/comunicazioni da gestire
- Obiettivi principali
- Sfide attuali nella gestione dati

QUANDO HAI FINITO:
Dopo 4-5 scambi, chiudi con:
1. Un'analisi strutturata della situazione
2. Le tue raccomandazioni iniziali
3. Aggiungi ESATTAMENTE il tag [ONBOARDING_COMPLETE] alla fine

REGOLE:
- Breve, precisa, professionale
- NON dire mai che sei un bot o un'AI
- UNA domanda alla volta
- Rispondi SEMPRE in italiano`,
    group: `Sei IRIS, Assistente Email & Analisi. Stai facendo l'onboarding di un GRUPPO su Telegram.
Il tuo stile: analitico, preciso, strutturato.

OBIETTIVO: Conosci questo gruppo per supportarlo nell'analisi e gestione dati.

COME PROCEDERE:
- Presentati professionalmente
- Fai domande una alla volta, precise e mirate

INFORMAZIONI DA RACCOGLIERE:
- Contesto del gruppo
- Membri e ruoli
- Volume di dati/email da gestire
- Obiettivi del gruppo

QUANDO HAI FINITO:
Dopo 3-4 scambi, chiudi con un'analisi e aggiungi [ONBOARDING_COMPLETE] alla fine.

REGOLE:
- Breve, precisa, professionale
- NON dire mai che sei un bot o un'AI
- UNA domanda alla volta
- Rispondi SEMPRE in italiano`,
  },
};

const DEFAULT_ONBOARDING_PROMPT = {
  private: (roleName: string) => `Sei ${roleName}. Stai facendo l'onboarding di una persona nuova su Telegram.

OBIETTIVO: Conosci questa persona per poterla aiutare al meglio.

COME PROCEDERE:
- Presentati brevemente al primo messaggio
- Fai domande una alla volta, in modo naturale
- Commenta ogni risposta prima di fare la prossima domanda
- Decidi tu quali domande fare in base alle risposte

INFORMAZIONI DA RACCOGLIERE:
- Nome
- Cosa fa nella vita
- Obiettivi principali
- Cosa si aspetta da te

QUANDO HAI FINITO:
Dopo 4-5 scambi, chiudi con:
1. Un riassunto della situazione
2. Come pensi di poter aiutare
3. Aggiungi ESATTAMENTE il tag [ONBOARDING_COMPLETE] alla fine del tuo ultimo messaggio

REGOLE:
- Scrivi come su Telegram: breve, naturale, informale
- Dai del "tu"
- NON dire mai che sei un bot o un'AI
- UNA domanda alla volta
- Rispondi SEMPRE in italiano`,
  group: (roleName: string) => `Sei ${roleName}. Stai facendo l'onboarding di un GRUPPO nuovo su Telegram.

OBIETTIVO: Conosci questo gruppo per poterlo supportare al meglio.

COME PROCEDERE:
- Presentati brevemente al primo messaggio
- Fai domande una alla volta

INFORMAZIONI DA RACCOGLIERE:
- Contesto del gruppo
- Membri principali
- Obiettivi del gruppo

QUANDO HAI FINITO:
Dopo 3-4 scambi, chiudi con un riassunto e aggiungi [ONBOARDING_COMPLETE] alla fine.

REGOLE:
- Breve, naturale, informale
- NON dire mai che sei un bot o un'AI
- UNA domanda alla volta
- Rispondi SEMPRE in italiano`,
};

function getOnboardingSystemPrompt(aiRole: string, isGroup: boolean): string {
  const rolePrompts = ROLE_ONBOARDING_PROMPTS[aiRole.toLowerCase()];
  if (rolePrompts) {
    return isGroup ? rolePrompts.group : rolePrompts.private;
  }
  const roleName = aiRole.charAt(0).toUpperCase() + aiRole.slice(1);
  return isGroup ? DEFAULT_ONBOARDING_PROMPT.group(roleName) : DEFAULT_ONBOARDING_PROMPT.private(roleName);
}

async function generateOnboardingResponse(
  aiRole: string,
  consultantId: string,
  isGroup: boolean,
  conversation: Array<{ role: string; content: string }>,
  groupPreContext?: string
): Promise<string> {
  const fallback = conversation.length === 0
    ? `Ciao! Sono ${aiRole.charAt(0).toUpperCase() + aiRole.slice(1)} 👋 Raccontami un po' di te!`
    : "Interessante! Dimmi di più...";
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } = await import("../ai/provider-factory");
    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) return fallback;

    const ai = new GoogleGenAI({ apiKey });
    let systemPrompt = getOnboardingSystemPrompt(aiRole, isGroup);
    if (groupPreContext) {
      systemPrompt = `${systemPrompt}\n\n--- CONTESTO GIÀ DISPONIBILE SUL GRUPPO ---\n${groupPreContext}\n--- FINE CONTESTO ---\nUsa queste informazioni per personalizzare le tue domande e dimostrare che conosci già il contesto del gruppo. Non ripetere informazioni già note, ma approfondisci ciò che manca.`;
    }
    console.log(`[TELEGRAM-ONBOARDING] System prompt (${aiRole}, group=${isGroup}, msgs=${conversation.length}):\n${systemPrompt.substring(0, 800)}...`);

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    for (const msg of conversation) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "Ciao" }] });
    }

    const result = await trackedGenerateContent(ai, {
      model: GEMINI_3_MODEL,
      contents,
      config: { temperature: 0.9, systemInstruction: systemPrompt },
    }, {
      consultantId,
      feature: "telegram_onboarding",
      keySource: "superadmin",
      callerRole: "consultant",
    });

    const aiText = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text;
    return aiText || fallback;
  } catch (err: any) {
    console.error(`[TELEGRAM-ONBOARDING] AI conversation error:`, err.message);
    return fallback;
  }
}

async function extractProfileFromConversation(
  consultantId: string,
  conversation: Array<{ role: string; content: string }>,
  isGroup: boolean
): Promise<{ profileJson: any; summary: string }> {
  const defaultProfile = {
    user_name: null, user_job: null, user_goals: null, user_desires: null,
    financial_situation: null, key_challenges: null, why_now: null, additional_context: null,
  };
  const defaultSummary = "Profilo raccolto tramite onboarding conversazionale.";
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } = await import("../ai/provider-factory");
    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) return { profileJson: defaultProfile, summary: defaultSummary };

    const ai = new GoogleGenAI({ apiKey });

    const conversationText = conversation
      .map(m => `${m.role === 'assistant' ? 'AI' : 'Utente'}: ${m.content}`)
      .join('\n\n');

    const extractionPrompt = isGroup
      ? `Analizza questa conversazione di onboarding di un GRUPPO ed estrai le informazioni raccolte in formato JSON:
{
  "group_context": "...",
  "group_members": "...",
  "group_objectives": "...",
  "key_challenges": "...",
  "additional_context": "..."
}
Estrai SOLO le informazioni effettivamente menzionate. Usa null per quelle non disponibili.
Rispondi SOLO con il JSON, senza altro testo.

CONVERSAZIONE:
${conversationText}`
      : `Analizza questa conversazione di onboarding ed estrai le informazioni raccolte in formato JSON:
{
  "user_name": "...",
  "user_job": "...",
  "user_goals": "...",
  "user_desires": "...",
  "financial_situation": "...",
  "key_challenges": "...",
  "why_now": "...",
  "additional_context": "..."
}
Estrai SOLO le informazioni effettivamente menzionate. Usa null per quelle non disponibili.
Rispondi SOLO con il JSON, senza altro testo.

CONVERSAZIONE:
${conversationText}`;

    const summaryPrompt = `Basandoti su questa conversazione di onboarding, scrivi un RIASSUNTO conciso (max 5 righe) del profilo della persona/gruppo. Includi le informazioni chiave raccolte in modo leggibile. Rispondi SOLO con il riassunto, senza altro testo.

CONVERSAZIONE:
${conversationText}`;

    const [extractionResult, summaryResult] = await Promise.all([
      trackedGenerateContent(ai, {
        model: GEMINI_3_MODEL,
        contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
        config: { temperature: 0.1 },
      }, {
        consultantId,
        feature: "telegram_onboarding",
        keySource: "superadmin",
        callerRole: "consultant",
      }),
      trackedGenerateContent(ai, {
        model: GEMINI_3_MODEL,
        contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
        config: { temperature: 0.3 },
      }, {
        consultantId,
        feature: "telegram_onboarding",
        keySource: "superadmin",
        callerRole: "consultant",
      }),
    ]);

    const extractionText = extractionResult?.text || extractionResult?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const summaryText = summaryResult?.text || summaryResult?.candidates?.[0]?.content?.parts?.[0]?.text || defaultSummary;

    let profileJson = defaultProfile;
    try {
      const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        profileJson = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error(`[TELEGRAM-ONBOARDING] JSON parse error:`, parseErr);
    }

    return { profileJson, summary: summaryText.trim() };
  } catch (err: any) {
    console.error(`[TELEGRAM-ONBOARDING] Profile extraction error:`, err.message);
    return { profileJson: defaultProfile, summary: defaultSummary };
  }
}

async function processOnboardingStep(
  consultantId: string,
  aiRole: string,
  chatId: number,
  chatType: string,
  botToken: string,
  botUsername: string,
  chatTitle: string,
  isGroupChat: boolean,
  userMessage: string,
  existingProfile?: any
): Promise<void> {
  try {
    let profile = existingProfile;
    if (!profile) {
      const profileResult = await db.execute(sql`
        SELECT id, onboarding_status, onboarding_step, onboarding_conversation,
               group_description, group_history
        FROM telegram_user_profiles
        WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId}
        LIMIT 1
      `);
      if (profileResult.rows.length === 0) return;
      profile = profileResult.rows[0] as any;
    }

    if (profile.onboarding_status !== 'in_onboarding') return;

    const currentStep = profile.onboarding_step || 0;

    const existingConversation: Array<{ role: string; content: string }> = Array.isArray(profile.onboarding_conversation)
      ? profile.onboarding_conversation
      : [];

    const conversationWithUserMsg = [...existingConversation, { role: 'user', content: userMessage }];

    let continueGroupContext: string | undefined;
    if (isGroupChat) {
      const ctxParts: string[] = [];
      let gDesc = profile.group_description;
      if (!gDesc) {
        const gInfo = await getGroupInfo(botToken, chatId);
        gDesc = gInfo.description || null;
        if (gDesc) {
          await db.execute(sql`
            UPDATE telegram_user_profiles SET group_description = ${gDesc}, updated_at = NOW()
            WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId}
          `);
        }
      }
      if (gDesc) ctxParts.push(`Descrizione del gruppo: ${gDesc}`);
      if (chatTitle) ctxParts.push(`Nome del gruppo: ${chatTitle}`);
      if (profile.group_history) {
        const truncated = profile.group_history.length > 2000 ? profile.group_history.substring(0, 2000) + '...[troncato]' : profile.group_history;
        ctxParts.push(`Storico messaggi recenti del gruppo:\n${truncated}`);
      }
      if (ctxParts.length > 0) continueGroupContext = ctxParts.join('\n\n');
    }

    const forceComplete = currentStep >= MAX_ONBOARDING_STEPS - 1;

    let aiResponse: string;
    if (forceComplete) {
      let forcePrompt = getOnboardingSystemPrompt(aiRole, isGroupChat)
        + '\n\nIMPORTANTE: Hai raggiunto il numero massimo di scambi. DEVI chiudere l\'onboarding ORA. Fai un riassunto di quello che sai e aggiungi [ONBOARDING_COMPLETE] alla fine.';
      if (continueGroupContext) {
        forcePrompt = `${forcePrompt}\n\n--- CONTESTO GIÀ DISPONIBILE SUL GRUPPO ---\n${continueGroupContext}\n--- FINE CONTESTO ---`;
      }
      console.log(`[TELEGRAM-ONBOARDING] System prompt for chat ${chatId} (forceComplete, step ${currentStep}):\n${forcePrompt.substring(0, 500)}...`);

      const tempConversation = conversationWithUserMsg.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const { getGeminiApiKeyForClassifier, GEMINI_3_MODEL, trackedGenerateContent } = await import("../ai/provider-factory");
        const apiKey = await getGeminiApiKeyForClassifier();
        const ai = new GoogleGenAI({ apiKey: apiKey! });
        const result = await trackedGenerateContent(ai, {
          model: GEMINI_3_MODEL,
          contents: tempConversation,
          config: { temperature: 0.9, systemInstruction: forcePrompt },
        }, {
          consultantId,
          feature: "telegram_onboarding",
          keySource: "superadmin",
          callerRole: "consultant",
        });
        aiResponse = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!aiResponse.includes('[ONBOARDING_COMPLETE]')) {
          aiResponse += '\n\n[ONBOARDING_COMPLETE]';
        }
      } catch (err: any) {
        console.error(`[TELEGRAM-ONBOARDING] Force complete AI error:`, err.message);
        aiResponse = 'Ok, ho raccolto abbastanza informazioni. Iniziamo a lavorare! [ONBOARDING_COMPLETE]';
      }
    } else {
      aiResponse = await generateOnboardingResponse(aiRole, consultantId, isGroupChat, conversationWithUserMsg, continueGroupContext);
    }

    const isComplete = aiResponse.includes('[ONBOARDING_COMPLETE]');
    const cleanResponse = aiResponse.replace(/\[ONBOARDING_COMPLETE\]/g, '').trim();

    const updatedConversation = [...conversationWithUserMsg, { role: 'assistant', content: cleanResponse }];

    if (isComplete) {
      console.log(`[TELEGRAM-ONBOARDING] AI signaled onboarding complete for chat ${chatId} at step ${currentStep + 1}`);

      const { profileJson, summary } = await extractProfileFromConversation(consultantId, updatedConversation, isGroupChat);

      const userName = profileJson.user_name || null;
      const userJob = profileJson.user_job || null;
      const userGoals = profileJson.user_goals || null;
      const userDesires = profileJson.user_desires || null;
      const groupContext = profileJson.group_context || null;
      const groupMembers = profileJson.group_members || null;
      const groupObjectives = profileJson.group_objectives || null;

      await db.execute(sql`
        UPDATE telegram_user_profiles
        SET onboarding_status = 'completed',
            onboarding_step = ${currentStep + 1},
            onboarding_conversation = ${JSON.stringify(updatedConversation)}::jsonb,
            onboarding_summary = ${summary},
            full_profile_json = ${JSON.stringify(profileJson)}::jsonb,
            user_name = COALESCE(${userName}, user_name),
            user_job = COALESCE(${userJob}, user_job),
            user_goals = COALESCE(${userGoals}, user_goals),
            user_desires = COALESCE(${userDesires}, user_desires),
            group_context = COALESCE(${groupContext}, group_context),
            group_members = COALESCE(${groupMembers}, group_members),
            group_objectives = COALESCE(${groupObjectives}, group_objectives),
            updated_at = NOW()
        WHERE id = ${profile.id}
      `);

      await sendTelegramMessage(botToken, chatId, cleanResponse);
      console.log(`[TELEGRAM-ONBOARDING] Onboarding completed for chat ${chatId}`);
      return;
    }

    await db.execute(sql`
      UPDATE telegram_user_profiles
      SET onboarding_step = ${currentStep + 1},
          onboarding_conversation = ${JSON.stringify(updatedConversation)}::jsonb,
          updated_at = NOW()
      WHERE id = ${profile.id}
    `);

    await sendTelegramMessage(botToken, chatId, cleanResponse);
    console.log(`[TELEGRAM-ONBOARDING] Onboarding step ${currentStep + 1} for chat ${chatId}`);
  } catch (err: any) {
    console.error(`[TELEGRAM-ONBOARDING] processOnboardingStep error for chat ${chatId}:`, err.message);
  }
}

async function flushOnboardingBuffer(bufferKey: string): Promise<void> {
  const buf = onboardingBuffer.get(bufferKey);
  if (!buf || buf.messages.length === 0) {
    onboardingBuffer.delete(bufferKey);
    return;
  }

  const { consultantId, aiRole, chatId, chatType, botToken, botUsername, chatTitle, isGroupChat, messages } = buf;
  onboardingBuffer.delete(bufferKey);

  const truncatedMessages = messages.map(m => ({ from: m.from, text: m.text.substring(0, 500) }));
  const combinedMessage = truncatedMessages.length === 1
    ? `[${truncatedMessages[0].from}]: ${truncatedMessages[0].text}`
    : `[Messaggi dal gruppo]\n${truncatedMessages.map(m => `[${m.from}]: ${m.text}`).join('\n')}`;

  console.log(`[TELEGRAM-ONBOARDING] Flushing buffer for group ${chatId}: ${messages.length} messages from ${[...new Set(messages.map(m => m.from))].join(', ')}`);

  await processOnboardingStep(consultantId, aiRole, chatId, chatType, botToken, botUsername, chatTitle, isGroupChat, combinedMessage);
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
             group_context, group_members, group_objectives, onboarding_conversation,
             group_description, group_history
      FROM telegram_user_profiles
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId}
      LIMIT 1
    `);

    const existingProfile = profileResult.rows.length > 0 ? profileResult.rows[0] as any : null;
    const needsOnboarding = !existingProfile || existingProfile.onboarding_status === 'pending';

    if (needsOnboarding) {
      console.log(`[TELEGRAM-ONBOARDING] ${existingProfile ? 'Pending' : 'New'} ${isGroupChat ? 'group' : 'private'} chat ${chatId}, starting AI-driven onboarding`);

      let groupPreContext: string | undefined;
      let groupDesc: string | null = null;
      if (isGroupChat) {
        const contextParts: string[] = [];
        groupDesc = existingProfile?.group_description || null;
        if (!groupDesc) {
          console.log(`[TELEGRAM-ONBOARDING] No group description cached, fetching via getChat for ${chatId}`);
          const groupInfo = await getGroupInfo(botToken, chatId);
          groupDesc = groupInfo.description || null;
        }
        if (groupDesc) contextParts.push(`Descrizione del gruppo: ${groupDesc}`);
        if (chatTitle) contextParts.push(`Nome del gruppo: ${chatTitle}`);
        if (existingProfile?.group_history) {
          const truncated = existingProfile.group_history.length > 2000 ? existingProfile.group_history.substring(0, 2000) + '...[troncato]' : existingProfile.group_history;
          contextParts.push(`Storico messaggi recenti del gruppo:\n${truncated}`);
        }
        if (contextParts.length > 0) {
          groupPreContext = contextParts.join('\n\n');
          console.log(`[TELEGRAM-ONBOARDING] Group context for chat ${chatId}, length=${groupPreContext.length}`);
        }
      }

      const initialConversation: Array<{ role: string; content: string }> = [];
      const aiFirstMessage = await generateOnboardingResponse(aiRole, consultantId, isGroupChat, initialConversation, groupPreContext);

      const savedConversation = [{ role: 'assistant', content: aiFirstMessage }];

      await db.execute(sql`
        INSERT INTO telegram_user_profiles (consultant_id, ai_role, telegram_chat_id, chat_type, onboarding_status, onboarding_step, first_name, username, onboarding_conversation, group_description)
        VALUES (${consultantId}::uuid, ${aiRole}, ${chatId}, ${chatType}, 'in_onboarding', 0, ${firstName || null}, ${username || null}, ${JSON.stringify(savedConversation)}::jsonb, ${groupDesc || null})
        ON CONFLICT (consultant_id, ai_role, telegram_chat_id) DO UPDATE SET
          onboarding_status = 'in_onboarding', onboarding_step = 0, onboarding_conversation = ${JSON.stringify(savedConversation)}::jsonb,
          group_description = COALESCE(${groupDesc || null}, telegram_user_profiles.group_description),
          updated_at = NOW()
      `);

      await db.execute(sql`
        INSERT INTO telegram_chat_links (consultant_id, ai_role, telegram_chat_id, chat_type, chat_title, username, first_name, active, is_owner)
        VALUES (${consultantId}::uuid, ${aiRole}, ${chatId}, ${chatType}, ${chatTitle || null}, ${username || null}, ${firstName || null}, true, false)
        ON CONFLICT (consultant_id, ai_role, telegram_chat_id) DO UPDATE SET
          active = true, chat_type = EXCLUDED.chat_type, chat_title = EXCLUDED.chat_title,
          username = EXCLUDED.username, first_name = EXCLUDED.first_name
      `);

      await sendTelegramMessage(botToken, chatId, aiFirstMessage);
      return 'handled';
    }

    if (existingProfile.onboarding_status === 'completed') {
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

    if (existingProfile.onboarding_status === 'in_onboarding') {
      const senderName = firstName || username || 'Utente';
      let cleanText = text.trim();
      if (botUsername) {
        cleanText = cleanText.replace(new RegExp(`@${botUsername}\\b`, 'gi'), '').trim();
      }
      if (!cleanText) return 'handled';

      if (isGroupChat) {
        const bufferKey = `${consultantId}_${aiRole}_${chatId}`;
        const existing = onboardingBuffer.get(bufferKey);

        if (existing) {
          existing.messages.push({ from: senderName, text: cleanText });
          if (existing.timer) clearTimeout(existing.timer);
          existing.timer = setTimeout(() => flushOnboardingBuffer(bufferKey), ONBOARDING_BUFFER_DELAY_MS);
          console.log(`[TELEGRAM-ONBOARDING] Buffered message from ${senderName} in group ${chatId} (${existing.messages.length} total, waiting ${ONBOARDING_BUFFER_DELAY_MS}ms)`);
        } else {
          const buf = {
            messages: [{ from: senderName, text: cleanText }],
            timer: null as NodeJS.Timeout | null,
            consultantId, aiRole, chatId, chatType, botToken, botUsername, chatTitle, isGroupChat,
          };
          buf.timer = setTimeout(() => flushOnboardingBuffer(bufferKey), ONBOARDING_BUFFER_DELAY_MS);
          onboardingBuffer.set(bufferKey, buf);
          console.log(`[TELEGRAM-ONBOARDING] Started buffer for group ${chatId}, first message from ${senderName}, waiting ${ONBOARDING_BUFFER_DELAY_MS}ms`);
        }
        return 'handled';
      }

      const userMessage = cleanText.substring(0, 1000);

      await processOnboardingStep(consultantId, aiRole, chatId, chatType, botToken, botUsername, chatTitle, isGroupChat, userMessage, existingProfile);
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
             group_context, group_members, group_objectives, group_description, group_history,
             onboarding_summary, full_profile_json
      FROM telegram_user_profiles
      WHERE consultant_id = ${consultantId}::uuid AND ai_role = ${aiRole} AND telegram_chat_id = ${chatId}
        AND onboarding_status = 'completed'
      LIMIT 1
    `);

    if (profileResult.rows.length === 0) return null;

    const p = profileResult.rows[0] as any;
    const isGroup = p.chat_type === 'group' || p.chat_type === 'supergroup';
    const contextLabel = isGroup ? 'CONTESTO GRUPPO TELEGRAM' : 'CONTESTO UTENTE TELEGRAM';

    if (p.onboarding_summary) {
      return `[${contextLabel}: ${p.onboarding_summary}]`;
    }

    if (p.full_profile_json && typeof p.full_profile_json === 'object') {
      const fpj = p.full_profile_json;
      const parts: string[] = [];
      for (const [key, value] of Object.entries(fpj)) {
        if (value && value !== 'null') {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          parts.push(`${label}: ${value}`);
        }
      }
      if (parts.length > 0) {
        return `[${contextLabel}: ${parts.join(', ')}]`;
      }
    }

    if (isGroup) {
      const parts = [];
      if (p.group_description) parts.push(`Descrizione gruppo: ${p.group_description}`);
      if (p.group_context) parts.push(`Contesto gruppo: ${p.group_context}`);
      if (p.group_members) parts.push(`Membri: ${p.group_members}`);
      if (p.group_objectives) parts.push(`Obiettivi: ${p.group_objectives}`);
      if (p.group_history) {
        const truncatedHistory = p.group_history.length > 2000 ? p.group_history.substring(0, 2000) + '...[troncato]' : p.group_history;
        parts.push(`Storico messaggi gruppo:\n${truncatedHistory}`);
      }
      if (parts.length === 0) return null;
      return `[${contextLabel}: ${parts.join(', ')}]`;
    } else {
      const parts = [];
      if (p.user_name) parts.push(`Nome: ${p.user_name}`);
      if (p.user_job) parts.push(`Lavoro: ${p.user_job}`);
      if (p.user_goals) parts.push(`Obiettivi: ${p.user_goals}`);
      if (p.user_desires) parts.push(`Desideri: ${p.user_desires}`);
      if (parts.length === 0) return null;
      return `[${contextLabel}: ${parts.join(', ')}]`;
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
    const isGroupNonText = chatType === 'group' || chatType === 'supergroup';
    if (isGroupNonText) {
      console.log(`[TELEGRAM] Non-text message from group ${chatId}, fetching group info...`);
      try {
        const cfgResult = await db.execute(sql`
          SELECT id, consultant_id, ai_role, bot_token FROM telegram_bot_configs
          WHERE id = ${parseInt(configId)} AND enabled = true LIMIT 1
        `);
        if (cfgResult.rows.length > 0) {
          const cfg = cfgResult.rows[0] as any;
          const groupInfo = await getGroupInfo(cfg.bot_token, chatId);
          if (groupInfo.description || groupInfo.title) {
            await db.execute(sql`
              INSERT INTO telegram_user_profiles (consultant_id, ai_role, telegram_chat_id, chat_type, onboarding_status, group_description)
              VALUES (${cfg.consultant_id}::uuid, ${cfg.ai_role}, ${chatId}, ${chatType}, 'pending', ${groupInfo.description || null})
              ON CONFLICT (consultant_id, ai_role, telegram_chat_id) DO UPDATE SET
                group_description = COALESCE(${groupInfo.description || null}, telegram_user_profiles.group_description),
                updated_at = NOW()
            `);
            console.log(`[TELEGRAM] Saved group info for ${chatId}: title="${groupInfo.title}", description="${(groupInfo.description || '').substring(0, 100)}"`);
          }
        }
      } catch (err: any) {
        console.error(`[TELEGRAM] Error fetching group info for non-text message:`, err.message);
      }
    } else {
      console.log(`[TELEGRAM] Non-text message from chat ${chatId}, skipping`);
    }
    return;
  }

  console.log(`[TELEGRAM] Incoming message from chat ${chatId} (${chatType}): "${text.substring(0, 100)}"`);

  const isGroupChat_early = chatType === 'group' || chatType === 'supergroup';
  if (isGroupChat_early && msg.date) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const messageAge = nowSeconds - msg.date;
    if (messageAge > HISTORY_THRESHOLD_SECONDS) {
      console.log(`[TELEGRAM-HISTORY] Historical message detected in chat ${chatId}, age=${messageAge}s: "${text.substring(0, 80)}"`);

      const configCheckResult = await db.execute(sql`
        SELECT id, consultant_id, ai_role, bot_token FROM telegram_bot_configs
        WHERE id = ${parseInt(configId)} AND enabled = true LIMIT 1
      `);
      if (configCheckResult.rows.length === 0) return;
      const cfgHist = configCheckResult.rows[0] as any;

      const senderName = firstName || username || 'Utente';
      if (!groupHistoryBuffer.has(chatId)) {
        groupHistoryBuffer.set(chatId, {
          messages: [],
          timer: null,
          configId,
          consultantId: cfgHist.consultant_id,
          aiRole: cfgHist.ai_role,
          botToken: cfgHist.bot_token,
        });
      }
      const buffer = groupHistoryBuffer.get(chatId)!;
      buffer.messages.push({ from: senderName, text, date: msg.date });

      if (buffer.timer) clearTimeout(buffer.timer);
      buffer.timer = setTimeout(() => {
        flushHistoryBuffer(chatId).catch(err => {
          console.error(`[TELEGRAM-HISTORY] Flush timer error for chat ${chatId}:`, err.message);
        });
      }, HISTORY_FLUSH_DELAY_MS);

      return;
    }
  }

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

  if (isGroupChat) {
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

  // Check if sender is owner FIRST (before open mode) so owner messages always go to normal flow
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

  // If NOT owner, try open mode flow for external users
  if (ownerCheck.rows.length === 0 && config.open_mode) {
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
        await db.execute(sql`
          INSERT INTO telegram_open_mode_messages (consultant_id, ai_role, telegram_chat_id, chat_type, chat_title, sender_type, sender_name, sender_username, sender_id, message)
          VALUES (${consultantId}::uuid, ${aiRole}, ${chatId}, ${chatType}, ${chatTitle || null}, 'user', ${firstName || null}, ${username || null}, ${senderId || null}, ${processedText.trim()})
        `);

        const { processAgentChatInternal } = await import("../routes/ai-autonomy-router");
        const aiResponse = await processAgentChatInternal(consultantId, aiRole, messageWithContext, {
          skipUserMessageInsert: true,
          metadata: { source: "telegram", telegram_chat_id: chatId, chat_type: chatType, chat_title: chatTitle, sender_id: senderId, sender_name: firstName, sender_username: username },
          source: "telegram",
          isOpenMode: true,
          telegramChatId: chatId,
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
