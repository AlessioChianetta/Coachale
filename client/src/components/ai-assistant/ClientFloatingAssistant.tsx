import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatPanel } from "./ChatPanel";
import { useLocation } from "wouter";

declare global {
  interface Window {
    __alessiaPendingOpen?: boolean;
    __alessiaReady?: boolean;
  }
}

interface ClientFloatingAssistantProps {
  forceOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ClientFloatingAssistant({ forceOpen, onOpenChange }: ClientFloatingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [location] = useLocation();

  useEffect(() => {
    if (forceOpen !== undefined) {
      setIsOpen(forceOpen);
    }
  }, [forceOpen]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    const welcomeTimer = setTimeout(() => {
      setShowWelcome(false);
    }, 4000);
    return () => clearTimeout(welcomeTimer);
  }, []);

  useEffect(() => {
    window.__alessiaReady = true;
    
    if (window.__alessiaPendingOpen) {
      setIsOpen(true);
      window.__alessiaPendingOpen = false;
    }
    
    const handleOpenAlessia = (event: CustomEvent<{ autoMessage?: string }>) => {
      setIsOpen(true);
    };
    window.addEventListener('alessia:open', handleOpenAlessia as EventListener);
    return () => {
      window.__alessiaReady = false;
      window.removeEventListener('alessia:open', handleOpenAlessia as EventListener);
    };
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const pageContext = {
    pageType: "client_dashboard" as const,
    resourceId: location,
    resourceTitle: "Assistente Personale",
    additionalContext: {
      currentPage: location
    }
  };

  return (
    <>
      <AnimatePresence>
        {showWelcome && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.8 }}
            className="fixed bottom-6 right-56 z-50 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-3 rounded-2xl shadow-2xl max-w-xs"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                transition={{ duration: 0.6, repeat: 4 }}
              >
                👋
              </motion.div>
              <div>
                <p className="font-semibold text-sm">Ciao! Sono Alessia</p>
                <p className="text-xs opacity-90">Sono qui per aiutarti, chiedimi qualsiasi cosa!</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className="relative">
            {!isOpen && (
              <motion.div
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500"
                animate={{
                  scale: [1, 1.08, 1],
                  opacity: [0.5, 0.2, 0.5],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}

            <Button
              onClick={handleToggle}
              size="lg"
              className="h-12 px-4 rounded-xl shadow-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 transition-all duration-300 relative overflow-hidden group flex items-center gap-2"
            >
              <motion.div
                className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20"
                whileHover={{
                  scale: [1, 1.5],
                  opacity: [0.2, 0],
                }}
                transition={{
                  duration: 0.6,
                }}
              />

              {isOpen ? (
                <X className="h-5 w-5 text-white" />
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-white" />
                  <span className="text-white font-medium">Parla con Alessia</span>
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      <ChatPanel
        isOpen={isOpen}
        onClose={handleClose}
        mode="assistenza"
        setMode={() => {}}
        consultantType="finanziario"
        setConsultantType={() => {}}
        pageContext={pageContext as any}
        hasPageContext={true}
        openedFromContext={false}
        isConsultantMode={false}
      />
    </>
  );
}

export function triggerOpenAlessia() {
  if (window.__alessiaReady) {
    window.dispatchEvent(new CustomEvent('alessia:open', { detail: {} }));
  } else {
    window.__alessiaPendingOpen = true;
  }
}
