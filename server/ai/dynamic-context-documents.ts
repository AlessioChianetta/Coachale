/**
 * Dynamic Context Documents Service
 * 
 * Generates and syncs dynamic documents to File Search for comprehensive AI context:
 * - WhatsApp conversation history (complete messages, not cropped)
 * - Proactive Lead Hub metrics (per agent, templates used, appointments)
 * - AI limitations document (what the assistant can and cannot do)
 * - Operational context documents (clients, states, templates, config, etc.)
 * 
 * These documents complement the real-time context-builder data,
 * providing deep historical context for RAG queries.
 */

import { db } from "../db";
import {
  whatsappConversations,
  whatsappMessages,
  proactiveLeads,
  consultantWhatsappConfig,
  marketingCampaigns,
  users,
  consultations,
  fileSearchStores,
  clientStateTracking,
  exerciseAssignments,
  exercises,
  exerciseSubmissions,
  consultantSmtpSettings,
  calendarEvents,
  emailDrafts,
  schedulerExecutionLog,
  emailJourneyTemplates,
  externalApiConfigs,
  consultationTasks,
  whatsappCustomTemplates,
  whatsappTemplateVersions,
  goals,
} from "../../shared/schema";
import { eq, and, desc, gte, sql, count as sqlCount, inArray, asc } from "drizzle-orm";
import { FileSearchService } from "./file-search-service";
import { formatInTimeZone } from "date-fns-tz";

const fileSearchService = new FileSearchService();

export interface DynamicDocumentResult {
  success: boolean;
  documentId?: string;
  error?: string;
  tokensEstimate?: number;
}

export interface SyncResult {
  conversationHistory: DynamicDocumentResult;
  leadHubMetrics: DynamicDocumentResult;
  aiLimitations: DynamicDocumentResult;
  clientsOverview?: DynamicDocumentResult;
  clientStates?: DynamicDocumentResult;
  whatsappTemplates?: DynamicDocumentResult;
  twilioTemplates?: DynamicDocumentResult;
  consultantConfig?: DynamicDocumentResult;
  emailMarketing?: DynamicDocumentResult;
  campaigns?: DynamicDocumentResult;
  calendar?: DynamicDocumentResult;
  exercisesPending?: DynamicDocumentResult;
  consultationsDoc?: DynamicDocumentResult;
  totalDocuments: number;
  syncedAt: Date;
}

export interface OperationalSettings {
  clients?: boolean;
  clientStates?: boolean;
  whatsappTemplates?: boolean;
  twilioTemplates?: boolean;
  config?: boolean;
  email?: boolean;
  campaigns?: boolean;
  calendar?: boolean;
  exercisesPending?: boolean;
  consultations?: boolean;
}

function formatItalianDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "N/A";
    return formatInTimeZone(d, "Europe/Rome", "dd/MM/yyyy HH:mm");
  } catch {
    return "N/A";
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate complete WhatsApp conversation history document
 * Includes: all messages, phone numbers, timestamps, templates used, sender type
 * 
 * NOTE: Limited to 200 most recent conversations to keep document size manageable
 * for File Search indexing (~50k token limit per document recommended)
 */
export async function generateConversationHistoryDocument(consultantId: string): Promise<string> {
  console.log(`📄 [ConvHistory] Starting for consultant ${consultantId.substring(0, 8)}...`);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  console.log(`📄 [ConvHistory] Querying conversations since ${thirtyDaysAgo.toISOString()}...`);
  
  let conversations: {
    id: string;
    phoneNumber: string | null;
    agentConfigId: string | null;
    isLead: boolean | null;
    lastMessageAt: Date | null;
    messageCount: number | null;
  }[] = [];
  
  try {
    conversations = await db
      .select({
        id: whatsappConversations.id,
        phoneNumber: whatsappConversations.phoneNumber,
        agentConfigId: whatsappConversations.agentConfigId,
        isLead: whatsappConversations.isLead,
        lastMessageAt: whatsappConversations.lastMessageAt,
        messageCount: whatsappConversations.messageCount,
      })
      .from(whatsappConversations)
      .where(
        and(
          eq(whatsappConversations.consultantId, consultantId),
          gte(whatsappConversations.lastMessageAt, thirtyDaysAgo)
        )
      )
      .orderBy(desc(whatsappConversations.lastMessageAt))
      .limit(200);
  } catch (queryError: any) {
    console.error(`📄 [ConvHistory] Query error:`, queryError.message);
    throw queryError;
  }

  console.log(`📄 [ConvHistory] Found ${conversations.length} conversations`);

  if (conversations.length === 0) {
    return `# Storico Conversazioni WhatsApp

Nessuna conversazione negli ultimi 30 giorni.

Generato il: ${formatItalianDate(new Date())}
`;
  }

  const conversationIds = conversations.map((c) => c.id).filter(Boolean);
  console.log(`📄 [ConvHistory] Valid conversation IDs: ${conversationIds.length}`);

  let messages: {
    id: string;
    conversationId: string;
    messageText: string | null;
    sender: string | null;
    twilioStatus: string | null;
    createdAt: Date | null;
  }[] = [];

  if (conversationIds.length > 0) {
    messages = await db
      .select({
        id: whatsappMessages.id,
        conversationId: whatsappMessages.conversationId,
        messageText: whatsappMessages.messageText,
        sender: whatsappMessages.sender,
        twilioStatus: whatsappMessages.twilioStatus,
        createdAt: whatsappMessages.createdAt,
      })
      .from(whatsappMessages)
      .where(inArray(whatsappMessages.conversationId, conversationIds))
      .orderBy(whatsappMessages.createdAt);
  }

  const agents = await db
    .select({
      id: consultantWhatsappConfig.id,
      agentName: consultantWhatsappConfig.agentName,
    })
    .from(consultantWhatsappConfig)
    .where(eq(consultantWhatsappConfig.consultantId, consultantId));

  const agentMap = new Map(agents.map((a) => [a.id, a.agentName]));

  const messagesByConversation = new Map<string, typeof messages>();
  for (const msg of messages) {
    if (!messagesByConversation.has(msg.conversationId)) {
      messagesByConversation.set(msg.conversationId, []);
    }
    messagesByConversation.get(msg.conversationId)!.push(msg);
  }

  let document = `# Storico Completo Conversazioni WhatsApp
## Ultimi 30 Giorni - ${conversations.length} Conversazioni

Questo documento contiene lo storico completo delle conversazioni WhatsApp,
inclusi numeri di telefono, messaggi, template utilizzati e orari di invio.

---

`;

  for (const conv of conversations) {
    const convMessages = messagesByConversation.get(conv.id) || [];
    const agentName = conv.agentConfigId ? agentMap.get(conv.agentConfigId) || "Sconosciuto" : "Nessun Agente";

    document += `## Conversazione: ${conv.phoneNumber}
- **Agente**: ${agentName}
- **Lead**: ${conv.isLead ? "Sì" : "No"}
- **Messaggi totali**: ${conv.messageCount || convMessages.length}
- **Ultimo messaggio**: ${formatItalianDate(conv.lastMessageAt)}

### Messaggi:
`;

    if (convMessages.length === 0) {
      document += `_Nessun messaggio disponibile_\n\n`;
    } else {
      for (const msg of convMessages) {
        const senderLabel = msg.sender === "user" ? "👤 Cliente" : "🤖 AI/Consulente";
        const statusInfo = msg.twilioStatus ? ` (${msg.twilioStatus})` : "";

        document += `**${formatItalianDate(msg.createdAt)}** - ${senderLabel}${statusInfo}
> ${msg.messageText || "_messaggio vuoto_"}

`;
      }
    }

    document += `---

`;
  }

  document += `
## Statistiche Riepilogo
- **Conversazioni analizzate**: ${conversations.length}
- **Messaggi totali**: ${messages.length}
- **Agenti coinvolti**: ${[...new Set(conversations.filter((c) => c.agentConfigId).map((c) => agentMap.get(c.agentConfigId!) || "Sconosciuto"))].join(", ") || "Nessuno"}

Generato il: ${formatItalianDate(new Date())}
`;

  return document;
}

/**
 * Generate Proactive Lead Hub metrics document
 * Includes: contacts per agent, templates used, appointments, response rates
 */
export async function generateLeadHubMetricsDocument(consultantId: string): Promise<string> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const leads = await db
    .select()
    .from(proactiveLeads)
    .where(eq(proactiveLeads.consultantId, consultantId))
    .orderBy(desc(proactiveLeads.lastContactedAt));

  const agents = await db
    .select({
      id: consultantWhatsappConfig.id,
      agentName: consultantWhatsappConfig.agentName,
      agentType: consultantWhatsappConfig.agentType,
      isActive: consultantWhatsappConfig.isActive,
    })
    .from(consultantWhatsappConfig)
    .where(eq(consultantWhatsappConfig.consultantId, consultantId));

  const campaigns = await db
    .select({
      id: marketingCampaigns.id,
      campaignName: marketingCampaigns.campaignName,
      campaignType: marketingCampaigns.campaignType,
    })
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.consultantId, consultantId));

  const appointmentsCount = await db
    .select({ count: sqlCount() })
    .from(consultations)
    .where(
      and(
        eq(consultations.consultantId, consultantId),
        gte(consultations.scheduledAt, thirtyDaysAgo)
      )
    );

  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

  const leadsByAgent = new Map<string, typeof leads>();
  const leadsByCampaign = new Map<string, typeof leads>();
  const leadsByStatus = new Map<string, number>();
  const leadsByCategory = new Map<string, number>();

  for (const lead of leads) {
    const agentId = lead.agentConfigId || "none";
    if (!leadsByAgent.has(agentId)) leadsByAgent.set(agentId, []);
    leadsByAgent.get(agentId)!.push(lead);

    const campaignId = lead.campaignId || "none";
    if (!leadsByCampaign.has(campaignId)) leadsByCampaign.set(campaignId, []);
    leadsByCampaign.get(campaignId)!.push(lead);

    const status = lead.status || "unknown";
    leadsByStatus.set(status, (leadsByStatus.get(status) || 0) + 1);

    const category = lead.leadCategory || "unknown";
    leadsByCategory.set(category, (leadsByCategory.get(category) || 0) + 1);
  }

  let document = `# Metriche Hub Lead Proattivo
## Report Completo - ${leads.length} Lead Totali

Questo documento contiene le metriche dettagliate del sistema di gestione lead proattivo,
incluse statistiche per agente, campagna, template utilizzati e appuntamenti fissati.

---

## 📊 Panoramica Generale

| Metrica | Valore |
|---------|--------|
| Lead totali | ${leads.length} |
| Agenti configurati | ${agents.length} |
| Campagne attive | ${campaigns.length} |
| Appuntamenti (30gg) | ${appointmentsCount[0]?.count || 0} |

---

## 👥 Statistiche per Agente

`;

  for (const [agentId, agentLeads] of leadsByAgent) {
    const agent = agentId !== "none" ? agentMap.get(agentId) : null;
    const agentName = agent?.agentName || "Senza Agente";
    const agentType = agent?.agentType || "N/A";
    const isActive = agent?.isActive ? "Attivo" : "Inattivo";

    const contacted = agentLeads.filter((l) => l.status === "contacted").length;
    const responded = agentLeads.filter((l) => l.status === "responded").length;
    const converted = agentLeads.filter((l) => l.status === "converted").length;
    const responseRate = contacted > 0 ? Math.round((responded / contacted) * 100) : 0;
    const conversionRate = agentLeads.length > 0 ? Math.round((converted / agentLeads.length) * 100) : 0;

    document += `### ${agentName}
- **Tipo**: ${agentType}
- **Stato**: ${isActive}
- **Lead assegnati**: ${agentLeads.length}
- **Contattati**: ${contacted}
- **Risposte ricevute**: ${responded} (${responseRate}%)
- **Convertiti**: ${converted} (${conversionRate}%)

`;
  }

  document += `---

## 📧 Statistiche per Campagna

`;

  for (const [campaignId, campaignLeads] of leadsByCampaign) {
    const campaign = campaignId !== "none" ? campaignMap.get(campaignId) : null;
    const campaignName = campaign?.campaignName || "Senza Campagna";
    const campaignType = campaign?.campaignType || "N/A";

    const converted = campaignLeads.filter((l) => l.status === "converted").length;
    const conversionRate = campaignLeads.length > 0 ? Math.round((converted / campaignLeads.length) * 100) : 0;

    document += `### ${campaignName}
- **Tipo**: ${campaignType}
- **Lead totali**: ${campaignLeads.length}
- **Convertiti**: ${converted} (${conversionRate}%)

`;
  }

  document += `---

## 📈 Distribuzione per Stato

| Stato | Quantità | Percentuale |
|-------|----------|-------------|
`;

  for (const [status, count] of leadsByStatus) {
    const percentage = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
    document += `| ${status} | ${count} | ${percentage}% |\n`;
  }

  document += `
---

## 🎯 Distribuzione per Categoria

| Categoria | Quantità | Percentuale |
|-----------|----------|-------------|
`;

  for (const [category, count] of leadsByCategory) {
    const percentage = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
    document += `| ${category} | ${count} | ${percentage}% |\n`;
  }

  document += `
---

## 📱 Ultimi Lead Contattati

| Nome | Telefono | Campagna | Agente | Stato | Ultimo Contatto |
|------|----------|----------|--------|-------|-----------------|
`;

  const recentLeads = leads.slice(0, 20);
  for (const lead of recentLeads) {
    const agent = lead.agentConfigId ? agentMap.get(lead.agentConfigId) : null;
    const campaign = lead.campaignId ? campaignMap.get(lead.campaignId) : null;

    document += `| ${lead.firstName || ""} ${lead.lastName || ""} | ${lead.phoneNumber} | ${campaign?.campaignName || "N/A"} | ${agent?.agentName || "N/A"} | ${lead.status || "N/A"} | ${formatItalianDate(lead.lastContactedAt)} |\n`;
  }

  document += `
---

Generato il: ${formatItalianDate(new Date())}
`;

  return document;
}

