import { AlertTriangle, Medal, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpgradeBannerProps {
  onUpgradeClick: () => void;
  onViewPlansClick: () => void;
}

export function UpgradeBanner({ onUpgradeClick, onViewPlansClick }: UpgradeBannerProps) {
  return (
    <div className="mx-2 sm:mx-4 mb-3">
      <div className="max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-xl border border-amber-300 dark:border-amber-500/40 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-amber-900/20 p-4 sm:p-5">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-200/20 via-orange-200/20 to-amber-200/20 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-amber-500/10" />
          
          <div className="relative z-10">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 rounded-full bg-amber-100 dark:bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-amber-900 dark:text-amber-100">
                  Hai esaurito i messaggi mensili
                </h3>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300/80">
                  Passa ad Argento per messaggi illimitati e risposte più veloci, oppure torna il mese prossimo per altri messaggi gratis.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
                  <Button
                    onClick={onUpgradeClick}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all"
                  >
                    <Medal className="h-4 w-4 mr-2" />
                    Passa ad Argento
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={onViewPlansClick}
                    className="border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20"
                  >
                    Scopri tutti i piani
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
