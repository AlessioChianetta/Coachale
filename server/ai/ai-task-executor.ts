import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKeyForClassifier, GEMINI_3_MODEL } from "./provider-factory";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logActivity } from "../cron/ai-task-scheduler";
import { ExecutionStep } from "./autonomous-decision-engine";
import { fileSearchService } from "./file-search-service";

const LOG_PREFIX = "⚙️ [TASK-EXECUTOR]";

export interface AITaskInfo {
  id: string;
  consultant_id: string;
  contact_id: string | null;
  contact_phone: string;
  contact_name: string | null;
  ai_instruction: string;
  task_category: string;
  priority: number;
  timezone: string;
}

export interface StepExecutionResult {
  success: boolean;
  result: Record<string, any>;
  error?: string;
  duration_ms: number;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`${LOG_PREFIX} Retry ${attempt + 1}/${maxRetries} after ${delay}ms (${err.message})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

function generateScheduledCallId(): string {
  return `sc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export async function executeStep(
  task: AITaskInfo,
  step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<StepExecutionResult> {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} Executing step ${step.step}: ${step.action} - ${step.description}`);

  try {
    let result: Record<string, any>;

    switch (step.action) {
      case "fetch_client_data":
        result = await handleFetchClientData(task, step, previousResults);
        break;
      case "search_private_stores":
        result = await handleSearchPrivateStores(task, step, previousResults);
        break;
      case "analyze_patterns":
        result = await handleAnalyzePatterns(task, step, previousResults);
        break;
      case "generate_report":
        result = await handleGenerateReport(task, step, previousResults);
        break;
      case "prepare_call":
        result = await handlePrepareCall(task, step, previousResults);
        break;
      case "voice_call":
        result = await handleVoiceCall(task, step, previousResults);
        break;
      case "send_email":
        result = await handleSendEmail(task, step, previousResults);
        break;
      case "send_whatsapp":
        result = await handleSendWhatsapp(task, step, previousResults);
        break;
      case "web_search":
        result = await handleWebSearch(task, step, previousResults);
        break;
      default:
        throw new Error(`Unknown step action: ${step.action}`);
    }

    const duration_ms = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Step ${step.step} (${step.action}) completed in ${duration_ms}ms`);

    let enrichedDescription = step.description;

    if (step.action === 'fetch_client_data' && result) {
      enrichedDescription = `Dati recuperati per ${result.contact?.first_name || 'N/A'} ${result.contact?.last_name || ''}. Task recenti: ${result.recent_tasks?.length || 0}`;
    } else if (step.action === 'search_private_stores' && result) {
      enrichedDescription = `Trovati ${result.documents_found || 0} documenti in ${result.stores_searched || 0} archivi. ${result.findings_summary?.substring(0, 200) || ''}`;
    } else if (step.action === 'analyze_patterns' && result) {
      enrichedDescription = `Analisi completata. Score: ${result.engagement_score || 'N/A'}/100. Rischio: ${result.risk_assessment?.level || 'N/A'}. ${result.insights?.length || 0} insight, ${result.recommendations?.length || 0} raccomandazioni. Approccio: ${result.suggested_approach?.substring(0, 150) || ''}`;
    } else if (step.action === 'web_search' && result) {
      enrichedDescription = `Ricerca web: "${result.search_query?.substring(0, 80) || 'N/A'}". ${result.sources?.length || 0} fonti trovate. ${result.findings?.substring(0, 200) || ''}`;
    } else if (step.action === 'generate_report' && result) {
      enrichedDescription = `Report: "${result.title || 'N/A'}". ${result.sections?.length || 0} sezioni, ${result.key_findings?.length || 0} risultati chiave, ${result.recommendations?.length || 0} raccomandazioni.`;
    } else if (step.action === 'prepare_call' && result) {
      enrichedDescription = `Chiamata preparata: ${result.talking_points?.length || 0} punti di discussione. Priorità: ${result.call_priority || 'N/A'}. Durata stimata: ${result.call_duration_estimate_minutes || 'N/A'} min.`;
    } else if (step.action === 'voice_call' && result) {
      enrichedDescription = `Chiamata programmata a ${result.target_phone || 'N/A'}. ID: ${result.call_id || 'N/A'}. Status: ${result.status || 'N/A'}.`;
    } else if (step.action === 'send_email' && result) {
      enrichedDescription = `Email ${result.status === 'sent' ? 'inviata' : result.status === 'skipped' ? 'saltata' : 'fallita'} a ${result.recipient || task.contact_name || 'N/A'}. ${result.subject ? `Oggetto: "${result.subject}"` : ''} ${result.has_attachment ? 'Con PDF allegato.' : ''}`;
    } else if (step.action === 'send_whatsapp' && result) {
      enrichedDescription = `WhatsApp ${result.status === 'sent' ? 'inviato' : result.status === 'skipped' ? 'saltato' : 'fallito'} a ${result.target_phone || task.contact_name || 'N/A'}. ${result.message_preview ? `"${result.message_preview}"` : ''}`;
    }

