import { motion } from "framer-motion";
import { Sparkles, MessageSquare, Lightbulb, BookOpen, Target, TrendingUp, Bot, LucideIcon, Loader2, ArrowRight, Activity } from "lucide-react";
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
    gradient: "from-primary to-primary/80",
  },
  {
    icon: BookOpen,
    label: "Progressi esercizi",
    prompt: "Mostrami i progressi degli esercizi di questo cliente",
    gradient: "from-primary/80 to-violet-400",
  },
  {
    icon: MessageSquare,
    label: "Prepara consulenza",
    prompt: "Aiutami a preparare la prossima consulenza con questo cliente",
    gradient: "from-primary/90 to-primary",
  },
  {
    icon: Lightbulb,
    label: "Suggerimenti azioni",
    prompt: "Quali azioni dovrei intraprendere con i miei clienti questa settimana?",
    gradient: "from-primary/85 to-primary",
  },
];

const clientSuggestions = [
  {
    icon: Target,
    label: "I miei obiettivi",
    prompt: "Mostrami un riepilogo dei miei obiettivi e progressi",
    gradient: "from-primary to-primary/80",
  },
  {
    icon: BookOpen,
    label: "Cosa studiare oggi",
    prompt: "Quale lezione dovrei studiare oggi?",
    gradient: "from-primary/80 to-violet-400",
  },
  {
    icon: TrendingUp,
    label: "I miei progressi",
    prompt: "Analizza i miei progressi nelle ultime settimane",
    gradient: "from-primary/90 to-primary",
  },
  {
    icon: Lightbulb,
    label: "Esercizi pendenti",
    prompt: "Quali esercizi ho ancora da completare?",
    gradient: "from-primary/85 to-primary",
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
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  const defaultSuggestions = variant === "consultant" ? consultantSuggestions : clientSuggestions;
  
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
    <div className="flex flex-col items-center flex-1 px-4 py-8 overflow-y-auto bg-background">
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
          className="relative mb-8"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-primary/85 to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
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
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
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
          className="text-2xl md:text-3xl font-bold text-foreground mb-2 text-center"
        >
          {getGreeting()}{userName ? `, ${userName}` : ""}!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-base md:text-lg text-muted-foreground/70 mb-3 text-center"
        >
          {agentName ? (
            <>Sono <span className="font-medium text-primary">{agentName}</span>, il tuo copilota AI per il business</>
          ) : (
            "Il tuo copilota AI per il business"
          )}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="flex items-center gap-2 mb-8"
        >
          <Activity className="w-3 h-3 text-emerald-500" />
          <span className="text-xs text-muted-foreground/70">Assistente attivo · Tutti i sistemi sincronizzati</span>
        </motion.div>

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
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl"
        >
          {suggestionsLoading && agentId ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
                  className={cn(
                    "flex flex-col items-center gap-3 p-5 rounded-xl",
                    "bg-card border border-border/60"
                  )}
                >
                  <div className="w-12 h-12 rounded-xl bg-muted animate-pulse" />
                  <div className="space-y-2 w-full">
                    <div className="h-4 w-24 mx-auto bg-muted rounded animate-pulse" />
                    <div className="h-3 w-32 mx-auto bg-muted/60 rounded animate-pulse" />
                  </div>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="col-span-full flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Generazione suggerimenti personalizzati...</span>
              </motion.div>
            </>
          ) : (
            suggestions.map((suggestion, index) => (
              <motion.button
                key={suggestion.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
                onClick={() => !disabled && onSuggestionClick(suggestion.prompt)}
                disabled={disabled}
                whileHover={{ y: -3 }}
                className={cn(
                  "group relative flex flex-col items-start gap-3 p-5 rounded-xl",
                  "bg-card border border-border/60",
                  "hover:border-primary/40",
                  "hover:shadow-lg hover:shadow-primary/5",
                  "transition-all duration-200",
                  "text-left",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl",
                  "bg-gradient-to-br",
                  suggestion.gradient,
                  "flex items-center justify-center",
                  "group-hover:scale-105 transition-transform duration-200"
                )}>
                  <suggestion.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <span className="text-sm font-bold text-foreground block mb-1">
                    {suggestion.label}
                  </span>
                  <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {suggestion.prompt}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/40 absolute top-5 right-4 group-hover:text-primary transition-colors duration-200" />
              </motion.button>
            ))
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="mt-8 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20"
        >
          <Lightbulb className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-xs text-muted-foreground">
            Suggerimento: Chiedi un'analisi dei clienti inattivi per riattivare il tuo business
          </span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-4 text-xs text-muted-foreground/50 text-center"
        >
          Scrivi un messaggio o scegli uno dei suggerimenti sopra
        </motion.p>
      </motion.div>
    </div>
  );
}
