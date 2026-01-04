import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ThinkingBubbleProps {
  thinking?: string;
  isThinking?: boolean;
  className?: string;
  modelName?: string;
  thinkingLevel?: string;
}

function extractDynamicTitle(thinking: string): string {
  if (!thinking) return "Ragionamento";
  
  const lines = thinking.trim().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const headingMatch = trimmed.match(/^#{1,3}\s*\*?\*?(.+?)\*?\*?\s*$/);
    if (headingMatch) {
      return headingMatch[1].trim().replace(/\*+/g, '');
    }
    
    const boldMatch = trimmed.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      const title = boldMatch[1].trim();
      if (title.length <= 50) return title;
    }
    
    if (trimmed.length > 0 && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      const firstSentence = trimmed.split(/[.!?]/)[0].trim();
      if (firstSentence.length <= 40) {
        return firstSentence;
      }
      return firstSentence.substring(0, 35) + '...';
    }
  }
  
  return "Ragionamento";
}

export function ThinkingBubble({ thinking, isThinking = false, className, modelName, thinkingLevel }: ThinkingBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const dynamicTitle = useMemo(() => {
    if (isThinking) return "Sto pensando...";
    return extractDynamicTitle(thinking || "");
  }, [thinking, isThinking]);

  if (!isThinking && !thinking) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn("max-w-3xl mb-3", className)}
    >
      <button
        onClick={() => thinking && setIsExpanded(!isExpanded)}
        disabled={!thinking}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
          "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50",
          thinking && "cursor-pointer",
          !thinking && "cursor-default"
        )}
      >
        {isThinking ? (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 text-blue-500" />
        )}
        
        <span className="text-slate-700 dark:text-slate-200 font-medium">
          {dynamicTitle}
          {isThinking && (modelName || thinkingLevel) && (
            <span className="ml-2 text-xs text-purple-500 dark:text-purple-400">
              ({modelName}{modelName && thinkingLevel && ' · '}{thinkingLevel})
            </span>
          )}
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
            <div className="mt-2 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50">
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
