import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Search,
  Globe,
  Pencil,
  BarChart3,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const PHASES = [
  { icon: Search, label: "Ricerca sulla tua attività" },
  { icon: Globe, label: "Analisi della conversazione" },
  { icon: Pencil, label: "Scrittura del piano strategico" },
  { icon: BarChart3, label: "Revisione critica del report" },
  { icon: CheckCircle2, label: "Finalizzazione" },
];

interface DiscoveryCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateReport: () => void;
}

export function DiscoveryCompleteDialog({
  open,
  onOpenChange,
  onGenerateReport,
}: DiscoveryCompleteDialogProps) {
  const [showPhases, setShowPhases] = useState(false);

  useEffect(() => {
    if (open) {
      setShowPhases(false);
      const t = setTimeout(() => setShowPhases(true), 600);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-indigo-200/60 dark:border-indigo-800/40 bg-gradient-to-b from-white to-indigo-50/30 dark:from-gray-950 dark:to-indigo-950/20 p-0 overflow-hidden">
        <div className="p-6 pb-0">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20"
              >
                <CheckCircle2 className="w-8 h-8 text-white" />
              </motion.div>
            )}
          </AnimatePresence>

          <DialogTitle className="text-center text-xl font-bold mb-1">
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              Discovery Completata!
            </span>
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground mb-5">
            Ho raccolto tutte le informazioni. Ora preparerò il tuo piano strategico personalizzato.
          </DialogDescription>
        </div>

        <div className="px-6 space-y-2">
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            return (
              <AnimatePresence key={i}>
                {showPhases && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15, duration: 0.35, ease: "easeOut" }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/60 dark:bg-white/5 border border-indigo-100/50 dark:border-indigo-800/20"
                  >
                    <div className="w-7 h-7 rounded-md bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-sm text-foreground/80">{phase.label}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}
        </div>

        <div className="p-6 pt-5 flex flex-col gap-2">
          <Button
            onClick={() => {
              onOpenChange(false);
              onGenerateReport();
            }}
            className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/20"
          >
            <Sparkles className="w-4 h-4" />
            Genera il Report
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-muted-foreground hover:text-foreground text-sm"
          >
            Lo farò dopo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
