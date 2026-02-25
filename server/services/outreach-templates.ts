import type { LeadScraperResult, LeadScraperSalesContext } from "../../shared/schema";

const LOG_PREFIX = "📝 [OUTREACH-TEMPLATES]";

export interface OutreachLead {
  id: string;
  businessName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number | null;
  reviewsCount: number | null;
  category: string | null;
  websiteData: {
    emails?: string[];
    phones?: string[];
    socialLinks?: Record<string, string>;
    description?: string;
    services?: string[];
  } | null;
  aiSalesSummary: string | null;
  aiCompatibilityScore: number | null;
  leadStatus: string | null;
  source: string | null;
}

export interface SalesContext {
  servicesOffered: string | null;
  targetAudience: string | null;
  valueProposition: string | null;
  pricingInfo: string | null;
  competitiveAdvantages: string | null;
  idealClientProfile: string | null;
  salesApproach: string | null;
  caseStudies: string | null;
  additionalContext: string | null;
}

export interface WhatsAppConfig {
  id: string;
  name: string;
  personality?: string;
  instructions?: string;
}

export interface CallInstruction {
  callInstruction: string;
  suggestedTemplateId: string;
  leadContext: string;
  objective: string;
}

export interface WhatsAppInstruction {
  aiInstruction: string;
  leadContext: string;
  toneGuidance: string;
}

export interface EmailContent {
  subject: string;
  body: string;
  leadContext: string;
  cta: string;
}

