import { useState } from "react";
import { ChevronDown, ChevronRight, Play, CheckCircle, AlertCircle, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeExecution {
  language: string;
  code: string;
  outcome?: string;
  output?: string;
}

interface CodeExecutionBlockProps {
  codeExecutions: CodeExecution[];
}

export function CodeExecutionBlock({ codeExecutions }: CodeExecutionBlockProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  if (!codeExecutions || codeExecutions.length === 0) {
    return null;
  }

  return (
    <div className="my-3 space-y-2">
      {codeExecutions.map((execution, index) => (
        <div
          key={index}
          className="border border-slate-700 rounded-lg overflow-hidden bg-slate-900"
        >
          <button
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-slate-200">
                Codice Python eseguito
              </span>
              {execution.outcome && (
                execution.outcome === "OUTCOME_OK" ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                )
              )}
              {!execution.outcome && (
                <div className="flex items-center gap-1">
                  <Play className="h-3 w-3 text-blue-400 animate-pulse" />
                  <span className="text-xs text-blue-400">In esecuzione...</span>
                </div>
              )}
            </div>
            {expandedIndex === index ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {expandedIndex === index && (
            <div className="p-3 space-y-3">
              <div>
                <div className="text-xs text-slate-400 mb-1 font-medium">Codice</div>
                <pre className="bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                  <code className="text-green-300 font-mono whitespace-pre">
                    {execution.code}
                  </code>
                </pre>
              </div>

              {execution.output && (
                <div>
                  <div className="text-xs text-slate-400 mb-1 font-medium flex items-center gap-1">
                    Risultato
                    {execution.outcome === "OUTCOME_OK" && (
                      <CheckCircle className="h-3 w-3 text-green-400" />
                    )}
                  </div>
                  <pre className={cn(
                    "p-3 rounded text-xs overflow-x-auto font-mono",
                    execution.outcome === "OUTCOME_OK" 
                      ? "bg-green-950/50 text-green-200 border border-green-800/50" 
                      : "bg-amber-950/50 text-amber-200 border border-amber-800/50"
                  )}>
                    {execution.output}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
