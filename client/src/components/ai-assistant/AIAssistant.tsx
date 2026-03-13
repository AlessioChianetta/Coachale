import { useState, useEffect } from "react";
import { FloatingButton } from "./FloatingButton";
import { ChatPanel } from "./ChatPanel";
import { PageContext } from "@/hooks/use-page-context";
import { OpenAndAskPayload } from "@/hooks/use-document-focus";

export type AIMode = "assistenza" | "consulente";
export type ConsultantType = "finanziario" | "business" | "vendita";

interface AIAssistantProps {
  pageContext?: PageContext;
}

export function AIAssistant({ pageContext }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AIMode>("assistenza");
  const [consultantType, setConsultantType] = useState<ConsultantType>("finanziario");
  const [openedFromContext, setOpenedFromContext] = useState(false);
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

  const hasContext = pageContext?.pageType !== "other" &&
                     pageContext?.pageType !== "dashboard" && (
                       !!pageContext?.resourceTitle ||
                       pageContext?.pageType === "exercises_list" ||
                       pageContext?.pageType === "course"
                     );

  const handleCloseMainAI = () => {
    setIsOpen(false);
    setOpenedFromContext(false);
    setAutoMessage(null);
  };

  const handleAutoMessageSent = () => {
    setAutoMessage(null);
  };

  return (
    <>
      <FloatingButton
        onClick={() => setIsOpen(!isOpen)}
        isOpen={isOpen}
      />
      <ChatPanel
        isOpen={isOpen}
        onClose={handleCloseMainAI}
        mode={mode}
        setMode={setMode}
        consultantType={consultantType}
        setConsultantType={setConsultantType}
        pageContext={pageContext}
        hasPageContext={hasContext}
        openedFromContext={openedFromContext}
        autoMessage={autoMessage}
        onAutoMessageSent={handleAutoMessageSent}
      />
    </>
  );
}
