import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Database,
  ArrowRight,
  Megaphone,
  MessageSquare,
  X,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "campaigns_education_dismissed";

export function EducationalBanner() {
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) === "true";
    }
    return false;
  });
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsDismissed(true);
  };

  const handleShowAgain = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsDismissed(false);
    setIsOpen(true);
  };

  if (isDismissed) {
    return (
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShowAgain}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <Lightbulb className="h-3 w-3 mr-1" />
          Mostra guida
        </Button>
      </div>
    );
  }

  const steps = [
    {
      icon: Database,
      title: "Fonti Lead",
      description: "I tuoi CRM e webhook",
      detail: "CrmAle, Hubdigital, API esterne",
    },
    {
      icon: Megaphone,
      title: "Campagne",
      description: "Uncino personalizzato",
      detail: "Ogni fonte ha il suo messaggio",
    },
    {
      icon: MessageSquare,
      title: "Template WhatsApp",
      description: "Messaggio automatico",
      detail: "Formato approvato da Meta",
    },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-indigo-500/20">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-white/30 dark:hover:bg-black/10 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  Come Funziona il Sistema Campagne
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(!isOpen);
                    }}
                  >
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-4 pb-6">
              <div className="flex flex-col items-center gap-6">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 w-full">
                  {steps.map((step, index) => {
                    const StepIcon = step.icon;
                    return (
                      <div key={step.title} className="flex items-center gap-4 md:gap-8">
                        <div className="flex flex-col items-center text-center min-w-[140px]">
                          <div
                            className={cn(
                              "flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg mb-3",
                              index === 0 && "bg-gradient-to-br from-blue-500 to-blue-600 text-white",
                              index === 1 && "bg-gradient-to-br from-purple-500 to-purple-600 text-white",
                              index === 2 && "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white"
                            )}
                          >
                            <StepIcon className="h-8 w-8" />
                          </div>
                          <h4 className="font-semibold text-foreground">{step.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {step.description}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            {step.detail}
                          </p>
                        </div>
                        {index < steps.length - 1 && (
                          <div className="hidden md:flex items-center">
                            <ArrowRight className="h-6 w-6 text-purple-400" />
                          </div>
                        )}
                        {index < steps.length - 1 && (
                          <div className="flex md:hidden items-center rotate-90">
                            <ArrowRight className="h-5 w-5 text-purple-400" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 max-w-2xl text-center">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">In sintesi:</strong> Ogni fonte di lead (CRM, Hubdigital) 
                    può essere collegata a una campagna specifica. Ogni campagna ha un "uncino" diverso 
                    per personalizzare il primo messaggio. I template WhatsApp definiscono il formato 
                    esatto del messaggio che verrà inviato automaticamente.
                  </p>
                </div>

                <Button
                  onClick={handleDismiss}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md"
                >
                  Ho capito, nascondi
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </div>
      </Card>
    </Collapsible>
  );
}
