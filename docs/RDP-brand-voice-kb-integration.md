# RDP: Brand Voice & Knowledge Base Integration per Content Studio Ideas

## Obiettivo
Integrare la sezione "Brand Voice & Credibilità" e la selezione documenti Knowledge Base nella pagina Content Studio Ideas per arricchire la generazione di idee con contesto personalizzato.

---

## FRONTEND

### Nuovi Componenti

#### 1. `BrandVoiceSection.tsx`
**Path**: `client/src/components/brand-voice/BrandVoiceSection.tsx`

**Props**:
```typescript
interface BrandVoiceSectionProps {
  consultantId: string;
  onDataChange?: (data: BrandVoiceData) => void;
  showImportButton?: boolean;
  compact?: boolean; // versione compatta per Ideas
}
```

**Struttura**:
- Header con titolo + bottone "Importa da Agente"
- 4 Card collassabili (Collapsible):
  1. Informazioni Business (nome, bio, descrizione)
  2. Authority & Posizionamento (vision, mission, USP, valori)
  3. Credenziali & Risultati (anni exp, clienti, case studies)
  4. Servizi & Garanzie (servizi offerti, garanzie)

#### 2. `KnowledgeBaseSelector.tsx`
**Path**: `client/src/components/brand-voice/KnowledgeBaseSelector.tsx`

**Props**:
```typescript
interface KnowledgeBaseSelectorProps {
  consultantId: string;
  selectedDocIds: string[];
  onSelectionChange: (docIds: string[]) => void;
  maxTokens?: number; // default 50000
}
```

**Struttura**:
- Lista documenti KB con checkbox
- Contatore token totali (stima ~4 char = 1 token)
- Warning se > 50k tokens
- Badge con tipo file (PDF, DOCX, TXT)

### Modifiche Pagine Esistenti

#### `ideas.tsx` (Content Studio)
- Aggiungere nuova sezione accordion "Brand Voice & Contesto"
- Toggle per attivare/disattivare Brand Voice
- Toggle per attivare/disattivare contesto KB
- Selettore documenti KB (quando attivo)
- Passare dati a API generazione idee

---

## BACKEND

### Endpoint Esistenti (riutilizzati)
- `GET /api/consultant/:id/brand-voice` - Carica dati brand voice
- `PUT /api/consultant/:id/brand-voice` - Salva dati brand voice
- `GET /api/agents` - Lista agenti per import
- `GET /api/agents/:id` - Dettaglio agente per import

### Nuovi Endpoint

#### `GET /api/consultant/:id/kb-documents`
**Response**:
```json
{
  "documents": [
    {
      "id": "uuid",
      "name": "Catalogo 2024.pdf",
      "type": "pdf",
      "size": 245000,
      "tokenEstimate": 12500,
      "createdAt": "2024-01-15"
    }
  ]
}
```

#### `POST /api/consultant/:id/kb-documents/content`
**Request**:
```json
{
  "documentIds": ["uuid1", "uuid2"]
}
```
**Response**:
```json
{
  "content": "Testo concatenato dei documenti...",
  "totalTokens": 35000
}
```

### Modifica Endpoint Generazione Idee

#### `POST /api/content-ideas/generate`
**Request aggiornata**:
```json
{
  "topic": "...",
  "targetAudience": "...",
  "objective": "...",
  // ... altri campi esistenti ...
  "brandVoice": { ... },           // NUOVO: dati brand voice
  "kbDocumentIds": ["uuid1", ...]  // NUOVO: documenti KB da includere
}
```

**Logica**:
1. Se `brandVoice` presente → aggiungi al system prompt
2. Se `kbDocumentIds` presente → fetch contenuto documenti, aggiungi al system prompt
3. Genera idee con contesto arricchito

---

## DATABASE

### Tabelle Esistenti (nessuna modifica)
- `consultant_brand_voice` - Dati brand voice
- `ai_knowledge_base_documents` - Documenti KB
- `ai_knowledge_base_chunks` - Chunks per RAG

### Query Necessarie

```sql
-- Fetch documenti KB per un consulente
SELECT 
  id, 
  file_name as name,
  file_type as type,
  file_size as size,
  LENGTH(extracted_text) / 4 as token_estimate,
  created_at
FROM ai_knowledge_base_documents
WHERE consultant_id = $1
ORDER BY created_at DESC;

-- Fetch contenuto documenti selezionati
SELECT extracted_text
FROM ai_knowledge_base_documents
WHERE id = ANY($1) AND consultant_id = $2;
```

---

## STATO IMPLEMENTAZIONE

| Task | Status | Note |
|------|--------|------|
| 1. BrandVoiceSection component | ✅ Done | Created at client/src/components/brand-voice/ |
| 2. KnowledgeBaseSelector component | ✅ Done | Created with token counter + 50k limit warning |
| 3. Integrazione in Ideas page | ✅ Done | Added new accordion with toggles + components |
| 4. API generazione idee update | ✅ Done | Backend + Frontend updated |
| 5. Refactor consultant-ai-config | ✅ Done | Replaced ~600 lines with component |

---

## Note Tecniche

- **Token Limit**: Max 50k tokens per contenuto KB (no troncamento, warning se superato)
- **Stima Token**: ~4 caratteri = 1 token (approssimazione)
- **Caching**: Brand Voice cachato in React Query, invalidato su modifica