/**
 * Generate AI limitations document
 * Explains what the AI assistant can and cannot do
 */
export function generateAILimitationsDocument(): string {
  return `# Limitazioni e Capacità dell'Assistente AI

Questo documento descrive cosa l'Assistente AI può e non può fare all'interno della piattaforma.

---

## ✅ Cosa Posso Fare

### Analisi e Consulenza
- Analizzare i dati dei tuoi lead e clienti
- Fornire insights sulle performance delle campagne
- Suggerire strategie di follow-up basate sui dati
- Rispondere a domande sulla piattaforma e le sue funzionalità

### Gestione Template
- Visualizzare i template WhatsApp esistenti
- Suggerire modifiche ai template
- Aiutarti a creare nuovi contenuti per i template
- Analizzare l'efficacia dei template in uso

### Reportistica
- Generare report sulle metriche dei lead
- Analizzare trend di conversione
- Confrontare performance tra agenti e campagne
- Identificare opportunità di miglioramento

### Knowledge Base
- Cercare informazioni nei documenti caricati
- Rispondere a domande basate sulla knowledge base
- Suggerire contenuti rilevanti per i clienti

---

## ❌ Cosa NON Posso Fare

### Controllo Altri Sistemi AI
- **Non posso controllare o modificare gli agenti AI WhatsApp**
  - Gli agenti AI (DOT, Millie, Echo, etc.) operano autonomamente
  - Non ho accesso diretto alle loro conversazioni in tempo reale
  - Non posso interrompere o modificare le loro risposte

### Azioni Dirette
- **Non posso inviare messaggi WhatsApp**
  - Posso solo suggerirti cosa scrivere
  - L'invio deve essere fatto manualmente o tramite gli agenti automatici

- **Non posso modificare dati sensibili**
  - Non posso cambiare numeri di telefono dei lead
  - Non posso eliminare conversazioni o lead
  - Non posso accedere a dati di altri consulenti

### Integrazioni Esterne
- **Non posso connettermi a sistemi esterni**
  - Non ho accesso a WhatsApp Business API direttamente
  - Non posso verificare lo stato delle connessioni Twilio
  - Non posso accedere a sistemi CRM esterni

---

## 🔄 Come Funziona il Sistema

### Flusso delle Informazioni
1. I dati vengono raccolti dalla piattaforma in tempo reale
2. Le metriche vengono aggregate e rese disponibili per l'analisi
3. Io posso leggere questi dati e fornirti insights
4. Le azioni devono essere eseguite attraverso l'interfaccia utente

### Aggiornamento Contesto
- Il mio contesto viene aggiornato periodicamente
- Alcune informazioni potrebbero avere un ritardo di alcuni minuti
- Per dati in tempo reale, consulta direttamente le sezioni della piattaforma

---

## 💡 Come Ottenere il Meglio

### Domande Efficaci
- Chiedi analisi specifiche: "Qual è il tasso di conversione degli ultimi 7 giorni?"
- Richiedi suggerimenti: "Come posso migliorare le risposte dei lead freddi?"
- Esplora i dati: "Mostrami le conversazioni più lunghe di questa settimana"

### Limitazioni da Ricordare
- Non posso agire al tuo posto, solo consigliarti
- Non ho memoria delle sessioni precedenti (usa i documenti salvati)
- Le mie analisi si basano sui dati disponibili nella piattaforma

---

Ultimo aggiornamento: ${formatItalianDate(new Date())}
`;
}

