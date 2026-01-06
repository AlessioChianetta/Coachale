import { ConversationSummary, ConversationMemoryService, ConversationScope } from "./memory-service";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

export interface MemoryContext {
  hasHistory: boolean;
  contextText: string;
  conversationCount: number;
}

export class ConversationContextBuilder {
  private memoryService: ConversationMemoryService;

  constructor(memoryService: ConversationMemoryService) {
    this.memoryService = memoryService;
  }

  async buildHistoryContext(
    userId: string,
    scope: ConversationScope,
    currentConversationId?: string
  ): Promise<MemoryContext> {
    const conversations = await this.memoryService.getRecentConversations(
      userId,
      scope,
      currentConversationId
    );

    if (conversations.length === 0) {
      return {
        hasHistory: false,
        contextText: "",
        conversationCount: 0,
      };
    }

    const contextParts: string[] = [
      "=== STORICO CONVERSAZIONI PRECEDENTI ===",
      `(${conversations.length} conversazioni recenti)`,
      "",
    ];

    for (const conv of conversations) {
      const timeAgo = conv.lastMessageAt
        ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true, locale: it })
        : "data sconosciuta";

      const title = conv.title || "Conversazione senza titolo";
      const summary = conv.summary || "Nessun riassunto disponibile";

      contextParts.push(`📅 ${timeAgo}: "${title}"`);
      if (conv.summary) {
        contextParts.push(`   ${summary}`);
      }
      contextParts.push(`   (${conv.messageCount} messaggi, modalità: ${conv.mode})`);
      contextParts.push("");
    }

    contextParts.push("=== FINE STORICO ===");
    contextParts.push("");
    contextParts.push("Usa questo storico per:");
    contextParts.push("- Ricordare argomenti discussi in precedenza");
    contextParts.push("- Evitare di ripetere informazioni già fornite");
    contextParts.push("- Mantenere continuità nella conversazione");
    contextParts.push("");

    return {
      hasHistory: true,
      contextText: contextParts.join("\n"),
      conversationCount: conversations.length,
    };
  }

  async buildDetailedContext(
    userId: string,
    scope: ConversationScope,
    currentConversationId?: string,
    maxConversations: number = 3
  ): Promise<MemoryContext> {
    const conversations = await this.memoryService.getRecentConversations(
      userId,
      scope,
      currentConversationId
    );

    if (conversations.length === 0) {
      return {
        hasHistory: false,
        contextText: "",
        conversationCount: 0,
      };
    }

    const limitedConversations = conversations.slice(0, maxConversations);
    const contextParts: string[] = [
      "=== MEMORIA CONVERSAZIONI PRECEDENTI ===",
      "",
    ];

    for (const conv of limitedConversations) {
      const timeAgo = conv.lastMessageAt
        ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true, locale: it })
        : "data sconosciuta";

      const title = conv.title || "Conversazione senza titolo";

      contextParts.push(`--- Conversazione: "${title}" (${timeAgo}) ---`);

      const messages = await this.memoryService.getConversationMessages(
        conv.conversationId,
        5
      );

      for (const msg of messages) {
        const roleLabel = msg.role === "user" ? "Utente" : "Assistente";
        const truncatedContent = msg.content.length > 200
          ? msg.content.substring(0, 200) + "..."
          : msg.content;
        contextParts.push(`${roleLabel}: ${truncatedContent}`);
      }

      contextParts.push("");
    }

    contextParts.push("=== FINE MEMORIA ===");
    contextParts.push("");

    return {
      hasHistory: true,
      contextText: contextParts.join("\n"),
      conversationCount: limitedConversations.length,
    };
  }
}
