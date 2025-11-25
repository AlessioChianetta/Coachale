import { useState } from "react";
import { FloatingButton } from "./FloatingButton";
import { ChatPanel } from "./ChatPanel";
import { ContextButton } from "./ContextButton";
import { ContextPanel } from "./ContextPanel";
import { PageContext } from "@/hooks/use-page-context";

export type AIMode = "assistenza" | "consulente";
export type ConsultantType = "finanziario" | "business" | "vendita";

interface AIAssistantProps {
  pageContext?: PageContext;
}

export function AIAssistant({ pageContext }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [mode, setMode] = useState<AIMode>("assistenza");
  const [consultantType, setConsultantType] = useState<ConsultantType>("finanziario");
  const [openedFromContext, setOpenedFromContext] = useState(false);

  /*
    CALCOLO HASCONTEXT
    PERCHÉ: Determina se mostrare il ContextButton (pulsante a sinistra)
    RISOLVE: Mostra il pulsante quando l'AI ha rilevato una pagina specifica
    INCLUDE: Lezioni, esercizi, documenti, lista esercizi, università
  */
  const hasContext = pageContext?.pageType !== "other" &&
                     pageContext?.pageType !== "dashboard" && (
                       !!pageContext?.resourceTitle ||
                       pageContext?.pageType === "exercises_list" ||
                       pageContext?.pageType === "course"
                     );

  /*
    HANDLER PER APRIRE L'AI PRINCIPALE DAL CONTEXT PANEL
    PERCHÉ: Quando l'utente clicca "Apri AI Assistant" nel ContextPanel
    RISOLVE: Chiude il ContextPanel e apre il pannello AI principale
    AGGIUNGE: Flag per indicare che l'apertura viene dal contesto
  */
  const handleOpenMainAI = () => {
    setIsContextPanelOpen(false);
    setOpenedFromContext(true);
    setIsOpen(true);
  };

  // Reset flag when closing AI panel
  const handleCloseMainAI = () => {
    setIsOpen(false);
    setOpenedFromContext(false);
  };

  // Handler for ContextButton click
  const handleContextButtonClick = () => {
    setIsContextPanelOpen(!isContextPanelOpen);
  };

  return (
    <>
      {/* Pulsante contestuale sopra l'AI Assistant - appare solo quando c'è contesto */}
      {hasContext && pageContext && (
        <>
          <div className="fixed bottom-28 right-6 z-[60]">
            <ContextButton
              pageContext={pageContext}
              onClick={handleContextButtonClick}
              isOpen={isContextPanelOpen}
            />
          </div>
          <ContextPanel
            isOpen={isContextPanelOpen}
            onClose={() => setIsContextPanelOpen(false)}
            pageContext={pageContext}
            onOpenMainAI={handleOpenMainAI}
          />
        </>
      )}

      {/* AI Assistant principale (sempre presente a destra) */}
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
      />
    </>
  );
}