import { db } from '../db';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { getAIProvider, getModelWithThinking } from '../ai/provider-factory';

export interface BrandVoiceData {
  consultantDisplayName?: string;
  businessName?: string;
  businessDescription?: string;
  consultantBio?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  usp?: string;
  whoWeHelp?: string;
  whoWeDontHelp?: string;
  audienceSegments?: { name: string; description: string }[];
  whatWeDo?: string;
  howWeDoIt?: string;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string;
  softwareCreated?: { emoji: string; name: string; description: string }[];
  booksPublished?: { title: string; year: string }[];
  caseStudies?: { client: string; result: string }[];
  servicesOffered?: { name: string; price: string; description: string }[];
  guarantees?: string;
  personalTone?: string;
  contentPersonality?: string;
  audienceLanguage?: string;
  avoidPatterns?: string;
  writingExamples?: string[];
  signaturePhrases?: string[];
}

export function mapLucaReportToBrandVoice(
  clientProfileJson: any,
  reportJson: any
): BrandVoiceData {
  const profile = clientProfileJson || {};
  const report = reportJson || {};
  const profiloCliente = report.profilo_cliente || {};
  const diagnosi = report.diagnosi || {};

  const brandVoice: BrandVoiceData = {};

  brandVoice.consultantDisplayName = profiloCliente.nome || profile.nome_attivita || profile.nome || undefined;

  brandVoice.businessName = profile.nome_attivita || profiloCliente.nome || undefined;

  const descParts: string[] = [];
  if (profiloCliente.tipo_business) descParts.push(profiloCliente.tipo_business);
  if (profiloCliente.settore) descParts.push(`Settore: ${profiloCliente.settore}`);
  if (profiloCliente.nicchia) descParts.push(`Nicchia: ${profiloCliente.nicchia}`);
  if (profiloCliente.scala_descrizione) descParts.push(profiloCliente.scala_descrizione);
  if (diagnosi.dove_sei_ora) descParts.push(diagnosi.dove_sei_ora);
  if (descParts.length > 0) {
    brandVoice.businessDescription = descParts.join('. ');
  }

  const bioParts: string[] = [];
  if (profiloCliente.anni_attivita) bioParts.push(`${profiloCliente.anni_attivita} anni di attività`);
  if (profiloCliente.tipo_business) bioParts.push(profiloCliente.tipo_business);
  if (profiloCliente.settore) bioParts.push(`nel settore ${profiloCliente.settore}`);
  if (profiloCliente.citta) bioParts.push(`operante a ${profiloCliente.citta}`);
  if (bioParts.length > 0) {
    brandVoice.consultantBio = bioParts.join(', ') + '.';
  }

  if (diagnosi.dove_vuoi_arrivare) {
    brandVoice.vision = diagnosi.dove_vuoi_arrivare;
  }

  if (Array.isArray(profiloCliente.obiettivi_chiave) && profiloCliente.obiettivi_chiave.length > 0) {
    brandVoice.mission = profiloCliente.obiettivi_chiave.join('. ');
  }

  if (diagnosi.insight_chiave) {
    brandVoice.usp = diagnosi.insight_chiave;
  }

  if (profile.target_ideale || profile.descrizione_target) {
    brandVoice.whoWeHelp = profile.target_ideale || profile.descrizione_target;
  } else if (profiloCliente.nicchia) {
    brandVoice.whoWeHelp = `Professionisti e aziende nel settore ${profiloCliente.nicchia}`;
  }

  if (profile.servizi_offerti || profile.cosa_vendi) {
    brandVoice.whatWeDo = profile.servizi_offerti || profile.cosa_vendi;
  }

  if (profiloCliente.metodo_vendita) {
    brandVoice.howWeDoIt = profiloCliente.metodo_vendita;
  }

  if (profiloCliente.anni_attivita && typeof profiloCliente.anni_attivita === 'number') {
    brandVoice.yearsExperience = profiloCliente.anni_attivita;
  }

  const servizi = profile.servizi || profile.pacchetti || [];
  if (Array.isArray(servizi) && servizi.length > 0) {
    brandVoice.servicesOffered = servizi.map((s: any) => ({
      name: typeof s === 'string' ? s : (s.nome || s.name || ''),
      price: typeof s === 'string' ? '' : (s.prezzo || s.price || ''),
      description: typeof s === 'string' ? '' : (s.descrizione || s.description || ''),
    })).filter((s: any) => s.name);
  }

  if (Array.isArray(report.pacchetti_consigliati)) {
    const caseStudies: { client: string; result: string }[] = [];
    for (const pkg of report.pacchetti_consigliati) {
      if (pkg.cosa_va_bene) {
        caseStudies.push({
          client: pkg.nome_pacchetto || 'Area analizzata',
          result: typeof pkg.cosa_va_bene === 'string'
            ? pkg.cosa_va_bene.substring(0, 200)
            : JSON.stringify(pkg.cosa_va_bene).substring(0, 200),
        });
      }
    }
    if (caseStudies.length > 0) {
      brandVoice.caseStudies = caseStudies.slice(0, 5);
    }
  }

  if (Array.isArray(profiloCliente.canali_comunicazione) && profiloCliente.canali_comunicazione.length > 0) {
    brandVoice.audienceLanguage = `Canali principali: ${profiloCliente.canali_comunicazione.join(', ')}`;
  }

  if (Array.isArray(profiloCliente.strumenti_attuali) && profiloCliente.strumenti_attuali.length > 0) {
    brandVoice.values = profiloCliente.strumenti_attuali;
  }

  Object.keys(brandVoice).forEach(key => {
    const k = key as keyof BrandVoiceData;
    if (brandVoice[k] === undefined || brandVoice[k] === null || brandVoice[k] === '') {
      delete brandVoice[k];
    }
  });

  return brandVoice;
}

