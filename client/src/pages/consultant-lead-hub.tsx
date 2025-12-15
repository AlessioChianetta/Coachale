import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthHeaders } from "@/lib/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Settings,
  Sparkles,
  Send,
  BookOpen,
  HelpCircle,
  TrendingUp,
  Clock,
  Star,
  Bot,
  ChevronRight,
  Upload,
  Filter,
  BarChart3,
  Calendar,
  Wand2,
  FileCheck,
  Bell
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

const QUICK_SUGGESTIONS = [
  "Come importo i lead da Excel?",
  "Come creo una campagna efficace?",
  "Quanto tempo per approvare un template?",
  "Come funzionano le automazioni?"
];

function TipsPanel({ selectedStep }: { selectedStep: string | null }) {
  const tips = selectedStep ? STEP_TIPS[selectedStep] || DEFAULT_TIPS : DEFAULT_TIPS;
  const currentStep = FLOW_STEPS.find(s => s.id === selectedStep);
  
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-r border-slate-200 dark:border-slate-800">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg shadow-sm">
            <Lightbulb className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Tips & Suggerimenti</h3>
            <p className="text-xs text-muted-foreground">
              {currentStep ? currentStep.title : "Panoramica generale"}
            </p>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          <AnimatePresence mode="wait">
            {tips.map((tip, index) => (
              <motion.div
                key={`${selectedStep}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={cn("p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700", tip.color)}>
                        <tip.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground mb-0.5">{tip.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{tip.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
      
      {currentStep && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <Link href={currentStep.href}>
            <Button size="sm" variant="outline" className="w-full gap-2 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              Guida completa {currentStep.title}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function InlineAssistant() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSuggestionClick = (suggestion: string) => {
    setQuestion(suggestion);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const userMessage = question.trim();
    setQuestion("");
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/lead-hub-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ question: userMessage }),
      });

      const data = await response.json();

      if (data.success && data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message || 'Mi dispiace, si è verificato un errore. Riprova.' 
        }]);
      }
    } catch (error) {
      console.error('Error calling Lead Hub Assistant:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Errore di connessione. Verifica la tua connessione e riprova.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-indigo-950 text-white border-l border-slate-700">
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg shadow-purple-500/20">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Assistente Lead Hub</h3>
            <p className="text-xs text-slate-400">Chiedi qualsiasi cosa</p>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <>
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-purple-500/20 rounded-full">
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Ciao! Sono qui per aiutarti a configurare il tuo sistema di acquisizione lead. 
                    Seleziona uno step per avere tips specifici, oppure chiedimi qualsiasi cosa!
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Domande frequenti</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUGGESTIONS.map((suggestion, index) => (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="text-xs px-2.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600/50 text-slate-300 hover:text-white transition-colors text-left"
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/consultant/proactive-leads">
                    <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-xs h-8 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300">
                      <Users className="h-3.5 w-3.5" />
                      Vai ai Lead
                    </Button>
                  </Link>
                  <Link href="/consultant/campaigns">
                    <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-xs h-8 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300">
                      <Megaphone className="h-3.5 w-3.5" />
                      Campagne
                    </Button>
                  </Link>
                  <Link href="/consultant/whatsapp-templates">
                    <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-xs h-8 bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Template
                    </Button>
                  </Link>
                  <Link href="/consultant/automations">
                    <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-xs h-8 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300">
                      <Zap className="h-3.5 w-3.5" />
                      Automazioni
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="pt-2">
                <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-lg p-3 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <HelpCircle className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-medium text-purple-300">Hai bisogno di aiuto?</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    L'assistente AI completo è disponibile in basso a destra per conversazioni più approfondite.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "rounded-lg p-3 text-xs leading-relaxed",
                    msg.role === 'user'
                      ? "bg-purple-600/30 border border-purple-500/30 ml-4"
                      : "bg-slate-800/50 border border-slate-700/50 mr-4"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "p-1 rounded-full shrink-0",
                      msg.role === 'user' ? "bg-purple-500/30" : "bg-indigo-500/30"
                    )}>
                      {msg.role === 'user' ? (
                        <Send className="h-3 w-3 text-purple-300" />
                      ) : (
                        <Bot className="h-3 w-3 text-indigo-300" />
                      )}
                    </div>
                    <p className="text-slate-200 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 mr-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-indigo-500/30 rounded-full">
                      <Bot className="h-3 w-3 text-indigo-300" />
                    </div>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t border-slate-700/50 bg-slate-900/80">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Scrivi una domanda..."
            className="flex-1 h-9 text-xs bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:ring-purple-500 focus:border-purple-500"
          />
          <Button 
            type="submit" 
            size="sm" 
            disabled={isLoading || !question.trim()}
            className="h-9 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
      </div>
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
      cardClass: "border-green-300 dark:border-green-700 shadow-lg shadow-green-100 dark:shadow-green-900/20",
      iconBg: "bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/50 dark:to-green-800/50"
    },
    active: {
      badge: "Disponibile",
      badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
      cardClass: "border-blue-300 dark:border-blue-700 shadow-lg shadow-blue-100 dark:shadow-blue-900/20",
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
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="w-full h-full"
    >
      <Card 
        className={cn(
          "relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-xl hover:scale-[1.02] h-full flex flex-col",
          config.cardClass,
          isExpanded && "ring-2 ring-offset-2 ring-primary"
        )}
        onClick={onExpand}
      >
        {status === "completed" && (
          <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden">
            <div className="absolute transform rotate-45 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs py-1 right-[-40px] top-[14px] w-[110px] text-center shadow-lg">
              <CheckCircle2 className="h-3 w-3 inline" />
            </div>
          </div>
        )}

        <CardContent className="p-4 sm:p-5 lg:p-6 flex flex-col flex-1">
          <div className="flex flex-col items-center text-center gap-3 flex-1">
            <motion.div 
              className={cn("p-4 sm:p-5 rounded-2xl shadow-inner", config.iconBg)}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              {status === "completed" ? (
                <CheckCircle2 className={cn("h-8 w-8 sm:h-10 sm:w-10", step.color)} />
              ) : (
                <Icon className={cn("h-8 w-8 sm:h-10 sm:w-10", step.color)} />
              )}
            </motion.div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">STEP {index + 1}</span>
              <Badge className={cn("text-xs", config.badgeClass)}>{config.badge}</Badge>
            </div>
            
            <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">
              {step.title}
            </h3>
            
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex-1">
              {step.description}
            </p>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full"
                >
                  <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg text-left">
                    <Lightbulb className="h-3 w-3 inline mr-1 text-yellow-500" />
                    {step.detailedDescription}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="w-full space-y-2 mt-auto pt-3">
              {count > 0 && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {count} {count === 1 ? "elemento" : "elementi"}
                </Badge>
              )}

              <Link href={step.href} onClick={(e) => e.stopPropagation()} className="block">
                <Button 
                  size="sm" 
                  variant={status === "active" ? "default" : "outline"}
                  className={cn(
                    "w-full gap-2 transition-all",
                    status === "active" && "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  )}
                >
                  {status === "completed" ? (
                    <>
                      <Settings className="h-4 w-4" />
                      Modifica
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Vai
                    </>
                  )}
                </Button>
              </Link>
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
    <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white border-0 shadow-2xl overflow-hidden">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Lead Hub</h1>
                <p className="text-xs md:text-sm text-slate-300">Sistema acquisizione clienti</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2">
              <div className="text-right">
                <div className="text-xs text-slate-400">Progresso</div>
                <div className="text-lg font-bold">{completedSteps}/{totalSteps}</div>
              </div>
              <div className="relative h-12 w-12">
                <svg className="h-12 w-12 -rotate-90">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="none" className="text-slate-700" />
                  <circle 
                    cx="24" cy="24" r="20" 
                    stroke="url(#progressGradient)" 
                    strokeWidth="4" 
                    fill="none" 
                    strokeDasharray={`${percentage * 1.256} 125.6`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{percentage}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 md:gap-4">
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
    <div className="bg-white/10 hover:bg-white/15 transition-colors rounded-lg p-2.5 md:p-3 text-center">
      <Icon className={cn("h-4 w-4 md:h-5 md:w-5 mx-auto mb-1", color)} />
      <div className="text-lg md:text-xl font-bold">{value}</div>
      <div className="text-[10px] md:text-xs text-slate-400">{label}</div>
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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex min-w-0">
        <aside className="hidden lg:flex w-[280px] flex-shrink-0">
          <TipsPanel selectedStep={expandedStep} />
        </aside>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
              {FLOW_STEPS.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  status={stepStatuses[step.id]}
                  count={counts[step.countKey as keyof typeof counts] || 0}
                  index={index}
                  isExpanded={expandedStep === step.id}
                  onExpand={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                />
              ))}
            </div>
          </div>
        </main>

        <aside className="hidden lg:flex w-[320px] flex-shrink-0">
          <InlineAssistant />
        </aside>
      </div>

      <ConsultantAIAssistant />
    </div>
  );
}
