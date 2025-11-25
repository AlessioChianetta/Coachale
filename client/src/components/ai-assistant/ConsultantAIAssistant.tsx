import { useState } from "react";
import { FloatingButton } from "./FloatingButton";
import { ChatPanel } from "./ChatPanel";
import { ContextButton } from "./ContextButton";
import { ConsultantContextPanel } from "./ConsultantContextPanel";
import { ConsultantPageContext, useConsultantPageContext } from "@/hooks/use-consultant-page-context";

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
  };

  const handleContextButtonClick = () => {
    setIsContextPanelOpen(!isContextPanelOpen);
  };

  return (
    <>
      {/* Context button appears above AI Assistant when there's specific page context */}
      {hasContext && pageContext && (
        <>
          <div className="fixed bottom-28 right-6 z-[60]">
            <ContextButton
              pageContext={pageContext as any} // Type compatible with client PageContext
              onClick={handleContextButtonClick}
              isOpen={isContextPanelOpen}
            />
          </div>
          <ConsultantContextPanel
            isOpen={isContextPanelOpen}
            onClose={() => setIsContextPanelOpen(false)}
            pageContext={pageContext}
            onOpenMainAI={handleOpenMainAI}
          />
        </>
      )}

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
      />
    </>
  );
}
