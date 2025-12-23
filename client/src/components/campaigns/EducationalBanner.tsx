import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Database,
  ArrowRight,
  Megaphone,
  MessageSquare,
  Lightbulb,
  X,
  Sparkles,
} from "lucide-react";

interface EducationalBannerProps {
  showByDefault?: boolean;
  storageKey?: string;
}

export function EducationalBanner({ 
  showByDefault = true,
  storageKey = "campaigns_educational_banner_dismissed"
}: EducationalBannerProps) {
  const [isExpanded, setIsExpanded] = useState(showByDefault);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed === "true") {
      setIsDismissed(true);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setIsDismissed(true);
  };

  const handleReset = () => {
    localStorage.removeItem(storageKey);
    setIsDismissed(false);
    setIsExpanded(true);
  };

  if (isDismissed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleReset}
        className="text-muted-foreground hover:text-foreground"
      >
        <Lightbulb className="h-4 w-4 mr-2" />
        Mostra guida
      </Button>
    );
  }

  const flowSteps = [
    {
      icon: Database,
      title: "Fonti CRM",
      description: "I tuoi lead arrivano da CRM, form, o contatti manuali",
      color: "bg-blue-500",
      bgLight: "bg-blue-50 dark:bg-blue-950/30",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    {
      icon: Megaphone,
      title: "Campagne",
      description: "Organizzi i lead per obiettivo e personalizzi i messaggi",
      color: "bg-purple-500",
      bgLight: "bg-purple-50 dark:bg-purple-950/30",
      borderColor: "border-purple-200 dark:border-purple-800",
    },
    {
      icon: MessageSquare,
      title: "WhatsApp",
      description: "L'agente AI contatta i lead con template personalizzati",
      color: "bg-green-500",
      bgLight: "bg-green-50 dark:bg-green-950/30",
      borderColor: "border-green-200 dark:border-green-800",
    },
  ];

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300",
      "border-2 border-dashed border-amber-300/50 dark:border-amber-700/50",
      "bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-yellow-50/80",
      "dark:from-amber-950/20 dark:via-orange-950/10 dark:to-yellow-950/20"
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-200/30 to-transparent rounded-full blur-2xl" />
      
      <div className="relative p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">Come funziona il sistema campagne</h3>
              <p className="text-xs text-muted-foreground">Capire il flusso ti aiuterà a creare campagne più efficaci</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {flowSteps.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.title} className="relative flex items-stretch">
                    <div className={cn(
                      "flex-1 rounded-xl border p-4 transition-all hover:shadow-md",
                      step.bgLight,
                      step.borderColor
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-white", step.color)}>
                          <StepIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Step {index + 1}</p>
                          <h4 className="font-semibold text-sm">{step.title}</h4>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    
                    {index < flowSteps.length - 1 && (
                      <div className="hidden md:flex items-center justify-center w-8 shrink-0">
                        <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-white/60 dark:bg-gray-900/40 border border-amber-200/50 dark:border-amber-800/50">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">In breve:</strong> Collega le tue fonti (CRM, form, contatti), 
                crea campagne con messaggi personalizzati, e lascia che l'agente AI WhatsApp contatti i lead automaticamente 
                con i template che hai configurato.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