const BRAND_VOICE_AI_SYSTEM_PROMPT = `Sei un copywriter strategico esperto in brand positioning e comunicazione aziendale italiana.

Il tuo compito è analizzare i dati di onboarding di un consulente/imprenditore e generare un Brand Voice completo, professionale e coerente. Il Brand Voice verrà usato da un sistema AI per generare contenuti (post social, email, ads) che suonino autentici e allineati all'identità del brand.

REGOLE FONDAMENTALI:
- Scrivi SEMPRE in italiano
- NON inventare dati che non esistono nei documenti forniti. Se un campo non ha dati sufficienti, OMETTILO dal JSON (non includerlo affatto)
- Usa un tono professionale ma accessibile
- Ogni campo deve contenere testo ELABORATO e UTILE, non semplici copia-incolla dei dati grezzi
- I campi narrativi devono essere frasi complete e coerenti, non liste puntate di keyword

STRUTTURA JSON DA RESTITUIRE (includi SOLO i campi per cui hai dati sufficienti):

{
  "consultantDisplayName": "Il nome completo della persona o il nome con cui si presenta professionalmente",
  "businessName": "Il nome dell'attività/azienda/brand",
  "businessDescription": "Un paragrafo narrativo (3-5 frasi) che descrive cosa fa il business, in che settore opera, qual è la sua specializzazione e cosa lo rende unico. Deve suonare come la descrizione 'chi siamo' di un sito web professionale.",
  "consultantBio": "Una bio professionale in terza persona (3-5 frasi) che racconta il percorso, l'esperienza e le competenze chiave del consulente/imprenditore.",
  "vision": "Una frase ispirazionale che descrive il futuro che il business vuole contribuire a creare. Deve essere ambiziosa ma credibile.",
  "mission": "Una frase concreta che descrive COME il business persegue la sua vision — quali azioni, metodi o servizi usa per creare valore.",
  "values": ["Array di 3-6 valori aziendali VERI (es. 'Trasparenza', 'Risultati misurabili', 'Innovazione pragmatica'). NON inserire nomi di software o strumenti."],
  "usp": "La Unique Selling Proposition — una frase chiara e persuasiva che spiega perché un cliente dovrebbe scegliere questo business rispetto alla concorrenza.",
  "whoWeHelp": "Descrizione specifica del target ideale: chi sono, che problemi hanno, cosa cercano. Deve essere sufficientemente dettagliata da guidare la creazione di contenuti.",
  "whoWeDontHelp": "Chi NON è il cliente ideale — quali profili non sono adatti ai servizi offerti.",
  "audienceSegments": [{"name": "Nome segmento", "description": "Descrizione del segmento"}],
  "whatWeDo": "Descrizione chiara dei servizi/prodotti principali, scritta in modo che un potenziale cliente capisca immediatamente il valore offerto.",
  "howWeDoIt": "Il metodo o processo distintivo con cui il business lavora — il 'come' che lo differenzia.",
  "yearsExperience": 0,
  "clientsHelped": 0,
  "resultsGenerated": "Una frase che riassume i risultati principali ottenuti per i clienti.",
  "servicesOffered": [{"name": "Nome servizio", "price": "Prezzo se disponibile", "description": "Breve descrizione del servizio"}],
  "guarantees": "Le garanzie offerte ai clienti, se menzionate.",
  "personalTone": "Descrizione dello stile comunicativo personale (es. 'Diretto e pratico, usa metafore sportive, evita il gergo tecnico inutile, parla come un mentore esperto che vuole il meglio per i suoi clienti').",
  "contentPersonality": "La personalità che emerge nei contenuti (es. 'Autorevole ma accessibile, usa esempi concreti dal proprio lavoro, alterna momenti di ispirazione a consigli pratici e actionable').",
  "audienceLanguage": "Il linguaggio che il target usa e comprende — registri, termini specifici del settore, livello di formalità.",
  "avoidPatterns": "Cosa NON fare nella comunicazione — stili, parole o approcci da evitare.",
  "caseStudies": [{"client": "Nome/tipo cliente", "result": "Risultato ottenuto"}],
  "softwareCreated": [{"emoji": "🔧", "name": "Nome software", "description": "Descrizione"}],
  "booksPublished": [{"title": "Titolo", "year": "Anno"}],
  "writingExamples": [],
  "signaturePhrases": ["Frasi o espressioni ricorrenti tipiche del brand, se emergono dai dati."]
}

Rispondi con SOLO il JSON valido racchiuso tra i tag <json></json>. Nessun testo prima o dopo i tag.`;

