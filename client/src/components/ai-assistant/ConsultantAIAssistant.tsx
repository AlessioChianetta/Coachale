import { useState, useEffect } from "react";
import { FloatingButton } from "./FloatingButton";
import { ChatPanel } from "./ChatPanel";
import { ConsultantPageContext, useConsultantPageContext } from "@/hooks/use-consultant-page-context";
import { OpenAndAskPayload } from "@/hooks/use-document-focus";

interface ConsultantAIAssistantProps {
  clientId?: string;
  clientName?: string;
  conversationId?: string;
  templateId?: string;
  campaignId?: string;
}

export function ConsultantAIAssistant(props: ConsultantAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [openedFromContext, setOpenedFromContext] = useState(false);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);

  // Listen for 'ai:open-and-ask' events from setup wizard and other pages
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

  // Use consultant-specific hook
  const pageContext = useConsultantPageContext(props);

  // Determine if this page has specific context (not dashboard, not other)
  const hasContext = pageContext?.pageType !== "other" &&
                     pageContext?.pageType !== "dashboard";

  const handleOpenMainAI = () => {
    setIsContextPanelOpen(false);
    setOpenedFromContext(true);
    setIsOpen(true);
  };

  const handleCloseMainAI = () => {
    setIsOpen(false);
    setOpenedFromContext(false);
    setAutoMessage(null);
  };

  const handleAutoMessageSent = () => {
    setAutoMessage(null);
  };

  const handleContextButtonClick = () => {
    setIsContextPanelOpen(!isContextPanelOpen);
  };

  return (
    <>
      {/* Main AI Assistant (always present bottom right) */}
      <FloatingButton
        onClick={() => setIsOpen(!isOpen)}
        isOpen={isOpen}
      />
      <ChatPanel
        isOpen={isOpen}
        onClose={handleCloseMainAI}
        mode="assistenza" // Consultant uses same chat interface
        setMode={() => {}} // No mode switching for consultant
        consultantType="finanziario"
        setConsultantType={() => {}}
        pageContext={pageContext as any} // Pass consultant context to chat
        hasPageContext={hasContext}
        openedFromContext={openedFromContext}
        isConsultantMode={true} // NEW: Flag to indicate consultant mode
        autoMessage={autoMessage}
        onAutoMessageSent={handleAutoMessageSent}
      />
    </>
  );
}
