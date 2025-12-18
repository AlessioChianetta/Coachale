import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { ChatPanel } from "@/components/ai-assistant/ChatPanel";
import { useConsultantPageContext } from "@/hooks/use-consultant-page-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthHeaders } from "@/lib/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Megaphone,
  MessageSquare,
  FileText,
  Zap,
  ArrowRight,
  CheckCircle2,
  Target,
  Lightbulb,
  Sparkles,
  BookOpen,
  TrendingUp,
  Clock,
  Star,
  Bot,
  Upload,
  Filter,
  BarChart3,
  Calendar,
  Wand2,
  FileCheck,
  Bell,
  Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100/50 dark:bg-blue-900/20",
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
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100/50 dark:bg-purple-900/20",
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
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100/50 dark:bg-green-900/20",
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
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100/50 dark:bg-indigo-900/20",
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
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100/50 dark:bg-orange-900/20",
    borderColor: "border-orange-200 dark:border-orange-800",
    prerequisiteId: "customTemplates",
    countKey: "automations",
    minRequired: 0,
    actionLabel: "Configura Automazioni"
  }
];

interface StepTip {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}

const STEP_TIPS: Record<string, StepTip[]> = {
  leads: [
    { icon: Upload, title: "Importa da Excel/CSV", description: "Carica file con colonne: nome, telefono, email. Il sistema mappa automaticamente i campi.", color: "text-blue-500" },
    { icon: Filter, title: "Segmenta i contatti", description: "Usa tag e filtri per organizzare i lead per interesse, fonte o priorità.", color: "text-green-500" },
    { icon: TrendingUp, title: "Lead scoring", description: "Assegna punteggi ai lead per identificare i più promettenti.", color: "text-purple-500" },
    { icon: Clock, title: "Timing ottimale", description: "I lead freschi convertono meglio. Contattali entro 24-48h dall'acquisizione.", color: "text-orange-500" }
  ],
  campaigns: [
    { icon: Target, title: "Obiettivi chiari", description: "Definisci un obiettivo specifico: vendita, appuntamento, webinar.", color: "text-purple-500" },
    { icon: Calendar, title: "Pianifica gli invii", description: "Programma le campagne nei giorni/orari migliori per il tuo target.", color: "text-blue-500" },
    { icon: BarChart3, title: "Monitora le metriche", description: "Tasso di apertura, risposte, conversioni. Analizza e ottimizza.", color: "text-green-500" },
    { icon: Users, title: "Segmenta il pubblico", description: "Campagne diverse per segmenti diversi = risultati migliori.", color: "text-indigo-500" }
  ],
  templates: [
    { icon: FileCheck, title: "Approvazione Meta", description: "I template devono essere approvati da Meta prima dell'uso (24-48h).", color: "text-green-500" },
    { icon: MessageSquare, title: "Personalizzazione", description: "Usa variabili {{nome}}, {{azienda}} per messaggi personalizzati.", color: "text-blue-500" },
    { icon: Star, title: "Best practice", description: "Messaggi brevi, CTA chiara, tono professionale ma amichevole.", color: "text-yellow-500" },
    { icon: Bell, title: "Template utility vs marketing", description: "Utility per conferme/info, Marketing per promozioni. Regole diverse.", color: "text-purple-500" }
  ],
  customTemplates: [
    { icon: Wand2, title: "Crea con l'AI", description: "Usa l'assistente AI per generare template efficaci in pochi click.", color: "text-indigo-500" },
    { icon: FileText, title: "Header e Footer", description: "Aggiungi header con immagine/video e footer con info azienda.", color: "text-blue-500" },
    { icon: Zap, title: "Pulsanti interattivi", description: "Aggiungi CTA button per aumentare l'engagement e le conversioni.", color: "text-orange-500" },
    { icon: Clock, title: "Tempi di approvazione", description: "Invia per approvazione e attendi 24-48h. Controlla lo stato qui.", color: "text-green-500" }
  ],
  automations: [
    { icon: Zap, title: "Follow-up automatici", description: "Rispondi automaticamente ai lead che non rispondono dopo X giorni.", color: "text-orange-500" },
    { icon: Bot, title: "AI Responder", description: "L'AI può rispondere alle domande frequenti in autonomia.", color: "text-purple-500" },
    { icon: TrendingUp, title: "Pipeline automatica", description: "Sposta i lead tra gli stage in base alle loro azioni.", color: "text-green-500" },
    { icon: Bell, title: "Notifiche smart", description: "Ricevi alert quando un lead compie azioni importanti.", color: "text-blue-500" }
  ]
};