// ============================================================
// OPERATIONAL CONTEXT DOCUMENT GENERATORS (10 new generators)
// ============================================================

/**
 * 1. Generate Clients Overview document
 * Includes: name, email, level, enrolledAt, exercise stats per client
 */
export async function generateClientsOverviewDocument(consultantId: string): Promise<string> {
  console.log(`📄 [ClientsOverview] Generazione per consulente ${consultantId.substring(0, 8)}...`);

  try {
    const clientsList = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        level: users.level,
        enrolledAt: users.enrolledAt,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          eq(users.consultantId, consultantId),
          eq(users.role, "client")
        )
      )
      .orderBy(asc(users.firstName));

    console.log(`📄 [ClientsOverview] Trovati ${clientsList.length} clienti`);

    if (clientsList.length === 0) {
      return `# Panoramica Clienti\n\nNessun cliente registrato.\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    }

    const clientIds = clientsList.map(c => c.id);

    const allAssignments = await db
      .select({
        clientId: exerciseAssignments.clientId,
        status: exerciseAssignments.status,
      })
      .from(exerciseAssignments)
      .where(
        and(
          eq(exerciseAssignments.consultantId, consultantId),
          inArray(exerciseAssignments.clientId, clientIds)
        )
      );

    const stateTrackingRows = await db
      .select({
        clientId: clientStateTracking.clientId,
        lastUpdated: clientStateTracking.lastUpdated,
      })
      .from(clientStateTracking)
      .where(eq(clientStateTracking.consultantId, consultantId));

    const stateMap = new Map(stateTrackingRows.map(s => [s.clientId, s.lastUpdated]));

    const assignmentsByClient = new Map<string, { assigned: number; completed: number; pending: number; submitted: number }>();
    for (const a of allAssignments) {
      if (!assignmentsByClient.has(a.clientId)) {
        assignmentsByClient.set(a.clientId, { assigned: 0, completed: 0, pending: 0, submitted: 0 });
      }
      const stats = assignmentsByClient.get(a.clientId)!;
      stats.assigned++;
      if (a.status === "completed") stats.completed++;
      else if (a.status === "pending" || a.status === "in_progress") stats.pending++;
      else if (a.status === "submitted" || a.status === "in_review") stats.submitted++;
    }

    let document = `# Panoramica Clienti
## ${clientsList.length} Clienti Totali

Questo documento contiene la panoramica completa di tutti i clienti del consulente,
con statistiche sugli esercizi assegnati, completati e in attesa.

---

`;

    for (const client of clientsList) {
      const stats = assignmentsByClient.get(client.id) || { assigned: 0, completed: 0, pending: 0, submitted: 0 };
      const completionRate = stats.assigned > 0 ? Math.round((stats.completed / stats.assigned) * 100) : 0;
      const lastActivity = stateMap.get(client.id);

      document += `### ${client.firstName} ${client.lastName}
- **Email**: ${client.email}
- **Livello**: ${client.level || "studente"}
- **Stato**: ${client.isActive ? "Attivo" : "Inattivo"}
- **Iscritto il**: ${formatItalianDate(client.enrolledAt)}
- **Ultima attività**: ${formatItalianDate(lastActivity)}
- **Esercizi assegnati**: ${stats.assigned}
- **Esercizi completati**: ${stats.completed} (${completionRate}%)
- **Esercizi in attesa**: ${stats.pending}
- **Esercizi da revisionare**: ${stats.submitted}

`;
    }

    document += `---

## Statistiche Riepilogo
- **Clienti totali**: ${clientsList.length}
- **Clienti attivi**: ${clientsList.filter(c => c.isActive).length}
- **Clienti inattivi**: ${clientsList.filter(c => !c.isActive).length}

Generato il: ${formatItalianDate(new Date())}
`;

    return document;
  } catch (error: any) {
    console.error(`❌ [ClientsOverview] Errore:`, error.message);
    throw error;
  }
}

/**
 * 2. Generate Client States document
 * Includes: currentState, idealState, benefits, obstacles, actions, vision, motivations
 */
export async function generateClientStatesDocument(consultantId: string): Promise<string> {
  console.log(`📄 [ClientStates] Generazione per consulente ${consultantId.substring(0, 8)}...`);

  try {
    const states = await db
      .select({
        id: clientStateTracking.id,
        clientId: clientStateTracking.clientId,
        currentState: clientStateTracking.currentState,
        idealState: clientStateTracking.idealState,
        internalBenefit: clientStateTracking.internalBenefit,
        externalBenefit: clientStateTracking.externalBenefit,
        mainObstacle: clientStateTracking.mainObstacle,
        pastAttempts: clientStateTracking.pastAttempts,
        currentActions: clientStateTracking.currentActions,
        futureVision: clientStateTracking.futureVision,
        motivationDrivers: clientStateTracking.motivationDrivers,
        lastUpdated: clientStateTracking.lastUpdated,
        clientFirstName: users.firstName,
        clientLastName: users.lastName,
      })
      .from(clientStateTracking)
      .leftJoin(users, eq(clientStateTracking.clientId, users.id))
      .where(eq(clientStateTracking.consultantId, consultantId))
      .orderBy(desc(clientStateTracking.lastUpdated));

    console.log(`📄 [ClientStates] Trovati ${states.length} stati cliente`);

    if (states.length === 0) {
      return `# Stati dei Clienti\n\nNessuno stato cliente configurato.\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    }

    let document = `# Stati dei Clienti
## ${states.length} Profili di Stato

Questo documento contiene lo stato attuale e ideale di ogni cliente,
inclusi benefici, ostacoli, azioni correnti e visione futura.

---

`;

    for (const state of states) {
      const clientName = `${state.clientFirstName || ""} ${state.clientLastName || ""}`.trim() || "Sconosciuto";

      document += `### ${clientName}
- **Stato attuale**: ${state.currentState}
- **Stato ideale**: ${state.idealState}
- **Beneficio interno**: ${state.internalBenefit || "N/A"}
- **Beneficio esterno**: ${state.externalBenefit || "N/A"}
- **Ostacolo principale**: ${state.mainObstacle || "N/A"}
- **Tentativi passati**: ${state.pastAttempts || "N/A"}
- **Azioni correnti**: ${state.currentActions || "N/A"}
- **Visione futura**: ${state.futureVision || "N/A"}
- **Motivazioni**: ${state.motivationDrivers || "N/A"}
- **Ultimo aggiornamento**: ${formatItalianDate(state.lastUpdated)}

---

`;
    }

    document += `Generato il: ${formatItalianDate(new Date())}\n`;
    return document;
  } catch (error: any) {
    console.error(`❌ [ClientStates] Errore:`, error.message);
    throw error;
  }
}

/**
 * 3. Generate WhatsApp Templates document
 * Includes: agent configs with template fields, custom templates
 */
