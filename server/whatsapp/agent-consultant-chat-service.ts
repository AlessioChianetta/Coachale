/**
 * WhatsApp Agent - Consultant Chat Service
 * Handles consultant-to-agent chat conversations for testing and configuration
 * Uses ONLY Vertex AI - NO Twilio integration (internal testing only)
 */

import { storage } from '../storage';
import { getAIProvider } from '../ai/provider-factory';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getMandatoryBookingBlock } from './instruction-blocks';

/**
 * Build system prompt for WhatsApp agent based on consultant configuration
 * Includes knowledge base items (documents + text) for enhanced AI responses
 */
async function buildWhatsAppAgentPrompt(agentConfig: any): Promise<string> {
  const businessName = agentConfig?.businessName || "il consulente";
  const agentName = agentConfig?.agentName || "Assistente WhatsApp";
  const businessDescription = agentConfig?.businessDescription || "servizi professionali";
  const agentType = agentConfig?.agentType || "informative";
  const aiPersonality = agentConfig?.aiPersonality || "professionale_empatico";
  const consultantDisplayName = agentConfig?.consultantDisplayName || null;
  const consultantBio = agentConfig?.consultantBio || null;
  const salesScript = agentConfig?.salesScript || null;
  
  // Get agent instructions if available
  const customInstructions = agentConfig?.agentInstructions || "";
  
  // Load knowledge base items for this agent
  const knowledgeItems = await db
    .select()
    .from(schema.whatsappAgentKnowledgeItems)
    .where(eq(schema.whatsappAgentKnowledgeItems.agentConfigId, agentConfig.id))
    .orderBy(asc(schema.whatsappAgentKnowledgeItems.order), asc(schema.whatsappAgentKnowledgeItems.createdAt));
  
  // Build Authority & Positioning section
  let authoritySection = '';
  if (agentConfig?.vision || agentConfig?.mission || agentConfig?.values?.length > 0 || agentConfig?.usp) {
    authoritySection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 AUTHORITY & POSIZIONAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${agentConfig.vision ? `
🔭 Vision:
${agentConfig.vision}
` : ''}${agentConfig.mission ? `
🎯 Mission:
${agentConfig.mission}
` : ''}${agentConfig.values && agentConfig.values.length > 0 ? `
💎 Valori:
${agentConfig.values.map((v: string) => `• ${v}`).join('\n')}
` : ''}${agentConfig.usp ? `
⭐ Unique Selling Proposition (USP):
${agentConfig.usp}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  // Build Who We Help section
  let targetAudienceSection = '';
  if (agentConfig?.whoWeHelp || agentConfig?.whoWeDontHelp || agentConfig?.whatWeDo || agentConfig?.howWeDoIt) {
    targetAudienceSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 CHI AIUTIAMO E COSA FACCIAMO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${agentConfig.whoWeHelp ? `
✅ Chi aiutiamo:
${agentConfig.whoWeHelp}
` : ''}${agentConfig.whoWeDontHelp ? `
❌ Chi NON aiutiamo:
${agentConfig.whoWeDontHelp}
` : ''}${agentConfig.whatWeDo ? `
💼 Cosa facciamo:
${agentConfig.whatWeDo}
` : ''}${agentConfig.howWeDoIt ? `
⚙️ Come lo facciamo:
${agentConfig.howWeDoIt}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  // Build Software & Books section
  let creationsSection = '';
  if (agentConfig?.softwareCreated?.length > 0 || agentConfig?.booksPublished?.length > 0) {
    creationsSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 SOFTWARE E PUBBLICAZIONI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${agentConfig.softwareCreated && agentConfig.softwareCreated.length > 0 ? `
💻 Software creati:
${agentConfig.softwareCreated.map((sw: any) => `• ${sw.name}${sw.description ? `: ${sw.description}` : ''}${sw.users ? ` (${sw.users} utenti)` : ''}`).join('\n')}
` : ''}${agentConfig.booksPublished && agentConfig.booksPublished.length > 0 ? `
📚 Libri pubblicati:
${agentConfig.booksPublished.map((book: any) => `• "${book.title}" (${book.year})${book.description ? `: ${book.description}` : ''}${book.link ? ` - ${book.link}` : ''}`).join('\n')}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  // Build Proof & Credibility section
  let credibilitySection = '';
  if (agentConfig?.yearsExperience || agentConfig?.clientsHelped || agentConfig?.resultsGenerated || agentConfig?.caseStudies?.length > 0) {
    credibilitySection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 CREDENZIALI & RISULTATI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${agentConfig.yearsExperience ? `📅 Anni di esperienza: ${agentConfig.yearsExperience}` : ''}
${agentConfig.clientsHelped ? `👥 Clienti aiutati: ${agentConfig.clientsHelped}` : ''}
${agentConfig.resultsGenerated ? `
📊 Risultati generati:
${agentConfig.resultsGenerated}
` : ''}${agentConfig.caseStudies && agentConfig.caseStudies.length > 0 ? `
📈 Case Studies:
${agentConfig.caseStudies.map((cs: any, idx: number) => `
${idx + 1}. ${cs.clientName ? `Cliente: ${cs.clientName} - ` : ''}Settore: ${cs.sector}
   Prima: ${cs.before}
   Dopo: ${cs.after}
   Tempo: ${cs.timeFrame}`).join('\n')}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  // Build Services & Guarantees section
  let servicesSection = '';
  if (agentConfig?.servicesOffered?.length > 0 || agentConfig?.guarantees) {
    servicesSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💼 SERVIZI E GARANZIE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${agentConfig.servicesOffered && agentConfig.servicesOffered.length > 0 ? `
📦 Servizi offerti:
${agentConfig.servicesOffered.map((svc: any, idx: number) => `
${idx + 1}. ${svc.name}
   Descrizione: ${svc.description}
   Per chi: ${svc.forWho}
   Investimento: ${svc.investment}`).join('\n')}
` : ''}${agentConfig.guarantees ? `
✅ Garanzie:
${agentConfig.guarantees}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  // Build Consultant Profile section
  let consultantProfileSection = '';
  if (consultantDisplayName || consultantBio || salesScript) {
    consultantProfileSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 PROFILO CONSULENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${consultantDisplayName ? `📛 Nome da mostrare: ${consultantDisplayName}` : ''}
${consultantBio ? `
📝 Bio:
${consultantBio}
` : ''}${salesScript ? `
💬 Sales Script:
${salesScript}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }
  
  // Build knowledge base section if items exist
  let knowledgeBaseSection = '';
  if (knowledgeItems.length > 0) {
    knowledgeBaseSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 KNOWLEDGE BASE AZIENDALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hai accesso ai seguenti documenti e informazioni aziendali.
Usa queste informazioni per rispondere con precisione alle domande.

${knowledgeItems.map((item, index) => {
  const typeEmoji = item.type === 'text' ? '📝' : item.type === 'pdf' ? '📄' : item.type === 'docx' ? '📄' : '📄';
  const typeLabel = item.type.toUpperCase();
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${typeEmoji} DOCUMENTO ${index + 1}: "${item.title}" (Tipo: ${typeLabel})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${item.content}
`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IMPORTANTE: Quando rispondi basandoti su questi documenti,
cita sempre la fonte menzionando il titolo del documento.
Esempio: "Secondo il documento 'Listino Prezzi 2024'..."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }
  
  const today = new Date();
  const todayFormatter = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome'
  });
  const parts = todayFormatter.formatToParts(today);
  const todayWeekday = parts.find(p => p.type === 'weekday')?.value || '';
  const todayDay = parts.find(p => p.type === 'day')?.value || '';
  const todayMonth = parts.find(p => p.type === 'month')?.value || '';
  const todayYear = parts.find(p => p.type === 'year')?.value || '';
  const formattedToday = `${todayWeekday} ${todayDay} ${todayMonth} ${todayYear}`;
  
  const prompt = `Sei ${agentName}, l'assistente WhatsApp AI di ${businessName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 DATA E ORA CORRENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗓️ OGGI È: ${formattedToday}
⏰ ORA: ${today.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })}
⚠️ USA SEMPRE QUESTA DATA COME RIFERIMENTO PER QUALSIASI APPUNTAMENTO O EVENTO!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 IL TUO RUOLO E IDENTITÀ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Business: ${businessName}
💼 Servizi: ${businessDescription}
🤖 Tipo Agente: ${agentType}
🎭 Personalità: ${aiPersonality}

${customInstructions ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 ISTRUZIONI PERSONALIZZATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${customInstructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}${authoritySection}${targetAudienceSection}${creationsSection}${credibilitySection}${servicesSection}${consultantProfileSection}${knowledgeBaseSection}
📌 ISTRUZIONI:
- Rispondi SEMPRE in italiano
- Usa messaggi brevi e concisi (stile WhatsApp)
- Mantieni la personalità: ${aiPersonality}
- Comportati come tipo: ${agentType}
`;

  return prompt;
}

/**
 * Process consultant-agent chat message and generate AI response
 * 
 * @param consultantId - ID of the consultant
 * @param conversationId - ID of the conversation
 * @param messageContent - Content of the message from consultant
 * @param pendingModification - Context for pending booking modifications
 * @param bookingContext - Context for available slots and existing appointment
 * @returns AsyncGenerator yielding text chunks from AI
 */
export interface PendingModificationContext {
  intent: 'MODIFY' | 'CANCEL';
  newDate?: string;
  newTime?: string;
  confirmedTimes: number;
  requiredConfirmations: number;
}

export interface BookingContext {
  availableSlots?: any[];
  existingAppointment?: {
    id: string;
    date: string;
    time: string;
    email: string;
    phone: string;
  };
  timezone?: string;
}

export async function* processConsultantAgentMessage(
  consultantId: string,
  conversationId: string,
  messageContent: string,
  pendingModification?: PendingModificationContext,
  bookingContext?: BookingContext
): AsyncGenerator<string, void, unknown> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 [CONSULTANT-AGENT CHAT] Processing message');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`👤 Consultant: ${consultantId}`);
  console.log(`💬 Conversation: ${conversationId}`);
  console.log(`📝 Message: "${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}"`);

  try {
    // Step 1: Fetch and verify conversation
    console.log('\n📥 [STEP 1] Fetching conversation...');
    const [conversation] = await db
      .select()
      .from(schema.whatsappAgentConsultantConversations)
      .where(
        and(
          eq(schema.whatsappAgentConsultantConversations.id, conversationId),
          eq(schema.whatsappAgentConsultantConversations.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!conversation) {
      const errorMsg = 'Conversation not found or access denied';
      console.error(`❌ [ERROR] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`✅ Conversation found: "${conversation.title || 'Untitled'}"`);
    console.log(`🔧 Agent Config ID: ${conversation.agentConfigId}`);

    // Step 2: Fetch WhatsApp agent configuration
    console.log('\n📥 [STEP 2] Fetching agent configuration...');
    const [agentConfig] = await db
      .select()
      .from(schema.consultantWhatsappConfig)
      .where(eq(schema.consultantWhatsappConfig.id, conversation.agentConfigId))
      .limit(1);

    if (!agentConfig) {
      const errorMsg = 'Agent configuration not found';
      console.error(`❌ [ERROR] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`✅ Agent Config: ${agentConfig.agentName}`);
    console.log(`   Business: ${agentConfig.businessName}`);
    console.log(`   Type: ${agentConfig.agentType}`);
    console.log(`   Personality: ${agentConfig.aiPersonality}`);

    // Step 3: Retrieve conversation history
    console.log('\n📚 [STEP 3] Retrieving conversation history...');
    const messages = await storage.getConsultantAgentMessages(conversationId, consultantId);
    console.log(`✅ Found ${messages.length} historical messages`);

    // Step 4: Format conversation history for Gemini
    console.log('\n🔄 [STEP 4] Formatting conversation history...');
    const geminiMessages = messages.map((msg) => ({
      role: msg.role === 'consultant' ? ('user' as const) : ('model' as const),
      parts: [{ text: msg.content }],
    }));
    console.log(`✅ Formatted ${geminiMessages.length} messages for AI`);

    // Step 5: Build system prompt
    console.log('\n📝 [STEP 5] Building system prompt (loading knowledge base)...');
    let systemPrompt = await buildWhatsAppAgentPrompt(agentConfig);
    
    // Add pending modification context if present
    if (pendingModification) {
      console.log(`\n📅 [PENDING MODIFICATION] Adding context to prompt...`);
      console.log(`   Intent: ${pendingModification.intent}`);
      console.log(`   New Date: ${pendingModification.newDate || 'N/A'}`);
      console.log(`   New Time: ${pendingModification.newTime || 'N/A'}`);
      console.log(`   Confirmations: ${pendingModification.confirmedTimes}/${pendingModification.requiredConfirmations}`);
      
      // Build different prompts for MODIFY vs CANCEL
      let pendingModificationPrompt: string;
      
      if (pendingModification.intent === 'MODIFY') {
        pendingModificationPrompt = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ AZIONE PENDENTE - RICHIEDI CONFERMA MODIFICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Il lead ha richiesto una MODIFICA dell'appuntamento.
Nuova data/ora richiesta: ${pendingModification.newDate} alle ${pendingModification.newTime}

📊 STATO CONFERME: ${pendingModification.confirmedTimes}/${pendingModification.requiredConfirmations}

⚠️ ISTRUZIONE CRITICA:
Devi CHIEDERE CONFERMA ESPLICITA al lead prima che il sistema possa procedere.

Esempio di risposta CORRETTA:
"Perfetto! Allora confermi che vuoi spostare l'appuntamento a ${pendingModification.newDate?.split('-').reverse().join('/')} alle ${pendingModification.newTime}? 📅"

❌ NON dire "Sto modificando" o "Ho modificato" - devi SOLO chiedere conferma!
❌ NON procedere senza una risposta esplicita del lead ("sì", "confermo", "va bene")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
      } else {
        // CANCEL - requires 2 confirmations
        const isFirstConfirmation = pendingModification.confirmedTimes === 0;
        const isSecondConfirmation = pendingModification.confirmedTimes === 1;
        
        pendingModificationPrompt = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ AZIONE PENDENTE - CANCELLAZIONE APPUNTAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Il lead ha richiesto la CANCELLAZIONE dell'appuntamento.

📊 STATO CONFERME: ${pendingModification.confirmedTimes}/${pendingModification.requiredConfirmations}
🔒 LA CANCELLAZIONE RICHIEDE 2 CONFERME ESPLICITE

${isFirstConfirmation ? `
🔴 MANCA LA PRIMA CONFERMA
Il lead ha solo RICHIESTO di cancellare, ma NON ha ancora confermato.

✅ COSA DEVI FARE:
Chiedi la PRIMA conferma con un messaggio persuasivo che includa frizione:

"[NOME], capisco che possano esserci imprevisti.
Prima di procedere, lascia che ti ricordi qualcosa di importante 💭
- Da dove sei partito/a: [situazione]
- Dove vuoi arrivare: [obiettivo]
- Perché è importante: [motivazione]

Questo appuntamento è la tua opportunità per fare il primo passo concreto.
Quindi, mi confermi che vuoi davvero cancellare l'appuntamento?"
` : ''}

${isSecondConfirmation ? `
🟡 HAI RICEVUTO 1 CONFERMA - MANCA LA SECONDA
Il lead ha già confermato UNA volta. Ora devi chiedere la SECONDA conferma finale.

✅ COSA DEVI FARE:
Chiedi la SECONDA conferma finale:

"Sei sicuro? Una volta cancellato, potrebbe volerci tempo per trovare un altro slot disponibile.
Confermi definitivamente la cancellazione?"

⚠️ NON procedere finché il lead non conferma esplicitamente questa seconda richiesta!
` : ''}

🚨 REGOLE CRITICHE CANCELLAZIONE:
❌ NON dire MAI "ho cancellato" o "appuntamento cancellato" - il sistema lo farà AUTOMATICAMENTE dopo 2 conferme
❌ NON dire "procedo con la cancellazione" - devi SOLO chiedere conferma
❌ NON assumere che la richiesta iniziale sia una conferma
✅ DEVI ricevere 2 risposte esplicite ("sì", "confermo", "ok") DOPO che hai chiesto conferma

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
      }
      systemPrompt += pendingModificationPrompt;
    }
    
    // Add booking context (available slots and/or existing appointment) if present
    if (bookingContext && (bookingContext.availableSlots?.length || bookingContext.existingAppointment)) {
      console.log(`\n📅 [BOOKING CONTEXT] Adding slot/appointment context to prompt...`);
      if (bookingContext.availableSlots?.length) {
        console.log(`   📅 Available slots: ${bookingContext.availableSlots.length}`);
      }
      if (bookingContext.existingAppointment) {
        console.log(`   ✅ Existing appointment: ${bookingContext.existingAppointment.date} ${bookingContext.existingAppointment.time}`);
      }
      
      // Format today's date for the slot context
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: bookingContext.timezone || 'Europe/Rome',
        hour12: false
      });
      const formattedToday = formatter.format(now);
      
      const bookingBlock = getMandatoryBookingBlock({
        existingAppointment: bookingContext.existingAppointment,
        availableSlots: bookingContext.availableSlots,
        timezone: bookingContext.timezone || 'Europe/Rome',
        formattedToday
      });
      
      systemPrompt += bookingBlock;
    }
    
    const promptLength = systemPrompt.length;
    console.log(`✅ System prompt built: ${promptLength} characters (~${Math.ceil(promptLength / 4)} tokens)`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 SYSTEM PROMPT COMPLETO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(systemPrompt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 6: Get AI provider (Vertex AI)
    console.log('\n🔌 [STEP 6] Getting AI provider...');
    const aiProvider = await getAIProvider(consultantId, consultantId);
    console.log(`✅ AI Provider obtained: ${aiProvider.source} (${aiProvider.metadata.provider})`);

    // Step 7: Generate streaming AI response
    console.log('\n🤖 [STEP 7] Generating AI response (streaming)...');
    console.log(`📊 Input - History: ${geminiMessages.length} messages, New message: "${messageContent.substring(0, 50)}..."`);

    const streamResult = await aiProvider.client.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [
        ...geminiMessages,
        {
          role: 'user',
          parts: [{ text: messageContent }],
        },
      ],
      generationConfig: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });

    console.log('✅ Stream initialized, yielding chunks...');

    // Step 8: Stream response chunks
    let chunkCount = 0;
    let totalChars = 0;

    for await (const chunk of streamResult) {
      if (chunk.text) {
        chunkCount++;
        totalChars += chunk.text.length;
        yield chunk.text;
      }
    }

    console.log(`\n✅ [SUCCESS] Streaming complete`);
    console.log(`   Chunks: ${chunkCount}`);
    console.log(`   Total characters: ${totalChars}`);
    console.log(`   Estimated tokens: ~${Math.ceil(totalChars / 4)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Cleanup if needed
    if (aiProvider.cleanup) {
      await aiProvider.cleanup();
    }

  } catch (error: any) {
    console.error('\n❌ [ERROR] Failed to process consultant-agent message');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    throw new Error(`Failed to process message: ${error.message}`);
  }
}

/**
 * Generate a short conversation title from the first message
 * Uses Vertex AI to create a concise 3-5 word title
 * 
 * @param firstMessage - The first message in the conversation
 * @param consultantId - ID of the consultant (for AI provider)
 * @returns Promise<string> - Generated title
 */
export async function generateConversationTitle(
  firstMessage: string,
  consultantId: string
): Promise<string> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏷️  [TITLE GENERATION] Creating conversation title');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📝 First message: "${firstMessage.substring(0, 100)}${firstMessage.length > 100 ? '...' : ''}"`);

  try {
    // Get AI provider
    console.log('🔌 Getting AI provider...');
    const aiProvider = await getAIProvider(consultantId, consultantId);
    console.log(`✅ AI Provider: ${aiProvider.source}`);

    // Generate title
    console.log('🤖 Generating title...');
    const response = await aiProvider.client.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{
            text: `Genera un titolo breve di 3-5 parole per questa conversazione basato sul primo messaggio.
Rispondi SOLO con il titolo, niente altro.

Primo messaggio: "${firstMessage}"

Esempi di buoni titoli:
- "Test risposta lead"
- "Verifica tono empatico"
- "Simulazione cliente difficile"
- "Prova presa appuntamento"

Titolo:`
          }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 20,
      },
    });

    // Extract text from response (handles different response structures)
    let title: string;
    if (typeof response.response?.text === 'function') {
      title = response.response.text();
    } else if (typeof response.text === 'function') {
      title = response.text();
    } else if (response.text) {
      title = response.text;
    } else if (response.response?.text) {
      title = response.response.text;
    } else {
      throw new Error('Failed to extract text from Vertex AI response');
    }
    
    title = title.trim();
    console.log(`✅ Title generated: "${title}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Cleanup if needed
    if (aiProvider.cleanup) {
      await aiProvider.cleanup();
    }

    return title;

  } catch (error: any) {
    console.error('❌ [ERROR] Failed to generate conversation title');
    console.error(`   Error: ${error.message}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Fallback to truncated first message
    const fallbackTitle = firstMessage.substring(0, 30).trim() + '...';
    console.log(`⚠️  Using fallback title: "${fallbackTitle}"`);
    return fallbackTitle;
  }
}
