import { db } from "./db";
import { clientObjectionProfile, objectionTracking, whatsappMessages, whatsappConversations } from "../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export type ProfileType = "easy" | "neutral" | "difficult";

export interface ClientProfile {
  id?: string;
  userId?: string;
  phoneNumber?: string;
  difficultyScore: number;
  totalObjections: number;
  resolvedObjections: number;
  avgSentiment: number;
  profileType: ProfileType;
  escalationRequired: boolean;
}

export async function getOrCreateProfile(
  userId?: string,
  phoneNumber?: string
): Promise<ClientProfile> {
  if (!userId && !phoneNumber) {
    throw new Error("Either userId or phoneNumber must be provided");
  }

  const condition = userId 
    ? eq(clientObjectionProfile.userId, userId)
    : eq(clientObjectionProfile.phoneNumber, phoneNumber!);

  const [existing] = await db
    .select()
    .from(clientObjectionProfile)
    .where(condition)
    .limit(1);

  if (existing) {
    return {
      id: existing.id,
      userId: existing.userId || undefined,
      phoneNumber: existing.phoneNumber || undefined,
      difficultyScore: existing.difficultyScore,
      totalObjections: existing.totalObjections,
      resolvedObjections: existing.resolvedObjections,
      avgSentiment: existing.avgSentiment ?? 0,
      profileType: existing.profileType,
      escalationRequired: existing.escalationRequired,
    };
  }

  const [newProfile] = await db
    .insert(clientObjectionProfile)
    .values({
      userId: userId || null,
      phoneNumber: phoneNumber || null,
      difficultyScore: 5.0,
      totalObjections: 0,
      resolvedObjections: 0,
      avgSentiment: 0.0,
      profileType: "neutral",
      escalationRequired: false,
    })
    .returning();

  return {
    id: newProfile.id,
    userId: newProfile.userId || undefined,
    phoneNumber: newProfile.phoneNumber || undefined,
    difficultyScore: newProfile.difficultyScore,
    totalObjections: newProfile.totalObjections,
    resolvedObjections: newProfile.resolvedObjections,
    avgSentiment: newProfile.avgSentiment ?? 0,
    profileType: newProfile.profileType,
    escalationRequired: newProfile.escalationRequired,
  };
}