export async function generateWhatsappTemplatesDocument(consultantId: string): Promise<string> {
  console.log(`📄 [WhatsappTemplates] Generazione per consulente ${consultantId.substring(0, 8)}...`);

  try {
    const agentConfigs = await db
      .select({
        id: consultantWhatsappConfig.id,
        agentName: consultantWhatsappConfig.agentName,
        agentType: consultantWhatsappConfig.agentType,
        isActive: consultantWhatsappConfig.isActive,
        whatsappTemplates: consultantWhatsappConfig.whatsappTemplates,
        templateBodies: consultantWhatsappConfig.templateBodies,
        defaultObiettivi: consultantWhatsappConfig.defaultObiettivi,
        defaultDesideri: consultantWhatsappConfig.defaultDesideri,
        defaultUncino: consultantWhatsappConfig.defaultUncino,
        defaultIdealState: consultantWhatsappConfig.defaultIdealState,
      })
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.consultantId, consultantId));

    const customTemplates = await db
      .select({
        id: whatsappCustomTemplates.id,
        templateName: whatsappCustomTemplates.templateName,
        templateType: whatsappCustomTemplates.templateType,
        useCase: whatsappCustomTemplates.useCase,
        description: whatsappCustomTemplates.description,
        body: whatsappCustomTemplates.body,
        isActive: whatsappCustomTemplates.isActive,
        isSystemTemplate: whatsappCustomTemplates.isSystemTemplate,
        createdAt: whatsappCustomTemplates.createdAt,
      })
      .from(whatsappCustomTemplates)
      .where(eq(whatsappCustomTemplates.consultantId, consultantId))
      .orderBy(desc(whatsappCustomTemplates.createdAt))
      .limit(100);

    console.log(`📄 [WhatsappTemplates] Trovati ${agentConfigs.length} agenti, ${customTemplates.length} template custom`);

    let document = `# Template WhatsApp
## Configurazione Agenti e Template Personalizzati

---

## 🤖 Configurazione Agenti (${agentConfigs.length})

`;

    for (const agent of agentConfigs) {
      document += `### ${agent.agentName}
- **Tipo**: ${agent.agentType}
- **Stato**: ${agent.isActive ? "Attivo" : "Inattivo"}
- **Obiettivi predefiniti**: ${agent.defaultObiettivi || "N/A"}
- **Desideri predefiniti**: ${agent.defaultDesideri || "N/A"}
- **Uncino predefinito**: ${agent.defaultUncino || "N/A"}
- **Stato ideale predefinito**: ${agent.defaultIdealState || "N/A"}
`;

      const templates = agent.whatsappTemplates as any;
      if (templates) {
        document += `- **Template apertura SID**: ${templates.openingMessageContentSid || "N/A"}
- **Template follow-up gentile SID**: ${templates.followUpGentleContentSid || "N/A"}
- **Template follow-up valore SID**: ${templates.followUpValueContentSid || "N/A"}
- **Template follow-up finale SID**: ${templates.followUpFinalContentSid || "N/A"}
`;
      }

      const bodies = agent.templateBodies as any;
      if (bodies) {
        if (bodies.openingMessageBody) document += `\n**Testo apertura:**\n> ${bodies.openingMessageBody}\n`;
        if (bodies.followUpGentleBody) document += `\n**Testo follow-up gentile:**\n> ${bodies.followUpGentleBody}\n`;
        if (bodies.followUpValueBody) document += `\n**Testo follow-up valore:**\n> ${bodies.followUpValueBody}\n`;
        if (bodies.followUpFinalBody) document += `\n**Testo follow-up finale:**\n> ${bodies.followUpFinalBody}\n`;
      }

      document += `\n`;
    }

    document += `---

## 📝 Template Personalizzati (${customTemplates.length})

`;

    for (const tmpl of customTemplates) {
      document += `### ${tmpl.templateName}
- **Tipo**: ${tmpl.templateType || "N/A"}
- **Caso d'uso**: ${tmpl.useCase || "N/A"}
- **Descrizione**: ${tmpl.description || "N/A"}
- **Attivo**: ${tmpl.isActive ? "Sì" : "No"}
- **Template di sistema**: ${tmpl.isSystemTemplate ? "Sì" : "No"}
- **Creato il**: ${formatItalianDate(tmpl.createdAt)}
`;
      if (tmpl.body) {
        document += `\n**Testo:**\n> ${tmpl.body}\n`;
      }
      document += `\n`;
    }

    document += `---\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    return document;
  } catch (error: any) {
    console.error(`❌ [WhatsappTemplates] Errore:`, error.message);
    throw error;
  }
}

/**
 * 4. Generate Twilio Templates document
 * Queries whatsappCustomTemplates + whatsappTemplateVersions for Twilio-synced templates
 */
export async function generateTwilioTemplatesDocument(consultantId: string): Promise<string> {
  console.log(`📄 [TwilioTemplates] Generazione per consulente ${consultantId.substring(0, 8)}...`);

  try {
    const customTemplates = await db
      .select({
        id: whatsappCustomTemplates.id,
        templateName: whatsappCustomTemplates.templateName,
        templateType: whatsappCustomTemplates.templateType,
        useCase: whatsappCustomTemplates.useCase,
        body: whatsappCustomTemplates.body,
        isActive: whatsappCustomTemplates.isActive,
        targetAgentType: whatsappCustomTemplates.targetAgentType,
        createdAt: whatsappCustomTemplates.createdAt,
      })
      .from(whatsappCustomTemplates)
      .where(eq(whatsappCustomTemplates.consultantId, consultantId))
      .limit(100);

    const templateIds = customTemplates.map(t => t.id);
    let versions: {
      id: string;
      templateId: string;
      versionNumber: number;
      bodyText: string;
      twilioContentSid: string | null;
      twilioStatus: string;
      isActive: boolean;
      lastSyncedAt: Date | null;
    }[] = [];

    if (templateIds.length > 0) {
      versions = await db
        .select({
          id: whatsappTemplateVersions.id,
          templateId: whatsappTemplateVersions.templateId,
          versionNumber: whatsappTemplateVersions.versionNumber,
          bodyText: whatsappTemplateVersions.bodyText,
          twilioContentSid: whatsappTemplateVersions.twilioContentSid,
          twilioStatus: whatsappTemplateVersions.twilioStatus,
          isActive: whatsappTemplateVersions.isActive,
          lastSyncedAt: whatsappTemplateVersions.lastSyncedAt,
        })
        .from(whatsappTemplateVersions)
        .where(inArray(whatsappTemplateVersions.templateId, templateIds))
        .orderBy(desc(whatsappTemplateVersions.versionNumber));
    }

    const versionsByTemplate = new Map<string, typeof versions>();
    for (const v of versions) {
      if (!versionsByTemplate.has(v.templateId)) versionsByTemplate.set(v.templateId, []);
      versionsByTemplate.get(v.templateId)!.push(v);
    }

    console.log(`📄 [TwilioTemplates] Trovati ${customTemplates.length} template, ${versions.length} versioni`);

    let document = `# Template Twilio / WhatsApp Content Templates
## ${customTemplates.length} Template Configurati

Questo documento contiene i template sincronizzati con Twilio,
inclusi SID, stato di approvazione e testo delle versioni.

---

`;

    for (const tmpl of customTemplates) {
      const tmplVersions = versionsByTemplate.get(tmpl.id) || [];
      const activeVersion = tmplVersions.find(v => v.isActive);

      document += `### ${tmpl.templateName}
- **Tipo**: ${tmpl.templateType || "N/A"}
- **Caso d'uso**: ${tmpl.useCase || "N/A"}
- **Attivo**: ${tmpl.isActive ? "Sì" : "No"}
- **Agente target**: ${tmpl.targetAgentType || "N/A"}
- **Versioni totali**: ${tmplVersions.length}
- **Creato il**: ${formatItalianDate(tmpl.createdAt)}
`;

      if (activeVersion) {
        document += `
**Versione attiva (v${activeVersion.versionNumber}):**
- **Twilio SID**: ${activeVersion.twilioContentSid || "Non sincronizzato"}
- **Stato Twilio**: ${activeVersion.twilioStatus}
- **Ultima sincronizzazione**: ${formatItalianDate(activeVersion.lastSyncedAt)}
- **Testo**: ${activeVersion.bodyText}
`;
      }

      document += `\n`;
    }

    document += `---\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    return document;
  } catch (error: any) {
    console.error(`❌ [TwilioTemplates] Errore:`, error.message);
    throw error;
  }
}

/**
 * 5. Generate Consultant Config document
 * Includes: SMTP settings, external API configs
 */
