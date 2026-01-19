# Analisi Critica RDP: Compute-First Data Analysis

Documento di revisione con domande per ogni sezione e risposte basate su ricerche web e best practices 2024.

---

## 1. UPLOAD & PARSING EXCEL

### Domande Critiche

| # | Domanda | Risposta (da ricerca) |
|---|---------|----------------------|
| 1 | **Quale libreria usare per file Excel grandi (50MB+)?** | **ExcelJS con streaming** è la migliore per file grandi. xlsx (SheetJS) carica tutto in memoria. Per file >50MB, usare `ExcelJS.stream.xlsx.WorkbookReader` che processa riga per riga con footprint memoria minimo. |
| 2 | **Come gestire file con 1M+ righe senza crash?** | Usare **streaming + batch processing**. Leggere 1000 righe alla volta, inserire nel DB, poi continuare. Mai caricare tutto in RAM. |
| 3 | **CSV è più veloce di Excel?** | Sì, **5-10x più veloce**. csv-parser processa 90.000 righe/sec vs ~15.000/sec per Excel. Considerare conversione automatica Excel→CSV sul server prima di processare. |
| 4 | **Come gestire encoding diversi (UTF-8, Latin1)?** | Usare libreria `chardet` per rilevare encoding automaticamente, poi convertire a UTF-8 prima di parsing. |
| 5 | **Cosa fare se il file è corrotto o malformato?** | Wrappare parsing in try-catch, loggare errore specifico, restituire errore user-friendly. Mai crashare il server. |

### Modifiche Necessarie al RDP

```typescript
// PRIMA: Usavamo xlsx standard
import XLSX from 'xlsx';
const workbook = XLSX.readFile(filePath); // CARICA TUTTO IN RAM!

// DOPO: Usare ExcelJS streaming
import ExcelJS from 'exceljs';

async function processLargeExcel(filePath: string) {
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath);
  const rows: any[] = [];
  let batchCount = 0;
  
  for await (const worksheetReader of workbookReader) {
    for await (const row of worksheetReader) {
      rows.push(row.values);
      
      // Batch insert ogni 1000 righe
      if (rows.length >= 1000) {
        await insertBatch(rows);
        rows.length = 0;
        batchCount++;
      }
    }
  }
  
  // Insert rimanenti
  if (rows.length > 0) {
    await insertBatch(rows);
  }
}
```

---

## 2. DATABASE & TABELLE DINAMICHE

### Domande Critiche

| # | Domanda | Risposta (da ricerca) |
|---|---------|----------------------|
| 1 | **Drizzle ORM supporta tabelle dinamiche runtime?** | **NO nativamente**. Drizzle è progettato per schema statici. Per tabelle dinamiche, usare **raw SQL con `sql.identifier()`** per sicurezza. Non usare Drizzle per DDL dinamico. |
| 2 | **Come prevenire SQL injection nei nomi tabella?** | Usare **`format('%I', nome)` in PostgreSQL** o validare con regex whitelist `^[a-z_][a-z0-9_]*$`. Mai concatenare stringhe direttamente. |
| 3 | **RLS è sufficiente per multi-tenant?** | Sì per isolamento dati, ma servono **indici su tenant_id** per performance. Usare `SET LOCAL app.current_tenant` in transazioni per evitare context leak con connection pooling. |
| 4 | **Come gestire connection pooling con RLS?** | **CRITICO**: Usare sempre `SET LOCAL` (non `SET`) dentro transazioni. `SET LOCAL` si resetta automaticamente al COMMIT/ROLLBACK, evitando leak tra request. |
| 5 | **Limiti PostgreSQL per nomi tabelle?** | Max 63 caratteri. Pattern `cdd_{consultantId}_{clientId}_{dataset}` deve rispettare questo limite. |

### Modifiche Necessarie al RDP

```typescript
// AGGIUNGERE: Validazione nome tabella rigorosa
const MAX_TABLE_NAME_LENGTH = 63;
const SAFE_NAME_REGEX = /^[a-z_][a-z0-9_]*$/;

function sanitizeTableName(input: string): string {
  let safe = input.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!/^[a-z_]/.test(safe)) safe = 'tbl_' + safe;
  if (safe.length > MAX_TABLE_NAME_LENGTH) {
    safe = safe.substring(0, MAX_TABLE_NAME_LENGTH);
  }
  if (!SAFE_NAME_REGEX.test(safe)) {
    throw new Error(`Nome tabella non valido: ${input}`);
  }
  return safe;
}

// AGGIUNGERE: Context tenant in transazione
async function executeWithTenant(consultantId: number, callback: Function) {
  return await db.transaction(async (tx) => {
    // SET LOCAL si resetta automaticamente al COMMIT
    await tx.execute(sql`SET LOCAL app.current_consultant = ${consultantId}`);
    return await callback(tx);
  });
}
```