export async function updateClientProfile(
  conversationId: string
): Promise<ClientProfile | null> {
  const [conversation] = await db
    .select()
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1);

  if (!conversation) {
    return null;
  }

  // CRITICAL: Filter objections by lastResetAt to ensure profile metrics reflect only post-reset data
  const objectionConditions = [eq(objectionTracking.conversationId, conversationId)];
  
  if (conversation.lastResetAt) {
    objectionConditions.push(sql`${objectionTracking.detectedAt} > ${conversation.lastResetAt}`);
  }
  
  const objections = await db
    .select()
    .from(objectionTracking)
    .where(and(...objectionConditions));

  const totalObjections = objections.length;
  const resolvedObjections = objections.filter(o => o.wasResolved).length;
  
  const sentiments = objections
    .map(o => o.sentimentScore)
    .filter((s): s is number => s !== null);
  const avgSentiment = sentiments.length > 0
    ? sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length
    : 0;

  // CRITICAL: Filter messages by lastResetAt to ensure metrics are calculated only on post-reset data
  const messageConditions = [
    eq(whatsappMessages.conversationId, conversationId),
    eq(whatsappMessages.direction, "inbound")
  ];
  
  if (conversation.lastResetAt) {
    messageConditions.push(sql`${whatsappMessages.createdAt} > ${conversation.lastResetAt}`);
  }
  
  const messages = await db
    .select()
    .from(whatsappMessages)
    .where(and(...messageConditions))
    .orderBy(whatsappMessages.createdAt);

  let avgResponseTimeMinutes: number | null = null;
  if (messages.length > 1) {
    const responseTimes: number[] = [];
    for (let i = 1; i < messages.length; i++) {
      const timeDiff = new Date(messages[i].createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime();
      const minutes = Math.floor(timeDiff / (1000 * 60));
      responseTimes.push(minutes);
    }
    avgResponseTimeMinutes = responseTimes.length > 0
      ? Math.floor(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)
      : null;
  }

  let difficultyScore = 5.0;
  
  difficultyScore -= avgSentiment * 2;
  
  if (totalObjections > 0) {
    const resolutionRate = resolvedObjections / totalObjections;
    difficultyScore += (1 - resolutionRate) * 2;
  }
  
  difficultyScore += Math.min(totalObjections * 0.5, 2);
  
  if (avgResponseTimeMinutes && avgResponseTimeMinutes > 1440) {
    difficultyScore += 1;
  }
  
  difficultyScore = Math.max(0, Math.min(10, difficultyScore));

  const profileType: ProfileType = 
    difficultyScore <= 3 ? "easy" :
    difficultyScore >= 7 ? "difficult" :
    "neutral";

  const escalationRequired = difficultyScore >= 8 || 
    (totalObjections - resolvedObjections) >= 3;

  const condition = conversation.userId
    ? eq(clientObjectionProfile.userId, conversation.userId)
    : eq(clientObjectionProfile.phoneNumber, conversation.phoneNumber);

  const [existingProfile] = await db
    .select()
    .from(clientObjectionProfile)
    .where(condition)
    .limit(1);

  if (existingProfile) {
    const lastObjectionTimestamp = totalObjections > 0 
      ? new Date() 
      : existingProfile.lastObjectionAt;
    const escalatedTimestamp = escalationRequired && !existingProfile.escalationRequired 
      ? new Date() 
      : existingProfile.escalatedAt;
      
    const [updated] = await db
      .update(clientObjectionProfile)
      .set({
        difficultyScore,
        totalObjections,
        resolvedObjections,
        avgSentiment,
        avgResponseTimeMinutes: avgResponseTimeMinutes ?? null,
        lastObjectionAt: lastObjectionTimestamp,
        escalationRequired,
        escalatedAt: escalatedTimestamp,
        profileType,
        updatedAt: new Date(),
      })
      .where(eq(clientObjectionProfile.id, existingProfile.id))
      .returning();

    return {
      id: updated.id,
      userId: updated.userId || undefined,
      phoneNumber: updated.phoneNumber || undefined,
      difficultyScore: updated.difficultyScore,
      totalObjections: updated.totalObjections,
      resolvedObjections: updated.resolvedObjections,
      avgSentiment: updated.avgSentiment ?? 0,
      profileType: updated.profileType,
      escalationRequired: updated.escalationRequired,
    };
  } else {
    const [newProfile] = await db
      .insert(clientObjectionProfile)
      .values({
        userId: conversation.userId || null,
        phoneNumber: conversation.phoneNumber,
        difficultyScore,
        totalObjections,
        resolvedObjections,
        avgSentiment,
        avgResponseTimeMinutes: avgResponseTimeMinutes ?? null,
        lastObjectionAt: totalObjections > 0 ? new Date() : null,
        escalationRequired,
        escalatedAt: escalationRequired ? new Date() : null,
        profileType,
      })
      .returning();

    return {
      id: newProfile.id,
      userId: newProfile.userId || undefined,
      phoneNumber: newProfile.phoneNumber || undefined,
      difficultyScore: newProfile.difficultyScore,
      totalObjections: newProfile.totalObjections,
      resolvedObjections: newProfile.resolvedObjections,
      avgSentiment: newProfile.avgSentiment ?? 0,
      profileType: newProfile.profileType,
      escalationRequired: newProfile.escalationRequired,
    };
  }
}

export function getApproachRecommendation(profile: ClientProfile): string {
  switch (profile.profileType) {
    case "easy":
      return `Cliente FACILE (Score: ${profile.difficultyScore.toFixed(1)}/10)
- Approccio DIRETTO e PROPOSITIVO
- Risposte concise con focus sui benefici immediati
- Proponi azioni concrete e prossimi passi
- Usa case study brevi e testimonianze
- Sii assertivo nelle raccomandazioni`;

    case "difficult":
      return `Cliente DIFFICILE (Score: ${profile.difficultyScore.toFixed(1)}/10)
- Approccio EMPATICO e PAZIENTE
- Ascolto attivo e domande di scoperta
- Risposte più dettagliate e argomentate
- Gestisci obiezioni con tecnica "Feel-Felt-Found"
- ${profile.escalationRequired ? '⚠️ ESCALATION CONSIGLIATA: Considera intervento consulente' : 'Proponi call one-on-one per approfondire'}`;

    case "neutral":
    default:
      return `Cliente NEUTRALE (Score: ${profile.difficultyScore.toFixed(1)}/10)
- Approccio BILANCIATO ed EDUCATIVO
- Mix di contenuto informativo e call-to-action
- Usa esempi pratici e dati
- Rispondi alle domande in modo completo
- Guida verso decisione con soft nudges`;
  }
}
