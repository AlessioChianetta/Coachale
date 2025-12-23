import { ProactiveLead } from "../../shared/schema";

interface ConsultantInfo {
  id: string;
  firstName: string;
  lastName: string;
}

interface AgentConfig {
  id: string;
  agentName: string;
  consultantDisplayName?: string | null;
  businessName?: string | null;
}

/**
 * Determine if a follow-up is needed based on lead status and last contact time
 */
export function shouldSendFollowUp(
  lead: ProactiveLead,
  contactFrequency: number = 7
): boolean {
  // Only send follow-up if lead was contacted but hasn't responded
  if (lead.status !== "contacted") {
    return false;
  }
  
  // Check if enough time has passed since last contact
  if (!lead.lastContactedAt) {
    return false;
  }
  
  const now = new Date();
  const lastContact = new Date(lead.lastContactedAt);
  const daysSinceContact = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysSinceContact >= contactFrequency;
}

/**
 * Calculate days since last contact for follow-up message personalization
 */
export function getDaysSinceLastContact(lead: ProactiveLead): number {
  if (!lead.lastContactedAt) {
    return 0;
  }
  
  const now = new Date();
  const lastContact = new Date(lead.lastContactedAt);
  return Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Build template variables for WhatsApp approved templates
 * Template structure:
 * "Ciao {{1}}! Sono {{2}} dagli uffici di {{3}}. Ti scrivo perché {{4}}. 
 *  Dato che non voglio sprecare il tuo tempo: hai 30 secondi da dedicarmi 
 *  per capire se possiamo aiutarti a raggiungere {{5}}?"
 */
export function buildOpeningTemplateVariables(
  lead: ProactiveLead,
  consultant: ConsultantInfo,
  agentConfig: AgentConfig
): Record<string, string> {
  const consultantName = agentConfig.consultantDisplayName || agentConfig.agentName || `${consultant.firstName} ${consultant.lastName}`;
  const businessName = agentConfig.businessName || "";
  const uncino = lead.leadInfo?.uncino || agentConfig.defaultUncino || "";
  const idealStateText = lead.idealState || lead.leadInfo?.obiettivi || agentConfig.defaultIdealState || "";

  return {
    "1": lead.firstName,
    "2": consultantName,
    "3": businessName,
    "4": uncino,
    "5": idealStateText
  };
}

/**
 * Build template variables for gentle follow-up
 * Template: "Ciao {{1}}, sono ancora {{2}}. Ho visto che forse il mio messaggio si è perso. 
 *  Se hai anche solo un minuto, mi farebbe piacere capire se posso esserti d'aiuto per {{3}}. Cosa ne dici?"
 */
export function buildGentleFollowUpTemplateVariables(
  lead: ProactiveLead,
  consultant: ConsultantInfo,
  agentConfig: AgentConfig
): Record<string, string> {
  const consultantName = agentConfig.consultantDisplayName || agentConfig.agentName || consultant.firstName;
  const idealStateText = lead.idealState || lead.leadInfo?.obiettivi || agentConfig.defaultIdealState || "";

  return {
    "1": lead.firstName,
    "2": consultantName,
    "3": idealStateText
  };
}

/**
 * Build template variables for value follow-up
 * Template: "{{1}}, {{2}} qui. Capisco che potresti essere occupato, 
 *  ma ho aiutato molte persone nella tua situazione a {{3}}. Vale la pena scambiare due parole?"
 */
export function buildValueFollowUpTemplateVariables(
  lead: ProactiveLead,
  consultant: ConsultantInfo,
  agentConfig: AgentConfig
): Record<string, string> {
  const consultantName = agentConfig.consultantDisplayName || agentConfig.agentName || consultant.firstName;
  const idealStateText = lead.idealState || lead.leadInfo?.obiettivi || agentConfig.defaultIdealState || "";

  return {
    "1": lead.firstName,
    "2": consultantName,
    "3": idealStateText
  };
}

/**
 * Build template variables for final follow-up
 * Template: "Ciao {{1}}, questo è il mio ultimo tentativo di contatto. 
 *  Se {{2}} è ancora importante per te, sono qui. Altrimenti capisco e ti lascio in pace. Fammi sapere!"
 */
export function buildFinalFollowUpTemplateVariables(
  lead: ProactiveLead,
  agentConfig?: AgentConfig
): Record<string, string> {
  const idealStateText = lead.idealState || lead.leadInfo?.obiettivi || agentConfig?.defaultIdealState || "";

  return {
    "1": lead.firstName,
    "2": idealStateText
  };
}
