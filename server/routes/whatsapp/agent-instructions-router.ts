import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import { db } from "../../db";
import { consultantWhatsappConfig } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { 
  validateTemplateVariables, 
  SUPPORTED_VARIABLES,
  resolveInstructionVariables 
} from "../../whatsapp/template-engine";


const router = Router();

// Proactive mode section to prepend when agent is proactive
const PROACTIVE_MODE_SECTION = `🚀 MODALITÀ PROATTIVA ATTIVA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Questo agente INIZIA le conversazioni scrivendo per primo ai lead.
- Il PRIMO messaggio lo invia l'agente, NON il lead
- L'agente deve avere un messaggio di apertura coinvolgente
- NON aspettare che il lead scriva per primo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

/**
 * Validation schema for agent instructions update
 */
const updateInstructionsSchema = z.object({
  agentInstructions: z.string().min(100, "Template must be at least 100 characters").optional(),
  agentInstructionsEnabled: z.boolean().optional(),
  selectedTemplate: z.enum(["receptionist", "marco_setter", "informative_advisor", "customer_success", "intake_coordinator", "custom"]).optional(),
  businessHeaderMode: z.enum(["assistant", "direct_consultant", "direct_professional", "custom", "none"]).optional(),
  professionalRole: z.string().optional(),
  customBusinessHeader: z.string().optional(),
  isProactiveAgent: z.boolean().optional(),
});


/**
 * GET /api/whatsapp/config/:agentId/instructions
 * Fetch current agent instructions configuration
 */
router.get(
  "/whatsapp/config/:agentId/instructions",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      const consultantId = req.user!.id;

      // Security: Verify agent belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agent configuration not found or access denied",
        });
      }

      res.json({
        success: true,
        data: {
          agentInstructions: agentConfig.agentInstructions || null,
          agentInstructionsEnabled: agentConfig.agentInstructionsEnabled || false,
          selectedTemplate: agentConfig.selectedTemplate || "receptionist",
          businessHeaderMode: agentConfig.businessHeaderMode || "assistant",
          professionalRole: agentConfig.professionalRole || null,
          customBusinessHeader: agentConfig.customBusinessHeader || null,
          bookingEnabled: agentConfig.bookingEnabled !== false,
          agentName: agentConfig.agentName,
          isProactiveAgent: agentConfig.isProactiveAgent || false,
        },
      });
    } catch (error: any) {
      console.error("❌ [AGENT INSTRUCTIONS] Error fetching instructions:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch agent instructions",
      });
    }
  }
);

/**
 * PUT /api/whatsapp/config/:agentId/instructions
 * Update agent instructions configuration with validation
 */
router.put(
  "/whatsapp/config/:agentId/instructions",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      const consultantId = req.user!.id;

      // Validate request body
      const validationResult = updateInstructionsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const data = validationResult.data;

      console.log("🟢 [SERVER PUT /instructions] Richiesta ricevuta");
      console.log("🟢 [SERVER PUT /instructions] Agent ID:", agentId);
      console.log("🟢 [SERVER PUT /instructions] Consultant ID:", consultantId);
      console.log("🟢 [SERVER PUT /instructions] Dati ricevuti:", JSON.stringify({
        agentInstructionsEnabled: data.agentInstructionsEnabled,
        selectedTemplate: data.selectedTemplate,
        instructionsLength: data.agentInstructions?.length || 0,
        instructionsPreview: data.agentInstructions?.substring(0, 100),
        businessHeaderMode: data.businessHeaderMode,
        professionalRole: data.professionalRole,
        customBusinessHeader: data.customBusinessHeader,
      }, null, 2));

      // Security: Verify agent belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agent configuration not found or access denied",
        });
      }

      // Validate template variables if instructions provided
      const warnings: string[] = [];
      if (data.agentInstructions) {
        const templateValidation = validateTemplateVariables(data.agentInstructions);
        
        if (!templateValidation.valid) {
          return res.status(400).json({
            success: false,
            error: "Invalid template variables detected",
            invalidVariables: templateValidation.invalidVariables,
            suggestions: templateValidation.suggestions,
          });
        }

        // AUTO-CORRECT: Detect identity conflicts and fix businessHeaderMode
        if (data.selectedTemplate === 'custom' && data.agentInstructions) {
          const hasCustomIdentity = /Sei (il|un|una|lo|la|il Prof\.|la Prof\.ssa)/i.test(data.agentInstructions);
          const currentBusinessHeaderMode = data.businessHeaderMode !== undefined ? data.businessHeaderMode : agentConfig.businessHeaderMode || 'assistant';
          
          if (hasCustomIdentity && currentBusinessHeaderMode !== 'none') {
            // AUTO-CORRECT: Set businessHeaderMode to 'none' to avoid conflicts
            data.businessHeaderMode = 'none';
            warnings.push(
              `Il template definisce un'identità personalizzata. Ho impostato automaticamente businessHeaderMode su "none" per evitare conflitti di identità.`
            );
            console.log(`⚙️ [AUTO-CORRECT] businessHeaderMode impostato su 'none' (rilevata identità personalizzata nel template)`);
          }
        }

        // Add warnings for template length
        if (data.agentInstructions.length > 5000) {
          warnings.push("Template is quite long (>5000 chars) - consider keeping it concise for better AI performance");
        }
      }

      // Update database with transaction safety
      const [updatedConfig] = await db
        .update(consultantWhatsappConfig)
        .set({
          agentInstructions: data.agentInstructions !== undefined ? data.agentInstructions : agentConfig.agentInstructions,
          agentInstructionsEnabled: data.agentInstructionsEnabled !== undefined ? data.agentInstructionsEnabled : agentConfig.agentInstructionsEnabled,
          selectedTemplate: data.selectedTemplate !== undefined ? data.selectedTemplate : agentConfig.selectedTemplate,
          businessHeaderMode: data.businessHeaderMode !== undefined ? data.businessHeaderMode : agentConfig.businessHeaderMode,
          professionalRole: data.professionalRole !== undefined ? data.professionalRole : agentConfig.professionalRole,
          customBusinessHeader: data.customBusinessHeader !== undefined ? data.customBusinessHeader : agentConfig.customBusinessHeader,
          isProactiveAgent: data.isProactiveAgent !== undefined ? data.isProactiveAgent : agentConfig.isProactiveAgent,
        })
        .where(eq(consultantWhatsappConfig.id, agentId))
        .returning();

      console.log(`✅ [AGENT INSTRUCTIONS] Updated for agent ${agentId} (${updatedConfig.agentName})`);
      console.log(`   - Enabled: ${updatedConfig.agentInstructionsEnabled}`);
      console.log(`   - Template: ${updatedConfig.selectedTemplate}`);
      console.log(`   - Instructions length: ${updatedConfig.agentInstructions?.length || 0} chars`);
      console.log(`   - businessHeaderMode: ${updatedConfig.businessHeaderMode}`);
      console.log(`   - professionalRole: ${updatedConfig.professionalRole}`);
      console.log(`   - customBusinessHeader: ${updatedConfig.customBusinessHeader}`);

      res.json({
        success: true,
        data: {
          agentInstructions: updatedConfig.agentInstructions,
          agentInstructionsEnabled: updatedConfig.agentInstructionsEnabled,
          selectedTemplate: updatedConfig.selectedTemplate,
          businessHeaderMode: updatedConfig.businessHeaderMode,
          professionalRole: updatedConfig.professionalRole,
          customBusinessHeader: updatedConfig.customBusinessHeader,
          agentName: updatedConfig.agentName,
          isProactiveAgent: updatedConfig.isProactiveAgent,
        },
        warnings,
        message: "Agent instructions updated successfully",
      });
    } catch (error: any) {
      console.error("❌ [AGENT INSTRUCTIONS] Error updating instructions:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update agent instructions",
      });
    }
  }
);

