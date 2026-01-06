import { motion } from "framer-motion";
import { Sparkles, MessageSquare, Lightbulb, BookOpen, Target, TrendingUp, Bot, LucideIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentInfoSection } from "./AgentInfoSection";
import { useQuery } from "@tanstack/react-query";

interface AgentInfoProps {
  whoWeHelp?: string | null;
  whatWeDo?: string | null;
  howWeDoIt?: string | null;
  usp?: string | null;
  mission?: string | null;
}

interface SuggestionFromAPI {
  icon: "target" | "book" | "message" | "lightbulb" | "trending" | "sparkles";
  label: string;
  prompt: string;
  gradient: string;
}

interface WelcomeScreenProps {
  userName?: string;
  agentName?: string;
  agentId?: string | null;
  onSuggestionClick: (suggestion: string) => void;
  variant?: "consultant" | "client";
  disabled?: boolean;
  agentInfo?: AgentInfoProps;
}

const iconMap: Record<string, LucideIcon> = {
  target: Target,
  book: BookOpen,
  message: MessageSquare,
  lightbulb: Lightbulb,
  trending: TrendingUp,
  sparkles: Sparkles,
};

const consultantSuggestions = [
  {
    icon: Target,
    label: "Panoramica cliente",
    prompt: "Dammi una panoramica completa del cliente selezionato",
    gradient: "from-cyan-500 to-teal-500",
  },
  {
    icon: BookOpen,
    label: "Progressi esercizi",
    prompt: "Mostrami i progressi degli esercizi di questo cliente",
    gradient: "from-teal-500 to-emerald-500",
  },
  {
    icon: MessageSquare,
    label: "Prepara consulenza",
    prompt: "Aiutami a preparare la prossima consulenza con questo cliente",
    gradient: "from-slate-500 to-cyan-500",
  },
  {
    icon: Lightbulb,
    label: "Suggerimenti azioni",
    prompt: "Quali azioni dovrei intraprendere con i miei clienti questa settimana?",
    gradient: "from-cyan-600 to-teal-600",
  },
];

const clientSuggestions = [
  {
    icon: Target,
    label: "I miei obiettivi",
    prompt: "Mostrami un riepilogo dei miei obiettivi e progressi",
    gradient: "from-cyan-500 to-teal-500",
  },
  {
    icon: BookOpen,
    label: "Cosa studiare oggi",
    prompt: "Quale lezione dovrei studiare oggi?",
    gradient: "from-teal-500 to-emerald-500",
  },
  {
    icon: TrendingUp,
    label: "I miei progressi",
    prompt: "Analizza i miei progressi nelle ultime settimane",
    gradient: "from-slate-500 to-cyan-500",
  },
  {
    icon: Lightbulb,
    label: "Esercizi pendenti",
    prompt: "Quali esercizi ho ancora da completare?",
    gradient: "from-cyan-600 to-teal-600",
  },
];

export function WelcomeScreen({ 
  userName, 
  agentName, 
  agentId,
  onSuggestionClick, 
  variant = "client",
  disabled = false,
  agentInfo
}: WelcomeScreenProps) {
  const { data: apiSuggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["agent-suggestions", agentId],
    queryFn: async () => {
      const token = localStorage.getItem("token") || localStorage.getItem("bronzeToken") || localStorage.getItem("silverToken") || localStorage.getItem("goldToken");
      const res = await fetch(`/api/ai-assistant/agent/${agentId}/suggestions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      const data = await res.json();
      return data.suggestions as SuggestionFromAPI[];
    },
    enabled: !!agentId,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: 1,
  });

  const defaultSuggestions = variant === "consultant" ? consultantSuggestions : clientSuggestions;
  
  // Use API suggestions if available, otherwise use default
  const suggestions = apiSuggestions && apiSuggestions.length > 0
    ? apiSuggestions.map(s => ({
        icon: iconMap[s.icon] || Target,
        label: s.label,
        prompt: s.prompt,
        gradient: s.gradient,
      }))
    : defaultSuggestions;
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buongiorno";
    if (hour < 18) return "Buon pomeriggio";
    return "Buonasera";
  };

  return (
    <div className="flex flex-col items-center flex-1 px-4 py-8 overflow-y-auto bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center max-w-2xl w-full my-auto"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="relative mb-6"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <motion.div
              animate={{ 
                rotate: [0, 5, -5, 0],
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 4,
                ease: "easeInOut"
              }}
            >
              {agentName ? (
                <Bot className="w-10 h-10 text-white" />
              ) : (
                <Sparkles className="w-10 h-10 text-white" />
              )}
            </motion.div>
          </div>
          <motion.div
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </motion.div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-slate-100 mb-2 text-center"
        >
          {getGreeting()}{userName ? `, ${userName}` : ""}!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-base md:text-lg text-slate-500 dark:text-slate-400 mb-6 text-center"
        >
          {agentName ? (
            <>Sono <span className="font-medium text-cyan-600 dark:text-cyan-400">{agentName}</span>, come posso aiutarti oggi?</>
          ) : (
            "Come posso aiutarti oggi?"
          )}
        </motion.p>

        {/* Agent Info Section */}
        {agentInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="w-full"
          >
            <AgentInfoSection
              agentName={agentName}
              whatWeDo={agentInfo.whatWeDo}
              whoWeHelp={agentInfo.whoWeHelp}
              howWeDoIt={agentInfo.howWeDoIt}
              usp={agentInfo.usp}
              mission={agentInfo.mission}
            />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl"
        >
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={suggestion.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
              onClick={() => !disabled && onSuggestionClick(suggestion.prompt)}
              disabled={disabled}
              className={cn(
                "group relative flex items-center gap-3 p-4 rounded-xl",
                "bg-white dark:bg-slate-800/50",
                "border border-slate-200 dark:border-slate-700/50",
                "hover:border-cyan-300 dark:hover:border-cyan-600/50",
                "hover:shadow-md hover:shadow-cyan-500/5",
                "transition-all duration-200",
                "text-left",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-lg",
                "bg-gradient-to-br",
                suggestion.gradient,
                "flex items-center justify-center",
                "group-hover:scale-105 transition-transform duration-200"
              )}>
                <suggestion.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block truncate">
                  {suggestion.label}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">
                  {suggestion.prompt}
                </span>
              </div>
            </motion.button>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-8 text-xs text-slate-400 dark:text-slate-500 text-center"
        >
          Scrivi un messaggio o scegli uno dei suggerimenti sopra
        </motion.p>
      </motion.div>
    </div>
  );
}
