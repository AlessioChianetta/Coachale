import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Rocket, 
  Sparkles, 
  X, 
  ArrowRight,
  Map
} from "lucide-react";

interface InteractiveIntroBannerProps {
  onDismiss?: () => void;
}

const STORAGE_KEY = "interactive-intro-banner-dismissed";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

export function InteractiveIntroBanner({ onDismiss }: InteractiveIntroBannerProps) {
  const [, setLocation] = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const now = Date.now();
      if (now - dismissedAt < DISMISS_DURATION_MS) {
        setIsVisible(false);
        return;
      }
    }
    setIsVisible(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setIsVisible(false);
    onDismiss?.();
  };

  const handleStartJourney = () => {
    setLocation("/consultant/onboarding-story");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden rounded-xl mb-6"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDYwIEwgNjAgMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30" />
          
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-400/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-4 flex-1">
              <motion.div
                className="p-3 rounded-xl bg-white/20 backdrop-blur-sm text-white shadow-lg shrink-0"
                animate={{ 
                  y: [0, -4, 0],
                  rotate: [0, 3, -3, 0]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Rocket className="h-6 w-6" />
              </motion.div>
              
              <div className="text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg md:text-xl font-bold">
                    Benvenuto nella Piattaforma!
                  </h3>
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="h-5 w-5 text-amber-300" />
                  </motion.div>
                </div>
                <p className="text-white/90 text-sm md:text-base max-w-xl">
                  Completa la tua introduzione personalizzata per scoprire tutte le funzionalità e ricevere un piano su misura per te.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
              <Button
                onClick={handleStartJourney}
                className="flex-1 md:flex-none gap-2 bg-white text-violet-700 hover:bg-white/90 hover:text-violet-800 font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                <Map className="h-4 w-4" />
                Inizia il tuo viaggio
                <ArrowRight className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                className="text-white/70 hover:text-white hover:bg-white/20 shrink-0"
                title="Nascondi per oggi"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default InteractiveIntroBanner;