/**
 * GET /api/whatsapp/config/:agentId/instructions/variables
 * Get list of supported variables with examples
 */
router.get(
  "/whatsapp/config/:agentId/instructions/variables",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      const consultantId = req.user!.id;

      // Security: Verify agent belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agent configuration not found or access denied",
        });
      }

      // Return supported variables with descriptions and current values
      const variablesWithExamples = [
        { variable: "${businessName}", description: "Nome del business", currentValue: agentConfig.businessName || "il consulente" },
        { variable: "${businessDescription}", description: "Descrizione del business", currentValue: agentConfig.businessDescription || "" },
        { variable: "${consultantDisplayName}", description: "Nome del consulente da mostrare", currentValue: agentConfig.consultantDisplayName || agentConfig.businessName || "il consulente" },
        { variable: "${consultantBio}", description: "Bio del consulente", currentValue: agentConfig.consultantBio || "" },
        { variable: "${consultantName}", description: "Nome completo consulente", currentValue: agentConfig.consultantDisplayName || "" },
        { variable: "${idealState}", description: "Obiettivo ideale del lead (es: libertà finanziaria)", currentValue: "dinamico dal lead" },
        { variable: "${currentState}", description: "Situazione attuale del lead", currentValue: "dinamico dal lead" },
        { variable: "${mainObstacle}", description: "Ostacolo principale del lead", currentValue: "dinamico dal lead" },
        { variable: "${firstName}", description: "Nome del lead", currentValue: "dinamico dal lead" },
        { variable: "${lastName}", description: "Cognome del lead", currentValue: "dinamico dal lead" },
        { variable: "${uncino}", description: "Hook/uncino value proposition", currentValue: "il valore che possiamo offrirti" },
        { variable: "${obiettivi}", description: "Obiettivi del lead", currentValue: "dinamico dal lead" },
        { variable: "${desideri}", description: "Desideri del lead", currentValue: "dinamico dal lead" },
        { variable: "${vision}", description: "Vision del business", currentValue: agentConfig.vision || "" },
        { variable: "${mission}", description: "Mission del business", currentValue: agentConfig.mission || "" },
        { variable: "${usp}", description: "Unique Selling Proposition", currentValue: agentConfig.usp || "" },
        { variable: "${whoWeHelp}", description: "Chi aiutiamo (target)", currentValue: agentConfig.whoWeHelp || "" },
        { variable: "${whatWeDo}", description: "Cosa facciamo", currentValue: agentConfig.whatWeDo || "" },
        { variable: "${resultsGenerated}", description: "Risultati generati (social proof)", currentValue: agentConfig.resultsGenerated || "" },
        { variable: "${clientsHelped}", description: "Numero clienti aiutati", currentValue: agentConfig.clientsHelped || "" },
        { variable: "${yearsExperience}", description: "Anni di esperienza", currentValue: agentConfig.yearsExperience || "" },
      ];

      res.json({
        success: true,
        data: variablesWithExamples,
        count: variablesWithExamples.length,
      });
    } catch (error: any) {
      console.error("❌ [AGENT INSTRUCTIONS] Error fetching variables:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch variables",
      });
    }
  }
);

/**
 * POST /api/whatsapp/config/:agentId/instructions/preview
 * Preview template with variables resolved using real data
 */
