import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthHeaders } from "@/lib/auth";
import { ConversationMemoryPanel } from "./ConversationMemoryPanel";

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

interface ConversationMemoryPopoverProps {
  mode?: 'client' | 'consultant';
}

export function ConversationMemoryPopover({ mode = 'consultant' }: ConversationMemoryPopoverProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const apiBase = mode === 'client' ? '/api/ai' : '/api/consultant/ai';

  const { data } = useQuery<MemoryResponse>({
    queryKey: [`${apiBase}/daily-summaries`],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/daily-summaries`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch daily summaries");
      return response.json();
    },
    staleTime: 60000,
  });

  const summaryCount = data?.dailySummaries?.length || 0;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 gap-2 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
        onClick={() => setIsPanelOpen(true)}
      >
        <Brain className="h-4 w-4" />
        <span className="hidden sm:inline text-sm">Memoria</span>
        {summaryCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            {summaryCount}
          </Badge>
        )}
      </Button>

      <ConversationMemoryPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        mode={mode}
      />
    </>
  );
}
