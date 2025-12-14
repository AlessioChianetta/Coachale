import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import confetti from "canvas-confetti";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import MappaInterattiva from "@/components/onboarding/MappaInterattiva";
import ChatNarrativa from "@/components/onboarding/ChatNarrativa";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Rocket,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Target,
  Zap,
  Users,
  MessageSquare,
  Calendar,
  GraduationCap,
  Bot,
} from "lucide-react";

interface PersonalizedPlanItem {
  icon: React.ElementType;
  title: string;
  description: string;
  priority: "alta" | "media" | "bassa";
  zone: string;
}

const generatePersonalizedPlan = (responses: Record<string, string>): PersonalizedPlanItem[] => {
  const plan: PersonalizedPlanItem[] = [];

  plan.push({
    icon: Zap,
    title: "Completa il Setup Iniziale",
    description: "Configura le impostazioni base della piattaforma per iniziare subito.",
    priority: "alta",
    zone: "principale",
  });

  if (responses.priorities === "whatsapp" || responses.platform_reason === "automazione") {
    plan.push({
      icon: MessageSquare,
      title: "Configura WhatsApp Business",
      description: "Attiva la comunicazione automatica con i tuoi clienti via WhatsApp.",
      priority: "alta",
      zone: "comunicazione",
    });
  }

  if (responses.priorities === "calendario") {
    plan.push({
      icon: Calendar,
      title: "Sincronizza il Calendario",
      description: "Collega Google Calendar per gestire appuntamenti automaticamente.",
      priority: "alta",
      zone: "lavoro-quotidiano",
    });
  }

  if (responses.activity_type === "formazione" || responses.priorities === "formazione") {
    plan.push({
      icon: GraduationCap,
      title: "Crea la tua Universita",
      description: "Imposta corsi e materiali formativi per i tuoi clienti.",
      priority: "media",
      zone: "formazione",
    });
  }

  if (responses.client_count === "50+" || responses.client_count === "16-50") {
    plan.push({
      icon: Bot,
      title: "Attiva AI Avanzato",
      description: "Con molti clienti, l'AI ti aiutera a scalare senza stress.",
      priority: "alta",
      zone: "ai-avanzato",
    });
  }

  plan.push({
    icon: Users,
    title: "Importa i tuoi Clienti",
    description: "Aggiungi i clienti esistenti per iniziare a gestirli nella piattaforma.",
    priority: "media",
    zone: "lavoro-quotidiano",
  });

  return plan;
};

const triggerConfetti = () => {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  const randomInRange = (min: number, max: number) =>
    Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ["#8B5CF6", "#6366F1", "#EC4899", "#F59E0B", "#10B981"],
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ["#8B5CF6", "#6366F1", "#EC4899", "#F59E0B", "#10B981"],
    });
  }, 250);
};

function ProgressIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <motion.div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i < currentStep
                ? "w-8 bg-gradient-to-r from-violet-500 to-indigo-500"
                : i === currentStep
                ? "w-8 bg-violet-300"
                : "w-2 bg-gray-200 dark:bg-gray-700"
            }`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 }}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-muted-foreground">
        Step {currentStep + 1} di {totalSteps}
      </span>
    </div>
  );
}

function PersonalizedPlanCard({ plan }: { plan: PersonalizedPlanItem[] }) {
  const priorityColors = {
    alta: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
    media: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    bassa: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border-2 border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/50 to-indigo-50/50 dark:from-violet-950/20 dark:to-indigo-950/20 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Target className="h-6 w-6" />
            </motion.div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Il Tuo Piano Personalizzato
                <Sparkles className="h-5 w-5 text-amber-500" />
              </CardTitle>
              <CardDescription>
                Basato sulle tue risposte, ecco i passi consigliati
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {plan.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-start gap-4 p-4 rounded-xl bg-white/80 dark:bg-gray-900/80 border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-semibold">{item.title}</h4>
                    <Badge variant="outline" className={priorityColors[item.priority]}>
                      Priorita {item.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-muted-foreground/30 shrink-0" />
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function OnboardingStoryPage() {
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlightedZones, setHighlightedZones] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [personalizedPlan, setPersonalizedPlan] = useState<PersonalizedPlanItem[]>([]);

  const completeOnboardingMutation = useMutation({
    mutationFn: async (data: { responses: Record<string, string>; plan: PersonalizedPlanItem[] }) => {
      return apiRequest("POST", "/api/consultant/onboarding/interactive-intro/complete", {
        responses: data.responses,
        suggestedPath: data.plan.map(p => p.zone),
      });
    },
    onSuccess: () => {
      setLocation("/consultant");
    },
  });

  const handleHighlightZone = useCallback((zoneId: string) => {
    setHighlightedZones((prev) => {
      if (!prev.includes(zoneId)) {
        return [...prev, zoneId];
      }
      return prev;
    });
  }, []);

  const handleResponse = useCallback((questionId: string, answer: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: answer }));
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  }, []);

  const handleComplete = useCallback((allResponses: Record<string, string>) => {
    setIsComplete(true);
    setCurrentStep(4);
    const plan = generatePersonalizedPlan(allResponses);
    setPersonalizedPlan(plan);
    triggerConfetti();
  }, []);

  const handleStartJourney = () => {
    completeOnboardingMutation.mutate({
      responses,
      plan: personalizedPlan.map((p) => ({
        ...p,
        icon: p.icon.name || "Zap",
      })) as any,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/30 via-background to-indigo-50/30 dark:from-violet-950/10 dark:via-background dark:to-indigo-950/10">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
      <div className="flex">
        {isMobile ? (
          <Sidebar
            role="consultant"
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        ) : (
          <Sidebar role="consultant" />
        )}

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center gap-3 mb-4">
                <motion.div
                  className="p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-xl"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Rocket className="h-8 w-8" />
                </motion.div>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Benvenuto nella tua nuova piattaforma!
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Rispondi a qualche domanda per personalizzare la tua esperienza e scoprire tutte le funzionalita
              </p>
            </motion.div>

            <div className={`grid gap-6 ${isMobile ? "grid-cols-1" : "lg:grid-cols-2"}`}>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="h-full border-2 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-600" />
                      Mappa della Piattaforma
                    </CardTitle>
                    <CardDescription>
                      Esplora le zone della piattaforma. Quelle evidenziate sono consigliate per te.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6">
                    <MappaInterattiva
                      highlightedZones={highlightedZones}
                      onZoneClick={(zoneId) => console.log("Zone clicked:", zoneId)}
                    />
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="h-[600px] border-2 shadow-lg overflow-hidden flex flex-col">
                  <ChatNarrativa
                    onResponse={handleResponse}
                    onComplete={handleComplete}
                    highlightZone={handleHighlightZone}
                  />
                </Card>
              </motion.div>
            </div>

            <AnimatePresence>
              {isComplete && (
                <>
                  <PersonalizedPlanCard plan={personalizedPlan} />

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="flex justify-center"
                  >
                    <Button
                      size="lg"
                      onClick={handleStartJourney}
                      disabled={completeOnboardingMutation.isPending}
                      className="gap-3 px-8 py-6 text-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-xl hover:shadow-2xl transition-all"
                    >
                      {completeOnboardingMutation.isPending ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <Sparkles className="h-5 w-5" />
                          </motion.div>
                          Salvataggio in corso...
                        </>
                      ) : (
                        <>
                          <Rocket className="h-5 w-5" />
                          Ho Capito! Iniziamo
                          <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex justify-center py-4 border-t mt-8"
            >
              <ProgressIndicator currentStep={currentStep} totalSteps={4} />
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
