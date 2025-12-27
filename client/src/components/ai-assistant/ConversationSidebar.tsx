import { useState } from "react";
import { motion, PanInfo } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight, 
  Trash2,
  Sparkles,
  Settings,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode?: "assistenza" | "consulente" | "live_voice";
  consultantType?: "finanziario" | "vendita" | "business";
  agentId?: string | null;
}

interface Agent {
  id: string;
  name: string;
  businessName?: string;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  conversationsLoading: boolean;
  selectedConversationId: string | null;
  loadingConversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  variant: "consultant" | "client";
  isMobile: boolean;
  sidebarMinimized: boolean;
  onToggleMinimize: () => void;
  availableAgents?: Agent[];
  agentFilter?: string;
  onAgentFilterChange?: (value: string) => void;
  onSettingsClick?: () => void;
}

type FilterType = "all" | "assistenza" | "consulente" | "vocale";

export function ConversationSidebar({
  conversations,
  conversationsLoading,
  selectedConversationId,
  loadingConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  variant,
  isMobile,
  sidebarMinimized,
  onToggleMinimize,
  availableAgents = [],
  agentFilter = "all",
  onAgentFilterChange,
  onSettingsClick,
}: ConversationSidebarProps) {
  const [swipedConversationId, setSwipedConversationId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const filteredConversations = conversations.filter((conv) => {
    if (agentFilter !== "all") {
      if (agentFilter === "base") {
        if (conv.agentId) return false;
      } else {
        if (conv.agentId !== agentFilter) return false;
      }
    }
    
    if (activeFilter === "all") return true;
    if (activeFilter === "assistenza") return conv.mode === "assistenza";
    if (activeFilter === "vocale") return conv.mode === "live_voice";
    if (activeFilter === "consulente") return conv.mode === "consulente";
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Oggi";
    if (diffDays === 1) return "Ieri";
    if (diffDays < 7) return date.toLocaleDateString('it-IT', { weekday: 'short' });
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  const filterPills: { value: FilterType; label: string }[] = [
    { value: "all", label: "Tutte" },
    { value: "assistenza", label: "Assistenza" },
    { value: "consulente", label: "Consulente" },
    { value: "vocale", label: "Vocale" },
  ];

  return (
    <div className={cn(
      "border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col transition-all duration-300",
      sidebarMinimized ? "w-16" : "w-72"
    )}>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          {!sidebarMinimized ? (
            <>
              <Button
                onClick={onNewConversation}
                className="flex-1 h-10 bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600 border-0 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="font-medium">Nuova chat</span>
              </Button>
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleMinimize}
                  className="h-10 w-10 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={onNewConversation}
              size="icon"
              className="h-10 w-10 mx-auto bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600 border-0"
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>

        {!sidebarMinimized && variant === "consultant" && onSettingsClick && (
          <Button
            onClick={onSettingsClick}
            variant="ghost"
            className="w-full h-9 justify-start text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          >
            <Settings className="h-4 w-4 mr-2" />
            <span className="text-sm">Impostazioni</span>
          </Button>
        )}

        {!sidebarMinimized && (
          <>
            <Separator className="bg-slate-200 dark:bg-slate-800" />
            
            <div className="flex flex-wrap gap-1.5">
              {filterPills.map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => setActiveFilter(pill.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                    activeFilter === pill.value
                      ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-sm"
                      : "bg-slate-200/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-300/60 dark:hover:bg-slate-700/60"
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {availableAgents.length > 0 && onAgentFilterChange && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  onClick={() => onAgentFilterChange("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
                    agentFilter === "all"
                      ? "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 ring-1 ring-teal-300 dark:ring-teal-700"
                      : "bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-700/40"
                  )}
                >
                  <Bot className="h-3 w-3" />
                  Tutti
                </button>
                <button
                  onClick={() => onAgentFilterChange("base")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
                    agentFilter === "base"
                      ? "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-300 dark:ring-cyan-700"
                      : "bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-700/40"
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  Base
                </button>
                {availableAgents.slice(0, 2).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => onAgentFilterChange(agent.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 truncate max-w-[100px]",
                      agentFilter === agent.id
                        ? "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 ring-1 ring-teal-300 dark:ring-teal-700"
                        : "bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-700/40"
                    )}
                    title={agent.name}
                  >
                    {agent.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!sidebarMinimized && (
        <ScrollArea className="flex-1">
          <div className="px-2 pb-4">
            {conversationsLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 animate-pulse" />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-slate-400 dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Nessuna conversazione</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Inizia una nuova chat</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredConversations.map((conversation) => (
                  <div key={conversation.id} className="relative group">
                    <motion.div 
                      className="absolute right-0 top-0 bottom-0 flex items-center z-10"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ 
                        opacity: swipedConversationId === conversation.id ? 1 : 0,
                        x: swipedConversationId === conversation.id ? 0 : 10
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-full w-12 rounded-none rounded-r-lg bg-red-500 hover:bg-red-600 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conversation.id);
                          setSwipedConversationId(null);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </motion.div>

                    <motion.div
                      className="relative z-0"
                      drag="x"
                      dragConstraints={{ left: -48, right: 0 }}
                      dragElastic={0.1}
                      onDragEnd={(event: any, info: PanInfo) => {
                        if (info.offset.x < -40) {
                          setSwipedConversationId(conversation.id);
                        } else {
                          setSwipedConversationId(null);
                        }
                      }}
                      animate={{
                        x: swipedConversationId === conversation.id ? -48 : 0
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                      <button
                        onClick={() => {
                          onSelectConversation(conversation.id);
                          setSwipedConversationId(null);
                        }}
                        disabled={loadingConversationId === conversation.id}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-all duration-150",
                          "hover:bg-slate-200/60 dark:hover:bg-slate-800/60",
                          selectedConversationId === conversation.id
                            ? "bg-cyan-100/80 dark:bg-cyan-900/30 hover:bg-cyan-100 dark:hover:bg-cyan-900/40"
                            : "bg-transparent"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              selectedConversationId === conversation.id
                                ? "text-cyan-900 dark:text-cyan-100"
                                : "text-slate-800 dark:text-slate-200"
                            )}>
                              {conversation.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                              {formatDate(conversation.updatedAt)}
                            </p>
                          </div>
                          {loadingConversationId === conversation.id && (
                            <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    </motion.div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {sidebarMinimized && !isMobile && (
        <div className="flex-1 flex flex-col items-center pt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMinimize}
            className="h-10 w-10 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