export async function generateBrandVoiceWithAI(
  consultantId: string,
  clientProfileJson: any,
  reportJson: any
): Promise<BrandVoiceData> {
  try {
    console.log(`[Luca→BrandVoice AI] Starting AI generation for consultant ${consultantId}...`);

    const provider = await getAIProvider(consultantId);
    if (provider.setFeature) {
      provider.setFeature('brand-voice-generator', 'consultant');
    }
    const { model } = getModelWithThinking(provider.metadata?.providerName);

    const userPrompt = `Ecco i dati completi dell'onboarding e del report di analisi del consulente/imprenditore.

=== PROFILO CLIENTE (dati raccolti durante l'onboarding) ===
${JSON.stringify(clientProfileJson || {}, null, 2)}

=== REPORT DI ANALISI (generato da Luca dopo l'onboarding) ===
${JSON.stringify(reportJson || {}, null, 2)}

Analizza tutti i dati disponibili e genera il Brand Voice completo seguendo le istruzioni nel system prompt. Ricorda: includi SOLO i campi per cui hai dati sufficienti, NON inventare nulla.`;

    const result = await provider.client.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: 0 },
      },
      systemInstruction: { role: 'system', parts: [{ text: BRAND_VOICE_AI_SYSTEM_PROMPT }] },
    });

    const responseText = result.response.text();
    console.log(`[Luca→BrandVoice AI] Response received: ${responseText.length} chars`);

    const jsonMatch = responseText.match(/<json>([\s\S]*?)<\/json>/);
    let jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const parsed = JSON.parse(jsonStr) as BrandVoiceData;

    const cleaned: BrandVoiceData = {};
    const validKeys: (keyof BrandVoiceData)[] = [
      'consultantDisplayName', 'businessName', 'businessDescription', 'consultantBio',
      'vision', 'mission', 'values', 'usp', 'whoWeHelp', 'whoWeDontHelp',
      'audienceSegments', 'whatWeDo', 'howWeDoIt', 'yearsExperience', 'clientsHelped',
      'resultsGenerated', 'softwareCreated', 'booksPublished', 'caseStudies',
      'servicesOffered', 'guarantees', 'personalTone', 'contentPersonality',
      'audienceLanguage', 'avoidPatterns', 'writingExamples', 'signaturePhrases',
    ];

    for (const key of validKeys) {
      const val = (parsed as any)[key];
      if (val !== undefined && val !== null && val !== '') {
        if (Array.isArray(val) && val.length === 0) continue;
        (cleaned as any)[key] = val;
      }
    }

    const fieldCount = Object.keys(cleaned).length;
    console.log(`[Luca→BrandVoice AI] Successfully generated ${fieldCount} fields with AI`);
    return cleaned;
  } catch (err: any) {
    console.warn(`[Luca→BrandVoice AI] AI generation failed, falling back to static mapper: ${err.message}`);
    return mapLucaReportToBrandVoice(clientProfileJson, reportJson);
  }
}

