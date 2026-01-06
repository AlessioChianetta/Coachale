import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Brain, Calendar, MessageSquare, Loader2, RefreshCw, Sparkles, 
  ChevronDown, ChevronUp, Hash, Tag, X, CalendarDays, CheckCircle2, Clock, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getAuthHeaders } from "@/lib/auth";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

interface GenerationProgress {
  type: "connecting" | "scanning" | "start" | "processing" | "generated" | "skipped" | "complete" | "error";
  date?: string;
  current?: number;
  total?: number;
  message?: string;
  generated?: number;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Oggi";
  if (isYesterday(date)) return "Ieri";
  return format(date, "EEEE d MMMM", { locale: it });
}

function getDateBadgeStyle(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
  if (isYesterday(date)) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
  if (isThisWeek(date, { weekStartsOn: 1 })) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
}

function groupSummariesByPeriod(summaries: DailySummary[]): Record<string, DailySummary[]> {
  const groups: Record<string, DailySummary[]> = {
    oggi: [],
    ieri: [],
    "questa settimana": [],
    "questo mese": [],
    precedenti: [],
  };

  for (const summary of summaries) {
    const date = new Date(summary.date);
    if (isToday(date)) {
      groups["oggi"].push(summary);
    } else if (isYesterday(date)) {
      groups["ieri"].push(summary);
    } else if (isThisWeek(date, { weekStartsOn: 1 })) {
      groups["questa settimana"].push(summary);
    } else if (isThisMonth(date)) {
      groups["questo mese"].push(summary);
    } else {
      groups["precedenti"].push(summary);
    }
  }

  return groups;
}

interface ConversationMemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConversationMemoryPanel({ isOpen, onClose }: ConversationMemoryPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
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

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startGeneration = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIsGenerating(true);
    setProgress(null);
    setProgressLog([]);

    const token = localStorage.getItem("token");
    const url = `/api/consultant/ai/generate-daily-summaries-stream?token=${token}`;
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as GenerationProgress;
        setProgress(data);
        
        if (data.message) {
          setProgressLog(prev => [...prev.slice(-10), data.message!]);
        }

        if (data.type === "complete" || data.type === "error") {
          eventSource.close();
          setIsGenerating(false);
          queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/daily-summaries"] });
        }
      } catch (e) {
        console.error("Error parsing SSE event:", e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setIsGenerating(false);
      setProgress({ type: "error", message: "Connessione persa" });
    };
  };

  const deleteAllSummaries = async () => {
    if (!confirm("Vuoi eliminare tutti i riassunti? Potrai rigenerarli dopo.")) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const response = await fetch("/api/consultant/ai/daily-summaries", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) throw new Error("Errore durante l'eliminazione");
      
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/daily-summaries"] });
    } catch (error) {
      console.error("Error deleting summaries:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteAndRegenerate = async () => {
    if (!confirm("Vuoi eliminare e rigenerare tutti i riassunti? Questa operazione potrebbe richiedere alcuni minuti.")) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const response = await fetch("/api/consultant/ai/daily-summaries", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) throw new Error("Errore durante l'eliminazione");
      
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/daily-summaries"] });
      setIsDeleting(false);
      
      // Start regeneration
      startGeneration();
    } catch (error) {
      console.error("Error deleting summaries:", error);
      setIsDeleting(false);
    }
  };

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
  const groupedSummaries = groupSummariesByPeriod(dailySummaries);

  const totalConversations = dailySummaries.reduce((sum, s) => sum + s.conversationCount, 0);
  const totalMessages = dailySummaries.reduce((sum, s) => sum + s.messageCount, 0);

  const progressPercent = progress?.current && progress?.total 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 flex flex-col">
      <div className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-800 dark:text-slate-200">Memoria AI</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Riassunti delle tue conversazioni
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-700"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {dailySummaries.length > 0 && (
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{dailySummaries.length} giorni</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{totalConversations} conversazioni</span>
            </div>
            <div className="flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" />
              <span>{totalMessages} messaggi</span>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        {isGenerating ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Generazione in corso...
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {progress?.current || 0}/{progress?.total || 0}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            {progress?.date && (
              <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{progress.date}</span>
              </div>
            )}
            {progressLog.length > 0 && (
              <div className="max-h-24 overflow-y-auto bg-slate-100 dark:bg-slate-800 rounded-lg p-2 text-xs space-y-1">
                {progressLog.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                    {log.includes("Generato") ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={startGeneration}
                disabled={isDeleting}
              >
                <Sparkles className="h-4 w-4 text-purple-500" />
                Genera
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                onClick={deleteAndRegenerate}
                disabled={isDeleting || dailySummaries.length === 0}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Rigenera
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={deleteAllSummaries}
                disabled={isDeleting || dailySummaries.length === 0}
                title="Elimina tutti i riassunti"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center">
            <Brain className="h-12 w-12 text-red-300 dark:text-red-600 mx-auto mb-3" />
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              Errore nel caricamento della memoria
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </div>
        ) : dailySummaries.length > 0 ? (
          <div className="p-4 space-y-6">
            {Object.entries(groupedSummaries).map(([period, summaries]) => {
              if (summaries.length === 0) return null;
              
              return (
                <div key={period}>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    {period}
                  </h3>
                  <div className="space-y-2">
                    {summaries.map((summary) => (
                      <Collapsible
                        key={summary.id}
                        open={expandedIds.has(summary.id)}
                        onOpenChange={() => toggleExpanded(summary.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-all border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Badge className={cn("text-[10px] px-2 py-0.5 font-medium border", getDateBadgeStyle(summary.date))}>
                                  {formatDateLabel(summary.date)}
                                </Badge>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {summary.conversationCount} chat
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                {summary.summary}
                              </p>
                            </div>
                            <div className="flex-shrink-0 pt-1">
                              {expandedIds.has(summary.id) ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-13 mt-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                              {summary.summary}
                            </p>
                            
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-3">
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span>{summary.conversationCount} conversazioni</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Hash className="h-3.5 w-3.5" />
                                <span>{summary.messageCount} messaggi</span>
                              </div>
                            </div>
                            
                            {summary.topics && summary.topics.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-2">
                                  <Tag className="h-3.5 w-3.5" />
                                  <span>Argomenti</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {summary.topics.map((topic, i) => (
                                    <Badge 
                                      key={i} 
                                      variant="secondary" 
                                      className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                    >
                                      {topic}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mx-auto mb-4">
              <Brain className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Nessun riassunto
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
              Genera i riassunti delle tue conversazioni AI
            </p>
            <Button
              variant="default"
              className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              onClick={startGeneration}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Genera riassunti
            </Button>
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          L'AI usa questi riassunti per ricordare le conversazioni passate
        </p>
      </div>
    </div>
  );
}