export async function generateConsultantConfigDocument(consultantId: string): Promise<string> {
  console.log(`📄 [ConsultantConfig] Generazione per consulente ${consultantId.substring(0, 8)}...`);

  try {
    const smtpRows = await db
      .select({
        id: consultantSmtpSettings.id,
        smtpHost: consultantSmtpSettings.smtpHost,
        smtpPort: consultantSmtpSettings.smtpPort,
        smtpSecure: consultantSmtpSettings.smtpSecure,
        fromEmail: consultantSmtpSettings.fromEmail,
        fromName: consultantSmtpSettings.fromName,
        emailTone: consultantSmtpSettings.emailTone,
        automationEnabled: consultantSmtpSettings.automationEnabled,
        emailFrequencyDays: consultantSmtpSettings.emailFrequencyDays,
        emailSendTime: consultantSmtpSettings.emailSendTime,
        sendWindowStart: consultantSmtpSettings.sendWindowStart,
        sendWindowEnd: consultantSmtpSettings.sendWindowEnd,
        isActive: consultantSmtpSettings.isActive,
        schedulerEnabled: consultantSmtpSettings.schedulerEnabled,
        schedulerPaused: consultantSmtpSettings.schedulerPaused,
        schedulerStatus: consultantSmtpSettings.schedulerStatus,
        lastSchedulerRun: consultantSmtpSettings.lastSchedulerRun,
        nextSchedulerRun: consultantSmtpSettings.nextSchedulerRun,
      })
      .from(consultantSmtpSettings)
      .where(eq(consultantSmtpSettings.consultantId, consultantId))
      .limit(1);

    const apiConfigs = await db
      .select({
        id: externalApiConfigs.id,
        configName: externalApiConfigs.configName,
        baseUrl: externalApiConfigs.baseUrl,
        leadType: externalApiConfigs.leadType,
        sourceFilter: externalApiConfigs.sourceFilter,
        campaignFilter: externalApiConfigs.campaignFilter,
        pollingEnabled: externalApiConfigs.pollingEnabled,
        pollingIntervalMinutes: externalApiConfigs.pollingIntervalMinutes,
        isActive: externalApiConfigs.isActive,
        lastImportAt: externalApiConfigs.lastImportAt,
        lastImportStatus: externalApiConfigs.lastImportStatus,
        lastImportLeadsCount: externalApiConfigs.lastImportLeadsCount,
      })
      .from(externalApiConfigs)
      .where(eq(externalApiConfigs.consultantId, consultantId));

    const consultant = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        twilioAccountSid: users.twilioAccountSid,
        twilioWhatsappNumber: users.twilioWhatsappNumber,
        preferredAiProvider: users.preferredAiProvider,
      })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    let document = `# Configurazione Consulente
## Documento di Riferimento Configurazione

---

## 👤 Profilo Consulente
`;

    if (consultant[0]) {
      const c = consultant[0];
      document += `- **Nome**: ${c.firstName} ${c.lastName}
- **Email**: ${c.email}
- **Provider AI preferito**: ${c.preferredAiProvider || "vertex_admin"}
- **Numero WhatsApp Twilio**: ${c.twilioWhatsappNumber || "Non configurato"}
- **Account Twilio SID**: ${c.twilioAccountSid ? "Configurato" : "Non configurato"}

`;
    }

    document += `---

## 📧 Configurazione SMTP
`;

    if (smtpRows[0]) {
      const smtp = smtpRows[0];
      document += `- **Host SMTP**: ${smtp.smtpHost}
- **Porta**: ${smtp.smtpPort}
- **Sicuro (TLS)**: ${smtp.smtpSecure ? "Sì" : "No"}
- **Email mittente**: ${smtp.fromEmail}
- **Nome mittente**: ${smtp.fromName || "N/A"}
- **Tono email**: ${smtp.emailTone || "motivazionale"}
- **Automazione abilitata**: ${smtp.automationEnabled ? "Sì" : "No"}
- **Frequenza email (giorni)**: ${smtp.emailFrequencyDays}
- **Orario invio**: ${smtp.emailSendTime}
- **Finestra invio**: ${smtp.sendWindowStart || "N/A"} - ${smtp.sendWindowEnd || "N/A"}
- **Attivo**: ${smtp.isActive ? "Sì" : "No"}
- **Scheduler abilitato**: ${smtp.schedulerEnabled ? "Sì" : "No"}
- **Scheduler in pausa**: ${smtp.schedulerPaused ? "Sì" : "No"}
- **Stato scheduler**: ${smtp.schedulerStatus || "idle"}
- **Ultimo run scheduler**: ${formatItalianDate(smtp.lastSchedulerRun)}
- **Prossimo run scheduler**: ${formatItalianDate(smtp.nextSchedulerRun)}
`;
    } else {
      document += `_Configurazione SMTP non presente._\n`;
    }

    document += `
---

## 🔌 Configurazioni API Esterne (${apiConfigs.length})

`;

    if (apiConfigs.length === 0) {
      document += `_Nessuna configurazione API esterna._\n`;
    } else {
      for (const api of apiConfigs) {
        document += `### ${api.configName}
- **URL base**: ${api.baseUrl}
- **Tipo lead**: ${api.leadType}
- **Filtro sorgente**: ${api.sourceFilter || "N/A"}
- **Filtro campagna**: ${api.campaignFilter || "N/A"}
- **Polling abilitato**: ${api.pollingEnabled ? "Sì" : "No"}
- **Intervallo polling (min)**: ${api.pollingIntervalMinutes}
- **Attivo**: ${api.isActive ? "Sì" : "No"}
- **Ultimo import**: ${formatItalianDate(api.lastImportAt)}
- **Stato ultimo import**: ${api.lastImportStatus || "N/A"}
- **Lead importati (ultimo)**: ${api.lastImportLeadsCount || 0}

`;
      }
    }

    document += `---\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    return document;
  } catch (error: any) {
    console.error(`❌ [ConsultantConfig] Errore:`, error.message);
    throw error;
  }
}

/**
 * 6. Generate Email Marketing document
 * Includes: recent drafts, scheduler history, journey templates
 */
export async function generateEmailMarketingDocument(consultantId: string): Promise<string> {
  console.log(`📄 [EmailMarketing] Generazione per consulente ${consultantId.substring(0, 8)}...`);

  try {
    const drafts = await db
      .select({
        id: emailDrafts.id,
        clientId: emailDrafts.clientId,
        subject: emailDrafts.subject,
        status: emailDrafts.status,
        emailType: emailDrafts.emailType,
        journeyDay: emailDrafts.journeyDay,
        generatedAt: emailDrafts.generatedAt,
        approvedAt: emailDrafts.approvedAt,
        sentAt: emailDrafts.sentAt,
        clientFirstName: users.firstName,
        clientLastName: users.lastName,
      })
      .from(emailDrafts)
      .leftJoin(users, eq(emailDrafts.clientId, users.id))
      .where(eq(emailDrafts.consultantId, consultantId))
      .orderBy(desc(emailDrafts.generatedAt))
      .limit(50);

    const schedulerLogs = await db
      .select({
        id: schedulerExecutionLog.id,
        executedAt: schedulerExecutionLog.executedAt,
        clientsProcessed: schedulerExecutionLog.clientsProcessed,
        emailsSent: schedulerExecutionLog.emailsSent,
        draftsCreated: schedulerExecutionLog.draftsCreated,
        errors: schedulerExecutionLog.errors,
        status: schedulerExecutionLog.status,
        executionTimeMs: schedulerExecutionLog.executionTimeMs,
        details: schedulerExecutionLog.details,
      })
      .from(schedulerExecutionLog)
      .where(eq(schedulerExecutionLog.consultantId, consultantId))
      .orderBy(desc(schedulerExecutionLog.executedAt))
      .limit(10);

    const journeyTemplates = await db
      .select({
        id: emailJourneyTemplates.id,
        dayOfMonth: emailJourneyTemplates.dayOfMonth,
        title: emailJourneyTemplates.title,
        description: emailJourneyTemplates.description,
        emailType: emailJourneyTemplates.emailType,
        tone: emailJourneyTemplates.tone,
        priority: emailJourneyTemplates.priority,
        isActive: emailJourneyTemplates.isActive,
      })
      .from(emailJourneyTemplates)
      .orderBy(asc(emailJourneyTemplates.dayOfMonth));

    console.log(`📄 [EmailMarketing] Trovati ${drafts.length} bozze, ${schedulerLogs.length} log scheduler, ${journeyTemplates.length} template journey`);

    const pendingDrafts = drafts.filter(d => d.status === "pending").length;
    const approvedDrafts = drafts.filter(d => d.status === "approved").length;
    const sentDrafts = drafts.filter(d => d.status === "sent").length;

    let document = `# Email Marketing
## Report Completo

---

## 📊 Statistiche Bozze Email

| Stato | Quantità |
|-------|----------|
| In attesa | ${pendingDrafts} |
| Approvate | ${approvedDrafts} |
| Inviate | ${sentDrafts} |
| Totale recenti | ${drafts.length} |

---

## 📝 Bozze Email Recenti (${drafts.length})

| Cliente | Oggetto | Tipo | Stato | Giorno Journey | Generata il |
|---------|---------|------|-------|----------------|-------------|
`;

    for (const draft of drafts) {
      const clientName = `${draft.clientFirstName || ""} ${draft.clientLastName || ""}`.trim() || "N/A";
      document += `| ${clientName} | ${draft.subject.substring(0, 50)} | ${draft.emailType} | ${draft.status} | ${draft.journeyDay || "N/A"} | ${formatItalianDate(draft.generatedAt)} |\n`;
    }

    document += `
---

## ⏱️ Storico Esecuzioni Scheduler (${schedulerLogs.length})

| Data | Clienti | Email Inviate | Bozze Create | Errori | Stato | Tempo (ms) |
|------|---------|---------------|--------------|--------|-------|------------|
`;

    for (const log of schedulerLogs) {
      document += `| ${formatItalianDate(log.executedAt)} | ${log.clientsProcessed} | ${log.emailsSent} | ${log.draftsCreated} | ${log.errors} | ${log.status} | ${log.executionTimeMs || "N/A"} |\n`;
    }

    document += `
---

## 📅 Template Journey Email (${journeyTemplates.length})

| Giorno | Titolo | Tipo | Tono | Priorità | Attivo |
|--------|--------|------|------|----------|--------|
`;

    for (const tmpl of journeyTemplates) {
      document += `| ${tmpl.dayOfMonth} | ${tmpl.title} | ${tmpl.emailType} | ${tmpl.tone || "N/A"} | ${tmpl.priority} | ${tmpl.isActive ? "Sì" : "No"} |\n`;
    }

    document += `\n---\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    return document;
  } catch (error: any) {
    console.error(`❌ [EmailMarketing] Errore:`, error.message);
    throw error;
  }
}

