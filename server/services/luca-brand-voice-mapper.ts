import { db } from '../db';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';

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
