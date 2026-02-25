import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Play, CheckCircle, AlertCircle, Code2, Eye, EyeOff } from "lucide-react";
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
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showFailed, setShowFailed] = useState(false);

  if (!codeExecutions || codeExecutions.length === 0) {
    return null;
  }

  const hasSuccess = codeExecutions.some(e => e.outcome === "OUTCOME_OK");
  const failedExecutions = codeExecutions.filter(e => e.outcome && e.outcome !== "OUTCOME_OK");
  const failedCount = failedExecutions.length;
  const shouldHideFailed = hasSuccess && failedCount > 0;

  const visibleExecutions = shouldHideFailed && !showFailed
    ? codeExecutions.filter(e => !e.outcome || e.outcome === "OUTCOME_OK")
    : codeExecutions;

  const getLineCount = (code: string) => code.split('\n').length;

  return (
    <div className="my-2 space-y-1.5">
      {shouldHideFailed && (
        <button
          onClick={() => setShowFailed(!showFailed)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors px-1 py-0.5"
        >
          {showFailed ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
          <span>
            {showFailed
              ? "Nascondi tentativi falliti"
              : `Mostra ${failedCount} tentativ${failedCount === 1 ? 'o fallito' : 'i falliti'}`}
          </span>
        </button>
      )}

      {visibleExecutions.map((execution, visibleIdx) => {
        const realIndex = codeExecutions.indexOf(execution);
        const lineCount = getLineCount(execution.code);
        const isExpanded = expandedIndex === realIndex;
        const isSuccess = execution.outcome === "OUTCOME_OK";
        const isError = execution.outcome && execution.outcome !== "OUTCOME_OK";
        const isRunning = !execution.outcome;

        return (
          <div
            key={realIndex}
            className={cn(
              "rounded-lg overflow-hidden transition-all duration-200",
              isError
                ? "border border-amber-800/40 bg-slate-900/80"
                : "border border-slate-700/60 bg-slate-900"
            )}
          >
            <button
              onClick={() => setExpandedIndex(isExpanded ? null : realIndex)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 transition-colors",
                isError
                  ? "bg-amber-950/30 hover:bg-amber-950/50"
                  : "bg-slate-800/80 hover:bg-slate-700/80"
              )}
            >
              <div className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-medium text-slate-300">
                  Codice Python eseguito
                </span>
                {isSuccess && <CheckCircle className="h-3.5 w-3.5 text-green-400" />}
                {isError && <AlertCircle className="h-3.5 w-3.5 text-amber-400" />}
                {isRunning && (
                  <div className="flex items-center gap-1">
                    <Play className="h-3 w-3 text-blue-400 animate-pulse" />
                    <span className="text-[10px] text-blue-400">In esecuzione...</span>
                  </div>
                )}
                <span className="text-[10px] text-slate-500 ml-1">
                  {lineCount} righe
                </span>
              </div>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-slate-500 transition-transform duration-200",
                !isExpanded && "-rotate-90"
              )} />
            </button>

            {isExpanded && (
              <div className="px-3 py-2 space-y-2">
                <div>
                  <div className="text-[10px] text-slate-500 mb-1 font-medium uppercase tracking-wider">Codice</div>
                  <pre className="bg-slate-950 p-2.5 rounded text-[11px] overflow-x-auto max-h-48 overflow-y-auto">
                    <code className="text-green-300 font-mono whitespace-pre">
                      {execution.code}
                    </code>
                  </pre>
                </div>

                {execution.output && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1 font-medium uppercase tracking-wider flex items-center gap-1">
                      Risultato
                      {isSuccess && <CheckCircle className="h-2.5 w-2.5 text-green-400" />}
                    </div>
                    <pre className={cn(
                      "p-2.5 rounded text-[11px] overflow-x-auto max-h-32 overflow-y-auto font-mono whitespace-pre-wrap break-words",
                      isSuccess
                        ? "bg-green-950/40 text-green-200 border border-green-800/30"
                        : "bg-amber-950/40 text-amber-200 border border-amber-800/30"
                    )}>
                      {execution.output}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