/**
 * 7. Generate Campaigns document
 * Includes: campaign details, stats, lead counts
 */
export async function generateCampaignsDocument(consultantId: string): Promise<string> {
  console.log(`📄 [Campaigns] Generazione per consulente ${consultantId.substring(0, 8)}...`);

  try {
    const campaignsList = await db
      .select({
        id: marketingCampaigns.id,
        campaignName: marketingCampaigns.campaignName,
        campaignType: marketingCampaigns.campaignType,
        leadCategory: marketingCampaigns.leadCategory,
        hookText: marketingCampaigns.hookText,
        idealStateDescription: marketingCampaigns.idealStateDescription,
        totalLeads: marketingCampaigns.totalLeads,
        convertedLeads: marketingCampaigns.convertedLeads,
        conversionRate: marketingCampaigns.conversionRate,
        isActive: marketingCampaigns.isActive,
        createdAt: marketingCampaigns.createdAt,
      })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.consultantId, consultantId))
      .orderBy(desc(marketingCampaigns.createdAt));

    console.log(`📄 [Campaigns] Trovate ${campaignsList.length} campagne`);

    if (campaignsList.length === 0) {
      return `# Campagne Marketing\n\nNessuna campagna configurata.\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    }

    const activeCampaigns = campaignsList.filter(c => c.isActive).length;
    const totalLeadsSum = campaignsList.reduce((sum, c) => sum + (c.totalLeads || 0), 0);
    const totalConvertedSum = campaignsList.reduce((sum, c) => sum + (c.convertedLeads || 0), 0);

    let document = `# Campagne Marketing
## ${campaignsList.length} Campagne Totali (${activeCampaigns} Attive)

---

## 📊 Riepilogo

| Metrica | Valore |
|---------|--------|
| Campagne totali | ${campaignsList.length} |
| Campagne attive | ${activeCampaigns} |
| Lead totali | ${totalLeadsSum} |
| Lead convertiti | ${totalConvertedSum} |
| Tasso conversione medio | ${totalLeadsSum > 0 ? Math.round((totalConvertedSum / totalLeadsSum) * 100) : 0}% |

---

## 📋 Dettaglio Campagne

`;

    for (const camp of campaignsList) {
      document += `### ${camp.campaignName}
- **Tipo**: ${camp.campaignType}
- **Categoria lead**: ${camp.leadCategory}
- **Stato**: ${camp.isActive ? "Attiva" : "Inattiva"}
- **Lead totali**: ${camp.totalLeads || 0}
- **Lead convertiti**: ${camp.convertedLeads || 0}
- **Tasso conversione**: ${camp.conversionRate ? Math.round(camp.conversionRate * 100) : 0}%
- **Uncino**: ${camp.hookText || "N/A"}
- **Stato ideale**: ${camp.idealStateDescription || "N/A"}
- **Creata il**: ${formatItalianDate(camp.createdAt)}

`;
    }

    document += `---\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    return document;
  } catch (error: any) {
    console.error(`❌ [Campaigns] Errore:`, error.message);
    throw error;
  }
}

/**
 * 8. Generate Calendar document
 * Includes: upcoming events with details
 */
export async function generateCalendarDocument(consultantId: string): Promise<string> {
  console.log(`📄 [Calendar] Generazione per consulente ${consultantId.substring(0, 8)}...`);

  try {
    const now = new Date();

    const events = await db
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        description: calendarEvents.description,
        start: calendarEvents.start,
        end: calendarEvents.end,
        allDay: calendarEvents.allDay,
        color: calendarEvents.color,
      })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.userId, consultantId),
          gte(calendarEvents.start, now)
        )
      )
      .orderBy(asc(calendarEvents.start))
      .limit(50);

    const upcomingConsultations = await db
      .select({
        id: consultations.id,
        scheduledAt: consultations.scheduledAt,
        duration: consultations.duration,
        status: consultations.status,
        notes: consultations.notes,
        clientFirstName: users.firstName,
        clientLastName: users.lastName,
      })
      .from(consultations)
      .leftJoin(users, eq(consultations.clientId, users.id))
      .where(
        and(
          eq(consultations.consultantId, consultantId),
          gte(consultations.scheduledAt, now),
          eq(consultations.status, "scheduled")
        )
      )
      .orderBy(asc(consultations.scheduledAt))
      .limit(30);

    console.log(`📄 [Calendar] Trovati ${events.length} eventi, ${upcomingConsultations.length} consulenze programmate`);

    let document = `# Calendario
## Eventi e Consulenze Programmate

---

## 📅 Eventi Calendario (${events.length})

`;

    if (events.length === 0) {
      document += `_Nessun evento in programma._\n\n`;
    } else {
      document += `| Titolo | Inizio | Fine | Tutto il giorno |
|--------|--------|------|-----------------|
`;
      for (const evt of events) {
        document += `| ${evt.title} | ${formatItalianDate(evt.start)} | ${formatItalianDate(evt.end)} | ${evt.allDay ? "Sì" : "No"} |\n`;
      }
    }

    document += `
---

## 🤝 Consulenze Programmate (${upcomingConsultations.length})

`;

    if (upcomingConsultations.length === 0) {
      document += `_Nessuna consulenza programmata._\n\n`;
    } else {
      for (const cons of upcomingConsultations) {
        const clientName = `${cons.clientFirstName || ""} ${cons.clientLastName || ""}`.trim() || "N/A";
        document += `### ${clientName} - ${formatItalianDate(cons.scheduledAt)}
- **Durata**: ${cons.duration} minuti
- **Stato**: ${cons.status}
- **Note**: ${cons.notes || "Nessuna nota"}

`;
      }
    }

    document += `---\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    return document;
  } catch (error: any) {
    console.error(`❌ [Calendar] Errore:`, error.message);
    throw error;
  }
}

/**
 * 9. Generate Exercises Pending document
 * Includes: submitted/returned assignments, recent feedback
 */
export async function generateExercisesPendingDocument(consultantId: string): Promise<string> {
  console.log(`📄 [ExercisesPending] Generazione per consulente ${consultantId.substring(0, 8)}...`);

  try {
    const pendingAssignments = await db
      .select({
        id: exerciseAssignments.id,
        exerciseId: exerciseAssignments.exerciseId,
        clientId: exerciseAssignments.clientId,
        status: exerciseAssignments.status,
        assignedAt: exerciseAssignments.assignedAt,
        dueDate: exerciseAssignments.dueDate,
        submittedAt: exerciseAssignments.submittedAt,
        score: exerciseAssignments.score,
        exerciseTitle: exercises.title,
        exerciseCategory: exercises.category,
        clientFirstName: users.firstName,
        clientLastName: users.lastName,
      })
      .from(exerciseAssignments)
      .leftJoin(exercises, eq(exerciseAssignments.exerciseId, exercises.id))
      .leftJoin(users, eq(exerciseAssignments.clientId, users.id))
      .where(
        and(
          eq(exerciseAssignments.consultantId, consultantId),
          inArray(exerciseAssignments.status, ["submitted", "in_review", "returned"])
        )
      )
      .orderBy(desc(exerciseAssignments.submittedAt))
      .limit(100);

    const assignmentIds = pendingAssignments.map(a => a.id);
    let submissions: {
      id: string;
      assignmentId: string;
      notes: string | null;
      submittedAt: Date | null;
    }[] = [];

    if (assignmentIds.length > 0) {
      submissions = await db
        .select({
          id: exerciseSubmissions.id,
          assignmentId: exerciseSubmissions.assignmentId,
          notes: exerciseSubmissions.notes,
          submittedAt: exerciseSubmissions.submittedAt,
        })
        .from(exerciseSubmissions)
        .where(inArray(exerciseSubmissions.assignmentId, assignmentIds))
        .orderBy(desc(exerciseSubmissions.submittedAt));
    }

    const submissionsByAssignment = new Map<string, typeof submissions>();
    for (const sub of submissions) {
      if (!submissionsByAssignment.has(sub.assignmentId)) submissionsByAssignment.set(sub.assignmentId, []);
      submissionsByAssignment.get(sub.assignmentId)!.push(sub);
    }

    console.log(`📄 [ExercisesPending] Trovati ${pendingAssignments.length} esercizi in attesa, ${submissions.length} sottomissioni`);

    const submittedCount = pendingAssignments.filter(a => a.status === "submitted").length;
    const inReviewCount = pendingAssignments.filter(a => a.status === "in_review").length;
    const returnedCount = pendingAssignments.filter(a => a.status === "returned").length;

    let document = `# Esercizi in Attesa di Revisione
## ${pendingAssignments.length} Esercizi da Gestire

---

## 📊 Riepilogo

