import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Calendar, MessageSquare, FileText, Loader2, RefreshCw, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getAuthHeaders } from "@/lib/auth";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { it } from "date-fns/locale";

interface DailySummary {
  id: string;
  date: string;
  summary: string;
  conversationCount: number;
  messageCount: number;
  topics: string[];
}

interface MemoryResponse {
  dailySummaries: DailySummary[];
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Oggi";
  if (isYesterday(date)) return "Ieri";
  return format(date, "EEEE d MMMM", { locale: it });
}

function getDateBadgeColor(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  if (isYesterday(date)) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (isThisWeek(date, { weekStartsOn: 1 })) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}

export function ConversationMemoryPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<MemoryResponse>({
    queryKey: ["/api/consultant/ai/daily-summaries"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/ai/daily-summaries", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch daily summaries");
      return response.json();
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/consultant/ai/generate-daily-summaries", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to generate summaries");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/daily-summaries"] });
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const dailySummaries = data?.dailySummaries || [];
  const summaryCount = dailySummaries.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
        >
          <Brain className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Memoria</span>
          {summaryCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              {summaryCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Memoria AI</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Riassunti giornalieri delle tue conversazioni AI
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center">
            <Brain className="h-10 w-10 text-red-300 dark:text-red-600 mx-auto mb-3" />
            <p className="text-sm text-red-600 dark:text-red-400">
              Errore nel caricamento della memoria
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </div>
        ) : dailySummaries.length > 0 ? (
          <>
            <ScrollArea className="max-h-[400px]">
              <div className="p-3 space-y-2">
                {dailySummaries.map((summary) => (
                  <Collapsible
                    key={summary.id}
                    open={expandedIds.has(summary.id)}
                    onOpenChange={() => toggleExpanded(summary.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-[10px] px-2 py-0.5 ${getDateBadgeColor(summary.date)}`}>
                              {formatDateLabel(summary.date)}
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              {summary.conversationCount} chat, {summary.messageCount} msg
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                            {summary.summary}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {expandedIds.has(summary.id) ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-13 mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                          {summary.summary}
                        </p>
                        {summary.topics && summary.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {summary.topics.map((topic, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>

            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                L'AI usa questi riassunti per ricordare le conversazioni passate
              </p>
            </div>
          </>
        ) : (
          <div className="p-6 text-center">
            <Brain className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Nessun riassunto giornaliero
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">
              Genera i riassunti degli ultimi 7 giorni
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-purple-500" />
              )}
              Genera riassunti
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