---

## 3. AI COLUMN DISCOVERY

### Domande Critiche

| # | Domanda | Risposta (da ricerca) |
|---|---------|----------------------|
| 1 | **Esistono librerie per auto-detect tipi colonne?** | Sì! **csv-schema-inference** (Python) è ottima. Per Node.js, combinare regex patterns + statistiche + LLM per casi ambigui. |
| 2 | **Quante righe campionare per inferenza accurata?** | **100-500 righe** sono sufficienti per la maggior parte dei casi. BigQuery usa 500 righe. Oltre è spreco di risorse. |
| 3 | **Come gestire colonne con tipi misti (es. numeri + testo)?** | Rilevare percentuale di ogni tipo. Se >80% numerico → numerico con fallback. Mostrare warning all'utente per colonne ambigue. |
| 4 | **L'AI può sbagliare il tipo?** | Sì, specialmente per: date in formati strani, codici che sembrano numeri (es. "00123"), valute con simboli. Prevedere sempre conferma utente per casi <90% confidence. |
| 5 | **Come gestire colonne senza header?** | Generare nomi automatici (col_1, col_2...) e chiedere all'utente di rinominarle. |

### Modifiche Necessarie al RDP

```typescript
// AGGIUNGERE: Inferenza tipi con pattern detection PRIMA di AI
function inferColumnType(values: any[]): { type: string; confidence: number } {
  const sample = values.slice(0, 100).filter(v => v != null);
  
  // Pattern detection veloce
  const patterns = {
    email: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
    date_iso: /^\d{4}-\d{2}-\d{2}$/,
    date_it: /^\d{2}\/\d{2}\/\d{4}$/,
    integer: /^-?\d+$/,
    decimal: /^-?\d+[.,]\d+$/,
    boolean: /^(true|false|si|no|yes|0|1)$/i,
  };
  
  for (const [type, regex] of Object.entries(patterns)) {
    const matches = sample.filter(v => regex.test(String(v)));
    const confidence = matches.length / sample.length;
    if (confidence >= 0.8) {
      return { type, confidence };
    }
  }
  
  // Fallback: string
  return { type: 'string', confidence: 1.0 };
}

// SOLO se confidence < 0.8, chiamare AI per analisi semantica
```

---

## 4. GEMINI FUNCTION CALLING

### Domande Critiche

| # | Domanda | Risposta (da ricerca) |
|---|---------|----------------------|
| 1 | **Quanti tool massimo definire?** | **10-20 tool massimo** per performance ottimale. Oltre, la qualità delle scelte AI degrada. I nostri 5-6 tool sono perfetti. |
| 2 | **Come gestire multi-turn conversation?** | Gemini è stateless. Usare **thought signatures** (gestite automaticamente da SDK) per mantenere contesto. Passare sempre history completa. |
| 3 | **Temperatura consigliata per function calling?** | **Temperatura 0** per determinismo. Con Gemini 3.x, lasciare default 1.0 ma validare sempre output. |
| 4 | **Cosa fare se AI non chiama nessun tool?** | Forzare tool use nel system prompt: "DEVI usare i tool per rispondere a domande numeriche. NON inventare dati." Se viola, rigettare risposta e riprovare. |
| 5 | **Come gestire parallel function calls?** | Gemini può chiamare più tool in parallelo automaticamente. Il backend deve gestire esecuzione parallela e aggregazione risultati. |

### Modifiche Necessarie al RDP

```typescript
// AGGIUNGERE: Validazione risposta AI
async function executeWithValidation(prompt: string, tools: Tool[]) {
  const response = await gemini.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools,
    generationConfig: {
      temperature: 0, // Determinismo per function calling
    }
  });
  
  const part = response.response.candidates?.[0]?.content?.parts?.[0];
  
  // Se la domanda richiede dati e AI non ha chiamato tool → ERRORE
  if (requiresData(prompt) && !part?.functionCall) {
    throw new Error('AI ha risposto senza usare i tool. Riprovo...');
  }
  
  return response;
}

// AGGIUNGERE: Retry logic con backoff
async function queryWithRetry(prompt: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await executeWithValidation(prompt, tools);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1)); // Backoff esponenziale
    }
  }
}
```

---

## 5. PROGRESS INDICATOR (SSE vs WebSocket)

### Domande Critiche

