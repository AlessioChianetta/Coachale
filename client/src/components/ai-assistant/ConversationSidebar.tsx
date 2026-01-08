import { useState, useMemo, type ReactNode } from "react";
import { motion, PanInfo, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight, 
  Trash2,
  Sparkles,
  Settings,
  Bot,
  Search,
  Filter,
  ChevronDown,
  Mic,
  UserCircle,
  Menu
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
  mainSidebarCollapsed?: boolean;
  onExpandMainSidebar?: () => void;
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
  mainSidebarCollapsed,
  onExpandMainSidebar,
}: ConversationSidebarProps) {
  const [swipedConversationId, setSwipedConversationId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!conv.title.toLowerCase().includes(query)) {
          return false;
        }
      }
      
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
  }, [conversations, searchQuery, agentFilter, activeFilter]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Oggi";
    if (diffDays === 1) return "Ieri";
    if (diffDays < 7) return date.toLocaleDateString('it-IT', { weekday: 'short' });
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  const getModeIcon = (mode?: string) => {
    switch (mode) {
      case "live_voice":
        return <Mic className="h-3 w-3 text-orange-500" />;
      case "consulente":
        return <UserCircle className="h-3 w-3 text-purple-500" />;
      default:
        return <Sparkles className="h-3 w-3 text-cyan-500" />;
    }
  };

  const filterOptions: { value: FilterType; label: string; icon: ReactNode }[] = [
    { value: "all", label: "Tutte", icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { value: "assistenza", label: "Assistenza", icon: <Sparkles className="h-3.5 w-3.5" /> },
    { value: "consulente", label: "Consulente", icon: <UserCircle className="h-3.5 w-3.5" /> },
    { value: "vocale", label: "Vocale", icon: <Mic className="h-3.5 w-3.5" /> },
  ];

  const activeFiltersCount = (activeFilter !== "all" ? 1 : 0) + (agentFilter !== "all" ? 1 : 0);

  return (
    <div className={cn(
      "h-full border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col transition-all duration-300 overflow-hidden",
      sidebarMinimized ? "w-16" : "w-72"
    )}>
      <div className="p-2 space-y-1.5 flex-shrink-0 overflow-hidden">
        <div className="flex items-center gap-1.5">
          {!sidebarMinimized ? (
            <>
              <Button
                onClick={onNewConversation}
                size="sm"
                className="flex-1 h-7 text-xs bg-cyan-500 hover:bg-cyan-600 text-white border-0 rounded-md shadow-sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Nuova
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Cerca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 pl-7 pr-2 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-md"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={cn(
                  "h-7 w-7 rounded-md",
                  filtersExpanded || activeFiltersCount > 0
                    ? "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
              </Button>
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleMinimize}
                  className="h-7 w-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={onNewConversation}
              size="icon"
              className="h-8 w-8 mx-auto bg-cyan-500 hover:bg-cyan-600 text-white border-0 rounded-md"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!sidebarMinimized && (
          <AnimatePresence>
            {filtersExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="pt-1 pb-0.5 space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setActiveFilter(option.value)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                          activeFilter === option.value
                            ? "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        )}
                      >
                        {option.icon}
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {availableAgents.length > 0 && onAgentFilterChange && (
                    <Select value={agentFilter} onValueChange={onAgentFilterChange}>
                      <SelectTrigger className="h-7 text-[11px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-md">
                        <div className="flex items-center gap-1.5">
                          <Bot className="h-3 w-3 text-slate-400" />
                          <SelectValue placeholder="Tutti gli agenti" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-1.5">
                            <Bot className="h-3 w-3" />
                            Tutti gli agenti
                          </div>
                        </SelectItem>
                        <SelectItem value="base">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3" />
                            Assistente Base
                          </div>
                        </SelectItem>
                        {availableAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <div className="flex items-center gap-1.5">
                              <Bot className="h-3 w-3" />
                              <span className="truncate max-w-[140px]">{agent.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {!sidebarMinimized && mainSidebarCollapsed && onExpandMainSidebar && (
          <button
            onClick={onExpandMainSidebar}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
          >
            <Menu className="h-3 w-3" />
            <span>Menu principale</span>
          </button>
        )}

        {!sidebarMinimized && variant === "consultant" && onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
          >
            <Settings className="h-3 w-3" />
            <span>Impostazioni</span>
          </button>
        )}
      </div>

      {!sidebarMinimized && (
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="px-2 pb-4 overflow-hidden">
            <div className="px-2 py-1.5 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Le tue chat
              </span>
            </div>
            
            {conversationsLoading ? (
              <div className="space-y-1 p-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded-md bg-slate-200/50 dark:bg-slate-800/50 animate-pulse" />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8 px-4">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-slate-400 dark:text-slate-600" />
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {searchQuery ? "Nessun risultato" : "Nessuna conversazione"}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">
                  {searchQuery ? "Prova un altro termine" : "Inizia una nuova chat"}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5 overflow-hidden w-full">
                {filteredConversations.map((conversation) => (
                  <div key={conversation.id} className="relative group overflow-hidden w-full">
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
                        className="h-full w-10 rounded-none rounded-r-md bg-red-500 hover:bg-red-600 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conversation.id);
                          setSwipedConversationId(null);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </motion.div>

                    <motion.div
                      className="relative z-0 overflow-hidden w-full"
                      drag="x"
                      dragConstraints={{ left: -40, right: 0 }}
                      dragElastic={0.1}
                      onDragEnd={(event: any, info: PanInfo) => {
                        if (info.offset.x < -30) {
                          setSwipedConversationId(conversation.id);
                        } else {
                          setSwipedConversationId(null);
                        }
                      }}
                      animate={{
                        x: swipedConversationId === conversation.id ? -40 : 0
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
                          "w-full text-left py-2 px-2 rounded-md transition-all duration-150 overflow-hidden",
                          "hover:bg-slate-100 dark:hover:bg-slate-800/60",
                          selectedConversationId === conversation.id
                            ? "bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/30"
                            : "bg-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2 overflow-hidden w-full">
                          <div className="flex-shrink-0">
                            {getModeIcon(conversation.mode)}
                          </div>
                          <div className="flex-1 w-0 overflow-hidden">
                            <p className={cn(
                              "text-sm overflow-hidden text-ellipsis whitespace-nowrap",
                              selectedConversationId === conversation.id
                                ? "text-cyan-900 dark:text-cyan-100 font-medium"
                                : "text-slate-700 dark:text-slate-300"
                            )}>
                              {conversation.title}
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1">
                            {loadingConversationId === conversation.id ? (
                              <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {formatDate(conversation.updatedAt)}
                              </span>
                            )}
                          </div>
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
        <div className="flex-1 flex flex-col items-center pt-4 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMinimize}
            className="h-9 w-9 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            title="Cerca"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