export function extractDeepResearchParams(clientProfileJson: any, reportJson: any): {
  niche: string;
  targetAudience: string;
  whatYouSell: string;
  promisedResult: string;
} | null {
  const profile = clientProfileJson || {};
  const report = reportJson || {};
  const profiloCliente = report.profilo_cliente || {};
  const diagnosi = report.diagnosi || {};

  const niche = profiloCliente.nicchia || profiloCliente.settore || '';
  if (!niche) return null;

  return {
    niche,
    targetAudience: profile.target_ideale || profile.descrizione_target || profiloCliente.nicchia || '',
    whatYouSell: profile.servizi_offerti || profile.cosa_vendi || '',
    promisedResult: diagnosi.insight_chiave || '',
  };
}

export async function getLatestLucaReport(consultantId: string): Promise<{
  clientProfileJson: any;
  reportJson: any;
  sessionId: string;
} | null> {
  const result = await db.execute(sql`
    SELECT s.id as session_id, s.client_profile_json, r.report_json
    FROM delivery_agent_sessions s
    JOIN delivery_agent_reports r ON r.session_id = s.id::text
    WHERE s.consultant_id = ${consultantId}
      AND s.mode = 'onboarding'
      AND COALESCE(s.is_public, false) = false
      AND (s.lead_user_id IS NULL OR s.lead_user_id::text = s.consultant_id::text)
      AND s.status IN ('completed', 'assistant')
    ORDER BY r.created_at DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as any;
  return {
    clientProfileJson: row.client_profile_json,
    reportJson: row.report_json,
    sessionId: row.session_id,
  };
}

export async function saveBrandVoiceForConsultant(
  consultantId: string,
  brandVoice: BrandVoiceData
): Promise<void> {
  const [existing] = await db.select()
    .from(schema.contentStudioConfig)
    .where(eq(schema.contentStudioConfig.consultantId, consultantId))
    .limit(1);

  if (existing) {
    const existingBV = (existing.brandVoiceData as any) || {};
    const merged: any = { ...existingBV };
    for (const [key, value] of Object.entries(brandVoice)) {
      if (value !== undefined && value !== null && value !== '') {
        const existingVal = existingBV[key];
        if (!existingVal || existingVal === '' || (Array.isArray(existingVal) && existingVal.length === 0)) {
          merged[key] = value;
        }
      }
    }

    await db.update(schema.contentStudioConfig)
      .set({
        brandVoiceData: merged,
        brandVoiceEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.contentStudioConfig.consultantId, consultantId));
  } else {
    await db.insert(schema.contentStudioConfig).values({
      consultantId,
      brandVoiceData: brandVoice,
      brandVoiceEnabled: true,
    });
  }
}

export async function getLatestLucaSessionBrandVoice(consultantId: string): Promise<{
  brandVoiceData: BrandVoiceData;
  sessionId: string;
  clientProfileJson: any;
  reportJson: any;
} | null> {
  const result = await db.execute(sql`
    SELECT s.id as session_id, s.brand_voice_data, s.client_profile_json, r.report_json
    FROM delivery_agent_sessions s
    LEFT JOIN delivery_agent_reports r ON r.session_id = s.id::text
    WHERE s.consultant_id = ${consultantId}
      AND s.mode = 'onboarding'
      AND COALESCE(s.is_public, false) = false
      AND (s.lead_user_id IS NULL OR s.lead_user_id::text = s.consultant_id::text)
      AND s.status IN ('completed', 'assistant')
      AND s.brand_voice_data IS NOT NULL
    ORDER BY s.updated_at DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as any;
  if (!row.brand_voice_data || Object.keys(row.brand_voice_data).length === 0) return null;

  return {
    brandVoiceData: row.brand_voice_data,
    sessionId: row.session_id,
    clientProfileJson: row.client_profile_json,
    reportJson: row.report_json,
  };
}

export async function autoPopulateBrandVoiceFromLuca(
  consultantId: string,
  clientProfileJson: any,
  reportJson: any
): Promise<BrandVoiceData> {
  console.log(`[Luca→BrandVoice] Mapping report data for consultant ${consultantId}...`);

  const brandVoice = mapLucaReportToBrandVoice(clientProfileJson, reportJson);
  const fieldCount = Object.keys(brandVoice).length;
  console.log(`[Luca→BrandVoice] Mapped ${fieldCount} fields from Luca report`);

  await saveBrandVoiceForConsultant(consultantId, brandVoice);
  console.log(`[Luca→BrandVoice] Brand Voice saved for consultant ${consultantId}`);

  return brandVoice;
}
