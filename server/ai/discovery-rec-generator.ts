/**
 * Discovery Call REC Generator
 * 
 * Genera automaticamente un riepilogo strutturato della fase Discovery
 * usando Gemini 2.5 Flash per analizzare la trascrizione.
 * 
 * Viene chiamato quando si rileva la transizione discovery → demo (phase_3)
 * 
 * Supporta sia API key diretta che Vertex AI tramite provider-factory
 */

import { GoogleGenAI } from "@google/genai";
import { getAIProvider, getModelForProviderName, GeminiClient } from "./provider-factory";

export interface DiscoveryRec {
  motivazioneCall?: string;
  altroProvato?: string;
  tipoAttivita?: string;
  statoAttuale?: string;
  livelloFatturato?: string;
  problemi?: string[];
  statoIdeale?: string;
  urgenza?: string;
  decisionMaker?: boolean;
  budget?: string;
  obiezioniEmerse?: string[];
  noteAggiuntive?: string;
  generatedAt?: string;
}

const DISCOVERY_REC_PROMPT = `Sei un assistente AI specializzato nell'analisi di conversazioni di vendita in italiano.

COMPITO: Analizza la trascrizione della DISCOVERY CALL e compila un riepilogo strutturato (Discovery REC) con tutte le informazioni raccolte dal prospect.

TRASCRIZIONE DISCOVERY:
---
{{TRANSCRIPT}}
---

ISTRUZIONI:
1. Estrai SOLO informazioni ESPLICITAMENTE dette dal prospect
2. Se un campo non è stato discusso, lascialo vuoto (non inventare)
3. Per i problemi, elenca TUTTI quelli menzionati
4. Per l'urgenza, deduci dal tono e dalle parole usate (scala 1-10 o descrizione)
5. Sii fedele alle parole esatte del prospect quando possibile
6. Per decisionMaker: true se conferma di essere lui a decidere, false se menziona altri, null se non discusso

RISPONDI SOLO CON UN JSON VALIDO nel seguente formato:

{
  "motivazioneCall": "Perché ha chiamato/prenotato questa call",
  "altroProvato": "Altre soluzioni/servizi già provati",
  "tipoAttivita": "Settore e tipo di business del prospect",
  "statoAttuale": "Descrizione della situazione corrente",
  "livelloFatturato": "Range di fatturato menzionato",
  "problemi": ["problema 1", "problema 2"],
  "statoIdeale": "Dove vorrebbe arrivare, obiettivi",
  "urgenza": "Livello urgenza (1-10 o descrizione)",
  "decisionMaker": true,
  "budget": "Budget menzionato o range",
  "obiezioniEmerse": ["obiezione 1", "obiezione 2"],
  "noteAggiuntive": "Qualsiasi altra informazione rilevante"
}`;

/**
 * Genera il Discovery REC dalla trascrizione della conversazione
 * 
 * @param transcript - Trascrizione completa della fase discovery
 * @param apiKey - Gemini API key
 * @returns DiscoveryRec strutturato o null se errore
 */
