import { useState, useEffect } from "react";
import { FloatingButton } from "./FloatingButton";
import { ChatPanel } from "./ChatPanel";
import { useConsultantPageContext } from "@/hooks/use-consultant-page-context";
import { OpenAndAskPayload } from "@/hooks/use-document-focus";

interface OnboardingStepStatus {
  stepId: string;
  status: 'pending' | 'configured' | 'verified' | 'error' | 'skipped';
}

interface ConsultantAIAssistantProps {
  clientId?: string;
  clientName?: string;
  conversationId?: string;
  templateId?: string;
  campaignId?: string;
  isOnboardingMode?: boolean;
  onboardingStatuses?: OnboardingStepStatus[];
}

export function ConsultantAIAssistant(props: ConsultantAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const pageContext = useConsultantPageContext(props);

  const hasContext = pageContext?.pageType !== "other" &&
                     pageContext?.pageType !== "dashboard";

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
        mode="assistenza"
        setMode={() => {}}
        consultantType="finanziario"
        setConsultantType={() => {}}
        pageContext={pageContext as any}
        hasPageContext={hasContext}
        openedFromContext={openedFromContext}
        isConsultantMode={true}
        autoMessage={autoMessage}
        onAutoMessageSent={handleAutoMessageSent}
        isOnboardingMode={props.isOnboardingMode}
        onboardingStatuses={props.onboardingStatuses}
      />
    </>
  );
}
