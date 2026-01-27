# RDP - Sistema Anti-Ripetizione Content Studio

## 📋 OVERVIEW

Implementare un sistema anti-ripetizione nel Content Studio Ideas Generator, replicando esattamente il meccanismo usato nell'Email Nurturing 365.

**Obiettivo:** Quando l'AI genera nuove idee, deve conoscere le idee/post già esistenti per evitare di ripetere titoli, hook e concetti simili.

---

## 🗄️ DATABASE

### Tabelle Esistenti (NO modifiche necessarie)

#### `content_ideas`
| Campo | Tipo | Uso per Anti-Ripetizione |
|-------|------|--------------------------|
| id | varchar (UUID) | Identificativo |
| consultant_id | varchar | Filtro per consulente |
| title | varchar(500) | ⚠️ DA PASSARE AL PROMPT |
| suggested_hook | text | ⚠️ DA PASSARE AL PROMPT |
| description | text | ⚠️ DA PASSARE AL PROMPT (primi 200 char) |
| target_platform | varchar | Filtro opzionale |
| status | varchar | new, in_progress, developed, archived |
| created_at | timestamp | Ordinamento |

#### `content_posts`
| Campo | Tipo | Uso per Anti-Ripetizione |
|-------|------|--------------------------|
| id | varchar (UUID) | Identificativo |
| consultant_id | varchar | Filtro per consulente |
| title | varchar(500) | ⚠️ DA PASSARE AL PROMPT |
| hook | text | ⚠️ DA PASSARE AL PROMPT |
| full_copy | text | Per contesto (primi 300 char) |
| platform | varchar | instagram, facebook, linkedin, twitter |
| status | varchar | draft, scheduled, published, archived |
| folder_id | varchar | Per includere post nelle cartelle |
| created_at | timestamp | Ordinamento |

### Query da Implementare

```sql
-- Recupera ultime 50 idee per consulente
SELECT id, title, suggested_hook, description, target_platform, status
FROM content_ideas
WHERE consultant_id = $1
ORDER BY created_at DESC
LIMIT 50;

-- Recupera ultimi 30 post (scheduled/published/draft)
SELECT id, title, hook, full_copy, platform, status, folder_id
FROM content_posts
WHERE consultant_id = $1
  AND status IN ('draft', 'scheduled', 'published')
ORDER BY created_at DESC
LIMIT 30;
```

---

## 🔧 BACKEND

### File: `server/services/content-ai-service.ts`

#### Nuova Funzione: `fetchPreviousContent()`

```typescript
interface PreviousIdea {
  title: string;
  hook: string | null;
  description: string | null;
  platform: string | null;
}

interface PreviousPost {
  title: string | null;
  hook: string | null;
  fullCopy: string | null;
  platform: string | null;
  folderId: string | null;
}

async function fetchPreviousContent(consultantId: string): Promise<{
  ideas: PreviousIdea[];
  posts: PreviousPost[];
}> {
  // Recupera ultime 50 idee
  const ideas = await db.select({...})
    .from(schema.contentIdeas)
    .where(eq(schema.contentIdeas.consultantId, consultantId))
    .orderBy(desc(schema.contentIdeas.createdAt))
    .limit(50);

  // Recupera ultimi 30 post
  const posts = await db.select({...})
    .from(schema.contentPosts)
    .where(and(
      eq(schema.contentPosts.consultantId, consultantId),
      inArray(schema.contentPosts.status, ['draft', 'scheduled', 'published'])
    ))
    .orderBy(desc(schema.contentPosts.createdAt))
    .limit(30);

  return { ideas, posts };
}
```

#### Nuova Funzione: `buildAntiRepetitionContext()`

```typescript
function buildAntiRepetitionContext(
  ideas: PreviousIdea[],
  posts: PreviousPost[]
): string {
  if (ideas.length === 0 && posts.length === 0) {
    return "";
  }

  let context = `

=== ⚠️ CONTENUTI GIÀ ESISTENTI - VIETATO RIPETERE! ===
Questi contenuti sono GIÀ stati creati. Le nuove idee DEVONO essere COMPLETAMENTE DIVERSE.

`;

  // Elenco titoli idee
  if (ideas.length > 0) {
    context += `📋 TITOLI IDEE GIÀ USATI (${ideas.length}):\n`;
    for (const idea of ideas) {
      context += `- "${idea.title}"${idea.platform ? ` [${idea.platform}]` : ''}\n`;
    }
    context += "\n";
  }

  // Elenco hook idee
  const hooksIdeas = ideas.filter(i => i.hook).slice(0, 20);
  if (hooksIdeas.length > 0) {
    context += `🎣 HOOK GIÀ USATI (${hooksIdeas.length}):\n`;
    for (const idea of hooksIdeas) {
      context += `- "${idea.hook}"\n`;
    }
    context += "\n";
  }

  // Elenco post pubblicati/schedulati
  if (posts.length > 0) {
    context += `📱 POST GIÀ CREATI/PUBBLICATI (${posts.length}):\n`;
    for (const post of posts) {
      if (post.title) {
        context += `- "${post.title}"${post.platform ? ` [${post.platform}]` : ''}\n`;
      }
    }
    context += "\n";
  }

  // Regole anti-ripetizione
  context += `
