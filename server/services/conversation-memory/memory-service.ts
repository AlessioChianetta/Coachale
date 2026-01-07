import { db } from "../../db";
import { aiConversations, aiMessages, aiDailySummaries, aiMemoryGenerationLogs, users } from "../../../shared/schema";
import { eq, and, desc, lt, gte, isNotNull, sql, or, inArray } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { startOfDay, subDays, format, eachDayOfInterval } from "date-fns";
import { it } from "date-fns/locale";

export type ConversationScope = "consultant" | "client" | "manager" | "bronze" | "silver" | "gold";

export interface ConversationSummary {
  conversationId: string;
  title: string | null;
  summary: string | null;
  lastMessageAt: Date | null;
  messageCount: number;
  mode: string;
  agentId: string | null;
}

export interface ConversationMemoryConfig {
  maxConversations: number;
  maxMessagesPerConversation: number;
  daysToLookBack: number;
}

const DEFAULT_CONFIG: ConversationMemoryConfig = {
  maxConversations: 5,
  maxMessagesPerConversation: 10,
  daysToLookBack: 30,
};

export class ConversationMemoryService {
  private config: ConversationMemoryConfig;

  constructor(config: Partial<ConversationMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async getRecentConversations(
    userId: string,
    scope: ConversationScope,
    excludeConversationId?: string
  ): Promise<ConversationSummary[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.daysToLookBack);

    // aiConversations uses clientId for both consultants and clients
    // The scope parameter helps with context but the filter is always on clientId
    const idFilter = eq(aiConversations.clientId, userId);

    // Build conditions array, filtering out undefined values
    const conditions = [
      idFilter,
      isNotNull(aiConversations.lastMessageAt),
      sql`${aiConversations.lastMessageAt} > ${cutoffDate}`,
    ];
    
    if (excludeConversationId) {
      conditions.push(sql`${aiConversations.id}::text != ${excludeConversationId}`);
    }

    let baseQuery = db.select({
      id: aiConversations.id,
      title: aiConversations.title,
      summary: aiConversations.summary,
      lastMessageAt: aiConversations.lastMessageAt,
      mode: aiConversations.mode,
      agentId: aiConversations.agentId,
    })
    .from(aiConversations)
    .where(and(...conditions))
    .orderBy(desc(aiConversations.lastMessageAt))
    .limit(this.config.maxConversations);

    const conversations = await baseQuery;

    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const messageCountResult = await db.select({
          count: sql<number>`count(*)::int`,
        })
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conv.id));

        return {
          conversationId: conv.id,
          title: conv.title,
          summary: conv.summary,
          lastMessageAt: conv.lastMessageAt,
          messageCount: messageCountResult[0]?.count || 0,
          mode: conv.mode,
          agentId: conv.agentId,
        };
      })
    );

    return conversationsWithCounts;
  }

  async getConversationMessages(
    conversationId: string,
    limit: number = this.config.maxMessagesPerConversation
  ): Promise<{ role: string; content: string; createdAt: Date | null }[]> {
    const messages = await db.select({
      role: aiMessages.role,
      content: aiMessages.content,
      createdAt: aiMessages.createdAt,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(limit);

    return messages.reverse();
  }

  async updateConversationSummary(
    conversationId: string,
    summary: string
  ): Promise<void> {
    await db.update(aiConversations)
      .set({ 
        summary,
        updatedAt: new Date(),
      })
      .where(eq(aiConversations.id, conversationId));
  }

  async generateSummaryFromMessages(
    messages: { role: string; content: string }[]
  ): Promise<string> {
    if (messages.length === 0) return "";

    const userMessages = messages
      .filter(m => m.role === "user")
      .map(m => m.content)
      .slice(0, 3);

    if (userMessages.length === 0) return "";

    const topics = userMessages.map(msg => {
      const truncated = msg.substring(0, 100);
      return truncated.length < msg.length ? `${truncated}...` : truncated;
    });

    return `Argomenti discussi: ${topics.join("; ")}`;
  }

  async generateAISummary(
    conversationId: string,
    apiKey: string
  ): Promise<string | null> {
    try {
      const messages = await this.getConversationMessages(conversationId, 20);
      
      if (messages.length < 2) return null;

      const conversationText = messages
        .map(m => `${m.role === 'user' ? 'Utente' : 'Assistente'}: ${m.content.substring(0, 500)}`)
        .join('\n');

      const genai = new GoogleGenAI({ apiKey });
      
      const result = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Genera un riassunto brevissimo (max 2 frasi, max 150 caratteri) di questa conversazione. 
Concentrati sui punti chiave e le richieste principali dell'utente. Rispondi SOLO con il riassunto, senza prefissi.

Conversazione:
${conversationText}`,
      });

      const summary = result.text?.trim() || "";
      
      if (summary && summary.length > 0) {
        await this.updateConversationSummary(conversationId, summary);
        console.log(`📝 [Memory] Generated summary for conversation ${conversationId.slice(0, 8)}...`);
        return summary;
      }
      
      return null;
    } catch (error) {
      console.error("❌ [Memory] Error generating AI summary:", error);
      return null;
    }
  }

  async generateSummaryIfNeeded(
    conversationId: string,
    apiKey: string,
    messageCount: number
  ): Promise<void> {
    if (messageCount < 4) return;
    
    if (messageCount % 4 !== 0) return;

    const [conversation] = await db
      .select({ summary: aiConversations.summary })
      .from(aiConversations)
      .where(eq(aiConversations.id, conversationId))
      .limit(1);

    if (conversation?.summary && messageCount < 8) return;

    await this.generateAISummary(conversationId, apiKey);
  }

  // ============= DAILY SUMMARIES =============

  async getDailySummaries(
    userId: string,
    daysBack: number = 30
  ): Promise<Array<{
    id: string;
    date: Date;
    summary: string;
    conversationCount: number;
    messageCount: number;
    topics: string[];
  }>> {
    const cutoffDate = subDays(new Date(), daysBack);

    const summaries = await db
      .select({
        id: aiDailySummaries.id,
        summaryDate: aiDailySummaries.summaryDate,
        summary: aiDailySummaries.summary,
        conversationCount: aiDailySummaries.conversationCount,
        messageCount: aiDailySummaries.messageCount,
        topics: aiDailySummaries.topics,
      })
      .from(aiDailySummaries)
      .where(and(
        eq(aiDailySummaries.userId, userId),
        gte(aiDailySummaries.summaryDate, cutoffDate)
      ))
      .orderBy(desc(aiDailySummaries.summaryDate));

    return summaries.map(s => ({
      id: s.id,
      date: s.summaryDate!,
      summary: s.summary,
      conversationCount: s.conversationCount || 0,
      messageCount: s.messageCount || 0,
      topics: (s.topics as string[]) || [],
    }));
  }

  async generateDailySummary(
    userId: string,
    targetDate: Date,
    apiKey: string
  ): Promise<string | null> {
    try {
      const dayStart = startOfDay(targetDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Get all conversations from that day
      const conversations = await db
        .select({
          id: aiConversations.id,
          title: aiConversations.title,
        })
        .from(aiConversations)
        .where(and(
          eq(aiConversations.clientId, userId),
          gte(aiConversations.createdAt, dayStart),
          lt(aiConversations.createdAt, dayEnd)
        ));

      if (conversations.length === 0) return null;

      // Get messages from all conversations
      const allMessages: { role: string; content: string }[] = [];
      let totalMessageCount = 0;

      for (const conv of conversations) {
        const messages = await db
          .select({
            role: aiMessages.role,
            content: aiMessages.content,
          })
          .from(aiMessages)
          .where(eq(aiMessages.conversationId, conv.id))
          .orderBy(aiMessages.createdAt)
          .limit(10);

        allMessages.push(...messages);
        totalMessageCount += messages.length;
      }

      if (allMessages.length < 2) return null;

      const conversationText = allMessages
        .slice(0, 30)
        .map(m => `${m.role === 'user' ? 'Utente' : 'AI'}: ${m.content.substring(0, 300)}`)
        .join('\n');

      const dateStr = format(targetDate, "d MMMM yyyy", { locale: it });

      const genai = new GoogleGenAI({ apiKey });
      const result = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Genera un riassunto dettagliato del giorno ${dateStr} delle conversazioni AI.

REGOLE:
- Scrivi 4-6 frasi complete e informative (400-600 caratteri circa)
- Descrivi gli argomenti principali discussi e le richieste dell'utente
- Includi eventuali decisioni prese, problemi risolti o task completati
- Usa un tono professionale ma scorrevole
- Rispondi SOLO con il riassunto, senza prefissi o intestazioni

Conversazioni del giorno (${conversations.length} chat, ${totalMessageCount} messaggi):
${conversationText}`,
      });

      const summary = result.text?.trim() || "";

      if (summary && summary.length > 0) {
        // Extract topics (simple extraction)
        const topics = summary
          .split(/[,;.]/)
          .filter(t => t.trim().length > 3 && t.trim().length < 50)
          .slice(0, 5)
          .map(t => t.trim());

        // Upsert daily summary
        await db
          .insert(aiDailySummaries)
          .values({
            userId,
            summaryDate: dayStart,
            summary,
            conversationCount: conversations.length,
            messageCount: totalMessageCount,
            topics,
          })
          .onConflictDoUpdate({
            target: [aiDailySummaries.userId, aiDailySummaries.summaryDate],
            set: {
              summary,
              conversationCount: conversations.length,
              messageCount: totalMessageCount,
              topics,
              updatedAt: new Date(),
            },
          });

        console.log(`📝 [Memory] Generated daily summary for ${dateStr}`);
        return summary;
      }

      return null;
    } catch (error) {
      console.error("❌ [Memory] Error generating daily summary:", error);
      return null;
    }
  }

  async generateMissingDailySummariesWithProgress(
    userId: string,
    apiKey: string,
    onProgress: (progress: {
      type: "connecting" | "scanning" | "start" | "processing" | "generated" | "skipped";
      date?: string;
      current?: number;
      total?: number;
      message?: string;
    }) => void
  ): Promise<{ generated: number; total: number }> {
    // Send immediate feedback
    onProgress({ type: "connecting", message: "Connessione stabilita..." });
    onProgress({ type: "scanning", message: "Analisi delle conversazioni..." });
    
    // Find all distinct days with conversations for this user
    const daysWithConversations = await db
      .selectDistinct({
        day: sql<Date>`DATE(${aiConversations.createdAt})`.as("day"),
      })
      .from(aiConversations)
      .where(eq(aiConversations.clientId, userId))
      .orderBy(desc(sql`DATE(${aiConversations.createdAt})`));

    const daysToProcess: { day: Date; messageCount: number }[] = [];

    // First pass: identify which days need generation
    for (const { day } of daysWithConversations) {
      if (!day) continue;
      
      const dayStart = startOfDay(new Date(day));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const conversations = await db
        .select({ id: aiConversations.id })
        .from(aiConversations)
        .where(and(
          eq(aiConversations.clientId, userId),
          gte(aiConversations.createdAt, dayStart),
          lt(aiConversations.createdAt, dayEnd)
        ));

      let currentMessageCount = 0;
      for (const conv of conversations) {
        const [msgCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(aiMessages)
          .where(eq(aiMessages.conversationId, conv.id));
        currentMessageCount += Number(msgCount?.count || 0);
      }

      const [existing] = await db
        .select({ 
          id: aiDailySummaries.id,
          messageCount: aiDailySummaries.messageCount 
        })
        .from(aiDailySummaries)
        .where(and(
          eq(aiDailySummaries.userId, userId),
          eq(aiDailySummaries.summaryDate, dayStart)
        ))
        .limit(1);

      const needsGeneration = !existing || (existing.messageCount || 0) < currentMessageCount;

      if (needsGeneration && currentMessageCount >= 2) {
        daysToProcess.push({ day: new Date(day), messageCount: currentMessageCount });
      }
    }

    const total = daysToProcess.length;
    onProgress({ type: "start", total, message: `Trovati ${total} giorni da elaborare` });

    if (total === 0) {
      return { generated: 0, total: 0 };
    }

    let generated = 0;
    const POOL_SIZE = 3; // Process 3 days in parallel

    // Process in batches
    for (let i = 0; i < daysToProcess.length; i += POOL_SIZE) {
      const batch = daysToProcess.slice(i, i + POOL_SIZE);
      
      const results = await Promise.all(
        batch.map(async ({ day }, batchIndex) => {
          const current = i + batchIndex + 1;
          const dateStr = format(day, "d MMMM yyyy", { locale: it });
          
          onProgress({ 
            type: "processing", 
            date: dateStr, 
            current, 
            total,
            message: `Elaboro ${dateStr}...`
          });

          const summary = await this.generateDailySummary(userId, day, apiKey);
          
          if (summary) {
            onProgress({ 
              type: "generated", 
              date: dateStr, 
              current, 
              total,
              message: `Generato riassunto per ${dateStr}`
            });
            return true;
          } else {
            onProgress({ 
              type: "skipped", 
              date: dateStr, 
              current, 
              total,
              message: `Saltato ${dateStr} (nessun contenuto)`
            });
            return false;
          }
        })
      );

      generated += results.filter(Boolean).length;
    }

    return { generated, total };
  }

  // ============= MEMORY AUDIT METHODS =============

  async getMemoryAudit(
    consultantId: string,
    daysBack: number = 30
  ): Promise<Array<{
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    totalDays: number;
    coveredDays: number;
    missingDays: number;
    lastSummaryDate: Date | null;
    status: 'complete' | 'partial' | 'missing';
  }>> {
    try {
      // Get consultant + their clients
      const allUsers = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(or(
          eq(users.id, consultantId),
          eq(users.consultantId, consultantId)
        ));

      if (!allUsers || allUsers.length === 0) {
        console.log('[MemoryAudit] No users found for consultant:', consultantId);
        return [];
      }

      const cutoffDate = subDays(new Date(), daysBack);
      const results: Array<{
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
        totalDays: number;
        coveredDays: number;
        missingDays: number;
        lastSummaryDate: Date | null;
        status: 'complete' | 'partial' | 'missing';
      }> = [];

      for (const user of allUsers) {
        // Get days with conversations for this user
        const daysWithConversations = await db
          .selectDistinct({
            day: sql<Date>`DATE(${aiConversations.createdAt})`.as("day"),
          })
          .from(aiConversations)
          .where(and(
            eq(aiConversations.clientId, user.id),
            gte(aiConversations.createdAt, cutoffDate)
          ));

        const totalDays = daysWithConversations.length;

        // Get existing summaries
        const summaries = await db
          .select({
            summaryDate: aiDailySummaries.summaryDate,
          })
          .from(aiDailySummaries)
          .where(and(
            eq(aiDailySummaries.userId, user.id),
            gte(aiDailySummaries.summaryDate, cutoffDate)
          ))
          .orderBy(desc(aiDailySummaries.summaryDate));

        const coveredDays = summaries.length;
        const missingDays = Math.max(0, totalDays - coveredDays);
        const lastSummaryDate = summaries.length > 0 ? summaries[0].summaryDate : null;

        let status: 'complete' | 'partial' | 'missing' = 'complete';
        if (totalDays === 0) {
          status = 'complete'; // No conversations = complete
        } else if (coveredDays === 0) {
          status = 'missing';
        } else if (missingDays > 0) {
          status = 'partial';
        }

        results.push({
          userId: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email,
          role: user.role,
          totalDays,
          coveredDays,
          missingDays,
          lastSummaryDate,
          status,
        });
      }

      return results;
    } catch (error: any) {
      console.error('[MemoryAudit] Error:', error.message);
      return [];
    }
  }

  async getMemoryStats(consultantId: string): Promise<{
    totalSummaries: number;
    usersWithMemory: number;
    totalUsers: number;
    averageTokensPerUser: number;
    coveragePercent: number;
  }> {
    try {
      // Get all users (consultant + clients)
      const allUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(or(
          eq(users.id, consultantId),
          eq(users.consultantId, consultantId)
        ));

      const userIds = allUsers.map(u => u.id).filter(id => id != null);
      const totalUsers = userIds.length;

      if (totalUsers === 0 || userIds.length === 0) {
        return {
          totalSummaries: 0,
          usersWithMemory: 0,
          totalUsers: 0,
          averageTokensPerUser: 0,
          coveragePercent: 100,
        };
      }

      // Count total summaries
      const [summaryCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(aiDailySummaries)
        .where(inArray(aiDailySummaries.userId, userIds));

      const totalSummaries = Number(summaryCount?.count || 0);

      // Count users with at least one summary
      const usersWithSummaries = await db
        .selectDistinct({ userId: aiDailySummaries.userId })
        .from(aiDailySummaries)
        .where(inArray(aiDailySummaries.userId, userIds));

      const usersWithMemory = usersWithSummaries.length;

      // Estimate tokens (average ~40 tokens per summary)
      const averageTokensPerUser = totalUsers > 0 
        ? Math.round((totalSummaries * 40) / totalUsers) 
        : 0;

      // Coverage percent
      const coveragePercent = totalUsers > 0 
        ? Math.round((usersWithMemory / totalUsers) * 100) 
        : 100;

      return {
        totalSummaries,
        usersWithMemory,
        totalUsers,
        averageTokensPerUser,
        coveragePercent,
      };
    } catch (error: any) {
      console.error('[MemoryStats] Error:', error.message);
      return {
        totalSummaries: 0,
        usersWithMemory: 0,
        totalUsers: 0,
        averageTokensPerUser: 0,
        coveragePercent: 100,
      };
    }
  }

  async getGenerationLogs(
    consultantId: string,
    limit: number = 50
  ): Promise<Array<{
    id: number;
    userId: string;
    targetUserId: string | null;
    generationType: string;
    summariesGenerated: number;
    conversationsAnalyzed: number;
    tokensUsed: number;
    durationMs: number;
    errors: string[];
    createdAt: Date | null;
    targetUserName?: string;
  }>> {
    const logs = await db
      .select()
      .from(aiMemoryGenerationLogs)
      .where(eq(aiMemoryGenerationLogs.userId, consultantId))
      .orderBy(desc(aiMemoryGenerationLogs.createdAt))
      .limit(limit);

    // Enrich with user names
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        let targetUserName: string | undefined;
        if (log.targetUserId) {
          const [targetUser] = await db
            .select({ firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, log.targetUserId))
            .limit(1);
          if (targetUser) {
            targetUserName = `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim();
          }
        }
        return {
          ...log,
          errors: (log.errors as string[]) || [],
          targetUserName,
        };
      })
    );

    return enrichedLogs;
  }

  async logGeneration(data: {
    userId: string;
    targetUserId?: string | null;
    generationType: 'automatic' | 'manual';
    summariesGenerated: number;
    conversationsAnalyzed: number;
    tokensUsed?: number;
    durationMs: number;
    errors?: string[];
  }): Promise<void> {
    await db.insert(aiMemoryGenerationLogs).values({
      userId: data.userId,
      targetUserId: data.targetUserId || null,
      generationType: data.generationType,
      summariesGenerated: data.summariesGenerated,
      conversationsAnalyzed: data.conversationsAnalyzed,
      tokensUsed: data.tokensUsed || 0,
      durationMs: data.durationMs,
      errors: data.errors || [],
    });
  }
}

export const conversationMemoryService = new ConversationMemoryService();