    await logActivity(task.consultant_id, {
      event_type: `step_${step.action}_completed`,
      title: `Step ${step.step} completato: ${step.action}`,
      description: enrichedDescription,
      icon: "⚙️",
      severity: "info",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return { success: true, result, duration_ms };
  } catch (error: any) {
    const duration_ms = Date.now() - startTime;
    console.error(`${LOG_PREFIX} Step ${step.step} (${step.action}) failed after ${duration_ms}ms:`, error.message);

    await logActivity(task.consultant_id, {
      event_type: `step_${step.action}_failed`,
      title: `Step ${step.step} fallito: ${step.action}`,
      description: error.message,
      icon: "❌",
      severity: "error",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return { success: false, result: {}, error: error.message, duration_ms };
  }
}

async function handleFetchClientData(
  task: AITaskInfo,
  _step: ExecutionStep,
  _previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  console.log(`${LOG_PREFIX} Fetching client data for contact_id=${task.contact_id}, phone=${task.contact_phone}`);

  let contactData: Record<string, any> | null = null;

  if (task.contact_id) {
    const contactResult = await db.execute(sql`
      SELECT id, first_name, last_name, email, phone_number, role, level,
             consultant_id, is_active, enrolled_at, created_at
      FROM users
      WHERE id = ${task.contact_id}
      LIMIT 1
    `);
    if (contactResult.rows.length > 0) {
      const row = contactResult.rows[0] as any;
      contactData = {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone_number: row.phone_number,
        role: row.role,
        level: row.level,
        is_active: row.is_active,
        enrolled_at: row.enrolled_at,
        created_at: row.created_at,
      };
    }
  }

  if (!contactData && task.contact_phone) {
    const phoneResult = await db.execute(sql`
      SELECT id, first_name, last_name, email, phone_number, role, level,
             consultant_id, is_active, enrolled_at, created_at
      FROM users
      WHERE phone_number = ${task.contact_phone}
      LIMIT 1
    `);
    if (phoneResult.rows.length > 0) {
      const row = phoneResult.rows[0] as any;
      contactData = {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone_number: row.phone_number,
        role: row.role,
        level: row.level,
        is_active: row.is_active,
        enrolled_at: row.enrolled_at,
        created_at: row.created_at,
      };
    }
  }

  const contactIdForQuery = contactData?.id || task.contact_id;
  let recentTasks: any[] = [];

  if (contactIdForQuery) {
    const tasksResult = await db.execute(sql`
      SELECT id, task_type, task_category, status, ai_instruction,
             scheduled_at, result_summary, priority
      FROM ai_scheduled_tasks
      WHERE contact_id = ${contactIdForQuery}
      ORDER BY scheduled_at DESC
      LIMIT 10
    `);
    recentTasks = tasksResult.rows.map((row: any) => ({
      id: row.id,
      task_type: row.task_type,
      task_category: row.task_category,
      status: row.status,
      ai_instruction: row.ai_instruction,
      scheduled_at: row.scheduled_at,
      result_summary: row.result_summary,
      priority: row.priority,
    }));
  }

  console.log(`${LOG_PREFIX} Client data fetched: contact=${contactData ? "found" : "not found"}, recent_tasks=${recentTasks.length}`);

  return {
    contact: contactData || {
      phone_number: task.contact_phone,
      name: task.contact_name,
    },
    recent_tasks: recentTasks,
    contact_found: !!contactData,
  };
}

async function handleSearchPrivateStores(
  task: AITaskInfo,
  _step: ExecutionStep,
  _previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  console.log(`${LOG_PREFIX} Searching private stores for consultant=${task.consultant_id}, contact=${task.contact_id || 'N/A'}`);

  let storeNames: string[] = [];

  if (task.contact_id) {
    try {
      const clientStores = await fileSearchService.getStoreNamesForClient(task.contact_id, task.consultant_id);
      storeNames.push(...clientStores);
    } catch (err: any) {
      console.warn(`${LOG_PREFIX} Failed to get client stores: ${err.message}`);
    }
  }

  storeNames = [...new Set(storeNames)];

  if (storeNames.length === 0) {
    console.log(`${LOG_PREFIX} No private stores found, skipping file search`);
    return {
      documents_found: 0,
      stores_searched: 0,
      store_breakdown: [],
      findings_summary: "Nessun archivio privato disponibile per questo consulente/contatto.",
      citations: [],
      search_query: task.ai_instruction,
    };
  }

  let breakdown: any[] = [];
  try {
    const breakdownResult = await fileSearchService.getStoreBreakdownForGeneration(task.consultant_id, 'consultant');
    breakdown = breakdownResult.breakdown;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Failed to get store breakdown: ${err.message}`);
  }

  const storeProgressMessages = [
    { message: "Cerco nelle consulenze passate...", icon: "📋" },
    { message: "Analizzo esercizi del cliente...", icon: "📝" },
    { message: "Consulto la knowledge base...", icon: "📚" },
    { message: "Cerco nella libreria del consulente...", icon: "🗂️" },
  ];

  for (const progress of storeProgressMessages.slice(0, Math.min(storeNames.length, storeProgressMessages.length))) {
    await logActivity(task.consultant_id, {
      event_type: "step_search_store_progress",
      title: progress.message,
      description: `Ricerca in ${storeNames.length} archivi privati`,
      icon: progress.icon,
      severity: "info",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });
  }

  const fileSearchTool = fileSearchService.buildFileSearchTool(storeNames);
  if (!fileSearchTool) {
    console.log(`${LOG_PREFIX} buildFileSearchTool returned null, no valid stores`);
    return {
      documents_found: 0,
      stores_searched: storeNames.length,
      store_breakdown: breakdown,
      findings_summary: "Nessun archivio valido trovato dopo la validazione.",
      citations: [],
      search_query: task.ai_instruction,
    };
  }

  let ai = await fileSearchService.getClientForUser(task.consultant_id);
  if (!ai) {
    const fallbackKey = await getGeminiApiKeyForClassifier();
    if (!fallbackKey) throw new Error("No Gemini API key available for file search");
    ai = new GoogleGenAI({ apiKey: fallbackKey, apiVersion: 'v1beta' });
    console.log(`${LOG_PREFIX} Using fallback API key for file search`);
  }

  const searchPrompt = `Sei un assistente AI per consulenti. Cerca nei documenti privati informazioni rilevanti per questo task.

ISTRUZIONE TASK: ${task.ai_instruction}
CATEGORIA: ${task.task_category}
CONTATTO: ${task.contact_name || 'N/A'}

Cerca specificamente:
1. Note di consulenze passate con questo contatto
2. Esercizi assegnati e risposte
3. Documenti della knowledge base pertinenti
4. Contesto dalla libreria del consulente

Riassumi le informazioni trovate in modo strutturato.`;

  const response = await withRetry(async () => {
    return await ai!.models.generateContent({
      model: GEMINI_3_MODEL,
      contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
      config: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        tools: [fileSearchTool],
      },
    });
  });

  const text = response.text || "";
  console.log(`${LOG_PREFIX} File search response length: ${text.length}`);

  const citations = fileSearchService.parseCitations(response);
  console.log(`${LOG_PREFIX} File search completed: ${citations.length} citations from ${storeNames.length} stores`);

  return {
    documents_found: citations.length,
    stores_searched: storeNames.length,
    store_breakdown: breakdown,
    findings_summary: text,
    citations: citations.map(c => ({ source: c.sourceTitle, content: c.content })),
    search_query: task.ai_instruction,
  };
}

async function handleAnalyzePatterns(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const clientData = previousResults.fetch_client_data || previousResults;

  const privateStoreData = previousResults.search_private_stores;
  const privateStoreSection = privateStoreData
    ? `\nDOCUMENTI PRIVATI TROVATI:\n${privateStoreData.findings_summary || "Nessun documento privato trovato"}\n\nCITAZIONI:\n${privateStoreData.citations?.map((c: any) => `- ${c.source}: ${c.content}`).join('\n') || "Nessuna citazione"}\n`
    : "";

  const prompt = `Sei un analista AI senior. Il tuo compito è analizzare in modo DETTAGLIATO e APPROFONDITO la situazione del cliente basandoti esclusivamente sui dati e documenti disponibili.

IMPORTANTE: La tua analisi deve essere COMPLETA e DETTAGLIATA (almeno 2000 caratteri totali nel JSON). Analizza TUTTI i dati disponibili, incluse TUTTE le citazioni dai documenti privati. Non essere generico - fornisci insight specifici con esempi concreti dai dati.

=== DATI CLIENTE ===
${JSON.stringify(clientData.contact || {}, null, 2)}

=== TASK RECENTI DEL CLIENTE ===
${JSON.stringify(clientData.recent_tasks || [], null, 2)}
${privateStoreSection}
=== ISTRUZIONE ORIGINALE DEL TASK ===
${task.ai_instruction}

=== CATEGORIA TASK ===
${task.task_category}

ANALIZZA IN DETTAGLIO LE SEGUENTI AREE:
1. **Profilo Cliente**: Chi è questo cliente? Qual è la sua situazione complessiva? Da quanto tempo è seguito? Livello di engagement?
2. **Punti di Forza**: Quali sono i punti di forza del cliente emersi dai dati? Cosa fa bene? Dove mostra impegno?
3. **Punti di Debolezza**: Dove il cliente mostra difficoltà? Quali aree necessitano miglioramento? Ci sono pattern negativi?
4. **Opportunità**: Quali opportunità di crescita esistono? Come può il consulente aiutare meglio?
5. **Pattern Comportamentali**: Come si comporta il cliente nelle consulenze? Completa gli esercizi? È puntuale? È proattivo?
6. **Insight dalle Consulenze Passate**: Cosa emerge dalle note delle consulenze precedenti? Quali temi ricorrono? Quali progressi sono stati fatti?
7. **Valutazione del Rischio**: C'è rischio di abbandono? Il cliente è soddisfatto? Ci sono segnali di allarme?
8. **Raccomandazioni Operative**: Cosa dovrebbe fare concretamente il consulente? Con quali priorità?

USA TUTTI i dati delle citazioni dei documenti privati per supportare ogni insight con esempi specifici.

Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura:
{
  "client_profile_summary": "riassunto completo della situazione del cliente, almeno 300 caratteri, includendo background, situazione attuale, e contesto generale",
  "strengths": ["punto di forza 1 con spiegazione dettagliata ed esempio dai dati", "punto di forza 2 con spiegazione..."],
  "weaknesses": ["debolezza 1 con spiegazione dettagliata ed esempio dai dati", "debolezza 2 con spiegazione..."],
  "opportunities": ["opportunità 1 con spiegazione dettagliata e come sfruttarla", "opportunità 2 con spiegazione..."],
  "behavioral_patterns": ["pattern comportamentale 1 osservato nei dati", "pattern 2..."],
  "past_consultation_insights": ["insight dalla consulenza passata 1 con dettagli specifici", "insight 2..."],
  "insights": ["insight dettagliato e actionable 1", "insight dettagliato 2", ...],
  "risk_assessment": {
    "level": "low|medium|high",
    "factors": ["fattore di rischio 1 con spiegazione", "fattore 2..."],
    "description": "descrizione dettagliata del livello di rischio, almeno 200 caratteri, con motivazioni specifiche basate sui dati"
  },
  "recommendations": ["raccomandazione operativa dettagliata 1 con azione concreta", "raccomandazione 2..."],
  "engagement_score": 0-100,
  "suggested_approach": "descrizione dettagliata dell'approccio suggerito per il prossimo contatto con il cliente, almeno 300 caratteri, includendo tono, argomenti da trattare, e obiettivi specifici",
  "key_topics": ["argomento chiave 1", "argomento 2", ...]
}`;

  const apiKey = await getGeminiApiKeyForClassifier();
  if (!apiKey) throw new Error("No Gemini API key available");
  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(async () => {
    return await ai.models.generateContent({
      model: GEMINI_3_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.3, maxOutputTokens: 16384 },
    });
  });

  const text = response.text || "";
  console.log(`${LOG_PREFIX} Gemini analysis response length: ${text.length}`);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (parseError: any) {
    console.warn(`${LOG_PREFIX} Failed to parse analysis JSON, returning raw text`);
  }

  return {
    client_profile_summary: text.substring(0, 500),
    strengths: [],
    weaknesses: [],
    opportunities: [],
    behavioral_patterns: [],
    past_consultation_insights: [],
    insights: ["Analisi completata - risultato in formato testo"],
    risk_assessment: { level: "medium", factors: [], description: text.substring(0, 500) },
    recommendations: [],
    engagement_score: 50,
    suggested_approach: text.substring(0, 300),
    key_topics: [],
    raw_response: text,
  };
}

async function handleGenerateReport(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const analysisData = previousResults.analyze_patterns || previousResults;
  const clientData = previousResults.fetch_client_data || {};

  const privateStoreData = previousResults.search_private_stores;
  const privateStoreSection = privateStoreData
    ? `\nDOCUMENTI PRIVATI TROVATI:\n${privateStoreData.findings_summary || "Nessun documento privato trovato"}\n\nCITAZIONI:\n${privateStoreData.citations?.map((c: any) => `- ${c.source}: ${c.content}`).join('\n') || "Nessuna citazione"}\n`
    : "";

  const prompt = `Sei un assistente AI senior. Genera un report COMPLETO, DETTAGLIATO e APPROFONDITO basato sull'analisi seguente, adattandoti al contesto specifico del cliente e della sua attività.

Hai carta bianca sulla struttura del report se le sezioni personalizzate sono fornite. L'obiettivo è creare il report più utile possibile per il consulente.

IMPORTANTE: Il report deve essere esaustivo e ricco di dettagli. Ogni sezione deve contenere almeno 200 caratteri di contenuto. Includi dati specifici, citazioni dai documenti privati, e raccomandazioni operative concrete.

=== ANALISI COMPLETA ===
${JSON.stringify(analysisData, null, 2)}

=== DATI CLIENTE ===
${JSON.stringify(clientData.contact || {}, null, 2)}
${privateStoreSection}
=== ISTRUZIONE ORIGINALE ===
${task.ai_instruction}

${_step.params?.custom_sections && Array.isArray(_step.params.custom_sections) && _step.params.custom_sections.length > 0
  ? `STRUTTURA PERSONALIZZATA DEL REPORT - Usa queste sezioni:\n${_step.params.custom_sections.map((s: string, i: number) => `${i+1}. ${s}`).join('\n')}`
  : `STRUTTURA DEL REPORT - Includi TUTTE le seguenti sezioni:
1. Panoramica Cliente - Background completo, situazione attuale, contesto
2. Analisi della Situazione - Dettagli approfonditi su cosa emerge dai dati
3. Punti di Forza e Debolezza - Con esempi specifici dai documenti
4. Pattern e Tendenze - Comportamenti ricorrenti, trend osservati
5. Valutazione del Rischio - Analisi dettagliata dei fattori di rischio
6. Piano d'Azione - Raccomandazioni operative concrete e prioritizzate
7. Prossimi Passi - Azioni immediate con timeline suggerita`}

Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura:
{
  "title": "Titolo descrittivo del report",
  "summary": "Riepilogo esecutivo dettagliato in 3-5 frasi che cattura i punti essenziali",
  "sections": [
    {
      "heading": "Titolo sezione",
      "content": "Contenuto dettagliato della sezione (almeno 200 caratteri per sezione)"
    }
  ],
  "key_findings": ["risultato chiave dettagliato 1", "risultato chiave dettagliato 2", ...],
  "recommendations": [
    {
      "action": "azione consigliata dettagliata",
      "priority": "high|medium|low",
      "rationale": "motivazione dettagliata basata sui dati"
    }
  ],
  "next_steps": ["passo successivo concreto 1 con timeline", "passo successivo 2", ...]
}`;

  const apiKey = await getGeminiApiKeyForClassifier();
  if (!apiKey) throw new Error("No Gemini API key available");
  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(async () => {
    return await ai.models.generateContent({
      model: GEMINI_3_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.3, maxOutputTokens: 16384 },
    });
  });

  const text = response.text || "";
  console.log(`${LOG_PREFIX} Gemini report response length: ${text.length}`);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (parseError: any) {
    console.warn(`${LOG_PREFIX} Failed to parse report JSON, returning raw text`);
  }

  return {
    title: "Report Analisi Cliente",
    summary: text.substring(0, 300),
    sections: [{ heading: "Analisi", content: text }],
    key_findings: [],
    recommendations: [],
    next_steps: [],
    raw_response: text,
  };
}

async function handlePrepareCall(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const analysisData = previousResults.analyze_patterns || {};
  const reportData = previousResults.generate_report || {};
  const clientData = previousResults.fetch_client_data || {};

  const prompt = `Sei un assistente AI per consulenti.
Prepara i punti chiave per una telefonata con il cliente, adattandoti al suo contesto specifico.

DATI CLIENTE:
Nome: ${task.contact_name || clientData.contact?.first_name || "N/A"}
Telefono: ${task.contact_phone}

ANALISI PRECEDENTE:
${JSON.stringify(analysisData, null, 2)}

REPORT:
${JSON.stringify(reportData, null, 2)}

ISTRUZIONE ORIGINALE:
${task.ai_instruction}

CATEGORIA: ${task.task_category}

Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura:
{
  "talking_points": [
    {
      "topic": "argomento",
      "key_message": "messaggio principale",
      "supporting_details": "dettagli di supporto",
      "tone": "professionale|empatico|urgente|informativo"
    }
  ],
  "opening_script": "frase di apertura suggerita",
  "closing_script": "frase di chiusura suggerita",
  "objection_responses": [
    {
      "objection": "possibile obiezione",
      "response": "risposta suggerita"
    }
  ],
  "call_duration_estimate_minutes": 5,
  "call_priority": "high|medium|low",
  "preferred_call_time": "HH:MM",
  "preferred_call_date": "YYYY-MM-DD",
  "timing_reasoning": "spiegazione del perché questo orario è ottimale"
}`;

  const apiKey = await getGeminiApiKeyForClassifier();
  if (!apiKey) throw new Error("No Gemini API key available");
  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(async () => {
    return await ai.models.generateContent({
      model: GEMINI_3_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.4, maxOutputTokens: 4096 },
    });
  });

  const text = response.text || "";
  console.log(`${LOG_PREFIX} Gemini call prep response length: ${text.length}`);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (_step.params?.preferred_time && !parsed.preferred_call_time) {
        parsed.preferred_call_time = _step.params.preferred_time;
      }
      if (_step.params?.preferred_date && !parsed.preferred_call_date) {
        parsed.preferred_call_date = _step.params.preferred_date;
      }
      return parsed;
    }
  } catch (parseError: any) {
    console.warn(`${LOG_PREFIX} Failed to parse call prep JSON, returning raw text`);
  }

  return {
    talking_points: [
      {
        topic: task.task_category,
        key_message: task.ai_instruction,
        supporting_details: "",
        tone: "professionale",
      },
    ],
    opening_script: `Buongiorno, sono il suo consulente. La chiamo per ${task.ai_instruction}`,
    closing_script: "La ringrazio per il suo tempo. Restiamo in contatto.",
    objection_responses: [],
    call_duration_estimate_minutes: 5,
    call_priority: "medium",
    preferred_call_time: _step.params?.preferred_time || null,
    preferred_call_date: _step.params?.preferred_date || null,
    raw_response: text,
  };
}

async function handleVoiceCall(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const callPrep = previousResults.prepare_call || {};

  const talkingPoints = callPrep.talking_points || [];
  const talkingPointsText = talkingPoints
    .map((tp: any) => `- ${tp.topic}: ${tp.key_message}`)
    .join("\n");

  const customPrompt = callPrep.opening_script
    ? `${callPrep.opening_script}\n\nPunti chiave:\n${talkingPointsText}\n\n${callPrep.closing_script || ""}`
    : task.ai_instruction;

  const scheduledCallId = generateScheduledCallId();

  const preferredDate = callPrep.preferred_call_date || _step.params?.preferred_date;
  const preferredTime = callPrep.preferred_call_time || _step.params?.preferred_time;
  let scheduledAtSql = sql`NOW()`;

  if (preferredDate && preferredTime) {
    const dateTimeStr = `${preferredDate} ${preferredTime}:00`;
    scheduledAtSql = sql`${dateTimeStr}::timestamp AT TIME ZONE 'Europe/Rome'`;
    console.log(`${LOG_PREFIX} Scheduling call at preferred time: ${dateTimeStr} (Europe/Rome)`);
  } else if (preferredDate) {
    const dateTimeStr = `${preferredDate} 10:00:00`;
    scheduledAtSql = sql`${dateTimeStr}::timestamp AT TIME ZONE 'Europe/Rome'`;
    console.log(`${LOG_PREFIX} Scheduling call at preferred date: ${preferredDate} 10:00 (Europe/Rome)`);
  }

  console.log(`${LOG_PREFIX} Creating scheduled voice call ${scheduledCallId} for task ${task.id}`);

  await db.execute(sql`
    INSERT INTO scheduled_voice_calls (
      id, consultant_id, target_phone, scheduled_at, status, ai_mode,
      custom_prompt, call_instruction, instruction_type, attempts, max_attempts,
      priority, source_task_id, attempts_log, use_default_template, created_at, updated_at
    ) VALUES (
      ${scheduledCallId}, ${task.consultant_id}, ${task.contact_phone},
      ${scheduledAtSql}, 'scheduled', 'assistenza',
      ${customPrompt}, ${customPrompt},
      'task', 0, 3,
      ${task.priority || 1}, ${task.id}, '[]'::jsonb, true, NOW(), NOW()
    )
  `);

  const childTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  await db.execute(sql`
    INSERT INTO ai_scheduled_tasks (
      id, consultant_id, contact_phone, contact_name, task_type, ai_instruction,
      scheduled_at, timezone, status, priority, parent_task_id,
      contact_id, task_category, voice_call_id,
      max_attempts, current_attempt, retry_delay_minutes,
      created_at, updated_at
    ) VALUES (
      ${childTaskId}, ${task.consultant_id}, ${task.contact_phone},
      ${task.contact_name}, 'single_call', ${customPrompt},
      ${scheduledAtSql}, ${task.timezone || "Europe/Rome"}, 'scheduled', ${task.priority || 1}, ${task.id},
      ${task.contact_id}, ${task.task_category}, ${scheduledCallId},
      3, 0, 5,
      NOW(), NOW()
    )
  `);

  console.log(`${LOG_PREFIX} Created child task ${childTaskId} with voice_call_id ${scheduledCallId}`);

  return {
    call_id: scheduledCallId,
    child_task_id: childTaskId,
    target_phone: task.contact_phone,
    custom_prompt: customPrompt,
    status: "scheduled",
    scheduled_at: preferredDate && preferredTime ? `${preferredDate} ${preferredTime}` : "now",
  };
}

function generateServerPdfContent(report: any, analysis: any, task: AITaskInfo): string {
  const lines: string[] = [];
  lines.push(`═══════════════════════════════════════`);
  lines.push(report.title || 'Report AI');
  lines.push(`Cliente: ${task.contact_name || 'N/A'}`);
  lines.push(`Data: ${new Date().toLocaleDateString('it-IT')}`);
  lines.push(`═══════════════════════════════════════\n`);

  if (report.summary) {
    lines.push(`RIEPILOGO`);
    lines.push(report.summary);
    lines.push('');
  }

  if (report.sections && Array.isArray(report.sections)) {
    for (const section of report.sections) {
      lines.push(`\n--- ${section.heading} ---`);
      lines.push(section.content);
    }
  }

  if (report.key_findings && Array.isArray(report.key_findings)) {
    lines.push(`\n--- Risultati Chiave ---`);
    for (const f of report.key_findings) {
      lines.push(`• ${f}`);
    }
  }

  if (report.recommendations && Array.isArray(report.recommendations)) {
    lines.push(`\n--- Raccomandazioni ---`);
    for (const r of report.recommendations) {
      const priority = r.priority === 'high' ? '[ALTA]' : r.priority === 'medium' ? '[MEDIA]' : '[BASSA]';
      lines.push(`${priority} ${r.action}`);
      if (r.rationale) lines.push(`  → ${r.rationale}`);
    }
  }

  if (report.next_steps && Array.isArray(report.next_steps)) {
    lines.push(`\n--- Prossimi Passi ---`);
    report.next_steps.forEach((s: string, i: number) => {
      lines.push(`${i+1}. ${s}`);
    });
  }

  return lines.join('\n');
}

async function handleSendEmail(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const clientData = previousResults.fetch_client_data || {};
  const reportData = previousResults.generate_report || {};
  const analysisData = previousResults.analyze_patterns || {};
  const contactEmail = clientData.contact?.email;

  if (!contactEmail) {
    return { status: "skipped", reason: "Nessun indirizzo email disponibile per il contatto" };
  }

  const smtpResult = await db.execute(sql`
    SELECT smtp_host, smtp_port, smtp_user, smtp_password, email_address, display_name
    FROM email_accounts
    WHERE consultant_id = ${task.consultant_id} AND smtp_host IS NOT NULL
    LIMIT 1
  `);

  if (smtpResult.rows.length === 0) {
    return { status: "skipped", reason: "Nessun account email SMTP configurato per il consulente" };
  }

  const smtpConfig = smtpResult.rows[0] as any;

  const emailSubject = _step.params?.subject || `Report: ${reportData.title || task.task_category}`;
  let emailBody = _step.params?.message_summary || "";

  if (!emailBody) {
    const apiKey = await getGeminiApiKeyForClassifier();
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const emailPrompt = `Scrivi un'email BREVE (massimo 3-4 frasi) e professionale per il cliente ${task.contact_name || 'N/A'}.
Contesto: ${task.ai_instruction}
${reportData.title ? `Report allegato: "${reportData.title}"` : ''}
${reportData.summary ? `Riepilogo: ${reportData.summary.substring(0, 200)}` : ''}
NON scrivere un papiro. Il dettaglio è nel PDF allegato. Scrivi solo il corpo dell'email (senza oggetto, senza "Gentile..." all'inizio, inizia direttamente con il contenuto).`;

      const resp = await withRetry(() => ai.models.generateContent({
        model: GEMINI_3_MODEL,
        contents: [{ role: "user", parts: [{ text: emailPrompt }] }],
        config: { temperature: 0.4, maxOutputTokens: 512 },
      }));
      emailBody = resp.text || "";
    }
  }

  const htmlBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <p>Gentile ${task.contact_name || 'Cliente'},</p>
    <p>${emailBody.replace(/\n/g, '</p><p>')}</p>
    ${reportData.title ? '<p><em>In allegato trova il report dettagliato.</em></p>' : ''}
    <p>Cordiali saluti</p>
  </div>`;

  let attachments: any[] = [];
  if (reportData && reportData.title) {
    const pdfContent = generateServerPdfContent(reportData, analysisData, task);
    attachments.push({
      filename: `report_${(task.contact_name || 'cliente').replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
      content: pdfContent,
    });
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port || 587,
      secure: (smtpConfig.smtp_port || 587) === 465,
      auth: { user: smtpConfig.smtp_user, pass: smtpConfig.smtp_password },
      tls: { rejectUnauthorized: false },
    });

    const mailOptions: any = {
      from: smtpConfig.display_name ? `"${smtpConfig.display_name}" <${smtpConfig.email_address}>` : smtpConfig.email_address,
      to: contactEmail,
      subject: emailSubject,
      html: htmlBody,
    };

    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const sendResult = await transporter.sendMail(mailOptions);

    await logActivity(task.consultant_id, {
      event_type: "email_sent",
      title: `Email inviata a ${task.contact_name || contactEmail}`,
      description: `Oggetto: "${emailSubject}". ${attachments.length > 0 ? 'Report allegato.' : 'Senza allegati.'}`,
      icon: "📧",
      severity: "info",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return {
      status: "sent",
      message_id: sendResult.messageId,
      recipient: contactEmail,
      subject: emailSubject,
      has_attachment: attachments.length > 0,
    };
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Email send failed:`, error.message);

    await logActivity(task.consultant_id, {
      event_type: "email_failed",
      title: `Email fallita per ${task.contact_name || contactEmail}`,
      description: error.message,
      icon: "❌",
      severity: "error",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return {
      status: "failed",
      error: error.message,
      recipient: contactEmail,
      subject: emailSubject,
    };
  }
}

async function handleSendWhatsapp(
  task: AITaskInfo,
  _step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  const reportData = previousResults.generate_report || {};

  if (!task.contact_phone) {
    return { status: "skipped", reason: "Nessun numero di telefono disponibile" };
  }

  let messageText = _step.params?.message_summary || "";

  if (!messageText) {
    const apiKey = await getGeminiApiKeyForClassifier();
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const whatsappPrompt = `Scrivi un messaggio WhatsApp BREVE (massimo 2-3 frasi) e professionale per ${task.contact_name || 'il cliente'}.
Contesto: ${task.ai_instruction}
${reportData.title ? `Report preparato: "${reportData.title}"` : ''}
${reportData.summary ? `Riepilogo: ${reportData.summary.substring(0, 150)}` : ''}
NON fare un papiro. Massimo 2-3 frasi. Sii diretto e cordiale. Se c'è un report, menziona che lo riceverà via email.`;

      const resp = await withRetry(() => ai.models.generateContent({
        model: GEMINI_3_MODEL,
        contents: [{ role: "user", parts: [{ text: whatsappPrompt }] }],
        config: { temperature: 0.5, maxOutputTokens: 256 },
      }));
      messageText = resp.text || `Buongiorno ${task.contact_name || ''}, la contatto per aggiornarla.`;
    }
  }

  try {
    const { sendWhatsAppMessage } = await import('../whatsapp/twilio-client');
    const messageSid = await sendWhatsAppMessage(
      task.consultant_id,
      task.contact_phone,
      messageText,
    );

    await logActivity(task.consultant_id, {
      event_type: "whatsapp_sent",
      title: `WhatsApp inviato a ${task.contact_name || task.contact_phone}`,
      description: `Messaggio: "${messageText.substring(0, 100)}..."`,
      icon: "💬",
      severity: "info",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return {
      status: "sent",
      message_sid: messageSid,
      target_phone: task.contact_phone,
      message_preview: messageText.substring(0, 100),
    };
  } catch (error: any) {
    console.error(`${LOG_PREFIX} WhatsApp send failed:`, error.message);

    await logActivity(task.consultant_id, {
      event_type: "whatsapp_failed",
      title: `WhatsApp fallito per ${task.contact_name || task.contact_phone}`,
      description: error.message,
      icon: "❌",
      severity: "error",
      task_id: task.id,
      contact_name: task.contact_name,
      contact_id: task.contact_id,
    });

    return {
      status: "failed",
      error: error.message,
      target_phone: task.contact_phone,
    };
  }
}

async function handleWebSearch(
  task: AITaskInfo,
  step: ExecutionStep,
  previousResults: Record<string, any>,
): Promise<Record<string, any>> {
  let searchQuery = step.params?.search_topic || step.params?.search_query || "";
  const analysisData = previousResults.analyze_patterns || {};
  const clientData = previousResults.fetch_client_data || {};
  const contactName = task.contact_name || clientData.contact?.first_name || "N/A";

  if (!searchQuery || searchQuery.length < 10) {
    searchQuery = task.ai_instruction || "ricerca generica";
  }

  if (searchQuery.length > 100) {
    console.log(`${LOG_PREFIX} Search query too long (${searchQuery.length} chars), generating focused queries with Gemini`);
    try {
      const queryGenApiKey = await getGeminiApiKeyForClassifier();
      if (queryGenApiKey) {
        const queryGenAi = new GoogleGenAI({ apiKey: queryGenApiKey });
        const keyTopics = analysisData.key_topics || [];
        const queryGenPrompt = `Based on the following task context, generate 2-3 concise, focused web search queries (each max 10 words) that would find the most relevant information. Return ONLY the queries, one per line.

Task instruction: ${task.ai_instruction.substring(0, 300)}
Client name: ${contactName}
Task category: ${task.task_category}
${keyTopics.length > 0 ? `Key topics: ${keyTopics.join(', ')}` : ''}
${step.description ? `Step description: ${step.description}` : ''}`;

        const queryGenResponse = await withRetry(async () => {
          return await queryGenAi.models.generateContent({
            model: GEMINI_3_MODEL,
            contents: [{ role: "user", parts: [{ text: queryGenPrompt }] }],
            config: { temperature: 0.3, maxOutputTokens: 256 },
          });
        });

        const generatedQueries = (queryGenResponse.text || "").trim().split('\n').filter((q: string) => q.trim().length > 0);
        if (generatedQueries.length > 0) {
          searchQuery = generatedQueries[0].trim().replace(/^\d+[\.\)]\s*/, '');
          console.log(`${LOG_PREFIX} Generated focused search query: "${searchQuery}" (from ${generatedQueries.length} candidates)`);
        }
      }
    } catch (queryGenErr: any) {
      console.warn(`${LOG_PREFIX} Failed to generate focused query, using truncated original: ${queryGenErr.message}`);
      searchQuery = searchQuery.substring(0, 100);
    }
  }

  console.log(`${LOG_PREFIX} Esecuzione ricerca web: "${searchQuery}"`);

  const prompt = `Sei un ricercatore AI. Cerca informazioni pertinenti al contesto del cliente e della sua attività.

RICERCA RICHIESTA:
${searchQuery}

CONTESTO CLIENTE:
Nome: ${contactName}
Categoria task: ${task.task_category}

${analysisData.key_topics ? `ARGOMENTI CORRELATI: ${JSON.stringify(analysisData.key_topics)}` : ""}

ISTRUZIONE ORIGINALE:
${task.ai_instruction}

Cerca informazioni aggiornate e pertinenti su internet riguardo alla ricerca richiesta.
Concentrati su:
1. Informazioni rilevanti per il settore e l'attività del cliente
2. Andamenti di mercato e trend del settore
3. Notizie recenti pertinenti
4. Dati statistici e benchmark utili
5. Best practice e strategie raccomandate dagli esperti

Fornisci una risposta strutturata e dettagliata con le informazioni trovate, citando le fonti quando possibile.`;

  const apiKey = await getGeminiApiKeyForClassifier();
  if (!apiKey) throw new Error("No Gemini API key available");
  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(async () => {
    return await ai.models.generateContent({
      model: GEMINI_3_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        tools: [{ googleSearch: {} }],
      },
    });
  });

  const text = response.text || "";
  console.log(`${LOG_PREFIX} Risposta ricerca web, lunghezza: ${text.length}`);

  const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
  const groundingChunks = groundingMetadata?.groundingChunks || [];
  const searchQueries = groundingMetadata?.webSearchQueries || [];

  const sources = groundingChunks
    .filter((chunk: any) => chunk.web)
    .map((chunk: any) => ({
      url: chunk.web.uri,
      title: chunk.web.title || "Fonte web",
    }));

  console.log(`${LOG_PREFIX} Ricerca web completata: ${sources.length} fonti trovate, ${searchQueries.length} query eseguite`);

  return {
    search_query: searchQuery,
    findings: text,
    sources,
    search_queries_used: searchQueries,
    grounding_metadata: groundingMetadata ? {
      queries: searchQueries,
      sources_count: sources.length,
    } : null,
  };
}
