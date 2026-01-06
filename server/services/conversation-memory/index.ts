export { 
  ConversationMemoryService, 
  conversationMemoryService,
  type ConversationScope,
  type ConversationSummary,
  type ConversationMemoryConfig 
} from "./memory-service";

export { 
  ConversationContextBuilder,
  type MemoryContext 
} from "./context-builder";

import { conversationMemoryService } from "./memory-service";
import { ConversationContextBuilder } from "./context-builder";

export const conversationContextBuilder = new ConversationContextBuilder(conversationMemoryService);
