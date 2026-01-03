import { useEffect, useRef } from "react";
import { Message } from "./Message";
import { motion } from "framer-motion";
import { TypingIndicator } from "./TypingIndicator";

interface MessageListProps {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
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

        {isTyping && (
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