| Stato | Quantità |
|-------|----------|
| Inviati (da revisionare) | ${submittedCount} |
| In revisione | ${inReviewCount} |
| Restituiti | ${returnedCount} |
| Totale | ${pendingAssignments.length} |

---

## 📝 Dettaglio Esercizi

`;

    for (const assignment of pendingAssignments) {
      const clientName = `${assignment.clientFirstName || ""} ${assignment.clientLastName || ""}`.trim() || "N/A";
      const assignmentSubs = submissionsByAssignment.get(assignment.id) || [];
      const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date();

      document += `### ${assignment.exerciseTitle || "Esercizio senza titolo"}
- **Cliente**: ${clientName}
- **Categoria**: ${assignment.exerciseCategory || "N/A"}
- **Stato**: ${assignment.status}${isOverdue ? " ⚠️ SCADUTO" : ""}
- **Assegnato il**: ${formatItalianDate(assignment.assignedAt)}
- **Scadenza**: ${formatItalianDate(assignment.dueDate)}
- **Inviato il**: ${formatItalianDate(assignment.submittedAt)}
- **Punteggio**: ${assignment.score !== null && assignment.score !== undefined ? assignment.score : "Non valutato"}
`;

      if (assignmentSubs.length > 0) {
        document += `- **Sottomissioni**: ${assignmentSubs.length}\n`;
        const latestSub = assignmentSubs[0];
        if (latestSub?.notes) {
          document += `- **Note studente**: ${latestSub.notes.substring(0, 200)}\n`;
        }
      }

      document += `\n`;
    }

    document += `---\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    return document;
  } catch (error: any) {
    console.error(`❌ [ExercisesPending] Errore:`, error.message);
    throw error;
  }
}

/**
 * 10. Generate Consultations document
 * Includes: recent consultations with details, tasks
 */
export async function generateConsultationsDocument(consultantId: string): Promise<string> {
  console.log(`📄 [Consultations] Generazione per consulente ${consultantId.substring(0, 8)}...`);

  try {
    const recentConsultations = await db
      .select({
        id: consultations.id,
        scheduledAt: consultations.scheduledAt,
        duration: consultations.duration,
        status: consultations.status,
        notes: consultations.notes,
        summaryEmailStatus: consultations.summaryEmailStatus,
        clientFirstName: users.firstName,
        clientLastName: users.lastName,
        clientEmail: users.email,
      })
      .from(consultations)
      .leftJoin(users, eq(consultations.clientId, users.id))
      .where(eq(consultations.consultantId, consultantId))
      .orderBy(desc(consultations.scheduledAt))
      .limit(30);

    const consultationIds = recentConsultations.map(c => c.id);
    let tasks: {
      id: string;
      consultationId: string;
      title: string;
      description: string | null;
      dueDate: Date | null;
      completed: boolean;
      priority: string;
      category: string;
      clientId: string;
    }[] = [];

    if (consultationIds.length > 0) {
      tasks = await db
        .select({
          id: consultationTasks.id,
          consultationId: consultationTasks.consultationId,
          title: consultationTasks.title,
          description: consultationTasks.description,
          dueDate: consultationTasks.dueDate,
          completed: consultationTasks.completed,
          priority: consultationTasks.priority,
          category: consultationTasks.category,
          clientId: consultationTasks.clientId,
        })
        .from(consultationTasks)
        .where(inArray(consultationTasks.consultationId, consultationIds))
        .orderBy(asc(consultationTasks.dueDate));
    }

    const tasksByConsultation = new Map<string, typeof tasks>();
    for (const task of tasks) {
      if (!tasksByConsultation.has(task.consultationId)) tasksByConsultation.set(task.consultationId, []);
      tasksByConsultation.get(task.consultationId)!.push(task);
    }

    console.log(`📄 [Consultations] Trovate ${recentConsultations.length} consulenze, ${tasks.length} task`);

    const completedCount = recentConsultations.filter(c => c.status === "completed").length;
    const scheduledCount = recentConsultations.filter(c => c.status === "scheduled").length;
    const cancelledCount = recentConsultations.filter(c => c.status === "cancelled").length;
    const pendingTasks = tasks.filter(t => !t.completed).length;

    let document = `# Consulenze Recenti
## ${recentConsultations.length} Consulenze

---

## 📊 Riepilogo

| Stato | Quantità |
|-------|----------|
| Programmate | ${scheduledCount} |
| Completate | ${completedCount} |
| Cancellate | ${cancelledCount} |
| Task in sospeso | ${pendingTasks} |
| Task totali | ${tasks.length} |

---

## 📋 Dettaglio Consulenze

`;

    for (const cons of recentConsultations) {
      const clientName = `${cons.clientFirstName || ""} ${cons.clientLastName || ""}`.trim() || "N/A";
      const consTasks = tasksByConsultation.get(cons.id) || [];

      document += `### ${clientName} - ${formatItalianDate(cons.scheduledAt)}
- **Durata**: ${cons.duration} minuti
- **Stato**: ${cons.status}
- **Email riepilogo**: ${cons.summaryEmailStatus || "N/A"}
- **Note**: ${cons.notes ? cons.notes.substring(0, 300) : "Nessuna nota"}
`;

      if (consTasks.length > 0) {
        document += `\n**Task (${consTasks.length}):**\n`;
        for (const task of consTasks) {
          const taskStatus = task.completed ? "✅" : "⬜";
          document += `- ${taskStatus} [${task.priority}] ${task.title} (${task.category}) - Scadenza: ${formatItalianDate(task.dueDate)}\n`;
        }
      }

      document += `\n`;
    }

    document += `---\n\nGenerato il: ${formatItalianDate(new Date())}\n`;
    return document;
  } catch (error: any) {
    console.error(`❌ [Consultations] Errore:`, error.message);
    throw error;
  }
}

// ============================================================
// SYNC AND PREVIEW FUNCTIONS
// ============================================================

/**
 * Sync all dynamic documents to File Search for a consultant
 */