export async function generateDiscoveryRec(
  transcript: string,
  apiKey: string
): Promise<DiscoveryRec | null> {

  console.log(`\n🔍 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[DiscoveryRecGenerator] Starting REC generation...`);
  console.log(`   📝 Transcript length: ${transcript.length} chars`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (!transcript || transcript.length < 100) {
    console.log(`⚠️ [DiscoveryRecGenerator] Transcript too short, skipping REC generation`);
    return null;
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });

    const prompt = DISCOVERY_REC_PROMPT.replace("{{TRANSCRIPT}}", transcript);

    const startTime = Date.now();

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-05-20",
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 20000,
      }
    });

    const elapsedMs = Date.now() - startTime;
    const text = response.text || '';

    console.log(`✅ [DiscoveryRecGenerator] Response received in ${elapsedMs}ms`);

    // Parse JSON response - rimuovi eventuale markdown wrapper
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const rec = JSON.parse(jsonText) as DiscoveryRec;

    // Aggiungi timestamp
    rec.generatedAt = new Date().toISOString();

    console.log(`📋 [DiscoveryRecGenerator] REC generated successfully:`);
    console.log(`   - Problemi identificati: ${rec.problemi?.length || 0}`);
    console.log(`   - Urgenza: ${rec.urgenza || 'N/A'}`);
    console.log(`   - Decision Maker: ${rec.decisionMaker}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return rec;

  } catch (error) {
    console.error(`❌ [DiscoveryRecGenerator] Error generating REC:`, error);
    return null;
  }
}

/**
 * Formatta il Discovery REC per l'iniezione nel contesto del Sales Agent
 * 
 * @param rec - Il Discovery REC da formattare
 * @returns Stringa formattata per il prompt
 */
export function formatDiscoveryRecForPrompt(rec: DiscoveryRec): string {
  const sections: string[] = [];

  sections.push(`
# 📋 DISCOVERY CALL REC - RIEPILOGO DISCOVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANTE: Queste sono le informazioni raccolte durante la fase Discovery.
USA QUESTI DATI per personalizzare la Demo e rispondere alle obiezioni!
`);

  if (rec.motivazioneCall || rec.altroProvato || rec.tipoAttivita) {
    sections.push(`
## 🎯 MOTIVAZIONE E BACKGROUND`);
    if (rec.motivazioneCall) sections.push(`- **Perché ha chiamato:** ${rec.motivazioneCall}`);
    if (rec.altroProvato) sections.push(`- **Cosa ha già provato:** ${rec.altroProvato}`);
    if (rec.tipoAttivita) sections.push(`- **Tipo di attività:** ${rec.tipoAttivita}`);
  }

  if (rec.statoAttuale || rec.livelloFatturato || (rec.problemi && rec.problemi.length > 0)) {
    sections.push(`
## 📊 SITUAZIONE ATTUALE`);
    if (rec.statoAttuale) sections.push(`- **Stato attuale:** ${rec.statoAttuale}`);
    if (rec.livelloFatturato) sections.push(`- **Livello fatturato:** ${rec.livelloFatturato}`);
    if (rec.problemi && rec.problemi.length > 0) {
      sections.push(`- **Problemi identificati:**`);
      rec.problemi.forEach(p => sections.push(`  • ${p}`));
    }
  }

  if (rec.statoIdeale) {
    sections.push(`
## 🎯 OBIETTIVI`);
    sections.push(`- **Stato ideale:** ${rec.statoIdeale}`);
  }

  sections.push(`
## ✅ QUALIFICA`);
  if (rec.urgenza) sections.push(`- **Urgenza:** ${rec.urgenza}`);
  if (rec.budget) sections.push(`- **Budget:** ${rec.budget}`);
  if (rec.decisionMaker !== undefined && rec.decisionMaker !== null) {
    sections.push(`- **Decision Maker:** ${rec.decisionMaker ? 'SÌ' : 'NO'}`);
  }

  if (rec.obiezioniEmerse && rec.obiezioniEmerse.length > 0) {
    sections.push(`
## ⚠️ OBIEZIONI GIÀ EMERSE`);
    rec.obiezioniEmerse.forEach(o => sections.push(`  • ${o}`));
  }

  if (rec.noteAggiuntive) {
    sections.push(`
## 📝 NOTE AGGIUNTIVE
${rec.noteAggiuntive}`);
  }

  sections.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ USA queste info per:
