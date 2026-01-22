/**
 * Dynamic Context Documents Service
 * 
 * Generates and syncs dynamic documents to File Search for comprehensive AI context:
 * - WhatsApp conversation history (complete messages, not cropped)
 * - Proactive Lead Hub metrics (per agent, templates used, appointments)
 * - AI limitations document (what the assistant can and cannot do)
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
} from "../../shared/schema";
import { eq, and, desc, gte, sql, count as sqlCount, inArray } from "drizzle-orm";
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
  totalDocuments: number;
  syncedAt: Date;
}

function formatItalianDate(date: Date | string | null): string {
  if (!date) return "N/A";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
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
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const conversations = await db
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

  if (conversations.length === 0) {
    return `# Storico Conversazioni WhatsApp

Nessuna conversazione negli ultimi 30 giorni.

Generato il: ${formatItalianDate(new Date())}
`;
  }

  const conversationIds = conversations.map((c) => c.id);

  const messages = await db
    .select({
      id: whatsappMessages.id,
      conversationId: whatsappMessages.conversationId,
      messageText: whatsappMessages.messageText,
      sender: whatsappMessages.sender,
      status: whatsappMessages.status,
      templateName: whatsappMessages.templateName,
      createdAt: whatsappMessages.createdAt,
    })
    .from(whatsappMessages)
    .where(inArray(whatsappMessages.conversationId, conversationIds))
    .orderBy(whatsappMessages.createdAt);

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
        const templateInfo = msg.templateName ? ` [Template: ${msg.templateName}]` : "";
        const statusInfo = msg.status ? ` (${msg.status})` : "";

        document += `**${formatItalianDate(msg.createdAt)}** - ${senderLabel}${templateInfo}${statusInfo}
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
- **Template utilizzati**: ${[...new Set(messages.filter((m) => m.templateName).map((m) => m.templateName))].join(", ") || "Nessuno"}
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

/**
 * Sync all dynamic documents to File Search for a consultant
 */
export async function syncDynamicDocuments(consultantId: string): Promise<SyncResult> {
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
    const conversationDoc = await generateConversationHistoryDocument(consultantId);
    const convResult = await fileSearchService.uploadDocumentFromContent({
      content: conversationDoc,
      displayName: "Storico Conversazioni WhatsApp (Auto-generato)",
      storeId,
      sourceType: "consultant_guide",
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
  }

  try {
    const metricsDoc = await generateLeadHubMetricsDocument(consultantId);
    const metricsResult = await fileSearchService.uploadDocumentFromContent({
      content: metricsDoc,
      displayName: "Metriche Hub Lead Proattivo (Auto-generato)",
      storeId,
      sourceType: "consultant_guide",
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
      sourceType: "consultant_guide",
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

  console.log(`📄 [DynamicDocs] Sync complete: ${results.totalDocuments}/3 documents synced`);
  return results;
}

/**
 * Get a preview of what would be synced (for UI display)
 */
export async function previewDynamicDocuments(consultantId: string): Promise<{
  conversationHistory: { preview: string; tokensEstimate: number };
  leadHubMetrics: { preview: string; tokensEstimate: number };
  aiLimitations: { preview: string; tokensEstimate: number };
}> {
  const conversationDoc = await generateConversationHistoryDocument(consultantId);
  const metricsDoc = await generateLeadHubMetricsDocument(consultantId);
  const limitationsDoc = generateAILimitationsDocument();

  return {
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
}
