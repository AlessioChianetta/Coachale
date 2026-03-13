import { Headset, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function FloatingButton({ onClick, isOpen }: FloatingButtonProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="floating-ai-button fixed bottom-6 right-6 z-50 hidden sm:block"
      >
        <div className="relative">
          {!isOpen && (
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.4, 0.15, 0.4],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}

          <button
            onClick={onClick}
            className="relative w-11 h-11 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
          >
            {isOpen ? (
              <X className="h-4 w-4 text-white" />
            ) : (
              <Headset className="h-4.5 w-4.5 text-white" />
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
