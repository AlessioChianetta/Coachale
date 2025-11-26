import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Brain, Lightbulb, Search, BookOpen } from "lucide-react";

const thinkingMessages = [
  { text: "Sto analizzando le tue lezioni", icon: BookOpen },
  { text: "Cerco tra i contenuti disponibili", icon: Search },
  { text: "Sto elaborando la risposta", icon: Brain },
  { text: "Organizzo le informazioni", icon: Sparkles },
  { text: "Preparo una risposta dettagliata", icon: Lightbulb },
  { text: "Quasi pronto", icon: Sparkles },
];

export function TypingIndicator() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % thinkingMessages.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = thinkingMessages[currentMessageIndex].icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-start gap-3"
    >
      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg ring-2 ring-purple-200 dark:ring-purple-800">
        <Loader2 className="h-5 w-5 animate-spin text-white" />
      </div>
      <div className="flex-1 mt-1">
        <div className="inline-flex items-center gap-3 bg-white dark:bg-gray-800 rounded-2xl px-5 py-3.5 min-w-[220px] shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2.5 h-2.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2.5 h-2.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMessageIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2"
            >
              <CurrentIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                {thinkingMessages[currentMessageIndex].text}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
        
        <motion.div 
          className="mt-3 ml-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2">
            <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full flex-1 max-w-[240px] overflow-hidden shadow-sm">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: 60,
                  ease: "linear",
                }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              In elaborazione...
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