1. Richiamare i PROBLEMI specifici durante la demo
2. Collegare i benefici ai suoi OBIETTIVI
3. Anticipare OBIEZIONI basate sulle sue preoccupazioni
4. Adattare il TONO in base all'urgenza
`);

  return sections.join('\n');
}

/**
 * Genera il Discovery REC usando il provider factory (Vertex AI o Google AI Studio)
 * 
 * Usa il sistema a 3-tier del provider-factory:
 * 1. Client Vertex AI (self-managed)
 * 2. Admin Vertex AI (consultant-managed)  
 * 3. Google AI Studio (fallback)
 * 
 * @param transcript - Trascrizione completa della fase discovery
 * @param clientId - ID del cliente per la selezione del provider
 * @param consultantId - ID del consulente (opzionale) per il fallback
 * @returns DiscoveryRec strutturato o null se errore
 */
export async function generateDiscoveryRecWithProvider(
  transcript: string,
  clientId: string,
  consultantId?: string
): Promise<DiscoveryRec | null> {

  console.log(`\n🔍 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[DiscoveryRecGenerator] Starting REC generation with Provider Factory...`);
  console.log(`   📝 Transcript length: ${transcript.length} chars`);
  console.log(`   👤 Client: ${clientId}`);
  console.log(`   👔 Consultant: ${consultantId || 'none'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (!transcript || transcript.length < 100) {
    console.log(`⚠️ [DiscoveryRecGenerator] Transcript too short, skipping REC generation`);
    return null;
  }

  try {
    const providerResult = await getAIProvider(clientId, consultantId);
    const client = providerResult.client;

    console.log(`✅ [DiscoveryRecGenerator] Using provider: ${providerResult.source}`);

    const prompt = DISCOVERY_REC_PROMPT.replace("{{TRANSCRIPT}}", transcript);

    const startTime = Date.now();

    const response = await client.generateContent({
      model: getModelForProviderName(providerMetadata.name),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 20000,
      }
    });

    const elapsedMs = Date.now() - startTime;
    const text = response.response.text();

    console.log(`✅ [DiscoveryRecGenerator] Response received in ${elapsedMs}ms`);

    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let rec: DiscoveryRec;
    
    // Helper function to attempt JSON parsing with various cleanups
    const tryParseJSON = (text: string): DiscoveryRec | null => {
      // First, try parsing as-is (most common case - valid JSON)
      try {
        return JSON.parse(text) as DiscoveryRec;
      } catch {
        // Continue to cleanup attempts
      }
      
      // Try extracting just the JSON object if wrapped in text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as DiscoveryRec;
        } catch {
          // Continue to more aggressive cleanup
        }
        
        // Try cleaning the extracted JSON
        let cleanedJson = jsonMatch[0]
          // Remove any BOM or invisible characters
          .replace(/^\uFEFF/, '')
          // Fix escaped quotes that might be double-escaped
          .replace(/\\\\"/g, '\\"')
          // Remove control characters except valid JSON whitespace
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        try {
          return JSON.parse(cleanedJson) as DiscoveryRec;
        } catch {
          // Continue
        }
      }
      
      return null;
    };
    
    const parsedRec = tryParseJSON(jsonText);
    
    if (parsedRec) {
      rec = parsedRec;
      console.log(`✅ [DiscoveryRecGenerator] JSON parsed successfully`);
    } else {
      // Log detailed error for debugging
      console.error(`❌ [DiscoveryRecGenerator] JSON parse failed`);
      console.error(`   Response length: ${jsonText.length} chars`);
      console.error(`   First 500 chars: ${jsonText.substring(0, 500)}`);
      console.error(`   Last 200 chars: ${jsonText.substring(Math.max(0, jsonText.length - 200))}`);
      
      // Check for common issues and provide specific error messages
      if (jsonText.includes('```')) {
        console.error(`   Hint: Response may still contain markdown code blocks`);
      }
      if (!jsonText.startsWith('{')) {
        console.error(`   Hint: Response doesn't start with '{', might have preamble text`);
      }
      
      throw new Error(`Failed to parse JSON response from AI model`);
    }

    rec.generatedAt = new Date().toISOString();

    console.log(`📋 [DiscoveryRecGenerator] REC generated successfully:`);
    console.log(`   - Provider: ${providerResult.source}`);
    console.log(`   - Problemi identificati: ${rec.problemi?.length || 0}`);
    console.log(`   - Urgenza: ${rec.urgenza || 'N/A'}`);
    console.log(`   - Decision Maker: ${rec.decisionMaker}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (providerResult.cleanup) {
      await providerResult.cleanup();
    }

    return rec;

  } catch (error) {
    console.error(`❌ [DiscoveryRecGenerator] Error generating REC:`, error);
    return null;
  }
}
