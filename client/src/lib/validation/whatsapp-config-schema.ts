import { z } from "zod";

export const whatsappConfigSchema = z.object({
  // Step 1: Base Setup - Required fields
  agentName: z.string().min(1, "Il nome dell'agente è obbligatorio"),
  integrationMode: z.enum(["whatsapp_ai", "ai_only"]).default("whatsapp_ai"),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioWhatsappNumber: z.string().optional(),
  autoResponseEnabled: z.boolean().default(true),
  agentType: z.enum(["reactive_lead", "proactive_setter", "informative_advisor", "customer_success", "intake_coordinator"]).default("reactive_lead"),
  whatsappConciseMode: z.boolean().default(true),
  isDryRun: z.boolean().default(true),
  isProactiveAgent: z.boolean().default(false),

  // Step 2: Availability & Automations
  workingHoursEnabled: z.boolean().default(false),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
  workingDays: z.array(z.string()).default([]),
  afterHoursMessage: z.string().optional(),
  bookingEnabled: z.boolean().default(true),
  objectionHandlingEnabled: z.boolean().default(true),
  disqualificationEnabled: z.boolean().default(true),
  upsellingEnabled: z.boolean().default(false),

  // Step 3: Brand Voice - Optional fields
  businessName: z.string().optional(),
  consultantDisplayName: z.string().optional(),
  businessDescription: z.string().optional(),
  consultantBio: z.string().optional(),
  vision: z.string().optional(),
  mission: z.string().optional(),
  values: z.array(z.string()).default([]),
  usp: z.string().optional(),
  whoWeHelp: z.string().optional(),
  whoWeDontHelp: z.string().optional(),
  whatWeDo: z.string().optional(),
  howWeDoIt: z.string().optional(),
  yearsExperience: z.coerce.number().min(0).default(0),
  clientsHelped: z.coerce.number().min(0).default(0),
  resultsGenerated: z.string().optional(),
  softwareCreated: z.array(z.object({
    emoji: z.string(),
    name: z.string(),
    description: z.string(),
  })).default([]),
  booksPublished: z.array(z.object({
    title: z.string(),
    year: z.string(),
  })).default([]),
  caseStudies: z.array(z.object({
    client: z.string(),
    result: z.string(),
  })).default([]),
  servicesOffered: z.array(z.object({
    name: z.string(),
    description: z.string(),
    price: z.string(),
  })).default([]),
  guarantees: z.string().optional(),
  aiPersonality: z.string().default("amico_fidato"),
  defaultObiettivi: z.string().optional(),
  defaultDesideri: z.string().optional(),
  defaultUncino: z.string().optional(),
  defaultIdealState: z.string().optional(),

  // Step 4: Agent Instructions - Handled by AgentInstructionsPanel
  agentInstructions: z.string().nullable().optional(),
  agentInstructionsEnabled: z.boolean().default(false),
  selectedTemplate: z.enum(["receptionist", "marco_setter", "informative_advisor", "customer_success", "intake_coordinator", "custom"]).default("receptionist"),
}).refine(
  (data) => {
    // Conditional validation: working hours required if enabled
    if (data.workingHoursEnabled) {
      return !!(data.workingHoursStart && data.workingHoursEnd && data.workingDays.length > 0);
    }
    return true;
  },
  {
    message: "Orari di lavoro e giorni sono obbligatori quando gli orari sono attivi",
    path: ["workingHoursEnabled"],
  }
);

export type WhatsAppConfigFormData = z.infer<typeof whatsappConfigSchema>;

// Helper function to validate a specific step
export function validateStep(
  step: number, 
  data: Partial<WhatsAppConfigFormData>, 
  isCreateMode: boolean = false
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  switch (step) {
    case 0: // Step 1: Base Setup
      if (!data.agentName?.trim()) errors.agentName = "Il nome dell'agente è obbligatorio";
      
      // Twilio credentials required only if integrationMode is "whatsapp_ai"
      const integrationMode = data.integrationMode || "whatsapp_ai";
      if (integrationMode === "whatsapp_ai") {
        if (!data.twilioAccountSid?.trim()) errors.twilioAccountSid = "L'Account SID è obbligatorio";
        if (!data.twilioWhatsappNumber?.trim()) errors.twilioWhatsappNumber = "Il numero WhatsApp è obbligatorio";
        // Auth token required only in create mode
        if (isCreateMode && !data.twilioAuthToken?.trim()) {
          errors.twilioAuthToken = "L'Auth Token è obbligatorio per creare un nuovo agente";
        }
      }
      break;

    case 1: // Step 2: Availability
      if (data.workingHoursEnabled) {
        if (!data.workingHoursStart) errors.workingHoursStart = "Orario inizio obbligatorio";
        if (!data.workingHoursEnd) errors.workingHoursEnd = "Orario fine obbligatorio";
        if (!data.workingDays || data.workingDays.length === 0) {
          errors.workingDays = "Seleziona almeno un giorno";
        }
      }
      break;

    case 2: // Step 3: Brand Voice - All optional
      break;

    case 3: // Step 4: AI Instructions
      // For proactive agents, require the 4 default fields
      const isProactive = data.agentType === "proactive_setter" || data.isProactiveAgent === true;
      if (isProactive) {
        if (!data.defaultObiettivi?.trim()) {
          errors.defaultObiettivi = "Gli obiettivi default sono obbligatori per agenti proattivi";
        }
        if (!data.defaultDesideri?.trim()) {
          errors.defaultDesideri = "I desideri default sono obbligatori per agenti proattivi";
        }
        if (!data.defaultUncino?.trim()) {
          errors.defaultUncino = "L'uncino default è obbligatorio per agenti proattivi";
        }
        if (!data.defaultIdealState?.trim()) {
          errors.defaultIdealState = "Lo stato ideale default è obbligatorio per agenti proattivi";
        }
      }
      break;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
