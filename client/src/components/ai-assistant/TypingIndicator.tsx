import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Brain, Lightbulb, Search, BookOpen, Sparkles } from "lucide-react";

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-start gap-3"
    >
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-md ring-2 ring-cyan-200/50 dark:ring-cyan-700/50">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1">
        <div className="inline-flex items-center gap-3 bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-slate-800 dark:to-slate-800/80 rounded-2xl rounded-tl-md px-5 py-3.5 min-w-[220px] shadow-sm border border-cyan-100 dark:border-slate-700">
          <div className="flex gap-1.5">
            <motion.span 
              className="w-2.5 h-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
            />
            <motion.span 
              className="w-2.5 h-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.15 }}
            />
            <motion.span 
              className="w-2.5 h-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }}
            />
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
              <CurrentIcon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
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
            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full flex-1 max-w-[240px] overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: 60,
                  ease: "linear",
                }}
              />
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              In elaborazione...
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