const DEFAULT_TIPS: StepTip[] = [
  { icon: Lightbulb, title: "Inizia dai Lead", description: "Il primo passo è caricare i tuoi contatti. Clicca sulla card 'Lead Proattivi'.", color: "text-yellow-500" },
  { icon: TrendingUp, title: "Segui il flusso", description: "Completa ogni step in ordine per configurare il tuo sistema di acquisizione.", color: "text-blue-500" },
  { icon: Sparkles, title: "Chiedi all'AI", description: "Usa l'assistente a destra per domande e suggerimenti personalizzati.", color: "text-purple-500" },
  { icon: BookOpen, title: "Guide disponibili", description: "Ogni sezione ha una guida dettagliata accessibile dal menu.", color: "text-green-500" }
];

// --- Assistant & Tips Panel Integrated ---

function RightPanel({ selectedStep }: { selectedStep: string | null }) {
  const [activeTab, setActiveTab] = useState("assistant");

  // Use page context for the AI
  const pageContext = useConsultantPageContext({});

  return (
    <div className="h-full flex flex-col bg-background/50 border-l border-border backdrop-blur-sm">
      <div className="p-4 border-b border-border">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="assistant" className="gap-2">
              <Bot className="h-4 w-4" />
              Assistente
            </TabsTrigger>
            <TabsTrigger value="tips" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Tips {selectedStep ? `(${FLOW_STEPS.find(s => s.id === selectedStep)?.title.split(' ')[0]})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === "assistant" ? (
            <motion.div
              key="assistant"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <ChatPanel
                isOpen={true}
                onClose={() => { }}
                mode="assistenza"
                setMode={() => { }}
                consultantType="finanziario" // Default, will be ignored in consultant mode usually
                setConsultantType={() => { }}
                isConsultantMode={true}
                pageContext={pageContext}
                hasPageContext={true}
                embedded={true}
              />
            </motion.div>
          ) : (
            <motion.div
              key="tips"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <TipsContent selectedStep={selectedStep} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TipsContent({ selectedStep }: { selectedStep: string | null }) {
  const tips = selectedStep ? STEP_TIPS[selectedStep] || DEFAULT_TIPS : DEFAULT_TIPS;
  const currentStep = FLOW_STEPS.find(s => s.id === selectedStep);

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-lg">
              <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Suggerimenti Utili</h3>
              <p className="text-xs text-muted-foreground">{currentStep ? currentStep.title : "Generali"}</p>
            </div>
          </div>

          {tips.map((tip, index) => (
            <motion.div
              key={`${selectedStep}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-0 shadow-sm bg-card hover:bg-accent/5 transition-colors">
                <CardContent className="p-3 flex gap-3">
                  <div className={cn("p-2 rounded-md h-fit", tip.color.replace('text-', 'bg-').replace('600', '100').replace('500', '100').replace('400', '100') + '/20')}>
                    <tip.icon className={cn("h-4 w-4", tip.color)} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">{tip.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tip.description}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
      {currentStep && (
        <div className="p-4 border-t border-border bg-muted/20">
          <Link href={currentStep.href}>
            <Button variant="outline" size="sm" className="w-full gap-2">
              <BookOpen className="h-4 w-4" />
              Leggi Guida Completa
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

// --- Main UI Components ---

interface StepCardProps {
  step: FlowStep;
  status: "completed" | "active" | "locked";
  count: number;
  index: number;
  isExpanded: boolean;
  onExpand: () => void;
  onMouseEnter: () => void;
}

function StepCard({ step, status, count, index, isExpanded, onExpand, onMouseEnter }: StepCardProps) {
  const Icon = step.icon;

  const statusConfig = {
    completed: {
      badge: "Completato",
      badgeClass: "bg-green-100/80 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-200 dark:border-green-800",
      cardClass: "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10",
      iconBg: "bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/40"
    },
    active: {
      badge: "In corso",
      badgeClass: "bg-blue-100/80 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      cardClass: "border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-sm",
      iconBg: step.bgColor
    },
    locked: {
      badge: "Bloccato",
      badgeClass: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
      cardClass: "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 opacity-70",
      iconBg: "bg-slate-100 dark:bg-slate-800"
    }
  };

  const config = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="group h-full"
      onMouseEnter={onMouseEnter}
    >
      <div
        className={cn(
          "relative overflow-hidden h-full flex flex-col rounded-2xl border transition-all duration-300",
          config.cardClass,
          status !== "locked" && "hover:shadow-xl hover:-translate-y-1 hover:border-primary/20 cursor-pointer"
        )}
        onClick={status !== "locked" ? onExpand : undefined}
      >
        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Info className="h-5 w-5 text-muted-foreground/50" />}
        </div>

        <div className="p-5 flex flex-col flex-1 gap-4">
          <div className="flex items-start justify-between">
            <div className={cn("p-3 rounded-xl transition-transform duration-300 group-hover:scale-110 shadow-inner", config.iconBg)}>
              <Icon className={cn("h-6 w-6", step.color)} />
            </div>
            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider", config.badgeClass)}>
              {config.badge}
            </Badge>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-mono">STEP {index + 1}</div>
            <h3 className="font-bold text-lg leading-tight text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{step.description}</p>
          </div>

          <div className="mt-auto pt-4 flex items-center justify-between gap-3">
            {count > 0 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background border shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-medium">{count}</span>
              </div>
            ) : (
              <div /> // Spacer
            )}

            {status !== "locked" && (
              <Link href={step.href} onClick={e => e.stopPropagation()}>
                <Button size="icon" className="h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
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
    <Card className="border-0 overflow-hidden relative shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-900 dark:to-indigo-950 opacity-100" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

      <CardContent className="relative p-6 md:p-8 text-white">
        <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
          <div className="space-y-4 max-w-lg relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
              <span>Coachale Consultant Hub</span>
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2 text-white">
                Il tuo centro di controllo
              </h1>
              <p className="text-indigo-100 text-lg leading-relaxed">
                Gestisci lead, campagne e automazioni da un'unica piattaforma intelligente.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <StatBadge icon={Users} label="Lead" value={stats.leads} />
              <StatBadge icon={Megaphone} label="Campagne" value={stats.campaigns} />
              <StatBadge icon={MessageSquare} label="Template" value={stats.templates} />
            </div>
          </div>

          <div className="relative shrink-0 flex items-center justify-center p-4">
            {/* Progress Circle */}
            <div className="relative h-32 w-32 md:h-40 md:w-40 flex items-center justify-center">
              <svg className="h-full w-full -rotate-90 transform">
                <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/10" />
                <circle
                  cx="50%" cy="50%" r="45%"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${percentage * 2.82} 282.6`}
                  strokeLinecap="round"
                  className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white">{percentage}%</span>
                <span className="text-xs text-indigo-200 uppercase tracking-widest">Complete</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBadge({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/10">
      <Icon className="h-4 w-4 text-indigo-200" />
      <span className="text-sm font-semibold text-white">{value}</span>
      <span className="text-xs text-indigo-200">{label}</span>
    </div>
  )
}

// --- Page Component ---

export default function ConsultantLeadHub() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

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
    campaigns: campaignsData?.data?.length || campaignsData?.campaigns?.length || 0,
    templates: templatesData?.templates?.length || 0,
    customTemplates: customTemplatesData?.data?.length || customTemplatesData?.templates?.length || 0,
    automations: automationsData?.rules?.length || automationsData?.length || 0
  }), [leadsData, campaignsData, templatesData, customTemplatesData, automationsData]);

  const stepStatuses = useMemo(() => {
    const statuses: Record<string, "completed" | "active" | "locked"> = {};

    for (const step of FLOW_STEPS) {
      const count = counts[step.countKey as keyof typeof counts] || 0;

      const isStepCompleted = step.minRequired > 0
        ? count >= step.minRequired
        : count > 0;

      statuses[step.id] = isStepCompleted ? "completed" : "active";
    }

    return statuses;
  }, [counts]);

  const completedCount = Object.values(stepStatuses).filter(s => s === "completed").length;

  // Use hovered step or expanded step for side panel info
  const activeStepId = hoveredStep || expandedStep;

  return (
    <div className="flex h-screen bg-muted/20 dark:bg-background">
      <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 no-scrollbar">

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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Il tuo percorso</h2>
              <div className="text-sm text-muted-foreground">
                {completedCount} di {FLOW_STEPS.length} step completati
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 auto-rows-fr">
              {FLOW_STEPS.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  status={stepStatuses[step.id]}
                  count={counts[step.countKey as keyof typeof counts] || 0}
                  index={index}
                  isExpanded={expandedStep === step.id}
                  onExpand={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  onMouseEnter={() => setHoveredStep(step.id)}
                />
              ))}
            </div>
          </div>

          {/* Spacer for bottom scrolling */}
          <div className="h-12" />
        </main>

        <aside className="w-[380px] hidden xl:block z-10 h-full shadow-lg">
          <RightPanel selectedStep={activeStepId} />
        </aside>
      </div>

      <ConsultantAIAssistant />
    </div>
  );
}
