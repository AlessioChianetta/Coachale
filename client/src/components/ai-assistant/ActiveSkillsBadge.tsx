import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface ActiveSkill {
  assignment: {
    id: string;
    skillStoreId: string;
    userId: string;
    isEnabled: boolean;
  };
  skill: {
    id: string;
    name: string;
    displayTitle: string;
    description: string;
    category: string;
    icon: string;
  };
}

export function ActiveSkillsBadge() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: activeSkills = [] } = useQuery<ActiveSkill[]>({
    queryKey: ["skills-store-active"],
    queryFn: async () => {
      const res = await fetch("/api/skills-store/active", {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  if (activeSkills.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
          "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
          "border border-indigo-200/60 dark:border-indigo-800/50",
          "hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700",
        )}
      >
        <Sparkles className="h-3 w-3" />
        <span>{activeSkills.length} skill{activeSkills.length !== 1 ? "" : ""} attiv{activeSkills.length !== 1 ? "e" : "a"}</span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {isExpanded && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Skill Attive</p>
            <a
              href="/consultant/ai-assistant"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Skill Store <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {activeSkills.map((item) => (
              <div
                key={item.assignment.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50"
              >
                <span className="text-sm">{item.skill.icon || "⚡"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {item.skill.displayTitle || item.skill.name}
                  </p>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 mt-0.5">
                    {item.skill.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