router.post(
  "/whatsapp/config/:agentId/instructions/preview",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      const consultantId = req.user!.id;
      const { template } = req.body;

      if (!template || typeof template !== "string") {
        return res.status(400).json({
          success: false,
          error: "Template is required",
        });
      }

      // Security: Verify agent belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(consultantWhatsappConfig)
        .where(
          and(
            eq(consultantWhatsappConfig.id, agentId),
            eq(consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({
          success: false,
          error: "Agent configuration not found or access denied",
        });
      }

      // Resolve variables with real consultant data + sample lead data
      const resolvedTemplate = resolveInstructionVariables(template, {
        consultantConfig: {
          businessName: agentConfig.businessName,
          businessDescription: agentConfig.businessDescription,
          consultantDisplayName: agentConfig.consultantDisplayName,
          consultantBio: agentConfig.consultantBio,
          vision: agentConfig.vision,
          mission: agentConfig.mission,
          usp: agentConfig.usp,
          whoWeHelp: agentConfig.whoWeHelp,
          whatWeDo: agentConfig.whatWeDo,
          resultsGenerated: agentConfig.resultsGenerated,
          clientsHelped: agentConfig.clientsHelped,
          yearsExperience: agentConfig.yearsExperience,
        },
        proactiveLead: {
          firstName: "Mario",
          lastName: "Rossi",
          idealState: "libertà finanziaria",
        },
        clientState: {
          currentState: "debiti eccessivi",
          mainObstacle: "mancanza di pianificazione finanziaria",
          idealState: "libertà finanziaria",
        },
      });

      res.json({
        success: true,
        data: {
          original: template,
          resolved: resolvedTemplate,
        },
      });
    } catch (error: any) {
      console.error("❌ [AGENT INSTRUCTIONS] Error previewing template:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to preview template",
      });
    }
  }
);

/**
 * Custom error types for proper HTTP status mapping
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Validation schema for generate instructions request
 */
const generateInstructionsSchema = z.object({
  agentType: z.enum(["inbound", "outbound", "consultative", "customer_success", "intake_coordinator"]),
  objective: z.enum([
    "appointment", 
    "info_gathering", 
    "quote_request", 
    "lead_qualification", 
    "follow_up",
    "conversion",
    "education", 
    "support", 
    "faq",
    "supporto_tecnico",
    "risposta_faq",
    "raccolta_feedback",
    "checkin_periodico",
    "raccolta_documenti",
    "firma_consensi",
    "questionario",
    "reminder",
    "other"
  ]),
  customObjective: z.string().optional(),
  bookingEnabled: z.boolean().optional(),
  baseTemplate: z.string().optional(),
  isProactiveAgent: z.boolean().optional(),
});

/**
 * POST /api/whatsapp/config/instructions/generate
 * Generate AI instructions based on agent type and objective
 */
