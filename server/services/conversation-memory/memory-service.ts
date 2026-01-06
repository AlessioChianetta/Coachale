import { db } from "../../db";
import { aiConversations, aiMessages, aiDailySummaries } from "../../../shared/schema";
import { eq, and, desc, lt, gte, isNotNull, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { startOfDay, subDays, format } from "date-fns";
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
        contents: `Genera un riassunto del giorno ${dateStr} delle conversazioni AI.

REGOLE:
- Max 3 frasi, max 200 caratteri
- Elenca gli argomenti principali discussi
- Rispondi SOLO con il riassunto, senza prefissi

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

  async generateMissingDailySummaries(
    userId: string,
    apiKey: string,
    daysBack: number = 7
  ): Promise<number> {
    let generated = 0;

    for (let i = 1; i <= daysBack; i++) {
      const targetDate = subDays(new Date(), i);
      const dayStart = startOfDay(targetDate);

      // Check if summary already exists
      const [existing] = await db
        .select({ id: aiDailySummaries.id })
        .from(aiDailySummaries)
        .where(and(
          eq(aiDailySummaries.userId, userId),
          eq(aiDailySummaries.summaryDate, dayStart)
        ))
        .limit(1);

      if (!existing) {
        const summary = await this.generateDailySummary(userId, targetDate, apiKey);
        if (summary) generated++;
      }
    }

    return generated;
  }
}

export const conversationMemoryService = new ConversationMemoryService();