| # | Domanda | Risposta (da ricerca) |
|---|---------|----------------------|
| 1 | **SSE o WebSocket per progress updates?** | **SSE è meglio** per questo caso: unidirezionale (server→client), auto-reconnect, funziona con HTTP/2, passa firewall aziendali. WebSocket è overkill. |
| 2 | **Come gestire disconnessione client?** | SSE ha reconnect automatico built-in. Lato server, `req.on('close')` per cleanup risorse. |
| 3 | **Libreria consigliata per SSE Node.js?** | **better-sse** è production-ready: keepalive, batching, TypeScript support. |
| 4 | **Come gestire timeout 5 minuti?** | Inviare heartbeat ogni 30 secondi per mantenere connessione viva. Includere `elapsedTime` in ogni evento. |
| 5 | **Cosa mostrare se analisi fallisce?** | Evento `error` con messaggio user-friendly. Mai esporre stack trace. Offrire opzione "Riprova". |

### Modifiche Necessarie al RDP

```typescript
// USARE: SSE con better-sse invece di WebSocket
import { createSession } from 'better-sse';

app.get('/api/client-data/query/natural/stream', async (req, res) => {
  const session = await createSession(req, res);
  
  // Heartbeat ogni 30 secondi
  const heartbeat = setInterval(() => {
    session.push({ type: 'heartbeat', timestamp: Date.now() });
  }, 30000);
  
  try {
    await analyzeWithProgress(session, req.query);
  } catch (error) {
    session.push({ 
      type: 'error', 
      message: 'Analisi fallita. Riprova tra qualche minuto.' 
    });
  } finally {
    clearInterval(heartbeat);
    session.push({ type: 'complete' });
  }
});
```

---

## 6. ROW LEVEL SECURITY (RLS)

### Domande Critiche

| # | Domanda | Risposta (da ricerca) |
|---|---------|----------------------|
| 1 | **RLS è bypassato da superuser?** | **SÌ!** Mai usare superuser per app. Creare ruolo dedicato `app_user` senza SUPERUSER e senza BYPASSRLS. |
| 2 | **Come forzare RLS anche sul table owner?** | Usare `ALTER TABLE xxx FORCE ROW LEVEL SECURITY;` |
| 3 | **Views rispettano RLS?** | **NO di default!** Usare `WITH (security_invoker = true)` sulle views. |
| 4 | **Performance impact di RLS?** | Trascurabile SE hai **indici su tenant_id**. Senza indici, ogni query fa full table scan. |
| 5 | **RLS auto-popola tenant_id su INSERT?** | **NO!** Serve trigger o application logic per settare tenant_id. |

### Modifiche Necessarie al RDP

```sql
-- AGGIUNGERE: Setup completo RLS

-- 1. Creare ruolo applicazione (NON superuser)
CREATE ROLE app_user LOGIN PASSWORD 'xxx' NOSUPERUSER NOBYPASSRLS;

-- 2. Forzare RLS anche sul owner
ALTER TABLE client_data_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_data_datasets FORCE ROW LEVEL SECURITY;

-- 3. Policy con cache del setting
CREATE POLICY consultant_isolation ON client_data_datasets
  FOR ALL
  USING (consultant_id = (SELECT current_setting('app.current_consultant')::INTEGER));

-- 4. Trigger per auto-populate consultant_id
CREATE FUNCTION set_consultant_id() RETURNS TRIGGER AS $$
BEGIN
  NEW.consultant_id := current_setting('app.current_consultant')::INTEGER;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_consultant_id
  BEFORE INSERT ON client_data_datasets
  FOR EACH ROW EXECUTE FUNCTION set_consultant_id();

-- 5. Indice OBBLIGATORIO per performance
CREATE INDEX idx_datasets_consultant ON client_data_datasets(consultant_id);
```

---

## 7. CACHING QUERY

### Domande Critiche

| # | Domanda | Risposta |
|---|---------|----------|
| 1 | **Quanto tempo tenere in cache?** | 1 ora per metriche aggregate, 5 minuti per breakdown dettagliati. Invalidare su aggiornamento dataset. |
| 2 | **Usare Redis o tabella PostgreSQL?** | Per 1800 installazioni, **PostgreSQL** è sufficiente e semplifica architettura. Redis solo se latenza diventa problema. |
| 3 | **Come generare cache key univoca?** | Hash di `{datasetId}_{toolName}_{JSON.stringify(params)}` con SHA256. |
| 4 | **Cache negativa (query senza risultati)?** | Sì, cacheare anche risultati vuoti per evitare query ripetute inutili. |
| 5 | **Come gestire cache stampede?** | Usare lock distribuito o "probabilistic early expiration" per evitare che tutti i client richiedano stesso dato simultaneamente. |

### Modifiche Necessarie al RDP

```typescript
// AGGIUNGERE: Cache con lock per evitare stampede
import crypto from 'crypto';

function generateCacheKey(datasetId: number, tool: string, params: any): string {
  const data = `${datasetId}_${tool}_${JSON.stringify(params)}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

