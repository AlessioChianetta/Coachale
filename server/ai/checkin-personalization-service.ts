/**
 * Check-in Personalization Service
 * 
 * Generates AI-personalized phrases for weekly check-in messages.
 * Uses Gemini AI with context from client's exercises, consultations,
 * and financial goals to create meaningful, personalized follow-ups.
 */

import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { 
  users, 
  exercises, 
  exerciseAssignments,
  consultations
} from "../../shared/schema";
import { eq, and, desc, isNotNull, sql } from "drizzle-orm";
import { getSuperAdminGeminiKeys } from "./provider-factory";

export interface ClientCheckinContext {
  clientName: string;
  clientId: string;
  consultantId: string;
  lastExercise?: {
    title: string;
    status: string;
    assignedAt: Date;
  };
  daysSinceLastContact?: number;
  lastConsultation?: {
    topic: string;
    date: Date;
  };
  exerciseProgress?: {
    total: number;
    completed: number;
  };
}

export interface PersonalizedCheckinResult {
  success: boolean;
  aiMessage?: string;
  context?: ClientCheckinContext;
  error?: string;
  model?: string;
}

/**
 * Fetch client context for AI personalization
 */
export async function fetchClientContext(
  clientId: string,
  consultantId: string
): Promise<ClientCheckinContext | null> {
  try {
    const [client] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);

    if (!client) {
      console.log(`[CHECKIN-AI] Client ${clientId} not found`);
      return null;
    }

    const clientName = client.firstName || 'Cliente';

    // Fetch last assigned exercise with status
    const [lastAssignment] = await db
      .select({
        exerciseId: exerciseAssignments.exerciseId,
        status: exerciseAssignments.status,
        assignedAt: exerciseAssignments.assignedAt,
      })
      .from(exerciseAssignments)
      .where(
        and(
          eq(exerciseAssignments.clientId, clientId),
          eq(exerciseAssignments.consultantId, consultantId)
        )
      )
      .orderBy(desc(exerciseAssignments.assignedAt))
      .limit(1);

    let lastExercise;
    if (lastAssignment) {
      const [exercise] = await db
        .select({ title: exercises.title })
        .from(exercises)
        .where(eq(exercises.id, lastAssignment.exerciseId))
        .limit(1);

      if (exercise) {
        lastExercise = {
          title: exercise.title,
          status: lastAssignment.status || 'assigned',
          assignedAt: lastAssignment.assignedAt!,
        };
      }
    }

    // Fetch exercise progress
    const exerciseStats = await db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`sum(case when ${exerciseAssignments.status} = 'completed' then 1 else 0 end)`,
      })
      .from(exerciseAssignments)
      .where(
        and(
          eq(exerciseAssignments.clientId, clientId),
          eq(exerciseAssignments.consultantId, consultantId)
        )
      );

    const exerciseProgress = exerciseStats[0] ? {
      total: Number(exerciseStats[0].total) || 0,
      completed: Number(exerciseStats[0].completed) || 0,
    } : undefined;

    // Fetch last consultation
    const [lastConsultation] = await db
      .select({
        notes: consultations.notes,
        scheduledAt: consultations.scheduledAt,
      })
      .from(consultations)
      .where(
        and(
          eq(consultations.clientId, clientId),
          eq(consultations.consultantId, consultantId),
          isNotNull(consultations.scheduledAt)
        )
      )
      .orderBy(desc(consultations.scheduledAt))
      .limit(1);

    return {
      clientName,
      clientId,
      consultantId,
      lastExercise,
      exerciseProgress,
      lastConsultation: lastConsultation ? {
        topic: lastConsultation.notes || 'consulenza',
        date: lastConsultation.scheduledAt!,
      } : undefined,
    };
  } catch (error) {
    console.error('[CHECKIN-AI] Error fetching client context:', error);
    return null;
  }
}

/**
 * Generate AI-personalized message for weekly check-in
 */
export async function generateCheckinAiMessage(
  context: ClientCheckinContext
): Promise<PersonalizedCheckinResult> {
  try {
    // Get API key
    const geminiKeys = await getSuperAdminGeminiKeys();
    if (!geminiKeys?.enabled || geminiKeys.keys.length === 0) {
      console.log('[CHECKIN-AI] No Gemini API keys available');
      return {
        success: false,
        error: 'No AI API keys configured',
      };
    }

    const apiKey = geminiKeys.keys[0];
    const genAI = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';

    // Build context prompt
    const contextParts: string[] = [];

    if (context.lastExercise) {
      const statusText = context.lastExercise.status === 'completed' 
        ? 'ha completato' 
        : context.lastExercise.status === 'in_progress' 
          ? 'sta lavorando su'
          : 'ha ricevuto';
      contextParts.push(`Ultimo esercizio: ${statusText} "${context.lastExercise.title}"`);
    }

    if (context.exerciseProgress && context.exerciseProgress.total > 0) {
      const pct = Math.round((context.exerciseProgress.completed / context.exerciseProgress.total) * 100);
      contextParts.push(`Progresso esercizi: ${context.exerciseProgress.completed}/${context.exerciseProgress.total} (${pct}%)`);
    }

    if (context.lastConsultation) {
      const daysAgo = Math.floor((Date.now() - context.lastConsultation.date.getTime()) / (1000 * 60 * 60 * 24));
      contextParts.push(`Ultima consulenza: "${context.lastConsultation.topic}" (${daysAgo} giorni fa)`);
    }

    const contextText = contextParts.length > 0 
      ? contextParts.join('\n')
      : 'Nessun contesto specifico disponibile';

    const systemPrompt = `Sei un assistente di un consulente finanziario. Genera una BREVE frase personalizzata (max 15 parole) per un messaggio WhatsApp di check-in settimanale.

La frase deve essere:
- Calda e personale, ma professionale
- Riferita al contesto del cliente se disponibile
- Motivazionale senza essere sdolcinata
- In italiano naturale e colloquiale

NON includere:
- Saluti (ciao, buongiorno)
- Nome del cliente
- Emoji
- Domande retoriche generiche

CONTESTO CLIENTE:
${contextText}

Rispondi SOLO con la frase, senza virgolette o spiegazioni.`;

    const result = await genAI.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      config: {
        temperature: 1,
        maxOutputTokens: 5000,
      },
    });

    const aiMessage = result.text?.trim();

    if (!aiMessage) {
      return {
        success: false,
        error: 'AI returned empty response',
      };
    }

    // Clean up response
    const cleanedMessage = aiMessage
      .replace(/^["']|["']$/g, '')
      .replace(/^\.+|\.+$/g, '')
      .trim();

    console.log(`[CHECKIN-AI] Generated for ${context.clientName}: "${cleanedMessage}"`);

    return {
      success: true,
      aiMessage: cleanedMessage,
      context,
      model,
    };
  } catch (error: any) {
    console.error('[CHECKIN-AI] Error generating AI message:', error);
    return {
      success: false,
      error: error.message || 'AI generation failed',
    };
  }
}

/**
 * Generate personalized check-in message for a client
 * Returns both the AI phrase and client name for template variables
 */
export async function generateCheckinVariables(
  clientId: string,
  consultantId: string
): Promise<{ name: string; aiMessage: string } | null> {
  const context = await fetchClientContext(clientId, consultantId);
  
  if (!context) {
    return null;
  }

  const result = await generateCheckinAiMessage(context);

  if (!result.success || !result.aiMessage) {
    // Fallback to generic message
    return {
      name: context.clientName,
      aiMessage: 'spero che questa settimana stia andando bene per te',
    };
  }

  return {
    name: context.clientName,
    aiMessage: result.aiMessage,
  };
}