router.post(
  "/whatsapp/config/instructions/generate",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const validationResult = generateInstructionsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const { agentType, objective, customObjective, bookingEnabled, baseTemplate, isProactiveAgent } = validationResult.data;

      console.log(`🤖 [GENERATE INSTRUCTIONS] Starting generation for consultant ${consultantId}`);
      console.log(`   - Agent Type: ${agentType}`);
      console.log(`   - Objective: ${objective}`);
      console.log(`   - Custom Objective: ${customObjective || 'N/A'}`);
      console.log(`   - Booking Enabled: ${bookingEnabled !== false ? 'YES' : 'NO'}`);
      console.log(`   - Is Proactive Agent: ${isProactiveAgent ? 'YES' : 'NO'}`);
      console.log(`   - Base Template: ${baseTemplate ? `YES (${baseTemplate.length} chars)` : 'NO - will use default template'}`);

      const { getAIProvider, getModelWithThinking } = await import("../../ai/provider-factory");
      const providerResult = await getAIProvider(consultantId, consultantId);

      if (!providerResult || !providerResult.client) {
        return res.status(500).json({
          success: false,
          error: "AI provider not available. Please configure your AI settings.",
        });
      }

      console.log(`✅ [GENERATE INSTRUCTIONS] Using provider: ${providerResult.metadata.name}`);

      const agentTypeLabels: Record<string, string> = {
        inbound: "INBOUND (Receptionist) - Lead che scrivono spontaneamente",
        outbound: "OUTBOUND (Setter) - Lead che contatti tu proattivamente",
        consultative: "CONSULTATIVO (Educativo) - Solo informativo, senza vendita",
        customer_success: "CUSTOMER SUCCESS - Assistenza post-vendita e fidelizzazione clienti",
        intake_coordinator: "INTAKE COORDINATOR - Raccolta documenti e onboarding pre-appuntamento",
      };

      const objectiveLabels: Record<string, string> = {
        appointment: "Presa appuntamento - Fissare una call o meeting di consulenza",
        info_gathering: "Raccolta informazioni - Qualificare il lead raccogliendo dati",
        quote_request: "Richiesta preventivo - Raccogliere info per inviare un preventivo personalizzato",
        lead_qualification: "Qualificazione lead - Verificare interesse, budget e fit",
        follow_up: "Follow-up contatto - Ricontattare lead interessato per mantenere relazione",
        conversion: "Conversione interesse - Portare lead verso l'azione finale",
        education: "Educazione prodotto - Insegnare e informare sul prodotto/servizio",
        support: "Supporto informativo - Rispondere a domande e dubbi",
        faq: "FAQ automatiche - Gestire domande frequenti in modo automatico",
        supporto_tecnico: "Supporto Tecnico - Risolvere problemi tecnici e operativi del cliente",
        risposta_faq: "Risposta FAQ Post-Vendita - Rispondere a domande frequenti dei clienti attivi",
        raccolta_feedback: "Raccolta Feedback - Ottenere recensioni e feedback sull'esperienza",
        checkin_periodico: "Check-in Periodico - Mantenere relazione e verificare soddisfazione",
        raccolta_documenti: "Raccolta Documenti - Raccogliere documenti necessari per il servizio",
        firma_consensi: "Firma Consensi - Ottenere firme su consensi e autorizzazioni",
        questionario: "Questionario Pre-Appuntamento - Raccogliere informazioni preparatorie",
        reminder: "Reminder Appuntamento - Ricordare appuntamenti e scadenze",
        other: customObjective || "Obiettivo personalizzato",
      };

      const objectiveSpecificGuidance: Record<string, string> = {
        appointment: `
🎯 FOCUS: Le domande devono guidare verso la PRESA APPUNTAMENTO.
- Fase 1-3: Scopri motivazione, situazione attuale e obiettivi numerici
- Fase 4: Magic Question per proporre la consulenza gratuita
- Fase 5-8: Raccolta slot, telefono, email per confermare l'appuntamento
- Fase 9: Supporto pre-appuntamento`,
        
        info_gathering: `
🎯 FOCUS: Le domande devono essere orientate a RACCOGLIERE INFORMAZIONI dettagliate.
- Fase 1: Scopri perché hanno scritto e cosa cercano
- Fase 2-3: Approfondisci situazione attuale, bisogni, problemi specifici
- Fase 3.5: Verifica priorità e urgenza
- Fase 4: Chiedi se vogliono approfondire con una call
- Fase 5-9: Se accettano, raccogli contatti; altrimenti ringrazia e offri supporto`,

        quote_request: `
🎯 FOCUS: Le domande devono raccogliere INFO PER UN PREVENTIVO.
- Fase 1: Scopri che tipo di servizio/prodotto cercano
- Fase 2: Chiedi dettagli specifici (quantità, dimensioni, specifiche tecniche)
- Fase 3: Chiedi budget indicativo e timeline desiderata
- Fase 3.5: Verifica eventuali requisiti speciali o vincoli
- Fase 4: Proponi di inviare il preventivo via email o fissare una call
- Fase 5-9: Raccogli contatti per invio preventivo`,

        lead_qualification: `
🎯 FOCUS: Le domande devono QUALIFICARE il lead (BANT: Budget, Authority, Need, Timeline).
- Fase 1: Scopri perché hanno scritto e qual è il loro ruolo decisionale
- Fase 2: Verifica il bisogno reale e l'urgenza
- Fase 3: Chiedi obiettivi e budget disponibile
- Fase 3.5: Verifica timeline e processo decisionale
- Fase 4: Se qualificato, proponi una call; se non qualificato, indirizza altrove
- Fase 5-9: Per lead qualificati, raccogli contatti`,

        follow_up: `
🎯 FOCUS: Le domande devono MANTENERE LA RELAZIONE e riportare interesse.
- Fase 1: Ricorda chi sei e perché li stai ricontattando
- Fase 2: Chiedi come è andato con il tema discusso precedentemente
- Fase 3: Scopri se ci sono nuovi bisogni o dubbi emersi
- Fase 3.5: Verifica se hanno valutato alternative o hanno domande
- Fase 4: Proponi un prossimo step (call, demo, contenuto)
- Fase 5-9: Se interessati, raccogli disponibilità per approfondimento`,

        conversion: `
🎯 FOCUS: Le domande devono PORTARE VERSO LA DECISIONE finale.
- Fase 1: Riepiloga i benefici discussi e il valore della soluzione
- Fase 2: Affronta le ultime obiezioni o dubbi
- Fase 3: Chiedi esplicitamente cosa manca per procedere
- Fase 3.5: Offri rassicurazioni (garanzie, testimonianze, prove)
- Fase 4: Proponi l'azione finale (acquisto, iscrizione, contratto)
- Fase 5-9: Accompagna il processo di chiusura`,

        education: `
🎯 FOCUS: Le domande devono EDUCARE E INFORMARE senza vendere.
- Fase 1: Scopri cosa vuole imparare e il suo livello di conoscenza
- Fase 2: Valuta le sue basi sull'argomento
- Fase 3: Spiega in modo chiaro con esempi pratici
- Fase 4: Verifica la comprensione e offri approfondimenti
- Fase 5-6: Suggerisci risorse e prossimi passi educativi
- NON menzionare mai appuntamenti, call o vendite`,

        support: `
🎯 FOCUS: Le domande devono RISOLVERE DUBBI e fornire supporto.
- Fase 1: Scopri qual è il dubbio o problema specifico
- Fase 2: Raccogli dettagli per capire meglio la situazione
- Fase 3: Fornisci la risposta o soluzione chiara
- Fase 4: Verifica se ha risolto e se ci sono altri dubbi
- Fase 5-6: Offri ulteriore supporto se necessario
- Mantieni tono paziente e disponibile`,

        faq: `
🎯 FOCUS: Rispondi in modo RAPIDO e PRECISO alle domande frequenti.
- Riconosci la domanda e classifica la categoria
- Fornisci risposta strutturata e completa
- Offri link o risorse aggiuntive se disponibili
- Chiedi se la risposta è stata utile
- Proponi altre FAQ correlate che potrebbero interessare
- Mantieni risposte concise ma complete`,

        supporto_tecnico: `
🎯 FOCUS: RISOLVERE PROBLEMI TECNICI del cliente in modo efficace.
- Fase 1: Identifica il problema specifico e la sua urgenza
- Fase 2: Raccogli dettagli tecnici (versione, dispositivo, errori)
- Fase 3: Proponi soluzioni step-by-step
- Fase 4: Verifica se il problema è risolto
- Fase 5-6: Offri risorse aggiuntive (guide, tutorial)
- Fase 7: Chiedi feedback sulla risoluzione
- Mantieni tono paziente e tecnico ma accessibile`,

        risposta_faq: `
🎯 FOCUS: RISPONDERE RAPIDAMENTE alle domande frequenti dei clienti attivi.
- Fase 1: Identifica la categoria della domanda
- Fase 2: Fornisci risposta chiara e strutturata
- Fase 3: Offri risorse correlate se utili
- Fase 4: Verifica se la risposta è soddisfacente
- Fase 5-6: Proponi altre FAQ che potrebbero interessare
- Mantieni risposte concise ma complete`,

        raccolta_feedback: `
🎯 FOCUS: OTTENERE FEEDBACK genuino e costruttivo.
- Fase 1: Ringrazia per la collaborazione e contestualizza
- Fase 2: Chiedi valutazione generale dell'esperienza (1-10)
- Fase 3: Approfondisci aspetti positivi
- Fase 4: Chiedi aree di miglioramento
- Fase 5: Richiedi recensione/testimonianza se soddisfatto
- Fase 6: Proponi referral program se presente
- Mantieni tono genuino e non invadente`,

        checkin_periodico: `
🎯 FOCUS: MANTENERE LA RELAZIONE e verificare soddisfazione.
- Fase 1: Saluta calorosamente e ricorda l'ultimo contatto
- Fase 2: Chiedi come sta andando con il servizio/prodotto
- Fase 3: Verifica se ci sono nuovi bisogni emersi
- Fase 4: Offri supporto o risorse utili
- Fase 5: Proponi upgrade o servizi complementari se pertinenti
- Fase 6: Conferma disponibilità per future necessità
- Mantieni tono amichevole e non commerciale`,

        raccolta_documenti: `
🎯 FOCUS: RACCOGLIERE DOCUMENTI necessari in modo efficiente.
- Fase 1: Spiega quali documenti servono e perché
- Fase 2: Fornisci lista chiara e formati accettati
- Fase 3: Guida su come inviarli (foto, PDF, email)
- Fase 4: Conferma ricezione di ogni documento
- Fase 5: Verifica completezza e leggibilità
- Fase 6: Comunica prossimi step dopo la ricezione
- Mantieni tono paziente e chiaro`,

        firma_consensi: `
🎯 FOCUS: OTTENERE FIRME su consensi e autorizzazioni.
- Fase 1: Spiega l'importanza del documento da firmare
- Fase 2: Illustra brevemente i punti chiave
- Fase 3: Rispondi a eventuali dubbi
- Fase 4: Guida nel processo di firma (digitale o cartacea)
- Fase 5: Conferma ricezione della firma
- Fase 6: Comunica prossimi step
- Mantieni tono professionale e rassicurante`,

        questionario: `
🎯 FOCUS: RACCOGLIERE INFORMAZIONI preparatorie per l'appuntamento.
- Fase 1: Spiega perché il questionario è importante
- Fase 2: Fai domande una alla volta, in modo conversazionale
- Fase 3: Approfondisci risposte rilevanti
- Fase 4: Verifica di aver raccolto tutto il necessario
- Fase 5: Riepiloga le informazioni raccolte
- Fase 6: Conferma l'appuntamento e i prossimi step
- Mantieni tono amichevole e non invasivo`,

        reminder: `
🎯 FOCUS: RICORDARE APPUNTAMENTI e scadenze in modo efficace.
- Fase 1: Saluta e ricorda l'appuntamento/scadenza
- Fase 2: Conferma data, ora e modalità
- Fase 3: Chiedi conferma di partecipazione
- Fase 4: Fornisci dettagli pratici (link, indirizzo, cosa portare)
- Fase 5: Offri possibilità di riprogrammare se necessario
- Fase 6: Ringrazia e chiudi positivamente
- Mantieni tono cordiale e pratico`,

        other: `
🎯 FOCUS: ${customObjective || "Obiettivo personalizzato definito dal consulente"}.
- Adatta le domande di ogni fase per raggiungere questo obiettivo specifico
- Mantieni la struttura delle fasi ma personalizza le domande
- Assicurati che ogni fase contribuisca al raggiungimento dell'obiettivo`,
      };

      const bookingSection = bookingEnabled !== false
        ? `
📅 BOOKING ABILITATO:
L'agente PUÒ prendere appuntamenti. Includi le fasi 5-8 per:
- Proposta slot disponibili
- Raccolta telefono
- Raccolta email
- Attesa creazione appuntamento con Google Calendar`
        : `
🚫 BOOKING DISABILITATO:
L'agente NON può prendere appuntamenti. 
Le fasi 5-8 devono essere adattate per raccogliere contatti senza fissare appuntamenti.
Invece di proporre slot, proponi di inviare informazioni via email o di essere ricontattati.`;

      // baseTemplate is REQUIRED - it must come from the frontend
      // The frontend has all templates in AgentInstructionsPanel.tsx
      if (!baseTemplate || baseTemplate.length < 500) {
        return res.status(400).json({
          success: false,
          error: "baseTemplate is required and must be at least 500 characters. The frontend must pass the agent template.",
        });
      }
      
      let templateToUse = baseTemplate;
      
      // Add proactive mode section if isProactiveAgent is true
      if (isProactiveAgent) {
        templateToUse = PROACTIVE_MODE_SECTION + templateToUse;
        console.log(`   - Added PROACTIVE_MODE_SECTION to template`);
      }

      // ADAPT MODE: Always use base template and adapt it to the objective
      const systemPrompt = `Sei un esperto di prompt engineering per agenti AI conversazionali WhatsApp per il settore consulenziale.

Il tuo compito è ADATTARE il template esistente in base all'obiettivo specificato dal consulente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIGURAZIONE AGENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 TIPO AGENTE: ${agentTypeLabels[agentType]}
📌 OBIETTIVO PRINCIPALE: ${objectiveLabels[objective]}

${objectiveSpecificGuidance[objective]}

${bookingSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE BASE DA ADATTARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${templateToUse}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ISTRUZIONI DI ADATTAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ MANTIENI la struttura delle fasi del template base
✅ MANTIENI le variabili \${...} esattamente come sono
✅ MANTIENI lo stile e il tono generale
✅ ADATTA gli esempi di domande per allinearsi all'obiettivo "${objectiveLabels[objective]}"
✅ PERSONALIZZA i checkpoint per raggiungere l'obiettivo specifico
✅ MODIFICA la Magic Question (Fase 4) per riflettere l'obiettivo
✅ Se booking disabilitato, adatta le fasi 5-8 di conseguenza

❌ NON cambiare drasticamente la struttura
❌ NON rimuovere fasi esistenti
❌ NON aggiungere nuove variabili
❌ NON tradurre o cambiare lingua

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GENERA ORA il template ADATTATO. Restituisci SOLO le istruzioni complete, senza commenti.`;

      const { model, useThinking, thinkingLevel } = getModelWithThinking(providerResult.metadata.name);
      console.log(`[AI] Using model: ${model} with thinking: ${useThinking ? thinkingLevel : 'disabled'}`);
      
      const result = await providerResult.client.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt }]
          }
        ],
        generationConfig: {
          ...(useThinking && { thinkingConfig: { thinkingLevel } })
        }
      });

      let generatedInstructions = result.response.text();

      generatedInstructions = generatedInstructions.replace(/\*\*\s+([^\*]+?)\s+\*\*/g, '**$1**');
      generatedInstructions = generatedInstructions.replace(/\*\s+([^\*]+?)\s+\*/g, '*$1*');

      const variableMapping: Record<string, string> = {
        '${nomeConsulente}': '${consultantDisplayName}',
        '${nomeBusiness}': '${businessName}',
        '${descrizioneConsulente}': '${consultantBio}',
        '${descrizioneBusiness}': '${businessDescription}',
        '${nome}': '${firstName}',
        '${cognome}': '${lastName}',
      };

      for (const [incorrect, correct] of Object.entries(variableMapping)) {
        generatedInstructions = generatedInstructions.replace(
          new RegExp(incorrect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
          correct
        );
      }

      console.log(`✅ [GENERATE INSTRUCTIONS] Generated successfully`);
      console.log(`   - Length: ${generatedInstructions.length} chars`);
      console.log(`   - Provider: ${providerResult.metadata.name}`);

      res.json({
        success: true,
        data: {
          instructions: generatedInstructions,
          length: generatedInstructions.length,
          provider: providerResult.metadata.name,
          agentType,
          objective,
        },
        message: "Instructions generated successfully",
      });
    } catch (error: any) {
      console.error("❌ [GENERATE INSTRUCTIONS] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to generate instructions with AI",
      });
    }
  }
);