function buildLeadProfileSection(lead: OutreachLead): string {
  const parts: string[] = [];

  if (lead.businessName) parts.push(`Azienda: ${lead.businessName}`);
  if (lead.category) parts.push(`Settore: ${lead.category}`);
  if (lead.address) parts.push(`Sede: ${lead.address}`);
  if (lead.website) parts.push(`Sito web: ${lead.website}`);
  if (lead.rating) parts.push(`Recensioni Google: ${lead.rating}/5 (${lead.reviewsCount || 0} recensioni)`);

  if (lead.websiteData) {
    if (lead.websiteData.description) {
      parts.push(`Descrizione dal sito: ${lead.websiteData.description.substring(0, 300)}`);
    }
    if (lead.websiteData.services && lead.websiteData.services.length > 0) {
      parts.push(`Servizi offerti: ${lead.websiteData.services.join(", ")}`);
    }
    if (lead.websiteData.socialLinks && Object.keys(lead.websiteData.socialLinks).length > 0) {
      parts.push(`Social: ${Object.entries(lead.websiteData.socialLinks).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
    }
  }

  if (lead.aiSalesSummary) {
    parts.push(`Analisi AI: ${lead.aiSalesSummary.substring(0, 500)}`);
  }
  if (lead.aiCompatibilityScore != null) {
    parts.push(`Score compatibilità AI: ${lead.aiCompatibilityScore}/100`);
  }

  return parts.join("\n");
}

function buildSalesContextSection(ctx: SalesContext): string {
  const parts: string[] = [];
  if (ctx.servicesOffered) parts.push(`Servizi: ${ctx.servicesOffered}`);
  if (ctx.targetAudience) parts.push(`Target: ${ctx.targetAudience}`);
  if (ctx.valueProposition) parts.push(`Proposta di valore: ${ctx.valueProposition}`);
  if (ctx.competitiveAdvantages) parts.push(`Vantaggi competitivi: ${ctx.competitiveAdvantages}`);
  if (ctx.idealClientProfile) parts.push(`Cliente ideale: ${ctx.idealClientProfile}`);
  if (ctx.salesApproach) parts.push(`Approccio vendita: ${ctx.salesApproach}`);
  if (ctx.caseStudies) parts.push(`Case study: ${ctx.caseStudies}`);
  if (ctx.additionalContext) parts.push(`Contesto aggiuntivo: ${ctx.additionalContext}`);
  return parts.join("\n");
}

function isWarmLead(lead: OutreachLead): boolean {
  return lead.leadStatus === "contattato" || lead.leadStatus === "in_trattativa";
}

function isHighPotentialLead(lead: OutreachLead): boolean {
  return (lead.aiCompatibilityScore != null && lead.aiCompatibilityScore >= 80) ||
    (lead.rating != null && lead.rating >= 4.5 && (lead.reviewsCount ?? 0) >= 50);
}

export function generateCallInstruction(lead: OutreachLead, salesContext: SalesContext): CallInstruction {
  console.log(`${LOG_PREFIX} Generating call instruction for lead: ${lead.businessName} (id: ${lead.id})`);

  const leadProfile = buildLeadProfileSection(lead);
  const salesProfile = buildSalesContextSection(salesContext);
  const warm = isWarmLead(lead);
  const highPotential = isHighPotentialLead(lead);
  const suggestedTemplateId = selectVoiceTemplate(lead, salesContext);

  let objective: string;
  if (warm) {
    objective = "Follow-up su contatto precedente. Riallacciare la conversazione, verificare interesse e fissare appuntamento concreto.";
  } else if (highPotential) {
    objective = "Lead ad alto potenziale. Presentare proposta di valore mirata, creare urgenza e portare direttamente all'appuntamento.";
  } else {
    objective = "Primo contatto cold. Qualificare il lead, verificare bisogni e interesse, proporre appuntamento esplorativo.";
  }

  const callInstruction = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CONTESTO STRATEGICO CHIAMATA (da Hunter)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 OBIETTIVO: ${objective}

📊 PROFILO LEAD:
${leadProfile}

💼 PROFILO CONSULENTE:
${salesProfile}

${warm ? `⚠️ NOTA: Questo lead è già stato contattato in precedenza (status: ${lead.leadStatus}). Adatta il tono di conseguenza, fai riferimento al contatto precedente.` : ""}
${highPotential ? `⭐ NOTA: Lead ad alto potenziale (score: ${lead.aiCompatibilityScore}/100). Investi più tempo nella qualificazione e nella proposta di valore.` : ""}

📋 PUNTI CHIAVE DA ESPLORARE:
- Situazione attuale del business del lead
- Sfide principali nel loro settore (${lead.category || "da verificare"})
- Come i nostri servizi possono risolvere problemi specifici
- Tempistiche e urgenza del bisogno
- Budget e processo decisionale

🚫 DA EVITARE:
- NON menzionare prezzi specifici
- NON essere troppo aggressivo o pushy
- NON inventare informazioni non presenti nel profilo
`.trim();

  console.log(`${LOG_PREFIX} Call instruction generated (${callInstruction.length} chars), template: ${suggestedTemplateId}`);

  return {
    callInstruction,
    suggestedTemplateId,
    leadContext: leadProfile,
    objective,
  };
}

export function generateWhatsAppInstruction(
  lead: OutreachLead,
  salesContext: SalesContext,
  whatsappConfig?: WhatsAppConfig | null,
): WhatsAppInstruction {
  console.log(`${LOG_PREFIX} Generating WhatsApp instruction for lead: ${lead.businessName} (id: ${lead.id})`);

  const leadProfile = buildLeadProfileSection(lead);
  const salesProfile = buildSalesContextSection(salesContext);
  const warm = isWarmLead(lead);

  let toneGuidance: string;
  if (warm) {
    toneGuidance = "Tono amichevole e diretto. Fai riferimento al contatto precedente. Sii conciso e proponi un passo concreto.";
  } else {
    toneGuidance = "Tono professionale ma cordiale. Primo contatto: sii breve, specifico e personalizzato. Cita qualcosa di specifico del loro business.";
  }

  const aiInstruction = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 CONTESTO STRATEGICO WHATSAPP (da Hunter via Stella)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 TIPO CONTATTO: ${warm ? "Follow-up (lead già contattato)" : "Primo contatto cold outreach"}

📊 PROFILO LEAD:
${leadProfile}

💼 PERCHÉ CONTATTARE QUESTO LEAD:
${salesContext.valueProposition ? `Proposta di valore: ${salesContext.valueProposition}` : "Analizzare il profilo e proporre i servizi del consulente."}
${lead.aiSalesSummary ? `Analisi AI: ${lead.aiSalesSummary.substring(0, 300)}` : ""}

🎨 TONO: ${toneGuidance}

${whatsappConfig?.personality ? `👤 PERSONALITÀ DIPENDENTE WA: ${whatsappConfig.personality}` : ""}
${whatsappConfig?.instructions ? `📋 ISTRUZIONI BASE DIPENDENTE: ${whatsappConfig.instructions}` : ""}

📋 LINEE GUIDA:
- Personalizza il messaggio con dati REALI del lead (nome azienda, settore, servizi)
- Sii conciso: max 2-3 frasi nel template
- Cita un elemento specifico del loro business per catturare attenzione
- Proponi valore chiaro e specifico
- CTA: proponi una chiamata conoscitiva o un appuntamento
- NON menzionare prezzi
- NON usare linguaggio da spam o troppo commerciale
`.trim();

  console.log(`${LOG_PREFIX} WhatsApp instruction generated (${aiInstruction.length} chars)`);

  return {
    aiInstruction,
    leadContext: leadProfile,
    toneGuidance,
  };
}

export function generateEmailContent(lead: OutreachLead, salesContext: SalesContext): EmailContent {
  console.log(`${LOG_PREFIX} Generating email content for lead: ${lead.businessName} (id: ${lead.id})`);

  const leadProfile = buildLeadProfileSection(lead);
  const warm = isWarmLead(lead);

  const businessRef = lead.businessName || "la vostra attività";
  const sectorRef = lead.category || "il vostro settore";

  let subject: string;
  if (warm) {
    subject = `Seguito alla nostra conversazione — ${businessRef}`;
  } else if (lead.aiCompatibilityScore != null && lead.aiCompatibilityScore >= 80) {
    subject = `Un'opportunità specifica per ${businessRef}`;
  } else {
    subject = `Collaborazione strategica per ${businessRef}`;
  }

  const bodyParts: string[] = [];

  bodyParts.push(`Buongiorno,`);
  bodyParts.push(``);

  if (warm) {
    bodyParts.push(`mi permetto di ricontattarvi in seguito alla nostra precedente conversazione riguardo ${businessRef}.`);
  } else {
    if (lead.websiteData?.description) {
      bodyParts.push(`ho avuto modo di analizzare ${businessRef} e il vostro posizionamento nel settore ${sectorRef}. ${lead.websiteData.description.substring(0, 150)}.`);
    } else {
      bodyParts.push(`mi permetto di contattarvi perché, analizzando il mercato ${sectorRef}, ho individuato ${businessRef} come un'azienda con un potenziale significativo.`);
    }
  }

  bodyParts.push(``);

  if (salesContext.valueProposition) {
    bodyParts.push(`La nostra proposta: ${salesContext.valueProposition}`);
    bodyParts.push(``);
  }

  if (salesContext.competitiveAdvantages) {
    bodyParts.push(`Cosa ci distingue: ${salesContext.competitiveAdvantages}`);
    bodyParts.push(``);
  }

  if (lead.aiSalesSummary) {
    const summaryExcerpt = lead.aiSalesSummary.substring(0, 200);
    bodyParts.push(`Dalla nostra analisi: ${summaryExcerpt}`);
    bodyParts.push(``);
  }

  const cta = "Sarebbe interessato/a a una breve call conoscitiva di 15 minuti per esplorare come potremmo collaborare?";
  bodyParts.push(cta);
  bodyParts.push(``);
  bodyParts.push(`Resto a disposizione per qualsiasi domanda.`);
  bodyParts.push(``);
  bodyParts.push(`Cordiali saluti`);

  const body = bodyParts.join("\n");

  console.log(`${LOG_PREFIX} Email content generated: subject="${subject}" (body: ${body.length} chars)`);

  return {
    subject,
    body,
    leadContext: leadProfile,
    cta,
  };
}

export function selectVoiceTemplate(lead: OutreachLead, salesContext: SalesContext): string {
  console.log(`${LOG_PREFIX} Selecting voice template for lead: ${lead.businessName} (score: ${lead.aiCompatibilityScore}, status: ${lead.leadStatus})`);

  const warm = isWarmLead(lead);
  const highPotential = isHighPotentialLead(lead);

  let templateId: string;

  if (warm) {
    templateId = "follow-up-lead";
  } else if (highPotential) {
    templateId = "sales-orbitale";
  } else {
    templateId = "smart-qualifier-outbound";
  }

  console.log(`${LOG_PREFIX} Selected template: ${templateId} (warm=${warm}, highPotential=${highPotential})`);
  return templateId;
}
