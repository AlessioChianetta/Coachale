import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Crown, MessageSquare, Zap, Star } from "lucide-react";
import confetti from "canvas-confetti";

interface UpgradeSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: "silver" | "gold";
  onStartNow: () => void;
  pricing?: {
    level2MonthlyPrice?: number;
    level3MonthlyPrice?: number;
    level2Name?: string;
    level3Name?: string;
    level2Features?: string[];
    level3Features?: string[];
  };
}

export function UpgradeSuccessDialog({
  open,
  onOpenChange,
  tier,
  onStartNow,
  pricing,
}: UpgradeSuccessDialogProps) {
  const hasTriggeredConfetti = useRef(false);

  useEffect(() => {
    if (open && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: tier === "gold" 
          ? ["#fbbf24", "#f59e0b", "#d97706", "#eab308"]
          : ["#94a3b8", "#64748b", "#475569", "#6366f1"],
      });
    }
    
    if (!open) {
      hasTriggeredConfetti.current = false;
    }
  }, [open, tier]);

  const silverName = pricing?.level2Name || "Argento";
  const goldName = pricing?.level3Name || "Oro";
  const silverPrice = pricing?.level2MonthlyPrice ?? 29;
  const goldPrice = pricing?.level3MonthlyPrice ?? 59;
  
  const silverFeatures = pricing?.level2Features || [
    "Messaggi illimitati",
    "Risposte più veloci",
    "Supporto prioritario",
  ];
  const goldFeatures = pricing?.level3Features || [
    "Messaggi illimitati",
    "Priorità premium",
    "Funzionalità esclusive",
    "Accesso anticipato novità",
  ];
  
  const featureIcons = [MessageSquare, Zap, Star, Sparkles, Crown];

  const tierConfig = {
    silver: {
      name: silverName,
      price: silverPrice,
      icon: <Crown className="h-8 w-8 text-slate-500" />,
      gradient: "from-slate-400 to-slate-600",
      bgGradient: "from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50",
      borderColor: "border-slate-200 dark:border-slate-700",
      benefits: silverFeatures.slice(0, 4).map((text, i) => ({
        icon: featureIcons[i % featureIcons.length],
        text,
      })),
    },
    gold: {
      name: goldName,
      price: goldPrice,
      icon: <Crown className="h-8 w-8 text-yellow-500" />,
      gradient: "from-yellow-400 to-amber-500",
      bgGradient: "from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20",
      borderColor: "border-yellow-200 dark:border-yellow-700",
      benefits: goldFeatures.slice(0, 4).map((text, i) => ({
        icon: featureIcons[i % featureIcons.length],
        text,
      })),
    },
  };

  const config = tierConfig[tier];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4">
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg animate-bounce`}>
              <Check className="h-10 w-10 text-white" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            Benvenuto nel Piano {config.name}!
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Il tuo upgrade è stato completato con successo. Ora hai accesso a tutti i vantaggi premium.
          </DialogDescription>
        </DialogHeader>

        <div className={`mt-4 p-4 rounded-xl bg-gradient-to-br ${config.bgGradient} border ${config.borderColor}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
              {config.icon}
            </div>
            <div>
              <p className="font-semibold text-lg">{config.name}</p>
              <p className="text-sm text-muted-foreground">€{config.price}/mese</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">I tuoi nuovi vantaggi:</p>
            <ul className="space-y-2">
              {config.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm font-medium">{benefit.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            onClick={onStartNow}
            className={`w-full bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white font-semibold py-6 text-lg`}
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Inizia Ora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