/**
 * Helper function: Enhance instructions with AI
 * Shared logic for both agent-scoped and create-mode enhancement
 */
async function enhanceInstructionsWithAI(
  consultantId: string,
  instructions: string,
  agentId?: string,
  bookingEnabled?: boolean,
  mode: "enhance" | "simplify" | "expand" | "formalize" | "friendly" | "examples" | "whatsapp" = "enhance"
): Promise<{
  original: string;
  enhanced: string;
  originalLength: number;
  enhancedLength: number;
  provider: string;
  mode: string;
}> {
  // Validate instructions
  if (!instructions || typeof instructions !== "string") {
    throw new ValidationError("Instructions text is required");
  }

  if (instructions.length < 50) {
    throw new ValidationError("Instructions must be at least 50 characters to enhance");
  }

  let agentBookingEnabled = bookingEnabled;

  // Security: If agentId provided, verify agent belongs to consultant
  if (agentId) {
    const [agentConfig] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(
        and(
          eq(consultantWhatsappConfig.id, agentId),
          eq(consultantWhatsappConfig.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!agentConfig) {
      throw new NotFoundError("Agent configuration not found or access denied");
    }

    // Use agentConfig's bookingEnabled if not provided explicitly
    if (agentBookingEnabled === undefined) {
      agentBookingEnabled = agentConfig.bookingEnabled;
    }
  }

  // Import AI provider (already uses Vertex AI as default with Gemini fallback)
  const { getAIProvider, getModelWithThinking } = await import("../../ai/provider-factory");
  
  // Get AI provider (Vertex AI first, then fallback to Gemini)
  const providerResult = await getAIProvider(consultantId, consultantId);
  
  if (!providerResult || !providerResult.client) {
    throw new Error("AI provider not available. Please configure your AI settings.");
  }

  console.log(`✅ [AI ENHANCEMENT] Using provider: ${providerResult.metadata.name}`);
  console.log(`   - Booking enabled: ${agentBookingEnabled !== false ? 'YES' : 'NO'}`);
  console.log(`   - Enhancement mode: ${mode}`);

  // Build booking restriction text if bookingEnabled is false
  const bookingRestriction = agentBookingEnabled === false 
    ? `\n\n🚨 RESTRIZIONE IMPORTANTE - APPUNTAMENTI DISABILITATI:
Questo agente NON può prendere appuntamenti. Se le istruzioni originali menzionano appuntamenti o booking, 
DEVI aggiungere chiaramente questa restrizione nelle istruzioni migliorate:

"⚠️ IMPORTANTE: Non sei autorizzato a prendere appuntamenti. Puoi solo fornire assistenza e rispondere alle domande tramite chat."

Assicurati che questa limitazione sia EVIDENTE e posta all'inizio delle istruzioni migliorate.`
    : '';

  // Build mode-specific enhancement instructions
  const modeInstructions: Record<typeof mode, string> = {
    enhance: `Il tuo compito è migliorare queste istruzioni rendendole:
1. **Più strutturate e chiare** - dividi in sezioni logiche con separatori visivi
2. **Con esempi concreti** - aggiungi esempi di domande, risposte, e situazioni
3. **Con checkpoint e obiettivi chiari** - definisci quando passare alla fase successiva
4. **Più actionable** - aggiungi istruzioni specifiche su COSA fare e COME farlo
5. **Mantenendo ESATTAMENTE l'intento originale** - non cambiare il significato, solo migliorare la struttura${bookingRestriction}`,

    simplify: `Il tuo compito è SEMPLIFICARE queste istruzioni:
1. **Elimina ridondanze** - rimuovi ripetizioni e informazioni superflue
2. **Mantieni solo l'essenziale** - focalizzati sui concetti chiave
3. **Frasi brevi e dirette** - ogni frase deve comunicare un solo concetto
4. **Riduce la verbosità** - massimo 50% del testo originale se possibile
5. **Mantieni chiarezza** - semplice non significa confuso
6. **Preserva l'intento originale** - non cambiare il significato${bookingRestriction}`,

    expand: `Il tuo compito è ESPANDERE queste istruzioni aggiungendo:
1. **Dettagli pratici** - aggiungi specifiche operative e contestuali
2. **Esempi concreti** - almeno 3-4 esempi di dialoghi reali per ogni fase
3. **Casi d'uso** - descrivi scenari tipici e come gestirli
4. **Troubleshooting** - aggiungi sezioni "Cosa fare se..." per situazioni problematiche
5. **Best practices** - suggerimenti su come ottimizzare l'interazione
6. **Varianti situazionali** - diverse risposte per diversi contesti${bookingRestriction}

IMPORTANTE: Espandi in modo significativo (minimo 150% del testo originale), ma mantieni tutto rilevante.`,

    formalize: `Il tuo compito è FORMALIZZARE queste istruzioni rendendole:
1. **Tono professionale e corporate** - linguaggio formale e istituzionale
2. **Terminologia tecnica** - usa termini precisi e professionali
3. **Struttura rigorosa** - organizzazione metodica e sistematica
4. **Evita colloquialismi** - elimina espressioni informali ed emoji eccessive
5. **Stile protocollo aziendale** - come un manuale operativo professionale
6. **Mantieni autorevolezza** - tono esperto ma cortese
7. **Preserva l'efficacia** - formale non significa freddo${bookingRestriction}`,

    friendly: `Il tuo compito è rendere queste istruzioni più AMICHEVOLI ed EMPATICHE:
1. **Tono caldo e accogliente** - linguaggio umano e cordiale
2. **Empatia visibile** - mostra comprensione dei problemi del lead
3. **Emoji strategiche** - usa emoji per rendere il messaggio più caldo (senza esagerare)
4. **Linguaggio positivo** - focus su opportunità piuttosto che problemi
5. **Connessione umana** - crea feeling e fiducia
6. **Approccio conversazionale** - come parlare con un amico professionale
7. **Incoraggiamento** - includi frasi motivazionali dove appropriate${bookingRestriction}`,

    examples: `Il tuo compito è arricchire queste istruzioni con DIALOGHI ESEMPIO:
1. **Conversazioni tipo** - almeno 2-3 dialoghi completi per ogni fase principale
2. **Esempi di domande** - mostra esattamente cosa chiedere in ogni situazione
3. **Esempi di risposte** - mostra come rispondere a diverse tipologie di lead
4. **Scenari realistici** - situazioni concrete che potrebbe affrontare l'agente
5. **Gestione obiezioni** - esempi di come gestire dubbi e resistenze
6. **Best/Worst case** - esempi di conversazioni ottime vs quelle da evitare
7. **Formattazione chiara** - distingui chiaramente esempi dal resto del testo${bookingRestriction}

IMPORTANTE: Gli esempi devono essere in italiano, realistici e vari.`,

    whatsapp: `Il tuo compito è ottimizzare queste istruzioni specificamente per WHATSAPP:
1. **Messaggi brevissimi** - massimo 2-3 righe per messaggio
2. **Emoji misurate** - 1-2 emoji per messaggio (non di più!)
3. **Stile chat** - linguaggio informale ma professionale
4. **Separazione messaggi** - indica quando dividere in più messaggi
5. **Timing ottimale** - suggerisci quando aspettare la risposta prima di continuare
6. **Formattazione WhatsApp** - usa *grassetto*, _corsivo_ dove appropriato
7. **Evita muri di testo** - nessun messaggio oltre 3 righe
8. **Call-to-action chiari** - ogni messaggio con scopo preciso${bookingRestriction}

IMPORTANTE: Pensa a come suonerebbe su WhatsApp mobile, non via email.`
  };

  // Build enhancement prompt with mode-specific instructions
  const systemPrompt = `Sei un esperto di prompt engineering per agenti AI conversazionali WhatsApp.

Il consulente ha scritto queste istruzioni per il suo agente WhatsApp:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ISTRUZIONI ORIGINALI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${instructions}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${modeInstructions[mode]}

⚠️ REGOLE FONDAMENTALI SULLE VARIABILI:
DEVI usare ESCLUSIVAMENTE queste variabili (NIENTE ALTRO):
- \${businessName} - Nome del business
- \${businessDescription} - Descrizione del business
- \${consultantDisplayName} - Nome del consulente da mostrare
- \${consultantBio} - Bio del consulente
- \${consultantName} - Nome completo del consulente
- \${idealState} - Obiettivo ideale del lead
- \${currentState} - Situazione attuale del lead
- \${mainObstacle} - Ostacolo principale del lead
- \${firstName} - Nome del lead
- \${lastName} - Cognome del lead
- \${uncino} - Hook/value proposition
- \${obiettivi} - Obiettivi del lead
- \${desideri} - Desideri del lead
- \${vision} - Vision del business
- \${mission} - Mission del business

NON INVENTARE MAI variabili diverse (es: \${nomeConsulente}, \${nomeBusiness}, ecc.)

⚠️ REGOLE FONDAMENTALI SU FORMATTAZIONE:
- Per grassetto usa **testo** (SENZA spazi interni, MAI ** testo **)
- Per corsivo usa *testo* (SENZA spazi interni, MAI * testo *)
- Usa separatori ━━━ per le sezioni principali
- Usa emoji strategicamente per evidenziare concetti chiave (adatta all'intensità del mode)
- NON aggiungere funzionalità non presenti nelle istruzioni originali
- NON cambiare radicalmente il tono se non richiesto esplicitamente dal mode
- Se le istruzioni menzionano appuntamenti E bookingEnabled=true, enfatizza quella parte

Restituisci SOLO le istruzioni migliorate, senza commenti o spiegazioni aggiuntive.`;

  // Call AI for enhancement using GeminiClient interface
  const { model, useThinking, thinkingLevel } = getModelWithThinking(providerResult.metadata.name);
  console.log(`[AI] Using model: ${model} with thinking: ${useThinking ? thinkingLevel : 'disabled'}`);
  
  const result = await providerResult.client.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: systemPrompt }]
      }
    ],
    generationConfig: {
      ...(useThinking && { thinkingConfig: { thinkingLevel } })
    }
  });

  let enhancedInstructions = result.response.text();

  // POST-PROCESSING: Fix markdown formatting issues
  // Fix malformed bold: ** testo ** → **testo**
  enhancedInstructions = enhancedInstructions.replace(/\*\*\s+([^\*]+?)\s+\*\*/g, '**$1**');
  // Fix malformed italic: * testo * → *testo*
  enhancedInstructions = enhancedInstructions.replace(/\*\s+([^\*]+?)\s+\*/g, '*$1*');

  // POST-PROCESSING: Fix common variable mistakes (map incorrect to correct)
  const variableMapping: Record<string, string> = {
    '${nomeConsulente}': '${consultantDisplayName}',
    '${nomeBusiness}': '${businessName}',
    '${descrizioneConsulente}': '${consultantBio}',
    '${descrizioneBusiness}': '${businessDescription}',
    '${nome}': '${firstName}',
    '${cognome}': '${lastName}',
    '${statoAttuale}': '${currentState}',
    '${statoIdeale}': '${idealState}',
    '${ostacolo}': '${mainObstacle}',
  };

  // Replace all incorrect variables
  for (const [incorrect, correct] of Object.entries(variableMapping)) {
    enhancedInstructions = enhancedInstructions.replace(new RegExp(incorrect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
  }

  console.log(`✅ [AGENT INSTRUCTIONS] Enhanced instructions${agentId ? ` for agent ${agentId}` : ' (create mode)'}`);
  console.log(`   - Original length: ${instructions.length} chars`);
  console.log(`   - Enhanced length: ${enhancedInstructions.length} chars`);
  console.log(`   - Provider: ${providerResult.metadata.name}`);
  console.log(`   - Mode: ${mode}`);
  console.log(`   - Post-processing: markdown fixed, variables normalized`);

  return {
    original: instructions,
    enhanced: enhancedInstructions,
    originalLength: instructions.length,
    enhancedLength: enhancedInstructions.length,
    provider: providerResult.metadata.name,
    mode: mode,
  };
}

/**
 * POST /api/whatsapp/config/instructions/enhance
 * Enhance instructions without agentId (for create mode)
 */
router.post(
  "/whatsapp/config/instructions/enhance",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { instructions, bookingEnabled, mode } = req.body;

      const result = await enhanceInstructionsWithAI(
        consultantId, 
        instructions, 
        undefined, 
        bookingEnabled,
        mode || "enhance"
      );

      res.json({
        success: true,
        data: result,
        message: "Instructions enhanced successfully",
      });
    } catch (error: any) {
      console.error("❌ [AGENT INSTRUCTIONS] Error enhancing instructions (create mode):", error);
      
      // Map custom errors to appropriate HTTP status codes
      const statusCode = error instanceof ValidationError ? 400 
                       : error instanceof NotFoundError ? 404 
                       : 500;
      
      res.status(statusCode).json({
        success: false,
        error: error.message || "Failed to enhance instructions with AI",
      });
    }
  }
);

/**
 * POST /api/whatsapp/config/:agentId/instructions/enhance
 * Use AI to enhance and improve user-written instructions (with agent verification)
 */
router.post(
  "/whatsapp/config/:agentId/instructions/enhance",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      const consultantId = req.user!.id;
      const { instructions, bookingEnabled, mode } = req.body;

      const result = await enhanceInstructionsWithAI(
        consultantId, 
        instructions, 
        agentId, 
        bookingEnabled,
        mode || "enhance"
      );

      res.json({
        success: true,
        data: result,
        message: "Instructions enhanced successfully",
      });
    } catch (error: any) {
      console.error("❌ [AGENT INSTRUCTIONS] Error enhancing instructions:", error);
      
      // Map custom errors to appropriate HTTP status codes
      const statusCode = error instanceof ValidationError ? 400 
                       : error instanceof NotFoundError ? 404 
                       : 500;
      
      res.status(statusCode).json({
        success: false,
        error: error.message || "Failed to enhance instructions with AI",
      });
    }
  }
);

export default router;
