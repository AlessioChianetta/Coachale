import { db } from "../../db";
import { aiConversations, aiMessages } from "../../../shared/schema";
import { eq, and, desc, lt, isNotNull, sql } from "drizzle-orm";

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

    // Determina quale colonna di ID usare in base allo scope
    const idFilter = scope === "consultant" 
      ? eq(aiConversations.consultantId, userId)
      : eq(aiConversations.clientId, userId);

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
          summary: null, // Summary column will be used when database is synced
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
}

export const conversationMemoryService = new ConversationMemoryService();
