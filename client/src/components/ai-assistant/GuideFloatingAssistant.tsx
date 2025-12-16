import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FloatingButton } from "./FloatingButton";
import { ChatPanel } from "./ChatPanel";

interface OpenAndAskPayload {
  autoMessage?: string;
}

export interface GuideContext {
  guideId: string;
  guideTitle: string;
  guideDescription: string;
  guideSections?: string[];
}

interface GuideFloatingAssistantProps {
  guideContext: GuideContext;
}

export function GuideFloatingAssistant({ guideContext }: GuideFloatingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenAndAsk = (event: CustomEvent<OpenAndAskPayload>) => {
      setAutoMessage(event.detail.autoMessage || null);
      setIsOpen(true);
    };

    window.addEventListener('ai:open-and-ask', handleOpenAndAsk as EventListener);
    return () => {
      window.removeEventListener('ai:open-and-ask', handleOpenAndAsk as EventListener);
    };
  }, []);

  const handleAskQuestion = () => {
    const sectionsInfo = guideContext.guideSections?.length 
      ? `\n\nLe sezioni principali sono: ${guideContext.guideSections.join(', ')}.`
      : '';
    
    const contextMessage = `Sono nella guida "${guideContext.guideTitle}". ${guideContext.guideDescription}${sectionsInfo}\n\nHo bisogno di aiuto per capire meglio questa guida. Puoi darmi una panoramica e aiutarmi con qualsiasi domanda?`;
    
    setAutoMessage(contextMessage);
    setIsOpen(true);
  };

  const handleCloseMainAI = () => {
    setIsOpen(false);
    setAutoMessage(null);
  };

  const handleAutoMessageSent = () => {
    setAutoMessage(null);
  };

  const pageContext = {
    pageType: "guide" as const,
    resourceId: guideContext.guideId,
    resourceTitle: guideContext.guideTitle,
    additionalContext: {
      guideDescription: guideContext.guideDescription,
      guideSections: guideContext.guideSections
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-28 right-6 z-[60]"
          >
            <Button
              onClick={handleAskQuestion}
              className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-full px-5 py-3 h-auto"
            >
              <Sparkles className="h-4 w-4" />
              <span className="font-medium">Chiedimi qualcosa</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <FloatingButton
        onClick={() => setIsOpen(!isOpen)}
        isOpen={isOpen}
      />
      <ChatPanel
        isOpen={isOpen}
        onClose={handleCloseMainAI}
        mode="assistenza"
        setMode={() => {}}
        consultantType="finanziario"
        setConsultantType={() => {}}
        pageContext={pageContext as any}
        hasPageContext={true}
        openedFromContext={true}
        isConsultantMode={true}
        autoMessage={autoMessage}
        onAutoMessageSent={handleAutoMessageSent}
      />
    </>
  );
}
