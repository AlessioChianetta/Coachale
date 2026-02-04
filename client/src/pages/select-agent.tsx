import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Sparkles, ArrowRight, AlertCircle, ChevronLeft, Crown, Medal, Coins, MessageCircle, Infinity, Zap, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_CONFIG = {
  "1": {
    name: "Bronze",
    icon: Coins,
    gradient: "from-amber-600 to-orange-700",
    bgGradient: "from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40",
    textColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-400/50",
    benefits: ["Accesso gratuito", "Messaggi limitati al giorno", "Supporto base"],
    messageLimit: "10 messaggi/giorno",
  },
  "2": {
    name: "Argento",
    icon: Medal,
    gradient: "from-slate-400 to-slate-600",
    bgGradient: "from-slate-100 to-slate-200 dark:from-slate-800/60 dark:to-slate-700/40",
    textColor: "text-slate-700 dark:text-slate-300",
    borderColor: "border-slate-400/50",
    benefits: ["Messaggi illimitati", "Priorità nelle risposte", "Supporto dedicato"],
    messageLimit: "Messaggi illimitati",
  },
  "3": {
    name: "Oro",
    icon: Crown,
    gradient: "from-yellow-500 to-amber-500",
    bgGradient: "from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40",
    textColor: "text-yellow-700 dark:text-yellow-300",
    borderColor: "border-yellow-400/50",
    benefits: ["Accesso completo a tutti gli agenti", "Messaggi illimitati", "Supporto prioritario", "Funzionalita' esclusive"],
    messageLimit: "Messaggi illimitati",
  },
} as const;

function TierBadge({ tier, tierName }: { tier: string; tierName?: string }) {
  const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG["1"];
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full border",
        `bg-gradient-to-r ${config.bgGradient}`,
        config.borderColor
      )}
    >
      <Icon className={cn("h-5 w-5", config.textColor)} />
      <span className={cn("text-sm font-semibold", config.textColor)}>
        Piano {tierName || config.name}
      </span>
    </motion.div>
  );
}

