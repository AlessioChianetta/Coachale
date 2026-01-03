import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Brain, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ThinkingBubbleProps {
  thinking?: string;
  isThinking?: boolean;
  className?: string;
}

export function ThinkingBubble({ thinking, isThinking = false, className }: ThinkingBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isThinking && !thinking) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn("max-w-3xl mx-auto mb-3", className)}
    >
      <button
        onClick={() => thinking && setIsExpanded(!isExpanded)}
        disabled={!thinking}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all",
          "bg-slate-100 dark:bg-slate-800/70",
          "border border-slate-200 dark:border-slate-700",
          thinking && "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700",
          !thinking && "cursor-default"
        )}
      >
        {isThinking ? (
          <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
        ) : (
          <Brain className="w-4 h-4 text-cyan-500" />
        )}
        
        <span className="text-slate-600 dark:text-slate-300 font-medium">
          {isThinking ? "Sto pensando..." : "Ho ragionato su questo"}
        </span>

        {thinking && (
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="ml-1"
          >
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </motion.div>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && thinking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-2 mb-2">
                <Brain className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Ragionamento
                </span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-headings:text-slate-700 dark:prose-headings:text-slate-200 prose-headings:font-semibold prose-headings:my-2 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {thinking}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
