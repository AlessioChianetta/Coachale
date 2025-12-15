import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getAuthHeaders } from "@/lib/auth";
import {
  Users,
  Megaphone,
  MessageSquare,
  FileText,
  Zap,
  ArrowRight,
  CheckCircle2,
  Lock,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
  Lightbulb,
  Rocket,
  Settings,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowStep {
  id: string;
  title: string;
  description: string;
  detailedDescription: string;
  icon: React.ElementType;
  href: string;
  color: string;
  bgColor: string;
  borderColor: string;
  prerequisiteId: string | null;
  countKey: string;
  minRequired: number;
  actionLabel: string;
}

const FLOW_STEPS: FlowStep[] = [
  {
    id: "leads",
    title: "Lead Proattivi",
    description: "Carica e gestisci i tuoi contatti",
    detailedDescription: "Importa la tua lista contatti da Excel/CSV o aggiungili manualmente. Ogni lead diventerà un potenziale cliente da raggiungere.",
    icon: Users,
    href: "/consultant/proactive-leads",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    prerequisiteId: null,
    countKey: "leads",
    minRequired: 1,
    actionLabel: "Gestisci Lead"
  },
  {
    id: "campaigns",
    title: "Campagne",
    description: "Organizza i lead in campagne",
    detailedDescription: "Crea campagne per raggruppare i lead. Ogni campagna può avere obiettivi, template e automazioni specifiche.",
    icon: Megaphone,
    href: "/consultant/campaigns",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
    prerequisiteId: "leads",
    countKey: "campaigns",
    minRequired: 1,
    actionLabel: "Crea Campagna"
  },
  {
    id: "templates",
    title: "Template WhatsApp",
    description: "Scegli i template di messaggi",
    detailedDescription: "Seleziona i template approvati da Meta per inviare messaggi WhatsApp. Puoi usare quelli predefiniti o crearne di personalizzati.",
    icon: MessageSquare,
    href: "/consultant/whatsapp-templates",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
    prerequisiteId: "campaigns",
    countKey: "templates",
    minRequired: 1,
    actionLabel: "Configura Template"
  },
  {
    id: "customTemplates",
    title: "Template Personalizzati",
    description: "Crea template su misura",
    detailedDescription: "Progetta messaggi personalizzati con variabili dinamiche. Sottomettili a Meta per l'approvazione e usali nelle tue campagne.",
    icon: FileText,
    href: "/consultant/whatsapp/custom-templates/list",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
    borderColor: "border-indigo-200 dark:border-indigo-800",
    prerequisiteId: "templates",
    countKey: "customTemplates",
    minRequired: 0,
    actionLabel: "Crea Template"
  },
  {
    id: "automations",
    title: "Automazioni",
    description: "Attiva il pilota automatico",
    detailedDescription: "Configura regole automatiche per follow-up, risposte e gestione pipeline. L'AI lavorerà per te 24/7.",
    icon: Zap,
    href: "/consultant/automations",
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
    prerequisiteId: "customTemplates",
    countKey: "automations",
    minRequired: 0,
    actionLabel: "Configura Automazioni"
  }
];

function FlowConnector({ isActive, isCompleted }: { isActive: boolean; isCompleted: boolean }) {
  return (
    <div className="flex items-center justify-center py-2 md:py-0 md:px-2">
      <motion.div 
        className="relative flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="hidden md:flex items-center">
          <div className={cn(
            "h-1 w-12 rounded-full transition-all duration-500",
            isCompleted ? "bg-green-500" : isActive ? "bg-blue-400" : "bg-gray-200 dark:bg-gray-700"
          )} />
          <motion.div
            animate={isActive ? { x: [0, 8, 0] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ChevronRight className={cn(
              "h-5 w-5 transition-colors duration-300",
              isCompleted ? "text-green-500" : isActive ? "text-blue-500" : "text-gray-300 dark:text-gray-600"
            )} />
          </motion.div>
        </div>
        <div className="md:hidden flex flex-col items-center">
          <div className={cn(
            "w-1 h-8 rounded-full transition-all duration-500",
            isCompleted ? "bg-green-500" : isActive ? "bg-blue-400" : "bg-gray-200 dark:bg-gray-700"
          )} />
        </div>
      </motion.div>
    </div>
  );
}

interface StepCardProps {
  step: FlowStep;
  status: "completed" | "active" | "locked";
  count: number;
  index: number;
  isExpanded: boolean;
  onExpand: () => void;
}

function StepCard({ step, status, count, index, isExpanded, onExpand }: StepCardProps) {
  const Icon = step.icon;
  
  const statusConfig = {
    completed: {
      badge: "Completato",
      badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
      cardClass: "border-green-300 dark:border-green-700 shadow-green-100 dark:shadow-green-900/20",
      iconBg: "bg-green-100 dark:bg-green-900/50"
    },
    active: {
      badge: "Da completare",
      badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
      cardClass: "border-blue-300 dark:border-blue-700 shadow-blue-100 dark:shadow-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800",
      iconBg: step.bgColor
    },
    locked: {
      badge: "Bloccato",
      badgeClass: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
      cardClass: "border-gray-200 dark:border-gray-700 opacity-60",
      iconBg: "bg-gray-100 dark:bg-gray-800"
    }
  };

  const config = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="w-full"
    >
      <Card 
        className={cn(
          "relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-lg",
          config.cardClass,
          isExpanded && "ring-2 ring-offset-2"
        )}
        onClick={onExpand}
      >
        {status === "completed" && (
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
            <div className="absolute transform rotate-45 bg-green-500 text-white text-xs py-1 right-[-35px] top-[12px] w-[100px] text-center">
              <CheckCircle2 className="h-3 w-3 inline" />
            </div>
          </div>
        )}

        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <motion.div 
              className={cn("p-3 rounded-xl", config.iconBg)}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              {status === "locked" ? (
                <Lock className="h-6 w-6 text-gray-400" />
              ) : status === "completed" ? (
                <CheckCircle2 className={cn("h-6 w-6", step.color)} />
              ) : (
                <Icon className={cn("h-6 w-6", step.color)} />
              )}
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-muted-foreground">STEP {index + 1}</span>
                <Badge className={config.badgeClass}>{config.badge}</Badge>
              </div>
              
              <h3 className="text-lg font-bold text-foreground mb-1">
                {step.title}
              </h3>
              
              <p className="text-sm text-muted-foreground mb-3">
                {step.description}
              </p>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3"
                  >
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      <Lightbulb className="h-4 w-4 inline mr-2 text-yellow-500" />
                      {step.detailedDescription}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {count > 0 && (
                    <Badge variant="secondary" className="font-mono">
                      {count} {count === 1 ? "elemento" : "elementi"}
                    </Badge>
                  )}
                </div>

                {status !== "locked" && (
                  <Link href={step.href} onClick={(e) => e.stopPropagation()}>
                    <Button 
                      size="sm" 
                      variant={status === "active" ? "default" : "outline"}
                      className={cn(
                        "gap-2 transition-all",
                        status === "active" && "animate-pulse"
                      )}
                    >
                      {status === "completed" ? (
                        <>
                          <Settings className="h-4 w-4" />
                          Modifica
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          {step.actionLabel}
                        </>
                      )}
                    </Button>
                  </Link>
                )}

                {status === "locked" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" disabled className="gap-2">
                          <Lock className="h-4 w-4" />
                          Bloccato
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Completa prima lo step precedente</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ProgressSummary({ 
  completedSteps, 
  totalSteps, 
  stats 
}: { 
  completedSteps: number; 
  totalSteps: number;
  stats: { leads: number; campaigns: number; templates: number; automations: number };
}) {
  const percentage = Math.round((completedSteps / totalSteps) * 100);

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Progresso Setup</h2>
                <p className="text-sm text-slate-300">Completa tutti gli step per attivare le automazioni</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{completedSteps} di {totalSteps} step completati</span>
                <span className="font-bold">{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-3 bg-slate-700" />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBox icon={Users} label="Lead" value={stats.leads} color="text-blue-400" />
            <StatBox icon={Megaphone} label="Campagne" value={stats.campaigns} color="text-purple-400" />
            <StatBox icon={MessageSquare} label="Template" value={stats.templates} color="text-green-400" />
            <StatBox icon={Zap} label="Automazioni" value={stats.automations} color="text-orange-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  color: string;
}) {
  return (
    <div className="bg-white/5 rounded-lg p-3 text-center">
      <Icon className={cn("h-5 w-5 mx-auto mb-1", color)} />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

export default function ConsultantLeadHub() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const { data: leadsData } = useQuery({
    queryKey: ["/api/proactive-leads"],
    queryFn: async () => {
      const res = await fetch("/api/proactive-leads", { headers: getAuthHeaders() });
      if (!res.ok) return { leads: [] };
      return res.json();
    }
  });

  const { data: campaignsData } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns", { headers: getAuthHeaders() });
      if (!res.ok) return { campaigns: [] };
      return res.json();
    }
  });

  const { data: templatesData } = useQuery({
    queryKey: ["/api/whatsapp/templates"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/templates", { headers: getAuthHeaders() });
      if (!res.ok) return { templates: [] };
      return res.json();
    }
  });

  const { data: customTemplatesData } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/custom-templates", { headers: getAuthHeaders() });
      if (!res.ok) return { templates: [] };
      return res.json();
    }
  });

  const { data: automationsData } = useQuery({
    queryKey: ["/api/automation-rules"],
    queryFn: async () => {
      const res = await fetch("/api/automation-rules", { headers: getAuthHeaders() });
      if (!res.ok) return { rules: [] };
      return res.json();
    }
  });

  const counts = useMemo(() => ({
    leads: leadsData?.leads?.length || 0,
    campaigns: campaignsData?.campaigns?.length || 0,
    templates: templatesData?.templates?.length || 0,
    customTemplates: customTemplatesData?.templates?.length || 0,
    automations: automationsData?.rules?.length || 0
  }), [leadsData, campaignsData, templatesData, customTemplatesData, automationsData]);

  const stepStatuses = useMemo(() => {
    const statuses: Record<string, "completed" | "active" | "locked"> = {};
    
    for (const step of FLOW_STEPS) {
      const count = counts[step.countKey as keyof typeof counts] || 0;
      
      const isStepCompleted = step.minRequired > 0 
        ? count >= step.minRequired 
        : count > 0;
      
      if (step.prerequisiteId === null) {
        statuses[step.id] = isStepCompleted ? "completed" : "active";
      } else {
        const prereqStatus = statuses[step.prerequisiteId];
        if (prereqStatus === "completed") {
          statuses[step.id] = isStepCompleted ? "completed" : "active";
        } else {
          statuses[step.id] = "locked";
        }
      }
    }
    
    return statuses;
  }, [counts]);

  const completedCount = Object.values(stepStatuses).filter(s => s === "completed").length;
  const activeStepIndex = FLOW_STEPS.findIndex(s => stepStatuses[s.id] === "active");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                <Target className="h-4 w-4" />
                Centro di Comando Lead
              </div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
                HUB Lead
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Segui il flusso passo dopo passo per configurare il tuo sistema di acquisizione clienti automatizzato
              </p>
            </motion.div>

            <ProgressSummary 
              completedSteps={completedCount}
              totalSteps={FLOW_STEPS.length}
              stats={{
                leads: counts.leads,
                campaigns: counts.campaigns,
                templates: counts.templates + counts.customTemplates,
                automations: counts.automations
              }}
            />

            {activeStepIndex >= 0 && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <strong>Prossimo passo:</strong> {FLOW_STEPS[activeStepIndex].title} - {FLOW_STEPS[activeStepIndex].description}
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Il Tuo Percorso
                </CardTitle>
                <CardDescription>
                  Ogni step si sblocca completando quello precedente. Clicca su uno step per maggiori dettagli.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-start gap-0">
                  {FLOW_STEPS.map((step, index) => (
                    <div key={step.id} className="flex flex-col md:flex-row md:items-center flex-1">
                      <StepCard
                        step={step}
                        status={stepStatuses[step.id]}
                        count={counts[step.countKey as keyof typeof counts] || 0}
                        index={index}
                        isExpanded={expandedStep === step.id}
                        onExpand={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                      />
                      {index < FLOW_STEPS.length - 1 && (
                        <FlowConnector 
                          isActive={index === activeStepIndex - 1 || index === activeStepIndex}
                          isCompleted={stepStatuses[step.id] === "completed"}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-xl">
                    <Bot className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">
                      Hai bisogno di aiuto?
                    </h3>
                    <p className="text-green-700 dark:text-green-300 mb-4">
                      L'assistente AI è sempre disponibile per guidarti in ogni step. 
                      Chiedimi qualsiasi cosa sulla configurazione!
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-300">
                        <Clock className="h-3 w-3 mr-1" />
                        Supporto 24/7
                      </Badge>
                      <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-300">
                        <Lightbulb className="h-3 w-3 mr-1" />
                        Suggerimenti personalizzati
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <ConsultantAIAssistant />
    </div>
  );
}
