import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Search, 
  Cpu, 
  Brain,
  BookOpen,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PromptBreakdownData {
  systemPromptLength: number;
  systemPromptTokens: number;
  hasFileSearch: boolean;
  fileSearchStoreName?: string;
  fileSearchDocumentCount?: number;
  knowledgeBaseItemCount: number;
  sections: {
    name: string;
    chars: number;
  }[];
  model: string;
  thinkingEnabled: boolean;
  thinkingLevel?: string;
}

export interface CitationData {
  sourceTitle: string;
  sourceId?: string;
  content: string;
}

interface PromptBreakdownViewerProps {
  breakdown: PromptBreakdownData | null;
  citations: CitationData[];
  className?: string;
}

export function PromptBreakdownViewer({ breakdown, citations, className }: PromptBreakdownViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);

  if (!breakdown) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50",
        "border border-slate-200 dark:border-slate-700 rounded-xl p-3 mb-3",
        className
      )}
    >
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
            <Cpu className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Prompt Breakdown
          </span>
          <Badge variant="secondary" className="text-xs">
            {breakdown.model}
          </Badge>
          {breakdown.thinkingEnabled && (
            <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              <Brain className="h-3 w-3 mr-1" />
              Thinking {breakdown.thinkingLevel}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {breakdown.hasFileSearch && (
            <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <Search className="h-3 w-3 mr-1" />
              File Search
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                    <FileText className="h-3 w-3" />
                    System Prompt
                  </div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {breakdown.systemPromptLength.toLocaleString()} chars
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    ~{breakdown.systemPromptTokens.toLocaleString()} tokens
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                    <BookOpen className="h-3 w-3" />
                    Knowledge Base
                  </div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {breakdown.knowledgeBaseItemCount} items
                  </div>
                  {breakdown.hasFileSearch && (
                    <div className="text-green-600 dark:text-green-400">
                      {breakdown.fileSearchDocumentCount?.toLocaleString()} docs indexed
                    </div>
                  )}
                </div>
              </div>

              {breakdown.sections.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Prompt Sections
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {breakdown.sections.map((section, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="text-xs py-0.5"
                      >
                        {section.name}
                        <span className="ml-1 text-slate-400">
                          {section.chars > 1000 
                            ? `${(section.chars / 1000).toFixed(1)}k` 
                            : section.chars}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {breakdown.hasFileSearch && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-2.5 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-1.5 text-green-700 dark:text-green-300 text-xs font-medium mb-1">
                    <Sparkles className="h-3 w-3" />
                    File Search RAG Active
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">
                    Store: {breakdown.fileSearchStoreName}
                  </div>
                </div>
              )}

              {citations.length > 0 && (
                <div className="space-y-1.5">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCitations(!showCitations);
                    }}
                  >
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                      <Search className="h-3 w-3" />
                      File Search Citations ({citations.length})
                    </div>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                      {showCitations ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                  <AnimatePresence>
                    {showCitations && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-1.5"
                      >
                        {citations.map((citation, idx) => (
                          <div 
                            key={idx}
                            className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800"
                          >
                            <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-0.5">
                              {citation.sourceTitle}
                            </div>
                            {citation.content && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 line-clamp-2">
                                {citation.content}
                              </div>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