function TierInfoBox({ tier, slug }: { tier: string; slug: string }) {
  const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG["1"];
  const Icon = config.icon;
  const [, navigate] = useLocation();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className={cn(
        "max-w-2xl mx-auto mt-6 p-4 sm:p-6 rounded-2xl border backdrop-blur-sm",
        `bg-gradient-to-r ${config.bgGradient}`,
        config.borderColor
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className={cn(
          "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
          `bg-gradient-to-br ${config.gradient}`
        )}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {tier === "1" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-amber-200/50 dark:bg-amber-800/30 text-amber-800 dark:text-amber-200">
                <MessageCircle className="h-3 w-3" />
                {config.messageLimit}
              </span>
            )}
            {(tier === "2" || tier === "3") && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-200/50 dark:bg-green-800/30 text-green-800 dark:text-green-200">
                <Infinity className="h-3 w-3" />
                {config.messageLimit}
              </span>
            )}
            {tier === "3" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-purple-200/50 dark:bg-purple-800/30 text-purple-800 dark:text-purple-200">
                <Zap className="h-3 w-3" />
                Accesso completo
              </span>
            )}
          </div>
          
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {tier === "1" && "Stai usando il piano gratuito. Hai accesso agli agenti base con un limite giornaliero di messaggi."}
            {tier === "2" && "Hai messaggi illimitati e accesso prioritario agli agenti del tuo piano."}
            {tier === "3" && "Hai accesso completo a tutti gli agenti disponibili senza limiti."}
          </p>
        </div>
        
        {(tier === "1" || tier === "2") && (
          <Button
            onClick={() => navigate(`/c/${slug}/pricing`)}
            size="sm"
            className={cn(
              "flex-shrink-0 gap-1 font-semibold",
              tier === "1" 
                ? "bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700" 
                : "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
            )}
          >
            {tier === "1" ? "Passa ad Argento" : "Passa a Oro"}
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

interface Agent {
  id: string;
  name: string;
  publicSlug: string | null;
  businessName: string | null;
  description: string | null;
  avatar: string | null;
}

interface AgentsResponse {
  consultantName: string;
  consultantSlug: string;
  tierName: string;
  agents: Agent[];
}

function AgentCardSkeleton() {
  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur opacity-40" />
      <Card className="relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-white/20 dark:border-slate-700/30 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur opacity-30" />
              <Skeleton className="relative h-20 w-20 rounded-full" />
            </div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full mt-4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/40 dark:from-slate-950 dark:via-purple-950/30 dark:to-pink-950/20" />
      <motion.div
        className="absolute top-0 -left-4 w-72 h-72 bg-purple-300/30 dark:bg-purple-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl"
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-0 right-0 w-72 h-72 bg-pink-300/30 dark:bg-pink-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl"
        animate={{
          x: [0, -30, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-300/30 dark:bg-blue-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl"
        animate={{
          x: [0, 40, 0],
          y: [0, -30, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-64 h-64 bg-indigo-300/25 dark:bg-indigo-600/15 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl"
        animate={{
          x: [0, -50, 0],
          y: [0, -40, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(255,255,255,0.8)_100%)] dark:bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />
    </div>
  );
}

function AgentCard({ agent, index, onSelect }: { agent: Agent; index: number; onSelect: (agent: Agent) => void }) {
  const initials = agent.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative group"
    >
      <motion.div
        className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 rounded-2xl blur opacity-0 group-hover:opacity-60 transition-all duration-500"
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{
          backgroundSize: "200% 200%",
        }}
      />
      <motion.div
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Card className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-white/30 dark:border-slate-700/40 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-500">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <motion.div
                  className="absolute -inset-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full"
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{
                    background: "conic-gradient(from 0deg, #8b5cf6, #ec4899, #3b82f6, #8b5cf6)",
                  }}
                />
                <Avatar className="relative h-20 w-20 sm:h-24 sm:w-24 border-4 border-white dark:border-slate-800 shadow-xl">
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xl sm:text-2xl font-semibold">
                    {initials || <Bot className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {agent.name}
                </h3>
                {agent.businessName && (
                  <Badge 
                    variant="secondary" 
                    className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 text-purple-700 dark:text-purple-300 border-0 font-medium px-3 py-1"
                  >
                    {agent.businessName}
                  </Badge>
                )}
              </div>

              {agent.description && (
                <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed line-clamp-3 min-h-[3.75rem]">
                  {agent.description}
                </p>
              )}

              <Button
                onClick={() => onSelect(agent)}
                className="w-full mt-4 h-12 sm:h-14 text-base sm:text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all duration-300 group/btn"
              >
                <span>Scegli</span>
                <motion.span
                  className="ml-2 inline-block"
                  initial={{ x: 0 }}
                  whileHover={{ x: 4 }}
                >
                  <ArrowRight className="h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
                </motion.span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default function SelectAgent() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  
  // Read localStorage synchronously on mount for immediate use
  const initialTier = typeof window !== 'undefined' ? localStorage.getItem("bronzeUserTier") : null;
  const initialName = typeof window !== 'undefined' ? localStorage.getItem("bronzeUserName") : null;
  
  const [userName, setUserName] = useState<string>(initialName || "");
  const [userTier, setUserTier] = useState<string>(initialTier || "1");
  const [userSlug, setUserSlug] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!initialTier);
  const [isGoldClient, setIsGoldClient] = useState<boolean>(false);

  useEffect(() => {
    const checkAuth = async () => {
      const storedName = localStorage.getItem("bronzeUserName") || "";
      const storedTier = localStorage.getItem("bronzeUserTier") || "";
      const storedSlug = localStorage.getItem("bronzePublicSlug") || "";
      
      // PRIORITY 1: Check bronzeAuthToken for Gold preview token (consultant accessing as Gold)
      const bronzeAuthToken = localStorage.getItem("bronzeAuthToken");
      if (bronzeAuthToken) {
        try {
          // Decode JWT to check if it's a Gold preview token
          const payload = JSON.parse(atob(bronzeAuthToken.split('.')[1]));
          console.log("[SELECT-AGENT] bronzeAuthToken payload:", payload.type, payload.level, payload.isConsultantPreview);
          
          if (payload.type === "gold" && payload.level === "3") {
            // This is a Gold token (either real Gold client or consultant preview)
            const userName = payload.email?.split("@")[0] || "Utente";
            console.log("[SELECT-AGENT] Gold token detected, user:", userName);
            setUserName(userName);
            setUserTier("3");
            setIsAuthenticated(true);
            setIsGoldClient(true);
            return;
          } else if (payload.type === "silver" && payload.level === "2") {
            console.log("[SELECT-AGENT] Silver token detected");
            setUserName(payload.email?.split("@")[0] || "Utente");
            setUserTier("2");
            setIsAuthenticated(true);
            setIsGoldClient(false);
            return;
          } else if (payload.tier === "bronze" || payload.type === "bronze") {
            console.log("[SELECT-AGENT] Bronze token detected");
            setUserName(payload.email?.split("@")[0] || "Utente");
            setUserTier("1");
            setIsAuthenticated(true);
            setIsGoldClient(false);
            return;
          }
        } catch (e) {
          console.error("[SELECT-AGENT] Failed to decode bronzeAuthToken:", e);
        }
      }
      
      // PRIORITY 2: Check if user is a Gold/Deluxe client (authenticated via normal token)
      const normalToken = localStorage.getItem("token");
      const authUserStr = localStorage.getItem("authUser");
      
      console.log("[SELECT-AGENT] Auth check - normalToken:", !!normalToken, "authUser:", !!authUserStr, "bronzeTier:", storedTier);
      
      // Gold/Deluxe client takes priority (they may have old Bronze data in storage)
      if (normalToken) {
        // Try to get authUser from localStorage first
        let authUser: any = null;
        if (authUserStr) {
          try {
            authUser = JSON.parse(authUserStr);
          } catch (e) {
            console.error("[SELECT-AGENT] Failed to parse authUser:", e);
          }
        }
        
        // If no authUser in localStorage, verify token via API
        if (!authUser || !authUser.role) {
          try {
            console.log("[SELECT-AGENT] Verifying token via API...");
            const response = await fetch("/api/auth/me", {
              headers: { Authorization: `Bearer ${normalToken}` }
            });
            if (response.ok) {
              const userData = await response.json();
              console.log("[SELECT-AGENT] API user data:", userData.role, userData.firstName);
              if (userData.role === "client") {
                authUser = userData;
              }
            }
          } catch (e) {
            console.error("[SELECT-AGENT] Failed to verify token:", e);
          }
        }
        
        console.log("[SELECT-AGENT] AuthUser resolved:", authUser?.role, authUser?.firstName);
        
        // Check if this is a real Gold client or just a Silver user with role=client
        // PRIORITY: Server-provided subscriptionLevel is AUTHORITATIVE, not localStorage
        if (authUser && authUser.role === "client") {
          const subscriptionLevel = authUser.subscriptionLevel;
          const bronzeTier = localStorage.getItem("bronzeUserTier"); // Fallback only
          
          console.log("[SELECT-AGENT] Client role detected, subscriptionLevel:", subscriptionLevel, "bronzeTier fallback:", bronzeTier);
          
          // subscriptionLevel from API is authoritative: 2=Silver, 3=Gold, 4=Deluxe
          // Use localStorage bronzeTier ONLY as fallback when server doesn't have subscriptionLevel
          if (subscriptionLevel === 2) {
            console.log("[SELECT-AGENT] Silver user (subscriptionLevel=2)");
            setUserName(authUser.firstName || authUser.username || "Utente");
            setUserTier("2"); // Silver tier
            setIsAuthenticated(true);
            setIsGoldClient(false);
            return;
          } else if (subscriptionLevel === 3 || subscriptionLevel === 4) {
            console.log("[SELECT-AGENT] Gold/Deluxe client (subscriptionLevel=" + subscriptionLevel + ")");
            setUserName(authUser.firstName || authUser.username || "Utente");
            setUserTier("3"); // Gold/Deluxe tier
            setIsAuthenticated(true);
            setIsGoldClient(true);
            return;
          } else if (bronzeTier === "2") {
            // Fallback: localStorage indicates Silver but server doesn't have subscriptionLevel
            console.log("[SELECT-AGENT] Silver user (localStorage fallback)");
            setUserName(authUser.firstName || authUser.username || "Utente");
            setUserTier("2"); // Silver tier
            setIsAuthenticated(true);
            setIsGoldClient(false);
            return;
          }
          
          // Default: assume Gold if role=client but no specific level found
          setUserName(authUser.firstName || authUser.username || "Utente");
          setUserTier("3"); // Gold/Deluxe tier
          setIsAuthenticated(true);
          setIsGoldClient(true);
          console.log("[SELECT-AGENT] Gold client authenticated (default for role=client)");
          return;
        }
      }
      
      // Bronze/Silver user (only if not Gold)
      if (storedTier) {
        setUserName(storedName);
        setUserTier(storedTier);
        setUserSlug(storedSlug);
        setIsAuthenticated(true);
        setIsGoldClient(false);
        console.log("[SELECT-AGENT] Bronze/Silver user authenticated, tier:", storedTier);
      } else {
        // Not authenticated - redirect to pricing/login
        console.log("[SELECT-AGENT] Not authenticated, redirecting to pricing");
        setIsAuthenticated(false);
        navigate(`/c/${slug}/pricing`);
      }
    };
    
    checkAuth();
  }, [slug, navigate]);

  const { data, isLoading, error } = useQuery<AgentsResponse>({
    queryKey: ["/api/public/consultant", slug, "agents", userTier, isGoldClient],
    queryFn: async () => {
      const tier = userTier || "1";
      // PRIORITY: bronzeAuthToken first (includes Gold preview tokens and Silver/Bronze tokens)
      // Then fall back to manager_token and finally normal token
      let token: string | null = localStorage.getItem("bronzeAuthToken") || localStorage.getItem("manager_token") || localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      console.log("[SELECT-AGENT] Fetching agents - isGold:", isGoldClient, "token:", !!token, "tier:", tier);
      const response = await fetch(`/api/public/consultant/${slug}/agents/${tier}`, { headers });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Consulente non trovato");
        }
        throw new Error("Errore nel caricamento degli agenti");
      }
      return response.json();
    },
    enabled: !!slug && !!userTier && isAuthenticated,
    retry: false,
  });

  // If not authenticated, show loading while redirecting
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AnimatedBackground />
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-300">Reindirizzamento...</p>
        </div>
      </div>
    );
  }

  const handleSelectAgent = (agent: Agent) => {
    if (agent.publicSlug) {
      // Store agent slug for auth-guard routing
      localStorage.setItem('agentSlug', agent.publicSlug);
      
      // All users (Bronze/Silver/Gold) go to agent chat when selecting an agent
      console.log("[SELECT-AGENT] Redirecting to agent chat:", agent.publicSlug);
      navigate(`/agent/${agent.publicSlug}/chat`);
    }
  };

  const handleBack = () => {
    navigate(`/c/${slug}/pricing`);
  };

  const firstName = userName.split(" ")[0] || "Utente";

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <AnimatedBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-white/30 dark:border-slate-700/40 rounded-2xl shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Oops! Qualcosa è andato storto
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                {error instanceof Error ? error.message : "Errore nel caricamento"}
              </p>
              <Button
                onClick={handleBack}
                variant="outline"
                className="w-full h-12 rounded-xl"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Torna indietro
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AnimatedBackground />
      
      <div className="relative z-10 px-4 py-8 sm:py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10 sm:mb-14"
          >
            <TierBadge tier={userTier} tierName={data?.tierName} />

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight mb-4"
            >
              Ciao{" "}
              <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 bg-clip-text text-transparent">
                {firstName}
              </span>
              , scegli il tuo assistente
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-slate-600 dark:text-slate-300 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            >
              Seleziona l'assistente AI più adatto alle tue esigenze. 
              Ogni agente è specializzato per offrirti il massimo supporto.
            </motion.p>
            
            <TierInfoBox tier={userTier} slug={slug || ""} />
          </motion.div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </div>
          ) : data?.agents && data.agents.length > 0 ? (
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "grid gap-6",
                  data.agents.length === 1
                    ? "grid-cols-1 max-w-md mx-auto"
                    : data.agents.length === 2
                    ? "grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                )}
              >
                {data.agents.map((agent, index) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    index={index}
                    onSelect={handleSelectAgent}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
                <Bot className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Nessun agente disponibile
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Al momento non ci sono agenti disponibili per il tuo piano. 
                Contatta il consulente per maggiori informazioni.
              </p>
              <Button
                onClick={handleBack}
                variant="outline"
                className="h-12 px-6 rounded-xl"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Torna ai piani
              </Button>
            </motion.div>
          )}

          {data?.consultantName && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="mt-12 text-center"
            >
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Assistenti AI di{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {data.consultantName}
                </span>
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
