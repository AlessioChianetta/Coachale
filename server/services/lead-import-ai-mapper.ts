import { getSuperAdminGeminiKeys, GEMINI_3_MODEL } from "../ai/provider-factory";
import { GoogleGenAI } from "@google/genai";

interface ColumnData {
  name: string;
  sampleValues: string[];
}

interface AiMappingSuggestion {
  columnName: string;
  suggestedField: string | null;
  confidence: number;
  rationale: string;
}

const CRM_FIELDS = [
  { key: 'firstName', label: 'Nome', description: 'First name of the lead' },
  { key: 'lastName', label: 'Cognome', description: 'Last name of the lead' },
  { key: 'phoneNumber', label: 'Telefono', description: 'Phone number (required)' },
  { key: 'email', label: 'Email', description: 'Email address' },
  { key: 'company', label: 'Azienda', description: 'Company name' },
  { key: 'notes', label: 'Note', description: 'Notes or comments' },
  { key: 'obiettivi', label: 'Obiettivi', description: 'Goals/objectives' },
  { key: 'desideri', label: 'Desideri', description: 'Desires/wishes' },
  { key: 'uncino', label: 'Uncino/Hook', description: 'Hook/pain point' },
  { key: 'fonte', label: 'Fonte', description: 'Lead source' },
  { key: 'website', label: 'Sito Web', description: 'Website URL' },
  { key: 'address', label: 'Indirizzo', description: 'Street address' },
  { key: 'city', label: 'Città', description: 'City' },
  { key: 'state', label: 'Provincia', description: 'State/Province' },
  { key: 'postalCode', label: 'CAP', description: 'Postal code' },
  { key: 'country', label: 'Paese', description: 'Country' },
  { key: 'tags', label: 'Tags', description: 'Tags/labels' },
  { key: 'dateOfBirth', label: 'Data Nascita', description: 'Date of birth' },
  { key: 'dateCreated', label: 'Data Inserimento', description: 'Creation date' },
];

export async function aiMapColumns(columns: ColumnData[]): Promise<AiMappingSuggestion[]> {
  const geminiKeys = await getSuperAdminGeminiKeys();
  if (!geminiKeys || geminiKeys.keys.length === 0) {
    throw new Error("Gemini API non configurata");
  }

  const apiKey = geminiKeys.keys[0];
  const genAI = new GoogleGenAI({ apiKey });

  const prompt = `Sei un assistente AI che aiuta a mappare colonne di un foglio Google a campi CRM.

COLONNE DEL FOGLIO (con dati di esempio):
${columns.map((c, i) => `${i + 1}. "${c.name}" → Esempi: ${c.sampleValues.slice(0, 3).map(v => `"${v}"`).join(', ') || 'nessun dato'}`).join('\n')}

CAMPI CRM DISPONIBILI:
${CRM_FIELDS.map(f => `- ${f.key}: ${f.label} (${f.description})`).join('\n')}

Per ogni colonna del foglio, suggerisci quale campo CRM corrisponde meglio analizzando:
1. Il nome della colonna
2. I valori di esempio (pattern, formato)

Rispondi SOLO con un array JSON valido, senza altri commenti:
[
  {"columnName": "nome_colonna", "suggestedField": "firstName|lastName|phoneNumber|...|null", "confidence": 0-100, "rationale": "breve spiegazione"},
  ...
]

Se una colonna non corrisponde a nessun campo CRM (es. ID interni, codici tecnici), usa suggestedField: null.
Prioritizza la mappatura del campo phoneNumber che è obbligatorio.`;

  try {
    const response = await genAI.models.generateContent({
      model: GEMINI_3_MODEL,
      contents: prompt,
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[AI Mapper] No JSON found in response:', text);
      throw new Error('AI response invalid');
    }

    const suggestions = JSON.parse(jsonMatch[0]) as AiMappingSuggestion[];
    return suggestions;
  } catch (error) {
    console.error('[AI Mapper] Error:', error);
    throw error;
  }
}
