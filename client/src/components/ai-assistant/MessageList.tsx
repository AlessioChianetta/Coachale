import { useEffect, useRef, useCallback } from "react";
import { Message } from "./Message";
import { motion } from "framer-motion";
import { TypingIndicator } from "./TypingIndicator";

interface MessageListProps {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    thinking?: string;
    isThinking?: boolean;
    modelName?: string;
    thinkingLevel?: string;
    suggestedActions?: Array<{
      type: string;
      label: string;
      data?: any;
    }>;
  }>;
  isTyping: boolean;
  onActionClick?: () => void;
}

export function MessageList({ messages, isTyping, onActionClick }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  // Don't show TypingIndicator if there's an assistant placeholder (empty content) or active thinking
  // This prevents flashing when streaming completes and isThinking flips to false before isTyping
  const hasAssistantPlaceholder = messages.some(msg => 
    msg.role === "assistant" && (
      msg.isThinking || 
      !msg.content?.trim() ||
      msg.thinking !== undefined
    )
  );
  const showTypingIndicator = isTyping && !hasAssistantPlaceholder;

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto px-4 sm:px-6 py-4 sm:py-6"
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

        {showTypingIndicator && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex justify-center items-center"
          >
            <TypingIndicator />
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}