import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, MessageSquare, Clock, FileText, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface MemoryConversation {
  conversationId: string;
  title: string | null;
  summary: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  mode: string;
  agentId: string | null;
}

interface MemoryContext {
  conversations: MemoryConversation[];
  totalMessages: number;
  config: {
    maxConversations: number;
    maxMessagesPerConversation: number;
    daysToLookBack: number;
  };
}

export function ConversationMemoryPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: memoryContext, isLoading, isError, refetch, isFetching } = useQuery<MemoryContext>({
    queryKey: ["/api/consultant/ai/memory-context"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/ai/memory-context", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch memory context");
      return response.json();
    },
    enabled: isOpen,
    staleTime: 30000,
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

  const conversationCount = memoryContext?.conversations?.length || 0;
  const totalMessages = memoryContext?.totalMessages || 0;

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
          {conversationCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              {conversationCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
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
            Conversazioni ricordate dall'AI per contestualizzare le risposte
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
        ) : memoryContext?.conversations && memoryContext.conversations.length > 0 ? (
          <>
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {conversationCount} conversazioni
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {totalMessages} messaggi totali
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Ultimi {memoryContext.config.daysToLookBack} giorni
                </span>
              </div>
            </div>

            <ScrollArea className="max-h-[350px]">
              <div className="p-2 space-y-1">
                {memoryContext.conversations.map((conv) => (
                  <Collapsible
                    key={conv.conversationId}
                    open={expandedIds.has(conv.conversationId)}
                    onOpenChange={() => toggleExpanded(conv.conversationId)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                              {conv.title || "Conversazione senza titolo"}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {conv.messageCount} msg
                            </Badge>
                          </div>
                          {conv.lastMessageAt && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {formatDistanceToNow(new Date(conv.lastMessageAt), { 
                                addSuffix: true, 
                                locale: it 
                              })}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {expandedIds.has(conv.conversationId) ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-11 mr-2 mb-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        {conv.summary ? (
                          <div>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Riassunto:</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{conv.summary}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                            Nessun riassunto disponibile. L'AI ricorda il contenuto dei messaggi recenti.
                          </p>
                        )}
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            ID: {conv.conversationId.slice(0, 8)}... | Modo: {conv.mode}
                            {conv.agentId && ` | Agente: ${conv.agentId.slice(0, 8)}...`}
                          </p>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>

            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                L'AI usa queste conversazioni per fornire risposte contestuali
              </p>
            </div>
          </>
        ) : (
          <div className="p-6 text-center">
            <Brain className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nessuna conversazione in memoria
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Le conversazioni recenti appariranno qui
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
