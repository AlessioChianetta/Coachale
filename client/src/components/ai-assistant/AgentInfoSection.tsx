import { Bot, Target, Users, Lightbulb, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AgentInfoSectionProps {
  agentName?: string;
  whatWeDo?: string | null;
  whoWeHelp?: string | null;
  howWeDoIt?: string | null;
  usp?: string | null;
  mission?: string | null;
}

export function AgentInfoSection({
  agentName,
  whatWeDo,
  whoWeHelp,
  howWeDoIt,
  usp,
  mission,
}: AgentInfoSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasContent = whatWeDo || whoWeHelp || howWeDoIt || usp || mission;

  if (!hasContent) return null;

  const infoItems = [
    { icon: Target, label: "Cosa Faccio", content: whatWeDo, color: "text-cyan-500" },
    { icon: Users, label: "Chi Aiuto", content: whoWeHelp, color: "text-teal-500" },
    { icon: Lightbulb, label: "Come Lo Faccio", content: howWeDoIt, color: "text-amber-500" },
    { icon: Sparkles, label: "Punto di Forza", content: usp, color: "text-purple-500" },
  ].filter(item => item.content);

  const primaryInfo = infoItems[0];
  const secondaryInfo = infoItems.slice(1);

  return (
    <div className="w-full max-w-2xl mx-auto mb-4 sm:mb-6">
      <div className="bg-gradient-to-br from-slate-50 to-cyan-50/30 dark:from-slate-800/50 dark:to-cyan-900/20 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-md">
              <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                Chi è {agentName || "l'Assistente"}?
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Scopri cosa posso fare per te
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-slate-400">
              {isExpanded ? "Chiudi" : "Espandi"}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
            )}
          </div>
        </button>

        {/* Expanded Content */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3">
            {/* Mission if available */}
            {mission && (
              <div className="p-2.5 sm:p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg sm:rounded-xl border border-slate-200/50 dark:border-slate-600/50">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
                  "{mission}"
                </p>
              </div>
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {infoItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={index}
                    className="p-2.5 sm:p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg sm:rounded-xl border border-slate-200/50 dark:border-slate-600/50"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", item.color)} />
                      <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                      {item.content}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Collapsed Preview - show first item */}
        {!isExpanded && primaryInfo && (() => {
          const PrimaryIcon = primaryInfo.icon;
          return (
            <div className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="p-2.5 sm:p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg sm:rounded-xl border border-slate-200/50 dark:border-slate-600/50">
                <div className="flex items-center gap-2 mb-1">
                  <PrimaryIcon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", primaryInfo.color)} />
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {primaryInfo.label}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-2">
                  {primaryInfo.content}
                </p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
