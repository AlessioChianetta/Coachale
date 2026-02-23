import { useEffect, useRef, useCallback } from "react";
import { Message } from "./Message";
import { ThinkingBubble } from "./ThinkingBubble";
import { motion, AnimatePresence } from "framer-motion";

interface CodeExecution {
  language: string;
  code: string;
  outcome?: string;
  output?: string;
}

interface MessageListProps {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    thinking?: string;
    status?: string;
    isThinking?: boolean;
    modelName?: string;
    thinkingLevel?: string;
    suggestedActions?: Array<{
      type: string;
      label: string;
      data?: any;
    }>;
    codeExecutions?: CodeExecution[];
  }>;
  isTyping: boolean;
  onActionClick?: (actionType?: string, actionData?: any) => void;
}

export function MessageList({ messages, isTyping, onActionClick }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const userScrolledUpRef = useRef(false);

  const isNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
    }
  }, []);

  const handleScroll = useCallback(() => {
    userScrolledUpRef.current = !isNearBottom();
  }, [isNearBottom]);

  useEffect(() => {
    const hasNewMessage = messages.length > prevMessagesLengthRef.current;
    const lastMessage = messages[messages.length - 1];
    const isUserMessage = lastMessage?.role === "user";
    
    if (hasNewMessage && isUserMessage) {
      scrollToBottom();
      userScrolledUpRef.current = false;
    } else if (hasNewMessage && !userScrolledUpRef.current) {
      scrollToBottom();
    } else if (isTyping && !userScrolledUpRef.current) {
      scrollToBottom();
    }
    
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isTyping, scrollToBottom]);

  const lastMessage = messages[messages.length - 1];
  const alreadyShowingProcessing = lastMessage?.status === "processing" || lastMessage?.isThinking;
  const showTypingIndicator = isTyping && !alreadyShowingProcessing;

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6"
    >
      <div className="space-y-4 sm:space-y-5 max-w-3xl mx-auto">
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * 0.02,
              duration: 0.3,
              ease: "easeOut"
            }}
          >
            <Message message={message} onActionClick={onActionClick} />
          </motion.div>
        ))}
        <AnimatePresence>
          {showTypingIndicator && (
            <motion.div
              key="typing-indicator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              <ThinkingBubble isThinking={true} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