⛔ REGOLE ANTI-RIPETIZIONE OBBLIGATORIE:
1. TITOLI COMPLETAMENTE DIVERSI - NON usare parole chiave già presenti nei titoli sopra
2. HOOK DIVERSI - Nessun hook simile a quelli già usati
3. ANGOLI NUOVI - Affronta l'argomento da prospettive NON ancora trattate
4. STRUTTURE VARIATE - Se le idee precedenti usano domande, usa affermazioni e viceversa
5. METAFORE ORIGINALI - NON riutilizzare analogie/esempi già presenti

🎯 OBIETTIVO: Ogni nuova idea deve sembrare FRESCA e ORIGINALE, come se fosse la prima volta che ne parli.
`;

  return context;
}
```

#### Modifica: `generateContentIdeas()`

```typescript
export async function generateContentIdeas({
  consultantId,
  // ... altri parametri
}: GenerateIdeasParams): Promise<GenerateIdeasResult> {
  
  // NUOVO: Recupera contenuti precedenti
  const { ideas: previousIdeas, posts: previousPosts } = await fetchPreviousContent(consultantId);
  console.log(`[CONTENT-AI] Loaded ${previousIdeas.length} previous ideas + ${previousPosts.length} posts for anti-repetition`);
  
  // NUOVO: Costruisci contesto anti-ripetizione
  const antiRepetitionContext = buildAntiRepetitionContext(previousIdeas, previousPosts);
  
  // Inserisci nel prompt principale
  const prompt = `...
${antiRepetitionContext}
...`;

  // MODIFICA: Aumenta temperature
  const result = await provider.client.generateContent({
    model: ...,
    contents: [...],
    generationConfig: {
      temperature: 1.0,  // Era 0.8, ora 1.0 per più varietà
      maxOutputTokens: 8192,
    },
  });
}
```

---

## 🎨 FRONTEND

### Nessuna modifica UI necessaria

Il sistema anti-ripetizione è completamente backend. L'utente non deve fare nulla di diverso - semplicemente le idee generate saranno più varie.

---

## 📊 FLUSSO DATI

```
┌─────────────────────────────────────────────────────────────────┐
│                     GENERAZIONE IDEE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Frontend → POST /api/content/ai/generate-ideas              │
│                                                                 │
│  2. Backend: fetchPreviousContent(consultantId)                 │
│     ├── SELECT FROM content_ideas (ultimi 50)                   │
│     └── SELECT FROM content_posts (ultimi 30)                   │
│                                                                 │
│  3. Backend: buildAntiRepetitionContext()                       │
│     ├── Lista titoli già usati                                  │
│     ├── Lista hook già usati                                    │
│     └── Regole anti-ripetizione                                 │
│                                                                 │
│  4. Backend: Costruisci prompt con contesto                     │
│     ├── Istruzioni base                                         │
│     ├── Brand voice                                             │
│     ├── Schema selezionato                                      │
│     ├── Writing style                                           │
│     └── ⚠️ ANTI-RIPETIZIONE CONTEXT ← NUOVO                     │
│                                                                 │
│  5. Backend: Chiamata AI con temperature 1.0                    │
│                                                                 │
│  6. Frontend ← Idee generate (ora più varie!)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST IMPLEMENTAZIONE

- [ ] 1. Creare `fetchPreviousContent()` in content-ai-service.ts
- [ ] 2. Creare `buildAntiRepetitionContext()` in content-ai-service.ts
- [ ] 3. Modificare `generateContentIdeas()` per chiamare le nuove funzioni
- [ ] 4. Inserire `antiRepetitionContext` nel prompt principale
- [ ] 5. Aumentare temperature da 0.8 a 1.0
- [ ] 6. Aggiungere log di debug
- [ ] 7. Testare generazione

---

## 🔄 STATO IMPLEMENTAZIONE

| Task | Status | Note |
|------|--------|------|
| fetchPreviousContent() | ✅ Completato | Linee 989-1026 |
| buildAntiRepetitionContext() | ✅ Completato | Linee 1028-1092 |
| Modifica generateContentIdeas() | ✅ Completato | Linee 1103-1106 + 1530 |
| Temperature 1.0 | ✅ Completato | Linea 1587 |
| Test | 🔲 Da fare | |

---

*Documento creato: 2026-01-27*
*Ultimo aggiornamento: Implementazione completata*
