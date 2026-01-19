import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Send,
  Sparkles,
  User,
  Bot,
  Loader2,
  BarChart3,
  Table,
  History,
  Lightbulb,
  X,
} from "lucide-react";

interface QueryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  queryResult?: QueryResult;
}

interface QueryResult {
  success: boolean;
  data?: {
    rows?: any[];
    aggregations?: Record<string, any>;
    chartData?: any[];
    summary?: string;
  };
  explanation?: string;
  sqlGenerated?: string;
  error?: string;
}

interface QueryChatProps {
  datasetId: string;
  datasetName: string;
  columnMapping?: Record<string, { displayName: string; dataType: string }>;
  onResultSelect?: (result: QueryResult) => void;
  onClose?: () => void;
}

const exampleQueries = [
  "Mostrami il totale delle vendite per mese",
  "Quali sono i 10 prodotti più venduti?",
  "Calcola la media degli ordini per cliente",
  "Confronta le vendite tra Q1 e Q2",
  "Trova gli outlier nei prezzi",
];

export function QueryChat({
  datasetId,
  datasetName,
  columnMapping,
  onResultSelect,
  onClose,
}: QueryChatProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<QueryMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const queryMutation = useMutation({
    mutationFn: (question: string) =>
      apiRequest("POST", `/api/client-data/datasets/${datasetId}/ask`, { question }),
    onSuccess: (data: any) => {
      const assistantMessage: QueryMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.data?.explanation || data.data?.summary || "Ecco i risultati della tua query.",
        timestamp: new Date(),
        queryResult: data,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.success && onResultSelect) {
        onResultSelect(data);
      }
    },
    onError: (error: Error) => {
      const errorMessage: QueryMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Mi dispiace, c'è stato un errore: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || queryMutation.isPending) return;

    const userMessage: QueryMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    queryMutation.mutate(input.trim());
    setInput("");
  };

  const handleExampleClick = (query: string) => {
    setInput(query);
    inputRef.current?.focus();
  };

  const getColumns = () => {
    if (!columnMapping) return [];
    return Object.entries(columnMapping).map(([key, val]) => ({
      name: key,
      displayName: val.displayName,
      type: val.dataType,
    }));
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-none border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Query AI
            </CardTitle>
            <CardDescription>
              Fai domande in linguaggio naturale su "{datasetName}"
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <Bot className="h-12 w-12 mx-auto text-purple-600 mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Ciao! Sono il tuo assistente AI per l'analisi dati
                </h3>
                <p className="text-sm text-slate-500">
                  Puoi farmi domande in linguaggio naturale sui tuoi dati
                </p>
              </div>

              {getColumns().length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Table className="h-4 w-4" />
                    Colonne disponibili
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getColumns().map((col) => (
                      <Badge key={col.name} variant="outline">
                        {col.displayName}
                        <span className="ml-1 text-xs text-slate-400">({col.type})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Prova con queste domande
                </p>
                <div className="space-y-2">
                  {exampleQueries.map((query, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleExampleClick(query)}
                      className="block w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-sm"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-none w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-purple-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.queryResult?.success && message.queryResult.data && (
                      <div className="mt-3 space-y-2">
                        {message.queryResult.data.summary && (
                          <p className="text-sm font-medium">
                            {message.queryResult.data.summary}
                          </p>
                        )}
                        {message.queryResult.data.rows && message.queryResult.data.rows.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onResultSelect?.(message.queryResult!)}
                            className="mt-2"
                          >
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Visualizza risultati
                          </Button>
                        )}
                      </div>
                    )}
                    <p className="text-xs mt-2 opacity-60">
                      {message.timestamp.toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {message.role === "user" && (
                    <div className="flex-none w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">
                      <User className="h-4 w-4 text-cyan-600" />
                    </div>
                  )}
                </div>
              ))}
              {queryMutation.isPending && (
                <div className="flex gap-3">
                  <div className="flex-none w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Analizzo i tuoi dati...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSubmit} className="p-4 border-t flex-none">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Fai una domanda sui tuoi dati..."
              disabled={queryMutation.isPending}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!input.trim() || queryMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {queryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