async function executeWithCache(datasetId: number, tool: string, params: any) {
  const cacheKey = generateCacheKey(datasetId, tool, params);
  
  // 1. Check cache
  const cached = await db.query(sql`
    SELECT result, created_at FROM client_data_query_cache
    WHERE dataset_id = ${datasetId} AND cache_key = ${cacheKey}
    AND expires_at > NOW()
    FOR UPDATE SKIP LOCKED  -- Evita stampede
  `);
  
  if (cached.length > 0) {
    return { ...cached[0].result, fromCache: true };
  }
  
  // 2. Execute query
  const result = await executeQuery(datasetId, tool, params);
  
  // 3. Save to cache
  await db.execute(sql`
    INSERT INTO client_data_query_cache (dataset_id, cache_key, result, expires_at)
    VALUES (${datasetId}, ${cacheKey}, ${JSON.stringify(result)}, NOW() + INTERVAL '1 hour')
    ON CONFLICT (dataset_id, cache_key) DO UPDATE 
    SET result = EXCLUDED.result, expires_at = EXCLUDED.expires_at
  `);
  
  return result;
}
```

---

## 8. AUTOMAZIONE (1800 Installazioni)

### Domande Critiche

| # | Domanda | Risposta |
|---|---------|----------|
| 1 | **Come minimizzare click utente?** | Auto-conferma se confidence >= 85%. Pattern comuni (DDTRIGHE, fatture) riconosciuti istantaneamente senza AI. |
| 2 | **Come gestire errori silently?** | Mai silently! Loggare tutto, mostrare errore user-friendly, offrire retry. Per 1800 installazioni serve monitoring centralizzato. |
| 3 | **Serve monitoring centralizzato?** | **SÌ assolutamente**. Aggregare errori, query lente, usage per consultant. Dashboard admin per supporto. |
| 4 | **Come scalare a 1800 consultant?** | Connection pooling (PgBouncer), rate limiting per consultant, limiti storage, cleanup automatico dati vecchi. |
| 5 | **Backup e disaster recovery?** | Backup giornaliero automatico (già gestito da Supabase). Retention 30 giorni. Test restore mensile. |

### Modifiche Necessarie al RDP

```typescript
// AGGIUNGERE: Monitoring centralizzato
interface AnalyticsEvent {
  consultantId: number;
  eventType: 'upload' | 'query' | 'error' | 'timeout';
  datasetId?: number;
  durationMs?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

async function trackEvent(event: AnalyticsEvent) {
  await db.insert(clientDataAnalytics).values({
    ...event,
    createdAt: new Date(),
  });
  
  // Alert su errori critici
  if (event.eventType === 'error') {
    console.error(`[ALERT] Consultant ${event.consultantId}: ${event.errorMessage}`);
    // Inviare a sistema monitoring (Sentry, DataDog, etc.)
  }
}

// AGGIUNGERE: Limiti per consultant
const LIMITS = {
  maxDatasetsPerConsultant: 50,
  maxRowsPerDataset: 1_000_000,
  maxTotalStorageMB: 500,
  maxQueriesPerHour: 1000,
};

async function checkLimits(consultantId: number) {
  const stats = await getConsultantStats(consultantId);
  
  if (stats.datasetCount >= LIMITS.maxDatasetsPerConsultant) {
    throw new LimitExceededError('Hai raggiunto il limite massimo di dataset.');
  }
  
  if (stats.queriesLastHour >= LIMITS.maxQueriesPerHour) {
    throw new RateLimitError('Troppe richieste. Riprova tra qualche minuto.');
  }
}
```

---

## RIEPILOGO MODIFICHE CRITICHE

| Sezione | Problema Identificato | Soluzione |
|---------|----------------------|-----------|
| **Upload** | xlsx carica tutto in RAM | Usare ExcelJS streaming |
| **Database** | Drizzle non supporta DDL dinamico | Usare raw SQL con sanitizzazione |
| **RLS** | Superuser bypassa RLS | Creare ruolo app_user dedicato |
| **RLS** | Views non rispettano RLS | Aggiungere security_invoker = true |
| **RLS** | Connection pool context leak | Usare SET LOCAL in transazioni |
| **AI** | AI può rispondere senza tool | Validare e forzare retry |
| **Progress** | WebSocket è overkill | Usare SSE con better-sse |
| **Cache** | Cache stampede | Usare FOR UPDATE SKIP LOCKED |
| **Scaling** | Nessun monitoring | Aggiungere tracking centralizzato |

---

## DIPENDENZE DA AGGIUNGERE

```bash
# Upload/Parsing
npm install exceljs chardet

# SSE
npm install better-sse

# Monitoring (opzionale)
npm install @sentry/node
```

---

## NEXT STEPS

1. Aggiornare RDP con tutte le modifiche identificate
2. Implementare streaming Excel con ExcelJS
3. Setup RLS corretto con ruolo dedicato
4. Implementare SSE per progress
5. Aggiungere monitoring centralizzato
