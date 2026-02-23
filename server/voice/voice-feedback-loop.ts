import { db } from '../db';
import { sql } from 'drizzle-orm';

interface CallFeedbackData {
  callId: string;
  consultantId: string;
  clientId: string | null;
  transcript: string;
  duration: number;
  outcome: string;
  callerInfo?: any;
}

interface AlessiaMemoryEntry {
  summary: string;
  clientSaid: string;
  clientPromises: string[];
  nextSteps: string[];
  sentiment: string;
  objectiveAchieved: boolean | null;
  objectiveNotes: string;
  followUpNeeded: boolean;
  followUpDate: string | null;
  aiSelfEvaluation: {
    objective_reached: boolean;
    client_satisfaction: 'positive' | 'neutral' | 'negative' | 'unknown';
    key_insights: string[];
    improvements: string[];
    next_call_suggestions: string[];
  };
}

async function analyzeTranscriptWithAI(transcript: string, consultantId: string, clientId: string): Promise<AlessiaMemoryEntry | null> {
  try {
    const { getGeminiApiKey } = await import('../ai/key-provider');
    const apiKey = await getGeminiApiKey(consultantId);
    if (!apiKey) {
      console.log(`⚠️ [ALESSIA-FEEDBACK] No Gemini API key for consultant ${consultantId}`);
      return null;
    }

    const clientInfoResult = await db.execute(sql`
      SELECT first_name || ' ' || last_name as client_name
      FROM users WHERE id::text = ${clientId}::text LIMIT 1
    `);
    const clientName = (clientInfoResult.rows[0] as any)?.client_name || 'Cliente';

    const previousMemoryResult = await db.execute(sql`
      SELECT summary, client_promises, next_steps, sentiment
      FROM alessia_client_memory
      WHERE consultant_id = ${consultantId}::text AND client_id = ${clientId}::text
      ORDER BY interaction_date DESC LIMIT 3
    `);
    const previousContext = previousMemoryResult.rows.length > 0
      ? `\nCONTESTO PRECEDENTE:\n${previousMemoryResult.rows.map((r: any) => `- ${r.summary}`).join('\n')}`
      : '';

    const prompt = `Analizza questa trascrizione di una chiamata vocale tra l'assistente AI Alessia e il cliente ${clientName}.${previousContext}

TRASCRIZIONE:
${transcript}

Rispondi SOLO con JSON valido (senza markdown):
{
  "summary": "Riassunto breve della chiamata (max 300 caratteri)",
  "client_said": "Cosa ha detto/comunicato il cliente di rilevante (max 300 caratteri)",
  "client_promises": ["Lista di promesse/impegni del cliente - es. 'invierà i documenti entro venerdì'"],
  "next_steps": ["Prossimi passi concordati - es. 'richiamare lunedì per verifica'"],
  "sentiment": "positive|neutral|negative|concerned",
  "objective_achieved": true/false/null,
  "objective_notes": "Note su eventuali obiettivi specifici discussi (max 200 caratteri)",
  "follow_up_needed": true/false,
  "follow_up_days": 3,
  "self_evaluation": {
    "objective_reached": true/false,
    "client_satisfaction": "positive|neutral|negative|unknown",
    "key_insights": ["Insight chiave dalla conversazione"],
    "improvements": ["Cosa Alessia potrebbe migliorare nella prossima chiamata"],
    "next_call_suggestions": ["Suggerimenti per la prossima chiamata con questo cliente"]
  }
}`;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(text);

    const followUpDate = parsed.follow_up_needed && parsed.follow_up_days
      ? new Date(Date.now() + parsed.follow_up_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    return {
      summary: parsed.summary || 'Chiamata completata',
      clientSaid: parsed.client_said || '',
      clientPromises: parsed.client_promises || [],
      nextSteps: parsed.next_steps || [],
      sentiment: parsed.sentiment || 'neutral',
      objectiveAchieved: parsed.objective_achieved ?? null,
      objectiveNotes: parsed.objective_notes || '',
      followUpNeeded: parsed.follow_up_needed || false,
      followUpDate,
      aiSelfEvaluation: {
        objective_reached: parsed.self_evaluation?.objective_reached ?? false,
        client_satisfaction: parsed.self_evaluation?.client_satisfaction || 'unknown',
        key_insights: parsed.self_evaluation?.key_insights || [],
        improvements: parsed.self_evaluation?.improvements || [],
        next_call_suggestions: parsed.self_evaluation?.next_call_suggestions || [],
      },
    };
  } catch (error: any) {
    console.error(`❌ [ALESSIA-FEEDBACK] Error analyzing transcript:`, error.message);
    return null;
  }
}

export async function processCallFeedback(data: CallFeedbackData): Promise<void> {
  try {
    if (!data.clientId || !data.transcript || data.transcript.trim().length < 50) {
      console.log(`⏭️ [ALESSIA-FEEDBACK] Skipping feedback: ${!data.clientId ? 'no client' : 'transcript too short'}`);
      return;
    }

    if (data.duration < 10) {
      console.log(`⏭️ [ALESSIA-FEEDBACK] Skipping feedback: call too short (${data.duration}s)`);
      return;
    }

    console.log(`🧠 [ALESSIA-FEEDBACK] Analyzing call ${data.callId} for client ${data.clientId}...`);

    const analysis = await analyzeTranscriptWithAI(data.transcript, data.consultantId, data.clientId);

    if (!analysis) {
      await db.execute(sql`
        INSERT INTO alessia_client_memory (consultant_id, client_id, interaction_type, summary, call_id, source_transcript)
        VALUES (
          ${data.consultantId}::text,
          ${data.clientId}::text,
          'voice_call',
          ${'Chiamata completata (' + data.duration + 's) - analisi non disponibile'},
          ${data.callId},
          ${data.transcript.substring(0, 5000)}
        )
      `);
      console.log(`📝 [ALESSIA-FEEDBACK] Saved basic memory for call ${data.callId} (AI analysis unavailable)`);
      return;
    }

    await db.execute(sql`
      INSERT INTO alessia_client_memory (
        consultant_id, client_id, interaction_type, interaction_date, call_id,
        summary, client_said, client_promises, next_steps,
        sentiment, objective_achieved, objective_notes,
        follow_up_needed, follow_up_date,
        ai_self_evaluation, source_transcript
      ) VALUES (
        ${data.consultantId}::text,
        ${data.clientId}::text,
        'voice_call',
        NOW(),
        ${data.callId},
        ${analysis.summary},
        ${analysis.clientSaid},
        ${JSON.stringify(analysis.clientPromises)}::jsonb,
        ${JSON.stringify(analysis.nextSteps)}::jsonb,
        ${analysis.sentiment},
        ${analysis.objectiveAchieved},
        ${analysis.objectiveNotes},
        ${analysis.followUpNeeded},
        ${analysis.followUpDate ? sql`${analysis.followUpDate}::timestamptz` : sql`NULL`},
        ${JSON.stringify(analysis.aiSelfEvaluation)}::jsonb,
        ${data.transcript.substring(0, 5000)}
      )
    `);

    console.log(`✅ [ALESSIA-FEEDBACK] Memory saved for call ${data.callId}: sentiment=${analysis.sentiment}, follow_up=${analysis.followUpNeeded}`);

    if (analysis.objectiveAchieved !== null) {
      const objectivesResult = await db.execute(sql`
        SELECT id, title FROM alessia_client_objectives
        WHERE consultant_id = ${data.consultantId}::text
          AND client_id = ${data.clientId}::text
          AND status IN ('active', 'in_progress')
        LIMIT 5
      `);

      for (const obj of objectivesResult.rows as any[]) {
        await db.execute(sql`
          UPDATE alessia_client_objectives
          SET progress_notes = progress_notes || ${JSON.stringify([{
            date: new Date().toISOString(),
            note: analysis.objectiveNotes || `Verificato in chiamata: ${analysis.objectiveAchieved ? 'progresso positivo' : 'da migliorare'}`,
            source: `call_${data.callId}`
          }])}::jsonb,
          last_checked_at = NOW(),
          updated_at = NOW()
          ${analysis.objectiveAchieved ? sql`, status = 'completed', completed_at = NOW()` : sql``}
          WHERE id = ${obj.id}
        `);
      }

      if (objectivesResult.rows.length > 0) {
        console.log(`📌 [ALESSIA-FEEDBACK] Updated ${objectivesResult.rows.length} objective(s) for client ${data.clientId}`);
      }
    }

  } catch (error: any) {
    console.error(`❌ [ALESSIA-FEEDBACK] Error processing feedback for call ${data.callId}:`, error.message);
  }
}