export async function syncDynamicDocuments(consultantId: string, operationalSettings?: OperationalSettings): Promise<SyncResult> {
  console.log(`📄 [DynamicDocs] Starting sync for consultant ${consultantId.substring(0, 8)}...`);

  const store = await db
    .select()
    .from(fileSearchStores)
    .where(
      and(
        eq(fileSearchStores.ownerId, consultantId),
        eq(fileSearchStores.ownerType, "consultant")
      )
    )
    .limit(1);

  if (!store[0]) {
    console.log(`⚠️ [DynamicDocs] No File Search store found for consultant`);
    return {
      conversationHistory: { success: false, error: "No File Search store configured" },
      leadHubMetrics: { success: false, error: "No File Search store configured" },
      aiLimitations: { success: false, error: "No File Search store configured" },
      totalDocuments: 0,
      syncedAt: new Date(),
    };
  }

  const storeId = store[0].id;
  const results: SyncResult = {
    conversationHistory: { success: false },
    leadHubMetrics: { success: false },
    aiLimitations: { success: false },
    totalDocuments: 0,
    syncedAt: new Date(),
  };

  try {
    console.log(`📄 [DynamicDocs] Generating conversation history document...`);
    const conversationDoc = await generateConversationHistoryDocument(consultantId);
    console.log(`📄 [DynamicDocs] Document generated, length: ${conversationDoc.length} chars`);
    const convResult = await fileSearchService.uploadDocumentFromContent({
      content: conversationDoc,
      displayName: "Storico Conversazioni WhatsApp (Auto-generato)",
      storeId,
      sourceType: "dynamic_context",
      sourceId: `dynamic_conversations_${consultantId}`,
      userId: consultantId,
      skipHashCheck: true,
    });
    results.conversationHistory = {
      success: convResult.success,
      documentId: convResult.fileId,
      error: convResult.error,
      tokensEstimate: estimateTokens(conversationDoc),
    };
    if (convResult.success) results.totalDocuments++;
    console.log(`📄 [DynamicDocs] Conversation history: ${convResult.success ? "✅" : "❌"}`);
  } catch (error: any) {
    results.conversationHistory = { success: false, error: error.message };
    console.error(`❌ [DynamicDocs] Conversation history error:`, error.message);
    console.error(`❌ [DynamicDocs] Stack trace:`, error.stack);
  }

  try {
    const metricsDoc = await generateLeadHubMetricsDocument(consultantId);
    const metricsResult = await fileSearchService.uploadDocumentFromContent({
      content: metricsDoc,
      displayName: "Metriche Hub Lead Proattivo (Auto-generato)",
      storeId,
      sourceType: "dynamic_context",
      sourceId: `dynamic_metrics_${consultantId}`,
      userId: consultantId,
      skipHashCheck: true,
    });
    results.leadHubMetrics = {
      success: metricsResult.success,
      documentId: metricsResult.fileId,
      error: metricsResult.error,
      tokensEstimate: estimateTokens(metricsDoc),
    };
    if (metricsResult.success) results.totalDocuments++;
    console.log(`📄 [DynamicDocs] Lead hub metrics: ${metricsResult.success ? "✅" : "❌"}`);
  } catch (error: any) {
    results.leadHubMetrics = { success: false, error: error.message };
    console.error(`❌ [DynamicDocs] Lead hub metrics error:`, error.message);
  }

  try {
    const limitationsDoc = generateAILimitationsDocument();
    const limResult = await fileSearchService.uploadDocumentFromContent({
      content: limitationsDoc,
      displayName: "Limitazioni Assistente AI (Auto-generato)",
      storeId,
      sourceType: "dynamic_context",
      sourceId: `dynamic_limitations_${consultantId}`,
      userId: consultantId,
      skipHashCheck: true,
    });
    results.aiLimitations = {
      success: limResult.success,
      documentId: limResult.fileId,
      error: limResult.error,
      tokensEstimate: estimateTokens(limitationsDoc),
    };
    if (limResult.success) results.totalDocuments++;
    console.log(`📄 [DynamicDocs] AI limitations: ${limResult.success ? "✅" : "❌"}`);
  } catch (error: any) {
    results.aiLimitations = { success: false, error: error.message };
    console.error(`❌ [DynamicDocs] AI limitations error:`, error.message);
  }

  if (operationalSettings) {
    const operationalGenerators: Array<{
      key: keyof SyncResult;
      label: string;
      displayName: string;
      sourceIdPrefix: string;
      generator: () => Promise<string>;
    }> = [
      { key: 'clientsOverview', label: 'Clients overview', displayName: 'Panoramica Clienti (Auto-generato)', sourceIdPrefix: 'operational_clients_', generator: () => generateClientsOverviewDocument(consultantId) },
      { key: 'clientStates', label: 'Client states', displayName: 'Stati dei Clienti (Auto-generato)', sourceIdPrefix: 'operational_clientstates_', generator: () => generateClientStatesDocument(consultantId) },
      { key: 'whatsappTemplates', label: 'WhatsApp templates', displayName: 'Template WhatsApp (Auto-generato)', sourceIdPrefix: 'operational_whatsapptemplates_', generator: () => generateWhatsappTemplatesDocument(consultantId) },
      { key: 'twilioTemplates', label: 'Twilio templates', displayName: 'Template Twilio (Auto-generato)', sourceIdPrefix: 'operational_twiliotemplates_', generator: () => generateTwilioTemplatesDocument(consultantId) },
      { key: 'consultantConfig', label: 'Consultant config', displayName: 'Configurazione Consulente (Auto-generato)', sourceIdPrefix: 'operational_config_', generator: () => generateConsultantConfigDocument(consultantId) },
      { key: 'emailMarketing', label: 'Email marketing', displayName: 'Email Marketing (Auto-generato)', sourceIdPrefix: 'operational_email_', generator: () => generateEmailMarketingDocument(consultantId) },
      { key: 'campaigns', label: 'Campaigns', displayName: 'Campagne Marketing (Auto-generato)', sourceIdPrefix: 'operational_campaigns_', generator: () => generateCampaignsDocument(consultantId) },
      { key: 'calendar', label: 'Calendar', displayName: 'Calendario (Auto-generato)', sourceIdPrefix: 'operational_calendar_', generator: () => generateCalendarDocument(consultantId) },
      { key: 'exercisesPending', label: 'Exercises pending', displayName: 'Esercizi in Attesa (Auto-generato)', sourceIdPrefix: 'operational_exercisespending_', generator: () => generateExercisesPendingDocument(consultantId) },
      { key: 'consultationsDoc', label: 'Consultations', displayName: 'Consulenze Recenti (Auto-generato)', sourceIdPrefix: 'operational_consultations_', generator: () => generateConsultationsDocument(consultantId) },
    ];

    for (const { key, label, displayName, sourceIdPrefix, generator } of operationalGenerators) {
      try {
        console.log(`📄 [DynamicDocs] Generating ${label} document...`);
        const doc = await generator();
        const result = await fileSearchService.uploadDocumentFromContent({
          content: doc,
          displayName,
          storeId,
          sourceType: "operational_context",
          sourceId: `${sourceIdPrefix}${consultantId}`,
          userId: consultantId,
          skipHashCheck: true,
        });
        (results as any)[key] = { success: result.success, documentId: result.fileId, error: result.error, tokensEstimate: estimateTokens(doc) };
        if (result.success) results.totalDocuments++;
        console.log(`📄 [DynamicDocs] ${label}: ${result.success ? "✅" : "❌"}`);
      } catch (error: any) {
        (results as any)[key] = { success: false, error: error.message };
        console.error(`❌ [DynamicDocs] ${label} error:`, error.message);
      }
    }
  }

  const totalPossible = 3 + (operationalSettings ? 10 : 0);
  console.log(`📄 [DynamicDocs] Sync complete: ${results.totalDocuments}/${totalPossible} documents synced`);
  return results;
}

/**
 * Get a preview of what would be synced (for UI display)
 */
export async function previewDynamicDocuments(consultantId: string, operationalSettings?: OperationalSettings): Promise<{
  conversationHistory: { preview: string; tokensEstimate: number };
  leadHubMetrics: { preview: string; tokensEstimate: number };
  aiLimitations: { preview: string; tokensEstimate: number };
  clientsOverview?: { preview: string; tokensEstimate: number };
  clientStates?: { preview: string; tokensEstimate: number };
  whatsappTemplates?: { preview: string; tokensEstimate: number };
  twilioTemplates?: { preview: string; tokensEstimate: number };
  consultantConfig?: { preview: string; tokensEstimate: number };
  emailMarketing?: { preview: string; tokensEstimate: number };
  campaigns?: { preview: string; tokensEstimate: number };
  calendar?: { preview: string; tokensEstimate: number };
  exercisesPending?: { preview: string; tokensEstimate: number };
  consultationsDoc?: { preview: string; tokensEstimate: number };
}> {
  const conversationDoc = await generateConversationHistoryDocument(consultantId);
  const metricsDoc = await generateLeadHubMetricsDocument(consultantId);
  const limitationsDoc = generateAILimitationsDocument();

  const result: any = {
    conversationHistory: {
      preview: conversationDoc.substring(0, 500) + (conversationDoc.length > 500 ? "..." : ""),
      tokensEstimate: estimateTokens(conversationDoc),
    },
    leadHubMetrics: {
      preview: metricsDoc.substring(0, 500) + (metricsDoc.length > 500 ? "..." : ""),
      tokensEstimate: estimateTokens(metricsDoc),
    },
    aiLimitations: {
      preview: limitationsDoc.substring(0, 500) + (limitationsDoc.length > 500 ? "..." : ""),
      tokensEstimate: estimateTokens(limitationsDoc),
    },
  };

  const previewGenerators: Array<{
    key: string;
    settingKey: keyof OperationalSettings;
    generator: () => Promise<string>;
  }> = [
    { key: "clientsOverview", settingKey: "clients", generator: () => generateClientsOverviewDocument(consultantId) },
    { key: "clientStates", settingKey: "clientStates", generator: () => generateClientStatesDocument(consultantId) },
    { key: "whatsappTemplates", settingKey: "whatsappTemplates", generator: () => generateWhatsappTemplatesDocument(consultantId) },
    { key: "twilioTemplates", settingKey: "twilioTemplates", generator: () => generateTwilioTemplatesDocument(consultantId) },
    { key: "consultantConfig", settingKey: "config", generator: () => generateConsultantConfigDocument(consultantId) },
    { key: "emailMarketing", settingKey: "email", generator: () => generateEmailMarketingDocument(consultantId) },
    { key: "campaigns", settingKey: "campaigns", generator: () => generateCampaignsDocument(consultantId) },
    { key: "calendar", settingKey: "calendar", generator: () => generateCalendarDocument(consultantId) },
    { key: "exercisesPending", settingKey: "exercisesPending", generator: () => generateExercisesPendingDocument(consultantId) },
    { key: "consultationsDoc", settingKey: "consultations", generator: () => generateConsultationsDocument(consultantId) },
  ];

  for (const { key, settingKey, generator } of previewGenerators) {
    if (operationalSettings?.[settingKey]) {
      try {
        const doc = await generator();
        result[key] = {
          preview: doc.substring(0, 500) + (doc.length > 500 ? "..." : ""),
          tokensEstimate: estimateTokens(doc),
        };
      } catch (error: any) {
        result[key] = {
          preview: `Errore nella generazione: ${error.message}`,
          tokensEstimate: 0,
        };
      }
    }
  }

  return result;
}
