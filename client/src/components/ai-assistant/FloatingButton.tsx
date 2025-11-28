
import { Bot, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface FloatingButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function FloatingButton({ onClick, isOpen }: FloatingButtonProps) {
  const [showWelcome, setShowWelcome] = useState(true);
  const [wave, setWave] = useState(false);

  // Welcome animation - shown only once for 3 seconds
  useEffect(() => {
    const welcomeTimer = setTimeout(() => {
      setShowWelcome(false);
    }, 3000);

    return () => clearTimeout(welcomeTimer);
  }, []);

  // Periodic wave animation every 60 seconds
  useEffect(() => {
    // Don't start periodic wave until welcome is done
    if (showWelcome) return;

    const waveInterval = setInterval(() => {
      setWave(true);
      setTimeout(() => setWave(false), 1000);
    }, 60000);

    return () => clearInterval(waveInterval);
  }, [showWelcome]);

  return (
    <>
      {/* Welcome tooltip that appears for 3 seconds - positioned to the left of button */}
      <AnimatePresence>
        {showWelcome && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.8 }}
            className="fixed bottom-6 right-24 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-2xl shadow-2xl max-w-xs"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                transition={{ duration: 0.6, repeat: 4 }}
              >
                👋
              </motion.div>
              <div>
                <p className="font-semibold text-sm">Ciao! Sono qui per aiutarti</p>
                <p className="text-xs opacity-90">Clicca per chiedere assistenza</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main floating button */}
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="floating-ai-button fixed bottom-6 right-6 z-50"
        >
          <div className="relative">
            {/* Pulsing ring effect - subtle but visible */}
            {!isOpen && (
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                animate={{
                  scale: [1, 1.15, 1],
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
              onClick={onClick}
              size="lg"
              className="h-16 w-16 rounded-full shadow-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 relative overflow-hidden group"
            >
              {/* Sparkle effect on hover */}
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

              {/* Icon with wave animation */}
              <motion.div
                animate={wave ? {
                  rotate: [0, 14, -8, 14, -4, 10, 0],
                } : {}}
                transition={{ duration: 0.6 }}
              >
                {isOpen ? (
                  <X className="h-7 w-7 text-white" />
                ) : (
                  <div className="relative">
                    <Bot className="h-7 w-7 text-white" />
                    {/* Sparkle indicator more visible */}
                    <motion.div 
                      className="absolute -top-1 -right-1"
                      animate={{
                        scale: [1, 1.3, 1],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                      }}
                    >
                      <Sparkles className="h-4 w-4 text-yellow-300 drop-shadow-lg" />
                    </motion.div>
                  </div>
                )}
              </motion.div>
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
