import { db } from "../../db";
import { aiConversations, aiMessages, aiDailySummaries, aiMemoryGenerationLogs, users, managerDailySummaries, clientLevelSubscriptions, consultantWhatsappConfig, whatsappAgentConsultantConversations, whatsappAgentConsultantMessages, bronzeUserAgentAccess } from "../../../shared/schema";
import { eq, and, desc, lt, gte, isNotNull, isNull, sql, or, inArray, like } from "drizzle-orm";
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
          id: aiDailySummaries.id
        })
        .from(aiDailySummaries)
        .where(and(
          eq(aiDailySummaries.userId, userId),
          eq(aiDailySummaries.summaryDate, dayStart)
        ))
        .limit(1);

      // Generate only if summary doesn't exist (same logic as audit)
      const needsGeneration = !existing;

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
    _daysBack: number = 0 // Deprecated - no longer used, kept for API compatibility
  ): Promise<Array<{
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
    totalDays: number;
    coveredDays: number;
    missingDays: number;
    lastSummaryDate: Date | null;
    status: 'complete' | 'partial' | 'missing';
  }>> {
    try {
      // Get consultant (always) + their active clients only
      const allUsers = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
        })
        .from(users)
        .where(or(
          eq(users.id, consultantId),  // Always include consultant regardless of isActive
          and(
            eq(users.consultantId, consultantId),
            eq(users.isActive, true)   // Only filter clients by isActive
          )
        ));

      if (!allUsers || allUsers.length === 0) {
        console.log('[MemoryAudit] No users found for consultant:', consultantId);
        return [];
      }

      // No time limit - get ALL conversation days (same logic as generateMissingDailySummariesWithProgress)
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
        // Get days with >= 2 messages (same threshold as generation)
        // Using aggregated query for performance
        const daysWithEnoughMessages = await db
          .select({
            day: sql<Date>`DATE(${aiConversations.createdAt})`.as("day"),
            messageCount: sql<number>`COUNT(${aiMessages.id})`.as("messageCount"),
          })
          .from(aiConversations)
          .leftJoin(aiMessages, eq(aiMessages.conversationId, aiConversations.id))
          .where(eq(aiConversations.clientId, user.id))
          .groupBy(sql`DATE(${aiConversations.createdAt})`)
          .having(sql`COUNT(${aiMessages.id}) >= 2`);

        const totalDays = daysWithEnoughMessages.length;

        // Get ALL existing summaries for this user
        const summaries = await db
          .select({
            summaryDate: aiDailySummaries.summaryDate,
          })
          .from(aiDailySummaries)
          .where(eq(aiDailySummaries.userId, user.id))
          .orderBy(desc(aiDailySummaries.summaryDate));

        // Create a Set of summary dates for fast lookup
        const summaryDates = new Set(
          summaries.map(s => startOfDay(new Date(s.summaryDate)).getTime())
        );

        // Count covered days: days that have a summary
        let coveredDays = 0;
        for (const { day } of daysWithEnoughMessages) {
          if (!day) continue;
          const dayTime = startOfDay(new Date(day)).getTime();
          if (summaryDates.has(dayTime)) {
            coveredDays++;
          }
        }

        const lastSummaryDate = summaries.length > 0 ? summaries[0].summaryDate : null;
        const missingDays = Math.max(0, totalDays - coveredDays);

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
          isActive: user.isActive ?? true,
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
      // Get consultant (always) + active clients only
      const allUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(or(
          eq(users.id, consultantId),  // Always include consultant regardless of isActive
          and(
            eq(users.consultantId, consultantId),
            eq(users.isActive, true)   // Only filter clients by isActive
          )
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

  // ============= MANAGER GOLD MEMORY =============

  async getManagerDailySummaries(
    subscriptionId: string,
    daysBack: number = 30,
    agentProfileId?: string | null
  ): Promise<Array<{
    id: string;
    summaryDate: Date;
    summary: string;
    conversationCount: number;
    messageCount: number;
    topics: string[];
    agentProfileId: string | null;
    agentName: string | null;
  }>> {
    const cutoffDate = subDays(new Date(), daysBack);

    const conditions = [
      eq(managerDailySummaries.subscriptionId, subscriptionId),
      gte(managerDailySummaries.summaryDate, cutoffDate)
    ];

    if (agentProfileId !== undefined) {
      if (agentProfileId === null) {
        conditions.push(sql`${managerDailySummaries.agentProfileId} IS NULL`);
      } else {
        conditions.push(eq(managerDailySummaries.agentProfileId, agentProfileId));
      }
    }

    // Join with consultantWhatsappConfig to get agent names
    const summaries = await db
      .select({
        id: managerDailySummaries.id,
        summaryDate: managerDailySummaries.summaryDate,
        summary: managerDailySummaries.summary,
        conversationCount: managerDailySummaries.conversationCount,
        messageCount: managerDailySummaries.messageCount,
        topics: managerDailySummaries.topics,
        agentProfileId: managerDailySummaries.agentProfileId,
        agentName: consultantWhatsappConfig.agentName,
      })
      .from(managerDailySummaries)
      .leftJoin(
        consultantWhatsappConfig,
        eq(managerDailySummaries.agentProfileId, consultantWhatsappConfig.id)
      )
      .where(and(...conditions))
      .orderBy(desc(managerDailySummaries.summaryDate));

    return summaries.map(s => ({
      id: s.id,
      summaryDate: s.summaryDate!,
      summary: s.summary,
      conversationCount: s.conversationCount || 0,
      messageCount: s.messageCount || 0,
      topics: (s.topics as string[]) || [],
      agentProfileId: s.agentProfileId || null,
      agentName: s.agentName || null,
    }));
  }

  async deleteManagerSummaries(subscriptionId: string): Promise<number> {
    const result = await db
      .delete(managerDailySummaries)
      .where(eq(managerDailySummaries.subscriptionId, subscriptionId))
      .returning({ id: managerDailySummaries.id });
    
    console.log(`🗑️ [ManagerMemory] Deleted ${result.length} summaries for subscription ${subscriptionId.slice(0, 8)}...`);
    return result.length;
  }

  async getRecentManagerConversations(
    subscriptionId: string,
    excludeConversationId?: string
  ): Promise<ConversationSummary[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.daysToLookBack);

    const visitorPattern = `manager_${subscriptionId}_%`;

    const conditions: any[] = [
      like(whatsappAgentConsultantConversations.externalVisitorId, visitorPattern),
      gte(whatsappAgentConsultantConversations.updatedAt, cutoffDate),
    ];

    if (excludeConversationId) {
      conditions.push(sql`${whatsappAgentConsultantConversations.id}::text != ${excludeConversationId}`);
    }

    const conversations = await db.select({
      id: whatsappAgentConsultantConversations.id,
      title: whatsappAgentConsultantConversations.title,
      updatedAt: whatsappAgentConsultantConversations.updatedAt,
    })
    .from(whatsappAgentConsultantConversations)
    .where(and(...conditions))
    .orderBy(desc(whatsappAgentConsultantConversations.updatedAt))
    .limit(this.config.maxConversations);

    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const messageCountResult = await db.select({
          count: sql<number>`count(*)::int`,
        })
        .from(whatsappAgentConsultantMessages)
        .where(eq(whatsappAgentConsultantMessages.conversationId, conv.id));

        return {
          conversationId: conv.id,
          title: conv.title,
          summary: null,
          lastMessageAt: conv.updatedAt,
          messageCount: messageCountResult[0]?.count || 0,
          mode: "manager",
          agentId: null,
        };
      })
    );

    return conversationsWithCounts;
  }

  async getManagerConversationMessages(
    conversationId: string,
    limit: number = this.config.maxMessagesPerConversation
  ): Promise<{ role: string; content: string; createdAt: Date | null }[]> {
    const messages = await db.select({
      role: whatsappAgentConsultantMessages.role,
      content: whatsappAgentConsultantMessages.content,
      createdAt: whatsappAgentConsultantMessages.createdAt,
    })
    .from(whatsappAgentConsultantMessages)
    .where(eq(whatsappAgentConsultantMessages.conversationId, conversationId))
    .orderBy(desc(whatsappAgentConsultantMessages.createdAt))
    .limit(limit);

    return messages.reverse();
  }

  async generateManagerDailySummary(
    subscriptionId: string,
    consultantId: string,
    targetDate: Date,
    apiKey: string,
    agentProfileId?: string
  ): Promise<string | null> {
    try {
      const dayStart = startOfDay(targetDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Gold/Silver users store conversations in whatsapp_agent_consultant_conversations
      // with external_visitor_id pattern: manager_{subscriptionId}_%
      const visitorPattern = `manager_${subscriptionId}_%`;

      // Build conditions for conversation query
      const convConditions: any[] = [
        like(whatsappAgentConsultantConversations.externalVisitorId, visitorPattern),
        gte(whatsappAgentConsultantMessages.createdAt, dayStart),
        lt(whatsappAgentConsultantMessages.createdAt, dayEnd)
      ];

      // Filter by agentProfileId (stored as agentConfigId in conversations table) if provided
      if (agentProfileId) {
        convConditions.push(eq(whatsappAgentConsultantConversations.agentConfigId, agentProfileId));
      }

      // Get conversations for this subscription that have messages on this day
      const conversationsWithMessages = await db
        .selectDistinct({
          id: whatsappAgentConsultantConversations.id,
          title: whatsappAgentConsultantConversations.title,
        })
        .from(whatsappAgentConsultantMessages)
        .innerJoin(
          whatsappAgentConsultantConversations,
          eq(whatsappAgentConsultantMessages.conversationId, whatsappAgentConsultantConversations.id)
        )
        .where(and(...convConditions));

      if (conversationsWithMessages.length === 0) {
        return null;
      }

      const convIds = conversationsWithMessages.map(c => c.id);

      // Get messages for this day
      const dayMessages = await db
        .select({
          role: whatsappAgentConsultantMessages.role,
          content: whatsappAgentConsultantMessages.content,
          conversationId: whatsappAgentConsultantMessages.conversationId,
        })
        .from(whatsappAgentConsultantMessages)
        .where(and(
          inArray(whatsappAgentConsultantMessages.conversationId, convIds),
          gte(whatsappAgentConsultantMessages.createdAt, dayStart),
          lt(whatsappAgentConsultantMessages.createdAt, dayEnd)
        ))
        .orderBy(whatsappAgentConsultantMessages.createdAt)
        .limit(50);

      if (dayMessages.length < 2) return null;

      const uniqueConvs = new Set(dayMessages.map(m => m.conversationId));
      const conversationCount = uniqueConvs.size;
      const totalMessageCount = dayMessages.length;

      const conversationText = dayMessages
        .slice(0, 30)
        .map(m => `${m.role === 'user' ? 'Utente' : 'AI'}: ${(m.content || '').substring(0, 300)}`)
        .join('\n');

      const dateStr = format(targetDate, "d MMMM yyyy", { locale: it });

      const genai = new GoogleGenAI({ apiKey });
      const result = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Genera un riassunto del ${dateStr} delle nostre conversazioni.

REGOLE FONDAMENTALI:
- Scrivi come se fossi tu (l'AI) a ricordare cosa avete discusso insieme
- Usa "abbiamo parlato di...", "mi hai chiesto...", "ti ho spiegato...", "hai voluto sapere..."
- NON usare MAI terza persona ("il dipendente ha...", "l'utente ha...")
- Scrivi 3-5 frasi naturali e dirette (300-500 caratteri)
- Evidenzia gli argomenti principali e cosa hai ottenuto/imparato
- Tono amichevole e colloquiale, come un promemoria personale
- Rispondi SOLO con il riassunto, senza prefissi

Conversazioni del ${dateStr} (${conversationCount} chat, ${totalMessageCount} messaggi):
${conversationText}`,
      });

      const summary = result.text?.trim() || "";

      if (summary && summary.length > 0) {
        const topics = summary
          .split(/[,;.]/)
          .filter(t => t.trim().length > 3 && t.trim().length < 50)
          .slice(0, 5)
          .map(t => t.trim());

        // Check if summary already exists for this subscription/date/agent combination
        const existingConditions: any[] = [
          eq(managerDailySummaries.subscriptionId, subscriptionId),
          eq(managerDailySummaries.summaryDate, dayStart),
        ];
        if (agentProfileId) {
          existingConditions.push(eq(managerDailySummaries.agentProfileId, agentProfileId));
        } else {
          existingConditions.push(isNull(managerDailySummaries.agentProfileId));
        }
        
        const existing = await db.select({ id: managerDailySummaries.id })
          .from(managerDailySummaries)
          .where(and(...existingConditions))
          .limit(1);
        
        if (existing.length > 0) {
          const agentLabel = agentProfileId ? ` for agent ${agentProfileId.slice(0, 8)}...` : '';
          console.log(`⏭️ [ManagerMemory] Summary already exists for subscription ${subscriptionId.slice(0, 8)}...${agentLabel} on ${dateStr}, skipping`);
          return summary; // Return the generated summary even if we didn't insert
        }

        await db.insert(managerDailySummaries).values({
          subscriptionId,
          consultantId,
          summaryDate: dayStart,
          summary,
          conversationCount,
          messageCount: totalMessageCount,
          topics,
          agentProfileId: agentProfileId || null,
        });

        const agentLabel = agentProfileId ? ` for agent ${agentProfileId.slice(0, 8)}...` : '';
        console.log(`📝 [ManagerMemory] Generated summary for subscription ${subscriptionId.slice(0, 8)}...${agentLabel} on ${dateStr}`);
        return summary;
      }

      return null;
    } catch (error: any) {
      console.error("❌ [ManagerMemory] Error generating daily summary:", error.message);
      return null;
    }
  }

  async generateAllAgentSummariesForManager(
    subscriptionId: string,
    consultantId: string,
    summaryDate: Date,
    apiKey: string
  ): Promise<{ agentProfileId: string; summary: string | null }[]> {
    try {
      const visitorPattern = `manager_${subscriptionId}_%`;
      const dayStart = startOfDay(summaryDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Query unique agentConfigIds for this user on this date
      // Note: agentConfigId in conversations table is stored as agentProfileId in summaries table
      const agentConversations = await db
        .selectDistinct({
          agentProfileId: whatsappAgentConsultantConversations.agentConfigId,
        })
        .from(whatsappAgentConsultantMessages)
        .innerJoin(
          whatsappAgentConsultantConversations,
          eq(whatsappAgentConsultantMessages.conversationId, whatsappAgentConsultantConversations.id)
        )
        .where(and(
          like(whatsappAgentConsultantConversations.externalVisitorId, visitorPattern),
          gte(whatsappAgentConsultantMessages.createdAt, dayStart),
          lt(whatsappAgentConsultantMessages.createdAt, dayEnd),
          isNotNull(whatsappAgentConsultantConversations.agentConfigId)
        ));

      const uniqueAgentIds = agentConversations
        .map(c => c.agentProfileId)
        .filter((id): id is string => id !== null);

      if (uniqueAgentIds.length === 0) {
        console.log(`📭 [ManagerMemory] No agent conversations found for subscription ${subscriptionId.slice(0, 8)}... on ${format(summaryDate, "yyyy-MM-dd")}`);
        return [];
      }

      console.log(`🔄 [ManagerMemory] Generating summaries for ${uniqueAgentIds.length} agents for subscription ${subscriptionId.slice(0, 8)}...`);

      // Generate a summary for each agent
      const results: { agentProfileId: string; summary: string | null }[] = [];

      for (const agentProfileId of uniqueAgentIds) {
        const summary = await this.generateManagerDailySummary(
          subscriptionId,
          consultantId,
          summaryDate,
          apiKey,
          agentProfileId
        );

        results.push({ agentProfileId, summary });
      }

      const successCount = results.filter(r => r.summary !== null).length;
      console.log(`✅ [ManagerMemory] Generated ${successCount}/${uniqueAgentIds.length} agent summaries for subscription ${subscriptionId.slice(0, 8)}...`);

      return results;
    } catch (error: any) {
      console.error("❌ [ManagerMemory] Error generating all agent summaries:", error.message);
      return [];
    }
  }

  async getExistingManagerSummaryDates(
    subscriptionId: string,
    agentProfileId?: string | null
  ): Promise<Date[]> {
    try {
      const conditions = [
        eq(managerDailySummaries.subscriptionId, subscriptionId)
      ];

      if (agentProfileId !== undefined) {
        if (agentProfileId === null) {
          conditions.push(sql`${managerDailySummaries.agentProfileId} IS NULL`);
        } else {
          conditions.push(eq(managerDailySummaries.agentProfileId, agentProfileId));
        }
      }

      const summaries = await db
        .select({
          summaryDate: managerDailySummaries.summaryDate,
        })
        .from(managerDailySummaries)
        .where(and(...conditions))
        .orderBy(desc(managerDailySummaries.summaryDate));

      return summaries.map(s => s.summaryDate);
    } catch (error: any) {
      console.error("❌ [ManagerMemory] Error getting existing summary dates:", error.message);
      return [];
    }
  }

  async generateManagerMissingDailySummariesWithProgress(
    subscriptionId: string,
    consultantId: string,
    apiKey: string,
    onProgress?: (progress: { current?: number; total?: number; date?: string }) => void
  ): Promise<{ generated: number; skipped: number }> {
    let generated = 0;
    let skipped = 0;

    try {
      // Gold/Silver users store conversations in whatsapp_agent_consultant_conversations
      // with external_visitor_id pattern: manager_{subscriptionId}_%
      const visitorPattern = `manager_${subscriptionId}_%`;

      // Find all conversations for this subscription
      const subscriptionConversations = await db
        .select({ id: whatsappAgentConsultantConversations.id })
        .from(whatsappAgentConsultantConversations)
        .where(like(whatsappAgentConsultantConversations.externalVisitorId, visitorPattern));

      console.log(`📊 [ManagerMemory] Found ${subscriptionConversations.length} conversations for subscription ${subscriptionId.slice(0, 8)}...`);

      if (subscriptionConversations.length === 0) {
        return { generated: 0, skipped: 0 };
      }

      const convIds = subscriptionConversations.map(c => c.id);

      // Find all days with messages
      const daysWithMessages = await db
        .selectDistinct({
          day: sql<Date>`DATE(${whatsappAgentConsultantMessages.createdAt})`.as("day"),
        })
        .from(whatsappAgentConsultantMessages)
        .where(inArray(whatsappAgentConsultantMessages.conversationId, convIds));

      console.log(`📅 [ManagerMemory] Found ${daysWithMessages.length} days with messages`);

      if (daysWithMessages.length === 0) {
        return { generated: 0, skipped: 0 };
      }

      // Get existing summaries
      const existingSummaries = await db
        .select({ summaryDate: managerDailySummaries.summaryDate })
        .from(managerDailySummaries)
        .where(eq(managerDailySummaries.subscriptionId, subscriptionId));

      const existingDates = new Set(
        existingSummaries.map(s => format(s.summaryDate, "yyyy-MM-dd"))
      );

      // Filter to days that need summaries (>= 2 messages and no existing summary)
      const daysNeedingSummary: Date[] = [];
      
      for (const dayRow of daysWithMessages) {
        const day = new Date(dayRow.day);
        const dayStr = format(day, "yyyy-MM-dd");
        
        if (existingDates.has(dayStr)) {
          skipped++;
          continue;
        }

        // Check message count for this day
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const msgCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(whatsappAgentConsultantMessages)
          .where(and(
            inArray(whatsappAgentConsultantMessages.conversationId, convIds),
            gte(whatsappAgentConsultantMessages.createdAt, dayStart),
            lt(whatsappAgentConsultantMessages.createdAt, dayEnd)
          ));

        if ((msgCount[0]?.count || 0) >= 2) {
          daysNeedingSummary.push(day);
        } else {
          skipped++;
        }
      }

      console.log(`🔄 [ManagerMemory] ${daysNeedingSummary.length} days need summaries, ${skipped} skipped`);

      const totalDays = daysNeedingSummary.length;
      
      for (let i = 0; i < daysNeedingSummary.length; i++) {
        const day = daysNeedingSummary[i];
        const dateStr = format(day, "yyyy-MM-dd");
        
        onProgress?.({ current: i + 1, total: totalDays, date: dateStr });

        const result = await this.generateManagerDailySummary(
          subscriptionId,
          consultantId,
          day,
          apiKey
        );

        if (result) {
          generated++;
        }
      }

      return { generated, skipped };
    } catch (error: any) {
      console.error("❌ [ManagerMemory] Error generating missing summaries:", error.message);
      return { generated, skipped };
    }
  }

  async getManagerMemoryAudit(consultantId: string): Promise<Array<{
    subscriptionId: string;
    email: string;
    firstName: string | null;
    tier: string;
    totalDays: number;
    existingSummaries: number;
    missingDays: number;
    status: 'complete' | 'partial' | 'empty';
    agentAccessEnabled: boolean;
  }>> {
    try {
      // Gold users are clients of the consultant (from users table) - same as agent-users-router
      const goldUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(and(
          eq(users.consultantId, consultantId),
          eq(users.role, "client"),
          eq(users.isActive, true)
        ));
      
      // Get agent access status for each user
      const accessRecords = await db
        .select({
          bronzeUserId: bronzeUserAgentAccess.bronzeUserId,
          isEnabled: bronzeUserAgentAccess.isEnabled,
        })
        .from(bronzeUserAgentAccess)
        .where(eq(bronzeUserAgentAccess.userType, "gold"));

      // Build access map: userId -> isEnabled (default true if no record)
      const accessMap = new Map(accessRecords.map(r => [r.bronzeUserId, r.isEnabled]));

      const auditResults: Array<{
        subscriptionId: string;
        email: string;
        firstName: string | null;
        tier: string;
        totalDays: number;
        existingSummaries: number;
        missingDays: number;
        status: 'complete' | 'partial' | 'empty';
        agentAccessEnabled: boolean;
      }> = [];

      for (const user of goldUsers) {
        // Check if this user has agent access enabled (default true if no record)
        const agentAccessEnabled = accessMap.get(user.id) ?? true;

        // Gold users use whatsappAgentConsultantConversations with externalVisitorId pattern
        // Pattern: manager_{userId}_% (using user.id from users table)
        const visitorPattern = `manager_${user.id}_%`;
        
        // Get conversations with their agentConfigId in a single query
        const userConversationsWithAgent = await db
          .select({ 
            id: whatsappAgentConsultantConversations.id,
            agentConfigId: whatsappAgentConsultantConversations.agentConfigId,
          })
          .from(whatsappAgentConsultantConversations)
          .where(like(whatsappAgentConsultantConversations.externalVisitorId, visitorPattern));

        if (userConversationsWithAgent.length === 0) {
          auditResults.push({
            subscriptionId: user.id, // Using user.id as subscriptionId for consistency
            email: user.email,
            firstName: user.firstName,
            tier: 'gold',
            totalDays: 0,
            existingSummaries: 0,
            missingDays: 0,
            status: 'complete',
            agentAccessEnabled,
          });
          continue;
        }

        const convIds = userConversationsWithAgent.map(c => c.id);

        // Build a map of conversationId -> agentConfigId
        const convToAgentMap = new Map<string, string>();
        for (const conv of userConversationsWithAgent) {
          if (conv.agentConfigId) {
            convToAgentMap.set(conv.id, conv.agentConfigId);
          }
        }

        // Count distinct (day, agentConfigId) pairs with >= 2 messages per agent per day
        // This is the correct per-agent audit logic
        const daysWithMessagesByAgent = await db
          .select({
            day: sql<Date>`DATE(${whatsappAgentConsultantMessages.createdAt})`.as("day"),
            conversationId: whatsappAgentConsultantMessages.conversationId,
            msgCount: sql<number>`count(*)::int`.as("msg_count"),
          })
          .from(whatsappAgentConsultantMessages)
          .where(inArray(whatsappAgentConsultantMessages.conversationId, convIds))
          .groupBy(sql`DATE(${whatsappAgentConsultantMessages.createdAt})`, whatsappAgentConsultantMessages.conversationId);

        // Group by (date, agentId) and sum messages
        const dateAgentPairs = new Map<string, number>(); // "date|agentId" -> messageCount
        for (const row of daysWithMessagesByAgent) {
          const agentId = convToAgentMap.get(row.conversationId) || 'unknown';
          const dateStr = format(row.day, "yyyy-MM-dd");
          const key = `${dateStr}|${agentId}`;
          dateAgentPairs.set(key, (dateAgentPairs.get(key) || 0) + row.msgCount);
        }

        // Count qualifying (date, agent) pairs with >= 2 messages
        const qualifyingPairs = Array.from(dateAgentPairs.entries()).filter(([_, count]) => count >= 2);
        const totalDays = qualifyingPairs.length; // This is now (date × agents) count

        // Count existing summaries WITH agentProfileId set (per-agent summaries)
        const existingSummariesResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(managerDailySummaries)
          .where(and(
            eq(managerDailySummaries.subscriptionId, user.id),
            isNotNull(managerDailySummaries.agentProfileId)
          ));

        const perAgentSummaries = existingSummariesResult[0]?.count || 0;
        
        // Also count legacy summaries (without agentProfileId) for display
        const legacySummariesResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(managerDailySummaries)
          .where(and(
            eq(managerDailySummaries.subscriptionId, user.id),
            isNull(managerDailySummaries.agentProfileId)
          ));
        const legacySummaries = legacySummariesResult[0]?.count || 0;
        
        // Total summaries is per-agent + legacy
        const existingSummaries = perAgentSummaries + legacySummaries;
        
        // For missing days, we compare against per-agent requirement
        // If user has legacy summaries but no per-agent ones, they're still "missing"
        const missingDays = Math.max(0, totalDays - perAgentSummaries);

        let status: 'complete' | 'partial' | 'empty' = 'complete';
        if (totalDays === 0) {
          status = 'empty';
        } else if (missingDays > 0) {
          status = 'partial';
        }

        auditResults.push({
          subscriptionId: user.id,
          email: user.email,
          firstName: user.firstName,
          tier: 'gold',
          totalDays,
          existingSummaries,
          missingDays,
          status,
          agentAccessEnabled,
        });
      }

      return auditResults;
    } catch (error: any) {
      console.error("❌ [ManagerMemory] Error getting audit:", error.message);
      return [];
    }
  }
  async getGoldUserAgentBreakdown(
    userId: string
  ): Promise<Array<{
    agentId: string;
    agentName: string;
    conversationCount: number;
    messageCount: number;
    lastMessageAt: Date | null;
  }>> {
    try {
      if (!userId) {
        console.warn("⚠️ [ManagerMemory] getGoldUserAgentBreakdown called with empty userId");
        return [];
      }
      
      // Gold users have subscriptionId, not regular visitorPattern
      // Check if conversations exist for this Gold user via their subscription
      const visitorPattern = `manager_${userId}_%`;
      console.log(`🔍 [ManagerMemory] Looking for conversations with pattern: ${visitorPattern}`);

      // Get all conversations for this Gold user with agent config info
      const conversations = await db
        .select({
          id: whatsappAgentConsultantConversations.id,
          agentConfigId: whatsappAgentConsultantConversations.agentConfigId,
          updatedAt: whatsappAgentConsultantConversations.updatedAt,
        })
        .from(whatsappAgentConsultantConversations)
        .where(like(whatsappAgentConsultantConversations.externalVisitorId, visitorPattern));

      console.log(`🔍 [ManagerMemory] Found ${conversations.length} conversations for user ${userId.slice(0, 8)}...`);

      if (!conversations || conversations.length === 0) {
        return [];
      }

      // Group conversations by agent config
      const agentMap = new Map<string, {
        conversationIds: string[];
        lastMessageAt: Date | null;
      }>();

      for (const conv of conversations) {
        if (!conv) continue;
        const agentId = conv.agentConfigId || 'unknown';
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, { conversationIds: [], lastMessageAt: null });
        }
        const agentData = agentMap.get(agentId)!;
        agentData.conversationIds.push(conv.id);
        if (!agentData.lastMessageAt || (conv.updatedAt && conv.updatedAt > agentData.lastMessageAt)) {
          agentData.lastMessageAt = conv.updatedAt;
        }
      }

      // Get agent names from consultant_whatsapp_config
      const agentIds: string[] = [];
      for (const key of agentMap.keys()) {
        if (key !== 'unknown') {
          agentIds.push(key);
        }
      }
      
      let agentNames = new Map<string, string>();
      if (agentIds.length > 0) {
        try {
          const agents = await db
            .select({
              id: consultantWhatsappConfig.id,
              agentName: consultantWhatsappConfig.agentName,
            })
            .from(consultantWhatsappConfig)
            .where(inArray(consultantWhatsappConfig.id, agentIds));
          
          if (agents && Array.isArray(agents)) {
            for (const a of agents) {
              if (a && a.id) {
                agentNames.set(a.id, a.agentName || 'Agente senza nome');
              }
            }
          }
        } catch (queryError: any) {
          console.error("❌ [ManagerMemory] Error querying agent configs:", queryError.message);
        }
      }

      // Get message counts for each agent
      const results: Array<{
        agentId: string;
        agentName: string;
        conversationCount: number;
        messageCount: number;
        lastMessageAt: Date | null;
      }> = [];

      for (const [agentId, data] of agentMap.entries()) {
        if (!data || !data.conversationIds || data.conversationIds.length === 0) continue;
        
        const msgCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(whatsappAgentConsultantMessages)
          .where(inArray(whatsappAgentConsultantMessages.conversationId, data.conversationIds));

        results.push({
          agentId,
          agentName: agentNames.get(agentId) || 'Agente sconosciuto',
          conversationCount: data.conversationIds.length,
          messageCount: msgCountResult[0]?.count || 0,
          lastMessageAt: data.lastMessageAt,
        });
      }

      // Sort by message count descending
      results.sort((a, b) => b.messageCount - a.messageCount);

      return results;
    } catch (error: any) {
      console.error("❌ [ManagerMemory] Error getting agent breakdown:", error.message);
      console.error("❌ [ManagerMemory] Stack:", error.stack);
      return [];
    }
  }
}

export const conversationMemoryService = new ConversationMemoryService();
